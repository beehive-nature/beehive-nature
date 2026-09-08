# JAMS collaboration: founder + Claude notes absorbed

Founder supplied `jams jamstand collab.md`, prepared with Claude on 2026-09-05.
This addendum carries its product direction into the first-work lane. The
original document remains unchanged. Its contact suggestions are proposals,
not an instruction to contact people. Personal biographies and contact details
are not copied here.

## The useful exchange

JAMS/JAMStand is a candidate collaborator for media-library UX, metadata,
playlists and practical Autonomi retrieval. BNR can offer its artist-facing
three-view presentation, credited work references, deliberate Keep/share,
collection portability and reproducible engineering tests. This is a proposed
exchange of useful work; no partnership or maintainer commitment is established.

The first proof should be one creator-authorized recording: open the credited
work, choose a named source, retrieve it, compare its complete hash, play it,
and retain its maker and source metadata through a library round trip. Record
the exact app/adapter versions, actual format, byte count, failures and costs.
Use no invented `jams://` URI or compatibility badge. BNR JSON is currently
BNR's own reference format, not a tested JAMS playlist import.

The bloom is the working visual-art reference for that journey. It needs no
recording upload to prove receive -> deliberate Keep -> export -> preview
import -> deliberate merge. Media bytes, storage receipts and library
interoperability remain separate subsequent proofs.

## Corrections from primary source

Rechecked GitHub default-branch heads and the three manifests on 2026-09-07
(America/Denver). The heads match the earlier pinned Astra JAMS source study.

| Component | Actual manifest declaration | Pinned source |
| --- | --- | --- |
| `safe` | `license = "GPL-3.0"` | [Cargo.toml](https://github.com/JAMSplayer/safe/blob/b690c8e83a015f9a8952728e61e226fe6506807b/Cargo.toml) |
| `jams-app` | `license = "UNLICENSED"` | [src-tauri/Cargo.toml](https://github.com/JAMSplayer/jams-app/blob/472d80381fe455005e2f4553a64adec475de5650/src-tauri/Cargo.toml) |
| `autowallet` | `license = "UNLICENSED"` | [src-tauri/Cargo.toml](https://github.com/JAMSplayer/autowallet/blob/a9a32dd257eeaf0e575650fddbc40d37a6ddc1e1/src-tauri/Cargo.toml) |

The Claude report's blanket unverified-license description missed these
declarations. A manifest is evidence to examine with the relevant source and
dependencies; it is not a completed L-VERIFY adoption review. A newly added
permissive license alone would not establish compatibility, security or
operational suitability. Do not presume the maintainers must relicense their
work. No JAMS code is incorporated by this lane.

Team size, friendliness, current maintenance capacity, follower counts and
roadmap expectations in the report are historical observations or hypotheses.
They are not evidence of demand, an agreed collaboration, or a current service
commitment. Browser-native transport/mainnet claims require versioned tests.

Likewise, BNR must not offer a functioning verified-artist certificate, royalty
system or permanent artist-agent service merely because the architecture
describes it. A stored or signed certificate can attest a claim; it does not
alone establish the human artist's identity or rights to a recording.

## Concrete division of work

- **Astra:** shared work identity, reference storage and recovery, failure
  tests, release integration; later a bounded retrieve-and-hash fixture using
  an authorized recording. No public laptop node or production change here.
- **Grok:** finished-work presentation and credited share-card, then listening
  and library UX around the same record. Keep source choice, credits and
  collection available in all skins; external JAMS links open a labeled new tab.
- **Potential JAMS collaboration:** a reproducible issue or small upstream
  contribution after the relevant license/scope review, and a controlled
  interoperability check. Any maintainer conversation is founder-controlled.

The useful future questions concern the supported mainnet/app versions,
actual library interchange format, intended license scope and contribution
process, and whether a bounded bug fix would be welcome. These questions are
prepared, not sent. No recruitment, campaign, spend or media publication.

Implementation contract: [first-work-release-contract](../specs/first-work-release-contract.md).

