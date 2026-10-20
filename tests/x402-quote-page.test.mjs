import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const p=readFileSync(new URL("../guides/x402-quote-safety.html",import.meta.url),"utf8");
const source=readFileSync(new URL("../x402-quote-safety.mjs",import.meta.url),"utf8");
test("self-contained accessible new local quote UI with a result region",()=>{
  for(const required of ['id="inspect"','id="demo"','id="clear"','id="quote"','aria-live="polite"','id="expected-recipient"','id="max-price"','id="expected-resource"']){
    assert.ok(p.includes(required),required);
  }
});
test("user untrusted quote never reaches innerHTML or eval",()=>{
  assert.doesNotMatch(p,/\.innerHTML\s*=|\beval\s*\(|document\.write\s*\(|insertAdjacentHTML/);
  assert.match(p,/node\.textContent=String\(text\)/);
});
test("one fixed actual merchant GET for optional live preview, no automatic payment",()=>{
  assert.match(p,/fetch\(LIVE_EXAMPLE_ENDPOINT/);
  assert.match(p,/credentials:"omit",redirect:"error",cache:"no-store"/);
  assert.match(p,/response\.status!==402/);
  assert.match(p,/response\.headers\.get\("PAYMENT-REQUIRED"\)/);
  assert.doesNotMatch(p,/(?:window\.)?ethereum|personal_sign|transferWithAuthorization|sendTransaction|\bapprove\s*\(/i);
});
test("quote-only flow has no sign or auto checkout fields",()=>{
  assert.ok(p.includes("this free quote preview is not a checkout"));
  assert.ok(p.includes("no paid customer-input CSV POST order is claimed"));
  assert.doesNotMatch(p,/<form\b[^>]*action=|type="file"/i);
});
test("live service offers real machine payable original same owner CSV buyer funnel",()=>{
  assert.ok(p.includes("csv-structural-preflight-005-base-usdc.html"));
  assert.ok(p.includes("0.005 native Circle Base USDC"));
  assert.ok(p.includes("POST /v1/csv-preflight"));
});
test("actual core and offline test links correct",()=>{
  assert.ok(p.includes("x402-quote-safety.mjs"));
  assert.ok(p.includes("tests/x402-quote-safety.test.mjs"));
  assert.ok(source.includes("PAYMENT-REQUIRED"));
});
test("meta and narrow mobile layout without tracking scripts",()=>{
  assert.match(p,/<link rel="canonical"/);
  assert.match(p,/og:title/);
  assert.match(p,/@media\(max-width:760px\)/);
  assert.doesNotMatch(p,/<script\s+src=|google-analytics|gtag\(/);
});
