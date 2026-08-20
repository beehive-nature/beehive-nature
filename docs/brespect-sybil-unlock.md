# bRespect sybil resistance & b-unlock — ruling

<!-- 9 agents: 3 crate-ground passes, 3 independent designs, 2 adversarial
     attacks (funded sybil farmer + privacy auditor), 1 synthesis. 2026-08-04.
     NOTE: the founder subsequently ruled that full multipersona unlinkability
     is NOT a requirement — 'privacy is a rail choice, use Zano'. That ruling
     relaxes §1's trade in BNR's favour; the undecidability finding stands. -->

# bRespect Sybil Resistance & b-Unlock — Ruling

**Seat 3 · 2026-08-04 · synthesis of three designs + two adversarial passes**

---

## 1. The honest answer to the conflict

**No. You cannot have multipersona unlinkability and punish duplicate bzDiDs, and the part you must give up is *root-level* unlinkability — but only for users who choose to climb the ladder.** What you keep, fully and untouched, is the thing RELAY_22 §2a actually protects: personas remain plural, free, `Selective` by default, and carry no balance, no mint path, no PoUL signal; nothing in this mechanism reads a `PersonaBinding` or a `PersonaRef`, ever.

Stated precisely, because the framing in the task brief mis-cites §2a and all three designs inherited the error:

> §2a (`C:\Users\travi\beehive-nature\crates\onboarding\src\lib.rs:23-25`) is a **layering rule, not a privacy guarantee.** It says economics lives at the root. It is therefore *satisfied* — not merely tolerated — by a mechanism that correlates roots to roots. §2a has nothing to say about root↔root correlation. That silence is the whole space this design lives in.

The founder's trigger, however, does not survive. **"When a multiple bzDiD is attempted" is not hard, it is undecidable.** A bzDiD is the 256-bit digest of a genesis op; minting one is a hash; there is no issuer and no registry to consult. Detecting an *attempt* requires linking two self-certifying digests to one human, and there is no observable an attempt emits. All three designs reached this independently. It must be amended in writing, not implemented.

**Amendment, in the words that should go into the ratification:**

> A multiple bzDiD cannot be detected and this system does not attempt to detect one. It does not prevent multiple bzDiDs — it makes only one of them economically alive. An unvouched root sits at rung 0 forever: a 42 b lifetime ceiling, a 10% annual cap, no self-borrow. Ten thousand of them are free, instantaneous and undetectable, and they are worth 420,000 b of *proven resource contribution* — which is a labour-market problem, not an identity problem.

**The exact trade, with no hedging:**

| Kept | Given up |
|---|---|
| Persona unlinkability — total, unchanged | Root↔root unlinkability, **for climbers only** |
| Root unlinkability at rung 0 — total, free, permanent | Your vouchers know you are a human they met |
| Free tier writes nothing to any chain | The unlock engine holds a root-level vouch graph |
| `DisclosureMode` untouched; `Public` still explicit and irreversible | The founder's literal trigger — deleted |

The residual, named because it is the one thing no design in the set disclosed: **the vouch graph is a real root-level social graph and somebody runs the computation over it.** It is not zero-knowledge. It is not public — see §5 — but it exists. That is the honest floor, and it should be stated in the consent text in the idiom already used at `onboarding:98-100`.

---

## 2. The mechanism

A hybrid. Each part is taken from where it was strongest and each import is justified against the adversarial findings.

| Part | From | Why |
|---|---|---|
| Rung-gated **lifetime** ceiling | stake-and-vouch §2.1 | The only idea in the set that makes N sybils cost superlinearly. An annual *flow* cap is sybil-neutral: 420 is per-root and N roots = 420N. |
| Vouch graph with independence discount | stake-and-vouch §2.2 | The only sybil oracle that exists is a human who recognises a human. |
| **Velocity as a multiplier on the cap**, not an independent b source | corrected from all three | Kills the 4-of-6 seat-capture attack outright (§6). |
| One-root-naming accusation | stake-and-vouch §1 | Extracts the one bit the penalty needs; the pair is unrepresentable. |
| Four-part signal admissibility test | self-revealed §1 | Ratified verbatim as standing law for what may ever become a duplication signal. |
| T3 refusal (transcript-digest matching) | cost-based §3a | Named, and defaulted **off permanently**, not off-by-config. |
| Recovery-by-assignment on lien default | **new** — see §4 | Fixes the single largest adversarial finding. |

### Rejected outright

- **cost-based's liveness model.** It maps `EvidenceClass` → co-presence weight. `capability/src/lib.rs:113-119` says in terms that this is the wrong axis: a class says how well the key is *held*, not whether a human was *present*. A rack of attested Pixels scores liveness 1.0 with nobody in the room.
- **self-revealed's global-salt device commitment.** `PROOF_OF_UNIQUE_LIFE_design_note.md:20-25` rules device identity as `H(device_id ‖ DID-secret)` and names the non-per-DID variant "a deanonymization supercookie." Replacing the DID-secret with a `SYSTEM_SALT` to make it cross-root comparable reinstates the named defect. It also does not work: attestation chains to batch/platform roots, so one value covers an entire device generation.
- **`BioPresence::Present` as a gate.** Today it is a bare enum with no signer, no human binding, no anti-replay. Cost to forge: $0. Either it gains a signer or it leaves the gate.
- **cost-based's T2** (`novelty < 0.2` → penalty). It is a threshold on a clustering measure — inadmissible under the very test cost-based's sibling design proposes. Novelty survives as a *credit discount*; it never fires a penalty.

### State and types

**New crate `crates/b-vouch`** — the identity layer.

```rust
pub struct VouchAttestation {
    voucher: Did, vouchee: Did, session: SessionId,
    at: i64, class: IndependenceClass, sig: Signature,
}
pub struct VouchBook {
    edges: BTreeMap<VouchId, VouchAttestation>,  // NOT public; see §5
    bond:  BTreeMap<VouchId, LienId>,            // treasury-t0 lien
    slots_used: BTreeMap<(Did, u32), u8>,        // per voucher, per year
}
/// Unforgeable. Private fields, one constructor, NO Deserialize —
/// the SettlementAuthorization shape (treasury-t0:104-140).
pub struct RungAuthorization { rung: Rung, weight_milli: u64 }
impl RungAuthorization { pub fn from_vouches(&VouchBook, &BLedger, &Did, i64) -> Result<Self, VouchRefusal>; }
```

**New crate `crates/b-unlock`** — the velocity layer.

```rust
pub struct SessionBook { counted: BTreeMap<Did, Vec<CountedSession>> }  // trailing 365d
pub fn velocity_milli(&SessionBook, &MasteryLedger, &RespectBook, &Did, i64) -> u32; // 0..=1000
```

**`crates/b-token` — extended, and this is where enforcement lives.**

```rust
pub const ATOMIC_PER_B: Amount = 1_000_000;
pub const LIFETIME_CEILING_B: [Amount; 4] = [42, 105, 252, 420];   // × ATOMIC_PER_B
pub const CAP_PCT:            [u32;    4] = [10,  20,  30,  40];
pub const TERMINATION_FLOOR_DIV: u32 = 10;

// new fields on BLedger, all #[serde(default)]:
rung:            BTreeMap<Did, Rung>,
unlocked_in_year:BTreeMap<(Did, u32), Amount>,
penalty:         BTreeMap<Did, PenaltyRecord>,

// setters gated by unforgeable tokens, never by a params struct:
pub fn set_rung(&mut self, who: &Did, auth: &RungAuthorization);
pub fn convict(&mut self, who: &Did, auth: &SettlementAuthorization, at: i64);
```

**Why enforcement goes inside `BLedger::mint` and nowhere else.** It is the only choke point every `b` passes through, `minted_to_date` and `first_minted_at` are already there and already monotonic (`b-token:120-128`), and every other placement recreates the circular deferral the inventory documented — four crates each believing another enforces 420, and none doing so.

**Why the ladder constants are `pub const` in `b-token` and the rung lives on the ledger.** This is the direct fix to the defect all three designs independently found and none fixed at the root: `LienBook::lock` takes `maturation: &MaturationParams` from the caller (`treasury-t0:346-353`), and test `:809-827` *proves* a caller can hand in `{100, 0, 100}` and the entire ladder evaporates, leaving only the 80% floor. RELAY_16 closed exactly this for `reserved`, `minted_to_date` and `thread_age` — "one defect wearing three hats; all three derived, none accepted" (`treasury-t0:40-55`). **Params are the fourth hat and it is still on.** A penalty a caller supplies is a penalty of zero. Fix it in `treasury-t0` *before* the unlock engine is written, or the new crate copies the defect.

---

## 3. The unlock ladder

### 3.1 Cap and velocity are different objects

- **CAP** is a ceiling on b per year. It is bought with *other people's verified recognition* — vouches — which do not parallelise.
- **VELOCITY** is the fraction of that ceiling you actually reach. It is bought with *your own attendance and comprehension* — the founder's two named inputs.

`unlocked ≤ cap × velocity`. An attacker must beat both, and they cost different currencies.

### 3.2 What indexes the rungs

Not time. Not grade. Not Respect. Time is actively wrong — N sybils age simultaneously at zero marginal cost. The rung is a **conjunction**, every conjunct derived from ledger state, none passed:

| Rung | Gate (all required) | Cap % | Lifetime ceiling |
|---|---|---|---|
| R0 | `Enrolment::complete`, `Tier ≥ T2`, ≥1 `Outcome::Passed` | 10 | 42 b |
| R1 | + vouch weight ≥ 2.0 from ≥3 vouchers, dwell ≥ 180 d, `Tier ≥ T3` | 20 | 105 b |
| R2 | + weight ≥ 6.0 from ≥6 vouchers spanning ≥3 independence classes, dwell ≥ 540 d, ≥12 counted sessions | 30 | 252 b |
| R3 | + weight ≥ 12.0 from ≥10 vouchers, dwell ≥ 1080 d, ≥36 counted sessions, has vouched ≥3 others with zero convictions among them, `Tier ≥ T4` | 40 | 420 b |

Dwell derives from `first_minted_at_of` exactly as `ThreadStanding::from_ledger` does today (`treasury-t0:190-198`) — the thread supplies no age.

Vouch weight, with **two** ring defenses, because the adversarial pass showed one is not enough:

```
w(v→u) = base(rung_of(v)) · freshness(now − at) · indep(v,u) · hub(v)
indep(v,u) = 1 − |N(v) ∩ N(u)| / |N(v) ∪ N(u)|          // clique defense
hub(v)     = 1 / (1 + out_degree_365d(v) / SLOT_BUDGET) // STAR defense — NEW
```

The Jaccard complement collapses a mutually-vouching ring to ≈0 as advertised. It does **nothing** to a *star*: a hub vouching leaves who never touch each other has disjoint neighbourhoods and scores `indep ≈ 1.0`, i.e. maximal independence. One aged R3 hub (there will be a market; ~$3,000) emits 6 vouches/yr forever. The `hub(v)` term prices the voucher's own out-degree and is what makes marginal attack cost non-decreasing in N. Slot budgets: R1 = 1, R2 = 3, R3 = 6 per year.

### 3.3 What the cap is a percentage OF — the ruling that decides the whole design

Three candidate bases, and each of the three designs picked a different one. All three are wrong in a different way:

| Base | Failure |
|---|---|
| `minted_to_date` (stake-and-vouch §2.1) | **Fixed point at zero.** `minted_to_date_of` returns 0 for a new root and rises *only* inside `mint` (`b-token:120-123`). x₀ = 0, xₙ₊₁ = xₙ + 0.10·xₙ ≡ 0. Nobody ever unlocks anything. Not a bootstrap problem — an arithmetic one. |
| fixed 420 (self-revealed §3.5) | **Annuity.** A compromised root yields 168 b/yr forever instead of a decaying series. This is why self-revealed had the *lowest* cost per farmed b despite the strongest per-root gate. |
| `remaining` alone (cost-based §1a) | **Zeno.** Geometric decay; 420 is a limit never attained; and paired with the tranche it is the $4.2M hole. |

**Ruling:** the base is `rung ceiling − minted_to_date`, with a termination floor.

```
remaining(root)   = LIFETIME_CEILING_B[rung] − minted_to_date_of(root)
raw               = remaining × (CAP_PCT[rung] − penalty_points) / 100
floor             = LIFETIME_CEILING_B[rung] / 10        // suspended while penalty_points > 0
annual_cap        = min(remaining, max(raw, floor))
```

The ceiling is a **constant indexed by rung**, so there is no fixed point at zero. `remaining` shrinks, so a compromised root is a decaying series, not an annuity. The floor makes it terminate in finite time. `minted_to_date_of` is monotonic and derived — RELAY_16-clean.

R3 termination, ceiling 420 b, integer arithmetic:

| Year | remaining | raw (40%) | taken | cumulative |
|---|---|---|---|---|
| 1 | 420 | 168 | 168 | 168 |
| 2 | 252 | 100 | 100 | 268 |
| 3 | 152 | 60 | 60 | 328 |
| 4 | 92 | 36 | **42** (floor) | 370 |
| 5 | 50 | 20 | **42** (floor) | 412 |
| 6 | 8 | 3 | 8 | **420** |

Six years to full entitlement at the top rung. R0: 42 b ceiling, 4.2 b/yr floor → ten years to 42 b. Both terminate; neither is an annuity.

### 3.4 Velocity — sessions and EDU, and why they do not mint

**This is the load-bearing correction to all three designs.** In cost-based and self-revealed, bRespect sessions *emit b*. That is what makes the 4-of-6 seat capture worth 4× the honest rate at $0 (§6). Here, sessions and EDU **release b you are already entitled to**. They cannot create entitlement; only vouches can.

```
velocity_milli(root, year) =
    250                                                    // base, unconditional
  + 450 · min(counted_sessions_365d, 12) / 12              // bRespect
  + 200 · min(distinct_quest_hashes_365d, 10) / 10         // EDU comprehension
  + 100 · min(standing_of(root), R_MAX) / R_MAX            // Respect

annual_allowance = annual_cap × velocity_milli / 1000
```

250 + 450 + 200 + 100 = 1000. A wholly passive user reaches 25% of their cap. Nobody reaches 100% without synchronous human presence. Velocity can never exceed the cap.

**A counted session** requires: quorum ≥ 6 distinct roots, ≥ 2 distinct attesting roots signing the artifact (the `BTreeSet` independence idiom already proven at `treasury-t0:127-135`), a consensus rank producing `rank_factor > 0` (ranked last by co-present peers → the session does not count), and `MIN_SESSION_INTERVAL = 21 days`. Max 12 counted per year. `novelty` — the fraction of co-seats not circled with in 90 days — is a **credit discount** on the session, never a penalty trigger.

**EDU contributes a count, not a magnitude, and this is not negotiable.** `mastery_ledger::Outcome` is binary by deliberate design as legal armor (`mastery-ledger:8-12, 65-70` — "Records THAT comprehension occurred, never WHAT"), and `adapter_lti::quest_weight` is hard-refused today by `QuestParams::UNRATIFIED` → `LtiError::ProvisionalWeight` (`adapter-lti:151-157, 254-256`). So velocity reads `distinct quest_hash` with `Outcome::Passed` and nothing else. `mastery-ledger` needs **no change**; the refusal in `adapter-lti` stays closed until §5/§1 ratify.

> **FLAG FOR FOUNDER — reading, not a silent choice.** Your spec says velocity "increases with bRespect sessions and EDU comprehension." I have read that as *sessions and EDU move the rate at which entitled b is released*, not as *sessions and EDU mint b*. The second reading is what the attackers broke: at 1 b ≈ 5 attended human-hours, one human holding 4 of 6 seats in a circle earns 4× the honest rate at $0 marginal identity cost, and 168 b/yr would require 560 sessions. If you intended sessions to mint directly, say so and the cap architecture has to be rebuilt.

---

## 4. The self-borrow

### 4.1 The adversarial finding, accepted in full

**Yes — as specified in all three designs, the USD-stable self-borrow is the honeypot, and the honeypot is for the protocol, not the attacker.**

`LienBook::forfeit` (`treasury-t0:417-442`) unreserves and then **burns from the debtor's own balance**. Nothing is transferred. That is correct for its original purpose — the one-room law (`assert_no_b_custody`, `:267-276`) exists so no pool can accumulate seized collateral. All three designs then reuse it as the default remedy for a *USD advance* and each states the missing recovery leg as a feature. The counterparty who advanced USD recovers exactly zero.

Rational-default condition, independent of any design detail:

```
DEFAULT IS PROFITABLE  ⟺  P · L  >  C_b
```

P = USD price of b, L = loan-to-value, C_b = attacker's marginal cost to farm 1 b. For an honest user C_b ≈ P and default is neutral. For a successful farmer C_b ≪ P **by definition of a successful farm**. So default is the dominant strategy for exactly the population the mechanism is meant to exclude, and only for them.

Worse, second-order: a farmer's natural brake is market impact — dumping N×420 b craters the price they are dumping into. A burn-on-default self-borrow is a **zero-slippage exit at oracle price** with the counterparty absorbing the whole impact. It does not merely leak value; it removes the only endogenous economic brake on sybil farming.

### 4.2 The fix — recovery by assignment, and it needs no oracle

The trilemma the attackers stated (recovery → liquidation → price at enforcement → oracle → banned by `treasury_t0::dependency::FORBIDDEN`) has a hole in it, and the hole is legitimate.

**The one-room law forbids a *contract* holding `b`.** `SecondRoomHoldsB { address }` fires on `ContractRef.holds_b == true` (`treasury-t0:267-276`). A *natural person's root DID* is not a contract. So:

```rust
/// Assign a forfeited lien to the creditor ROOT (not a contract). Unreserve,
/// then transfer. Requires SettlementAuthorization. Refuses if `creditor`
/// resolves to a ContractRef with holds_b — SecondRoomHoldsB.
pub fn assign(&mut self, ledger: &mut BLedger, id: LienId,
              creditor: &Did, auth: &SettlementAuthorization) -> Result<(), T0Refusal>;
```

No price is consulted at enforcement, because the obligation was **fixed in b at origination**. The lender chose L, takes the b on default, and bears the price risk they priced. This is a pawn, not a margin loan: no liquidation, no margin call, no oracle, `FORBIDDEN` intact. The `P·L > C_b` inequality inverts — the lender recovers V > L·V and is whole modulo their own price call.

`VouchBond` forfeit keeps the **burn** path. A bond is meant to deter, not to repair, and a burn is the correct shape for it.

### 4.3 The tranche

**Ruling on the ambiguous phrasing.** "+10% annual b unlock collateral for USD stable selfbarrow" sits inside the annual-unlock-cap list. I read it as a fifth, restricted tranche: an *additional* 10% that may be unlocked **only in collateralized form — born reserved, never spendable as `b`.**

```
tranche(root) = minted_to_date_of(root) × 10 / 100      // NEVER `remaining`
```

**`minted_to_date`, never `remaining`, and this is the single highest-leverage word in all three documents.** cost-based §2 contradicts itself here — its formula says `remaining`, its change-list says `minted_to_date` — and the `remaining` reading grants a fresh root that has done nothing 10% of a lifetime entitlement it has not touched. Worked: 10,000 free bzDiDs × 42 b/yr × $20/b × L=0.5 = **$4.2M against $0.001 of CPU**, a 4-to-6-order-of-magnitude swing from the safe reading. Every existing cap in `treasury-t0` is a fraction of `minted_to_date` (`:208-211`, `:221-225`) precisely because that is the monotonic, derived, *earned* quantity.

Structural changes required — these are real work, not constants:

- `pub purpose: LienPurpose` on `Lien` (`treasury-t0:292-297`) — `{ General, SelfBorrow }`. Without it, a 40%-rung user pledging 40% + 10% reads as a flat 50% and is refused.
- `collateralized_of(who)` → `collateralized_of(who, purpose)`.
- `lock` budgets per purpose: `General ≤ min(maturation_bound, floor_bound)`; `SelfBorrow ≤ 10% of minted_to_date` additional; **`General + SelfBorrow ≤ floor_bound` always.**
- New refusal `ExceedsSelfBorrowTranche { would_lock, tranche }`.
- `UNCOLLATERALIZABLE_FLOOR_PCT = 20` untouched. At R3 that is 40 + 10 = 50 ≤ 80. **The self-borrow can never eat the 20% law floor.**

Gate: **R2 minimum**, revoked permanently on first conviction. At `age_years = 0` the existing maturation curve already throttles it to zero — 10% of a 2 b grant rounds to 0 (`treasury-t0:850-877`) — so the day-one anti-predation rule composes for free.

### 4.4 What ships when

**Phase 1 ships the tranche with no external USD leg at all** — a reserved, non-transferable lien. All of the anti-predation shape, none of the counterparty exposure. The external advance is a separate governance act that must not open until `assign()` is landed and proven. That is a one-line scope cut that removes the largest single loss in this analysis.

---

## 5. The penalty

### 5.1 Trigger

Not "a multiple bzDiD is attempted" — that is void (§1). The implementable trigger:

> **Equivocation.** A root presents itself for vouching as an un-vouched human when it has already been vouched by an overlapping voucher set — established by a `SettlementAuthorization` constructed over Evidence from **≥2 distinct, Settlement-grade sources**, i.e. two humans, independently, who met the person.

Build nothing new for the gate. `SettlementAuthorization::from_evidence` (`treasury-t0:118-140`) already demands non-empty, all-items `ViewGrade ≥ Settlement`, and ≥2 distinct `source_ref` counted by `BTreeSet`. Its fields are private, it has one constructor, and it derives no `Deserialize` — it cannot be conjured from the wire.

One correction to the treasury read: the `source_ref: None` case is **not a hole.** `filter_map` over `Some(_)` into a `BTreeSet` means an all-`None` evidence set yields `len() == 0 < 2` and fails **closed** as `LoneSource { distinct_sources: 0 }`. Only the refusal message is imprecise.

**The accusation names exactly one root — the new one.** Vouchers who recognise the human never name the prior root. The system learns "this root is a duplicate of something" and never learns of what. No type has a field that can hold a pair of roots, enforced the way `SettlementAuthorization` is enforced (private fields, one constructor, no `Deserialize`), not by convention.

### 5.2 Arithmetic

Percentage **points** off the rung cap, plus a rung knockdown:

```
P(n) = 5 · 2^(n−1)        →  5, 10, 20, 40
penalty_points(root) = Σ P(i), decaying 1 point per clean calendar year, floor 0
offense count n : MONOTONIC, never decremented    (the invariant class of minted_to_date)
each conviction: rung −1, advancement frozen 730 d, self-borrow revoked permanently
eff_cap_pct = CAP_PCT[rung_after_knockdown].saturating_sub(penalty_points)
```

Worked from R3, ceiling 420 b, year one:

| Offense | Rung | ceiling | cap % | Σ P | eff % | year-1 allowance @ velocity 1.0 | self-borrow |
|---|---|---|---|---|---|---|---|
| clean | R3 | 420 | 40 | 0 | **40** | 168 b | +42 b |
| 1st | R2 | 252 | 30 | 5 | **25** | 63 b | revoked, permanent |
| 2nd | R1 | 105 | 20 | 15 | **5** | 5 b | — |
| 3rd | R0 | 42 | 10 | 35 | **0** | 0 | — |

Three strikes is economic death. The identity survives; Step 0 — the commons (`onboarding:5-8`) — remains free and anonymous. Nobody is expelled from the commons for anything.

> **FLAG FOR FOUNDER.** You wrote "-5% from annual unlock caps." I read that as **5 percentage points**, not a 5% relative reduction. Points off a 10% rung halves that year's unlock; relative would take 10% → 9.5%, which is decorative. If you meant relative, say so.

Three things the penalty never does: it never claws back already-minted b; it never touches the 20% law floor; it never forfeits a lien. `forfeit` requires a `SettlementAuthorization`, which a velocity heuristic can never legitimately produce. A penalty that seizes is a liquidation vector.

### 5.3 What the penalty state reveals, and to whom

The privacy auditor's worst finding was against this exact surface, and it is correct: a public conviction row joined against a public vouch graph with 1/3/6 annual slot budgets reconstructs the same-human pair with anonymity set ≈ 1. Two accusers who both vouched the original root have vouchee sets of cardinality ≤ 6/yr; the intersection *is* the original root. "No single type holds the pair" is not a privacy property — **joinability is the property.**

Three fixes, each structural:

1. **The conviction record stores the `SettlementAuthorization`, not the Evidence.** The token carries only `{ grade, source_count }` — both private. The `source_ref`s are consumed at construction and never persist. The accusers are unrecoverable from the record by design, using a property the existing type already has.
2. **The vouch edge list is not public.** `VouchBook.edges` is read only by the independence computation inside the unlock engine. The only public output about a root is its rung. Your vouchers know they vouched you — they signed it — and that is the disclosure, bounded to people who met you.
3. **Refusals are opaque.** `ExceedsAnnualUnlockCap` returns no cap, no year, no points. cost-based §4's refusal payload leaks `cap`, from which `penalty_points` follows by subtraction and the offense count inverts as `n = log₂(pts/5) + 1`.

Residual, stated: whoever runs the unlock engine sees the graph. That is not zero-knowledge and this design does not claim it is. Moving the independence computation behind a VOPRF or MPC is the eventual path; nothing in tree supports it today.

### 5.4 Standing law on signals — ratify this verbatim

A value may become a duplication signal only if **all four** hold:

1. The user performs an **affirmative submission** of the value.
2. There is a **free path that never submits it.**
3. The submission's purpose is to **obtain something** — it is a purchase, not a side effect.
4. The test is **byte equality on a value the user submitted twice** — never an inference, a threshold, a clustering, or a model.

Permanently inadmissible, at any confidence, for any penalty: social-graph overlap, IP, ASN, timing correlation, session-cadence fingerprinting, writing style, transaction-graph clustering, device-sensor entropy, geolocation, browser fingerprint, "same relay," "same PDS." **This is a list, not a vibe.** Additions require a ratified amendment and apply prospectively only.

This rule, applied to the designs that proposed it: it forbids cost-based's T2 (a clustering threshold), and it forbids using the vouch graph's Jaccard term as a *penalty* trigger — which is why `indep` and `hub` here only discount credit and never convict.

---

## 6. The attacker's arithmetic

### The inequality that must hold

```
(A)  Farming unprofitable:      C_b  >  P
(B)  Self-borrow safe:          recovery ≥ L · V   ⟸  assign() with L < 1
(C)  Sybil resistance real:     ∂C_root/∂N  ≥  0      (marginal cost non-decreasing in N)
```

(C) is the only correct target and it is what the rung-gated lifetime ceiling plus `hub(v)` slot pricing deliver. An annual flow cap alone satisfies none of them.

### Cheapest break against **this** design

**Buy vouches.** There is no cheaper path, and that is the point.

```
Price of one vouch (an R2 voucher, 200 b minted):
  bond      = 25% × 200 b = 50 b, locked 730 d
  at P = $20/b                                    $1,000 locked
  carry @ 15% required return × 2 yr                 $300
  conviction risk ≈ 5% × $1,000                       $50
  ───────────────────────────────────────────────────────
  market-clearing price per vouch                   ~$350

R2 gate: 6 vouches spanning ≥3 independence classes  = $2,100 / root
R2 lifetime ceiling                                  =    252 b
  C_b = $2,100 / 252                                 =  $8.33 / b
  Break-even b price for a self-borrow default, L=0.5 = $16.66
```

Plus the non-purchasable conjuncts: 540 days dwell, 12 counted sessions at ≥21-day intervals with ≥5 distinct co-attendees each, `Tier ≥ T3`. **Minimum wall-clock to R2: 18 months per root, and the sessions consume real calendar.**

With `hub(v)` in place, an aged R3 hub (~$3,000) whose out-degree runs at the slot budget sees `hub(v) → 0.5` and falling; its vouches lose half their weight, so the attacker needs ~12 purchased vouches, not 6, and `C_b → ~$16/b`. That is where (A) starts to hold at plausible prices.

### For comparison — what the attackers found against the three inputs

| Design as written | C_b (lifetime) | Break-even b price, L = 0.5 |
|---|---|---|
| self-revealed | **$0.31 / b** | $0.62 — broken at any price |
| cost-based | **$1.59 / b** | $3.18 |
| stake-and-vouch | $8.33 / b | $16.66 |
| cost-based **tranche** (`remaining` reading) | **$0.0000001 / root** | $4.2M for $0.001 of CPU |

And the cheapest attack against cost-based's *session* layer, which this design's §3.4 correction eliminates:

> 4 browser profiles at `EvidenceClass::SessionOnly` → `Tier::T1`, cost $0. Hold 4 of 6 seats in a circle → outright majority of the consensus ranking → `rank_factor ≈ 1.0` on all four seats. Rotate across a free pool of 40 sybil roots so `novelty ≈ 1.0`. Yield **0.48 b per 1.5 human-hours = 0.32 b/human-hour, versus 0.08 for an honest lone participant — a 4× advantage, exactly the seat count**, at $0. Nothing bounds seat count, because bounding it requires linking roots.
>
> **Under §3.4 this attack yields nothing.** Seats move velocity within a cap the attacker cannot raise without vouches. Four captured seats at R0 still hit a 4.2 b/yr ceiling.

---

## 7. What this cannot stop

Plainly, with no hedging.

1. **Unlimited bzDiDs.** Free, instantaneous, undetectable, by construction. 10,000 R0 roots is a valid state of the system and always will be.
2. **R0 farming.** 42 b lifetime per root × N, throttled only by needing N genuine `ResourceProof`s. That is a labour cost, not an identity cost. If `ResourceProof` verification is weak, this is the whole attack surface — and today `AcceptNonEmptyProof` is the *only* `impl ProofVerifier` in the workspace. **The verifier is a larger hole than anything in this document.**
3. **A real human selling or renting their vouched root.** No mechanism distinguishes "this human" from "this human's keys, operated by someone who paid them."
4. **Coercion.** Vouching under duress produces a valid vouch.
5. **A resourced adversary who recruits genuine humans.** 1,000 real people vouching for each other honestly, all controlled by one payroll, is indistinguishable from 1,000 real people. Independence classes raise the coordination cost; they do not make it infinite.
6. **Quest-bank automation.** LLM passes on a known quest bank cost ~$0.05. EDU is capped at 20% of velocity for exactly this reason and must stay a minority term.
7. **Correlation the user chooses.** Anyone who vouches is telling their vouchers who they are. That is the trade, not a bug.
8. **Anything, until 420's units are ruled.** `Amount = u128` "atomic units" with no divisor anywhere in the workspace (`b-token:32-33`). 420 exists only in prose across four crates that each defer to another (`onboarding:24`, `mastery-ledger:16`, `adapter-lti:5`, `adapter-lti/Cargo.toml:6` — circular); `dashboard:197` is the only honest consumer and renders it Absent. **Every percentage in this document is uncomputable until that is ratified.** `UnlockParams::default() = { 100, 10 }` (`b-token:263-272`) is four orders of magnitude off any scale that makes 420 meaningful and must not survive contact with a mainnet.

---

## 8. Build order

Each phase ends in something testable in-tree.

**P0 — Rulings and the fourth hat.** No new features.
- Governance act: `ATOMIC_PER_B`, the 420 units, the rung ceilings, the `minted_to_date`-not-`remaining` ruling, the spec amendment in §1.
- `treasury-t0`: `MaturationParams` stops being a `lock` argument. Constants move to `pub const`; `lock`'s signature drops the parameter.
- **Test:** invert `treasury-t0:809-827`. Today it proves a caller can pass `{100, 0, 100}` and evaporate the ladder. After P0 that params struct is unconstructible at the call site — the test becomes a compile-fail or a refusal.

**P1 — `b-token`: the cap, self-guarding.**
- `ATOMIC_PER_B`, `LIFETIME_CEILING_B`, `CAP_PCT`, `TERMINATION_FLOOR_DIV`.
- New `BLedger` fields `rung`, `unlocked_in_year`, `penalty`, all `#[serde(default)]`.
- `mint` gains the cap check after the `ProofVerifier` gate, before the balance mutation. New `LedgerError::{ExceedsAnnualUnlockCap, ExceedsLifetimeCeiling}` with **opaque** payloads.
- **Test:** the six-year R3 termination table of §3.3, exactly; an R0 root capped at 42 b lifetime across 20 simulated years; refusal payloads assert-free of `cap`/`year`/`points`.

**P2 — `b-unlock`: velocity, read-only.**
- `SessionBook`, `CountedSession`, `velocity_milli`. Reads `MockLedger` for mastery and `RespectBook` for standing. Mints nothing.
- **Test:** passive user → 250; 12 sessions + 10 quests + max Respect → 1000; a 13th session and an 11th quest change nothing; a session inside `MIN_SESSION_INTERVAL` is not counted; a session with <2 distinct attestors is not counted (`LoneSource` idiom).

**P3 — `b-vouch`: the rung.**
- `VouchAttestation`, `VouchBook`, `IndependenceClass`, `indep`, `hub`, slot budgets. `RungAuthorization::from_vouches` with the `SettlementAuthorization` shape. `BLedger::set_rung`.
- Bonds via `treasury-t0::LienBook::lock` with `purpose: VouchBond`.
- **Test:** a 6-clique of mutually-vouching roots lifts nobody above R0 (`indep → 0`); a star of 1 hub × 10 leaves lifts nobody above R1 (`hub → 0`) — **this test does not pass against stake-and-vouch as designed and is the reason `hub` exists**; `RungAuthorization` has no `Deserialize` and cannot be built from a serde round-trip.

**P4 — The penalty.**
- `PenaltyRecord`, `BLedger::convict(who, &SettlementAuthorization, at)`, points ladder, decay, rung knockdown, 730-day freeze.
- **Test:** the §5.2 table exactly; a conviction record round-tripped through serde yields no accuser; `convict` is uncallable without a real `SettlementAuthorization`; the offense counter never decrements while points decay.

**P5 — `Lien.purpose` and the recovery leg.**
- `LienPurpose { General, SelfBorrow, VouchBond }`; `collateralized_of(who, purpose)`; per-purpose budgets in `lock`; `ExceedsSelfBorrowTranche`.
- `LienBook::assign(ledger, id, creditor, auth)` — unreserve then transfer to a root DID; refuses a `ContractRef` with `holds_b` as `SecondRoomHoldsB`.
- Tranche ships **reserved-only, no external advance.**
- **Test:** R3 user locks 40% General + 10% SelfBorrow and is accepted; the same totals under one budget are refused (the defect this fixes); `General + SelfBorrow` can never cross `floor_bound`, i.e. the 20% law floor survives every composition; `assign` to a contract address is refused; `assign` to a root transfers and the creditor's balance rises by exactly the lien amount.

**P6 — External USD leg. Separate governance act, gated on P5.**
- Origination at `denomination::DrawFacility` — the only place a b↔currency ratio may be rendered. The facility applies the rate and hands `treasury-t0` an amount of `b` only. `dependency::FORBIDDEN` stays intact and its enforcing test stays green.
- Do not open this phase until `assign()` has shipped and the `P·L > C_b` inequality has a ratified `P`.

**Not in this plan, and blocking more than any of it:** a real `impl ProofVerifier`. `AcceptNonEmptyProof` is the only one in the workspace, and `docs/tokenomics-earned-emission.md:100-103` says it best — an ungoverned upgradeable verifier is a premine hiding behind a trait boundary. Every number above assumes minting is hard. Today it is not.
