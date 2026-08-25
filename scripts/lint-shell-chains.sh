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
# ---- SELFTEST ------------------------------------------------------------
# LAW (founder, 2026-08-25): a checker is not LANDED until it has been run
# against a KNOWN-BAD and a KNOWN-GOOD, and BOTH results appear in its report.
# A green from an unvalidated checker is a claim about the checker, not the code.
#
# This lint has already failed that bar once: an earlier draft matched -[cq] and
# would have fired on 66 legitimate `grep -q x && act` conditionals, and it
# flagged its own source. Neither was visible by reading it.
#
#   B1 known-BAD   grep -c chained with &&   -> MUST fail (exit 1) and name it
#   B2 known-GOOD  grep -q chained with &&   -> MUST pass (the -q regression guard)
#   B3 known-GOOD  no chain at all           -> MUST pass
if [ "${1:-}" = "--selftest" ]; then
  T=$(mktemp -d 2>/dev/null) || { echo "selftest FAIL — mktemp"; exit 1; }
  SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
  printf '#!/bin/sh
grep -c foo bar.txt && echo next
'   > "$T/bad.sh"
  printf '#!/bin/sh
grep -q foo bar.txt && echo found
'  > "$T/good_q.sh"
  printf '#!/bin/sh
echo hello
'                          > "$T/good_plain.sh"
  st=0
  echo "shell-chain lint selftest — one known-BAD, two known-GOOD:"
  sh "$SELF" "$T/bad.sh" >"$T/o1" 2>&1; r1=$?
  if [ "$r1" -ne 0 ] && grep -q 'grep -c chained' "$T/o1"; then
    echo "  B1 known-BAD  grep -c && ... -> CAUGHT (exit $r1, named)"
  else echo "  B1 known-BAD  NOT CAUGHT (exit $r1) — the lint is dead"; st=1; fi
  sh "$SELF" "$T/good_q.sh" >"$T/o2" 2>&1; r2=$?
  if [ "$r2" -eq 0 ]; then echo "  B2 known-GOOD grep -q && ... -> passed (exit 0)"
  else echo "  B2 known-GOOD grep -q FALSELY FLAGGED (exit $r2) — would train dismissal"; st=1; fi
  sh "$SELF" "$T/good_plain.sh" >"$T/o3" 2>&1; r3=$?
  if [ "$r3" -eq 0 ]; then echo "  B3 known-GOOD plain script  -> passed (exit 0)"
  else echo "  B3 known-GOOD FALSELY FLAGGED (exit $r3)"; st=1; fi
  rm -rf "$T"
  [ "$st" -eq 0 ] && echo "selftest ok — the lint can tell bad from good."                    || echo "selftest FAIL — a lint that cannot fail is not a lint."
  exit $st
fi

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
