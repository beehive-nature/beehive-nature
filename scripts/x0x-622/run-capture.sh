#!/usr/bin/env bash
# x0x #622 capture runner — zCode correction round 2 (Astra re-review f8b3cb46).
#
# Wraps the UNCHANGED upstream scripts/capture-egress.py. Round 2 fixes, all
# at the caller boundary:
#   F1  helper supervision — sampler and log-helper exit statuses are kept and
#       classified (intentional runner stop vs spontaneous death); a window is
#       rejected unless the health series covers the whole interval (first/last
#       record bounds, gap bound, zero error records, health shape, uptime
#       progression) and the log helper was alive through the window;
#   F2  the terminal receipt writes are CHECKED — ENOSPC or any failure
#       writing ATTEMPT.json, the FAILED marker, or CLEANUP.json prevents
#       overall success and is reported on stderr with a nonzero exit; no
#       durable marker is promised on a full volume;
#   F3  every node start/check/stop is bounded and interruptible, escalating
#       TERM -> KILL at timeout+kill-after (a TERM-ignoring command cannot
#       outlive its bound, even inside cleanup where traps are disabled);
#       node ownership is PROVISIONAL from before launch, bound to a reserved
#       UNIQUE unit identity, so cancelled partial starts are cleaned up and
#       a stop can never claim a pre-existing unit; cleanup disposition is
#       separate from measurement disposition and a failed cleanup fails the
#       run; the default node lifecycle is a systemd TRANSIENT unit carrying
#       its own RuntimeMaxSec (and User=/Group=x0xm), so the node expires
#       even if this shell dies.
#
# Exit codes: 0 accepted with clean cleanup; 1 attempts exhausted; 2 usage or
# gate refusal; 5 evidence collision; 6 terminal receipt write failure;
# 8 measurement accepted but CLEANUP FAILED; 124 lease expired mid-window;
# 130 cancelled by signal; otherwise the last collector's own nonzero exit.
#
# Token law: X0X_API_TOKEN (env) or X0X_TOKEN_FILE (read internally after the
# node starts — fresh units mint it at first boot). Never printed or written.
#
# Environment contract (besides round 1's X0X_BIN_DIR/X0X_EVIDENCE_ROOT/
# X0X_COLLECTOR/X0X_EXPECT_SHA256_*/X0X_API/X0X_PYTHON/X0X_WINDOW_SECS/
# X0X_ATTEMPTS_MAX/X0X_LEASE_SECS/X0X_SAMPLER_INTERVAL/X0X_EXPECT_VERSION):
#   X0X_TOKEN_FILE        token file read after node start (default: none)
#   X0X_NODE_START        default: systemd-run transient unit x0x-measure
#                         (RuntimeMaxSec = X0X_NODE_RUNTIME_MAX, default 11400)
#   X0X_NODE_STOP         default: systemctl stop x0x-measure
#   X0X_NODE_FORCE_STOP   default: systemctl kill --signal=SIGKILL x0x-measure
#   X0X_NODE_CHECK        default: systemctl show <unit> -p ActiveState
#                         -p Result -p NRestarts --value
#   X0X_LOG_FOLLOW        default: tail -n +1 -f /var/lib/x0x-measure/log/x0xd.log
#   X0X_START_TIMEOUT (30)/X0X_CHECK_TIMEOUT (20)/X0X_STOP_TIMEOUT (30)/
#   X0X_STOP_FORCE_TIMEOUT (10)/X0X_KILL_AFTER (5)/X0X_HELPER_GRACE (10) —
#   seconds; every bounded node command escalates TERM -> KILL at its
#   timeout + kill-after, so a TERM-ignoring command cannot outlive its bound
#   X0X_RUN_TAG           reserved UNIQUE unit identity (default: runner pid);
#                         ownership is provisional from before launch, and a
#                         unique name means cleanup can never claim a
#                         pre-existing unit
#   X0X_REQUIRE_MOUNT     optional storage gate: the path must BE a real
#                         mountpoint whose log/ subdir exists (prelaunch check)
#
# `--print-node-defaults` prints the resolved node lifecycle commands and the
# reserved unit name, then exits — deploy-shape tests drive the real
# generator instead of a handwritten copy.
set -euo pipefail
umask 077

die() { printf 'run-capture: %s\n' "$*" >&2; EXIT_RC=2; exit 2; }
note() { printf 'run-capture: %s\n' "$*" >&2; }

EXIT_RC=2
FINAL_STATUS="usage"
EVID=""
RECEIPT_FAILED=0
CLEANUP_STATUS="not-run"

X0X_API="${X0X_API:-127.0.0.1:12710}"
X0X_PYTHON="${X0X_PYTHON:-python3}"
X0X_WINDOW_SECS="${X0X_WINDOW_SECS:-1200}"
X0X_ATTEMPTS_MAX="${X0X_ATTEMPTS_MAX:-3}"
X0X_LEASE_SECS="${X0X_LEASE_SECS:-10800}"
X0X_SAMPLER_INTERVAL="${X0X_SAMPLER_INTERVAL:-60}"
X0X_EXPECT_VERSION="${X0X_EXPECT_VERSION:-0.41.4}"
X0X_TOKEN_FILE="${X0X_TOKEN_FILE:-}"
X0X_NODE_RUNTIME_MAX="${X0X_NODE_RUNTIME_MAX:-$((X0X_LEASE_SECS + 600))}"
X0X_START_TIMEOUT="${X0X_START_TIMEOUT:-30}"
X0X_CHECK_TIMEOUT="${X0X_CHECK_TIMEOUT:-20}"
X0X_STOP_TIMEOUT="${X0X_STOP_TIMEOUT:-30}"
X0X_STOP_FORCE_TIMEOUT="${X0X_STOP_FORCE_TIMEOUT:-10}"
X0X_KILL_AFTER="${X0X_KILL_AFTER:-5}"
X0X_HELPER_GRACE="${X0X_HELPER_GRACE:-10}"

# G1: reserve a UNIQUE owned run/unit identity prospectively. The default node
# lifecycle below names only this unit; stopping it can never touch anyone
# else's, and provisional ownership covers resources created before the start
# command returns.
RUN_UNIT="x0x-measure-${X0X_RUN_TAG:-run$$}"

# G3: the default unit command itself enforces the dedicated identity —
# User=/Group= x0xm — beside the runtime limit and the bounded log volume.
X0X_NODE_START="${X0X_NODE_START:-systemd-run --unit=${RUN_UNIT} --collect --property=RuntimeMaxSec=${X0X_NODE_RUNTIME_MAX} --property=User=x0xm --property=Group=x0xm --property=MemoryMax=768M --property=CPUQuota=100% --property=TasksMax=64 --property=IPAccounting=yes --property=NoNewPrivileges=yes --property=ProtectSystem=strict --property=ProtectHome=yes --property=PrivateTmp=yes --property=StateDirectory=x0x-measure --property=ReadWritePaths=/var/lib/x0x-measure --property=StandardOutput=append:/var/lib/x0x-measure/log/x0xd.log --property=StandardError=append:/var/lib/x0x-measure/log/x0xd.log /opt/x0x-measure/bin/x0xd --config /etc/x0x-measure/x0xd.toml}"
X0X_NODE_STOP="${X0X_NODE_STOP:-systemctl stop ${RUN_UNIT}}"
X0X_NODE_FORCE_STOP="${X0X_NODE_FORCE_STOP:-systemctl kill --signal=SIGKILL ${RUN_UNIT}}"
X0X_NODE_CHECK="${X0X_NODE_CHECK:-systemctl show ${RUN_UNIT} -p ActiveState -p Result -p NRestarts --value}"
X0X_LOG_FOLLOW="${X0X_LOG_FOLLOW:-tail -n +1 -f /var/lib/x0x-measure/log/x0xd.log}"

if [ "${1:-}" = "--print-node-defaults" ]; then
  printf 'RUN_UNIT=%s\nX0X_NODE_START=%s\nX0X_NODE_STOP=%s\nX0X_NODE_FORCE_STOP=%s\nX0X_NODE_CHECK=%s\nX0X_LOG_FOLLOW=%s\n' \
    "$RUN_UNIT" "$X0X_NODE_START" "$X0X_NODE_STOP" "$X0X_NODE_FORCE_STOP" "$X0X_NODE_CHECK" "$X0X_LOG_FOLLOW"
  exit 0
fi

: "${X0X_BIN_DIR:?X0X_BIN_DIR (directory of the pinned binaries) required}"
: "${X0X_EVIDENCE_ROOT:?X0X_EVIDENCE_ROOT required}"
: "${X0X_COLLECTOR:?X0X_COLLECTOR (upstream capture-egress.py, unchanged) required}"
: "${X0X_EXPECT_SHA256_X0XD:?X0X_EXPECT_SHA256_X0XD digest pin required}"
: "${X0X_EXPECT_SHA256_X0X:?X0X_EXPECT_SHA256_X0X digest pin required}"
if [ -z "${X0X_API_TOKEN:-}" ] && [ -z "${X0X_TOKEN_FILE:-}" ]; then
  die "token source required: X0X_API_TOKEN (env) or X0X_TOKEN_FILE (read after node start)"
fi
X0X_REQUIRE_MOUNT="${X0X_REQUIRE_MOUNT:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X0X_SAMPLER="${X0X_SAMPLER:-$SCRIPT_DIR/sampler.py}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/x0x-622-runner.XXXXXX")"

# ---- R4: validate duration, bounds and ceilings BEFORE anything launches --
[[ "$X0X_WINDOW_SECS" =~ ^[0-9]+$ ]] || die "window must be integer seconds"
[ "$X0X_WINDOW_SECS" -ge 300 ] \
  || die "window ${X0X_WINDOW_SECS}s < 300s floor; refusing before launch (>=300s is smoke-only; target 1200)"
[[ "$X0X_LEASE_SECS" =~ ^[0-9]+$ ]] || die "lease must be integer seconds"
[ "$X0X_LEASE_SECS" -gt $((X0X_WINDOW_SECS + 300)) ] \
  || die "lease must exceed the window by >=300s (got lease $X0X_LEASE_SECS, window $X0X_WINDOW_SECS)"
# R4-1: the packet's aggregate bounds are HARD CEILINGS, not suggestions
[ "$X0X_LEASE_SECS" -le 10800 ] \
  || die "lease ${X0X_LEASE_SECS}s exceeds the 10800s (3h) wall-clock ceiling; refusing before launch"
[ "$X0X_ATTEMPTS_MAX" -le 3 ] \
  || die "attempts ${X0X_ATTEMPTS_MAX} exceeds the ceiling of 3 (one attempt + at most two retries); refusing before launch"
[ "$X0X_ATTEMPTS_MAX" -ge 1 ] || die "X0X_ATTEMPTS_MAX must be >= 1"
if [ -n "${X0X_DIR_STAMP:-}" ]; then
  case "$X0X_DIR_STAMP" in
    */*|*..*) die "X0X_DIR_STAMP must be a single path segment without traversal (got: $X0X_DIR_STAMP)" ;;
  esac
fi

# ---- G3/R4-2: storage gate — bind EVERY writable path to the bounded mount
if [ -n "$X0X_REQUIRE_MOUNT" ]; then
  [ -n "$(findmnt -rn --mountpoint "$X0X_REQUIRE_MOUNT" 2>/dev/null)" ] \
    || die "X0X_REQUIRE_MOUNT=$X0X_REQUIRE_MOUNT is not a real mountpoint; refusing prelaunch"
  [ -d "$X0X_REQUIRE_MOUNT/log" ] \
    || die "$X0X_REQUIRE_MOUNT/log missing — create required subdirs AFTER mounting (spec §3); refusing prelaunch"
  MOUNT_REAL="$(realpath "$X0X_REQUIRE_MOUNT")"
  EVID_REAL="$(realpath -m "$X0X_EVIDENCE_ROOT")"
  case "$EVID_REAL" in
    "$MOUNT_REAL"|"$MOUNT_REAL"/*) : ;;
    *) die "evidence root $X0X_EVIDENCE_ROOT resolves to $EVID_REAL, outside the required mount $MOUNT_REAL; refusing prelaunch" ;;
  esac
  mkdir -p "$X0X_EVIDENCE_ROOT" 2>/dev/null \
    || die "cannot create evidence root $X0X_EVIDENCE_ROOT; refusing prelaunch"
  EVID_REAL="$(realpath "$X0X_EVIDENCE_ROOT")"
  case "$EVID_REAL" in
    "$MOUNT_REAL"|"$MOUNT_REAL"/*) : ;;
    *) die "evidence root $X0X_EVIDENCE_ROOT resolves to $EVID_REAL after creation, outside $MOUNT_REAL; refusing prelaunch" ;;
  esac
  [ "$(stat -c %d "$EVID_REAL" 2>/dev/null)" = "$(stat -c %d "$MOUNT_REAL")" ] \
    || die "evidence root is on a different filesystem than the required mount (device mismatch); refusing prelaunch"
  # the runner's own scratch subtree also lives on the bounded volume
  rm -rf "$WORK"
  WORK="$(mktemp -d "$MOUNT_REAL/.runner-work.XXXXXX")"
fi

# ---- R6/R1: digest gate — bytes on disk must equal the reviewed pin ---------
check_digest() {
  local got
  got="$(sha256sum "$1" | awk '{print $1}')"
  [ "$got" = "$2" ] || die "digest mismatch for $3 (found $got, pinned $2)"
}
check_digest "$X0X_BIN_DIR/x0xd" "$X0X_EXPECT_SHA256_X0XD" "pinned x0xd"
check_digest "$X0X_BIN_DIR/x0x" "$X0X_EXPECT_SHA256_X0X" "pinned x0x"

# ---- R1: private PATH shim binds the collector's bare `x0x` calls ----------
SHIM="$WORK/shim"
mkdir -p "$SHIM"
printf '#!/bin/sh\nexec %q --api %q "$@"\n' "$X0X_BIN_DIR/x0x" "$X0X_API" > "$SHIM/x0x"
chmod 700 "$SHIM/x0x"
BOUND_PATH="$SHIM:$PATH"
[ "$(PATH="$BOUND_PATH" command -v x0x)" = "$SHIM/x0x" ] \
  || die "x0x does not resolve to the shim on the collector's PATH"

# ---- R3/F3: scoped lease — deadline over owned helpers + node, never host --
LEASE_STATE="$WORK/lease.state"
: > "$LEASE_STATE"
setsid bash -c 'sleep "$1" && printf "expired\n" > "$2" && kill -TERM "$3"' \
  _ "$X0X_LEASE_SECS" "$LEASE_STATE" "$$" >/dev/null 2>&1 &
WATCHDOG_PID=$!

# ---- owned-helper bookkeeping; cleanup touches ONLY these -------------------
NODE_OWNED=0
START_JOB_PID=""
COL_PGID=""
SAMPLER_PID=""
LOG_PID=""

# node-check contract: prints ActiveState, Result, NRestarts (any order);
# clean means active, success, 0 restarts.
node_ok_clean() {
  [ "$(grep -cxE 'active' "$1" 2>/dev/null)" = 1 ] \
    && [ "$(grep -cxE 'success' "$1" 2>/dev/null)" = 1 ] \
    && [ "$(grep -cxE '0' "$1" 2>/dev/null)" = 1 ]
}

# kill an owned process GROUP with bounded graceful-then-forced escalation
kill_group_bounded() { # $1 = pid whose group we own, $2 = grace seconds
  local pid="$1" grace="$2" waited=0
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  while kill -0 -- "-$pid" 2>/dev/null && [ "$waited" -lt "$((grace * 5))" ]; do
    sleep 0.2
    waited=$((waited + 1))
  done
  if kill -0 -- "-$pid" 2>/dev/null; then
    kill -KILL -- "-$pid" 2>/dev/null || true
    sleep 0.5
  fi
}

# run a node command bounded AND interruptibly (G1): the job runs under
# setsid + timeout WITH --kill-after, so a TERM-ignoring command gets TERM at
# the timeout and KILL — unblockable, group-wide — at timeout+kill-after:
# the forced deadline holds even inside finish() where the watchdog and
# traps are already disabled, and the job group is provably dead once the
# call returns (so cleanup never sweeps reaped, recyclable pids). Output is
# NOT redirected here — callers capture what they need.
run_bounded() { # $1 = timeout secs, $2 = command string
  local rc=0
  setsid timeout --kill-after="$X0X_KILL_AFTER" "$1" bash -c "$2" &
  START_JOB_PID=$!
  set +e
  wait "$START_JOB_PID"
  rc=$?
  set -e
  START_JOB_PID=""
  return "$rc"
}

# F2: terminal receipt write is checked; failure prevents overall success
mark_attempt() { # $1 status, $2 collector exit, $3 sampler exit, $4 log exit
  [ -n "$EVID" ] || return 0
  local receipt
  receipt="$(printf '{"status":"%s","collector_exit":"%s","sampler_exit":"%s","log_exit":"%s","attempt":%s,"window_secs":%s,"dt":%s,"started":%s,"ended":%s,"api":"%s","lease_state":"%s"}\n' \
    "$1" "$2" "$3" "$4" "${ATTEMPT:-0}" "${X0X_WINDOW_SECS:-0}" "${WINDOW_DT:-0}" "${START_EPOCH:-0}" "$(date +%s)" "$X0X_API" "$(head -c 40 "$LEASE_STATE" 2>/dev/null)")"
  if ! printf '%s\n' "$receipt" > "$EVID/ATTEMPT.json" 2>/dev/null \
     || ! [ -s "$EVID/ATTEMPT.json" ]; then
    RECEIPT_FAILED=1
    printf 'run-capture: TERMINAL RECEIPT WRITE FAILED for %s (intended status %s); storage unreliable — reporting failure, evidence retained as-is\n' "$EVID" "$1" >&2
    return 1
  fi
  if [ "$1" != "accepted" ]; then
    if ! : > "$EVID/FAILED" 2>/dev/null; then
      RECEIPT_FAILED=1
      printf 'run-capture: failure marker ALSO unwritable for %s; no durable marker promised on a full volume\n' "$EVID" >&2
      return 1
    fi
  fi
  return 0
}

finish() { # $1 = intended exit code (measurement disposition)
  local rc="$1" pid
  trap - TERM INT HUP EXIT
  kill -TERM -- "-$WATCHDOG_PID" 2>/dev/null || true
  wait "$WATCHDOG_PID" 2>/dev/null || true
  for pid in "$START_JOB_PID" "$COL_PGID" "$SAMPLER_PID" "$LOG_PID"; do
    [ -n "$pid" ] && kill_group_bounded "$pid" "$X0X_HELPER_GRACE"
  done
  COL_PGID=""; SAMPLER_PID=""; LOG_PID=""; START_JOB_PID=""
  # F3/G1: ownership retained until a bounded stop completes; graceful then
  # forced — both bounded by timeout+kill-after even with traps disabled
  if [ "$NODE_OWNED" = 1 ]; then
    if run_bounded "$X0X_STOP_TIMEOUT" "$X0X_NODE_STOP"; then
      CLEANUP_STATUS="ok"
    elif [ -n "$X0X_NODE_FORCE_STOP" ] \
         && run_bounded "$X0X_STOP_FORCE_TIMEOUT" "$X0X_NODE_FORCE_STOP"; then
      CLEANUP_STATUS="forced-ok"
      note "node stop required the FORCED path; cleanup completed under coercion"
    else
      CLEANUP_STATUS="failed"
    fi
    NODE_OWNED=0
    if [ -n "$EVID" ]; then
      # G2: the cleanup receipt obeys the same checked-write law as ATTEMPT
      if ! printf '{"cleanup":"%s","ended":%s}\n' "$CLEANUP_STATUS" "$(date +%s)" \
           > "$EVID/CLEANUP.json" 2>/dev/null \
         || ! [ -s "$EVID/CLEANUP.json" ]; then
        printf 'run-capture: TERMINAL RECEIPT WRITE FAILED for %s/CLEANUP.json (cleanup=%s); reporting failure\n' "$EVID" "$CLEANUP_STATUS" >&2
        [ "$rc" -eq 0 ] && rc=6
      fi
    fi
  else
    CLEANUP_STATUS="not-owned"
  fi
  rm -rf "$WORK" 2>/dev/null || true
  # cleanup disposition is separate: a failed cleanup fails the run even when
  # the measurement itself was accepted
  if [ "$CLEANUP_STATUS" = "failed" ]; then
    printf 'run-capture: CLEANUP FAILED (node stop failed after bounded graceful+forced attempts)\n' >&2
    [ "$rc" -eq 0 ] && rc=8
  fi
  exit "$rc"
}

on_signal() {
  if [ -s "$LEASE_STATE" ]; then
    mark_attempt "interrupted-lease" "-" "-" "-" || true
    note "lease expired mid-window; interval invalidated and retained as failed evidence"
    finish 124
  else
    mark_attempt "cancelled" "-" "-" "-" || true
    note "cancelled by signal; owned helpers stopped, evidence retained"
    finish 130
  fi
}
trap on_signal TERM INT HUP
trap 'finish "$EXIT_RC"' EXIT

# ---- R4-3: reserve the FIRST owned attempt directory BEFORE the node starts
# A collision becomes a PRELAUNCH refusal (exit 5, node never started, victim
# untouched, checked REFUSED receipt) — and every post-start path, preflight
# failures included, has a receipt home because EVID is already owned.
mkdir -p "$X0X_EVIDENCE_ROOT" 2>/dev/null \
  || die "cannot create evidence root $X0X_EVIDENCE_ROOT; refusing prelaunch"
RESERVED_STAMP="${X0X_DIR_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}-attempt1"
EVID="$X0X_EVIDENCE_ROOT/$RESERVED_STAMP"
if ! mkdir "$EVID" 2>/dev/null; then
  if ! printf '{"status":"refused-collision","stamp":"%s","started":%s}\n' \
       "$RESERVED_STAMP" "$(date +%s)" \
       > "$X0X_EVIDENCE_ROOT/REFUSED-$RESERVED_STAMP.json" 2>/dev/null \
     || ! [ -s "$X0X_EVIDENCE_ROOT/REFUSED-$RESERVED_STAMP.json" ]; then
    printf 'run-capture: TERMINAL RECEIPT WRITE FAILED for REFUSED-%s.json; reporting failure\n' "$RESERVED_STAMP" >&2
    EVID=""
    finish 6
  fi
  note "evidence dir $EVID already exists; refusing prelaunch (victim untouched, node never started, REFUSED receipt written)"
  EVID=""
  finish 5
fi

# ---- F3/G1: node lifecycle — PROVISIONAL ownership BEFORE launch ------------
# NODE_OWNED is set before the start command runs: a resource created before
# it returns is still owned, and the reserved UNIQUE unit identity means the
# stop commands below can only ever target THIS run's unit — never a
# possibly pre-existing one.
NODE_OWNED=1
if ! run_bounded "$X0X_START_TIMEOUT" "$X0X_NODE_START"; then
  die "test node start failed or blocked (bounded ${X0X_START_TIMEOUT}s; reserved unit ${RUN_UNIT} stop attempted in cleanup)"
fi

# ---- token: env, or bounded internal read after first boot ------------------
if [ -z "${X0X_API_TOKEN:-}" ]; then
  waited=0
  while [ ! -s "$X0X_TOKEN_FILE" ] && [ "$waited" -lt $((X0X_CHECK_TIMEOUT * 4)) ]; do
    sleep 0.25
    waited=$((waited + 1))
  done
  [ -s "$X0X_TOKEN_FILE" ] || { mark_attempt "failed-token-bootstrap" "-" "-" "-" || true; die "token file $X0X_TOKEN_FILE absent after node start"; }
  X0X_API_TOKEN="$(cat "$X0X_TOKEN_FILE")"
  export X0X_API_TOKEN
fi

# ---- preflight: version + diagnostic shape gate, fail closed ----------------
# (post-start failures land in the RESERVED attempt dir: FAILED marker now,
#  CLEANUP.json at finish — the R4-3 receipt home)
mkdir -p "$X0X_EVIDENCE_ROOT"
PREFLIGHT="$WORK/preflight"
mkdir "$PREFLIGHT"
( PATH="$BOUND_PATH" timeout 20 x0x health --json ) > "$PREFLIGHT/health.json" 2> "$PREFLIGHT/health.err" \
  || { mark_attempt "failed-preflight" "-" "-" "-" || true; die "preflight health call failed (see $PREFLIGHT/health.err)"; }
( PATH="$BOUND_PATH" timeout 20 x0x diagnostics gossip --json ) > "$PREFLIGHT/gossip.json" 2> "$PREFLIGHT/gossip.err" \
  || { mark_attempt "failed-preflight" "-" "-" "-" || true; die "preflight gossip call failed"; }
cat > "$WORK/preflight_check.py" <<'PY'
import json
import sys

def load(path):
    obj = json.load(open(path, encoding="utf-8"))
    return obj.get("data", obj)

health = load(sys.argv[1])
assert health.get("version") == sys.argv[3], \
    f"version {health.get('version')!r} != expected {sys.argv[3]!r}"
gossip = load(sys.argv[2])
p = gossip.get("participation")
assert isinstance(p, dict), "participation missing from diagnostics/gossip"
assert p.get("mode") == "leaf", f"participation.mode={p.get('mode')!r}"
assert p.get("reason") == "default_leaf", f"participation.reason={p.get('reason')!r}"
assert p.get("passthrough_refresh_runs") == 0, "passthrough_refresh_runs != 0"
for key in ("egress_budget", "subscribed_topics", "outbound_by_topic_named"):
    assert key in gossip, f"{key} missing from diagnostics/gossip"
stages = gossip.get("pubsub_stages")
assert isinstance(stages, dict), "pubsub_stages missing"
assert "message_kinds" in stages, "pubsub_stages.message_kinds missing"
assert "outbound_by_topic" in stages, "pubsub_stages.outbound_by_topic missing"
print("shape-ok")
PY
"$X0X_PYTHON" "$WORK/preflight_check.py" "$PREFLIGHT/health.json" "$PREFLIGHT/gossip.json" "$X0X_EXPECT_VERSION" \
  > "$PREFLIGHT/shape.txt" 2>&1 || { cat "$PREFLIGHT/shape.txt" >&2; mark_attempt "failed-preflight-shape" "-" "-" "-" || true; die "preflight shape gate failed"; }

# F1: coverage validator — the health series must prove the WHOLE interval
cat > "$WORK/postcheck_series.py" <<'PY'
import json
import sys

series, interval, dt = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
edge = max(2 * interval, 2.0) + 2.0
gap_bound = 3 * interval + 3.0
recs = []
for line in open(series, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        recs.append(json.loads(line))
    except json.JSONDecodeError:
        print(f"coverage-fail: malformed sampler record: {line[:120]}")
        sys.exit(4)
if not recs:
    print("coverage-fail: no sampler records")
    sys.exit(4)
errs = [r for r in recs if "error" in r]
if errs:
    print(f"coverage-fail: {len(errs)} error record(s) in series (first at ts {errs[0].get('ts')})")
    sys.exit(4)
if len(recs) < 2:
    print("coverage-fail: fewer than two samples")
    sys.exit(4)
first_ts = recs[0]["ts"]
last_ts = recs[-1]["ts"]
# coverage bounds: sampling must start with the window and run to its end
# (first/last sample inside the edge margin; no interior gap beyond bound)
if last_ts - first_ts < max(dt - edge, 0):
    print(f"coverage-fail: series spans {last_ts - first_ts:.1f}s of a {dt:.0f}s window")
    sys.exit(4)
for a, b in zip(recs, recs[1:]):
    if b["ts"] - a["ts"] > gap_bound:
        print(f"coverage-fail: sample gap {b['ts'] - a['ts']:.1f}s exceeds {gap_bound:.1f}s")
        sys.exit(4)
ups = []
for r in recs:
    h = r.get("health")
    if not isinstance(h, dict) or "peers" not in h or "uptime_secs" not in h:
        print(f"coverage-fail: record at ts {r.get('ts')} lacks peers/uptime_secs")
        sys.exit(4)
    ups.append(h["uptime_secs"])
if any(u2 < u1 for u1, u2 in zip(ups, ups[1:])):
    print("coverage-fail: uptime regression within series")
    sys.exit(4)
if dt >= 10 and ups[-1] - ups[0] < dt - max(interval, 1.0) - 5:
    print(f"coverage-fail: uptime advanced {ups[-1] - ups[0]}s over a {dt:.0f}s window")
    sys.exit(4)
peers = [r["health"]["peers"] for r in recs]
if 0 in peers:
    print(f"coverage-fail: peer collapse at sample index {peers.index(0)}")
    sys.exit(4)
print(f"coverage-ok records={len(recs)} span={last_ts - first_ts:.1f}s "
      f"uptime_span={ups[-1] - ups[0]}s last_peers={peers[-1]}")
PY

# ---- attempt loop -------------------------------------------------------------
ATTEMPT=0
LAST_COLLECTOR_RC=0
FINAL_STATUS="attempts-exhausted"
while [ "$ATTEMPT" -lt "$X0X_ATTEMPTS_MAX" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" = 1 ]; then
    # R4-3: attempt 1's directory was reserved and owned BEFORE node start
    STAMP="$RESERVED_STAMP"
  else
    STAMP="${X0X_DIR_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}-attempt${ATTEMPT}"
    EVID="$X0X_EVIDENCE_ROOT/$STAMP"
    # exclusive creation; a later collision is refused WITHOUT touching the
    # victim and still leaves a checked terminal refusal receipt (R4-3)
    if ! mkdir "$EVID" 2>/dev/null; then
      if ! printf '{"status":"refused-collision","stamp":"%s","started":%s}\n' \
           "$STAMP" "$(date +%s)" \
           > "$X0X_EVIDENCE_ROOT/REFUSED-$STAMP.json" 2>/dev/null \
         || ! [ -s "$X0X_EVIDENCE_ROOT/REFUSED-$STAMP.json" ]; then
        printf 'run-capture: TERMINAL RECEIPT WRITE FAILED for REFUSED-%s.json; reporting failure\n' "$STAMP" >&2
        EXIT_RC=6
      else
        EXIT_RC=5
      fi
      FINAL_STATUS="refused-collision"
      EVID=""   # never point writes at a directory we do not own
      note "evidence dir $X0X_EVIDENCE_ROOT/$STAMP already exists; refusing (victim untouched, REFUSED receipt written)"
      break
    fi
  fi
  START_EPOCH="$(date +%s)"
  WINDOW_DT=0
  printf '%s\n' "$START_EPOCH" > "$EVID/window-start.epoch"

  if run_bounded "$X0X_CHECK_TIMEOUT" "$X0X_NODE_CHECK" > "$EVID/node-check-t0.txt" 2>&1; then
    :
  else
    mark_attempt "failed-node-check-t0" "-" "-" "-" || { FINAL_STATUS="receipt-write-failed"; EXIT_RC=6; break; }
    note "attempt $ATTEMPT: node check at t0 failed"
    continue
  fi

  # log helper from the saved start epoch; wrapped in its own timeout so it
  # expires independently if this shell dies (F3)
  setsid timeout "$X0X_LEASE_SECS" bash -c "$X0X_LOG_FOLLOW" \
    > "$EVID/service.log" 2>&1 &
  LOG_PID=$!
  # bounded honest sampler; owned helper
  setsid "$X0X_PYTHON" "$X0X_SAMPLER" \
    --x0x "$SHIM/x0x" --out "$EVID/health-series.jsonl" \
    --interval "$X0X_SAMPLER_INTERVAL" --max-lifetime "$X0X_LEASE_SECS" \
    > "$EVID/sampler.out" 2>&1 &
  SAMPLER_PID=$!
  cp "$PREFLIGHT/health.json" "$EVID/preflight-health.json"
  cp "$PREFLIGHT/gossip.json" "$EVID/preflight-gossip.json"

  # R1/R2: unchanged upstream collector, shim-first PATH, console straight to
  # file, exit status taken from the collector itself
  setsid env PATH="$BOUND_PATH" "$X0X_PYTHON" "$X0X_COLLECTOR" \
    --window-secs "$X0X_WINDOW_SECS" --out-dir "$EVID" \
    > "$EVID/collector-console.txt" 2>&1 &
  COL_PID=$!
  COL_PGID=$COL_PID
  set +e
  wait "$COL_PID"
  COL_RC=$?
  set -e
  LAST_COLLECTOR_RC=$COL_RC
  kill_group_bounded "$COL_PGID" "$X0X_HELPER_GRACE"
  COL_PGID=""

  # F1: supervise helpers. A helper that was ALIVE at window end was stopped
  # BY US (its stop-time rc reflects our coercion, so any rc is intentional);
  # a helper already dead before our stop died on its own — spontaneous.
  # The sampler is stopped by PID (not group) and allowed to DRAIN its
  # in-flight request, so teardown never pollutes the series with a spurious
  # error record; a group-kill follows only for stragglers.
  SAMPLER_EXIT="none"; SAMPLER_SPONTANEOUS=0
  if [ -n "$SAMPLER_PID" ]; then
    SAMPLER_ALIVE=0
    kill -0 "$SAMPLER_PID" 2>/dev/null && SAMPLER_ALIVE=1
    if [ "$SAMPLER_ALIVE" = 1 ]; then
      kill -TERM "$SAMPLER_PID" 2>/dev/null || true
      waited=0
      while kill -0 "$SAMPLER_PID" 2>/dev/null \
            && [ "$waited" -lt $((X0X_HELPER_GRACE * 5)) ]; do
        sleep 0.2
        waited=$((waited + 1))
      done
      kill_group_bounded "$SAMPLER_PID" "$X0X_HELPER_GRACE"
    fi
    set +e
    wait "$SAMPLER_PID"
    SAMPLER_RC=$?
    set -e
    SAMPLER_EXIT="$SAMPLER_RC"
    [ "$SAMPLER_ALIVE" = 0 ] && SAMPLER_SPONTANEOUS=1
    SAMPLER_PID=""
  fi
  LOG_EXIT="none"; LOG_SPONTANEOUS=0
  if [ -n "$LOG_PID" ]; then
    LOG_ALIVE=0
    kill -0 "$LOG_PID" 2>/dev/null && LOG_ALIVE=1
    kill_group_bounded "$LOG_PID" "$X0X_HELPER_GRACE"
    set +e
    wait "$LOG_PID"
    LOG_RC=$?
    set -e
    LOG_EXIT="$LOG_RC"
    [ "$LOG_ALIVE" = 0 ] && LOG_SPONTANEOUS=1
    LOG_PID=""
  fi
  END_EPOCH="$(date +%s)"
  WINDOW_DT=$((END_EPOCH - START_EPOCH))
  printf '%s\n' "$END_EPOCH" > "$EVID/window-end.epoch"

  STATUS="accepted"
  if [ "$COL_RC" -ne 0 ]; then
    STATUS="failed-collector"
  elif [ "$SAMPLER_SPONTANEOUS" = 1 ]; then
    STATUS="failed-sampler"
  elif [ "$LOG_SPONTANEOUS" = 1 ]; then
    STATUS="failed-log-helper"
  elif ! run_bounded "$X0X_CHECK_TIMEOUT" "$X0X_NODE_CHECK" > "$EVID/node-check-t1.txt" 2>&1; then
    STATUS="failed-node-check-t1"
  elif ! "$X0X_PYTHON" "$WORK/postcheck_series.py" "$EVID/health-series.jsonl" \
        "$X0X_SAMPLER_INTERVAL" "$WINDOW_DT" > "$EVID/series-check.txt" 2>&1; then
    STATUS="failed-coverage"
  elif [ -s "$LEASE_STATE" ]; then
    STATUS="interrupted-lease"
  elif ! node_ok_clean "$EVID/node-check-t1.txt"; then
    STATUS="failed-cap-or-restart"
  elif ! [ -s "$EVID/service.log" ]; then
    STATUS="failed-log-empty"
  else
    :
  fi

  if ! mark_attempt "$STATUS" "$COL_RC" "$SAMPLER_EXIT" "$LOG_EXIT"; then
    FINAL_STATUS="receipt-write-failed"
    EXIT_RC=6
    break   # storage unreliable: no further attempts
  fi
  note "attempt $ATTEMPT: $STATUS (collector $COL_RC, sampler $SAMPLER_EXIT, log $LOG_EXIT; evidence $EVID)"
  if [ "$STATUS" = "accepted" ]; then
    FINAL_STATUS="accepted"
    EXIT_RC=0
    break
  fi
  # a rejected window is retained immutably; the next attempt gets a new dir
done

if [ "$FINAL_STATUS" != "accepted" ] && [ "$FINAL_STATUS" != "refused-collision" ] \
   && [ "$FINAL_STATUS" != "receipt-write-failed" ]; then
  EXIT_RC=1
  # pass a distinctive collector failure through verbatim when that was the cause
  if [ "$LAST_COLLECTOR_RC" -ne 0 ] && [ "$LAST_COLLECTOR_RC" -lt 255 ]; then
    EXIT_RC=$((LAST_COLLECTOR_RC > 2 ? LAST_COLLECTOR_RC : 1))
  fi
fi
note "final: $FINAL_STATUS (cleanup: $CLEANUP_STATUS)"
finish "$EXIT_RC"
