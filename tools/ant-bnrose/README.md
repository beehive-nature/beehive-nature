# Opt-in ANT WebRTC observation experiment

This harness compares the unchanged Autonomi browser SDK with and without a
local observation through the existing Rust `bnrose-exec-core`, compiled via
`bnrose-exec-wasm`. It is an experiment, not a production routing policy.
It does not combine ANT traffic with the separate x0x transport benchmark.

`verified-observer.mjs::createVerifiedDownloader` awaits the SDK download, checks
the receiver-selected expected size and SHA-256, and only then admits a bounded
local diagnostic envelope through `bnrose_admit`. It never invokes
`bnrose_step`, effects, a wallet, payment, upload, journal or governance.
The run label is random local metadata, not a key or peer identity.
Each completed read has its own observation; out-of-order completion does not
impose a replay watermark on independent downloads. Initialization requires an
import-free, ABI-compatible, locally selected module. A runtime diagnostic
refusal or exception cannot discard verified content. Opt-out does not
instantiate a kernel.

This diagnostic envelope is not a signed network announcement and conveys no
authority. DAO decisions, peer admission, transport authentication and content
acceptance remain with the existing owners. No external coordinator or service
is introduced.

## Bounded workload

The three public fixtures are hash-pinned from
<https://try.autonomi.com/featured.json>. Each phase reads a different file
(photo, PDF, audio), avoiding the SDK's hot file cache. Each operation verifies
the full plaintext against the independently published hash.

The matrix has three repeats, one or four concurrent downloads per phase,
steady or withdrawal/reconnect conditions, and both arms. Each trial starts a
fresh Chromium profile, SDK client and module. Trials run serially. The middle
repeat reverses arm order. Within a phase, concurrent reads target the same
file; SDK coalescing, repeated records and remote caches remain part of the
workload. This is not an independent-object saturation benchmark.

Churn closes only this browser's client and owned WebRTC associations while
phase-one reads are pending, after detecting sent DataChannel bytes (or a
two-second deadline). Phase two creates a fresh authenticated client. Receipts
record the actual pending count, sent bytes and connected count at withdrawal;
these must be positive before claiming an in-flight churn intervention.
This measures local association churn, not remote storage-node loss.

Both arms include the same passive connection/byte recorder, full content
verification and timeouts. Timings separate SDK read, plaintext verification,
diagnostic observation and wrapper preparation. Module loading/compilation and
browser startup are outside the read timer. Timer precision and small sample
size limit tiny overhead estimates.

## Reproduction on NixOS

`flake.nix` and `flake.lock` pin the runtime tools. `build-wasm.sh` copies the
three unchanged Rust crates and root lockfile into a minimal workspace under
`/var/lib/bnrose-ant-validation`; Cargo prunes the copied lock. Compare surviving
package versions/checksums with the original before attributing the build.
The checkout and its lockfile are not changed.
The compiler defaults to the checkout's exact `rust-toolchain.toml` version.
`BNROSE_RUST_TOOLCHAIN` is an explicit experimental override; label any such
result separately from the repository-pin run.

The runner expects:

- This checkout at `/var/lib/private/bnrose-ant-validation/source`, exposed by
  systemd's `StateDirectory` as `/var/lib/bnrose-ant-validation/source`.
- `kernel.wasm` built into this directory, ignored by Git.
- `/var/tmp/ant-observation-runtime-paths.txt` containing absolute `node=...`
  and `chromium=...` paths from the pinned Nix environment.
- A NixOS administrator launching `bash tools/ant-bnrose/launch-matrix.sh NAME`
  from the copied checkout. Use a new short alphanumeric/hyphen name.

`run-nixos.sh` runs every browser as a transient dynamic user with no
capabilities, no privilege escalation, a private temporary directory, a 2 GiB
memory ceiling and a 240-second deadline. Chromium's sandbox stays enabled.
The fixture server and debugging endpoint bind to loopback; no inbound firewall
rule or production service is changed. Normal outbound network access is
required to reach public peers.

The launcher keeps output in the system journal and survives an SSH disconnect.
Inspect it with `journalctl -u bnrose-ant-matrix-NAME`. Use a fresh name for a
new experiment. If a matrix is interrupted, preserve all completed receipts
and invoke `run-nixos.sh ARM LOAD CONDITION ORIGINAL_CELL_LABEL` only for cells
without a receipt. Neither runner overwrites existing results.

Run `node --test tools/ant-bnrose/*.test.mjs` after building the
module, or set `BNROSE_EXEC_WASM` to its absolute path. The tests use the real Rust WASM, including tampered bytes, failed
transport, cancellation, local opt-out, concurrent completion and policy
snapshotting. The existing `BNROSE-RUST-001` CI lane runs these offline checks
using its already-built module; CI does not run the public network workload.

Receipts are written once, with no SDP, peer addresses, certificates or keys.
Selected ICE candidate types and DataChannel byte counters establish observed
transport behavior; DTLS cipher names alone do not establish PQ security.
The existing SDK's PQ session and content verification must remain unchanged.
Network failures and deliberately cancelled reads must be retained separately
from verified deliveries, and zero-byte cached phases must not count as direct
network delivery.

`node tools/ant-bnrose/analyze.mjs RECEIPT_DIRECTORY MATRIX_PREFIX` requires all
24 receipts. Failed trials remain in the totals and disqualify paired timing.
So do hot-cache phases, relay-only paths, missing in-flight withdrawal and
refused observations. Synthetic interpretation tests verify these exclusions;
their timings are not benchmark evidence.

Batch time is the sum of the normal read phases, excluding the deliberately
cancelled phase. Connection time is reported separately. Each cell reports the
median of its three **paired percentage changes**, rather than treating a
ratio of pooled medians as a paired estimate. A positive change means shadow
was slower. All individual pairs remain available for inspection.

The October 20 report is
[`2026-10-20-ant-bnrose-observation.md`](../../docs/dispatches/2026-10-20-ant-bnrose-observation.md).
Its final 24 trials use the repository's Rust 1.98.1 pin; the earlier 1.95.0
sweep is retained separately. To redraw the paired-result figure, use
`python tools/ant-bnrose/plot-comparison.py comparison-rust198.json paired-rust198.png`
with Matplotlib installed (the committed figure used 3.11.2). Rendering does
not run the network benchmark.

## Allocation reduction and component isolation

`observation-request.mjs` pre-encodes each reader's immutable local policy.
Every completion still supplies a fresh sequence, timestamp and verified
content hash, then calls the same Rust admission function. Its independent
reference-encoder test compares every request byte, including nonce carries.
There is no cached admission verdict, skipped hash verification or network
policy change.

To isolate this local cost from public network discovery, extract
`tools/ant-bnrose/verified-observer.mjs` from parent commit
`1f351dcde2e4151495838cd4953c82f2f5338ddc` to the ignored
`tools/ant-bnrose/observer-before.mjs`, preserving the Git blob bytes.
Run `run-nixos.sh observer-cost 1 steady UNIQUE_LABEL` three times and analyze
all three receipts with `analyze-cost.mjs FILE1 FILE2 FILE3`. Each fresh
Chromium profile compares baseline, parent observer and optimized observer
using identical immutable local bytes, full SHA-256 and the real Rust WASM.
After 100 warmups per arm, 30 blocks of 250 reads alternate all six arm orders.
All admissions and sequences are checked; failures terminate the experiment.
These receipts isolate local processing cost and are not live delivery results.

`diagnose.mjs RECEIPT_DIRECTORY MATRIX_PREFIX` locates time in the live matrix:
normal phase wall time, slowest SDK read per phase, the residual, observer
time, network bytes and sandbox CPU. SDK time includes authenticated discovery,
reads and scheduling. This decomposition does not identify the remote cause
of variable network waits.
