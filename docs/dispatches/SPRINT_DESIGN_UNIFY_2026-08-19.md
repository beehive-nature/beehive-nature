# SPRINT — the unifying design system: ecosystem (macro) × environment (plugin)

**From:** Seat 3 (Claude Code) · **2026-08-19** · founder-directed
**Seats:** founder (King Bee, rulings) · **Claude Design** (design seat, fresh session — instructions in §4) · Seat 3 (implementation, verification, receipts)
**Status:** OPEN — sprint brief + the laws that bind + the fresh-session onboarding.

Founder: *"create a sprint with me and autonomous claude design for a unifying ecosystem
(macro) and environmental (plugin) respect to layout.....colors should never operate
singular......remember."*

---

## 0 · The law the founder is invoking, made precise

**"Colors should never operate singular"** is already house law in two forms, and the
sprint binds both:

1. **The pair-check rule** (docs/design/non-value-states.md, Fable's merged rule; proven in
   the WELLness verify loop): a color is never judged alone — every foreground is evaluated
   **composited against its actual background**, because a color's meaning and its
   legibility exist only as a pair. The verify loop's contrast probe is the enforcement.
2. **The computed-palette rule** (applied live on the Royal Review deck, 2026-08-19): any
   set of colors that must be told apart (chart series, verdict states) is a **validated
   set**, never hand-picked singles — lightness band, chroma floor, CVD adjacent-pair
   separation, normal-vision floor, and contrast-vs-surface, all computed by the six-checks
   validator, never eyeballed. Receipt from today's deck: verdict set
   `#3f9c55 / #a476ec / #c07f1c / #0092a6` on surface `#0d1410` — ALL CHECKS PASS, with
   green and orange deliberately non-adjacent (the protan trap).

Every artboard this sprint produces inherits both. A swatch on a design canvas is a
**pair** (fg⊗bg) or a **validated set** — never a lone chip.

## 1 · The two altitudes

| altitude | scope | what it owns |
|---|---|---|
| **MACRO — the ecosystem** | one token sheet for the whole organism | surfaces (light+dark), ink scale, the accent family (gold/cyan/violet/leaf/amber as UI accents), the **dataviz steps** (validated, per-surface), type scale (IBM Plex Mono lineage), the 720px column, card grammar, nav (the tour), spacing scale, non-value-states vocabulary (Absent/NotMeasured/NotComputable renderings) |
| **PLUGIN — the environments** | each wing/plugin derives its environment from the macro ramps | LIGHT (gold-led — founder-emotional, its identity is ruled), TRADE (leaf-led), VISIT (violet-led), KEYS, READ, MAKE, HARVEST — each gets a **derived pair-set**, not new singles; a plugin never invents a hue, it selects steps from the macro ramps and validates them against ITS surfaces |

Constitutionally this mirrors Article VII: interpretation plugins project the kernel
through a worldview; environment palettes project the ecosystem tokens through a wing's
identity. The macro sheet is the kernel of the design system; environments are its
plugins. **A plugin palette that can't be derived from the macro ramps is the design-system
version of worldview vocabulary reaching the reputation engine — refused by construction.**

## 2 · Sprint shape (one phase per session, per house cadence)

| phase | deliverable | seat | done when |
|---|---|---|---|
| **D1** | the MACRO token sheet — one artboard: surfaces, ink, accents, dataviz steps, type, spacing, card + nav grammar, non-value-state renderings; every color a pair or a validated set | Claude Design | Seat 3 runs the validator + contrast probe against every pair/set on the sheet; graded receipt lands in the mailbox |
| **D2** | the hub re-layout to the sheet + ONE wing as the worked example (recommend TRADE — market/farmers/coop already share bones) | Claude Design | founder eyeballs on the A16 + laptop; Seat 3 implements + AA verify loop |
| **D3** | the Royal Guard dashboard components: stat tile, coverage bar, receipt card, guard-verdict badge — as reusable specs (today's deck is the v1 to critique, live at surfaces/review.html#demo) — **plus the bFood Hexagon** (hex grid, one cell per nutrient, linear fill % of minimum required intake stacked by food source; never a radial pie — angles distort magnitude; NotMeasured ≠ 0; UL/LD50 in reserved status colors; spec in DISPATCH_BLAI_MACRO_SCHEMA §2a) | Claude Design | components re-implemented from the spec; validator receipts |
| **D4** | the PLUGIN derivation rule — the written procedure a future wing follows to derive its environment (steps, validation, the pair law) | Claude Design + founder ruling | lands in docs/design/ as the canonical procedure; VOCABULARY-style one home |

Seat 3's standing verification per phase: contrast-probe + six-checks validator + the
level-invariance control, receipts in the mailbox. Founder rules at each phase gate; scope
fence per house law — Claude Design proposes, the founder picks, Seat 3 implements and
never silently redesigns.

## 3 · Project or single design? **PROJECT.**

Recommendation, with the reasons on the table:

- A claude.ai **Design project** carries **standing instructions** (project CLAUDE.md +
  DESIGN-CONSTRAINTS.md) that bind every artboard made inside it — the exact pattern
  already proven by the "Inverted governance, component specs" project, whose constraints
  files bound the DAO-dashboard work. A single design canvas carries no standing law; a
  four-phase sprint without standing law will drift by phase 2.
- The sprint produces **many artboards over weeks** (token sheet, hub, wing, components,
  procedure) — a project keeps them in one gallery with one memory.
- DesignSync gives Seat 3 read/write against project artboards (proven 2026-07-21:
  chip-wash fix synced back durably), so the design→implementation→receipt loop closes
  without copy-paste.

**Name it `BNR Design System`.** (A project by a similar name existed empty on 2026-07-21 —
reuse it if it still exists; a fresh one is equally fine. What matters is the two seed
files in §4 step 3.)

## 4 · Beginner instructions — a totally fresh Claude Design session, step by step

1. **On the laptop**, open **claude.ai** → left sidebar → **Projects** → **New project** →
   name it exactly `BNR Design System` (casing exact — casings are the payload).
2. In the project's **instructions** box (Projects carry a "What is this project about?" /
   custom-instructions field), paste the **seed brief** from §5 below. That is the
   project's standing law — every design session inside the project reads it first.
3. Start a **new chat inside the project** and ask it to create the first design:
   *"Create a design canvas for D1 of the sprint in the project instructions — the MACRO
   token sheet."* When it offers the canvas/design tool, accept; you refine visually and
   **Save** publishes versions.
4. **Never paste secrets, keys, or recovery material into the design session** — it needs
   none of them; everything it needs is in the seed brief and the live URLs.
5. When a phase's artboard is saved, tell Seat 3 (this session): *"D1 is saved in BNR
   Design System"* — Seat 3 pulls it via DesignSync, runs the validators, and lands the
   graded receipt in the mailbox. One word from you gates each phase.
6. If the design session proposes something that collides with a ruled law (a lone color
   chip, a normalized casing, a new hue outside the ramps), the seed brief instructs it to
   flag rather than resolve — same escalation discipline as every other seat.

## 5 · The seed brief — paste this as the project's instructions, verbatim

```
You are the design seat for BNR / beehive-nature — a public AGPL-3.0 ecosystem
of static, no-build web surfaces (dark, IBM Plex Mono, 720px column) live at
https://beehive-nature.github.io/beehive-nature/surfaces/ . Walk that hub and
surfaces/review.html#demo before designing anything.

THE SPRINT: a unifying design system at two altitudes.
MACRO (ecosystem): one token sheet — surfaces (light+dark), ink scale, accent
family (gold #FFD700, cyan #00E5FF, violet #c9a0ff, leaf #7ddf8f, amber #ffb347
as UI accents), validated dataviz steps, type scale, spacing, card + nav grammar,
and non-value-state renderings (a surface must be able to say "absent",
"not measured", "it doesn't know you" honestly).
PLUGIN (environment): each wing (LIGHT, TRADE, VISIT, KEYS, READ, MAKE, HARVEST)
derives its environment from the macro ramps — selected steps, never new hues.

LAWS THAT BIND EVERY ARTBOARD:
1. COLORS NEVER OPERATE SINGULAR. Every swatch is presented as a composited
   pair (foreground on its actual background) or as a validated set. Chart/status
   sets must pass: lightness band, chroma floor, CVD adjacent-pair separation
   (>=8 OKLab x100, 6-8 only with secondary encoding), normal-vision floor >=15,
   contrast >=3:1 vs surface. The implementation seat runs the validator on
   everything you ship — design for it.
2. Identity is never color-alone: legends, glyphs, or labels always accompany.
3. Casings are the payload — transcribe exactly, never normalize (bLighTnetWorK,
   bLiGhTbeAM, bzDiD, bQueenBee, LOVErnment).
4. The LIGHT wing's identity is founder-emotional and ruled — restyle around it,
   never redesign it away.
5. One axis per chart, no dual axes; sequential = one hue light->dark;
   diverging = two hues + neutral gray midpoint; never rainbow.
6. Accessibility floor is WCAG AA on every composited pair, both themes.
7. When a design decision collides with any law above, FLAG it in the artboard
   notes and stop - the founder rules; you never resolve a collision silently.

DELIVERY: one artboard per sprint phase (D1 token sheet -> D2 hub + TRADE wing
-> D3 dashboard components -> D4 the plugin-derivation procedure). Name
artboards D1-tokens, D2-hub, D3-dashboard, D4-procedure. The implementation
seat (Claude Code, "Seat 3") reads your artboards via DesignSync, implements,
and returns graded receipts; the founder gates each phase.
```

## 6 · What Seat 3 already staged for D3

The Royal Review deck's tally (live: `surfaces/review.html#demo`) is the v1 the D3
components critique: four stat tiles, verdict-stacked coverage bars (validated set, 2px
surface gaps, direct labels, glyph secondary encoding, hover layer, table twin,
"not yet walked" gap list). It was built by the six-checks procedure and carries its
validator receipt in the page source — D3's job is to make it *beautiful* without making
it less true.

**Seat 3, 2026-08-19.**
