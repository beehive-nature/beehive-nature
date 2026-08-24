#!/bin/sh
# lint-shell-chains.sh — the && short-circuit, made enforceable.
#
# THE BUG, 5 times across 3 seats this sprint:
#     ... | grep -c foo file && echo "next"
# `grep -c` EMITS A COUNT and exits 1 on ZERO matches. A count of 0 is DATA,
# not a failure — so a legitimate zero silently kills the rest of the chain and
# the later commands never run. That is how a check reports "clean" when it
# never actually looked.
#
# ONLY -c, NEVER -q. `grep -q x && act` is boolean BY DESIGN and correct.
# Measured over 3,765 real shell invocations from this box: `-q &&` fires 66
# times (1.75%), all legitimate; `-c &&` fires 25 (0.66%), overwhelmingly real
# bugs. Firing on -q would warn on correct usage and train dismissal — the
# same decay that makes an unreviewed PUBLIC-CONSTANT worthless.
#
# NOT LINTED, deliberately: `VAR=$(cmd) && echo "$VAR"`. It looks like the same
# bug and sometimes is, but measured on the same corpus it fires 6 times, of
# which 4 are legitimate gating (`NEW=$(git rev-parse HEAD) && ... && git push`
# — you WANT that to stop). False positives dominate 4:1, so it stays out.
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

PAT='grep[^|;&]*[[:space:]]-[a-zA-Z]*c[a-zA-Z]*[[:space:]][^|;&]*&&'
hits=0
scanned=0

for f in $FILES; do
  [ -f "$f" ] || continue
  case "$f" in *.md|*.json|*.mjs|*.js) continue;; esac
  # This file necessarily CONTAINS the pattern it hunts, in its own docs and in
  # the regex itself. Excluded BY NAME rather than by a blanket rule, so a real
  # chain bug in any other script still fails the build.
  case "$f" in */lint-shell-chains.sh) continue;; esac
  head -1 "$f" 2>/dev/null | grep -q '^#!.*\(sh\|bash\)' || case "$f" in *.sh) ;; *) continue;; esac
  scanned=$((scanned + 1))

  found=$(grep -nE "$PAT" "$f" 2>/dev/null)
  if [ -n "$found" ]; then
    printf '%s\n' "$found" | while IFS= read -r l; do
      printf '%s:%s\n' "$f" "$l"
      printf '    grep -c chained with && — zero matches exits 1 and kills the chain.\n'
      printf '    A count of 0 is a RESULT, not a failure. Sequence with `;` instead.\n'
    done
    n=$(printf '%s\n' "$found" | grep -c '')
    hits=$((hits + n))
  fi
done

printf '\nscanned %s shell file(s)\n' "$scanned"
if [ "$hits" -gt 0 ]; then
  printf 'SHELL-CHAIN LINT: %s suspect chain(s) — see above.\n' "$hits"
  exit 1
fi
printf 'SHELL-CHAIN LINT ok — no grep -c short-circuit in tracked shell.\n'
exit 0
