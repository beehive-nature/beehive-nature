# W@tch TV interface and upstream contribution — 2026-09-10

Founder request: improve the Google TV Streamer UI, keep Settings reachable,
make remote focus visible, prevent left-edge clipping, add a subtle BNR/skaists
feel, and prepare an upstream PR. The founder also reports successful Samsung
A16 installation and immediate mobile sync after switching off their VPN.
That VPN observation is a user report, not a claim about every VPN or a change
to networking policy.

## Implementation

Source worktree: `/home/travi/wt-watch-armv7`, branch
`codex/android-tv-ux-2026-09-10`. Upstream main was fetched and remains at
`1691c491`; this contribution descends from the earlier ARMv7 build work.
Initial TV implementation commit: `bc28477`.
Hollow-outline/settings-focus correction: `46031df`. Founder-requested
interactive playback timeline: `435c887`.

- Android UI-mode detection selects TV behavior; screen width alone never
  turns a phone or tablet into a TV. A missing channel falls back to normal UI.
- Home has labelled Library, Search and Settings buttons. The page-wide
  shortcut Focus node no longer participates in TV directional traversal.
- A foreground outline follows focused controls and scrolling, including
  controls on top of artwork. It does not run a continuous animation ticker.
- Device-name dialogs focus Continue on TV, validate nonempty names, retain
  phone keyboard Done submission and own their text controller until disposal.
- A dedicated TV player overlay supplies play/pause, bounded ten-second seeks,
  timeline, conditional Next, dedicated media keys and defined Back behavior.
- The timeline accepts remote or pointer scrubbing. Left/Right previews a
  timestamp without seeking; Select commits once. Back cancels the preview
  while retaining controls; moving off the timeline also abandons it. Dragging
  commits on release. Focus on the timeline keeps controls visible. Unknown
  duration disables seeking. This is not thumbnail-preview generation.
- TV display is at the top of Settings. Device-local screen margins range
  from 0–10%, default 5%; text scaling has a TV minimum of 1.15 while preserving
  larger accessibility scaling. The entire Navigator, dialogs and picture area
  are inset, so this trades some picture size for overscan protection.
- Optional Grove dark palette adds quiet green surfaces while retaining
  W@tch's name, artwork, blue accent and public-channel amber. It is off by
  default upstream. No BNR logo or attribution is added to the viewing flow.

## Evidence and verification

The direct pre-change screenshot includes the full left edge, while founder
photos and the founder's viewing report describe cropping. Display overscan is
a likely contributor; the exact LG display setting has not been inspected.
The TV also displayed My W@tch switched off during that capture. We do not
substitute that TV state for the founder's separate mobile sync observation.

Static analysis is clean. Nineteen targeted tests pass, covering Android TV
classification, phone fallback, missing-channel behavior, name-dialog Select
and Cancel, phone submission, seek boundaries, transport hiding/reveal, media
keys, Back behavior, Next availability and reaching Settings with the metadata
banner absent. Tests caught two defects during implementation: a page-sized
focus node trapped Right-arrow navigation, and the transport row overflowed
when Next appeared. Both were corrected and the reproductions pass.

Founder feedback and an actual TV capture exposed a third defect: the
foreground BoxShadow filled the selected control and obscured its contents.
Commit `46031df` removes that fill while retaining a hollow foreground border.
It also gives the first Settings tile initial focus. Analysis and the original
19 focused tests passed again; the ARMv7 artifact was verified and installed
over the existing validation app successfully. Cold launch reported 1,727 ms.

The founder then requested a sliding timeline, after seeing the ten-second
buttons in playback. Commit `435c887` adds it with five behavioral tests.
All 24 focused tests and nine Python APK-verifier tests pass; shell syntax
checks and Flutter analysis pass. The Streamer subsequently showed another
app's video; the founder's answer about switching it back for the final check
is pending in chat. No remote keys were sent into that unrelated playback.

The original full suite at `bc28477` passed 974 tests with nine live tests
skipped. The final full suite at **`435c887` passed 979 tests; nine
credential-dependent live tests skipped**. It ran in a separate test worktree,
avoiding races with Flutter clean in the build worktree. Analysis is clean.
Final checks used 2m48s wall / 5m14s CPU / 1.6 GiB peak, without swap.

## Artifact, installation and PR

The ARMv7 release build at `435c887` succeeded in 5m07s wall / 12m54s CPU /
6.6 GiB peak, without swap. Existing Kotlin migration and SDK XML warnings
remain; no dependency upgrades were attempted. The build-generated Kotlin
session marker disappeared at completion; the receipt records clean source.

- Artifact: `Watch-It-435c887e-armeabi-v7a-validation.apk`, 68,604,625 bytes.
- SHA-256 prefix: `94a4261deb451420`. The complete checksum accompanies the APK.
- Package: `io.github.aautonomicc.watchit.validation`, minimum API 24.
- Required native libraries, ARMv7 ELF architecture, TV launcher and APK
  signature checks passed. Windows recomputation matched the receipt checksum.
- This uses the existing local validation certificate, not the maintainer's
  release identity. `adb install -r` returned `Success`, retaining test-app data.
- The final update was installed in the background. It was not launched over
  the founder's unrelated video. Hollow-outline visual acceptance, final remote
  scrubbing, couch-view cropping and timed playback/audio checks remain pending.
- The earlier TV build reached Settings with D-pad/Select without activating
  the metadata banner and showed Big Buck Bunny playing with the new transport.
  These observations are not substituted for final-build acceptance.

Local bundle: `C:\Users\travi\Downloads\Watch-TV-2026-09-10`. It includes the
APK, checksum, receipt, tracked source archive, upstream patch, interaction
guide, START-HERE instructions and a device report. Earlier development APKs
are clearly identified in START-HERE; the `bc28477c` APK has the filled-highlight
defect. Private pairing/invite captures are excluded from this contribution.

Upstream draft PR: **https://github.com/aautonomicc/Watch-It/pull/1**.
Title: "Add ARMv7 builds and Android TV navigation, display controls and scrubbing".
The source branch is pushed through `435c887`; the PR was verified open and
draft with that head. No GitHub check results were reported at inspection;
local tests above are the available evidence. The PR explicitly marks final
hardware acceptance pending. No merge or official release was performed.

## Source references

- [Google TV design overview](https://developer.android.com/design/ui/tv)
- [TV layouts and overscan safety](https://developer.android.com/design/ui/tv/guides/styles/layouts)
- [Minimum TV remote controls](https://developer.android.com/training/tv/get-started/controllers)
- [Contribution branch](https://github.com/loviswaternakamoto/Watch-It/tree/codex/android-tv-ux-2026-09-10)

All work is in the seat's own worktrees. No wallet, sync protocol, network
policy, VPS service or shared-checkout content was changed. Pairing codes,
invite QR images, device identifiers and raw peer logs are excluded from the
upstream contribution and this report.
