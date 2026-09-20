# bNames DAY — a name has a day, a day has a name

**Seat:** Seat 3 (Claude Code, Desktop). **Date:** 2026-09-20. **Branch:** `claude-LoVis/grok-buzz-install-13af57`.
**Founder order, verbatim:** "since Latvijan is bQueen Bee's matriarch language and Thai Patriarch why don't you
create a complementry bNames Day surface(s) that is fun and interactive and educational and tribute to ancestors
and boost our genealogy efforts" — then: "be sure to fully leverage our 3 seperate UX/UI's in one surface design."

## What landed

`surfaces/bnamesday.html` — one surface, **three authored presentations over one core**, registered
`skaists · skaists.social · org skaists` (97 counted / 106 listed).

| | |
|---|---|
| `surfaces/bnamesday.js` | the pure core: every fact and rule ONCE (thaksa ring, the Thai day's two boundaries, name index, old-calendar arithmetic, calendar export, family-file shape check). No DOM, no storage, no network — so no view can disagree with another, and the test needs no browser. |
| `surfaces/bnamesday-data.json` | the Latvian name-day calendar, `v:1`: 1,032 calendar names + 4,614 extended = 5,646, 6 Latgalian written forms, 366 days. |
| `scripts/build-bnamesday-data.mjs` | the re-runnable receipt: the State Language Centre's two CSVs → that payload, refusing loudly on any assertion. The Centre revises about every three years (2018 · 2022 · 2025). |
| `e2e/bnamesday.test.mjs` | 10 tests, CI-wired into the front-door line. |

**The two houses.** Latvia gives a NAME its day (the calendar). Thailand gives a DAY its name — colour, planet,
posture of the Buddha, and ทักษา: which letters lift a name and which to leave out. One birth date answers in both.

**The three views** (register canon 2026-08-28 — views change prose and density, never constants; every capability
is in all three, asserted by test): **new bee** one question at a time; **raver** the year as a wheel you touch —
366 spokes, each as long as its names, each the Thai colour of that weekday this year, the family as hexes and
hearts on the ring, a candle lit by press-and-hold (Enter lights it at once), the family playable as a melody
(sound is opt-in); **cypherpunk** the whole payload queryable by text or `/regex/`, distribution, the 8×8 thaksa
matrix with its rule, both converters with their formulas, the raw private store, and the private/public data flow.

**Raver law kept:** the art is non-verbal, the MECHANISMS are literal — every control carries a plain lowercase
word; 22 May reads "every name no calendar wrote down. everyone's in."; nothing moves faster than 3 Hz;
`prefers-reduced-motion` honoured.

## Privacy — the reason for the architecture

This repo is public; a family is not. The people a reader adds live ONLY in that browser's
`localStorage["bnamesday.people.v1"]`, shape-checked on the way in, and leave only as a file the reader asks for
(`.ics`, `.json`). The page makes exactly one same-origin GET and zero third-party requests — measured in a real
browser, and asserted statically by the test.

## What is fact, what is inference (said on the page, not only here)

- **Fact, sourced:** calendar = data.gov.lv, Valsts valodas centrs, CC0-1.0 (source digests in the payload's
  `_meta`). Thaksa letter table = two published tables; all eight กาลกิณี rows reproduce. Old Style gap and the
  pre-1941 Thai new-year rule are arithmetic, tested against known dates.
- **Declared missing, not silently absent:** the portal files are dated 2025-05-16; the Centre's 9 + 56 additions
  effective 2026-01-01 are NOT in them.
- **Inference, labelled as such:** gender from the ending (not in the source); "same-day forms" = same date and
  same first three folded letters; naming-after-the-calendar is a research clue, never proof.

## Fences

- **bGENEaLOGy is not claimed.** It stays the hub's plain "not yet" row; this surface is a complement that feeds
  it (name variants, Latgalian forms, old-calendar dates, the Thai one-family-per-surname fact). Id and path stay
  clear of the builder's `/genealogy/` guard, and the test asserts the page never uses the word.
- `surfaces/bdata.html` and founder art under `surfaces/fleet*` not touched. `tools/build-surfaces.mjs` not run.

## Two things the next seat should know

1. `e2e/estate-source.mjs` regenerates the hub and **restores HEAD's copy when they differ** — run
   `node scripts/build-atlas.mjs` LAST before committing, and run estate-source AFTER the commit as the receipt.
2. `data-bee-theme="shared"` lets `register.js` restyle generic class names (`.house`, `.card`, `.panel`) and
   `h1` fonts. A page that authors its own New bee palette declares `custom`.

## Open, founder's call

- **Placement** — `skaists.social` was this seat's judgment (a people-and-culture surface); one row edit + rebuild moves it.
- **lv and th renderings of the page itself.** Only the hub tile speaks the 28 tongues today (machine drafts ⚙).
  These two tongues are the point of this surface; their renderings want a native eye, not only a draft.
- **The 13-month robot name-day calendar** (founder, same session: "a fun life long side quest") — not built; the
  payload shape (`days` keyed by seat, lists per day) was kept general enough to carry a second calendar.

## Gates (un-piped)

estate-check PASS 97/106 · front-door unit line 343/343 · r5-surface-audit ZERO · secret-scan exit 0 ·
lint-ci-shape 69/69 · no-page-errors 106 walked, 0 errors · university-smoke 87/0 · estate-source on the
committed tree (post-commit receipt). Looked at, at 390px and desktop, in all three views: every control ≥ 44px
on a phone, no horizontal overflow.

**Receipt:** live pages at 390px — never the git state.
