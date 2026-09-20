# GUX-01 zGeneAtlas — the reusable atlas/navigation engine, landed on the zGeneUI pin

**Seat:** zGeneAtlas (zCode) · **Base:** `lane/zcode-lineage-import @ 97f18945` — the exact
integration pin zGeneUI's slice-1 names ("EVIDENCE at the commit from the pin 97f18945"),
re-verified this session as the un-moved origin tip of the lane · **Branch:**
`zcode/gux01-atlas-engine-2026-09-18` (stacked on the unmerged incumbent lane, like the
zBlood harvest lane before it) · **Fence held:** blood.html, profile.html, corpus JSON,
model.mjs, archive.mjs — zero edits (git diff HEAD empty across all tracked files).

## Deliverable

The corpus navigation/rendering engine as a standalone page-asset module the incumbent
zGeneUI seat mounts; the harness proves the mount once so zGeneUI never has to guess.

| file | role |
|---|---|
| `surfaces/blood-atlas.mjs` | the engine — pure core (ingest/topology/views/core-state/LOD/search) + DOM layer (pan/zoom world, pointer+keyboard, drag-never-selects) |
| `surfaces/blood-atlas.css` | one-`<link>` stylesheet; estate tokens with standalone fallbacks |
| `tools/genealogy/bloodatlas.test.mjs` | the contract suite (34 tests, joins the genealogy glob) |
| `tools/genealogy/blood-atlas-harness.html` | acceptance harness — a TEST file in tools/, NOT an estate surface (no registration ritual owed) |
| `e2e/blood-atlas-journey.mjs` | the receipt journey (serves the tree, drives the beats, asserts in the live DOM, screenshots) |
| `e2e/shots-blood-atlas-gux01/` | 12 screenshots: 9 × 390px + 3 × desktop |

**Naming law earned in-flight:** `surfaces/atlas.*` is the estate FRONT DOOR (hub styles
and scripts) — the first write of `surfaces/atlas.css` was REFUSED by the read-before-write
guard and the discovery re-run as `blood-atlas.*` (the lane's blood- family). Absence-from-
main ≠ absence-from-estate applies WITHIN surfaces/ too; no incumbent byte was touched.

## INTEGRATION API (for zGeneUI)

The engine header in `surfaces/blood-atlas.mjs` carries this contract at the point of use;
the harness executes it against the real corpus. blood.html mounts in four lines:

```html
<link rel="stylesheet" href="atlas.css">            <!-- surfaces/blood-atlas.css -->
<script type="module">
  import { createAtlas, GHOST_TITLE } from "./blood-atlas.mjs";
  const atlas = await createAtlas({
    mount:   document.getElementById("world"),   // any container element
    corpus:  mergedCorpusObject,                 // OR corpusUrl (fetched same-origin)
    overlay: overlayObject,                      // OR overlayUrl; ingest() merges (idempotent)
    relEvidence: S.relEvidence, recon: S.recon,  // optional dispute seam (incumbent semantics)
    initial: { root, selection, view },          // optional; defaults corpus.root / "pedigree"
    bounds:  { ancDepth:7, descDepth:3, descNodeCap:150, sibCap:24, spouseCap:6 },
    onContext(ctx, reason) { /* sync #p=&v=&r=&s=&x=&y= here */ },
  });
</script>
```

- `atlas.select(iid)` — selection ONLY, never moves the root, never pushes history.
- `atlas.reroot(iid)` — the explicit re-root; pushes history; selection survives.
- `atlas.setView("pedigree" | "fractal" | "tree")` — pushes history; root+selection survive.
- `atlas.back()` / `atlas.home()` — restore the prior exploration context
  (root, selection, view, transform).
- `atlas.getContext()` — frozen `{root, selection, view, transform}`.
- `atlas.search(q, cap=12)`, `atlas.person(iid)`, `atlas.ghostCount(iid)`,
  `atlas.zoomBy(f)`, `atlas.resetView()`, `atlas.destroy()`.
- Events reach the integrator ONLY through `onContext(ctx, reason)`, reason ∈
  `select | reroot | view | back | home | restore`. Pan/zoom mutates transform silently
  (read via getContext). Ghost cells dispatch an `atlas-ghost` CustomEvent on the mount
  (`detail.child` = iid of the child carrying the unpublished reference).
- Pure core exports for tests/tooling: `ingest`, `buildPedigree`, `buildFractal`,
  `buildTree`, `lodFor`, `search`, `createCore`, `ATLAS_VERSION`, `GHOST_TITLE`.
- Every painted person node carries `data-pid` (one canonical identity — ALL occurrences
  re-mark on selection); world exposes `data-view`, `data-painted`, `data-lod`;
  keyboard: arrows walk relationships, R re-root, B/Backspace back, Home reset.

## First acceptance — receipted end to end

Journey `e2e/blood-atlas-journey.mjs` — **21/21 beats PASS, zero page errors**, on the real
corpus (10,259 published persons) at the pin:

cold corpus (founder root, 237 painted of ≤255 while the corpus holds 10,259 — bounded
law visible in the counter) → select Donna Ruth Lawton WITHOUT moving the root
(ctx line proves root held "Living") → explicit re-root at Donna → view→fractal
(survives) → view→tree (survives; ancestors/self/descendants sections; selected row
marked) → back ×3 restores the cold-load context with the selection intact →
semantic zoom: 5× out = `lod-far` labels hidden (structure only), deep in = `lod-near`
reading → ghost frontier at Martha Steward (2 dashed slots = her 2 unpublished parent
refs, exact affordance title, click-through names the child) → desktop pass mirrors the
survival beats. Screenshots 390px (9) + desktop (3), all verified non-blank by pixel
sampling (this seat's image-Read is a CDN trap — byte checks instead).

## RED → GREEN

- **RED:** `node --test tools/genealogy/bloodatlas.test.mjs` against the absent engine →
  exit 1, `ERR_MODULE_NOT_FOUND: …surfaces/blood-atlas.mjs` (tests written first; the
  contract pre-exists the implementation).
- **GREEN:** 34/34 pass. Full genealogy suite at the pin: **84/84** (50 incumbent + 34 new)
  — zero regressions.

## Laws, each with its test or beat

L1 people-not-placeholders (every person/mirror cell resolves in the corpus; ghosts carry
no pid) · L2 semantic zoom (`lodFor` thresholds + live lod-far/near beats) · L3 one
canonical identity (mirror = same `data-pid`, marked at every occurrence; real corpus
collapse locked: Betty Petty + Jonathan Hadlock at generation 7) · L4 selection ≠ re-root
(core tests + journey beats) · L5 bounded (2^(ancDepth+1)−1 by construction; tree
descNodeCap with STATED truncation; 10k-person corpus paints 237) · L6 cycles terminate
visibly (a↔b fixture closes as a mirror; never recursion) · L7 ghost frontier = coverage
unknown (GHOST_TITLE verbatim; "no ancestors" is untestable — the string is asserted
absent; real frontier locked at 1,959 refs / 1,025 persons) · L8 affinity ≠ blood
(spouse cells dotted ⚭ beside the root ring; spouse rows never under a blood section) ·
L9 no confidence score (scene/model blobs scanned for score/confidence/probability/
certainty — absent; evidence chips are the corpus's own verbatim strings; cell field
whitelist) · L10 archive-return immutable (corpus JSON byte-identical after ingest and
after the whole journey; engine projections frozen).

## Corpus facts the tests locked at the pin (so drift is loud)

10,259 published persons (the three ovl-* attested persons are ALREADY baked into the
corpus — fourth-wave one-address-space law; overlay re-merge is idempotent) · overlay
edges arrive as PROVIDER IDS and are resolved through the corpus's own refsIndex inside
ingest (unresolved raw strings would have invented 2 ghost refs: 1,961 vs the true 1,959 —
caught by test, fixed in the adapter) · couples map 4,854 · spine 42 · grandparents at
generation 2 exactly the four named (grandparent law) · depth conventions: engine
`ancDepth N` = N ancestor generations beside the root (incumbent's 7-ring shape).

## Boundaries + honest gaps

No corpus writes; no archive.mjs/model.mjs dependency; no fetches beyond the two lineage
JSONs; no framework, no deps. The DOM layer is proven in-browser through the harness —
the mount INSIDE blood.html is zGeneUI's integration beat (this lane does not touch the
incumbent surface). Not yet exercised: real-touch pinch (desktop + mouse-px emulation
only), a disputed-edge journey through the relEvidence seam (the code path mirrors the
incumbent's `edgeVisible` but no beat drives it yet), Android. LOD thresholds (0.55/1.15)
provisional — tuning is zGeneUI's presentation call.

## Checks (all green, this worktree)

`node --test tools/genealogy/*.test.mjs` 84/84 · estate-check PASS 96/105 (zero count
drift — blood-atlas.* are page assets like blood-nav.mjs, not counted surfaces) ·
build-atlas clean (105 listed · 96 counted, doors artwork preserved) · secret-scan tree
exit 0 (silent-clean) · hex ≥48: 0 hits in all five new text files · CR bytes 0 (byte-level
node check — Git-Bash grep `$/r/` is a broken instrument on this box, the count lied until
proven by bytes) · lint-ci-shape 47/47 · lint-shell-chains ok.

— zGeneAtlas (zCode), 2026-09-18
