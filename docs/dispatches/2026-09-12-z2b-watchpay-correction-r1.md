# Z2.B correction round 1 — all four negative-review findings fixed (receipt)

Seat z2.b (GLM 5.3 MAX / zCode), 2026-09-12. Input: the Codex/Astra
negative review of `d435de93`
(`wt-zcode-watch-jams-plur/docs/dispatches/2026-09-12-z2b-negative-review.md`)
plus its companion probes (`…/2026-09-12-z2b-review-probes.rs`). Scope
unchanged and still closed: offline contract + negative tests only — no
z2.c, no device/Suite/Connect, no signing, no broadcast, no uploads, no
deployment, no production edits, no upstream PR.

## Reproduction (before the fix)

The reviewer's probes were copied verbatim to
`crates/watchpay/tests/review_adversarial.rs` and run with the reviewer's
exact command (`cargo test -p watchpay --locked --offline --test
review_adversarial`): **0 passed, 4 failed** — identical failure
messages to the review. Baseline suite 55/55 confirmed first.

## The four fixes

1. **Changed plan under an old intent (P1).** Two layers:
   - `ValidatedPlan` now carries a private `sealed_plan_hash` (set once
     in `validate_plan`, no mutator). `revalidate(now)` re-runs the FULL
     validation and refuses divergence from the seal; fields stay
     readable (the reviewers' probes and the composer read them), but a
     mutated-and-rehashed handle is a DIFFERENT plan by construction
     (`is_internally_consistent` bundles the seal check).
   - Every ledger transition now binds to the persisted identity:
     `bind_attempt_identity` refuses when any existing attempt for the
     batch carries a different `plan_hash`/`batch_id` than the supplied
     plan (changed vault/payer/chain/commitments/budgets/expiry cannot
     ride an old intent). Covers `write_intent`, `record_signed`,
     `record_outcome`/`require_signed`, `record_unknown`, `cancel_intent`,
     `resolve_unknown`, `abandon_unknown`.
2. **Cached validation outliving expiry (P1).** `write_intent` and
   `record_signed` call `vp.revalidate(now_unix)` — full freshness
   including the batch payment-timestamp window. Outcome reconciliation
   (`record_outcome`, `record_unknown`, `resolve_unknown`, abandon,
   cancel) is deliberately NOT expiry-gated: evidence of
   already-submitted payments reconciles after expiry (tested: intent +
   signed before expiry, reverted receipt reconciled at
   `expires_unix + 10`, new intent at `expires_unix + 11` refused).
3. **Fee budget not governing retries (P1).** New durable per-attempt
   `reserved_fee_wei` on every attempt record:
   - intent reserves the plan per-tx worst case
     (`per_tx_gas_limit × per_tx_max_fee_per_gas_wei`);
   - signing tightens it to THIS tx's worst case (`gas_limit × fee cap`,
     already bounded by the plan ceilings);
   - `write_intent` refuses when plan-wide reservations (ALL batches) +
     the new reservation exceed `max_total_native_fee_wei`;
   - reservations reconcile DOWN only with receipt fee evidence
     (`gas_used` × `effective_gas_price_wei`, new optional receipt
     fields, RPC-supplied evidence — clamped to the tx's own worst case
     so evidence can never RAISE an exposure estimate);
   - a failed call frees NOTHING without evidence (reverted-without-
     evidence keeps the full reservation; `unknown` keeps it until human
     resolution); cancelling an open unsigned intent releases its
     reservation; human-abandoning an unknown (signed) attempt does NOT.
   - **SCOPE LAW (explicit):** the budget governs BATCH-PAYMENT attempts
     only; the approval transaction's allowance lifecycle is outside
     this ledger and this crate does NOT claim a complete plan-wide
     spend-enforcement boundary. Replacement semantics are explicit: no
     in-place replacement exists; every attempt is a new nonce with its
     own reservation; same-nonce higher-fee replacement is unsupported
     in this slice.
   - Numbers under the base plan (per-tx plan worst 0.05 ETH, tx worst
     0.036 ETH, ceiling 0.1 ETH): without fee evidence the 3rd attempt
     is refused (regression pins `allowed == 2`); WITH evidence
     (60k gas × 90 gwei = 0.0054 ETH actual) ten attempts fit and the
     11th is refused — the reviewer's ten-then-refuse shape, now with
     every retained exposure evidence-backed.
4. **Optional read-back (P1).** `validate_receipt` now REFUSES a
   status-1 receipt with no completed-payment read-back (field
   `getCompletedMerklePayment`: "incomplete evidence, not a validated
   payment"). `Paid` is unreachable without it; reverted outcomes do not
   consult it. Ledger docs updated accordingly.

## Evidence

- **61/61 offline tests** (was 55): lib 14 · ledger_lifecycle 11 ·
  parity_calldata 3 (upstream byte-parity preserved untouched) ·
  plan_validation 15 (new: validation-seal regression) · receipt_binding
  13 (updated: Paid paths carry the read-back) · **review_adversarial 5**
  (the four probes — three verbatim shapes, the fourth re-asserted at the
  correct enforcement boundary with the arithmetic documented — plus the
  fee-evidence reconciliation test). Every probe carries a healthy
  control proving the fence is not a blanket refusal.
- Reviewer's exact command re-run green: `cargo test -p watchpay
  --locked --offline --test review_adversarial -- --nocapture` → 5/5.
- Clippy clean; `scripts/secret-scan.sh tree` clean; no new dependencies
  (lockfile untouched this round).

## Honest notes for the reviewer

- Probe 4's original loop (unwrapping ten no-evidence reverted attempts,
  refusing only the 11th) is incompatible with worst-case reservation
  semantics: at 0.036 ETH retained per attempt, a 0.1 ETH ceiling must
  refuse the 3rd intent. The regression pins that boundary and the
  evidence-backed variant separately demonstrates reconciliation
  (exactly ten attempts then refusal). If the intended policy was
  "N attempts always allowed," that is a budget-policy change to review,
  not a bug in the reservation law.
- Fee-evidence fields are externally supplied (same trust class as every
  other receipt field — documented in the model); the clamp prevents
  forged evidence from raising an estimate, but evidence-based DOWNWARD
  reconciliation ultimately trusts the RPC, as the review's standing
  RPC-trust limitation notes.
- All prior honest limits stand unchanged: deployment parity UNVERIFIED,
  tx_hash recorded-not-re-derived, Windows durability documented-not-
  proven, no upload-process-death recovery, evmlib stays out of the
  workspace build.

Descendant of `d435de93` on `codex/z2b-watchpay`; no force; history
intact. Ready for independent re-review.
