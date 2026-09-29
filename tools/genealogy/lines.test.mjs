// lines.mjs — joining a private spouse line into the one model, on SYNTHETIC
// data only (no real walk). The founder root is kept, joins are additive,
// a living spouse walked from above enters only as an anonymous root, and the
// published line opens at her deceased father.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createModel, addPerson, addEdge, validate } from "./model.mjs";
import { joinLine, emptyPart } from "./lines.mjs";
import { publish } from "./publish.mjs";

function founderModel() {
  const m = createModel({ root: "F000-001", source: "synthetic" });
  addPerson(m, { id: "F000-001", name: "Founder Private", lifespan: "1977–", living: true });
  addPerson(m, { id: "F000-002", name: "Founder Grand", lifespan: "1900–1970", living: false });
  addPerson(m, { id: "S000-SHD", name: "Shared Ancestor", lifespan: "1700–1760", living: false });
  addEdge(m, "F000-001", ["F000-002"]);
  addEdge(m, "F000-002", ["S000-SHD"]);
  return m;
}
function spouseWalk() { // walked from the spouse's deceased father
  const w = emptyPart();
  w.root = "D000-DAD"; // importWalk sets root on the PART, never on the model
  addPerson(w, { id: "D000-DAD", name: "Spouse Father", lifespan: "1945–2007", living: false });
  addPerson(w, { id: "D000-GPA", name: "Spouse Grandfather", lifespan: "1920–1990", living: false });
  addPerson(w, { id: "S000-SHD", name: "Shared Ancestor (other spelling)", lifespan: "1700–1760", living: false });
  addEdge(w, "D000-DAD", ["D000-GPA"]);
  addEdge(w, "D000-GPA", ["S000-SHD"]);
  return w;
}
const LINE = { root: "C000-SPS", rootLiving: { gender: "FEMALE" }, links: { "C000-SPS": ["D000-DAD"] } };

test("the join is additive: shared people keep the founder walk's data, disagreements are counted", () => {
  const m = founderModel();
  const stats = joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  assert.deepEqual(stats, { added: 2, shared: 1, disagreements: 1 });
  assert.equal(m.persons["S000-SHD"].name, "Shared Ancestor");
});

test("the founder root is never replaced", () => {
  const m = founderModel();
  joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  assert.equal(m.root, "F000-001");
  assert.deepEqual(m.roots, { founder: "F000-001", "spouse-2": "C000-SPS" });
});

test("a spouse absent from every walk enters only as an anonymous living root, linked by attestation", () => {
  const m = founderModel();
  joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  assert.deepEqual(m.persons["C000-SPS"], { name: "Living", lifespan: null, gender: "FEMALE", living: true,
    evidence: { era: "living", support: "attested", class: "living", basis: "founder-attested private line root" } });
  assert.deepEqual(m.edges["C000-SPS"], ["D000-DAD"]);
});

test("published: Spouse line II, one held generation, opening at the deceased father; ancestry above is public", () => {
  const m = founderModel();
  joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  const { pub } = publish(m);
  const line = pub.lines.find((l) => l.key === "spouse-2");
  assert.equal(line.label, "Spouse line II");
  assert.equal(line.bridge, 1);
  assert.deepEqual(line.entries, ["D000-DAD"]);
  assert.equal(pub.persons["D000-GPA"].name, "Spouse Grandfather");
  assert.equal(pub.persons["C000-SPS"].name, "Living");
  assert.equal(pub.roots, undefined);
});

test("a root in no walk and not declared living is refused, as is a malformed key", () => {
  assert.throws(() => joinLine(founderModel(), "spouse-2", { root: "C000-SPS" }, [spouseWalk()]), /not declared rootLiving/);
  assert.throws(() => joinLine(founderModel(), "wife-2", LINE, [spouseWalk()]), /malformed/);
});

// ── negative controls (founder ruling 2026-09-22): each forced leak must be refused
test("control: a spouse's real name forced onto her public stub is refused", () => {
  const m = founderModel(); joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  const { pub } = publish(m);
  pub.persons["C000-SPS"].name = "A Real Spouse Name";
  assert.ok(validate(pub, { public: true }).some((p) => /anonymous root-line stub/.test(p)));
});

test("control: a provider id kept on her stub is refused", () => {
  const m = founderModel(); joinLine(m, "spouse-2", LINE, [spouseWalk()]);
  const { pub } = publish(m);
  pub.persons["C000-SPS"].sourceId = "C000-SPS";
  assert.ok(validate(pub, { public: true }).some((p) => /anonymous root-line stub/.test(p)));
  // and the FSID-shaped key itself is a leak until the pipeline pseudonymizes it
  assert.ok(validate(pub, { public: true }).some((p) => /provider identifier/.test(p)));
});

// control 3 (a join that adopts the walk's root) is a CODE mutation, run by
// hand: making joinLine set model.root = parts[0].root fails "the founder root
// is never replaced" (2026-09-22 receipt).
