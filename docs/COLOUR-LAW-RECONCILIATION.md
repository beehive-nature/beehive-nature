# COLOUR LAW RECONCILIATION — Drift Surface (founder word needed)

Status: PROVISIONAL RULING + FOUNDER FLAG. Do not pick silently.

## The canonical palette

Authoritative source: `docs/tokens.css` (transcribed from DESIGN-BRIEF-01 +
founder canonical list, 2026-08-12). Credited to Claude Design (bnr-design v0.1).

Two axes:
- **Axis A (UI semantics):** --info #6FA9E0, --verified (biomass), --guard #B7A8F7, --b-value #E8B54B
- **Axis B (entity identity):** --ai #45C2DC, --biomass #86CC72, --sovereign #9C6FD6, --you #D655BB, --sovereign-soft #B79FE0

Chrome dark-first: --bg #06110C, --bg-card #0C1412, --ink #E9F2EC, --line #1E2B26.

## Two hard laws

**D-1:** Colour NEVER carries meaning alone. Every colour-encoded distinction also
carries a LABEL + a VALUE (+ pattern where useful). Remove all colour and the surface
must still read.

**S4:** A semantic colour is NEVER repainted to fix contrast. Fix contrast by inverting
to a dark chip, never by changing the hue. (Worked example: --b-value #E8B54B honey
fails AA on light at 1.88:1. It survives on a dark chip #0C1412, never by repainting.)

## The drift (PROVISIONAL — surface for founder word)

BNRi_OS.md carries two hex values that DIFFER from tokens.css for the same intent:

| BNRi_OS.md | tokens.css | Intent | Status |
|------------|------------|--------|--------|
| Golden #FFD60A (bData) | --b-value #E8B54B (honey) | The colour of b / value | DRIFT |
| Companion #A24BFF (zbData) | --sovereign #9C6FD6 (human) | Human/sovereign identity | DRIFT |

Same intent, different hexes.

**Provisional ruling:** tokens.css is AUTHORITATIVE for anything RENDERED (the
dashboard, any UI surface). BNRi_OS.md's Golden/Companion pair must be reconciled
to tokens.css OR explicitly scoped to doc-level data-type labels only.

**FLAG FOR FOUNDER:** BNRi_OS.md was NOT FOUND in the repo as of 2026-08-12.
Cannot reconcile without the source file. The founder must either:
(a) commit BNRi_OS.md and confirm reconciliation to tokens.css, OR
(b) confirm the Golden/Companion pair is doc-only and tokens.css governs all rendered surfaces.

**Do NOT pick silently.** This drift affects every surface that renders b-value
or sovereign identity colours.

## tokens.css provenance

tokens.css was NOT in the repo before this commit. It was transcribed from
DESIGN-BRIEF-01-dashboard.md (which carries the same palette) + the founder's
canonical list (2026-08-12 dispatch). Credited to Claude Design per LAW 8c
(provenance survives the relay — named author is Claude Design, not goose).

## Notes

- Never normalize founder casing (COLLECTive SYNerGiStic bINTELligence, bAsi, LoVis waTer nakaMOTO).
- --info #6FA9E0 and --ai #45C2DC are SIMILAR but MUST be kept apart (different axes).
- --guard #B7A8F7 is NEVER error-red (error uses a separate surface, not a semantic colour).
