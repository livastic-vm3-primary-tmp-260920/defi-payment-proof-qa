import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=x=>readFileSync(new URL(x,import.meta.url),'utf8');
const led=file('../guides/base-usdc-merchant-ledger.html');
const checkout=file('../guides/csv-browser-x402-checkout.html');
const homepage=file('../index.html');
test('one precise link from existing free USDC ledger to an actual separately published browser buyer checkout',()=>{
  assert.equal(led.split('href="csv-browser-x402-checkout.html"').length-1,1);
  assert.match(homepage,/guides\/csv-browser-x402-checkout\.html/);
  assert.match(checkout,/id="quote-button"/);
});
test('buyer can review a real unpaid 402 quote first, and must explicitly consent to an actual purchase',()=>{
  assert.match(led,/unpaid HTTP 402 quote/);
  assert.match(led,/Requesting a real quote sends the CSV/);
  assert.match(led,/requires two separate explicit consents/);
  assert.match(checkout,/id="data-consent"/);
  assert.match(checkout,/id="pay-consent"/);
  assert.match(checkout,/id="pay-button" disabled/);
});
test('0.005 product is distinctly generic CSV structure, not a paid chain settlement verification or free auto-charge',()=>{
  assert.match(led,/CSV formatting, duplicates and spreadsheet formula hazards/);
  assert.match(led,/does <strong>not<\/strong> verify blockchain transactions/);
  assert.match(led,/merchant ledger above remains free/i);
  assert.match(led,/No wallet connection or payment happens from this free ledger page/);
  assert.match(led,/End-to-end payment from an independent buyer has not been verified/);
});
test('original 5 and 15 manual and 2.50 hosted AI services remain untouched',()=>{
  assert.match(led,/5 USDC for one public transfer/);
  assert.match(led,/15 USDC scoped reconciliation/);
  assert.match(led,/2\.50 Base USDC/);
  assert.match(led,/opentask\.ai\/profiles\/cmvckd5ok00cx08jyc1yh8bvz/);
});
test('buyer checkout names the one known VM5 merchant and never silently authorizes from free page',()=>{
  assert.match(checkout,/0\.005 Base USDC/);
  assert.match(checkout,/0x6b01efA0705E91a7aca54271510bf9e594717f34/);
  assert.match(checkout,/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
  assert.doesNotMatch(led,/\bfetch\s*\(|window\.ethereum|ethereum\.request|<iframe|<script src/i);
});
