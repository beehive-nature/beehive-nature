// Tree of Life contract — spouse lines and culture claims, on SYNTHETIC data.
// No real spouse, parent, or child is named here or anywhere in the repo: the
// first real spouse root is wired only from a private record the founder
// supplies. What this file proves is the chain
//   private living root → anonymous Living bridge → deceased ancestor → deeper
// on ONE graph with several roots, plus the source law for culture claims.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createModel, addPerson, addEdge, addCouple, privatize, validate, emergence, lineLabel, claimProblems } from "./model.mjs";

const SRC = "synthetic parish register, entry 12";

//   founder line                    spouse-1 line
//   fg1(†) fg2(†)                   s-aaa(†)          s-aba(†)
//      \   /                           |                 |
//      fp1*  fp2*                   s-aa(†)  uncle*   s-ab*
//        \   /                          \   /           |
//        founder*  ─ married ─  spouse*   s-a* ─────────┘   s-b(†)
//                                  \________________________/
// (* living)  spouse's parents: s-a*, s-b(†); s-a's parents: s-aa(†), s-ab*
function fixture() {
  const m = createModel({ root: "founder", source: "synthetic" });
  const P = (id, name, lifespan, living, extra = {}) => addPerson(m, { id, name, lifespan, living, ...extra });
  P("founder", "Founder Private", "1980–", true);
  P("fp1", "Founder Parent One", "1950–", true);
  P("fp2", "Founder Parent Two", "1952–", true);
  P("fg1", "Founder Grand One", "1920–1990", false);
  P("fg2", "Founder Grand Two", "1922–1999", false);
  P("spouse", "Spouse Private Name", "1985–", true, {
    cultureClaims: [{ kind: "language", value: "Latvian", from: 1985, source: SRC }],
  });
  P("s-a", "Spouse Parent Living", "1955–", true);
  P("s-b", "Spouse Parent Deceased", "1940–2001", false);
  P("s-aa", "Spouse Grand Deceased", "1901–1970", false, {
    cultureClaims: [
      { kind: "language", value: "Latvian", from: 1901, to: 1970, source: SRC },
      { kind: "religion", value: "Lutheran", from: 1901, to: 1940, source: SRC, sourceId: "reg-12" },
    ],
  });
  P("s-ab", "Spouse Grand Living", "1935–", true);
  P("s-aaa", "Spouse Great Grand", "1870–1930", false);
  P("s-aba", "Spouse Great Grand Two", "1880–1950", false);
  P("uncle", "Living Uncle Name", "1958–", true);
  addEdge(m, "founder", ["fp1", "fp2"]);
  addEdge(m, "fp1", ["fg1", "fg2"]);
  addEdge(m, "spouse", ["s-a", "s-b"]);
  addEdge(m, "s-a", ["s-aa", "s-ab"]);
  addEdge(m, "uncle", ["s-aa"]);
  addEdge(m, "s-aa", ["s-aaa"]);
  addEdge(m, "s-ab", ["s-aba"]);
  addCouple(m, "founder", "spouse");
  addCouple(m, "fp1", "fp2");
  m.roots = { founder: "founder", "spouse-1": "spouse" };
  return m;
}

test("raw private model is valid and carries the real mapping", () => {
  const m = fixture();
  assert.deepEqual(validate(m), []);
  assert.equal(m.roots["spouse-1"], "spouse");
});

test("public artifact validates; no living name, date, or claim survives", () => {
  const pub = privatize(fixture());
  assert.deepEqual(validate(pub, { public: true }), []);
  const text = JSON.stringify(pub);
  for (const leak of ["Spouse Private Name", "Spouse Parent Living", "Spouse Grand Living", "Living Uncle Name", "Founder Private", "1985–", "1955–"])
    assert.ok(!text.includes(leak), `leak: ${leak}`);
  assert.equal(pub.persons.spouse.name, "Living");
  assert.equal(pub.persons.spouse.cultureClaims, undefined);
  assert.equal(pub.roots, undefined, "the private mapping never ships");
});

test("a living relative off every root line is dropped entirely", () => {
  const pub = privatize(fixture());
  assert.equal(pub.persons.uncle, undefined);
});

test("spouse line emerges at its first deceased ancestors behind the living bridge", () => {
  const pub = privatize(fixture());
  const line = pub.lines.find((l) => l.key === "spouse-1");
  assert.equal(line.label, "Spouse line I");
  assert.equal(line.root, "spouse");
  assert.deepEqual(line.entries, ["s-aa", "s-aba", "s-b"]);
  assert.equal(line.bridge, 3, "spouse, living parent, living grandparent");
  for (const e of line.entries) assert.equal(pub.persons[e].living, false);
  // deeper public ancestry is climbable from an entry
  assert.deepEqual(pub.edges["s-aa"], ["s-aaa"]);
  assert.equal(pub.persons["s-aaa"].name, "Spouse Great Grand");
  // the bridge itself stays climbable: root → stub → entry
  assert.deepEqual(pub.edges.spouse, ["s-a", "s-b"]);
  assert.equal(pub.persons["s-a"].name, "Living");
});

test("founder line and spouse line share one graph but are not joined in public", () => {
  const pub = privatize(fixture());
  assert.deepEqual(pub.lines.map((l) => l.key), ["founder", "spouse-1"]);
  assert.equal(pub.lines[0].label, "Founder line");
  assert.deepEqual(pub.lines[0].entries, ["fg1", "fg2"]);
  assert.ok(!pub.couples["founder|spouse"], "cross-line living couple dropped");
  assert.ok(pub.couples["fp1|fp2"], "same-line couple kept");
});

test("deceased culture claims ride into the public artifact with their sources", () => {
  const pub = privatize(fixture());
  assert.equal(pub.persons["s-aa"].cultureClaims.length, 2);
  assert.equal(pub.persons["s-aa"].cultureClaims[1].sourceId, "reg-12");
});

test("labels are neutral by construction; a naming label is refused", () => {
  assert.equal(lineLabel("spouse-4"), "Spouse line IV");
  const pub = privatize(fixture());
  pub.lines[1].label = "Queen Somebody line";
  assert.ok(validate(pub, { public: true }).some((p) => /not the neutral "Spouse line I"/.test(p)));
});

test("a public artifact carrying the private roots mapping is refused", () => {
  const pub = privatize(fixture());
  pub.roots = { founder: "founder", "spouse-1": "spouse" };
  assert.ok(validate(pub, { public: true }).some((p) => /private line mapping/.test(p)));
});

test("emergence of a deceased root is the root itself, with no bridge", () => {
  assert.deepEqual(emergence(fixture(), "s-b"), { entries: ["s-b"], bridge: 0 });
});

test("a single-root model keeps its old shape: no lines", () => {
  const m = fixture();
  delete m.roots;
  const pub = privatize(m);
  assert.equal(pub.lines, undefined);
  assert.equal(pub.persons.spouse, undefined, "without a declared root the living spouse is off every line");
  assert.deepEqual(validate(pub, { public: true }), []);
});

// ── culture claims law
const person = (claims, lifespan = "1901–1970", living = false) => ({ name: "X", lifespan, living, cultureClaims: claims });

test("an unsourced claim is tolerated in raw and refused in public", () => {
  const p = person([{ kind: "language", value: "Latvian" }]);
  assert.deepEqual(claimProblems("x", p), []);
  assert.ok(claimProblems("x", p, { public: true }).some((s) => /unsourced/.test(s)));
});

test("a source that names itself a derivation is refused everywhere", () => {
  for (const source of ["inferred from surname", "Derived: nationality", "assumed from parish location"]) {
    const p = person([{ kind: "language", value: "German", source }]);
    assert.ok(claimProblems("x", p).some((s) => /derivation/.test(s)), source);
  }
});

test("claims are person-bound: an interval outside the life is refused", () => {
  assert.ok(claimProblems("x", person([{ kind: "polity", value: "Republic of Latvia", from: 1991, source: SRC }])).some((s) => /after the person's death/.test(s)));
  assert.ok(claimProblems("x", person([{ kind: "region", value: "Courland", to: 1850, source: SRC }])).some((s) => /before the person's birth/.test(s)));
  assert.ok(claimProblems("x", person([{ kind: "title", value: "baron", from: 1950, to: 1920, source: SRC }])).some((s) => /after to/.test(s)));
});

test("claim shape is closed: unknown kind, unknown key, empty value, non-integer year", () => {
  const probs = claimProblems("x", person([
    { kind: "nationality", value: "Latvian", source: SRC },
    { kind: "house", value: "", source: SRC },
    { kind: "people", value: "Latgalians", source: SRC, confidence: "high" },
    { kind: "region", value: "Vidzeme", from: "1900", source: SRC },
  ]));
  assert.ok(probs.some((s) => /unknown kind nationality/.test(s)));
  assert.ok(probs.some((s) => /no value/.test(s)));
  assert.ok(probs.some((s) => /unknown key confidence/.test(s)));
  assert.ok(probs.some((s) => /from must be an integer year/.test(s)));
});

test("a living stub that somehow carries claims is a leak", () => {
  const p = { name: "Living", living: true, cultureClaims: [{ kind: "religion", value: "Catholic", source: SRC }] };
  assert.ok(claimProblems("x", p, { public: true }).some((s) => /living stub carries cultureClaims/.test(s)));
});
