#!/usr/bin/env bash
# slots-watchdog.sh — liveness watchdog for llama-server, built for the
# bMESHLLM wedge class (ops/bmeshllm/MTP-WEDGE-INVESTIGATION.md).
#
# THE PROBE LAW: liveness is probed on /slots (or any endpoint that touches
# the slot mutex), NEVER on /health — the wedge keeps /health green while
# /slots hangs on the stuck decode path (upstream #27388's mutex analysis,
# confirmed by our SIGKILL receipt).
#
# The watchdog SUPERVISES the process it starts: on N consecutive probe
# failures it sends SIGTERM, waits --stop-grace, escalates to SIGKILL, and
# respawns. A --max-restarts bound guarantees it can never restart-loop.
# For a systemd-managed service, point --start-cmd at
# "systemctl restart <unit>" and set --no-supervise (restart only).
#
# Exit codes: 0 clean shutdown · 2 restart bound exceeded · 3 usage.
set -uo pipefail

URL=http://127.0.0.1:8091/slots
TIMEOUT=3; INTERVAL=60; MAX_FAILS=2; STOP_GRACE=30; MAX_RESTARTS=5
START_CMD=""; LOG=/dev/stdout; NO_SUPERVISE=0
while [ $# -gt 0 ]; do case "$1" in
  --url) URL=$2; shift 2;;
  --timeout) TIMEOUT=$2; shift 2;;
  --interval) INTERVAL=$2; shift 2;;
  --max-fails) MAX_FAILS=$2; shift 2;;
  --stop-grace) STOP_GRACE=$2; shift 2;;
  --max-restarts) MAX_RESTARTS=$2; shift 2;;
  --start-cmd) START_CMD=$2; shift 2;;
  --start-grace) START_GRACE=$2; shift 2;;
  --log) LOG=$2; shift 2;;
  --no-supervise) NO_SUPERVISE=1; shift;;
  *) echo "usage error: $1" >&2; exit 3;;
esac; done
[ -n "$START_CMD" ] || { echo "--start-cmd is required" >&2; exit 3; }
START_GRACE=${START_GRACE:-120}   # seconds after spawn before probe failures count:
                                  # a LOADING server fails /slots innocently (composite
                                  # battery catch, 2026-09-16 — the watchdog killed a
                                  # 60-90s model load as if wedged and restart-looped)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"; }
CHILD=0; RESTARTS=0; RUNNING=1

spawn() {
  if [ "$NO_SUPERVISE" = 1 ]; then :; else
    bash -c "$START_CMD" >>"$LOG" 2>&1 &
    CHILD=$!
  fi
}
shutdown_child() {
  [ "$NO_SUPERVISE" = 1 ] && return 0
  [ "$CHILD" -gt 0 ] && kill -0 "$CHILD" 2>/dev/null || return 0
  log "stop: SIGTERM -> pid $CHILD"
  kill -TERM "$CHILD" 2>/dev/null || true
  local waited=0
  while kill -0 "$CHILD" 2>/dev/null && [ "$waited" -lt "$STOP_GRACE" ]; do
    sleep 1; waited=$((waited+1))
  done
  if kill -0 "$CHILD" 2>/dev/null; then
    log "stop: SIGTERM ignored after ${STOP_GRACE}s (wedge signature) — SIGKILL -> pid $CHILD"
    kill -KILL "$CHILD" 2>/dev/null || true
    wait "$CHILD" 2>/dev/null
    log "stop: pid $CHILD killed"
  else
    log "stop: pid $CHILD exited cleanly after TERM (${waited}s)"
  fi
}
on_signal() { RUNNING=0; }
trap on_signal TERM INT

# probe: success iff HTTP 200 within --timeout
probe() {
  local t
  t=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time "$TIMEOUT" "$URL" 2>/dev/null) || t="curl-fail -"
  log "probe: $t"
  case "$t" in 200\ *) return 0;; *) return 1;; esac
}

log "watchdog up: url=$URL timeout=${TIMEOUT}s interval=${INTERVAL}s max-fails=$MAX_FAILS stop-grace=${STOP_GRACE}s start-grace=${START_GRACE}s max-restarts=$MAX_RESTARTS supervise=$([ $NO_SUPERVISE = 0 ] && echo yes || echo no)"
spawn
FAILS=0
GRACE_UNTIL=$(( $(date +%s) + START_GRACE ))
while [ "$RUNNING" = 1 ]; do
  sleep "$INTERVAL"
  [ "$RUNNING" = 1 ] || break
  if probe; then
    FAILS=0
    GRACE_UNTIL=0                                   # answered once: no longer starting up
  else
    if [ "$(date +%s)" -lt "$GRACE_UNTIL" ]; then
      log "probe failed (startup grace active, not counting)"
      continue
    fi
    FAILS=$((FAILS+1))
    log "probe failed ($FAILS/$MAX_FAILS)"
    if [ "$FAILS" -ge "$MAX_FAILS" ]; then
      log "WEDGE-DETECTED: $MAX_FAILS consecutive probe failures — restarting supervised service"
      shutdown_child
      if [ "$NO_SUPERVISE" = 0 ]; then
        RESTARTS=$((RESTARTS+1))
        if [ "$RESTARTS" -gt "$MAX_RESTARTS" ]; then
          log "restart bound ($MAX_RESTARTS) exceeded — exiting, no restart-loop"
          exit 2
        fi
      fi
      spawn
      FAILS=0
      GRACE_UNTIL=$(( $(date +%s) + START_GRACE ))  # a respawn earns its own grace
    fi
  fi
done
shutdown_child
log "watchdog: clean shutdown"
exit 0
