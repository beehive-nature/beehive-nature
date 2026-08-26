#!/bin/sh
# bump-rider.sh — bump a rider's ?v= cache key across the estate, WITHOUT
# touching frozen art.
#
# WHY THIS EXISTS. On 2026-08-26 a hand-rolled sweep
#     perl -pi -e 's/tour\.js\?v=22/tour.js?v=23/g' surfaces/*.html surfaces/*/*.html
# rewrote every surface — including surfaces/forge/orbit.html, which is
# byte-pinned founder-approved art. CI went red on that push and stayed red for
# fifteen more, because the seat doing the pushing was running the gates it had
# chosen instead of the gates the repo runs.
#
# The cache law and the freeze both stand; where they meet, THE FREEZE WINS and
# the frozen file keeps its older key. A ?v= is only a cache key on the same
# file, so a frozen page still loads the current rider — it just may serve a
# previously cached copy to a returning visitor. That is the price of a freeze,
# and it is the founder's to change, not this script's.
#
# Usage:  sh scripts/bump-rider.sh tour.js 22 23
#         sh scripts/bump-rider.sh rails-badge.js 3 4
set -eu

RIDER="${1:?usage: bump-rider.sh <rider.js> <from> <to>}"
FROM="${2:?}"
TO="${3:?}"

cd "$(dirname "$0")/.."

# every file the freeze protects — read from the gate itself so the two can
# never disagree about what is frozen
FROZEN=$(grep -oE "const FROZEN = '[^']+'" e2e/forge-freeze.mjs | sed "s/.*'\(.*\)'/\1/")
[ -n "$FROZEN" ] || { echo "bump-rider: cannot read the frozen path from e2e/forge-freeze.mjs" >&2; exit 1; }

changed=0
skipped=0
for f in $(find surfaces -name '*.html' | sort); do
  case "$f" in
    "$FROZEN")
      if grep -q "$RIDER?v=$FROM" "$f"; then
        echo "  FROZEN, left alone: $f (keeps $RIDER?v=$FROM)"
        skipped=$((skipped + 1))
      fi
      continue
      ;;
  esac
  if grep -q "$RIDER?v=$FROM" "$f"; then
    perl -pi -e "s/\Q$RIDER?v=$FROM\E/$RIDER?v=$TO/g" "$f"
    changed=$((changed + 1))
  fi
done

echo "bump-rider: $RIDER ?v=$FROM -> ?v=$TO on $changed file(s); $skipped frozen file(s) left alone"

# prove the freeze still holds before anyone commits
node e2e/forge-freeze.mjs
