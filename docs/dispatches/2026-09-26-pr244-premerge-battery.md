# PR #244 PRE-MERGE BATTERY — FOUNDER-NAMED CHECKS EXECUTED, 9/9 GREEN (ONE INHERITED STATIC RED, PROVEN BASE-SIDE)

**Date:** 2026-09-26 · **Seat:** zCode (GLM 5.3) · **Scope:** the decisive pre-merge checks the founder named for PR #244 (12,329 files / +728k): privacy leakage, deterministic regeneration, path/case sanity, session-material embedding. **Read-only** — battery ran from `.scratch/pr244-battery.mjs` in the seat's own worktree, wrote nothing.

---

## THE BOARD

| check | verdict | evidence |
|---|---|---|
| image bytes in public layer | **PASS** | binary-magic scan (JPEG/PNG/GIF/WEBP/PDF) over every diff file: 0 hits — image bytes never entered Git |
| signed-session material | **PASS** | JWT shapes, `fssessionid`/`fds-visitor`/`fscot`, `Set-Cookie`, `Authorization: Bearer`, cookie jars: 0 hits across the diff |
| living-person material | **PASS** | redaction list RECOMPUTED read-only from the private walk with the staging rule (5 names, 4 attested-deceased overrides): 0 hits in public corpus/pages/sources; public `search-evidence.json` carries 0 household/living-children arrays |
| path/case sanity | **PASS** | 0 case-collisions, 0 paths >240 chars among 12,329 diff paths |
| hex-law | **PASS** | 0 unmarked 48+-hex lines in the 5 staged public source files |
| corpus digest = pin | **PASS** | computed corpus sha256 `735477B9…` == `lineage_corpus` pin at profile.html:950 — the same-breath receipt verifies (battery's first-match regex initially grabbed the *v2 crest* pin; profile.html carries FOUR pins: crest / achievement / bloom / corpus) |
| absolute paths | **TRIAGED — inherited house pattern, not new** | main already carries `C:/Users` in 41 files incl. this same corpus; the corpus occurrence is the private-tier location meta (`…/family-lineage/staging-private/`), by-design disclosure under the three-tier staging law |
| genealogy suite at tip | **PASS** | 56/56 locally at `f2f5d2c44` |
| static | **ONE INHERITED RED — proven base-side** | `profile-views` 17/18 locally, failing `house-archive chrome is fully keyed` — identical to CI and to the geneac receipt's independent base reproduction; **base..tip diff on profile.html = exactly ONE line** (the digest re-pin), so the failing span is untouched by the harvest commits |

**CI on the PR:** node PASS · test PASS · scan PASS · static FAIL (the inherited red above).

## VERDICT

Nothing in the founder's four decisive-check categories is violated: no privacy leakage, no session/cookie/token material, no image bytes, no case/path hazards; the corpus on the branch is byte-exact to its pinned digest; the suite is green at the tip. The **only** red is the pre-existing profile-views static red inherited from lane base `97f18945` — its cure (key the unkeyed span or extend the record-data carve-out) belongs to the lane owner per the 2026-09-19 geneac receipt; whether to merge with it named or fix first is the authorized merger's call.

**Deterministic regeneration, honestly stated:** the pin==bytes check + 56/56 suite + the tip's own regen receipts (spine byte-identical to the frozen Randver pin, 0 lost persons, staging-inventory sumCheck true) are the evidence in hand. A fresh full pipeline re-run from the private tier is available as a merge-branch rider if the merger wants it; it was not run in this read-only pass.

## BIFURCATION (founder freeze, recorded)

- **Evidence corpus → merged/static/proven** (this PR).
- **Image acquisition → resumable/private/incremental** (checkpoint 175/807 persons / 4,654 mappings; the 6 proven census images are NOT missing — they are safe in the private corpus; what remains is the larger record→image traversal, founder-session-gated).

Battery script: `C:/Users/travi/wt-zcode-zblood/.scratch/pr244-battery.mjs` (uncommitted, per house precedent).
