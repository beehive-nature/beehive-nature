# W@tch side project: browser/mobile chat handoff — 2026-09-10

The founder is moving this side project into the current Codex task. This note
preserves the supplied conversation and connects it to existing repository work.
The pasted assistant's suggestions and questions are context, not new execution
orders. This handoff does not install an APK, start a stream, send a community
message, or implement a library feature.

**Founder clarification:** "i want to collaborate with W@tch and be an independent
user/validator and make code upgrade recommendations." The resulting source
review, supplied device evidence and proposed test cases are recorded in
[the independent validation brief](2026-09-10-watch-independent-validation.md).
That follow-up updates the imported unknowns below; these sections preserve what
was known from the pasted chat alone.

## TV playback: carried context and open evidence

The imported direction is to view W@tch on the founder's Google streaming device
while retaining official firmware and Google Play. Ordinary sideloading and
casting were the proposed approaches; rooting or firmware replacement was not.

The earlier chat reports that the device exposes a 32-bit Android ABI and that
the original APK was ARM64-only. It also reports a candidate asset on upstream
release `v0.1.0-alpha.95`:

`Watch-It-0.1.0-alpha.95-armeabi-v7a-tvtest.apk`

- [Upstream repository](https://github.com/aautonomicc/Watch-It)
- [Referenced release](https://github.com/aautonomicc/Watch-It/releases/tag/v0.1.0-alpha.95)
- [Candidate APK supplied in chat](https://github.com/aautonomicc/Watch-It/releases/download/v0.1.0-alpha.95/Watch-It-0.1.0-alpha.95-armeabi-v7a-tvtest.apk)

**Imported, not independently verified in this handoff:** release availability,
upload date, APK native libraries, signing certificate, minimum Android version,
device model/ABIs, installation and playback. The earlier assistant explicitly
said its binary download failed. An ABI-looking filename is not compatibility
evidence. The word "today" in that pasted message is not a verified upload date.

The next native-TV investigation should verify the candidate binary's library
ABIs, manifest and signer, then record the actual device ABI/OS and a hardware
test covering installation, launch, remote navigation, picture and sound.

Casting remains a fallback proposal. In phone mirroring, the sender runs the
Autonomi client and the TV receives mirrored output. Desktop screen mirroring
needs an explicit TV-audio check. No casting result was supplied. The sending
device (Android, iPhone or computer) remains unspecified; the earlier question
has not been answered in the material imported here.

References supplied with the earlier advice, not rechecked during this handoff:

- [Google: Android screen casting](https://support.google.com/chromecast/answer/6059461?hl=en)
- [Google: casting from Chrome](https://support.google.com/chromecast/answer/3228332?hl=en)

## Album cleanup and playlists: imported feature proposal

The community need described in the chat includes scattered/misidentified albums,
unmatched tracks and DJ mixes. The proposed design is:

- Bulk Move to album and Edit album details, including album artist.
- Manual artwork overrides and corrections that survive subsequent lookups.
- Playlists that reference tracks independently of album membership; one track
  can occur in several playlists.
- Changes to library metadata without rewriting or re-uploading existing audio.

These were candidate requirements in the imported chat, not evidence about which
features upstream already implements. The follow-up source review found several
already present; see the independent validation brief before recommending work.
Before coding, inspect upstream's actual library schema and update/lookup paths.
Acceptance should prove that a metadata correction survives refresh/relookup,
playlist changes preserve album membership, and these operations trigger no audio
upload. Do not assume an existing metadata API or promise upstream delivery.

The local [content-addressed storage note](../wiki/content-addressed-dedup-exact-bytes.md)
already records the separate-content-and-metadata design and credits community
findings including W@tch. That is relevant design history, not verification of
upstream's current implementation.

## Existing BNR work found in this seat's checkout

The repository contains a separate BNR watch-together implementation:

- [Watch surface](../../surfaces/watch.html): video, embedded Buzz room, ticker
  and metered-session display.
- [Operations and transport guide](../../ops/watch/README.md) and the actual
  `ops/watch/live-door.mjs`, `meter.mjs` and laptop publishing scripts.
- [September 4 test receipt](RECEIPT_WATCH_ROOM_POC_2026-09-04.md): records laptop
  streaming, a 390px phone view, chat/ticker and metered pause/resume.
- [zCode note to z3.2](NOTE-TO-Z3.2-WATCH-ROOM-COMB-STATES-2026-09-04.md): records
  the watch room's use of the shared audit-state vocabulary.

The current operations guide's September 6 update uses scoped SSH forwarding
for laptop media without starting a laptop P2P daemon. Older tailnet prose in
the September 4 receipt describes its original test conditions.

These source files and historical receipts were read locally for this handoff.
They establish existing BNR work, not current service health or native W@tch TV
support. No VPS, phone, TV or casting session was probed in this lane. A connection
between upstream W@tch playback and the BNR watch room still needs design/testing.

## Separate carried thread: Eddies

The imported Eddies discussion remains a clarification request: what a displayed
euro-denominated amount means, whether redemption into euros exists, and what is
recorded when a payment link is not accepted and the recipient later joins. The
earlier assistant could not load the referenced artifact. No redemption,
stability or financial claim is adopted here; no reply has been sent.

## Handoff validation

Read the existing watch source, operations guide and historical receipts; searched
the local documentation for upstream W@tch and the TV candidate. Preserved the
founder's pasted context with unresolved claims labeled. This initial handoff is
documentation only. Validation is a diff/format review; no runtime tests apply to the
handoff, and no APK, casting, library-editing or live-service success is claimed.
