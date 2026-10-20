import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProbeUrl,validateBrowserOrigin,diagnoseCorsHeaders,summarizeLiveBrowserResult,
} from "../x402-cors-doctor-local.mjs";

const origin="https://livastic-vm3-primary-tmp-260920.github.io";
const quote=(
  "HTTP/2 402\n"+
  "Access-Control-Allow-Origin: *\n"+
  "Access-Control-Expose-Headers: PAYMENT-REQUIRED,PAYMENT-RESPONSE\n"+
  "PAYMENT-REQUIRED: ZXhhbXBsZQ==\n\n"
);
const opts=(
 "HTTP/2 204\n"+
 "Access-Control-Allow-Origin: *\n"+
 "Access-Control-Allow-Methods: GET,POST,OPTIONS\n"+
 "Access-Control-Allow-Headers: Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE\n\n"
);
const scan=(challengeText=quote,optionsText=opts,extras={})=>
 diagnoseCorsHeaders({challengeText,optionsText,origin,...extras});
const bad=(r,code)=>assert.ok(r.errors.includes(code),code+" not flagged");
const replaced=(original,from,to)=>{assert.ok(original.includes(from));return original.replace(from,to)};

test("positive control matches independent real x402 merchant browser contract",()=>{
 const r=scan();
 assert.equal(r.challengeStatus,402);
 assert.equal(r.browserReadabilityDeclared,true);
 assert.deepEqual(r.errors,[]);
 assert.equal(r.preflight.allowPaymentSignature,true);
 assert.equal(r.preflight.allowContentType,true);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.independentlyVerified,false);
 assert.equal(r.walletConnected,false);
 assert.ok(r.warnings.includes("PREFLIGHT_CACHE_NOT_ADVERTISED"));
});
test("no access control allow origin cannot be rescued by the expose list",()=>{
 const r=scan(replaced(quote,"Access-Control-Allow-Origin: *","Access-Control-Allow-Origin: https://elsewhere.example.org"));
 bad(r,"CHALLENGE_ORIGIN_NOT_ALLOWED");
 assert.equal(r.browserReadabilityDeclared,false);
});
test("missing response expose list makes price unreadable to browsers",()=>{
 const r=scan(replaced(quote,"Access-Control-Expose-Headers: PAYMENT-REQUIRED,PAYMENT-RESPONSE","Cache-Control: no-store"));
 bad(r,"PRICE_HEADER_NOT_EXPOSED");
 assert.equal(r.browserReadabilityDeclared,false);
});
test("unexposed but present price header remains unproven in-browser",()=>{
 const r=scan(replaced(quote,"PAYMENT-REQUIRED: ZXhhbXBsZQ==","PAYMENT-REQUIRED: ZXhhbXBsZQ==\nX-Sample: present").replace("PAYMENT-REQUIRED,PAYMENT-RESPONSE","PAYMENT-RESPONSE"));
 bad(r,"PRICE_HEADER_NOT_EXPOSED");
 assert.equal(r.headerPresent,true);
});
test("missing price header is not treated as an offer",()=>{
 const r=scan(replaced(quote,"PAYMENT-REQUIRED: ZXhhbXBsZQ==","X-Unrelated: true"));
 bad(r,"PRICE_HEADER_NOT_PRESENT");
 assert.equal(r.browserReadabilityDeclared,false);
});
test("HTTP 200 is not a payment quote even when headers look 402-like",()=>{
 const r=scan(quote.replace("HTTP/2 402","HTTP/2 200"));
 assert.equal(r.browserReadabilityDeclared,false);
 assert.ok(r.warnings.includes("NOT_HTTP_402_CHALLENGE"));
});
test("no options pasted means unverified paid payment retry",()=>{
 const r=scan(quote,"");
 assert.equal(r.preflight,null);
 assert.ok(r.warnings.includes("NO_OPTIONS_TRANSCRIPT"));
 assert.equal(r.browserReadabilityDeclared,true);
});
test("failed preflight code is a blocker regardless of allow headers",()=>{
 const r=scan(quote,replaced(opts,"HTTP/2 204","HTTP/1.1 405"));
 bad(r,"PREFLIGHT_NOT_2XX");
});
test("preflight needs matching access-control-allow-origin independently",()=>{
 const r=scan(quote,replaced(opts,"Access-Control-Allow-Origin: *","Access-Control-Allow-Origin: https://blocked.example.org"));
 bad(r,"PREFLIGHT_ORIGIN_NOT_ALLOWED");
});
test("POST must appear in allowed methods if paid endpoint expects POST",()=>{
 const r=scan(quote,replaced(opts,"GET,POST,OPTIONS","GET,OPTIONS"));
 bad(r,"PAID_METHOD_NOT_ALLOWED");
});
test("GET-only paid routes can be modeled separately from POST",()=>{
 const r=scan(quote,replaced(opts,"GET,POST,OPTIONS","GET,OPTIONS"),{paidMethod:"GET"});
 assert.equal(r.errors.length,0);
 assert.equal(r.method,"GET");
});
test("missing payment-signature and content-type block browser paid retry",()=>{
 const r=scan(quote,replaced(opts,"Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE","Authorization"));
 bad(r,"PAYMENT_SIGNATURE_NOT_ALLOWED");
 bad(r,"CONTENT_TYPE_NOT_ALLOWED");
});
test("case-insensitive header field names and comma lists are normalized",()=>{
 const r=scan(quote.toLowerCase().replace("http/2 402","HTTP/2 402"),
 opts.toLowerCase().replace("http/2 204","HTTP/2 204"));
 assert.deepEqual(r.errors,[]);
});
test("valid exact origin as alternative to wildcard for noncredentialed page",()=>{
 const r=scan(quote.replace("Access-Control-Allow-Origin: *","Access-Control-Allow-Origin: "+origin),
 opts.replace("Access-Control-Allow-Origin: *","Access-Control-Allow-Origin: "+origin));
 assert.deepEqual(r.errors,[]);
});
test("wildcard expose is only qualified when credentials are omitted",()=>{
 const r=scan(replaced(quote,"PAYMENT-REQUIRED,PAYMENT-RESPONSE","*"));
 assert.equal(r.browserReadabilityDeclared,true);
 assert.ok(r.warnings.includes("WILDCARD_EXPOSE_ONLY_WORKS_WITHOUT_CREDENTIALS"));
});
test("duplicate exposed header lines union rather than first-wins",()=>{
 const r=scan(replaced(quote,"Access-Control-Expose-Headers: PAYMENT-REQUIRED,PAYMENT-RESPONSE",
 "Access-Control-Expose-Headers: content-type\nAccess-Control-Expose-Headers: payment-required"));
 assert.equal(r.priceHeaderExposed,true);
});
test("optional max-age noted as performance not fatal safety failure",()=>{
 const r=scan(quote,opts.replace("Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE\n",
 "Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE\nAccess-Control-Max-Age: 600\n"));
 assert.equal(r.warnings.includes("PREFLIGHT_CACHE_NOT_ADVERTISED"),false);
});
test("HTTP proxy established line before 402 chooses final response only",()=>{
 const r=scan("HTTP/1.1 200 Connection established\n\n"+quote,
 "HTTP/1.1 200 Connection established\n\n"+opts);
 assert.equal(r.challengeStatus,402);
 assert.equal(r.preflight.status,204);
 assert.deepEqual(r.errors,[]);
});
test("folded header continuation refused rather than silently merged",()=>{
 assert.throws(()=>scan(quote.replace("PAYMENT-REQUIRED: ZXhhbXBsZQ==","PAYMENT-REQUIRED: ZXhhbXBsZQ==\n  secret")),/Folded/);
});
test("malformed or empty status transcripts fail closed",()=>{
 for(const x of ["","PAYMENT-REQUIRED: foo","HTTP/2 OK\nPAYMENT-REQUIRED: foo","HTTP/2 402\nBad Header"]){
  assert.throws(()=>scan(x),Error);
 }
});
test("oversized header and fake nonstring object fail closed",()=>{
 assert.throws(()=>scan("z".repeat(48001)),/limit/);
 assert.throws(()=>scan(42),/limit/);
});
test("privacy: credential headers are ignored even on user-provided raw transcript",()=>{
 const raw=quote.replace("PAYMENT-REQUIRED: ZXhhbXBsZQ==","PAYMENT-REQUIRED: ZXhhbXBsZQ==\nAuthorization: Bearer not-a-real-secret\nPAYMENT-SIGNATURE: not-a-real-signature\nSet-Cookie: session=fake");
 const r=scan(raw);
 assert.deepEqual(r.errors,[]);
 assert.ok(!JSON.stringify(r).includes("not-a-real-secret"));
 assert.ok(!JSON.stringify(r).includes("not-a-real-signature"));
});
test("live browser summarizes visible header only; does not quote or settle",()=>{
 const r=summarizeLiveBrowserResult({status:402,headerValue:"ZXhhbXBsZQ=="});
 assert.equal(r.headerReadable,true);
 assert.equal(r.quoteByteLength,12);
 assert.equal(r.paid,false);
 assert.equal(r.chainVerified,false);
 assert.equal(r.deliveryVerified,false);
 assert.ok(!JSON.stringify(r).includes("ZXhhbXBsZQ=="));
});
test("live blocked/missing price differs from signed rejection",()=>{
 const x=summarizeLiveBrowserResult({status:402,headerValue:null});
 assert.equal(x.headerReadable,false);
 assert.ok(x.messages.includes("PRICE_HEADER_NOT_BROWSER_READABLE_OR_ABSENT"));
 assert.equal(x.paid,false);
});
test("live 200 is not evidence of a paid sale",()=>{
 const r=summarizeLiveBrowserResult({status:200,headerValue:""});
 assert.ok(r.messages.includes("NOT_HTTP_402"));
 assert.equal(r.paid,false);
});
test("no arbitrary status codes accepted",()=>{
 for(const code of [null,-1,777,NaN,"402"]){
  assert.throws(()=>summarizeLiveBrowserResult({status:code,headerValue:""}),TypeError);
 }
});
test("public URL requires HTTPS and host, no explicit port or local targets",()=>{
 const good=validateProbeUrl("https://api.publicvendor.org/paid");
 assert.equal(good,"https://api.publicvendor.org/paid");
 for(const s of [
  "http://api.publicvendor.org/v1",
  "https://localhost/private",
  "https://192.168.1.10/admin",
  "https://api.publicvendor.org:8443/path",
  "https://[::1]/admin",
  "https://api.publicvendor.org#fragment",
  "https://user:pass@api.publicvendor.org/pay",
  "https://api.publicvendor.local/pay",
  "https://api.publicvendor.org/path?api_key=secret",
  "https://api.publicvendor.org/path?token=opaque",
  "javascript:alert(1)","invalid", "", "a".repeat(651)
 ])assert.throws(()=>validateProbeUrl(s),Error,s);
});
test("allowed noncredentialed public query does not silently strip information",()=>{
 const r=validateProbeUrl("https://merchant.example.org/pay?q=public-example");
 assert.equal(r,"https://merchant.example.org/pay?q=public-example");
});
test("browser origin must be literal scheme/host with no credentials or path",()=>{
 assert.equal(validateBrowserOrigin("https://shop.example.org"),"https://shop.example.org");
 assert.equal(validateBrowserOrigin("http://localhost:1234"),"http://localhost:1234");
 for(const s of ["http://public.example.org","https://shop.example.org/path",
  "https://shop.example.org/?key=foo","https://a:b@shop.example.org",
  "file:///a","ftp://site.example.org", ""]){
    assert.throws(()=>validateBrowserOrigin(s),Error);
  }
});
test("paid method must be explicit expected GET or POST",()=>{
 assert.throws(()=>scan(quote,opts,{paidMethod:"DELETE"}),/GET or POST/);
});
