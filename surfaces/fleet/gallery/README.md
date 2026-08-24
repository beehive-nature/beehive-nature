# /fleet/gallery/ — the ruled placement for the art/visualization wing

ORDER FLEET-2 item 2 layout. Files destined here when Seat 1 rules the move:

- acid-cascade.html · indigo-index.html · resonance.html

These three write no localStorage and read none — they carry no cross-surface
bus, so their placement constraint is only the shared one: SAME ORIGIN with
/fleet/lab/ (GitHub Pages serves both under one origin today, which preserves
the whole fleet's key families by construction).

All three load chart.js from the unpinned CDN URL at runtime; the byte-record
of what that URL served lives in ../vendor/VENDOR.md (chart.js 4.5.1,
sha256-pinned, captured 2026-08-24T04:07:04Z UTC).

Nothing has been moved into this directory yet — placement executes on Seat 1's
word. Fleet HTML stays verbatim, forever.
