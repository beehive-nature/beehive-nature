# Non-value states — the shared vocabulary (one home for both surfaces)

**Status:** DRAFT, for Fable (Seat 1) to co-own. This is the single home for the
**non-value / honest-absence state vocabulary** that both surface families draw
from — `skaists.social` (the DAO dashboard) and **BN:WELLness** — plus the typed
states in the kernel crates they render. It exists because the vocabulary was
being defined per-surface, and **two copies drift.** A state's meaning, its
visual contract, and the type it maps to are decided *here*; a surface
implements this, it does not re-invent it.

Derived by an audited sweep of the shipped surfaces + crates and then an
adversarial review pass against each source (2026-07-21): `surfaces/dao-dashboard`,
the BN:WELLness surface set (8 files), and the data-model crates (`dashboard`,
`price-feed`, `coa`, `onboarding`, `denomination`), reconciled against
`docs/DESIGN-CONSTRAINTS.md`.

> **The one-line thesis:** *show what is true; show what is missing and why;
> never let a boundary look like a violation; never let colour — or a single
> word — carry the meaning alone.*

### How to read the "Maps to" column — and why it matters

Each state is one of two kinds, and the column says which:

- **in-tree** — a real Rust type/variant exists today (named exactly, e.g.
  `coa::Absence::NotRequested`). An implementer imports it.
- **(proposed)** — a surface renders this state but **no kernel type carries it
  yet**. The name is a *proposal*, deliberately namespaced (`CompositionProvenance`,
  `EvidenceGrade`, …) so it does **not** collide with the real, unrelated
  `shared_types::Provenance` (an evidence-source-weight class) or
  `price_feed::Grade` (Conventional/Organic). The list of `(proposed)` rows is
  itself the backlog of states that still need a type.

Likewise Part 4's render map marks ✓ only where a surface **actually draws** the
state — not merely where a type for it exists.

---

## Part 1 — the invariants every non-value state obeys

From `docs/DESIGN-CONSTRAINTS.md`; every state below is an instance of these.
Remove all colour and the surface must still read.

1. **Render the state, never a number, never `0` (§2).** A gauge that cannot
   vouch for its figure — stale, unfetched, failed — draws the *state*. An empty
   gauge reading `0` is worse than no gauge.
2. **An absence carries its reason (Law 1d, §2).** `Absent` without a reason is
   indistinguishable from a zero. Every absence names its cause and, where it
   applies, its *landing condition* ("appears when …").
3. **A violation and a boundary must never look alike (§2).** `AtCap` (a
   legitimate edge) and `Breach` (an invariant failure) get visibly different
   treatments. This generalises: `<LOQ` ≠ `0`, a stale gauge ≠ a number, **a
   measured zero ≠ an unmeasured field** (see the value states — this pair is
   the one most easily collapsed, and the one the WELLness `none`/`not measured`
   defect in Part 5 collapses in practice).
4. **Two states that differ *in kind* must differ in more than one channel
   (§3, generalised — founder ruling 2026-07-21).** Colour is never the sole
   channel — every colour-encoded distinction also carries a label, a value, or
   a pattern — **and a single *word* is never the sole channel either.** Word-as-
   sole-channel fails for exactly the reason colour-as-sole-channel fails.
   `none` (a measurement that *found* absence) and `not measured` (no
   measurement) are different in kind — the Axis A distinction at the atom
   level — so they must differ in pattern or shape *as well as* text, exactly as
   `AtCap` and `Breach` do. **The test:** remove all colour *and* squint past
   the words; the two states must still be distinguishable.
5. **Semantic colours may not be repainted to fix contrast (§4) — and there is
   no AA pass without a composited pair check.** Step within the ramp or invert
   to a chip; never change the hue. **Contrast is a pair check, not a judgment
   call:** an AA claim requires measuring the *actual* foreground against the
   *actual composited* background — gradients and alpha overlays included — per
   surface. **A token being "in the ramp" is not a pass** — that assumption has
   concealed two real failures this project (Part 5 #3).
6. **Claims arrive graded, or as `Ungraded · No source attached` (§6).**
   Composition (what a thing *is*) and effect (what it *does*) never share a
   visual layer.
7. **Show the ceiling before someone hits it (§7).** A gated action discloses
   the user's standing *before* refusal is possible — enforced in code by a
   witness only the render path can mint.
8. **Integrity tone: the common case sets the default (§6).** A provenance or
   composition state renders in the neutral `measurement` tone by default. The
   alarm `flag` tone is reserved for *severe* facts — a retraction, a live
   expression of concern — and **never for provenance**. Provenance is the
   common case, so a routine determination-count or source badge never wears an
   alarm colour.

---

## Part 2 — the catalog

Each state: what it asserts (**and what it is NOT**), the visual contract, the
mandatory non-colour cue, and the type it maps to (in-tree or proposed).

### A · Value / gauge states

| State | Asserts / is NOT | Visual contract | Non-colour cue | Maps to |
|---|---|---|---|---|
| **Measured** | a real value from a named, tested source; carries the time it was true | the figure + its `as_of` stamp; the value token is permitted here | the number + a label + a timestamp | in-tree: `Panel::Measured(T)` · `PriceReading::Measured` · `Measurement::Measured(T)` |
| **Stale** | a real gauge whose last *value* is too old to vouch for; **NOT** a spinner, **NOT** `0`, **NOT** broken — the value figure is withheld | hatched box, **dashed** border, `◷ STALE` chip, prose title/body, meta "last verified 47 min ago" | `◷` glyph + word "STALE" + hatch pattern + dashed border + **the absence of a gauge-value numeral** (timestamps like "47 min" still show — only the value is withheld) | in-tree: `denomination::BGauge::stale()`; `function_reading = None` |
| **NotMeasured — hatched tag** | nobody measured it; shown as itself — **NOT** zero, **NOT** estimated, **NOT** rounded | `.tag.nm`: a mono pill with a 45° diagonal repeating-hatch fill in sand, muted text, thin border | the words "not measured" + the **diagonal-hatch fill** (no dash glyph on this form) | in-tree: `Measurement::NotMeasured { basis }` · `PriceReading::NotMeasured { reason }` |
| **NotMeasured — provenance chip** | same assertion, legend/explainer form | `.chip.none`: a pill with a **dashed border** and a horizontal-dash/minus glyph, dim text | the words "not measured" + **dash glyph + dashed border** (no hatch fill on this form) | in-tree: same as above |
| **Measured zero (`0 g`)** | the analyte was looked for and is truly absent (plants carry no EPA/DHA); **NOT** "not measured" | a **plain** mono numeral `0 g` — **no tag, no hatch, no chip** | its *plainness*: a bare numeral with no absence treatment reads as "measured, and it is zero" | in-tree: `Measurement::Measured(0)` |
| **`<LOQ` / BelowLoq** | assayed, below the limit of quantitation; **NOT** `0`, **NOT** "none detected"; the **LOQ travels with it** | the `<LOQ` result with its floor stated inline | the floor value inline + "<LOQ" text | in-tree: `Absence::BelowLoq { loq }` |
| **NotRequested** | the assay was never ordered — *silent*, not *negative* (B12-on-beef); **NOT** absence of the substance | absence tag carrying the reason | "not requested" text; no numeral | in-tree: `Absence::NotRequested` |
| **MethodUnavailable** | the lab could not run the method — wanted, not produced | absence tag carrying the reason | reason text | in-tree: `Absence::MethodUnavailable` |
| **NotComputable (`? depends on you`)** | a per-individual value the surface refuses to fabricate ("it doesn't know you"; filling it is "selling, not teaching") | a scale tile whose number slot is a literal `?`, unit "depends on you", beside filled sibling tiles | the `?` glyph + "depends on you", parallel to filled tiles | **(proposed)** `CompositionValue::NotComputable { needs_individual }` — *no coa variant exists; `Measurement` has exactly `Measured`/`NotMeasured`* |

> **Contract that binds A:** a *measured* absence is a plain `0`, never the
> not-measured hatch. WELLness currently violates this for the fatty-acid
> sub-fractions (`none` wears the hatch) — see Part 5 #1.

### B · Panel states

| State | Asserts / is NOT | Visual contract | Non-colour cue | Maps to |
|---|---|---|---|---|
| **Absent — reason-forward** | a panel deliberately not drawn, reason foregrounded; **NOT** an error, empty, loading, or zero | transparent card, **1.5px dashed** border, dimmed title, `ABSENT · ON PURPOSE` chip, prominent reason, info-coloured landing line | dashed border + chip + dimmed heading + foregrounded reason + explicit "lands when" | in-tree: `Panel::Absent { reason }` (reason-forward) |
| **Absent — quiet-ledger** | same decision, logged quietly; **NOT** a blank card | **solid** card, non-dimmed title, same chip, a mono `— not drawn —` ledger line, quieter reason | the `— not drawn —` placeholder; solid-vs-dashed border distinguishes it from reason-forward — *not* colour | in-tree: `Panel::Absent { reason }` (quiet-ledger) |

### C · Boundary vs violation

| State | Asserts / is NOT | Visual contract | Non-colour cue | Maps to |
|---|---|---|---|---|
| **AT CAP** | emission exactly at the cap — a legitimate edge, zero headroom, "full is allowed"; **NOT** a breach | honey bar **to** the cap edge with a **3px double** end-border, "AT CAP" label, note "full is allowed — over is not" | the double-rule at the edge (pattern) + "AT CAP" + the boundary-vs-violation note; fill reaches the edge, never past | in-tree: `Headroom::AtCap ≙ Ok(0)` |
| **BREACH** | a floor-law invariant failure (emitted > cap by n) — unmissable until resolved; **NOT** a full gauge, **NOT** AtCap | banner + panel: the honey fill runs **to** the cap tick (85.7%); the overshoot **past** the tick is a separate **hazard-hatch stripe** (not honey fill); `+140 PAST CAP` label, quantified overshoot, heavier 2px border, "BREACH" badge | the diagonal **hazard-hatch** overshoot + bold "BREACH" + the quantified `+140` overshoot numerals + heavier border — several channels, so it can never read as AtCap. (The honey fill itself is *not* drawn past the tick; the hatch is what crosses it.) | in-tree: `Headroom::Breach(n)` |
| **Implausible ("exceeds the whole food")** | a structurally impossible value (beef K `252 g/100 g`) shown **exactly as published** — **NOT** corrected, **NOT** silently rewritten; refuses to guess which field slipped | `.flag` pill, warning-triangle glyph, the raw value left intact beside it | warning-triangle glyph + "exceeds the whole food" + the uncorrected value | **(proposed)** `PlausibilityFlag` — *surface flag; no in-tree type* |

### D · HUD refusals (`denomination::Hud`) — all in-tree

The HUD renders both gauges or it **mints a refusal** — a one-gauge HUD does not
construct. A refusal renders *nothing wrong*, and is **never the reader's fault**.

| State | Asserts | Rendered by the DAO surface? | Maps to |
|---|---|---|---|
| **RateOutsideDrawFacility** | no b↔fiat ratio lives here; the only room that quotes a rate is the draw facility (D-14) — **NOT** a rate of `0` | **Yes** — the third HUD slot is a dashed rate-refusal card with prose + a "Draw facility →" link | in-tree: `HudRefusal::RateOutsideDrawFacility` |
| **UnshowableBGauge** | a b-gauge that cannot be shown at all → the HUD refuses | **No** — named in the technical legend only; awaiting Fable's design (Part 5 #2) | in-tree: `HudRefusal::UnshowableBGauge` |
| **MissingRequiredGauge { which }** | a required gauge is missing → the whole HUD refuses to construct | **No** — legend only; awaiting Fable's design | in-tree: `HudRefusal::MissingRequiredGauge { which }` |
| **REFUSED (umbrella)** | the family: render nothing rather than something wrong | legend chip, **solid** grey border (distinct from ABSENT's dashed) | in-tree: `denomination::HudRefusal` |

### E · Governance / status (DAO)

| State | Asserts / is NOT | Non-colour cue | Maps to |
|---|---|---|---|
| **Vote tally absent — "not yet in vote"** | a FILED proposal has no vote tally yet, shown as itself — **NOT** a false `0 / 24` with an empty bar (a direct instance of invariant 1) | italic/dim "not yet in vote" text + **no progress bar** (the sibling in-vote rows have one) | **(proposed)** `CommissioningStatus::Filed` (pre-vote) — *surface state; no in-tree governance type yet* |

### F · Provenance & disagreement (WELLness composition) — all (proposed)

*None of these has an in-tree type; all are namespaced proposals. Do not import
`shared_types::Provenance` for these — that is a different, evidence-weight enum.*

| State | Asserts / is NOT | Non-colour cue | Maps to (proposed) |
|---|---|---|---|
| **Determination count (`1` / `2 independent`)** | how many labs measured it — a **count, NOT verification**; two agreeing is still not proof, so **no success colour** | one- vs two-circle glyph + numeral + "determination(s)" | `CompositionProvenance::Determinations(n)` |
| **Spread** | the observed range between disagreeing labs (iron `0.28–7.95 mg`) — an **observation, NOT a grade or resolved value**; the *only* count-adjacent element allowed a hue (observed, not judged) | range-bracket glyph + "spread" + explicit low–high | `CompositionProvenance::Spread { low, high }` |
| **Source badge (origin + basis)** | per-value provenance: **both** origin *and* basis, so a reader can tell whether two numbers are comparable | document glyph + source id + basis in dimmer weight | `CompositionProvenance::Source { origin, basis }` |
| **Basis-separation ("two bases, kept apart")** | two numbers describe **different foods** → never compared, never averaged | per-value "basis:" labels + "two bases, kept apart" badge | `Comparison::NotComparable { different_basis }` |
| **Unresolved disagreement** | two labs, same basis, genuinely different answers — "**left that way**", **NOT averaged** | both raw numbers + the spread; no reconciled figure | `Comparison::Unresolved` |
| **Composition residual ("other / unresolved")** | the unassigned remainder of a *measured* total — distinct from "not measured" | legend word "other/unresolved" beside the swatch | `Composition::Residual` |

### G · Evidence grading & claims (WELLness) — all (proposed)

*Do not import `price_feed::Grade` for these — that is Conventional/Organic.*

| State | Asserts / is NOT | Non-colour cue | Maps to (proposed) |
|---|---|---|---|
| **GRADE — High / Moderate / Low / Very Low** | the evidence grade of a contribution — **NOT** a health outcome; the ramp **desaturates toward grey** as it weakens (no alarm-red) | legend dot + the grade word + aria-label prose | `EvidenceGrade::{High,Moderate,Low,VeryLow}` |
| **Ungraded · No source attached** | a claim wearing exactly what it has — nothing; shown plainly, never hidden and never equal to a graded claim | the literal phrase | `EvidenceGrade::Ungraded` (§6) |
| **Composition-only / outcome-claims-graded-separately** | the wall: composition stated as fact; any thesis held in separately-graded material, "translated, not asserted" | recurring "composition only" / "graded separately" / "no health claim" | `ClaimLayer::{CompositionFact, OutcomeClaim(graded)}` |
| **Fact / Hypothesis / Unsupported** | claim-status taxonomy (verifiable / needs-evidence / over-reaching) | the register words + a ✓ glyph on the correct one | `ClaimStatus::{Fact,Hypothesis,Unsupported}` |
| **Proved / Still-argued** | a settled-vs-contested binary for lessons — **NOT** the 4-tier GRADE | mono-uppercase "PROVED" / "STILL ARGUED" + coloured left-border | `EvidenceRegister::{Proved,Contested}` |
| **(established) / (established, nuanced)** | lightweight per-statement settled-fact marker | the parenthetical word in dimmed text | `EvidenceRegister::Established` |
| **Population-goal, not individual target** | a sourced claim scoped away from the reader ("Population-level, not a statement about you") | italic scope qualifier + named source (WHO/FAO TRS 916) | `Claim::PopulationGoal` (scope ≠ Individual) |
| **Attribution-debated** | an unverified attribution *marked*, not laundered into fact (even the course motto) | mono caption "attribution debated … deserves a source-check" | `CompositionProvenance::AttributionDisputed` |

### H · Gate / consent refusals (onboarding) — all in-tree

| State | Asserts | Maps to |
|---|---|---|
| **BelowSettlement** | the action needs Settlement grade the user lacks — carries *what raises it*, so the ceiling is legible | in-tree: `GateRefusal::BelowSettlement { current, raises_it }` |
| **StaleDisclosure** | the grade witness attests a stale grade → re-disclose first | in-tree: `GateRefusal::StaleDisclosure { shown, current }` |
| **CustodyUndisclosed** | a PDS-custodial persona bound with consent disclosing correlation but **not custody** → refused (§8, RELAY_22 §5a) | in-tree: `persona::BindingError::CustodyUndisclosed` |
| **NoRecoveryPath / NoWrittenCodeFloor** | enrolment cannot finish leaving a person unable to recover; the written-code floor is mandatory | in-tree: `EnrolError::{NoRecoveryPath,NoWrittenCodeFloor}` |
| **AgeAssurance — NotAsserted** | the honest-absence default: no age assertion made, and **no field to hold one**; **NOT** a hidden birthdate | in-tree: `age::AgeAssurance::NotAsserted` |
| **AgeAssurance — SelfDeclared** | a self-declared age, shown as a **weak** claim that never satisfies a regulated gate on its own | in-tree: `age::AgeAssurance::SelfDeclared { at }` |
| **Disclose-before-gate witness** | the structural form of §7: a gate consumes a `GradeDisclosure` that only the render path can mint, so a surface *cannot* gate without having shown the grade — it fails to compile, not at runtime | in-tree: `onboarding::GradeDisclosure` / `disclose_grade` |

### I · Surface-honesty stamps (WELLness, whole-surface) — all (proposed)

| State | Asserts | Non-colour cue |
|---|---|---|
| **CONCEPT — simulated · zero network** | the whole page is non-live/simulated; values are demonstrative, not a live reading | dashed pill + the literal text on every file |
| **One operator / not unobserved** | the trust limit, on every footer: "served by one operator who can log every reader and withdraw this page at will. Not censorship-resistant, not unobserved." | explicit sentences naming the limitation |
| **Participation, not health outcomes ("statistics, never a soul")** | every hive number is de-identified aggregate participation data; the composition/claim wall at the *data-type* level | crossed-out-eye glyph + the lead sentence |
| **Withheld by design (no goal weight / deficit / target)** | a deliberately-absent metric, reframed toward completeness with an ED helpline — withheld, not empty | explicit enumeration + the safe-box framing |
| **Records THAT-proved, never WHAT-eaten** | intentional non-recording of PII/diet; "counted, never named" | the antithesis phrasing "that, never what" |
| **Interpreter ceiling ("it will not")** | bLOVErAi's hard refusal set (won't diagnose, prescribe, set a target, or see who you are) | "it will not" heading + explicit refusals, beside an "it will" column |
| **Outside the usual range (soft flag)** | an observational range flag that is explicitly **not a diagnosis** — teaches rather than concludes | "outside the usual range" + "teach you to read it" |

---

## Part 3 — how the states relate (so a renderer picks the right one)

- **A value is one of:** `Measured(v)` · `Measured(0)` (a real zero, rendered
  plain) · `<LOQ` (assayed, below floor) · `NotMeasured`/`NotRequested`/
  `MethodUnavailable` (not produced, rendered as the absence) · `NotComputable`
  (needs the individual). Five *different* claims; **`Measured(0)` and
  `NotMeasured` must never share a visual treatment.**
- **A panel is** `Measured(T)` **or** `Absent { reason }`. Never a spinner.
- **A ceiling is** `AtCap` (legitimate) **or** `Breach(n)` (violation) — the two
  arms that must never look alike.
- **A composition disagreement is** carried (`Spread`, `Unresolved`,
  `NotComparable`), never averaged away.
- **An effect claim is** graded or `Ungraded · No source attached`, and never
  shares a layer with the composition beside it.

---

## Part 4 — state → type → **actual renders**

✓ = the surface draws it. "type-only" = a type exists but that surface does not
render this state. "—" = not applicable.

| State | Type (in-tree unless noted) | DAO dashboard | WELLness (8 files) |
|---|---|---|---|
| Measured | `Panel::Measured` / `Measurement::Measured` | ✓ | ✓ |
| Stale | `denomination::BGauge::stale()` | ✓ (b-gauge) | — |
| NotMeasured (both forms) | `PriceReading::NotMeasured` · `Measurement::NotMeasured` | — (type-only; the price panel always renders a Measured price) | ✓ |
| Measured zero (`0 g`) | `Measurement::Measured(0)` | — | ✓ (EPA/DHA; see Part 5 #1) |
| `<LOQ` / NotRequested / MethodUnavailable | `Absence::*` | — | type-only (not rendered in the 8-file set) |
| NotComputable (`? depends on you`) | (proposed) | — | ✓ |
| Absent (reason-forward / quiet-ledger) | `Panel::Absent { reason }` | ✓ (Circles, Spirit) | type-only (not rendered in the 8-file set) |
| AtCap / Breach | `Headroom::{AtCap,Breach}` | ✓ | Breach-family flag ("exceeds the whole food", proposed) |
| HUD refusals | `HudRefusal::*` | rate-refusal ✓; the other two legend-only | — |
| Vote tally absent | (proposed) | ✓ ("not yet in vote") | — |
| Provenance / disagreement | (proposed) `CompositionProvenance::*` · `Comparison::*` | — | ✓ |
| Evidence grades / claim wall | (proposed) `EvidenceGrade::*` · `ClaimStatus::*` · … | — | ✓ |
| Gate / consent refusals | `GateRefusal` · `BindingError` · `EnrolError` | (onboarding surface) | onboarding |
| Age assurance | `age::AgeAssurance::{NotAsserted,SelfDeclared}` | (onboarding surface) | onboarding |
| Surface-honesty stamps | (proposed) | — | ✓ (all 8) |

---

## Part 5 — findings for Fable (surfaced by the sweep + review)

1. **A measured absence must not wear the not-measured hatch — FIXED
   2026-07-21.** In `d12_fat_scan_result.html`, SCFA/MCFA `none` — a *measured*
   genuine-absence — was rendered with the same `.tag.nm` diagonal-hatch pill as
   the genuinely *unmeasured* GLA `not measured`, differing **only by the word**
   — a violation of invariant 4 (word-as-sole-channel) that collapsed
   `Measured(0)` and `NotMeasured`. **Resolved** in `beehive-WELLness` (commit
   `37a952f`): SCFA/MCFA now render as plain `0 g`, identical to the sibling
   measured-zeros EPA/DHA, so the hatch is reserved strictly for unmeasured
   values and the two states differ in pattern *and* word. (A second glyph was
   considered and rejected — the state belongs in the value family, not the
   absence family.)
2. **The DAO `UnshowableBGauge` and `MissingRequiredGauge` panels are legend-only**
   — named in the technical legend, no card drawn. A docket reported Fable
   shipped their design, but it is **not in any accessible design project** (see
   `surfaces/dao-dashboard/README.md`). Held, not invented, pending the design's
   location.
3. **Contrast is a pair check — the rule, and an evidence anchor that needs
   confirming.** As a *method*, invariant 5 stands on its own: measure the
   composited pair; "in the ramp" is never a pass. Fable logged two supporting
   measurements on a **diagonal-fill refusal panel** — `#68726A` (`--ink-dim`) at
   **4.30:1** (header on the `#EBEFE9` void stripe) and **3.77:1** (slot label on
   `rgba(87,101,95,.10)` over `#EBEFE9`), both below AA while "in the ink ramp",
   remedied by stepping to `#57655F` (`--ink-mut`) → **5.26 / 4.61:1**,
   §4-compliant. **⚠ Anchor unconfirmed:** that refusal panel is **not present in
   the reachable durable design artifact** — a 2026-07-21 re-fetch of
   `DAO Dashboard.dc.html` found no such panel (481 lines = the original; the
   three-panel specimen band absent). The colour-pair *ratios* are arithmetic
   facts and the remedy is sound token advice, but the panel they were measured on
   is not yet reachable — pending Fable locating where it lives (see the routing
   design-delivery gate). **Independently anchored and verified:** the
   *implementation's* breach panel — a dark-card variant (`--dk-mut` on `#0C1412`)
   — was pair-checked in the shipped surface and passes (tightest `+140 PAST CAP`
   at 6.97:1). That one is real; the `#68726A` one awaits its artifact.
4. **Most WELLness states have no kernel type yet** (all `(proposed)` rows), and
   two proposed names would collide with real, unrelated types if taken
   literally: `shared_types::Provenance` (an evidence-source-weight enum) and
   `price_feed::Grade` (Conventional/Organic). The proposals here are namespaced
   (`CompositionProvenance`, `EvidenceGrade`) precisely to avoid that — when
   these states earn a type, keep the distinct names.

---

## Adding a state (so this doesn't become a sixth scattered definition)

Same discipline as `docs/VOCABULARY.md`. A new non-value state is added **here
first**, with: its assertion (and what it is *not*), its visual contract, its
mandatory non-colour cue, and whether it maps to a real in-tree type or is
`(proposed)`. Only then does a surface render it. A state defined in a surface
but not here is drift waiting to happen — send it back.
