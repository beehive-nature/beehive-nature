#!/bin/sh
# Hardening revision 2026-09-28 (PR #243 follow-through; receipt dispatch
# 2026-09-28-buzz-hostinger-root-user-hardening-rider): input pins verified
# against the recorded sha256s before anything is extracted; EVERY volume's
# owning container is proven stopped before its rsync (minio was previously
# left running while its live volume was replaced); extraction happens in a
# fresh mktemp dir per run (a reused final-volumes/ could mix stale files
# from a prior archive into the rsync --delete source). The 2026-09-24 run
# of the earlier revision is recorded in MIGRATION.md; this revision exists
# for any FUTURE re-run.
set -eu
test "$(hostname)" = buzz-hostinger
test ! -e /opt/buzz/deploy/compose/.production-enabled
test "$(docker inspect -f '{{.State.Running}}' buzz-prod-relay-1)" = false
cd /root/skaists-migration
# INPUT IDENTITY, not just container integrity: gzip -t proves the archive
# is well-formed; these pins prove it is THE archive (the final database and
# volume-archive sha256s recorded in MIGRATION.md at cutover).
echo "730d2107bd4d8450c7393473e2de593b3466d5006dc3a946d4a1e97d69a6aae2  skaists-final.dump" | sha256sum -c -
echo "fa1a6bc0737d3d426dc8bb3259adef8f0e564634d9fb5428fe69ee84151aec36  skaists-volumes-final.tar.gz" | sha256sum -c -
gzip -t skaists-volumes-final.tar.gz
final_volumes="$(mktemp -d)"
trap 'rm -rf "$final_volumes"' EXIT
tar -xzf skaists-volumes-final.tar.gz -C "$final_volumes"
docker stop buzz-prod-redis-1 buzz-prod-minio-1 >/dev/null
for kind in minio git redis; do
  case "$kind" in
    minio) owner=buzz-prod-minio-1 ;;
    git) owner=buzz-prod-relay-1 ;;
    redis) owner=buzz-prod-redis-1 ;;
  esac
  test "$(docker inspect -f '{{.State.Running}}' "$owner")" = false
  volume="buzz-prod_buzz-${kind}-data"
  destination="$(docker volume inspect -f '{{.Mountpoint}}' "$volume")"
  test "$destination" = "/var/lib/docker/volumes/$volume/_data"
  test -d "$final_volumes/$volume/_data"
  rsync -a --delete "$final_volumes/$volume/_data/" "$destination/"
  rsync -anic --delete "$final_volumes/$volume/_data/" "$destination/" > "$kind-final-diff.txt"
  test ! -s "$kind-final-diff.txt"
done
docker exec -i buzz-prod-postgres-1 pg_restore -U buzz -d buzz --clean --if-exists --exit-on-error --single-transaction < skaists-final.dump
docker exec -i buzz-prod-postgres-1 psql -v ON_ERROR_STOP=1 -U buzz -d buzz < table-counts.sql > final-restored-counts.txt
echo FINAL_RESTORE_VERIFIED
