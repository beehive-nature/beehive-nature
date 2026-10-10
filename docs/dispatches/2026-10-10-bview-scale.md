# bView: adaptive delivery and the billion-viewer capacity envelope

The requested billion simultaneous viewers is a target, **UNVERIFIED**, not deployed capacity.
This lane delivers an adaptive playback route, publisher packaging, corrected interruption accounting,
real browser fault tests, and a reproducible capacity envelope. It owns no ANT purchase/write gateway,
ant-writedoor, ant-extsig, relay deployment, payment or device work.

## Diagnosis from the supplied playback receipt

Reported by the user's browser: 214,091,829 bytes, 52/52 chunks, 52.49 s at 32.6 Mb/s,
3318x2132 at 59.92 fps; first ordered response 33.05 s, preview 34.50 s, retrieval 267.45 s.
Final measured rate was approximately 0.54 MB/s, far below the encoded bitrate.
The receipt showed explicit application holds but "stalls none yet": `pause()` did not trigger the native `waiting` counter.
It also reported 993 dials, 42 currently open peers, and 51/526 dropped frames on the final source.
These are user-reported observations, not a fresh independent reproduction.
The public address, expected digest and size are now pinned in `tools/video-trial/corpus-2026-10-10.json`.
The live runner accepts `--corpus`; collecting repeatable evidence is owned by the agent, not delegated to the user.

## Implemented

- Existing Autonomi reads retain the three-lane bounded-retry implementation.
  Application holds now survive the pause/source-swap events they cause. Rebuffer duration is the union
  of native waits and application holds after actual playback starts; preview and actual startup stay separate.
- HTTPS `.m3u8` input lazily loads the already-vendored hls.js 1.6.15. Lowest-rendition startup,
  throughput-based quality, player-size/frame-drop caps, 20 s forward / 10 s back targets,
  24 MiB compressed-buffer target, pause backpressure, cancellation, two retries/load and one fatal-media recovery.
  Those are buffering targets, not a total-memory guarantee. Backward seeks may retain already buffered forward data.
  Native HLS fallback reports unsupported byte/buffer metrics as unknown.
- All three fronts identify the HTTPS source, stream-again behavior and absence of a whole-file hash/offline-copy claim.
  A same-page link opens the synthetic 48-second adaptive sample. Autonomi route selection is labeled accordingly.
- `tools/video-trial/package-hls.mjs` creates local, aligned four-second H264/AAC fMP4 VOD renditions,
  refuses overwrites, and records measured segment bandwidths, byte sizes, encoder version and content digests.
  It performs no upload or purchase. `SCALING.md` specifies publisher hosting and distributed acceptance requirements.
- The allowlisted local capture now records startup, application holds, segment bytes, quality switches,
  selected bitrate and buffer targets. No analytics upload or peer seeding is introduced.

The synthetic 48 s source was 7,727,511 bytes. Packaged video/audio segments were 2,698,655 bytes at 240p
(449,776 bit/s average) and 4,801,410 bytes at 360p (800,235 bit/s average).
This is a reproducibility fixture, not evidence of visual equivalence or the user's source being transcoded.

## Verification

- Existing playback/direct/recovery/scorecard suite: **41/41**, 260.8 s. This includes the 214 MB/52-chunk
  fault fixture with two failed reads recovered, and the actual player-hold duration regression.
- Adaptive/package/capacity suite: **6/6**, 93.1 s. Real Chrome tests exercise decoding, upgrade, paced-bandwidth downgrade, old-buffer eviction,
  backwards seek, full completion, pause/cancel demand control and bounded 503 retries.
- Package tests verify aligned complete playlists, measured peak-bandwidth declarations and every media digest.
  Capacity tests verify units, cache extremes and invalid assumptions.
- Raw local results: `evidence/2026-10-10-bview-scale/` (browser snapshots, test logs, conformance and capacity JSON).
  The final library-load timeout adjustment also passed the focused outage check (1/1).
- All three interface styles pass conformance at **100%** (145/209/547 checks); estate-check and diff whitespace pass.

During development, delaying a fully mocked response failed the downgrade test (`Timeout 30000ms exceeded`):
it measured first-byte latency rather than body throughput. A real paced TLS stream replaces it.
Rewriting a pretend public hostname onto loopback was rejected by Chrome (`Permission was denied ... loopback address space`);
the test now uses its actual loopback HTTPS origin without disabling the browser's policy.
The first Windows packaging attempt misplaced the fMP4 init file; FFmpeg now runs inside each output directory
with relative playlist/segment paths, and the completed package passes playback and digest checks.
Early segment-byte receipts incorrectly read a detached payload as zero; fragment statistics now provide the byte count,
with a browser regression requiring nonzero bytes and measured first-media-byte timing.

## Capacity and remaining boundary

`node tools/video-trial/capacity.mjs` emits assumptions and results for original bitrate, adaptive target,
poor cache and cold cache. At one billion viewers and a 2.5 Mb/s average plus 15% overhead:
2.875 Pb/s delivery, 250 million four-second segment requests/s, 1,293.75 PB/hour,
and 2.875 Tb/s origin misses even with a 99.9% byte hit rate.
At 100 Gb/s per illustrative edge unit and 60% utilization that is 47,917 units.
These arithmetic units are not deployed machines, measured capacity, cost quotes or a procurement plan.

The adaptive route requires publisher-prepared renditions and suitably provisioned HTTPS delivery.
It does not automatically lower the bitrate of an existing Autonomi file.
There is no billion-session result, physical-mobile/Safari acceptance, multi-region origin-failure drill,
production CDN allocation or new relay capacity in this dispatch. A GitHub Pages demo is not that delivery fleet.

Upstream check: dirvine's current x0x #504 directs efficiency measurement toward per-kind/delivered-vs-published evidence
and folds earlier #622 work into the active tracker; #505 remains a separate fragmentation field-evidence history.
No mesh acceptance, SDK-wide 500 cap, or throughput improvement is inferred from an issue's closed badge.

References: [hls.js API](https://github.com/video-dev/hls.js/blob/v1.6.15/docs/API.md),
[FFmpeg HLS muxer](https://ffmpeg.org/ffmpeg-formats.html#hls-2),
[capacity and publishing instructions](../../tools/video-trial/SCALING.md).
