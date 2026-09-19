// GUX-01 atlas engine tests — the reusable visual/navigation engine for the
// documented family corpus. These tests are the CONTRACT the zGeneUI seat
// integrates against; they are written FIRST (RED) and the engine satisfies
// them (GREEN). Laws under test, each traceable to the GUX-01 order:
//   L1  render people, not synthetic 2^n placeholders
//   L2  semantic zoom (LOD from scale: far=structure, mid, near=reading)
//   L3  one canonical person identity across repeated pedigree positions
//   L4  selection != re-root
//   L5  bounded rendering — never paint the whole corpus because it exists
//   L6  cycles terminate visibly (mirror, never recursion)
//   L7  ghost frontier = coverage unknown, never "no ancestors"
//   L8  spouse/affinity visually distinct from blood
//   L9  no confidence score invented from evidence class or citation count
//   L10 archive-return values (corpus/overlay objects) treated immutable
// Pure core (ingest/build/core state) is tested here headless; the DOM layer
// is exercised in-browser by the acceptance journey (screenshots 390+desktop).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ATLAS_VERSION,
  GHOST_TITLE,
  ingest,
  buildPedigree,
  buildFractal,
  buildTree,
  lodFor,
  search,
  createCore,
} from "../../surfaces/blood-atlas.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = join(HERE, "../../assets/profile-archive/lineage/remington-bloodline.json");
const OVERLAY_PATH = join(HERE, "../../assets/profile-archive/lineage/attested-overlays.json");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// ─── synthetic fixtures (runtime-constructed — the fixture law) ────────────
// tiny: a founder with father f1 / mother m1; f1's father ff2; m1's parents
// are ff2 AGAIN (pedigree collapse → mirror) and a missing ref (ghost);
// spouse s1 coupled with g0; one child c1 (descendant walk).
function fixtureTiny() {
  const persons = {
    g0: { name: "Gen Zero", lifespan: "1900–1970", gender: "MALE", living: false,
      evidence: { era: "recorded", support: "unsourced-entry", class: "recorded" } },
    f1: { name: "Father One", lifespan: "1870–1940", gender: "MALE", living: false,
      evidence: { era: "recorded", support: "unsourced-entry", class: "recorded" } },
    m1: { name: "Mother One", lifespan: "1875–1950", gender: "FEMALE", living: false,
      evidence: { era: "recorded", support: "unsourced-entry", class: "recorded" } },
    ff2: { name: "Repeat Ancestor", lifespan: "1840–1900", gender: "MALE", living: false,
      evidence: { era: "colonial", support: "unsourced-entry", class: "colonial" } },
    s1: { name: "Spouse One", lifespan: "1902–1988", gender: "FEMALE", living: false,
      evidence: { era: "recorded", support: "unsourced-entry", class: "recorded" } },
    c1: { name: "Child One", lifespan: "1930–2000", gender: "FEMALE", living: false,
      evidence: { era: "recorded", support: "unsourced-entry", class: "recorded" } },
  };
  const edges = {
    g0: ["f1", "m1"],
    f1: ["ff2"],
    m1: ["ff2", "GONE-1"], // GONE-1: referenced ancestor never published → ghost
    c1: ["g0", "s1"],
  };
  const couples = { "g0|s1": { p1: "g0", p2: "s1" } };
  return { schema: "fixture", root: "g0", persons, edges, couples, spine: [], meta: {} };
}

// cycle: a is child of b and b is child of a — both walks must terminate.
function fixtureCycle() {
  const persons = {
    a: { name: "Ay", lifespan: "1000–1080", gender: "MALE", living: false, evidence: { class: "medieval" } },
    b: { name: "Bee", lifespan: "0980–1050", gender: "FEMALE", living: false, evidence: { class: "medieval" } },
    c: { name: "Cee", lifespan: "1030–1100", gender: "MALE", living: false, evidence: { class: "medieval" } },
  };
  const edges = { a: ["b"], b: ["a"], c: ["b"] };
  return { schema: "fixture", root: "c", persons, edges, couples: {}, spine: [], meta: {} };
}

// wide: root with 30 children each with 8 children — the descendant walk
// must stop at the node cap, not paint 270 people because they exist.
function fixtureWide() {
  const persons = { w0: { name: "Wide Root", gender: "MALE", living: false, evidence: { class: "recorded" } } };
  const edges = {};
  for (let i = 0; i < 30; i++) {
    const id = `wc${i}`;
    persons[id] = { name: `Wide Child ${i}`, gender: "FEMALE", living: false, evidence: { class: "recorded" } };
    for (let k = 0; k < 8; k++) {
      const gid = `wg${i}_${k}`;
      persons[gid] = { name: `Wide Grand ${i}.${k}`, gender: "MALE", living: false, evidence: { class: "recorded" } };
      edges[gid] = [id, `wsp${i}_${k}`];
      persons[`wsp${i}_${k}`] = { name: `Wide Spouse ${i}.${k}`, gender: "FEMALE", living: false, evidence: { class: "recorded" } };
    }
    edges[id] = ["w0", "wcsp"];
  }
  persons.wcsp = { name: "Wide Child Spouse", gender: "FEMALE", living: false, evidence: { class: "recorded" } };
  return { schema: "fixture", root: "w0", persons, edges, couples: {}, spine: [], meta: {} };
}

// ─── ingest: merge semantics + immutability (L10, L9) ──────────────────────

test("ingest merges corpus + overlay with incumbent semantics; nothing mutated", () => {
  const c = fixtureTiny();
  const before = JSON.stringify(c);
  const ov = {
    persons: { "ovl-x": { name: "Overlay Kin", gender: "M", living: false, evidence: { class: "saga" } } },
    edges: { "ovl-x": ["f1"] },
  };
  const model = ingest(c, ov);
  assert.equal(model.person("g0").name, "Gen Zero");
  assert.ok(model.person("ovl-x"), "overlay persons enter the one address space");
  assert.deepEqual(model.parentOf("ovl-x"), ["f1"], "overlay edges ride the same walk");
  assert.equal(JSON.stringify(c), before, "input corpus object untouched (L10)");
  assert.ok(Object.isFrozen(model.persons), "model projection is frozen (L10)");
  assert.throws(() => { model.persons.g0 = 1; }, /Cannot assign|not extensible|read only/i, "frozen projection refuses writes");
});

test("ingest derives children + spouses + ghost counts from the corpus itself", () => {
  const model = ingest(fixtureTiny());
  assert.deepEqual(model.childrenOf("ff2"), ["f1", "m1"]);
  assert.deepEqual(model.spousesOf("g0"), ["s1"]);
  assert.deepEqual(model.spousesOf("s1"), ["g0"], "affinity is symmetric");
  assert.equal(model.ghostCount("m1"), 1, "GONE-1 is one ghost ref, counted not displayed as raw id");
  assert.equal(model.ghostTotal, 1);
  assert.equal(model.root, "g0");
});

test("L9: model exposes the corpus evidence verbatim and invents no score fields", () => {
  const model = ingest(fixtureTiny());
  const p = model.person("g0");
  assert.deepEqual(p.evidence, { era: "recorded", support: "unsourced-entry", class: "recorded" });
  const blob = JSON.stringify({ persons: model.persons, stats: model.stats });
  assert.doesNotMatch(blob, /"(confidence|score|probability|certainty)"/, "no invented numeric verdicts");
});

// ─── pedigree: slots, roles, mirrors, ghosts (L1, L3, L6, L7) ───────────────

test("pedigree: father-only record keeps the mother slot EMPTY — never manufactured", () => {
  const model = ingest(fixtureTiny());
  const scene = buildPedigree(model, { root: "f1", ancDepth: 2 });
  const gen1 = scene.cells.filter((c) => c.gen === 1);
  assert.equal(gen1.filter((c) => c.kind === "person").length, 1);
  assert.equal(gen1.find((c) => c.kind === "person").iid, "ff2");
  assert.equal(gen1.filter((c) => c.kind === "empty").length, 1, "the unoccupied slot stays visibly empty");
  assert.equal(gen1.find((c) => c.kind === "empty").title, GHOST_TITLE + " — parents not published for this person");
});

test("pedigree: repeated ancestor renders as mirror at the repeat slot, recursed once (L3, L6)", () => {
  const model = ingest(fixtureTiny());
  const scene = buildPedigree(model, { root: "g0", ancDepth: 4 });
  const ff2Cells = scene.cells.filter((c) => c.iid === "ff2");
  assert.equal(ff2Cells.length, 2, "Repeat Ancestor appears at two slots");
  const kinds = ff2Cells.map((c) => c.kind).sort();
  assert.deepEqual(kinds, ["mirror", "person"], "exactly one canonical cell, one mirror");
  const canonicalSlot = ff2Cells.find((c) => c.kind === "person");
  const gen3 = scene.cells.filter((c) => c.gen === 3 && c.kind !== "empty");
  assert.equal(gen3.length, 0, "under the mirror nothing recurses; ff2's own missing parents render as honest EMPTY affordances only (parents render at the canonical slot)");
  assert.equal(scene.counts.persons, 4, "g0,f1,m1,ff2 canonical — nothing synthetic");
  assert.equal(scene.counts.mirrors, 1);
});

test("pedigree: ghost parent renders a dashed-ghost slot with the coverage title (L7)", () => {
  const model = ingest(fixtureTiny());
  const scene = buildPedigree(model, { root: "g0", ancDepth: 3 });
  const ghosts = scene.cells.filter((c) => c.kind === "ghost");
  assert.equal(ghosts.length, 1);
  assert.equal(ghosts[0].iid, null, "a ghost is NOT a person and carries no pid (L1)");
  assert.equal(ghosts[0].title, GHOST_TITLE);
  assert.match(GHOST_TITLE, /ancestry continues beyond the published archive/);
  assert.ok(!/no ancestors|ends here|unknown family/.test(ghosts[0].title), "never a kinship-absence claim");
});

test("pedigree: bounded by construction — cells <= 2^(depth+1)-1 regardless of corpus size (L5)", () => {
  const model = ingest(fixtureWide());
  const scene = buildPedigree(model, { root: "w0", ancDepth: 3 });
  assert.ok(scene.cells.length <= 15, `painted ${scene.cells.length} <= 15`);
  assert.ok(scene.counts.painted <= 15);
  const big = ingest(fixtureCycle());
  const s2 = buildPedigree(big, { root: "c", ancDepth: 6 });
  assert.ok(s2.cells.length <= 127);
});

test("pedigree: cycles terminate visibly — the revisited node is a mirror, not a stack overflow (L6)", () => {
  const model = ingest(fixtureCycle());
  const scene = buildPedigree(model, { root: "c", ancDepth: 8 });
  const all = scene.cells.filter((c) => c.kind === "person" || c.kind === "mirror");
  assert.ok(all.some((c) => c.kind === "mirror"), "the a↔b cycle closes with a visible mirror");
  assert.equal(scene.counts.persons, 3, "c, b, a as canonical people — the loop adds no fourth");
});

test("L1: every person/mirror cell maps to a real corpus person — no synthetic names", () => {
  const model = ingest(fixtureTiny());
  const scene = buildPedigree(model, { root: "g0", ancDepth: 4 });
  for (const c of scene.cells) {
    if (c.kind === "person" || c.kind === "mirror") {
      assert.ok(model.person(c.iid), `cell iid ${c.iid} resolves in the corpus`);
      assert.equal(c.name, model.person(c.iid).name, "names come from the corpus, never invented");
    }
  }
});

test("scene cells carry only whitelisted fields (L9: no invented payload)", () => {
  const model = ingest(fixtureTiny());
  const allowed = new Set(["kind", "iid", "gen", "slot", "role", "name", "year", "evClass", "living", "title", "x", "y", "size", "angle", "ghosts"]);
  for (const c of buildPedigree(model, { root: "g0", ancDepth: 3 }).cells) {
    for (const k of Object.keys(c)) assert.ok(allowed.has(k), `unexpected field "${k}" on cell`);
  }
});

// ─── fractal: the same honest topology on polar rings (L1, L3, L7) ─────────

test("fractal: same people as pedigree, root at center, ghosts kept (no empty geometry invented)", () => {
  const model = ingest(fixtureTiny());
  const scene = buildFractal(model, { root: "g0", ancDepth: 3 });
  assert.equal(scene.view, "fractal");
  const root = scene.cells.find((c) => c.gen === 0);
  assert.equal(root.iid, "g0");
  assert.equal(root.x, 0, "root sits at the world origin");
  assert.equal(root.y, 0);
  const pedPeople = buildPedigree(model, { root: "g0", ancDepth: 3 }).cells.filter((c) => c.kind === "person").map((c) => c.iid).sort();
  const fractalPeople = scene.cells.filter((c) => c.kind === "person").map((c) => c.iid).sort();
  assert.deepEqual(fractalPeople, pedPeople, "fractal and pedigree agree on WHO is drawn");
  assert.equal(scene.cells.filter((c) => c.kind === "ghost").length, 1, "the ghost frontier survives the projection");
  for (const c of scene.cells) {
    if (c.gen > 0) assert.ok(Math.hypot(c.x, c.y) > 0, "non-root cells sit on a ring");
  }
});

test("fractal: root spouses render as affinity side cells, never blood slots (L8)", () => {
  const model = ingest(fixtureTiny());
  const scene = buildFractal(model, { root: "g0", ancDepth: 2 });
  const spouseCells = scene.cells.filter((c) => c.kind === "spouse");
  assert.equal(spouseCells.length, 1);
  assert.equal(spouseCells[0].iid, "s1");
  assert.equal(spouseCells[0].role, "spouse");
  assert.equal(spouseCells[0].gen, 0, "affinity sits BESIDE the root ring, not in a blood slot");
});

// ─── tree: bounded local topology with descendants + siblings + spouses ────

test("tree: descendants capped by node cap — never paint everyone (L5)", () => {
  const model = ingest(fixtureWide());
  const scene = buildTree(model, { root: "w0", ancDepth: 2, descDepth: 3, descNodeCap: 25, sibCap: 10, spouseCap: 6 });
  assert.ok(scene.counts.painted <= 25 + 30 /* spouse rows are bounded by their own cap */ + 10, `painted ${scene.counts.painted}`);
  const desc = scene.rows.filter((r) => r.section === "descendants");
  assert.equal(desc.length, 25, "descendant rows stop exactly at the cap");
  assert.equal(scene.counts.truncated, true, "truncation is STATED, never silent");
});

test("tree: spouse rows are affinity (L8), children rows are blood", () => {
  const model = ingest(fixtureTiny());
  const scene = buildTree(model, { root: "g0", ancDepth: 2, descDepth: 2, descNodeCap: 50, sibCap: 10, spouseCap: 6 });
  const sp = scene.rows.find((r) => r.kind === "spouse");
  assert.equal(sp.iid, "s1");
  assert.equal(sp.section, "spouse");
  const child = scene.rows.find((r) => r.iid === "c1");
  assert.equal(child.kind, "person");
  assert.equal(child.section, "descendants");
  assert.notEqual(child.section, "spouse", "a child is never filed under affinity");
});

test("tree: descendant cycles terminate with a mirror row (L6)", () => {
  const model = ingest(fixtureCycle());
  const scene = buildTree(model, { root: "c", ancDepth: 4, descDepth: 4, descNodeCap: 50, sibCap: 10, spouseCap: 6 });
  const mirrorRows = scene.rows.filter((r) => r.kind === "mirror");
  assert.ok(mirrorRows.length >= 1, "the c→b→a→b loop closes visibly");
  assert.ok(scene.rows.length < 20, `terminated small (${scene.rows.length} rows), not a walk to exhaustion`);
});

test("tree: ancestors section is indented by generation and includes ghost affordance rows (L7)", () => {
  const model = ingest(fixtureTiny());
  const scene = buildTree(model, { root: "g0", ancDepth: 3, descDepth: 1, descNodeCap: 10, sibCap: 10, spouseCap: 6 });
  const anc = scene.rows.filter((r) => r.section === "ancestors");
  assert.deepEqual([...new Set(anc.filter((r) => r.kind !== "ghost").map((r) => r.iid))].sort(), ["f1", "ff2", "m1"].sort(),
    "the repeat (ff2) appears as its canonical row PLUS a mirror row — one identity, marked twice");
  assert.equal(anc.filter((r) => r.kind === "mirror").length, 1);
  const ghostRows = scene.rows.filter((r) => r.kind === "ghost");
  assert.equal(ghostRows.length, 1);
  assert.equal(ghostRows[0].title, GHOST_TITLE);
});

// ─── core state machine: selection != re-root, history/back (L4) ───────────

function coreOf(model, opts) {
  return createCore(model, Object.assign({ initial: { root: model.root, selection: null, view: "pedigree" } }, opts || {}));
}

test("core: select changes selection and NEVER the root; reroot is its own action (L4)", () => {
  const core = coreOf(ingest(fixtureTiny()));
  assert.equal(core.getContext().root, "g0");
  core.select("ff2");
  const ctx = core.getContext();
  assert.equal(ctx.selection, "ff2");
  assert.equal(ctx.root, "g0", "selection did not move the root");
  assert.equal(core.historyDepth(), 0, "selection is not navigation — nothing pushed");
  core.reroot("ff2");
  const ctx2 = core.getContext();
  assert.equal(ctx2.root, "ff2");
  assert.equal(ctx2.selection, "ff2", "re-root keeps the selection");
  assert.equal(core.historyDepth(), 1);
});

test("core: back restores the PRIOR exploration context — root, selection, view, transform", () => {
  const core = coreOf(ingest(fixtureTiny()));
  core.select("m1");
  core.reroot("m1");
  core.setView("tree");
  core.select("ff2");
  core.setTransform({ k: 2, x: 40, y: -10 });
  core.reroot("f1");
  const before = core.getContext();
  assert.equal(before.root, "f1");
  assert.equal(before.view, "tree");
  assert.deepEqual(before.transform, { k: 2, x: 40, y: -10 });
  core.back();
  const restored = core.getContext();
  assert.equal(restored.root, "m1", "back restores the previous root");
  assert.equal(restored.view, "tree");
  assert.equal(restored.selection, "ff2", "the selection survives the round trip");
  core.back();
  const restored2 = core.getContext();
  assert.equal(restored2.root, "m1", "second back: the view-change's prior context (root was already m1)");
  assert.equal(restored2.view, "pedigree");
  assert.equal(restored2.selection, "m1");
  core.back();
  const restored3 = core.getContext();
  assert.equal(restored3.root, "g0", "third back: the original cold-load context");
  assert.equal(restored3.view, "pedigree");
  assert.equal(restored3.selection, "m1");
});

test("core: view change preserves root AND selection (the acceptance's survival beat)", () => {
  const core = coreOf(ingest(fixtureTiny()));
  core.select("m1");
  core.setView("fractal");
  let ctx = core.getContext();
  assert.equal(ctx.view, "fractal");
  assert.equal(ctx.root, "g0");
  assert.equal(ctx.selection, "m1");
  core.setView("tree");
  ctx = core.getContext();
  assert.equal(ctx.view, "tree");
  assert.equal(ctx.selection, "m1");
  assert.equal(ctx.root, "g0");
});

test("core: selection survives an explicit re-root; restoreContext re-arms external state", () => {
  const core = coreOf(ingest(fixtureTiny()));
  core.select("f1");
  core.reroot("m1");
  assert.equal(core.getContext().selection, "f1");
  core.restoreContext({ root: "g0", selection: "c1", view: "fractal", transform: { k: 1, x: 0, y: 0 } });
  const ctx = core.getContext();
  assert.equal(ctx.root, "g0");
  assert.equal(ctx.selection, "c1");
  assert.equal(ctx.view, "fractal");
});

test("core: events name their reason; history is bounded", () => {
  const reasons = [];
  const core = createCore(ingest(fixtureTiny()), {
    initial: { root: "g0", selection: null, view: "pedigree" },
    historyCap: 3,
    onContext: (ctx, reason) => reasons.push(reason),
  });
  core.select("f1");
  core.reroot("m1");
  core.reroot("ff2");
  core.reroot("f1");
  core.reroot("g0");
  assert.equal(core.historyDepth(), 3, "history capped at 3 (bounded by construction)");
  assert.deepEqual(reasons, ["select", "reroot", "reroot", "reroot", "reroot"]);
});

test("core: selecting an unknown person is a no-op that says so, never a guess", () => {
  const core = coreOf(ingest(fixtureTiny()));
  assert.equal(core.select("nobody"), false);
  assert.equal(core.getContext().selection, null);
  assert.equal(core.reroot("nobody"), false);
  assert.equal(core.getContext().root, "g0");
});

// ─── semantic zoom (L2) ─────────────────────────────────────────────────────

test("lodFor: far = structure, mid = people, near = reading (L2)", () => {
  assert.equal(lodFor(0.3), "far");
  assert.equal(lodFor(0.54), "far");
  assert.equal(lodFor(0.55), "mid");
  assert.equal(lodFor(1.0), "mid");
  assert.equal(lodFor(1.15), "near");
  assert.equal(lodFor(3.0), "near");
});

// ─── search ────────────────────────────────────────────────────────────────

test("search: substring, case-insensitive, capped, overlay persons included", () => {
  const model = ingest(fixtureTiny(), {
    persons: { "ovl-x": { name: "Overlay Kin", gender: "M", living: false, evidence: { class: "saga" } } },
    edges: {},
  });
  const hits = search(model, "one", 12);
  assert.ok(hits.some((h) => h.iid === "f1"), "Father One is findable");
  assert.ok(search(model, "kin", 12).some((h) => h.iid === "ovl-x"), "overlay persons are findable");
  assert.ok(search(model, "one", 1).length <= 1, "cap respected");
  assert.deepEqual(search(model, "zzz", 12), []);
});

// ─── the real corpus at the integration pin (97f18945) ─────────────────────

test("REAL corpus: ingest locks — 10,259 published, 4,854 couples, 1,959 ghost refs", () => {
  const corpus = readJson(CORPUS_PATH);
  const before = JSON.stringify(corpus);
  const model = ingest(corpus);
  assert.equal(Object.keys(model.persons).length, 10259);
  assert.equal(model.ghostTotal, 1959, "the ghost frontier total matches the corpus at the pin");
  assert.equal(model.coupleCount, 4854);
  assert.equal(model.spineLength, 42);
  assert.equal(model.root, "founder");
  assert.equal(model.ghostCount("pbdd007b536"), 2, "Martha Steward carries exactly two unpublished parent refs");
  assert.equal(JSON.stringify(corpus), before, "the archive-return corpus object is byte-identical after ingest (L10)");
});

test("REAL corpus: the ovl-* persons are ALREADY baked in; overlay merge is idempotent", () => {
  // fourth-wave corpus law: overlay persons merged INTO the corpus (one address
  // space) — ingest(corpus, overlay) must neither duplicate nor drop anyone
  const model = ingest(readJson(CORPUS_PATH), readJson(OVERLAY_PATH));
  assert.equal(Object.keys(model.persons).length, 10259, "3 ovl-* keys re-assigned to the same values — count unchanged");
  assert.ok(model.person("ovl-sigurd-snake-eye"));
  assert.equal(model.ghostTotal, 1959);
  assert.deepEqual(model.parentOf("founder"), ["liv-1", "liv-2"]);
});

test("REAL corpus: pedigree at founder — grandparents named, real pedigree collapse, bounded (L1/L3/L5)", () => {
  const model = ingest(readJson(CORPUS_PATH));
  // engine convention: ancDepth N = N ancestor generations beside the root
  // (the incumbent's 7-ring honeycomb = ancDepth 7 here)
  const scene6 = buildPedigree(model, { root: "founder", ancDepth: 6 });
  assert.equal(scene6.counts.painted, 123, "6 generations: 123 cells, no collapse yet");
  assert.equal(scene6.counts.mirrors, 0);
  assert.ok(scene6.counts.painted <= 127);
  const scene7 = buildPedigree(model, { root: "founder", ancDepth: 7 });
  const g2 = scene7.cells.filter((c) => c.gen === 2 && c.kind === "person").map((c) => c.name).sort();
  assert.deepEqual(g2, ["Donna Ruth Lawton", "Jack Benedum Sutphen", "Don Ray Remington", "Marilyn Lowry"].sort(),
    "the grandparent law: four NAMED grandparents, no Living placeholder");
  const donna = scene7.cells.find((c) => c.iid === "p7b1078c886");
  assert.equal(donna.gen, 2);
  assert.equal(scene7.counts.persons, 235, "the corpus's real pedigree collapse at generation 7");
  assert.equal(scene7.counts.mirrors, 2);
  const mirrorNames = scene7.cells.filter((c) => c.kind === "mirror").map((c) => c.name).sort();
  assert.deepEqual(mirrorNames, ["Betty Petty", "Jonathan Hadlock"]);
  assert.equal(scene7.counts.painted, 237);
  assert.ok(scene7.counts.painted <= 255);
});

test("REAL corpus: Donna evidence verbatim; living stubs stay anonymous (L9 + privacy)", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const d = model.person("p7b1078c886");
  assert.equal(d.evidence.era, "recorded");
  assert.equal(d.evidence.support, "unsourced-entry");
  assert.equal(model.person("liv-1").name, "Living");
  assert.equal(model.person("liv-1").living, true);
});

test("REAL corpus: search 'donna' finds the grandmother; 'hadlock' returns the ambiguous set", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const donna = search(model, "donna", 12).find((h) => h.iid === "p7b1078c886");
  assert.ok(donna, "Donna Ruth Lawton findable by name");
  const hadlocks = search(model, "hadlock", 12);
  assert.ok(hadlocks.length > 1, `ambiguity is visible, not silently first-picked (${hadlocks.length} hits)`);
});

test("REAL corpus: full core journey never mutates the corpus; scenes carry no score fields (L9/L10)", () => {
  const corpus = readJson(CORPUS_PATH);
  const before = JSON.stringify(corpus);
  const model = ingest(corpus);
  const core = coreOf(model);
  core.select("p7b1078c886");
  core.reroot("p7b1078c886");
  core.setView("tree");
  core.back();
  core.setView("fractal");
  assert.equal(JSON.stringify(corpus), before, "corpus bytes identical after the whole journey");
  const scene = buildFractal(model, { root: core.getContext().root, ancDepth: 3 });
  const blob = JSON.stringify(scene);
  assert.doesNotMatch(blob, /"(confidence|score|probability|certainty)"/);
});

test("REAL corpus: tree at the Rockwood public entrance is bounded and carries the founder below", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const corpus = readJson(CORPUS_PATH);
  const apr = corpus.refsIndex["KWJ4-XBD"];
  assert.ok(apr, "Albert Perry Rockwood resolves via refsIndex");
  const scene = buildTree(model, { root: apr, ancDepth: 4, descDepth: 6, descNodeCap: 150, sibCap: 24, spouseCap: 6 });
  assert.ok(scene.counts.painted <= 150 + 24 + 30, `bounded paint (${scene.counts.painted})`);
  const founderRow = scene.rows.find((r) => r.iid === "founder");
  assert.ok(founderRow, "the founder renders below the public entrance (descendants)");
  assert.equal(founderRow.section, "descendants");
});

// ─── wiring contract: engine ↔ stylesheet ↔ harness cannot drift silently ──

test("wiring: atlas.mjs carries the integration-API header; ATLAS_VERSION exported", () => {
  const src = readFileSync(join(HERE, "../../surfaces/blood-atlas.mjs"), "utf8");
  assert.ok(/INTEGRATION API \(for zGeneUI\)/.test(src), "the API contract lives at the point of use");
  assert.match(ATLAS_VERSION, /gux01\/1/);
});

test("wiring: blood-atlas.css styles every marker class the engine emits", () => {
  const css = readFileSync(join(HERE, "../../surfaces/blood-atlas.css"), "utf8");
  for (const cls of ["atlas-world", "atlas-cell", "atlas-ghost", "atlas-mirror", "atlas-affinity", "atlas-sel", "atlas-root", "lod-far", "lod-mid", "lod-near", "atlas-row"]) {
    assert.ok(css.includes("." + cls), `css is missing .${cls}`);
  }
});

test("wiring: the harness mounts the engine, links the stylesheet, exposes the journey controls", () => {
  const html = readFileSync(join(HERE, "blood-atlas-harness.html"), "utf8");
  assert.ok(html.includes("../../surfaces/blood-atlas.mjs"), "harness imports the engine by relative path");
  assert.ok(html.includes("../../surfaces/blood-atlas.css"), "harness links the engine stylesheet");
  assert.ok(html.includes('id="atlas-mount"'), "mount node present");
  for (const ctl of ["pedigree", "fractal", "tree", "back"]) {
    assert.ok(html.includes(`data-atlas-view="${ctl}"`) || html.includes(`id="atlas-${ctl}"`), `control ${ctl} wired`);
  }
  assert.ok(html.includes("atlas-back"), "back button present for the history beat");
});

// ─── discovery layer (founder order 2026-09-18: derived first-load cards) ──
// UI LAW: whenever a count depends on traversal depth, the depth rides beside
// the count. Enforced structurally: a card with `count` must carry depthNote
// OR corpusWide:true — the builder refuses otherwise.
import { bloodRoute, discoveries } from "../../surfaces/blood-atlas.mjs";

test("bloodRoute: shortest parent-path founder→Ragnar derived from the corpus", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const r = bloodRoute(model, "founder", "pf5d40516b8");
  assert.ok(r, "route exists");
  assert.ok(r.length >= 30, `deep medieval route (${r.length - 1} hops)`);
  assert.equal(r[0], "founder");
  assert.equal(r[r.length - 1], "pf5d40516b8");
  for (const iid of r) assert.ok(model.person(iid), "every hop is a published person");
});

test("discoveries: five derived kinds, no hardcoded names, on the real corpus", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const cards = discoveries(model);
  const kinds = new Set(cards.map((c) => c.kind));
  for (const k of ["route", "branch", "collapse", "correction", "frontier"]) {
    assert.ok(kinds.has(k), k + " card derived");
  }
  // route cards derive from PACK registration (corpus.meta.packs) — nothing hardcoded
  const routeCards = cards.filter((c) => c.kind === "route");
  assert.ok(routeCards.some((c) => /Ragnar/.test(c.title)), "Ragnar route card from his pack");
  assert.ok(routeCards.some((c) => /Rockwood/.test(c.title)), "Rockwood route card from his pack");
  for (const c of routeCards) assert.ok(c.count >= 1 && /generation/i.test(c.depthNote), "route count carries its depth");
  // branch cards: the four NAMED grandparents, bounded count + depth note + family names
  const branch = cards.filter((c) => c.kind === "branch");
  assert.equal(branch.length, 4, "the grandparent law as discovery surfaces");
  const jackCard = branch.find((c) => /Jack Benedum Sutphen/.test(c.title));
  assert.equal(jackCard.count, 896, "the bounded, reproducible number");
  assert.match(jackCard.depthNote, /within 10 generations/);
  assert.ok(jackCard.familyNames.length >= 3, "derived family-name clusters ride the card");
  assert.ok(!jackCard.familyNames.includes("Sr") && !jackCard.familyNames.includes("II"), "generational suffixes are not family names");
  // collapse card: the REAL pedigree collapse at default depth
  const collapse = cards.find((c) => c.kind === "collapse");
  assert.ok(/Betty Petty|Jonathan Hadlock/.test(collapse.title), "derived from the corpus's own mirrors");
  // correction cards: persons whose records carry the founder attestation
  const corrections = cards.filter((c) => c.kind === "correction");
  assert.equal(corrections.length, 4, "the four corrected grandparents");
  assert.ok(corrections.every((c) => /see what changed|corrected/i.test(c.subtitle)));
  // frontier card: corpus-wide ghost refs + the nearest edge generation
  const frontier = cards.find((c) => c.kind === "frontier");
  assert.equal(frontier.count, model.ghostTotal);
  assert.ok(frontier.corpusWide === true, "frontier count is corpus-wide, not depth-bounded — basis stated");
  assert.match(frontier.title, /beyond the published archive/);
});

test("UI LAW enforced: a counted card without depthNote or corpusWide is REFUSED", () => {
  const model = ingest(fixtureTiny());
  assert.throws(() => discoveries(model, { _testBadCard: true }), /depth/i, "the builder refuses depthless counts");
});

test("discoveries are deterministic and bounded", () => {
  const model = ingest(readJson(CORPUS_PATH));
  const a = discoveries(model).map((c) => c.id).join(",");
  const b = discoveries(model).map((c) => c.id).join(",");
  assert.equal(a, b);
  assert.ok(discoveries(model).length <= 24, "bounded card set");
});
