# Newcomer observation guide — kandi gift loop

Canonical combined sheet: [`newcomer-observation-scorecard.md`](newcomer-observation-scorecard.md).

**Purpose:** watch whether a willing newcomer can make a bracelet and complete a handoff without being taught the clicks. Methods follow the spirit of the [GDS moderated usability-testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) and the [completion-rate principle](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate). This is an engineering observation sheet, not a statistical guarantee and not a gate for ordinary fixes.

**Sample:** about five willing newcomers is a cheap working choice. It is not a required approval number.

**Neutral goal (read this, then stop talking):**

> “Please make a little color and give it to someone. Use this page. I will not hint unless you ask to stop.”

Do not name Peace, Love, Unity, Respect, KND1, arms, or Keep unless the person asks what a word on the page means. Do not point at buttons. If you coach, mark the task assisted and do not count it as an independent completion.

## Identifiers

Use **anonymous attempt IDs** (`A1`…`A5`) — not names. If two people attempt a real handoff, give them a **pair ID** (`P1`) and two attempt IDs. A second agent window is not a pair.

Allowed cell values when a measure does not apply:

- **Not observed** — the session ended before that moment, or no second person was present.
- **Not applicable** — the person never entered that step (including a decline before giving).

## Before a session

- Record the exact URL, git SHA or Pages head, view (New bee / Raver / Cypherpunk), browser, viewport, and whether reduced motion is on.
- Confirm the person is willing and may stop at any time.
- Use a throwaway word. Do not collect private dedications, legal names, or payload strings into the repo.

## What to watch

1. **Time to first bracelet** — from the goal being read until a piece is visibly on an arm, without help. Denominator: attempts that reached the composer.
2. **Time to completed handoff** — only if the giver actually completed a local handoff **and** (when a pair is present) the receiver previewed and chose Keep. **Do not write a completion time for a decline.** A decline is its own outcome. Test a “30 seconds” hope; do not advertise it beforehand.
3. **Point of confusion** — first pause, mis-click, or question, in the person’s words.
4. **Decline vs technical failure vs Keep** — three different columns. “I don’t want to give this” is a decline. A clipboard block or storage error is a technical failure. Keep is a receiver action, counted only when observed.
5. **Recovery** — did they get back to a useful next step without you?

## Distinctions (write them separately)

| Observed | Count as |
|---|---|
| Person finishes make + handoff without hints | Unassisted completion (that attempt) |
| Person asks “what should I press?” and you answer | Assisted — not independent |
| Person stops on purpose before giving | Decline — **not** a completion time |
| Page, clipboard, or storage stops them | Technical failure |
| Receiver Keep on their own device | Observed receiver Keep (pair denominator) |
| No second person / no Keep offered | Receiver Keep = Not observed |
| You clicked Keep in a fixture | Not a human observation |

## After

- Fill one **attempt-ID** row on `observation-scorecard.md` (or the combined sheet). Use separate denominators. Do not put a decline into “time to completed handoff.”
- Store only aggregate volunteered notes. No `KND1|…` strings, no hidden tracking, no names you would not print on a poster.
- Agent walkthroughs of this board stay labeled as agent fixtures.

## What this guide does not do

It does not recruit people. It does not claim the matriarch has accepted the page. It does not replace the gift-engine’s source tests.
