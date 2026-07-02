# Zano × Trezor / Beehive Nature Kernel — Handoff v1.3

**Changes from v1.2:** the two "To-Be-Confirmed" cryptographic items are now resolved against Zano source (`hyle-team/zano/src/crypto/crypto.cpp`). Part 1 and the firmware requirements are updated to match. Directives #2–#4 (kernel structs, `chain-zano` adapter, substitution proof) are **carried forward verbatim from v1.2 and remain valid** — nothing in them changes. This document supersedes v1.1/v1.2 for Part 1 and the crypto verdicts.

**Status:** Trezor–Zano: host-side prototype complete; on-device signing (firmware app) is the open item, with the derivation and key-image constructions now fully specified. Kernel semantics unchanged and validated. Zero TBC tags remain on the cryptography.

---

## PART 1 — Trezor × Zano: current reality (finalized, source-confirmed)

### 1.1 What a Zano spend is
A Zano spend is a **linkable ring signature** — `generate_CLSAG_GGX` (3/2-CLSAG over G, G, X, from `clsag.cpp`) — plus **Bulletproofs+ (`bppe`)** range proofs, **Zarcanum concealing points** on confidential outputs, and a separate **balance proof** (double-Schnorr over G/X, in `check_tx_balance`). Four distinct constructions. The spend secret flows through the CLSAG challenge/response ladder, so any part of that loop executed off-device exposes the secret.

### 1.2 Key derivation — SOURCE-CONFIRMED
From `crypto.cpp`:

- **Spend keypair** (`generate_keys`): `s = random_scalar`, `S = s·G`.
- **View secret** (`dependent_key`): **`v = hash_to_scalar(s) = keccak256(s) mod ℓ`.** Deterministic hash of the spend secret. **Not ECDH.**
  ```cpp
  void crypto_ops::dependent_key(const secret_key& first, secret_key& second) {
      hash_to_scalar(&first, 32, second);   // second = Hs(first)
      if (sc_check(...) != 0) throw ...;
  }
  ```
- **View public**: `V = v·G`. **Address** = {`S`, `V`} (+ flags).

**Correction to the prototype:** the current `Trezor GetPublicKey`/`ecdh` view-key path is **wrong**. It yields a view key `≠ Hs(s)`, producing a wallet that is incompatible with every standard Zano wallet (cannot correctly recognize its own incoming outputs; will not import to stock Zano software). The firmware app must compute `v = keccak256(s) mod ℓ` **on-device** (Keccak + reduce; no ECDH command).

### 1.3 Key image — SOURCE-CONFIRMED
From `crypto.cpp` (`generate_key_image`):

- **`I = s · Hp(P)`** — identical to CryptoNote/Monero.
- **`Hp(P) = ge_mul8( ge_fromfe_frombytes_vartime( keccak256(P) ) )`** — Zano's specific hash-to-point (`hash_to_ec`), with an explicit cofactor-clearing `mul8`.

**Load-bearing firmware detail:** `Hp` is **not** a modern standard hash-to-curve (Elligator2 / RFC 9380). The firmware must port Zano's exact `ge_fromfe_frombytes_vartime` + `ge_mul8`. A generic hash-to-curve produces invalid key images that the daemon rejects.

### 1.4 What exists today: host-side prototype (not hardware-secured)
Host selects inputs/decoys, builds stealth outputs, computes BP+ proofs, and **computes the dv-CLSAG entirely in host software** from the Trezor-derived spend secret → the spend secret is in host RAM; the Trezor provides no isolation during signing. Useful for proving tx format/serialization/RPC and (once the view-key derivation is fixed) wallet-compatibility, but **not** a hardware wallet.

### 1.5 Firmware requirements (updated, definitive)
The on-device `CLSAG_GGX` app + multi-round protocol (`messages-zano.proto`) must implement, on-device:
1. Spend scalar `s` from the SLIP-0010 leaf (see §1.6).
2. **View secret `v = keccak256(s) mod ℓ`** — replaces the ECDH approach entirely.
3. **Key image `I = s·Hp(P)`** using Zano's `ge_fromfe_frombytes_vartime` + `ge_mul8` hash-to-point.
4. `generate_CLSAG_GGX` challenge/response ladder over the ring; BP+ (`bppe`) for ≤2 outputs on-device, offload+verify for >2; Zarcanum concealing points; balance proof.
5. Byte-identical tx-prefix serialization (vector-tested against the daemon).

### 1.6 SLIP-0010 derivation path — finalized shape
- **SLIP-0010 over Ed25519, all-hardened:** `m / 44' / <ZANO_SLIP44>' / account'`.
- **Do not** use coin type `0'` (Bitcoin), `60'` (Ethereum), or `128'` (Monero). Use Zano's registered SLIP-44 coin type (confirm the exact value from the SLIP-44 registry before shipping; register one if absent).
- From the SLIP-0010 leaf, reduce to the spend scalar `s` (mod ℓ), following Trezor's Monero-key reduction precedent; then derive `v = Hs(s)` per §1.2.
- **Recovery caveat (document prominently):** this is a Trezor-specific derivation. Zano's native seed scheme is not SLIP-0010, so recovery into stock Zano software requires exporting `s` and `v` directly, not the mnemonic. (Same trade-off as Monero-on-Trezor.)

---

## DIRECTIVE CLOSURE — the three verdicts

**#1 View key:** `v = hash_to_scalar(spend_secret)` (`dependent_key`). Hash of the spend key, not ECDH. The prototype's `ecdh` path is incompatible with standard wallets → split-brain. Fix on-device. **Resolved.**

**#2 Key image:** `I = s·Hp(P)`, the Monero form — but `Hp` is Zano's `ge_fromfe_frombytes_vartime`+`ge_mul8`, which the firmware must port exactly (not a generic hash-to-curve). **Resolved.**

**#3 SLIP-0010 path:** `m/44'/<Zano SLIP-44>'/account'`, all-hardened Ed25519; confirm the coin type (≠ 0/60/128); reduce leaf → `s`; `v = Hs(s)`. **Resolved** (pending the single registry lookup of Zano's coin-type integer, which is a lookup, not a design question).

---

## DIRECTIVES #2–#4 — carried forward from v1.2 (unchanged)

The kernel structs (`CanonicalEvent`, `ProofMethod`, `SettlementLink`), the `adapters/chain-zano` skeleton, and the substitution proof are **identical to v1.2** and remain valid. The crypto corrections above live entirely inside the `chain-zano` / firmware layer and touch **none** of the kernel semantics — which is itself the substitution proof in action: a real cryptographic correction changed adapter internals and left all seven primitives, the `DataReference`-only rule, and the Lazy-Linking / identity-less-settlement invariant untouched. Key points preserved:

- `payload_ref: DataReference` only; raw Zano bytes → Autonomi, never the event.
- Two proof types: `CryptographicSignature` (Layer 1/2 authorization, stays in vault) and `ChainInclusion` (Layer 4 settlement, bus-safe).
- **Identity-less settlement:** `chain-zano` sets `subject: None`; it cannot attribute a stealth-addressed ring tx.
- Authorization never touches the platform bus; the auth↔settlement link is a vault-only `SettlementLink`, matched via the view key.
- Kernel *survives* substitution but does **not** audit adapter internals — a separate verification concern.

*(For the full Rust of these sections, see v1.2; reproduced there verbatim.)*

---

## Invariants checklist (v1.3)
1. On-device CLSAG is the only path to spend-key isolation; host-side signing is prototype-only.
2. **View key `v = keccak256(s) mod ℓ` on-device** — never ECDH.
3. **Key image `I = s·Hp(P)`** with Zano's `ge_fromfe_frombytes_vartime`+`ge_mul8`.
4. SLIP-0010 path `m/44'/<Zano SLIP-44>'/account'`; document Trezor-specific recovery.
5. `DataReference`-only payloads; raw chain bytes in Autonomi/Arweave.
6. Lazy Linking + identity-less settlement (`subject: None`).
7. Authorization proofs never on the bus; link only in the vault via view key.
8. `forbid(unsafe_code)`; binary (bincode) only; Planner emits capabilities, never chain names.
9. Kernel survives substitution but does not police adapter internals.

---
*The only remaining open value in the entire crypto path is a registry lookup — Zano's SLIP-44 coin-type integer — not a design decision. Everything else is source-confirmed.*
