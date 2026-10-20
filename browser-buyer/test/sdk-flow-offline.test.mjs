import test from "node:test";
import assert from "node:assert/strict";
import {wrapFetchWithPayment} from "@x402/fetch";
import {x402Client} from "@x402/core/client";
import {registerExactEvmScheme} from "@x402/evm/exact/client";
import {RESOURCE,PAYTO,ASSET,NETWORK,makeInjectedBuyerSigner,guardOutgoing,checkQuote,requestBody} from "../src/guards.mjs";
const buyer="0x1111111111111111111111111111111111111111";
const q={x402Version:2,error:"Payment required",resource:{url:RESOURCE,description:"Synthetic CSV structure preview",mimeType:"application/json"},accepts:[{scheme:"exact",network:NETWORK,asset:ASSET,amount:"5000",payTo:PAYTO,maxTimeoutSeconds:300,extra:{name:"USD Coin",version:"2"}}],extensions:{}};
const header=Buffer.from(JSON.stringify(q)).toString("base64");
const body=requestBody("email,amount\nsynthetic@example.invalid,1.25");
test("real @x402 sdk with fake buyer signer makes ONE simulated sign and ONE simulated paid POST; no wallet/network",async()=>{
 let req=0,sign=0;
 const signer=makeInjectedBuyerSigner({provider:{request:async()=> "0x2105"},address:buyer,signTypedData:async()=>{
  sign++;
  return "0x"+"11".repeat(65);
 }});
 const client=new x402Client();
 registerExactEvmScheme(client,{signer,networks:[NETWORK]});
 const mockFetch=async (input,init={})=>{
  await guardOutgoing(input,init,body);
  req++;
  if(req===1)return new Response("{}",{status:402,headers:{"PAYMENT-REQUIRED":header}});
  assert.equal(req,2,"SDK must not call more than twice");
  assert.ok(new Headers(input.headers).has("PAYMENT-SIGNATURE"),"paid request has v2 payment signature");
  return new Response(JSON.stringify({kind:"SYNTHETIC_RESPONSE_NOT_MAINNET"}),{status:200,headers:{"content-type":"application/json"}});
 };
 const wrapped=wrapFetchWithPayment(mockFetch,client);
 const r=await wrapped(RESOURCE,{method:"POST",redirect:"error",body,headers:{"Content-Type":"application/json"}});
 assert.equal(r.status,200);assert.equal(req,2);assert.equal(sign,1);
 assert.equal(signer.getSignCount(),1);
 assert.match(await r.text(),/SYNTHETIC_RESPONSE/);
});
test("modified malicious price quote rejected BEFORE mock buyer sign",async()=>{
 let sign=0;
 const client=new x402Client();
 registerExactEvmScheme(client,{signer:makeInjectedBuyerSigner({provider:{request:async()=> "0x2105"},address:buyer,signTypedData:async()=>{sign++;return "0x"+"11".repeat(65);}}),networks:[NETWORK]});
 const altered=structuredClone(q);altered.accepts[0].amount="90000000";
 const badHeader=Buffer.from(JSON.stringify(altered)).toString("base64");
 let requests=0;
 const wrapped=wrapFetchWithPayment(async (input,init={})=>{
  await guardOutgoing(input,init,body);
  requests++;
  checkQuote(badHeader);
  return new Response("",{status:402,headers:{"PAYMENT-REQUIRED":badHeader}});
 },client);
 await assert.rejects(()=>wrapped(RESOURCE,{method:"POST",redirect:"error",body,headers:{"Content-Type":"application/json"}}),/BLOCK/);
 assert.equal(sign,0);
 assert.equal(requests,1);
});
