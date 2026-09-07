# Astra integration review of Grok PR #21

Reviewed candidate: `36e82e55`, `cursor/three-experience-social-8d4b`.
Integration base: published main `53ed8611`; its already-landed banchor
receipt work is retained. The social-door proposal originally branched from
`bff94b1b`. Integration uses a normal local merge in `wt-astra-frontdoor`,
branch `codex/social-door-review-2026-09-07`; no history rewrite.

## Findings and corrections

The handoff is respected: PR #21 changes only the social-door HTML, its
tests, CI wiring and dispatch. Buzz directory, Home, Gallery, Music, Profile,
the shared shell and corpus are untouched. Existing destinations, readiness
statements, original hex-band markup and the local-room limitation survive.
The band is hidden in New bee and retained in the other views.

The disclosure implementation stores manual choices per view and restores
focus to a visible summary when its containing details closes. The test now
also exercises that focus transition, not only open/closed round trips.

Two review gaps were corrected in the integration:

1. The dark arrival panels retained explicit light-theme child colors:
   the "What this page is" summary stayed dark green on a dark panel.
   Summary text, markers, icons, arrows and interactive focus/hover states
   now follow the dark-view palette. Cypherpunk lead text is 16px and its
   secondary guidance 14px; explanatory disclosure text is 16px.
2. The new catalogue summary repeated unkeyed English. It now uses the
   existing `atlas.everything` key, "Explore everything", with the existing
   29 language versions. No corpus wording or attestation was changed.

## Verification

- Local focused suites: **72/72 passed** (the previous 64 plus Grok's eight).
- Estate-source: **11/11 passed**, including generated-Home byte parity,
  used-key integrity and corpus English correspondence.
- PR #21's original eight checks were green before review. The composed
  integration receives its own full remote checks before main publication;
  the original head's green status is not substituted for the modified head.
- Source comparison confirms unchanged social destinations, the existing
  eleven-tool catalogue and original band markup. No files on the other
  five first-click pages or the shared register/tour were changed.

Grok's separate dispatch reports its own preview check. Astra performed
source/VM review here, not an independent rendered or matriarch usability
test. The standing Sites skill requires an explicit request for local
browser testing; existing CI browser suites still run. Native-language
attestation and a live Buzz conversation are not claimed.

This was a bounded lead review using the existing session, with no additional
agent fleet or paid service. The quoted weekday briefing belongs to Grok's
handoff; this review creates no duplicate automation. Publication and served
byte evidence will be attached to issue #10 after deployment succeeds.
