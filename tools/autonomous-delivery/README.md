# Serverless adaptive delivery

bView can read an `ant-hls://<public-ANT-address>` video pack directly through the
pinned Autonomi SDK. The application operator serves no video bytes on this route.
The browser opens one ANT object, reads a small index, and feeds verified ranges
to the existing adaptive player. Static application/library assets still load
from the site. ANT nodes, device bandwidth and chain resources still have costs.

## Package and playback

`node tools/autonomous-delivery/pack.mjs ENCODED_DIRECTORY ORIGINAL_ADDRESS OUTPUT.ant-hls`

The input is the existing `tools/video-trial/package-hls.mjs` output, including
`package.json`. Every listed file is checked against its encoder hash and size.
The pack is capped at the existing hosted wallet's 32 MiB verified-upload limit.
It is one file for `surfaces/wallet.html#bpay-sec`; use the existing ANT purchase,
bounded invoice, wallet signature, uncertain-payment recovery and hash-verified
retrieval flow. This packer never signs, pays or uploads. Playback uses the
returned **file address**, not the local SHA-256. A SHA-256 is not an ANT address.

Format: 12 ASCII bytes `BNRANTHLS001`, a little-endian u32 index length, UTF-8 JSON
index, then contiguous media bytes. Index schema `bnr.ant-hls/1` contains the
bundle ID, declared original address, embedded playlists and media SHA-256/size/
relative offsets. The original address is a publisher declaration, not a ZK
proof of derivation or publisher identity. A curated original-to-pack mapping
must additionally verify publication provenance and actual ANT retrieval.

Only finite unencrypted H264/AAC VOD playlists in the pack are supported. The
custom hls.js loader rejects outside URLs and recursive playlists; Safari needs
the hls.js-supported MSE/MMS path. Native HLS cannot resolve an ANT pack. No
HTTP media, relay or native-HLS fallback is hidden behind this route.

Per session: one open, at most three admitted range reads at once, 4 MiB per
range, 512 MiB admitted bytes, 4,096 reads, 24 MiB application cache. A reader
error or 90-second range/open deadline closes the session. Pause/seek aborts
suppress delivery but retain active read slots until completion, so a sequence
of cancels cannot bypass concurrency admission. Uncertain byte reservations
are not refunded. SDK wire buffers and raw transport work are outside these
application counters; this is not a total-memory or wire-traffic ceiling.

`__bviewEngine().adaptive.delivery` records opens, requests, reserved/read/
verified bytes, cache hits and peak concurrency locally. It explicitly records
`paid:false`; playback measurements cannot become payable b-meter receipts by
themselves. No telemetry is uploaded and there is no global viewer registry.

## Existing stack boundaries

The next integration uses the estate's existing authority and settlement code:

| Component | Serverless role | Existing implementation and remaining boundary |
|---|---|---|
| bzDiD / wallet | Device-owned identity and bounded resource authorization | `crates/bzdid/src/lib.rs::verify_genesis`; `surfaces/ant-pay.js::createHosted` binds the actual purchase. Identity is not a prepaid balance. |
| ANT | Immutable media and recovery data | This pack loader uses `PublicFileReader.read` directly; pack upload/retrieval is a separate receipt. |
| x0x | Bounded participant discovery and coordination | Peer messages must bind sender, logical ID and exact payload; never broadcast video segments or trust transport delivery as payment. No new daemon is introduced here. |
| b-indexer | Reconstruct chain facts for settlement/recovery | `crates/bindexer/src/ingest.rs` checks oracle agreement; source/lag status stays visible. It can run at an owner/operator seat, without a mandatory estate API. |
| b-meter | Local admission, integer tariffs and resource accounting | `scripts/buzz-meter/voucher_escrow.py::Escrow.charge` and `settle_upto`; requires an actual rate set and funding/authorization. This PR does not charge counters. |
| Rust wallet / Vaulta C++ | Local proof creation, exact state transitions and compact validation | Silent Pay funded suite and the separate PLONK receipt suite have different curves, keys, statements and encodings. See the source-study dispatch. |
| AR / fractal anchors | Durable aggregate commitments and independent recovery | `crates/adapter-arweave` builds event bundles; default transport is mock. `surfaces/arweave.js` has direct wallet signing. Community replication/anchor hierarchy is not implemented by this player. |

At scale, each client keeps bounded state and only its own responsibilities.
Shared settlement/anchoring must operate on supported batches and retain
recoverable witnesses. The 10-billion population target is distinct from
10 billion simultaneous streams. `capacity.mjs::serverlessDemand` exposes the
aggregate media, checkpoint, proof and anchor demand for explicit assumptions.
Batch sizes there are hypothetical, not a claim of recursive aggregation or
production verifier capacity. ZK can amortize validation; it cannot eliminate
the media bytes that storage nodes and viewers exchange.

Checks: `node --test e2e/ant-hls.test.mjs e2e/bview-ant-hls.test.mjs`.
Browser checks use the actual encoded video with fixture SDK reads and real
H264/AAC decoding. They are separate from live ANT measurements.
