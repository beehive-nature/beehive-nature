// source contract — executable synthetic test of the REAL code (no private
// genealogy data in CI). Proves the acceptance laws, the negative controls,
// and that mutating provenance, assertions or source counts cannot upgrade a
// claim. The duplicate fixture mirrors the shape of a real private packet
// (shared parents, paired spouses, zero documents) with synthetic ids only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import vm from "node:vm";
import {
  SOURCE_SCHEMA, CLAIM_SCHEMA, BINDING_SCHEMA, STANDINGS, PUBLIC_FIELDS, SOURCE_KEYS, CLAIM_KEYS, BINDING_KEYS, nonDataAt,
  createStore, addSource, addClaim, bind, admit, validateStore,
  sourceProblems, claimProblems, claimStanding, personSupport, duplicateAssessment, publicView, bindingProblems,
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
  // SPEC PIN: a string key differing from the canonical index only by sign is
  // not an element, and JSON drops it. The numeric a[-0] IS index 0 and is kept,
  // so what this row fixes is the value/key asymmetry, not a second spelling.
  const negKeyArray = [1, 2]; negKeyArray["-0"] = "x";
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
    "array key 01":           [oddKeyArray, /value\.01: array property that is not an element/],
    "array key -0 string":    [negKeyArray, /value\.-0: array property that is not an element/],
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
      new RegExp(`source ${id} is not held`),
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

/* ── STORE SHAPE ────────────────────────────────────────────────
 * The repair above is a property of createStore(), not of the store. A
 * hand-built literal and JSON.parse(JSON.stringify(store)) both carry
 * Object.prototype again and bring the whole class back: a binding to a source
 * nobody holds, a standing for a claim nobody added, and "already held" for an
 * id nothing is stored under. Found by bee-laborer re-reading that repair.
 * The shape is now refused BY NAME, and each row below is anchored on ONE
 * entry point with a CONTROL in the same call shape, because the four entries
 * check it separately — bind's filter drops everything that is not a binding
 * problem, and the adders never call validateStore at all.
 * The privacy half needs none of this and is asserted nowhere below: publicView
 * builds its own null-prototype maps, so it publishes nothing the caller
 * refused under every store shape. Measured, not assumed.
 * COST, so it is not mistaken for free: a persisted store cannot be revived by
 * JSON.parse alone. Nothing here persists one, and the hand that does writes
 * the revive path. */
const handBuilt = (s) => ({ sources: { ...s.sources }, claims: { ...s.claims }, bindings: [...s.bindings], leads: [...s.leads] });
const jsonRevived = (s) => JSON.parse(JSON.stringify(s));
const REBUILT = [["hand-built", handBuilt], ["JSON-revived", jsonRevived]];

test("a store nobody built with createStore() is named, never walked", () => {
  for (const [label, rebuild] of REBUILT) {
    const s = rebuild(seededStore());
    assert.notEqual(Object.getPrototypeOf(s.sources), null, `${label}: the fixture asserts its precondition`);
    const problems = validateStore(s);
    for (const name of ["sources", "claims"])
      assert.ok(problems.some((p) => p.startsWith(`store.${name}: carries a prototype`) && p.includes("createStore()")),
        `${label}: store.${name} must be named, and the sentence must carry the remedy`);
    // every entry that validates refuses instead of answering from the prototype
    refuses(() => claimStanding(s, "constructor"), /store\.claims: carries a prototype/);
    refuses(() => personSupport(s, "P1"), /store\.(sources|claims): carries a prototype/);
    refuses(() => publicView(s, { isPublicSubject: () => true, isPublicSource: () => true }),
      /store\.(sources|claims): carries a prototype/);
  }
  // CONTROL: the store createStore() builds is clean and every one of those answers
  const ok = seededStore();
  assert.deepEqual(validateStore(ok), []);
  assert.equal(claimStanding(ok, "c-real").standing, "unsupported");
  assert.equal(personSupport(ok, "P1").support, "unsourced-entry");
  assert.deepEqual(Object.keys(publicView(ok, { isPublicSubject: () => true, isPublicSource: () => true }).claims), ["c-real"]);
});

test("an adder refuses a store it cannot store into, and the reason is TRUE", () => {
  for (const [label, rebuild] of REBUILT) {
    const s = rebuild(seededStore());
    refuses(() => addSource(s, src("s-new")), /store\.sources: carries a prototype/);
    refuses(() => addClaim(s, claim("c-new", "P1", "birth", { date: "1880-03-24" })), /store\.claims: carries a prototype/);
    assert.deepEqual(Object.keys(s.sources), ["s-real"], `${label}: a refused add stores nothing`);
    // the mirror of the same line. "already held" was the FALSE reason: nothing
    // is stored under __proto__, and on a plain map nothing can be.
    assert.equal(Object.keys(s.sources).includes("__proto__"), false);
    assert.throws(() => addSource(s, src("__proto__")), (e) => {
      assert.match(e.message, /store\.sources: carries a prototype/);
      assert.doesNotMatch(e.message, /already held/, `${label}: "already held" is a false reason here`);
      return true;
    });
  }
  // CONTROL: the same two calls land on a store createStore() built
  const ok = seededStore();
  addSource(ok, src("s-new"));
  addClaim(ok, claim("c-new", "P1", "birth", { date: "1880-03-24" }));
  assert.deepEqual(Object.keys(ok.sources).sort(), ["s-new", "s-real"]);
  assert.deepEqual(Object.keys(ok.claims).sort(), ["c-new", "c-real"]);
});

test("bind refuses a store-shape problem that its binding filter would drop", () => {
  for (const [label, rebuild] of REBUILT) {
    const s = rebuild(seededStore());
    refuses(() => bind(s, { ...mention("toString", "constructor"), quote: "SECRET FAMILY LETTER TEXT" }),
      /store\.sources: carries a prototype/);
    assert.equal(s.bindings.length, 0, `${label}: a refused bind leaves nothing behind`);
  }
  const ok = seededStore();
  // CONTROL (a): the same binding lands on a store createStore() built
  bind(ok, mention("s-real", "c-real"));
  assert.equal(ok.bindings.length, 1);
  // CONTROL (b): the filter was NOT widened to the whole store. It exists so an
  // unrelated invalid source does not refuse every honest bind, and it still does.
  const withJunk = seededStore();
  withJunk.sources["s-broken"] = { schema: SOURCE_SCHEMA, id: "s-broken" };
  assert.ok(validateStore(withJunk).some((p) => p.startsWith("source s-broken:")), "the fixture asserts its precondition");
  bind(withJunk, mention("s-real", "c-real"));
  assert.equal(withJunk.bindings.length, 1, "an unrelated invalid source does not refuse an honest binding");
  // CONTROL (c): a binding's OWN reason still reaches the caller
  refuses(() => bind(ok, mention("s-ghost", "c-real")), /source s-ghost is not held/);
});

/* bindingProblems is the one EXPORTED door that never asked for an own key.
 * The four entries above cover every INTERNAL path to it; a direct call is not
 * one of them, and on a hand-built or JSON-revived store the bare lookups
 * answered from the prototype. Pre-existing in both directions at a05f246d --
 * that commit neither introduced it nor closed it. Found by bee-laborer
 * re-reading a05f246d; the phantom-field half below is mine.
 * The repair is hasOwnProperty.call and NOT Object.create(null), for the reason
 * that is reversed in the adders: this path only READS, so it cannot report a
 * success and store nothing. Complementary to storeProblems -- strip either and
 * the other still answers. */
test("bindingProblems asks for an OWN key, on a store it did not build", () => {
  for (const [label, rebuild] of REBUILT) {
    const s = rebuild(seededStore());
    assert.notEqual(Object.getPrototypeOf(s.sources), null, `${label}: the fixture asserts its precondition`);
    const out = bindingProblems(mention("toString", "constructor"), s);
    assert.ok(out.some((p) => p.includes("source toString is not held")), `${label}: the source must be named`);
    assert.ok(out.some((p) => p.includes("claim constructor does not exist")), `${label}: the claim must be named`);
    // CONTROL: the row is not satisfied by a door that refuses everything
    assert.deepEqual(bindingProblems(mention("s-real", "c-real"), s), [], `${label}: an honest binding stays clean`);
  }
  // CONTROL: the same two calls on the store createStore() builds
  const ok = seededStore();
  assert.deepEqual(bindingProblems(mention("s-real", "c-real"), ok), []);
  assert.equal(bindingProblems(mention("s-ghost", "c-ghost"), ok).length, 2);
});

test("a caller-supplied prototype supplies ARBITRARY ids, and its records were deciding the verdict", () => {
  const base = seededStore();
  const proto = { "ghost-src": src("ghost-src"), "ghost-claim": claim("ghost-claim", "P9", "death", { date: "1900-01-01" }) };
  const sources = Object.assign(Object.create(proto), base.sources);
  const claims = Object.assign(Object.create(proto), base.claims);
  const s = { ...base, sources, claims };
  // the fixture asserts its precondition: inherited, not own, and reachable by a bare lookup
  assert.deepEqual(Object.keys(s.sources), ["s-real"], "the ghost is INHERITED, never an own key");
  assert.equal(s.sources["ghost-src"], proto["ghost-src"], "a bare lookup still reaches it — that is the defect's mechanism");

  // the class is not the JavaScript names, so a blocklist of them never closes it
  const out = bindingProblems(mention("ghost-src", "ghost-claim"), s);
  assert.ok(out.some((p) => p.includes("source ghost-src is not held")), "an attacker-chosen id must be named");
  assert.ok(out.some((p) => p.includes("claim ghost-claim does not exist")), "an attacker-chosen id must be named");

  // and it was never only a missing refusal: the phantom record's OWN FIELDS
  // reached the verdict text. Neither sentence may be computed off a record
  // nobody holds.
  const convert = bindingProblems(link("ghost-src", "ghost-claim", "supports", "birth"), s);
  assert.doesNotMatch(convert.join(" | "), /assertions never convert/,
    "a predicate read off a claim nobody holds must not decide an assertion match");
  const noLocator = bindingProblems(link("ghost-src", "ghost-claim", "supports", "death", { locator: null }), s);
  assert.doesNotMatch(noLocator.join(" | "), /needs a locator/,
    "a type and scope read off a source nobody holds must not decide a locator demand");

  // NON-VACUITY, from the live population in both directions: both sentences are
  // reachable, so doesNotMatch above is a verdict and not an absent instrument.
  const ok = seededStore();
  addSource(ok, src("s-coll"));
  addClaim(ok, claim("c-death", "P9", "death", { date: "1900-01-01" }));
  assert.match(bindingProblems(link("s-coll", "c-death", "supports", "birth"), ok).join(" | "), /assertions never convert/);
  assert.match(bindingProblems(link("s-coll", "c-death", "supports", "death", { locator: null }), ok).join(" | "), /needs a locator/);
  // CONTROL: an honest binding on the SAME poisoned store is still clean
  assert.deepEqual(bindingProblems(mention("s-real", "c-real"), s), []);
});

/* ── THE DUPLICATE KEY ───────────────────────────────────────────────────────
 * validateStore joins three caller strings to spot one entry counted twice.
 * "|" is this module's OWN delimiter -- parties() splits a two-party subject on
 * it -- so an id carrying one is ordinary here, not exotic, and concatenating
 * three fields on it made two genuinely distinct bindings join equal. One
 * honest pair then denied the WHOLE store with a sentence naming a duplicate
 * that does not exist: validateStore reported it, and claimStanding and
 * publicView threw on it. A "|" in free LOCATOR text was always harmless; the
 * trigger is a "|" in an ID. Pre-existing in all three directions at 05b8d93c
 * -- neither introduced nor closed there. Found by bee-laborer re-reading it.
 * A fail-closed path still owes a TRUE reason. */
const permitAll = (s) => publicView(s, { isPublicSubject: () => true, isPublicSource: () => true });

test("two distinct bindings do not join on this module's own delimiter", () => {
  for (const [label, build] of [
    ["a | in a CLAIM id", () => {
      const s = createStore();
      addSource(s, src("S1"));
      addClaim(s, claim("ID-FA|FB", "FA|FB", "identity", "same person"));
      addClaim(s, claim("ID-FA", "P1", "birth", { date: "1880-03-24" }));
      return [s, { ...mention("S1", "ID-FA|FB"), locator: "p. 4" }, { ...mention("S1", "ID-FA"), locator: "FB|p. 4" }];
    }],
    ["a | in a SOURCE id", () => {
      const s = createStore();
      addSource(s, src("S1|v2"));
      addSource(s, src("S1"));
      addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
      addClaim(s, claim("v2|C1", "P1", "death", { date: "1922-01-04" }));
      return [s, { ...mention("S1|v2", "C1"), locator: "p. 4" }, { ...mention("S1", "v2|C1"), locator: "p. 4" }];
    }],
  ]) {
    const [s, b1, b2] = build();
    // the fixture asserts its precondition: distinct BEFORE any key is built
    assert.ok(b1.sourceId !== b2.sourceId || b1.claimId !== b2.claimId || b1.locator !== b2.locator,
      `${label}: the pair is distinct field by field`);
    bind(s, b1);
    bind(s, b2); // this is the one the concatenated key refused
    assert.equal(s.bindings.length, 2, `${label}: both honest bindings are held`);
    assert.deepEqual(validateStore(s), [], `${label}: and the store is not denied afterwards`);
    assert.equal(permitAll(s).bindings.length, 2, `${label}: the projection is reachable, not thrown`);
  }
  // CONTROL, non-vacuity: a genuine duplicate is still refused, by name
  const g = createStore();
  addSource(g, src("S1"));
  addClaim(g, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  bind(g, { ...mention("S1", "C1"), locator: "p. 4" });
  refuses(() => bind(g, { ...mention("S1", "C1"), locator: "p. 4" }), /duplicate \(one entry counted twice/);
  // CONTROL: the LOCATOR is part of the key, and a "|" inside free locator text
  // is harmless — three bindings differing only there stay three, and a fourth
  // that repeats one of them is still caught
  const u = createStore();
  addSource(u, src("S1"));
  addClaim(u, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  addClaim(u, claim("C2", "P1", "death", { date: "1922-01-04" }));
  bind(u, { ...mention("S1", "C1"), locator: "vol. 3 | p. 118" });
  bind(u, { ...mention("S1", "C2"), locator: "vol. 3 | p. 118" });
  bind(u, { ...mention("S1", "C1"), locator: "vol. 3 |p. 118" });
  assert.equal(u.bindings.length, 3, "a | in the locator alone never joins two bindings");
  refuses(() => bind(u, { ...mention("S1", "C1"), locator: "vol. 3 |p. 118" }), /duplicate/);
});

/* ── RECORD SHAPE ────────────────────────────────────────────────────────────
 * The mirror of the store-shape row, asked about a RECORD. unknownKeys reads
 * OWN keys only and every field check reads `o.k` bare, so a record built with
 * Object.create(proto) was admitted on fields nobody wrote into it — and the
 * symptom is publication, not only admission: an inherited `url` satisfied
 * locatability and then left RAW through the structural allowlist with no
 * caller decision at all, an inherited `subject` was the id publicView asked
 * isPublicSubject about, and an inherited `quote` left on a binding whose own
 * keys were ["schema"] alone. Pre-existing in all three directions at 05b8d93c.
 * Sources were bee-laborer's row; claims and bindings are mine and reproduce
 * identically, so the repair is ONE check shared by the three record gates.
 * Each arm asserts the gate returns EXACTLY the shape sentence: every other
 * sentence is computed off the record's fields, and a verdict computed off an
 * INHERITED field is the defect itself. */
const SHAPE = /carries a prototype, so a field nobody wrote into this record/;
const OWN_SOURCE = { schema: SOURCE_SCHEMA, id: "s-proto", type: "parish-register", scope: "collection", provider: "Synthetic Parish Archive", accessedAt: "2026-09-23" };

test("a record nobody built as a plain object is named, never read", () => {
  // (1) each gate names it, and says nothing else
  const inheritedSource = Object.assign(Object.create({ url: "https://private.example/signed?token=SECRET", title: "PRIVATE FAMILY LETTER" }), OWN_SOURCE);
  assert.deepEqual(Object.keys(inheritedSource), Object.keys(OWN_SOURCE), "the fixture asserts its precondition: url and title are INHERITED");
  assert.equal(inheritedSource.url, "https://private.example/signed?token=SECRET", "and a bare read still reaches them");
  assert.deepEqual(sourceProblems(inheritedSource), [`source s-proto: carries a prototype, so a field nobody wrote into this record can read as its own -- build it as a plain object`]);

  const inheritedClaim = Object.assign(Object.create({ subject: "P-LIVING", predicate: "birth", value: { date: "1990-01-01" } }), { schema: CLAIM_SCHEMA, id: "c-proto" });
  assert.deepEqual(Object.keys(inheritedClaim), ["schema", "id"]);
  assert.equal(claimProblems(inheritedClaim).length, 1, "the CLAIM gate must name the shape, and say nothing computed off an inherited field");
  assert.match(claimProblems(inheritedClaim)[0], SHAPE);

  const seeded = createStore();
  addSource(seeded, src("S1"));
  addClaim(seeded, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  const inheritedBinding = Object.assign(Object.create({ sourceId: "S1", claimId: "C1", relation: "mentions", quote: "SECRET LETTER TEXT" }), { schema: BINDING_SCHEMA });
  assert.deepEqual(Object.keys(inheritedBinding), ["schema"]);
  assert.equal(bindingProblems(inheritedBinding, seeded).length, 1, "the BINDING gate must name the shape, and say nothing computed off an inherited field");
  assert.match(bindingProblems(inheritedBinding, seeded)[0], SHAPE);

  // (2) the doors refuse, and nothing is left behind
  const s = createStore();
  refuses(() => addSource(s, inheritedSource), SHAPE);
  refuses(() => addClaim(s, inheritedClaim), SHAPE);
  refuses(() => bind(seeded, inheritedBinding), SHAPE);
  assert.deepEqual(Object.keys(s.sources), [], "a refused add stores nothing");
  assert.equal(seeded.bindings.length, 0, "a refused bind leaves nothing behind");

  // (3) the publication half, with NO projectText supplied: `url` is structural,
  // so at 05b8d93c it left with no caller decision at all. The store map itself
  // is the one createStore() built, so this is the RECORD being refused.
  const held = createStore();
  held.sources["s-proto"] = inheritedSource;
  addClaim(held, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  held.bindings.push({ ...mention("s-proto", "C1"), locator: "p. 4" });
  refuses(() => permitAll(held), SHAPE);

  // (4) a claim's inherited SUBJECT was the id the privacy layer was asked about
  const asked = [];
  const heldClaim = createStore();
  heldClaim.claims["c-proto"] = inheritedClaim;
  assert.throws(() => publicView(heldClaim, { isPublicSubject: (p) => { asked.push(p); return true; }, isPublicSource: () => true }), SHAPE);
  assert.deepEqual(asked, [], "no privacy decision is taken about a subject nobody wrote into the record");

  // (5) the shape refusal comes FIRST, because the record's own type may be
  // inherited too: at 05b8d93c this returned "a hint is a lead, not a source",
  // a verdict computed off a field nobody wrote in.
  const inheritedType = Object.assign(Object.create({ type: "hint" }), {
    schema: SOURCE_SCHEMA, id: "s-typed", scope: "collection", provider: "Synthetic Parish Archive",
    title: "Register s-typed", recordId: "REG-s-typed", accessedAt: "2026-09-23",
  });
  assert.equal(inheritedType.type, "hint", "the fixture asserts its precondition");
  assert.equal(sourceProblems(inheritedType).length, 1, "the SOURCE gate asks about the shape before it reads s.type");
  assert.match(sourceProblems(inheritedType)[0], SHAPE);

  // CONTROL: an ordinary record passes every gate and publishes its OWN url
  const ok = createStore();
  addSource(ok, src("s-own", { url: "https://archive.example/open/1" }));
  addClaim(ok, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  bind(ok, { ...mention("s-own", "C1"), locator: "p. 4" });
  assert.equal(permitAll(ok).sources["s-own"].url, "https://archive.example/open/1", "the publication path is reachable — (3) is a refusal, not an empty projection");

  // CONTROL: null inherits nothing, so a null-prototype record is DATA and is
  // admitted. The row is not "refuse every shape that is not the usual one".
  const nul = createStore();
  const nullProto = Object.assign(Object.create(null), src("s-null"));
  assert.equal(Object.getPrototypeOf(nullProto), null, "the fixture asserts its precondition");
  assert.deepEqual(sourceProblems(nullProto), []);
  addSource(nul, nullProto);
  assert.deepEqual(Object.keys(nul.sources), ["s-null"]);

  // CONTROL: JSON revival cannot build one — "__proto__" arrives as an OWN key,
  // and unknownKeys names it. A different and more precise reason, kept.
  const revived = JSON.parse(`{"schema":"${SOURCE_SCHEMA}","id":"s-json","type":"parish-register","scope":"collection","provider":"P","title":"T","recordId":"R","accessedAt":"2026-09-23","__proto__":{"url":"https://private.example/x"}}`);
  assert.equal(Object.getPrototypeOf(revived), Object.prototype, "the fixture asserts its precondition");
  assert.deepEqual(sourceProblems(revived), ["source s-json: unknown key __proto__"]);
});

/* ── THE DUPLICATE KEY, SECOND HALF: COERCION ────────────────────────────────
 * Joining the three parts above closed the delimiter and stopped the key
 * COERCING. The store never stopped: its maps are indexed by PROPERTY KEY, so a
 * source held under "5" is the same source a binding names as 5 -- heldUnder
 * resolves it and bindingProblems returns clean -- and one entry bound twice was
 * then held twice and PUBLISHED as two bindings on one source, which is this
 * sentence's own law read backwards. A REGRESSION of the join: it arrived WITH
 * ff8746f6 and was not there before, and bee-laborer found it re-reading that
 * head. The precondition below carries the row's whole weight: the pair must be
 * one entry the store really does resolve, or the refusal proves nothing. */
test("one entry bound twice is one entry, whatever type its ids arrive as", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("5"));
    addClaim(s, claim("7", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  const s = one();
  // the fixture asserts its precondition: the NUMERIC ids resolve to the very
  // records the string ids name, so the second bind is the same entry and not a
  // binding that is merely invalid for some other reason
  assert.deepEqual(bindingProblems({ ...mention(5, 7), locator: "p. 4" }, s), [],
    "the store resolves the numeric ids — the two bindings are one entry");
  bind(s, { ...mention("5", "7"), locator: "p. 4" });
  assert.throws(() => bind(s, { ...mention(5, 7), locator: "p. 4" }), /duplicate \(one entry counted twice/,
    "a numeric id names the record the string id names, so this is one entry bound twice");
  assert.equal(s.bindings.length, 1, "one entry, one binding");
  assert.equal(permitAll(s).bindings.length, 1, "and the projection is one binding on one source");

  // the locator is part of the key and is coerced with the ids
  const l = one();
  bind(l, { ...mention("5", "7"), locator: "0" });
  assert.throws(() => bind(l, { ...mention("5", "7"), locator: 0 }), /duplicate/,
    "the LOCATOR is part of the key and is coerced with the ids");

  // CONTROL, non-vacuity in both types: a genuine duplicate was always refused
  const gs = one(); bind(gs, { ...mention("5", "7"), locator: "p. 4" });
  refuses(() => bind(gs, { ...mention("5", "7"), locator: "p. 4" }), /duplicate/);
  const gn = one(); bind(gn, { ...mention(5, 7), locator: "p. 4" });
  refuses(() => bind(gn, { ...mention(5, 7), locator: "p. 4" }), /duplicate/);

  // CONTROL: coercing does not make distinct entries join — two claims, and the
  // delimiter pair from the row above, which the first half of this fix bought
  const d = one();
  addClaim(d, claim("8", "P1", "death", { date: "1922-01-04" }));
  bind(d, { ...mention(5, "7"), locator: "p. 4" });
  bind(d, { ...mention("5", 8), locator: "p. 4" });
  assert.equal(d.bindings.length, 2, "two entries stay two");
  const p = createStore();
  addSource(p, src("S1"));
  addClaim(p, claim("ID-FA|FB", "FA|FB", "identity", "same person"));
  addClaim(p, claim("ID-FA", "P1", "birth", { date: "1880-03-24" }));
  bind(p, { ...mention("S1", "ID-FA|FB"), locator: "p. 4" });
  bind(p, { ...mention("S1", "ID-FA"), locator: "FB|p. 4" });
  assert.equal(p.bindings.length, 2, "the delimiter half survives the coercion half");

  // The DISCLOSED boundary owes its own row: the locator is not a map key, so an
  // OBJECT locator is left to JSON rather than coerced. Coercing it would both
  // join two distinct ones ("[object Object]" twice) and turn a null-prototype
  // locator from a held binding into a thrown TypeError.
  const o = one();
  assert.doesNotThrow(() => bind(o, { ...mention("5", "7"), locator: Object.assign(Object.create(null), { page: 11 }) }),
    "an OBJECT locator is left to JSON, never coerced into a throw");
  bind(o, { ...mention("5", "7"), locator: { page: 4 } });
  assert.doesNotThrow(() => bind(o, { ...mention("5", "7"), locator: { page: 9 } }),
    "two DISTINCT object locators are two entries — coercing them would join every object locator");
  assert.equal(o.bindings.length, 3, "three distinct object locators stay three");
  assert.deepEqual(validateStore(o), [], "and the store carrying a null-prototype locator is not denied");
  refuses(() => bind(o, { ...mention("5", "7"), locator: { page: 4 } }), /duplicate/);
});

/* ── THE PROTOTYPE TEST ASKS A SHAPE, NOT AN IDENTITY ────────────────────────
 * The record-shape check above compared the prototype to `Object.prototype` by
 * IDENTITY, which is realm-local. node:vm is a live idiom in this tree, and a
 * record built in another realm carries THAT realm's Object.prototype: the same
 * own keys, the same inherited surface, ZERO inherited data fields -- and was
 * refused with a sentence asserting a consequence that is false about it.
 * Arrived with ff8746f6, found by bee-laborer re-reading it.
 * The accepted set is "no prototype, or ONE level carrying EXACTLY the names
 * Object.prototype carries". Both halves are load-bearing and each has its
 * control below: drop the depth and a masking chain hides a field further up;
 * compare only how MANY names and a realm that traded one name for a field
 * walks in. What makes the whole thing sound is the row after it. */
test("a record from another realm is a plain record", () => {
  const realm = () => vm.runInNewContext("({})");
  const NAMES = Object.getOwnPropertyNames(Object.prototype);
  assert.notEqual(Object.getPrototypeOf(realm()), Object.prototype, "the fixture asserts its precondition: another realm");
  const inherited = (o) => { const out = []; for (const k in o) if (!Object.hasOwn(o, k)) out.push(k); return out; };

  const foreign = Object.assign(realm(), src("s-vm", { scope: "item" }));
  assert.deepEqual(inherited(foreign), [], "the fixture asserts its precondition: nothing is inherited");
  assert.deepEqual(Object.keys(foreign).sort(), Object.keys(src("s-vm", { scope: "item" })).sort());
  assert.deepEqual(sourceProblems(foreign), []);
  const fs2 = createStore();
  addSource(fs2, foreign);
  addClaim(fs2, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  bind(fs2, Object.assign(realm(), mention("s-vm", "C1")));
  assert.equal(permitAll(fs2).bindings.length, 1, "the binding gate takes one too — it is one shared check");

  const SHAPE_ONLY = (id) => [`source ${id}: carries a prototype, so a field nobody wrote into this record can read as its own -- build it as a plain object`];
  // CONTROL: one level DEEPER, masked so the immediate prototype's name set
  // matches exactly. Only the depth half refuses this one.
  const masked = Object.create({ url: "https://private.example/?token=SECRET" });
  for (const n of NAMES) Object.defineProperty(masked, n, { value: undefined, enumerable: false, configurable: true });
  const deep = Object.assign(Object.create(masked), src("s-deep", { recordId: undefined }));
  assert.equal(deep.url, "https://private.example/?token=SECRET", "the fixture asserts its precondition: the field is reachable");
  assert.deepEqual(Object.getOwnPropertyNames(masked).sort(), [...NAMES].sort(), "and the immediate prototype's names match exactly");
  assert.deepEqual(sourceProblems(deep), SHAPE_ONLY("s-deep"),
    "a masking chain one level deeper hides a field the name set cannot see");

  // CONTROL: a realm that traded one of those names for a field of its own —
  // the SAME COUNT, a different set. Only the name half refuses this one.
  const traded = vm.runInNewContext("delete Object.prototype.toLocaleString; Object.prototype.url = 'https://private.example/?token=SECRET'; ({})");
  assert.equal(traded.url, "https://private.example/?token=SECRET", "the fixture asserts its precondition");
  assert.equal(Object.getOwnPropertyNames(Object.getPrototypeOf(traded)).length, NAMES.length, "and it is the same COUNT of names");
  assert.deepEqual(sourceProblems(Object.assign(traded, src("s-traded", { recordId: undefined }))), SHAPE_ONLY("s-traded"),
    "a realm that traded a name for a field of its own has the same COUNT and a different SET");

  // CONTROL: the shapes the identity test refused are still refused, and the
  // ones it admitted are still admitted
  assert.deepEqual(sourceProblems(Object.assign(Object.create({ url: "x" }), src("s-loc"))), SHAPE_ONLY("s-loc"));
  assert.equal(sourceProblems([]).length, 1, "an array carries Array.prototype and is one level too deep");
  assert.deepEqual(sourceProblems(Object.assign(Object.create(null), src("s-null"))), []);
  assert.deepEqual(sourceProblems(src("s-here")), []);
});

/* What bounds the widening: a chain the check ACCEPTS cannot carry anything this
 * module reads, because no key it reads is one of the names such a chain is
 * allowed to have. Asserted as a MECHANISM and not as a list comparison — a list
 * of read keys compared to the prototype's names is satisfied by an EMPTY list,
 * and this is not: it builds the most hostile accepted chain there is, one whose
 * every allowed name is poisoned, and requires all three gates to answer exactly
 * as they answer for an ordinary record. Add a schema key named like a member of
 * Object.prototype and this row falls. */
test("the chain this accepts cannot carry a field any gate reads", () => {
  const POISON = "INHERITED-POISON";
  const proto = Object.create(null);
  for (const n of Object.getOwnPropertyNames(Object.prototype))
    Object.defineProperty(proto, n, { value: POISON, enumerable: false, configurable: true });
  const on = (rec) => Object.assign(Object.create(proto), rec);

  const s = on(src("s-p")), c = on(claim("C1", "P1", "birth", { date: "1880-03-24" })), b = on(mention("s-p", "C1"));
  // the fixture asserts its precondition: every allowed name really is poisoned,
  // and the chain really is one this check accepts
  assert.equal(s.toString, POISON, "the poison is reachable");
  assert.deepEqual(sourceProblems(s), [], "the chain is accepted");

  const store = createStore();
  addSource(store, src("s-p"));
  addClaim(store, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  assert.deepEqual(sourceProblems(s), sourceProblems(src("s-p")), "the SOURCE gate answers as it does for an ordinary record");
  assert.deepEqual(claimProblems(c), claimProblems(claim("C1", "P1", "birth", { date: "1880-03-24" })), "the CLAIM gate does");
  assert.deepEqual(bindingProblems(b, store), bindingProblems(mention("s-p", "C1"), store), "the BINDING gate does");

  // CONTROL, non-vacuity: give that same chain ONE name of its own and every
  // gate refuses it, so the assertions above are not passing on an inert fixture
  const wider = Object.create(null);
  for (const n of [...Object.getOwnPropertyNames(Object.prototype), "url"])
    Object.defineProperty(wider, n, { value: POISON, enumerable: false, configurable: true });
  assert.equal(sourceProblems(Object.assign(Object.create(wider), src("s-w"))).length, 1);
  assert.equal(claimProblems(Object.assign(Object.create(wider), claim("C2", "P1", "birth", 1))).length, 1);
  assert.equal(bindingProblems(Object.assign(Object.create(wider), mention("s-p", "C1")), store).length, 1);
});

/* ── AN ID IS A MAP KEY; THE STORE KEYS IT BY ToString ───────────────────────
 * The coercion above exempted objects and symbols from the key, and the comment
 * licensing that exemption was about the LOCATOR alone -- a field that is not a
 * map key. Applied to the two IDS it broke in BOTH directions out of one
 * expression, because ToPropertyKey is ToString for every non-symbol: an object
 * id whose toString reads "S1" resolves through heldUnder to the source held
 * under "S1", so the same entry bound twice was held twice and published as two
 * bindings on one source; and two DIFFERENT object ids both serialised to "{}",
 * so an honest second binding was denied as a duplicate of the first. Found by
 * bee-laborer re-reading 14528dee. The precondition carries the row: the object
 * form must be an entry the store really does resolve, or neither half proves
 * anything. */
test("an id the store resolves is the same id, whatever object it arrives as", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  const objId = (t) => ({ toString: () => t });

  // the fixture asserts its precondition: the OBJECT ids resolve to the very
  // records the string ids name, so the second bind below is one entry twice
  const s = one();
  assert.deepEqual(bindingProblems({ ...mention(objId("S1"), objId("C1")), locator: "p. 4" }, s), [],
    "the store resolves the object ids — the two bindings are one entry");
  bind(s, { ...mention("S1", "C1"), locator: "p. 4" });
  assert.throws(() => bind(s, { ...mention(objId("S1"), objId("C1")), locator: "p. 4" }), /duplicate \(one entry counted twice/,
    "an object id names the record its toString names, so this is one entry bound twice");
  assert.equal(s.bindings.length, 1, "one entry, one binding");
  assert.equal(permitAll(s).bindings.length, 1, "and the projection is one binding on one source");

  // the other direction of the SAME exemption: two DISTINCT object ids joined
  const d = one();
  addSource(d, src("S2"));
  bind(d, { ...mention(objId("S1"), "C1"), locator: "p. 4" });
  assert.doesNotThrow(() => bind(d, { ...mention(objId("S2"), "C1"), locator: "p. 4" }),
    "two DIFFERENT object ids are two sources — joining them names a duplicate that does not exist");
  assert.equal(d.bindings.length, 2, "two entries stay two");

  // CONTROL, non-vacuity: a genuine duplicate in the object form was always
  // refused, so the first half is not passing on a gate that refuses everything
  const g = one();
  const o1 = objId("S1"), o2 = objId("C1");
  bind(g, { ...mention(o1, o2), locator: "p. 4" });
  refuses(() => bind(g, { ...mention(o1, o2), locator: "p. 4" }), /duplicate/);

  // CONTROL: an object id naming a source nobody holds is still not held —
  // coercing the key did not make the lookup lie
  const gh = one();
  refuses(() => bind(gh, { ...mention(objId("S-ghost"), "C1"), locator: "p. 4" }), /source S-ghost is not held/);

  // CONTROL: the LOCATOR keeps its exemption, which is what the row is about —
  // two distinct object locators on one source and one claim are two entries
  const l = one();
  bind(l, { ...mention("S1", "C1"), locator: { page: 4 } });
  assert.doesNotThrow(() => bind(l, { ...mention("S1", "C1"), locator: { page: 9 } }),
    "an object LOCATOR is not a map key and is still left to its own value");
  assert.equal(l.bindings.length, 2);
});

/* ── A LOCATOR THAT CANNOT CARRY AN IDENTITY IS NAMED, NEVER THROWN ──────────
 * The locator is left to JSON because it is not a map key. JSON is not total
 * over it: a CIRCULAR locator and one holding a BIGINT threw a TypeError, and a
 * SYMBOL and an object whose toJSON returns undefined both serialised to
 * nothing, so two distinct ones joined. The throw is the worse half and it
 * escaped as a crash rather than a refusal -- the exported door returned CLEAN
 * for such a binding while validateStore, claimStanding, personSupport and
 * publicView all died on it. Found by bee-laborer re-reading 14528dee.
 * Measured and refused: nonDataAt closes the same four shapes and is this
 * module's own instrument, but its prototype tests are IDENTITY tests, so it
 * would also refuse a cross-realm object, a cross-realm array, a Date and a
 * function locator -- all four key correctly today, and the controls below are
 * what a reader would fall on if anyone reaches for it later. */
test("a locator JSON cannot express is refused by name, and every other shape still keys", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  const circular = (i) => { const o = { page: i }; o.self = o; return o; };

  // refused BY NAME at the door, and the sentence carries the cause
  for (const [what, mk, why] of [
    ["a cycle", circular, /locator cannot be part of a duplicate key -- .*circular/],
    ["a bigint", (i) => ({ page: BigInt(i) }), /locator cannot be part of a duplicate key -- .*BigInt/],
    ["a symbol", (i) => Symbol(`loc-${i}`), /locator does not survive serialisation/],
    ["a toJSON that returns undefined", (i) => ({ page: i, toJSON: () => undefined }), /locator does not survive serialisation/],
  ]) {
    // caught by hand, not by assert.throws: a non-matching regex makes
    // assert.throws itself the failure, so a `not a TypeError` assertion placed
    // after it is a row nothing ever plays. The three questions are separate —
    // was it refused at all, was the refusal a refusal rather than a crash, and
    // does the sentence carry the cause — and each gets its own assertion.
    const s = one();
    let e = null;
    try { bind(s, { ...mention("S1", "C1"), locator: mk(4) }); } catch (err) { e = err; }
    assert.ok(e, `a locator carrying ${what} is refused rather than accepted`);
    assert.ok(!(e instanceof TypeError), `${what}: refused BY NAME, not by crash — a fail-closed path still owes a true reason (got ${e.message.split("\n")[0]})`);
    assert.match(e.message, why, `${what}: and the sentence carries the cause`);
    assert.equal(s.bindings.length, 0, `${what}: and nothing was held`);
  }

  // the exported door and the gates agree, on a store that ALREADY holds one:
  // this is what threw a TypeError out of all four
  const held = one();
  const b = { ...mention("S1", "C1"), locator: circular(4) };
  held.bindings.push(b); // pushed past bind(), the way a hand-built store arrives
  assert.deepEqual(bindingProblems(b, held), ["binding S1→C1: locator cannot be part of a duplicate key -- Converting circular structure to JSON"],
    "the exported door answers for it, rather than returning clean on a binding every gate dies on");
  assert.deepEqual(validateStore(held), bindingProblems(b, held), "and validateStore says it once, not twice");
  for (const [name, fn] of [["claimStanding", () => claimStanding(held, "C1")], ["personSupport", () => personSupport(held, "P1")], ["publicView", () => permitAll(held)]]) {
    let e = null;
    try { fn(); } catch (err) { e = err; }
    assert.ok(e, `${name} refuses a store it cannot key`);
    assert.ok(!(e instanceof TypeError), `${name}: refused BY NAME, not by crash (got ${e.message.split("\n")[0]})`);
    assert.match(e.message, /locator cannot be part of a duplicate key/, `${name}: and the sentence carries the cause`);
  }

  // and two unkeyable bindings do not become a duplicate of each other: an
  // unkeyable locator joins NOTHING rather than joining everything, which is
  // the difference between skipping it and keying it as null
  const pair = one();
  pair.bindings.push({ ...mention("S1", "C1"), locator: circular(4) }, { ...mention("S1", "C1"), locator: circular(9) });
  const said = validateStore(pair);
  assert.equal(said.length, 2, "one sentence each");
  // /duplicate/ alone is satisfied by the refusal's OWN wording ("duplicate
  // key"), so the assertion names the duplicate SENTENCE and not the word it
  // shares with the refusal it is checking is absent
  assert.ok(!said.some((p) => /duplicate \(one entry counted twice/.test(p)), "and neither is reported as a duplicate of the other");

  // CONTROLS — every keyable shape still keys, and two distinct ones stay two.
  // These are the rows nonDataAt would have taken down: the first three are the
  // realm-local defect this commit's parent repaired one function over.
  for (const [what, mk] of [
    ["a cross-realm plain object", (i) => Object.assign(vm.runInNewContext("({})"), { page: i })],
    ["a cross-realm array", (i) => vm.runInNewContext(`[${i}]`)],
    ["a Date", (i) => new Date(Date.UTC(2026, 0, i))],
    ["a function", (i) => new Function(`return ${i};`)],
    ["a null-prototype object", (i) => Object.assign(Object.create(null), { page: i })],
    ["a plain object", (i) => ({ page: i })],
    ["an ordinary string", (i) => `p. ${i}`],
  ]) {
    const s = one();
    assert.doesNotThrow(() => bind(s, { ...mention("S1", "C1"), locator: mk(4) }), `${what} is a keyable locator`);
    assert.doesNotThrow(() => bind(s, { ...mention("S1", "C1"), locator: mk(9) }), `${what}: two DISTINCT locators are two entries`);
    assert.equal(s.bindings.length, 2, `${what}: two entries stay two`);
    refuses(() => bind(s, { ...mention("S1", "C1"), locator: mk(4) }), /duplicate/);
  }

  // CONTROL: nesting the locator's JSON TEXT in the key adds no join, because
  // JSON quotes strings — the object and a string that reads like its
  // serialisation are two entries
  const n = one();
  bind(n, { ...mention("S1", "C1"), locator: { page: 4 } });
  assert.doesNotThrow(() => bind(n, { ...mention("S1", "C1"), locator: '{"page":4}' }),
    "the object and the string that reads like its serialisation are two entries");
  assert.equal(n.bindings.length, 2);

  // CONTROL: an absent locator is the empty string on both sides, so the row
  // did not quietly make every unlocated binding unkeyable
  const a = one();
  bind(a, mention("S1", "C1"));
  refuses(() => bind(a, { ...mention("S1", "C1"), locator: "" }), /duplicate/);
});

// A gate that is supposed to ANSWER must not be allowed to report a crash as
// this row's verdict: the engine's own message names what broke and never which
// claim of the row broke. Measured — four arms of the battery below first fell
// with `Cannot convert object to primitive value` as their whole reason.
const answered = (fn, what) => {
  try { return fn(); } catch (e) {
    assert.fail(`${what}: answered rather than crashing (got ${e?.constructor?.name}: ${String(e?.message).split("\n")[0]})`);
  }
};

/* An id the sentence machine cannot NAME crashed every entry instead of
 * refusing at one. `binding ${sourceId}→${claimId}` is a template literal, so a
 * null-prototype id and an id whose toString throws made bind(), the exported
 * door, validateStore, claimStanding, personSupport and publicView all fail by
 * TypeError -- six entries, the shape the locator row above closed one field
 * over. Pre-existing (`at` sits at 619e809c:122); the sentence in validateStore
 * that cleared the ids was mine and is deleted. Found by bee-laborer re-reading
 * 8c467528.
 * MEASURED AND NOT TAKEN, so the boundary is looked over rather than assumed:
 * sourceProblems and claimProblems carry the same class on a RECORD's own id
 * field (`source ${s?.id ?? "?"}` at :143), and all three shapes crash there
 * too. That is not this row -- a record's id is already contracted to be a
 * string by `text(s.id)`, so the sentence it owes is "no id", not "cannot be
 * named", and choosing between them is a shape decision for the file's owner.
 * The same measurement is why publicView's own `${b.sourceId}→${b.claimId}`
 * needs nothing: a source can never be HELD under such an id, because
 * sourceProblems refuses first, so the projection is not reachable with one. */
test("an id that cannot be named is refused BY NAME at every entry, not thrown out of them", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  const unnameable = [
    ["a null-prototype id", () => Object.assign(Object.create(null), { tag: "x" }), /sourceId cannot be named -- Cannot convert object to primitive value/],
    ["an id whose toString throws", () => ({ toString() { throw new Error("nope"); } }), /sourceId cannot be named -- nope/],
  ];

  for (const [what, mk, why] of unnameable) {
    // the exported door, on a store that ALREADY holds one — the shape that
    // returned clean for the locator and is the reason the check sits here
    const held = one();
    const b = { ...mention(mk(), "C1") };
    held.bindings.push(b);
    // caught by hand: under the defect this call THROWS, and a row that lets the
    // engine's own text be its verdict reports a catch without naming it
    const said = answered(() => bindingProblems(b, held), `${what}: the exported door`);
    assert.equal(said.length, 1, `${what}: the door says it once`);
    assert.match(said[0], why, `${what}: the door names the id it could not read`);

    assert.deepEqual(answered(() => validateStore(held), `${what}: validateStore`), said,
      "and validateStore says it once, not twice");

    // and the four gates that key the store refuse with that same sentence
    for (const [name, fn] of [
      ["bind", () => bind(one(), { ...mention(mk(), "C1") })],
      ["claimStanding", () => claimStanding(held, "C1")],
      ["personSupport", () => personSupport(held, "P1")],
      ["publicView", () => permitAll(held)],
    ]) {
      let e = null;
      try { fn(); } catch (err) { e = err; }
      assert.ok(e, `${what}: ${name} refuses a binding it cannot name`);
      assert.ok(!(e instanceof TypeError), `${what}: ${name} refused BY NAME, not by crash (got ${String(e.message).split("\n")[0]})`);
      assert.match(e.message, why, `${what}: ${name}'s sentence names the id and its cause`);
    }
  }

  // the claim id is the same field one over, and its sentence says CLAIM
  const c = one();
  const cb = { ...mention("S1", Object.create(null)) };
  c.bindings.push(cb);
  assert.match(answered(() => bindingProblems(cb, c), "an unnameable CLAIM id: the exported door")[0],
    /claimId cannot be named/, "the claim id is named as the claim id");

  // CONTROLS — every id the store can key still keys, and a wrong one is still
  // refused for the ordinary reason rather than for this one
  const ok = one();
  assert.doesNotThrow(() => bind(ok, mention("S1", "C1")), "an ordinary string id is unmoved");
  assert.deepEqual(bindingProblems(mention(5, "C1"), ok), ["binding 5→C1: source 5 is not held"],
    "a numeric id is still refused for NOT BEING HELD, by name, and not for being unnameable");
  // an object id whose toString reads "S1" IS the held source: the store keys by
  // ToString, so naming it must not turn a held binding into a refused one
  assert.doesNotThrow(() => bind(one(), { ...mention({ toString: () => "S1" }, "C1") }),
    "an object id the store resolves to a held source is still accepted");
});

/* A SYMBOL is a different defect wearing the same costume, and measuring it
 * moved the sentence: String(symbol) does NOT throw -- only the template
 * literal does -- and a symbol IS a property key, so the store holds two
 * distinct symbols apart while ToString names both "Symbol(sid)". That is a
 * JOIN in the duplicate key, not a crash at the door. So it is named where it
 * joins, and everything else about the binding is still computed: an ambiguous
 * name does not stop the sentence machine, an unbuildable one does. */
test("a symbol id is named where it JOINS, and the binding's other sentences are still said", () => {
  const s = createStore();
  addSource(s, src("S1"));
  addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));

  // the mechanism the sentence asserts, in the fixture: two distinct symbols of
  // one description are held APART by a map and named ALIKE by ToString
  const a = Symbol("sid"), b = Symbol("sid");
  assert.notEqual(a, b, "the fixture's two symbols are distinct");
  const m = Object.create(null);
  m[a] = 1; m[b] = 2;
  assert.equal(Object.getOwnPropertySymbols(m).length, 2, "a map holds two distinct symbols apart");
  assert.equal(String(a), String(b), "and ToString names both with one string — that is the join");

  const sym = { ...mention(a, "C1") };
  s.bindings.push(sym);
  const said = answered(() => bindingProblems(sym, s), "a symbol id: the exported door");
  assert.ok(said.some((p) => /sourceId is a symbol: the store holds two distinct symbols apart/.test(p)),
    "the symbol is named where it joins");
  assert.ok(!said.some((p) => /cannot be named/.test(p)),
    "and NOT as an id that cannot be named — String(symbol) does not throw, so that sentence would be false about it");

  // the discriminator: an ambiguous name does not stop the rest of the machine.
  // Returning here instead of pushing would hide this binding's OTHER defect.
  const both = { schema: BINDING_SCHEMA, sourceId: a, claimId: "C1", relation: "insinuates" };
  assert.ok(answered(() => bindingProblems(both, s), "a symbol id with a second defect").some((p) => /unknown relation insinuates/.test(p)),
    "a symbol id does not swallow the binding's other problems");

  // and the key SKIPS it rather than joining on "Symbol(sid)": two bindings
  // whose sources are two distinct symbols are not a duplicate of each other
  const pair = createStore();
  addSource(pair, src("S1"));
  addClaim(pair, claim("C1", "P1", "birth", { date: "1880-03-24" }));
  pair.bindings.push({ ...mention(a, "C1") }, { ...mention(b, "C1") });
  const two = validateStore(pair);
  assert.ok(!two.some((p) => /duplicate \(one entry counted twice/.test(p)),
    "two distinct symbol ids are not reported as a duplicate of each other");
});

/* A refusal's cause is read off the throw, and a throw is not guaranteed to be
 * an Error: String(e?.message) printed the word "undefined" for a toJSON that
 * threw a string or threw null, in the commit whose own law is that a
 * fail-closed path owes a TRUE reason. Found by bee-laborer re-reading
 * 8c467528. MINE, measured in the same pass: the message can ITSELF throw, and
 * it is reachable -- a locator whose toJSON throws a value with a throwing
 * `message` getter defeated the naive reader and crashed the door, which is the
 * class this file repairs. */
test("a refusal's cause is never the word `undefined`, and reading it cannot crash the door", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  const causeOf = (locator) => {
    const s = one();
    const b = { ...mention("S1", "C1"), locator };
    s.bindings.push(b);
    const said = answered(() => bindingProblems(b, s), "reading a refusal's cause");
    assert.equal(said.length, 1, "the door says it once");
    return said[0];
  };

  for (const [what, mk, why] of [
    ["a throw that is a string", () => ({ toJSON() { throw "plain string"; } }), /-- it threw a string with no message$/],
    ["a throw that is null", () => ({ toJSON() { throw null; } }), /-- it threw null with no message$/],
    ["an Error with no message", () => ({ toJSON() { throw new Error(""); } }), /-- it threw an object with no message$/],
    ["a message that is not a string", () => ({ toJSON() { throw { message: 7 }; } }), /-- it threw an object with no message$/],
    ["a message that itself throws", () => ({ toJSON() { throw { get message() { throw new Error("inner"); } }; } }), /-- reading its message threw as well$/],
  ]) {
    const said = causeOf(mk());
    assert.match(said, why, `${what}: the sentence says what it could not get`);
    assert.ok(!/-- undefined$/.test(said), `${what}: and never the word undefined where the cause belongs`);
  }

  // CONTROLS — a throw that DOES carry a cause still reports that cause, so the
  // reader was not simply made to stop reading
  assert.match(causeOf({ toJSON() { throw new Error("boom"); } }), /-- boom$/, "a real message is still the cause");
  const circular = () => { const o = { page: 4 }; o.self = o; return o; };
  assert.match(causeOf(circular()), /-- Converting circular structure to JSON$/, "and so is the engine's own");
  // CONTROL: the cause reader is not an `instanceof Error` test, which is
  // realm-local — the defect repaired two functions up in this same file
  const alien = vm.runInNewContext("(function () { throw new Error('from another realm'); })");
  assert.match(causeOf({ toJSON() { alien(); } }), /-- from another realm$/, "a cross-realm Error's message is read like any other");
});

/* nameId guards the COERCION of a value; the property ACCESS that produces it
 * sat outside every try in the module. A throwing getter on a declared binding
 * key made bind(), the exported door, validateStore, claimStanding,
 * personSupport and publicView all fail by throw instead of by refusal -- the
 * same six entries, and the same door-versus-gate shape, as the locator row
 * above, one level out: there the value could not be SERIALISED, here it cannot
 * be OBTAINED. Pre-existing for the ids and `relation` in all three
 * directions; for the LOCATOR it is this branch's trade, because at 619e809c
 * the door returned CLEAN on a binding every gate crashed on. Found by
 * bee-laborer re-reading 92d57d93.
 * MINE, and it is why the guard covers the DECLARED set rather than the fields
 * this function happens to read: `note` is never read by bindingProblems, so
 * the door AND validateStore both answered CLEAN while publicView -- which
 * projects it -- crashed on the same binding. A guard shaped to one reader's
 * appetite leaves the next reader's open.
 * MEASURED AND NOT TAKEN: sourceProblems and claimProblems carry the identical
 * class -- 11 of 12 SOURCE_KEYS and 5 of 6 CLAIM_KEYS crash their gate, and
 * `note` on either record passes both gates and reaches the projection. Same
 * mechanism, two more doors, and not this row: bee-laborer scoped this to the
 * binding and ruled the branch frozen after it. Named here so the next hand
 * finds a measurement rather than an inconsistency. */
test("a binding field that cannot be READ is refused BY NAME at every entry, not thrown out of them", () => {
  const one = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    return s;
  };
  // a proof binding that reaches EVERY sentence below the relation switch, so
  // no key is left unread by the fixture's own shape
  const whole = () => link("S1", "C1", "supports", "birth", { context: "baptism", quote: "born 24 March", locator: "p. 4" });
  const poison = (k) => {
    const o = { ...whole(), note: "n" };
    Object.defineProperty(o, k, { get() { throw new Error(`reading ${k} threw`); }, enumerable: true, configurable: true });
    return o;
  };

  // NON-VACUITY: the fixture really does declare every key the module declares,
  // so "every declared key" below is a full sweep and not a subset that happens
  // to pass. An unread key would make this row's own sweep silently narrower.
  assert.deepEqual(Object.keys({ ...whole(), note: "n" }).sort(), [...BINDING_KEYS].sort(),
    "the fixture carries every declared binding key");

  for (const k of BINDING_KEYS) {
    const why = new RegExp(`${k} cannot be read -- reading ${k} threw`);
    const held = one();
    const b = poison(k);
    held.bindings.push(b);
    // caught by hand: under the defect this call THROWS, and a row that lets the
    // engine's own text be its verdict reports a catch without naming it
    const said = answered(() => bindingProblems(b, held), `a throwing getter on ${k}: the exported door`);
    assert.equal(said.length, 1, `${k}: the door says it once`);
    assert.match(said[0], why, `${k}: the door names the field it could not read, and why`);

    assert.deepEqual(answered(() => validateStore(held), `${k}: validateStore`), said,
      `${k}: validateStore says it once, not twice — the duplicate loop reads through the same guard`);

    for (const [name, fn] of [
      ["bind", () => bind(one(), poison(k))],
      ["claimStanding", () => claimStanding(held, "C1")],
      ["personSupport", () => personSupport(held, "P1")],
      ["publicView", () => permitAll(held)],
    ]) {
      let e = null;
      try { fn(); } catch (err) { e = err; }
      assert.ok(e, `${k}: ${name} refuses a binding it cannot read`);
      assert.ok(!(e instanceof TypeError), `${k}: ${name} refused BY NAME, not by crash (got ${String(e.message).split("\n")[0]})`);
      assert.match(e.message, why, `${k}: ${name}'s sentence names the field and its cause`);
    }
  }

  // the projection is where `note` is read at all, so the sweep above is not
  // the whole claim: name the one key the DOOR has no other reason to touch
  const noteOnly = one();
  noteOnly.bindings.push(poison("note"));
  refuses(() => permitAll(noteOnly), /note cannot be read/);

  // CONTROLS — an ordinary binding is unmoved at every entry, and a getter that
  // ANSWERS is not refused for answering through an accessor
  const ok = one();
  assert.doesNotThrow(() => bind(ok, whole()), "an ordinary binding is unmoved");
  assert.equal(permitAll(ok).bindings.length, 1, "and the projection is reachable, not thrown");
  const acc = one();
  const answering = { ...whole() };
  Object.defineProperty(answering, "locator", { get: () => "p. 4", enumerable: true, configurable: true });
  assert.doesNotThrow(() => bind(acc, answering), "a getter that answers is an ordinary field");
  assert.equal(permitAll(acc).bindings.length, 1, "and its binding publishes");
});

/* `?? "?"` named an id the lookup never used. The door read
 * nameId(b?.sourceId ?? "?") while heldUnder looked the id up RAW, so a binding
 * with no sourceId was looked up under the property key "undefined" and then
 * told, by name, that the store does not hold "?" -- false about a store that
 * holds one. validateStore one function down used nameId(b?.sourceId) with no
 * substitution, so the SAME binding carried two names inside ONE returned
 * array. Found by bee-laborer re-reading 92d57d93; the two-names-in-one-run
 * half is mine, measured in the same pass.
 * After this commit "?" names exactly one thing: an id that could not be
 * PRODUCED -- unreadable, or unnameable. A MISSING id is produced, and names
 * the key heldUnder actually asked for. */
test("a missing id is named as the key the store was asked for, and one binding has one name", () => {
  const holdsQuestionMark = () => {
    const s = createStore();
    addSource(s, src("S1"));
    addSource(s, src("?"));
    addClaim(s, claim("C1", "P1", "birth", { date: "1880-03-24" }));
    addClaim(s, claim("?", "P1", "death", { date: "1900-01-01" }));
    return s;
  };
  const idless = () => ({ schema: BINDING_SCHEMA, relation: "mentions" });

  const s = holdsQuestionMark();
  assert.ok(s.sources["?"] && s.claims["?"], "the fixture really holds a source and a claim under the id \"?\"");
  assert.equal(s.sources[undefined], undefined, "and holds nothing under the key the lookup actually uses");

  const said = bindingProblems(idless(), s);
  assert.deepEqual(said, [
    "binding undefined→undefined: source undefined is not held",
    "binding undefined→undefined: claim undefined does not exist",
  ], "the refusal names the key that was looked up, not a \"?\" the store may hold");
  assert.ok(!said.some((p) => /source \? is not held|claim \? does not exist/.test(p)),
    "and never says the store does not hold something it does hold");

  // ONE binding, ONE name: the door's sentences and the duplicate loop's
  // sentence named the same binding differently inside one returned array
  const dup = holdsQuestionMark();
  dup.bindings.push(idless(), idless());
  const all = validateStore(dup);
  const names = [...new Set(all.map((p) => p.split(":")[0]))];
  assert.deepEqual(names, ["binding undefined→undefined"],
    "every sentence about the id-less binding uses one name — the door's and the duplicate loop's alike");
  assert.ok(all.some((p) => /duplicate \(one entry counted twice/.test(p)),
    "and the duplicate is still reported, so the name agreement is not an empty run");

  // CONTROLS — an ordinary ghost id is unmoved, and an id that cannot be
  // produced still names "?", which is the one thing "?" means now
  assert.deepEqual(bindingProblems(mention("S-ghost", "C1"), s), ["binding S-ghost→C1: source S-ghost is not held"],
    "an ordinary ghost id is refused exactly as before");
  const unreadable = { schema: BINDING_SCHEMA, relation: "mentions", claimId: "C1", get sourceId() { throw new Error("nope"); } };
  assert.match(answered(() => bindingProblems(unreadable, s), "an unreadable id")[0], /^binding \?→C1: sourceId cannot be read/,
    "an id that could not be produced is the only thing \"?\" names now");
  const ordinary = holdsQuestionMark();
  assert.doesNotThrow(() => bind(ordinary, mention("?", "?")), "and a binding that NAMES the held \"?\" is accepted");
});
