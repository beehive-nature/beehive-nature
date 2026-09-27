// bloodnav tests — GUX-01 zGeneUI slice 1: the blood comb's navigation layer.
// Zero deps: node --test tools/genealogy/bloodnav.test.mjs
// Pure helpers live in surfaces/blood-nav.mjs (imported here under Node);
// DOM wiring is guarded inert, and a wiring-contract block pins the seam
// between the module and surfaces/blood.html so the two cannot drift apart
// silently (the page is hand-wired, not bundled).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeCtx, decodeHash, lodFor, shouldSuppressClick,
  siblingsOf, siblingRing, stepSelection, archiveUrl, applyPlan,
  stepLabel, relToRoot, generationContext,
  mapView, initialFromCtx, syncHash,
  historyAction, sameCtx, navOf, syncEngineHash,
} from "../../surfaces/blood-nav.mjs";
import { createArchiveCore } from "../../surfaces/archive-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../../surfaces/blood.html"), "utf8");
const corpus = JSON.parse(readFileSync(join(here, "../../assets/profile-archive/lineage/remington-bloodline.json"), "utf8"));

/* ---------- hash context ---------- */

test("ctx round-trips through encode/decode", () => {
  const ctx = { p: "p72d226cedf", v: "fractal", r: "p455afa9256", s: 1.3, x: -240, y: 118 };
  const again = decodeHash(encodeCtx(ctx));
  assert.equal(again.p, ctx.p);
  assert.equal(again.v, "fractal");
  assert.equal(again.r, ctx.r);
  assert.equal(again.s, 1.3);
  assert.equal(again.x, -240);
  assert.equal(again.y, 118);
  // pan offsets round to integers on encode ? context survives, sub-pixel drift does not
  assert.equal(decodeHash(encodeCtx({ p: "p1", x: -240.5 })).x, -240);
});

test("legacy #p=<id> decodes as the person field (beat 2b: the mount boots it as SELECTION on the default root, not a founder default)", () => {
  const c = decodeHash("#p=KWJ4-XBD");
  assert.equal(c.p, "KWJ4-XBD");
  assert.equal(c.v, null);
  assert.equal(c.r, null);
  assert.equal(c.myth, false);
});

test("#myth doorway flag survives alongside extended params", () => {
  const c = decodeHash("#myth&p=p1&v=tree");
  assert.equal(c.myth, true);
  assert.equal(c.p, "p1");
  assert.equal(c.v, "tree");
});

test("decode tolerates junk and out-of-range values", () => {
  const c = decodeHash("#garbage&s=99&v=bogus&x=abc");
  assert.equal(c.p, null);
  assert.equal(c.s, null); // outside the camera range is dropped, never trusted
  assert.equal(c.v, null);
  assert.equal(c.x, null);
});

test("decode keeps the engine's zoom floor — serialized 0.18..0.29 round-trips (review d6ca5958 finding 4)", () => {
  assert.equal(decodeHash("#s=0.18").s, 0.18); // the engine's floor (blood-atlas.mjs zoom clamp)
  assert.equal(decodeHash("#s=0.20").s, 0.2);
  assert.equal(decodeHash("#s=0.1").s, null);  // below the engine floor is still dropped
  assert.equal(decodeHash("#s=4.1").s, null);  // above the engine ceiling is still dropped
});

test("encode skips missing fields instead of writing nulls", () => {
  assert.equal(encodeCtx({}), "");
  assert.equal(encodeCtx({ p: "p1" }), "#p=p1");
  assert.equal(encodeCtx(null), "");
});

/* ---------- semantic zoom LOD ---------- */

test("lod thresholds: far / mid / near", () => {
  assert.equal(lodFor(0.3), "far");
  assert.equal(lodFor(0.54), "far");
  assert.equal(lodFor(0.55), "mid"); // 0.55 is not < 0.55
  assert.equal(lodFor(1.0), "mid");
  assert.equal(lodFor(1.14), "mid");
  assert.equal(lodFor(1.15), "near");
  assert.equal(lodFor(4), "near");
  assert.equal(lodFor(NaN), "mid"); // NaN never hides everything
  assert.equal(lodFor(undefined), "mid");
});

/* ---------- drag safety ---------- */

test("a click after a real pan is suppressed; a tap is not", () => {
  assert.equal(shouldSuppressClick(0, 0), false);
  assert.equal(shouldSuppressClick(3, 3), false);   // ~4.2px — jitter
  assert.equal(shouldSuppressClick(3, 4), true);    // exactly 5 — a drag
  assert.equal(shouldSuppressClick(-40, 0), true);  // pan left
  assert.equal(shouldSuppressClick(0, -11, 12), false); // below custom threshold
  assert.equal(shouldSuppressClick(0, -60, 12), true);  // a real pan at any threshold
});

/* ---------- relatives ---------- */

test("siblings dedupe across shared parents, keep stable order, exclude self", () => {
  const edges = { C1: ["F", "M"], C2: ["F", "M"], C3: ["F", "M2"], C4: ["F", "M"] };
  const children = { F: ["C1", "C2", "C3", "C4"], M: ["C2", "C1"], M2: ["C3"] };
  const sibs = siblingsOf("C1", edges, children);
  assert.deepEqual(sibs, ["C2", "C3", "C4"]); // F's order, no duplicates
});

test("one-parent records yield siblings too; orphans yield none", () => {
  assert.deepEqual(siblingsOf("A", { A: ["P"] }, { P: ["A", "B"] }), ["B"]);
  assert.deepEqual(siblingsOf("A", {}, {}), []);
});

test("the sibling ring keeps the person in it — stepping needs a position", () => {
  const edges = { A: ["F", "M"], B: ["F", "M"], C: ["F", "M"] };
  const children = { F: ["A", "B", "C"], M: ["A", "B", "C"] };
  assert.deepEqual(siblingRing("A", edges, children), ["A", "B", "C"]);
  assert.deepEqual(siblingRing("Z", edges, children), ["Z"]); // alone is valid
});

test("keyboard steps walk relationships deterministically and never guess", () => {
  const edges = { A: ["F", "M"], B: ["F", "M"], C: ["F", "M"] };
  const children = { F: ["A", "B", "C"], M: ["A", "B", "C"], A: ["Z"] };
  // up: first recorded parent
  assert.equal(stepSelection("up", "A", edges, children), "F");
  // down: first child
  assert.equal(stepSelection("down", "A", edges, children), "Z");
  // sibling cycles wrap both directions
  assert.equal(stepSelection("right", "A", edges, children), "B");
  assert.equal(stepSelection("right", "C", edges, children), "A");
  assert.equal(stepSelection("left", "A", edges, children), "C");
  // no relationship: a no-op, not a fallback
  assert.equal(stepSelection("down", "Z", edges, children), null);
  assert.equal(stepSelection("left", "Z", edges, children), null);
  assert.equal(stepSelection("up", null, edges, children), null);
  assert.equal(stepSelection("sideways", "A", edges, children), null);
});

/* ---------- archive doorway ---------- */

test("archive url is the staged person page, id encoded", () => {
  assert.equal(archiveUrl("p72d226cedf"), "../assets/profile-archive/lineage/persons/p72d226cedf.html");
  assert.equal(archiveUrl("weird id"), "../assets/profile-archive/lineage/persons/weird%20id.html");
});

/* ---------- context application plan ---------- */

test("applyPlan: full context", () => {
  const persons = { a: {}, b: {} };
  const plan = applyPlan({ r: "a", v: "fan", p: "b", s: 2, x: 1, y: 1 }, persons, "x");
  assert.deepEqual(plan, { root: "a", view: "fan", sel: "b", zoom: { s: 2, x: 1, y: 1 } });
});

test("applyPlan: legacy p-only link roots at the person, no zoom", () => {
  const persons = { a: {} };
  const plan = applyPlan({ p: "a" }, persons, "zz");
  assert.equal(plan.root, "a"); // matches the boot law: #p= re-roots
  assert.equal(plan.sel, "a");
  assert.equal(plan.view, null);
  assert.equal(plan.zoom, null);
});

test("applyPlan: zoom applies only to the fractal view", () => {
  const persons = { a: {} };
  assert.equal(applyPlan({ v: "ped", p: "a", s: 2, x: 0, y: 0 }, persons, "zz").zoom, null);
  assert.equal(applyPlan({ v: "tree", p: "a", s: 2, x: 0, y: 0 }, persons, "zz").zoom, null);
  assert.ok(applyPlan({ v: "fan", p: "a", s: 2 }, persons, "zz").zoom);
});

test("applyPlan: unknown ids and junk are skipped, not guessed", () => {
  const plan = applyPlan({ p: "ghost", r: "ghost", v: "bogus" }, { a: {} }, "zz");
  assert.equal(plan.sel, null);
  assert.equal(plan.root, null);
  assert.equal(plan.view, null);
  assert.deepEqual(applyPlan(null, { a: {} }, "x"), { root: null, view: null, sel: null, zoom: null });
});

/* ---------- wiring contract: blood.html <-> blood-nav.mjs seam ---------- */

test("wiring: the nav module loads ONCE — the mount's import is the only instance (review d6ca5958 finding 3)", () => {
  assert.ok(page.includes('from "./blood-nav.mjs"'), "the mount imports the module (self-wiring via __bloodReady)");
  assert.ok(!page.includes('blood-nav.mjs?v=2'), "no second module instance - two instances double-wire keyboard/popstate with separate state");
});

test("wiring: the page exposes the BloodComb seam and the ready handshake", () => {
  assert.ok(page.includes("globalThis.BloodComb={"));
  assert.ok(page.includes("__bloodReady=true"));
  assert.ok(page.includes("BloodNav.wire(globalThis.BloodComb);BloodNav.onReady();"));
});

test("wiring: every render path emits data-pid so selection can follow redraws", () => {
  assert.ok(page.includes("d.setAttribute('data-pid',id);"));   // fractal dup cell
  assert.ok(page.includes("g.setAttribute('data-pid',id);"));   // fractal cell
  assert.ok(page.includes("c.setAttribute('data-pid',pid);"));  // chrono cell
  assert.ok(page.includes("hex.setAttribute('data-pid',id);")); // pedigree slot
  assert.ok(page.includes("b.setAttribute('data-pid',id);"));   // tree row
});

test("wiring: selection, root, view and zoom report through the nav hooks", () => {
  assert.ok(page.includes("BloodNav.onSelect(id);"));
  assert.ok(page.includes("BloodNav.onRoot(id);"));
  assert.ok(page.includes("BloodNav.onView(mode);"));
  assert.ok(page.includes("BloodNav.onZoom(view.s);"));
  assert.ok(page.includes("S.sel=id;"));
});

test("wiring: keyboard focus, archive doorway, LOD and drawer styles are present", () => {
  assert.ok(page.includes('<svg id="comb" tabindex="0"'));
  assert.ok(page.includes('id="openarchive"'));
  assert.ok(page.includes("#world.lod-far"));
  assert.ok(page.includes(".drawerbar"));
  assert.ok(page.includes("prefers-reduced-motion"));
});

test("wiring: search cap raised to twelve", () => {
  assert.ok(page.includes("hits.length>=12"));
  assert.ok(!page.includes("hits.length>=8"));
});

/* ---------- atlas honesty: the three counts, derived and locked to the corpus ---------- */

test("atlas honesty: the page derives the three published-corpus counts", () => {
  assert.ok(page.includes('id="atlasstats"'));
  assert.ok(page.includes("blood.atlasstats"));
  assert.ok(page.includes("S.atlas={"));
});

test("atlas honesty: the numbers hold on the actual corpus (10,259 / 10,097 / 1,959)", () => {
  const c = JSON.parse(readFileSync(join(here, "../../assets/profile-archive/lineage/remington-bloodline.json"), "utf8"));
  const published = Object.keys(c.persons || {}).length;
  const seen = new Set([c.root]); const st = [c.root];
  while (st.length) {
    const id = st.pop();
    for (const p of (c.edges[id] || [])) if (!seen.has(p)) { seen.add(p); st.push(p); }
  }
  let bloodline = 0; seen.forEach((id) => { if (c.persons[id]) bloodline++; });
  let frontier = 0;
  for (const k in (c.edges || {})) for (const p of c.edges[k]) if (!c.persons[p]) frontier++;
  assert.equal(published, 10259);
  assert.equal(bloodline, 10097);
  assert.equal(bloodline, c.meta.stats.bloodlinePersons); // derivation agrees with the corpus's own receipt
  assert.equal(frontier, 1959);
});

/* ---------- the relationship mount (one resolver, two environments — Archive 1.1) ---------- */

const famModel = {
  persons: {
    root: { name: "Root", gender: "MALE" }, M1: { name: "Mum", gender: "FEMALE" }, F1: { name: "Dad", gender: "MALE" },
    GM: { name: "Gran", gender: "FEMALE" }, GF: {}, off: {},
    C1: { name: "Sibling One", gender: "FEMALE" }, C2: { name: "Sibling Two", gender: "MALE" }, A: { name: "Shared Ancestor", gender: "MALE" },
    H: { name: "Husband", gender: "MALE" }, W: { name: "Wife", gender: "FEMALE" },
    S: { name: "Cycle Edge", gender: "FEMALE" }, P: {}, Q: {}, R: {},
  },
  edges: { root: ["M1", "F1"], M1: ["GM", "GF"], F1: [], off: [], C1: ["A"], C2: ["A"], A: [], H: [], W: [], S: ["P"], P: ["Q"], Q: ["R"], R: ["P"] },
  couples: { hw: { p1: "H", p2: "W" } },
};
const famArchive = createArchiveCore(famModel);
const famCtx = (curRoot) => ({ curRoot, archive: famArchive, persons: famModel.persons });

test("stepLabel: parent/child/spouse hops follow the step target's recorded gender", () => {
  const persons = { F: { gender: "FEMALE" }, M: { gender: "MALE" }, U: {} };
  assert.equal(stepLabel("parent", "F", persons), "mother");
  assert.equal(stepLabel("parent", "M", persons), "father");
  assert.equal(stepLabel("parent", "U", persons), "parent");
  assert.equal(stepLabel("child", "F", persons), "daughter");
  assert.equal(stepLabel("child", "M", persons), "son");
  assert.equal(stepLabel("child", "U", persons), "child");
  assert.equal(stepLabel("spouse", "F", persons), "spouse");
  assert.equal(stepLabel("parent", "ghost", persons), "parent");
});

test("relToRoot: below / above / collateral / affinity / none / self — the three resolver shapes, symmetric", () => {
  const below = relToRoot("root", famCtx("M1")); // root's parent is M1
  assert.equal(below.kind, "below");
  assert.equal(below.generations, 1);
  assert.equal(below.steps[0].id, "root");
  assert.equal(below.steps[below.steps.length - 1].id, "M1");
  assert.equal(below.steps[1].hop, "mother");
  const above = relToRoot("GM", famCtx("root")); // GM is root's grandmother
  assert.equal(above.kind, "above");
  assert.equal(above.generations, 2);
  assert.equal(above.steps[0].id, "GM");        // the path STARTS at the selection
  assert.equal(above.steps[above.steps.length - 1].id, "root");
  assert.ok(above.steps.slice(1).every((st) => ["son", "daughter", "child"].includes(st.hop)), "downward hops labeled as child steps");
  const col = relToRoot("C1", famCtx("C2")); // siblings: blood through the shared ancestor
  assert.equal(col.kind, "collateral");
  assert.equal(col.commonAncestor, "A");
  assert.equal(col.upHops, 1);
  assert.equal(col.downHops, 1);
  assert.equal(col.steps[0].id, "C1");
  assert.equal(col.steps[col.steps.length - 1].id, "C2");
  const aff = relToRoot("H", famCtx("W")); // spouses: affinity, never blood
  assert.equal(aff.kind, "affinity");
  assert.equal(aff.spouseSteps, 1);
  assert.ok(/NOT a blood relationship/.test(aff.note), aff.note);
  assert.equal(relToRoot("off", famCtx("root")).kind, "none");
  assert.equal(relToRoot("root", famCtx("root")).kind, "none");
  const cyc = relToRoot("S", famCtx("R")); // a path through a cyclic component
  assert.equal(cyc.kind, "collateral");
  assert.equal(cyc.disputed, true, "cycle-crossing paths carry the disputed flag, never silent settlement");
});

test("relToRoot without a resolver: the honest boundary, never a guess", () => {
  assert.equal(relToRoot("root", { curRoot: "M1", persons: famModel.persons }).kind, "none");
  assert.equal(relToRoot("root", { curRoot: "M1", archive: null, persons: famModel.persons }).kind, "none");
});

test("generationContext: below/above/root/collateral/off the line", () => {
  const lineModel = { persons: { root: {}, A: {}, B: {}, C1: {}, C2: {}, X: {} }, edges: { root: ["A"], A: ["B"], B: [], C1: ["X"], C2: ["X"], X: ["B"] }, couples: {} };
  const ctx = { curRoot: "root", archive: createArchiveCore(lineModel) };
  assert.equal(generationContext("root", ctx), "the current root");
  assert.equal(generationContext("A", ctx), "1 generations above the current root");
  assert.equal(generationContext("B", ctx), "2 generations above the current root");
  assert.equal(generationContext("C1", ctx), "related through a shared ancestor");
  assert.equal(generationContext("off", ctx), null);
});

const corpusArchive = createArchiveCore(corpus);

test("corpus: the founder journey — Donna above the founder root, off APR's line, honestly", () => {
  const donna = corpus.refsIndex["KWCL-VNB"];
  const apr = corpus.refsIndex["KWJ4-XBD"];
  assert.ok(donna && apr);
  const above = relToRoot(donna, { curRoot: corpus.root, archive: corpusArchive, persons: corpus.persons });
  assert.equal(above.kind, "above"); // Donna is an ancestor of the founder
  assert.equal(above.steps[0].id, donna);
  assert.equal(above.steps[above.steps.length - 1].id, corpus.root);
  assert.ok(above.steps.slice(1).every((st) => ["son", "daughter", "child"].includes(st.hop)), "descents labeled as child steps");
  const below = relToRoot(corpus.root, { curRoot: apr, archive: corpusArchive, persons: corpus.persons });
  assert.equal(below.kind, "below"); // the founder hangs off the public APR entrance
  assert.equal(below.steps[below.steps.length - 1].id, apr);
  assert.ok(below.steps.slice(1).every((st) => ["mother", "father", "parent"].includes(st.hop)), "climbs labeled as parent steps");
  const offApr = relToRoot(donna, { curRoot: apr, archive: corpusArchive, persons: corpus.persons });
  assert.ok(offApr.kind === "none" || offApr.kind === "affinity", "no blood line Donna→APR — a different branch; any connection is marriage, rendered honestly as affinity");
  if (offApr.kind === "affinity") assert.ok(/NOT a blood relationship/.test(offApr.note));
});

test("corpus: the living stub pair is spouse-only — affinity, never blood", () => {
  const pair = relToRoot("liv-1", { curRoot: "liv-2", archive: corpusArchive, persons: corpus.persons });
  assert.equal(pair.kind, "affinity", "the resolver sees the marriage and calls it affinity — never a blood claim");
  assert.equal(pair.spouseSteps, 1);
  assert.ok(corpus.couples && Object.keys(corpus.couples).length > 4000, "couples map present for the spouse index");
});

test("wiring: the mount renders — relationship-to-root panel, three-shape relationship, ambiguity context, shared resolver", () => {
  assert.ok(page.includes("relationship to the current root"));
  assert.ok(page.includes("affinity, never described as blood"));
  assert.ok(page.includes("S.spouses="));
  assert.ok(page.includes("S.qnames="));
  assert.ok(page.includes("BloodNav.relToRoot"));
  assert.ok(page.includes("BloodNav.generationContext"));
  assert.ok(page.includes("archive-core.mjs"), "the shared resolver boots on the merged model");
  assert.ok(page.includes("createArchiveCore"));
  assert.ok(page.includes("blood through a shared ancestor"), "collateral renders");
  assert.ok(page.includes("family by marriage"), "affinity renders");
  assert.ok(!page.includes("corrected path API lands"), "the old promise sentence is retired — the corrected API is consumed");
  assert.ok(page.includes("nameHits")); // duplicate-name detection in search
});

/* ---------- ghost frontier: coverage, never an empty family ---------- */

test("corpus: ghost-parent counts sum to the 1,959 frontier across all persons", () => {
  let total = 0; let personsWithGhosts = 0;
  for (const k in (corpus.edges || {})) {
    let n = 0;
    for (const p of corpus.edges[k]) if (!corpus.persons[p]) n++;
    if (n) { total += n; personsWithGhosts++; }
  }
  assert.equal(total, 1959);
  assert.ok(personsWithGhosts > 1000, "the frontier is distributed, not one broken branch");
});

test("wiring: ghost slots + the frontier affordance render honestly", () => {
  assert.ok(page.includes("S.ghostCount"));
  assert.ok(page.includes("ancestry continues beyond the published archive"));
  assert.ok(page.includes("hexcell ghostslot"));
  assert.ok(page.includes("coverage of the walk, not an empty family"));
});

/* ---------- GUX-01 beat 2b: the composition mount contract ----------
 * Spec: PLANS/GUX01_BLOODHTML_MOUNT_SPEC.md (advisor steering 9777a08e +
 * d5faf191 + 5c02255d). One corpus truth -> one atlas world -> one person
 * explanation -> one history -> one URL grammar. The experiential beats and
 * the deep-link->explore->Back cases are proven by e2e/gux01-blood-journey.mjs
 * against the REAL page; what follows pins the grammar and the wiring. */

test("mapView: the ONE view vocabulary — legacy short forms normalize, junk is null", () => {
  assert.equal(mapView("ped"), "pedigree");
  assert.equal(mapView("fan"), "fractal");
  assert.equal(mapView("pedigree"), "pedigree");
  assert.equal(mapView("fractal"), "fractal");
  assert.equal(mapView("tree"), "tree");
  assert.equal(mapView("bogus"), null);
  assert.equal(mapView(null), null);
});

test("decodeHash: v= speaks the engine vocabulary; legacy forms normalize into it", () => {
  assert.equal(decodeHash("#v=pedigree").v, "pedigree");
  assert.equal(decodeHash("#v=fractal").v, "fractal");
  assert.equal(decodeHash("#v=tree").v, "tree");
  assert.equal(decodeHash("#v=ped").v, "pedigree");
  assert.equal(decodeHash("#v=fan").v, "fractal");
  assert.equal(decodeHash("#v=bogus").v, null);
});

test("deep-link case 1: #p=<person> boots SELECTION on the DEFAULT root — never a synthesized founder default", () => {
  const init = initialFromCtx({ p: "pX", v: null, r: null, s: null, x: null, y: null }, "APR");
  assert.equal(init.root, "APR");
  assert.equal(init.selection, "pX");
  assert.equal(init.view, "pedigree");
  assert.equal(init.transform, null, "no camera in the hash = auto-framing boot (the engine reframes; camera law 81e9ded8)");
});

test("deep-link case 2: a full serialized hash boots root+selection+view+camera exactly as written", () => {
  const init = initialFromCtx({ p: "pX", v: "fan", r: "pR", s: 2.1, x: -40, y: 120 }, "APR");
  assert.equal(init.root, "pR");
  assert.equal(init.selection, "pX");
  assert.equal(init.view, "fractal");
  assert.deepEqual(init.transform, { k: 2.1, x: -40, y: 120 });
});

test("syncHash: the URL is DERIVED state — engine ctx encodes through the one grammar and back", () => {
  const h = syncHash({ root: "pR", selection: "pX", view: "fractal", transform: { k: 2, x: -40, y: 118 } }, null);
  assert.ok(h.includes("p=pX"), h);
  assert.ok(h.includes("r=pR"), h);
  assert.ok(h.includes("v=fractal"), h);
  const back = decodeHash(h);
  assert.equal(back.p, "pX");
  assert.equal(back.r, "pR");
  assert.equal(back.v, "fractal");
  assert.equal(back.s, 2);
  assert.equal(back.x, -40);
  assert.equal(back.y, 118);
});

/* ---------- GUX-01 review beat d6ca5958: ONE history, mirrored ---------- */

test("one-history law: historyAction — push fresh engine navigations; walks and selects replace in place", () => {
  assert.equal(historyAction("reroot"), "push");
  assert.equal(historyAction("view"), "push");
  assert.equal(historyAction("home"), "push");
  assert.equal(historyAction("back"), "replace"); // an echoed history.back() would pop past the boot entry after a user Back (journey-caught)
  assert.equal(historyAction("select"), "replace");
  assert.equal(historyAction("restore"), "replace");
});

test("one-history law: sameCtx at grammar precision — camera rounding never splits an echo", () => {
  const eng = { root: "pR", selection: "pX", view: "fractal", transform: { k: 1.604, x: -99.7, y: 80.2 } };
  assert.ok(sameCtx(eng, decodeHash("#p=pX&v=fractal&r=pR&s=1.60&x=-100&y=80")), "2dp scale + integer pan agreement is the same context");
  assert.ok(!sameCtx(eng, decodeHash("#p=pX&v=fractal&r=pOther&s=1.60&x=-100&y=80")), "a different root is a different context");
  assert.ok(!sameCtx(eng, decodeHash("#p=pOther&v=fractal&r=pR&s=1.60&x=-100&y=80")), "a different selection is a different context");
  assert.ok(sameCtx(navOf(eng), decodeHash("#p=pX&v=fractal&r=pR&s=1.60&x=-100&y=80")), "navOf-normalized compares equal to the raw engine ctx");
});

test("one-history law: syncEngineHash drives a stub history exactly (push/replace)", () => {
  const calls = [];
  const win = { history: {
    pushState: (a, b, u) => calls.push(["push", u]),
    replaceState: (a, b, u) => calls.push(["replace", u]),
    back: () => calls.push(["FATAL-back"]),
  }, location: { pathname: "/x", search: "" } };
  const ctx = { root: "pR", selection: "pX", view: "tree", transform: { k: 2, x: -40, y: 118 } };
  syncEngineHash(ctx, "reroot", win);
  syncEngineHash(ctx, "view", win);
  syncEngineHash(ctx, "select", win);
  syncEngineHash(ctx, "back", win);
  assert.deepEqual(calls.map((c) => c[0]), ["push", "push", "replace", "replace"], "no code path may call history.back - the engine stack is the back affordance");
  assert.ok(calls[0][1].includes("#p=pX"), calls[0][1]);
  assert.ok(calls[0][1].includes("v=tree"), calls[0][1]);
});

test("mount wiring: the composition mount exists with all organs (engine, panel, rail, hosts)", () => {
  assert.ok(page.includes('from "./blood-atlas.mjs"'));
  assert.ok(page.includes('from "./person-panel.mjs"'));
  assert.ok(page.includes('from "./person-panel-corpus.mjs"'));
  assert.ok(page.includes('from "./blood-nav.mjs"'));
  assert.ok(page.includes('id="atlas"'));
  assert.ok(page.includes('id="ppanel"'));
  assert.ok(page.includes('id="cards"'));
  assert.ok(page.includes('id="routestrip"'));
  assert.ok(page.includes("createAtlas("));
  assert.ok(page.includes("mountPersonPanel("));
  assert.ok(page.includes("gux:boot"));
});

test("mount wiring: engine gates at every incumbent state entry — one world, one history", () => {
  assert.ok(page.includes("if(globalThis.__guxAtlas){try{__guxAtlas.reroot(id);}catch(e){}return;}"));
  assert.ok(page.includes("S.sel=id;try{__guxAtlas.select(id);}catch(e){}"));
  assert.ok(page.includes("__guxAtlas.setView(mode==='ped'?'pedigree':mode==='fan'?'fractal':'tree')"));
  assert.ok(page.includes("if(globalThis.__guxAtlas)return;"));
  assert.ok(page.includes("__guxAtlas.home();"));
});

test("one-explanation law: incumbent detail internals hide under engine mode; the panel's own search+back are retired", () => {
  assert.ok(page.includes("body.gux #dempty,body.gux #dbody{display:none!important}"));
  assert.ok(page.includes("#ppanel .pp-search{display:none!important}"));
  assert.ok(page.includes("#ppanel .pp-backbar{display:none!important}"));
});

test("contextual rail: the mount re-derives discovery per standing root and marks it for the journey", () => {
  assert.ok(page.includes("renderRail(ctx.root);"));
  assert.ok(page.includes('setAttribute("data-rail-root"'));
  assert.ok(page.includes("ingest(Object.assign({}, corpus, { root: rootId }), overlay)"));
});

test("review beat d6ca5958: browser Back owns one history — the mirror, the panel re-root, the rail on every path", () => {
  assert.ok(page.includes("syncEngineHash(ctx, reason);"), "onContext applies the one-history law (finding 1)");
  assert.ok(page.includes("setEngineSeam(atlas, init);"), "the popstate restore seam is registered (finding 1)");
  assert.ok(page.includes("onreroot(id) {"), "the panel's stand-here re-roots the ENGINE, not just the panel (finding 5)");
  assert.ok(page.includes("railRoot !== ctx.root"), "the rail re-derives on EVERY root change — back/home/restore included (finding 2)");
  assert.ok(page.includes("panelRoot !== ctx.root"), "the panel re-stands on EVERY root change — its curRoot can never desync from the engine root (finding 5, the deeper half)");
  assert.ok(page.includes("body.gux #lenses,body.gux .listview,body.gux #rootnote{display:none!important}"), "incumbent-only affordances retire under gux (findings: lens re-select, stale list/root note)");
  assert.ok(page.includes("if(globalThis.__guxAtlas)return; // engine mode: lenses are retired"), "a lens toggle never re-selects the root into the engine");
  assert.ok(!page.includes("syncHash(ctx); // blood-nav"), "the old replaceState-only sync is gone from the mount");
});

test("route strip: computed/qualified alternates only — the universal boilerplate is banned from the mount", () => {
  assert.ok(page.includes("routeAlternatesPhrase(routeAlternates("));
  assert.ok(!page.includes("near-equal alternates exist"));
});
