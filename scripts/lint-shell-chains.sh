#!/bin/sh
# lint-shell-chains.sh — the && short-circuit, made enforceable.
#
# THE BUG, twice this sprint and 4 times across 3 seats:
#   out=$(node gate.mjs 2>&1) && echo "$out" | grep FAIL
# When the command exits non-zero — which for a GATE is the expected,
# interesting case — && short-circuits and the diagnostic never prints. The
# run looks silent instead of failing, and a probe that cannot print its own
# failure reports every mutation as "survived".
#
#   ... && grep -c foo file && echo "next"
# `grep -c` exits 1 on ZERO matches, so a legitimate count of 0 kills the rest
# of the chain and the later commands silently never run.
#
# Both patterns are precise enough to flag mechanically. Reporting/diagnostic
# steps must be sequenced with `;` (or the exit captured explicitly), never
# chained behind && after a command whose failure is meaningful.
#
# Usage: sh scripts/lint-shell-chains.sh [paths…]   (default: tracked shell)
set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)
cd "$ROOT" || exit 1

if [ $# -gt 0 ]; then
  FILES=$*
else
  FILES=$(git ls-files '*.sh' '.githooks/*' 'scripts/*' 2>/dev/null | sort -u)
fi

hits=0
scanned=0

for f in $FILES; do
  [ -f "$f" ] || continue
  case "$f" in *.md|*.json|*.mjs|*.js) continue;; esac
  head -1 "$f" 2>/dev/null | grep -q '^#!.*\(sh\|bash\)' || case "$f" in *.sh) ;; *) continue;; esac
  scanned=$((scanned + 1))

  # A · command substitution assigned, then chained with && on the same line
  grep -nE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=\$\(.*\)[[:space:]]*&&' "$f" 2>/dev/null | while IFS= read -r l; do
    printf '%s:%s\n    A · $(...) assigned then chained with && — a non-zero exit silently skips the rest.\n      Use `;` and check the status explicitly.\n' "$f" "$l"
  done | { out=$(cat); [ -n "$out" ] && { printf '%s\n' "$out"; }; }
  a=$(grep -cE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=\$\(.*\)[[:space:]]*&&' "$f" 2>/dev/null)
  hits=$((hits + a))

  # B · grep -c / -q chained with && — exits 1 on zero matches, which is data
  grep -nE 'grep[^|;]*-[a-zA-Z]*[cq][^|;]*&&' "$f" 2>/dev/null | while IFS= read -r l; do
    printf '%s:%s\n    B · grep -c/-q chained with && — zero matches exits 1 and kills the chain.\n      A count of 0 is a RESULT, not a failure. Sequence with `;`.\n' "$f" "$l"
  done
  b=$(grep -cE 'grep[^|;]*-[a-zA-Z]*[cq][^|;]*&&' "$f" 2>/dev/null)
  hits=$((hits + b))
done

printf '\nscanned %s shell file(s)\n' "$scanned"
if [ "$hits" -gt 0 ]; then
  printf 'SHELL-CHAIN LINT: %s suspect chain(s) — see above.\n' "$hits"
  exit 1
fi
printf 'SHELL-CHAIN LINT ok — no && short-circuit patterns in tracked shell.\n'
exit 0
