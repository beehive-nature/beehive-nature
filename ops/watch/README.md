# ops/watch — THE WATCH-TOGETHER ROOM (POC, 2026-09-04)

One-file surface + box ops. The founder streams from OBS/ffmpeg on the
laptop → RTMP over the x0x tailnet forward → the box transcodes with
ffmpeg to HLS (2 renditions) → Caddy serves `/live/<room>/*` same-origin
on relay.skaists.dev. The room is the buzz room (the `/join` view reused
in-frame), the ticker is a JSON the streamer updates, and the playlist
door checks a live jungle4 meter session — read-only, pause-not-kill.

## The parts

| piece | where | what |
|---|---|---|
| `surfaces/watch.html` | repo → `/srv/watch/index.html` | the one-file surface (390px first, tokens.css only) |
| `surfaces/hls.min.js` + `hls.LICENSE` | repo → `/srv/watch/` | hls.js 1.6.15, Apache-2.0, L-VERIFY header with pinned sha256 |
| `live-door.mjs` | box `/opt/buzz-watch/` | RTMP inlet (node-media-server v4, loopback :1935) + ffmpeg packager (480/288, 2s segments, 24s window) + the read-only door (:8094) |
| `buzz-live.service` | box `/etc/systemd/system/` | systemd unit (pattern: buzz-meter-gate) |
| `live.env` | box `/etc/buzz-watch/` (600) | STREAM_KEY, RPC, CONTRACT, LIVE_DIR |
| `meter.mjs` | box `/opt/buzz-watch/` | session ops (open/charge/topup/resume/status) — the payer side; the key stays on the box |
| `watch-push.sh` | laptop | the founder's push line, road-agnostic + auto-reconnect |
| `stream-laptop.sh` | laptop | x0x tailnet up + forwards + OBS lines + ticker curl |
| `e2e/watch-room-shot.mjs` | repo | the receipt (phone 390px, chat, ticker, pause/resume) |

## Box layout

- `/opt/buzz-watch/` — node unit + `node_modules` (node-media-server@4.3.2,
  eosjs@22.1.0)
- `/etc/buzz-watch/live.env` — STREAM_KEY (`openssl rand -hex 24`), RPC
  (jungle4.greymass.com), CONTRACT (bnrapolltest), LIVE_DIR
- `/etc/buzz-watch/bnrapolltest.active.wif` — the meter owner key, mode 600,
  box-only (copied once from the x402 lane's /tmp vault)
- `/opt/buzz/deploy/compose/watch/` → `/srv/watch` (compose.watch.yml)
- `/opt/buzz/deploy/compose/live/`  → `/srv/live`  (segments live here)
- Caddy (relay.skaists.dev): `handle_path /watch/*` static;
  `handle /live/*` → ONE ordered route — health/ticker/session/playlists and
  segments ALL ride the door at 172.18.0.1:8094 (segments too: see LAWS)
- iptables: `-A INPUT -s 172.16.0.0/12 --dport 8094 -j ACCEPT`
  (the per-port door law — banked in the voice lane) + netfilter-persistent save
- x0x connect ACL (box `/etc/x0x/connect-acl.toml`): targets += `127.0.0.1:1935`
  + `127.0.0.1:8094` (mirrored in-tree at ops/x0x/connect-acl.toml)

## The door (READ-ONLY by construction)

- `GET /live/<room>/<name>.m3u8?session=<n>` — the ONE gate. Reads the
  jungle4 `sessions` row (4s cache), serves ONLY when `state==0` AND
  credit−burned > 0. Playlists are REWRITTEN on serve so `?session=` rides
  every child URI (hls.js drops the base query on relative resolution).
- `GET /live/session/<n>.json` — the row, for the page's meter strip.
- `GET/POST /live/ticker/<room>[.json]` — the streamer's line (bearer = STREAM_KEY).
- `GET /live/<room>/<v>_<seq>.ts` — segments (the playlist is the gate).
- `GET /live/health` — publishing + measured kbps per rendition.
- fail-closed: meter RPC unreachable → 503, never a playlist.

## THE LAWS (all paid for today)

1. **THE INODE LAW, caddy edition**: `sed -i` / `awk|mv` on the Caddyfile
   swaps the inode; the caddy container keeps serving the OLD one. Edit
   bind-mounted configs IN PLACE (`cat new > old`), and when the container
   was started mid-surgery, `docker restart` (or force-recreate) re-resolves
   the path. Symptom of violation: reloads "succeed", behavior never changes.
2. **One-line blocks are illegal Caddyfile syntax** (`file_server { root /x }`
   crashed caddy in a restart loop — production edge down for ~2 minutes,
   healed by multi-lining the block).
3. **Caddy's static file_server under a container-bind can 404 files its own
   `ls` shows** (observed, unexplained — bind/mount timing). CURE: serve the
   segments from the door itself; one road for the whole /live tree. The
   door is node reading the same path the packager writes — no mount in
   between.
4. **Per-port iptables door**: caddy→host-service needs its explicit
   `172.16.0.0/12 --dport <n>` ACCEPT (8094 here), else "Host is unreachable"
   from the container while 8091/8092/8093 work.
5. **`-re` on EVERY lavfi input**: one `-re` before the first `-i` paces only
   that input; the free-running sine drives the muxer at CPU speed and
   segments spew many× realtime, churning the live window faster than any
   player can follow. `-re` before EACH `-i`.
6. **NMS v4 publish grace is hardcoded 30s** (`PUBLISH_GRACE_MS` in
   node_modules/node-media-server/src/server/broadcast_server.js) — patched
   to 1500ms on the box (deploy step, not a hand-edit: it is in the receipt).
7. **NMS v4 events**: `prePublish`/`postPublish` fire on EVERY attempt
   (the "already has a publisher" refusal comes after both); `donePublish`
   fires twice per loss. Validate on prePublish, spawn on postPublish,
   ignore donePublish.
8. **SINGLE-WRITER LAW**: spawn/exit races leak a second packager whose
   sequence counter interleaves playlist rewrites and deletes segments the
   first one listed (players see 404s at the live edge). Every spawn reaps
   all known packagers for the room first (SIGKILL).
9. **omit_endlist + append_list**: a dying packager's `#EXT-X-ENDLIST`
   strands the respawned one (it writes segments but cannot continue a
   terminated playlist). Live packagers never write ENDLIST.
10. **The x0x mesh has good hours and bad hours.** The RTMP-over-tailnet
    leg is proven (journal + health receipts); on a bad hour (founder's
    building wifi degraded — cloudflare.com itself took 21s) the QUIC data
    plane drops long streams every ~45s even with trust+pin+ACL+version
    match all verified. `watch-push.sh` carries the same auto-reconnect OBS
    gives the founder, and `WATCH_ROAD=ssh` rides an ssh -L tunnel to the
    same loopback inlet (founder-laptop fallback, flagged in the receipt).

## Streamer's quickstart (OBS)

```
x0x-tunnel.ps1 up        # + the two lane forwards (stream-laptop.sh up does both)
OBS → Stream → Server: rtmp://127.0.0.1:19350/live  Key: general?s=<STREAM_KEY>
curl -X POST http://127.0.0.1:18094/live/ticker/general \
  -H "authorization: Bearer <STREAM_KEY>" -H "content-type: application/json" \
  -d '{"now":"…","set":"21:00","next":"…"}'
```

The stream key lives in `/etc/buzz-watch/live.env` on the box (600) and
`~/.watch-stream-key` on the laptop — never in the repo.
