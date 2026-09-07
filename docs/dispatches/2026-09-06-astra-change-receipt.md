# Astra change receipt — apartment-network access and voice worker

Prepared 2026-09-07 UTC (2026-09-06 America/Denver), before production edits.
Audit base: `526d90eb367b164dab765ae54c6023bfe07d484e`.
Authorization: founder requests a full stack audit and improvements, then
specifically requests a fix for laptop nodes taking down the shared network.
Worktree: `C:/Users/travi/wt-astra-audit`, branch `codex/astra-audit-2026-09-06`.

## P1 — laptop access starts mesh traffic

Reason: the old `ops/x0x/x0x-tunnel.ps1` `up` launches `x0xd.exe` before
forwarding. The laptop profile records an earlier approximately 6 Mbps
observation; smaller peer views provide no demonstrated byte-rate ceiling.
The founder reports all devices lose usable internet until the router restarts.
Exact router failure mechanism remains unverified; do not recreate the outage.

Change: replace the existing Windows entry point and install its companion
`box-tunnel.sh`. One SSH control connection forwards box APIs to laptop
loopback; media forwarding is explicit. A renewable lease and distinct control
socket per session bound lifetime. The helper starts no P2P daemon.

Before install: preserve the original laptop helper as
`C:/Users/travi/x0x-win/x0x-tunnel.ps1.before-astra-20260906`.
Rollback: run the new helper's `down`, then restore that backup to the
original filename. The original starts local mesh participation again; retain
it as recovery material, not the shared-network default.

Validation: Windows-to-box `/health` returns x0x 0.41.3/28 peers; listeners
18080 and 18082 are loopback; local Windows and WSL P2P process census empty.
Real 5-second lease closes automatically. Offline transport tests cover
renewal, expiry, stale-watcher isolation, and failed binding.

## P1 — voice workload isolation and capacity

Reason: baseline `ops/voice-scribe/voice-scribe.mjs` lines 129–174 count up
to four jobs but immediately execute every job. `mkdtemp` sits before its
`try/finally`, and ffprobe has no timeout. The live unit runs as the
passwordless-sudo-capable login user without filesystem isolation.
Source and unit hashes match the baseline on the box.

Change: one serial worker plus three waiting jobs; guaranteed slot release;
bounded and timed probe processes; cleanup after child exit; restricted media
formats/protocols and conversion duration; fixed URL base; HTTP connection
and request limits. Run the unit as a dynamic service identity with a private
runtime spool, no capabilities, no privilege elevation, read-only system and
protected home. Pin the existing runtime's nostr-tools 2.25.2 dependency.

Deployment files: `voice-scribe.mjs`, `work-queue.mjs`, `package.json`,
`package-lock.json` under `/opt/voice-scribe`, plus
`/etc/systemd/system/voice-scribe.service`. Existing model and dependency
directory are reused. No key or environment-secret files are changed.

Before install: create `/opt/voice-scribe/rollback-astra-20260906` with mode
0700, copy the existing source, package manifests and unit into it. Check the
live health queue is zero and the reviewed hashes still match. Validate the
unit with `systemd-analyze verify`, install the reviewed files, daemon-reload,
restart only `voice-scribe`, and verify the same public health route plus a
short synthetic-audio processing request. No message is posted to Buzz.

Rollback: copy `voice-scribe.mjs`, `package.json`, `package-lock.json` when
present, and `voice-scribe.service` from that directory back to their original
paths; `sudo systemctl daemon-reload; sudo systemctl restart voice-scribe`.
The previous script ignores the additional worker module. Confirm `/voice/healthz`
and active state. Preserve model, dependencies, and secret files throughout.

Validation before deployment: six Node tests pass, including an actual local
HTTP server exercised with hostile Host, invalid authorization, missing tools
and an unavailable spool. Dependency audit reports zero known vulnerabilities
for the pinned nine-package tree; this is not proof of absence.

## Production limits retained

The production invite timer stays `ROTATE_DRY_RUN=1` without an owner key.
The OCI fragmentation exception, host firewall and x0x identity stay under
their existing rulings. Disk pressure and failed bitcoind require a separate
recovery receipt: the live development relay uses a deleted binary from
`/home/ubuntu/src/target/debug`, so blind cache deletion is not a recovery plan.

Deployment results are appended below after verification.

## Deployment result — verified

- Laptop helper and companion installed at `C:/Users/travi/x0x-win/`.
  Source/installed hashes match. Installed entry point reached the box and
  its scoped `down` closed the connection. Left down after testing.
- Voice preflight found queue zero and exact baseline source/unit hashes.
  Unit verification passed. Backup directory created as specified, reviewed
  files installed, and only voice-scribe restarted.
- Live signed synthetic Russian speech returned HTTP 200, `ok:true`, a
  40-character transcript, `audio_deleted:true`, in 56,070 ms. No transcript
  or signed authorization was copied into this receipt; no Buzz message was
  posted. The runtime spool contained no remaining job directory afterward.
- Public `https://skaists.buzz/voice/healthz` returned HTTP 200.
  `systemctl show voice-scribe` confirmed active state, `User=voice-scribe`,
  `DynamicUser=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, protected
  home, private tmp and empty capabilities. Measured memory peak was
  1,381,826,560 bytes, below the 3,221,225,472-byte cap.
- Existing dependencies were reused; the newly pinned package version
  matches the installed nostr-tools 2.25.2. No dependency update was deployed.

The synthetic check proves the restricted service can process audio and
clean up. It does not establish a 120-second-note latency SLA under load.
