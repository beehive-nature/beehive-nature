# Repository storage and checkpoint ordering — 2026-10-19

GitHub remains stage-one source/PR/merge authority. This lane implements a
peer-local shadow replica with encrypted ANT/AR storage contracts, atomic
checkpoint transactions, x0x discovery notices and ordered Hive replay. It
adds no central server, estate endpoint, production identity, founder-funded
writer, per-user Vaulta account or global user census.

Founder steering is binding: sovereignty, self-funding, PQ/privacy and the
ten-billion-user target. `tools/repository-contract/STORAGE.md` records the
implemented boundaries and the unqualified scale/privacy work. Existing
bzDiD free identities, BEELOG batching, rustEOS bounded execution/recovery,
Vaulta/EVM wallet and bPay/AntPay settlement retain their own contracts.

## Implementation

- SQLite WAL/FULL transaction with predecessor compare-and-swap; verified
  objects, decision and checkpoint commit together. Two independent processes
  race different eligible proposals; only one can win. Local apply is refused
  in Hive ordering mode. Every database pins its externally supplied bootstrap.
- Private root and individual payloads use existing BPQ `seal/open`, hybrid
  X-Wing recipient wrapping and AES-256-GCM segments. Power-of-two padding,
  randomized encryption and persistent audience-bound ciphertext reuse.
  No plaintext publication fallback. Local working state still needs the
  user's encrypted device storage; SQLite is not disk encryption.
- ANT/AR byte readers reuse atmirror's real `Rail` implementations through a
  read-only native binary, explicit endpoint/client and bounded read buffers.
  The user supplies a separately authorized wallet writer for publication.
  Upload reservations precede puts; UNKNOWN requires exact readback recovery.
- Native `repository-owner` calls existing `bzdid::resolve_did`, including
  signed rotation. Exact pinned head/sequence, expiry and policy-key matching
  refuse stale/substituted identity proofs. No implicit policy/key migration.
- Hive consumes complete, agreeing finalized blocks in transaction/operation
  order. Unavailable earlier bytes stop the whole block. All configured RPC
  operators must agree; gaps, finalized forks and irreversible-height
  regressions refuse. RPC agreement is not a light-client consensus proof.
- x0x carries digest-bound encrypted-root notices. Sender/logical-payload
  deduplication persists across restart. Transport IDs and acknowledgement
  cannot advance authority. Public notices omit repo/ref/key/plaintext digests.

Crypto scope: `privacy.mjs` consumes `surfaces/bpq.js::seal/open`; the native
interoperability test opens its X-Wing ciphertext through
`crates/bsigner/src/bpq.rs::open`. Repository authorization is still
`contract.mjs::acceptUpdate` plus `signature.mjs::verifyEnvelope` (ML-DSA-65).
Wording remains sound by construction / isolated by design. Hive's classical
posting signature is not promoted to PQ authorization.

The existing `contracts/zkreceipts/count.circom` proves cohort counts, not
repository validity. A `zk_verified` flag cannot substitute for evidence.
No new ZK circuit or PQ ZK verifier is claimed here. Public account/timing,
bucket sizes and access patterns remain observable. Full privacy and measured
ten-billion-user capacity are not established by this lane. The Hive scanner
is a correctness replica, not a plan for every wallet to scan every block.

## Local verification and failure record

The combined repository run passed **86 tests, zero skipped**: prior manifest,
acceptance and bSigner tests plus storage, independent process races,
before/after-COMMIT process crashes, cold Git restoration, Hive ordering and
availability refusals, x0x replay, CLI persistence, encrypted byte/metadata
checks, hybrid recipient isolation, actual Rust atmirror reads, native bzDiD
rotation and Rust bSigner opening of repository ciphertext.

`cargo test --locked -p atmirror -p bzdid --lib`: **67 + 26 passed**, zero
ignored. Locked builds of `repository-rail`, `repository-owner` and `bsigner`
succeeded. `cargo fmt --all --check` and whitespace checks passed. CI shape
remains **143/143** guarded suite steps. The new batteries extend the existing
two repository steps: no new workflow, install or duplicate Rust build.
The retained CI-throughput/receipt battery passed **30/30**. Hook installation,
known-bad/known-good staged commits and generated stack inventory checks passed.

Failures discovered and repaired: an initial privacy-test cleanup called
nonexistent `destroy` instead of existing `wipe`; corrected, all four privacy
tests pass. The native reader test caught a real redirect/empty-body ambiguity;
AR retrieval now requires HTTP 200, enforces its streaming ceiling and returns
empty bytes only for a successful read (empty Git blobs are valid). One local
Cargo invocation repeated `--lib` and exited before tests; corrected command
above passed. Earlier exploratory PowerShell glob patterns given directly to
rg were rejected by Windows; explicit directories/files were used instead.

Tests use local storage, loopback RPC/storage fixtures and published disposable
test keys. No live x0x delivery, mainnet storage upload/payment, Hive posting,
Vaulta contract deployment, cross-failure-domain durability or retention
acceptance is claimed. Candidate and actual-main CI receipts are attached to
the PR after their exact checkout/tree/log bindings are measured.

## Upstream priority checked before implementation

David Irvine's current direction is #504, with per-kind counters #1170 and
same-workload delivered/published evidence first; ObserveOnly remains default.
#622 was folded into #504 on September 30. #505 is field-accepted for the
fragmentation half (September 15); gossip efficiency remains separate. This
lane changes no x0x transport defaults and supplies no synthetic-as-live
measurement claim. Read-only checks; no upstream replies were posted.

- [Current #504 direction](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
- [#622 handoff](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
- [#505 field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210)
