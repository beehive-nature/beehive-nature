# ANT WebRTC observation and NixOS comparison

Work is isolated on `codex/ant-bnrose-observation`, based on
`eb408fa8b6af72462328055c147d0995318a7332`. x0x PR #4 remains open and unmerged.
The invitation repair, dependency audit and Oracle capacity constraint remain
separate lanes.

The new `tools/ant-bnrose/` experiment invokes the existing Rust
`bnrose-exec-core` through its import-free WASM adapter after the unchanged
Autonomi SDK download and independent expected-content hash verification.
It grants no routing, execution, wallet, payment or DAO authority.

Initial validation on Hostinger NixOS 26.05:

- Rust 1.95.0 compiled the existing three crates to `wasm32-unknown-unknown`.
  Two inherited warnings remain (`unused_mut` and unused `put_u16`).
- Five Node tests against the actual WASM passed: opt-out, tampering,
  failed transport/cancellation, out-of-order completion and policy snapshot.
- Initial browser launch exposed a relative fixture URL error, corrected
  before the matrix. This failed pilot will be retained.
- A single-file pilot proved a cold direct WebRTC read but subsequent reads
  were SDK cache hits. The final harness uses three different public fixtures.
- The four-concurrent shadow churn pilot completed eight verified reads, all
  eight admitted by the Rust observer. Four pending reads were cancelled
  after 5,605 sent DataChannel bytes with 26 connected associations; a fresh
  client recovered all four audio reads. This is local association withdrawal,
  not remote storage-server loss.

The first complete matrix at source `94b524a760a08ceb0f4e9719d0dfe3e35b39987c`
used Rust 1.95.0. All 24 receipts are retained under
`docs/receipts/ant-bnrose-2026-10-20/` with prefix `matrix94b524a76`:
150 verified deliveries, 30 deliberate cancellations, zero unexpected read
failures, 12/12 active withdrawal interventions and 12/12 full recovery.
Every one of the 60 normal phases had received DataChannel bytes and a selected
direct UDP path. All 75 successful shadow reads reached the Rust observer.
Median observation time was 0.200 ms, p95 1.700 ms, maximum 2.100 ms.

| Concurrent reads | Condition | Median paired change in normal read-batch time |
| --- | --- | ---: |
| 1 | steady | +0.79% |
| 1 | withdrawal/reconnect | +10.94% |
| 4 | steady | -2.68% |
| 4 | withdrawal/reconnect | -14.34% |

These are three pairs per cell. Network variability is much larger than the
observer's own time; these mixed results do not establish a speed improvement.
This is the unchanged Rust ANT SDK in both arms, with optional Rust BNRoSe WASM
admission. It is not a Rust-versus-JavaScript implementation comparison.

The first controller launch lacked a systemd PATH and started no trials.
During the working run, SSH disconnected after the twentieth trial; all
receipts survived. Only the four unexecuted cells were resumed, in the
original order. The final launcher keeps output in the journal to survive SSH
disconnection.

The canonical repository toolchain is Rust 1.98.1. The build now reads that
pin directly; the 1.95.0 sweep remains separately labelled. The 1.98.1 WASM
build passed, along with eight offline JavaScript/WASM boundary and receipt
checks and seven native Rust tests on NixOS. Inherited Rust warnings remain:
`unused_mut`, unused `put_u16`, and an unused test variable `n`.
The final paired matrix using 1.98.1 is pending at this checkpoint.
