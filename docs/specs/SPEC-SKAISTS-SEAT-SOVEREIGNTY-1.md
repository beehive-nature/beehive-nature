# SPEC-SKAISTS-SEAT-SOVEREIGNTY-1 — one human, one seat, one type, one constituency

Status: GENESIS 2026-10-07 (zCode seat, branch
`zcode/skaists-seat-sovereignty-2026-10-07`). Founder order 2026-10-07
(the lane-opening message is the ruling, quoted below). This spec is
the bridge between SPEC-LOVERNMENT-DAO-1 (the 7,776-seat organism) and
SPEC-BTUNGSTEN-1 (the civilization-scale standard the organism's
identity machinery must satisfy).

## §the-bridge — what each thing is

**bTunGsTeN** tests civilization-scale identity infrastructure for
>10 billion unique active humans across 1,000+ years
(SPEC-BTUNGSTEN-1 §axes). **Skaists LOVERnment DAO** is one bounded
constitutional deployment of that architecture: 7,776 unique humans,
each occupying exactly one membership seat, Sybil/MiM-resistant, with
that seat assigned to one of five Human Design energy-type
constituencies. The deployment proves the machinery at a scale where
every seat can be exercised exhaustively; the standard keeps proving it
at planetary scale.

## §the-invariant — the core chain

> **One living human → one active Skaists seat → one canonical energy
> type → one governance constituency.**

## §seat-sovereignty-law (FOUNDER RULING, verbatim)

> **Skaists Seat Sovereignty:** at every governance epoch, no natural
> human may control more than one active membership seat, every active
> seat must resolve to exactly one eligible living human and exactly
> one of the five constitutional energy types, and no verifier needs
> access to that human's underlying biometric or civil identity to
> establish eligibility.

Three clauses, each load-bearing:

1. **One seat per human per epoch** — the Sybil wall. A human with two
   seats is two votes; the constitution dies there first.
2. **One human and one type per seat** — the seat is not a wallet or a
   keypool; it resolves to a living eligible human carrying exactly one
   canonical type. The human's type is derived THROUGH the seat
   (`typeOf(human) := typeOf(seatOf(human))`), so type uniqueness is
   structural, not a second bookkeeping system to attack.
3. **No identity material at the verifier** — eligibility is proven by
   predicates, never by revealing civil or biometric material. The
   chain does not need to know WHO; it needs to know the predicates
   hold.

## §the-five-proofs — the minimum predicate set

The public chain needs exactly these from PROVE, nothing more:

```
UNIQUE        = true        (this human holds no other active seat this epoch)
LIVE          = true        (living and authorized at proof time)
SEAT          = unique      (the seat resolves to exactly one human this epoch)
ENERGY_TYPE   ∈ {1..5}      (the canonical type; integers only — no float, no string)
CURRENT_EPOCH = valid       (proofs are epoch-scoped; stale epochs prove nothing)
```

The five energy types are the five Human Design energy types, held
abstractly as integers 1..5. The canonical mapping of WHICH type is
WHICH number is a founder declaration reserved to the constituency
beat; this spec does not invent it. The five LAYERS of the 6⁵ seat
geometry (SPEC-LOVERNMENT-DAO-1 §genesis-cap) are a different fivefold
structure — no layer↔type mapping is ruled or implied, and conflating
them is named here so nobody does it silently later.

## §population-vs-weight — the arithmetic law

**7,776 does not divide evenly by five** (7,776 = 2⁵·3⁵; five is not a
factor; by exhaustion, no integer k satisfies 5k = 7,776). Therefore:

- **Membership population** — the actual humans/types occupying the
  7,776 seats — is a MEASURED VARIABLE. It breathes ("the cap is
  fixed; the occupancy breathes," SPEC-LOVERNMENT-DAO-1).
- **Governance weight** — each of the five energy constituencies
  carries exactly **1/5 of constitutional weight**, CONSTANT in the
  population vector. One constituency holding 1,300 humans and another
  holding 2,000 does NOT give the latter more constitutional power.

The nearest integer packing {1556, 1555, 1555, 1555, 1555} is recorded
for honesty (it is the tightest packing that exists) and is NOT
constitutional: no seat count is a weight.

Two corollary laws:

- **Population-weighted governance is a DIFFERENT constitution.** A
  governor that computes weight from occupancy (2,000/7,776 > 1/5) has
  changed the constitution, not measured it. In the SK001 battery the
  population-share governor ships ONLY as a named sabotage control,
  convicted on every non-uniform vector (the WB001 `naiveConcat`
  precedent).
- **No float represents constitutional weight.** 1/5 is inexact in
  binary (3 × (1/5) ≠ 0.6 in IEEE-754). Weights are exact rationals in
  integer arithmetic; the constitution does not round.

## §6-to-the-5 — the structure of the cap

7,776 = 6⁵ exactly: a fixed, finite human governance organism —
hexagonal cells, five layers deep (SPEC-LOVERNMENT-DAO-1 §genesis-cap).
The cap is DERIVED from the geometry, never hardcoded. Skaists is the
bounded deployment; bTunGsTeN proves the underlying machinery can
survive at planetary scale.

## §the-pipeline — COMMIT · PROVE · COMPRESS · SETTLE

The four verbs of the identity layer, and where each boundary sits:

| verb | owns | boundary |
|---|---|---|
| **COMMIT** | the private evidence boundary | evidence stays caller-side; only a binding commitment crosses. COMMIT owns this boundary (the WB002 extraction: `idata` → COMMIT — scripts/btungsten/README.md §extractions) |
| **PROVE** | the five predicates | emits ONLY UNIQUE, LIVE, SEAT, ENERGY_TYPE, CURRENT_EPOCH + public bindings (seat id, epoch). It structurally cannot leak what was never stored |
| **COMPRESS** | aggregation | thousands of members fold into compact governance results: five exact per-constituency tallies + the fixed-weight verdict. The estate's live compression instance is the ZK count-only aggregate (SPEC-ZK-RECEIPT-AGGREGATES-1; count-v1 proofs verified on Vaulta public testnet jungle4) |
| **SETTLE** | execution | ultimately drives an Antelope/Vaulta multisig or whatever successor exists centuries later. NOT BUILT; the millennium clause (bTunGsTeN axis 6) means SETTLE must survive the replacement of every named chain, including Vaulta |

## §deployment-status — what exists, honestly

| artifact | status |
|---|---|
| `scripts/btungsten/sk001-seat.mjs` — the seat-sovereignty model (COMMIT/PROVE/COMPRESS staged; SETTLE named, not modeled) | RUNS — model scale |
| `scripts/btungsten/sk001.test.mjs` — the battery: 6⁵ derivation + no-equal-fifths exhaustion, weight⊥population over adversarial vectors, double-seat/seat-taken refusals + bijection, malformed-type refusals, the five predicates frozen-shape, evidence byte-scan of proof and era export, full-cap fill + the 7,777th refused + one breath, exact COMPRESS fold at 7,776 votes, TEETH (population governor + float weights convicted) | LIVE in CI — rides the `scripts/btungsten/*.test.mjs` glob; green 10/10 |
| a LIVE proof system (real uniqueness proofs against real humans) | NOT BUILT — future beat, UNVERIFIED |
| a hiding commitment scheme | NOT BUILT — the model's sha256 commitment is a BINDING placeholder only; hiding is NOT claimed (sha256 is not a hiding commitment against low-entropy evidence). A live deployment binds a hiding+binding scheme |
| SETTLE (model scale) — the COMPRESS verdict drives the WB004 epochal engine's bounded msig and lands as an immutable receipt: `crates/btungsten-wb004/tests/skaists_bridge.rs` (6⁵ organism, exact integer 1/5 weights, constant-size execution layer, population governor convicted by disagreement) | MODELED 2026-10-09 — model scale only |
| SETTLE on a live Antelope/Vaulta chain | NOT BUILT — named, not claimed; does not inherit the model receipt (non-inheritance law) |

Per SPEC-BTUNGSTEN-1 §measurability: the battery receipts the MODEL.
Model-green is a receipt about the model, not about the world; every
live-layer claim stays a hypothesis until its own adversarial test and
machine-verifiable receipt exist.

## §ratification — founder acceptance, 2026-10-07 (post-merge, FOUNDER RULING)

Banked at main `6c9147d74` (PR #353). The founder's ratification holds
verbatim, and its lines are law:

> SK001 MODEL = GREEN
> hiding COMMIT = UNVERIFIED
> live PROVE = UNVERIFIED
> SETTLE = UNVERIFIED

- **The non-inheritance law:** no live Sybil/MiM-immunity claim may
  inherit the model result until those later layers earn their own
  receipts. SK001's green is a receipt about the model, never a
  live-immunity receipt.
- **Symmetry is not constitutional evidence:** interesting symmetry
  between the five type dimensions and the 6⁵ geometry is not
  constitutional evidence. The two founder-reserved decisions stay
  untouched by autonomous seats — the canonical 1..5 ↔ Human Design
  type mapping, and any proposed interpretation connecting the five
  type dimensions to the 6⁵ geometry.
- **Sequence confirmed:** constituency canon → hiding commitment →
  live PROVE → SETTLE. Only at that point does SK001 stop being merely
  a correct constitutional model and begin becoming an independently
  verifiable Skaists membership system.

## §bTunGsTeN-axes — what this deployment exercises

- **Axis 2 (Sybil/MiM):** one-human-one-seat at every epoch — the
  bounded instance of the uniqueness axis. Model-scale only; the TAM
  slice claimed is the in-memory registry under the battery's attack
  rows.
- **Axis 5 (capacity):** the full 7,776-seat organism exercised
  exhaustively (every seat filled, every vote folded) — the miniature
  of the >10B leg.
- **Axis 6 (continuity):** epoch rollover — sovereignty re-established
  per epoch, stale proofs refused. The century-transition leg remains
  bTunGsTeN's own (WB003+).

## §order-of-work

1. **SK001 model + battery + this spec** — DONE by this lane (the
   receipt is the CI run of `sk001.test.mjs`).
2. **The constituency beat** — founder declares the canonical 1..5
   type mapping; population measurement surfaces; guest-tier interplay
   with SPEC-LOVERNMENT-DAO-1 §guest-quota.
3. **The commitment beat** — a hiding+binding commitment scheme
   replaces the placeholder; boundary re-receipted.
4. **The live PROVE beat** — real proofs against the predicate set
   (circuit or equivalent; the zkreceipts native Antelope PLONK path
   is the estate's current instance of proof machinery — fresh
   worktree per the standing law when that lane opens).
5. **SETTLE beat** — governance results driving a Vaulta multisig,
   with the millennium clause: the settle target must itself be
   replaceable.

Laws here carry the founder ruling of 2026-10-07 and are not
relitigable; the order-of-work beats are open lanes, each with its own
receipt when it runs.
