/*
 * Original bounded, heuristic, browser-local HTML structure preflight.
 * No DOMParser, fetch, script execution, network, uploads or credentials.
 * This is not an HTML validator, WCAG certification, or customer QA report.
 */
const INPUT_MAX_BYTES = 131072;
const TAG_MAX = 6000;
const ISSUES_MAX = 60;

function cleanForReview(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, function(m){return " ".repeat(m.length);})
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      function(m){return " ".repeat(m.length);});
}

function attributes(tagText) {
  const values = Object.create(null);
  // This is intentionally an attribute-shape heuristic, not a full HTML parser.
  const re = /(?:^|\s)([a-z_:][a-z0-9_:.\-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=]+)))?/gi;
  for (const m of tagText.matchAll(re)) {
    const key = m[1].toLowerCase();
    if (!Object.hasOwn(values,key)) values[key] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return values;
}

function lineAt(src, at) {
  let total = 1;
  for (let i=0;i<at;i++) if(src.charCodeAt(i)===10) total++;
  return total;
}

export function inspectHtml(source) {
  if (typeof source !== "string") throw new TypeError("HTML source must be a string");
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength === 0 || byteLength > INPUT_MAX_BYTES)
    throw new RangeError("Paste 1 to 131072 UTF-8 bytes of HTML");
  const clean = cleanForReview(source);
  const findings = [];
  const tags = [];
  const ID_MAP = new Map();
  const add = (severity, code, pos, explanation) => {
    findings.push({severity, code, line:lineAt(source, Math.max(pos,0)), explanation});
  };
  for(const m of clean.matchAll(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi)) {
    if(tags.length >= TAG_MAX)throw new RangeError("Too many tags for safe local analysis");
    const name=m[1].toLowerCase();
    const attrs=attributes(m[2]);
    tags.push({name,attrs,pos:m.index,raw:m[0]});
    if(Object.hasOwn(attrs,"id") && attrs.id !== "") {
      if(ID_MAP.has(attrs.id))
        add("review","DUPLICATE_ID",m.index,"Repeated HTML id may break in-page navigation");
      else ID_MAP.set(attrs.id,m.index);
    }
  }
  const named=(name)=>tags.filter(x=>x.name===name);
  const html=named("html")[0];
  if(!html || !html.attrs.lang || html.attrs.lang.trim()==="")
    add("review","DOCUMENT_LANG_MISSING",0,"Check the document language with a human reviewer");
  const title=/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(clean);
  if(!title || !title[1].trim())add("high","TITLE_MISSING",0,"Add one clear document title");
  if(!named("h1").length)add("review","H1_MISSING",0,"Review whether this page needs one main heading");
  const descriptions=named("meta").some(({attrs})=>
    attrs.name?.toLowerCase()==="description" && !!attrs.content?.trim());
  if(!descriptions)add("review","DESCRIPTION_MISSING",0,"Review whether a search snippet meta description is needed");
  for(const img of named("img"))
    if(!Object.hasOwn(img.attrs,"alt"))
      add("review","IMG_ALT_MISSING",img.pos,"Image lacks an alt attribute; empty alt may be appropriate for decorative images");
  for(const a of named("a")){
    const href=a.attrs.href;
    if(href==="#"||href==="")
      add("review","PLACEHOLDER_LINK",a.pos,"Link target appears empty or placeholder");
    if(href?.startsWith("#") && href.length>1 &&
       !ID_MAP.has(href.slice(1)) &&
       !ID_MAP.has(decodeURIComponentSafe(href.slice(1))))
      add("review","FRAGMENT_TARGET_MISSING",a.pos,"Local fragment link does not match an element id in pasted HTML");
    if(a.attrs.target==="_blank" &&
       !/(^|\s)(noopener|noreferrer)(\s|$)/i.test(a.attrs.rel||""))
      add("review","NEW_WINDOW_REL_MISSING",a.pos,"Review target=_blank security and compatibility rel policy");
  }
  let previousHeading=0;
  for(const h of tags.filter(t=>/^h[1-6]$/.test(t.name))){
    const level=Number(h.name[1]);
    if(previousHeading && level>previousHeading+1)
      add("review","HEADING_LEVEL_GAP",h.pos,"Heading levels jump more than one step; review document outline");
    previousHeading=level;
  }
  findings.sort((a,b)=>a.line-b.line||a.code.localeCompare(b.code));
  return {
    provenance:"SYNTHETIC_OR_BUYER_LOCAL_ONLY_NOT_CERTIFICATION",
    byteLength, tagCount:tags.length,
    counts:{high:findings.filter(x=>x.severity==="high").length,
            review:findings.filter(x=>x.severity==="review").length,
            total:findings.length},
    findings:findings.slice(0,ISSUES_MAX),
    truncated:findings.length>ISSUES_MAX,
    limitations:[
      "Heuristic text analysis: quote-angle attributes, script strings and malformed nesting are not fully parsed.",
      "Zero network requests, no URL fetching, no uploads and no page script execution.",
      "Does not check actual HTTP status, redirects, real browser rendering, WCAG, a full DOM, access rights or production code.",
      "Investigate every warning against the original authorized page before asserting a defect."
    ]
  };
}

function decodeURIComponentSafe(v){
  try{return decodeURIComponent(v);}catch{return v;}
}
