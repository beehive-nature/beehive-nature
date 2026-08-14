# DESIGN BRIEF 03 — BNR WALLET / DASHBOARD / OPERATIONS MVP

> # ⚠ PARTIALLY SUPERSEDED — 2026-08-11
> **The FRONTEND STACK in this document is SUPERSEDED.** Ruling 1 of
> [`RULINGS_FRONTEND_SIGNER_XLM_2026-08-11.md`](dispatches/RULINGS_FRONTEND_SIGNER_XLM_2026-08-11.md): **htmx + hx-boost + Alpine.js +
> WASM are PRIMARY; React only where it measurably wins; Leptos and D1 are SUPERSEDED.**
> This document still says **Leptos in 10 places** — the body is left standing because it
> records what was asked for when it was written, but **do not build from its stack
> guidance.** Everything else here remains in force.
>
> **Also from that file — ruling 2:** capped-spend enforcement is **SIGNER-AUTHORITATIVE**
> (Trezor firmware / JWK signer). The relay pre-check is **advisory only** — *a keyless
> relay can be replaced, so a cap only it enforces is not a cap.*

**Authority:** Seat 0 directive to Seat 1 (goose holding)
**Date:** 2026-08-10
**Status:** DRAFT — awaiting Founder review before dispatch
**Companions:** DESIGN-BRIEF-01-dashboard.md, KISS ruling (2026-08-08), T4 enrollment flows, RAID trilogy, storage-substrate-split.md

---

## 0. WHAT THIS IS

One web-based surface with three custody tiers. The user starts free in a browser and escalates to hardware custody without ever leaving the product or losing their identity. Every tier shares the same bDiD, the same wallet, the same spend-view — only the signing path changes.

**The product is the tiering itself.** A user who begins at Tier 1 (passkey, free) can upgrade to Tier 2 (FIDO2) then Tier 3 (Trezor) without re-onboarding. The bDiD persists; the custody wraps around it.

---

## 1. THE THREE TIERS

### Tier 1 — Beginner (Free, Browser)

| Aspect | Spec |
|---|---|
| **Auth** | WebAuthn passkey — platform authenticator (Touch ID, Face ID, Windows Hello) or sync passkey (Apple/Google keychain) |
| **Quick start** | GitHub/Google OAuth → passkey creation → bDiD issued. OAuth is **convenience-only**: it bootstraps identity, then is never required again. The bDiD and passkey persist if the OAuth provider disappears. |
| **Seed backup** | BIP-39 mnemonic generated client-side during onboarding. User writes it down. This is the recovery path if the passkey device is lost. |
| **Custody model** | Signing key derived from seed, encrypted at rest in browser (IndexedDB), unlocked by passkey assertion. The passkey authenticates; the derived key signs. **The key lives in the browser, not on a server.** |
| **Wallet** | Self-funded — zero initial balance. No Vaulta account needed (that is what "free" means). User earns b through participation. No subsidy, ever. |
| **Capabilities** | Read balances (all chains), basic send/receive, spend-view (aggregate + itemized per adapter) |
| **Ladder** | L1/L2 |
| **Rust crate** | `webauthn-rs` for passkey creation/verification; `bip39` + `hdwallet` for seed derivation; `crates/onboarding` (custody/enrolment/age primitives — the wizard engine itself is greenfield, see §5 correction) |

### Tier 2 — Intermediate (Funded, Hardware-backed)

| Aspect | Spec |
|---|---|
| **Auth** | FIDO2 security key (YubiKey, SoloKey) via WebAuthn + TOTP (Google Authenticator) as second factor |
| **Custody model** | Same browser-stored signing key as Tier 1, but the FIDO2 key replaces the platform passkey as the unlock credential. Hardware-backed: the security key must be present and tapped to unlock the wallet. TOTP is the fallback if the security key is lost. |
| **Wallet** | User-funded resource accounts across multiple chains. Active trading, escrow participation. |
| **Capabilities** | All Tier 1 + active send/receive on all chains, resource trading, escrow, adapter configuration |
| **Ladder** | L3/L4 |
| **Rust crate** | Same `webauthn-rs` (FIDO2 is WebAuthn with a roaming authenticator); `totp-rs` for TOTP generation/verification |

### Tier 3 — Advanced (Trezor, Full Hardware)

| Aspect | Spec |
|---|---|
| **Auth** | Trezor Safe 7 via WebUSB → custom BNR firmware (already built by bCode) |
| **Custody model** | Keys never leave the device. Every signing operation goes through WebUSB to the Trezor, which displays the transaction on its screen for physical confirmation. No browser-stored keys. |
| **Chains** | Zano, Vaulta (EOS/exSat EVM), Arweave, HIVE, BTS, Injective/Cosmos, exSat, BTC, ETH, SOL — all supported by the custom firmware |
| **Capabilities** | All Tier 2 + node operations (Autonomi, ar-io-node, Buzz relay), VPS management, AI-model ops |
| **Later** | Biometric PoU (Proof of Uniqueness) / PoL (Proof of Life) as additional multifactor — from the biometric uniqueness ledger |
| **Ladder** | L5 (no privileged operator — the user IS the operator) |
| **Rust crate** | `web-sys` WebUSB bindings → Trezor protocol (already implemented in custom firmware); existing `verify-trezor` and `dro-signer` crates |

### Tier escalation path

```
Tier 1 (passkey, free)
  │  user buys a FIDO2 key → upgrade
  ▼
Tier 2 (FIDO2 + TOTP, funded)
  │  user plugs in Trezor → upgrade
  ▼
Tier 3 (Trezor, full custody + operations)
  │  biometric PoU/PoL enrolled → multifactor
  ▼
Tier 3+ (Trezor + biometric)
```

**Escalation preserves the bDiD.** The identity doesn't change; only the verification method upgrades. This is W3C DID Core separation: identifier public, document public, verification method private — and the verification method gets stronger.

---

## 2. TECHNICAL ARCHITECTURE

### Stack decision: Leptos + Tauri, both Rust

```
┌──────────────────────────────────────────────────────┐
│ BROWSER (Tier 1/2)  or  TAURI DESKTOP (Tier 3)       │
│                                                      │
│  Leptos WASM Frontend (Rust → WASM)                  │
│  ├── Onboarding wizard (consumes onboarding crate)   │
│  ├── Wallet view (multi-chain balances + spend-view) │
│  ├── Dashboard (resource gauges, honest-empty panels)│
│  └── Operations panel (Tauri/desktop only)           │
│                                                      │
│  WASM Crypto Layer (shared Rust crates → WASM)       │
│  ├── webauthn-rs (passkey/FIDO2)                     │
│  ├── Arweave: JWK generation + ANS-104 DataItem sign │
│  ├── Per-chain tx construction (shared-types crate)  │
│  └── WebUSB → Trezor protocol (Tier 3)               │
│                                                      │
│  Tauri Native Bridge (desktop only)                  │
│  ├── Daemon spawning (nodes, relays)                 │
│  ├── VPS SSH / provisioning                          │
│  └── AI-model process management                     │
├──────────────────────────────────────────────────────┤
│ AXUM RELAY SERVER (Rust, stateless per-user)         │
│  ├── REST/GraphQL API (relays, NEVER signs)          │
│  ├── Chain indexer (reads state from RPC nodes)      │
│  ├── Self-hosted ar-io-node (AGPL, no-token mode)    │
│  ├── Multi-gateway fallback (never hard-code one)    │
│  └── Static WASM bundle serving                      │
└──────────────────────────────────────────────────────┘
```

### Why Leptos

- **One language, one audit.** The signing logic is already in Rust (`bsigner`, `adapter-arweave`, per-chain crates). Leptos compiles the same Rust to WASM for the browser. No JS rewrite of crypto-critical code. No second implementation to drift.
- **The wizard view-model/renderer do not exist yet** (§5 correction, 2026-08-14): the previously cited `viewmodel.rs`/`render.rs` are phantom. The plan stands as DESIGN, not as reuse — build the view model as the serialization-boundary challenge protocol patterned in RAID_AUTHENTIK_IDP_PATTERNS §18, and have the frontend (stack per the SUPERSEDED banner above — htmx+Alpine+WASM, not Leptos) consume that.
- **SSR + WASM hydration.** Fast initial paint (server-rendered HTML), reactive updates (WASM). Important for 10B-user scale: the server renders, the client hydrates.
- **Mature enough for production.** Leptos 0.7+ is stable, used in production by several companies.

### Why Tauri for desktop (not Dioxus)

- **Tauri wraps the same WASM bundle.** The browser UI and the desktop UI are the same Leptos app. Tauri adds native capabilities (daemon spawning, VPS SSH) that browsers can't do.
- **Design brief 01 already specified this:** "`bNature.social` — web for status, Tauri desktop for operations."
- **The operations panels exist only in the desktop build.** A browser can't spawn daemons, and the web version says so rather than appearing broken.

### Why NOT JavaScript/React

- **The custody-critical path is Rust.** Rewriting signing, key derivation, and ANS-104 DataItem construction in JavaScript creates a second implementation. Two implementations of crypto code means two audits, two sets of bugs, and drift between what the CLI does and what the browser does. One codebase, one audit.
- **Exception:** where a Web API requires JS (and `web-sys` doesn't bind it yet), a thin JS shim is acceptable. This should be rare and shrinking.

---

## 3. THE WALLET VIEW

### Spend-View UX (from KISS ruling)

```
┌─────────────────────────────────────────┐
│  TOTAL b SPENT THIS EPOCH               │
│  ▓▓▓▓▓▓▓▓▓▓ 423.7 b                     │
│                                         │
│  [ ▼ itemized per adapter ]             │
│                                         │
│    Arweave     128.4 b   15 ANS-104     │
│    Autonomi     89.2 b    3 chunks      │
│    Vaulta       67.0 b    gas + RAM     │
│    Hive         52.1 b    RC delegated  │
│    Zano         87.0 b    2 transfers   │
│                                         │
│  [all figures are resource quantities,  │
│   never fiat-pegged — per b-spend rule] │
└─────────────────────────────────────────┘
```

**One number by default. Full per-rail breakdown one click down.** Line items are resource quantities (chunk counts, mesh-seconds, VRAM-byte-seconds, chain fees) — never fiat, because appreciation would break the itemization.

### Multi-chain balance display

Each chain gets a panel showing:
- Balance (with `Stale` / `Absent` / `Refused` states per DESIGN-BRIEF-01)
- Recent transactions
- Send/receive controls (gated by tier — Tier 1 is read + basic send; Tier 2+ is full active)

### Honest-empty panels (from DESIGN-BRIEF-01)

The wallet inherits the four non-value states: **Stale** (can't vouch for the number), **Absent with reason** (deliberately not shown), **Refused** (surface declines rather than show wrong data), **Breach** (impossible state that occurred). These are compile-enforced in the existing `dashboard` crate.

---

## 4. THE OPERATIONS PANEL (Tier 3, Desktop Only)

Gated behind Tier 3 auth (Trezor connected). Browser shows: "Operations require the desktop app — a browser can't manage daemons."

### Node management
- Autonomi node status (online/offline, chunk count, earnings)
- ar-io-node gateway status (GraphQL health, unbundling queue)
- Buzz relay status (connected, followers, feed health)

### VPS management
- Server status (CPU, RAM, disk, network)
- Process management (start/stop/restart daemons)
- Log viewer (tail -f equivalent)

### AI-model operations
- Model loading status (loaded models, VRAM usage)
- Inference queue (pending requests, throughput)
- Resource allocation (which models get which GPU time)

---

## 5. ONBOARDING WIZARD (the shared entry point)

**CORRECTED 2026-08-14 (Seat 3, per RAID_AUTHENTIK_IDP_PATTERNS Cross-Seat Notes,
founder-directed fix).** The table previously here listed seven modules
(`ceremony.rs`/`gates.rs`/`ladder.rs`/`probe.rs`/`viewmodel.rs`/`render.rs`/
`doctor.rs`, "2,687 lines, Built") under `b-onboard/src/`. **None of those files
exist in this repository** (verified: tree search excluding `target/`, zero hits).
The wizard machinery below is GREENFIELD — do not open a docket assuming it exists.

What actually exists, `crates/onboarding/src/` (913 lines, 16 tests, zero dependents):

| Component | What it does | Status |
|---|---|---|
| `lib.rs` (639 lines) | Custody/persona binding, authenticator kinds (2 variants), enrolment with written-code floor, grade disclosure (compile-enforced), commons ladder Step 0-3 | Built, tested |
| `age.rs` (274 lines) | Age containment — no birthdate/document representable by construction | Built, tested |
| Ceremony state machine, gates, probe, view model, renderer | The wizard engine itself | **NOT BUILT — greenfield** (see RAID_AUTHENTIK_IDP_PATTERNS for the patterned design) |

Known divergences to resolve before building (RAID_AUTHENTIK cross-seat notes):
the crate is written around `did:autonomi` while the ruled root is `did:webvh`,
and three auth-ladder taxonomies coexist (this brief's 3 tiers, `AuthenticatorKind`'s
2 variants, wallet-relay's 4 rungs) — canonical ladder is an open founder ruling.

**What needs adding:**
1. WebAuthn passkey creation flow (Tier 1)
2. BIP-39 seed generation + backup verification (Tier 1)
3. FIDO2 security key enrollment (Tier 2)
4. TOTP setup (Tier 2)
5. Trezor connection + firmware verification (Tier 3)
6. Self-funding bootstrap (zero balance — user earns b through participation, no subsidy)

The wizard flow:

```
[probe] → detect browser capabilities, device type, available authenticators
    │
    ▼
[tier selection] → "Start free" (Tier 1) | "I have a security key" (Tier 2) | "I have a Trezor" (Tier 3)
    │
    ▼ (Tier 1 path)
[OAuth bootstrap] → GitHub/Google (optional convenience) → email capture
    │
    ▼
[passkey creation] → WebAuthn create() → platform authenticator prompt
    │
    ▼
[seed generation] → BIP-39 mnemonic → "write these 12 words down" → verify 3 random words
    │
    ▼
[bDiD issuance] → did:webvh creation → anchor to Arweave (ANS-104 Ed25519)
    │
    ▼
[wallet ready] → zero balance. User earns b through participation. No subsidy.
    │
    ▼
[gate check] → all gates pass? → [done] → wallet view
```

---

## 6. EXISTING ASSETS (what we build on)

| Asset | Location | Status |
|---|---|---|
| Onboarding crate (2 modules, 913 lines, 16 tests) | `crates/onboarding/src/` | Built (custody/enrolment/age primitives); wizard engine NOT built — §5 correction 2026-08-14 |
| Arweave adapter (Merkle bundle + trait) | `adapter-arweave/src/` | Built (MockArweaveClient, trait ready) |
| Dashboard crate | `dashboard/` | Exists, empty — ready for implementation |
| bnr-shell crate | `bnr-shell/` | Exists |
| bsigner crate | `bsigner/` | Exists |
| Custom Trezor firmware | `source/trezor-firmware/` | Built by bCode (Zano, Vaulta, AR, HIVE, BTS, Injective, exSAT) |
| HTML prototypes | `bnr_dashboard.html`, `bnr_mission_control.html`, `bnr_wallet.html`, `heart_wallet.html` | Reference designs |
| Audited color palette | DESIGN-BRIEF-01 §0 | Committed (biomass, AI, info, guard, b-value — AA-verified) |
| KISS ruling | dispatches/RULING_KISS_BDID_PASSKEY_WALLET | Ratified — passkey + wallet + spend-view |
| Spend receipt schema | KISS ruling §3 | Needs drafting (L-SCHEMA bind) |
| Sovereign AR path | RAID trilogy + storage-substrate-split | Confirmed: arweave-js + arbundles + self-hosted gateway + native JWK |

---

## 7. MVP SCOPE — phased delivery

### Phase 1 — Wallet + Tier 1 Onboarding (target: 4-6 weeks)

**Deliverables:**
1. Leptos project scaffold (WASM frontend + Axum relay server)
2. WebAuthn passkey creation + assertion flow (Tier 1 auth)
3. BIP-39 seed generation + backup verification
4. bDiD creation (did:webvh) + Arweave anchor (ANS-104 Ed25519)
5. Self-funding bootstrap (zero balance, b earning mechanism — no subsidy)
6. Multi-chain balance display (read-only from RPC — Vaulta, Arweave, HIVE)
7. Spend-view (aggregate total + itemized per-adapter breakdown)
8. Basic send/receive (Arweave ANS-104 DataItem, Vaulta transfer)

**Acceptance:** A new user opens the web app, creates a free account with passkey, receives a zero-balance wallet (self-funded — no subsidy), sees balances across 3 chains, and can send/receive. No hardware required.

### Phase 2 — Tier 2 + Active Operations (target: 4-6 weeks after Phase 1)

**Deliverables:**
1. FIDO2 security key enrollment (Tier 2 auth)
2. TOTP setup + verification
3. Active trading interface (resource wallets)
4. Escrow participation
5. Additional chain support (Zano, BTS, Injective/Cosmos)
6. Spend receipt schema (L-SCHEMA) implemented

### Phase 3 — Tier 3 + Desktop Operations (ongoing)

**Deliverables:**
1. Tauri desktop shell wrapping the Leptos app
2. Trezor WebUSB integration (all custom-firmware chains)
3. Node management panel (Autonomi, ar-io-node, Buzz)
4. VPS management panel
5. AI-model operations panel
6. Biometric PoU/PoL enrollment (when biometric ledger is ready)

---

## 8. DESIGN CONSTRAINTS (non-negotiable)

1. **Keys never on the server.** The Axum relay serves data and relays signed transactions. It never holds, sees, or processes private keys. (SOUL.md non-custodial invariant.)
2. **Never hard-code a gateway.** Multi-gateway fallback from day one. This rule would have prevented the Turbo login incident. (RAID Axis 1 finding.)
3. **One codebase, one audit.** All crypto/signing logic is Rust. WASM for browser, native for desktop, same crates. No JS reimplementation of custody-critical code.
4. **Honest-empty panels.** Stale, Absent, Refused, Breach — all four non-value states are compile-enforced. A wrong number is worse than no number. (DESIGN-BRIEF-01 §6.)
5. **Spend-view is resource-denominated.** Line items are chunk counts, mesh-seconds, VRAM-byte-seconds — never fiat. Appreciation would break itemized accounting. (KISS ruling §2/§3.)
6. **OAuth is convenience, not dependency.** GitHub/Google bootstrap is optional. The bDiD + passkey persist without them.
7. **Tier escalation preserves identity.** Upgrading custody doesn't re-onboard. The bDiD is constant; only the verification method changes.
8. **10B users, 1000 years.** The server is stateless per-user. All user state lives on-chain or in client-side storage. The server can disappear and users retain their identity, wallet, and data.

---

## 9. WHAT THE RAID TOLD US (applied to this MVP)

The RAID trilogy assessed 20+ projects. The findings directly shape this MVP:

- **No third-party wallet is worth adopting** (Wander, AO Wallet, Arweave.app all failed the capture test). **Build native.** PATTERN their UX (Wander's injected-provider convention, AO Wallet's local keystore) but never depend on them.
- **Nothing funds AR wallets non-custodially.** The sovereign path is self-funded: user earns b, spends b on operations, converts to native tokens at the draw facility. No endowment, no subsidy. See SPEC_SOVEREIGN_WALLET_FUNDING.md v2.
- **The capture pattern is at the application layer, not the storage layer.** Every ecosystem project re-inserts a token or account between user and base layer. BNR's wallet must not do this — the user's relationship is with their keys and the permissionless base, never with a BNR-operated intermediary.
- **Our anchor-based resolver is architecturally stronger** than ARNS and ANS. The wallet resolves bDiDs via Merkle proofs (self-contained, no gateway read required). Neither ecosystem naming system can make that claim.
- **The sovereign AR path costs $76,980 for 10B identity records** (ANS-104 Ed25519, one-time, permanent). This is affordable and scales.

---

## 10. OPEN QUESTIONS FOR FOUNDER

1. **Leptos vs Dioxus** — Leptos recommended (web-first, more mature). Dioxus if you want desktop+mobile from one codebase from the start. Your call.
2. **OAuth providers** — GitHub + Google confirmed? Add Apple? Drop OAuth entirely for passkey-only onboarding?
3. **Phase 1 chains** — I scoped Vaulta + Arweave + HIVE for Phase 1. Add/remove?
4. **RESOLVED: Self-funded.** Zero balance at issuance. No faucet, no endowment, no subsidy. User earns b through participation. "Free" = no Vaulta account needed, not BNR pays. See SPEC_SOVEREIGN_WALLET_FUNDING.md v2.
5. **Server architecture** — single Axum instance for MVP, or distributed from the start? (For 10B scale: distributed, but for MVP: single is rational.)
6. **Design system** — inherit the audited palette from DESIGN-BRIEF-01, or define a new one for the wallet surface? (Recommendation: inherit — same tokens, re-contrast-checked against the wallet's own backgrounds.)

---

**Goose, Seat 1. Design brief produced. Awaiting Founder review before dispatching to the build team.**
