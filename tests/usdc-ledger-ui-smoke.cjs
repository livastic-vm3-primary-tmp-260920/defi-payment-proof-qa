// Owner-site browser E2E: local loopback HTTP only; no 3p calls or user funds.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("/srv/multi-vm-agent/workspace/make_money/work/vm3-bluea-one-partner-form-20261020/node_modules/playwright-core");
const SITE=path.resolve(__dirname,"..");
const CT={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".xml":"application/xml"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://127.0.0.1");
  const decoded=decodeURIComponent(url.pathname);
  const p=path.resolve(SITE,"."+decoded);
  if(!p.startsWith(SITE+path.sep)){res.writeHead(403);return res.end();}
  try{
    const stat=fs.statSync(p);
    if(!stat.isFile())throw Error("Not a file");
    res.writeHead(200,{"Content-Type":CT[path.extname(p)]||"text/plain"});
    res.end(fs.readFileSync(p));
  }catch(e){res.writeHead(404);res.end("No such file");}
});
async function main(){
  await new Promise((ok,err)=>{server.once("error",err);server.listen(0,"127.0.0.1",ok);});
  const port=server.address().port;
  let browser;
  let checks=0;
  try{
    browser=await chromium.launch({headless:true,executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--disable-extensions"]});
    const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:820}});
    const page=await ctx.newPage();
    const thirdParty=[];
    await page.route("**/*", async route=>{
      if(new URL(route.request().url()).hostname!=="127.0.0.1"){thirdParty.push(route.request().url());return route.abort();}
      await route.continue();
    });
    const home="http://127.0.0.1:"+port+"/guides/base-usdc-merchant-ledger.html";
    const rr=await page.goto(home,{waitUntil:"load",timeout:15000});
    assert.equal(rr.status(),200);
    await page.getByRole("heading",{name:/Stop counting the same payment twice/}).waitFor();
    checks++;
    assert.equal(await page.getByRole("status").innerText(),"No transaction CSV has been analyzed. Start with the synthetic example.");
    checks++;
    await page.getByRole("button",{name:"Try synthetic example"}).click();
    assert.equal((await page.locator("#wallet").inputValue()).length,42);
    assert.match(await page.locator("#csv").inputValue(),/chain_id,token_address/);
    checks++;
    await page.getByRole("button",{name:"Check local claims"}).click();
    assert.equal(await page.locator("#claimed-usdc").innerText(),"0.005000");
    assert.equal(await page.locator("#claimed-count").innerText(),"1");
    assert.equal(await page.locator("#review-count").innerText(),"6");
    checks++;
    const rows=await page.locator("#findings-body tr").count();
    assert.equal(rows,7);
    assert.match(await page.locator("#counts").innerText(),/conflicting event ID/);
    checks++;
    const dlWait=page.waitForEvent("download");
    await page.locator("#export").click();
    const dl=await dlWait;
    assert.equal(dl.suggestedFilename(),"base-usdc-local-review.csv");
    const txt=fs.readFileSync(await dl.path(),"utf8");
    assert.equal(txt.trimEnd().split("\r\n").length,8);
    assert.match(txt,/CONFLICTING_EVENT/);
    checks++;
    await page.locator("#wallet").fill("0x"+"9".repeat(40));
    await page.locator("#run").click();
    assert.equal(await page.locator("#claimed-count").innerText(),"0");
    checks++;
    await page.locator("#csv").fill("garbage");
    await page.locator("#run").click();
    assert.equal(await page.locator("#report").isHidden(),true);
    assert.match(await page.locator("#status").innerText(),/could not be reconciled/i);
    checks++;
    await page.locator("#clear").click();
    assert.equal(await page.locator("#wallet").inputValue(),"");
    assert.equal(await page.locator("#csv").inputValue(),"");
    assert.equal(await page.locator("#export").isDisabled(),true);
    checks++;
    await page.reload();
    assert.equal(await page.locator("#csv").inputValue(),"");
    assert.equal(await page.locator("#wallet").inputValue(),"");
    checks++;
    await page.setViewportSize({width:390,height:844});
    const measure=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}));
    assert.ok(measure.documentWidth<=measure.innerWidth+1,"Mobile page overflows viewport");
    checks++;
    assert.deepEqual(thirdParty,[],"3p requests must not occur during core workflow");
    checks++;
    console.log(JSON.stringify({status:"BROWSER_UI_E2E_PASS",checks,syntheticClaim:"0.005000",realRevenueVerified:false,externalRequests:0,generatedDownload:true,mobileViewportOk:true}));
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(e=>{console.error(String(e.stack||e));server.close();process.exitCode=1;});
