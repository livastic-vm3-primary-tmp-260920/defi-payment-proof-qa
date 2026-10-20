import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const home=get("index.html"),robots=get("robots.txt"),sitemap=get("sitemap.xml"),llms=get("llms.txt"),page=get("guides/crypto-transfer-csv-pair-auditor.html");
const route="guides/crypto-transfer-csv-pair-auditor.html";
test("genuine free buyer utility is navigable from home and public XML sitemap",()=>{
 assert.ok(home.includes(route));
 assert.equal((sitemap.match(/\/guides\/crypto-transfer-csv-pair-auditor\.html/g)||[]).length,1);
});
test("machine-agent index mentions privacy, manual pilot, and no ownership assertion",()=>{
 assert.ok(llms.includes(route));
 assert.match(llms,/No network, analytics, wallet, transaction-signing, tax computation/);
 assert.match(llms,/15 native Base USDC/);
});
test("user traffic is not implied from homepage and no auto wallet checkout",()=>{
 assert.match(page,/no actual user respondents/i);
 assert.doesNotMatch(page,/(?:window\.)?ethereum|eth_requestAccounts|fetch\s*\(/);
});
test("existing separate genuine paid CSV API remains advertised, not conflated",()=>{
 assert.ok(home.includes('guides/csv-structural-preflight-005-base-usdc.html'));
 assert.ok(page.includes('0.005 USDC API'));
 assert.ok(page.includes('does not perform this matching'));
});
test("no index disallow for new public guide",()=>assert.doesNotMatch(robots,/Disallow: \/guides/));
