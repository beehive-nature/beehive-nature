// ── pipeline: raw walk JSON → model → public artifacts ──────────────────────
//   node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json] [spine-target-regex]
// The spine terminus defaults to the earliest-birth bloodline person; pass a
// name regex to pin it (e.g. "Sigurd Ring de Trondheim").
import { readFileSync, writeFileSync } from "node:fs";
import { createModel, addPerson, addEdge, addCouple, bloodline, spine, depths, validate, birthYear } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";

const [rawPath, corpusOut, pageOut, spineRx, viaRx] = process.argv.slice(2);
if (!rawPath || !corpusOut) {
  console.error("usage: node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json]");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const model = createModel({ root: raw.root, source: "familysearch" });
importWalk(model, raw);

// attested overlays: corrections patch walked persons (a LAYER over the
// provider record — the provider flag survives in note, never silently
// edited); overlay persons join the corpus directly so the bnr address
// space is one corpus.
let overlay = null;
try {
  overlay = JSON.parse(readFileSync("assets/profile-archive/lineage/attested-overlays.json", "utf8"));
} catch (e) { /* overlays optional */ }
let correctionsApplied = 0, overlayPersons = 0;
if (overlay) {
  for (const [id, c] of Object.entries(overlay.corrections || {})) {
    if (!model.persons[id] || !c?.patch) continue;
    model.persons[id] = {
      ...model.persons[id], ...c.patch,
      corrected: { attested: c.attested || "founder", note: c.note || "" },
    };
    correctionsApplied++;
  }
  for (const [id, p] of Object.entries(overlay.persons || {})) {
    if (!p?.name) continue;
    const ev = p.evidence || {};
    model.persons[id] = {
      name: p.name, lifespan: p.lifespan ?? null, gender: p.gender ?? null,
      living: !!p.living,
      evidence: {
        era: ev.era || ev.class || "saga",
        support: ev.support || "attested",
        class: ev.class || ev.era || "saga",
        basis: ev.basis || "attested overlay — evidence pack required",
      },
      ...(p.evidencePack ? { evidencePack: p.evidencePack } : {}),
      relation: p.relation || null,
    };
    overlayPersons++;
  }
  for (const [child, ps] of Object.entries(overlay.edges || {}))
    if (model.persons[child]) model.edges[child] = ps.filter((p) => model.persons[p] || String(p).startsWith("ovl-"));
}

// evidence-pack index: which pack attests which person (by fsid for walked
// persons, by overlay id for overlay persons) — the page fetches packs from
// this map; it cannot enumerate directories over HTTP
const packIndex = {};
try {
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync("assets/profile-archive/lineage/evidence").sort()) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(readFileSync("assets/profile-archive/lineage/evidence/" + f, "utf8"));
    if (j?.person?.fsid) packIndex[j.person.fsid] = "evidence/" + f;
  }
} catch (e) { /* evidence dir optional */ }
if (overlay)
  for (const [id, p] of Object.entries(overlay.persons || {}))
    if (p?.evidencePack) packIndex[id] = p.evidencePack;

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
// BLOODLINE person (in-law ancestry never defines the house line).
// viaRx (comma list) pins WAYPOINTS — the collapsed medieval web offers
// several equal-length shortest paths; the founder's canonical line is chosen.
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
const viaIds = viaRx ? viaRx.split(",").map((s) => s.trim()).filter(Boolean)
  .map((rxSrc) => bloodEntries.find((p) => !p.living && new RegExp(rxSrc, "i").test(p.name || ""))?.id)
  .filter(Boolean) : [];
const spineChain = terminus ? (spine(model, terminus.id, viaIds) || []) : [];

// public corpus (privatized)
// public set = deceased bloodline ∪ deceased spouses-of-bloodline (in-law
// ancestry beyond the immediate couple stays private)
const publishable = new Set(blood);
for (const c of Object.values(model.couples)) {
  if (blood.has(c.p1)) publishable.add(c.p2);
  if (blood.has(c.p2)) publishable.add(c.p1);
}
if (overlay) for (const id of Object.keys(overlay.persons || {})) publishable.add(id);
const pub = createModel({ root: model.root, source: model.source });
let redacted = 0, stubs = 0, livingTotal = 0;
for (const p of Object.values(model.persons)) if (p.living) livingTotal++;
// living bloodline persons → anonymous "Living" stubs (the comb must climb
// from the founder); living off the root line → dropped entirely
const onRootLine = new Set();
{
  let frontier = [model.root];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (onRootLine.has(id)) continue;
      onRootLine.add(id);
      for (const p of (model.edges[id] || [])) if (model.persons[p]) next.push(p);
    }
    frontier = next;
  }
}
for (const [id, p] of Object.entries(model.persons)) {
  if (!publishable.has(id)) continue;
  if (p.living) {
    if (onRootLine.has(id)) {
      pub.persons[id] = { name: "Living", lifespan: null, gender: p.gender ?? null,
        living: true, evidence: { era: "living", support: "unsourced-entry", class: "living", basis: "redacted stub" } };
      stubs++;
    } else redacted++;
    continue;
  }
  addPerson(pub, { ...p, id });
}
for (const [child, ps] of Object.entries(model.edges)) if (pub.persons[child]) addEdge(pub, child, ps);
for (const c of Object.values(model.couples)) if (pub.persons[c.p1] && pub.persons[c.p2]) addCouple(pub, c.p1, c.p2, c.marriage);

// ── identifier pseudonymization: living persons must not carry provider ids
// in a PUBLIC artifact (the id itself identifies a living person). Root
// becomes "founder" (the page's public subject); other living become liv-N.
const idmap = {};
let livN = 0;
for (const id of Object.keys(pub.persons)) {
  const p = pub.persons[id];
  if (!p.living) continue;
  idmap[id] = id === pub.root ? "founder" : "liv-" + (++livN);
}
const remapped = { persons: {}, edges: {} };
for (const [id, p] of Object.entries(pub.persons)) {
  remapped.persons[idmap[id] || id] = p;
}
for (const [child, ps] of Object.entries(pub.edges)) {
  if (!pub.persons[child]) continue;
  remapped.edges[idmap[child] || child] = ps.map((p) => idmap[p] || p);
}
pub.persons = remapped.persons;
pub.edges = remapped.edges;
if (pub.root && idmap[pub.root]) pub.root = idmap[pub.root];
pub.couples = Object.fromEntries(Object.entries(pub.couples)
  .filter(([k, c]) => pub.persons[idmap[c.p1] || c.p1] && pub.persons[idmap[c.p2] || c.p2])
  .map(([k, c]) => {
    const p1 = idmap[c.p1] || c.p1, p2 = idmap[c.p2] || c.p2;
    return [[p1, p2].sort().join("|"), { p1, p2, ...(c.marriage ? { marriage: c.marriage } : {}) }];
  }));
for (const k of Object.keys(packIndex)) if (idmap[k]) { delete packIndex[k]; }
const spineRows = spineChain.map((id, i) => {
  const p = model.persons[id];
  return p.living
    ? { i, n: "Living", l: null, t: "living" }
    : { i, n: p.name, l: p.lifespan, t: p.evidence.class || p.evidence.era, ...(p.sourceId ? { f: p.sourceId } : {}) };
});
// living spine rows carry no f already; deceased ids never remapped — safe as-is
pub.spine = spineRows; // the spine travels with the corpus for data consumers
pub.meta = {
  ...model.meta,
  retrieved: (raw.meta && (raw.meta.pulledAt || raw.meta.checkpointAt)) || model.meta.generated,
  source: "FamilySearch Family Tree, walked under the founder's signed-in session (fs-adapter)",
  stats: {
    personsWalked: Object.keys(model.persons).length,
    bloodlinePersons: blood.size,
    deceasedPublished: Object.keys(pub.persons).length,
    livingRedacted: livingTotal, // every living person loses its details; `livingStubs` survive anonymously on the root line
    livingStubs: stubs,
    spineGenerations: spineChain.length,
    spineReaches: terminus ? `${terminus.name} ${terminus.lifespan ?? ""}`.trim() : "(no spine target found)",
  },
  privacy: "living persons redacted — root-line living survive as anonymous 'Living' stubs with PSEUDONYMIZED ids (root='founder', others liv-N; provider ids never published); all other living dropped. Relationship-leakage review: couples and edges touching dropped living persons are removed with them.",
  confidenceTiers: "era heuristic (recorded ≥1850 · colonial 1550–1850 · medieval 1000–1550 · saga <1000); basis says era-heuristic until per-person source counts are harvested",
  claimPolicy: "every person carries its evidence class; the spine past the colonial era is traditional, not proven",
  packs: packIndex,
  // RECONCILIATION: every fetched person is retained privately, published, or
  // excluded with an explicit reason — never silently lost. The categories sum
  // to the raw walk (asserted by family.test.mjs).
  reconciliation: (() => {
    const pubIds = new Set(Object.keys(pub.persons));
    const offLineLiving = livingTotal - stubs;
    return {
      rawPersons: Object.keys(model.persons).length,
      published: pubIds.size,
      excluded: {
        "living, off the root line — privacy": { count: offLineLiving },
        "off-bloodline ancestry (in-law lines beyond the first spouse of a bloodline person) — scope: the house line is ancestry, in-law deep ancestry stays private-side": {
          count: Object.keys(model.persons).length - pubIds.size - offLineLiving - stubs < 0
            ? 0
            : Object.keys(model.persons).length - pubIds.size - offLineLiving,
        },
      },
      pseudonymizedStubs: stubs,
      retainedPrivatelyNote: "ALL persons, including living and off-line, are retained at full fidelity in the private raw walk JSON and GEDCOM exports on the estate's local disk (never committed); the public corpus publishes the bloodline + first spouses + attested overlays only.",
      named: {
        "KWCL-VNB Donna Ruth Lawton": "published · spine row 2 (the Lawton canon)",
        "LNQ5-BSF Marilyn Lowry": "published · founder-corrected living flag",
        "LNQ5-BSG Don Ray Remington": "published · founder-corrected living flag",
        "KWJ4-XBD Albert Perry Rockwood": "published · the public entrance person",
      },
    };
  })(),
  correctionsApplied,
  overlayPersons,
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
  livingRedacted: livingTotal,
  livingStubs: stubs,
  spine: spineChain.length,
  spineReaches: pub.meta.stats.spineReaches,
  wrote: [corpusOut, pageOut].filter(Boolean),
}, null, 2));
