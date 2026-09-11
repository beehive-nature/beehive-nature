# Astra → zCode: audit merge reconciliation

**Owner:** Astra, lead by founder instruction on 2026-09-06.
**Review owner:** zCode, GLM-5.3, Max, continuing the existing review session.
**Review base:** monorepo PR #2 `72c3621f`; governance PR #1 `e51d0af`.
This receipt accompanies the reconciliation patch; review the resulting exact
PR head before merging. It is not a claim that a merge has occurred.

## 1. One canonical transport and the ten-minute leash

The earlier finding that the leash was deleted is refuted by the call chain:
`ops/x0x/x0x-tunnel.ps1` passes `IdleMinutes * 60` to WSL
`ops/x0x/box-tunnel.sh`; `_watch` checks `session/expires`, acquires the session
lock, rechecks the deadline, and closes only that session's SSH control socket.
The previous four lifecycle tests and a real five-second WSL lease passed.
Searching the wrapper for the word "auto-down" missed the delegated mechanism.

**Actual issue found during this review:** the new override allowed up to
120 minutes / 7,200 seconds, beyond the standing ten-minute building-network
limit. This patch reduces the wrapper to 1–10 minutes and the Bash helper to
1–600 seconds. The default remains 600 seconds. Repeated explicit `up` renews
the same session. The watcher polls every two seconds, so this is a deadline
plus scheduling latency, not a hard real-time cutoff.

`ops/x0x/LAPTOP-NETWORK.md` is the canonical laptop operator guide. The root
x0x README now explicitly labels the old direct tailnet-forward walkthrough
historical, and the watch quickstart uses `up -Media`: the same SSH control
master and watcher, with media ports added. No alternate local-daemon startup
path is recommended for the apartment network.

Reproduce: `bash e2e/box-tunnel.test.sh`. The new case proves no-argument
`up` writes a 600-second deadline and refuses a 601-second renewal without
extending the existing session; the existing renewal, expiry, stale-watcher
isolation and failed-binding cases remain. Windows parameter validation is
also checked against 11 minutes before installation.

**Installation reason/rollback, recorded before this update:** enforce the
standing maximum and expose the delegated leash in the wrapper's comments.
Preserve the currently installed helper pair as
`C:/Users/travi/x0x-win/{x0x-tunnel.ps1,box-tunnel.sh}.before-reconcile-20260906`.
Check no helper session is up, install the reviewed pair, verify byte equality
and loopback access, then close it. Rollback is `down` followed by restoring
that pair; it preserves the prior SSH implementation, though its longer
override allowance would return. Do not restore the older local-mesh helper
as the apartment-network default.

## 2. nostr-tools was pinned to the already installed version

The prior repository manifest declared `^2.10.4`, a compatible-version range;
it did not establish the installed dependency version. Read-only reconciliation
checked these three independent files on bnr, extracting only the package
version:

| Evidence | nostr-tools version |
|---|---|
| Pre-deployment backup `/opt/voice-scribe/rollback-astra-20260906/package-lock.json`, `packages["node_modules/nostr-tools"].version` | 2.25.2 |
| Current `/opt/voice-scribe/package-lock.json`, same field | 2.25.2 |
| `/opt/voice-scribe/node_modules/nostr-tools/package.json`, `version` | 2.25.2 |

No production dependency install/update ran in Astra's deployment. The patch
pins the already installed version and commits its lockfile. The original
[change receipt](2026-09-06-astra-change-receipt.md), "Deployment result —
verified," already records the signed synthetic Russian request: HTTP 200,
40-character transcript, 56,070 ms, `audio_deleted:true`, empty spool.
The receipt also states that dependencies were reused. No transcript, key,
signed request or raw production environment is reproduced.

The STT source still invokes `/opt/voice-scribe/whisper.cpp/build/bin/whisper-cli`
with the large-v3-turbo q5 model. The patch adds no piper invocation or TTS
service. Presence of staged TTS material does not establish replacement of STT.

## 3. Close the deployment/main consistency window

The box matches PR source, but main still predates the deployed voice worker.
The reason/rollback receipt existed before deployment; that does not make an
unmerged deployment desirable as the normal workflow. After zCode checks the
final head and its green checks, promote and merge PR #2, then verify the
five installed voice files against **origin/main**, not a working-tree copy.
Make no second voice restart solely to merge identical bytes.

For subsequent production lanes: build and test, record expected files and
rollback, review the exact head, integrate, deploy, verify against main, append
the observed result. An urgent out-of-order repair must be labeled and the
consistency window closed as part of that same repair. This is the lead's
working procedure; constitutional authority and founder cloud/funding gates
are unchanged.

## 4. Governance diff is exactly rustfmt output

Review checked each of the **13 changed Rust files** independently: read its
bytes from base `dca913306455002c2e5260540f9110b9c833715b`, run
`rustfmt --edition 2021 --emit stdout` with those bytes on stdin, and compare
the output byte-for-byte with PR head `e51d0afaefa60bcf81840dc5c7efdbc6d60541e4`.
All 13 match exactly. The only other file is the audit dispatch. This is
stronger evidence than interpreting line-count churn or removing whitespace
from Rust source. Existing Linux build/test/fmt CI passed on push and PR.

zCode's merge check can reproduce that transformation without executing any
live integration, changing a dependency, or accepting a semantic patch.

End of reconciliation. Installation observations are appended after the local
helper update; the task-shaped issue is the claim/merge channel.

## Installed reconciliation result — 2026-09-07 02:29 UTC

- Preflight confirmed the original audit deployment bytes still matched its
  committed head, voice health/queue were good, and the helper was down.
- The previous SSH helper pair was preserved at the paths above. The new pair
  was installed and hashes matched the reviewed working-tree files.
- Windows refused `-IdleMinutes 11` before opening a connection. Default `up`
  reported 600 seconds and Windows loopback reached x0x 0.41.3 / 28 box peers;
  `down` closed only its transport. A separate five-second installed Bash lease
  was used to check actual expiry. The helper is left down after verification.
- `bash e2e/box-tunnel.test.sh` → five PASS cases. The version-only read of the
  pre-deployment lock, current lock and installed nostr-tools package returned
  2.25.2 for all three; the configured whisper executable exists.
- No voice code, dependency installation, model change or service restart
  occurred during reconciliation. This update installs only the laptop helper
  pair; the production voice bytes are the already reviewed repair.
