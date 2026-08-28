# LANE LANGUAGE — COVERAGE GATE · KEYING · ×26 · CANON · 2026-08-28

**Seat:** z2.1 · **Founder order:** "the redesigned estate folds into the bLanguage corpus; really make sure everything translates" + the reading-register canon · **Status: CLOSED — P1–P4 + canon landed on main `e7b0e38`, all gates green, live-verified under Russian.**

## P1 — the coverage gate (landed `11fa2cd`→`bbcc72a`)

`e2e/i18n-coverage.mjs` (the denominator instrument, extended, not replaced):
- **keyed% of visible** per surface — the axis every tongue can reach.
- **PER-TONGUE table** — non-empty corpus cells for every key the measured set uses.
- `--selftest` — **the checker-silence proof**: a known keyed string AND a known unkeyed string through the SAME measurement path; exit 1 if the instrument cannot tell them apart. Green.
- `--set` arrival list: **84 pages** — the four redesigned + the seven doors + every page one tap from a door.
- `--floors` / `--set-floors` — **the ratchet**: keyed% may never regress below the recorded line; the 240-key-scale deep backlog (5,919 unkeyed strings across the set) stays a recorded number, never a demand.
- **CI-wired** (browser job where playwright lives; classification corrected like university-smoke before it) + `estate-source` added static-side, honestly repaired to 11/11 (the dead build-surfaces drift check replaced by hub idempotence vs HEAD via the atlas generator, restore-on-drift).
- **BEFORE** (`e2e/lang-coverage-BEFORE-2026-08-28.txt`): 79 surfaces · **6,425 visible · 405 keyed (6%)** · all 26 tongues 100% of the 306 used keys — the corpus was whole; the gap was keying.

## P2 — keying the redesign (79 new keys)

Hub via the generator (wordmark, crumbs, badge, kicker, lede, hero cap, count words, org lines ×3, family glosses ×8, state words ×3, footer links, openseat/honoured); wallet (crumbs/badge/kicker + the receipt ladder: five stage names, five lines word-for-word, both terminal badges, done); buzz (crumb/badge/kicker/hero/copy/probe-btn/door + the room law split into five leaf spans so no bold child is flattened by lang.js's textContent swap); design-system (heads ×8, kicker, lede, captions, footer, the comet law split the same way). One key one English; the wallet and buzz crumb names now read "beehive nature reserve" like the hub. Two hub glosses were synced to the generator's typographic apostrophes (makers'/kernel').

## P3 — ×26

All 79 keys filled in all 26 tongues — 2,054 cells authored with the blind re-read at birth. Corrections logged: 2 classes caught (the comet-law English had to be re-split when the b-tag flattening rule surfaced; the two typographic-apostrophe glosses). Every tongue verified **100% non-empty** for the set's 389 used keys, empty cells 0.

## P4 — receipts

| surface | BEFORE keyed% | AFTER keyed% |
|---|---|---|
| hub (index.html) | 0% | **27%** (69 keys) |
| buzz-studio | 0% | **31%** (15 keys) |
| design-system | 0% | **21%** (24 keys) |
| wallet | 0% | **9%** (20 keys) |
| whole arrival set | 6% | **8%** (532/6,451) |

All 26 tongues 100% of used keys, before and after. **The founder picture:** the hub rendered whole under Russian — live at skaists.dev, Cyrillic lede/kicker/glosses/count-words verified in-DOM (`hub-RU-LIVE-390*.png`); local full-page shot in `e2e/shots-wiring/hub-RU-local-390-full.png`.

## FOUNDER CANON — the register toggle becomes obvious

`register.js` v5 (rider-bumped, tour.js v33 via bump-rider across 88 files, orbit freeze verified intact):
- **Three NAMED pills** — icon + word: 🐝 new bee · 🎛 raver · ⚗ cypherpunk — labels corpus-keyed (`reg.bee/raver/cypherpunk`), so the canon names speak every tongue (live proof: `🐝новая пчела|🎛рейвер|⚗шифрпанк`).
- **44px touch targets**, pill shape, active state = filled pill + gold ring + weight + leading dot + aria-pressed — never colour alone.
- **First-visit introduction** — one quiet line under the bar carrying the three founder definitions verbatim (`reg.intro`, corpus-keyed ×26), dismissed on the first choice, never seen again.
- **Persistence unchanged** — localStorage `bregister`, cross-tab sync, estate-wide travel. Standing law held: registers relocate prose, never erase it.
- Proven in-DOM: labels, 44px height, data-reg swap on click, intro removal, storage.

## Gates (all on the committed tree)

design-acceptance **12/12 ×4** · matrix **11/11** · adapter **28/28** · arweave **22/22** · CRDT two-tab **A=5 B=5** · coverage selftest + floors **PASS** · estate-source **11/11** · CI green read to conclusion on lane and main; Pages deployed.

## The lesson the lane paid for (recorded for every seat)

The drift check's restore-on-drift law ate the keyed hub TWICE: it restores HEAD over a drifted tree before the seat can commit, so the push carried zero keys and CI's two new gates caught it within one run — the ratchet and the idempotence check doing exactly their jobs. Fix was sequencing (rebuild → commit immediately), never silencing. Also: the generator template now carries the tour rider version, so regeneration can never clobber a bump again.

## Fences

Arrival surfaces only (the 5,919 unkeyed strings across the set remain the recorded backlog; floors hold, never demand). Proven engines unreflowed (CRDT, composer, arweave — batteries re-run green). No CI files beyond the two ordered language steps. Report to the tree: this file.
