// publish.mjs — the production path's scope + the ONE privacy law, on
// SYNTHETIC data. Acceptance for the pipeline → privatize() convergence
// (founder order 2026-09-22). Item 1 (the founder corpus stays privacy-
// equivalent) is proven on the real archive by regeneration, not here; item 7
// (founder regression) is family.test.mjs + the rest of this suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addPerson, addEdge, addCouple, validate } from "./model.mjs";
import { publish, publicScope } from "./publish.mjs";
import { syntheticLines } from "./synthetic-lines.mjs";

const LIVING_NAMES = ["Founder Private", "Founder Parent One", "Founder Parent Two", "Spouse Private Name",
  "Spouse Parent Living", "Spouse Grand Living", "Living Uncle Name"];

test("2 · a synthetic spouse root produces anonymous living bridges", () => {
  const { pub } = publish(syntheticLines());
  const line = pub.lines.find((l) => l.key === "spouse-1");
  assert.equal(line.label, "Spouse line I");
  assert.equal(line.bridge, 3);
  for (const id of ["spouse", "s-a", "s-ab"]) {
    assert.equal(pub.persons[id].name, "Living", id);
    assert.equal(pub.persons[id].living, true, id);
  }
  assert.deepEqual(validate(pub, { public: true }), []);
});

test("3 · deceased ancestry survives above the bridges, with its claims", () => {
  const { pub } = publish(syntheticLines());
  assert.deepEqual(pub.lines.find((l) => l.key === "spouse-1").entries, ["s-aa", "s-aba", "s-b"]);
  assert.equal(pub.persons["s-aaa"].name, "Spouse Great Grand");
  assert.deepEqual(pub.edges["s-aa"], ["s-aaa"]);
  assert.equal(pub.persons["s-aaa"].cultureClaims.length, 3);
});

test("4 · cross-line living relationships do not leak", () => {
  const { pub } = publish(syntheticLines());
  assert.ok(!pub.couples["founder|spouse"], "founder ⚭ spouse is not published");
  assert.ok(pub.couples["fp1|fp2"], "a same-line couple stays");
  assert.equal(pub.persons.uncle, undefined, "a living relative off every line is gone");
  assert.equal(pub.roots, undefined, "the private line mapping never ships");
});

test("5 · no name, date, provider id, or claim survives on any living stub", () => {
  const m = syntheticLines();
  m.persons.spouse.sourceId = "ABCD-123";
  m.persons["s-a"].source = "familysearch";
  const { pub } = publish(m);
  const text = JSON.stringify(pub);
  for (const n of LIVING_NAMES) assert.ok(!text.includes(n), n);
  for (const p of Object.values(pub.persons).filter((x) => x.living)) {
    assert.deepEqual(Object.keys(p).sort(), ["evidence", "gender", "lifespan", "living", "name"]);
    assert.equal(p.lifespan, null);
  }
  assert.ok(!text.includes("ABCD-123"));
});

test("6 · a living name or provider id forced into the public output is refused", () => {
  const cases = [
    (pub) => { pub.persons["s-a"].name = "Spouse Parent Living"; },
    (pub) => { pub.persons["s-a"].lifespan = "1955–"; },
    (pub) => { pub.persons["s-a"].sourceId = "ABCD-123"; },
    (pub) => { pub.persons["ABCD-123"] = pub.persons["s-a"]; delete pub.persons["s-a"]; pub.edges.spouse = ["ABCD-123", "s-b"]; },
    (pub) => { pub.persons["s-ab"].cultureClaims = [{ kind: "religion", value: "x", source: "y" }]; },
    (pub) => { pub.roots = { founder: "founder", "spouse-1": "spouse" }; },
    (pub) => { pub.lines[1].label = "A Real Name line"; },
  ];
  for (const [i, mutate] of cases.entries()) {
    const { pub } = publish(syntheticLines());
    mutate(pub);
    assert.ok(validate(pub, { public: true }).length > 0, `mutation ${i} must be refused`);
  }
});

test("scope: in-law deep ancestry stays private; the in-law spouse is published", () => {
  const m = syntheticLines();
  addPerson(m, { id: "inlaw", name: "In Law Spouse", lifespan: "1902–1980", living: false });
  addPerson(m, { id: "inlaw-parent", name: "In Law Parent", lifespan: "1870–1940", living: false });
  addEdge(m, "inlaw", ["inlaw-parent"]);
  addCouple(m, "s-aa", "inlaw");
  const scope = publicScope(m);
  assert.ok(scope.has("inlaw"));
  assert.ok(!scope.has("inlaw-parent"));
  const { pub } = publish(m);
  assert.equal(pub.persons["inlaw-parent"], undefined);
  assert.ok(pub.couples["inlaw|s-aa"]);
});

test("a founder-only model has no lines and keeps its old shape", () => {
  const m = syntheticLines();
  delete m.roots;
  const { pub } = publish(m);
  assert.equal(pub.lines, undefined);
  assert.equal(pub.persons.spouse, undefined, "without a declared line the living spouse is off every line");
  assert.equal(pub.persons["s-aaa"], undefined, "and the spouse's ancestry is out of scope");
  assert.deepEqual(validate(pub, { public: true }), []);
});

test("the pipeline has no privacy law of its own", () => {
  const src = readFileSync(new URL("./pipeline.mjs", import.meta.url), "utf8");
  assert.match(src, /publish\(model/);
  assert.doesNotMatch(src, /name:\s*"Living"/, "no stub is built outside privatize()");
  assert.doesNotMatch(src, /onRootLine/, "no second root-line walk");
});
