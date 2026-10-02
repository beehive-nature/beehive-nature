// preserve-service.test.mjs — the EDITION-GATED spend path (PR #296 review
// P1 fix): the service consumes ETERNALIZATION-EDITION-V2.json and refuses
// every spend while the gate is absent, unreadable, or not APPROVED; the
// approved artifact resolves BY HASH against the candidate tars. Synthetic
// fixtures only; no server spawn, no ant CLI, CI-safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editionGate, resolveApprovedTar, validateQuoteAgainstGate } from "./preserve-service.mjs";

const GATE_SCHEMA = (status, tarSha) => ({
  schema: "skaists.eternalization-edition/2",
  artifact: { tarSha256: tarSha, tarBytes: 10 },
  separatedCeilings: { storageMaxAnt: 1.6, gasMaxEth: 0.0002 },
  quote: { chunkCount: 29 },
  spendingApprovalGate: { status },
});

const GOOD_QUOTE = { storage_cost_atto: "1482927234375000000", estimated_gas_cost_wei: "150000000000000", chunk_count: 29 };

test("editionGate: missing gate file = fail-closed (NO spend authority without a gate)", () => {
  const g = editionGate(join(tmpdir(), "definitely-absent-gate-" + Date.now() + ".json"));
  assert.equal(g.status, "NO-EDITION-GATE");
  assert.equal(g.raw, null);
});

test("editionGate: AWAITING FOUNDER APPROVAL is NOT a spend authorization (pkg3 path dead)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const p = join(dir, "ETERNALIZATION-EDITION-V2.json");
  writeFileSync(p, JSON.stringify(GATE_SCHEMA("AWAITING FOUNDER APPROVAL", "a".repeat(64))));
  const g = editionGate(p);
  assert.equal(g.status, "AWAITING FOUNDER APPROVAL");
  assert.notEqual(g.status, "APPROVED");
});

test("editionGate: APPROVED exposes the gate's own hash + separated ceilings (never hardcoded bounds)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const p = join(dir, "ETERNALIZATION-EDITION-V2.json");
  writeFileSync(p, JSON.stringify(GATE_SCHEMA("APPROVED", "b".repeat(64))));
  const g = editionGate(p);
  assert.equal(g.status, "APPROVED");
  assert.equal(g.raw.artifact.tarSha256, "b".repeat(64));
  assert.equal(g.raw.separatedCeilings.storageMaxAnt, 1.6);
  assert.equal(g.raw.separatedCeilings.gasMaxEth, 0.0002);
});

test("resolveApprovedTar: only the candidate whose bytes hash to the gate's sha is spendable", () => {
  const dir = mkdtempSync(join(tmpdir(), "tar-"));
  const right = join(dir, "pkg-right.tar");
  const wrong = join(dir, "pkg-wrong.tar");
  writeFileSync(right, "the approved bytes");
  writeFileSync(wrong, "some other bytes");
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const approvedSha = sha("the approved bytes");
  // the right artifact is found regardless of candidate order
  assert.equal(resolveApprovedTar([wrong, right], approvedSha)?.path, right);
  assert.equal(resolveApprovedTar([right, wrong], approvedSha)?.path, right);
  // a hash no candidate carries = nothing is spendable
  assert.equal(resolveApprovedTar([wrong, right], "0".repeat(64)), null);
  assert.equal(resolveApprovedTar([join(dir, "absent.tar")], approvedSha), null);
});

test("validateQuoteAgainstGate accepts only the approved chunk shape within both ceilings", () => {
  const gate = GATE_SCHEMA("APPROVED", "a".repeat(64));
  const result = validateQuoteAgainstGate(GOOD_QUOTE, gate);
  assert.equal(result.ok, true);
  assert.equal(result.chunkCount, 29);
});

test("validateQuoteAgainstGate fails closed on missing, nonnumeric, negative, or excessive values", () => {
  const gate = GATE_SCHEMA("APPROVED", "a".repeat(64));
  for (const quote of [
    { ...GOOD_QUOTE, storage_cost_atto: undefined },
    { ...GOOD_QUOTE, storage_cost_atto: "NaN" },
    { ...GOOD_QUOTE, estimated_gas_cost_wei: "-1" },
    { ...GOOD_QUOTE, storage_cost_atto: "1600000000000000001" },
    { ...GOOD_QUOTE, estimated_gas_cost_wei: "200000000000001" },
  ]) assert.equal(validateQuoteAgainstGate(quote, gate).ok, false);
  assert.equal(validateQuoteAgainstGate(GOOD_QUOTE, { ...gate, separatedCeilings: { ...gate.separatedCeilings, gasMaxEth: "bad" } }).ok, false);
});

test("validateQuoteAgainstGate enforces the approved chunk count", () => {
  const gate = GATE_SCHEMA("APPROVED", "a".repeat(64));
  assert.match(validateQuoteAgainstGate({ ...GOOD_QUOTE, chunk_count: 30 }, gate).error, /chunk count changed/);
  assert.equal(validateQuoteAgainstGate({ ...GOOD_QUOTE, chunk_count: undefined }, gate).ok, false);
  assert.equal(validateQuoteAgainstGate(GOOD_QUOTE, { ...gate, quote: {} }).ok, false);
});
