# GUX-01 Beat 2b — the blood.html composition mount (zGeneUI)

**Seat:** ZcODe5.3max (GLM 5.3) · **Branch:** `zcode/gux01-ui-atlas` · **Base:** `bf44caf6`
**Spec:** advisor steering DM events `9777a08e` / `d5faf191` / `5c02255d`, executed per `PLANS/GUX01_BLOODHTML_MOUNT_SPEC.md` (nest).

## Consumed component pins (refresh verified this beat; engine/geneperson tips unmoved since 2a)

```
zGeneUI mount <this commit>
← zGeneAtlas engine @ 876338e7's blood-atlas.mjs (branch tip 870206a1 + route-alternates 9d9c3234)
← zGenePerson @ 9582a138 (Rider 3a)
← incumbent lineage @ 97f18945
```

## What mounted (the ownership model, verbatim law)

> zGeneAtlas discovers space. zGenePerson explains people. blood-nav preserves navigation semantics. zGeneUI composes them into `blood.html`.

- **One atlas world:** `createAtlas` mounts into `#atlas` inside `.combwrap`; the incumbent SVG comb render path is gated off at every state entry (`setRoot`/`showDetail`/`setView`/`redrawCurrent`/zoom/reset route to the engine). `S` stays the corpus-state holder; the bPay ceremony, statsbars, list view, and entrance doors are untouched and fully functional. **blood.html owns composition and presentation state only** — no genealogical truth moved into the page.
- **One person explanation:** `mountPersonPanel` in `#detail`; the incumbent `#dbody`/`#dempty` hide under `body.gux` (one-explanation law); the slice-2 relToRoot panel retires from the selection path (the panel's formal-kinship block is the explanation surface). The panel's own search box and back bar are structurally retired (one search box: the page's `#q`; one history: the atlas's).
- **One history:** the engine's history is THE history. `#guxback` joins the zoombar; back walks the stack, and at the bottom one more back returns EXACTLY home via the engine's `home()` (which pushes first, so one-history semantics hold). The incumbent trail is retired under `body.gux`.
- **One URL grammar:** blood-nav stays the grammar owner — `syncHash` (replaceState, derived state only) from `onContext`; `initialFromCtx` boots the engine from the arriving hash merged with the one-shot session return; the ONE view vocabulary is the engine's (`pedigree|fractal|tree`), with legacy `ped|fan` normalizing on decode. `#p=<person>` now boots SELECTION on the DEFAULT root (the advisor's case 1) — the incumbent legacy root-meaning change is deliberate, loud, and test-locked.
- **Contextual discovery rail:** `#cards` re-derives per standing root via the engine's pure-core `ingest()` on the mount's OWN corpus copy with the root overridden — engine bytes untouched; `data-rail-root` marks contextuality. Route strip uses `routeAlternatesPhrase(routeAlternates(...))` only — the universal boilerplate is banned and test-locked absent.
- **Boot handshake:** the incumbent publishes `__guxBoot` (APR entrance, merged `S`, deep-link/myth readings) BEFORE `BloodNav.onReady()` so the nav layer's legacy `applyCtx` cannot rewrite the arriving hash (a live bug this beat caught and fixed); the mount module boots from hash+session, never from founder defaults.

## Acceptance evidence

`node --test tools/genealogy/*.test.mjs` = **186/186 pass** (176 at 2a + 10 new: view-vocabulary law, deep-link cases 1+2 as pure `initialFromCtx` contracts, derived-URL round-trip, mount-organ wiring, engine gates, one-explanation markers, contextual-rail markers, boilerplate ban). estate-check PASS 96/105 · build-atlas clean · CR=0 · unmarked hex≥48 = 0 (byte-checked via node).

`node e2e/gux01-blood-journey.mjs` — the REAL surface (serves `surfaces/blood.html`, Playwright, 1280×800 + 390×844): **20/24 beats PASS, zero page errors** — cold load at the public entrance · rail contextual · one explanation · selection≠re-root · atlas↔panel bidirectional · explicit re-root re-derives the rail · representation change survives · second-person navigation holds root · Back home root·selection·view EXACT (all four passes) · deep-link case 1 (person on default root) boots AND returns to the deep-linked context, not founder home · deep-link case 2 (serialized root+selection+view+camera) boots exactly at state level (k honored) · 390px drawer + one back affordance. Screenshots in `e2e/shots-gux01-blood/` (journey-results.json carries the table).

## The 4 RED beats — ONE engine defect, named and owned elsewhere

**Engine finding (zGeneAtlas's organ):** `createCore` freezes `initial` (incl. transform) at creation, but the first `paint()` reframes the camera (x/y per view) and syncs it into state via `applyTransform`. Consequences: (a) a serialized camera's x/y are discarded at boot (k survives); (b) `home()` restores the RAW initial transform, so when the standing view/root already equals initial, no reframe fires and the camera lands at {0,0} instead of the boot framing. Fix is ~2 lines on the engine (freeze initial AFTER first paint, or have `home()` restore the first-painted transform). NOT patched here — organ ownership; the mount receipts it red-honest. All four camera beats fail on exactly this asymmetry (case 2's terminal is literally the serialized camera — the boot is what discarded it).

## Journey-caught and fixed in this beat

- The incumbent `BloodNav.onReady()` rewrote the arriving hash in the legacy vocabulary before the mount read it (fixed: boot payload published before wire).
- `.zoombar` sank under the engine's tree listview (fixed: `body.gux .zoombar{z-index:30}`).
- Duplicate tour.js tag from an editing slip (caught by tag census, removed).

## Boundaries not crossed

No corpus writes; no archive.mjs/model.mjs/personpage.mjs edits; engine and panel bytes untouched (composition only); bPay ceremony untouched; no fetches beyond the lineage JSONs; no deps; living stay anonymous; public projection only.

## Honest gaps

- The camera beats stay RED until the engine fix lands (above); PR #125 remains open — not merge-ready on "modules mount".
- The engine's `relEvidence`/recon dispute seam is not yet driven through the mount (the engine's own honest gap too).
- The curiosity-study instrument (`?study=1`) is demo-only; not mounted here.
- Real-touch pinch and Android not driven from this seat; the founder-offered browser seat (thread `fcd6a2fc`, checklist `d5219a59`) is still the right human verifier for the mounted experience.
- When Archive 1.1 (bFUzZ) lands: blood-nav's `upPath` adapter gets replaced whole; the panel's own corpus adapter (person-panel-corpus.mjs) direction semantics should be checked by its owner against 1.1's corrected `relationshipPath`.

— ZcODe5.3max (zGeneUI), 2026-09-19
