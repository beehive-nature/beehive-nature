# Z2.B recon round 4 — secp-vs-k256 by evidence, Blindbit semantics, wasm smoke PASSED, minimal BTC rail interface

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Resolve the
secp256k1-vs-k256 WASM choice by evidence, inspect Blindbit
endpoint/privacy semantics, and run the throwaway WASM-target smoke for
the reusable BIP-352 arithmetic only. Preserve our hardware-signing
boundary: compose → validate → external sign. Do not inherit spdk's
hot-key signing architecture. No production integration and no full
wallet port. If the WASM smoke succeeds, immediately roll forward into
defining the smallest bPay BTC rail interface that can share the same
Rust BIP-352 core across native and web."

Everything ran in a THROWAWAY workspace
(`%TEMP%/z2b-wasm-smoke/` — members `sp-smoke`, `k256-probe`, `runner`);
nothing in-tree, nothing integrated, no production change.

## The smoke — three legs, all receipts

**Leg 1 — native reference truth.** The real `silentpayments` crate
(cygnet3/spdk tag v0.7.0, features sending/receiving/encode) runs the
FULL sender path of published vector 0 of
bip-0352/`send_and_receive_test_vectors.json` ("Simple send: two
inputs"): `calculate_partial_secret(&[(sk,is_taproot);2], &[OutPoint;2])`
→ `calculate_ecdh_shared_secret` → `generate_recipient_pubkeys` →
**derived output x-only key = `3e9fce73d4e77a4809908e3c3a2e54ee147b93
12dc5044a193d1fc85de46e3c1` = the published expected value. VERIFIED.**
(Incidental receipt: the crate's arithmetic is vector-true at v0.7.0 on
this seat.) Honest note: my first wiring used a WRONG second input key
(from memory, not the JSON) — the mismatch surfaced immediately against
the published value and was fixed from the vector file; the anchor did
its job.

**Leg 2 — secp256k1 → wasm32: BLOCKED on this seat.**
`cargo build --release --target wasm32-unknown-unknown` fails in
secp256k1's C build: `error occurred in cc-rs: failed to find tool
"clang": program not found`. No C toolchain on this seat; building
secp-based BIP-352 for wasm would add a clang/LLVM dependency to every
build machine — against the estate's wasm law (bnr-keys chose pure-Rust
k256 precisely to keep the browser build C-free).

**Leg 3 — k256 → wasm32: COMPILES AND EXECUTES.** A pure-Rust probe
(k256 0.13, default-features=false + ecdsa/arithmetic/alloc, subtle,
sha2; BIP-352's needed ops: scalar-multiply ECDH, point arithmetic,
x-only serialization — **schnorr is NOT part of BIP-352**, it belongs
to the signing organ) builds to a **75,255-byte** wasm module. A host
`wasmi` interpreter leg calls the exported `k256_smoke`, reads linear
memory, and the wasm-computed 7·G x-only =
`5cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc` is <!-- PUBLIC-CONSTANT: published BIP-352 test-vector / pubkey data -->
**byte-identical to the native computation**, itself anchored by the
known generator prefix (79BE667E…) and the classic 2G/3G constants
(c6047f…/f9308a…). A second honest note: my first probe used
`[7u8; 32]` (thirty-two bytes of seven — a huge scalar) instead of
scalar 7; wasm and native agreed on the WRONG input, and only the
2G/3G-anchored native test exposed it. Lesson banked: wasm==native
equality is meaningless without an external ground-truth anchor — which
is exactly why vector-pinning is a law below.

## Decision — k256-based single core (evidence-closed)

| | secp256k1 path | k256 path |
|---|---|---|
| native | vector-true TODAY (leg 1) | supported (RustCrypto, bnr-keys precedent) |
| wasm32 build | **fails on this seat** (cc-rs/no clang) | **builds, 75KB** (leg 3) |
| wasm32 execution | unproven | **proven under wasmi vs anchored native** (leg 3) |
| portability cost | C toolchain on every build machine | none |
| BIP-352 coverage | full (silentpayments) | arithmetic-complete (no schnorr needed) |

**Ruling proposed (for review): one k256-based pure-Rust BIP-352
arithmetic core for BOTH native and web** (no_std+alloc shape, bnr-keys
wasm law: extern-C exports, no wasm-bindgen, opt-level z), with the
secp256k1 `silentpayments` crate retained as a NATIVE TEST-TIME
cross-check (differential testing: our core vs the vector-verified
reference on the full published vector set). Port nothing; own the thin
core; sign at the organ.

## Blindbit — endpoints + privacy semantics (spec-pinned)

Endpoints (backend-blindbit-v1/src/client.rs, no auth, plain reqwest):
`GET /block-height` (5s timeout), `GET /tweaks/{h}?dustLimit=`,
`GET /tweak-index/{h}?dustLimit=`, `GET /utxos/{h}`,
`GET /spent-index/{h}`, `GET /filter/new-utxos/{h}`,
`GET /filter/spent/{h}`, `POST /forward-tx` (tx hex → txid),
`GET /info`.

Privacy model (setavenger/BIP0352-light-client-specification, own
words): the client shows "only an interest in a block" — never an
interest in a UTXO or transaction; spending-state checks use salted
hash filters (`sha256(outpoint||block_hash)[:8]`); **but the always-on
scanner holds the scan key material, and the spec itself says the scan
program "should be run on ones own server/node-in-a-box"** — verbatim
our nodes-on-the-box law. So: the ORACLE (index server) is the
replaceable third party carrying only block-level metadata; the SCANNER
is box-side. Stated limitations to carry into any adapter design:
cut-through pruning breaks old rescans; no multi-instance scanning; a
dust limit (suggested 1,000–5,000 sats) hides sub-dust UTXOs; wallets
must track matched scriptPubKeys (senders may pay the derived bc1p
address directly); out-of-band notifications unsolved.

## The smallest bPay BTC rail interface (definition only — nothing built)

```
bpay-sp-core (ours, k256, no_std+alloc, zero I/O, zero signing):
  // types
  SpCode   { version, B_scan: Pub33, B_spend: Pub33, network }   // bech32m in/out
  Outpoint { txid: [u8;32], vout: u32 }
  // arithmetic (vector-pinned to bip-0352 vectors; cross-checked vs silentpayments in tests)
  derive_sp_code(scan_pub, spend_pub, net, ver) -> SpCode
  sender_outputs(recipients: &[SpCode], partial_secret: Scalar32)
      -> Result<map<SpCode, Vec<XOnly32>>>                       // NO keys inside
  // custody boundary — runs at the organ, NOT in the web core:
  partial_secret(inputs: &[(SecKey32, is_taproot)], outpoints: &[Outpoint])
      -> Result<Scalar32>
  // wasm facade (bnr-keys law): extern-C exports for SpCode
  // encode/decode + sender_outputs given an externally supplied
  // partial secret. No private keys cross the wasm boundary for
  // compose; the browser never scans (box-side only).

bpay-btc-rail (native, at the box/organ):
  compose_payment(recipients, owned_utxos, fee_policy, change_policy)
      -> UnsignedSpTx        // PSBT envelope (fixes spdk's missing
                             // compose/sign boundary)
  validate_unsigned(&UnsignedSpTx, ceilings) -> Result<()>   // watchpay law:
                             // named refusals, fee/amount bounds
  // external sign (organ: Trezor/bsigner) then validate_signed
  scan: ChainBackend-shaped optional adapter (Blindbit oracle
                             // replaceable; scanner box-side per spec)
```

Interface laws carried from the whole recon: compose→validate→external
sign (never spdk's in-process hot-key signing); PSBT as the unsigned
envelope; scanning native/box-only; hosted scanning only ever an
optional adapter (founder ruling); every derived figure re-derived and
refused on mismatch (watchpay); PendingTransaction carries explicit
abort/discard; units explicit (sats, canonical decimal).

## Queued next (not started)

Differential-test harness design (our k256 core vs silentpayments over
the FULL vector set) — the natural first build slice if the ruling is
accepted; Trezor SP-send custody question (does the organ compute the
partial secret, or expose an ECDH oracle? — hardware-signing lane's
question to carry); Blindbit oracle self-host shape on the box.

## Sources

- Throwaway workspace %TEMP%/z2b-wasm-smoke (sp-smoke, k256-probe,
  runner) — full reproduction: the three Cargo.tomls + lib.rs sources
  recorded verbatim in the commit message of this dispatch's companion
  scratch (nothing in-tree; workspace deleted after receipts captured
  below). Receipts: vector-0 output match; cc-rs clang failure verbatim;
  wasm size 75,255 bytes; wasm==native x-only equality vs 2G/3G anchors.
- https://raw.githubusercontent.com/bitcoin/bips/master/bip-0352/send_and_receive_test_vectors.json
- cygnet3/spdk @ v0.7.0 (silentpayments src; backend-blindbit-v1
  client.rs) and @ master (silentpayments/Cargo.toml)
- https://github.com/setavenger/BIP0352-light-client-specification
- Rounds 1–3: 954708ed, a5c454fa, 334376bd.

## Appendix — throwaway workspace sources (verbatim, for reproduction)

`Cargo.toml` (root): workspace members smoke-lib/runner/k256-probe.
`smoke-lib/Cargo.toml`:

```toml
[package]
name = "sp-smoke"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["lib", "cdylib"]

[dependencies]
silentpayments = { git = "https://github.com/cygnet3/spdk", tag = "v0.7.0", features = ["sending", "receiving", "encode"] }
hex = "0.4"
```

`smoke-lib/src/lib.rs` (vector-0 sender path; the `#[no_mangle]` wasm
facade mirrors it — full file in the temp workspace, key excerpt):

```rust
use silentpayments::utils::sending::{calculate_ecdh_shared_secret, calculate_partial_secret};
use silentpayments::sending::generate_recipient_pubkeys;
use silentpayments::utils::OutPoint;
use silentpayments::{SharedSecret, SilentPaymentKeyMaterial};
use silentpayments::secp256k1::{PublicKey, SecretKey};

pub fn run_vector0() -> Result<[u8; 32], String> {
    // vector 0 "given": two P2PK inputs, recipient B_scan/B_spend
    // ... SecretKey::from_slice x2, OutPoint::from_txid_and_vout x2
    let input_keys: Vec<(SecretKey, bool)> = vec![(sk0, false), (sk1, false)]; // bool = is_taproot
    let partial_secret = calculate_partial_secret(&input_keys, &outpoints).map_err(|e| e.to_string())?;
    let _shared: SharedSecret = calculate_ecdh_shared_secret(&scan, &partial_secret); // execution coverage
    let key = SilentPaymentKeyMaterial::new_v0(scan, spend);
    let derived = generate_recipient_pubkeys(vec![key], partial_secret)
        .map_err(|e| e.to_string())?.remove(&key).ok_or("no outputs")?;
    Ok(derived[0].serialize()) // == 3e9fce73...e3c1 (published)
}
```

`k256-probe/Cargo.toml` + wasm export (compiles+executes on
wasm32-unknown-unknown):

```toml
[dependencies]
k256 = { version = "0.13", default-features = false, features = ["ecdsa", "arithmetic", "alloc"] }
sha2 = { version = "0.10", default-features = false }
subtle = "2"
```

```rust
#[no_mangle]
#[allow(static_mut_refs)]
pub extern "C" fn k256_smoke() -> i32 {
    let mut repr = [0u8; 32];
    repr[31] = 7; // scalar 7 (NOT [7u8; 32] — the bug the anchors caught)
    let ct: subtle::CtOption<Scalar> = Scalar::from_repr(k256::FieldBytes::clone_from_slice(&repr)).into();
    let s = match ct.into_option() { Some(s) => s, None => return 0 };
    let a = AffinePoint::from(ProjectivePoint::GENERATOR * s);
    let enc = k256::elliptic_curve::sec1::ToEncodedPoint::to_encoded_point(&a, false);
    unsafe { OUT.copy_from_slice(&enc.as_bytes()[1..33]); }
    1
}
```

`runner/src/main.rs`: wasmi 0.31 — `Module::new` → `Linker` →
`get_typed_func::<(), i32>` for `k256_buf`/`k256_smoke` → read
`data[buf_ptr..buf_ptr+32]` from the exported memory.

Exact commands: `cargo test -p sp-smoke` (vector 0 native ✓);
`cargo build --release --target wasm32-unknown-unknown -p sp-smoke`
(cc-rs clang failure — the secp evidence);
`cargo build --release --target wasm32-unknown-unknown -p k256-probe`
(75,255 bytes ✓); `cargo run -p runner --release` +
`cargo test -p k256-probe -- --nocapture` (wasm==native vs 2G/3G
anchors ✓).
