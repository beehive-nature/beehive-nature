# Agent 23 — PR 340 CI queue recovery and hosted device-path readiness

Date: 2026-10-10 America/Denver. Continuation of the founder's request to check/fix CI and advance the cohort through approved paths. Status: INCOMPLETE; no device acceptance claimed.

## CI, with exact-head boundaries

Fetched origin in the existing owned `C:/Users/travi/wt-codex-mail-tls-finish` worktree. Branch remains `codex/hostinger-x0x-always-on`; starting head f3c506962. Main b9c75cd7b is already an ancestor (14 ahead / 0 behind), and the worktree started clean. No competing branch or shared-checkout write.

The current head initially had 44 queued jobs across push and pull-request workflows. Twenty-five still-active runs belonged to the superseded da6e6fb3a and db4077a2e heads of this same branch. Sent the standard GitHub cancellation request to each; all requests returned success. Completed historical evidence and current-head runs were retained, as were every other seat's runs. Cancellation is asynchronous: old run 38098085328 still reported in_progress at the later snapshot; do not call that run stopped until GitHub reports completion.

At 2026-10-11T00:48Z, current-head checks were beginning to complete: WB002 SAW equivalence, WASM corpus, secret scan and formal had passed, with more jobs queued/running. No completed failure was present. This is pending CI, not a green merge receipt. Current pull-request tests run: https://github.com/beehive-nature/beehive-nature/actions/runs/38098323499 ; push tests run: https://github.com/beehive-nature/beehive-nature/actions/runs/38098319527 . Those IDs test f3c506962; this dispatch commit requires its own fresh checks.

Read the actual older failure in run 37148289229. It was `e2e/plur-festival-entry.test.mjs:75`, raver navigation: `the press lands on the section`, false !== true. It was not the footer audit (that reported 0 worse). Main already contains 42aac5cfa, b1cbfb6ee and a79d32e5a, which repair post-frame-load landing and force the re-landing to use instant scrolling. Verified a79d32e5a is an ancestor of this branch. No speculative duplicate patch or weakened assertion; wait for current-head eternal to establish the result. No Codex review requested.

## Existing HTTPS phone path — reachable, enrollment not exercised

Read-only HTTP observations from this laptop:

| URL | Response | Meaning |
| --- | --- | --- |
| https://skaists.buzz/ | 200, application/json | Relay metadata, not the browser chat page |
| https://skaists.buzz/join/ | 200, HTML | Existing browser join entry |
| https://relay.skaists.dev/join/ | 200, HTML | Same existing public join entry on the relay hostname |
| https://relay.skaists.dev/join/assets/index-_RsFMRoT.js | 200, JavaScript, 896830 bytes | Actual application asset reachable |
| https://relay.skaists.dev/join.json | Version 1; invite present; default channel present; four rooms | Published pairing material exists; invite value was not printed or copied |
| https://relay.skaists.dev/api/join-policy | 200, empty JSON object | No policy-version field was advertised in this observation |
| https://relay.skaists.dev/info | 200; Buzz Relay, NIP-42 advertised | Capability advertisement, not an authenticated-client acceptance test |

Hosted application asset SHA256: 6c36af78679f5e5128e3c08a9a5d980b3b455909455ce42aa9c1eb5e0c3f8b59 PUBLIC-CONSTANT

The asset's local identity functions (`Ou`, `ku`, `Au`) persist a newly generated key under `buzz.local-identity.v1` in that browser; `Hu` signs a NIP-98 invite claim, and `Vu` sends it to `/api/invites/claim`. The join component `Uu` passes the persistent signer into room component `Ds`. With an existing NIP-07 extension it instead uses that extension. These are minified names in the exact hashed public asset, not a source-map or independently audited build claim.

This establishes a pre-existing browser-client implementation candidate for B4, rather than evidence that a new x0x admin gateway must be built. Browser membership on Buzz remains distinct from native x0x/Home enrollment. No claim was posted, no new identity created, no room message sent, no browser storage read, and no credential distributed. The B1 incident prerequisite remains unresolved. This was public HTTP inspection, not a replacement transport for the rejected x0x forward.

A hidden in-app-browser request to inspect the known join URL timed out and reset its kernel. No login/click/casting action followed. Browser render and phone behavior remain UNVERIFIED; reachable HTML and source do not count as device enrollment.

## TV source — a newly confirmed service blocker

Both https://relay.skaists.dev/watch/ and https://relay.skaists.dev/live/health returned 502. Strict read-only SSH to Hostinger showed `buzz-live.service` inactive. The active Caddyfile routes `/watch/*` and `/live/*` through its existing `oracle-service` import. This is a live dependency on Oracle, despite the Hostinger x0x node itself being independent. The watch directory exists, but the active Caddy container does not mount it. No service, firewall, route, credential or security setting was changed.

B5 therefore has two independent gates: the earlier browser-control guardrail/physical TV evidence, and a healthy authorized hosted media source. Migrating the paid watch pipeline requires its RTMP/ffmpeg/session-gate dependencies and separate runtime receipts; a 200 static page alone would not fix playback. Agent 23 owns source-readiness investigation within approved access; the service/access owner must supply any authorization needed for migration. No cast attempted and no receiver discovered.

## Physical checklist — prepared, not a request to start yet

The founder should not act on these steps until Agent 23 confirms the incident/access gates are resolved and the source is ready. Do not export, paste or photograph any key, token or recovery material.

Phones, separately for Samsung A16 and Pixel 10a:

1. Use the phone's normal Chrome profile on `peter pan 5G`, not Incognito. The retained browser identity is needed for the reconnect check.
2. Once cleared, open https://relay.skaists.dev/join/ . Confirm the relay field reads `https://relay.skaists.dev`, then tap `join the room`. If a signer dialog appears, complete it personally. Stop on a refusal; report the non-secret error text only. Do not use the `key` export control.
3. Agent 23 will name the acceptance room and provide a different harmless canary for each phone. Send that canary once. Keep the message on screen while Agent 23 records the accepted message ID and verifies the Dell actually reads that exact content/ID.
4. Read the Dell reply on that phone and report its exact harmless reply text. Agent 23 records the reply ID and recipient-read evidence separately.
5. Turn Wi-Fi off for ten seconds, turn it back on and reconnect to the same network. Reload the same tab without clearing browser data. Confirm both the sent canary and Dell reply are still present. Repeat independently on the other phone. Server history alone does not prove the phone displayed either message.

Google Streamer / TV, after the source and browser-control gates are cleared:

1. Turn on the TV, select the Streamer's HDMI input and keep it on the same Wi-Fi as the Dell. Provide only the receiver's displayed name.
2. Agent 23 prepares a separate public-content Buzz viewing tab. Never cast this chat, a credential page, or the whole desktop.
3. Use ordinary Chrome `More > Cast, save, and share > Cast`, with `Cast tab` as the source, and choose the named Streamer. The founder completes any physical receiver prompt. The agent must not retry or work around the earlier URL-policy stop.
4. On the physical TV confirm the expected title/canary, moving picture and sound. Then stop casting, reconnect to the same receiver and confirm moving picture/sound again. Record receiver name, source URL, both times and physical confirmation. Sender-side connected status is insufficient.

Chrome menu and same-network requirements checked against Google's current instructions: https://support.google.com/googlecast/answer/3228332?hl=en . No third-party Android installer is needed for the proposed browser-client flow; its acceptance remains unverified.

## Current matrix and preserved boundaries

| Device | Result | Remaining owner/action |
| --- | --- | --- |
| Dell | BLOCKED | B3 signed version alignment already PASS; B1 incident owner, B2 access-policy owner, then actual client send/read/reconnect evidence |
| A16 | BLOCKED | B1 incident owner; Agent 23 verifies existing Buzz browser membership/room path; founder performs phone sign-in and physical reads/reconnect |
| Pixel 10a | BLOCKED | Same, independently attributed identity and receipts |
| Google Streamer | BLOCKED | Agent 23 establishes healthy authorized media source; browser-policy owner resolves B5; founder confirms physical playback/reconnect |

No containment evidence has appeared for the unidentified token incident. No x0x admin credentials were exposed, no local daemon or forward was started, and the Oracle-specific helper remains unchanged. The prior forwarding rejection (`blocked by policy`) and Computer Use URL-confidence stop remain in force. Never use another transport or control tool to work around them. No merge while required CI is pending/red. This dispatch records progress and exact remaining physical steps, not cohort completion.
