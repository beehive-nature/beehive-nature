# THE ACTION HUE — the old green call-to-action gives way to the ruled face, by meaning

**Seat:** Cowork (design + UI). **Date:** 2026-09-19. **Branch:** `cowork/action-hue-2026-09-19`.
Third step of the founder's makeover order (after the hub and paper-and-ink).

Green means *living / verified* in this estate. It was also the new-bee button colour, so
every page shouted "alive" where it meant "press me". `scripts/tmp/action-hue-sweep.mjs`
moves only the ACTION uses of `#326b39`, rule by rule (65 swaps across 24 files, tests
that pin them; a re-run changes nothing):

| what it was doing | becomes |
|---|---|
| a filled call to action (`.door.primary`, `a.btn`, `button.keep`, `#mkReview`, `--primary`, `--you`) | magenta `#a8238c` — you, the one acting (white label 6.4:1) |
| a link, an accent, the agent dock accent, form accent | human purple `#6e3fb8` (6.4:1 on paper) |
| a hover / focus edge or outline, `--active` | ink `#0c1412` |

**Stays green, on purpose:** `--leaf --verified --biomass --ok --green --fill* --ess
--c-works --t-sup`, every drawn `fill="…"`, and any page that chose
`data-bee-accent="green"`. `surfaces/bdata.html` (zCode's lane) and founder art under
`surfaces/fleet*` are not touched.

**Gates (un-piped):** estate-check · front-door suite 333/333 · estate-source on the
committed tree · no-page-errors. Looked at at 390px: profile, buzz directory, onboarding,
university, kandi, bFood.

**Receipt:** live pages at 390px — never the git state.
