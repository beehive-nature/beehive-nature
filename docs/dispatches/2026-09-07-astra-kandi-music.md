# Kandi bar — user-chosen YouTube music

The founder supplied video `pb6OqIyyLAk` for optional music while making kandi.
YouTube's oEmbed metadata identifies the upload as **UK Garage - CJ Bolland -
"Sugar is sweeter" (Sugar Daddy)**, from UK Garage Gold - Classic Vinyl
Collection. The page names the track and links to the supplied upload. It does
not copy, download or redistribute the recording.

## Change

A compact music section sits above the composer in every view. It begins
without an iframe, remote thumbnail or YouTube script. Play music creates one
privacy-enhanced YouTube iframe with visible native controls. Autoplay is
requested only after that click; the browser or YouTube may still require
another play action. The original sharing `si` parameter is omitted.

Stop and close removes the iframe, restores focus to Play music and leaves the
bracelet draft intact. View changes keep the same player. The pagehide handler
removes it so navigation restoration cannot restart a prior music choice.
No music preference is saved, and no gift text or identity enters the fixed
video URL. Referrer policy is `strict-origin-when-cross-origin`.

The connection notice names YouTube before loading. An external Listen on
YouTube link works without JavaScript and remains available when the embed
cannot play. The page's old no-video and exclusive-outside-request claims were
updated. The shared chain badge tooltip now describes its own refresh request
without claiming it is the only possible outside connection on every page.

Seven keys have 203 English/machine-draft values across the existing 29
languages. The existing local language agent supplied these using inherited
model/effort; no new cloud task was created. No human translation attestation
is claimed; gd/tt/sa terminology needs native review.

Sources: [YouTube player parameters](https://developers.google.com/youtube/player_parameters)
and [YouTube embedding guidance](https://support.google.com/youtube/answer/171780?hl=en)
for player dimensions, native controls, privacy-enhanced host and referrer
behavior. Source upload: [YouTube](https://www.youtube.com/watch?v=pb6OqIyyLAk).

## Verification

- Existing kandi view/state/handler suites: 46 passed. The subsequent shared
  register/language/view run: 30 passed (six kandi view checks overlap).
- Estate source/corpus integrity: 11 passed; registry check passed. No page
  was added or moved, so no registry row or atlas regeneration was required.
- Browser arrival inspection: zero iframes and no absolute third-party sources
  among script/image/iframe/link resource elements. This is DOM/source evidence,
  not a newly instrumented network capture.
- Clicking Play music created one iframe for the supplied video. Raver and
  Cypherpunk changes kept it present. Stop and close removed it and returned
  focus. A typed `LOVE` composer draft survived the complete sequence.
- Russian title, play label and notice rendered from the corpus. Latvian title
  and notice also rendered. All language cells and English parity passed the
  corpus check. The preview was restored to English and New bee, music closed.
- A requested 390px browser override did not change the observed 1265px layout,
  even after reload. It was reset; this is not claimed as a phone-width check.
  The player CSS is fluid, with a 200px minimum height and wrapping controls.

## Playback limitation — keep the change draft

The in-app browser returned **This video is unavailable** inside the iframe,
with both `youtube-nocookie.com` and the standard `youtube.com` embed host.
The privacy-enhanced host was restored as the implementation. The direct watch
page resolved the expected title and uploader and exposed a player, but this
seat did not verify full track playback. No account login or source replacement
was attempted. The cause is not established; it must not be described as a
confirmed uploader restriction or as confirmed successful playback.

This branch is a reviewable optional-player implementation with an external
fallback. Leave it draft pending playback evidence inside the kandi embed.
No production deployment or campaign launch occurred. The gift engine and
stored kandi format remain unchanged.

## Founder-supplied watch-page diagnostic — September 7 follow-up

The founder supplied YouTube Copy debug info for the same video. This is
user-supplied diagnostic evidence, not a new independently observed browser
test. Only the following playback facts are retained here; the raw diagnostic
and its playback/session identifiers are not copied into the repository.

- Video ID: `pb6OqIyyLAk`.
- Context: `el=detailpage`, YouTube origin and a YouTube search referrer;
  these identify YouTube's own watch-page context, not the kandi iframe.
- Current media time (`cmt`/`vct`): **50.564 seconds**; duration (`len`/`vd`):
  **480.081 seconds**, approximately eight minutes.
- The reported played range (`vpl`) is `0.000-50.564`, with playback quality
  `hd720`; the diagnostic reports four dropped frames out of 1,521 total.
- The video error fields are `vec=null` and an empty `vemsg`. These fields
  do not establish the cause of the earlier embed failure. Internal player
  state and request-throttling fields are not treated as documented API enums.

Taken together, these fields support partial watch-page playback in the
founder's browser. They do not establish full-track completion, audible sound
or successful playback inside the kandi surface. The earlier embed failure
therefore remains open; do not infer an uploader restriction from it.

[YouTube's debug-info guide](https://support.google.com/youtube/answer/7519898?co=GENIE.Platform%3DDesktop&hl=en)
describes this material as playback troubleshooting information. It is not an
audio export, a publication-permission statement or an ANT/AR retrieval receipt.
No storage state changed on this evidence.

The code/preflight head `c71757cd` completed all eight reported CI checks before
this documentation update. No code changed and no tests were rerun for this
receipt-only follow-up. PR #32 stays draft pending embed playback evidence.
