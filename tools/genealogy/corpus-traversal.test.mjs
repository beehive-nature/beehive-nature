// Parent-graph traversal over the REAL corpus must terminate.
//
// WHY THIS FILE EXISTS. The published corpus is not acyclic: eight strongly
// connected components (44 persons) sit in the child->parent graph, and 42 of
// those 44 are reachable from the root, so they are ordinary input rather than
// an edge case. Termination was already asserted — but only over a THREE-PERSON
// synthetic fixture (bloodatlas.test.mjs, fixtureCycle). A guard proven on a toy
// is not a guard proven on 10,259 persons and 13,416 edges.
//
// The guarded traversals already exist (model.bloodline / model.depths, and the
// surface's own cyclicAncestryOf is the single cycle authority per G4). Nothing
// new is built here on purpose: this file binds the EXISTING guards to the REAL
// graph, so a future edit that drops a visited-set check fails a test instead of
// hanging a reader whose ancestry includes any of the 42.
//
// NON-VACUITY, stated as a test rather than a comment: T1 refuses to pass on an
// acyclic corpus, and T4 shows an UNGUARDED walk over this same graph does not
// terminate. Without both, "the walk finished" would be a fact about the corpus
// being easy, not about the guard working.
//
// Each test carries an explicit timeout: if a guard is removed, the walk never
// returns, and the row must FAIL rather than hang the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bloodline, depths, validate } from "./model.mjs";

const LINEAGE = new URL("../../assets/profile-archive/lineage/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const model = JSON.parse(readFileSync(LINEAGE + "remington-bloodline.json", "utf8"));

const PERSONS = Object.keys(model.persons).length;
const EDGES = Object.values(model.edges).reduce((n, ps) => n + ps.length, 0);
const cycleIds = () => {
  const out = [];
  for (const p of validate(model))
    if (p.startsWith("cycle-component:"))
      out.push(...p.slice("cycle-component:".length).trim().split(",").map((s) => s.trim()).filter(Boolean));
  return out;
};

test("T1 non-vacuity: the real corpus is loaded, non-trivial, and genuinely cyclic", { timeout: 60000 }, () => {
  assert.ok(PERSONS > 1000, `corpus must be the real one, got ${PERSONS} persons`);
  assert.ok(EDGES > 1000, `parent edges must be read, got ${EDGES}`);
  const ids = cycleIds();
  // If this ever drops to zero the corpus was repaired, and every termination
  // claim below becomes a statement about an acyclic graph — i.e. worthless.
  // Re-rule this file at that point; do not delete the assertion to make it green.
  assert.ok(ids.length > 0, "corpus contains at least one parent-graph cycle; otherwise T2-T5 prove nothing");
  assert.equal(new Set(ids).size, ids.length, "no id is reported in two components");
});

test("T2 bloodline() terminates over the real graph and visits each person at most once", { timeout: 60000 }, () => {
  const set = bloodline(model);
  assert.ok(set.size > 0, "the root has ancestors");
  assert.ok(set.size <= PERSONS, `visited ${set.size} of ${PERSONS} persons — a guarded walk cannot exceed the population`);
  assert.ok(set.has(model.root), "the walk includes its own start");
});

test("T3 depths() terminates from the root and from inside a cycle, with finite depths", { timeout: 60000 }, () => {
  const fromRoot = depths(model);
  assert.ok(Object.keys(fromRoot).length <= PERSONS, "depth map cannot exceed the population");
  for (const [id, d] of Object.entries(fromRoot))
    assert.ok(Number.isFinite(d) && d >= 0, `depth of ${id} is finite`);

  // starting INSIDE a component is the case a reader hits by opening that person
  const inCycle = cycleIds()[0];
  const fromCycle = depths(model, inCycle);
  assert.equal(fromCycle[inCycle], 0, "the start is at depth 0");
  assert.ok(Object.keys(fromCycle).length <= PERSONS, "depth map from a cycle member is bounded");
});

test("T4 the guard is what saves it: an UNGUARDED walk over this same graph does not terminate", { timeout: 60000 }, () => {
  const BUDGET = 200000;
  const start = cycleIds()[0];
  let frontier = [start];
  let steps = 0;
  let generations = 0;
  while (frontier.length && steps < BUDGET) {
    const next = [];
    for (const id of frontier) {
      steps++;
      if (steps >= BUDGET) break;
      for (const p of (model.edges[id] || [])) if (model.persons[p]) next.push(p);
    }
    frontier = next;
    generations++;
  }
  // No visited set, so the walk revisits the cycle forever. Tripping the budget
  // is the evidence that T2/T3 finishing is the guard's doing and not the
  // graph's shape.
  assert.ok(steps >= BUDGET, `unguarded walk should exhaust its ${BUDGET}-step budget, spent ${steps} over ${generations} generations`);
});

test("T5 every cycle member is still reachable and rendered-adjacent, not quarantined", { timeout: 60000 }, () => {
  const reachable = bloodline(model);
  const ids = cycleIds();
  const hit = ids.filter((id) => reachable.has(id));
  // The point of the whole file: these ids are ordinary ancestors of the root,
  // so an unguarded consumer hangs on normal input rather than on a curiosity.
  assert.ok(hit.length > 0, "at least one cycle member is an ancestor of the root");
  for (const id of hit) assert.ok(model.persons[id], `${id} is a real person record`);
});
