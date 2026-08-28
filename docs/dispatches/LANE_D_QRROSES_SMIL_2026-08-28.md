# LANE D — QR ROSES · SMIL PILOT · 2026-08-28

**Seat:** z2.1 · **Dispatch:** friction ruled instrument; SMIL pilot ordered · **Status: CLOSED — POSITIVE VERDICT** (all three real engines pass on the live URL)

## What shipped

`surfaces/blight/qrroses-smil.html` — **live at https://skaists.dev/surfaces/blight/qrroses-smil.html**
(main `@3d70fed`, Pages green). The same garden as the canvas qrroses, rebuilt as
ONE animated SVG: no canvas, **zero JS per frame**, every motion declarative SMIL.

- **The plate is a static `<g>` with zero animation children** — gate-probed; not one
  module of the code moves. Quiet zone + 2 module widths, same geometry as the canvas law.
- Stems grow (stroke-dash draw, staggered), leaves and blooms scale in late, blooms
  sway; three bees ride `animateMotion` **centre-band loops** through the data middle,
  exiting the mid-edges — never the three finder squares (corner law).
- **Reduced motion** pauses the SMIL clock (`pauseAnimations` — a stop, never a shim)
  at the completed garden: a still frame that decodes.
- nayuki vendored at the same pin as qrroses/qrtree; one file, zero off-origin.
- **Instrument rule honoured:** Friction (GPL-3.0) named in the provenance line —
  USED, never forked/linked/vendored/copied; the art is hand-authored first-party SVG.
- The canvas original is **untouched**; the pilot links to it in its nav (choice law).

## Gates (raw)

- **`e2e/qrroses-smil.mjs` 7/7** — 23 frames sampled on the page's own clock via
  `svg.setCurrentTime` (growth through 4 minutes of forage): **every frame reads the
  exact payload in BOTH oracles** (jsQR + zxing; `RGBLuminanceSource(lum,w,h)` — the
  qrtree arg-order lesson honored); plus SMIL-advances, plate-animation-free,
  reduce-still-decodes, 390px@dpr2-decodes. Run local, on final bytes, and **against
  the live URL** — all green.
- **design-acceptance 12/12** on final bytes.
- **Live render-test, real engines:** Chromium (full live frame gate) · **Firefox** ·
  **WebKit** — each: SMIL advancing, seeked frames both-oracle exact, reduced-motion
  paused + decoding, 390@dpr2 decoding. **No negative result.**
- Citizen wiring: estate.json row `blight-qrroses-smil`, atlas **88 listed · 79
  counted**, estate-check PASS; review deck initially 78 — **CI-caught** (coverage
  certifies against the tree), fixed to 79/79 in `65eaf0c`.
- Receipt shots: `e2e/shots-lane-d/` (live 390px mid-forage + full page).

## Notes for the record

- First zxing oracle leg returned null on every frame — **gate bug, not piece bug**
  (jsQR green throughout); fixed with proper `MultiFormatReader` hints before any
  conclusion was drawn.
- The design gate's structural probes (D1 `section`/`.art`, D5 `section`) taught the
  same lesson as Lane C: panes became real sections, the svg holder carries `.art`.
- If SMIL had failed on a target browser, the ordered verdict was a negative-result
  report + canvas stays the shipping piece. It did not.

## Fences (standing, held)

- Friction: instrument only, nothing boarded from it.
- Zero off-origin, everything inline; no JS animation; no JS shim ever.
- Files touched: the new surface, its gate, registry/atlas/review-deck wiring rows
  only. Lane B untouched.
