// family completeness regression — the founder's failed acceptance, encoded.
// These tests trace named persons through raw export → normalized model →
// staged object → published corpus → relationship paths → person pages.
// They require the LOCAL raw walk (living family at full fidelity — never
// committed); they self-skip when absent so CI stays green, and the local run
// is the receipt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createModel, bloodline, depths } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";

const RAW = "C:/Users/travi/family-lineage/familysearch-ancestry-full.json";
const LINEAGE = new URL("../../assets/profile-archive/lineage/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const HAS_RAW = existsSync(RAW);

// internal identity resolves through refsIndex — provider ids are references
const pub = JSON.parse(readFileSync(LINEAGE + "remington-bloodline.json", "utf8"));
const resolve = (fsid) => pub.refsIndex[fsid];

const FAMILY = [
  { name: "Donna Ruth Lawton", fsid: "KWCL-VNB", lifespan: "1925–1988", living: false, spineRow: 2,
    relation: "paternal grandmother — the spine rides her line" },
  { name: "Marilyn Lowry", fsid: "LNQ5-BSF", lifespan: "1932–Deceased", living: false, corrected: true,
    relation: "maternal grandmother — co-builder of the tree; FS living-flag corrected by founder attestation" },
  { name: "Don Ray Remington", fsid: "LNQ5-BSG", lifespan: "1931–Deceased", living: false, corrected: true,
    relation: "maternal grandfather — FS living-flag corrected by founder attestation" },
  { name: "Albert Perry Rockwood", fsid: "KWJ4-XBD", lifespan: "1805–1879", living: false,
    relation: "the Rockwood line's public entrance person" },
];

function loadModel() {
  const raw = JSON.parse(readFileSync(RAW, "utf8"));
  const model = createModel({ root: raw.root, source: "familysearch" });
  importWalk(model, raw);
  return { raw, model };
}

test("founder grandparent law: the grandparent generation is four distinct NAMED people, none 'Living'", () => {
  // You → two parents (may be Living stubs) → four NAMED grandparents
  const rootIid = pub.root;
  const parents = pub.edges[rootIid] || [];
  const grandparentSet = new Map(); // iid → name
  for (const par of parents)
    for (const gp of (pub.edges[par] || []))
      if (pub.persons[gp]) grandparentSet.set(gp, pub.persons[gp].name);
  assert.equal(grandparentSet.size, 4, `expected 4 distinct grandparents, got ${grandparentSet.size}`);
  const expected = ["Donna Ruth Lawton", "Jack Benedum Sutphen", "Don Ray Remington", "Marilyn Lowry"];
  const names = [...grandparentSet.values()].sort();
  for (const nm of expected)
    assert.ok(names.some((n) => n.includes(nm.split(" ")[0]) && n.includes(nm.split(" ").pop())),
      `grandparent ${nm} missing — generation: ${names.join(", ")}`);
  for (const [iid, nm] of grandparentSet) {
    assert.notEqual(nm, "Living", `grandparent ${iid} rendered as a Living placeholder — the founder's grandparents are named`);
    assert.equal(pub.persons[iid].living, false, `grandparent ${nm} still flagged living`);
    assert.ok(!pub.persons[iid].lifespan || !/Living/.test(pub.persons[iid].lifespan), `grandparent ${nm} lifespan still says Living`);
    // each opens their own archive: staged object + page exist
    assert.ok(existsSync(LINEAGE + "persons/" + iid + ".json"), `grandparent ${nm} has no staged archive object`);
    assert.ok(existsSync(LINEAGE + "persons/" + iid + ".html"), `grandparent ${nm} has no archive page`);
  }
});

test("family completeness: raw → model → staged object → pub → relationships (local receipt)", { skip: !HAS_RAW }, () => {
  const { raw, model } = loadModel();
  const d = depths(model);
  const blood = bloodline(model);

  for (const f of FAMILY) {
    // 1. raw export retains the person (private full-fidelity retention)
    assert.ok(raw.persons[f.fsid], `raw: ${f.name} missing`);
    assert.equal(raw.persons[f.fsid].name, f.name);
    // 2. internal identity resolves; the person is published with right states
    const iid = resolve(f.fsid);
    assert.ok(iid, `refsIndex: ${f.name} (${f.fsid}) unresolved`);
    const pp = pub.persons[iid];
    assert.ok(pp, `pub: ${f.name} missing — silently lost or wrongly excluded`);
    assert.equal(pp.name, f.name);
    assert.equal(pp.living, f.living);
    assert.equal(pp.lifespan, f.lifespan);
    // provider id retained as a REFERENCE, demoted from identity
    assert.deepEqual(pp.refs, [{ provider: "familysearch", id: f.fsid }]);
    // research + publication tracked separately; incomplete ≠ missing
    assert.ok(pp.research && pp.research.status, `${f.name}: no research status`);
    assert.equal(pp.publication.status, "public");
    if (f.corrected) { assert.ok(pp.corrected, `${f.name}: correction layer missing`); assert.equal(pp.research.status, "corrected-attested"); }
    // 3. staged person object exists (first-class archive object)
    const staged = JSON.parse(readFileSync(LINEAGE + "persons/" + iid + ".json", "utf8"));
    assert.equal(staged.schema, "skaists.person/1");
    assert.equal(staged.internalId, iid);
    assert.equal(staged.identity.name, f.name);
    assert.ok(staged.relationships.parents.length + staged.relationships.children.length >= 1, `${f.name}: no relationships staged`);
    // 4. person page generated from the shared object
    assert.ok(existsSync(LINEAGE + "persons/" + iid + ".html"), `${f.name}: person page not generated`);
    // 5. relationship paths exist — reachable in the blood graph
    assert.ok(blood.has(f.fsid), `${f.name}: not on the bloodline graph`);
    assert.ok(d[f.fsid] !== undefined, `${f.name}: no depth from root`);
    // 6. searchable from a cold load of the published corpus
    assert.ok(JSON.stringify(pub).indexOf(f.name) >= 0);
  }

  // the spine still rides Donna's line (row 2) — the founder's stated canon
  const donnaRow = pub.spine.find((r) => r.f === resolve("KWCL-VNB"));
  assert.ok(donnaRow, "Donna missing from the published spine");
  assert.equal(donnaRow.i, 2, "Donna is not spine row 2 — the Lawton canon broke");

  // Rockwood: real parent-child chains in the pub corpus, by internal ids
  const rk = resolve("KWJ4-XBD");
  assert.ok(Array.isArray(pub.edges[rk]) && pub.edges[rk].length >= 1, "Rockwood: no parent edges in pub");
  const rkChildren = Object.entries(pub.edges).filter(([, ps]) => ps.includes(rk)).map(([c]) => c);
  assert.ok(rkChildren.length >= 1, "Rockwood: no child edges in pub");
});

test("research/publication statuses: 'incomplete', 'private', 'disputed' never mean silently missing", () => {
  for (const p of Object.values(pub.persons)) {
    assert.ok(p.research && p.research.status, "person without research status");
    assert.ok(p.publication && p.publication.status, "person without publication status");
    if (p.publication.status === "private-stub") assert.ok(p.publication.reason, "private-stub without a stated reason");
  }
  // living stubs say why they are stubs, in public
  const stub = pub.persons[pub.root];
  assert.equal(stub.publication.status, "private-stub");
  assert.ok(stub.publication.reason.includes("founder"));
});

test("reconciliation: every raw person accounted for — published, stubbed, or excluded with a reason", { skip: !HAS_RAW }, () => {
  const rec = pub.meta && pub.meta.reconciliation;
  assert.ok(rec, "corpus carries no reconciliation block");
  const accounted = (rec.published || 0) + Object.values(rec.excluded || {}).reduce((a, b) => a + (b.count || 0), 0);
  assert.equal(accounted, rec.rawPersons, "reconciliation does not sum to the raw walk — someone is silently lost");
  assert.ok(rec.retainedPrivatelyNote, "no private-retention note");
});

test("view/search acceptance: Donna findable from a cold load of the published corpus", () => {
  const names = Object.values(pub.persons).map((p) => (p.name || "").toLowerCase());
  assert.ok(names.some((n) => n.includes("donna ruth lawton")), "search 'donna' would fail — person absent");
  const rk = pub.persons[resolve("KWJ4-XBD")];
  assert.ok(rk && rk.name.includes("Albert Perry Rockwood"), "Rockwood entrance person absent from pub");
  // provider-id search resolves through refsIndex
  assert.equal(resolve("KWCL-VNB"), pub.refsIndex["KWCL-VNB"]);
});
