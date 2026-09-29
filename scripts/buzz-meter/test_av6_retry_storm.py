#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""
test_av6_retry_storm.py — SPEC AV-6: the retry-storm failure-charge ceiling
(docs/agents/ADVERSARIAL-BPAY-SPECS.md, P1 head of queue; founder order
2026-09-16: "prove repeated failed attempts can currently accumulate
exposure beyond the intended bound, then establish an aggregate
failure-charge ceiling without weakening per-attempt evidence").

Red-test-first. PART A proves the gap LIVE on the pre-fix engine and is kept
forever: the 2-CONSECUTIVE settle-failure law counts only consecutive
failures, so an obligation that fails, succeeds, fails, succeeds… retries
unbounded — and on gas-paying rails (the R7 asymmetry: gas pays on failure)
every failed attempt burns real value the meter policy never bounds. No fee
dimension exists anywhere in the policy layer today.

PART B (6.1/6.2 + negative control) then asserts the law: an AGGREGATE
failure-charge ceiling per obligation — explicit parameter, inclusive bound,
per-attempt evidence rows preserved on every attempt INCLUDING the refused
one, and past the ceiling a TYPED hard refusal (loud, never silent).

Engine purity law (same as AV-3's door signal): the ceiling bounds the
POLICY book. Translating booked failure fees into member-facing escrow
charges (the chain_fee rate shape) is deploy-side rate-book work — an
implemented invariant is not a live-wired one.

Run:  python3 scripts/buzz-meter/test_av6_retry_storm.py   (exit 0 = green)
"""
import json
import os
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voucher_escrow import Escrow, RateSet  # noqa: E402
from x402_meter import Session, halt_on_infra  # noqa: E402

TMP = Path(tempfile.mkdtemp(prefix="av6-"))
PASS = []


def ok(label):
    PASS.append(label)
    print(f"  ok: {label}")


def fail(label):
    print(f"FAIL: {label}")
    sys.exit(1)


RS = RateSet(version="av6-battery-v1", cost_basis_ref="battery-fixture",
             rates={"mesh_second": Decimal("0.0010")})
VOUCHER = "member-av6"


def open_session(**extra):
    es = Escrow(TMP / "ledger-av6.jsonl")
    return Session(voucher=VOUCHER, escrow=es, rate_set=RS, **extra)


# ── PART A — THE GAP, PROVEN LIVE (pre-fix behavior, kept forever) ──────────

def part_a_gap_proof():
    sess = open_session().open()
    decisions = []
    for i in range(10):
        if i % 2 == 0:
            # an interleaved SUCCESS resets the consecutive-failure book —
            # exactly the alternating shape that defeats a consecutive-only law
            sess.settle_failures = 0
            decisions.append("ok")
        else:
            h = halt_on_infra(sess, RuntimeError("settle infra down"))
            decisions.append(h.kind)
    if any(d == "KILL" for d in decisions):
        fail("PART A: the consecutive law halted an alternating loop — the "
             "gap disappeared; update this proof")
    n_failures = sum(1 for d in decisions if d == "PAUSE")
    if n_failures != 5:
        fail(f"PART A: expected 5 fail-retry cycles, saw {n_failures}")
    print(f"  GAP PROVEN (kept as the naive shape): {n_failures} failed "
          "attempts in an alternating loop, every halt decision PAUSE-retry, "
          "zero bounds of any kind on the retry count or the failure-fee "
          "exposure — on gas-paying rails every attempt burns real value "
          "the meter policy never sees")
    ok("PART A: today's policy cannot bound an alternating retry storm — "
       "no aggregate failure-charge ceiling exists (gap receipt; the naive "
       "shape powers the negative control)")


# ── 6.1 — N=10 fail-and-retry under an explicit ceiling ⇒ bounded total ─────

def case_6_1():
    from x402_meter import FailureChargePolicy, FailureFeeCeiling, book_failure
    per, ceiling = Decimal("0.0010"), Decimal("0.0050")
    policy = FailureChargePolicy(per_attempt_fee_a=per, ceiling_a=ceiling)
    sess = open_session(failure_policy=policy).open()

    booked = 0
    refusals = 0
    for i in range(10):  # the storm: ten failed attempts, one obligation
        try:
            book_failure(sess, RuntimeError(f"settle infra down #{i}"),
                         ts=1_000 + i)
            booked += 1
        except FailureFeeCeiling as e:
            refusals += 1
            if "0.0050" not in str(e) or "0.0010" not in str(e):
                fail(f"6.1: refusal must name the ceiling and the fee: {e}")

    if booked != 5:
        fail(f"6.1: expected the inclusive bound to book exactly 5 attempts, "
             f"saw {booked}")
    if refusals != 5:
        fail(f"6.1: expected 5 typed refusals past the ceiling, saw {refusals}")
    if sess.failure_fees_a != ceiling:
        fail(f"6.1: cumulative failure fees {sess.failure_fees_a} != ceiling "
             f"{ceiling} — the total must be bounded EXACTLY")
    if len(sess.failure_rows) != 10:
        fail(f"6.1: per-attempt evidence weakened — {len(sess.failure_rows)} "
             "rows for 10 attempts (every attempt incl. refused ones must "
             "leave its row)")
    refused_rows = [r for r in sess.failure_rows if not r.get("booked")]
    if len(refused_rows) != 5 or any(r["fee_a"] != "0.0000" for r in refused_rows):
        fail("6.1: refused attempts must carry zero-fee evidence rows")
    ok("6.1: N=10 retry storm under an explicit ceiling — 5 booked to the "
       "inclusive bound, 5 typed refusals naming ceiling+fee, total == "
       "ceiling exactly, all 10 attempts evidenced")


# ── 6.2 — unbounded accumulation is a LOUD failure, never silent ────────────

def case_6_2():
    from x402_meter import FailureChargePolicy, FailureFeeCeiling, book_failure
    per, ceiling = Decimal("0.0010"), Decimal("0.0030")
    sess = open_session(failure_policy=FailureChargePolicy(
        per_attempt_fee_a=per, ceiling_a=ceiling)).open()
    # drive well past the ceiling — the exposure must NEVER move past it and
    # every excess attempt must raise (loud), never silently absorb
    for _ in range(10):
        try:
            book_failure(sess, RuntimeError("storm"))
        except FailureFeeCeiling:
            pass
    if sess.failure_fees_a > ceiling:
        fail(f"6.2: exposure moved past the ceiling — {sess.failure_fees_a}")
    # a KILL-for-human composes cleanly on the typed refusal (the halt law
    # keeps its own behavior; the ceiling adds the bound)
    try:
        book_failure(sess, RuntimeError("storm"))
        fail("6.2: accrual past the ceiling returned silently")
    except FailureFeeCeiling as e:
        h = halt_on_infra(sess, e)
        if h.kind != "KILL" and h.kind != "PAUSE":
            fail(f"6.2: halt composition broke: {h.kind}")
    ok("6.2: accumulation past the ceiling is impossible — every excess "
       "attempt raises typed, exposure pinned at the ceiling, the halt law "
       "composes on the refusal")


# ── negative control — the no-ceiling (naive) charger is DETECTED ───────────

def negative_control():
    from x402_meter import FailureChargePolicy, book_failure
    would_be_bound = Decimal("0.0050")
    # the naive shape: ceiling explicitly unbounded — today's world, forever
    naive = FailureChargePolicy(per_attempt_fee_a=Decimal("0.0010"),
                                ceiling_a=None)
    sess = open_session(failure_policy=naive).open()
    for i in range(10):
        book_failure(sess, RuntimeError(f"storm #{i}"), ts=i)
    if sess.failure_fees_a <= would_be_bound:
        fail("negative control: the naive charger stayed inside the bound — "
             "the harness can no longer demonstrate detection of the class")
    ok(f"negative control: the unbounded policy accrued "
       f"{sess.failure_fees_a} A over 10 attempts (> the {would_be_bound} "
       "bound) — 6.1's bounded-total assertion FAILS against it, the "
       "harness detects the class")


# ── main ────────────────────────────────────────────────────────────────────

def main():
    part_a_gap_proof()
    case_6_1()
    case_6_2()
    negative_control()

    print("\n=== AV-6 RETRY-STORM — ALL PROOFS PASS ===")
    for i, p in enumerate(PASS, 1):
        print(f"  {i}. {p}")
    _ = json.dumps({"battery": "av6-retry-storm", "proofs": len(PASS)})


if __name__ == "__main__":
    main()
