# saorsa-seal: source-pinned BNR review and red-first cases

Review date: 2026-10-15
Upstream: https://github.com/saorsa-labs/saorsa-seal
Inspected main commit: `764d7529f691768bb3a44007bb471eed5b60fb73`
Commit date: 2026-02-04; Cargo package version: 0.1.3.

## Status

SOURCE REVIEW COMPLETE for the five top-level Rust source files, Cargo.toml,
and repository tree. This is not a transitive-dependency audit.

TEST PACK STAGED / NOT RUN. There is no local Cargo/Rust compiler in this
review environment. These files have not been compiled. No benchmark,
full bTunGsTeN qualification, network deployment, or live-use census was run.
No upstream or BNR repository was modified and no issue or outreach was sent.

Disposition: concept relevant; inspected implementation blocked from production
security, recovery, and authority paths. Treat it as a specimen, not as a
functioning threshold-recovery implementation.

## Direct source findings

1. src/api.rs::seal_bytes creates ASCII placeholder share records rather than
   shares of the content-encryption key. It never invokes the ML-KEM envelope,
   a secret-sharing routine, or an FEC encoder. Envelope policy, FEC parameters,
   and AAD are copied into metadata without enforcing the advertised behavior.
2. src/api.rs::open_bytes decodes metadata, checks only shares.len() >= 3, and
   returns a fixed greeting. It neither reconstructs/decrypts the object nor
   validates share material, distinct identities, policy threshold, commitments,
   handle object identity, or metadata version. This demonstrates false success,
   not successful unauthorized decryption of genuine sealed content.
3. src/types.rs::ThresholdVerifier::verify returns Ok(true) without checking
   inputs. PublicKeyShare::verify similarly returns true. These are explicitly
   commented placeholders; they must never be treated as verification.
4. SealedMetaV1 omits n/t and encrypted-chunk references. The content key is not
   recoverably shared by the high-level function; a key commitment cannot replace
   recoverable key material.
5. src/aead.rs::ContentEncryptor::new ignores its object_id parameter. There is
   no policy AAD supplied by the public API to the content encryption wrapper.
6. object_id = BLAKE3(plaintext), metadata address = BLAKE3(object_id). This exposes
   equality/guessability when handles are observable and reuses one metadata key
   for equal plaintext under different policies. The example map replaces values
   at that key; the abstract Dht trait does not specify a universal conflict rule.
7. src/types.rs derives Debug for the secret CEK, so formatting it would expose
   its bytes. This is an exposure path, not evidence that production logs leaked.
   RecipientId::from_bytes truncates/pads rather than rejecting non-32-byte input.
8. seal_file reads the whole file; seal_bytes encrypts/stores a whole buffer;
   Dht uses synchronous get/put. This pin does not implement the README's
   streaming/parallel-FEC path. Its tree contains no benchmark harness or CI
   workflow. This is not proof about external/private CI.
9. The separate src/envelope.rs wrapper calls ML-KEM and a symmetric cipher,
   but it is not used by seal_bytes. decap_from ignores the sender parameter;
   encryption must not be confused with sender authentication. Its framing,
   key lifecycle, dependency implementation, and browser compatibility require
   independent qualification.

## Source references

- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/src/api.rs
- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/src/types.rs
- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/src/aead.rs
- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/src/envelope.rs
- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/src/lib.rs
- https://github.com/saorsa-labs/saorsa-seal/blob/764d7529f691768bb3a44007bb471eed5b60fb73/Cargo.toml

## Running the staged cases

Use a disposable checkout. Preserve the upstream source unchanged for the
first run. The 10 cases express rejection/round-trip requirements and are
expected to expose the observed placeholders; no result count is claimed.

```sh
git clone https://github.com/saorsa-labs/saorsa-seal.git
cd saorsa-seal
git checkout --detach 764d7529f691768bb3a44007bb471eed5b60fb73
mkdir -p tests
# Copy bnr_seal_rejection.rs from this pack into tests/ here.
cargo generate-lockfile
cargo test --locked --test bnr_seal_rejection
```

The upstream tree has no committed Cargo.lock. Retain the generated lockfile,
its digest, toolchain/target details, and full build output with any result.
Dependency resolution/build failure is BUILD-BLOCKED, not a runtime test
failure or a passing security test. Do not silently update dependency APIs or
patch source just to obtain a green initial specimen run. Keep a repaired fork
separate and rerun identical tests there.

The tests intentionally use plaintext envelope mode only for synthetic in-memory
fixtures; do not publish genuine recovery shares unencrypted. The sole PQ-policy
fixture verifies that absent recipient keys are rejected before storage.

## BNR integration boundary

Preserve bSigner signing/verification interfaces, existing bpq1 sealed objects,
and bnr-seal's confidentiality-after-signing contract. Any future group-recovery
module should protect a narrowly scoped object key/recovery capability, not
reconstruct the sovereign root by default. Key-recovery authority and spending
or VM-transition authority remain distinct.

Bind object version, policy epoch, allowed recipients, threshold, ciphertext
manifest, algorithm suite, and opaque authorization scope. Require exact-length
identities and bounded authenticated parsing. Keep data-redundancy thresholds
separate from key-access thresholds.

b-domain: authenticated object/policy succession, not public recipient lists.
b-meter: capped storage/repair/recovery budgets and independently checkable receipts.
b-index: reconstructible manifests, checkpoints, and proof status, not plaintext shares.
VM: enforce authorized policy/state transitions and public proof results; no secret
reconstruction in publicly replicated on-chain execution.
ZK: optionally prove a scoped policy statement; a valid encryption envelope or
threshold-share check is not a proof of arbitrary execution or real-world work.
Browser: bounded Rust/WASM cryptographic core and explicit I/O adapters; no mandatory
central gateway or server database. Neither wasm compatibility nor equivalence was
established by this source review.

## Promotion gates after the red-first specimen

- Actual threshold sharing/reconstruction, real FEC, no positive placeholder verdicts.
- Missing keys/unknown suites/invalid policies rejected before any storage effects.
- t-1 cannot recover; valid t recovers arbitrary bytes; duplicate/foreign/malformed
  shares never increase authority. Separate FEC-loss and guardian-loss experiments.
- Authenticated metadata, ciphertext and policy binding; cross-object/epoch replay refused.
- Native/browser vectors and negative cases agree; browser memory and input limits measured.
- PQ threat model covers commitments and verifiable sharing, not just ML-KEM envelopes.
- Guardian loss, rotation, authorized succession, repair, and sponsor exhaustion exercised.
- Benchmarks include encryption, share protection, real FEC, publication and recovery;
  report availability and security thresholds separately. No millennium or scale extrapolation.
