#!/usr/bin/env bash
set -euo pipefail
scanner=$(cd "$(dirname "$0")/../scripts" && pwd)/secret-scan.sh
test_root=$(mktemp -d /tmp/bnr-secret-scan-test.XXXXXXXX)
nonrepo=$(mktemp -d /tmp/bnr-secret-scan-nonrepo.XXXXXXXX)
trap 'rm -rf -- "$test_root" "$nonrepo"' EXIT
git init -q "$test_root"
cd "$test_root"
vector=$(printf '%064d' 1)
printf 'synthetic=%s\n' "$vector" > example.txt
git add -- example.txt
for mode in tree diff; do
  if output=$(sh "$scanner" "$mode" 2>&1); then echo "FAIL $mode accepted a forbidden shape"; exit 1; fi
  if [[ $output == *"$vector"* ]]; then echo "FAIL $mode reproduced matching content"; exit 1; fi
  [[ $output == *'[REDACTED matching content]'* ]]
  echo "PASS $mode refuses and reports location without reproducing content"
done
pem_vector=$(printf '%s%s' '-----BEGIN RSA PRIVATE KE' 'Y----- synthetic-sentinel')
printf '%s\n' "$pem_vector" > example.txt
git add -- example.txt
for mode in tree diff; do
  if output=$(sh "$scanner" "$mode" 2>&1); then echo "FAIL $mode accepted a PEM marker"; exit 1; fi
  if [[ $output == *"$pem_vector"* ]]; then echo "FAIL $mode reproduced a PEM line"; exit 1; fi
  [[ $output == *'[REDACTED matching content]'* ]]
  echo "PASS $mode refuses PEM without reproducing the matched line"
done

# SS-1 contract (2026-09-19, order c3614edc): a checkout git cannot resolve
# must REFUSE with exit 2 - never a silent pass. The pre-guard diff mode
# exited 0 in exactly this shape (enumeration fails empty, `fail` stays 0) -
# the vacuity class. Environment-independent: any non-repo directory makes
# rev-parse unable to answer `true`, so this runs on any CI runner.
for mode in diff tree; do
  status=0
  output=$(cd "$nonrepo" && sh "$scanner" "$mode" 2>&1) || status=$?
  if [ "$status" -ne 2 ]; then echo "FAIL $mode guard: expected exit 2 in a non-repo, got $status"; exit 1; fi
  [[ $output == *'REFUSING'* ]]
  echo "PASS $mode refuses an unresolvable checkout with exit 2 (SS-1 contract)"
done

# SS-2 fold-in (2026-09-20, order 91c72e99; hole reproduced by bOPus5):
# a high-similarity rename that appends a 48+ hex line must BLOCK. The old
# --diff-filter=ACM dropped R status entirely - the appended vector rode
# the rename past the scan (rc=0). With ACMR + --no-renames a rename
# decomposes to A+D and the destination's full content is inspected.
vector3=$(printf '%064d' 3)
git config user.email probe@invalid
git config user.name probe
# Large source: the appended vector must stay a SMALL delta so git reports
# true R (similarity >= 50). Appending to a tiny file makes it A+D - a
# different (already-caught) shape. The R-status assertion below keeps this
# fixture honest - it cannot quietly degrade into an A+D test.
for i in $(seq 1 100); do printf 'ordinary filler line %s\n' "$i" >> carry.txt; done
git add -- carry.txt
git commit -qm 'carry'
git mv carry.txt carried.txt
printf 'synthetic=%s\n' "$vector3" >> carried.txt
git add -A
renstat=$(git diff --cached --name-status --find-renames | head -1)
case "$renstat" in
  R*) ;;
  *) echo "FAIL rename fixture did not produce R status: got [$renstat]"; exit 1 ;;
esac
if output=$(sh "$scanner" diff 2>&1); then
  echo "FAIL diff accepted a vector appended inside a high-similarity rename"
  exit 1
fi
[[ $output == *'[REDACTED matching content]'* ]]
echo "PASS diff refuses a vector appended inside a high-similarity rename"
# Control (order 91c72e99): low-similarity rename = A+D - stays blocked.
git reset -q --hard HEAD
git mv carry.txt lowsim.txt
printf 'totally different payload %s\n' "$vector3" > lowsim.txt
git add -A
if output=$(sh "$scanner" diff 2>&1); then
  echo "FAIL low-similarity rename (A+D) accepted a vector"
  exit 1
fi
echo "PASS low-similarity rename (A+D) still blocks"
git reset -q --hard HEAD

# SS-3 contract (2026-09-20, bee-laborer order): the count must parse as a
# number - empty or non-numeric is a refusal (exit 2), never a clean. The
# missing-tool class (grep/wc absent from PATH) produces exactly this shape:
# the substitution emits empty while every rc stays 0. Reproduced WITHOUT
# stripping PATH (environment-dependent) by neutralizing the count emission
# in a copy of the script - `cat >/dev/null` swallows the stream exactly
# like a missing tool. Runs on any CI runner.
cleanroot=$(mktemp -d /tmp/bnr-secret-scan-count.XXXXXXXX)
git init -q "$cleanroot"
cd "$cleanroot"
printf 'benign line\n' > ok.txt
git add -- ok.txt
broken="$test_root/scanner-count-broken.sh"
sed -e 's/grep -c \./cat >\/dev\/null/' -e 's/wc -l/cat >\/dev\/null/' "$scanner" > "$broken"
for mode in diff tree; do
  status=0
  output=$(sh "$broken" "$mode" 2>&1) || status=$?
  if [ "$status" -ne 2 ]; then echo "FAIL $mode count guard: expected exit 2 on an empty count, got $status"; exit 1; fi
  [[ $output == *'REFUSING'* ]]
  echo "PASS $mode refuses a non-numeric count with exit 2 (SS-3 contract)"
done
# Control: the UNBROKEN scanner on the same fixture cleans with the numeric
# count visible (1 added line / 1 tracked file) - the refusal is not vacuous.
for mode in diff tree; do
  output=$(sh "$scanner" "$mode" 2>&1) || { echo "FAIL $mode clean fixture should pass: [$output]"; exit 1; }
  [[ $output == *', 1 '* ]] || { echo "FAIL $mode clean fixture count not numeric-1: [$output]"; exit 1; }
  echo "PASS $mode clean fixture counts exactly 1"
done
rm -rf -- "$cleanroot"
