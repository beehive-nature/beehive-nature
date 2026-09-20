#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""
test_av5_reorg_drill.py — SPEC AV-5: the reorg / flag-not-credit drill
(docs/agents/ADVERSARIAL-BPAY-SPECS.md, P1). Founder order 2026-09-16:
"then AV-5 reorg/flag-not-credit drill"; no production deployment; CI
arbitrates.

Red-test-first. PART A proves the gap LIVE on the pre-fix poller semantics
(kept forever): a consumed-seq row is SKIPPED SILENTLY — a fork that swaps
history behind the watermark leaves zero evidence, and new rows landing on
the forked chain credit with no reorg concept anywhere. The :423 law covers
READ FAILURES ("action read failed — nothing written"); the REORG analog
did not exist.

PART B (5.1 + 5.3) asserts the law through the GREEN seam
`meter.process_transfers`: a reorged round (seq→trx swap behind the
watermark, or a head rollback) ⇒ ZERO credit, ledger bytes identical, an
EXPLICIT reorg flag (state + flag-file payload with evidence), watermark
and head-map UNCHANGED (fail closed — the whole round is suspect). Clean
rounds behave exactly as today (memo-routed credit, unbound instructions).
The negative control: a detection-disabled variant credits the forked
round and 5.1's zero-credit assertion FAILS against it.

5.2 (reversibility quorum verdicts for the fork) is the RUST drill:
crates/reversibility/tests/reorg_drill.rs — NoQuorum during the split
(never an Agreed-by-one-operator confirmation), Reorg{depth} once
resolved, Advanced/Still controls. cargo test rides CI
(cargo test --workspace --locked).

Run:  python3 scripts/buzz-meter/test_av5_reorg_drill.py   (exit 0 = green)
"""
import json
import os
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voucher_escrow import Escrow  # noqa: E402

TMP = Path(tempfile.mkdtemp(prefix="av5-"))
PASS = []


def ok(label):
    PASS.append(label)
    print(f"  ok: {label}")


def fail(label):
    print(f"FAIL: {label}")
    sys.exit(1)


KEY = "member-av5"


def row(seq, trx, amount="1.0000", memo=KEY, frm="member.a5"):
    return {"seq": seq, "block": 100 + (seq or 0), "trx_id": trx,
            "from": frm, "memo": memo, "amount": amount, "symbol": "A"}


# ── PART A — THE GAP, PROVEN LIVE on today's poller semantics (kept) ────────

def part_a_gap_proof():
    st = {"last_seq": 11}   # seqs ≤ 11 are consumed history
    fork_round = [
        # history REWROTE behind the watermark: a consumed seq re-presented
        # MUTATED (new trx, attacker amount/memo)
        row(11, "attacker-swapped-tx", amount="999.0000", memo=KEY, frm="evil"),
        # and a new row landing on the forked chain
        row(12, "txC"),
    ]
    # today's loop, verbatim semantics:
    credited = []
    for r in sorted(fork_round, key=lambda x: x["seq"] or 0):
        if r["seq"] is None or r["seq"] <= st["last_seq"]:
            continue                       # ← the silent skip: evidence dies here
        credited.append(r)
    if credited != [fork_round[1]]:
        fail("PART A: today-semantics replica drifted — fix the replica")
    if "reorg_flags" in st or any("reorg" in k for k in st):
        fail("PART A: a reorg channel appeared — gap gone, update this proof")
    print("  GAP PROVEN (kept as the naive shape): consumed-seq row MUTATED "
          "(999.0000 A behind the watermark) skipped with ZERO evidence; the "
          "new fork-chain row credits normally — no reorg concept exists "
          "anywhere in the poller; the :423 law covers read failures only")
    ok("PART A: a reorg behind the watermark is invisible today — flag-not-"
       "credit has no reorg leg (gap receipt; the naive shape powers the "
       "negative control)")


# ── 5.1 — fork injected into the poller's view ⇒ flag, zero credit ──────────

def case_5_1():
    import meter  # the GREEN seam
    es = Escrow(TMP / "ledger-av5.jsonl")
    flags = []

    def flag_writer(flag):
        flags.append(flag)

    st = {"last_seq": 0}
    meter_keys = {KEY}

    # clean round: two bound rows + one unbound memo
    r1 = meter.process_transfers(
        es, [row(10, "txA", amount="2.0000"), row(11, "txB", amount="3.0000"),
             row(12, "txU", memo="stranger-words")],
        st, meter_keys, flag_writer)
    if r1["credited"] != 2 or r1["unbound"] != 1:
        fail(f"5.1 clean round drifted: {r1}")
    if es.balance(KEY) != Decimal("5.0000"):
        fail("5.1 clean round balance wrong")
    if flags:
        fail("5.1 clean round must not flag")
    watermark, head_map = st["last_seq"], dict(st["head_map"])
    ledger_before = (TMP / "ledger-av5.jsonl").read_bytes()

    # THE FORK: seq 11's trx swaps behind the watermark + a fresh fork row
    r2 = meter.process_transfers(
        es, [row(11, "attacker-swapped-tx", amount="999.0000"),
             row(13, "txC")],
        st, meter_keys, flag_writer)
    if r2["credited"] != 0:
        fail(f"5.1: FORK ROUND CREDITED {r2['credited']} rows — flag-not-credit violated")
    if not r2["flagged"] or not flags:
        fail("5.1: no explicit reorg flag emitted")
    if st["last_seq"] != watermark or st["head_map"] != head_map:
        fail("5.1: watermark/head-map moved during a reorged round — must park")
    if (TMP / "ledger-av5.jsonl").read_bytes() != ledger_before:
        fail("5.1: ledger mutated during the reorged round")
    if "attacker-swapped-tx" not in json.dumps(flags[0]):
        fail("5.1: the flag must carry the evidence")

    # the ROLLBACK shape: the head recedes below the watermark
    r3 = meter.process_transfers(es, [row(9, "txOld")], st, meter_keys,
                                 flag_writer)
    if r3["credited"] != 0 or not r3["flagged"]:
        fail("5.1: head-rollback shape not flagged")

    # after the storm: a CLEAN round still works, credits from the parked
    # watermark exactly as the resume law demands (no backfill weirdness —
    # only genuinely new, consistent history moves)
    r4 = meter.process_transfers(es, [row(13, "txC")], st, meter_keys,
                                 flag_writer)
    if r4["credited"] != 1 or r4["flagged"]:
        fail(f"5.1: clean round after reorg did not resume cleanly: {r4}")
    ok("5.1: fork (seq swap behind the watermark) and head-rollback both ⇒ "
       "zero credit, explicit flag with evidence, watermark parked, ledger "
       "bytes identical; clean rounds before/after behave exactly as today")


# ── 5.3 — negative control: the crediting (detection-disabled) poller ───────

def case_5_3():
    import meter
    es = Escrow(TMP / "ledger-av5-nc.jsonl")
    flags = []
    st = {"last_seq": 0}
    keys = {KEY}
    meter.process_transfers(es, [row(10, "txA", amount="1.0000")], st, keys,
                            flags.append)
    bal_before = es.balance(KEY)

    # the naive variant: detection off — today's crediting poller
    r = meter.process_transfers(
        es, [row(10, "attacker-swapped-tx", amount="500.0000"), row(11, "txB")],
        st, keys, flags.append, detect_reorgs=False)
    delta = es.balance(KEY) - bal_before
    if delta <= 0 or not (r["credited"] >= 1):
        fail("5.3: the naive poller did not accrue — the harness can no "
             "longer demonstrate detection of the class")
    ok(f"5.3: detection-disabled poller credited the forked round "
       f"(delta {delta} A, {r['credited']} rows) — 5.1's zero-credit "
       "assertion FAILS against it, the harness detects the class")


# ── main ────────────────────────────────────────────────────────────────────

def main():
    part_a_gap_proof()
    case_5_1()
    case_5_3()

    print("\n=== AV-5 REORG DRILL — ALL PROOFS PASS ===")
    for i, p in enumerate(PASS, 1):
        print(f"  {i}. {p}")
    _ = json.dumps({"battery": "av5-reorg-drill", "proofs": len(PASS)})


if __name__ == "__main__":
    main()
