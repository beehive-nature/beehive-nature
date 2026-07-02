# Zano-on-Trezor — Cryptographic Delta Spec & Test-Vector Harness (DRAFT v0.1)

Step 1 of the integration plan. This maps every cryptographic primitive to one of four tiers — **reuse as-is**, **reuse with adaptation**, **new port**, or **out-of-v1-scope** — using the real file and function names from `trezor/trezor-firmware` (`crypto/`) and `hyle-team/zano` (`src/crypto/`). It then specifies a bidirectional differential test harness.

**v1 scope reminder:** sign transfers of native ZANO only. Even "native only" post-Zarcanum still exercises the asset dimension (see §3), so the core signing primitive is `CLSAG_GGX`, not the simpler `CLSAG_GG`.

---

## 1. The one-paragraph delta

Zano and Trezor's Monero code share the same Ed25519 group and CryptoNote high-level operations (key derivation, key images, stealth addresses, Pedersen commitments). Trezor's `crypto/monero/xmr.c` already provides most of tier-1/2. The genuinely new work is: (a) **three extra generators** (X, U, H2) beyond Monero's single H; (b) **dv-CLSAG** ring signatures (`CLSAG_GGX`), which have no Monero analogue; (c) Zano's **Bulletproofs+ "extended"** variant (`bppe`) with two-mask commitments; and (d) the **balance proof**, which is a set of Schnorr / double-Schnorr signatures over G and X. Everything else is reuse or explicitly deferred (staking, asset emission).

---

## 2. Generators — the foundational port

Trezor's Monero code defines only **H** (`ge25519_set_xmr_h` / `xmr_h` in `crypto/monero/xmr.h`). Zano (`crypto/crypto-sugar.h`) uses a larger fixed generator set:

| Generator | Zano symbol | Role | On Trezor today |
|---|---|---|---|
| G | `c_point_G` | base point | present (ed25519 basepoint) |
| H | `c_point_H` | amount commitments | present as `xmr_h` |
| H2 | `c_point_H2` | secondary blinding | **new** |
| U | `c_point_U` | key-image / linkability generator | **new** |
| X | `c_point_X` | **asset-id generator** (the "v" dimension) | **new** |
| H±G | `c_point_H_plus_G`, `c_point_H_minus_G` | precomputed helpers | **new** |
| 1/8 scalar | `c_scalar_1div8` | torsion-clearing / point compression | equivalent to Monero's mul8 |

**Action:** add a `crypto/zano/generators.c` with these constants (lifted verbatim, then vector-checked — do not recompute by hand) and their precomp tables. This is a prerequisite for CLSAG_GGX, bppe, and the balance proof.

---

## 3. dv-CLSAG — the core new primitive (`crypto/monero/clsag.cpp` → new)

Zano's `clsag.h` defines a family; only two matter for v1/v2:

| Variant | Function | Ring member fields | Secrets | Use |
|---|---|---|---|---|
| 2-CLSAG (G,G) | `generate_CLSAG_GG` / `verify_CLSAG_GG` | `{stealth_address, amount_commitment}` | x, f | pre-CA building block |
| **3/2-CLSAG (G,G,X)** | **`generate_CLSAG_GGX` / `verify_CLSAG_GGX`** | `{stealth_address, amount_commitment, blinded_asset_id}` | `secret_0_xp`, `secret_1_f`, `secret_2_t` | **every confidential transfer, incl. native ZANO — the v1 target** |
| 4/2 (G,G,X,G) | `generate_CLSAG_GGXG` | + `concealing_point` | +q | header notes "not used in Zano" — skip |
| 5/2 (…XXG) | via `zarcanum_generate_proof` (`CLSAG_GGXXG`) | staking | — | v2+ (staking) |

`generate_CLSAG_GGX` signature (from the header):
```cpp
bool generate_CLSAG_GGX(const hash& m,
                        const std::vector<CLSAG_GGX_input_ref_t>& ring,
                        const point_t& pseudo_out_amount_commitment,
                        const point_t& pseudo_out_asset_id,
                        const key_image& ki,
                        const scalar_t& secret_0_xp,   // spend secret component
                        const scalar_t& secret_1_f,    // amount-commitment blinding delta
                        const scalar_t& secret_2_t,    // asset-tag blinding delta
                        uint64_t secret_index,
                        CLSAG_GGX_signature& sig);
```
Note `blinded_asset_id` is **T, premultiplied by 1/8**, and `pseudo_out_asset_id` is *not* premultiplied on the generate side but *is* on verify — a classic off-by-one-eighth footgun; encode this in tests.

**Spec sources (authoritative — implement from these, not blogs):**
- d-CLSAG base: eprint 2019/654 (Goodell et al).
- dv-CLSAG extension whitepaper (sowle): `hyle-team.github.io/docs/zano/dv-CLSAG-extension/dv-CLSAG-extension.pdf`.
- Cypher Stack review: `github.com/cypherstack/zano-clsag-review`.
- Reference impl: `hyle-team/zano` `src/crypto/clsag.cpp`.

**Device concern:** the Fiat–Shamir transcript (`hash m`, challenge ladder over the ring) and domain-separation tags must be byte-identical to the reference, or signatures verify locally but are rejected by the daemon. This is the single highest-risk port.

---

## 4. Range proofs — Bulletproofs+ extended (`crypto/range_proof_bppe.h` → new)

Zano has both `bpp` (standard BP+, `range_proof_bpp.h`) and **`bppe`** (extended, `range_proof_bppe.h`). Confidential/Zarcanum outputs use `bppe` with **two-mask** commitments:

```cpp
// commitments are pre-multiplied by 1/8
CT::calc_pedersen_commitment_2(value*1/8, mask*1/8, mask2*1/8, commitment);
bool bppe_gen(values, masks, masks2, commitments_1div8, bppe_signature& sig, ...);
bool bppe_verify(std::vector<bppe_sig_commit_ref_t>& sigs, ...);
```
- Generators bound via `bpp_crypto_trait_zano` (`bpp_ct_generators_HGX`, `bpp_ct_generators_UGX`).
- `calc_pedersen_commitment` (1-mask) and `calc_pedersen_commitment_2` (2-mask) are small and reusable everywhere.

**Device strategy (mirrors Monero):** for ≤2 outputs the device runs `bppe_gen` in full; for >2 outputs the host computes it and the device runs `bppe_verify` on the offloaded proof, keeping device memory constant. This reuses the Monero MPC-offload pattern; only the inner math (two masks, `bppe` transcript, X/U generators) is new.

---

## 5. Balance proof — Schnorr, not a monolith (`crypto/zarcanum.h` → new, small)

There is no single "balance proof" function. Zano proves value/asset conservation with Schnorr signatures over specific generators, checked in `check_tx_balance()`:
```cpp
enum generator_tag { gt_void, gt_G, gt_H, gt_H2, gt_X, gt_U };
generic_schnorr_sig;         generate_schnorr_sig<gt_G|gt_X>(...);        verify_schnorr_sig<...>(...)
generic_double_schnorr_sig;  generate_double_schnorr_sig<gt_G,gt_G|gt_X,gt_G>(...)
linear_composition_proof;    generate_linear_composition_proof(...)   // asset ops — v2+
```
**Device port (v1):** `generate_double_schnorr_sig<gt_G, gt_X>`-class signatures binding the summed input/output commitments and asset tags. Small relative to CLSAG/bppe, but it must agree with the daemon's `check_tx_balance` relation exactly. `linear_composition_proof` is only needed for asset emission/update → defer.

---

## 6. High-level CryptoNote ops — reuse with adaptation (`crypto/crypto.h`)

These Zano `crypto_ops` map onto existing Trezor `xmr_*` primitives; port = confirm identical domain-separation and wire them to Zano serialization:

| Zano (`crypto.h`) | Trezor analogue (`monero/xmr.h`) | Notes |
|---|---|---|
| `generate_key_derivation` | `xmr_generate_key_derivation` | ECDH; same shape |
| `derivation_to_scalar` | `xmr_derivation_to_scalar` | check hash tag |
| `derive_public_key` / `derive_secret_key` | `xmr_derive_public_key` / `xmr_derive_private_key` | subaddr index handling differs |
| `generate_key_image` | (Monero KI in app layer) | uses U generator — verify |
| commitment `C = yG + aH` | `xmr_gen_c` | 1-mask only; 2-mask needs `calc_pedersen_commitment_2` |
| `generate_signature` / `generate_ring_signature` | `xmr_*` helpers | legacy paths |
| hash-to-point / hash-to-scalar | `xmr_hash_to_ec` / `xmr_hash_to_scalar` | Keccak; confirm tags |

**Scalar/point representation decision:** Zano's `scalar_t` (4×u64) and `point_t` (`crypto-ops.c`, ref10-style) are its own algebra. **Do not vendor a second Ed25519 implementation into firmware.** Re-express Zano's ops on Trezor's existing `ed25519-donna` (`bignum256modm` scalars, `ge25519` points) and prove equivalence with vectors. This is more work up front but avoids shipping two field arithmetics.

---

## 7. Reuse as-is — shared low-level (`crypto/`)

No port needed; already in `trezor-firmware/crypto/`:
- `ed25519-donna/` — field/group arithmetic (the substrate for §6).
- `sha3.c`, Keccak (Zano `keccak.c`/`hash.c` are the same primitive).
- `memzero.c`, `hmac.c`, `rand.c`, `rfc6979.c`, `consteq.c` — hygiene/determinism.
- `base58.c` (`crypto/monero/base58.c`) — CryptoNote base58; confirm Zano alphabet/checksum, likely identical.

---

## 8. Out of v1 scope — reserve, don't port

- `zarcanum.cpp` (`zarcanum_generate_proof`, `CLSAG_GGXXG`, `zarcanum_check_main_pos_inequality`) — **staking**.
- `linear_composition_proof`, `eth_signature.cpp` (secp256k1 ECDSA for asset emission/update).
- `one_out_of_many_proofs.cpp` — membership proofs (FCMP-adjacent research).
- `msm.cpp` (multi-scalar mul) — a host/perf optimization; the device uses constant-memory ladders, not batched MSM.

---

## 9. File-by-file target layout (`core/` + `crypto/`)

```
crypto/zano/                    # NEW C primitives (host-buildable, like crypto/monero/)
  generators.c/.h               # G,H,H2,U,X,H±G,1/8  (§2)
  clsag_ggx.c/.h                # generate/verify_CLSAG_GGX (+GG helper)  (§3)
  bppe.c/.h                     # bppe_gen/bppe_verify, calc_pedersen_commitment_2  (§4)
  balance.c/.h                  # double-Schnorr over gt_G/gt_X  (§5)
  zano.c/.h                     # KI, derivations glue onto ed25519-donna  (§6)
  serialize.c/.h                # Zano tx prefix serialization (byte-exact)
core/src/apps/zano/             # NEW app layer (Rust-forward or MicroPython+C — open Q)
  __init__.py / lib.rs
  signing/                      # staged protocol state machine (see proposal)
  misc.py                       # address encode, alias display
core/tests/test_apps.zano.crypto.py   # emulator crypto tests (mirror test_apps.monero.crypto.py)
common/protob/messages-zano.proto     # (already drafted)
```

---

## 10. Test-vector harness

Goal: prove the device port is **bit-identical** to Zano's reference, at every intermediate value — not just final signatures. Two independent oracles, cross-checked.

### 10.1 Vector generator (links Zano's real crypto)
A small C++ tool compiled against `hyle-team/zano` `src/crypto` that emits JSON vectors:
```cpp
// zano_vectors.cpp — links libzano crypto
// For each case: fixed seed -> derive keys; fixed ring, amounts, masks, asset ids.
// Emit BOTH inputs and every intermediate + final:
//   - key_derivation, derived stealth pubkey, key_image
//   - amount commitment (1-mask and 2-mask), blinded_asset_id (T, *1/8)
//   - CLSAG_GGX_signature fields (c0, responses, key image)
//   - bppe_signature (A, B, r, s, taus…) with commitments_1div8
//   - balance double-Schnorr sig
// Also emit the reference verify() result = true, for round-trip anchoring.
```
Determinism: seed all randomness (`generate_CLSAG_GGX` etc. use deterministic nonces derived from the transcript, so vectors are reproducible). Dump a few hundred cases spanning ring sizes {2,16}, output counts {1,2,3,8}, and edge amounts.

### 10.2 Device-code oracle (host build + Python binding)
Compile `crypto/zano/*` for the host (as `crypto/tests` already do for Monero) and expose a `py-zano-crypto` binding modeled on `py-trezor-crypto`. Then a differential runner:
```python
# diff_test.py
import json, zano_ref_vectors as V
from pyzano import (derive_key_image, commit2, blinded_asset_id,
                    clsag_ggx_sign, bppe_gen, balance_sign,
                    clsag_ggx_verify, bppe_verify)

def assert_eq(name, a, b):
    assert a == b, f"MISMATCH {name}\n dev={a.hex()}\n ref={b.hex()}"

for v in V.load("vectors.json"):
    assert_eq("key_image",  derive_key_image(v.spend, v.out_pub), v.key_image)
    assert_eq("commit2",    commit2(v.amount, v.mask, v.mask2),   v.commitment)
    assert_eq("blinded_T",  blinded_asset_id(v.asset, v.t_mask),  v.blinded_asset_id)

    sig = clsag_ggx_sign(v.m, v.ring, v.pseudo_c, v.pseudo_a,
                         v.key_image, v.xp, v.f, v.t, v.real_idx)
    assert_eq("clsag_ggx", sig.serialize(), v.clsag_ggx)          # byte-exact

    # bidirectional: our sig must satisfy Zano's verifier, and vice-versa
    assert clsag_ggx_verify(v.m, v.ring, v.pseudo_c, v.pseudo_a, v.key_image, v.clsag_ggx)

    bp = bppe_gen(v.values, v.masks, v.masks2)
    assert_eq("bppe", bp.serialize(), v.bppe)
    assert bppe_verify([(v.bppe, v.commitments)])                 # ref proof passes our verifier

    assert_eq("balance", balance_sign(v.in_sum, v.out_sum, v.asset_ctx), v.balance_sig)
print("ALL VECTORS MATCH")
```

### 10.3 Emulator + on-device
- `core/tests/test_apps.zano.crypto.py` runs the same vectors through the MicroPython/Rust app layer on the Trezor **emulator**.
- A hardware smoke test signs a 1-in/2-out native testnet tx end-to-end; broadcast and confirm daemon acceptance (the ultimate serialization/transcript check).

### 10.4 Adversarial + fuzz
- Extend `crypto/fuzzer/` with `clsag_ggx` and `bppe` targets (malformed rings, wrong `real_output`, tampered `1/8` premultiplication, non-canonical scalars).
- Protocol-level: mutate HMAC-sealed offload blobs and assert device rejection (validates the proposal's tamper model, not just the crypto).

### 10.5 Pass bar
1. Every intermediate in §10.2 byte-matches for 100% of vectors.
2. Bidirectional verify: device-produced sigs pass Zano's verifiers; Zano-produced sigs pass device verifiers.
3. Emulator + one real-hardware testnet tx accepted by the daemon.
4. Fuzz targets clean; tamper tests all rejected.
5. Constant-time review of scalar ops on secret data (CLSAG responses, masks, spend key).

---

## 11. Порядок работ (recommended order)

1. Generators (§2) + `ed25519-donna` re-expression (§6) → vector-checked.
2. Commitments (`commit`, `commit2`) + `key_image` + derivations → vectors.
3. `CLSAG_GGX` sign/verify → the hard one; get §10.2 green here before anything else.
4. `bppe` gen/verify + ≤2-output path.
5. Balance double-Schnorr + full-tx assembly → first emulator testnet tx.
6. Offload/verify path for >2 outputs; key-image sync.

*Deferred to v2+: Zarcanum staking (`zarcanum_generate_proof`/`CLSAG_GGXXG`), asset emission (`linear_composition_proof`, `eth_signature`), Gateway Addresses.*
