# bView: bounded chunk recovery and owned measurement receipts

This continues the Shu Benchmark 003 intake. The founder asked this seat to
diagnose, repair and improve through completion, and to own all important metrics.
No request for the founder to reconstruct benchmark metadata remains outstanding.
Original Benchmark 003 traces/build/corpus remain unknown; substitute fixtures
are explicitly labelled and never presented as a reproduction of Shu's run.

## Repair

`surfaces/bview.html:tryDirect` previously aborted the whole transfer on the first
rejected range read. It now retries settled failures in the same six lanes:
three attempts per chunk, twelve retries per transfer, 250/1000 ms backoff.
Successful chunks remain queued and are emitted once, in order. Short reads
cannot enter the player; their received bytes are counted separately from useful
plaintext. Permanent failure still stops direct-only or uses the selected relay
fallback. No dial limit or active-peer setting was raised.

Each chunk has an index/range, attempt timestamps/outcome, arrival/emission
timestamps and terminal state. Unknown peer attribution stays null. Cancellation
freezes pending attempt receipts; late results cannot count as delivery. Engine
snapshots copy the nested records. `capture.js` exports one bounded timeline plus
allowlisted transport counters, excluding addresses and free-text errors.

The SDK cancellation boundary was checked in vendored `file-reader.js:read` and
`internal/abort.js:abortable`: JS abort stops waiting, without cancelling the
underlying WASM read. Therefore an unsettled range is never duplicated. Pinned
[Rust ReadLease::record](https://github.com/WithAutonomi/ant-client/blob/9858af5dbbb2caf090e20db67ac62aa4bd100c81/ant-core/src/browser/wasm_transport/read_ahead.rs)
returns no read-ahead result for an already failed slot, allowing a subsequent
settled retry to fetch it again. This is client recovery, not distributed repair.

The real public sample exposed a second limit: cold direct-only discovery hit
the 30-second startup cap before open completed. Direct-only now gets 30 seconds
quiet / 90 seconds total, and 120 seconds waiting for its next ordered chunk.
The relay-fallback route retains 12/30/45 seconds. Later arrivals cannot extend
either ordered deadline. These are bounded patience budgets, not speed claims.
Timeouts and user cancellation have distinct receipt states.

## Verification and failures retained

- The first recovery suite passed 17/18; cancellation was incorrectly labelled
  failed. That runtime bug was fixed. A subsequent cancellation test raced the
  250 ms backoff from Node; cancellation now fires deterministically in the page
  during backoff, and verifies that no retry starts and late results change nothing.
- The broader run passed 39/40. Its fast-relay height assertion sampled the old
  height on RAF and sometimes never observed the first preview (zero versus
  199.125 px). Source-reset geometry is now sampled synchronously before reset;
  all decoded-frame and height assertions remain. Focused corrected run: 2/2.
  An unchanged-main probe also failed the timing-sensitive fast-relay test on this
  loaded machine, before its height assertion (671744 of 1187514 bytes at start).
- A 52-chunk, 213712953-byte fixture failed chunk 16 twice and completed all
  chunks in 54 reads. SHA-256 matched the independently assembled expected bytes,
  six-read and twelve-chunk queue bounds held, no same-range overlap or relay.
- Candidate on the public origin, Chromium Pixel 7 emulation: 52/52 completed,
  two retries, one recovered chunk, matching hash, no page errors or relay,
  viewport and scroll width both 412 px. This is injected-fault browser evidence,
  not physical Android or network performance evidence.
- Estate-check, capture syntax, and the three transport recorder tests passed.

The measured public sample is the current `try.autonomi.com/featured.json` video,
54903201 bytes, with a published SHA-256. Its initial live direct-only attempt
did not open before timeout; the next opened in 21.44 s after a 5.87 s connect but
timed out awaiting the head with 1/14 chunks complete. Zero recorded stalls in
these unsuccessful attempts is not a success. Final release receipts follow.
