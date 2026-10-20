import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const h=readFileSync(new URL("../guides/crypto-transfer-csv-pair-auditor.html",import.meta.url),"utf8");
test("two different CSV source inputs have named explicit directions",()=>{
 for(const needle of ['id="out"','id="inc"','id="run"','id="sample"','id="clear"','id="download"'])assert.ok(h.includes(needle),needle);
});
test("local client tool never fetches, connects wallet, uploads or renders source HTML",()=>{
 assert.doesNotMatch(h,/(?:\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|innerHTML\s*=|localStorage|sessionStorage|window\.ethereum|signTypedData\()/);
 assert.match(h,/li\.textContent=text/);
});
test("privacy and no-tax-claims are explicit",()=>{
 assert.match(h,/No blockchain RPC or cost-basis records/);
 assert.match(h,/does NOT establish your wallet ownership/);
 assert.match(h,/no payment or feedback is required/i);
});
test("source is original and links to reproducible tests",()=>{
 assert.match(h,/import \{reconcilePairs,EXAMPLE_WITHDRAWALS,EXAMPLE_RECEIPTS,EXAMPLE_KRAKEN_WITHDRAWALS,EXAMPLE_KRAKEN_RECEIPTS\} from "\.\.\/transfer-pair-local\.mjs"/);
 assert.ok(h.includes("tests/transfer-pair-local.test.mjs"));
});
test("email research asks for no identifying information and accepts $0 demand",()=>{
 assert.ok(h.includes("mailto:onecursor1@gmail.com"));
 assert.ok(h.includes("will not pay")||h.includes("$0"));
 assert.ok(h.includes("may disclose your sender email address"));
});
test("separate $15 manual memo is not falsely marketed as the $0.005 hosted API",()=>{
 assert.ok(h.includes("15 native Base USDC"));
 assert.ok(h.includes("does not perform this matching"));
 assert.ok(h.includes("0.005 USDC API"));
});
test("fully responsive with accessible status and disabled result until evaluated",()=>{
 assert.match(h,/@media\(max-width:720px\)/);
 assert.match(h,/id="summary" role="status" aria-live="polite"/);
 assert.match(h,/id="download" class="alt" type="button" disabled/);
});
test("canonical route available to independent visitors",()=>{
 assert.ok(h.includes('rel="canonical"'));
 assert.ok(h.includes("guides/crypto-transfer-csv-pair-auditor.html"));
});

test("Kraken preview has an explicit invented sample and warns ledger IDs are not chain hashes",()=>{
 assert.match(h,/id="kraken"/);
 assert.match(h,/Kraken ledger <code>txid<\/code> is an <em>internal record ID/);
 assert.match(h,/Kraken's official ledger field reference/);
 assert.match(h,/excluded non-transfer ledger rows/);
});

test("one genuine existing public feedback issue crosslink does not invent new respondents",()=>{
 assert.match(h,/github\.com\/livastic-vm3-primary-tmp-260920\/defi-payment-proof-qa\/issues\/1/);
 assert.match(h,/all comments are public/);
 assert.match(h,/No actual user respondents/);
});
