# AV-6 RECEIPT — retry-storm / per-leg retry ceiling · RED→GREEN · 2026-09-16

**Order (founder, verbatim):** *"Cashu reconnaissance closed. Do not
implement MMF-1 yet. Roll into P1 adversarial implementation, starting with
AV-6 retry-storm / aggregate failure-charge ceiling. Verify current main
first because other workerbs may already have consumed it. If AV-6 is taken
or complete, continue AV-5 → AV-4 → AV-11 in that order. RED → GREEN → CI;
no production deployment."* (Preceded by the founder's stale-routing
correction: AV-1..AV-3 closed by another workerb; the entire P0 queue is
done — this seat verified `origin/zcode/av2-stale-quote-ttl` exists and no
AV-6 lane did.)

**Consumed: AV-6 (P1). Target: `ops/x402-door`. Landed `424d0dc0` on main
(branch `zcode/av6-retry-ceiling-2026-09-16`). No production deployment —
CI arbitrates on push.**

## The gap, precisely

A3: "a leg that fails N times can charge N failure fees with no cumulative
bound — the estate has neither." In the door: the daily gas cap counts
RETAINED exposure per leg — one slot regardless of retry count — so a
same-leg settle storm hits the real facilitator once per attempt (each a
fresh chance to burn real gas) with nothing tightening. `FailedKeep`'s own
doc said "a later settle may retry the attempt" — no counter, no ceiling,
anywhere.

## RED (behavioral, receipted)

`adv_av6_same_leg_retry_storm_hits_the_retry_ceiling_loud` written FIRST and
run against unmodified main: **failed on the 4th same-leg attempt returning
`Ok(Error { reason: "reverted" })`** — unlimited retry proven live, not
inferred.

## GREEN

- `Reservation.settle_attempts` — serde-defaulted `u32`, **leg-lifetime data
  deliberately OUTSIDE the state enum**: at failure-record time the state is
  `Settling` (begin_settle already transitioned), so a state-sourced counter
  resets every cycle. That exact bug appeared mid-implementation and was
  caught by this seat's own battery; the lesson is banked in the field's doc
  comment. Pre-AV-6 records deserialize as 0 (additive, no
  `RECORD_VERSION` bump — old journals stay readable).
- `Journal.max_settle_attempts_per_leg` with
  `DEFAULT_MAX_SETTLE_ATTEMPTS_PER_LEG = 3` and a `with_max_settle_attempts`
  override — the number is config, the ceiling is law (corpus FeePlan
  failure-charge + retry-ceiling vocabulary).
- `Door::settle` refuses LOUD, naming attempts and ceiling: *"retry ceiling:
  leg has N no-evidence settle attempts (ceiling M) — REFUSED LOUD (AV-6);
  human gate or expiry release, never an unbounded attempt storm."* —
  **gated on `FailedKeep`** so a leg that eventually succeeds keeps its
  idempotent replay (a bare `settle_attempts` pre-check would refuse the
  lawful settled-replay path).

## Battery + suite

3 attempts below ceiling all `Ok(Error)`; the 4th refused with "retry
ceiling" and the number; control arm: a DIFFERENT leg still verifies and
settles (per-leg, not a global freeze). Acceptance extended: first failure
asserts `settle_attempts == 1`. **Full door suite green locally:
acceptance 11 + adversarial 10 (incl. AV-6) + d_specs 10 + lib; cargo fmt
applied.** §7 seat shape; four pre-push checks green; subject-asserted
1-commit delta.

## Standing note for the next consumption

**Architectural distinction (founder, 2026-09-16, binding on this lane):**
this implementation bounds **settlement attempts per leg** — a strong
protection against repeated facilitator execution. It is **NOT yet an
aggregate monetary failure-fee ceiling across heterogeneous attempts**.
Once actual fee evidence is available, these become two complementary
limits — `max_attempts` and `max_failure_charge` — and **neither is to be
inferred from the other**. The door's `gas_actual_wei` evidence field is
the natural future input for the monetary ceiling; no such aggregation is
implemented in this landing.

AV-5 (reorg drill) is next in the founder's order, then AV-4 → AV-11.
Pre-flight facts already banked this roll: `scripts/buzz-meter/` is python
(no local python on this seat — CI or WSL arbitrates), and the in-tree
`meter.py` has no `serve` entrypoint (verify the AV-1-family target shape
before any drill there — that was the founder's stale-routing lesson
generalized).
