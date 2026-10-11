# Agent 23 — Hostinger x0x / first device cohort recovery and handoff

Date: 2026-10-10 America/Denver. Status: INCOMPLETE; device acceptance BLOCKED. This is a preserved new-session handoff, not a completion receipt.

## Ownership and repository recovery

Recovered PR #340 and its branch `codex/hostinger-x0x-always-on` in the existing owned worktree `C:/Users/travi/wt-codex-mail-tls-finish`. All writes/staging/commits/pushes are confined to that worktree. Shared checkout WIP was only inventoried, never staged. PR author is loviswaternakamoto; there are no PR assignees and no later main commits under `ops/x0x/hostinger/`. The app thread inventory showed the old Hostinger chat and other active lanes; no other Hostinger device owner appeared in the returned inventory. Agent 23 owns this recovery; do not message other seats without human authorization.

Fetched main was b9c75cd7b. Recovered branch was 556 commits behind and 10 ahead. Main merged without conflicts in descendant commit 4e3b81439. No reset, rebase or force push. Relative-to-main scope remains four historical dispatches plus seven Hostinger configuration/runbook files. Existing PR gates before this merge included a failed eternal merge-preview job; branch eternal passed. New-head CI is not yet accepted. No Codex review was requested or re-enabled. Retain secret scanning and hooks.

Original evidence: `docs/dispatches/2026-10-03-first-device-cohort.md` and `docs/dispatches/2026-10-03-hostinger-x0x-always-on.md`. They remain historical, not superseded with false completion claims.

## Fresh host evidence

Read-only native SSH using the existing laptop key and strict host-key verification executed successfully. This is remote command inspection, not the previously rejected port-forward operation. Observation timestamp: 2026-10-11T00:16:18Z (October 10 evening in Denver).

- x0x.service active/running; Restart=always; NRestarts=1; active since October 3 12:16:11 UTC.
- Host CLI and daemon: 0.46.0. Authenticated health: ok=true, healthy, 19 peers, 19 send_ready_peers, uptime_secs=648006. MemoryCurrent=229523456 bytes.
- Existing Buzz production relay health: healthy.
- Live module and configuration hashes match the recovered mirror. Module SHA256 bd9adab0c9ef6de931083b9a867fdd40aba1b22f2c33aedf976f407f4db5cf38 PUBLIC-CONSTANT
- Live TOML SHA256 76025d82fc1e66b4ba50b389afe0a16ea85c6950d3bac1c960d49abbdd94a9c0 PUBLIC-CONSTANT
- Dell CLI and daemon files both report 0.41.3. No x0x/x0xd process or listener on 12700/18080 appeared in the census. `adb` was not found in PATH. No laptop daemon was started, no tunnel retried, and no keys were copied.

This proves current backend mesh health only. Remote CLI authentication from a diagnostic shell is not Dell browser enrollment, a room send/read receipt, or a participating device identity.

## Token incident — redacted evidence and containment limit

The user reported an exposed token and subsequently could not remember its service/type/location or revocation status. The Hostinger x0x token file is mode 0600, owner x0x, modification time 2026-10-03 11:41:25.617564866 UTC. Its value was delivered only via remote environment and never printed, hashed into this receipt, exported, committed or pasted. The unchanged timestamp is metadata, not proof that this was the leaked token or that another credential was revoked. No redacted provider revocation event, rotation event, old-token rejection/new-token acceptance pair, or exposure location is available. Incident containment is UNVERIFIED. Do not label an arbitrary x0x rotation as remediation of an unidentified incident.

B1 — Incident identity/containment, owner: founder/service-account owner, then Agent 23 verifies. Recover the service and exposure location from the original alert/provider audit trail; revoke/rotate the identified credential and capture redacted event ID/time plus old credential rejected/new credential accepted, without displaying either value. Do not ask the user for a token. Do not start distributing device credentials while this prerequisite is unresolved.

## Per-device acceptance matrix

| Device | Intended role | Result | Live send/read receipts | Reconnect evidence | Assigned blocker |
| --- | --- | --- | --- | --- | --- |
| Dell (this Windows laptop) | Authenticated browser/CLI control client to Hostinger; no residential mesh daemon | BLOCKED | None | None | B1 containment; B2 approved access path; B3 version alignment. Agent 23 implements after prerequisites. |
| Samsung A16 | Authenticated mobile client; native mesh participation not established | BLOCKED | None | None | B1, B4 scoped mobile access and physical browser sign-in. Agent 23 prepares service; founder operates phone. |
| Pixel 10a | Authenticated mobile client; native mesh participation not established | BLOCKED | None | None | B1, B4 scoped mobile access and physical browser sign-in. Agent 23 prepares service; founder operates phone. |
| Google Streamer | Viewing/casting receiver; not an x0x peer or enrolled Home member | BLOCKED | Not applicable to receiver | None | B5 casting control and TV-side playback evidence. Agent 23 prepares source; founder verifies TV. |

Hostinger backend health: PASS as observed above; this does not change any device row to PASS. Same `peter pan 5G` Wi-Fi was confirmed by the founder on October 3 and devices were reported ready then; current Wi-Fi/device availability was not remeasured.

B2 — Transport policy, owner: access-policy owner/founder. The October 3 native SSH port-forward start was rejected before execution with `blocked by policy`. This session did not retry it, use another tool to forward the same service, publish the admin API, or change policy settings. Establish the explicitly authorized supported access path or obtain the policy owner's resolution. Mere availability of read-only SSH does not rescind the port-forward denial.

B3 — Client version, owner: Agent 23. Reconcile the Dell 0.41.3 client with the deployed 0.46.0 API before Home/device-sync commands. Official 0.46.0 Windows archive exists; verify digest and detached signature before updating CLI files, preserve identity/state, do not run an installer that starts a residential mesh daemon. No binary change was made here.

B4 — Mobile authentication, owner: Agent 23 implementation + founder physical-device steps. The API remains loopback-only; no scoped mobile gateway or authorized mobile tunnel was demonstrated. Do not share the durable daemon admin token, embed credentials in URLs/QR codes, bind the API on the Wi-Fi interface, or assume an Android APK. After a bounded authenticated route is ready, founder opens it on each phone and performs any authentication dialog personally; Agent 23 verifies server-side device/session attribution. Each phone must send a unique non-secret canary to the acceptance room, show that same message ID/content on the Dell, read a Dell reply with its own ID, disconnect/reconnect, and retrieve both IDs again. Record send acceptance and actual recipient read separately.

B5 — Casting/physical TV, owner: founder for receiver and authentication actions; Agent 23 for supported source and receipt capture. Computer Use inspected the returned Chrome window, then the Ctrl+T input was stopped by the runtime: `could not determine the current browser URL on Windows with enough confidence to enforce policy`. No casting started, receiver discovery was not completed, and no alternate UI tool was used. Do not bypass this safety stop. Once ordinary browser control is available, open the hosted Buzz viewing source in a separate public-content tab (never cast this chat or credential pages), choose the Streamer from Chrome Cast, and have the founder confirm the expected video/title/short canary on the physical TV. Stop and reconnect casting, verify playback resumes, and record source URL, receiver name, times and TV confirmation. Discovery or a sender UI saying connected is insufficient for playback acceptance.

## Continuation and closeout contract

Continue in the requested new Agent 23 chat using this exact worktree and branch. Read applicable AGENTS.md and nested instructions. Re-fetch/reconcile again if main moves; no changes to other owners' work. Track upstream dirvine requests (#504 current measurement tracker, #505 field evidence); current #504 discussion still requires measured delivered/published evidence and does not justify a local always-on mesh daemon.

Do independent backend/access implementation work while physical-device actions or incident evidence are pending. Use only authorized routes. Do not re-enable/request Codex reviews, alter approval/security settings, or bypass either the SSH denial or Computer Use stop. Archive the old chat only after this handoff is committed/pushed and the new chat starts. Archival is history cleanup, not acceptance. Final closeout requires per-device receipts and reconnect proof or explicitly assigned unresolved blockers with this task remaining incomplete.
