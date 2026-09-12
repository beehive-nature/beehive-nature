# z1.a — education-i18n translation recovery (PR #43's cells onto current main) — 2026-09-12

Seat: z1.a (zCode GLM 5.3), Medium, per Astra's #10 docket 2026-09-12
("Translation recovery and art release handoff"). Branch
`zcode/edu-i18n-recovery-2026-09-12` off current main `0aede743`.
Original #43 (`cursor/edu-i18n-corpus-f081`, base `e1a8d3c6`, head
`ab9be3d4`) stays OPEN until this lands; nothing rewritten, no merge.

## Independent classification — reproduced z1.c exactly

Three-way classification of every (key,lang) cell #43 introduced or
changed, computed from the three trees directly:
**7,047 missing · 6 equal · 23 superseded** — matching z1.c's #10 return
and family table cell-for-cell (uni 1,827 · bld 1,682 · pl 928 · bf 899 ·
bnm 696 · d 551 · bst 464; superseded all uni, main-side #55 work).
243 of #43's keys are absent on main entirely.

## What this candidate does

**Corpus — only the 7,047 missing cells restored.** The 23 superseded
cells keep main's newer values; the 6 equal needed nothing. 243 absent
keys re-seated beside their own families (uni/bld/pl/d/bst/bnm/bf) from
#43's head. Post-recovery re-classification: **missing 0, superseded 23,
equal 7,053**; corpus 1,051 → 1,294 keys. Provenance line added to
`_meta.drafted`; every restored cell remains ⚙ machine-drafted per the
carried historic dispatch — **no human-translation claim**; meaning
review stays in #7.

**Page bindings — ported only where the page never moved.** Four of #43's
six pages are byte-stable on main since the #43 base (only a shared
loader version bump): `blanguage.html`, `bnames.html`, `bset.html`,
`plur.html`. #43's versions are taken for exactly these four, loader
line reconciled to main's current pin. Proven bindings-only: after
stripping tags, the visible text of each ported page is **identical** to
main's — the diff is `data-i18n` attributes, the span-wrapping #43 used
to bind text behind emoji prefixes, and legacy `data-key`→`data-i18n`
conversions. No UI reverted; no wholesale old-page copies.

**bfood.html and university/index.html stay on main's remodels.** Main
carries the #55 three-temperature reading rooms with their own complete
key families (`bfood.*`, `uni.bee.*`/`uni.lesson.*`…); #43's old-structure
bindings (`bf.h1`…, `uni.q.wt`…) attach to elements that no longer exist.
Porting them would revert current UI — forbidden — so the old keys'
restored cells are dormant corpus data, exactly like the pre-existing
dormant `d.*` family. The 23 superseded uni cells are where main's #55
build evolved those keys; they keep main's values.

**Floors — raised only where proven by live measurement.** The eleven
affected pages measured in a real browser through the estate's own
counter (`e2e/i18n-coverage.mjs`, visible-string keyed counts, all 28
tongues 100% filled on every measured page). Floors advanced via the
built-in raise-only ratchet: blanguage 12→68, plur 0→54, bnames 0→20,
bset 1→14, gallery 3→16, studio-music 0→28, doors/bnature-social 20→34,
forge/room 0→20, bfood 12→13 (its remodel measures 13 visible — #43's 34
counted the old page and is NOT proven on main). university stays 11,
index.html stays 69 (measured 153 < #43's 470 — #43's hub keying is not
this candidate's scope).

**docs/LANG-COVERAGE.md regenerated** from the post-recovery full-fleet
measurement (not #43's stale page counts). Historic dispatch
`2026-09-11-edu-i18n-corpus.md` carried verbatim. register.test and
tools/build-surfaces untouched (main's loader pin stands).

## Verification

- Independent classification + post-recovery zero-missing proof (above)
- `e2e/i18n-coverage.mjs --floors` on the eleven affected pages: PASS
  (pre- and post-advance), 100% fill across all 28 tongues
- Full front-door node line + page suites: see PR checks
- Fleet-wide `--floors --emit-md`: every recorded floor held

## Not done here

No merge, no key removal, no bfood/university UI change, no loader/lang
version churn (corpus delivery rides the same mechanism every prior
corpus merge used), no human-translation claim, no meaning review (#7).
