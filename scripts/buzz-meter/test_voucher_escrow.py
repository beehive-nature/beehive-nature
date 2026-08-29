#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""test_voucher_escrow.py — proof battery. Every claim in the module, exercised.

z1 merge note (2026-08-29): rate names reconciled to the estate's ONE closed
enum (prefill_token / decode_token / vram_byte_second — the SPEC-SPEND-RECEIPT-1
set meter.py enforces); the math is unchanged, so every proof stands.
Run:  python3 scripts/buzz-meter/test_voucher_escrow.py   (exit 0 = green)
"""
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voucher_escrow import (  # noqa: E402
    Escrow, RateSet, InsufficientVoucher, TamperError, VoucherError,
    receipt_total, receipt_tithe,
)

LEDGER = Path("/tmp/escrow-test/ledger.jsonl")
if LEDGER.exists():
    LEDGER.unlink()

rs = RateSet(
    version="rate_set-2026-08-29-v1",
    cost_basis_ref="anthropic-posted-2026-08",
    rates={
        "prefill_token":    Decimal("0.000002"),   # A per input token
        "decode_token":     Decimal("0.000010"),   # A per output token
        "vram_byte_second": Decimal("0.0000000001"),
    },
)

es = Escrow(LEDGER)
PASS = []

# 1. Deposit requires a Vaulta tx ref (watch_account read-back seam)
try:
    es.deposit("member-abc", "5.0", vaulta_tx="")
    raise SystemExit("FAIL: deposit without tx accepted")
except VoucherError:
    PASS.append("deposit refuses without vaulta_tx")

ev = es.deposit("member-abc", "5.0", vaulta_tx="6eddf2c1demo")
assert ev["type"] == "DEPOSIT"
PASS.append(f"deposit 5.0000 A recorded, tx-cited ({ev['vaulta_tx']})")

# 2. Balance is derived, correct
assert es.balance("member-abc") == Decimal("5.0000"), es.balance("member-abc")
PASS.append("balance derived = 5.0000 A")

# 3. A metered charge: 100k tokens in, 20k out + the 10% tithe line
r = es.charge("member-abc",
              [("prefill_token", 100_000), ("decode_token", 20_000)], rs)
tot, tithe = receipt_total(r), receipt_tithe(r)
# cost basis: 100000*0.000002 + 20000*0.000010 = 0.2 + 0.2 = 0.4; tithe 0.04; total 0.44
assert tot == Decimal("0.4400"), tot
assert tithe == Decimal("0.0400"), tithe
assert any(li["resource"] == "tithe.founder" for li in r["line_items"])
assert all("rate_set_ref" in li and "rate" in li and "quantity" in li
           for li in r["line_items"])
PASS.append(f"charge metered: total {tot} A incl. DISTINCT tithe line {tithe} A "
            f"(10% on 0.4000 cost basis)")

# 4. Balance after charge
assert es.balance("member-abc") == Decimal("4.5600"), es.balance("member-abc")
PASS.append("balance after charge = 4.5600 A")

# 5. REFUSE-BEFORE-WRITE: over-balance charge writes nothing
before = LEDGER.read_text()
try:
    es.charge("member-abc", [("decode_token", 5_000_000)], rs)  # 50 A + tithe
    raise SystemExit("FAIL: over-balance charge accepted")
except InsufficientVoucher as e:
    assert LEDGER.read_text() == before, "ledger changed on refusal!"
    PASS.append(f"over-balance REFUSED, nothing written: {e}")

# 6. The stolen-key bound: a compromised key can only drain the voucher into
#    metered compute, then hits zero. Prove the ceiling.
drained = 0
while True:
    try:
        es.charge("member-abc", [("decode_token", 100_000)], rs)  # 1.1 A/hit
        drained += 1
    except InsufficientVoucher:
        break
assert es.balance("member-abc") < Decimal("1.1")
PASS.append(f"stolen-key ceiling proven: {drained} charges then hard stop, "
            f"residual {es.balance('member-abc')} A — blast radius = the voucher")

# 7. Unknown resource class refused (closed enum — added by ruling, not caller)
try:
    RateSet(version="x", cost_basis_ref="x", rates={"magic.beans": Decimal("1")})
    raise SystemExit("FAIL: unknown resource class accepted")
except VoucherError:
    PASS.append("closed resource enum: unknown class refused at rate-set")

# 8. Tamper evidence: edit one byte in the ledger, chain verification fails
n = es.verify_chain()
PASS.append(f"hash chain verifies clean: {n} events")
lines = LEDGER.read_text().splitlines()
ev1 = json.loads(lines[1])
for li in ev1.get("line_items", []):
    li["charged"] = "0.0001"            # attacker shrinks their own bill
lines[1] = json.dumps(ev1, sort_keys=True, separators=(",", ":"))
LEDGER.write_text("\n".join(lines) + "\n")
try:
    es.verify_chain()
    raise SystemExit("FAIL: tampered ledger verified")
except TamperError as e:
    PASS.append(f"tamper caught: {e}")

print("\n=== VOUCHER/ESCROW ENGINE — ALL PROOFS PASS ===")
for i, p in enumerate(PASS, 1):
    print(f"  {i}. {p}")

# ============================================================
# USDC-ON-BASE RAIL — proofs 11–16 (Seat-1's extension, spec-enum rates)
# ============================================================
LEDGER2 = Path("/tmp/escrow-test/ledger-usdc.jsonl")
if LEDGER2.exists():
    LEDGER2.unlink()
es2 = Escrow(LEDGER2)
P2 = []

# 11. USDC deposit requires tx AND rate_ref; refuses without either
for kwargs in ({"base_tx": "", "rate_a_per_usdc": "2.5", "rate_ref": "pool@demo"},
               {"base_tx": "0xabc", "rate_a_per_usdc": "2.5", "rate_ref": ""}):
    try:
        es2.deposit_usdc("member-x", "10.0", **kwargs)
        raise SystemExit("FAIL: incomplete USDC deposit accepted")
    except VoucherError:
        pass
P2.append("usdc deposit refuses without base_tx / rate_ref")

# 12. USDC in, A credited at an explicit cited rate — balance is A-only
ev = es2.deposit_usdc("member-x", "10.0", base_tx="0xbase123",
                      rate_a_per_usdc="2.5", rate_ref="estate-rate-card@v1-demo")
assert ev["currency_in"] == "USDC" and ev["chain_in"] == "base"
assert ev["usdc_amount"] == "10.000000" and ev["rate_a_per_usdc"] == "2.5"
assert es2.balance("member-x") == Decimal("25.0000")
P2.append("10 USDC @ 2.5 A/USDC -> 25.0000 A credited; rate + rate_ref on the event")

# 13. Mixed funding: A deposit stacks on the same voucher, one A balance
es2.deposit("member-x", "5.0", vaulta_tx="vlt789")
assert es2.balance("member-x") == Decimal("30.0000")
P2.append("mixed rails (USDC-base + A-vaulta) sum to one A balance: 30.0000")

# 14. Metering unchanged: charge against the mixed balance, tithe intact
r = es2.charge("member-x", [("decode_token", 20_000)], rs)
assert receipt_total(r) == Decimal("0.2200") and receipt_tithe(r) == Decimal("0.0200")
assert es2.balance("member-x") == Decimal("29.7800")
P2.append("charge on mixed-funded voucher: 0.2200 A incl. 0.0200 tithe")

# 15. Dust refused: a USDC deposit whose credit rounds to zero A never lands
try:
    es2.deposit_usdc("member-x", "0.00001", base_tx="0xdust",
                     rate_a_per_usdc="2.5", rate_ref="estate-rate-card@v1-demo")
    raise SystemExit("FAIL: dust deposit accepted")
except VoucherError:
    P2.append("dust deposit (credits 0.0000 A) refused")

# 16. Chain still verifies with the new event shape
n = es2.verify_chain()
P2.append(f"chain verifies with USDC events: {n} events")

print("\n=== USDC-ON-BASE RAIL — ALL PROOFS PASS ===")
for i, p in enumerate(P2, 11):
    print(f"  {i}. {p}")
