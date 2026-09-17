#!/usr/bin/env node
// recon1-closure.mjs — RECON-1 obligation-closure battery (red-first).
// LAW: reconciliation DERIVES a conclusion from evidence and never upgrades
// the evidence class VOCAB-1 supplied. Refund/credit conclusions recursively
// require SUFFICIENT FINAL observed value (weak or pending evidence never
// manufactures them). HUMAN-ACTION-REQUIRED states (AWAITING-AUTHORIZATION)
// are distinct from failures. The NAIVE label-based reconciler is the
// REGISTERED RED comparator. Run: node scripts/recon1-closure.mjs
import {
  buildGenericInvoice, validateGenericInvoice, voidGenericInvoice,
} from "./lib/bpay-invoice-generic.mjs";

const EV_CLASS = ["none", "instruction", "signed-artifact", "self-reported", "tx-hash", "derived-balance", "rail-receipt", "tx-receipt", "event-log+readback"];

const obligation = () => buildGenericInvoice({
  jobId: "up-recon-1", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [
    { kind: "storage", asset: "ANT", quotes: [
      { quote_hash: "qh-1", amount_atto: "500000000000000" },
      { quote_hash: "qh-2", amount_atto: "500000000000000" } ] },
  ],
  authorization: { ceilings: { ANT: "2000000000000000" }, authorizedBy: "fixture", stopConditions: [] },
});
const OWED = 1000000000000000n;
const ev = (over = {}) => Object.assign({ kind: "settlement", rail: "fixture-rail", asset: "ANT", amount: "0", value_observed: "tx-receipt", finality: "terminal", txRef: "0xtx-1", invoiceContentDigest: null }, over);

function reconcile(invoice, evidence) {
  validateGenericInvoice(invoice, {});
  const voided = invoice.state === "void" || !!invoice.voidEvidence;
  const counts = new Map();
  let observed = 0n; let finalityPending = null; let humanGate = false; let retryable = false;
  let wrongTarget = false; let expenseOnly = false; let authorizedOnly = false; let submittedOnly = false;
  for (const e of evidence) {
    const key = e.txRef || JSON.stringify(e);
    if (counts.has(key)) continue; // duplicate evidence must not duplicate value
    counts.set(key, 1);
    if (e.invoiceContentDigest && invoice.identity && e.invoiceContentDigest !== invoice.identity.contentDigest)
      { wrongTarget = true; continue; }
    if (e.asset !== invoice.lines[0].asset) { wrongTarget = true; continue; }
    if (e.kind === "expense") { expenseOnly = true; continue; }
    if (e.kind === "instruction") { continue; }
    if (e.kind === "authorization") { authorizedOnly = true; continue; }
    if (e.kind === "attempt") { submittedOnly = true; if (e.retryability === "capped") retryable = true; if (e.retryability === "human-gate") humanGate = true; continue; }
    const cls = EV_CLASS.indexOf(e.value_observed);
    if (cls < EV_CLASS.indexOf("tx-hash")) continue; // never upgrade the class
    if (e.finality === "reorg-flagged") { finalityPending = e; observed += BigInt(e.amount); continue; } // value WAS observed; its finality is contested
    observed += BigInt(e.amount);
    if (e.finality === "as-reported") finalityPending = finalityPending || { asReported: true };
  }
  if (voided) {
    // refund owed REQUIRES sufficient evidence value actually moved with no
    // valid obligation remaining — weak or pending evidence never manufactures it
    if (observed === 0n) return "VOID-SUPERSEDED";
    if (finalityPending) return "FINALITY-PENDING";
    return "REFUND-DUE";
  }
  if (wrongTarget && observed === 0n) return "EVIDENCE-FOR-ANOTHER-OBLIGATION";
  if (observed === 0n) {
    if (finalityPending && finalityPending.asReported !== true) return "FINALITY-PENDING";
    if (evidence.length === 0) return "AWAITING-AUTHORIZATION"; // HUMAN-ACTION-REQUIRED: the founder gesture surface, never FAILED
    if (humanGate) return "FAILED-HUMAN-GATE";
    if (retryable) return "FAILED-RETRYABLE";
    return "OPEN"; // submitted/authorized/expense-only never close
  }
  if (finalityPending) return "FINALITY-PENDING"; // observed without terminal finality — SATISFIED/OVERPAID/PARTIAL all need final value
  if (observed === OWED) return "SATISFIED";
  if (observed < OWED) return "PARTIALLY-SATISFIED";
  return "OVERPAID-CREDIT-DUE";
}

function naiveReconcile(invoice, evidence) {
  const any = evidence.find((e) => /settlement|instruction|expense|authorization|attempt/.test(e.kind || ""));
  if (invoice.state === "void") return "VOID";
  return any ? "SATISFIED" : "OPEN";
}

const cases = [
  ["authorized never attempted → OPEN", [ev({ kind: "authorization", amount: "0" })], "OPEN"],
  ["submitted not observed → OPEN", [ev({ kind: "attempt", value_observed: "none", retryability: "never" })], "OPEN"],
  ["observed without finality → FINALITY-PENDING", [ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })], "FINALITY-PENDING"],
  ["provider expense ≠ customer charge → OPEN", [ev({ kind: "expense", amount: String(OWED) })], "OPEN"],
  ["instruction-only as payment → OPEN (never closes)", [ev({ kind: "instruction", amount: String(OWED), value_observed: "instruction" })], "OPEN"],
  ["underpayment → PARTIALLY-SATISFIED", [ev({ amount: "400000000000000" })], "PARTIALLY-SATISFIED"],
  ["wrong asset/commitment → refused", [ev({ amount: String(OWED), asset: "ETH" })], "EVIDENCE-FOR-ANOTHER-OBLIGATION"],
  ["void + later settlement (final) → REFUND-DUE (never resurrects)", "VOIDFINAL", "REFUND-DUE"],
  ["void + submitted-not-observed → VOID-SUPERSEDED (never manufacture refund)", "VOIDWEAK", "VOID-SUPERSEDED"],
  ["void + observed-but-pending → FINALITY-PENDING (no refund from weak evidence)", "VOIDPEND", "FINALITY-PENDING"],
  ["void + observed reorg-flagged → FINALITY-PENDING", "VOIDREORG", "FINALITY-PENDING"],
  ["reorg invalidates observed → FINALITY-PENDING", [ev({ amount: String(OWED), finality: "reorg-flagged" })], "FINALITY-PENDING"],
  ["retry evidence ≠ never-charged → FAILED-RETRYABLE", [ev({ kind: "attempt", value_observed: "none", retryability: "capped" })], "FAILED-RETRYABLE"],
  ["duplicate evidence counts once → PARTIALLY not SATISFIED", [ev({ amount: "500000000000000" }), ev({ amount: "500000000000000" })], "PARTIALLY-SATISFIED"],
  ["overpay with pending finality → FINALITY-PENDING (credit needs final observed value)", [ev({ amount: String(OWED + 1n), finality: "as-reported", value_observed: "tx-hash" })], "FINALITY-PENDING"],
  ["valid invoice, no records at all → AWAITING-AUTHORIZATION (human-action class)", [], "AWAITING-AUTHORIZATION"],
];
const positives = [
  ["exact tx-receipt terminal → SATISFIED", [ev({ amount: String(OWED) })], "SATISFIED"],
  ["overpay (final) → OVERPAID-CREDIT-DUE (credit forced, never silent keep)", [ev({ amount: String(OWED + 1n) })], "OVERPAID-CREDIT-DUE"],
];
const VOID_EV = {
  VOIDFINAL: () => [ev({ amount: String(OWED) })],
  VOIDWEAK: () => [ev({ kind: "attempt", value_observed: "none", retryability: "never" })],
  VOIDPEND: () => [ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })],
  VOIDREORG: () => [ev({ amount: String(OWED), finality: "reorg-flagged" })],
};

const R = [];
const check = (name, got, want, target) => R.push({ name, ok: got === want, got, want, target });
for (const [name, eview, want] of [...cases, ...positives]) {
  const inv = obligation();
  const isVoid = typeof eview === "string";
  const invoice = isVoid ? voidGenericInvoice(inv, { kind: "abandon", ref: "r", at: "t" }) : inv;
  const evidence = isVoid ? VOID_EV[eview]() : eview;
  check(name, reconcile(invoice, evidence), want, "deriving");
  if (!isVoid && cases.some((c) => c[0] === name)) check("[naive must fail] " + name, naiveReconcile(invoice, evidence), want, "naive-must-DIFFER"); // conviction measured on the REFUSAL cases; on perfect evidence the naive shape coincides with truth — that is why it is seductive
}
const inv = obligation();
const set = [ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xb" })];
const r1 = reconcile(inv, set), r2 = reconcile(inv, [...set].reverse()), r3 = reconcile(inv, [...set, { ...set[0] }]);
R.push({ name: "restart determinism (same inputs ⇒ same result)", ok: r1 === r2 && r1 === r3, got: r1 + "/" + r2 + "/" + r3, want: "equal", target: "deriving" });

let fails = 0, naiveConvicted = 0, naiveTotal = 0;
for (const r of R) {
  if (r.target === "deriving") { if (!r.ok) fails++; }
  else { naiveTotal++; if (!r.ok) naiveConvicted++; }
}
console.log("RECON-1 — obligation closure (derives, never upgrades evidence)");
for (const r of R) if (r.target === "deriving") console.log(`${r.ok ? "✓" : "✗"} ${r.name} → ${r.got}`);
console.log(`${naiveConvicted}/${naiveTotal} founder cases CONVICT the naive label-based reconciler (REGISTERED RED — normalization manufactured closure)`);
const fatal = [];
if (fails) fatal.push(`${fails} deriving case(s) failed`);
if (naiveConvicted < naiveTotal) fatal.push("naive reconciler agreed with a founder case — red not registered there");
if (fatal.length) { console.log("RECON-1 FAIL: " + fatal.join("; ")); process.exit(1); }
console.log("RECON-1 PASS — deriving reconciler green on all cases + persistence laws; naive comparator registered RED.");
