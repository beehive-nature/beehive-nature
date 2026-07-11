# CONSTITUTION.md — Beehive Nature Reserve Kernel

**Status: DRAFT v0.1 — for founder review. Amendment process (Article VI) contains decisions only the founder can make.**

---

## Preamble

> **The Beehive Nature Reserve Kernel is a coordination kernel, not an application framework.**

The kernel defines immutable *semantics* — not implementations. Storage networks, blockchains, AI systems, hardware devices, databases, transport layers, and user interfaces are **adapters** that may evolve independently, and will be replaced over decades, so long as they preserve the kernel's contracts. This document freezes semantics, never technology. Its model is POSIX: specify behavior, outlive every implementation.

---

## Article I — Canonical Primitives

The kernel defines exactly seven semantic objects. Nothing above the kernel invents new ones.

1. **Identity** — Who is acting?
2. **Intent** — What is desired?
3. **Event** — What occurred?
4. **Evidence** — What can be proven?
5. **Knowledge** — What is considered true?
6. **Resource** — What capabilities are required?
7. **Settlement** — How value and resources are allocated?

**Reserved: Capability** — grants attached to identity (may sign escrow, arbitrate, delegate, operate an AI). Reserved on repeated independent emergences (CapabilityGrant object; architectural review; the zero-prompt UX requirement, which is implemented as budget-scoped session-key grants). May be built as an application-layer object immediately; promoted to the eighth primitive via the amendment process when AI agents, delegation, or organizations become first-class citizens.

**Orthogonality of Evidence.** Evidence is not a layer. Every primitive and every adapter may emit evidence; it flows through the stack rather than occupying a position within it.

---

## Article II — Invariants

Every compatible implementation must preserve these guarantees:

| Primitive | Invariant |
|---|---|
| Identity | Every action is attributable to a sovereign identity that survives device loss, vendor death, and key compromise. |
| Intent | Every requested action is declarative, not procedural. Intents describe outcomes; planners produce execution plans; workers execute. Intent never executes itself. |
| Event | Every completed action produces an immutable, replayable fact. |
| Evidence | Every claim carries provenance (source class, method, device, confidence). Confidence is computed from provenance, never assigned by popularity or authority. |
| Knowledge | Every derived fact is append-only and attributable. Knowledge is never overwritten; it is versioned, each version referencing its predecessor. |
| Resource | Requirements are expressed as abstract capabilities with constraints, never as named technologies. |
| Settlement | The economy settles; it does not define rewards. Reward schemes are policies above the kernel. |
| Reputation | Reputation is emergent — deterministically recomputed from evidence and knowledge, never written directly, never reduced to a single universal score by the kernel. |

**Identity invariants, further specified:**
- Records key off the **DID** (stable identifier), never raw public keys. Key rotation must never orphan data.
- The rotation log records **key algorithm**, not just key material. Signature schemes migrate by ordinary rotation (crypto-agility). A kernel that hardcodes one curve has an expiry date.
- Attestation is tiered (software key → secure enclave/passkey → dedicated hardware) and recorded as **evidence, not status**. Application policy, not the kernel, decides what tier an action requires.
- Cross-identity links (e.g., root ↔ social persona) are verifiable only when **bidirectional**: each side publishes a signed reference to the other.

---

## Article III — Adapter Philosophy

Everything outside the kernel is an adapter to external reality. Three kinds:

- **Sense adapters** observe reality and emit CanonicalEvents and Evidence: chain watchers (SHIP streams, daemons), carrier APIs, sensors, wearables, cameras, **AI models** (whose outputs are Evidence with provenance `AIInference` — never truth, never authority).
- **Action adapters** change reality: broadcast transactions, release escrow, store blobs, send messages, issue credentials.
- **Identity adapters** authenticate actors: passkeys, secure enclaves, hardware wallets, future hardware.

**Rules:**
1. **The CanonicalEvent schema is the lingua franca of the kernel** — a constitutional interface, versioned, never broken. The kernel speaks no chain's native language.
2. **Chains are capability adapters, not platform.** Each implements a named capability (e.g., `settlement.private`, `coordination.ledger`, `permanence.anchor`, `storage.sovereign`). Global ordering (settlement) and parallel throughput (storage) are different capabilities, not different speeds; neither substitutes for the other.
3. **Services communicate only through the event bus.** Consumers subscribe to facts; services never call each other directly.
4. **Downward-only dependencies.** Higher crates depend on lower crates; never the reverse. Traits are separated from implementations.
5. Planners emit **resource requirements** (encrypted, durable, cost < X), never technology choices. The resolver binds requirements to providers at runtime.

---

## Article IV — The Verification Principle

> No external performance, security, or scalability claim shall become a kernel assumption until verified against an integration checklist and reproducible tests.

Documentation, whitepapers, and marketing are provisional. Testnet behavior, source code, and passing test vectors are facts. Precedents: the Zano fee-buffer discovery, multisig RPC verification, SLIP-0010 source confirmation, Autonomi throughput claims held at arm's length.

---

## Article V — Economics

1. **The kernel SHALL NOT require continuous operator subsidy for normal operation.** Users fund the resources they consume; nodes are paid for capabilities they provide. The paymaster *abstracts* user-funded payment; it must never *absorb* cost. Acceptable standing costs are limited to bootstrap seeds and specification/reference-code maintenance.
2. **Bootstrap is temporary; decentralization is permanent.** Trust during bootstrap is minimized and removed after (the installer model).
3. **Settlement is finite by design.** Identity, storage, messaging, evidence, and knowledge scale without global coordination; ordered settlement does not, and most interactions must never require it.
4. The resource token is metabolic energy — an accounting mechanism for consumption — and is itself a **reference implementation** of the Resource/Settlement invariants, not a constitutional truth.

---

## Article VI — Versioning and Amendment

1. **Stability over freezing.** Enduring protocols (TCP/IP, HTTP, Git) evolved by explicit versioning, not immutability. Canonical objects carry versions; new versions must not break existing consumers (additive evolution; deprecation windows measured in years).
2. **The kernel evolves slower than everything above it.** Applications iterate freely; adapters iterate with their networks; primitives and invariants change only by amendment.
3. **Amendment process** *(founder decisions required — placeholders)*:
   - Proposal: written RFC stating the invariant affected, the motivation, and the migration path.
   - Proof: a working reference implementation and tests before adoption.
   - Ratification: Ratified 2026-07-11 (Epoch-0). The full §3 mechanism lives at docs/article-vi-s3.md (sha256 d6960ddf…cc9c) and is constitution, not commentary. Changing it is a meta-tier amendment under its own §3.3(c).
4. **Reference implementations are not the protocol.** Autonomi, Zano, Vaulta, Arweave, Trezor, the b-token, and the Rust workspace are today's implementations of constitutional semantics. Any may be replaced without amendment, provided invariants hold.

---

## Article VII — Explicit Non-Goals (outside the Constitution)

The kernel deliberately does not contain:

1. **Philosophy.** Interpretive frameworks (Hawkins, Human Design, physiocracy, any tradition) live in interpretation plugins that project kernel evidence through a chosen worldview. Subjective worldviews never become consensus mechanisms.
2. **A universal reputation score.** The kernel stores evidence; communities choose their own deterministic `ReputationEngine` implementations.
3. **AI.** AI is a replaceable sense adapter producing evidence. The kernel remains deterministic.
4. **Named technologies.** No blockchain, storage network, vendor, database, transport, or model is constitutional.
5. **Domain claims.** Medical, political, and economic theses are application/plugin content, never protocol assumptions.
6. **Rewards policy.** The kernel settles; incentive design is application-layer.

---

## Appendix — Current Reference Implementations (informative, non-constitutional)

| Capability | Reference implementation (2026) |
|---|---|
| `identity.root` | Autonomi-anchored DID (self-authentication; rotation log in mutable register) |
| `identity.persona` | did:plc (Bluesky) — linked persona, bidirectionally attested; depends on PLC directory, hence never the root |
| `identity.hardware` | Trezor via frozen `messages-zano.proto` v0.3 |
| `identity.mobile` | Secure Enclave / StrongBox / passkeys (Tier 1 default) |
| `settlement.private` | Zano (multisig escrow + confidential assets; fee-buffer constraint verified; marketplace denomination fUSD — over-collateralized USD-pegged confidential asset, swappable via `(amount, asset_id)`) |
| `coordination.ledger` | Vaulta/EOS (SHIP ingest; DRO contract) |
| `storage.sovereign` | Autonomi |
| `permanence.anchor` | Arweave |
| `event.runtime` | b-indexer (chain adapters → normalizer → bus) |
| `resource.accounting` | b-token (paymaster abstracts a user-funded basket — Vaulta RAM/CPU/NET, ZANO gas, AR, ANT — and never subsidizes) |
