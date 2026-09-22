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


# ---- key-shape arms + checksum classifier (2026-09-20 WIF/nsec slice) ------
# WIF_RE and keyshape() live in scripts/keyshape.sh, sourced here since the
# second enforcer arrived (secret-scan.sh, diff + tree modes - the class must
# be guarded where no seat runs: web edit, web merge, hookless clone). One
# implementation, two enforcers - the standing law. Check 3 below is the
# ACCOUNTING consumer; secret-scan.sh is the BLOCK consumer. Selftests P5-P11
# exercise the sourced implementation unchanged.

. "$(dirname "$0")/keyshape.sh"


# ---- HOOKS PRECONDITION — about the BOX, not about the delta --------------
# WHY THIS EXISTS: on 2026-09-22 this estate measured core.hooksPath UNSET at
# local, global and effective scope in every worktree, while .githooks/ shipped
# pre-commit and commit-msg. No seat had a local secret scan or a staged §7 for
# at least two days. ZcODe named it in
# docs/dispatches/2026-09-20-zcode-ss2-precommit-hook.md:18 on 09-20, and
# scripts/identity-check.sh:8 states the same hazard in its own header — and it
# still sat open, because a warning in a header nobody re-reads is not a gate.
#
# THAT IS WHY THIS ROW REFUSES (rc=1) RATHER THAN WARNING. A second printed
# warning would be the same signal in the same place that already failed. The
# refusal is cheap and cannot lose a push: this whole layer is advisory by
# design (see the header above — "never call this layer enforced"), so refusing
# costs a seat one command, never any work.
#
# RESOLVING IS NOT FIRING. A config read tells you a setting; it does not tell
# you the gate runs. That distinction is exactly how the hazard hid, and the
# tree carried a second instance of it: .githooks/commit-msg was index mode
# 100644, so git SILENTLY SKIPS it on every POSIX seat while the config is
# perfect. This row therefore asks whether the hook can EXECUTE, and the
# selftest below asks the only question this row cannot: does it actually fire.
#
# TWO INSTRUMENTS, AND THEY DO NOT ANSWER THE SAME QUESTION:
#   index mode (git ls-files -s)  PORTABLE. It is the mode every clone gets.
#   filesystem -x                 TRUE on POSIX, VACUOUS under Git for Windows,
#                                 which fabricates the bit: on this box `ls -l`
#                                 reports -rwxr-xr-x for a file that is 100644
#                                 in the index. Used only as a fallback for a
#                                 hooks dir outside the tree, and labelled weak.
#
# PLACEMENT: this prints AFTER the empty-delta halt and OUTSIDE the numbered
# 1)-7) series, deliberately. Checks 1-7 all scan $ADDED; this one scans
# nothing — it is a precondition about the seat's box. Selftest P2 asserts that
# an empty delta runs ZERO checks by counting `^[1-7])`, so numbering this row
# `8)` would silently stop that counter from meaning anything. Do not renumber.
hooks_check() {
  _hbad=0; _hn=0
  _hd=$(git rev-parse --git-path hooks 2>/dev/null)
  if [ -z "${_hd:-}" ]; then
    echo "HOOKS — FAIL: git cannot name a hooks directory. That is 'unknown',"
    echo "   not 'installed'. Refusing rather than assuming."
    return 1
  fi
  echo "HOOKS — effective hooks directory: $_hd"
  echo "   (git rev-parse --git-path hooks honours core.hooksPath at every scope,"
  echo "    so this is git's own answer, not a precedence rule re-implemented here.)"
  for _hpair in 'pre-commit:secret-scan.sh' 'commit-msg:identity-check.sh'; do
    _hh=${_hpair%%:*}; _hgate=${_hpair#*:}
    _hf="$_hd/$_hh"
    _hn=$((_hn + 1))
    if [ ! -s "$_hf" ]; then
      echo "   MISSING  $_hh — nothing installed at $_hf"; _hbad=$((_hbad + 1)); continue
    fi
    if ! grep -qF "$_hgate" "$_hf"; then
      echo "   INERT    $_hh — installed but never runs $_hgate"; _hbad=$((_hbad + 1)); continue
    fi
    _hmode=$(git ls-files -s -- "$_hf" 2>/dev/null | cut -c1-6)
    if [ -n "$_hmode" ]; then
      if [ "$_hmode" = 100755 ]; then
        echo "   ok       $_hh — runs $_hgate, index mode 100755 (executable in every clone)"
      else
        echo "   DEAD     $_hh — runs $_hgate but index mode is $_hmode. Git SKIPS a"
        echo "            non-executable hook and says so only as an advice hint. The"
        echo "            config can be perfect and this hook still never runs on POSIX."
        _hbad=$((_hbad + 1))
      fi
    elif [ -x "$_hf" ]; then
      echo "   ok(weak) $_hh — runs $_hgate; outside the tree, so the portable index"
      echo "            mode is unavailable and only the filesystem bit was read."
      echo "            Under Git for Windows that bit is fabricated and proves nothing."
    else
      echo "   DEAD     $_hh — runs $_hgate but is not executable and is not tracked"; _hbad=$((_hbad + 1))
    fi
  done
  echo "   $((_hn - _hbad)) of $_hn required hooks installed, wired and executable"
  if [ "$_hbad" -ne 0 ]; then
    echo "HOOKS BLOCKED — this box has no complete local gate. Remedy, from the repo root:"
    echo "     git config --local core.hooksPath .githooks"
    echo "     git update-index --chmod=+x .githooks/pre-commit .githooks/commit-msg"
    echo "   (the second line is a tracked mode change and must be committed to hold"
    echo "    for anyone else; a local chmod fixes only your own clone.)"
    echo "   This layer is advisory: CI re-scans on push either way. It refuses here"
    echo "   because a hookless box publishes UNSCANNED material the instant it pushes."
    return 1
  fi
  return 0
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
  n=$(grep -c '^[1-7])' /tmp/ps2)
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
  # P5-P10 - key-shape arms + checksum classifier (2026-09-20). Every BAD
  # fixture is MINTED at runtime (checksum-VALID from 32x 0x11): a shape-only
  # fixture would pass the arms and die in the classifier, leaving a selftest
  # that is green while the gate is blind - the vacuity trap named before this
  # was written. If every mint answers ERR, node is unavailable and the
  # classifier layer of check 3 cannot be trusted: that fails this selftest
  # loudly rather than passing vacuously.
  M_UNC=$(keyshape mint unc); M_CMP=$(keyshape mint cmp)
  M_NSEC=$(keyshape mint nsec); M_NPUB=$(keyshape mint npub)
  shapehit() { printf '%s\n' "$1" | grep -cE "$WIF_RE" || true; }
  kcls() { keyshape classify "$1"; }
  if [ "$M_UNC" != ERR ] && [ "$(shapehit "$M_UNC")" -eq 1 ] && [ "$(kcls "$M_UNC")" = "VALID ver=0x80 paylen=33" ]; then
    echo "  P5 known-BAD  minted uncompressed WIF -> arm1 hit, checksum VALID (correct)"
  else echo "  P5 known-BAD  minted uncompressed WIF -> MISSED: arm1 or classifier dead ($(kcls "$M_UNC"))"; st=1; fi
  if [ "$M_CMP" != ERR ] && [ "$(shapehit "$M_CMP")" -eq 1 ] && [ "$(kcls "$M_CMP")" = "VALID ver=0x80 paylen=34" ]; then
    echo "  P6 known-BAD  minted compressed WIF -> arm2 hit, checksum VALID (correct)"
  else echo "  P6 known-BAD  minted compressed WIF -> MISSED: arm2 or classifier dead ($(kcls "$M_CMP"))"; st=1; fi
  if [ "$M_NSEC" != ERR ] && [ "$(shapehit "$M_NSEC")" -eq 1 ] && [ "$(kcls "$M_NSEC")" = "VALID bech32(nsec)" ]; then
    echo "  P7 known-BAD  minted nsec1 -> arm3 hit, bech32 checksum VALID (correct)"
  else echo "  P7 known-BAD  minted nsec1 -> MISSED: arm3 or classifier dead ($(kcls "$M_NSEC"))"; st=1; fi
  if [ "$M_NPUB" != ERR ] && [ "$(shapehit "$M_NPUB")" -eq 0 ]; then
    echo "  P8 known-GOOD minted npub1 (public id, checksum VALID) -> no arm hits it (correct)"
  else echo "  P8 known-GOOD npub1 flagged - the public identifier must never be blocked"; st=1; fi
  NOISE="K$(zrep 51)"
  if [ "$(shapehit "$NOISE")" -eq 1 ] && [ "$(kcls "$NOISE")" = INVALID ]; then
    echo "  P9 known-GOOD shape-only run (the SVG/base64 noise class) -> arm2 hit, checksum INVALID -> collapsed (correct)"
  else echo "  P9 shape-only noise misread ($(kcls "$NOISE")) - the noise collapse is broken"; st=1; fi
  _last=$(printf '%s' "$M_UNC" | tail -c 1)
  if [ "$_last" = z ]; then _repl=K; else _repl=z; fi
  FLIP="$(printf '%s' "$M_UNC" | cut -c1-50)$_repl"
  if [ "$(kcls "$M_UNC")" != ERR ] && [ "$(kcls "$FLIP")" = INVALID ]; then
    echo "  P10 classifier non-vacuity: minted reads VALID, one char flipped reads INVALID (correct)"
  else echo "  P10 classifier vacuous - cannot tell a key from a flipped key"; st=1; fi
  # P11 - the WIRING row (bOPus5 mutation M1 against this gate, 2026-09-20):
  # P5-P7 prove the arms, P9-P10 the classifier, but NO row ran check 3 BODY -
  # a swapped wiring passed 10/10 while collapsing three checksum-VALID keys.
  # This row builds a real throwaway repo (the identity-check T-rig pattern),
  # commits a runtime-minted VALID fixture plus a shape-only noise line, runs
  # THIS script over that delta, and asserts the VALID key lands in the
  # LISTING, the noise in the collapsed count, and the preflight stays ok.
  T=$(mktemp -d 2>/dev/null) || { echo "  P11 wiring row -> mktemp failed"; st=1; T=""; }
  if [ -n "$T" ]; then
    (
      cd "$T" && git init -q repo 2>/dev/null && cd repo && mkdir -p scripts || exit 1
      cp "$SELF" scripts/push-preflight.sh
      cp "$(dirname "$SELF")/secret-scan.sh" scripts/secret-scan.sh 2>/dev/null || true
      cp "$(dirname "$SELF")/keyshape.sh" scripts/keyshape.sh 2>/dev/null || true
      git add scripts 2>/dev/null
      GIT_AUTHOR_NAME=probe GIT_AUTHOR_EMAIL=probe@invalid \
      GIT_COMMITTER_NAME=probe GIT_COMMITTER_EMAIL=probe@invalid \
        git commit -q -m base 2>/dev/null || exit 1
      printf 'demo fixture: one checksum-VALID uncompressed WIF and one shape-only run\n%s TESTNET-ONLY: runtime-minted check-3 fixture\n%s\n' "$M_UNC" "$NOISE" > demo.txt
      git add demo.txt 2>/dev/null
      GIT_AUTHOR_NAME=probe GIT_AUTHOR_EMAIL=probe@invalid \
      GIT_COMMITTER_NAME=probe GIT_COMMITTER_EMAIL=probe@invalid \
        git commit -q -m fixture 2>/dev/null || exit 1
      # The HOOKS row added below now refuses a box with no local gate, so this
      # rig must look like a seat's box or P11 would fail on the precondition
      # instead of on check 3. Installed AFTER the fixture commits on purpose:
      # P11's subject is the DELTA, and hooking the rig's own commits would
      # change what P11 tests rather than leave it alone.
      mkdir -p .githooks
      cp "$(dirname "$SELF")/../.githooks/pre-commit" .githooks/pre-commit 2>/dev/null
      cp "$(dirname "$SELF")/../.githooks/commit-msg" .githooks/commit-msg 2>/dev/null
      git add .githooks >/dev/null 2>&1
      git update-index --chmod=+x .githooks/pre-commit .githooks/commit-msg >/dev/null 2>&1
      git config core.hooksPath .githooks
      sh scripts/push-preflight.sh HEAD~1 > "$T/out" 2>&1
      echo "$?" > "$T/rc"
    )
    _prc=$(cat "$T/rc" 2>/dev/null || echo 99)
    _pre=$(printf '%.16s' "$M_UNC")
    _noi=$(printf '%.16s' "$NOISE")
    if [ "$_prc" -eq 0 ] && grep -qF "ACCOUNT FOR EACH" "$T/out" && grep -qF "$_pre" "$T/out" \
       && grep -q "collapsed" "$T/out" && ! grep -qF "$_noi" "$T/out"; then
      echo "  P11 wiring row: check-3 body over a real minted delta -> VALID listed, noise collapsed, preflight ok (correct)"
    else
      echo "  P11 wiring row -> the body does not do what the arms promise (rc=$_prc)"; st=1
    fi
    rm -rf "$T"
  fi
  # P12-P14 — the HOOKS row FIRED, not resolved. This is the whole point of the
  # row: a config read tells you a setting, and a setting is what was already
  # "correct" on the day .githooks/commit-msg turned out to be index mode 644
  # and silently skipped. So these arms build a real throwaway repo (the P11 /
  # identity-check T-rig pattern), install the estate's own hooks in it, and
  # make git actually run them.
  #
  #   P12 known-GOOD  hooks live, benign commit   -> COMMITS, and the scanner
  #                                                  SPEAKS (its own count line)
  #       known-BAD   hooks live, planted 64-hex  -> BLOCKED, commit count flat
  #   P13 known-BAD   hooks pointed elsewhere     -> the SAME content COMMITS and
  #                                                  the count RISES (the hazard
  #                                                  shown, not inferred from an
  #                                                  absent refusal), and --hooks
  #                                                  refuses by name
  #   P14 known-BAD   hook present but mode 644   -> --hooks refuses naming it
  #       known-GOOD  same hook at mode 755       -> --hooks passes
  #
  # P13's rise is what makes P12's block mean anything: without it, "blocked"
  # could be any failure at all. P14 is the arm for the WRONG ANSWER rather than
  # the off-switch — a row that only catches a missing file would hand a green
  # to the exact tree we are sitting in.
  _hsrc=$(dirname "$SELF")
  _fn=$(sed -n 's/^FOUNDER_NAME="\(.*\)"$/\1/p' "$_hsrc/identity-check.sh" | head -1)
  _fe=$(sed -n 's/^FOUNDER_EMAIL="\(.*\)"$/\1/p' "$_hsrc/identity-check.sh" | head -1)
  # The fixture asserts its own precondition: an empty founder identity would
  # make every §7 arm below refuse for the wrong reason and read as a catch.
  if [ -z "$_fn" ] || [ -z "$_fe" ]; then
    echo "  P12-P14 -> could not read the founder identity out of identity-check.sh; arms not run"; st=1
  else
  # Generated here, never copied: 8 x 8 chars = a 64-run, and no 48+ literal
  # ever appears in this source (which would make this file block itself).
  _hex=$(printf 'deadbeef%.0s' 1 2 3 4 5 6 7 8)
  _msg_c="control

Co-authored-by: preflight selftest seat <selftest@invalid>"
  H=$(mktemp -d 2>/dev/null) || H=""
  case "$H" in
    "$(git rev-parse --show-toplevel 2>/dev/null)"*)
      echo "  P12-P14 -> refusing: mktemp handed back a path INSIDE the estate checkout ($H)"; st=1; H="" ;;
  esac
  if [ -z "$H" ]; then
    echo "  P12-P14 -> no usable throwaway directory; arms not run"; st=1
  else
    (
      cd "$H" && git init -q r 2>/dev/null && cd r && mkdir -p scripts .githooks || exit 1
      cp "$SELF" scripts/push-preflight.sh
      cp "$_hsrc/secret-scan.sh" "$_hsrc/keyshape.sh" "$_hsrc/identity-check.sh" scripts/ || exit 1
      cp "$_hsrc/../.githooks/pre-commit" "$_hsrc/../.githooks/commit-msg" .githooks/ || exit 1
      git add -A >/dev/null 2>&1
      # --chmod, not chmod: the filesystem bit does not reach the index under
      # Git for Windows, and the index mode is the thing the row reads.
      git update-index --chmod=+x .githooks/pre-commit .githooks/commit-msg >/dev/null 2>&1
      GIT_AUTHOR_NAME="$_fn" GIT_AUTHOR_EMAIL="$_fe" \
      GIT_COMMITTER_NAME='preflight selftest seat' GIT_COMMITTER_EMAIL='selftest@invalid' \
        git commit -q -m "$_msg_c" >/dev/null 2>&1 || exit 1
      git config core.hooksPath .githooks
      git rev-list --count HEAD > c0

      echo "benign control line" > control.txt; git add control.txt >/dev/null 2>&1
      GIT_AUTHOR_NAME="$_fn" GIT_AUTHOR_EMAIL="$_fe" \
      GIT_COMMITTER_NAME='preflight selftest seat' GIT_COMMITTER_EMAIL='selftest@invalid' \
        git commit -m "$_msg_c" > a.out 2>&1
      echo "$?" > a.rc; git rev-list --count HEAD > a.n

      printf 'planted, unmarked: %s\n' "$_hex" > bad.txt; git add bad.txt >/dev/null 2>&1
      GIT_AUTHOR_NAME="$_fn" GIT_AUTHOR_EMAIL="$_fe" \
      GIT_COMMITTER_NAME='preflight selftest seat' GIT_COMMITTER_EMAIL='selftest@invalid' \
        git commit -m "$_msg_c" > b.out 2>&1
      echo "$?" > b.rc; git rev-list --count HEAD > b.n

      mkdir -p .nohooks; git config core.hooksPath .nohooks
      GIT_AUTHOR_NAME="$_fn" GIT_AUTHOR_EMAIL="$_fe" \
      GIT_COMMITTER_NAME='preflight selftest seat' GIT_COMMITTER_EMAIL='selftest@invalid' \
        git commit -m "$_msg_c" > c.out 2>&1
      echo "$?" > c.rc; git rev-list --count HEAD > c.n
      sh scripts/push-preflight.sh --hooks > c.pf 2>&1; echo "$?" > c.pfrc

      git config core.hooksPath .githooks
      git update-index --chmod=-x .githooks/commit-msg >/dev/null 2>&1
      sh scripts/push-preflight.sh --hooks > d.out 2>&1; echo "$?" > d.rc
      git update-index --chmod=+x .githooks/commit-msg >/dev/null 2>&1
      sh scripts/push-preflight.sh --hooks > e.out 2>&1; echo "$?" > e.rc
    )
    _R="$H/r"
    _rd() { cat "$_R/$1" 2>/dev/null || echo MISSING; }
    _c0=$(_rd c0); _arc=$(_rd a.rc); _an=$(_rd a.n); _brc=$(_rd b.rc); _bn=$(_rd b.n)
    _crc=$(_rd c.rc); _cn=$(_rd c.n); _cpf=$(_rd c.pfrc); _drc=$(_rd d.rc); _erc=$(_rd e.rc)
    if [ "$_arc" = 0 ] && [ "$_an" = "$((${_c0:-0} + 1))" ] && grep -q "added lines scanned" "$_R/a.out" 2>/dev/null; then
      echo "  P12a known-GOOD hooks live, benign commit -> committed ($_c0 -> $_an) and the scanner SPOKE its count (correct)"
    else
      echo "  P12a known-GOOD hooks live, benign commit -> rc=$_arc count $_c0 -> $_an, scanner silent — the rig cannot commit or the hook never ran"; st=1
    fi
    if [ "$_brc" != 0 ] && [ "$_bn" = "$_an" ] && grep -q "BLOCKED" "$_R/b.out" 2>/dev/null; then
      echo "  P12b known-BAD  hooks live, planted 64-hex -> refused, count flat at $_bn (correct)"
    else
      echo "  P12b known-BAD  hooks live, planted 64-hex -> rc=$_brc count $_an -> $_bn — the hook did not fire"; st=1
    fi
    if [ "$_crc" = 0 ] && [ "$_cn" = "$((${_bn:-0} + 1))" ]; then
      echo "  P13a known-BAD  hooks pointed elsewhere -> the SAME content LANDED, count ROSE $_bn -> $_cn (the hazard, shown)"
    else
      echo "  P13a known-BAD  hooks pointed elsewhere -> rc=$_crc count $_bn -> $_cn — no rise, so P12b's block is unattributed"; st=1
    fi
    if [ "$_cpf" = 1 ] && grep -q "HOOKS BLOCKED" "$_R/c.pf" 2>/dev/null && grep -q "MISSING  pre-commit" "$_R/c.pf" 2>/dev/null; then
      echo "  P13b known-BAD  --hooks over that box -> refused rc=1, naming the missing hook (correct)"
    else
      echo "  P13b known-BAD  --hooks over that box -> rc=$_cpf without naming the missing hook — the row is not the thing refusing"; st=1
    fi
    if [ "$_drc" = 1 ] && grep -q "DEAD     commit-msg" "$_R/d.out" 2>/dev/null && grep -q "index mode is 100644" "$_R/d.out" 2>/dev/null; then
      echo "  P14a known-BAD  hook installed, wired, index mode 644 -> refused, named as DEAD (correct)"
    else
      echo "  P14a known-BAD  mode-644 hook -> rc=$_drc, not reported dead — config-correct and skipped reads as installed"; st=1
    fi
    if [ "$_erc" = 0 ] && grep -q "2 of 2 required hooks" "$_R/e.out" 2>/dev/null; then
      echo "  P14b known-GOOD same hook at mode 755 -> 2 of 2, permitted (correct)"
    else
      echo "  P14b known-GOOD mode-755 hook -> rc=$_erc — the row refuses a correctly installed box"; st=1
    fi
    rm -rf "$H"
    if [ -e "$H" ]; then echo "  P12-P14 cleanup -> $H SURVIVED; a rig that leaves state can green the next run"; st=1
    else echo "  P12-P14 cleanup -> throwaway tree removed (correct)"; fi
  fi
  fi
  rm -f /tmp/ps1 /tmp/ps2
  [ "$st" -eq 0 ] && echo "selftest ok — refuses what it must, permits what it must."                    || echo "selftest FAIL — see above."
  exit $st
fi

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
# --hooks runs the HOOKS precondition row ALONE and exits with its verdict.
# The selftest needs it: running the whole preflight to judge one row lets
# checks 1-7 decide rc, so a green would not belong to this row. It is also the
# mutation target — turn this row off and exactly one selftest arm must fall.
if [ "${1:-}" = "--hooks" ]; then
  hooks_check; exit $?
fi

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

# The box precondition, judged before any of the delta checks below. It sets
# rc like check 6 does, so the existing "PREFLIGHT BLOCKED" footer carries it;
# a second exit path here would bypass the checks a seat still needs to read.
hooks_check || rc=1

echo ""
echo "1) secret scan over the tree"
if sh scripts/secret-scan.sh tree >/tmp/pf_1 2>&1; then
  echo "   ok"
else
  echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_1; rc=1
fi

# PEM pattern uses the estate bracket trick (see scripts/secret-scan.sh:55):
# KE[Y] so this detector never matches its own source. The base58 arm that
# lived here ({48}) was measured dead on every real WIF shape - 0 hits on the
# 51-char uncompressed and 52-char compressed forms both - and is REPLACED by
# the three live arms of check 3: a 50-char match it could block is not a key,
# and a real 51-char WIF escaped it.
echo "2) private-key material on added lines"
printf '%s\n' "$ADDED" | grep -nE 'PVT_K1_|xprv|BEGIN .*PRIVATE KE[Y]' >/tmp/pf_2
n=$(grep -c . /tmp/pf_2 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 matches"; else
  echo "   BLOCKED — $n match(es):"; head -5 /tmp/pf_2 | sed 's/^/     /'
  printf '%s
' "$ADDED" | grep -oE 'PVT_K1_[A-Za-z0-9]+|xprv[A-Za-z0-9]+' | sort -u | while read -r t; do
    printf '     token %s…
' "$(printf '%s' "$t" | cut -c1-24)"; locate "$t"; done
  rc=1; fi

echo "3) key-shaped strings on added lines (shape arms + checksum class)"
if ! printf '%s\n' "$ADDED" | grep -qE "$WIF_RE"; then
  echo "   ok - 0 present"
else
  wif_rows=""; wif_noise=0; wif_err=0
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    cls=$(keyshape classify "$t")
    case "$cls" in
      VALID*) wif_rows="$wif_rows$t|$cls
" ;;
      INVALID) wif_noise=$((wif_noise+1)) ;;
      *) wif_err=$((wif_err+1)); wif_rows="$wif_rows$t|(CLASSIFIER UNAVAILABLE - treat as key-shaped until accounted)
" ;;
    esac
  done <<EOF
$(printf '%s\n' "$ADDED" | grep -oE "$WIF_RE" | sort -u)
EOF
  n=$(printf '%s' "$wif_rows" | grep -c . || true)
  if [ "$n" -eq 0 ]; then
    echo "   ok - 0 checksum-valid present ($wif_noise checksum-invalid shape run(s) collapsed)"
  else
    echo "   $n distinct checksum-VALID - ACCOUNT FOR EACH (a public test vector and a leaked key look identical):"
    printf '%s' "$wif_rows" | while IFS='|' read -r t d; do
      [ -n "$t" ] || continue
      printf '     %.16s...  %s\n' "$t" "$d"
      printf '       %s\n' "$(printf '%s\n' "$ADDED" | grep -F "$t" | head -1 | cut -c1-76)"
    done
    if [ "$wif_noise" -gt 0 ]; then echo "   ($wif_noise checksum-INVALID shape run(s) - base64/asset noise class - collapsed, not listed)"; fi
    if [ "$wif_err" -gt 0 ]; then echo "   !! checksum classifier FAILED on $wif_err hit(s) - node runtime broken? every shape hit is listed above"; fi
  fi
fi

echo "4) 64-hex strings on added lines (each must be accounted for)"
printf '%s\n' "$ADDED" | grep -oE '[0-9a-fA-F]{64}' | sort -u >/tmp/pf_4
n=$(grep -c . /tmp/pf_4 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 present"
else
  echo "   $n distinct — ACCOUNT FOR EACH (a Cargo.lock checksum and a leaked key look identical):"
  while read -r h; do
    printf '     %s…  %s\n' "$(printf '%s' "$h" | cut -c1-16)" \
      "$(printf '%s\n' "$ADDED" | grep -F "$h" | head -1 | cut -c1-80)"
  done < /tmp/pf_4
fi

echo "5) credential words on added lines"
printf '%s\n' "$ADDED" | grep -inE 'password|passphrase|secret|api[_-]?key|token|credential' >/tmp/pf_5
n=$(grep -c . /tmp/pf_5 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 hits"
else echo "   $n hit(s) — confirm each is PROSE, not a value:"; head -6 /tmp/pf_5 | cut -c1-100 | sed 's/^/     /'; fi

echo "6) credential-shaped files in the delta"
git diff --name-only "$BASE_REF"...HEAD | grep -iE 'DO_NOT_COMMIT|(^|/)\.env|credential|\.pem$|\.key$' >/tmp/pf_6
n=$(grep -c . /tmp/pf_6 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_6; rc=1; fi

echo "7) @-handles on added lines (public or fictional only)"
printf '%s\n' "$ADDED" | grep -oE '@[A-Za-z][A-Za-z0-9_.-]{2,}' | sort -u >/tmp/pf_7
n=$(grep -c . /tmp/pf_7 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   $n distinct:"; head -8 /tmp/pf_7 | tr '\n' ' ' | sed 's/^/     /'; echo ""; fi

echo ""
if [ "$rc" -ne 0 ]; then echo "PREFLIGHT BLOCKED — do not push."; else
  echo "PREFLIGHT ok — checks 3, 4, 5 and 7 are JUDGEMENT items: read them, do not"
  echo "  just note they printed. Then: git push origin HEAD:<your lane>"
fi
exit $rc
