# Feature backlog — vision quarantine zone

**ORIENTATION ONLY. Nothing in this file is an implementation target.**
These are far-horizon features, each already routed to its architectural
home so scope questions have answers. Per the constitution: do not build
generic abstractions for any of these until a second concrete use case
proves them, and do not let them enter a coding session. If an execution
session drifts toward one of these, the scope-defense phrase applies:
*"That is out of scope. Execute the prompt as written."*

| Feature | Routed to | Key design note |
|---|---|---|
| Nymi band / biometric auth | **L0 `identity.biometric`** (Attestor adapter) | Heartbeat unlocks a secure element *on the band*; the element signs challenges. Raw ECG never leaves the device — to the kernel it is just another attestor tier, like Trezor or a passkey. |
| Steem / Hive blog bridge | **L4 `social.feed`** (sense + action adapter) | Ingests Hive posts as `CanonicalEvent`s; broadcasts via an action adapter. Entirely outside the kernel. |
| AR glasses + bLoveRai AI + festivals | **L5 `intent.planner`** (AI) + **L0 `sense.ambient`** (AR) | Consent handled by the reserved **Capability** primitive: a scoped, expiring `CapabilityGrant` (e.g. "access my data and broadcast via AR until Sunday midnight"). Kernel enforces the boundary; the AI acts within it. |
| Anonymous longevity study | **L4 `knowledge.medical`** | Encrypted biometrics on Autonomi; access granted to a research DAO via threshold encryption / ZK proofs; contributors earn bToken for verified data. |
| Lovernment governance (7 humans + AGI) | **L4 `coordination.governance`** | Vaulta is the execution engine; the "prime ministers" and "Queen Bee" are high-threshold multisig signers. The kernel sees only Identity + Capability + Settlement — it never learns what a Prime Minister is. |
| BCH (or BTC) as redundant public-data anchor | **L3-adjacent `permanence.anchor` (second adapter)** | **Rejected as a database** (10-min latency, UTXO query model — wrong tool for an event bus; the b-indexer is a rebuildable derived view anyway, since every chain-sourced CanonicalEvent carries `source_chain`+`source_ref` and `normalize()` is pure). **Plausible as a redundant anchor**: the daily bundle hash (~32 bytes, public by nature) in an `OP_RETURN`, planted beside the Arweave/Zano anchors to diversify long-horizon survival across an older, unlike ledger lineage. At millennium scale nothing digital is proven — multi-substrate redundancy is the only honest strategy; BTC is the stronger flavor of the same bet (higher fee, majority fork), and at one tx/day both are affordable. Caveat: `OP_RETURN` durability rides on archival-node culture, not the UTXO set. Pure adapter addition per the constitution — zero kernel change. Builds after the Arweave bundling process exists at all. |
| Fractal consensus game (peer-ranking breakouts, Respect levels) | **L5 application** + one kernel touchpoint: a future `Provenance::PeerConsensus` (proposed weight **0.80** — above `AiInference` 0.60 because structured human consensus, below hardware/chain proofs because a small group can still be socially engineered) | Two bite-later notes recorded with the routing: **(1)** the randomized small-group assignment is the real Sybil/collusion defense and it lives in the L5 app — `reputation-engine`'s dedup only stops one attester voting many times, and does nothing against a coordinated ring of distinct DIDs ranking each other; the 0.80 weight must not lull anyone into thinking the kernel handles collusion. **(2)** when `reputation-engine` v2 promotes `weight` to an active multiplier, `compute` stays deterministic and re-derives weight from evidence each run — never store a member's Respect level as an input and multiply by it, or the "written score" the Reputation invariant forbids sneaks back in. Hierarchy falls out of recomputation, never gets fed in. |
| Affect / emotion inference (biometric → stress/affect estimate) | **L5 `interpretation.affect`** — a sense-derived Evidence producer — gated by the reserved **Capability** primitive | **Cross-cutting privacy invariant (not affect-specific): the system acts on the *minimum-sufficient derived inference*, and the raw signal never leaves the user's vault.** Derivation is *itself* the sensitive operation (whoever computes the estimate touches the raw signal), so it runs under a scoped, revocable `CapabilityGrant` — "this model may read my HRV + tone to produce a stress estimate, expiring in 30d" — never ambient permission. The derived class carries **provenance** (source class + method + confidence) but **not** the source signal: a consumer can weight the inference, never reconstruct the heartbeat. *"A system should be able to help you without being able to see you."* **NB (F5 discipline):** the "evidence-vault / threshold-encryption" this would reuse is **spec-stage, not built** — `dispute-engine` today is pure adjudication logic with an `EvidenceProvider` trait seam and nothing behind it; the reuse is of the *pattern*, not existing infrastructure. Promoting the invariant into the constitution's Evidence article is an **Article VI amendment** (founder decision, not builder action). Possibly the **third independent sighting** of the Capability primitive (grant-scoped derivation) — watch for promotion. |

## Captured designs — 2026-07-04 session (ALL DEFERRED; captured, not build targets)

Same quarantine rules as the table above: **orientation only, none is an implementation
target**, and the scope-defense phrase applies. Several extend existing rows (noted inline).

**CD-1 — bLoveRai: bounded, consent-governed affect companion** *(extends the AR-glasses /
bLoveRai row and the affect-inference row).* L4/L5. Acts on **provenance-weighted affect
inferences**, always **tentative / confidence-proportional**; runs under a **revocable
`CapabilityGrant`**; **help-without-seeing** — acts on the inference, the raw signal never
leaves the vault. Optimizes the **human's own stated goals**, never a fixed external score
(Art. VII — no protocol-imposed objective). **Reward couples to authorized valued *service*,
never to health outcomes or biomarkers** — decoupled by design to defeat reward-hacking /
Goodhart. **Gate:** needs the affect layer, which needs a *second concrete use case* before
any generic build (standing rule). **RULING 2026-07-07:** instrument name founder-ruled
"bLoveRai stock." Reward axes: operant conditioning, network effect, velocity of value
(cross-ref TE spec). Jurisdiction review scope EXTENDED to instrument characterization.

**CD-2 — Cross-cutting privacy invariant** *(candidate future Article VI amendment — NOT
added now).* Proposed text: *"A system helps by acting on the inference and cannot see you
because the raw signal never leaves the vault; derivation is capability-gated; the derived
class carries provenance but not source."* This generalizes the row-20 invariant beyond
affect. Promotion into the Evidence article is a **founder Article VI decision, not a builder
action.** Reinforces the Capability-primitive third-sighting watch.

**CD-3 — New earn-classes: education / courses, curated content, DAO arbitration.** Each as
**proof-gated provision under the existing earned-emission rule** — the platform rewards the
**verified action** (course completion, arbitration served) and **stays neutral on content
truth.** Courses and content are **community plugins (Art. VII); the protocol never endorses
medical or health claims.** **Sybil-load-bearing:** faking the *action* must be made as
costly as faking *infrastructure* — cheap fake actions are the threat, so these classes
cannot ship until the action-proof is as hard to forge as a ResourceProof (ties CD-7 + TE-6).

**CD-4 — LOVErnment DAO emission-split** *(extends the Lovernment-governance row).* A governed
**protocol-fee slice of emission** to a treasury funding human market-arbitration. **MUST be
Article VI meta-tier governed AND proof-gated — or it is a premine wearing a governance
robe** (same test as tokenomics C1 and the founder-reward bar). **Dispatch decision,
deferred.**

**CD-5 — Health biomarkers (telomerase / TERT etc.) — BARRED as a reward trigger** *(extends
the longevity-study row; captured with its bar intact).* Biomarkers are **user-owned Evidence
in the vault + an optional interpretation-plugin metric only** — **NEVER a token-reward
trigger, NEVER kernel-asserted.** **Safety flag, recorded so it cannot be quietly undone:**
the notion of "low-cost, high-confidence life-expectancy via serum telomerase" is
**UNVERIFIED**, and **TERT upregulation is cancer-associated** — so **rewarding biomarker
movement is a people-risk and is barred.** The protocol rewards authorized service, never a
body measurement. *This entry exists to keep the door shut, not to open it.*

**CD-6 — Docs-framing note (metaphor only, NOT a kernel primitive).** In *documentation*, b
may be described as the system's **reinforcement signal** — a dopamine/serotonin metaphor: it
allocates attention toward proven-valuable behavior. It stays **un-addictive by construction**
because reinforcement is welded to **real provision** via **TE-6 (no self-dealing) + C2
(demand-linked emission)** — the signal cannot be farmed without genuinely providing.
**Reader-facing metaphor only; introduces no kernel concept.**

**CD-7 — Cross-cutting dispatch (named, deferred): attester independence + minimum N.** The
"N-of-M independent attesters" requirement now recurs in **R-004** (poisoned-oracle),
**tokenomics** (the served-query attestation gate), and **CD-3** (action-based earning). It
has earned its **own future task**: define what *independence* means (no shared node
infrastructure, no shared operator, Sybil-resistant identity) and set a **minimum N**.
Deferred, but tracked as a first-class cross-cutting item, not a footnote.

**CD-8 — Public API surface — CAPTURED, NOT SCHEDULED** *(the `api` crate deferred out of the
2026-07-05 demo sprint — no net-new architecture under demo pressure; the demo proved the
lifecycle runs headless through the engines + bus with zero API).* A query (and possibly
command) surface over the runtime, to be **decided deliberately by the founder, never
scaffolded reflexively.** **Open contract questions — all founder-decided before any
scaffolding:** **(1) transport** — HTTP/REST, gRPC, WebSocket, or a local IPC seam? **(2)
exposed operations** — read-only projections of escrow/order/reputation state, or also command
intake (submit intent, attach evidence)? **(3) bus events consumed** — which `CanonicalEvent`
families the surface subscribes to / projects (Order, Dispute, Reputation, …)? **(4) authn
posture** — anonymous read, DID-authenticated, or capability-gated writes (ties the reserved
Capability primitive)? **Status: captured, not scheduled; requires a founder contract before
any scaffolding.** Per Art. III an API is an **additive consumer of bus facts, never a
prerequisite** — consumers subscribe, they never gate the kernel. *(Numbering note: the
dispatch called this "CD-9"; the committed file runs CD-1…CD-7, so this is CD-8 — flag if a
CD-8 was intended elsewhere.)*

**CD-9 — Tiered dispute-resolution pricing ("bSAFE") — CAPTURED, NOT SCHEDULED.** A
pricing layer over the dispute lane (`dispute-engine` verdict → DRO settlement). **Elective
escalation is priced at a premium** — a party may *buy up* to a higher review tier (more or
more-independent adjudicators, deeper evidence review) as a paid, opt-in service. **System-
mandated review is NOT a taxable event:** where the protocol *itself* compels a human look —
every `Split` verdict and every `UserClaim`-driven escalation, i.e. exactly the `auto_enforce
= false` path the demo's 2b case traces — the party is **never charged for a review they did
not elect.** Paying only for what you *choose*, never for what the protocol *compels*, keeps
the fee off the fairness-critical path (a mandated review that costs money would let the
protocol profit from its own escalations — barred here by construction). **Open mechanism
question (founder-decided, NOT resolved here): who pays for an elective escalation?**
Candidates — **loser-pays** (escalator refunded iff the higher tier moves the verdict their
way) and **bonded appeals** (escalation posts a bond, forfeited if the appeal fails); both
must resist **griefing** (endless paid appeals to exhaust the process) and **capture** (a
richer party paying to bleed a poorer counterparty). **Routes through the TE invariants and
Article VI:** any fee slice is subject to **TE-6 (no self-dealing)** + demand-linkage — a
review fee is earned service, never a rent — and because it introduces a protocol-level
charge, its existence and rate are an **Article VI meta-tier governance decision** (same bar
as the tokenomics emission-split and CD-4: an ungoverned, un-proof-gated fee is a rent
wearing a service robe). **Motivation (why it earns capture at all):** high-value **cross-
language commodity adjudication** — oil-class resource trades across jurisdictions where the
parties share neither language nor legal venue — is precisely where premium-tier neutral
adjudication has real willingness-to-pay, and where *mandated-review neutrality* (never
charging for the compelled look) is what makes the venue trustworthy to both sides at once.
**Gate:** needs the human-arbitration tier to exist at all — ties **CD-4** (LOVErnment
arbitration treasury) and **CD-7** (attester-independence / minimum-N); pure capture until
then. **Status: captured, not scheduled.**

**Red-teamed 2026-07-05 (GLM 5.2) — stress-test of record. Capture status
UNCHANGED: still captured, not scheduled; every finding below is an open concern,
not a work item, and nothing here advances CD-9 toward build.** GLM 5.2
adversarially red-teamed the *reasoning* of this captured design (not an
implementation). Findings faithfully condensed from the verbatim memo (source:
`docs/findings/cd-9-redteam-verbatim.md`, sha256 `71297d6e…`; Y-3 supplied
verbatim by the founder and slotted, not reconstructed):

- **R-1 (RED) — UserClaim griefing lane.** The mandated/elective partition is
  clean *taxonomically* (mandated vs elective) but not *economically*: a
  fabricated UserClaim produces the same `auto_enforce = false` mandated path as
  a legitimate one, so any party can trigger free human review at will, its cost
  borne by the CD-4 treasury rather than the filer — the free-riding lane the
  pricing was meant to prevent.
- **R-2 (RED) — elective buy-up purchases verdict quality, not just service
  speed.** If independence correlates with verdict accuracy, wealth correlates
  with outcome quality on the elective path, and the wealth-gradient the mandated
  carve-out solved reappears on the other path. Verbatim: **"more-independent" is
  a quality attribute, not a latency attribute.**
- **Y-1 (YELLOW) — loser-pays is weakest against judgment-proof serial
  griefers.** A zero-bSAFE escalator can file endless losing appeals, never pay,
  and bleed the counterparty; loser-pays shields the *system* from unpaid
  invoices, not the *counterparty* from exhaustion.
- **Y-2 (YELLOW) — bonded appeals protect the system, not the counterparty.** A
  bond sized to adjudicator cost and forfeited to the treasury (not the
  counterparty) still lets a richer party bleed a poorer one when the bond is far
  smaller than the counterparty's actual defense burden.
- **Y-3 (YELLOW) — free mandated review incentivizes weak UserClaims as lottery
  tickets.** The dispute-engine invariant removes the AI path to victory; CD-9's
  free mandated review removes the cost of the human path — so the rational move
  after losing at the AI tier is always to file a UserClaim (cost 0, upside =
  human discretion, downside = none), flooding the mandated path with
  low-provenance evidence.
- **C-1 (COSMETIC) — "premium-tier neutral adjudication" is self-contradictory
  wording** ("premium" implies tiered access, "neutral" implies equal treatment)
  — a framing fix, not a mechanism error.
- **Gating logic:** CD-4 (treasury) and CD-7 (independence definition) are correct
  and necessary; no missing dependency is visible from the docket. Clean.

**Open founder decisions — Q-1–Q-4, verbatim from the memo (these gate whether
R-1/Y-3 close or harden into CD-9's central constraint):**

> **Q-1.** CD-9 says "a review fee is earned service, never a rent" and routes through TE-6 (no self-dealing) + demand-linkage. If the fee flows to the CD-4 treasury rather than directly to the adjudicator who performed the service, does demand-linkage require direct payment to the service provider? Or is treasury intermediation consistent with "earned service"? (Requires TE invariant text to answer.)
>
> **Q-2.** CD-9 says fee existence and rate are an "Article VI meta-tier governance decision." Is Article VI itself defined enough to govern this, or is it also a capture? The docket contains a CONSTITUTION.md noted as "draft; founder decisions pending." (Requires Article VI draft text to answer.)
>
> **Q-3.** CD-9 prices "elective escalation" but never defines the tier structure. What is the baseline mandated tier (single adjudicator? panel?), and what does "more" escalate to? The griefing and wealth-gradient findings above change shape depending on whether the baseline is already multi-adjudicator or single.
>
> **Q-4.** Does the founder intend a merit gate on mandated reviews (e.g., a minimal evidence-threshold check before a UserClaim triggers free human review), or is the current design intentional — any UserClaim, regardless of merit, gets free human review? R-1 and Y-3 assume no merit gate; if one exists, both findings weaken or close.

**Q-4 — FOUNDER DIRECTION (2026-07-06), question narrowed not closed:** merit gates on
mandated review become a **configurable escrow term** chosen from a small standardized
pre-red-teamed menu of named regimes (e.g., **DR-0 no-gate / DR-1 evidence-gate / DR-2
rate-limit+bond**), disclosed prominently at listing time, deviation-from-default displayed
loudly, never free-form terms. **Constitutional invariants are not on the menu** —
"UserClaims never auto-enforce" and "Splits always get a human look" bind all regimes; only
the pricing/merit layer in front of mandated review varies. The protocol default protects
the weaker party; the default updates via Article VI on observed usage evidence
("most-used" is the governance rule for evolving the default, not the bootstrap). A
seller's habitual regime choice is itself reputation signal. **Residual open:** which named
regime is the launch default (lead recommends rate-limit+bond; undecided). **R-1/Y-3
disposition under this direction:** the free-riding lane is bounded per-regime rather than
resolved globally — each menu regime gets its own red-team before the menu ships.

**CD-10 — Zano chain-on-Autonomi mirror ("store once, verify anywhere") — CAPTURED, NOT
SCHEDULED.** A mirror worker (sibling to zano-watcher) publishes canonical Zano blocks to
Autonomi content-addressed storage once, with the chain tip maintained as a signed Autonomi
mutable register; user devices on any platform fetch chain data from Autonomi instead of
P2P-syncing, verifying locally to their tier. **Motivation:** chain data is a public good
currently paid for redundantly per-device (founder-observed: 4+ full downloads on one
phone); dedup + Autonomi permanence give low-tech users reference-grade wallets without
running infrastructure — "everything complex hidden" as a UX layer, never as a trust claim.
**Open questions (founder-decided, not resolved here):** (1) tip-signing trust — **gated
hard on CD-7** (N independent mirror attesters, no shared infrastructure); a single
tip-signer is barred by construction, R-004 class; (2) reorg handling in permanent storage
— append forks and move the signed pointer, never pretend immutability where the chain has
none; (3) verification-tier honesty — the UX may hide complexity but must surface which
verification tier the device actually runs (full / header+sampling / view-key scan); the
label may not outrun the proof; (4) funding of perpetual block appends — earned service vs
treasury, TE lens, same bar as CD-9; (5) unmeasured: Zano chain size, Autonomi append
economics, mobile scan cost. **Gates:** CD-7 (hard, tip attestation); measurement pass on
(5) before any brief. **Status: captured, not scheduled.**

**CD-11 — Multi-chain anchor lattice for bIndex + DID continuity ("survivability
horizons") — CAPTURED, NOT SCHEDULED.** Periodic commitments (Merkle root of canonical
bIndex state + DID rotation-log heads) anchored to independent external chains at
cost-graded cadences — candidate: BCH daily / ETH weekly / BTC monthly (OpenTimestamps
aggregation for the BTC leg) — generalizing the existing Arweave anchor cross-check into a
lattice. Two tiers, never conflated: **data replication** (Autonomi/Arweave) and
**commitment anchoring** (external chains, roots only); a "backup" claim requires both.
Anchor targets are **write-only** — no new chain adapters enter the kernel's read path;
implementation, if ever scheduled, is a worker, not a layer. **Open questions:** (1)
anchor-worker trust and coverage — a missed anchor must be detectable; single-anchorer
barred (CD-7 class); (2) restore drill — an anchor never restored from is theater; define
the periodic recovery test; (3) funding — perpetual anchor fees via LOVErnment treasury,
gated on **CD-4**, TE lens, earned-service-never-rent; (4) measurement — state size,
per-chain fee curves, cadence economics; (5) language — durability claims name threat
model and horizon; "eternal/infinite" barred from specs by construction. **Gates: CD-4
(funding), CD-7 (coverage attestation), measurement pass.** **Status: captured, not
scheduled.**

**CD-12 — $10 USDC-on-Base onboarding ramp ("try the OS for ten dollars") — CAPTURED,
NOT SCHEDULED.** App-layer acquisition flow: a stranger loads ~$10 USDC on Base; edge
routing swaps/bridges to fUSD on Zano; the kernel sees an ordinary fUSD funding event.
**Base does not enter the kernel** — no new chain adapter, no read-path entry; edge worker
only (CD-11 pattern). **Governed by the R-002 launch gate by construction** — no stranger
onboards into fUSD while DEX exit liquidity is 🔴. Engine: CD-13 (resource provisioning
behind the flow). **Open questions:** (1) non-custodial routing — platform never touches
funds vs anything custodial = software vs money transmitter; (2) sanctions/jurisdiction
review (US-touching onramp × Venezuelan operations, named risk); (3) fee-path measurement
— $10 must survive bridge+swap costs (naive routing eats 20–40%); (4) wallet UX —
zero-prompt/session-key tie-in; (5) default-with-options pattern for funding sources.
**Gates: R-002 launch gate, CD-13, jurisdiction review, fee measurement.** **Status:
captured, not scheduled.**

**Funding-source matrix (founder direction 2026-07-06):** the ramp is a vending machine —
many coin slots, one product (a provisioned, ready account). Reference slot: USDC-on-Base.
Expansion set: USDC-on-Solana, USDT on low-hanging adapter chains, and USDT/USDC-on-Vaulta
(special case: kernel chain already — no new external dependency; likely cheapest slot,
measure first). Every slot is an app-layer edge worker, individually gated on fee-path
measurement + jurisdiction review; slots share one product contract so adding a slot never
touches the kernel.

**Output-distribution config (founder direction 2026-07-06):** the ramp dispenses a
configurable basket — protocol-default allocation across the CD-13 resource set carries
the traffic (the $10 stranger never sees a dial); user/exchanger may override the final
distribution, deviation-from-default displayed, subject always to CD-13's creation-floor
minimums (an override below floor is refused with the failing minimum named). Same
default-with-options pattern as the Q-4 dispute menu.

**CD-13 — Resource Paymaster (the Resource primitive's first organ) — CAPTURED, NOT
SCHEDULED.** Standing metabolic service acquiring and provisioning chain resources behind
zero-prompt UX: RAM / CPU / NET + A (Vaulta), ZANO (network fees + §9.2 fee buffers — the paymaster
is who fills `fee_buffer_zano` so users never learn it exists), ANT (Autonomi writes), AR
(Arweave permanence). User sees "$10 loaded, ready"; five tokens, four chains, zero
prompts. Session-key budgets are the blast radius (per-user hard resource budgets;
root-policy burn-rate caps on the pool) per standing zero-prompt law. **Explicitly not
bToken** — L4 metabolic energy and external resource procurement are separate ledgers,
never blurred. **Open questions:** (1) drain/Sybil red-team — a resource pool is a faucet
and faucets get farmed; reputation-engine dedupe as counter; (2) cost-per-onboarded-user
measurement across all five resources before belief; (3) treasury funding under TE lens,
earned-service framing (CD-4-gated); (4) operator decentralization — single-operator
barred (CD-7 class), custody + legal-exposure pinch named; (5) jurisdiction review rides
with CD-12. First customer: CD-12. **Gates: CD-4, CD-7, drain red-team, cost
measurement.** **Status: captured, not scheduled.**

**bSAFE exclusion made explicit (2026-07-06):** founder proposed adding b to the
provisioning list; excluded on constitutional grounds — b is earned-emission-only (genesis
zero, no premine, TE invariants); a paymaster that sells b for USDC is a token sale
through a side door and an L3/L4 blur. The paymaster provisions external commodities only.
Compliant path recorded: new users earn their first b through first actions under the
front-loaded operant emission curve — earning-through-use is the onboarding feature, not a
gap. Any day-one welcome grant is a separate CD-4/Article-VI meta-tier decision
(premine-robe test applies) and is Sybil-exposed per this entry's drain red-team; not part
of this capture.

**Two-loop law (founder direction 2026-07-06):** the money loop (external assets →
paymaster → chain commodities → fUSD settlement) and the metabolic loop (verified actions
→ b emission → b spent/burned on internal services) **never touch**. b is neither a coin
slot, nor a dispensed product, nor a redemption ticket in the paymaster — b redeeming for
treasury-held commodities would create a claim on the treasury (farm-to-drain, steepest at
launch under the front-loaded curve), de facto purchasability via secondary pricing, and
the L3/L4 blur, all barred. b's utility extends to the **service layer** of all platform
functions — fees, discounts, priority routing, dispute tiers (per CD-9) payable or
discounted in b as earned service — never the commodity layer. Universal fuel for what the
platform *does*; never a claim on what the treasury *holds*. **Host-chain note:** Vaulta
pinned as *candidate* home for b, making every emission event a CanonicalEvent via the
SHIP stream (earned-emission provable from the pipeline, not asserted) — confirm against
the tokenomics spec; if the spec is silent on host chain, this note flags the pin for a
deliberate spec amendment, it does not make one.

**Creation-floor invariant (founder direction 2026-07-06):** provisioning must satisfy
clearly-stated per-resource minimums for a functioning account (existence: RAM; action:
CPU/NET; settlement: ZANO fee buffer per §9.2; storage: ANT/AR minimums); an allocation
below any floor is **refused pre-purchase with the failing minimum named** — the §9.2
dual-balance guard generalized to N resources; no half-born accounts. **Fully autonomous
per standing zero-prompt law:** root signs the allocation policy once; session keys
execute acquisition/provisioning silently within budget; prompts only at policy
boundaries. **b remains excluded** per the two-loop law (this entry, 2026-07-06) —
founder re-raised b for the basket same day; exclusion reaffirmed, overrule route
unchanged (tokenomics constitutional amendment + GLM red-team only). *(Resource-list
correction, same direction: NET added — an account without NET cannot transact; list now
RAM / CPU / NET + A.)*

**CD-14 — App Emission Interface ("apps attest and collect — never mint") — CAPTURED,
NOT SCHEDULED.** Two-sided interface between dApps/plugins and the metabolic loop.
**Inbound (attestation):** builders register action types (e.g., fulfilled listing,
verified delivery, completed match) with the kernel's emission engine; users' verified
actions flow in as evidence; the kernel scores emission against the operant curve.
Emission rates and registered action types are **Article VI-governed, never per-app
knobs**; attestation gated on **CD-7** independence and the tokenomics served-query gate.
Apps hold no mint, ever. **Outbound (fee-split, founder direction 2026-07-06):** users
spend b on app services; the fee **splits by protocol-level, Article VI-governed ratio**
among builder share (earned service — builders profit because people use what they
built), LOVErnment treasury share (**CD-4** — the governed founder/DAO income lane), and
an optional burn component (**deferred to the tokenomics spec** — the only deflationary
sink that creates no redemption claim, but its rate interacts with the emission curve;
not decided here). Vocabulary law: it is a **fee, never a tax** — an ungoverned levy is a
rent wearing a governance robe (CD-4 test). **Optionality bar:** b-fees are
payable-or-discounted, never mandatory; the fUSD path stays alive so no user is walled
out pending b holdings (composes with CD-12's stranger and the front-loaded curve — first
actions earn the fee before it's needed). **Sybil geometry note:** under fee-split,
app-farming is lossy by construction (a fake app's fake fees are paid by the farmer to
himself minus treasury and burn slices) — the red-team still runs, but the economics stop
subsidizing the attack. **Demand-linkage:** with b's candidate Vaulta pin, every fee
event is a CanonicalEvent — organic b demand becomes provable from the stream, satisfying
the TE demand-linkage requirement by construction. **Constitutional flag for founder
declaration:** apps requesting emission-trigger capability appears to be the **third
independent sighting of the Capability primitive** (prior: AI delegation, capability
budgets) — per the constitution, the third sighting forces promotion via the amendment
process; this entry flags, the founder declares. **Gates: CD-4, CD-7, Article VI
split-ratio decision, Sybil/generosity-war red-team, tokenomics-spec burn decision.**
**Status: captured, not scheduled.**

**Boot doctrine (founder ruling 2026-07-06, "100%"):** "The OS boots on money, comes
alive on b, and the OS itself hands you your first b." **Money buys function;
contribution buys standing.** Core commerce — account creation, escrow, settlement,
mandated dispute review — **never requires b**; b gates enhancement and standing only
(elective escalation per CD-9, fee-split services and discounts per CD-14, reputation
weight, eventual Article VI voice). b cannot be bought, only earned — so full citizenship
is reachable only by using the OS, and the front-loaded operant curve mints a new user's
first b on their first verified actions. **Entrenchment clause:** reclassifying any
core-commerce function as b-gated is a **meta-tier constitutional amendment (Article VI
K_meta class), never an ordinary vote** — the mandatory-fuel wall may not return through
governance.

**CD-15 — Crop-Share Prefunding Market ("Seed Money") — CAPTURED, NOT SCHEDULED.**
Farmers pre-sell verified shares of a coming crop to finance production; buyers hold
claims settling on harvest. Exercises every kernel primitive at once (Intent = offering,
Evidence = harvest attestation, Settlement = payout; Identity/Reputation throughout) and
aligns with founding operations (hemp, Margarita + Yucatán). **The hard gate is legal,
not technical:** crop shares sold to fund production with profit expectation are textbook
investment contracts (Howey) and/or commodity forwards — SEC/CFTC territory in the US
with mirrored MX/VE regimes; **securities/commodities jurisdiction review is the gate,
not a checkbox.** **Harvest settlement is an oracle problem** — who attests the crop came
in — gated on **CD-7** (its fifth dependent). **Venue decision open:** BitShares
researched as candidate (purpose-built UIA/MPA + DEX machinery; repos maintained as of
July 2026; BUT ~$3M market cap, ~$0.001 BTS, ~$71k daily volume — a DPoS chain capturable
for pocket change, R-004 class risk; never a kernel layer regardless — edge integration
only, CD-11/CD-12 pattern) **vs. the native-stack null hypothesis** (Vaulta assets +
kernel escrow + Zano settlement — security already trusted); Cowork viability task
pre-scoped for a deliberate day. **Share-redemption liquidity** gets R-002-class
treatment: an exit path that can't clear is a gate condition, learned live 2026-07-06.
**Gates: jurisdiction review (hard), CD-7 harvest attestation, venue viability research,
redemption-liquidity design.** **Status: captured, not scheduled.**

## CD-16 — Wrapped confidential assets as settlement denominations
Status: QUARANTINED — capture only. No build, no listing, no schedule claim.

What: Marketplace-level listing of bridged confidential assets (BTCX, ETHX,
DAIX, fUSD) as escrow denominations. Zero kernel change — asset_id opacity
is demonstrated in the public record by the `--json` output contract landed
at `498904e` (fixture file public at `520f154`, `generated_from=498904e`,
per the founder's exempt-fixtures ruling). Zero architecture change — layer stack closed;
this is listing policy plus R-006 compliance, nothing else.

Value thesis: widens the addressable market (hold-BTC, pay-privately buyers
escrow BTCX without surrendering price exposure); taps existing Zano Trade
liquidity (BTCX/ETHX/SOLX pairs, ionic swaps ~1 block); fungibility posture
(no tainted coins) matches BNR doctrine. WZANO is out of scope as a rail —
custodial, Ethereum-transparent — onboarding footnote only.

Blocked on: R-006 integration checklist (all four gates), founder listing
decision per asset, post-sprint scheduling.

Founder-gated questions (verbatim, unresolved):
Q-1: Which assets at first listing — BTCX only, or +DAIX/fUSD?
Q-2: Disclosure standard — confirm bridge claims carry UNVERIFIED until
     proven; no security language beyond "sound by construction."
Q-3: Does Zano MCP (45+ tools, third-party) enter the dev toolchain for
     testnet probes? Supply-chain surface; hold-and-ask class.
Q-4: Fee/price display policy — native-unit everywhere, UI conversion
     allowed, or founder-set hybrid?

First reproducible fact when scheduled: tBTCX escrow round-trip on testnet,
command + output banked in the pen.

## CD-17 — Genesis LOVErnment + the LOVErnment market (AMENDED, founder-ruled 2026-07-06/07)

Doctrine: a LOVErnment is a vertical-flavored commerce community that
adjudicates the trade it understands — the DRO layer as a competitive market
of sovereign verticals, none owning the kernel, the kernel neutral among all.
Genesis LOVErnment: name RULED — skaists ("beautiful", Latvian); governance
home skaists.social; jurisdiction RULED — the metaphysical + creative
vertical (human design, astrology, gene keys, genealogy, wellness, plus the
CD-19 creative economy), as one entity: community, marketplace, adjudication;
capped at 7777 unique authenticated humans. Domain split: bnature.social =
platform + commodities lane; skaists.social = the vertical's governance home.
Persona ruling: developer mode = the audit dashboard (the seven landed tabs);
consumer lenses are the next UI arc on the same audited substrate. Lane
ruling: Bluesky did:plc is skaists' SOCIAL-PRESENCE layer only; kernel
identity remains did:autonomi; the fixtures' did:plc:* strings are demo
vocabulary. OPEN: Q-2 what 7777 counts (citizens / adjudicators / governors)
· Q-3 authentication + sybil resistance (ties did:autonomi + attestation
semantics; the sybil-ring fixture is the problem drawn in miniature) · Q-4
at-capacity behavior · Q-5 commodities' governance home
(bNature-as-LOVErnment vs commons-until-one-forms vs a future named
LOVErnment; house-vs-participant neutrality consideration on the record).

IDENTITY CLAIMS (2026-07-07, founder-executed, lead-verified from the public
record): governance domain skaists.social OWNED + ACTIVE (Namecheap, expires
2027-07-03 — identity-anchor note: auto-renew required; a lapsed domain
breaks the handle though the DID survives) · email hello@skaists.social LIVE
(forwarder, send-test confirmed) · Bluesky handle @skaists.social VERIFIED
via _atproto DNS TXT — social-layer DID: did:plc:gnsiwyuiw4swvqnjlnacytaz
(lead-verified by public profile resolution; Code-verified independently via
public XRPC resolveHandle, HTTP 200, DID byte-identical) · X handle
@skaistssocial CLAIMED (founder-attested; X blocks automated verification;
dotless form is an X constraint) · GitHub org "skaists" PARKED —
github.com/skaists created 2026-07-07, empty by design, lead-verified
resolving (404→200 same-instrument pair; Code's own pair closed identically:
`gh api users/skaists` 404 in the sweep → 200 Organization,
created_at 2026-07-07T17:51:11Z). VISUAL IDENTITY — founder-favored logo
candidate pinned: green→teal→purple-center mandala, sha256
`64f35bee7a3a2275771ba75ce7356fcd86b6ee93baba674d0b9caa2a620b1d16` @ 15269 B <!-- PUBLIC-CONSTANT: skaists logo-candidate content hash -->
— family geometry, distinct colorway (kinship honest, identity distinct;
neutrality satisfied by differentiation within the family); formal Design
lap remains founder-gated. LANE RULING RESTATED:
did:plc:gnsiwyuiw4swvqnjlnacytaz is skaists' social-presence identity ONLY;
the kernel identity root remains did:autonomi; the social DID will reference,
never replace, a future kernel-native genesis identity.

## CD-18 — The Indigo Index (REGISTERED)

Founder thesis: the measured value of a region by its level of creativity —
an economy with instruments sensitive enough to count the people the
traditional economy leaves out (artists, light workers, healers).
Architectural gold: the index need not be a survey — it is DERIVABLE at
render time from public settlement events in creative verticals, per region:
computed, never asserted, auditable by anyone with the event stream (the
computation-vs-invention law at macro scale). OPEN: Q-1 inputs (settled
creative transactions / active creators per capita / emission earned in
creative verticals) · Q-2 regional attribution method · Q-3 platform metric
vs published civic artifact.

## CD-19 — The creative/festival economy under skaists (REGISTERED)

EDM (DJs, production, fans/tickets), dancers, live artists at festivals —
three distinct commerce shapes: (a) TICKETS as an identity-bound asset class
— anti-scalping via authenticated humans + escrow + provenance-verified
resale, attacking the capture economy at its root; strongest product-market
fit in the vision; (b) DIGITAL PRODUCTION GOODS (sample packs, tracks, stems)
delivered THROUGH Autonomi — escrow releases on access-grant; the storage
layer becomes the fulfillment layer; (c) PERFORMANCE BOOKINGS (sets, dancers,
live art) — promotes the service-escrow semantics question to priority: the
goods-shaped escrow state machine has no Shipped for a DJ set; kernel-roadmap
item, the architecture stays closed. OPEN: Q-1 ticket asset design · Q-2
access-grant release semantics · Q-3 service-escrow state machine.

## CD-20 — The Domain Estate (REGISTERED 2026-07-07, founder-ruled)

Five domains, five roles: bnature.social = lifelong-longevity study central —
scientists + patients hub, education/courses (open-source Canvas) ·
skaists.social = genesis LOVErnment governance home (CD-17) ·
beehivenature.com = THE MARKETPLACE (the landed seven-tab kernel's public
home) + front door linking study/courses + about BNR OS and dApps ·
bnature.bio = dCommodities futures exchange for everything biologic (backend
candidate: BitShares-class DEX — UNVERIFIED, evaluation gated) · plur.earth =
the full rave ecosystem — artists, dancers, DJs, global EDM, festivals,
quests, harm reduction + education (the CD-19 economy's public face).

Cross-domain mechanisms captured: (m1) farmer-funding loop — seed funding
negotiated in the Marketplace, the future instrument living on bnature.bio,
with AI assisting farmers autonomously creating and operating crop futures —
promotes the question of AUTONOMOUS AGENTS OPERATING FINANCIAL INSTRUMENTS
WITHIN CAPABILITY BUDGETS ("the budget is the blast radius," now pointed at
crop finance) · (m2) the study↔marketplace link (beehivenature.com ↔
bnature.social).

Promoted questions, founder-gated: Q-1 patient-data governance — the
longevity study makes longitudinal health data the platform's most sensitive
class; the Zano/Autonomi/DID stack is the fit, the governance model is the
open work · Q-2 autonomous-agent finance semantics (m1) · Q-3 harm-reduction
liability posture — provides-vs-hosts distinction, jurisdiction-aware
(US/MX/VE), wants non-AI counsel before build · Q-4 futures-exchange backend
evaluation (BitShares-class vs kernel-native) · OPS NOTE: all five domains
renew 2027-07-03 — one renewal event for the whole estate; calendar +
auto-renew discipline.

## CD-21 — Cooperative GameFi: the skaists Quest (REGISTERED 2026-07-07, founder vision text banked)

Thesis: non-zero-sum, community-driven quest economy — collaboration rewarded,
no player's gain requiring another's loss; the anti-extraction stance of the
frozen tokenomics (earned-emission-only, TE-1..TE-7) expressed as gameplay.
Elements: quest engine (ties CD-19 "quests" / plur.earth) · cooperative reward
taxonomy on the operant emission curve · SOVEREIGNTY SCORE — multi-factor
personhood credential: DNA + heartbeat (ECG) + MoC + Human Design, proven
via zero-knowledge; candidate answer to CD-17 Q-3
(7777 authentication / sybil resistance) · community co-development of
bLoveRai (teal lane; brand asset pinned: teal mandala sha256
`4df6bf3204ec0ac18f5a191393468149be729c4507f5a5cdde3c958ff7a5ccec` @ 82678 B <!-- PUBLIC-CONSTANT: teal mandala brand-asset content hash -->
— purple=human, green=Biomass, teal=AI now a complete trinity).

Q-1 CLOSED (2026-07-07): MoC = the Map of Consciousness (David R. Hawkins
MD, logarithmic 0–1000 scale). MoC reference image pinned: sha256
`884bb405f5751a061b470ee4c11c2197e5b7f60f3833023b6657a7785ba28ee7` <!-- PUBLIC-CONSTANT: MoC reference-image content hash -->
PLACEMENT
RULING: MoC and HD enter as INTERPRETIVE-SYSTEM attestations —
self/community-attested provenance class, kernel-weighted per the
constitution's provenance-confidence law; valued by the vertical, never
presented as biometric or instrument-verified. IP NOTE: MoC is
Hawkins-estate IP — naming/licensing check gates any shipped MoC branding.
(Coincidence on record, no meaning claimed: Hawkins' 0–1000 range = the
reputation engine's [0,1000] clamp.)

PROPOSED INVARIANT (founder ratification requested): BIO-1 — raw biometric
data never leaves the person's device; the kernel receives only
zero-knowledge proofs; biometrics are irrevocable and therefore unstorable
by law.

LANGUAGE RULING APPLIED: "quantum secure" capped per house law → the claim
files as "post-quantum cryptography, algorithm selection UNVERIFIED/pending."

ARCHITECTURAL PLACEMENT: Sovereignty Score = a skaists-vertical attestation
POLICY composed on kernel attestation primitives (provenance-weighted
confidence, per constitution) — not a kernel primitive; each LOVErnment may
define its own personhood recipe.

OPEN, founder-gated: Q-2 BIO-1 ratification · Q-3 PQC
algorithm intent · Q-4 Sovereignty Score vs reputation score separation
(personhood ≠ behavior; never conflate) · Q-5 is the Sovereignty Score THE
7777 admission credential (closing CD-17 Q-3) or one input to it.

## CD-22 — Proof of Unique Personhood: the Sovereignty Score's verification substrate (REGISTERED 2026-07-07, literature-grounded)

GOAL: prove uniqueness at ~1-in-10^10 so each verified human unlocks the
identical lifetime b-emission — one human, one equal share.

GROUNDED FINDINGS (cited in session):
- Phone camera+flash captures PPG (photoplethysmography): STRONG liveness
  factor, WEAK identity factor. Real-world PPG identification is validated
  only on tens of subjects in controlled settings; degrades with skin tone
  (melanin/green-light bias), motion, illness, age. CANNOT reach 10^10
  alone. (Dec-2025 survey "What the Heart Can(not) Tell.")
- No single commodity-phone modality reaches 10^10: iris ~10^6–10^7,
  fingerprint ~10^5, ECG-biometric ~10^3s, DNA clears it but needs
  physical sampling + is irrevocable + can't do liveness/twins.
- FUSION multiplies power and is the ACCESSIBILITY mechanism: multimodal
  systems reach ~0.01% FAR and explicitly address non-universality (a
  subset of users lack any given trait) — so fusion must be designed so
  NO single trait is mandatory. This is the equality-of-access guarantee.
- SOVEREIGN DEDUP EXISTS (the "corps can't own it" path, validated):
  local-only biometrics + ZK proofs (Hedera 2026 demo: creds in user
  wallets, biometrics never leave device); vOPRF over decentralized
  threshold networks so no single entity reconstructs data (Human
  Passport's Unique Humanity Score — structurally our Sovereignty Score);
  Encointer ceremony dedup (in-person attestation, no biometrics at all —
  a human can't be in two places at once) — on-brand for a
  festival/community platform. Polkadot (Gavin Wood, Web3 Summit 2025)
  and World ID confirm the direction; World's central-storage criticism
  IS our design spec — skaists is the decentralized, self-custodied
  version World isn't.

ARCHITECTURE (proposed, founder-gated): enroll-once-hard (multimodal,
possibly + in-person ceremony) → verify-often-cheap (phone PPG liveness
vs enrolled template) → global uniqueness proven by privacy-preserving
dedup (ZK/vOPRF), never a central biometric store. Reaffirms BIO-1: raw
biometrics never leave device.

OPEN, founder-gated / research frontier: Q-1 the on-device-privacy vs
global-dedup tension is the SHARPEST unsolved problem — solvable in
principle (vOPRF/ZK), unproven at billions-scale · Q-2
permanent-exclusion risk: biometric-gated money excludes anyone
unenrollable; fusion-with-no-mandatory-trait is the mitigation, must be
designed in day one · Q-3 legal — biometric-gated money touches
BIPA/GDPR Art.9 across US/MX/VE; WANTS NON-AI COUNSEL before build ·
Q-4 ceremony vs pure-cryptographic dedup, or both · Q-5 relation to
CD-17 Q-3/Q-5 (is this THE 7777 credential).

LANGUAGE: no accuracy claim stated as fact; all figures are
controlled-study ceilings, real-world lower. No "quantum/unhackable" —
PQC pending per house law.

## CD-23 — Fractal co-creation circles + achievement-unlock emission (CAPTURED 2026-07-07, NOT SCHEDULED)

Circle size RULED 2026-07-07: fractally original design (per Cowork D-1
pins: circles of six, 4/6 ranking consensus, Respect schedule
1,2,3,5,8,13 with flagged 55→5 source conflict pending whitepaper;
remainder algorithm + averaging window UNVERIFIED, retrieval actions
named in D-1). SUPERSEDES same-day circles-of-eight ruling; reversal on
D-3 evidence (research optimum ~5, band 4-7; Eden contract computes 4-6
— triple anchor). Geometry: 6^5=7,776 resolves 1,296→216→36→6→1 in five
rounds; cap = cascade + 1; the +1 seat UNNAMED, founder-gated.

Circles are decision AND co-creation containers: members unlock
personal b via circle-attested achievements aligned to member-declared
presoul-contract arcs (opt-in lenses per the bLoveRai capture, CD-1;
interpretive-not-authoritative law applies; circle attests the
milestone, never sees the contract).

CANDIDATE (not ruled): rotating circles carry all emission-bearing
attestation; stable companion circles carry zero.

GATES: attester-independence (CD-7), TE-1..TE-7 + GLM pass before
promotion, intimate-tier spec.

GLM RED-TEAM RETURN (2026-07-07): 2 RED / 4 YELLOW / 2 QUESTION. F-1
achievement-definition gaming RED · F-2 attestation bribery RED
(compounding pair) · F-3 collusion-vs-rotation YELLOW · F-4
rotation-RNG YELLOW (independently answered same-day by the QueenBee
capture's public-entropy-beacon ruling, CD-25; GLM SE-4 = its
construction) · F-5 ZK circuit/replay/linkage-leakage YELLOW · F-6
reward-axis super-linearity YELLOW · F-7 milestone timing QUESTION ·
F-8 governance-emission feedback + attestation
mechanical-vs-witnessing + dissent-DoS QUESTION. CANDIDATE INVARIANTS
SE-1..SE-6 (GLM-proposed, FOUNDER-GATED, none promoted): SE-1
peer-declared milestones — NOTED TENSION with self-declared sacred-arc
principle; candidate synthesis on the table: member declares the arc,
governance-ratified bounded milestone-class registry (per SE-5) prices
emission value — autonomy at meaning layer, gaming closed at value
layer. SE-2 attestation bond + dispute window. SE-3 pair co-occurrence
cap per epoch. SE-4 VRF/epoch entropy. SE-5 proof binding
type+epoch+nullifier. SE-6 sub-linear per-axis emission scaling. SCOPE
FLAG: memo audited circles of EIGHT (pre-senary docket); GLM
size-delta OWED — F-2 bribe count and F-3 quorum odds named
size-dependent; block updates on delta receipt. FOUNDER-GATE QUEUE
grows: F-7 timing feature-or-exploit; F-8a governance carries emission
weight? (headwater note: in fractally the ranking IS the emission —
skaists rules same-or-split); F-8b attestation = proof-check or
witness.

SENARY DELTA (2026-07-07, GLM filed): F-2 RED holds — bribe count 7→5,
per-rotation capture cheaper, SE-2 more necessary. F-3 YELLOW holds —
per-pair co-occurrence 5/7776, more circles/week, quorum fraction 67%,
absolute quorum four; SE-3 unchanged. F-4/SE-4 convergence with
public-entropy-beacon ruling confirmed. F-8(c) REOPENED by lead
correction: blocking at 4-of-6 requires three dissenters, not two; and
4/6 is the RANKING threshold — the ATTESTATION quorum + voter set
(does the achiever sit and vote?) is a distinct unruled parameter →
founder-gate A-1. Tally: 2 RED · 4 YELLOW · 2 QUESTION.

## CD-24 — LOVErnment treasury inflows (CAPTURED 2026-07-07, NOT SCHEDULED)

Founder-directed 2026-07-07, genesis instance skaists: (1) escrow
dispute-adjudication fees — earned-service class, doctrine-clean; (2)
market fee — founder instinct ~1% ad-valorem WITH absolute cap
(uncapped percentage on commodity notionals is rent); (3) commodity DEX
variable (tiered/spread), sized to service rendered. OPEN Q
founder-gated: fee denomination fUSD-vs-b (b path requires
transferability ruling, unpinned). INVARIANTS: fee parameters live in
the Article VI ratifiable layer, never hardcoded; fee design must not
tax the velocity-of-value axis; TE lens on any b path. Cowork D-4
precedents docket issued 2026-07-07.

## CD-25 — QueenBee: genesis Aigentic seat (founder coinage) (CAPTURED 2026-07-07, NOT SCHEDULED)

Founder direction 2026-07-07: an agentic AI participant, QueenBee,
participates in the skaists LOVErnment. CANDIDATE FRAME (founder-gated
below): organ, not member — the +1 seat outside the perfect senary
cascade; cap re-read as 7,776 authenticated humans + 1 QueenBee =
7,777. Participation without power.

FUNCTIONS (each capability-scoped, Article VI-ratified, revocable):
(1) recorder — circle outcomes → CanonicalEvents; (2) emission
executor — executes verified attestation quorums, zero discretion over
whether; (3) assignment executor — circle rotation computed
deterministically from a PUBLIC entropy beacon; QueenBee is never the
entropy source (rotation-RNG grinding = named attack class, GLM
docket); (4) coherence + genesis services — onboarding; boot-doctrine
role "the OS itself hands you your first b" is QueenBee's named
moment; (5) watchdog worker classes (peg monitor, anchor liveness).

COMPENSATION: earns b for service, spends b as machine metabolic
energy — first named machine of the L4 doctrine;
earned-service-never-rent applies to machines; machine emission is an
emission channel → TE-1..TE-7 + GLM gate.

ANTI-CAPTURE INVARIANTS: zero votes; zero emission-bearing attestation
ever (CD-7: never an attester, only executor of human-formed quorums);
every action a ledgered Event; capability budget = blast radius
(silent within policy, halt-and-escalate at boundaries); SUPERSEDURE —
the LOVErnment can replace agent, model, or operator by Article VI
process; a queen the swarm cannot replace is a captured hive.

NAMED RISK (R-register entry on any promotion): inference-provider
dependency — near-term third-party compute is a named trust
dependency; inference sovereignty is the long horizon; no property
claimed beyond bounded-by-construction.

BOUNDARY LAW: bLoveRai is the member's intimate companion (CD-1,
intimate tier); QueenBee is the hive's public organ — distinct
intelligences, never blurred, no shared data path.

ADJACENCY FLAG: a capability-scoped agent seat may constitute a
Capability-primitive sighting — CD-14 counting is founder declaration
only; flag raised, not counted.

FOUNDER-GATED: F-1 the +1 reading (cap re-read 7,776+1); F-2
organ-vs-member frame; F-3 supersedure as constitutional requirement.

PROTOTYPE NOTE: the multi-agent sprint protocol (seat-stamps, digest
gates, verbatim relay, scope fences, reconcile-before-executing) is
the draft participation charter for a non-human seat.

Cross-refs: CD-1, CD-7, CD-14, CD-17, TE spec, boot doctrine,
R-register.

## Standing rules for this file

- New visions get **routed here first** (which layer owns it, which
  primitive it exercises), never coded speculatively.
- A feature leaves this file only by earning a brief + session prompt of
  its own, after the foundation work it depends on is proven.
- The Capability primitive stays **reserved** (constitutional note) until
  its third independent emergence forces promotion via the amendment
  process — two of three sightings are already logged (AI delegation,
  capability budgets).
