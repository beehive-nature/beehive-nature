# Build-forensics receipt index

Read the [plain-language report](../../dispatches/2026-10-29-codex-build-forensics.md)
or open [the static visual report](index.html) from a local copy. GitHub renders the
Markdown report and its SVGs; it does not execute the HTML file as a website.

## Evidence map

| Artifact | Meaning |
|---|---|
| `benchmark.json` | Final 30-pair measurements, all child exits, five no-op controls and nine integrity cases |
| `graphs/analysis.json` | Derived PR cohorts, job arithmetic and benchmark summaries |
| `graphs/*.svg`, `attribution.svg` | Final plots and an explicitly scoped attribution diagram |
| `github-focused/` | Completed collection: 475 PRs, 159 tests/PR runs, 110 latest-attempt jobs in 20 selected runs |
| `github/pulls.json` | Partial output from the failed broader collection; not a full Actions census |
| `pilot-benchmark.json`, `pilot-graphs/` | Windows-import pilot, excluded from final comparison |
| `pilot-timeout-supervisor-benchmark.json`, `pilot-timeout-graphs/` | Same-filesystem pilot with the external timeout floor, also excluded |
| `timeout-noop.log` | Five external timeout no-op observations, 105–108 ms |
| `raw-audit.tar.gz` | Byte-faithful first two measurement receipts, their executed controller/source and collector evidence |
| `raw-audit-v2.tar.gz` | Byte-faithful final measurements, final executed controller/source, unchanged Python comparator, retained native recovery runner and signer, and the small public law fixture |
| `input-digests.json` | SHA-256 in base64url for input files, launch binaries, source archive and snapshot manifests |
| `package-digests.json` | SHA-256 in base64url for this published package and tool sources; excludes itself |
| `execution.json`, `attempts.json` | Host/resource settings, exact outcomes, failed attempts and corrections |
| `final-benchmark-isolation.log` | Live final-process network namespace and routing observations |
| `session-audit.json` | One private local trace snapshot summarized without exporting its messages |
| `final-tests.log`, `final-clippy.log` | Five passing controls including the 30-second deadline, and warning-free Clippy |
| `cargo-audit.json` | No reported advisories/warnings against the freshly downloaded, pinned RustSec database; yanked-crate check not run |

Published benchmark JSON adds a `PUBLIC-CONSTANT` marker and is compactly serialized
for the repository's scanner. Original JSON bytes remain in the archives. Published text uses LF endings; log copies trim trailing whitespace and empty end lines to meet the repository diff check. Exact pre-normalization log bytes are retained in `raw-public-logs.tar.gz`. The raw
archives deliberately exclude the private conversation, credentials, the Cargo API
cache and unrelated files. The reproducible corpus is 512 files of 65,536 bytes,
where each file's byte at index i is i modulo 251; the generator is retained.

## Commands and outcomes

All commands below use the standalone Rust crate. Compilation was one job at nice
15, using the retained vendor directory via a private Cargo configuration. Preparation
and public API/advisory downloads are separate from isolated measurement.

```text
cargo build --offline --locked --release -j 1                         exit 0
cargo fmt --check                                                    exit 0
cargo test --offline --locked -j 1                                    exit 0; 5 passed
cargo clippy --offline --locked -j 1 -- -D warnings                    exit 0
build-forensics collect NEW_OUTPUT                                   exit 0; focused collection
build-forensics benchmark NEW_OUTPUT PYTHON RUNNER BSIGNER SOURCE     exit 0; final measurement
build-forensics analyze github-focused benchmark.json NEW_GRAPHS      exit 0
build-forensics session-audit LOCAL_TRACE summary.json                exit 0
cargo audit --no-fetch --no-yanked --format json --db DB -f Cargo.lock exit 0
```

The first broad collection failed with `single day exceeds GitHub 1000 search
bound`; it is not counted as a successful census. `attempts.json` records other
launch, lint, formatting-context and instrumentation failures. No skipped or failed
measurement is converted into a pass. Final timings contain 120 successful measured
invocations, 12 successful warmups and five successful no-op controls. Eighteen
additional integrity invocations have the explicitly expected clean/mutation results;
two preserved-Python mutation acceptances are findings, not passing controls.

The final benchmark used these Linux arguments (paths can be relocated together):

```sh
timeout --signal=TERM --kill-after=5s 8m nice -n 15 \
  bwrap --die-with-parent --unshare-net --ro-bind / / \
  --bind "$AUDIT_ROOT" "$AUDIT_ROOT" --dev /dev --proc /proc --tmpfs /tmp -- \
  "$AUDIT_ROOT/final-measurer.bin" benchmark \
  "$AUDIT_ROOT/benchmark-native-supervision" \
  "$AUDIT_ROOT/comparators/bsigner.py" \
  "$RECOVERY_RUST/snapshot/runner" \
  "$RECOVERY_ORIGINAL/run-1/target/release/bsigner" \
  "$RECOVERY_ORIGINAL/snapshot/source"
```

`AUDIT_ROOT` was `/home/travi/build-forensics-2026-10-29`. The two recovery roots
were `/home/travi/bsigner-recovery-rust-2026-10-29` and
`/home/travi/bsigner-recovery-2026-10-29`. The outer timeout is outside the timed
invocations; the final Rust driver directly supervises each child with 1 ms polling
and a 30-second deadline. No-op observations are 1.38–1.88 ms and are not subtracted.
The published archive also supplies the required public law files and executables
for replay without obtaining the full original source archive again.

This isolation prevents network access; it is not a claim that every host file is
hidden. The host is read-only and the dedicated output directory is writable.
Inputs are public and source-pinned. The final namespace was inspected while its
process was running; only loopback and no external route were present. Process-name
checks found no active SDK timing/compiler match; an exclusive host reservation
and peak RAM measurement were not available.

The benchmark source in the v2 archive is the source actually compiled for the
measurement. The published source additionally includes the real deadline test
added afterward; active measurement/analysis logic is unchanged. The initial
collector binary is retained for attribution, but its initial source was not
separately snapshotted before a lint-only edit. Its failed broad workflow census
is never used as final evidence. The successful focused collector's exact source
and binary are both retained in the first archive.

The RustSec database was downloaded during preparation, then audited without fetch:
`ee1a49a2769a24a596afc1c20cb33748d2769586`, dated October 29 at 15:05:38 +01:00,
1,386 advisories. The lockfile contains 53 package entries (the local package plus
52 dependencies). Zero reported advisories is not a proof of security. Yanked
registry status was explicitly not checked. The previous retained-database scan
is kept separately as `cargo-audit-retained-db.json`.

## Scope and preservation

Public-history cutoff: October 30, 2026, 05:03:43 UTC. PR creation filter starts
July 4; the earliest returned PR is September 7. Workflow enumeration is limited
to `tests.yml` PR events October 15–29; historical case runs are additional. All
job attempts in the selected collection are attempt 1. Historical job logs may
expire; public step metadata and retained source-bound receipts are distinct.

No original recovery source, Python file, snapshot, raw log, independent reference
or PR #496 commit was erased or rewritten. No full recovery build, merge or
production rollout was performed in this audit. Original evidence remains at its
existing recovery roots and in PR #496. The private trace prefix matching the
published summary is retained locally as `audited-trace-prefix.jsonl` under the
audit root; it is intentionally absent from GitHub.

The tool needs Linux process groups and bubblewrap for this measurement recipe,
Rust 1.98.1 for compilation, the pinned Cargo dependencies, Python 3.14.4 and Node
22.22.1 only for historical comparisons, and the retained native signer/controller.
Collection needs `gh` and public network access; replay and analysis do not.
Compiler and benchmark outputs use dedicated directories; no shared target,
owner worktree, custody operation, key, payment or production state is involved.
