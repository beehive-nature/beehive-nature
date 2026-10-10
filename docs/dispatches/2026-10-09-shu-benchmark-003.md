# Shu Benchmark 003: intake and measurement gaps

Received October 9 (America/Denver). Base: origin/main `235d0f030` after fetch.
This lane records the founder's assessment and Shu's subsequent mobile/SDK note;
it does not reproduce the live benchmark or certify bTunGsTeN conformance.

## Delivered

- `tools/video-trial/shu-benchmark-003.json`: all nine supplied playback rows,
  large-file transport counts, aggregate receive ratios, provenance, unknowns,
  and the mobile/cap/architecture follow-up. Incomplete completion time is null.
- `tools/video-trial/benchmark-003.md`: source-grounded diagnosis and ordered
  startup, chunk recovery, bounded scheduling and separate network-repair arms,
  including emulated versus physical mobile cohorts.
- `tools/video-trial/capture.js`: additive allowlisted numeric timing, total-chunk,
  lane/budget and direct-only fields. Existing receipt schema remains compatible.

## Findings and limits

`surfaces/bview.html:tryDirect` currently has six application read lanes, bounded
look-ahead, and the previous next-in-order watchdog fix. First application read
failure aborts; direct-only stops on failure. There is no new application retry
implementation in this change. The supplied 16/52 observation does not identify
the missing chunk or the tested commit. Root cause remains UNVERIFIED.

`readBinaryStream`, `paintBlob`, and `setBlob` use progressive Blob playback.
No MediaSource or service-worker registration was found in the player source;
origin-wide worker state and Shu's tested build remain unverified. The other
sites' architecture is reported only. A JavaScript search of vendored SDK 0.1.2
did not locate a 500-dial cap; a lower-layer cap is still a hypothesis. No cap
or concurrency setting was changed. No live public product deployment is claimed.

## Upstream priority checked live

- [David's #622 routing correction](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
  sends the remaining work back to #504; the older standing handoff is stale.
- [Latest #504 instruction](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
  calls for per-kind counters and same-workload delivered/published evidence;
  default policy remains ObserveOnly per that comment. No x0x runtime claim here.
- [#505 field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210)
  closes the fragmentation half on field evidence, with legacy-peer residual risk.
No upstream message was sent by this lane.

## Validation

`node --check tools/video-trial/capture.js` and `git diff --check` passed.
A Node VM probe verified added timings/counts, absent values remaining null,
16 completed versus 10 emitted remaining distinct, and excluded private sentinel
fields. JSON inspection verified nine observations and null incomplete timing.
No new test suite or playback/network run was introduced for this capture-only
change. The raw corpus/build pins needed for a faithful rerun were not supplied.

Hook installation returned: `install-hooks: REFUSING - .../.githooks/pre-commit
exists and was not written by this installer. Inspect it, remove it, then re-run.`
Inspection found an existing configured hook running `scripts/secret-scan.sh`
and `scripts/identity-check.sh`. It was preserved, not replaced or bypassed.
The independent `e2e/hooks-installed.test.sh` contract was run separately.
