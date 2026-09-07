#!/usr/bin/env bash
# Scoped SSH forwarding with a renewable lease. No laptop gossip daemon,
# copied key, public listener, pkill, or timer that can stop a later session.
set -euo pipefail
umask 077
action=${1:-status}
lease_seconds=${2:-600}
mode=${3:-api}
host=${BNR_SSH_HOST:-oracle}
cache=${XDG_CACHE_HOME:-$HOME/.cache}/bnr-box-tunnel
[[ $host =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'Invalid SSH host alias' >&2; exit 2; }
mkdir -p -- "$cache"
chmod 700 -- "$cache"
cache=$(cd -- "$cache" && pwd -P)

valid_session() {
  [[ $1 == "$cache"/session.* && -d $1 && ! -L $1 && $(dirname -- "$1") == "$cache" ]]
}
check() { ssh -S "$1/control" -O check -o BatchMode=yes "$host" >/dev/null 2>&1; }
close_session() { ssh -S "$1/control" -O exit -o BatchMode=yes "$host" >/dev/null 2>&1 || true; }
current_session() {
  [[ -f $cache/current ]] || return 1
  IFS= read -r session < "$cache/current"
  valid_session "$session"
}

# One watcher owns precisely one control socket. Renewing changes its lease;
# replacing a session gives the next connection a different socket.
if [[ $action == _watch ]]; then
  session=$lease_seconds
  valid_session "$session" || exit 2
  echo "$$" > "$session/watcher.pid"
  while check "$session"; do
    deadline=$(cat -- "$session/expires")
    [[ $deadline =~ ^[0-9]+$ ]] || { close_session "$session"; exit 1; }
    if (( $(date +%s) >= deadline )); then
      exec 9>"$cache/lock"
      flock -x 9
      deadline=$(cat -- "$session/expires")
      if (( $(date +%s) >= deadline )); then close_session "$session"; fi
      flock -u 9
    fi
    sleep 2
  done
  exit 0
fi

[[ $lease_seconds =~ ^[0-9]+$ ]] && (( lease_seconds >= 1 && lease_seconds <= 7200 )) || { echo 'Lease must be 1..7200 seconds' >&2; exit 2; }
[[ $mode == api || $mode == media ]] || { echo 'Mode must be api or media' >&2; exit 2; }
exec 9>"$cache/lock"
flock -x 9
case "$action" in
  up)
    if current_session && check "$session"; then
      previous_mode=$(cat -- "$session/mode")
      [[ $mode == "$previous_mode" ]] || { echo 'Tunnel is up with different ports; run down before changing mode.' >&2; exit 1; }
      echo $(( $(date +%s) + lease_seconds )) > "$session/expires.tmp"
      mv -- "$session/expires.tmp" "$session/expires"
      echo "SSH tunnel renewed for ${lease_seconds}s; no laptop P2P process started."
      exit 0
    fi
    session=$(mktemp -d "$cache/session.XXXXXXXX")
    echo $(( $(date +%s) + lease_seconds )) > "$session/expires"
    echo "$mode" > "$session/mode"
    forwards=(-L 127.0.0.1:18080:127.0.0.1:12700 -L 127.0.0.1:18082:172.18.0.1:8082)
    if [[ $mode == media ]]; then
      forwards+=(-L 127.0.0.1:18094:127.0.0.1:8094 -L 127.0.0.1:19350:127.0.0.1:1935)
    fi
    if ! ssh -fNT -M -S "$session/control" -o ControlPersist=no \
        -o ExitOnForwardFailure=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
        -o ConnectTimeout=10 -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
        -o ForwardAgent=no -o PermitLocalCommand=no "${forwards[@]}" "$host"; then
      echo 'Tunnel failed; no existing process was stopped.' >&2
      exit 1
    fi
    echo "$session" > "$cache/current.tmp"
    mv -- "$cache/current.tmp" "$cache/current"
    # WSL tears down the launching session; detach the watcher into its own
    # session just as ssh -f does. Verify it started before reporting success.
    setsid --fork bash "$0" _watch "$session" "$mode" 9>&- </dev/null >/dev/null 2>&1
    for attempt in {1..20}; do
      [[ ! -f $session/watcher.pid ]] || break
      sleep 0.1
    done
    if [[ ! -f $session/watcher.pid ]]; then
      close_session "$session"
      echo 'Lease watcher failed to start; tunnel closed.' >&2
      exit 1
    fi
    echo "SSH tunnel UP for ${lease_seconds}s: 127.0.0.1:18080 -> box x0x; 127.0.0.1:18082 -> box antd."
    [[ $mode != media ]] || echo 'Media ports: 127.0.0.1:18094 (live API), 127.0.0.1:19350 (RTMP).'
    ;;
  down)
    if current_session; then close_session "$session"; fi
    echo "This helper's SSH tunnel is down; unrelated SSH/P2P processes were not touched."
    ;;
  status)
    if current_session && check "$session"; then
      deadline=$(cat -- "$session/expires")
      echo "SSH tunnel UP; lease remaining $(( deadline - $(date +%s) ))s; mode $(cat -- "$session/mode")."
    else
      echo 'SSH tunnel DOWN.'
    fi
    ;;
  *) echo 'usage: box-tunnel.sh up|down|status [lease-seconds] [api|media]' >&2; exit 2 ;;
esac
