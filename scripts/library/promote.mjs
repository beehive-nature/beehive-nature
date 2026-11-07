#!/usr/bin/env node
// bLibrary scoped promoter — files the unsorted bucket's evidence-cleared items.
// For each entry: (1) add an OVERRIDES line to blibrary-subjects.mjs (the
// documented promotion path) if absent, (2) move unsorted/<file> -> subject/,
// (3) append one dated SESSION-LOG receipt block. Idempotent; never deletes;
// NEVER touches files outside the explicit batch (SCRIBD root files are the
// Scribd lane's, moved by no one but that lane).
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2] ?? "");
if (!ROOT) { console.error("usage: promote.mjs <corpusRoot>"); process.exit(2); }
const SUBJ = path.join(ROOT, "blibrary-subjects.mjs");
const UNS = path.join(ROOT, "blibrary", "unsorted");

// batch of 2026-09-29 — evidence: pdf titles + peek-pdf-text extraction,
// receipted in docs/dispatches/2026-09-29-blibrary-unsorted-review.md
const BATCH = [
  { file: "1015914871-415-2017-Article-8663.pdf", subject: "cannabinoid-medicine", why: "Springer 2017 'Cannabidiol as a treatment for epilepsy'" },
  { file: "998571204-1-s2-0-S2214714425001096-main.pdf", subject: "extraction-biorefinery", why: "Elsevier review: cellulose/lignin/hemicellulose recovery from lignocellulosic biomass" },
  { file: "727071312-nutrients-12-03704-v3.pdf", subject: "hemp-food-nutrition", why: "Nutrients 2020 review: plant proteins, nutritional quality" },
  { file: "825471728-Henrietta-s-CHAPTER-ONE-1.pdf", subject: "cannabis-policy-economics", why: "thesis ch.1 'Legalizing cannabis for medical and industrial uses'" },
  { file: "988186462-Chad-Ulven-CV.pdf", subject: "hemp-fibre-composites", why: "NDSU mechanical-eng biocomposites researcher CV" },
  { file: "861926864-C05-PPT-Slides-2021.pdf", subject: "green-reset-books", why: "'Bitcoin, blockchain, and cryptocurrencies' chapter slides (Pedersen)" },
];

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
let subjSrc = fs.readFileSync(SUBJ, "utf8");
const moved = [], skippedOv = [], skippedMove = [];

for (const b of BATCH) {
  const ovLine = `  '${b.file}': ${b.subject === "green-reset-books" ? "GREEN_RESET_BOOKS" : `'${b.subject}'`}, // ${b.why} (bLibrary promote ${stamp.slice(0, 10)})`;
  if (!subjSrc.includes(`'${b.file}'`)) {
    const anchor = subjSrc.match(/  'in vitro bioactivity\.pdf'[^\n]*\n/);
    if (!anchor) { console.error("BLOCKER: OVERRIDES anchor not found — module changed shape"); process.exit(2); }
    subjSrc = subjSrc.replace(anchor[0], anchor[0] + ovLine + "\n");
  } else skippedOv.push(b.file);
  const from = path.join(UNS, b.file);
  const toDir = path.join(ROOT, "blibrary", b.subject);
  const to = path.join(toDir, b.file);
  if (fs.existsSync(to)) skippedMove.push(`${b.file} (already at destination)`);
  else if (!fs.existsSync(from)) skippedMove.push(`${b.file} (not in unsorted)`);
  else moved.push({ from, to });
}
fs.writeFileSync(SUBJ, subjSrc);
// gate: the shared module must still import cleanly before any file moves
const mod = await import(pathToFileURL(SUBJ).href);
if (!mod.OVERRIDES) { console.error("BLOCKER: edited module lost OVERRIDES export"); process.exit(2); }

for (const m of moved) {
  fs.mkdirSync(path.dirname(m.to), { recursive: true });
  await fsp.rename(m.from, m.to);
}

const log = [
  `--- ${stamp} — bLibrary FILING (promote.mjs, scoped; receipt docs/dispatches/2026-09-29-blibrary-unsorted-review.md) ---`,
  `unsorted review 2026-09-29: 10 files examined; ${moved.length} filed on extracted-text/title evidence;`,
  ...moved.map((m) => `  ${path.basename(m.from)}  ->  blibrary/${path.basename(path.dirname(m.to))}/`),
  `STAY unsorted (documented, not guessed): 1055440149-SB-220.pdf (legislative text, no hemp/cannabis terms extractable),`,
  `  849494705-ProjectPresentation2.pdf (no extractable text), SelfAuthentication.pdf + bnr-mission-control.pdf (estate-internal artifacts).`,
  `SCRIBD root files untouched (Scribd lane's manifest owns them). OVERRIDES updated for all promoted names.`,
].join("\n");
fs.appendFileSync(path.join(ROOT, "SESSION-LOG.txt"), "\n" + log + "\n");
console.log(JSON.stringify({ filed: moved.length, overrides_added: BATCH.length - skippedOv.length, skipped_overrides_existing: skippedOv, skipped_moves: skippedMove }, null, 1));
