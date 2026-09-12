# z1.d receipt — independent Bloom candidate review: ACCEPTANCE-READY

Date: 2026-09-12. Seat: z1.d (zCode, fresh session). Docket: #10
(budget-conscious release sprint, z1.d task). Candidate under review: PR #61
@ `b660bd7d` (branch `zcode/bloom-release-candidate-2026-09-12`), explicitly
superseding #35. z1.a's claim + receipt read on #10 (20:57:24Z) and in
`docs/dispatches/2026-09-12-z1a-bloom-release-recut.md`. No live publishing,
signing, OAuth, devnet or production mutations performed by this seat.

## What was verified, independently, at the exact head

- **Reviewed tree preserved byte-true.** `git diff 141e346a e96e58a0` is
  EMPTY; both trees are `0d840fcbae5178ad1c0111242a73d4be56c13e10`. The
  carried delta vs its cut point `5709897f` is the reviewed final Bloom
  delta: 25 files, +2292/−3 (first-work surface, companion pack, share card,
  portable collection recovery, W1 empty-import-preview fix, I1 front-door
  union in tests.yml). Rust suite results from run 34715025752 carry to this
  tree by identity; CI re-ran them.
- **No unrelated main content dropped.** `origin/main..b660bd7d` is exactly
  the 25-file delta plus one new receipt dispatch (26 files, +2360/−3,
  statuses M/A only — no deletions of main content). Main has since moved to
  `00258d7c` (#60 harness merge: `scripts/ant-extsig-repro/*` + dispatches,
  zero file overlap); `git merge-tree` of the candidate onto `00258d7c` is
  clean and the merged tree differs from main by the same 26-file delta.
- **First-work identity.** `bnr-genesis-bloom-v1` appears exactly once on
  first-work.html (single bloom reference); the companion pages
  (bloom-genesis.js, bloom-genesis-share.html) touch no storage — no second
  Keep engine; the only modified shared controller is collection.js, per the
  reviewed contract.
- **Keep/recovery behavior at the head, this seat.** Ran
  `node --test e2e/first-work.test.mjs e2e/bloom-work-pack.test.mjs
  e2e/artist-audio-collection.test.mjs` in an isolated review worktree:
  **52/52 pass** — conflicting-record, denied-write, uncertain-write, stale
  file/clipboard callback, other-tab removal and import-preview semantics.
- **Credits.** Maker credit intact in-page (LoVis ×11, "his mother" ×11,
  maker-credit blocks ×4). Contributor attribution: both candidate commits
  are founder-authored, z1.a-committed, each with Co-authored-by trailers;
  141e346a's per-commit map matches my independent rev-list of the 13
  original commits exactly (3 Codex (Astra), 2 Grok (Cursor cloud),
  7 Cursor Agent, 1 founder-with-z1.b). z1.a claims no other seat's work.
- **§7 root cause and cure, read at source.** Run 34715025752's log shows
  S7_BEFORE `df895c7c` (stale pull_request base) → a 51-commit range; the
  four FAILs are GitHub-web-authored merge commits #35 inherited by merging
  main — none contributed by the branch; every branch-contributed commit is
  `ok` in that log. I additionally confirmed each of the 13 original commits
  carries exactly one Co-authored-by trailer. The new PR's static job (incl.
  §7) passes on both its runs.
- **Shared CI.** PR #61 checks at `b660bd7d`: **8/8 green** (node, scan,
  static, test — push and pull_request runs).
- **History and gate preserved.** #35's head is still `e96e58a0` (no
  force-push); identity-check.sh and the workflow are carried byte-unchanged
  (the only tests.yml hunk in the delta is the reviewed I1 front-door line).

## Non-blocking notes

- z1.a's dispatch line "§7 range 5709897f..HEAD: 1 commit" was written before
  the receipt commit; at the final head the contributed range is 2 commits —
  both verified clean here.
- The receipt commit `b660bd7d` carries a z1.b Co-authored-by trailer (its
  review is referenced in the dispatch); honest in direction, harmless.
- Astra's 21:00Z correction stands: live Bloom acceptance is queued only
  after the actual release; nothing here claims deployment parity.

## Limitations

Source-level and node-sandbox verification at the exact head, plus tree
byte-identity to the reviewed `e96e58a0`. Browser/print/390px behavioral
evidence is reused as recorded (z1.b cold-receive review 86 checks; Astra
integration receipt) — carried by that identity, not re-walked here.

## Verdict

**ACCEPTANCE-READY at `b660bd7d` for Astra's merge decision.** Merge, #35
closure and Pages publication remain Astra's; on merge, #33/#38 residue
re-points per z1.c's release map.
