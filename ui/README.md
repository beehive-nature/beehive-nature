# ui/ — T-1 static scenario viewer

⟨Design · against fixtures @ 520f154⟩

One-page viewer for the audited demo fixtures. Three views: escrow lifecycle
(scenario 1, both guard refusals rendered as first-class moments), dispute
branch (scenario 2, cases 2a/2b side by side), reputation (scenario 3,
including the ghost DID's honest zero).

## Run

```bash
cd ui
npm install
npm run dev        # Vite dev server, opens on http://localhost:5173
```

Production check: `npm run build && npm run preview`.

## Data discipline

- The **sole data source** is `../fixtures/demo-fixtures.json`, imported as a
  static JSON module (`src/fixture.js`). No chain calls, no network, no
  backend.
- Every rendered datum is a property access on that import. The source
  contains **no fixture numeric or hash literals** — grep it.
- The dispute reconciliation strips are **computed at render**:
  `sum(settlement.payouts[].amount)` compared against the escrowed amount
  (`scenario_1_happy_path.steps[0].event.payload.data.amount`), and in 2b
  each `split_ratio[i]` compared against `payouts[i].amount` (Q-D5 invariant
  as named by the founder).
- Full 64-hex hashes live in state; truncation is display-only — every hash
  chip expands to the full value on click.
- §9.3 field names appear verbatim in code and on screen.

## Palette law (founder-ruled)

Neutral chrome; magenta = primary/active; blue = informational; green =
success/verified (ALLOWED in purple-family apps); violet = guard refusals —
deliberately not error-red; teal = AI/bLoveRai semantics (reserved; no
AI-attributed datum exists in this fixture, so it does not appear).

Code is AGPL-3.0-only. This tree is authored by the Design seat; Code lands
it after founder eyes.
