#!/usr/bin/env node
// Buyer-side, explicitly opted-in, independently funded payment for ONE
// original x402 CSV inspection. Default is FREE challenge-only preflight.
// Never run using the merchant's own wallet, VM1 MetaMask seed or user funds.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  RESOURCE, parseArgs, validateBuyerRequestURL,
  validatePaymentRequiredHeader, requireExplicitPaymentConfirmation
} from "./quote-guard.mjs";

const SAMPLE=[
 "email,amount,date,note",
 "a@example.invalid,12.5,2026-10-20,paid",
 "a@example.invalid,12.5,2026-10-20,paid",
 "b@example.invalid,not-a-number,2026-13-99,=1+1"
].join("\n");

const HELP=[
 "One Cursor x402v2 CSV buyer: exactly 0.005 native Circle USDC on Base.",
 "node csv-buyer.mjs                    # FREE 402 quote check (default)",
 "node csv-buyer.mjs --file my.csv      # FREE quote for your CSV",
 "node csv-buyer.mjs --help",
 "Optional REAL PAID order by an independent consenting buyer only:",
 "  BUYER_CONFIRM_005_USDC_BASE_PAYMENT=YES_TO_ONE_005_USDC_CHARGE",
 "  BUYER_DEDICATED_EVM_PRIVATE_KEY=<dedicated-low-value-key>",
 "  node csv-buyer.mjs --pay --file my.csv",
 "Never use the original merchant owner wallet, production MetaMask or",
 "private personal data without authorization. No keys or raw rows are logged.",
 "HTTP200 delivery is not standalone evidence of finalized USDC settlement."
].join("\n")+"\n";

async function main(argv=process.argv.slice(2), env=process.env){
 const a=parseArgs(argv);
 if(a.help){process.stdout.write(HELP);return;}
 // FAIL CLOSED before network traffic or loading signing dependencies.
 if(a.pay)requireExplicitPaymentConfirmation(env);
 let csvText=SAMPLE;
 if(a.file)csvText=await readFile(a.file,"utf8");
 if(Buffer.byteLength(csvText,"utf8")>32768 || !csvText.trim() || csvText.includes("\u0000"))
  throw new Error("BLOCK: invalid/empty/binary CSV or >32KiB input");
 const json={csvText};
 if(a.expectedColumns)json.expectedColumns=a.expectedColumns;
 const options={
  method:"POST",redirect:"error",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(json)
 };
 validateBuyerRequestURL(RESOURCE,options.method);
 const preflight=await fetch(RESOURCE,options);
 if(preflight.status!==402)
  throw new Error("BLOCK: expected free x402 quote; HTTP "+preflight.status);
 const original=validatePaymentRequiredHeader(preflight.headers.get("payment-required"));
 process.stdout.write(JSON.stringify({
  status:"UNPAID_QUOTE_VERIFIED",network:original.network,
  amountUSDC:original.amountUSDC,asset:original.asset,payTo:original.payTo,
  buyerInput:a.file?"explicit buyer-supplied CSV":"fake synthetic sample",
  charged:false
 })+"\n");
 if(!a.pay)return;
 const key=requireExplicitPaymentConfirmation(env);
 const [{ privateKeyToAccount },{ x402Client },
  { registerExactEvmScheme },{ wrapFetchWithPayment }]=await Promise.all([
   import("viem/accounts"),import("@x402/core/client"),
   import("@x402/evm/exact/client"),import("@x402/fetch")
  ]);
 const client=new x402Client();
 registerExactEvmScheme(client,{signer:privateKeyToAccount(key)});
 let challenged=0;
 async function allowlistedFetch(input,init={}){
  const u=typeof input==="string"||input instanceof URL?String(input):input?.url;
  const method=init.method || input?.method || "GET";
  validateBuyerRequestURL(u,method);
  const response=await fetch(input,init);
  if(response.status===402){
   validatePaymentRequiredHeader(response.headers.get("payment-required"),u);
   challenged++;
  }
  return response;
 }
 const request=wrapFetchWithPayment(allowlistedFetch,client);
 // The SDK MUST re-fetch the 402 via the same strict allowlistedFetch
 // before producing any buyer signature. No signed retries on error here.
 const response=await request(RESOURCE,options);
 if(!response.ok){
  process.stdout.write(JSON.stringify({
   status:"DELIVERY_NOT_VERIFIED",http:response.status,checkedQuotes:challenged,
   finality:"UNKNOWN_INSPECT_BUYER_WALLET"
  })+"\n");
  return;
 }
 // The buyer owns the paid result; do not print potentially sensitive CSV.
 const receipt=response.headers.get("payment-response") ||
   response.headers.get("x-payment-response");
 process.stdout.write(JSON.stringify({
  status:"PRODUCT_HTTP200",receiptHeaderPresent:Boolean(receipt),
  amountRequestedUSDC:original.amountUSDC,
  independentlyFinalizedERC20Transfer:"NOT_CONFIRMED_HERE"
 })+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(err=>{
  // Never print signer keys, raw provider responses or CSV rows.
  process.stderr.write(
   (String(err?.message||"").startsWith("BLOCK:")?err.message:
    "Buyer quote/payment failed; independently check buyer settlement status")+"\n");
  process.exitCode=1;
 });
}
export {main};
