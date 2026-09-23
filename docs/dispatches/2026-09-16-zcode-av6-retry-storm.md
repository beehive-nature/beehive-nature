# 2026-09-16 — AV-6 retry-storm failure-charge ceiling, RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-6 (P1, founder-named
first: "the remaining P1 item most directly capable of leaking value").
Founder order verbatim: prove repeated failed attempts can currently
accumulate exposure beyond the intended bound, then establish an aggregate
failure-charge ceiling without weakening per-attempt evidence. No production
deployment; CI arbitrates. **Branch** `zcode/av2-stale-quote-ttl`, worktree
`wt-zcode-av2`.

## RED receipts (box, Python 3.12.3, exit 1)

- **The storm, proven live** (PART A, kept in the battery forever): the
  2-CONSECUTIVE settle-failure law (`halt_on_infra`) counts only consecutive
  failures, so an alternating fail/success loop retries unbounded — 10
  attempts, 5 failed, every halt decision PAUSE-retry, zero halts. And on
  gas-paying rails (the R7 asymmetry: gas pays on failure) every failed
  attempt burns real value the meter policy never sees: **no fee dimension
  existed anywhere in the policy layer**.
- The ceiling absent: `ImportError: cannot import name 'FailureChargePolicy'`.

## The GREEN (`x402_meter.py`)

- `FailureChargePolicy(per_attempt_fee_a, ceiling_a)` — the EXPLICIT bound
  (inclusive: reaching it exactly is lawful; `ceiling_a=None` is today's
  unbounded world, the negative-control shape only, documented as the leak
  this law closes).
- `book_failure(session, error, ts)` — evidence FIRST: every attempt leaves
  its row (attempt number, ts, the error string, the fee); then the aggregate
  law: past the ceiling the row lands with fee 0.0000 / booked False /
  refusal reason and `FailureFeeCeiling` raises naming total + next fee +
  ceiling — loud, never a silent absorb. The consecutive-failure halt law is
  untouched (two laws, one book; `halt_on_infra` composes on the refusal).
- Session carries the book (`failure_policy`, `failure_fees_a`,
  `failure_rows`); no policy wired = exactly today's behavior.

## Receipts

- Battery (box): **4/4 green** — PART A gap receipt; 6.1 ten-attempt storm
  under a 5-fee ceiling → 5 booked to the inclusive bound, 5 typed refusals
  naming ceiling+fee, total pinned at the ceiling EXACTLY, all 10 attempts
  evidenced (refused rows carry zero-fee evidence); 6.2 exposure can never
  move past the ceiling, halt law composes; negative control: the unbounded
  policy accrues 0.0100 A over 10 attempts and 6.1's bounded-total assertion
  FAILS against it — the harness detects the class.
- Regressions (box): voucher 16/16, x402 45/45, AV-3 5/5, AV-1 serve-bridge
  5/5. Rust standing (17/17, untouched). CI gains the battery; CI arbitrates
  on push.

## Standing notes (the implemented ≠ live-wired law)

- The ceiling bounds the POLICY book. Translating booked failure fees into
  member-facing escrow charges (the `chain_fee` rate shape) is deploy-side
  rate-book work — same law as AV-3's door signal: **the engine invariant is
  green; production gains the bound only when the retry loop's caller wires
  a real policy.** A future receipt must never confuse the two.
- P1 queue continues: AV-5 (reorg drill) next per the founder's roll order,
  then AV-4, then AV-11.
