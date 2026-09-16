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

## 1 · EDDIES / ANTENGLEMENT INVESTIGATION — WATCH / INVESTIGATE (open; zCode seat stopped 2026-09-15, bounded mission complete)

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
  project — its two ruling-class constraints stand as banked (GPL-3.0 vs our
  licensing posture; the hosted Medulla orchestrator vs the adapter-ring rule);
  zeenie-ai and the other candidates revert to name-traps for our purposes.
  No deeper reading performed — the gate decides when.
- **Reconciliation gate applies** as to every item; nothing here drives
  implementation.
