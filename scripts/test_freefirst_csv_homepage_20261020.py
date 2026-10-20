"""Original VM3 buyer-first sales-funnel offline regression checks; ZERO network calls or funds."""
from pathlib import Path
from html.parser import HTMLParser
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf8")
GUIDE="guides/csv-structural-preflight-005-base-usdc.html"
FREE="https://vm5-openapi-x402.onrender.com/v1/csv-sample"
PAID="https://vm5-openapi-x402.onrender.com/v1/csv-preflight"
SDK="https://github.com/livastic-vm3-primary-tmp-260920/defi-payment-proof-qa/tree/main/buyer-client"
class Facts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=set();self.links=[];self.jsonld=[];self.capture=False
        self.section=None;self.section_links={};self.duplicate_ids=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get("id"):
            if d["id"] in self.ids:self.duplicate_ids.append(d["id"])
            self.ids.add(d["id"])
        if tag=="section":self.section=d.get("id")
        if tag=="a":
            self.links.append(d.get("href",""))
            self.section_links.setdefault(self.section,[]).append(d.get("href",""))
        if tag=="script" and d.get("type")=="application/ld+json":self.capture=True;self.jsonld.append("")
    def handle_data(self,data):
        if self.capture:self.jsonld[-1]+=data
    def handle_endtag(self,tag):
        if tag=="script":self.capture=False
        if tag=="section":self.section=None

class FreeFirstConversionSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=Facts();cls.p.feed(HTML)
    def test_homepage_has_one_new_section_and_no_duplicate_fragment_id(self):
        self.assertIn("csv-buyer",self.p.ids)
        self.assertEqual([],self.p.duplicate_ids)
        self.assertEqual(1,HTML.count('id="csv-buyer"'))
    def test_navigation_above_fold_points_to_checkout_explainer(self):
        self.assertIn('href="#csv-buyer"',HTML.split("<main",1)[0])
        self.assertIn('href="#csv-buyer"',HTML.split("</header>",1)[0])
    def test_free_sample_and_paid_guide_both_reachable(self):
        links=self.p.section_links.get("csv-buyer",[])
        self.assertIn(FREE,links)
        self.assertIn(GUIDE,links)
        self.assertIn(SDK,links)
        self.assertTrue((ROOT/GUIDE).is_file())
    def test_no_unapproved_live_payment_button(self):
        links=self.p.section_links.get("csv-buyer",[])
        self.assertNotIn(PAID,links)  # Buyer must read terms first, never auto-charge
        self.assertIn('HTTP 402',HTML)
        self.assertIn("Buyer wallet approval",HTML)
    def test_exact_price_and_same_owner_disclosure(self):
        x=HTML.split('<section id="csv-buyer"',1)[1].split('</section>',1)[0]
        for item in ['0.005','native Circle Base USDC','same one human owner','No new independently verified paid purchases','32 KiB','500 data rows','40 columns']:
            self.assertIn(item,x)
    def test_no_false_post_receipt_or_customer_claim(self):
        x=HTML.split('<section id="csv-buyer"',1)[1].split('</section>',1)[0]
        self.assertIn('an earlier purchase of a different synthetic CSV GET',x)
        self.assertIn('not evidence of a POST sale',x)
    def test_structured_data_well_formed_and_existing_custom_consulting_intact(self):
        self.assertEqual(1,len(self.p.jsonld))
        self.assertEqual("ProfessionalService",json.loads(self.p.jsonld[0])["@type"])
        self.assertIn('Email a paid-scope brief',HTML)
        self.assertIn('Contract via OpenTask',HTML)
    def test_all_in_page_fragments_exist(self):
        for href in self.p.links:
            if href.startswith("#") and len(href)>1:
                self.assertIn(href[1:],self.p.ids,href)
if __name__=="__main__":
    unittest.main()
