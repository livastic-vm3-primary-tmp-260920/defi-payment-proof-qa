// Original VM3 browser-local Base USDC seller receipt ledger; no network, keys or wallet signing.
import { parseCsv, MAX_BYTES, MAX_DATA_ROWS } from "./csv-local-check.mjs";

export { MAX_BYTES, MAX_DATA_ROWS };
export const BASE_CHAIN = "8453";
export const BASE_CIRCLE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const REQUIRED_COLUMNS = Object.freeze([
  "chain_id","token_address","tx_hash","log_index","from","to","amount_usdc","delivery_status"
]);
export const SYNTHETIC_WALLET = "0x1111111111111111111111111111111111111111";
const fixture = (hash, log, from, to, amount, status, token=BASE_CIRCLE_USDC)=>
  ["8453",token,hash,log,from,to,amount,status].join(",");
export const SYNTHETIC_INPUT = [
  REQUIRED_COLUMNS.join(","),
  fixture("0x"+"a".repeat(64),"12","0x"+"2".repeat(40),SYNTHETIC_WALLET,"0.005","delivered"),
  fixture("0x"+"a".repeat(64),"12","0x"+"2".repeat(40),SYNTHETIC_WALLET,"0.005","delivered"),
  fixture("0x"+"b".repeat(64),"3","0x"+"3".repeat(40),SYNTHETIC_WALLET,"0.010","pending"),
  fixture("0x"+"c".repeat(64),"1","0x"+"4".repeat(40),"0x"+"5".repeat(40),"2.00","delivered"),
  fixture("0x"+"d".repeat(64),"1","0x"+"6".repeat(40),SYNTHETIC_WALLET,"200","delivered","0x"+"9".repeat(40)),
  fixture("0x"+"e".repeat(64),"5","0x"+"7".repeat(40),SYNTHETIC_WALLET,"1.000000","delivered"),
  fixture("0x"+"e".repeat(64),"5","0x"+"7".repeat(40),SYNTHETIC_WALLET,"1.500000","delivered")
].join("\r\n")+"\r\n";
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const TX_HASH=/^0x[0-9a-f]{64}$/i;
const LOG_INDEX=/^(?:0|[1-9][0-9]{0,8})$/;
const AMOUNT=/^(0|[1-9][0-9]{0,17})(?:\.([0-9]{1,6}))?$/;
const DELIVERY=new Set(["delivered","failed","partial","pending"]);
const AUDIT_NOTE="Untrusted CSV claims only. Not an on-chain verification, finality proof, settlement, wallet ownership, invoice approval or realized revenue.";
const normalizeAddress=(s)=>ADDRESS.test(String(s??"").trim())?String(s).trim().toLowerCase():null;
const normalizeHash=(s)=>TX_HASH.test(String(s??"").trim())?String(s).trim().toLowerCase():null;

function parseMicro(value){
  const m=AMOUNT.exec(String(value??"").trim());
  if(!m)return null;
  const micro=BigInt(m[1])*1000000n+BigInt((m[2]||"").padEnd(6,"0")||"0");
  return micro>0n?micro:null;
}
export function formatMicro(micro){
  if(typeof micro!=="bigint"||micro<0n)throw new TypeError("USDC micro amount must be a nonnegative bigint.");
  return (micro/1000000n).toString()+"."+String(micro%1000000n).padStart(6,"0");
}
function mapHeaders(headers){
  const normalized=headers.map(h=>h.trim().toLowerCase());
  if(!normalized.every(Boolean)||new Set(normalized).size!==normalized.length)
    throw new Error("Duplicate or empty CSV header. Unique field names required.");
  const missing=REQUIRED_COLUMNS.filter(h=>!normalized.includes(h));
  if(missing.length)throw new Error("Missing required columns: "+missing.join(", "));
  return Object.fromEntries(normalized.map((h,i)=>[h,i]));
}
function buildEntry(row,index,cols,wallet){
  const val=k=>String(row[cols[k]]??"").trim();
  const issues=[];
  if(row.length!==Object.keys(cols).length)issues.push("COLUMN_COUNT_MISMATCH");
  const chain=val("chain_id");
  if(chain!==BASE_CHAIN)issues.push("WRONG_CHAIN");
  const token=normalizeAddress(val("token_address"));
  if(token!==BASE_CIRCLE_USDC)issues.push("WRONG_ASSET");
  const tx=normalizeHash(val("tx_hash"));
  const log=val("log_index");
  if(!tx||!LOG_INDEX.test(log))issues.push("BAD_EVENT_ID");
  const from=normalizeAddress(val("from"));
  const to=normalizeAddress(val("to"));
  if(!from||!to)issues.push("INVALID_ADDRESS");
  if(to!==wallet)issues.push("WRONG_RECIPIENT");
  if(from&&to&&from===to)issues.push("SELF_TRANSFER");
  const micro=parseMicro(val("amount_usdc"));
  if(micro===null)issues.push("BAD_AMOUNT");
  const delivery=val("delivery_status").toLowerCase();
  if(!DELIVERY.has(delivery))issues.push("UNKNOWN_DELIVERY");
  else if(delivery!=="delivered")issues.push("NOT_DELIVERED");
  const eventKey=tx&&LOG_INDEX.test(log)?chain+":"+tx+":"+BigInt(log).toString():null;
  // Different order references on the same event are contradictory; do not
  // classify either row as a candidate payment.
  const order=cols.order_id===undefined?"":val("order_id");
  const fingerprint=JSON.stringify([chain,token,eventKey,from,to,micro===null?null:micro.toString(),delivery,order]);
  return { csvRecord:index+2,eventKey,amountUsdc:micro===null?null:formatMicro(micro),
    flags:issues,state:"review",_micro:micro,_fingerprint:fingerprint };
}
export function analyzeUsdcLedger(csvText,walletInput){
  const wallet=normalizeAddress(walletInput);
  if(!wallet)throw new Error("Enter a complete 0x-prefixed 40-byte receiving wallet address.");
  const csv=parseCsv(csvText);
  const columns=mapHeaders(csv[0]);
  const records=csv.slice(1).map((row,i)=>buildEntry(row,i,columns,wallet));
  const events=new Map();
  for(const record of records){
    if(record.eventKey){
      if(!events.has(record.eventKey))events.set(record.eventKey,[]);
      events.get(record.eventKey).push(record);
    }
  }
  let duplicates=0,conflicts=0;
  for(const group of events.values()){
    if(group.length===1)continue;
    if(new Set(group.map(x=>x._fingerprint)).size>1){
      conflicts++;
      for(const x of group)x.flags.push("CONFLICTING_EVENT");
    } else {
      duplicates+=group.length-1;
      for(const x of group.slice(1))x.flags.push("DUPLICATE_EVENT");
    }
  }
  let candidateMicro=0n, candidateRecords=0, reviewRecords=0;
  const counts={};
  for(const r of records){
    if(r.flags.length===0){
      r.state="candidate_unverified";
      candidateMicro+=r._micro;
      candidateRecords++;
    }else {
      r.state=r.flags.includes("CONFLICTING_EVENT")?"conflict":
        r.flags.includes("DUPLICATE_EVENT")?"duplicate":"review";
      reviewRecords++;
    }
    for(const issue of r.flags)counts[issue]=(counts[issue]||0)+1;
    delete r._micro;delete r._fingerprint;
    Object.freeze(r.flags);Object.freeze(r);
  }
  return {
    source:"User-supplied browser-local CSV",
    wallet, rowsRead:records.length, uniqueEventKeys:events.size,
    duplicateRecords:duplicates, conflictingEvents:conflicts,
    candidateRecords, reviewRecords, claimedCandidateUsdc:formatMicro(candidateMicro),
    verifiedOnchainUsdc:null,settledRevenueUsdc:null,
    limitations:AUDIT_NOTE,counts,records,
    issuesPreview:records.filter(r=>r.flags.length).slice(0,80).map(r=>({csvRecord:r.csvRecord,state:r.state,flags:r.flags})),
    issuesTruncated:reviewRecords>80,
    localOnly:true,networkRequests:0,paymentAuthorized:false,
  };
}
function quoteCsv(value){
  // All exported content is normalized or a fixed issue code. Escape defensively.
  const original=String(value??"");
  const safe=/^[\s]*[=+\-@]/.test(original)?"'"+original:original;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export function exportUsdcReviewCsv(report){
  if(!report||!Array.isArray(report.records))throw new TypeError("Missing local report.");
  const lines=["csv_record,event_key,claim_usdc,review_state,issues"];
  for(const r of report.records)
    lines.push([r.csvRecord,r.eventKey??"",r.amountUsdc??"",r.state,r.flags.join("|")].map(quoteCsv).join(","));
  return lines.join("\r\n")+"\r\n";
}
