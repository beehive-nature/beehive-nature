# W@tch creator credits — tested source and zCode handoff

Founder requested on 2026-09-10 that remaining work move to zCode to conserve
Codex weekly usage. This is a status receipt, not a completed deployment claim.

## Verified

- WSL worktree `/home/travi/wt-watch-armv7`, clean commit `197fc2b` on
  `codex/android-tv-ux-2026-09-10`.
- Credits & source page and editor; schema 14; per-file records; optional
  `credits.json` in `.watch-list` bundles; existing local corrections preserved.
- Flutter analysis clean; 1004 tests passed, nine credential-dependent tests
  skipped. Full test log is saved with the local artifact bundle.
- ARMv7 validation APK built, structure/signature checks passed, Windows
  SHA-256 matches. APK is 68,719,657 bytes; source archive and credits patch
  saved beside it in `C:\Users\travi\Downloads\Watch-TV-2026-09-10`.
- This new APK has NOT been installed. The Streamer was playing another app;
  no remote inputs or playback interruption were performed in this handoff.
- Upstream PR #1 is MERGED. Fetched main at `1034f2b` includes the maintainer's
  full-bleed video and admin-only TV display follow-ups. Those are not yet
  integrated into the credits build. A separate credits PR is not created yet.

## Handoff and actual blocker

Handoff: `C:\Users\travi\Downloads\Watch-TV-2026-09-10\ZCODE-HANDOFF.md`.
It contains source locations, evidence, exact build commands, remaining merge,
test, packaging, background install and new draft PR steps. No TV launch while
the founder is watching another app. No media publication or x0x work.

ZCode's local CLI at
`C:\Users\travi\AppData\Local\Programs\ZCode\resources\glm\zcode.cjs`
reports version 0.16.5. Its headless prompt fails with:
`Model config is missing. Create C:\Users\travi\.zcode\cli\config.json with an explicit model provider before running ZCode.`
Although help advertises `--settings` and `--max-turns`, the installed parser
rejects both as unknown options. No zCode model job was started. Credentials
were not printed, and no model configuration was changed.

## Media records

Two requested festival MP4 downloads passed complete A/V decoding. The files,
source descriptions and register remain local under
`C:\Users\travi\Downloads\Watch-Media-Intake`. Reuse licences were not established.
Additional festival videos remain references only.

The founder supplied LNKC's saved about-page HTML and MP3. The HTML embeds the
exact audio file under `speech_synthesis`; this is synthetic Latvian page
narration. Duration 215.748 seconds, MP3/16 kHz/mono, full decode passed.
`references/LNKC-AUDIO.md` records it for possible local alignment tests;
no timed transcript or speech-recognition evaluation was generated.

Credits do not yet use live device synchronization. Synchronized transcript
highlighting is a subsequent feature. A16 startup stalls remain unresolved.
