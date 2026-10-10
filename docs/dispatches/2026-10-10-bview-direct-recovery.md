# bView direct recovery: fewer reads, complete public playback

Continuation of `2026-10-09-bview-bounded-recovery.md`. PR #381 merged the
bounded retry and receipt repair as `e26062a40`. Its post-merge static checks
passed, while Pages and the remaining CI jobs were still queued at this follow-up.
No old hosted bytes were passed off as the repaired deployment.

## Decision and acceptance

The pinned public video is 54903201 bytes and 231.340408 seconds. A three-lane
candidate on the public origin retrieved all fourteen application chunks directly,
matched the publisher's SHA-256 and played to its actual end. No relay request and
no page error occurred. First frame: 39.655 s; receipt observed full retrieval:
76.101 s; observed playback end: 306.188 s. One engine stall totalled 22.4 ms.

This is an independent public sample, not Shu's original corpus and not a
controlled causal benchmark. The earlier six-lane direct-only failures are
retained, as is a successful six-lane automatic-relay run. Network conditions and
host load changed between runs. These observations support a conservative beta
choice, not a claim that three lanes always outperform six.

The default application read concurrency is now three. Its two-round look-ahead
ceiling falls from twelve chunks to six (about 48 MiB to 24 MiB). This is an
application queue bound, not total browser memory or a peer connection cap.
Per-chunk attempts, aggregate retry cap, stop/fallback rules and ordered-wait
deadlines remain as in #381. No SDK dial cap was raised.

The final three-lane fault suite passed 18/18 in 86173.2263 ms, including recovery
of two failures at chunk 16 of a 52-chunk file, whole-file digest equality, no
overlapping same-range reads, a maximum of three active reads, six queued chunks,
exhausted retries, cancellation, late arrivals and direct-only isolation.

The live runner also records progress while running and requires the final
playhead to reach the reported duration. Capture truncation is explicit when the
256-chunk observation bound is exceeded; its privacy probe passed.

## Preserved evidence

- `evidence/2026-10-10-bview-recovery/direct-candidate.json`: complete real direct
  playback, served candidate HTML digest, Chrome version and the full allowlisted
  capture (chunk attempts, delivery states, timings and transport counters).
- `evidence/2026-10-10-bview-recovery/direct-tests.log`: final three-lane suite.
- `evidence/2026-10-09-bview-recovery/candidate-live.json`: successful real relay
  fallback through playback ending, matching bytes, 44.828 s first frame,
  51.485 s observed complete retrieval, 278.062 s observed playback end.
- The same October 9 directory retains the direct-only failures, initial mobile
  candidate, original six-lane test receipt and three-register conformance report.

Full CI is not claimed green. Duplicate/superseded workflows for this lane were
cancelled, as were unchanged proof workflows on the #381 merge to keep capacity
for deployment, secret scanning and product checks. Two superseded owned runs
continued `always()` steps after normal cancellation and were then terminated
through the Actions cancellation API. No other lane's run was cancelled.

Network-level repair, physical mobile validation, a reproduced Benchmark 003
result and a stable performance distribution remain unestablished. The delivered
repair is bounded client recovery with inspectable measurements.
