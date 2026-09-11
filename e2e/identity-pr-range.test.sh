#!/usr/bin/env bash
# Check actual contribution identities even when HEAD is a platform-generated
# merge. A malformed or unavailable head still fails; no policy exemption.
set -euo pipefail
gate=$(cd "$(dirname "$0")/../scripts" && pwd)/identity-check.sh
test_root=$(mktemp -d /tmp/bnr-identity-pr-test.XXXXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
unset S7_RANGE S7_STAGED S7_MSG_FILE S7_BEFORE S7_SHA
git init -q "$test_root"
cd "$test_root"
git config core.hooksPath /dev/null
export GIT_AUTHOR_NAME='loVis waTer' GIT_AUTHOR_EMAIL='loviswater44@gmail.com'
export GIT_COMMITTER_NAME='Codex (Astra)' GIT_COMMITTER_EMAIL='noreply@openai.com'
git -c commit.gpgsign=false commit -q --allow-empty -m 'base'
base=$(git rev-parse HEAD)
git checkout -q -b contribution
git -c commit.gpgsign=false commit -q --allow-empty -m 'valid contribution' -m 'Co-authored-by: Codex (Astra) <noreply@openai.com>'
head=$(git rev-parse HEAD)
git checkout -q --detach "$base"
GIT_AUTHOR_NAME='Synthetic merge' GIT_AUTHOR_EMAIL='merge@example.invalid' \
  git -c commit.gpgsign=false merge -q --no-ff --no-edit contribution

if ! S7_BEFORE="$base" S7_SHA="$head" sh "$gate" > "$test_root/output" 2>&1; then
  echo 'FAIL valid contribution rejected under synthetic merge checkout'; exit 1
fi
echo 'PASS valid PR contribution checked independently of merge identity'
if S7_BEFORE="$base" S7_SHA=HEAD sh "$gate" > "$test_root/output" 2>&1; then
  echo 'FAIL synthetic merge unexpectedly satisfied contributor policy'; exit 1
fi
git checkout -q contribution
GIT_AUTHOR_NAME='Invalid contributor' GIT_AUTHOR_EMAIL='invalid@example.invalid' \
  git -c commit.gpgsign=false commit -q --allow-empty -m 'invalid contribution'
if S7_BEFORE="$base" S7_SHA=HEAD sh "$gate" > "$test_root/output" 2>&1; then
  echo 'FAIL invalid contributed author passed'; exit 1
fi
echo 'PASS contributed author violation still refused'
if S7_BEFORE="$base" S7_SHA=missing-ref sh "$gate" > "$test_root/output" 2>&1; then
  echo 'FAIL missing PR head passed'; exit 1
fi
echo 'PASS unavailable head fails closed'
