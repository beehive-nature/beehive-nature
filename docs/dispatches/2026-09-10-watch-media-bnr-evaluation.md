# W@tch media, Channels and BNR evaluation — 2026-09-10

Founder returned to the TV build and reported that it looks suited to the
device and displays five connected peers. This is founder-reported reception
and connection status, not a measured scrub/audio-sync acceptance result or a
viewer count. The founder asks about managing media, Channels and social value
from connecting W@tch with BNR.

## Reviewed behavior

Reviewed the installed-build source at `435c887`, upstream README and Channels
documentation, plus the existing BNR watch-room receipt and implementation.

- Import `.datamap` files or `.watch-list` bundles into personal lists. The
  bundle includes media references and can carry metadata/artwork. Importing an
  already uploaded item does not imply uploading its audio/video again.
- Desktop Settings → Upload handles local files/folders, metadata review,
  optional video encodes, a cost estimate and network upload. Wallet/payment
  actions were not performed or requested in this evaluation.
- My W@tch links the member's own devices and synchronizes library data,
  viewing positions and custom edits. A private datamap/bundle conveys access;
  a social share must not include one by default.
- Channels are public publisher-managed feeds. Desktop creates/publishes a
  channel; other devices subscribe with a `wchn1-` code and follow its updates.
  Public channel publication is durable; removing an entry from a newer list
  does not erase the previously published data. A channel is not a private
  Buzz room or a chat group.
- The Channels implementation already uses x0x for update distribution.
  Source anchor: `native/watchit_core/src/channels.rs::best_head` calls
  `native/watchit_core/src/channel.rs::verify_head` before selecting a head.
  `app/lib/services/channel_service.dart::_importManifest` checks the manifest
  channel key and imports its read-only list. These are source observations,
  not an independent cryptographic audit or anonymity claim.
- Album artist and custom artwork editing already exist. List editing already
  copies/moves album groups or individual entries between personal lists. The
  earlier independent brief identified an album metadata identity collision
  candidate; it should be reproduced before proposing a fix.

## Recommended first media trial

Use a deliberately small collection: one album/DJ mix, one self-made short
video, or an existing public sample bundle. The founder has not selected a
file/folder yet. Prepare metadata on the Dell, then exercise phone and TV use.

1. Inspect/import existing references, or review a new upload and its actual
   estimate before any payment or permanent publication.
2. Check album grouping, compilation credit, artwork and title corrections.
3. Copy entries to a second personal list; ensure the source collection and
   media references remain intact.
4. Sync to Samsung A16 and Streamer; confirm edits survive restart and sync.
5. Test seek, resume between devices, download/offline playback and reconnect.
6. Record observed defects and only then prepare focused upstream changes.

No media files were scanned, uploaded, published or shared during this turn.

## BNR opportunity, in order

1. **Public channel cards in Buzz.** Carry the public channel code, title,
   artwork and creator reference with Copy/Subscribe and Join-room actions.
   Any claimed link between a BNR identity and a channel key needs explicit
   verification; a display name alone does not establish ownership. This
   makes discovery and conversation the first useful integration. No private
   library, watch history, datamaps or My W@tch invitations enter public posts.
2. **Watch together.** Add explicit participant consent and a shared media
   reference plus play/pause/seek events. Each participant's W@tch retrieves
   media; Buzz supplies room conversation. Content matching, buffering and
   clock drift must be tested. This is proposed work, not an existing bridge.
3. **Creator assistance.** Optional captions/transcripts (including the
   Latvian direction), chapter markers, thumbnails and transcoding could use
   mesh resources. Price actual processing as a separate service; do not
   promise that a public Channel becomes private or revocable through billing.

The existing BNR `surfaces/watch.html` and `ops/watch/` implement a separate
HLS watch-room prototype. The September 4 receipt records phone playback,
Buzz chat/ticker and metered pause/resume. That historical receipt is not a
fresh VPS-health check or proof of synchronized native W@tch playback. Its
September 6 operations guide updates the laptop transport to scoped SSH.

## References

- [W@tch README](https://github.com/aautonomicc/Watch-It#how-it-works)
- [Personal media and public Channels](https://github.com/aautonomicc/Watch-It/blob/main/docs/PLAN-personal-vs-channels.md)
- [Channel profile limits](https://github.com/aautonomicc/Watch-It/blob/main/docs/PLAN-channel-profile.md)
- [Existing BNR watch-room receipt](RECEIPT_WATCH_ROOM_POC_2026-09-04.md)
- [Prior independent media review](2026-09-10-watch-independent-validation.md)
- [TV build and PR receipt](2026-09-10-watch-tv-ux.md)

This is an evaluation and proposed order of work. No TV input, VPS change,
new application runtime, upstream message, protocol change or billing action
was performed. Work is recorded in the seat's owned BNR worktree.
