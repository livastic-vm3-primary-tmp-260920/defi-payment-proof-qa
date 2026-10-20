// Original VM3 buyer problem / willingness-to-pay survey: browser-local email draft only.
// Does not send mail, collect payments, use network, store data or touch wallets.
export const FEEDBACK_EMAIL="onecursor1@gmail.com";
export const ROLES=Object.freeze([
  "x402 service seller",
  "DeFi / crypto merchant",
  "Buyer-side agent operator",
  "Wallet or payments developer",
  "Other crypto user",
]);
export const PROBLEMS=Object.freeze([
  "Browser CORS or unreadable HTTP 402 quote",
  "USDC paid but delivery not confirmed",
  "Duplicate/conflicting transfer receipts",
  "Wrong network, token or recipient",
  "Payout/settlement CSV data quality",
  "Other issue",
]);
export const FREQUENCIES=Object.freeze([
  "Not yet — researching",
  "Once in the past 30 days",
  "2 to 10 times in the past 30 days",
  "More than 10 times in the past 30 days",
]);
export const BUDGETS=Object.freeze([
  "Free advice only",
  "0.005 USDC per basic API report",
  "0.75 to 2.50 USDC per focused analysis",
  "5 to 19 USDC per fixed-scope QA",
  "20+ USDC for a defined deliverable",
  "Need a working example before pricing",
]);
const privateText=/(?:0x)?[0-9a-f]{64}/i;
const secretWords=/\b(?:seed phrase|private key|password|access token|api token|api key|recovery phrase)\b/i;

export function feedbackEmailUrl(input){
  if(!input || typeof input!=="object")throw new TypeError("Select role, problem, frequency and value first.");
  const selected={};
  for(const [name,options] of [
    ["role",ROLES],["problem",PROBLEMS],["frequency",FREQUENCIES],["budget",BUDGETS]
  ]){
    const value=input[name];
    if(typeof value!=="string"||!options.includes(value))
      throw new Error("Select a valid "+name+" option.");
    selected[name]=value;
  }
  const details=String(input.details??"").trim();
  if(details.length>280)throw new Error("Keep your optional context under 281 characters.");
  if(privateText.test(details)||secretWords.test(details))
    throw new Error("Remove any keys, transaction hashes, secrets or recovery phrases. Use generic descriptions.");
  const subject="One Cursor: real x402 / Base USDC buyer feedback";
  const lines=[
    "Optional independent buyer feedback; not an order, payment or verified customer endorsement.",
    "Role: "+selected.role,
    "Actual problem: "+selected.problem,
    "Frequency over 30 days: "+selected.frequency,
    "Approximate willingness to pay, if the problem is solved: "+selected.budget,
    "Optional context (no transaction identifiers or secrets): "+(details||"(none)"),
    "",
    "I choose whether to send this email from my own mail app. A price choice is not a purchase.",
  ];
  const value="mailto:"+FEEDBACK_EMAIL+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(lines.join("\n"));
  if(value.length>2000)throw new Error("Feedback draft would exceed the safe email URI limit.");
  return value;
}
