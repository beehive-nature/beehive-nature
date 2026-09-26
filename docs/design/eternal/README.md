# ETERNAL — the three-UI blueprint (FOUNDER ORDER, 2026-09-26)

> use this to "overachieve" legendary status. use this as the blueprint UI reference.
> THE CRITICAL IS EVERYONE ACTUALLY HAS TO BUILD THREE SEPERATE UI/UX'S IN THE SINGLE SURFACE.
> SO THOSE THAT ARE TRIGGERED BY ONE OPTION WILL LOVE THE OPPOSITE WITH EQUAL VALUE CORRECTLY
> ALIGNED WITH INTENTION/ENERGY
> — founder, 2026-09-26

`UI_Design_version_eternal.html` is the founder's blueprint, committed as it was sent. It is a
self-unpacking bundle: open it in a browser. `screens/` holds the ten 390x844 screens as they
render, and `markup/` holds each screen's markup (fonts stripped; they are in
`surfaces/skaists.css`). The example is bGENEaLOGy (`surfaces/blood.html`, estate id `blood`; not `bigen.html`, which is the BiGen evidence library): one flow
(your line, then keep it forever, then kept), built three times.

## The law

1. **Three products in one surface.** new bee, raver and cypherpunk are three separate UIs. Each
   has its own layout, its own graphics, its own gesture and its own words. A register is never
   the same column recoloured: that was the D+ the founder rejected on 2026-09-26.
2. **One set of facts.** Every register shows the same truth, has the same capabilities and
   leads to the same outcome: the same address, price, consent terms, the living-people guard and
   the same receipt. Only the dress, the density, the gesture and the voice change
   (`register.js` canon 2026-08-28).
3. **Equal value, opposite energy.** Someone put off by one register must find the other one
   just as complete and just as beautiful, not a lesser twin. bee is calm and plain. raver is
   the data as art, and the gesture is the consent. cypherpunk is the instrument, with every step
   and every hash visible and verifiable.
4. **The switcher is the same everywhere.** A pill with three equal segments (⬡ new bee · ✳ raver ·
   ‹› cypherpunk), 44 px tall, with the current one filled. It is the estate's `#bregbar`.

## The three grammars (measured from the blueprint)

| | **new bee** | **raver** | **cypherpunk** |
|---|---|---|---|
| ground | paper `#FBF7F0`, ink `#0C1412` | black-green `#06110C` / panel `#0C1412`, ink `#E9F2EC` | `#06110C` / panel `#0C1412` / `#120E1E` |
| type | **Instrument Serif** 40 px/1.05 titles · **Instrument Sans** 16 px/1.45 text, 14 px secondary | **Unbounded** 500–700 titles (30 px), labels .04–.08em · **Sora** 13–15 px text | **IBM Plex Mono** throughout: 15 px titles, 12–14 px rows |
| secondary ink | `#4A5F55` | `#C9D6CE` | `#8FA79C` labels, `#C9D6CE` values |
| accent | one magenta action `#A8238C` (radius 16, 54 px tall); links violet `#6E3FB8` | magenta `#D655BB` pill, violets `#9C6FD6 #A57CDA #AF8BDD #B79FE0`, kept palette `#9C6FD6 #6FA9E0 #45C2DC #86CC72` | teal `#45C2DC` action (radius 6); violet `#B7A8F7`/`#C9B2EE` for guards; green `#86CC72` for done |
| structure | a card of rows (52–60 px, 1 px `#EFE9DD` rules), chevrons, avatar initials; one lavender reassurance (`#ECE8FA`/`#4A3AA8`) | **the data is the art**: the family line is a mandala of rings you tap; icon tiles (radius 20, 1.5 px violet border); legend dots | tables (`gen · rel · slots · state`), a numbered pipeline `01–06`, a key/value receipt, verify steps you can run |
| the consent gesture | a checkbox, "i understand, and i choose this." then "pay once and keep forever" | light all four terms, then **hold to seal** (a hexagon in a progress ring); "your hold is your consent" | "sign consent + settle": the signed manifest hash and the three terms written out |
| the ending | "kept." with a check, where it lives, copy, invite a relative | "kept" as art: the rings recoloured in the kept palette; share the art | a receipt table (address, manifest sha256, consent, guard, paid, job), "run verify here", export, **fork the template** |
| voice | lower case, plain, kind: "nothing is public until you say so." | lower case, literal, short: "one payment · your hold is your consent" | lower case, exact: "single-flight across tabs · timeout 150 s · automation refused" |
| unknowns | `[n]`, `[price]`, `[address]` are placeholders for live values; a surface shows the live value, or says plainly that it has not been read. Never a dash. | | |

**Estate floors still apply on top of the blueprint.** The blueprint draws a few raver and
cypherpunk labels at 11 px. On the estate they are 12 px at least, and bee reading text is 16 px.
Every target is 44 px (the blueprint agrees), contrast is at least 4.5:1, there are no
`text-transform` capitals (the blueprint is lower case throughout), and raver motion stays
under 3 Hz, pausable and still under reduced motion.

## The raver v2 interaction (from the blueprint's own logic)

The mandala *is* the interface: one screen, three modes.
- `line`: tap a ring (2 = grandparents, 4 places · 3 = great, 8 · 4 = 2x great, 16 ·
  5 = 3x great, 32). The selected ring lights `#F3EAFF` and the others sit at 0.6.
- `seal`: tap "you" to start. Four term tiles (everyone sees · forever · no undo · living out)
  must each be lit by a tap ("n of 4 lit"). Only then can the hold start; the rings dim to 0.3.
- `kept`: the rings take the kept palette and the rim appears; "colour = kept".

## Using it on a surface

- Load `surfaces/skaists.css`, the estate's design system compiled from `docs/design/skaists/tokens.json`
  by `scripts/build-skaists.mjs`. It holds every colour per register as `--sk-*`, the type styles as
  `.sk-*`, spacing, radii, control sizes and glows, plus the self-hosted OFL faces (see
  `surfaces/fonts/eternal/OFL.md`). **Never hand-pick a hex, a size or a corner**: the blueprint's
  own mock-up values (for example the ring violets `#A57CDA` and `#AF8BDD`) are not tokens; the token
  is the law.
- Measure it: `node e2e/skaists-conformance.mjs --only <page>` scores COLOUR, TYPE, RADIUS, TARGET,
  CONTRAST and CASE per register. A three-UI front must score 100%.
- Author three presentations under `body[data-reg="bee" | "raver" | "cypherpunk"]`, with separate
  markup where the structure differs, not only CSS. Everything is driven by one data layer, so the
  facts cannot drift apart.
- Prove it in e2e: in each register, the facts shown are the same, and the dress, the structure
  and the gesture are different (see `e2e/bview.test.mjs` test 14 for the pattern).
