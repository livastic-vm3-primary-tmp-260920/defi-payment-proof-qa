/* Original public-payment pre-signature *quote* inspector.
 * Offline structural checks only: never authenticates merchant, signs, pays,
 * contacts a wallet, confirms a blockchain transaction or certifies safety.
 * Safe to run on arbitrary pasted untrusted JSON: no eval, HTML or dynamic URL requests.
 */
export const BASE_NETWORK = "eip155:8453";
export const BASE_NATIVE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const LIVE_EXAMPLE_ENDPOINT = "https://vm5-openapi-x402.onrender.com/v1/csv-report";
export const INPUT_CHAR_LIMIT = 32768;
const MAX_ENTRIES = 16;
const MAX_BYTES = 32768;

function fail(message) { throw new Error(message); }
function isObject(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function strictAsciiB64(value) {
  if (!/^[a-zA-Z0-9+/_=-]+$/.test(value)) fail("Not a Base64 PAYMENT-REQUIRED header");
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (b64.length % 4 === 1) fail("Invalid Base64 length");
  let bytes;
  try {
    const bin = atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
    if (bin.length > MAX_BYTES) fail("Decoded quote is too large");
    bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return new TextDecoder("utf-8", {fatal:true}).decode(bytes);
  } catch (error) {
    if (error?.message === "Decoded quote is too large") throw error;
    fail("Invalid Base64 or UTF-8 payment header");
  }
}
export function decodeQuote(input) {
  if (typeof input !== "string" || !input.trim()) fail("Paste a PAYMENT-REQUIRED header or x402 quote JSON");
  if (input.length > INPUT_CHAR_LIMIT) fail("Quote input too large (32,768 characters)");
  const trimmed = input.trim();
  let raw = trimmed;
  if (!trimmed.startsWith("{")) {
    const match = /^payment-required\s*:\s*(\S+)\s*$/i.exec(trimmed);
    raw = strictAsciiB64(match ? match[1] : trimmed);
  }
  if (new TextEncoder().encode(raw).length > MAX_BYTES) fail("Decoded quote exceeds 32 KiB");
  let payload;
  try { payload = JSON.parse(raw); } catch { fail("Payment quote is not valid JSON"); }
  if (!isObject(payload)) fail("x402 quote must be a JSON object");
  if (payload.x402Version !== 2 && payload.x402Version !== 1) fail("Expected x402 version 1 or 2");
  if (!Array.isArray(payload.accepts) || payload.accepts.length < 1 || payload.accepts.length > MAX_ENTRIES) {
    fail("Quote must contain 1 to 16 accepted payment methods");
  }
  if (!payload.accepts.every(isObject)) fail("Payment acceptance entries must be objects");
  return payload;
}
function stringValue(value, limit=300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function parseAtomic(value) {
  if (typeof value !== "string" || !/^[0-9]{1,50}$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}
function units(value) {
  const x = value.toString().padStart(7, "0");
  return x.slice(0, -6) + "." + x.slice(-6);
}
export function parseMaxUsdc(s) {
  if (s === "" || s === null || s === undefined) return null;
  if (typeof s !== "string" || !/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/.test(s.trim())) {
    fail("Expected maximum price must be a decimal with at most six digits");
  }
  const [int, frac=""] = s.trim().split(".");
  return BigInt(int) * 1000000n + BigInt(frac.padEnd(6, "0") || "0");
}
function sourceResource(payload,entry) {
  const value = payload.resource ?? entry.resource;
  return stringValue(isObject(value) ? value.url : value, 500);
}
function issue(type, code, message) { return {type, code, message}; }
export function inspectQuote(input, expected={}) {
  const payload = decodeQuote(input);
  const expectedPayTo = stringValue(expected.payTo, 100);
  if (expectedPayTo && !/^0x[0-9a-f]{40}$/i.test(expectedPayTo)) {
    fail("Expected recipient must be a complete 20-byte EVM address");
  }
  const expectedResource = stringValue(expected.resourceUrl, 600);
  if (expectedResource && !/^https:\/\/[^\s?#]+(?:\?[^\s#]*)?$/i.test(expectedResource)) {
    fail("Expected resource must be an exact HTTPS URL");
  }
  const ceiling = parseMaxUsdc(expected.maxUsdc ?? "");
  const entries = payload.accepts.map((entry,index) => {
    const scheme = stringValue(entry.scheme, 90);
    const network = stringValue(entry.network, 130);
    const asset = stringValue(entry.asset, 130);
    const payTo = stringValue(entry.payTo, 130);
    const resource = sourceResource(payload, entry);
    const raw = entry.amount ?? entry.maxAmountRequired;
    const amount = parseAtomic(raw);
    const isBase = network === BASE_NETWORK;
    const isCanonicalBaseUsdc = isBase && asset.toLowerCase() === BASE_NATIVE_USDC;
    const problems = [];
    if (scheme !== "exact") problems.push(issue("review","SCHEME_NOT_EXACT","Unknown payment scheme; this tool only interprets exact payments."));
    if (!isBase) problems.push(issue("review","NON_BASE_NETWORK","Not canonical Base mainnet (eip155:8453). Do not assume six decimals or settlement rail."));
    if (isBase && !isCanonicalBaseUsdc) problems.push(issue("review","NON_CANONICAL_USDC","Asset does not match the native Circle USDC contract on Base."));
    if (amount === null) problems.push(issue("review","AMOUNT_INVALID","Quote amount must be a nonnegative integer string in atomic units."));
    else if (amount === 0n) problems.push(issue("review","ZERO_AMOUNT","Quote requests zero atomic units; check if this is intended."));
    if (!/^0x[0-9a-f]{40}$/i.test(payTo) || /^0x0{40}$/i.test(payTo)) {
      problems.push(issue("review","RECIPIENT_INVALID","Recipient is missing, zero, or not a full EVM address."));
    }
    if (expectedPayTo && payTo.toLowerCase() !== expectedPayTo.toLowerCase()) {
      problems.push(issue("mismatch","RECIPIENT_MISMATCH","Pay-to address differs from the recipient you expected."));
    }
    if (!/^https:\/\//i.test(resource)) {
      problems.push(issue("review","RESOURCE_NOT_HTTPS","Resource URL missing or not HTTPS; verify service URL independently."));
    }
    if (expectedResource && resource !== expectedResource) {
      problems.push(issue("mismatch","RESOURCE_MISMATCH","Quoted resource URL differs from the endpoint you expected."));
    }
    const timeout = entry.maxTimeoutSeconds;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 3600) {
      problems.push(issue("review","TIMEOUT_UNUSUAL","Payment timeout absent or outside a typical 1–3600-second range."));
    }
    if (ceiling !== null && isCanonicalBaseUsdc && amount !== null && amount > ceiling) {
      problems.push(issue("mismatch","PRICE_ABOVE_MAX","Price exceeds your explicit maximum Base USDC price."));
    }
    return {
      index: index + 1, scheme, network, asset, payTo, resource,
      atomicAmount: typeof raw === "string" ? raw.slice(0, 52) : "",
      displayPrice: isCanonicalBaseUsdc && amount !== null ? units(amount) + " Base USDC" : "Decimals/asset not independently established",
      isCanonicalBaseUsdc, issues:problems
    };
  });
  return {
    x402Version:payload.x402Version,
    entries,
    hasMismatch:entries.some(x=>x.issues.some(i=>i.type==="mismatch")),
    hasReview:entries.some(x=>x.issues.length),
    warning:"UNAUTHENTICATED QUOTE TEXT: parsing does not prove merchant identity, recipient ownership, token safety, finality, or prior delivery. Never paste private keys, payment signatures or login tokens.",
    noPayment:true,
    noWalletConnection:true
  };
}
