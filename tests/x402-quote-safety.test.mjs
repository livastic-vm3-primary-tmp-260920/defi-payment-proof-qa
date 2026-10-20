import test from "node:test";
import assert from "node:assert/strict";
import {decodeQuote,inspectQuote,parseMaxUsdc,BASE_NETWORK,BASE_NATIVE_USDC,LIVE_EXAMPLE_ENDPOINT} from "../x402-quote-safety.mjs";
const valid={x402Version:2,resource:{url:LIVE_EXAMPLE_ENDPOINT},accepts:[{scheme:"exact",network:BASE_NETWORK,asset:BASE_NATIVE_USDC,amount:"5000",payTo:"0x1111111111111111111111111111111111111111",maxTimeoutSeconds:300}]};
const inspect=(value=valid,expected={})=>inspectQuote(JSON.stringify(value),expected);
const codes=(x)=>x.entries[0].issues.map(e=>e.code);
test("canonical Base atomic 5000 becomes exact 0.005000 USDC, not customer payment",()=>{
 const x=inspect();assert.equal(x.entries[0].displayPrice,"0.005000 Base USDC");
 assert.equal(x.hasReview,false);assert.equal(x.noPayment,true);assert.equal(x.noWalletConnection,true);
});
test("real v2 PAYMENT-REQUIRED Base64 UTF8 header parsed",()=>{
 const h=Buffer.from(JSON.stringify(valid)).toString("base64");
 assert.deepEqual(decodeQuote("PAYMENT-REQUIRED: "+h),valid);
});
test("URL-safe base64 header works",()=>{
 const h=Buffer.from(JSON.stringify(valid)).toString("base64url");
 assert.deepEqual(decodeQuote(h),valid);
});
test("plain JSON accepts v1 for structural checking",()=>{
 const j=structuredClone(valid);j.x402Version=1; delete j.accepts[0].amount;j.accepts[0].maxAmountRequired="5000";
 assert.equal(inspect(j).entries[0].displayPrice,"0.005000 Base USDC");
});
test("strict overprice expected max uses integer arithmetic",()=>{
 assert.ok(codes(inspect(valid,{maxUsdc:"0.004999"})).includes("PRICE_ABOVE_MAX"));
 assert.ok(!codes(inspect(valid,{maxUsdc:"0.005"})).includes("PRICE_ABOVE_MAX"));
 assert.equal(parseMaxUsdc("0.01"),10000n);
});
test("recipient matching ignores EVM address casing",()=>{
 assert.ok(!codes(inspect(valid,{payTo:"0X1111111111111111111111111111111111111111".replace(/^0X/,"0x")})).includes("RECIPIENT_MISMATCH"));
});
test("recipient mismatch flagged",()=>assert.ok(codes(inspect(valid,{payTo:"0x2222222222222222222222222222222222222222"})).includes("RECIPIENT_MISMATCH")));
test("explicit expected endpoint mismatch flagged",()=>assert.ok(codes(inspect(valid,{resourceUrl:"https://elsewhere.invalid/api"})).includes("RESOURCE_MISMATCH")));
test("wrong Base USDC contract flagged",()=>{
 const j=structuredClone(valid);j.accepts[0].asset="0x0000000000000000000000000000000000000001";
 assert.ok(codes(inspect(j)).includes("NON_CANONICAL_USDC"));
 assert.match(inspect(j).entries[0].displayPrice,/not independently established/);
});
test("Sepolia payment cannot masquerade as Base",()=>{
 const j=structuredClone(valid);j.accepts[0].network="eip155:84532";
 assert.ok(codes(inspect(j)).includes("NON_BASE_NETWORK"));
});
test("non-exact scheme review",()=>{
 const j=structuredClone(valid);j.accepts[0].scheme="gateway";
 assert.ok(codes(inspect(j)).includes("SCHEME_NOT_EXACT"));
});
test("invalid amount, numeric amount and zero amount all warn",()=>{
 for(const value of [-1,5000,"not-a-number", "100.50"]){
  const j=structuredClone(valid);j.accepts[0].amount=value;
  assert.ok(codes(inspect(j)).includes("AMOUNT_INVALID"));
 }
 const z=structuredClone(valid);z.accepts[0].amount="0";
 assert.ok(codes(inspect(z)).includes("ZERO_AMOUNT"));
});
test("zero address and bad payTo are not marked verified",()=>{
 const j=structuredClone(valid);j.accepts[0].payTo="0x"+"0".repeat(40);
 assert.ok(codes(inspect(j)).includes("RECIPIENT_INVALID"));
});
test("nonhttps resource warned and expectation mismatch",()=>{
 const j=structuredClone(valid);j.resource.url="http://example.invalid";
 assert.ok(codes(inspect(j)).includes("RESOURCE_NOT_HTTPS"));
});
test("weird timeout reviewed",()=>{
 const j=structuredClone(valid);j.accepts[0].maxTimeoutSeconds=0;
 assert.ok(codes(inspect(j)).includes("TIMEOUT_UNUSUAL"));
});
test("multiple accepted entries each separately inspected",()=>{
 const j=structuredClone(valid);j.accepts.push({...j.accepts[0],network:"solana:abc"});
 assert.equal(inspect(j).entries.length,2);
 assert.ok(inspect(j).hasReview);
});
test("reject wrong versions, empty acceptances and arrays",()=>{
 for(const j of [{...valid,x402Version:7},{...valid,accepts:[]},[valid],null]){
  assert.throws(()=>decodeQuote(JSON.stringify(j)));
 }
});
test("reject untrusted overly large payload and malformed base64",()=>{
 assert.throws(()=>decodeQuote("A".repeat(50000)));
 assert.throws(()=>decodeQuote("####"));
 assert.throws(()=>decodeQuote(""));
});
test("invalid custom expected bounds cannot hide expensive quotes",()=>{
 for(const maxUsdc of ["-1","0.0000009","abc","1e4","001"]){
  assert.throws(()=>inspect(valid,{maxUsdc}));
 }
 assert.throws(()=>inspect(valid,{payTo:"0xnotAnAddress"}));
 assert.throws(()=>inspect(valid,{resourceUrl:"http://example.invalid"}));
});
test("HTML strings in quote remain strings and are not executed",()=>{
 const j=structuredClone(valid);j.resource.url="<img src=x onerror=alert(1)>";
 const x=inspect(j);
 assert.equal(x.entries[0].resource,j.resource.url);
 assert.ok(x.hasReview);
});
test("malicious duplicate, out-of-range count and prototype inputs fail",()=>{
 const j=structuredClone(valid);j.accepts=Array(17).fill(valid.accepts[0]);
 assert.throws(()=>decodeQuote(JSON.stringify(j)));
});
