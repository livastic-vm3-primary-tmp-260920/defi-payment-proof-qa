import test from "node:test";
import assert from "node:assert/strict";
import {
  RESOURCE, NETWORK, PAYTO, ASSET, AMOUNT_ATOMIC,
  parseArgs, validateBuyerRequestURL, validatePaymentRequiredHeader,
  requireExplicitPaymentConfirmation
} from "../quote-guard.mjs";
const quote = () => ({
  x402Version:2, resource:{url:RESOURCE},
  accepts:[{scheme:"exact",network:NETWORK,asset:ASSET,payTo:PAYTO,amount:AMOUNT_ATOMIC}]
});
const header = x => Buffer.from(JSON.stringify(x)).toString("base64url");
test("positive valid exact 0.005 USDC Base x402v2 quote",()=>{
  const p=validatePaymentRequiredHeader(header(quote()));
  assert.equal(p.amountUSDC,"0.005000");
  assert.equal(p.payTo,PAYTO);
});
for(const [description,change] of [
  ["wrong chain", q=>q.accepts[0].network="eip155:1"],
  ["wrong asset", q=>q.accepts[0].asset="0x0000000000000000000000000000000000000000"],
  ["wrong recipient", q=>q.accepts[0].payTo="0x0000000000000000000000000000000000000000"],
  ["amount increase",q=>q.accepts[0].amount="5001"],
  ["wrong scheme",q=>q.accepts[0].scheme="upto"],
  ["new alternative",q=>q.accepts.push({...q.accepts[0]})],
  ["wrong x402 version",q=>q.x402Version=1],
  ["other resource",q=>q.resource.url="https://unknown.example.com/"],
]){
 test("fail closed: "+description,()=>{
  const q=quote();change(q);
  assert.throws(()=>validatePaymentRequiredHeader(header(q)),/BLOCK:/);
 });
}
test("malformed and missing challenge",()=>{
 for(const s of [null,"","!invalid!",header({}),"bad"])
   assert.throws(()=>validatePaymentRequiredHeader(s),/BLOCK:/);
});
test("only exact POST target permitted",()=>{
 assert.equal(validateBuyerRequestURL(RESOURCE,"POST"),true);
 for(const x of [RESOURCE+"?x=1",RESOURCE.replace("https:","http:"),
  RESOURCE.replace("onrender.com","onrender.bad"),RESOURCE+"/"])
   assert.throws(()=>validateBuyerRequestURL(x,"POST"),/BLOCK:/);
 assert.throws(()=>validateBuyerRequestURL(RESOURCE,"GET"),/BLOCK:/);
});
test("default always unpaid, payment needs both hard gates",()=>{
 assert.equal(parseArgs([]).pay,false);
 assert.equal(parseArgs(["--file","data.csv","--expected","email,amount"]).file,"data.csv");
 assert.throws(()=>parseArgs(["--pay","--pay"]),/Duplicate/);
 assert.throws(()=>parseArgs(["--unknown"]),/Unknown/);
 assert.throws(()=>requireExplicitPaymentConfirmation({}),/BLOCK:/);
 assert.throws(()=>requireExplicitPaymentConfirmation({
  BUYER_CONFIRM_005_USDC_BASE_PAYMENT:"YES_TO_ONE_005_USDC_CHARGE"
 }),/BLOCK:/);
});
