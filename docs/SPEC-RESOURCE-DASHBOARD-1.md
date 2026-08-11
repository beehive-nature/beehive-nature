# SPEC-RESOURCE-DASHBOARD-1 v0.1 — Sovereign Wallet & Resource Management Dashboard
## The resource panel of bDashBoard / BNR Mission Control

Status: DRAFT for founder ratification. One file, one prompt. Specification and schemas only — no host code.
Companion to: SPEC_KEYRING-1 (custody tiers, per-rail keys, bSigner component).
Owner: Goose, primary executor. Visual layer: Claude Design (hold until spec ratifies data-source + enforcement-point per panel).

---

## 0. Standing laws this spec is built under

| Law | Source |
|---|---|
| The surface NEVER holds a key or signs — UI renders and routes; the wallet-relay (bSigner, Code's Phase-0 crate) signs | SPEC_KEYRING-1 §8; founder ruling 2026-07-30 |
| Custody tiers S/H, backup VERIFIED not dismissible | ONBOARD-1 L5 |
| No user incarceration — losing any device/vendor/DiD must never orphan identity | 2026-07-28 priority ruling |
| LOCAL-FIRST — zero hosted chokepoint. The ArDrive hosted-login failure is the founding boarding fact; never hard-code one gateway | Founder directive 2026-08-11 |
| Self-funded: users acquire resources themselves; the system never absorbs cost | CONSTITUTION Art. V.1; SPEC_SOVEREIGN_WALLET_FUNDING |
| Receipt rule: measured > estimated; UNVERIFIED marked and stopped | standing |
| The bDiD root is the SEED, not the device | SPEC_KEYRING-1 §3 |

---

## 1. Scope & relationship to SPEC_KEYRING-1

SPEC_KEYRING-1 owns **identity and custody state** — which key lives where, what tier it is, whether the backup is verified. This spec owns **resource state** — live balances, node health, spend budgets, and the enforcement surface that gates every spend.

The two specs share the **same custody-tier model** (T-H / T-F / T-S / T-P from KEYRING §1) and the **same process-isolation law** (the dashboard UI process never holds private key material; all signing lives in bSigner per KEYRING §8).

**Frontend ruling (founder 2026-08-11, formal):** htmx + hx-boost + Alpine.js + WASM are the **primary** frontend stack for this surface. React is reserved for the minority of tiles where it measurably wins (rich client-state dApps, offline-first surfaces). Leptos/D1 are **SUPERSEDED**. This spec's tile schema (§3) renders through the htmx/Alpine/WASM substrate; the dashboard server (axum on 127.0.0.1) serves hypermedia partials that hx-boost swaps, with Alpine for client-state and WASM (DuckDB-WASM, Extism) for compute/sandbox where needed.

**What this spec adds beyond KEYRING:**
1. **Live balance + health tiles** for every rail and every node on one screen.
2. **Spend caps** — per-rail, per-epoch, per-action budgets enforced at the wallet-relay, not the UI.
3. **Approval routing** — the UI composes a spend request; bSigner checks caps and routes to the signing surface; the human confirms on device.
4. **Node/infra monitoring** — VPS health, Autonomi node status, Arweave gateway reachability, GPU rental state.
5. **The self-funded invariant** — every spend debits the user's own balance on the target rail; the system never fronts cost.

---

## 2. The founding boarding fact — and what it means for this spec

**The ArDrive hosted-login failure** (referenced in founder directive): a single hosted gateway's login/session failure was misreported as a credential problem, stranding the user. The lesson is structural: **a resource dashboard that reads balances through one hosted endpoint is hostage to that endpoint's availability.**

Design consequence (load-bearing for every panel below):
- **Multi-source reads.** Every balance/health tile names ≥2 independent data sources where the rail allows (e.g. Arweave: native REST + GraphQL; EVM: RPC node + block explorer API; Autonomi: antd RPC + CLI probe). The tile degrades gracefully (shows stale + timestamp) rather than failing blank.
- **No hardcoded gateway.** The ar.io gateway, arweave.net, or any single RPC URL is **configurable**, not compiled. The tile tries configured sources in priority order.
- **The dashboard is a reader, not a signer.** Reads are unauthenticated public queries where the rail allows (Arweave balance, EVM balance, Hive RC). The surface never needs credentials to display a balance.

---

## 3. Panel architecture — one screen, custody-tier aware

The resource dashboard is a **single page** with tile groups, each tile a self-contained panel. Layout (Claude Design owns the visual rendering):

```
┌─────────────────────────────────────────────────────────────────┐
│  RESOURCE DASHBOARD                                    [user.b]  │
├──────────────────────────┬──────────────────────────┬───────────┤
│  WALLET BALANCES         │  NODE HEALTH              │  SPEND    │
│  (per-rail tiles)        │  (infra tiles)            │  CAPS     │
│                          │                           │  (budget  │
│  ANT / AR / Autonomi     │  VPS (CPU/mem/disk/net)   │  gates)   │
│  Zano / XLM / SOL        │  Autonomi nodes (×N)      │           │
│  Vaulta A / exSat BTC    │  Arweave gateway          │           │
│  Hive HP / RC            │  GPU rental               │           │
│  Lightning (phoenixd)    │  Buzz relay               │           │
│                          │                           │           │
│  Each tile shows:        │  Each tile shows:         │  Each cap │
│  • Balance (live)        │  • Status (up/down/degr)  │  shows:   │
│  • Custody tier badge    │  • Key metric             │  • Limit  │
│  • Health indicator      │  • Last-checked timestamp │  • Spent  │
│  • Data source(s)        │  • Data source            │  • Remain │
│  • Enforcement point     │  • Enforcement: N/A       │  • Gate   │
└──────────────────────────┴──────────────────────────┴───────────┘
```

### Tile schema (shared by all panels)

```
{ id, label, category: wallet|node|spend,
  custody_tier: T-H|T-F|T-S|T-P|n/a,
  balance_or_value: number|string,
  unit: string,
  health: green|yellow|red|unknown,
  health_reason: text,
  data_sources: [{ name, type: rpc|graphql|rest|cli|indexer, url_config_key, auth_required: bool }],
  enforcement_point: { component: bSigner|wallet-relay|chain-consensus|none,
                       mechanism: text,
                       cap_applies: bool },
  last_updated: timestamp,
  last_updated_source: which data_source answered }
```

---

## 4. Per-rail wallet panels

Each rail tile names its data source(s), custody tier, and enforcement point per the founder's acceptance criterion. **Per ruling 2 (2026-08-11): every "enforcement point" below names the signer-authoritative tier** — the component that holds the key and enforces the cap. The wallet-relay pre-checks the same cap as advisory defense-in-depth but is never the authority.

### 4.1 Autonomi (ANT)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Arbitrum One RPC (ETH RPC `eth_getBalance` at rewards address 0xe2Fc…); (2) Explorer API (Arbiscan) as fallback. Configurable RPC URL — never hardcoded. |
| **Custody tier** | **T-H** — Trezor Safe 7 EVM root (KEYRING §2.1). Rewards address is a dedicated Arbitrum account; ANT is ERC-20 on Arbitrum One. |
| **Enforcement point** | **bSigner** (wallet-relay). Spend caps checked before the relay composes a signing request. The Trezor signs after human on-device confirmation. |
| **Health indicator** | Green = RPC responds + balance > 0; Yellow = fallback source used; Red = no source responds. |
| **Open receipt** | 0xe2Fc dedicated-rewards-address Arbitrum balance — oldest open receipt (KEYRING §5). This tile closes it. |

### 4.2 Arweave (AR)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Configured AR.IO gateway REST (`/wallet/<addr>/balance`); (2) `arweave.net` REST as fallback; (3) GraphQL for bundled-item activity. **MUST read both planes** (KEYRING §2.2): native balance + Turbo/bundled activity. Never hardcode one gateway — the ArDrive hosted-login failure is why. |
| **Custody tier** | **T-S** — ArDrive JWK keyfile in Bitwarden + offline USB (KEYRING §2.2). Native AR keys are T-S permanently (no Trezor RSA primitive). Bundled plane uses the T-H EVM identity via Turbo. |
| **Enforcement point** | **bSigner** for native JWK ops (keyfile in signer's store); **Turbo/EVM path** for bundled uploads (Trezor signs via bSigner's EVM rail). Spend cap = per-upload byte-cost budget. |
| **Health indicator** | Green = gateway responds + native or bundled balance > 0; Yellow = native-empty/bundled-active (expected for Turbo-only accounts); Red = no gateway responds. |
| **Founding-fact guard** | Tile configuration exposes the gateway URL field. Default: user-configured. The tile MUST NOT silently fall back to `arweave.net` without showing which source answered. |

### 4.3 Zano

| Field | Value |
|---|---|
| **Data source(s)** | (1) Zano daemon RPC (`get_balance`, `get_address`); (2) Zano Companion / Lite Wallet API as fallback. Remote-node targeting from extension UNVERIFIED (KEYRING §2.9 — confirm before relying). |
| **Custody tier** | **T-H (pending firmware)** — Safe 7 SLIP39 seed class CLOSED (KEYRING §2.9). Firmware app in-design (anchors to `apps/monero` template). Interim: software key / burner tier. |
| **Enforcement point** | **bSigner** Zano rail — spend secret `s` device-only; view secret `v` exportable to host. CLSAG_GGX per frozen proto v0.3. Spend cap checked before composing a transfer. |
| **Health indicator** | Green = daemon connected + balance confirmed; Yellow = remote node (degraded privacy); Red = no node reachable. |
| **Frozen lane** | All decisions per the zano-trezor ledger. Panel renders watch-address + view-key status + firmware-app milestone tracker. |

### 4.4 Stellar (XLM)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Stellar Horizon API (`accounts/<addr>` — balances, flags); (2) Public Stellar core as fallback. Horizon URL configurable (self-hostable). |
| **Custody tier** | **T-S** interim (software key in bSigner). Trezor XLM support exists in firmware (KEYRING §2 — XLM listed as supported on Safe 7). Promote to T-H when bSigner's Trezor rail speaks XLM. |
| **Enforcement point** | **bSigner** — signs Stellar transactions. Spend cap = per-transaction amount + memo validation (Cosmos/Stellar deposits silently fail without memo — KEYRING §9 chain-key notes). |
| **Health indicator** | Green = Horizon responds + account exists; Yellow = account not found (zero balance, uncreated); Red = Horizon unreachable. |

### 4.5 Solana (SOL)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Solana RPC (`getBalance`, `getTokenAccountsByOwner`); (2) Explorer API fallback. RPC URL configurable. |
| **Custody tier** | **T-H** — Solana + SPL explicitly supported on Safe 7 per trezor.io (KEYRING Thread-2 §2.1). Derivation via SLIP-0010 / BIP-44. |
| **Enforcement point** | **bSigner** Trezor rail — signs Solana transactions after on-device confirmation. Spend cap checked before compose. SPL token transfers scoped to allowlisted mints only. |
| **Health indicator** | Green = RPC responds + balance ≥ 0; Yellow = RPC slow (>3s); Red = no RPC. |

### 4.6 Vaulta (A)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Vaulta node RPC (`get_account` — balance, RAM, CPU, NET); (2) Hyperion / history API for action history. Node URL configurable. |
| **Custody tier** | **Mixed** — owner/active = T-H target (Trezor primitives present, `apps/eos` gate pending per KEYRING §2.6); custom permissions (`publish`, `claim`) = **T-F PUB_WA passkey authorities** (Vaulta uniquely supports on-chain WebAuthn). Interim: T-S with ceremony. |
| **Enforcement point** | **bSigner** Antelope rail (Wharf WalletPlugin) — signs via the BNR signer interface. Spend cap = per-action resource budget (RAM bytes, CPU/NET ms). The paymaster (CD-29) governs gas sponsorship for exSat EVM leg. |
| **Health indicator** | Green = node responds + account exists; Yellow = RAM low (<10% remaining) or CPU/NET staked low; Red = node unreachable. |
| **Permission tree** | Panel renders the full permission hierarchy as a tree (KEYRING §2.6.3) — owner → active → custom → PUB_WA authorities — proving the T-F tier end-to-end. |

### 4.7 Hive (HP + RC)

| Field | Value |
|---|---|
| **Data source(s)** | (1) Hive RPC (`find_rc_accounts` — RC mana/max/regen; `get_accounts` — HP balance); (2) Hive block explorer API fallback. RPC URL configurable (self-hosted hived on VPS per Phase-2 plan). |
| **Custody tier** | **T-S** — posting key rotated 2026-07-30 (KEYRING §2.5, flag CLEARED). Passkey-PRF derivation path (KEYRING candidate, this harvest's Passkey Onboarding entry) promotes posting to T-F when implemented. Owner key stays cold. |
| **Enforcement point** | **bSigner** Hive rail — signs `custom_json` anchors and `transfer_to_vesting` power-ups. Spend cap = RC budget per epoch (5-day regen window; ~20%/day). The dashboard shows RC mana %, regen rate, and projected next-available-op time. |
| **Health indicator** | Green = RPC responds + RC mana > 20%; Yellow = RC mana < 20% (operations will fail soon); Red = RC mana 0 or RPC unreachable. |

### 4.8 Lightning (BTC via phoenixd)

| Field | Value |
|---|---|
| **Data source(s)** | (1) `phoenixd` HTTP API (`getinfo` — channels, balance; `balance` — on-chain + off-chain); (2) On-chain explorer API for UTXO confirmation fallback. phoenixd runs on VPS (self-custodial, MIT per this harvest). |
| **Custody tier** | **T-S** — phoenixd holds channel keys in its own keystore on the VPS. Non-custodial (self-hosted), but keys are software-tier on a server. On-chain funds sweepable to T-H Trezor address. |
| **Enforcement point** | **phoenixd API** (local to VPS). Spend cap = per-payment amount + channel capacity. bSigner routes payment requests through phoenixd's API; phoenixd enforces the payment, not bSigner. Lightning payments are instant and irreversible — cap enforcement MUST happen before the API call, not after. |
| **Health indicator** | Green = phoenixd responding + channel active; Yellow = channel capacity low (<20% outbound); Red = phoenixd down or no channels. |

### 4.9 exSat (BTC, EVM)

| Field | Value |
|---|---|
| **Data source(s)** | (1) exSat EVM RPC (`eth_getBalance`, chainId **7200**); (2) scan.exsat.network API fallback. RPC URL configurable. Pin chainId in configs + verify `eth_chainId` before signing (standing build law, KEYRING §2.7). |
| **Custody tier** | **T-H** — Trezor signs EVM txs with chainId 7200 (firmware signs with unknown-network warning — expected). MetaMask/Rabby interim retired when bSigner ships (KEYRING §2.7 ruling). |
| **Enforcement point** | **bSigner** EVM rail + **CD-29 Resource Paymaster** for gas sponsorship. The paymaster fronts BTC for gas; the kernel debits b on its own ledger; the two meet at the voucher gate (CD-29 §A0). Spend cap = paymaster epoch budget (governed per CD-29 §A7). |
| **Health indicator** | Green = RPC responds + balance ≥ 0; Yellow = chainId mismatch on connect (should never happen); Red = RPC unreachable. |

---

## 5. Node & infrastructure panels

### 5.1 VPS Health

| Field | Value |
|---|---|
| **Data source** | SSH/agent probe from bSigner (localhost on VPS): CPU%, memory, disk%, network I/O, uptime. systemd service status for each managed unit (strfry relay, phoenixd, ar-io-node, hived, Autonomi nodes). |
| **Custody tier** | **n/a** (infrastructure, not a wallet). |
| **Enforcement point** | **bSigner ops layer** — the relay has read-only access to system metrics via a restricted SSH command or local health endpoint. No spend cap applies; this is observability. |
| **Health indicator** | Green = all critical services up + disk <80%; Yellow = disk 80-90% or one service degraded; Red = disk >90% or critical service down. |
| **Alerts** | Disk >85% → flag for action; Autonomi node offline >1h → flag; Buzz relay down → workspace down (single point of failure by design per VPS Architecture harvest). |

### 5.2 Autonomi Nodes (×N)

| Field | Value |
|---|---|
| **Data source** | `antd` RPC / `antctl status` per node. Node Launchpad for managed-node status. Connection metrics (peer count, chunk store size, rewards pending). |
| **Custody tier** | **T-S** — node identity keys are software at burner tier (per this harvest's Thread-2 §2.5). Rewards address = T-H EVM root. **Fresh datacenter-IP rewards address recommended** (don't share home-IP address — privacy regression per VPS Architecture harvest). |
| **Enforcement point** | **n/a** (node operation, not spend). Rewards accrue to the configured EVM address — no signing needed for accrual. |
| **Health indicator** | Green = connected to network + peer count > threshold; Yellow = low peer count or store growing slowly; Red = node offline or disconnected. |
| **Open item** | Autonomi node emissions PAUSED Jan 20, 2026 (per Gap Analysis harvest) — live uncertainty on per-write cost. Tile should show emission-status flag. |

### 5.3 Arweave Gateway (self-hosted)

| Field | Value |
|---|---|
| **Data source** | Self-hosted `ar-io-node` health endpoint (no-token/no-stake mode per Arweave raid harvest). Fallback: external AR.IO gateway probe. |
| **Custody tier** | **n/a** (infrastructure). The gateway is BNR-owned and operated. |
| **Enforcement point** | **n/a** for reads (public). For writes (uploads through the gateway), enforcement is at bSigner's JWK/Turbo path (§4.2). |
| **Health indicator** | Green = gateway responds to HEAD request + peer sync active; Yellow = slow response or stale peer list; Red = gateway down. |

### 5.4 GPU Rental

| Field | Value |
|---|---|
| **Data source** | (1) Rental provider API (configurable — e.g. Vast.ai, RunPod, or self-hosted GPU box); (2) Local GPU probe (nvidia-smi / ROCm) for owned hardware. Metrics: GPU%, VRAM%, active model, estimated cost/hr, session time remaining. |
| **Custody tier** | **T-S** — rental API keys in bSigner's store. Payments are pre-funded by the user (self-funded invariant). |
| **Enforcement point** | **bSigner** — spend cap = per-session rental budget (USD or b equivalent). The relay checks the budget before provisioning or extending a rental session. Human confirms on device for sessions exceeding the daily cap. |
| **Health indicator** | Green = GPU active + VRAM available + session within budget; Yellow = session approaching budget cap; Red = GPU down or budget exceeded. |
| **Self-funded rule** | The user's A/b balance funds rental payments. The system never fronts GPU cost. If balance insufficient, the tile shows "insufficient funds — top up to extend." |

### 5.5 Buzz Relay

| Field | Value |
|---|---|
| **Data source** | `strfry` / Buzz relay NIP-11 info document + event-count probe. Connection status from the workspace's Buzz client. |
| **Custody tier** | **T-P** (hosted community relay = honest badge "hosted, not sovereign") with escape hatch: identity travels with keys + signed log (KEYRING §2.8). Target sovereign endpoint: `wss://buzz.bNature.social`. |
| **Enforcement point** | **n/a** (relay liveness, not spend). The relay is the workspace's SPOF by design — tile should prominently show relay status because workspace-down = relay-down. |
| **Health indicator** | Green = relay responds + event count increasing; Yellow = relay slow or stale events; Red = relay down (workspace non-functional). |

---

## 6. Spend caps & approval routing

### 6.1 The enforcement architecture — SIGNER-AUTHORITATIVE (founder ruling 2026-08-11)

**The cap is enforced at the tier holding the key.** Trezor firmware enforces where the rail supports it; the JWK signer (bSigner's key-holding component) enforces otherwise. The wallet-relay (Code's Phase-0 crate, stateless and keyless) pre-checks the same cap as **advisory defense-in-depth** — it is never the authority. A keyless relay can be replaced, so a cap only it enforces is not a cap.

```
USER ACTION (dashboard tile)
    │
    ▼
DASHBOARD UI (compose request)     ←── never holds keys
    │  "spend X ANT from rail Y"
    ▼
WALLET-RELAY (Phase-0 crate)       ←── stateless, KEYLESS — advisory only
    │  Pre-check cap (advisory defense-in-depth):
    │    • Is X within per-action / per-epoch budget?
    │    • Is action type on the allowlist?
    │  If exceeds → advise reject + show reason (but this is NOT the cap)
    │  If within → forward compose request to signer
    ▼
SIGNER (bSigner key-holding tier)  ←── THE AUTHORITY — holds the key
    │  ENFORCE cap (authoritative):
    │    • T-H: Trezor firmware validates tx params before signing
    │    • T-S: JWK signer checks cap, then signs with stored key
    │    • T-F: passkey/authenticator enforces user-confirmation gate
    │  If cap exceeded → REJECT (this is the cap that binds)
    │  If within cap → sign
    ▼
HUMAN CONFIRMS ON DEVICE           ←── T-H/T-F always; T-S above threshold
    │
    ▼
CHAIN RECEIPT                      ←── broadcast confirmation
    │
    ▼
DASHBOARD UI (render receipt)      ←── shows confirmed tx, updates balance
```

**Key invariant (ruling 2):** the authoritative cap enforcement lives at the **signer tier** — the component that holds the key and cannot be bypassed without the key. The relay's pre-check is defense-in-depth: it catches honest mistakes and reduces signer load, but a compromised or replaced relay cannot weaken the cap because the signer re-checks independently. Both are built (inclusion); the signer is labeled authoritative, the relay advisory.

### 6.2 Cap model

```
SpendCap {
  rail: string,              // "ANT" | "AR" | "Zano" | "XLM" | "SOL" | "Vaulta" | "Hive" | "Lightning" | "exSat" | "GPU"
  per_action_max: amount,    // hard ceiling on any single spend
  per_epoch_budget: amount,  // total spend allowed per epoch
  epoch_length: duration,    // default: 30 days (CD-29 MAX_EPOCH_LENGTH alignment)
  spent_this_epoch: amount,  // running total, reset each epoch
  action_allowlist: [action_types],  // e.g. ["transfer", "custom_json", "upload", "rent_gpu"]
  approval_threshold: amount, // spends above this require on-device human confirmation (always for T-H)
}
```

### 6.3 Tier-dependent enforcement (signer-authoritative)

| Custody tier | Cap authority | Relay role | Human confirmation |
|---|---|---|---|
| **T-H (Trezor)** | **Trezor firmware** validates tx params before signing — the device itself refuses to sign a tx exceeding the cap where the rail/app supports it. | Advisory pre-check only. | **Always** — physical button-press. No automated signing. |
| **T-F (passkey)** | **Authenticator** enforces user-presence + UV gate. Cap encoded in the signed challenge scope. | Advisory pre-check only. | **Always** — biometric/PIN. |
| **T-S (JWK signer)** | **bSigner's key-holding component** checks cap, then signs with stored key. This IS the authority for software-tier keys — the signer holds the key and cannot be bypassed. | Advisory pre-check (same cap, same logic — catches honest mistakes before they reach the signer). | **Above threshold** — human confirms for spends exceeding `approval_threshold`. Below: signer signs autonomously (convenience tier, logged). |
| **T-P (platform)** | **Platform signing key** governed by the platform's own auth (e.g. Hive posting key, ATProto rotation key). Cap is structural (posting key cannot move funds; active key can). Escape hatch named. | Advisory pre-check only. | Per platform (Hive posting: no confirmation for custom_json; active: always). |

**Why signer-authoritative (ruling 2 rationale):** a keyless relay can be replaced — by the user, by an attacker, by a bug. A cap that only the relay enforces is a cap that vanishes when the relay is swapped. The signer cannot be replaced without the key, so a cap the signer enforces is a cap that holds regardless of what sits between the UI and the signer. The relay's advisory pre-check is still valuable (defense-in-depth, UX, signer load reduction) but it is never the binding enforcement.

---

## 7. The self-funded invariant

Every spend debits the user's own balance on the target rail. The system never fronts cost, never holds an endowment for user spending, and never creates debt.

Implementation consequences:
- **Insufficient balance = rejected spend.** The relay checks balance before composing. The tile shows "insufficient [token] — top up at [source]" with a link to the funding path (e.g. exchange, Lightning→Hive bridge, or self-acquired).
- **No cross-rail lending.** The relay does not borrow from one rail to fund another. If ANT is low and AR is high, the user must explicitly bridge/swap (and the bridge itself may be custodial-for-a-moment per the BTC/Lightning/HIVE harvest finding).
- **GPU rental is pre-paid.** The rental budget is locked from the user's balance when the session starts, not charged after.

---

## 8. Acceptance criteria

1. **Every wallet panel** (§4.1–4.9) names its **data source(s)**, **custody tier** (T-H/T-F/T-S/T-P per KEYRING §1), and **enforcement point** (where a cap/approval is checked) — zero tiles reading "unknown custody" or "unknown source."
2. **Arweave tile** reads **both planes** (native + bundled) and shows which gateway answered — the ArDrive hosted-login failure cannot recur silently.
3. **A grep** of the dashboard's config, state, and logs finds no secret material — demonstrable, not asserted (KEYRING §6 criterion 4, inherited).
4. **Vaulta tile** renders the permission hierarchy as a tree including any PUB_WA authority, proving the T-F tier end-to-end (KEYRING §6 criterion 5).
5. **Hive tile** shows RC mana %, regen rate (5-day/20%-per-day), and projected next-available-op time.
6. **Spend caps are signer-authoritative** (ruling 2): the cap binds at the key-holding tier — Trezor firmware for T-H, authenticator for T-F, JWK signer for T-S. The relay pre-checks as advisory defense-in-depth but is never the authority. Provable by replacing the relay with a bypass and observing that the signer still rejects capped spends.
7. **Every T-H/T-F spend** requires on-device human confirmation — there exists no code path by which the dashboard triggers a signature without it.
8. **Frontend stack** (ruling 1): the surface renders through htmx + hx-boost + Alpine.js + WASM. React is used only where it measurably wins. Leptos/D1 superseded — no Leptos dependency in the dashboard build.
8. **Self-funded invariant**: insufficient balance = rejected spend with a human-readable "top up" message, never an automated bridge/borrow.
9. **Multi-source degradation**: when the primary data source for any tile fails, the tile shows stale data + timestamp + which fallback source answered, rather than failing blank.
10. **No hardcoded gateway**: every RPC/API URL is a configuration value, not compiled into the binary.

---

## 9. UNVERIFIED register (marked and stopped, per law)

- Autonomi node emissions PAUSED Jan 20, 2026 — live uncertainty on per-write cost (Gap Analysis harvest). Tile should show emission-status flag until resolved.
- Zano remote-node targeting from Companion/Lite Wallet extension — UNVERIFIED (KEYRING §2.9).
- Hive `custom_json` exact RC cost — load-dependent, query live node (this harvest, Passkey Onboarding coverage gap).
- Whether any BNR surface has live b rails today (b Token metering harvest — UNVERIFIED).
- Autonomi 2.0 mutable-type removal — `docs.rs/autonomi` is stale (still lists four legacy types). Confirm client crate physically removed mutable modules before freezing the Autonomi tile.
- phoenixd API surface for balance/channel queries — VERIFIED MIT license, but specific API endpoints for health monitoring need live testing.
- Stellar Horizon self-hostability and exact API shape for balance queries — confirm before building the XLM tile.
- Solana SPL token allowlist scope — define which mints are permitted before the SOL tile ships.

---

## 10. Relationship to existing crates

| Crate | Role in this spec |
|---|---|
| `crates/wallet-relay/` (Code's Phase-0) | The signing surface. Implements bSigner. Holds device sessions + keystore access. Enforces spend caps. The dashboard talks to it over a local authenticated channel. |
| `crates/dashboard/` | The resource dashboard UI process. Secret-free by construction. Renders tiles, composes spend requests, renders receipts. |
| `crates/console-api/` | The API layer between dashboard and relay. |
| `crates/chain-*` (Autonomi, Arweave, Zano, EOS/Vaulta, exSat) | Per-rail adapters that the relay calls to compose/sign/broadcast. Each adapter = one rail's signing path. |
| `crates/treasury-t0/` | Treasury/balance aggregation for the dashboard's wallet panels. |

---

## 11. Sequencing (per founder staging directive, SPEC_SOVEREIGN_WALLET_FUNDING)

| Phase | Focus | Dashboard panels live |
|---|---|---|
| **Phase 0** (now) | AR/ANT functional | Arweave tile (balance + upload), Autonomi tile (ANT balance + node status) |
| **Phase 1** (after P0) | Vaulta A metering via Buzz + Stellar onboarding | Vaulta tile (A balance + RAM/CPU/NET), XLM tile (balance + sequence), Hive tile (HP + RC), Buzz relay tile |
| **Phase 2** (after P1) | HIVE social/coordination | Full Hive tile (posting/active/memo keys, RC mana, recovery partner status) |
| **Phase 3** (parallel) | VPS + node fleet | VPS health, Autonomi node tiles, Arweave gateway, GPU rental |
| **Phase 4** (when b deploys) | b on mainnet Vaulta | Spend caps in b (replaces A-metering), full spend-cap panel |

Each phase adds panels without removing prior ones. The dashboard grows with the build.

---

*Goose, primary executor. Visual layer held for Claude Design until this spec ratifies. Cites: SPEC_KEYRING-1 (custody tiers, per-rail keys, bSigner), SPEC_SOVEREIGN_WALLET_FUNDING (staging model), CD-29 (resource paymaster / spend caps), pirate-haul-rulings-2026q3 (standing laws).*
