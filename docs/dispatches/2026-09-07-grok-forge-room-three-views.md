# Forge two-tab room — three presentations — 2026-09-07

Seat: Grokbot / Cursor cloud agent. Lane: `surfaces/forge/room.html`
presentation only. Founder screenshot: New bee selected, room still CRT
hex chrome, tiny mono, dense tour footer — the same “pill flips, room
doesn’t” failure Gallery had before the five-door adapters.

## What changed

`surfaces/forge/room.html` now authors three complete presentations on
`body[data-reg]` / `data-bee-theme="custom"`. Shared `tour.js` / `register.js`
are untouched (cache stays tour 39 / register 9). Page-local CSS restyles
the injected tour bar for New bee the way the social door did.

| View | Room |
| --- | --- |
| New bee | Cream `#f6f7f2` canvas, rem type, large title, short lead (“Open a second tab. Turn a knob. Watch it move.”). Primary = canvas + density / hue / symmetry at 44px. Seed, roll, hue drift, CRDT/Yjs/LiveKit/jsDelivr sit in details. |
| Raver | Dark instrument floor, magenta/lilac accents, larger title, seed panel open by default. Same knobs and BroadcastChannel piece. |
| Cypherpunk | Dense mono, hex lattice, source foot visible, how + tech disclosures open by default. |

Honesty stays labeled on every view: **this browser only** · BroadcastChannel
· **not a network room** — matching the social door’s browser-only room card.
No numbered step list.

Disclosures reuse the five-door / social-door preserve/restore pattern
(`readingChoices` + `restoreVisibleFocus` + `data-view-disclosure`).
Defaults apply only when that view has no saved choice. A manual open
survives a round-trip.

## What did not change

Hexfield CORE (`hashSeed` / `mulberry32` / `buildArt`) is the same bytes
as on main. Yjs 13.6.20, `createSharedPiece`, BroadcastChannel names
`bBuzz-forge-room` / `bBuzz-forge-room-presence`, default seed `hive-1000`,
and the four knobs are unchanged. This is not a network room and does not
claim LiveKit is live here.

`surfaces/register.js` and `surfaces/tour.js` were not edited. No corpus
keys, no atlas rebuild, no new surface row (the room was already
registered). `e2e/register.test.mjs` now records that this page authors
`data-bee-theme="custom"` instead of waiting as a pending dark tool.

## Tests

Additive `e2e/forge-room-views.test.mjs`, wired beside `social-three-view`
on the Front door step. Fixture + small DOM-boundary checks for the three
canvases, honesty strings, CORE/knob wiring, and a disclosure round-trip.
Also `node forge/visual/test/core.test.mjs` on the room (CORE + compile).

## Browser check (local preview `http://127.0.0.1:4179`)

Served `surfaces/forge/room.html` in this VM. New bee is a cream room
(title “The two-tab room”, lead “Open a second tab. Turn a knob. Watch
it move.”, honesty chip **this browser only** + BroadcastChannel + **not
a network room**). Density/hue/symmetry sit under the hexfield; turning
density re-derived the lattice (91 → 105 cells). Seed / how / tech start
collapsed. Raver flips to a dark instrument floor titled “Jam the field.”
Cypherpunk keeps mono density; how + tech open with Yjs / LiveKit /
jsDelivr. A second tab of the same URL showed two presence chips
(`tab-zplh`, `tab-7huq` / `tab-l1uq` in the later shot). The hex ART
stays a dark field in every view — that is the CORE brush, not page
chrome. Tour bar on New bee is restyled light (social-door pattern),
not removed.

This is a served-page check in this VM, not matriarch acceptance, not a
live jam across machines, and not a claim the public Pages deploy has
moved.
