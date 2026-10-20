import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const h=read("index.html"),s=read("sitemap.xml"),a=read("llms.txt"),guide=read("guides/csv-structural-preflight-005-base-usdc.html"),page=read("guides/csv-browser-x402-checkout.html"),bundle=read("assets/csv-x402-checkout.bundle.js");
const route="guides/csv-browser-x402-checkout.html";
test("browser wallet beta is discoverable from owner site, paid guide, sitemap and AI index",()=>{
 for(const f of [h,s,a])assert.ok(f.includes(route));
 assert.ok(guide.includes('href="csv-browser-x402-checkout.html"'));
});
test("one canonical sitemap listing for checkout",()=>{
 assert.equal((s.match(/\/guides\/csv-browser-x402-checkout\.html/g)||[]).length,1);
});
test("no buyer is charged by loading landing page",()=>{
 assert.match(page,/id="pay-button" disabled/);
 assert.match(page,/id="connect-button" disabled/);
 assert.doesNotMatch(page,/<script\s+src="https?:\/\//);
});
test("the source actually includes pinned original x402 SDK code and wallet guards",()=>{
 assert.ok(bundle.length>250000);
 assert.ok(page.includes('src="../assets/csv-x402-checkout.bundle.js"'));
 assert.ok(page.includes("No independent buyer-funded production checkout")||page.includes("no independent buyer-funded production checkout"));
});
test("same-owner original CSV API remains unchanged",()=>{
 assert.match(guide,/POST \/v1\/csv-preflight/);
 assert.ok(h.includes('guides/csv-structural-preflight-005-base-usdc.html'));
});
