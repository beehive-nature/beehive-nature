# RECEIPT — THE WATCH-TOGETHER ROOM, POC (2026-09-04)

The lane order, all four items, one surface + box ops, nothing hosted,
nothing third-party: `surfaces/watch.html` + `ops/watch/`. **e2e receipt:
WATCH-ROOM-RECEIPT-CLEAN** (`e2e/watch-room-shot.mjs`, shots in
`e2e/shots-watch/`) — the founder's laptop streams; a phone at 390px
watches in the skaists.buzz room with chat + ticker; one metered session
paused and resumed.

## THE LADDER, AS RECEIPTED (session 7950 on jungle4, contract bnrapolltest)

| rung | evidence |
|---|---|
| the stream publishes from the laptop | `/live/health` — newest segment 0.4s old, measured 480:1110 kb/s · 288:536 kb/s (door's own segment accounting) |
| session opened with credit | opensess `ab024f032d37…` + settle 1.2000 A `78ea86aefcd6…` (key box-side, 600, never printed) |
| the phone watches | receipt № entered at 390px → **playing in 3.2s**; hls.latency avg **7.2s** @ 986 kb/s declared |
| the room | the `/join` view joined skaists.buzz INSIDE the watch page; the phone spoke and watched it arrive (`watch-390-chat.png`) |
| the ticker | the streamer's curl → now/set/next rendered (`watch-390-ticker.png`) |
| PAUSE-NOT-KILL | charge 2 units (0.6 × 2 = the whole credit) → door refuses the playlist → veil up, player parked, strip says PAUSED (`watch-390-paused.png`) |
| the room lives under pause | a message sent WHILE PAUSED arrived — nothing killed |
| TOP-UP + RESUME | settle while paused + resume → the picture resumed un-aided (`watch-390-resumed.png`) |
| clean | zero page errors |

## The shape

- **INGEST**: OBS/ffmpeg → RTMP → box inlet (node-media-server v4, loopback
  :1935 — the x0x tailnet forward is the road; targets 1935+8094 added to
  `/etc/x0x/connect-acl.toml`) → ffmpeg ×2 renditions (854×480 ≈800k,
  512×288 ≈350k, 2s segments, 24s window) → Caddy same-origin on
  relay.skaists.dev.
- **ROOM**: watch.html = video tile (hls.js 1.6.15 vendored, L-VERIFY,
  sha256-pinned) + the `/join` room view in-frame (same relay, same origin —
  canonical-origin law, shared localStorage identity) + the ticker line.
- **METER**: the playlist door (`buzz-live.service`, :8094) reads the
  jungle4 session receipt READ-ONLY (4s cache) and rewrites playlists so
  `?session=` rides every poll; credit out → 402 → the page parks the
  player and keeps polling; settle+resume un-parks it. Four audit states
  as comb cells, z3.2's vocabulary, CARE line verbatim; 255 (not yet
  audited) lights nectar.
- **Three audiences**: the ingest card (streamer), the room (member), the
  receipt № + strip (guest/payer). tokens.css only; 390px first.

## FLAGS (honest)

1. **The x0x mesh had a bad hour.** RTMP-over-tailnet is PROVEN (06:03–06:11:
   PUBLISH room=general in the journal, health with measured kbps, both
   through the 19350 forward), but the founder's building wifi degraded
  (cloudflare.com itself took 21s) and the QUIC data plane dropped long
   streams every ~45s — trust+pin+ACL+version-match all verified present.
   The sustained e2e rode `WATCH_ROAD=ssh` (ssh -L to the same loopback
   inlet, same key, same door — founder-laptop fallback, wrapper
   auto-reconnects like OBS). The tailnet road is the default and works
   in good hours.
2. **The buffer bug** (found by the local-reference differential: same
   ffmpeg flags + hls.js played perfectly with no door): the door's send()
   JSON-stringified Buffers — segments were served as `{"type":"Buffer":…}`
   text. One line; `fragParsingError` died with it.
3. **Caddy's static file_server under the bind mount 404'd segments its own
   `ls` showed** (unexplained). Segments now ride the door — one road for
   the whole `/live` tree; the playlist is the gate either way.
4. **Production caddy went down ~2 minutes** (illegal one-line
   `file_server { root … }` block crash-looped the container after a
   restart; healed by multi-lining). The inode law struck twice — every
   Caddyfile edit that swapped the inode was invisible to the container
   until restart.
5. NMS v4's 30s publish grace is patched to 1.5s on the box (deploy step,
   in the README); `-re` must pace EVERY lavfi input; a fresh-era wipe on
   re-publish keeps append_list timelines honest.

## NEXT

- The stream was left running (founder's line: `ops/watch/watch-push.sh`,
  stop with `WATCH_ROAD=ssh` wrapper kill + `x0x-tunnel.ps1 down`);
- LL-HLS would cut the 7s glass-to-glass toward 2-3s;
- the auditmark rung (honey→capped) can be driven per-session by ops when
  the founder wants the fourth cell lit on-chain;
- re-ride the tailnet road in a good hour and bank the sustained receipt.
