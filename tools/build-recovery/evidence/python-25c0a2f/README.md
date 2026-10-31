# bSigner bounded build recovery

This runner reconstructs the existing **default-feature** bSigner from a
retained Git source archive, the unchanged workspace `Cargo.lock`, a copied
Rust toolchain, vendored dependency sources, and the existing public fixtures.
It does not change the signer, its contract, any wallet consumer, or CI.

This is a Linux x86_64 recovery drill, including under WSL. It is not a
bit-for-bit reproducible-build claim, an independent cryptographic audit, a
hardware recovery ceremony, a production release, or a durability guarantee.
The optional, off-by-default FROST feature and other workspace applications
are outside this drill. No provider, wallet, payment, or mesh call is needed.

## Preparation (network allowed)

Use an isolated worktree. Fetch and record the full main SHA before archiving.
On Windows, use Git for Windows so the worktree's gitfile resolves correctly:

```powershell
git fetch origin
git rev-parse origin/main
git archive --format=tar -o C:/Users/travi/build-recovery-2026-10-29/source.tar e36fde447446440916131a2b4dadd1eee3bcc7d0
```

The output's parent must exist and the output must be a fresh, dedicated path.
Do not copy another seat's working directory, target directory, credentials,
Cargo credentials file, private keys, or unpushed work. The archive is the
committed source tree, not the worktree's current bytes or Git history.

Prerequisites: Python 3.12+ (`tomllib`, safe tar extraction), curl, Cargo,
the exact toolchain named by `rust-toolchain.toml`, and sufficient disk space.
For the offline host also retain Linux, bubblewrap with unprivileged namespace
support, `timeout`, `nice`, util-linux `prlimit`, a C linker/toolchain and its system libraries, and Node
for the existing law-signature script. The runner records host executable
digests and relevant installed package versions; it does **not** package an
entire bootable OS. Keep compatible OS installation media separately.

```sh
python3 tools/build-recovery/bsigner.py prepare \
  --archive /mnt/c/Users/travi/build-recovery-2026-10-29/source.tar \
  --source-sha e36fde447446440916131a2b4dadd1eee3bcc7d0 \
  --snapshot /home/travi/bsigner-recovery-2026-10-29/snapshot \
  --toolchain /home/travi/.rustup/toolchains/1.98.1-x86_64-unknown-linux-gnu
```

Preparation refuses an existing snapshot directory. It copies the full source
and toolchain, runs `cargo vendor --locked --versioned-dirs`, and downloads
only the four public fixtures already pinned by
`scripts/btungsten/pq05-xwing-draft.json` and `pq12-bip341.json`. Each fixture
must match its retained size and SHA-256. Cargo validates registry package
checksums against the original lockfile; directory-source checksums remain
present in the vendor tree. The full workspace dependency inventory is kept
because Cargo resolves the workspace even when only bSigner is built.

`provenance.json`, `dependencies.json`, preparation command receipts, and the
per-file `manifest.json` describe the snapshot. Preserve the archive and the
manifest digest outside the snapshot as an independent integrity anchor.
A digest stored beside its bytes alone is not an authenticity authority.
Preparation failures leave their partial directory for diagnosis; retry at a
new path after resolving the named missing input. Never call it complete just
because a local cache previously built a different source revision.

## Offline phase (after SDK timings finish)

Check the SDK seat's activity first. This synchronous command must run in a
quiet window; `--quiet-window-note` records the evidence, not a reservation.
Do not treat low CPU priority as permission to overlap another seat's timings.
Use a new output directory for every attempt; the runner will not overwrite
an existing output. A failed attempt's logs remain available.

```sh
python3 tools/build-recovery/bsigner.py offline \
  --snapshot /home/travi/bsigner-recovery-2026-10-29/snapshot \
  --work /home/travi/bsigner-recovery-2026-10-29/run-1 \
  --quiet-window-note 'Record the actual SDK-idle observation and time here'
```

The runner first verifies every retained file and host tool digest. Bubblewrap
then provides a new network, mount, PID, user, IPC and UTS namespace. The
snapshot and host tools/libraries are read-only, only the new output directory
is writable, `/tmp` is disposable, the environment is cleared, and neither the
host home directory nor `/mnt/c` is mounted. No network socket is passed in.
The namespace must differ from the host, have no IPv4 routes, and fail IPv4 and
IPv6 connection probes with `ENETUNREACH` before Cargo runs. The probes cannot
reach the public addresses in a successfully isolated namespace.

The following commands reuse existing build/test entry points. Each Cargo
command also receives the retained source-replacement configuration,
`--frozen --offline`, a new `CARGO_HOME`, a new `CARGO_TARGET_DIR`, and `-j 1`:

1. `cargo build --release -p bsigner`
2. `cargo test --release -p bsigner`
3. `cargo test --release -p bsigner xwing_matches_the_draft_vectors -- --ignored --nocapture`
4. `cargo test --release -p bsigner -- --ignored --nocapture bip341_wallet_vectors bip174_and_bip371_vectors`
5. `target/release/bsigner selftest`
6. `sh scripts/verify-law-signatures-rust.sh target/release/bsigner`

`cargo tree --frozen --offline -p bsigner --edges normal,build` first records
the actual default dependency graph. Add `--probe-only` to the offline command
to check isolation and this dependency graph without compiling or executing
fixtures. A probe success is not a successful reconstruction.

Steps 3 and 4 explicitly execute the public external-fixture tests ignored by
the ordinary suite. Their fixture environment variables point into the
retained snapshot. The ordinary suite also consumes the committed NIST KAT,
bPQ, derivation, Nostr, WB001, intent and BIP-39 fixtures. The law gate verifies
the current archived files against their existing signatures and pinned
signers, and requires refusal of a modified law file. A failing existing law
signature is a failed gate, not permission to regenerate it.

Resources: one Cargo worker and one Rust test thread, nice level 15, 30-minute
process-group timeout (15-second termination grace), 8 GiB address-space and
1,200 CPU-second **per-process** ceilings, 1,024 open files, and 2 GiB maximum
individual output file. These are not an aggregate memory or total disk quota.
Keep at least several GiB free; measured disk and memory are in the dispatch.
All generated test key material stays in the sandbox's disposable `/tmp`;
the persisted outputs contain build artifacts, public fixtures and receipts.

`launch.json` records exact argv, isolation settings and the snapshot digest;
`isolation.json` records the namespace and refusal probes; `logs/*.json` records
command exit statuses/times; `artifact.json` identifies the actual binary; and
`result.json` records the overall exit status. Success means those recorded
checks passed on this host for that source and toolchain. It does not establish
reproducibility across independent builders, future cryptographic strength,
10-billion-user capacity, or 1,000-year continuity.
