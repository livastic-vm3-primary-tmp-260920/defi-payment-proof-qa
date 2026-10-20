# Original one-owner CSV x402v2 buyer integration

Original, disclosed AI-assisted VM3 public integration helper for the *existing*
same-owner VM5 paid CSV preflight. No new merchant, operator persona or wallet.

Buyer-paid route:
https://vm5-openapi-x402.onrender.com/v1/csv-preflight

Price: exactly **0.005000 native Circle USDC on Base (eip155:8453)** per
independently authorized paid POST. Input: JSON csvText string, optional
expectedColumns, 32 KiB UTF-8, 500 data rows/40 columns maximum.

## 60-second safe setup

The default needs **no wallet**, signs **nothing**, moves no funds, and
verifies the original merchant's exact network, chain token, payTo, amount,
resource and x402 v2 payment scheme before showing the offer.

    cd buyer-client
    npm ci --ignore-scripts --no-audit
    npm test
    node csv-buyer.mjs
    node csv-buyer.mjs --file ./your-owned-input.csv --expected email,amount

Do not send personal or client confidential data without authorization.
The default demonstration uses invented .invalid email addresses.

## Optional paid call BY A GENUINE EXTERNAL BUYER ONLY

Use Node 22+, an independent dedicated low-balance buyer-controlled EVM
account, actual native Circle USDC on Base, and explicit consent to spend
0.005 USDC. **NEVER use the merchant owner's VM1 MetaMask, business funds,
seed phrase or production signer.** Keep credentials off GitHub, chat, logs,
and backups shared with other people. The key is used by the client's OWN
machine in memory, never transferred to the vendor.

In your local shell set these variables separately (do not place them in
Git-tracked .env files or publish a real value):

    export BUYER_DEDICATED_EVM_PRIVATE_KEY="<buyer-only low-value 0x key>"
    export BUYER_CONFIRM_005_USDC_BASE_PAYMENT="YES_TO_ONE_005_USDC_CHARGE"
    node csv-buyer.mjs --pay --file ./your-owned-input.csv
    unset BUYER_DEDICATED_EVM_PRIVATE_KEY BUYER_CONFIRM_005_USDC_BASE_PAYMENT

The optional --pay path uses pinned @x402 v2 and viem SDKs. The code checks
the quote twice and restricts the target to the exact original HTTPS POST.
A changed chain, USDC token, price above 0.005, receiver address, method,
scheme, option count or remote endpoint will **STOP without signing**.
There is no automatic loop/retry of paid requests.

**HTTP 200 does not prove irreversible wallet finality.** Independently
inspect the genuine buyer's own Base USDC ERC20 receipt/settlement details.
The actual external API result belongs to the buyer; code never logs their
CSV, their private key, signed payment payload or full report.

The separate /v1/csv-report is an original paid GET on a STATIC synthetic
CSV, not a result for your uploaded CSV. This helper strictly handles POST
on /v1/csv-preflight. Heuristic validation (duplicates, row shape,
formula-like cells) is NOT data truth, GDPR compliance, a security audit, or
investment advice.

All source in this integration is original with a permissive MIT intent,
provided as-is; customers should independently review the payment software
before submitting a buyer-owned transaction. This project's development
and testing spent **zero real USDC** and used no live wallet signatures.
