# 2026-10-13 — ROUTING: the eternal footer-audit red on receipts.html is inherited from main → Agent 30 (drop desk)

Routed from the BNROSE-RUST-001 seat (PR #411 qualification round),
per the review ruling's instruction: an inherited eternal red is
routed, never modified from the Rust seat.

## The receipt

- PR #411's qualification tests run 38462402817 (frozen head
  2da65244d, whose tree = main@e5945069d + this lane's files — the
  lane touches neither `receipts.html` nor any footer-audit
  baseline): job `eternal` FAILED in the step
  `node footer-audit.mjs --baseline footer-audit.baseline.json`:

      336 page×register views · 112 surfaces · 9 views with findings
      on 3 surfaces · WIDE 3 · SMALL 21 · FAINT 12 · JUNK 61

  The JUNK findings are em-dash-only cells in `receipts.html`
  across bee/raver/cypherpunk registers (61 total findings across
  3 surfaces; receipts.html dominates).

- **Main is red with the same signature on its own runs** — this is
  not introduced by PR #411: run 38458210105 (main@e5945069d, the
  exact main inside the PR's merge) `eternal: failure`; also
  38456942850 (bad522051), 38420194057, 38375603874 — every recent
  main tests run. Main's other jobs at e5945069d are green
  (static/meter/formal/test/formal-cryptol-leg/wallet/node).

## What is NOT this red

- It is NOT the bDroP reconcile-timing defect (#413) and NOT the
  45s→75s widening symptom — the bDroP lifecycle suite itself
  printed GREEN in the same job ("BDROP LIFECYCLE GREEN … nothing
  touched hive"). The failing step is the footer-audit ratchet
  against `receipts.html`, the drop desk's surface (the #417 heal
  already had to catch the surface directory up to the drop desk's
  v=9 — the desk's lane is the one moving this surface).

## Owning seat

Agent 30 / the drop-desk (bDroP–keychain continuity) lane owns
`receipts.html` and its footer-audit baseline. Cure is theirs:
either the em-dash cells become real content or the baseline is
ratcheted per the CI-sampled-baseline law (floors from CI's own
printed lines, never a local run — ratchet-baseline-from-ci law,
PR #276 precedent). This Rust seat modifies neither.

## Consequence for PR #411

Every tree that contains current main inherits this eternal red;
it cannot be cured from #411. The PR's own defects (demo shell,
inventory rider, and the two un-guarded welded steps convicted by
lint-ci-shape this round) are cured in-seat. Merge proceeds on the
estate bar with this red routed and named here; main's heal lands
through Agent 30.
