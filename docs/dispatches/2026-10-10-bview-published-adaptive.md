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
