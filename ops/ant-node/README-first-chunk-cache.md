# ANT `/stream` first-chunk cache

Smallest honest edge cache for warm first-frame on bViEw: cache the first
**2 MiB** of each public `/stream` by XOR on the relay disk. Warm HIT serves
that prefix from disk (TTFB class ≤200 ms locally measured) then splices the
rest from antd. Cold MISS proxies antd and tees the prefix.

## Why not Caddy `cache` / reinventing antd

- Stock Caddy has no response body cache; Souin/xcaddy rebuild is a bigger
  blast radius than a 400-line node sidecar.
- antd-bridge-next is **upload only** — do not touch for GET playback.
- x0x stays OFF the playback happy path (no fake stream body).

## What changes on the relay

1. systemd unit `ant-first-chunk-cache.service` → `node first-chunk-cache.mjs`
   on `172.18.0.1:8084`, upstream `http://172.18.0.1:8082` (antd).
2. Caddy: `@ant_stream` handle → `reverse_proxy 172.18.0.1:8084` (snippet
   `Caddyfile.ant-stream-first-chunk.snippet`). Generic `/ant/*` stays on antd.
3. Accept-Ranges: stamped by the cache (and optionally Caddy header). Range
   inside the cached prefix → 206 from disk. Full GET warm → disk prefix +
   antd tail.

## Deploy (relay seat)

```bash
# 0) tree on box (or rsync this PR's ops/ant-node/)
REPO=/home/ubuntu/beehive-nature   # or wt path
sudo mkdir -p /var/cache/ant-first-chunk
sudo chown ubuntu:ubuntu /var/cache/ant-first-chunk

# 1) unit
sudo cp "$REPO/ops/ant-node/ant-first-chunk-cache.service" /etc/systemd/system/
# Edit ExecStart path if the checkout is not /home/ubuntu/beehive-nature
sudo systemctl daemon-reload
sudo systemctl enable --now ant-first-chunk-cache.service
sudo systemctl status ant-first-chunk-cache.service --no-pager

# 2) Caddy — inode law: edit the LIVE bind-mounted Caddyfile inode
#    (cat >> or editor in place; do NOT sed -i / awk|mv). Backup first.
sudo cp -a /opt/buzz/deploy/compose/Caddyfile \
  /opt/buzz/deploy/compose/Caddyfile.bak-pre-ant-first-chunk
# Insert the @ant_stream handle BEFORE the generic /ant/* proxy.
# Source of truth for the block: ops/ant-node/Caddyfile.ant-stream-first-chunk.snippet
# Then recreate caddy so it picks up the inode:
cd /opt/buzz/deploy/compose
sudo docker compose up -d --force-recreate caddy
# or: sudo docker restart buzz-prod-caddy-1

# 3) verify
XOR=7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78 PUBLIC-CONSTANT
URL="https://relay.skaists.dev/ant/v1/data/public/${XOR}/stream"
# cold (MISS): may be slow
curl -sS -D- -o /tmp/ant-cold.bin -H 'Origin: https://skaists.dev' \
  -r 0-2097151 -w 'ttfb=%{time_starttransfer} total=%{time_total}\n' "$URL" | head
# warm (HIT): second open — expect X-Ant-First-Chunk: HIT and ttfb ≪ 200ms class
curl -sS -D- -o /tmp/ant-warm.bin -H 'Origin: https://skaists.dev' \
  -r 0-2097151 -w 'ttfb=%{time_starttransfer} total=%{time_total}\n' "$URL" | head
```

## Founder verify (one-liner)

Hard-refresh bViEw once (cold MISS / fill), then open the same XOR again —
second open should paint first frame from the warm first-chunk (look for
`X-Ant-First-Chunk: HIT` on `/stream` in DevTools).

## Rollback

```bash
# Point @ant_stream back at antd :8082 (or remove the handle), recreate caddy
sudo systemctl disable --now ant-first-chunk-cache.service
```

## Measure (this seat, before relay deploy)

Local mock upstream @ ~64 KiB/s (see `first-chunk-cache.test.mjs`):

| | TTFB | to 256 KiB |
|---|---|---|
| cold MISS | ~15 ms (local) | ~3.8 s |
| warm HIT | **~6 ms** | **~6 ms** |

Live door (agent box → relay, no cache yet): TTFB ~1.18 s, to 2 MiB ~1.62 s,
Accept-Ranges absent, Range ignored. Warm ≤200 ms on the live door requires
this unit + Caddy point.

## Note
Entry uses `fileURLToPath(import.meta.url)` so the unit starts on Windows test seats as well as the Linux relay.

## Browser CORS (bViEw sheet)
Custom response headers `X-Ant-First-Chunk` and `Accept-Ranges` must be listed in `Access-Control-Expose-Headers` (see Caddy snippet) or the page reads them as null and shows em-dash — Content-Length alone is CORS-safelisted.
