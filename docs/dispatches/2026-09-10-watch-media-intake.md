# W@tch media intake — zCode delivered the Add to W@tch feature

Founder approved the phone/laptop media-desk proposal 2026-09-10 and
ordered the bounded next feature (`ZCODE-INTAKE-ORDER.md` in the local
artifact folder). zCode implemented, tested and staged it same day.

## Delivered

- Branch `codex/media-intake-2026-09-10` at `f29429a9` in WSL worktree
  `/home/travi/wt-watch-armv7`, stacked on the credits branch (PR #4
  still in review; the PR body says so and names the intake-only
  commits). Pushed to `loviswaternakamoto/Watch-It`; separate DRAFT PR:
  https://github.com/aautonomicc/Watch-It/pull/5 — no maintainer
  messages sent.
- Add to W@tch: one intake flow on laptop/phone (not TV; kid profiles
  excluded — the credits-edit law). Entries: home toolbar button + My
  Media page action. Choose files or paste a source link; review a
  keyboard-friendly card per item (title, creator, original URL,
  language, collection, artwork via the poster crop dialog; advanced
  licence details collapsed; fields reuse the credits model with the
  card URL as the single provenance authority).
- Durable device-local drafts: new schema-15 `intake_drafts` table
  (model `IntakeDraft`, `IntakeStore`). Saving performs no network call,
  no payment, no publish — the DB is the only I/O. Pasted links are
  reference records; W@tch never downloads from links. Phone picks
  record name/size only (picker cache paths are not durable).
- Upload handoff: desktop file drafts open the existing batch upload
  screen with path+collection pre-filled (`initialPaths`/`initialList`
  seam — the user still reviews and starts there; price, wallet
  approval, resume and ledger dedup untouched). After a real upload,
  `carryCreditsIntoUploads` re-keys draft credits onto each resulting
  file address (tier encodes included; gap-fill semantics) and consumes
  the draft; partial/failed uploads leave it in place. The screen spells
  out when other devices see media (.watch-list transfer or channel
  publish; private vs public distinction stated).
- Checks: `flutter analyze` clean; full suite **1032 passed / 9
  credential-dependent skipped** (+22 new: `test/intake_test.dart` 19,
  `test/intake_preview_test.dart` 3 — the latter drives the real
  Latvian-festival register through the flow at laptop 1280x800 and
  phone 390x844 with overflow assertions). The preview caught a real
  bug during development (missing per-draft key let a removed card's
  form state be reused by the next card; fixed + covered).
- Android validation APK `Watch-It-f29429a9-armeabi-v7a-validation.apk`
  (69,113,037 bytes, SHA-256
  `c87b82ef4e7d1387566aac38dddae0f02c51f66ef88da73b4dd8faabf9e5f763` PUBLIC-CONSTANT):
  receipt verifies source revision `f29429a9`, clean tree, armeabi-v7a,
  v2 signature by the standing local validation certificate; Windows
  `Get-FileHash` matches. APK, receipt, checksum, source archive,
  credits+intake patch and full test log copied to
  `C:\Users\travi\Downloads\Watch-TV-2026-09-10`.
- **Installed to the Streamer** (`adb install -r`, `Success`,
  lastUpdateTime 2026-09-10 21:44) under the founder's standing
  interruption permission for this work. The app was NOT launched and no
  remote input was sent: no hardware UI check is claimed for this
  change. Rendered-form evidence is the widget-test rendering at laptop
  and phone sizes in the committed tests.

## Named limits (in docs/INTAKE.md and the PR)

- Desktop artifact blocker, precise: `scripts/build_appimage.sh` →
  `flutter build linux` fails at CMake because `media_kit_video`'s linux
  target links `PkgConfig::mpv` and the WSL Ubuntu image lacks
  `libmpv-dev`; `sudo` needs a password this autonomous session does not
  hold. clang/cmake/ninja/pkg-config/GTK3 are all present — one
  `sudo apt install libmpv-dev` unblocks the AppImage. (The repo also
  has no windows/ runner at all, so a native Windows laptop build is a
  separate feature surface either way.) An earlier concurrent-build
  attempt also corrupted `linux/flutter/ephemeral` — desktop and Android
  builds must not share one checkout simultaneously; serialized rerun
  produced the precise error above.
- Android Share/`SEND` intake and desktop drag-and-drop: pending by
  design (no sound existing receive route to reuse; picker covers
  files/folders).
- Live device sync still does not cover drafts or the credits table.
- No media was uploaded, no funds spent, nothing published; the festival
  MP4s were used as register metadata only in tests. No credentials were
  printed; nothing staged from the shared BNR checkout.

Result receipt: `C:\Users\travi\Downloads\Watch-TV-2026-09-10\ZCODE-INTAKE-RESULT.md`.
