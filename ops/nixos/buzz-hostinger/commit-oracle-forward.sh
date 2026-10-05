#!/bin/sh
set -eu
config=/opt/buzz/deploy/compose/Caddyfile
test "$(sha256sum "$config" | cut -d ' ' -f 1)" = 78eda22bb2f4975df53ccb890ab1660ed88d3b9fd3eccec1fc082a6b8520e182
cp -a "$config" /opt/buzz/deploy/compose/Caddyfile.before-hostinger-20260924
# After successful reload, new writes belong to Hostinger. Never automatically
# reactivate the old database after that point.
systemctl stop skaists-cutover-rollback.timer
cat /tmp/Caddyfile.hostinger-candidate > "$config"
if ! docker exec buzz-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cat /opt/buzz/deploy/compose/Caddyfile.before-hostinger-20260924 > "$config"
  docker exec buzz-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  docker start buzz-prod-redis-1 buzz-prod-minio-1 buzz-prod-relay-1
  exit 1
fi
touch /opt/buzz/deploy/compose/.skaists-migrated-to-hostinger
systemctl stop hive-board.timer hive-public.timer
docker exec buzz-prod-postgres-1 psql -U buzz -d buzz -v ON_ERROR_STOP=1 -c 'ALTER DATABASE buzz SET default_transaction_read_only = on;'
echo ORACLE_FORWARDING_COMMITTED
