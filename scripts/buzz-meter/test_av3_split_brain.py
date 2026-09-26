#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""
test_av3_split_brain.py — SPEC AV-3: the meter↔delivery-door seam under
split-brain (docs/agents/ADVERSARIAL-BPAY-SPECS.md, P0).

Red-test-first. PART A proves the gap LIVE on the pre-fix engine: the meter
accrues while the delivery door is unreachable — "no availability signal
feeds accrual at all" was the audit's finding, and this battery receipts it
behaviorally before any fix. PART B (3.1–3.4) then asserts the law:

    door unavailable ⇒ accrual PARKS (charge delta = 0, park not kill);
    door returns + session open ⇒ accrual resumes from the resume-point,
    with NO retroactive backfill of the outage window;
    credit-out park-not-kill is regression-kept (3.3);
    the naive charger (no availability check) is DETECTED (3.4).

Harness law (the spec's own): a controllable door-health flag + session-row
fixtures over the deterministic in-process engine — no live-network
dependency. The engine stays pure: door health ENTERS as an explicit
parameter (`door_reachable`), the way `seller_can_serve` already enters the
quote guards; the CALLER owns the signal (production burn sites must pass
live door health — repo-side law, no deployment from this lane).

Run:  python3 scripts/buzz-meter/test_av3_split_brain.py   (exit 0 = green)
"""
import json
import os
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voucher_escrow import Escrow  # noqa: E402
from x402_meter import (  # noqa: E402
    Session, credit_from_settlement,
)

TMP = Path(tempfile.mkdtemp(prefix="av3-"))
PASS = []


def ok(label):
    PASS.append(label)
    print(f"  ok: {label}")


def fail(label):
    print(f"FAIL: {label}")
    sys.exit(1)


# the test lane (same fixture as the x402 battery): 0.0010 A per mesh_second
from voucher_escrow import RateSet  # noqa: E402

RS = RateSet(version="av3-battery-v1", cost_basis_ref="battery-fixture",
             rates={"mesh_second": Decimal("0.0010")})
VOUCHER = "member-av3"
UNIT_ALL_IN = Decimal("0.0010") * Decimal("1.10")   # basis + tithe per second


def seeded_escrow(name, amount="5.0000"):
    es = Escrow(TMP / f"ledger-{name}.jsonl")
    credit_from_settlement(
        es, VOUCHER,
        {"rail": "vaulta", "tx": f"av3-seed-{name}", "sender": "member.a3",
         "amount": amount},
        {"rail": "vaulta", "tx": f"av3-seed-{name}", "from": "member.a3",
         "amount": amount, "memo": VOUCHER})
    return es


# ── PART A — THE GAP, PROVEN LIVE (pre-fix behavior, kept forever as the ────
# naive-charger demonstration; it must keep passing: the naive shape always
# charges, and 3.4 relies on exactly that)

def part_a_gap_proof():
    es = seeded_escrow("gap")
    sess = Session(voucher=VOUCHER, escrow=es, rate_set=RS).open()
    bal_before = es.balance(VOUCHER)

    # the controllable door-health flag: DOWN
    door_up = False

    # today's call shape — no availability signal anywhere
    billed, state = sess.burn(5)
    bal_after = es.balance(VOUCHER)
    delta = bal_before - bal_after
    if billed != 5 or delta <= 0 or state != "ACTIVE":
        fail("PART A: the gap disappeared — pre-fix engines must accrue "
             "during outage (this proof is the RED receipt)")
    print(f"  GAP PROVEN (kept as the naive shape): door DOWN, naive "
          f"burn(5) billed {billed}s, charged {delta} A, state {state} — "
          "accrual ran while delivery was undeliverable")
    ok("PART A: today's meter accrues while the door is unreachable "
       "(gap receipt; identical shape powers the 3.4 negative control)")


# ── 3.1 — door unreachable at session tick ⇒ accrual parks, delta = 0 ──────

def case_3_1():
    es = seeded_escrow("park")
    sess = Session(voucher=VOUCHER, escrow=es, rate_set=RS).open()
    bal_before = es.balance(VOUCHER)
    ledger_before = (TMP / "ledger-park.jsonl").read_bytes()

    for _tick in range(3):  # the whole unavailable window
        billed, state = sess.burn(5, door_reachable=False)
        if billed != 0 or state != "PAUSED":
            fail(f"3.1: accrual during outage — billed {billed}, state {state}")

    if es.balance(VOUCHER) != bal_before:
        fail("3.1: charge delta > 0 during the unavailable window")
    if (TMP / "ledger-park.jsonl").read_bytes() != ledger_before:
        fail("3.1: ledger mutated during the unavailable window")
    if sess.state == "CLOSED":
        fail("3.1: the door outage KILLED the session — the law is park")
    if getattr(sess, "park_reason", None) != "door":
        fail("3.1: park reason not recorded as 'door'")
    ok("3.1: door unreachable → accrual parks across the outage window "
       "(zero charge records, ledger bytes identical, session parked not "
       "killed, reason=door)")


# ── 3.2 — door returns, session open: resume from resume-point, no backfill ─

def case_3_2():
    es = seeded_escrow("resume")
    sess = Session(voucher=VOUCHER, escrow=es, rate_set=RS).open()

    # outage window: 3 attempted 5s ticks accrue nothing
    for _ in range(3):
        sess.burn(5, door_reachable=False)
    credits_at_park = sess.credits

    # door returns, member still in the session: 2s of REAL delivery
    billed, state = sess.burn(2, door_reachable=True)
    if billed != 2 or state != "ACTIVE":
        fail(f"3.2: no resume on door return — billed {billed}, state {state}")
    if sess.credits != credits_at_park + 2:
        fail(f"3.2: credits drifted — {sess.credits} != park point "
             f"{credits_at_park} + 2 (retroactive backfill?)")
    expected = (UNIT_ALL_IN * 2).quantize(Decimal("0.0001"))
    spent = Decimal("5.0000") - es.balance(VOUCHER)
    if spent != expected:
        fail(f"3.2: retroactive backfill — spent {spent} A, expected exactly "
             f"{expected} A (the 15 outage seconds must never be charged)")
    ok(f"3.2: door return → resume from resume-point; charged exactly "
       f"{expected} A for 2 delivered seconds, zero backfill of the outage "
       "window")


# ── 3.3 — credit-out regression-keep: park-not-kill exactly per receipts ────

def case_3_3():
    es = seeded_escrow("creditout", amount="1.0000")
    sess = Session(voucher=VOUCHER, escrow=es, rate_set=RS).open()
    # 5000s at 0.0011 all-in needs 5.5 A; only ~909s affordable on 1.0 A —
    # one big burn parks at zero mid-request
    billed, state = sess.burn(5_000, door_reachable=True)
    if state != "PAUSED" or billed <= 0:
        fail(f"3.3: credit-out behavior changed — billed {billed}, state {state}")
    # drained for billing purposes: less than one all-in second remains
    # (affordability floors at whole seconds — a sub-second remainder parks)
    if es.balance(VOUCHER) >= UNIT_ALL_IN:
        fail(f"3.3: balance {es.balance(VOUCHER)} still affords a second — "
             "credit-out did not park at the floor")
    # paused-at-zero bills nothing further (door healthy)
    b2, s2 = sess.burn(5, door_reachable=True)
    if b2 != 0 or s2 != "PAUSED":
        fail("3.3: paused-at-zero session billed again")
    if getattr(sess, "park_reason", None) != "balance":
        fail("3.3: park reason at zero should be 'balance'")
    # a credit RESUMES it (pause-not-kill, the watch-room law verbatim)
    sess.credit(
        {"rail": "vaulta", "tx": "av3-topup", "sender": "member.a3",
         "amount": "1.0000"},
        {"rail": "vaulta", "tx": "av3-topup", "from": "member.a3",
         "amount": "1.0000", "memo": VOUCHER})
    if sess.state != "ACTIVE":
        fail("3.3: credit did not resume the paused session")
    ok("3.3: credit-out regression kept — parks at zero (reason=balance), "
       "bills nothing while paused, resumes on credit; never killed")


# ── 3.4 — negative control: the naive charger is DETECTED ───────────────────

def case_3_4_run():
    es = seeded_escrow("naive")
    sess = Session(voucher=VOUCHER, escrow=es, rate_set=RS).open()
    bal_before = es.balance(VOUCHER)

    # the naive charger: burns during the outage WITHOUT the availability
    # check (today's only call shape)
    billed, state = sess.burn(5)
    delta = bal_before - es.balance(VOUCHER)
    if billed != 5 or delta <= 0 or state != "ACTIVE":
        fail("3.4: the naive charger did NOT accrue — the harness can no "
             "longer demonstrate detection of the class")
    ok("3.4: naive charger (no availability check) accrued during the "
       f"outage (delta {delta} A) — 3.1's zero-delta assertion FAILS "
       "against it, the harness detects the class")


# ── main ────────────────────────────────────────────────────────────────────

def main():
    part_a_gap_proof()
    case_3_1()
    case_3_2()
    case_3_3()
    case_3_4_run()

    print("\n=== AV-3 SPLIT-BRAIN — ALL PROOFS PASS ===")
    for i, p in enumerate(PASS, 1):
        print(f"  {i}. {p}")
    _ = json.dumps({"battery": "av3-split-brain", "proofs": len(PASS)})


if __name__ == "__main__":
    main()
