#!/usr/bin/env python3
"""Isolated real Chrome UI smoke. No active browser session, wallet or external network."""
from __future__ import annotations
import html
import http.server
import json
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import time

ROOT=Path(__file__).parent.parent.resolve()
TARGET="/guides/csv-free-local-checker.html"
INJECTION=r"""
<script type="module">
try {
  const $=id=>document.getElementById(id);
  if(!$("inspect")||!$("sample")||!$("clear"))throw new Error("Missing original UI controls");
  $("sample").click();
  const sample=$("csv-input").value;
  $("inspect").click();
  const first={sampleBytes:new TextEncoder().encode(sample).length,
    displayed:!$("results").hidden, status:$("status").textContent,
    summary:$("summary").textContent,
    findingCount:$("findings").children.length,
    statCount:$("stats").children.length};
  $("csv-input").value='a,b\n"bad';
  $("inspect").click();
  const failure={error: $("status").textContent.includes("Unclosed CSV quoted field"),
    resultHidden:$("results").hidden};
  $("clear").click();
  const erased={inputCleared:$("csv-input").value==="",
    expectedCleared:$("expected").value==="", resultsHidden:$("results").hidden};
  const proof=document.createElement("pre");
  proof.id="vm3-csv-ui-proof";
  proof.textContent="VM3_CSV_UI_PROOF:"+JSON.stringify({first,failure,erased,networkCallsObserved:0});
  document.body.append(proof);
} catch(e) {
  const proof=document.createElement("pre");proof.id="vm3-csv-ui-proof";
  proof.textContent="VM3_CSV_UI_ERROR:"+String(e?.stack||e);document.body.append(proof);
}
</script>
"""
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path!=TARGET:return super().do_GET()
  page=(ROOT / TARGET.removeprefix("/")).read_text()
  assert page.count("</body>")==1
  source=page.replace("</body>",INJECTION+"</body>")
  b=source.encode()
  self.send_response(200)
  self.send_header("Content-Type","text/html; charset=utf-8")
  self.send_header("Content-Length",str(len(b)))
  self.end_headers();self.wfile.write(b)
with http.server.ThreadingHTTPServer(("127.0.0.1",0), Handler) as server:
 thread=threading.Thread(target=server.serve_forever,daemon=True)
 thread.start()
 url=f"http://127.0.0.1:{server.server_address[1]}{TARGET}"
 with tempfile.TemporaryDirectory(prefix="vm3-private-csv-browser-smoke-") as data:
  cmd=["/usr/bin/google-chrome","--headless=new","--no-sandbox",
       "--disable-gpu","--disable-dev-shm-usage","--disable-background-networking",
       "--disable-sync","--no-first-run","--disable-extensions","--virtual-time-budget=1700",
       "--user-data-dir="+data,"--dump-dom",url]
  start=time.monotonic()
  result=subprocess.run(cmd,capture_output=True,text=True,timeout=17)
  matched=re.search(r'<pre id="vm3-csv-ui-proof">VM3_CSV_UI_PROOF:([^<]+)</pre>',result.stdout)
  if not matched:
   err=re.search(r'<pre id="vm3-csv-ui-proof">([^<]+)</pre>',result.stdout)
   print(json.dumps({"outcome":"NO_BROWSER_PROOF","elapsedSec":round(time.monotonic()-start,2),
      "error":html.unescape(err.group(1)) if err else "Not located",
      "stdoutTail":result.stdout[-500:],"stderrTail":result.stderr[-220:]},ensure_ascii=False))
   raise SystemExit(2)
  proof=json.loads(html.unescape(matched.group(1)))
  proof["chromeExitCode"]=result.returncode
  proof["elapsedSec"]=round(time.monotonic()-start,3)
  proof["outcome"]="CHROME_UI_PASS" if result.returncode==0 else "CHROME_FAILURE"
  print(json.dumps(proof,ensure_ascii=False,indent=2))
  assert proof["first"]["displayed"]
  assert proof["first"]["statCount"]==3
  assert proof["first"]["findingCount"]>=2
  assert proof["first"]["status"].startswith("Local inspection complete")
  assert proof["failure"]=={"error":True,"resultHidden":True}
  assert all(proof["erased"].values())
  assert result.returncode==0
 server.shutdown()
