#!/usr/bin/env bash
# SS-2 contract (2026-09-20, order ed5fd3dc): the pre-commit hook AGENTS.md
# documents must be installable and its absence detectable. The CONTRACT,
# not any one machine's environment: a fresh `git init` repository, the
# installer copied in and run, then the hook must bite - a planted 48+ hex
# vector without a marker refuses to commit; the same vector with a
# same-line PUBLIC-CONSTANT marker commits clean (the legitimate marker
# law); a clean file commits clean. At base this test fails by
# construction: no installer exists there.
#
# Second contract (2026-10-16): the stack-inventory invariant. A commit that
# adds a workspace member without regenerating surfaces/stack.html is
# refused by the checked-in .githooks/pre-commit with the remedy named
# (known-BAD); the same change with the page regenerated and staged commits
# with a receipt (known-GOOD); a commit touching neither file is skipped with
# a receipt. These rows run through the REAL hook in a detached worktree of
# this checkout, because the generator needs the whole tree.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
installer="$root/scripts/install-hooks.sh"
scanner="$root/scripts/secret-scan.sh"
# secret-scan.sh SOURCES this at :82 ("one implementation, two enforcers"). A rig
# that copies the scanner without it produces a scanner that refuses the
# environment - three rows pass and the fourth dies on ". : cannot open
# keyshape.sh", which reads like a code defect and is a missing file in the rig.
# Found 2026-09-23 the first time anything ran this file; push-preflight.sh's own
# selftest, written later, copies all three, so the lesson was learned twice.
keyshape="$root/scripts/keyshape.sh"

if [ ! -f "$installer" ]; then
  echo "FAIL hooks contract: $installer does not exist - the documented pre-commit law cannot be wired (SS-2)." >&2
  exit 1
fi
if [ ! -f "$keyshape" ]; then
  echo "FAIL hooks contract: $keyshape does not exist - the scanner sources it, so a rig without it tests a scanner that cannot run." >&2
  exit 1
fi

testdir=$(mktemp -d /tmp/bnr-hooks-test.XXXXXXXX)
wt=""
cleanup() {
  if [ -n "$wt" ]; then git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true; fi
  rm -rf -- "$testdir"
}
trap cleanup EXIT

git init -q "$testdir"
cd "$testdir"
git config user.email probe@invalid
git config user.name probe
mkdir -p scripts
cp "$installer" scripts/install-hooks.sh
cp "$scanner" scripts/secret-scan.sh
cp "$keyshape" scripts/keyshape.sh

# RED half (deliberate, documented): before wiring, the vector commits.
# This is the invisible-absence state SS-2 exists to kill - the test
# records what "no hook" looks like instead of assuming it.
vector=$(printf '%064d' 1)
printf 'synthetic=%s\n' "$vector" > example.txt
git add -- example.txt
if ! git commit -qm 'unwired probe' 2>/dev/null; then
  echo "FAIL pre-wire probe: commit refused with NO hook installed - unexpected"
  exit 1
fi
echo "PASS absent-state detected: unwired repo let the vector commit (the defect SS-2 kills)"

# Wire it.
sh scripts/install-hooks.sh >/dev/null
hook=$(git rev-parse --git-path hooks)/pre-commit
[ -f "$hook" ]
grep -q 'scripts/secret-scan.sh' "$hook"
grep -q 'scripts/stack-inventory-check.sh' "$hook"
echo "PASS installer wires the pre-commit hook delegating to the scanner and the inventory check"

# Bite: the same vector must now refuse.
printf 'synthetic=%s\n' "$vector" > example.txt
git add -- example.txt
if git commit -qm 'wired probe' 2>/dev/null; then
  echo "FAIL hooked commit accepted a 48+ hex vector"
  exit 1
fi
echo "PASS hooked commit refuses the vector"

# Marker law: same vector, same-line PUBLIC-CONSTANT - must commit.
printf 'synthetic=%s  <!-- PUBLIC-CONSTANT: probe vector -->\n' "$vector" > example.txt
git add -- example.txt
git commit -qm 'marker probe'
echo "PASS same-line PUBLIC-CONSTANT marker commits clean"

# Clean law: an ordinary line commits clean (the inventory check is absent in
# this rig, and the installed hook skips it by construction when absent).
printf 'ordinary content\n' > example.txt
git add -- example.txt
git commit -qm 'clean probe'
echo "PASS clean content commits clean"

# ---- the stack-inventory invariant, through the REAL hook in a real checkout ----
cd "$root"
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL stack-inventory rows: node is not on PATH; the generator cannot run" >&2
  exit 1
fi
wt=$(mktemp -d /tmp/bnr-inventory-wt.XXXXXXXX)
rm -rf -- "$wt"                      # git worktree add wants a path that does not exist
git worktree add -q --detach "$wt" HEAD
# the rows exercise THIS checkout's hook, check script and generator: in CI,
# HEAD is the PR head and these copies change nothing; locally they let the
# rows run before the change is committed (a detached worktree holds HEAD)
cp "$root/.githooks/pre-commit" "$wt/.githooks/pre-commit"
cp "$root/scripts/stack-inventory-check.sh" "$wt/scripts/stack-inventory-check.sh"
cp "$root/scripts/build-stack-inventory.mjs" "$wt/scripts/build-stack-inventory.mjs"
cd "$wt"
hooks="$wt/.githooks"
# The checked-in hooks include the s7 identity check, which wants the founder
# as AUTHOR (seats are committers + trailers, never authors), exactly as the
# identity selftest's own rigs do. The identity comes from the environment and
# never from `git config`: a worktree shares the repository config, so a
# config write here would silently change the real checkout's identity
# (it did, once, while this test was being written).
founder_name=$(sed -n 's/^FOUNDER_NAME="\(.*\)"/\1/p' "$root/scripts/identity-check.sh")
founder_email=$(sed -n 's/^FOUNDER_EMAIL="\(.*\)"/\1/p' "$root/scripts/identity-check.sh")
if [ -z "$founder_name" ] || [ -z "$founder_email" ]; then
  echo "FAIL stack-inventory rows: founder identity constants not found in scripts/identity-check.sh" >&2
  exit 1
fi
commit_with_hooks() {
  GIT_AUTHOR_NAME="$founder_name" GIT_AUTHOR_EMAIL="$founder_email" \
  GIT_COMMITTER_NAME="$founder_name" GIT_COMMITTER_EMAIL="$founder_email" \
  git -c core.hooksPath="$hooks" commit -q -m "$1" 2>&1
}

# skip row: an unrelated staged file is skipped with a receipt and commits
printf 'probe\n' > probe-unrelated.txt
git add -- probe-unrelated.txt
if ! out=$(commit_with_hooks 'unrelated probe'); then
  echo "FAIL stack-inventory skip row: an unrelated commit was refused: $out" >&2
  exit 1
fi
echo "$out" | grep -q 'stack-inventory: not staged' || { echo "FAIL skip receipt missing: $out" >&2; exit 1; }
echo "PASS stack-inventory: a commit touching neither file is skipped with a receipt"

# known-BAD: a member added, the page not regenerated -> refused, remedy named
mkdir -p crates/zz-hook-probe
sed -i 's|^members = \[|members = [\n    "crates/zz-hook-probe",|' Cargo.toml
grep -q '"crates/zz-hook-probe"' Cargo.toml
git add -- Cargo.toml
if out=$(commit_with_hooks 'stale inventory probe'); then
  echo "FAIL stack-inventory known-BAD: a stale page committed: $out" >&2
  exit 1
fi
echo "$out" | grep -q 'stack-inventory: BLOCKED' || { echo "FAIL known-BAD refused without the named line: $out" >&2; exit 1; }
echo "$out" | grep -q 'node scripts/build-stack-inventory.mjs && git add surfaces/stack.html' || { echo "FAIL known-BAD refusal carries no remedy: $out" >&2; exit 1; }
echo "PASS stack-inventory known-BAD: a stale surfaces/stack.html is refused with the remedy named"

# known-BAD, second shape: the page regenerated in the tree but NOT staged is
# still the commit CI would refuse
node scripts/build-stack-inventory.mjs >/dev/null
if out=$(commit_with_hooks 'regenerated but unstaged probe'); then
  echo "FAIL stack-inventory known-BAD (unstaged page): committed: $out" >&2
  exit 1
fi
echo "$out" | grep -q 'stack-inventory: BLOCKED' || { echo "FAIL unstaged-page refusal missing: $out" >&2; exit 1; }
echo "PASS stack-inventory known-BAD: a page regenerated but left unstaged is still refused (the index is what is checked)"

# known-GOOD: the regenerated page staged -> commits with a receipt
git add -- surfaces/stack.html
if ! out=$(commit_with_hooks 'regenerated inventory probe'); then
  echo "FAIL stack-inventory known-GOOD refused: $out" >&2
  exit 1
fi
echo "$out" | grep -q 'stack-inventory: ok' || { echo "FAIL known-GOOD receipt missing: $out" >&2; exit 1; }
echo "PASS stack-inventory known-GOOD: a regenerated, staged page commits with a receipt"

# known-BAD, third shape: the page staged for DELETION is refused by name,
# never replaced by the HEAD copy (the #457 review edge case)
git rm -q --cached -- surfaces/stack.html
if out=$(commit_with_hooks 'deleted page probe'); then
  echo "FAIL stack-inventory known-BAD (deleted page): committed: $out" >&2
  exit 1
fi
echo "$out" | grep -q 'stack-inventory: BLOCKED - surfaces/stack.html is missing from the index' || { echo "FAIL deleted-page refusal missing: $out" >&2; exit 1; }
git reset -q -- surfaces/stack.html
echo "PASS stack-inventory known-BAD: a page staged for deletion is refused by name, not replaced from HEAD"

# the check itself, outside a commit: the generator's own --check still reads
# the tree when the env overrides are unset (CI's step, untouched)
node scripts/build-stack-inventory.mjs --check >/dev/null
echo "PASS stack-inventory: the generator's own --check is unchanged for CI"
