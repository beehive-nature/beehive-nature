# bView direct startup, real cache reuse and bounded media buffering

This lane addresses the original 214,091,829-byte Autonomi video in
`tools/video-trial/corpus-2026-10-10.json`. The earlier 434.309-second actual
startup is retained in the previous scale dispatch. Billion-viewer capacity
remains **UNVERIFIED**.

## Diagnosis and changes

The previous file player intentionally waited until estimated remaining
download time fitted inside remaining playback time. The original video is
52.488 seconds at about 32.6 Mb/s; observed delivery was much slower.
A fresh baseline reproduced **380.340 s actual startup**, **53.627 s first
bytes**, **55.753 s preview**, **21.155 s subsequent stalls**, and completion
at **455.769 s**. All 52 chunks and the expected whole-file hash matched.
This is another observation under variable network conditions, not a controlled
comparison with the earlier 434-second result.

Direct fast-start MP4 now feeds original samples into one MSE source using
locally pinned MP4Box.js 2.4.1. It does not transcode, create a service worker,
change the SDK, or involve a chain. Unsupported layouts/codecs retain the file
player. Original bytes remain available for integrity, caching and recovery.
An append/decoder failure finishes from those retained bytes without another
download. Seeking before evicted MSE history uses that same file, waiting for
completion if it has not arrived yet.

Forward targets are 20 seconds and 24 MiB, with ten seconds of history.
Original-file retention, SDK buffers, ordered chunks, hashing and decoded frames
are additional memory. Arriving chunks can overshoot: the actual-content local
test observed 31,932,374 bytes of estimated compressed forward data.
A quota failure gets one retry after freeing older history and reducing the
byte target. Backpressure is suspended when the player is dry, so it cannot
block the bytes needed to resume. Pause and cancellation stop consumption.

The old `ant-bview://` Cache API key was rejected by the browser and its error
was swallowed. The key is now a virtual same-origin HTTPS URL; it is never
fetched. A warm reload checks the cache before connecting or resolving the
public file. Whole-file hashing no longer delays warm first playback. The
immutable Blob replaces duplicate original-byte arrays after download.

## Evidence and acceptance

Evidence directory: `evidence/2026-10-10-bview-direct-startup/`.

- `baseline.json`: fresh public original-video baseline, old player plus the
  cache-key correction, zero relay requests and page errors, matching hash.
- `local-original.json`: exact original content over local mock reads,
  **1.573 s startup**, **zero stalls**, one source through full playback,
  eviction exercised, backward seek recovered without another read, and
  **0.303 s warm startup with zero connections and reads after reload**.
  Includes a deliberate 1.5-second user pause. It is not network throughput.
- `local-original-initial.json`: earlier unthrottled original-content run,
  1.673 s startup, zero stalls, one source, 3147 frames / six dropped, and
  0.818 s replay. Its forward-byte counter preceded the final ended-event fix.

Development failures were kept visible: time-only buffering reached
`QuotaExceededError`; the first fallback left playback paused; and public
delivery exposed backpressure preventing a dry player from receiving more
data. The byte budget, retained-file recovery, and dry-player exemption address
those defects. The initial combined regression run was 42/44: its cancellation
wait still expected a failure message after a true page cancellation, and its
quota case still expected fallback after the newly successful bounded retry.
Focused corrected cancellation/failure/quota checks passed 3/3. The current
direct/MSE/capture suite passed **27/27** in 174.426 seconds; the relay/storage
portion of the earlier combined run passed all 19 cases. Adaptive playback
regressions passed **4/4** in 90.222 seconds. Those checks preceded the corrected
public-network acceptance recorded below.

The failed public candidate is preserved as `candidate-dry-buffer-failure.json`:
50.779 s actual start, then stalled at 36.574 s of media; only 24 chunks were
emitted although 30 had arrived. There was no pending head read: backpressure
was blocking consumption. It timed out at 604.607 s, without complete-file
integrity or playback acceptance. Its browser still reported 2.623 seconds
buffered. The fix listens to native `waiting`/`playing`, because buffer duration
or HAVE_FUTURE_DATA alone cannot establish that the player is actually moving.
A separate regression recreates native waiting with three seconds buffered and
requires consumption to resume. The corrected public run pins all loaded
remuxer/runtime asset digests as well as the HTML digest.

The corrected public-network candidate completed at 01:45:58 UTC on October 11
(October 10 locally). Its HTML and four loaded remuxer/runtime digests match
the committed candidate exactly. `candidate.json` retains the raw observation:

| Observation | Fresh old player | Corrected MSE candidate |
| --- | ---: | ---: |
| First ordered media bytes | 53.627 s | 45.179 s |
| First decoded frame | 55.753 s | 48.725 s |
| Actual playback start | 380.340 s | 49.031 s |
| Rebuffering after start | 21.155 s | 298.169 s |
| Complete-file hash observed | 446.573 s | 406.016 s |
| Playback end observed | 455.769 s | 407.043 s |

All 52 chunks matched the expected original hash; one media source, zero MSE
errors/fallbacks/quota retries, zero relay requests and page errors. The browser
reported 3147 frames / 35 dropped. There were eight native stalls and no
application holds. Warm reload: **0.319 s actual startup**, matching hash,
**zero SDK requests, relay requests and WebRTC dials**.

This fixes the deliberate near-whole-file startup wait, but much of that wait
now appears as honest rebuffering. It is **not** smooth playback on this path.
The 87.1% startup difference and 10.7% observed end-time difference against the
fresh baseline are descriptive, not controlled treatment effects: network
conditions varied and local browser checks overlapped parts of the observations.

Transport: 1133 dials, 685 opened, 447 dead (445 before ICE, two after ICE),
339/763 endpoints reachable, 48 peak sampled open channels, 4.406 s median /
11.817 s p95 dial-open time. Data-channel payload was 382,559,489 bytes,
**1.787 times the original file size**; this excludes lower-layer framing.
Ordered-read queue peaked at 25,141,248 bytes. MSE fragment queue peaked at
7,709,059 bytes, estimated forward media at 41,386,611 bytes, and sampled parser
sample allocation at 4,369,734 bytes. Dry-player progress takes precedence over
the forward target; none of these figures is a total-memory measurement.

After the native-wait correction, all six MSE cases and four mobile-width front
checks passed **10/10** in 96.707 seconds. All three register conformance scores
remain 100%; estate registration passes. Deployed-site acceptance is still
pending at this checkpoint.

## Scaling and the ZK question

The same hash-verified original was encoded locally by the existing
`tools/video-trial/package-hls.mjs`, using 30 fps H264/AAC and four-second
segments. These derivatives reduce resolution and frame rate; visual-quality
equivalence is not claimed. `original-adaptive-package.json` binds their bytes
and hashes; `original-hls-700.json` binds playback to the original content hash.

| Rendition | Media bytes | Average Mb/s | Reduction from original bytes |
| --- | ---: | ---: | ---: |
| 374 x 240 | 2,475,154 | 0.377 | 98.84% |
| 560 x 360 | 3,797,466 | 0.579 | 98.23% |
| 1120 x 720 | 9,077,374 | 1.383 | 95.76% |
| 1680 x 1080 | 16,540,534 | 2.520 | 92.27% |

One local Chrome viewer with Pixel 7 emulation and segment bodies paced at
700 kb/s completed the 240p rendition: **2.743 s actual startup, zero stalls**,
2,475,154 media bytes, one MSE source, zero errors and exact hashes for every
requested asset. Peak concurrent media requests was one. This is neither a
physical phone nor a public-network capacity test. The measurement script is
preserved beside the receipt. Derivatives have not been uploaded; the immutable
Autonomi address still selects the original file.

At one billion concurrent viewers, even this 240p average implies about
377 Tb/s of viewer-facing payload, before overhead. The 1080p rendition implies
2.52 Pb/s. These are arithmetic planning figures, not measured fleet capacity.
Distributed delivery, shared immutable caches and prepackaged renditions remain
necessary; a faster player alone cannot supply that bandwidth.

Cache hits now remove an entire reader/discovery operation from repeat views.
Cold direct delivery retains three application lanes, ordered buffering and
the existing bounded retry policy. The SDK's read abort wrapper only rejects
its caller while observing the underlying promise (`file-reader.js:read`,
`internal/abort.js:abortable`); this lane does not add speculative timeout
retries that could duplicate still-running raw reads.

The current `tools/solana-tungsten/src/lib.rs:Worker::prove` and
`lab/square.circom:SquareJob` prove an arithmetic job. `LocalGate::plan` checks
authorization and replay separately. That is useful groundwork for a future
asynchronous settlement system, not proof of video delivery or watched frames.
Any service-accounting circuit needs explicit authenticated observations and
content/rendition binding. Keep proofs and chain finality off playback's critical
path. `tools/video-trial/SCALING.md` records this boundary and the repeatable
measurement commands.

Upstream priority was checked: dirvine's current x0x efficiency requests remain
about delivered-versus-published and per-kind field measurements. No x0x
acceptance, SDK-wide 500 cap, physical mobile, production settlement, CDN fleet,
or distributed audience result is inferred here. No upstream message was sent.

MP4Box's runtime and license are verbatim from the integrity-checked npm package;
`vendor/mp4box/2.4.1/VENDOR.md` records every file digest and license.

## Release status

PR [#394](https://github.com/beehive-nature/beehive-nature/pull/394).
All seven jobs in the source commit's
[tests workflow](https://github.com/beehive-nature/beehive-nature/actions/runs/38102668741)
completed successfully: formal, static, test, node, wallet, meter and eternal.
`source-ci.json` records the exact tested commit and step results. Subsequent
receipt/document edits do not change runtime or test bytes. Own duplicate and
superseded workflow runs were cancelled; those are not reported as passes.
Public-network candidate acceptance is complete. Deployed-site acceptance is
pending at this checkpoint.
