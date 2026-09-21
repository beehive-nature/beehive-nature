// identity assignment — executable synthetic test of the REAL code (no
// private genealogy data in CI). Proves: reordered imports preserve issued
// ids; explicitly approved provider aliases preserve identity; collisions
// refuse; corrupted previously-issued registries stop the run (a missing one
// starts fresh — distinct states).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistry, assignIdentities, newInternalId, PUBLIC_REGISTRY_SCHEMA } from "./identity.mjs";

const persons = (list) => Object.fromEntries(list.map(([id, p]) => [id, p]));
const DECEASED = { living: false };
const LIVING = { living: true };
const freshPub = () => ({ schema: PUBLIC_REGISTRY_SCHEMA, issued: {}, aliases: {} });
const freshPriv = () => ({ schema: "skaists.identity-registry-private/1", issued: {} });

test("reordered import preserves every issued id (the real assignment path)", () => {
  const A = persons([["AAAA-111", DECEASED], ["BBBB-222", DECEASED], ["CCCC-333", DECEASED], ["ROOT-000", LIVING]]);
  // reorder INTACT entries — same key/value pairs, different iteration order
  const B = persons([["CCCC-333", DECEASED], ["ROOT-000", LIVING], ["AAAA-111", DECEASED], ["BBBB-222", DECEASED]]);

  const r1 = assignIdentities({ pubPersons: A, root: "ROOT-000", pubRegistry: freshPub(), privRegistry: freshPriv() });
  assert.deepEqual(r1.errors, []);
  // second run reuses the PERSISTED registries from run 1 (the real flow)
  const pub2 = JSON.parse(JSON.stringify(r1 ? { issued: {}, aliases: {} } : {}));
  const persistedPub = { schema: PUBLIC_REGISTRY_SCHEMA, issued: {}, aliases: {} };
  // simulate persistence: run 1 mutated the registries in place
  const reg1 = freshPub(); const priv1 = freshPriv();
  assignIdentities({ pubPersons: A, root: "ROOT-000", pubRegistry: reg1, privRegistry: priv1 });
  const r2 = assignIdentities({ pubPersons: B, root: "ROOT-000", pubRegistry: reg1, privRegistry: priv1 });
  assert.deepEqual(r2.errors, []);

  // every person keeps the SAME internal id across both orders
  for (const fsid of ["AAAA-111", "BBBB-222", "CCCC-333", "ROOT-000"])
    assert.equal(r1.idmap[fsid], r2.idmap[fsid], `${fsid} changed identity under reordering`);
  assert.equal(r1.idmap["ROOT-000"], "founder");
  // living non-root gets a stable pseudonym too
  const A2 = persons([["AAAA-111", DECEASED], ["DDDD-444", LIVING], ["ROOT-000", LIVING]]);
  const reg2 = freshPub(); const priv2 = freshPriv();
  const s1 = assignIdentities({ pubPersons: A2, root: "ROOT-000", pubRegistry: reg2, privRegistry: priv2 });
  const s2 = assignIdentities({ pubPersons: persons([["ROOT-000", LIVING], ["DDDD-444", LIVING], ["AAAA-111", DECEASED]]), root: "ROOT-000", pubRegistry: reg2, privRegistry: priv2 });
  assert.equal(s1.idmap["DDDD-444"], s2.idmap["DDDD-444"]);
});

test("explicitly approved provider alias preserves identity", () => {
  const reg = freshPub();
  const priv = freshPriv();
  const r1 = assignIdentities({ pubPersons: persons([["OLD1-999", DECEASED]]), root: null, pubRegistry: reg, privRegistry: priv });
  // provider changes the reference; the alias is APPROVED (explicit entry)
  reg.aliases["NEW1-888"] = "OLD1-999";
  const r2 = assignIdentities({ pubPersons: persons([["NEW1-888", DECEASED]]), root: null, pubRegistry: reg, privRegistry: priv });
  assert.equal(r2.idmap["NEW1-888"], r1.idmap["OLD1-999"], "alias must preserve the issued identity");
  assert.equal(reg.aliases["NEW1-888"], "OLD1-999");
});

test("collisions refuse", () => {
  const reg = freshPub();
  reg.issued["AAA1-111"] = "p1234567890";
  reg.issued["BBB2-222"] = "p1234567890"; // same id twice — must refuse
  const r = assignIdentities({ pubPersons: persons([]), root: null, pubRegistry: reg, privRegistry: freshPriv() });
  assert.ok(r.errors.some((e) => /collision/.test(e)), "registry collision must refuse");
});

test("corrupted registry stops the run; missing registry starts fresh", () => {
  const dir = mkdtempSync(join(tmpdir(), "bnr-identity-"));
  const missingPath = join(dir, "missing.json");
  const m = loadRegistry(missingPath, PUBLIC_REGISTRY_SCHEMA);
  assert.equal(m.state, "fresh");

  const corruptPath = join(dir, "corrupt.json");
  writeFileSync(corruptPath, "{ this is not json");
  assert.throws(() => loadRegistry(corruptPath, PUBLIC_REGISTRY_SCHEMA), /CORRUPT/);

  const malformedPath = join(dir, "malformed.json");
  writeFileSync(malformedPath, JSON.stringify({ issued: "not-an-object" }));
  assert.throws(() => loadRegistry(malformedPath, PUBLIC_REGISTRY_SCHEMA), /malformed/);
});

test("new ids are registry-shaped and deterministic in first-issue", () => {
  assert.match(newInternalId("familysearch:TEST-123"), /^p[0-9a-f]{10}$/);
  assert.equal(newInternalId("familysearch:TEST-123"), newInternalId("familysearch:TEST-123"));
  assert.notEqual(newInternalId("familysearch:TEST-123"), newInternalId("familysearch:TEST-124"));
});
