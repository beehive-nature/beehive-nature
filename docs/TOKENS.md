# AUDITED TOKEN LAYER — post-F-4, extracted from grant-v5 WELLness surfaces
<!-- Landed in-tree 2026-08-20 by Seat 3, verbatim from the design project's
     docs/TOKENS.md (project ac80c130, read via DesignSync), on the F7 ruling:
     the audited instrument palette joins macro as a fixed INSTRUMENT SET
     ("ruled and can't be re-derived" — design sprint D3, founder ratified
     "love it all approved" 2026-08-20). This landing also retires the
     "phantom citation" flag: the path the design seat cited now exists here. -->
Committed here for durability (161-element audit; do not fabricate alternatives).
The dashboard is a NEW surface: slot these as the starting palette, then re-run
contrast against its own composited backgrounds (verify/check-contrast.mjs) before trusting AA.

## Light surfaces (7 of 8)
| Token | Value | Role |
|---|---|---|
| --ink | #1A2320 | primary text |
| --ink-mut | #57655F | secondary text |
| --ink-dim | #68726A | muted text (per-surface: two surfaces sit at #64746D / #64746F) |
| --paper | #F6F8F1 | page |
| --card | #FFFFFF | card surface |
| --line | #E4EBDC | hairline |
| --biomass | #5FA544 | DATUM fill only — never text |
| --biomass-ink | #487D34 | AA-clean text derivative of biomass |
| --ai | #0B7A89 | accent text — darkened, hue kept |
| --info | #2A73AE | info text |
| --guard | #7D5FB0 | flags and badges |
| --b-value | #E8B54B | honey, unchanged — dark chip only |

## Dark surface (bqueenbee_analytics)
--ink #E9F2EC · --mut #8FA79C · --card #0C1412 · --line #1E2B26 · --biomass #86CC72 · --ai #45C2DC · --info #6FA9E0 · --guard #B7A8F7 (raised here) · --b-value #E8B54B

## Structural treatments (not decoration)
1. --biomass is a datum colour — fills, seals, chart marks. Text uses --biomass-ink.
2. Honey --b-value stays #E8B54B and clears AA only on a dark chip. A +b figure on paper reintroduces the 1.88:1 failure (17 instances found). Dark background, never repaint.
3. Semantic hues are theme-aware: --ai/--info/--guard have genuinely different light and dark values — not a filter or opacity shift.

Caveat: values were computed per-surface against each surface's own composited background. Copying a passing value onto a different background is not a guarantee.
