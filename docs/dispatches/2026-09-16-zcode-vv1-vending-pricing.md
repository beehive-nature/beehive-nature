# VV-1 — immutable pricing semantics for an open session (vending meter, red-first battery)

**Order** (founder, 2026-09-16): open a session under R1, mutate the governed
rate row to R2, settle the original session — snapshot-or-refuse, never
silent R2; bind every price-affecting input; inverse control; delete/recreate
+ pre-settle mutation + R1→R2→R1 reversion attacks; tithe integer
conservation with an explicit rounding law; tithe_bp bounds refuse-before-
mutation; negative control that catches deliberate live-table settlement.

**Target**: `contracts/vending/src/vending.cpp` @ origin/main `4d1baf61`,
sha256 `9869f77f95e615ad5819633c03d372e9455ddfd01c2d4a7f93c7ff1f6ba25034` <!-- PUBLIC-CONSTANT — the pinned vending.cpp digest, identical to the battery's PINNED_SHA -->
(Jungle4 rehearsal `bnrapolltest`, TESTNET-ONLY; mainnet founder-gated).
The order's "settle" maps to the meter's priced consumption action `charge`
(`:272-292`) — the only action the governed rate row enters.

**Deliverable**: `scripts/vv1-vending-pricing.mjs` (CI-wired, zero network) —
a line-cited BigInt transcription of the contract (smallest unit 0.0001 A)
plus two lawful references (snapshot; refuse-on-unprovable) and one sabotage
implementor that calibrate the oracle. Spec + charters:
`docs/agents/VV-SPECS.md`.

**Verdict @ pin — 6 RED (registered), 3 GREEN:**

- **RED VV-1.1** live-read pricing: `charge` consults the governed table as
  it is NOW (`:279-280`) — R1-open session burned R2 silently.
- **RED VV-1.2** rail-key-only binding: `session_row` (`:67-81`) attests no
  price-affecting input; adjacent tithe_bp mutation is invisible.
- **RED VV-1.4a** delete/recreate: mid-delete refusal lawful; recreate at R3
  silently repriced the open session; same-values recreate acquitted by
  outcome coincidence.
- **RED VV-1.4b** the governance race (setrate immediately before charge)
  lands silently — same root, realistic shape.
- **RED VV-1.4c** R1→R2→R1: outcome equality without provenance (leg 1
  unattestable; leg 2 burned R2 mid-window, R1 after reversion — two regimes,
  one session, no per-consumption evidence).
- **RED VV-1.5** tithe leg absent: charge is blind to tithe_bp (identical
  burns at 1000bp and 2500bp); conservation unprovable. The charter law:
  `tithe = trunc(total×bp/10000)` in smallest-unit BigInt, member leg by
  subtraction — swept 4096 totals × 8 bp values, exact.
- **GREEN VV-1.3** inverse control (post-mutation session prices R2).
- **GREEN VV-1.6** bounds: 10,001 refuses before state mutation on both
  write paths (rows byte-identical, updated stamp untouched); 0 and 10,000
  accepted and conserve.
- **GREEN VV-1.7** oracle calibrated: live-table settlement CONVICTED, both
  lawful references ACQUITTED.

**Battery integrity — all failure paths drilled with named causes**: sha
drift → exit 1; each of the three structural pins flips when its fix shape
lands (live-read removed / snapshot field added / tithe consulted) → exit 1;
unregistered red → exit 1; stale ledger row → exit 1; self-test never
ledger-able.

**Residue banked in the spec** (not probed): the live perUnit also feeds the
over-ceiling check — a governance spike can brick consumption; raw int64
`perUnit × units` at `:282` has no explicit overflow guard (VV-2 candidate);
`settle` has no ceiling coupling (lawful, recorded); nonce table bounded
only by member sweeps.

**Live-wired**: NO — column 3 per the AV-matrix discipline; the Jungle4
rehearsal runs the live-read code today; a live open→setrate→charge drill
needs the admin key (founder gesture, same law as the deploy posture).

**Fix lane**: the charters in `docs/agents/VV-SPECS.md` bind it; whichever
seat lands the fix re-derives the battery from the new sha — the pin refuses
to test a stale model, and the ledger forces row promotion (a red gone green
fails as STALE until moved to the spec).

## Relay

```
VV-1 LANDED (zCode seat, red-first): the vending meter's pricing is NOT
immutable for open sessions — the battery proves it. Open a session at
0.6000 A, governance moves the rate to 1.2000 A, the session's next charge
silently burns 1.2000 A: the contract reads the live row (vending.cpp:279)
and the session row records only the rail KEY — no pricing snapshot, no
commitment, nothing to attest what was authorized. Six registered defects:
live-read pricing; key-only binding; delete/recreate hijack; the
pre-settlement governance race; R1→R2→R1 reversion (outcome equality is
coincidence, not provenance — a session that burned R2 mid-window then R1
after reversion carries no per-consumption evidence); and the tithe leg
doesn't exist at all (charge is blind to tithe_bp — conservation unprovable;
the battery's integer law: truncating tithe leg, member leg by subtraction,
swept exact over 32k splits). Three greens: post-mutation sessions price at
the new rate (the lawful inverse control); tithe_bp>10000 refuses before any
state mutation; and the negative control — the battery convicts deliberate
live-table settlement while acquitting both lawful shapes (snapshot, or
refuse naming the historical commitment). All battery failure paths drilled.
Charters bind the fix lane: docs/agents/VV-SPECS.md; battery in CI,
source-pinned so the fix cannot land silently.
```
