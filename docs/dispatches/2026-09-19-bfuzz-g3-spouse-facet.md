# 2026-09-19 · bFUzZ — G3 closed: the additive spouse facet (married cousins classify blood-and-affinity)

Lane: GUX-01 zGeneArchive (organ owner beat). Commit `54462935` on branch
`bfuzz/gux01-archive-graph` from worktree `REPOS/wt-bfuzz-gux01-archive`
(descendant of `e1948156`; origin tip verified unmoved at fetch; no force).
Ordered by founder ruling `32e28d07` — **Rule A**:

> Grow the existing core shape additively. No new export. No UI-side
> relationship derivation. ... For a married-cousin pair, the canonical truth
> is not "blood or affinity"; it is **blood plus direct-spouse affinity**.

Context: G3 was filed in the ORDER 5 first receipt
(`WORK_LOGS/2026-09-19_BFUZZ_ORDER5_FIRST_RECEIPT.md`) — the core's
`relationshipPath` returned one kind and dropped the direct-spouse facet
whenever blood existed (`if (blood) return blood;`), so a G1 swap would have
silently lost the "married cousins" truth for 674 corpus pairs. Ruling 1 in
the same event gated PR #125 on the seam beat that consumes this commit.

## What landed

`surfaces/archive-core.mjs` (+34/−2, zero imports, still browser-safe):

- **`coupleJoin`** construction index: `"aId|bId"` (both key orders) →
  couple key, built from the SAME `model.couples` the affinity walk reads.
  Self/malformed entries skipped, never invented into kinship.
- **The G3 gate** in `relationshipPath`'s blood branch: a coupleJoin hit
  returns `{ ...blood, kind: "blood-and-affinity", spouse: { couple, note } }`;
  a miss returns the blood shape untouched — same object, byte-identical.
- Schema `skaists.archive-core/1` → `skaists.archive-core/1.1` (additive
  facet era); CONTRACT header documents the classification. **No new public
  export** (founder constraint; test-locked).

`tools/genealogy/archive-core.test.mjs` (new, 11 permanent cases): married-
cousin classification both directions with blood facets whole and the facet
naming the exact couple record; blood-only shape lock (keys exactly
`[commonAncestor,kind,note,path]`); affinity-only lock; none lock;
pair-specificity; couple-record order-independence; disputed rides through
the facet (2-cycle fixture); self-pair pre-existing semantics locked;
determinism; contract lock; schema lock.

## Evidence (this tree; corpus untouched since 97f18945)

- `node --test tools/genealogy/*.test.mjs` = **88/88 PASS, 0 fail** (77
  pre-existing + 11 new; full package suite, not scoped).
- **Differential probe vs `e1948156`** on the exact merged model `blood.html`
  boots (corpus + attested overlays, couples from corpus):
  - EXHAUSTIVE over all 9,708 couple direction-pairs: **1,348 went blood →
    blood-and-affinity (= 674 couples × 2 — exactly the married-cousin count
    ZcODe5.3max's independent probe reported)**, 8,360 byte-identical, 0
    unknown-person, 0 violations; every facet hit verified kind +
    spouse.couple + commonAncestor + path equality against the old shape.
  - SAMPLED 10,658 non-couple pairs (every person vs donna + 400 seeded
    randoms): **10,658/10,658 byte-identical**.
  - Probe banked at `.scratch/g3_diff_probe.mjs` (nest-local, not committed).

## Handoff (seam owner zGeneUI — the ruling's beat order)

1. Compose `54462935`'s `surfaces/archive-core.mjs` verbatim into the UI
   tree (refresh-before-mount law).
2. Consumers switching on `kind === "blood"` must learn
   `"blood-and-affinity"` in the same beat: relToRoot, search
   disambiguation, and the panel swap (G1).
3. G4 rides: consume `cyclicAncestryOf`, remove the second Tarjan
   (`person-panel-corpus.mjs:177`).
4. Add panel↔resolver agreement assertions (the hole the 29/29 walked
   around); then 192+ battery + 29/29 real-surface journey; then the
   founder's browser pass (PR #125's merge gate).

PR #128 carries this commit. Nothing else moved (founder: "Nothing else
should move before that beat is green").
