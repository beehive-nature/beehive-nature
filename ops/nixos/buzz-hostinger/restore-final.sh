#!/bin/sh
set -eu
test "$(hostname)" = buzz-hostinger
test ! -e /opt/buzz/deploy/compose/.production-enabled
test "$(docker inspect -f '{{.State.Running}}' buzz-prod-relay-1)" = false
cd /root/skaists-migration
gzip -t skaists-volumes-final.tar.gz
mkdir -p final-volumes
tar -xzf skaists-volumes-final.tar.gz -C final-volumes
docker stop buzz-prod-redis-1 >/dev/null
for kind in minio git redis; do
  volume="buzz-prod_buzz-${kind}-data"
  destination="$(docker volume inspect -f '{{.Mountpoint}}' "$volume")"
  test "$destination" = "/var/lib/docker/volumes/$volume/_data"
  test -d "final-volumes/$volume/_data"
  rsync -a --delete "final-volumes/$volume/_data/" "$destination/"
  rsync -anic --delete "final-volumes/$volume/_data/" "$destination/" > "$kind-final-diff.txt"
  test ! -s "$kind-final-diff.txt"
done
docker exec -i buzz-prod-postgres-1 pg_restore -U buzz -d buzz --clean --if-exists --exit-on-error --single-transaction < skaists-final.dump
docker exec -i buzz-prod-postgres-1 psql -v ON_ERROR_STOP=1 -U buzz -d buzz < table-counts.sql > final-restored-counts.txt
echo FINAL_RESTORE_VERIFIED
