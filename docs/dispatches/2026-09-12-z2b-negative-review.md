# Z2.B negative review — d435de93

Codex (Astra), 2026-09-12. **Return for correction; no z2.c yet.**
Separate detached review worktree: `C:\Users\travi\wt-astra-watchpay-review`.
The build worktree was not modified. Shipped suite reproduced: **55 passed**.
Four additional negative probes compiled and **all four failed their required
refusal assertions**. No wallet, signing, RPC, upload or production operation
was performed. Cargo fetched missing public build dependencies; tests themselves
were offline. The initial offline dependency resolution failed before tests,
then the locked build and subsequent offline probe run succeeded in compiling.

## Findings

### P1 — changed plan accepted under a previously recorded intent

`Ledger::record_signed` locates an intent by job/index and checks its nonce,
but never compares its `plan_hash`/`batch_id` with the supplied validated plan.
Probe: persist intent for A; build and validate B with the same job/index but
a different vault (recomputed batch/plan hashes); submit B's transaction.
The call succeeds and records B's transaction inside A's intent record.

Required: bind every ledger transition to immutable persisted plan and batch
identity. Refuse changed payer, chain, vault, commitments, budgets and expiry.
Also make `ValidatedPlan` immutable/opaque or otherwise enforce revalidation;
its current public mutable fields cannot carry a validation invariant.

### P1 — cached validation outlives the plan's expiry

`validate_plan` checks time only at initial validation. `write_intent` and
`record_signed` accept `now_unix` but use it only as a record timestamp.
Probe: validate before expiry, then start an intent at `expires_unix + 1`.
The call succeeds. Revalidate freshness at action boundaries, including the
underlying payment timestamp, while still allowing reconciliation of already
submitted payments after expiry. Expiry must block new signing, not discard
evidence of old payments.

### P1 — cumulative fee ceiling does not govern retries

The plan calculates an initial batch-plus-approval fee allowance, but the
ledger neither reserves nor accumulates fees across attempts. Every reverted
attempt allows another. Probe: ten synthetic reverted transactions, each
with a 400,000 gas limit and 90 gwei fee cap, then an eleventh intent. All
are accepted under the base plan's 0.15 ETH total fee ceiling; the first ten
have 0.36 ETH combined worst-case exposure. This is synthetic budget exposure,
not actual observed network spend.

Required: persist a plan-wide budget ledger covering approval, batches,
reverted attempts and replacements. Reserve worst-case exposure, reconcile
validated actual fees where available, and never free unknown exposure merely
because a call failed. Keep replacement/same-nonce semantics explicit. If
approval lifecycle is outside scope, the public API must explicitly refuse
claiming a complete plan-wide spend enforcement boundary.

### P1 — required completed-payment read-back silently optional

`validate_receipt` uses `if let Some(rb)` and otherwise returns `Paid`.
Probe: a matching synthetic receipt with `readback=None` is accepted.
Required: missing read-back cannot produce the full validated-paid state.
Either require evidence bound to chain/vault/winner (and relevant chain
context), or return a distinct incomplete-evidence state which cannot unlock
finalization. Existing RPC trust limitations remain explicit.

## Repro and correction order

Companion source: `docs/dispatches/2026-09-12-z2b-review-probes.rs`.
Copy it into a review/build checkout as
`crates/watchpay/tests/review_adversarial.rs`, then run:

```text
cargo test -p watchpay --locked --offline --test review_adversarial -- --nocapture
```

Observed at d435de93: 0 passed, 4 failed. Failure messages:
- changed vault/plan accepted under old persisted intent
- expired cached plan starts new signing intent
- ten reverted attempts exhausted total fee budget but another is allowed
- paid accepted without required readback

Continue **the same z2.b session, GLM 5.3 Max**. Fix these four boundaries in
the existing build worktree, add the repros as regressions with healthy
controls, and report a new pinned descendant for independent review. Keep
all device/network/payment/production gates closed. No z2.c, no devnet run,
no upstream PR or merge. Preserve source parity tests and the honest limits
on externally supplied decoded transactions, chain evidence and platform
durability. This review does not clear those limitations for live use.
