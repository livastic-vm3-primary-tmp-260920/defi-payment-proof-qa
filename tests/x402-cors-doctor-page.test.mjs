import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const page=read("guides/x402-browser-cors-doctor.html");
const module=read("x402-cors-doctor-local.mjs");
const home=read("index.html");
const map=read("sitemap.xml");
const ai=read("llms.txt");

test("one canonical free browser-based CORS tool is discoverable from original home/sitemap/llms",()=>{
  const path="guides/x402-browser-cors-doctor.html";
  for(const content of [home,map,ai])assert.ok(content.includes(path));
  assert.equal((map.match(/x402-browser-cors-doctor\.html/g)||[]).length,1);
  assert.match(page,/rel="canonical"/);
  assert.match(page,/"isAccessibleForFree":true/);
});
test("actual click is required for network; page creates no automatic x402 paid request",()=>{
  assert.match(page,/el\("live-probe"\)\.addEventListener\("click"/);
  assert.match(page,/el\("probe-consent"\)\.checked/);
  assert.match(page,/credentials:"omit"/);
  assert.match(page,/method:"GET"/);
  assert.match(page,/referrerPolicy:"no-referrer"/);
  assert.match(page,/redirect:"error"/);
  assert.match(page,/cache:"no-store"/);
  assert.match(page,/setTimeout\(\(\)=>controller\.abort\(\),9000\)/);
  assert.doesNotMatch(page,/window\.ethereum|ethereum\.request|sendTransaction|personal_sign|walletconnect|eth_sendTransaction|PAYMENT-SIGNATURE.*:.*[a-zA-Z0-9+/]{200}/i);
});
test("diagnostic distinguishes 402 challenge readability from OPTIONS preflight and paid purchase",()=>{
  assert.match(page,/cannot directly set its own browser-generated/);
  assert.match(page,/Live GET test only checks quote readability/i);
  assert.match(page,/signed-POST preflight/);
  assert.match(page,/paidMethod:el\("paid-method"\)\.value/);
  assert.match(page,/A passing quote is not proof of seller safety or fulfillment/);
  assert.match(page,/does NOT verify the payee, paid retry, settlement or delivery/);
});
test("trusted example is a same-owner public free quote GET, not self-purchased x402 payment",()=>{
  assert.match(page,/https:\/\/vm5-openapi-x402\.onrender\.com\/v1\/csv-report/);
  assert.match(page,/id="same-owner-sample"/);
  assert.match(page,/Authorize a live GET separately/);
  assert.match(page,/wallet connection or chain transaction happens here/i);
});
test("public page has no inline analytics, forms, iframe, third-party scripts or storage",()=>{
  assert.doesNotMatch(page,/<form|<iframe|<script\s+src=|localStorage|sessionStorage|sendBeacon|gtag\(/i);
  assert.doesNotMatch(module,/\bfetch\s*\(|navigator\.sendBeacon|localStorage|window\.ethereum/);
  assert.match(page,/no background network request is made/i);
});
test("safe price request remains a manual quote; no phantom jobs or cash",()=>{
  assert.match(page,/Request the 15 USDC fixed-scope pilot/);
  assert.match(page,/Separate 0\.75 \/ 1\.50 USDC quote-shape AI services/);
  assert.match(page,/No wallet signature is required to ask for a quote/);
  assert.match(page,/no buyer contract or payout has been verified/i);
});
test("user feedback links to actually published original one-beneficial-owner GitHub funnel",()=>{
  assert.match(page,/base-usdc-merchant-ledger\.html#buyer-feedback/);
  assert.match(page,/github\.com\/x402-foundation\/x402\/issues\/3722#issuecomment-6288556282/);
  assert.match(page,/one real beneficial owner/i);
});
test("developer can paste public 402 and OPTIONS without signing or RPC",()=>{
  for(const id of ["buyer-origin","public-endpoint","probe-consent","live-probe","challenge-paste",
    "options-paste","offline-results","inspect-headers","sample-headers","paid-method",
    "live-status","live-price-readable"])assert.ok(page.includes('id="'+id+'"'),"Missing "+id);
  assert.match(page,/user-supplied assertions/);
  assert.match(page,/not independently authenticated responses/);
});

test("third-party PQS reproducibility is real and explicitly not a client testimonial",()=>{
  assert.match(page,/id="actual-external-repro"/);
  assert.match(page,/https:\/\/github\.com\/OnChainAIIntel\/x402-pqs\/issues\/1/);
  assert.match(page,/pqs\.onchainintel\.net\/api\/preflight/);
  assert.match(page,/TypeError: Failed to fetch/);
  assert.match(page,/Access-Control-Allow-Origin/);
  assert.match(page,/No wallet signature is required to ask for a quote/);
  assert.match(page,/operator has not commissioned us, confirmed browser support, hired us or paid us/);
  assert.match(page,/browser integration may be intentionally unsupported/);
});
test("concrete fixed 15 USDC integration QA offer requires written independent buyer acceptance",()=>{
  assert.match(page,/15 native Base USDC per one authorized endpoint/);
  assert.match(page,/one buyer-owned\/explicitly authorized public HTTPS x402 endpoint and one stated browser Origin/);
  assert.match(page,/acceptance/i);
  assert.match(page,/one no-cost read-only retest/);
  assert.match(page,/before work or any payment/);
  assert.match(page,/guaranteed client conversion/);
  assert.match(page,/No paying buyer of this pilot is claimed/);
  assert.match(page,/subject=15%20Base%20USDC%20x402/);
});
test("priced consulting never changes the free diagnostic or auto-charges the customer",()=>{
  assert.match(page,/"isAccessibleForFree":true/);
  assert.match(page,/if no agreement is reached the free tool remains available at 0 USDC/i);
  assert.doesNotMatch(page,/window\.ethereum|ethereum\.request|sendTransaction|<iframe|<script\s+src=/i);
});
