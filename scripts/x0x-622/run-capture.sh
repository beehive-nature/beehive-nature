#!/usr/bin/env bash
# x0x #622 capture runner — zCode correction round for Astra review b7076f86.
#
# Wraps the UNCHANGED upstream scripts/capture-egress.py with a tested
# execution boundary:
#   R1  every collector subprocess call is bound to the pinned CLI and the
#       explicit test API through a private PATH shim (bare `x0x` resolves
#       to the shim, never to PATH luck or the default port 12700);
#   R2  health evidence is full timestamped JSON records written by a bounded
#       sampler to a real file; collector console goes straight to a file
#       (no tee pipeline to mask status); log capture starts from a saved
#       epoch; every failure propagates;
#   R3  the lease is scoped to THIS runner's owned helpers and the test node
#       only — never a host shutdown, never a boot-persistent unit;
#   R4  evidence directories are created exclusively (plain mkdir, no -p),
#       collisions are refused untouched, attempts/retries are bounded,
#       the duration is validated before anything launches, and a
#       cap-triggered or interrupted interval is retained as failed evidence.
#
# Exit codes: 0 accepted window; 1 attempts exhausted (window/postcheck
# rejects); 2 usage/gate refusal; 5 evidence collision refusal; 124 lease
# expired (interval interrupted); 130 cancelled by signal; otherwise the
# last collector's own nonzero exit is passed through.
#
# Usage: see docs/specs/SPEC-X0X-622-CAPTURE-1.md. Environment contracts:
#   required: X0X_BIN_DIR X0X_EVIDENCE_ROOT X0X_COLLECTOR
#             X0X_EXPECT_SHA256_X0XD X0X_EXPECT_SHA256_X0X X0X_API_TOKEN
#   optional (defaults): X0X_API(127.0.0.1:12710) X0X_PYTHON(python3)
#             X0X_WINDOW_SECS(1200) X0X_ATTEMPTS_MAX(3) X0X_LEASE_SECS(10800)
#             X0X_SAMPLER_INTERVAL(60) X0X_EXPECT_VERSION(0.41.4)
#             X0X_NODE_START/STOP/CHECK (systemd transient unit x0x-measure)
#             X0X_LOG_FOLLOW(journalctl follow) X0X_SAMPLER(sampler.py path)
set -euo pipefail
umask 077

die() { printf 'run-capture: %s\n' "$*" >&2; EXIT_RC=2; exit 2; }
note() { printf 'run-capture: %s\n' "$*" >&2; }

EXIT_RC=2
FINAL_STATUS="usage"
EVID=""

: "${X0X_BIN_DIR:?X0X_BIN_DIR (directory of the pinned binaries) required}"
: "${X0X_EVIDENCE_ROOT:?X0X_EVIDENCE_ROOT required}"
: "${X0X_COLLECTOR:?X0X_COLLECTOR (upstream capture-egress.py, unchanged) required}"
: "${X0X_EXPECT_SHA256_X0XD:?X0X_EXPECT_SHA256_X0XD digest pin required}"
: "${X0X_EXPECT_SHA256_X0X:?X0X_EXPECT_SHA256_X0X digest pin required}"
: "${X0X_API_TOKEN:?X0X_API_TOKEN required (env only; never printed or written)}"
X0X_API="${X0X_API:-127.0.0.1:12710}"
X0X_PYTHON="${X0X_PYTHON:-python3}"
X0X_WINDOW_SECS="${X0X_WINDOW_SECS:-1200}"
X0X_ATTEMPTS_MAX="${X0X_ATTEMPTS_MAX:-3}"
X0X_LEASE_SECS="${X0X_LEASE_SECS:-10800}"
X0X_SAMPLER_INTERVAL="${X0X_SAMPLER_INTERVAL:-60}"
X0X_EXPECT_VERSION="${X0X_EXPECT_VERSION:-0.41.4}"
X0X_NODE_START="${X0X_NODE_START:-systemctl start x0x-measure}"
X0X_NODE_STOP="${X0X_NODE_STOP:-systemctl stop x0x-measure}"
X0X_NODE_CHECK="${X0X_NODE_CHECK:-systemctl show x0x-measure -p ActiveState -p Result -p NRestarts --value}"
X0X_LOG_FOLLOW="${X0X_LOG_FOLLOW:-journalctl -u x0x-measure -f -o short}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X0X_SAMPLER="${X0X_SAMPLER:-$SCRIPT_DIR/sampler.py}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/x0x-622-runner.XXXXXX")"

# ---- R4: validate duration and bounds BEFORE anything launches -------------
[[ "$X0X_WINDOW_SECS" =~ ^[0-9]+$ ]] || die "window must be integer seconds"
[ "$X0X_WINDOW_SECS" -ge 300 ] \
  || die "window ${X0X_WINDOW_SECS}s < 300s floor; refusing before launch (>=300s is smoke-only; target 1200)"
[[ "$X0X_LEASE_SECS" =~ ^[0-9]+$ ]] || die "lease must be integer seconds"
[ "$X0X_LEASE_SECS" -gt $((X0X_WINDOW_SECS + 300)) ] \
  || die "lease must exceed the window by >=300s (got lease $X0X_LEASE_SECS, window $X0X_WINDOW_SECS)"
[ "$X0X_ATTEMPTS_MAX" -ge 1 ] || die "X0X_ATTEMPTS_MAX must be >= 1"

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

# ---- R3: scoped lease — deadline over owned helpers + node, never the host -
# setsid + full redirections: the watchdog must hold NO inherited stdout pipe
# (a leaked pipe write-end would block the caller's reads after we exit), and
# its own process group is killed whole in finish(), inner sleep included.
LEASE_STATE="$WORK/lease.state"
: > "$LEASE_STATE"
setsid bash -c 'sleep "$1" && printf "expired\n" > "$2" && kill -TERM "$3"' \
  _ "$X0X_LEASE_SECS" "$LEASE_STATE" "$$" >/dev/null 2>&1 &
WATCHDOG_PID=$!

# ---- owned-helper bookkeeping; cleanup touches ONLY these -------------------
NODE_OWNED=0
COL_PGID=""
SAMPLER_PID=""
LOG_PID=""

# node-check contract: prints the unit's ActiveState, Result and NRestarts,
# one per line, in any order. Clean means: active, success, 0 restarts.
node_ok_clean() {
  [ "$(grep -cxE 'active' "$1" 2>/dev/null)" = 1 ] \
    && [ "$(grep -cxE 'success' "$1" 2>/dev/null)" = 1 ] \
    && [ "$(grep -cxE '0' "$1" 2>/dev/null)" = 1 ]
}

mark_attempt() { # $1 status string, $2 collector exit ("-" if none)
  [ -n "$EVID" ] || return 0
  printf '{"status":"%s","collector_exit":"%s","attempt":%s,"window_secs":%s,"started":%s,"ended":%s,"api":"%s","lease_state":"%s"}\n' \
    "$1" "$2" "${ATTEMPT:-0}" "${X0X_WINDOW_SECS:-0}" "${START_EPOCH:-0}" "$(date +%s)" "$X0X_API" "$(cat "$LEASE_STATE" 2>/dev/null | head -c 40)" \
    > "$EVID/ATTEMPT.json" || true
  [ "$1" = "accepted" ] || : > "$EVID/FAILED" || true
}

finish() {
  local rc="$1"
  trap - TERM INT HUP EXIT
  kill -TERM -- "-$WATCHDOG_PID" 2>/dev/null || true
  wait "$WATCHDOG_PID" 2>/dev/null || true
  [ -n "$COL_PGID" ] && kill -TERM -- "-$COL_PGID" 2>/dev/null || true
  [ -n "$SAMPLER_PID" ] && kill -TERM "$SAMPLER_PID" 2>/dev/null || true
  [ -n "$SAMPLER_PID" ] && wait "$SAMPLER_PID" 2>/dev/null || true
  [ -n "$LOG_PID" ] && kill -TERM "$LOG_PID" 2>/dev/null || true
  [ -n "$LOG_PID" ] && wait "$LOG_PID" 2>/dev/null || true
  if [ "$NODE_OWNED" = 1 ]; then
    bash -c "$X0X_NODE_STOP" >/dev/null 2>&1 || note "node stop reported failure (ignored in cleanup)"
    NODE_OWNED=0
  fi
  rm -rf "$WORK"
  exit "$rc"
}

on_signal() {
  if [ -s "$LEASE_STATE" ]; then
    mark_attempt "interrupted-lease" "-"
    note "lease expired mid-window; interval invalidated and retained as failed evidence"
    finish 124
  else
    mark_attempt "cancelled" "-"
    note "cancelled by signal; owned helpers stopped, evidence retained"
    finish 130
  fi
}
trap on_signal TERM INT HUP
trap 'finish "$EXIT_RC"' EXIT

# ---- node lifecycle (transient unit; never enabled at boot) -----------------
bash -c "$X0X_NODE_START" || die "test node start failed"
NODE_OWNED=1

# ---- preflight: version + diagnostic shape gate, fail closed ----------------
mkdir -p "$X0X_EVIDENCE_ROOT"
PREFLIGHT="$WORK/preflight"
mkdir "$PREFLIGHT"
( PATH="$BOUND_PATH" timeout 20 x0x health --json ) > "$PREFLIGHT/health.json" 2> "$PREFLIGHT/health.err" \
  || die "preflight health call failed (see $PREFLIGHT/health.err)"
( PATH="$BOUND_PATH" timeout 20 x0x diagnostics gossip --json ) > "$PREFLIGHT/gossip.json" 2> "$PREFLIGHT/gossip.err" \
  || die "preflight gossip call failed"
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
  > "$PREFLIGHT/shape.txt" 2>&1 || { cat "$PREFLIGHT/shape.txt" >&2; die "preflight shape gate failed"; }

cat > "$WORK/postcheck_series.py" <<'PY'
import json
import sys

# §5.4 item 7: peer collapse anywhere in the series invalidates the window;
# endpoint snapshots alone cannot prove continuous availability.
records = errors = 0
peer_zero = []
last_peers = None
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        rec = json.loads(line)
    except json.JSONDecodeError:
        print(f"malformed sampler record: {line[:120]}")
        sys.exit(3)
    records += 1
    if "error" in rec:
        errors += 1
        continue
    peers = rec.get("health", {}).get("peers")
    if peers is not None:
        last_peers = peers
        if peers == 0:
            peer_zero.append(rec.get("ts"))
if records == 0:
    print("no sampler records")
    sys.exit(3)
if peer_zero:
    print(f"peer collapse at {len(peer_zero)} sample(s), first at epoch {peer_zero[0]}")
    sys.exit(4)
if last_peers in (None, 0):
    print("no sample carried a nonzero peer count")
    sys.exit(4)
print(f"series-ok records={records} errors={errors} last_peers={last_peers}")
PY

# ---- attempt loop -------------------------------------------------------------
ATTEMPT=0
LAST_COLLECTOR_RC=0
FINAL_STATUS="attempts-exhausted"
while [ "$ATTEMPT" -lt "$X0X_ATTEMPTS_MAX" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  STAMP="${X0X_DIR_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}-attempt${ATTEMPT}"
  EVID="$X0X_EVIDENCE_ROOT/$STAMP"
  # R4: exclusive creation; a collision is refused without touching it
  if ! mkdir "$EVID" 2>/dev/null; then
    FINAL_STATUS="refused-collision"
    EVID=""   # never point writes at a directory we do not own
    note "evidence dir $X0X_EVIDENCE_ROOT/$STAMP already exists; refusing (earlier evidence untouched)"
    EXIT_RC=5
    break
  fi
  START_EPOCH="$(date +%s)"
  printf '%s\n' "$START_EPOCH" > "$EVID/window-start.epoch"

  if bash -c "$X0X_NODE_CHECK" > "$EVID/node-check-t0.txt" 2>&1; then
    :
  else
    mark_attempt "failed-node-check-t0" "-"
    note "attempt $ATTEMPT: node check at t0 failed"
    continue
  fi

  # R2: log capture from the saved start epoch; owned helper
  setsid bash -c "$X0X_LOG_FOLLOW" > "$EVID/service.log" 2>&1 &
  LOG_PID=$!
  # R2: bounded honest sampler; owned helper
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
  kill -TERM -- "-$COL_PGID" 2>/dev/null || true
  COL_PGID=""
  kill -TERM "$SAMPLER_PID" 2>/dev/null || true
  wait "$SAMPLER_PID" 2>/dev/null || true
  SAMPLER_PID=""
  kill -TERM "$LOG_PID" 2>/dev/null || true
  wait "$LOG_PID" 2>/dev/null || true
  LOG_PID=""
  date +%s > "$EVID/window-end.epoch"

  STATUS="accepted"
  if [ "$COL_RC" -ne 0 ]; then
    STATUS="failed-collector"
  elif ! bash -c "$X0X_NODE_CHECK" > "$EVID/node-check-t1.txt" 2>&1; then
    STATUS="failed-node-check-t1"
  elif ! "$X0X_PYTHON" "$WORK/postcheck_series.py" "$EVID/health-series.jsonl" \
      > "$EVID/series-check.txt" 2>&1; then
    STATUS="failed-series"
  elif [ -s "$LEASE_STATE" ]; then
    STATUS="interrupted-lease"
  else
    # cap-triggered interval: unit left the clean active/success/0-restarts
    # state (node-check prints those values, order-independent)
    if node_ok_clean "$EVID/node-check-t1.txt"; then
      :
    else
      STATUS="failed-cap-or-restart"
    fi
  fi

  mark_attempt "$STATUS" "$COL_RC"
  note "attempt $ATTEMPT: $STATUS (collector exit $COL_RC, evidence $EVID)"
  if [ "$STATUS" = "accepted" ]; then
    FINAL_STATUS="accepted"
    EXIT_RC=0
    break
  fi
  # a rejected window is retained immutably; the next attempt gets a new dir
done

if [ "$FINAL_STATUS" != "accepted" ] && [ "$FINAL_STATUS" != "refused-collision" ]; then
  EXIT_RC=1
  # pass a distinctive collector failure through verbatim when that was the cause
  if [ "$LAST_COLLECTOR_RC" -ne 0 ] && [ "$LAST_COLLECTOR_RC" -lt 255 ]; then
    EXIT_RC=$((LAST_COLLECTOR_RC > 2 ? LAST_COLLECTOR_RC : 1))
  fi
fi
note "final: $FINAL_STATUS"
finish "$EXIT_RC"
