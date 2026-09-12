# bFood Hexagon three-temperature adapter — 2026-09-11

Seat: Grok / Cursor cloud agent. Lane: adapter #3 after bEarth #45 and
Symposium #46 (the live order on this beat: bEarth → Symposium → Hexagon).
Branch: `cursor/bfood-three-temp-9be5`.

David Irvine / x0x #622 is still the standing backend priority. This
seat was assigned the Hexagon presentation adapter; no backend, mesh,
or measurement claim is made here. No health-outcome rewrite.

## What changed

Same Hexagon instrument: body inputs, 40 cells, ledger, protein quality /
PDCAAS, fibre Lancet/GRADE table, fat disaggregation, evidence ladder,
sources, cite-or-silent. First paint is what changed. Fibre GRADE and
disease endpoints stay on Cypherpunk contact and on deepen only.

## Visual QA poke

`http://127.0.0.1:8765/bfood.html` with `surfaces/` as the server root —
the same poke that 404s `/surfaces/register.js`.

Cure, copied from #45 / #46:

- `tour.js` sibling riders (`register.js`, `lang.js`, `rails-badge.js`)
  resolve from `document.currentScript.src`. Tour-bar hrefs still use `R`.
- Page-owned `#bregbar` with `data-register-host` and `data-language-host`
  so `#bregctl` and `#blangctl` paint on first-paint chrome.
- Inline `[data-reg]:not(body){display:none}` plus the matching revert,
  so the cypher masthead (NASEM / NotMeasured / n/m) cannot FOUC onto
  New bee if register is late or 404s.

## Graded first paints (Chief PASS, implemented as written)

- **New bee:** calm sentence (“This is your food, drawn honestly — for
  your body, not an average person.”), takeaway lead (“A blank stays
  blank — never drawn as zero.”), quieter support (where science doesn’t
  know a number, the cell says so), one choice (**Draw my hexagon**),
  and **Go deeper**. ZERO body-input dials, 40-cell ledger, PDCAAS
  tables, Lancet/GRADE disease rows, spreadsheet coverage bars.
- After **Draw my hexagon:** one calm seven-cell drawing (blanks stay
  blank), then **Open the inputs** (five body dials only) before the
  full hex / ledger. Do not dump all five dials and the full hex on
  the same beat.
- **Raver:** living hex / soft plant–body wash (biomass green → teal →
  purple); reduced-motion = one calm frame. Feeling: “What if the plate
  told the truth — including the blanks?” Tap: **Touch the drawing**.
  Consciousness (“A blank that stayed blank is reverence — not a zero.”)
  is layer 2 only, then the New bee takeaway stack.
- **Cypherpunk:** today’s full Hexagon instrument on contact — body
  inputs, hex cells, ledger, PDCAAS, fibre GRADE / Lancet rows, fat
  classes, evidence ladder, sources, cite-or-silent. Sources use
  `data-view-disclosure` and default open in this view.

Footer keyed leaves (`s.bfood.name`, `bfood.foot.measure`,
`bfood.foot.learn`, `law.hive`) stay laid out so the first-paint floor
of 12 does not drop. Dial-grade / n/m / NotMeasured clauses ride
`data-reg="cypherpunk"`.

## Language

Fourteen `bfood.*` keys were machine-drafted across English plus the 28
docked tongues and marked ⚙. `plate` means dinner plate / food.
`blank` is an unmeasured cell, not a form field. `hexagon` is this
drawing. `reverence` is deep respect. Meaning review is still owed.
Existing `h.022`–`h.032` headings stay on the instrument.

## Verification named here

- `node --test e2e/bfood-views.test.mjs e2e/register.test.mjs`
- `node scripts/estate-check.mjs`
- `node e2e/estate-source.mjs`
- browser first-paint screenshots of the three registers at the 8765 poke

## Re-poke receipts (same day, 8765)

Served `surfaces/` at `http://127.0.0.1:8765/bfood.html`. Confirmed
`/surfaces/register.js` is 404 on that poke (the old alias) and
`/register.js` + `/lang.js` are 200. Playwright-core against system
Chrome, `localStorage` cleared, 1280×800:

- New bee: `.sub[data-reg=cypherpunk]` `display:none`; instrument
  `display:none`; above-fold ZERO Lancet / GRADE / PDCAAS / mortality /
  height-cm dials; `#bregctl` and `#blangctl` painted; calm + takeaway
  lead + Draw my hexagon.
- Draw my hexagon: seven-cell calm drawing; still no dials / ledger /
  GRADE.
- Open the inputs: five body dials; instrument (hex/ledger/GRADE) still
  hidden.
- Raver: feeling line on; reverence / consciousness off; instrument
  hidden.
- Touch the drawing: consciousness on, then the New bee takeaway stack.
- Cypherpunk: instrument + cypher masthead on; sources default open;
  PDCAAS / Lancet / GRADE / 40-cell ledger intact.
- Switch back to New bee: cypher masthead stays `display:none`. Beat
  memory keeps the inputs layer when returning after that tap.

40/40 poke assertions PASS. Browser walk New bee → draw → inputs →
Raver → Touch the drawing → Cypherpunk → New bee matches.

Skipped this beat: fleet attestation of the new keys, WELLness adapter,
any health-outcome rewrite, live USDA / Lancet re-fetch (composition
and GRADE rows are unchanged).
