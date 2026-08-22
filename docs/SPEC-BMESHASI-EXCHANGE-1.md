# SPEC-BMESHASI-EXCHANGE-1 — the community iron exchange (metered · iron paid first)

**Founder order, verbatim (2026-08-22, Discord-lane session):** *"i don't want to
reiterate the same info.  i want to save him/everyone aws fees with our stack and get
reimbursed properly with our b metered bMeshAsi vRAM bBuzz communities with bAigents
shared resources and get paid so everything we are paying for vps/hardware/bandwidth
is getting autonomously paid first through our UI/UX.  we can synergistically leap
frog the industry/market"*

**Status:** **DRAFT by zCode (GLM 5.3), 2026-08-22** — spec-before-code honored; the
v0 surface lands in the same session under the UI-FIRST FLEET LAW (a lap is not done
until the founder can click it on the public fleet). All economics stay behind the
named gates; nothing on the surface may exceed the §7.6 claim ceiling.

**Lineage (do not re-invent — all landed):** [[SPEC-ORIGINATION-1]] §7.5 (the ingredient
weighed — its honesty law binds this surface **verbatim**), [[DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16]]
(the R-lanes + the four named gates), [[RECEIPT_ZCODE_R2_BMESH_METER_2026-08-16]] (the
metering engine, landed at `crates/bmesh-meter`, 17 tests, mutation-proven),
[[DISPATCH_COWORK_B1_BUZZ_A_METERING]] (A-first law + the self-funded constraint),
WALLET-GATE LAW (`366ea1f`), DANGLING-ART doctrine (`3bf7b8a`),
`docs/ledger/pirate-haul-candidates.md` ant.report addendum 2 (2026-08-22, `747c3ca`).

---

## 1 · What this is

The outward bridge of the bMesh lane. Until now the metering rail was inward-facing
math; this spec opens it to the community as an **exchange**: builders who are burning
real cloud money (exhibit 1: ant.report, self-funded ~$2.5k/mo AWS) can move workloads
onto **community iron** — boxes community members already pay for or hold free-tier —
and the estate's stack meters the usage and settles so that **the iron is reimbursed
first**. The founder's economics in one line: *save them the AWS fee; pay our own
VPS/hardware/bandwidth before anything else; do it autonomously through our UI/UX.*

## 2 · What exists today (the weigh-in, per SPEC-ORIGINATION-1 §7.5)

| exists | evidence |
|---|---|
| utilization-pricing engine, pure, 17 tests, mutation-proven | `crates/bmesh-meter` (R-2 receipt) |
| VRAM admission scoring, 5 tests | `crates/bmesh-hwfit` |
| one heartbeat endpoint, one hardcoded node, 0 metered tokens | `crates/wallet-relay` buzz stub |
| A-first metering law + self-funded constraint | B1 dispatch |
| community iron, pledged (Oracle free-tier 4c/24GB + headroom) | founder word 2026-08-22 |

**Does NOT exist (and the surface says so plainly):** a mesh (no peers, no registry,
no discovery, no work dispatch), an inference runtime, GPU detection, live settlement.
*"Do not let a name do a crate's work."* — the surface carries this sentence and the
two-column truth that goes with it. v0 is a **surface + the meter math made clickable**,
not a claim that settlement is live.

## 3 · The exchange model

- **Providers** pledge iron (VPS slices, free-tier boxes, bandwidth) to the board.
  Pledging is a statement on a static surface — no keys, no credentials, nothing
  leaves the provider's hands until a founder-gated onboarding (MX-6).
- **Consumers** book resource classes: `mirror-hosting` (static public pages, the
  ant.report lane), `vRAM` (model-fit memory-hours, admission-scored by bmesh-hwfit),
  `CPU-node` (community node capacity), `bandwidth/egress` (class open, rates GATED — MX-4).
- **The meter** prices utilization with the landed `bmesh-meter` semantics
  (`p(u) = min + (max−min)·u^(e−1)`, flat-below-watermark, integral + ceil, ratchet
  decay). Parameter VALUES are economics → MX-1, never committed; the surface's
  calculator runs the **reference vectors from the pinned public source** (the R-2
  conformance numbers) and labels them as such.
- **Settlement** is A-first (B1 law): metering deducts from the spender's own balance —
  never an endowment, never a subsidy, never a treasury. Consuming/spending sits behind
  the wallet session per WALLET-GATE LAW; **viewing the exchange is and stays open**
  per DANGLING-ART. **PROTOTYPE DENOMINATION RULED (2026-08-22,
  [[RULING_A_NATIVE_JUNGLE_FIRST_2026-08-22]]): Vaulta's native A token carries every
  metered unit of the prototype — Q-2/MX-2 unchanged and closed; deployment is
  JUNGLE-FIRST (gate MX-7).**

## 4 · The waterfall law (the founder's core order)

**IRON FIRST.** Meter revenue reimburses the iron — VPS, hardware, bandwidth, the
providers' actual costs — **before anything else is paid**. On the surface the ORDER
is the law and is drawn as the waterfall; the RATIOS are economics and sit behind
MX-1. No surface, spec, or code may imply a ratio until the founder words one.

## 5 · The surface contract — `surfaces/bmeshasi.html`

Fleet style (tokens.css + inline fallback, dark, IBM Plex Mono), single file, zero
server state, zero fetches, pure client-side. Sections:

1. hero + claim-ceiling banner (§7.6 wording limits bind)
2. **the weigh-in** — exists / not-yet, two columns, the verbatim §7.5 sentence
3. **the exchange + waterfall** — roles, classes, IRON FIRST order, self-funded law,
   wallet-gate vs open-viewing
4. **the meter, clickable** — sliders (e, min/max, watermark, interval), fee computed
   by a faithful JS port of `crates/bmesh-meter` semantics, reference parameters
   labeled as reference; the waterfall shows order, never ratios
5. **the supply board** — rows with honest statuses (PLEDGED / OFFERED / GATED), the
   ant.report mirror as exhibit 1, bAigents vRAM gated on the mesh, bBuzz A-first
6. **founder gates** — MX-1..MX-6, all OPEN
7. **why the armada wins** — receipts only: the ANT/ETH convergence receipt, the
   storage-TCO receipt, links to the ledger

v0 has **no `data-i18n` keys** (the i18n wave is another seat's in-flight file);
adding them is a follow-up lap when that wave lands.

## 6 · FOUNDER GATES (all OPEN — no seat may resolve these)

- **MX-1** curve parameter VALUES per resource class (economics; ORDERS-1:61).
- **MX-2** Q-2 — `b` entering the commodity-metering path (stays gated; A-first stands).
- **MX-3** voucher identity (bTiMe / workerbee / sibling) — no voucher primitive until word.
- **MX-4** egress/bandwidth rates — UNVERIFIED at every provider; never quoted to anyone.
- **MX-5** the wallet-gate merge point for exchange spend (the ruled-open WHERE question, 366ea1f).
- **MX-6** external-customer onboarding (ant.report acceptance) — founder-hands only.
- **MX-7** mainnet deployment of any BNR smart contract — **RULED (2026-08-22): only
  after the contract is fully built and fully tested on the Jungle testnet** (test bed
  `banchor22222`, RAM already bought; see [[RULING_A_NATIVE_JUNGLE_FIRST_2026-08-22]]).

## 7 · Non-goals (hard)

No voucher primitive (MX-3). No `b`-denominated amount in any identifier — the S-1
grep applies to every file this spec touches. No provider API calls, no chain reads or
writes, no clock reads in any meter code (time and parameters injected). No egress
rate quoted (MX-4). No claim stronger than *sound by construction / isolated by
design*, and no implication that settlement, the mesh, or reimbursement is LIVE.

## 8 · Acceptance

Surface live on the fleet pattern: hub card + footer count bumped, review roster row,
smoke count assertion synced, `e2e/university-smoke.mjs` and `e2e/estate-review.mjs`
green, receipt dispatched. Push rides the founder push-roster word (stand-down law).
