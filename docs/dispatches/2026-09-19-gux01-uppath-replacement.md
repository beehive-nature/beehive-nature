# GUX-01 — the upPath replacement (one resolver, two environments, consumed)

Branch: `zcode/gux01-ui-atlas` (this commit on `12b83eaa`)
Executed by: ZcODe5.3max (GLM 5.3), zGeneUI seat, founder helm order `153d87d1`
+ founder steering `bdf59735` (consume the core ONLY to kill upPath; no
redesign; primary journey untouched; then engineering stops).

## What this does

The safe-direction adapter (`upPath`, founder order `f6320450` era) is DEAD,
replaced whole by the corrected archive resolver — `surfaces/archive-core.mjs`
composed verbatim at the named tip `e1948156` (bFUzZ's ARCHIVE CORE EXTRACTION,
PR #128; zero imports, browser-safe, founder-ruled minimal contract:
`createArchiveCore(model) → relationshipPath / bloodlineSet / resolve /
searchNames / cyclicAncestryOf`; F3 stays at the node construction layer).

- `blood-nav.mjs`: `upPath` deleted; `hopLabel` (parent-only) became
  `stepLabel(via, id, persons)` — parent hops mother/father/parent, child hops
  son/daughter/child (each from the step target's gender), spouse steps spouse.
  `relToRoot` consumes `ctx.archive.relationshipPath(sel, root)` and renders
  the resolver's three shapes symmetric: **below** (apex IS the root),
  **above** (apex IS the selection), **collateral** (blood through the NAMED
  common ancestor, up/down hop counts), **affinity** (marriage — never blood,
  sharedDescendant surfaced), **none** (honest boundary). Disputed flags
  (cycle-crossing paths) surface, never settle silently. Without a resolver
  instance the boundary renders honestly — fail-soft, never a guess.
  `generationContext` (search disambiguation) consumes the same resolver;
  collateral says "related through a shared ancestor".
- `blood.html`: the archive core boots ONCE on the MERGED model (corpus +
  attested overlays — the 20d5c74a lesson, indexes after the overlay merge)
  via dynamic import in the classic script, fail-soft; both modes share it
  (the ONE search box lives in the incumbent script). The incumbent fallback's
  relationship-to-root section renders all three shapes with direction-true
  arrows (↑ parent, ↓ child, ≈ spouse); the two on-screen promise sentences
  ("sideways/downward hops render once the corrected path API lands") are
  RETIRED — the promise is kept. **The mounted (engine) path is untouched:
  the person panel remains THE explanation surface (one-explanation law).**

## Corpus truth that changed (the correction, honestly)

- donna→root: blood, apex=Donna, 2 hops (above) — unchanged.
- root→APR: blood, 5 hops (below) — unchanged.
- **donna→APR: AFFINITY — spouseSteps=1, sharedDescendant=true.** Slice-2's
  safe-direction adapter said "none — different branch". The corrected truth:
  the Lowry and Rockwood lines are connected by marriage and share descendants.
  The old boundary was honest for what it computed (parent-step-only climb);
  the resolver sees the whole graph. Rendered now as "family by marriage —
  NOT a blood relationship; you share descendants (co-parents)".
- liv-1↔liv-2: affinity, spouseSteps=1 — the lock upgraded from "no parent
  line either way" to "the resolver sees the marriage and calls it affinity".

## Evidence

- `node --test tools/genealogy/*.test.mjs` = **192/192** (three-shape contract
  tests on synthetic fixtures incl. the disputed-cycle case; corpus locks:
  Donna above 2, founder below APR 5, donna→APR affinity-never-blood, liv pair
  affinity; wiring: resolver boots on the merged model, collateral + affinity
  render, the retired promise sentence test-locked ABSENT).
- Real-surface journey `e2e/gux01-blood-journey.mjs` = **29/29 beats PASS,
  GREEN, zero page errors** — the primary mounted journey is intact.
- Invariants harness at bFUzZ's tip `e1948156`: 12/12 synthetic, 5 fuzz
  buckets × 0 violations, F2 true/true, F3 throws+named (re-run by me,
  founder-ordered).
- estate-check PASS 96/105; build-atlas identical (105/96/191715 — page-asset
  class, no drift); CR=0 all touched files; no new hex ≥48.

## Boundaries not crossed

No corpus writes; `archive-core.mjs` composed verbatim (bFUzZ's bytes, their
branch's receipt); person-panel bytes untouched; engine bytes untouched
(already at `41bbcb02`); the mounted experience unchanged by design; living
stay anonymous; public projection only.

## Per the founder's stop line

This is the last GUX-01 engineering beat tonight. What remains is the
founder's browser-seat pass on PR #125 (thread `fcd6a2fc`, checklist
`d5219a59`).
