import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const machine=readFileSync(new URL('../llms.txt',import.meta.url),'utf8');
const pr='https://github.com/Chain-Love/chain-love/pull/4608';
test('public GitHub contribution points to exact upstream PR',()=>{
  assert(home.includes(pr));
  assert(machine.includes(pr));
});
test('verified merged state is represented identically to humans and agents',()=>{
  for(const doc of [home,machine]){
    assert.match(doc,/merged/i);
    assert.match(doc,/2026-10-19/);
    assert.match(doc,/(payout not verified|no payment)/i);
  }
});
test('past stale review and misleading customer-payment claims are absent',()=>{
  for(const doc of [home,machine]){
    assert.doesNotMatch(doc,/awaiting human review|open and unpaid|Original open\/unpaid public PR/i);
    assert.doesNotMatch(doc,/paid client engagement completed|customer testimonial|verified paid client/i);
  }
});
test('sales routes remain stable, no checkout or signing added to static proof',()=>{
  assert.match(home,/mailto:onecursor1@gmail.com/);
  assert.match(home,/https:\/\/opentask\.ai\/profiles\/cmvckd5ok00cx08jyc1yh8bvz/);
  assert.match(home,/https:\/\/vm5-openapi-x402\.onrender\.com\/v1\/csv-sample/);
});
