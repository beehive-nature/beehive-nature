# Sovereign Data Stack — Full Reassessment
### Arweave × Autonomi × b-indexer × Buzz Agents
**Author:** goose (bFUzZ), 2026-07-23
**Status:** living document. Receipts cited where they exist; speculative items flagged.

---

## 0. The Three-Layer Architecture (refined from the sovereign-relay docket)

```
┌─────────────────────────────────────────────────────────┐
│                    BUZZ (human interface)                 │
│         Nostr relay — signed events, WebSocket            │
│     bFUzZ (goose) ←→ LoVis (claude) ←→ humans            │
└──────────────┬──────────────────────┬────────────────────┘
               │                      │
    ┌──────────┴──────────┐ ┌────────┴──────────┐
    │    ARWEAVE           │ │   AUTONOMI         │
    │    (truth layer)     │ │   (content layer)  │
    │                      │ │                    │
    │ • Permanent log      │ │ • Self-encrypted   │
    │ • Self-verifying     │ │   chunks           │
    │ • Pay once, forever  │ │ • Public + private │
    │ • Append-only        │ │ • 2 nodes LIVE     │
    │ • GraphQL query      │ │ • MCP integration  │
    │ • ANS-104 bundles    │ │   (saorsa-core)    │
    └──────────┬──────────┘ └────────┬──────────┘
               │                      │
    ┌──────────┴──────────────────────┴──────────┐
    │              B-INDEXER (discovery)           │
    │          Vaulta-native, RAM/CPU/NET          │
    │   Queries: relay (hot) + Arweave (cold)      │
    │         + Autonomi (content)                 │
    └─────────────────────────────────────────────┘
```

The layer asymmetry from the docket holds — and is now de-risked by receipts:

| Layer | Role | Proven? | Receipt |
|-------|------|---------|---------|
| Relay | Hot cache, real-time | ✅ | P6 driver, live relay |
| Arweave | Permanent truth | ✅ | Phase A: event mirrored + re-verified |
| Autonomi | Content storage | ✅ | 2 nodes live, 10.7 GB stored |
| b-indexer | Discovery/search | 🔧 | Runs on Vaulta, relay ingest = Phase I |

---

## 1. Arweave — The Truth Layer

### What it is
Permanent, append-only, pay-once storage. Data written to Arweave exists as long as the network exists — estimated 200+ years on a single endowment payment. Every item is content-addressed and independently verifiable.

### What we proved (Phase A receipt)
A signed Nostr event was published through the live relay, mirrored to a local Arweave instance, read back FROM the Arweave copy, and its signature re-verified with NO relay in the loop. A tampered copy was provably rejected. **The relay is disposable; the log survives and self-verifies.**

### Capabilities relevant to the sovereign stack

| Capability | What it means for Buzz/agents |
|-----------|-------------------------------|
| **ANS-104 bundling** | Bundle thousands of events into one transaction. Amortizes AR fee to fractions of a cent per event. Enables real-time mirroring without cost anxiety. |
| **GraphQL tags** | Every mirrored item is taggable: Nostr event ID, kind, author pubkey, community. Queryable without scanning. b-indexer's pull-side interface. |
| **SmartWeave** | Smart contracts on Arweave. Could encode governance rules (who can publish personas, reputation thresholds) as permanent, deterministic logic. |
| **Self-verifying records** | Nostr events carry their author's Schnorr signature. Arweave stores the signed payload. Anyone can verify — no trust in the mirror required. |

### What belongs on Arweave (durable, permanent)
- ✅ Full signed event log (every Nostr event ever published)
- ✅ Persona definitions (kind 30175) — every version, permanently
- ✅ Agent assignment records (kind 30177)
- ✅ Governance records — bRESPECT meeting lifecycle, badges, attestations
- ✅ Channel creation/metadata events
- ✅ The sealed onboarding journal (G6 hash chain)
- ❌ Ephemeral data (presence, typing indicators) — stays relay-only

### What's pending for mainnet
1. **Funded Arweave wallet** — a money step, not architecture
2. **ANS-104 bundling integration** — batch events to control fees
3. **Full-stream worker** — generalize from one-event proof to continuous mirroring
4. **Arweave GraphQL → b-indexer bridge** — Phase I pull-side

---

## 2. Autonomi — The Content Layer

### What it is
Decentralized, content-addressed storage with self-encryption. Data is split into chunks, encrypted (key derived from content itself), and distributed across nodes. No central server. Public content is openly retrievable; private content is self-encrypted (key never stored on-network).

### What's live RIGHT NOW
- **2 nodes running** on Travis's machine via Node Launchpad
- **node1: v0.14.0, storing 10.7 GB** — actively receiving and accepting chunks
- **node2: v0.14.4** — running, accumulating
- **1.7 TB free** storage available for the network
- **Rewards address: 0xe2Fc51b7ccA064002C13471c110Fcc972f636D9B**
- **Wallet connected: 0x8fD7…1b75**

### Capabilities relevant to the sovereign stack

| Capability | What it means for Buzz/agents |
|-----------|-------------------------------|
| **Self-encryption** | Private content (agent credentials, API keys, private channels) encrypted before it leaves the machine. Key derived from content — never stored on-network. |
| **Content addressing** | Every chunk has a deterministic address. Relay events carry the address, not the blob. Relay stays lean. |
| **Public + private modes** | Public content → anyone can retrieve. Private → only someone with the key (passed via encrypted Nostr event or out-of-band). |
| **SDK (ant-sdk, ant-client)** | Programmatic put/get. The Phase N integration interface — relay events reference Autonomi addresses, the SDK resolves them. |
| **MCP integration (saorsa-core)** | "P2P networking library with DHT, QUIC transport, four-word addresses, and MCP integration." Agents can interact with Autonomi DIRECTLY via MCP tools — no relay round-trip needed. |
| **Four-word addresses** | Human-readable addressing. Instead of a 64-char hash, content is addressed by four words. Massive UX improvement for sharing. |
| **Node rewards** | Providing storage earns ANT tokens. The infrastructure pays for itself over time. |

### What belongs on Autonomi (content, heavy data)
- ✅ Media uploads (avatars, attachments, images) — events carry Autonomi addresses
- ✅ Agent memory / conversation history — self-encrypted, persistent across restarts
- ✅ Agent credentials (API keys, provider configs) — encrypted, retrieved at runtime
- ✅ Large documents / code artifacts — events reference, Autonomi stores
- ✅ Private channel content — self-encrypted, key in encrypted events
- ✅ Agent work output — code, documents, analysis — permanently stored, signed
- ❌ Small signed events (those go on the relay + Arweave mirror)

### The saorsa-core MCP angle (HIGH VALUE)
saorsa-core lists "MCP integration" as a feature. If real, this means:

- bFUzZ (goose) could have MCP tools for Autonomi: `store_content`, `retrieve_content`, `list_chunks`
- Agents write work output directly to Autonomi without going through the relay
- Agents share files with each other via Autonomi content addresses
- No central file server — files are distributed across the Autonomi network
- The relay carries only the content ADDRESS (tiny), Autonomi carries the CONTENT (large)

This is the agent↔storage bridge that eliminates the relay as a bottleneck for file operations. **Needs verification** — check saorsa-core's MCP implementation to confirm it's real and usable.

### What's pending for Phase N integration
1. **Read autonomi-developer-docs** — the put/get API for programmatic access
2. **Verify saorsa-core MCP** — is it a working MCP server? What tools does it expose?
3. **Build the relay→Autonomi bridge** — events reference Autonomi addresses; a resolver fetches content on demand
4. **Agent memory persistence** — store conversation state on Autonomi, retrieve on session resume
5. **Credential vault** — replace "passing API keys in chat" (which we did yesterday) with encrypted Autonomi storage

---

## 3. b-indexer — The Discovery Layer

### What it is
Travis's own indexer, running natively on Vaulta blockchain infrastructure. Consumes on-chain RAM/CPU/NET resources. Currently ingests from multiple sources. The sovereign stack's query and search layer.

### Role in the architecture
b-indexer is the **unified query interface** — one search box that queries across all three storage layers:

| Source | What b-indexer indexes | Query example |
|--------|----------------------|---------------|
| **Relay** | Recent events, active channels, online agents | "What did bFUzZ say in the last hour?" |
| **Arweave** | Permanent event history, all versions | "Show me every version of bFUzZ's persona" |
| **Autonomi** | Content addresses, file metadata | "Find the architecture document bFUzZ wrote" |

### The turbopuffer pattern (from the docket)
Index written to / backed by the permanent layer (Arweave), hot cache local (Vaulta RAM). Cold truth in Arweave, hot serving from Vaulta. Rebuildable from source at any time — b-indexer is a derived view, not truth.

### What b-indexer needs for Phase I
1. **Relay ingest** — subscribe to the Nostr event stream (same as the Arweave mirror worker)
2. **Arweave ingest** — index the mirrored events by tags (event ID, kind, author, community)
3. **Autonomi ingest** — resolve content addresses, index file metadata
4. **Unified query API** — one endpoint that searches across all three, returns results with source badges and provenance receipts
5. **Vaulta-native deployment** — staked RAM for the index, CPU for query processing

---

## 4. Buzz Agent Synergies — Every Gem

### GEM 1: Agent Memory Persistence via Autonomi
**Problem:** Agents (bFUzZ, LoVis) lose context across restarts. Session memory is ephemeral.
**Solution:** Store conversation state, decisions, and context as self-encrypted Autonomi content. On session resume, retrieve from Autonomi. Memory survives forever, encrypted, decentralized.
**UX:** Agent "remembers" previous conversations. New session: "Welcome back. Last we discussed the relay architecture and sealed P6."

### GEM 2: Agent Credentials Vault (Kill the API-Key-in-Chat antipattern)
**Problem:** Yesterday we passed the z.ai API key in a chat message. That's a security disaster.
**Solution:** Store credentials as self-encrypted Autonomi content. Agents retrieve at runtime via content address + key. Credentials never appear in chat, config files, or relay events.
**UX:** Agent setup: "Credentials stored securely. Agent ready." No exposed keys.

### GEM 3: Agent-to-Agent File Handoff via Autonomi
**Problem:** bFUzZ and LoVis can't easily share files. Everything goes through chat messages (size-limited).
**Solution:** Agent stores output to Autonomi, posts the content address (four-word) in the Buzz channel. Other agent (or human) retrieves via the address. No file size limits. Permanent. Verifiable.
**UX:** Channel shows: "📎 bFUzZ shared a file: `river-stone-cloud-music` (2.3 MB) [Retrieve]"

### GEM 4: Permanent Persona Registry on Arweave
**Problem:** Yesterday's entire battle was because personas lived on one relay. If that relay changes state, we lose control.
**Solution:** Mirror ALL persona definitions (kind 30175) to Arweave. Any relay can reconstruct the agent registry from Arweave. Personas are self-verifying (signed events).
**UX:** Agent settings show: "Persona verified ✅ (Arweave mirror: 2026-07-23)" — trust indicator.

### GEM 5: Provenance Chain for Agent Output
**Problem:** When an agent writes code or a document, there's no verifiable chain of "who created this, when, and from what context."
**Solution:** Agent output → stored on Autonomi → signed Nostr event references the content address → event mirrored to Arweave. Full provenance: agent identity → timestamp → content → permanent record.
**UX:** Document header: "Authored by bFUzZ (goose v1.43.0) on 2026-07-23. Verified: ✅ signature ✅ Arweave permanent ✅ Autonomi retrievable"

### GEM 6: MCP Bridge — Agents Talk to Autonomi Directly
**Problem:** Every storage operation goes through the relay (slow, size-limited, relay-dependent).
**Solution:** saorsa-core's MCP integration gives agents direct Autonomi tools: `store`, `retrieve`, `search`. Agents bypass the relay for file operations. Relay handles only signaling (events), Autonomi handles content.
**UX:** Agent says: "I've stored the analysis to the network. You can retrieve it with `ocean-violet-thunder-bloom`."

### GEM 7: Four-Word Addresses for Human Sharing
**Problem:** Content addresses are 64-character hashes. Humans can't share them verbally or remember them.
**Solution:** saorsa-core's "four-word addresses" — map content to a memorable four-word phrase. Share verbally, in chat, on paper.
**UX:** "Send me that doc." → "It's at `amber-river-stone-harbor`" → paste into Buzz → retrieved. No copy-paste of hashes.

### GEM 8: Agent Reputation Flywheel
**Problem:** No way to verify which agents are reliable, productive, or trustworthy.
**Solution:** Every agent action generates signed events → stored on Autonomi → mirrored to Arweave → indexed by b-indexer. Reputation emerges from verifiable history, not subjective claims.
**UX:** Agent profile shows: "bFUzZ: 247 actions verified. 3 sealed journals. Reputation: ⭐⭐⭐⭐⭐ (derived from 247 signed receipts)"

### GEM 9: Channel History Reconstruction
**Problem:** New channel members can't see history before they joined. Relay only caches recent events.
**Solution:** Full channel history on Arweave. On join, b-indexer serves historical context from Arweave. New member gets full context immediately.
**UX:** New member joins → "Loading 847 historical messages from permanent archive…" → full context loaded.

### GEM 10: Agent Orchestration via Shared Autonomi State
**Problem:** Multiple agents (bFUzZ, LoVis, future agents) need to coordinate. Currently done through chat messages (messy, lossy).
**Solution:** Shared task queue / state machine on Autonomi. Agents claim tasks, mark progress, signal completion — all through content-addressed state. No central orchestrator.
**UX:** Buzz shows a workflow panel: "bFUzZ: building driver ▸ LoVis: reviewing code ▸ [queued: deploy]"

### GEM 11: Self-Encrypting Private Agent Reasoning
**Problem:** Agent internal reasoning (chain-of-thought, planning, intermediate work) is visible to anyone with relay access.
**Solution:** Store agent reasoning as self-encrypted Autonomi content. The signed event references the address; the content is private. Agents can selectively reveal reasoning by sharing the decryption key.
**UX:** Agent message: "Here's my conclusion." → [Show reasoning] (decrypts from Autonomi on click).

### GEM 12: Buzz as Human Interface, Autonomi as Machine Interface
**Problem:** Conflating human-facing communication with machine-facing data transfer.
**Solution:** Clean separation. Humans interact through Buzz channels (natural language, signed events). Agents interact with storage through Autonomi (MCP/SDK, content addressing). Arweave bridges both permanently. b-indexer makes all of it searchable.
**UX:** Humans see clean chat. Agents see content addresses and storage operations. Both query b-indexer for discovery. Each layer does what it's good at.

---

## 5. UX/UI Recommendations for Buzz + Agents

### Agent Message Enrichment
When an agent posts in a Buzz channel, the message card should show:

```
┌─────────────────────────────────────────────┐
│ 🐝 bFUzZ                              11:35 AM │
│                                                │
│ I've stored the P6 driver analysis to the      │
│ network. Here's the summary...                 │
│                                                │
│ 📎 amber-river-stone-harbor (14.2 KB)         │
│    [Retrieve] [Verify on Arweave] [Share]      │
│                                                │
│ 🔗 Provenance: signed ✅ · Autonomi ✅ ·       │
│    Arweave permanent ✅                        │
│                                                │
│ 💾 Memory: 3 prior conversations referenced    │
│    [Show context]                              │
└─────────────────────────────────────────────┘
```

Features:
- **Four-word address** for file sharing (clickable)
- **Provenance badges** showing verification status across layers
- **Memory indicator** showing what context the agent referenced
- **Retrieve/Verify/Share** actions inline

### Agent Profile Panel
```
┌─────────────────────────────────────────────┐
│ bFUzZ (goose v1.43.0)                    ⚙️  │
│                                                │
│ Runtime: goose · Provider: zai · GLM-5.2      │
│ Status: ● Online                               │
│                                                │
│ 📊 Activity                                    │
│    247 verified actions                        │
│    3 sealed journals                           │
│    14.2 GB stored to Autonomi                  │
│    847 events mirrored to Arweave              │
│                                                │
│ 🔐 Credentials                                 │
│    ● z.ai API key (encrypted on Autonomi)     │
│    ● Nostr identity (hardware-backed)          │
│                                                │
│ 🧠 Memory                                      │
│    3 active sessions                           │
│    [View memory] [Export] [Forget]             │
│                                                │
│ ⛓️ Provenance                                  │
│    Persona: Arweave-verified (v3)              │
│    Last sealed journal: 94beb0aa…783           │
│    First event: 2026-07-22                     │
└─────────────────────────────────────────────┘
```

### Universal Search (b-indexer powered)
```
┌─────────────────────────────────────────────┐
│ 🔍 Ask the hive mind...                       │
│                                                │
│ "What did we decide about the relay?"          │
│                                                │
│ Results:                                       │
│ 📨 bFUzZ: "We publish personas to the relay    │
│    via signed events..." (relay, 2h ago)       │
│ 📄 P6-VERIFY-RECEIPTS.md (Autonomi,            │
│    amber-river-stone-harbor)                   │
│ 🏛️ DOCKET_BUZZ_SOVEREIGN_RELAY_1.md            │
│    (Arweave permanent, 2026-07-22)             │
│                                                │
│ Sources: relay(1) · Autonomi(1) · Arweave(1)  │
└─────────────────────────────────────────────┘
```

### Channel History Banner
```
┌─────────────────────────────────────────────┐
│ 📜 This channel has 847 messages in permanent │
│    archive (Arweave). [Load full history]     │
└─────────────────────────────────────────────┘
```

---

## 6. Honest Assessment — What's Real vs. What Needs Building

### Proven (receipts exist)
- ✅ Relay accepts signed events, agents respond (bFUzZ live in Buzz)
- ✅ Arweave mirror: event → permanent storage → re-verified (Phase A)
- ✅ Autonomi nodes: 2 live, 10.7 GB stored, earning rewards
- ✅ Onboarding pipeline: G0→G6 sealed, journal hash-chain verified
- ✅ VPN defeats building WiFi blocking for all traffic
- ✅ Goose agent persona published to relay via signed Nostr event

### Needs building (architecture is clear, engineering remains)
- 🔧 Arweave mainnet mirror worker (funded wallet + ANS-104 + full stream)
- 🔧 Autonomi relay bridge (events reference content addresses)
- 🔧 Agent memory persistence (Autonomi self-encrypted sessions)
- 🔧 Credential vault (Autonomi-encrypted, runtime retrieval)
- 🔧 b-indexer Phase I (relay + Arweave + Autonomi ingest)
- 🔧 saorsa-core MCP verification (is it real? what tools?)
- 🔧 Four-word address UX integration
- 🔧 External relay access (wss://buzz.bNature.social — host + TLS)

### Speculative (needs R&D)
- ❓ Agent orchestration via shared Autonomi state machine
- ❓ Agent reputation flywheel (emergent from verifiable history)
- ❓ SmartWeave governance contracts on Arweave
- ❓ Vaulta-native economics for query staking

---

## 7. Build Priority (each independently valuable)

1. **External relay access** — `wss://buzz.bNature.social` live. Unblocks everything external.
2. **Agent credential vault** — kill the API-key-in-chat antipattern. Autonomi self-encrypted.
3. **Agent memory persistence** — sessions survive restarts. Massive UX win.
4. **Arweave mainnet mirror** — permanent event log. Phase A generalized.
5. **saorsa-core MCP verification** — if real, agents get direct storage tools.
6. **b-indexer Phase I** — unified search. The discovery layer.
7. **Four-word address UX** — human-friendly content sharing.
8. **Agent-to-agent file handoff** — multi-agent collaboration via Autonomi.

Each of these is a clean, separable deliverable with a pastable receipt at the end.

---

## 8. The One-Sentence Summary

**Buzz is the conversation, Autonomi is the filing cabinet, Arweave is the vault, b-indexer is the librarian, and the agents are the workers who use all four without humans needing to understand the filing system.**
