# W@tch INTAKE — try_autonomi.mp4 (Bux · Autonomi WebRTC Direct demo): forensics + browser playback receipt; device landing staged; ANT upload boundary held

ORDER: founder relay 2026-09-17 — the W@tch seat proposed the entry (title/creator/
description/status below) but could not reach a file-capable workspace; execution handed
to the zCode seat with the original file (`try_autonomi.mp4`, downloaded from ANT by the
founder). This receipt executes the proposal: original preserved byte-exact, media object
prepared to the app's real schema, actual playback verified, acceptance receipt written.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

- **CLAIM: the original MP4 is identified and plays in a browser with zero transcode.**
  EVIDENCE: SHA-256 + ffprobe below; chromium 390×844 played the ORIGINAL bytes over a
  Range-capable local server — clock 0.971s→8.144s over 8s wall, 493 frames decoded in the
  head, range-seek to t=50 then played to `ended=true` at 52.488s (673 frames total), zero
  video error events, zero console errors. Full `ffmpeg -v error -xerror` decode scan:
  exit 0 (all 3147 frames). NOT PROVEN: audio decode in-browser (muted autoplay; AAC track
  receipted by probe only), playback over the relay door (this was 127.0.0.1), TV playback
  (structurally impossible at this stage — see §4).
- **CLAIM: the W@tch media object is prepared and valid against the app's schema.**
  EVIDENCE: §3 JSON validated field-by-field against `IntakeDraft.validate()` +
  `MediaCredits.fromJson` caps (read at source, wt-watch-armv7 @f29429a). NOT PROVEN:
  a draft existing on any device — the Streamer was unreachable at execution time (§5).
- **CLAIM: source attribution is recorded as relayed.** EVIDENCE: §3 credits block.
  NOT PROVEN: the content itself — this seat cannot visually verify frames (Read-tool CDN
  trap; vision MCP cannot fetch localhost); three extracted frames await the founder's eyes
  (§7). Metadata is taken from the founder relay, not seat-verified content.

## 1. Original file — identity & forensics

- `try_autonomi.mp4` — 214,091,829 bytes (204 MiB), unchanged in Downloads; no copy,
  no derivative, no transcode produced (H.264+AAC MP4 is the native browser/TV baseline —
  "transcode only if needed" resolves to NOT NEEDED).
- SHA-256: `338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e` <!-- PUBLIC-CONSTANT: sha256 content pin, community video intake -->
- Container: MP4 (`isom`/`iso2`/`avc1`/`mp41`, probe_score 100).
- Video: H.264 Main profile @ L5.1, 3318×2132, yuv420p, BT.709, 60 fps nominal
  (avg 59.96), 3147 frames declared, ~32.5 Mbps.
- Audio: AAC-LC 48 kHz MONO 127 kb/s (2495 frames).
- Duration 52.488 s; overall ~32.6 Mbps; `Core Media` handlers on both streams →
  recorded with Apple's capture stack (consistent with a desktop browser-demo recording).
- Decode integrity: `ffmpeg -v error -xerror -map 0:v:0 -f null -` → **exit 0, zero
  error lines** — every declared frame decodes.

## 2. Browser playback of the ORIGINAL — VERDICT: PASS (7/7 checks)

Harness committed at `e2e/watch-try-autonomi-playback.mjs` (env `WATCH_FILE`; serves the
file at `/v.mp4` with correct 206/Content-Range handling; chromium 390×844 viewport;
muted autoplay; instrumented sampling; play-to-end tail probe). Receipt JSON from the
run (2026-09-17, shared checkout):

```
checks: dimensions 3318x2132 ✓ · duration 52.488 ✓ · advanced_8s_wall ✓ (0.971→8.144s)
        frames_decoded ✓ (493 head / 673 through tail) · played_to_end ✓ (ended=true @52.488)
        no_video_events ✓ · no_console_errors ✓        verdict: PASS   dropped: 3 frames
```

`waiting@50.00`/`suspend` entries in the event log are normal network-state transitions
during the range fetch, not errors. Shots (untracked, local evidence):
`e2e/shots-watch-try-autonomi/play-{2s,7s,ended}-390.png` + content frames
`frame-t{1,26,50}.png` (1280px wide, ffmpeg-extracted).

## 3. Prepared W@tch media object — intake draft (schema-15 shape)

Mapped to the proposal's metadata; `sourceUrl` deliberately EMPTY (W@tch libraries carry
NO web URLs — maintainer DESIGN DECISION closing PRs #4/#5; the source attribution rides
in text). `id`/timestamps mint device-side at creation (`IntakeDraft.newId()`); the JSON
below is the paste-ready card content:

```json
{
  "kind": "file",
  "label": "Autonomi — WebRTC Direct in-browser demo",
  "sourceUrl": null,
  "localPath": null,
  "sizeBytes": 214091829,
  "language": null,
  "listTitle": "Autonomi community",
  "credits": {
    "title": "Autonomi — WebRTC Direct in-browser demo",
    "creator": "Bux · Autonomi community update, 2026-09-17",
    "sourceUrl": "",
    "licenseName": "",
    "licenseUrl": "",
    "attribution": "Demo of Autonomi's upcoming WebRTC Direct browser access: network downloads in the browser without a wallet, install, or local setup. Shared ahead of the targeted live-node/browser release. STATUS: DEMO / PRE-RELEASE — not evidence that WebRTC Direct is live on production nodes yet. Source: Bux, Autonomi community update 2026-09-17, relayed by the founder (file downloaded from ANT).",
    "changes": "None. Original MP4 preserved byte-exact; SHA-256 at intake 338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e" <!-- PUBLIC-CONSTANT: sha256 content pin, community video intake -->
  }
}
```

Validation walkthrough against source (`lib/models/intake_draft.dart` /
`media_credits.dart` @f29429a): label 41≤512 ✓ · kind `file` ✓ · file-draft with
`localPath` null is the lawful mobile-pick shape ✓ · no URL fields set, so the web-URL
validator never fires ✓ · listTitle 18≤128 ✓ · every credits field within cap
(attribution 411≤4096, changes 127≤4096), no NULs, all strings ✓ → `validate()` PASSES.
`language` left null deliberately: the audio's language is unverified (claim discipline).

## 4. Structural truth read at source — drafts are never playable on TV

`MediaEntry.address` is the blake3 derived address of the uploaded shrunk root data map —
a PLAYABLE library entry requires the file to be on the network. The intake draft's own
doc comment: "Drafts have no Autonomi address: they are not library entries, never
playable on TV, and never leave this device. When a real upload succeeds, the credits are
re-keyed onto the resulting file address and the draft is consumed."

Consequence for this lane: the W@tch seat's "eventually ANT storage/retrieval" leg is not
decoration — it is the ONLY path from this draft to a playable W@tch entry. The browser
receipt in §2 is therefore this stage's complete playback evidence; the on-device stage
below claims draft visibility only, never playback.

## 5. Device landing — STAGED (Streamer unreachable at execution time)

`adb connect 10.34.7.122:40139` → `No route to host`, twice (11:31 and 11:39 local,
2026-09-17). Runbook for the next pass (validation build f29429a9, package
`io.github.aautonomicc.watchit.validation`; adb via
`source /home/travi/.local/share/watch-build/env.sh`):

1. **Idle check first (no-interruption law):** foreground app must not be W@tch with
   playback, audio state not `started`. If the founder is watching — wait.
2. `adb push /mnt/c/Users/travi/Downloads/try_autonomi.mp4 /sdcard/Download/` (~204 MiB).
3. Byte-exact transfer receipt: `adb shell sha256sum /sdcard/Download/try_autonomi.mp4`
   must equal `338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e` <!-- PUBLIC-CONSTANT: sha256 content pin, community video intake -->.
4. Add to W@tch → pick the file → paste the §3 card fields → save draft (DB-only, no
   network, no payment, nothing leaves the device).
5. Screencap the intake screen showing the draft — that plus §2 is the full claim set;
   do NOT claim playback on TV (§4).

## 6. ANT storage/retrieval — BOUNDARY NOT CROSSED

Uploading to Autonomi is a real ANT spend and belongs to the zBlood storage-economics
lane under the measured-states law (quote≠purchased≠uploaded≠retrieved≠hash-verified;
nothing synthetic may be labeled measured). Not quoted, not started here. When exercised,
the upload's resulting address re-keys the §3 credits per the app's own consumption flow.

## 7. Content review — BOUNDARY (frames staged for the founder)

Three frames extracted (t=1/26/50, `e2e/shots-watch-try-autonomi/frame-t*.png`). This
seat cannot visually verify them (this seat's Read tool ships local images to an external
CDN and shows nothing; the vision MCP cannot fetch a localhost URL — one attempt, parse
error, not escalated per the broken-probe law). The description/status fields in §3 are
the founder's relay of the W@tch seat's proposal, not seat-verified content.

## Provenance chain (state after this receipt)

original Bux MP4 (Downloads, byte-exact, §1 hash) → **[DONE]** browser playback verified
(§2) → **[STAGED]** W@tch intake draft on the Streamer (§5; schema-valid payload ready
in §3) → **[NOT STARTED]** ANT storage → derived address → playable W@tch entry with
credits re-keyed (§6).
