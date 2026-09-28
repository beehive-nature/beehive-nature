#!/usr/bin/env node
// bLibrary enrichment pass — priorities 4 (metadata) + 6 (provenance).
// READ-ONLY on the corpus: opens files 'r', writes ONLY into library-records/.
// Metadata law: disagreements are preserved as claim lists, never corrected away.
// Provenance law: source name is provenance, not authority; inference is labelled
// as inference; SESSION-LOG lines are receipts; unknown stays unknown.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "");
const DAY = new Date().toISOString().slice(0, 10);
const REC_DIR = path.join(ROOT, "library-records");
if (!fs.statSync(ROOT, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("usage: node enrich.mjs <corpusRoot>");
  process.exit(2);
}
// newest inventory file, preferring today's
const invFiles = fs.readdirSync(REC_DIR).filter((f) => /^inventory-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
if (!invFiles.length) { console.error("BLOCKER: no inventory jsonl in " + REC_DIR); process.exit(2); }
const INV = path.join(REC_DIR, invFiles[invFiles.length - 1]);

// ---- SESSION-LOG provenance index ------------------------------------------
// Format observed: "--- <ts> — HARVEST via legal OA rail (harvest-oa.mjs) ---"
// blocks containing "Added N:" lists of "  <filename> (<kb> KB, <source>)".
function parseSessionLog(txt) {
  const idx = new Map(); // filename -> [{acquired_at, phase, source, topic, kb, skipped}]
  let ts = null, phase = null;
  for (const line of txt.split(/\r?\n/)) {
    const h = line.match(/^---\s+(.+?)\s+—\s+HARVEST(?:.*?phase:\s*([a-z-]+))?/);
    if (h) { ts = h[1]; phase = h[2] ?? null; continue; }
    let a = line.match(/^\s{2,}(.+?\.pdf)\s+\((\d+)\s*KB,\s*([^)]*)\)/i);
    if (a && ts) {
      const desc = a[3].trim();
      const t = desc.match(/^topic:\s*(.+)$/i);
      if (!idx.has(a[1].trim())) idx.set(a[1].trim(), []);
      idx.get(a[1].trim()).push({
        acquired_at: ts, phase,
        source: t ? "harvest-oa rail" : desc.toLowerCase(),
        topic: t ? t[1].trim() : null,
        kb: Number(a[2]), skipped: false,
      });
      continue;
    }
    const s = line.match(/^\s{2,}(.+?\.pdf)\s+\(already present, skipped\)/i);
    if (s && ts) {
      if (!idx.has(s[1].trim())) idx.set(s[1].trim(), []);
      idx.get(s[1].trim()).push({ acquired_at: ts, phase, source: null, topic: null, kb: null, skipped: true });
    }
  }
  return idx;
}

// ---- PDF string extraction (Info dict + XMP), best-effort -------------------
function pdfParenString(s, i) { // s[i] === '('
  let out = "", depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { out += s[i + 1] ?? ""; i++; continue; }
    if (c === "(") { depth++; if (depth > 1) out += c; continue; }
    if (c === ")") { depth--; if (depth === 0) return out; out += c; continue; }
    out += c;
  }
  return null;
}
function infoValue(s, key) {
  const re = new RegExp(`/${key}\\s*[(<]`, "g");
  let m;
  while ((m = re.exec(s))) {
    if (m[0].endsWith("(")) {
      const v = pdfParenString(s, m.index + m[0].length - 1);
      if (v != null && v.trim()) return v.trim();
    } else {
      const close = s.indexOf(">", m.index);
      if (close > m.index) {
        const hex = s.slice(m.index + m[0].length, close).replace(/\s+/g, "");
        if (/^[0-9A-Fa-f]+$/.test(hex) && hex.length % 4 === 0) {
          const b = Buffer.from(hex, "hex");
          if (b[0] === 0xfe && b[1] === 0xff) return b.subarray(2).swap16().toString("utf16le").trim();
          return b.toString("latin1").trim();
        }
      }
    }
  }
  return null;
}
function xmpValue(s, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(s))) {
    const li = m[1].match(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/);
    const v = (li ? li[1] : m[1]).replace(/<[^>]+>/g, "").trim();
    if (v) return v;
  }
  return null;
}

async function readRegions(p) {
  const fd = await fsp.open(p, "r");
  try {
    const st = await fd.stat();
    const headLen = Math.min(st.size, 65536);
    const tailLen = Math.min(st.size, 393216);
    const head = Buffer.alloc(headLen);
    await fd.read(head, 0, headLen, 0);
    const tail = Buffer.alloc(tailLen);
    await fd.read(tail, 0, tailLen, st.size - tailLen);
    return { headS: head.toString("latin1"), tailS: tail.toString("latin1") };
  } finally { await fd.close(); }
}

// ---- filename-derived claims ------------------------------------------------
function filenameClaims(fn) {
  const claims = [];
  const stem = fn.replace(/\.pdf$/i, "");
  const doi = stem.match(/10\.\d{4,9}\/[^\s"']+$/);
  if (doi) claims.push({ field: "doi", value: doi[0], from: "filename" });
  const arx = stem.match(/\b(\d{4}\.\d{4,5})(v\d+)?\b/);
  if (arx && /^arxiv/i.test(stem)) claims.push({ field: "source_hint", value: "arxiv", from: "filename pattern" });
  if (/^\d{9,10}-[A-Za-z0-9]+-\d{4}-Article-\d+/.test(stem)) claims.push({ field: "source_hint", value: "springer-style filename", from: "filename pattern" });
  if (/^PMC\d+/.test(stem)) claims.push({ field: "source_hint", value: "pmc-style filename", from: "filename pattern" });
  const yr = stem.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  if (yr) claims.push({ field: "year", value: yr[1], from: "filename" });
  // filename-derived title claim: strip conventions, dashes/underscores -> spaces
  const ft = stem.replace(/^OA-(\d{4}-)?/i, "").replace(/^SCRIBD(-PROVISIONAL)?-/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (ft) claims.push({ field: "title", value: ft, from: "filename" });
  return claims;
}

// ---- main -------------------------------------------------------------------
const sessionLogPath = path.join(ROOT, "SESSION-LOG.txt");
const logIdx = fs.existsSync(sessionLogPath) ? parseSessionLog(fs.readFileSync(sessionLogPath, "utf8")) : new Map();

const records = fs.readFileSync(INV, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const out = [];
const conflicts = [];
let withTitle = 0, withAuthor = 0, withYear = 0, withDoi = 0;
const provCounts = {};
let logMatched = 0;

for (const rec of records) {
  const fn = rec.original_filename;
  const { headS, tailS } = await readRegions(rec.current_path);
  const scan = tailS + "\n" + headS; // tail first: Info/XMP usually near end

  const claims = [];
  const push = (field, value, from) => { if (value) claims.push({ field, value: String(value).slice(0, 500), from }); };

  // PDF Info dict
  push("title", infoValue(scan, "Title"), "pdf-info");
  push("author", infoValue(scan, "Author"), "pdf-info");
  const cd = (infoValue(scan, "CreationDate") ?? "").match(/D:(\d{4})/);
  if (cd) push("year", cd[1], "pdf-info CreationDate");
  push("producer", infoValue(scan, "Producer"), "pdf-info");
  // XMP
  push("title", xmpValue(scan, "dc:title"), "xmp");
  const xc = xmpValue(scan, "dc:creator");
  if (xc) push("author", xc.replace(/\s*;\s*/g, "; "), "xmp");
  const xd = (xmpValue(scan, "xmp:CreateDate") ?? "").match(/(\d{4})-/);
  if (xd) push("year", xd[1], "xmp CreateDate");
  // DOI anywhere in scanned regions
  const doi = scan.match(/10\.\d{4,9}\/[^\s"'<>\\)\]]+/);
  if (doi) push("doi", doi[0].replace(/[.,;]+$/, ""), "pdf internal");
  // filename claims
  claims.push(...filenameClaims(fn));

  // resolve display values: pdf/xmp claims win over filename; disagreement preserved
  const pick = (field) => {
    const cs = claims.filter((c) => c.field === field);
    if (!cs.length) return { v: "unknown", src: null, conflict: false };
    const distinct = [...new Set(cs.map((c) => c.value))];
    // mechanical demotion: producer-artifact titles ("Microsoft Word - …", "untitled",
    // layout-app droppings) lose to any filename-derived claim; disagreement still preserved.
    const artifact = (v) => /^(microsoft word|word|powerpoint|untitled|adobe|layout)\b/i.test(v) || v.length < 4;
    let pool = cs;
    const fnClaims = cs.filter((c) => c.from === "filename");
    const otherClaims = cs.filter((c) => c.from !== "filename");
    if (field === "title" && fnClaims.length && otherClaims.length && otherClaims.every((c) => artifact(c.value))) pool = fnClaims;
    const winner = pool.find((c) => /pdf-info|xmp|pdf internal/.test(c.from)) ?? pool[0];
    return { v: winner.value, src: winner.from, conflict: distinct.length > 1 };
  };
  const t = pick("title"), a = pick("author"), y = pick("year"), d = pick("doi");
  rec.title = t.v; rec.title_source = t.src;
  rec.author = a.v; rec.author_source = a.src;
  rec.year = y.v; rec.year_source = y.src;
  rec.doi = d.v === "unknown" ? null : d.v;
  rec.metadata_claims = claims;

  // provenance
  const logHits = logIdx.get(fn);
  if (logHits?.length) {
    logMatched++;
    const first = logHits[0];
    const acq = logHits.find((h) => !h.skipped) ?? first;
    rec.source = acq.source ?? "harvest-oa rail";
    rec.acquired_at = first.skipped ? `<= ${first.acquired_at}` : acq.acquired_at;
    rec.harvest_phase = acq.phase;
    rec.harvest_topic = acq.topic;
    rec.provenance = `harvest-oa rail receipt (SESSION-LOG ${logHits.length} line${logHits.length > 1 ? "s" : ""}${first.skipped ? ", earliest is a skip => predates log" : ""})`;
    provCounts["rail receipt"] = (provCounts["rail receipt"] ?? 0) + 1;
  } else if (fn.startsWith("OA-")) {
    rec.source = "harvest-oa rail";
    rec.provenance = "unknown (OA- filename convention; no SESSION-LOG line)";
    provCounts["rail, unreceipted"] = (provCounts["rail, unreceipted"] ?? 0) + 1;
  } else {
    const hint = claims.find((c) => c.field === "source_hint");
    rec.source = hint ? hint.value : "unknown";
    rec.provenance = hint ? "unknown (inferred from filename pattern — not authority)" : "unknown";
    provCounts[rec.source] = (provCounts[rec.source] ?? 0) + 1;
  }

  if (t.conflict || a.conflict || y.conflict) conflicts.push({ id: rec.id, path: rec.current_path, claims: claims.filter((c) => ["title", "author", "year"].includes(c.field)) });
  if (rec.title !== "unknown") withTitle++;
  if (rec.author !== "unknown") withAuthor++;
  if (rec.year !== "unknown") withYear++;
  if (rec.doi) withDoi++;
  out.push(rec);
}

await fsp.writeFile(path.join(REC_DIR, `enriched-${DAY}.jsonl`), out.map((r) => JSON.stringify(r)).join("\n") + "\n");
await fsp.writeFile(path.join(REC_DIR, `metadata-conflicts-${DAY}.json`), JSON.stringify({ generated_at: new Date().toISOString(), conflicts }, null, 2));
const report = {
  generated_at: new Date().toISOString(), source_inventory: path.basename(INV),
  records: out.length, with_title: withTitle, with_author: withAuthor, with_year: withYear, with_doi: withDoi,
  session_log_files_indexed: logIdx.size, session_log_matched: logMatched,
  provenance_summary: provCounts, metadata_conflicts: conflicts.length,
};
await fsp.writeFile(path.join(REC_DIR, `enrichment-report-${DAY}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
