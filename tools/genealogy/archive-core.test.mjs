// zGeneArchive core contract tests -- organ lane (bFUzZ).
// Locks the founder-ruled minimal contract (bdf59735) and the G3 ruling
// (32e28d07, Rule A): additive spouse facet, blood-and-affinity
// classification, single-kind shapes unchanged, no new export.
// Permanent married-cousin cases -- these do not ride off a branch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createArchiveCore, ARCHIVE_CORE_SCHEMA } from "../../surfaces/archive-core.mjs";

//        g
//      /    \
//     p1     p2          u1 -- u2 (unrelated tree, joined only by marriage)
//     |      |
//     c1 <=> c2   (married cousins: blood through g AND direct spouses)
const coupleFixture = () => ({
  persons: {
    g: { name: "Grand" },
    p1: { name: "Parent One" },
    p2: { name: "Parent Two" },
    c1: { name: "Child One" },
    c2: { name: "Child Two" },
    u1: { name: "Unrelated One" },
    u2: { name: "Unrelated Two" },
  },
  edges: { p1: ["g"], p2: ["g"], c1: ["p1"], c2: ["p2"] },
  couples: { "c1|c2": { p1: "c1", p2: "c2" } },
});

test("schema marks the additive facet era", () => {
  assert.equal(ARCHIVE_CORE_SCHEMA, "skaists.archive-core/1.1");
});

test("contract: exactly the founder-named surface, no export growth", () => {
  const core = createArchiveCore(coupleFixture());
  assert.deepEqual(Object.keys(core).sort(),
    ["bloodlineSet", "cyclicAncestryOf", "relationshipPath", "resolve", "schema", "searchNames"]);
  assert.equal(core.schema, ARCHIVE_CORE_SCHEMA);
});

test("married cousins classify blood-and-affinity, blood facets whole", () => {
  const core = createArchiveCore(coupleFixture());
  const r = core.relationshipPath("c1", "c2");
  assert.equal(r.kind, "blood-and-affinity");
  assert.equal(r.commonAncestor, "g"); // the blood truth is retained, not replaced
  assert.ok(Array.isArray(r.path) && r.path.length >= 3);
  assert.equal(r.spouse.couple, "c1|c2"); // names the exact corpus couple record
  assert.match(r.spouse.note, /affinity, never blood/);
  assert.ok(!("spouseSteps" in r)); // declarative facet: no fabricated affinity walk
  // symmetric direction: same classification, same couple record, same ancestor
  const rr = core.relationshipPath("c2", "c1");
  assert.equal(rr.kind, "blood-and-affinity");
  assert.equal(rr.spouse.couple, "c1|c2");
  assert.equal(rr.commonAncestor, "g");
});

test("blood-only shape is unchanged: the facet is simply absent", () => {
  const f = coupleFixture();
  delete f.couples["c1|c2"];
  const core = createArchiveCore(f);
  const r = core.relationshipPath("c1", "c2");
  assert.equal(r.kind, "blood");
  assert.ok(!("spouse" in r));
  // the locked blood shape, byte-compatible with pre-G3 output
  assert.deepEqual(Object.keys(r).sort(), ["commonAncestor", "kind", "note", "path"]);
});

test("affinity-only direct spouses keep their shape (no facet, no blood fields)", () => {
  const f = coupleFixture();
  f.couples = { "u1|u2": { p1: "u1", p2: "u2" } };
  const core = createArchiveCore(f);
  const r = core.relationshipPath("u1", "u2");
  assert.equal(r.kind, "affinity");
  assert.equal(r.spouseSteps, 1);
  assert.equal(r.sharedDescendant, false);
  assert.ok(!("spouse" in r));
  assert.equal(r.commonAncestor, undefined);
});

test("none pairs keep their honest-boundary shape", () => {
  const core = createArchiveCore(coupleFixture());
  const r = core.relationshipPath("c1", "u1");
  assert.equal(r.kind, "none");
  assert.ok(r.ghostFrontier && typeof r.ghostFrontier.a === "object");
  assert.ok(!("spouse" in r));
});

test("the facet is pair-specific: a couple elsewhere adds nothing to a blood pair", () => {
  const f = coupleFixture();
  f.couples["u1|u2"] = { p1: "u1", p2: "u2" };
  const core = createArchiveCore(f);
  const r = core.relationshipPath("c1", "c2");
  assert.equal(r.kind, "blood-and-affinity"); // only because c1|c2 is joined
  const sibs = core.relationshipPath("p1", "p2"); // blood pair, NOT spouses
  assert.equal(sibs.kind, "blood");
  assert.ok(!("spouse" in sibs));
});

test("couple record order-independence (p1/p2 swapped, either key spelling)", () => {
  const f = coupleFixture();
  f.couples = { "c2|c1": { p1: "c2", p2: "c1" } };
  const core = createArchiveCore(f);
  const r = core.relationshipPath("c1", "c2");
  assert.equal(r.kind, "blood-and-affinity");
  assert.equal(r.spouse.couple, "c2|c1"); // the facet names the record as written
});

test("disputed rides through the facet: cycle-crossing blood + spouse", () => {
  // y and x form a 2-cycle (each is the other's parent); c1, c2 descend from y.
  const f = {
    persons: { y: { name: "Y" }, x: { name: "X" }, c1: { name: "C1" }, c2: { name: "C2" } },
    edges: { c1: ["y"], c2: ["y"], y: ["x"], x: ["y"] },
    couples: { "c1|c2": { p1: "c1", p2: "c2" } },
  };
  const core = createArchiveCore(f);
  const r = core.relationshipPath("c1", "c2");
  assert.equal(r.kind, "blood-and-affinity");
  assert.equal(r.disputed, true);
  assert.match(r.disputedNote, /cyclic ancestry/);
  assert.equal(r.spouse.couple, "c1|c2");
});

test("self pairs keep their pre-existing semantics (locked, not redesigned)", () => {
  const core = createArchiveCore(coupleFixture());
  const r = core.relationshipPath("c1", "c1");
  assert.equal(r.kind, "blood");
  assert.ok(!("spouse" in r)); // a self-couple can never exist in coupleJoin
});

test("determinism: same model, same answers, across cores and calls", () => {
  const a = createArchiveCore(coupleFixture());
  const b = createArchiveCore(coupleFixture());
  for (const [x, y] of [["c1", "c2"], ["c1", "u1"], ["u1", "u2"], ["p1", "p2"]]) {
    assert.deepEqual(a.relationshipPath(x, y), b.relationshipPath(x, y));
    assert.deepEqual(a.relationshipPath(x, y), a.relationshipPath(x, y));
  }
});
