const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("/srv/multi-vm-agent/workspace/make_money/work/vm3-bluea-one-partner-form-20261020/node_modules/playwright-core");
const SITE=path.resolve(__dirname,"..");
const server=http.createServer((req,res)=>{
 const u=new URL(req.url||"/","http://127.0.0.1");
 const target=path.resolve(SITE,"."+decodeURIComponent(u.pathname));
 if(!target.startsWith(SITE+path.sep)){res.writeHead(403);return res.end();}
 try{const data=fs.readFileSync(target);res.writeHead(200,{"content-type":target.endsWith(".html")?"text/html; charset=utf-8":target.endsWith(".mjs")?"text/javascript; charset=utf-8":"text/plain; charset=utf-8"});res.end(data);}
 catch{res.writeHead(404);res.end("not found");}
});
async function run(){
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:"/usr/bin/google-chrome",
    args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--disable-extensions"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const external=[],errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",route=>{
   if(new URL(route.request().url()).hostname!=="127.0.0.1"){external.push(route.request().url());return route.abort();}
   return route.continue();
  });
  const base="http://127.0.0.1:"+server.address().port;
  const home=await page.goto(base+"/index.html",{waitUntil:"load",timeout:15000});
  assert.equal(home.status(),200);
  assert.match(await page.locator("#machine-paid").innerText(),/Five live fixed-fee/);
  const link=page.locator('a[href="services/x402-cors-remedy-150-usdc.html"]').first();
  assert.ok(await link.isVisible());
  await link.click();
  assert.match(page.url(),/services\/x402-cors-remedy-150-usdc\.html/);
  assert.match(await page.locator("h1").innerText(),/x402 price/);
  assert.equal(await page.getByRole("link",{name:/View the real published seller\/service API/}).count(),1);
  assert.match(await page.locator("body").innerText(),/1\.500000 Base USDC/);
  assert.match(await page.locator("body").innerText(),/0\.30 USDC fee/);
  assert.match(await page.locator("body").innerText(),/No external paid customer/);
  const pre=await page.locator("pre").innerText();
  assert.match(pre,/X-Agent-ID: YOUR_OWN_PUBLIC_EVM_WALLET_ADDRESS/);
  assert.ok(!pre.includes("PRIVATE_KEY"));
  for(const width of [320,390,680,1280]){
   await page.setViewportSize({width,height:830});
   const rect=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(rect.scroll<=rect.width+1,"Horizontal overflow at "+width+": "+rect.scroll);
  }
  await page.getByRole("link",{name:/Try the free browser diagnostic first/}).click();
  assert.match(page.url(),/guides\/x402-browser-cors-doctor\.html/);
  await page.getByRole("button",{name:/Load invented 402 \+ OPTIONS headers/}).click();
  await page.getByRole("button",{name:/Diagnose pasted header data locally/}).click();
  assert.match(await page.locator("#offline-summary").innerText(),/browser-visible unpaid/);
  assert.deepEqual(external,[]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:"ONE_ORIGINAL_PAID_150_SALES_ROUTE_BROWSER_PASS",
   publicBuyerAPIOnlyLinked:true,productPriceUsdc:"1.50",platformFeeUsdc:"0.30",sellerProposedShareUsdc:"1.20",
   freeDemoPreserved:true,responsiveWidths:[320,390,680,1280],thirdPartyRequests:0,
   signedPayments:0,transactions:0,actualRevenue:0,browserErrors:0}));
 }finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
