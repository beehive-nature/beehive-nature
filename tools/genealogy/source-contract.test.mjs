// source contract — executable synthetic test of the REAL code (no private
// genealogy data in CI). Proves the acceptance laws, the negative controls,
// and that mutating provenance, event type or source counts cannot upgrade a
// claim. The duplicate fixture mirrors the shape of a real private packet
// (shared parents, paired spouses, zero documents) with synthetic ids only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SOURCE_SCHEMA, CLAIM_SCHEMA, BINDING_SCHEMA,
  createStore, addSource, addClaim, bind, admit, validateStore,
  sourceProblems, claimStanding, personSupport, duplicateAssessment, publicView,
} from "./source-contract.mjs";

const src = (id, over = {}) => ({
  schema: SOURCE_SCHEMA, id, type: "parish-register", provider: "Synthetic Parish Archive",
  title: `Register ${id}`, recordId: `REG-${id}`, accessedAt: "2026-09-23", ...over,
});
const claim = (id, subject, predicate, value) => ({ schema: CLAIM_SCHEMA, id, subject, predicate, value });
const link = (sourceId, claimId, relation, asserts, locator = "p. 4, entry 12") => ({
  schema: BINDING_SCHEMA, sourceId, claimId, relation,
  ...(asserts ? { asserts } : {}), ...(locator ? { locator } : {}),
});

// person P1: a baptism claim and a birth claim, and one register that records the baptism
function baptismStore() {
  const s = createStore();
  addSource(s, src("S1"));
  addClaim(s, claim("C-bap", "P1", "baptism", { date: "1861-03-27" }));
  addClaim(s, claim("C-birth", "P1", "birth", { date: "1861" }));
  return s;
}
const refuses = (fn, re) => assert.throws(fn, re);

// ── negative controls ────────────────────────────────────────────────────────

test("source exists, no binding → NOT SOURCED", () => {
  const s = baptismStore();
  assert.equal(claimStanding(s, "C-bap").standing, "unsourced-entry");
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
});

test("sourceCount = 12 → NOT SOURCED (a count is a lead, never a source)", () => {
  const s = baptismStore();
  const r = admit(s, { kind: "source-count", subjects: ["P1"], count: 12 });
  assert.equal(r.admitted, "lead");
  assert.equal(Object.keys(s.sources).length, 1, "no source was created");
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
  // and a count smuggled onto a source is an unknown key, not provenance
  refuses(() => addSource(s, src("S2", { sourceCount: 12 })), /unknown key sourceCount/);
});

test("hint exists → NOT SOURCED", () => {
  const s = baptismStore();
  assert.equal(admit(s, { kind: "record-hint", subjects: ["P1"] }).admitted, "lead");
  assert.equal(admit(s, { kind: "hint", subjects: ["P1"] }).admitted, "lead");
  assert.equal(s.leads.length, 2);
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
  // a hint dressed as a source is refused by name
  refuses(() => addSource(s, src("S3", { type: "hint" })), /a hint is a lead, not a source/);
});

test("a provider tree link or an AI lead creates no harvested source", () => {
  const s = baptismStore();
  assert.equal(admit(s, { kind: "tree-link", subjects: ["P1", "P2"] }).admitted, "lead");
  assert.equal(admit(s, { kind: "ai-lead", subjects: ["P1"] }).admitted, "lead");
  assert.deepEqual(Object.keys(s.sources), ["S1"]);
  refuses(() => admit(s, { kind: "rumour" }), /unknown observation kind/);
});

test("baptism bound as birth → REFUSED", () => {
  const s = baptismStore();
  refuses(() => bind(s, link("S1", "C-birth", "supports", "baptism")), /records baptism; claim is birth/);
  // and a binding that omits what the source records is refused, not assumed
  refuses(() => bind(s, link("S1", "C-birth", "supports", undefined)), /asserts must name/);
  assert.equal(s.bindings.length, 0);
});

test("burial bound as death → REFUSED", () => {
  const s = createStore();
  addSource(s, src("G1", { type: "gravestone", title: "Headstone", recordId: undefined, url: "https://example.org/stone/1" }));
  addClaim(s, claim("C-death", "P1", "death", { date: "1922" }));
  refuses(() => bind(s, link("G1", "C-death", "supports", "burial")), /records burial; claim is death/);
});

test("binding points to missing source → REFUSED", () => {
  const s = baptismStore();
  refuses(() => bind(s, link("NOPE", "C-bap", "supports", "baptism")), /source NOPE is not held/);
});

test("binding points to missing claim → REFUSED", () => {
  const s = baptismStore();
  refuses(() => bind(s, link("S1", "NOPE", "supports", "baptism")), /claim NOPE does not exist/);
});

test("two conflicting sources → BOTH RETAINED, nothing silently wins", () => {
  const s = createStore();
  addSource(s, src("A"));
  addSource(s, src("B", { type: "census", title: "1870 census" }));
  addClaim(s, claim("C-b", "P1", "birth", { date: "1861" }));
  bind(s, link("A", "C-b", "supports", "birth"));
  bind(s, link("B", "C-b", "contradicts", "birth", "sheet 9, line 31"));
  const st = claimStanding(s, "C-b");
  assert.equal(st.standing, "contested");
  assert.equal(st.supports.length, 1);
  assert.equal(st.contradicts.length, 1);
  assert.deepEqual(personSupport(s, "P1").contestedClaims, ["C-b"]);
});

// ── acceptance laws ──────────────────────────────────────────────────────────

test("supports upgrades that claim only", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-bap", "supports", "baptism"));
  assert.equal(claimStanding(s, "C-bap").standing, "sourced");
  assert.equal(claimStanding(s, "C-birth").standing, "unsourced-entry", "the birth beside it is not proven");
  const p = personSupport(s, "P1");
  assert.equal(p.support, "sourced");
  assert.deepEqual(p.sourcedClaims, ["C-bap"]);
});

test("mentions never becomes proof", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-birth", "mentions", undefined, null));
  const st = claimStanding(s, "C-birth");
  assert.equal(st.standing, "unsourced-entry");
  assert.equal(st.mentions.length, 1);
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
});

test("contradicts alone is retained and is not support", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-bap", "contradicts", "baptism"));
  assert.equal(claimStanding(s, "C-bap").standing, "contradicted");
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
});

test("provenance is required: provider, access day, a way to find it, a locator for paged records", () => {
  assert.match(sourceProblems(src("X", { provider: undefined })).join(), /no provider/);
  assert.match(sourceProblems(src("X", { accessedAt: undefined })).join(), /accessedAt/);
  assert.match(sourceProblems(src("X", { accessedAt: "2026-02-30" })).join(), /accessedAt/);
  assert.match(sourceProblems(src("X", { recordId: undefined })).join(), /not locatable/);
  assert.match(sourceProblems(src("X", { provider: "inferred from surname" })).join(), /derivation/);
  const s = baptismStore();
  refuses(() => bind(s, link("S1", "C-bap", "supports", "baptism", null)), /needs a locator/);
  // an obituary is one item: it may prove without a locator
  addSource(s, src("O1", { type: "obituary", title: "Obituary" }));
  addClaim(s, claim("C-d", "P1", "death", { date: "1922" }));
  bind(s, link("O1", "C-d", "supports", "death", null));
  assert.equal(claimStanding(s, "C-d").standing, "sourced");
});

test("a digest must be well formed and name the held bytes", () => {
  const digest = "sha256:" + createHash("sha256").update("synthetic scan bytes").digest("hex");
  assert.deepEqual(sourceProblems(src("D", { digest, artifactRef: "private:scans/d.png" })), []);
  assert.match(sourceProblems(src("D", { digest })).join(), /name them with artifactRef/);
  assert.match(sourceProblems(src("D", { digest: "sha256:abc", artifactRef: "private:x" })).join(), /digest must be/);
});

test("one entry bound twice is not two sources", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-bap", "supports", "baptism"));
  refuses(() => bind(s, link("S1", "C-bap", "supports", "baptism")), /duplicate/);
});

test("living material does not become public because it has a source", () => {
  const s = createStore();
  addSource(s, src("S1", { artifactRef: "private:scans/s1.png" }));
  addSource(s, src("S2"));
  addClaim(s, claim("C-dead", "D1", "baptism", { date: "1861" }));
  addClaim(s, claim("C-live", "L1", "birth", { date: "1990" }));
  addClaim(s, claim("C-unknown", "U1", "birth", { date: "1950" }));
  addClaim(s, claim("C-rel", "D1|L1", "parent-child", true));
  bind(s, link("S1", "C-dead", "supports", "baptism"));
  bind(s, link("S2", "C-live", "supports", "birth"));
  bind(s, link("S2", "C-unknown", "supports", "birth"));
  bind(s, link("S2", "C-rel", "supports", "parent-child"));
  admit(s, { kind: "hint", subjects: ["D1"] });
  const pub = publicView(s, { D1: { living: false }, L1: { living: true } });
  assert.deepEqual(Object.keys(pub.claims), ["C-dead"], "living, unknown and living-bridging claims stay private");
  assert.deepEqual(Object.keys(pub.sources), ["S1"], "a source reaches public only through a kept binding");
  assert.equal(pub.sources.S1.artifactRef, undefined, "the private pointer never leaves");
  assert.deepEqual(pub.leads, []);
  assert.ok(!JSON.stringify(pub).includes("L1"));
});

// ── mutation: provenance, event type and counts cannot be bent ───────────────

test("mutations that remove provenance, convert an event, or add a count all fail", () => {
  const good = () => {
    const s = baptismStore();
    bind(s, link("S1", "C-bap", "supports", "baptism"));
    return s;
  };
  assert.deepEqual(validateStore(good()), [], "the unmutated store is valid (non-vacuity)");
  const mutations = {
    "drop provider": (s) => delete s.sources.S1.provider,
    "drop accessedAt": (s) => delete s.sources.S1.accessedAt,
    "drop every locator": (s) => { delete s.sources.S1.recordId; },
    "drop binding locator": (s) => delete s.bindings[0].locator,
    "convert claim baptism→birth": (s) => { s.claims["C-bap"].predicate = "birth"; },
    "convert binding asserts→birth": (s) => { s.bindings[0].asserts = "birth"; s.bindings[0].claimId = "C-birth"; s.bindings.push({ ...s.bindings[0] }); },
    "retarget binding to a missing source": (s) => { s.bindings[0].sourceId = "GONE"; },
    "count on the source": (s) => { s.sources.S1.sourceCount = 12; },
    "hint as a source": (s) => { s.sources.S1.type = "hint"; },
    "rekey a source": (s) => { s.sources.S9 = s.sources.S1; delete s.sources.S1; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const s = good();
    mutate(s);
    assert.ok(validateStore(s).length > 0, `mutation "${name}" was not caught`);
    assert.throws(() => claimStanding(s, "C-bap"), `mutation "${name}" still produced a standing`);
  }
});

test("a count on a claim cannot upgrade it either", () => {
  const s = baptismStore();
  s.claims["C-birth"].sourceCount = 12;
  assert.match(validateStore(s).join(), /unknown key sourceCount/);
  assert.throws(() => personSupport(s, "P1"));
});

// ── non-vacuity fixture: the duplicate-candidate shape ───────────────────────
// Two tree records, same-looking names, the same two parents, each married to
// a same-named spouse who is also a separate record. Zero documents.

function duplicateFixture() {
  const s = createStore();
  admit(s, { kind: "tree-link", subjects: ["FA", "PAR1"] });
  admit(s, { kind: "tree-link", subjects: ["FB", "PAR1"] });
  admit(s, { kind: "tree-link", subjects: ["FA", "JA"] });
  admit(s, { kind: "tree-link", subjects: ["FB", "JB"] });
  admit(s, { kind: "record-hint", subjects: ["FA"] });
  admit(s, { kind: "record-hint", subjects: ["FB"] });
  addClaim(s, claim("ID-F", "FA|FB", "identity", "same person"));
  addClaim(s, claim("ID-J", "JA|JB", "identity", "same person"));
  return s;
}
const TOPOLOGY = { sharedParents: true, pairedSpouses: true, similarName: true };

test("duplicate candidate with zero documents → lead/investigate, never sourced, never merge", () => {
  const s = duplicateFixture();
  for (const [a, b] of [["FA", "FB"], ["JA", "JB"]]) {
    const r = duplicateAssessment(s, a, b, TOPOLOGY);
    assert.equal(r.status, "lead/investigate");
    assert.equal(r.decision, "NONE");
    assert.deepEqual(r.support, { a: "unsourced-entry", b: "unsourced-entry" });
    assert.equal(r.identityEvidence[0].standing, "unsourced-entry");
  }
  assert.equal(Object.keys(s.sources).length, 0, "six observations, zero sources");
  assert.equal(s.leads.length, 6);
});

test("the same packet can gain sources later without changing shape — and still never merges itself", () => {
  const s = duplicateFixture();
  addSource(s, src("M1", { type: "civil-register", title: "Marriage register" }));
  bind(s, link("M1", "ID-F", "supports", "identity", "vol. 3, p. 118"));
  let r = duplicateAssessment(s, "FA", "FB", TOPOLOGY);
  assert.equal(r.decision, "founder review");
  assert.notEqual(r.decision, "merge");
  // the spouse pair does not inherit the wife's evidence
  assert.equal(duplicateAssessment(s, "JA", "JB", TOPOLOGY).decision, "NONE");
  // and a contradicting record keeps it contested
  addSource(s, src("M2", { type: "census", title: "Census" }));
  bind(s, link("M2", "ID-F", "contradicts", "identity", "sheet 2, line 7"));
  r = duplicateAssessment(s, "FA", "FB", TOPOLOGY);
  assert.equal(r.decision, "contested — founder review");
  assert.equal(r.identityEvidence[0].supports.length + r.identityEvidence[0].contradicts.length, 2);
});

test("no topology signal and no identity claim → no lead", () => {
  const s = createStore();
  assert.equal(duplicateAssessment(s, "X", "Y").status, "no-lead");
});
