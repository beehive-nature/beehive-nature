# WAKE — bPay/W@tch UI seat (RECON-1 is infrastructure; the missing screen is now the work)

**Date:** 2026-09-17 · **From:** RECON-1 builder→oracle lane, merged · **Main:** `9a774bec`
**Founder routing (verbatim intent):** stop building backend economics; the
next owner is the bPay/W@tch UI seat. Not another generic economic primitive.

## The spine that now exists (all merged, verified from main)

real quote → PricingCommitment → INVOICE-1 → RECON-1 →
`AWAITING-AUTHORIZATION` → **`SURFACE_MISSING: bPay → Invoice → Review & Pay`**

- INVOICE-1 generic: `scripts/lib/bpay-invoice-generic.mjs` (carried quotes,
  content-addressed identity, evidenced void/settled terminality).
- RECON-1 primitive: `scripts/lib/recon-reconcile.mjs` (pure derivation;
  evidence classes never upgraded; refunds/credits only from sufficiently
  final observed value; duplicates/ordering/restart laws proven).
- Verifier + sabotage teeth: `scripts/recon1-oracle-verify.mjs`
  (+ `--sabotage-selftest`), CI-wired — all green from merged main.

## THE JOB (deliberately narrow, founder words preserved)

> Render one real, machine-bound invoice and let loVis understand it.
> Do not enable spending until the surface itself passes review.

**First real acceptance object: the Bux video.** Target screen:

**Ready for you**
`try_autonomi.mp4`
`214,091,829 bytes`
`X ANT`
`quote expires …`
**Review & Pay**

— and it refuses to move another inch until the founder actually uses it.

## Phases (constitutional transition tested incrementally)

- **Phase A** — quote/invoice visible and understandable.
- **Phase B** — exact commitment binding proven.
- **Phase C** — Review & Pay button becomes `SURFACE_READY`.
- **Phase D** — the founder's button press creates authorization.
- **Phase E** — Trezor confirmation.
- **Phase F** — settlement/reconciliation updates the UI from evidence.

No terminal fallback. No "approved" in chat.

## Load-bearing constraints for the UI seat

1. **Authorization law:** the surface creates authorization through the
   product gesture (Phase D); chat text is never canonical. RECON-1 has no
   AUTHORIZED conclusion — the UI never needs one either; it renders
   AWAITING-AUTHORIZATION until evidence records arrive.
2. **Per-asset facts are authoritative in rendering.** The founder's
   preserved nuance: for `owed 2 ANT + 0.001 ETH` vs `observed 3 ANT + 0 ETH`
   the founder must see *"Invoice not satisfied — ANT: overpaid by 1 ANT →
   credit due; ETH: unpaid 0.001 ETH"*. The top-level conclusion
   (OVERPAID-CREDIT-DUE roll-up) is routing/attention, NEVER a rendering of
   the invoice as otherwise economically closed. RECON-1's
   `basis.{owed,observed}` per-asset maps are the render source.
3. **SURFACE_READY discipline:** `scripts/recon1-oracle-verify.mjs` check A9c
   is a standing tripwire — the moment a Review & Pay route appears in
   `surfaces/`, the oracle verifier FAILS until a SURFACE_READY re-ruling
   lands WITH independent live exercise. Build the route, then exercise it,
   then re-rule (Phase C's proof, not a label change).
4. **Evidence honesty:** UI states come from RECON-1 results only
   (PAID/PARTIAL/FAILED/REFUND DUE strictly on evidence); quote figures come
   from the INVOICE-1 carried quote set, never today's mutable pricing.

## NEXT OWNER

bPay/W@tch UI seat (Phase A first: one real, machine-bound, understandable
invoice for the Bux video — nothing spendable yet).

## HUMAN INTERACTION

NONE for this handoff. The first human interaction this lane exists to
enable is the founder pressing **Review & Pay** on the Bux invoice —
through the surface, with wallet/Trezor, when Phase C/D earn it.
