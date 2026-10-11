# Agent 23 — signed Dell version alignment and remaining device gates

Date: 2026-10-10 America/Denver. Cohort status: INCOMPLETE / BLOCKED. B3 binary alignment is now PASS; no participating device is accepted.

## Ownership and recovered push

Continued only in `C:/Users/travi/wt-codex-mail-tls-finish`, branch `codex/hostinger-x0x-always-on`, existing PR #340. The prior chat's actual commit/push command completed with exit 0: staged secret scan clean (55 added lines), identity hooks passed, remote advanced b58e8a306 -> da6e6fb3a. Fresh fetch independently confirmed HEAD and remote branch equal. Main b9c75cd7b is already an ancestor via 4e3b81439; initial comparison was 12 ahead / 0 behind. No later main commit touched `ops/x0x/hostinger/`. Returned active-chat inventory showed no competing Hostinger owner. PR is attached to the new Agent 23 chat. No branch replacement, force push, shared-checkout edit or review request.

Read root AGENTS.md, the October 10 handoff and both original October 3 deployment/cohort dispatches. No nested AGENTS.md applies to the dispatch directory. Existing configured hooks already delegate to the secret scanner and identity checker; they were preserved. No installer was used to overwrite the shared hook.

## B3 — verified and installed, with rollback retained

Official release: https://github.com/saorsa-labs/x0x/releases/tag/v0.46.0 . Downloaded `x0x-windows-x64.zip`, its `.asc`, `.sha256`, and public signing key into `C:/Users/travi/x0x-win/releases/v0.46.0-agent23`.

- Archive SHA256 d27a00a630945c973e2a2d4541acc9242a7df514f0c51c8a11c58ce44a0879bf PUBLIC-CONSTANT
- Compared against both the release API asset digest and released checksum file.
- GPG detached verification exited 0 and emitted GOODSIG / VALIDSIG for pinned fingerprint `CEB3 506E 7DCB 8A2D D2D6 79E8 EDDA 4827 D89C 0F29`. Verification used an isolated public-key keyring. GPG also reported unknown owner trust: this proves the signature under the pinned key, not independently certified key ownership.
- Signed archive provenance names source cea64f20eddc3d8c71cfe4fba7464d3f137eb5c4. Both extracted executable hashes matched that provenance before installation and again at their installed paths.
- CLI SHA256 bce808b0a14374e2cc4e5e8acb3d564687132617c77910f489ed102500ba7942 PUBLIC-CONSTANT
- Daemon executable SHA256 57cac76d24e38008f97cd99d2cda39c5b66aed18fb11e4a545745f8e36423e00 PUBLIC-CONSTANT
- Replaced only `C:/Users/travi/x0x-win/x0x.exe` and `x0xd.exe`. Both now return 0.46.0 for `--version`. Original 0.41.3 executables are retained and hash-verified in `releases/v0.46.0-agent23/previous-v0.41.3/`.
- The Oracle tunnel helper, laptop TOML and connect ACL have identical before/after hashes. Identity/data stores were not touched. No installer, daemon start, autostart, GUI/session mint, forward, Home enrollment or sync command ran.
- At 2026-10-11T00:22:26Z: zero x0x/x0xd processes; zero TCP listeners on 12700 or 18080. CLI help and version execution were the only binary smoke checks. No local mesh traffic test was run.

B3 is complete for artifact/version alignment. Authenticated Dell-to-Hostinger protocol interoperability remains UNVERIFIED because B2 is unresolved. The ten-minute on-demand building Wi-Fi law remains in effect; binary installation does not authorize starting the daemon.

## Fresh backend receipt

Read-only native Windows SSH, same existing key, BatchMode and strict host-key verification, no forwarding. At 2026-10-11T00:22:24Z: x0x active/running, Restart=always, NRestarts=1, active since October 3 12:16:11 UTC. CLI and daemon both 0.46.0. Authenticated health: ok=true, healthy, peers=19, send_ready_peers=19, uptime_secs=648372. Buzz relay health: healthy. The API credential was read only into the remote environment, never printed or transferred to the Dell.

Backend health: PASS at that observation. This remote diagnostic shell does not enroll the Dell or prove a room message reached a second client.

## Incident and mobile-access investigation

B1 remains BLOCKED. GitHub repository secret-scanning API returned empty open and resolved alert inventories, using metadata-only output (number/state/type/timestamps/resolution; no secret value field). These account-visible inventories neither identify the reported exposure nor prove it was revoked. No provider event ID or old-credential rejection/new-credential acceptance receipt is available. No unrelated credential was rotated. Owner: founder/service-account owner identifies the service and exposure from the original alert/provider audit evidence; Agent 23 verifies the redacted containment receipt.

B4 source inspection is bounded to the deployed release. In upstream `v0.46.0`, `src/server/auth.rs` blob 66949d69c77b95a44ff8bd12149bb6e7bed02a99:

- `create_session` (lines 237-264) requires the durable token and issues an ordinary browser session. The inspected session record contains token hash, expiry and mint time, with no per-device identity or room scope (`AuthSession`, lines 509-515).
- Session TTL is ten minutes, but refresh chains can extend for about twelve hours (`SESSION_TOKEN_TTL`, `SESSION_MAX_LIFETIME`, lines 497-503). Session TTL does not enforce the separate ten-minute transport rule.
- `requires_durable_owner` (lines 349-376) reserves ACL/grant control, sync enrollment, Home seat changes and other owner acts for the durable token. Merely minting browser tokens is not evidence of separate enrolled device identities.
- Local `auth --help` and `auth session --help` confirmed the supported command. An exploratory `auth mint --help` failed with `error: unrecognized subcommand 'mint'`; no session was issued. This failure was corrected by inspecting the actual command help.

Source-path verification first queried `src/api/auth.rs` and returned HTTP 404. The corrected `src/server/auth.rs` path resolves to the exact inspected blob above; the content-based findings are unchanged.

No mobile access service was deployed and no alternative transport was created. B4 still requires an authorized route plus implementation that authenticates each client, limits its room/actions, preserves attributable sessions, and records real reads. B1 and B2 must be resolved before issuing device credentials or deploying that route. Agent 23 owns implementation; the founder owns phone authentication and physical reconnect actions. This source inspection is not a claim that the gateway exists or has passed security/runtime acceptance.

## Upstream priority

Read current dirvine communications in #622, #505 and #504. September 30 #622 ruling carried its remaining slices and per-pair measurement to #504. #505 remains field-accepted. The October 5 #504 reply keeps the efficiency work open: default ObserveOnly, per-kind counters (#1170), and same-workload delivered/published capture remain relevant; default changes need the cited upstream design decisions. No new upstream reply or field result was submitted. This lane provides neither a measured byte budget nor delivered/published acceptance.

## Per-device acceptance and precise remaining actions

| Device | Role | Result | Actual send/read/reverse/reconnect receipt | Assigned blocker |
| --- | --- | --- | --- | --- |
| Dell | Authenticated browser/CLI control client, no residential daemon | BLOCKED | None; signed 0.46.0 binaries only | B1 founder/service-account owner; B2 access-policy owner/founder, then Agent 23 verifies approved access. B3 resolved. |
| Samsung A16 | Individually authenticated mobile client | BLOCKED | None | B1/B2 prerequisites; B4 Agent 23 service implementation, founder phone sign-in and physical disconnect/reconnect. |
| Pixel 10a | Individually authenticated mobile client | BLOCKED | None | B1/B2 prerequisites; B4 Agent 23 service implementation, founder phone sign-in and physical disconnect/reconnect. |
| Google Streamer | Viewing/casting receiver, not message enrollment | BLOCKED | No playback or reconnect proof | B5 browser-policy/control owner resolves guardrail; founder selects/confirms receiver and physical TV playback, Agent 23 records supported source receipt. |

For each message client, use a distinct non-secret canary. Record sender acceptance ID/content/time, a different enrolled client's actual read of that same ID/content, a reverse reply ID/content/read, and retrieval of both IDs after disconnect/reconnect. Same-server calls and sender counters are insufficient. On each phone the founder must personally complete authentication and disconnect/reconnect after the authorized service exists; Agent 23 correlates device/session attribution and receipts.

For casting, once B5 is resolved, use a separate authorized hosted Buzz viewing tab, never chats or credentials. Record source URL, receiver name, start time and founder-confirmed TV content; stop/reconnect and obtain physical playback confirmation again. No receiver discovery or casting was attempted in this continuation. Same-Wi-Fi availability was not remeasured.

B2 remains the prior automatic approval rejection of native SSH forwarding: `blocked by policy`. Read-only SSH success does not reverse it. B5 remains the prior Computer Use stop: `could not determine the current browser URL on Windows with enough confidence to enforce policy`. Neither action was retried through another tool or transport; no security/permission settings changed.

## Validation and merge boundary

Before this dispatch, PR head da6e6fb3a had 44 check runs: 43 queued and one in progress, with no completed result. These are pending gates, not green checks. No merge attempted. Dispatch-only repository change receives diff validation and the installed staged secret/identity hooks before push; broad product tests would not establish device acceptance and were not rerun locally. New-head CI must be inspected separately after this push. Actual cohort completion remains UNVERIFIED pending the assigned blockers and device-level receipts above.
