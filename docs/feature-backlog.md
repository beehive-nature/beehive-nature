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
any generic build (standing rule).

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

## Standing rules for this file

- New visions get **routed here first** (which layer owns it, which
  primitive it exercises), never coded speculatively.
- A feature leaves this file only by earning a brief + session prompt of
  its own, after the foundation work it depends on is proven.
- The Capability primitive stays **reserved** (constitutional note) until
  its third independent emergence forces promotion via the amendment
  process — two of three sightings are already logged (AI delegation,
  capability budgets).
