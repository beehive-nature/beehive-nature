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

x402-RAID-Z33 laws (2026-09-04, pinout/tally rows read at source):
- CREDIT FROM SETTLEMENT: a deposit is keyed on its settlement id — a
  replayed settlement credits ONCE (idempotent return of the original event).
  The credited amount is the OBSERVED settled transfer's own amount, never a
  price table (the declared-vs-observed context check lives in
  x402_meter.credit_from_settlement).
- UPTO CAPTURE: settle_upto() consumes the quote's nonce even on a ZERO
  settle; the settled amount is min(metered, ceiling), never above the
  signed ceiling; advertised max must equal signed max. The nonce set IS the
  ledger — append-only and restart-surviving, so the qisma RAM-nonce trap
  cannot exist here.

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


class NonceReplay(VoucherError):
    """Quote nonce already consumed — single use, even on a zero settle.
    Nothing was written (the original settle stands)."""


class TermsMismatch(VoucherError):
    """Advertised terms != signed terms (e.g. quote max != signed max —
    the 'quote $0.10, sign $100' shape). Nothing was written."""


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

    def _settlement_seen(self, voucher: str, tx_ref: str) -> dict | None:
        """The idempotency seam (x402-RAID-Z33): a settlement is keyed on
        (voucher, tx-ref). Returns the ORIGINAL deposit event when the same
        settlement is presented again — the caller credits nothing twice."""
        for ev in self._events():
            if ev.get("voucher") != voucher or ev.get("type") != "DEPOSIT":
                continue
            if ev.get("vaulta_tx") == tx_ref or ev.get("base_tx") == tx_ref:
                return ev
        return None

    def upto_quote_used(self, quote_id: str) -> dict | None:
        """The nonce set IS the ledger: any event carrying upto.quote_id means
        the nonce is consumed. Append-only, so it survives restart (the qisma
        RAM-nonce trap cannot exist in this engine)."""
        for ev in self._events():
            if ev.get("upto", {}).get("quote_id") == quote_id:
                return ev
        return None

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

    def deposit(self, voucher: str, amount_a, vaulta_tx: str,
                sender: str = "", memo: str = "") -> dict:
        """Top-up read back from the watch_account: every deposit cites its tx.
        The ref may be a chain tx id or the read-back evidence trail (the P2
        checkpoint/instruction id) where history APIs are 410-gone — cited
        provenance is the law, a tx-shaped string is not.

        x402-RAID-Z33: the (voucher, vaulta_tx) pair IS the settlement key —
        a replayed settlement returns the ORIGINAL event and credits once
        (pinout: idempotent credit keyed on sha256 of the settled transfer).

        A-RAIL RIDER (founder, 2026-08-29): the Vaulta rail is GASLESS and
        MEMO-NATIVE — a proper Vaulta account sends with memo = the meter key,
        so NO binding table exists on this rail. When the estate runs its own
        history-capable node, sender + memo land here as first-class fields;
        they are recorded when provided, never looked up from a table."""
        replay = self._settlement_seen(voucher, vaulta_tx)
        if replay is not None:
            return replay
        amt = _a(amount_a)
        if amt <= 0:
            raise VoucherError("deposit must be positive")
        if not vaulta_tx:
            raise VoucherError("deposit requires a vaulta_tx reference")
        ev = {
            "type": "DEPOSIT", "voucher": voucher, "ts": time.time(),
            "amount": str(amt), "vaulta_tx": vaulta_tx,
            "currency_in": "A", "chain_in": "vaulta",
        }
        if sender:
            ev["sender"] = sender
        if memo:
            ev["memo"] = memo
        return self._append(ev)

    def deposit_usdc(self, voucher: str, usdc_amount, base_tx: str,
                     rate_a_per_usdc, rate_ref: str) -> dict:
        """
        USDC-on-Base funding rail (founder ruling 2026-08-29: the second
        funding door; A stays the unit of account). The voucher is credited
        in A — the meter's unit of account never changes. The conversion is
        EXPLICIT on the event: usdc_amount, the rate used (A per USDC), and
        a versioned rate_ref naming where the rate was read. Balance math
        sees only the credited A. This rail carries gas and no memo, so the
        key↔Base-address BINDING TABLE (meter.py basebind) resolves which
        voucher to credit — per the rails-are-not-symmetric rider.
        """
        usdc = Decimal(str(usdc_amount)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        if usdc <= 0:
            raise VoucherError("usdc deposit must be positive")
        if not base_tx:
            raise VoucherError("usdc deposit requires a base_tx reference")
        if not rate_ref:
            raise VoucherError("usdc deposit requires a rate_ref (where the rate was read)")
        rate = Decimal(str(rate_a_per_usdc))
        if rate <= 0:
            raise VoucherError("conversion rate must be positive")
        replay = self._settlement_seen(voucher, base_tx)
        if replay is not None:
            return replay
        credited = _a(usdc * rate)
        if credited <= 0:
            raise VoucherError("credited A rounds to zero — deposit too small")
        return self._append({
            "type": "DEPOSIT", "voucher": voucher, "ts": time.time(),
            "amount": str(credited),            # A — what balance math sees
            "currency_in": "USDC", "chain_in": "base",
            "usdc_amount": str(usdc), "base_tx": base_tx,
            "rate_a_per_usdc": str(rate), "rate_ref": rate_ref,
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

    def settle_upto(self, voucher: str, quote_id: str, advertised_max_a,
                    signed_max_a, usage: list[tuple[str, Decimal | int | str]],
                    rate_set: RateSet) -> dict:
        """
        The `upto` capture (x402-RAID-Z33, Tally X402UptoProxy + handleComplete
        read at source, ported to the estate's ledger):

        1. NONCE: the quote is single-use. A second settle for the same
           quote_id raises NonceReplay and writes nothing. A ZERO settle
           (empty usage) still consumes the nonce — the proxy's "nonce burn
           even at amount 0" — because the append below happens regardless.
        2. TERMS: advertised max must equal signed max — the quote the member
           SAW is the quote the signature bound ("no quote $0.10, sign $100").
           Mismatch raises TermsMismatch, nothing written (fail-atomic: a
           rejected settle burns no nonce, mirroring the proxy's revert).
        3. CEILING: settled = min(metered, ceiling). The tithe stays a distinct
           line on top of the clamped basis; the TOTAL never exceeds the
           signed ceiling.
        4. SOLVENCY: refuse-before-write — an above-balance settle raises
           InsufficientVoucher and writes nothing.

        Not ported (EVM-specific, recorded): high-s rejection and the
        facilitator address bound in the signature — this seam has no ECDSA
        signature yet; when bSigner signs quotes, s-value and binder laws
        live in that organ, not here.
        """
        advertised = _a(advertised_max_a)
        signed = _a(signed_max_a)
        if advertised != signed:
            raise TermsMismatch(
                f"advertised max {advertised} != signed max {signed} — nothing written")
        if advertised <= 0:
            raise VoucherError("upto ceiling must be positive")
        if self.upto_quote_used(quote_id) is not None:
            raise NonceReplay(f"quote {quote_id} already settled — nonce consumed")
        # metered basis at the quote's rate law
        basis = Decimal("0")
        line_items = []
        for resource, qty in usage:
            q = Decimal(str(qty))
            if q <= 0:
                raise VoucherError(f"quantity must be positive: {resource}={qty}")
            rate = rate_set.rate(resource)
            charged = _a(q * rate)
            basis += charged
            line_items.append({
                "resource": resource, "quantity": str(q),
                "rate": str(rate), "rate_set_ref": rate_set.version,
                "charged": str(charged),
            })
        # clamp the BASIS so basis + tithe <= ceiling (charge = min(metered,
        # ceiling) with the tithe kept a distinct line, never inside the rate).
        # Q4 per-line rounding must not desync Σ lines from the basis — the
        # last line absorbs the sub-tick difference.
        ceiling_basis = (advertised / (Decimal("1") + TITHE_RATE)).quantize(Q4)
        settled_basis = min(basis, ceiling_basis)
        if settled_basis < basis:                      # the clamp actually bit
            scale = settled_basis / basis
            scaled = [_a(Decimal(li["charged"]) * scale) for li in line_items]
            scaled[-1] = _a(settled_basis - sum(scaled[:-1]))
            for li, ch in zip(line_items, scaled):
                li["charged"] = str(ch)
        tithe = _a(settled_basis * TITHE_RATE)
        total = _a(settled_basis) + tithe
        if total > advertised:                         # rounding pushed over — shave the basis
            excess = total - advertised
            settled_basis = _a(settled_basis - excess)
            for i in range(len(line_items)):
                take = min(excess, Decimal(line_items[i]["charged"]))
                line_items[i]["charged"] = str(_a(Decimal(line_items[i]["charged"]) - take))
                excess -= take
                if excess <= 0:
                    break
            tithe = _a(settled_basis * TITHE_RATE)
            total = _a(settled_basis) + tithe
        if line_items:
            line_items.append({
                "resource": "tithe.founder", "quantity": "1",
                "rate": str(TITHE_RATE), "rate_set_ref": rate_set.version,
                "charged": str(tithe),
            })
        bal = self.balance(voucher)
        if total > bal:
            raise InsufficientVoucher(
                f"upto settle {total} A exceeds voucher balance {bal} A — refused, nothing written")
        return self._append({
            "type": "CHARGE", "voucher": voucher, "ts": time.time(),
            "cost_basis_ref": rate_set.cost_basis_ref,
            "line_items": line_items,                # [] on a zero settle
            "upto": {
                "quote_id": quote_id, "ceiling_a": str(advertised),
                "metered_basis_a": str(_a(basis)),
                "settled_a": str(total),
                "law": "ceiling signed once; settled = min(metered, ceiling); "
                       "nonce consumed even at zero; advertised == signed",
            },
        })


def receipt_total(charge_event: dict) -> Decimal:
    """The one true total: computed from line items every time, never stored."""
    return _a(sum(Decimal(li["charged"]) for li in charge_event["line_items"]))


def receipt_tithe(charge_event: dict) -> Decimal:
    return _a(sum(Decimal(li["charged"]) for li in charge_event["line_items"]
                  if li["resource"] == "tithe.founder"))
