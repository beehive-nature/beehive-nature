<!--
STATUS: ADOPTED 2026-07-28 — graduated from the docs/findings/ one-door staging pen on
founder authorization ("Lets graduate these gates", 2026-07-28 05:43), per the
.gitignore one-door convention and the precedent set by docs/architecture/did-autonomi-spec.md.

WHAT IS ADOPTED: the earned-emission RULE and the anti-capture invariants TE-1…TE-7,
verbatim and unchanged by this graduation. Closes the citation-vs-status gap in which
tracked files (feature-backlog.md:520 "the frozen tokenomics", and the TE-1..TE-7 gates
at :649, :746, :939) cited an un-graduated draft as binding law.

WHAT REMAINS OPEN — adoption of the rule is NOT adoption of the numbers:
  · All six items under "Open decisions for Dispatch" below, notably the curve
    parameters (early multiplier, taper/half-life, perpetual floor), which per C1 are
    set and amended ONLY at the Article VI meta-tier.
  · The ⚠ DEFERRED adversarial ResourceProof analysis. The spec's own words stand:
    "the invariants are a locked door; the ResourceProofs are the wall" — until that
    analysis is written, TE-3's strength is UNPROVEN for those classes.
  · Reconciliation with dockets/B_EMISSION_operant_reward_model.md (committed 564a6bb,
    2026-07-16), whose "PoUL vesting gate" / "held (unvested)" language sits in
    unresolved tension with TE-5. Two documents disagree; scheduled as its own docket.
  · U-11 (CD-29-resource-paymaster-spec.md:1499) — SPIRIT-1's "420 per soul, lifetime
    unlock" remains UNVERIFIED as an in-repo definition.

CONSEQUENCE OF ADOPTION, stated plainly: TE-1 (genesis == 0), TE-2 (zero allocation) and
TE-5 (no vesting/unlock) are now binding law rather than draft prose. Any genesis grant,
premine, founder/treasury allocation or unlock schedule therefore requires a formal
Article VI meta-tier amendment — the price F-Q1 already named on 2026-07-08 when option
(a) was ruled and option (b) declined.

Application-layer: per CONSTITUTION Art. VII §6 "rewards policy" is NOT in the
kernel — this spec is incentive design ABOVE the kernel and changes no invariant.
Retires: the open "bToken tokenomics" item (brief §L5) — fixes the emission RULE; the
token contract itself stays a replaceable reference implementation (Art. V §4, VI §4).
Step-zero: read CONSTITUTION.md (Art. V, VII §6, Appendix `resource.accounting`),
bnature-build-brief.md §L5, feature-backlog.md. NOT financial or investment advice.

CHANGELOG v1 → v1.1 (folded from GLM audit): F5 label fix (R-004 is a *design*
requirement, not an implemented boundary); TE-3 expanded (proof-validation is itself a
governed mint-control surface); added mint-rate bounding, burn-atomicity, bootstrap-in-
native; added **TE-6 (anti self-dealing / wash-provision)**; supply stability flagged as
an OPEN economic question; per-proof forgery analysis added as a DEFERRED stub (§Adversarial). v1.1→v1.2: added **TE-7** (burn-skip is a distinct inflation vector from unproven mint — GLM audit). v1.2→v1.3: replaced the "founder-reward question" with a **front-loaded operant emission curve** (founder decision: form (a), genesis-zero — founder earns as earliest large provider under the uniform curve); curve-shape changes governed at the Article VI meta-tier (C1); perpetual floor is demand-linked (C2), which **structurally closes the no-demand inflation vector** (the rate-imbalance question stays open by design); curve modifies rate-per-proof only, so TE-1…TE-7 hold. v1.3→v1.4: per GLM audit Point 3, downgraded "structurally resolves supply-stability" to the no-demand vector only, and named the front-load mint-vs-burn rate-imbalance as open-by-design (Open decisions §2).
-->

# bToken (bSAFE) — Earned-Emission Tokenomics (v1.4 draft)

**One sentence:** bToken supply is a **pure function of provably-provided resource** —
minted only against a cryptographic proof that a resource was delivered to a paying
counterparty, burned when a resource is consumed. **Zero premine. Zero founder/team/
investor allocation. Genesis supply = 0.**

## What bToken is (and is not)
- **Is:** the `resource.accounting` unit — "metabolic energy" (Art. V §4). It meters the
  network's real resource metabolism: Vaulta RAM/CPU/NET, ZANO gas, Arweave (AR), Autonomi
  (ANT), served indexing/compute. Users hold b; the paymaster holds the native-resource
  basket and swaps as needed (brief §L5).
- **Is not:** a stablecoin, a security, or an investment. Its worth is exactly the cost of
  the resources it commands — nothing is promised to appreciate. **"fUSD is what people pay
  each other; b is what the machine consumes."**

## The rule: supply = Σ(proven provision) − Σ(consumption)

### Mint — only against a `ResourceProof`, and only for external demand
Every mint carries a cryptographic proof that a specific resource was actually provided
**to a distinct paying counterparty**. No proof → no mint; no external consumer → no mint.
There is **no discretionary, admin, or founder mint path.**

| Resource class | What must be proven | Proof primitive (gated — named, not faked) |
|---|---|---|
| `storage.sovereign` (Autonomi) | data stored **and retrievable** for the paid interval | proof-of-storage / proof-of-retrievability |
| `event.runtime` (b-indexer) | a `CanonicalEvent` was indexed **and served** | served-query attestation — **design requirement: N-of-M independent attesters** (tracks risk R-004; **not yet an implemented boundary** — a design constraint, not existing code) |
| compute | a requested unit was **verifiably** performed | verifiable-computation / attested-execution receipt |

Until a class has a real proof primitive on its network, it **cannot mint** — it sits
behind the named gate, like the firmware-track crypto in the kernel. A "temporary trusted
mint" is prohibited: absence of proof is absence of mint, never a bypass.

### Burn — atomic with consumption (structural, not policy)
Consuming a native resource **burns** the corresponding b, and the burn is **atomic with
the settlement of that consumption** — not a separate policy step that can be skipped or
deferred. If burn could be skipped, supply would only ever grow; so burn-on-consume is a
structural invariant of the token contract, not an operator convention. The paymaster
**abstracts** user-funded consumption and **never absorbs** it (Art. V §1) — so every burn
maps to real user demand, never to operator subsidy.

### Rate — bounded by verifiable capacity, not just by proof count
Mint is bounded not only by "has a proof" but by **provable capacity**: per-epoch minting
for a provider cannot exceed the resource they can prove they actually hold/served in that
epoch. Unbounded mint by a set of colluding providers is an **inflation attack that needs
no premine** (TE-6); the rate bound + the external-demand requirement are its defense.

## Anti-capture invariants (testable — GLM's audit surface)
Predicates an auditor verifies against the deployed contract, not prose to trust:

- **TE-1 — Zero premine.** Genesis total supply == 0. *(Assert on genesis state.)*
- **TE-2 — Zero allocation.** No address ever receives b except via a `ResourceProof` mint
  or transfer of already-earned b. No `team`/`treasury`/`investor`/`founder`/`reserve`
  balance is created by privilege, ever.
- **TE-3 — No unproven mint path, AND proof-validation is governed.** Every `mint` consumes
  a valid `ResourceProof`; there is **no** admin/owner/pause/migration/upgrade path that
  mints without one. **Critically:** *who defines a valid proof* is itself a mint-control
  surface — if proof-validation logic is upgradeable, that upgrade must be governed at the
  **Article VI meta-tier** (`K_meta`), because "redefine what counts as proof" == "mint at
  will." An ungoverned upgradeable verifier is a premine hiding behind a trait boundary.
- **TE-4 — No privileged minter.** Permissionless-conditional-on-proof; no key/role holds
  exclusive or discretionary mint authority.
- **TE-5 — No vesting/unlock.** Nothing to vest — supply is earned, not scheduled. Any
  "unlock schedule" is a TE-1/TE-2 violation by definition.
- **TE-6 — No self-dealing / wash-provision.** A mint requires provision to a **distinct,
  paying counterparty**; the provider and the consumer of a given resource unit **cannot be
  the same actor** (nor a Sybil cluster round-tripping). Storing your own garbage, indexing
  your own events, or a consume↔re-provide loop is **counterfeit metabolism** — not a
  premine, but the way these systems actually get gamed (Filecoin's early fake-storage
  precedent). Enforcement: burn (demand) and mint (supply) for one unit must resolve to
  **different economic parties**, verifiable on-chain.
- **TE-7 — Burn cannot be skipped.** No upgrade, admin, pause, or migration path can disable, defer, or make conditional the burn-on-consume enforcement. TE-3 gates the *mint* door; TE-7 gates the *burn* door — a burn-skip lets supply grow by **failing to subtract**, a distinct inflation vector that requires no unproven mint. Burn is structural in the same sense TE-3 makes mint structural: not a policy any role can skip. (Live risk during the centralized-paymaster bootstrap window, where the operator may hold contract-upgrade privileges — so burn-skip immunity must hold **before** that window opens, not be promised after it.)

**Where a hidden premine/inflation would hide (map for the auditor):** genesis/constructor
state; any `initialMint`/`_mint(owner,…)`; an "ecosystem/treasury/marketing" allocation; an
upgradeable-proxy admin that can mint **or that can redefine proof-validation** (TE-3); a
"bootstrap reward" that isn't proof-gated; a self-provision loop (TE-6); a **burn-skip / disable-burn upgrade** (TE-7); a fee that silently
accrues to a founder address. Each is a violation, not a feature. Flag on sight.

## ⚠ Adversarial ResourceProof analysis — DEFERRED (open, and load-bearing)
TE-3 is only as strong as the proofs it gates on: **the invariants are a locked door; the
ResourceProofs are the wall.** Each proof type has a known attack class that needs its own
"here's how you'd forge it / here's what prevents it" section — **not yet written:**
1. **Proof-of-retrievability (storage)** — replay and outsourcing attacks; needs
   challenge freshness + provider-binding.
2. **Served-query attestation (indexing)** — self-attestation (run the N attesters
   yourself); needs attester independence (ties TE-6 + R-004's N-of-M).
3. **Compute receipt** — counterfeit if the verifier is gameable; needs a verifiable-
   computation scheme, not a trusted asserter.
This is real cryptographic design work and is the deepest remaining gap. It is flagged, not
faked (see §Sequencing question at the end). Until written, treat TE-3's strength as
**unproven for these classes.**

## Emission curve — front-loaded operant reinforcement (shape + governance; values are Dispatch's)

The earned-emission RULE (mint-on-proof-to-external-demand, burn-on-consume, TE-1…TE-7)
governs *whether* a unit may mint. The **emission curve** governs *how much* b a valid
`ResourceProof` mints — and that rate is **not flat over time.** It is deliberately
**front-loaded**: a given unit of proven provision mints **dramatically more b early in the
network's life than the identical unit mints later**, decaying toward a **low perpetual
emission** that never reaches zero.

**Shape.** Monotonically decreasing reward-per-proof, from a high early multiplier to a low
asymptotic floor. The exact family (exponential decay, hyperbolic, stepped "halving") is a
Dispatch decision; the *shape commitment* is fixed: **high early, smoothly tapering, strictly
positive forever.** (Bitcoin's halving is a crude discrete instance of this idea; a smooth
curve is the refined form.)

**Rationale — reinforcement, not giveaway.** This is an **operant reinforcement schedule**
for network-growth behavior. When the network is small it most needs providers to show up —
run an indexer, store sovereign data, contribute compute — so reinforcement is strongest
exactly when the behavior is scarcest and the marginal provider matters most. As provision
becomes common the per-proof reward tapers, because the behavior no longer needs heavy
reinforcement to sustain it. The **low perpetual floor carries the reward mechanism into
future generations** rather than exhausting it on the first cohort: a provider who joins in
year fifty is still rewarded, just not at bootstrap rates.

**Values are deferred, exactly like the Article VI K-values.** This section fixes the *shape
and its governance*, not the numbers. The early multiplier, the taper rate / half-life, and
the perpetual-floor level are **Dispatch decisions** (Open decisions §): front-load too hard
and early provision is over-rewarded relative to real value; too soft and the bootstrap
incentive never fires. **Shape and governance now; values later.**

### Founder reward is a consequence of the curve, never a clause
The founder is, verifiably, the **earliest and largest provider**: the entire codebase was
authored under the DCO, and the founding bootstrap infrastructure is his provision. Under a
front-loaded earned curve the earliest large provider **legitimately earns an outsized
share — because his early provision is outsized and provable on-chain**, not because any
token was set aside. **The curve applies identically to every provider; the founder gets no
special path, no allocation, and genesis stays zero (TE-1/TE-2 hold).** The founder's stake
is therefore *the proof of the system's fairness* — a reward anyone can trace to real early
work on the ledger — rather than an exception carved out of it. This replaces the former
"founder-reward question": the recorded decision is **form (a) — genesis-zero, founder earns
via the front-loaded curve.**

### Two binding constraints (requirements, not footnotes)
- **C1 — Curve-parameter governance (Article VI meta-tier).** Any change to curve shape —
  front-load rate, taper / half-life, floor level — routes through the **Article VI meta-tier
  (`K_meta`)**, identically to proof-validation under TE-3. **"Redefine the emission rate" is
  the same mint-control power as "redefine what counts as proof":** both let an actor mint
  more b with no new provision. An **ungoverned upgradeable curve is a premine hiding behind a
  trait boundary** — the emission schedule is as much a governed constant as the
  proof-validation logic, and lives at the same tier.
- **C2 — Demand-linked perpetual emission (no metabolism-free floor).** The perpetual floor
  persists the **mechanism**, not a stream of free tokens: it is a floor on the
  **reward-rate-for-genuine-provision**, and **never mints in the absence of a valid
  `ResourceProof` to a real external consumer.** In the spec's own metaphor — **a
  metabolism-free emission floor is the organism consuming itself**; b minted without
  provision is counterfeit metabolism at the protocol's own hand. If no one provisions in an
  epoch, the floor mints **nothing**. That is what makes the floor safe forever: it can never
  become a stealth inflation tap.

**This structurally closes the no-demand inflation vector:** emission cannot occur without a paying consumer — no external consumer → no mint, curve or no curve, the floor
included. That half is answered not by an equilibrium argument to be *trusted* but by a
**structural** one to be *checked*, the same move TE-1…TE-7 make for the invariants.
**The rate-imbalance question remains open by design:** during the front-load period the mint
per provision *exceeds* the burn per payment, so supply **grows** even though every mint is
demand-paired — that growth is the reinforcement schedule working as intended, not a bug.
Whether and when the taper brings mint-rate toward burn-rate is an **open economic question
for parameter-setting** (Open decisions §2), not a structural guarantee — named here as open,
not claimed as resolved.

### Invariant preservation (verified)
The curve modifies **rate per proof**, never **whether a proof is required.** Every mint — at
the high early multiplier or at the low perpetual floor — still consumes a valid
`ResourceProof` for provision to a distinct paying counterparty. Therefore **TE-1 through TE-7
hold unchanged:** genesis still zero (TE-1); no privileged allocation (TE-2); no unproven mint
path and proof-validation still governed (TE-3); no privileged minter (TE-4); nothing
vested/scheduled — **a rate schedule is not an unlock schedule**, because it releases nothing
that wasn't earned by provision at that moment (TE-5); no self-dealing (TE-6); no burn-skip
(TE-7). The curve is a **coefficient on an already-gated mint**, not a new mint path.

## Bootstrap ≠ premine (paid in native, never in b)
Art. V §1 permits "bootstrap seeds" as an acceptable operator **cost**; §2 makes bootstrap
temporary. A bootstrap seed is paid in **native tokens / fiat the operator funds** — it is
**never a bToken balance** and creates **no** genesis b. The paymaster/relayer may be
centralized during bootstrap ("start centralized, decentralize later"), **but minting stays
proof-gated even then**, and the front-loaded curve is **not** a bootstrap seed — it mints
only against real proofs. If bootstrap ever issued b without a `ResourceProof`, it would be
"a premine wearing a bootstrap label."

## Replaceability
The **earned-emission rule + the curve's shape and governance** (mint-on-proof-to-external-
demand, burn-on-consume, front-loaded-tapering-to-a-demand-linked-floor, zero-premine,
TE-1…TE-7) are the durable commitment. The specific b-token contract and the specific curve
*parameters* are **reference implementations / governed constants** (Art. V §4, VI §4),
changeable — the parameters only via the C1 meta-tier — provided the rule and the shape hold.

## Open decisions for Dispatch
1. **Founder-reward form — RESOLVED: form (a).** Genesis-zero; the founder earns via the
   front-loaded curve as the earliest large provider. No allocation; no governed grant.
2. **Curve parameters** — early multiplier, taper / half-life, perpetual-floor level (per C1:
   set at, and amended only through, the Article VI meta-tier).
3. **Proof primitive + its adversarial analysis** per class (the DEFERRED §above) — gated on
   the real Autonomi / Vaulta / compute proof surfaces; named, not faked.
4. **Burn coupling** — burn 1:1 with native cost, or buffered against basket swap-slippage?
5. **Code-contribution as a mint class? (optional)** — if committers should mint, make it a
   governed, transparent, proof-gated reward class at the Article VI meta-tier, applying to
   **every** contributor under one rule (founder included). Still no premine, still no special
   founder path. Defer unless wanted.
6. **Proof-validation & curve governance** — confirm both sit at the Article VI meta-tier
   (TE-3 + C1).

_Not financial/investment advice. An engineering + governance spec for review; the token is an
accounting unit for consumption, not a claim on value._
