# svgwall — inscriptions.app, measured; the wall demo, measured

Read-only diagnosis of **https://inscriptions.app** (Inscript — React/Next.js
App Router SPA, Froggi ecosystem), 2026-08-26, real Chromium 1440×900, two
runs + targeted passes (`measure-inscriptions.mjs`, `measure-gallery-panel.mjs`,
`measure-gallery.mjs` in this dir; shots/ has the evidence). No login, no
wallet connect, no submissions — loading, scrolling, reading.

## His site, measured (anonymous)

| metric | run 1 | run 2 | verdict |
|---|---|---|---|
| FCP | 900 ms | 1,584 ms | fine for an SPA |
| LCP | 3,008 ms | 3,684 ms | mediocre, not fatal |
| TTI (approx: last long-task end) | 3,389 ms | 2,748 ms | acceptable |
| DOM nodes (landing, settled) | 1,435 | 1,483 | **small — no node explosion** |
| inline `<svg>` count / biggest | 24 / 126 children | 24 / 93 | icons, not art walls |
| `<img>` / `<canvas>` | 13 / 5 | 13 / 5 | previews are canvas/img |
| requests total | 47 | 47 | modest |
| max requests in flight | 19 | 20 | **parallel, not serial** |
| JSON-RPC calls | 2 × `eth_call` | 2 | both fired the same instant; no batching problem at this scale |
| long tasks | 3 / 261 ms | 3 / 320 ms | mild (max 141 ms) |
| transfer | 1.9 MB | 1.9 MB | ok |
| JS heap | 12 MB | 11 MB | small |

**The actual #1 finding is functional, not performance:**
`GET https://inscriptions.app/api/gallery` → **HTTP 500** (0.45 s, Vercel
`sfo1` error id), on every visit; it is the only console error on load.
The Gallery panel that opens from the nav (after dismissing the intro modal)
fires **zero** further requests anonymously and shows per-project
"NO INSCRIPTION — own at least 1 $FROGGI…" states: the populated gallery is
**wallet-gated**, so a populated wall cannot be measured without connecting a
wallet (out of bounds for this lane). `/gallery` as a URL is a 404 — the
gallery is a client-side panel only.

## Hypothesis scorecard (measured, not theorized)

- "inscriptions are inline `<svg>` element trees" — **not observed** in the
  measurable anonymous experience: previews are `<canvas>` (4 project cards)
  + 13 `<img>`; the 24 inline svgs are small icons (≤126 children). Whether
  the wallet-gated gallery mounts inscriptions as inline SVG is **unverified**.
- "requests are serial / need batching" — **wrong**: 19–20 requests in flight
  at peak; the only two RPCs fire simultaneously.
- "long tasks / TTI are the problem" — **wrong**: ~300 ms total long tasks;
  TTI ≈ 2.7–3.4 s.
- **the real observed defect is the 500 on /api/gallery** — every anonymous
  visit pays a failed fetch and an empty gallery.

## Our wall, measured (`index.html`, self-contained, zero off-origin)

50 BQueen-class pieces × 9,216 polygons (460,800 polygons per wall), the SAME
50 generated strings mounted two ways. Seeded PRNG art, no CDN, no build step.

| | inline `<svg>` | data-URI `<img>` | delta |
|---|---|---|---|
| mount | 1,222–1,294 ms | 4,278–4,476 ms | **img 3.3–3.7× slower** |
| re-render (React-commit equivalent) | 1,670–1,686 ms | 4,613–5,346 ms | **img 2.8–3.2× slower** |
| DOM nodes | **460,900** | **50** | 9,218× fewer |
| fps during re-render (rAF timeline) | ~0 | ~0 | both starve the thread |
| long tasks (whole session) | — | — | 16.5–17.1 s total, dominated by SVG-image decode |

**The surprise, reported plainly:** at this scale the "obvious fix" is not a
win. Chromium rasterizes SVG *images* on the main thread, so 50 × 9,216-polygon
data URIs decode into 15+ seconds of main-thread long tasks — worse than
parsing the same strings as DOM. What data-URI `<img>` does buy is the DOM:
9,218× fewer nodes (every future style recalc, React commit, and hover is
cheap; memory stops scaling with polygon count).

**What we would actually offer the peer** (not built here — this is the
diagnosis hand-over):

1. Fix `/api/gallery` (500) — nothing else is measurable until it returns.
2. If the wallet-gated gallery does mount inline SVGs at scale: pre-rasterize
   each inscription to a **PNG/WebP blob URL at tile size** (raster decode is
   off the main thread) rather than either raw approach in this demo — then
   the DOM win of `<img>` comes without the SVG-decode tax, and `createImageBitmap`
   keeps it off-thread.
3. Virtualize the wall (render visible tiles only) regardless of format.

## Files

- `measure-inscriptions.mjs` — landing, 2 runs, full metric table
- `measure-gallery-panel.mjs` — opens the gallery panel read-only (Escape the intro modal, click the public Gallery nav)
- `measure-gallery.mjs` — proves `/gallery` is a 404 route
- `index.html` — the demo (both walls, live FPS/nodes/long tasks, re-render buttons)
- `shoot-demo.mjs` — drives the demo and prints/screenshot its numbers
- `shots/` — evidence
