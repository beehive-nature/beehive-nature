# bTunGsTeN RB — compatibility and PQ-scope report

Order: workerB bench expansion, 2026-10-08 (measured Rust execution and
assurance with selected Galois tools). Provenance: the review that issued the
order read BNR at `a3419732c0c06d1d24c8bca2d4cb70e5022971cf`; this work
started at `2e8d20970fa52109054c829fe9542abbf5fbe876` (one commit later,
`btungsten PQ01`, which touches no file these lanes read). Code:
`crates/btungsten-bench` (the `rbench` orchestrator) and
`scripts/btungsten/rb0{1,2,3,4}-*`. Receipts: this directory. Every claim below
points at a receipt row; where a row and this page disagree, the row wins.

## How to reproduce

```
cargo build --locked --release -p btungsten-bench --bins
target/release/rbench rb01 --work W --out O/rb01
target/release/rbench rb02 --tools T --work W --out O/rb02
target/release/rbench rb03 --tools T/crux --work W --out O/rb03
target/release/rbench rb04 --tools T --work W --out O/rb04
```

`--quick` runs the same rows with fewer samples (the CI plan). `T` holds the
verifier bundles in the layout `scripts/btungsten/README.md` §RB names; the
`rb02-aes` and `rb03-budget` jobs of `.github/workflows/btungsten-rb.yml`
build exactly that layout from pinned, digest-checked assets. The Crux-MIR
bundle that job downloads is upstream's CI artifact and expires 2027-01-06;
reproduction must not depend on that download alone. The rebuild recipe and
its required inputs are the Crux-MIR pin row below — crucible `25d0f369`
built the way upstream's `crux-mir-build.yml` pins it at that commit
(GHC 9.10.3, ubuntu-24.04), mir-json `ece1622c`, nightly-2026-03-21,
what4-solvers `snapshot-20260622` — so after the artifact expires the
bundle is rebuilt from those inputs, not re-downloaded.
RB04 needs GHC 9.8.4 and cabal 3.14.2.0 on `PATH` and uses `T/cabal` as
the cabal home.

## Where these receipts ran, and what went wrong on the way

The committed receipts, under `ci-37923430005/`, are one full-plan run of
`.github/workflows/btungsten-rb.yml` (run 37923430005, `workflow_dispatch`,
`plan=full`) at BNR `073697abb`, on GitHub-hosted `ubuntu-24.04` runners, one
runner per lane, so no two lanes shared a host. Each receipt's `host` section
names the CPU, ISA flags, kernel and memory it measured on, and its `bnr`
section the exact BNR commit. The lane lineage in full: the first full-plan
execution after the memory-accounting repair was run `37906620036` at BNR
`f43ffdcd3f756b983289a692fdf1576240510d78` (all three lanes PASS, receipts not
committed); RB01 then gained its operator notice — disclosure text only — and
the lanes ran again in full as run `37923430005`, the receipts committed here.
Push and pull-request runs of this workflow run `changes` and `fast`, and
every lane whose inputs the change touches runs with `--quick` (PR #374's
pull-request run 37984740018 ran all four). Only full-plan runs
(`workflow_dispatch`, `plan=full`) produce the receipts cited here; a green
push or pull-request check is at most a quick-plan execution, and none is
cited as a receipt.

The RB01-RB03 receipts were measured at `073697abb`. When this text was
written (`4a257bdef`), the comparison over every input those lanes read,
`git diff 073697abb 4a257bdef -- crates/ ops/ant-extsig Cargo.toml
Cargo.lock rust-toolchain rust-toolchain.toml .cargo .github
scripts/btungsten`, was empty except documentation lines in
`scripts/btungsten/README.md`, so nothing was rerun. Later commits change
inputs these lanes read (RB04's additions to `rbench.rs`, `lib.rs` and the
workflow; other lanes' crates and the workspace lock on `main`): the
receipts describe `073697abb`, not any later head. Logs and
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

RB04's receipt, under `ci-37923091082/rb04/`, is a separate full-plan run of
the same workflow (run 37923091082, `workflow_dispatch`, `plan=full`,
`lanes=rb04`) at BNR `c6d2ccefc` on branch `claude-LoVis/rb04-daedalus`,
which merged the RB01-RB03 head `ecd5e6c6f`; RB04's own trials are in its
section below. RB04 adds to three inputs the other lanes also read:
`crates/btungsten-bench/src/bin/rbench.rs` (an `rb04` arm),
`crates/btungsten-bench/src/lib.rs` (the `rb04` module) and
`.github/workflows/btungsten-rb.yml` (the `rb04-daedalus` job, a `lanes`
dispatch input, RB04's own lane file kept from re-running RB01-RB03, and the
RB04 harness tests in `fast`). No RB01-RB03 code path changes; their
receipts above were measured at `073697abb`, before these additions.

## Pins and departures

| what | pinned | departure, and why |
|---|---|---|
| Swanky | `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`, its `Cargo.lock`, its `rust-toolchain` (Rust 1.99.0) and `.cargo/config.toml` (`-C target-cpu=native --cfg vectoreyes_target_cpu_native -C link-args=-flto`) | none. The provider is one added example file (`edge/popsicle/examples/rb01_psi.rs`); no upstream file changes |
| rustcrypto-verification | `52d36ff4562c9b574f49c8b3133ea63f2a9574d5`, cryptol-specs submodule `8638495a3ba8c1c0bd031f0c5d7f243b5e8617ff` | upstream CI ran `ghcr.io/galoisinc/saw-suite:nightly` (SAW 1.6.0.99, master `345296457`); RB02 runs the SAW 1.6 release bundle WB001/WB002 already run (mir-json `8cbf9af1`, schema 13, nightly-2026-03-21). Docker is unusable on this host, and BNR keeps one coordinated SAW bundle rather than mixing a nightly SAW with its own mir-json. The image digest upstream pulled is recorded in the receipt. `.gitmodules` names an SSH URL; the same commit is fetched over HTTPS |
| Crux-MIR | crucible `25d0f3698a96cb8f014911146c02fabdb26f66ff`: upstream's own CI build of that commit (run 37835376050, artifact 11575803445, GHC 9.10.3, ubuntu-24.04), mir-json `ece1622caf39c9530873f376caa84a5fa6a3ded3` (crucible's submodule pin), nightly-2026-03-21, what4-solvers `snapshot-20260622` | none in versions: these are exactly the versions `crux-mir-build.yml` pins at that commit. The binary is upstream's CI artifact, digest-checked, not a local rebuild; it expires 2027-01-06, after which the CI job fails at its download step and the bundle must be rebuilt from `25d0f369` |
| Daedalus | `a4ad7592ef2449fa1da07d2827fc6684293d21ca`, built from source with GHC 9.8.4 and cabal 3.14.2.0 (upstream CI's versions); `daedalus-rts-rust` from the same commit | the Hackage index state fixed at the pin's commit time (upstream has no freeze file); ubuntu-24.04 where upstream CI runs ubuntu-22.04; code generation with the pinned stdlib beside the grammar instead of `--path` (RB04 below) |

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

**Upstream observations and adapter coverage** (characterization
rows, recorded at the pin; none is a claim about our code). A
CHARACTERIZATION PASS means the behaviour was recorded, not that upstream or
the provider behaved correctly. A separate lane re-checked each item at the
pin, three runs on the development host, none an independent reproduction:
`docs/upstream/2026-10-09-swanky-popsicle-rb01/` (main `0d88ec248`), dispatch
`docs/dispatches/2026-10-09-rb01-swanky-evidence.md` (Seat 3, the RB01
reporting lane). The re-check is later evidence attributed to that seat,
carrying its own runs and sample counts; it is not a measurement of the
benchmark runs above, and the two histories are reported side by side, not
merged.

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

Which input rules cover which observations, observation by observation. The
provider refuses an empty set on either side, a repeated element in either
set, and inputs that are not a whole number of 8-byte elements, before any
connection; those rules address the empty-set panics and the
repeated-element behaviours above. No input rule addresses the remaining
observations: a garbler set larger than the evaluator's is a legitimate
input, sampled rather than guarded — the sweep and the re-check tallies
record how often it panics, per run, as samples, and no size is claimed as
a threshold in either direction; the ≤16-byte zero-padding aliasing is
recorded, not guarded; and the RNG finding is untouched by any input rule —
rejecting empty, duplicate or wrongly sized inputs does not resolve RNG
reuse, whose security consequences remain **UNVERIFIED**.

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

All ten properties are proved over their stated domains and preconditions
under the required strategy (cvc5 integer blasting through
`rb-cvc5-intblast`), three times each, and both faulty variants are
convicted, on all three TEETH properties, with concrete models. The
domains are the ones the `PROPERTIES` table in
`crates/btungsten-bench/src/lanes/rb03.rs` states, and they are not all
unconditional: p2's affordability biconditional assumes `gas_limit != 0` —
the case p1 refuses separately. p1 establishes zero-gas refusal; it does
not make p2's affordability statement unconditional. The correspondence rows hold: the harness compiles production's
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

## RB04 — Daedalus-generated Rust against BNR's WB001 parser

Receipt: `ci-37923091082/rb04/receipt-rb04.json` (full plan, run 37923091082, BNR
`c6d2ccefc`). Lane: `crates/btungsten-bench/src/lanes/rb04.rs`; harness, grammar
and generated parsers: `scripts/btungsten/rb04-daedalus/` (its README holds
the design).

**The parsers.** BNR's is `btungsten_wb001::decode`, chosen after reading it:
the strict decoder of the WB001 intent envelope (magic, version, ten
tag-length-value blocks in tag order with per-field length bounds, UTF-8
through the SAW-proven DFA, exact consumption), whose canonical encoder
`btungsten_wb001::canonical` SAW proves equal to the Cryptol `wire` for every
valid intent. The other is the Rust `daedalus compile-rust` generates from
`WB001.ddl`, a grammar written from the wire description rather than from the
decoder: its UTF-8 is RFC 3629's UTF8-char grammar over byte ranges, not
BNR's DFA. The grammar has two entries, `Exact` (the whole input is one
envelope) and `Envelope` (the envelope as a prefix, so the parser reports how
much it consumed).

**What is compared.** Per input: acceptance (`Exact` against `decode`);
decoded values where both accept; consumed length (the whole input where BNR
accepts; where BNR refuses with `bt-wb01:trailing`, `Envelope` must consume a
shorter prefix that BNR itself accepts with equal values, and `Exact` must
fail; under any other refusal neither entry may accept); and canonical
re-encoding (BNR's and `Exact`'s values wherever they accept, re-encoded by BNR's SAW-proven
encoder, equal the input; `Envelope`'s prefix values are held to
`decode` of the prefix under consumed length). A panic in either parser counts as a
disagreement. Corpora: the pinned WB001 vectors (10 positives, 5 envelope
refusals, 8 bridge terms) and 468 constructed boundary inputs, each with an
expected BNR answer that is checked too; and 200,000 seeded adversarial
samples (mutations of random valid envelopes, framed fields at and past their
bounds, framed malformed and edge-case UTF-8, tag and header faults, splices,
random bytes). Each TEETH variant is the grammar with one declared
substitution; it must be convicted on the dimension it targets, on an input
where the honest grammar agrees with BNR on every dimension.

| phase | wall | CPU (user) | peak RSS (process / sampled group) | what it built |
|---|---|---|---|---|
| prepare: clone at the pin | 2.1 s | | | |
| prepare: `cabal update` to the index state | 20 s | | | |
| generator build 1 | 374 s | 674 s | 1039.2 MiB / 2080.2 MiB | 46 store packages (store empty before), then the project's 9 components |
| generator build 2 | 181 s | 179 s | 685.2 MiB / 1204.1 MiB | the project's 9 components (store warm: 46 packages, none rebuilt) |
| codegen `honest` (n=10) | 374 / 385 / 399 ms | | 63.9 MiB | 9,441 lines of Rust |
| codegen `t1_domain_bound` (n=10) | 375 / 386 / 398 ms | | 64.0 MiB | 9,441 lines of Rust |
| codegen `t2_word_endian` (n=10) | 386 / 396 / 420 ms | | 63.9 MiB | 9,441 lines of Rust |
| codegen `t3_cesu8_surrogate` (n=10) | 378 / 385 / 415 ms | | 64.0 MiB | 9,441 lines of Rust |
| codegen `t4_trailing_bytes` (n=10) | 376 / 393 / 416 ms | | 64.8 MiB | 9,374 lines of Rust |
| compile: `cargo fetch` | 4.1 s | | | |
| compile: runtime-crate | 7.7 s | 19 s | 435.3 MiB | |
| compile: bnr-parser-crate | 6.7 s | 18 s | 483.5 MiB | |
| compile: harness-with-generated-parsers | 323 s | 941 s | 2762.2 MiB | |
| compile: warm-noop | 0.1 s | 0.0 s | 34.5 MiB | |

| comparison | inputs | BNR accepts | acceptance | values | consumed | re-encode | wall |
|---|---|---|---|---|---|---|---|
| honest/sampled | 200,000 | 72,374 | 0 / 200,000 | 0 / 72,374 | 0 / 200,000 | 0 / 72,374 | 31 s |
| honest/vectors | 491 | 73 | 0 / 491 | 0 / 73 | 0 / 491 | 0 / 73 | 0.0 s |
| t1_domain_bound/sampled | 200,000 | 72,374 | **512** / 200,000 | 0 / 72,374 | **512** / 200,000 | **512** / 72,886 | 30 s |
| t1_domain_bound/vectors | 491 | 73 | **1** / 491 | 0 / 73 | **1** / 491 | **1** / 74 | 0.0 s |
| t2_word_endian/sampled | 200,000 | 72,374 | 0 / 200,000 | **69,868** / 72,374 | **17,415** / 200,000 | **69,868** / 72,374 | 31 s |
| t2_word_endian/vectors | 491 | 73 | 0 / 491 | **73** / 73 | **4** / 491 | **73** / 73 | 0.0 s |
| t3_cesu8_surrogate/sampled | 200,000 | 72,374 | **1,592** / 200,000 | 0 / 72,374 | **1,592** / 200,000 | **1,592** / 73,966 | 31 s |
| t3_cesu8_surrogate/vectors | 491 | 73 | **17** / 491 | 0 / 73 | **17** / 491 | **17** / 90 | 0.0 s |
| t4_trailing_bytes/sampled | 200,000 | 72,374 | **18,020** / 200,000 | 0 / 72,374 | **18,020** / 200,000 | **18,020** / 90,394 | 32 s |
| t4_trailing_bytes/vectors | 491 | 73 | **4** / 491 | 0 / 73 | **4** / 491 | **4** / 77 | 0.0 s |

Disagreements per dimension over the inputs it applies to (bold: a TEETH variant convicted).

| parser | median per pass of 20,000 inputs (25,001,383 bytes) | median per input | accepted |
|---|---|---|---|
| bnr_decode | 26 ms (min 25, max 28, n=20) | 1.3 µs | 7,222 |
| ddl_exact | 1222 ms (min 1199, max 1234, n=20) | 61.1 µs | 7,222 |
| ddl_prefix | 1218 ms (min 1204, max 1238, n=20) | 60.9 µs | 9,059 |

| TEETH | convicted on | witness | BNR | generated parser (whole input) |
|---|---|---|---|---|
| t1-domain-bound | acceptance | vectors #26 (constructed-bounds, 256 bytes) | refuse bt-wb01:length | accept, consumed 256 |
| t2-word-endian | values | vectors #0 (pinned-positive, 205 bytes) | accept | accept, consumed 205 |
| t3-cesu8-surrogate | acceptance | vectors #11 (pinned-refusal, 194 bytes) | refuse bt-wb01:utf8 | accept, consumed 194 |
| t4-trailing-bytes | consumed | vectors #454 (constructed-trailing, 206 bytes) | refuse bt-wb01:trailing | accept, consumed 205 |

sampled corpus (seed 7362124975341574708, sha256:ykdJaKgR4ECu4P5IdFR-o7QS4WTwBWD2jTUTHuy8zP0): append 11,945, bit-flip 20,198, byte-set 15,895, delete 10,159, field-bounds 19,971, header 5,956, insert 10,028, length-word 19,857, random 7,962, splice 5,997, tags 10,193, truncate 11,978, utf8 19,907, valid 29,954; BNR's answers: accept 72,374, bt-wb01:length 28,623, bt-wb01:magic 9,826, bt-wb01:short 18,674, bt-wb01:tag-order 21,083, bt-wb01:trailing 18,020, bt-wb01:utf8 30,550, bt-wb01:version 850.

vectors (sha256:Q6GvWIVFsauqDaKSqdSQjeZW--RY0P4CY188zmjmJ6U): constructed-base 1, constructed-bounds 29, constructed-length-word 2, constructed-magic 7, constructed-missing-block 1, constructed-tag-order 20, constructed-trailing 4, constructed-truncation 205, constructed-utf8-malformed 152, constructed-utf8-valid 44, constructed-version 3, pinned-bridge-term 8, pinned-positive 10, pinned-refusal 5; BNR's answer equals the pinned or constructed one on 491 of 491.

verdict PASS: 3 MEASUREMENT PASS, 4 SAMPLED-ADVERSARIAL PASS, 4 TEETH PASS, 9 VECTOR PASS; bnr c6d2ccefc8485ec71e012ad716ac447a7b15d615; host AMD EPYC 9V74 80-Core Processor, 4 CPUs, 15.6 GiB, Ubuntu 24.04.5 LTS; 2026-10-09T11:24:52Z to 2026-10-09T11:44:00Z; generator sha256:LpzmRM08nmyE8MuW1Ct3_-39_rD3PtL8-vOgAXeAHCw; rustc 1.98.1 (48a229cea 2026-09-01)

**What the receipt shows.** On the 491 vectors and the 200,000 sampled
inputs, the generated parser and BNR's decode agree on every dimension, with
no panic and no Daedalus exception on either side, and BNR's answers equal
every pinned and constructed one. Each planted fault is convicted on its
dimension, on a vector and again on the sampled corpus. t3's witness is the
pinned CESU-8 vector of WB001's 2026-10-07 boundary repair (`ED A0 80` in the
domain). t2 also disagrees on consumed length on 17,415 sampled inputs: where
BNR refuses trailing bytes, consumed-length agreement requires BNR's decode
of the consumed prefix to have equal values, so value faults reach that
dimension too. Code generation is deterministic (ten runs per grammar,
byte-identical) and reproduces the committed `src/generated/*.rs` byte for
byte; t1's generated parser differs from the honest one in one literal
(`64u64` to `65u64`). The generator, built from an empty cabal store, has the
same SHA-256 as the one built in run 37909426450
(`sha256:LpzmRM08nmyE8MuW1Ct3_-39_rD3PtL8-vOgAXeAHCw`, the receipt's
`generator.daedalus_binary`); run 37909426450's value was read from its
receipt artifact, which is not committed and expires.

The per-input times are wall-clock medians inside one process on a shared
runner; they describe this harness's use of each parser (the generated
parser builds owned arrays through the Daedalus runtime and keeps an error
stack, the default), and no ratio between them is a claim of this receipt.

**Pins and departures.** daedalus `a4ad7592` built from source (upstream
publishes no binaries) with GHC 9.8.4 and cabal 3.14.2.0, upstream CI's
versions, installed by `haskell-actions/setup` v2.11.0 (pinned by commit).
Departures, each recorded in the receipt: the Hackage index state is fixed at
the pin's commit time (`2026-10-01T22:42:03Z`; upstream has no freeze file,
so its solve follows the live index), and the resolved plan is recorded (181 non-project
packages, GHC's boot packages included; 46 were built into the empty store for the executable); the runner is
ubuntu-24.04, upstream's ubuntu-22.04; code generation copies the pinned
`lib/Daedalus.ddl` beside the grammar instead of passing `--path`, because
the generated source records each grammar file's path as given (an absolute
`--path` put the runner's work directory into the bytes). `daedalus-rts-rust`
comes from the same commit as a git dependency (`Cargo.lock`), and the
harness depends on `serde` directly because the generated code names it.

**Committed evidence.** The receipt and its logs, except the generated
parsers (`gen/`, byte-identical to `src/generated/`; the receipt records
each digest) and three cabal logs that name source-repository checkouts by a
64-character hex hash, which the repository's secret scan refuses and which
are never edited: `logs/002-prep-cabal-update.stderr` (371 bytes, sha256:Ru8qnX5rHODGkaNkh1u-MJQi1c6t_SMS-pipM-J1B-k), `logs/003-generator-build-1.stderr` (24,807 bytes, sha256:qvXJT6UHeg--Ky3BEH-CkBZlraFBDdZIJuXfB3lp-Io), `logs/005-generator-build-2.stderr` (24,807 bytes, sha256:qvXJT6UHeg--Ky3BEH-CkBZlraFBDdZIJuXfB3lp-Io). All are in the run's `rb04-receipt` artifact.

**On the way (CI runs on this branch).**

- 37909426450 (`130311901`): the generator built and code generation was
  deterministic; nothing was committed yet, so `codegen-reproduces-committed`
  failed by design. The run showed the absolute stdlib path in the generated
  source, and that `cabal build --only-dependencies exe:daedalus` also builds
  Daedalus's own libraries (they are dependencies of the executable), so the
  "dependencies / generator" split measured the wrong thing. Repair: the
  stdlib beside the grammar; two full builds, store as found and then warm.
- 37914863699 (`7b5bea50e`): both builds exited 0 but no executable was
  installed: `cabal list-bin` ran without the build's `CABAL_DIR`, and its
  output was not kept, so the receipt could not say why. Repair: it runs with
  the build's cabal home as a measured process with logs.
- 37917986862 (`433f79706`): quick plan, every row PASS.
- 37919892361 (`b3d3d4318`): full plan, every row PASS, but the receipt could
  not be committed: base64url of a zero-heavy witness input is a long run of
  `A`, which the secret scan reads as key-shaped hex. A receipt is not edited
  after its run; `rb04-diff` now writes witnesses in dot-separated groups of
  32 characters, and the full plan ran again (37923091082).

**Closeout after the independent review.** zCode reviewed `d0d6926e5`
(`docs/dispatches/2026-10-09-zcode-rb04-review.md`, `main` `0108c334d`): no
blocking defect. It accepted a proxy read-only review's findings F1-F9 and F11;
F10 (the grammar shares its field table with `decode`) needs no action beyond
this section's assumption. The closeout commit applies them:

- F1, F2: two RB01-RB03 sentences above, scoped to their commit and corrected.
- F3: RB04's change filter includes the root `Cargo.lock` and `rust-toolchain*`.
- F4: `correspondence-parser` also requires the harness lock's `btungsten-wb001`
  entry to be the path package, and the harness to call `decode` and
  `canonical`.
- F5: the README's per-input times are labelled harness call time, with no ratio.
- F6: re-encoding is stated for BNR and `Exact`.
- F7: run 37909426450's generator digest is recorded.
- F8: the honest rows also require zero panics and exceptions, every vector's
  answer checked, and summaries that name their variant and corpus; the TEETH
  rows require the latter too.
- F9: a dispatch that selects no lane, or names an unknown one, fails.
- F11: the receipt's `bnr` section hashes the model core
  (`crates/btungsten-wb001-core/src/lib.rs`) as well.

The committed receipt (run 37923091082) was written by the lane before these
conditions existed. Its own summaries satisfy every added condition: 0 panics
and 0 exceptions, 491 of 491 vectors checked, every summary naming its run, the
lock entry without a source, both calls present. It does not carry the core
digest. The closeout head's pull-request run executes the lane with the new
conditions.

**Development host.** The harness and its tests ran in WSL with the
generator binary built by CI (copied from run 37909426450's artifact,
digest-checked); the generator was not built there.

**Remaining obligations.** A proof that the grammar and BNR's decode accept
the same language with the same values for every input (for example both
against `BTungstenWB001.cry`): not attempted, and agreement on these corpora
is not a substitute. Daedalus's own front end, determinization and Rust
backend are trusted only as far as this comparison exercises them. Refusal
reasons are not compared (Daedalus reports a position and message, BNR a
code). Streaming input, very deep or large inputs, allocation failure and
side channels are not exercised.

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
- RB04 compares two parsers of one wire format on finite corpora; it makes
  no cryptographic or post-quantum claim.
- RB02 and RB03 are functional-correctness results over stated domains.
  Cryptographic hardness, quantum soundness, side channels, transport and
  settlement are separate obligations, and none of them is claimed.

## Computation, authorization, settlement

These lanes produce computation evidence and nothing else. bSiGner keeps
its bounded authorization role and bPay its settlement role; no RB result
authorizes or settles anything.

## Not run, not started

- RB01 on independently controlled hosts (NOT-RUN row).
- RB04: a proof that the grammar and BNR's decode agree on every input
  (agreement on the corpora is not one); the Daedalus interpreter (`daedalus
  run`) as a third parser of the same grammar.
- GREASE on a compiled BNR function; zkLean and LibSignal model extraction:
  not started.

