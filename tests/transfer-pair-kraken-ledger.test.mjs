import test from "node:test";
import assert from "node:assert/strict";
import {normalizedEvents,reconcilePairs} from "../transfer-pair-local.mjs";
const columns="txid,refid,time,type,subtype,aclass,asset,amount,fee,balance";
const at="2026-10-12 10:10:00";
const receive="timestamp,asset,amount,txhash";
const ledger=rows=>columns+"\n"+rows.join("\n");
const withdrawal=id=>[id,"ref-a",at,"withdrawal","","currency","USDC","-10.005","0.005","190.000"].join(",");
const deposit=id=>[id,"ref-b","2026-10-12 10:11:30","deposit","","currency","USDC","10","0","200.000"].join(",");
test("official Kraken ledger strict schema is explicitly detected",()=>{
 const w=normalizedEvents(ledger([withdrawal("KRKN-INTERNAL-ID-1")]),"withdrawals");
 assert.equal(w.sourceFormat,"KRAKEN_OFFICIAL_LEDGER_INTERNAL_IDS_UTC_ASSUMED");
 assert.equal(w.events.length,1);
 assert.equal(w.issues.length,0);
 assert.equal(w.events[0].hash,"","Kraken ledger IDs MUST NOT be treated as chain tx hashes");
 assert.equal(w.events[0].ms,Date.parse("2026-10-12T10:10:00Z"),"Kraken official ledger timestamp is UTC only for this exact source schema");
});
test("negative Kraken withdrawals fee-adjusted to independently formatted positive generic deposits but only heuristic",()=>{
 const z=reconcilePairs(ledger([withdrawal("Kraken-ledger-a")]),receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.equal(z.counts.candidatePairs,1);
 assert.equal(z.pairs[0].matchKind,"TIME_FEE_HEURISTIC_REVIEW");
 assert.equal(z.counts.invalidOrDuplicateRows,0);
 assert.equal(z.input.withdrawalSourceFormat,"KRAKEN_OFFICIAL_LEDGER_INTERNAL_IDS_UTC_ASSUMED");
});
test("Kraken deposit positive amount pairs with generic authorized withdrawal",()=>{
 const generic="timestamp,asset,amount,fee\n2026-10-12T10:09:00Z,USDC,10,0";
 const z=reconcilePairs(generic,ledger([deposit("ID-INTERNAL-2")]));
 assert.equal(z.counts.candidatePairs,1);
 assert.equal(z.pairs[0].matchKind,"TIME_AMOUNT_HEURISTIC");
 assert.equal(z.input.receiptSourceFormat,"KRAKEN_OFFICIAL_LEDGER_INTERNAL_IDS_UTC_ASSUMED");
});
test("Kraken trades and staking excluded, not fabricated withdrawals",()=>{
 const t=["K-trade1","K-ref1",at,"trade","","currency","USDC","-1","0.01","188"].join(",");
 const k=["K-stake1","K-ref2",at,"spottostaking","","currency","USDC","-5","0","183"].join(",");
 const z=reconcilePairs(ledger([t,k,withdrawal("K-out")]),receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.equal(z.counts.candidatePairs,1);
 assert.equal(z.counts.excludedNonTransferRows,2);
 assert.equal(z.counts.invalidOrDuplicateRows,0);
});
test("Kraken direction signs enforced even when labels say withdrawal/deposit",()=>{
 const w=withdrawal("Kraken-ledger-a").replace(",-10.005,",",10.005,");
 const r=deposit("K-3").replace(",10,0,",",-10,0,");
 const z=reconcilePairs(ledger([w]),ledger([r]));
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(z.counts.invalidOrDuplicateRows,2);
 assert.ok(z.inputIssues.every(x=>x.codes.includes("KRAKEN_AMOUNT_DIRECTION_MISMATCH")));
});
test("identical Kraken lines deduplicated, original row numbers preserved",()=>{
 const row=withdrawal("realistic-kraken-ledger-ref-A");
 const z=reconcilePairs(ledger([row,row]),receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.equal(z.counts.invalidOrDuplicateRows,1);
 assert.equal(z.counts.candidatePairs,1);
 assert.equal(z.inputIssues[0].row,3);
 assert.equal(z.pairs[0].fromRow,2);
});
test("distinct internal ledger IDs on same amount/time are retained and flagged ambiguous rather than dropped",()=>{
 const z=reconcilePairs(ledger([withdrawal("ID-A"),withdrawal("ID-B")]),receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(z.counts.ambiguousOutgoingRows,2);
 assert.equal(z.counts.invalidOrDuplicateRows,0);
});
test("UTC interpretation never leaks into generic timestamp-less CSV",()=>{
 const generic="timestamp,asset,amount\n2026-10-12 10:10:00,USDC,1";
 const z=reconcilePairs(generic,receive+"\n2026-10-12T10:11:00Z,USDC,1,");
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(z.counts.invalidOrDuplicateRows,1);
 assert.equal(z.input.withdrawalSourceFormat,"GENERIC_EXPLICIT_TIMEZONE");
 assert.ok(z.inputIssues[0].codes.includes("TIME_NEEDS_ISO_OFFSET"));
});
test("Kraken ledger internal ID cannot be linked as cryptographic txHash proof",()=>{
 const id="0x"+"1".repeat(64);
 const z=reconcilePairs(ledger([withdrawal(id)]),receive+"\n2026-10-12T10:11:00Z,USDC,10,"+id);
 assert.equal(z.counts.candidatePairs,1);
 assert.equal(z.pairs[0].matchKind,"TIME_FEE_HEURISTIC_REVIEW");
 assert.equal(JSON.stringify(z).includes(id),false);
});
test("different assets XBT and BTC are NOT silently treated as same coin",()=>{
 const z=reconcilePairs(ledger([withdrawal("ID-xbt").replace(",USDC,",",XBT,")]),
  receive+"\n2026-10-12T10:11:00Z,BTC,10,");
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(z.counts.unmatchedOutgoing,1);
});
test("Kraken fee > amount not silently normalized",()=>{
 const z=reconcilePairs(ledger([withdrawal("ID-x").replace(",0.005,",",15,")]),
  receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.equal(z.counts.candidatePairs,0);
 assert.ok(z.inputIssues.some(x=>x.codes.includes("FEE_INVALID")));
});
test("partially similar CSV cannot spoof Kraken interpretation",()=>{
 const bad="txid,refid,time,type,asset,amount,fee\nID,REF,2026-10-12 10:10:00,withdrawal,USDC,-10.005,0.005";
 assert.equal(normalizedEvents(bad,"withdrawals").sourceFormat,"GENERIC_EXPLICIT_TIMEZONE");
 assert.equal(normalizedEvents(bad,"withdrawals").acceptedRows,0);
});
test("the source's Kraken-specific warning is explicit in the public JSON report",()=>{
 const z=reconcilePairs(ledger([withdrawal("KID")]),receive+"\n2026-10-12T10:11:00Z,USDC,10,");
 assert.ok(z.limitations.some(x=>x.includes("txid is INTERNAL")));
 assert.ok(z.limitations.some(x=>x.includes("not taxable")||x.includes("non-taxable")));
 assert.equal(z.reportType.includes("NOT_TAX_ADVICE"),true);
});

test("official-style Kraken fractional UTC seconds up to six digits normalize only for matching",()=>{
 for(const fractional of [".1",".1234",".123456"]){
  const row=withdrawal("L-KRAKEN-"+fractional).replace("2026-10-12 10:10:00","2026-10-12 10:10:00"+fractional);
  const events=normalizedEvents(ledger([row]),"withdrawals");
  assert.equal(events.events.length,1);
  assert.equal(events.events[0].ms,Date.parse("2026-10-12T10:10:00"+(fractional.length>4?fractional.slice(0,4):fractional)+"Z"));
 }
});
