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

The paired 24-trial matrix and final analysis are pending at this source
checkpoint. No speed improvement or large-scale capacity result is claimed.
The full run will retain network failures and deliberate cancellations.
