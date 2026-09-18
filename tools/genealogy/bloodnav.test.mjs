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
} from "../../surfaces/blood-nav.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../../surfaces/blood.html"), "utf8");

/* ---------- hash context ---------- */

test("ctx round-trips through encode/decode", () => {
  const ctx = { p: "p72d226cedf", v: "fan", r: "p455afa9256", s: 1.3, x: -240, y: 118 };
  const again = decodeHash(encodeCtx(ctx));
  assert.equal(again.p, ctx.p);
  assert.equal(again.v, "fan");
  assert.equal(again.r, ctx.r);
  assert.equal(again.s, 1.3);
  assert.equal(again.x, -240);
  assert.equal(again.y, 118);
  // pan offsets round to integers on encode ? context survives, sub-pixel drift does not
  assert.equal(decodeHash(encodeCtx({ p: "p1", x: -240.5 })).x, -240);
});

test("legacy #p=<id> deep link keeps its exact old meaning", () => {
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
  assert.equal(c.s, null); // outside 0.3..4 is dropped, never trusted
  assert.equal(c.v, null);
  assert.equal(c.x, null);
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

test("wiring: the page loads the nav module before tour.js", () => {
  const m = page.indexOf('blood-nav.mjs?v=1');
  const t = page.indexOf('tour.js?v=42');
  assert.ok(m > 0 && t > 0 && m < t, "module script must precede tour.js");
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
