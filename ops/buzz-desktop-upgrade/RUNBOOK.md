# Buzz desktop upgrade runbook — 0.5.21 fork build → PR #5 rebased build

Owner: zCode seat. Created 2026-09-18 after the Fable/bFUzZ independent review
(their files: `.buzz/RESEARCH/BUG_MOBILE_PAIRING_404_AND_CAFFEINE_HUDDLE_2026-09-18.md`,
`RELAY_UPGRADE_DELTA_VERIFICATION_2026-09-18.md`). Every number below was
re-verified at source by zCode on 2026-09-18 (receipts in the git history of
this file's lane dispatch).

## Current state (do not disturb)

- Installed desktop: **0.5.21 = zCode fork build** (`codex/nip42-ws-query-fix`,
  9 commits, canonical-origin + NIP-42 fixes; hand-replaced `buzz-acp.exe`
  carrying the observer fix). NOT an upstream release.
- Daily launch: `C:\Users\travi\buzz-desktop-mesh.cmd` (runtime `lib\` first on
  PATH — the OS-error-126 compute workaround, block/buzz#7731). **Never install
  stock 0.5.23**: no compute fix AND it overwrites the fork's patched binaries.
- Relay prod (box): image commit **6e5c462a** (Aug 8 release, `ghcr.io/block/buzz:0.2.1`).

## Target

Draft PR **skaists/buzz#5** (branch `zcode/rebase-assess`): the 9 fork commits +
manifest rider rebased onto upstream main. Brings **mesh-llm v0.76.0-rc9** — the
Windows mixed-separator runtime-load fix — plus everything upstream through
`779af888`. Verified so far: `cargo check` green, JS canonical-signing harnesses
8/8, tsc errors all upstream/stale-node_modules. NOT built; NOT qualified.

## Pre-conditions before ANY install (founder decisions, in order)

1. **A real Windows build of PR #5 must exist.** This seat cannot produce one:
   only windows-gnu toolchains installed, sherpa-onnx prebuilt libs are
   MSVC-static (link fails). Either stand up an MSVC-capable builder or realign
   fork `main` with upstream so the fork's CI contract gate passes again
   (force-push of fork main = founder's own bounded call, it has diverged;
   bFUzZ's PRs hit the same gate).
2. **Bug B inputs** (caffeine pubkey + exact error) are unrelated to this
   upgrade but outstanding from the same packet.

## Upgrade steps (when a qualified build exists)

1. **Codex adapter floor FIRST-beat check.** Upstream desktop requires
   `codex-acp >= 1.10.0` (`MIN_CODEX_ACP_VERSION` at
   `desktop/src-tauri/src/managed_agents/discovery.rs:792`; 1.10.0 bundles
   Codex 0.153.3 — older adapters reject GPT-6 Astra). **Installed adapter is
   1.7.0, below the floor**: after the desktop upgrade, bSpark and bLuNa
   (Codex-harness agents) will stop until the adapter is reinstalled. The
   desktop offers the reinstall on the next discovery pass — accept it — or
   `npm i -g @agentclientprotocol/codex-acp@^1.10.0` and confirm
   `codex-acp --version` ≥ 1.10.0 before upgrading.
2. Install the PR #5 build over 0.5.21. Keep a copy of the current
   `%LOCALAPPDATA%\Buzz` + the 0.5.21 installer for rollback.
3. **Compute acceptance:** launch WITHOUT `buzz-desktop-mesh.cmd` →
   Settings → Compute → red "OS error 126" banner must be gone; a model load
   (not just banner) is the real beat. If green, retire the launcher.
4. **Canonical-origin regression beat:** agent replies + observer (bKiMi lane
   reads) still relay-proven on skaists.buzz; the fork's own JS harnesses
   (`relayClientSession`, `readOnlyRelayClient`) already pass 8/8 on this tree.
5. **Relay migrations — DESKTOP UPGRADE DOES NOT TOUCH THEM, but the map:**
   box image `6e5c462a` ends at migration **0028** (28 files); upstream ends at
   **0046** (46 files) → **0029–0046 (18) are NOT on the box** and only apply
   when the relay image is next upgraded (`BUZZ_AUTO_MIGRATE` governs; default
   false in prod compose). Push-gateway has its OWN crate migrations: image has
   1, upstream has 5 → **4 more, only relevant if push is ever switched on**.
6. **Audio baseline:** the audio/agent-voice rewrite is ≈1,120 changed lines
   from the deployed tag to current main (bFUzZ's count, adopted over Fable's
   single-change count). Read
   `RELAY_UPGRADE_DELTA_VERIFICATION_2026-09-18.md` alongside this runbook
   before exercising voice.

## Rollback

Reinstall the 0.5.21 fork build + restore `buzz-desktop-mesh.cmd` as the launch
path. The relay-side pair-relay sidecar + Caddy `/pair*` route are independent
of the desktop version and stay.
