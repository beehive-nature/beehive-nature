# bView delivery at large audiences

The billion-viewer figure is a design target, not measured or deployed capacity.
The static page, video delivery, storage discovery, publisher encoding and telemetry have separate budgets.
One browser or a local simulation cannot certify their combined capacity.

## Playback and publishing

bView accepts public Autonomi addresses as before. It also accepts an HTTPS URL whose path ends in `.m3u8`.
The latter uses the bundled hls.js 1.6.15 player with MSE and automatic bitrate selection.
An HLS link is a different delivery route: the playlist host and its segment hosts supply bytes.
It does not automatically convert or republish an existing Autonomi video, seed peers, or use the estate relay.
Remote playlist URLs are not added to the address-only saved-video list.

For the adaptive route, bView starts at the lowest rendition and limits quality by the player size and frame drops.
It targets 20 seconds ahead, 10 seconds behind, and 24 MiB of compressed buffered media.
These are player targets, not a hard bound on browser RAM: a segment may overshoot, and decoder, MSE and browser allocations are separate.
Seeking backward may retain already downloaded forward data beyond the forward target; it stops new fetching until the window catches up.
Pause stops fetching after playback has started. A new address destroys the old player and aborts its HTTP requests.
Retries are capped at two per load; a fatal media error gets one recovery attempt per session.
Native HLS fallback is browser managed; unavailable network/buffering statistics stay null.
Ordinary Autonomi visits do not load hls.js.

Prepare a **local** source with FFmpeg and FFprobe on PATH (or `FFMPEG` / `FFPROBE` set to their executable paths):

```sh
node tools/video-trial/package-hls.mjs source.mp4 new-output-directory
```

The tool refuses an existing output directory. It creates H264/AAC fMP4 VOD, aligned 4-second segments,
30 fps, and renditions up to 240/360/720/1080 pixels high without upscaling height.
Video targets are 350/700/2200/4500 kb/s plus 96 kb/s audio when present.
This deliberately trades resolution/frame rate for delivery cost; visual quality equivalence is not asserted.
Each master bandwidth value comes from measured segment sizes with 10% headroom.
`package.json` contains source dimensions, encoder version, per-rendition bytes/rates and per-file SHA256.
A failed encode leaves inspectable partial output and no completed `package.json`.
Only publish complete packages, under a unique version/content path such as its `bundleId`; never overwrite immutable segments.

Publisher hosting requirements: HTTPS, correct MIME types, CORS for GET/HEAD from the player origin,
immutable long-lived caching for versioned VOD playlists/init/segments, and no per-viewer cache-busting URLs.
Private media requires a separate authorization design; do not put secrets in public playlist links.
Use regional caches, origin shielding, coalesced cache fills, capacity-based admission, and multiple failure domains.
Those deployment controls are requirements, **not infrastructure installed by this change**.
GitHub Pages can demonstrate a small fixture; it is not the billion-viewer delivery tier.

The committed synthetic fixture is 48 seconds of FFmpeg `testsrc2` (640x360, 30 fps) plus a 440 Hz tone,
encoded first at CRF 18 and then packaged by this tool. It is test media, not a visual-quality benchmark.

## Capacity envelope

```sh
node tools/video-trial/capacity.mjs
node --test tools/video-trial/capacity.test.mjs tools/video-trial/package-hls.test.mjs
node --test e2e/bview-adaptive.test.mjs
```

The browser test requires installed Chrome for H264 (default Playwright channel `chrome`).
`BVIEW_BROWSER_CHANNEL` can choose another installed codec-capable browser channel.
Its media comes only from fixtures, with a loopback TLS server pacing bodies for bandwidth changes. It proves real decoding, quality changes, old-buffer eviction,
backward seek, completion, cancellation, pause backpressure and bounded outage retries.
It does not send synthetic audience traffic to any public server.

For one billion concurrent viewers, 4-second multiplexed A/V segments, 15% byte overhead,
99.9% byte and request cache hits, 100 regions and 100 Gb/s edge units at 60% utilization:

`videoMbps` means combined media bitrate including audio; the separate overhead multiplier is an assumption about delivery overhead.

| Assumed average video rate | Delivery | Delivery per hour | Origin miss traffic | Edge units |
| --- | --- | --- | --- | --- |
| 32.6 Mb/s from the reported source | 37.49 Pb/s | 16,870.5 PB | 37,490 Gb/s | 624,834 |
| 2.5 Mb/s planning target | 2.875 Pb/s | 1,293.75 PB | 2,875 Gb/s | 47,917 |

Both imply 250 million segment requests/s. A five-minute billion-viewer start wave with four startup requests/viewer
adds 13.33 million startup requests/s. Separate audio tracks, live refreshes, keys, retries, seeks and rendition churn add load.
The model's equal request/byte cache hit assumptions are intentionally explicit; real hit rates differ by popularity,
region and object size. Cold cache and a 95% hit scenario are emitted too.
At 2.5 Mb/s, a 95% byte hit rate still leaves 143.75 Tb/s at origins.
Neither bandwidth-unit counts nor balanced-region averages prove the fleet's CPU, connection, availability or cost budget.

Naively multiplying the supplied single-browser direct run (993 dials, 42 open peers) yields 993 billion dial attempts
and 42 billion peer connections. That is an illustration of why discovery/fanout must be measured, not an SDK limit
or prediction of shared-pool efficiency. More per-viewer read lanes cannot solve a global resource budget.

## Acceptance measurements

Keep preview and actual playback startup separate. Record application holds alongside native waits;
rebuffer time is their union after playback starts. User pauses/seeks are excluded from native rebuffer counts.
Capture rendition switches, payload, dropped frames, buffer ahead/back, request/retry counts, cache-hit ratios,
origin fill concurrency, regional throughput, startup p50/p95/p99, and successful completed viewing minutes.
The existing capture stays local and allowlisted; no per-viewer telemetry upload is introduced.

Next distributed acceptance must establish provisioned per-region capacity and then ramp representative traffic
through cold/warm cache, popular/long-tail content, simultaneous startup, origin failure and regional loss.
Measure delivered video and QoE at each tier; stop increases when the measured budget is exceeded.
Do not treat extrapolation, synthetic mocks, green CI or the public demo as one billion successful sessions.

Initial engineering acceptance targets for that future distributed qualification are explicit:

- Actual moving playback startup: p95 at most 3 s with warm edge caches, 10 s with cold caches,
  on supported devices with enough throughput for at least the lowest rendition. Preview pixels do not count.
- At least 99.9% completed eligible sessions. Retain failures and timed-out sessions in the denominator;
  report unsupported devices separately instead of silently dropping them.
- Rebuffer time below 0.5% of requested active viewing time in aggregate, and below 1% at the session p95.
  Include application holds, exclude deliberate user pause/seek time, and report startup separately.
- Selected-rendition frame drops below 1% at session p95 on real target devices. Measure browser memory separately
  from compressed-buffer targets; no device-memory threshold is claimed validated by this release.
- Measured edge utilization at most the model's 60% planning allowance, with admission and load shedding before
  tested origin/connection limits. Count request cache hits and byte cache hits separately.
- Qualify successive cohorts (1,000; 10,000; 100,000; 1 million; 10 million; 100 million; 1 billion)
  for at least 30 minutes each, including a five-minute start wave. Repeat cold-cache and regional-loss cases
  within the provisioned failure budget before increasing audience size.

These are test targets, not measured achievements, existing service guarantees or authorization to incur infrastructure charges.
File integrity and eventual completion, such as the recorded 434 s direct startup, are insufficient to satisfy this qualification.

Implementation references: [hls.js 1.6.15 API](https://github.com/video-dev/hls.js/blob/v1.6.15/docs/API.md),
[FFmpeg HLS muxer](https://ffmpeg.org/ffmpeg-formats.html#hls-2),
[W3C Media Source Extensions](https://www.w3.org/TR/media-source-2/).
