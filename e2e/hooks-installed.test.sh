#!/usr/bin/env bash
# SS-2 contract (2026-09-20, order ed5fd3dc): the pre-commit hook AGENTS.md
# documents must be installable and its absence detectable. The CONTRACT,
# not any one machine's environment: a fresh `git init` repository, the
# installer copied in and run, then the hook must bite - a planted 48+ hex
# vector without a marker refuses to commit; the same vector with a
# same-line PUBLIC-CONSTANT marker commits clean (the legitimate marker
# law); a clean file commits clean. At base this test fails by
# construction: no installer exists there.
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
trap 'rm -rf -- "$testdir"' EXIT

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
echo "PASS installer wires the pre-commit hook delegating to the scanner"

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

# Clean law: an ordinary line commits clean.
printf 'ordinary content\n' > example.txt
git add -- example.txt
git commit -qm 'clean probe'
echo "PASS clean content commits clean"
