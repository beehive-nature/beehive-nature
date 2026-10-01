// ── research-basis.test.mjs — the published research.basis says what was harvested ──
// Two people's basis read "undefined attached FamilySearch sources (harvested
// undefined)" on main e063fb00: their correction patch carries `sources` as an
// ARRAY of cited documents, the harvest found nothing attached and left it
// standing, and the pipeline read .count/.harvested off the array. The staged
// copies carried the same collision as `layers.records.sources: {}`.
//
// Two guards, deliberately of different kinds:
//   A  no basis anywhere in the published archive carries a templated
//      "undefined" — a text check that does not use the generator's helper,
//      so it cannot share the helper's mistakes;
//   B  every published research.basis is exactly what researchBasis() says
//      for that person, and every staged records.sources is a real harvest
//      record — the invariant over the whole archive, never a sample.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { harvestRecord, researchBasis } from "./fs-adapter.mjs";
import { applyCorrection } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const L = join(HERE, "..", "..", "assets", "profile-archive", "lineage");
const corpus = JSON.parse(readFileSync(join(L, "remington-bloodline.json"), "utf8"));
const persons = Object.entries(corpus.persons);

test("A: no published basis sentence carries a templated undefined", () => {
  const bad = [];
  let inspected = 0;
  for (const [id, p] of persons) {
    for (const [field, v] of [["evidence", p.evidence], ["research", p.research], ["birth", p.birth], ["death", p.death]]) {
      if (!v || typeof v.basis !== "string") continue;
      inspected++;
      if (/\bundefined\b/.test(v.basis)) bad.push(`${id} ${field}.basis = ${JSON.stringify(v.basis)}`);
    }
  }
  /* non-vacuity: the sweep read the archive, not an empty map */
  assert.ok(inspected > 20000, `inspected ${inspected} basis sentences`);
  assert.deepEqual(bad, []);
});

test("B1: every published research.basis is the sentence researchBasis() gives for that person", () => {
  const drift = [];
  const branch = { harvested: 0, cited: 0, none: 0 };
  for (const [id, p] of persons) {
    if (!p.research) continue;
    const want = researchBasis(p);
    if (p.research.basis !== want) drift.push(`${id}: ${JSON.stringify(p.research.basis)} -> ${JSON.stringify(want)}`);
    if (harvestRecord(p)) branch.harvested++;
    else if (Array.isArray(p.cited) && p.cited.length) branch.cited++;
    else branch.none++;
  }
  assert.deepEqual(drift, [], "the archive and the generator disagree about what was harvested");
  /* non-vacuity: both standing branches are populated in the real archive, so
   * the equality above compared real sentences on each side. The cited branch
   * is NOT pinned: it empties the day those people gain a harvest record. */
  assert.ok(branch.harvested > 0 && branch.none > 0, JSON.stringify(branch));
});

test("B2: every staged records.sources is a real harvest record, never an empty object", () => {
  const dir = join(L, "persons");
  const bad = [];
  let withSources = 0;
  let files = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    files++;
    const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const records = rec.layers && rec.layers.records;
    if (!records || !("sources" in records)) continue;
    withSources++;
    if (!harvestRecord(records)) bad.push(`${f}: ${JSON.stringify(records.sources)}`);
  }
  assert.ok(files > 10000 && withSources > 0, `read ${files} staged files, ${withSources} with records.sources`);
  assert.deepEqual(bad, []);
});

/* C: `sources` has ONE meaning in the data. A correction's cited documents live
 * in `cited`; the pipeline applies corrections BEFORE the harvest, which writes
 * `sources`, so a cited array left under `sources` is lost at the first harvest
 * that finds anything for that person. */
test("C: no published person and no correction carries cited documents under `sources`", () => {
  const overlay = JSON.parse(readFileSync(join(L, "attested-overlays.json"), "utf8"));
  const corrections = Object.entries(overlay.corrections || {});
  const refused = [];
  let citedPatches = 0;
  for (const [id, c] of corrections) {
    if (Array.isArray(c.patch && c.patch.cited)) citedPatches++;
    try { applyCorrection({}, c); } catch (e) { refused.push(`${id}: ${e.message}`); }
  }
  /* non-vacuity: the real corrections were read, and some carry cited documents */
  assert.ok(corrections.length > 0 && citedPatches > 0, `${corrections.length} corrections, ${citedPatches} with cited`);
  assert.deepEqual(refused, []);

  const arrays = [];
  let records = 0, cited = 0;
  for (const [id, p] of persons) {
    if (Array.isArray(p.sources)) arrays.push(id);
    else if (harvestRecord(p)) records++;
    if (Array.isArray(p.cited)) cited++;
  }
  assert.ok(records > 0 && cited > 0, `${records} harvest records, ${cited} persons with cited`);
  assert.deepEqual(arrays, [], "a published person carries an array under `sources`");
});
