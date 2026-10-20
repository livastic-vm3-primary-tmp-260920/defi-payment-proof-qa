/**
 * Buyer-owned, strictly offline *candidate* reconciliation of two crypto CSVs.
 * Structural audit only; this does NOT verify self-ownership, onchain transfer,
 * cost basis, legal/tax classification, funds received, settlement, or income.
 * No network access, upload, browser wallet, localStorage, seed or RPC.
 */
const MAX_CSV_BYTES=131072, MAX_ROWS=1000, MAX_COLS=32;
const DECIMALS=18n, SCALE=10n**DECIMALS;
const DEFAULT_WINDOW_MINUTES=90;
const HEADER_ALIASES={
  time:["timestamp","datetime","date","time","dateutc","timeutc","createdat","transactiondate","datetimeutc"],
  asset:["asset","currency","coin","token","symbol","assetname"],
  amount:["amount","quantity","quantitytransacted","amountsent","amountreceived","size"],
  hash:["txhash","transactionhash","txid","transactionid","hash","transaction_hash"],
  fee:["fee","networkfee","withdrawalfee","transactionfee"]
};
const iso=/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i;
function fail(why){throw new Error("Input check: "+why);}
function maxUtf8(value){return new TextEncoder().encode(value).byteLength;}
function normalHeader(value){return value.toLowerCase().replace(/[^a-z0-9]/g,"");}
function parseMoney(value){
  if(typeof value!=="string"|| !/^(?:0|[1-9]\d{0,22})(?:\.\d{1,18})?$/.test(value.trim()))return null;
  const [head,frac=""]=value.trim().split(".");
  const atomic=BigInt(head)*SCALE+BigInt(frac.padEnd(18,"0")||"0");
  return atomic>0n?atomic:null;
}
function parseFee(value){
  if(value==="")return 0n;
  if(typeof value!=="string"|| !/^(?:0|[1-9]\d{0,22})(?:\.\d{1,18})?$/.test(value.trim()))return null;
  const [head,frac=""]=value.trim().split(".");
  return BigInt(head)*SCALE+BigInt(frac.padEnd(18,"0")||"0");
}
function safeDate(value){
  if(!iso.test(value))return null;
  const date=Date.parse(value);
  return Number.isFinite(date)?date:null;
}
function formatUnits(x) {
 const a=x.toString().padStart(19,"0"),full=a.slice(0,-18),decimal=a.slice(-18).replace(/0+$/,"");
 return decimal?full+"."+decimal:full;
}
export function parseCsv(text){
 if(typeof text!=="string"||!text||maxUtf8(text)>MAX_CSV_BYTES)fail("Each CSV must contain 1–131072 UTF-8 bytes");
 let input=text.startsWith("\uFEFF")?text.slice(1):text;
 const rows=[], row=[];let buf="",quoted=false,line=1;
 function pushCell(){if(row.length>=MAX_COLS)fail("CSV exceeds 32 columns");row.push(buf);buf="";}
 function pushRow(){pushCell();if(row.some(x=>x.trim()!=="")){if(rows.length>MAX_ROWS+1)fail("CSV exceeds 1000 data rows");rows.push([...row]);}row.length=0;}
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'&&input[i+1]==='"'){buf+='"';i++;}
   else if(c==='"')quoted=false;
   else {buf+=c;if(c==="\n")line++;}
  }else if(c==='"'){
    if(buf!=="")fail("Unexpected quote in unquoted cell");
    quoted=true;
  }else if(c===","){pushCell();}
  else if(c==="\n"){pushRow();line++;}
  else if(c==="\r"&&input[i+1]==="\n"){pushRow();i++;line++;}
  else if(c==="\r"){pushRow();line++;}
  else buf+=c;
  if(buf.length>MAX_CSV_BYTES)fail("CSV cell exceeds size limit");
 }
 if(quoted)fail("CSV contains unclosed quote");
 if(row.length||buf!=="")pushRow();
 if(rows.length<2)fail("CSV must contain a header and at least one data row");
 if(rows.length>MAX_ROWS+1)fail("CSV exceeds 1000 data rows");
 const width=rows[0].length;
 if(rows.some(row=>row.length!==width))fail("CSV row-column count mismatch");
 return rows;
}
function selectColumn(head,aliases,required){
 const indices=head.map((v,i)=>aliases.includes(normalHeader(v))?i:null).filter(x=>x!==null);
 if(indices.length>1)fail("Ambiguous duplicate header mapping, edit your local CSV headers");
 if(required&&indices.length===0)fail("Missing required timestamp/asset/amount header");
 return indices[0]??null;
}
export function normalizedEvents(csv,kind){
 if(!["withdrawals","receipts"].includes(kind))fail("Expected explicit withdrawals or receipts CSV direction");
 const data=parseCsv(csv),header=data[0];
 const col={
  time:selectColumn(header,HEADER_ALIASES.time,true),
  asset:selectColumn(header,HEADER_ALIASES.asset,true),
  amount:selectColumn(header,HEADER_ALIASES.amount,true),
  hash:selectColumn(header,HEADER_ALIASES.hash,false),
  fee:selectColumn(header,HEADER_ALIASES.fee,false)
 };
 const seen=new Map(), events=[], issues=[];
 for(let i=1;i<data.length;i++){
  const rec=data[i],row=i+1;const ticker=rec[col.asset].trim().toUpperCase();
  const timestamp=safeDate(rec[col.time].trim());
  const amount=parseMoney(rec[col.amount].trim());
  const fee=col.fee!==null?parseFee(rec[col.fee].trim()):0n;
  const givenHash=col.hash!==null?rec[col.hash].trim().toLowerCase():"";
  const hash=/^0x[0-9a-f]{64}$/.test(givenHash)?givenHash:"";
  const invalid=[];
  if(!/^[A-Z0-9._-]{2,22}$/.test(ticker))invalid.push("ASSET_LABEL_UNSUPPORTED");
  if(timestamp===null)invalid.push("TIME_NEEDS_ISO_OFFSET");
  if(amount===null)invalid.push("AMOUNT_INVALID");
  if(fee===null||amount!==null&&fee!==null&&fee>amount)invalid.push("FEE_INVALID");
  if(givenHash&&!hash)invalid.push("HASH_FORMAT_UNSUPPORTED");
  if(invalid.length){
   issues.push({side:kind,row,codes:invalid});
   continue;
  }
  const key=[ticker,timestamp,amount.toString(),hash,fee.toString()].join("|");
  if(seen.has(key)){
   issues.push({side:kind,row,codes:["DUPLICATE_EXACT_ROW"],firstRow:seen.get(key)});
   continue;
  }
  seen.set(key,row);
  events.push({side:kind,row,asset:ticker,ms:timestamp,amount,fee,hash});
 }
 return {events,issues,inputRows:data.length-1,acceptedRows:events.length};
}
function optionsFor(w,r,minutes){
 if(w.asset!==r.asset)return null;
 if(w.hash&&r.hash&&w.hash!==r.hash)return null;
 const dt=Math.abs(w.ms-r.ms);
 const hashSame=!!w.hash&&w.hash===r.hash;
 if(!hashSame&&dt>minutes*60000)return null;
 const exact=w.amount===r.amount;
 const netAfterFee=w.fee>0n&&w.amount-w.fee===r.amount;
 if(!exact&&!netAfterFee){
  if(hashSame)return {kind:"AMOUNT_DISAGREEMENT",score:0,clockDifferenceMinutes:Math.round(dt/60000)};
  return null;
 }
 const kind=hashSame
  ?(exact?"HASH_AMOUNT_CANDIDATE":"HASH_FEE_ADJUSTED_REVIEW")
  :(exact?"TIME_AMOUNT_HEURISTIC":"TIME_FEE_HEURISTIC_REVIEW");
 return {kind,score:hashSame?(exact?4:3):(exact?2:1),clockDifferenceMinutes:Math.round(dt/60000)};
}
export function reconcilePairs(withdrawalsCsv,receiptsCsv,{windowMinutes=DEFAULT_WINDOW_MINUTES}={}){
 if(!Number.isSafeInteger(windowMinutes)||windowMinutes<1||windowMinutes>1440)fail("Match window must be 1 to 1440 minutes");
 const w=normalizedEvents(withdrawalsCsv,"withdrawals"),r=normalizedEvents(receiptsCsv,"receipts");
 const candidateMap=new Map(), reverseMap=new Map(), disagreements=[];
 for(const outgoing of w.events){
  const candidates=[];
  for(const incoming of r.events){
   const opt=optionsFor(outgoing,incoming,windowMinutes);
   if(!opt)continue;
   if(opt.kind==="AMOUNT_DISAGREEMENT"){
    disagreements.push({fromRow:outgoing.row,toRow:incoming.row,asset:outgoing.asset,issue:opt.kind});
   } else {
    candidates.push({fromRow:outgoing.row,toRow:incoming.row,asset:outgoing.asset,
      matchKind:opt.kind,clockDifferenceMinutes:opt.clockDifferenceMinutes,
      score:opt.score});
    const rev=reverseMap.get(incoming.row)||[];rev.push(outgoing.row);
    reverseMap.set(incoming.row,rev);
   }
  }
  candidateMap.set(outgoing.row,candidates);
 }
 const pairs=[],ambiguous=[],usedW=new Set(),usedR=new Set();
 for(const outgoing of w.events){
  const options=candidateMap.get(outgoing.row)||[];
  if(!options.length)continue;
  if(options.length>1||options.some(x=>(reverseMap.get(x.toRow)||[]).length!==1)){
   ambiguous.push({fromRow:outgoing.row,asset:outgoing.asset,
     competingReceiptRows:options.map(x=>x.toRow).sort((a,b)=>a-b),
     issue:"MULTIPLE_PLAUSIBLE_COUNTERPARTS_REVIEW"});
   continue;
  }
  const match=options[0];
  if(usedR.has(match.toRow))continue;
  usedW.add(outgoing.row);usedR.add(match.toRow);
  pairs.push({fromRow:match.fromRow,toRow:match.toRow,asset:match.asset,
    matchKind:match.matchKind,clockDifferenceMinutes:match.clockDifferenceMinutes,
    note:"DATA_MATCH_CANDIDATE_ONLY_NOT_EVIDENCE_OF_SAME_OWNER_OR_ONCHAIN_SETTLEMENT"});
 }
 return {
  reportType:"ORIGINAL_LOCAL_PRIVATE_CRYPTO_TRANSFER_CANDIDATES_NOT_TAX_ADVICE",
  input:{withdrawalRows:w.inputRows,receiptRows:r.inputRows,windowMinutes},
  counts:{candidatePairs:pairs.length,ambiguousOutgoingRows:ambiguous.length,
    unmatchedOutgoing:w.events.length-usedW.size,unmatchedIncoming:r.events.length-usedR.size,
    invalidOrDuplicateRows:w.issues.length+r.issues.length,amountDisagreements:disagreements.length},
  pairs,ambiguous,amountDisagreements:disagreements,
  unmatchedOutgoingRows:w.events.filter(x=>!usedW.has(x.row)).map(x=>x.row),
  unmatchedIncomingRows:r.events.filter(x=>!usedR.has(x.row)).map(x=>x.row),
  inputIssues:[...w.issues,...r.issues],
  limitations:[
   "No onchain verification, no address ownership or identity validation.",
   "A plausible send/receive data pair cannot be assumed to be your own non-taxable transfer.",
   "Fees, exchange internal IDs, multiple outputs, bridging, swaps, rounding, changing token denominations and missing sources can invalidate matches.",
   "No tax calculations, cost-basis carryover, legal classification, filing advice or guarantee.",
   "Do not use this report alone for account reconciliation, invoicing, payment finality or tax returns.",
   "All source rows stay in this browser; report contains CSV row numbers and issue codes, not raw wallet or customer data."
  ],
  countsOnly:true
 };
}
export const EXAMPLE_WITHDRAWALS="timestamp,asset,amount,txhash,fee\n2026-10-12T10:10:00Z,USDC,10.005,0x"+ "1".repeat(64) +",0.005\n2026-10-12T11:10:00Z,BTC,0.15,,0\n2026-10-12T12:10:00Z,USDC,20,,0";
export const EXAMPLE_RECEIPTS="timestamp,asset,amount,txhash\n2026-10-12T10:10:04Z,USDC,10,0x"+ "1".repeat(64)+"\n2026-10-12T11:12:00Z,BTC,0.15,\n2026-10-12T14:40:00Z,USDC,20,";
