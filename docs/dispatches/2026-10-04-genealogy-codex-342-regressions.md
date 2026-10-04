# Genealogy — PR #342 Codex regressions, current-main retest — 2026-10-04

Retest base: `4bda0ccf275e84787e34007b5d63f8013430e9ba`, the current `main` tip when this repair branch was cut. The originally supplied `bfd955f39c1d6ffd34f8af79f869297d86b10a5d` was one commit behind by then; the intervening genealogy receipt did not touch these renderer, panel, or browser-test paths.

All three post-merge Codex findings still reproduced on that base:

1. Spatial mode was default while the Austras front-door climb still focused the flat-only `.tol-node[data-person]`, and the blood browser regression still waited on flat-only selectors.
2. The 3D renderer omitted living person buttons but still drew living points and could strand navigation behind a living-only initial window.
3. A direct grandparent self relationship still emitted a “parent-to-child line from X to X” disclosure with an empty body.

Founder ruling during the repair: **the UI starts at the first deceased blood relative in each branch; living relatives stay out of the UI.** The model already publishes `line.entries` as the nearest deceased ancestor on every living parent path, so the navigator now uses those entries as the cold roots. Living continuity stubs remain structural privacy data only: rejected as focus targets, omitted from 3D and flat UI, and traversed only to find the next deceased blood relative. The generic held-generation count remains as the privacy explanation.

Focused regressions cover deceased-entry rooting, living-focus rejection, spatial keyboard focus after a front-door climb, spatial-default browser selectors, absence of living person controls, the flat fallback, and the direct-grandparent self case.

No genealogy facts, corpus records, family relationships, or unrelated surfaces are changed. Final executable gate results belong to the PR head and are reported after GitHub CI finishes.
