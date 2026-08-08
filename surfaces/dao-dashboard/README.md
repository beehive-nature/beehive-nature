# surfaces/dao-dashboard — skaists.social DAO dashboard (web surface v1)

⟨Implementation of **DAO Dashboard.dc.html** — claude.ai/design project
`ac80c130-c58d-4f9f-a3b0-d600ab189acf` ("Inverted governance, component
specs"). Spec companions in-tree: `docs/DESIGN-BRIEF-01-dashboard.md`,
`docs/DESIGN-CONSTRAINTS.md`, the audited token layer (docs/TOKENS.md).⟩

Self-contained static page — no build, no framework, no network calls beyond
the IBM Plex webfonts (system fallbacks engage offline). Open `index.html`
from disk or any static file server. Interim home per the design-docs
precedent (`e254fa0`); migrates to the skaists.social web codebase when that
scaffold lands (RELAY_21 artifact ①).

## States

| Axis | Values | Where set |
|---|---|---|
| scenario | `measured` · `mixed` (default) · `breach` | `?scenario=` URL param |
| absence style | `reason-forward` (default) · `quiet-ledger` | `?absence=` URL param |
| reading level | Plain · Standard (default) · Technical | header toggle |
| money | USD (default) · MXN | header toggle |

Scenario/absence are data conditions (in production they come from
`crates/dashboard`, not a param); reading level and currency are the user
preferences the design gives the masthead. The design-canvas prop default was
`breach` (review posture); this page defaults to `mixed` — the brief's
"day-one truth" (stale b-gauge, circle + spirit `Panel::Absent`), matching
RELAY_20 §1's ship-now scope.

## Constraint compliance (DESIGN-CONSTRAINTS.md)

- **D-14 two gauges** — b + money always render together in the HUD; the
  third slot is the rate *refusal* card. No b↔fiat ratio anywhere on this
  surface.
- **§2 non-value states** — `mixed` renders the b-gauge as ◷ STALE: hatched
  withholding, no number, no `0`, no function reading.
- **§3 colour never sole channel** — every state carries a label/glyph/pattern
  (●◐○ pipeline glyphs, ▲▼ deltas, hatch on stale/overshoot, double-rule on
  AT CAP).
- **§4 token discipline** — `:root` carries the audited tokens verbatim;
  honey `--b-value` renders only on the dark chip.
- **§5 reading level** — prose only. Every level-varying string renders
  through `cp()` → tagged `data-copy`; page text minus `[data-copy]` is
  asserted identical across levels (negative control below).
- **AtCap ≠ Breach** — breach renders overshoot hatch + banner + quantified
  `+140`, beside an AT CAP comparison gauge; the two cannot be confused.
- **§9 commons** — read-only, no auth, no cookies, no storage.
- **RTL readiness** — logical properties throughout (no left/right); full RTL
  pass deferred per the brief.

## Verify

- Rendered-contrast authority: run the WELLness `verify/contrast-probe.js`
  in the browser console per state (positive controls must bite first).
- §5 negative control: for each scenario × currency, flip levels via
  `window.__dao.set({level})`, strip `[data-copy]` nodes, assert remaining
  text identical.
- `window.__dao` is the read-only test seam driving both probes.

## Known deviations from the .dc.html (disclosed)

1. Default scenario `mixed` instead of the canvas prop default `breach`
   (brief §Deliverable names mixed the real deliverable).
2. One `@media (max-width:880px)` single-column collapse — the .dc.html
   composes desktop only; the PWA delivery target (RELAY_21 §1) needs the
   commons readable on a phone. No other layout changes.
3. `<noscript>` notice added (the page renders with JS; the commons promise
   should fail loudly, not blankly).
4. Status-chip wash alphas stepped down (COMMISSIONED `.13→.08`, IN VOTE
   `.10→.07`): the original .dc.html washes composited
   `--biomass-ink`/`--info` to 4.34:1 / 4.43:1 on white — under AA.
   Probe-verified at 4.57 / 4.60 after the step. Token hues untouched (§4).
   **Synced back to the design source via DesignSync 2026-07-21** (staged
   upload sha256 `76f896f5…97db95`) — design and implementation now agree.
5. Breach overshoot segment drawn at `1%` — founder ruling 2026-07-21: the
   overshoot shares the fill's scale (140 / 14,000 = 1.0%; cap sits at
   12,000 / 14,000 = 85.7%). The hazard stripe and the `+140 PAST CAP` label
   carry the alarm. **Synced to the design source via DesignSync 2026-07-21**
   (was `1.4%`; staged upload sha256 `e2797300…9676f`, remote re-fetched and
   confirmed) — design and implementation now agree at 1%, so this is no
   longer a deviation.

## Scope holds (ruled 2026-07-21)

`HudRefusal` panels (`UnshowableBGauge`, `MissingRequiredGauge`,
`RateOutsideDrawFacility` beyond the existing rate-refusal card) and the
**MoneyGauge stale variant** are deliberately **not implemented** here.
Their designs go to Fable (Seat 1) first — implement from that design when
it lands; do not invent them on this surface.

### Status of the three panels (2026-07-21) — BLOCKED, design not located

A docket reported Fable shipped the three (MoneyGauge stale · UnshowableBGauge
· MissingRequiredGauge). They are **not present in any accessible design
project**: `DAO Dashboard.dc.html` (read in full) has neither a money-stale
variant nor any HudRefusal rendering; `BIGEN Library.dc.html` is a different
surface (meta-analysis library, grepped — none present); the "Design System"
project is empty. **Not implemented — implementing from an absent design would
be inventing the visual language, which the standing scope rule forbids.**
Awaiting the design's actual location (or a re-ship) before building.

### Diagonal-fill panel — composited pair-check result (the breach headroom panel)

Ran `verify/contrast-probe.js` (the composited authority, not the token-level
guard) against the breach state's diagonal-fill panel. Positive controls bite;
**all seven text pairs pass on their real composited backgrounds** — tightest
is `+140 PAST CAP` at **6.97:1** (need 4.5), and the `--dk-guard` (#B7A8F7)
hazard-stripe hue composites to **8.86:1** on the dark card (#0C1412). So
"AA-clean" here is a **pair check**, not a token-ramp claim. Fable should
confirm against their design's exact tokens if theirs differ from the audited
set.
