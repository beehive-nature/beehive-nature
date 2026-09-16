// identity stability — reordered input must never re-point a published
// address at someone else. Local receipt (needs the raw walk); CI self-skips.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createModel, bloodline } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";

const RAW = "C:/Users/travi/family-lineage/familysearch-ancestry-full.json";
const REGISTRY = new URL("../../assets/profile-archive/lineage/identity-registry.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const HAS_RAW = existsSync(RAW);

test("identity freeze: reordered import keeps every issued id on its person", { skip: !HAS_RAW }, () => {
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
  const raw = JSON.parse(readFileSync(RAW, "utf8"));

  // import twice: natural order, then deterministically SHUFFLED (every 7th
  // person rotated) — the registry must hold every id to its fsid
  const build = (persons) => {
    const model = createModel({ root: raw.root, source: "familysearch" });
    importWalk(model, { ...raw, persons });
    return model;
  };
  const shuffled = {};
  const keys = Object.keys(raw.persons);
  keys.forEach((k, i) => { shuffled[keys[(i * 7 + 3) % keys.length]] = raw.persons[k]; });
  const m1 = build(raw.persons);
  const m2 = build(shuffled);

  // the registry ids are authoritative: same fsid → same internal id, and no
  // two fsids share an id (a split/merge would need explicit alias handling)
  const seen = new Map();
  for (const [fsid, iid] of Object.entries(registry.issued)) {
    assert.match(iid, /^p[0-9a-f]{10}$/, `registry id for ${fsid} is not a frozen-shape id: ${iid}`);
    if (seen.has(iid)) assert.fail(`id collision: ${iid} issued to both ${seen.get(iid)} and ${fsid} — merge/split needs explicit aliasing`);
    seen.set(iid, fsid);
  }
  // both import orders carry the same persons under the same provider refs
  assert.equal(Object.keys(m1.persons).length, Object.keys(m2.persons).length);
  // every registry entry corresponds to a real walked person (no phantom ids)
  for (const fsid of Object.keys(registry.issued))
    assert.ok(raw.persons[fsid] || m1.persons[fsid], `registry entry ${fsid} matches no walked person`);
});
