# VV — Vending Verification (adversarial batteries for the on-chain meter)

**Seat law** (the architecture-reconciliation charter): this seat is the
adversarial test DESIGNER — red-first, batteries in CI, never a production
fix. A RED here is a deliverable, not a bug report to be quietly patched: the
charter text under each ledger row is what a fix lane must make true, and the
fix lane re-derives the battery from the new source sha (the pin enforces it).

**Target**: `contracts/vending/src/vending.cpp` — the member-agent vending
machine's Vaulta half (SPEC-VENDING-1 §layers 3 + THE METER, x402 rules).
Deploy posture: Jungle4 rehearsal under `bnrapolltest` (TESTNET-ONLY); the
mainnet home is a founder-gated gesture. Battery:
`scripts/vv1-vending-pricing.mjs` (zero network; a line-cited BigInt
transcription of the contract, pinned to the source digest
`9869f77f95e615ad5819633c03d372e9455ddfd01c2d4a7f93c7ff1f6ba25034` <!-- PUBLIC-CONSTANT — vending.cpp sha256 pin, same as the battery's PINNED_SHA -->
at origin/main `4d1baf61`).

---

## VV-1 — immutable pricing semantics for an open session

**The founder order** (2026-09-16): an open session must carry immutable
pricing semantics. Open under rate R1, mutate the governed rate row to R2,
settle the original session — the result must use an open-time committed
pricing snapshot or refuse because the historical pricing commitment cannot
be proven; never silently R2 merely because R2 is current. Bind every
price-affecting input required for settlement — not merely a rate-row
identifier — so governance cannot mutate something adjacent and achieve the
same repricing. Inverse control: sessions opened after the mutation use R2.
Attack delete/recreate of the same rate key, mutation immediately before
settlement, and mutation/reversion R1→R2→R1: equality of the final table
must not erase the fact that the session was authorized against a particular
pricing commitment if intermediate state matters. Tithe arithmetic conserves
in integers at the actual smallest unit with an explicitly chosen rounding
law; no value appears or disappears through independently rounded legs.
`tithe_bp` > 10,000 refuses before state mutation; exactly 0 and exactly
10,000 are boundary controls. A negative control proves the battery catches
deliberate live-table settlement.

**Mapping**: the order's "settle the original session" is the meter's priced
consumption action — `charge` (`vending.cpp:272-292`), the only action whose
semantics the governed rate row enters. `settle` (`:254-266`) is the credit
path and reads no rate.

**THE FOUNDER RULING** (2026-09-16, on the VV-1 result — banked verbatim in
substance): the six reds are ONE missing primitive, not six symptoms:

> An opened session binds an immutable `PricingCommitment`; settlement/
> charge never derives historical price semantics from the mutable
> governance table.

The commitment contains every field that can change the economic result —
at minimum the applicable rate/basis, asset/unit semantics, `tithe_bp`, and
a deterministic commitment/hash over the complete pricing input — stored at
`opensess`. The rule:

> **governance table = the price offered to new sessions**
> **session commitment = the price authorized for this session**

`charge` runs **snapshot execution** — NOT "refuse whenever governance
changes": governance must be able to update new pricing without bricking
legitimately opened sessions. Refusal is appropriate only when the
historical commitment is **absent/corrupt/unverifiable** — never merely
because today's table differs. This makes R1→R2→R1 irrelevant to an
existing session: its commitment never changed. The battery's oracle was
tightened to this bar (second commit on the lane): a drift-refusal is now a
CONVICTED calibration, and a legacy session with no recorded commitment
must refuse as unprovable — never fall back to the live table (the
migration trap). Tithe: one pinned smallest-unit conservation equation,
`total_charge = member_amount + tithe_amount`, `tithe_amount =
floor(total_charge × tithe_bp / 10_000)`, `member_amount = total_charge −
tithe_amount` — the split computed ONCE from the committed total, never two
independently rounded legs; 0 and 10_000 lawful, >10_000 refuses before
mutation; and `tithe_bp` rides INSIDE the commitment, or governance changes
who receives value without touching the headline rate. The R1→R2→R1 probe
(VV-1.4c) is **permanent** — same final state ≠ same history; each charge
must be attributable to the session's committed pricing semantics.

**VV-2 boundary** (banked now): the int64 multiply/overflow observation is
a legitimate VV-2 LEAD, but pricing provenance and arithmetic bounds are
separate failure classes — it must not contaminate the VV-1 fix.

**Deployment posture** (ruled): `bnrapolltest` being live makes it EVIDENCE
about the currently deployed vulnerable shape; it is not our RED harness.
Isolated tests first; a separately authorized Jungle4 upgrade/drill later.

---

**The law, as probes** (oracle at the founder-ruled bar):

| probe | law | verdict @ pin |
|---|---|---|
| VV-1.1 | R1-open → setrate R2 → charge: SNAPSHOT EXECUTION at the open-time commitment — the only lawful outcome with an intact commitment (refusal is reserved for absent/corrupt/unverifiable) | **RED** — charge reads the live row (`:279-280`); burned R2 silently |
| VV-1.2 | the session row attests every price-affecting input (rail, basis, tithe_bp); adjacent mutation (same key, same basis, different tithe_bp) cannot shift the authorized inputs invisibly | **RED** — the session binds only the rail key (`:71`) |
| VV-1.3 | inverse control: a session opened after the mutation prices at R2 | GREEN |
| VV-1.4a | delete/recreate of the rate key, three legs: mid-delete charge must PRICE the snapshot (the commitment is self-contained — deletion must not strand an open session); recreate at R3 must not be silently adopted; recreate-with-same-values must be distinguishable from never-mutated by recorded commitment, not outcome coincidence | **RED** (all three legs — the mid-delete "rate row vanished" refusal is itself a stranding defect under the ruled law) |
| VV-1.4b | mutation immediately before settlement must not reprice the very next charge | **RED** — same live-read root, the realistic governance race |
| VV-1.4c | R1→R2→R1 (**PERMANENT probe** — same final state ≠ same history): outcome equality is not provenance — the session must PROVE it priced its authorization, and a session that consumed across two regimes must carry per-consumption pricing evidence | **RED** both legs (leg 1 unattestable; leg 2 mid-window charge burned R2 silently) |
| VV-1.5 | tithe split conserves: `tithe = trunc(total × bp / 10000)` in smallest-unit BigInt, `member = total − tithe` by subtraction — one rounded leg, never two; sweep 4096 totals × 8 bp values exact | **RED** — the contract HAS NO tithe leg (charge is blind to tithe_bp); the law is the charter |
| VV-1.6 | `tithe_bp` 10,001 refuses BEFORE state mutation (row bytes + updated stamp untouched, emplace path creates nothing); boundaries 0 and 10,000 accepted and conserve | GREEN (`:143-144`, `:169` precede every write) |
| VV-1.7 | negative control, FIVE calibrations at the ruled bar: CONVICTS live-table settlement, the drift-refusal brick (commitment stored, refuses when today's table differs), and the legacy live-fallback; ACQUITS snapshot execution and the legacy refusal naming the unprovable commitment | GREEN — oracle calibrated |

**The red ledger** (registered ≠ resolved; charters bind the fix lane):

1. **VV-1.1 live-read pricing** — `charge` consults the governed table as it
   is NOW (`vending.cpp:279-280`); the session's authorization at open is
   never recorded. *Charter* (founder-ruled): `opensess` binds an immutable
   `PricingCommitment` — every field that can change the economic result
   (basis, asset/unit semantics, tithe_bp, deterministic hash over the
   complete pricing input); `charge` = SNAPSHOT EXECUTION of that
   commitment; refusal only for an absent/corrupt/unverifiable commitment.
2. **VV-1.2 rail-key-only binding** — `session_row` (`:67-81`) carries
   `rail` and nothing price-affecting. *Charter*: the row attests rail,
   basis, tithe_bp at open, so adjacent governance mutation is visible as a
   session-delta question, not invisible by construction — tithe_bp
   INCLUDED, or governance changes who receives value without touching the
   headline rate.
3. **VV-1.4a delete/recreate** — `rmrate` strands an open session ("rate
   row vanished"); `setrate` recreate reprices it to a row it never saw;
   same-values recreate is indistinguishable from never-mutated.
   *Charter*: governed rows price NEW sessions only — deletion cannot
   strand, recreate cannot adopt, and same-values is distinguished by the
   recorded commitment, not outcome coincidence.
4. **VV-1.4b pre-settlement mutation** — the adjacent-block governance race
   lands silently. Same root as 1.1, registered separately because it is the
   realistic shape.
5. **VV-1.4c reversion (PERMANENT probe)** — R1→R2→R1 acquits itself by
   outcome equality; a mixed-regime session carries no per-consumption
   pricing evidence. *Charter*: proof of authorization, not coincidence of
   final bytes — same final state ≠ same history.
6. **VV-1.5 tithe leg absent** — no action computes or moves a tithe split;
   `rate_row.tithe_bp` and the `tithe` singleton are dead knobs. *Charter*
   (founder-pinned equation): `total_charge = member_amount + tithe_amount`,
   `tithe_amount = floor(total_charge × tithe_bp / 10_000)`,
   `member_amount = total_charge − tithe_amount` — computed ONCE from the
   committed total, never two independently rounded legs; 0 and 10_000
   lawful boundaries, >10_000 refuses before mutation; tithe_bp rides inside
   the commitment; precedence ruling needed between the two knobs.

**Battery discipline** (AV-11 law, drilled 2026-09-16, re-drilled after the
ruling-bar tightening): registered reds pass and print; an unregistered red
fails; a registered red gone green fails as STALE until promoted here; sha
or structural-pin drift fails hard (the pin is how a red-first battery
charters its fix); the VV-1.7 self-test can never be ledger-able. All four
failure paths were fired by drill with named causes — twice.

---

## THE BUILDER ORDER (bounded — a FRESH implementation workerb, NOT zArcheology)

> Consume **VV-1 only**, RED→GREEN. Add immutable open-time
> `PricingCommitment`; make every charge use it; implement single-rounding
> tithe conservation; retain governed rate rows exclusively for new-session
> pricing. Re-run all nine VV-1 probes plus existing vending tests. Add
> serialization/reopen coverage so the commitment survives contract/session
> persistence. No Jungle4 mutation. No VV-2 implementation.

Acceptance gates:

- **The one concept**: an opened session binds an immutable
  `PricingCommitment` (every field that can change the economic result —
  applicable rate/basis, asset/unit semantics, `tithe_bp`, and a
  deterministic commitment/hash over the complete pricing input), stored at
  `opensess`. Governance table = price offered to NEW sessions; session
  commitment = price authorized for THIS session. No six symptomatic fixes.
- **Snapshot execution** in `charge` — drift-refusal is a CONVICTED shape
  (it bricks legitimately opened sessions); refusal is for
  absent/corrupt/unverifiable commitments only. Legacy sessions with no
  recorded commitment refuse as unprovable — never fall back to live
  pricing.
- **Tithe conservation** at the pinned equation (above), single rounding,
  smallest-unit integer arithmetic; 0/10_000 boundaries lawful; >10_000
  refuses before any state mutation.
- **The battery arbitrates**: the fix changes `vending.cpp`, so the battery
  pin flips — re-derive the model from the new sha, re-run all nine probes
  (all six reds must turn green; the three greens must stay green), promote
  the ledger rows here, and extend the re-derived battery with a
  persistence/reopen probe (the commitment survives serialization/reopen).
- **Boundaries**: existing vending tests keep passing; NO Jungle4 mutation
  (`bnrapolltest` is evidence of the deployed vulnerable shape, not the RED
  harness); NO VV-2 implementation (int64 overflow & co. are a separate
  failure class and a separate lane).
- **Return protocol**: send the GREEN result back to the adversarial seat
  (zCode); only after VV-1 is green does zArcheology re-read the resulting
  contract and decide which VV-2 assumptions remain relevant.

**Residue — observed at source, NOT probed (future lanes' surface):**

- The live perUnit also feeds the over-ceiling check (`:283`): a governance
  spike can BRICK a session's consumption (over-ceiling refusals) even while
  credit exists — the refusal-shift face of the same live-read root.
- `int64_t cost = perUnit * (int64_t)units` (`:282`) is raw int64
  multiplication — no explicit overflow guard on the product (eosio::asset
  ops check their own arithmetic; this one is bare). An integer-limits lane
  (VV-2 candidate) should pin units × basis overflow behavior.
- `settle` accepts any `amount` with no ceiling coupling — credit may exceed
  ceiling (ceiling bounds `burned`, not `credit`); lawful by construction,
  recorded so a future lane reads it as design, not drift.
- The nonce table grows unboundedly between `rmnonce` sweeps (`:323-331`) —
  RAM-bounded by member sweeps, noted for the same integer-limits lane.

**Status** (AV-matrix discipline):

| spec | specified | implemented / CI-proven | live-wired / operationally proven |
|---|---|---|---|
| VV-1 | ✅ this file (founder order verbatim) | ✅ battery in CI; 6 registered reds + 3 greens; all failure paths drilled | ❌ NO — the Jungle4 rehearsal (`bnrapolltest`) runs the live-read code; a live drill (open → setrate → charge on-chain) needs the admin key, a founder-gated gesture per the deploy posture |
