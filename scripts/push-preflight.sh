#!/bin/sh
# push-preflight.sh — the safety checks a seat runs on its OWN delta before
# pushing its OWN lane.
#
# WHY THIS EXISTS: lane pushes are now per-seat and continuous (standing order,
# 2026-08-25). A one-time preservation push protects the moment it happened, not
# the work that lands after it. But lane commits had never been public before,
# so every lane push now publishes material that was previously local-only —
# and it is public the instant it lands, not when someone reviews it.
#
# THIS IS DETECTION BEFORE PUBLICATION, NOT PREVENTION. It is skippable, and
# CI re-scans on push. Never call this layer "enforced".
#
# FAILS CLOSED: if a range cannot be COMPUTED it exits non-zero. A base that
# does not resolve is "could not determine", never "nothing to check" — the
# same law scripts/identity-check.sh states for the §7 range.
#
# DOT LAW (mechanism named by zB, 2026-08-25) — the two are NOT interchangeable:
#   git log  main..lane    TWO dots   — commit LISTS
#   git diff main...lane   THREE dots — DIFFS and SCANS
# A two-dot DIFF compares TIPS, so once main advances it renders main's new
# content as deletions inside "your" delta. That is the phantom zC chased:
# 8 hex runs and secret-scan hits that belonged to other seats. Three-dot
# diffs from the merge-base and shows only your work. This script uses two
# dots for every log/rev-list and three dots for every diff.
#
# Usage:  sh scripts/push-preflight.sh [base-ref]     (default: origin/main)
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
BASE_REF=${1:-origin/main}

if ! git rev-parse --verify -q "$BASE_REF" >/dev/null; then
  echo "PREFLIGHT FAIL — base ref '$BASE_REF' does not resolve. Cannot compute a"
  echo "  delta, so this is 'unknown', not 'clean'. Fetch first."
  exit 1
fi
BASE=$(git merge-base "$BASE_REF" HEAD) || { echo "PREFLIGHT FAIL — no merge-base"; exit 1; }

N=$(git rev-list --count "$BASE"..HEAD)
FILES=$(git diff --name-only "$BASE_REF"...HEAD | grep -c . || true)
echo "PREFLIGHT  base=$BASE_REF ($(git rev-parse --short "$BASE"))  commits=$N  files=$FILES"

# ── SUBJECT ASSERTION — run BEFORE any scanning ─────────────────────
# A scan whose subject you have not confirmed is not a scan of your work.
# With an EMPTY delta the reverse diff shows MAIN'S new content from other
# seats as though it were yours — zC nearly filed a peer's commits as a
# finding on its own lane that way. Direction is base..HEAD, never HEAD..base.
echo ""
echo "SUBJECT — these are the commits about to be scanned ($BASE_REF..HEAD):"
if [ "$N" -eq 0 ]; then
  echo "  (none)"
  echo ""
  echo "DELTA EMPTY — NOT SCANNING. There is nothing of yours to preserve here."
  echo "  Reporting 'clean' now would mean reporting on a scan that never ran."
  echo "  Push the ref if you like; do not claim a check."
  exit 0
fi
git log --format='  %h  %cn  %s' "$BASE"..HEAD | cut -c1-100
# Committers present, listed rather than classified. Do NOT auto-guess the
# seat label: falling back to git config user.name marks your OWN commits
# foreign, which is a false signal inside the check that exists to prevent
# false findings. Export GIT_COMMITTER_NAME (or SEAT=) to get the comparison.
echo "  committers in range: $(git log --format='%cn' "$BASE"..HEAD | sort -u | tr '
' ' ')"
SEAT=${SEAT:-${GIT_COMMITTER_NAME:-}}
if [ -z "$SEAT" ]; then
  echo "    (seat label unset — not classifying. READ the list above: merge"
  echo "     commits from main are expected, peer LANE commits mean a wrong base.)"
else
  FOREIGN=$(git log --format='%cn' "$BASE"..HEAD | grep -vxF "$SEAT" | sort -u | tr '
' ' ')
  [ -n "$FOREIGN" ] && echo "    not committed by '$SEAT': $FOREIGN  (merges from main are expected)"
fi
echo "  direction: $BASE_REF..HEAD (base -> lane). Never lane -> base."

# This file necessarily CONTAINS the patterns it hunts (PVT_K1_, the PEM form,
# the word "secret"). Excluded from the ADDED-lines checks BY NAME — check 1
# still scans it as part of the whole tree, so coverage is not lost.
SELF=scripts/push-preflight.sh
ADDED=$(git diff "$BASE_REF"...HEAD -- . ":(exclude)$SELF" | grep '^+' | grep -v '^+++')
rc=0

echo ""
echo "1) secret scan over the tree"
if sh scripts/secret-scan.sh tree >/tmp/pf_1 2>&1; then
  echo "   ok"
else
  echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_1; rc=1
fi

# PEM pattern uses the estate bracket trick (see scripts/secret-scan.sh:55):
# KE[Y] so this detector never matches its own source.
echo "2) private-key material on added lines"
printf '%s\n' "$ADDED" | grep -nE 'PVT_K1_|xprv|BEGIN .*PRIVATE KE[Y]|\b5[HJK][1-9A-HJ-NP-Za-km-z]{48}\b' >/tmp/pf_2
n=$(grep -c . /tmp/pf_2 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 matches"; else echo "   BLOCKED — $n match(es):"; head -5 /tmp/pf_2 | sed 's/^/     /'; rc=1; fi

echo "3) 64-hex strings on added lines (each must be accounted for)"
printf '%s\n' "$ADDED" | grep -oE '[0-9a-fA-F]{64}' | sort -u >/tmp/pf_3
n=$(grep -c . /tmp/pf_3 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 present"
else
  echo "   $n distinct — ACCOUNT FOR EACH (a Cargo.lock checksum and a leaked key look identical):"
  while read -r h; do
    printf '     %s…  %s\n' "$(printf '%s' "$h" | cut -c1-16)" \
      "$(printf '%s\n' "$ADDED" | grep -F "$h" | head -1 | cut -c1-80)"
  done < /tmp/pf_3
fi

echo "4) credential words on added lines"
printf '%s\n' "$ADDED" | grep -inE 'password|passphrase|secret|api[_-]?key|token|credential' >/tmp/pf_4
n=$(grep -c . /tmp/pf_4 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 hits"
else echo "   $n hit(s) — confirm each is PROSE, not a value:"; head -6 /tmp/pf_4 | cut -c1-100 | sed 's/^/     /'; fi

echo "5) credential-shaped files in the delta"
git diff --name-only "$BASE_REF"...HEAD | grep -iE 'DO_NOT_COMMIT|(^|/)\.env|credential|\.pem$|\.key$' >/tmp/pf_5
n=$(grep -c . /tmp/pf_5 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_5; rc=1; fi

echo "6) @-handles on added lines (public or fictional only)"
printf '%s\n' "$ADDED" | grep -oE '@[A-Za-z][A-Za-z0-9_.-]{2,}' | sort -u >/tmp/pf_6
n=$(grep -c . /tmp/pf_6 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   $n distinct:"; head -8 /tmp/pf_6 | tr '\n' ' ' | sed 's/^/     /'; echo ""; fi

echo ""
if [ "$rc" -ne 0 ]; then echo "PREFLIGHT BLOCKED — do not push."; else
  echo "PREFLIGHT ok — checks 3, 4 and 6 are JUDGEMENT items: read them, do not"
  echo "  just note they printed. Then: git push origin HEAD:<your lane>"
fi
exit $rc
