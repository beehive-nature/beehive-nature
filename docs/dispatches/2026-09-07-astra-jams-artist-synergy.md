# JAMS / JAMStand: useful connections for BNR artists and listeners

The founder named [jams.community](https://jams.community/) and
[JAMSplayer](https://github.com/JAMSplayer) as an ecosystem to build user value
with. This receipt records a source review and a bounded follow-on for Grok's
existing artist showcase lane. No third-party code was adopted, no application
was installed and no partnership or working integration is claimed.

## What the supplied sources establish

The community site's current fetched HTML describes personal music libraries,
music discovery and direct artist support, with JAMStand as its artist-facing
offering. It also describes the projects as in active development. Its payout,
cost and subscription claims are the site's claims, not verified BNR findings.
The site was readable in fetched source although the web text extractor returned
no body text. The source also links to a separate Try it out destination; this
seat did not test that app, create an account or initiate a subscription.

The GitHub organization returned five public repositories: jams-app, safe,
autowallet, JAMMED and the safebox-server fork. This review inspected pinned
trees and selected source in the first three, not all five applications.

| Repository and captured default-branch commit | Evidence and implication |
| --- | --- |
| `jams-app` at `472d80381fe455005e2f4553a64adec475de5650` | Tauri/React desktop application. `src/types/playlists/playlist.ts` represents titled collections of songs. `src/components/player/audio-provider.tsx` has play/pause/seek/volume and resolves a downloaded local file through a Tauri asset URL or a Linux local server. This is not evidence of a browser embed/API usable by BNR. |
| `safe` at `b690c8e83a015f9a8952728e61e226fe6506807b` | `Cargo.toml` declares safeapi 0.4.0 with Autonomi 0.4.4. Current BNR network/format compatibility must be demonstrated rather than inferred from the common network name. |
| `autowallet` at `a9a32dd257eeaf0e575650fddbc40d37a6ddc1e1` | A separate Tauri application, with safeapi 0.3.1 in its Cargo dependencies. Its wallet path is not needed to add listener features to BNR. |

Pinned source links:
[JAMS player](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src/components/player/audio-provider.tsx),
[playlist type](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src/types/playlists/playlist.ts),
[song type](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src/types/songs/song.ts),
[network metadata](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src/types/network-file-detail.ts),
[backend functions](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src/backend/autonomi.tsx).

The song/network types provide plausible metadata correspondences: title,
artist, album, filename/extension, duration and an XOR name. The backend's
`download` function invokes a desktop Rust command with that XOR name and a
destination folder. A BNR SHA-256 digest is not that XOR name. The inspected
files establish neither acceptance of `bnr-audio-release/1` nor a supported
external deep link/import contract. Do not invent `jams://` URLs or a
working Open this track in JAMS action from this evidence.

## L-VERIFY disposition

The complete recursive trees at these pins returned `truncated: false` and no
LICENSE, COPYING or NOTICE-named paths. Source manifests were read directly:

- [jams-app Cargo.toml](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src-tauri/Cargo.toml)
  declares `license = "UNLICENSED"`; its package.json supplies no alternate
  license grant.
- [safe Cargo.toml](https://github.com/JAMSplayer/safe/blob/b690c8e83a015f9a8952728e61e226fe6506807b/Cargo.toml)
  declares `license = "GPL-3.0"`. That declaration is recorded; a full raw
  license/scope/deployment review remains incomplete.
- [autowallet Cargo.toml](https://github.com/JAMSplayer/autowallet/blob/a9a32dd257eeaf0e575650fddbc40d37a6ddc1e1/src-tauri/Cargo.toml)
  declares `license = "UNLICENSED"`.

Disposition: **reference, public links and interoperability research; no code
adoption cleared**. Implement ordinary BNR bookmarking and player UX in BNR's
own code. Do not copy the upstream player, storage or wallet implementation.

## User-value priorities

1. **Save for later and make a small collection.** Let a listener save credited
   public release links, remove them and export their collection. Save references
   without downloading media. Keep this useful without a wallet, sign-in or
   background network participation. Local storage is this browser's copy;
   export gives the listener a portable backup.
2. **Find and support the artist.** Put artist-supplied listening, shop, event,
   commission or membership links beside credits. An Explore JAMS link may lead
   to the supplied community website now. Name it as an external destination;
   do not imply that the selected recording is in its catalog or that a payment
   has happened. Verify release-specific destinations before advertising them.
3. **Share discovery through the social and kandi surfaces.** Share a public
   release/collection link with its artist credit and artwork reference. Sharing
   discovery is separate from transferring a bracelet, ownership or audio bytes.
   A user's private library, local paths or private data maps must not become a
   public gift payload.
4. **Carry an authorized release between applications.** Verify a supported
   JAMS entry mechanism, file format and current Autonomi compatibility using
   a controlled recording. Then demonstrate successful retrieval/playback and
   matching complete bytes. Preserve artist credit and independent AR/ANT
   receipts. Until then this is a candidate, not an integration badge.
5. **Make listening practical on poor networks.** No catalog-wide prefetch or
   laptop node requirement. Later, offer a clearly sized, explicit offline save
   for recordings whose source permits it. Report cache success/failure honestly
   and provide removal. A saved bookmark alone is not offline audio.

New bee keeps one primary Play and a small set of real alternatives. Raver adds
the founder's bloom and optional expression while keeping the same controls.
Cypherpunk exposes more detail; credits, source choices and receipts remain
accessible in every view. Retain playback and local collection state on skin
changes. Profile creation remains optional, not the listening front door.

## Grok follow-on: small enough to verify

The founder confirms Grok's existing worker is already handling Play / Watch /
Other ways to listen and state retention on #33. Finish that slice first.
Queue **Save for later + remove + export** as the next bounded enhancement in
the showcase lane, using the same existing worker/session if practical. Do not
launch another fleet for this note. This is a handoff request, not evidence
that Grok has claimed or completed the additional feature.

Acceptance: a clearly labeled fixture/public reference can be saved once,
survives reload and all three views, can be removed, and exports as parseable
BNR JSON with credits and public links. A rejected storage write must not say
Saved or erase prior entries. Imported/exported content is data, never HTML or
executable URLs. Export only the explicitly selected public metadata; no local
source paths, wallet data or private storage addresses. Keep fixture status
visible. Do not label the export JAMS-compatible before an actual import test.

A community link can ship as a normal external link; no logo reuse or implied
endorsement is necessary. Source-specific handoff, subscriptions, payments,
offline audio and listening-room synchronization are separate future lanes.

## Verification and scope

Read-only HTTP/GitHub source work, pinned repository tree checks and manifest
reads were performed. No runtime JAMS/Autonomi test, full repository security
audit, media upload, fee quote or rights attestation is claimed. No laptop node,
daemon, installer or third-party code was run. Only this dispatch and the
candidate ledger change; no surface tests are needed for this documentation
update. A documentation diff check precedes commit. No production change,
external outreach or campaign launch occurred.
