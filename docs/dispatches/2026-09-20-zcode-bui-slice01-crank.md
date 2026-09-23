---
title: "bUi Slice 01 - CRANK dispatch (founder order eae141a0)"
tags: [bui, slice01, daily-art, crank]
status: active
created: 2026-09-20
---

# CRANK: the daily overlay is audible at a glance

Order: founder decision 2026-09-20 17:22Z (event eae141a0, cancels queen hold 8891d068): **crank, then merge**. Scope = bGrokBot visual read (WORK_LOGS/2026-09-20_BGROKBOT_BUI137_VISUAL_READ.md). Re-sequenced one step earlier than the order literal: the rebase onto fresh main moved FIRST because CI estate gates (estate-check data-state-root, estate-source hub regeneration) judge the PR merge against current main and were red against the stale base - the acceptance images and the PROVE therefore attach to the final rebased tree.

## Levers (attribute-level only; derive path and manifest bytes UNTOUCHED)
- palette opacity families 0.08-0.22 -> **0.24-0.52**
- **FAINT=0.35 baseline: every shape family faintly visible every day**; the day's variant BOOSTS its family, never hides another (was: variant gated whole families to opacity 0)
- motes 1-3px -> **2-6px** (boosted +1)
- tree ring **always visible**: opacity 0.15/0.27/0.39 by ringEmph (was 0/0.10/0.20), border 1/1.5/2px
- no hue change, no facts/routes/counts change; skeleton and element counts unchanged (fixed-skeleton law); generator_version NOT bumped (pre-merge free parameter change per the order)

## Base state after this commit
- rebased onto origin/main ea388cac (I-1 + SS-2 + SS-1 wave); 4 commits replayed clean
- registration beat: node scripts/build-atlas.mjs re-run on the merged hub; state root 4f84f5e9 -> **cd086782** (main advance #135/#138 + baked attributes; daily-art.js itself is not a root input - the earlier local run proved root stable across the engine edit)
- the staged activate-on-land batch (tests.yml front-door line + 11 rows, measurement event 1a69cb7f) stays STAGED in the worktree, deliberately uncommitted until the PROVE verdict, per the order chain

## Receipts (final tree, root cd086782)
- static suite 11/11 (pinned golden vectors -> manifest bytes provably unchanged by the crank)
- rendered gate **25/25** on the rebased tree (root consistency row green at cd086782), incl. one gate fix: P9 differential now asserts SUBSET semantics ("the art module adds zero requests") - the old strict set-equality compared a 250ms post-load ear against a 650ms ear and failed on the hub's own lazy scripts landing in the longer ear only; timing, not art. The subset check still fails the moment art adds any request of its own.
- numbers @390px, tolerance 8/channel, bee mode, root cd086782 (variants v2 / v2 / v1 across the three frozen dates):
  - full page (390x2553) pairwise pixel delta: d1-d2 **17.57%**, d2-d3 **12.30%**, d1-d3 **11.98%** (ledger before crank: 0.44-1.9%)
  - masthead (390x1651) pairwise: 27.17% / 19.01% / 18.53%
  - intermediate pre-rebase numbers at the old root (4f84f5e9, variants v3/v1/v4): full page 18.32/20.32/21.74 - kept as build evidence, superseded by the rows above
- 3-date 390px strip (receipt, final): https://skaists.buzz/media/39177a29579e2c2561bf6dd336eaf5991498c6e2c836781f3d4786fc39072616.png PUBLIC-CONSTANT (content-addressed, sha256 = media id)
- writer's at-a-glance read: three different hubs - line-network day / bright-dot day / dense-mote-cloud day; tree ring visible in all three

## Next (chain per order eae141a0 + laborer routing 01df176b)
1. bFUzZ delta-PROVE (facts identical bytes, determinism holds) on the final sha
2. commit the staged activate-on-land batch as its own beat
3. bee-laborer merges #137; LIVE URL confirm (merge = live proven by pages-build-deployment on ea388cac)

## Artifacts (local, not committed)
.scratch/bui_crank/{full,mast}-<date>.png + strip-3dates-390.png (final, root cd086782); generator .scratch/bui-crank-shots.mjs
