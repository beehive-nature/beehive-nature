# PROTOCOL-REUSE QUEUE — Astra seat (ADOPT / ADAPT / WRAP / WATCH / BUILD)

**What this is.** The investigation queue for the planned HIGH protocol-reuse seat,
as chartered in the Buzz Box SRE seat document (`docs/agents/BUZZ-BOX-SRE-SEAT.md`):
*"Astra = synthesis + architecture review. Later HIGH protocol-reuse seat
(OpenA2A/AIM, AIP/AAP/ATX, OpenCompany, ADOPT/ADAPT/WRAP/WATCH/BUILD); LOW
sessions = bounded workers from findings."* Until that seat is seated, this file
IS the queue — any seat may append an item verbatim with attribution and
provenance; the reuse seat works items top-down.

**Laws that bind every item here:**
- Classification vocabulary is **ADOPT / ADAPT / WRAP / WATCH / BUILD** — nothing
  else. A verdict without implementation evidence is not a verdict.
- Crypto-language + citation law: claims cite sources; no overclaiming.
- Fresh receipts only; a worked item links its evidence dispatch.
- **Reconciliation gate (founder direction, 2026-09-15):** internal architecture
  is reconciled FIRST — after the Work/review seat verifies `GLM-ARCHAEOLOGY.md` —
  before ANY item here drives implementation; candidates (Eddies, OpenA2A/AIM,
  OpenCompany, …) are evaluated against stable, reconciled Beehive interface
  boundaries, not whichever design document an agent happened to encounter first.

**Item shape:** status (OPEN / IN WORK / DONE-VERDICT) · received date ·
attributed source · evidence pointer.

---

## 1 · EDDIES / ANTENGLEMENT INVESTIGATION — **CLOSED 2026-09-16 (founder verdict + two dispatches; no further capacity)**

**Closure record:** the founder accepted the reverse-engineering verdict and
CLOSED Eddies as a bPay protocol-reuse candidate ("the authoritative Eddie
state is server-side; ANT/Arbitrum and Autonomi storage are adjacent
components rather than cryptographic authorities"). The one roll-forward —
`/api/dbc/*` — was examined and **CLOSED the same way**: DBC *signature*
verification is client-side and server-independent (wasm, standalone
verifiers, signer pubkey as parameter, ed25519-dalek/blake3/bloom), but
*value* authority reduces to the same server (client-side genesis self-mint
of 10^19 units with only a local guard; user minting explicitly "after the
server has deducted"; redemption via /api/dbc/* only), and the Rust source
is unpublished — nothing adoptable. One design-pattern note carried for the
reuse seat (window-classed self-signed bearer notes + signed transfer
receipts + bloom-gossip spentbook; open-source e-cash kin is where reusable
versions live). Evidence:
[`2026-09-16-eddies-reverse-engineering.md`](../dispatches/2026-09-16-eddies-reverse-engineering.md)
· [`2026-09-16-eddies-dbc-rollforward.md`](../dispatches/2026-09-16-eddies-dbc-rollforward.md).

*Independent reverse-engineering receipt (2026-09-16, founder-ordered, prior
interpretations explicitly excluded from method): fresh deployment read
(bundle `index-Dooy-XIV.js` + 17 chunks), one unauthenticated invoice GET,
read-only Arbitrum calls —* **an Eddie is a server-database row; ownership
changes NEVER touch Arbitrum (solely PQ-signed `/api/*`); the only chain leg
is a client-asserted ETH/ANT payment to a dead hardcoded EOA; the Autonomi
leg is client-encrypted secret-named persistence; NO decentralized primitive
beyond ANT + Autonomi storage + an app server.** *Full trace, five-way
classification, diagram, security observations:*
[`docs/dispatches/2026-09-16-eddies-reverse-engineering.md`](../dispatches/2026-09-16-eddies-reverse-engineering.md).

*Received 2026-09-15, appended verbatim from the Claude seat's analysis, relayed
by the founder. Primary-source evidence, provenance chain, and both retrieval
attempts: [`docs/dispatches/2026-09-15-eddies-antenglement-primary-source.md`](../dispatches/2026-09-15-eddies-antenglement-primary-source.md).
The "How Eddies Work" artifact is NOT publicly retrievable (zero web index
hits for "antenglement" or Eddies-in-Autonomi-context, checked from two seats) —
a founder paste of its contents is the only road in.*

```text
EDDIES / ANTENGLEMENT INVESTIGATION

New primary-source material from developer eddde:

2026-09-10:
Eddies apparently associate ANT-node/Farm uptime with "funds" and an
application-denominated €$ balance. A pay-link mechanism is described.
The developer states that if a recipient does not yet accept Eddies,
an obligation may remain for future acceptance/payment.

2026-09-15:
Developer describes "antenglement" as allowing blockchain ANT that
the user "keeps" to be spent, with the requirement that the user run
an ANT node to keep the mechanism active.

DO NOT assume:
- €$ is EUR
- €$ is a stablecoin
- displayed €$ is redeemable fiat
- "funds" means blockchain funds
- ANT is locked
- ANT is bridged
- ANT collateralizes €$
- node uptime itself creates monetary value
- antenglement uses quantum mechanics
- an Eddie represents final settlement

Determine from CODE/SPECIFICATION if available:

1. What exactly is an Eddie?
2. What exactly is a "fund"?
3. Why does 42 funds correspond to the stated app balance?
4. What creates €$ units?
5. What destroys €$ units?
6. Is €$ transferable?
7. Is it redeemable, and for what?
8. What backs it?
9. What does a pay link cryptographically contain?
10. What constitutes payment acceptance?
11. What does "owes you" mean in the state machine?
12. Can obligations expire?
13. Can they be repudiated?
14. Can they be double-spent?
15. Can obligations be netted?
16. What happens when counterparties never adopt Eddies?
17. What role does ANT-node uptime actually play?
18. What role does blockchain ANT actually play?
19. Does ANT move on-chain?
20. Is ANT locked, delegated, signed, proven, referenced, or untouched?
21. What is "antenglement" technically?
22. What happens when the ANT node goes offline?
23. What identity links ANT node ↔ Eddie ↔ blockchain address?
24. Is that relationship publicly linkable?
25. What Sybil resistance exists?
26. What conservation invariant exists?
27. What recovery mechanism exists?
28. What settlement/finality model exists?

Then compare these primitives against:

Silent Pay v2
FeePlan
b-meter receipts
payment/delivery state machines
ANT settlement adapter
RAiD identity/capabilities

Classify each useful component:

ADOPT / ADAPT / WRAP / WATCH / BUILD

Do not recommend integration based on conceptual similarity alone.
Require implementation evidence.
```

**Working hypothesis carried alongside (interpretation, NOT evidence):** Eddies
may be a parallel credit/obligation system whose earning logic associates with
ANT-node operation — distinct in kind from a settlement/bridge mechanism. The
architectural resemblance worth testing is the shared separation of
**earning/participation → capability/credit → payment instruction → eventual
settlement** against our **funding authority → usage/metering → receipt →
settlement** (Silent Pay v2 / FeePlan / b-meter). The interesting reuse
candidate, IF soundness is established, is an obligation/receivable
representation for machine economies — not "another currency" behind `b`.

**STATUS (2026-09-15, founder-approved marker):**

```text
EDDIES / ANTENGLEMENT

Evidence state:
  Discord primary-source material       HAVE — in-tree as relayed transcription;
                                        verbatim originals in founder/Claude-seat custody
  Screenshot                            HAVE — clue list in-tree; file in founder custody
  Independent public search             DONE — no useful specification found (two seats)
  How Eddies Work artifact              MISSING
  Source code                           UNKNOWN
  Protocol specification                UNKNOWN

Architecture state:
  NOT ADOPTED
  NOT AN ANT SETTLEMENT RAIL YET
  NOT ASSUMED TO BE MONEY/STABLECOIN
  NOT ASSUMED TO COLLATERALIZE ANT

Current classification:
  WATCH / INVESTIGATE

Next evidence threshold:
  Obtain How Eddies Work artifact and/or implementation source.
```

Seat stopped here by founder order 2026-09-15 — bounded mission complete at
`5b445216`; no Eddies speculation beyond this marker until the threshold is met.

**STATUS REFRESH (2026-09-16) — wake condition (1) FIRED: implementation evidence banked.**
Full investigation: [`docs/dispatches/2026-09-16-eddies-workerb-wake-investigation.md`](../dispatches/2026-09-16-eddies-workerb-wake-investigation.md).

```text
EDDIES / ANTENGLEMENT — 2026-09-16 refresh

Evidence state:
  How Eddies Work artifact               STILL MISSING (superseded in practice)
  Implementation source                  PARTIAL — public frontends read:
                                         eddiesexchange.com + dweb.eddiesexchange.com
                                         (Vite SPAs, 53 JS/WASM assets fetched static-only,
                                         incl. Farm/escrow/loans/market chunks + Rust DBC
                                         wasm wallet); SERVER code not public (no repo found)
  Live invoice object                    FETCHED (founder-supplied payment URL →
                                         GET /api/payment-requests/<id>, unauthenticated
                                         200 JSON; sender "eddde"; no signature/hash on object)
  28-question brief                      WORKED — 16 FACT / 9 partial / 3 INFERENCE-leaning;
                                         binding question answered: NOTHING cryptographic
                                         binds the Eddie obligation to ANT or scratchpad state

Artifact contents status: the "How Eddies Work" artifact itself never arrived;
its implementation is public instead. eddde claims: 2 graduated (in shape),
1 partially resolved, 1 contradicted-for-token-leg ("SAFE Network native"),
1 graduated-as-naming ("antenglement" = feature tag, no quantum mechanics).

Founder ruling adopted (2026-09-16): hybrid application — official ANT ERC-20
on Arbitrum One (reference + merkle-day purchase only; no lock/bridge/escrow;
treasury constant dead on-chain) + Autonomi scratchpad persistence (encrypted
client vaults + public registries; site content pinned by shard address) +
clearnet server-authoritative ledger. NOT an Autonomi-native monetary rail.

Architecture state:
  NOT ADOPTED — operator-centered authority fails verifier separability
  NOT AN ANT SETTLEMENT RAIL (ANT moves only to buy merkle-days, to an EOA)

Current classification:
  WATCH (upgraded from WATCH/INVESTIGATE; evidence bar met for classification,
  not for adoption — ADOPT/ADAPT/WRAP all rejected at this evidence state)

Next evidence threshold (if anyone resumes): server-side source or operator
disclosure — settles Q12/Q13/Q14/Q26 (expiry, repudiation, double-spend,
conservation) definitively; plus the real-euro settlement leg of loans.
```

## 2 · OPENA2A / AIM (+ org standards family) — OPEN · recon receipted 2026-09-15, WATCH (research-class)

*Received 2026-09-15, founder re-task order: "switch from parked Eddies to
OpenA2A/AIM + OpenCompany reconnaissance. Research only; no integration yet."
Full source-verified recon: [`docs/dispatches/2026-09-15-protocol-recon-opena2a-aim-opencompany.md`](../dispatches/2026-09-15-protocol-recon-opena2a-aim-opencompany.md) (seat zCode, baseline `b20d4477`).*

- **Resolved:** OpenA2A = agent-SECURITY org (opena2a.org, Apache-2.0), NOT the
  A2A communication protocol — citation law banked. AIM = its
  agent-identity-management tool: Ed25519 identity, 5-step FGA
  (Capability→Attribute→Context→Chain→Intent, NanoMind classifier),
  deny-before-execute at tool-call boundaries, append-only audit (JSONL/PG),
  8+9-factor trust scoring; Go server, Python/Java/TS SDKs; cloud / self-host /
  local modes. The charter's AIP/AAP/ATX resolve as OpenA2A-internal standards
  (names only, unread).
- **Adjacency (FACT-level; boundary evaluation DEFERRED to this seat, post
  reconciliation gate):** same object family as bzDiD Layer-0 + capability
  crate + dispatch-receipt discipline (§12 boundaries #4/#7); cloud/server
  shapes sit against the adapter-ring rule (#6) and first-party-only law —
  only local/self-hosted shapes are even candidates.
- **Next evidence threshold:** code-level read of FGA enforcement points,
  audit-event schema, trust-score inputs; the `did:opena2a` method spec; A2A
  v1.0 spec pages (task-state enum, auth, Agent Card URL) for the name-trap's
  other side.

## 3 · OPENCOMPANY — OPEN · REFERENT RESOLVED: `tinyhumansai/opencompany` · WATCH (research-class)

*Same order and recon receipt as item #2.*

- **Premise correction:** "OpenCompany" does not resolve to one project —
  five-plus live referents banked in the dispatch (citation law: never travel
  unqualified). Dominant = zeenie-ai/OpenCompany (905★, MIT, local-first "OS
  for AI employees", team-of-agents per employee, 148 tools, no MCP/A2A
  claim). Closest-to-our-shape = tinyhumansai/opencompany (169★, Rust,
  `company.toml` + human sign-off points, ~22 example companies) but carries
  **GPL-3.0** and a **hosted Medulla orchestrator** (`TINYHUMANS_API_KEY`) —
  both estate-law ruling questions (licensing posture; adapter-ring).
  Also-rans: useopencompany workspace (MIT), opencompanybot.com (commercial
  company-registration-for-agents), the archived pre-AI open-company Clojure
  family (the pure name-trap).
- **Referent RESOLVED by founder, 2026-09-15:** *"OpenCompany disambiguation
  resolved: `tinyhumansai/opencompany` is our intended target. Bank that
  identification, but keep WATCH/research-only until the reconciliation gate
  opens protocol evaluation."* The target is the Rust "hive mind of agents"
  project — zeenie-ai and the other candidates revert to name-traps for our
  purposes.
- **Gate CLARIFIED by founder, 2026-09-15 (verbatim):** *"Evaluate
  `tinyhumansai/opencompany` for reusable open protocols, interfaces and
  primitives compatible with our fully decentralized adapter/plugin/dApp
  architecture. Treat hosted Medulla as non-core/non-required; do not redesign
  Beehive around it. Record GPL-3.0 as a licensing constraint, not a founder
  decision request. Resume research."*
- **Gate REFINED by founder, same day (verbatim):** *"Licensing is not an
  evaluation gate for this reconnaissance. Evaluate tinyhumansai/opencompany
  strictly for reusable protocols, interfaces, primitives, and patterns that
  can be operated within Beehive's decentralized adapter/plugin/dApp
  architecture. A mandatory hosted Medulla dependency is incompatible; useful
  components must be separable/replaceable."* — the recon's criterion is
  architectural separability; GPL-3.0 rides as recorded fact, never as the
  gate.
- **DEEP READ DONE 2026-09-15** →
  [`docs/dispatches/2026-09-15-opencompany-tinyhumans-deep-read.md`](../dispatches/2026-09-15-opencompany-tinyhumans-deep-read.md):
  Medulla resolved NON-CORE at source (zero mentions in AGENTS.md's
  architecture; core = local Axum host on 127.0.0.1:8080, self-hosted
  "reports nothing"; hosted tier = separate opencompany-microservices control
  plane) · GPL-3.0-only org-wide incl. vendored OpenHuman submodule →
  **recorded fact, NOT an evaluation gate — separability/replaceability is
  the criterion (founder refinement)** · six reusable candidates mapped
  (org-as-config company bundles; append-only ledger with
  fold; storage port traits; runtime-loaded bundles; toml-declared human
  sign-off points ≈ our GREEN/YELLOW/RED; OpenHuman harness as separate
  WATCH) · one residual UNKNOWN (local deep-orchestration quality) flagged.
- **Next thresholds (reuse seat, post-gate):** read `docs/spec/runtime/`
  (ports/ledgers/hivemind/orchestration) + company-as-agent + security specs;
  code-level read of `src/ledger/` fold semantics; compare org-as-config
  against our mission system BEFORE any schema is ruled.
- **Reconciliation gate applies** as to every item; nothing here drives
  implementation.

## 4 · OPEN-SOURCE E-CASH FAMILY — OPEN · recon receipted 2026-09-16, reuse-first class (research-only)

*Received 2026-09-16, founder roll-forward order (Eddies workerb): "identify
existing open implementations of the useful DBC ideas—offline bearer notes,
acceptance windows, signed transfer receipts, double-spend detection—then
compare them against bPay's bounded-authority/private-receipt architecture.
Reuse before invention; no Eddies dependency." Full source-verified recon:*
[`docs/dispatches/2026-09-16-ecash-family-recon.md`](../dispatches/2026-09-16-ecash-family-recon.md).

- **Candidates verified at source:** **CDK** (cashubtc/cdk — Rust wallet AND
  mint crates, Apache-2.0/MIT, ALPHA-but-real-sats, NUT-00–30 near-full incl.
  NUT-24 HTTP 402 + NUT-27 Nostr backup) = **REUSE-FIRST**; **Cashu
  protocol** (MIT; Blind-DH Chaumian blinding; NUT-12 DLEQ offline proofs) =
  ADAPT-STUDY; **Fedimint** (MIT; federated threshold-blind-sig mints) and
  **GNU Taler** (GNU exchange+auditor model, headline-verified only) = WATCH;
  **sn_dbc** (maidsafe; BSD/MIT dual; distributed sharded spentbook, BLS,
  stealth addresses; SAFE-era dormant) = WATCH with Autonomi-lineage note —
  almost certainly the vocabulary ancestor of Eddies' DBC naming.
  dan-gould DBC line = dead pointer (404; author now leads PDK).
- **The four ideas:** offline bearer notes = fully solved open (Cashu
  strings + DLEQ); **acceptance windows = NO open spec analog** (NUT-02 is
  keysets-and-fees, not validity; nearest kin = our invoice/expiry laws +
  Taler contract deadlines, unread at depth); signed transfer receipts =
  nobody needs them in bearer world (the note IS the transfer — our
  SpendReceipt keeps its own slot); double-spend = four open answers
  (mint-check / federation / exchange+auditor / distributed spentbook);
  Eddies' bloom-gossip offline-probabilistic variant has NO open
  implementation — structural reason recorded (soundness requires an
  online/federated/anchored checkpoint).
- **bPay fit:** e-cash occupies the offline-bearer slot bPay deliberately
  leaves open (never replaces SpendReceipt); NUT-10 spending conditions are
  the nearest open kin to capAssert — THAT comparison is the load-bearing
  threshold; mints/exchanges are third-party endpoints → adapter-mediated
  only (self-hosted cdk-mintd the only ring-compatible shape); NUT-24 ↔ our
  five x402 laws = convergence check before any meter extension; every
  family answers "what backs the note" by construction (sats peg /
  federation / reserves+auditor / network-native) — exactly the property
  Eddies lacked.
- **Licenses: MIT/Apache/BSD-MIT across the family — zero GPL. Zero Eddies
  dependency.** Post-gate thresholds + verdicts: reuse seat's.

---

## B · BOUNDARY-FIT EVALUATION — zArcheology input (2026-09-16, post-gate; founder order: landed research only, no integration)

The ten stable bPay boundaries (ARCHITECTURE-RECONCILIATION §12; law at
docs/RULINGS-2026-09-16.md): CanonicalEvent schema · SpendReceipt wire law · x402 five-law
set · capAssert signing boundary · suite-keyed crypto-agility seam · adapter-ring rule ·
bzDiD Layer-0 + capability tiers · vending rate-row shape · Intent primitive semantics ·
Payment/Delivery state separation.

### B.1 · x402-rs V2 — ADOPT (seam) + ADAPT (scheme set); facilitator DESIGN held as PROPOSAL

Evidence: Workerb 2 deep-read + facilitator DESIGN, in-tree
`docs/dispatches/2026-09-16-workerb2-x402rs-deep-read-facilitator-design.md` (main @`e97b8bdb`;
x402-rs@main read at that seat, source ledger inside).

- **ADOPT — the `Facilitator` trait / `SchemeRegistry` seam, verbatim** (boundaries: adapter-ring,
  x402 law set): registry/trait split with injectable wire types and named test doubles IS the
  replaceability mechanism R5 asks for — the same law as our trait-fronted fail-closed seams.
- **ADAPT — the payer-authorization scheme set** (EIP-2612 permit + gas sponsoring, EIP-3009
  authorization windows, Permit2 proxies, ERC-6492/1271 smart-account validation): exactly the
  replaceable-settlement-adapter shape; 6492 lets 7702-delegated EOAs compose later with zero
  facilitator change. capAssert discipline governs our side of the door.
- **ADAPT — `pending_nonce_manager`** for facilitator-side multi-inflight handling, plus our own
  idempotent-settle journal keyed by auth nonce (watchpay ledger laws; Payment/Delivery boundary).
- **DIRECT KINSHIP — the headline:** x402-rs `upto` ≡ vending `upto` ceiling ≡ watchpay
  approve-ceiling-vs-actual (vending rate-row boundary). These semantics are ALREADY EXECUTED in
  estate tests — implementation evidence, not aspiration. This is the strongest verdict on the board.
- **HELD:** the "x402 door" box facilitator DESIGN (spec-grade PROPOSAL: exact + upto, daily gas
  cap, root-owned key 600, HumanGate no-auto-retry, settle-tx evidence into receipts) awaits
  founder chartering. No integration per standing order.

### B.2 · OpenA2A / AIM — WATCH (all targets; pattern notes only)

Evidence: `docs/dispatches/2026-09-15-protocol-recon-opena2a-aim-opencompany.md` (@`b5211079`+;
research verdicts all WATCH; OpenA2A ≠ A2A law — the Google comms standard is a separate object).

- AIM's Ed25519 agent identity is single-algorithm with no rotation law — against the bzDiD
  Layer-0 + crypto-agility boundary it cannot be adopted; the estate's primitive is ratified and
  implemented (capability crate, 60 tests).
- AIM's 8/9-factor trust scoring WRITES a score — collides with the constitution's
  confidence-from-provenance / reputation-emergent-never-written invariants. Pattern-WATCH only.
- Its 5-step fine-grained authz overlaps our UCAN-shaped capability tiers (ours live); the heavy
  server + SIEM adapters sit against the adapter-ring rule.

### B.3 · tinyhumansai/OpenCompany — WATCH + two pattern-ADAPT rows

Evidence: `docs/dispatches/2026-09-15-opencompany-tinyhumans-deep-read.md` (@`bb3856c6`; founder
rulings banked verbatim: hosted Medulla NOT mandatory; criterion = separable/replaceable behind
the decentralized adapter/plugin/dApp boundary).

- Pattern-ADAPT: declarative org shape (`company.toml` — roles, ownership, human sign-off points)
  rhymes with the estate's mission desk/room/ledger rail — pattern reuse only, no dependency
  (the org-shape candidates touch neither identity nor money, so no identity-boundary conflict).
- Pattern-ADAPT: runtime-loaded bundles + adapter seams = the adapter-ring rule practiced
  elsewhere; confirms our boundary shape.
- WATCH constraints stand: GPL-3.0 (licensing ≠ eval gate per founder, but a future-adoption
  constraint), "APIs will change without notice" WIP, hosted tier EXCLUDED by the founder's test.
  zeenie-ai/OpenCompany = name-trap, separate object.

### B.4 · Eddies/antenglement — REMAINS GATED

Item #1 unchanged: the "How Eddies Work" primary artifact is still missing; no evaluation until
it arrives (founder paste remains the only road in).

*Verdict classes per queue law. The x402-rs rows carry implementation evidence (estate-executed
`upto` semantics); all other rows are research-class WATCH/pattern notes. No integration
performed. — zArcheology seat, 2026-09-16.*
