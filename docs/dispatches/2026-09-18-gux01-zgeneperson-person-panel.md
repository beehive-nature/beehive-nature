# GUX-01 zGenePerson — the person/relationship panel (isolated component + archive adapter)

**Seat:** zGenePerson (GLM 5.3, zCode session) per the GUX-01 brief (`ROLE: zGenePerson — person/relationship UX builder`), same lineage as the zGeneUI/zGeneAtlas slices under the GUX-01 kickoff (`030a30d2`).
**Base pin:** `lane/zcode-lineage-import` @ `97f1894549d6269b15f3c3c1a38243c4a3b24bf9` — the SAME EXACT PIN as zGeneAtlas/zGeneUI (re-verified origin tip this session; their working branch `zcode/gux01-ui-atlas` @ `7064db9d` is stacked separately and untouched).
**Branch:** `zcode/gux01-geneperson-2026-09-18` (worktree `wt-zcode-geneperson`).

## What this is

The founder's first acceptance, as an ISOLATED component zGeneUI mounts — it never edits blood.html, archive.mjs, the corpus, the model, or profile pages:

> search "Joseph Hadlock" → ambiguity shown, never silently choose → select one candidate with distinguishing context → show relationship to current root → show blood vs affinity correctly → open the person's records / tradition / testimony / meaning as separately attributed layers → back returns to prior context.

Three new product files + one test file + one dev harness + screenshot receipts:

- `surfaces/person-panel.mjs` — the component: search/typeahead with the no-silent-choice law, ambiguity view, person view (chips · relationship-to-standing-root · family rows · the frontier · attributed layers · blood address · re-root/archive actions), relationship view (any pair), back-stack with scroll restore, keyboard layer, ARIA. Page-asset class beside `blood-nav.mjs` (not a counted surface — verified `build-atlas` clean, `estate-check` PASS 96/105, zero count drift).
- `surfaces/person-panel-corpus.mjs` — the corpus→archive ADAPTER (reference implementation of the interface): merges the public corpus + attested overlays + evidence packs read-only; resolves overlay-edge provider fsids through `refsIndex` so tradition-carried parents are real people; frozen PersonViews; `resolve()`/`search()`/`relationship()`/`genContext()`; iterative Tarjan SCC for cycle membership; ghost-frontier counts only.
- `surfaces/person-panel.css` — estate tokens with fallbacks; ≤640px single-column; `prefers-reduced-motion`; `[hidden]` beats author display (the bug the browser run caught).
- `tools/genealogy/personpanel.test.mjs` — 37 tests (below).
- `tools/genealogy/person-panel-demo.html` — the mount demo/dev harness (deliberately NOT under `surfaces/` so the atlas surface count is untouched; loads the real public corpus same-origin; exposes the controller as `window.ppPanel`).
- `e2e/shots-geneperson-personpanel/` — 19 screenshots: the desktop journey (01–14b) and the 390px journey (15–18).

## THE INTEGRATION CONTRACT (exact — mirrored verbatim in the person-panel.mjs header)

```
MOUNT
  import { mountPersonPanel } from './person-panel.mjs';
  const panel = mountPersonPanel(hostEl, archive, {
    root: 'p72d226cedf',          // standing root (relationship reference)
    onreroot(id){...},            // optional — host re-roots its own view
    onnavigate(state){...},       // optional — host mirrors state to its URL
                                   //   state = {view, id, a, b, query, root}
    openPersonPage(id){...},      // optional — host links to its person page;
                                   //   default opens the staged person page
    langText(key, fb){...},       // optional i18n hook (English fallbacks
                                   //   inline; corpus keys ×29 follow-lane)
    scrollContainer: el|null      // optional; default restores window scroll
  });

ARCHIVE (host supplies; surfaces/person-panel-corpus.mjs is the reference
implementation — any Archive 1.1 implementation with the same shape drops in):
  getPerson(id) → frozen PersonView | null
  resolve(q) → {status:'hit', person}
             | {status:'ambiguous', query, exact:boolean, candidates:[PersonView]}
             | {status:'null', query}            // never a silent pick
  search(q, cap) → frozen [{person, exact}]      // cap default 12
  relationship(a,b) → frozen Relationship        // THE ARCHIVE 1.1 SEAM
  genContext(id, rootId) → {rel:'self'|'above'|'below'|'off', depth}
  coupleOf(a,b) → boolean
  frontierTotal() → number

RELATIONSHIP SHAPE (endpoints + common ancestor, honestly):
  { a, b, kind:'self'|'direct'|'shared'|'affinity'|'blood-and-affinity'|'none',
    blood: null | { mode:'ancestor-of-root'|'descendant-of-root'|'cousin-line',
                    commonAncestor, commonAncestorIsEndpoint,
                    hopsFromRoot:[hop], hopsFromPerson:[hop] },
    affinity: null | { hopsFromRoot:[hop] },     // ⚭ hop = marriage, never blood
    cyclic: boolean, note: string|null }
  hop = { to, dir:'up'|'down'|'spouse', label:'mother|father|parent|son|daughter|child|spouse ⚭',
          evidence:'walked provider link'|'disputed — inspect'|'overlay — tradition-carried' }

CONTROLLER
  panel.openPerson(id) · panel.openRelationship(aId,bId) · panel.search(text)
  panel.resolveAndOpen(text)  // hit→open · ambiguous→ambiguity view · null→honest empty
  panel.setRoot(id) · panel.back() · panel.state() · panel.destroy()

KEYBOARD  '/' focus search · Esc back · ↑↓ walk results · Enter chooses the
          highlighted candidate (NEVER pre-highlighted while exact-name
          duplicates are on screen) · R re-root · O person archive.
```

## The Archive 1.1 quarantine (the standing law)

The temporary selected→root workaround — parent-edge BFS + spouse hops, cycle-safe, shortest way around the corpus's cyclic components — lives in exactly ONE function: `relationship()` inside the corpus adapter, marked `TEMPORARY PRE-ARCHIVE-1.1 IMPLEMENTATION`. The panel contains no traversal of its own (locked by test G1: no `.edges`, no `visited`, all relationship text through `archive.relationship()`). When Archive 1.1's corrected `relationshipPath` lands, replacing that one function replaces the whole policy — nothing else moves.

## Required cases — corpus-locked (test sections B/C)

- **Joseph Hadlock (the ambiguous exact-name case):** THREE exact matches at the pin — `pd9181bfe85` 1777–1849, `p254f9ddf59` 1729–1776, `pdc0876ac81` 1700–1744. resolve → ambiguous with all three; distinguishing context = lifespan + era + provider record + position vs the standing root (at the founder root they read 6/7/8 generations above; at the public Rockwood entrance they honestly read "not on the current line"). The UI never pre-highlights while duplicates are displayed; Enter routes to the ambiguity view, never a first pick.
- **Donna Ruth Lawton:** resolve hit; vs the founder root a DIRECT line 2 generations above with labeled hops `father, mother` (founder → liv-1 → Donna).
- **Albert Perry Rockwood:** the public entrance (demo default root); the founder hangs exactly 5 generations below him (the number zGeneUI corpus-verified); Donna vs the APR root is the honest `none` boundary ("coverage of the walk, not a finding about anyone"). His person view carries records + tradition (3 cited claims from the evidence pack) + family testimony (with the money-history overlay marker) as separately attributed layers.
- **Spouse-only pair:** liv-1 ⚭ liv-2 — kind `affinity`, `blood: null`, the single ⚭ hop reads "corpus couples map — affinity, never blood".
- **Married cousins:** Samuel Arthur Hadlock (`pb8e0a7cd75`) ⚭ Miriam (`pccc17e8c97`) — kind `blood-and-affinity`: the marriage AND a cousin-line through common ancestor **Joseph Hadlock 1700–1744** (one of the three ambiguous namesakes — the required cases interlock in the real corpus). Both sections render, both labeled; the coexist badge says married cousins.
- **Ghost-frontier branch:** frontierTotal locked at **1,959** (the number the zGeneAtlas slice measured), distributed across >1,000 persons; the panel shows the COUNT and the coverage wording only — raw unpublished parent-ref strings never enter any view (locked by test C5 scanning views against the ghost-ref set).
- **Cyclic-component person:** Emma de Bois-l'Evêque (`pcc15e1f57e`, on the founder's own line) — the parent graph loops through her son's record; every relationship still terminates (visited-set BFS) and the line renders with the ↻ cyclic note: shortest honest way, never an invented cleaner one.

## Evidence (all run at the commit, from the pin)

```
$ node --test tools/genealogy/personpanel.test.mjs
tests 37 · pass 37 · fail 0
$ node --test tools/genealogy/*.test.mjs
tests 87 · pass 87 · fail 0     (50 pre-existing green + 37 new, zero regressions)
$ node scripts/build-atlas.mjs
atlas built — 105 listed · 96 counted (no drift; regenerated byte-identical)
$ node scripts/estate-check.mjs
PASS estate-check — 96 counted · 105 listed · 26 domains
```

Law checks on the five new text files: CR (carriage returns) 0 each; hex runs ≥48: 0.

Browser acceptance (Playwright chromium, local static server, real corpus) — **twice-stable, zero page errors, zero failed requests**; 19 screenshots in `e2e/shots-geneperson-personpanel/`: cold load → typeahead dup-warning → ambiguity view → deliberate select (1777–1849) → honest boundary at the APR entrance → host re-root to founder shows the direct line → hop navigation → **Esc/back returns to the prior person context** → era≠support line → `/`-focused keyboard search opening Donna → married-cousins coexist + named common ancestor → spouse-only affinity → Emma cyclic note → ghost frontier wording → null-match honesty → Rockwood layers with the citation-wording law → R re-root standing chip; then the same journey at 390px including Esc-back. Visual floor: **0px horizontal overflow at 390 / 640 / 900**.

## Boundaries held

- NO edits to `surfaces/blood.html`, `tools/genealogy/model.mjs`, corpus/overlay/pack JSON, or any profile surface. `archive.mjs` untouched and unimported (zero dependency on uncommitted bytes — the zGeneUI slice-1 law).
- No corpus writes; every PersonView/Relationship/search result is a fresh deep-frozen projection (mutation throws, locked by test D2; corpus byte-identical after a full battery, test D1).
- No living/private leakage: living views carry `refs: []`, no record URLs, anonymous names; the panel constructs no URLs of its own and logs nothing (tests E1–E3).
- era ≠ support and the citation wording law (citations CONNECT claims to evidence; support is assessed per claim) hold in both modules (tests F1–F2).
- The demo harness lives in `tools/genealogy/` — NOT a counted surface, no registration ritual due (blood-nav precedent), atlas/estate verified unmoved.

## Named for zGeneUI at mount time (not fixed here — file fence)

1. The incumbent `blood.html` at the pin merges overlay edges RAW: `ovl-sigurd-snake-eye`'s parents (`M8WZ-XZY` Ragnar, `LYH3-ZXF` Aslaug as provider fsids) are filtered out of its own detail panel. This adapter resolves them through `corpus.refsIndex` — the mount should take the adapter (or mirror the resolution) so tradition-carried parents are reachable.
2. The dispute/reconstruction HYPOTHESES panel (Harthacnut's father) remains the incumbent's surface; this panel's hop evidence tags say `disputed — inspect` and stop there by design.
3. i18n: English fallbacks inline via the `langText` hook — corpus keys ×29 are the follow-lane.
4. `O` opens the staged person page by relative path by default; a host with its own archive door should pass `openPersonPage`.

## Honest gaps

- The panel is mount-READY, not mounted: blood.html integration is zGeneUI's to perform against their branch (their slices already carry relToRoot/ambiguity/ghost affordances — the reconciliation of panel-vs-slice overlap is theirs; this component is the isolated, tested, contract-documented form of the whole journey).
- The relationship provider's affinity search explores parents∪spouses to depth 30 with a 40k-visit cap — beyond-cap pairs honestly render `none` rather than a guessed line.
- No translation pass yet (fallback-English is visible per the corpus law).
