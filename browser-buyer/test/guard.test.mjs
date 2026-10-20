import test from "node:test";
import assert from "node:assert/strict";
import {checkQuote,guardTypedData,makeInjectedBuyerSigner,guardOutgoing,allowedBrowserTransportHeaders,requestBody,validateCsv,RESOURCE,PAYTO,ASSET} from "../src/guards.mjs";
const buyer="0x1111111111111111111111111111111111111111";
const quote={x402Version:2,resource:{url:RESOURCE},accepts:[{scheme:"exact",network:"eip155:8453",asset:ASSET,amount:"5000",payTo:PAYTO,maxTimeoutSeconds:300,extra:{name:"USD Coin",version:"2"}}]};
const header=v=>Buffer.from(JSON.stringify(v)).toString("base64");
const validTypes={TransferWithAuthorization:[{name:"from",type:"address"},{name:"to",type:"address"},{name:"value",type:"uint256"},{name:"validAfter",type:"uint256"},{name:"validBefore",type:"uint256"},{name:"nonce",type:"bytes32"}]};
const typed=()=>({domain:{name:"USD Coin",version:"2",chainId:8453,verifyingContract:ASSET},types:structuredClone(validTypes),primaryType:"TransferWithAuthorization",message:{from:buyer,to:PAYTO,value:5000n,validAfter:0n,validBefore:BigInt(Math.floor(Date.now()/1000)+240),nonce:"0x"+"3".repeat(64)}});
test("genuine exact v2 quote accepted for prepayment display, not a payment",()=>{
 const q=checkQuote(header(quote));assert.equal(q.amountUsdc,"0.005000");assert.equal(q.confirmedPayment,false);
});
test("wrong chain, amount, asset, payee, resource, scheme, timeout, domain rejected",()=>{
 const changes=[
  ["network","eip155:84532"],["amount","5001"],["asset","0x"+"2".repeat(40)],
  ["payTo","0x"+"4".repeat(40)],["scheme","upto"],["maxTimeoutSeconds",7200]
 ];
 for(const [key,value] of changes){const q=structuredClone(quote);q.accepts[0][key]=value;assert.throws(()=>checkQuote(header(q)),/BLOCK/);}
 const q=structuredClone(quote);q.resource.url="https://other.example/pay";assert.throws(()=>checkQuote(header(q)),/BLOCK/);
 const p=structuredClone(quote);p.accepts[0].extra.assetTransferMethod="permit2";assert.throws(()=>checkQuote(header(p)),/BLOCK/);
});
test("wrong version, malformed base64, multiaccept and empty accept refuse",()=>{
 for(const h of ["#bad",header({...quote,x402Version:1}),header({...quote,accepts:[quote.accepts[0],quote.accepts[0]]}),header({...quote,accepts:[]})]){
  assert.throws(()=>checkQuote(h),/BLOCK/);
 }
});
test("CSV must be nonempty bounded binary-free and unicode byte counted",()=>{
 assert.equal(validateCsv("header\na,b"),10);
 for(const text of ["", "\0","x".repeat(32769),"한".repeat(13000)])assert.throws(()=>validateCsv(text),/BLOCK/);
});
test("single exact origin, POST and immutable expected body",async()=>{
 const b=requestBody("a,b\n1,2");
 assert.equal(await guardOutgoing(RESOURCE,{method:"POST",body:b,redirect:"error"},b),true);
 for(const [uri,init] of [["https://evil.test", {method:"POST",body:b}], [RESOURCE,{method:"GET",body:b}], [RESOURCE,{method:"POST",body:"{}"}]]){
  await assert.rejects(()=>guardOutgoing(uri,init,b),/BLOCK/);
 }
});
test("EIP712 domain, message and 6 exact typed fields checked before signing",()=>{
 assert.equal(guardTypedData(typed(),buyer),true);
 for(const [path,value] of [["domain.chainId",1],["domain.verifyingContract","0x"+"2".repeat(40)],["message.to","0x"+"5".repeat(40)],["message.value",6000n],["message.from","0x"+"6".repeat(40)],["message.validBefore",0n]]){
  const x=typed();const [section,key]=path.split(".");x[section][key]=value;
  assert.throws(()=>guardTypedData(x,buyer),/BLOCK/);
 }
});
test("bad EIP712 primary type, field schema and nonce fail",()=>{
 const p=typed();p.primaryType="PermitTransferFrom";assert.throws(()=>guardTypedData(p,buyer),/BLOCK/);
 const q=typed();q.types.TransferWithAuthorization[2].type="uint8";assert.throws(()=>guardTypedData(q,buyer),/BLOCK/);
 const a=typed();a.message.nonce="0x1";assert.throws(()=>guardTypedData(a,buyer),/BLOCK/);
});
test("signed request strictly disabled on wrong wallet chain",async()=>{
 let signed=0;
 const x=makeInjectedBuyerSigner({provider:{request:async()=> "0x1"},address:buyer,signTypedData:async()=>{signed++;return "0xsignature";}});
 await assert.rejects(()=>x.signTypedData(typed()),/BLOCK/);
 assert.equal(signed,0);
});
test("one independently approved typed signature maximum, no automatic repeat",async()=>{
 let calls=0;
 const s=makeInjectedBuyerSigner({provider:{request:async()=> "0x2105"},address:buyer,signTypedData:async()=>{calls++;return "0xsignature";}});
 assert.equal(await s.signTypedData(typed()),"0xsignature");
 await assert.rejects(()=>s.signTypedData(typed()),/BLOCK/);
 assert.equal(calls,1);
});
test("malicious first typed signing request never calls provider signer",async()=>{
 let calls=0;
 const s=makeInjectedBuyerSigner({provider:{request:async()=> "0x2105"},address:buyer,signTypedData:async()=>{calls++;return "0xsignature";}});
 const p=typed();p.message.to="0x"+"3".repeat(40);
 await assert.rejects(()=>s.signTypedData(p),/BLOCK/);
 assert.equal(calls,0);
});

test("browser transport removes only invalid response-only request header, never signature",()=>{
 const req=new Request(RESOURCE,{method:"POST",body:"{}",headers:{"Content-Type":"application/json","PAYMENT-SIGNATURE":"v2-public-test-signature","Access-Control-Expose-Headers":"PAYMENT-RESPONSE"}});
 const headers=allowedBrowserTransportHeaders(req);
 assert.equal(headers.has("access-control-expose-headers"),false);
 assert.equal(headers.get("PAYMENT-SIGNATURE"),"v2-public-test-signature");
 assert.equal(headers.get("Content-Type"),"application/json");
});
