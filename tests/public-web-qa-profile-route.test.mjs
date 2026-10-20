import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../services/public-web-qa-19-usdc.html",import.meta.url),"utf8");
const seller="https://opentask.ai/profiles/cmvckd5ok00cx08jyc1yh8bvz";
test("owned service directs buyers to the existing original OpenTask identity",()=>{
  assert.equal(page.split(seller).length-1,1);
  assert.match(page,/See the existing OpenTask seller profile/);
});
test("clearly distinguishes public seller identity from a paid marketplace listing",()=>{
  assert.match(page,/not an instant checkout or an already-published QA service listing/);
  assert.match(page,/Buyer approval, payment terms and verified authorization/);
});
test("existing scope, price and low-friction inquiry remain available",()=>{
  assert.match(page,/>19 <small>Circle Base USDC/);
  assert.match(page,/mailto:onecursor1@gmail.com\?/);
  assert.match(page,/up to five authorized public pages/i);
  assert.match(page,/Request the paid scope by email/);
});
test("link cannot itself sign, collect money, or claim sales",()=>{
  assert.doesNotMatch(page,/window\.ethereum|privateKey|sendTransaction|<script|autopay|walletconnect/i);
  assert.match(page,/no wallet signature or buyer deposit is required just to ask/i);
  assert.match(page,/No paid buyer engagement is claimed/i);
});
