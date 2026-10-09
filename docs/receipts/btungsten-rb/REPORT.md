# bTunGsTeN RB — compatibility and PQ-scope report

Order: workerB bench expansion, 2026-10-08 (measured Rust execution and
assurance with selected Galois tools). Provenance: the review that issued the
order read BNR at `a3419732c0c06d1d24c8bca2d4cb70e5022971cf`; this work
started at `2e8d20970fa52109054c829fe9542abbf5fbe876` (one commit later,
`btungsten PQ01`, which touches no file these lanes read). Code:
`crates/btungsten-bench` (the `rbench` orchestrator) and
`scripts/btungsten/rb0{1,2,3}-*`. Receipts: this directory. Every claim below
points at a receipt row; where a row and this page disagree, the row wins.

## How to reproduce

```
cargo build --locked --release -p btungsten-bench --bins
target/release/rbench rb01 --work W --out O/rb01
target/release/rbench rb02 --tools T --work W --out O/rb02
target/release/rbench rb03 --tools T/crux --work W --out O/rb03
```

`--quick` runs the same rows with fewer samples (the CI plan). `T` holds the
verifier bundles in the layout `scripts/btungsten/README.md` §RB names; the
`rb02-aes` and `rb03-budget` jobs of `.github/workflows/btungsten-rb.yml`
build exactly that layout from pinned, digest-checked assets.

## Where these receipts ran, and what went wrong on the way

The committed receipts, under `ci-37923430005/`, are one full-plan run of
`.github/workflows/btungsten-rb.yml` (run 37923430005, `workflow_dispatch`,
`plan=full`) at BNR `073697abb`, on GitHub-hosted `ubuntu-24.04` runners, one
runner per lane, so no two lanes shared a host. Each receipt's `host` section
names the CPU, ISA flags, kernel and memory it measured on, and its `bnr`
section the exact BNR commit. The branch's later commits add these documents and
none touches a lane file
(`git diff 073697abb HEAD -- crates/btungsten-bench scripts/btungsten/rb01-psi
scripts/btungsten/rb02-aes scripts/btungsten/rb03-budget
.github/workflows/btungsten-rb.yml ops/ant-extsig` is empty). Logs and
input files are committed beside each receipt, except 24 RB01 fixture
files (up to 512 KiB each): the receipt records each one's SHA-256, and
`rbench` regenerates them byte for byte. The development host (Windows, WSL2 x86_64) ran
every lane during development but did not produce the committed receipts,
for the reason in the first item below.

- **RB02, out of memory (2026-10-08/09).** TEETH 3 (the bitsliced
  `sub_bytes` claimed to be `shift_rows_2`) first ran inside
  `rb02-aes256.saw` on SAW's `rme` solver. rme normalizes a goal to
  algebraic normal form, which is small for a true goal and unbounded for a
  false one. On the development host the kernel's OOM killer took the `saw`
  process at 28.8 GB resident and the shared WSL VM went down with it,
  interrupting everything else running in that VM; two GitHub runners were
  shut down at the same step (runs 37887662009 and 37889906328). Repair:
  TEETH 3 runs alone on z3 (`rb02-teeth-sbox.saw`), and `rbench` now runs
  every verifier under a process-group memory budget (12 GiB for SAW and
  Crux-MIR), recording a breach as `Exit::Memory` and the row as
  INCONCLUSIVE, never as a pass or a refutation.
- **RB02, a tool error that looked like a refutation (CI run 37893420462).**
  Through SAW's SBV backend (`unint_z3`), z3 answered `sat` on TEETH 1 and 2
  but returned the uninterpreted `cipher` as a lambda, which SBV could not
  read back. `fails` caught that error, so the SAW script printed its
  "REFUTED" line, and the harness refused both rows because no
  counterexample appeared: they read FAIL in that run's receipt. Repair:
  every obligation in `rb02-aes256.saw`, honest and TEETH, goes through the
  What4 backend (`w4_unint_z3`), which prints first-order counterexamples.
  The receipt's `trial_history` section carries both incidents.
- **RB03, solver crash.** Crux-MIR's online goal timeout crashed it
  (`user error ... (pop)`); RB03 runs with `--force-offline-goal-solving`.
- **All lanes, a peak-memory figure that was the harness's own (CI run
  37896147894).** In the first full-plan run, every RB01 TCP session on a
  256-element fixture reported exactly 5,824 KiB peak resident memory for
  both roles. Linux carries the spawning process's high-water mark into each
  child at exec, so `wait4`'s `ru_maxrss` is at least the spawner's own
  peak. A control on the development host: a 300 MB parent's `/bin/true`
  reported 316,040 KiB through fork+exec and 319,176 KiB through
  `posix_spawn`. Those 5,824 KiB were `rbench`'s peak, not the roles'.
  Repair (`f43ffdcd3`): `rbench` reads its own high-water mark right after
  each spawn and reports a child's peak only above it. Below it, the run
  record says "unresolved: at most N KiB" and keeps both numbers. The RB01
  provider also prints its own `VmHWM`, which starts afresh at exec, in every
  result line, so each role's peak is exact. The verdicts of that run (all
  three PASS) did not depend on memory figures; its receipts were not
  committed, and the lanes ran again as run 37906620036; they ran once more
  as run 37923430005, the receipts here, after RB01 gained its operator
  notice (`073697abb`).

## Pins and departures

| what | pinned | departure, and why |
|---|---|---|
| Swanky | `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`, its `Cargo.lock`, its `rust-toolchain` (Rust 1.99.0) and `.cargo/config.toml` (`-C target-cpu=native --cfg vectoreyes_target_cpu_native -C link-args=-flto`) | none. The provider is one added example file (`edge/popsicle/examples/rb01_psi.rs`); no upstream file changes |
| rustcrypto-verification | `52d36ff4562c9b574f49c8b3133ea63f2a9574d5`, cryptol-specs submodule `8638495a3ba8c1c0bd031f0c5d7f243b5e8617ff` | upstream CI ran `ghcr.io/galoisinc/saw-suite:nightly` (SAW 1.6.0.99, master `345296457`); RB02 runs the SAW 1.6 release bundle WB001/WB002 already run (mir-json `8cbf9af1`, schema 13, nightly-2026-03-21). Docker is unusable on this host, and BNR keeps one coordinated SAW bundle rather than mixing a nightly SAW with its own mir-json. The image digest upstream pulled is recorded in the receipt. `.gitmodules` names an SSH URL; the same commit is fetched over HTTPS |
| Crux-MIR | crucible `25d0f3698a96cb8f014911146c02fabdb26f66ff`: upstream's own CI build of that commit (run 37835376050, artifact 11575803445, GHC 9.10.3, ubuntu-24.04), mir-json `ece1622caf39c9530873f376caa84a5fa6a3ded3` (crucible's submodule pin), nightly-2026-03-21, what4-solvers `snapshot-20260622` | none in versions: these are exactly the versions `crux-mir-build.yml` pins at that commit. The binary is upstream's CI artifact, digest-checked, not a local rebuild; it expires 2027-01-06, after which the CI job fails at its download step and the bundle must be rebuilt from `25d0f369` |
| Daedalus | `a4ad7592ef2449fa1da07d2827fc6684293d21ca` (cloned) | not used here: the subsequent-candidate lane continues as RB04 in a separate session (below) |

## RB01 — Swanky circuit PSI

**RB01 is an experimental benchmark adapter. Its functional and performance results do not establish suitability for sensitive data or production use.**

Receipt `ci-37923430005/rb01/receipt-rb01.json`: **PASS** (8 CHARACTERIZATION PASS, 1 MEASUREMENT NOT-RUN, 3 MEASUREMENT PASS, 14 SAMPLED-ADVERSARIAL PASS, 14 VECTOR PASS). BNR `073697abb`; runner AMD EPYC 9V45 96-Core Processor, 4 logical CPUs, Ubuntu 24.04.5 LTS, kernel 6.17.0-1022-azure. A CHARACTERIZATION PASS means the behaviour was recorded, not that upstream or the provider behaved correctly.

Every session's evaluator output equals the plaintext cardinality and the
garbler outputs nothing: in the upstream composition (`upstream-example`,
`provider-local-threads`) and with one role per OS process (`tcp-*`, nine
fixtures from 256 to 65,536 elements a side). The provider's byte counts
equal the relay's independent counts (`bytes-independent-count`); two
sessions on identical inputs produce different transcripts
(`fresh-session-randomness`); every session ran under its own session id
(`session-ids-fresh`). All fourteen SAMPLED-ADVERSARIAL rows hold, each
outcome classified as a refusal before any protocol byte (bad input, wrong
magic, role conflict, session or parameter mismatch), an abort (truncated
frame or stream, terminated peer, garbage after the handshake) or a timeout
inside the I/O deadline (stalled peer). They are operational tests of this
provider, not evidence of security against an active adversary.

| phase | n | wall, min / median / max | peak RSS |
|---|---|---|---|
| prepare: clone at the pin | 1 | 4.8 s | 124.5 MiB |
| prepare: `cargo fetch`, fresh CARGO_HOME | 1 | 2.5 s | 221.5 MiB |
| prepare: `cargo fetch`, warm | 1 | 0.1 s | 113.5 MiB |
| compile: cold, release | 2 | 35.7 / 36.9 / 38.2 s | 706.4 MiB |
| compile: warm, no change | 3 | 79.5 / 79.8 / 99.1 ms | 58.3 MiB |
| compile: warm, provider touched | 3 | 7.0 / 7.0 / 7.2 s | 608.7 MiB |
| process startup | 30 | 0.6 / 0.6 / 0.9 ms | unresolved (30 runs) |
| upstream example, one process | 10 | 21.7 / 22.2 / 22.6 ms | 7.1 MiB |
| provider, local threads | 10 | 21.5 / 22.0 / 23.6 ms | 7.4 MiB |

Two processes over loopback TCP (the evaluator's own phase timers; bytes counted by the provider and, independently, by the relay):

| fixture | n | total ms, min / median / max | setup ms | intersect ms | cardinality ms | reveal ms | evaluator received, median bytes | peak RSS garbler / evaluator, median MiB | evaluator output (plaintext) |
|---|---|---|---|---|---|---|---|---|---|
| upstream-256 | 10 | 24.1 / 24.7 / 26.9 | 6.1 | 16.6 | 1.9 | 0.0 | 4,598,722 | 5.4 / 4.8 | 255 (255) |
| disjoint-256 | 3 | 24.3 / 24.5 / 24.6 | 6.1 | 16.4 | 1.9 | 0.0 | 4,597,698 | 5.3 / 4.8 | 0 (0) |
| identical-256 | 3 | 24.8 / 24.9 / 25.0 | 6.1 | 16.8 | 1.9 | 0.0 | 4,597,698 | 5.4 / 4.7 | 256 (256) |
| partial-256x256-overlap-128 | 3 | 24.2 / 24.3 / 27.6 | 6.1 | 16.2 | 1.9 | 0.0 | 4,597,698 | 5.4 / 4.7 | 128 (128) |
| partial-256x1024-overlap-200 | 3 | 51.7 / 51.9 / 61.7 | 6.1 | 38.9 | 7.5 | 0.0 | 18,297,026 | 11.5 / 8.5 | 200 (200) |
| partial-1024x1024-overlap-512 | 10 | 58.5 / 59.9 / 61.7 | 6.1 | 46.1 | 7.6 | 0.0 | 18,313,410 | 12.7 / 8.5 | 512 (512) |
| partial-4096x4096-overlap-2048 | 10 | 182.1 / 184.6 / 206.0 | 6.1 | 150.1 | 28.9 | 0.0 | 73,722,714 | 41.9 / 24.0 | 2048 (2048) |
| partial-16384x16384-overlap-8192 | 5 | 695.8 / 698.7 / 722.7 | 6.0 | 580.6 | 117.7 | 0.0 | 294,342,394 | 134.9 / 87.6 | 8192 (8192) |
| partial-65536x65536-overlap-32768 | 3 | 2664.2 / 2744.4 / 2792.6 | 6.0 | 2300.8 | 437.8 | 1.1 | 1,189,033,226 | 531.0 / 334.0 | 32768 (32768) |

Receipt serialization, measured on a first pass of the receipt: 368,354 bytes, rendered in 1.9 ms, written and fsynced in 2.7 ms.

Phases are the provider's own timers: `setup` is party construction
(`OpprfPsiGarbler::new` / `OpprfPsiEvaluator::new`), which does not touch
the inputs, and it stays flat across set sizes; `intersect`
(cuckoo hashing, the OPPRF and the existence bits it feeds), `cardinality` (the garbled
cardinality circuit) and `reveal` (the output to the evaluator) are the
input-dependent online work. Peak memory in the first table is the process
tree `wait4` reports, shown as unresolved when it does not exceed `rbench`'s
own peak (see the incident above); in the TCP table it is each role's own
`VmHWM`. Network bytes: the evaluator's received count here; the garbler's
counts and the relay's per-direction counts and SHA-256 digests are in each
session record. The garbler-larger sweep, against an evaluator set of 256, runs one session
per size: a sample, not a threshold. In this run 256, 288, 320 and 384 garbler elements gave the right cardinality; 448 (ABORT garbler-thread), 512 (ABORT garbler-thread) and 1024 (ABORT garbler-thread) did not. The Swanky re-check lane ran 20 sessions per size
in each of three runs: 384 panicked in 5, 7 and 6 of 20, 352 in 1, 2 and 2,
and from 448 every session panicked; up to 320, none did (`docs/upstream/2026-10-09-swanky-popsicle-rb01/` (main `0d88ec248`)).

**Configuration.** `popsicle::circuit_psi` (PSTY19), `OpprfPsiGarbler` /
`OpprfPsiEvaluator`: KMPRT OPPRF, cuckoo hashing with three hash functions
on the evaluator side, semi-honest two-party garbling over `WireMod2`
(`swanky-twopac::semihonest`), ALSZ OT extension whose default base OT is
Chou-Orlandi over Ristretto (`curve25519-dalek` 5.0.0). Output: the
cardinality, to the evaluator only. Permitted leakage: the cardinality to
the evaluator; both set sizes through traffic volume and the evaluator's
cleartext cuckoo bin count.

**Upstream behaviour the bench's input policy now guards** (characterization
rows, recorded at the pin; none is a claim about our code). A
CHARACTERIZATION PASS means the behaviour was recorded, not that upstream or
the provider behaved correctly. A separate lane re-checked each item at the
pin, three runs on the development host, none an independent reproduction:
`docs/upstream/2026-10-09-swanky-popsicle-rb01/` (main `0d88ec248`), dispatch `docs/dispatches/2026-10-09-rb01-swanky-evidence.md`.

- A garbler set larger than the evaluator's set panics the garbler at
  `swanky-oprf-kmprt` `lib.rs:211` (`assert!(points.len() <= npoints)`); the
  evaluator then aborts with a network error. Neither side outputs. The
  sweep in `char-garbler-larger` samples it, one session per size; how
  often it fires near the boundary is in the re-check tallies above.
- A repeated element in the garbler's set: the session did not complete
  within the 20 s budget (budget kill); in the re-check, not within 60 s in
  a release build, and a debug build panics at `swanky-oprf-kmprt`
  `lib.rs:202`. Consistent with KMPRT's sample-until-distinct table loop
  never terminating on a repeated point (the uniqueness check there is a
  `debug_assert`, compiled out in release).
- A repeated element in the evaluator's set: the cardinality counts each
  copy (2 where the set answer is 1, in this row; 3 for three copies in the
  re-check). With four copies the re-check's session did not complete
  within 60 s, and every probe sample fell in the key-refresh loop at
  `popsicle` `receiver.rs:110`.
- An empty evaluator set panics both parties: the garbler at `popsicle`
  `cuckoo.rs:133` (remainder by zero) and, on x86_64, the evaluator at
  `bit-matrix-transpose` `lib.rs:83` (`nrows >= 16`), through the KKRT
  OPRF with zero inputs; two empty sets panic too (the evaluator at the
  same line). The re-check's committed logs of runs 2 and 3 show the same
  locations. This lane's row recorded only
  `ABORT garbler-thread`, because local mode reports the first thread it
  joins. An empty garbler set gives 0, the right answer.
- Elements of at most 16 bytes are zero-padded into one block, so `[0x01]`
  and `[0x01, 0x00]` intersect (1 where the byte-string answer is 0).
- The RNG finding:

  > RB01 is an experimental benchmark adapter. Its functional and performance results do not establish suitability for sensitive data or production use.
  >
  > The constructors initialize separate RNG consumers from the same seed. The reporting seat observed overlapping streams within each party and matches between some generated bytes and protocol traffic. The security consequences remain unverified.

  This lane read the constructors at the pin (`PsiGarbler::new` /
  `PsiEvaluator::new`); the stream observations are the re-check lane's,
  `docs/upstream/2026-10-09-swanky-popsicle-rb01/` (main `0d88ec248`).

The provider refuses empty inputs, repeated elements, and inputs that are
not a whole number of 8-byte elements, before any connection.

**Execution modes.** local-threads (one process, the upstream
composition); tcp-process (two OS processes, one host, loopback TCP, each
holding only its own input, after a session handshake binding magic,
version, role, a parameter digest and a 128-bit session id). Execution on
independently controlled hosts: NOT RUN. The refusal, abort and timeout rows
are sampled operational tests, not a proof of security against an active
adversary.

## RB02 — the RustCrypto AES-256 proof, and what it covers in BNR

Receipt `ci-37923430005/rb02/receipt-rb02.json`: **PASS** (8 EQUIVALENCE PASS, 3 TEETH PASS, 3 VECTOR PASS). BNR `073697abb`; runner AMD EPYC 9V45 96-Core Processor, 4 logical CPUs, Ubuntu 24.04.5 LTS, kernel 6.17.0-1022-azure.

The reproduction rows run upstream's `aes-run.saw` unchanged on the pristine
specimen: AES-128, AES-192 and AES-256, encrypt and decrypt, each proven
equal to the cryptol-specs AES for every key and block. `rb02-aes256.saw`
proves the AES-256 pair again through SAW's What4 z3 backend on the specimen
with the TEETH module, and all three false claims are refuted with solver
counterexamples: TEETH 1 at exactly the planted trigger (key byte 0 = 165 = 0xA5, block byte 15 = 90 = 0x5A, every other byte 0); TEETH 2 at the all-zero key and block; TEETH 3 with a concrete eight-word bitsliced state. `verified-source-equals-bnr-source`: the crates.io
`aes 0.8.4` archive, checked against the checksum in BNR's `Cargo.lock`,
and the verified fork's `src` tree are byte-identical (19 files identical, none differing, none on one side only).

| phase | n | wall | CPU (user) | peak RSS (process / sampled group) | exit |
|---|---|---|---|---|---|
| prepare: clone | 1 | 0.4 s | 0.0 s | 16.9 MiB | 0 |
| prepare: cryptol-specs submodule | 1 | 2.3 s | 1.3 s | 124.0 MiB | 0 |
| prepare: `cargo fetch`, fresh CARGO_HOME | 1 | 11.4 s | 0.3 s | 104.4 MiB | 0 |
| `saw --version` startup | 10 | 11.1 / 11.8 / 12.0 ms | | 24.8 MiB | |
| `cargo saw-build`, cold (pristine, then TEETH) | 2 | 1.6, 1.5 s | | 355.8 MiB | |
| `cargo saw-build`, warm no-op | 3 | 0.55 / 0.57 / 0.76 s | | 354.5 MiB | |
| upstream `aes-run.saw` (reproduction, all six) | 1 | 345.6 s | 321.3 s | 683.4 / 750.8 MiB | 0 |
| `rb02-aes256.saw` (AES-256 + TEETH 1, 2) | 1 | 144.5 s | 135.6 s | 594.2 / 661.3 MiB | 0 |
| `rb02-teeth-sbox.saw` (TEETH 3) | 1 | 1.7 s | 1.5 s | 329.8 / 401.2 MiB | 0 |

Receipt serialization, measured on a first pass of the receipt: 47,239 bytes, rendered in 0.4 ms, written and fsynced in 1.0 ms.

**What was verified.** The software (fixslice64) backend of `aes 0.8.4` as
it sits in the RyanGlScott/block-ciphers fork
(`backport-hybrid-arrays-to-aes-0.8.4`), built with `--cfg aes_force_soft`
against a generic-array fork that avoids operations crucible-mir cannot
simulate: the six top-level single-block functions (AES-128/192/256 encrypt
and decrypt) equal the cryptol-specs AES for every key and every block, with
the key schedule, encipher and decipher overrides proven in the same run.

**Relationship to BNR.** BNR resolves crates.io `aes 0.8.4` through
`aes-gcm 0.10.3` into `bsigner` (`crates/bsigner/src/bpq.rs`, AES-256-GCM in
`gcm_open`). RB02 fetches that exact crate (checksum from BNR's
`Cargo.lock`) and compares it file by file with the verified fork
(`verified-source-equals-bnr-source`). Backend selection in `aes 0.8.4`:
on x86/x86_64 without `aes_force_soft`, `autodetect` uses AES-NI when the
CPU has it, else the soft backend; on aarch64 the ARMv8 backend exists only
with `--cfg aes_armv8`, which BNR does not set, so BNR's aarch64 builds run
the soft backend, the verified code path. On x86_64 hosts with AES-NI, the
CI runners and the development host among them, BNR executes AES-NI: not
covered.

**Remaining obligations.** AES-NI and ARMv8 backends; the multi-block
(par-blocks) glue CTR uses inside AES-GCM; GHASH/POLYVAL (including their
CLMUL backends), CTR32, tag computation and constant-time tag comparison;
nonce management (`bpq.rs` `nonce(flag, index)`), HKDF key derivation, key
handling and zeroization, the sealed-object format (SPEC-BPQ-1) and caller
behaviour; side channels; the generic-array fork versus crates.io
generic-array 0.14.7. SHA-2: rustcrypto-verification's `sha2-verif` covers
SHA-384 and SHA-512 of a `sha2 0.10.9` fork; BNR's `sha2` use is mostly
SHA-256, and no SHA-2 claim is made here.

## RB03 — Crux-MIR on the gas budget

Receipt `ci-37923430005/rb03/receipt-rb03.json`: **PASS** (4 PROVE-UNIVERSAL INCONCLUSIVE, 16 PROVE-UNIVERSAL PASS, 6 TEETH PASS, 6 VECTOR PASS). BNR `073697abb`; runner AMD EPYC 9V74 80-Core Processor, 4 logical CPUs, Ubuntu 24.04.5 LTS, kernel 6.17.0-1022-azure.

All ten properties are proven over their full input domains under the
required strategy (cvc5 integer blasting through `rb-cvc5-intblast`), three
times each, and both faulty variants are convicted, on all three TEETH
properties, with concrete models. The correspondence rows hold: the harness compiles production's
`budget.rs` itself (`correspondence-source`), resolves the same versions of
every shared dependency (`correspondence-dependencies`), and
`correspondence-split` holds today's `plan_fee_cap` to the verbatim pre-split
function. The bitwuzla cross-check is optional: it independently proves
p1, p3 and p7 to p10 and convicts both faulty variants on all three TEETH properties; for p2, p4, p5 and p6 it leaves
exactly one goal Unknown at the 300 s goal timeout, so those rows are
INCONCLUSIVE and count for nothing.

| property | required: cvc5 int-blast, wall min / median / max (n) | goals proved | bitwuzla cross-check |
|---|---|---|---|
| p1_zero_gas_limit_refuses | PASS, 0.90 / 0.92 / 0.94 s (3) | none reached a solver | PASS, 0.9 s |
| p2_refuses_iff_network_fee_unaffordable | PASS, 1.44 / 1.46 / 1.48 s (3) | 10/10 | INCONCLUSIVE, 302.5 s (9/10 proved, 1 unknown) |
| p3_cap_at_least_network_fee | PASS, 1.40 / 1.44 / 1.46 s (3) | 9/9 | PASS, 2.8 s (9/9 proved, 0 unknown) |
| p4_cap_fits_remaining_budget | PASS, 1.43 / 1.47 / 1.50 s (3) | 11/11 | INCONCLUSIVE, 302.9 s (10/11 proved, 1 unknown) |
| p5_headroom_never_exceeded | PASS, 2.14 / 2.16 / 2.17 s (3) | 14/14 | INCONCLUSIVE, 303.0 s (13/14 proved, 1 unknown) |
| p6_headroom_granted_when_it_fits | PASS, 1.76 / 1.79 / 1.82 s (3) | 16/16 | INCONCLUSIVE, 303.9 s (15/16 proved, 1 unknown) |
| p7_zero_denominator_reads_as_one | PASS, 1.80 / 1.82 / 1.83 s (3) | 26/26 | PASS, 3.2 s (26/26 proved, 0 unknown) |
| p8_gas_buffer_is_floor_six_fifths | PASS, 1.09 / 1.12 / 1.16 s (3) | 11/11 | PASS, 12.4 s (11/11 proved, 0 unknown) |
| p9_payment_floor_is_half_product | PASS, 1.06 / 1.07 / 1.07 s (3) | 6/6 | PASS, 1.4 s (6/6 proved, 0 unknown) |
| p10_refusal_reports_the_need | PASS, 1.44 / 1.47 / 1.48 s (3) | 14/14 | PASS, 2.5 s (14/14 proved, 0 unknown) |

| TEETH (must be convicted) | cvc5 int-blast | bitwuzla |
|---|---|---|
| t1_wrapping_affordability_cap_fits | PASS, 1.4 s | PASS, 3.7 s |
| t2_ceiling_budget_cap_fits | PASS, 1.4 s | PASS, 6.4 s |
| t3_ceiling_budget_refuses_iff_unaffordable | PASS, 1.4 s | PASS, 4.2 s |

Also measured:

- native cold build + test run: 2.4 s, 366.0 MiB; crux builds: crux-test --lib --no-run 3.6 s; crux-test --lib --no-run 0.1 s; crux-test --lib --no-run --features teeth 0.5 s; crux-test --lib --no-run --features teeth 0.1 s
- startup crux-mir --version: 1.5 / 1.5 / 2.4 ms (n=10)
- vectors under crux: 1.8 s

Receipt serialization, measured on a first pass of the receipt: 132,189 bytes, rendered in 2.1 ms, written and fsynced in 2.8 ms.

**The one change to production code.** `plan_fee_cap` formatted its
`u128` arguments into its refusal message; under symbolic execution each
digit of that formatting is a 128-bit division goal, and with that path in
play even the trivial property (cap ≥ fee) did not close in 14 minutes. The
arithmetic moved into `fee_cap`, and `plan_fee_cap` wraps it with the same
messages. Every production call site is unchanged, and
`correspondence-split` holds today's `plan_fee_cap` to the verbatim pre-split
function: identical caps and refusal text on 74,536 boundary inputs.

**Solver strategy.** 128-bit division goals resist bit-blasting. In
development trials the lemma behind p2, p4 and p6
(`g ≠ 0 ⇒ (r / g < f ⇔ f × g > r)`, overflow-safe) stayed Unknown under
bitwuzla, z3 and cvc5 bit-blasting for up to 1,800 s; in the receipt run's
cross-check, bitwuzla leaves one goal of p2, p4, p5 and p6 each open at its
300 s timeout. cvc5's integer blasting (`--solve-bv-as-int=sum`) decides
them in under a second. Crux-MIR
cannot pass solver options, so the `rb-cvc5-intblast` shim (Rust, this
crate) adds the flag and drops what4's `(set-option :produce-abducts true)`,
which puts cvc5 in a SyGuS mode that refuses integer blasting. Only an unsat
(Proved) answer counts as proof, and the soundness of the translation is
cvc5's. The same strategy convicts both faulty variants (three TEETH
properties) with concrete models; the bitwuzla cross-check rows show which
properties a second solver and method confirm.

**Assumptions and limits.** Crux-MIR's semantics: MIR from rustc
nightly-2026-03-21 through mir-json `ece1622c`, unoptimized with overflow
checks, std from mir-json's translated libraries, integers as exact
bit-vectors, `--assert-false-on-error` (an untranslatable path fails a
property instead of passing it). The stage label is a fixed string.

**Remaining obligations.** Ledger persistence (temp file, fsync, rename;
directory durability unchecked); concurrent writers (budget.rs documents no
lock: two runs of one plan lose each other's entries); receipt authenticity
and chain observations (`settle` takes balance change and receipt cost as
given); the call site's `limit.saturating_mul(SEND_ATTEMPTS)`, which at
saturation reserves less than the true four-attempt worst case;
`SEND_ATTEMPTS = 4` as a claim about evmlib's retry loop; the `GasLedger`
methods and `default_ledger_path`.

## PQ scope

- RB01's configuration is **not post-quantum**: its OT extension rests on
  Chou-Orlandi base OT over Ristretto (discrete log). The symmetric parts
  (AES-based correlation-robust hashing, PRG, garbling) face only generic
  quantum speed-ups; no claim is made for them here.
- `schmivitz` (Swanky's VOLE-in-the-head prover) is a separate PQ-oriented
  research candidate. A successful PSI run qualifies nothing about it, and a
  `schmivitz` run would qualify nothing about this PSI. Not built or run.
- A later Plonky3 comparison must first align the relation, the public
  inputs, the security target and the proof-artifact requirements, and must
  measure proof bytes as well as proving and verification cost. Not started.
- RB02 and RB03 are functional-correctness results over stated domains.
  Cryptographic hardness, quantum soundness, side channels, transport and
  settlement are separate obligations, and none of them is claimed.

## Computation, authorization, settlement

These lanes produce computation evidence and nothing else. bSiGner keeps
its bounded authorization role and bPay its settlement role; no RB result
authorizes or settles anything.

## Not run, not started

- RB01 on independently controlled hosts (NOT-RUN row).
- Daedalus-generated Rust against an existing BNR Rust parser: not started
  here; it continues as its own lane (RB04) in a separate session. What the
  pin (`a4ad7592`) requires, read from its tree: the generator is
  the Haskell `daedalus` executable (cabal project; its CI builds with GHC
  9.8.4 and cabal 3.14.2.0 and publishes no binaries; the latest release,
  v1.0 of 2026-02-10, predates the pin). It emits Rust with
  `daedalus compile-rust FORMAT.ddl --determinize --output-file=... --entry=...`
  (backend `daedalus-vm/src/Daedalus/VM/Backend/Rust.hs`) against the
  `rts-rust` runtime crate; the in-tree Rust examples are
  `formats/stateful-parser-example-rust` and `formats/pdf/new/rust`. The
  development host has no GHC, and its WSL VM went down during this work
  (the RB02 incident above), so the generator was not built here. A candidate format is the WB001 intent envelope, whose Rust
  encoder and UTF-8 validator are SAW-proven equal to their Cryptol spec; the
  choice and the comparison (acceptance, decoded values,
  consumed length, canonical re-encoding) are the next lane's.
- GREASE on a compiled BNR function; zkLean and LibSignal model extraction:
  not started.

