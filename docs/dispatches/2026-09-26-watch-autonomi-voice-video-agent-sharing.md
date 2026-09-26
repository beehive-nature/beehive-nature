# W@tch × Autonomi voice/video × agent sharing — WATCH, not integrate

date 2026-09-26 · seat zCode (GLM) · scope: desk research only — docs, no code, no surfaces; nothing about the rumored product was inspected, and nothing was run. Third dispatch of the lane, riding the same draft PR as [2026-09-26-erc223-x-eip7702-receiver-gate.md](2026-09-26-erc223-x-eip7702-receiver-gate.md) and [2026-09-26-buzz-x0x-venice-x402-synergy.md](2026-09-26-buzz-x0x-venice-x402-synergy.md).

## CLASSIFICATION: WATCH, NOT INTEGRATE

The evidence state, stated exactly:

- **The signal is founder-relayed, not yet first-party.** dirvine (David Irvine, Autonomi) is reported to have said voice/video is in flight, built for humans first, with agents *permitted* rather than default. On the check date, neither web search nor the Autonomi forum surfaced a citable post of this — so it is carried as relayed intelligence, and this dispatch's classification absorbs that: **we watch for the artifact, not the rumor.** When a repo, spec, or post lands, the deciding work starts from the source, never from this paragraph.
- **No code or spec was examined** — there is nothing to integrate against yet. The word "integrate" is therefore banned from this lane until that changes.

If the "humans first, agents permitted" shape holds when the source lands, the load-bearing word is *permitted*: permissioning would be the extension point, not the default state. That is exactly the seam the estate's authority layer is built for — see below — and exactly the default the estate's law refuses to relax.

## THE DECIDING QUESTION (asked once, when source/spec lands)

**Is the shipped thing a storage facility, a real-time transport, or a composition of both?** Everything downstream hangs on that one answer:

- **Storage facility** — voice/video as Autonomi objects (recordings, files). Then the estate's transport needs are unchanged: x0x stays the coordination carrier, Autonomi stays the durable-object layer, and the existing local-first evidence (below) already covers the playback half.
- **Real-time transport** — live P2P voice/video sessions. Only then does "reuse it for x0x media" become a question worth asking — and even then only if it is genuinely live P2P, not stored media with a latency apology.
- **A composition** — the likely shape, and the dangerous one for us: a product that fuses coordination, transport, and storage into one service. The estate answers fusions with seams (next section).

## BNRoSe FIT — CAPABILITY-SCOPED MEDIA (proposed vocabulary, not implemented)

Media access becomes capability-scoped, with **all five axes held by BNRoSe** — actor, scope, destination, duration, revocation — and the namespace sketch:

- `media.voice.read` / `media.voice.publish`
- `media.video.read` / `media.video.publish`
- `media.file.read` / `media.file.share`

The shape deliberately mirrors the authority organ the estate already runs ([crates/bsigner/src/x402.rs](../../crates/bsigner/src/x402.rs)): a destination is pinned **together with** the authority that justifies it (there: payee pinned with its seller key; here: media destination pinned with scope and duration), the policy file is in the member's hand and read, never written, and revocation is deleting the pin — not asking a service to forget.

**The law this lane adds to the family:** *agents never inherit comms access by default.* A capability is minted per agent, per scope, per duration, by the member's hand. Sibling of the standing law from the synergy dispatch — **an x0x permission is never a spend permission** — and its immediate corollary here: **an x0x permission is never a media permission.** Presence in a room, group membership, and relay access mint nothing. The "humans first, agents permitted" rumor, if it holds, lands exactly on this seam — which is why we watch instead of wait.

## LAYERING — FOUR JOBS, FOUR LAYERS, NO LAYER DOES TWO

| layer | its job | does not do |
|---|---|---|
| **x0x** | hot coordination — presence, messages, invites, who is in the room | store recordings; hold authority |
| **Autonomi** | durable objects — the bytes that outlive the call, addressed and paid for | coordinate; decide who may read |
| **local disk** | working set — downloaded bytes, the e2e-proven playable set (below) | be the archive; be the authority |
| **BNRoSe** | authority — who may read/publish/share what, until when, revocably | carry traffic; hold bytes |

The fusion smell to watch for: a shipped product that quietly merges coordination, transport, and storage into one service is a vendor convenience, not an estate architecture. Keep the seams even if they fuse theirs — the estate's version of this stack already exists (below) and each seam has its own receipt.

## LOCAL-FIRST EVIDENCE — what the tree already proves (two halves, separately)

The estate has already proven both halves of "media on Autonomi, played locally" — and the join between them is honestly still open:

1. **Stored on Autonomi, receipt-verified.** PR #228 (MERGED, `8dfb68d81`): the My Data surface ([surfaces/bdata.html](https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/bdata.html) + [surfaces/bdata.js](https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/bdata.js)) shows the Bux video (`try_autonomi.mp4`) STORED only when `surfaces/bdata-stored-bux-try-autonomi.json` verifies line by line against the bpay invoice — artifact name, sha256 pin, data-map address, network, audience, and the three evidence rows (purchased / uploaded / retrieved), each citing its source. The receipt's own law line records that the upload was the founder's own hand; no seat moved funds or pressed pay. This is the Autonomi-durable-object leg, under the measured-states economics law.
2. **Plays locally, original bytes, no transcode.** `e2e/watch-try-autonomi-playback.mjs` (committed on this branch at `48be9f821`, byte-faithful, per founder order) drives real Chromium at 390px against a Range-capable **local** server serving the downloaded file: it asserts clock advance, decoded frame counts, play-to-end at the tail, and zero page/video errors, printing one JSON receipt line; shots in `e2e/shots-watch-try-autonomi/`. This is the local-working-set leg: once bytes are on disk, playback needs no network at all.
3. **The join is not claimed.** Main's [surfaces/watch.html](https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/watch.html) says it in its own words: the Autonomi checkpoint is "a shape-checked fixture, not proof that video was encrypted or retrieved from Autonomi," and "No wallet signing, payment, raw x0x socket or real Autonomi write is started by this watch page." Retrieve-in-page (Autonomi → decrypt/verify → play, receipted) is the missing leg and stays missing until it has a receipt.
4. **The hot/live rig, tracked in-tree:** [ops/watch/](https://github.com/beehive-nature/beehive-nature/tree/main/ops/watch) — `live-door.mjs` (receipt-gated playlists; the watch page itself discloses that the segment handler does not recheck receipts and the receipt endpoint has no caller-identity check — "must not be treated as private media access"), `meter.mjs`, `stream-laptop.sh`, `buzz-live.service`. Same-origin HTTP/HLS, no E2EE — the honest current shape of live media, coordination and delivery still one rig.

## NODE UX TARGET — the path every blank machine walks

**blank machine → Nix realization → identity restored → joins x0x/Autonomi → contributing.**

The first two steps are no longer hypothetical: `ops/nixos/buzz-hostinger/` (committed on this branch at `48be9f821`, byte-faithful, per founder order) carries `buzz-services.nix`, the relay/caddy/storage Dockerfiles, the Caddyfiles, and `MIGRATION.md`, which records that production skaists.buzz cut over to a **NixOS host** on 2026-09-24 — "passed live activation and two successful boots after repair," zero failed units — with voice and the watch/Autonomi auxiliary services named among the services reached through explicit proxy routes. One machine has already walked blank → realized → producing. The target generalizes that walk to any node: identity restored from the member's custody (never seeded by a service), then x0x presence, then Autonomi contribution — each step separately observable, nothing implicit, and no step that grants authority by arriving.

## NOT CLAIMED

- **Nothing was inspected and nothing was run.** No Autonomi repo, spec, or branch was examined (there is nothing public in hand to examine); no e2e was re-run by this seat — the playback shots are from the original lane's run; no upload, download, or voice/video call was performed.
- **The dirvine statement is carried founder-relayed.** No citable first-party post was located on 2026-09-26 (web search + Autonomi forum). It is the reason for the classification, not evidence for any claim inside this dispatch.
- **No claim about what the shipped thing will be** — storage, transport, or composition is open until source/spec lands; the deciding question is written down so it gets asked once, from the source.
- **The `media.*` capability namespace is proposed vocabulary.** Zero lines of it exist in the tree; BNRoSe's organ today is the bsigner policy shape, which this sketch mirrors but does not modify.
- The two in-tree evidence paths (`e2e/watch-try-autonomi-playback.mjs` + shots, `ops/nixos/buzz-hostinger/`) are committed on this branch at `48be9f821` — byte-faithful, per the founder order relayed from the #242 wallet review; they are not asserted as merged to main, and the commit carries one disclosed scanner rider (a path-scoped `ops/nixos/` exclusion in scripts/secret-scan.sh, on the voucher-escrow/fixtures basis, because Dockerfiles cannot carry same-line PUBLIC-CONSTANT markers).

## SOURCES

- In-tree (tracked): `surfaces/bdata.html`, `surfaces/bdata.js`, `surfaces/bdata-stored-bux-try-autonomi.json`, `surfaces/watch.html` (origin/main), `ops/watch/*`
- In-tree (committed on this branch at `48be9f821`): `e2e/watch-try-autonomi-playback.mjs`, `e2e/shots-watch-try-autonomi/`, `ops/nixos/buzz-hostinger/` incl. `MIGRATION.md`
- PR #228 — "bData: the Bux video is STORED on Autonomi — receipt-verified stored state on My Data", MERGED `8dfb68d81`
- Companion dispatches of this lane: [2026-09-26-erc223-x-eip7702-receiver-gate.md](2026-09-26-erc223-x-eip7702-receiver-gate.md), [2026-09-26-buzz-x0x-venice-x402-synergy.md](2026-09-26-buzz-x0x-venice-x402-synergy.md)
