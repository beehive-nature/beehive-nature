# Video trial: browse, playback, and return visits

This is a measurement kit, not a streaming optimization or a bTunGsTeN
conformance result. It follows SPEC-BTUNGSTEN-1's observation/evidence boundary.
The founder supplied Shu's October 7 observations and an interpretation with
numbers. Screenshots, raw logs, Trial #1 source/build, exact content IDs, and
repetition counts were not supplied. The numbers here are a transcription of
that interpretation. Warm navigation remains a qualitative report.

## Reproduce the arithmetic

From the repository root:

```sh
node tools/video-trial/scorecard.mjs tools/video-trial/shu-2026-10-07.json
node --test tools/video-trial/scorecard.test.mjs
```

Negative percentages mean less elapsed time; positive means more. Zero baseline
has no percentage; null means unknown. No averaging of browse gains with video
regressions, no fabricated p50/p95, and no automated rollout verdict.

The reported first poster is 43.3% faster; full 21-poster completion is 20.2%
faster. Short first frame is 22.2% slower (+1.4 seconds). Long stalls are 30.4%
longer (+6.9 seconds). That last change should not be dismissed as marginal.
These are descriptive differences, not established treatment effects.
The claimed abandonment-safe window has no retention evidence. A 5.9-second
first poster is an improvement, not proof users will stay.

## Trial #2: make the next result explainable

Pin live and trial builds, SDK versions, network identity, browser/OS/device,
viewport, ordered poster manifest, exact short/long files, file sizes, durations,
codec, route, and cache policy. Use a single machine/network for a comparison
block. Do not mix October 3's smaller poster workload with October 7's grid.
Label bView direct, relay, mixed fallback, and local cache as separate paths.
An ants.tube browser-direct run cannot establish a win against a relay path.

Use these distinct conditions:

| Condition | Procedure | What it can establish |
| --- | --- | --- |
| Cold client | New browser process/profile per arm; same 21 posters and clip | Fresh-client startup, not a globally cold network |
| Warm, new content | Same document/client; open an unplayed clip | Session reuse with no completed-file hit |
| Warm, same content | Repeat the clip, record actual cache/path | Return-visit experience including local cache |
| Full navigation | Home → Watch → Home → Watch, actual site controls | Whether reuse survives the real navigation lifecycle |

Run 10 matched blocks initially, alternating baseline/trial order (AB then BA),
and keep all failures and timeouts. This is a practical diagnostic sample, not
a statistical power claim. Fix a timeout before starting (suggested 180 seconds
per clip); retain timeouts as censored failures, never as successful 180-second
loads. Record background-tab and user-pause intervals, seeks, and interruptions.
Publish paired differences and all raw observations; report median plus sample
size. With 10 runs, a nearest-rank p95 is the maximum: do not market it as a stable
tail estimate. Expand to at least 40 matched blocks if the release decision
depends on tail latency, still reporting uncertainty and failures separately.

Browse scorecard: first/4th/8th/12th visible decoded poster, viewport completion,
all 21 completion, failed tiles, and transition-to-interactive time. Define the
start as the navigation action and the endpoint as the rendered image, not the
request start or response headers. Fix viewport/scroll behavior.

Playback scorecard: action-to-first-decoded-frame, action-to-ended, bytes complete,
rebuffer count/duration after playback starts, minimum buffer ahead, decoder
dropped frames, failed loads, and delivery path. Define rebuffer to exclude
initial startup, user pause, and seeks. bView's existing engine stall counter is
an implementation metric; retain it but cross-check media events before equating
it with that cross-site definition. Whole-file arrival is not playback completion.

Transport diagnostics, when exposed: connection reuse, outstanding requests by
class, per-chunk request/complete/emit times, retries, missing next-in-order chunk,
DHT queries, distinct peers, and unique useful bytes per active transfer second.
Unavailable counters stay null. Read requests are not DHT lookups; application
bytes are not wire occupancy. Do not infer network entropy from stall growth.

## Capture the existing bView counters

Open bView with no content hash, open DevTools, and paste `capture.js` before
pressing play. Use an approved script-injection path if browser policy forbids
pasting. In the console, run:

```js
bviewTrial.mark('play') // immediately before the UI play action; manual timing
// Play through, or reach the predeclared timeout.
bviewTrial.stop()
copy(bviewTrial.export()) // DevTools helper; save as the run's JSON receipt
```

The helper reads `window.__bviewEngine` every 250 ms and stops at 7,200 samples.
It changes no player settings and makes no network requests. It excludes URLs,
content addresses, door addresses, hashes, and free-text errors. Keep build and
content fixture metadata separately. Export before leaving the document: it is
intentionally memory-only and cannot follow a full navigation. Reinstall after
navigation; use a browser trace/video spanning the full journey for transition
timing. It does not capture ants.tube or poster paint timings, DHT telemetry,
wire bytes, or exact automatic action timestamps. A mid-play installation cannot
recover the earlier timeline. Engine TTFF and completion retain engine timing;
sample `atMs` is relative to recorder installation, not play.

## The engineering experiment worth doing next

Hypothesis: background poster reads compete with the next playable video bytes.
This is not yet established. Trial #1's code is needed before attributing its win
to scheduling. Test one change at a time against the pinned baseline:

1. At Watch entry, pause admission of offscreen poster work; reserve read capacity
   for video startup and the next missing playable chunk. Let useful in-flight
   work finish unless the SDK demonstrably supports cheap cancellation.
2. During playback, admit background work only above a measured buffer threshold,
   with hysteresis to avoid oscillation. Derive thresholds from observed chunk
   latency and media consumption; do not simply raise global concurrency.
3. On return to Home, promote visible tiles and reuse the existing session where
   the architecture supports it. Keep decoded-poster reuse and completed-media
   cache hits distinguishable from network speed.

For bView specifically, `surfaces/bview.html` already has a six-lane direct reader,
an ordered emit queue with bounded look-ahead, and a shared direct client inside
the document (`openPool`). `pagehide` closes it. Instrument chunk completion versus
ordered emission before changing lanes: a delayed early chunk can block usable
progress even when later bytes have arrived. More concurrency may amplify that
problem. None of this source inspection proves ants.tube has the same behavior.

Recommended provisional acceptance, agreed before runs: retain the browse gain
on equal workloads; no additional failures; paired median first-frame regression
no more than 0.5 seconds; paired median stall regression no more than 1 second;
no unexplained tail or warm-navigation regression. These are proposed engineering
budgets, not user-research thresholds or a statistical equivalence test. Publish
uncertainty; inconclusive evidence means hold, not pass. Revisit budgets explicitly
if product requirements warrant a different tradeoff.

Do not add operator-side caching, proxies, transcoding, or content custody to
ants.tube: the September 26 dispatch records Shu's constraint. Keep the promising
poster change available as an isolated candidate, and establish whether playback
can be decoupled before calling the combined trial ready to ship.
