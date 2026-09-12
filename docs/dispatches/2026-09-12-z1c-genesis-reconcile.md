# z1.c dispatch — #28/#31 reconciliation candidate manifest (2026-09-12)

**Assignment:** Astra ruling #10 5648661483 → "reconcile #28/#31 as one
release proposal… return a file manifest and focused candidate before any
merge." Candidate head: **`e17fe953`** (this dispatch rides the descendant).
Base: main `00258d7c`; verified **zero path overlap** with the #61 Bloom
merge that advanced main to `0aede743` — the candidate remains purely
additive against current main.

## Manifest — 63 files, all additive

Ruling applied: canonical Blender source/rendered assets from **#31**
(`26aa68eb`); marketing presentation + credited references from **#28**
(`dc33607e`); dedupe by content hash; original mother/LoVis artwork
provenance and purple-human / teal-AI / green-biomass meaning preserved.

**From #31 — 42 files (canonical 3D + study record):**
- Blender sources: `models/original-genesis-study.blend`,
  `motion/green-teal-breathing.blend`, `motion/green-teal-breathing.mp4`
- GLB models ×4: green / green-teal / purple / teal `-original.glb`
- Builders + verification: `build-study.py`, `build-breathing-blender.py`,
  `build-breathing-svg.py`, `trace-original.py`, `verify-study.py`,
  `verify-breathing-video.py`, `geometry-receipt.json`,
  `verification.json`, `source/cells.json`, `source/trace-overlay.png`
- Study dispatches: artist-animation-storage, breathing-bloom,
  grok-motion-board-review, original-logo-3d, founder-color-meaning
- 19 byte-identical shared files (renders ×5 incl. `original-blooms.png`,
  motion studio html/css/js + poster + receipts, transparent source PNGs ×2)
  — carried once, provenance both branches
- 1 ruled shared file: `README.md` at #31's canonical study version (#28's
  copy stripped the study links and deferred heavy assets to "draft PR
  #31" — a consumer-branch note obsolete once the union exists)

**From #28 — 21 files (marketing presentation + credited references):**
- `marketing.html` review board + `assets/genesis-3d/motion/board.js`
- Festival/observation: festival-hypothesis-brief, festival-pilot-brief,
  observation-guide, observation-scorecard, newcomer-observation-scorecard,
  claim-to-proof, storyboard BEATS + newbee-15s-poster.svg
- Dispatches: grok-beads-newbee-outreach, grok-claim-27,
  grok-genesis-campaign-pack, plur-paired-hands
- Founder PLUR artifact family verbatim: `plur-paired-hands-v1.png` +
  prompt + dispatch (mother/LoVis provenance)
- Genesis SVG assets + PROVENANCE.md + build-blooms.mjs

**Explicitly excluded (verified absent from the sets):** first-work/Bloom
release-candidate paths (#61/z1.a family) — the bloom-NAMED files in this
manifest (`breathing-bloom` dispatch, `original-blooms.png`,
`build-blooms.mjs`) are genesis-3d art with no path overlap; Watch/media-
owned files (`surfaces/plur.html`, watch companion scripts per #42).

**Not carried:** both branches' stale copies of files main already advanced
(corpus, atlas, shared surfaces) — reconciliation is additive-only, no
regressions. Both original branches and PRs remain untouched as the record.

## Status

Draft PR for Astra's review; **no merge, no closure, no campaign launch** —
internal board release only, per the ruling.
