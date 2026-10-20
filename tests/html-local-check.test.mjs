import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHtml} from '../html-local-check.mjs';
const normal='<!doctype html><html lang="en"><head><title>QA Example</title><meta name="description" content="synthetic preview"></head><body><h1>Heading</h1><a href="#about">About</a><section id="about">OK</section><img alt="" src="data:,"></body></html>';
const kinds=(s)=>inspectHtml(s).findings.map(x=>x.code);
test('simple invented good HTML no warnings',()=>assert.deepEqual(kinds(normal),[]));
test('missing title high severity',()=>{const q=inspectHtml(normal.replace('<title>QA Example</title>',''));assert.ok(q.findings.some(x=>x.code==='TITLE_MISSING'&&x.severity==='high'))});
test('no document lang review',()=>assert.ok(kinds(normal.replace(' lang="en"','')).includes('DOCUMENT_LANG_MISSING')));
test('missing only image alt is review',()=>assert.ok(kinds(normal.replace('alt="" ', '')).includes('IMG_ALT_MISSING')));
test('empty alt is valid for decorative pictures',()=>assert.ok(!kinds(normal).includes('IMG_ALT_MISSING')));
test('duplicate id flagged',()=>assert.ok(kinds(normal.replace('</section>','<i id="about"></i></section>')).includes('DUPLICATE_ID')));
test('local fragment points to valid id',()=>assert.ok(!kinds(normal).includes('FRAGMENT_TARGET_MISSING')));
test('broken local fragment detected',()=>assert.ok(kinds(normal.replace('href="#about"','href="#missing"')).includes('FRAGMENT_TARGET_MISSING')));
test('unparseable percent escape never crashes',()=>assert.ok(kinds(normal.replace('href="#about"','href="#%ZZ"')).includes('FRAGMENT_TARGET_MISSING')));
test('placeholder href flagged',()=>assert.ok(kinds(normal.replace('href="#about"','href="#"')).includes('PLACEHOLDER_LINK')));
test('target blank without rel review',()=>assert.ok(kinds(normal.replace('href="#about"','href="https://example.invalid" target="_blank"')).includes('NEW_WINDOW_REL_MISSING')));
test('safe rel noopener passes',()=>assert.ok(!kinds(normal.replace('href="#about"','href="https://example.invalid" target="_blank" rel="noopener noreferrer"')).includes('NEW_WINDOW_REL_MISSING')));
test('heading gap is warning only',()=>assert.ok(kinds(normal.replace('</h1>','</h1><h3>Details</h3>')).includes('HEADING_LEVEL_GAP')));
test('scripts and comments are not treated as document images',()=>{
 const s=normal.replace('</body>','<script>const x="<img src=x>";</script><!-- <img src=x> --></body>');
 assert.ok(!kinds(s).includes('IMG_ALT_MISSING'));
});
test('no pasted raw values echoed in reported details',()=>{
 const s=normal.replace('id="about"','id="CUSTOMER_PRIVATE_MARKER"');
 assert.ok(!JSON.stringify(inspectHtml(s)).includes('CUSTOMER_PRIVATE_MARKER'));
});
test('reject empty, wrong input type, oversized UTF-8 bytes',()=>{
 assert.throws(()=>inspectHtml(''),RangeError);
 assert.throws(()=>inspectHtml(null),TypeError);
 assert.throws(()=>inspectHtml('한'.repeat(44000)),RangeError);
});
test('limit report to 60 findings but preserve exact totals',()=>{
 const s=normal.replace('</body>','<img src=x>'.repeat(75)+'</body>');
 const q=inspectHtml(s);
 assert.equal(q.counts.review,75);assert.equal(q.findings.length,60);assert.equal(q.truncated,true);
});
test('single source row and character offsets reported',()=>{
 const s=normal.replace('<h1>Heading</h1>','<h1>Heading</h1>\n<img src=x>');
 assert.equal(inspectHtml(s).findings[0].line,2);
});
