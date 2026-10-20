import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  feedbackEmailUrl, FEEDBACK_EMAIL, ROLES, PROBLEMS, FREQUENCIES, BUDGETS,
} from "../buyer-feedback-local.mjs";

const sample={
  role:ROLES[0],
  problem:PROBLEMS[0],
  frequency:FREQUENCIES[2],
  budget:BUDGETS[3],
  details:"Our browser misses PAYMENT-REQUIRED for an HTTP 402.",
};
const html=readFileSync(new URL("../guides/base-usdc-merchant-ledger.html",import.meta.url),"utf8");
const home=readFileSync(new URL("../index.html",import.meta.url),"utf8");
test("real honest user feedback survey has select groups, no mandatory registration",()=>{
  for(const id of ["buyer-feedback","feedback-role","feedback-problem","feedback-frequency",
    "feedback-budget","feedback-details","feedback-prepare","feedback-send","feedback-status"])
    assert.ok(html.includes('id="'+id+'"'),"missing "+id);
  assert.match(home,/base-usdc-merchant-ledger\.html#buyer-feedback/);
  assert.match(html,/Select the issue that actually costs you time/i);
  assert.match(html,/willingness to pay/i);
});
test("nothing is sent automatically; both preparing and submitting need user action",()=>{
  assert.match(html,/Open your email app to review and send/);
  assert.match(html,/type="button" id="feedback-prepare"/);
  assert.match(html,/id="feedback-send"[^>]*hidden/);
  assert.doesNotMatch(html,/<form|<iframe|navigator\.sendBeacon|XMLHttpRequest|window\.ethereum|ethereum\.request/);
  assert.doesNotMatch(html,/\bfetch\s*\(/);
});
test("a full selected response produces only an RFC6068 percent-encoded local mailto draft",()=>{
  const uri=feedbackEmailUrl(sample);
  assert.ok(uri.startsWith("mailto:"+FEEDBACK_EMAIL+"?subject="));
  assert.ok(uri.length<=2000);
  const str=decodeURIComponent(uri);
  assert.match(str,/Browser CORS or unreadable HTTP 402 quote/);
  assert.match(str,/5 to 19 USDC per fixed-scope QA/);
  assert.match(str,/2 to 10 times in the past 30 days/);
  assert.match(str,/Our browser misses PAYMENT-REQUIRED/);
  assert.match(str,/not an order, payment or verified customer endorsement/);
});
test("blank role, problem, frequency or budget fails closed",()=>{
  for(const name of ["role","problem","frequency","budget"])
    assert.throws(()=>feedbackEmailUrl({...sample,[name]:""}),new RegExp(name));
  assert.throws(()=>feedbackEmailUrl(null),TypeError);
});
test("no enumerated choice is treated as outside text or a different marketing claim",()=>{
  for(const [name,options] of [
    ["role",ROLES],["problem",PROBLEMS],["frequency",FREQUENCIES],["budget",BUDGETS]
  ]){
    assert.ok(options.length>=4);
    assert.equal(new Set(options).size,options.length);
    assert.throws(()=>feedbackEmailUrl({...sample,[name]:"<script>alert(1)</script>"}),new RegExp(name));
  }
});
test("untrusted optional message is encoded and never executes as HTML or email headers",()=>{
  const s=feedbackEmailUrl({...sample,details:"Possible issue:\n<script>alert(1)</script>&body=bad"});
  assert.ok(!s.includes("<script>"));
  assert.match(s,/%3Cscript%3Ealert/);
  assert.match(s,/%0A/);
  assert.ok(!s.includes("\r"));
});
test("high-risk content patterns are blocked before preparing an email draft",()=>{
  for(const details of [
    "private key: 0x"+"a".repeat(64),
    "This is my password",
    "Here is a recovery phrase",
    "API token=foo",
    "My tx is "+"f".repeat(64),
    "z".repeat(281),
  ]) assert.throws(()=>feedbackEmailUrl({...sample,details}));
});
test("all price points remain willingness-to-pay signals, not money received",()=>{
  for(const budget of BUDGETS){
    const uri=decodeURIComponent(feedbackEmailUrl({...sample,budget}));
    assert.ok(uri.includes(budget));
    assert.match(uri,/A price choice is not a purchase/);
  }
});
test("customer reply is always to the one verified existing VM3 contact",()=>{
  assert.equal(FEEDBACK_EMAIL,"onecursor1@gmail.com");
  assert.equal(feedbackEmailUrl(sample).split("?")[0],"mailto:onecursor1@gmail.com");
});
