// Original VM3 privacy-first browser CSV scanner, v1.0 (MIT-style permissive reuse).
// No network, wallet, customer upload, localStorage or external dependencies.
export const MAX_BYTES = 32 * 1024;
export const MAX_DATA_ROWS = 500;
export const MAX_COLUMNS = 40;
const utf8Length = text => new TextEncoder().encode(text).length;

export function parseCsv(input) {
  if (typeof input !== "string") throw new TypeError("CSV must be text.");
  if (utf8Length(input) > MAX_BYTES) throw new RangeError("CSV exceeds the 32 KiB local and paid API limit.");
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!text) throw new Error("Paste a CSV header and at least one data row.");
  if (text.includes("\u0000")) throw new Error("CSV contains an unsupported NUL byte.");

  const records = [];
  let fields = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  let atFieldStart = true;
  let justEndedRecord = false;
  function pushField() {
    fields.push(field);
    if (fields.length > MAX_COLUMNS) throw new RangeError("CSV exceeds 40 columns.");
    field = "";
    atFieldStart = true;
    quoteClosed = false;
  }
  function pushRecord() {
    pushField();
    records.push(fields);
    if (records.length > MAX_DATA_ROWS + 1) throw new RangeError("CSV exceeds 500 data rows.");
    fields = [];
    justEndedRecord = true;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; quoteClosed = true; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (!atFieldStart || quoteClosed) throw new SyntaxError("A quote must begin a field or escape a quote inside a quoted field.");
      quoted = true;
      atFieldStart = false;
      justEndedRecord = false;
      continue;
    }
    if (ch !== ',' && ch !== '\r' && ch !== '\n' && quoteClosed) {
      throw new SyntaxError("Unexpected text after a closing quote.");
    }
    if (ch === ',') {
      pushField();
      justEndedRecord = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushRecord();
    } else {
      field += ch;
      atFieldStart = false;
      justEndedRecord = false;
    }
  }
  if (quoted) throw new SyntaxError("Unclosed CSV quoted field.");
  if (!justEndedRecord) pushRecord();
  if (records.length < 2) throw new Error("Provide a header and at least one data row.");
  if (records[0].length === 1 && records[0][0] === "") throw new Error("The CSV header is empty.");
  return records;
}

function looksLikeFormula(value) {
  if (typeof value !== "string" || !value) return false;
  const trimmed = value.replace(/^[\t\r\n ]+/, "");
  if (!trimmed) return false;
  // -12.3 is a number, not a spreadsheet formula. Other leading operators
  // can become spreadsheet formulas on a later CSV export.
  if (trimmed[0] === "-" && /^-\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) return false;
  return /^[=+\-@]/.test(trimmed);
}

export function analyzeCsv(text, expectedNames = []) {
  const records = parseCsv(text);
  const headers = records[0];
  const data = records.slice(1);
  if (!Array.isArray(expectedNames) || expectedNames.some(x => typeof x !== "string")) {
    throw new TypeError("Expected columns must be an array of names.");
  }
  const expected = [...new Set(expectedNames.map(s => s.trim()).filter(Boolean))];
  const present = new Set(headers.map(h => h.trim().toLowerCase()));
  const issues = [];
  const counts = { irregularRows: 0, missingCells: 0, duplicateRows: 0, duplicateHeaders: 0, formulaRiskCells: 0, missingExpectedHeaders: 0 };
  const MAX_VISIBLE_ISSUES = 80;
  function issue(kind, record, column, detail) {
    if (issues.length < MAX_VISIBLE_ISSUES) issues.push({ kind, record, column, detail });
  }
  const seenHeaders = new Set();
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].trim().toLowerCase();
    if (!normalized || seenHeaders.has(normalized)) {
      counts.duplicateHeaders++;
      issue("Header", 1, i + 1, !normalized ? "Empty column header" : "Repeated column header");
    }
    seenHeaders.add(normalized);
  }
  for (const name of expected) {
    if (!present.has(name.toLowerCase())) {
      counts.missingExpectedHeaders++;
      issue("Header", 1, null, "Expected column is missing: " + name.slice(0, 80));
    }
  }
  const seenRows = new Map();
  for (let i = 0; i < data.length; i++) {
    const row = data[i], csvRecord = i + 2;
    if (row.length !== headers.length) {
      counts.irregularRows++;
      issue("Width", csvRecord, null, "Found " + row.length + " fields; header has " + headers.length);
    }
    const key = JSON.stringify(row);
    if (seenRows.has(key)) {
      counts.duplicateRows++;
      issue("Duplicate", csvRecord, null, "Repeats data record " + seenRows.get(key));
    } else seenRows.set(key, csvRecord);
    for (let c = 0; c < headers.length; c++) {
      const cell = row[c] ?? "";
      if (cell.trim() === "") {
        counts.missingCells++;
        issue("Empty", csvRecord, c + 1, "Missing or empty cell");
      } else if (looksLikeFormula(cell)) {
        counts.formulaRiskCells++;
        issue("Formula", csvRecord, c + 1, "Possible spreadsheet formula on export; keep as plain text");
      }
    }
  }
  const totalFindings = Object.values(counts).reduce((a,b) => a + b, 0);
  return {
    header: headers.map(h => h.slice(0, 80)),
    columnCount: headers.length,
    rowCount: data.length,
    counts,
    totalFindings,
    issues,
    truncated: totalFindings > issues.length,
    localOnly: true,
    paidCallMade: false
  };
}

export const SYNTHETIC_EXAMPLE = [
  "email,amount,date,note",
  "a@example.invalid,12.5,2026-10-20,paid",
  "a@example.invalid,12.5,2026-10-20,paid",
  'b@example.invalid,not-a-number,2026-13-99,"=1+1"',
  "c@example.invalid,,2026-10-20,missing amount",
].join("\r\n") + "\r\n";
