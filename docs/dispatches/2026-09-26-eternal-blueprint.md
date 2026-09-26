# ETERNAL + SKAISTS — three products in one surface, measured against the design system (2026-09-26)

**Seat:** Claude (cloud session; committer `Claude <noreply@anthropic.com>`, author the founder per §7).
**Branch:** `claude-lovis/magical-allen-dd0xqh` (PR #233).
**Founder orders, same day:**

> use this to "overachieve" legendary status. use this as the blueprint UI reference.
> THE CRITICAL IS EVERYONE ACTUALLY HAS TO BUILD THREE SEPERATE UI/UX'S IN THE SINGLE SURFACE.
> SO THOSE THAT ARE TRIGGERED BY ONE OPTION WILL LOVE THE OPPOSITE WITH EQUAL VALUE CORRECTLY
> ALIGNED WITH INTENTION/ENERGY

> there is real UX/UI/standards metrics … if you use the same thinking that got you into this
> issue nothing changes.

The founder sent the blueprint (`UI_Design_version_eternal.html`) and then the design system itself: skaists `tokens.json` and `manifest.json`, graded A- on 2026-09-19.

## What was wrong with the thinking
Every "fix" before this one was judged by eye, and styled with hex values picked by hand. The repo already carried the answer: the tree-of-life component is built on skaists values. The founder's system has named tokens with usage rules ("primary: once per view", "guard is lilac and never red", "honey is b amounts only"), a type scale per register, a senary spacing rhythm and radius and control tokens.

Measured against that system, this seat's own earlier work scores:
- bView (the "three registers" rebuild): **65–79%**;
- the "A-level" museum: **62–75%**.

Now there is a number, and the number is the bar.

## What is new
1. **The design system in code.**
   - `docs/design/skaists/tokens.json` and `manifest.json` are adopted as canon (with a `.gitignore` exception).
   - `scripts/build-skaists.mjs` compiles them into `surfaces/skaists.css`:
     - 36 colour tokens × 3 registers as `--sk-*`, with `{refs}` resolved;
     - 27 type styles as `.sk-*`;
     - spacing, radius, control, glow, the rainbow and rtl direction;
     - the self-hosted OFL faces, plus burti.
   - `--check` fails CI when the CSS is stale, so no one hand-copies the tokens again.
2. **The standards meter.** `e2e/skaists-conformance.mjs` scores each surface × register at 390 px:
   - COLOUR: every painted colour is a token of *that* register (the rainbow's stops count);
   - TYPE: every size is on that register's scale;
   - RADIUS: every corner is a radius token;
   - TARGET: every target is at least 44 px;
   - CONTRAST: WCAG 2.2 AA;
   - CASE: no `text-transform`.

   The shared chrome is measured once, not per page. `--scope body` scores a whole page.
3. **The blueprint as canon.** `docs/design/eternal/` holds:
   - the founder's file as sent;
   - the ten screens as PNGs;
   - each screen's markup;
   - README.md with the law, the three grammars and the raver v2 interaction, recovered from the blueprint's own logic.
4. **The flagship: bGENEaLOGy (`surfaces/blood.html`), three products in one surface:**
   - **new bee: a calm library.**
     - "your family line" in Instrument Serif, and "living people stay out. always." as a guard row.
     - A card of generation rows: the parents are living and so kept out; 4, 8, 16 and 32 places, each opening to its people.
     - Then "keep it forever?": three terms, the price in ANT, the consent box ("i understand, and i choose this.") and one magenta action.
   - **raver: the line is the art.**
     - A fan chart of five rings, one segment per place, with the living shown dashed; tap a ring to read it.
     - Tap "you" to seal: light all four term tiles, then **hold to seal**. A short hold does nothing.
     - The kept state takes the rainbow, read rim to centre.
   - **cypherpunk: the instrument at first paint.**
     - `bData://genealogy/440b502a…`, state chips and the dashed living guard.
     - The manifest table (gen · rel · slots · state).
     - The six-step seal pipeline pointing at the first step not yet done.
     - The receipt (address, manifest, consent, guard, paid, retrieved, verified), how to verify it, export, and "fork the template ↗".
   - **One data layer** feeds all three:
     - the line walked parentward from the founder in the archive's own model;
     - the storage receipt `zblood-storage-economics.json`.
   - **Honest gestures.** Every keep-forever gesture hands off to the page's existing preservation flow (`#preservebtn`), where the live quote and the wallet device are the gate. "kept" is drawn only if the receipt says uploaded. Today it says `purchased: false` and `uploaded: false`, so no register claims it.
   - **The whole archive** stays below the fronts, dressed per register by mapping the page's own variables onto `--sk-*`.
   - **Found and fixed on the way:**
     - The pressed "pedigree" button was gold on gold, so its label was invisible.
     - The person drawer's peek was an empty band: it is now named from the first paint, and waits below the screen until the reader reaches the archive.

## Receipts (this box, Chromium 1194, 390 px)
- `node e2e/skaists-conformance.mjs --only blood.html`: **100% in bee (108 checks), raver (141) and cypherpunk (449)**. The same page with the first, hand-picked build scored 96.5 / 68.1 / 96.0.
- `node --test e2e/blood-eternal.test.mjs`: **6/6**:
  - one front per register in its own dress;
  - the same facts in all three (the model's gens, the rings = [2, 4, 8, 16, 32], the table, the living guard = 5, the price from the receipt, and paid and address "not yet");
  - bee consent gating;
  - raver four terms + a full hold, with a short hold a no-op;
  - cypherpunk complete at first paint;
  - the laws: no dash, no caps, 44 px.

  It cannot pass on the previous page, which has no front.
- `gux01-blood-journey` 39/39, `blood-atlas-journey` 21/21, `footer-audit` on blood: 0 findings.
- Screens: `docs/dispatches/evidence/2026-09-26-eternal/`:
  - `before-blood-*-390.png`: one dark mono column in all three registers;
  - `after-*`: the three fronts, the bee keep-it-forever step, the raver hold and an open cypherpunk generation.

## Not done yet (named)
- **The other 103 surfaces.** The rollout runs in agent waves on the brief built from this flagship. The acceptance bar is 100% on each front, with the whole-page score rising. The estate-wide "before" scores are measured from a frozen copy of the committed tree.
- **Translations of the new `et.*` strings.** They are English through `BNRLanguage.text` fallbacks; the corpus pass comes after the rollout.
- **Live chain and network reads** are blocked in this environment, so every live read was seen only in its failure state.
- **The founder's `three-node-plan.md` and `server-exit-plan.md` were read, not acted on.** Every step there needs the founder's go.
