# Kandi music: prepare an artist release for Autonomi and Arweave

The founder wants the kandi soundtrack to demonstrate BNR's storage stack.
This lane adds a local audio preparation tool and records the remaining upload
work. It does not yet provide decentralized audio playback. The optional
YouTube player remains on draft PR #32 with its earlier playback limitation.

## Recording and permission

The supplied YouTube upload is CJ Bolland's "Sugar is sweeter" (Sugar Daddy).
The founder has YouTube Premium and describes the recording as an old white
label. Neither establishes permission to republish the recording independently
of YouTube. [YouTube's terms](https://www.youtube.com/t/terms), under License to
Other Users, distinguish playback/embeds from use outside the service.

The founder was asked whether they have publication permission or prefer an
original/cleared recording. That answer and a source audio file remain pending.
No recording was downloaded, extracted or uploaded. The existing external
YouTube link remains available. This is separate from campaign audio on #28.

## Local preparation delivered

`scripts/prepare-audio-release.mjs` accepts a local export and writes a new
`bnr-audio-release/1` review manifest. It requires Node and ffprobe on PATH.
For example, from the worktree root:

```powershell
node scripts/prepare-audio-release.mjs --file "C:\Artist Exports\track.wav" --title "Track title" --artist "Artist name" --out "C:\Artist Exports\track-release.json"
```

The default rights basis is `unconfirmed`. An artist or label can supply
`--rights original|permission|licensed|public-domain` with `--rights-note` to
record their credit and permission/license reference. This is a user statement,
not independent rights verification. Include only information intended for a
public credit record; the script itself keeps the manifest local.

The tool streams the **complete file** through SHA-256, measures bytes, and
uses ffprobe for duration, container and audio-stream metadata. Supported
containers are MP3, WAV, FLAC, Ogg, AAC and M4A. This is metadata inspection,
not a complete decode or a browser playback receipt. Source changes during
measurement/probing are refused. Output creation is exclusive: an existing
record is never overwritten. Only the source basename is recorded.

The record explicitly says `prepared-local-only`, has no storage addresses,
and marks upload, retrieval, fee quotes and publication as not performed.
It refuses URL inputs. It has no network client, signer or uploader.

## Existing stack: capabilities and gaps

- `surfaces/blight/midivault.html`, `BACKEND` and `ADAPTER.put/get`: storage is
  explicitly **SIMULATED**. The local path currently saves at most the first
  32 KiB (`bytes.subarray(0,0x8000)`) and swallows localStorage write errors
  while returning the complete input's address. It must not be reused as a
  full-track archive or a storage-success receipt. This lane does not modify it.
- `surfaces/arweave.js`, `MAX_INLINE` and `chunkRoot`: the current browser
  adapter rejects payloads over 256 KiB. That is an implementation limit,
  not Arweave's total file-size limit. The preparation record identifies which
  side of this limit the actual file falls on. The official
  [arweave-js uploader](https://github.com/ArweaveTeam/arweave-js#submit-a-transaction)
  supports chunk uploads and resuming; a successful HTTP submission alone is
  not confirmation. BNR's large-file signing, resume and confirmation path
  still needs integration and verification. Existing code in
  `crates/atmirror/src/arweave.rs` is a reuse candidate, not adopted here.
- `docs/specs/SPEC-AUTONOMI-TREZOR-1.md` reserves payment signatures for the
  founder. Its recorded CLI/daemon constraints treat finalize as non-retryable
  and limit use to bench uploads/small public artifacts. Inspect the pinned
  implementation and current resumability evidence before funding a full
  recording. The official [ant-sdk](https://github.com/WithAutonomi/ant-sdk)
  documents external-signer prepare/finalize, but that alone does not establish
  that the estate's installed version has the needed recovery behavior.
- `ops/ant-extsig/BROWSER-PATTERN.md` records a September 4 daemon-based read
  path and CORS limits. A browser needs an actual resolver/gateway route;
  do not label bootstrap gateway playback as browser-direct P2P. No production
  route was probed in this lane. No laptop node was started.

This follows `docs/specs/SPEC-DJBUZZ-1.md`'s rendered-master/reference split
and `docs/specs/SPEC-MIRROR-COMMONS-1.md`'s file measurement, rights and
founder-signed publication sequence. It does not introduce a new token format.

## Next integration, in order

1. Obtain an authorized local recording with title, artist and credit terms;
   generate its manifest and verify listening in a target browser.
2. Review and pin the large-payload upload implementations, including recovery
   after interruption. Apply L-VERIFY before adopting any new dependency.
   Quote the actual complete file on both networks and prepare the receipt
   before founder-controlled signing. A public upload is deliberate publication.
3. Record upload outcome and confirmation evidence. Retrieve the entire file
   independently from each advertised storage source; require matching byte
   count and SHA-256. An address or an HTTP 200 alone is insufficient evidence.
4. Connect those verified sources to an optional native audio player in all
   three views: clear artist credit and play/pause/volume in New bee; the bloom
   alongside the same controls in Raver; storage receipts in Cypherpunk. Any
   audio-to-bloom response remains future work. Detailed source information
   stays available from every view. Keep YouTube visibly separate as an
   external listening option, with no silent fallback to another service.

No persistence-duration guarantee, live Autonomi playback, paid upload or
decentralized delivery claim is made by this local preparation artifact.

## Verification receipt

Local Node syntax and help checks passed with ffprobe 9.0.1 available. A scratch
verification used a generated **384,044-byte, two-second, 48 kHz stereo PCM
WAV** with a nonzero final sample. The entire digest and byte count matched
Node's independent hash of the fixture; duration/channels matched its header.
The fixture exceeds the current Arweave inline limit and was correctly routed
to the large-payload plan. No third-party audio was used.

The same check confirmed unconfirmed rights, null storage IDs, URL refusal,
missing permission-statement refusal, non-audio refusal, parseable JSON with
the same-line PUBLIC-CONSTANT digest marker, and refusal to overwrite an
existing output. Scratch fixtures/manifests were kept outside the commit.
No new persistent test suite or storage integration test is claimed.

The earlier kandi player verification is in
`2026-09-07-astra-kandi-music.md`. Those surface files are unchanged by this
follow-up; their tests were not rerun. No production deployment occurred.

## Founder direction: a choice of media and listening services

The founder asks for different ways to consume media and expects the YouTube
embed to work when served from the public domain. Adopt user choice as the
product direction; public-domain playback remains a hypothesis to test.

Grok's draft #33 (`cursor/artist-audio-showcase-0ec3`, reviewed here only for
its scope/dispatch at `35e4752f`) supplies an audio shell and a labeled local
tone fixture. It has no stored artist recording. Extend that existing lane:

- Lead New bee with one clear Play action and artist credit. Offer **Other
  ways to listen** for available alternatives, naming the actual source.
  Offer **Watch** when the artist has a video. Reading material, captions or
  transcripts are further choices when they exist, never invented equivalents.
- Keep the same capabilities in Raver and Cypherpunk. A skin change preserves
  the current player, source, pause/play position and volume. Source changes
  are explicit; stop the previous in-page player before starting another.
  Do not promise synchronized positions across unrelated provider players.
- Distinguish a medium (audio/video/text) from a delivery source (verified BNR
  media, YouTube, or an artist-supplied external service). Keep the small
  chooser readable; protocol names belong in available storage details.
  A YouTube video retains its visible native video player and controls.
- Offer only real, available sources. Empty ANT/AR receipts stay development
  status, not selectable playback providers. No third-party player or media
  request starts just because a visitor arrived or changed skins. External
  app playback has its own account and controls; BNR cannot promise to pause it.
- Keep the same credits and artwork association across media choices. Copies
  of identical bytes on ANT and AR share a digest; separate encodings or video
  editions need their own measured digests and an explicit relationship to the
  original. This remains an artist release, not an automatic provider swap.

The existing kandi iframe sets `strict-origin-when-cross-origin`, matching
[YouTube's embedded-client guidance](https://developers.google.com/youtube/terms/required-minimum-functionality#api-client-identity-and-credentials).
That guidance requires Referer/client identification and describes WebView
differences. The [IFrame API error reference](https://developers.google.com/youtube/iframe_api_reference#onError)
separately identifies missing client identity (153) and embedding disabled by
the owner (101/150). No such code was captured in our failing embed, so neither
cause is established. A normal public HTTPS page with valid referrer identity
is a useful next test; DNS alone cannot prove or guarantee playback. Keep the
external YouTube listening option available and report the actual hosted test
result before closing #32's embed limitation. No hosting or production change
was made for this direction update.
