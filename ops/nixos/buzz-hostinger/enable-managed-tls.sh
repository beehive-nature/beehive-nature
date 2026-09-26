#!/bin/sh
set -eu
cd /opt/buzz/deploy/compose
test -f .production-enabled
test -s Caddyfile.hostinger.managed
store=/var/lib/docker/volumes/buzz-prod_buzz-caddy-data/_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory
install -d -m 700 "$store"
for name in skaists.buzz relay.skaists.dev; do
  test -s "certs/$name/$name.key"
  test ! -e "$store/$name"
  cp -a "certs/$name" "$store/"
done
docker cp Caddyfile.hostinger.managed buzz-prod-caddy-1:/tmp/Caddyfile.managed
docker exec buzz-prod-caddy-1 caddy validate --config /tmp/Caddyfile.managed --adapter caddyfile
cp -a Caddyfile.hostinger Caddyfile.hostinger.manual-tls
# Preserve inode for the running bind mount.
cat Caddyfile.hostinger.managed > Caddyfile.hostinger
# Restart when changing manually loaded certificates to managed certificates;
# reloading alone left the previous cache without managed entries on Caddy 2.11.4.
docker restart buzz-prod-caddy-1
