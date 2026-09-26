# z1.a receipt — Bloom release candidate re-cut from current main (supersedes #35)

Date: 2026-09-12. Seat: z1.a (zCode). Docket: #10 (budget-conscious release sprint, z1.a task).

## The failure, read at source

Run 34715025752 (static job, PR #35 head e96e58a0): every step green except
"§7 identity — author is the founder on the contributed range". The gate walked
df895c7c..e96e58a0 (51 commits) because S7_BEFORE came from a stale
pull_request base sha — df895c7c is main BEFORE the sprint merges. The four
FAILs (5709897, 64fa106, de7120d, c181371) are GitHub-authored merge commits
that #35 inherited BY MERGING MAIN (its head carries 5709897f as first
parent) — not commits the PR contributes. The true contributed range
(origin/main..e96e58a0) is 13 commits, every one §7-ok in that same log.

## The correction

Branch `zcode/bloom-release-candidate-2026-09-12` cut from main 5709897f
(origin/main tip); the reviewed final Bloom delta applied as
`git diff --binary 5709897f e96e58a0 | git apply --index`. The proof is the
tree sha: the candidate commit's tree IS e96e58a0's tree
(0d840fcbae5178ad1c0111242a73d4be56c13e10) — `git diff <candidate> e96e58a0`
is empty. No force-push, no history rewritten: #35's branch and its 13-commit
provenance stand untouched as the record, and the gate
(scripts/identity-check.sh, tests.yml) is carried byte-unchanged from the
reviewed head.

Commit 141e346a: author the founder, committer z1.a (zCode), Co-authored-by
trailers for every seat that shaped the range — Codex (Astra), Cursor Agent,
Grok (Cursor cloud), z1.b — with the per-commit credit map in the message.
A PR freshly opened against main records base.sha = 5709897f, so §7's range
is exactly this clean commit; the candidate never merges main into itself,
so the range cannot re-widen.

## Tests (fresh, this seat, on the candidate)

- Front-door union — the exact static-job line, incl. first-work and
  bloom-work-pack: 301/301.
- estate-check: PASS — 93 counted · 102 listed · 26 domains · hub in sync.
- estate-source corpus: 11/11. lint-ci-shape: 42/42.
- §7 selftest 4/4; §7 range 5709897f..HEAD: 1 commit, ok.
- Rust suites: green on e96e58a0 in run 34715025752; the candidate tree is
  byte-identical, so those results carry by identity — CI re-runs them.

## Evidence reused (recorded, not re-run)

- z1.b cold-receive/export/import review: ACCEPTANCE-READY, 86 named checks,
  desktop + 390px (receipt 171ac4fd, dispatch
  docs/dispatches/2026-09-12-z1b-first-work-cold-receive-review.md on
  branch z1b/first-work-review-receipt-2026-09-12).
- Astra integration receipt docs/dispatches/2026-09-12-astra-bloom-release-integration.md
  (union 301/301, first-work 15/15, W1 + I1 cured at e96e58a0).
- Run 34715025752: node ✓ test ✓ scan ✓ on the identical tree.

## Limitations

- No fresh browser walk: the behavioral evidence above was taken at
  8eac7117/e96e58a0 and the candidate tree is unchanged, so a re-walk would
  re-observe the same bytes. z1.d's independent candidate review is the
  check on this claim, per the docket.
- §7 stays DETECTION, not enforcement — posture unchanged.
- Nothing merged, nothing deployed, no Pages publication triggered.

## Next action

Astra accepts or rejects the replacement PR (explicitly superseding #35).
On merge, #33/#38 residue re-points per z1.c's release map, and z1.b queues
Bloom live acceptance after the actual release.
