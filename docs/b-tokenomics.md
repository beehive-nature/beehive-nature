# BNR tokenomics — b and bRespect

<!-- 9 agents. Fractally White Paper 1.0 read in full (49 pp); all page cites
     are to it. 2026-08-04.
     SCOPE WARNING: written BEFORE the founder's sovereignty ruling that
     physical meetups are a nonstarter. Every passage assuming co-located
     circles (notably the simultaneity anti-sybil bar) is SUPERSEDED — that
     load now sits on the canonical biometric key (canonical-biometric-key.md).
     The ladder, the two-instrument split, the calibration, the decay rule and
     the mint-only invariant are independent of how people are grouped and stand. -->

# BNR Tokenomics Specification — **b** and **bRespect**

**Version:** draft for founder ruling
**Prior art:** *ƒractally White Paper 1.0*, Daniel Larimer et al., read in full (49 pp.). All page cites are to that document.
**Status of the source:** the paper self-describes as experimental in its own legal disclaimer (p.3). Its only cited operating precedent is Eden (p.25, fn. 6), a small blockchain community used to prototype the consensus process (p.3). **Nothing in the paper reports a deployment at its own 7,776-member cap, and no mechanism in it has published evidence at 10⁶ users, let alone 10⁹.** Treat every borrowed number as a hypothesis, not a measurement. I have not independently verified post-2022 deployment history; where I have not, I say so.

---

## 1. The two instruments

Fractally has **one** instrument. Respect is simultaneously the reputation score *and* the tradeable token: it can be transferred, but it "is always held in the opinion of the community" (p.13). Consequently **there is no bRespect→b conversion mechanism in the source to copy.** The two-instrument split is a BNR invention. The nearest structural analogue in the paper is not Respect at all — it is **vote weight** (p.30), which is non-transferable, grows by meeting rank, and decays 5%/week. bRespect is shaped like vote weight. b is shaped like the escrow/pending account (p.17).

### 1.1 bRespect — the non-transferable presence stock

> **bRespect is created only by a body seated in a quorate circle, held only by the root that earned it, decays continuously at 20% per 28-day epoch, and is extinguished by decay, by governance fine, or by the root ceasing to exist. It can never be sent, sold, lent, delegated, pledged, or wrapped.**

- **Symbol:** `R`. Unitless. Hard ceiling 120 (§4.2 — the ceiling is *endogenous*, not imposed).
- **Denominated in:** nothing. It is a weight, not a balance. It is spent without being consumed — using it to unlock b does not reduce it.
- **Sole issuance path:** circle attendance (§2.1).
- **Sole functions:** (a) sets the velocity at which b unlocks (§4); (b) sets governance standing (§6.4). It has **no** claim on any pot, no yield, and no market.
- **Contract invariant:** `bRespect` has no `transfer` entrypoint. Not a disabled one — an absent one.

### 1.2 b — the transferable emission

> **b is created only by minting against a root's own lifetime cap at the moment a circle reaches consensus, is held first in a locked `reserve` and only later in a transferable `spendable` balance, and is extinguished only by burn (query fees, §5.6) or by governance slash against `reserve`.**

- **Symbol:** `b`. 18 decimals. Native to Vaulta. Fully transferable *once spendable*.
- **Lifetime emission cap:** 420 × 10¹⁸ base units = **420 b per root**, tracked as `minted_to_date` on `BLedger`. This is an **earn** cap. Because b is transferable, it is not a wealth cap — a root may hold more than 420 b by buying, and less by selling.
- **Two balances, one asset:** `reserve` (locked, slashable, non-transferable) and `spendable` (free). `spendable_of` is what a wallet shows. `balance_of` = `reserve` + `spendable`.
- **Mint-only invariant (mandatory, contract-level):**

```
reserve_delta > 0  ⟹  caller == self
                   ∧  minted_to_date increases by exactly reserve_delta
                   ∧  minted_to_date ≤ 420e18
```

  There is **no deposit path into `reserve`.** Treasury-t0 maturation lands in `spendable` or in its own account. Without this invariant the velocity coupling prices the identical token at two different values depending on who holds it (§4.6) and a laundering market forms immediately.

### 1.3 The non-conflation rule

| | bRespect | b |
|---|---|---|
| Transferable | **No** | Yes, once spendable |
| Cap | 120, endogenous, per root | 420 lifetime mint, per root |
| Decays | Yes, 20%/epoch | No |
| Earned by | seated bodies in quorate circles | seated bodies in quorate circles |
| Buys | unlock velocity + governance standing | goods, services, query fees |
| Yield to holders | **zero** | **zero** |
| Ladder it rides | Fibonacci rank weight *plus a flat presence credit* | Fibonacci rank weight only |

Note the last row. This is the one asymmetry that does all the work: **rank sets the amount of b you mint; presence sets how fast it becomes spendable.** Neither is purchasable.

---

## 2. What Fractally got right that BNR should take

Each item: the mechanism, its page, and the modification forced by (i) the 28-day epoch and (ii) physical co-location.

### 2.1 The Fibonacci rank ladder — 2, 3, 5, 8, 13, 21 (p.22)

Take verbatim, for **b mint only**. The paper's justification is the Ultimatum Game (p.24): consecutive Fibonacci ranks imply a 38/62 split, which is above the ~$30-on-$100 rejection threshold observed experimentally, so a group can actually agree. That argument is culture-dependent and the paper says so (p.24) — but it is the only reward curve in the document with an empirical rationale behind it, and it is sound.

Take also the 5-member rule verbatim (p.22): a circle of five ranks **2 through 6**; nobody receives rank 1. A 6-circle pays 52 weight; a 5-circle pays 50.

**Modification for BNR:** the ladder is *absolute* here, not relative. Fractally never reconciles its absolute Fibonacci table (p.22) with its 6%-normalisation rule (p.15) — that contradiction is unresolved in the source. BNR has no supply normalisation, so the table is literal:

```
m_i = f_i · w_i · θ_i / 26          capped at 21/26 = 0.807692 b per root per epoch
```

`f` = Fibonacci rank weight, `w` = presence weight, `θ` = duration factor (§2.4).
A full co-located circle of 6 mints **exactly 2.000 b per epoch**. Annual b income for a root at constant rank is exactly **f/2**.

The scalar 1/26 is chosen so that **420 b = a forty-year career at the top of your circle, every epoch, never missed** (10.5 b/yr × 40 yr). That is the calibration argument; §4.4 shows the cap binds for essentially nobody else.

### 2.2 4-of-6 / 3-of-5 consensus or nobody earns (p.19, p.21, p.26)

Adopt unchanged, including all three failure rules:
- consensus failure in a later round → keep prior rank, net increase zero (p.23);
- consensus failure in the first (and, for BNR, only) round → rank 0, nothing earned (p.23);
- reporting against the majority → rank 0 regardless of the circle's actual consensus (p.23).

The group-size analysis at p.25–26 is correct and already matches BNR's ruled circle of 5–6: 4-of-6 means ≥67% to agree and ≥50% to block, which is the corner that maximises Byzantine tolerance while minimising minority hostage-taking. 5-of-7 would let 42% hold 58% hostage; 4-of-7 drops consensus to 57%, below the 67% BFT line (p.25).

**Modification:** none to the rule. But note the exposure — a cartel needs only 4 seats, not 6, and the two honest members' best response under p.23's disagree→rank-0 penalty is to ratify their own subordination rather than take zero. Maximum extractable gain from this is **+16.8%**, at a cartel controlling ~65% of a shard, and it self-cannibalises beyond that (the cartel starts ranking its own members down). It is bounded and it is not the dominant attack. §5.5 is.

### 2.3 Simultaneity as the Sybil bar (p.19)

The paper's entire anti-Sybil mechanism for meetings is that all groups in a round meet at the same time, so one person cannot attend two. Adopt and **strengthen**.

**Modification:** Fractally fires this bar 52×/year over video; BNR fires it 13×/year in physical rooms. That is a 4× frequency deficit, more than repaid by the per-event probability. Over video a duplicate *can* attend two calls (two laptops, one muted) — per-event failure probability for the duplicate is maybe 0.2–0.4, and only if peer review notices. In a beacon-bound physical slot one body cannot occupy two rooms: per-event probability ≈ 1.0. **13 events at q≈1 dominates 52 events at q≈0.3.**

### 2.4 The two-phase commit (p.20–21) — and the duration record BNR nearly threw away

Salted hash of the consensus order, then reveal after everyone has committed. Its stated purpose is to prove consensus was actually reached: someone absent from the call would not know how to report in (p.21). It defeats copying, absentee participation, and — via the separate check-in hash/reveal (p.20) — caps each participant's influence over group assignment at exactly one bit.

**Adopt, and this is your `ProofVerifier` specification.** The only shipped `ProofVerifier` accepts any non-empty string. Under this design that is not a peripheral bug; it is the entire cost-asymmetry term. **Highest-severity item in the codebase, and it must land before anything else in this document.**

**Modification — and this is the most important single change in the spec.** Fractally's meetings are recorded video published to IPFS (p.20, p.46). That recording is a *duration record*: it is objective evidence of who was present and for how long. Going physical buys a large increase in presentation-attack cost — but it silently **deletes the duration record**. Nothing else in the design prices minutes. A circle that pre-agrees a rotation table and dissolves in 12 minutes mints the identical 2.000 b as a circle that deliberates for 90.

So BNR must reconstruct it:

```
θ_i = min(1, T_i / T0),     T0 = 75 minutes
```

`T_i` = beacon-attested **contiguous** co-presence. Mechanism: the beacon emits a nonce every 5 minutes across the slot (15 nonces). Each root co-signs each nonce together with ≥3 other circle members' proximity attestations (BLE/UWB). Commit the Merkle root on-chain; reveal on challenge. Cost ≈ 1,030 aggregated BLS signatures/sec at 10⁹ roots, ≈ **$0.002 per root per epoch = 0.04% of C_honest**. Energy delta is nil — the room lights dominate by five orders of magnitude.

θ multiplies **both** the b mint and the bRespect grant. A 12-minute flash circle scores θ = 0.16.

### 2.5 Vote weight — decaying, rank-fed, non-transferable (p.30)

This is the template for bRespect and it is the strongest single idea in the paper. Weight decays 5%/week or 1 unit (whichever is greater) and grows by **rank** in the weekly meetings, smoothed over 12 weeks. Wealth cannot buy it. Media influence becomes a derivative of embodied presence.

**Modification — three:**

1. **Port the decay by day, not by period.** 5%/week over 28 days is 1 − 0.95⁴ = 18.55%. BNR rules **20% per epoch**, i.e. 0.7938%/day, half-life **87.0 days** against Fractally's 94.9. Slightly tighter recency, chosen because the 28-day cadence gives 4× fewer samples so the estimator should weight the present more. **Specify δ in days in the contract**, so a future cadence change does not silently retune the ratchet.
2. **Retain the "or 1 unit, whichever is greater" floor.** It drives an absentee to exactly zero in finite time rather than asymptotically, and it kills dust.
3. **Port the smoothing window by sample count, not wall-clock.** Fractally smooths over 12 weeks (p.30) for media weight and 20 weeks (p.35, p.39) for Council/liquidity rank — two different windows, unjustified. Standard error scales 1/√n, so "12 weeks ≈ 3 epochs" is wrong: 3 samples give 1.73× SE reduction against Fractally's 3.46×, i.e. **BNR's rank estimator is 2× noisier at equal wall-clock.** BNR uses **one** window, **12 epochs (336 days), implemented as an EWMA**, for governance standing only.

### 2.6 The escrow / pending account (p.17, p.48)

Earned value lands locked in a pending account, drips out at a governed rate, and the locked portion is slashable by governance. The paper states both purposes explicitly: a bond the community can fine against, and an automatic staking mechanism so decision-makers have skin in the game.

**This is the real prior art for b's `reserve`.** BNR gets the bond property for free.

**Modification — and you must rule on a bug in the source.** p.17 says at most 5% of the pending Respect converts per week, and then that an account waiting 20 weeks converts 100%. **These contradict.** 5% of the *running* balance is geometric: 1 − 0.95²⁰ = **64.2%** at week 20, and it never reaches 100%. The glossary (p.48) repeats the error. Fractally decided this by accident; BNR must decide it deliberately.

**BNR rules: geometric, fraction-of-remaining semantics.** Reasons: (a) the reserve never empties, so a slashable bond exists for the life of the root — which is exactly what p.17 says the pending account is *for*, and BNR needs it more than Fractally does; (b) the unlock rule stays stateless, with no per-tranche entry-balance bookkeeping across 520 epochs.

**Consequence you must publish, not bury:** `minted_to_date` can reach 420. `spendable_of` never can. A residual bond of roughly 11–21 b stays locked for as long as the root is alive (§4.5). *"420 is the lifetime mint ceiling"* is true. *"You can eventually hold 420 b of your own earning"* is false.

### 2.7 Promptness → automatic lowest rank (p.20)

Anyone failing to join within 5 minutes is automatically ranked lowest; if more than two are late, the latest ranks lowest. Subjectively enforced by each group, with the Council able to hold a non-enforcing group accountable.

**Adopt, and it is strictly stronger physically** — you cannot fake being seated. **Modification:** the check-in window widens from 10 minutes (p.19) to a **72-hour capacity declaration + 24-hour binding commit**, because physical attendance requires travel notice. The commit is repurposed: it declares capacity, it no longer sources the randomness (§3.2).

### 2.8 Post fee, difficulty-adjusted ±5% (p.30–31)

One post per 10 minutes on average, cost measured in Respect, adjusting up 5% above 7 posts/hour and down 5% below 5, re-evaluated every 6 posts or every hour. 50% of the fee to the reward pool; 100% if downvotes exceed upvotes.

**Adopt the controller, discard the setpoint.** This is the one piece of demand-side machinery in the paper and BNR needs it far more than Fractally did — retargeted, it becomes the **query-fee burn controller** that sets φ (§5.6). Perfectly aligned with the ruled "no subsidy, users pay."

### 2.9 Square-then-subtract vote tally (p.30)

Post weight = (sum of upvotes)² − (sum of downvotes)², not the Hive error of netting first and then squaring (p.29). The paper works the griefing case: under net-then-square, at 3 upvotes the first downvote costs the poster 5; under square-then-subtract it costs 1. **Adopt if media ships.** Correct fix to a real, documented, deployed failure.

### 2.10 Invite rationing by rank (p.37) — as the *replacement* for paid recruitment

To qualify to invite, you must have attended the most recent meeting; invites are rationed by rank as the community fills, down to a single invite for the single top contributor at 7,775 members.

**Adopt.** This is a non-monetary recruitment incentive that mints nothing, and it is the substitute for the 5% recruitment commission BNR must reject (§3.3).

### 2.11 The extended community (p.38)

The size cap applies to *governance* — teams, consensus, voting — not to token ownership, posting, or holding. The paper explicitly contemplates a billion people using a currency governed by 7,776.

**Adopt wholesale. This is how BNR reaches 10¹⁰ roots without ranking 10¹⁰ people in one tree.** Circles and bRespect are venue-local. b is global and settles on one chain. §3.6 explains why the alternative is arithmetically impossible.

---

## 3. What Fractally does that BNR must NOT copy

**Governing test:** Fractally has 6%/yr perpetual inflation and no cap ever (p.15). BNR has a 420-per-root lifetime cap. **Under a cap, any channel that mints is a channel that eats a root's lifetime allowance.** That single test does most of the work below mechanically.

> **Governing principle: only the circle mints. Every other channel redistributes fees, or does not exist.**

### 3.1 HODL / Sponsorship yield (p.32) — **reject categorically**

Lock Respect for 6 months, receive an increase from a pool funded by the meetings. The paper's own worked example: 900 R average locked, 333 R pool, a new 100 R sponsorship earns 33 R after six months — **~77% APY paid to capital, funded by contributors' emission.** p.16 lists providing liquidity as one of the six ways to earn.

**In Fractally, capital earns the reputation currency without attending anything.** Reject. BNR's entire uniqueness architecture — 10⁻⁷, biometric, presence ratchet — is bypassed the instant holding b earns bRespect. **Zero yield on b. bRespect earnable only by bodies in circles.** This also makes the paper's own "not a security" argument at p.41 indefensible for a passive holder: profit expectation from the efforts of others is the Howey test almost verbatim, whatever the disclaimer says.

### 3.2 The reveal-hash shuffle (p.20) — **reject, superseded**

Each participant can change one bit of the grouping randomness by choosing whether to reveal. The paper calls that provably honest for practical purposes. BNR's VRF + beacon gives **zero** grinding bits. Strictly better; keep the commit for capacity declaration only.

### 3.3 Recruitment commission — 5%, fractal, unbounded depth (p.16, p.37) — **reject**

5% of anything your invitees earn, and a share of *their* recruitment rewards. Total upline take is 5% + 0.25% + 0.0125% + … = **5.26% minted on top of every unit earned.**

Two independent reasons to reject. First, it mints against the cap. Second, and worse: it pays users to build **deep, dense, single-rooted invite trees** — precisely the topology BNR's lineage-disjointness rule (≥2 members with no common ancestor within 3 rounds) exists to break. Importing it means paying users to make your own eligibility constraint harder to satisfy, and at scale you run out of lineage-disjoint pairings inside geographic clusters. Replace with §2.10.

### 3.4 Teams with matching Respect (p.16, p.27–28) — **reject as emission**

Teams earn matching Respect for everything their members earn — a 50–100% emission surcharge, impossible under a cap. Team leaders of the top 12 teams also *become the Council* (p.28, p.39), which turns governance into a team-formation game.

Fractally needs teams because at weekly cadence with random reassignment, the repeated-game structure it relies on (p.27: repeated interaction beats random pairing) has to be purchased somehow. **BNR gets it free from physical co-location.** A venue is a fixed local population; the same faces recur across epochs even when circles do not. This is the strongest argument for dropping teams-as-emission without losing anything, and it is a benefit of physical co-location that has not previously been priced.

### 3.5 Per-fractal currencies, AMM mesh, liquidity subsidies (p.33–36) — **reject**

Each fractal has its own Respect token; convertibility requires Mutual Respect held in two communities, with 144-hour unstake delay and top-12 Fibonacci subsidies voted by 20-week average rank. b is one token native to Vaulta, so the entire problem is moot. Keep exactly two things: (a) the **144-hour unstake delay** as a general anti-JIT pattern for any future b staking; (b) the **anti-hub topology argument** (p.34–36: liquidity attracts liquidity, cap peers at 6–12, disincentivise closed circles) — which applies verbatim to BNR's **circle assignment graph** and is a good independent justification for lineage-disjointness.

### 3.6 Fractal escalation, up to 5 rounds (p.19, p.22–23) — **reject for b mint. Rule it now; three prior BNR drafts contradict each other on this.**

Under the cumulative ladder (round 3 top = 2,584 Respect, p.23), a round-3 winner at `m = f/26` would mint **99.4 b in a single epoch — 23.7% of a 420 lifetime cap — for one long day.** Nothing in the velocity coupling constrains that, because the R cap of 120 neuters escalation on the velocity side only.

Three further reasons:
- **Physically impossible at scale.** Five sequential co-located rounds is 6h15m for the top 0.077%. The paper itself misstates this as 4–5 hours for the top 1% (p.19); the arithmetic is 5 × 60 min + 4 × 15-min breaks, and 6/7,776 is 0.077%, not 1%. And the promoted are geographically scattered *by construction* — lineage-disjointness guarantees it.
- **The source table is broken.** Round 2 subtracts 21 (rank-6's *cumulative* award); round 3 subtracts 212 (rank-11's *net increase*, not their cumulative 233). Under the round-2 convention, round 3's net column should read 0, 144, 377, 754, 1364, 2351. The published numbers **overpay every round-3 participant by 21.** The paper's arithmetic does not close.
- **BNR does not need it.** Escalation exists in Fractally because there is **one shared weekly emission pot** that must be divided across the whole community, so the whole community must be rank-sorted into one order. **BNR has no shared pot.** Every root has its own 420. There is nothing to escalate over.

**Ruling: round 1 only for b mint.** If escalation is ever wanted for governance standing, it rides the **ordinal** ladder (rank 1–30) feeding bRespect, never the Fibonacci ladder feeding b, and the per-epoch mint cap of 21/26 b holds unconditionally.

### 3.7 6%/yr perpetual inflation (p.15) — rejected by ruling, but **you must replace what it was doing**

The paper's stated rationale is that present contributions are necessary and historic contributions decay in value. That inflation is Fractally's answer to "why show up in year 5" *and* its only compensation for late joiners. BNR's cap inverts the gradient: early roots exhaust headroom, late roots have full headroom. Rejecting p.15 removes the source design's only late-joiner mechanism. §7 is where BNR has to pay for that, and the substitute "bRespect decays" does **not** do the job on its own — decay punishes *inactive* early holders, and an early adopter who keeps attending sits at R=120, A=40%, forever.

### 3.8 The 7,776 cap as a *global* limit (p.37) — reject globally, adopt venue-locally

7,776 = 6⁵ exactly: it is not Dunbar (the paper cites Dunbar at p.37; Dunbar's number is 150), it is the largest population five fractal rounds can rank-sort. With escalation dropped, the number has no meaning for BNR. Use **6³ = 216** as the venue-local shard target and spawn a sibling venue at ~200 (adapting the p.39 rule that a community reaching 7,000 should sponsor a new fractal).

### 3.9 "The community may freeze or reallocate Respect at any time for any reason" (p.41)

**Adopt for bRespect. Reject for b.** A reputation weight the community can revoke is coherent. A transferable token the community can confiscate from a third-party buyer is not, and it would make b unusable as a settlement asset. Governance slash reaches `reserve` (which the earner never transferred) and never `spendable`.

### 3.10 Aragon-style optimistic governance and stake-weighted jurors (p.42–44) — reject

Adopt Fractally's critique wholesale; all four of its objections (Pareto-distributed juror participation, Schelling-point convergence on public polls, tragedy-of-the-commons on challenge costs, rational ignorance) are *worse* for BNR, and stake-weighted anything is precisely what bRespect exists to prevent.

### 3.11 The paper's flagship fairness claim is wrong — do not repeat it

p.22 claims 16% of first-cycle participants earn about 40% of the compensation, "a softer form of the 80/20 Pareto principle." True for round 1 in isolation (21/52 = 40.4%, held by 1/6 = 16.7%). Across all five rounds at the 7,776 cap, **16.7% take 96.9% and six people take 60.9%, with a single weekly winner taking 24.6%.** The flagship claim is contradicted by the paper's own multi-round design by roughly three orders of magnitude. Dropping escalation (§3.6) is what makes the 40.4% figure honest for BNR.

### 3.12 On borrowing from an undeployed design

The paper is a 2022 blueprint. Its disclaimer says the concepts are experimental (p.3). The Fibonacci ladder is justified by a *cited* experimental result (the Ultimatum Game, p.24) applied by analogy, not by measurement of this mechanism. The 5%/week escrow rate has no derivation at all. The 12-week and 20-week smoothing windows have no derivation and disagree with each other. The 6%/yr inflation target has no derivation. **Four of the six numbers BNR is tempted to borrow are unjustified constants in an untested document.** Borrow the *shapes* — decaying rank stock, locked-then-dripping reserve, consensus-or-nothing, simultaneity, square-then-subtract — and re-derive every scalar against BNR's own constraints, as §4 and §5 do.

---

## 4. The velocity function

### 4.1 The three equations

```
bRespect grant   ΔR_i = (P_i + f_i · w_i) · θ_i
bRespect stock   R_{e+1} = min(120, R_e − max(0.20·R_e , 1) + ΔR_e)

b mint           m_i = min( f_i · w_i · θ_i / 26 , 21/26 )

annual unlock    A(R) = min(40%, R / 300)          × 1{physical attestation in trailing 2 epochs}
per-epoch        v(R) = 1 − (1 − A(R))^(1/13)
unlock           u_e  = min( v(R_e) · L_e , 2 b )
```

| symbol | meaning | value |
|---|---|---|
| `f` | Fibonacci rank weight (p.22) | 2, 3, 5, 8, 13, 21 |
| `w` | presence weight (BNR ruled) | 1.0 co-located, 1/3 remote |
| `θ` | duration factor (§2.4) | min(1, T/75 min) |
| `P` | flat presence credit — **BNR addition, no Fractally analogue** | 3 co-located, 1 remote, 0 absent |
| `L` | `reserve` (locked b) | |
| 13 | epochs per year | 28-day epoch |

### 4.2 The 10/20/30/40% ladder is one line, not four brackets

`A = 40% × (R/120)`. The four labelled tiers are quartiles of a single linear function:

| Tier | R | Annual unlock cap A | Per-epoch v |
|---|---|---|---|
| gated | any, no recent physical attestation | **0%** | 0% |
| T1 | 30 | **10%** | 0.8072% |
| T2 | 60 | **20%** | 1.7019% |
| T3 | 90 | **30%** | 2.7063% |
| T4 | 120 | **40%** | 3.8533% |

Check: (1 − 0.038533)¹³ = 0.6000 ✓; (1 − 0.017019)¹³ = 0.8000 ✓.

**Continuous, not stepped — this matters.** A step function creates boundary arbitrage: a member at R = 59 has enormous marginal value from one rank bump and will collude at the boundary. Linear interpolation makes the marginal value of one bRespect constant at 1/300 of annual velocity everywhere. Fractally uses no step function anywhere in its reward design; do not introduce one. On-chain: a 121-entry fixed-point lookup table indexed by `floor(R)`. No runtime exponentiation; max discretisation jump 0.0032%/epoch.

**A is a fraction of the current `reserve`, not of the 420 cap.** Rule this explicitly in the contract comment so nobody re-litigates it — 40% of 420 would be 168 b/yr, 16× the maximum annual *earn* rate, i.e. not a constraint at all.

### 4.3 Why the R cap of 120 is endogenous — and why a bRespect whale cannot exist

Steady state of a geometric stock is `R* = ΔR / 0.20 = 5·ΔR`. The largest sustainable grant is one co-located top seat at full duration: `P + f = 3 + 21 = 24`. Therefore `R_max = 5 × 24 = 120`. **The hard cap merely enforces what the dynamics already do.** No tenure, wealth, or social reach can push a root above 120. Governance standing is bounded above by construction.

**Why the flat presence credit P = 3 exists.** Without it, a perfectly-attending bottom-ranked member sits at R* = 10, A = 3.3% — indistinguishable from having quit. That is wrong: the brief is a *presence* ratchet, and showing up must beat not showing up even when your circle ranks you last. With P = 3, the bottom-ranked perfect attendee reaches R* = 25, A = 8.33%. It also compresses the velocity spread from 10.5× (raw Fibonacci) to **4.8×** (120/25), which is correct — rank already sets the *amount* via the mint ladder, and letting it set velocity at the same spread double-counts rank.

### 4.4 Steady states by rank (co-located, every epoch, θ = 1)

| rank | f | ΔR | R* | A | v/epoch | b/epoch | **b/yr** | reserve L* | **yr to 420** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 5 | 25 | 8.33% | 0.667% | 0.0769 | 1.00 | 11.45 | 420 |
| 2 | 3 | 6 | 30 | 10.00% | 0.807% | 0.1154 | 1.50 | 14.18 | 280 |
| 3 | 5 | 8 | 40 | 13.33% | 1.095% | 0.1923 | 2.50 | 17.37 | 168 |
| 4 | 8 | 11 | 55 | 18.33% | 1.546% | 0.3077 | 4.00 | 19.60 | 105 |
| 5 | 13 | 16 | 80 | 26.67% | 2.358% | 0.5000 | 6.50 | 20.71 | 64.6 |
| 6 | 21 | 24 | 120 | 40.00% | 3.853% | 0.8077 | **10.50** | 20.15 | **40.0** |
| **mean (3.5)** | 8.667 | 11.67 | 58.3 | 19.44% | 1.650% | 0.3333 | **4.333** | 19.87 | **96.9** |

Two emergent properties worth naming.

1. **`L*` is nearly flat across ranks (11.5–20.7 b).** Everyone posts a bond of roughly the same size regardless of rank, because slow unlockers accumulate exactly as fast as fast unlockers drain. Slashing is uniformly meaningful without any explicit bonding requirement. This is the p.17 escrow-as-bond property, obtained for free.
2. **The 420 cap is a tail bound, not an operating constraint.** It binds at 40 years only for a root that ranks top of its circle every single epoch for a career. The mean root would need 97 years.

### 4.5 Worked trajectories — 1, 5, 20 years

**Median participant** — mean rank 3.5, co-located, full duration, every epoch. Mints 4.333 b/yr.

| | R | A | reserve (locked) | **spendable, cumulative** | minted | % of mint realised |
|---|---|---|---|---|---|---|
| **yr 1** | 55.1 | 18.4% | 3.95 | **0.39** | 4.33 | 8.9% |
| yr 3 | 58.3 | 19.4% | 9.55 | 3.45 | 13.00 | 26.5% |
| **yr 5** | 58.3 | 19.4% | 13.18 | **8.49** | 21.67 | 39.2% |
| yr 10 | 58.3 | 19.4% | 17.60 | 25.73 | 43.33 | 59.4% |
| **yr 20** | 58.3 | 19.4% | 19.61 | **67.05** | 86.67 | 77.4% |
| yr 40 | 58.3 | 19.4% | 19.87 | 153.46 | 173.33 | 88.5% |

**Top-decile participant** — consistently ranks 5–6 (f = 17), co-located, every epoch. Mints 8.50 b/yr.

| | R | A | reserve | **spendable, cumulative** | minted | % realised |
|---|---|---|---|---|---|---|
| **yr 1** | 94.5 | 31.5% | 7.17 | **1.33** | 8.50 | 15.7% |
| yr 3 | 100.0 | 33.3% | 14.69 | 10.81 | 25.50 | 42.4% |
| **yr 5** | 100.0 | 33.3% | 18.00 | **24.50** | 42.50 | 57.7% |
| yr 10 | 100.0 | 33.3% | 20.29 | 64.71 | 85.00 | 76.1% |
| **yr 20** | 100.0 | 33.3% | 20.63 | **149.37** | 170.00 | 87.9% |
| yr 40 | 100.0 | 33.3% | 20.64 | 319.36 | 340.00 | 93.9% |

**The anchor case** — rank 6 every epoch, the 420 calibration: yr 5 spendable 33.84 of 52.50 minted; yr 20, 189.85 of 210.00; yr 40, **399.85 of 420.00 minted, cap reached, 20.15 b permanently in reserve.**

**Partial attendance** — median rank, 9 of 13 epochs, with a contiguous 4-epoch gap: yr 5 spendable **3.61** vs the full attender's 8.49; yr 20 **36.19** vs 67.05. A 31% cut in attendance costs 31% of mint *and* drops average velocity, for a combined **46% cut in realised liquidity at year 20.** The coupling is superlinear in presence. That is the design intent.

**Remote-only** (w = 1/3, P = 1, and — critically — the trailing-2-epoch physical gate): R* = 19.4, mint 1.44 b/yr, and **A = 0 whenever the last physical attestation is older than 2 epochs.** A root that never attends physically unlocks nothing, ever. See §4.7.

### 4.6 What the coupling actually governs — state this honestly

At steady state, unlock converges to mint rate for **any** v > 0. So `A(R)` does not change lifetime income. It governs four things, all of which matter more:

1. **Time to liquidity.** At year 5 the top-decile root has realised 57.7% of its mint; the median 39.2%; a 9-of-13 attender 24.0%.
2. **Bond size.** `L* = m(1−v)/v`. Every active root carries 11–21 b of slashable reserve at all times.
3. **The exit penalty.** See §4.7 — this is where the teeth are.
4. **It does *not* create a fungibility arbitrage — but only because of the mint-only invariant.** Locked b unlocking at v, discounted at 10%/yr, is worth v/(v+r) of face: 59.7¢ for a rank-3 root, 83.9¢ for a rank-6. That 1.4× spread between two roots holding the identical asset is harmless **only if `reserve` cannot receive a deposit.** If it can, a market forms instantly to move locked b to fast roots and `minted_to_date` stops being the 420 counter. §1.2's invariant is not optional.

### 4.7 The dormancy floor: **ruled to zero.** Two prior BNR drafts disagree; this settles it.

`A = 0` with no physical attestation in the trailing 2 epochs. No floor, no residual drip.

Exit penalty, worked — a rank-6 root for 10 years who then stops:

| | R | A | reserve | spendable |
|---|---|---|---|---|
| yr 10 (last epoch attended) | 120.0 | 40.0% | 20.04 | 84.96 |
| yr 20 | 0 | **0%** | **20.04** | **84.96** |
| yr 40 | 0 | **0%** | **20.04** | **84.96** |

Against the rejected 3.2%-floor variant, which pays out 90.53 by yr 20 and 97.45 by yr 40 — **+12.5 b for zero attendance**, and releases 72.9% of the reserve over 40 years to a root that by definition will never return. At 10⁹ roots with 30% churn and L* ≈ 20 b that is **6 × 10⁹ b of dormant overhang, roughly 1.4 years of total network emission, held by people who will never re-engage** and who will sell into a bid-less market.

**Additional rule, adapting p.37 (recruitment rewards earned the week after a missed meeting are burned) and p.38 (12 weeks inactive = automatic resignation):** after **3 consecutive epochs (84 days)** with no physical attestation — matching p.38 by days, not by periods — burn **5% of the dormant reserve per epoch**. This is the one deflationary sink that needs no external demand, and it retires the overhang instead of dripping it out.

### 4.8 The remote seat — ruled with a recency gate

Remote attendance (max one seat per circle, w = 1/3, P = 1):
- **accrues** bRespect at 1/3 weight;
- **preserves** but never increments any physical streak;
- **does not unlock anything** — `A = 0` if the last physical attestation is older than 2 epochs.

Without the gate, a remote seat that ranks top of its circle earns 3.50 b/yr against the median's 4.33 — 81% of median for 46% of the time cost, which is the wrong gradient and reopens exactly the video-grade attack surface physical co-location was adopted to close (§5.4). With the gate, remote becomes an illness/travel shock absorber and never a standalone earning path. **This is additive to the ruled parameter, not a redesign of it.**

### 4.9 The backstops

- **Per root:** `u ≤ 2 b` per epoch — one full circle's entire epoch mint. Under organic accrual it never binds (max observed v·L = 0.0385 × 20.15 = 0.78 b). It exists solely for treasury-t0 maturation and for any residual `ProofVerifier` exploit. Framing: *no single root can unlock faster than six people can earn.*
- **Per venue (mandatory — the per-root cap is not a cap when the adversary scales roots):** **Σ unlock over a venue-epoch ≤ Σ mint over that venue-epoch.** No venue may be a net importer of reserve. This is the invariant that makes the framing above actually true.

---

## 5. The sustainability inequality

The founder's ask: *"find the sustainable balance of time/energy/value … and b reward."* This section solves it with numbers and states plainly where it does not close.

### 5.1 Time and energy per root per epoch

With the enforced 75-minute attested duration (§2.4):

| item | time | energy (walk / transit / car) |
|---|---|---|
| check-in, seating, attestation | 10 min | — |
| attested session (6 × ~8 min presentations + ~27 min consensus) | 75 min | — |
| wrap, peer review | 5 min | — |
| venue share (1.5 kW room ÷ 6, 1.5 h) | — | 0.375 kWh |
| devices | — | 0.01 kWh |
| VRF, beacon, ~15 attestation nonces, ~14 Vaulta tx | — | ~5 × 10⁻⁵ kWh (negligible — five orders below the room lights) |
| travel, round trip | 30 / 50 / 90 min | 0.00 / 0.25 / 7.0 kWh |

At a 60/30/10 modal mix: **132 min and 1.16 kWh per epoch → 28.6 hours and 15.1 kWh per user-year.**

Note the divergence from Fractally: 8-minute presentation slots, not 5 (p.20). Fractally gives 5 minutes for 7 days of work and consumes the full hour with zero slack (6 × 5 + 25–30 = 55–60 min against a 1-hour bound, p.21). BNR presents 28 days of work — a 4× compression at 5 minutes. 6 × 8 + 27 = 75 min.

Annual burden comparison — only one cell of the 2×2 is habitable:

| | weekly | 28-day |
|---|---|---|
| **video** | Fractally: 65–73 h/yr | 16–18 h/yr — too little signal |
| **physical** | 148–174 h/yr — infeasible | **BNR: 28.6 h/yr** |

**The 28-day epoch buys back the hours physical co-location costs, and lands ~60% below Fractally's annual burden despite being physical.** That is the direct numeric answer to "sustainable balance of time."

**Energy policy is venue siting, and nothing else.** Car trips are 67% of network energy at a 10% modal share. Mandating VRF venue selection inside a 2-km cell of the density-weighted shard centroid shifts the mix to ~80/18/2 and cuts energy from **15.1 to 7.4 kWh/user-yr** (7.4 TWh/yr at 10⁹ roots, ~5% of Bitcoin). Fractally's video meeting costs ~2.4 kWh/user-yr; BNR costs 3× that and buys d from ~10⁻² to 9 × 10⁻⁸ — **about 1 kWh/user-yr per decade of uniqueness.**

### 5.2 Cost per verified-unique root

| | |
|---|---|
| Verification (biometric enrolment, measured at 1M volume) | $35 one-time |
| Vaulta account | ~$2 one-time |
| Time, per epoch (2.20 h × $2.00/h global median wage) | $4.40 |
| Energy, per epoch (1.16 kWh × $0.12) | $0.14 |
| One-time costs amortised (10 yr = 130 epochs) | $0.28 |
| **C_honest per epoch** | **$4.82** |
| **C_honest per year** | **$62.71** |

**Time is 91% of it.** Every minute cut from the epoch is worth more than every other lever combined — which is exactly why T0 is the most consequential parameter in the spec and why it is in §8.

The deliberate non-subsidy is a correct rate limiter: bulk enrolment costs $35 × N with zero recovery, and anyone who will not recover $35 will not enrol.

### 5.3 Value of network uniqueness confidence

Relying parties have threshold behaviour, not linear utility. Modelling gross annual value per root as `v(d) = v_sat / (1 + (d/d*)^0.5)`, `v_sat = $120`, `d* = 10⁻⁴`:

| duplicate rate d | uniqueness | v(d)/root/yr | usable for |
|---|---|---|---|
| 10⁻¹ | 90% | $3.70 | ad targeting |
| 10⁻² | 99% | $10.90 | consumer dedup, airdrops |
| 10⁻⁴ | 99.99% | $60.00 | regulated fintech onboarding |
| **10⁻⁷** | **99.99999%** | **$116.32** | **unsecured disbursement, national franchise** |
| 10⁻¹⁰ | — | $119.90 | (nothing new) |

**Marginal value saturates immediately past the regulatory threshold.** 10⁻² → 10⁻⁷ multiplies value per user **10.7×**. 10⁻⁷ → 10⁻¹⁰ adds **3.1%**. The founder's relaxation from 10⁻¹⁰ to 10⁻⁷ gives up 3.1% of asset value. **Correct call, and it is defensible with a number.**

### 5.4 Is 10⁻⁷ reachable? Decompose it. `d = d_bio × d_econ`

- **d_bio** — a duplicate enrolment survives biometric dedup against a 10¹⁰ gallery (2-iris + 10-print + face fusion + adjudication): **~3 × 10⁻⁵**, Aadhaar-class. Biometrics alone **cannot** reach 10⁻⁷ at that gallery size; false-negative-identification floors around 10⁻⁴–10⁻⁵ regardless of budget.
- **d_econ** — a surviving duplicate sustains bRespect: governed by whether farming pays. With farming negative (§5.5), the rational farmer population is zero; the residual is non-economic actors at reduced velocity. **~3 × 10⁻³**.

**d = 3 × 10⁻⁵ × 3 × 10⁻³ = 9 × 10⁻⁸ < 10⁻⁷ ✓** (~10% margin.)

**Sensitivity is the binding fact.** At the *old* 10⁻¹⁰ target you would need d_econ ≈ 10⁻⁵–10⁻⁶ — an economic filter running 100,000× negative margin, which no market delivers. **10⁻⁷ is precisely the target at which fielded biometrics and an economic filter compose.** That is the re-derivation the founder asked for.

At 10¹⁰ users, 10⁻⁷ = **1,000 duplicate roots network-wide**. A national franchise at 10⁸ voters expects **10** duplicate ballots — three orders below any real election margin.

This also validates the ruled Sybil doctrine: uniqueness is measured over **bRespect-weighted roots**, not registered roots. A duplicate that never attends earns zero bRespect and is not in the denominator.

### 5.5 The inequality, and the honest result

Two constraints must hold at once:

```
(P)  E · P_b  ≥  κ · C_honest_yr       participation: honest attendance pays
(F)  E · P_b  <  C_farm_yr             anti-farming: buying seats does not pay
```

where `E` = 4.333 b/root/yr (median emission), `κ` = the multiple of opportunity cost the design targets.

**First result — the ladder cancels out of (P).** Market-clearing price is `P_clear = v_uniq · φ / E`, where φ is the fraction of gross uniqueness value the network captures in cash. Required price is `P_req = κ · C_honest_yr / E`. E appears in both:

```
P_clear ≥ P_req  ⟺  v_uniq · φ  ≥  κ · C_honest_yr  ⟺  φ ≥ 53.9% · κ
```

**Retuning the mint scalar, the Fibonacci scaling, or the 420 cap moves the participation constraint by exactly zero basis points.** There is one free variable and it is φ. Fractally never needs φ because it pays participants by printing (p.15). **BNR ruled out printing (the cap) and ruled out subsidy ("users pay"). Those are the same decision, and together they make φ the only free variable in the system.**

**Second result — the dominant attack is not duplicates.** It is a wage farm: one operator, N *genuine, biometrically unique, low-wage* humans, minimal minutes. Every stated defence passes — simultaneity satisfied, presence ratchet at full weight, d = 0, biometrics inert, Sybil doctrine inert. Any claim that "farming is unprofitable at any price of b" covers **duplicate**-farming only; the wage farm fields no duplicates and forgoes nothing. **Narrow that claim in writing before it ships.**

Farm economics, 216 roots in one compound, 36 circles, 936 b/yr:

| configuration | farm $/root/yr | farm $/b | vs honest break-even $14.47/b |
|---|---|---|---|
| **no duration attestation, operator packs its own circles** | — | **~$4.53** | **0.31× — farming is 3× cheaper than honesty. Fatal.** |
| **T0 = 75 min enforced, operator still packs circles** | $61.63 | $14.22 | **0.98× — still cheaper. Not sufficient.** |
| **+ VRF venue assignment across the shard** | $83.42 | $19.25 | **1.33×** |
| + expected slash (p_detect = 5%, bond 19.87 b) | $97.80 | $22.57 | **1.56×** |

**Duration attestation alone does not close it. VRF venue assignment is the load-bearing fix.** If the beacon assigns the venue and circles are drawn across the whole shard, the farm's roots incur the same travel as everyone else and cannot pack their own circles. The probability a farm controlling fraction p of a shard owns all 6 seats of a circle is p⁵:

| p | 0.25 | 0.50 | 0.65 | 0.80 | 0.90 |
|---|---|---|---|---|---|
| P(owns all 6) | 0.001 | 0.031 | 0.116 | 0.328 | 0.591 |
| P(owns ≥4, can dictate) | 0.104 | 0.500 | 0.765 | 0.942 | 0.991 |

Both mechanisms are required: **VRF venue + shard-wide circle draw** is the primary bar; **T0 duration attestation** is the backstop for the case where a farm does achieve local shard dominance.

### 5.6 The b reward band — the founder's balance, as an interval

**$14.47 ≤ P_b < $22.57 per b.**

- Below $14.47, honest median participation does not cover $62.71/yr of time and energy at a $2.00/hr shadow wage.
- Above $22.57, a wage-farm operator with VRF-imposed travel, operator overhead, and a 5% expected slash turns a profit — and the harm is not inflation (the farm mints exactly what genuine roots would) but **capture**: bRespect stops measuring contribution, and whoever pays the wages accumulates governance standing at scale.

**The window is 1.56× wide, and that width *is* the design's entire safety margin.** It is set by three things and nothing else: travel imposed by VRF venue assignment, operator overhead, and expected slash. Widening the band means widening those three. Publish the width as a monitored metric.

Restated price-independently: `ρ = C_farm / C_honest = 1.33` before slashing, and a wage farm's yield ratio is `γ = 1` by construction. Feasibility requires `γ < ρ/κ`, so **the design tolerates κ up to 1.33** before the double-failure region opens.

### 5.7 Where this does not close — say it plainly

φ must reach **53.9% at κ = 1**. That means relying parties paying ~$63/root/yr in cash for the uniqueness assertion, against a modelled gross value of $116. Plausible query economics fall well short:

| query volume × price | revenue/root/yr | implied φ |
|---|---|---|
| 12/yr × $1.00 | $12.00 | 10.3% |
| 52/yr × $0.25 | $13.00 | 11.2% |
| 4/yr × $3.00 | $12.00 | 10.3% |
| **12/yr × $5.25** | **$63.00** | **54.2% ✓** |

At φ ≈ 10%, b pays **$0.21 per hour of committed time** against a $2.00/hr shadow wage — 9.3× short, an implied κ of 0.185, and a deficit of ~$51/root/yr.

**Three honest readings, and the founder must pick:**

1. **Sell into regulated onboarding at ~$5/query, not consumer dedup at $0.25.** This is the only reading in which the design closes at κ = 1. It is also consistent with §5.3: the 10⁻⁷ assertion is worth $116 *precisely because* it clears regulated thresholds, and pricing it at $0.25 gives away the thing that was expensive to build.
2. **Accept κ < 1 and say so.** Roughly 10⁹ humans already give 2–4 hours/month to unpaid group meetings; BNR asks 2.2 hours/month, inside the observed free-participation envelope. If ~$1.63/hr of the value is civic rather than monetary, the design closes at φ ≈ 10%. **This is defensible but it must be stated in the spec, not assumed silently.** A design that requires unpriced volunteer surplus should say so.
3. **Cut T0.** Every minute removed is worth more than every other lever (91% of cost is time). But T0 is also the anti-farming backstop, and cutting it moves the band's lower bound down and its upper bound down *faster*. This is the sharpest tension in the whole design: **the fix that closes the anti-farming constraint tightens the participation constraint.** Do not cut T0 without re-running §5.5.

**The mechanism that sets φ — retarget Fractally's post-fee controller (p.30–31).** Meter the uniqueness assertion **per query**, priced in b, **100% burned**. Keep the paper's difficulty controller exactly (±5% adjustment, re-evaluated every 6 events or every hour) and change only the setpoint: instead of posts/hour, target **burn ÷ emission ≥ 1.0**, adjusted ±5% per epoch. If relying parties will not pay at that price, volume falls and the network discovers its true φ early — while the cohort that can still repair the design is present. Note that BNR retains exactly **one** of Fractally's four demand sinks (§3.1, §3.5 reject the other three), and a post fee alone sinks ~6 × 10⁻⁵ of emission flow — five orders short. **The query burn is not an enhancement; it is the only sink that can exist.**

---

## 6. Respect decay — ruled

### 6.1 The rule

```
R_{e+1} = min(120, R_e − max(0.20 · R_e , 1) + ΔR_e)
```

**20% per 28-day epoch**, specified in the contract as **0.79381% per day** so a future cadence change cannot silently retune it. The "or 1 unit, whichever is greater" floor is imported verbatim from p.30.

### 6.2 Half-life: 87.0 days (3.11 epochs)

Fractally's 5%/week gives 94.9 days. BNR is 8% tighter in wall-clock, deliberately: the 28-day cadence supplies 4× fewer samples, so the estimator should weight recency slightly more to compensate for the coarser sampling.

### 6.3 Why this half-life and not another

Both failure modes the question names are real, and 87 days sits between them:

- **No decay → permanent founder aristocracy.** Standing would be a pure integral of tenure. A year-1 cohort attending every epoch would hold unbounded R, and every governance seat, forever. Fractally recognised this and decayed vote weight (p.30) even though it never decays issued Respect.
- **Too fast → nobody builds standing.** At a half-life below ~1 epoch, a single missed meeting for illness or travel would erase a decade. Nobody would rely on the instrument and it would stop being a ratchet.

At 87 days:
- one missed epoch costs 20% of standing — noticeable, survivable;
- **stop attending and half your velocity is gone in 3.9 epochs (~3.6 months); 90% is gone in about a year;**
- the "or 1 unit" floor drives an absentee to exactly zero in finite time — no dust, no asymptote, no zombie standing;
- steady state is reached in ~15 epochs (~14 months), so a newcomer attains full standing in a bit over a year of unbroken attendance. That is long enough to be meaningful and short enough to be reachable.

### 6.4 Governance standing

Council seats and any bRespect-weighted vote use a **12-epoch EWMA of R**, not the instantaneous value. Rationale from §2.5: standard error scales 1/√n, so matching Fractally's 12-sample estimator quality requires 12 epochs (336 days), not the naïve "12 weeks ≈ 3 epochs." **One window, not two** — Fractally's split between 12 weeks (p.30) and 20 weeks (p.35, p.39) is unjustified in the source.

Council = **top 12 by 12-epoch bRespect EWMA, lineage-disjoint**, 8-of-12 to act, adapting p.39. Not team leaders — §3.4. Retain p.39's 24-hour invalidation window and p.40's veto, but keep the veto delay at **21 days absolute**; never key a veto window to the beacon.

### 6.5 Dormancy and eviction — recompute, do not port

p.24 sets automatic removal at failing consensus 5 of 10 consecutive weeks, then in the same paragraph says 67% over a 20-week average is required. **These are inconsistent** — 5-of-10 implies a 50% floor. Flag before copying.

False-eviction rate for an honest root with a 10% per-event failure probability:

| rule | window | P(false eviction) |
|---|---|---|
| Fractally 5-of-10 weeks | 70 d | 0.164% |
| naïve port, 3-of-6 epochs | 168 d | 1.59% — 10× worse |
| **BNR: 4-of-8 epochs** | 224 d | **0.502%** |

**Rule: consensus-failure eviction at 4-of-8 epochs.** Dormancy resignation at **3 epochs (84 days)** without physical attestation, matching p.38's 12 weeks by days. Rejoining requires a new invite and the original inviter loses their claim (p.38) — adopt, though note BNR has no recruitment commission for them to lose (§3.3), so this reduces to an anti-recycling rule.

---

## 7. Dilution and the late joiner

### 7.1 In units, the late joiner is not diluted at all

Mean rank in a circle of six is 3.5 **always**, independent of network size, because circles are VRF-assigned and fixed at 5–6. So mean emission is 4.333 b/root/yr in year 1 and in year 25. The per-root cap genuinely gives late roots full headroom while early roots exhaust theirs.

This is the exact inverse of Fractally, where a round-1 contributor's relative share falls ~1.8× for every round added and asymptotes at 0.030× per-capita once five rounds run — a year of perfect rank-3 attendance in a mature 7,776-member fractal buys about **one part in 4.5 million** of supply. BNR's per-root cap removes the global denominator entirely. **That defence is true, and it is not the whole story.**

### 7.2 In price, the late joiner faces a real gradient — and it is structural, not adversarial

Everyone sells roughly as fast as b unlocks — correct behaviour for a $2.00/hr participant earning for income, not exposure. Unlock lags mint by **τ = 1/A**: 5.14 years for a median root, 3.00 for top-decile. With N growing at g, circulating supply is `S = E·N/(1 + gτ)`, so:

```
P(t) = v_uniq · φ · (1 + g·τ) / E
```

| growth g | price premium over mature value |
|---|---|
| 0% (mature) | 1.00× |
| 22% | 2.13× |
| 50% | 3.57× |
| 100% | 6.14× |

**The early cohort's advantage is not more units. It is that they sell into a growth premium that expires — and its expiry date is the network's own stated target.** At 10¹⁰ roots the human population is exhausted, g must be 0, and the premium is definitionally 1.00×. That is a structural drawdown with no bad actor required.

### 7.3 So is it worth a year-10 joiner's time?

Run it honestly. A year-10 joiner faces the mature price `P = v_uniq · φ / E`:

| φ | mature P_b | median income/yr | vs C_honest $62.71 | verdict |
|---|---|---|---|---|
| 10% | $2.68 | $11.63 | **−$51.08/yr** | **No. Not worth it monetarily.** |
| 30% | $8.05 | $34.90 | −$27.81/yr | No |
| **53.9%** | **$14.47** | **$62.71** | **$0.00** | Break-even |
| 80% | $21.47 | $93.05 | +$30.34/yr | Yes |

**So the answer depends on exactly one number, and it is the same number for everybody — φ.** The late joiner is not disadvantaged relative to the year-1 joiner *at the same φ*; they are disadvantaged only in that the year-1 joiner also captured the growth premium on top.

**If φ stalls at 10%, the honest answer is no — for a year-10 joiner and for a year-1 joiner alike**, and the year-1 joiner only appeared to succeed because the growth premium masked the fundamental for τ ≈ 5 years. That is the finding, and it should not be softened.

### 7.4 The fixes

1. **The query burn (§5.6) is the fix.** It is the only mechanism that puts a fundamental floor under P_b independent of growth, and it is what makes the year-10 answer the same as the year-1 answer.
2. **Shorten τ deliberately, so the network discovers its true price early.** τ is a lie-duration parameter: it sets how many years the growth premium masks the fundamental. Do not prop it up. Raising the median A from 19.4% toward 25% (by raising the divisor's slope or the presence credit) cuts τ from 5.14 to 4.0 years and brings the reckoning forward by years — while the cohort that can repair the design is still present.
3. **Publish the (1 + gτ) formula and the perpetual-growth requirement in the spec.** A parameter that requires sustained exponential growth to hold a price must be labelled as such.
4. **What does *not* work as a substitute:** "bRespect decays, and bRespect gates liquidity" does not compensate late joiners. Decay punishes *inactive* early holders. An early adopter who keeps attending sits at R = 120, A = 40%, and keeps their price-history advantage forever. The decay is orthogonal to the dilution gradient. Fractally's 6%/yr inflation (p.15) *was* aimed at exactly this, and BNR has rejected it (§3.7) without a replacement other than the burn.

---

## 8. Open parameters — the numbers only the founder can set

Each with the consequence of setting it high vs. low. Ranked by how much of the design moves.

### 8.1 `T0` — enforced attested meeting duration. **Currently 75 min.**
- **High (90–120 min):** anti-farming margin widens (band upper bound rises); C_honest rises ~$0.50/epoch per 15 min, so φ_req rises ~4 points per 15 min. Participation gets harder.
- **Low (45 min):** C_honest falls to ~$52/yr, φ_req to 45%. But the farm's edge returns — at T0 = 12 min the farm produces b at ~$4.53 against an honest break-even of $14.47 and the design inverts.
- **This is the single most consequential number in the spec.** 91% of cost is time, and time is also the entire anti-farming bar.

### 8.2 `κ` — the shadow wage the design holds itself to. **Currently stated at 1.0 against $2.00/hr.**
- **High (κ = 2, gig-rational):** requires φ = 108% — impossible. The design can never pay above κ = 1.85 even at φ = 100%.
- **Low (κ = 0.185, φ = 10%):** the design closes on plausible query revenue, but it is explicitly asking for ~$51/root/yr of unpriced civic time. Defensible; must be stated.
- **Consequence of not choosing:** every published break-even number silently assumes one or the other. Pick one and label every figure with it.

### 8.3 `φ` target for the burn controller, and the query price. **Currently target burn ÷ emission ≥ 1.0.**
- **High target (φ = 54%):** honest participation is cash-rational for everyone including year-25 joiners. Requires ~$5.25/query at 12 queries/root/yr — regulated-onboarding pricing.
- **Low target (φ = 10%):** query volume is easy to win, participation is subsidised by civic surplus and by the growth premium, and the reckoning arrives when growth stalls.
- **This is the founder's actual business-model decision, wearing a tokenomics costume.**

### 8.4 The velocity divisor — `A = R/300`, ceiling 40%.
- **High ceiling (60%):** τ falls to ~3.4 yr, price discovers itself earlier, bonds shrink (L* ≈ 13 b), slashing weakens.
- **Low ceiling (25%):** bonds grow to ~32 b, slashing bites harder, but τ rises to ~8 yr and the growth premium masks the fundamental for most of a decade.
- Trade: **bond size and honest price-discovery are in direct opposition.**

### 8.5 Mint scalar — `1/26`, i.e. rank-6 = 10.5 b/yr, 420 in 40 years.
- **High (e.g. 1/13):** rank-6 hits the cap in 20 years; the founding cohort's marginal incentive to attend hits zero simultaneously around year 15. Supply impact is negligible; the damage is to the presence ratchet — the most reliable bodies stop filling seats at exactly the venues that seeded the network.
- **Low (1/52):** cap becomes purely decorative and 420 loses its meaning as a lifetime number.
- **Recommendation: keep 1/26.** It is the only setting where the cap is a tail bound rather than a mid-career cliff.

### 8.6 420 as a **stock** cap vs. a **rate** cap.
- **Stock (as ruled):** clean, final, and creates the year-40 exit cliff above.
- **Rate variant:** decay `minted_to_date` by 1/520 of the cap per epoch. A root at cap regains headroom exactly as fast as it earned it, 420 becomes a hard **10.5 b/yr rate limit**, "earn cap not wealth cap" becomes literally true without the residual-bond caveat, and it restores what p.15's 6% inflation was doing for late joiners — present contributions worth more than historic — without reintroducing inflation.
- **Consequence of choosing:** the rate variant changes what `minted_to_date` means and what can be said publicly about "420". It should not be adopted quietly.

### 8.7 Presence credit `P = 3`, and the remote weight `w = 1/3`.
- **P high (5):** velocity spread compresses to 3.4×; rank matters less; a bottom-ranked attender reaches A = 13.3%. More egalitarian, weaker rank signal.
- **P low (1):** spread widens to 7.3×; rank double-counts (it already sets mint).
- **Remote weight high (1/2):** remote becomes attractive as a standalone path even with the recency gate, and every video-grade attack surface partially reopens.
- **The 2-epoch physical recency gate is not a parameter. It is load-bearing. Do not make it adjustable.**

### 8.8 VRF venue radius. **Currently 2 km around the density-weighted shard centroid.**
- **Tight (500 m):** travel and energy drop (φ_req falls ~5 points), but the farm's travel penalty drops with it and the anti-farming band narrows toward 1.0.
- **Wide (10 km):** band widens, but C_honest rises and rural participation becomes impractical.
- This parameter is simultaneously the energy policy and half the anti-farming margin. It cannot be optimised for one without pricing the other.

### 8.9 `p_detect` and the slash fraction.
Expected forfeiture is the third of three terms setting the band's upper bound. At p = 2% the band is 1.42×; at 10%, 1.79×. **The question the founder must answer is what fraction of wage-farm circles the network can realistically identify and slash** — and the honest current answer is unknown, because no comparable system has been fielded.

### 8.10 Epoch length — **28 days, ruled.** Listed for completeness of consequence.
Weekly would fire the simultaneity bar 4× more often and improve every rank estimator by 2× at equal wall-clock, but it makes physical attendance cost 148–174 h/yr (infeasible) and fills the 420 cap in 1.15 years, turning it from a lifetime number into a sprint. **The 28-day epoch is load-bearing for the cap's semantics, not just for user time.** Do not revisit without re-deriving §4.4 and §5.1.

---

## Order of work

The dependencies are strict:

1. **`ProofVerifier` that actually verifies.** Everything below is unenforceable without it, and it is currently a stub accepting any non-empty string.
2. **`reserve` mint-only invariant** (§1.2) — one contract assertion, and without it the coupling manufactures a laundering market.
3. **VRF venue assignment + shard-wide circle draw** (§5.5) — the primary anti-farming bar.
4. **Duration attestation, T0 = 75 min** (§2.4) — the backstop.
5. **Venue-level unlock backstop** (§4.9) — the per-root cap is not a cap against an adversary who scales roots.
6. **Per-epoch mint cap 21/26 b, unconditional** (§3.6) — settles the escalation contradiction in code, not prose.
7. **Query-fee burn controller** (§5.6) — the only thing that sets φ, and φ is the only free variable.

---

## Where the paper is silent, and where I am

- **Fractally has no reputation→currency conversion.** There is nothing to copy. The bRespect→b coupling is new; no prior art, no empirical evidence it is stable. Say so publicly.
- **The 5%/week escrow rate (p.17) has no derivation**, and the sentence that follows it is arithmetically false (64.2%, not 100%, at week 20). BNR must rule; §2.6 rules geometric.
- **The 12-week and 20-week smoothing windows (p.30, p.35, p.39) have no derivation** and disagree with each other in the same document.
- **The 6%/yr inflation target (p.15) has no derivation**, and the paper never reconciles it with the absolute Fibonacci table (p.22) — every worked example treats the ladder as absolute.
- **The round-3 table (p.23) does not close.** Rank labels are copy-pasted from round 2 (body text says ranks 11–16), and the "prior round" baseline silently switches from cumulative to net, overpaying every participant by 21.
- **p.30's rank distribution does not reconcile.** "0.13% have a rank from 18 to 30" against 1/216 = 0.46%; it matches neither round 4 (0.386%) nor round 5 (0.077%).
- **p.19's attendance claim is wrong.** 5 rounds is 6h15m including breaks, for the top 0.077%, not 4–5 hours for the top 1%.
- **Nothing in this document was ever run at scale.** The design is 2022, self-labelled experimental (p.3), with one small cited prototype (Eden, p.25 fn. 6). I have not verified its post-publication deployment history and no number in it should be treated as measured.
- **BNR's own untested numbers:** `v_sat = $120/root/yr` and `d* = 10⁻⁴` in §5.3 are a modelling assumption, not a market observation — if relying parties pay half that, the design is infeasible at any φ. `d_bio ≈ 3 × 10⁻⁵` is extrapolated from Aadhaar-class published performance, not measured at a 10¹⁰ gallery. `p_detect` is unknown. The $2.00/hr global median wage is a proxy. **Each of these is a place where the spec could be wrong by a factor that matters.**
