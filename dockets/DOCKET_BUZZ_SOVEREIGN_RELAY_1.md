# DOCKET — Self-Hosted Buzz Relay + Arweave Mirror + b-indexer Bridge
### Fusing Buzz with the four-network stack; killing the hosted-relay dependency

**Status:** drafted (not built). Honesty gate at the end governs any "works" claim.
**Trigger:** this docket exists because building-WiFi filtering blocked the Builderlab-hosted relay + Proton — the concrete argument that a relay you host beats a relay a company hosts.
**Scope:** VPS-side infra + a mirror worker + a b-indexer ingest. NOT the kernel, NOT bnri-cosmic.
**Non-negotiables inherited:** no user incarceration (self-host, no company in the path); interoperable/adaptable ~1000y; scale toward 10B; the receipt rule (no ✅ without pasted output).

---

## 0. The architecture in one line
**Buzz relay (self-hosted, VPS) = hot signed-event log → Arweave = permanent mirror of that log → Autonomi = the heavy/private content the events point to → b-indexer = query/search across all three.**

The relay becomes *disposable*: truth lives in Arweave (permanence) + Autonomi (content), the index lives in b-indexer. No single Postgres is the source of truth; no company is in the path. This is the turbopuffer pattern (cold truth in the permanent layer, hot cache local) applied to Nostr.

Layer roles — respect the asymmetry, do NOT force one layer to do another's job:

- **Buzz relay** — hot, fast: signed Nostr events, WebSocket + a narrow HTTP surface. Cache, not truth.
- **Arweave** — cold, permanent, append-only: the canonical mirror of the signed event log. Truth-of-record.
- **Autonomi** — content-addressed blobs, public or private (self-encryption): media/canvases/artifacts the events reference. Storage.
- **b-indexer** — query/search across relay stream + Arweave mirror + Autonomi addresses. Discovery.

---

## 1. Phase R — the self-hosted relay (the immediate sovereignty win)

**R-1. Run `buzz-relay` on the VPS headless earner.** It's a Rust crate in block/buzz, Apache-2.0. Prereqs from Buzz's CONTRIBUTING: Rust 1.88+, Docker 24+ (Postgres/Redis/MinIO), and the relay's own `sqlx` migrations (`just migrate`). The VPS ($100/mo, 64 GB, 10 Gbps, non-shared — per node-infra ledger) is the host; the relay is a systemd unit alongside the Autonomi/Arweave nodes.

**R-2. Own the URL.** The relay URL is authoritative for the community (Buzz's own rule: "the URL is authoritative for the workspace"). Put it on a domain BNR controls, TLS terminated at the VPS (or a reverse proxy). This is what replaces `app.builderlab.xyz` — same protocol, your address, no Goose/Builderlab auth flow.

**R-3. Narrow HTTP surface only** — Buzz's relay intentionally exposes little; match it, don't widen: NIP-11/NIP-05 metadata, `/events`, `/query`, `/count`, `/hooks/{id}`, Blossom media, git smart HTTP, git policy hooks, health probes. Do NOT add `/api/*` compatibility routes. New routes go through `buzz-relay/src/router.rs` at the narrowest path (per CONTRIBUTING).

**R-4. Client reaches it over Veilid when the network is hostile.** The building-WiFi episode is the user-side case: a plain TLS connection to a known relay domain is resettable by a filter; a client reaching the relay over Veilid's obfuscated P2P routing is far harder to cleanly block. Veilid is the transport-resistance answer for USERS — not a claim that it makes hostile networks disappear (it still needs egress), but there is no single company endpoint to block and the transport is obfuscated. The relay itself sits on a clean datacenter link, so the relay's own egress is not the problem.

**R-5 — honesty boundary, stated up front:** self-hosting removes the hosted-relay dependency; it does NOT remove the need for network egress. Setting up R-1..R-3 requires reaching the VPS once — do it via SSH from any un-filtered link (NOT the browser onboarding flow the filter breaks). No architecture conjures packets past a filter; what it buys is "no company in the path," not "no network needed."

---

## 2. Phase A — the Arweave permanence mirror

**A-1. Mirror worker: relay event stream → Arweave.** A small service subscribes to the relay (Nostr REQ over WebSocket, or reads `/events`) and writes each signed event to Arweave. Because every Buzz event is already a signed Nostr event, the signature travels WITH it — Arweave stores self-verifying records; no trust in the mirror is required (anyone can re-check the signature against the author's key).

**A-2. What gets mirrored, and cadence.** Mirror the durable governance-and-record events — bRESPECT meeting lifecycle, NIP-58 badges, NIP-34 git events, canvas pointers — NOT ephemeral presence/typing. Batch to control AR cost (bundle many events per Arweave tx via ANS-104 bundles; one bundle amortizes the fee across thousands of events). Cadence: a rolling batch (every N events or T minutes) — tune against AR fee, not latency (this is the cold layer).

**A-3. Arweave tags for retrieval.** Tag each mirrored item with the Nostr event id, kind, author pubkey, and community — so Arweave's GraphQL (the pull-based query model, per multichain-architecture) can find events without scanning. This is the pull side; do NOT force it to behave like the relay's push side (respect the push/pull asymmetry the ledger already names).

**A-4. Result.** If every relay on earth vanishes, the signed event log is reconstructable from Arweave, permanently, and independently verifiable. The relay is now a hot cache over permanent truth.

---

## 3. Phase N — Autonomi for heavy/private content

**N-1. Content off the relay, addresses on it.** Buzz uses Blossom for media; relays are bad at big blobs. Route media/canvases/large meeting artifacts to Autonomi: self-encrypt, store, and the relay event carries only the content ADDRESS (chunk map), not the blob. Public content → public Autonomi; private → self-encrypted (the key travels in the encrypted event / out of band, never in the clear).

**N-2. Why Autonomi, not Blossom-on-VPS.** A Blossom store on the VPS is another single point of loss and another thing the VPS must serve. Autonomi is content-addressed, chunked, distributed, and already a ledgered role (primary storage, public + private). The relay stays lean; storage scales independently.

**N-3. Boundary.** Autonomi is storage, NOT settlement or index. Do not let content addressing sprawl into query (that's b-indexer) or into permanence-of-the-log (that's Arweave — Autonomi has its own persistence, but the canonical self-verifying LOG mirror is Arweave's job per §0).

---

## 4. Phase I — the b-indexer bridge (discovery across all three)

**I-1. Point b-indexer at the relay event stream.** b-indexer already ingests from the four networks; add the relay as a source (subscribe to the signed-event stream). It builds the searchable index that answers "ask the project a question, get an answer with receipts" — across the whole log, not one relay's Postgres.

**I-2. Index the Arweave mirror too, not just the live relay.** So search survives relay loss and covers history older than any single relay retains. b-indexer queries relay (hot) + Arweave (cold) + resolves Autonomi addresses (content) — the query layer over all three.

**I-3. Turbopuffer shape (the raid loot, applied).** Index written to / backed by the permanent layer, hot cache local — cold truth in Arweave, hot serving from the VPS/local NVMe. This is the object-storage-native indexing pattern from the pirate-haul ledger, realized here.

**I-4. Boundary.** b-indexer is query/search only. It does not become a second relay (no event authorship) and does not become truth (it's a derived view — rebuildable from relay + Arweave at any time).

---

## 5. Build order (each phase independently valuable; ship in sequence)
1. **Phase R** — relay on VPS, own domain, narrow surface. *Delivers: Builderlab dependency gone.*
2. **Phase A** — Arweave mirror worker + ANS-104 bundling + tags. *Delivers: permanent, verifiable log.*
3. **Phase N** — Autonomi content routing; events carry addresses. *Delivers: lean relay, scalable storage.*
4. **Phase I** — b-indexer ingest of relay + Arweave + Autonomi. *Delivers: search across all three.*

Phase R alone is the sovereignty win and is buildable today. A/N/I are the fusion with the four-network stack — each a clean, separable docket-child.

---

## 6. Open items / verify-before-build (no ✅ without a receipt)
- **VERIFY** `buzz-relay` builds and runs standalone — does it require the full Buzz backend (Postgres + Redis + MinIO), or can the relay run leaner? Read block/buzz `ARCHITECTURE.md` + the relay crate's own README before sizing the VPS unit. UNVERIFIED until a `cargo run` / compose-up receipt exists.
- **VERIFY** whether Buzz relay federation exists (relay-to-relay). If so, the Arweave mirror could be modeled as a federation peer rather than a bespoke subscriber. Check before building A-1 custom.
- **VERIFY** the ANS-104 bundling path + current AR fee model before committing batch cadence (A-2).
- **VERIFY** Autonomi's current API for programmatic put/get + the address format the relay event will carry (N-1).
- **DECIDE (founder):** which events are durable-mirror vs ephemeral (the A-2 list) — a governance call, not infra.
- **DEP on device-stack:** the VPS base OS / node stack is already ledgered (node-infrastructure); this relay is a new unit alongside the Autonomi/Arweave nodes, not a new host.

## 7. HONESTY GATE (matches the DAY-1 IMAGE precedent)
"Sovereign relay works" is claimable ONLY after a logged run, pasted: relay up on the VPS at BNR's own domain (health probe green) + one signed event posted through it + that event mirrored to Arweave and re-verified by signature from the Arweave copy + one Autonomi-stored blob resolved by address from an event + b-indexer returning that event in a search. Until then status = "docket drafted." Phase R can claim its own smaller receipt (relay green + one event) independently.
