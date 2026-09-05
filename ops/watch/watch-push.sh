#!/usr/bin/env bash
# watch-push.sh — the laptop's FOUNDER LINE, resilient form (POC 2026-09-04).
# Pushes RTMP to the box inlet's loopback and re-pushes on drop (the same
# auto-reconnect OBS gives the founder; the box packager respawns on its
# side and NMS publish grace is 1.5s so a re-push slots straight in).
#
# The ROAD is chosen by WATCH_ROAD:
#   x0x (default) — rtmp://127.0.0.1:19350 via the x0x tailnet forward
#                   (ops/x0x; the brief's road — needs the mesh in a good hour)
#   ssh           — rtmp://127.0.0.1:19351 via  ssh -N -L 19351:127.0.0.1:1935
#                   (founder-laptop fallback while the mesh churns; same inlet,
#                    same key, same door — only the transport differs)
set -u
KEY="${WATCH_STREAM_KEY:-$(cat ~/.watch-stream-key 2>/dev/null)}"
ROAD="${WATCH_ROAD:-x0x}"
case "$ROAD" in
  x0x) PORT=19350 ;;
  ssh) PORT=19351 ;;
  *) echo "WATCH_ROAD must be x0x or ssh"; exit 2 ;;
esac
URL="rtmp://127.0.0.1:$PORT/live/general?s=$KEY"
[ -n "$KEY" ] || { echo 'no stream key'; exit 2; }
n=0
while :; do
  n=$((n+1))
  echo "[watch-push] attempt $n $(date +%H:%M:%S)"
  # -re paces the lavfi source to WALL CLOCK — without it testsrc2 encodes at
  # CPU speed and the segments spew many× realtime, churning the live window
  # faster than any player can follow (OBS paces realtime by construction).
  ffmpeg -hide_banner -loglevel error \
    -re -f lavfi -i 'testsrc2=size=960x540:rate=24' \
    -re -f lavfi -i 'sine=frequency=392:sample_rate=44100' \
    -c:v libx264 -preset veryfast -tune zerolatency \
      -b:v 1200k -maxrate 1200k -bufsize 1800k \
      -g 48 -keyint_min 48 -sc_threshold 0 \
    -c:a aac -b:a 96k -ar 44100 \
    -rw_timeout 10000000 -f flv "$URL"
  echo "[watch-push] dropped, re-pushing in 3s"
  sleep 3
done
