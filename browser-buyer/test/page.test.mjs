import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../../guides/csv-browser-x402-checkout.html",import.meta.url),"utf8");
test("buyer web checkout offers explicit price, expected full payee, exact merchant",()=>{
 for(const needle of ["0.005 Base USDC","0x6b01efA0705E91a7aca54271510bf9e594717f34","0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","/v1/csv-preflight"]){
  assert.ok(page.includes(needle),needle);
 }
});
test("the free 402 and paid routes are two visibly distinct buttons",()=>{
 for(const id of ['id="quote-button"','id="connect-button"','id="pay-button"','id="pay-consent"','id="data-consent"']){
  assert.ok(page.includes(id));
 }
});
test("user data upload is disclosed before any quote, no secret collection",()=>{
 assert.match(page,/before payment/);
 assert.match(page,/leaves this browser/);
 assert.doesNotMatch(page,/password\s*type=|type="password"|type="file"/i);
});
test("static code has no inline payment signing, tracking or third-party wallet script",()=>{
 assert.match(page,/src="\.\.\/assets\/csv-x402-checkout\.bundle\.js"/);
 assert.doesNotMatch(page,/google-analytics|gtag\(|innerHTML\s*=|document\.write\(/);
});
test("caveats no proven paid checkout and wallet owns decision",()=>{
 assert.match(page,/no independent buyer-funded production checkout/i);
 assert.match(page,/do not repeat blindly/i);
 assert.match(page,/do not hold buyer recovery keys/i);
});
