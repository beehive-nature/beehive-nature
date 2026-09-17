# VOCAB-1 — Settlement Outcome Crosswalk (discovery + lossless candidate)

**Charter (founder, 2026-09-17):** the smallest common settlement-outcome
language needed to reconcile obligations across existing rails — evidence
first, no new enum before the inventory; **normalization must not manufacture
certainty**. INVOICE-1 is infrastructure and stays closed. Battery:
`scripts/vocab1-crosswalk.mjs` (CI-wired) — the naive status-enum mapping is
a REGISTERED RED (information-loss detector fires); the lossless predicate
crosswalk is GREEN.

## RAILS/VOCABULARIES FOUND (all read at source, main @`981195bc`)

| rail | source-native states | evidence at state |
|---|---|---|
| x402-door journal | Reserved / Settling / Settled{tx,actual,gas} / ReorgFlagged{depth, prior evidence verbatim} / FailedKeep{reason, attempts} / Unknown{note} / ExpiredReleased{verdict: UnspentOnChain\|SpentOnChain\|RpcUnavailable} | settle evidence = tx+amount+gas; verify refusal; ambiguous transport; typed expiry verdict |
| bpay-rail (R20 lane) | Intent / Staged / InFlight / Settled / Failed / Unknown | persisted pre-send state; rail receipt; FeeClass×5 (pays_on_failure asymmetry) |
| watchpay receipt.rs | receipt status 1/0; verification uploaded/retrieved/hash-verified; confirmations AS-REPORTED | tx receipt + decoded event + readback; "RPC responses are evidence, not proof" |
| voucher/meter (bMeter) | escrow events deposit/deposit_usdc/charge (hash-chained, derived balances); receipt kinds compute.generation / prepaid-voucher / settlement-instruction (INSTRUCTION ONLY) / reorg-flag{head-rollback, seq-trx-swap}; parked charges | chained-event derivation; instruction artifacts carry NO value movement |
| vending (Jungle4) | opensess (signed upto ceiling) → clamped charges → settle consumes nonce EVEN AT ZERO CHARGE (the Tally law); pause-not-kill | on-chain session/nonce idempotency; per-row tithe_bp |
| zGenealogy bpay.mjs (reference consumer) | quote/invoice/authorization/settlement/receipt/reconciliation snapshots; issued→settled\|void; settled\|preserved; reconcile reconciled\|breach | txRefs; verification states; commit/receipt pair |
| INVOICE-1 generic (infrastructure) | issued / void{evidence kind abandon\|superseded, successor} / settled{receiptId, receiptDigest}; priorDigest lineage | contentDigest + expectedDigest anchor; carried quote set |

Meta-vocabulary (analogy, not a rail): ASSURANCE-LEDGER classes A/B/C/D —
repo-law ≠ deployed ≠ live-wired ≠ drill-proven; the same ladder discipline
applies to outcome evidence.

## THE AXIS SET (per state, the crosswalk's unit)

`value_attempted` (never/instruction/submitted) · `value_observed` (none /
self-reported / tx-hash / tx-receipt / event-log+readback / derived-balance) ·
`amount_observed` (figure or null) · `finality` (none / as-reported-N /
terminal / reorg-flagged) · `retryability` (unbounded / capped / human-gate /
never) · `refund_path` (none / credit-note / rail-native) ·
`closes_obligation` (no / partial-amount / yes).

## THE SEVEN DISTINCTIONS (founder law, encoded as battery invariants)

AUTHORIZED ≠ SUBMITTED ≠ SETTLED ≠ FINAL (evidence class must strictly
deepen along that chain); FAILED ≠ VOID (different retryability AND closure);
REFUNDED ≠ NEVER-CHARGED (different value_observed history);
PROVIDER EXPENSE ≠ CUSTOMER CHARGE (different ledger side — paper-layer
axis); TITHE CALCULATED ≠ ACCRUED ≠ SETTLED (accounting triple — paper-layer
axis, never a rail state).

## LOSSLESS CROSSWALK CANDIDATE (predicates, not statuses)

Rail state → the axis TUPLE above; RECON-1 later reasons over predicate
differences. A common `SUCCESS` label exists ONLY where the full tuple agrees
(watch the battery prove the naive enum violates this). Gateway predicates
RECON-1 will need: `closes_exactly(amount)`, `closes_partially()`,
`needs_human_gate()`, `finality_pending(depth)`, `never_charged()`,
`refund_owed()`.

## UNMAPPABLE/AMBIGUOUS STATES (no honest generic equivalent — stay native)

1. **meter `settlement-instruction`** — INSTRUCTION ONLY, zero value
   attempted; any SUBMITTED-mapping manufactures intent that never existed.
2. **vending zero-charge settle (Paid(0))** — obligation closed, value 0;
   generic SUCCESS conflates closed-with-value.
3. **door `ExpiredReleased{RpcUnavailable}`** — typed HOLD, retryable,
   decides nothing; not failed, not released.
4. **door `ReorgFlagged`** — settled evidence + changed history; neither
   final nor failed; maps only to `finality_pending(depth)` with prior
   evidence preserved.
5. **watchpay as-reported confirmations** — finality as a TRUST-CLASSED
   number, never a boolean.
6. **escrow derived balances** — value_observed = derivation over chained
   events, not a rail receipt; the derivation is the evidence.

## Battery verdicts

- NAIVE-ENUM mapping (six generic statuses) → **REGISTERED RED**: the
  information-loss detector fires wherever two states sharing a status
  differ on any load-bearing axis (e.g. watchpay receipt-observed vs
  meter instruction-only both → "completed").
- PREDICATE crosswalk → **GREEN**: every distinct axis-vector stays
  distinguishable; the seven distinctions hold as invariants.
- Negative control (sabotage: merge two evidence classes inside the
  predicate mapping) → detector CONVICTS (teeth proven).

## Fences

INVOICE-1 not reopened; RECON-1 not implemented; zGenealogy not migrated;
R20, Gesture D, IF-1..5, VV-2, Jungle4 untouched. This artifact + battery
are the VOCAB-1 discovery product; RECON-1 consumes the predicate gateway.
