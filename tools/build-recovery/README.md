# bSigner recovery in Rust

The recovery controller, inventory, integrity refusals, public-law verification
orchestration and receipts are Rust. The existing signer and cryptography are
unchanged. This standalone workspace has its own pinned lockfile and does not
change the signer's lockfile. No Python or Node interpreter is required by the
controller. HTML is presentation, not a substitute for native protocol logic.

The original reconstruction remains historical evidence at commit
`25c0a2f33bdde7ffe67fec4ad782026209fdc092`, with its original snapshot and logs.
Never rewrite those artifacts or attribute that run to this Rust binary.
The [Python sources and original raw evidence](evidence/python-25c0a2f/PRESERVATION.md)
are also preserved on this branch under the founder's explicit instruction.
See [the after-action report](../../docs/dispatches/2026-10-29-codex-build-recovery-after-action.md).

## Build the controller

Linux x86_64, Rust 1.98.1, an installed C linker/system libraries and locked
dependency sources are required. The 31 packages in this tool's lockfile are
already in the retained recovery vendor directory. Compile locally:

```sh
cargo --config 'source.crates-io.replace-with="vendored-sources"' \
  --config 'source.vendored-sources.directory="/retained/vendor"' \
  build --release --frozen --offline \
  --manifest-path tools/build-recovery/Cargo.toml -j 1
```

Use a dedicated `CARGO_TARGET_DIR`, the pinned toolchain's `bin` first in PATH,
and one build job. `test` runs refusal controls; `clippy --all-targets -- -D warnings`
checks the same implementation. The recorded controller build also used a
network namespace without external interfaces, in addition to Cargo offline.

## Local preparation; downloads are separate

Acquire a committed Git archive with `git archive --format=tar`, the exact
toolchain named in `rust-toolchain.toml`, dependency sources via
`cargo vendor --locked --versioned-dirs`, and the four public fixtures below.
Online acquisition is separate. Git remotes, registries and URLs are replaceable
acquisition locations, not authorities for accepting bytes. Independently
retained archive/source/lock digests and fixture pins determine acceptance.
A digest beside replaceable bytes is not itself proof of origin.

`prepare` performs **no network calls**. The demonstrated run reused previously
retained inputs and downloaded nothing. Its new snapshot's parent must exist:

```text
bsigner-recovery prepare ARCHIVE ARCHIVE_SHA256 SOURCE_SHA TOOLCHAIN VENDOR FIXTURES NEW_SNAPSHOT EXPECTED_LOCK_SHA256
```

It checks archive hash and Git PAX commit, extracts with native GNU tar, checks
lock/toolchain pins, copies source/toolchain/vendor, and checks fixture size and
SHA-256 against retained source pins: `xwing-draft.txt`, `bip341.json`,
`bip174.mediawiki`, `bip371.mediawiki`. Unsupported dependency source types fail
closed. This retained workspace uses crates.io and local workspace dependencies;
Cargo validates vendored checksums during resolution/build. Assembly alone is
not a reconstruction pass.

The controller embeds its Rust source, manifest and lockfile for retention.
`provenance.json` records input and host-tool identities. `manifest.json` records
every retained file/link and ordinary-file mode. Preserve the manifest digest
independently. Historical manifests without modes remain readable, without
retroactively claiming permission integrity. Preparation additionally requires
native Git and GNU tar. Partial failures remain for diagnosis; retry into a new
path. A bootable OS image and compiler source reconstruction remain separate.

## Offline reconstruction

Observe an SDK timing gap before compilation. A note is evidence, not a
reservation; low priority does not authorize overlap. Preserve other owners'
processes and worktrees. Use:

```text
bsigner-recovery verify SNAPSHOT INDEPENDENT_MANIFEST_SHA256
bsigner-recovery offline SNAPSHOT INDEPENDENT_MANIFEST_SHA256 NEW_WORK QUIET_WINDOW_NOTE
```

Output and snapshot must be disjoint; output must not already exist. All retained
bytes and host executable hashes are checked before launch. Bubblewrap creates
isolated network/mount/PID/user/IPC/UTS namespaces, read-only source/tools, fresh
target/Cargo home, cleared environment and disposable `/tmp`. No host home,
Windows drive, credentials or inherited network socket is supplied. The usual
`python3` and `node` executable paths are masked with `/dev/null`; execution
attempts must fail before Cargo starts.

Admission requires a different network namespace, loopback only, no IPv4 route,
and IPv4/IPv6 connection attempts returning `ENETUNREACH` (101). Timeouts do not
count. Add `--probe-only` to run isolation and dependency resolution alone.

The seven command receipts cover:

1. `cargo --config /snapshot/cargo-config.toml tree --frozen --offline -p bsigner --edges normal,build`
2. `cargo --config /snapshot/cargo-config.toml build --frozen --offline --release -p bsigner -j 1`
3. `cargo --config /snapshot/cargo-config.toml test --frozen --offline --release -p bsigner -j 1`
4. The same test command with `xwing_matches_the_draft_vectors -- --ignored --nocapture`.
5. The same test command with `-- --ignored --nocapture bip341_wallet_vectors bip174_and_bip371_vectors`.
6. `/work/target/release/bsigner selftest`.
7. `/snapshot/runner law /work/target/release/bsigner /source`.

The last command ports the existing shell/Node law gate's orchestration to
Rust. It uses the same `bsigner bpq-verify` contract, requires verified detached
signatures by the existing pinned signers for every listed file, and requires
exit 1 for a changed copy. A crash/missing binary is not a tamper refusal. No
cryptographic implementation is substituted.

Limits: one Cargo worker/test thread, nice 15, 30 minutes plus 15-second
termination grace, 8 GiB address space and 1,200 CPU seconds **per process**,
1,024 descriptors and 2 GiB per output file. These are not aggregate memory or
disk quotas. Manifest parsing is capped at 64 MiB, 150,000 entries and 64
directory levels. Keep several GiB free per snapshot/run. Compatible OS,
linker/libraries and native isolation utilities remain explicit dependencies.

## Language census and change check

Produce a UTF-8 native-Git path list (`git ls-files`, plus new files where
appropriate), one repository-relative path per line. Then:

```text
bsigner-recovery audit REPOSITORY_ROOT TRACKED_PATH_LIST OUTPUT_JSON
bsigner-recovery guard REPOSITORY_ROOT CHANGED_PATH_LIST
```

The census names tracked scripting-language paths and script-bearing HTML
indicators. It is not a runtime graph, complete HTML parser or centralization
verdict. Classify first-party logic, vendor specimens, build glue, proof
languages and generated files before porting; preserve contracts and fixtures.

The guard refuses listed Python/JavaScript/TypeScript/shell/etc. changes and
obvious script-bearing HTML. Rust and Vaulta-native C++ are implementation
targets. It checks only supplied paths and selected syntax. It is not wired to
shared hooks/CI by this lane and is not estate-wide enforcement.
Pass active implementation changes to the guard. The explicitly preserved,
hash-checked historical evidence files are not new runtime implementations and
are maintained separately; do not delete them to make a language count smaller.

Results must identify executed source/binary and commands. One reconstruction
is not statistical evidence of a speedup, universal security, reproducibility,
10-billion-active-user capacity or 1,000-year durability. Language compliance
alone establishes none of these.
