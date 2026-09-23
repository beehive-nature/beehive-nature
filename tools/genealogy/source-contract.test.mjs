// source contract — executable synthetic test of the REAL code (no private
// genealogy data in CI). Proves the acceptance laws, the negative controls,
// and that mutating provenance, assertions or source counts cannot upgrade a
// claim. The duplicate fixture mirrors the shape of a real private packet
// (shared parents, paired spouses, zero documents) with synthetic ids only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SOURCE_SCHEMA, CLAIM_SCHEMA, BINDING_SCHEMA, STANDINGS,
  createStore, addSource, addClaim, bind, admit, validateStore,
  sourceProblems, claimStanding, personSupport, duplicateAssessment, publicView,
} from "./source-contract.mjs";

// a register volume: a collection, so proof from it needs a locator
const src = (id, over = {}) => ({
  schema: SOURCE_SCHEMA, id, type: "parish-register", scope: "collection", provider: "Synthetic Parish Archive",
  title: `Register ${id}`, recordId: `REG-${id}`, accessedAt: "2026-09-23", ...over,
});
const claim = (id, subject, predicate, value) => ({ schema: CLAIM_SCHEMA, id, subject, predicate, value });
// a proof binding: reads a `context` entry, extracts `asserts` (defaults to the context)
const link = (sourceId, claimId, relation, asserts, { context = asserts, locator = "p. 4, entry 12", quote } = {}) => ({
  schema: BINDING_SCHEMA, sourceId, claimId, relation,
  ...(context ? { context } : {}), ...(asserts ? { asserts } : {}),
  ...(quote ? { quote } : {}), ...(locator ? { locator } : {}),
});
const mention = (sourceId, claimId) => ({ schema: BINDING_SCHEMA, sourceId, claimId, relation: "mentions" });

// person P1: a baptism claim and a birth claim, and one register that holds the baptism entry
function baptismStore() {
  const s = createStore();
  addSource(s, src("S1"));
  addClaim(s, claim("C-bap", "P1", "baptism", { date: "1861-03-27" }));
  addClaim(s, claim("C-birth", "P1", "birth", { date: "1861-03-24" }));
  return s;
}
const refuses = (fn, re) => assert.throws(fn, re);
const everyone = { isPublicSubject: () => true };

// ── negative controls ────────────────────────────────────────────────────────

test("source exists, no binding → NOT SOURCED", () => {
  const s = baptismStore();
  assert.equal(claimStanding(s, "C-bap").standing, "unsupported");
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

test("baptism entry alone → birth REFUSED", () => {
  const s = baptismStore();
  // the baptism read as a baptism cannot land on a birth claim
  refuses(() => bind(s, link("S1", "C-birth", "supports", "baptism")), /extracts baptism; claim is birth/);
  // nor can a birth be extracted from it without the words that state one
  refuses(() => bind(s, link("S1", "C-birth", "supports", "birth", { context: "baptism" })), /baptism entry does not imply birth/);
  // and a binding that omits what it extracts, or what it read, is refused, not assumed
  refuses(() => bind(s, link("S1", "C-birth", "supports", undefined, { context: "baptism" })), /asserts must name/);
  refuses(() => bind(s, link("S1", "C-birth", "supports", "birth", { context: null })), /context must name/);
  assert.equal(s.bindings.length, 0);
  assert.equal(claimStanding(s, "C-birth").standing, "unsupported");
});

test("baptism entry explicitly stating birth → birth claim SUPPORTED, and nothing else", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-birth", "supports", "birth", { context: "baptism", quote: "born 24 March, baptized 27 March" }));
  assert.equal(claimStanding(s, "C-birth").standing, "supported");
  // the same entry proves the baptism only when bound to it too
  assert.equal(claimStanding(s, "C-bap").standing, "unsupported");
  bind(s, link("S1", "C-bap", "supports", "baptism", { locator: "p. 4, entry 12 (baptism)" }));
  assert.equal(claimStanding(s, "C-bap").standing, "supported");
});

test("burial bound as death → REFUSED", () => {
  const s = createStore();
  addSource(s, src("G1", { type: "gravestone", scope: "item", title: "Headstone", recordId: undefined, url: "https://example.org/stone/1" }));
  addClaim(s, claim("C-death", "P1", "death", { date: "1922" }));
  refuses(() => bind(s, link("G1", "C-death", "supports", "burial")), /extracts burial; claim is death/);
  refuses(() => bind(s, link("G1", "C-death", "supports", "death", { context: "burial" })), /burial entry does not imply death/);
  // a stone that states the death day may support it, quoted
  bind(s, link("G1", "C-death", "supports", "death", { context: "burial", quote: "died Jan. 3, 1922", locator: null }));
  assert.equal(claimStanding(s, "C-death").standing, "supported");
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
  bind(s, link("B", "C-b", "contradicts", "birth", { context: "residence", quote: "age 12", locator: "sheet 9, line 31" }));
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
  assert.equal(claimStanding(s, "C-bap").standing, "supported");
  assert.equal(claimStanding(s, "C-birth").standing, "unsupported", "the birth beside it is not proven");
  const p = personSupport(s, "P1");
  assert.equal(p.support, "sourced");
  assert.deepEqual(p.supportedClaims, ["C-bap"]);
});

test("claim standing has its own vocabulary, never the person-level one", () => {
  assert.deepEqual(STANDINGS, ["unsupported", "supported", "contradicted", "contested"]);
  const s = baptismStore();
  addSource(s, src("B"));
  bind(s, link("S1", "C-bap", "supports", "baptism"));
  bind(s, link("B", "C-bap", "contradicts", "baptism"));
  bind(s, link("B", "C-birth", "contradicts", "birth"));
  const seen = ["C-bap", "C-birth"].map((id) => claimStanding(s, id).standing);
  for (const v of seen) {
    assert.ok(STANDINGS.includes(v), v);
    assert.ok(!["sourced", "attested", "unsourced-entry"].includes(v), `claim standing leaked person vocabulary: ${v}`);
  }
  assert.deepEqual(seen, ["contested", "contradicted"]);
  // the person summary is the model's vocabulary and names its claims
  assert.deepEqual(personSupport(s, "P1"), { personId: "P1", support: "sourced", supportedClaims: ["C-bap"], contestedClaims: ["C-bap"] });
});

test("mentions never becomes proof", () => {
  const s = baptismStore();
  bind(s, mention("S1", "C-birth"));
  const st = claimStanding(s, "C-birth");
  assert.equal(st.standing, "unsupported");
  assert.equal(st.mentions.length, 1);
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
});

test("contradicts alone is retained and is not support", () => {
  const s = baptismStore();
  bind(s, link("S1", "C-bap", "contradicts", "baptism"));
  assert.equal(claimStanding(s, "C-bap").standing, "contradicted");
  assert.equal(personSupport(s, "P1").support, "unsourced-entry");
});

test("provenance is required: scope, provider, access day, a way to find it", () => {
  assert.match(sourceProblems(src("X", { provider: undefined })).join(), /no provider/);
  assert.match(sourceProblems(src("X", { accessedAt: undefined })).join(), /accessedAt/);
  assert.match(sourceProblems(src("X", { accessedAt: "2026-02-30" })).join(), /accessedAt/);
  assert.match(sourceProblems(src("X", { recordId: undefined })).join(), /not locatable/);
  assert.match(sourceProblems(src("X", { scope: undefined })).join(), /scope must say/);
  assert.match(sourceProblems(src("X", { scope: "page" })).join(), /scope must say/);
  assert.match(sourceProblems(src("X", { provider: "inferred from surname" })).join(), /derivation/);
});

test("proof is pinpoint-relocatable: an exact record id suffices, a collection needs a locator", () => {
  const s = baptismStore();
  // the register volume (collection) without a locator: refused, whatever its type
  refuses(() => bind(s, link("S1", "C-bap", "supports", "baptism", { locator: null })), /collection proof needs a locator/);
  // one register ENTRY with its own archival record id: no page number needed
  addSource(s, src("E1", { scope: "item", title: "Baptism entry", recordId: "ARCH-1861-0327-12" }));
  bind(s, link("E1", "C-bap", "supports", "baptism", { locator: null }));
  assert.equal(claimStanding(s, "C-bap").standing, "supported");
  // an ARK that resolves the exact image is just as pinpoint
  addSource(s, src("K1", { scope: "item", type: "archive-scan", title: "Entry image", recordId: undefined, url: "ark:/00000/synthetic-image-7" }));
  bind(s, link("K1", "C-bap", "supports", "baptism", { locator: null }));
  // and a single-item type scoped as a collection still needs locating: scope rules, not type
  addSource(s, src("O1", { type: "obituary", title: "Obituary page", recordId: "NEWS-PAGE-3" }));
  addClaim(s, claim("C-d", "P1", "death", { date: "1922" }));
  refuses(() => bind(s, link("O1", "C-d", "supports", "death", { locator: null })), /collection proof needs a locator/);
  bind(s, link("O1", "C-d", "supports", "death", { locator: "col. 4" }));
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

// ── public projection: eligibility is the caller's ───────────────────────────

function privacyStore() {
  const s = createStore();
  addSource(s, src("S1", { artifactRef: "private:scans/s1.png" }));
  addSource(s, src("S2"));
  addClaim(s, claim("C-a", "A", "baptism", { date: "1861" }));
  addClaim(s, claim("C-b", "B", "birth", { date: "1990" }));
  addClaim(s, claim("C-ab", "A|B", "parent-child", true));
  bind(s, link("S1", "C-a", "supports", "baptism"));
  bind(s, link("S2", "C-b", "supports", "birth"));
  bind(s, link("S2", "C-ab", "supports", "parent-child"));
  admit(s, { kind: "hint", subjects: ["A"] });
  return s;
}

test("publicView projects only what the caller's privacy layer admits", () => {
  const s = privacyStore();
  const pub = publicView(s, { isPublicSubject: (id) => id === "A" });
  assert.deepEqual(Object.keys(pub.claims), ["C-a"], "B and the A|B relationship stay private");
  assert.deepEqual(Object.keys(pub.sources), ["S1"], "a source reaches public only through a kept binding");
  assert.equal(pub.sources.S1.artifactRef, undefined, "the private pointer never leaves");
  assert.deepEqual(pub.leads, []);
  assert.ok(!JSON.stringify(pub).includes('"B"') && !JSON.stringify(pub).includes("A|B"));
});

test("publicView has no privacy policy of its own: no predicate, no projection", () => {
  const s = privacyStore();
  refuses(() => publicView(s), /must supply isPublicSubject/);
  refuses(() => publicView(s, { isPublicSubject: new Set(["A"]) }), /must supply isPublicSubject/);
  // only an explicit true admits: a truthy stand-in is not a decision
  assert.deepEqual(Object.keys(publicView(s, { isPublicSubject: () => "yes" }).claims), []);
  // it decides nothing from life status, in either direction: the caller's answer is final
  s.claims["C-b"].value = { date: "1990", living: true };
  assert.deepEqual(Object.keys(publicView(s, everyone).claims), ["C-a", "C-b", "C-ab"]);
  assert.deepEqual(Object.keys(publicView(s, { isPublicSubject: () => false }).claims), []);
  // artifact pointers and leads stay private even when everything is admitted
  const all = publicView(s, everyone);
  assert.ok(Object.values(all.sources).every((x) => x.artifactRef === undefined));
  assert.deepEqual(all.leads, []);
});

// ── mutation: provenance, assertions and counts cannot be bent ───────────────

test("mutations that remove provenance, convert an assertion, or add a count all fail", () => {
  const good = () => {
    const s = baptismStore();
    bind(s, link("S1", "C-bap", "supports", "baptism"));
    bind(s, link("S1", "C-birth", "supports", "birth", { context: "baptism", quote: "born 24 March", locator: "p. 4, entry 12 (margin)" }));
    return s;
  };
  assert.deepEqual(validateStore(good()), [], "the unmutated store is valid (non-vacuity)");
  const mutations = {
    "drop provider": (s) => delete s.sources.S1.provider,
    "drop accessedAt": (s) => delete s.sources.S1.accessedAt,
    "drop every locator": (s) => { delete s.sources.S1.recordId; },
    "drop scope": (s) => delete s.sources.S1.scope,
    "drop collection locator": (s) => delete s.bindings[0].locator,
    "drop the quote that states a birth": (s) => delete s.bindings[1].quote,
    "drop context": (s) => delete s.bindings[1].context,
    "convert claim baptism→birth": (s) => { s.claims["C-bap"].predicate = "birth"; },
    "convert asserts baptism→birth": (s) => { s.bindings[0].asserts = "birth"; },
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
    assert.equal(r.identityEvidence[0].standing, "unsupported");
  }
  assert.equal(Object.keys(s.sources).length, 0, "six observations, zero sources");
  assert.equal(s.leads.length, 6);
});

test("the same packet can gain sources later without changing shape — and still never merges itself", () => {
  const s = duplicateFixture();
  addSource(s, src("M1", { type: "civil-register", title: "Marriage register" }));
  bind(s, link("M1", "ID-F", "supports", "identity", { context: "marriage", quote: "the bride, daughter of the late X and Y", locator: "vol. 3, p. 118" }));
  let r = duplicateAssessment(s, "FA", "FB", TOPOLOGY);
  assert.equal(r.decision, "founder review");
  assert.notEqual(r.decision, "merge");
  // the spouse pair does not inherit the wife's evidence
  assert.equal(duplicateAssessment(s, "JA", "JB", TOPOLOGY).decision, "NONE");
  // and a contradicting record keeps it contested
  addSource(s, src("M2", { type: "census", title: "Census" }));
  bind(s, link("M2", "ID-F", "contradicts", "identity", { context: "residence", quote: "two women of that name, one household each", locator: "sheet 2, line 7" }));
  r = duplicateAssessment(s, "FA", "FB", TOPOLOGY);
  assert.equal(r.decision, "contested — founder review");
  assert.equal(r.identityEvidence[0].supports.length + r.identityEvidence[0].contradicts.length, 2);
});

test("no topology signal and no identity claim → no lead", () => {
  const s = createStore();
  assert.equal(duplicateAssessment(s, "X", "Y").status, "no-lead");
});
