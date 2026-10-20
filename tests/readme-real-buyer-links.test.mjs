import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const readme=readFileSync(new URL("../README.md",import.meta.url),"utf8");

test("GitHub reader gets first-screen free-first value and exactly two owned 49-USDC markets",()=>{
 const needle="## Free-first buyer help";
 assert.ok(readme.indexOf(needle)>100&&readme.indexOf(needle)<500);
 const links=[
   "https://livastic-vm3-primary-tmp-260920.github.io/crypto-csv-rescue/",
   "https://livastic-vm3-primary-tmp-260920.github.io/usdc-receipt-reconciliation/",
   "https://livastic-vm1-primary.github.io/paperpilot-tools/usdc-invoice-reconcile.html",
 ];
 for(const link of links){
   assert.equal(readme.split(link).length-1,1,"one original explicit link: "+link);
 }
 assert.match(readme,/free checks before buying anything/i);
 assert.match(readme,/50 redacted authorized transaction rows TOTAL/);
 assert.match(readme,/50-invoice\/50-reported-transfer/);
 assert.match(readme,/eight-case fictional/);
 assert.match(readme,/49 USDC.*UNVALIDATED hypotheses/i);
});
test("One-owner buyer route never conflates a public sample, refund or wallet with settled money",()=>{
 assert.match(readme,/ONE issue cluster/);
 assert.match(readme,/no tax filing or account login/);
 assert.match(readme,/never independently prove chain finality/);
 assert.match(readme,/One actual human owner/i);
 assert.match(readme,/VM5's exclusive, deduplicated buyer conversations/);
 assert.match(readme,/https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSe_N8anCGUDmWdNZLnGwFRfhYaaCsB18BKdYd_VsFZp1xWm3g\/viewform/);
 assert.match(readme,/onecursor1@gmail\.com/);
 assert.match(readme,/No independent customer purchase has yet been verified/);
 for(const forbidden of ["MY_WALLET_PRIVATE_KEY","seed phrase:","signed PAYMENT-SIGNATURE:","paid clients: 20","$49 earned"])assert.ok(!readme.includes(forbidden));
});
