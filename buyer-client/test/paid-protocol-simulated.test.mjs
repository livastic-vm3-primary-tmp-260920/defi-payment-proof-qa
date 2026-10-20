import test from "node:test";
import assert from "node:assert/strict";
import {main} from "../csv-buyer.mjs";
import {RESOURCE, PAYTO, ASSET, NETWORK} from "../quote-guard.mjs";

// This file is a closed synthetic payment-protocol simulation. It sends ZERO
// HTTP requests to outside sellers, signs a dummy 0x111... key only, and
// NEVER settles or transfers any USDC to any chain.
const dummy = "0x" + "11".repeat(32);
const quote = {
 x402Version:2,
 resource:{url:RESOURCE,description:"Original synthetic CSV quality check",mimeType:"application/json"},
 accepts:[{
  scheme:"exact",network:NETWORK,amount:"5000",payTo:PAYTO,asset:ASSET,
  maxTimeoutSeconds:60,extra:{name:"USD Coin",version:"2"}
 }]
};
const challenge = Buffer.from(JSON.stringify(quote)).toString("base64url");

test("offline simulated dry-run: no signer, one 402, no payment retry",async()=>{
 const saved=globalThis.fetch, savedOut=process.stdout.write;
 let calls=0, transcript="";
 try{
  globalThis.fetch=async()=>{
   calls++;
   return new Response("{}",{status:402,headers:{"payment-required":challenge}});
  };
  process.stdout.write=x=>{transcript+=String(x);return true;};
  await main([],{});
  assert.equal(calls,1);
  assert.match(transcript,/UNPAID_QUOTE_VERIFIED/);
  assert.match(transcript,/"charged":false/);
 }finally{globalThis.fetch=saved;process.stdout.write=savedOut;}
});

test("offline full SDK: one signed dummy payment retry only for pinned quote",async()=>{
 const saved=globalThis.fetch,savedOut=process.stdout.write;
 let calls=0,signedRetry=false,out="";
 try{
  globalThis.fetch=async(input,init={})=>{
   calls++;
   const h=new Headers(init.headers||input?.headers||{});
   if(h.has("PAYMENT-SIGNATURE") || h.has("payment-signature")){
    signedRetry=true;
    assert.equal(calls,3);
    return new Response(JSON.stringify({ok:true,issues:2}),{
     status:200,headers:{"content-type":"application/json","payment-response":"synthetic-success-only"}
    });
   }
   return new Response("{}",{status:402,headers:{"payment-required":challenge}});
  };
  process.stdout.write=x=>{out+=String(x);return true;};
  await main(["--pay"],{
   BUYER_CONFIRM_005_USDC_BASE_PAYMENT:"YES_TO_ONE_005_USDC_CHARGE",
   BUYER_DEDICATED_EVM_PRIVATE_KEY:dummy
  });
  assert.equal(calls,3);
  assert.equal(signedRetry,true);
  assert.match(out,/PRODUCT_HTTP200/);
 }finally{globalThis.fetch=saved;process.stdout.write=savedOut;}
});

test("offline full SDK blocks hostile price drift BEFORE dummy signature",async()=>{
 const saved=globalThis.fetch, savedOut=process.stdout.write;
 let calls=0,signed=0;
 try{
  globalThis.fetch=async(input,init={})=>{
   calls++;
   const hdr=new Headers(init.headers||input?.headers||{});
   if(hdr.has("payment-signature"))signed++;
   const bad={...quote,accepts:[{...quote.accepts[0],amount:"5001"}]};
   return new Response("{}",{
    status:402,headers:{"payment-required":
     Buffer.from(JSON.stringify(calls===1?quote:bad)).toString("base64url")}
   });
  };
  process.stdout.write=()=>true;
  await assert.rejects(()=>main(["--pay"],{
   BUYER_CONFIRM_005_USDC_BASE_PAYMENT:"YES_TO_ONE_005_USDC_CHARGE",
   BUYER_DEDICATED_EVM_PRIVATE_KEY:dummy
  }),/BLOCK: price, scheme, chain, token or recipient changed/);
  assert.equal(calls,2);
  assert.equal(signed,0);
 }finally{globalThis.fetch=saved;process.stdout.write=savedOut;}
});
test("offline CLI --pay without confirmation never even fetches",async()=>{
 const saved=globalThis.fetch;
 let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error("unexpected network");};
  await assert.rejects(()=>main(["--pay"],{}),/BLOCK: buyer confirmation missing/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=saved;}
});
