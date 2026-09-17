// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this primitive is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// recon-reconcile.mjs — the RECON-1 reconciliation PRIMITIVE (builder lane).
// The smallest generic derivation:
//
//     (INVOICE-1 generic invoice, VOCAB-1-classed evidence records)
//         → { conclusion, humanAction, basis, void }
//
// LOAD-BEARING LAW: reconciliation derives conclusions from evidence and may
// never manufacture a stronger certainty than its evidence supports.
// Concretely, and frozen by scripts/recon1-closure.mjs @72727c96:
//   • the evidence CLASS is never upgraded — value counts only at tx-hash
//     class or better on the frozen VOCAB-1 ladder; instruction-only,
//     self-reported and provider-expense records never close anything;
//   • only "terminal" finality decides; as-reported value is observed but
//     pending; reorg-flagged value counts AS OBSERVED with contested
//     finality (it was observed, history changed, it is not absent); an
//     unknown finality value fails CLOSED into FINALITY-PENDING;
//   • REFUND/CREDIT conclusions recursively require sufficiently FINAL
//     observed value — void + weak evidence is VOID-SUPERSEDED, never a
//     manufactured refund; void + exact terminal value is REFUND-DUE,
//     never resurrection;
//   • AWAITING-AUTHORIZATION is the HUMAN-ACTION class (valid invoice, no
//     records): the founder gesture surface, never FAILED and never
//     retryable-settlement;
//   • duplicate evidence never duplicates value: txRef is the identity of
//     a value movement (same txRef counts once, whatever else differs);
//   • owed re-derives from the invoice's CARRIED quote set per asset —
//     today's mutable pricing state is never required (VV-1
//     self-sufficiency); the derivation is pure: no clock, no network, no
//     filesystem, so the same durable invoice + evidence set derives the
//     same result across restarts and evidence orderings (the fold is
//     commutative by construction).
//
// ARCHITECTURE BOUNDARY: rails are consumed ONLY as VOCAB-1-classed evidence
// records (kind/asset/amount/value_observed/finality/retryability/txRef/
// invoiceContentDigest). No rail-native state machine is imported here —
// that boundary is VOCAB-1's product, not documentation.
//
// HUMAN-GESTURE LAW (FOUNDER-GESTURE-UX-LAW, docs/FOUNDER-GESTURE-UX-LAW.md):
// conclusions requiring human authority carry a REFERENCE to the MVP
// interaction surface capable of resolving them. Chat-based founder approval
// is never canonical authorization — an authorization record is paper-layer
// and never closes an obligation, however it is dressed. The default surface
// map follows the current economic direction (bPay/W@tch invoice Review &
// Pay; wallet/Trezor confirmation where applicable); deployments may
// substitute their own surface map via opts.surfaces, but never remove it.
// The surface is a reference, not UI — building the interface is another
// seat's lane.
import { canonicalize, validateGenericInvoice } from "./bpay-invoice-generic.mjs";

export const RECON_CONCLUSIONS = [
  "AWAITING-AUTHORIZATION", // HUMAN-ACTION class: valid/live payable obligation, authorization absent
  "OPEN",                   // insufficient evidence of value movement
  "FINALITY-PENDING",       // value observed but finality insufficient or contested
  "PARTIALLY-SATISFIED",    // sufficiently evidenced value below obligation
  "SATISFIED",              // sufficiently evidenced exact closure
  "OVERPAID-CREDIT-DUE",    // sufficiently final observed excess value (credit forced, never silent keep)
  "REFUND-DUE",             // sufficiently final observed value against a no-longer-valid obligation
  "FAILED-RETRYABLE",       // evidence proves failure and permits retry
  "FAILED-HUMAN-GATE",      // failure whose retry passes a human gate
  "VOID-SUPERSEDED",        // voided obligation, nothing observed — dead, never resurrected
  "EVIDENCE-FOR-ANOTHER-OBLIGATION", // evidence names a different invoice/asset: refused
];

// The frozen VOCAB-1 evidence-class ladder (recon1-closure.mjs EV_CLASS,
// sha-pinned by the proof battery). Value counts only from tx-hash upward.
export const EVIDENCE_CLASS_LADDER = [
  "none", "instruction", "signed-artifact", "self-reported", "tx-hash",
  "derived-balance", "rail-receipt", "tx-receipt", "event-log+readback",
];
const MIN_OBSERVED_CLASS = "tx-hash";
const MIN_OBSERVED_RANK = EVIDENCE_CLASS_LADDER.indexOf(MIN_OBSERVED_CLASS);

// Default human-gesture surface references (the mission's current economic
// direction). AWAITING-AUTHORIZATION resolves through the bPay/W@tch
// invoice Review & Pay surface with wallet/Trezor confirmation where
// applicable; refund/credit issuance is an outbound-value gesture and rides
// the same surface family.
export const DEFAULT_HUMAN_SURFACES = {
  "AWAITING-AUTHORIZATION": {
    surface: "bpay-invoice-review-pay",
    label: "bPay → Invoice → Review & Pay (wallet/Trezor confirmation where applicable)",
  },
  "FAILED-HUMAN-GATE": {
    surface: "bpay-invoice-review-pay",
    label: "bPay → Invoice → Review & Pay (re-approval through the product surface, never chat)",
  },
  "REFUND-DUE": {
    surface: "bpay-refund-issuance",
    label: "bPay → Invoice → Refund issuance (Review & Pay family; wallet/Trezor confirmation)",
  },
  "OVERPAID-CREDIT-DUE": {
    surface: "bpay-credit-issuance",
    label: "bPay → Invoice → Credit issuance (Review & Pay family; wallet/Trezor confirmation)",
  },
};

const ATTO_RE = /^\d+$/;

// ── the derivation ──────────────────────────────────────────────────────────
// invoice: an INVOICE-1 generic document (validated first; opts.invoice
// forwards validator options — e.g. { expectedDigest } against a durable
// anchor on restart reload).
// evidence: VOCAB-1-classed records. Recognized fields: kind ("settlement"
// default | "attempt" | "authorization" | "instruction" | "expense"),
// asset, amount (decimal atto-string), value_observed (ladder class),
// finality ("terminal" | "as-reported" | "reorg-flagged" | …), retryability
// ("unbounded"|"capped"|"human-gate"|"never"), txRef (value-movement
// identity), invoiceContentDigest (which invoice the record names).
export function reconcileObligation(invoice, evidence, opts = {}) {
  validateGenericInvoice(invoice, opts.invoice || {});
  if (!Array.isArray(evidence)) throw new Error("evidence must be an array of VOCAB-1-classed records");

  const voided = invoice.state === "void" || !!invoice.voidEvidence;

  // owed re-derives from the CARRIED quote set, per asset, offline
  const owed = new Map();
  for (const line of invoice.lines) {
    owed.set(line.asset, (owed.get(line.asset) || 0n) + BigInt(line.amountAtto));
  }

  // fold the evidence — commutative: sums, flags and a dedup key-set
  const seenKeys = new Set();
  const observed = new Map(); // asset → bigint
  let totalObserved = 0n;
  let finalityPending = false;  // observed value awaits finality (as-reported/unknown)
  let finalityContested = false; // observed value whose history changed (reorg-flagged)
  let wrongTarget = false, humanGate = false, retryable = false;
  const refused = { wrongTarget: 0, expense: 0, instruction: 0, authorization: 0, attempt: 0, belowClass: 0 };
  let countedRecords = 0, duplicates = 0;

  for (const e of evidence) {
    if (!e || typeof e !== "object") throw new Error("each evidence record is an object");
    // duplicate law: txRef is the identity of a value movement; records
    // without one dedupe on canonical content (key-order independent)
    const key = (typeof e.txRef === "string" && e.txRef) ? "tx:" + e.txRef
      : "canon:" + JSON.stringify(canonicalize(e));
    if (seenKeys.has(key)) { duplicates++; continue; }
    seenKeys.add(key);

    if (e.invoiceContentDigest && e.invoiceContentDigest !== invoice.identity.contentDigest)
      { wrongTarget = true; refused.wrongTarget++; continue; } // names another invoice
    if (!owed.has(e.asset)) { wrongTarget = true; refused.wrongTarget++; continue; } // names no line here
    if (e.kind === "expense") { refused.expense++; continue; }   // provider ledger side — never a customer charge
    if (e.kind === "instruction") { refused.instruction++; continue; } // zero value attempted
    if (e.kind === "authorization") { refused.authorization++; continue; } // paper layer — never closes
    if (e.kind === "attempt") {
      refused.attempt++;
      if (e.retryability === "capped") retryable = true;
      if (e.retryability === "human-gate") humanGate = true;
      continue; // submitted ≠ observed
    }
    // observation record: never upgrade the class — below tx-hash the
    // record asserts nothing about value
    const rank = EVIDENCE_CLASS_LADDER.indexOf(e.value_observed);
    if (rank < MIN_OBSERVED_RANK) { refused.belowClass++; continue; }
    if (e.amount === undefined || !ATTO_RE.test(String(e.amount)))
      throw new Error(`evidence ${e.txRef || "(no txRef)"}: amount must be a decimal atto-string — refuse to reconcile ambiguous value`);
    const amount = BigInt(e.amount);
    if (amount === 0n) continue; // a zero-value observation decides nothing
    countedRecords++;
    observed.set(e.asset, (observed.get(e.asset) || 0n) + amount);
    totalObserved += amount;
    if (e.finality === "reorg-flagged") finalityContested = true; // observed; history changed
    else if (e.finality !== "terminal") finalityPending = true;  // fail closed: only terminal is final
  }

  const pending = finalityPending || finalityContested;
  const surfaces = { ...DEFAULT_HUMAN_SURFACES, ...(opts.surfaces || {}) };
  const finish = (conclusion) => ({
    conclusion,
    humanAction: surfaces[conclusion] || null, // exactly the human-authority conclusions carry a surface
    basis: {
      owed: Object.fromEntries([...owed].map(([a, v]) => [a, v.toString()])),
      observed: Object.fromEntries([...owed].map(([a]) => [a, (observed.get(a) || 0n).toString()])),
      finality: finalityContested ? "contested" : finalityPending ? "pending" : totalObserved > 0n ? "terminal" : null,
      countedRecords, duplicates, refused,
    },
    void: voided && invoice.voidEvidence
      ? { kind: invoice.voidEvidence.kind, successorJobId: invoice.voidEvidence.successorJobId || null }
      : null,
  });

  if (voided) {
    // the void branch returns BEFORE any value comparison can run — a dead
    // obligation is never resurrected by money arriving late
    if (totalObserved === 0n) return finish("VOID-SUPERSEDED");
    if (pending) return finish("FINALITY-PENDING"); // refund needs SUFFICIENT FINAL observed value
    return finish("REFUND-DUE"); // terminally-observed value moved against a dead obligation is owed back
  }
  if (wrongTarget && totalObserved === 0n) return finish("EVIDENCE-FOR-ANOTHER-OBLIGATION");
  if (totalObserved === 0n) {
    if (evidence.length === 0) return finish("AWAITING-AUTHORIZATION"); // HUMAN-ACTION class — never FAILED, never retryable
    if (humanGate) return finish("FAILED-HUMAN-GATE");
    if (retryable) return finish("FAILED-RETRYABLE");
    return finish("OPEN"); // authorized/submitted/expensed/instructed never close
  }
  if (pending) return finish("FINALITY-PENDING"); // SATISFIED/PARTIAL/OVERPAID all need final observed value
  let over = false, under = false;
  for (const [asset, owedAtto] of owed) {
    const seen = observed.get(asset) || 0n;
    if (seen > owedAtto) over = true;
    if (seen < owedAtto) under = true;
  }
  if (over) return finish("OVERPAID-CREDIT-DUE"); // excess forces credit — never silently kept, never cross-netted
  if (under) return finish("PARTIALLY-SATISFIED");
  return finish("SATISFIED");
}
