import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(s)=>readFileSync(new URL(s,import.meta.url),'utf8');
const page=src('../guides/html-free-local-checker.html');
const paid=src('../services/public-web-qa-19-usdc.html');
const home=src('../index.html');
const site=src('../sitemap.xml');
const txt=src('../llms.txt');
test('free interactive page sources original testable pure JS',()=>assert.match(page,/import \{inspectHtml\} from "\.\.\/html-local-check\.mjs"/));
test('no pasted html is interpreted as browser DOM',()=>{
 assert.match(page,/li\.textContent=/);
 assert.doesNotMatch(page,/\.innerHTML\s*=|eval\s*\(|DOMParser|localStorage|sessionStorage|\bfetch\s*\(/);
});
test('no upload or wallet through preview actions',()=>{
 assert.doesNotMatch(page,/<form\b|<input\b[^>]*type="file"|window\.ethereum|payTo|payment-signature/i);
 assert.match(page,/No file upload/);
});
test('privacy scope and noncertification explicit',()=>{
 assert.match(page,/non-confidential HTML/);
 assert.match(page,/not a valid HTML parser/);
 assert.match(page,/not a production pass/);
});
test('free and paid pages cross link correctly',()=>{
 assert.ok(page.includes('../services/public-web-qa-19-usdc.html'));
 assert.ok(paid.includes('../guides/html-free-local-checker.html'));
});
test('index links to free checker before paid service',()=>{
 assert.ok(home.includes('guides/html-free-local-checker.html'));
 assert.ok(home.indexOf('guides/html-free-local-checker.html')<home.indexOf('services/public-web-qa-19-usdc.html'));
});
test('sitemap and llms include same canonical free preview',()=>{
 assert.ok(site.includes('guides/html-free-local-checker.html'));
 assert.ok(txt.includes('guides/html-free-local-checker.html'));
});
test('invented sample displays no personal customer files',()=>{
 assert.match(page,/Fictional sample/);
 assert.match(page,/No paid customer orders are claimed/);
});
