# b collateral and lending layer

<!-- 8 agents: 2 ground (treasury-t0/b-token source; oracle-free lending),
     3 designs, 2 adversarial (predatory lender / deliberate defaulter), 1 spec.
     2026-08-05. ALL THREE input designs were rejected as written; this is the
     synthesis, and the monotone assigned_out counter is the load-bearing fix
     none of them had.
     HARD RULE: 420 is a COMPUTED VIEW VALUE, never a minted balance. Minting
     420 up front and displaying a locked portion collapses the whole
     anti-debt-trap invariant in one step. -->

# BNR `b` Collateral & Lending Layer — Specification

**Status:** design spec for implementation against `C:\Users\travi\beehive-nature\crates\b-token\src\lib.rs` and `C:\Users\travi\beehive-nature\crates\treasury-t0\src\lib.rs`. Line references verified against the working tree this session.

**Settled inputs assumed:** 420 b is a lifetime *entitlement*, `unlocked(t) = 420·(1−(1−r)^t)`, `r_eff = r_base·R/120`, `r_base = 10.5%`; dormancy defers and never forfeits; b transferable, bRespect not; uniqueness from biometric key; no oracle at enforcement.

**Synthesis ruling:** none of `pawn`, `pledge-tranche`, `velocity-credit` is safe as written. This spec takes `pledge-tranche`'s two balance classes, `velocity-credit`'s in-`mint` vesting ceiling, `pawn`'s creditor-cap-invariance tests, and **rejects** `pledge-tranche`'s `assigned_headroom` and `velocity-credit`'s framing of `settle_in_b` as an anti-trap property. It adds the monotone `assigned_out` counter, which is the load-bearing fix neither had.

---

## 1. The mechanism in five sentences

A person enrols once against their biometric root, and from that moment their b vests continuously on a fixed-fraction-of-remainder curve, minting into two disjoint classes: **90% spendable b** they can transfer, spend, or burn, and **10% collateral-class b** they can pledge but can never sell or transfer themselves. To borrow, they place a lien on some quantity of their *already-vested* collateral-class b — bounded by the maturation ladder, the 20% floor, a per-counterparty ceiling, and a lifetime monotone counter of everything they have ever lost to default — and a single named lender, who must be a proven natural-person root, advances them whatever asset that lender chooses at whatever ratio that lender names, entirely off-ledger. The chain records only the b quantity, the creditor root, the term, and the redemption window; it never learns the advance, the asset, or any price, and there is no margin call, no health factor, no liquidator and no auction. On default the pledged b moves by `assign` from the debtor's collateral class directly into the creditor's collateral class — never through a contract — the obligation is extinguished in full with no deficiency and no recourse, and the debtor's cap is permanently reduced by exactly the amount assigned, so the same b-quantity can never be lost twice. The borrower's spendable class, their bRespect, their unlock velocity, and their remaining 420-entitlement are untouched by every path in this layer, which bounds the maximum a person can lose to lending across an entire lifetime at **33.6 b — 8.0% of the entitlement**.

---

## 2. The balance classes

### 2.1 The four states

| Class | Ledger home | Transfer by holder | Sell | Burn by holder | Pledgeable | Raises cap | Governance |
|---|---|---|---|---|---|---|---|
| **Unvested entitlement** | **none — no map, no field** | — | — | — | **unnameable** | no | none |
| **Spendable b** (90% of each unlock) | `balances` (existing) | yes | yes | yes | **no** | no | none |
| **Collateral b** (10% of each unlock) | `collateral` (new) | **no function exists** | **no** | **no function exists** | yes | yes (it *is* the base) | none |
| **Pledged b** | `collateral_reserved` (new) | no | no | bond/commons fork only | already is | counted against | none |

bRespect is orthogonal to all four and moves in none of them. It has no transfer entrypoint and this layer adds none.

### 2.2 The state machine

```
        ┌────────────────────────────────────────────────────────┐
        │  UNVESTED  =  420e18 − unlocked(t)                      │
        │  no map, no field, no entry, no name anywhere on-chain  │
        └───────┬────────────────────────────────┬───────────────┘
   mint_due 90% │        gate: in-`mint`         │ mint_collateral_due 10%
                ▼        vesting ceiling         ▼
      ┌──────────────────┐              ┌──────────────────────────┐
      │  SPENDABLE       │              │  COLLATERAL              │
      │  balances        │              │  collateral              │
      │  transfer ✓      │              │  transfer   — NO FN      │
      │  burn     ✓      │              │  burn       — NO FN      │
      │  reserve  ✗      │              │  →spendable — NO FN      │
      └──────────────────┘              └──┬───────────────────▲───┘
              ▲                            │                   │
              │   NO EDGE EXISTS   reserve_collateral   unreserve_collateral
              │   IN EITHER            (lock)               (release)
              │   DIRECTION               ▼                   │
              │                  ┌────────┴───────────────────┴──┐
              │                  │  PLEDGED                      │
              │                  │  collateral_reserved          │
              │                  └──┬──────────────────┬─────────┘
              │      assign_collateral                 │ burn_collateral
              │      (assign / surrender)              │ (forfeit — Bond
              │                  │                     │  or Commons ONLY)
              └──────────────────╳                     ▼
                                 ▼                  supply −
                    creditor's COLLATERAL       (deflation IS the
                    still non-sellable           settlement)
                    debtor's assigned_out +=
```

**Two absent edges are the entire design.**

- **COLLATERAL → SPENDABLE does not exist.** No function, no entrypoint. This is `RespectBook`'s own documented discipline (`b-token/src/lib.rs:211-215` — "the whole point of this type is what it does **not** offer") applied to a balance instead of a score.
- **SPENDABLE → COLLATERAL does not exist either.** Otherwise pledge capacity becomes purchasable and the personhood bound collapses. Collateral-b is created **only** by vesting and moved **only** by `assign_collateral`.

### 2.3 Why the invariant is structural, not policy

Claim: **no lien can ever attach to unvested b.** Proof chain, each link a line of code:

1. A lien is created only by `LienBook::lock`, which creates it only via `reserve_collateral` (the analogue of `treasury-t0:374`). There is no other constructor for `Lien`.
2. `reserve_collateral` refuses above `collateral_of − collateral_reserved_of`. It is a subtraction over a present balance.
3. `collateral` rises in exactly two places: `mint_collateral_due` and `assign_collateral`.
4. `mint_collateral_due` refuses any mint that would carry `collateral_minted_to_date` above `unlocked(t)·10/100`, **checked inside `BLedger` against `BLedger`-owned state, before any verifier is consulted** (§5, P-2).
5. Therefore unvested b has never been minted, has no balance, cannot be reserved, cannot be a lien amount, cannot be assigned.

**The corollary that makes it structural:** a lien on unvested b is not *refused*, it is **unnameable**. No field in `Lien` (`:293-297`), `LienBook` (`:302-306`), or `ThreadStanding` (`:163-169`) can express a future unlock. To attach one, a contributor must add a field, add a mint path that outruns the ceiling, and defeat the reserve gate — three separate additions, each visible in a diff.

**The load-bearing consequence: never mint 420 up front.** If enrolment minted `420e18` and the UI merely displayed a locked portion, the reserve gate collapses in one step and the whole invariant is gone. 420 is a computed view value with no `BLedger` representation, ever.

**Second consequence: 90% of everything a person ever receives is permanently outside the collateral system.** Not by rule — by there being no function that moves it in.

---

## 3. No oracle

### 3.1 Where LTV lives

**The protocol computes no LTV.** There is no `ltv` field, no `collateral_factor`, no `health_factor`; searching for one must return nothing. The only ratio-shaped number the chain computes is `collateral_cap`, which has b in the numerator and b in the denominator — pledged-b against collateral-minted-to-date-b. Like units, no exchange rate.

The economically meaningful LTV is a lender's bid, stated once, off-ledger:

> "I advance **A** units of asset X against **V** units of your collateral-b, term **T**, redemption **R**."

`A/V` **is** that lender's price of b. Wrong high, they lose; wrong low, the borrower goes elsewhere. Competition between lenders discovers the price; the protocol never learns it. `A`, `R`, and the asset name never enter `treasury-t0` — `Lien` stays asset-blind, as it is today. Name the off-chain field `advance_asset`, **never** `quote_asset`: `"quote"` is on `dependency::FORBIDDEN` (`:456-468`) and the scanner matches `use` lines textually.

### 3.2 What the chain reads at enforcement

Exactly one comparison: `auth.earliest_witness() >= redeemable_until`. A clock against a clock. There is no state in which the protocol asks what b is worth. Undercollateralization is not a protocol event — it is the lender's loss, priced at origination, non-recourse.

`assign` **takes no `now`.** A caller-supplied clock at enforcement is a seizure primitive: forge `now`, take the collateral before the term runs. Time is bound to the authorization instead — add `witnessed_at` to `Evidence`, expose `SettlementAuthorization::earliest_witness()`. Since `from_evidence` (`:118-140`) already requires ≥2 distinct `source_ref` at ≥`ViewGrade::Settlement`, early seizure now requires **two independent sources to lie about the clock**, the same bar every other settlement-class fact clears. Zero new constructors, no `Deserialize`.

### 3.3 Rejected constructions, with reasons

- **Dutch auctions (Ajna, Blend).** Both need a bidder population at enforcement time; at genesis that set is empty and a one-bidder auction is a gift, not a price. Both also require the protocol to *hold* collateral to sell it — a second room, which `assert_no_b_custody` exists to forbid.
- **Any pooled shared-loss design.** Socialised risk is what forces a feed, not pooling as such. P2P matched, one lender one borrower, no shared loss surface, therefore no shared oracle. Ajna-style lender-stated buckets remain the scaling path if matching ever binds.
- **Automated liquidation of any kind.** `assign` is gated on `SettlementAuthorization`, which cannot be constructed from a missed payment, a velocity drop, or a heuristic. That is the property that keeps default enforcement out of liquidation shape.

### 3.4 What I could NOT solve oracle-free — stated plainly

**Per-loan surplus return is not achievable without a price.** In pawnbroking, statute makes over-collateralization safe by requiring the surplus be returned to the borrower; that requires knowing the sale value, which requires a price. The `recovery_cap` idea (lien records a b-quantity the creditor may take, remainder unreserved) is defeated in one step: the lender simply sets `recovery_cap = amount`. I do not ship it, because a control that a rational counterparty neutralizes for free is worse than no control — it reads as protection and is not.

**What replaces it** is a *lifetime extraction bound* rather than a per-loan surplus: the monotone `assigned_out` subtraction (§5 P-4), the per-counterparty ceiling (P-5), and mandatory disclosure of a lender's foreclosure history (P-6). These bound total harm; they do not make any single loan fair. §7 quantifies the residual.

### 3.5 The asset leg

Ship the **b-denominated case first**: borrow b, repay more b, collateral-b pledged. No stablecoin, no issuer, no freeze authority, no oracle. Tether ended USDT issuance on EOS in June 2024 and announced discontinuation of redemptions effective 1 Sept 2025 (contracts left transferable after Aug 2025 pushback, but issuance and redemption are gone) — Vaulta is EOS, so a "native USDT" leg is a stranded claim with no primary market. Every fiat-referencing stablecoin also carries issuer blacklist authority, which is a man-in-the-middle at the asset layer by definition. The lien book must never name an asset **precisely so that the stablecoin leg is allowed to die** without touching the core.

---

## 4. The forfeit fix

### 4.1 The confirmed defect

`treasury-t0:417-442`: `forfeit` calls `unreserve(&debtor, amount)` then `ledger.burn(&debtor, amount)`. Balance effects are `debtor.reserved −= amount; debtor.balance −= amount; supply −= amount`. **No credit is created anywhere.** Test `c_ii_forfeit_burns_exactly_and_deflates` (`:708-725`) asserts exactly this. Whoever advanced value recovers zero, so default is rational whenever `P_b · LTV` exceeds the borrower's marginal cost of b. The doc comment at `:411-416` states burn-not-transfer as the *intent*, so this is a design gap for a credit product: the code silently applies a mutualised-commons rule to a P2P fact pattern.

### 4.2 The fix, by signature

**New types in `treasury-t0`:**

```rust
/// A DID proven to be a natural-person root. Private field, NO `Deserialize`,
/// no public tuple constructor. Mirrors `SettlementAuthorization`'s discipline (:104-148).
pub struct RootDid(Did);

impl RootDid {
    /// The registry is CHAIN STATE, a concrete owned type — NOT `&dyn UniquenessRegistry`
    /// and NOT a caller-passed `&BiometricRegistry`. A proof obligation discharged by a
    /// caller-supplied trait object is not a proof (this is exactly why
    /// `ContractRef::holds_b` at :259-262 is a hole).
    pub fn from_registry(reg: &RootRegistry, did: &Did) -> Result<RootDid, T0Refusal>;
    pub fn as_did(&self) -> &Did;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LienPurpose { Bond, Advance, CommonsAdvance }
```

**`Lien` (`:293-297`) gains** — all bound at `lock`, immutable thereafter:

```rust
pub struct Lien {
    pub debtor: Did,
    pub amount: Amount,
    pub status: LienStatus,               // + Assigned
    pub creditor: Option<RootDid>,        // NEW — bound at origination, never a call param
    pub purpose: LienPurpose,             // NEW
    pub matures_at: i64,                  // NEW
    pub redeemable_until: i64,            // NEW
}
```

Taking the creditor as an `assign` parameter would reintroduce the exact caller-supplied-number defect RELAY_16 closed. Drop `Serialize/Deserialize` from `Lien` (it now contains `RootDid`); persist via an explicit projection.

**Modified:**

```rust
pub fn lock(
    &mut self,
    ledger: &mut BLedger,
    debtor: &Did,
    creditor: Option<&RootDid>,   // required for Advance; None only for Bond
    purpose: LienPurpose,
    amount: Amount,
    term_secs: i64,               // refused below MIN_TERM_SECS
    redemption_secs: i64,         // refused below MIN_REDEMPTION_SECS
    now: i64,
    maturation: &MaturationParams,
) -> Result<LienId, T0Refusal>;
```
Gates unchanged in kind; `ledger.reserve` → `ledger.reserve_collateral`; refuses `debtor == creditor.as_did()` (`SelfPledge`).

```rust
/// The fix. Moves the pledged b from the debtor's collateral class to the
/// CREDITOR ROOT's collateral class. No `now` parameter — see §3.2.
pub fn assign(
    &mut self,
    ledger: &mut BLedger,
    id: LienId,
    auth: &SettlementAuthorization,   // UNCHANGED type, no new constructor
) -> Result<Amount, T0Refusal>;
```
Body: `active_lien(id)?` → refuse `purpose == Bond` (`WrongPurposeForRemedy`) → read `creditor` **from the lien record** → refuse `auth.earliest_witness() < redeemable_until` (`TermNotExpired`) → `ledger.assign_collateral(&debtor, creditor.as_did(), amount)` → `status = Assigned`. Failure arm mirrors `forfeit`'s `:432-440`: re-reserve, return `CollateralShortfall`.

```rust
/// The borrower's unilateral exit. NO SettlementAuthorization. A creditor who
/// stonewalls on assembling release evidence cannot hold collateral hostage.
pub fn surrender(&mut self, ledger: &mut BLedger, id: LienId) -> Result<Amount, T0Refusal>;
```
Callable by the debtor at any time; same ledger effects as `assign`, same `assigned_out` increment. It is an early default, and the spec calls it that — it is **not** a discount and must never be marketed as one.

```rust
/// UNCHANGED BODY. Now gated to purpose ∈ { Bond, CommonsAdvance }.
/// Burn is correct for a deterrent bond, and correct as settlement for a
/// mutualised commons advance (every holder is paid pro rata by deflation).
/// It is catastrophic for a P2P advance — that fork is the whole defect.
pub fn forfeit(&mut self, ledger, id, _auth) -> Result<Amount, T0Refusal>;
```
Refuses `Advance` with `T0Refusal::AdvanceMustAssign`. `c_ii_forfeit_burns_exactly_and_deflates` survives verbatim.

**In `b-token`:**

```rust
/// The ONLY cross-account mover of collateral-class b. Requires the amount to be
/// CURRENTLY RESERVED, so it can never be aimed at free collateral.
pub fn assign_collateral(&mut self, from: &Did, to: &Did, amount: Amount)
    -> Result<(), LedgerError>;
```
Decrements `from.collateral_reserved` and `from.collateral`; increments `to.collateral` **and `from.collateral_assigned_out`** (monotone). Never touches `balances`. Never increments any cap base.

**New refusals:** `CreditorIsNotARoot { did }`, `AdvanceMustAssign`, `WrongPurposeForRemedy { purpose }`, `TermNotExpired { redeemable_until, witnessed_at }`, `TermTooShort { given, minimum }`, `SelfPledge`, `CounterpartyConcentration { already_assigned, ceiling }`, `ExceedsLifetimeAssignedOut { would_lock, remaining }`.

### 4.3 One-room compliance — confirmed

**No contract holds b at any instant on any path.** Pledged b never leaves the debtor's own `collateral` map; `reserve_collateral` is a hold, not a transfer. `assign_collateral` moves it in one step from one natural person's map to another natural person's map. There is no pot, no escrow, no intermediate holder, no sweep. `treasury-t0` custodies nothing before, during, or after.

**And the proof is not `assert_no_b_custody`.** That function (`:267-276`) is typed over `&[ContractRef]` with a caller-set `holds_b` bool — pass `&[]` and it returns `Ok`. It cannot see a `Did` and will silently pass a contract creditor. **`RootDid` is the actual gate**; `assert_no_b_custody` is retained only as a documented smoke check and its doc comment must say so.

---

## 5. The anti-predation invariants

Each is a contract-level property with a named test, not a policy.

**P-1 · Genesis is stamped, never proposed.**
`BLedger::mint` currently settles `first_minted_at` from the caller's `at` (`:124-128`) with `.min()`, which blocks later backdating but leaves the *first* write unconstrained. That one integer is simultaneously the vesting clock (`t`) and the maturation clock (`ThreadStanding::from_ledger:190-193`). Backdating genesis 20 years yields `unlocked(20) = 374 b` immediately mintable at an 80% maturation clamp — a cap of ~299 b against an honest 0.88 b. **Split `mint` into `enrol(who, biometric_attestation)` and `mint_due(..)`.** `enrol` refuses if `first_minted_at` exists (`AlreadyEnrolled`) and takes its timestamp from the biometric registry entry's own witness time. `MAX_BACKDATE = 0`.
*Tests:* `first_minted_at_is_write_once`; `no_did_has_first_minted_at_earlier_than_its_biometric_registration`.
*Who this protects:* the sponsor-onboarded — anyone enrolled at a kiosk, camp, clinic, or agent terminal rather than self-enrolling. The person who submits your `at` is the person who can hand you an inflated cap and then lend into it.

**P-2 · No magnitude gate is ever discharged by a caller-supplied trait object.**
`mint` takes `verifier: &dyn ProofVerifier` (`:112`). Putting the vesting ceiling in a `ProofVerifier` implementation means the calling crate supplies the invariant — pass `AcceptNonEmptyProof` (already exported, `treasury-t0:509`) and mint `420e18` in one call. **The ceiling lives inside `BLedger`, checked before the verifier is consulted, against `BLedger`-owned state**: `VestingParams { entitlement, r_base_ppm, respect_cap }` as a ledger field set at `BLedger::with_vesting`, plus `first_minted_at` and `&RespectBook`. `ProofVerifier` reverts to being a contribution check and is never again a magnitude gate. Same discipline for `RootRegistry`.
*Test:* `mint_refuses_above_vested_ceiling_with_an_always_true_verifier`.

**P-3 · The cap is a pure function of vesting facts. Nothing is added outside the `min`.**
```
collateral_cap = floor_bound()
                 .min(maturation_bound(p))
                 .saturating_sub(collateral_assigned_out_of(who))
```
`pledge-tranche`'s `.saturating_add(assigned_headroom)` is **deleted**. An additive term outside a `min()` is not a cap: two roots round-tripping the same 3 b raise each other's caps by 3 b per cycle forever, so a lender who forecloses on 100 borrowers at 3 b each gains 300 b of undiscounted, unmatured cap on a ~3.6 b honest base. It also makes farming defaults out of desperate people the *only* way to accumulate pledge capacity beyond your own body's vesting rate. Keep `collateral_assigned_in` as a **read-only public disclosure counter** only.
*Tests:* `cap_is_a_pure_function_of_collateral_minted_to_date_first_mint_and_now` (quantified over all interleavings of transfer/assign/burn); `creditor_bounds_are_byte_identical_after_N_assignments_in_their_favour`.

**P-4 · Loss is monotone. The default counter never resets.** *(the load-bearing one)*
`collateralized_of` (`:320-325`) sums **Active** liens only, and `Assigned` is terminal. Without this invariant, assigning V away returns used-headroom to zero and the cap is byte-identical to before the loan — so a year-1 borrower can shed their entire collateral tranche in `1/maturation_pct` sequential loans (10x in year one, 5x in year two), and `UNCOLLATERALIZABLE_FLOOR_PCT = 20`, written as LAW at `:152-154`, is breached on loop 2. **`collateral_assigned_out` is a new monotone `BTreeMap<Did, Amount>`, incremented only inside `assign_collateral` on the debtor side, never decremented, subtracted from the cap.** Repayment is free — `release` never touches it, so the honest revolving borrower is completely unharmed. This is a default counter, not a usage counter, and it is a b-quantity, not a credit score.
*Tests:* `lifetime_assigned_out_never_exceeds_min_floor_maturation`; `release_does_not_increment_assigned_out`; `cap_regrows_only_through_vesting`.

**P-5 · Per-counterparty lifetime ceiling.**
`assigned_from_to: BTreeMap<(Did, Did), Amount>`, monotone, incremented in `assign_collateral`. `lock` refuses when `assigned_from_to(D, L) + would_lock > collateral_minted_to_date_of(D) · PER_COUNTERPARTY_PCT / 100`, `PER_COUNTERPARTY_PCT: u32 = 25` as LAW. In plain words: **no single counterparty may ever take from you, cumulatively across your whole life, more than a quarter of everything you have ever vested into the collateral class.** Reaching the lifetime ceiling requires at least four independent lenders. This is the only control that binds in a thin market — rural, sanctioned, capital-controlled, or small-language communities have one lender by geography, and for them concentration is the default case, not the tail.

**P-6 · Minimum term and minimum redemption window.**
```rust
pub const MIN_TERM_SECS: i64       = 28 * 24 * 3600;  // one bRespect epoch
pub const MIN_REDEMPTION_SECS: i64 = 28 * 24 * 3600;
```
Without a lower bound, `term = 1s` is legal and the year-one tranche clears in under a minute; combined with an off-ledger `A = 0`, `lock` + `assign` becomes the `transfer_collateral` function that §2 says does not exist, implemented in three calls with one accomplice. A clock bound is not a price, so this costs the FORBIDDEN lint nothing, and it gives a distressed borrower the mandatory statutory redemption period that the pawnbroker shape exists to provide.

**P-7 · Circularity refusal (defence in depth).**
`assign` refuses if the same unordered `{debtor, creditor}` pair has an assignment in the opposite direction within 2 epochs → `CircularAssignment`. Cheap, oracle-free, and it kills the round-trip pump even if P-3 is ever regressed.

**P-8 · Enforcement reads no caller clock.** See §3.2. `assign` takes no `now`; time comes from `SettlementAuthorization::earliest_witness()`.

**P-9 · The authorization proves an event, never its honesty.**
Both parties to a collusive default consent, so the evidence is genuine. This must be documented **at the type**, because all three input designs lean on `SettlementAuthorization` as if it were a fairness control. It is not. The honesty-preserving quantities are P-4, P-5, and P-6.

**P-10 · The lint is a tripwire, not a control.**
Extend `dependency::FORBIDDEN` (`:456-468`) with `"vest"`, `"vesting"`, `"unlock"`, `"schedule"`, `"entitlement"`, `"interest"`, `"apr"`, so the vesting curve cannot be imported into the crate that creates liens. But **stop treating it as a control** — its own designers documented the `quote_asset` → `advance_asset` bypass in three separate documents. The real controls are P-1 through P-8, none of which is evaded by renaming a field.

**P-11 · Delete the contradicting curve.** `RespectBook::unlock_rate` / `UnlockParams` (`b-token:244-272`) is linear, unbounded in R, and takes a caller-supplied params struct. Two contradicting unlock curves in one codebase is a latent authority conflict. Delete it; `RespectBook` gains `last_award_at` and `decayed_standing_of(who, now)` (20%/28-day epoch, cap 120) and nothing else. It gains **no** transfer entrypoint.

### 5.1 UI: what must and must not be displayed

The founder's goal — visible 420 as operant reward conditioning — is honoured, but the headline number must be true.

**MUST display, in this order of prominence:**
1. **`pledgeable_now(who, now)`** — the actual b that can be pledged today, in b. This is the headline credit number.
2. **`next_unlock_this_year`** — real, potent conditioning: ~44 b in year one is a large, true number.
3. **`pledge_duration_in_epochs(who, V, now)`** — *"you are pledging 6.2 b; that is 4.1 epochs of your current unlock rate."* Price-free, computed from mint history, and it is the **only** disclosure an untrained borrower can actually parse. An implied price-per-b is meaningless to someone who has never traded b.
4. **`collateral_assigned_out_of(who)`** and **remaining lifetime capacity** — "you have permanently lost X b to default; Y b of lifetime capacity remains."
5. **The counterparty's `collateral_assigned_in_of(L)`** — how much b this lender has taken by foreclosure, shown before the borrower accepts. This is the honest signal that the "no in-protocol adverse record" rule otherwise withholds from the market.
6. **On every default screen, in the borrower's own units:** "you will lose V b permanently and your borrowing capacity falls by V b for life."

**MUST NOT display:**
- 420 as a headline, a balance, a "Treasury", or anything adjacent to the borrow button. On day 1 the true pledgeable figure is ~0.00128 b — **420 is ~3.3×10⁵ times the borrowable number, at the moment of maximum vulnerability.**
- 420 in any exportable, screenshottable, or attestable form. 420 is identical for every human and publicly verifiable, which makes it a perfect *fake proof of assets* for an off-chain payday lender or a landlord. The protocol cannot police off-chain lending against a number it publishes, but it wholly controls which number it publishes.
- Any USD figure for a b holding. There is no oracle; a displayed dollar value would be a fabricated price and would become the anchor for every negotiation.
- Any framing of `surrender` as a discount, a settlement, or an early-payoff benefit. It is an early default and must be labelled as one.

**MAY display:** 420 as a de-emphasised lifetime figure **beside the year-by-year schedule**, so the curve and the number are read together. Never the number alone.

`ROOT_ENTITLEMENT` lives in `b-vesting` and is unquotable from `treasury-t0` (P-10).

---

## 6. Worked example

**Assumptions, stated so they can be checked:** `r_base = 10.5%`, `R = 120` (maximum bRespect, so `r_eff = 10.5%` — a *best case* for the borrower; lower R defers everything proportionally). `t` = whole years since first mint; `age_years = floor(t)`, so at `t = 1` the maturation percent is 20%. Collateral split 10/90. `MaturationParams::default()` = 10/10/80. No prior defaults.

### Vesting and capacity

| | **Year 1** | **Year 5** | **Year 20** |
|---|---|---|---|
| Treasury **visible** (entitlement, view only) | 420.00 b | 420.00 b | 420.00 b |
| Cumulative **unlocked** `420(1−0.895^t)` | 44.10 b | 178.81 b | 374.32 b |
| — spendable class (90%) | 39.69 b | 160.93 b | 336.89 b |
| — collateral class, `CMD` (10%) | **4.410 b** | **17.881 b** | **37.432 b** |
| `maturation_pct` | 20% | 60% | 80% (clamped) |
| `maturation_bound` | 0.882 b | 10.729 b | 29.946 b |
| `floor_bound` (80% of CMD) | 3.528 b | 14.305 b | 29.946 b |
| **Pledgeable now** (binding `min`) | **0.882 b** | **10.729 b** | **29.946 b** |
| Pledgeable as % of visible 420 | 0.21% | 2.55% | 7.13% |
| Max from **one** counterparty (P-5, 25% CMD) | 0.882 b | 4.470 b | 9.358 b |

At year 20 the two bounds coincide, because `ceiling_pct = 80` equals `100 − UNCOLLATERALIZABLE_FLOOR_PCT`. That is by construction and should be asserted.

### Max borrowable in an advance asset

The protocol does not know a price, so this table is **the lender's arithmetic, not the chain's**. Shown at two illustrative b valuations with a 35% pawn-style advance ratio (typical of NFTfi/Arcade/Gondi practice):

| | Year 1 (0.882 b) | Year 5 (10.729 b) | Year 20 (29.946 b) |
|---|---|---|---|
| lender values b at **$1**, advances 35% | **$0.31** | **$3.76** | **$10.48** |
| lender values b at **$10**, advances 35% | **$3.09** | **$37.55** | **$104.81** |
| single-counterparty ceiling at $10 | $3.09 | $15.65 | $32.75 |

**State this to the founder without softening it:** at any plausible early valuation, this facility does not produce rent money in year one. Time to first *whole* pledgeable b is ≈ **1.14 years**. That is not a failure of the design — the maturation ladder is doing exactly its ratified job — but it means the UI must never imply otherwise, and it means the b-denominated leg (§3.5) is the honest first product, not the stablecoin leg.

### What default costs

Assume the full pledgeable amount is pledged and defaulted.

| | Year 1 | Year 5 | Year 20 |
|---|---|---|---|
| b lost, permanently | 0.882 b | 10.729 b | 29.946 b |
| `assigned_out` after | 0.882 b | 10.729 b | 29.946 b |
| spendable class lost | **0** | **0** | **0** |
| bRespect / `r_eff` / 420 entitlement | **unchanged** | **unchanged** | **unchanged** |
| deficiency, collection, adverse rate | **none** | **none** | **none** |
| pledgeable 5 years later | 1.63 b (t=2) → 4.62 b (t=6) | 11.79 b (t=10) | 2.45 b (t=30) |
| lifetime capacity consumed | 2.6% | 31.9% | **89.1%** |

Lifetime collateral class asymptotes to **42 b** (10% of 420); lifetime *assignable* ceiling is 80% of that = **33.6 b**. So:

> **The maximum any person can lose to this entire lending layer, across an entire life, is 33.6 b — 8.0% of their 420 entitlement.** 386.4 b is structurally unreachable by any lender on any path.

That is the number the design exists to produce, and it holds only with P-3 (nothing added outside the `min`) and P-4 (monotone `assigned_out`) both shipped.

---

## 7. The borrower's worst case

Stated plainly. People can still be harmed here, and here is exactly how much.

**7.1 A year-20 borrower can lose 89% of their remaining lifetime borrowing capacity in a single default.** 29.95 b gone, and because the collateral class asymptotes at 42 b, ten more years of vesting restores only 2.45 b of capacity. There is no forgiveness path and no way to rebuild faster than the body vests. This is deliberate — it is what makes the loss monotone and kills the reset loop — but for the individual it is a one-shot, effectively permanent foreclosure of credit access.

**7.2 A single loan can still be grossly unfair, and the protocol cannot prevent it.** With no oracle and no surplus return (§3.4), a lender can advance $12 against 6 b that they privately value at $60, set the redemption at $18 over 30 days, and take the b at maturity. The protocol sees only b quantities and a clock. Nothing in this spec makes that trade fair; P-4, P-5, and P-6 only ensure it can happen once per counterparty per quarter-of-CMD, with a 28-day redemption window, and that the lifetime total is bounded at 33.6 b. **"Competition discovers the price" is false at genesis**, when there is exactly one lender, and I do not rely on it.

**7.3 The person in acute need is still the profitable customer.** The 5x construction only works on someone who will accept $12 for $60 of collateral, and only someone who needs $12 today accepts that. This is a property of lending against illiquid collateral, not of this implementation. Bounding it is the best I can do; eliminating it would require either a price feed (banned) or a rate cap denominated in something the chain can measure (it cannot — the advance never enters the chain).

**7.4 The off-chain leg is entirely outside every invariant here.** A landlord or payday lender who takes a screenshot of a BNR balance as security is not bound by `assert_no_b_custody`, `RootDid`, or anything else. This is the strongest argument for the §5.1 display rules: the only lever the protocol has over off-chain predation is which number it makes screenshottable.

**7.5 Withheld cooperation on repayment.** `release` requires a `SettlementAuthorization`, assembled in practice by the creditor. A creditor can take repayment off-ledger, never assemble the evidence, and let the clock run. `surrender` (§4.2) means the borrower is never *trapped* — they can always close the lien unilaterally — but closing it by surrender costs them the collateral. **A borrower who has genuinely repaid can still lose the b if the creditor stonewalls and the borrower cannot produce two independent Settlement-grade attestations of payment.** Mitigation is procedural, not structural: the UI must instruct borrowers to repay through a channel that produces independent evidence, and must warn that off-ledger cash repayment is unenforceable. I could not close this in-protocol, because the protocol has no custody of the advance asset and therefore cannot witness its movement.

**7.6 Conservatism note.** Where uncertain I have chosen the tighter bound: `PER_COUNTERPARTY_PCT = 25` rather than the 80% floor-bound version proposed in review; `MIN_TERM_SECS` and `MIN_REDEMPTION_SECS` both a full epoch; `assigned_out` subtracted from the cap rather than merely disclosed. Each of these can be loosened later with evidence. None of them can be tightened later without breaking outstanding liens.

---

## 8. Build order

All build/test/commit runs happen in WSL (Windows AC blocks fresh exes and Git's `sh.exe`); each phase ends in `cargo test -p <crate>` passing offline with no network and no new dependency.

**Phase 0 — Harden what exists. No new features.**
`b-token`: split `mint` into `enrol` + `mint_due`; `first_minted_at` write-once (P-1). Delete `unlock_rate`/`UnlockParams` (P-11). Add `last_award_at` + `decayed_standing_of` to `RespectBook`.
*Ends in:* `first_minted_at_is_write_once`, `enrol_refuses_twice`, `respect_decays_20pct_per_epoch_capped_at_120`.

**Phase 1 — `b-vesting`, pure arithmetic, no ledger.**
New crate depending on nothing (`treasury-t0` must **not** depend on it — P-10 enforces). `unlocked_at(first_mint, R, now) -> Amount` in integer fixed point; `ROOT_ENTITLEMENT = 420e18`; `entitlement_view()`.
*Ends in:* property tests — monotone non-decreasing in `now`, never exceeds `ROOT_ENTITLEMENT`, reproduces 44.10 / 83.57 / 178.81 / 374.32 at t = 1/2/5/20 within rounding, half-life 6.2 yr, ≥98.9% at t = 41, and identical curve shape at r/2 (the lifespan-invariance property).

**Phase 2 — The vesting ceiling inside `BLedger`.**
`VestingParams` as a ledger field via `BLedger::with_vesting`; ceiling checked in `mint_due` before the verifier (P-2).
*Ends in:* `mint_refuses_above_vested_ceiling_with_an_always_true_verifier`, `no_ledger_entry_ever_equals_420e18`.

**Phase 3 — The two balance classes.**
`collateral`, `collateral_reserved`, `collateral_minted_to_date`, `collateral_assigned_out`, `collateral_assigned_in` on `BLedger`; readers; `mint_collateral_due` (10%) and `mint_due` (90%); `reserve_collateral` / `unreserve_collateral`; `burn_collateral`. **No `assign_collateral` yet, and no COLLATERAL→SPENDABLE function ever.**
*Ends in:* `collateral_b_cannot_be_transferred_or_burned_by_any_path` (cross-crate, mirroring `treasury-t0:904-919`), `spendable_and_collateral_classes_never_mix`, `every_existing_b_token_test_passes_unchanged`.

**Phase 4 — `RootDid`, purpose fork, and `assign`.**
`RootRegistry` as owned chain state; `RootDid`; `LienPurpose`; `Lien` new fields; `LienStatus::Assigned`; `lock` repointed to `reserve_collateral` with `MIN_TERM_SECS`/`MIN_REDEMPTION_SECS`; `assign_collateral` in `b-token`; `LienBook::assign`; `forfeit` gated to `Bond | CommonsAdvance`; `Evidence.witnessed_at` + `SettlementAuthorization::earliest_witness()`; `assign` takes no `now`.
*Ends in:* `forfeit_refuses_an_advance_and_assign_refuses_a_bond`; `assign_moves_b_to_the_creditor_root_and_no_contract_ever_holds_b`; `assign_refuses_a_non_root_creditor`; `assign_cannot_fire_before_redeemable_until_even_with_a_forged_now`; `c_ii_forfeit_burns_exactly_and_deflates` still green verbatim.

**Phase 5 — The anti-predation bounds.**
`collateral_assigned_out` subtracted in `collateral_cap` (P-4); `assigned_from_to` + `PER_COUNTERPARTY_PCT` (P-5); `surrender` (no auth); `CircularAssignment` (P-7); `dependency::FORBIDDEN` extended (P-10).
*Ends in:* `lifetime_assigned_out_never_exceeds_min_floor_maturation` (the reset-loop regression); `cap_is_a_pure_function_of_cmd_first_mint_and_now`; `creditor_bounds_are_byte_identical_after_N_assignments_in_their_favour`; `creditor_cannot_block_redemption`; `release_does_not_increment_assigned_out`; the oracle lint self-scan (`:980-999`) still clean.

**Phase 6 — Disclosure surface.**
`pledgeable_now`, `pledge_duration_in_epochs`, `collateral_assigned_in_of` as public view functions every front-end must call. UI contract tests asserting 420 never appears as a headline and no USD figure is derived on-chain.
*Ends in:* a headless snapshot test of the borrow screen's numeric fields.

**Phase 7 — The b-denominated advance, end to end.** Borrow b, repay more b, collateral-b pledged. No external asset, no stablecoin, no issuer.
*Ends in:* a full-lifecycle integration test reproducing the §6 year-1 / year-5 / year-20 tables exactly.

**Phase 8 — External asset leg. Gated; does not open until Phases 0–7 are all green.** The advance asset is named only off-chain (`advance_asset`), chosen per loan by the lender, recorded in the `SettlementAuthorization` evidence, and never read by `treasury-t0`. Consumer-credit duties (CCD2, applicable 20 Nov 2026, no lower threshold, mandatory 14-day withdrawal right and member-state APR caps; UK CONC 0.8%/day and 100%-of-principal caps; US TILA/Reg Z and MLA 36% MAPR) attach to the **creditor and to any front-end that presents or assists in concluding the agreement** — the hosted UI is the exposed legal object, not the crate. Legal review is a gate on this phase, not a follow-up.
