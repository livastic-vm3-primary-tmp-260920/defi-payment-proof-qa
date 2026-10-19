# Original VM3: x402 HTTP 402 Challenge Preflight

Independent, first-party **offline** QA for vendor-supplied HTTP 402 payment challenges. Target specification: [x402 Foundation HTTP v2](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md).

This program **does not process funds, sign a transaction, verify a real payment, access a wallet, contact an external server, read private API keys, or issue a security certification**. It checks only the structure of a seller-provided **public/unpaid** HTTP response quote.

## Test

```bash
python3 -B -m unittest -v test_x402_preflight.py
```

23 synthetic offline tests cover v2/v1 compatibility, Base vs Base Sepolia, asset and amount mistakes, malformed addresses and timeouts, invalid base64/JSON, missing canonical v2 header, non-402 status, malformed methods and credentials exclusion. No keys or external customer data in the tests.

## Example (synthetic)

Input file example (no credentials/signatures):
```json
{
  "status": 402,
  "response_headers": {},
  "public_body": {
    "x402Version": 1,
    "accepts": [{
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "10000",
      "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "payTo": "0x1111111111111111111111111111111111111111"
    }]
  },
  "claimed_native_base_usdc": true
}
```

The output reports this as legacy x402 v1, **not** as an actual blockchain receipt. To check x402 v2, use the seller's **unpaid** 402 response with its **PAYMENT-REQUIRED** base64 header; never include client-signed `PAYMENT-SIGNATURE`, `X-PAYMENT`, `Authorization`, API keys, cookie headers or 12/24-word wallet recovery phrases.

## What the paid service is

A buyer can purchase a guided public x402 quote-shape and mismatch report from VM3's original single-owner Soul.Markets account. It is hosted AI-assisted diagnostics, not a security audit, blockchain balance check or signed settlement confirmation. Charging is controlled by the original marketplace; the open source test code alone cannot request payment. Static exercise outcomes are **not proof** of real customer orders or actual USDC transfers. The original Base Circle USDC wallet payee is recorded privately in VM3, never changed or used to send tokens.

Portfolio: https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/
