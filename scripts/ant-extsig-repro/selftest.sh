#!/bin/sh
# ant-extsig-repro selftest — proves the runner's refusal and finalization
# laws locally with synthetic cases only (no box, no execution of the
# harness, nothing in ops/ or the repo root modified; cargo cases use
# ordinary dependency fetching, the stub controls are fully offline).
#
# r2 (Astra review #10 5648317459):
#   T2b now REQUIRES the expected lock-update refusal text — any unrelated
#   cargo failure no longer passes; T2c proves it with an offline stub whose
#   failure is unrelated (the matcher must NOT match it).
#   T5b adds the symlink-escape regression: a path logically under the base
#   but physically outside must be REJECTED (the review's false-acceptance
#   probe; skipped with a named SKIP only where the platform cannot create a
#   true symlink). T5a keeps the traversal/valid controls.
#   T7/T8/T8b drive the failure/interruption finalizer: injected staging
#   failure, injected cargo failure, and a TERM mid-run — each must clean
#   the validated scratch (or name a kept path), keep the canonical tree at
#   its pre-staging baseline, and never remove unrelated neighbors (T9).
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
#       shape; rejects /, empty, foreign prefixes, ..-traversal, not-a-dir
#   T5b symlink escape -> rejected via physical canonicalization (SKIP
#       named where no true symlink can be created)
#   T7  injected staging failure -> finalizer cleans scratch, nonzero exit,
#       canonical baseline intact
#   T8  injected cargo failure (stub) -> same contract
#   T8b TERM interruption mid-cargo -> same contract (cleanup or explicit
#       kept-path receipt), original status nonzero
#   T9  unrelated neighbors survive every cleanup path
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
# an UNRELATED neighbor that must survive every cleanup path (T9 asserts it)
SURVIVOR="$BASE/z1c-selftest-unrelated-marker.dir"
mkdir -p "$SURVIVOR"
printf 'unrelated\n' > "$SURVIVOR/payload.txt"
# runner-shaped scratch leftovers, if any (mktemp suffix = 6 chars)
leftovers() { ls -d "$BASE"/ant-extsig-repro.?????? 2>/dev/null | wc -l; }

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
# base and would prove nothing, so it is a named SKIP, not a pass.
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
    skipd 5b "this platform cannot create a true symlink (Git Bash copies by default); exercised on Linux/CI"
fi

# ---- T7: injected staging failure -> finalizer -----------------------------
if REPRO_INJECT=fail-after-stage REPRO_SKIP_CHECK=1 sh "$RUN" >"$WORK/t7.out" 2>&1; then
    bad 7 "injected staging failure did not fail the run"
else
    if ! grep -q "INJECTED failure after staging" "$WORK/t7.out"; then
        bad 7 "failure was not the injected one: $(tail -1 "$WORK/t7.out")"
    elif [ "$(leftovers)" != "0" ]; then
        bad 7 "staging failure left scratch behind: $(ls -d "$BASE"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
    elif [ ! -f "$SURVIVOR/payload.txt" ]; then
        bad 7 "an unrelated neighbor was removed by the failure path"
    else
        ok 7 "staging failure: nonzero exit, scratch cleaned by the finalizer, unrelated neighbors intact"
    fi
fi

# ---- T8: injected cargo failure (stub) -> finalizer ------------------------
printf '#!/bin/sh\necho "cargo-stub: simulated unrelated cargo failure" >&2\nexit 1\n' > "$STUBBIN/cargo-fail"
chmod +x "$STUBBIN/cargo-fail"
if REPRO_SKIP_CHECK=1 CARGO="$STUBBIN/cargo-fail" sh "$RUN" >"$WORK/t8.out" 2>&1; then
    bad 8 "stub cargo failure did not fail the run"
else
    if ! grep -q "cargo metadata --locked failed" "$WORK/t8.out"; then
        bad 8 "failure was not at the metadata phase: $(tail -1 "$WORK/t8.out")"
    elif [ "$(leftovers)" != "0" ]; then
        bad 8 "cargo failure left scratch behind: $(ls -d "$BASE"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
    elif [ ! -f "$SURVIVOR/payload.txt" ]; then
        bad 8 "an unrelated neighbor was removed by the failure path"
    else
        ok 8 "cargo failure: nonzero exit, scratch cleaned by the finalizer, unrelated neighbors intact"
    fi
fi

# ---- T8b: TERM interruption mid-cargo -> finalizer -------------------------
printf '#!/bin/sh\nsleep 10\nexit 0\n' > "$STUBBIN/cargo-slow"
chmod +x "$STUBBIN/cargo-slow"
REPRO_SKIP_CHECK=1 CARGO="$STUBBIN/cargo-slow" sh "$RUN" >"$WORK/t8b.out" 2>&1 &
t8b_pid=$!
sleep 2
kill -TERM "$t8b_pid" 2>/dev/null
wait "$t8b_pid"; t8b_rc=$?
if [ "$t8b_rc" = "0" ]; then
    bad 8b "interrupted run exited 0 (original status not retained as nonzero)"
elif [ "$(leftovers)" != "0" ] && ! grep -q "finalizer:" "$WORK/t8b.out"; then
    bad 8b "interruption left scratch behind with NO kept-path receipt: $(ls -d "$BASE"/ant-extsig-repro.?????? 2>/dev/null | tr '\n' ' ')"
elif [ ! -f "$SURVIVOR/payload.txt" ]; then
    bad 8b "an unrelated neighbor was removed by the interruption path"
else
    ok 8b "TERM mid-cargo: exit $t8b_rc, scratch released (or explicitly named) by the finalizer, neighbors intact"
fi

# ---- T9: unrelated neighbors survived everything ---------------------------
if [ -f "$SURVIVOR/payload.txt" ] && grep -q unrelated "$SURVIVOR/payload.txt"; then
    ok 9 "unrelated neighbor $SURVIVOR survived all cleanup paths"
else
    bad 9 "the unrelated neighbor did not survive"
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

# cleanup with the same physical discipline as the runner's guard
work_phys=$(cd "$WORK" 2>/dev/null && pwd -P) || work_phys=""
base_phys=$(cd "$BASE" 2>/dev/null && pwd -P) || base_phys=""
case "$WORK" in
    "$BASE"/ant-extsig-repro-selftest.*)
        case "$work_phys" in
            "$base_phys"/ant-extsig-repro-selftest.*) rm -rf "$WORK" ;;
            *) echo "selftest: WORK failed physical validation — KEPT: $WORK" >&2 ;;
        esac ;;
    *) echo "selftest: WORK path unexpected — KEPT: $WORK" >&2 ;;
esac
rm -rf "$SURVIVOR"
echo "selftest: $pass passed, $fail failed, $skip skipped"
[ "$fail" = "0" ] || exit 1
exit 0
