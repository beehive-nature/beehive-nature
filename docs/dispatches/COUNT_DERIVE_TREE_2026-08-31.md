# COUNT DERIVE TREE — dispatch 2026-08-31 (@fac846f)

Founder's two items, both closed. CI green on main (static ✓ node ✓ test ✓).

## 1. THE Ī RECEIPT — the file was already right; the chat was wrong

Founder ruled the spec records base.org rejecting **į**; the real receipt was **ī**.
Byte-level audit of `docs/specs/SPEC-A-NAMES-1.md` line 83: the file carries
`0xC4 0xAB` = U+012B = **ī WITH MACRON** in both the letter and the
mīlestībairkaralis test — correct at every byte. A repo-wide byte search for
**į** (U+012F, `0xC4 0xAF`) found ZERO hits. **The typo lived in the previous
session's chat handoff, never in the tree.**

Hardening landed anyway (transcription can drift again):
- receipt line now quotes the raw error — `disallowed character: "ī" {12B}` —
  plus the byte-exact `0xC4 0xAB`, and states the law: **ī WITH MACRON, never
  į ogonek** (near-identical in some fonts)
- fixed a second latent slip on the same line (`milestībairkaralis` had lost
  its first macron)
- memory carries the transcription law so the next seat reads it before typing

## 2. THE COUNT — derived from the tree, three consumers, one rule

The three numbers disagreed: door said **94**, deck listed **84**, disk held
**85** — while the door's own caption promises *katrs skaitlis izrēķināts no
reģistra*. Findings:

- **The registry was innocent.** All 94 rows have real files, zero duplicates,
  and the 85 `counted!==false` rows mirror the tree FILE-FOR-FILE (both
  directions empty). Reconcile-once turned out to be already done.
- **The liar was the stored counts block.** estate.json's `counts.surfaces`
  said 94 — rows grew (profile.html joined skaists) and the block never heard.
  The atlas printed that stale block. estate-check FAILS on it locally (the
  CI red everyone kept chasing).
- **The deck** was missing exactly one surface: `profile.html` (the dynasty
  page — distinct from `blight/profile.html` which was always listed).

The never-again architecture (@fac846f):

- **`scripts/surface-count.mjs`** — THE ONE COUNTING RULE. The tree walker
  (fleet/ + fleet-hosted/gallery|lab excluded, reasons carried in the file)
  plus `recomputeCounts()` (the registry block algorithm).
- **build-atlas** now: walks the tree, cross-checks the registry's counted
  rows against it BOTH WAYS (mismatch → exit 1 with the named files), then
  **rewrites the counts block from the recompute** — a registry edit can
  never leave a stale number on the door. Written in the registry's own
  1-space-indent format so the diff is the drift and nothing else.
- **estate-check** imports the same walker + recompute; adds the hard check
  `counted rows === tree count`.
- **university-smoke** imports the same walker (its local copy deleted) —
  footer count, deck coverage, and reachability all assert against ONE list.
- **review.html** gains `profile.html` → deck 85.

One rule in one place; the door's number, the deck, and the registry's own
gate are one check reported three times.

## Collision note

While this lane worked, another seat landed the same reconcile (7606388 +
merge 6ce3a70 — block recomputed, hub regenerated, deck fixed). Rebased on
top; single conflict (both added profile.html to the deck) resolved to one
entry. The structural derive-at-build machinery is the delta this commit adds.

## Verification receipts

- `node scripts/build-atlas.mjs` → `counts block re-derived from tree+rows — surfaces: 85 (was 94)`
- `node scripts/estate-check.mjs` → `PASS — 85 counted · 94 listed · 26 domains`
- `node e2e/university-smoke.mjs` → **74 passed, 0 failed** (footer count
  matches the tree (85) · review deck covers every surface (85) · 85
  reachable within 2 hops)
- `node e2e/no-page-errors.mjs` → 94 walked · 0 page errors
- `node e2e/i18n-coverage.mjs` → exit 0
- CI run 33455396022 → ✓ static ✓ node ✓ test
