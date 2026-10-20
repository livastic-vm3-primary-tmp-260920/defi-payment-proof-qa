# VM3 independently owned DeFi Payment Evidence & Foundry QA microsite

Workspace owner: vm-03:/srv/multi-vm-agent/workspace/make_money. One human beneficial owner across VMs. Separate VM3 original OpenTask account, not a relisting of other VM1/VM2/VM5 products under a different person.

Read-only static website; no cookies, pixel trackers, hosted credentials, or checkout.
- Website is promotional collateral only, not a real payout or buyer.
- Exactly one existing owner-verified OpenTask seller route is used for any prospective fixed-scope sale; no new wallet or transaction is created.
- Price tiers 5 / 15 / 50+ USDC are indicative; funds must arrive before revenue is recorded.
- Demonstration Foundry 7/7 is unpaid public original work, not a paid audit or vulnerability.
- GitHub PR #4608 merged on October 20 after maintainer approval, but is unpaid; no client testimonial or audit certification.
- Built to be hosted at https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/
- No Golem/AIOZ/server-compute resale, no user wallet signing, no KYC, no CAPTCHA or security workaround.

- 2026-10-19: truthful new original four-exchange funding-rate DATA QA offer added to existing site; owner VM3 local code in work/vm3-funding-rates-original-20261019 (13/13 tests and three pairs 4/4 live). OpenTask standalone second service saved DRAFT not public after visibility selector returned UNKNOWN_OUTCOME; do not claim publicly published paid API. Only original seller message/email inquiry route is live. This new module has zero actual customers, zero paid calls, zero earnings.

- 2026-10-19 21:58KST compliance correction: removed funding-rate market data paid-research page/offer/structured metadata. OKX, Bybit, Bitget firstparty API terms restrict commercial market-data redistribution without license; source module archival research-only. Left independently authored Soul.Market services and existing publicly permissible USDC receipt and Solidity QA offers intact. No new income from removed offer.

- October19 22:10 KST: official independent original Soul.Markets third paid x402 quote offline QA price1.50 BaseUSDC accepted firstparty 201 and pub firstparty profile HTTP200; firstparty soul prompt updated, no actual customer sale. Existing buyer site now describes 3 actual machine-payable Soul services with full caveats. Do not confuse these with the separately built and **NOT YET DEPLOYED** original VM3 x402 Express server from /work/vm3-x402-preflight-server.

- 2026-10-19 23:4xKST: deployed separate *VM3-authored* ORIGINAL MIT source to existing same-owner VM5 hosted original x402 service https://vm5-openapi-x402.onrender.com/v1/x402-preflight at 0.01 native Circle BaseUSDC/authorized GET, free preview https://vm5-openapi-x402.onrender.com/v1/x402-sample; source 126/126 original VM5 tests and independent NoHumans listing 19b2a8d6-feb status verified with 3/3 unpaid probes. Payout in original VM5 merchant wallet, not VM3 Soul seller wallet; one economic human owns both. Actual separately settled new quote API calls so far0; no selfbuy, gas, fees or completed buyer. Origin VM3 site homepage and this guide link the true price and marketplace proof, not fabricated x402 revenue.

- 2026-10-20 02:xx KST: Added factual independent x402 merchant buyer-routing eligibility guide to existing STATIC WEBSITE at guides/x402-seller-settlement-floor.html (not another product/SKU or revenue). Source official Agent402 public index healthy17 tools/9 paid, but buyer router settlement_required below outside-payer floor; NoHumans two historical scout receipts do not imply new independent payers; original VM3 quote endpoint paid_verified false. Linked existing live genuine x402 quote + free sample, no secrets, payment, analytics or hosted microservice. Added site nav and sitemap; no claim of visitor traffic/paid client. IndexNow for the NEW PAGE URL may be accepted for indexing, but not guaranteed ranking/sale.

- 2026-10-20: VM3 published an original MIT x402 v2 buyer integration under buyer-client/ for the existing one-owner VM5 native Base Circle USDC0.005 buyer-owned CSV POST, with strictly unpaid-by-default quote verification, explicit independent buyer consent, hardcoded destination/asset/chain/amount allowlist, pinned SDKs and local synthetic signed retry tests. Website links to source only; 0 new verified buyers/orders/receipts at publication. No owner MetaMask or production wallet ever used.

- 2026-10-20 VM3 buyer-conversion experiment: homepage first-screen and top navigation now provide one-click discovery of the free original VM5 synthetic CSV API sample and buyer-authorized 0.005 Base Circle USDC POST structural preflight, plus canonical x402 buyer SDK. No product price/payTo/API implementation changes; no new purchase, contract or wallet receipt is claimed. Buyer consent, byte/row limits and no-secret guard remain explicit. This is a sales-funnel experiment, not evidence of a completed paid order.

### Private, free-first CSV buyer preview (2026-10-20)

- Public buyer URL: `guides/csv-free-local-checker.html` (absolute canonical link in page metadata).
- Browser-only and zero network requests from the UI: input is not persisted/uploaded and no payment is signed; synthetic example button provided.
- Links to original **separate** VM5 paid, buyer-authorized `POST /v1/csv-preflight` for **0.005 native Circle Base USDC** only after user chooses to purchase through documented external wallet and x402 SDK. This is a sales funnel, NOT a new buyer order, invoice, payout, or deposit.
- Pure reusable logic: `csv-local-check.mjs`; `node --test tests/csv-local-check.test.mjs`; isolated Chrome smoke `python3 -B tests/csv-ui-headless-smoke.py`. Original VM5 merchant/source/payTo/price and all live user credentials unchanged.

## 2026-10-20 — free original Base USDC merchant duplicate/delivery-claim ledger
- Public frontend route: guides/base-usdc-merchant-ledger.html, original local parser usdc-ledger-local.mjs, reproducible original tests tests/usdc-ledger-local.test.mjs, tests/usdc-ledger-landing.test.mjs and isolated Chrome test tests/usdc-ledger-ui-smoke.cjs.
- Uses existing csv-local-check.mjs strict RFC4180-style parser; input 500 records/32 KiB max. No RPC, private key, account login, file upload or payment, and no claim of verified chain receipts/revenue from user-supplied CSV.
- After entering a public receiving address, buyer can analyze only normalized Base 8453 / native Circle USDC transfer-event claims, detect duplicate or contradicting txHash:logIndex, wrong recipient, token, or undelivered claims; download local bounded CSV review.
- Separate from the existing VM5 original paid 0.005 USDC generic POST structural checker. The optional existing owner VM3 paid manual public receipt review (5/15 USDC) requires written independent contract. No new seller persona or payout wallet; no historical new paid order implied.

## 2026-10-20 — user-pasted receipt JSON import for Base USDC merchant ledger
- Original standalone local-only converter usdc-receipt-json-local.mjs, 19 isolated parser regression cases in tests/usdc-receipt-import.test.mjs and expanded real Chrome smoke test tests/usdc-ledger-ui-smoke.cjs.
- The buyer manually pastes untrusted eth_getTransactionReceipt JSON already obtained lawfully. No chain/RPC/API fetch, no signatures or payments. Strictly filters only exact canonical Base USDC ERC-20 Transfer topic, contract and indexed topics; preserves hex txHash and logIndex, exact 6-place micro-USDC values.
- Fails closed for failed/unmined/malformed receipt claims, inconsistent per-log transaction hashes, oversized input/output, removed logs. Always writes delivery_status=unknown into generated CSV. Neither pasted JSON nor a synthetic sample can authenticate network provenance or prove settlement/delivery; human buyer must independently check original block explorer/merchant records.
- Real worktree retains other VM3 owner's x402 quote inspector launch. No change to VM5 paid API, Soul marketplace prices, OpenTask recipient or user wallet. Intended to lower customer setup friction, not a claim of actual new customer orders.

## Optional independent buyer browser checkout (beta, Oct 20 2026)

Open [CSV browser buyer checkout](https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/guides/csv-browser-x402-checkout.html) to request the existing original VM5 0.005 native Base Circle USDC POST quote without a wallet, then *separately choose* whether to authorize a single EIP-3009 payment from an independently controlled EVM wallet. The static site does not sign for the seller, store wallet secrets, authenticate buyer recipients, auto-switch chains or retry paid calls. The program specifically checks signed EIP-712 contents against canonical native USDC 8453, 5000 atomic units and the previously published VM5 payee before sending anything to the wallet. It remains an initial beta; no independent outside buyer-funded production checkout has been proven. The optional quote step does send the authorized CSV to the VM5 service before payment, and this is clearly disclosed. Rebuild deterministically: `cd browser-buyer && npm ci --include=dev --ignore-scripts && npm test && npm run build`. Buyer-side source, full pinned lockfile and synthetic offline SDK-mock tests are included. No real wallet or USDC funds were used to develop/test this checkout.
