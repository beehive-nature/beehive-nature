# Agent 23 — approved Hostinger watch/live recovery and physical test handoff

Date: 2026-10-10 America/Denver; live observations 2026-10-11T01:02Z.
Founder explicitly authorized fixing watch/live 502s through approved paths.
Used strict native SSH with the existing Hostinger admin identity. No denied
forward or Computer Use cast was retried. Status: hosted door RECOVERED;
full device cohort INCOMPLETE.

Fetched origin, then merged current main fe3e9b890 into owned
`C:/Users/travi/wt-codex-mail-tls-finish`, preserving PR #340's descendant
history. Current remote head 75783653b had 20 SUCCESS, 9 IN_PROGRESS,
15 QUEUED and 8 SKIPPED checks at the observation. No completed failure.
This source commit requires fresh CI; it is not a green merge receipt.

## Repair and runtime receipts

The active Caddyfile sent watch/live to Oracle, while Hostinger had no live
door service. Added a private Docker watch door on existing
`buzz-prod_buzz-net`, using Node 22, pinned node-media-server 4.3.2 and ffmpeg.
The service runs as node with a read-only root, dropped capabilities and no
published ports. HTTP binds inside Docker; RTMP binds 127.0.0.1 inside the
container. No new public inlet, firewall change or residential daemon.

`ops/watch/live-door.mjs` now optionally serves a public static root and
configurable HTTP bind hosts. Original default bindings remain. Existing
session receipt/rate gate remains; no owner key, payment or session minting.
Host-generated publisher secret stays root-only in `/etc/buzz-watch/live.env`;
it is unrelated to the unresolved earlier incident and is not distributed.

Source is deployed at `/opt/buzz-watch/source`. Compose reports healthy.
Validated Caddy candidate; diff contained only the private watch route and
removal of watch/live/tokens from the Oracle fallback. Reloaded Caddy after
backing up the active file, overwriting contents in place to preserve inode.
No unrelated container restarted. Buzz relay remained healthy.

- Image digest: cbd2bcb40eccfa522e6f3bef0c915d4b984045f387338cb7099e85fcb4d82d5a PUBLIC-CONSTANT
- Live door source: 0a45ca03a8fe6cf706387374d74582e6b593cd72a20d97344f2e2e42b064a57c PUBLIC-CONSTANT
- Active Caddyfile: 4ca2fabb724153cce8aff0ac1b6ccbb813e7a5128e9bcae1d7d507af3b53d985 PUBLIC-CONSTANT
- Public watch SHA256: e53a140c078c5da55cbac10336e5dc1c9dba49e30c9a9159c03c1ff9c06262af PUBLIC-CONSTANT
- Public watch bytes equal the image's `/srv/watch/watch.html` exactly.

| Public observation | Result |
| --- | --- |
| relay.skaists.dev/watch/ | 200, 211991 bytes |
| /watch/cohort/ | 200, 1115 bytes |
| /watch/cohort/cohort-test.mp4 | 200, 1272750 bytes |
| Clip Range bytes=0-99 | 206, exactly 100 bytes |
| /live/health | 200, read-only, rooms=[] |
| /live/cohort/master.m3u8 without ticket | 402, receipt ticket required |
| /tokens.css, /watch/skaists.css, /watch/tour.js?v=42, /watch/hls.min.js | all 200 |
| /join/ | 200 |
| skaists.buzz/watch/cohort/ | 200 |

ffprobe measured diagnostic clip: H.264 640x360, AAC, 20.000 seconds.
Node syntax and git diff whitespace checks passed. Docker build completed;
non-fatal stage-name casing warning and existing Caddy formatting warning
are named. An initial remote final hash command retained a CR and failed;
the deployment succeeded, and a CR-free command then verified both hashes.
No publisher exists: paid live playback remains unverified. The public clip
tests TV transport/picture/audio only, not meter or room acceptance.

## Exact founder actions

TV test source is ready. Founder performs the manual cast; agent controls
remain stopped at the earlier URL-policy boundary.

1. Turn on the TV, select the Google Streamer's HDMI input. Put the Dell and
   Streamer on the same Wi-Fi.
2. On the Dell in Chrome open only
   https://relay.skaists.dev/watch/cohort/ in a separate tab. Press Play.
3. Chrome menu > Cast, save, and share > Cast. Choose Sources > Cast tab,
   then the Streamer's displayed name. Complete any physical TV prompt.
4. On the TV confirm `BNR COHORT 23`, moving colors and the quiet tone.
5. Stop casting, reconnect to the same receiver and confirm all three again.
   Report receiver name and first/reconnected picture/audio results.

Chrome flow source: https://support.google.com/googlecast/answer/3228332?hl=en .
No agent cast attempted; physical result still UNVERIFIED.

Phone steps are prepared, but B1 remains unresolved: the exposed token's
location/account and revocation status are unknown. Founder supplies those
details without the token value; do not proceed with device enrollment until
the prerequisite is resolved. No arbitrary unrelated rotation is claimed.

After B1 is cleared, independently on Samsung A16 and Pixel 10a:

1. Open https://relay.skaists.dev/join/ in the phone's normal browser.
   Keep the prefilled relay address; tap `join the room →` and select the
   same room used on the Dell. Keep browser data intact.
2. Send one unique harmless canary: `A16-<current time>` or
   `PIXEL-<current time>`. Keep it visible for accepted ID and Dell-read
   evidence. The Dell must read exactly that canary, not just count a send.
3. Read the Dell's unique reply on that phone. Record exact reply text and
   both message IDs through the normal client/receipt path.
4. Turn Wi-Fi off for ten seconds, reconnect and reload the same tab.
   Confirm the sent canary and Dell reply are displayed after reconnect.
5. Repeat independently for the other phone; report each device's result.

The existing browser identity stays in browser storage; never export it or
paste x0x/admin credentials. Buzz browser membership is distinct from native
x0x/Home enrollment. Dell v0.46.0 version alignment remains verified from the
earlier dispatch; actual send/read/reconnect receipts are still absent.

Runbook: `ops/watch/hostinger/README.md`. No merge while required CI is
pending/red. No Codex review, denied forward, policy bypass or cohort PASS.
