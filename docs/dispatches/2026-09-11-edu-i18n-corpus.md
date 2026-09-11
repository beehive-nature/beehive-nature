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

## keyedΔ (measured `i18n-coverage.mjs ru --set e2e/lang-coverage-set.json`)

| surface | before (floor) | after (keyed / visible) | keyed% |
|---|---|---|---|
| `university/index.html` | 7 | **81 / 141** | **57%** (was 6%) |
| `blanguage.html` | 12 | **68 / 368** | **18%** (was 3%) |

Floors raised to those absolute keyed counts. Ratchet held (no page fell). Empty cells on new keys: 0. Missing corpus keys: 0. ru reach = keyed on both surfaces.

Sanskrit 908/951 is a **pre-existing** `st.*` empty-cell backlog (43 cells), not this beat's keys — every new `uni.*`/`bld.*` cell is filled including `sa`.

## Gates (this revision)

- `node e2e/estate-source.mjs` — **11/11** (809 page keys exist; 28 tongues × 951 corpus keys; English matches pages; hub idempotent)
- `node e2e/lang-coverage.test.mjs` — **9/9**
- `node e2e/i18n-coverage.mjs ru --set e2e/lang-coverage-set.json --floors --set-floors --emit-md` — **PASS**; floors advanced; `docs/LANG-COVERAGE.md` regenerated 2026-09-11
- `node e2e/university-smoke.mjs` — **78/78**

## Live poke (after merge)

- https://skaists.dev/surfaces/university/index.html — picker → ru / lv / th
- https://skaists.dev/surfaces/blanguage.html — same

## Not this beat

bfood / bset / plur / stack / bigen / museum / bearth / bsymposium / blongevity / hardware
education essays. Next stacked PR.
