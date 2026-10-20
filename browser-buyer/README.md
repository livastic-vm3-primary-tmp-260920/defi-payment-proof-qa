# Browser-optional, real-buyer-only CSV x402 checkout (original v0.1.0 beta)

This website gives a user-visible path from a free unsigned x402 v2 HTTP402 quote for the ORIGINAL same-owner VM5 hosted POST CSV preflight to a separate, explicit **single** 0.005 native Base Circle USDC authorization by an independent EIP-1193 wallet owner. It does not generate/hold wallet keys, automatically buy anything, promise onchain finality, or operate a new merchant endpoint.

**[Live deployed buyer page](https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/guides/csv-browser-x402-checkout.html)** and **[existing 0.005 USDC merchant offer](https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/guides/csv-structural-preflight-005-base-usdc.html)**.

## Reproducible offline validation

```bash
cd browser-buyer
npm ci --include=dev --ignore-scripts --no-audit
npm test
npm run build
```

Exact upstream packages pinned: official `@x402/core`, `@x402/evm`, `@x402/fetch` 2.28.0 and `viem` 2.57.7, `esbuild` 0.28.2. Browser code bundles to `../assets/csv-x402-checkout.bundle.js` under the same origin. No third-party script CDN, analytics, file upload to another service, private key input or signing by developer.

Offline tests simulate the real upstream x402 client receiving HTTP 402, one fake EIP-712 signature from an injected wallet adapter, and one mocked paid HTTP 200 POST response. They also demonstrate that price, token, payee, network, EIP-712 payload and request tampering STOP before a wallet signature. **Not independently tested with a funded production buyer wallet, wallet-hardware combinations, third-party facilitator settlement, or a paid report in the wild. No actual new owner income is asserted.**

Before the unpaid quote, a user confirms they have permission to submit the CSV. The CSV *is sent* to the existing hosted merchant during the quote POST, and may be subject to the merchant hosting provider's logging. No CSV is retained in this static site's localStorage, and no buyer private key ever goes to the seller.

Before a paid flow, the buyer explicitly authorizes one fixed merchant quote, connects their own Base browser wallet manually, ticks the separate payment consent box and confirms an additional explicit human/browser purchase prompt. The page never switches chains on the user's behalf, never automatically replays a transaction, and disables repeat payment after the first attempt. Buyers must inspect the wallet EIP-712 authorization before signing. If the server errors *after* a signature, independently check settlement before ever retrying.

This tool is standalone BUYER frontend to one existing seller; no new operator MetaMask key, separate legal entity, third-party vendor, prepaid merchant account or settlement credential is created.
