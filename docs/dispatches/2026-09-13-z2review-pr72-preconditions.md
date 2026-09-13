# z2.review — PR #72 ACCEPTANCE GATE: REVIEW WITHHELD, PRECONDITIONS UNMET (2026-09-13)

SEAT: z2.review, independent acceptance reviewer. ORDER (verbatim): "Review PR #72 only after #70 merges and #72 is rebased. Cold-check both profile surfaces plus vending at 390px and desktop. Verify five distinct cards, .a testnet boundary, Silent Payments never-claims, ERC20i and bnr:// links, register parity, external-link behavior, and corrected payment wording. Report PASS, findings, or BLOCK with evidence. Do not edit or merge."

## VERDICT: NOT READY — the ordered review DID NOT RUN. Both preconditions fail as of 2026-09-13T02:41Z. Zero content findings (none were sought); this is a gate-state report, not an acceptance of #72 and not a BLOCK on its content.

## E1 — PR #70 (profile capability rails) is OPEN, UNMERGED

- `gh api pulls/70` → `state: open`, `mergedAt: null`, head sha `04bf65f519e845ecac30219292e9df4b255d63ac`
- live branch tip (`git ls-remote origin refs/heads/zcode/z2b-profile-capabilities-2026-09-12`) = `04bf65f5…`
- ancestry check per the merge-status verification law (never infer from words or lane logs): `git merge-base --is-ancestor 04bf65f5 origin/main` → **NOT on main** — no side-door merge either
- #70's own CI is GREEN (run 34732599281: node pass 2m41s · scan pass · static pass · test pass 1m35s) — merge-ready from CI's standpoint; the only missing step is the merge decision itself, which this seat does not take ("do not merge")

## E2 — PR #72 is a DRAFT and STILL STACKED, not rebased

- `gh api pulls/72` → `draft: true`, base = `zcode/z2b-profile-capabilities-2026-09-12` (that IS #70's head branch), head sha `1a75bd97b3ed370416126cf385fdc648724f888a`
- stack proven at the object level: `git log --format='%h %p' -1 1a75bd97` → parent = `04bf65f5` (= #70's head). One commit of #72 riding directly on #70's branch.
- `git merge-base --is-ancestor 1a75bd97 origin/main` → **NOT on main**
- origin/main tip at check time: `a1b340a1` (Merge actionable gallery recovery (#73)) — main has moved past the shared-tree main `856e5c09` via #73, so #72 needs a rebase onto CURRENT main regardless of #70's fate

## E3 — CI footnote on #72's checks tab: observed, explained, NOT a code defect

- `gh pr checks 72` currently shows one `static fail` (run 34733346550, job 103660134878)
- job log, quoted: `FAIL §7 c5023aae98448d3d626fcd1ed19735e17716c8b8 — author is 'Travis Remington <111410861+loviswaternakamoto@users.noreply.github.com>', not the founder (seats are committers + trailers, never authors)` — while BOTH real stacked commits pass in the same run: `ok §7 1a75bd97… founder-typed` and `ok §7 04bf65f5… founder-typed`
- `c5023aae` sits on NEITHER live branch tip (ls-remote above: tips are `04bf65f5` and `1a75bd97`; the object is not reachable from either) — a transient founder web-UI commit (GitHub noreply identity, created ~30s after the branch push at 2026-09-13T02:33Z) since removed. §7 false-red on web-UI authors is a KNOWN class (worktree-discipline law, lane-prepush trap #1). Expect the red to clear on the next push of the rebased branch; if §7 ever fails on a TIP commit, treat it as an identity-shape defect and gate RED.

## WHAT UNBLOCKS THIS REVIEW

1. Merge #70 (CI green — see E1).
2. Rebase #72 onto origin/main (or retarget its base to main once #70 lands and recompute), push, un-draft.
3. Re-dispatch z2.review. Scope unchanged from the order: cold-check both profile surfaces + vending at 390px AND desktop; five distinct cards per surface; .a testnet boundary verbatim; Silent Payments never-claims (asserted per the address-shaped-run law, `/sp1[a-z0-9]{30,}/`, never the literal "sp1"); ERC20i + bnr:// links live; register parity; external-link behavior; corrected payment wording. No edits, no merges by this seat.

## DISCIPLINE RECEIPTS

- Read-only evidence only: `gh api`, `gh pr checks`, `git ls-remote`, `git fetch` + `merge-base` ancestry. No PR edited, no branch merged, no label/review submitted.
- No peer worktree touched — the builder's `wt-z2b-profile-caps` (checked out on the #72 branch) was left alone; this report was written in this seat's own worktree `wt-z2review`, branch `z2review/pr72-preconditions-2026-09-13`, cut from origin/main per the worktree-cut law, committed by pathspec with §7 identity (founder author, seat committer + trailer), four pre-push checks run on the asserted subject, and pushed for the tree (reports-in-tree channel law).

## RE-CHECK 2026-09-13T02:5xZ (founder-approved read-only re-verification — same order, same gate)

- Exact current main commit: **`a1b340a1eefae6baadad52d4770bca114a67ea82`** ("Merge actionable gallery recovery (#73)") — unchanged since the 02:41Z check; #70 is NOT in it.
- PR #70: `state: open`, `mergedAt: null`, `mergeCommit: null` — still unmerged.
- PR #72: still draft, base still `zcode/z2b-profile-capabilities-2026-09-12` (#70's branch) — still stale, NOT reviewed, per the founder's stop instruction.
- Per order: "If #70 is not merged, stop and report the prerequisite; do not review stale #72." — EXECUTED: stopped, no content checks run, nothing edited/merged/deployed. The unblock path in the first section stands unchanged.

z2.review — 2026-09-13T02:45Z
