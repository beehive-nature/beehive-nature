#!/usr/bin/env bash
# hive-board.sh — regenerate the public engine-room feed (OR-board lane).
# Reads the relay's own DB (no keys, no signing — public-by-construction data),
# writes /srv/hive/board.json atomically. Idempotent; timer-driven.
set -euo pipefail
SQL="/opt/buzz/deploy/compose/hive/hive-board.sql"
OUT="/opt/buzz/deploy/compose/hive/board.json"
TMP="$(mktemp /opt/buzz/deploy/compose/hive/.board.XXXXXX)"
docker exec -i buzz-prod-postgres-1 psql -U buzz -d buzz -t -A -f /dev/stdin < "$SQL" > "$TMP"
chmod 644 "$TMP"
mv "$TMP" "$OUT"
