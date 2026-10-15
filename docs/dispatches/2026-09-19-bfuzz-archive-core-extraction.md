# 2026-09-19 · bFUzZ — Archive core extraction: one relationship resolver, two environments

Lane: GUX-01 zGeneArchive. Parent commit `0f44ee77` (Archive 1.1) on branch
`bfuzz/gux01-archive-graph` from worktree `REPOS/wt-bfuzz-gux01-archive`.
Ordered by the helm (ZcODe5.3max, event abb5533d: the surface cannot import
the node wrapper — the corrected relationshipPath existed but was not
browser-consumable) and SHAPED by the founder ruling bdf59735, which arrived
mid-extraction and cut the design down to its law:

> one relationship resolver, two environments — not "move archive.mjs into
> surfaces."

## What landed

- `surfaces/archive-core.mjs` (NEW, 296 lines, ZERO imports — no node:*,
  no model.mjs, no peers): `createArchiveCore(model, {registry})` returns
  exactly the founder-named contract — `relationshipPath`, `bloodlineSet`
  (memoized; model.mjs's bloodline law ported verbatim with attribution),
  `resolve` — plus `searchNames` (its only data dependency is the person
  table the resolver already owns — the founder's "naturally part of the
  same immutable core" test, met) and `cyclicAncestryOf` (ONE accessor over
  the cycle map the resolver already builds for disputed flags — exposed so
  the wrapper's panel reads it instead of owning a second Tarjan; named here
  so the founder can veto the surface growth with one word).
- `tools/genealogy/archive.mjs` (rewritten, 319 lines) — now the ARCHIVE
  CONSTRUCTION LAYER: fs loaders, staged objects, reconstructions, panels,
  inventory, privacy gate — and the F3 duplicate-provider-ref law, which the
  founder ruled stays HERE (construction/integrity), not in the browser core.
  The core receives an already-validated model and trusts its input. The
  wrapper delegates resolve/relationshipPath/searchNames/bloodlineSet to the
  ONE resolver; relativesOf/coverage/personPanel stay wrapper-side per the
  "extract only what is genuinely pure" refinement. Public API byte-identical.
- `tools/genealogy/archive.test.mjs` (+2 tests): the zero-import law locked
  by source scan (no static/dynamic import, no require, no module specifier)
  + the founder contract exercised directly on a bare parsed model (collateral
  path shape, resolve, bloodline membership incl. a negative case, search,
  cyclicAncestryOf null off-cycle).

## Evidence (run at this commit's bytes, this worktree)

- `node --test tools/genealogy/*.test.mjs` = **77/77** (75 prior + 2 new,
  zero regressions).
- Invariants harness `.scratch/gux01_invariants.mjs` — IDENTICAL to the
  pre-extraction receipt: 12/12 synthetic, 246/246 fuzz pairs × both
  directions × 5 buckets 0 violations, F2 probes true/true, F3 throws+named.
  Byte-for-behavior preserved through the extraction.
- estate-check PASS 96/105 and build-atlas 105 listed · 96 counted · 191715
  bytes — both IDENTICAL to the pre-change run (the surfaces/*.mjs module
  precedent: blood-atlas.mjs / person-panel.mjs / blood-nav.mjs carry no
  estate.json rows; no ceremony delta, no surface drift).
- CR=0, hex≥48=0 across all three files.

## Boundaries held

- No engine, person-panel, blood.html, blood-nav, or corpus bytes touched.
- No resolver duplication anywhere: the browser and the wrapper run the SAME
  implementation (the advisor's duplication ban honored).
- No corpus writes; read-only; no new schema beyond the core's own constant.
- The wrapper's F3 throw message is byte-identical (loadArchive: provider ref
  resolves to multiple persons...).

## Next owners

- zGeneUI (ZcODe5.3max): consume `surfaces/archive-core.mjs` ONLY to kill the
  incumbent fallback's upPath (founder: do not reopen the green 29/29 primary
  journey; primary mounted experience unchanged); rerun invariants + the real
  surface.
- Founder: browser-seat pass on blood.html remains PR #125's merge gate;
  PR #128 merge to the lane whenever blessed — the consumer builds against
  named tips by composition either way.
