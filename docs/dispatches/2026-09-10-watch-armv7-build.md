# W@tch ARMv7 build — 2026-09-10

Founder authorized option 2: implement and validate a repeatable ARMv7 build,
with an independent test app and reviewable upgrade recommendation.

Status: **BUILD, INSTALL, FIRST LAUNCH, CLIENT BOOTSTRAP AND FIRST VIDEO PASS**.
The founder is watching Big Buck Bunny in the separate W@tch Test app on the
physical Streamer and reports smooth streaming with no screen jumping.
Remote-control acceptance is not passed: normal transport controls are not
appearing, the focus highlight is hard to follow, and Create device link required
an ADB tap to pass Continue. Audio sync and a timed sustained-playback check remain open.

## Source and isolation

- Upstream: `aautonomicc/Watch-It`, base `1691c491`.
- WSL source worktree: `/home/travi/wt-watch-armv7`, branch
  `codex/android-armv7-build-2026-09-10`.
- Source changes: `5511e44` (build/ABI/validator), `f792308` (aapt2 format fix),
  `865f5baf` (split-APK Gradle configuration correction).
- Separate test worktree: `/home/travi/wt-watch-tests`, so Flutter's build clean
  cannot invalidate a concurrently running test suite.
- BNR work remains in this seat's own `wt-codex-raid-sprint`; the shared checkout,
  VPS services and other seats' worktrees are not modified by this lane.
- No upstream issue, message or PR has been sent. zCode/Grokbot were offered on
  standby; neither appeared as an addressable task/tool in this session, and no
  work was dispatched to them.

## Toolchain and changes

Local WSL toolchain: Flutter 3.44.6 at revision `ee80f08b`, Dart 3.12.2,
Rust 1.98.1, cargo-ndk 4.1.2, JDK 17, Android platform/build-tools 36/36.0.0,
NDK 28.2.13676358, Android CMake 3.22.1, command-line tools 23.0. Gradle also
installed platform 35 for a plugin. The SDK archive
checksums were checked against Google's repository metadata. The Flutter release
index URL returned 404, so the exact published Git tag supplied the SDK instead.
No version substitution was made.

The Android-only command selects the same ABI in cargo-ndk, Flutter and Gradle;
default remains ARM64. It excludes unselected plugin ABIs, enforces lockfiles,
checks the NDK selection and serializes builds within a checkout. The optional
test app uses `.validation`, a `W@tch Test` label and a local debug certificate.
The artifact validator checks required native libraries, each native ELF's
architecture/type, package, minimum API, TV launcher and APK signature.

Compilation is capped at 300% CPU, 16 GiB RAM and four hours. The separate Flutter
checks are capped at 150% CPU and 8 GiB RAM. No app/native client was launched on
the laptop. The checked test APK was subsequently installed and launched on the
founder's TV device as recorded below.

## Founder device evidence

Additional photos confirm Google TV Streamer (`kirkwood`, `mt8696`), Android 14 /
API 34, security patch 2026-04-01, build `UTTK.260317.003`, and 4 GB installed RAM.
The earlier CPU photo reports only `armeabi-v7a, armeabi` app ABIs. Thus API 34
meets this build's minimum API 24, while the ARMv7 package is still required.
The photos also show PowerVR Rogue GE9215, OpenGL ES 3.2, 1920 x 1080 at 60 Hz,
19.94 GB storage free, and 5 GHz Wi-Fi with a reported 360 Mbps link rate. These
are screenshot observations, not codec/throughput/playback tests. ADB subsequently
confirmed Google TV Streamer, kirkwood, API 34 and `armeabi-v7a,armeabi` directly.
Personal device and network identifiers are omitted from the shareable record.

The founder also selected Android's Design for TV guide. The local device record
now includes couch-distance legibility, D-pad focus feedback, and shared-screen
privacy as observation criteria, not asserted defects. Source:
[Android Design for TV](https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv).

## Completed baseline checks

- Both upstream alpha.95 APKs downloaded completely and passed native-library,
  ELF, package, API-24, TV-launcher and APK-signature checks.
- The TV test APK has 12 ARMv7 native libraries and 14 ARM64 native libraries.
- Both verify with the same certificate, SHA-256 prefix `79116699e48ba241`.
  This comparison does not independently attest the signer's legal identity.
- TV APK: 152,716,486 bytes; SHA-256 prefix `c0eeb6aa8ed087f5`.
- Normal ARM64 APK: SHA-256 prefix `a80bc931bd8f22d9`.
- The checked upstream TV APK and its full inspection receipt are copied to
  `C:\Users\travi\Downloads\Watch-validation-2026-09-10`.
- Nine offline validator/CLI tests pass. Flutter analyze reports no issues.
- Full Flutter suite: **962 passed, nine credential-dependent live tests skipped**.
  The test unit used 6m16s wall, 8m52s CPU and 2.1 GiB peak memory. A separate
  worktree prevented the build's clean operation from interfering with these tests.

## Delivered build and device results

- Clean source commit `865f5baf` produced two split validation APKs. Both pass
  native architecture/library checks, package/API/TV-launcher inspection and
  signature verification. Each contains 12 native libraries for its own ABI.
- ARMv7: 68,555,365 bytes; SHA-256 prefix `1fe13e2c116e8690`.
- ARM64: 85,939,077 bytes; SHA-256 prefix `a59274c7096c4378`.
- Both use package `io.github.aautonomicc.watchit.validation`, label `W@tch Test`,
  and the local debug certificate, SHA-256 prefix `916485f0072e945f`.
  The resolved launcher remains `io.github.aautonomicc.watchit.MainActivity`.
- Both actual APKs export `watchit_core_start` and `watchit_core_auth_token`,
  the two entry points used by Flutter's embedded-client loader. This is an ELF
  export check; it is not a proof of all application paths.
- The successful split build used 7m33s wall, 13m44s CPU and 10.2 GiB peak memory,
  without swap. Its native steps reused the cache in 2.51s / 0.66s.
- The original non-split ARM64 path was also built with ABI/test environment
  overrides absent. It passes the same inspection with the regular application
  ID; 3m07s wall, 7m35s CPU, 7.3 GiB peak, no swap. It is retained in WSL only.
- Windows SHA-256 checks confirm the two copied validation APKs match their
  build receipts. Receipt filenames inside JSON reflect Flutter's original
  output name; the hash identifies the exported artifact unambiguously.
- Wireless pairing succeeded after correcting a connection-port / pairing-port
  mix-up. The one-time code was passed through hidden terminal input, not stored
  in a file or this dispatch. Device/network identifiers are not published here.
- ADB found no existing W@tch package before installation. ARMv7 streamed install
  returned `Success`. Cold activity launch returned `Status: ok`, `TotalTime:
  3577`; the process remained alive and rendered the Terms of Use screen.
- The app's `watchit_core::engine` log reports `connected to Autonomi network
  (5 bootstrap peers up)`. This confirms initial bootstrap on this device;
  it is not a content-retrieval or playback receipt by itself.
- The native client bootstrapped while Terms of Use was displayed. The founder
  was left to review and choose on that screen; the agent did not accept terms,
  make a payment, upload content or operate a wallet during these checks.
- The founder then reported streaming Big Buck Bunny. Two ADB captures show
  different movie frames, with the same app PID. Video is observed working;
  an uninterrupted ten-minute run, audio sync and transport controls are not
  certified. A playback sample measured 412,599 KiB PSS / 499,567 KiB RSS
  (about 403 / 488 MiB), not peak usage.
- Five founder photographs document Terms, library, film details, Autonomi fetch
  progress and video. The details screen names 1080p H.264 / 263 MB; the loader
  reports 3.8 MB retrieved. Photos are retained in the local bundle only. This
  establishes the visible path, not exact first-frame latency or an audio pass.

## First usability finding and recommendations

The founder reports missing play/pause/forward/rewind/skip controls. They clarified
the earlier ambiguous screen-transition report: "no screen jumping.....streeming
perfect". No crash or screen-jumping defect is asserted. They also report that the
remote's focus highlight is hard to follow. Recommend a distinct focus outline,
modest scale change and predictable focus restoration across screens, validated
from their normal viewing position.

The founder then reported Create device link stuck at Continue. A direct ADB
screenshot shows the My W@tch "Name this device" dialog with a nonempty default
name and an apparently enabled Continue button. Source `_askDeviceName()` in
`app/lib/screens/my_watch_screen.dart` autofocusses the text field; Continue pops
the dialog with the trimmed name before `_createLink()` calls the API. The capture
does not establish keyboard focus or key delivery. After the founder again
reported being unable to click Continue, the agent delivered one coordinate tap
to the visible button. The app advanced to "Link created" with an invite QR.
Thus direct touch activation and link creation work; remote traversal/activation
remains the reported blocker. A second device joining and sync have not been
tested. The QR capture is kept outside the shareable bundle and is not committed.
Direct screen capture is available while ADB remains connected;
`streamer-link-device.png` (the pre-submit name dialog) stays in the local bundle.

Source inspection shows `PlayerScreen` delegates to adaptive controls, which
choose touch-oriented Material controls on Android. Their overlay starts hidden
and has no explicit D-pad shortcut handling. Existing TV focus tests cover library
cards. This is a likely explanation for the control visibility issue, requiring
a controlled key reproduction. Next contribution: remote-operable video controls
with focus, select/play-pause, bounded seeking and defined Back behavior, while
preserving touch behavior on phones. No player UI change was bundled into this
ARMv7 build patch.

Two additional source-backed review proposals cover networking before terms
acceptance and per-layer filtering of Android release logcat output while retaining
traffic accounting. Full findings and source links are in
`docs/receipts/watch-tv-review-2026-09-10.md`. None has been sent upstream.

## Artifacts and handoff

Local bundle: `C:\Users\travi\Downloads\Watch-validation-2026-09-10`.
Start with `START-HERE.md`, then `DEVICE-TEST.md` for the open physical checks.
The bundle contains both validation APKs, full receipts/checksums, the source
archive `Watch-It-865f5ba-source.tar.gz`, an aggregate source patch, native-export
checks, the first-launch screenshot and an unsent developer-facing note.

The reviewable contribution is also filed in this repository as
`docs/receipts/watch-armv7-2026-09-10.patch`; reverse application against the
source worktree passes `git apply --check`. Apply it to the recorded upstream
base for review. No upstream branch, issue or PR has been published.

SDK/Flutter/Gradle files occupied 8.6 GiB in the isolated tool directory, native
target caches 3.9 GiB, and the current app build directory 1.2 GiB at closeout.
These figures exclude shared Cargo caches, apt packages and other worktrees.

## Failures handled

- WSL stopped the first detached bootstrap when no attached Windows process
  remained. Subsequent jobs use `systemd-run --wait`, keeping the WSL invocation
  alive while preserving cgroup limits. The interrupted download was resumed.
- The new Android CLI downloaded the NDK slowly. Its transfer was stopped,
  resumed with curl under a 4 MiB/s cap, verified against Google's checksum, and
  returned to the SDK installer's cache. Setup then completed.
- First inspection of the real upstream APK exposed a verifier parsing bug:
  build-tools 36 emits `minSdkVersion`, not the older `sdkVersion`. Both formats
  are now accepted, with a regression test retaining exact API/package checks.
- A separate Gradle configuration preflight initially found no `gradlew`: Flutter
  generates the ignored wrapper on the first build. Supplying the missing wrapper
  files from this exact Flutter SDK, as its own injection routine does, allowed
  the preflight to pass. It used 11m58s wall, 6m54s CPU and 5 GiB peak memory;
  existing Gradle/Kotlin migration warnings remain. No SDK/plugin version changed.
- The first real build compiled ARMv7 in 16m04s and ARM64 in 15m28s, then failed
  APK configuration with `Conflicting configuration ... in ndk abiFilters cannot
  be present when splits abi filters are set`. Flutter's plugin source confirms
  that split and non-split modes require different configuration. `865f5baf` sets
  `ndk.abiFilters` only for non-split builds and keeps packaging exclusions plus
  APK inspection for both. The first attempt used 34m16s wall, 1h28m17s CPU and
  9.1 GiB peak memory without swap. The successful rerun reused those libraries.
- After the successful build, WSL stopped when its attached invocation ended;
  a subsequent UNC file access timed out. Reopening WSL confirmed successful
  artifacts and the clean source tree. No build was lost or repeated for that
  file-access timeout.
