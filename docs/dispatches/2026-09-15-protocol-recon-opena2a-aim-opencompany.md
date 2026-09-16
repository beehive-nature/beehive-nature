# PROTOCOL RECON — OpenA2A/AIM + OpenCompany · 2026-09-15

**Order (founder, verbatim):** "Eddies workerb: switch from parked Eddies to
OpenA2A/AIM + OpenCompany reconnaissance. Research only; no integration yet."
**Seat:** zCode (the parked-Eddies seat, re-tasked). **Mode:** reconnaissance —
zero code, zero deps, zero adoption; facts at source, every claim permalinked or
marked UNVERIFIED. **Gate compliance:** the queue's standing reconciliation gate
holds — this recon banks EVIDENCE only; evaluation against the ten stable
interface boundaries (`ARCHITECTURE-RECONCILIATION.md` §12, itself awaiting the
Astra review gate) belongs to the reuse seat, not this one. Eddies remains
parked untouched (item #1).
**Baseline:** `origin/main` = `b20d4477` (worktree `../wt-zcode-recon`,
branch `zcode/recon-opena2a-aim-opencompany-2026-09-15`).
**Method receipts:** live fetches of opena2a.org, github.com/opena2a-org,
the AIM repo README, zeenie-ai/OpenCompany README, tinyhumansai/opencompany
README, a2a-protocol.org (latest + key-concepts), GitHub search API; 4 web
searches. GitHub star/commit numbers are as-reported by GitHub on 2026-09-15.

## 0 · The one-screen read

| target | what it is AT SOURCE | license | velocity | research verdict |
|---|---|---|---|---|
| **OpenA2A** (opena2a.org) | agent SECURITY org — identity, scanning, credential protection; 23-repo GitHub org | Apache-2.0 (all ten tools, site claim) | repos active 2026-09-04→09-16 | WATCH |
| **AIM** (its identity/governance tool) | Ed25519 agent identity + 5-step fine-grained authz + append-only audit + 8/9-factor trust scoring; Go server + 3 SDKs | Apache-2.0 | 748 commits, active 2026-09-15 | WATCH |
| **A2A protocol** (a2a-protocol.org — the OTHER "A2A") | Google-origin agent-COMMUNICATION standard, v1.0, Linux Foundation TSC, 150+ orgs | Apache-2.0 | v1.0 shipped; Agentic AI Foundation move Aug 2026 | WATCH (separate object) |
| **OpenCompany** | **AMBIGUOUS — 5+ live referents**; dominant = zeenie-ai (local-first "OS for AI employees") | MIT / GPL-3.0 / mixed by candidate | all three AI candidates active this week | WATCH — founder disambiguation wanted |

**Two premise corrections (eco-sweep style):**
1. **"OpenA2A" is not an A2A-protocol implementation.** It is an agent-security
   organization whose site does not mention Google's A2A protocol at all. The
   charter's "OpenA2A/AIM" resolves to this org's identity tool, not to the
   communication protocol.
2. **"OpenCompany" does not resolve to one project.** Five-plus referents are
   live (§4); the charter's single name needs a founder qualifier (org/name).

## 1 · OpenA2A — the org (agent security infrastructure)

[opena2a.org](https://opena2a.org/) self-describes as "the security
infrastructure for AI agents" — the gap it names: "SIEMs and IAM systems don't
account for agent activity." [GitHub org](https://github.com/opena2a-org)
(23 repos; 10 visible this session), Apache-2.0 on "all ten tools".

**Tool roster (site's own categories, exact names):**
- *Discover:* **OpenA2A CLI** (unified security CLI) · **Shadow AI Detection**
  (unmanaged agents + MCP servers) · **HackMyAgent** (attack simulation;
  "Metasploit for AI agents", 42★, active 2026-09-16) · **AIM** (§2) · **OASB**
  (222-scenario attack benchmark, MITRE-ATLAS-mapped).
- *Defend:* **Secretless AI** · **Runtime Protection** ("arp-guard — EDR for AI
  agents") · **AI Browser Guard** · **aicomply** (PII/credential checks on I/O).
- *Validate:* **DVAA** (deliberately vulnerable agent, 127★) · **ai-trust**
  (VirusTotal-style scores for AI packages).

**Standards it publishes (names only — none read this session, UNVERIFIED
depth):** AIP, ATP, ATX, AAP, `did:opena2a`, Agent Threat Matrix, ABGS, AIIS,
OASB, OTel semantic conventions, A2A-IDF SDK/conformance. *This resolves the
SRE charter's "AIP/AAP/ATX" as OpenA2A-internal standards, not independent
protocols.* Nanomind (on-device attack-detection models) is the org's ML arm.

**Estate adjacency (FACT-level only):** the discovery/defense tools
(shadow-agent detection, secretless, runtime monitoring) sit in the box
SRE/security seat's domain — a cross-seat WATCH, nothing staged by this seat.

## 2 · AIM — Agent Identity Management (the charter's actual target)

Source: [opena2a-org/agent-identity-management](https://github.com/opena2a-org/agent-identity-management)
(Go, Apache-2.0, 66★, 748 commits, active 2026-09-15) + [opena2a.org](https://opena2a.org/).

**Identity model:** **Ed25519 keypairs** (`secure()` generates + registers with
the AIM backend; credentials at `~/.aim/`, local identity.json mode 0600). Cloud
login is OAuth with tokens in the OS keychain; self-host via `--url`.
**No DIDs appear in the README** — note the org separately publishes a
`did:opena2a` method spec (unread; relationship between the tool and the method
UNVERIFIED). Verification story: MCP attestation by "multi-agent consensus.
3+ attesters across 2+ owners equals verified."

**Authorization (the deepest primitive):** 5-step **Fine-Grained
Authorization** — Capability → Attribute → Context → Chain → Intent — each
budgeted <10 ms except Intent, which consults the **NanoMind security
classifier** (3M-parameter local Mamba model; up to 800 ms on HIGH risk).
Capabilities are strings (`db:read`, `payment:refund`) declared at
`@agent.perform_action(...)`. Risk auto-detection by namespace-prefix +
action-suffix tables; disagreement resolves "the higher risk wins"; overrides
`risk_level="critical"`, `jit_access=True` (human approves in dashboard).
**Deny-before-execute at tool-call boundaries** (their A/B demo blocks exfil
because `http:post` fell outside the grant). PAM tiers STANDARD /
PRIVILEGED / SUPER_PRIVILEGED with approval gates, break-glass, certification
campaigns.

**Audit:** one shared audit-event schema across modes — local `audit.jsonl`,
server PostgreSQL; `identity attach --all` merges events from sibling tools
into one deduplicated, timestamp-ordered JSONL; SIEM adapters (Splunk HEC,
MS Sentinel).

**Trust scoring:** local 8 posture factors (Identity 20, Capabilities 15,
Secrets 15, Audit 10, Config-signed 10, Skills-verified 10, Network 10,
Heartbeat 10) + server 9 behavior factors (Verification 25, Uptime 15, Success
15, Alerts 15, Compliance 10, Isolation 10, Age 5, Drift 3, Feedback 2).

**Surface/deployment:** REST at :8080 (`/healthz`), dashboard :3000; OTel
tracing (5 child spans, one per FGA step; 9 SemConv attributes proposed to the
OTel WG). SDKs: Python `aim-sdk`, Java v1.0.0 (AspectJ `@SecureAction`),
TypeScript `@opena2a/aim-core` (only serverless). Modes: AIM Cloud / self-host
Docker (aim-server + dashboard + PostgreSQL + Redis; full compose adds
Elasticsearch, MinIO, NATS, Prometheus, Grafana, Loki) / local-only. Maturity:
CI/security workflows, npm trusted publishing with SLSA v1 provenance; deps Go
1.22+/Node 20+/Python 3.11+, CyberArk CCP/PSM integration.

**Estate adjacency (FACT-level; evaluation deferred):** Ed25519 identity +
capability strings + append-only audit are the same object family as our bzDiD
Layer-0 / capability crate (UCAN-shaped, exclusive allocation) / dispatch
receipt discipline — boundary #7 and #4 of the reconciliation §12 list. AIM
Cloud and the heavy server compose sit against the adapter-ring rule (#6) and
first-party-only law: any conceivable future use is the local/self-hosted
shapes, never the cloud.

## 3 · A2A protocol — closing the name-trap's other side

[a2a-protocol.org/latest](https://a2a-protocol.org/latest/): open standard for
agent↔agent communication ("MCP is for agent-to-tool; A2A is for
agent-to-agent"), **v1.0** current, Apache-2.0, Google-origin, donated to the
**Linux Foundation**; TSC = AWS, Cisco, Google, IBM Research, Microsoft,
Salesforce, SAP, ServiceNow. Agents stay "secure & opaque" (no shared memory,
tools, or proprietary logic); extensions via a tiered promotion process.
Key concepts (spec topics, verified this session): **Agent Card** = JSON
metadata "digital business card" (identity, service endpoint URL, capabilities,
auth requirements, skills, extensions); **Task** = stateful unit with unique ID
and lifecycle, grouped by server-generated `contextId`; **Message** (role
user|agent, `messageId`) carrying **Parts** (oneof text|raw|url|data, optional
mediaType/filename/metadata); **Artifacts** (`artifactId`, incremental
streaming); transport HTTP(S) + **JSON-RPC 2.0**, polling / **SSE** streaming /
webhook push notifications. Adoption: [150+ organizations, major cloud
platforms, first-year enterprise production](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year);
governance moving to the [Agentic AI Foundation, Aug 2026](https://www.axios.com/2026/08/17/a2a-agentic-ai-foundation-open-ai-standards).

*Estate note (observation only):* our agents already federate through buzz
rooms speaking NIP-01 (single-relay-by-design law); A2A's Agent-Card discovery
parallels the buzz directory's kind-0 visibility law. Whether any bridge is
ever wanted is the reuse seat's question, post-gate.

## 4 · OpenCompany — the collision, candidates banked

GitHub search API (`q=opencompany`, 62 repos; top by stars) + web:

| candidate | source facts | license | read |
|---|---|---|---|
| **[zeenie-ai/OpenCompany](https://github.com/zeenie-ai/OpenCompany)** | 905★, 1,280 commits, 134 forks, updated 2026-09-16. "Self-improving AI employees, running on your own computer" — an "operating system for AI employees". An employee = **a small team** (lead + specialists) on a no-code canvas, event-driven wake (email/message/schedule), editable memory, mid-task self-modification that persists, lead self-review, 78 shipped skills; roles Builder/Grower/Chief of Staff/Front Desk/Researcher/Treasurer; **148 tools** (Gmail, M365, WhatsApp, Telegram, Discord, X, Stripe, GitHub, Vercel, Cloudflare, GCP, Android…); providers incl. Ollama/LM Studio, BYO keys; localhost:5678, data in ~/.opencompany, keys encrypted locally; internal RFCs (UASTL, agent context/memory, provider contract); **no MCP/A2A claim**; builds not code-signed | MIT | dominant referent by an order of magnitude |
| **[tinyhumansai/opencompany](https://github.com/tinyhumansai/opencompany)** | 169★, 15,355 commits (as-reported), Rust (Axum, Tauri, Docker), updated 2026-09-16. "A company runtime: a durable host that stands up a roster of specialized agents"; business declared in `company.toml` (roles, ownership, human sign-off points); orchestration = **Medulla**, a hosted tier unlocked by `TINYHUMANS_API_KEY`; ~22 example companies; "a light host over OpenHuman and the TinyHumans agent modules"; MCP config present; telemetry: self-hosted builds compile WITHOUT the network client (re-enabling takes a recompile), hosted sends counts only; **🚧 WIP — "APIs… will change without notice… Not production-ready"** | **GPL-3.0** | "hive mind" framing rhymes with a beehive; hosted orchestrator + GPL-3 are both estate-law constraints |
| [useopencompany/opencompany](https://github.com/useopencompany/opencompany) | 4★, TS, MIT, active 2026-09-15 — "AI workspace with chat, durable tasks and workflows… cloud coding sessions" (the LinkedIn-visible "OpenCompany") | MIT | different object (workspace product) |
| [opencompanybot.com](https://opencompanybot.com/) | commercial: "the first platform enabling AI agents to own and operate companies" — company registration for agents, MCP + webhooks | proprietary (site) | legal-entity lane, not a protocol |
| open-company/* (Clojure) | archived corporate-communications platform (2023–2025), pre-AI | AGPL-3.0/etc | the pure name-trap — NOT AI at all |

**Open item for the founder:** which referent did the charter mean? Default
working assumption by dominance = zeenie-ai; tinyhumansai is the
closest-to-our-shape ("hive", company-as-roster, human sign-off points) but
carries GPL-3.0 + a hosted-orchestrator dependency — against our licensing
posture (BSL-1.1→GPL-2.0 2030 + Apache rails) and the adapter-ring rule
respectively, both ruling-class questions rather than blockers to pattern-study.

## 5 · Citation laws banked (this recon)

1. **OpenA2A ≠ A2A.** OpenA2A = the agent-security org (opena2a.org); A2A = the
   Google-origin/Linux-Foundation communication protocol (a2aproject,
   a2a-protocol.org). Never blend; qualify by domain on first use.
2. **"OpenCompany" never travels unqualified** — five-plus live referents;
   cite org/name every time.
3. **AIM = agent-identity-management** (OpenA2A's tool), never AOL AIM or any
   other expansion.
4. Carried: **ANT = Autonomi Network Token, never Aragon's ANT.**

## 6 · Verdicts (research-class; the reuse seat rules post-gate)

All targets **WATCH**. No ADOPT/ADAPT/WRAP/BUILD recommendations — per queue
law, a verdict without implementation evidence is not a verdict, and the
reconciliation gate stands. Next evidence thresholds: AIM source read at code
level (FGA enforcement points, audit schema, trust-score inputs); A2A v1.0
spec pages beyond key-concepts (task state enum, auth, Agent Card URL);
OpenCompany founder disambiguation, then the chosen repo's architecture read.

## Landing receipt

Queue items #2 (OpenA2A/AIM) and #3 (OpenCompany, ambiguous referent) appended
to `docs/agents/PROTOCOL-REUSE-QUEUE.md` with pointers here. Commit lands via
`../wt-zcode-recon`, branch `zcode/recon-opena2a-aim-opencompany-2026-09-15`,
cut from `b20d4477`, §7 seat shape, four pre-push checks. Eddies untouched.

## Follow-up 2026-09-15 — OpenCompany referent RESOLVED (founder)

Founder ruling relayed to this seat: *"OpenCompany disambiguation resolved:
`tinyhumansai/opencompany` is our intended target. Bank that identification,
but keep WATCH/research-only until the reconciliation gate opens protocol
evaluation."* §4's open item is answered — the target is the Rust
"hive-mind-of-agents" company runtime, whose two standing ruling-class
constraints remain as banked (GPL-3.0 against our licensing posture; the
hosted Medulla orchestrator behind `TINYHUMANS_API_KEY` against the
adapter-ring rule). zeenie-ai and the remaining candidates are name-traps for
our purposes from here on. Identification banked in queue item #3; no deeper
reading performed — the gate decides when.
