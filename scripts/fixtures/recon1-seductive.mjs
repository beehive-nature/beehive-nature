// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this fixture is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// recon1-seductive.mjs — the ORACLE SEAT'S OWN seductive reconciler
// ("the helpful accountant"), constructed independently for the RECON-1
// sabotage control (mission item 12). NOT production code; never imported
// by anything except scripts/recon1-oracle-verify.mjs --sabotage-selftest.
//
// The seduction, one shape: "the money story looks complete if you just
// total everything". It
//   • counts EVERY record carrying an amount — instruction, authorization,
//     attempt, expense, any class, any finality — at face value;
//   • dedupes nothing (duplicates double);
//   • collapses all assets into ONE pot against ONE total (implicit FX,
//     cross-netting: excess ANT satisfies missing ETH);
//   • treats every finality, however spelled, as final;
//   • manufactures REFUND-DUE from void + ANY amount-carrying record
//     (even an attempt that never moved value);
//   • mints an AUTHORIZED conclusion (chat intent as authorization) and
//     stamps SURFACE_READY on every human-action result (surface
//     availability claimed without a route);
//   • re-orders the evidence ladder so self-reported outranks tx-hash.
// If any verifier capable of reading stayed green against this, it reads
// nothing. Statically clean by design (no imports, no net/key/clock
// tokens) so conviction is purely behavioral.
export const RECON_CONCLUSIONS = [
  "AWAITING-AUTHORIZATION", "AUTHORIZED", "OPEN", "FINALITY-PENDING", "PARTIALLY-SATISFIED",
  "SATISFIED", "OVERPAID-CREDIT-DUE", "REFUND-DUE", "FAILED-RETRYABLE", "FAILED-HUMAN-GATE",
  "VOID-SUPERSEDED", "EVIDENCE-FOR-ANOTHER-OBLIGATION",
];
export const EVIDENCE_CLASS_LADDER = [
  "none", "tx-hash", "tx-receipt", "event-log+readback", "instruction", "self-reported",
  "derived-balance", "rail-receipt", "signed-artifact",
];
const READY = { surface: "bpay-invoice-review-pay", label: "SURFACE_READY — route live, founder may tap Pay now" };
export function reconcileObligation(invoice, evidence) {
  const totalOwed = invoice.lines.reduce((s, l) => s + BigInt(l.amountAtto), 0n);
  let pot = 0n;
  for (const e of evidence) if (e && e.amount && /^\d+$/.test(String(e.amount))) pot += BigInt(e.amount);
  if (invoice.state === "void") {
    return {
      conclusion: pot > 0n ? "REFUND-DUE" : "VOID-SUPERSEDED",
      humanAction: pot > 0n ? READY : null,
      basis: { owed: {}, observed: {}, finality: "terminal", countedRecords: evidence.length, duplicates: evidence.length, refused: {} },
      void: invoice.voidEvidence || null,
    };
  }
  let conclusion;
  if (evidence.some((e) => e?.kind === "authorization")) conclusion = "AUTHORIZED";
  else if (evidence.length === 0) conclusion = "AWAITING-AUTHORIZATION";
  else if (pot === 0n) conclusion = "OPEN";
  else if (pot === totalOwed) conclusion = "SATISFIED";
  else if (pot > totalOwed) conclusion = "SATISFIED"; // "we got enough in total" — the cross-netting smile
  else conclusion = "PARTIALLY-SATISFIED";
  return {
    conclusion,
    humanAction: conclusion === "AWAITING-AUTHORIZATION" || conclusion === "AUTHORIZED" ? READY : null,
    basis: { owed: { POT: totalOwed.toString() }, observed: { POT: pot.toString() }, finality: "terminal", countedRecords: evidence.length, duplicates: evidence.length, refused: {} },
    void: null,
  };
}
