import {createWalletClient, custom} from "viem";
import {base} from "viem/chains";
import {x402Client} from "@x402/core/client";
import {registerExactEvmScheme} from "@x402/evm/exact/client";
import {wrapFetchWithPayment} from "@x402/fetch";
import {
  RESOURCE,PAYTO,ASSET,PRICE,NETWORK,validateCsv,requestBody,checkQuote,
  guardOutgoing,allowedBrowserTransportHeaders,makeInjectedBuyerSigner
} from "./guards.mjs";

/**
 * Original buyer-owned, EXPLICIT opt-in browser purchase.
 * No merchant keys or wallet seeds in page. Never auto-connects or auto-pays.
 * An independent real buyer signs on their own wallet *only after explicit clicks*.
 * The seller's original VM5 route processes the payment; this page is not a merchant.
 */
const byId=id=>document.getElementById(id);
const status=byId("status");
const result=byId("result");
const csv=byId("csv");
const agree=byId("data-consent");
const authorize=byId("pay-consent");
const quoteBtn=byId("quote-button");
const connectBtn=byId("connect-button");
const payBtn=byId("pay-button");
const exportBtn=byId("export-button");
const synthetic=["email,amount,date,note","synthetic@example.invalid,12.5,2026-10-20,paid","synthetic@example.invalid,12.5,2026-10-20,paid","fixture@example.invalid,not-a-number,2026-13-99,=1+1"].join("\n");
let current=null,account=null,provider=null,purchaseAttempted=false,downloadText=null;

function say(message,state="info"){
 status.textContent=message;status.dataset.state=state;
}
function redactError(e){
 const str=String(e?.message||"");
 if(str.startsWith("BLOCK:"))return str;
 if(/user rejected|rejected request|user denied|4001/i.test(str))return "Your wallet refused the request. No completed purchase was confirmed.";
 return "The payment or provider flow did not complete. Before retrying, independently inspect your wallet and service settlement status.";
}
function refresh(){
 connectBtn.disabled=!current||purchaseAttempted;
 payBtn.disabled=!current||purchaseAttempted||!account||!authorize.checked||!agree.checked||csv.value!==current.csv;
}
for(const node of [agree,authorize,csv])node.addEventListener("input",refresh);
byId("example-button").addEventListener("click",()=>{
 if(purchaseAttempted)return;
 csv.value=synthetic;
 say("Invented example loaded locally. Check the data-authorization box before requesting an unpaid quote.");
 current=null;result.textContent="";refresh();
});
byId("reset-button").addEventListener("click",()=>{
 csv.value="";agree.checked=false;authorize.checked=false;current=null;downloadText=null;account=null;provider=null;
 result.textContent="";exportBtn.disabled=true;
 say(purchaseAttempted?"Input cleared. This page cannot initiate a second payment; check your wallet before reloading.":"All local form input cleared. No wallet or payment request was made.");
 refresh();
});
quoteBtn.addEventListener("click",async()=>{
 if(purchaseAttempted){say("One payment was attempted in this tab. Reload only after independently checking settlement.","warn");return;}
 current=null;refresh();result.textContent="";
 if(!agree.checked){say("Confirm that you own and authorize sending this non-confidential CSV to the VM5 API.","warn");return;}
 let data;
 try{data=requestBody(csv.value);}catch(e){say(redactError(e),"warn");return;}
 quoteBtn.disabled=true;say("Requesting one unpaid quote from the existing VM5 service; this does not sign or pay.");
 try{
  const resp=await fetch(RESOURCE,{method:"POST",mode:"cors",credentials:"omit",redirect:"error",cache:"no-store",
    headers:{"Content-Type":"application/json","Accept":"application/json"},body:data,signal:AbortSignal.timeout(15000)});
  if(resp.status!==402)throw new Error("BLOCK: Expected HTTP 402, but the service returned HTTP "+resp.status);
  const terms=checkQuote(resp.headers.get("PAYMENT-REQUIRED"));
  current={body:data,csv:csv.value,terms,obtainedAt:Date.now()};
  result.textContent="Verified unsigned quote: "+PRICE+" native Circle Base USDC (5000 atomic units)\nNetwork: "+NETWORK+"\nUSDC token: "+ASSET+"\nMerchant pay-to: "+PAYTO+"\nResource: "+RESOURCE+"\n\nOnly an independent consenting wallet owner can authorize one payment; this is not a receipt.";
  say("Verified fixed-price unsigned quote. No payment or wallet connection yet.","ok");
 }catch(e){say(redactError(e),"warn");}
 finally{quoteBtn.disabled=false;refresh();}
});
connectBtn.addEventListener("click",async()=>{
 if(!current||purchaseAttempted)return;
 try{
  const injected=window.ethereum;
  if(!injected||typeof injected.request!=="function")throw new Error("BLOCK: No supported injected EIP-1193 wallet. Use a standard Base-compatible wallet or the CLI guide.");
  const chain=await injected.request({method:"eth_chainId"});
  if(chain!=="0x2105")throw new Error("BLOCK: Select Base mainnet (8453) in your wallet manually. This page does not switch networks.");
  const accounts=await injected.request({method:"eth_requestAccounts"});
  const address=accounts?.[0];
  if(typeof address!=="string"||!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error("BLOCK: Connected EVM address invalid");
  provider=injected;account=address;
  byId("wallet-display").textContent="Buyer wallet: "+address+". No authorization or payment made.";
  say("Buyer wallet connected on Base. Read the displayed merchant amount and destination. Only the separate purchase click can request a signature.","ok");
 }catch(e){account=null;provider=null;say(redactError(e),"warn");}
 finally{refresh();}
});
payBtn.addEventListener("click",async()=>{
 if(!current||!account||!provider||purchaseAttempted||!agree.checked||!authorize.checked||csv.value!==current.csv){
  say("Payment prerequisites not met. Preview a quote, verify your wallet and explicitly confirm exactly 0.005 Base USDC.","warn");return;
 }
 if(Date.now()-current.obtainedAt>180000){current=null;refresh();say("Quote too old. Request a fresh unpaid quote before buying.","warn");return;}
 if(!window.confirm("This is a REAL one-time 0.005 Base USDC charge from YOUR connected wallet to the disclosed seller. Continue to your wallet's authorization prompt?"))return;
 purchaseAttempted=true;refresh();connectBtn.disabled=true;quoteBtn.disabled=true;exportBtn.disabled=true;downloadText=null;
 say("One buyer-requested mainnet payment authorization may be requested. Never approve a changed amount, token, chain or payee.");
 let signatureCount=0,networkCount=0;
 try{
  const signer=makeInjectedBuyerSigner({provider,address:account,signTypedData:async details=>{
   const w=createWalletClient({account,chain:base,transport:custom(provider)});
   return await w.signTypedData({account,domain:details.domain,types:details.types,primaryType:details.primaryType,message:details.message});
  }});
  const client=new x402Client();
  registerExactEvmScheme(client,{signer,networks:[NETWORK]});
  const exactBody=current.body;
  async function strictlyAllowlistedFetch(input,init={}){
   await guardOutgoing(input,init,exactBody);
   networkCount++;
   if(networkCount>2)throw new Error("BLOCK: Unexpected repeat paid API call");
   const headers=new Headers(input instanceof Request ? input.headers : init.headers);
   const isSigned=headers.has("PAYMENT-SIGNATURE");
   if(isSigned){
    if(networkCount!==2||signatureCount||signer.getSignCount()!==1)throw new Error("BLOCK: Unexpected signed retry");
    signatureCount=1;
   }else if(networkCount!==1)throw new Error("BLOCK: Missing authorization on the second request");
   const safeHeaders=allowedBrowserTransportHeaders(input,init);
   const resp=await fetch(input,{...init,headers:safeHeaders,mode:"cors",credentials:"omit",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(25000)});
   if(resp.status===402)checkQuote(resp.headers.get("PAYMENT-REQUIRED"));
   return resp;
  }
  const paidFetch=wrapFetchWithPayment(strictlyAllowlistedFetch,client);
  const reply=await paidFetch(RESOURCE,{method:"POST",redirect:"error",
   headers:{"Content-Type":"application/json","Accept":"application/json"},body:exactBody});
  if(!reply.ok)throw new Error("Service returned HTTP "+reply.status);
  const json=await reply.json();
  if(!json||typeof json!=="object"||Array.isArray(json))throw new Error("Invalid paid report format");
  // Buyer owns this report. Never log their CSV or payment authorization.
  downloadText=JSON.stringify({kind:"BUYER_API_DELIVERY_NOT_BLOCKCHAIN_FINALITY",retrievedAt:new Date().toISOString(),report:json},null,2);
  result.textContent="Merchant returned an HTTP 200 report after a wallet-authorized request. This alone is not an independently finalized blockchain receipt. Check your wallet history before another purchase.\nReport ready: use Download my result.";
  exportBtn.disabled=false;say("API returned a report. Blockchain settlement/finality is not independently verified by this page.","ok");
 }catch(e){
  result.textContent="No report was confirmed by this interface. If a wallet signature was submitted, the payment may have settled; independently check the exact recipient and your wallet's Base USDC transfer history BEFORE repeating any payment.";
  say(redactError(e),"warn");
 }
});
exportBtn.addEventListener("click",()=>{
 if(!downloadText)return;
 const u=URL.createObjectURL(new Blob([downloadText],{type:"application/json;charset=utf-8"}));
 const a=document.createElement("a");a.href=u;a.download="buyer-owned-csv-preflight-report.json";a.click();
 URL.revokeObjectURL(u);
});
refresh();
