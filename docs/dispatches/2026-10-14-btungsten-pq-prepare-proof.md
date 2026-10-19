# Prepared FIPS public-key wrapper proof — 2026-10-14

Started from PR #430 at `a4296c847`, after reading the speed dispatch,
x0x PQ battery dispatch, and `crates/btungsten-x0x-pq/PERFORMANCE.md`.
The new Rust proof lane checks the actual prepared-key candidate and both
actual Saorsa wrappers against the same explicitly assumed FIPS operations.
The candidate source and original dependency lock remain byte-identical.

**Executed result:** 36 conditional compiled-wrapper obligations passed;
all seven deliberate false obligations produced the required return-value
counterexample. The separate native lane passed **4245/4245** checks in all
**21** exact-count rows, and all native controls were convicted.

This is **universal over byte contents at the enumerated slice lengths**,
including arbitrary correctly sized malformed signatures. It is **not** an
unbounded compiled theorem for every possible slice length. The general
conditional source argument and reuse induction are recorded separately in
[the proof boundary](../../crates/btungsten-x0x-pq/proof/README.md).
ML-DSA arithmetic and full-system security remain **UNESTABLISHED**.

## What was proved, and what was assumed

Acceptance means successful imports followed by `Ok(true)` for a stock call.
Errors and `Ok(false)` both reject. Error-value equality is not a claim:
Saorsa's overlong context is an error, whereas the candidate returns `false`.
The modern comparison fixes ML-DSA-65; the legacy API has empty context only.

Source/function binding:

- Candidate: `crates/btungsten-x0x-pq/src/lib.rs`,
  `PreparedMlDsa65PublicKey::{from_bytes,verify}`, included directly by Rust.
- saorsa-pqc 0.5.1: `src/api/sig.rs`,
  `MlDsaPublicKey::from_bytes`, `MlDsaSignature::from_bytes`,
  `MlDsa::verify_with_context`; and `src/pqc/ml_dsa.rs::MlDsa65::verify`
  with the real legacy constructors in `src/pqc/types.rs`.
- fips204 0.4.6: `src/lib.rs` generated
  `ml_dsa_65::PublicKey::try_from_bytes` and `Verifier::verify` execute as MIR.
  `src/ml_dsa.rs::{expand_public,verify_internal}` are the assumed leaves.
- `src/types.rs::PublicKey` owns its three array fields. Verification borrows
  it immutably; retaining the key preserves the expanded value under the
  stated deterministic, pure leaf contracts.

The symbolic decision depends on **all** expanded-key fields and **all**
message, signature and context bytes, with the actual ML-DSA-65 scalar
parameters, empty OID/prehash, and `nist=false`. Expansion is assumed
successful in the compiled contracts. The verification Boolean is arbitrary;
signature parsing and arithmetic inside the leaf are not proved. Source-level
expansion failure rejects through each raw-byte adapter.

The 36 obligations cover the prepared and modern paths, 255/256 and 257
context boundaries, short/oversized signatures and keys, the legacy path, and
two independent calls using one preparation. Every input byte is symbolic.
The README gives every length and the closed count inventory.

SAW cannot translate two relevant destruction details. The pinned zeroize
1.9.0 x86_64 comment-only assembly barriers have explicit no-op contracts;
the other FIPS destructor operations still execute. The modern test adapter
observes the decision before destroying imported public objects and forgets
those objects because their `Vec` erasure uses an unsupported MIR intrinsic.
This affects the test adapter only. No erasure, allocation-failure,
termination, constant-time, entropy, revocation, identity-binding, production
cache, transport, or full-system claim follows.

## Rust implementation and controls

`crates/btungsten-x0x-pq/proof/src/` contains the Rust controller, source/lock
gates, linked-MIR symbol discovery, native cases, exact coverage gates, and
deliberately defective wrappers. `common.saw` and `Boundary.cry` contain the
symbolic contracts and solver interface. No new Python controller was added.

The seven false compiled claims are accept-all, reject-all, ignored message
suffix, discarded context, ignored signature suffix, replaced key, and cached
verification result. Each exits 2 with a counterexample to the **literal
equality postcondition**. Missing overrides, translation failures, missing
markers, unexpected success, or an unrelated error cannot count as conviction.
These countermodels concern the opaque contracts; the native lane supplies
concrete witnesses against the real verifier.

| Native run | Executed | Failures | Missing rows | Exit |
|---|---:|---:|---:|---:|
| Honest | 4245 | 0 | 0 | 0 |
| Accept everything | 4245 | 3936 | 0 | 1 |
| Reject everything | 4245 | 304 | 0 | 1 |
| Ignore message suffix | 4245 | 265 | 0 | 1 |
| Discard context | 4245 | 316 | 0 | 1 |
| Ignore signature suffix | 4245 | 49 | 0 | 1 |
| Empty coverage | 0 | 0 | 21 | 1 |

Native coverage includes every short signature length, every legal context
length, noncanonical hints and response bounds, wrong keys, message/context
changes, and ownership after the caller changes its encoded-key buffer.
These are DIFFERENTIAL/TEETH results, not official KAT or universal results.

The two Rust gate tests passed. Additional operational controls seeded stale
success artifacts, then invoked a missing SAW executable: the process exited
1, retained a new FAIL receipt, and removed the old native/MIR/proof artifacts.
Changing the actual candidate source by one comment made `bind` exit 2 with
`SOURCE MISMATCH`; its exact original bytes were restored and checked.

## Reproduction and receipts

```sh
cargo fetch --locked --manifest-path crates/btungsten-x0x-pq/proof/Cargo.toml
cargo run --locked --release --manifest-path crates/btungsten-x0x-pq/proof/Cargo.toml -- run target/pq-prepare saw
```

Toolchain: SAW 1.6 (`68eed5f`), mir-json `8cbf9af1` with
nightly-2026-03-21 and translated standard libraries, Z3 4.8.14; native Rust
1.98.1. The controller performs offline checks and requires the pre-fetched
lock. `.github/workflows/btungsten-pq-saw.yml` runs the lane and retains
evidence even on failure. This dispatch records the local run; hosted CI is
not represented as having passed.

The final fresh run passed in approximately 246 seconds. Formatting,
all-target Clippy with warnings denied, installed-hook checks, and whitespace
checks also passed. Source pins were checked before and after proof execution;
the fresh linked MIR and every retained artifact were hash-verified.

Receipts: [`docs/receipts/pq-prepare-2026-10-14`](../receipts/pq-prepare-2026-10-14).
`run.json` records the starting commit, exact source/tool/binary/MIR hashes,
exits, obligations and scope. Large raw logs and the linked MIR are compressed
losslessly; `manifest.json` records both compressed and original hashes.
No native executable or translated standard-library tree is banked.

Current dirvine discussion on x0x #622, #505 and #504 was checked before the
lane. The #504 delivered/published measurement requirement and #505 field
acceptance remain separate. No upstream message was sent and no live-mesh or
delivery result is claimed. The existing performance and audit receipts are
prior evidence, not fresh results of this proof run.
