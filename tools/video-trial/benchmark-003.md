# Shu Benchmark 003: next measurement

The companion JSON transcribes the supplied assessment. Its receipt date is not
the benchmark date. Raw traces, exact content identifiers, build pins, and
per-run environment/cache settings were not supplied. Preserve these unknowns.
Do not feed this schema into the two-arm October 7 scorecard.

## What current source establishes

At main `235d0f030`, `surfaces/bview.html` uses six application read lanes,
twelve chunks of look-ahead, and a 45-second next-in-order starvation deadline.
These are not peer concurrency or SDK dial limits. In `tryDirect`'s lane loop,
each application read is issued once; the first read rejection aborts the run.
The SDK may retry internally, but this layer cannot attribute those attempts.
The direct-only catch stops; the fallback path uses the relay. Neither behavior
establishes autonomous network repair. The earlier ordered-wait repair is present;
without Benchmark 003's build pin, we cannot tell whether this run exercised it.

The engine already exposes connect/open/first-read timings. `capture.js` now
retains those numeric fields, total chunks, lane count, startup budgets and
direct-only mode alongside completed versus emitted chunks. Engine connect time
is not first-peer time; first read can be out of order and is not first useful
playable byte. The outer TTFF remains the engine's frame metric, not a separate
decode/signaling trace. Free-text stop/fallback reasons remain excluded.

## Ordered experiments

Shu's follow-up says mobile emulation is newly available and suggests 500 is an
SDK upper cap encountered by two sites. Treat both as reported context: no
mobile results or cap source were supplied. The vendored 0.1.2 JavaScript search
does not establish that cap; a lower-layer implementation remains unverified.
Do not raise it on the strength of the chart.

The proposed MSE/SW distinction also needs correction for this source pin:
bView's `readBinaryStream`, `paintBlob` and `setBlob` use progressive Blob URLs;
the player file has no MediaSource use or service-worker registration. This does
not prove an already installed origin-wide worker is absent in a user's browser.
The other two sites' SW usage is Shu-reported, not verified in this lane.

For mobile, record emulator/device model, host OS, actual browser engine/version,
viewport, user-agent override, touch mode, CPU/network throttling, MSE/codec
capabilities, SW registration AND active controller, selected playback path,
backgrounding and memory-related termination. Viewport emulation is not evidence
of mobile WebKit/Android resource limits. Keep emulated and physical-device runs
in separate cohorts; repeat the same corpus on real devices before making mobile
reliability claims. Do not attribute differences to SW versus Blob without pinned
paths and comparable cache state.

1. Pin the three public builds and SDK versions, content corpus (including the
   exact 52-chunk file), browser, device, network, cache state, route, and fixed
   timeout. Use the matched-block protocol in README.md and retain every failed
   run. Capture the current baseline before changing scheduling.
2. Trace action, discovery, signaling, data-channel open, first received byte,
   first ordered byte, decode and rendered frame on one monotonic clock. Keep
   unsupported stages null. Do not subtract overlapping stage durations.
3. Record each chunk's index, requested range, application attempt, request,
   arrival and emission times, timeout/retry/terminal state. Distinguish SDK
   attempts from application attempts. Attribute useful bytes to run-local peer
   aliases only when the transport actually exposes attribution; otherwise null.
   Never infer that the missing chunk was index 16 from the 16/52 total.
4. Inject one missing early chunk and later successful arrivals. A client-retry
   candidate must recover without manual action, have bounded attempts/time/bytes,
   preserve ordered output, stop cleanly, and verify final content integrity.
   Confirm SDK cancellation semantics before permitting overlapping retries.
5. Only after locating the bottleneck, compare a bounded useful-peer policy at
   a fixed dial budget. Application lanes, active peers and useful peers are
   separate variables. Report startup, completion, peak concurrency, useful bytes,
   total received bytes and failures together. No automatic concurrency increase.
6. Run the separate network-repair arm only once a deployed repair version is
   identified. Preserve holder-loss evidence, repair events and fresh-client
   retrieval evidence showing restored availability independently of the original
   client's cache/retry/failover. Report repair and client recovery separately.

## Acceptance receipt

Each run needs pinned build/corpus metadata, raw chronological observations,
predeclared timeout, terminal reason, requested/arrived/emitted chunk totals,
integrity result, frame/stall results and measurement provenance. Unknowns stay
null. All 52 chunks arriving is necessary for this corpus but is not sufficient
to prove playback completion or network repair. A missing chunk must recover
without manual intervention, with a receipt another operator can verify. Until
then the large-file path remains unverified for reliable sustained playback.
