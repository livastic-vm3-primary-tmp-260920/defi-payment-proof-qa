#!/usr/bin/env python3
"""Bounded public-only QA sample for the owner's OWN GitHub Pages paid QA site.
No cookies, credentials, form submissions, API POSTs, wallet actions or third-party requests.
"""
import argparse
import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://livastic-vm3-primary-tmp-260920.github.io/defi-payment-proof-qa/"
DOMAIN = urlsplit(BASE).netloc
TIMEOUT = 8

class HTMLFacts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.h1_count = 0
        self.html_lang = ""
        self.meta = {}
        self.links = []
        self.anchors = set()
        self._in_title = False
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == "html": self.html_lang = attrs.get("lang") or ""
        if tag == "title": self._in_title = True
        if tag == "h1": self.h1_count += 1
        if tag == "meta":
            name = attrs.get("name") or attrs.get("property") or ""
            if name: self.meta[name] = attrs.get("content") or ""
        if tag == "a" and attrs.get("href") is not None:
            self.links.append(attrs["href"])
        if attrs.get("id"): self.anchors.add(attrs["id"])
    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
    def handle_data(self, data):
        if self._in_title: self.title += data

def owned(url):
    obj = urlsplit(url)
    return obj.scheme == "https" and obj.netloc == DOMAIN and obj.path.startswith(urlsplit(BASE).path)

def grab(url):
    if not owned(url): raise ValueError("URL outside owner GitHub Pages allowlist")
    req = Request(url, headers={"User-Agent": "Original-VM3-Public-QA-Portfolio/2026-10-20"})
    with urlopen(req, timeout=TIMEOUT) as res:
        if not owned(res.url): raise ValueError("External redirect blocked")
        b = res.read(110000)
        return res.status, res.headers.get("Content-Type", ""), b

def parse_site(xml):
    root = ET.fromstring(xml)
    urls = [item.text.strip() for item in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if item.text]
    if not (1 <= len(urls) <= 8) or len(urls) != len(set(urls)) or not all(owned(url) for url in urls):
        raise ValueError("Sitemap unexpected or external; no site fetching")
    return urls

def check_html(text):
    p = HTMLFacts()
    p.feed(text)
    issues = []
    for label, condition in [
        ("NO_PAGE_TITLE", bool(p.title.strip())),
        ("NO_HTML_LANGUAGE", bool(p.html_lang)),
        ("NO_META_DESCRIPTION", bool(p.meta.get("description", "").strip())),
        ("NO_MOBILE_VIEWPORT", bool(p.meta.get("viewport", "").strip())),
        ("H1_COUNT_NOT_ONE", p.h1_count == 1)]:
        if not condition: issues.append(label)
    return p, issues

def run():
    sitemap_url = BASE + "sitemap.xml"
    code, typ, src = grab(sitemap_url)
    sitemap_code = code
    if code != 200 or "xml" not in typ: raise ValueError("Sitemap not accessible")
    urls = parse_site(src)
    results = []
    total_internal = 0
    for url in urls:
        code, typ, html = grab(url)
        if code != 200 or "html" not in typ: raise ValueError(f"Unexpected webpage response {url}")
        facts, failures = check_html(html.decode("utf-8", "replace"))
        broken_anchors = []
        same_site_links = []
        for href in facts.links:
            if href.startswith(("mailto:", "tel:", "javascript:")): continue
            full = urljoin(url, href)
            if owned(full):
                total_internal += 1
                other, frag = urldefrag(full)
                # Internal '#fragment' checks are scoped to the current page only.
                if other == url and frag and frag not in facts.anchors: broken_anchors.append(frag)
                same_site_links.append(other)
        results.append({"url": url, "http_status": code, "title": facts.title.strip(),
                        "h1_count":facts.h1_count, "language":facts.html_lang,
                        "description_present":bool(facts.meta.get("description")),
                        "viewport_present":bool(facts.meta.get("viewport")),
                        "internal_links":len(same_site_links), "page_failures":failures,
                        "same_page_broken_fragments":sorted(set(broken_anchors))})
    # Additional same-host links are not followed: avoid unbounded site traversal.
    faults = sum(len(p["page_failures"]) + len(p["same_page_broken_fragments"]) for p in results)
    result={"timestamp_utc":datetime.now(timezone.utc).isoformat(), "site":BASE,
            "sitemap_https_status":sitemap_code, "pages_checked":len(results),
            "internal_href_occurrences":total_internal, "observed_failures":faults,
            "pages":results, "limitations":"Three sitemap pages; HTML static only; no JS interaction, responsive screenshot, auth, forms, hidden links, external hosts or actual buyer traffic measured.",
            "marketing_status":"Sample QA of own product; not a buyer order or paid acceptance",
            "new_actual_buyer_income_usdc":0}
    return result

def selftest():
    p, iss = check_html('<html lang="en"><head><title>Example</title><meta name="description" content="x"><meta name="viewport" content="width=device-width"></head><body><h1 id="a">A</h1><a href="#a">Same</a></body></html>')
    assert not iss and p.h1_count == 1 and "a" in p.anchors
    _, bad = check_html("<html><head><title>ok</title></head><body><h1>A</h1><h1>B</h1></body></html>")
    assert set(bad) == {"NO_HTML_LANGUAGE", "NO_META_DESCRIPTION", "NO_MOBILE_VIEWPORT", "H1_COUNT_NOT_ONE"}
    valid=b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+BASE.encode()+b'</loc></url></urlset>'
    assert parse_site(valid) == [BASE]
    assert owned(BASE+"guides/one.html")
    assert not owned("https://example.org/")
    assert not owned("https://livastic-vm3-primary-tmp-260920.github.io/other/")
    print("SELFTEST 6/6 PASS; external access 0")
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--selftest",action="store_true")
    ap.add_argument("--live",action="store_true")
    a=ap.parse_args()
    if a.selftest: selftest()
    if a.live: print(json.dumps(run(),ensure_ascii=False,indent=2))
if __name__=="__main__":
    main()
