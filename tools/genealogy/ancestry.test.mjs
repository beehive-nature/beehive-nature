// Ancestry adapter + reconciliation tests — synthetic fixtures only (the
// founder's real Ancestry data stays in private staging, never in CI), and
// the copied-source law: the same underlying assertion on two platforms does
// NOT automatically increase evidential confidence.
import { readFileSync as _rf, existsSync as _ex } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createModel, addPerson, addEdge } from "./model.mjs";
import { harvestResponse, ancestryRef, associateRef, appearsIn, isAncestryRef } from "./ancestry-adapter.mjs";

// synthetic newfamilyview payload (shape recorded from the wire, all persons
// fictional or public-figure-safe synthetic)
function fixturePayload(treeId) {
  const P = (pid, g, s, gender, fam) => ({
    gid: { v: `${pid}:1030:${treeId}` },
    Names: [{ g, s }],
    Genders: gender ? [{ g: gender }] : [],
    Events: [{ t: "Birth", p: "Testville, USA" }],
    Family: fam || [],
  });
  return {
    v: "3.0",
    Persons: [
      P("100", "Aria", "Test", "f", [{ t: "M", tgid: { v: "103:1030:" + treeId } }, { t: "F", tgid: { v: "102:1030:" + treeId } }]),
      P("101", "Bo", "Test", "m", [{ t: "H", tgid: { v: "100:1030:" + treeId } }]),
      P("102", "Papa", "Test", "m", [{ t: "C", tgid: { v: "100:1030:" + treeId } }]),
      P("103", "Mama", "Test", "f", [{ t: "C", tgid: { v: "100:1030:" + treeId } }]),
    ],
    focus: { v: "100:1030:" + treeId },
  };
}

test("harvest: namespaced refs, parent edges, couples, original values preserved", () => {
  const m = createModel({ source: "ancestry" });
  const { added } = harvestResponse(m, fixturePayload("999"), { treeId: "999" });
  assert.equal(added, 4);
  const aria = m.persons[ancestryRef("999", "100")];
  assert.ok(aria, "person stored under namespaced ref");
  assert.ok(isAncestryRef(ancestryRef("999", "100")));
  assert.equal(aria.name, "Aria Test");
  // parent edges via F/M family relations (targets are the parents)
  const ariaParents = m.edges[ancestryRef("999", "100")];
  assert.ok(ariaParents && ariaParents.length === 2, "two parent edges");
  assert.ok(ariaParents.includes(ancestryRef("999", "102")));
  assert.ok(ariaParents.includes(ancestryRef("999", "103")));
  // provider observation preserved: living observed (no death event)
  assert.equal(aria.providerObservation.hasDeathEvent, false);
  assert.equal(aria.providerObservation.livingFlagObserved, null, 'payload carries no living flag — never inferred');
  assert.equal(aria.providerObservation.treeId, "999");
  // couple via H/W
  assert.ok(m.couples[[ancestryRef("999", "100"), ancestryRef("999", "101")].sort().join("|")], "couple recorded");
});

test("idempotent re-import: same payload twice creates neither duplicate people nor duplicate claims", () => {
  const m = createModel({ source: "ancestry" });
  harvestResponse(m, fixturePayload("999"), { treeId: "999" });
  const count1 = Object.keys(m.persons).length;
  const edges1 = Object.keys(m.edges).length;
  harvestResponse(m, fixturePayload("999"), { treeId: "999" });
  assert.equal(Object.keys(m.persons).length, count1, "no duplicate people");
  assert.equal(Object.keys(m.edges).length, edges1, "no duplicate edges");
});

test("different trees = different namespaces (never collide)", () => {
  const m = createModel({ source: "ancestry" });
  harvestResponse(m, fixturePayload("111"), { treeId: "111" });
  harvestResponse(m, fixturePayload("222"), { treeId: "222" });
  assert.ok(m.persons[ancestryRef("111", "100")]);
  assert.ok(m.persons[ancestryRef("222", "100")]);
  assert.notEqual(ancestryRef("111", "100"), ancestryRef("222", "100"));
});

test("association requires confirmation; name similarity alone never merges", () => {
  const registry = { issued: {}, aliases: {} };
  assert.throws(() => associateRef(registry, "ancestry:1:2", "internal-x"),
    /confirmedBy/, "association without confirmation must refuse");
  associateRef(registry, "ancestry:1:2", "internal-x", { confirmedBy: "founder ruling 2026-09-17" });
  assert.equal(registry.aliases["ancestry:1:2"], "internal-x");
});

test("COPIED-SOURCE LAW: the same assertion on two platforms is two observations, not two confirmations", () => {
  // Marilyn's research represented in FS and Ancestry = her contribution in
  // two places; evidential confidence does NOT auto-increase
  const m = createModel({ source: "multi" });
  // FS side
  addPerson(m, { id: "KWCL-VNB", name: "Donna Ruth Lawton", lifespan: "1925–1988", living: false,
    source: "familysearch", sourceId: "KWCL-VNB" });
  // Ancestry side (same person, different provider observation)
  harvestResponse(m, { v: "3.0", Persons: [{
    gid: { v: "555:1030:888" }, Names: [{ g: "donna", s: "" }],
    Genders: [{ g: "f" }], Events: [{ t: "Birth", p: "Somewhere" }], Family: [],
  }], focus: {} }, { treeId: "888" });
  const fsObs = m.persons["KWCL-VNB"];
  const ancObs = m.persons[ancestryRef("888", "555")];
  // both carry support: unsourced-entry — the observation count did NOT raise it
  assert.equal(fsObs.evidence.support, "unsourced-entry");
  assert.equal(ancObs.evidence.support, "unsourced-entry");
  assert.match(ancObs.evidence.basis, /source independence not yet assessed/);
  // the honest label renders
  assert.match(appearsIn(["FamilySearch", "Ancestry"]), /independence not yet assessed/);
  // Donna's FS record stays deceased — the Ancestry living observation does
  // not rewrite it, and vice versa
  assert.equal(fsObs.living, false);
  assert.equal(ancObs.providerObservation.hasDeathEvent, false, 'no death event observed — not asserted living');
});

test("absent parent in one provider must not delete a known parent from another", () => {
  const m = createModel({ source: "multi" });
  // FS knows both parents
  addPerson(m, { id: "C1", name: "Child", living: false });
  addPerson(m, { id: "F1", name: "Known Father", gender: "M", living: false });
  addPerson(m, { id: "M1", name: "Known Mother", gender: "F", living: false });
  addEdge(m, "C1", ["F1", "M1"]);
  // Ancestry payload with the same child but NO father (mother-only)
  harvestResponse(m, { v: "3.0", Persons: [
    { gid: { v: "700:1030:444" }, Names: [{ g: "Child", s: "" }], Genders: [], Events: [], Family: [] },
    { gid: { v: "701:1030:444" }, Names: [{ g: "Known", s: "Mother" }], Genders: [{ g: "f" }], Events: [], Family: [] },
  ], focus: {} }, { treeId: "444" });
  // the adapter's separate namespaced view has no father — but the FS edge
  // still carries BOTH parents untouched
  assert.deepEqual(m.edges.C1.sort(), ["F1", "M1"].sort());
});

test("founder dual-identity resolution: both Ancestry representations → one internal root", () => {
  // simulate: two Ancestry trees both carry the founder under different name
  // forms; CONFIRMED associations point both at the existing internal id
  const registry = { issued: {}, aliases: {} };
  const internalRoot = "founder";
  associateRef(registry, ancestryRef("211708694", "202781869503"), internalRoot, { confirmedBy: "founder 2026-09-17: both trees are mine" });
  associateRef(registry, ancestryRef("212520723", "272802024452"), internalRoot, { confirmedBy: "founder 2026-09-17: both trees are mine" });
  assert.equal(registry.aliases[ancestryRef("211708694", "202781869503")], internalRoot);
  assert.equal(registry.aliases[ancestryRef("212520723", "272802024452")], internalRoot);
  // both resolve to ONE identity while keeping their distinct refs
  const resolved = new Set(Object.entries(registry.aliases)
    .filter(([ref]) => isAncestryRef(ref))
    .map(([, iid]) => iid));
  assert.equal(resolved.size, 1);
});

test("CLOSEOUT: no-death-event ≠ living — observation fields, never inference", () => {
  const m = createModel({ source: "ancestry" });
  harvestResponse(m, { v: "3.0", Persons: [
    { gid: { v: "900:1030:777" }, Names: [{ g: "NoDeath", s: "Person" }],
      Genders: [{ g: "f" }], Events: [{ t: "Birth", p: "Somewhere" }], Family: [] },
    { gid: { v: "901:1030:777" }, Names: [{ g: "HasDeath", s: "Person" }],
      Genders: [{ g: "m" }], Events: [{ t: "Birth", p: "X" }, { t: "Death", p: "Y" }], Family: [] },
  ], focus: {} }, { treeId: "777" });
  const nd = m.persons[ancestryRef("777", "900")];
  const hd = m.persons[ancestryRef("777", "901")];
  // three explicit facts, no inference
  assert.equal(nd.providerObservation.hasDeathEvent, false, "no death event: observed");
  assert.equal(nd.providerObservation.livingFlagObserved, null, "payload carries NO living flag");
  assert.equal(nd.providerObservation.uiLivingLabelObserved, null, "UI label not separately receipted");
  assert.equal(nd.living, false, "adapter never asserts living — absence of death ≠ living");
  assert.equal(hd.providerObservation.hasDeathEvent, true);
});

test("CLOSEOUT: nameless/skipped person not counted in added", () => {
  const m = createModel({ source: "ancestry" });
  const r = harvestResponse(m, { v: "3.0", Persons: [
    { gid: { v: "910:1030:666" }, Names: [], Genders: [], Events: [], Family: [] }, // nameless
    { gid: { v: "911:1030:666" }, Names: [{ g: "Named", s: "Person" }], Genders: [], Events: [], Family: [] },
  ], focus: {} }, { treeId: "666" });
  assert.equal(r.added, 1, "only the named person counts");
  assert.ok(!m.persons[ancestryRef("666", "910")], "nameless record never entered the model");
});

test("CLOSEOUT: skipped target never creates a dangling parent edge", () => {
  const m = createModel({ source: "ancestry" });
  // child references a FATHER whose record is nameless (skipped in pass 1)
  harvestResponse(m, { v: "3.0", Persons: [
    { gid: { v: "920:1030:555" }, Names: [{ g: "Child", s: "X" }], Genders: [],
      Events: [], Family: [{ t: "F", tgid: { v: "921:1030:555" } }] },
    { gid: { v: "921:1030:555" }, Names: [], Genders: [], Events: [], Family: [] }, // nameless father
  ], focus: {} }, { treeId: "555" });
  const child = m.persons[ancestryRef("555", "920")];
  assert.ok(child, "child inserted");
  const edges = m.edges[ancestryRef("555", "920")];
  assert.ok(!edges || edges.length === 0, "no dangling parent edge to the skipped record");
});

test("CLOSEOUT: living-person ancestry refs stay in the PRIVATE registry, never the public one", () => {
  // the public registry (committed) holds deceased fsids only; ancestry refs
  // for living persons (incl. both founder representations) live in the
  // private registry on local disk
  const fs = awaitImportFs();
  const pubReg = JSON.parse(fs.readFileSync("assets/profile-archive/lineage/identity-registry.json", "utf8"));
  const pubText = JSON.stringify(pubReg);
  assert.ok(!isAncestryRef(pubText.replace(/"/g, "")), "no ancestry refs in the public registry");
  const privPath = "C:/Users/travi/family-lineage/ancestry/ancestry-private-staging.json";
  if (fs.existsSync(privPath)) {
    const priv = JSON.parse(fs.readFileSync(privPath, "utf8"));
    assert.ok(priv.associations && Object.keys(priv.associations).some(isAncestryRef),
      "founder ancestry associations present in PRIVATE staging");
  }
});
function awaitImportFs() { return { readFileSync: _rf, existsSync: _ex }; }
