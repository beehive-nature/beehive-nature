# bPay papers frontier — FIRST RETURN (2026-09-17)

SYNC → FRONTIER MAP → COLLISION CHECK performed against live repo/PR/branch
evidence (main @`22af64fb`, all open PRs and named branches inspected; nothing
assumed from this message).

## STATE

Gesture-D triggers unchanged (seat WAIT for deadlock-builder GREEN; IF-1..4
with Astra; VV-1 untouched, VV-2 unopened, Jungle4 untouched). This pass
worked ONLY the newly-granted generic economic frontier (bPay + bMeter +
pricing/POS/wallet artifacts) and CLAIMED one docs-only primitive:
**SPEC-BPAY-DOCS-1** — [docs/specs/SPEC-BPAY-DOCS-1.md](../specs/SPEC-BPAY-DOCS-1.md).

## CURRENT FRONTIER

- Main `22af64fb`; open PRs: #93 (Gesture-D routing — mine), #92 + #90
  (bKiMi BUG-002 / 1.4c harness repair), #79 (mission system), #80
  (vending/wallet personas), plus older cursor/codex drafts.
- The VV-1 RULING + builder order are NOT on main — frozen on
  `zcode/vv1-vending-pricing-2026-09-16`, its PricingCommitment builder still
  UNCLAIMED. The bpay-rail crate (R11–R20; R20 in build) lives on
  `codex/z2b-bpay-rail`. Deadlock-builder and zGenealogy have no PRs yet.

## EXISTING PRIMITIVES FOUND (the seven states)

1. **QUOTE — exists, deployed, lawed.** `rate_set.json` v2 (cost basis +
   tithe as its OWN line, `minted_at` + TTL 300s enforced by
   `rate_set_in_force`/`/v1/admit`, AV-2 D-proven); vending governed rate
   rows (basis + `tithe_bp` + upto; NotPriced refusal); bpay-rail
   `Rate{ratio, rate_set_ref, observed_at}`.
2. **PRICING COMMITMENT — spec'd + frozen, unbuilt.** VV-1's immutable,
   self-sufficient open-time commitment with restart/persistence acceptance
   tests, on the unmerged branch above. Owner: future PricingCommitment
   builder. NOT touched.
3. **INVOICE — MISSING as a first-class type.** Nearest artifacts are the
   meter's `settlement-instruction` and `prepaid-voucher` JSONs (explicitly
   "INSTRUCTION ONLY", baton fence) and the mission desk's budget
   calculator. Nothing binds {commitment, lines, authorization-ref, totals}
   into a possessable document.
4. **AUTHORIZATION — rich, owned.** EIP-3009 (x402 door), bpay-rail
   capability binding (R19; F1/F2 defects; R20 durability in build —
   workerb2), Permit2, wallet spend caps, vending upto ceilings.
5. **SETTLEMENT — exists per rail, owned.** vending opensess→settle
   (Jungle4), x402 facilitator, voucher_escrow (hash-chained, derived
   balances), LN/NWC (R13), bpay-rail compose.
6. **RECEIPT — domain-scoped only.** Meter receipts (hash-chained,
   idempotent, tithe line, `total_computed`); escrow events; door journal
   records; watchpay `receipt.rs` (strict evidence validation with trust
   classes — rail-specific); mission final reports (projected vs actual).
   NO generic receipt artifact; no downloadable human paper anywhere.
7. **RECONCILIATION — partial taxonomies, no obligation-level model.**
   Door journal (Settled/ReorgFlagged/FailedKeep/Unknown/ExpiredReleased +
   evidence-gated reconcile-down); bpay-rail LifecycleState
   (Intent/Staged/InFlight/Settled/Failed/Unknown) + RS-2 terminal matrix;
   AV-8 unknown-reconcile. **partial / overpay / refund / credit exist
   NOWHERE** — overpayment is refused by low-level laws but never
   reconciled as an obligation outcome.

**Accounting axes found:** cost-basis-vs-tithe separation is codified
(rate_set law: "never buried"; vending tithe conservation; meter computed
tithe book). FeeClass×5 with `pays_on_failure` covers native/network fees.
Missing: conversion quote/expiry as a typed artifact, tithe
accrued-vs-settled as typed fields, refunds/credits entirely.

## COLLISIONS / OWNERS

PricingCommitment → unclaimed builder (VV-1 branch frozen; not this seat).
bpay-rail crate → workerb2 (R20 building). x402-door → deadlock builder +
this seat's frozen ceremony. Meter/escrow → lane-M lineage, deployed
production — referenced, not edited. zGenealogy → active consumer (generic
primitives only). IF-1..4 → Astra. Mission desk (#79) → budget/tithe
calculator; complementary, no overlap (it computes budgets, not papers).

## MISSING PRIMITIVE(S)

The **generic document/evidence layer**: INVOICE and RECEIPT (and
CREDIT-NOTE) as first-class, immutable, content-addressed papers + the
paper-level RECONCILIATION taxonomy (satisfied/partial/overpaid/refunded/
credited/failed/unknown/finality-pending/void) that links them — referencing
commitments, authorizations, and rail evidence by hash, re-implementing
nothing.

## SMALLEST SAFE CLAIM

**SPEC-BPAY-DOCS-1, docs-only, claimed and landed this pass** (spec +
this return). Zero production code, zero owned-surface edits, all adjacent
artifacts referenced by hash/id. GREEN under the operating constitution:
in-lane (economic artifacts), non-colliding (nobody owns a generic papers
layer), reversible (one PR of two docs).

## EVIDENCE

Every "found" row above is git-grepable at the cited paths/branches:
`scripts/buzz-meter/{meter.py,voucher_escrow.py,rate_set.json}`,
`contracts/vending/src/vending.cpp`,
`crates/{bpay-rail,watchpay}/src/*.rs` @`codex/z2b-bpay-rail`,
`surfaces/wallet.html` voucher panel, `docs/GLOSSARY-BRIDGE.md`,
ASSURANCE-LEDGER + the Gesture-D receipt's journal map. The claim artifact
is in this PR.

## BOUNDARY NOT CROSSED

No rail, crate, contract, deployed engine, VV file, zGenealogy surface, or
Jungle4 anything was touched; no money moved; no promotion of any ledger
row; Gesture-D remains frozen BLOCKED_INTERNAL with its WAIT trigger intact.

## NEXT OWNER

- **Astra**: §6 open questions of the spec (cardinality, conversion-quote
  ownership, tithe settlement rail policy, finality exposure) + IF-1..4 as
  already routed.
- **Future papers builder** (fresh, when founder charters): implement the
  spec red-first per §5 — canonical-encoding vectors, conservation
  identities, transition battery, register rendering.
- **zGenealogy**: consumes the spec for preservation-specific papers once
  it exists as a primitive.

## FOUNDER ACTION

None required for the landed docs (ordinary PR review). If the papers
direction is ratified, the founder word charters the builder mission (and
names the tithe settlement rail policy question to Astra's queue).
