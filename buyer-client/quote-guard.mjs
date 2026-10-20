// Public original VM5 terms. An independent buyer cannot be tricked
// into signing for an unexpected destination, chain, asset, amount or method.
export const RESOURCE = "https://vm5-openapi-x402.onrender.com/v1/csv-preflight";
export const PAYTO = "0x6b01efA0705E91a7aca54271510bf9e594717f34";
export const ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const AMOUNT_ATOMIC = "5000";
export const NETWORK = "eip155:8453";
const validAddr = x => typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x);

export function validateBuyerRequestURL(url, method) {
  if (url !== RESOURCE || method !== "POST")
    throw new Error("BLOCK: buyer destination or method changed");
  return true;
}
export function validatePaymentRequiredHeader(header, url = RESOURCE) {
  validateBuyerRequestURL(url, "POST");
  if (typeof header !== "string" || header.length < 12 || header.length > 24576 ||
      !/^[A-Za-z0-9_\-+=/]+$/.test(header))
    throw new Error("BLOCK: missing/malformed x402 payment header");
  let doc;
  try { doc = JSON.parse(Buffer.from(header, "base64url").toString("utf8")); }
  catch { throw new Error("BLOCK: invalid base64 JSON x402 quote"); }
  if (!doc || doc.x402Version !== 2 || !Array.isArray(doc.accepts) ||
      doc.accepts.length !== 1 || doc.resource?.url !== RESOURCE)
    throw new Error("BLOCK: x402 version, option count or resource changed");
  const x = doc.accepts[0];
  if (x.scheme !== "exact" || x.network !== NETWORK ||
      !validAddr(x.payTo) || x.payTo.toLowerCase() !== PAYTO.toLowerCase() ||
      !validAddr(x.asset) || x.asset.toLowerCase() !== ASSET.toLowerCase() ||
      String(x.amount) !== AMOUNT_ATOMIC)
    throw new Error("BLOCK: price, scheme, chain, token or recipient changed");
  return Object.freeze({
    endpoint:RESOURCE, scheme:x.scheme, network:NETWORK,
    asset:ASSET, payTo:PAYTO, amountAtomic:AMOUNT_ATOMIC,
    amountUSDC:"0.005000"
  });
}
export function parseArgs(argv) {
  const result={pay:false,file:null,expectedColumns:null,help:false};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==="--help" || a==="-h") result.help=true;
    else if(a==="--pay"){
      if(result.pay)throw new Error("Duplicate --pay");
      result.pay=true;
    }else if(a==="--file"){
      if(result.file || !argv[++i] || argv[i].startsWith("--"))throw new Error("--file requires path");
      result.file=argv[i];
    }else if(a==="--expected"){
      if(result.expectedColumns!==null || !argv[++i])throw new Error("--expected requires names");
      result.expectedColumns=argv[i].split(",").map(x=>x.trim());
      if(result.expectedColumns.length>40 || result.expectedColumns.some(x=>!x))
        throw new Error("Invalid expected columns");
    }else throw new Error("Unknown argument: use --help");
  }
  return result;
}
export function requireExplicitPaymentConfirmation(env){
  if(env.BUYER_CONFIRM_005_USDC_BASE_PAYMENT!=="YES_TO_ONE_005_USDC_CHARGE")
    throw new Error("BLOCK: buyer confirmation missing; no signature or charge");
  const k=env.BUYER_DEDICATED_EVM_PRIVATE_KEY;
  if(typeof k!=="string" || !/^0x[0-9a-fA-F]{64}$/.test(k))
    throw new Error("BLOCK: dedicated buyer signer missing");
  return k;
}
