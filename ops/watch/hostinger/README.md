# Hostinger watch door

The existing HTTPS Caddy edge routes `/watch`, `/watch/*`, `/live/*` and
`/tokens.css` to `watch-door:8094` on `buzz-prod_buzz-net`. Compose publishes
no ports. RTMP binds loopback inside the container. This restores the door;
it does not establish an active publisher or bypass the session receipt gate.

Build from the repository root:

```sh
docker build -f ops/watch/hostinger/Dockerfile -t buzz-watch:agent23-hostinger .
docker compose -p buzz-watch -f ops/watch/hostinger/compose.yml config --quiet
docker compose -p buzz-watch -f ops/watch/hostinger/compose.yml up -d --wait
```

Runtime source lives at `/opt/buzz-watch/source`. A root-only, mode-600
`/etc/buzz-watch/live.env` supplies `STREAM_KEY`; generate it on the host,
never print it or distribute it to devices. This internal publisher key is
not containment of the earlier unidentified token incident. No meter owner
key is installed. The existing read-only Jungle4 session/rate reader remains.

The image includes the tracked public surfaces and a generated 20-second
H.264/AAC diagnostic clip. `/watch/cohort/` is a public physical playback test,
separate from paid live playback and Buzz room membership. Expect label
`BNR COHORT 23`, moving colors and a quiet tone, including after reconnect.

Validate the candidate Caddyfile inside the existing Caddy container first.
Compare it against the current host file to preserve concurrent changes.
Back up `/opt/buzz/deploy/compose/Caddyfile.hostinger`, then overwrite its
contents in place (retain the bind-mounted inode) and use `caddy reload`.
Do not replace the file with a rename or restart unrelated services.
For rollback, copy the backup contents back in place and reload Caddy.
The initial recovery backup is
`/opt/buzz/deploy/compose/Caddyfile.hostinger.agent23-20261011T010210Z`.

Verify public watch/dependencies/clip return 200, a clip byte range returns
206, `/live/health` returns 200, and `/live/cohort/master.m3u8` without a
ticket returns 402. Empty health rooms means no active publisher. CI and
physical phone/TV acceptance remain separate receipts.
