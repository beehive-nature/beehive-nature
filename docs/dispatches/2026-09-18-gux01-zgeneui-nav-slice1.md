# GUX-01 zGeneUI — slice 1: the navigation layer (blood-nav)

**Seat:** ZcODe5.3max (GLM 5.3, max effort) — zGeneUI per the GUX-01 kickoff (`030a30d2`) and the founder pivot (`03174e6c`, commit-authorship unblock + first-journey order).
**Base:** `lane/zcode-lineage-import` @ `97f1894549d6269b15f3c3c1a38243c4a3b24bf9` — re-verified still the origin tip after `git fetch` this session (no upstream movement underneath the slice; the harvest branch `zcode/zblood-source-harvest-2026-09-18` is stacked separately and untouched).
**Branch:** `zcode/gux01-ui-atlas` (worktree `REPOS/wt-zcode-gux01-ui`).

## What this slice is

The founder's first real journey, end to end:

> cold load → search any permitted person → select → understand relationship/context → focus/re-root → change visualization → open person archive → back with context intact.

Implemented as a **new navigation module** (`surfaces/blood-nav.mjs`, page-asset class alongside `tour.js`/`lang.js` — not a counted surface, so no `estate.json` row; verified: `node scripts/build-atlas.mjs` clean, `node scripts/estate-check.mjs` PASS, no count drift) plus **surgical hooks** in `surfaces/blood.html` (the shared integration surface zGeneUI owns).

### The eight behaviors

1. **Drag/pinch never selects.** Capture-phase movement tracking (≥5 px threshold) sets a suppression flag; the click/dblclick that follows a pan is stopped before it reaches any cell handler. A tap still selects. (`shouldSuppressClick`, unit-tested at the exact threshold.)
2. **Selection is state, not a DOM side-effect.** `S.sel` survives view switches and re-roots; every render path (fractal cell, dup cell, chrono cell, pedigree slot, tree row) emits `data-pid`, and the nav layer re-marks the selected person after every redraw — repeated ancestors get all their cells marked, one identity.
3. **Selection ≠ re-root, preserved.** Click/arrow = select only; re-root stays its own action (button, or `R`). The pre-existing separation is now locked by the keyboard layer too.
4. **Keyboard navigation.** Arrows walk relationships deterministically (↑ first parent, ↓ first child, ←/→ sibling ring with wrap), `R` re-root, `O` open archive, `/` focus search, `Home` reset, `Esc` collapse drawer. A missing relationship is a no-op, never a guess. Input fields are skipped.
5. **URL context + return-to-place.** `#p=<id>&v=<view>&r=<root>&s=<scale>&x=<tx>&y=<ty>` via `replaceState` (no history spam); `popstate` restores the whole context; legacy `#p=<id>` links keep their exact old meaning (`#myth` too). A one-shot `sessionStorage` context makes the person-page back-link land the visitor where they were — view, root, selection, zoom.
6. **Semantic zoom LOD.** Fractal scale drives three reading levels: far = structure only (labels hidden, dispute markers kept), mid = people near the focus (rings 0–2), near = everything. Applied as a class on `#world`; CSS does the switching.
7. **Mobile person drawer (≤640 px).** The detail panel becomes a bottom sheet: collapsed 58 px peek with the selected name, `Esc`/toggle to collapse, auto-opens on selection. `prefers-reduced-motion` disables world transitions and smooth scroll.
8. **Archive doorway + honest off-view focus.** Every detail panel gains "open the archive" (same-origin, stays in this tab — external-nav law). Search results cap raised 8→12. Selecting a person not drawn in the current view centers nothing and instead says so: "not drawn in this view — press R to walk from here, O for their archive" — a missing branch is never presented as an empty family.

## Evidence (run at the commit, from the pin)

```
$ node --test tools/genealogy/*.test.mjs
tests 72 · pass 72 · fail 0     (50 pre-existing green + 22 new)
$ node scripts/build-atlas.mjs
atlas built — 105 listed · 96 counted (no drift)
$ node scripts/estate-check.mjs
PASS estate-check — 96 counted · 105 listed · 26 domains
```

Law checks on the three touched files: CR count 0 each; hex runs ≥48: 0 added (blood.html's 2 pre-existing digest runs are byte-identical to the pin and carry their same-line PUBLIC-CONSTANT markers).

Tests: `tools/genealogy/bloodnav.test.mjs` — 22 tests. Pure helpers (hash encode/decode round-trip, legacy-link compatibility, junk tolerance, LOD thresholds at the boundaries, drag threshold, sibling dedup + ring, deterministic stepping with wrap, archive URL encoding, application plan against unknown ids) plus a **wiring-contract block** that parses `surfaces/blood.html` and pins the seam (module load order, `BloodComb` exposure, ready handshake, every `data-pid` emission, all four hooks, tabindex, LOD/drawer CSS, search cap) so page and module cannot drift apart silently.

## Boundaries held

- No corpus writes; corpus/overlay/recon JSON untouched. No edits to `model.mjs`, `smoke.test.mjs`, `personpage.mjs` (bFUzZ fence) or `archive.mjs` (zGeneArchive seat, slice 1).
- No fetches, no new dependencies, no framework, no replacement schema; `blood-nav.mjs` is inert under Node (DOM access guarded) so it is import-testable.
- Preservation/payment machinery untouched (regression-only per the sprint charter; the econ card still renders — no code path removed).
- No private data: the module reads only ids already public in the loaded corpus; living persons stay anonymous stubs end to end (they were already redacted upstream).
- No uploads, no publication gesture, no agents dispatched.

## Honest gaps (named, not waved)

- **No in-browser run from this seat** (no browser tooling). Coverage is unit + wiring-contract + law/ritual checks. The browser-equipped zcode seat (founder offer, `fcd6a2fc`) is the right verifier: desktop + 390 px mobile, drag-then-release over a cell, arrow keys, view-switch selection preservation, archive round-trip, back button. Android observation recorded separately per the sprint order.
- **archive.mjs not yet mounted** — per the founder order it lands as bFUzZ's committed slice first; this branch deliberately carries zero dependency on uncommitted bytes. Mount step (search index / relationship labels cross-checked through the archive API) is the next slice.
- The "best tree" spatial design challenge (`03174e6c`) is the next slice's territory; this slice is the correctness floor it stands on.

## Next executable actions

1. bFUzZ: commit the verified two-file Archive Slice 1 (founder order `03174e6c`).
2. LoVis bee-laborer: fresh-eyes review of that committed API.
3. zGeneUI (this seat): rebase onto the archive commit, mount the API, then the spatial tree slice.
4. Browser seat: journey verification per above.

*Commit authorship per the founder ruling `03174e6c`: executing seat as author, provenance in trailers, no founder impersonation, no machine Signed-off-by.*
