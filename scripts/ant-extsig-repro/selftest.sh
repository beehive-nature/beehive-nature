#!/bin/sh
# ant-extsig-repro selftest — proves the runner's refusal and finalization
# laws locally with synthetic cases only (no box, no execution of the
# harness, nothing in ops/ or the repo root modified; cargo cases use
# ordinary dependency fetching, the stub controls are fully offline).
#
# r3 (Astra review #10 5648424593, cleanup corrections):
#   Every neighbor the selftest creates is an EXCLUSIVE mktemp allocation —
#   no fixed shared paths, no mkdir -p over unknown state. The runner
#   invocations that own scratch (T7/T8/T8b/T10) run against an ISOLATED
#   per-test base (unique mktemp dir passed as TMPDIR), so leftover counting
#   sees only this run's allocations, never another run's. A PRE-EXISTING
#   legacy marker with content sits in that base for the whole suite and
#   must remain byte-identical (the runner removes only the exact scratch
#   paths it created). The finalizer now CHECKS each rm -rf's status: T10
#   proves with a no-op stub rm that a failed removal produces an honest
#   RETAINED-path terminal receipt, preserves an original nonzero status,
#   and escalates a successful run's exit 0 to 1. Wording law from the same
#   review: true-symlink coverage is attributed to hosts that can create
#   them (Linux), never to CI unless a CI job actually executes the test.
#
#   T1a missing COMMITTED lock   -> runner refuses before any cargo run
#   T1b missing BUILD lock       -> cargo --locked refuses to create one
#   T2a tampered COMMITTED lock  -> runner's banked-sha assertion refuses
#   T2b tampered BUILD lock      -> cargo --locked refuses with the EXPECTED
#                                   lock-update text AND leaves the lock
#                                   byte-unchanged
#   T2c stub cargo control      -> an unrelated failure must NOT satisfy
#                                   the T2b matcher (false-positive guard)
#   T3a orphan workspace (no overlay [workspace] table, nested under a
#       parent workspace) -> cargo refuses with the runbook §6 error
#   T3b same nest WITH the overlay -> cargo accepts (the cure)
#   T4  source drift (canonical copy tampered, fed via REPRO_SRC_DIR)
#       -> runner's manifest check refuses
#   T5a cleanup path guard: accepts only the validated direct-child scratch
#       shape; rejects /, empty, foreign prefixes, ..-traversal, not-a-dir,
#       nested subpath
#   T5b symlink escape -> rejected via physical canonicalization (SKIP
#       named where no true symlink can be created)
#   T7  injected staging failure -> finalizer cleans the isolated scratch,
#       nonzero exit, neighbors + legacy intact
#   T8  injected cargo failure (stub) -> same contract
#   T8b TERM interruption mid-cargo -> same contract (cleanup or explicit
#       kept-path receipt), original status nonzero
#   T9  owned neighbor and pre-existing legacy marker survive every path
#   T10 stubbed removal failure -> RETAINED-path receipt, original nonzero
#       preserved (fail-after-stage case) and success-path 0 escalated to 1
#   T6  canonical ops/ant-extsig still equals the committed manifest
#
# Usage: sh scripts/ant-extsig-repro/selftest.sh
set -u

REPRO_ROOT=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$REPRO_ROOT/../.." && pwd)
RUN=$REPRO_ROOT/run.sh
SRC=$REPO_ROOT/ops/ant-extsig
LOCK=$REPRO_ROOT/lock/Cargo.lock
OVERLAY=$REPRO_ROOT/overlay/Cargo.toml
BASE=${TMPDIR:-/tmp}

# the EXPECTED cargo refusal family for a lock that no longer satisfies the
# manifest under --locked — cargo 1.98 spells it "cannot create the lock
# file … because --locked was passed to prevent this" (no lock present) or
# "cannot update the lock file … because --locked was passed to prevent
# this" / "the lock file … needs to be updated but --locked was passed"
# (drifted lock). T2b requires one of these; T2c requires the matcher NOT to
# fire on anything else.
LOCK_REFUSAL_RE='(cannot (create|update) the lock file|needs to be updated).*--locked was passed'

pass=0; fail=0; skip=0
ok()   { pass=$((pass+1)); echo "T$1 PASS — $2"; }
bad()  { fail=$((fail+1)); echo "T$1 FAIL — $2" >&2; }
skipd(){ skip=$((skip+1)); echo "T$1 SKIP — $2"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing tool: $1" >&2; exit 1; }; }
need sha256sum; need cargo; need sed; need awk

# direct cargo cases below run outside the repo too — same toolchain pin law
if command -v rustup >/dev/null 2>&1 && [ -f "$REPO_ROOT/rust-toolchain.toml" ]; then
    _pin=$(sed -n 's/^channel *= *"\(.*\)".*/\1/p' "$REPO_ROOT/rust-toolchain.toml" | head -1)
    [ -n "$_pin" ] && RUSTUP_TOOLCHAIN=$_pin && export RUSTUP_TOOLCHAIN
fi

WORK=$(mktemp -d "$BASE/ant-extsig-repro-selftest.XXXXXX") || exit 1

# ISOLATED per-test base for every runner invocation that owns scratch, so
# leftover counting sees only this run's allocations (concurrent runs never
# collide). Exclusive allocations only; nothing here pre-exists.
ISO=$(mktemp -d "$BASE/ant-extsig-repro-selftest-iso.XXXXXX") || exit 1
# OWNED neighbor — exclusive mktemp allocation with a payload
NEIGHBOR=$(mktemp -d "$ISO/ant-extsig-repro-neighb.XXXXXX") || exit 1
printf 'owned-neighbor-payload\n' > "$NEIGHBOR/payload.txt"
# PRE-EXISTING legacy marker WITH CONTENT: name-shaped like runner scratch
# but planted by the suite before any runner invocation; the runner must
# never touch what it did not allocate. Must stay byte-identical throughout.
LEGACY="$ISO/ant-extsig-repro.legacy01"
mkdir -p "$LEGACY"
printf 'pre-existing legacy payload — not allocated by the runner\n' > "$LEGACY/sentinel.txt"
legacy_digest_before=$(sha256sum "$LEGACY/sentinel.txt" | cut -d' ' -f1)
# runner-shaped scratch leftovers inside the isolated base (mktemp suffix
# is exactly 6 chars; the legacy suffix is 8, so it is never counted)
leftovers() { ls -d "$ISO"/ant-extsig-repro.?????? 2>/dev/null | wc -l; }
neighbors_intact() {
    [ -f "$NEIGHBOR/payload.txt" ] || return 1
    [ "$(sha256sum "$LEGACY/sentinel.txt" 2>/dev/null | cut -d' ' -f1)" = "$legacy_digest_before" ] || return 1
    return 0
}
# physical prefix check for the suite's own cleanup (mirrors the runner law)
phys_under() {
    _p=$(cd "$1" 2>/dev/null && pwd -P) || return 1
    _b=$(cd "$2" 2>/dev/null && pwd -P) || return 1
    case "$_p" in "$_b"/*) return 0 ;; *) return 1 ;; esac
}

# All suite removals validate the resolved target before invoking rm.
# Failures count against the suite, including final cleanup failures.
remove_owned() {
    if ! phys_under "$1" "$2"; then
        echo "selftest: cleanup validation failed — KEPT: $1" >&2
        fail=$((fail+1)); return 1
    fi
    if ! rm -rf "$1"; then
        echo "selftest: cleanup removal failed — RETAINED: $1" >&2
        fail=$((fail+1)); return 1
    fi
}

# ---- T1a: kit with the committed lock removed ------------------------------
KIT1=$WORK/kit-missing-lock
mkdir -p "$KIT1"
cp -R "$REPRO_ROOT/." "$KIT1/"
rm -f "$KIT1/lock/Cargo.lock"
# kit copies live under /tmp — their own REPO_ROOT derivation cannot see the
# repo, so hand them the real canonical source dir explicitly
if REPRO_SRC_DIR="$SRC" sh "$KIT1/run.sh" >"$WORK/t1a.out" 2>&1; then
    bad 1a "runner accepted a kit with NO committed candidate lock"
else
    grep -q "candidate lockfile not found" "$WORK/t1a.out" \
        && ok 1a "runner refused the missing committed lock" \
        || bad 1a "refusal did not name the missing lock: $(tail -1 "$WORK/t1a.out")"
fi

# ---- T1b: build copy staged WITHOUT a lock ---------------------------------
B1=$WORK/build-nolock
sh "$RUN" --stage "$B1" >"$WORK/t1b.stage" 2>&1 || { bad 1b "staging failed: $(tail -1 "$WORK/t1b.stage")"; }
rm -f "$B1/Cargo.lock"
if ( cd "$B1" && cargo metadata --locked --format-version 1 >"$WORK/t1b.out" 2>&1 ); then
    bad 1b "cargo --locked succeeded with NO lock present (would have minted one)"
else
    grep -Eq "$LOCK_REFUSAL_RE" "$WORK/t1b.out" \
        && ok 1b "cargo --locked refused to create a lock: $(grep -m1 -o 'cannot create the lock file[^.]*' "$WORK/t1b.out")" \
        || bad 1b "refusal was not the expected lock-update text: $(tail -1 "$WORK/t1b.out")"
fi

# ---- T2a: committed lock tampered (ant-node version bumped) ----------------
KIT2=$WORK/kit-tampered-lock
mkdir -p "$KIT2"
cp -R "$REPRO_ROOT/." "$KIT2/"
sed -i 's/^version = "0.18.1"$/version = "0.18.2"/' "$KIT2/lock/Cargo.lock"
if REPRO_SKIP_CHECK=1 REPRO_SRC_DIR="$SRC" sh "$KIT2/run.sh" >"$WORK/t2a.out" 2>&1; then
    bad 2a "runner accepted a TAMPERED committed lock"
else
    grep -q "not the banked box lock" "$WORK/t2a.out" \
        && ok 2a "runner's banked-sha assertion refused the tampered committed lock" \
        || bad 2a "refusal was not the banked-sha guard: $(tail -1 "$WORK/t2a.out")"
fi

# ---- T2b: BUILD lock tampered after staging --------------------------------
# strict (Astra r2-3): the refusal MUST be the expected lock-update text —
# an unrelated tool/network failure fails this case instead of passing it
B2=$WORK/build-tampered
sh "$RUN" --stage "$B2" >"$WORK/t2b.stage" 2>&1 || { bad 2b "staging failed: $(tail -1 "$WORK/t2b.stage")"; }
sed -i 's/^version = "0.18.1"$/version = "0.18.2"/' "$B2/Cargo.lock"
tampered_sha=$(sha256sum "$B2/Cargo.lock" | cut -d' ' -f1)
if ( cd "$B2" && cargo metadata --locked --format-version 1 >"$WORK/t2b.out" 2>&1 ); then
    bad 2b "cargo --locked ACCEPTED a lock whose ant-node no longer satisfies the =0.18.1 requirement"
else
    post_sha=$(sha256sum "$B2/Cargo.lock" | cut -d' ' -f1)
    if ! grep -Eq "$LOCK_REFUSAL_RE" "$WORK/t2b.out"; then
        bad 2b "cargo failed but WITHOUT the expected lock-update refusal (unrelated failure would false-pass): $(tail -1 "$WORK/t2b.out")"
    elif [ "$post_sha" != "$tampered_sha" ]; then
        bad 2b "cargo REWROTE the tampered lock despite --locked"
    else
        ok 2b "cargo --locked refused with the expected lock-update text and left the lock byte-unchanged: $(grep -m1 -o 'the lock file[^.]*' "$WORK/t2b.out" | head -1)"
    fi
fi

# ---- T2c: stub cargo control (offline; the matcher must NOT fire) ---------
STUBBIN=$WORK/stubbin
mkdir -p "$STUBBIN"
printf '#!/bin/sh\necho "cargo-stub: simulated unrelated failure (network unreachable)" >&2\nexit 1\n' > "$STUBBIN/cargo"
chmod +x "$STUBBIN/cargo"
B2C=$WORK/build-stubcontrol
sh "$RUN" --stage "$B2C" >"$WORK/t2c.stage" 2>&1 || { bad 2c "staging failed: $(tail -1 "$WORK/t2c.stage")"; }
if ( cd "$B2C" && PATH="$STUBBIN:$PATH" cargo metadata --locked --format-version 1 >"$WORK/t2c.out" 2>&1 ); then
    bad 2c "stub cargo exited 0 — the control is not exercising a failure"
else
    if grep -q "cargo-stub: simulated unrelated failure" "$WORK/t2c.out" \
        && ! grep -Eq "$LOCK_REFUSAL_RE" "$WORK/t2c.out"; then
        ok 2c "an UNRELATED cargo failure does NOT satisfy the refusal matcher (T2b would fail on it, not false-pass)"
    else
        bad 2c "control invalid: stub did not run, or its unrelated failure unexpectedly matched the refusal matcher"
    fi
fi

# ---- T3: orphan workspace vs the overlay cure ------------------------------
W3=$WORK/orphan
mkdir -p "$W3/nested/ant-extsig"
printf '[workspace]\nmembers = []\n' > "$W3/Cargo.toml"
cp -R "$SRC/." "$W3/nested/ant-extsig/"
# T3a: canonical manifest (no [workspace] table) nested under a parent workspace
if ( cd "$W3/nested/ant-extsig" && cargo metadata --no-deps --format-version 1 >"$WORK/t3a.out" 2>&1 ); then
    bad 3a "orphan-workspace error did NOT reproduce (cargo accepted a non-member under a parent workspace)"
else
    grep -q "believes it.s in a workspace" "$WORK/t3a.out" \
        && ok 3a "orphan-workspace error reproduced verbatim (runbook §6)" \
        || bad 3a "different error than the runbook's: $(tail -1 "$WORK/t3a.out")"
fi
# T3b: the overlay's [workspace] table in the same nest
cp "$OVERLAY" "$W3/nested/ant-extsig/Cargo.toml"
if ( cd "$W3/nested/ant-extsig" && cargo metadata --no-deps --format-version 1 >"$WORK/t3b.out" 2>&1 ); then
    ok 3b "overlay [workspace] table detaches the nested copy — cargo accepts"
else
    bad 3b "overlay manifest still rejected under the parent workspace: $(tail -1 "$WORK/t3b.out")"
fi

# ---- T4: source drift via REPRO_SRC_DIR ------------------------------------
D4=$WORK/drift-src
cp -R "$SRC" "$D4"
printf '\n// drift canary — selftest T4\n' >> "$D4/src/main.rs"
if REPRO_SRC_DIR="$D4" sh "$RUN" >"$WORK/t4.out" 2>&1; then
    bad 4 "runner built from a source tree that does NOT match the manifest"
else
    grep -q "source drift" "$WORK/t4.out" \
        && ok 4 "runner refused the drifted source tree (manifest check)" \
        || bad 4 "refusal was not the manifest guard: $(tail -1 "$WORK/t4.out")"
fi

# ---- T5a: the cleanup path guard (valid + traversal controls) --------------
G=$WORK/guardcase
mkdir -p "$G/ant-extsig-repro.selftest"
g_ok=0; g_bad=0
REPRO_TMP_BASE="$G" sh "$RUN" --test-validate-path "$G/ant-extsig-repro.selftest" \
    && g_ok=$((g_ok+1)) || g_bad=$((g_bad+1))
for p in "/" "" "$G/other.XXXXX" "$G/ant-extsig-repro.abc/../.." "$G/no-such/ant-extsig-repro.x" "$G/ant-extsig-repro.a/b"; do
    REPRO_TMP_BASE="$G" sh "$RUN" --test-validate-path "$p" \
        && g_bad=$((g_bad+1)) || g_ok=$((g_ok+1))
done
[ "$g_bad" = "0" ] && [ "$g_ok" = "7" ] \
    && ok 5a "path guard verdicts correct (1 valid direct child accepted; /, empty, foreign prefix, ..-traversal, not-a-dir, and nested-subpath all rejected)" \
    || bad 5a "path guard verdicts wrong: $g_ok accepted-side, $g_bad unexpected-side"

# ---- T5b: symlink escape (physical canonicalization) -----------------------
# the review's false-acceptance shape: logical path under the base, physical
# target outside it. True-symlink detection: Git Bash's ln -s silently COPIES
# unless native symlinks are enabled — a copy resolves physically INSIDE the
# base and would prove nothing, so it is a named SKIP, not a pass. Coverage
# attribution: hosts that can create true symlinks (e.g. Linux); NOT called
# CI coverage unless a CI job actually executes this test.
SB=$WORK/symtest
mkdir -p "$SB/allowed" "$SB/outside"
ln -s "$SB/outside" "$SB/allowed/ant-extsig-repro.link" 2>/dev/null || true
if [ -L "$SB/allowed/ant-extsig-repro.link" ] \
   && [ "$(cd "$SB/allowed/ant-extsig-repro.link" 2>/dev/null && pwd -P)" = "$(cd "$SB/outside" && pwd -P)" ]; then
    if REPRO_TMP_BASE="$SB/allowed" sh "$RUN" --test-validate-path "$SB/allowed/ant-extsig-repro.link" >/dev/null 2>&1; then
        bad 5b "symlink escape ACCEPTED (logical under base, physical outside) — guard still resolves logically"
    else
        ok 5b "symlink escape rejected — the guard canonicalizes physically (this probe demonstrates false acceptance was possible BEFORE the fix, not that deletion ever happened)"
    fi
else
    skipd 5b "this platform cannot create a true symlink (Git Bash copies by default); exercised on hosts that can (e.g. Linux)"
fi

# ---- T7: injected staging failure -> finalizer -----------------------------
# TMPDIR points the runner's scratch base at the ISOLATED per-test base
if TMPDIR="$ISO" REPRO_INJECT=fail-after-stage REPRO_SKIP_CHECK=1 sh "$RUN" >"$WORK/t7.out" 2>&1; then
    bad 7 "injected staging failure did not fail the run"
else
    if ! grep -q "INJECTED failure after staging" "$WORK/t7.out"; then
        bad 7 "failure was not the injected one: $(tail -1 "$WORK/t7.out")"
    elif [ "$(leftovers)" != "0" ]; then
        bad 7 "staging failure left scratch behind: $(ls -d "$ISO"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
    elif ! neighbors_intact; then
        bad 7 "an owned neighbor or the pre-existing legacy marker was damaged by the failure path"
    else
        ok 7 "staging failure: nonzero exit, isolated scratch cleaned by the finalizer, neighbors + legacy intact"
    fi
fi

# ---- T8: injected cargo failure (stub) -> finalizer ------------------------
printf '#!/bin/sh\necho "cargo-stub: simulated unrelated cargo failure" >&2\nexit 1\n' > "$STUBBIN/cargo-fail"
chmod +x "$STUBBIN/cargo-fail"
if TMPDIR="$ISO" REPRO_SKIP_CHECK=1 CARGO="$STUBBIN/cargo-fail" sh "$RUN" >"$WORK/t8.out" 2>&1; then
    bad 8 "stub cargo failure did not fail the run"
else
    if ! grep -q "cargo metadata --locked failed" "$WORK/t8.out"; then
        bad 8 "failure was not at the metadata phase: $(tail -1 "$WORK/t8.out")"
    elif [ "$(leftovers)" != "0" ]; then
        bad 8 "cargo failure left scratch behind: $(ls -d "$ISO"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
    elif ! neighbors_intact; then
        bad 8 "an owned neighbor or the pre-existing legacy marker was damaged by the failure path"
    else
        ok 8 "cargo failure: nonzero exit, isolated scratch cleaned by the finalizer, neighbors + legacy intact"
    fi
fi

# ---- T8b: TERM interruption mid-cargo -> finalizer -------------------------
printf '#!/bin/sh\nsleep 10\nexit 0\n' > "$STUBBIN/cargo-slow"
chmod +x "$STUBBIN/cargo-slow"
TMPDIR="$ISO" REPRO_SKIP_CHECK=1 CARGO="$STUBBIN/cargo-slow" sh "$RUN" >"$WORK/t8b.out" 2>&1 &
t8b_pid=$!
sleep 2
kill -TERM "$t8b_pid" 2>/dev/null
wait "$t8b_pid"; t8b_rc=$?
if [ "$t8b_rc" = "0" ]; then
    bad 8b "interrupted run exited 0 (original status not retained as nonzero)"
elif [ "$(leftovers)" != "0" ] && ! grep -q "finalizer:" "$WORK/t8b.out"; then
    bad 8b "interruption left scratch behind with NO kept-path receipt: $(ls -d "$ISO"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
elif ! neighbors_intact; then
    bad 8b "an owned neighbor or the pre-existing legacy marker was damaged by the interruption path"
else
    ok 8b "TERM mid-cargo: exit $t8b_rc, isolated scratch released (or explicitly named) by the finalizer, neighbors + legacy intact"
fi

# ---- T10: stubbed removal failure -> honest terminal receipt ---------------
# A no-op stub rm (exit 1, removes nothing) makes the finalizer's rm -rf
# fail WITHOUT any real permission change. Two contracts:
#   (a) with an original NONZERO status (injected staging failure), the
#       failure stays nonzero and the RETAINED owned path is named;
#   (b) on an otherwise SUCCESSFUL run, the failed removal escalates the
#       exit 0 to 1 and names the RETAINED owned path.
printf '#!/bin/sh\necho "rm-stub: simulated removal failure" >&2\nexit 1\n' > "$STUBBIN/rm"
chmod +x "$STUBBIN/rm"
PATH="$STUBBIN:$PATH" TMPDIR="$ISO" REPRO_INJECT=fail-after-stage REPRO_SKIP_CHECK=1 sh "$RUN" >"$WORK/t10a.out" 2>&1
t10a_rc=$?
if [ "$t10a_rc" = "0" ]; then
    bad 10 "removal failure on a failing run let the run exit 0"
elif ! grep -q "removal FAILED — owned scratch RETAINED" "$WORK/t10a.out"; then
    bad 10 "no honest RETAINED-path receipt on failed removal: $(tail -1 "$WORK/t10a.out")"
elif [ "$(leftovers)" != "1" ]; then
    bad 10 "expected exactly the one RETAINED scratch from the stub rm, found $(leftovers)"
elif ! neighbors_intact; then
    bad 10 "neighbors or legacy damaged during the removal-failure path"
else
    ok 10a "failed removal on a nonzero run: exit $t10a_rc preserved, RETAINED owned path named, scratch actually retained"
fi
# reset the isolated base between the two removal-failure cases so T10b
# counts exactly its own retained scratch (validated shapes only; the
# legacy marker's 8-char suffix is never matched by the 6-char glob)
for d in "$ISO"/ant-extsig-repro.??????; do
    [ -d "$d" ] || continue
    case "$d" in "$ISO"/ant-extsig-repro.??????) remove_owned "$d" "$ISO" ;; esac
done
PATH="$STUBBIN:$PATH" TMPDIR="$ISO" REPRO_SKIP_CHECK=1 sh "$RUN" >"$WORK/t10b.out" 2>&1
t10b_rc=$?
if [ "$t10b_rc" != "1" ]; then
    bad 10 "failed removal on a SUCCESSFUL run must escalate exit 0 to 1, got $t10b_rc"
elif ! grep -q "removal FAILED — owned scratch RETAINED" "$WORK/t10b.out"; then
    bad 10 "no honest RETAINED-path receipt on the success-path removal failure: $(tail -1 "$WORK/t10b.out")"
elif [ "$(leftovers)" != "1" ]; then
    bad 10 "expected exactly the one RETAINED scratch from the stub rm, found $(leftovers)"
elif ! neighbors_intact; then
    bad 10 "neighbors or legacy damaged during the success-path removal failure"
else
    ok 10b "failed removal on a successful run: exit escalated 0 -> 1, RETAINED owned path named"
fi

# reclaim the stub-rm cases' retained scratches (validated shapes only) so
# T9 asserts the final state of the isolated base
for d in "$ISO"/ant-extsig-repro.??????; do
    [ -d "$d" ] || continue
    case "$d" in "$ISO"/ant-extsig-repro.??????) remove_owned "$d" "$ISO" ;; esac
done

# ---- T9: owned neighbor + pre-existing legacy survived everything ----------
if neighbors_intact && [ "$(leftovers)" = "0" ]; then
    ok 9 "owned neighbor intact and pre-existing legacy marker byte-identical through every path; no scratch left in the isolated base"
else
    bad 9 "final state wrong: leftovers=$(leftovers), neighbors_intact=$(neighbors_intact && echo yes || echo no)"
fi

# ---- T6: canonical tree untouched by everything above ----------------------
t6=yes
while IFS= read -r line; do
    case "$line" in \#*|"") continue ;; esac
    want=$(printf '%s\n' "$line" | awk '{print $1}')
    rel=$(printf '%s\n' "$line" | awk '{print $2}')
    sub=${rel#ops/ant-extsig/}
    got=$(sha256sum "$SRC/$sub" 2>/dev/null | cut -d' ' -f1)
    [ "$got" = "$want" ] || t6="no ($rel)"
done < "$REPRO_ROOT/source-manifest.sha256"
[ "$t6" = "yes" ] && ok 6 "canonical ops/ant-extsig still matches the manifest byte-for-byte" \
    || bad 6 "canonical tree drifted: $t6"

# ---- suite cleanup: every removal is of an OWNED allocation, physically
# validated; the legacy marker's integrity is asserted one final time
# BEFORE anything of ours that could theoretically touch the base is removed
# (the runner never touches it — this asserts the suite's own discipline too)
if [ "$(sha256sum "$LEGACY/sentinel.txt" 2>/dev/null | cut -d' ' -f1)" != "$legacy_digest_before" ]; then
    echo "selftest: LEGACY MARKER CHANGED — this is a suite bug" >&2; fail=$((fail+1))
fi
for d in "$ISO"/ant-extsig-repro.??????; do
    [ -d "$d" ] || continue
    case "$d" in "$ISO"/ant-extsig-repro.??????) remove_owned "$d" "$ISO" || echo "selftest: could not remove retained scratch $d" >&2 ;; esac
done
case "$NEIGHBOR" in
    "$ISO"/ant-extsig-repro-neighb.*) phys_under "$NEIGHBOR" "$ISO" && remove_owned "$NEIGHBOR" "$ISO" \
        || echo "selftest: NEIGHBOR failed physical validation — KEPT: $NEIGHBOR" >&2 ;;
    *) echo "selftest: NEIGHBOR path unexpected — KEPT: $NEIGHBOR" >&2 ;;
esac
remove_owned "$LEGACY" "$ISO"  # suite-owned fixture (planted by this suite), role complete
case "$ISO" in
    "$BASE"/ant-extsig-repro-selftest-iso.*) phys_under "$ISO" "$BASE" && remove_owned "$ISO" "$BASE" \
        || echo "selftest: ISO failed physical validation — KEPT: $ISO" >&2 ;;
    *) echo "selftest: ISO path unexpected — KEPT: $ISO" >&2 ;;
esac
# WORK cleanup with the same physical discipline as the runner's guard
work_phys=$(cd "$WORK" 2>/dev/null && pwd -P) || work_phys=""
base_phys=$(cd "$BASE" 2>/dev/null && pwd -P) || base_phys=""
case "$WORK" in
    "$BASE"/ant-extsig-repro-selftest.*)
        case "$work_phys" in
            "$base_phys"/ant-extsig-repro-selftest.*) remove_owned "$WORK" "$BASE" ;;
            *) echo "selftest: WORK failed physical validation — KEPT: $WORK" >&2 ;;
        esac ;;
    *) echo "selftest: WORK path unexpected — KEPT: $WORK" >&2 ;;
esac
echo "selftest: $pass passed, $fail failed, $skip skipped"
[ "$fail" = "0" ] || exit 1
exit 0
