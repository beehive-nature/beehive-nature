#!/bin/sh
# ant-extsig-repro selftest — proves the runner's refusal laws locally with
# synthetic cases only (no box, no execution of the harness, nothing in ops/
# or the repo root modified; cargo cases use ordinary dependency fetching).
#
#   T1a missing COMMITTED lock   -> runner refuses before any cargo run
#   T1b missing BUILD lock       -> cargo --locked refuses to create one
#   T2a tampered COMMITTED lock  -> runner's banked-sha assertion refuses
#   T2b tampered BUILD lock      -> cargo --locked refuses AND leaves the
#                                   tampered lock byte-unchanged (no rewrite)
#   T3a orphan workspace (no overlay [workspace] table, copy nested under a
#       parent workspace) -> cargo refuses with the runbook §6 error
#   T3b same nest WITH the overlay -> cargo accepts (the cure)
#   T4  source drift (canonical copy tampered, fed via REPRO_SRC_DIR)
#       -> runner's manifest check refuses and names nothing actionable
#   T5  cleanup path guard: accepts only this runner's validated scratch
#       paths; rejects /, empty, foreign prefixes, and ..-traversal
#   T6  canonical ops/ant-extsig digests still equal the committed manifest
#       after all cases (the tree was never touched)
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
GUARDBASE=$BASE            # run.sh test hook defaults REPRO_TMP_BASE to TMPDIR

pass=0; fail=0
ok()  { pass=$((pass+1)); echo "T$1 PASS — $2"; }
bad() { fail=$((fail+1)); echo "T$1 FAIL — $2" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing tool: $1" >&2; exit 1; }; }
need sha256sum; need cargo; need sed; need awk

# direct cargo cases below run outside the repo too — same toolchain pin law
if command -v rustup >/dev/null 2>&1 && [ -f "$REPO_ROOT/rust-toolchain.toml" ]; then
    _pin=$(sed -n 's/^channel *= *"\(.*\)".*/\1/p' "$REPO_ROOT/rust-toolchain.toml" | head -1)
    [ -n "$_pin" ] && RUSTUP_TOOLCHAIN=$_pin && export RUSTUP_TOOLCHAIN
fi

WORK=$(mktemp -d "$BASE/ant-extsig-repro-selftest.XXXXXX") || exit 1

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
    grep -qi "lock file\|--locked\|locked" "$WORK/t1b.out" \
        && ok 1b "cargo --locked refused to create a lock: $(grep -m1 -io 'the lock file[^.]*\|cannot create the lock file[^.]*' "$WORK/t1b.out" | head -1)" \
        || bad 1b "cargo failed for an unrelated reason: $(tail -1 "$WORK/t1b.out")"
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
B2=$WORK/build-tampered
sh "$RUN" --stage "$B2" >"$WORK/t2b.stage" 2>&1 || { bad 2b "staging failed: $(tail -1 "$WORK/t2b.stage")"; }
sed -i 's/^version = "0.18.1"$/version = "0.18.2"/' "$B2/Cargo.lock"
tampered_sha=$(sha256sum "$B2/Cargo.lock" | cut -d' ' -f1)
if ( cd "$B2" && cargo metadata --locked --format-version 1 >"$WORK/t2b.out" 2>&1 ); then
    bad 2b "cargo --locked ACCEPTED a lock whose ant-node no longer satisfies the =0.18.1 requirement"
else
    post_sha=$(sha256sum "$B2/Cargo.lock" | cut -d' ' -f1)
    if [ "$post_sha" != "$tampered_sha" ]; then
        bad 2b "cargo REWROTE the tampered lock despite --locked"
    else
        ok 2b "cargo --locked refused the drifted lock and left it byte-unchanged: $(grep -m1 -o 'the lock file[^.]*' "$WORK/t2b.out" | head -1)"
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

# ---- T5: the cleanup path guard --------------------------------------------
G=$WORK/guardcase
mkdir -p "$G/ant-extsig-repro.selftest"
g_ok=0; g_bad=0
REPRO_TMP_BASE="$G" sh "$RUN" --test-validate-path "$G/ant-extsig-repro.selftest" \
    && g_ok=$((g_ok+1)) || g_bad=$((g_bad+1))
for p in "/" "" "$G/other.XXXXX" "$G/ant-extsig-repro.abc/../.." "$G/no-such/ant-extsig-repro.x"; do
    REPRO_TMP_BASE="$G" sh "$RUN" --test-validate-path "$p" \
        && g_bad=$((g_bad+1)) || g_ok=$((g_ok+1))
done
[ "$g_bad" = "0" ] && [ "$g_ok" = "6" ] \
    && ok 5 "path guard verdicts correct (the 1 valid scratch accepted; /, empty, foreign prefix, ..-traversal, and not-a-dir all rejected)" \
    || bad 5 "path guard verdicts wrong: $g_ok accepted-side, $g_bad unexpected-side"

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

case "$WORK" in
    "$BASE"/ant-extsig-repro-selftest.*) rm -rf "$WORK" ;;
    *) echo "selftest: scratch path unexpected — KEPT: $WORK" >&2 ;;
esac
echo "selftest: $pass passed, $fail failed"
[ "$fail" = "0" ] || exit 1
exit 0
