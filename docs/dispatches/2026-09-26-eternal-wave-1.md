# ETERNAL wave 1: 30 more surfaces as three products each (2026-09-26)

**Seat:** Claude (cloud session). The founder is the author and Claude the committer, as in the earlier dispatches.
**Branch:** `claude-lovis/magical-allen-dd0xqh` (PR #239).
**Order:** "EVERYONE ACTUALLY HAS TO BUILD THREE SEPERATE UI/UX'S IN THE SINGLE SURFACE", measured against skaists, the design system graded A- (see `2026-09-26-eternal-blueprint.md`). Standing order: "push everything out. we will look at it once it is live on github/pages".

## What landed
Each surface follows the flagship pattern (`surfaces/blood.html`):
- One `<section id="eternal">` holds three fronts: `.et-b` new bee, `.et-r` raver and `.et-c` cypherpunk.
- Each front differs in layout, graphic, gesture and voice, not only in colour.
- One data layer, exposed as `window.__eternal`, reads the page's own facts, so the fronts cannot drift from each other.
- Every gesture hands off to the page's existing real flow.
- The whole old page stays below under `h2.et-archive-h`, dressed per register on `--sk-*` tokens.

| batch | surfaces | commit |
|---|---|---|
| E6 | bigen, bfood, bearth, blongevity | 39c10932, d84aaabc |
| E8 | austras-koks, buzz-directory, bnames, bnamesday (+ tree-of-life on skaists) | ef41a0f5 |
| E1 | bdata, vending, profile (wallet stays frozen, #235) | a6eb4669, 6cdcdcb1 |
| E3 | bview, museum, watch | d74ec115 |
| E2 | music, listening, festival, plur | c0fc90c6 |
| E4 | bLighT museum, fLeeT, gallery, market | 680d1375 |
| E7 | read, blanguage, review, university | f0549b46 |
| E5 | onboarding, onboarding/receive, myspace, kandi | 86fe3e21 |

Each commit message holds its surfaces' flow, the three UIs, the facts and their sources, and the before → after whole-page scores.

## Receipts
- **Tests:** each surface has its own `e2e/<page>-eternal.test.mjs`, and each test was run against the HEAD page and failed there before the change. Each proves:
  - exactly one front per register, with that register's own dress;
  - the same facts in all three fronts and in `__eternal.data`;
  - honest hand-offs (a short hold is a no-op; the real flow opens);
  - the laws: no dash, NaN or undefined; no text-transform; 44 px; no sideways scroll at 390 px.
- **CI:** the tests run in the "ETERNAL fronts" step.
- **Meter:** `skaists-conformance --min 100` holds all 31 fronts (with blood.html) at 100% in all three registers: COLOUR, TYPE, RADIUS, TARGET, CONTRAST and CASE. It was run on the committed tree alone at 86fe3e21, and CI gates it.
- **Whole-page score:** it rose on every surface. Many now score 100 in all three registers.
- **Other checks:**
  - `footer-audit`: 0 findings on every batch;
  - `estate-source`: 11/11;
  - `build-skaists --check`: fresh.
- **Existing gates that touch these pages** stayed green, with the counts named per commit. Where a test asserted the old structure, it was moved to the new equivalent, and the commit says why.

## Traps met (for the next wave)
- **estate-source reads `data-i18n="…"` literals in page source.** A selector string like `'[data-i18n="'+key+'"]'` or `'…prof.rec.type.guest"]'` reads as a drifted or missing key. Match on `dataset.i18n` instead (6cdcdcb1; blight/museum `tableAfter` in 680d1375).
- **Tests that count page-wide markers are fooled by the fronts' drawings.** For example, art-tuple-verify counted every `svg`, and myspace-seam counts `[data-purpose]`. Scope the count to the old page (`#wall svg`) or use a front-only attribute (`data-et-purpose`).
- **register.js's shared rules reach into fronts.** They set the reading-room violet raver ground and `p` colours in themes. Pages override at page level; register.js was not touched.

## Not done (named)
- **Translations:** the new `et.*` strings are English through `T(key, english)` → `BNRLanguage.text`. None is in `lang-corpus.json` yet.
  - Counted on this tree: 729 distinct `T('et.…')` literals, and 1,136 distinct `et.*` key names referenced in the pages.
  - The second count includes families built at runtime and `data-etk` statics.
  - The corpus pass is the next language lane.
- **Live chain and network reads** are blocked in this box. Every live read was seen only in its failure state, and success states were proved by injected fixtures. `art-tuple-verify` fails 10/10 on HEAD and 10/10 after, for the same reason.
- **Waiting on the founder, not acted on:**
  - the profile manifest pins `lineage_corpus` at 84D37120…, while `remington-bloodline.json` now hashes 01b592de… (#222 changed it); it was not re-pinned silently;
  - a three-UI plan for wallet.html (frozen);
  - the design-system eyebrow "uppercase" specimens and D4, which conflict with the casing law;
  - `three-node-plan.md` and `server-exit-plan.md`.
- **The remaining ~70 surfaces** follow in further waves on the same brief and the same bar.
