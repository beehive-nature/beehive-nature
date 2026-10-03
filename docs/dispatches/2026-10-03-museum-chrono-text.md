# 2026-10-03 — museum chronology table: words stay whole (zCode seat)

Founder pasted a 1920×1080 screenshot of `surfaces/blight/museum.html`, Exhibit 4 ·
The chronology, asking for the text bugs to be fixed. The table read broken at every
column: `date` as "dat / e", `class` as "clas / s", "2014-01-02" as four stacked
fragments, "Counterparty genesis" split inside the word.

## Root cause

`body{overflow-wrap:anywhere}` (the page-wide guard that keeps long tokens from
poking out of the vitrine) inherits into table cells. `anywhere` — unlike
`break-word` — also collapses a cell's intrinsic **min-content width to one
character**, so the table's auto layout was free to starve the short columns while
the note column's enormous max-content (~3000 px of prose) won the width contest:
date got 37 px, object 64 px, class 40 px at **desktop** width (measured, viewport
1920; identical at 1200/900/800/700/640). The phone-stacking rule at ≤600 px already
carried the house law in its comment — "nothing is ever squeezed to a letter-wide
column" — but nothing enforced it above 600 px.

Reproduction receipts (Playwright/Chromium, file://, default register):
`Range.getClientRects()` line clustering showed date rendered on 4–5 lines,
header "date" on 2 lines, at every tested width ≥ 640. Scripts kept at
`scripts/tmp/museum-textbug/` in the shared checkout (repro.js, linewrap-probe.js,
verify.js) — not part of the commit.

## Fix (one file, `surfaces/blight/museum.html`)

- `.scroll th, .scroll td, div[style*="overflow-x"] th/td {overflow-wrap:normal}` —
  inside the wall tables words stay whole; notes wrap at spaces; anything genuinely
  wider than the table scrolls in its own box (the page's stated design).
- `#chrono th, #chrono td:first-child, #chrono td:nth-child(3) {white-space:nowrap}`
  — the short columns (headers, dates, class chips) never wrap.
- `<table id="chrono">` added to the Exhibit 4 table so those rules are scoped to it
  alone; the six-class table's "survives its author" column keeps wrapping.

The `#eternal` cypherpunk overlay is untouched: its `overflow-wrap:anywhere`
(line ~268) is deliberate for mono receipts and none of its tables sit inside
`.scroll`/inline-overflow containers.

## Verification (fresh, this lane)

Post-fix `verify.js` at viewports 1920/900/800/700/640/601/590/390:
headers 1 line, dates 1 line, class cells 1 line in every row at every width;
zero crushed cells (no cell narrower than ~2.5 characters) across all six
`.scroll`/inline-overflow tables; ≤600 px stacking intact (headers hidden, cells
full-width). Exit code 0, "ALL WIDTHS CLEAN". Visual pass on the 1920 px capture
confirmed whole words. Claim boundary: rendering verified locally in Chromium
only; the public deploy is verified in the PR CI and by the render check noted
below.

## NEXT OWNER

None — lane closed on merge. Post-deploy public-render spot-check of
`surfaces/blight/museum.html` Exhibit 4 belongs to whoever's next on museum duty;
no obligation created here.
