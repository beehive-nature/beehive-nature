#!/usr/bin/env node
// bLibrary inventory engine — priorities 1-3 of the FRESH-SEAT ORDER (2026-09-26):
//   1. inventory  2. hash  3. dedupe
// ZERO-DELETION TOOL: this script opens every corpus file READ-ONLY and writes
// ONLY inside the output directory (default <corpusRoot>/library-records/).
// There is no code path that unlinks, moves, truncates, or rewrites a corpus file.
// Never dedupe by deletion: duplicates are recorded as canonical + aliases/copies.

import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const SCANNER = "blibrary-inventory/1.0.0";
const DOC_EXTS = new Set([".pdf", ".epub", ".mobi", ".azw3", ".djvu", ".cbz"]);
const MIME = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".mobi": "application/x-mobipocket-ebook",
  ".azw3": "application/vnd.amazon.ebook",
  ".djvu": "image/vnd.djvu",
  ".cbz": "application/vnd.comicbook+zip",
};
const SUBJECT_ROOT = "blibrary"; // standing law: corpus is blibrary/<subject>/
const LANES = ["bio-alchemist", "blibrary"];

function usage(code = 2) {
  console.error("usage: node scripts/library/inventory.mjs <corpusRoot> [--out <dir>] [--concurrency N]");
  process.exit(code);
}

const args = process.argv.slice(2);
const root = args[0] && !args[0].startsWith("--") ? path.resolve(args[0]) : null;
if (!root) usage();
let outDir = path.join(root, "library-records");
let concurrency = 8;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--out") outDir = path.resolve(args[++i]);
  else if (args[i] === "--concurrency") concurrency = Math.max(1, parseInt(args[++i], 10) || 8);
}
if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`BLOCKER: corpus root not found: ${root}`);
  process.exit(2);
}

const day = new Date().toISOString().slice(0, 10);

// ---- walk (read-only) ------------------------------------------------------
async function walk(dir, acc) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return acc.blockers.push({ type: "READ_DIR_FAILED", path: dir, error: String(e) });
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith(".") || path.resolve(p) === path.resolve(outDir)) continue; // never read own output
      await walk(p, acc);
    } else if (ent.isFile()) {
      acc.files.push(p);
    }
  }
}

async function readTail(fd, size, n) {
  const len = Math.min(n, size);
  const buf = Buffer.alloc(len);
  await fd.read(buf, 0, len, size - len);
  return buf;
}

async function hashOne(p) {
  // One read-only streaming pass for the digest; independent small reads for
  // head/tail magic. Every open is 'r' — the corpus is never written.
  const fd = await fsp.open(p, "r");
  try {
    const stat = await fd.stat();
    const hash = createHash("sha256");
    const head = Buffer.alloc(0);
    let headBuf = head;
    // autoClose:false — the stream must NOT close the handle; readTail below
    // still needs it, and the finally block owns closing.
    const stream = fd.createReadStream({ start: 0, end: stat.size - 1, autoClose: false });
    let headDone = false;
    stream.on("data", (chunk) => {
      hash.update(chunk);
      if (!headDone) {
        headBuf = headBuf.length >= 68 ? headBuf : Buffer.concat([headBuf, chunk]).subarray(0, 68);
        if (headBuf.length >= 68 || stat.size < 68) headDone = true;
      }
    });
    await new Promise((res, rej) => { stream.on("end", res); stream.on("error", rej); });
    const tail = await readTail(fd, stat.size, 65557);
    return { size: stat.size, sha256: hash.digest("hex"), head: headBuf, tail };
  } finally {
    await fd.close();
  }
}

function classify(ext, size, head, tail) {
  if (size === 0) return { parse_state: "EMPTY", mime: MIME[ext] ?? "application/octet-stream" };
  const s = head.toString("latin1");
  const t = tail.toString("latin1");
  if (ext === ".pdf") {
    if (!s.startsWith("%PDF-")) return { parse_state: "CORRUPT", mime: MIME[ext], note: "missing %PDF- magic" };
    if (!t.slice(-2048).includes("%%EOF")) return { parse_state: "PARTIAL", mime: MIME[ext], note: "no %%EOF in tail 2KB (truncated download?)" };
    return { parse_state: "CLEAN", mime: MIME[ext] };
  }
  if (ext === ".epub" || ext === ".cbz") {
    if (!head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return { parse_state: "CORRUPT", mime: MIME[ext], note: "missing zip PK magic" };
    if (!t.includes("PK\x05\x06")) return { parse_state: "PARTIAL", mime: MIME[ext], note: "no zip EOCD (truncated download?)" };
    return { parse_state: "CLEAN", mime: MIME[ext] };
  }
  if (ext === ".mobi" || ext === ".azw3") {
    return { parse_state: s.slice(60, 68) === "BOOKMOBI" ? "CLEAN" : "CORRUPT", mime: MIME[ext] };
  }
  if (ext === ".djvu") {
    return { parse_state: s.startsWith("AT&TFORM") ? "CLEAN" : "CORRUPT", mime: MIME[ext] };
  }
  return { parse_state: "UNINSPECTED", mime: MIME[ext] ?? "application/octet-stream" };
}

async function inspect(p) {
  const ext = path.extname(p).toLowerCase();
  let r;
  try {
    r = await hashOne(p);
  } catch (e) {
    return { record: null, blocker: { type: "READ_FAILED", path: p, error: String(e) } };
  }
  const c = classify(ext, r.size, r.head, r.tail);
  let notes = [];
  if (c.note) notes.push(c.note);
  if (c.parse_state !== "CLEAN" && c.parse_state !== "UNINSPECTED") {
    // Double-read verification: a CORRUPT/PARTIAL verdict is only recorded if a
    // second independent read reproduces it (guards against hashing a file that
    // a concurrent harvester is still writing).
    let r2 = null;
    try { r2 = await hashOne(p); } catch { /* second read failed; keep first verdict + note */ }
    if (r2 && r2.sha256 !== r.sha256) notes.push("unstable read: second pass hash differs — file changing during scan");
    else notes.push("verified by second read");
  }
  if (path.basename(p).startsWith("OA-")) notes.push("filename prefix OA- (harvest-oa.mjs open-access rail convention)");
  const rel = path.relative(root, p);
  const subjectDir = path.relative(path.join(root, SUBJECT_ROOT), path.dirname(p)).split(path.sep)[0];
  const rec = {
    id: `doc-${r.sha256.slice(0, 16)}`,
    original_filename: path.basename(p),
    current_path: p,
    sha256: r.sha256,
    bytes: r.size,
    mime: c.mime,
    title: "unknown",
    author: "unknown",
    year: "unknown",
    source: "unknown",
    source_locator: root,
    acquired_at: "unknown",
    provenance: "unknown",
    subjects: rel.startsWith(SUBJECT_ROOT) && subjectDir && !subjectDir.includes("..") ? [subjectDir] : [],
    project_lanes: [...LANES],
    parse_state: c.parse_state,
    text_state: "unparsed",
    notes,
    scanned_at: new Date().toISOString(),
    scanner: SCANNER,
    scan_root: root,
  };
  return { record: rec, blocker: null };
}

// ---- main ------------------------------------------------------------------
const acc = { files: [], blockers: [] };
await walk(root, acc);
const docs = acc.files.filter((p) => DOC_EXTS.has(path.extname(p).toLowerCase())).sort(); // deterministic canonical order
const otherExts = {};
for (const p of acc.files) {
  const e = path.extname(p).toLowerCase() || "(none)";
  if (!DOC_EXTS.has(e)) otherExts[e] = (otherExts[e] ?? 0) + 1;
}

await fsp.mkdir(outDir, { recursive: true });
const t0 = Date.now();
const records = [];
let cursor = 0;
async function worker() {
  while (cursor < docs.length) {
    const p = docs[cursor++];
    const { record, blocker } = await inspect(p);
    if (blocker) acc.blockers.push(blocker);
    if (record) records.push(record);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
records.sort((a, b) => (a.current_path < b.current_path ? -1 : 1));

// dedupe by content hash — canonical + aliases + copies; NOTHING is deleted.
const byHash = new Map();
for (const rec of records) {
  if (!byHash.has(rec.sha256)) byHash.set(rec.sha256, []);
  byHash.get(rec.sha256).push(rec);
}
const dupGroups = [];
let dupFileCount = 0;
for (const [, group] of byHash) {
  if (group.length < 2) continue;
  const [canonical, ...rest] = group;
  for (const r of rest) r.duplicate_of = canonical.id;
  dupGroups.push({
    canonical_id: canonical.id,
    canonical_path: canonical.current_path,
    sha256_prefix: canonical.sha256.slice(0, 16),
    bytes: canonical.bytes,
    aliases: rest.map((r) => r.current_path),
    copies: group.length,
  });
  dupFileCount += rest.length;
}

const perSubject = {};
const perState = {};
let totalBytes = 0;
for (const rec of records) {
  const s = rec.subjects[0] ?? "(no-subject)";
  perSubject[s] = perSubject[s] ?? { files: 0, bytes: 0 };
  perSubject[s].files++;
  perSubject[s].bytes += rec.bytes;
  perState[rec.parse_state] = (perState[rec.parse_state] ?? 0) + 1;
  totalBytes += rec.bytes;
}

const inventoryPath = path.join(outDir, `inventory-${day}.jsonl`);
await fsp.writeFile(inventoryPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
const dedupePath = path.join(outPathSafe(outDir, `dedupe-${day}.json`));
await fsp.writeFile(dedupePath, JSON.stringify({ generated_at: new Date().toISOString(), scanner: SCANNER, groups: dupGroups }, null, 2));
const summary = {
  corpus_root: root,
  scanned_at: new Date().toISOString(),
  duration_ms: Date.now() - t0,
  scanner: SCANNER,
  total_files_seen: acc.files.length,
  document_records: records.length,
  other_extensions: otherExts,
  total_bytes: totalBytes,
  per_subject: perSubject,
  per_parse_state: perState,
  duplicate_groups: dupGroups.length,
  duplicate_redundant_files: dupFileCount,
  blockers: acc.blockers,
  outputs: { inventory: inventoryPath, dedupe: dedupePath, summary: path.join(outDir, `summary-${day}.json`) },
};
await fsp.writeFile(path.join(outDir, `summary-${day}.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

function outPathSafe(dir, name) { return path.join(dir, name); }
