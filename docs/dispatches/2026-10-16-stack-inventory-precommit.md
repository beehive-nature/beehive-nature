# 2026-10-16 · stack-inventory pre-commit: the generated workspace inventory is checked against the STAGED member list at commit time, with the remedy named

Seat: Claude Code (Fable 5.1), the SOVEXEC-001 session continued. Order: the founder, 2026-10-16, taking the follow-up card into this session ("Do this task here"), after the independent recovery review asked that the invariant `Cargo.toml + Cargo.lock + generated stack.html + inventory check = one coherent change` be enforced automatically before pushing, without weakening the CI check. Branch `claude-LoVis/stack-inventory-precommit`, cut from main `968eafc06`; independent of the SOVEXEC stack.

## 0 · What went wrong, and where the check already lived

CI's `static` job runs `node scripts/build-stack-inventory.mjs --check` ("Engine Room — every surface included"): the script regenerates the crate list and count inside `surfaces/stack.html` from the root `Cargo.toml` member list and `--check` fails when the committed page differs. On 2026-10-16 all four SOVEXEC heads went red on that one step, everything else green, because two new crates had been added without regenerating the page. The check was right; it was only on the far side of a push, where it cost four CI cycles and a propagation across a stacked set of branches. This lane moves the same check to commit time: one implementation (the generator's own `--check`), two enforcers, as `secret-scan.sh` already is.

## 1 · What landed

**`scripts/stack-inventory-check.sh`** (new, POSIX sh, mode `diff`). When neither the root `Cargo.toml` nor `surfaces/stack.html` is staged it prints `stack-inventory: not staged … skipped` and passes, costing nothing. When either is staged it extracts the STAGED blobs of both (`git show :Cargo.toml`, `git show :surfaces/stack.html`) into a temp dir and runs the generator's `--check` against them through two env overrides, so the commit is what is checked, never the working tree: a page regenerated but left unstaged is exactly the commit CI would refuse, and it is refused here. On a stale page:

```
stack-inventory: BLOCKED - surfaces/stack.html is stale for the staged Cargo.toml members
  (CI's Engine Room check would fail on this commit).
  remedy: node scripts/build-stack-inventory.mjs && git add surfaces/stack.html   then commit again
  generator: Error: Stack inventory needs regeneration
  --no-verify is not a bypass: CI runs the same --check on push.
```

It never regenerates or stages the page on the committer's behalf (detection before publication, the hook law; a guard that acts for the committer hides what it changed). A missing `node` or a missing generator is refused by name with exit 2, as the scanner refuses an environment it cannot scan.

**`scripts/build-stack-inventory.mjs`**: two env overrides, `STACK_INVENTORY_CARGO` and `STACK_INVENTORY_PAGE`, read only when set. Unset, the script reads the tree exactly as before; CI's step is byte-for-byte the same command and the test's last row proves the unchanged behavior.

**`.githooks/pre-commit`** (the checked-in hook this box runs through `core.hooksPath`): the third delegate, after the secret scan and the §7 identity check. **`scripts/install-hooks.sh`** (the installer a fresh clone runs): its generated hook now calls the check when `scripts/stack-inventory-check.sh` exists in the checkout, after a clean scan, and reports the inventory result as its own exit code; the scanner's environment-refusal message is untouched and no longer blamed for the inventory's refusal. Both wirings carry the same law.

**`e2e/hooks-installed.test.sh`** (already in CI's `static` job): the SS-2 rig is unchanged except that it now also asserts the installed hook names the inventory check, and a second contract follows it: a detached worktree of this checkout (the generator needs the whole tree), this checkout's hook and scripts copied in (a no-op in CI, where HEAD is the PR head), commits made as the founder through the environment because the checked-in hooks include the §7 check, and never through `git config`, which a worktree shares with the real checkout. Five rows:

| row | claim |
|---|---|
| skip | a commit touching neither file is skipped with a receipt and commits |
| known-BAD | a member added to `Cargo.toml` without regenerating the page is refused with `stack-inventory: BLOCKED` and the remedy line |
| known-BAD, second shape | the page regenerated in the tree but not staged is still refused (the index is what is checked) |
| known-GOOD | the regenerated page staged commits with `stack-inventory: ok` |
| CI unchanged | the generator's own `--check` with no env set still reads the tree |

## 2 · Receipts

`bash e2e/hooks-installed.test.sh` on this box (Git Bash, node 24), 2026-10-16:

```
PASS absent-state detected: unwired repo let the vector commit (the defect SS-2 kills)
PASS installer wires the pre-commit hook delegating to the scanner and the inventory check
PASS hooked commit refuses the vector
PASS same-line PUBLIC-CONSTANT marker commits clean
PASS clean content commits clean
PASS stack-inventory: a commit touching neither file is skipped with a receipt
PASS stack-inventory known-BAD: a stale surfaces/stack.html is refused with the remedy named
PASS stack-inventory known-BAD: a page regenerated but left unstaged is still refused (the index is what is checked)
PASS stack-inventory known-GOOD: a regenerated, staged page commits with a receipt
PASS stack-inventory: the generator's own --check is unchanged for CI
```

`node scripts/build-stack-inventory.mjs --check` on this branch: `{"components":24,"workspaceCrates":78,…,"mode":"checked"}`. The neighbouring selftests pass on this box: `push-preflight.sh --selftest` ("selftest ok — refuses what it must, permits what it must."), `identity-check.sh --selftest` (through T8-E), `secret-scan.sh selftest` ("the blocker blocks, the marked pass, the noise collapses"). CI on the PR head is the receipt that governs.

**Corrected after the first commit (`4555d5ff2`):** that commit's message says the commit itself ran the new hook and printed the skip receipt. It did not. Its hook output carries the secret scan and the two §7 lines only, because on this box `core.hooksPath` is the ABSOLUTE path of the main checkout's `.githooks`, so a worktree runs the main checkout's copy of the hook, not its own; the new hook becomes live here only once main carries it and the main checkout is updated. The executed proof of the wiring is therefore the five worktree rows above, which run the checked-in hook explicitly through `-c core.hooksPath=<worktree>/.githooks`, and CI's run of the same test on the PR head. A commit message cannot be edited; this paragraph is the correction, forward.

## 3 · Two convictions of this seat, kept as facts

- The first draft of the rows set `git config user.email probe@invalid` inside the temp worktree. A worktree shares the repository config: that write replaced the founder identity in this checkout's `.git/config`, and the §7 check then refused the probe. The identity was restored by hand (`loVis waTer <loviswater44@gmail.com>`, the constants in `identity-check.sh`), and the rows now pass the identity through the environment only. The lesson is written into the test.
- The rows first ran against the detached worktree's HEAD, which held `origin/main`'s hook, not the uncommitted one, so the inventory step did not exist there and the skip receipt never appeared. The rig now copies this checkout's hook and scripts in; in CI that is a no-op.
- The first commit's message claimed a live skip receipt from the hook on this box. The hook that ran was the main checkout's, through the absolute `core.hooksPath` this box carries (see §2). The claim is withdrawn above rather than left prettier than the truth.

## 3a · The review of `758d74c8a` and the fix (third commit)

The independent review found one fail-open edge: the detection used `--diff-filter=ACMR`, which excludes staged deletions, so `surfaces/stack.html` staged for deletion read as "not staged" and was skipped; and the blob extraction fell back to `HEAD:<path>`, so a missing index blob could be replaced by an older copy. Both are closed: detection now lists every status, and a required blob missing from the index is refused by name (`stack-inventory: BLOCKED - <path> is missing from the index (staged for deletion?)`) with the remedy, never replaced. The row `a page staged for deletion is refused by name, not replaced from HEAD` runs the case through the real hook (`git rm --cached surfaces/stack.html`, commit refused, index restored). Eleven rows green locally after the change; CI on the new head governs. The review's boundary is kept: this hook proves inventory coherence only; `Cargo.lock` coherence stays CI's `--locked` obligation and is not represented as proven here.

## 4 · Boundaries not crossed, and what is not claimed

- CI's `--check` is unchanged; nothing was weakened. The hook is detection, `--no-verify`-able by construction, and CI remains the enforcer on push.
- The check reads the staged member list and page; it does not regenerate `Cargo.lock` or test the crates (that stays the committer's and CI's work).
- Nothing under `surfaces/` was added or regenerated in this tree (no registration ritual due); the rows regenerate the page only inside the temp worktree.
- The fresh-repo rig does not exercise the inventory check (no generator there); the worktree rows do, through the checked-in hook. The installer's generated hook is proven to NAME the check; its execution path is the same script.

## 5 · Next owner

HUMAN INTERACTION: NONE for landing. The SOVEXEC stack (#448, #449, #450, #451) predates this hook and already carries its regenerated pages; any later crate lane commits through this hook from the first commit.
