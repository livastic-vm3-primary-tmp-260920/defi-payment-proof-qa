import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CHAIN,BASE_CIRCLE_USDC,REQUIRED_COLUMNS,SYNTHETIC_WALLET,SYNTHETIC_INPUT,
  analyzeUsdcLedger,exportUsdcReviewCsv,formatMicro,MAX_BYTES,MAX_DATA_ROWS,
} from "../usdc-ledger-local.mjs";

const wallet=SYNTHETIC_WALLET;
const addr=n=>"0x"+String(n).repeat(40);
const hash=n=>"0x"+String(n).repeat(64);
const header=REQUIRED_COLUMNS.join(",");
const row=(overrides={})=>({
  chain_id:"8453",token_address:BASE_CIRCLE_USDC,tx_hash:hash("a"),
  log_index:"3",from:addr("2"),to:wallet,amount_usdc:"0.005",
  delivery_status:"delivered",...overrides,
});
const input=(...rows)=>header+"\n"+rows.map(r=>REQUIRED_COLUMNS.map(k=>r[k]).join(",")).join("\n")+"\n";
const scan=(...rows)=>analyzeUsdcLedger(input(...rows),wallet);
const codes=r=>r.records.flatMap(x=>x.flags);

test("public synthetic fixture never gets counted as actual settlement",()=>{
  const r=analyzeUsdcLedger(SYNTHETIC_INPUT,SYNTHETIC_WALLET);
  assert.equal(r.rowsRead,7);
  assert.equal(r.duplicateRecords,1);
  assert.equal(r.conflictingEvents,1);
  assert.equal(r.candidateRecords,1);
  assert.equal(r.claimedCandidateUsdc,"0.005000");
  assert.equal(r.settledRevenueUsdc,null);
  assert.equal(r.verifiedOnchainUsdc,null);
  assert.equal(r.networkRequests,0);
  assert.equal(r.paymentAuthorized,false);
});
test("a single exact Base USDC receiving event remains only a claim candidate",()=>{
  const r=scan(row());
  assert.equal(r.candidateRecords,1);
  assert.equal(r.claimedCandidateUsdc,"0.005000");
  assert.match(r.limitations,/Not an on-chain verification/);
});
test("same hash, different event log index are separate events",()=>{
  const r=scan(row(),row({log_index:"4",amount_usdc:"0.025"}));
  assert.equal(r.uniqueEventKeys,2);
  assert.equal(r.claimedCandidateUsdc,"0.030000");
});
test("identical repeats cannot inflate the claimed candidate subtotal",()=>{
  const r=scan(row(),row(),row());
  assert.equal(r.claimedCandidateUsdc,"0.005000");
  assert.equal(r.duplicateRecords,2);
  assert.equal(r.candidateRecords,1);
  assert.equal(r.reviewRecords,2);
});
test("same event but differing amounts flags conflict and excludes both",()=>{
  const r=scan(row(),row({amount_usdc:"0.090"}));
  assert.equal(r.conflictingEvents,1);
  assert.equal(r.candidateRecords,0);
  assert.equal(r.claimedCandidateUsdc,"0.000000");
  assert.equal(r.records[0].state,"conflict");
  assert.equal(r.records[1].state,"conflict");
});
test("same event with differing delivery claims flags conflict, not first-wins",()=>{
  const r=scan(row(),row({delivery_status:"pending"}));
  assert.equal(r.conflictingEvents,1);
  assert.equal(r.candidateRecords,0);
});
test("wrong chain is excluded even with correct token, to and log",()=>{
  const r=scan(row({chain_id:"1"}));
  assert.ok(codes(r).includes("WRONG_CHAIN"));
  assert.equal(r.claimedCandidateUsdc,"0.000000");
});
test("token symbol, a fake USDC and zero address do not pass contract binding",()=>{
  for(const token of ["USDC",addr("9"),addr("0")]){
    const r=scan(row({token_address:token}));
    assert.ok(codes(r).includes("WRONG_ASSET"));
    assert.equal(r.claimedCandidateUsdc,"0.000000");
  }
});
test("incorrect recipient cannot count as our incoming claim",()=>{
  const r=scan(row({to:addr("9")}));
  assert.ok(codes(r).includes("WRONG_RECIPIENT"));
  assert.equal(r.candidateRecords,0);
});
test("payer equals payee is excluded as self-transfer",()=>{
  const r=scan(row({from:wallet,to:wallet}));
  assert.ok(codes(r).includes("SELF_TRANSFER"));
  assert.equal(r.claimedCandidateUsdc,"0.000000");
});
test("invalid receiver input fails closed instead of inspecting nonsense",()=>{
  for(const v of ["",wallet.slice(0,-2),"0x555",wallet+",attacker", "=SUM(1,1)"]){
    assert.throws(()=>analyzeUsdcLedger(input(row()),v),/wallet/);
  }
});
test("unrecognized or missing transaction hash fails ledger identity validation",()=>{
  for(const tx of ["0x"+"1".repeat(63),"not-really-a-tx",""]) {
    const r=scan(row({tx_hash:tx}));
    assert.ok(codes(r).includes("BAD_EVENT_ID"));
  }
});
test("logIndex is required, decimal nonnegative and canonical",()=>{
  for(const x of ["","-1","1.1","nan","01","9999999999"]) {
    const r=scan(row({log_index:x}));
    assert.ok(codes(r).includes("BAD_EVENT_ID"),"bad index "+x);
    assert.equal(r.candidateRecords,0);
  }
});
test("case-insensitive EVM hex is normalized and 00 is invalid log index",()=>{
  const r=scan(row({tx_hash:hash("A"),token_address:BASE_CIRCLE_USDC.toUpperCase().replace("0X","0x"),to:wallet.toUpperCase().replace("0X","0x")}));
  assert.equal(r.candidateRecords,1);
  assert.equal(r.records[0].eventKey, "8453:"+hash("a")+":3");
});
test("integer micro-USDC math is exact and never uses floating-point money",()=>{
  const r=scan(row({amount_usdc:"0.000001"}),row({tx_hash:hash("b"),amount_usdc:"0.000002"}));
  assert.equal(r.claimedCandidateUsdc,"0.000003");
  assert.equal(formatMicro(1000000000000000000n),"1000000000000.000000");
});
test("rejects zero, negative, scientific notation, and more than 6 decimals",()=>{
  for(const amt of ["0","0.000000","-1","1e4","1.0000001","NaN","  "]) {
    const r=scan(row({amount_usdc:amt}));
    assert.ok(codes(r).includes("BAD_AMOUNT"), "invalid amount "+amt);
    assert.equal(r.candidateRecords,0);
  }
});
test("quoted comma inside an amount fails strict decimal parse, not column splitting",()=>{
  const csv=input(row()).replace("0.005",'"1,0"');
  const r=analyzeUsdcLedger(csv,wallet);
  assert.ok(codes(r).includes("BAD_AMOUNT"));
  assert.equal(r.claimedCandidateUsdc,"0.000000");
});
test("unquoted comma amount breaks row width and never earns candidate status",()=>{
  const r=scan(row({amount_usdc:"1,0"}));
  assert.ok(codes(r).includes("COLUMN_COUNT_MISMATCH"));
  assert.equal(r.candidateRecords,0);
});
test("pending, failed, partial delivery never counts as delivered",()=>{
  for(const status of ["pending","failed","partial"]) {
    const r=scan(row({delivery_status:status}));
    assert.ok(codes(r).includes("NOT_DELIVERED"));
    assert.equal(r.candidateRecords,0);
  }
});
test("blank and unknown delivery fail closed instead of claiming success",()=>{
  for(const status of ["", "confirmed", "verified", "yes"]){
    assert.ok(codes(scan(row({delivery_status:status}))).includes("UNKNOWN_DELIVERY"));
  }
});
test("CSV parse errors and missing headers are explicit errors, not empty income reports",()=>{
  assert.throws(()=>analyzeUsdcLedger("from,to\n"+addr("2")+","+wallet,wallet),/Missing required/);
  assert.throws(()=>analyzeUsdcLedger('x,x\n"oops","bad"',wallet),/Duplicate/);
  assert.throws(()=>analyzeUsdcLedger('x,y\n"a,b',wallet),SyntaxError);
});
test("case-insensitive unique headers accepted without alias guessing",()=>{
  const r=analyzeUsdcLedger(input(row()).replace(/^chain_id/,"CHAIN_ID"),wallet);
  assert.equal(r.candidateRecords,1);
});
test("optional order_id conflicting on same event excludes entire event",()=>{
  const columns=header+",order_id";
  const asRow=(val,order)=>REQUIRED_COLUMNS.map(k=>val[k]).join(",")+","+order;
  const s=columns+"\n"+asRow(row(),"invoice-A")+"\n"+asRow(row(),"invoice-B");
  const r=analyzeUsdcLedger(s,wallet);
  assert.equal(r.conflictingEvents,1);
  assert.equal(r.candidateRecords,0);
});
test("broken row width is not silently accepted as a valid payment",()=>{
  const r=analyzeUsdcLedger(input(row()).trimEnd()+",extra\n",wallet);
  assert.ok(codes(r).includes("COLUMN_COUNT_MISMATCH"));
  assert.equal(r.candidateRecords,0);
});
test("the limited preview does not echo payer addresses or user text",()=>{
  const r=scan(row({to:addr("9")}));
  const preview=JSON.stringify(r.issuesPreview);
  assert.ok(!preview.includes(addr("9")));
  assert.ok(!preview.includes(wallet));
  assert.ok(preview.includes("WRONG_RECIPIENT"));
});
test("CSV review export holds safe fixed fields, with no revenue/settlement assertion",()=>{
  const r=scan(row(),row());
  const exported=exportUsdcReviewCsv(r);
  assert.match(exported,/csv_record,event_key,claim_usdc,review_state,issues/);
  assert.match(exported,/DUPLICATE_EVENT/);
  assert.doesNotMatch(exported,/settled|profit|received/);
  assert.equal(exported.match(/0\.005000/g)?.length,2);
  assert.throws(()=>exportUsdcReviewCsv(null),TypeError);
});
test("existing strict CSV upper bounds apply; no unlimited private data upload",()=>{
  assert.equal(MAX_BYTES,32768);
  assert.equal(MAX_DATA_ROWS,500);
  assert.throws(()=>analyzeUsdcLedger(header+"\n"+Array(501).fill(REQUIRED_COLUMNS.map(k=>row()[k]).join(",")).join("\n"),wallet),RangeError);
});
test("preview is bounded when 100 records are flagged",()=>{
  const bad=Array.from({length:100},(_,i)=>row({tx_hash:hash("a"),log_index:String(i),delivery_status:"pending"}));
  const r=scan(...bad);
  assert.equal(r.issuesPreview.length,80);
  assert.equal(r.issuesTruncated,true);
  assert.equal(r.reviewRecords,100);
});
