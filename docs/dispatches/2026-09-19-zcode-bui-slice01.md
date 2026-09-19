# bUi Slice 01 — Daily Art Manifest (writer seat zCode, queen order 1822fa54)

**STATE** · Slice 01 candidate complete on branch `zcode/bui-slice01-daily-manifest`,
cut from `origin/main` @ `c617e042` (the sha bee-laborer pinned; the map's `0e1c22ec`
base moved when `871e3b31` took the registry to 96 — erratum already filed by bFaBLe5.1).
Nothing merged; founder judges in the UI.

**CLAIM** · The daily art engine is built and gated: `manifest = f(protocol version,
UTC day, state root, previous accepted manifest hash)` — pure, browser-side, art
parameters only, content-addressed, append-only chain from a fixed genesis
(2026-09-19, prev = 64 zeros). Every manifest carries date, input hashes, generator
version, its own hash. The state root is baked by `build-atlas.mjs` as
`<body data-state-root>` (sha256 of the estate.json bytes as served) and asserted by
a new `estate-check` row. bFUzZ's two build requirements are in: injectable clock
(the only clock read is the module boundary; the gate freezes the page clock through
the real boot) and replay from recorded input hashes (the chain folds from genesis,
never from storage — a poisoned cache provably never changes the render).

**EVIDENCE** ·
- Engine + render layer: `surfaces/daily-art.js` (page-asset, register.js class;
  self-contained: no deps, no requests; integer-only derive path; scratch-buffer
  sha256 verified against node:crypto on 300 randomized strings + FIPS vectors).
- Static proofs: `e2e/bui-daily-art.test.mjs` — **11/11 green**, incl. golden
  vectors pinned for genesis and day 2 (PUBLIC-CONSTANT marked), fast-fold equals
  the generic canonical path across a 120-day sweep, tamper rejection on ten
  mutation classes, P4 synthetic 1,826-manifest chain **18.5ms** (budget 150).
- Rendered gate: `e2e/bui-daily-art-gate.mjs` — **23/23 green**: 24 cells
  (3 frozen dates × 3 modes × 2 widths + 6 reduced-motion), facts byte-identical
  across the whole matrix (counts, hrefs, preserved band, nav), manifest
  byte-identical per date across modes/widths and different across dates,
  rendered art visibly differs across dates, broken candidate rejected+recorded
  with fallback to the previous accepted day rendered, cache-never-authority,
  attribute-flip replay (recorded inputs ignore the live attr; a flipped attr
  derives a different hash — fork visible), P4 throttled median **119ms**
  (budget 600), P4 unthrottled median 39ms, P3 single derive <0.1ms, P5 first
  paint 8ms after DCL (budget 200), P9 differential proof the module adds zero
  runtime requests, zero page errors, 390px no horizontal overflow.
- Ritual: `scripts/build-atlas.mjs` (state-root bake + `daily-art.js?v=1` tag),
  `scripts/estate-check.mjs` (new data-state-root row), regenerated
  `surfaces/index.html` riding the same commit; `daily-art.js` is a page-asset,
  not a counted surface (96 unchanged, estate-check PASS).
- CI: static list += `e2e/bui-daily-art.test.mjs`; node job += the rendered gate,
  both `if:always()` (lint-ci-shape law).
- Local family re-green: `estate-check` PASS; `atlas.test` + `register.test`
  29/29; `estate-source` red on the drift row is the PRE-COMMIT state by design
  (it restores HEAD and demands the regenerated page ride the commit); re-verify
  post-commit below.

**BOUNDARY NOT CROSSED** · No estate data touched (counts stay the registry's —
96/41/58, from build only, never hardcoded). No `--sem-*` or `--b-value` touched;
overlay palettes are neutral opacity/softness families, zero new hues. The
preserved hex band is layered over, never retyped. No merge/deploy (founder-gated).
Art changes palette/composition/motion/emphasis/decorative geometry ONLY — never
payment, wallets, privacy, route truth, counts, provenance, permissions.

**CHANGED** · Branch `zcode/bui-slice01-daily-manifest`, one commit riding the
full beat: engine, gate, generator+check rows, regenerated hub, CI wiring, this
dispatch. Nest: `PLANS/BUI_MISSION.md` log updated.

**NEXT OWNER** · bFUzZ — PROVE per `PLANS/BUI_SLICE01_PROVE_RULING.md`; the
acceptance matrix is wired and runnable (`node e2e/bui-daily-art-gate.mjs` from
e2e/). Then the founder judges the three readings in the UI.

**FOUNDER ACTION** · Judge the candidate in the UI when PROVE returns green.

## Post-commit verification addendum
(to be appended after the commit lands: estate-source drift row re-run)
