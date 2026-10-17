# COMB: a mesh-native PQ Buzz on bChat Core

Design seat, mesh-native angle, 2026-10-15. A design proposal only. Nothing here is ruled or built, and nothing claims the bTunGsTeN title (`docs/dispatches/2026-10-06-btungsten-lane.md:45-47`).

Notation:
- **[AMEND]** marks a dependency on a PLANE LAW amendment that does not exist today. With every [AMEND] switched off, the design runs as **lawful-minimal**. That mode is complete and lawful under the current ruling (`docs/ledger/pirate-haul-rulings.md:18`).
- Citations use the reader notes' paths. `up/` means `scratchpad/pqbuzz/up/` (x0x v0.48.0 copies). `X0X` means `C:/Users/travi/x0x-pr` at `e0af580`.
- Every number is recomputed in this document. Assumptions are marked **A#**.

---

## 0. Thesis

**COMB** is the mesh-native road set and envelope revision for bChat Core v2, with the Buzz desktop, buzz-cli and buzz-acp as its surfaces. It evolves bChat Core (`docs/specs/SPEC-BCHAT-1.md:37-48`) and the kernel CanonicalEvent (`docs/CONSTITUTION.md:65`) rather than standing up a rival stack (`memory/sovereign-operating-environment-order.md:14`). Messages live on devices their owners control. Every conversation is a small post-quantum group whose ciphertext moves peer to peer between members' always-on **inbox nodes**. A phone is never a mesh peer; it holds one link to its owner's inbox node. Relays shrink to optional caches and bootstrap seeds that hold nothing the system needs, and no topic, directory, presence set, log or chain row is global. x0x stays inside its own scope, "one owner with 2–5 machines" (`up/adr/0095-scope-x0x-is-glue.md:81`). Only under a PLANE LAW amendment does it also become one PQ QUIC road among several between inbox nodes, and it is never storage. The finding behind all of this: the idle bill is a global-gossip problem, not a phone problem. 10^9 inbox nodes on a public mesh at the third-party figure of 75 GB/day each (CLAIMED, `docs/dispatches/2026-10-12-btmd-mesh-dependability.md:56-58,70-73`) would move 75 EB/day before a single message is sent. So COMB bans global gossip outright, not only phone peers.

---

## 1. Plane mapping and ESCALATIONS

| Plane (`pirate-haul-rulings.md:18`) | What carries it in COMB, lawful-minimal | What changes under [AMEND] |
|---|---|---|
| Human: room content, DMs, receipts, typing | CMB1 ciphertext on estate roads: TLS/WSS, a non-x0x QUIC stack, cache relays (the legacy Buzz relay included) | x0x byte streams join the road list for inbox-to-inbox and owner-device links |
| Machine: agent coordination, node capability cards, health | x0x as today (`ops/x0x/README.md`) | unchanged |
| Durable | Users' own local journals (BNRoSe `ReplicatedJournal`) plus user-paid Autonomi batches | unchanged (X-1 and X-3 stand) |
| Permanence | Arweave for items under 256 KiB, and OTS roots (`BUZZ_A_METERING_SPEC.md:127`) | unchanged |
| Settlement | bPay rails; **zero chain bytes per message or per user** | unchanged |

### The switch, not a rewrite

Each road is listed in a signed **road-policy law file**. The file follows the existing law-file pattern: CI fails a stale or unpinned law signature, and the founder's one-press `wallet.html#pq-law` signs it (`SPEC-BPQ-1.md:135-142`; `SPEC-BTUNGSTEN-PQ-1.md:671-672`).

- **Entry shape.** Each entry has the form `{road, planes:[machine|human], pin}`.
- **Refusal.** A road adapter refuses any frame whose plane is not listed, with a named `ROAD_PLANE_FORBIDDEN` refusal.
- **What the amendment does.** The amendment would add `human` to the x0x entries. It is a signature, not code.
- **What "available" means.** A road counts as available only after its own runtime receipts. "Configuration intent is never runtime evidence" (`SPEC-BTUNGSTEN-1.md:146-167`).

### Proposed amendment text (for the founder; NOT a ruling)

> PLANE LAW amendment A-1. Human-plane ciphertext MAY ride x0x, or a successor PQ mesh, as a road when all four hold:
> 1. the content is end-to-end encrypted by bChat Core before it enters the road;
> 2. the road holds nothing beyond its transport lifetime (X-1 is unchanged);
> 3. every message is durably held outside the road before it is sent and after it is received (X-3 is unchanged);
> 4. every path has at least two registered roads.
>
> Buzz remains NEVER a storage, permanence, privacy or settlement layer. Privacy is bChat Core's.

### ESCALATIONS (named; not resolved here)

| # | Collision | Cited rule | What COMB does without a ruling | If the founder rules otherwise |
|---|---|---|---|---|
| E1 | Human plane on x0x | PLANE LAW, `pirate-haul-rulings.md:18` | x0x carries the machine plane only | Re-sign the road-policy law file. Roads X-A, X-B and X-C (§5) switch on after their receipts |
| E2 | x0x as storage, and liveness | X-1, X-3 (`:18`); "anything held only in x0x … does not survive" (`pirate-haul-rulings-2026q3.md:27`) | No x0x KV, store, history or Home is used for human data. x0x local history (ADR 0023: default on, plaintext for MLS groups, per `x0x.md:33`) is required OFF for any COMB group | Nothing; the amendment leaves X-1 and X-3 untouched |
| E3 | X-2 bridge with merged roads | `:18` | Agents' machine-plane decisions are posted into the owner's room as signed CMB1 messages (kind `herald`) | Same mechanism |
| E4 | Buzz "NEVER … privacy/storage" | `pirate-haul-rulings.md:17` | E2EE belongs to bChat Core's private lane (`SPEC-BCHAT-1.md:50-56`). Buzz becomes surfaces plus a legacy road | Naming changes only |
| E5 | "PQ Buzz" as a rival system | sovereign order, `memory/…order.md:14`; critic N9 | COMB is bChat Core v2 plus adapters | Rename only |
| E6 | Kernel `MessageEvent{from_did,to_did}` on a public bus | R1, `RULINGS-2026-09-16.md:26-29`; `events.rs:212-219` | MessageEvent is never anchored publicly. COMB proposes an additive `MessageBatchEvent` with pairwise ids | If R1 does not apply to private-bus events, no change |
| E7 | x0x ids and second-device key copy | Law 7 `VOCABULARY.md:220-226`; "bzDiD phrase is never loaded onto a device" (`RULINGS-2026-10-04.md:59-66`); `up/README-v0.48.0.md:122` | No x0x `user.key` is ever created or copied. That is allowed: the owner key is opt-in (`up/README-v0.48.0.md:45`). Each device's x0x agent key is a bound persona. A `PersonaRef` x0x variant is proposed (`onboarding/src/lib.rs:83-108`) | — |
| E8 | Agent keys, autonomy, autonomous replies | hierarchy `RULING_BDID_HIERARCHY…:14-15`; AGENT-1 Q-3/Q-5/A-10; 08-29 autonomy | Agents hold their own device keys under an expiring, revocable owner grant. bQueenBee's autonomous replies are left to the founder | Grant fields change |
| E9 | Remote-inference agent inside an E2EE room | AGENT-1 §1.1, A-1 (`LD/AGENT-1.md:30,42-45`) | A distinct, visible, per-session, chosen mode. The room badge reads "plaintext leaves to <model host>" | — |
| E10 | Standing cost: seeds, legacy relay | Art. V.1 `CONSTITUTION.md:83`; B1 "Buzz's own A pays … its relay" (`BUZZ_A_METERING_SPEC.md:105-106`) | BNR runs bootstrap seeds only. The legacy relay is a migration-period cache, with a sunset date the founder sets | — |
| E11 | Household or coop inbox vs "one shared funder" | B1 `BUZZ_A_METERING_SPEC.md:97,107-108` | Hosted inboxes meter per user. Shared household inboxes stay off until ruled | Shared inbox becomes allowed |
| E12 | Spam postage vs "No person pays to use" | `RULING_B_SPEND_BOUNDARY…:11`; critic N2 | Contact gating plus a proof-of-work stamp plus a per-recipient queue quota. Postage stays off | Postage is enabled as a sender-paid byte-day |
| E13 | Social recovery | critic N3 (`joint-liveness-coherence.md:174` vs `SPEC-ONBOARDING-IDENTITY-1.md:179`) | Not offered | It becomes a recovery rung |
| E14 | Illegal content on permanent rails with no operator | critic N4; `SPEC-BLICENSE-0.md:187-191` | No permanent public channel ships before counsel review. Private archives are sealed and user-held | — |
| E15 | Vendor push (APNs/FCM) | VENDOR-HELD enhancement-only, `RULINGS-2026-09-30.md:23-28`; critic N5 | Opt-in, content-free wake only | — |
| E16 | A-denominated metering at 10^10 users with no Vaulta accounts | `bzdid-architecture-decision.md:61`; Rail C `:79-82` | Purchase of a reservation, never float: the user buys a 30-day inbox reservation via bPay on any rail. A is the unit of account only | Settlement rail changes |
| E17 | bSigner freeze | `crates/bsigner/CONTRACT.md:3-7,43-44` | No new bsigner command. Message checkpoints are signed by device keys through the bpq-core library. Agent grants reuse `bpq-attest-intent` over WB001 where they fit | A new attest kind |
| E18 | b in Buzz-node earning | hierarchy `:16` vs B1 `:80-82`; critic C5 | b is not in any COMB path | — |
| E19 | DNS name as community identity | `LANE_RELAY_DUALHOME:74-87` ("IT IS IDENTITY, LOAD-BEARING") vs DNS-independence law (`2026-10-13-bnr-dns-independence-routing.md:90-92`) | Identity is the room genesis id. `skaists.buzz` stays the brand and a road. The legacy origin is kept only for legacy clients | — |
| E20 | Speech transcripts vs BIO-1 B-1 | `LD/BIO-1.md:35` | Transcripts are opt-in by the speaker, computed on the speaker's device, and sent as content. No voiceprint is ever computed. The reading of B-1 is escalated | — |

---

## 2. Identity, devices, agents, keys, succession, recovery

### The root
- **The root is the bzDiD** (`did:b:`, free, zero chain bytes; `bzdid-architecture-decision.md:56-59,390`). Every COMB record keys off it, never off a raw key (`CONSTITUTION.md:49`).
- **Device keys.** Each device has its own `bzpq1` id, bound to the bzDiD by the two-signature binding (`RULINGS-2026-10-04.md:59-66`).
- **Device id form.** The id is a hash, not a key, and hides an SLH-DSA succession key: `bech32m("bzpq", SHA3-256("bpq1/id" ‖ mlDsaPk ‖ succ))` (`SPEC-BPQ-1.md:19-21,87-90`).

### Group membership
- **One leaf per device.** Each device is one leaf in every group it joins. Its leaf credential is its device key card (dsa 1,952 B, kem 1,216 B, succ 32 B; `SPEC-BPQ-1.md:94-95`) plus the binding.
- **Per-room pairwise ids are the default** where the user's keychain can sign a per-room binding at join (one press). The disclosure model is `Pairwise`, then `Selective` (`onboarding/src/lib.rs:113-133`).
- **When the keychain is unreachable,** the device's standing id is used. The UI says that rooms can link it.
- **Linked mode.** Users who want one public face across rooms (agents, public figures) choose "linked". That mode also unlocks cross-room checkpoint amortization (§3).

### Agents
- **Agents are leaves** with their own device-like keys. Each runs under an owner grant: an ML-DSA-65 `bpq1/intent` attestation over a WB001 envelope (`SPEC-BPQ-1.md:229-243`).
- **A grant names** purpose, operations, rooms, resources, an expiry of at most 30 days (A1, PROPOSED) and a revocation nonce. This matches the "explicit grant" order (`memory/…order.md:21`) and AGENT-1 Q-5.
- **Revocation** is a signed `revoke`. Member devices enforce it offline at the next commit (A-10). bLOVErAi is never a leaf (AGENT-1 L-1).

### Succession
- ML-DSA retirement uses SLH-DSA handover v1 (`SPEC-BPQ-1.md:190-209`).
- The open log-keeper role (N-3) is filled per room: member devices keep the handover log for leaves they have seen and refuse a second handover from the same `from`. That log is per room, never global.

### Recovery
- **Rungs:** `r0` passkey PRF, `r1` written code, `r2` second device (`bzdid-architecture-decision.md:49-50`).
- **RP-domain loss** ("WebAuthn alone does not survive losing the original domain", `memory/…order.md:24`) is survived only through `r1` or `r2`. So onboarding does not finish until one of them exists.
- **After recovery** the user reads surviving devices' history and the sealed Autonomi archive (§6), which `r1` opens. Ciphertext sent to lost leaves after the last archive is unreadable by design, and onboarding says so.
- Social recovery is not offered (E13).

---

## 3. The envelope of record: CMB1 inside bChat Core v2

### Format of record

bChat Core v2's canonical body is **CMB1**: a fixed-layout binary encoding with magic plus version `"bT-CMB1" ‖ 0x01`. It follows the WB001 pattern: position-dispatch encoder, capacity arrays, strict decoder (`crates/btungsten-wb001-core/src/lib.rs:30-50`). JSON is a view of it, never the bytes of record. Verifiers hash the bytes they were handed (stored-bytes law, `bzdid/src/genesis.rs:26-30`).

### Layers (byte counts)

| Layer | Fields | Bytes |
|---|---|---|
| Delivery frame (visible to the road) | magic+ver 8; mailbox token 16 (rotating pairwise, §4); frame kind 1; length 4. **No sender id.** | 29 |
| Group frame (MLS-class PrivateMessage) | group pseudonym 16; epoch 8; content type 1; sealed sender data (leaf idx, generation, reuse guard, tag) 28 | 53 |
| Content (encrypted) | suite id 2; kind 2; `ts_ms` u64 8; sender-chain seq u64 8; prev-hash 32; body len 2; body padded to a 256 B bucket; policy 2 (retain class + forget class) | 312 |
| AEAD tag | | 16 |
| **Base message** | | **410** |

### Algorithm ids

- **The suite id** maps through a COMB suite registry that is added to, never redefined. An unknown id is refused, never defaulted (`SPEC-BPQ-1.md:265-269`; `bsigner/CONTRACT.md:28-39`).
- **Suite 0x0001** = KEM X-Wing draft-11 (`SPEC-BPQ-1.md:82-85`) · signature ML-DSA-65 (pure, empty context) · AEAD AES-256-GCM · hash SHA3-256 · KDF HKDF-SHA-256.
- **New domain labels** `bpq1/comb-ckpt`, `bpq1/comb-leaf`, `bpq1/comb-hint` and `bpq1/comb-mailbox` must join the proven disjoint `bpq1/` set (PQ13 obligation, `SPEC-BTUNGSTEN-PQ-1.md:1012-1013`).

### Signature amortization (first-class)

RFC 9420 signs every application message with the sender's leaf key (scale.md §2). Under ML-DSA-65 that is 3,309 B per message. COMB replaces this with three mechanisms. **This is a declared deviation from RFC 9420 content authentication, and no interop is claimed.**

1. **AEAD under the epoch's per-sender keys.** This authenticates every message as coming from *some member* immediately. It does not stop an insider who impersonates another member, because every member can derive the secret tree.
2. **A per-sender, per-conversation hash chain.** Each message carries `seq` and `prev-hash`. A gap or fork is visible at once.
3. **A checkpoint.** It closes the insider window. A checkpoint is an ML-DSA-65 signature over `"bpq1/comb-ckpt" ‖ SHA3-256(root ‖ device_id ‖ window ‖ ts)`, where `root` is a Merkle root over chain heads padded to 16 leaves.
   - **When it is sent:** at min(64 messages, 60 s after the first unsigned message), PROPOSED and tunable per room.
   - **Checkpoint content:** 3,529 B (sig 3,309 + proof 128 + root 32 + seq range 16 + key ref 32 + headers 12). Framed size is **3,627 B**. A per-conversation checkpoint saves 128 B, because it needs no proof.
   - **Until its checkpoint arrives,** a message shows as **provisional**: readable, but not yet bound to its sender.
   - **If the window passes with no valid checkpoint,** the message turns **UNBOUND** (a named state).
   - **A checkpoint that omits a message** in its own chain range marks that message **FORGED**.
   - **Messages that carry authority always sign individually:** approvals (WF-08), grants, membership changes and payments.

**Wire bytes per message**, at m̄ messages per checkpoint (410 + 3,627/m̄):

| m̄ | 1 | 2 | 4 | 16 | 64 |
|---|---|---|---|---|---|
| B per delivered copy | 4,037 | 2,224 | 1,317 | 637 | 467 |

For comparison (`scale.md` §2):
- shape B is 3,641 B;
- shape C, with a per-recipient KEM, is 4,729 B;
- a classical Nostr-shaped message is 428 B.

Group keying removes the per-recipient KEM entirely. At m̄=16 COMB costs 1.49× a classical message, against 8.5× for shape B.

**Default per conversation type:**
- **1:1:** the pairwise AEAD already excludes outside forgers. Checkpoints serve only attribution a third party can check, so COMB offers a **deniable** default (checkpoint on demand) and an **attributable** option.
- **Rooms that contain agents or workflows** are attributable by default. Buzz is an audit substrate (`pirate-haul-rulings.md:17`).
- **Privacy rule:** cross-conversation Merkle amortization is allowed only in linked mode. A shared root would otherwise link one device across rooms.

**Commits** (TreeKEM-class, X-Wing path encryption). Per tree level: pk 1,216 + ciphertext and secret 1,168 = 2,384 B. Plus leaf node 9,850 B and commit signature 3,341 B:

| leaves n | 2 | 24 | 1,500 | 30,000 |
|---|---|---|---|---|
| commit B | 15,575 | 25,111 | 39,415 | 48,951 |
| tree state per member (n × 7,757 B) | 15.5 KB | 186 KB | 11.6 MB | 233 MB |

**So E2EE rooms are capped at 1,500 leaves** (about 500 people at 3 devices each; PROPOSED). Larger rooms are **open rooms**: signed, integrity-only, and labelled as having no confidentiality.

### Compatibility

| Format | Relation to CMB1 |
|---|---|
| bChat v1 JSON (`SPEC-BCHAT-1.md:64-72`) | v2 is a strict superset. v1 decodes into v2 and stays readable forever (Art. VI.1, `CONSTITUTION.md:92`) |
| NIP-01 | **Projection:** a local facade (§12) renders CMB1 as Schnorr NIP-01 events for legacy clients. That is classical, and labelled so, with the §5b ML-DSA attestation beside it (`SPEC-BPQ-1.md:211-227`). **Import:** legacy events are wrapped as body type `legacy-nostr`, with the original bytes preserved |
| CanonicalEvent | Commitments only, on the user's private bus. The proposed additive `MessageBatchEvent{batch_ref, pairwise_ids, count}` avoids per-message Autonomi refs (E6) |
| x0x `DmEnvelope` | Not used. It exposes sender and recipient ids in clear (`X0X/docs/design/dm-over-gossip.md:49-80`) and lives 600 s (`X0X/src/dm.rs:48`). CMB1 frames ride x0x byte streams as opaque bytes |
| WB001 | Authority-bearing bodies embed a WB001 intent as body type `intent` |
| `bheart.signature/1` | Unchanged; bsigner's envelope |

---

## 4. Confidentiality: pairwise, groups, metadata

**Pairwise.** A 1:1 conversation is a two-member group of the same engine: one mechanism, one proof surface. The first contact uses X-Wing, so no root secret ever crosses a classical-only exchange (v1 QR precedent, `surfaces/wallet.html:1366-1368`).

**Groups.** COMB uses a `GroupKeyEngine` adapter. The engine is chosen in P1 on receipts, from two candidates:
- **saorsa-mls TreeKEM.** Pinned. Its "SPEC-2" `0x0B**` ids "diverge from IETF draft codepoints", so it has no RFC 9420 interop (`up/adr/0012-treekem-default-secure-groups.md:117-121`).
- **A second independent MLS implementation** with a PQ suite (UNVERIFIED that one exists at a usable pin).

The engine needs KAT plus DIFFERENTIAL rows of its own. Estate PQ05/PQ06 receipts do not transfer (`saorsa-fips…:105-109`).

**Rekey on leave.** Upstream rekey on leave is incomplete (A09, `x0x.md:59`). COMB adds an app-level rule:
- a leave or ban must be followed by a Remove commit from any remaining member device within `T_rekey` = 10 min (PROPOSED);
- until that commit lands, the room shows "a departed member can still read new messages", and sensitive rooms hold sends;
- no post-compromise-on-leave claim is made for an engine that fails the rekey-on-ban receipt.

**Metadata.**
- **What the road sees:** a delivery frame naming only a **mailbox token**, `token_d = HMAC-SHA3(pairwise_secret, "bpq1/comb-mailbox" ‖ day)`.
- **What the inbox node learns:** the day's token set, not the contacts behind it.
- **Who knows the sender:** the sender identity is inside the ciphertext only.
- **Group pseudonyms** rotate per epoch.
- **Still exposed (stated, not hidden):** the IP pairs of inbox nodes, timing and volume. Hosted inbox operators see token arrival patterns.
- **Unlinkability:** COMB makes no unlinkability claim, because no TAM slice exists (critic §4.5; `pq-tungsten.md` §6). The mixnet and Veilid rungs (§5) are the only stronger option, and they are optional.

**Allowed claim wording**, gated on the P1 receipts: local encrypt/decrypt, rekey-on-ban, KAT and DIFFERENTIAL (`pirate-haul-rulings.md:19`):

> "Messages in a private COMB room are end-to-end encrypted between the members' devices with post-quantum key agreement (X-Wing) and ML-DSA-65 sender checkpoints at suite 0x0001, pinned engine <id@sha>. This is sound by construction. It does not hide who talks to whom from network observers, and a member who leaves can read until the next rekey."

Until those receipts exist, the claim is **none**. Open rooms carry integrity only.

---

## 5. Roads and transport

**The phone-to-inbox link (Comb Link).**
- One connection from each device to its owner's inbox node.
- Device authentication is an ML-DSA-65-signed challenge, made once per session.
- No gossip, no presence fan-in.
- Idle cost is keepalives only: one connection, 100 B every 30 s, comes to **288 KB/day**. The x0x idle figure is 75 GB/day (CLAIMED).

**Inbox-to-inbox links.**
- Direct authenticated streams, opened on demand and pooled. This is the federated-mail shape.
- Each node keeps about 50 warm peers, which costs about **10.4 MB/day** (50 × 3,456 pings × 60 B).
- Rooms of 32 or fewer member inboxes get direct fan-out from the sender's inbox.
- Larger E2EE rooms use room-scoped batched gossip **[AMEND]** (X-C below) or, lawful-minimal, a fan-out tree among member inboxes.
- Open rooms of more than 1,500 leaves publish signed batches to Autonomi. Readers fetch those batches themselves; cache relays only speed this up.

### x0x's exact roles

| Road | Use | Gate |
|---|---|---|
| Machine plane | Agent-to-agent machine coordination and capability cards | Lawful today |
| X-A | Owner-private x0x network: the owner's 2–5 machines with no public seeds. Device link and owner sync ride x0x streams | **[AMEND]** plus a receipt that the node sends 0 B to public seeds in 24 h, with presence confined to the owner's machines |
| X-B | Inbox-to-inbox ciphertext over x0x **byte streams**, not pubsub, so there is no per-frame ML-DSA envelope (#656 cites a "~10.31 KB floor per eager frame", CLAIMED) | **[AMEND]** plus a receipt that a peer outside the public mesh can be dialled by address hint (UNVERIFIED; `up/cons/A05…:25`), or upstream presence scoping |
| X-C | Room-scoped gossip for large E2EE rooms, batched at most once per second per frame | **[AMEND]** plus cell isolation plus the app-level gap repair below |

### The measured blockers and how COMB answers them

| Blocker | Answer |
|---|---|
| **Single global presence topic** (`up/adr/0049-presence-foaf-discovery.md:37-38`) | No COMB node joins the public x0x mesh. If one beacon per 30 s carries the 10.31 KB floor (CLAIMED), a cell of N nodes receives N × 29.7 MB/day: 267 MB/day at N=9 and 7.6 GB/day at N=256. So x0x cells are owner-private only, unless upstream lets presence be scoped or switched off. That ask goes upstream through the V6 thin-client fork seam (`pirate-haul-rulings.md:18`). COMB presence is per contact, pull-based and visible only to one's own inbox |
| **UDP only** (`up/cons/A05…:33`) | x0x is never the only road (amendment clause 4) |
| **2–5 machine scope** | X-A sits exactly inside it. Scale comes from many independent small links, never one mesh |
| **Store delivery failing under shedding** (`2026-10-15-pq-net-store-http-status.md:71-89`; fix PR saorsa-gossip #115 still OPEN) | COMB never uses the x0x store for delivery. Delivery is an outbox stream plus an application ack (§6). Gaps are detected by sender-chain `seq` and repaired by pulling identical bytes from any member inbox. That repair is needed because x0x gives no gap markers (#869) |
| **No RFC 9420 interop; rekey-on-leave incomplete** | §4 |

### Censorship ladder

Every path climbs as far as needed, and every receipt says "connected via rung N" (the built pattern in `C:/Users/travi/b-onboard/src/ladder.rs:1-13`).

| Rung | Road |
|---|---|
| 1 | QUIC/UDP 443: a non-x0x stack, or x0x **[AMEND]** |
| 2 | TLS 1.3 over TCP 443 (WSS or HTTP/2) to the inbox, by IP or a neutral name |
| 3 | Cache-relay roads: many hosts and domains, from the room's signed road list |
| 4 | Obfuscated transport, obfs4/Snowflake class (ruled a standard rung: `pirate-haul-rulings.md:20`) |
| 5 | Veilid or mixnet (feature-gated) |
| 6 | Delay-tolerant bundles: file, QR, local BLE |

- **Content does not depend on the road's crypto.** Content confidentiality never rests on the road; a road's PQ handshake protects only metadata.
- **VPNs are never an onboarding step** (`SPEC-BUZZ-MULTIRELAY-1.md:54-59`).

### Community identity is not a DNS name

- **A room is its genesis id:** a SHA3-256 hash of the room genesis op, signed by the founder's `bzpq1` key.
- **Room authority** signs the road list, which is pure transport, as in `SPEC-BUZZ-MULTIRELAY-1.md:38-50`.
- **Invite links** carry room id, roads and a pairwise admission token.
- **A blocked name is one dead road.** It can no longer take the system down. This is the DNS-independence test (`2026-10-13-bnr-dns-independence-routing.md:52-57`).
- **Inbox hints are signed by the contact key** and exchanged at first contact. There is no directory (`bzdid-architecture-decision.md:390`; ADR 0006). A substituted hint fails its signature.

**Relays become two roles:**
- **bootstrap seeds**, which give NAT and first-contact hints only, under rate limits;
- **caches**, which hold ciphertext byte-days paid for by whoever registered them.

Neither role is ever the record: "the relay can be shut down and all durable data is still readable" (`SPEC-PAY-ONCE-NOW-1.md:82-83`). Relaying for NAT'd nodes follows ADR 0035's earned promotion (`up/adr/0035-relay-decentralization.md:69-78`), metered to the party being relayed.

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**System of record: the users' own devices.** "Local-first is the only durable write path" (`SPEC-PAY-ONCE-NOW-1.md:65-67`).

**Delivery states** follow the exec core's discipline: `ADMITTED` (sender's outbox) → `SENT` (on road r) → `HELD` (recipient inbox, durably acked) → `DELIVERED` (recipient device, durably acked). A missing ack is **UNKNOWN**, never success. Retries re-deliver **identical bytes only** (`2026-10-12-btmd-mesh-dependability.md:38-43`). Past its TTL a message is **EXPIRED**, and the sender sees that.

**"Durably acknowledged"** keeps the §2.4 meaning: fsync-complete on two stores in distinct failure domains (`SPEC-RUSTEOSVM-1.md:65-71`).
- The outbox is stored on the sender's device and inbox node.
- The inbox is stored on the inbox node plus one of the user's own devices, or a second provider.
- A single-store provider must say so. Senders then keep their copy until DELIVERED.

**Offline delivery.**
- The recipient's inbox holds ciphertext for a TTL the recipient sets and pays for. The default is 30 days (A2, PROPOSED).
- The sender keeps its own copy until HELD.
- If the recipient's inbox is down, the sender retries, and room cache roads may hold a copy under a byte-day lease.
- In the free phone-only mode the sender holds the message until both phones are online together, with latency stated as unbounded.

**Retention.** Each message carries `retain: persistent | until-read | ephemeral` plus `forgetAt` (`SPEC-BCHAT-1.md:64-72`). RETAIN/FORGET is publication-consent routing, not deletion: FORGET prunes local stores and reports what it did, and nothing is promised about copies others hold (`GLOSSARY-BRIDGE.md:34`). Defaults: `persistent` for 1:1 and small groups, `until-read` plus 30 days for open rooms.

**Archive (batched, user-paid).**
- Monthly SPEC-BPQ-1 sealed objects: AES-256-GCM, slots carry no reader id (`SPEC-BPQ-1.md:162`).
- Each archive root is OTS-anchored, renewed under a new hash before the old one weakens (`SPEC-BPQ-1.md:120-125`).
- Routing: 256 KiB or more goes to ANT, less goes to AR (`BUZZ_A_METERING_SPEC.md:127`).
- **Batching is the lever.** At MID (§7), a year of one user's traffic is 697 MB:
  - monthly batches: 168 chunks ≈ **$0.59/user-yr**;
  - one file per day: 3-chunk minimum ≈ $3.83/user-yr;
  - Arweave per byte: ≈ $21.13/user-yr.
  - Prices: $0.0035/chunk and $32.56/GiB, one date each (`scale.md` rows 27, 30).
- A room-level persistent archive has **one named payer of record**: the member who opts in. It is never pooled (E11).

**BNRoSe reuse, with no rival journal.**
- **Consumer crate.** A new `bchat-comb-journal` crate consumes `bnrose-exec-host` and reuses `ReplicatedJournal` and `SupervisorKeys` (`journal.rs:260-422`). This follows the established consumer pattern (`2026-10-15-bnrose-browser-recovery-acceptance.md:14,83`).
- **Day segments.** `run` reloads both full replicas (`opexec.rs:235-240`). So COMB opens one journal per UTC day per mailbox, and each segment's first record carries the previous segment's final tag. If ZCode wants this inside the core, that is a one-line proposal.
- **Codes.** Delivery codes stay in the door's own file, outside `E_*`.
- **Authority-bearing messages** are BNRoSe operations: approvals (WF-08), grants and payments. Each is a WB001 envelope under `bpq1/intent`, admitted with `E_STEP_ADMITTED` (`memory/fable-seat-policy-selected-senders.md:17-19`).
- **Not reused:** the wasm verdict sandbox, which is the core's verdict function only (`bnrose-exec-wasm/src/lib.rs:1-33`).
- **Carried gap:** the two replicas are files in one directory today (`opexec.rs:103-108`). COMB acceptance needs the two-host receipt (PR #444, open).

**Eternal Computer leg.**
- The journals are **L2** (deterministic replay of delivery state).
- The archive is **L1**.
- Agent compute in rooms is **L3**.
- Transport itself serves no leg. It is declared a bChat Adapter-layer document, under the "don't bend a taxonomy" precedent (`RULINGS_8C…:59-65`).

---

## 7. Scale

### Declared workload model (all ASSUMPTIONS; no ruling gives a messaging rate)

N = 10^10 people. Agent traffic counts inside the owner's M. Body is 200 B, padded to 256 B.

| | LOW | MID | HIGH |
|---|---|---|---|
| M msgs sent/user/day | 10 | 50 | 200 |
| Group mix: 1:1 / small / large (mean size) | 70% / 28% (6) / 2% (200) | 60% / 35% (8) / 5% (500) | 50% / 40% (12) / 10% (1,000) |
| Mean recipients per message | 6.08 | 28.0 | 104.8 |
| Devices per user D | 2 | 3 | 5 |
| m̄ messages per checkpoint | 2 | 4 | 16 |
| B per delivered copy | 2,224 | 1,317 | 637 |
| Messages/s (average) | 1.157e6 | 5.787e6 | 2.315e7 |
| Inbox-tier traffic, average / 3× peak | 0.13 / 0.38 Tbps | 1.71 / 5.12 Tbps | 12.4 / 37.1 Tbps |
| Device-tier traffic (× D, at users' own access links) | 0.25 Tbps | 5.12 Tbps | 61.8 Tbps |
| Received per user per day | 61 msgs, 0.14 MB | 1,400 msgs, 1.84 MB | 20,960 msgs, 13.3 MB |
| Hot inbox, 30 days × 2 stores | 8 MB | 111 MB | 801 MB |
| Retention default / replication | 30 d / 2 stores + optional archive | same | same |

Arithmetic check for MID: 10^10 × 50 × 28 = 1.4e13 copies/day; × 1,317 B = 1.84e16 B/day; ÷ 86,400 × 8 = **1.71 Tbps**.

### What is never global

COMB has no global presence, directory, log, room or CRDT, each of which `scale.md` §3 rules out by arithmetic. Every node's state is O(its own users + its rooms). Chain bytes per user and per message are 0. On-chain state is only what is already ruled O(1): `bzdid` 148,156 B.

### Connection model, which binds before bandwidth

At MID, 3e10 device links end at inbox nodes. Assume 90% of users take hosted inboxes (A3). At "100k+ connections" per box (CLAIMED, `LOADMODEL-1M.md:91`), that is about **270,000 boxes** run by many independent operators. The figures for LOW and HIGH are 180,000 and 450,000. The other 10% self-host (A3).

A MID hosted box serving 33,333 users takes in 6.15e10 B/day (≈ 5.7 Mbps) and has about 3.7 TB of hot store. It is bound by connections, not bandwidth, which matches `scale.md`.

### Mobile and push

Phones hold one link (288 KB/day idle). How they wake:
- **(a)** OS-scheduled background fetch;
- **(b)** UnifiedPush, which can be self-hosted;
- **(c)** opt-in, content-free APNs/FCM pings sent by the user's own inbox (E15).

Without (c), iOS delivery happens when the app is opened. That limit is stated in the UI.

### Sharding and federation

There are no shards to coordinate. Each user's inbox and each room's member set is its own unit, the same way mail scales. Relaying for NAT'd nodes follows earned promotion (ADR 0035).

### Verify-CPU budget

No estate receipt exists (`scale.md` §5). Budget for a device:
- verifies per day = received / m̄ + commit verifies;
- MID: 1,400 / 4 = 350 ML-DSA-65 verifies;
- HIGH: 20,960 / 16 = 1,310 verifies.

**Gate, named before the run:** at most 10 s of CPU per device-day at HIGH. That requires a verify cost v ≤ 7.6 ms on the slowest supported phone.

Inbox nodes do **no per-message PQ verify**. They check one ML-DSA signature per session or connection plus an HMAC mailbox token.

Receipt plan (P0.1): a bench of RustCrypto `ml-dsa` 0.1.1 and libcrux, on the Windows box and on Hostinger. Results are MEASURED with no extrapolation (the precedent is `2026-10-12-bnrose-rust-001.md:146-147`). A phone row is added in P5.

---

## 8. Economics

The payer of record is named per resource. Units are physical, with A as the unit of account. b never appears (B1, `BUZZ_A_METERING_SPEC.md:39-53,80-82`).

| Resource | Payer of record | Free path |
|---|---|---|
| Device CPU, battery, bandwidth | the user (own hardware, unmetered) | always |
| Self-hosted inbox | the user (own hardware) | yes |
| Hosted inbox: StorageByte-days, NetByte, CpuMicrosecond | the user, through a 30-day reservation bought via bPay | — |
| Outbox and retries | the sender (own device and inbox) | yes |
| Cache-relay byte-days | whoever registered the cache (recipient or room archive payer) | optional |
| NAT relaying (earned relays) | the party being relayed, NetByte | direct paths are free |
| Archive (ANT/AR) | the user, or one named room payer | optional |
| Bootstrap seeds | BNR. These are the only standing cost, and Art. V.1 allows them (`CONSTITUTION.md:83`) | — |

**Free tier.** It needs a free bzDiD plus either phone-only mode or the user's own always-on hardware. It costs BNR 0 per user and needs no float (Rail C). A zero balance on a hosted inbox is a named `FloorRefusal` for new HELD storage, never a top-up (`BUZZ_A_METERING_SPEC.md:109-112`). Senders keep their copies, and the user sees "inbox unfunded".

**Spam.** First contact from a non-contact goes to a request queue. A request:
- carries a proof-of-work stamp (A4: about 2 s of phone CPU);
- or skips the stamp with an introduction from a mutual contact.

The queue has a per-recipient quota of 50 requests/day with an overflow count. Honest limit: 1M stamps is about 23 CPU-days, which is cheap for a botnet. So the **quota and contact gating** are the real fence, and PoW is friction. Postage stays escalated (E12).

**Ten-billionth-user test.** Every per-user cost above lands on that user or the user's chosen counterparties.
- **Seeds.** Seed load per new user is bounded by rate limits. Invites carry roads, so a new user can bootstrap from contacts with no seed at all. The seed count does not grow with N.
- **Hosting.** BNR hosts no inbox, cache or relay. The legacy relay retires (E10).
- **Result.** The marginal cost to BNR of user 10^10 is **0**. **PASSED by construction.** The receipt plan is a negative control: one funder settling two users' inbox reservations must FAIL (`BUZZ_A_METERING_SPEC.md:107-108`).
- **Indicative user costs at MID** (one quote, one date):
  - hosted inbox ≈ $0.036/user-yr, from a $101/mo box shared by 33,333 users (`LOADMODEL-1M.md:87`, CLAIMED);
  - archive ≈ $0.59/user-yr.
- **No tithe is added.** A tithe comes only by founder word (`LANE_M_B_METER_2026-08-29.md:5`).

---

## 9. Moderation and abuse

- **Rooms govern themselves.** Removing a member is a Remove commit plus a rekey. Reports go to room authorities as "signals, never triggers" (`BZ/VISION_MODERATION.md:39`).
- **Nothing global.** There is no universal reputation score and no global blocklist (`CONSTITUTION.md:107`; `BZ/docs/nips/NIP-IA.md:41`). Users and rooms subscribe to signed moderation lists they choose. Cache operators may refuse frames by their own hash lists, as their own policy. The kernel stays blind to spam (`BIND-1.md:108`).
- **Agents** never read untrusted text in the same context as write authority (AGENT-1 Q-2). Tool scope quarantines prompt injection (A-8).
- **Platform safety at 10B with no operator is unsolved, and COMB says so.** Private content is permanent only if the user archives it, sealed and user-held. Public permanent channels ship only after counsel review of illegal content, takedown and GDPR Art. 17 (E14).
- **No biometric processing** in rooms (P-3, B-2, B-4).

---

## 10. 1,000-year continuity

**Crypto agility.**
- Suites are added, never redefined.
- A room changes suite by a **re-init**: a new group whose genesis points to the old one, after every member device advertises support. Both stay readable.
- If ML-DSA-65 retires, devices hand over through SLH-DSA (`SPEC-BPQ-1.md:190-209`). Checkpoints may then run on SLH-DSA: framed 50,174 B, amortized at m̄=64 to **1,194 B per message**. Expensive, but it survives.
- HQC joins as a second KEM family once FIPS 207 is final (`SPEC-BPQ-1.md:268-269`).

**Re-anchoring history.** Archives use symmetric encryption only (AES-256-GCM). Each root is OTS-stamped and renewed under a new hash before the old one weakens (RFC 4998 model). An archived signature proves something only if its anchor predates the break (`SPEC-BPQ-1.md:120`). Renewal is the user's inbox node's job, paid by the user.

**Formats.** CMB1 is versioned magic with frozen decoders. Each archive bundle carries its spec hash and test vectors. Acceptance: an airgapped verifier rebuilt from the spec alone reads a 10-year-old bundle (`pirate-haul-rulings-2026q3.md:86`).

**Time (L4).**
- `ts_ms` is u64 milliseconds, good to about year 584 million. It fails closed above a declared ceiling.
- Every foreign-clock mapping is a test row: Nostr u64 seconds, CanonicalEvent i64 seconds, Antelope u32 for metering receipts (2106-02-07, `SPEC-BTUNGSTEN-1.md:136-139`). Each mapping is refused before it wraps, and a truncating encoder must be convicted (WB004 precedent).
- Order comes from `seq`; `ts` is advisory.

**Protocol upgrade governance.**
- **Approval.** A wire change needs an RFC, a reference implementation and passing tungsten families before any vote (Art. VI §3, `docs/article-vi-s3.md` §3.1), plus a signed suite and road law file.
- **Mixed versions.** Nodes advertise supported versions in signed capability cards and negotiate the highest common one. Old peers fail closed, and deprecation windows are measured in years (`CONSTITUTION.md:92`). There is no flag day: a room that cannot upgrade forks with a pointer.
- **Releases.** Builds are pinned and hash-verified under mirror-by-law (`pirate-haul-rulings.md:12`), and x0x self-update stays off (`ops/x0x/hostinger/README.md:16-24`). Who may add a second release signer is open (`2026-10-09-pq-status-verification.md:290-292`).

**Extinction drills**, each one a test row (L1, `SPEC-BTUNGSTEN-1.md:104-108`):

| Extinct thing | Pass condition |
|---|---|
| x0x | rooms continue on rung 2 or above |
| Every DNS name | invites and road lists still work |
| BNR seeds | contacts bootstrap from invites |
| A hosted inbox provider | the user moves the inbox by a signed hint update; senders follow |
| ML-DSA-65 | SLH-DSA checkpoints |
| X-Wing | suite re-init |
| Autonomi | archives re-home to Arweave or another rail |
| Vaulta | metering adapter swap |
| BNR as an organization | "another conforming client resumes from independently verifiable state" (`memory/…order.md`) |
| The UI | buzz-cli alone operates a room |

---

## 11. Tungsten conformance matrix

All of these are **named receipts to earn**. None exists yet. Pass/fail criteria are fixed before any run, and verdicts are computed from observations. CI's run on the landing commit is the receipt (`SPEC-BTUNGSTEN-1.md:420-427`).

| Axis / law | Test family | Pass / fail, named now | Evidence class | Teeth (same job) |
|---|---|---|---|---|
| 1 Decentralization | TF-REMOVE: kill seeds, the legacy relay, DNS, x0x, one hosted provider, the BNR org | Pass: 100% of HELD messages reach DELIVERED after reconnect, and new sends succeed within 120 s on a surviving rung, with no operator act. Fail: any loss or any manual step | MEASURED, multi-host netns, then the rung ladder | A planted "seed-required" code path must fail the drill |
| 2 Sybil/MiM | TF-HINT, TF-REPLAY, TF-FORGE, TF-SPAM | Pass: substituted hint, replayed frame, insider forgery and out-of-chain message are each refused or marked FORGED; queue quota holds under a 10^6 flood. Unlinkability only inside a published TAM (none yet: NOT-RUN) | MEASURED, plus a PROVE obligation on chain/checkpoint binding | T-VACUOUS: an empty checkpoint, zero-leaf Merkle or empty token set must be refused. T-TRUNCATE: change only the last byte at lengths 0, 1, 255, 256, 257, 4096 |
| 3 Healing | TF-HEAL: kill the inbox mid-ack, corrupt one journal replica, partition, mixed versions | Pass: recovery from the survivor, UNKNOWN stays UNKNOWN until evidence, identical-bytes redelivery, 0 duplicate authority effects | MEASURED | A planted re-sign-on-retry must be convicted |
| 4 Learning | TF-ROAD-LEARN: road memory learns the last-known-good rung | Pass: it never learns a lower suite, a plaintext road or a dropped checkpoint; every change is receipted and reversible | MEASURED | A downgrade-offering network must be refused |
| 5 >10B | TF-SCALE: §7 math bounds plus rungs of 9 → 100 → 1k → 10k nodes, never skipping (`LOADMODEL-1M.md:137`) | Per node idle wire ≤ 50 MB/day (inbox) and ≤ 1 MB/day (phone link); verify ≤ 10 s CPU/device-day at HIGH; connections per box measured, not quoted | MEASURED; "a single-host test is not a mesh result" | A budget breach must turn the gate red |
| 6 1,000-year | TF-ERA: suite re-init, SLH-DSA handover, airgapped archive read, OTS renewal | Pass: the old room is still readable, the new suite is required, and the archive verifies from the spec alone | MEASURED + KAT + DIFFERENTIAL | A verifier that defaults an unknown suite must be convicted |
| L1 | TF-EXTINCT (the §10 table) | Each extinction row passes | MEASURED | — |
| L2 | TF-SHORT: grant expiry ≤ 30 d; frame TTL | A 1,000-year grant and an expired grant are both refused | MEASURED | — |
| L3 | TF-BOUND: node state is O(own users + rooms) | No population-scale table at any primitive (measured growth) | MEASURED | — |
| L4 | TF-CLOCK: every foreign-clock mapping at its boundary ±1 | Fails closed before the wrap | CHECK-SAMPLED, then PROVE on the encoder | A truncating encoder must be convicted |
| L5 | TF-BOOT: inbox boot EXPOSURE → IDENTITY → PEER → AGREEMENT | A node advertises hints only after a measured, acked round trip; configured peers are not connected peers | MEASURED | A config-only "ready" must be refused |

**Formal obligations.** CMB1 canonical-encoding injectivity climbs the WB001 ladder in order (`SPEC-BTUNGSTEN-1.md:285-295`):

> RED counterexample corpus → accepted-language repair → shared Rust/JS vectors → Cryptol spec → TYPECHECK → CHECK-SAMPLED → PROVE-UNIVERSAL (SAW over the fixed-shape encoder) → EQUIVALENCE.

Further obligations:
- the new labels join `domainsDisjoint`;
- `checkpointBindsChain`: a checkpoint commits to every message in its seq range;
- input boundary: ill-formed UTF-8 is refused at decode (`:256-267`).

The group engine is held to KAT plus DIFFERENTIAL rows (INHERITED only at a pinned third-party proof).

---

## 12. Migration from today's Buzz

1. **Now, with no protocol change.** Attach §5b ML-DSA attestations beside Schnorr events (`SPEC-BPQ-1.md:211-227`), labelled classical at the relay. Inventory the Hostinger Postgres history and relay image, read-only (critic §6.5).
2. **A local Nostr facade on each inbox node** (x0x-nostr-bridge prior art, 127.0.0.1; `up/bridge-README.md:3-9`). buzz-acp, buzz-cli and the desktop connect unmodified. NIP-42 runs against the loopback origin, which takes the DNS name out of AUTH (`bridge.rs:225-232`). Transient denials are always `error:`-prefixed, because buzz-acp treats any other denial as terminal (`buzz-acp/src/relay.rs:3804-3806`). The bridge's four pre-deploy gaps must close first (`up/bridge-README.md:74-94`).
3. **The 18 agents** each get a COMB leaf under an explicit grant. Each old npub becomes a bound persona by bidirectional link (`CONSTITUTION.md:52`). Authorship is never rewritten (`BZ/docs/nips/NIP-IA.md:25-27`). Cutover is one agent at a time, with rollback to the relay road.
4. **History.** Each community's Postgres log is exported to monthly sealed bundles, signed by the room authority, with original NIP-01 bytes preserved. Media goes to Autonomi descriptors, and old `skaists.buzz/media` links are mapped by hash.
5. **The relay** becomes a cache plus legacy road, then retires on the founder's date (E10). `skaists.buzz` stays the brand and one road (E19). Scope stays the founder's four devices plus Hostinger until he widens it (`memory/founder-no-pr-no-local-server-live-check.md:11`).

---

## 13. Build plan

| Phase | Owner seat | Reused | Acceptance (receipts) | Unblocks |
|---|---|---|---|---|
| **P0, now, no ruling** | Claude Code seat (docs, tests), x0x lane (rig), ZCode (seam review) | btungsten-pq, WB001 ladder, the 9-node WSL rig | (1) PQ bench receipt for ML-DSA-65, ML-KEM-768 and X-Wing on Windows and Hostinger, no extrapolation. (2) CMB1 spec, RED corpus, Rust and JS vectors, Cryptol model. (3) Rig run with **synthetic machine-plane traffic only**: idle wire bytes for an owner-private 2-node network vs 9 nodes; whether x0x byte streams are subject to shed; dial by hint without public seeds. (4) Read-only Hostinger history inventory | Engine choice; X-A/X-B feasibility; verify budget |
| P1, lawful-minimal alpha | bChat lane (zCode) plus ZCode for the consumer crate | bChat Core, `ReplicatedJournal`, bpq-core | Two-host delivery drills (TF-HEAL, TF-REMOVE); KAT and DIFF for the group engine; local encrypt/decrypt and rekey-on-ban receipts (`pirate-haul-rulings.md:19`); ladder receipts from the filtered building network ("rung N") | The first claim wording (§4) |
| P2, Buzz compat | Buzz lane | x0x-nostr-bridge pattern | buzz-acp, buzz-cli and desktop pass against the facade; 18 agents migrated with grants; zero terminal-AUTH events | Retiring the relay as the record |
| P3 **[AMEND]** | x0x lane | x0x pinned and hash-verified | X-A and X-B: 0 B to public seeds over 24 h; idle within budget at the wire; 100% HELD under `shed_normal` with app-level ack | x0x as a road |
| P4 **[AMEND]** | x0x lane + bChat lane | saorsa-gossip (only after PR #115 lands) | X-C room cells with batching; gap repair under shed | Large E2EE rooms |
| P5 | Metering lane (founder gates MX-*, Jungle-first) | `shared-types` SpendReceipt, bPay | Shared-funder negative control FAILS; FloorRefusal is visible | Hosted inbox market |
| P6 | Archive lane | ant-pay, OTS, adapter-arweave | Airgapped verifier reads a bundle; OTS renewal; extinction drills | TF-ERA, L1 rows |
| P7 | Scale (box-gated) | btmd harness | 100 → 1k → 10k nodes, no skipped rung | Axis 5 evidence |

---

## 14. Open questions and risks

1. **[AMEND] A-1** decides only whether roads X-A, X-B and X-C exist. Everything else stands either way.
2. **x0x feasibility** rests on three unmeasured facts: presence scoping, dialling outside the mesh, and stream shedding. Upstream has a single maintainer (`up/adr/0116…:4`; critic N10). If any fails, x0x stays machine-plane only, at little cost to COMB.
3. **Amortized authentication departs from MLS.** The insider window is up to 60 s, shown as "provisional". It needs its own proof and an outside review. The fallback is signing every message (4,037 B).
4. **Group engine.** saorsa-mls has no RFC 9420 interop. A second PQ MLS implementation is UNVERIFIED. E2EE rooms are capped at about 1,500 leaves.
5. **Numbers.** Every figure moves with the §7 workload table and A2–A4, and no ruled messaging rate exists. The 270k-box figure is no stronger than the CLAIMED 100k connections per box.
6. **Honest limits.** No unlinkability claim without a TAM. Phone-only latency is unbounded, and iOS without push delivers on open. Losing both the RP domain and `r1` loses the identity.
7. **Founder and counsel gates:** E11, E12, E13, E14, E16.
8. **Carried gaps.** BNRoSe replicas share one host and nothing in BNRoSe is PQ (`bnrose.md` §8). The PLANE LAW full text has not been located, the sovereign order exists only in memory, and the Constitution header still reads DRAFT. Those citations are RULED-as-recorded.
