#!/usr/bin/env bash
# door-meter cutover — ONE founder console action on buzz-hostinger.
# Run as root in the hPanel console (SSH is retired by design).
# The binary already arrived by x0x mesh file transfer; the pool
# key is hashed, never printed. Idempotent; backs up what it touches.
set -euo pipefail

BIN=$(ls /var/lib/x0x/data/transfers/*_door-meter | head -1)
install -m 0755 "$BIN" /var/lib/llama-pool/door-meter

# keys.json: existing door key -> capped "test" account (100 MiB),
# plus a 1-byte probe account for the 402 self-test. Hashes only.
set -a; . /var/lib/llama-pool/door.env; set +a
H=$(printf %s "$POOL_KEY" | sha256sum | cut -d' ' -f1)
PROBE="probe-$(date +%s)"
PH=$(printf %s "$PROBE" | sha256sum | cut -d' ' -f1)
cat > /var/lib/llama-pool/keys.json <<EOF
[{"key_sha256":"$H","account":"test","cap_bytes":104857600},{"key_sha256":"$PH","account":"probe","cap_bytes":1}]
EOF
chmod 600 /var/lib/llama-pool/keys.json
echo "PROBE_KEY=$PROBE" > /root/door-meter-probe.env; chmod 600 /root/door-meter-probe.env

cat > /etc/systemd/system/door-meter.service <<'EOF'
[Unit]
Description=door-meter: per-key metered gate for the llama-pool door
After=network.target llama-server-hostinger.service
[Service]
ExecStart=/var/lib/llama-pool/door-meter --listen 172.20.0.1:8092 --upstream 172.20.0.1:8091 --keys /var/lib/llama-pool/keys.json --meter /var/lib/llama-pool/meter.jsonl
Restart=always
RestartSec=3
User=root
MemoryMax=256M
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
iptables -w -C INPUT -s 172.20.0.0/16 -p tcp --dport 8092 -j ACCEPT 2>/dev/null \
  || iptables -w -I INPUT 1 -s 172.20.0.0/16 -p tcp --dport 8092 -j ACCEPT
systemctl daemon-reload; systemctl enable --now door-meter
sleep 2; systemctl is-active door-meter

# Preflight (2026-10-22: public door answered keyed 503 while the
# member was healthy host-side — the container->member hop is sick).
# Re-run the estate's firewall oneshot, then prove the exact path
# Caddy will use (container -> meter 8092, unauthenticated = 401
# body). Abort BEFORE the Caddy repoint if that path is dead; the
# meter->member leg is host-local and probed first.
systemctl restart llama-pool-fw || true
curl -sf -m 5 http://172.20.0.1:8091/health; echo " member-host-ok"
docker run --rm --network buzz-prod_buzz-net busybox:stable wget -qO- -T 5 http://172.20.0.1:8092/v1/models | grep -q unauthorized
echo "container->meter 401-ok"

# Caddy repoint: /pool/* upstream member -> meter. Copy flow only, no
# in-place sed: nixos activation (ops/x0x/hostinger/door-meter.nix)
# pre-renders Caddyfile.hostinger.metered with ONE fixed expression
# and keeps a one-time Caddyfile.hostinger.premeter backup. If this
# runs before that rebuild, render them here with the same expression.
# Rollback: cp Caddyfile.hostinger.premeter Caddyfile.hostinger, then
# the same compose up -d caddy.
cd /opt/buzz/deploy/compose
[ -f Caddyfile.hostinger.premeter ] || cp -p Caddyfile.hostinger Caddyfile.hostinger.premeter
[ -f Caddyfile.hostinger.metered ] || sed 's|reverse_proxy 172.20.0.1:8091 {|reverse_proxy 172.20.0.1:8092 {|' Caddyfile.hostinger.premeter > Caddyfile.hostinger.metered
grep -qF 'reverse_proxy 172.20.0.1:8092 {' Caddyfile.hostinger.metered || { echo "ABORT: .metered has no meter upstream"; exit 1; }
cp Caddyfile.hostinger Caddyfile.hostinger.bak-meter-$(date +%Y%m%dT%H%M%SZ)
cp Caddyfile.hostinger.metered Caddyfile.hostinger
docker compose -p buzz-prod -f compose.yml -f compose.hostinger.yml up -d caddy
sleep 3

echo "--- verify (public door) ---"
. /root/door-meter-probe.env
curl -s -o /dev/null -w "no-key:%{http_code}\n" https://relay.skaists.dev/pool/v1/models
curl -s -o /dev/null -w "test-key:%{http_code}\n" -H "Authorization: Bearer $POOL_KEY" https://relay.skaists.dev/pool/v1/models
curl -s -o /dev/null -w "probe-1st:%{http_code}\n" -H "Authorization: Bearer $PROBE_KEY" https://relay.skaists.dev/pool/v1/models
curl -s -o /dev/null -w "probe-2nd(402):%{http_code}\n" -H "Authorization: Bearer $PROBE_KEY" https://relay.skaists.dev/pool/v1/models
tail -2 /var/lib/llama-pool/meter.jsonl
echo CUTOVER-DONE
