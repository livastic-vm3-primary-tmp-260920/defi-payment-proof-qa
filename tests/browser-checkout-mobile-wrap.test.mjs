import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../guides/csv-browser-x402-checkout.html",import.meta.url),"utf8");
test("merchant addresses and long backend URL can wrap inside a narrow CSS grid card",()=>{
 const rule=html.match(/\.card\{[^}]+\}/)?.[0];
 assert.ok(rule);
 assert.match(rule,/min-width:0/);
 assert.match(rule,/overflow-wrap:anywhere/);
 assert.match(html,/@media\(max-width:670px\)/);
 assert.match(html,/\.cols\{grid-template-columns:1fr\}/);
});
test("source checkout remains the same 0.005 Base USDC and signing is deliberate",()=>{
 assert.match(html,/0\.005 Base USDC/);
 assert.match(html,/0x6b01efA0705E91a7aca54271510bf9e594717f34/);
 assert.match(html,/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
 assert.match(html,/id="pay-button" disabled/);
 assert.match(html,/id="data-consent"/);
 assert.match(html,/id="pay-consent"/);
});
