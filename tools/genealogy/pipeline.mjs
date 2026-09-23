// ── pipeline: raw walk JSON → model → public artifacts ──────────────────────
//   node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json] [spine-target-regex]
// The spine terminus defaults to the earliest-birth bloodline person; pass a
// name regex to pin it (e.g. "Sigurd Ring de Trondheim").
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { createModel, bloodline, spine, depths, validate, birthYear, evidenceClass } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";
import { publish } from "./publish.mjs";
import { joinLine, emptyPart } from "./lines.mjs";

const [rawPath, corpusOut, pageOut, spineRx, viaRx] = process.argv.slice(2);
if (!rawPath || !corpusOut) {
  console.error("usage: node pipeline.mjs <raw-walk.json> <out-corpus.json> [out-page-data.json]");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const model = createModel({ root: raw.root, source: "familysearch" });
importWalk(model, raw);

// PRIVATE SPOUSE LINES (optional): mapping + walks live on estate-local disk,
// never in the repo; the join law is lines.mjs (additive, founder root kept).
const LINES_PRIVATE = "C:/Users/travi/family-lineage/lines-private.json";
const lineIntake = {};
if (existsSync(LINES_PRIVATE)) {
  const spec = JSON.parse(readFileSync(LINES_PRIVATE, "utf8"));
  for (const [key, line] of Object.entries(spec.lines || {})) {
    if (!Array.isArray(line?.walks) || !line.walks.length) { console.error(`lines-private: ${key} names no walk — refusing`); process.exit(1); }
    const parts = line.walks.map((p) => { const m = emptyPart(); importWalk(m, JSON.parse(readFileSync(p, "utf8"))); return m; });
    try { lineIntake[key] = joinLine(model, key, line, parts); }
    catch (e) { console.error(e.message); process.exit(1); }
  }
}

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
    // corrections recompute DERIVED metadata: a founder-attested death moves
    // the era off 'living' — stale era on a corrected person is a bug
    const fixed = model.persons[id];
    const era = evidenceClass({ living: fixed.living, lifespan: fixed.lifespan });
    fixed.evidence = { ...(fixed.evidence || {}), era, class: era };
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

// PUBLISHABLE WITH DISCLOSURE — exactly two classes, and they are different
// truths:
//   unresolved:                 INCOMPLETE — a parent is named, not fetched
//   cycle-component: / witness: DISPUTED — contradictory ancestry, someone is
//                               their own ancestor along a path (G1, d47ba87f6)
// Both are the provider tree's own shape and were already published; before
// 2026-09-22 G1's report made every regeneration exit here, so no correction
// could publish. Every OTHER problem stays fatal, and public privacy problems
// are fatal without exception (below). The corpus discloses both classes in
// meta, cycles with their witnesses, never as merely incomplete.
const allProblems = validate(model);
const REPORTED = /^(unresolved|cycle-component|witness):/;
const problems = allProblems.filter((p) => !REPORTED.test(p));
const unresolved = allProblems.filter((p) => p.startsWith("unresolved:")).length;
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

// public corpus: scope + the ONE privacy law (publish.mjs → model.privatize).
// The inline privacy copy that lived here until 2026-09-22 is deleted; the
// baseline regeneration proved the two produce the same corpus.
const { pub } = publish(model, { extraIds: overlay ? Object.keys(overlay.persons || {}) : [] });
let livingTotal = 0;
for (const p of Object.values(model.persons)) if (p.living) livingTotal++;
const stubs = pub.meta.livingStubs;

// ── FIRST-CLASS STAGED OBJECTS: every person gets a stable INTERNAL identity;
// provider ids (FamilySearch, …) are retained as REFERENCES, never as the
// identity. IDENTITY FREEZE: issued ids live in a registry and are REUSED —
// re-imports, provider-reference changes, and reordered input must never
// re-point a published address at someone else. The PUBLIC registry carries
// deceased refs only; the living mapping (fsid→founder/liv-N) stays in a
// PRIVATE registry on estate-local disk, out of public artifacts.
const PUBLIC_REGISTRY = "assets/profile-archive/lineage/identity-registry.json";
const PRIVATE_REGISTRY = "C:/Users/travi/family-lineage/identity-registry-private.json";
const { loadRegistry, assignIdentities } = await import("./identity.mjs");
// corrupted previously-issued registries are FATAL (never a silent reset);
// missing ones start fresh — the two states are distinct on purpose
const pubReg = loadRegistry(PUBLIC_REGISTRY, "skaists.identity-registry/1");
const privReg = loadRegistry(PRIVATE_REGISTRY, "skaists.identity-registry-private/1");
const pubRegistry = pubReg.registry;
const privRegistry = privReg.registry;
privRegistry.note = "fsid→pseudonym for living persons; NEVER published";

const { idmap, errors: identityErrors } = assignIdentities({ pubPersons: pub.persons, root: pub.root, pubRegistry, privRegistry });
if (identityErrors.length) {
  console.error("IDENTITY ASSIGNMENT FAILED:");
  identityErrors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
const remapped = { persons: {}, edges: {} };
const refsIndex = {};
for (const [id, p] of Object.entries(pub.persons)) {
  const iid = idmap[id] || id;
  const entry = { ...p };
  // references: provider ids retained, demoted from identity
  entry.refs = p.living ? [] : (/^ovl-/.test(id) ? [{ provider: "attested-overlay", id }] : [{ provider: "familysearch", id }]);
  if (!p.living && !/^ovl-/.test(id)) refsIndex[id] = iid;
  // research status (what we know) — tracked separately from publication
  entry.research = { status: p.corrected ? "corrected-attested" : packIndex[id] ? "tradition-entered" : /^ovl-/.test(id) ? "attested" : "incomplete", basis: "per-person source counts not yet harvested" };
  if (p.corrected) entry.research.note = p.corrected.note;
  // publication status (what we show) — 'private'/'incomplete'/'disputed' are
  // never silently missing: the stub says why it is a stub
  entry.publication = p.living
    ? { status: "private-stub", reason: id === pub.root ? "living — the founder, anonymous anchor" : "living — anonymous root-line stub; provider id withheld" }
    : { status: "public" };
  delete entry.sourceId; // provider id lives in refs now
  remapped.persons[iid] = entry;
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
// published lines carry internal ids like everything else (the private
// line mapping never ships: privatize() emits `lines`, never `roots`)
if (pub.lines) pub.lines = pub.lines.map((l) => ({ ...l, root: idmap[l.root] || l.root, entries: l.entries.map((e) => idmap[e] || e).sort() }));
const packIndexInternal = {};
for (const [k, v] of Object.entries(packIndex)) if (!idmap[k] || !pub.persons[idmap[k]]?.living) packIndexInternal[idmap[k] || k] = v;
for (const k of Object.keys(packIndex)) delete packIndex[k];
Object.assign(packIndex, packIndexInternal);
const spineRows = spineChain.map((id, i) => {
  const p = model.persons[id];
  return p.living
    ? { i, n: "Living", l: null, t: "living" }
    : { i, n: p.name, l: p.lifespan, t: p.evidence.class || p.evidence.era, f: idmap[id] || id };
});
// living spine rows carry no f already; deceased ids never remapped — safe as-is
pub.spine = spineRows; // the spine travels with the corpus for data consumers
pub.refsIndex = refsIndex; // fsid → internal id (deceased only; lookup for tests/tools)
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
  ...(Object.keys(lineIntake).length ? { lineIntake } : {}),
};
// privacy stays FATAL here; only the two disclosed classes pass
const pubAll = validate(pub, { public: true });
const pubProblems = pubAll.filter((p) => !REPORTED.test(p));
{
  const comps = pubAll.filter((p) => p.startsWith("cycle-component:")).map((p) => p.slice(16).trim().split(","));
  pub.meta.disputedAncestry = {
    law: "DISPUTED, not incomplete: each component is a set of people who become their own ancestors along a path in the provider tree. Published with disclosure; traversal stays safe (cyclicAncestryOf is the one cycle authority) and any relationship crossing a component is shown disputed.",
    components: comps.length,
    persons: new Set(comps.flat()).size,
    witnesses: pubAll.filter((p) => p.startsWith("witness:")).map((p) => p.slice(8).trim().split(" -> ")),
  };
  pub.meta.incompleteFrontier = {
    law: "INCOMPLETE: a parent named in the provider tree but not fetched; the tree stops where the archive stops.",
    unresolvedParentRefs: pubAll.filter((p) => p.startsWith("unresolved:")).length,
  };
}
if (pubProblems.length) {
  console.error(`PUBLIC validation FAILED (${pubProblems.length}):`);
  pubProblems.slice(0, 10).forEach((p) => console.error("  - " + p));
  process.exit(1);
}
writeFileSync(corpusOut, JSON.stringify(pub, null, 1) + "\n", "utf8");

// ── staged person objects: every relative is a first-class archive object;
// profile pages, fractal views, and manifests generate from this shared
// object. The canonical five prove the path as permanent fixtures.
function personObject(iid) {
  const p = pub.persons[iid];
  if (!p) return null;
  const parents = (pub.edges[iid] || []).map((pid) => ({
    id: pid, name: pub.persons[pid]?.name, evidence: pub.edges[iid] && overlay?.relationshipEvidence?.[iid + "|" + pid] ? "disputed — inspect in the comb" : "walked provider link",
  }));
  const children = Object.entries(pub.edges).filter(([, ps]) => ps.includes(iid)).map(([cid]) => ({ id: cid, name: pub.persons[cid]?.name }));
  const spouses = Object.values(pub.couples).filter((c) => c.p1 === iid || c.p2 === iid)
    .map((c) => ({ id: c.p1 === iid ? c.p2 : c.p1, name: pub.persons[c.p1 === iid ? c.p2 : c.p1]?.name, marriage: c.marriage || null }));
  return {
    schema: "skaists.person/1",
    internalId: iid,
    bnr: "bnr://skaists.dev/blood/" + iid,
    identity: { name: p.name, lifespan: p.lifespan, gender: p.gender, living: !!p.living },
    refs: p.refs || [],
    evidence: p.evidence,
    research: p.research,
    publication: p.publication,
    ...(p.corrected ? { corrected: p.corrected } : {}),
    relationships: { parents, children, spouses },
    layers: {
      records: p.refs?.some((r) => r.provider === "familysearch")
        ? { provider: "familysearch", recordUrl: "https://www.familysearch.org/tree/person/details/" + p.refs.find((r) => r.provider === "familysearch").id, retrieved: pub.meta.retrieved }
        : null,
      tradition: packIndex[iid] ? { pack: packIndex[iid] } : null,
      testimony: (overlay?.testimony || []).filter((t) => t.text && /rockwood/i.test(p.name || "") && /rockwood/i.test(t.subject || "")) || [],
      meaning: (overlay?.symbolicLinks || []).filter((sl) => (sl.connects || []).includes(iid)),
    },
    onSpine: spineRows.some((r) => r.f === iid),
    generatedFrom: "the shared staged object (pipeline v3) — corpus, pages, fractal views, and manifests derive from this",
  };
}
// ── WHOLE-COHORT STAGING: every relative is a first-class archive object —
// not a five-name pilot. Public persons stage into the repo; protected persons
// (living, off-line) stage at FULL FIDELITY into PRIVATE staging on local
// disk, never committed. The five canonical souls stay as permanent regression
// fixtures. Staging failures FAIL the build and name the records — a
// successful-looking run with silent gaps is the bug this whole lane kills.
const FIXTURES = [
  /Donna Ruth Lawton/i, /Marilyn Lowry/i, /Don Ray Remington/i, /Albert Perry Rockwood/i, /Ragnar Sigurdsson/i,
];
const PUBLIC_STAGING = "assets/profile-archive/lineage/persons";
const PRIVATE_STAGING = "C:/Users/travi/family-lineage/staging-private";
const stagingFailures = [];
try {
  const { mkdirSync: mkd } = await import("node:fs");
  mkd(PUBLIC_STAGING, { recursive: true });
  mkd(PRIVATE_STAGING, { recursive: true });
  let publicStaged = 0, privateStaged = 0;
  const researchCounts = {}, publicationCounts = {};
  for (const [iid, p] of Object.entries(pub.persons)) {
    try {
      writeFileSync(PUBLIC_STAGING + "/" + iid + ".json", JSON.stringify(personObject(iid), null, 1) + "\n", "utf8");
      publicStaged++;
      researchCounts[p.research?.status || "?"] = (researchCounts[p.research?.status || "?"] || 0) + 1;
      publicationCounts[p.publication?.status || "?"] = (publicationCounts[p.publication?.status || "?"] || 0) + 1;
    } catch (e) { stagingFailures.push(iid + " (public): " + e.message); }
  }
  // private staging: every model person NOT in the public corpus, full fidelity
  const pubIids = new Set(Object.values(idmap));
  for (const [mid, p] of Object.entries(model.persons)) {
    if (pubIids.has(idmap[mid] || mid) && pub.persons[idmap[mid] || mid]) continue;
    try {
      writeFileSync(PRIVATE_STAGING + "/" + (idmap[mid] || mid) + ".json",
        JSON.stringify({ schema: "skaists.person-private/1", internalId: idmap[mid] || mid, providerRef: mid, ...p,
          publication: { status: "private", reason: p.living ? "living — full fidelity stays local" : "off-bloodline ancestry — scope stays private-side" } }, null, 1) + "\n", "utf8");
      privateStaged++;
    } catch (e) { stagingFailures.push(mid + " (private): " + e.message); }
  }
  // inventories: public committed, private local-only
  pub.meta.stagedPersons = {
    store: PUBLIC_STAGING + "/",
    publicStaged, privateStagedLocal: PRIVATE_STAGING + "/",
    fixtures: FIXTURES.map((rx) => Object.keys(pub.persons).find((k) => rx.test(pub.persons[k].name || "") && !pub.persons[k].living)).filter(Boolean),
    researchCounts, publicationCounts,
    pages: "generated on demand: node tools/genealogy/personpage.mjs [id…]; the five fixtures' pages are committed",
  };
  writeFileSync(PUBLIC_STAGING + "/../staging-inventory.json", JSON.stringify({
    schema: "skaists.staging-inventory/1", generated: pub.meta.generated,
    walkedCohort: pub.meta.reconciliation.rawPersons,
    publicStaged, privateStaged,
    sumCheck: publicStaged + privateStaged === pub.meta.reconciliation.rawPersons,
    privateStaging: { location: "estate-local disk (never committed)", count: privateStaged,
      reasons: pub.meta.reconciliation.excluded },
    note: "nobody silently disappears: PUBLIC staged + PRIVATE staged = the walked cohort (sumCheck asserts it); the reconciliation reasons explain WHY each private person is not public",
  }, null, 1) + "\n", "utf8");
  writeFileSync(corpusOut, JSON.stringify(pub, null, 1) + "\n", "utf8"); // rewrite with the staging note
} catch (e) { stagingFailures.push("(staging setup): " + e.message); }
if (stagingFailures.length) {
  console.error("STAGING FAILED (" + stagingFailures.length + ") — records named, build fails:");
  stagingFailures.slice(0, 20).forEach((f) => console.error("  - " + f));
  process.exit(1);
}
// persist the identity registries (public: deceased; private: living mapping)
writeFileSync(PUBLIC_REGISTRY, JSON.stringify(pubRegistry, null, 1) + "\n", "utf8");
writeFileSync(PRIVATE_REGISTRY, JSON.stringify(privRegistry, null, 1) + "\n", "utf8");

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
