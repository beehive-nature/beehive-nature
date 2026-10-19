# Private repository acceptance and batched ordering — 2026-10-19

GitHub remains stage-one source/PR/merge authority. This increment adds a
private sovereign-user verifier, a repository-specific hiding receipt-chain
STARK and compact BEELOG batch ordering. There is no new central server,
estate prover, default wallet/payer, compulsory native account or global
user census. Production uploads, signatures, payments and chain broadcasts
are not performed by this lane.

## Contract and proof boundary

`private-batch.mjs::verifyPrivateBatch` decrypts existing private packages,
runs `contract.mjs::acceptUpdate` for every update and reconstructs the exact
receipt transcript. `signature.mjs::verifyEnvelope` still checks the pinned
ML-DSA owner and executor thresholds. The root/policy cannot authorize itself.

`RepositoryAir::eval` in
`crates/btungsten-p3count/src/repository/air.rs` proves the private transition
chain over range-constrained digest limbs, u64 carry arithmetic, fixed policy/
scope and neutral suffix padding. It binds proposal, manifest and signed
qualification digests. It reuses upstream Poseidon2 constraints and the
existing hiding PCS/MMCS composition at the existing Plonky3 pin. Private
main-trace randomness uses OS entropy; only public schedule preprocessing is
reproducible so another process derives the same verifier key.

This is a receipt-chain relation, not a zkVM proof executing Git/SHA-256/
ML-DSA in AIR. Private full acceptance is mandatory. The opaque verifier
returns `valid_relation`, never `accepted`, and cannot mint the capability
required by batch-mode checkpoints. Existing cohort proofs are unchanged.
There is no fake ZK flag, classical pairing wrapper or supplied verifier key.
Crypto wording caps at sound by construction / isolated by design.

`bzdid::beelog::Frontier::append` retains 64 peak slots and produces existing
inclusion/consistency proofs without loading leaf history. Tests compare it
against the independent full-history implementation. The ten-billion-position
test uses synthetic prior subtree commitments to test arithmetic and bounded
proofs; it is not ten billion users or measured distributed capacity.

`CheckpointStore::applyPrivateBatch` commits all accepted objects/decisions,
the repository checkpoint, private proof document and batch pin/frontier in
one WAL/FULL transaction. Hive batch mode also commits its finalized cursor
in the same outer transaction, retaining complete operation order. Missing
early or late bytes halt the whole block; definite invalid proofs refuse;
stale competitors cannot overtake earlier accepted batches.

The durable plan journal precedes wallet puts. Reopen/retry retains the same
salts/proof/header/ciphertext; ambiguous root upload requires exact readback
reconciliation. The existing paid-writer contract retains invoice, bounded
authorization and settlement. x0x carries only opaque encrypted-root notices;
discovery never advances authority.

## Local receipts

The local batches exercise real native hiding proofs and BEELOG arithmetic,
real existing ML-DSA signatures and existing BPQ `seal/open`. Coverage includes
private transcript/context/proof/frontier substitution, opaque-vs-authority
separation, replay, multi-epoch append, Hive availability/order, CLI use,
independent-process races and abrupt before/after-COMMIT exits. Proof and byte
budgets are bounded. Final counts and measurements are recorded with the PR's
exact candidate/main checkout, tree and job-log receipts after execution.

The combined local repository battery passed **100/100, zero skipped**.
bzDiD library, independent BEELOG and frontier batteries passed **34/34**;
the complete isolated Plonky3 model/AIR/integration battery passed **8/8**.
The retained CI-throughput/receipt battery passed **30/30**. Locked builds,
both workspace formatting checks, inventory and whitespace checks passed;
CI shape retains **145/145** guarded suite steps from the current base.
The original PQ10 FORGERY runner also passed its honest control and refused
all mutations, including 256 distributed bit flips and vacuous-opening shapes.

Observed local proof measurements (concurrent tests, not a controlled speedup
benchmark or a network/user-capacity result):

| Capacity | Proof bytes | Prove ms | Verify us | Calculator proven bits |
| --- | ---: | ---: | ---: | ---: |
| 8 | 490719 | 306 | 11974 | 110 |
| 16 | 495215 | 304 | 17787 | 110 |
| 32 | 537136 | 816 | 17288 | 109 |
| 64 | 597224 | 1142 | 12870 | 108 |

The calculator's conjectured figures match those rows but remain conjectures.
Sizes/times are one observed proof per capacity, not universal guarantees.

Existing CI jobs are reused. The isolated Plonky3 job consumes the existing
bzDiD library and runs the native batch battery after its existing release
build/tests. There is no additional workflow/job or duplicate root-workspace
build. Shared identity/crypto dependency versions match the root workspace.
CI timing distinguishes job execution from dispatch/dependency/runner waiting.

Failures and repairs recorded during implementation:

- The initial generic security helper omitted the challenge-field parameter
  in its AIR bound (`E0277`); the explicit bound compiled and tested.
- A first full-history comparison rehashed every prefix and was quadratic.
  That superseded owned test process was stopped; the final test retains all
  small shapes and large carry boundaries, finishing in about 1.5–2 seconds.
- The first Node native battery passed 9/10 and failed only at Windows
  cleanup (`EPERM`): its additional Hive database was still open. It now
  participates in the common handle cleanup; the full battery passes.
- The new isolated lock initially selected newer compatible transitive
  identity packages. spki/der/ctutils/zeroize were aligned to the root's
  existing locked versions; ML-DSA/Ed25519/SHA-256 already matched.
- Inspection found that an exactly exhausted local byte budget could become
  a generic shape refusal on the next private batch. It now stops the whole
  block as `RESOURCE_LIMIT`, preserving order and every checkpoint. The
  multi-epoch regression covers exact exhaustion and the operation ceiling.

## Scope and remaining measurements

`tools/repository-contract/PRIVATE-BATCH.md` defines the schemas, CLI,
mandatory authority checks, proof relation and metadata/resource limits.
Logs are per selected repository/stream, not a global account database.
One ordering leaf can carry up to 64 updates. Proof verification does not
require GitHub or a central prover. Identity, rustEOS/Vaulta/EVM execution,
RAM/CPU/NET and user-wallet settlement retain existing boundaries.

The opaque proof exposes capacity/context/root and append linkage; encrypted
objects still expose bucket sizes, repeated locators, reader tags, timing and
access patterns. Local plaintext needs encrypted device storage. Traffic
anonymity, secure erasure, a full-program repository ZK proof, global capacity,
on-chain STARK verification, live fees/latency and storage retention remain
unqualified. The ten-billion-user target is not promoted from a logical-size
test. No live Hive/x0x delivery or paid ANT/AR publication is claimed.

## Upstream priority

Read-only current checks before the feature lane confirmed #504 remains the
Leaf-egress tracker. David Irvine's latest direction prioritizes per-kind
counters #1170 and same-workload delivered/published evidence. ObserveOnly
remains default; changes require the recorded ADRs. #622 folded into #504;
#505's fragmentation half is field-accepted, separate from gossip efficiency.
This lane changes no transport defaults and sends no upstream comments.

- [Current #504 direction](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
- [#622 handoff](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
- [#505 field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210)
