// preserve-service.test.mjs — the EDITION-GATED spend path (PR #296 review
// P1 fix): the service consumes ETERNALIZATION-EDITION-V2.json and refuses
// every spend while the gate is absent, unreadable, or not APPROVED; the
// approved artifact resolves BY HASH against the candidate tars. Synthetic
// fixtures only; no server spawn, no ant CLI, CI-safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAYMENT_CLIENT_CAPABILITY, bankUploadReceipt, editionGate, isDirectExecution, receiptPathForArtifact, revalidateApproval, resolveApprovedTar, snapshotApprovedTar, validateClientVersion, validateQuoteAgainstGate } from "./preserve-service.mjs";

const GATE_SCHEMA = (status, tarSha) => ({
  schema: "skaists.eternalization-edition/2",
  artifact: { tarSha256: tarSha, tarBytes: 10 },
  separatedCeilings: { storageMaxAnt: 1.6, gasMaxEth: 0.0002 },
  quote: { chunkCount: 29, clientVersion: "ant 0.3.9" },
  spendingApprovalGate: { status },
});

const GOOD_QUOTE = { storage_cost_atto: "1482927234375000000", estimated_gas_cost_wei: "150000000000000", chunk_count: 29 };

test("ant 0.3.9 paid upload stays code-disabled because neither asset ceiling is atomic", () => {
  assert.deepEqual(PAYMENT_CLIENT_CAPABILITY, {
    uploadEnabled: false,
    clientVersion: "ant 0.3.9",
    atomicStorageCeiling: false,
    atomicGasCeiling: false,
    reason: "ant 0.3.9 file upload has no atomic storage or gas ceiling options",
  });
});

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

test("snapshotApprovedTar freezes the approved bytes away from later source replacement", () => {
  const dir = mkdtempSync(join(tmpdir(), "tar-freeze-"));
  const source = join(dir, "pkg4.tar");
  writeFileSync(source, "approved bytes");
  const sha = createHash("sha256").update("approved bytes").digest("hex");
  const frozen = snapshotApprovedTar({ path: source, sha }, sha);
  try {
    writeFileSync(source, "replacement after approval");
    assert.equal(readFileSync(frozen.path, "utf8"), "approved bytes");
    assert.equal(frozen.sha, sha);
  } finally {
    frozen.cleanup();
  }
  assert.equal(existsSync(frozen.path), false);
});

test("direct-execution detection compares normalized filesystem paths without hand-built file URLs", () => {
  const here = fileURLToPath(new URL("preserve-service.mjs", import.meta.url));
  assert.equal(isDirectExecution(here, new URL("preserve-service.mjs", import.meta.url).href), true);
  assert.equal(isDirectExecution(here + ".other", new URL("preserve-service.mjs", import.meta.url).href), false);
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

test("validateClientVersion binds the paid rerun to the quoted ant client", () => {
  const gate = GATE_SCHEMA("APPROVED", "a".repeat(64));
  assert.equal(validateClientVersion("ant 0.3.9", gate).ok, true);
  assert.match(validateClientVersion("ant 0.4.0", gate).error, /client version changed/);
  assert.equal(validateClientVersion("ant 0.3.9", { ...gate, quote: { chunkCount: 29 } }).ok, false);
});

test("revalidateApproval refuses revocation and any approval-shape change immediately before upload", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-revalidate-"));
  const gatePath = join(dir, "gate.json");
  const initial = GATE_SCHEMA("APPROVED", "a".repeat(64));
  writeFileSync(gatePath, JSON.stringify(initial));
  assert.equal(revalidateApproval(gatePath, initial, "a".repeat(64), GOOD_QUOTE).ok, true);
  writeFileSync(gatePath, JSON.stringify({ ...initial, spendingApprovalGate: { status: "REVOKED" } }));
  assert.match(revalidateApproval(gatePath, initial, "a".repeat(64), GOOD_QUOTE).error, /revoked/);
  writeFileSync(gatePath, JSON.stringify({ ...initial, separatedCeilings: { ...initial.separatedCeilings, storageMaxAnt: 1.5 } }));
  assert.match(revalidateApproval(gatePath, initial, "a".repeat(64), GOOD_QUOTE).error, /changed/);
  writeFileSync(gatePath, JSON.stringify({ ...initial, quote: { ...initial.quote, clientVersion: "ant 0.4.0" } }));
  assert.match(revalidateApproval(gatePath, initial, "a".repeat(64), GOOD_QUOTE).error, /changed/);
});

test("bankUploadReceipt appends a durable upload row when an older edition has none", () => {
  const receipt = { uploadedAt: "2026-10-02T00:00:00Z", result: { address: "public" }, artifactSha256: "a".repeat(64) };
  const edition = { artifact: { tarSha256: "a".repeat(64) }, progression: [{ state: "quoted" }] };
  bankUploadReceipt(edition, receipt);
  assert.equal(edition.progression.filter((p) => p.state === "uploaded").length, 1);
  assert.equal(edition.progression.at(-1).artifactSha256, receipt.artifactSha256);
});

test("edition-specific receipts never overwrite or absorb another artifact's receipt", () => {
  const root = join(tmpdir(), "receipt-root");
  const a = "a".repeat(64);
  const b = "b".repeat(64);
  assert.notEqual(receiptPathForArtifact(a, root), receiptPathForArtifact(b, root));
  assert.throws(() => receiptPathForArtifact("bad", root), /sha256 is invalid/);
  const receipt = { uploadedAt: "2026-10-02T00:00:00Z", result: {}, artifactSha256: a };
  assert.throws(() => bankUploadReceipt({ artifact: { tarSha256: b }, progression: [] }, receipt), /cross-edition/);
  const created = bankUploadReceipt(null, receipt, GATE_SCHEMA("APPROVED", a));
  assert.equal(created.schema, "skaists.eternalization-receipt/2");
  assert.equal(created.artifact.tarSha256, a);
  assert.equal(created.progression[0].state, "uploaded");
});
