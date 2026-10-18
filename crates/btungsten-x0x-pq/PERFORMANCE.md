# Prepared ML-DSA-65 public-key comparator

```sh
python3 scripts/btungsten/pq-speed-check.py
```

The command verifies x0x source and package pins, builds with `--locked --release`,
runs two fresh assurance/measurement trials, convicts accept-all and truncated-
message verifiers, and refuses empty coverage. Receipts go to `target/pq-speed`;
`--out DIR` and `--cache DIR` override. Native exits, exact source/lock/binary
hashes, CPU, Rust version, all samples and named failures are retained. A stale
receipt is removed before every execution. Failed assurance produces no timings.

The optimization in `src/lib.rs`,
`PreparedMlDsa65PublicKey::{from_bytes,verify}`, retains the expanded **public**
key from pinned fips204 0.4.6 instead of expanding it per signature. It borrows
the signature as a fixed-size array. FIPS parameters, message processing,
context separation and signature checking stay with that pinned implementation.
This isolated workspace adds no dependency to BNR's shipping workspace.

## Baselines and actual implementations

At x0x v0.48.0 / `32bf552808`, `src/identity.rs` imports ant-quic's legacy
ML-DSA types. ant-quic 0.27.60's `src/crypto/raw_public_keys.rs`,
`verify_tls13_signature` methods, use Saorsa's `MlDsa65` verifier. Other x0x
paths use its modern API. The relevant **saorsa-pqc 0.5.1** sources are:

- `src/api/sig.rs::MlDsa::verify_with_context`: expands the public key per
  verification. `MlDsaPublicKey::from_bytes` also expands it to validate,
  then retains serialized bytes.
- `src/pqc/ml_dsa.rs::MlDsa65::verify`: expands the public key per verification,
  then calls the same fips204 verifier with an empty context.
- **fips204 0.4.6** `src/lib.rs`, generated
  `ml_dsa_65::PublicKey::try_from_bytes` and `Verifier::verify`: expand the key
  and verify the complete message/context. These are the candidate's actual
  implementation; the RustCrypto verifier is an independent test comparator.

The benchmark calls both **actual Saorsa APIs**, with imported keys/signatures
for warm profiles. The cold API profile imports both per verification; the cold
candidate prepares and verifies once. This remains an experimental BNR comparator.
It does not measure ant-quic TLS, the x0x daemon, Autonomi storage, delivery or
wire bytes. ANT here names the ant-quic wrapper baseline, not ANT-wide assurance.

## Measurement and assurance

Each trial covers messages of 0, 256, 4096 and 65536 bytes, using empty contexts
for legacy API compatibility. Each of five profiles gets one warmup batch and
17 measured batches of 64 successful verifications. Profile order rotates
between samples. Inputs/results pass through `black_box`; every timed result
must succeed. Signing, fixture generation, fetching and writing are outside
timers. These are warm CPU-cache measurements over a repeated message/signature
per row, on a shared host with no affinity or frequency controls. All samples
and min/max remain visible. Speedup is a ratio of batch medians, not a population
percentile, network throughput figure or required CI performance threshold.

Each honest run must execute **414/414 checks across 14 coverage rows**:
15 official pure/external ML-DSA-65 sigVer cases (3 valid, 12 invalid),
108 differential checks and 291 negative controls. Boundary messages have
lengths 0, 1, 63, 64, 65, 135, 136, 137, 255, 256, 257 and 4096; contexts have
lengths 0, 1 and 255. RustCrypto and libcrux independently verify all 36 generated
signatures. Negative checks alter the last message/signature/context bytes,
replace the public key, and use empty, truncated or oversized signatures,
oversized contexts and wrong public-key lengths. All 14 rows require their
exact pinned counts. Official vectors retain the ACVP manifest's size/hash
verification; randomized signatures are DIFFERENTIAL.

The accept-all control must fail empty-signature teeth. The truncation control
deliberately signs a prefix, then uses a verifier that ignores bytes after
position 256. It must fail last-message-byte teeth on changed suffixes. Both
fail before timing. Zero-vector coverage must name every missing row, execute
no cases and produce no timings.

## Memory and integration boundary

On this x86_64 build the prepared object occupies **6240 inline bytes**, versus
a **1952-byte encoded public key** plus its wrapper. Preparation trades memory
for less repeated work. There is no global cache, secret-key retention, RNG
change, verification-result cache or additional worker thread.

A future integration must attach one object to an authenticated identity/key
epoch, enforce a finite peer budget, and release it when that binding changes.
At 1000 retained keys the objects alone occupy 6.24 MB, excluding peer metadata.
Authorization, revocation and identity binding still run for every operation.
Reusing a prepared key cannot make a revoked identity authorized. Do not put an
unbounded map of remotely supplied keys on ingress.

The separate [Rust wrapper-equivalence lane](proof/README.md) checks the actual
candidate and Saorsa wrappers with SAW over their compiled Rust, under explicit
shared-FIPS contracts. Its compiled claims quantify over all bytes at enumerated
slice lengths; its source-level general argument and native regressions remain
separate. It covers acceptance decisions, not equality of API error values.

Unbounded compiled FIPS/Saorsa equivalence, ML-DSA arithmetic qualification,
entropy quality, constant-time behavior, production integration and full-system
qualification remain UNESTABLISHED. BNR's RustCrypto proofs do not transfer.
Dependency audit findings and recorded mesh failures remain separate.

Fresh measurements:
[`2026-10-14-btungsten-pq-speed.md`](../../docs/dispatches/2026-10-14-btungsten-pq-speed.md).
