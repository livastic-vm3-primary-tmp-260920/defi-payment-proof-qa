import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(x)=>readFileSync(new URL(x,import.meta.url),'utf8');
const page=src('../services/public-web-qa-19-usdc.html');
const home=src('../index.html');
const machine=src('../llms.txt');
const sitemap=src('../sitemap.xml');
const path='services/public-web-qa-19-usdc.html';
const proof='https://github.com/livastic-vm3-primary-tmp-260920/public-web-qa-smoke-evidence-20261020';
test('new service route appears on homepage, sitemap and machine description',()=>{
 for(const data of [home,machine,sitemap]) assert.ok(data.includes('public-web-qa-19-usdc.html'));
});
test('one clear proposed 19 USDC amount with exact 5-page limit',()=>{
 assert.match(page,/>19\s*<small>Circle Base USDC/);
 assert.match(page,/up to five/);
 assert.match(page,/written acceptance criteria/);
});
test('mailto only offers contact, no instant checkout or uncontrolled signer',()=>{
 assert.match(page,/mailto:onecursor1@gmail.com\?/);
 assert.match(page,/Clicking does not buy anything/);
 assert.doesNotMatch(page,/onload=|<script|window\.ethereum|privateKey|sendTransaction/);
});
test('original reproducible public proof URLs exist in sale page',()=>{
 assert.ok(page.includes(proof));
 assert.ok(page.includes('/blob/main/REPORT.md'));
 assert.ok(page.includes('/blob/main/audit.json'));
 assert.match(page,/19 passing offline regression tests/);
});
test('no false customer reference or production certification',()=>{
 for(const content of [page,machine]){
  assert.match(content,/(No paid|No paid customer|does not show a past paid|No past customer order)/i);
  assert.match(content,/(screen.reader|WCAG)/i);
 }
});
test('scope cannot require unauthorized access or private browser data',()=>{
 assert.match(page,/No confidential page data/);
 assert.match(page,/No crawling beyond agreed public scope/);
 assert.match(page,/No credentials/);
});
test('good static SEO and responsiveness',()=>{
 assert.match(page,/<link rel="canonical"/);
 assert.match(page,/<meta name="robots" content="index,follow">/);
 assert.match(page,/@media\(max-width:750px\)/);
 assert.match(page,/<h1>/);
});
test('sitemap has exact one canonical product URL',()=>{
 assert.equal((sitemap.match(/\/services\/public-web-qa-19-usdc\.html/g)||[]).length,1);
});
