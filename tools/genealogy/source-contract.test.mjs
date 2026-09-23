// source contract — executable synthetic test of the REAL code (no private
// genealogy data in CI). Proves the acceptance laws, the negative controls,
// and that mutating provenance, assertions or source counts cannot upgrade a
// claim. The duplicate fixture mirrors the shape of a real private packet
// (shared parents, paired spouses, zero documents) with synthetic ids only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SOURCE_SCHEMA, CLAIM_SCHEMA, BINDING_SCHEMA, STANDINGS, PUBLIC_FIELDS, SOURCE_KEYS, CLAIM_KEYS, BINDING_KEYS, nonDataAt,
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

// ── public projection: four caller decisions, an allowlist, nothing raw ─────

// every free-text and value field carries a living third party's name
const LIVING = /Living-|Elm St/;
function payloadStore() {
  const s = createStore();
  addSource(s, src("OB", { type: "obituary", scope: "item", title: "Obituary; survived by Living-Son-Q", recordId: "NEWS-1922-0104", note: "clipping kept by Living-Grandchild-Q", artifactRef: "private:clips/ob.png" }));
  addSource(s, src("REG", { title: "Burial register vol. 2 (copy held by Living-Keeper-Q)", note: "photographed at the house of Living-Keeper-Q" }));
  addSource(s, src("LTR", { type: "testimony", scope: "item", title: "Letter to Living-Son-Q", recordId: undefined, artifactRef: "private:letters/1.pdf" }));
  addClaim(s, { ...claim("C-death", "D", "death", { date: "1922-01-03", informant: "Living-Son-Q, 41 Elm St" }), note: "informant Living-Son-Q" });
  addClaim(s, claim("C-bur", "D", "burial", { date: "1922-01-06" }));
  addClaim(s, claim("C-live", "L", "birth", { date: "1990" }));
  addClaim(s, claim("C-rel", "D|L", "parent-child", true));
  bind(s, { ...link("OB", "C-death", "supports", "death", { locator: null }), quote: "died Jan. 3; survived by her son Living-Son-Q of 41 Elm St", note: "from the copy of Living-Grandchild-Q" });
  bind(s, link("REG", "C-bur", "supports", "burial", { locator: "p. 7, next to the family plot of Living-Keeper-Q" }));
  bind(s, link("LTR", "C-death", "supports", "death", { locator: null }));
  bind(s, link("OB", "C-live", "supports", "birth", { context: "death", quote: "son born 1990", locator: null }));
  bind(s, link("OB", "C-rel", "supports", "parent-child", { context: "death", quote: "her son", locator: null }));
  admit(s, { kind: "hint", subjects: ["D"] });
  return s;
}
const D_ONLY = (id) => id === "D";
const PUBLIC_SRC = (id) => id === "OB" || id === "REG";
const base = { isPublicSubject: D_ONLY, isPublicSource: PUBLIC_SRC };

test("every schema key has exactly one public disposition (the class is closed, not chased)", () => {
  for (const [object, keys] of [["source", SOURCE_KEYS], ["claim", CLAIM_KEYS], ["binding", BINDING_KEYS]]) {
    const disposed = Object.values(PUBLIC_FIELDS[object]).flat();
    assert.deepEqual([...disposed].sort(), [...keys].sort(), `${object}: every key disposed, none invented`);
    assert.equal(new Set(disposed).size, disposed.length, `${object}: no key has two dispositions`);
  }
  assert.deepEqual(PUBLIC_FIELDS.source.never, ["artifactRef"]);
  for (const k of ["title", "note"]) assert.ok(PUBLIC_FIELDS.source.text.includes(k));
  for (const k of ["locator", "quote", "note"]) assert.ok(PUBLIC_FIELDS.binding.text.includes(k));
  assert.deepEqual(PUBLIC_FIELDS.claim.value, ["value"]);
});

test("four decisions are required and separate: no subject or source predicate, no projection", () => {
  const s = payloadStore();
  refuses(() => publicView(s), /must supply isPublicSubject/);
  refuses(() => publicView(s, { isPublicSubject: D_ONLY }), /must supply isPublicSource/);
  refuses(() => publicView(s, { isPublicSubject: new Set(["D"]), isPublicSource: PUBLIC_SRC }), /must supply isPublicSubject/);
  refuses(() => publicView(s, { ...base, projectText: "keep" }), /projectText must be a function/);
  refuses(() => publicView(s, { ...base, projectValue: {} }), /projectValue must be a function/);
  // only an explicit true admits a subject; a truthy stand-in is not a decision
  assert.deepEqual(Object.keys(publicView(s, { isPublicSubject: () => "yes", isPublicSource: PUBLIC_SRC }).claims), []);
  // and a relationship needs every party: D alone does not carry D|L out
  assert.equal(publicView(s, base).claims["C-rel"], undefined);
});

test("by default a public subject publishes structure only: no raw text, no value, no living name anywhere", () => {
  const s = payloadStore();
  const pub = publicView(s, base);
  assert.deepEqual(Object.keys(pub.claims).sort(), ["C-bur", "C-death"], "D's claims publish; L and D|L do not (non-vacuity)");
  assert.doesNotMatch(JSON.stringify(pub), LIVING);
  for (const b of pub.bindings) for (const k of ["quote", "note", "locator"]) assert.equal(k in b, false, `binding.${k} left raw`);
  for (const c of Object.values(pub.claims)) for (const k of ["value", "note"]) assert.equal(k in c, false, `claim.${k} left raw`);
  for (const x of Object.values(pub.sources)) for (const k of ["title", "note", "artifactRef"]) assert.equal(k in x, false, `source.${k} left raw`);
  // structure survives: that is what keeps the claim checkable
  assert.deepEqual(pub.claims["C-death"], { schema: CLAIM_SCHEMA, id: "C-death", subject: "D", predicate: "death" });
  assert.deepEqual(pub.sources.OB, { schema: SOURCE_SCHEMA, id: "OB", type: "obituary", scope: "item", provider: "Synthetic Parish Archive", accessedAt: "2026-09-23", recordId: "NEWS-1922-0104" });
  assert.deepEqual(pub.leads, []);
  // omission is a projection, not a deletion
  assert.match(s.bindings[0].quote, /Living-Son-Q/);
});

test("a public subject does not make a private source public", () => {
  const s = payloadStore();
  const pub = publicView(s, base);
  assert.equal(pub.sources.LTR, undefined, "the family letter stays private");
  assert.equal(pub.bindings.some((b) => b.sourceId === "LTR"), false, "and so does its binding");
  assert.deepEqual(pub.bindings.map((b) => b.sourceId).sort(), ["OB", "REG"]);
  // only an explicit true admits a source
  const none = publicView(s, { isPublicSubject: D_ONLY, isPublicSource: () => "yes" });
  assert.deepEqual(none.bindings, []);
  assert.deepEqual(Object.keys(none.sources), []);
  assert.deepEqual(Object.keys(none.claims).sort(), ["C-bur", "C-death"], "the claim may still publish without its source");
  // the caller decides from the source record itself
  const seen = [];
  publicView(s, { isPublicSubject: D_ONLY, isPublicSource: (id, rec) => { seen.push(`${id}:${rec.type}`); return false; } });
  assert.deepEqual(seen.sort(), ["LTR:testimony", "OB:obituary", "REG:parish-register"]);
});

test("opaque text leaves only as a string projectText returns: title, note, locator, quote", () => {
  const s = payloadStore();
  const asked = new Set();
  const pub = publicView(s, {
    ...base,
    projectText: (text, at) => {
      asked.add(`${at.object}.${at.field}`);
      if (at.object === "source" && at.field === "title") return text.replace(/[;(].*$/, "").trim();
      if (at.field === "locator") return text.replace(/,.*$/, "");
      if (at.field === "quote") return 7;                 // not a string: omitted
      if (at.object === "claim") return { text };        // not a string: omitted
      return null;                                         // omitted
    },
  });
  assert.deepEqual([...asked].sort(), ["binding.locator", "binding.note", "binding.quote", "claim.note", "source.note", "source.title"]);
  assert.equal(pub.sources.OB.title, "Obituary");
  assert.equal(pub.sources.REG.title, "Burial register vol. 2");
  assert.equal(pub.bindings.find((b) => b.sourceId === "REG").locator, "p. 7");
  for (const b of pub.bindings) assert.equal("quote" in b, false);
  assert.equal("note" in pub.claims["C-death"], false);
  assert.doesNotMatch(JSON.stringify(pub), LIVING);
});

test("claim values leave only through projectValue, as detached data", () => {
  const s = payloadStore();
  const asked = [];
  const pub = publicView(s, {
    ...base,
    projectValue: (value, at) => {
      asked.push(`${at.claimId}:${at.predicate}:${at.subject}`);
      return at.predicate === "death" ? { date: value.date } : undefined; // the burial value is withheld
    },
  });
  assert.deepEqual(asked.sort(), ["C-bur:burial:D", "C-death:death:D"]);
  assert.deepEqual(pub.claims["C-death"].value, { date: "1922-01-03" });
  assert.equal("value" in pub.claims["C-bur"], false, "undefined omits");
  assert.doesNotMatch(JSON.stringify(pub), LIVING);
  // null omits too; a pass-through is the caller's explicit decision, and it is a copy
  assert.equal("value" in publicView(s, { ...base, projectValue: () => null }).claims["C-death"], false);
  const through = publicView(s, { ...base, projectValue: (v) => v });
  through.claims["C-death"].value.date = "tampered";
  assert.equal(s.claims["C-death"].value.date, "1922-01-03", "the public copy does not alias the private store");
  // something that is not data is refused, not silently dropped
  refuses(() => publicView(s, { ...base, projectValue: () => () => 1 }), /not data/);
  refuses(() => publicView(s, { ...base, projectValue: () => Symbol("x") }), /not data/);
  assert.throws(() => publicView(s, { ...base, projectValue: () => 1n }));
});

test("non-data anywhere in a projected value is refused, never silently dropped or transformed", () => {
  const s = payloadStore();
  class Place { constructor() { this.name = "Parish"; } }
  const cyclic = { date: "1922" }; cyclic.self = cyclic;
  const withSymbolKey = { date: "1922", [Symbol("k")]: 1 };
  const withGetter = { date: "1922", get where() { return "Elm St"; } };
  const hidden = { date: "1922" }; Object.defineProperty(hidden, "secret", { value: "x", enumerable: false });
  // JSON would silently lose each of these: -0 becomes 0, a named array property vanishes
  const namedArray = [1, 2]; namedArray.foo = "x";
  // "4294967295" (2^32-1) looks like an index but never extends length, so JSON drops it
  const maxKeyArray = [1, 2]; maxKeyArray["4294967295"] = "x";
  const oddKeyArray = [1, 2]; oddKeyArray["01"] = "x";
  const symArray = [1]; symArray[Symbol("k")] = 1;
  const getterArray = []; Object.defineProperty(getterArray, 0, { get: () => "Elm St", enumerable: true });
  const bad = {
    "nested function":        [{ date: "1922", helper: () => 1 }, /value\.helper: function/],
    "nested symbol":          [{ date: "1922", tag: Symbol("t") }, /value\.tag: symbol/],
    "nested bigint":          [{ date: "1922", n: 1n }, /value\.n: bigint/],
    "nested undefined":       [{ date: "1922", place: undefined }, /value\.place: undefined/],
    "array with undefined":   [{ dates: ["1922", undefined] }, /value\.dates\[1\]: undefined/],
    "array with a hole":      [{ dates: ["1922", , "1923"] }, /value\.dates\[1\]: hole/],
    "array with a function":  [["1922", () => 1], /value\[1\]: function/],
    "deep NaN":               [{ a: { b: [1, NaN] } }, /value\.a\.b\[1\]: non-finite number NaN/],
    "deep Infinity":          [{ a: [{ age: Infinity }] }, /value\.a\[0\]\.age: non-finite number Infinity/],
    "top-level NaN":          [NaN, /value: non-finite number NaN/],
    "Date object":            [{ at: new Date(0) }, /value\.at: Date object/],
    "Map":                    [{ m: new Map() }, /value\.m: Map object/],
    "class instance":         [{ place: new Place() }, /value\.place: Place object/],
    "toJSON hook":            [{ date: "1922", toJSON: () => ({ date: "altered" }) }, /value\.toJSON: function/],
    "cycle":                  [cyclic, /value\.self: cycle/],
    "symbol-keyed property":  [withSymbolKey, /symbol-keyed property/],
    "accessor property":      [withGetter, /value\.where: accessor property/],
    "non-enumerable property": [hidden, /value\.secret: non-enumerable property/],
    "negative zero":          [-0, /value: negative zero/],
    "nested negative zero":   [{ offset: [0, -0] }, /value\.offset\[1\]: negative zero/],
    "array named property":   [namedArray, /value\.foo: array property that is not an element/],
    "array key 2^32-1":       [maxKeyArray, /value\.4294967295: array property that is not an element/],
    "array key -0 / 01":      [oddKeyArray, /value\.01: array property that is not an element/],
    "array symbol key":       [symArray, /value: symbol-keyed property/],
    "array accessor element": [getterArray, /value\[0\]: accessor element/],
    "array subclass":         [new (class Dates extends Array {})(), /value: array subclass/],
  };
  for (const [name, [v, re]] of Object.entries(bad)) {
    assert.match(nonDataAt(v) ?? "", re, `${name}: not named`);
    refuses(() => publicView(s, { ...base, projectValue: () => v }), /not data/);
  }
  // non-vacuity: deep JSON data passes unchanged, a shared (non-cyclic) reference is allowed,
  // and a null-prototype object is plain
  const shared = { y: 1 };
  const bare = Object.create(null); bare.date = "1922";
  const good = { date: "1922", place: null, ok: true, n: -0.5, list: [[1, 2], { a: "b" }], s1: shared, s2: shared, bare };
  assert.equal(nonDataAt(good), null);
  const pub = publicView(s, { ...base, projectValue: (v, at) => (at.claimId === "C-death" ? good : undefined) });
  assert.deepEqual(pub.claims["C-death"].value, JSON.parse(JSON.stringify(good)));
  assert.notEqual(pub.claims["C-death"].value.s1, shared, "detached copy");
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

/* ── PROTOTYPE KEYS ───────────────────────────────────────────────────────────
 * Every existence test in the reader is a bare lookup, and so are publicView's
 * two filters. On a plain object those answer YES for an id JavaScript puts on
 * every object, so a binding naming one passed the "is not held" test, passed
 * both privacy filters, and published its quote while the caller's layer had
 * refused every subject and every source. Tests 8, 9 and 22 exist for exactly
 * this class and are all anchored on an ordinary id ("NOPE", "LTR") — a gate
 * anchored on the well-formed case is silent on what it exists to catch.
 * Found by bee-laborer reviewing this PR; repaired with Object.create(null).
 * Each row below carries a CONTROL in the same call shape that must pass, so
 * a row cannot read clean because the mechanism never ran. */
const PROTO_IDS = ["toString", "valueOf", "constructor", "hasOwnProperty", "__proto__"];

function seededStore() {
  const s = createStore();
  addSource(s, src("s-real"));
  addClaim(s, claim("c-real", "P1", "birth", { date: "1880-03-24" }));
  return s;
}

test("a binding naming a prototype key is REFUSED, and for the true reason", () => {
  // CONTROL: an ordinary ghost id is refused, so the refusal path is reachable
  const control = seededStore();
  assert.throws(() => bind(control, { ...mention("s-ghost", "c-ghost"), quote: "held text" }),
    /source s-ghost is not held[\s\S]*claim c-ghost does not exist/);
  for (const id of PROTO_IDS) {
    const s = seededStore();
    assert.throws(() => bind(s, { ...mention(id, id), quote: "held text" }),
      new RegExp(`source ${id === "__proto__" ? "__proto__" : id} is not held`),
      `a binding whose sourceId is "${id}" must be refused`);
    assert.equal(s.bindings.length, 0, `"${id}" must leave no binding behind`);
  }
  // and no standing exists for a claim nobody added
  const s = seededStore();
  for (const id of PROTO_IDS) assert.throws(() => claimStanding(s, id), /does not exist/);
  assert.equal(claimStanding(s, "c-real").standing, "unsupported"); // CONTROL: a real claim answers
});

test("publicView publishes NOTHING that the caller's privacy layer refused — prototype ids included", () => {
  /* The two filters are ANDed, so a single plain map is MASKED by the other:
   * each sub-case below leaves exactly ONE of them deciding. "__proto__" is the
   * id that discriminates, because assigning it on a plain object invokes the
   * setter and creates NO own key — the map then answers from the prototype. */
  const s = seededStore();
  addSource(s, src("__proto__"));
  addClaim(s, claim("__proto__", "P1", "birth", { date: "1880-03-24" }));
  bind(s, { ...mention("__proto__", "__proto__"), quote: "SECRET FAMILY LETTER TEXT" });
  const view = (subject, source) => publicView(s, {
    isPublicSubject: () => subject, isPublicSource: () => source,
    projectText: (t) => t, projectValue: (v) => v,
  });

  // (a) both refused
  const none = view(false, false);
  assert.deepEqual(Object.keys(none.claims), []);
  assert.deepEqual(Object.keys(none.sources), []);
  assert.deepEqual(none.bindings, [], "neither may, so nothing publishes");

  // (b) the SUBJECT may, the SOURCE may not — only publicSource can refuse
  const noSource = view(true, false);
  assert.deepEqual(noSource.bindings, [],
    "a public subject does not make a private source public");
  assert.deepEqual(Object.keys(noSource.sources), []);

  // (c) the SOURCE may, the SUBJECT may not — only claims can refuse
  const noSubject = view(false, true);
  assert.deepEqual(noSubject.bindings, [],
    "a public source does not make a private subject's claim public");
  assert.deepEqual(Object.keys(noSubject.claims), []);

  // (d) CONTROL, non-vacuity: the same store DOES publish when both permit
  const all = view(true, true);
  assert.equal(all.bindings.length, 1, "the projection is reachable — the rows above are refusals, not an empty store");
  assert.deepEqual(Object.keys(all.sources), ["__proto__"]);
  assert.equal(all.bindings[0].quote, "SECRET FAMILY LETTER TEXT");
});

test("a source or claim whose id is a prototype key is held as an OWN key, not swallowed", () => {
  for (const id of PROTO_IDS) {
    const s = createStore();
    addSource(s, src(id));
    assert.deepEqual(Object.keys(s.sources), [id], `"${id}" must be stored as an own key`);
    addClaim(s, claim(id, "P1", "birth", { date: "1880-03-24" }));
    assert.deepEqual(Object.keys(s.claims), [id]);
    assert.deepEqual(validateStore(s), []);
    // the duplicate guard still works for it — the reason must stay TRUE
    assert.throws(() => addSource(s, src(id)), /already held/);
  }
  // CONTROL: an ordinary id behaves identically, so the row is about the ids
  const c = createStore();
  addSource(c, src("s-ordinary"));
  assert.deepEqual(Object.keys(c.sources), ["s-ordinary"]);
  assert.throws(() => addSource(c, src("s-ordinary")), /already held/);
});
