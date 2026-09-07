#!/usr/bin/env bash
set -euo pipefail
scanner=$(cd "$(dirname "$0")/../scripts" && pwd)/secret-scan.sh
test_root=$(mktemp -d /tmp/bnr-secret-scan-test.XXXXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
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
