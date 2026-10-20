import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const local=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const page=local("services/x402-cors-remedy-150-usdc.html");
const home=local("index.html");
const free=local("guides/x402-browser-cors-doctor.html");
const map=local("sitemap.xml");
const llms=local("llms.txt");
const readme=local("README.md");
const route="services/x402-cors-remedy-150-usdc.html";
const fullname="https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/"+route;

test("public paid agent service is indexed once, linked from home and free x402 doctor",()=>{
 for(const x of [home,free,map,llms,readme])assert.ok(x.includes(route),"Missing route in linked source");
 assert.equal(map.split(fullname).length-1,1);
 assert.match(page,/<link rel="canonical"/);
 assert.match(page,/<meta name="description"/);
 assert.match(page,/"@type":"Service"/);
});
test("original Soul seller count increased from 4 to verified 5 without claiming a paid buyer",()=>{
 assert.match(home,/Five live fixed-fee AI-assisted QA products/);
 assert.match(home,/These five original seller offerings/);
 assert.match(page,/No external paid customer, job execution or completed payout is claimed/);
 assert.match(llms,/No paid buyers, jobs, USDC settled receipts/);
});
test("paid new service slug is exact and cannot be mistaken for preexisting quote-shape services",()=>{
 assert.match(page,/x402-browser-cors-remedy/);
 assert.match(page,/x402 Browser HTTP 402 CORS Remediation Blueprint/);
 assert.match(page,/Soul.Markets/);
 assert.match(home,/x402 browser CORS remediation blueprint/);
 assert.match(home,/x402-quote-mismatch-preflight/);
 assert.match(home,/x402-payment-challenge-preflight/);
});
test("real merchant SKU price, 402 quote and payee settlement are accurately delimited",()=>{
 assert.match(page,/1\.50 Base Circle USDC/);
 assert.match(page,/1\.500000 Base USDC/);
 assert.match(page,/0\.30 USDC fee and 1\.20 USDC potential seller share/);
 assert.match(page,/seller share per completed paid job/);
 assert.match(page,/token.*0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
 assert.match(page,/quote ID/);
});
test("X-Agent-ID required to distinguish real product quote from default 0.0010 gateway price",()=>{
 assert.match(page,/buyer includes their own public.*X-Agent-ID/);
 assert.match(page,/An anonymous request that omits it may see the platform's generic 0\.001 USDC gateway quote/);
 assert.match(page,/not this service's price/);
 assert.match(page,/X-Agent-ID: YOUR_OWN_PUBLIC_EVM_WALLET_ADDRESS/);
 assert.match(page,/docs\.soul\.mds\.markets\/guides\/buying/);
});
test("buyer data minimization: quote POST itself sends user input offsite, no secrets requested",()=>{
 assert.match(page,/Payload content is sent to Soul.Markets when an independent buyer requests the quote/);
 assert.match(page,/Never provide wallets' private keys, seed phrases/);
 assert.match(page,/PUBLIC, sanitized 402 and OPTIONS headers/);
 assert.match(page,/Never provide.*signed payment headers/);
 assert.match(page,/buyer.*own public wallet address/i);
});
test("no auto-connect, payment, leak, analytics, storage or executable callback in static page",()=>{
 assert.doesNotMatch(page,/<iframe|<form|<script\s+src=|XMLHttpRequest|fetch\s*\(|sendBeacon|localStorage|sessionStorage|window\.ethereum|walletconnect|eth_sendTransaction|signTypedData|gtag\(/i);
 assert.equal((page.match(/<script\b/g)||[]).length,1);
 assert.match(page,/<script type="application\/ld\+json">/);
 assert.match(page,/This static page performs no API calls, spend, wallet access or subscription setup/);
});
test("on-chain settlement and security audit not promised by this AI-assisted service",()=>{
 assert.match(page,/not verified in your production environment/);
 assert.match(page,/not a live payment, security audit or completed customer result/);
 assert.match(page,/not verified in your production environment/);
 assert.match(page,/not commissioned, endorsed or paid for the work/);
});
test("free tool remains genuinely free and human 15 USDC contract stays separate",()=>{
 assert.match(page,/Try the free browser diagnostic first/);
 assert.match(page,/human-authored <strong>15 Base USDC<\/strong>/);
 assert.match(page,/requires a separate accepted written contract/);
 assert.match(free,/Optional 1\.50 USDC AI browser-CORS remedy/);
 assert.match(free,/15 native Base USDC per one authorized endpoint/);
});
test("schema of six public-only buyer inputs faithfully represented for future buyer documentation",()=>{
 for(const x of ["server_framework","browser_origin","intended_method","public_402_headers",
                   "public_options_headers","observed_browser_symptom"])assert.ok(page.includes(x),"Missing "+x);
 assert.match(page,/Express, Fastify, Next\.js, Cloudflare Workers, Nginx proxy/);
 assert.match(page,/Only sanitized unsigned 402 response headers/);
});
test("single owner attribution and zero real income are explicit",()=>{
 assert.match(page,/one actual beneficial human owner/);
 assert.match(page,/No confirmed paid jobs or on-chain seller earnings yet/);
 assert.match(readme,/No buyer payment, real job, or actual USDC seller payout in this release/);
});
test("no legal identity fabrication, fake approval, customer testimonial or pseudo escrow",()=>{
 assert.doesNotMatch(page,/(?:over 100 paying users|audited and certified|customer testimony|escrow verified|safe guaranteed payments)/i);
 assert.match(page,/submitted to the operator, who has <strong>not commissioned, endorsed or paid/);
 assert.match(page,/not a signed authorization or executed paid example/);
});
