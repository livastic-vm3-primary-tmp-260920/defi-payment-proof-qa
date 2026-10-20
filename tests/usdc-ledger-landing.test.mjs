import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=f=>readFileSync(new URL(f,import.meta.url),"utf8");
const landing=read("../guides/base-usdc-merchant-ledger.html");
const home=read("../index.html");
const sitemap=read("../sitemap.xml");
const agent=read("../llms.txt");
const script=read("../usdc-ledger-local.mjs");
const decoder=read("../usdc-receipt-json-local.mjs");
const route="guides/base-usdc-merchant-ledger.html";
test("real website discovers the new local USDC merchant product from homepage and sitemap",()=>{
  for(const doc of [home,sitemap,agent])
    assert.ok(doc.includes(route),"missing exact route in "+doc.slice(0,70));
  assert.equal((sitemap.match(/base-usdc-merchant-ledger\.html/g)||[]).length,1);
});
test("canonical SEO and explicit free software classification are accurate",()=>{
  assert.match(landing,/<link rel="canonical" href="https:\/\/livastic-vm3-primary-tmp-260920\.github\.io\/defi-payment-proof-qa\/guides\/base-usdc-merchant-ledger\.html">/);
  assert.match(landing,/"isAccessibleForFree":true/);
  assert.match(landing,/"price":"0","priceCurrency":"USD"/);
  assert.match(landing,/<meta name="description"/);
});
test("browser-only tooling has no network, signer, storage or analytics execution surface",()=>{
  assert.match(landing,/import \{[\s\S]*analyzeUsdcLedger/);
  assert.match(landing,/type="module"/);
  assert.doesNotMatch(landing,/<script\s+src=|<iframe|<form|<object/i);
  for(const txt of [landing,script,decoder]) {
    assert.doesNotMatch(txt,/\bfetch\s*\(|\bXMLHttpRequest\b|sendBeacon\s*\(|\bWebSocket\s*\(|localStorage|sessionStorage|window\.ethereum|ethereum\.request|walletconnect/i);
  }
});
test("buyer can run, inspect, export and clear without a mandatory upload or onchain payment",()=>{
  for(const id of ["wallet","csv","csv-file","run","sample","clear","report","export","claimed-usdc","claimed-count","review-count","findings-body"]) assert.ok(landing.includes('id="'+id+'"'));
  assert.match(landing,/No chain nodes were queried/);
  assert.match(landing,/No network call, file upload, payment, wallet signature or persistence/);
});
test("receipt JSON paste lowers input friction but never authenticates an onchain receipt",()=>{
 for(const id of ["receipt-json","receipt-import","receipt-sample","receipt-status"])
   assert.ok(landing.includes('id="'+id+'"'));
 assert.match(landing,/eth_getTransactionReceipt/);
 assert.match(landing,/Every imported delivery_status is unknown/);
 assert.match(landing,/The tool cannot authenticate pasted data/);
 assert.match(decoder,/settlementVerified:false/);
 assert.match(decoder,/chainVerified:false/);
});
test("receipt JSON parsing remains bounded local-only, without external resources",()=>{
 assert.match(decoder,/RECEIPT_JSON_MAX_BYTES = 102400/);
 assert.match(decoder,/USDC Transfer/);
 assert.match(decoder,/chain ID does not match Base 8453/);
 assert.match(decoder,/networkRequests:0/);
 assert.match(landing,/No RPC calls/);
});
test("paid scope is a separate honest opt-in route to established one-owner seller identity",()=>{
  assert.match(landing,/5 USDC for one public transfer/);
  assert.match(landing,/15 USDC scoped reconciliation/);
  assert.match(landing,/opentask\.ai\/profiles\/cmvckd5ok00cx08jyc1yh8bvz/);
  assert.match(landing,/not an instant checkout or an automatically purchased service/i);
  assert.match(landing,/mailto:onecursor1@gmail.com/);
  assert.match(landing,/No order, payment, review, guarantee or past client engagement/i);
});
test("existing real machine-payable 2.50 USDC Soul listing is a separate, opt-in channel",()=>{
  assert.match(landing,/Soul.Markets AI service profile/);
  assert.match(landing,/2\.50 Base USDC/);
  assert.match(landing,/api\.soul\.mds\.markets\/v1\/soul\/vm3-usdc-receipt-qa/);
  assert.match(landing,/zero prior orders for this SKU/);
});
test("CSV claims cannot silently become a certified onchain payout or fiat revenue",()=>{
  assert.match(landing,/A CSV is a claim, not a chain receipt/);
  assert.match(landing,/not a payment receipt/);
  assert.match(landing,/Not on-chain verified or revenue/);
  assert.match(script,/settledRevenueUsdc:null/);
  assert.match(script,/verifiedOnchainUsdc:null/);
});
