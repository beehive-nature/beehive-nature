# bViEw — when to play is decided by time, not bytes (2026-09-26)

**Seat:** Claude (cloud session, committer `Claude <noreply@anthropic.com>`, author the founder per §7).
**Date:** 2026-09-26. **Branch:** `claude-lovis/magical-allen-dd0xqh`. **Surface:** `surfaces/bview.html`.
**Lane:** large / 8K Autonomi videos. Receipts asked for: a passing e2e and a before/after at 390 px.

## The defect, as found in the code

- `PLAY_MIN = 12 << 20` (old `bview.html:147`) was a fixed byte threshold: ~1-2 s of an 8K file.
- At 12 MiB the page painted ONE Blob and played it (old Phase B, `:337-348`). That Blob never
  grows, so playback ran off its end and froze until the whole file had arrived and
  `finishBinary` (`:349-380`) swapped in the full Blob. No MSE.
- The freeze was silent. The old clamp (`:244-253`) reads `v.buffered.end()`, but a partial MP4 Blob
  reports `buffered = [0, duration]`. Measured in this Chromium: a Blob holding half the bytes
  of an 8 s file reports buffered `[0, 8]`, then at 3.64 s fires `error` (MEDIA_ERR_DECODE) and
  pauses. The clamp never fires, and the error handler ignores errors while the bar is up.
- `held` / `SEGMENT` were reset at `:399` and `:499` and never read.

ants.tube stalls on 8K for the same reason: the door delivers slower than the video's bitrate.
The page cannot make the door faster. It can say how long the wait will be and stop freezing.

## What changed (`surfaces/bview.html`)

1. **Time-based start** (`waitFor` `:432`, `steer` `:512`). Once moov is in, `planOf` (`:392`) reads
   the duration (mvhd) and the media span (the first `mdat` after moov). Bitrate = mdat bytes /
   duration. Play from position `at` only when
   `(mdat end - bytes) / rate * SAFETY + MARGIN <= duration - at`, and `AHEAD` s past `at` is
   already local. Constants (`:162`): `SAFETY = 1.15`, `MARGIN = 2 s`, `AHEAD = 1 s`.
   The rate (`rateBps` `:273`) is the live MB/s meter's own window, capped at the average since the
   first byte, so one fast burst cannot start a playback the door then fails to feed. It is taken
   without the meter's 0.05 MB/s display floor. With the floor, a door that slowed below 50 KB/s
   kept its last fast rate, and during testing the countdown said "~1 s" for 8 s.
   While waiting, the viewer sees **"Ready to play in ~N s. The network sends this video slower
   than it plays, so a head start loads first."** (`#s-wait`, `bview.wait`, `{s}` filled live and
   re-rendered on `blang`).
2. **No freeze once playing** (`extend` `:495`, `snap` `:487`, `dry` `:282`). Without MSE the page
   still plays Blobs, but the Blob now grows:
   - Shortly before the playhead reaches the end of the running Blob, a bigger one is swapped in at
     the same playhead. The Blob end is estimated at ~10% early, and a swap waits for at least 2 s
     of new media, or, closer in, at least what is left of the current Blob. The 2 MiB refreshes of
     2026-09-21 thrashed; this does not.
   - If the Blob still runs dry (decode error, or Chrome racing `currentTime` to the end), the page
     pauses on the last real playhead and puts the countdown back up. It resumes by itself under
     the same time rule, asking for 3 s ahead so a drifting tail cannot flicker.
   - Blobs are folded (`new Blob([previous, ...newParts])`), so a swap never re-copies the file.
   - `finishBinary` now resumes at the playhead as it is after hashing, not before, since hashing a
     big file takes seconds. It resumes only if the video was playing or ran dry: a viewer's own
     pause stays a pause.
   - The old "playhead past 15 s means reset to 0" rule is kept only for files with no time plan.
     With a plan, a playhead beyond what the Blob can hold is treated as a yank and never saved.
3. **Device check** (`checkSmooth` `:442`). As soon as moov names the video track, the page calls
   `navigator.mediaCapabilities.decodingInfo({type:'file', video:{contentType, width, height,
   bitrate, framerate}})`:
   - Codec string (RFC 6381) from `avcC` / `hvcC` / `vpcC` / `av1C`; size from the sample entry;
     frame rate = stsz count / mdhd duration.
   - `smooth === false` shows **"This device may not play this video smoothly."** (`#s-rough`,
     `bview.rough`). The download and playback continue.
   - It stays silent when the device cannot answer. "Before a large fetch" is honoured as early as
     the door allows: the door has no Range support, so moov arrives inside the one fetch, and the
     question is asked in its first few hundred KB.
4. **Dead counter removed:** `held` / `SEGMENT` are gone from both readers. The test comment that
   claimed "more than one 8 MB Blob segment" was corrected.
5. **Strings:** `bview.wait` and `bview.rough` in the corpus, en + 28 tongues. They follow the
   `bview.slow` / `bview.fail` pattern (real renderings, not English copies). All are ⚙
   machine-drafted, `bview.wait` carries one `{s}` slot, and no direction marks are used. tt, sa
   and gd are the least certain. `_meta.drafted` says so.

Files with no time plan keep the first-frame preview and play when the whole file is in. That
covers moov-last uploads, fragmented MP4, a zero-size mdat, and WebM.

## Receipts

**e2e: `node --test e2e/bview.test.mjs`: 13/13 pass** (9 existing + 4 new, about 80 s). This was
run in the session container, with Playwright 1.62.1 pointed at the preinstalled headless shell
(the build this box ships).

| New test | Measured (this box) |
|---|---|
| slow door, 0.5x bitrate | the rule allows play at >= 759 KiB of 1160; page played at 768 KiB (one 16 KiB piece later); countdown 9 8 7 6 5 4 3 2 1 (said ~9 s, took 8.6 s); longest stop after start 0-153 ms; played to 9.8 of 10 s |
| fast door, 2x bitrate | played at 272 KiB of 1160; decodingInfo asked once, while downloading, with `vp09.00.xx.08`, 320x180, 24 fps, bitrate = mdat*8/dur |
| decodingInfo smooth=false (forced) | row shown before the download finished; it stays while playing; a new address clears it |
| door drops mid-play, 2x then 0.4x | ran dry at 2.30 s; the row came up 0 ms after the clock stopped: "~11 s"; resumed by itself after 11.0-11.4 s from the same place; played to the end, no failure row |

- **Red before:** the same 13 tests against the page as it was on `main` (`2fb2052b`). The 9
  existing tests pass. The 4 new ones fail on behaviour, not on missing elements:
  - slow: "it started while the download was still running": the old page played only at
    1160/1160 KiB;
  - fast: "plays with under half the file in (1187514 of 1187514 B)";
  - smooth=false: "the warning row is up: false !== true";
  - drop: "started early on the fast door (1187514 of 1187514 B)".
- **The existing tests' frame and clock asserts, actually exercised.** This Chromium has no
  H.264, so CI skips those asserts on the green-teal fixture. A local-only variant with that
  fixture transcoded to VP9 ran 13/13 with every codec assert active. The variant was not
  committed.
- **Under load:** 13/13 again with 4 busy-loop CPU hogs on the 4-core box, same numbers.
- **Static gates:** `node e2e/estate-source.mjs` 11/11 (1611 keys, 28 tongues x 2193 keys, corpus
  English matches the page). `node scripts/lint-ci-shape.mjs` 84/84 guarded.
- **390 px before/after:** `docs/dispatches/evidence/2026-09-26-bview-time-prebuffer/`.
  `before-after-390.png` is the four panels side by side; the raw `before-/after-{12,48}s.png` and
  both one-second `*-timeline.json` files are beside it. Setup: the same 30 MB / 30 s VP9 file and
  the same mocked door at half the bitrate (0.50 MB/s), sampled at the same wall-clock seconds.

| | before (main) | after (this lane) |
|---|---|---|
| 12 s | first frame, bar crawling, no word | "Ready to play in ~25 s", counting down from "~33 s" at 4 s |
| starts | 25 s (12 MiB reached) | 37 s, as the countdown said |
| freeze | 36 s to 61 s at 0:10, MEDIA_ERR_DECODE, no message | none |
| reaches 0:30 | 81 s | 68 s |

## Honest limits, not done here

- **Not run against the live door or a real 8K upload.** Every number above is from the mocked
  door. The rule, the countdown and the swaps are codec-blind, but the H.264 run-dry path
  (Chrome's yank to the end) is handled by construction and not observed: no H.264 in this
  Chromium.
- **Byte-to-time is an even-bitrate estimate** (mdat bytes spread evenly over the duration).
  Measured ~9% optimistic (estimate 3.99 s, real edge 3.64 s) on an 8 s VP9 + Opus test file. SAFETY, MARGIN, the early edge and the run-dry path
  absorb it. Reading `stco` / `stsz` for an exact map is the next refinement if real 8K VBR drifts.
- **A Blob swap is a visible hiccup** (0.2-0.4 s here), not gapless. Gapless needs MSE, and MSE
  needs fragmented MP4 (a remux, or `-movflags frag_keyframe+empty_moov` at upload). That is out of
  this lane.
- **Memory is unchanged in one respect:** the readers still keep every chunk in the JS heap
  (`parts`). A multi-GB 8K file will pressure a phone tab whatever this page does. Folding the
  Blob would allow dropping folded parts; not done here.
- **A bursty door** (4 MB chunk bursts) will make the live window swing. The min with the average
  keeps the start conservative, but N can jump. A longer window is the knob if the live door shows
  it.
- The worktree law names a Windows shared checkout. This session ran in an isolated cloud
  container with its own fresh clone, so no other seat's WIP was present, and every add was an
  explicit pathspec. `sh scripts/install-hooks.sh` was run here and the pre-commit hook fired on
  this commit.

## PR #229 (not touched)

https://github.com/beehive-nature/beehive-nature/pull/229 is red on §7: its one commit is
authored as Claude, not the founder. The cure is to rewrite that commit's author and force-push
`claude-lovis/jolly-bell-wetfvb`. That is a history rewrite on another branch, and it needs the
founder's word, so this seat did not do it and did not close the PR. The command is in the lane
order, and it is the founder's to run or to authorize.

## Reproduce

- `cd e2e && npm ci && node --test bview.test.mjs`
- The screenshots: `node e2e/bview-prebuffer-shot.mjs --page <bview.html> --fixture big30.mp4
  --out <dir> --label before|after --at 12,48 --until 84`. The 30 MB fixture is not committed. Its
  ffmpeg line is in the harness header.
- `fixtures/bview/vp9-opus-10s-faststart.mp4` (1.19 MB) was made with: ffmpeg 7.0.2 (static,
  libvpx-vp9 + libopus), `testsrc2=320x180:24` + noise, 800 kbps CBR, g=24, Opus 48 kbps, 10 s,
  `-movflags +faststart`, bitexact flags. The layout is `ftyp`, `moov` (6700 B), `free`, `mdat`,
  the usual faststart shape.
