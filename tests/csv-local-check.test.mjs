import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseCsv,analyzeCsv,SYNTHETIC_EXAMPLE,MAX_BYTES,MAX_DATA_ROWS,MAX_COLUMNS} from "../csv-local-check.mjs";

test("RFC4180-style quoted commas, escaped double quotes, CRLF, embedded newlines are parsed exactly",()=>{
  const rows=parseCsv('name,comment\r\n"a,b","say ""yes""\nnew line"\r\nc,d\r\n');
  assert.deepEqual(rows,[["name","comment"],["a,b",'say "yes"\nnew line'],["c","d"]]);
});
test("single CR and LF endings are accepted without phantom trailing rows",()=>{
  assert.deepEqual(parseCsv("x,y\na,b\n"),[["x","y"],["a","b"]]);
  assert.deepEqual(parseCsv("x,y\ra,b\r"),[["x","y"],["a","b"]]);
});
test("leading BOM is removed; Unicode values are preserved",()=>{
  assert.deepEqual(parseCsv("\ufeffname,note\r\n유저,서울")[1],["유저","서울"]);
});
test("unclosed quotes fail closed, not as a low-risk scan",()=>{
  assert.throws(()=>parseCsv('a,b\n"broken,z'),SyntaxError);
});
test("unexpected quote inside unquoted field fails closed",()=>{
  assert.throws(()=>parseCsv('a,b\nx"y,z'),SyntaxError);
});
test("unexpected content after closing quoted field fails closed",()=>{
  assert.throws(()=>parseCsv('a,b\n"foo"tail,z'),SyntaxError);
});
test("invalid NUL and absent data rows fail closed",()=>{
  assert.throws(()=>parseCsv("a,b"),/header and at least one/);
  assert.throws(()=>parseCsv("a,b\nx,\u0000"),/NUL/);
});
test("exact input byte length bound applies to UTF-8 bytes, not JS character count",()=>{
  assert.throws(()=>parseCsv("v\n"+("é".repeat(16384))),RangeError);
  assert.equal(MAX_BYTES,32768);
});
test("500 data records allowed; 501 rejected",()=>{
  const x="col\n"+("ok\n".repeat(MAX_DATA_ROWS));
  assert.equal(parseCsv(x).length,MAX_DATA_ROWS+1);
  assert.throws(()=>parseCsv(x+"bad\n"),RangeError);
});
test("exactly 40 columns allowed; extra column rejected",()=>{
  const c=Array.from({length:MAX_COLUMNS},(_,i)=>"k"+i).join(",");
  const d=Array(MAX_COLUMNS).fill("1").join(",");
  assert.equal(parseCsv(c+"\n"+d).length,2);
  assert.throws(()=>parseCsv(c+",extra\n"+d+",2"),RangeError);
});
test("rows with empty cells, missing columns and duplicate data are counted correctly",()=>{
  const x=analyzeCsv("a,b,c\n1,2,3\n1,2,3\n4,\n5,6,7");
  assert.equal(x.rowCount,4);
  assert.equal(x.counts.duplicateRows,1);
  assert.equal(x.counts.irregularRows,1);
  assert.equal(x.counts.missingCells,2);
  assert.equal(x.counts.formulaRiskCells,0);
  assert.equal(x.totalFindings,4);
  assert.equal(x.paidCallMade,false);
});
test("case-insensitive duplicate headers and expected missing names counted",()=>{
  const x=analyzeCsv("Email,email,,age\na,b,c,2",["EMAIL","amount","AGE"]);
  assert.equal(x.counts.duplicateHeaders,2);
  assert.equal(x.counts.missingExpectedHeaders,1);
});
test("possible spreadsheet formulas are flagged, signed normal numbers are not",()=>{
  const x=analyzeCsv('x,y,z\n"=1+1","@foo", -12.30\n+SUM(1),-CMD,5');
  assert.equal(x.counts.formulaRiskCells,4);
  assert.ok(x.issues.filter(i=>i.kind==="Formula").length===4);
});
test("no CSV text values are echoed in issue previews",()=>{
  const attack='<img src=x onerror=alert(1)>';
  const x=analyzeCsv("secret,echo\n"+attack+",\n"+attack+",");
  assert.equal(x.counts.duplicateRows,1);
  const found=x.issues.map(i=>i.detail).join(" ");
  assert.doesNotMatch(found,/onerror|<img|alert/);
  assert.equal(x.localOnly,true);
});
test("max 80 displayed findings bounds large local result DOM",()=>{
 const csv="a,b\n"+Array.from({length:140},(_,i)=>i+",").join("\n");
 const x=analyzeCsv(csv);
 assert.ok(x.totalFindings>=140);
 assert.equal(x.issues.length,80);
 assert.equal(x.truncated,true);
});
test("free synthetic example contains duplicate and formula warnings but is not a buyer receipt",()=>{
 const r=analyzeCsv(SYNTHETIC_EXAMPLE,["email","amount","date","note"]);
 assert.equal(r.rowCount,4);
 assert.ok(r.counts.duplicateRows>=1);
 assert.ok(r.counts.formulaRiskCells>=1);
 assert.equal(r.paidCallMade,false);
});
test("free landing page is transparent about no network, no payment, and real buyer opt-in",()=>{
 const html=readFileSync(new URL("../guides/csv-free-local-checker.html",import.meta.url),"utf8");
 assert.match(html,/meta name="robots" content="index,follow"/);
 assert.match(html,/0\.005 native Circle USDC/);
 assert.match(html,/csv-structural-preflight-005-base-usdc\.html/);
 assert.match(html,/No upload/);
 assert.match(html,/No automatic charge/);
 assert.match(html,/type="module"/);
 assert.ok(!/<(?:iframe|object|embed|form)\b/i.test(html));
 assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/.test(html));
});
