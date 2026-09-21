// bpay document/evidence layer — executable proof of the honesty laws.
// Fixtures are SYNTHETIC and labeled so (measured-states law: no synthetic
// projection may be labeled measured). Proves:
//   - an invoice builds from a real-shaped live plan and carries the
//     authorization ceiling, plan identity, and wallet action;
//   - planDigest is order-stable (payment order is not identity);
//   - a quote ABOVE the ceiling refuses to become an invoice (gate, not note);
//   - there is NO path to a receipt without settlement evidence;
//   - validators refuse conflation (settled-state claims without evidence);
//   - reconcile catches a ceiling breach and confirms a clean settlement;
//   - clear-signing language for payForQuotes stays UNVERIFIED in-artifact.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVE_CONTEXT, INVOICE_SCHEMA, RECEIPT_SCHEMA,
  buildInvoice, validateInvoice, buildReceipt, validateReceipt, reconcile, planDigest
} from "./bpay.mjs";

// synthetic plan in the exact shape antd-bridge returns (SIMULATED — the real
// ones live in the proof run receipts, not in tests)
const plan = (over = {}) => Object.assign({
  upload_id: "up-1789627481303",
  total_chunks: 24,
  already_stored: 0,
  payment_type: "wave_batch",
  total_amount_atto: "1979733840820312500",
  data_map_address: "0x5250aa2f8279656ae571caab0fba2f89b5cedddddfe9938aa07c07bbcbcacf81", // PUBLIC-CONSTANT public chain data
  artifact_sha256: "fec5fba8360d9de211c3b6c5966e93bc2462133099f651891d500b6a2ea98b9b", // PUBLIC-CONSTANT public chain data
  artifact_bytes: 80998400,
  payments: Array.from({ length: 24 }, (_, i) => ({
    quote_hash: "0x" + String(i + 1).padStart(64, "0"),
    rewards_address: "0x" + String(i + 1).padStart(40, "0"),
    amount_atto: "82488826700921875"
  })),
  note: "SIMULATED fixture"
}, over);

test("invoice builds from a live-plan shape and binds the ceremony facts", () => {
  const inv = buildInvoice(plan(), ARCHIVE_CONTEXT, "2026-09-17T12:00:00.000Z");
  assert.equal(inv.schema, INVOICE_SCHEMA);
  assert.equal(inv.invoiceId, "inv-up-1789627481303");
  assert.equal(inv.subject.archive.files, 20537);
  assert.equal(inv.subject.encryptedChunks, 24);
  assert.equal(inv.authorization.ceiling.maxStorageANT, "3.2");
  assert.equal(inv.authorization.quoteWithinCeiling, true);
  assert.equal(inv.state, "issued");
  assert.equal(inv.states.settlement, "not-yet");
  assert.match(inv.walletAction.clearSigning.payForQuotes, /UNVERIFIED/);
  assert.equal(validateInvoice(inv), true);
  // JSON round-trip (the artifact is a document)
  assert.equal(validateInvoice(JSON.parse(JSON.stringify(inv))), true);
});

test("a recovered plan is labeled as the original authorization", () => {
  const inv = buildInvoice(plan({ recovered_from: { original_upload_id: "up-1", recovery_count: 1, fresh_quotes_discarded: 24 } }));
  assert.match(inv.quote.persistence.law, /RECOVERED/);
  assert.equal(inv.states.quote, "quoted (recovered original)");
});

test("planDigest is stable under payment reordering", () => {
  const a = plan();
  const b = plan();
  b.payments = [...b.payments].reverse();
  assert.equal(planDigest(a), planDigest(b));
  // and differs when quotes differ (the P1 lesson: live quotes vary)
  const c = plan();
  c.payments[0].quote_hash = "0x" + "f".repeat(64);
  assert.notEqual(planDigest(a), planDigest(c));
});

test("a quote above the authorization ceiling REFUSES to invoice", () => {
  const over = plan({ total_amount_atto: "4000000000000000000" }); // 4.0 ANT > 3.2
  assert.throws(() => buildInvoice(over), /exceeds the authorization ceiling/);
});

test("no settlement evidence → no receipt (the law as code)", () => {
  const inv = buildInvoice(plan());
  assert.throws(() => buildReceipt({}), /no settlement evidence, no receipt/);
  assert.throws(() => buildReceipt({ settledAt: "x", invoiceId: inv.invoiceId }), /missing/);
  // an invoice alone never becomes a receipt
  assert.throws(() => buildReceipt({ ...inv }), /missing: settledAt/);
});

test("validators refuse state conflation", () => {
  const inv = buildInvoice(plan());
  const bad = JSON.parse(JSON.stringify(inv));
  bad.states.settlement = "settled"; // claims money moved; invoice says issued
  assert.throws(() => validateInvoice(bad), /conflation/);
  const badSettled = JSON.parse(JSON.stringify(inv));
  badSettled.state = "settled"; // settled invoice without a receipt binding
  assert.throws(() => validateInvoice(badSettled), /must name its receipt/);
});

test("receipt builds only from full evidence and reconciles clean", () => {
  const inv = buildInvoice(plan());
  const evidence = {
    settledAt: "2026-09-17T13:00:00.000Z",
    invoiceId: inv.invoiceId,
    planDigest: inv.quote.planIdentity.digest,
    totalSettledAtto: inv.quote.lineItems[0].amountAtto,
    txRefs: [{ hash: "0xabc", chain: "arbitrum" }],
    gasUsedWei: "150000000000000",
    finality: "SIMULATED: finalized",
    dataMapAddress: inv.quote.planIdentity.dataMapAddress,
    chunksStored: 24,
    artifactSha256: inv.quote.planIdentity.artifactSha256,
    uploaded: true, uploadedAt: "2026-09-17T13:05:00.000Z",
    retrieved: false, hashVerified: false
  };
  const rec = buildReceipt(evidence);
  assert.equal(rec.schema, RECEIPT_SCHEMA);
  assert.equal(rec.state, "settled"); // settled but NOT yet "preserved" (no retrieval)
  assert.equal(rec.verification.retrieved.state, "not-yet");
  assert.equal(validateReceipt(rec), true);
  const outcome = reconcile(inv, rec);
  assert.equal(outcome.verdict, "reconciled");
  assert.equal(rec.reconciliation.verdict, "reconciled");
});

test("reconcile catches a ceiling breach (authorized boundary crossed)", () => {
  const inv = buildInvoice(plan());
  const rec = buildReceipt({
    settledAt: "2026-09-17T13:00:00.000Z",
    invoiceId: inv.invoiceId,
    planDigest: inv.quote.planIdentity.digest,
    totalSettledAtto: "4000000000000000000", // over the 3.2 ANT ceiling
    txRefs: [{ hash: "0xabc", chain: "arbitrum" }],
    gasUsedWei: "1",
    finality: "SIMULATED: finalized"
  });
  const outcome = reconcile(inv, rec);
  assert.equal(outcome.verdict, "breach");
  assert.ok(outcome.breaches.includes("settled ≤ authorization ceiling"));
});

test("reconcile catches a plan-identity mismatch (wrong plan settled)", () => {
  const inv = buildInvoice(plan());
  const rec = buildReceipt({
    settledAt: "2026-09-17T13:00:00.000Z",
    invoiceId: inv.invoiceId,
    planDigest: inv.quote.planIdentity.digest,
    totalSettledAtto: "1000000000000000000",
    txRefs: [{ hash: "0xabc", chain: "arbitrum" }],
    gasUsedWei: "1",
    finality: "SIMULATED: finalized"
  });
  rec.paid.planDigest = "sha256:" + "0".repeat(64); // not the invoiced plan
  const outcome = reconcile(inv, rec);
  assert.equal(outcome.verdict, "breach");
  assert.ok(outcome.breaches.includes("plan identity match"));
});
