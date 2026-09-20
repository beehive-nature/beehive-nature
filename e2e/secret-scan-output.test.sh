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
