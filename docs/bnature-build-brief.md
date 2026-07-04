# bNature.social — Kernel-to-Full-Stack Build Brief

Purpose: single reference document to prime a coding/cowork session. Consolidates prior architecture decisions (Zano payments, Autonomi storage, Veilid/libp2p transport, b-indexer, bToken, DID identity) plus the OB1 extraction plan.

---

## 1. Layer Stack (kernel → app)

### L0 — Identity Kernel
- Root identity: hardware-wallet-derived seed (Trezor via zano-trezor library). One seed = root of everything.
- Derivations from root: Zano wallet keys, Veilid/libp2p node identity, Autonomi client keys.
- Social linkage: Bluesky DID (did:plc) cryptographically linked to root identity. Portable, self-sovereign; deliberately NOT IPFS peer-ID style (non-portable — the OB1 downgrade to avoid).
- Open spec work: exact DID linkage proof format (signed attestation stored on Autonomi, referenced from the DID doc).

### L1 — Payments (Zano)
- Zano: ring signatures, stealth addresses, confidential assets. No transparent-coin logic survives from OB1 — full rewrite of tx build/verify.
- Escrow: Zano 2-of-3 multisig — buyer / seller / **Dispute Resolution Oracle (DRO)**. The DRO is a Vaulta smart contract (`bnature.dro`), not a human; it co-signs releases based on dispute-engine verdicts (see §5). **Marketplace denomination: fUSD (Freedom Dollar)** — decentralized, over-collateralized (ZANO-backed), USD-pegged confidential asset native to Zano, with existing DEX liquidity. Asset ID: `86143388bd056a8f0bab669f78f14873fac8e2dd8d57898cdb725a2d5e2e4f8f`. Constitutional note: the denomination is a *reference implementation* of settlement, not a truth — all schemas use `(amount, asset_id)`, never a hardcoded currency, so the marketplace can add or migrate assets without schema change. Zano network fee: 0.01 ZANO per tx (confirms the fee-buffer requirement). <!-- PUBLIC-CONSTANT: fUSD asset id, public chain data -->
- Wallet layer: adopt OB1's wallet-adapter abstraction pattern (multiwallet interface), implement a Zano adapter; plug zano-trezor underneath.

### L2 — Storage (Autonomi)
- All persistent data: listings, chat history, receipts, social posts, AI memory. Encrypted client-side before write.
- Mutable registers for updates/edits with verifiable version history (Autonomi's analogue to IPNS, but with persistence incentives).
- Payment: bToken via relayer/paymaster model — user never touches raw storage fees.
- Archive tier consideration: Arweave for pay-once permanent public records if needed; Autonomi is primary.

### L3 — Transport / Messaging (Veilid primary, libp2p fallback)
- Veilid: encrypted, onion-routed P2P, no servers, DHT routing by public key (DID) or topic → intent-based routing. Rust-native, fits stack.
- Fallback: libp2p gossipsub + identify + Noise transport + WebRTC for browsers. Topic scheme:
  - `bnature.marketplace.listings` (public feeds; topic carries short metadata blob, full data on Autonomi)
  - `bnature.marketplace.<category>` e.g. `hemp-seeds`
  - `did:plc:<id>.inbox` (private, E2EE)
- Design rule: transport delivers, Autonomi remembers. Live messages are E2EE over the overlay; after ack, sender's node asynchronously persists encrypted copy to Autonomi (bToken pays).

### L4 — Indexing (b-indexer)
- Multi-chain push architecture: chains push events → normalized canonical event schema → queryable API.
- Replaces OB1's "watch wallet / run a node" model entirely. This is the backbone all dApps query.
- Frontend contract: all forked OB1 UI components talk to b-indexer API, nothing else.

### L5 — Resource Token (bToken)
- Universal resource abstraction (metabolic energy). The paymaster autonomously acquires and maintains, on the user's behalf: **Vaulta/EOS RAM + CPU + NET**, **ZANO gas** (0.01 ZANO/tx — topping up escrow fee buffers where the flow allows), **AR** (Arweave permanence), **ANT** (Autonomi storage), and optionally premium Veilid routing/super-node incentives. Users hold b; the paymaster holds the basket of native resource tokens and swaps as needed.
- Separation of concerns: **fUSD is what people pay each other; b is what the machine consumes.** Commerce settles in the stablecoin; infrastructure metabolizes b. Never blur these.
- Relayer/paymaster: user actions consume bToken invisibly; no per-chain native-fee UX. Zero-opex guard applies: the paymaster abstracts user-funded resources, never subsidizes them.
- Built from scratch — no OB1 precedent exists.

### L6 — Applications / SDK
- SDK bundles: thin Veilid (or libp2p) daemon + Autonomi client + Zano wallet adapter + b-indexer client. Participation must be invisible to end users.
- First dApp: salon/marketplace. Later: futures market (hemp), social feed.
- AI agents are first-class network citizens: run as Veilid/libp2p nodes, subscribe to user topics (with permission), full Autonomi history for long-term memory, can reply/enrich/automate commerce and support.

---

## 2. OB1 Extraction Plan (extract, don't adopt)

Repo: NateBJones-Projects/OB1 (OpenBazaar continuation — reference server + client).

### Take
1. **Escrow state machine** → reimplement as a Rust module against Zano multisig RPC.
   - States: PENDING → AWAITING_FULFILLMENT → AWAITING_PAYMENT → COMPLETED, or → DISPUTED → RESOLVED
   - Timeout handling (auto-refund if seller inaction)
   - Moderator selection + fee structure logic (adapt toward code-enforced/DAO arbitration)
   - Dispute chat/evidence handling patterns
2. **React/Redux frontend** → fork; strip IPFS/OrbitDB and wallet code; replace API layer with b-indexer calls; replace P2P chat with Veilid/Autonomi messaging.
   - Reuse: listing creation (images, categories, shipping), search/browse filters, buyer/seller order dashboards, chat UI shell, ratings UI.
3. **Wallet adapter pattern** → interface design only; implement Zano adapter fresh. **Guardrail**: OB1 assumed transparent UTXO chains — the adapter interface must be ignorant of ring signatures, decoys, and key images. If anything like `decoy_selection` starts leaking toward the React frontend during extraction, stop: that lives in the host-side Trezor adapter (see companion zano-trezor-session-brief), invisible to the UI. The buyer/seller keys in the 2-of-3 escrow are hardware-wallet identities — the frozen SLIP-0010/1018 derivation and proto v0.3 are the L0/L1 bridge that makes those multisig signatures safe.
4. **Publish/update/version listing pattern** (IPNS-style) → reference for Autonomi mutable-register integration.

### Discard
- Bitcoin/BCH/Zcash/LTC transaction logic (incompatible with Zano's confidential model)
- IPFS/OrbitDB data layer (availability problems Autonomi's incentives solve)
- Peer-ID identity (non-portable; DID model is strictly better)
- Watch-wallet payment detection (b-indexer supersedes)
- Human-only moderator trust model (target automation)

---

## 3. Canonical Message Flow

1. **Live chat**: A ↔ B over Veilid circuit / libp2p stream, E2EE.
2. **Persistence**: on ack, sender encrypts for recipients, writes to Autonomi; bToken paymaster covers fee (~fraction of a cent/MB).
3. **AI processing**: agent node subscribed to user topic sees message, may act; pulls Autonomi history for context.
4. **Public feeds**: listing broadcast on public topic (metadata blob only); full payload on Autonomi; any node may index.
5. **Identity thread**: hardware-wallet-derived key ties node identity + payments + social presence together.

Rationale: Autonomi alone is pull-based (seconds–minutes latency, polling cost) — bad for real-time. Overlay alone lacks durability. Hybrid = live delivery + permanence + privacy + zero operator infrastructure.

---

## 4. Suggested Build Order

1. **Escrow core (Rust)**: port OB1 state machine; stub Zano multisig RPC; unit-test all transitions + timeouts.
2. **Zano wallet adapter**: adapter interface + zano-trezor integration; multisig create/sign/broadcast against testnet.
3. **b-indexer contract**: freeze canonical event schema + API surface early (frontend depends on it).
4. **Frontend fork**: OB1 React components → b-indexer API; get listing + order dashboard rendering with mock data.
5. **Messaging spike**: Veilid hello-world (node identity from wallet seed, DID-inbox routing, E2EE 1:1). If blocked on maturity → libp2p gossipsub path, keep interface swappable.
6. **Autonomi persistence**: encrypted write-after-ack pipeline; mutable register for editable content; bToken paymaster stub (can be centralized relayer first, decentralize later).
7. **Wire end-to-end**: listing publish → browse → order → escrow fund → fulfill → release, with chat alongside.
8. **AI agent node**: subscriber agent with Autonomi history access (read-only first).

---

## 5. Dispute Resolution Subsystem (replaces OB1 moderators)

### Autonomi Evidence Vaults
- One vault per order, created at purchase, lives for the order lifecycle. Encrypted buckets: listing_snapshot, payment_proof, communication, shipment, delivery_confirmation, buyer_claim, seller_response.
- Evidence is captured **progressively at each milestone** (order → payment → ship → delivery scan → receipt confirm), not retroactively. SDK writes silently.
- Public metadata (no PII): category, amount, deadlines, status, event hashes, dispute flag — AI-monitorable without decryption. Hashes anchored to Arweave for tamper-proofing. **Every evidence bucket entry carries a provenance field** (source class: device-attested / carrier-API / chain-proof / user-claim; method; confidence) — required now so Tier 1 can weight evidence classes later.

### Threshold Encryption (access control)
- Vault key split 3 ways (Shamir / BLS threshold): buyer share, seller share, DRO contract share. 2-of-3 reconstructs.
- Normal ops: each party decrypts own buckets. Dispute: arbitrator gets key via buyer+seller shares, or one party + contract share if the other is non-responsive. Reconstruction happens off-chain in the arbitrator's client — key never broadcast.

### Three-Tier Resolution
1. **Tier 1 — AI auto**: analyzes public metadata + voluntarily unsealed evidence, cross-refs tracking APIs, seller shipping history, buyer claim history, category dispute patterns. **Confidence is provenance-weighted**: device-attested and carrier-API evidence carries more weight than unverified user claims; conflicting evidence of equal class drops confidence and escalates. Emits `DisputeRecommendation { verdict: RefundBuyer|ReleaseToSeller|Split, confidence, evidence_hashes, reasoning_hash, auto_enforce }`. If confidence > 0.95 && auto_enforce → DRO co-signs escrow release automatically.
2. **Tier 2 — Human arbitrator (DAO pool)**: AI prepares anonymized minimal evidence packet; arbitrator sees only relevant decrypted buckets, never DIDs' real identities unless material. Paid in bTokens.
3. **Tier 3 — DAO jury**: high-value/precedent cases; token-weighted vote on anonymized packet.

### Pre-purchase prevention (AI informed consent)
- Client-side agent summarizes listing terms in plain language, risk-scores seller (DID reputation via b-indexer + category dispute rates + shipping reliability), and explains escrow mechanics before signing. bToken pays inference if remote.

### New components
- `crates/dispute-engine/` — Rust service consuming CanonicalEvents from the bus, monitoring vaults, running AI analysis.
- `bnature.dro` — Vaulta contract: Zano multisig co-signer + dispute state tracker (needs Vaulta↔Zano bridge or Zano external-oracle signing path).
- SDK extension: vault create/manage API with threshold encryption.
- bToken contract: arbitrator staking + selection mechanism.

---

## 6. b-indexer Implementation State & Phase Plan

- **Done**: Cargo workspace skeleton; architecture decisions locked. Do not redesign.
- **Phase 1 (current)**: `crates/chain-eos` — SHIP ingest for EOS/Vaulta. Goal: connect to SHIP WebSocket (tokio-tungstenite), decode binary block header via eosio crate into `ship_types::Block`, print block number + action count. One file: `crates/chain-eos/src/main.rs`.
  - Then: error handling, tracing, retry loop; integration test against real node or mock WS server fed a pre-recorded SHIP blob (capture via wscat).
  - Stretch (only if Phase 1 done): checkpoint/watermark (persist last processed block), `EventPublisher` trait publishing `IndexedEvent` to local Redpanda, tiny printing consumer to prove the bus end-to-end.
- **Deferred**: bus choice revisits (Kafka vs NATS vs Redpanda) = Phase 3 decision. Don't touch in Phase 1.
- **Prereq check before session**: real Vaulta/EOSIO SHIP node URL (testnet OK). If unavailable, session objective becomes mock SHIP data — decide before starting.

---

## 7. Coding Session Playbook (Claude Code / Cowork)

- One phase per session; one file per prompt, with explicit acceptance criteria ("Add fn X to file Y, do not add anything else").
- Open with a single dense prompt: state the crate, the phase, the concrete testable goal, and the constraint to stay in one file.
- Compile errors: paste exact compiler output, ask for the fix only — no explanations.
- After code works: commit checkpoint immediately (`feat(chain-eos): initial SHIP ingest with block header decoding`), then reset context ("That's solved. Next: …").
- Scope defense: if the coding model proposes additions ("we should also consider…"), reply verbatim: **"That is out of scope. Execute the prompt as written."** Do not discuss design in an execution session.
- Load this brief once at session start; refer back with "as discussed" instead of re-pasting.

---

## 8. Key Risks / Open Questions

- **Veilid maturity**: production-readiness of light clients + browser story. Mitigation: swappable transport interface; libp2p fallback decided up front.
- **Zano multisig RPC surface**: confirm exact multisig/arbitration primitives available; escrow design depends on what's code-enforceable vs. requiring a human arbiter.
- **fUSD peg & liquidity (Verification Principle applies)**: over-collateralized by a *volatile* asset (ZANO) with algorithmic market-making; reported coverage has compressed from >10x at launch toward ~1.8x; daily volume ~$300K on ~$10M cap is thin for scale. Escrows inherit peg risk for their duration. Checklist: run §1.7 asset-multisig verification **with the fUSD asset ID specifically**; monitor the public collateral reserve ratio; keep denomination swappable via `(amount, asset_id)`; define DRO policy for peg deviation (e.g., pause auto-enforce if fUSD deviates >X% from $1).
- **Multi-resource paymaster custody**: the b paymaster holds a basket (Vaulta RAM/CPU/NET, ZANO, AR, ANT) — inventory management, swap slippage, and per-resource depletion alerts are real engineering; start with manual top-ups + alerts before automating. Custody + abuse-prevention design (rate limits, per-identity quotas); start centralized, plan decentralization.
- **Autonomi pricing/latency**: verify real storage costs and mutable-register semantics on current network.
- **DID linkage spec**: format for wallet-seed ↔ did:plc attestation; where it lives, how it's verified by third parties.
- **Browser clients**: WebRTC transport for libp2p works; Veilid browser support needs verification.
- **Regulatory note**: confidential-asset marketplace + hemp commerce touches multiple jurisdictions (US/MX/VE) — flag for legal review before public launch.
- **Zano external co-signing**: verification checklist exists (Spec v1.0 §1) and DRO signs via standard `sign_multisig_proposal` RPC — no bridge custody needed for signing. **Confirmed constraint**: a multisig wallet cannot spend LoVis unless it also holds ZANO for the tx fee → escrow funding must include a ZANO fee buffer (see §9 amendment). DRO itself never needs a ZANO balance (it only co-signs; the multisig pays its own fee).
- **Time-locked proposals**: still unverified whether Zano supports native unlock_time/timeout on multisig proposals. If not, timeouts are enforced off-chain by the escrow engine with DRO co-signing refunds — the state machine already assumes this fallback.
- **Threshold encryption — DECIDED: build app-side.** Autonomi is storage only; it is not entrusted with access-control logic for disputes. The SDK performs Shamir/BLS splitting locally and writes encrypted shards to Autonomi. Keeps L2 (storage) dumb, L0/L1 (identity/crypto) smart.
- **Delivery oracles**: carrier tracking APIs (UPS etc.) are centralized inputs to Tier 1 verdicts — define trust model and fallback when tracking data is missing/wrong.
- **AI verdict liability**: auto-enforced fund releases at confidence > 0.95 need an appeal window and audit trail (reasoning_hash on Autonomi covers audit; define appeal mechanics).

---

## 9. Concrete Spec v1.0 — Highlights & Amendments

Full spec exists separately (Zano verification checklist, escrow state machine, canonical event schema). Key contents + the fee-buffer amendment from testnet findings:

### 9.1 Escrow state machine (`crates/escrow-core`)
States: `Created → Funded → Shipped → Delivered → Completed`, with branches `Refunded`, `Disputed → Resolved`, `Expired`.

Transition table (timeouts + auto-actions):
| From | Trigger | To | Timeout | On timeout |
|---|---|---|---|---|
| Created | buyer funds multisig | Funded | 24h | Expired |
| Funded | seller marks shipped | Shipped | 72h | Expired → Refunded (DRO co-signs) |
| Shipped | carrier scan / buyer confirm | Delivered | 14d | Disputed (AI monitors tracking) |
| Delivered | buyer releases | Completed | 7d | Completed (DRO co-signs release) |
| Delivered | buyer disputes | Disputed | — | — |
| Disputed | DRO verdict | Refunded / Completed / Resolved(split) | — | — |

Rules: Expired only from Created/Funded; once Shipped, no auto-cancel without dispute; disputes must open before timeout or auto-action proceeds.

Driving events: `BuyerFunded`, `SellerShipped{tracking, carrier}`, `DeliveryConfirmed{timestamp, source}`, `BuyerReleased`, `DisputeOpened{reason_hash}`, `DisputeResolved{verdict, resolution_id}`, `Timeout`. All persisted as CanonicalEvents so the DRO can reconstruct state.

### 9.2 AMENDMENT — ZANO fee buffer (from multisig verification)
Finding: a multisig wallet cannot spend an asset (LoVis) without holding native ZANO for the fee.
- Buyer funds `amount_lovis + fee_buffer_zano` (network constant, e.g. `FEE_BUFFER = 10_000_000` atomic = 0.1 ZANO).
- Buffer is treated as non-refundable network cost (simplest model); spent when escrow releases.
- DRO never needs ZANO — it only co-signs; the multisig pays its own fee.

Amended struct:
```rust
pub struct Escrow {
    pub order_id: String,
    pub multisig_wallet_id: String,
    pub buyer: PublicKey,
    pub seller: PublicKey,
    pub dro_public_key: PublicKey,
    pub state: EscrowState,
    pub amount: u64,              // denominated asset (fUSD), atomic units
    pub asset_id: Option<String>, // fUSD asset id: 86143388bd056a8f0bab669f78f14873fac8e2dd8d57898cdb725a2d5e2e4f8f (PUBLIC-CONSTANT: public chain data)
    pub fee_buffer_zano: u64,     // NEW: native ZANO for tx fee, funded by buyer
    pub created_at: OffsetDateTime,
    pub funded_at: Option<OffsetDateTime>, // AMENDED 2026-07-04: the 72h Funded
                                           // timeout measures from funding; the
                                           // original struct had no funding epoch —
                                           // spec deficiency caught by the shipped
                                           // implementation (escrow-core, f2e2b1e)
    pub shipped_at: Option<OffsetDateTime>,
    pub delivered_at: Option<OffsetDateTime>,
    pub dispute_id: Option<String>,
}
```
Funding check (Created → Funded): multisig balance must show ≥ `amount` of the asset **and** ≥ `fee_buffer_zano` native ZANO; otherwise remain Created (partial funding does not transition).

### 9.3 Canonical event schema (`crates/shared-types/src/events.rs`)
Envelope: `CanonicalEvent { event_id, event_type, timestamp, source_chain (Eos/Vaulta/Arweave/Zano/Autonomi), source_ref, payload, canonicalized_by }`.
Event families: Product (Listed/Updated/Delisted), Order (Placed/Funded/Shipped/Delivered/Completed/Refunded/Disputed/Resolved), MessageSent, DisputeRecommendation / DisputeResolved, DIDLinked, ReputationUpdated.
Normalizer: separate crate (`crates/normalizer`) consuming raw IndexedEvents from the bus → publishing CanonicalEvents. Example mappings: Vaulta `lovismarket:addlisting` → ProductListed; Zano asset transfer to multisig address → OrderFunded; Arweave tx tagged `order_shipped` → OrderShipped.

### 9.4 Tonight's parallel plan
- **Terminal A**: continue Zano multisig checklist on testnet (asset multisig with fee buffer, time-lock investigation §1.8).
- **Coding env**: build `crates/escrow-core` — pure logic, no node needed. Opening prompt (paste into Claude Code):

> I'm building the bNature.social escrow system. [Paste §9.1 + §9.2 of this brief.]
> Task: create the Rust crate `crates/escrow-core` in my existing Cargo workspace, containing: the `EscrowState` enum (Serialize/Deserialize), the `Escrow` struct **including `fee_buffer_zano`**, and a `transition` method taking `&mut self` and an `EscrowEvent`, returning `Result<EscrowState, EscrowError>`, enforcing the transition table, timeouts, and the funding check (asset amount AND fee buffer both present). Unit tests for every valid transition, every invalid transition, every timeout, and partial-funding rejection. Time enters only through events — no clock anywhere in the crate (AMENDED 2026-07-04 from "use mockable time": the shipped design is strictly stronger, and required for DRO replay determinism — an ambient clock, even mocked, is state a CanonicalEvent replay cannot reproduce). Do not add any other files or discuss architecture. Start with `crates/escrow-core/Cargo.toml` and `src/lib.rs`.

- After tests pass: commit `feat(escrow-core): state machine with fee-buffer funding check`, then choose next: canonical event types (§9.3) or Zano findings follow-up.

---

## 10. One-Paragraph North Star

bNature.social is a serverless Web3 economy: users are the network. Identity roots in a hardware wallet, payments settle privately on Zano with arbitrated multisig escrow, data lives forever encrypted on Autonomi, messages route in real time over a Veilid/libp2p mesh, b-indexer normalizes multi-chain events into one API, and bToken invisibly fuels it all. OB1 contributes battle-tested marketplace UX and escrow logic — the design, not the engine.

---

## Appendix A — Vision Layer Map (ORIENTATION ONLY — not implementation targets)

Skip this appendix when loading a coding session; it exists so scope decisions ("which layer owns this?") have a shared reference. Per prior ruling: do not build generic layer abstractions until a second concrete use case proves them.

| Layer | Name | Contents | Answers only |
|---|---|---|---|
| L0 | Trust attestation | Hardware devices (Trezor today; Ledger, enclaves, passkeys later) as **replaceable attestors — not the root**. A device proves identity; it is not identity | "Can this action be attributed with hardware-grade proof?" |
| L1 | Sovereign identity (the actual root) | Stable identifier (DID, with native key rotation — did:plc supports this) + threshold recovery (m-of-n shares across devices/people/contracts) + rotation + delegation. **Self-healing lives here**: identity survives device loss, vendor death, and key compromise | "Who are you — durably?" |
| L2 | Network kernel | Autonomi: self-encryption, chunking, content addressing, registers/CRDTs, routing | The filesystem — apps never see chunks |
| L3 | Settlement | Zano: assets, multisig, privacy, escrow, atomic settlement | Settlement engine, nothing more |
| L4 | Economic objects | Listings, orders, escrow objects, reputation, attestations, royalties — **bToken lives here, not L3** | Objects users recognize |
| L5 | Applications | Marketplace, social, messaging, futures, AI agents | dApps sharing identical primitives |
| L6 | User experience | Sign in / Buy / Sell / Message / Recover | Crypto is invisible (the TCP/IP principle) |

**Evidence is a kernel primitive, not a layer.** It is produced *by every layer* — L0 device attestations, sensor measurements, carrier scans, Zano settlement proofs, AI analyses — stored via L3, and consumed by disputes, reputation, and knowledge. Every EvidenceProof carries provenance (who/what produced it, method, device, confidence) so consumers can weight it. Objective, machine-produced evidence (attested photos, carrier APIs, sensor data) outranks unverified user claims by design; this is what makes the DRO's automation trustworthy. Do not slot Evidence into the layer stack — it flows through it.

**Runtime services vs. semantic layers.** The layer table lists semantics; services implement them. The **b-indexer is the Event runtime**: chain adapters (`chain-eos`, and later zano/arweave/autonomi watchers) are *sense organs* translating chain-native reality into CanonicalEvents; the normalizer + bus are the *nervous system* delivering them to every consumer (DRO, reputation, frontends, AI agents). **The CanonicalEvent schema is the lingua franca of the kernel — a constitutional interface, not an implementation detail**; the kernel never speaks EOS, Zano, or Autonomi, only translations into events. Consumers subscribe to facts on the bus; **services never call each other directly.** Adapters come in three kinds: *sense* (observe reality: SHIP streams, Zano daemon, carrier APIs, sensors, AI analysis — AI is a sense adapter whose outputs are Evidence with provenance `AIInference`, never part of the kernel), *action* (change reality: broadcast tx, release escrow, upload blob, send message), and *identity* (authenticate actors: passkey, enclave, Trezor). **Chains are capability adapters, not platform**: Zano implements `settlement.private` (global ordering — the one workload that cannot parallelize), Vaulta implements `coordination.ledger` (fast ordering, timestamps, DRO logic), Arweave implements `permanence.anchor`, Autonomi implements `storage.sovereign` (unbounded *parallel* throughput precisely because it has no global consensus — which is also why it cannot replace settlement; ordered spends and parallel writes are different capabilities, not different speeds). If any network later ships a missing capability, swap the adapter — never rebuild the kernel. **The Verification Principle (constitutional): no external performance, security, or scalability claim becomes a kernel assumption until proven against an integration checklist and reproducible tests** (precedents: Zano fee buffer, multisig RPC, Autonomi throughput). **Reserved primitive: Capability** — grants attached to identity (may sign escrow, arbitrate, delegate, operate an AI). Not built now; the concept is reserved for when AI agents, delegation, and organizations become first-class. Provenance enum sketch for evidence entries: UserClaim / DeviceAttestation / SecureEnclave / HardwareWallet / CarrierAPI / GPS / Camera / Wearable / IoT / Blockchain / AIInference / ThirdPartyOracle.

Standing principles:
- **Identity roots in semantics, not silicon.** The hardware seed is the strongest *current credential* of an identity, never the identity itself. Design commitment effective now: escrow records, evidence vaults, reputation, and canonical events key off the **DID**, not raw public keys, so future key rotation and device replacement never orphan data. (The canonical event schema already does this — `buyer_did`, `seller_did` — keep it that way.) Building the full recovery/rotation subsystem remains deferred until keys are proven.
- **Identity resolution — architecture decided, build deferred.** Kernel defines an `IdentityResolver` trait (resolve DID → current keys + rotation history + attestations) and an `Attestor` trait (produce EvidenceProof). Adapters implement: `adapter-identity-autonomi` (**reference implementation**: self-authentication for vault access; DID document at deterministic address; mutable register version-history = append-only key-rotation log — no resolver operator), `adapter-identity-didplc` (Bluesky social linkage; note did:plc resolution depends on the PLC directory, an external operator — acceptable for a linked persona, not for the root), `adapter-attestor-trezor` (hardware attestation via frozen proto v0.3). **Primary identity = Autonomi-anchored root; did:plc = linked persona attached to it** (the existing `DIDLinked` event is the cross-attestation — **must be bidirectional**: root signs over the plc DID *and* the plc side publishes a signed reference back to the Autonomi root, e.g. a record in the Bluesky repo or a service entry in the did:plc doc; a one-way claim is not a verifiable link). Trait signatures may be written when `shared-types` is built; adapter implementation waits until after vector test + escrow-core.
- **Attestation is tiered; tiers are evidence, not gates.** Tier 1 (default, mass scale): smartphone secure enclave / passkey — hardware-backed, already deployed on billions of devices, zero onboarding cost, one-tap signup (passkey created → Autonomi self-auth root derived). Tier 2 (high-assurance): dedicated hardware wallet (Trezor via frozen proto) for sellers, arbitrators, large escrows. Tier 0: pure software key — weakest, still attributable. `DeviceAttestation` provenance records the tier; **application policy, not the kernel, decides what tier an action requires** (e.g., Tier 2 for escrows above a threshold). Upgrade path = key rotation on the same DID: start with a passkey, add a Trezor later, keep all history and reputation.
- **Crypto-agility is constitutional.** The rotation log records the key *algorithm*, not just key material, so identities migrate signature schemes (Ed25519 → post-quantum, eventually) via ordinary rotation. A century-scale system that hardcodes one curve has a built-in expiry date.
- **Zero-opex guard.** The paymaster *abstracts* user-funded resources; it must never *subsidize* them, or Beehive acquires a burn rate that scales with users. Bootstrap nodes and spec/code maintenance are the only acceptable standing costs.
- **Zero-prompt UX via capability budgets.** The root credential signs *policies*, not payments: at setup it issues CapabilityGrants to a device session key (fUSD spend/day, b consumption/day, expiry, scopes). Everything within policy is signed silently — zero prompts for normal use. Prompts occur only at policy boundaries: budget exceeded, limits changed, key rotation, escrows above the attestation-tier threshold, delegation to an AI agent. Money layout is checking/savings: Tier 1 users' enclave key is the hot wallet; Tier 2 users keep a Trezor vault auto-refilling a small enclave hot balance (one hardware tap per refill, not per purchase). The b gas tank runs fully autonomously within preset budget allocation. **The budget is the blast radius**: a compromised device drains at most one budget window; defaults modest, raises require the root key. This is Capability's third independent emergence — build it as an application-layer object now; kernel promotion per the constitution's amendment process.
- **Bootstrap**: every decentralized system bootstraps through trusted seeds; the goal is minimal trust during bootstrap, zero after (Linux-installer model). Design bootstrap as temporary, decentralization as permanent.
- **Requirements are layer-generic**: "we need Trezor support" is really "L0 hardware-backed identity" — nothing above L1 may care which device satisfies it.
- **Future data-producer layer** (Welltory-adjacent): wearables/sensors/instruments as verifiable producers — signed at source, encrypted locally, synced via L2, consumed by apps under user permission without ownership. An L4/L5 extension for the wellness dApp; not current work.

North-star sentence: a decentralized operating system where cryptography, storage, networking, identity, settlement, and AI become invisible infrastructure — bNature.social is the flagship application, not the platform itself.
