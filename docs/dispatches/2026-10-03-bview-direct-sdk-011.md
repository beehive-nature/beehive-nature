# bViEw direct playback: SDK 0.1.1, a connection that survives, a quiet clock

Seat: Claude (Seat 3). Date: 2026-10-03. Founder order: fix it, commit, check
it live. No pull request and no local server this round.

## Why

An outside tester (Shu) ran bViEw against ants.tube and try.autonomi.com and
saw "Direct playback could not start. Using the relay." every time, on both
the 11.6 MB demo clip and the founder's 214 MB clip, and noted bViEw was still
on SDK 0.1.0. In the same table ants.tube reached a first frame over browser
P2P in 3.0 s (short clip) and 12.1 s (long clip).

Three causes, read from `surfaces/bview.html`:

1. One 8 s wall-clock budget covered connect, address resolution, worker
   attach and first frame. The best measured P2P start for the long clip is
   12.1 s, so that clip could never start direct. The 2026-10-03 startup
   dispatch measured a 3.2 s connect, leaving under 5 s for everything else.
2. Every failed start closed the connection, and so did every relay fallback.
   The next attempt paid the cold connect again and failed the same way.
3. SDK 0.1.0 has no streaming reader. 0.1.1 adds one that treats reads as
   sequential and fetches ahead, and only `createMediaSource` opens it.

## What changed

- `vendor/ant-browser-sdk/0.1.1/` replaces `0.1.0/`, same file set, copied
  byte for byte from the npm package (hashes in `VENDOR.md`). Only
  `client.js`, `wasm/ant_core.js` and the WASM differ from 0.1.0; the root
  service worker is byte-identical.
- Direct playback calls the public `AutonomiClient.createMediaSource`, so it
  gets the streaming reader. The range counters stay: the pinned internal
  `MediaBridge.prototype.attach` is wrapped once and the reader wrapper rides
  in as an option.
- The connection is opened with its own lifetime. A failed start or a relay
  fallback keeps it; only choosing Relay, leaving the page, or a connection
  that never opened drops it.
- Choosing the direct route connects at once, before Watch is pressed, and the
  choice is remembered on the device (`bnr.bview.route`), so a returning
  viewer is already connected when the page opens.
- The single budget became a quiet clock: the relay takes over after 12 s with
  no direct progress (connect, file open, a completed range, or any SDK
  progress event), or after 30 s without a first frame. Both figures come
  from the live measurements below. The status line shows
  the stage, the elapsed seconds and the quiet seconds.
- The fallback line now says why direct did not start.
- `e2e/bview-direct.test.mjs`: the mock client gains `createMediaSource`,
  built the way the SDK builds it (open the reader, attach it to the real
  MediaBridge), and the mocked path moves to 0.1.1.

Relay stays the default route. Nothing in the relay engine changed.

## Receipts

Not run locally by order. Syntax only: `node --check` passes on the three
inline scripts of `surfaces/bview.html` and on the test file. Hosted CI and
the live check on skaists.dev follow the push and are appended below.

## Live check, skaists.dev, commit 836da7797, founder's 214 MB clip

Built-in browser on the founder's laptop network, public Autonomi network.

- The page serves SDK 0.1.1; the WASM answers 200 with 5,546,075 bytes.
- Choosing the direct route connected before Watch was pressed: the attempt
  recorded `connectMs 0`, `reused true`.
- First deployed limits (8 s quiet, 20 s cap) still fell back: the public
  DataMap fetch went 8 s without an event and the relay took over at 9.2 s,
  relay first frame at 15.1 s. The limits were too tight, not the path.
- SDK measured directly in the same page, cold: connect 1.7 s; file open
  10.2 s (root DataMap 4.1 s, three nested records 6.1 s); first 64 KiB read
  24.8 s; a tail read 4.5 s.
- `createMediaSource` on the warm connection: source ready 5.4 s, metadata
  11.5 s, first decoded frame 11.8 s. The same table has ants.tube at 12.1 s
  for this clip. After 50 s the playhead was at 2.8 s with 6.9 s buffered:
  this clip averages about 33 Mb/s, more than the direct path delivered here,
  so the 5 s stall rule hands it to the relay with the playhead kept.

Second commit: quiet limit 12 s, cap 30 s, and the status names the step the
SDK reports. The short demo clip was not tested; its full address is not in
this repository.
