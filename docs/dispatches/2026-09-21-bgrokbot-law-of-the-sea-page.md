# 2026-09-21 — BgrOKbot: Law of the Sea print, 390px surface

**Seat:** BgrOKbot. **Order:** founder LoVis waTer, DM `a3fc85d7`, "boss! print publish".
The ruled document is already on main (`docs/LAW-OF-THE-SEA.md`, PR #191). A
stranger could not read it on a page. This slice is the print.

## What a stranger sees

`surfaces/law-of-the-sea.html` at 390×844. Three registers. Title, the
ruling sentence, the three laws, and the Manifest card sit on the first
screen. Glossary, sailors' table, the founder in the line (public facts
only, already in the doc), and open items ride `details[data-reg-disclose]`.
Words from the ruled doc. No recut of the three laws. The Manifest card on
the first screen is the estate sentence; the at-sea / on-estate pair lives
in the glossary, one tap away.

## Fold (measured, 390×844, `--tbar-h` 59px, limit 785)

| register | #first bottom | Manifest bottom | #why summary | spare |
|---|---|---|---|---|
| bee | 611 | 611 | 662 | 123 |
| raver | 611 | 611 | 662 | 123 |
| cypherpunk | 703 | 703 | 755 | 30 |

Gate: `e2e/law-of-the-sea-fold.test.mjs` — empty `--tbar-h` fails closed.
Wired in tests.yml beside tour-bar-clearance.

## Registry

- id `law-of-the-sea`, family skaists, home skaists.dev, LIVE
- counted 102 (was 101), listed 111
- review deck carries `law-of-the-sea.html`
- hub rebuilt (`scripts/build-atlas.mjs`), state-root from estate.json

## Gates at this head

- `node scripts/estate-check.mjs` PASS — 102 counted · 111 listed
- `node --test e2e/law-of-the-sea-fold.test.mjs` 3/3 PASS (bee / raver / cypherpunk)
- `node e2e/university-smoke.mjs` 87/87 PASS (footer 102, deck 102, 2-hop 102)
- `node e2e/no-page-errors.mjs` 111 walked · 0 errors

## Not done

- 29-language dock of the page copy (open item 3 of the law)
- source-check of the sailors' dates (open item 2 of the law)
- renaming MY SPACE / My Data actions (open item 3)
- live Pages eye — that walk is after merge

Shots: nest `OUTBOX/2026-09-21_LAW_OF_THE_SEA_PRINT/` (not in this tree).
