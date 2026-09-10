# W@tch: independent user validation and contribution — 2026-09-10

Founder direction: collaborate with W@tch as an independent user/validator and
make code upgrade recommendations. The role is to exercise upstream's app,
provide reproducible evidence, and propose focused improvements. Existing BNR
watch-room work is relevant context, not a requirement imposed on W@tch.

The [browser/mobile handoff](2026-09-10-watch-side-project-handoff.md) preserves
the earlier discussion. This brief updates it with a source review and the
founder's hardware information. No upstream issue, comment, message or PR was sent.

## Evidence baseline

Reviewed upstream main at **`1691c49196c76d4ed024da4db336ab835a7fb491`**, retrieved
September 10, 2026. This is a source snapshot, not an assertion that release
binary bytes match that commit. Current release metadata was fetched through
GitHub's REST API; code links below are pinned to that source snapshot.

The founder supplied a photo of the Streamer's CPU/ABI screen. It shows:

- Four ARM Cortex-A55 cores, maximum 2000 MHz.
- Instruction set reported as 64-bit ARMv8-A in 32-bit mode.
- Supported ABIs: `armeabi-v7a, armeabi`; no `arm64-v8a` listed.

This supports selecting an APK with a complete ARMv7 native dependency set.
The picture does not establish an Android version, firmware build or successful
W@tch installation. The LG logo identifies the display, not the streaming box.

Available hardware and proposed roles:

| Device | Evidence | Proposed validation role | Current result |
|---|---|---|---|
| Google Streamer | Founder identification plus ABI photo above | Native TV install, remote navigation, playback and casting receiver | ABI observed; app tests pending |
| Spare Moto G Android phone | Founder report; generation/OS unrecorded | Exploratory Android and casting sender tests | Pending |
| Main Samsung A16 | Founder report; variant/OS unrecorded | Second Android comparison after the spare-device baseline | Pending |
| Dell laptop, 64 GB RAM, 2 TB SSD | Founder report | Desktop library tests, source review and collecting logs | Source review only |

Retain official device firmware and Google Play. No root, firmware replacement,
debugging connection, device install or casting session was started in this lane.

## Corrections to the imported feature suggestions

Several proposed features already have implementation and tests upstream:

- The [details editor](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/screens/edit_details_screen.dart)
  implements album scope, an Album artist field, custom artwork and track/album
  edits. `renameTrackAlbum` changes library entry names while retaining content
  addresses. Its selected scope is the whole inferred album, even when invoked
  from a track editor.
- [Music-edit tests](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/test/music_edit_test.dart)
  cover loose-single merging, album renaming, track-number conflicts, compilation
  credits and artwork migration. Test source was reviewed; tests were not run here.
- [List transfer](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/screens/list_edit_screen.dart#L145)
  already copies or moves entries between lists and deduplicates by address.
  This is an existing basis for custom playlists; it does not establish arbitrary
  ordered-playlist behavior or a bulk move-to-album workflow.

Therefore the useful contribution is to test scope, persistence and usability on
real libraries, then describe the remaining gap. Do not submit "add album artist"
or "add artwork editing" as though those are absent.

## First three upgrade recommendations

### 1. Give distinct album groups independent manual-edit identities

**Source-backed candidate defect; not yet reproduced in a running app.**

The wall's [AlbumKeys.keyFor](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/services/season_grouping.dart#L218)
splits same-title/year albums by artist when track numbers collide. However,
[albumLookupKey](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/services/metadata.dart#L228)
uses only the title/year for untagged albums. The
[metadata overlay](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/lib/services/metadata_service.dart#L77)
then reads that shared key for both artists. The test at music_edit_test.dart:653
explicitly documents the shared key, but does not prove separation of manual edits
after the wall has separated the albums.

Proposed regression fixture: create these two distinct synthetic library entries,
without MusicBrainz tags, in the same list:

```text
Artist A - Greatest Hits (2000) - 01 Song A.mp3
Artist B - Greatest Hits (2000) - 01 Song B.mp3
```

Give them distinct synthetic addresses in the test fixture; no network content
or private datamaps are needed. Confirm two album groups, edit only A's album
artist/cover/description, reload, and assert B is unchanged. Source inspection
predicts a shared overlay; actual runtime result remains unmeasured.

If reproduced, use an album identity shared by grouping and metadata writes,
including a migration rule for existing overrides. Preserve legitimate
multi-artist compilations: simply adding the track artist to every album key
would reintroduce the problem the current design was solving.

### 2. Make the ARMv7 test build reproducible and verify packaged ABIs

The [alpha.95 release](https://github.com/aautonomicc/Watch-It/releases/tag/v0.1.0-alpha.95)
lists `Watch-It-0.1.0-alpha.95-armeabi-v7a-tvtest.apk`, 152,716,486 bytes,
created `2026-09-10T18:06:57Z`. Its notes describe a dual-ABI test build created
after the tag. The upstream [development record](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/CLAUDE.md#L66)
describes a one-off build with temporary ABI changes reverted afterward.

This agrees with the checked-in [Gradle configuration](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/android/app/build.gradle.kts),
which still selects arm64 and excludes ARMv7 libraries, and
[native/build-android.sh](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/native/build-android.sh),
which builds arm64 only. That is a reproducibility gap for the experimental asset,
not evidence that the asset is broken.

Recommend an explicit optional ARMv7 build target or per-ABI packaging, with an
artifact check for the full native library set and ELF machine type. Publish the
exact source revision/build recipe, file digest and signing-certificate identity.
Keep hardware-test status separate from artifact inspection.

A bounded HTTP request for the final 256 KiB of the APK did not return Partial
Content. Inspection stopped before reading the body rather than downloading the
entire 153 MB asset. **No APK directory, native libraries, digest or signature was
verified here.** The maintainer's signing and full-client claims remain attributed
to their development record.

### 3. Extend TV tests to a complete remote-only journey

The existing [TV focus tests](https://github.com/aautonomicc/Watch-It/blob/1691c49196c76d4ed024da4db336ab835a7fb491/app/test/tv_focus_test.dart)
cover a visible focus ring, Select and arrow traversal between two cards. They
establish starting focus with Tab. This does not verify a real remote's cold-start
path, navigation across pages or focus restoration after playback.

Recommend an integration test using remote-equivalent inputs only: cold launch,
profile choice where present, library, detail, Play, player controls, Back and
resume. Record unreachable controls, lost focus and text that cannot be read from
normal TV distance. This is a coverage recommendation, not a claimed observed
navigation failure. The release itself identifies TV support as an initial cut.

## Option 2: build scope and laptop readiness

The founder favored all three recommendations and asked what option 2's build
would involve. This is a build assessment, not an instruction to start installing
toolchains or a claim that a new APK has been built.

Live read-only checks on September 10 found an Intel i7-1185G7, four cores/eight
threads, 63.4 GiB total RAM with 43.3 GiB available, and 1471.6 GiB free disk.
WSL has Rust/rustup with only the `x86_64-unknown-linux-gnu` target installed.
Flutter, Dart, Java, adb and cargo-ndk were not on the checked command paths;
the common Android SDK/Flutter locations checked were absent. This is sufficient
hardware for a capped local cross-build, but the Android toolchain needs setup.

The intended contribution is a selectable ARMv7 build alongside the existing
ARM64 build. Keep the native Rust target, Flutter target and Gradle ABI filters/
library exclusions consistent, then inspect the actual APK's native libraries.
An Android-only entry point should avoid the existing release script's extra
Linux AppImage build. Preserve the normal ARM64 release path.

Provision a pinned Flutter version matching upstream CI (currently 3.44.6), a
compatible JDK, Android command-line SDK/NDK/build tools, cargo-ndk and the Android
Rust targets. Build in WSL's Linux filesystem with limited parallelism. The
deliverable should include the repeatable build command, source/toolchain
versions, APK digest, certificate report, native ABI checks, and a regression
check for the existing ARM64 target. Repeatable commands and pinned inputs do
not by themselves establish byte-for-byte reproducible output.

Planning allowance, **not measured on this machine**: reserve about 50 GB for
toolchains, dependencies and build caches, expect several GB of downloads, and
allow half a day to one working day for initial setup, the patch, a cold build
and artifact checks if the maintainer's ARMv7 result reproduces. Native dependency
or linker failures can extend this. Later build timing must be measured after
the caches exist. TV installation/playback is a separate acceptance step.

Use the maintainer's existing test APK for the first device baseline once it is
inspected. For our code changes, an independently signed test variant can use a
separate application ID to coexist with the official install; an official update
build needs the maintainer's signing process. Do not request or transfer their
private signing key, and do not uninstall an existing app to work around signing.
Android documents [per-ABI packaging](https://developer.android.com/ndk/guides/abis),
Flutter documents [Android builds and release signing](https://docs.flutter.dev/deployment/android),
and [apksigner](https://developer.android.com/tools/apksigner) supplies artifact
signature verification. Their current pages were read for this assessment.

Upstream main still resolved to the pinned `1691c491` source at recheck. GitHub's
release API still listed five actual assets, including the same 152,716,486-byte
TV candidate; the rendered release page's differing asset counter was not used
as evidence. No new APK download, build, installation or service change occurred.

## First independent test session

Record exact app asset/version, device model, OS/build and network conditions for
each run. Native TV playback and phone casting are separate results.

1. Inspect the candidate APK and verify its signer before the TV install test.
   Record install result and native-client startup separately from video playback.
2. On the Streamer, test the remote-only journey above with an authorized sample;
   measure time to first picture, TV sound, seek/resume and a sustained playback
   interval. A pass on launch alone is not a playback pass.
3. On the spare Moto G, establish local playback first, then mirror to the Streamer
   and record picture, sound, delay, orientation and recovery. Compare with the A16
   afterward. Keep mirroring distinct from native Cast support in W@tch.
4. Exercise album cleanup on a disposable library: two same-named albums, a
   compilation, a loose single and a long DJ mix. Verify exact edit scope, retained
   content addresses, unchanged audio, preserved manual edits after restart and
   lookup, and list-copy behavior. Measure upload activity rather than assuming it.

Use small authorized or synthetic fixtures. Public reports need minimal redacted
logs and reproduction steps, not private library bundles, datamaps, profile/PIN
exports, wallet material or personal viewing history.

Each finding should state: observed result versus expected result, exact build
and environment, minimal steps, repeat count, evidence, code pointer if known,
and a proposed acceptance test. Label source-only predictions and maintainer
claims separately from independent runtime results.

## Friendly introduction draft — not sent

> I'd like to help W@tch as an independent user and tester. I've got a Google
> Streamer that exposes 32-bit app ABIs, two Android phones and a Windows laptop.
> I'll start with TV playback and album cleanup, send reproducible findings, and
> suggest small improvements against the current code. I can also retest fixes.

## Verification and limits of this lane

Reviewed the pinned source, release API metadata, source tests and the founder's
ABI photo. GitHub issue/PR search for the repository returned no items at this
check; that does not establish absence of Discord discussions or private work.
An initial request for `docs/DEVLOG.md` returned 404; the actual development
record was then located at `CLAUDE.md`. Those upstream notes were used as evidence,
not instructions for this session.

Neither Dart nor Flutter was found on the Windows/WSL command paths checked, so
no upstream tests or builds were run and no new runtime result is claimed. The
APK range inspection also failed as recorded above. All findings are source
observations or proposed checks. No product code, VPS service or device state was
changed. This brief and the handoff are the only repository changes in this lane;
validation is a document diff/format review, followed by commit/push on this seat's
own branch.
