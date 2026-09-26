# WATCH FROM AUTONOMI — a guest plays a public autonomi:// video in the browser

**Seat:** Cowork. **Date:** 2026-09-21. **Branch:** `cowork/watch-ant`.
**Founder catch:** his first video landed on Autonomi mainnet
(`autonomi://7c4f61ed…bb78`, 204 MB, 56 chunks, sha256-verified round trip) and he asked
"what surface can i put this in and watch the video?" There was none: `ant-door.html`
shows one fixed address and has no player; ants.tube was on Devnet with its colony asleep.

**The surface.** `surfaces/watch-ant.html` — paste an `autonomi://` address (or arrive
with it after `#`) and a `<video>` points at the estate's ant door
(`relay.skaists.dev/ant/v1/data/public/<addr>`). Three registers, 8 strings (`want.*`)
in en + 28 tongues by text insertion, all machine-drafted. Nothing is requested until an
address is given. No keys, no payments, no uploads. Bad address, slow fetch and a door
that does not answer each get one plain row with the reason. Registered as `watch-ant`
(101 counted) and listed in the review deck.

**Measured truth, named not hidden:** on 2026-09-21 ~08:00Z the door returned 0 bytes in
40 s for the first 1 KB of this file. The page is honest about waiting and failing; it
will not play until the door streams (HTTP Range, first byte in seconds) — ordered to
bee-laborer the same hour. The page needs no change when the door learns to stream.

**Gates:** estate-check PASS · front-door 376/376 · estate-source 11/11 ·
university-smoke 87/87 · no-page-errors 110 walked, 0 errors · floors: only the two
known environment-only floors fail locally.

**Receipt:** the LIVE URL at 390px with the founder's own address — and, once the door
streams, the video playing.
