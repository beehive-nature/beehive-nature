#!/usr/bin/env bash
# invite-re-mint.sh — the standing-invite timer (buzz join-by-address lane).
# DRY-RUN BY DEFAULT. The standing invite (join.json + the door's invite link)
# expires at most 30 days after mint; this script watches it and, the day an
# admin key is granted (founder order 2026-09-04: "the day the founder grants
# bClaude admin"), mints the successor and rewrites both files atomically.
#
#   ./invite-re-mint.sh            # dry-run: report + plan, touch nothing
#   ./invite-re-mint.sh --live     # refused unless BUZZ_MINT_SEC is set (the
#                                  # admin nsec) AND typed confirmation given
#
# Exit codes: 0 healthy · 2 warn (<=14d) · 3 urgent (<=7d) · 4 expired.
set -euo pipefail
COMPOSE_DIR="/opt/buzz/deploy/compose"
JOIN_JSON="$COMPOSE_DIR/join/join.json"
DOOR="$COMPOSE_DIR/door/index.html"
PG='sudo -n docker exec buzz-prod-postgres-1 psql -U buzz -d buzz -t -A'

LIVE=0
[ "${1:-}" = "--live" ] && LIVE=1
if [ "$LIVE" = 1 ] && [ -z "${BUZZ_MINT_SEC:-}" ]; then
  echo "REFUSED: --live needs BUZZ_MINT_SEC (the admin nsec; dry-run only until the founder grants it)"; exit 5
fi

CODE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$JOIN_JSON','utf8')).invite_url.replace(/^.*\//,''))")
NOW=$(date -u +%s)
ROW=$($PG -c "SELECT role||'|'||COALESCE(max_uses::text,'unlimited')||'|'||use_count||'|'||extract(epoch from expires_at)::bigint||'|'||to_char(expires_at,'YYYY-MM-DD HH24:MI') FROM relay_invites ORDER BY expires_at DESC LIMIT 1;")
IFS='|' read -r ROLE MAXUSES USES EXP_EPOCH EXP_HUMAN <<< "$ROW"
DAYS=$(( (EXP_EPOCH - NOW) / 86400 ))
HOURS=$(( (EXP_EPOCH - NOW) / 3600 ))

echo "== standing invite watch (dry-run$( [ "$LIVE" = 1 ] && echo ' — LIVE ARMED' )) =="
echo "join.json code : ${CODE:0:14}…"
echo "db row         : role=$ROLE uses=$USES/$MAXUSES expires=$EXP_HUMAN UTC"
echo "time left      : ${DAYS}d $((HOURS % 24))h"

PLAN="plan when re-mint day comes:
  1. mint  : POST https://skaists.buzz/api/invites  {ttl_secs: 2592000, max_uses: 10000}
             NIP-98-signed with BUZZ_MINT_SEC (the granted admin key; canonical-origin law applies)
  2. rewrite: $JOIN_JSON invite_url + the door card href in $DOOR (backups kept)
  3. prove : claim-probe with a throwaway key (200 joined), curl /join.json, update the dispatch ledger"

if   [ "$DAYS" -lt 0 ];  then STATUS=EXPIRED;  RC=4
elif [ "$DAYS" -le 7 ];  then STATUS=URGENT;   RC=3
elif [ "$DAYS" -le 14 ]; then STATUS=SOON;     RC=2
else                          STATUS=healthy;  RC=0
fi
echo "verdict        : $STATUS"
echo "$PLAN"

if [ "$LIVE" = 0 ]; then
  echo "(dry-run — nothing was touched; run with --live + BUZZ_MINT_SEC on re-mint day)"
  exit "$RC"
fi
echo "LIVE path not yet exercised (awaits the admin grant); refusing to act on an unproven path."
exit 6
