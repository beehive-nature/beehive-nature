# PR #388 CI investigation

Run 38080794175 tested `ed91d8e85`, not the current PR head `2d7198c41`.
This investigation fetched origin before comparing source and read the actual
failed and replacement job logs. No additional code fix is needed: commit
`4439845ca`, already on the PR, fixes both causes in two files.

## Exact failures and attribution

- ETERNAL fronts: 3 failures in `e2e/stack-eternal.test.mjs`:
  - Test 605, declared at line 78, assertion line 102: `129 !== 130`.
  - Test 608, declared at line 148: directory omits `surfaces/bheraldry.html`.
  - Test 609, declared at line 163: actual `[4,8,129,4]`, expected `[4,8,130,4]`.
- Static, Engine Room: `build-stack-inventory.mjs --check` passed (23
  components); `build-stack-surfaces.mjs --check` threw
  `Error: Surface directory needs regeneration` at line 54. This and all
  three ETERNAL failures share the stale generated directory cause.
- Bottom-half audit at 390px: `ratchet: 10 worse · 0 better`.
  All ten regressions are on the newly added bheraldry.html:
  WIDE 0 -> 1, CAPS 0 -> 1, SMALL 0 -> 2 in each register,
  plus FAINT 0 -> 1 in bee. Width was 719px in bee/raver and 674px in
  cypherpunk; Notes was forced uppercase; OriginalCreative contrast was
  2.72:1 in bee; two digest elements were 11.5px (bee/raver) or 11px
  (cypherpunk). Two table links per register also produced TINY findings
  at 15px/14px, but these were not among the ten ratchet regressions.

These failures were introduced by `ed91d8e85`. At comparison time main was
`ece07cbc3`; it does not contain bheraldry.html or the PR head. Its generated
stack page is byte-identical to the PR's parent (`10c9f7872`) and its directory
correctly contains 129 surfaces. Both Engine Room generators pass locally
on this main checkout. Main's run 38090308445 also reports eternal and static
completed/success; its entire workflow was not yet complete when inspected.

Final origin refresh: main advanced to `df25b1886`. Its diff from `ece07cbc3`
is confined to WB001/RB05 proof code, scripts, and the wb001-saw workflow;
none of the surfaces, generators, tests, or baseline discussed here changed.
The PR head is still not an ancestor of main. The earlier main CI receipt
belongs to `ece07cbc3`, not to this newer main SHA.

The audit, baseline, stack test, directory generator, shared style/register/tour
files, forge/orbit.html and receipts.html are unchanged between the failed
head and compared main. The replacement audit retains only baselined findings
on forge/orbit.html and receipts.html: SMALL 21, FAINT 12, JUNK 61, six views
on two surfaces. These are inherited findings, not failing branch regressions.
No baseline was relaxed and no unrelated surface was changed.

## Existing minimal repair and verified receipts

`4439845ca` changes only:

- `surfaces/stack.html`: regenerates the directory with bheraldry.html,
  bringing the count to 130 (121 registered, 9 additional tracked pages).
- `surfaces/bheraldry.html`: fixed-layout wrapping tables/links, no forced
  uppercase headings, readable chip text, 12px digest floor in all registers,
  and 32px minimum table-link touch targets.

Current-head push run [38091703817](https://github.com/beehive-nature/beehive-nature/actions/runs/38091703817)
tests `2d7198c41` and completes successfully: all seven jobs pass.
Its raw eternal log reports 628 tests, 628 pass, 0 fail, then 336
page-register views and `ratchet: 0 worse · 0 better`.
Its static log reports both generators checked successfully, including
130 surfaces. PR-event run
[38091705950](https://github.com/beehive-nature/beehive-nature/actions/runs/38091705950)
also reports the same head and success.

The PR remains OPEN with no merge commit, despite a sentence in its existing
bheraldry dispatch saying the lane was merged. The GitHub PR API is the current
source of truth for that state.

## Scope and remaining checks

No production code, tests, or baselines were changed in this investigation.
Only this dispatch is added on a separate receipt branch; the shared checkout
and other seats' work remain untouched. Browser suites were not repeated
locally because completed exact-head CI already verifies the repaired code.

At the latest PR-check snapshot, 43 checks passed, 8 were skipped, and one
remained in progress: `saw-ntt`, run 38091703868, job 114329277737.
The requested eternal, bottom-half ratchet, and Engine Room checks have no
remaining failures. The separately inspected main workflow still had node,
meter, and wallet running. No merge or deployment is performed by this lane.
