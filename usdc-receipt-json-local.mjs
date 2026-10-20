// Local-only converter for user-pasted eth_getTransactionReceipt JSON on Base.
// It does not fetch a receipt, authenticate it, verify network provenance,
// check confirmations, check ownership or claim successful offchain delivery.
import { BASE_CIRCLE_USDC, formatMicro, MAX_BYTES } from "./usdc-ledger-local.mjs";

export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const RECEIPT_JSON_MAX_BYTES = 102400;
const TX=/^0x[0-9a-f]{64}$/i;
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const INDEX=/^0x[0-9a-f]+$/i;
const BIGINT=/^0x[0-9a-f]{64}$/i;
const TOPIC_ADDR=/^0x0{24}[0-9a-f]{40}$/i;
const MAX_LOGS=500;
const UTF8=new TextEncoder();
const HEADERS=[
  "chain_id", "token_address", "tx_hash", "log_index",
  "from", "to", "amount_usdc", "delivery_status",
];

function fail(message){
  throw new Error(message);
}
function normalizeTx(v,name="transactionHash"){
  if(typeof v!=="string"||!TX.test(v))fail("Invalid or missing "+name+" in pasted receipt.");
  return v.toLowerCase();
}
function parseIndex(v){
  if(typeof v!=="string"||!INDEX.test(v))fail("Invalid receipt logIndex: require hexadecimal 0x value.");
  const n=BigInt(v);
  if(n>999999999n)fail("Receipt logIndex exceeds supported 999999999 limit.");
  return n.toString();
}
function extractAddress(topic,name){
  if(typeof topic!=="string"||!TOPIC_ADDR.test(topic))
    fail("Malformed USDC Transfer "+name+" topic; expected zero-padded 32-byte indexed address.");
  const v="0x"+topic.slice(-40).toLowerCase();
  if(!ADDRESS.test(v))fail("Invalid Transfer address.");
  return v;
}
function receiptSource(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))
    fail("Receipt JSON must be a JSON object with eth_getTransactionReceipt fields.");
  const receipt=Object.hasOwn(obj,"result")?obj.result:obj;
  if(!receipt||typeof receipt!=="object"||Array.isArray(receipt))
    fail("Missing eth_getTransactionReceipt result object.");
  return receipt;
}
export function parseBaseUsdcReceiptToCsv(raw){
  if(typeof raw!=="string")throw new TypeError("Provide the receipt as JSON text.");
  if(UTF8.encode(raw).length>RECEIPT_JSON_MAX_BYTES)
    fail("Receipt JSON exceeds 100 KiB size safety limit.");
  let decoded;
  try{decoded=JSON.parse(raw);}
  catch{fail("Invalid pasted receipt JSON.");}
  const receipt=receiptSource(decoded);
  const hash=normalizeTx(receipt.transactionHash);
  if(receipt.status!==1&&receipt.status!=="0x1")
    fail("Receipt status is not a successful 0x1 claim; no Transfer import allowed.");
  normalizeTx(receipt.blockHash,"blockHash");
  if(typeof receipt.blockNumber!=="string"||!INDEX.test(receipt.blockNumber)||BigInt(receipt.blockNumber)===0n)
    fail("Missing or invalid mined receipt blockNumber.");
  if(receipt.chainId!==undefined){
    let chain;
    try{
      chain=typeof receipt.chainId==="number"?BigInt(receipt.chainId):BigInt(receipt.chainId);
    }catch{fail("Invalid Base chain hint in supplied receipt.");}
    if(chain!==8453n)fail("Supplied chain ID does not match Base 8453.");
  }
  if(!Array.isArray(receipt.logs))
    fail("Missing receipt logs array.");
  if(receipt.logs.length>MAX_LOGS)
    fail("Receipt logs exceed the 500-log safety limit.");
  let skipped=0,removed=0;
  const rows=[];
  for(const entry of receipt.logs){
    if(!entry||typeof entry!=="object"||Array.isArray(entry)){
      fail("Malformed receipt log object.");
    }
    if(entry.removed===true){removed++;continue;}
    const contract=typeof entry.address==="string"?entry.address.toLowerCase():"";
    if(contract!==BASE_CIRCLE_USDC){skipped++;continue;}
    const topics=entry.topics;
    if(!Array.isArray(topics)||!topics.length||typeof topics[0]!=="string"){
      fail("Malformed USDC log topics array.");
    }
    if(topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC){skipped++;continue;}
    if(topics.length!==3)fail("USDC Transfer must contain exactly 3 indexed topics.");
    if(entry.transactionHash!==undefined && normalizeTx(entry.transactionHash)!==hash)
      fail("Receipt Transfer transaction hash mismatch.");
    const from=extractAddress(topics[1],"from");
    const to=extractAddress(topics[2],"to");
    if(typeof entry.data!=="string"||!BIGINT.test(entry.data))
      fail("Invalid USDC Transfer data; expected a 32-byte hexadecimal uint256.");
    const logIndex=parseIndex(entry.logIndex);
    const micro=BigInt(entry.data);
    rows.push(["8453",BASE_CIRCLE_USDC,hash,logIndex,from,to,formatMicro(micro),"unknown"]);
  }
  if(!rows.length)fail("No non-removed, canonical Base USDC Transfer events in supplied receipt.");
  const csv=[HEADERS.join(","),...rows.map(r=>r.join(","))].join("\r\n")+"\r\n";
  if(UTF8.encode(csv).length>MAX_BYTES)
    fail("Generated CSV would exceed the original 32 KiB tool input limit.");
  return Object.freeze({
    csv,
    rowsImported:rows.length,
    nonUsdcOrNonTransferLogsSkipped:skipped,
    removedLogsSkipped:removed,
    deliveryState:"unknown",
    chainVerified:false,
    settlementVerified:false,
    networkRequests:0,
    paymentAuthorized:false,
    caveat:"Input is a user-supplied JSON claim; it does not verify Base network, receipt authenticity, confirmations, settlement, customer payment or delivery. Every output row is marked unknown delivery.",
  });
}
