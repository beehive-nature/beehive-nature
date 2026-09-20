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
---

## RIDER (same day, later): the fresh-eyes review cures - event d6ca5958

Review: LoVis bee-laborer fresh-eyes mount review against 4532efb6 (log
WORK_LOGS/2026-09-19_LOVISBEE_GUX01_MOUNT_REVIEW.md, founder auth-tagged).
This rider lands on top of 4532efb6 and cures the confirmed findings plus the
verified subset of the unverified list. It resets the 4532efb6 bFUzZ GREEN
pin BY DESIGN - the review ordered the fixes and the re-PROVE.

CURED - the review's browser-pass blockers first:
1. Browser Back left the page (finding 1). The ONE-history law now lives in
   blood-nav.mjs: fresh engine navigations (reroot/view/home - exactly the
   reasons the engine core pushes) PUSH the browser stack; every other
   reason (select/back/restore) REPLACES in place; popstate RESTORES the
   URL context into the engine through atlas.core.restoreContext (+ the
   boot seam: a popped entry without r/v restores the boot root/view; no
   camera in the hash = the boot framing home() itself uses, never a bare
   identity). An earlier draft echoed history.back() on engine back - the
   journey caught it popping PAST the boot entry into a real navigation at
   390px; the echo is gone and a stub test forbids any history.back() call.
2. Rail stale after Back/home (finding 2). renderRail keys on
   railRoot !== ctx.root - EVERY path (reroot/back/home/restore) re-derives.
3. blood-nav loaded twice (finding 3). The ?v=2 tag is deleted; the mount's
   import is the single instance (self-wiring via __bloodReady); a wiring
   test pins its absence.
4. Serialized zoom 0.18..0.29 was dropped (finding 4). decodeHash floor is
   now the ENGINE's floor (0.18, blood-atlas.mjs zoom clamp) - round-trip
   test added.
5. Panel stand-here re-rooted only the panel (finding 5) - TWO cures: (a)
   the mount passes onreroot -> atlas.reroot (loop-guarded); (b) the
   DEEPER half the probe exposed: the panel's curRoot desynced from the
   engine root on every restore/back/home path, which muted its own
   stand-here button (setRoot early-returns on id===curRoot) - the mount
   now mirrors the engine root into panel.setRoot on EVERY root change
   (panelRoot !== ctx.root). ONE root on screen, every path.
6. (verified from the unverified list) Lens toggles re-selected the root:
   the incumbent lens handler called showDetail(S.curRoot), which under gux
   re-selects the INCUMBENT root into the engine. Guarded under gux AND
   #lenses retired with .listview + #rootnote via a new body.gux hide rule
   (the stale incumbent list table + root note showed the incumbent root
   while the engine stood elsewhere).
7. (verified) The O-key archive doorway saved a MIXED context (engine
   selection over incumbent view/camera). openArchive is engine-aware: it
   saves the ENGINE's whole context through the one grammar.

VERIFIED, NOT DEFECTS (per the review's check-before-acting):
- home() pushes: consistent with the ledger design (Back walks to it; the
  page never exits prematurely).
- #q keeps the incumbent matcher, but its result clicks route through the
  engine-aware showDetail (blood.html:905) - one search box, behaviorally
  intact under gux; rewiring the matcher is out of scope for this rider.
- bloodnav.test.mjs:340 pins the incumbent FALLBACK path wiring (the mount
  fails closed to the incumbent comb when the engine throws); the
  one-explanation law carries its own locks (the :453 test). Not a defect.

RECEIPT CORRECTIONS (the review's stale-claims item, named):
- 186/186 (beat 2b receipt above) - superseded by 212/212 (beat 2f),
  218/218 (D1 rider), now 223/223 at this rider.
- 20/24 journey - superseded by 29/29 (beats 2f/D1), now 39/39 at this
  rider (10 review beats added: browser-Back restore at desktop + 390px
  system Back, post-Back hash/rail/panel, stays-on-page, non-vacuous
  stand-here, precondition beats).
- upPath replaced when 1.1 lands - ALREADY DONE at beats 2e/2f (e962b6eb,
  24c64060): upPath replaced whole by archive-core @ 54462935.
- gated at every state entry - now literally true: the lens toggle, the one
  ungated semantic entry, is guarded under gux.

EVIDENCE at this rider's head:
- node --test tools/genealogy/*.test.mjs = 223/223 PASS 0 fail 0 skipped
  (218 + 5 review tests: zoom-floor round-trip, the historyAction law,
  sameCtx at grammar precision, the syncEngineHash stub, review wiring
  pins incl. the panelRoot mirror and the ?v=2 ban).
- node e2e/gux01-blood-journey.mjs = 39/39 beats PASS GREEN zero page
  errors, run twice consecutively (a railRoot-assignment bug was caught by
  this very beat going red on the second run and cured before landing; the
  stand-here beat was hardened to a non-vacuous target after a vacuous
  pass was caught - pid2 must differ from pid1 AND the standing root).
- Camera beats unchanged and exact: cold {k:1,x:0,y:-176}; deep-link 2
  {k:1.6,x:-100,y:80} at boot AND Back-home.

BOUNDARIES: engine bytes (blood-atlas.mjs) and panel bytes
(person-panel.mjs) untouched - every cure lives in blood.html wiring,
blood-nav.mjs (the grammar owner), and tests. No corpus writes. The
incumbent fallback path stays fully functional (all gates read __guxAtlas).
Production delta: surfaces/blood.html + surfaces/blood-nav.mjs +
tools/genealogy/bloodnav.test.mjs + e2e/gux01-blood-journey.mjs (+ shots).

QUEUED (Refill 3 mapping, founder-auth-tagged bcfdddbb, for the Z3 family -
NOT part of this rider): blight/midi.html triple-wrapped disclosures
(md.d.compose L110-112, md.d.balance L170-172) fixed inside Z3, then delete
R3's midi exemption rows; blight/demo.html + onboarding/receive.html inline
all 16 bcomb.js functions byte-identical - banked as a future Z slice.

NEXT: bFUzZ re-PROVE at this rider's head with the expanded attack set the
review named (browser Back, post-Back rail + panel root, panel re-root
button); then the founder browser-seat pass (thread fcd6a2fc, checklist
d5219a59) -> #125 merge review.

