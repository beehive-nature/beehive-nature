#!/usr/bin/env node
// bLibrary routing pass — priority 8 (research-priority routing labels).
// LABELS FOR FINDING research, never for ranking its truth or hiding material.
// Additive only: writes routed-<day>.jsonl = enriched records + a `routing` block;
// never mutates enriched/inventory files, never touches corpus documents.
// Every label carries WHY (human-readable) + EVIDENCE (the exact fields used).
// `decisive` is NEVER auto-assigned — reserved for human/Laya judgment.
// Uncertainty is preserved: unmatched inputs yield unknown/partial, never a guess.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "");
const DAY = new Date().toISOString().slice(0, 10);
const REC = path.join(ROOT, "library-records");
const files = fs.existsSync(REC) ? fs.readdirSync(REC).filter((f) => /^enriched-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort() : [];
if (!files.length) { console.error("BLOCKER: no enriched-*.jsonl — run enrich.mjs first"); process.exit(2); }
const records = fs.readFileSync(path.join(REC, files[files.length - 1]), "utf8").trim().split("\n").map(JSON.parse);

// current phase, cited from the rail's own state file (two-phase law)
const PHASES = ["cannabis-hemp", "sassafras-extraction"];
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "harvest-state.json"), "utf8"));
const CURRENT_PHASE = PHASES[state.phase] ?? null;

// ---- rule tables (documented; every assignment cites its inputs) ------------
const DOMAIN_BY_SUBJECT = {
  "cannabinoid-medicine": ["cannabis", "medicine"],
  "cannabis-policy-economics": ["cannabis", "economics"],
  "hemp-agronomy": ["hemp"],
  "hemp-fibre-composites": ["hemp", "manufacturing"],
  "hemp-construction-materials": ["hemp", "manufacturing"],
  "hemp-environment-lca": ["hemp"],
  "hemp-food-nutrition": ["hemp", "physiology"],
  "extraction-biorefinery": ["manufacturing"],
  "essential-oil-distillation": ["manufacturing"],
  "sassafras-botany": ["other"],            // botany has no slot in the charter's domain list
  "safrole-toxicology-regulation": ["medicine"],
  "tree-biomass-forestry": ["other"],       // forestry has no slot; noted, not forced
  "green-reset-books": ["other"],           // per-book keyword pass below refines this
};
const DOMAIN_KEYWORDS = [
  [/bitcoin|blockchain|cryptocurrenc/i, "cryptography"],
  [/robot|automation|ai\b|artificial intelligence/i, "robotics"],
  [/industrial revolution|margin cost|econom/i, "economics"],
  [/democracy|govern/i, "governance"],
  [/sapiens|humankind|history of/i, "history"],
  [/permaculture|cradle to cradle|designers manual/i, "other"],
  [/cannabis|hemp|marijuana/i, "cannabis"],
];
const EVIDENCE_RULES = [
  [/handbook|manual|field guide/i, "manual"],
  [/\bASTM\b|\bISO\b|\bEN \d+|specification|standard (method|practice|test)/i, "specification"],
  [/dataset|data supplement|supporting data/i, "dataset"],
];

function route(r) {
  const ev = [];
  const cite = (field, value) => ev.push({ field, value: String(value).slice(0, 200) });
  const subject = r.subjects[0] ?? null;
  const isScribd = r.original_filename.startsWith("SCRIBD");
  const text = `${r.title ?? ""} ${r.original_filename}`;

  // domain — folder table is the filing axis; keyword matches are PROVISIONAL
  // subject clues (acquisition topic / title / filename), kept separate.
  let domains = subject ? [...(DOMAIN_BY_SUBJECT[subject] ?? [])] : [];
  if (domains.length) cite("subjects[0]", subject);
  let provisional = [];
  for (const [re, d] of DOMAIN_KEYWORDS) {
    if (domains[0] === "other" && re.test(text)) { provisional = [d]; cite("keyword clue (provisional)", text.match(re)[0]); break; }
  }
  if (!domains.length) domains = [];

  // evidence_type
  let et = "unknown", etWhy = "no mechanical rule matched";
  if (isScribd || subject === "green-reset-books") { et = "book"; etWhy = isScribd ? "SCRIBD lane book (SCRIBD-MANIFEST curriculum)" : "filed under green-reset-books (founder reading curriculum)"; cite("original_filename", r.original_filename); }
  else if (r.doi) { et = "paper"; etWhy = "DOI present in PDF"; cite("doi", r.doi); }
  else {
    for (const [re, t] of EVIDENCE_RULES) if (re.test(text)) { et = t; etWhy = `title/filename matched ${t} pattern`; cite("title/filename keyword", text.match(re)[0]); break; }
    if (et === "unknown" && r.year !== "unknown" && Number(r.year) >= 1500 && Number(r.year) <= 1950 && r.year_source !== "pdf-info CreationDate" && r.year_source !== "xmp CreateDate") { et = "archive-record"; etWhy = `year ${r.year} from ${r.year_source} (non-producer textual claim) — archival capture candidate`; cite("year", `${r.year} (from ${r.year_source})`); }
    if (et === "unknown" && r.source === "harvest-oa rail") { et = "paper"; etWhy = "OA-rail journal capture (no DOI embedded)"; cite("source", r.source); }
  }

  // research_value — retrieval priority for ACTIVE fronts, cited; never truth
  let value = "unknown", why = "no routing rule matched";
  if (r.parse_state !== "CLEAN") { value = "unknown"; why = `parse_state=${r.parse_state} — integrity first, routing deferred`; cite("parse_state", r.parse_state); }
  else if (r.harvest_phase && r.harvest_phase === CURRENT_PHASE) { value = "high"; why = `aligned with the ACTIVE collection program: acquired under current harvest phase (${CURRENT_PHASE}, harvest-state.json phase=${state.phase}) — collection-program relevance, NOT evidence quality`; cite("harvest_phase", r.harvest_phase); cite("harvest-state.json phase", state.phase); }
  else if (isScribd) { value = "high"; why = "aligned with the ACTIVE collection program: founder 150-book Scribd curriculum, deadline 2026-10-13 (SCRIBD-MANIFEST target) — collection-program relevance, NOT evidence quality"; cite("original_filename", r.original_filename); }
  else if (subject === "green-reset-books") { value = "useful"; why = "green-reset reading curriculum holdings"; cite("subjects[0]", subject); }
  else if (r.harvest_phase === "cannabis-hemp") { value = "useful"; why = "phase-0 corpus (cannabis-hemp, 1000-PDF target era) — completed phase, background corpus"; cite("harvest_phase", r.harvest_phase); }
  else if (subject === "unsorted") { value = "unknown"; why = "filed in unsorted/ — taxonomy review pending (blibrary-subjects OVERRIDES queue)"; cite("subjects[0]", subject); }
  else if (subject) { value = "routine"; why = "subject-filed corpus document, no active-front signal in metadata"; cite("subjects[0]", subject); }
  else { value = "unknown"; why = "no subject folder and no harvest receipt — file as-is, needs manual review"; }

  const confidence = value !== "unknown" && domains.length ? "rule-matched" : value !== "unknown" || domains.length ? "partial" : "unknown";
  return {
    domain: domains, domain_provisional: provisional, evidence_type: et, research_value: value,
    why: `${why}; evidence_type=${et} (${etWhy})`,
    evidence: ev, confidence, decisive_note: "decisive is never auto-assigned (human/Laya only)",
    routed_at: new Date().toISOString(), router: "blibrary-route/1.0.1", current_phase: CURRENT_PHASE,
  };
}

const out = records.map((r) => ({ ...r, routing: route(r) }));
await fsp.writeFile(path.join(REC, `routed-${DAY}.jsonl`), out.map((r) => JSON.stringify(r)).join("\n") + "\n");

const count = (fn) => out.filter(fn).length;
const report = {
  generated_at: new Date().toISOString(), source: files[files.length - 1], records: out.length,
  current_phase: CURRENT_PHASE, current_phase_source: "harvest-state.json (phase index)",
  research_value: Object.fromEntries(["high", "useful", "routine", "unknown"].map((v) => [v, count((r) => r.routing.research_value === v)])),
  evidence_type: out.reduce((a, r) => ((a[r.routing.evidence_type] = (a[r.routing.evidence_type] ?? 0) + 1), a), {}),
  domain: out.reduce((a, r) => { for (const d of r.routing.domain) a[d] = (a[d] ?? 0) + 1; return a; }, {}),
  domain_provisional: out.reduce((a, r) => { for (const d of r.routing.domain_provisional) a[d] = (a[d] ?? 0) + 1; return a; }, {}),
  confidence: out.reduce((a, r) => ((a[r.routing.confidence] = (a[r.routing.confidence] ?? 0) + 1), a), {}),
  decisive_auto_assigned: 0,
  law: "labels explain relevance with cited metadata and preserved uncertainty; they never rank truth or hide material. research_value = collection-program relevance (active phase / curriculum), never evidence quality. Harvest topics and filename/title keywords are PROVISIONAL subject clues, kept in domain_provisional. PDF CreationDate is producer metadata, never publication year (year display prefers textual claims).",
};
await fsp.writeFile(path.join(REC, `routing-report-${DAY}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
