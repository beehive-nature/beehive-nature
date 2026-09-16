// family completeness regression — the founder's failed acceptance, encoded.
// These tests trace named persons through raw export → normalized model →
// published corpus → relationship paths. They require the LOCAL raw walk
// (living family at full fidelity — never committed); they self-skip when it
// is absent so CI stays green, and the local run is the receipt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createModel, addPerson, addEdge, bloodline, depths, spine } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";

const RAW = "C:/Users/travi/family-lineage/familysearch-ancestry-full.json";
const PUB = new URL("../../assets/profile-archive/lineage/remington-bloodline.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const HAS_RAW = existsSync(RAW);

const FAMILY = [
  { name: "Donna Ruth Lawton", id: "KWCL-VNB", lifespan: "1925–1988", living: false,
    relation: "paternal grandmother — the spine rides her line; founder order: 'it comes from my grandmother Donna Ruth Lawton bloodline'" },
  { name: "Marilyn Lowry", id: "LNQ5-BSF", lifespan: "1932–Deceased", living: false, corrected: true,
    relation: "maternal grandmother — co-builder of the tree; FS living-flag corrected by founder attestation" },
  { name: "Don Ray Remington", id: "LNQ5-BSG", lifespan: "1931–Deceased", living: false, corrected: true,
    relation: "maternal grandfather — FS living-flag corrected by founder attestation" },
  { name: "Albert Perry Rockwood", id: "KWJ4-XBD", lifespan: "1805–1879", living: false,
    relation: "the Rockwood line's public entrance person" },
];

function loadModel() {
  const raw = JSON.parse(readFileSync(RAW, "utf8"));
  const model = createModel({ root: raw.root, source: "familysearch" });
  importWalk(model, raw);
  return { raw, model };
}

test("family completeness: raw → model → pub → relationships (local receipt)", { skip: !HAS_RAW }, () => {
  const { raw, model } = loadModel();
  const pub = JSON.parse(readFileSync(PUB, "utf8"));
  const d = depths(model);
  const blood = bloodline(model);

  for (const f of FAMILY) {
    // 1. raw export retains the person (private full-fidelity retention)
    assert.ok(raw.persons[f.id], `raw: ${f.name} missing`);
    assert.equal(raw.persons[f.id].name, f.name);
    // 2. published corpus carries the person with the right privacy state
    const pp = pub.persons[f.id];
    assert.ok(pp, `pub: ${f.name} missing — silently lost or wrongly excluded`);
    assert.equal(pp.name, f.name);
    assert.equal(pp.living, f.living, `${f.name}: living flag wrong in pub`);
    assert.equal(pp.lifespan, f.lifespan, `${f.name}: lifespan wrong in pub`);
    if (f.corrected) assert.ok(pp.corrected, `${f.name}: correction layer missing in pub`);
    // 3. relationship paths exist — the person is reachable in the blood graph
    assert.ok(blood.has(f.id), `${f.name}: not on the bloodline graph`);
    assert.ok(d[f.id] !== undefined, `${f.name}: no depth from root`);
    // 4. searchable: the pub corpus text contains the exact name
    assert.ok(JSON.stringify(pub).indexOf(f.name) >= 0, `${f.name}: name absent from pub serialization`);
  }

  // the spine still rides Donna's line (row 2) — the founder's stated canon
  const donnaRow = pub.spine.find((r) => r.f === "KWCL-VNB");
  assert.ok(donnaRow, "Donna missing from the published spine");
  assert.equal(donnaRow.i, 2, "Donna is not spine row 2 — the Lawton canon broke");

  // Albert Perry Rockwood: a real parent-child chain in the pub corpus
  const rkParents = pub.edges["KWJ4-XBD"];
  assert.ok(Array.isArray(rkParents) && rkParents.length >= 1, "Rockwood: no parent edges in pub");
  const rkChildren = Object.entries(pub.edges).filter(([, ps]) => ps.includes("KWJ4-XBD")).map(([c]) => c);
  assert.ok(rkChildren.length >= 1, "Rockwood: no child edges in pub");
});

test("reconciliation: every raw person accounted for — published, stubbed, or excluded with a reason", { skip: !HAS_RAW }, () => {
  const pub = JSON.parse(readFileSync(PUB, "utf8"));
  const rec = pub.meta && pub.meta.reconciliation;
  assert.ok(rec, "corpus carries no reconciliation block");
  const accounted = (rec.published || 0) + Object.values(rec.excluded || {}).reduce((a, b) => a + (b.count || 0), 0);
  assert.equal(accounted, rec.rawPersons, "reconciliation does not sum to the raw walk — someone is silently lost");
  assert.ok(rec.retainedPrivatelyNote, "no private-retention note");
});

test("view/search acceptance: Donna findable from a cold load of the published corpus", () => {
  const pub = JSON.parse(readFileSync(PUB, "utf8"));
  const names = Object.values(pub.persons).map((p) => (p.name || "").toLowerCase());
  assert.ok(names.some((n) => n.includes("donna ruth lawton")), "search 'donna' would fail — person absent");
  const rk = pub.persons["KWJ4-XBD"];
  assert.ok(rk && rk.name.includes("Albert Perry Rockwood"), "Rockwood entrance person absent from pub");
});
