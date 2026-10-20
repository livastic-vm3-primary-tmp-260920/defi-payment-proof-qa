import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CIRCLE_USDC, SYNTHETIC_WALLET, analyzeUsdcLedger, formatMicro,
} from "../usdc-ledger-local.mjs";
import { parseBaseUsdcReceiptToCsv, ERC20_TRANSFER_TOPIC } from "../usdc-receipt-json-local.mjs";
const HASH="0x"+"a".repeat(64);
const BLOCKHASH="0x"+"b".repeat(64);
const FROM="0x"+"2".repeat(40);
const TO=SYNTHETIC_WALLET;
const topAddr=addr=>"0x"+"0".repeat(24)+addr.slice(2).toLowerCase();
const hex256=n=>"0x"+n.toString(16).padStart(64,"0");
const event=(overrides={})=>({
 address:BASE_CIRCLE_USDC,
 topics:[ERC20_TRANSFER_TOPIC,topAddr(FROM),topAddr(TO)],
 data:hex256(5000n),logIndex:"0xc",transactionHash:HASH,removed:false,
 ...overrides
});
const receipt=(logs=[event()],overrides={})=>({
 transactionHash:HASH,status:"0x1",blockNumber:"0x98",blockHash:BLOCKHASH,
 logs,...overrides
});
const decode=obj=>parseBaseUsdcReceiptToCsv(JSON.stringify(obj));
const analyze=obj=>analyzeUsdcLedger(decode(obj).csv,TO);
test("import one event with exact 6-decimal native USDC and no delivery assertion",()=>{
 const result=decode({jsonrpc:"2.0",id:1,result:receipt()});
 assert.equal(result.rowsImported,1);
 assert.equal(result.chainVerified,false);
 assert.equal(result.settlementVerified,false);
 assert.equal(result.deliveryState,"unknown");
 assert.match(result.csv,/8453,0x833589fcd6edb6e08f4c7c32d4f71b54bda02913/);
 assert.match(result.csv,/,0\.005000,unknown/);
 const review=analyze({result:receipt()});
 assert.equal(review.claimedCandidateUsdc,"0.000000");
 assert.equal(review.candidateRecords,0);
 assert.ok(review.records[0].flags.includes("UNKNOWN_DELIVERY"));
});
test("all event identifiers are receipt-derived decimal log indices",()=>{
 const result=decode(receipt([event({logIndex:"0x0"}),event({logIndex:"0x12",data:hex256(1234567n)})]));
 assert.equal(result.rowsImported,2);
 assert.ok(result.csv.includes(","+HASH+",0,"));
 assert.ok(result.csv.includes(","+HASH+",18,"));
 assert.match(result.csv,/1\.234567,unknown/);
});
test("non-USDC logs and non-Transfer topics are excluded without pretending they were paid",()=>{
 const logs=[
   event({address:"0x"+"9".repeat(40)}),
   event({topics:["0x"+"f".repeat(64),topAddr(FROM),topAddr(TO)]}),
   event({logIndex:"0x3"}),
 ];
 const r=decode(receipt(logs));
 assert.equal(r.rowsImported,1);
 assert.equal(r.nonUsdcOrNonTransferLogsSkipped,2);
});
test("removed chain reorganization logs never get into the review input",()=>{
 const r=decode(receipt([event({removed:true}),event({logIndex:"0x9"})]));
 assert.equal(r.removedLogsSkipped,1);
 assert.equal(r.rowsImported,1);
});
test("reverted receipt is rejected even if supplied with forged-looking Transfer logs",()=>{
 for(const v of ["0x0","0","failed",null]){
  assert.throws(()=>decode(receipt(undefined,{status:v})),/status|success/i);
 }
});
test("pending receipt with no block is rejected, but not claimed finalized for accepted ones",()=>{
 for(const v of [null,"",undefined]){
  assert.throws(()=>decode(receipt(undefined,{blockHash:v})),/blockHash|block/i);
 }
 const good=decode(receipt());
 assert.equal(good.chainVerified,false);
 assert.equal(good.settlementVerified,false);
});
test("receipt with nonmatching nested log txHash is rejected to avoid wrong event attribution",()=>{
 assert.throws(()=>decode(receipt([event({transactionHash:"0x"+"b".repeat(64)})])),/hash mismatch/i);
});
test("nonhex or non-32-byte transactionHash and blockHash are rejected",()=>{
 for(const invalid of ["missing","0x"+"a".repeat(63),"0x123",null]){
   assert.throws(()=>decode(receipt(undefined,{transactionHash:invalid})),/transactionHash/i);
   assert.throws(()=>decode(receipt(undefined,{blockHash:invalid})),/blockHash/i);
 }
});
test("untrusted receipt without valid indexed Transfer address topics is rejected",()=>{
 const bad=[
  ["0x"+"a".repeat(64),topAddr(FROM),"0x"+"f".repeat(60)],
  [ERC20_TRANSFER_TOPIC,"0x"+"f".repeat(64),topAddr(TO)],
  [ERC20_TRANSFER_TOPIC,topAddr(FROM)],
 ];
 for(const topics of bad){
   assert.throws(()=>decode(receipt([event({topics})])),/Transfer|topic|address/i);
 }
});
test("malformed USDC Transfer data and overly large log indices are rejected",()=>{
 for(const v of ["0x"+"f".repeat(63),"0x","0xzz",null]){
   assert.throws(()=>decode(receipt([event({data:v})])),/data|uint256/i);
 }
 assert.throws(()=>decode(receipt([event({logIndex:"0x40000000"})])),/index|limit/i);
});
test("duplicate receipt log records are handed to existing idempotent CSV dedup",()=>{
 const r=decode(receipt([event(),event()]));
 const report=analyzeUsdcLedger(r.csv,TO);
 assert.equal(report.uniqueEventKeys,1);
 assert.equal(report.duplicateRecords,1);
 assert.equal(report.claimedCandidateUsdc,"0.000000");
});
test("receipt can be provided as direct JSON, rpc envelope, or raw JSON string",()=>{
 const r=receipt();
 for(const doc of [r,{result:r},{jsonrpc:"2.0",id:2,result:r}]){
  assert.equal(decode(doc).rowsImported,1);
 }
});
test("chain hints claiming non-Base are explicitly rejected, without querying any RPC",()=>{
 for(const network of ["1","0x1","eip155:1",1]){
  assert.throws(()=>decode(receipt(undefined,{chainId:network})),/Base|chain/i);
 }
});
test("valid optional hexadecimal Base chainId is only an unverified input hint",()=>{
 const r=decode(receipt(undefined,{chainId:"0x2105"}));
 assert.equal(r.rowsImported,1);
 assert.equal(r.chainVerified,false);
});
test("missing and too many logs cannot be imported",()=>{
 assert.throws(()=>decode(receipt([])),/USDC|Transfer|no/i);
 assert.throws(()=>decode(receipt(null)),/logs/i);
 assert.throws(()=>decode(receipt(Array.from({length:501},(_,i)=>event({logIndex:"0x"+i.toString(16)})))),/limit|500/i);
});
test("oversized and invalid JSON do not leak data or silently become zero receipts",()=>{
 assert.throws(()=>parseBaseUsdcReceiptToCsv("not json"),/JSON/i);
 assert.throws(()=>parseBaseUsdcReceiptToCsv(" ".repeat(130000)),/large|size|limit/i);
 assert.throws(()=>parseBaseUsdcReceiptToCsv(JSON.stringify({error:"RPC 404"})),/receipt|result|logs/i);
});
test("current USDC output CSV limit is enforced even if JSON passed size gate",()=>{
 const xs=Array.from({length:200},(_,i)=>event({logIndex:"0x"+i.toString(16)}));
 assert.throws(()=>decode(receipt(xs)),/32 KiB|limit|too large/i);
});
test("pasted JSON cannot cause HTTP, wallet signature, sensitive data egress or storage writes",()=>{
 const raw=JSON.stringify(receipt());
 const before=globalThis.fetch;
 const result=parseBaseUsdcReceiptToCsv(raw);
 assert.equal(result.networkRequests,0);
 assert.equal(result.paymentAuthorized,false);
 assert.equal(globalThis.fetch,before);
 assert.ok(!result.csv.includes("my-secret"));
});
test("valid atomic values are formatted exactly in USDC micro units",()=>{
 const r=decode(receipt([event({data:hex256(1n),logIndex:"0xa"}),event({data:hex256(1000001n),logIndex:"0xb"})]));
 assert.match(r.csv,/0\.000001,unknown/);
 assert.match(r.csv,/1\.000001,unknown/);
 assert.equal(formatMicro(1n),"0.000001");
});
