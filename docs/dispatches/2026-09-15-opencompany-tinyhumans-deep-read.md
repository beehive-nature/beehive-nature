# OPENCOMPANY (tinyhumansai) — DEEP READ · Medulla resolved non-core, primitives mapped · 2026-09-15

**Order (founder, verbatim):** *"Gate clarified: evaluate `tinyhumansai/opencompany`
for reusable open protocols, interfaces and primitives compatible with our fully
decentralized adapter/plugin/dApp architecture. Treat hosted Medulla as
non-core/non-required; do not redesign Beehive around it. Record GPL-3.0 as a
licensing constraint, not a founder decision request. Resume research."*
**Order REFINED (founder, verbatim, same day):** *"Licensing is not an evaluation
gate for this reconnaissance. Evaluate tinyhumansai/opencompany strictly for
reusable protocols, interfaces, primitives, and patterns that can be operated
within Beehive's decentralized adapter/plugin/dApp architecture. A mandatory
hosted Medulla dependency is incompatible; useful components must be
separable/replaceable."* — the evaluation criterion below is ARCHITECTURAL
SEPARABILITY; GPL-3.0 rides as recorded fact, never as this recon's gate.
**Seat:** zCode, resuming the paused recon lane. **Mode:** research only — zero
code, zero deps, zero adoption; pattern-lane only (the licensing constraint
forces that anyway). **Baseline** `origin/main`; worktree `../wt-zcode-recon`,
branch `zcode/recon-opena2a-aim-opencompany-2026-09-15`. **Companion:** the
multi-target recon dispatch (same date) — this file is the deep dive its §4 +
the founder's disambiguation ordered.
**Method receipts:** live fetches this session — tinyhumansai org page, repo
git-tree API, root `Cargo.toml`, root `AGENTS.md`, `crates/opencompany-core`
listing, `docs/` + `docs/specs/` + `docs/spec/` listings. Individual spec files
(ports/ledger/orchestration) NOT yet read — enumerated only, left to the reuse
seat.

## 0 · The one-screen read

| question | answer at source |
|---|---|
| Is hosted Medulla mandatory? | **NO for the core host.** Medulla appears nowhere in `AGENTS.md`'s architecture; the core runs as a local binary (`opencompany serve` → Axum on 127.0.0.1:8080); hosted orchestration is a separate deployment wrapper |
| What is the hosted tier then? | `opencompany-microservices` superproject ("opencompany-manager control plane… builds this crate into a per-tenant container") + the README's "deep orchestration tier" (Medulla, `TINYHUMANS_API_KEY`) |
| Licensing | **GPL-3.0-only** (workspace.package field; LICENSE 34,886 B = GPLv3 text); the WHOLE tinyhumansai Rust ecosystem is GPL-3.0, incl. the vendored OpenHuman submodule and nested TinyAgents. Recorded fact — explicitly NOT an evaluation gate for this recon (founder refinement) |
| Evaluation gate | **Architectural separability/replaceability**: a component qualifies if it operates behind our decentralized adapter/plugin/dApp boundary with the hosted tier absent; a MANDATORY hosted Medulla dependency would be incompatible (resolved: it is NOT mandatory). Six reusable candidates mapped (§3), for the reuse seat POST-GATE |
| Residual UNKNOWN | whether the "deep orchestration tier" quality has a full local equivalent (the local orchestration crates exist by name: tinyflows/tinyloops in the vendored stack) — not proven either way by docs read |

## 1 · The org behind the repo (zoom-out the recon missed)

[tinyhumansai](https://github.com/tinyhumansai): 45 repos, all-Rust, GPL-3.0
(unless noted), all active 2026-09-14→16. The parent is **openhuman**
(~39.8k★) — "open-source agent harness with local-first memory, agent
orchestration, and workflows"; opencompany is a thin declarative layer over it.
opencompany's `Cargo.toml` proves the depth: workspace =
`opencompany-core` (lib + `opencompany` bin) + `opencompany-tui` (terminal
client that **embeds the host**); LLM-side crates (tinyinference, tinymemory,
tinycortex, tinyflows, whisper-rs-sys) enter via **patch tables redirecting to
vendored checkouts under `vendor/openhuman/vendor/…`**; OpenHuman itself is a
**vendored git submodule** (`AGENTS.md`: "the vendored runtime source is the
vendor/openhuman/ Git submodule"); TinyAgents is inherited nested inside it
(`vendor/openhuman/vendor/tinyagents/`, gated behind a `tiny` feature).
Ecosystem siblings worth names: tinymcp (MCP support), tinyhivemind ("hive-mind
mechanics", **license field empty — default all-rights-reserved, avoid**),
medulla (13★ Shell, "terminal for supervising fleets of coding agents" — a
SECOND object with the same name; license empty), tinymemory/tinycortex
(memory), opencompany-microservices (the hosted control plane).

## 2 · Medulla — the founder's question, answered at source

- **The core host is local and complete without any hosted service.**
  `AGENTS.md`: `cargo run --bin opencompany -- serve` starts "the Axum HTTP
  server on 127.0.0.1:8080"; the TUI embeds the host; "an instance with no
  hosted env vars **is treated as self-hosted and reports nothing**."
- **Medulla has zero mentions in `AGENTS.md`.** The hosted orchestration story
  lives in the README ("Every event… lands on a deep orchestration tier…,
  unlocked with a `TINYHUMANS_API_KEY`") and in the separate
  `opencompany-microservices` control-plane superproject — deployment wrappers,
  not core dependencies.
- **Telemetry law (README, prior recon):** self-hosted builds compile WITHOUT
  the network client ("getting one out of that state takes a recompile");
  hosted tenants send usage counts only; `OPENCOMPANY_ANALYTICS=off`.
- **Verdict per the founder's rule:** Medulla = non-core, non-required for
  everything we would study. The primitives below run on the local host. We do
  not redesign anything around it, and if it were ever mandatory for a
  primitive we wanted, that primitive is simply not ours to take.
- **Residual UNKNOWN (flagged, not guessed):** whether the "deep orchestration
  tier" *quality* (full-picture fan-out) exists locally via tinyflows/tinyloops
  or is hosted-only. Local EXECUTION is proven; local deep ORCHESTRATION is
  unproven. The spec corpus (`docs/spec/runtime/` — "ports, ledgers, hivemind,
  orchestration docs" per the README index) is where the reuse seat would
  settle it.

## 3 · Reusable protocols, interfaces, primitives, patterns — six candidates (post-gate)

1. **Org-as-config (the company bundle).** Every example company under
   `companies/` is a runtime-loaded bundle: `company.toml` + `agents/*.toml`
   (+ `prompts/*.md`) + `ledgers/*.toml` + `skills/*/SKILL.md` +
   `workflows/*.toml` + `tasks.toml` + `mcp.json` + workspace playbooks; shared
   material in `companies/_globals/` ("embedded at build time"). Ten-plus
   worked examples (accounting_firm with ledgers closes/exceptions/filings;
   consultation_firm; customer_support; design_studio; enterprise_sales;
   game_business; game_studio; e2e fixtures). **Estate rhyme:** our mission
   system (desk/room/ledger, mission-core) + agent roster + dispatch
   discipline — same family, different license.
2. **Append-only ledger with declared record shapes.** `AGENTS.md` on
   `src/ledger/`: "declared record shapes, **the append-only fold**, and the
   derived/ folder they render into." **Estate rhyme:** our hex-chain receipts,
   dispatch corpus, fieldnotes logbook — and §12 boundary #1 (CanonicalEvent
   bus) is the seam this maps onto.
3. **Storage port traits as the entire persistence contract.**
   `docs/spec/runtime/ports.md`; MongoDB selectable via `OPENCOMPANY_STORAGE`.
   A genuine adapter seam — the same law as our adapter-ring, practiced
   upstream.
4. **Runtime-loaded bundles + build-time globals** — the plugin/deployment
   shape the founder's adapter/plugin/dApp boundary asks for.
5. **Human sign-off points declared in `company.toml`** ("humans in the loop
   where it counts", per-company reserved decisions: capital, taste,
   strategy). **Estate rhyme:** the Buzz Box autonomy addendum's
   GREEN/YELLOW/RED — same operational concept, declaratively expressed.
6. **The OpenHuman parent harness itself** (local-first memory, orchestration,
   workflows; ~39.8k★) as a separate WATCH object — same GPL-3.0-only
   constraint, so pattern-lane only as well.

**Licensing — recorded fact, not this recon's gate (founder refinement,
verbatim in the header):** GPL-3.0-only is org-wide and reaches through the
vendored submodule tree; that fact travels with any future adoption decision,
where clean adapter/plugin boundaries and independently licensed components
remain the founder's stated preference. It does NOT filter what this recon
evaluates: the criterion is whether a component is **separable/replaceable**
behind our decentralized adapter/plugin/dApp boundary. All six candidates
below pass or fail on that test, not on their license. (`medulla` and
`tinyhivemind` carry NO license file — default reserved; noted for the
record.)

## 4 · Compatibility screen vs estate law (research-class)

The founder's test governs: **a component qualifies only if separable and
replaceable behind the decentralized adapter/plugin/dApp boundary — a
mandatory hosted dependency is incompatible.** Applied: the core host's local
shape (127.0.0.1:8080 binary, self-hosted "reports nothing", telemetry
compile-time-excluded) is compatible by construction with nodes-on-the-box +
first-party-only + adapter-ring; the hosted tier is excluded (not merely
avoided), and nothing in the six candidates DEPENDS on it. `mcp.json` is
client-side tool config — our laws would govern whatever it points at, and
nothing of ours points anywhere today. No conflict found at pattern level
with single-relay, canonical-origin, or wallet-ceremony laws — nothing in the
candidates touches identity or money; their scope is org-shape and
work-shape.

## 5 · Next thresholds (reuse seat, post-gate)

1. Read the spec corpus: `docs/spec/runtime/` (ports, ledgers, hivemind,
   orchestration), `company-as-agent/`, `company-brain/`, `security/`,
   `glossary.md` — settle the local-orchestration UNKNOWN.
2. Code-level read of `src/ledger/` fold semantics (append-only fold +
   derived/) against our receipt-chaining laws.
3. If the parent harness ever matters: openhuman deep read (GPL-3.0-only,
   pattern-lane only).
4. Compare org-as-config against our mission system's desk/room/ledger design
   BEFORE any schema is ruled — same comparison the queue's reconciliation
   gate already orders.

## Citation law addendum

**"Medulla" is two objects in one org:** the hosted orchestration tier
(README's deep-orchestration service behind `TINYHUMANS_API_KEY`) and a
separate 13★ Shell repo ("terminal for supervising fleets of coding agents").
Cite which. Carried: opencompany (tinyhumansai) ≠ OpenCompany (zeenie-ai) ≠
open-company (Clojure); OpenA2A ≠ A2A; AIM = agent-identity-management; ANT =
Autonomi.

## Landing receipt

Queue item #3 updated in the same commit: founder gate-clarification banked
verbatim, deep-read receipt, status → WATCH (pattern-lane, post-gate next
thresholds). §7 seat shape, four pre-push checks, branch +
main pushed. Eddies untouched; OpenA2A/AIM item unchanged.
