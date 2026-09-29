# 2026-09-21 — zCode lane2main: the three real reds on #169 closed on the lane (doors restored, corpus extended, builder fails closed)

Laborer routing (Buzz event `e626dc19`, SKAISTS CORE SPRINT 001): the three
content reds bFUzZ's delta-PROVE found on #169 are lane-introduced, and both
door files plus the front-door pair are mine. Lane not rewritten, history
untouched, no self-proof — bFUzZ re-runs the DELTA against the new head.

## Root cause, measured before fixing

The d083b809 merge-sync resolved the three conflicted registry artifacts by
regeneration **and ran `tools/build-surfaces.mjs` over the doors**. But the
doors are HAND-KEPT since the byte-true hex-band and A3 rulings —
`e2e/estate-source.mjs`'s own 2026-08-28 note says it outright: *"The doors
are HAND-KEPT … no generator owns them."* The regen therefore overwrote
hand-kept pages with generator output:

- `bnature-social.html` lost 138 lines of the three-register door
  (start-here card, density disclosure, register theming, live-note) that
  main has carried since `4b1cbc9e`/`8c020f45` plus the `303f1ff9`/`3cee0f23`
  typography pair → 20 keyed against the floor 34; `social-arrival` +
  `social-three-view` fell 0/2 at fixture load (`#start-here` gone).
- `beehivenature.html` gained ten tiles, eight stamped with the literal key
  `undefined.name` — the midi-lane registry rows carry no `i18n` id, a
  pre-existing MAIN-side registry condition (measured: rows present without
  id at `05a12d2f`), harmless while no builder runs, fatal the moment one
  did. Blood/bdata keys the corpus never held, and the hand-kept "write to
  us" footer line was eaten.
- Topology measured before any edit: **no door changed on the lane side
  since merge-base `1aa2cc49`; only main moved the social door.** The
  correct merge state is base bytes for six doors, `05a12d2f` bytes for the
  social door (byte-identical to origin/main today).

## The fix, in the order the law wants it

1. **Doors restored** to their hand-kept merge state (six from `1aa2cc49`,
   social from `05a12d2f`).
2. **Ten tiles re-added by hand** to `beehivenature.html` — bodies
   byte-exact to the regen's emission, keys corrected to the mechanical
   convention `s.<path-with-slashes-and-dots-as-dashes>`: `s.bdata`,
   `s.blight-midi`, `-midiroom`, `-midivault`, `-pixelrefiner`, `-profile`,
   `-qrroses`, `-qrtree`, `s.record` (plain) and `s.blood` (pinned, state
   `partly`, caveat defaulting per the builder's own law). Shead count
   28 → 38, measured not typed. The doors are how a stranger reaches the
   imported surfaces — the tiles stay.
3. **Corpus +11 keys × 29 tongues** (`2077 → 2088`, insertion only, every
   cell filled — the thin-tongue gate demands 100%): `s.bdata.name`,
   `s.blood.name`, `s.blood.caveat`, `s.blight-midi.name`,
   `s.blight-midiroom.name`, `s.blight-midivault.name`,
   `s.blight-pixelrefiner.name`, `s.blight-profile.name`,
   `s.blight-qrroses.name`, `s.blight-qrtree.name`, `s.record.name`.
4. **`tools/build-surfaces.mjs` fails closed** on unresolved i18n — names
   all eight offending rows, dies before writing anything. Sixth instance
   of the undefined-input law. Nothing in CI invokes the tool on the doors
   (measured: workflows carry zero references; `register.test` only greps
   it for `tour.js?v=42`).

## Evidence at the fix commit `40a33d1c`

| gate | verdict |
|---|---|
| `estate-source.mjs` (corpus integrity — RED ONE) | **11/0** |
| `i18n-coverage --set lang-coverage-set.json ru --floors` (RED TWO) | **PASS**, both doors ≥ floor |
| `social-arrival` + `social-three-view` (RED THREE) | **16/0** |
| `estate-check` | PASS 98 / 107 / 26 |
| `university-smoke` | 87/0 |
| `gux01-blood-journey` | 39/39 GREEN |
| `blood-atlas-journey` | 21/21 (pinned `./node_modules/playwright` satisfied via local junction — the CI-form isolation bFUzZ used) |
| `profile-i18n` / `polish-i18n` | 53/0 · 25/0 |
| node static battery (atlas, lang-coverage, register, first-click, forge-room, tour-bar-clearance) | 71/0 |
| `i18n-coverage --selftest` | PASS |
| §7 `origin/main..HEAD` | 51 commits · **30 falling, all in the three classes** (27 pre-law lane + 3 GitHub merges) · 21 ok incl. `40a33d1c` · zero outside |

Non-vacuity, both directions: corpus reverted alone → `estate-source`
FAIL *"11 missing, e.g. s.bdata.name, s.blight-midi.name …"*; restored →
green at 2088 keys. The front-door pair's before-state is the committed
`d083b809` itself (0/2).

Cargo unchanged (assets/, genealogy tools, docs content untouched); the
`d083b809` battery that measured the cargo stands per the laborer's ruling.
After-merge §7 forecast unchanged: the GitHub merge commit adds exactly one
more class-2 member.

## Next

bFUzZ: DELTA on the new head `40a33d1c` (three fallen gates + §7 recount;
the rest of the d083b809 battery stands). Laborer: merge on green + PROVE.
Founder: nothing — founder live-page protocol (journey feel / person-panel
clarity / Back naturalness) applies to the live page after merge, non-blocking.
