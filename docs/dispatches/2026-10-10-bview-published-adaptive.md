# Published adaptive playback of the actual Autonomi video

The prior deployed original started in 39.734 seconds but accumulated 338.433
seconds of rebuffering. It is 214,091,829 bytes for 52.488 seconds, about 32.6
Mb/s. This lane publishes the already measured lower-bitrate renditions and
connects them to the same original address. This changes delivery to a published
HTTPS copy; it does not make the original Autonomi transfer faster.

## Publication and player behavior

The user explicitly authorized publishing the adaptive renditions. Before
copying them into `media/bview/`, the original local file was independently
checked against the corpus SHA256 and byte count, all 64 package files were
hashed, and the bundle ID was recomputed from the master and file manifest.
The full bundle ID names the immutable directory. `publication.json` binds
the original address/hash/size to this package and its master digest.

| Rendition | Media bytes | Average Mb/s |
| --- | ---: | ---: |
| 374 x 240 | 2,475,154 | 0.377 |
| 560 x 360 | 3,797,466 | 0.579 |
| 1120 x 720 | 9,077,374 | 1.383 |
| 1680 x 1080 | 16,540,534 | 2.520 |

These are lossy H264/AAC copies at 30 fps, compared with the original's roughly
60 fps and 3318 x 2132 resolution. No visual equivalence or original-byte hash
claim is made. The package contains 31,890,528 media bytes across all renditions.
The original 214 MB file is not committed or republished.

Fresh visits default to **Adaptive when available**. The curated original address
resolves directly to the published playlist without SDK discovery or relay
requests. Unknown addresses use the original through the relay. Original-only
routes remain selectable; saved choices are preserved. A share link with
`?route=adaptive` selects this mode for that visit without overwriting the saved
choice. Direct-only never silently requests a published copy. The UI names the
HTTPS delivery and allows the viewer to choose an original route.

Published adaptive playback remembers the original address in My videos. Arbitrary
HTTPS playlists remain excluded from that address-only list. A route change away
from direct cancels an unused pre-open and closes its pool. Playback uses the
existing bounded adaptive engine: lowest rendition first, measured quality
switches, pause/cancel demand control and bounded retries.

## Verification

`e2e/bview-published.test.mjs` passed 4/4: original/package binding and all asset
hashes; complete actual-content decoding with no stalls; explicit direct-only
isolation; and share-link selection with saved preference preservation. Four
mobile-width front checks also passed. The initial combined run had one harness
failure: it expected a non-exported `engine.addr`; the corrected assertion reads
the actual address input and retains the published bundle/source assertions.
No engine field was added to satisfy that mistaken assertion.

The opt-in `e2e/bview-published-live.mjs` uses fresh Chrome contexts with browser
HTTP caching disabled. It checks the public HTML digest, every loaded rendition
asset's digest and status, complete playback, zero stalls, frame drops, bytes,
switches, layout, and zero SDK/relay/dial activity. It supports desktop, Pixel 7
emulation, and Chrome network shaping. Its explicit smooth-playback budgets are
at most three seconds of ordinary startup (ten seconds when constrained), zero
rebuffering and at most 1% dropped frames. Edge caches may already be warm;
phone emulation is not a physical-phone test. Timed-out/failed runs remain receipts.

Examples (each output must be new):

```sh
node e2e/bview-published-live.mjs --profile desktop --out desktop.json
node e2e/bview-published-live.mjs --profile phone --out phone.json
node e2e/bview-published-live.mjs --profile phone --kbps 700 --out phone-700.json
```

Direct/adaptive regressions and package/capacity checks passed **24/24** in
105.403 seconds. All three register conformance scores remain 100%; estate
registration passes. CI and public acceptance will be appended after observation.

## Scope and upstream

This publishes one real video through GitHub Pages. It does not provision a
billion-viewer fleet. The HTTPS host controls cache headers; content-versioned
paths prevent mutable segment naming but do not guarantee immutable headers.
The distributed-delivery requirements remain in `tools/video-trial/SCALING.md`.

Dirvine's current x0x #504/#622/#505 discussion was checked before implementation.
The outstanding efficiency measurement is still per-kind delivered-versus-published
evidence, with ObserveOnly defaults and separate ADR requirements for changes.
This lane changes no x0x backend, SDK, proof circuit, chain or paid storage.


## Public release acceptance

PR [#395](https://github.com/beehive-nature/beehive-nature/pull/395) merged at
03:57:02 UTC on October 11 (October 10 locally). The
[Pages deployment](https://github.com/beehive-nature/beehive-nature/actions/runs/38110015294)
completed successfully. A public-byte audit checked **69 files / 32,607,447 bytes**:
the exact candidate HTML, HLS runtime, master, publication/package manifests,
all variant playlists, init files and media segments. Every HTTP status and
digest matched. The server reported its actual cache headers in the raw receipt;
no immutable-header claim is inferred from content-versioned paths.

All three complete, real public playback runs passed. Each used a fresh Chrome
context with browser HTTP caching disabled. Edge caches may be warm because the
asset audit ran first. Phone means Pixel 7 emulation, not physical-device evidence.
The constrained run used Chrome network shaping at 700 kb/s with 80 ms latency.

| Public run | Page ready observed | Watch-to-play | Final quality | Media payload bytes | Rebuffering | Dropped / total frames |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | 1.437 s | 2.920 s | 1080p | 16,205,393 | 0 | 0 / 1575 |
| phone | 0.833 s | 1.010 s | 1080p | 16,424,554 | 0 | 0 / 1570 |
| phone-700 | 1.735 s | 3.976 s | 240p | 2,475,154 | 0 | 0 / 1575 |

The three runs finished at 56.319 s, 54.954 s, 57.462 s
after Watch respectively. Every requested media asset matched its package hash.
Each run used one MSE source, with **zero SDK requests, relay requests, WebRTC
dials, media recoveries, failed media requests or page errors**. Desktop and
unconstrained phone each changed quality once; the constrained run remained at
240p. Media payload fell by 92.43%, 92.33%, 98.84%
relative to the 214 MB original. This is body-payload accounting, not total wire
traffic; playlist/init body totals are recorded separately.

The earlier direct-original observation had 338.433 seconds of rebuffering.
These adaptive runs had **zero**. This is the same source content encoded and
delivered through a different route; it is not a claimed speedup of raw Autonomi
discovery or original-file transfer. It is three successful observed sessions,
not a p95/population guarantee or audience-capacity test.

The runner now also records navigation-to-ready and navigation-to-Watch timing;
those are separate from the engine's Watch-to-play measurement. This adds only
measurement fields. Production player/media bytes are unchanged after the PR.

At this receipt checkpoint, the new PR and main integration workflows still have
queued or running jobs; they are not reported as successful.
The previous direct-startup release's post-merge workflow 38108411478 did finish
with all seven jobs successful. Own superseded/duplicate branch runs and unchanged
proof jobs on owned merge commits were cancelled after checking their inputs;
those cancellations are recorded, not counted as passes. Final receipt/measurement
edits skip redundant CI. Live verification and the local focused checks above
remain tied to the exact published runtime bytes.

[Watch the published adaptive version](https://skaists.dev/surfaces/bview.html?route=adaptive#7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78). <!-- PUBLIC-CONSTANT: public original content address -->
