# Zano × Trezor / Beehive Nature Kernel — Handoff v1.2

**Changes from v1.1:** Part 1 finalized against Zano source (three fine-print fixes); Section 4 status table patched to agree with Part 1; Directive #1 re-scoped to the *correct* design; Directives #2–#4 implemented with the **Lazy-Linking / identity-less-settlement** invariant enforced.

**Status:** Trezor–Zano: host-side ring-signature prototype complete; on-device signing (firmware app) is the open item. Kernel semantics (7 primitives) validated and unchanged. Marketplace/indexer architecture (Sections 2–6 of the prior doc) unchanged and valid.

---

## PART 1 — Trezor × Zano: current reality (finalized)

### 1.1 What a Zano spend actually is
A Zano spend is **not** a hash signed by one key. It is a **linkable ring signature** — `generate_CLSAG_GGX`, a 3/2-CLSAG over the G, G, X generators (from Zano's `src/crypto/clsag.cpp`) — accompanied by **Bulletproofs+ (`bppe`) range proofs**, **Zarcanum concealing points** on confidential outputs, and a separate **balance proof** (double-Schnorr over G/X, checked in `check_tx_balance`). These are four distinct constructions; do not collapse them.

Signing requires: derive the spend secret; select a decoy ring; compute a **key image** that links to the spend secret (via Zano's `crypto_ops::generate_key_image` — *use the exact construction in that function; do not assume Monero's `x·H_p(P)` form without confirming against source*); run the CLSAG challenge/response ladder across every ring member; attach BP+ proofs and the balance proof. The spend secret flows through the challenge/response loop — so **any part of that loop executed off-device exposes the secret.**

### 1.2 What exists today: host-side prototype (not hardware-secured)
- **Key derivation:** uses Trezor `GetPublicKey`/`ecdh` to obtain the material for the view key without exposing the master seed. *(The `ecdh`-mode view-key derivation is To-Be-Confirmed against the code — CryptoNote view keys are normally derived deterministically as a scalar from the spend secret, e.g. `keccak(spend_secret)`, not via ECDH scalar-mult. Verify before relying on this line.)* Derivation is **SLIP-0010-based, not BIP44**; the previously documented `m/44'/0'/0'/0'` is **wrong** (coin type `0'` = Bitcoin) and is being replaced with the correct Zano SLIP-0010 path, pending confirmation against Zano wallet source.
- **Transaction construction:** host selects inputs/decoys, builds stealth outputs, computes BP+ range proofs — all in Rust.
- **Ring signature:** the dv-CLSAG is computed **entirely in host software** from the Trezor-derived spend secret. **The spend secret is reconstructed in host RAM; the Trezor provides no isolation during signing.**

### 1.3 Why the prototype is still useful
It proves the Zano tx format, serialization, and RPC path are correctly understood, that Trezor-derived keys produce network-accepted testnet transactions, and (once the derivation path is fixed) that the derived wallet matches the software wallet for backup/recovery. It is a valid stepping stone — **not** a hardware wallet.

### 1.4 The real path
On-device **`CLSAG_GGX` firmware app** + a **multi-round host↔firmware protocol** (`messages-zano.proto`, modeled on Monero's): host sends prefix, ring members, and offloaded data; firmware holds the key, computes key image + ring signature; host assembles the final tx without ever seeing the spend secret. Until then, Part 1 is *"host-side wallet with Trezor-assisted key derivation,"* not *"hardware wallet."*

---

## DIRECTIVE #1 — Security audit (of the *correct* design)

The original directive asked about "deterministic k-value / nonce reuse in Ed25519." That is the wrong target: **plain Ed25519 nonces are deterministic (RFC 8032) — a non-issue.** The real attack surface, in priority order:

1. **The status-quo violation itself (highest severity).** Host-side CLSAG = spend secret in host RAM. Any host-memory compromise during tx build steals the key. This is not a side channel; it is the absence of the boundary. Fix = move CLSAG on-device.
2. **CLSAG / BP+ blinding-scalar entropy (the *real* nonce risk).** The danger lives in the `α` scalars and the amount/asset blinding masks, and in **state reuse across the multi-round protocol**. Weak RNG, reused blinding factors across inputs, or replayed/reordered protocol rounds can leak the spend secret or de-blind amounts. Mitigate with deterministic, per-input, transcript-bound nonce derivation and HMAC-sealed round state (the offload-tamper model from the protocol proposal).
3. **The `1/8` (torsion) premultiplication asymmetry** between generate and verify in `CLSAG_GGX` — a correctness footgun that can also become a malleability issue if mishandled. Pin with test vectors from Zano's node.
4. **Serialization/transcript divergence.** If the device's prefix hash isn't byte-identical to the daemon's, signatures verify locally but are rejected on-chain (or, worse, differ in a way that leaks structure). Vector-test the serializer first.
5. **Display-trust gap.** Until the firmware app renders recipient/amount/asset on the trusted screen, the user authorizes a hex blob — blind signing, the classic hardware-wallet defeat.

**Verdict:** the security property you want can only be audited against the on-device design. The current design has no property to audit — the secret isn't isolated.

---

## SECTION 4 — status table patch (resolves the v1.1 contradiction)

Replace the old "Completed: `zano-trezor` … can build/sign/submit transactions" line with:

- **Completed:** host-side Zano tx construction + serialization + RPC submission; Trezor-*assisted* key derivation (view key via ECDH, TBC); testnet acceptance of host-signed txs.
- **Open (next milestone):** on-device `CLSAG_GGX` signing — Trezor firmware app + `messages-zano.proto` multi-round protocol. Until delivered, spend-key isolation is NOT achieved.
- **Correction:** derivation path is SLIP-0010-based; `m/44'/0'/0'/0'` retired.

---

## DIRECTIVE #2 — Kernel structs (Rust), Lazy-Linking enforced

Design rules honored: `DataReference`-only payloads (raw Zano bytes go to Autonomi, never the event); **two independent proof types**; **settlement events carry no subject identity**; **authorization never reaches the platform bus**; the link lives **only** in the user's vault.

```rust
// core/kernel/src/lib.rs
#![forbid(unsafe_code)]
#![no_std]
extern crate alloc;
use alloc::vec::Vec;

// Kernel holds NO chain-specific logic and NO JSON. Binary only.
// bincode 2.x derives (Encode/Decode) avoid serde/JSON entirely.

/// 32-byte content hash — the ONLY way the kernel references external data.
#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub struct DataReference(pub [u8; 32]);

/// Stable handle to an Identity primitive. NOT a key.
#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub struct IdentityId(pub [u8; 32]);

/// Per-event id. Minted locally; NOT a cross-event correlation key.
#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub struct EventId(pub [u8; 16]);

#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub enum SignatureScheme { Ed25519Clsag, Secp256k1, Fido2 /* … */ }

/// Abstract over the proving mechanism. This abstraction is exactly what lets
/// Trezor→FIDO2 and Zano→other-chain swaps leave the 7 primitives untouched.
#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub enum ProofMethod {
    /// Layer 1/2 authorization of Intent (Trezor today, FIDO2 tomorrow).
    /// For confidential settlements this stays in the sovereign vault and is
    /// NEVER emitted to the platform bus.
    CryptographicSignature {
        signature_ref: DataReference, // blob lives in vault; never inline
        scheme: SignatureScheme,
    },
    /// Layer 4 settlement inclusion. Verifiable against the chain.
    /// Carries NO amount, NO counterparty, NO identity. Bus-safe.
    ChainInclusion {
        tx_id_hash: [u8; 32],
        block_ref: DataReference,
    },
}

#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub enum EventKind {
    ConfidentialSettlementObserved, // from chain-zano (identity-less)
    CoordinationAction,             // from chain-vaulta (may carry subject)
    DocumentStored,                 // from arweave/autonomi adapters
    // …
}

/// The only thing that ever hits the public bus.
#[derive(Clone, PartialEq, Eq, bincode::Encode, bincode::Decode)]
pub struct CanonicalEvent {
    pub id: EventId,
    pub kind: EventKind,
    /// ONLY payload: a reference into Autonomi/Arweave. Raw chain bytes NEVER here.
    pub payload_ref: DataReference,
    pub proof: ProofMethod,
    /// Coarse time bucket (not a precise timestamp) — defense-in-depth vs.
    /// timing correlation. Block times are public anyway; the real protection
    /// is `subject == None` below.
    pub observed_bucket: u64,
    /// LAZY LINKING INVARIANT: adapters that observe confidential settlement
    /// MUST set this to `None`. They cannot know the subject (stealth address +
    /// ring signature reveal nothing), and must not guess.
    pub subject: Option<IdentityId>,
    // DELIBERATELY ABSENT: no `intent_id`, no correlation key of any kind.
}

/// Created ONLY inside the user's Cognition runtime, stored ONLY in the user's
/// encrypted Autonomi vault. Never serialized to bus/Postgres/ClickHouse/Kafka.
/// This is the SINGLE place "my authorization" ↔ "this settlement" is linked.
#[derive(Clone, bincode::Encode, bincode::Decode)]
pub struct SettlementLink {
    pub authorization: EventId,       // local auth KnowledgeObject (never on bus)
    pub settlement: EventId,          // public identity-less settlement event
    pub matched_via_view_key: bool,   // recognized as "mine" using the Zano view key
}
```

**Data-class boundary, concretely:** a private ZANO spend produces (a) a **local** `KnowledgeObject` carrying `ProofMethod::CryptographicSignature` — the Trezor authorization, staying in the vault; and (b) a **public** `CanonicalEvent { kind: ConfidentialSettlementObserved, subject: None, proof: ChainInclusion { … } }`. The raw tx bytes go to Autonomi under `payload_ref`. The two are joined only inside the vault, only via the view key, as a `SettlementLink`.

---

## DIRECTIVE #3 — `adapters/chain-zano` skeleton

Structural guarantee first — the adapter's `Cargo.toml` proves it cannot know about Trezor or identity:

```toml
# adapters/chain-zano/Cargo.toml
[dependencies]
kernel = { path = "../../core/kernel" }
bus    = { path = "../../core/bus" }
tokio  = { version = "1", features = ["rt-multi-thread", "sync", "macros", "time"] }
# NO trezor, NO signing crate, NO identity crate — by construction.
```

```rust
// adapters/chain-zano/src/lib.rs
#![forbid(unsafe_code)]

use kernel::{CanonicalEvent, DataReference, EventId, EventKind, ProofMethod};
use bus::EventPublisher;
use tokio::sync::mpsc;

/// Persisted resume cursor — Zano has NO streaming, so we scan by height and
/// checkpoint. On restart we resume from `last_scanned_height`.
pub struct Cursor { pub last_scanned_height: u64 }

pub struct ZanoAdapter<P: EventPublisher> {
    rpc_url: String,
    publisher: P,
    cursor: Cursor,
}

impl<P: EventPublisher + Send + 'static> ZanoAdapter<P> {
    pub async fn run(mut self) -> anyhow::Result<()> {
        // Bounded channel => a slow bus applies BACKPRESSURE to the scanner
        // instead of unbounded memory growth or blocking the RPC loop.
        let (tx, mut rx) = mpsc::channel::<CanonicalEvent>(1024);

        // Task A: scan the chain, decode, map to identity-less events.
        let scanner = {
            let rpc = self.rpc_url.clone();
            let mut height = self.cursor.last_scanned_height;
            tokio::spawn(async move {
                loop {
                    let blocks = rpc_get_blocks(&rpc, height, 100).await?; // getblocks
                    if blocks.is_empty() {
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        continue;
                    }
                    for b in blocks {
                        for raw_tx in decode_cryptonote_block(&b)? {
                            // Store raw bytes in Autonomi; keep only the reference.
                            let payload_ref: DataReference = put_autonomi(&raw_tx).await?;
                            let ev = CanonicalEvent {
                                id: EventId(new_ulid()),
                                kind: EventKind::ConfidentialSettlementObserved,
                                payload_ref,
                                proof: ProofMethod::ChainInclusion {
                                    tx_id_hash: raw_tx.id_hash(),
                                    block_ref: b.block_ref(),
                                },
                                observed_bucket: coarse_bucket(b.timestamp()),
                                subject: None, // <-- LAZY LINKING: adapter cannot & must not attribute
                            };
                            if tx.send(ev).await.is_err() { return anyhow::Ok(()); }
                        }
                        height = b.height + 1;
                        checkpoint(height).await?; // durable cursor
                    }
                }
            })
        };

        // Task B: drain to the bus (at-least-once; downstream is idempotent on EventId).
        while let Some(ev) = rx.recv().await {
            self.publisher.publish(&ev).await?;
        }
        scanner.await??;
        Ok(())
    }
}

// --- stubs to be implemented ---
async fn rpc_get_blocks(_url: &str, _from: u64, _count: u32) -> anyhow::Result<Vec<Block>> { todo!() }
fn decode_cryptonote_block(_b: &Block) -> anyhow::Result<Vec<RawTx>> { todo!() }
async fn put_autonomi(_bytes: &RawTx) -> anyhow::Result<DataReference> { todo!() }
async fn checkpoint(_height: u64) -> anyhow::Result<()> { todo!() }
fn coarse_bucket(_ts: u64) -> u64 { todo!() }
fn new_ulid() -> [u8; 16] { todo!() }
struct Block; struct RawTx;
impl Block { fn block_ref(&self) -> DataReference { todo!() } fn timestamp(&self) -> u64 { todo!() } }
# // (height field elided in stub)
impl RawTx { fn id_hash(&self) -> [u8; 32] { todo!() } }
```

Properties: RPC-poll (no streaming), decode → Autonomi → identity-less `CanonicalEvent`, bounded `mpsc` for backpressure, durable height cursor, and — by dependency graph — zero knowledge of Trezor, keys, or identity.

---

## DIRECTIVE #4 — Substitution proof (what breaks vs. what survives)

**Claim:** replacing Trezor with a generic FIDO2/enclave, or Zano with another confidential chain (or a Zano hard-fork), changes only adapters and `ProofMethod` production. The seven primitives are untouched.

| Change | Touches | Untouched |
|---|---|---|
| Zano hard-fork (new tx format, new CLSAG variant) | `chain-zano` decode + serializer; firmware `CLSAG_*` | Kernel primitives, `ProofMethod::ChainInclusion` shape, bus, normalizer contract |
| Trezor → FIDO2 / other enclave | identity/authorization adapter; `SignatureScheme` variant | Kernel, `ProofMethod::CryptographicSignature` shape, settlement path |
| Zano → different confidential chain | new `chain-x` adapter | Everything above the adapter; `Requires: settlement.confidential` still resolves |

**Why it holds:** `Identity` is `ProofMethod`-agnostic; `Settlement` is resolved from `Requires: settlement.confidential`, never "Use Zano"; `Evidence` is abstract over method; payloads are `DataReference`-only. So a swap adds/edits an adapter and maybe one `enum` variant, and the primitives, the bus contract, and the Lazy-Linking invariant all survive verbatim.

**Honest boundary (the correction to the earlier "the kernel proves it" framing):** the kernel *survives* substitution; it does **not police** what an adapter does internally. A malicious or buggy `chain-zano` could still exfiltrate keys or attach a subject it shouldn't — the kernel cannot see inside it. The kernel guarantees *isolation of concerns and substitutability by construction*; it does **not** guarantee adapter honesty. That remains a code-audit / reproducible-build / capability-sandbox problem, one layer down. Claiming more than that is the same over-reach we removed from Part 1.

---

## Invariants enforced by v1.2 (checklist for future code)
1. On-device CLSAG is the only path to spend-key isolation; host-side signing is prototype-only.
2. `DataReference`-only payloads; raw chain bytes live in Autonomi/Arweave, never in events.
3. **Lazy Linking:** no shared correlation key on the bus.
4. **Identity-less settlement:** confidential-settlement adapters set `subject: None` — the deeper invariant that makes Lazy Linking actually private.
5. Authorization proofs never touch the platform bus; the auth↔settlement link exists only in the user's vault, matched via the view key.
6. `forbid(unsafe_code)`; binary (bincode) only; Planner emits capabilities, never chain names.
7. Kernel survives substitution but does not audit adapter internals — verify that separately.
