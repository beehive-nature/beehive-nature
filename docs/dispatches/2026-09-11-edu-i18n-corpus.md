# DISPATCH — education-page corpus fill (university + dock + New bee cluster)

**Seat:** cloud education-i18n · **Founder order:** FIRE AT WILL — key education prose into
`surfaces/lang-corpus.json` and fill every eco tongue · **Date:** 2026-09-11

**Founder reminder (same day):** New bee must stay digestible by the general commons in all
26 languages — short calm chrome/UI and readable education prose; no jargon dumps in keys
New bee surfaces. Raver may carry emotional/spiritual/plant-medicine tone where those pages
exist. Cypherpunk denser. Raise floors only (ratchet). Continue the fill.

## Beat 1 — university + BlanguageDOCK

122 keys (`uni.*` / `bld.*`). JS-rendered course essays stay unkeyed. Cache then:
`lang-corpus.json?v=18`, `lang.js?v=26`, `tour.js?v=42`.

| surface | before (floor) | after (keyed / visible) | keyed% |
|---|---|---|---|
| `university/index.html` | 7 | **81 / 141** | **57%** (was 6%) |
| `blanguage.html` | 12 | **68 / 368** | **18%** (was 3%) |

## Beat 2 — New bee chrome + readable education (this continuation)

122 keys (`pl.*` / `d.plur.*` reserved rose/talk/stone set / `bst.*` / `bnm.*` / `bf.*`).
Every docked tongue (28) has a non-empty cell. English matches the pages. All ⚙ machine
drafts; no human attestation.

Tone split held:
- **New bee** — short labels (search, sex, age, 3 roses, send) and calm register ledes
  (`bf.bee`, `bst.bee`, `bnm.bee`). No NASEM/ABI jargon folded into bee keys.
- **Raver** — PLUR floor notes, rose gate, stone pillars keep warmth; `*.rav` stays
  soundtrack / constellation register.
- **Cypherpunk** — `bf.cy` / `bst.cy` / `bnm.cy` stay dense (DRI/EER, FNV-1a, live ABI).

Intentionally unkeyed this beat: bfood long biochemistry / fibre GRADE cards and evidence
ladder (jargon-heavy, New bee sees them in English until a later readable pass);
bnames consent dump and ABI workshop cards; JS-injected talk-status lines on plur;
constellation native words (already in their own tongues).

## Cache / measurement

- `lang-corpus.json?v=18` → `v=19` (`surfaces/lang.js`)
- `lang.js?v=26` → `v=27` (`surfaces/tour.js`)
- `tour.js?v=42` → `v=43` via `scripts/bump-rider.sh` (frozen orbit left alone)
- Atlas generator + `tools/build-surfaces.mjs` templates bumped; hub regenerated
- Front-door tests pinned to `tour.js?v=43` (`e2e/register.test.mjs`,
  `e2e/forge-room-views.test.mjs`) — this was the red `static` pin from beat 1's v=42 bump

Astra measurement paths in `lang.js` (`measureVisibleText` / `summarizeCoverage`) were not
edited.

## keyedΔ beat 2 (measured after this commit)

Floors for the new cluster are raised in the follow-on floors commit on this same branch.
Ratchet only — no page may fall.

## §7 identity

Beat 1 commits had been published with the seat as author. That fails
`scripts/identity-check.sh` (AUTHOR must be the founder). This branch's history was
rewritten so those commits — and every later one — are founder-authored, seat-committed,
with a `Co-authored-by` trailer. Force-push was required; a descendant commit cannot
remove a bad author from the already-pushed range.

## Gates

Beat 1 local: estate-source 11/11 · lang-coverage.test 9/9 · floors PASS · university-smoke 78/78.
Beat 2: estate-source English/key existence held before push (931 page keys; 1073 corpus
keys × 28 tongues). Hub idempotent after atlas regen. Coverage floors + smoke re-run
after the floors commit.

## Live poke (after merge)

- https://skaists.dev/surfaces/university/index.html — picker → ru / lv / th
- https://skaists.dev/surfaces/blanguage.html — same
- https://skaists.dev/surfaces/plur.html — New bee default; roses / stone / floor
- https://skaists.dev/surfaces/bfood.html — bee lede + body labels
- https://skaists.dev/surfaces/bset.html — bee lede + chrome
- https://skaists.dev/surfaces/bnames.html — bee lede + search chrome

## Not this beat

stack remaining essays · bigen · museum · bearth · bsymposium · blongevity · hardware
education · bfood science cards · bnames ABI workshop.
