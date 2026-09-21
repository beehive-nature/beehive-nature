# bNames DAY · the sky lens — China, the wheel of sixty-four, and a team that works with its grain

**Seat:** Seat 3 (Claude Code, Desktop). **Date:** 2026-09-20. **Branch:** `claude/bnamesday-2026-09-20`.
Second beat of the same surface (`2026-09-20-bnamesday-two-houses.md`).

**Founder order, verbatim:** "full depth on final product… pushed to pages so i can formally beta test." ·
"lets expand the RAW spiritual channel AND RESTORE SACREDNESS and build from the genesis proofs/primitives. add in
Chinese Astrology." · "one application… getting humans and our five seperate energy types to WORK TOGETHER
BETTER. NEXT WEEK I WILL BE REARRANGING BUZZ AGENTS SO THERE ARE TEAMS OF 5/EACH ENERGY TYPE TO THEN COMPARE TO OUR
NOW BASELINE." · "MAKE SURE TO INCLUDE ENGLISH… WANT TO LEARN MORE ABOUT THE THAI WORDS AND CULTURE."

## What landed

A birthday is now read **four ways** — Latvia, Thailand, China, the wheel of sixty-four — and a new
**Working together** panel reads a whole team. In all three views, asserted by test.

| | |
|---|---|
| `surfaces/bnamesday-sky.js` | pure core II: time (ΔT, historical time zones via the platform tz database), planets, Moon, true node, Pluto; the 64-wheel; nine centres / thirty-six channels → type, how-they-decide, lines; the Chinese lunisolar calendar and four pillars; the three old branch relations. |
| `surfaces/bnamesday-sky.json` | `v:1` — VSOP87D truncated to 2,129 of 31,577 terms; truncation **measured** < 0.53″ per planet and written into `_meta`; source digests carried. |
| `scripts/build-bnamesday-sky.mjs` | the re-runnable receipt from the eight CDS VI/81 files. |
| `e2e/bnamesday-sky.test.mjs` + `e2e/bnamesday-sky-oracle.json` | 11 tests against witnesses that are not us. CI-wired. |

## Built from the primitives, and proven

- **The wheel of 64 is binary counting.** Shao Yong's Xiantian circle (11th c.): from 坤 it counts 0…31 up one
  side and 63…32 down the other. `wheelIsBinary()` checks it at load; if it were false the lens refuses to run.
  The only modern element is the *pin* (hexagram 41 opening at 2° Aquarius) — stated as the modern systems'
  convention. Opposite seats are complements: asserted.
- **Hexagram names are the Yì Jīng's**; the English glosses are this page's own plain readings of the
  characters, not a quotation of any translation. No proprietary keyword table is reproduced.
- **The Chinese calendar is computed, not looked up:** month 11 holds the winter solstice; the leap month is
  the first without a principal term; civil days at UTC+8. 16 of 16 known New Years match, 1985 and 2033 included.
  A January birth keeps the old year's animal — most year-number charts get that wrong; this does not.
- **The five types, nine centres and the 88° rule are the Human Design System's (Ra Uru Hu, 1987)** and are
  named as such, to say whose lens this is. The mechanics are rebuilt from the sky.

## Foreign oracles (the receipts)

| claim | witness | result |
|---|---|---|
| Sun, Moon, 8 planets, Pluto | JPL Horizons, 10 dates 1850–2060 | Sun 0.3″ · planets ≤ 2.4″ · Moon 4.2″ · Pluto 40″ |
| true lunar node | the real Moon's northward ecliptic crossings (Horizons) | ≤ 0.14° → trust set to 0.2° |
| Moon series | Meeus 47.a worked example | agrees to 0.1″ |
| type · lines · authority | charts published by others: Ra Uru Hu, Obama, Bullock, Winfrey, Jolie | 5 of 5 |
| four pillars | 2000-01-01 12:00 → 己卯 丙子 戊午 戊午; 立春 2024 at 16:27 CST | match |

**Trust decides the flags.** Each body's tolerance is its *measured* worst error, rounded up. A body nearer a
hexagram's edge than that is flagged on the page ("another calculator may place it on the other side") — never
silently placed. With no birth hour the lens reads every two hours of that day and says what holds all day.

## Constitution Article VII.1 — kept, on the page and in the code

An interpretation lens. It describes how to ask someone; it never scores, ranks, hires, or gates. No identifier,
reputation value or consensus input is derived from it, and nothing leaves the device: the people a reader adds
stay in their own `localStorage`. The page now makes **two** same-origin GETs (calendar, sky) and zero third-party.

## For the founder's team experiment (next week)

- Agents are entered as people with house **an agent** and "born" when they first ran (UTC). That assignment is
  a convention, not a fact about the agent — say so when reporting results.
- To make "teams of five by type vs. the baseline" mean something: fix the metrics **before** rearranging
  (throughput, rework rate, time-to-receipt), keep the task mix comparable, and run at least one *randomly*
  composed five as a control — otherwise any change measures the reshuffle, not the types.

## Open

- lv and th renderings of the page body (the hub tile alone speaks the 28 tongues); the Yì Jīng judgments in the
  original with a careful English hand; the 13-month robot name-day calendar (founder's side quest).
- Placement (`skaists.social`) remains this seat's judgment — one row edit moves it.

## Gates (un-piped)

estate-check PASS 97/106 · front-door unit line (incl. both bnamesday suites) · r5 ZERO · secret-scan 0 ·
lint-ci-shape 69/69 · no-page-errors · university-smoke · estate-source on the committed tree. Looked at, 390px and
desktop, all three views, with a seven-person team including an agent: no overflow, every phone control ≥ 44px.

**Receipt:** live pages at 390px — never the git state.
