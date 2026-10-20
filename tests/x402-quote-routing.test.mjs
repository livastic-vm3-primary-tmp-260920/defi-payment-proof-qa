import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=(f)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
const h=src("index.html"),llms=src("llms.txt"),site=src("sitemap.xml"),page=src("guides/x402-quote-safety.html");
const path="guides/x402-quote-safety.html";
test("visible home navigation advertises free new x402 review",()=>assert.ok(h.includes(path)));
test("home page keeps paid actual merchant funnel untouched",()=>{
 assert.ok(h.includes("https://vm5-openapi-x402.onrender.com/v1/csv-sample"));
 assert.ok(h.includes("https://vm5-openapi-x402.onrender.com/v1/x402-preflight"));
 assert.ok(h.includes('guides/csv-structural-preflight-005-base-usdc.html'));
});
test("new free buyer app discoverable by search engine and agents",()=>{
 assert.equal((site.match(/\/guides\/x402-quote-safety\.html/g)||[]).length,1);
 assert.ok(llms.includes("https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/"+path));
});
test("new app canonical, source links, no purchase without authorization",()=>{
 assert.match(page,/<link rel="canonical"/);
 assert.match(page,/No account or wallet|No account or wallet/i);
 assert.ok(page.includes("PAYMENT-REQUIRED"));
 assert.ok(page.includes("csv-structural-preflight-005-base-usdc.html"));
});
