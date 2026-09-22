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

# ---- GITHUB WEB-FLOW, the founder's own hand through GitHub's UI --------
#
# THE DEFECT THIS CLOSES (measured 2026-09-22 on main 85839cde, push run
# 35661322897): GitHub's merge button writes the merge commit with the
# PRESSING ACCOUNT as author and GitHub as committer. For this estate that
# is 'Travis Remington <111410861+loviswaternakamoto@users.noreply.github.com>'
# — the founder, under his GitHub identity, not the git identity §7 names.
# The check read that as "author is not the founder" and main's static job
# went red after EVERY web merge. An always-red gate trains dismissal: the
# next reader stops asking which row fell, and a real violation rides in
# under the noise. That is the same family as every other defect banked this
# sprint, and it is why this is a repair rather than a documented artifact.
#
# WHAT THE EXEMPTION IS PINNED ON, and why each half is load-bearing:
#   committer == 'GitHub <noreply@github.com>'  — the web-flow committer. A
#     seat's own commit never carries it; a seat commits as itself by rule.
#   author email == <FOUNDER_GH_ID>+<login>@users.noreply.github.com — the
#     NUMERIC GitHub account id, which is immutable. The login half is a
#     wildcard on purpose (a rename must not turn this gate red) and the
#     display NAME is not pinned at all (a profile edit must not either).
# Drop either half and the exemption stops meaning "the founder": committer
# alone would exempt every collaborator's web merge, author alone would
# exempt anything that merely types that address. Both halves are exercised
# by their own selftest arm below.
#
# WHAT IT IS NOT PINNED ON: the parent count. Measured in this estate's own
# checkouts the same day — REPOS/beehive-nature is shallow, and `git rev-list
# --parents -1 85839cde` returns the sha ALONE, no parents. A merge-ness test
# would be uncomputable there, and this file's law sends uncomputable to
# die(), i.e. straight back to red. A founder web-UI edit is the founder's
# hand too, so requiring a merge would buy nothing it could pay for.
#
# WHAT IT DOES NOT CLAIM: this is not signature verification. The exemption
# is sound by construction against a seat's ORDINARY commit — no seat types
# as GitHub — and it is not a cryptographic proof of origin. §7 is detection,
# stated at the top of this file, and this row does not raise that ceiling.
# STAGED MODE DOES NOT GET THIS EXEMPTION: a seat's commit in progress is
# never GitHub's, and an exemption reachable from a local commit is an
# instruction to forge one.
GH_WEBFLOW_NAME="GitHub"
GH_WEBFLOW_EMAIL="noreply@github.com"
FOUNDER_GH_ID="111410861"
GH_NOREPLY_DOMAIN="users.noreply.github.com"

# true when $1 is a noreply address minted by GitHub for the founder's account.
# The middle is checked for emptiness and for a stray '@' rather than left to a
# glob: "$FOUNDER_GH_ID+*@$GH_NOREPLY_DOMAIN" alone also matches
# '111410861+x@evil.example@users.noreply.github.com'.
is_founder_gh_noreply() {
  case "${1:-}" in
    "$FOUNDER_GH_ID"+*"@$GH_NOREPLY_DOMAIN") ;;
    *) return 1 ;;
  esac
  _mid=${1#"$FOUNDER_GH_ID"+}
  _mid=${_mid%"@$GH_NOREPLY_DOMAIN"}
  case "$_mid" in
    ''|*@*) return 1 ;;
  esac
  return 0
}

say() { echo "§7: $*"; }
die() { echo "§7 FAIL — $*"; echo "§7 FAIL — this check fails closed when it cannot determine an answer."; exit 1; }

# COUNTERS — the fail-open this file's own general law forbids, measured by
# bFUzZ on 2026-09-20 while judging #169: every counter here is produced by a
# pipeline ending in `grep -c` or `wc -l` and is captured with `|| true`, so a
# shell that cannot run that tool yields the EMPTY STRING. POSIX `[ "" -lt 1 ]`
# prints "integer expected" and returns 2; an `if` reads 2 as FALSE, the
# guarded clause is SKIPPED, and a seat-typed commit with no trailer at all
# prints "ok". Twenty-seven real violations scored ok that way in one local run.
# An empty or non-numeric counter is NOT zero — it is "could not compute", which
# line 25's law sends to die(), not to a comparison. Named hard error, same
# fail-closed form the scanner's WIF_RE got, and for the same reason.
require_count() { # $1 what it counts, $2 the captured value
  case "${2:-}" in
    ''|*[!0-9]*) die "$1 came back as '${2:-}', which is not a count — the tool that produces it did not answer (a shell without grep or wc does exactly this). A counter this check cannot compute is never read as zero." ;;
  esac
}

# ---- SELFTEST ------------------------------------------------------------
# A gate's success state is SILENCE — a passing hook and a broken hook look
# identical on a normal day. This enforcement layer failed OPEN twice tonight
# (2026-08-24) in two independent builds: an unreachable §7 line, and helpers
# defined after their callers (command-not-found exiting 0). The selftest runs
# the cases below — every one of them tells a working gate from a dead one —
# continuously in CI, so the next edit that reintroduces a fail-open goes red
# the same hour. No count is typed here: one was, and it drifted (T5 landed
# against a step still saying "four"). The rows print their own names:
#
#   T1 seat-as-author      → BLOCKED: exit ≠ 0, "§7 FAIL" in the output, zero commits
#   T2 trailer-in-body     → BLOCKED by commit-msg (a body line is not a trailer)
#   T3 correct shape       → CREATED: A=founder C=seat, trailer PARSED ≥ 1
#   T4 founder-typed       → CREATED: A == C, trailer clause not applicable
#
# STANDING LAW (founder, on accepting the hooks): two enforcers of one rule
# share the implementation, never agree by convention — hook and CI both run
# THIS file and git's own `interpret-trailers --parse`. This selftest is the
# third sharer: it exercises the same code both enforcers run.
#
# Mutation-receipt protocol learned the hard way: COMMIT the gate before
# breaking it — a `git checkout --` restore against uncommitted work restores
# the PRE-selftest gate and erases the test along with the defect.
if [ "${1:-}" = "--selftest" ]; then
  unset S7_STAGED S7_MSG_FILE S7_RANGE S7_BEFORE S7_SHA
  T=$(mktemp -d 2>/dev/null) || { echo "selftest FAIL — mktemp"; exit 1; }
  trap 'rm -rf "$T"' EXIT INT TERM
  SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")

  git init -q "$T/repo" && cd "$T/repo" || { echo "selftest FAIL — git init"; exit 1; }
  git config user.name "$FOUNDER_NAME"
  git config user.email "$FOUNDER_EMAIL"
  mkdir -p .githooks scripts
  cp "$SELF" scripts/identity-check.sh
  printf '#!/bin/sh\nS7_STAGED=1 sh scripts/identity-check.sh\n' > .githooks/pre-commit
  printf '#!/bin/sh\nS7_STAGED=1 S7_MSG_FILE="$1" exec sh scripts/identity-check.sh\n' > .githooks/commit-msg
  chmod +x .githooks/pre-commit .githooks/commit-msg
  git config core.hooksPath .githooks
  echo x > f.txt && git add f.txt

  st=0
  blocked() { # $1 desc — the commit under $@ must FAIL with a §7 FAIL and leave no commit
    desc=$1; shift
    out=$("$@" 2>&1); rc=$?
    n=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    if [ "$rc" -ne 0 ] && [ "$n" = "0" ] && printf '%s' "$out" | grep -q '§7 FAIL'; then
      echo "  PASS $desc — blocked, §7 FAIL printed, no commit created"
    else
      echo "  FAIL $desc — rc=$rc commits=$n out: $out"; st=1
    fi
  }
  created() { # $1 desc — the commit must succeed; $2 expected committer; $3 needs-trailer
    desc=$1; want_c=$2; want_trailer=$3; shift 3
    out=$("$@" 2>&1); rc=$?
    n=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    a=$(git log -1 --format='%an' 2>/dev/null); c=$(git log -1 --format='%cn' 2>/dev/null)
    tr=$(git log -1 --format='%(trailers:key=Co-authored-by)' 2>/dev/null | grep -ci 'co-authored-by' || true)
    # The rig's own counter, same shape as the gate's. It has always failed
    # CLOSED here, but BY ACCIDENT: an empty `tr` makes `[ "" -ge 1 ]` exit 2,
    # the && chain reads 2 as false, and the row reports FAIL. Correct outcome,
    # produced by operator order rather than by intent — one reordering and it
    # becomes a PASS. Named, so the closure is a decision. (Boundary: no row
    # exercises THIS line; a rig cannot witness itself. Stated, not papered.)
    case "$tr" in
      ''|*[!0-9]*)
        echo "  FAIL $desc — the rig's own trailer counter came back as '$tr', not a count; the tool that produces it did not answer, so this row judged nothing"; st=1
        tr=-1 ;;
    esac
    if [ "$rc" = "0" ] && [ "$n" -ge 1 ] && [ "$a" = "$FOUNDER_NAME" ] && [ "$c" = "$want_c" ] \
       && { [ "$want_trailer" = "no" ] || [ "$tr" -ge 1 ]; }; then
      echo "  PASS $desc — created A=$a C=$c trailer=$tr"
    else
      echo "  FAIL $desc — rc=$rc commits=$n A=$a C=$c trailer=$tr out: $out"; st=1
    fi
  }

  echo "§7 selftest — every case below, through the REAL hooks and a real range (throwaway repo, deleted after):"
  # every case pins its FULL ident env — the rig is hermetic against whatever
  # the caller exported (a caller's GIT_COMMITTER_* leaked into T4 once and
  # the gate CORRECTLY blocked what the rig mislabeled founder-typed)
  blocked "T1 seat-as-author is blocked" \
    env GIT_AUTHOR_NAME=bZiq GIT_AUTHOR_EMAIL=seat@x GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x \
    git commit -q -m "t1 seat as author"
  printf 't2 subject\n\nCo-authored-by: zCode <z@x>\n\na trailing paragraph pushes the line out of the trailer block\n' > "$T/msg"
  blocked "T2 trailer-in-body is blocked" \
    env GIT_AUTHOR_NAME="$FOUNDER_NAME" GIT_AUTHOR_EMAIL="$FOUNDER_EMAIL" \
        GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x git commit -q -F "$T/msg"
  printf 't3 subject\n\nCo-authored-by: zCode <z@x>\n' > "$T/msg3"
  created "T3 correct shape lands" bZiq yes \
    env GIT_AUTHOR_NAME="$FOUNDER_NAME" GIT_AUTHOR_EMAIL="$FOUNDER_EMAIL" \
        GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x git commit -q -F "$T/msg3"
  echo y >> f.txt && git add f.txt   # T4 needs something staged — an empty commit
                                     # dies on "nothing to commit" before any hook
                                     # runs, and the rig would read git's refusal
                                     # as the gate's verdict
  created "T4 founder-typed lands" "$FOUNDER_NAME" no \
    env GIT_AUTHOR_NAME="$FOUNDER_NAME" GIT_AUTHOR_EMAIL="$FOUNDER_EMAIL" \
        GIT_COMMITTER_NAME="$FOUNDER_NAME" GIT_COMMITTER_EMAIL="$FOUNDER_EMAIL" \
    git commit -q -m "t4 founder typed"
  echo z >> f.txt && git add f.txt
  printf 't5 subject\n\nCo-Authored-By: zCode <z@x>\n' > "$T/msg5"
  created "T5 mixed-case trailer lands (I-1: git trailer keys are case-insensitive; the gate must match git)" bZiq yes \
    env GIT_AUTHOR_NAME="$FOUNDER_NAME" GIT_AUTHOR_EMAIL="$FOUNDER_EMAIL" \
        GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x git commit -q -F "$T/msg5"
  # T6 — THE COUNTER CLAUSE, and the first row that runs the RANGE path at all.
  # T1-T5 above drive the staged/hook path; the loop that judges a pushed range
  # was never exercised by this selftest, which is why the fail-open lived there.
  # The row asserts WHICH thing it caught: the named counter error present, and
  # no "ok" line for that exact sha. Its fixture is committed with --no-verify
  # on purpose — the hook correctly refuses to create the violation the range
  # check must catch, and a rig that cannot build the violation proves nothing.
  echo w >> f.txt && git add f.txt
  base6=$(git rev-parse HEAD)
  env GIT_AUTHOR_NAME="$FOUNDER_NAME" GIT_AUTHOR_EMAIL="$FOUNDER_EMAIL" \
      GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x \
      git commit -q --no-verify -m "t6 seat-typed with no trailer" >/dev/null 2>&1
  tip6=$(git rev-parse HEAD)
  ftr6=$(git show -s --format='%(trailers:key=Co-authored-by)' "$tip6" 2>/dev/null)
  c6=$(git log -1 --format='%cn' 2>/dev/null)
  if [ "$tip6" = "$base6" ] || [ -n "$ftr6" ] || [ "$c6" != "bZiq" ]; then
    echo "  FAIL T6 fixture — needed a NEW seat-typed commit carrying zero parsed trailers (base6=$base6 tip6=$tip6 committer=$c6 trailers='$ftr6')"; st=1
  else
    mkdir -p "$T/nogrep"
    printf '#!/bin/sh\nexit 127\n' > "$T/nogrep/grep"
    chmod +x "$T/nogrep/grep"
    ctl6=$(env S7_RANGE="$base6..$tip6" sh "$SELF" 2>&1); crc6=$?
    sub6=$(env PATH="$T/nogrep:$PATH" S7_RANGE="$base6..$tip6" sh "$SELF" 2>&1); src6=$?
    if [ "$crc6" -eq 0 ] || ! printf '%s\n' "$ctl6" | grep -q 'without a Co-authored-by trailer'; then
      echo "  FAIL T6 control — with its tools present the gate must already reject this commit on the trailer clause; rc=$crc6 out: $ctl6"; st=1
    elif [ "$src6" -eq 0 ]; then
      echo "  FAIL T6 — counter empty (grep absent) and the range check still exited 0; out: $sub6"; st=1
    elif printf '%s\n' "$sub6" | grep -q "ok   §7 $tip6"; then
      echo "  FAIL T6 — a seat-typed commit with no trailer was reported ok while the counter was uncomputable; out: $sub6"; st=1
    elif ! printf '%s\n' "$sub6" | grep -q 'which is not a count'; then
      echo "  FAIL T6 — it stopped, but not on the named counter error, so the row cannot say what it caught; rc=$src6 out: $sub6"; st=1
    else
      echo "  PASS T6 uncomputable counter dies named — rc=$src6, no ok line for $tip6"
    fi
  fi
  # T7 — RANGE RESOLUTION, and it is deliberately three arms, because the whole
  # point of the chosen shape is that it separates two answers WITHOUT refusing
  # a third. One arm alone cannot show that: a gate that dies on everything
  # passes arm A and is useless.
  #   A unresolvable        -> must DIE BY NAME (before the fix it printed the
  #                            very same "contains 0 commits" line as arm B)
  #   B legitimately empty  -> must still PASS LOUDLY  (the OVER-BLOCK guard)
  #   C '--not' form        -> must still be JUDGED    (the form a ".." split
  #                            would have turned into a non-ref)
  r7base=$(git rev-parse HEAD~1 2>/dev/null)
  a7=$(env S7_RANGE="nosuchref..HEAD" sh "$SELF" 2>&1); arc7=$?
  b7=$(env S7_RANGE="HEAD..HEAD" sh "$SELF" 2>&1); brc7=$?
  c7=$(env S7_RANGE="HEAD --not $r7base" sh "$SELF" 2>&1); crc7=$?
  if [ -z "$r7base" ]; then
    echo "  FAIL T7 fixture — needed a parent commit to build the --not arm"; st=1
  elif [ "$arc7" -eq 0 ] || ! printf '%s\n' "$a7" | grep -q 'could not be COMPUTED'; then
    echo "  FAIL T7-A — an unresolvable range must die by name; rc=$arc7 out: $a7"; st=1
  elif printf '%s\n' "$a7" | grep -q 'contains 0 commits'; then
    echo "  FAIL T7-A — it stopped, but still called an uncomputable range empty; out: $a7"; st=1
  elif [ "$brc7" -ne 0 ] || ! printf '%s\n' "$b7" | grep -q 'contains 0 commits'; then
    echo "  FAIL T7-B — a LEGITIMATELY empty range must still pass loudly; rc=$brc7 out: $b7"; st=1
  elif printf '%s\n' "$c7" | grep -q 'could not be COMPUTED' \
       || ! printf '%s\n' "$c7" | grep -q 'checking 1 commit'; then
    # NOTE WHAT THIS ARM CLAIMS: JUDGED, not PASSED. T7 runs after T6, whose
    # fixture is a deliberate trailer-less commit, so this arm's VERDICT is
    # correctly rc=1 — and the verdict is irrelevant to the claim. Requiring
    # rc=0 here would assert the fixture rather than the form, and it is how
    # this row failed on its first run.
    echo "  FAIL T7-C — the --not form must still be judged, not refused on resolution; rc=$crc7 out: $c7"; st=1
  else
    echo "  PASS T7 range resolution — unresolvable dies named · empty still passes · --not still judged"
  fi
  # T8 — GITHUB WEB-FLOW, and it runs through the RANGE path because that is the
  # only path that ever sees such a commit: GitHub writes it, no hook runs, CI
  # reads it after the push. FIVE arms, because one arm cannot show a rule is
  # NARROW — an exemption that passes everything passes arm A too.
  #   A the founder's own web merge            -> ok, by its own word
  #   B another GitHub account, same committer -> FAIL (the author-id half)
  #   C the founder's GH address, seat commits -> FAIL (the committer half)
  #   D a real seat-as-author commit, the live specimen 9f6b943e's own idents
  #                                            -> FAIL (the rule this file exists for)
  #   E an address that only ENDS in the noreply domain
  #                                            -> FAIL (the stray-'@' guard)
  # Arm D is the one the off-switch test cannot give: deleting the exemption
  # makes A fall and proves the row is load-bearing, which is not the same as
  # proving it still returns the right answer for everything else.
  # Fixtures commit with --no-verify on purpose: staged mode correctly refuses
  # to let a seat create any of these, and a rig that cannot build the shape
  # under test proves nothing.
  t8() { # $1 desc, $2 ok|fail, $3 a substring the output must carry, then the ident env + git
    d8=$1; want8=$2; must8=$3; shift 3
    echo "$d8" >> f.txt && git add f.txt
    b8=$(git rev-parse HEAD)
    "$@" -q --no-verify -m "$d8" >/dev/null 2>&1
    p8=$(git rev-parse HEAD)
    if [ "$p8" = "$b8" ]; then
      echo "  FAIL $d8 — fixture: no commit was created, so this arm judged nothing"; st=1; return
    fi
    o8=$(env S7_RANGE="$b8..$p8" sh "$SELF" 2>&1); r8=$?
    if ! printf '%s\n' "$o8" | grep -qF "$must8"; then
      echo "  FAIL $d8 — the output does not carry '$must8', so the arm cannot say WHICH thing it judged; rc=$r8 out: $o8"; st=1
    elif [ "$want8" = ok ] && { [ "$r8" -ne 0 ] || ! printf '%s\n' "$o8" | grep -qF "ok   §7 $p8"; }; then
      echo "  FAIL $d8 — expected $p8 to pass; rc=$r8 out: $o8"; st=1
    elif [ "$want8" = fail ] && { [ "$r8" -eq 0 ] || printf '%s\n' "$o8" | grep -qF "ok   §7 $p8"; }; then
      echo "  FAIL $d8 — expected $p8 to be refused; rc=$r8 out: $o8"; st=1
    else
      echo "  PASS $d8"
    fi
  }
  t8 "T8-A founder's GitHub web merge is ok" ok \
     "GitHub web-flow by the founder's account" \
     env GIT_AUTHOR_NAME="Travis Remington" \
         GIT_AUTHOR_EMAIL="$FOUNDER_GH_ID+loviswaternakamoto@$GH_NOREPLY_DOMAIN" \
         GIT_COMMITTER_NAME="$GH_WEBFLOW_NAME" GIT_COMMITTER_EMAIL="$GH_WEBFLOW_EMAIL" git commit
  t8 "T8-B another GitHub account's web merge is refused" fail \
     "author is 'Someone Else <999999+someoneelse@$GH_NOREPLY_DOMAIN>', not the founder" \
     env GIT_AUTHOR_NAME="Someone Else" \
         GIT_AUTHOR_EMAIL="999999+someoneelse@$GH_NOREPLY_DOMAIN" \
         GIT_COMMITTER_NAME="$GH_WEBFLOW_NAME" GIT_COMMITTER_EMAIL="$GH_WEBFLOW_EMAIL" git commit
  t8 "T8-C the founder's GitHub address with a SEAT as committer is refused" fail \
     "author is 'Travis Remington <$FOUNDER_GH_ID+loviswaternakamoto@$GH_NOREPLY_DOMAIN>', not the founder" \
     env GIT_AUTHOR_NAME="Travis Remington" \
         GIT_AUTHOR_EMAIL="$FOUNDER_GH_ID+loviswaternakamoto@$GH_NOREPLY_DOMAIN" \
         GIT_COMMITTER_NAME=bZiq GIT_COMMITTER_EMAIL=seat@x git commit
  t8 "T8-D a real seat-as-author commit still FAILs (9f6b943e's own idents)" fail \
     "author is 'bFUzZ <bGoose@agents.skaists.dev>', not the founder" \
     env GIT_AUTHOR_NAME="bFUzZ" GIT_AUTHOR_EMAIL="bGoose@agents.skaists.dev" \
         GIT_COMMITTER_NAME="bFUzZ" GIT_COMMITTER_EMAIL="bGoose@agents.skaists.dev" git commit
  t8 "T8-E an address that merely ENDS in the noreply domain is refused" fail \
     "author is 'Travis Remington <$FOUNDER_GH_ID+x@evil.example@$GH_NOREPLY_DOMAIN>', not the founder" \
     env GIT_AUTHOR_NAME="Travis Remington" \
         GIT_AUTHOR_EMAIL="$FOUNDER_GH_ID+x@evil.example@$GH_NOREPLY_DOMAIN" \
         GIT_COMMITTER_NAME="$GH_WEBFLOW_NAME" GIT_COMMITTER_EMAIL="$GH_WEBFLOW_EMAIL" git commit
  if [ "$st" -ne 0 ]; then echo "§7 selftest FAIL — a working gate and a dead one are not distinguishable by silence; these cases are the difference"; fi
  exit "$st"
fi

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
      trailers=$(git interpret-trailers --parse < "$S7_MSG_FILE" 2>/dev/null | grep -ci '^co-authored-by:' || true)
      require_count "the staged trailer counter" "$trailers" \
        || die "counter validation unavailable — require_count did not run"
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
#
# READ THE PRODUCER'S STATUS, NOT THE COUNTER'S. The single line this replaces
# destroyed git's answer twice: `2>/dev/null` ate the message, and the pipe into
# `wc` made $? WC'S. An unresolvable range then arrived here as the string "0"
# and PASSED LOUDLY with the same words a genuinely empty range gets — this
# file's own law at :25 inverted, because "could not compute" is not "computed
# empty". Measured before the fix: S7_RANGE='nosuchref..HEAD' and
# S7_RANGE='HEAD..HEAD' printed IDENTICAL output and both exited 0.
#
# ENDPOINT-SPLITTING WAS CONSIDERED AND REFUSED (bee-laborer, 2026-09-21): a
# revision range is not always two endpoints. `HEAD --not origin/main`,
# `^origin/main HEAD` and `A..B -- path` all resolve, and splitting at ".."
# hands each to a ref check as a non-ref — dying by name on a LEGITIMATE range.
# git already answers for every form; the only thing missing was reading it.
range_out=$(git log --format='%H' $RANGE 2>/dev/null); range_rc=$?
if [ "$range_rc" -ne 0 ]; then
  # diagnostic-only second call, made AFTER the range is known not to resolve,
  # solely to quote git's own words rather than paraphrase them
  range_why=$(git log --format='%H' $RANGE 2>&1 >/dev/null)
  die "the range ($RANGE) could not be COMPUTED — git log exited $range_rc. git said: $range_why. An unresolvable range is not an empty one and is never read as zero commits."
fi
count=$(printf '%s' "$range_out" | grep -c . || true)
require_count "the range size" "$count" \
  || die "counter validation unavailable — require_count did not run"
if [ "$count" = "0" ]; then
  # Computed-empty is a DETERMINED answer: zero commits in range. Pass loudly.
  say "ok — computed range ($RANGE) contains 0 commits; nothing to check"
  exit 0
fi
say "checking $count commit(s) in $RANGE"

status=0
while IFS='|' read -r commit an ae cn ce; do
  [ -z "$commit" ] && continue

  # GitHub web-flow, the founder's own hand: committer is GitHub and the author
  # is a noreply address minted for the founder's GitHub account id. There is no
  # seat in such a commit, so the trailer clause has nobody to credit and does
  # not apply — hence its own branch, and its own word in the output rather than
  # "founder-typed", which would report the wrong reason for the pass. See the
  # block beside FOUNDER_EMAIL for what the two halves buy and what they do not.
  if [ "$cn" = "$GH_WEBFLOW_NAME" ] && [ "$ce" = "$GH_WEBFLOW_EMAIL" ] \
     && is_founder_gh_noreply "$ae"; then
    echo "ok   §7 $commit — GitHub web-flow by the founder's account (author '$an <$ae>', committer GitHub); no seat in this commit, so the trailer clause does not apply"
    continue
  fi

  # Author is otherwise ALWAYS the founder — seat-typed or founder-typed alike.
  if [ "$an" != "$FOUNDER_NAME" ] || [ "$ae" != "$FOUNDER_EMAIL" ]; then
    echo "FAIL §7 $commit — author is '$an <$ae>', not the founder (seats are committers + trailers, never authors)"
    status=1
    continue
  fi

  trailers=$(git show -s --format='%(trailers:key=Co-authored-by)' "$commit" | grep -ci 'co-authored-by' || true)
  require_count "the trailer counter for $commit" "$trailers" \
    || die "counter validation unavailable — require_count did not run"

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
