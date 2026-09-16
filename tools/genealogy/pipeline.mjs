// ── pipeline: raw walk JSON → model → public artifacts ──────────────────────
//   node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json] [spine-target-regex]
// The spine terminus defaults to the earliest-birth bloodline person; pass a
// name regex to pin it (e.g. "Sigurd Ring de Trondheim").
import { readFileSync, writeFileSync } from "node:fs";
import { createModel, addPerson, addEdge, addCouple, bloodline, spine, depths, validate, birthYear } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";

const [rawPath, corpusOut, pageOut, spineRx] = process.argv.slice(2);
if (!rawPath || !corpusOut) {
  console.error("usage: node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json]");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const model = createModel({ root: raw.root, source: "familysearch" });
importWalk(model, raw);

const problems = validate(model).filter((p) => !p.startsWith("unresolved:"));
const unresolved = validate(model).length - problems.length;
if (problems.length) {
  console.error(`validation FAILED (${problems.length}):`);
  problems.slice(0, 10).forEach((p) => console.error("  - " + p));
  process.exit(1);
}

const blood = bloodline(model);
const d = depths(model);

// spine: pinned target when a regex is given, else the earliest-birth
// BLOODLINE person (in-law ancestry never defines the house line)
const bloodEntries = [...blood].map((id) => ({ id, ...model.persons[id] }));
let terminus;
if (spineRx) {
  const rx = new RegExp(spineRx, "i");
  terminus = bloodEntries.find((p) => !p.living && rx.test(p.name || ""));
} else {
  terminus = bloodEntries
    .filter((p) => !p.living && p.name !== "Living")
    .reduce((a, b) => (birthYear(b.lifespan ?? "") ?? 9999) <= (birthYear(a.lifespan ?? "") ?? 9999) ? b : a, undefined);
}
const spineChain = terminus ? (spine(model, terminus.id) || []) : [];

// public corpus (privatized)
// public set = deceased bloodline ∪ deceased spouses-of-bloodline (in-law
// ancestry beyond the immediate couple stays private)
const publishable = new Set(blood);
for (const c of Object.values(model.couples)) {
  if (blood.has(c.p1)) publishable.add(c.p2);
  if (blood.has(c.p2)) publishable.add(c.p1);
}
const pub = createModel({ root: model.root, source: model.source });
let redacted = 0;
for (const [id, p] of Object.entries(model.persons)) {
  if (p.living) { redacted++; continue; }
  if (!publishable.has(id)) continue;
  addPerson(pub, { ...p, id });
}
// the one living survivor: the root, as an anonymous anchor stub
if (model.root && model.persons[model.root]?.living) {
  pub.persons[model.root] = { name: "Living", lifespan: null, gender: null, living: true,
    evidence: { class: "living", basis: "era-heuristic" } };
}
for (const [child, ps] of Object.entries(model.edges)) if (pub.persons[child]) addEdge(pub, child, ps);
for (const c of Object.values(model.couples)) if (pub.persons[c.p1] && pub.persons[c.p2]) addCouple(pub, c.p1, c.p2, c.marriage);
const spineRows = spineChain.map((id, i) => {
  const p = model.persons[id];
  return p.living
    ? { i, n: "Living", l: null, t: "living" }
    : { i, n: p.name, l: p.lifespan, t: p.evidence.class, ...(p.sourceId ? { f: p.sourceId } : {}) };
});
pub.spine = spineRows; // the spine travels with the corpus for data consumers
pub.meta = {
  ...model.meta,
  source: "FamilySearch Family Tree, walked under the founder's signed-in session (fs-adapter)",
  stats: {
    personsWalked: Object.keys(model.persons).length,
    bloodlinePersons: blood.size,
    deceasedPublished: Object.keys(pub.persons).length,
    livingRedacted: redacted,
    spineGenerations: spineChain.length,
    spineReaches: terminus ? `${terminus.name} ${terminus.lifespan ?? ""}`.trim() : "(no spine target found)",
  },
  privacy: "living persons redacted — no names, dates, or source ids",
  confidenceTiers: "era heuristic (recorded ≥1850 · colonial 1550–1850 · medieval 1000–1550 · saga <1000); basis says era-heuristic until per-person source counts are harvested",
  claimPolicy: "every person carries its evidence class; the spine past the colonial era is traditional, not proven",
};
const pubProblems = validate(pub, { public: true }).filter((p) => !p.startsWith("unresolved:"));
if (pubProblems.length) {
  console.error(`PUBLIC validation FAILED (${pubProblems.length}):`);
  pubProblems.slice(0, 10).forEach((p) => console.error("  - " + p));
  process.exit(1);
}
writeFileSync(corpusOut, JSON.stringify(pub, null, 1) + "\n", "utf8");

// page-data: fan (7 rings) + spine + stats
function fanOf(id, gen, maxGen) {
  const p = model.persons[id];
  const node = {
    n: p?.living ? "Living" : (p?.name ?? "Unknown"),
    l: p?.living ? null : (p?.lifespan ?? null),
    t: p ? p.evidence.class : "unrecorded",
    ...(p?.living || !p?.sourceId ? {} : { f: p.sourceId }),
  };
  if (gen >= maxGen) return node;
  const ps = (model.edges[id] || []).filter((x) => model.persons[x]);
  const fa = ps.find((x) => model.persons[x].gender === "M") ?? ps[0];
  const mo = ps.find((x) => model.persons[x].gender === "F") ?? ps[1];
  node.up = [fa ? fanOf(fa, gen + 1, maxGen) : null, mo ? fanOf(mo, gen + 1, maxGen) : null];
  return node;
}
const pageData = {
  fan: fanOf(model.root, 0, 6),
  spine: spineRows,
  stats: pub.meta.stats,
};
if (pageOut) writeFileSync(pageOut, JSON.stringify(pageData) + "\n", "utf8");

console.log(JSON.stringify({
  ok: true,
  walked: Object.keys(model.persons).length,
  bloodline: blood.size,
  published: Object.keys(pub.persons).length,
  livingRedacted: redacted,
  spine: spineChain.length,
  spineReaches: pub.meta.stats.spineReaches,
  wrote: [corpusOut, pageOut].filter(Boolean),
}, null, 2));
