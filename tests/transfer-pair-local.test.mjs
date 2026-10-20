import test from "node:test";
import assert from "node:assert/strict";
import {parseCsv,normalizedEvents,reconcilePairs,EXAMPLE_WITHDRAWALS,EXAMPLE_RECEIPTS} from "../transfer-pair-local.mjs";
const w=(rows)=>"timestamp,asset,amount,txhash,fee\n"+rows.join("\n");
const r=(rows)=>"timestamp,asset,amount,txhash\n"+rows.join("\n");
const t="2026-10-12T10:10:00Z",t2="2026-10-12T10:12:00Z", hash="0x"+"1".repeat(64),other="0x"+"2".repeat(64);
test("CSV escaped quote, CRLF and quoted newline are safe",()=>assert.deepEqual(parseCsv('col1,col2\r\n"a, ""quoted""",b\r\n"x\ny",c'),[["col1","col2"],['a, "quoted"',"b"],["x\ny","c"]]));
test("header synonyms and optional hash are supported",()=>{
 const z=normalizedEvents("Time (UTC),Coin,Quantity Transacted\n"+t+",BTC,0.15","receipts");
 assert.equal(z.events.length,1);assert.equal(z.issues.length,0);
});
test("synthetic fee exact amount match stays REVIEW not proven transfer",()=>{
 const a=reconcilePairs(EXAMPLE_WITHDRAWALS,EXAMPLE_RECEIPTS);
 assert.equal(a.counts.candidatePairs,2);
 assert.equal(a.pairs[0].matchKind,"HASH_FEE_ADJUSTED_REVIEW");
 assert.equal(a.pairs[1].matchKind,"TIME_AMOUNT_HEURISTIC");
 assert.equal(a.counts.unmatchedOutgoing,1);
 assert.match(a.reportType,/NOT_TAX_ADVICE/);
});
test("exact hash and amount is only a DATA candidate",()=>{
 const a=reconcilePairs(w([t+",USDC,1,"+hash+",0"]),r([t2+",USDC,1,"+hash]));
 assert.equal(a.pairs[0].matchKind,"HASH_AMOUNT_CANDIDATE");
 assert.match(a.pairs[0].note,/NOT_EVIDENCE/);
});
test("different asset and same amount never match",()=>{
 const z=reconcilePairs(w([t+",BTC,1,,0"]),r([t2+",ETH,1,"]));
 assert.equal(z.counts.candidatePairs,0);
});
test("both different explicit hashes are never paired",()=>{
 const z=reconcilePairs(w([t+",USDC,1,"+hash+",0"]),r([t2+",USDC,1,"+other]));
 assert.equal(z.counts.candidatePairs,0);
});
test("same exact hash different amount is an explicit discrepancy",()=>{
 const z=reconcilePairs(w([t+",USDC,2,"+hash+",0"]),r([t2+",USDC,1,"+hash]));
 assert.equal(z.counts.candidatePairs,0);assert.equal(z.counts.amountDisagreements,1);
});
test("clock window gates missing-hash guesses",()=>{
 const z=reconcilePairs(w([t+",USDC,1,,0"]),r(["2026-10-12T13:10:00Z,USDC,1,"]));
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(reconcilePairs(w([t+",USDC,1,,0"]),r(["2026-10-12T13:10:00Z,USDC,1,"]),{windowMinutes:240}).counts.candidatePairs,1);
});
test("one withdrawal against two identical receipts is ambiguous and not paired",()=>{
 const z=reconcilePairs(w([t+",USDC,1,,0"]),r([t+",USDC,1,",t2+",USDC,1,"]));
 assert.equal(z.counts.candidatePairs,0);assert.equal(z.counts.ambiguousOutgoingRows,1);
});
test("two potential withdrawals against one receipt are both flagged ambiguous",()=>{
 const z=reconcilePairs(w([t+",USDC,1,,0",t2+",USDC,1,,0"]),r([t2+",USDC,1,"]));
 assert.equal(z.counts.candidatePairs,0);assert.equal(z.counts.ambiguousOutgoingRows,2);
});
test("exact duplicate source line is flagged and ignored for pairing",()=>{
 const row=t+",USDC,1,"+hash+",0";const z=reconcilePairs(w([row,row]),r([t2+",USDC,1,"+hash]));
 assert.equal(z.counts.candidatePairs,1);assert.equal(z.counts.invalidOrDuplicateRows,1);
 assert.ok(z.inputIssues.some(x=>x.codes.includes("DUPLICATE_EXACT_ROW")));
});
test("RFC csv invalid shape and oversized source refused",()=>{
 for(const str of ['', 'a,b\n"unclosed,x', 'a,b\n1,2,3','a,b\n'+ 'x'.repeat(131080)+',y']){
  assert.throws(()=>parseCsv(str));
 }
 assert.throws(()=>normalizedEvents('amount\n1','withdrawals'));
 assert.throws(()=>normalizedEvents('timestamp,asset,amount\n'+t+',BTC','withdrawals'));
});
test("invalid floating, negative, scientific, noniso times don't get paired",()=>{
 for(const amt of ["-1","1e2","1.0000000000000000001","$2", "Infinity"]){
  const z=reconcilePairs(w([t+",USDC,"+amt+",,0"]),r([t2+",USDC,1,"]));
  assert.equal(z.counts.candidatePairs,0);
  assert.equal(z.counts.invalidOrDuplicateRows,1);
 }
 const z=reconcilePairs(w(["2026-10-12 10:10:00,USDC,1,,0"]),r([t2+",USDC,1,"]));
 assert.equal(z.counts.candidatePairs,0);
});
test("timezone offsets are supported as exact instants",()=>{
 const z=reconcilePairs(w(["2026-10-12T19:10:00+09:00,USDC,1,,0"]),r([t+",USDC,1,"]));
 assert.equal(z.counts.candidatePairs,1);
});
test("malformed transaction IDs are flagged, not trusted for matches",()=>{
 const z=reconcilePairs(w([t+",USDC,1,invalid-internal-id,0"]),r([t2+",USDC,1,"]));
 assert.equal(z.counts.candidatePairs,0);assert.ok(z.inputIssues[0].codes.includes("HASH_FORMAT_UNSUPPORTED"));
});
test("export report never exposes original crypto row data/hash/memos/addresses",()=>{
 const z=reconcilePairs(w([t+",USDC,0.125,"+hash+",0"]),r([t2+",USDC,0.125,"+hash]));
 assert.equal(JSON.stringify(z).includes(hash),false);
 assert.equal(JSON.stringify(z).includes("0.125"),false);
 assert.ok(JSON.stringify(z).includes("NOT_TAX_ADVICE"));
});
test("invalid matching window fails safe",()=>{
 for(const windowMinutes of [0,1441,2.5,"120",Infinity])assert.throws(()=>reconcilePairs(EXAMPLE_WITHDRAWALS,EXAMPLE_RECEIPTS,{windowMinutes}));
});
test("untrusted no matching CSV rows still yields honest zeros",()=>{
 const z=reconcilePairs(w([t+",USDC,1,,0"]),r([t2+",ETH,2,"]));
 assert.equal(z.counts.candidatePairs,0);
 assert.equal(z.counts.unmatchedOutgoing,1);
 assert.equal(z.counts.unmatchedIncoming,1);
});

test("quote closure rejects stray appended text, preventing mangled exchange exports",()=>{
 for(const input of ['a,b\n"one"junk,two','a,b\none"junk,two','a,b\n"one" "bad",two']){
  assert.throws(()=>parseCsv(input));
 }
 assert.deepEqual(parseCsv('a,b\n"one" ,two'),[['a','b'],['one','two']]);
});
