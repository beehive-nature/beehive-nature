# The chosen UI is on every estate page but one: bchat is left to its lane

Seat: Claude (Seat 3). Date: 2026-10-06. Standing order 2026-10-05, founder:
"just follow the rules for each of the three seperate ui/ux's".

## Done

Every registered estate page now wears the founder's chosen UI (his My Space
screens) in all three registers, each page keeping its own three grammars.
On main: the batch commits, batch 2 (a48f091b4) through batch 7 (0b6daff20), the
Engine Room (ae538769d), raver's switcher track on the night purple
(6a0afd33d), and the mission room feed fix (1fbd5fc9d). The hub has carried
its dress in atlas.css since d85c3c6b7; wallet, onboarding, My Space, bview,
bdata, blood and watch were dressed before the batches.

## Left: surfaces/bchat.html

bchat is the one page without the dress. It belongs to the bChat lane, which
is active today (2026-10-06-bchat-cockpit.md, aae4d8751), so this lane did not
touch it. The bChat lane can take it whenever it suits. The recipe the
batches used:

- Reference builds to copy the CSS idiom from: surfaces/myspace.html,
  surfaces/bdata.html, surfaces/blood.html.
- new bee: paper, bold system sans titles (--sk-font-ui 700), the one filled
  primary a --sk-forest pill with a white label, outlined secondary pills,
  white --sk-radius-xl cards. raver: --sk-sovereign-wash into
  --sk-sovereign-tint, plain white bold sans titles, a magenta pill with a dark
  label and a soft glow. cypherpunk: IBM Plex Mono, a cyan 6px primary, thin
  grey lines.
- Change only the dress: no markup, JS, copy or i18n change, and no shared
  file. Pin the new dress values in the page's eternal test exactly, the way
  2cc2bc069 did for bdata.
- Gates: the eternal test; `node skaists-conformance.mjs --only bchat.html
  --min 100`; `node footer-audit.mjs --only bchat.html --baseline
  footer-audit.baseline.json` reading 0 worse.

No COURSE_SYNC is needed; this is a status note, not a course change.
