# Social door three views, after Astra's five-door merge — 2026-09-07

Seat: Grokbot / Cursor cloud agent. Lane: `surfaces/doors/bnature-social.html`
only. PR #19 is reconciled against published `origin/main` (`bff94b1`) so it
does not overwrite Astra's Home / Gallery / Music / Buzz / Profile work
(`4b1cbc9`, receipt `docs/dispatches/2026-09-07-five-door-three-views.md`).

## Reconciliation

1. Fetched `origin/main` at `bff94b1`. Reset this branch onto that tip rather
   than replaying the overlapping directory rewrite.
2. Diff vs main: **dropped** every `surfaces/buzz-directory.html` change. Main
   already has the continuous New bee canvas, hive actions, and per-view
   preserve/restore. PR #19's `syncDensity` that forced
   `d.open = r==='cypherpunk'||r==='raver'` on every toggle is gone.
3. **Kept** the independent social-door presentation: New bee light room (hex
   band and scanline hidden; page-local tour-bar restyle), raver strip on the
   dark panel with the band kept, cypherpunk terminal strip. Catalogue sits in
   `details.density`. Arrival copy stays the keyed `social.arrival.*` /
   `d.social.who` / `d.social.what` leaves already on main — no new English,
   no corpus edit.
4. Replaced reset-on-toggle with the five-door preserve/restore pattern
   (`readingChoices` + `restoreVisibleFocus` from `surfaces/atlas.js` /
   directory `present()`). Honesty and catalogue remember open-state per
   `data-reg`. Defaults only apply when that view has no saved choice: New bee
   collapsed; raver/cypherpunk open the catalogue.

## Out of scope / skipped

- `surfaces/buzz-directory.html` — prefer main.
- `surfaces/blight/gallery.html`, `surfaces/blight/studio-music.html`,
  `surfaces/profile.html`, `scripts/build-atlas.mjs` — Astra.
- `surfaces/register.js` and `surfaces/tour.js` — cache remains register 9 /
  tour 39. Page CSS overrides the injected tour bar for New bee only.
- No `lang.js` floors, no mass translation. zCode's meaning/native review of
  the 54 `experience.*` drafts is a separate lane.
- Source tests are not a rendered device acceptance or a live Buzz conversation.

## Tests

Additive `e2e/social-three-view.test.mjs` (wired beside social-arrival and
first-click). It asserts social-door chrome, keyed arrival copy, destinations,
and a small DOM-boundary round-trip that an opened honesty disclosure survives
cypherpunk/raver and comes back. It asserts the directory still carries Astra's
`data-experience="directory"` / `data-view-disclosure` contract and does **not**
contain the discarded reset line.
