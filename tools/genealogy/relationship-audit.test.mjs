// ── relationship-audit.test.mjs — link-level evidence grading ───────────────
// Synthetic, runtime-constructed fixtures ONLY (the fixture-refinement law):
// no real family data enters CI. Exercises the founder's 2026-09-28
// distinction: persons represented ≠ relationships proven; every class
// below is graded from what the fixture evidence actually documents.

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyEdge, audit } from "./relationship-audit.mjs";

const persons = (over = {}) => ({
  c1: { name: "Child One", living: false, evidence: { era: "modern", support: "sourced", class: "record" }, ...over.c1 },
  p1: { name: "Parent One", living: false, evidence: { era: "modern", support: "sourced", class: "record" }, ...over.p1 },
  p2: { name: "Saga Father", living: false, evidence: { era: "viking", support: "unsourced-entry", class: "saga", basis: "attested overlay seed" }, ...over.p2 },
});

const records = {
  r1: { id: "r1", title: "Child One in household of Parent One, Census", evidence: [{ factType: "Name", value: "Child One" }] },
  r2: { id: "r2", title: "Unrelated record", evidence: [{ factType: "Name", value: "Someone Else" }] },
};

test("one record naming both parties grades link-record", () => {
  const v = classifyEdge({
    child: { iid: "c1", name: "Child One", sourced: false },
    parent: { iid: "p1", name: "Parent One", sourced: false },
    childSources: [{ id: "r1" }], parentSources: [], records, traditionSet: new Set(),
  });
  assert.equal(v.cls, "link-record");
  assert.ok(v.recs[0].id === "r1");
});

test("two sourced persons with no shared record grade both-sourced, never link-record", () => {
  const v = classifyEdge({
    child: { iid: "c1", name: "Child One", sourced: true },
    parent: { iid: "p1", name: "Parent One", sourced: true },
    childSources: [{ id: "r2" }], parentSources: [{ id: "r2" }], records, traditionSet: new Set(),
  });
  assert.equal(v.cls, "both-sourced");
});

test("child-only sourcing grades child-sourced; nothing grades past its evidence", () => {
  const v = classifyEdge({
    child: { iid: "c1", name: "Child One", sourced: false },
    parent: { iid: "p1", name: "Parent One", sourced: false },
    childSources: [{ id: "r2" }], parentSources: [], records, traditionSet: new Set(),
  });
  assert.equal(v.cls, "child-sourced");
  const none = classifyEdge({
    child: { iid: "c1", name: "Child One", sourced: false },
    parent: { iid: "p1", name: "Parent One", sourced: false },
    childSources: [], parentSources: [], records, traditionSet: new Set(),
  });
  assert.equal(none.cls, "neither-sourced");
});

test("tradition endpoint wins the classification — never silently upgraded", () => {
  const v = classifyEdge({
    child: { iid: "c1", name: "Child One", sourced: true },
    parent: { iid: "p2", name: "Saga Father", sourced: false },
    childSources: [{ id: "r1" }], parentSources: [], records, traditionSet: new Set(["p2"]),
  });
  assert.equal(v.cls, "tradition");
});

test("audit() excludes living endpoints and non-cohort children, grades the cohort's links", () => {
  const corpus = {
    persons: {
      founder: { name: "Living", living: true, evidence: {} },
      c1: persons().c1, p1: persons().p1,
      c2: { name: "Second Child", living: false, evidence: { era: "modern", support: "unsourced-entry", class: "record" } },
      outsider: { name: "Off Blood", living: false, evidence: { era: "modern", support: "unsourced-entry", class: "record" } },
    },
    edges: { founder: ["c1", "p1"], c1: ["p1"], c2: ["p1"], outsider: ["c1"] },
  };
  const sourcesIndex = { persons: { c1: { iid: "c1", depth: 4, sources: [{ id: "r1" }] }, c2: { iid: "c2", depth: 5, sources: [] } } };
  const r = audit({ corpus, sourcesIndex, recordsMap: records });
  assert.equal(r.totalEdges, 2); // c1->p1 (cohort) + c2->p1 (cohort); founder + outsider excluded
  assert.equal(r.skipped.living, 1); // founder child skips once (whole edge row, not per parent)
  assert.equal(r.skipped.outOfScope, 1); // outsider child
  assert.equal(r.byClass["link-record"], 1); // c1->p1 via r1
  assert.equal(r.byClass["parent-sourced"], 1); // c2 unsourced, p1 corpus-sourced
});
