"""Offline, data-minimizing x402 HTTP 402 challenge analyzer; no network or signer.

Buyer-provided PUBLIC status and response quote only. No signatures, tokens, private keys,
payment submission or actual settlement verification. Reference: x402 Foundation HTTP v2.
"""
from __future__ import annotations
import base64
import json
import re
from typing import Any

BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
_ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
_CHAIN = re.compile(r"(?:eip155:[0-9]{1,12}|solana:[A-Za-z0-9]{1,100})\Z")
_AMOUNT = re.compile(r"(?:0|[1-9][0-9]{0,38})\Z")
_FORBIDDEN = ("authorization", "payment-signature", "x-payment", "x-api-key",
              "api-key", "cookie", "set-cookie", "private-key", "seed", "token")
_SENSITIVE_VALUES = re.compile(r"(?i)(?:bearer\s+[a-z0-9._-]{10,}|"
                               r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
                               r"\b(?:sk|ghp|gho)_[A-Za-z0-9_-]{14,})")
_MAX_FIELDS = 35

class InvalidPublicInput(ValueError):
    pass

def _is_sensitive_key(key: str) -> bool:
    x = key.lower().replace("_", "-")
    return any(s in x for s in _FORBIDDEN)

def _ensure_unsecret(obj: Any, depth: int = 0) -> None:
    if depth > 7:
        raise InvalidPublicInput("nested payload exceeds safe public-depth bound")
    if isinstance(obj, dict):
        if len(obj) > 100:
            raise InvalidPublicInput("too many public object fields")
        for k, v in obj.items():
            if not isinstance(k, str) or _is_sensitive_key(k):
                raise InvalidPublicInput("sensitive or invalid field key in public input")
            _ensure_unsecret(v, depth + 1)
    elif isinstance(obj, list):
        if len(obj) > 100:
            raise InvalidPublicInput("too many public items")
        for v in obj:
            _ensure_unsecret(v, depth + 1)
    elif isinstance(obj, str):
        if len(obj) > 8000 or _SENSITIVE_VALUES.search(obj):
            raise InvalidPublicInput("private or oversized value not accepted")
    elif obj is not None and type(obj) not in (int, float, bool):
        raise InvalidPublicInput("unsupported public value")

def _decode_quote(header: str) -> dict:
    if not isinstance(header, str) or len(header) > 12000:
        raise InvalidPublicInput("oversized payment-required header")
    try:
        b = base64.b64decode(header.strip(), validate=True)
        if not 0 < len(b) <= 8000:
            raise InvalidPublicInput("decoded payment-required header too large")
        p = json.loads(b)
    except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise InvalidPublicInput("PAYMENT-REQUIRED is not valid base64 JSON") from exc
    if not isinstance(p, dict):
        raise InvalidPublicInput("PAYMENT-REQUIRED must decode to an object")
    _ensure_unsecret(p)
    return p

def analyze(status: int, response_headers: dict, public_body: dict | None = None,
            claimed_native_base_usdc: bool = False) -> dict:
    """Return bounded evidence findings. This is NOT an actual paid wallet receipt."""
    if type(status) is not int or status < 100 or status > 599:
        raise InvalidPublicInput("invalid HTTP status")
    if not isinstance(response_headers, dict) or len(response_headers) > _MAX_FIELDS:
        raise InvalidPublicInput("expected bounded public response headers")
    if public_body is not None and not isinstance(public_body, dict):
        raise InvalidPublicInput("public_body must be a JSON object or null")
    # First reject accidental credential leakage. Never echo headers or original body.
    _ensure_unsecret(response_headers)
    if public_body is not None:
        _ensure_unsecret(public_body)
    headers = {k.lower(): v for k,v in response_headers.items()}
    if len(headers) != len(response_headers):
        raise InvalidPublicInput("duplicate case-insensitive header names")
    findings, options = [], []
    if status != 402:
        findings.append("Expected 402 for unpaid protected resource; received different HTTP status.")
    raw = headers.get("payment-required")
    if raw is not None:
        try:
            quote = _decode_quote(raw)
        except InvalidPublicInput as e:
            quote = None
            findings.append(str(e))
    else:
        quote = public_body if isinstance(public_body, dict) else None
        if quote is None:
            findings.append("Missing PAYMENT-REQUIRED quote header and valid public JSON body.")
    version = quote.get("x402Version") if isinstance(quote, dict) else None
    if quote is not None:
        if version == 2:
            if raw is None:
                findings.append("x402 v2 canonical transport expects base64 PAYMENT-REQUIRED response header.")
            resource = quote.get("resource")
            if not isinstance(resource, dict) or not isinstance(resource.get("url"), str) or not resource["url"].startswith("https://"):
                findings.append("Missing/invalid HTTPS resource.url in v2 quote.")
        elif version == 1:
            findings.append("Legacy x402 v1 challenge; use v1-aware client and do not assume v2 header semantics.")
        else:
            findings.append("Invalid or unsupported x402Version in payment challenge.")
        accepts = quote.get("accepts")
        if not isinstance(accepts, list) or not 1 <= len(accepts) <= 12:
            findings.append("Expected 1..12 accepted payment methods.")
            accepts = []
        for i, a in enumerate(accepts):
            if not isinstance(a, dict):
                findings.append(f"Option {i}: not a payment method object.")
                continue
            scheme = a.get("scheme")
            network = a.get("network")
            amount = a.get("amount") if version == 2 else a.get("maxAmountRequired")
            asset = a.get("asset")
            payto = a.get("payTo")
            f = []
            if not isinstance(scheme, str) or not scheme:
                f.append("missing scheme")
            if not isinstance(network, str) or (version == 2 and not _CHAIN.fullmatch(network)):
                f.append("invalid CAIP-2 network" if version == 2 else "missing network")
            if not isinstance(amount,str) or not _AMOUNT.fullmatch(amount) or amount=="0":
                f.append("invalid positive integer atomic amount")
            if not isinstance(asset, str) or not asset:
                f.append("missing asset")
            if not isinstance(payto, str) or (isinstance(network,str) and network.startswith("eip155:") and not _ADDRESS.fullmatch(payto)):
                f.append("missing or malformed recipient address")
            t=a.get("maxTimeoutSeconds")
            if version == 2 and (type(t) is not int or t <= 0):
                f.append("invalid maxTimeoutSeconds")
            if claimed_native_base_usdc and network == "eip155:8453" and isinstance(asset,str) and asset.lower()!=BASE_USDC:
                f.append("asset mismatch with canonical Base native Circle USDC")
            if claimed_native_base_usdc and network != "eip155:8453":
                f.append("client expects Base mainnet but quote uses a different network")
            if f:
                findings.append(f"Option {i}: "+", ".join(f)+".")
            options.append({"option":i,"scheme_valid":isinstance(scheme,str) and bool(scheme),
                            "network": network if isinstance(network,str) and len(network)<110 else "unknown",
                            "atomic_amount_valid":isinstance(amount,str) and bool(_AMOUNT.fullmatch(amount)) and amount!="0",
                            "recipient_shape_valid":isinstance(payto,str) and (not isinstance(network,str) or not network.startswith("eip155:") or bool(_ADDRESS.fullmatch(payto))),
                            "static_issues":len(f)})
    return {
        "classification":"OFFLINE_X402_QUOTE_SHAPE_CHECK_ONLY",
        "status_code":status,"protocol_version":version if type(version) is int else None,
        "accepted_option_count":len(options),"options":options,
        "findings":findings[:24],"finding_count":len(findings),
        "next_read_only_step":"Compare server's actual unpaid 402 and canonical quote with client's selected scheme/network/asset; independently verify settlement via authorized chain explorer only if needed.",
        "revenue_claim":"NO_LIVE_PAYMENT_OR_SETTLEMENT_VERIFIED",
        "funding_activity":"NONE",
    }

if __name__ == "__main__":
    import argparse, sys
    ap=argparse.ArgumentParser(description="x402 public challenge preflight, offline only")
    ap.add_argument("source_file", help="JSON file {status, response_headers, public_body?, claimed_native_base_usdc?}")
    a=ap.parse_args()
    obj=json.load(open(a.source_file,encoding="utf-8"))
    print(json.dumps(analyze(obj["status"],obj["response_headers"],obj.get("public_body"),
                             obj.get("claimed_native_base_usdc",False)),indent=2))
