# Newcomer observation — guide and empty scorecard

**Purpose:** watch whether a willing newcomer can make a bracelet and complete a handoff without being taught the clicks. Methods follow the spirit of the [GDS moderated usability-testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) and the [completion-rate principle](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate). This is an engineering observation sheet, not a statistical guarantee and not a gate for ordinary fixes.

**Sample:** about five willing newcomers is a cheap working choice. It is not a required approval number.

**Neutral goal (read this, then stop talking):**

> “Please make a little color and give it to someone. Use this page. I will not hint unless you ask to stop.”

Do not name Peace, Love, Unity, Respect, KND1, arms, or Keep unless the person asks what a word on the page means. Do not point at buttons. If you coach, mark the task assisted and do not count it as an independent completion.

## Before a session

- Record the exact URL, git SHA or Pages head, view (New bee / Raver / Cypherpunk), browser, viewport, and whether reduced motion is on.
- Confirm the person is willing and may stop at any time.
- Use a throwaway word. Do not collect private dedications, legal names, or payload strings into the repo.
- Pair sessions need two devices or two browsers only if you are observing a real handoff. A second agent window is not a person.

## What to watch

1. **Time to first bracelet** — from the goal being read until a piece is visibly on an arm, without help.
2. **Time to completed handoff** — until the giver has a line they can pass *and* the receiver has previewed and chosen Keep, or until the giver clearly declines. Test a “30 seconds” hope; do not advertise it beforehand.
3. **Point of confusion** — first pause, mis-click, or question, in the person’s words.
4. **Decline vs technical failure** — a person who says “I don’t want to give this” is a decline. A clipboard block, a storage error, a broken string, or a page that retires the wrong piece is a technical failure.
5. **Recovery** — did they get back to a useful next step without you?

## Distinctions (write them separately)

| Observed | Count as |
|---|---|
| Person finishes the goal without hints | Unassisted completion |
| Person asks “what should I press?” and you answer | Assisted — not independent |
| Person stops on purpose | Decline |
| Page, clipboard, or storage stops them | Technical failure |
| Receiver Keep on their own device | Observed receiver Keep |
| You clicked Keep in a fixture | Not a human observation |

## Empty scorecard

About five willing people. One row per person. No private payloads. Agent fixtures are not rows.

**Tested version:** URL _________________ · SHA / Pages head _________________ · view ________ · date ________  
**Observer:** _________________ · **Coaching rule:** no hints unless they ask to stop.

| # | Willing? (Y/N) | Device / browser | Time to first bracelet (s) | Time to completed handoff (s) | Unassisted completion (Y/N) | Assisted (Y/N) | Decline (Y/N) | Technical failure (what) | Recovery (Y/N) | Receiver Keep observed (Y/N) | First confusion (their words) | Notes (no strings) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |

**Tally (fill after real sessions)**

- Attempted: ___
- Unassisted completions: ___
- Assisted: ___
- Declines: ___
- Technical failures: ___
- Observed receiver Keeps: ___

**Known attempts so far:** none. This sheet shipped empty on 2026-09-07.

## After

- Store only aggregate volunteered notes. No `KND1|…` strings, no hidden tracking, no names you would not print on a poster.
- Agent walkthroughs of the campaign board stay labeled as agent fixtures.

## What this guide does not do

It does not recruit people. It does not claim the matriarch has accepted the page. It does not replace the gift-code PR’s negative tests.

Split copies of the guide and the empty table remain at `observation-guide.md` and `observation-scorecard.md` for earlier board links.
