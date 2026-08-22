# the multiplayer seam — what exists, what plugs in (forward queue item 3, first slice)

**State 2026-08-21:** the CRDT layer is BUILT AND TESTED (`forge/visual/shared.js` +
`test/shared.test.mjs`, 7/7). The transport is deliberately abstract — anything with
`send(bytes)` + delivery into `receive(bytes)` carries a forge room. What is NOT yet
wired: the studio's LiveKit huddle. `ui/src` is a React app with **no Yjs usage today**
(grepped 2026-08-21) — the BS-1-ruled stack (Yjs MIT + our LiveKit venue + own panels)
exists as the ruled design, not as landed code in this repo's `ui/`.

## What landed (this slice)

- `forge/visual/shared.js` — `createSharedPiece({Y, transport})`. Doc shape:
  ymap `piece` → `{ seed, 'param.<name>': value, … }`. **Each param is its own CRDT
  key** so two artists turning different knobs merge (the test suite's no-clobber case
  caught the snapshot-object design being wrong — per-key was the fix); same-knob edits
  resolve last-writer-wins, identically on every peer. `state()` is canonical (sorted
  param keys) so convergence comparisons are byte-stable.
- `forge/visual/test/shared.test.mjs` — in-memory wire (the same contract a LiveKit
  data channel or BroadcastChannel implements): convergence, fork-law-in-a-room,
  no-clobber, no-split-brain, onUpdate/subscribe, loud misconfiguration. 7/7 PASS.

## The seam, when the studio lap runs

1. **Transport adapter (~30 lines):** wrap a LiveKit `DataPublisher`/`DataSubscriber`
   (or `BroadcastChannel` for same-machine multi-tab dev) into `{send(bytes)}` +
   `sharedPiece.receive(bytes)`. Yjs updates are already bytes; no framing protocol needed.
2. **Studio view:** host a starter's CORE (extracted like the test harness does) +
   `createSharedPiece`; render locally from `state()` on every `onUpdate`. Local
   re-render per participant, shared source per spec §6 — nobody's brush is anyone
   else's brush.
3. **bAiGenT seat:** an agent joins as an ordinary participant writing the same doc —
   `setSeed`/`setParam` from its side is indistinguishable from a human's (room-AI
   seat shape broom-agent already occupies).
4. **Lap order discipline:** wiring the huddle touches the studio app — its own
   session, its own receipt, after the guidance lane doc.

## License note

`yjs` is dev-only (test/), MIT, ruled at Gate BS-1 (`RECEIPT_SZLI6792_RAID_2026-08-21`).
The starters and `shared.js` itself carry zero dependencies — the DI design keeps the
browser bundle free until the studio chooses its loader.
