# DISPATCH — education-page corpus fill (university + BlanguageDOCK)

**Seat:** cloud education-i18n · **Founder order:** FIRE AT WILL — key education prose into
`surfaces/lang-corpus.json` and fill every eco tongue · **Date:** 2026-09-11

## What landed

122 new keys (`uni.*` university chrome + course names/act headings; `bld.*` BlanguageDOCK
education prose). Every docked tongue in `lang-corpus.json::_meta.langs` (28) has a non-empty
cell. English matches the pages (`estate-source` stale-English check). All ⚙ machine drafts;
no human attestation.

JS-rendered course *essays* (bee/raver/cypherpunk long form) and act option lists stay
unkeyed this beat — no invented instructional copy. Names, act headings, static charter /
quests / graduation / gates / footer, and the dock's teaching banners are keyed.

## Cache / measurement

- `lang-corpus.json?v=17` → `v=18` (`surfaces/lang.js`)
- `lang.js?v=25` → `v=26` (`surfaces/tour.js`)
- `tour.js?v=41` → `v=42` via `scripts/bump-rider.sh` (frozen orbit left alone)
- Atlas generator + `tools/build-surfaces.mjs` templates bumped so the hub stays idempotent

Astra measurement paths in `lang.js` (`measureVisibleText` / `summarizeCoverage`) were not
edited.

## Gates (pre-test commit)

`node e2e/estate-source.mjs` — 10/11 then hub regenerated; language stack 809 page keys exist,
28 tongues × 951 corpus keys, English matches pages. Coverage floors / `LANG-COVERAGE.md`
emit and `e2e/lang-coverage.test.mjs` follow this commit.

## Live poke (after merge)

- https://skaists.dev/surfaces/university/index.html — picker → ru / lv / th
- https://skaists.dev/surfaces/blanguage.html — same

## Not this beat

bfood / bset / plur / stack / bigen / museum / bearth / bsymposium / blongevity / hardware
education essays. Next stacked PR.
