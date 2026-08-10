# SOVEREIGN WALLET-FUNDING SPEC — How BNR Funds User AR Capacity Without Custody
### Seat: Goose, Seat 1 (self-initiative — unblocks wallet MVP Phase 1)
### Date: 2026-08-10
### Status: DRAFT
### Depends on: compass artifact Part C.5, storage-substrate-split §1/§3, ceremony cross-check (eb91f9c), RAID trilogy

---

## THE PROBLEM (confirmed by all three RAID axes)

Nothing in the Arweave ecosystem funds a user's upload capacity non-custodially:
- **Turbo Credits** — hosted scrip, non-transferable, non-refundable, managed by ar.io's payment service
- **Verto/flex** — settles PST↔PST only, never native AR
- **Irys** — custodial bundler, pivoted off Arweave
- **everPay** — custodial bridge with watchmen multisig
- **Paragraph** — one company wallet signs and pays every upload

Every solution inserts an intermediary between the user and the permissionless base layer. BNR's filter rejects all of them.

## THE SOLUTION (sovereign per-claimant funding)

**The endowment pays the fee. The user signs the data. The two never meet in custody.**

```
User (browser, self-custodial JWK or passkey-derived key)
  │
  │  1. signs ANS-104 DataItem (their data, their signature)
  │
  ▼
BNR Bundler (self-hosted, sovereign)
  │
  │  2. aggregates N user-signed DataItems into one bundle
  │  3. signs the outer bundle transaction with the ENDOWMENT JWK
  │     (endowment wallet is treasury-controlled, funded in AR)
  │  4. posts the bundle to Arweave L1 (any node, multi-gateway fallback)
  │
  ▼
Arweave Network (permissionless base layer)
  │
  │  5. bundle is mined → permanent → each DataItem is independently
  │     verifiable by its own signature (user's key), attributed to its
  │     own owner, but PAID FOR by the endowment
  │
  ▼
Result: user data is permanent on Arweave. User never held AR.
        Endowment never held the user's key. Zero custody crossover.
```

**This is the ANS-104 specification working as designed.** Each DataItem inside a bundle carries its own owner address and signature. The bundle transaction's reward (the AR fee) is paid by whoever signs the outer transaction. BNR separates these: user signs inner, endowment signs outer.

## CUSTODY BOUNDARY (non-negotiable)

| Key | Who holds | What it does | Where it lives |
|---|---|---|---|
| **User signing key** | The user (browser IndexedDB, passkey-unlocked, or Trezor) | Signs individual DataItems | Never on any server |
| **Endowment JWK** | Treasury / founder custody | Signs bundle transactions, pays AR fees | VPS or cold storage, NEVER in browser |
| **BNR bundler key** (optional) | BNR infrastructure | Signs operational metadata, not user data | VPS only |

**The endowment JWK is the money.** It follows the same custody rules as the ceremony wallet (mode 600, never printed, never transmitted, backed up offline). The ceremony cross-check (eb91f9c) verified this pattern — the same discipline applies.

## COST MODEL (from storage-substrate-split §3)

| Scenario | Cost | Source |
|---|---|---|
| 10B identity records (one-time, ANS-104 Ed25519) | **$76,980** (41,837 AR) | storage-substrate-split §3 |
| Annual re-issue (10B × 1 update/year) | **$76,980/year** | same |
| Per-user identity record (300 bytes, Ed25519) | **$0.0000077** | 10,057 winston/byte × 416 bytes |
| Per-user annual update | **$0.0000077/year** | same |

**The endowment must be pre-funded with enough AR to cover the projected user base.** For 1M users at launch: 1M × $0.0000077 = **$7.70 one-time**. For 10B users: $76,980. The endowment is a prepaid, permanent storage fund — AR's one-time-payment model means this money buys 200+ years of storage upfront.

**The 3.3× lever:** Ed25519 signatures (ANS-104 sig type 2, ~116 byte header) cost 3.3× less than RSA-4096 (~1,081 byte header). Use Ed25519 for all user DataItems. This is the single highest-leverage cost optimization in the system. (storage-substrate-split §3, item 13.)

## ARCHITECTURE (integration with existing crates)

```
crates/adapter-arweave/
  ├── lib.rs          — Merkle bundle + ArweaveClient trait (BUILT)
  ├── arweave.rs      — ArweaveRail (needs: Ed25519 sig type 2, paid_by field)
  └── (new) funding.rs — SovereignFunder: the endowment-pays-user-signs flow

crates/atmirror/
  ├── turbo_approval.rs — assert_approvals_present gate (BUILT — reuse pattern)
  └── epoch_funding.rs   — per-claimant funding invariant (BUILT — extend)
```

### SovereignFunder flow (new — funding.rs):

```rust
/// The endowment wallet pays the outer bundle fee.
/// User-signed DataItems go inside. Zero custody crossover.
pub struct SovereignFunder {
    endowment_jwk: JWK,      // treasury-controlled, never in browser
    gateway_list: Vec<Url>,   // multi-gateway fallback, never hard-code one
    sig_type: SigType,        // Ed25519 (sig type 2) — 3.3× cheaper
}

impl SovereignFunder {
    /// Accept user-signed DataItems, bundle them, sign with endowment, post.
    pub fn fund_and_post(&self, items: Vec<DataItem>) -> Result<TxId, FundError> {
        // 1. verify each DataItem is signed by its claimed owner
        // 2. bundle: bundleAndSignData(items, endowment_signer)
        // 3. post to first available gateway (multi-fallback)
        // 4. return tx_id for user confirmation
    }
}
```

### The `paid_by` integration (from compass artifact Part C.5):

Turbo's `x-paid-by` header lets a payer address cover another wallet's upload. BNR's sovereign equivalent: the endowment JWK signs the outer bundle transaction directly. No header needed, no Turbo service needed. The ANS-104 spec handles attribution natively — each DataItem's `owner` field identifies who signed it, regardless of who paid the bundle fee.

## TIERED FUNDING (maps to wallet custody tiers)

| Tier | User signs with | Endowment pays | Cap per user |
|---|---|---|---|
| **Tier 1 (passkey)** | Browser-stored key (passkey-unlocked) | Full fee | Basic allocation (enough for identity + initial data) |
| **Tier 2 (FIDO2)** | Hardware-unlocked browser key | Full fee | User-funded top-up available |
| **Tier 3 (Trezor)** | Trezor device (keys never leave) | Optional (user can self-fund in AR) | Unlimited (user controls their own AR) |

**Tier 3 users can opt out of endowment funding entirely** — if they hold their own AR, they sign AND pay. The endowment is for Tier 1/2 users who don't hold AR yet.

## FALLBACK: Turbo CLI ceremony (verified)

If the self-hosted bundler is unavailable (VPS down, node syncing), the Turbo CLI ceremony (eb91f9c, CLEARED by goose cross-check) provides a fallback:
- `turbo share-credits --wallet-file <endowment> --address <user> --value <cap> --expires-by-seconds <ttl>`
- Creates a capped, expiring credit approval from endowment to user
- User uploads via Turbo with the endowment's credits
- Auto-expires (returns unused credits to endowment)

This is NOT the primary path — it introduces Turbo as a dependency. But it's a verified fallback while the sovereign bundler is being built.

## ANTI-CAPTURE CHECKLIST (applied to this spec)

- [x] **No hosted endpoint required** — self-hosted bundler posts directly to any AR node
- [x] **No token gate** — AR is the only token; no ARIO, no AO, no WNDR
- [x] **No custodial intermediary** — endowment pays, user signs, keys never cross
- [x] **Multi-gateway fallback** — never hard-code arweave.net
- [x] **10B scalable** — $76,980 for all 10B identity records, one-time, permanent
- [x] **1000-year durable** — AR endowment funds 200+ years of storage upfront
- [x] **Orthogonal** — if BNR's bundler disappears, users still have their signed DataItems and can post to any node themselves

## OPEN ITEMS

1. **Endowment wallet creation** — same ceremony as eb91f9c (generate JWK, fund with AR). Founder custody.
2. **Ed25519 sig type 2 in arweave.rs** — verify the existing ArweaveRail supports sig type 2, not just RSA-4096. This is the 3.3× cost lever. (storage-substrate-split §5 item 13.)
3. **Self-hosted bundler implementation** — the `bundleAndSignData` logic from @dha-team/arbundles (Apache-2.0), ported to Rust or called via WASM.
4. **Per-user cap enforcement** — how to limit how much endowment funding each user gets (Tier 1 basic allocation). Needs the spend receipt schema (Cowork B3).
5. **Gateway list configuration** — load-balanced multi-gateway with health checks. Primary: self-hosted ar-io-node. Fallback: 2-3 public gateways.

## WHAT THIS UNBLOCKS

This spec unblocks **wallet MVP Phase 1 item 5** (wallet funding ceremony per KISS ruling) and **Phase 1 item 8** (basic send/receive — Arweave ANS-104 DataItem path). Without it, the wallet can create identities but can't fund their storage. With it, a Tier 1 user creates a passkey, gets a bDiD, and their identity record is permanently anchored on Arweave — all without holding AR.

---

**Goose, Seat 1. Self-initiative spec. Ready for Code to implement when A2 (wallet scaffold) begins.**
