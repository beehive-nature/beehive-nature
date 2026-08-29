#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1
# Licensor: Travis Mark Remington <lovis@skaists.dev>
# The b-meter commercial moat — Business Source License 1.1, see LICENSE
# in this directory. Change Date: August 29, 2030 (the publish commit + 4 years).
# Change License: GPL-2.0-or-later. Non-production use per the Additional
# Use Grant in that LICENSE; production use requires a commercial license
# from the Licensor.
# ────────────────────────────────────────────────────────────────────────────
"""
voucher_escrow.py — Voucher/escrow engine for Vaulta-A-metered compute (vRAM / LLM API).

The security model IS the design: an agent key spends only against a prepaid
voucher balance held in this escrow ledger. No wallet, no drainable pool —
a stolen key can at worst spend the remaining voucher on metered compute.
Blast radius = the voucher. Bounded by construction.

Laws implemented (from the ruled record):
- A-denominated (Vaulta), resource-quantity line items, never fiat-pegged.
- Every charge carries: exact quantity, explicit rate, versioned rate_set_ref,
  charged amount. Totals are COMPUTED, never stored.
- THE TITHE: 10% to the founder on top of cost basis, a DISTINCT line on
  every receipt. The 10% never moves without founder word.
- Ledger is append-only, hash-chained (tamper-evident). Balances are derived.
- Refuse-before-write: an over-balance charge writes NOTHING.
- Deposits reference a Vaulta tx (the watch_account read-back seam).

MERGE NOTE (z1, 2026-08-29): Seat-1's engine merged into the till. The closed
resource enum is RECONCILED to the estate's ONE enum — SPEC-SPEND-RECEIPT-1's
class set plus the Lane M dispatch additions (prefill_token / decode_token),
the same set meter.py enforces. One engine, one enum.

Zero dependencies beyond the standard library. Python 3.10+.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path
from typing import Iterator

getcontext().prec = 28
Q4 = Decimal("0.0001")

TITHE_RATE = Decimal("0.10")  # 10% — founder-ruled, never moves without his word
GENESIS_HASH = "0" * 64

# THE closed resource enum — the estate's one set (SPEC-SPEND-RECEIPT-1 + the
# Lane M dispatch ruling). An unlisted class is added BY RULING, never by a caller.
RESOURCE_CLASSES = frozenset({
    "mesh_second", "vram_byte_second", "ram_byte", "cpu_microsecond",
    "net_byte", "chunk_count", "storage_byte", "chain_fee",
    "prefill_token", "decode_token",
})


def _a(x) -> Decimal:
    """Quantize to Vaulta A's 4-decimal precision."""
    return Decimal(x).quantize(Q4, rounding=ROUND_HALF_UP)


class VoucherError(Exception):
    pass


class InsufficientVoucher(VoucherError):
    """Charge exceeds remaining balance. Nothing was written."""


class TamperError(VoucherError):
    """Hash chain broken — the ledger was edited."""


@dataclass(frozen=True)
class RateSet:
    """Versioned pricing law. Rates are A per unit of the CLOSED resource enum."""
    version: str
    cost_basis_ref: str                    # e.g. "anthropic-posted-2026-08"
    rates: dict[str, Decimal]              # resource_class -> A per unit

    def __post_init__(self):
        unknown = set(self.rates) - RESOURCE_CLASSES
        if unknown:
            # Closed enum: an unlisted rail is added BY RULING, not by a caller.
            raise VoucherError(f"unknown resource class(es): {sorted(unknown)}")

    def rate(self, resource: str) -> Decimal:
        if resource not in self.rates:
            raise VoucherError(f"no rate for {resource!r} in rate_set {self.version}")
        return Decimal(self.rates[resource])


class Escrow:
    """Append-only, hash-chained JSONL ledger. Balances derived, never stored."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.touch()

    # ---------- chain plumbing ----------

    def _events(self) -> Iterator[dict]:
        with self.path.open() as f:
            for line in f:
                line = line.strip()
                if line:
                    yield json.loads(line)

    def _tip(self) -> str:
        tip = GENESIS_HASH
        for ev in self._events():
            tip = ev["hash"]
        return tip

    @staticmethod
    def _hash(ev_body: dict, prev: str) -> str:
        canon = json.dumps(ev_body, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256((prev + canon).encode()).hexdigest()

    def _append(self, ev_body: dict) -> dict:
        prev = self._tip()
        h = self._hash(ev_body, prev)
        ev = {**ev_body, "prev": prev, "hash": h}
        with self.path.open("a") as f:
            f.write(json.dumps(ev, sort_keys=True, separators=(",", ":")) + "\n")
        return ev

    def verify_chain(self) -> int:
        """Walk the chain; raise TamperError on any break. Returns event count."""
        prev, n = GENESIS_HASH, 0
        for ev in self._events():
            body = {k: v for k, v in ev.items() if k not in ("prev", "hash")}
            if ev["prev"] != prev or self._hash(body, prev) != ev["hash"]:
                raise TamperError(f"chain broken at event {n}")
            prev, n = ev["hash"], n + 1
        return n

    # ---------- voucher operations ----------

    def deposit(self, voucher: str, amount_a, vaulta_tx: str) -> dict:
        """Top-up read back from the watch_account: every deposit cites its tx.
        The ref may be a chain tx id or the read-back evidence trail (the P2
        checkpoint/instruction id) where history APIs are 410-gone — cited
        provenance is the law, a tx-shaped string is not."""
        amt = _a(amount_a)
        if amt <= 0:
            raise VoucherError("deposit must be positive")
        if not vaulta_tx:
            raise VoucherError("deposit requires a vaulta_tx reference")
        return self._append({
            "type": "DEPOSIT", "voucher": voucher, "ts": time.time(),
            "amount": str(amt), "vaulta_tx": vaulta_tx,
        })

    def balance(self, voucher: str) -> Decimal:
        """Derived from events. There is no stored balance to corrupt."""
        bal = Decimal("0")
        for ev in self._events():
            if ev.get("voucher") != voucher:
                continue
            if ev["type"] == "DEPOSIT":
                bal += Decimal(ev["amount"])
            elif ev["type"] == "CHARGE":
                bal -= sum(Decimal(li["charged"]) for li in ev["line_items"])
        return _a(bal)

    def charge(self, voucher: str, usage: list[tuple[str, Decimal | int | str]],
               rate_set: RateSet) -> dict:
        """
        Meter usage against the voucher. usage = [(resource_class, quantity), ...].
        Refuses BEFORE writing if the total (incl. tithe) exceeds balance.
        Returns the receipt event. Total is computed by receipt_total(), never stored.
        """
        if not usage:
            raise VoucherError("empty usage")
        line_items = []
        subtotal = Decimal("0")
        for resource, qty in usage:
            q = Decimal(str(qty))
            if q <= 0:
                raise VoucherError(f"quantity must be positive: {resource}={qty}")
            rate = rate_set.rate(resource)
            charged = _a(q * rate)
            subtotal += charged
            line_items.append({
                "resource": resource, "quantity": str(q),
                "rate": str(rate), "rate_set_ref": rate_set.version,
                "charged": str(charged),
            })
        # THE TITHE — a distinct line, 10% on top of cost basis.
        tithe = _a(subtotal * TITHE_RATE)
        line_items.append({
            "resource": "tithe.founder", "quantity": "1",
            "rate": str(TITHE_RATE), "rate_set_ref": rate_set.version,
            "charged": str(tithe),
        })
        total = subtotal + tithe
        bal = self.balance(voucher)
        if total > bal:
            raise InsufficientVoucher(
                f"charge {total} A exceeds voucher balance {bal} A — refused, nothing written"
            )
        return self._append({
            "type": "CHARGE", "voucher": voucher, "ts": time.time(),
            "cost_basis_ref": rate_set.cost_basis_ref,
            "line_items": line_items,
        })


def receipt_total(charge_event: dict) -> Decimal:
    """The one true total: computed from line items every time, never stored."""
    return _a(sum(Decimal(li["charged"]) for li in charge_event["line_items"]))


def receipt_tithe(charge_event: dict) -> Decimal:
    return _a(sum(Decimal(li["charged"]) for li in charge_event["line_items"]
                  if li["resource"] == "tithe.founder"))
