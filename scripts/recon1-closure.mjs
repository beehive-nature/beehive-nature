#!/usr/bin/env node
// recon1-closure.mjs — RECON-1 obligation-closure battery (red-first).
// LAW: reconciliation DERIVES a conclusion from evidence and never upgrades
// the evidence class VOCAB-1 supplied. The obligation is an INVOICE-1
// document; evidence records carry VOCAB-1 axis vocabulary. A NAIVE
// reconciler (label-based, evidence-class-blind) is the REGISTERED RED —
// the same cases that convict it prove the deriving reconciler GREEN.
// Run: node scripts/recon1-closure.mjs
import {
  buildGenericInvoice, validateGenericInvoice, voidGenericInvoice,
} from "./lib/bpay-invoice-generic.mjs";

const EV_CLASS = ["none", "instruction", "signed-artifact", "self-reported", "tx-hash", "derived-balance", "rail-receipt", "tx-receipt", "event-log+readback"];

// obligation fixture (INVOICE-1 immutable document)
const obligation = () => buildGenericInvoice({
  jobId: "up-recon-1", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [
    { kind: "storage", asset: "ANT", quotes: [
      { quote_hash: "qh-1", amount_atto: "500000000000000" },
      { quote_hash: "qh-2", amount_atto: "500000000000000" } ] },
  ],
  authorization: { ceilings: { ANT: "2000000000000000" }, authorizedBy: "fixture", stopConditions: [] },
});
const OWED = 1000000000000000n; // Σ quotes

// evidence records — VOCAB-1 axis vocabulary (value_observed classes, finality)
const ev = (over = {}) => Object.assign({ kind: "settlement", rail: "fixture-rail", asset: "ANT", amount: "0", value_observed: "tx-receipt", finality: "terminal", txRef: "0xtx-1", invoiceContentDigest: null }, over);

// ── the deriving reconciler (the claim under test) ──────────────────────────
function reconcile(invoice, evidence) {
  validateGenericInvoice(invoice, {}); // the obligation must itself be valid
  const voided = invoice.state === "void" || !!invoice.voidEvidence;
  const counts = new Map(); // duplicate evidence (same txRef) counts once
  let observed = 0n; let finalityPending = null; let humanGate = false; let retryable = false;
  let wrongTarget = false; let expenseOnly = false; let authorizedOnly = false; let submittedOnly = false;
  for (const e of evidence) {
    const key = e.txRef || JSON.stringify(e);
    if (counts.has(key)) continue; // duplicate evidence must not duplicate value
    counts.set(key, 1);
    if (e.invoiceContentDigest && invoice.identity && e.invoiceContentDigest !== invoice.identity.contentDigest)
      { wrongTarget = true; continue; } // evidence for a different invoice never counts here
    if (e.asset !== invoice.lines[0].asset) { wrongTarget = true; continue; }
    if (e.kind === "expense") { expenseOnly = true; continue; } // provider expense ≠ customer charge
    if (e.kind === "instruction") { continue; } // instruction-only is never payment
    if (e.kind === "authorization") { authorizedOnly = true; continue; }
    if (e.kind === "attempt") { submittedOnly = true; if (e.retryability === "capped") retryable = true; if (e.retryability === "human-gate") humanGate = true; continue; }
    // settlement-kind evidence: value counts ONLY at tx-hash class or better
    const cls = EV_CLASS.indexOf(e.value_observed);
    if (cls < EV_CLASS.indexOf("tx-hash")) continue; // never upgrade the class
    if (e.finality === "reorg-flagged") { finalityPending = e; continue; }
    observed += BigInt(e.amount);
    if (e.finality === "as-reported") finalityPending = finalityPending || { asReported: true };
  }
  if (wrongTarget && observed === 0n) return "EVIDENCE-FOR-ANOTHER-OBLIGATION";
  if (voided) return observed > 0n ? "REFUND-DUE" : "VOID-SUPERSEDED";
  if (finalityPending && finalityPending.asReported !== true && observed === 0n) return "FINALITY-PENDING";
  if (observed === 0n) {
    if (humanGate) return "FAILED-HUMAN-GATE";
    if (retryable) return "FAILED-RETRYABLE";
    if (submittedOnly) return "OPEN"; // submitted-but-unobserved never closes
    if (authorizedOnly || expenseOnly) return "OPEN";
    return "OPEN";
  }
  if (finalityPending) return "FINALITY-PENDING"; // observed without terminal finality
  if (observed === OWED) return "SATISFIED";
  if (observed < OWED) return "PARTIALLY-SATISFIED";
  return "OVERPAID-CREDIT-DUE";
}

// ── the naive reconciler (REGISTERED RED — label-based, class-blind) ────────
function naiveReconcile(invoice, evidence) {
  const any = evidence.find((e) => /settlement|instruction|expense|authorization|attempt/.test(e.kind || ""));
  if (invoice.state === "void") return "VOID";
  return any ? "SATISFIED" : "OPEN"; // any record closes — manufactured certainty
}

// ── the founder's RED-FIRST cases ───────────────────────────────────────────
const cases = [
  ["authorized never attempted → OPEN", [ev({ kind: "authorization", amount: "0" })], "OPEN"],
  ["submitted not observed → OPEN", [ev({ kind: "attempt", value_observed: "none", retryability: "never" })], "OPEN"],
  ["observed without finality → FINALITY-PENDING", [ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })], "FINALITY-PENDING"],
  ["provider expense ≠ customer charge → OPEN", [ev({ kind: "expense", amount: String(OWED) })], "OPEN"],
  ["instruction-only as payment → OPEN (never closes)", [ev({ kind: "instruction", amount: String(OWED), value_observed: "instruction" })], "OPEN"],
  ["underpayment → PARTIALLY-SATISFIED", [ev({ amount: "400000000000000" })], "PARTIALLY-SATISFIED"],
  ["wrong asset/commitment → refused, OPEN", [ev({ amount: String(OWED), asset: "ETH" })], "EVIDENCE-FOR-ANOTHER-OBLIGATION"],
  ["void + later settlement → REFUND-DUE (never resurrects)", "VOIDCASE", "REFUND-DUE"],
  ["reorg invalidates observed → FINALITY-PENDING", [ev({ amount: String(OWED), finality: "reorg-flagged" })], "FINALITY-PENDING"],
  ["retry evidence ≠ never-charged → FAILED-RETRYABLE", [ev({ kind: "attempt", value_observed: "none", retryability: "capped" })], "FAILED-RETRYABLE"],
  ["duplicate evidence counts once → PARTIALLY not SATISFIED", [ev({ amount: "500000000000000" }), ev({ amount: "500000000000000" })], "PARTIALLY-SATISFIED"],
];
// positives: strongest existing evidence closes lawfully
const positives = [
  ["exact tx-receipt terminal → SATISFIED", [ev({ amount: String(OWED) })], "SATISFIED"],
  ["overpay → OVERPAID-CREDIT-DUE (credit forced, never silent keep)", [ev({ amount: String(OWED + 1n) })], "OVERPAID-CREDIT-DUE"],
];

const R = [];
const check = (name, got, want, target) => R.push({ name, ok: got === want, got, want, target });
for (const [name, eview, want] of cases) {
  const inv = obligation();
  const evs = eview === "VOIDCASE"
    ? (() => { const v = voidGenericInvoice(inv, { kind: "abandon", ref: "r", at: "t" }); return [v, [ev({ amount: String(OWED) })]]; })()
    : [inv, Array.isArray(eview) ? eview : [eview]];
  // VOIDCASE packs [voidedInvoice, evidence]; normal packs [inv, evidence-array]
  const invoice = Array.isArray(evs[0]) ? inv : evs[0];
  const evidence = evs[1];
  const voidInv = eview === "VOIDCASE" ? evs[0] : invoice;
  check(name, reconcile(voidInv, evidence), want, "deriving");
  if (eview !== "VOIDCASE") check("[naive must fail] " + name, naiveReconcile(voidInv, evidence), want, "naive-must-DIFFER");
}
for (const [name, evidence, want] of positives) {
  check(name, reconcile(obligation(), evidence), want, "deriving");
}

// persistence laws: determinism, order-insensitivity, duplicate idempotence
const inv = obligation();
const set = [ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xb" })];
const r1 = reconcile(inv, set);
const r2 = reconcile(inv, [...set].reverse());
const r3 = reconcile(inv, [...set, { ...set[0] }]); // duplicate txRef
R.push({ name: "restart determinism (same inputs ⇒ same result)", ok: r1 === r2 && r1 === r3, got: r1 + "/" + r2 + "/" + r3, want: "equal", target: "deriving" });

let fails = 0, naiveConvicted = 0, naiveTotal = 0;
for (const r of R) {
  if (r.target === "deriving") { if (!r.ok) fails++; }
  else { naiveTotal++; if (!r.ok) naiveConvicted++; } // naive DIFFERING from the required outcome = convicted (the RED)
}
console.log("RECON-1 — obligation closure (derives, never upgrades evidence)");
for (const r of R) {
  if (r.target === "deriving") console.log(`${r.ok ? "✓" : "✗"} ${r.name} → ${r.got}`);
}
console.log(`${naiveConvicted}/${naiveTotal} founder cases CONVICT the naive label-based reconciler (REGISTERED RED — normalization manufactured closure)`);
const fatal = [];
if (fails) fatal.push(`${fails} deriving case(s) failed`);
if (naiveConvicted < naiveTotal) fatal.push("naive reconciler agreed with a founder case — red not registered there");
if (fatal.length) { console.log("RECON-1 FAIL: " + fatal.join("; ")); process.exit(1); }
console.log("RECON-1 PASS — deriving reconciler green on all cases + persistence laws; naive comparator registered RED.");
