#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""
test_x402_meter.py — the x402-RAID-Z33 proof battery.

THE THREE NAMED TESTS (Tally autonomous.ts — the member-agent stop logic):
    test_halt_budget · test_halt_fraud · test_halt_infra
plus a named proof for every raided law:
    credit-from-settlement · pause-not-kill · upto ceiling ·
    rate_set cost basis + tithe · the 4-state receipt · quote guards.

Run:  python3 scripts/buzz-meter/test_x402_meter.py   (exit 0 = green)
"""
import copy
import json
import os
import sys
import tempfile
import time
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voucher_escrow import (  # noqa: E402
    Escrow, RateSet, InsufficientVoucher, NonceReplay, TermsMismatch, VoucherError,
)
from x402_meter import (  # noqa: E402
    PENDING_ANCHOR, PASSED, FAILED, INCONCLUSIVE,
    HALT_BUDGET, HALT_FRAUD, HALT_INFRA,
    Halt, SettlementMismatch, NotPriced, RefusedQuote,
    Quote, QuotingDesk, Session, audit_receipt, credit_from_settlement,
    halt_on_budget, halt_on_fraud, halt_on_infra, lane_pricing,
)

TMP = Path(tempfile.mkdtemp(prefix="x402-test-"))
PASS = []


def ok(label):
    PASS.append(label)


# the test lane: 0.0010 A per mesh_second (battery fixture — a REAL lane basis
# is fence-held in rate_set.json, which is why it ships null today)
RS = RateSet(version="x402-battery-v1", cost_basis_ref="battery-fixture",
             rates={"mesh_second": Decimal("0.0010")})
RS_INDEX = {"x402-battery-v1": Decimal("0.0010")}

es = Escrow(TMP / "ledger.jsonl")

# ── 1 · CREDIT-FROM-SETTLEMENT ──────────────────────────────────────────────
observed = {"rail": "vaulta", "tx": "settle-tx-1", "from": "member.a",
            "amount": "2.0000", "memo": "member-abc"}
declared = {"rail": "vaulta", "tx": "settle-tx-1", "sender": "member.a",
            "amount": "2.0000"}
ev = credit_from_settlement(es, "member-abc", declared, observed)
assert es.balance("member-abc") == Decimal("2.0000")
ok("credit-from-settlement: credited the OBSERVED transfer's own 2.0000 A")

# replay: same settlement presented again — credits ONCE, balance unchanged
replay = credit_from_settlement(es, "member-abc", declared, observed)
assert replay["hash"] == ev["hash"] and es.balance("member-abc") == Decimal("2.0000")
ok("replayed settlement credits ONCE (idempotent key = voucher+tx) — balance still 2.0000")

# declared amount != settled amount → REJECT, nothing credited
try:
    credit_from_settlement(es, "member-abc",
                           {**declared, "amount": "9.0000"}, observed)
    raise SystemExit("FAIL: declared!=settled credited")
except SettlementMismatch as e:
    assert es.balance("member-abc") == Decimal("2.0000")
    ok(f"declared 9.0000 != settled 2.0000 → REJECT ({e}) — the price table never credits")

# rail mismatch → REJECT
try:
    credit_from_settlement(es, "member-abc", {**declared, "rail": "base"}, observed)
    raise SystemExit("FAIL: rail mismatch credited")
except SettlementMismatch:
    ok("rail mismatch (declared base, settled vaulta) → REJECT")

# base rail: observed USDC credits through the explicit cited rate
ev_usdc = credit_from_settlement(
    es, "member-abc",
    {"rail": "base", "tx": "0xsettle2", "sender": "0xmember", "amount": "10.000000",
     "rate_a_per_usdc": "2.5", "rate_ref": "estate-rate-card@demo"},
    {"rail": "base", "tx": "0xsettle2", "from": "0xmember", "amount": "10.000000"})
assert ev_usdc["currency_in"] == "USDC" and es.balance("member-abc") == Decimal("27.0000")
ok("base-rail settlement: 10 USDC @ cited 2.5 A/USDC → 25.0000 A; balance 27.0000")

# ── 2 · PAUSE-NOT-KILL — the metered session ────────────────────────────────
sess = Session(voucher="member-abc", escrow=es, rate_set=RS).open()
billed, state = sess.burn(1000)     # affordable (int(27/0.0011)=24545) > requested
assert billed == 1000 and state == "ACTIVE"
ok(f"burn 1000s billed in full at 0.0010 A/s basis + tithe, still ACTIVE")

billed, state = sess.burn(10_000_000)   # bills the affordable rest, then pauses
assert billed == 23545 and state == "PAUSED"     # int((27.0-1.1)/0.0011)
assert es.balance("member-abc") == Decimal("0.0005")
ok(f"burn beyond balance bills only the affordable {billed}s then PAUSED at zero "
   f"(residual 0.0005 A) — never overdrawn, never killed")

billed, state = sess.burn(5)
assert billed == 0 and state == "PAUSED"
ok("a PAUSED meter bills nothing (state-before-balance)")

# credit resumes — pause-not-kill on the money side
sess.credit({"rail": "vaulta", "tx": "settle-tx-9", "sender": "member.a", "amount": "1.0000"},
            {"rail": "vaulta", "tx": "settle-tx-9", "from": "member.a", "amount": "1.0000"})
assert sess.state == "ACTIVE"
ok("a credit RESUMES the paused session — PAUSE, not KILL")

# close is the only kill, and it is the member's call
sess.begin_settle(); sess.close()
try:
    sess.burn(1)
    raise SystemExit("FAIL: burn from CLOSED accepted")
except VoucherError:
    ok("CLOSED refuses burns — close (the member's call) is the only kill")
try:
    Session(voucher="member-abc", escrow=es, rate_set=RS, state="CLOSED").open()
    raise SystemExit("FAIL: reopen accepted")
except VoucherError:
    ok("a CLOSED session never reopens")

# ── 3 · UPTO CEILING ────────────────────────────────────────────────────────
es2 = Escrow(TMP / "upto.jsonl")
es2.deposit("member-xyz", "10.0000", vaulta_tx="fund-1")

# clamp: metered 5.0000 basis + tithe = 5.5000, ceiling 1.0000 → settled 1.0000
ev_u = es2.settle_upto("member-xyz", "q-clamp-1", "1.0000", "1.0000",
                       [("mesh_second", 5000)], RS)
assert Decimal(ev_u["upto"]["settled_a"]) == Decimal("1.0000")
assert Decimal(ev_u["upto"]["metered_basis_a"]) == Decimal("5.0000")
assert es2.balance("member-xyz") == Decimal("9.0000")
ok("upto clamp: metered 5.5000 all-in, ceiling 1.0000 → settled exactly 1.0000 "
   "(min(metered, ceiling); tithe 0.0909 its own line)")

# nonce consumed EVEN ON A ZERO settle — the proxy's amount-0 burn
ev_z = es2.settle_upto("member-xyz", "q-zero-1", "1.0000", "1.0000", [], RS)
assert ev_z["line_items"] == [] and es2.balance("member-xyz") == Decimal("9.0000")
ok("ZERO settle consumes the nonce (nothing charged, nonce burned)")
try:
    es2.settle_upto("member-xyz", "q-zero-1", "1.0000", "1.0000", [], RS)
    raise SystemExit("FAIL: nonce replay accepted")
except NonceReplay:
    ok("replaying the zero-settle quote → NonceReplay (single use, even at amount 0)")
try:
    es2.settle_upto("member-xyz", "q-clamp-1", "1.0000", "1.0000",
                    [("mesh_second", 1)], RS)
    raise SystemExit("FAIL: nonce replay accepted")
except NonceReplay:
    ok("replaying the settled quote → NonceReplay")

# advertised != signed → TermsMismatch, nothing written, nonce NOT burned
try:
    es2.settle_upto("member-xyz", "q-mismatch-1", "0.1000", "100.0000",
                    [("mesh_second", 1)], RS)
    raise SystemExit("FAIL: advertised!=signed accepted")
except TermsMismatch:
    assert es2.upto_quote_used("q-mismatch-1") is None
    ok("'quote 0.10, sign 100' refused (advertised == signed) — fail-atomic, "
       "nonce survives a REJECTED settle")

# above balance → refuse-before-write
try:
    es2.settle_upto("member-xyz", "q-solv-1", "99.0000", "99.0000",
                    [("mesh_second", 90_000)], RS)
    raise SystemExit("FAIL: above-balance settle accepted")
except InsufficientVoucher:
    assert es2.upto_quote_used("q-solv-1") is None
    ok("above-balance upto settle REFUSED, nothing written")

# ── 4 · RATE_SET COST BASIS + TITHE ─────────────────────────────────────────
price = lane_pricing({"lane": "compute_edge", "cost_basis_a_per_second": "0.0010",
                      "observed_at": time.time(), "stale_after_s": 86400}, 600)
assert price["basis"] == "0.6000" and price["tithe"] == "0.0600" and price["total"] == "0.6600"
ok("lane pricing: 600s × 0.0010 A/s = 0.6000 basis + 0.0600 tithe = 0.6600 — "
   "margin is the tithe line, never inside the rate")

try:
    lane_pricing({"lane": "compute_edge", "cost_basis_a_per_second": None}, 600)
    raise SystemExit("FAIL: unpriced lane offered")
except NotPriced:
    ok("unpriced lane (null basis, exactly what rate_set.json ships) → NotPriced — "
       "offered nowhere")
try:
    lane_pricing({"lane": "compute_edge", "cost_basis_a_per_second": "0.0010",
                  "observed_at": time.time() - 90000, "stale_after_s": 86400}, 600)
    raise SystemExit("FAIL: stale basis offered")
except NotPriced:
    ok("stale basis (> stale_after_s) → NotPriced — the option disappears, "
       "it never mis-prices")

# ── 5 · THE 4-STATE RECEIPT ─────────────────────────────────────────────────
clean = copy.deepcopy(ev_u)
st, _ = audit_receipt(clean, {}, RS_INDEX)
assert st == PENDING_ANCHOR
ok(f"no anchor record yet → {PENDING_ANCHOR} (honey)")
st, _ = audit_receipt(clean, {clean["hash"]: {"seam": "two-tier-anchor", "seq": 1}}, RS_INDEX)
assert st == PASSED
ok(f"anchored + every check clean → {PASSED} (capped)")

# FAILED needs PROOF — plant each named defect, watch the check catch it
tampered = copy.deepcopy(ev_u)
tampered["line_items"][0]["charged"] = "0.0001"
st, checks = audit_receipt(tampered, {tampered["hash"]: {}}, RS_INDEX)
assert st == FAILED and any(c.startswith("arithmetic_fraud") for c in checks)
ok(f"tampered line amount → {FAILED} by arithmetic_fraud (computed red, not a guess)")

bad_tithe = copy.deepcopy(ev_u)
for li in bad_tithe["line_items"]:
    if li["resource"] == "tithe.founder":
        li["charged"] = "0.0001"
st, checks = audit_receipt(bad_tithe, {bad_tithe["hash"]: {}}, RS_INDEX)
assert st == FAILED and any(c.startswith("tithe_mismatch") for c in checks)
ok(f"tithe buried/shrunk → {FAILED} by tithe_mismatch (the 10% law is auditable)")

over = copy.deepcopy(ev_u)
over["upto"]["settled_a"] = "6.0000"    # above metered 5.5000 AND ceiling 1.0000
st, checks = audit_receipt(over, {over["hash"]: {}}, RS_INDEX)
assert st == FAILED and any(c.startswith("over_max") for c in checks) \
    and any(c.startswith("over_capture") for c in checks)
ok(f"settled above metered and ceiling → {FAILED} by over_capture + over_max")

back = copy.deepcopy(ev_u)
back["ts"] = back["ts"] - 3600
st, checks = audit_receipt(back, {back["hash"]: {}}, RS_INDEX, prior_ts=ev_u["ts"])
assert st == FAILED and any(c.startswith("backdated") for c in checks)
ok(f"backdated receipt → {FAILED} by backdated (forward-only)")

unknown = copy.deepcopy(ev_u)
unknown["line_items"][0]["rate_set_ref"] = "rateset-void"
st, checks = audit_receipt(unknown, {}, RS_INDEX)
assert st == INCONCLUSIVE
ok(f"unresolvable rate_set_ref → {INCONCLUSIVE} (nectar) — never a guess")
st, _ = audit_receipt(clean, {clean["hash"]: "unreadable"}, RS_INDEX)
assert st == INCONCLUSIVE
ok(f"unreadable anchor record → {INCONCLUSIVE}")

# ── 6 · QUOTE GUARDS — pre-payment, xorv guard chain ────────────────────────
desk = QuotingDesk(ttl_s=600)
q = desk.quote("compute_edge", "1.0000", now=1000.0)
q.guards(now=1000.0)
ok("fresh quote passes its guards")
try:
    q.guards(now=1000.0, seller_can_serve=False)
    raise SystemExit("FAIL: unservable offer allowed")
except RefusedQuote:
    ok("seller cannot serve → refused BEFORE payment (never pay for the unservable)")
q_used = desk.quote("compute_edge", "1.0000", now=1000.0)
desk.mark_used(q_used.quote_id)
try:
    q_used.guards(now=1100.0)
    raise SystemExit("FAIL: used quote allowed")
except RefusedQuote:
    ok("used quote → 409-already-paid class refusal, single use")
try:
    q.guards(now=2000.0)
    raise SystemExit("FAIL: expired quote allowed")
except RefusedQuote:
    ok("expired quote → refused — the price was pinned to the TTL it advertised")

# ── THE THREE NAMED TESTS ───────────────────────────────────────────────────

def test_halt_budget():
    """BUDGET: remaining < ceiling → PAUSE. A credit resumes. Never a kill."""
    es3 = Escrow(TMP / "halt-budget.jsonl")
    es3.deposit("agent-1", "0.5000", vaulta_tx="hb-1")
    s = Session(voucher="agent-1", escrow=es3, rate_set=RS).open()
    qq = desk.quote("compute_edge", "1.0000", now=time.time())
    try:
        halt_on_budget(s, qq)
        raise SystemExit("FAIL: no budget halt below ceiling")
    except Halt as h:
        assert (h.reason, h.kind) == (HALT_BUDGET, "PAUSE")
        assert s.state == "PAUSED"
    s.credit({"rail": "vaulta", "tx": "hb-2", "sender": "x", "amount": "2.0000"},
             {"rail": "vaulta", "tx": "hb-2", "from": "x", "amount": "2.0000"})
    assert s.state == "ACTIVE"
    qq2 = desk.quote("compute_edge", "1.0000", now=time.time())
    halt_on_budget(s, qq2)          # no raise: budget recovered
    ok("NAMED TEST budget: 0.5000 A < 1.0000 A ceiling → PAUSE (resume on credit, "
       "no kill); after credit the same ceiling passes")


def test_halt_fraud():
    """FRAUD: a FAILED audit (proven defect) → KILL the loop."""
    tampered = copy.deepcopy(ev_u)
    tampered["line_items"][0]["charged"] = "0.0001"
    st, checks = audit_receipt(tampered, {tampered["hash"]: {}}, RS_INDEX)
    assert st == FAILED
    try:
        halt_on_fraud(st, checks)
        raise SystemExit("FAIL: fraud did not kill")
    except Halt as h:
        assert (h.reason, h.kind) == (HALT_FRAUD, "KILL")
    # only PROVEN fraud kills — PENDING/INCONCLUSIVE never do
    halt_on_fraud(PENDING_ANCHOR, [])
    halt_on_fraud(INCONCLUSIVE, ["terms unresolvable"])
    halt_on_fraud(PASSED, [])
    ok("NAMED TEST fraud: FAILED audit → KILL; PENDING/INCONCLUSIVE/PASSED never kill "
       "(kill needs proof, pause-not-kill needs less)")


def test_halt_infra():
    """INFRA: settle failure #1 → PAUSE (retry); #2 consecutive → KILL."""
    es4 = Escrow(TMP / "halt-infra.jsonl")
    es4.deposit("agent-2", "1.0000", vaulta_tx="hi-1")
    s = Session(voucher="agent-2", escrow=es4, rate_set=RS).open()
    h1 = halt_on_infra(s, RuntimeError("settle timeout"))
    assert (h1.reason, h1.kind) == (HALT_INFRA, "PAUSE") and s.state == "PAUSED"
    try:
        raise halt_on_infra(s, RuntimeError("settle timeout again"))
    except Halt as h2:
        assert (h2.reason, h2.kind) == (HALT_INFRA, "KILL")
    ok("NAMED TEST infra: settle failure #1 → PAUSE (retry armed); 2 consecutive → KILL")


test_halt_budget()
test_halt_fraud()
test_halt_infra()

# ── the chain carries every new event shape ─────────────────────────────────
for e, name in ((es, "settlement/session ledger"), (es2, "upto ledger")):
    n = e.verify_chain()
    ok(f"hash chain verifies with the new event shapes ({name}): {n} events")

print("\n=== X402-RAID-Z33 — ALL PROOFS PASS ===")
for i, p in enumerate(PASS, 1):
    print(f"  {i}. {p}")

# the ledger is throwaway proof state; nothing to clean (tempdir)
_ = json.dumps({"battery": "x402-raid-z33", "proofs": len(PASS)})
