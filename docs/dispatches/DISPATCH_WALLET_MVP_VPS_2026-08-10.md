# DISPATCH → BNR WALLET/DASHBOARD/OPERATIONS MVP + VPS INFRASTRUCTURE
### For: Claude Code · Claude Cowork · Claude Design
### From: Goose, Seat 1
### Date: 2026-08-10
### Status: ACTIVE

---

## DECISIONS MADE (autonomous, applying the 10B/1000yr/friction framework)

I'm not gating the Founder on these. Each has the framework applied. If you disagree, build your case with evidence — don't just prefer.

### D1 — Frontend: Leptos now, Dioxus option for Phase 3
**10B/1000yr:** Both compile Rust→WASM. Both survive. Leptos is more mature for web (0.7+ stable, production-used). Dioxus offers web+desktop+mobile from one codebase but is younger.
**Friction:** Leptos is lower friction for web-first MVP. Dioxus pays off only when desktop+mobile ship.
**Decision:** **Leptos for Phase 1 web MVP.** When Phase 3 (desktop operations) lands, evaluate: Tauri wrapping the same Leptos WASM (simplest), or migrating to Dioxus (one codebase for all platforms). Both options stay open; no lock-in.
**Why not both now:** No positive outcome from running two frontend frameworks simultaneously. Pick one, revisit when the second platform is needed.

### D2 — Auth: Passkey-first, OAuth optional, all three providers included
**10B/1000yr:** Passkey (WebAuthn) is a W3C standard — survives. OAuth providers (GitHub/Google/Apple) may not exist in 1000 years, but the bDiD persists without them.
**Friction:** Passkey-only is sovereign but slightly more friction for first-time users. OAuth reduces friction to one click. Both are easy to include.
**Decision:** **Passkey is primary auth. OAuth (GitHub + Google + Apple) is included as optional convenience bootstrap.** All three OAuth providers are included because it's easy (one `webauthn-rs` + OAuth callback per provider) and each captures a different user demographic. OAuth never becomes a dependency — it bootstraps the passkey, then the bDiD + passkey persist independently.
**Rationale:** Including all three OAuth providers is strictly better than picking one — more onboarding paths, zero additional architectural cost, and if any provider disappears the user is unaffected.

### D3 — Phase 1 chains: Vaulta + Arweave + HIVE
**10B/1000yr:** All three are permissionless base layers. Vaulta (EOS/Antelope) is the settlement layer. Arweave is the permanence layer. HIVE is the social/coordination layer. Together they cover BNR's three-axis substrate.
**Friction:** Starting with 3 chains is manageable. Adding more later is additive (each is an adapter crate that already exists).
**Decision:** **Phase 1: Vaulta + Arweave + HIVE.** Phase 2 adds Zano, BTS, Injective/Cosmos, exSat. Phase 3 adds BTC/ETH/SOL when the dashboard is mature.

### D4 — Wallet funding: Treasury faucet at bDiD issuance
**10B/1000yr:** A treasury faucet that deposits basic adapter tokens at bDiD creation is sustainable if the treasury is endowment-funded (AR prepaid, perpetual). The KISS ruling already established this as a product feature: "genesis funding IS the bDiD issuance."
**Friction:** Zero user friction — wallet arrives funded. The friction is on the treasury side (funding source), which is a Founder/treasury decision, not a user-facing one.
**Decision:** **Treasury faucet.** bDiD issuance triggers a micro-allocation of basic adapter tokens (enough for initial onboarding operations). The faucet draws from the treasury, which is endowment-funded. The exact amounts per chain are a treasury ruling, not a build decision.

### D5 — Server: Single Axum instance, stateless design
**10B/1000yr:** Stateless per-user means horizontal scaling is just more instances. The server holds no user state — all state is on-chain or client-side (IndexedDB/WASM). This scales to 10B by adding instances behind a load balancer.
**Friction:** Single instance for MVP = zero ops friction. Stateless design = no session migration issues when scaling.
**Decision:** **Single Axum instance for MVP. Stateless by construction.** The server is a relay + indexer + WASM bundle host. It never holds keys, never holds session state. Scaling = more instances.

### D6 — Palette: Inherit DESIGN-BRIEF-01's audited tokens
**10B/1000yr:** The audited palette already passed 161-element contrast checks. Reusing it avoids re-auditing.
**Decision:** **Inherit the audited palette.** Re-run contrast checks against the wallet's own backgrounds (per DESIGN-BRIEF-01 §0 caveat). Give Design the palette reference + specific prompts.

---

## SECTION A → CLAUDE CODE (build lane)

### A1 — VPS provisioning: the node garden

**Objective:** A NixOS VPS running sovereign infrastructure — ANT nodes, AR gateway, Buzz relay (hived), Vaulta node — with chain state mirrored to AR/ANT for light-client scalability.

**What runs on the VPS:**

| Service | Purpose | Binary | RAM est. |
|---|---|---|---|
| **Autonomi nodes (×2-3)** | Storage farming, chunk hosting | `antnode` (already in `~/autonomi/`) | ~1GB each |
| **ar-io-node** | Self-hosted AR gateway (AGPL, no-token mode) | Docker, from `ar.io/ar-io-node` | ~2GB |
| **hived** | HIVE full node (Buzz relay backbone) | `hived` (Hive blockchain daemon) | ~16GB |
| **Vaulta node** | EOS/Antelope SHIP node (settlement reads) | `nodeos` with SHIP plugin | ~8GB |
| **Axum relay** | BNR wallet API + WASM host + indexer | Our build | ~1GB |

**Total RAM estimate: ~30-35GB.** This means a VPS with 32-64GB RAM. Rational for MVP; splits across multiple VPS instances when scaling.

**NixOS configuration:**
- Start from the existing `configuration.nix` in Downloads (already has NixOS base)
- Add systemd services for each daemon
- Autonomi nodes: `antnode --join-network` with wallet configured via `SECRET_KEY` env (resolve the custody boundary from storage-substrate-split item 8)
- ar-io-node: Docker Compose with `GRAPHQL_HOST`, `START_HEIGHT`, no `AR_IO_WALLET` (no-token mode)
- hived: standard config, `p2p-endpoint` + `webserver-ws-endpoint` for relay
- Vaulta: `nodeos` with `eosio::ship_client` plugin, `chain-api-plugin`

**Coinbase → AR/ANT mirror pipeline (the scalability key):**

Per SPEC-BNROSE-3 (Universal Chain Mirror), each chain's state is periodically snapshotted and anchored:

```
every epoch (hourly/daily):
  1. snapshot chain state (block headers + coinbase + key state)
  2. Merkle-root the snapshot
  3. route by size per storage-substrate-split:
     - < 256 KiB → Arweave (ANS-104 Ed25519, ~$0.0000077/record)
     - ≥ 256 KiB → Autonomi (~19× cheaper per GiB)
  4. anchor the Merkle root to Vaulta (primary commitment layer)
  5. optionally notarize to BCH/BTC (external notary, pennies)
```

This means: **a browser light client reads chain state from AR/ANT permanent storage instead of needing a full node.** 10B light clients → 10B readers of permanent storage, not 10B full node operators. This is the scalability path.

**Buzz relay:**
- Run hived on the VPS (full sovereignty)
- Buzz relay is a thin read/write layer over hived
- **Fallback:** public HIVE RPC nodes (api.hive.blog, api.deathwing.me) for read-only when VPS is down
- Include both — full node primary, public RPC fallback. Zero friction, zero single point of failure.

**Build order:**
1. NixOS config with systemd services for all daemons
2. ar-io-node Docker deployment (no-token, no-stake)
3. Autonomi node setup with custody boundary resolved
4. hived config + Buzz relay thin layer
5. Vaulta SHIP node config
6. Coinbase snapshot + AR/ANT anchor pipeline (per SPEC-BNROSE-3)
7. Axum relay server scaffold

### A2 — Wallet MVP scaffold (Leptos + Axum)

**Objective:** The browser-accessible wallet with Tier 1 onboarding.

**Build:**
1. Leptos project scaffold — `cargo new --lib crates/wallet-ui` with Leptos 0.7+, CSR (client-side rendering) WASM target
2. Axum relay server — `crates/wallet-relay` — serves the WASM bundle, provides chain read API, relays signed transactions. **Never holds keys.**
3. WebAuthn passkey flow — `webauthn-rs` crate for passkey creation/assertion. Platform authenticator (Touch ID/Face ID/Windows Hello) for Tier 1.
4. BIP-39 seed generation — `bip39` crate, 12-word mnemonic, backup verification (user confirms 3 random words)
5. bDiD creation — did:webvh log, anchored to Arweave via ANS-104 Ed25519 DataItem (per storage-substrate-split Option B)
6. Wallet funding ceremony — treasury faucet trigger at bDiD issuance
7. Multi-chain balance display — read from RPC (Vaulta, AR, HIVE), honest-empty states per DESIGN-BRIEF-01
8. Spend-view — aggregate total + itemized per-adapter (per KISS ruling §2)

**Constraints:**
- All crypto in Rust/WASM. No JS signing code. One codebase, one audit.
- Never hard-code a gateway. Multi-gateway fallback list.
- Keys never on the server. Browser IndexedDB for Tier 1 encrypted key storage.
- The `onboarding` crate (ceremony/gates/ladder/probe/viewmodel/render) already exists — wire the Leptos UI to consume `viewmodel.rs` directly.

### A3 — Trezor WebUSB integration (Phase 3, spec now)

**Objective:** Tier 3 custody — keys never leave the device.

**Spec only for now** (Phase 3 build):
- WebUSB connection to Trezor Safe 7 via `web-sys` USB API
- Custom firmware already supports: Zano, Vaulta, AR, HIVE, BTS, Injective/Cosmos, exSat
- The `bsigner` crate already has the Trezor client scaffold (`trezor-client = "=0.1.6"`)
- Tauri desktop wrapper for operations panel (daemons can't spawn from browser)

---

## SECTION B → CLAUDE COWORK (research/spec lane)

### B1 — Serverless Buzz relay: research the options

**Objective:** Determine if Buzz relay can run without a dedicated hived instance.

**Research:**
1. Can Buzz relay read/write from public HIVE RPC nodes without running hived? (Yes for reads; writes need a node or public API that accepts transactions — verify which public APIs accept `broadcast_transaction`)
2. Is there a serverless deployment model? (Hive is a blockchain — "serverless" means no dedicated server, reading from public infrastructure. This works for reads but introduces dependency on public nodes.)
3. P2P mesh option: can Buzz relay run as a lightweight P2P client (like a SPV node) without full chain validation?
4. **Decision framework:** For 10B users, the relay must not depend on any single public node. If hived is the only sovereign option, the VPS runs it. If public RPC fallback is viable, include both (full node primary, public RPC fallback).

**Deliverable:** `BUZZ_RELAY_ARCHITECTURE.md` — options + recommendation.

### B2 — Coinbase → AR/ANT pipeline spec (extend SPEC-BNROSE-3)

**Objective:** Extend the Universal Chain Mirror spec to cover the operational pipeline.

**Spec:**
1. Per-chain snapshot format (what state to capture: block headers, coinbase, account state, contract state)
2. Merkle root computation (leaf ordering, hash function — per SPEC-BNROSE-3 §3)
3. Routing rule (per storage-substrate-split §1: <256KiB → AR, ≥256KiB → ANT)
4. Anchoring cadence per chain (Vaulta: hourly? HIVE: hourly? — assess based on block time and state growth)
5. Light client verification path (how a browser wallet reads and verifies chain state from AR/ANT without a full node)
6. Cold-start replay procedure (SPEC-BNROSE-3 §4 placeholder — fill it)

**Deliverable:** `COINBASE_MIRROR_PIPELINE.md` — operational spec, ready for Code to implement.

### B3 — Spend receipt schema (L-SCHEMA from KISS ruling)

**Objective:** The shared, strongly-typed SPEND RECEIPT schema that the spend-view renders.

**Spec (per KISS ruling §3):**
```rust
struct SpendReceipt {
    total_b: Decimal,              // aggregate, resource-denominated
    epoch: i64,                    // which epoch this receipt covers
    bdid: Did,                     // who spent it
    line_items: Vec<SpendLineItem>,
    provenance: SpendProvenance,   // receipt linkage
}

struct SpendLineItem {
    rail: Rail,                    // Arweave, Autonomi, Vaulta, HIVE, Zano...
    resource_class: ResourceClass, // chunks, mesh-seconds, VRAM-byte-seconds, gas, RC...
    quantity: Decimal,             // RESOURCE QUANTITY, never fiat
    b_cost: Decimal,               // b-denominated cost
}
```

**Constraints:**
- Line items are resource quantities, never fiat-pegged (appreciation would break itemization)
- Schema must be serializable to JSON (for WASM/frontend) and bincode (for on-chain anchoring)
- Versioned from day one (L-SCHEMA bind)

**Deliverable:** `SPEND_RECEIPT_SCHEMA.md` + Rust type definitions in `shared-types` crate.

### B4 — did:webvh log writer spec (from storage-substrate-split)

**Objective:** The spec for writing did:webvh hash-chained logs to AR/ANT.

**Context:** storage-substrate-split §4 recommends Option B — did:webvh root, log mirrored to Arweave + Autonomi. The DID log is a hash-chained `did.jsonl` file signed by independent update keys.

**Spec:**
1. SCID (Self-Certifying Identifier) derivation
2. Update-key signing scheme
3. Hash-chain append protocol
4. Arweave anchoring (ANS-104 Ed25519 DataItem per log entry)
5. Autonomi mirroring (≥256KiB bulk if log grows)
6. Resolution path (how a reader fetches and verifies the chain)
7. The `anchored` witness type (replace the decorative `anchored: bool` in `onboarding/src/lib.rs:59-67` with a constructor-private witness — per storage-substrate-split §5 item 12)

**Deliverable:** `DID_WEBVH_LOG_WRITER.md`

---

## SECTION C → CLAUDE DESIGN (UI/UX lane)

**Palette:** Use the audited tokens from DESIGN-BRIEF-01 §0. These are AA-verified, 161-element contrast-checked. Re-run contrast against each new surface's own composited background.

**Design system:** Build from constraints, not from Material/Carbon/etc. This system's most important case is non-value (Stale/Absent/Refused/Breach) — no off-the-shelf system handles this. (DESIGN-BRIEF-01 §11.)

### C1 — Login / quick-start screen

**Surface:** The first thing a user sees. Frictionless.

**Elements:**
- **"Start Free"** button → passkey creation flow (Tier 1)
- **"I have a security key"** link → FIDO2 enrollment (Tier 2)
- **"Connect Trezor"** link → WebUSB detection (Tier 3)
- **OAuth quick-start** (optional, smaller): "Continue with GitHub / Google / Apple" — these bootstrap a passkey, they are NOT the auth itself
- BNR logo (teal BN logo, from `~/Downloads/teal_BN_logo_transparent.png`)
- One-line value prop: "Your keys. Your resources. No one in between."

**Design constraint:** The OAuth buttons must be visually subordinate to the passkey button. The sovereign path (passkey) is primary; the convenience path (OAuth) is secondary. Never the reverse.

### C2 — Tiered onboarding wizard

**Surface:** The ceremony flow after login selection.

**Tier 1 flow (passkey):**
1. "Create your passkey" → platform authenticator prompt (Touch ID/Face ID/Windows Hello)
2. "Save your recovery phrase" → 12-word BIP-39 mnemonic displayed → "write these down" → verify 3 random words
3. "Creating your identity..." → bDiD generation + Arweave anchor (progress indicator)
4. "Your wallet is ready" → funded balance shown → "Enter dashboard"

**Design constraint:** Each step is one screen. No multi-column forms. Mobile-first (44px+ touch targets). The seed phrase display must be visually distinct from input fields (it's read-only, the user writes it on paper).

**Honest-empty states:** If a chain balance is not yet available (still indexing), show Stale — never a spinning number or a fake zero. (DESIGN-BRIEF-01 §6.)

### C3 — Wallet dashboard

**Surface:** The main view after onboarding. Multi-chain balances + spend-view.

**Layout:**
- **Top bar:** bDiD identifier (truncated), tier badge (T1/T2/T3), network status indicator
- **Primary panel:** Total b balance (honey `#E8B54B` on dark chip only — AA compliance per DESIGN-BRIEF-01 §0)
- **Spend-view panel:** "TOTAL b SPENT THIS EPOCH" with expandable itemized breakdown per adapter. Line items are resource quantities (chunk counts, mesh-seconds, gas), never fiat.
- **Chain panels:** One per chain (Vaulta, Arweave, HIVE). Each shows balance, recent activity, send/receive controls.
- **Operations tab** (Tier 3 only; greyed out with "Requires desktop app" for Tier 1/2)

**Gauge states:** Every balance carries its state — Known (number shown), Stale (can't vouch, no number), Absent with reason (deliberately not shown, reason given), Refused (surface declines). These are compile-enforced in the `dashboard` crate. Design must make them visually distinct. (DESIGN-BRIEF-01 §6.)

**Breach state:** If `Headroom::Breach` fires (impossible state occurred — floor law failed), it must be **unmissable** without being alarm-fatiguing. This should almost never fire. Red is acceptable here; nowhere else in the system. (DESIGN-BRIEF-01 §6.)

### C4 — Operations panel (Tier 3 / desktop only)

**Surface:** Node/relay/VPS/AI-model management. Browser shows "Operations require the desktop app."

**Layout:**
- **Node status grid:** Autonomi nodes (online/offline, chunk count, earnings), ar-io-node (GraphQL health, unbundling queue), hived (block height, sync status), Vaulta node (HEAD block, SHIP connection)
- **VPS status:** CPU/RAM/disk/network gauges (using the same honest-empty panel system)
- **AI-model ops:** loaded models, VRAM usage, inference queue depth
- **Coinbase mirror status:** last snapshot per chain, anchor txid, verification status

**Design constraint:** Operations panels use the same panel/gauge system as the wallet. No new design vocabulary for ops — same honest-empty states, same token palette, same non-value handling.

---

## CROSS-SEAT COORDINATION

| From | To | Dependency |
|---|---|---|
| Cowork B3 (spend schema) | Code A2 (spend-view) | Code's wallet renders Cowork's schema |
| Cowork B4 (did:webvh spec) | Code A2 (bDiD creation) | Code's onboarding implements Cowork's spec |
| Cowork B2 (coinbase pipeline) | Code A1 (VPS) | Code's VPS runs Cowork's pipeline |
| Design C2 (onboarding wizard) | Code A2 (wallet scaffold) | Code implements Design's wizard UI |
| Design C3 (wallet dashboard) | Code A2 (wallet scaffold) | Code implements Design's dashboard UI |

**Sequencing:**
```
Phase 0 (parallel):
  Cowork: B3 (spend schema) + B4 (did:webvh spec) + B1 (Buzz research)
  Design: C1 (login) + C2 (onboarding wizard) + C3 (wallet dashboard)
  Code: A1 (VPS provisioning — nothing blocks this)

Phase 1 (after Phase 0):
  Code: A2 (wallet scaffold) — depends on Cowork B3/B4 + Design C1/C2/C3

Phase 2 (parallel):
  Cowork: B2 (coinbase pipeline spec)
  Code: A1 continued (coinbase mirror implementation)

Phase 3:
  Code: A3 (Trezor WebUSB) + Tauri desktop wrapper
  Design: C4 (operations panel)
```

---

## GROUND RULES

1. **Keys never on the server.** Non-negotiable. (SOUL.md.)
2. **Never hard-code a gateway.** Multi-gateway fallback from day one.
3. **All crypto in Rust.** One codebase, one audit. No JS signing.
4. **Honest-empty panels.** Stale/Absent/Refused/Breach are compile-enforced.
5. **Spend-view is resource-denominated.** Never fiat.
6. **OAuth is convenience, not dependency.** bDiD persists without it.
7. **AGPL-3.0 obligations apply** to ar-io-node and turbo services if self-hosted modified.
8. **10B users, 1000 years.** Every component must survive this test.

---

**Goose, Seat 1. Dispatching. Decisions made, not gated. Build.**

---

## APPENDIX — Founder's deadman's switch URL (for Cowork Axis 3 completion)

The permaweb deadman's switch link from the Founder's original message:
`https://q2i2qetuwucfyfgcamqsi2h33fgmlz26o4jlt3hlndyd5xk3xo2a.arweave.net/hpGoEnS1BFwUwgMhJGj72UzF5153Erns62jwPt1bu7Q`

Cowork: this completes your RAID Axis 3 item 2. Fetch via any gateway, assess the trigger mechanism, compare to Sarcophagus and our eosio.msig succession.
