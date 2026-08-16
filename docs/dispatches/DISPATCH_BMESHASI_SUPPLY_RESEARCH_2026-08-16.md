# DISPATCH — bMeshAsi supply research · positioning · meter-voucher analysis · LANE R-2 (zCode)

**From:** Seat 3 (Claude Code) · **2026-08-16** · founder-directed
**Status:** OPEN — research is closed with receipts; positioning is the founder's frame;
the voucher *primitive* is held at a named fence (§4); **LANE R-2 is staged for zCode.**
**INDEX note:** indexing is Cowork's standing duty; this dispatch is not yet indexed.

---

## 0 · What this dispatch carries

Five things, in trust order: (1) verified research on compute supply for the b-metered
mesh — every load-bearing claim carries a URL or `file:line`; (2) the founder's
positioning frame, stated 2026-08-16; (3) Seat 3's analysis of the founder's question
*"can the PowerUp 24-hour rental with A prototype our bMeshAsi meter voucher?"* — with
one collision named, not resolved; (3a) a founder integration directive for the
dashboard/wallet, received mid-cut; (4) a staged lane for zCode.

Prior law that governs everything here — read before disputing any of it:
`RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW` (b spent only on physical resource
consumption, **A-first for MVP**, denominate in resource quantities never fiat),
`BUZZ_A_METERING_SPEC` + `RULING_SEAT1_B1_PHASE0_DESIGN` (A pays the commodity layer,
closed `ResourceClass` enum, Buzz routes but never pays, zero balance = `FloorRefusal`),
`CONCEPT_B_COMPUTE_BID_WORKERBEE` (**FILED, NOT SPECCED — scope-fenced**), CD-29 §3.3
S-1…S-6 (the b/A seam), `docs/bdid-architecture-decision.md` (per-user state stays off
chain RAM).

---

## 1 · Bottom lines (each backed in §2)

1. **No provider or network anywhere meters at our granularity.** Eleven centralized
   providers and ten decentralized networks all settle in whole-GPU-hours or coarse
   bundles. The closed `ResourceClass` meter (`VramByteSecond · CpuMicrosecond · NetByte
   · StorageByte …`) must be built in our runtime regardless of supply — and is therefore
   the differentiated product. Suppliers are interchangeable backends behind it.
2. **Verda is a good lane, not the base.** Real company (legal entity "Verda (DataCrunch
   Oy)"), cheapest trustworthy H100/H200/Blackwell on-demand, confirmed external-scaling
   API, ToS permits value-added third-party serving. Handicaps: 10-minute prepaid billing
   granularity, Bronze-tier reliability record, all three datacenters in Helsinki, no SLA.
3. **Supply mix, not supplier:** RunPod Serverless (per-second burst; documented
   `workersMin/Max` REST control), Verda (sustained/big-VRAM/EU anchor), Vast.ai
   (interruptible cost floor), Akash (the only decentralized lane worth plugging in
   later; real but tiny: ~$253k tracked lease revenue Q1 2026). Fly.io GPUs are dead
   (deprecated 2026-07-31). Own mesh hardware is deferred until demand outruns rented
   lanes; it then becomes one more backend behind the same meter.
4. **Model PowerUp, not the RAM Bancor market.** Correction on the record: live
   `powerup_days` = **1**, not 30 (30 days was retired REX). For flow resources
   (vRAM/CPU/NET) the chain's own corrective design — utilization-priced term rental,
   sunk fees, no lender class — is the right template; the RAM-style AMM fits only stock
   resources (storage), and only with a reserve that tracks elastic fleet capacity.

---

## 2 · Receipts (condensed; full structured output held by Seat 3, session-local)

### 2a · Verda (verda.com)

| fact | receipt |
|---|---|
| Identity: rebrand of DataCrunch Oy, Helsinki; Finnish law, Helsinki arbitration | Terms preamble, https://verda.com/terms-and-conditions |
| Cash-flow positive; >€51.3M annualized revenue Q1 2026; €100M equity+debt April 2026 (Lifeline Ventures lead) | trendingtopics.eu + thenextweb.com (press; founding year 2018-vs-2020 UNVERIFIED) |
| Serverless GPUs: B300 $8.25/h, B200 $6.72, H200 $4.40, H100 $3.58, RTX PRO 6000 $2.08, L40S $1.51; spot ≈50% flat | https://verda.com/serverless-containers |
| Instances: H100 SXM $3.25/h ($1.63 spot), A100-80 $1.79, GB300 $8.62; storage $0.20/GiB/mo | https://verda.com/pricing |
| Billing is per-minute aggregated in **prepaid 10-minute increments — NOT per-second** | https://docs.verda.com/containers/overview/ + pricing-and-billing docs |
| External scaling API CONFIRMED: REST `api.verda.com/v1/container-deployments/{name}/scaling` with `min/max_replica_count`, pause/resume, replicas — an own autoscaler can pin or drive replicas | SDK source, github.com/verda-cloud/sdk-python (`verda/containers/_containers.py`) |
| Arbitrary OCI from any registry; scale-to-zero; queue/CPU/GPU-utilization triggers | https://verda.com/serverless-containers + docs |
| ToS Schedule 1 **permits** serving third parties "provided that the service offered … does not consist entirely or predominantly of the Service" — value-added layer lawful, raw resale not | https://verda.com/terms-and-conditions |
| Payment: prepaid card / bank invoice (min €/$1,000); **no crypto rail** | https://docs.verda.com/welcome-to-verda/pricing-and-billing/ |
| SemiAnalysis ClusterMAX: **Bronze** — "entire sites can go dark", historical billing-through-downtime (remediated ≥2× credits); Terms 4.3 disclaims any SLA | https://www.clustermax.ai/cloudreview/verdadatacrunch |
| All three DCs Helsinki (FIN-01/02/03), renewable, PUE 1.2–1.3; Iceland site claims UNVERIFIED | https://docs.verda.com/welcome-to-verda/locations-and-sustainability/ |
| Egress pricing: published nowhere found — **UNVERIFIED; pin down before any `NetByte` rate is set** | — |

### 2b · The field (as of 2026-08-16)

- **RunPod Serverless** — per-second; REST/GraphQL `workersMin/workersMax/scalerType`
  updatable by an external controller (the exact broker loop, documented); scale-to-zero;
  H100 flex $4.79/h, pods from $1.99 (community). Gotcha: idle endpoints decay
  (maxWorkers→2 after 3 idle days, →0 after 7). https://docs.runpod.io/
- **Vast.ai** — per-second marketplace, H100 $1.045–2.747/h (verified-DC $1.50–1.87);
  USD-settled (crypto only as top-up); serverless autoscaler resells at cost. Reliability
  variance and host-set egress are the price of the price. https://vast.ai/
- **Modal** — metering gold standard (per-second GPU+CPU+RAM) but images run under its
  Python runtime, not their own entrypoint — wrong shape for raw-container promises.
- **Baseten/Together/CoreWeave/Lambda/Cloud Run** — each disqualified for the broker
  core: price ($6.50 H100), model-serving shape, 8-GPU node granularity, no
  scale-to-zero, or no H100-class + 3-GPU default quota, respectively.
- **Fly.io GPUs: dead** — deprecated 2026-07-31, docs 404.
- **Decentralized:** only **Akash** has arbitrary OCI + open settlement + a public
  utilization dashboard + a first-party managed-wallet/fiat broker rail; real usage is
  small (Messari Q1 2026: 33.7% GPU utilization, ~$253k tracked lease revenue).
  io.net carries a documented 2024 GPU-count-inflation history; Aethir is
  enterprise-sales, self-reported ARR; Render is render-jobs-only; Golem/Nosana/Spheron
  thin. **Verification-of-work is unsolved network-wide** except Render's app-specific
  proof-of-render — treat any provider output as untrusted; verify at application layer.
- **Akash AEP-23 → BME arc** (stable settlement decoupled AKT demand for years; fixed
  2026-03 by burn-mint through a non-transferable settlement unit): the documented prior
  art for our A-first → b-later transition. Study at the Q-2 gate, not before.

### 2c · Vaulta market mechanics (source pinned: AntelopeIO/reference-contracts @ `c526479a48370981a1e9f0ac6b3bb0e4f737afa2`; live rows via eos.greymass.com 2026-08-16, chain `aca376f2…e906`)

- **RAM market** = 50/50 Bancor relay ≡ constant-product AMM (`direct_convert`,
  exchange_state.cpp:81-108) over a **fixed** reserve; 0.5% fee each way **leaves the
  curve** (delegate_bandwidth.cpp:60,140); bytes are perpetual, transferable
  (ramtransfer), resalable. Live: base 75,927,160,370 RAM = exactly
  `max_ram_size − reserved` (cross-checked); quote 25,118,445.5255 EOS **includes a
  1,000,000 EOS virtual seed never deposited** (init, eosio.system.cpp:583; verified:
  quote − total_ram_stake = exactly 1,000,000). `new_ram_per_block = 0` — reserve frozen.
  Stale-comment warning: buyram's "100:1 reserve ratio" comment is false; weights are 0.5.
- **PowerUp** = fixed-term rental of a capacity fraction; live `powerup_days` **= 1**.
  Price `p(u) = min_price + (max_price − min_price)·u^(exponent−1)`; fee is the integral,
  ceil'd (powerup.cpp:262-315). Live exponent 2.0 (linear price), min 2,500 / max 75,000
  EOS (fee to rent 100% of the market), decay_secs 86,400. **Hysteresis:**
  adjusted_utilization ratchets to the high-water mark instantly and decays with a 1-day
  e-fold; rentals below it pay flat `p(adjusted)` (powerup.cpp:105-117, 300-308). Fee is
  a pure sink — no lender class (powerup.cpp:390). Live CPU utilization 4.13% (adjusted
  4.85%), NET 0.026%.
- **Pathologies, from the chain's own history:** July 2018 RAM cornering (perpetual
  resalable stock on a fixed curve → price set by trading, not use; rescued only by a
  15/21 BP vote to grow supply); Nov 2019 REX freeze (lender pool + maturity mismatch →
  sellrex-queue/no-new-loans catch-22, gate still in rex.cpp:462-469). PowerUp is the
  chain's own corrective: rental + utilization pricing + sunk fees.

---

## 3 · The founder's positioning frame (2026-08-16, recorded)

> *"choices equal value; especially when people have access to good free. there is
> specific product streams; our job is going to be educating our market makers the
> optimal way to deploy each sprint/project/job. We sit in the middle building trust
> through the constitution/protocol in an industry that is literally building itself."*

Seat 3's read, endorsed by the data: margin on capacity is dead (good-free exists);
what is scarce is the choice being made correctly and **provably** — and the research's
most repeated word was "self-reported." The education product is the **receipt with
counterfactual** (what this job consumed, what it cost on the chosen lane, what it would
have cost on the others), which the physical-unit denomination makes possible and
`bmesh-hwfit` already prototypes at model→node granularity. The two-loop law (commodity
at cost, service separate) makes self-dealing structurally impossible — the constitution
converting directly into the commercial trust story. **First product = meter + scorer +
receipt over other people's capacity; mesh hardware later, as one more lane.**

### 3a · FOUNDER DIRECTIVE (received mid-cut, 2026-08-16) — dashboard/wallet integration

> *"make sure this gets included in our ANT Node Farming and Gardening Dashboard/wallet
> for sure. omnicove is used more by vaulta to make sure you model the A:RAM UX:UI/
> contracts; vaulta's are more modern."*

Routing, for Goose (dashboard owner) and Claude Design (visual layer, currently held):

1. **The mesh meter surfaces in the resource dashboard** — `SPEC-RESOURCE-DASHBOARD-1`
   (bDashBoard / BNR Mission Control) gains a requirement: the utilization curve and
   ratchet state (§5's engine exposes it), per-job receipts with counterfactuals (§3),
   and — when the founder opens the concept file — voucher state. The ANT node
   farming/gardening panel is the same surface's supply side (Autonomi storage farming
   already runs per `ops/phase0/configuration.nix`): **one dashboard shows what you
   consume (metered) and what you farm (earned).** This lands as a spec change to
   SPEC-RESOURCE-DASHBOARD-1, which is DRAFT awaiting ratification — fold it in before
   the freeze, not after.
2. **A:RAM UX/UI/contract reference = Vaulta's modern stack.** Founder names
   "omnicove" — Seat 3 reads this as **Unicove**, Greymass's current Vaulta web wallet
   with the live A:RAM trading interface (**reading UNVERIFIED — founder corrects here
   if wrong**). Contract-side this is consistent with already-landed canon: prefer the
   modern `core.vaulta` action surface (`giftram`, per
   `docs/bdid-onboarding-design.md:162`) over legacy `eosio` actions; note from §2c
   that raw tables still denominate in EOS symbol under the 1:1 A wrap — any UI
   modeled on the modern stack must read through the wrapper, not the raw tables.

---

## 4 · PowerUp → meter voucher (founder question; analysis, with one fence named)

**Carries over verbatim:** term rental of a flow (no perpetual stock → no 2018-style
cornering); sunk fee, no lender class (no 2019-style run); the utilization curve with
ratchet-and-decay hysteresis — which doubles as the autoscaling signal (price crossing
the marginal cost of the next rented replica *is* the scale-up trigger); `max_payment`
as the `FloorRefusal` shape in a struct field; one uniform term (renewal chains cover
long jobs).

**The lawful alignment:** PowerUp sells a *reservation*. `VramByteSecond` is inherently
reservation-shaped (bytes held × seconds), and upstream cost is reservation-shaped too
(providers bill per replica-minute, used or not). Reservation vouchers therefore make
Art. V.1 abstracts-not-absorbs hold **by construction** — idle is the user's, priced
into their choice, taught by the receipt. CPU-µs/NET-bytes remain drawdown lines inside
the voucher's budget.

**Five deltas from PowerUp:** (1) absolute resource quantities, not fractions of fleet
weight — the ruled denomination requires physical quantities, and jobs have absolute
requirements; (2) **no third-party payer** — `powerup(payer, receiver, …)` is exactly
the shared-funder breach the `epoch_funding` invariant refuses; the paying account is
the user's, always; (3) voucher rows live **kernel-side**, never on chain RAM
(bdid-architecture-decision), with A settlement on-chain and turn-metrics→Autonomi as
the audit trail; (4) curve parameters = the supply mix's cost curve — `min_price` ≈
sustained-lane cost, high-`u` region ≈ marginal burst-lane cost, so the congestion
premium **is** the cost recovery for elastic overflow (parameter values are a founder
gate); (5) CD-29 §4 voucher hygiene — hard expiry, unique voucherId replay key,
policyVersion, opaque correlation handle, **no b field anywhere** (S-1; b stays a
kernel-side UX denomination per S-4; A settles per the MVP ruling).

**⛔ FENCE, named and not resolved:** `CONCEPT_B_COMPUTE_BID_WORKERBEE` is FILED, NOT
SPECCED, and its Q2 asks whether a compute voucher is `bTiMe` or a sibling primitive —
with the explicit warning that near-identical primitives drift. The **meter-voucher
struct** is therefore NOT staged for build. The founder's direct question this session
is noted as a signal, not treated as the concept's opening. **What proceeds now is the
pricing mechanism only (§5), which is derived from ruled canon (B1 + spend boundary) and
verified source, and names no primitive.** Whether the meter voucher, `bTiMe`, and the
workerbee voucher are one object or three is the founder's word when he opens the
concept file.

---

## 5 · LANE R-2 · zCode — the utilization-pricing engine (staged, ready now)

Following the R-1 pattern: independently testable, collides with nothing open, zero
external spend, no keys, no chain writes. Orientation §1 laws and §2 box traps apply;
build/test in WSL; hand back as a diff or dispatch — **one seat, one tree.**

**Build `crates/bmesh-meter`: a pure-library utilization-pricing engine.**

Requirements:

1. **The price/fee function family, parameterized** — `p(u) = min + (max − min)·u^(e−1)`
   with the exact integral fee over `[u0, u1]`, ceil semantics, `e ≥ 1` enforced. All
   parameters injected (struct of named fields); **no priced constants committed** — the
   values are a founder gate (§6). Derive semantics from the pinned source
   (reference-contracts @ `c526479a…`, powerup.cpp:262-315), not from this dispatch's
   prose. Note: at `e = 1` the source's formula gives flat `p = max_price` — encode what
   the source does, not what intuition expects.
2. **The hysteresis object** — adjusted-utilization ratchet + exponential decay
   (`decay_secs` injected), and the flat-price-below-watermark rule (powerup.cpp:300-308).
   Expose the ratchet state readably: it is the autoscaler's input signal.
3. **Conformance vectors against live mainnet** — using §2c's captured `powup.state`
   numbers (exponent 2.0, min 2,500, max 75,000, decay 86,400, CPU utilization
   15,771,913,637,620 / weight 381,816,116,585,640, adjusted 18,499,333,784,624), compute
   at least three fee cases and verify against **independently hand-derived** arithmetic
   written into the test comments — the vector must not be produced by the function it
   tests.
4. **Property tests:** fee(u,u) = 0; fee monotone in the interval; fee additive across
   adjacent intervals (fee(a,b) + fee(b,c) vs fee(a,c) — state and encode the exact
   ceil-rounding tolerance the source implies); ratchet never decays below current
   utilization.
5. **Negative control (8r culture):** a test that MUST FAIL if the `e ≥ 1` guard or the
   flat-below-watermark rule is deleted. If it stops failing, the invariant went vacuous.
6. **Stub law §0.7:** no `#[allow(dead_code)]`, no underscore-silencing. Unbuilt parts
   are absent, not silenced.

**Explicitly NOT in scope:** the voucher struct or any primitive named voucher/bTiMe/
workerbee (§4 fence); pricing constant values; any Verda/RunPod/provider API calls; any
on-chain read or write; anything denominated in b (S-1 grep applies: a `b` amount in any
identifier in this crate is a defect).

**Acceptance:** `cargo test` output pasted, real and unedited, from WSL. Seat 3
spot-verifies before landing, per the R-1 precedent.

---

## 6 · FOUNDER GATES touched by this dispatch (named, unresolved)

1. **Curve parameter values** (min/max/exponent/decay per ResourceClass) — economics,
   ORDERS-1:61 forbids seats designing them. The mechanism ships parameterized.
2. **Q-2 (CD-29 §3.5)** — b entering the commodity-metering path. Stays gated; A-first
   stands. Akash's BME arc (§2b) is the study material when this opens.
3. **CONCEPT_B_COMPUTE_BID Q2** — is the meter voucher `bTiMe`, the workerbee voucher,
   or a sibling? One word from the founder opens it; until then no seat builds a voucher
   primitive.
4. **Egress pricing at every provider** — UNVERIFIED across the board; must be pinned
   before any `NetByte` rate is quoted to anyone.

**Standing rules:** orientation §1 / bullpen §5 apply unchanged. Receipt rule on
everything. Execute the prompt as written.
