# 2026-10-18 · BNROSE-EVOLVE — #435 pinned landing receipt

Order: founder, 2026-10-18. This lane takes exactly three things: the pinned
merge of #435, the merge receipt, and main-CI verification on the actual
merge commit. #436 stays with its existing owner (its continuation is already
posted there, including retaining the landed §7 repairs); nothing in this
lane touches it.

## Handoff context, named

A prior qualification run had verified the head fully and attempted the
merge + receipt, but its GitHub writes were blocked before GitHub processed
them; it merged nothing and posted nothing, and said so honestly. This lane
re-read every number fresh at merge time rather than inheriting its report —
pasted receipts authorize nothing.

## Fresh qualification evidence (this seat's own reads, pre-merge, ~02:25 UTC)

- Qualified head: `b2cc5334e5200876fc898c8e7b72423b663dbcea` — PR #435 OPEN,
  non-draft, `MERGEABLE`, mergeStateStatus `CLEAN` against then-main
  `751e5aacb`. The pin held: the head had not moved since qualification, and
  no reconciliation was needed for main's independent #468 change (PQ
  workflow + docs only).
- Workflow runs on that head: **24/24 completed/success** (13 `pull_request`
  + 11 `push` events).
- Check-runs on that head: **62 total — 55 success + 7 skipped** (conditional
  skips, e.g. `rb03-budget`); 0 failing, 0 pending; both `static` checks
  pass. (The prior run's handoff said 54/8; the count drifts between reads —
  the numbers bound to this merge are the ones above.)
- Main at `751e5aacb` pre-merge: 11/11 push runs success — no inherited red
  at merge time.

## The merge

- `38d540aa2dc975b491d4728bff154d2ba2f0f689` = "Merge pull request #435 from
  beehive-nature/zcode/bevolve-2026-10-15", merged 2026-10-19 02:27:24 UTC.
- Pinned execution: merged with GitHub's own head-match guard
  (`--match-head-commit b2cc5334e…`), which GitHub accepted — a moved head
  would have been refused by GitHub, not by this seat's judgment.
- Parents verified: `751e5aacb` (prior main tip) + `b2cc5334e` (the
  qualified head). Merge-commit method per estate pattern.
- The lane's canon dispatch
  `docs/dispatches/2026-10-15-bnrose-evolve-controller.md` rides this merge
  onto main (it lived on the PR branch).
- Qualification + landing receipt comment on the PR:
  `issuecomment-6258369707`.

## Post-merge main CI on the merge commit

14 runs on `38d540aa2` (13 workflows + pages-build-deployment), including
`BNROSE-EVOLVE` — the lane's own workflow — and `keychain-edge-lab`, both in
the main-push set for the first time on this commit.

`pages-build-deployment` on this commit completed **cancelled** — the benign
supersession class: 26 minutes after this merge, another seat merged #469
(`004abba67`, a descendant of this commit), and Pages belongs to the newest
main commit. The live deployed site therefore includes everything from #435
via that descendant. Named as concurrency/supersession cancellation, not a
test failure, per the estate's standing classification.

**VERDICT (drained 2026-10-19 03:42 UTC): 13/13 workflow runs
completed/success on `38d540aa2`** — `BNROSE-EVOLVE` itself green on its
first main-push run, alongside keys-door, secret-scan, tests,
keychain-edge-lab, BNROSE-RUST-001, BNROSE-ADAPTERS-REAL, bTunGsTeN RB,
bTunGsTeN PQ, bTunGsTeN PQ SAW, WB001 SAW proofs, WB002 WASM corpus, WB002
SAW equivalence. The only non-success is the pages supersession cancellation
named above. No failures, no pending.

## Dispatch commit

This dispatch rides `zcode/bevolve-landing-2026-10-18`, cut in `wt-bevolve`
(worktree law; explicit pathspec add; clean tree) — first at `38d540aa2`,
then re-cut at `004abba67` when #469 landed mid-watch, so the dispatch rides
the target tip at push time. Its own push-run verdict is recorded in the
final report of this lane.
