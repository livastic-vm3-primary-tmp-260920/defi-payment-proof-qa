"""Fully offline synthetic regression tests; no funds, network, or credentials."""
import base64
import copy
import json
import unittest
from x402_preflight import analyze, InvalidPublicInput, BASE_USDC

RECIPIENT="0x"+"1"*40
GOOD={
 "x402Version":2,
 "resource":{"url":"https://example.test/paid","description":"public data"},
 "accepts":[{"scheme":"exact","network":"eip155:8453","amount":"10000",
             "asset":BASE_USDC,"payTo":RECIPIENT,"maxTimeoutSeconds":60}]
}

def e(x):return base64.b64encode(json.dumps(x).encode()).decode("ascii")
def call(quote=None, **kwargs):
 return analyze(402,{"PAYMENT-REQUIRED":e(GOOD if quote is None else quote)},**kwargs)

class TestQuote(unittest.TestCase):
 def test_good_v2(self):
  r=call(claimed_native_base_usdc=True)
  self.assertEqual(r["finding_count"],0)
  self.assertEqual(r["protocol_version"],2)
  self.assertEqual(r["funding_activity"],"NONE")
  self.assertEqual(r["revenue_claim"],"NO_LIVE_PAYMENT_OR_SETTLEMENT_VERIFIED")

 def test_case_insensitive_header(self):
  self.assertEqual(analyze(402,{"payment-required":e(GOOD)})["finding_count"],0)

 def test_missing_header(self):
  self.assertTrue(any("Missing" in f for f in analyze(402,{})["findings"]))

 def test_wrong_status_even_valid_quote(self):
  self.assertTrue(any("different HTTP status" in f for f in analyze(200,{"payment-required":e(GOOD)})["findings"]))

 def test_valid_legacy_v1(self):
  q={"x402Version":1,"accepts":[{"scheme":"exact","network":"base","maxAmountRequired":"1000","asset":BASE_USDC,"payTo":RECIPIENT}]}
  r=analyze(402,{},q)
  self.assertEqual(r["protocol_version"],1)
  self.assertEqual(r["accepted_option_count"],1)
  self.assertTrue(any("Legacy" in f for f in r["findings"]))

 def test_v2_from_body_only_flags_missing_header(self):
  self.assertTrue(any("canonical transport" in f for f in analyze(402,{},GOOD)["findings"]))

 def test_missing_version(self):
  q=copy.deepcopy(GOOD);q.pop("x402Version")
  self.assertTrue(any("Invalid or unsupported" in f for f in call(q)["findings"]))

 def test_bad_base64(self):
  r=analyze(402,{"payment-required":"not&base64!"})
  self.assertTrue(any("base64 JSON" in f for f in r["findings"]))

 def test_bad_resource(self):
  q=copy.deepcopy(GOOD);q["resource"]={}
  self.assertTrue(any("HTTPS resource" in f for f in call(q)["findings"]))

 def test_no_accepts(self):
  q=copy.deepcopy(GOOD);q["accepts"]=[]
  self.assertTrue(any("1..12" in f for f in call(q)["findings"]))

 def test_wrong_chain_from_expected_base(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["network"]="eip155:84532"
  self.assertTrue(any("different network" in f for f in call(q,claimed_native_base_usdc=True)["findings"]))

 def test_wrong_native_usdc_contract(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["asset"]="0x"+"a"*40
  self.assertTrue(any("asset mismatch" in f for f in call(q,claimed_native_base_usdc=True)["findings"]))

 def test_invalid_atomic_string_float(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["amount"]="0.010000"
  self.assertTrue(any("integer atomic" in f for f in call(q)["findings"]))

 def test_invalid_atomic_zero(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["amount"]="0"
  self.assertTrue(any("integer atomic" in f for f in call(q)["findings"]))

 def test_bad_wallet_address(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["payTo"]="self"
  self.assertTrue(any("malformed recipient" in f for f in call(q)["findings"]))

 def test_missing_timeout(self):
  q=copy.deepcopy(GOOD);q["accepts"][0].pop("maxTimeoutSeconds")
  self.assertTrue(any("maxTimeoutSeconds" in f for f in call(q)["findings"]))

 def test_sensitive_authorization_input_rejected(self):
  with self.assertRaises(InvalidPublicInput):
   analyze(402,{"authorization":"Bearer secret_should_never_proceed","payment-required":e(GOOD)})

 def test_sensitive_x_payment_rejected(self):
  with self.assertRaises(InvalidPublicInput):
   analyze(402,{"x-payment":"user-signed","payment-required":e(GOOD)})

 def test_sensitive_inside_body_rejected(self):
  with self.assertRaises(InvalidPublicInput):
   analyze(402,{"payment-required":e(GOOD)},{"authorization":"hidden"})

 def test_sensitive_in_quote_rejected(self):
  q=copy.deepcopy(GOOD);q["accepts"][0]["payment-signature"]="signed"
  r=call(q)
  self.assertTrue(any("sensitive or invalid field key" in f for f in r["findings"]))
  self.assertNotIn("signed",str(r))

 def test_huge_payload_rejected(self):
  with self.assertRaises(InvalidPublicInput):
   analyze(402,{"PAYMENT-REQUIRED":"X"*12001})

 def test_no_disclosure_of_input(self):
  r=call()
  raw=json.dumps(r)
  self.assertNotIn(RECIPIENT,raw)
  self.assertNotIn(BASE_USDC,raw)
  self.assertNotIn("payment-required",raw)

 def test_header_case_collisions_rejected(self):
  with self.assertRaises(InvalidPublicInput):
   analyze(402,{"PAYMENT-REQUIRED":e(GOOD),"payment-required":e(GOOD)})

if __name__=="__main__":
 unittest.main()
