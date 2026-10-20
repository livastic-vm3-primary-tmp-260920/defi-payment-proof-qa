/**
 * Original strict browser-side x402 buyer boundary for the same-owner VM5 merchant.
 * Quote inspection does not pay. Only an explicitly user-approved click may ever
 * obtain a wallet signature; code never handles secret/recovery phrase/private key.
 */
export const RESOURCE="https://vm5-openapi-x402.onrender.com/v1/csv-preflight";
export const PAYTO="0x6b01efA0705E91a7aca54271510bf9e594717f34";
export const ASSET="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const NETWORK="eip155:8453";
export const CHAIN_ID=8453;
export const ATOMIC_PRICE="5000";
export const PRICE="0.005000";
export const MAX_CSV_BYTES=32768;
export const MAX_COLS=40;
const addr=x=>typeof x==="string"&&/^0x[0-9a-fA-F]{40}$/.test(x);
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
function deny(reason){throw new Error("BLOCK: "+reason);}
function fromBase64(text){
 if(typeof text!=="string"||text.length<12||text.length>24576||!/^[a-zA-Z0-9+/_=-]+$/.test(text))deny("Missing or invalid unsigned payment quote");
 const x=text.replace(/-/g,"+").replace(/_/g,"/").replace(/=+$/,"");
 if(x.length%4===1)deny("Bad quote encoding");
 let data;
 try{
  const raw=atob(x+"=".repeat((4-x.length%4)%4));
  if(raw.length>32768)deny("Oversized quote");
  data=new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from(raw,c=>c.charCodeAt(0)));
 }catch{deny("Unparseable unsigned quote");}
 try{return JSON.parse(data)}catch{deny("Unparseable quote JSON");}
}
export function checkQuote(header) {
 const doc=fromBase64(header);
 if(!doc||typeof doc!=="object"||Array.isArray(doc)||
    doc.x402Version!==2||doc.resource?.url!==RESOURCE||
    !Array.isArray(doc.accepts)||doc.accepts.length!==1)deny("Wrong x402 v2 format or resource");
 const a=doc.accepts[0];
 if(!a||typeof a!=="object"||a.scheme!=="exact"||a.network!==NETWORK||a.amount!==ATOMIC_PRICE||
    !addr(a.asset)||!same(a.asset,ASSET)||!addr(a.payTo)||!same(a.payTo,PAYTO)||
    !Number.isInteger(a.maxTimeoutSeconds)||a.maxTimeoutSeconds<1||a.maxTimeoutSeconds>300 ||
    a.extra?.name!=="USD Coin"||a.extra?.version!=="2"||
    (a.extra?.assetTransferMethod&&a.extra.assetTransferMethod!=="eip3009")){
      deny("Merchant changed amount, receiver, token, network, timeout or authorization method");
 }
 return Object.freeze({resource:RESOURCE,amountUsdc:PRICE,amountAtomic:ATOMIC_PRICE,network:NETWORK,asset:ASSET,payTo:PAYTO,
   maxTimeoutSeconds:a.maxTimeoutSeconds,confirmedPayment:false});
}
export function validateCsv(csv) {
 if(typeof csv!=="string"||!csv.trim()||csv.includes("\0"))deny("CSV cannot be empty or binary");
 const bytes=new TextEncoder().encode(csv).byteLength;
 if(bytes>MAX_CSV_BYTES)deny("CSV exceeds 32 KiB");
 return bytes;
}
export function requestBody(csv) {
 validateCsv(csv);
 return JSON.stringify({csvText:csv});
}
export async function guardOutgoing(input,init={},exactBody) {
 const isRequest=typeof Request!=="undefined"&&input instanceof Request;
 const url=typeof input==="string"?input:input instanceof URL?input.toString():input?.url;
 const method=(init?.method??input?.method??"GET").toUpperCase();
 if(url!==RESOURCE||method!=="POST")deny("Request target or method changed");
 // @x402/fetch forwards fresh Request instances, not the original init.
 // Read a CLONE so the real POST body remains available for the merchant.
 let outgoing;
 if(isRequest){outgoing=await input.clone().text();}
 else {outgoing=init?.body;}
 if(outgoing!==exactBody)deny("Buyer CSV body changed");
 const redirect=init?.redirect??input?.redirect;
 if(redirect && redirect!=="error")deny("Refuse endpoint redirects");
 return true;
}
function bigintValue(x){try{return BigInt(x)}catch{return null}}
export function guardTypedData(p,connectedAddress,nowSeconds=Math.floor(Date.now()/1000)){
 if(!addr(connectedAddress))deny("Buyer wallet address invalid");
 if(!p||p.primaryType!=="TransferWithAuthorization"||
    p.domain?.name!=="USD Coin"||p.domain?.version!=="2"||
    bigintValue(p.domain?.chainId)!==8453n||!same(p.domain?.verifyingContract,ASSET))deny("Signing domain changed");
 const t=p.types?.TransferWithAuthorization;
 const expected=[["from","address"],["to","address"],["value","uint256"],["validAfter","uint256"],["validBefore","uint256"],["nonce","bytes32"]];
 if(!Array.isArray(t)||t.length!==expected.length||
    expected.some(([name,type],i)=>t[i]?.name!==name||t[i]?.type!==type))deny("Unexpected typed-data schema");
 const m=p.message;
 if(!m||!same(m.from,connectedAddress)||!same(m.to,PAYTO)||
    bigintValue(m.value)!==5000n||bigintValue(m.validAfter)!==0n||
    typeof m.nonce!=="string"||!/^0x[0-9a-f]{64}$/i.test(m.nonce))deny("Signer authorization details modified");
 const deadline=bigintValue(m.validBefore);
 const now=BigInt(nowSeconds);
 if(deadline===null||deadline<=now||deadline>now+3600n)deny("Payment authorization expiration invalid");
 return true;
}
/**
 * The v2 fetch SDK incorrectly injects Access-Control-Expose-Headers as a
 * REQUEST header (it is designed as a RESPONSE header). VM5's CORS allowlist
 * intentionally excludes it, so delete that one unnecessary request header.
 * Never remove or modify the actual PAYMENT-SIGNATURE authorization.
 */
export function allowedBrowserTransportHeaders(input,init={}) {
 const headers=new Headers(input instanceof Request ? input.headers : init.headers);
 headers.delete("Access-Control-Expose-Headers");
 return headers;
}
export function makeInjectedBuyerSigner({provider,address,signTypedData}) {
 if(!provider||typeof provider.request!=="function"||typeof signTypedData!=="function"||!addr(address))deny("No valid injected buyer wallet");
 let signed=0;
 return Object.freeze({
  address,
  async signTypedData(p){
   if(signed!==0)deny("One authorization signature per explicitly approved purchase");
   guardTypedData(p,address);
   const chain=await provider.request({method:"eth_chainId"});
   if(chain!=="0x2105"&&chain!=="0x2105".toUpperCase())deny("Select Base network manually; this checkout will never switch chains");
   signed++;
   return await signTypedData(p);
  },
  getSignCount(){return signed}
 });
}
