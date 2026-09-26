# GUX-01 - the Rule A seam swap (the panel speaks the ONE resolver)

Branch: `zcode/gux01-ui-atlas` (this commit on `e962b6eb`)
Executed by: ZcODe5.3max (GLM 5.3), zGeneUI seat. Founder ruling `32e28d07`
(Rule A: grow the core shape additively; one truth, one resolver) + the GO
receipt (sprint thread `dba361e0`, `3c2c8783`) ordering exactly the staged
execution: ancestry check, verbatim compose, read-not-guess the contract,
replace the panel derivation, G4 in the same commit, agreement battery fully
green, then 29/29.

## What this does

The panel corpus adapter (`surfaces/person-panel-corpus.mjs`) stops deriving
relationships. Its TEMPORARY pre-Archive-1.1 BFS - the seam its own header
declared replaceable, the G1 defect (10,227 stale "none" reads vs the
resolver; two truths on one page) - is REPLACED WHOLE by delegation to the
composed archive core:

- `surfaces/archive-core.mjs` + `tools/genealogy/archive-core.test.mjs`
  composed VERBATIM at organ tip `54462935` (bFUzZ, `bfuzz/gux01-archive-graph`,
  descendant of `e1948156`, ancestry verified; blob-hash byte-identity both
  files). The G3 spouse facet is real code now: schema
  `skaists.archive-core/1.1`, married cousins classify `blood-and-affinity`
  with `spouse: { couple, note }` naming the exact corpus couple record -
  additive, single-kind outputs unchanged, no export growth.
- `person-panel-corpus.mjs` mounts `createArchiveCore` ONCE on its own merged
  tables (after the overlay merge - the 20d5c74a lesson; same truth the page
  boots) and `relationship(a, b)` becomes a pure presentation mapping of
  `core.relationshipPath(a, b)` onto the panel's frozen Relationship
  vocabulary (kinds, `blood.mode`, hop labels/evidence). The facet renders
  the existing `blood-and-affinity` direct-spouse hop - the facet carries the
  truth, the panel never recomposes (no couples read inside derivation).
  The panel's bounded "none" wording is preserved verbatim.
- G4 rides the same beat: the adapter's second Tarjan is DEAD. Cycle
  membership on views, discoveries, and relationship `cyclic` flags all
  consume `core.cyclicAncestryOf` - one graph engine.
- `tools/genealogy/agreement.test.mjs` (the red-first G1/G2/G3/G4 gate
  battery, staged last session) is now fully green: both PENDING-FACET skips
  unskipped against the shipped `spouse.couple` field.

## Truth flips (named, honest - the acceptance the founder asked for)

- **G1**: donna -> APR reads **affinity** on the panel (was the stale
  "none - a different branch"); the Lowry-Rockwood marriage renders, never
  as blood. Stride-10 sweep vs APR: 0 stale nones.
- **G2**: one apex per pair, every surface. C4's locked exemplar flips:
  Miriam/Samuel name **Prudence Thurlow 1701-1744** (`p9db65dd807`) - the
  canonical resolver's deterministic tie-break (the old BFS named Joseph
  Hadlock 1700-1744, an equal-depth tie). Jack Benedum Sutphen vs APR: the
  page truth is affinity (he married into the Lawton line); the old
  "panel Joseph Clarke vs core Rev. John Maxson Sr" contradiction was an
  artifact of two derivations - one resolver ends it.
- **G3**: all 674 married-cousin pairs carry BOTH truths - core facet
  `blood-and-affinity` whole-blood shape + panel renders blood AND the
  direct-spouse affinity hop.
- **Model law discovered en route**: the reference core must see the EXACT
  model the page boots - overlay parent refs resolved through `refsIndex`,
  exactly as `buildArchive` does. A naive assign-merge drops those marriages
  and surfaces diverge (this was the G1/G2 era's hidden confound). Under the
  page model the merged public projection is ONE weakly-connected component
  (10,259 persons, measured): every published pair answers; the honest
  `none` boundary (and its bounded wording) now locks on a synthetic
  two-island corpus.

## Evidence

- `node --test tools/genealogy/*.test.mjs` = **212/212 pass, 0 fail, 0
  skipped** (192 prior with in-place truth updates + 11 organ battery
  `archive-core.test.mjs` + 9 agreement locks, both PENDING-FACET unskipped).
- Real-surface journey `e2e/gux01-blood-journey.mjs` = **29/29 beats PASS,
  GREEN, zero page errors** - desktop + deep-link 1 + deep-link 2 + 390px;
  camera beats exact (cold `{k:1,x:0,y:-176}`; deep-link 2 `{k:1.6,x:-100,y:80}`
  at boot AND Back-home). Re-shot receipt PNGs ride this commit.
- Corpus untouched: `git diff 97f18945 -- assets/profile-archive` empty.
- Organ byte-identity: `git diff 54462935 HEAD -- surfaces/archive-core.mjs
  tools/genealogy/archive-core.test.mjs` empty (blob hashes match at compose).
- Blast radius: estate-review verdict IDENTICAL to the `e962b6eb` baseline
  (3 pre-existing hub/index findings, outside this lane - verified in a
  detached worktree at the base); `tools/build-surfaces.mjs` output identical
  base vs head; `function relationshipPath` defined exactly once in the tree;
  `onstk`/"strongly connected components" absent from the adapter; bounded-
  route language, camera/history code, Charlemagne provider separation
  (`p1790a81049` / `p52f0d2a81d`), and living-person anonymity all
  test-locked unchanged. CR=0 and no new hex>=48 in touched files.

## Boundaries not crossed

No corpus writes; organ bytes verbatim from bFUzZ's tip (composition, not
merge - no branch merges, no prototype resurrection); panel render bytes
untouched (person-panel.mjs/.css frozen - the adapter maps, the panel
renders); engine bytes untouched (41bbcb02); camera/history untouched;
ceremony untouched; living anonymous; public projection only.

## Next

bFUzZ's adversarial pass at this pinned head, then the founder browser-seat
pass (thread `fcd6a2fc`, checklist `d5219a59`) - PR #125's only remaining
merge gates.
