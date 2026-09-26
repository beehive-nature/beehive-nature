# Newcomer observation — guide and empty scorecard

**Purpose:** watch whether a willing newcomer can make a bracelet and complete a handoff without being taught the clicks. Methods follow the spirit of the [GDS moderated usability-testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) and the [completion-rate principle](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate). This is an engineering observation sheet, not a statistical guarantee and not a gate for ordinary fixes.

**Sample:** about five willing newcomers is a cheap working choice. It is not a required approval number.

**Neutral goal (read this, then stop talking):**

> “Please make a little color and give it to someone. Use this page. I will not hint unless you ask to stop.”

Do not name Peace, Love, Unity, Respect, KND1, arms, or Keep unless the person asks what a word on the page means. Do not point at buttons. If you coach, mark the task assisted and do not count it as an independent completion.

## Identifiers

Use **anonymous attempt IDs** (`A1`…`A5`) — not names. If two people attempt a real handoff, give them a **pair ID** (`P1`) and two attempt IDs. A second agent window is not a pair.

Allowed cell values when a measure does not apply:

- **Not observed** — the session ended before that moment, or no second person was present.
- **Not applicable** — the person never entered that step (including a decline before starting a handoff).

## Two different clocks

Do **not** share one “completed handoff” label for solo and paired attempts.

1. **Time to first bracelet** — from the goal being read until a piece is visibly on an arm, without help. Denominator: attempts that reached the composer.
2. **Time to local handoff completion** — from the goal being read until the giver finished the local give (line copied or selectable; piece retired on their arm). Solo attempts stop here. This is **not** a receiver Keep.
3. **Time to receiver Keep** — a second clock, only when a pair is present. Starts when the receiver can look at the piece; ends when they preview and choose Keep on their own device. Leave **Not observed** if no second person was there. Leave **Not applicable** if the giver never offered a string.

**Do not write either completion time for a decline.** A decline is its own outcome.

## Decline and the attempted-handoff denominator

| When they stop | How to write it | Attempted-handoff denominator |
|---|---|---|
| They never begin the give (say no before starting) | Decline before starting | **Exclude** this attempt |
| They start the give, then stop on purpose | Decline after starting | **Keep** this attempt in the denominator; no completion time |
| Receiver refuses Keep after a string was offered | Receiver decline (pair notes) | Local handoff may still count; Keep time = Not applicable |

Only declines **before starting** are excluded from the attempted-handoff denominator.

## Before a session

- Record the exact URL, git SHA or Pages head, view (New bee / Raver / Cypherpunk), browser, viewport, and whether reduced motion is on.
- Confirm the person is willing and may stop at any time.
- Use a throwaway word. Do not collect private dedications, legal names, or payload strings into the repo.

## What else to watch

- **Point of confusion** — first pause, mis-click, or question, in the person’s words.
- **Decline vs technical failure vs Keep** — three different columns. Keep is a receiver action, counted only when observed.
- **Recovery** — did they get back to a useful next step without you?

## Distinctions (write them separately)

| Observed | Count as |
|---|---|
| Person finishes make without hints | Unassisted make (that attempt) |
| Giver finishes the local give without hints | Unassisted local handoff |
| Person asks “what should I press?” and you answer | Assisted — not independent |
| Person stops before starting the give | Decline before starting — exclude from attempted-handoff denominator |
| Person starts the give, then stops | Decline after starting — stays in that denominator; no completion time |
| Page, clipboard, or storage stops them | Technical failure |
| Receiver Keep on their own device | Observed receiver Keep (pair denominator; own clock) |
| No second person / no Keep offered | Receiver Keep = Not observed |
| You clicked Keep in a fixture | Not a human observation |

## Empty scorecard

About five willing people. One row per **attempt ID**. No private payloads. Agent fixtures are not rows.

**Tested version:** URL _________________ · SHA / Pages head _________________ · view ________ · date ________  
**Observer:** _________________ · **Coaching rule:** no hints unless they ask to stop.

| Attempt ID | Pair ID (or Not applicable) | Willing? | Device / browser | Time to first bracelet (s or Not observed) | Time to local handoff completion (s, Not applicable if declined, or Not observed) | Time to receiver Keep (s, Not observed if no pair, Not applicable if no string offered or declined) | Decline before starting (Y/N) | Decline after starting (Y/N) | Unassisted make (Y/N/Not observed) | Unassisted local handoff (Y/N/Not applicable) | Assisted (Y/N) | Technical failure (what or none) | Recovery (Y/N/Not applicable) | Receiver Keep (Y/N/Not observed) | First confusion (their words) | Notes (no strings) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| A2 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| A3 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| A4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| A5 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

**Tally — use separate denominators (fill after real sessions)**

| Measure | Count | Denominator (write it) |
|---|---|---|
| Willing people who started | ___ / ___ | people invited who said yes |
| First bracelet unassisted | ___ / ___ | attempts that opened the composer |
| Local handoff completed unassisted | ___ / ___ | attempts that **started** a give (exclude only declines before starting) |
| Declines before starting | ___ / ___ | willing people who reached a give choice |
| Declines after starting | ___ / ___ | attempts that started a give |
| Technical failures | ___ / ___ | attempts that reached the failing step |
| Observed receiver Keeps | ___ / ___ | pairs that actually offered a string |
| Assisted attempts | ___ / ___ | all started attempts |

Do not put a decline into either completion-time column. Do not use Keep count as the local-handoff rate. Do not treat a solo local handoff as a receiver Keep.

**Known attempts so far:** none. This sheet shipped empty on 2026-09-07.

## After

- Store only aggregate volunteered notes. No `KND1|…` strings, no hidden tracking, no names you would not print on a poster.
- Agent walkthroughs of the campaign board stay labeled as agent fixtures.

## What this guide does not do

It does not recruit people. It does not claim the matriarch has accepted the page. It does not replace the gift-engine’s source tests.

Split copies of the earlier shorter sheets remain at `observation-guide.md` and `observation-scorecard.md`.
