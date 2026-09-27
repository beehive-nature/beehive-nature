# The bottom half of every surface, measured and fixed (2026-09-26)

**Seat:** Claude (cloud session; committer `Claude <noreply@anthropic.com>`, author the founder per §7).
**Branch:** `claude-lovis/magical-allen-dd0xqh` (PR #233).
**Founder orders, same day:**

> did you fix the bottom(s) there is bugs all over the place in the bottom/footer in probably 50+
> surfaces … my users will be profound artists/musicians/intellectuals … do not "cut corners"

> its not just the bar … EVERYTHING BOTTOM HALF OF EVERY SURACE NEEDS TO BE CHECKED AND FIXED/IMPROVED

> THE AI GLOB/NAVAL-STERN I LIKE BETTER … SHOULD BE MOVEABLE?

> THE LIGHT MUSEUM TEXT … PLEASE MAKE IT A/A- LEVEL MUSEUM

## The measure: `e2e/footer-audit.mjs` (new, now a CI gate)
Every counted surface × bee/raver/cypherpunk at 390×844, scrolled to the end.

**The bar:**
- CLIP: an item cut by the menu toggle.
- TAP: a target under 44 px.
- SEAT, TALL, COLLIDE.
- UNDER: the page end hidden under the bar.
- WIDE: the page scrolls sideways, or the layout viewport has widened. A phone zooms out to fit overflow even under `body{overflow-x:hidden}`.

**The lower half:**
- CAPS: `text-transform`.
- OFFSIDE, BROKEN, CUT.
- TINY: a link or button under 32 px. Links inside running prose are exempt (WCAG 2.5.8).
- JUNK: a value slot showing a dash, NaN, null or undefined.
- SMALL: under 12 px. SVG text is measured at its scaled on-screen size.
- FAINT: under 4.5:1.
- OVERLAP: text drawn over text. Measured as glyph rectangles clipped by their scroll boxes; fixed and sticky layers are excluded.

It runs as a **ratchet** against `e2e/footer-audit.baseline.json`: a page × register may only lose findings. Layout kinds get 2 of slack for runner font wrap.

The measure had flaws; each was fixed before its numbers were trusted:
- It measured mid-scroll on `scroll-behavior:smooth` pages; it now scrolls instantly.
- It flagged prose links.
- It missed a widened layout viewport.
- It counted rows clipped inside scroll boxes as overlaps.
- It read the word "null" in a sentence as a broken value.

## Numbers
- **Before** (the first run after the new bar, 312 views): TAP 267, SMALL ≈ 10,985, FAINT 1,375, TINY, CAPS, JUNK, UNDER and OVERLAP on most views.
- **After** (312 views, this tree): **4 views with findings on 2 surfaces**, and both are someone else's decision:
  - `design-system.html` [cypherpunk]: the documented eyebrow specimen, whose keyed caption still says "uppercase".
  - `forge/orbit.html` ×3: frozen founder art (FOUNDER RULING R1, `e2e/forge-freeze.mjs`).

## What changed
**Shared layer (lead):**
- **`tour.js` bar:**
  - Three lanes. Links scroll inside their own lane and fade inside it.
  - The riders (language, rails) and the menu toggle sit at fixed spots, so nothing is ever cut. Every target is 44 px.
  - The current page's link is scrolled fully into view ("museu" was a half word).
  - The bar sets its own ink, so the language picker no longer takes a light page's dark text.
  - The floating "⌂ hub" pill on 30 pages repeated the bar's own ⌂ and sat where the orb floats; it is hidden wherever the bar is.
- **`agent-dock.js` orb:**
  - It floats again and is **movable**: drag it, or use the arrow keys. It stays where it is put (`localStorage bnr.orb`), is clamped on screen, and is never under the keyboard or on the bar.
  - The pointer is captured at the press, so a quick flick moves it (it had lost the flick).
- `lang.js`, `rails-badge.js`, `register.js`: 44 px, readable sizes.
- **`blight/fleet.js`:** the closing row of every bLighT page was 11 px grey at 1.4–3.3:1. It now uses pills in the page's own colours.

**Eight page batches** (about 100 surfaces):
- Edits were made only in each page's own `<style>` or markup:
  - reading text 14–16 px in bee and raver, cypherpunk's dense mono at a 12 px floor;
  - greys lifted to at least 4.5:1;
  - forced capitals removed;
  - "—"/"?" placeholders now say what is true ("not read yet", "not measured");
  - 44 px controls.
- **Real bugs found on the way**, not only styling:
  - or-board doubled its bug rows on every tongue switch.
  - Unscoped bee selectors painted cream cards under light text at 1.01–1.2:1 in the dark registers: bigen, bsymposium, buzz-directory, profile, university.
  - The first dock card was a link with three links inside it, which is invalid; the parser broke the card.
  - Overflowing rows zoomed whole phone pages out: music at 417 px, midivault at 407, wallet at 466, bqueenbee-live at 441.
  - The blood drawer peek hid under the bar and could not be reached.
  - The midi disclosures were nested three deep.
  - design-system printed a stray `data-i18n=…>` on screen.
  - hardware/index had its footer before a section.
  - huddle showed an empty "in the huddle:" label.
  - The fleet-hosted cards ran into one line.
  - blood-nav drew a mangled "?" where its drawer arrow should be (now the real ▴/▾, with an honest aria-label).
  - Atlas names dropped to 11.5 px as the camera zoomed; they now keep a readable size, the map convention.
- **Museums (A level):**
  - The three registers are dressed as three galleries: bee daylight, raver night, cypherpunk receipts.
  - Room names are bold serif lead-ins in every tongue, instead of shouted capitals.
  - "live chain reads", "archived copy" and "holder: 0x20a0… pending" were each stamped on every card; each is now said once per room.
  - A read that did not arrive is a quiet card, not a 270 px black void.
  - The Luna Seals draw their archived, sha256-receipted card images.
  - The chronology runs in order.
  - Corpus: the leading all-caps runs of h.083 and 30 `mu.*` keys were recased in all 29 tongues:
    - names and acronyms kept;
    - German nouns capitalised by hand;
    - Turkish İ/ı handled;
    - caseless scripts untouched.

## Tests changed, and why
- **`e2e/orb-seat.test.mjs`** asserted the 2026-09-13 seat (the orb inside the bar on phones). The 2026-09-26 ruling floats it and makes it movable. Rewritten to the new ruling, keeping every guarantee the seat order protected:
  - it opens from where it sits;
  - it is never on the bar;
  - the ANT card is not covered;
  - desktop is unchanged.

  A new test proves drag, keys and persistence. 5/5.
- **`e2e/buzz-directory-views.test.mjs` F4** asserted the old 10.5 px / 9.5 px compact sizes. It now asserts the same compact density under the 12 px floor (`max(10.5px,var(--fmin,12px))`).
- **`e2e/lang-coverage-floors.json` `or-board.html`: 94 → 58.** The floor was inflated by or-board's own bug: every tongue switch appended the bug rows again, and CI's Russian pass counted the duplicates. Measured here with the same tool, HEAD's page and this page both key exactly 58 strings. No key was lost; the doubling was fixed.

## Receipts (this box, Chromium 1194)
- Every browser gate in `tests.yml` (36 steps plus the 35-file `node --test` list), all green:
  - 377/377 node tests;
  - reading-rooms 1812 assertions;
  - doors 41;
  - university-smoke 87;
  - no-page-errors: 113 surfaces, 0 errors;
  - bpay A 18/18 and B 17/17;
  - bdata 100/100;
  - kandi ×5;
  - engineflow 30, fleet-pixels 28, dock-claims 8, forge-freeze, and the plur/music/watch checks 29.
- `i18n-coverage --set lang-coverage-set.json ru --floors`: or-board passes after the floor correction above. One page reads under its floor **on this box only**: `forge/room.html` measures 19 keyed against a floor of 20, and HEAD's own `forge/room.html` also measures 19 here with the same tool. It is a timing difference in this environment, not a change: CI recorded 20 on the same markup. A batch had set the closed panel to `display:none`, which hid 4 more keys from the tool; that rule was reverted. It only answered an audit false alarm, which the audit's `checkVisibility` now handles.
- `e2e/estate-source.mjs`: 11/11 with the regenerated hub committed alongside `scripts/build-atlas.mjs` (the hub's page-end 44 px targets and 14 px secondary text live in the generator).
- blood journeys: `gux01-blood-journey` 39/39, `blood-atlas-journey` 21/21.

## Named, not done (the founder's call)
- **The casing law conflicts with two committed canons:**
  - `design-system.html`'s eyebrow and label specimens document "uppercase" in keyed captions (`ds.t.eyebrow.cap`, `ds.t.label.cap`, 29 tongues). Proposed: "12px · .04em · sentence case · --ink-mut".
  - `e2e/design-acceptance.mjs` D4 *requires* an uppercase hero caption ≤ 11 px. devroom and dock keep theirs so D4 stays green.
- **Literal capitals in keyed strings** (proposals in the batch reports): or-board `or.liveh`, `or.fileh`, `or.bugh`; wallet `wl.ld.*`; festival `f.*`; fieldnotes `fn.*`; kandi `kandi.arms`; b4b `h.001`–`h.004` (a test asserts "SYNERGY MAP"); and more.
- **Many pages still wear one dark dress in all three registers.** That is now the ETERNAL lane (`2026-09-26-eternal-blueprint.md`), not a styling pass.
- **Not run here:**
  - live-chain tests: RPCs are blocked by this environment's network policy;
  - `qrroses-smil.mjs`: needs jsqr;
  - the live-site checks.
