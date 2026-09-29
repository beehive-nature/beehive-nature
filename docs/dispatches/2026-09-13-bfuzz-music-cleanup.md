# 2026-09-13 · bFUzZ · music cleanup (F1 + R1 from the #75 review)

**Order.** Founder (LoVis waTer, DM 2026-09-13 05:04Z): PR #75 merged at `655b2220`
before the two review follow-ups landed; they become one tiny post-merge cleanup PR
against current main, with its own focused tests and dispatch, kept separate from the
redesign history. Review provenance: bFUzZ independent review of #75 (posted 04:51Z),
findings F1 (bookkeeping) and R1 (recommendation).

## F1 — the music.\* machine-draft pass recorded in `_meta.drafted`

`surfaces/lang-corpus.json` `_meta.drafted` gains one entry: the 2026-09-13 `music.*`
pass (12 keys, English plus 28 docked tongues) machine-drafted by the zCode seat in
PR #75 — recorded post-merge by bFUzZ review finding F1; the drafting pass predates
the record. No corpus cell changed; the line is provenance bookkeeping the z2d
release established for every machine pass. JSON re-validated after the edit.

## R1 — z2sec-probe points at music.html directly

`e2e/z2sec-probe.mjs` retargeted from `surfaces/jams.html` to `surfaces/music.html`
(four surface lists/loops + three goto URLs). The S2 battery now asserts the hardened
page itself instead of reaching it through the redirect shim — the security receipt no
longer depends on the shim's query forwarding. Verified on this tree: **44/44**
(cross-origin evil-override ignored + visible REFUSED row, wrong-hash digest refusal,
390px no-overflow, zero page errors). For the record: the stock probe through the shim
also measured 44/44 during review — the retarget removes ambiguity, it does not fix a
failure. The probe file is unchanged between `e4e86e42` and `655b2220`, so the diff
built against the pre-merge file applies byte-identically.

## Focused tests

New `e2e/music-cleanup.test.mjs` (static, node + fs only, fail-closed):
1. F1 receipt — `_meta.drafted` names the 2026-09-13 `music.*` pass and keeps the
   corpus-law wording ("no human attestation claimed").
2. R1 receipt — the probe source contains no `jams.html` navigation and targets
   `surfaces/music.html`.

Wired into the static job's front-door `node --test` batch in `tests.yml` (one line
appended; no other workflow change).

## Gates (this tree: `655b2220` + this commit)

- front-door static batch: **329/329** (327 prior + the 2 new receipts)
- `estate-source`: **11/11** · `estate-check`: PASS
- `z2sec-probe` (retargeted): **44/44**
- Hosted checks run on the PR itself; the browser suites are untouched by this change
  set (corpus metadata, one non-CI probe script, one static test).
- Local §7 staged-mode check: skipped where a POSIX `sh` is unavailable on this
  Windows host; the commit carries the §7 shape directly (founder author, seat
  committer, seat trailer) and CI re-scans the contributed range regardless.

## Boundaries and rollback

No surface HTML, registry, atlas, floors, payment, wallet, x0x, Autonomi or production
infrastructure touched. PR #74's security substance is untouched; the probe retarget
only changes which page it navigates. Rollback is a plain `git revert` of this commit.

— bFUzZ (GLM 5.3 seat), 2026-09-13 · worktree `wt-bfuzz-music-cleanup` off `655b2220`
