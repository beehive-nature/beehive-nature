// smoke tests — zero deps: node --test tools/genealogy/smoke.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createModel, addPerson, addEdge, addCouple, bloodline, spine, depths,
  privatize, validate, evidenceClass,
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

test("evidence classes separate eras — saga is never 'recorded'", () => {
  assert.equal(evidenceClass({ lifespan: "1900–1970" }), "recorded");
  assert.equal(evidenceClass({ lifespan: "1701–1744" }), "colonial");
  assert.equal(evidenceClass({ lifespan: "1200–1260" }), "medieval");
  assert.equal(evidenceClass({ lifespan: "0740–0845" }), "saga");
  assert.equal(evidenceClass({ living: true }), "living");
});

test("model validation catches structure breaks and privacy leaks", () => {
  const m = fixtureModel();
  // raw scope: living person WITH a source id is legal (full fidelity, local only)
  assert.deepEqual(validate(m).filter((p) => !p.startsWith("unresolved:")), []);
  // public scope: any living person is a violation
  const pubProblems = validate(m, { public: true });
  assert.ok(pubProblems.some((p) => p.includes("LIVING in a public artifact")));
  const pub = privatize(m);
  assert.deepEqual(validate(pub, { public: true }).filter((p) => !p.startsWith("unresolved:")), []);
});

test("privatize drops the living — root survives only as an anonymous anchor", () => {
  const m = fixtureModel();
  const pub = privatize(m);
  // living non-root: gone entirely
  assert.equal(pub.persons.P2, undefined);
  // living root: anonymous stub — no real name, no dates, no source id
  assert.deepEqual(pub.persons.P1, {
    name: "Living", lifespan: null, gender: null, living: true,
    evidence: { class: "living", basis: "era-heuristic" },
  });
  assert.equal(JSON.stringify(pub).includes("Founder Living"), false);
  assert.equal(JSON.stringify(pub).includes("1977"), false);
  assert.ok(pub.persons.P3);
  assert.equal(pub.meta.livingRedacted, 2);
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
  const ged = toGedcom(m, { privatizeLiving: true });
  assert.ok(ged.startsWith("0 HEAD"));
  assert.ok(ged.endsWith("0 TRLR\n"));
  assert.ok(ged.includes("1 NAME Father /Deceased/"));
  assert.ok(!ged.includes("Founder Living"));
  assert.ok(ged.includes("1 NOTE source familysearch:P3"));
  assert.ok(ged.includes("1 NOTE evidence colonial (era-heuristic)"));

  const back = createModel({ source: "gedcom-import" });
  const { persons } = fromGedcom(back, ged);
  assert.equal(persons, 4); // 3 deceased + the anonymous "Living" root stub
  assert.equal(back.persons.P3.name, "Father Deceased");
  assert.equal(back.persons.P3.evidence.class, "recorded"); // 1925 birth = recorded era
  assert.equal(back.persons.P4.evidence.class, "colonial"); // 1701 = colonial era
  assert.equal(back.persons.P3.sourceId, "P3");
  assert.equal(back.persons.P3.lifespan, "1925–1988"); // level-2 DATE parse round-trips
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
