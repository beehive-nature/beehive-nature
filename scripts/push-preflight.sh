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
# THE FOOTGUN — the dot count that means "only mine" is INVERTED between the
# two commands. This is the whole trap; memorising "three dots" or "two dots"
# as a single rule guarantees getting one of them wrong:
#
#   git log  main..lane     TWO dots    commits that are yours              OK
#   git diff main..lane     TWO dots    diff of TIPS — peer work rides in   WRONG
#                                       REVERSED (their adds show as -,
#                                       their deletes show as +)
#   git diff main...lane    THREE dots  merge-base to lane, only yours      OK
#
# Reproduced here, not taken on report (Cowork ran it with planted secrets):
#   CASE A  two-dot surfaces a peer's content inside "your" delta.
#   CASE B  worse — with an EMPTY subject (git log base..subject returns
#           NOTHING), the two-dot diff STILL emits the peer's content. Measured
#           against origin/lane/zB: subject 0 commits, two-dot 5 files / 12
#           added lines of zB's work, three-dot 0 files. A seat with no work at
#           all can file a security finding about someone else's code.
#
# SIGN INVERSION, and why a wrong-dot finding is UNFALSIFIABLE:
# a reversed two-dot diff also inverts the signs — peer ADDITIONS appear as
# deletions, peer DELETIONS appear as additions. This scan reads ^+ lines, so a
# secret surfaced that way is one a peer had ALREADY REMOVED. The finding is
# wrong about the OWNER and about the TENSE. You then grep the tree, do not find
# it, and cannot tell "false alarm" from "someone hid it" — and you may have
# cost a peer a rotation they already performed.
#   RULE: a scan hit you cannot locate in the working tree means CHECK YOUR DOT
#   COUNT BEFORE YOU ESCALATE. The locate() helper below does this for you and
#   says so in the output, so the rule fires when you are looking at a hit
#   rather than sitting in a header nobody re-reads.
#
# SCOPE: secret-scan.sh in TREE mode has no direction and is immune. This
# applies to the DELTA scan below only.
#
# Usage:  sh scripts/push-preflight.sh [base-ref]     (default: origin/main)
# locate() is defined HERE, ABOVE its callers. It previously sat further down
# and the selftest below called it before definition — sh returns "command not
# found" and the discriminator silently does nothing. The selftest caught that
# on its first run (P3/P4 reported "the discriminator is dead"), which is the
# fail-CLOSED behaviour this file exists to have. Same defect class the S7
# header records: helpers defined after their callers.
# Is this token actually IN the working tree? A hit that is not tells you the
# scan direction is wrong far more often than it tells you a secret is hiding.
locate() {
  if git grep -qF -- "$1" -- . 2>/dev/null; then
    echo "       present in the working tree — treat as a REAL hit."
  else
    echo "       NOT PRESENT in the working tree."
    echo "       >> CHECK YOUR DOT COUNT BEFORE ESCALATING. A two-dot diff inverts"
    echo "          signs: this may be a PEER'S line that was ALREADY REMOVED,"
    echo "          surfaced as an addition in a delta that is not yours. Escalating"
    echo "          it can cost someone a rotation they have already done."
  fi
}


# ---- SELFTEST ------------------------------------------------------------
# LAW (founder, 2026-08-25): a checker is not LANDED until it has been run
# against a KNOWN-BAD and a KNOWN-GOOD, and BOTH results appear in its report.
# A green from an unvalidated checker is a claim about the checker, not the code.
#
#   P1 known-BAD   unresolvable base ref  -> MUST exit 1 ("unknown", not "clean")
#   P2 known-GOOD  empty subject          -> MUST exit 0, run ZERO checks, claim nothing
#   P3 known-BAD   token absent from tree -> locate() MUST raise the dot-count warning
#   P4 known-GOOD  token present in tree  -> locate() MUST call it a real hit
if [ "${1:-}" = "--selftest" ]; then
  SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
  st=0
  echo "push-preflight selftest — known-BAD and known-GOOD:"
  sh "$SELF" refs/heads/__no_such_ref__ >/tmp/ps1 2>&1; r=$?
  if [ "$r" -ne 0 ] && grep -q "does not resolve" /tmp/ps1; then
    echo "  P1 known-BAD  unresolvable base -> exit $r, refused (correct)"
  else echo "  P1 known-BAD  unresolvable base -> exit $r WITHOUT refusing — fails OPEN"; st=1; fi
  sh "$SELF" HEAD >/tmp/ps2 2>&1; r=$?
  n=$(grep -c '^[1-6])' /tmp/ps2)
  if [ "$r" -eq 0 ] && [ "$n" -eq 0 ] && grep -q 'NOT SCANNING' /tmp/ps2; then
    echo "  P2 known-GOOD empty subject -> halted, $n checks ran, claims nothing (correct)"
  else echo "  P2 known-GOOD empty subject -> exit $r with $n checks run — scanned an unconfirmed subject"; st=1; fi
  # Built at RUNTIME from $$ so the literal never appears in this source —
  # a hardcoded "absent" token is present the moment you write the test, and
  # git grep finds it here. The fixture defeated itself on first run.
  ABSENT="PVT_K1_selftestAbsent$$"
  o=$(locate "$ABSENT")
  case "$o" in *"CHECK YOUR DOT COUNT"*) echo "  P3 known-BAD  absent token -> dot-count warning raised (correct)";;
                *) echo "  P3 known-BAD  absent token -> NO warning — the discriminator is dead"; st=1;; esac
  o=$(locate "PREFLIGHT ok")
  case "$o" in *"REAL hit"*) echo "  P4 known-GOOD present token -> called a real hit (correct)";;
                *) echo "  P4 known-GOOD present token -> misreported"; st=1;; esac
  rm -f /tmp/ps1 /tmp/ps2
  [ "$st" -eq 0 ] && echo "selftest ok — refuses what it must, permits what it must."                    || echo "selftest FAIL — see above."
  exit $st
fi

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
if [ "$n" -eq 0 ]; then echo "   ok — 0 matches"; else
  echo "   BLOCKED — $n match(es):"; head -5 /tmp/pf_2 | sed 's/^/     /'
  printf '%s
' "$ADDED" | grep -oE 'PVT_K1_[A-Za-z0-9]+|xprv[A-Za-z0-9]+' | sort -u | while read -r t; do
    printf '     token %s…
' "$(printf '%s' "$t" | cut -c1-24)"; locate "$t"; done
  rc=1; fi

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
