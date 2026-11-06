# Rust build forensics

This standalone tool collects public repository metadata, measures two retained
controller implementations, and emits JSON and static SVG graphs. The offline
analysis and measurement commands require no GitHub account or hosted service.
Collection uses the operator's existing `gh` authentication without reading or
printing credentials. This is an audit tool, not a signing or custody service.

## Reproduce

Use Rust 1.98.1 and the committed Cargo.lock. Prepare dependency downloads before
disconnecting. The executed build reused the recovery snapshot's vendor directory;
no new dependencies were downloaded during compilation. Set a private CARGO_HOME
with Cargo source replacement pointing to that directory and an isolated target
directory. The lock resolves 52 dependency packages, including target-specific
packages; only the host-applicable subset is compiled.

```text
cargo build --offline --locked --release -j 1
cargo test --offline --locked -j 1
cargo clippy --offline --locked -j 1 -- -D warnings
build-forensics collect NEW_DATA_DIRECTORY
build-forensics benchmark NEW_RUN_DIRECTORY HISTORICAL_BSIGNER_PY NATIVE_RECOVERY_RUNNER BSIGNER RETAINED_SOURCE
build-forensics analyze DATA_DIRECTORY BENCHMARK_JSON NEW_GRAPH_DIRECTORY
build-forensics session-audit LOCAL_TRACE OUTPUT_JSON
```

`GH_BIN` selects a local GitHub CLI binary. Collection has a fixed analytical
cutoff, 2026-10-30 05:03:43 UTC. It paginates PRs created July 4 through the cutoff. Workflow enumeration covers tests.yml pull-request events on October 15–29, with documented historical cases fetched separately. It splits workflow date intervals
below GitHub's 1,000-search-result limit, checks returned counts, and records
coverage. Use a fresh empty FORENSICS_API_CACHE directory per collection; cached replies allow retry within that collection and must not be reused for a fresh observation. Interval checkpoints preserve partial progress. It collects latest-attempt jobs for documented cases and the earliest
retained `tests` pull-request run on each available day October 15–29. Selection
uses creation time, before seeing a job's delay or outcome. Deleted history,
earlier attempts and missing logs remain missing.

The benchmark is Linux-only. It creates 512 public deterministic 64 KiB files,
uses the original Python verification function without modifying it, and compares
it with the retained Rust recovery executable. The second workload compares the
original shell/Node law-signature controller with the retained Rust controller;
both invoke the identical Rust bSigner executable on the same seven public laws.
Each implementation receives three warmups followed by 30 randomized-order pairs.
The tool records all exit codes and raw timings; any nonzero timed exit aborts.
Each child has a 30-second deadline supervised in Rust, with a separate process group terminated on expiry. Completion is polled at 1 ms intervals; five no-op controls measure the instrumentation floor. Run the whole tool
under an outer timeout and an isolated network namespace, with no SDK timings or
heavy builds active. No complete reconstruction is performed.

Statistics use arithmetic means, paired differences, 10,000 paired bootstrap
resamples and a two-sided Monte Carlo sign-flip test with the plus-one correction.
The seed is fixed for repeatability. Timings include startup and the Rust polling overhead; no-op measurements are reported and are not subtracted. Confidence intervals describe repeated local
execution, not independent machines or populations of programs. Sequential pairs
may share host/cache effects. Apply a two-comparison correction when interpreting
the two p-values. No blanket language/security ranking follows from these tests.

The nine integrity controls are deterministic cases, not a statistical estimate of
vulnerability prevalence. Rust checks an independent manifest anchor and optional
mode bits absent from the preserved Python implementation. Manifest-mutation cases
can stop at that anchor and do not independently exercise all parser defenses.

SVG graphs have a linear zero baseline, explicit units and standalone labels.
They are generated directly by Rust and require no plotting runtime or script.
PR open-to-merge duration is calendar time, not CI time. Workflow-to-first-job delay
includes scheduling; later intervals can contain additional waiting. Summed job
time is resource occupancy, not wall-clock delay or a bill.

The optional session audit emits only counts, timestamps, opaque call IDs and a
digest. It searches three explicit groups of rejection/rate-limit strings in tool
outputs of a single local conversation. It cannot establish the absence of other
refusal formats, delays elsewhere, or provider intent. Keep the raw trace local.

## Evidence boundaries

The original Python files remain preserved in PR #496, under
`tools/build-recovery/evidence/python-25c0a2f/`. The historical snapshot, source
archive, raw reconstruction logs and independent integrity references are neither
deleted nor rewritten. This lane changes only its own tool, receipt directory
and dispatch. Repository-wide language migration, provider-free development
infrastructure, 10 billion active humans and millennium continuity are separate
acceptance gates; this audit does not mark them complete.
