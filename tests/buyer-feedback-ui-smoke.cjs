// Browser-smoke for voluntary real crypto buyer feedback. Never clicks final mailto or sends email.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("/srv/multi-vm-agent/workspace/make_money/work/vm3-bluea-one-partner-form-20261020/node_modules/playwright-core");
const SITE=path.resolve(__dirname,"..");
const MIME={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8"};
const server=http.createServer((request,response)=>{
  const target=new URL(request.url||"/","http://127.0.0.1");
  const file=path.resolve(SITE,"."+decodeURIComponent(target.pathname));
  if(!file.startsWith(SITE+path.sep)){response.writeHead(403);return response.end();}
  try{
    const body=fs.readFileSync(file);
    response.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"text/plain"});
    response.end(body);
  }catch{response.writeHead(404);response.end("Missing file");}
});
async function run(){
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  const origin="http://127.0.0.1:"+server.address().port;
  let browser;let checks=0;
  try{
    browser=await chromium.launch({headless:true,executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--disable-extensions"]});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const external=[],errors=[],mails=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",route=>{
      if(new URL(route.request().url()).hostname!=="127.0.0.1"){external.push(route.request().url());return route.abort();}
      return route.continue();
    });
    const load=await page.goto(origin+"/guides/base-usdc-merchant-ledger.html",{waitUntil:"load",timeout:16000});
    assert.equal(load.status(),200);checks++;
    const send=page.locator("#feedback-send");
    assert.equal(await send.isHidden(),true);checks++;
    await page.locator("#feedback-prepare").click();
    assert.equal(await send.isHidden(),true);
    assert.match(await page.locator("#feedback-status").innerText(),/Select a valid role/);checks++;
    await page.locator("#feedback-role").selectOption("x402 service seller");
    await page.locator("#feedback-problem").selectOption("Browser CORS or unreadable HTTP 402 quote");
    await page.locator("#feedback-frequency").selectOption("2 to 10 times in the past 30 days");
    await page.locator("#feedback-budget").selectOption("5 to 19 USDC per fixed-scope QA");
    await page.locator("#feedback-details").fill("My browser HTTP 402 has missing price headers.");
    await page.locator("#feedback-prepare").click();
    assert.equal(await send.isVisible(),true);checks++;
    const feedback=await send.getAttribute("href");
    assert.ok(feedback.startsWith("mailto:onecursor1@gmail.com?subject="));
    assert.ok(!feedback.includes("<script>"));
    const body=decodeURIComponent(feedback);
    assert.match(body,/x402 service seller/);
    assert.match(body,/5 to 19 USDC per fixed-scope QA/);
    assert.match(body,/My browser HTTP 402 has missing price headers/);
    assert.match(await page.locator("#feedback-status").innerText(),/Nothing has been sent/);checks++;
    await page.locator("#feedback-budget").selectOption("Free advice only");
    assert.equal(await send.isHidden(),true);
    assert.equal(await send.getAttribute("href"),null);checks++;
    await page.locator("#feedback-details").fill("My private key is hidden");
    await page.locator("#feedback-prepare").click();
    assert.equal(await send.isHidden(),true);
    assert.match(await page.locator("#feedback-status").innerText(),/Remove any keys/);checks++;
    await page.locator("#feedback-details").fill("");
    await page.locator("#feedback-prepare").click();
    assert.equal(await send.isVisible(),true);
    assert.ok((await send.getAttribute("href")).includes("mailto:"));checks++;
    await page.locator("#sample").click();
    await page.locator("#run").click();
    assert.equal(await page.locator("#claimed-usdc").innerText(),"0.005000");
    assert.equal(await page.locator("#claimed-count").innerText(),"1");checks++;
    for(const width of [320,390]){
      await page.setViewportSize({width,height:780});
      const s=await page.evaluate(()=>({vw:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(s.scroll<=s.vw+1,"Buyer survey overflow at "+width+": "+s.scroll);
      checks++;
    }
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);checks++;
    await page.reload();
    assert.equal(await send.isHidden(),true);
    assert.equal(await page.locator("#feedback-role").inputValue(),"");
    checks++;
    console.log(JSON.stringify({status:"BUYER_WTP_FEEDBACK_REAL_CHROME_PASS",checks,feedbackDraftPrepared:true,
      emailsActuallySent:0,externalNetworkRequests:0,browserErrors:0,
      independentCustomers:0,realPaidCashUsdc:0}));
  }finally{
    if(browser)await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
