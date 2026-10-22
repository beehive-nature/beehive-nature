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

## Final acceptance follow-up

PR #382 merged as `cffb14831`. Inspection of the raw timeline separates the
39.655-second decoded preview from the first moving, unpaused playhead around
74 seconds. The live runner now reports that latter observation separately,
relative to its play mark. Capture also retains video dimensions, duration,
source changes, and current-source total/dropped frame counters; frame counters
are not cumulative across source replacements. A sentinel probe confirmed these
numeric fields survive and private identifiers remain excluded.

The combined parallel browser run passed 39/40 in 122194.6851 ms. Its slow-relay
countdown predicted 14 seconds and started after 8.8 seconds, outside its
tolerance. Isolated baseline and release probes both passed 4/4: predicted
9 seconds, observed 8.5 seconds, complete playback and longest pause below
165 ms. The relay estimator was unchanged by this repair. CI now runs these
browser suites sequentially so the 214 MB fault fixture does not compete with
the paced relay's wall-clock assertions. Sequential execution alone also failed
(15 seconds predicted, 8.7 observed), so it is not claimed as the repair. Both
failed results are retained.

A deterministic one-second pause during the first preview reproduced the actual
defect: the estimate said 53 seconds, while playback started after 9.1 seconds.
The serial stream consumer includes that local preview pause in its short
delivery windows. Resetting only the last-chunk interval still failed (53 versus
9.2 seconds). Restarting both short windows fixed that case but delayed fast
startup (868352 of 1187514 bytes, beyond the existing 40% threshold). The final
correction subtracts the measured local preview duration from the short-window
clocks instead of discarding the established rate. The conservative first-byte
average is preserved. A stale preview cannot
change the next video's rate clock. The paced playback regression now exercises
both normal preview processing and the injected one-second pause, retaining all
buffer-threshold, countdown, complete-playback and no-freeze assertions.

Final focused compensation run: 7/7 passed in 93250.893 ms. Normal slow playback
predicted 9 seconds and took 8.9 seconds. Fast playback started at 288 KiB of
1160 KiB. The mid-play slowdown showed its wait immediately, predicted 12 seconds,
and resumed after 12.0 seconds. `preview-window-compensation.log` retains the
complete focused result. The final full suite and deployed measurements follow.

Initial narrow filtered probes were cancelled by Node with "Promise resolution
is still pending but the event loop has already resolved" before exercising
the player. Including the suite's initial personal-video cases kept its setup
alive for both valid baseline/release probes above.

PR #383 merged as `37dca585a`. The final sequential browser, recovery and scorecard
run passed **41/41**, with no skipped tests, in 243186.8141 ms; see
`release-acceptance.log`. Its PR static checks and secret scanning passed.
Superseded tests for this lane were cancelled in favor of the final main run;
the unchanged proof workflows were also cancelled as described above. Full
repository CI is reported separately from the completed bView checks.

The browser CI step's former three-minute limit was inherited from the smaller
parallel suite. The measured sequential 41-test run takes 243.2 seconds here,
so its step budget is now six minutes. This changes the job allowance, not any
player timeout or test assertion. No repeat of unchanged tests was needed to
establish that 243.2 seconds exceeds a 180-second job budget.

## Published acceptance

[bView](https://skaists.dev/surfaces/bview.html) served exactly the merged
`37dca585a` source. Pages run `38031144249` succeeded. The public HTML SHA-256 is
`7d3792cbc06040a50e91cb01662f9d1eaa2ae3cca7daac2cf0861db037cb6276`. <!-- PUBLIC-CONSTANT -->
The byte-comparison receipt is `deployment.json`.

At 2026-10-10 06:40:20 UTC, fresh Chrome 153.0.8010.53 on the deployed public
page completed the pinned video through direct-only retrieval. The published
file hash matched, all fourteen application chunks were emitted, and the video
reached its actual 231.340408-second end. No relay request or page error occurred.
`direct-deployed.json` preserves all 1105 sampled observations and fourteen chunk
timelines; samples use actual timestamps and are not assumed evenly spaced.

| Observation | Deployed direct run |
| --- | ---: |
| File size | 54903201 bytes |
| First observed open channel, relative to play mark | 4.405 s |
| Connect wait / file-open wait | 4.381 / 15.780 s |
| First useful read / first ordered byte | 26.386 / 45.691 s |
| First decoded preview | 46.246 s |
| First observed advancing, unpaused playhead | 69.403 s |
| Full retrieval observed | 84.623 s |
| Playback end observed | 301.343 s |
| Playback stalls | 1 / 4.1 ms |
| Application reads / retries | 14 / 0 |
| Peak queued application bytes | 16760832 |
| Data-channel received payload | 90483236 bytes / 1.648 times file size |
| Dials / opened / closed after opening / failed before open | 200 / 106 / 64 / 94 |
| Sampled peak open channels | 45 |
| Settled endpoints reachable / unreachable | 94 / 92 |
| Failed dial stages: before ICE / before DTLS / before channel | 93 / 1 / 0 |
| Dial-to-open p50 / p95 | 4.077 / 12.921 s |
| Source changes | 3 |
| Final-source frames / dropped | 2260 / 0 |

The payload ratio excludes transport framing and does not establish duplicate
plaintext. Closed-after-open does not prove a graceful close or useful delivery.
Sampled peaks can miss brief connections. Frame counters describe the
current media source. These are measurements of one run, not a comparison with
Shu's unknown corpus, a latency guarantee, or proof of network-level healing.

The same deployed source also passed Chromium Pixel 7 emulation at 412 px:
52/52 chunks, two injected failures recovered, one recovered chunk, verified
whole-file hash, zero relay/page errors, and viewport equal to scroll width.
`mobile-deployed.json` records the served digest and explicitly labels its mocked
network and nonphysical device. This establishes the browser recovery path under
the injected failures; the real network run above did not encounter a read retry.

Post-merge main build/test, static, formal and secret-scan checks passed. The
remaining broad browser/meter/wallet jobs were still running while final receipts
were saved. The receipt and CI-budget follow-up changes no published player code.
