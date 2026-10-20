// Original VM3 x402 browser CORS diagnostic — pure local checks, no fetch/wallet.
const LIMIT_TEXT=48000;
const DENY_HOST=/(?:^localhost$|\.localhost$|\.local$|\.internal$|\.test$|\.invalid$|\.example$|\.onion$)/i;
const BAD_QUERY=/(?:^|[&;])(?:[^=&]*(?:api[_-]?key|secret|token|password|session|signature|auth(?:orization)?|access[_-]?key|private|otp)[^=&]*)=/i;
const EXPECTED_EXPOSE=["payment-required","payment-response"];
const EXPECTED_ALLOW=["payment-signature","content-type"];

export function validateProbeUrl(input){
  if(typeof input!=="string"||input.length>650)throw new Error("Provide a short public HTTPS endpoint URL.");
  let uri;
  try{uri=new URL(input.trim());}catch{throw new Error("Enter a complete public HTTPS URL.");}
  if(uri.protocol!=="https:"||!uri.hostname||!uri.hostname.includes("."))
    throw new Error("Only a public https:// domain is permitted.");
  if(uri.username||uri.password||uri.hash||uri.port)
    throw new Error("Remove credentials, fragments and nonstandard ports before probing.");
  const host=uri.hostname.toLowerCase();
  if(DENY_HOST.test(host)||host.startsWith("[")||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host))
    throw new Error("Local, reserved, private and IP-literal hosts are not supported.");
  if(BAD_QUERY.test(uri.search.slice(1)))
    throw new Error("Remove URL query parameters that may contain keys, tokens or signatures.");
  return uri.toString();
}
export function validateBrowserOrigin(input){
  if(typeof input!=="string"||input.length>260)throw new Error("Enter one browser Origin.");
  let uri;
  try{uri=new URL(input);}catch{throw new Error("Invalid browser Origin.");}
  if(!["https:","http:"].includes(uri.protocol)||uri.username||uri.password||
     uri.search||uri.hash||uri.pathname!=="/")
    throw new Error("Origin must be a plain scheme://hostname with optional port.");
  if(uri.protocol==="http:"&& !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(uri.hostname))
    throw new Error("Non-local browser origins must use HTTPS.");
  return uri.origin;
}
function tokenize(v){
  return new Set(String(v||"").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean));
}
function parseHttpHeaders(raw){
  if(typeof raw!=="string"||raw.length>LIMIT_TEXT)throw new Error("Header transcript limit: 48,000 characters.");
  const input=raw.replace(/\r\n/g,"\n").trim();
  if(!input)throw new Error("Paste a public HTTP response header transcript.");
  const lines=input.split("\n");
  const headerStarts=lines.flatMap((l,i)=>/^HTTP\/[\d.]+\s+(\d{3})(?:\s|$)/i.test(l)?[i]:[]);
  if(!headerStarts.length)throw new Error("Expected a public HTTP status line, such as HTTP/2 402.");
  const index=headerStarts[headerStarts.length-1];
  const status=Number(/^HTTP\/[\d.]+\s+(\d{3})/i.exec(lines[index])[1]);
  const headers=Object.create(null);
  for(const line of lines.slice(index+1)){
    if(!line.trim())break;
    if(/^\s/.test(line))throw new Error("Folded or continued HTTP headers cannot be verified.");
    const colon=line.indexOf(":");
    if(colon<=0||! /^[A-Za-z0-9-]+$/.test(line.slice(0,colon)))
      throw new Error("Malformed HTTP header line.");
    const key=line.slice(0,colon).toLowerCase();
    const value=line.slice(colon+1).trim();
    if(key==="set-cookie"||key==="cookie"||key==="authorization"||key==="payment-signature"){
      continue; // Never use or display a buyer credential.
    }
    if(Object.hasOwn(headers,key))
      headers[key]+=", "+value;
    else headers[key]=value;
  }
  return {status,headers};
}
function originAllowed(raw,origin){
  return raw==="*"||raw===origin;
}
export function diagnoseCorsHeaders({challengeText,optionsText,origin,paidMethod="POST"}){
  const allowedOrigin=validateBrowserOrigin(origin);
  if(!["GET","POST"].includes(paidMethod))throw new Error("Select GET or POST paid method.");
  const chall=parseHttpHeaders(challengeText);
  const opt=optionsText?.trim()?parseHttpHeaders(optionsText):null;
  const errors=[],warnings=[],passes=[];
  const h=chall.headers;
  const allowed=originAllowed(h["access-control-allow-origin"],allowedOrigin);
  if(!allowed)errors.push("CHALLENGE_ORIGIN_NOT_ALLOWED");
  else passes.push("CHALLENGE_ORIGIN_ALLOWED");
  const expose=tokenize(h["access-control-expose-headers"]);
  const priceExposed=expose.has("payment-required")||expose.has("*");
  if(!priceExposed)errors.push("PRICE_HEADER_NOT_EXPOSED");
  else passes.push("PRICE_EXPOSURE_DECLARED");
  if(!h["payment-required"])errors.push("PRICE_HEADER_NOT_PRESENT");
  else passes.push("PRICE_HEADER_PRESENT");
  if(chall.status!==402)warnings.push("NOT_HTTP_402_CHALLENGE");
  if(!expose.has("payment-response")&&!expose.has("*"))
    warnings.push("SETTLEMENT_RESPONSE_NOT_EXPOSED");
  if(expose.has("*"))warnings.push("WILDCARD_EXPOSE_ONLY_WORKS_WITHOUT_CREDENTIALS");
  let preflight=null;
  if(opt){
    const ph=opt.headers;
    const is2xx=opt.status>=200&&opt.status<300;
    const method=tokenize(ph["access-control-allow-methods"]);
    const allowH=tokenize(ph["access-control-allow-headers"]);
    const needs=["payment-signature","content-type"];
    const preflightAllowed=originAllowed(ph["access-control-allow-origin"],allowedOrigin);
    if(!is2xx)errors.push("PREFLIGHT_NOT_2XX");
    if(!preflightAllowed)errors.push("PREFLIGHT_ORIGIN_NOT_ALLOWED");
    if(!method.has(paidMethod.toLowerCase())&&!method.has("*"))
      errors.push("PAID_METHOD_NOT_ALLOWED");
    for(const field of needs)if(!allowH.has(field)&&!allowH.has("*"))
      errors.push(field==="content-type"?"CONTENT_TYPE_NOT_ALLOWED":"PAYMENT_SIGNATURE_NOT_ALLOWED");
    if(!ph["access-control-max-age"])warnings.push("PREFLIGHT_CACHE_NOT_ADVERTISED");
    if(allowH.has("*"))warnings.push("WILDCARD_REQUEST_HEADERS_REQUIRE_CREDENTIALS_OFF");
    preflight={
      status:opt.status,method:paidMethod,
      allowOrigin:preflightAllowed,allowMethod:method.has(paidMethod.toLowerCase())||method.has("*"),
      allowContentType:allowH.has("content-type")||allowH.has("*"),
      allowPaymentSignature:allowH.has("payment-signature")||allowH.has("*"),
    };
  }else warnings.push("NO_OPTIONS_TRANSCRIPT");
  return {
    kind:"user-pasted_public_headers_not_network_authentication",
    origin:allowedOrigin,method:paidMethod,challengeStatus:chall.status,
    challengeOriginAllowed:allowed,headerPresent:!!h["payment-required"],
    priceHeaderExposed:priceExposed,
    browserReadabilityDeclared:allowed&&priceExposed&&!!h["payment-required"]&&chall.status===402,
    preflight,errors,warnings,passes,
    independentlyVerified:false,paymentAuthorized:false,walletConnected:false,
  };
}
export function summarizeLiveBrowserResult({status,headerValue}){
  if(!Number.isInteger(status)||status<100||status>599)throw new TypeError("Unexpected HTTP status.");
  const value=typeof headerValue==="string"?headerValue:"";
  const present=value.length>0;
  const messages=[];
  if(status!==402)messages.push("NOT_HTTP_402");
  if(status===402&&!present)messages.push("PRICE_HEADER_NOT_BROWSER_READABLE_OR_ABSENT");
  if(status===402&&present)messages.push("UNPAID_402_PRICE_HEADER_BROWSER_READABLE");
  return {
    status,headerReadable:present,quoteByteLength:present?value.length:0,
    messages,paid:false,chainVerified:false,merchantTrusted:false,deliveryVerified:false,
  };
}
