#!/bin/sh
# identity-check.sh — §7 identity check on the PUSHED range.
#
# STATUS: DETECTED, NOT ENFORCED. Actions on push run AFTER the commits reach
# origin — a violation is already public when this step goes red. Prevention
# needs branch protection + PR-only merges; that is the founder's call. The
# local pre-commit hook is ADVISORY ONLY and must never be called "enforced"
# on its own — a seat that skips core.hooksPath sees no local check at all.
#
# §7 shape: the AUTHOR of every commit is the founder (env-only: seats export
# GIT_AUTHOR_NAME/EMAIL as the founder). A seat self-identifies by exporting
# GIT_COMMITTER_NAME/EMAIL as ITSELF, making author != committer — and exactly
# those commits HARD-REQUIRE a Co-authored-by trailer. Founder-typed commits
# (author == committer) are unaffected.
#
# RANGE RESOLUTION — the push trap this script exists to avoid: on a push
# event, origin/main ALREADY POINTS AT THE PUSHED SHA when CI checks out, so
# "origin/main..HEAD" is empty BY CONSTRUCTION and a check over it reads zero
# commits — a no-op dressed as green (founder-caught 2026-08-24: "your check
# catches real violations and is a NO-OP on main"). Therefore:
#   1. CI passes S7_BEFORE (github.event.before) and S7_SHA (github.sha);
#      the range is before..sha — exactly what the push added.
#   2. All-zeros before (new branch) falls back to checking HEAD — never to
#      passing.
#   3. Anything that cannot be COMPUTED fails the check. GENERAL LAW: every
#      check fails closed when it cannot determine an answer. A missing base
#      sha, a range ref that does not resolve — those are NOT "empty", they
#      are "could not compute", and they exit 1. Only a computed range that
#      genuinely contains zero commits passes (loudly).
#
# Local runs may override: S7_RANGE="a..b" sh scripts/identity-check.sh
#
# STAGED MODE (the local pre-commit/commit-msg entry point): S7_STAGED=1 checks
# the commit IN PROGRESS instead of a range — author/committer come from
# `git var` (exactly the idents the upcoming commit will use), and the trailer
# clause is checked against the message file (S7_MSG_FILE, provided by the
# commit-msg hook; pre-commit runs before a message exists, so it validates
# identity and defers the trailer half). Same §7 shape, same fail-closed law,
# one implementation for CI and hooks so they cannot drift. STATUS UNCHANGED:
# this is DETECTION BEFORE PUBLICATION — hooks are --no-verify-able, CI re-scans
# on push. Never call this layer prevention.
set -u

FOUNDER_NAME="loVis waTer"
FOUNDER_EMAIL="loviswater44@gmail.com"

say() { echo "§7: $*"; }
die() { echo "§7 FAIL — $*"; echo "§7 FAIL — this check fails closed when it cannot determine an answer."; exit 1; }

if [ -n "${S7_STAGED:-}" ]; then
  say "staged mode — checking the commit in progress (detection before handoff; --no-verify-able, never prevention)"

  ident=$(git var GIT_AUTHOR_IDENT 2>/dev/null) || die "git var GIT_AUTHOR_IDENT unreadable"
  an=$(printf '%s\n' "$ident" | sed -n 's/^\(.*\) <\([^>]*\)>.*$/\1/p')
  ae=$(printf '%s\n' "$ident" | sed -n 's/^\(.*\) <\([^>]*\)>.*$/\2/p')
  cident=$(git var GIT_COMMITTER_IDENT 2>/dev/null) || die "git var GIT_COMMITTER_IDENT unreadable"
  cn=$(printf '%s\n' "$cident" | sed -n 's/^\(.*\) <\([^>]*\)>.*$/\1/p')
  ce=$(printf '%s\n' "$cident" | sed -n 's/^\(.*\) <\([^>]*\)>.*$/\2/p')

  [ "$an" = "$FOUNDER_NAME" ] && [ "$ae" = "$FOUNDER_EMAIL" ] \
    || die "author of the upcoming commit is '$an <$ae>', not the founder — export GIT_AUTHOR_NAME/GIT_AUTHOR_EMAIL as the founder (seats are committers + trailers, never authors)"

  if [ "$cn" != "$FOUNDER_NAME" ] || [ "$ce" != "$FOUNDER_EMAIL" ]; then
    if [ -n "${S7_MSG_FILE:-}" ] && [ -f "${S7_MSG_FILE:-}" ]; then
      # git's OWN trailer parser — the same semantics %(trailers:key=…) uses in
      # the range check below. A Co-authored-by line that sits in the body is
      # invisible to it, which is exactly the three-time mistake this catches.
      trailers=$(git interpret-trailers --parse < "$S7_MSG_FILE" 2>/dev/null | grep -c '^Co-authored-by:' || true)
      [ "$trailers" -ge 1 ] \
        || die "seat-typed commit (committer '$cn <$ce>') with no PARSED Co-authored-by trailer — a trailer buried in the body does not count; it must be the final block of the message"
      say "ok — founder-authored · seat-committed by '$cn' · Co-authored-by trailer parsed: $trailers"
    else
      say "ok — founder-authored · seat-committed by '$cn' · trailer check deferred to the commit-msg hook (no message yet at pre-commit time)"
    fi
  else
    say "ok — founder-typed (author == committer) · trailer clause does not apply"
  fi
  exit 0
fi

resolve_commit() {
  git rev-parse -q --verify "$1^{commit}" 2>/dev/null
}

# ---- determine the range (order: explicit override, push event, ref-derived)
if [ -n "${S7_RANGE:-}" ]; then
  RANGE="$S7_RANGE"
  say "range from S7_RANGE override: $RANGE"
elif [ -n "${S7_BEFORE:-}" ]; then
  # Push event. github.event.before = the ref's previous tip; github.sha = now.
  case "$S7_BEFORE" in
    *[!0]*)
      base=$(resolve_commit "$S7_BEFORE") \
        || die "push range cannot be computed — before '$S7_BEFORE' does not resolve in this checkout"
      tip=$(resolve_commit "${S7_SHA:-HEAD}") \
        || die "push range cannot be computed — sha '${S7_SHA:-HEAD}' does not resolve"
      RANGE="$base..$tip"
      say "push range: $RANGE ($S7_BEFORE..${S7_SHA:-HEAD})"
      ;;
    *)
      # all zeros: brand-new branch/ref — the push's content is its tip.
      # (A set-but-EMPTY S7_BEFORE cannot reach here: -n "" is false above,
      # so pull_request events — where before is empty — take the
      # ref-derived path below, which is correct for them.)
      tip=$(resolve_commit "${S7_SHA:-HEAD}") \
        || die "new-branch fallback cannot resolve '${S7_SHA:-HEAD}'"
      RANGE="-1 $tip"
      say "new branch (before is all zeros): checking the pushed tip only"
      ;;
  esac
else
  # Non-push contexts (pull_request, local): the pushed-sha trap does not
  # apply, origin/main has not moved to the merge head. Fail closed if absent.
  if git rev-parse -q --verify origin/main >/dev/null 2>&1; then
    RANGE="origin/main..HEAD"
    say "no push event: range from origin/main..HEAD"
  else
    die "no push event and no origin/main ref — the range cannot be computed"
  fi
fi

# ---- count the range (a failure here is also could-not-compute)
count=$(git log --format='%H' $RANGE 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" = "0" ]; then
  # Computed-empty is a DETERMINED answer: zero commits in range. Pass loudly.
  say "ok — computed range ($RANGE) contains 0 commits; nothing to check"
  exit 0
fi
say "checking $count commit(s) in $RANGE"

status=0
while IFS='|' read -r commit an ae cn ce; do
  [ -z "$commit" ] && continue

  # Author is ALWAYS the founder — no exceptions, seat-typed or founder-typed.
  if [ "$an" != "$FOUNDER_NAME" ] || [ "$ae" != "$FOUNDER_EMAIL" ]; then
    echo "FAIL §7 $commit — author is '$an <$ae>', not the founder (seats are committers + trailers, never authors)"
    status=1
    continue
  fi

  trailers=$(git show -s --format='%(trailers:key=Co-authored-by)' "$commit" | grep -c 'Co-authored-by' || true)

  # A seat self-identifies by committer != founder: exactly those commits
  # hard-require a Co-authored-by trailer. Founder-typed commits (author ==
  # committer) are unaffected by §7's trailer clause.
  if [ "$cn" != "$FOUNDER_NAME" ] || [ "$ce" != "$FOUNDER_EMAIL" ]; then
    if [ "$trailers" -lt 1 ]; then
      echo "FAIL §7 $commit — seat-typed (committer '$cn <$ce>') without a Co-authored-by trailer; credit the seat in the commit"
      status=1
      continue
    fi
    echo "ok   §7 $commit — founder-authored · seat-committed by '$cn' · Co-authored-by trailers: $trailers"
  else
    echo "ok   §7 $commit — founder-typed (author == committer) · Co-authored-by trailers: $trailers"
  fi
done <<EOF
$(git log --format='%H|%an|%ae|%cn|%ce' $RANGE)
EOF

if [ "$status" -ne 0 ]; then
  echo "§7 FAIL — the range does not satisfy §7."
fi
exit "$status"
