#!/usr/bin/env node
// Date-class repair, driven by MECHANISM and not by row. 2026-09-22.
//
// Two mechanical bugs produce 26 records whose death precedes their birth:
//
//   H1  the two endpoints were written in the wrong order        -> swap them
//   H2  the BIRTH endpoint lost its BC marker while death kept it -> restore it
//
// Every row is assigned by a predicate, never by hand, and the assignment is
// recorded per row in the receipt. A row that BOTH mechanisms fit would be a
// coin flip on the founder's family record; there are none, and this script
// refuses to run if that ever stops being true.
//
// THE PLAUSIBILITY CONSTRAINT IS LOAD-BEARING. A repair only counts if the
// repaired span lands inside a human range. Without it, "swap the endpoints"
// explains a 2,749-year lifespan, claims every row its rival would have
// explained, AND EMPTIES THE RESIDUE — which would license swapping a
// legendary king into a 598-year life and calling it a fix. A residue of zero
// is a symptom, not a success.
//
// The same 110 is the reporter's HEURISTIC threshold, where it is explicitly
// not a defect detector. That is not a contradiction: a heuristic is sound as
// a classifier GUARD and unsound as a DETECTOR. Guarding, being wrong means
// declining a repair you could have made. Detecting, being wrong means
// asserting a defect that is not there. The costs are asymmetric.
//
// TWO ROWS ARE NOT REPAIRED. Their swap is arithmetically fine and then
// contradicts an UNCHANGED parent, so either the swap is wrong for that record
// or the parent edge is — and nothing here can tell which. Defect proven,
// direction not established: that is Class C, and Class C is marked, never
// guessed.
//
// The corpus is rewritten LINE-WISE, not re-serialised: it carries 79,928
// escaped unicode sequences that JSON.stringify would unescape, turning a
// 21-line repair into a 7 MB diff.
import { readFileSync, writeFileSync } from "node:fs";

const LINEAGE = new URL("../../assets/profile-archive/lineage/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const CORPUS = LINEAGE + "remington-bloodline.json";
const RECEIPT = LINEAGE + "date-repairs-2026-09-22.json";

const PLAUSIBLE_YEARS = 110;
// Ruled Class C: the repair is undetermined, so the record is left alone and
// carried as a marked defect instead.
const CLASS_C = new Set(["pd5ba3146d4", "p16a20d92e7"]);

const DASH = /[–\-]/;
const isBC = (t) => /BC\s*$/i.test((t || "").trim());
const num = (t) => { const n = parseInt((t || "").trim().replace(/BC\s*$/i, ""), 10); return Number.isFinite(n) ? n : null; };
const yr = (t) => { const n = num(t); return n === null ? null : (isBC(t) ? -n : n); };
const halves = (s) => { if (typeof s !== "string") return null; const a = s.split(DASH); return a.length === 2 ? a : null; };

const raw = readFileSync(CORPUS, "utf8");
const model = JSON.parse(raw);

// ── classify
const plan = [];
const residue = [];
let ambiguous = 0;
for (const [id, p] of Object.entries(model.persons)) {
  const h = halves(p.lifespan);
  if (!h) continue;
  const bt = h[0].trim(), dt = h[1].trim();
  const b = yr(bt), d = yr(dt);
  if (b === null || d === null || d >= b) continue;

  const swapSpan = b - d;
  const h1 = swapSpan >= 0 && swapSpan <= PLAUSIBLE_YEARS;
  let h2 = false, bcSpan = null;
  if (!isBC(bt) && isBC(dt)) { bcSpan = d - (-num(bt)); h2 = bcSpan >= 0 && bcSpan <= PLAUSIBLE_YEARS; }

  if (h1 && h2) { ambiguous++; continue; }
  if (h1) plan.push({ id, name: p.name, mechanism: "H1", was: p.lifespan, now: `${dt}${p.lifespan.match(DASH)[0]}${bt}`, span: swapSpan });
  else if (h2) plan.push({ id, name: p.name, mechanism: "H2", was: p.lifespan, now: `${num(bt)}BC${p.lifespan.match(DASH)[0]}${dt}`, span: bcSpan });
  else residue.push({ id, name: p.name, lifespan: p.lifespan });
}

if (ambiguous !== 0) {
  console.error(`REFUSING: ${ambiguous} record(s) fit BOTH mechanisms. Assigning one would be a guess on a family record.`);
  process.exit(1);
}
const classC = plan.filter((r) => CLASS_C.has(r.id));
const apply = plan.filter((r) => !CLASS_C.has(r.id));
if (classC.length !== CLASS_C.size) {
  console.error(`REFUSING: expected ${CLASS_C.size} Class C rows in the plan, found ${classC.length}. The ruling and the data disagree.`);
  process.exit(1);
}

// ── rewrite, line-wise, keyed by the id block each lifespan belongs to
const ID_LINE = /^\s{2}"([^"]+)":\s*\{\s*$/;
const LIFESPAN_LINE = /^(\s*"lifespan":\s*)"(.*)"(,?)\s*$/;
const byId = new Map(apply.map((r) => [r.id, r]));
const lines = raw.split("\n");
let current = null, applied = 0;
for (let i = 0; i < lines.length; i++) {
  const idm = lines[i].match(ID_LINE);
  if (idm) { current = idm[1]; continue; }
  if (!current || !byId.has(current)) continue;
  const lm = lines[i].match(LIFESPAN_LINE);
  if (!lm) continue;
  const row = byId.get(current);
  if (lm[2] !== row.was) {
    console.error(`REFUSING: ${current} lifespan line reads "${lm[2]}", expected "${row.was}".`);
    process.exit(1);
  }
  lines[i] = `${lm[1]}"${row.now}"${lm[3]}`;
  applied++;
  byId.delete(current);
}
if (byId.size !== 0) {
  console.error(`REFUSING: ${byId.size} planned row(s) never matched a lifespan line: ${[...byId.keys()].join(", ")}`);
  process.exit(1);
}
if (applied !== apply.length) {
  console.error(`REFUSING: applied ${applied}, planned ${apply.length}.`);
  process.exit(1);
}

const out = lines.join("\n");
JSON.parse(out); // refuse to write anything that is not valid JSON
writeFileSync(CORPUS, out, "utf8");
writeFileSync(RECEIPT, JSON.stringify({
  generated: "2026-09-22",
  corpus: "remington-bloodline.json",
  plausible_years: PLAUSIBLE_YEARS,
  mechanisms: {
    H1: "endpoints written in the wrong order; swapped",
    H2: "birth endpoint lost its BC marker while death kept it; restored",
  },
  repaired: apply,
  class_c_not_repaired: classC.map((r) => ({ ...r, why: "swap contradicts an unchanged parent; direction not established" })),
  residue_no_edit: residue,
}, null, 1) + "\n", "utf8");

console.log(`repaired ${applied} records (H1 ${apply.filter((r) => r.mechanism === "H1").length} · H2 ${apply.filter((r) => r.mechanism === "H2").length})`);
console.log(`class C not repaired: ${classC.length}  ·  residue no edit: ${residue.length}  ·  ambiguous: ${ambiguous}`);
console.log(`receipt: ${RECEIPT}`);
