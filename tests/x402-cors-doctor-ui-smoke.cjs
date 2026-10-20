// Original offline/real-browser CORS doctor E2E, with one explicitly mocked public seller.
// Never sends a live payment, keys, a signed retry, or a probe to a real merchant.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("/srv/multi-vm-agent/workspace/make_money/work/vm3-bluea-one-partner-form-20261020/node_modules/playwright-core");
const ROOT=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8"};
const originServer=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url||"/","http://127.0.0.1").pathname);
  const target=path.resolve(ROOT,"."+pathname);
  if(!target.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  try{
    const buffer=fs.readFileSync(target);
    res.writeHead(200,{"content-type":mime[path.extname(target)]||"text/plain"});
    res.end(buffer);
  }catch{res.writeHead(404);res.end("not found");}
});
async function run(){
  await new Promise((resolve,reject)=>{originServer.once("error",reject);originServer.listen(0,"127.0.0.1",resolve)});
  let b,checks=0;
  try{
    b=await chromium.launch({headless:true,executablePath:"/usr/bin/google-chrome",
      args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--disable-extensions"]});
    const page=await b.newPage({viewport:{width:390,height:844}});
    const jsErrors=[],remoteRequests=[];
    page.on("pageerror",err=>jsErrors.push(err.message));
    let behavior="valid";
    const endpoint="https://original-public-merchant-example.org/v1/paid";
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==="127.0.0.1")return route.continue();
      if(url.hostname!=="original-public-merchant-example.org")throw Error("UNEXPECTED_OUTSIDE_REQUEST: "+url.hostname);
      const req=route.request();
      remoteRequests.push({method:req.method(),url:req.url(),headers:Object.keys(req.headers())});
      // Simulate a browser-visible network/CORS-style rejection without claiming that
      // CDP route.fulfill itself enforces a real server's CORS policy.
      if(behavior==="network-failure")return route.abort("failed");
      const h={"content-type":"application/json"};
      if(behavior!=="no-origin")h["access-control-allow-origin"]="*";
      if(behavior!=="not-exposed")h["access-control-expose-headers"]="PAYMENT-REQUIRED,PAYMENT-RESPONSE";
      h["payment-required"]="eyJ4NDAyVmVyc2lvbiI6Mn0=";
      return route.fulfill({status:402,headers:h,body:"{}"});
    });
    const home="http://127.0.0.1:"+originServer.address().port+"/guides/x402-browser-cors-doctor.html";
    const loaded=await page.goto(home,{waitUntil:"load",timeout:15000});
    assert.equal(loaded.status(),200);checks++;
    assert.equal(remoteRequests.length,0);checks++;
    assert.equal(await page.locator("#live-results").isHidden(),true);
    await page.locator("#live-probe").click();
    assert.match(await page.locator("#live-status").innerText(),/Explicit authorization is required/);
    assert.equal(remoteRequests.length,0);checks++;
    await page.locator("#inspect-headers").click();
    assert.match(await page.locator("#offline-status").innerText(),/Cannot interpret pasted public headers/);checks++;
    await page.locator("#sample-headers").click();
    assert.match(await page.locator("#challenge-paste").inputValue(),/PAYMENT-REQUIRED/);
    await page.locator("#inspect-headers").click();
    assert.equal(await page.locator("#offline-results").isHidden(),false);
    assert.match(await page.locator("#offline-summary").innerText(),/declares a browser-readable unpaid/);
    assert.equal(await page.locator("#offline-fail li").count(),0);
    assert.match(await page.locator("#retry-summary").innerText(),/required headers allowed/);checks++;
    // Real browser DOM behavior, invented response headers only; no signed request or outside probe.
    await page.locator("#client-profile").selectOption("x402-fetch-2.28");
    await page.locator("#inspect-headers").click();
    assert.match(await page.locator("#offline-fail").innerText(),/SDK 228 REQUEST EXPOSE HEADER NOT ALLOWED/);
    assert.match(await page.locator("#retry-summary").innerText(),/PRE-FLIGHT BLOCKER/);
    assert.equal(remoteRequests.length,0);checks++;
    await page.locator("#options-paste").fill((await page.locator("#options-paste").inputValue())
      .replace("PAYMENT-RESPONSE", "PAYMENT-RESPONSE,Access-Control-Expose-Headers"));
    await page.locator("#inspect-headers").click();
    assert.equal(await page.locator("#offline-fail li").count(),0);
    assert.match(await page.locator("#retry-summary").innerText(),/required headers allowed/);
    assert.equal(remoteRequests.length,0);checks++;
    await page.locator("#client-profile").selectOption("standard");
    await page.locator("#options-paste").fill("HTTP/2 405\nAccess-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET\nAccess-Control-Allow-Headers: content-type\n");
    await page.locator("#inspect-headers").click();
    assert.match(await page.locator("#offline-fail").innerText(),/PREFLIGHT NOT 2XX/);
    assert.match(await page.locator("#offline-fail").innerText(),/PAYMENT SIGNATURE NOT ALLOWED/);checks++;
    await page.locator("#public-endpoint").fill("https://localhost/secret");
    await page.locator("#probe-consent").check();
    await page.locator("#live-probe").click();
    assert.match(await page.locator("#live-status").innerText(),/Local, reserved, private|Only a public/);
    assert.equal(remoteRequests.length,0);checks++;
    await page.locator("#public-endpoint").fill(endpoint);
    await page.locator("#probe-consent").check();
    await page.locator("#live-probe").click();
    await page.waitForFunction(()=>document.querySelector("#live-results")?.hidden===false,{timeout:11000});
    assert.equal(await page.locator("#live-status-code").innerText(),"402");
    assert.equal(await page.locator("#live-price-readable").innerText(),"YES");
    assert.equal(await page.locator("#live-paid").innerText(),"NO");
    assert.equal(remoteRequests.length,1);
    assert.equal(remoteRequests[0].method,"GET");
    assert.equal(remoteRequests[0].headers.some(h=>h.toLowerCase()==="payment-signature"),false);
    assert.equal(remoteRequests[0].headers.some(h=>h.toLowerCase()==="authorization"),false);
    assert.equal(remoteRequests[0].headers.some(h=>h.toLowerCase()==="cookie"),false);checks++;
    behavior="not-exposed";
    await page.locator("#live-probe").click();
    await page.waitForFunction(()=>document.querySelector("#live-results")?.hidden===false &&
      document.querySelector("#live-price-readable")?.innerText?.startsWith("NO"),{timeout:11000});
    assert.equal(await page.locator("#live-status-code").innerText(),"402");
    assert.equal(await page.locator("#live-paid").innerText(),"NO");checks++;
    behavior="network-failure";
    await page.locator("#live-probe").click();
    await page.waitForFunction(()=>document.querySelector("#live-status")?.textContent?.includes("Browser fetch failed"),{timeout:11000});
    assert.equal(await page.locator("#live-results").isHidden(),true);
    assert.match(await page.locator("#live-status").innerText(),/cannot distinguish/);checks++;
    await page.locator("#probe-consent").uncheck();
    await page.locator("#same-owner-sample").click();
    assert.equal(await page.locator("#public-endpoint").inputValue(),
      "https://vm5-openapi-x402.onrender.com/v1/csv-report");
    assert.equal(await page.locator("#probe-consent").isChecked(),false);
    assert.equal(remoteRequests.length,3);checks++;
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:850});
      const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(metrics.scroll<=metrics.width+1,"Horizontal overflow at "+width);
      checks++;
    }
    assert.equal(jsErrors.length,0);
    assert.equal(remoteRequests.length,3);
    checks++;
    console.log(JSON.stringify({status:"X402_CORS_ORIGINAL_FREE_BROWSER_E2E_PASS",
      checks,publicMerchantRequests:0,onlyMockedMerchantRequests:remoteRequests.length,
      tested402PriceReadable:true,testedOfflineCORSBlockedInPureTests:true,testedMockNetworkFailure:true,
      realWalletCalls:0,realPayments:0,independentBuyers:0,externalNetwork:0,javaScriptErrors:0}));
  }finally{
    if(b)await b.close().catch(()=>{});
    await new Promise(resolve=>originServer.close(resolve));
  }
}
run().catch(e=>{console.error(e.stack);originServer.close();process.exitCode=1});
