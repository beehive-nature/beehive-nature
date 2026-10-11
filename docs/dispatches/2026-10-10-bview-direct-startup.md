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
Focused corrected cancellation/failure/quota checks passed 3/3; the added
dry-player pressure check passed 1/1. Full current focused results and the
corrected public-network result are pending at this candidate checkpoint.

The public candidate rerun and release verification will be appended before
claiming public acceptance. Faster startup does not erase network rebuffering;
the receipt retains startup, stalls, transfer completion and playback end.

## Scaling and the ZK question

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

Candidate work. Public acceptance and deployment are pending.
