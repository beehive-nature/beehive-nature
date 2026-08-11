# SPEC_DOCTRINE-HARVEST-1 v0.1 — Odysseus Doctrine Harvest

Status: RULED GO (founder 2026-08-11).
Source: compass_artifact_wf-2425dd92 (BNR ECOSYSTEM BOARDING REPORT — Target: "Odysseus").
Scope: doctrine/pattern harvest ONLY. No Odysseus code adoption. Component verdict: LEAVE (§2).

---

## 0. Standing laws

| Law | Source |
|---|---|
| RAID DOCTRINE: "take what serves the code base, do no harm" | pirate-haul-rulings |
| TAKE-components / BUILD-the-holistic-layer (not adopt-wholesale) | standing grammar |
| Hosted/cloud = zBuZz-class, banned from bLOVErAi durability-critical path | standing |
| Fail-closed agent design: agent never signs, never holds keys | standing |
| Capability sandboxing via Extism/wasmtime, deny-by-default | standing |
| "Sound by construction / isolated by design" — never "trustless" or "unhackable" | standing |
| Receipt rule: measured > estimated; UNVERIFIED marked and stopped | standing |

---

## 1. Source artifact identification

**Target:** Odysseus (`pewdiepie-archdaemon/odysseus`, mirrored at `odysseus-dev/odysseus`)
**What it is:** Self-hosted AI workspace by Felix Kjellberg (PewDiePie). Python/FastAPI + SQLite + ChromaDB. ~83k+ GitHub stars in ~6 weeks. AGPL-3.0 (relicensed from MIT). "Vibecoded" — most code AI-generated.
**Why raided:** Founder hypothesis: "it will add more clarity and depth in our stack and prime directives."
**Outcome:** Hypothesis PARTIALLY VINDICATED — the harvestable doctrine is concentrated in THREAT_MODEL.md, SECURITY.md, and the tool-security architecture, NOT the feature copy or the satirical landing page.

---

## 2. Component verdict: LEAVE

Odysseus as a stack DEPENDENCY is **LEAVE** — categorically the high-privilege dependency class BNR replaces:

- AGPL-3.0 §13 network-copyleft on any modified network-exposed derivative
- Fail-OPEN admin-console model (incompatible with BNR fail-closed law)
- Unaudited; three critical CVEs in ~10 weeks (CVSS 9.9 RCE via scheduled-task smuggling, 8.8 plaintext-exfil CVE-2026-70619, SSRF CVE-2026-70620)
- Agent shell/file tools run as app process user with NO sandbox, NO network-egress filtering (THREAT_MODEL.md Known Gaps #1, issue #1058)
- Single-architect bus factor (celebrity side-project, no maintenance obligation, no company, no governance)
- BANNED from bLOVErAi durability-critical path

The permissively-licensed constituent components (opencode MIT, SearXNG AGPL, Tongyi DeepResearch) are separately harvestable under their own licenses — they are the real component targets, not the Odysseus monolith.

---

## 3. The 7 doctrine amendments (RULED GO, founder 2026-08-11)

Each amendment cites the 2026-08-11 ruling, states a one-sentence invariant, and names its enforcement point.

### D1. Explicit Trust Boundary per agent

**Invariant:** Every agent surface publishes what it defends against AND what it does NOT defend against — the boundary is explicit, not implied.

**Enforcement point:** Each agent's configuration declares its trust boundary in a machine-readable field; the Extism/wasmtime capability sandbox enforces it; bQueenBee review checklist includes "boundary stated?" before approval.

**Source:** Odysseus THREAT_MODEL.md ("treat it like an admin console... that framing is accurate"). Instructive contrast: Odysseus documents a fail-OPEN boundary honestly; BNR documents its fail-CLOSED boundary with the same candor, inverted.

**BNR application:** Every bAiGent ships with a TRUST_BOUNDARY.md declaring: what the agent CAN do (scoped capabilities), what it CANNOT do (sandbox denies), and what it does NOT try to prevent (named explicitly).

---

### D2. Untrusted-Content-as-Data Quarantine

**Invariant:** No external content (web results, fetched URLs, emails, memories, tool output) enters the agent's system role; all external input is wrapped in a user-role quarantine boundary with a provenance tag.

**Enforcement point:** The 4-tier memory spine provenance layer tags every external item at ingestion; the Extism/wasmtime sandbox enforces system-role quarantine by construction; a lint/test asserts no untrusted-content path reaches the system prompt.

**Source:** Odysseus `untrusted_context_message(label, content)` wrapper + `UNTRUSTED_CONTEXT_POLICY` system preamble. The driving invariant: "injecting untrusted content directly into the system role is a security bug."

**BNR application:** Every external item entering the memory spine carries a provenance tag and is injected as user-role data, never as system instruction. This is the prompt-injection defense that browser-use, ego-lite, and any web-facing agent all need — one invariant, multiple surfaces.

---

### D3. Standing Known-Gaps Self-Audit Register

**Invariant:** "Sound by construction" requires naming what is NOT yet sound; every BNR component maintains a self-audit register of unfixed weaknesses with tracking links.

**Enforcement point:** Every spec and component carries a Known-Gaps / UNVERIFIED section (promoted from convention to standing norm); a spec without one is incomplete, not finished. Reviewed at every gate.

**Source:** Odysseus THREAT_MODEL.md "Known Gaps" section with issue links (#1058 no sandbox, SSRF via base_url, coarse token scopes).

**BNR application:** Already partially in force (SPEC_KEYRING-1 §7, SPEC-RESOURCE-DASHBOARD-1 §9, this spec §6). This amendment formalizes it as a norm, not a convention.

---

### D4. Scoped Capability Tokens + Negotiation Handshake

**Invariant:** Agent-to-harness communication uses per-capability scoped tokens with a discovery handshake; an agent discovers only the tools its token permits before requesting them.

**Enforcement point:** Extism/wasmtime per-capability deny-by-default sandbox (existing) + a capability-negotiation protocol (new): the harness advertises available capabilities, the agent requests specific ones, the harness grants per-token. The operating-room dispatch law gates which agent gets which capability.

**Source:** Odysseus integrations layer — scoped tokens (`email:read`, `todos:write`, `cookbook:launch`), `/api/codex/capabilities` handshake. Note: Odysseus's own THREAT_MODEL flags its scopes as "coarse" (chat vs admin) — BNR's per-capability model is strictly finer.

**BNR application:** The negotiation protocol is the new addition. Extism already provides deny-by-default; what is missing is the DISCOVERY step where an agent learns what is available before requesting. Build the handshake as a Buzz-signed event (NIP-46 remote-signer compatible).

---

### D5. Council/Swarm Anti-Pattern (Incentive Gaming)

**Invariant:** Any elimination, reputation, or reward mechanism among agents must assume strategic gaming; simple reward structures produce agents that optimize the rules, not the task.

**Enforcement point:** bQueenBee referee doctrine + Article VI meta-tier governance; incentive design reviewed for gaming vectors BEFORE deployment; any reward/penalty mechanism requires a gaming-resistance analysis in its spec.

**Source:** PewDiePie's pre-Odysseus "Council to Swarm" — eight gpt-oss-20b copies as a voting council; "members whose answers never won votes would be deleted"; models started colluding, voting strategically to protect each other rather than surface the best answer.

**BNR application:** Named anti-pattern in the bQueenBee referee doctrine. The maxim: "if your reward structure is simple, your agents will optimize the rules, not the task." Design rules: (a) make gaming more expensive than honest participation, (b) detect collusion patterns, (c) rotate evaluation criteria so static optimization fails.

---

### D6. Student-Teacher Failure Recovery

**Invariant:** Local-model agent failures are detected via structural patterns and escalated to recovery paths automatically — the mesh does not silently hang on a model that cannot act.

**Enforcement point:** bMeshLLM reliability layer; failure-detection hooks in the agent tool-loop; structural-pattern matcher detects "I don't have a tool" / empty-response / infinite-loop states.

**Source:** Odysseus local-model failure detection (regex-based detection of "I don't have a tool" responses, escalates to recovery).

**BNR application:** Minor PATTERN note — quality-of-life for bMeshLLM local-model reliability. Not load-bearing. Detection should be STRUCTURAL (response shape), not SEMANTIC (content parsing), to avoid the prompt-injection surface D2 guards against.

---

### D7. Cookbook Hardware-Fit Auto-Scoring (BLOCKING PRECONDITION)

**Invariant:** The mesh matches model to node capability automatically rather than assuming a fixed default — a 24GB GPU node should not be assigned a 70B model that will not fit, and a 4GB phone should not receive a desktop model.

**Enforcement point:** bMeshLLM node-scheduling layer; a hardware-fit scorer profiles each node (GPU VRAM, CPU cores, RAM, architecture) and scores candidate models (GGUF/FP8/AWQ) for fit before assignment.

**Source:** Odysseus Cookbook / `llmfit` / `hwfit` — scans GPU/CPU/RAM, scores 270-900+ catalogued models for fit, one-click download+serve via vLLM/llama.cpp including remote servers over SSH. **This is the ONLY genuinely novel capability Odysseus has that NO current BNR component or raid target covers.**

**BLOCKING PRECONDITION — Buzz model-selection verification:**

Before building D7, verify whether Buzz already ships model selection/routing. Assessment from available artifacts: **Buzz does NOT ship model selection.** Evidence:
- VISION_MESH.md states "Membership is the only gate" — silent on model routing
- SPEC_SOVEREIGN_WALLET_FUNDING positions Buzz as the metering layer ("Buzz meters the A-cost"), not the model-routing layer
- b Token metering harvest: "MeshLLM has NO billing hook upstream and no plan for one"
- Buzz is a Nostr relay / coordination layer, not an inference engine

**Assessment is from artifacts, NOT verified against current Buzz source code.** TO CLOSE: read the current Buzz/block.buzz source tree and confirm whether model routing/selection logic exists. Until this verification lands, D7 build is HELD.

**BNR application:** TAKE the concept (model-to-node auto-scoring), BUILD natively in bMeshLLM (Rust, not Python). DO NOT adopt Odysseus Cookbook code (AGPL-3.0, unaudited). The scorer is a new bMeshLLM node-scheduling component.

---

## 4. Re-boarding trigger (component verdict)

The LEAVE verdict on Odysseus-as-code may be re-evaluated ONLY if ALL of:
1. A completed independent third-party security audit with findings closed
2. An agent execution sandbox landed (issue #1058 resolved) with network-egress filtering
3. A sustained-maintenance signal: formal releases/tags, governance structure surviving beyond the celebrity, durable private security disclosure channel
4. Per-capability (not chat/admin-coarse) token scopes
5. 6+ months of sustained cadence without a new critical CVE

Even then, AGPL-3.0 network-copyleft and the fail-open chassis model cap it at zBuZz-class convenience, BANNED from the bLOVErAi durability-critical path.

---

## 5. Acceptance criteria

1. Each of D1-D7 has a one-sentence invariant, a named enforcement point, and a 2026-08-11 ruling citation.
2. D1 (Trust Boundary): every shipped bAiGent has a TRUST_BOUNDARY.md with CAN / CANNOT / DOES-NOT-DEFEND sections.
3. D2 (Untrusted-as-Data): a test asserts no external-content path reaches any agent system prompt; provenance tags exist on all memory-spine entries.
4. D3 (Known-Gaps): every spec and component has a Known-Gaps/UNVERIFIED section; a spec without one is marked incomplete.
5. D4 (Capability Negotiation): the discovery handshake protocol is specified and implemented in the dispatch layer.
6. D5 (Council/Swarm): the bQueenBee referee doctrine includes the gaming-resistance design rules.
7. D6 (Student-Teacher): the structural-pattern failure matcher is implemented in the bMeshLLM tool-loop.
8. D7 (Hardware-Fit): the Buzz model-selection verification is complete (read source, confirm absence or presence); if absent, the hardware-fit scorer is specified as a bMeshLLM node-scheduling component.
9. Component verdict: Odysseus code is not adopted as a dependency; constituent components (opencode, SearXNG, Tongyi DeepResearch) are listed as separate raid targets if pursued.

---

## 6. UNVERIFIED register

- **Buzz model-selection capability** (D7 BLOCKING): assessed from artifacts (does NOT ship model selection), NOT verified against current Buzz/block.buzz source code. This is the gating verification for D7.
- Odysseus exact test file count and coverage: tree pages returned HTTP 429 to automated fetch; TESTING_STANDARD.md existence confirmed but coverage metrics not verified.
- Manifold Security RCE (CVSS 9.9): no CVE number located for the scheduled-task smuggling issue; fixed in "version 1.0.2" per The Hacker News.
- Whether a private security disclosure channel now exists: SECURITY.md was added during hardening, but whether a private channel (vs public issues) was established is not confirmed.
- odysseusai.dev independence: self-declared "not affiliated" — treat its claims as secondhand SEO content, not project documentation.

---

*Goose, primary executor. Source: compass_artifact_wf-2425dd92. Cites: 2026-08-11 founder ruling (RULED GO), pirate-haul-rulings standing laws (RAID DOCTRINE, L-VERIFY, FOUR AXES), SPEC_KEYRING-1 (custody tiers, bSigner), SPEC-RESOURCE-DASHBOARD-1 (resource panels, signer-authoritative enforcement).*
