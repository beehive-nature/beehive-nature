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
x402_meter.py — the x402-RAID-Z33 RULE rows, ported to the estate's rails.

Source rows (docs/raids/X402-SORT-2026-09-01.md, seat z3.3, read at source
in the four repos): pinout session.mjs / server.mjs:creditFromPayment /
compute rates.json + lanePricing, Tally X402UptoProxy + verifyAgainst +
handleComplete + autonomous.ts, xorv createQuote + the pre-payment guard
chain + fetchHbarRate. Mechanisms, not files, travel: every Hedera SDK call
is replaced by the estate's own rail (the escrow ledger + the A unit); what
is lifted is the RULE shape.

THE FIVE NAMED LAWS (the dispatch's own words):
1. CREDIT-FROM-SETTLEMENT — credit ONLY from the settled transfer, never
   from the price table; declared-vs-observed mismatch → reject; a replayed
   settlement credits once (the idempotency key lives in voucher_escrow).
2. PAUSE-NOT-KILL — the metered session PAUSES at zero and never overdraws;
   a PAUSED session resumes on credit. Nothing but the member's close kills.
3. UPTO CEILING — ceiling signed once, settled = min(metered, ceiling),
   nonce consumed even on a zero settle, advertised max == signed max
   (voucher_escrow.settle_upto).
4. RATE_SET COST BASIS + TITHE — a lane rate is cost basis x (1 + margin);
   in the estate the margin IS the 10% tithe and rides as its OWN line,
   never inside the rate. 1 credit = 1 second. A STALE basis makes the lane
   disappear (NotPriced) rather than mis-price (the xorv stale-rate rule).
5. 4-STATE RECEIPT — every receipt audits to exactly one of
   PENDING_ANCHOR (honey) · PASSED (capped) · FAILED (red — proven defect
   only, never a guess) · INCONCLUSIVE (nectar), the same four states the
   z3.2 comb draws.

THE THREE NAMED STOPS (Tally autonomous.ts): budget · fraud · infra.
budget = PAUSE (resumes on credit) · fraud = KILL (a FAILED audit) ·
infra = PAUSE with retry, KILL after 2 consecutive settle failures.

Zero dependencies beyond the standard library. Python 3.10+.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from voucher_escrow import (  # noqa: F401 (re-exported for callers)
    Escrow, RateSet, InsufficientVoucher, NonceReplay, TermsMismatch,
    VoucherError, TITHE_RATE, receipt_total, receipt_tithe,
)

# the four verifier states — one spelling shared with the z3.2 comb
PENDING_ANCHOR = "PENDING_ANCHOR"   # honey  — anchored nowhere yet
PASSED = "PASSED"                   # capped — anchored + audit clean
FAILED = "FAILED"                   # red    — a PROVEN defect, never a guess
INCONCLUSIVE = "INCONCLUSIVE"       # nectar — terms unresolvable / record unreadable

HALT_BUDGET = "budget"              # remaining < ceiling → PAUSE, resume on credit
HALT_FRAUD = "fraud"                # a FAILED audit → KILL
HALT_INFRA = "infra"                # settle failure → PAUSE; 2 consecutive → KILL


class Halt(Exception):
    """A named stop (Tally autonomous.ts, three named reasons). kind is
    PAUSE (recoverable) or KILL (terminal) — pause-not-kill is the law, so
    only fraud and repeated infra may ever carry KILL."""

    def __init__(self, reason: str, kind: str, detail: str = ""):
        assert reason in (HALT_BUDGET, HALT_FRAUD, HALT_INFRA)
        assert kind in ("PAUSE", "KILL")
        super().__init__(f"{kind}.{reason}: {detail}")
        self.reason, self.kind, self.detail = reason, kind, detail


class SettlementMismatch(VoucherError):
    """Declared payment context != observed settled transfer — REJECT.
    Nothing was credited; the credit comes from the settlement or not at all."""


class NotPriced(VoucherError):
    """The lane's cost basis is stale or unset — the option DISAPPEARS
    rather than mis-prices (xorv fetchHbarRate: stale rate → omit)."""


class RefusedQuote(VoucherError):
    """A pre-payment guard fired BEFORE any money moved (xorv app.ts guard
    chain: expired / already paid / cannot serve — so a member never pays
    for an offer that cannot be served)."""


# ── 1 · credit-from-settlement ──────────────────────────────────────────────

def credit_from_settlement(escrow: Escrow, voucher: str, declared: dict,
                           observed: dict) -> dict:
    """
    pinout server.mjs:paymentContext / creditFromPayment, estate-shaped.

    `declared` — what the payer SAID they sent (amount, rail, sender, tx).
    `observed` — what the chain read RETURNED for that same tx (the
    chainpoll/basepoll row: amount, from, tx — the settled transfer itself).

    Laws:
    - the credited amount is observed['amount'] — the SETTLED transfer's own
      number, never the price table, never the declared number;
    - any mismatch (rail, tx id, sender, or declared amount != settled
      amount) → SettlementMismatch, NOTHING credited;
    - a replayed settlement (same tx) credits once — idempotent, the
      (voucher, tx) key lives in voucher_escrow.deposit.
    """
    for key in ("rail", "tx"):
        if declared.get(key) != observed.get(key):
            raise SettlementMismatch(
                f"{key}: declared {declared.get(key)!r} != observed "
                f"{observed.get(key)!r} — REJECT, nothing credited")
    if declared.get("sender") and observed.get("from") \
            and declared["sender"] != observed["from"]:
        raise SettlementMismatch("sender: declared "
                                 f"{declared['sender']!r} != observed {observed['from']!r}"
                                 " — REJECT, nothing credited")
    if Decimal(str(declared["amount"])) != Decimal(str(observed["amount"])):
        raise SettlementMismatch(
            f"amount: declared {declared['amount']} != settled {observed['amount']} "
            "(credit comes from the settlement or not at all) — REJECT")
    if Decimal(str(observed["amount"])) <= 0:
        raise SettlementMismatch("settled transfer carries zero — nothing to credit")
    if observed.get("rail") == "base":
        return escrow.deposit_usdc(
            voucher, observed["amount"], base_tx=observed["tx"],
            rate_a_per_usdc=declared["rate_a_per_usdc"], rate_ref=declared["rate_ref"])
    return escrow.deposit(voucher, observed["amount"], vaulta_tx=observed["tx"],
                          sender=observed.get("from", ""),
                          memo=observed.get("memo", ""))


# ── 2 · the quote — a commitment (xorv createQuote) ─────────────────────────

@dataclass
class Quote:
    """Price pinned at creation, single-use, expiring with the timeout it
    advertises. `max_amount_a` is the upto CEILING the member sees;
    `signed_max_a` is what the signature bound — settle_upto refuses any
    quote where they differ. The pricing fields are pinned at birth; only
    the desk's `used` flag ever moves."""
    quote_id: str
    lane: str
    max_amount_a: str
    signed_max_a: str
    expires_at: float
    created_at: float
    used: bool = False

    def guards(self, now: float, seller_can_serve: bool = True) -> None:
        """Pre-payment guards (xorv app.ts): run BEFORE the payment is
        offered, so a member never pays for an offer that cannot be served."""
        if self.used:
            raise RefusedQuote(f"quote {self.quote_id} already paid — single use")
        if now > self.expires_at:
            raise RefusedQuote(f"quote {self.quote_id} expired — the price was "
                               "pinned to a TTL, take a fresh one")
        if not seller_can_serve:
            raise RefusedQuote("seller cannot serve this offer right now — "
                               "refused BEFORE payment, not after")


@dataclass
class QuotingDesk:
    """Mints quotes; remembers used/expired in ONE place (single-use is a
    desk duty — the ledger-side nonce burn is the durable half)."""
    ttl_s: float = 600.0
    _n: int = 0
    live: dict = field(default_factory=dict)

    def quote(self, lane: str, max_amount_a: str, now: float | None = None) -> Quote:
        t = time.time() if now is None else now
        self._n += 1
        qid = f"q-{lane}-{t:.0f}-{self._n:06d}"
        q = Quote(quote_id=qid, lane=lane, max_amount_a=str(max_amount_a),
                  signed_max_a=str(max_amount_a),   # advertised == signed at birth
                  created_at=t, expires_at=t + self.ttl_s)
        self.live[qid] = q
        return q

    def mark_used(self, quote_id: str) -> None:
        if quote_id in self.live:
            self.live[quote_id].used = True


# ── 3 · pause-not-kill — the metered session (pinout session.mjs) ───────────

@dataclass
class Session:
    """
    OPENING → ACTIVE ↔ PAUSED → SETTLING → CLOSED.

    - burn(seconds) bills at the lane rate; it bills only what the balance
      covers and PAUSES at zero — it never overdraws, never kills.
    - credit(...) routes through credit_from_settlement; a credit to a
      PAUSED session RESUMES it (pause-at-zero, resume-on-topup).
    - close() is the only exit — the member's (or the drain's) call, never
      the meter's. state-before-balance: the state machine wins over any
      balance arithmetic.
    """
    voucher: str
    escrow: Escrow
    rate_set: RateSet
    resource: str = "mesh_second"          # 1 credit = 1 second
    state: str = "OPENING"
    credits: Decimal = Decimal("0")        # metered seconds this session
    # infra retry book (the infra halt's 2-consecutive law)
    settle_failures: int = 0

    def open(self) -> "Session":
        if self.state != "OPENING":
            raise VoucherError(f"cannot open from {self.state}")
        self.state = "ACTIVE"
        return self

    def _per_second(self) -> Decimal:
        return self.rate_set.rate(self.resource)

    def burn(self, seconds: Decimal | int | str) -> tuple[Decimal, str]:
        """Bill `seconds` of the lane. Returns (billed_seconds, state).
        Bills only what the balance covers; at zero → PAUSED, never CLOSED.
        Never writes a charge the balance cannot pay (refuse-before-write)."""
        want = Decimal(str(seconds))
        if want <= 0:
            raise VoucherError("burn needs positive seconds")
        if self.state == "PAUSED":
            return Decimal("0"), "PAUSED"          # paused meter bills nothing
        if self.state != "ACTIVE":
            raise VoucherError(f"cannot burn from {self.state}")
        # the per-second all-in (basis + tithe) decides affordability
        unit = _d(self._per_second()) * (Decimal("1") + TITHE_RATE)
        bal = self.escrow.balance(self.voucher)
        affordable = int(bal / unit) if unit > 0 else 0
        billed = min(int(want), affordable)
        if billed > 0:
            self.escrow.charge(self.voucher, [(self.resource, billed)], self.rate_set)
            self.credits += Decimal(billed)
        if billed < int(want):
            self.state = "PAUSED"                  # PAUSE at zero — not kill
        return Decimal(billed), self.state

    def credit(self, declared: dict, observed: dict) -> dict:
        """A top-up through the settlement law. A credit RESUMES a paused
        session — that is what pause-not-kill means on the money side."""
        ev = credit_from_settlement(self.escrow, self.voucher, declared, observed)
        if self.state == "PAUSED":
            self.state = "ACTIVE"                  # resume on credit
        return ev

    def begin_settle(self) -> None:
        if self.state not in ("ACTIVE", "PAUSED"):
            raise VoucherError(f"cannot settle from {self.state}")
        self.state = "SETTLING"

    def close(self) -> None:
        """The ONLY kill — and it is the member's call, not the meter's."""
        if self.state not in ("ACTIVE", "PAUSED", "SETTLING"):
            raise VoucherError(f"cannot close from {self.state}")
        self.state = "CLOSED"


# ── 4 · lane pricing — cost basis + tithe (pinout rates.json/lanePricing) ───

def lane_pricing(lane: dict, seconds: Decimal | int | str,
                 now: float | None = None) -> dict:
    """
    A lane's price = cost basis x (1 + margin) where the estate's margin IS
    the 10% tithe — carried as its OWN line, never inside the rate
    (rate_set versions track cost basis only; the tithe is law).

    The xorv stale-rate rule: a lane whose `observed_at` is older than its
    `stale_after_s` (or whose basis is unset) raises NotPriced — the lane
    DISAPPEARS from the offer rather than mis-pricing.
    """
    if lane.get("cost_basis_a_per_second") is None:
        raise NotPriced(f"lane {lane.get('lane', '?')} has no citable cost basis — "
                        "unpriced lanes are never offered")
    t = time.time() if now is None else now
    stale_after = lane.get("stale_after_s")
    if stale_after is not None and t - float(lane["observed_at"]) > float(stale_after):
        raise NotPriced(f"lane {lane['lane']} cost basis older than "
                        f"{stale_after}s — the option disappears, never mis-prices")
    basis_rate = Decimal(str(lane["cost_basis_a_per_second"]))
    secs = Decimal(str(seconds))
    basis = (basis_rate * secs).quantize(Decimal("0.0001"))
    tithe = (basis * TITHE_RATE).quantize(Decimal("0.0001"))
    return {
        "lane": lane["lane"], "seconds": str(secs), "unit": "A",
        "basis": str(basis), "tithe": str(tithe),
        "total": str((basis + tithe).quantize(Decimal("0.0001"))),
        "law": "rate = cost basis; margin = the 10% tithe as its own line; "
               "1 credit = 1 second",
    }


# ── 5 · the 4-state receipt (Tally audit.ts, the z3.2 comb's four states) ───

def audit_receipt(event: dict, anchors: dict, rate_sets: dict,
                  prior_ts: Optional[float] = None) -> tuple[str, list]:
    """
    Pure audit over one charge/receipt event. Returns (state, failed_checks).

    FAILED needs PROOF (z3.2 law: computed red, never a new red):
      - arithmetic_fraud — Σ line charged != Σ (quantity x rate) recomputed
      - tithe_mismatch   — the tithe line != 10% of the stated basis (the
                           founder law is auditable, not asserted)
      - over_capture     — upto settled_a above what the metering justified
      - over_max         — upto settled_a above the signed ceiling
      - backdated        — ts earlier than the prior event's (forward-only)
    INCONCLUSIVE — terms unresolvable (rate_set_ref not in rate_sets) or the
    anchor record unreadable: the truth exists but this pass cannot see it.
    PENDING_ANCHOR — no anchor record for the event yet.
    PASSED — anchored and every check clean.
    """
    failed = []
    upto = event.get("upto")
    lines = event.get("line_items", [])
    refs = {li.get("rate_set_ref") for li in lines}
    unresolvable = refs - set(rate_sets)
    if unresolvable:
        return INCONCLUSIVE, [f"terms_mismatch: rate_set_ref {sorted(unresolvable)} "
                              "unresolvable — never a guess"]
    # arithmetic: recompute every basis line from the rate law of its own
    # version; the tithe line is checked against the founder law separately.
    # For upto events the LAWFUL basis is the CLAMP — min(metered, ceiling
    # basis) — a clamped line is lawful capture, not fraud (settling ABOVE
    # the metering is the fraud; that is over_capture below).
    recomputed = Decimal("0")
    for li in lines:
        if li.get("resource") == "tithe.founder":
            continue
        rs = rate_sets[li["rate_set_ref"]]
        recomputed += (Decimal(li["quantity"]) * Decimal(str(rs))).quantize(Decimal("0.0001"))
    lawful_basis = recomputed
    if upto is not None:
        ceiling_basis = (Decimal(upto["ceiling_a"]) / (Decimal("1") + TITHE_RATE)
                         ).quantize(Decimal("0.0001"))
        lawful_basis = min(recomputed, ceiling_basis)
    stated_basis = sum((Decimal(li["charged"]) for li in lines
                        if li.get("resource") != "tithe.founder"), Decimal("0"))
    if lines and stated_basis != lawful_basis:
        failed.append(f"arithmetic_fraud: stated {stated_basis} != lawful "
                      f"{lawful_basis} (metered {recomputed})")
    tithe_stated = sum((Decimal(li["charged"]) for li in lines
                        if li.get("resource") == "tithe.founder"), Decimal("0"))
    tithe_expected = (stated_basis * TITHE_RATE).quantize(Decimal("0.0001"))
    if lines and tithe_stated != tithe_expected:
        failed.append(f"tithe_mismatch: stated {tithe_stated} != law {tithe_expected} "
                      "(10% of basis — never buried, always auditable)")
    if upto is not None:
        settled, ceiling = Decimal(upto["settled_a"]), Decimal(upto["ceiling_a"])
        metered_total = (Decimal(upto["metered_basis_a"]) * (Decimal("1") + TITHE_RATE)
                         ).quantize(Decimal("0.0001"))
        if settled > metered_total:
            failed.append(f"over_capture: settled {settled} > metered {metered_total}")
        if settled > ceiling:
            failed.append(f"over_max: settled {settled} > signed ceiling {ceiling}")
    if prior_ts is not None and event.get("ts", 0) < prior_ts:
        failed.append(f"backdated: ts {event.get('ts')} < prior {prior_ts} (forward-only)")
    if failed:
        return FAILED, failed
    key = event.get("hash") or event.get("receipt_id")
    if key not in anchors:
        return PENDING_ANCHOR, []
    if not isinstance(anchors[key], dict):
        return INCONCLUSIVE, [f"anchor record unreadable for {key}"]
    return PASSED, []


# ── the member-agent halt logic (Tally autonomous.ts) ───────────────────────

def halt_on_budget(session: Session, quote: Quote, now: float | None = None) -> None:
    """Halt when remaining balance < the quote's ceiling — the member must
    not sign an offer they cannot pay for. kind = PAUSE: budget recovers on
    credit; pause-not-kill is the law."""
    bal = session.escrow.balance(session.voucher)
    if bal < Decimal(quote.max_amount_a):
        session.state = "PAUSED"
        raise Halt(HALT_BUDGET, "PAUSE",
                   f"remaining {bal} A < ceiling {quote.max_amount_a} A — "
                   "pause; a credit resumes")


def halt_on_fraud(state: str, failed_checks: list) -> None:
    """A FAILED audit is proven fraud class — KILL the agent loop and flag."""
    if state == FAILED:
        raise Halt(HALT_FRAUD, "KILL", "; ".join(failed_checks))


def halt_on_infra(session: Session, settle_error: Exception) -> Halt:
    """A settle failure is infra: PAUSE and retry once; two CONSECUTIVE
    failures halt the loop for a human (Tally: halt after 2 consecutive)."""
    session.settle_failures += 1
    session.state = "PAUSED"
    if session.settle_failures >= 2:
        return Halt(HALT_INFRA, "KILL",
                    f"2 consecutive settle failures ({settle_error}) — halt for a human")
    return Halt(HALT_INFRA, "PAUSE", f"settle failed once ({settle_error}) — retry")


def _d(x) -> Decimal:
    return Decimal(str(x))
