# bSigner bounded build recovery — 2026-10-29

Lane: `codex/build-recovery-2026-10-29`, worktree
`C:/Users/travi/wt-codex-build-recovery`. Lead: ChatGPT. No merge or production
rollout is assigned. Wonder's H01, Spark High's SDK qualification, Spark
Medium's B9, their worktrees and unpushed changes remain with their owners.

Current gate: preparation and the offline isolation/dependency probe passed;
compilation is waiting for an observed SDK timing gap. No reconstructed binary
is claimed by this preparation checkpoint.

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

## Isolation, scheduling and outcome

Compilation was held while live SDK seek checks were observed. The first
non-compiling isolation probe passed: a new network namespace, only loopback,
no IPv4 routes, and IPv4/IPv6 connection attempts returning `ENETUNREACH`
(errno 101). Offline dependency resolution also exited 0. That probe alone
does not count as a reconstruction. Final run results follow below.

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
command exits are recorded below after execution.

The integrity refusal controls passed 4/4: changed bytes, missing/extra
inputs, symlink substitution, duplicate paths and escaping paths. The existing
hook fixture passed; the installer refused to replace the repository's already
configured shared `.githooks/pre-commit`, which delegates secret scanning,
identity and stack-inventory checks. That shared hook was preserved.

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
