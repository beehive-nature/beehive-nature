# W@tch Audio & Captions pilot — 2026-09-10

Founder approved the TV language-track controls and a small Latvian caption
pilot after the media/Channels/BNR evaluation. Big Buck Bunny is the selected
player baseline; it is not a Latvian speech-recognition reference.

## Implementation and verification

W@tch source `6d8320d` on `codex/android-tv-ux-2026-09-10` is pushed to the
founder's fork and included in the existing upstream draft PR #1. This contains
the earlier TV work plus `ff71086` (Audio & Captions) and `6d8320d` (TV document
picker fallback). Work was done in owned W@tch worktrees, never the shared BNR
checkout.

The remote menu lists actual engine audio/caption tracks and supplied language
labels, supports automatic audio and captions off, preserves playback position
during selection, names errors and returns focus to Play/Pause. Local UTF-8
SRT/VTT attachments are bounded to 2 MiB. Captions sit above the transport while
paused; the existing episode countdown waits while the menu is open.

The physical Streamer resolves OPEN_DOCUMENT to Android's DocumentsStub. A
Paste captions alternative accepts timed text without requiring a file manager
and reads the clipboard only after explicit activation. Language metadata is
not a review attestation. Attachments last for the current playback and are not
uploaded or synchronized.

Flutter analysis is clean. The final full app suite passes 991 tests and skips
nine live credential-dependent tests. Twelve caption/menu/parser/layout tests
and the preceding 24 TV/home/focus/seek tests are included. Tests check remote
selection, named failure, caption placement, menu focus return, local input,
Latvian Unicode, invalid captions and explicit clipboard access.

Clean-source ARMv7 APK `Watch-It-6d8320d2-armeabi-v7a-validation.apk` is
68,637,621 bytes. ABI/ELF/native libraries, TV launcher, minimum API and APK
signature inspection pass. The Windows SHA-256 equals the generated receipt
(prefix `5f9cb741a15aa379`). Same local validation signer, separate app ID.
`adb install -r` returned Success; cold activity launch was 937 ms. That number
is Android activity startup, not time to streamed video.

Physical proof on the Streamer: the selected Big Buck Bunny variant is currently
480p H.264 / 82.1 MB, distinct from the initial founder photo of 1080p / 263 MB.
It resumed and displayed frames. The Audio & Captions menu opened with remote
Right/Right/Select and showed one real audio track with unspecified language.
Typed WebVTT test text rendered above the paused transport. The position stayed
at 5:36 through caption attachment and explicit captions-off selection. Remote
Down/Select set Captions off; the cue disappeared, Back returned focus to Play,
and Select resumed the movie. Local screenshots record these states.

No alternate-audio/dub switching, native Latvian glyph rendering, timed audio
sync or ASR acceptance is claimed from this physical test. The synthetic English
cue proves attachment and rendering. One early audio-selection attempt had an
unexpected menu exit/play transition while remote input could overlap; it is
not counted as a successful audio-switch test. Subsequent isolated input verified
remote caption-off selection. Focus currently returns to Automatic audio after
a completed selection; keeping focus on the chosen row is a possible refinement.

The APK, packaging receipt, source archive, patch, test log, pilot files and
screenshots are in `C:\Users\travi\Downloads\Watch-TV-2026-09-10`. The source
is pushed to the founder's fork and draft PR #1 is updated. The build/check jobs
finished; no unattended build loop was created.

## Mobile playback report

Founder reports that the official alpha.95 Samsung A16 app waits a long time
or appears stuck before Big Buck Bunny starts, on the same Wi-Fi with VPN off.
The TV validation app plays the film well according to the founder. This is
a reported startup regression/difference, not an independently reproduced
root cause or a repaired phone build.

Capture app build, cold/replay conditions, initial retrieval progress and first
frame time. The player's retrieved-byte display polls a client-wide counter;
it does not isolate this movie. Peer count alone does not establish availability
of the needed chunks. The native engine has caching and adaptive prefetch, so
warm/cold comparisons matter. No VPN, wallet or native transport policy changed.

## Latvian source and review boundary

Founder supplied a YouTube video reference, Latvian Television background and
The Red Jackets website. The two purported downloads used YouTube's own offline
Download button. No new video files appeared in the Dell's Downloads/Videos
folders. YouTube documents that those offline copies are encrypted for playback
inside YouTube; they are not ordinary files to import into W@tch.

The source-video file remains needed for an actual Latvian timed transcript.
No speech has been extracted, transcribed, translated or dubbed in this lane.
No WER, native-speaker acceptance or blind sense score is claimed. Existing BNR
text corpus entries can guide terminology; they are not automatically aligned
speech data or a reference transcript. Synthetic player captions are explicitly
labelled TEST and kept out of corpus acceptance claims.

## Media import and subsequent integration

Founder also requested the convenience of bringing YouTube videos into My
W@tch. Proposed flow: retain the source link/creator credit, import an available
creator-provided or owned video file, and distinguish local save from an explicit
Autonomi publish/cost step. This importer is not implemented here. No attempt
was made to decrypt YouTube's offline store or publish supplied media.

Persistent caption sidecars in media bundles/Channels, caption generation and
review, optional generated dubbing, public channel cards in Buzz and synchronized
watch-together remain subsequent work. Existing BNR HLS watch rooms are distinct
from a native W@tch integration. No private library or device-link data is posted.

## References

- [Upstream draft PR](https://github.com/aautonomicc/Watch-It/pull/1)
- [Media/BNR evaluation](2026-09-10-watch-media-bnr-evaluation.md)
- [TV build history](2026-09-10-watch-tv-ux.md)
- [media-kit track selection](https://github.com/media-kit/media-kit#select-video-audio-or-subtitle-track)
- [YouTube offline-download explanation](https://support.google.com/youtube/answer/7381437?hl=en)
- [Founder-supplied Latvian video reference](https://www.youtube.com/watch?v=G94Q8TbFnIA)
- [Latvian Television background](https://en.wikipedia.org/wiki/Latvian_Television)
- [The Red Jackets](https://theredjackets.lv/en/)

Prepared by Codex in its owned BNR worktree. No VPS service, inbound port,
new laptop mesh node, recurring job, billing action or identity assertion was
introduced by this work.
