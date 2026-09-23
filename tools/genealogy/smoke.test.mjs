// smoke tests — zero deps: node --test tools/genealogy/smoke.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createModel, addPerson, addEdge, addCouple, bloodline, spine, depths,
  privatize, validate, evidenceClass, birthYear, deathYear,
} from "./model.mjs";
import { harvestResponse, importWalk } from "./fs-adapter.mjs";
import { toGedcom, fromGedcom } from "./gedcom.mjs";

function fixtureModel() {
  const m = createModel({ root: "P1", source: "familysearch" });
  addPerson(m, { id: "P1", name: "Founder Living", lifespan: "1977–Living", gender: "M", living: true, sourceId: "P1" });
  addPerson(m, { id: "P2", name: "Mother Living", lifespan: "1957–Living", gender: "F", living: true });
  addPerson(m, { id: "P3", name: "Father Deceased", lifespan: "1925–1988", gender: "M", living: false, source: "familysearch", sourceId: "P3" });
  addPerson(m, { id: "P4", name: "Grand Colonial", lifespan: "1701–1744", gender: "F", living: false, source: "familysearch", sourceId: "P4" });
  addPerson(m, { id: "P5", name: "Ragnar Saga", lifespan: "0740–0845", gender: "M", living: false, source: "familysearch", sourceId: "P5" });
  addEdge(m, "P1", ["P2", "P3"]);
  addEdge(m, "P3", ["P4", "P5"]);
  addCouple(m, "P2", "P3", "1976 · Testville");
  return m;
}

test("evidence classes separate eras — saga is never 'recorded'; era and support are separate axes", () => {
  assert.equal(evidenceClass({ lifespan: "1900–1970" }), "recorded");
  assert.equal(evidenceClass({ lifespan: "1701–1744" }), "colonial");
  assert.equal(evidenceClass({ lifespan: "1200–1260" }), "medieval");
  assert.equal(evidenceClass({ lifespan: "0740–0845" }), "saga");
  assert.equal(evidenceClass({ living: true }), "living");
  // a date NEVER confers support: era stays a label, support stays unsourced
  const m = fixtureModel();
  for (const p of Object.values(m.persons)) {
    assert.equal(p.evidence.support, "unsourced-entry");
    assert.equal(p.evidence.era, p.evidence.class);
  }
});

test("public identifier leakage: living stubs must not carry provider ids", () => {
  const m = fixtureModel();
  const pub = privatize(m);
  const leaked = JSON.parse(JSON.stringify(pub));
  leaked.persons["ABCD-123"] = leaked.persons["P2"]; // living stub under an FSID-shaped key
  const problems = validate(leaked, { public: true });
  assert.ok(problems.some((p) => p.includes("retains a provider identifier")));
  assert.deepEqual(validate(pub, { public: true }).filter((p) => !p.startsWith("unresolved:")), []);
});

test("model validation catches structure breaks and privacy leaks", () => {
  const m = fixtureModel();
  // raw scope: living person WITH a source id is legal (full fidelity, local only)
  assert.deepEqual(validate(m).filter((p) => !p.startsWith("unresolved:")), []);
  // public scope: living persons must be anonymous root-line stubs
  const pubProblems = validate(m, { public: true });
  assert.ok(pubProblems.some((p) => p.includes("must be an anonymous root-line stub")));
  const pub = privatize(m);
  assert.deepEqual(validate(pub, { public: true }).filter((p) => !p.startsWith("unresolved:")), []);
});

test("validate names parent-graph cycles by component, with a witness walked from real edges", () => {
  const m = createModel({ root: "A" });
  for (const id of ["A", "B", "C", "D", "E", "F", "G", "S"]) addPerson(m, { id, name: id, lifespan: "1900–1950" });
  // A←B←C←A is a simple ring
  addEdge(m, "A", ["B"]); addEdge(m, "B", ["C"]); addEdge(m, "C", ["A"]);
  // D,E,F,G is one component but no single ring covers it: D→E→D and D→F→G→D
  addEdge(m, "D", ["E", "F"]); addEdge(m, "E", ["D"]); addEdge(m, "F", ["G"]); addEdge(m, "G", ["D"]);
  // a person listed as their own parent
  addEdge(m, "S", ["S"]);
  assert.deepEqual(validate(m).filter((p) => p.startsWith("cycle-component: ") || p.startsWith("witness: ")), [
    "cycle-component: A,B,C",
    "witness: A -> B -> C -> A",
    "cycle-component: D,E,F,G",
    "witness: D -> E -> D",
    "cycle-component: S",
    "witness: S -> S",
  ]);
  // an acyclic model reports no cycles
  assert.equal(validate(fixtureModel()).some((p) => p.startsWith("cycle-component: ")), false);
});

test("privatize — living bloodline become anonymous stubs, off-line living dropped", () => {
  const m = fixtureModel();
  const pub = privatize(m);
  // living root-line (P1 root + P2 mother) survive as anonymous stubs
  assert.deepEqual(pub.persons.P1, {
    name: "Living", lifespan: null, gender: "M", living: true,
    evidence: { era: "living", support: "unsourced-entry", class: "living", basis: "redacted stub" },
  });
  assert.equal(pub.persons.P2.name, "Living");
  assert.equal(pub.persons.P2.lifespan, null);
  assert.equal(JSON.stringify(pub).includes("Founder Living"), false);
  assert.equal(JSON.stringify(pub).includes("1977"), false);
  assert.ok(pub.persons.P3);
  assert.equal(pub.meta.livingStubs, 2);
  assert.deepEqual(validate(pub, { public: true }).filter((p) => !p.startsWith("unresolved:")), []);
});

test("bloodline, depths, spine reach the deep ancestor", () => {
  const m = fixtureModel();
  assert.deepEqual([...bloodline(m)].sort(), ["P1", "P2", "P3", "P4", "P5"]);
  assert.equal(depths(m).P5, 2);
  const chain = spine(m, "P5");
  assert.deepEqual(chain, ["P1", "P3", "P5"]); // shortest path skips living mother branch
});

test("fs-adapter harvestResponse parses the real r9 response shape", () => {
  const m = createModel({ root: "L627-FH9", source: "familysearch" });
  // minimal but shape-true: stub child id + full parents + parentIds chaining
  const resp = {
    ancestors: [[{
      id: "STUB-001",
      parent1: { id: "KWCL-VNB", name: "Donna Ruth Lawton", lifespan: "1925–1988", gender: "F", living: false, treeType: "PUBLIC" },
      parent2: { id: "KWCL-VJ6", name: "Jack Benedum Sutphen", lifespan: "1919–2001", gender: "M", living: false, treeType: "PUBLIC" },
      parent1ParentIds: { parent1Id: "GHOST-01A", parent2Id: "GHOST-01B" },
      event: { date: { formatted: "1946" }, place: { original: "Testville" } },
    }]],
  };
  const { added } = harvestResponse(m, resp);
  assert.equal(added, 2);
  assert.ok(m.persons["KWCL-VNB"]);
  // the true pedigree edge: Donna's parents are the GHOST ids (frontier to resolve)
  assert.deepEqual(m.edges["KWCL-VNB"], ["GHOST-01A", "GHOST-01B"]);
  assert.ok(m.couples["KWCL-VJ6|KWCL-VNB"].marriage.includes("1946"));
});

test("GEDCOM round-trip: export → parse → same persons, edges, evidence", () => {
  const m = fixtureModel();
  // a BC ancestor: the export must not emit a negative year, and the sign must survive the trip
  addPerson(m, { id: "P6", name: "Sigurd Saga", lifespan: "1045BC–0972BC", gender: "M", living: false, source: "familysearch", sourceId: "P6" });
  const ged = toGedcom(m, { privatizeLiving: true });
  assert.ok(ged.startsWith("0 HEAD"));
  assert.ok(ged.endsWith("0 TRLR\n"));
  assert.ok(ged.includes("1 NAME Father /Deceased/"));
  assert.ok(!ged.includes("Founder Living"));
  assert.ok(ged.includes("1 NOTE source familysearch:P3"));
  assert.ok(ged.includes("1 NOTE evidence colonial (era label from dates; support unsourced until sources are harvested)"));

  const back = createModel({ source: "gedcom-import" });
  const { persons } = fromGedcom(back, ged);
  assert.equal(persons, 6); // 4 deceased (incl. the BC ancestor) + 2 anonymous "Living" root-line stubs
  assert.equal(back.persons.P3.name, "Father Deceased");
  assert.equal(back.persons.P3.evidence.class, "recorded"); // 1925 birth = recorded era
  assert.equal(back.persons.P4.evidence.class, "colonial"); // 1701 = colonial era
  assert.equal(back.persons.P3.sourceId, "P3");
  assert.equal(back.persons.P3.lifespan, "1925–1988"); // level-2 DATE parse round-trips
  assert.ok(ged.includes("2 DATE 1045 B.C."), "BC birth exports as GEDCOM 5.5.1 B.C., never a negative year");
  assert.ok(ged.includes("2 DATE 972 B.C."));
  assert.ok(!/2 DATE -d/.test(ged), "no negative year reaches the GEDCOM stream");
  assert.equal(back.persons.P6.lifespan, "1045BC–0972BC"); // BC round-trips byte-exact, zero-padded as the corpus writes it
  assert.equal(back.persons.P6.evidence.class, "saga");
  assert.deepEqual(back.edges.P3.sort(), ["P4", "P5"].sort()); // child->parents survives
});

test("fs-adapter importWalk folds a raw walk dump", () => {
  const m = createModel({ source: "familysearch" });
  const raw = {
    root: "AAAA-111",
    persons: { "AAAA-111": { id: "AAAA-111", name: "A", lifespan: "1900–1970", gender: "M", living: false },
               "BBBB-222": { id: "BBBB-222", name: "B", lifespan: "1870–1940", gender: "F", living: false } },
    edges: { "AAAA-111": ["BBBB-222"] },
    couples: { "AAAA-111|BBBB-222": { p1: "AAAA-111", p2: "BBBB-222", event: null } },
    meta: { calls: 1 },
  };
  importWalk(m, raw);
  assert.equal(m.root, "AAAA-111");
  assert.deepEqual(m.edges["AAAA-111"], ["BBBB-222"]);
  assert.equal(m.persons["BBBB-222"].evidence.class, "recorded");
});

test("lifespans parse BC and short years — signed integers, 1-4 digits", () => {
  // every shape present in the public bloodline at ca025ede
  assert.deepEqual([birthYear("1920–1982"), deathYear("1920–1982")], [1920, 1982]);
  assert.deepEqual([birthYear("1931–Deceased"), deathYear("1931–Deceased")], [1931, null]);
  assert.deepEqual([birthYear("Deceased"), deathYear("Deceased")], [null, null]);
  assert.deepEqual([birthYear("1080BC–Deceased"), deathYear("1080BC–Deceased")], [-1080, null]);
  assert.deepEqual([birthYear("1045BC–0972BC"), deathYear("1045BC–0972BC")], [-1045, -972]);
  assert.deepEqual([birthYear("93–Deceased"), deathYear("93–Deceased")], [93, null]);
  assert.deepEqual([birthYear("–1187BC"), deathYear("–1187BC")], [null, -1187]);
  assert.deepEqual([birthYear("98–0160"), deathYear("98–0160")], [98, 160]);
  assert.deepEqual([birthYear("0050BC–25"), deathYear("0050BC–25")], [-50, 25]);
  // 123 lifespans cross the era boundary; 6 are born 0001BC
  assert.deepEqual([birthYear("0001BC–20"), deathYear("0001BC–20")], [-1, 20]);
  assert.deepEqual([birthYear("–1801"), deathYear("–1801")], [null, 1801]);
  assert.deepEqual([birthYear("30–83"), deathYear("30–83")], [30, 83]);
  assert.deepEqual([birthYear("9–67"), deathYear("9–67")], [9, 67]);
  assert.deepEqual([birthYear("2–Deceased"), deathYear("2–Deceased")], [2, null]);
  assert.deepEqual([birthYear("–35"), deathYear("–35")], [null, 35]);
  assert.deepEqual([birthYear(null), deathYear(null)], [null, null]);
  // a BC birth is saga by the existing <1000 rule; thresholds unchanged
  assert.equal(evidenceClass({ lifespan: "1045BC–0972BC" }), "saga");
  assert.equal(evidenceClass({ lifespan: "0050BC–25" }), "saga");
  // a short AD birth is no longer unrecorded
  assert.equal(evidenceClass({ lifespan: "93–Deceased" }), "saga");
  assert.equal(evidenceClass({ lifespan: "9–67" }), "saga");
  // absent dates stay unrecorded — the null path is not widened
  assert.equal(evidenceClass({ lifespan: "Deceased" }), "unrecorded");
  assert.equal(evidenceClass({ lifespan: null }), "unrecorded");
});
