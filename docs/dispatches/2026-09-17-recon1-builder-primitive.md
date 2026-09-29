# RECON-1 BUILDER — the reconciliation primitive proven against the frozen oracle

**Date:** 2026-09-17 · **Seat:** zCode (builder) · **Base:** main @72727c96
**Mission:** implement the smallest generic reconciliation primitive that
satisfies the frozen RECON-1 oracle; never modify or weaken the oracle.

## STATE

BUILT + GREEN LOCALLY. The primitive is
`scripts/lib/recon-reconcile.mjs`; its proof battery is
`scripts/recon1-primitive.mjs` (CI-wired beside the family). The frozen
oracle `scripts/recon1-closure.mjs` is byte-identical to @72727c96
(sha256 `db035b…95432`, pinned in the battery — any future edit to the
frozen file fails the battery hard). PR open for the economic/oracle
seat's independently written verification pass.

## CLAIM

`reconcileObligation(invoice, evidence, opts?)` is a PURE derivation
`(INVOICE-1 generic invoice, VOCAB-1-classed evidence records) →
{ conclusion, humanAction, basis, void }` that:

- never upgrades the supplied evidence class — value counts only at
  tx-hash class or better on the frozen VOCAB-1 ladder (`EV_CLASS`
  verbatim, asserted against the frozen bytes each run);
- treats only `"terminal"` finality as deciding; `as-reported` and
  reorg-flagged value is observed-but-pending (reorg-flagged counts the
  value AS OBSERVED with contested finality); an UNKNOWN finality value
  fails closed into FINALITY-PENDING — stricter than the frozen inline
  reference on an untested edge, in the conservative direction;
- derives REFUND/CREDIT only from sufficiently FINAL observed value
  (void + weak → VOID-SUPERSEDED; void + pending/reorg → FINALITY-
  PENDING; void + terminal observed → REFUND-DUE, never resurrection);
- keeps AWAITING-AUTHORIZATION as the HUMAN-ACTION class (valid invoice,
  zero records — never FAILED, never retryable-settlement);
- refuses wrong-asset and wrong-commitment evidence
  (EVIDENCE-FOR-ANOTHER-OBLIGATION), keeps provider expense, instruction
  artifacts and authorization records on the paper layer (never close);
- dedupes on txRef as the identity of a value movement (same txRef
  counts once whatever else differs); fold is commutative by
  construction (order-independent);
- derives owed per asset from the invoice's CARRIED quote set — current
  pricing state is never required (proven with pricing mutated then
  deleted in a fresh child process);
- rolls multi-asset obligations up conservatively: any final excess →
  OVERPAID-CREDIT-DUE (never silently kept, never cross-netted); else
  any shortfall → PARTIALLY-SATISFIED; else SATISFIED — with per-asset
  basis (owed/observed/finality) always carried.

## RED → GREEN EVIDENCE

- RED (captured before the primitive existed): battery ran, validated
  the frozen pin + extraction machinery, then failed exactly at
  `Cannot find module …/lib/recon-reconcile.mjs` — exit 1.
- GREEN: all 23 checks pass, exit 0. The battery does NOT trust a copied
  case list — it extracts the frozen battery's own `cases`/`positives`/
  `VOID_EV`/persistence set AT RUNTIME from the sha256-pinned frozen
  bytes and runs them against the primitive (F1: 18/18), cross-checks
  the frozen file's own inline reference reconciler (F2: agrees
  case-for-case), and re-convicts the naive label comparator through
  the same harness (F3: 12/12 refusal cases).
- TEETH (sabotage control): pointing the battery at a deliberately
  naive label-based reconciler fails 16 checks cleanly, exit 1 — the
  battery cannot be satisfied by the seductive shape.

## PERSISTENCE EVIDENCE

- F1 frozen persistence set: two half-payments → SATISFIED; order
  reversed → SATISFIED; duplicate appended → SATISFIED.
- M1b: fresh child process loads the serialized invoice + evidence with
  a decoy `rates.json` mutated in BEFORE the load — same conclusion
  (PARTIALLY-SATISFIED, observed 4.0e14). Pricing state not required.
- M3a: exhaustive 24 permutations of a mixed 4-record evidence set →
  one conclusion. M3b: 1×/2×/5× copies of one record set → identical
  conclusion (duplicates never duplicate value). M3c: the full result
  object survives a JSON serialization round-trip byte-stable.
- Structurally: the primitive reads no clock, network, filesystem or
  environment (asserted M4b) — restart from the same durable invoice +
  evidence set derives the same result.

## HUMAN-GESTURE SURFACE MAPPING

Exactly the four human-authority conclusions carry `humanAction`
(asserted M2); all others carry `null`:

| conclusion | surface reference | label |
|---|---|---|
| AWAITING-AUTHORIZATION | `bpay-invoice-review-pay` | bPay → Invoice → Review & Pay (wallet/Trezor confirmation where applicable) |
| FAILED-HUMAN-GATE | `bpay-invoice-review-pay` | re-approval through the product surface, never chat |
| REFUND-DUE | `bpay-refund-issuance` | bPay → Invoice → Refund issuance (Review & Pay family) |
| OVERPAID-CREDIT-DUE | `bpay-credit-issuance` | bPay → Invoice → Credit issuance (Review & Pay family) |

These are REFERENCES to the MVP interaction surface, not UI — no
existing interface owns Review & Pay yet (checked: no surface in
`s/` implements it), and the mission forbids building the complete UI
here. Chat-based founder approval is never canonical authorization:
an authorization record is paper-layer and never closes an obligation,
however it is dressed (asserted M1g — a full-amount authorization
record forged as tx-receipt evidence still derives OPEN). Deployments
may substitute surface maps via `opts.surfaces`; they cannot remove them.

## BOUNDARY NOT CROSSED

- No real payment; no wallet, key, or signing machinery in the primitive.
- No zGenealogy migration; no R20 redesign; no Gesture D / IF-1..5 /
  VV-2 / Jungle4 changes (none imported — asserted M4a).
- No direct rail-state imports: the primitive's ONLY import is
  `./bpay-invoice-generic.mjs` (INVOICE-1); rails arrive solely as
  VOCAB-1-classed evidence records — the boundary is consumption, not
  documentation.
- No VOCAB-1 or INVOICE-1 edits to make RECON pass: both artifacts and
  the frozen oracle verified byte-identical to @72727c96.
- The frozen oracle was never edited; the battery pins its sha256 and
  extracts its case table read-only.

## CHANGED

- `scripts/lib/recon-reconcile.mjs` — NEW, the primitive (≈200 lines).
- `scripts/recon1-primitive.mjs` — NEW, the proof battery (F1–F3, M0–M4).
- `.github/workflows/tests.yml` — one step wired beside the family:
  `RECON-1 primitive builder proof (vs frozen oracle)`.

## NEXT OWNER

The economic/oracle seat, for the independently written verification
pass (the mission's return gate). Suggested probes for that pass: the
fail-closed finality edge (M1f) is STRICTER than the frozen inline
reference — confirm the stricter reading is wanted; the multi-asset
roll-up law (over forces credit even beside an exact asset, no
cross-netting) has no frozen precedent — confirm or pin; the surface
ids (`bpay-invoice-review-pay` etc.) are the MVP naming — bind them
when the bPay UI seat builds the real routes.

## FOUNDER ACTION SURFACE

None required for this merge — pure derivation, nothing live. The first
founder gesture this primitive ENABLES is already named by its results:
`AWAITING-AUTHORIZATION → bPay → Invoice → Review & Pay (wallet/Trezor)`.
