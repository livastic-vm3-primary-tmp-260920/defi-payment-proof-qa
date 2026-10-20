import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../guides/csv-browser-x402-checkout.html",import.meta.url),"utf8");
const readme=readFileSync(new URL("../README.md",import.meta.url),"utf8");
test("buyers see real version-specific SDK CORS limitation BEFORE wallet UI",()=>{
 const heading='id="sdk228-heading"';
 assert.equal(html.split(heading).length-1,1);
 assert.ok(html.indexOf(heading)<html.indexOf('id="connect-button"'));
 assert.match(html,/@x402\/fetch 2\.28\.0/);
 assert.match(html,/SDK_VERSION_228_BROWSER_RETRY_CORS_CAUTION/);
 assert.match(html,/Access-Control-Expose-Headers/);
 assert.match(html,/PAYMENT-SIGNATURE/);
 assert.match(html,/Upstream.*fix proposal #3478/);
 assert.match(html,/not a normative demand/);
 assert.match(html,/free browser CORS doctor/);
 assert.match(html,/No real wallet payment/);
 assert.match(html,/Do not sign another payment to retry/);
 assert.match(html,/does not verify real buyer-paid delivery/);
});
test("real original merchant/payee/cost and separate deliberate user actions are unchanged",()=>{
 assert.match(html,/0\.005 Base USDC/);
 assert.match(html,/0\.005 <small>native Circle Base USDC/);
 assert.match(html,/https:\/\/vm5-openapi-x402\.onrender\.com\/v1\/csv-preflight/);
 assert.match(html.toLowerCase(),/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913/);
 assert.match(html.toLowerCase(),/0x6b01efa0705e91a7aca54271510bf9e594717f34/);
 for(const id of ['data-consent','quote-button','pay-consent','pay-button','reset-button'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.equal((html.match(/<script /g)||[]).length,1);
 assert.match(html,/src="\.\.\/assets\/csv-x402-checkout\.bundle\.js"/);
 assert.ok(!html.includes('<iframe'));
 assert.ok(!html.includes('fetch("https://'));
});
test("docs only refer to original client wrapper and blocked production deploy not circumvent",()=>{
 assert.match(readme,/Live VM5 buyer SDK 2\.28\.0 cross-origin retry limitation/);
 assert.match(readme,/PR3478/);
 assert.match(readme,/original OWNED VM3 checkout already has an isolated source-side wrapper/);
 assert.match(readme,/DO NOT.*blocked VM5 Render production deploy/);
 assert.match(readme,/No wallet sign, fee, backend mutation, paid report/);
});
