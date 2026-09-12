#!/bin/sh
# ant-extsig-repro — the isolated reproducible-build runner for the
# ops/ant-extsig member-write harness (Sprint 2, z1.c; assignment
# beehive-nature/beehive-nature#10 comment 5647975452; r2 corrections per
# Astra's review #10 comment 5648317459).
#
# LAW OF THIS RUNNER (all fail-closed, one generic diagnostic + nonzero exit):
#   1. The canonical ops/ant-extsig tree is READ-ONLY: the source is COPIED
#      into a throwaway scratch directory; a baseline digest taken BEFORE
#      staging is asserted UNCHANGED on EVERY exit — success, failure, or
#      trapped signal (the finalizer, law 6). It never builds in ops/ or the
#      repo root.
#   2. Source drift refuses the run: every file under ops/ant-extsig must
#      match scripts/ant-extsig-repro/source-manifest.sha256 (content AND
#      file set) — the committed candidate lock/overlay are only meaningful
#      against that exact source.
#   3. Lock drift refuses the run: the committed candidate lock
#      (scripts/ant-extsig-repro/lock/Cargo.lock) must be byte-identical to
#      the banked box lock and carry the banked pins (ant-core git
#      969ed008d9cd39bbfe6466bc5ff7943914565994, ant-node 0.18.1,
#      ant-protocol 2.3.5 — exact); every cargo invocation runs --locked
#      with the staged lock's sha256 asserted unchanged afterwards.
#   4. PHYSICAL scratch cleanup, validated before any rm -rf (Astra r2-1):
#      the scratch dir must be an OWNED DIRECT child of the mktemp base —
#      matching this runner's name prefix with no further path segment —
#      and must resolve PHYSICALLY (pwd -P, symlink-transparent) under the
#      physically-canonicalized base. A symlink whose logical path sits
#      under the base but physically escapes it is REJECTED (the review's
#      false-acceptance probe). On any doubt the directory is KEPT and
#      named, never deleted.
#   5. No execution of the built harness: cargo check/build only. The
#      harness main() starts an 8-node LocalDevnet + Anvil — running it is
#      outside this lane (no node/devnet/listener).
#   6. Failure/interruption finalization (Astra r2-2): the moment scratch
#      ownership is acquired, an EXIT/HUP/INT/TERM finalizer is installed.
#      It retains the original failure status, validates every scratch path
#      physically before cleanup, honors REPRO_KEEP (explicit kept-path
#      receipt), and asserts the canonical baseline on failure paths too.
#
# THE LOCK AND ITS ONE-LINE ALIGNMENT: the committed candidate lock is the
# box lockfile ~/ant-lane/ant-extsig/Cargo.lock pulled read-only 2026-09-12
# (sha256 BANKED_LOCK_SHA below), byte-identical — the graph the
# fence-readiness runbook receipted `cargo metadata --locked` exit 0 against.
# It was generated from an UNPINNED ant-core git dep, so its ant-core source
# line is "git+URL#<commit>". The overlay pins rev=<same commit>, which
# cargo spells "git+URL?rev=<commit>#<commit>" — same commit, same graph,
# different source-id spelling. stage_dir() aligns exactly that ONE line in
# the staged copy (refusing if the alignment touches anything else); the
# COMMITTED lock stays byte-identical to the box's. This is a BUILD pin for
# the harness only — it is NOT the (still untested) production auto-upgrade
# hold of runbook §3.
#
# Usage:                 sh scripts/ant-extsig-repro/run.sh
# Optional env (TESTS):  REPRO_SRC_DIR  — override canonical source dir
#                                   (selftest T4 source-drift case only)
#                        REPRO_SKIP_CHECK=1 — skip the cargo check phase
#                                   (selftest speed; main receipt must not)
#                        REPRO_BUILD=1  — also run cargo build --locked
#                        REPRO_KEEP=1   — finalizer keeps scratch, printing
#                                   an explicit kept-path receipt
#                        CARGO          — cargo binary override (preflight
#                                   still requires a real cargo on PATH)
#                        REPRO_INJECT   — TEST-ONLY failure injection for
#                                   the finalizer regressions:
#                                   'fail-after-stage' dies right after
#                                   staging; 'fail-cargo' dies at the first
#                                   cargo invocation. Never set in real runs.
# Internal hooks:        run.sh --test-validate-path <path>
#                                   (cleanup-guard verdict for selftest T5)
#                        run.sh --stage <empty-or-missing-dir>
#                                   (stage a build copy exactly as the
#                                   runner does; selftest T1b/T2b use it)
set -u

BANKED_CORE_REV="969ed008d9cd39bbfe6466bc5ff7943914565994"
BANKED_NODE_VER="0.18.1"
BANKED_PROTOCOL_VER="2.3.5"
BANKED_LOCK_SHA="0312ab19ac8082767b71e334743784e67a9f54386f105a1e12d99f922019aa86"  # PUBLIC-CONSTANT (sha256 of the public box Cargo.lock)

REPRO_ROOT=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$REPRO_ROOT/../.." && pwd)
SRC_DIR=${REPRO_SRC_DIR:-$REPO_ROOT/ops/ant-extsig}
OVERLAY=$REPRO_ROOT/overlay/Cargo.toml
MANIFEST=$REPRO_ROOT/source-manifest.sha256
LOCK=$REPRO_ROOT/lock/Cargo.lock

die() { echo "ant-extsig-repro: $1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing tool: $1"; }

# physical canonicalization (Astra r2-1): pwd -P resolves symlinks; logical
# pwd preserves them and let a base-external target pass as base-internal.
phys_pwd() { (cd "$1" 2>/dev/null && pwd -P) || return 1; }

# ---- the cleanup guard (law 4) -------------------------------------------
# Accepts a scratch dir only if it is non-empty, is an OWNED DIRECT child of
# the mktemp base (this runner's prefix, no deeper path segment), carries no
# .. traversal, and PHYSICALLY resolves under the physically-resolved base.
REPRO_TMP_BASE_RESOLVED=""
REPRO_TMP_BASE_PHYS=""
validate_scratch_path() {
    p=${1:-}
    [ -n "$p" ] || return 1
    [ "$p" != "/" ] || return 1
    case "$p" in
        "$REPRO_TMP_BASE"/ant-extsig-repro.*) ;;
        *) return 1 ;;
    esac
    case "$p" in */../*|*..) return 1 ;; esac
    # owned DIRECT scratch child: nothing after the mktemp segment
    tail=${p#"$REPRO_TMP_BASE"/}
    case "$tail" in ant-extsig-repro.*/*) return 1 ;; esac
    [ -d "$p" ] || return 1
    resolved=$(phys_pwd "$p") || return 1
    [ -n "$REPRO_TMP_BASE_PHYS" ] || return 1
    case "$resolved" in
        "$REPRO_TMP_BASE_PHYS"/ant-extsig-repro.*) ;;
        *) return 1 ;;
    esac
    # physical resolution may land deeper through symlinks — still must be
    # a direct child shape of the physical base
    ptail=${resolved#"$REPRO_TMP_BASE_PHYS"/}
    case "$ptail" in ant-extsig-repro.*/*) return 1 ;; esac
    return 0
}

# ---- staging: canonical source + overlay + aligned lock, into a copy ------
# Prints the staged (aligned) lock's sha256 on stdout. NEVER touches the
# canonical tree: every write goes to $1.
stage_dir() {
    target=${1:?stage_dir needs a target dir}
    cp -R "$SRC_DIR/." "$target/" || return 1
    cp "$OVERLAY" "$target/Cargo.toml" || return 1
    cp "$LOCK" "$target/Cargo.lock" || return 1
    # the one-line source-id alignment (see header): unpinned spelling ->
    # rev-pinned spelling, SAME commit. Refuse if it touches anything else.
    sed -i "s|source = \"git+https://github.com/WithAutonomi/ant-client#${BANKED_CORE_REV}\"|source = \"git+https://github.com/WithAutonomi/ant-client?rev=${BANKED_CORE_REV}#${BANKED_CORE_REV}\"|" "$target/Cargo.lock" || return 1
    n_touched=$(grep -c "WithAutonomi/ant-client?rev=${BANKED_CORE_REV}#${BANKED_CORE_REV}" "$target/Cargo.lock")
    [ "$n_touched" = "1" ] || return 1
    n_plain=$(grep -c "WithAutonomi/ant-client#${BANKED_CORE_REV}" "$target/Cargo.lock")
    [ "$n_plain" = "0" ] || return 1
    total_lines_before=$(wc -l < "$LOCK")
    total_lines_after=$(wc -l < "$target/Cargo.lock")
    [ "$total_lines_after" = "$total_lines_before" ] || return 1
    sha256sum "$target/Cargo.lock" | cut -d' ' -f1
}

# ---- the finalizer (law 6) -------------------------------------------------
# Installed the moment scratch ownership is acquired. Retains the original
# status (signal traps force the conventional nonzero), validates every
# scratch path PHYSICALLY before cleanup, CHECKS EACH REMOVAL's status (a
# failed rm -rf is reported with the retained owned path and escalates a
# zero exit to failure — an existing nonzero status is never overwritten or
# hidden), honors REPRO_KEEP with an explicit kept-path receipt, and asserts
# the canonical baseline on every exit.
SCRATCH=""
SCRATCH2=""
CANON_BASELINE=""
canon_intact() { [ "$(tree_digest)" = "$CANON_BASELINE" ]; }
_escalate_on_zero() { [ "$_rc" = "0" ] && _rc=1; return 0; }
_finalizer() {
    _rc=$?          # MUST be the first command: any earlier command clobbers it
    _forced_rc=${1:-}
    trap - EXIT HUP INT TERM
    [ -n "$_forced_rc" ] && _rc=$_forced_rc
    if [ "${REPRO_KEEP:-0}" = "1" ]; then
        echo "ant-extsig-repro: finalizer: scratch KEPT (REPRO_KEEP):${SCRATCH:+ $SCRATCH}${SCRATCH2:+ $SCRATCH2}" >&2
    else
        for _d in "$SCRATCH" "$SCRATCH2"; do
            [ -n "$_d" ] || continue
            if validate_scratch_path "$_d"; then
                if ! rm -rf "$_d"; then
                    echo "ant-extsig-repro: finalizer: removal FAILED — owned scratch RETAINED, remove manually after inspection: $_d" >&2
                    _escalate_on_zero
                fi
            else
                echo "ant-extsig-repro: finalizer: scratch failed physical validation — KEPT (inspect manually): $_d" >&2
                _escalate_on_zero
            fi
        done
    fi
    if ! canon_intact; then
        echo "ant-extsig-repro: finalizer: CANONICAL TREE CHANGED vs pre-staging baseline — ops/ant-extsig must never be modified" >&2
        _escalate_on_zero
    fi
    exit "$_rc"
}
install_finalizer() {
    trap '_finalizer' EXIT
    trap '_finalizer 129' HUP
    trap '_finalizer 130' INT
    trap '_finalizer 143' TERM
}

# hidden test hooks (selftest only)
case "${1:-}" in
--test-validate-path)
    REPRO_TMP_BASE=${REPRO_TMP_BASE:-${TMPDIR:-/tmp}}
    REPRO_TMP_BASE_RESOLVED=$(cd "$REPRO_TMP_BASE" 2>/dev/null && pwd) \
        || die "bad REPRO_TMP_BASE"
    REPRO_TMP_BASE_PHYS=$(phys_pwd "$REPRO_TMP_BASE") || die "bad REPRO_TMP_BASE (physical)"
    validate_scratch_path "${2:-}" && exit 0 || exit 1
    ;;
--stage)
    [ -d "$2" ] && [ -n "$(ls -A "$2" 2>/dev/null)" ] && die "--stage target not empty: $2"
    mkdir -p "$2" || die "cannot create --stage target: $2"
    [ -f "$SRC_DIR/Cargo.toml" ] || die "canonical source dir not found: $SRC_DIR"
    staged=$(stage_dir "$2") || die "staging failed"
    echo "staged lock sha256: $staged"
    exit 0
    ;;
esac

# ---- phase 0: preflight ---------------------------------------------------
need sha256sum; need cargo; need awk; need sed; need find; need diff
CARGO=${CARGO:-cargo}
# The scratch build dir sits OUTSIDE the repo, so rustup's directory walk
# cannot see the estate's rust-toolchain.toml pin (1.98.1 — what CI and the
# box run, and what generated the candidate lock). Export it explicitly so
# the isolated build rides the pinned toolchain, not the host default.
if command -v rustup >/dev/null 2>&1 && [ -f "$REPO_ROOT/rust-toolchain.toml" ]; then
    toolchain_pin=$(sed -n 's/^channel *= *"\(.*\)".*/\1/p' "$REPO_ROOT/rust-toolchain.toml" | head -1)
    if [ -n "$toolchain_pin" ]; then
        RUSTUP_TOOLCHAIN=$toolchain_pin
        export RUSTUP_TOOLCHAIN
    fi
fi
[ -d "$SRC_DIR" ] || die "canonical source dir not found: $SRC_DIR"
[ -f "$OVERLAY" ] || die "overlay manifest not found: $OVERLAY"
[ -f "$MANIFEST" ] || die "source manifest not found: $MANIFEST"
[ -f "$LOCK" ] || die "candidate lockfile not found: $LOCK"

# ---- phase 1: source-manifest verification (law 2) ------------------------
manifest_check() {
    # expected file set (source-dir-relative: strip the ops/ant-extsig/ prefix)
    exp=$(awk '!/^#/ && NF {print $2}' "$MANIFEST" | sed 's|^ops/ant-extsig/||' | LC_ALL=C sort)
    [ -n "$exp" ] || die "source manifest carries no entries"
    # actual file set under the canonical dir
    act=$(cd "$SRC_DIR" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
    [ "$exp" = "$act" ] || die "source drift: file set under the canonical tree differs from the manifest (added or removed file)"
    # per-file digests
    while IFS= read -r line; do
        case "$line" in \#*|"") continue ;; esac
        want=$(printf '%s\n' "$line" | awk '{print $1}')
        rel=$(printf '%s\n' "$line" | awk '{print $2}')
        sub=${rel#ops/ant-extsig/}
        [ "$sub" != "$rel" ] || die "source manifest path outside ops/ant-extsig: $rel"
        got=$(sha256sum "$SRC_DIR/$sub" 2>/dev/null | cut -d' ' -f1)
        [ "$got" = "$want" ] || die "source drift: $rel no longer matches its manifest digest"
    done < "$MANIFEST"
}
manifest_check

# ---- phase 2: committed-lock pin assertions (law 3) -----------------------
lock_sha=$(sha256sum "$LOCK" | cut -d' ' -f1)
[ "$lock_sha" = "$BANKED_LOCK_SHA" ] \
    || die "committed candidate lock is not the banked box lock (sha256 mismatch)"
core_src=$(grep -A2 '^name = "ant-core"$' "$LOCK" | grep '^source = ' | head -1)
printf '%s' "$core_src" | grep -q \
    "git+https://github.com/WithAutonomi/ant-client#$BANKED_CORE_REV" \
    || die "candidate lock does not pin ant-core at the banked rev"
node_ver=$(grep -A1 '^name = "ant-node"$' "$LOCK" | grep '^version = ' | head -1)
printf '%s' "$node_ver" | grep -q "version = \"$BANKED_NODE_VER\"" \
    || die "candidate lock does not carry ant-node $BANKED_NODE_VER"
proto_ver=$(grep -A1 '^name = "ant-protocol"$' "$LOCK" | grep '^version = ' | head -1)
printf '%s' "$proto_ver" | grep -q "version = \"$BANKED_PROTOCOL_VER\"" \
    || die "candidate lock does not carry ant-protocol $BANKED_PROTOCOL_VER"
n_git=$(grep -c 'git+https://github.com/WithAutonomi/ant-client' "$LOCK")
[ "$n_git" = "1" ] || die "candidate lock must reference ant-client git exactly once (found $n_git)"
n_pkgs=$(grep -c '^name = ' "$LOCK")

# ---- phase 3: scratch + staging (laws 1, 4, 6) -----------------------------
tree_digest() { (cd "$SRC_DIR" && find . -type f -exec sha256sum {} \; | LC_ALL=C sort); }
# baseline BEFORE any scratch write — the finalizer asserts it on every exit
CANON_BASELINE=$(tree_digest) || die "cannot digest the canonical tree"

REPRO_TMP_BASE=${TMPDIR:-/tmp}
[ -n "$REPRO_TMP_BASE" ] || REPRO_TMP_BASE=/tmp
REPRO_TMP_BASE_RESOLVED=$(cd "$REPRO_TMP_BASE" 2>/dev/null && pwd) \
    || die "scratch base unusable: $REPRO_TMP_BASE"
REPRO_TMP_BASE_PHYS=$(phys_pwd "$REPRO_TMP_BASE") \
    || die "scratch base unusable (physical): $REPRO_TMP_BASE"
SCRATCH=$(mktemp -d "$REPRO_TMP_BASE/ant-extsig-repro.XXXXXX") \
    || die "mktemp failed under $REPRO_TMP_BASE"
validate_scratch_path "$SCRATCH" || die "scratch path failed its own validation guard"
install_finalizer
BUILD=$SCRATCH/build/ant-extsig
mkdir -p "$BUILD" || die "cannot create build dir"
staged_lock_sha=$(stage_dir "$BUILD") \
    || die "staging failed (source copy, overlay, or the one-line lock alignment)"
[ -n "$staged_lock_sha" ] || die "staging produced no lock digest"
[ "${REPRO_INJECT:-}" = "fail-after-stage" ] \
    && die "INJECTED failure after staging (selftest finalizer regression)"

assert_lock_unchanged() {
    now=$(sha256sum "$BUILD/Cargo.lock" | cut -d' ' -f1)
    [ "$now" = "$staged_lock_sha" ] || die "LOCK DRIFT: Cargo.lock changed inside the locked build (cargo rewrote it or requirements disagree)"
}

# ---- phase A: the explicit Cargo graph receipt (locked) --------------------
[ "${REPRO_INJECT:-}" = "fail-cargo" ] \
    && die "INJECTED cargo failure (selftest finalizer regression)"
graph_out=$SCRATCH/graph-metadata.json
( cd "$BUILD" && "$CARGO" metadata --locked --format-version 1 >"$graph_out" 2>"$SCRATCH/graph.stderr" ) \
    || { tail -5 "$SCRATCH/graph.stderr" >&2; die "cargo metadata --locked failed"; }
assert_lock_unchanged

# ---- phase B: locked check (compilation; never executed) -------------------
check_status=SKIPPED
if [ "${REPRO_SKIP_CHECK:-0}" != "1" ]; then
    if ( cd "$BUILD" && "$CARGO" check --locked >"$SCRATCH/check.log" 2>&1 ); then
        check_status=OK
        assert_lock_unchanged
    else
        grep -m1 -A3 '^error' "$SCRATCH/check.log" >&2 || true
        die "cargo check --locked FAILED (first error above; full log: $SCRATCH/check.log)"
    fi
fi
build_status=SKIPPED
if [ "${REPRO_BUILD:-0}" = "1" ] && [ "$check_status" = "OK" ]; then
    if ( cd "$BUILD" && "$CARGO" build --locked >"$SCRATCH/build.log" 2>&1 ); then
        build_status=OK
        assert_lock_unchanged
    else
        grep -m1 -A3 '^error' "$SCRATCH/build.log" >&2 || true
        die "cargo build --locked FAILED (first error above; full log: $SCRATCH/build.log)"
    fi
fi

# ---- phase C: second locked resolution in a fresh copy (law 3) -------------
SCRATCH2=$(mktemp -d "$REPRO_TMP_BASE/ant-extsig-repro.XXXXXX") \
    || die "mktemp failed for the second resolution copy"
validate_scratch_path "$SCRATCH2" || die "second scratch path failed its validation guard"
BUILD2=$SCRATCH2/build/ant-extsig
mkdir -p "$BUILD2"
staged2=$(stage_dir "$BUILD2") || die "staging failed for the second resolution copy"
[ "$staged2" = "$staged_lock_sha" ] \
    || die "second staging produced a different lock digest"
( cd "$BUILD2" && "$CARGO" metadata --locked --format-version 1 >"$SCRATCH/second-resolution.json" 2>"$SCRATCH/second.stderr" ) \
    || { tail -5 "$SCRATCH/second.stderr" >&2; die "second locked resolution failed"; }
second_lock_sha=$(sha256sum "$BUILD2/Cargo.lock" | cut -d' ' -f1)
[ "$second_lock_sha" = "$staged_lock_sha" ] \
    || die "LOCK DRIFT: the second locked resolution rewrote the lock"

# ---- phase 4: canonical-untouched assertion (law 1; also enforced on every
# failure path by the finalizer) ---------------------------------------------
canon_intact \
    || die "CANONICAL TREE CHANGED during the run — ops/ant-extsig must never be modified"

# ---- phase 5: receipt ------------------------------------------------------
overlay_sha=$(sha256sum "$OVERLAY" | cut -d' ' -f1)
direct_graph=$( cd "$BUILD" && "$CARGO" tree --locked --depth 1 2>/dev/null || true )
cat <<EOF

== ant-extsig-repro receipt ==
host:             $(uname -s) $(uname -m) $(uname -r)
cargo:            $("$CARGO" --version 2>/dev/null) (toolchain pin: ${RUSTUP_TOOLCHAIN:-host default})
canonical src:    $SRC_DIR (verified == source-manifest.sha256, file set exact)
overlay sha256:   $overlay_sha
committed lock:   $LOCK
box lock sha256:  $lock_sha (committed candidate — byte-identical to the box's)
staged lock:      box lock + ONE-line ant-core source-id alignment
                  (git+URL#rev -> git+URL?rev=rev#rev, same commit)
staged sha256:    $staged_lock_sha
lock packages:    $n_pkgs
banked pins:      ant-core git $BANKED_CORE_REV / ant-node =${BANKED_NODE_VER} / ant-protocol =${BANKED_PROTOCOL_VER} (asserted in lock AND manifest overlay)
graph:            cargo metadata --locked OK -> $SCRATCH/graph-metadata.json
second resolve:   fresh copy, cargo metadata --locked OK, staged lock sha UNCHANGED
check (--locked):  $check_status
build (--locked):  $build_status
ops tree:         UNCHANGED (pre-staging baseline identical; finalizer enforces on every exit)
direct graph (cargo tree --locked --depth 1):
$direct_graph
== end receipt ==
EOF
echo "ant-extsig-repro: ALL PHASES OK (finalizer will release scratch unless REPRO_KEEP=1)"
exit 0
