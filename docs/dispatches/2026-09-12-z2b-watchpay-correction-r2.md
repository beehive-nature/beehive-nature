# Z2.B correction round 2 — both R1 re-review findings fixed (receipt)

Seat z2.b (GLM 5.3 MAX / zCode), 2026-09-12. Input: the Codex/Astra
re-review of `f70a4b2d` (`…/2026-09-12-z2b-r1-review.md`) and its
companion probes (`…/2026-09-12-z2b-r1-probes.rs`). Scope unchanged and
still closed: offline only — no z2.c, no device/Suite/Connect, no
signing, no broadcast, no uploads, no deployment, no production edits,
no upstream PR.

## Reproduction (before the fix)

Probes copied verbatim to `crates/watchpay/tests/review_round1.rs` and
run with the reviewer's exact command (`cargo test -p watchpay --locked
--offline --test review_round1 -- --nocapture`): **0 passed, 2 failed**
— matching the review. Shipped 61-test suite reproduced passing first.

## Fix 1 — the seal now covers ALL validated state (compile-time)

`ValidatedPlan` is fully private: the inner plan AND every derived
figure (`approve_ceiling`, `batch_worst_case`, `planned_tx_count`,
`worst_case_total_native_fee_wei`) are fields without public access;
reads go through immutable getters, `validate_plan` remains the only
constructor, and `revalidate` re-derives everything against the
construction-time seal. The R1 probe's shape (`v.approve_ceiling = …` on
a live handle) no longer compiles — the reviewer-sanctioned form
("compile-time immutability is acceptable if the mutation API is
eliminated"). The semantic consequence is asserted in the shipped
regression: an approve composed OUTSIDE the handle for 1,000,000 atto
(the mutated-derived-amount shape) is refused by the transaction
validator, which derives the lawful amount from the sealed plan only;
healthy controls: the sealed-ceiling approve (36) is accepted, an
Amount::MAX approve is refused, and `revalidate` re-derives the same
figures. The R0 seal regression and the ledger traversal test were
adapted to the eliminated-mutation reality (both had exercised in-place
handle mutation as their mechanism; the boundaries they tested —
revalidation, identity binding, job_id refusal — remain covered, now at
the plan and ledger boundaries respectively).

## Fix 2 — impossible fee evidence refuses the receipt, never frees budget

New `validate_fee_evidence(signed_tx, receipt)`, called from
`validate_receipt` BEFORE any outcome classification and state mutation,
and again inside the ledger's `reconcile_reservation` (defense in
depth; clamping stays as a second layer, but clamping is no longer the
only check):
- **status domain**: receipt status outside {0,1} is malformed evidence
  and refused (previously any status ≠ 1 silently classified as
  reverted);
- **pair completeness**: a half-pair (gas without price or vice versa)
  is contradictory and refused — missing evidence (both absent) remains
  legal and releases nothing;
- **gas vs limit**: `gas_used > signed gas_limit` is impossible even
  under the module's trusted-RPC assumption — refused (the probe's
  exact shape: limit+1 with zero price no longer erases the
  reservation; the whole `record_outcome` call fails and the on-disk
  reservation/state are untouched — asserted in the regression);
- **price vs envelope**: legacy — effective price must equal the signed
  gasPrice exactly; EIP-1559 — `max_priority <= effective <= max_fee`.
  Zero effective price stays LAWFUL exactly when the envelope allows it
  (zero-priority + zero-basefee test networks) and is refused when the
  signed priority floor contradicts it — the distinction the review
  asked to keep. Boundary control: `gas_used == gas_limit` exactly is
  possible and accepted.

## Evidence

- **65/65 offline tests** (was 61): every prior suite preserved — lib 14,
  ledger_lifecycle 11, parity_calldata 3 (upstream evmlib v0.9.1
  byte-parity untouched), plan_validation 15 (seal regression rewritten
  in its compile-time-immutable form), receipt_binding 13,
  review_adversarial 5 (round-0 probes, getter-adapted, semantics
  unchanged) — plus **review_round1 4**: the two R1 probes (one in its
  compile-time form with the semantic assertion, one verbatim in
  semantics), the zero-price/legitimacy battery, and the status-domain
  check. Healthy controls beside every refusal.
- Reviewer's exact command re-run green: 4/4.
- Clippy clean; `scripts/secret-scan.sh tree` clean; lockfile untouched
  this round.

## Honest notes

- The R1 probe file's mutation line cannot compile post-fix by design;
  the shipped `review_round1.rs` documents this at the probe site and
  asserts the semantic outcome instead (excessive-approve refusal +
  sealed-ceiling acceptance).
- Envelope price bounds are the standard legacy/EIP-1559 invariants;
  chain-specific effective-price composition (e.g. Arbitrum's L1 data
  component folded into the L2 bid) stays within the signed cap on the
  referenced networks — an assumption, documented as such.
- All standing limitations unchanged: deployment parity UNVERIFIED,
  tx_hash recorded-not-re-derived, RPC evidence externally supplied,
  Windows durability documented-not-proven, no upload-process-death
  recovery, evmlib outside the workspace build, approval allowance
  lifecycle outside the fee budget's scope.

Descendant of `f70a4b2d` on `codex/z2b-watchpay`; no force; history
intact. Ready for independent re-review.
