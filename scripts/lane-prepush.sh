#!/bin/sh
# lane-prepush.sh — the four-check protocol, with its SUBJECT asserted first.
#
# AMENDMENT (zC finding, founder ruling 2026-08-24): zC's first run reported
# 8 hex runs and secret-scan hits that were MAIN'S NEW CONTENT from other
# seats, seen through the REVERSE diff because its delta was empty. It
# nearly filed a peer's work as a finding on its own lane.
#
# THE LAW THIS ENCODES: assert the subject, then trust the output — a scan
# whose subject you have not confirmed is not a scan of your work. And: an
# empty delta means there is NOTHING to preserve — no scan, and never a
# "clean" reported as if something had been checked.
#
# Structural guarantees, not remembered ones:
#   - the script composes main..<lane> itself; the caller cannot invert it
#   - the subject commits print BEFORE any scanner runs, so the operator
#     sees whose work is being scanned
#   - empty delta prints its emptiness and exits 0 WITHOUT scanning
#
# Usage: sh scripts/lane-prepush.sh lane/<yours>
set -u

LANE="${1:-}"
if [ -z "$LANE" ]; then
  echo "usage: sh scripts/lane-prepush.sh lane/<yours>"
  exit 2
fi
git rev-parse -q --verify "$LANE" >/dev/null 2>&1 \
  || { echo "PREPUSH FAIL — $LANE does not resolve in this checkout"; exit 1; }

DELTA=$(git log --oneline "main..$LANE" 2>/dev/null)
if [ -z "$DELTA" ]; then
  echo "EMPTY DELTA — main..$LANE contains zero commits."
  echo "Nothing to scan, nothing to preserve. Push the ref if you like;"
  echo "report the emptiness, never a clean."
  exit 0
fi

N=$(printf '%s\n' "$DELTA" | wc -l | tr -d ' ')
echo "subject asserted · $N commit(s) · direction main..$LANE (composed by this script — cannot be inverted):"
printf '  %s\n' $DELTA
echo

# ── THE DOT LAW (zB mechanism, founder amendment 2026-08-24) ────────────────
# TWO dots for commit LISTS (git log):    main..lane   — the subject above.
# THREE dots for DIFFS and scans:         main...lane  — from the merge-base.
# A two-dot DIFF compares TIPS: once main advances, main's new content renders
# as deletions in "your" delta — zC's phantom (a peer's hex runs and scan hits
# filed as lane findings). Structural here: this script never runs a lane
# diff, but any diff-based check added later MUST read the state below.
MB=$(git merge-base "main" "$LANE" 2>/dev/null)
MT=$(git rev-parse main 2>/dev/null)
if [ "$MB" = "$MT" ]; then
  echo "dot state · main is AT the merge-base — two-dot and three-dot diffs coincide; nothing armed."
else
  echo "dot state · main HAS MOVED past the merge-base — the two-dot trap is ARMED:"
  echo "  any diff over this lane MUST be three-dot (main...$LANE); two-dot would render main's new content as your deletions."
fi
echo

echo "1/4 secret-scan, tree mode (secrets + the 48-hex PUBLIC-CONSTANT law)"
sh scripts/secret-scan.sh tree || { echo "PREPUSH FAIL — secret-scan"; exit 1; }
echo "2/4 §7 identity on main..$LANE (its printed count must equal the asserted $N)"
S7_RANGE="main..$LANE" sh scripts/identity-check.sh || { echo "PREPUSH FAIL — §7"; exit 1; }
echo "3/4 shell-chain lint (the grep -c short-circuit law)"
sh scripts/lint-shell-chains.sh || { echo "PREPUSH FAIL — shell chains"; exit 1; }
echo "4/4 CI shape lint (always() on suites, static declares no needs)"
node scripts/lint-ci-shape.mjs || { echo "PREPUSH FAIL — CI shape"; exit 1; }

echo "FOUR CHECKS GREEN on $N asserted commit(s) — safe to push $LANE."
