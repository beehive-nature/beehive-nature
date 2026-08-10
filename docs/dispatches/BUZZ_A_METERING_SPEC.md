# BUZZ A-METERING — SPEC (B1, Cowork, 2026-08-10)

**Deliverable for:** `DISPATCH_COWORK_B1_BUZZ_A_METERING.md` · **Priority:** HIGH (founder directive)
**Result: no new mechanism was needed and none is proposed. Every rule below is DERIVED
from a ruling already in the tree. The one thing B1 could have gotten badly wrong is
identified in §2 and closed without a founder gate.**

---

## §0 — WHAT I FOUND BEFORE DESIGNING ANYTHING (the dispatch's own instruction)

The dispatch said: *check the existing Resource Paymaster (CD-13) and the `epoch_funding`
invariant before designing from scratch — avoid the parallel-doc drift that almost happened
with B3.* Doing that changed this deliverable from a design into a derivation.

**⚠ FIRST, A REFERENCE CORRECTION, because it would have sent the next seat to nothing.**
**There is no `CD-13` spec file.** `CD-13` is the Resource Paymaster **capture in
`docs/feature-backlog.md`** — the two-loop law, founder direction 2026-07-06. The **spec**
is **`docs/CD-29-resource-paymaster-spec.md`** (1,741 lines, DRAFT v0.3). Both exist, both
are load-bearing, and **a seat grepping for a CD-13 spec finds nothing and concludes there
is no prior art** — which is the exact drift the dispatch was warning against, arriving
one level up through a stale identifier. **Cite both: capture = CD-13, spec = CD-29.**

**Prior art that governs this spec:**

| source | what it binds |
|---|---|
| `CD-29 §3.3` prohibitions **S-1 … S-6** | the b/A/BTC seam — **testable, grep-verifiable** |
| `CD-29 §3.5` **Q-2, two-loop tension, NOT RESOLVED, founder-class** | whether b may buy a chain commodity |
| `RULINGS_TESTNET_A_MVP_CUSTODY` | **MVP denominates in `A`** (A-first) |
| `RULING_RAIL_C_NO_FRONTLOAD` | depth follows demand **with lag**; degrade gracefully, **never fail closed on an unfillable swap** |
| `crates/atmirror` `epoch_funding` (8s/8t) | **per-claimant funding**; one shared delegate across per-user items **is the breach** |
| `crates/shared-types/src/spend.rs` + `SPEC-SPEND-RECEIPT-1` | `ResourceClass` is a **closed enum of physical things**; line items are resource quantities, **never fiat** |

---

## §1 — THE MEASUREMENT RULE (this is the whole spec)

**Buzz meters PHYSICAL RESOURCES CONSUMED, priced in `A`. It never meters access,
requests, or entitlements.**

Every metered unit MUST be a variant of the existing closed `ResourceClass` enum:

```
MeshSecond · VramByteSecond · RamByte · CpuMicrosecond · NetByte
ChunkCount · StorageByte · ChainFee
```

**A bMeshLLM inference is metered as `VramByteSecond` + `CpuMicrosecond` + `NetByte` —
NOT as "one inference."** The distinction is not pedantry and §2 explains why it is the
line that keeps the constitution intact.

**Adding a unit requires a ruling, never a caller-supplied string.** A caller-supplied
classification is not a classification — the same lesson as the mint gate.

---

## §2 — ⛔ THE ONE THING B1 COULD HAVE GOTTEN BADLY WRONG

The dispatch says *"Alpha uses Vaulta A token as compute/bMeshLLM meter."* Taken loosely,
**that phrasing walks straight into CD-29's unresolved Q-2 and past prohibition S-5.**

- **S-5** states `b != A != BTC` — three things, three laws — and forbids *"any construction
  that treats them as interchangeable."* **"A as the compute meter" is one careless
  sentence away from "A is the b of alpha,"** which is exactly the erosion S-5 names.
- **Q-2** (founder-class, explicitly unresolved in CD-29) asks whether the metabolic loop
  may buy a chain commodity. `CONSTITUTION.md` Art. V.1: the paymaster **abstracts**
  user-funded payment, it must never **absorb** cost.

**RESOLUTION — and it needs no founder gate, because the existing rulings already decide
it:**

> **A pays for the COMMODITY layer. It never pays for the SERVICE layer.**

Metering *physical resources consumed* (VRAM-seconds, bytes, chunks, gas) is a **user-funded
commodity purchase** — the money loop, where A belongs, and where the A-first MVP ruling
already put it. Metering *an inference request*, *a seat*, *a tier*, or *access* would price
the **service layer**, which is b's domain and is where the two loops would touch.

**Therefore Q-2 is NOT reached by this spec, and that is by construction rather than by
luck:** nothing here debits b for a commodity. **b does not appear in the alpha metering
path at all.** If a future change introduces a b debit into this path, **it reaches Q-2 and
must stop for a founder ruling.**

**S-1…S-6 EXTEND TO THIS PATH UNCHANGED. Grep-verifiable, a hit is a defect:** no `b`
amount in any A-metering struct, event, or identifier; no b mirrored, wrapped, or bridged
onto Vaulta; **never write "A/b" as a unit.**

---

## §3 — WHO PAYS: THE `epoch_funding` INVARIANT, GENERALISED

The dispatch describes *"Buzz converting A to ANT/AR when the user's operation needs
storage."* **A single Buzz account paying for many users' operations is the same breach
`epoch_funding` already refuses**, wearing different clothes:

> **One shared funder across per-user items is the breach.** Per-name DataItems must carry
> **their own claimant's** delegate; here, per-user operations must be settled from
> **that user's own A**.

**Rules, each testable:**

1. **Every metered operation names the paying account, and it is the USER's.** Buzz may
   *route* the payment; it must never *be* the payer of record.
2. **Buzz's own A pays for Buzz's own resources only** — its relay, its epoch anchors.
   That is the leader-funds-the-commit line, unchanged.
3. **Negative control, per 8r:** a test in which one Buzz-funded rail settles two different
   users' operations **must FAIL**. If it stops failing, the invariant has gone vacuous.
4. **Zero balance is a REFUSAL, not a subsidy.** Self-funded is now the ruled model — a
   user with no A gets a named, actionable refusal naming the missing minimum
   (`FloorRefusal`, the CD-13 "no half-born accounts" rule already typed in the onboarding
   design). **Never a silent top-up, never a loan.**

---

## §4 — A → AR/ANT CONVERSION: THE DEGRADATION PATH IS MANDATORY

`RULING_RAIL_C` is binding here and it is the rule most likely to be skipped: **depth
follows demand with lag; the design must degrade gracefully and must NEVER fail closed on
an unfillable swap.**

| condition | required behaviour |
|---|---|
| Swap fills at/inside the user's declared slippage | proceed; receipt records **quantity, rate, and `rate_set_ref`** (spend schema) |
| Swap unfillable, or worse than declared bound | **REFUSE, and name the reason.** Never auto-widen slippage on the user's behalf |
| Rail depth unknown | treat as unfillable — **an unmeasured rail is not a usable rail** |
| Storage routing | **< 256 KiB → AR · ≥ 256 KiB → ANT** (`storage-substrate-split`, measured crossover — not re-derived here) |

**The receipt is the same `SpendReceipt` already landed in `shared-types`** — no second
receipt type. The conversion appears as line items with `Rail::Vaulta` (the A spent) and
`Rail::Arweave`/`Rail::Autonomi` (the storage bought), each with its own exact `quantity`
and explicit versioned `rate`. **The rate that converted A to AR is auditable for the same
reason every other rate is: it is recorded, not implied.**

---

## §5 — WHAT THIS SPEC DOES NOT DO (fence-held)

- **No rate values, no rate-setting authority, no update cadence.** `rate_set_ref` stays
  opaque — the CD-29 §10 Q-3 and spend-spec §4 fence-holds are unchanged. **No tokenomics
  constant appears in this document.**
- **Does not resolve Q-2.** It routes around it; see §2. If b ever enters this path, Q-2 is
  live again.
- **Does not specify Buzz's internal cost model for inference** — only the *unit* it must
  report in (§1) and *who pays* (§3). How Buzz measures VRAM-seconds is Code's lane.

## §6 — ACCEPTANCE (for whoever implements)

1. Every metered unit is a `ResourceClass` variant. **Grep for a free-string unit: a hit is a defect.**
2. **Grep the A-metering path for `b`**: no b amount, event, field, or identifier. S-2 discipline.
3. Every operation's payer of record is the **user's** account, and a shared-funder test **fails**.
4. Zero balance produces a **named refusal**, never a top-up.
5. An unfillable swap **refuses**; slippage is never auto-widened.
6. All spend is reported as `shared_types::spend::SpendReceipt` — **no second receipt type.**

## COMPLICATIONS

**C1 — Alpha metering in A while the spend schema's MVP denomination is also A is a
coincidence worth watching, not a design.** `Denom` has both `B` and `A`; alpha uses `A`
because of the A-first ruling, **not** because A is playing b's role. **If anyone starts
calling A "the alpha b," S-5 has been violated in language before it is violated in code**
— and language is where these erosions start.

**C2 — I did not read Buzz's implementation.** This spec constrains the *unit*, the *payer*,
and the *degradation path*; it does not verify what Buzz currently does. **If Buzz already
meters per-request, that is a defect against §1 and it is a code finding, not a spec
change.** Named, not claimed.

**C3 — `epoch_funding`'s generalisation to A-metering is MY reading, not a ruling.** The
invariant was written for per-claimant DataItem funding. Extending "one shared funder is the
breach" to per-user A settlement is the same shape, but Seat 1 should confirm it rather than
inherit it from this document.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched.
