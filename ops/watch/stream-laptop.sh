#!/usr/bin/env bash
# stream-laptop.sh — THE FOUNDER'S LINE to the watch room (POC 2026-09-04).
# Laptop → x0x tailnet forward → box RTMP inlet → ffmpeg ×2 renditions →
# Caddy same-origin HLS. Nothing third-party; nothing leaves the estate.
#
# usage: ./stream-laptop.sh up   [key]   # forwards + push a testcard stream
#        ./stream-laptop.sh obs  [key]   # print the OBS lines only
#        ./stream-laptop.sh ticker "NOW" "SET" "NEXT"   [key]
#        ./stream-laptop.sh down          # stop ffmpeg + free the forwards
# The stream key is read from $WATCH_STREAM_KEY if set (never committed).
set -euo pipefail

X0X_DIR="${X0X_DIR:-/c/Users/travi/x0x-win}"
BOX_AGENT='1ca00a42186e3d91591e63fcc153b75aee4b8bd93aedd2c2a56ac2618df66367' # PUBLIC-CONSTANT hive-box agent id
BOX_MACHINE='5e9ace67b3825b67f1201ab1490fed1eb1d169edf4dc4499934e92f47fe37bc9' # PUBLIC-CONSTANT hive-box machine id
RTMP_LOCAL=127.0.0.1:19350   # → box :1935 (RTMP inlet, loopback-only there)
DOOR_LOCAL=127.0.0.1:18094   # → box :8094 (ticker POST + session reads)
ROOM=general
KEY="${2:-${WATCH_STREAM_KEY:-}}"

need_key() { [ -n "$KEY" ] || { echo 'stream key required (arg 2 or WATCH_STREAM_KEY env)'; exit 2; }; }

case "${1:-}" in
up)
  need_key
  # 1. the tailnet: daemon (lean profile) + the direct machine session
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$X0X_DIR/x0x-tunnel.ps1")" up
  X0X="$X0X_DIR/x0x.exe"
  # 2. arm this lane's forwards (idempotent: port busy = already armed)
  "$X0X" forward add --local "$RTMP_LOCAL" --peer "$BOX_AGENT" --target-port 1935 2>/dev/null || true
  "$X0X" forward add --local "$DOOR_LOCAL" --peer "$BOX_AGENT" --target-port 8094 2>/dev/null || true
  # 3. the push: a testcard with a wall-clock overlay (the human latency
  #    receipt — compare the burned-in clock on the phone to the wall).
  #    The founder's OBS uses the same road: rtmp://127.0.0.1:19350/live
  #    with stream key "<room>?s=<WATCH_STREAM_KEY>".
  echo 'pushing testcard → box (Ctrl-C ends the stream, forwards stay armed)'
  exec ffmpeg -hide_banner -loglevel warning \
    -f lavfi -i "testsrc2=size=960x540:rate=24" \
    -f lavfi -i "sine=frequency=392:sample_rate=44100" \
    -vf "drawtext=text='skaists watch room · %{localtime\:%H\\\:%M\\\:%S}':x=14:y=14:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=12" \
    -c:v libx264 -preset veryfast -tune zerolatency -b:v 1200k -maxrate 1200k -bufsize 1800k \
    -g 48 -keyint_min 48 -sc_threshold 0 \
    -c:a aac -b:a 96k -ar 44100 \
    -f flv "rtmp://$RTMP_LOCAL/live/$ROOM?s=$KEY"
  ;;
obs)
  need_key
  cat <<EOF
OBS → Settings → Stream:
  Server    rtmp://127.0.0.1:19350/live
  Stream Key $ROOM?s=$KEY
(the tailnet must be up: x0x-tunnel.ps1 up + the two forwards — run 'up' once first)
EOF
  ;;
ticker)
  need_key
  curl -sS -X POST "http://$DOOR_LOCAL/live/ticker/$ROOM" \
    -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
    -d "{\"now\":$(printf '%s' "${2:-}" | jq -Rans .),"set\":$(printf '%s' "${3:-}" | jq -Rans .),"next\":$(printf '%s' "${4:-}" | jq -Rans .)}"
  echo
  ;;
down)
  pkill -f 'rtmp://127.0.0.1:19350' 2>/dev/null || true
  "$X0X_DIR/x0x.exe" forward remove --local "$RTMP_LOCAL" 2>/dev/null || true
  "$X0X_DIR/x0x.exe" forward remove --local "$DOOR_LOCAL" 2>/dev/null || true
  echo 'stream down; forwards freed (daemon still lean-up — x0x-tunnel.ps1 down stops it)'
  ;;
*)
  echo 'usage: stream-laptop.sh up|obs|ticker|down'; exit 2 ;;
esac
