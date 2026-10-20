import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=readFileSync(new URL("../src/app.mjs",import.meta.url),"utf8");
test("no automatic wallet account request without dedicated connection click",()=>{
 assert.match(text,/connectBtn\.addEventListener\("click"/);
 assert.match(text,/eth_requestAccounts/);
 assert.match(text,/payBtn\.addEventListener\("click"/);
});
test("no private key or wallet secret handling",()=>{
 assert.doesNotMatch(text,/privateKeyToAccount|eth_sendTransaction|sendTransaction\s*\(|window\.localStorage|sessionStorage|\.innerHTML\s*=|document\.write/);
});
test("no silent automatic payment or retry after failure",()=>{
 assert.match(text,/purchaseAttempted=true/);
 assert.match(text,/if\(networkCount>2\)/);
 assert.match(text,/signer\.getSignCount\(\)!==1/);
 assert.doesNotMatch(text,/setInterval\(|location\.reload\(\)/);
});
test("buyer must approve chain, data and explicit fixed payment",()=>{
 assert.match(text,/eth_chainId/);
 assert.match(text,/0x2105/);
 assert.match(text,/agree\.checked/);
 assert.match(text,/authorize\.checked/);
 assert.match(text,/window\.confirm\(/);
});
test("one exact real merchant endpoint for post only, no credentials",()=>{
 assert.match(text,/wrapFetchWithPayment/);
 assert.match(text,/registerExactEvmScheme/);
 assert.match(text,/strictlyAllowlistedFetch/);
 assert.match(text,/credentials:"omit",redirect:"error"/);
});
test("unsafe nonfinal payment is explicitly treated as unknown not final",()=>{
 assert.match(text,/not an independently finalized blockchain receipt/);
 assert.match(text,/payment may have settled/);
});
