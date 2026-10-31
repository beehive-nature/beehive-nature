# bSigner bounded build recovery — 2026-10-29

Historical receipt: this run used the Python controller at
`25c0a2f33bdde7ffe67fec4ad782026209fdc092`. The founder subsequently ordered
replacement with Rust. The original evidence is preserved, not relabeled as a
Rust-controller run. Current implementation and separately measured results:
[after-action report](2026-10-29-codex-build-recovery-after-action.md).

Lane: `codex/build-recovery-2026-10-29`, worktree
`C:/Users/travi/wt-codex-build-recovery`. Lead: ChatGPT. No merge or production
rollout is assigned. Wonder's H01, Spark High's SDK qualification, Spark
Medium's B9, their worktrees and unpushed changes remain with their owners.

Result: **PASS — one clean offline reconstruction and the named existing
verification checks**, with every recovery command exiting 0. The source
revision below is unchanged. This is one host/build, not a reproducibility or
durability result. The preparation-only checkpoint was
`2d4b07ef9c5e87811edab4251ea50e5ee4c088e1`; this update adds the actual run receipts.

## Source and scope

Fetched `origin` before creating this worktree from current main. Full base
and reconstructed source revision: `e36fde447446440916131a2b4dadd1eee3bcc7d0`.
The native Git archive's PAX commit comment matches that SHA. This PR adds
only dedicated `tools/build-recovery/` tooling/receipts and this dispatch.
It does not edit the Rust source, lockfile, toolchain pin, frozen public
contract, harness modules, B9 fixtures, SDK qualification, wallet consumers,
shared workflows, or another seat's worktree.

Reused build and verification entry points: `.github/workflows/btungsten-pq.yml`
(PQ05/PQ12), `.github/workflows/tests.yml` (law signatures),
`scripts/verify-law-signatures-rust.sh`, and the bSigner crate's existing
tests/selftest. Read `crates/bsigner/CONTRACT.md`, the root `AGENTS.md`, and
the 2026-10-18 portable-repository, 2026-10-09 PQ closeout, and 2026-10-02
bSAFE build dispatches. The bSAFE firmware's independent build evidence is
not evidence for this bSigner reconstruction.

## Preparation and retained inputs

Preparation allows public downloads. Offline execution is a separate command
and process namespace. Native Git archive command (exit 0):

```powershell
git archive --format=tar -o C:/Users/travi/build-recovery-2026-10-29/source.tar e36fde447446440916131a2b4dadd1eee3bcc7d0
```

The full source archive is 590,776,320 bytes. The Linux snapshot lives at
`/home/travi/bsigner-recovery-2026-10-29/snapshot`; the Windows archive is at
the path above. These are local retained artifacts, not uploaded or replicated
archives. Git history and a bootable OS image are not included.

```sh
python3 tools/build-recovery/bsigner.py prepare \
  --archive /mnt/c/Users/travi/build-recovery-2026-10-29/source.tar \
  --source-sha e36fde447446440916131a2b4dadd1eee3bcc7d0 \
  --snapshot /home/travi/bsigner-recovery-2026-10-29/snapshot \
  --toolchain /home/travi/.rustup/toolchains/1.98.1-x86_64-unknown-linux-gnu
```

Preparation exit 0. `cargo vendor --locked --versioned-dirs` retains **608
registry package directories**, including packages needed for full-workspace
resolution beyond bSigner's default build. `Cargo.lock` remains byte-identical
to the source archive. The first exploratory `cargo metadata --locked --offline`
failed with `failed to download schannel v0.1.30 / attempting to make an HTTP
request, but --offline was specified`; its Cargo exit status was not preserved
by the exploratory shell. Preparation then fetched that exact package. This
failure is not an offline reconstruction pass.

The actual default bSigner dependency graph is retained in the run receipts;
local path dependencies are `bpq-core`, `btungsten-wb001`, and
`btungsten-wb001-core`. Selected locked versions are ML-DSA 0.1.1, ML-KEM 0.3.2,
fips205 0.4.1, k256 0.13.4, libcrux-ed25519 0.0.9, hkdf 0.12.4,
sha2/sha3 0.10.9 and zeroize 1.9.0. Cargo's graph and lockfile are authoritative
for every transitive version and checksum, including parallel versions.

Toolchain: Rust 1.98.1, rustc commit
`48a229ceaefd4985c50990b14116b6d856af0985`, Cargo
`1.98.1 (797e8a9bc 2026-08-05)`, LLVM 22.1.8, target
`x86_64-unknown-linux-gnu`. The complete installed toolchain was copied before
the offline phase, avoiding rustup downloads or a shared compilation cache.
Host: Ubuntu 26.04 LTS under WSL2 kernel `6.18.33.2-microsoft-standard-WSL2`,
GCC 15.2.0, binutils 2.46, glibc 2.43, bubblewrap 0.11.1, Python 3.14.4,
Node 22.22.1. Exact executable digests and installed package versions are in
the snapshot provenance. Host OS libraries are a remaining retained-host
dependency, not a packaged operating-system recovery image.

Committed public fixtures include `surfaces/pq-kat.json`, `bpq-vectors.json`,
`bzdid-derive-vectors.json`, `bpq-nostr-vector.json`, `bpq-intent-vector.json`,
the BIP-39 word lists, and `scripts/btungsten/wb001-vectors.json`. Four external
files were downloaded during preparation with exit 0 and checked against the
existing size and SHA-256 pins: X-Wing draft 11 (61,105 bytes), BIP-341 wallet
vectors (29,296), BIP-174 text (132,652), and BIP-371 text (33,884). The BIP
files all come from bitcoin/bips commit
`200f9b26fe0a2f235a2af8b30c4be9f12f6bc9cb`. The existing law files, signatures,
`docs/PQ-LAW.json`, and `docs/PQ-SIGNERS.json` are retained unchanged.
The NIST fixture has 17 rows: ML-DSA-65 keygen 3/signature verification 7,
ML-KEM-768 keygen 3/decapsulation 4, from ACVP-Server revision
`975de31eb83d87039ec88934fdc47d8c312b892d`.

## Isolation, scheduling and outcome

Compilation was held while live SDK seek checks were observed. A short gap
at 19:50 did not qualify: a new timing run appeared and the preflight refused
compilation (exit 75). The final guard observed no live SDK timing process
from **20:04:15 to 20:05:17 America/Denver**, rechecked immediately before
launch, and periodic checks during the run also found none. The final SDK
pair had written receipts at 19:57:25 and 20:04:07. Existing offline
qualification processes were preserved. This is an observed timing gap,
not an owner reservation or a claim that SDK qualification is complete.
The first
non-compiling isolation probe passed: a new network namespace, only loopback,
no IPv4 routes, and IPv4/IPv6 connection attempts returning `ENETUNREACH`
(errno 101). Offline dependency resolution also exited 0. That probe alone
does not count as a reconstruction. The full run repeated these isolation
checks before compiling: host namespace `net:[4026531833]`, sandbox
`net:[4026532498]`, only `lo`, no routes, and errno 101 on both probes.

The offline runner uses bubblewrap `--unshare-all`, a cleared environment,
read-only snapshot and host tools/libraries, no mounted host home or Windows
drives, fresh Cargo home and target directories, and disposable `/tmp`.
Cargo additionally uses `--frozen --offline` with the vendored source config.
No source file or lockfile is rewritten. Test material uses the existing
public fixtures and sandbox-local throwaway keys; no credentials or private
keys are included in the persisted recovery receipts.

Resource policy: one Cargo job, one test thread, nice 15, a 30-minute timeout
with 15-second termination grace, 8 GiB address space and 1,200 CPU seconds
per process, 1,024 file descriptors, and 2 GiB per output file. These are not
an aggregate process-tree memory limit or a total-disk quota. The snapshot
uses about 2.37 GB of file bytes before its inventory file, plus the 590.8 MB
source tar and a fresh build directory. Measured build resources and exact
command exits are recorded below.

The integrity refusal controls passed 4/4: changed bytes, missing/extra
inputs, symlink substitution, duplicate paths and escaping paths. The existing
hook fixture passed (exit 0); the installer refused (exit 2) to replace the repository's already
configured shared `.githooks/pre-commit`, which delegates secret scanning,
identity and stack-inventory checks. That shared hook was preserved.
The initial shorthand `sh` was absent from PowerShell's PATH (wrapper exit 1);
the explicit Git-for-Windows shell was used thereafter. Commit hooks passed.

## Exact run, verification and artifact

The full offline command (exit 0) was:

```sh
python3 tools/build-recovery/bsigner.py offline \
  --snapshot /home/travi/bsigner-recovery-2026-10-29/snapshot \
  --work /home/travi/bsigner-recovery-2026-10-29/run-1 \
  --quiet-window-note 'No live SDK timing process observed at 20:04:15 and 20:05:17 America/Denver; immediate preflight still clear. Static offline qualification processes preserved.'
```

Execution inside the sandbox ran 20:05:46.696–20:09:54.510 America/Denver,
**247.814 seconds**. Including the initial snapshot integrity verification,
the supervising command took **257.84 seconds**. Fresh target and Cargo home;
no build artifacts or package cache were reused. The retained source,
compiler and vendor inputs were reused as intended. Inside `/source`, with
`CARGO_TARGET_DIR=/work/target`, these are the exact commands and statuses:

| Command | Exit | Seconds | Result |
|---|---:|---:|---|
| `cargo --config /snapshot/cargo-config.toml tree --frozen --offline -p bsigner --edges normal,build` | 0 | 0.366 | exact default graph retained |
| `cargo --config /snapshot/cargo-config.toml build --frozen --offline --release -p bsigner -j 1` | 0 | 164.582 | new release-profile binary |
| `cargo --config /snapshot/cargo-config.toml test --frozen --offline --release -p bsigner -j 1` | 0 | 78.850 | library 81 passed + CLI 81 passed; 3 ignored in each, executed below |
| `cargo --config /snapshot/cargo-config.toml test --frozen --offline --release -p bsigner -j 1 xwing_matches_the_draft_vectors -- --ignored --nocapture` | 0 | 0.416 | 1 library + 1 CLI fixture test passed |
| `cargo --config /snapshot/cargo-config.toml test --frozen --offline --release -p bsigner -j 1 -- --ignored --nocapture bip341_wallet_vectors bip174_and_bip371_vectors` | 0 | 0.767 | 2 library + 2 CLI fixture tests passed |
| `/work/target/release/bsigner selftest` | 0 | 0.032 | PASS |
| `sh scripts/verify-law-signatures-rust.sh /work/target/release/bsigner` | 0 | 2.677 | 7/7 signatures current; changed law-file copy refused |

That is **168 passing test executions across the two Rust harnesses**, not
168 distinct test definitions. All six ignored external-fixture instances
were explicitly executed. Doc tests contain zero tests. The selftest covers
ML-DSA 44/65/87 roundtrip/tamper, ML-KEM 512/768/1024 roundtrip, future-algorithm
refusal, public-only key output and the existing x402 pre-signature gate with
over-cap refusal; it submits no payment. Existing deprecation/dead-code/profile
warnings remain visible in the retained logs; no implementation was changed
to silence them.

Command logs, exact launch argv, preparation exits, host/tool digests, artifact
digest, and the source/toolchain/vendor inventory digests are in
[`tools/build-recovery/receipts/2026-10-29/receipt.json`](../../tools/build-recovery/receipts/2026-10-29/receipt.json)
and the adjacent `.log` files. The binary is retained locally at
`/home/travi/bsigner-recovery-2026-10-29/run-1/target/release/bsigner`:
**1,974,552 bytes**, default features, Linux x86_64 release profile.
The publication diff check initially flagged `new blank line at EOF` in
`bitcoin.log:201`, `tests.log:290`, and `xwing.log:119`. Only trailing empty
lines were removed from the committed log copies; original logs remain in
the local run directory. The subsequent diff check passed.

| Input/output | SHA-256 (hex; public integrity values) |
|---|---|
| Git source archive | `eb45a3768aed2a130e29fa14fb689ff5f9609658b092aa53e11dd78855591db5` — PUBLIC-CONSTANT |
| Original `Cargo.lock` | `a13b0deda4dbda7be5d8076f7b00610d2e6d189f892e61460565bd62accefcd3` — PUBLIC-CONSTANT |
| `rust-toolchain.toml` | `2c844dc8ef6c96157ffe38145daead92ea504d051ad5b53168c412a90836a5fe` — PUBLIC-CONSTANT |
| Retained `rustc` executable | `859254978c0a0402c32f949f6de0d99aee73be8d15f45aac00ae1448aac51e74` — PUBLIC-CONSTANT |
| Retained `cargo` executable | `da77c8b33849312255ccde3179198ada4c8deb370488d050286146b1d1b27e14` — PUBLIC-CONSTANT |
| Complete snapshot manifest | `54924b632e0b612c215c8fd93e516c45b41cd27ed6fb45693426cc655930298a` — PUBLIC-CONSTANT |
| Rebuilt `bsigner` binary | `15042add08f4a38cab75ea2710efd0cd3f78a5099486cb67c4296615be444591` — PUBLIC-CONSTANT |

The receipt also gives SHA-256 inventory-subset digests for the **entire**
source (28,256 files), toolchain (339 files), vendor (31,214 files), and four
downloaded fixtures, encoded as base64url. The hash definition is recorded
there; these are file-content inventories, not bootable images. The complete
manifest is 10,944,124 bytes and is retained with the snapshot.

Measured storage: source file bytes 569,305,644; copied toolchain 1,065,840,275;
vendor 734,888,499; external fixtures 256,937; fresh run output 175,642,196
bytes. Including the source tar and inventory, retained data are about
**3.15 GB decimal**. Allow additional free space for temporary files and OS
overhead. The retained sandbox home is empty; generated test keys lived only
in disposable `/tmp`.

Memory qualification is limited: the outer `time -v` reports 62,576 KiB RSS
and about 10 CPU seconds for its accounted supervisor processes, but **does
not account for the compiler descendants across the namespace supervisor**.
Those figures must not be advertised as compiler peak RAM or total build CPU.
Actual compiler peak/aggregate memory was not measured; the recorded
per-process 8 GiB address-space ceiling and one-job settings were enforced.
The build was not repeated just to manufacture a broader resource claim.

No missing package or public fixture remains for this tested configuration.
Remaining recovery dependencies are the retained compiler binaries/standard
library, compatible Linux host and linker/system libraries, namespace support,
Python/Node and core command-line tools. Rust itself and the OS were not
rebuilt from source. Independent OS/toolchain reconstruction, aggregate memory
measurement, alternate targets/features and durable archive replication are
separate gates. The PR is
[beehive-nature/beehive-nature#496](https://github.com/beehive-nature/beehive-nature/pull/496);
no merge or production rollout is performed.

## Upstream priority and limits

Read current x0x #622/#504/#505 discussion before starting implementation.
David's [#622 consolidation](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
moves the remaining egress work back to #504. His
[#504 direction](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
requires per-kind counters and a same-workload delivered/published capture;
policy/default changes retain their ADR gates. #505 has explicit
[field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210).
No upstream reply, transport change, new capture, provider call or rollout
was made by this lane.

The acceptance boundary is reconstruction and execution of the named
existing checks on one retained source/toolchain/host configuration. The
cryptographic paths exercised are the existing `kat::*` tests, `bpq` vector
tests, `taproot::tests::bip341_wallet_vectors`,
`psbt::tests::bip174_and_bip371_vectors`, `cmd_selftest`, and
`cmd_bpq_verify`; no cryptographic implementation is changed or re-audited.
The optional FROST feature, physical hardware custody/recovery, external
consumer qualification and production acceptance remain outside this drill.

A successful reconstruction does not establish bit-for-bit reproducible
binaries or 1,000-year durability. It also does not demonstrate 10-billion-user
capacity. Retained source/dependencies, public verification and replaceable
build infrastructure support continuity without introducing custody,
centralized runtime services, subsidized operations, or network dependencies
into bSigner. Independent builders, durable replicated archives, future
toolchain/OS recovery and future algorithm migration remain separate work.
