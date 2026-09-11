# bEarth three-temperature adapter — 2026-09-11

Seat: Grok / Cursor cloud agent. Lane: adapter #1 in the estate
order (bEarth → WELLness → Symposium → Hexagon → remaining doors).
Branch: `cursor/bearth-three-temp-d797`.

## Visual QA must-fix (same day, local poke `http://127.0.0.1:8765/bearth.html`)

New bee soft-failed: the cypherpunk masthead `.sub[data-reg=cypherpunk]`
leaked N₂O / IPCC prose above the fold. Root cause: `tour.js` loaded
register/lang from the production `/surfaces/` alias, which 404s when
the server root *is* `surfaces/`. `#bregctl` never mounted, so
register scoping never applied; `#blangctl` stayed in the overflow
`#tbar` (or never loaded).

Cure, in tree:

- `bearth.html` now carries the estate `[data-reg]:not(body){display:none}`
  + matching revert **inline**, so a cypher-only leaf cannot FOUC if
  register is late or fails.
- Page-owned `#bregbar` with `data-register-host` and
  `data-language-host` (atlas mast-nav / gallery top-nav). Language
  picker mounts in first-paint chrome, not `#tbar`.
- `tour.js` sibling riders (`register.js`, `lang.js`, `rails-badge.js`)
  now resolve from `document.currentScript.src`. Tour-bar hrefs still
  use `R`. Estate law still one `tour.js` loader — no extra register
  script tag.

Re-poke criteria: New bee ZERO cypher masthead leak; `#bregctl` and
`#blangctl` painted on first paint. Raver / Cypherpunk first paints
unchanged in substance.

## Re-poke receipts (same day, after the shell fix)

Served `surfaces/` at `http://127.0.0.1:8765/bearth.html`. Confirmed
`/surfaces/register.js` is 404 on that poke (the old alias) and
`/register.js` + `/lang.js` are 200. Playwright-core against system
Chrome, `localStorage` cleared, 1280×800:

- New bee: `.sub[data-reg=cypherpunk]` `display:none`; above-fold
  ZERO N₂O/IPCC/REFUTED; `#bregctl` 400×44 at top; `#blangctl` 181×44
  inside `[data-language-host]`; fraction-led cropland + deepen gates.
- Raver: feeling line on; consciousness off; breg+blang painted.
- Cypherpunk: instrument + cypher masthead on; breg+blang painted.

15/15 poke assertions. Browser walk (view switch New bee → Raver →
Cypherpunk → New bee) matches. Skipped: live FAOSTAT pull, fleet
attestation of the new keys.

This is a presentation adapter, not a new model. The demand arithmetic,
FAO cropland denominator (1,581 Mha), recovery/yield defaults, N₂O
emission-factor dial, refutation tables and source list are the same
instrument as before. First paint is what changed.

## What a reader meets

- **New bee:** one calm sentence, the feelable takeaway “about half of
  Earth's cropland” with ~830 Mha in supporting type, then one door
  (**See the land cost**) plus **Go deeper**. Zero dials, zero
  REFUTED/survived tables, zero N₂O/IPCC prose on that first paint.
- **Raver:** soil / seed / stalk atmosphere (one still frame when
  `prefers-reduced-motion`), one feeling line, one tap (**Touch the
  numbers**). The consciousness beat is layer 2 behind that tap, then
  the same fraction-led figure and New bee choice stack.
- **Cypherpunk:** the current full instrument on contact — dials,
  assumptions, receipts, limits, cite-or-silent sources. Sources stay
  on a `data-view-disclosure` panel that opens by default in this view.

View switching keeps per-register beat and disclosure memory
(`applyReading` / `readingChoices` / `beatChoices`), the same contract
as forge/room, kandi and the social door.

## Numbers

~830 Mha / about half is the existing default run (8.2 bn × 100 g/day ÷
36% recovery ÷ 1.0 t/ha against FAO ~1,581 Mha). No new hectare,
emission-factor or yield figure was invented. The live land layer
restates the same `calc()`.

## Language

Nine `bearth.*` keys were machine-drafted across English plus the 28
docked tongues and marked ⚙. Industrial hemp seed, not marijuana.
Meaning review is still owed. Existing `h.009`–`h.016` headings stay
on the instrument.

## Verification named here, run after the commit

- `node --test e2e/bearth-views.test.mjs`
- `node scripts/estate-check.mjs`
- `node e2e/estate-source.mjs`
- browser first-paint screenshots of the three registers

Skipped this beat: live FAOSTAT pull (still the named open item in
§5), fleet attestation of the new keys, WELLness / Symposium /
Hexagon adapters.
