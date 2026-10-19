# STRATA: PQ Buzz as a millennium envelope (design, millennium-first angle)

Design round 2026-10-15. Status: DESIGN ONLY. Nothing here is built, run or conformant. A design may name the receipts it will earn and may never claim the title (`R/docs/dispatches/2026-10-06-btungsten-lane.md:45-47`).

Citation keys: `R/` = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`); `BZ/` = `C:/Users/travi/buzz-src`; `LD/` = `C:/Users/travi/LOVErnment-DAO/specs`; `UP/`, `N/` = the scratchpad `pqbuzz/up/` copies and the nine reader notes; `MEM/` = auto-memory. Classes: RULED, MEASURED, SOURCE (read in code, nothing run), CLAIMED, UNVERIFIED, ASSUMPTION (an input I chose), ARITH (my arithmetic, shown).

---

## 0. Thesis

**STRATA** treats a conversation as layered evidence, not as traffic. Each message is a small binary record in one canonical format, `bzm1`, proposed as bChat Core envelope v2. Records chain by SHA3-256 per sender, so one ML-DSA-65 + Ed25519 "seal" signs many messages. Monthly sealed bundles go to storage the user pays for, and hash-only evidence records (OpenTimestamps on Bitcoin, optionally a BCH OP_RETURN, plus an Arweave copy) prove each bundle existed before any algorithm it depends on was retired; they are renewed under new hashes before the old ones weaken, on the RFC 4998 model (`R/docs/specs/SPEC-BPQ-1.md:120-125`). Algorithm ids are added and never redefined, retirement is an additive record, every released format keeps a frozen decoder, and an airgapped verifier, a zero-import wasm build and the spec text are archived beside the data. Time is a counted integer that fails closed at its representation boundary. Identity is the bzDiD root, plus the bpq1 hash-based succession key for algorithm eras, plus a written-code floor that survives domain loss. A drill program kills DNS, relays, x0x, Autonomi, Arweave, ML-DSA, SHA-256, the client, the clock and the org, one at a time and then together. Relays are mailboxes that users pay for; x0x carries machine-plane traffic only until the founder flips one road switch; BNRoSe carries the paid archive effect. The first receipts are lab receipts that need no ruling (§13 P0).

---

## 1. Plane mapping and escalations

The mapping under the current ruling (PLANE LAW, `R/docs/ledger/pirate-haul-rulings.md:18`):

| plane | role in STRATA | never |
|---|---|---|
| Human (Buzz) | `bzm1` conversations between humans and owner-bound agents. Relays are roads and mailbox caches | system of record (`R/docs/SPEC-PAY-ONCE-NOW-1.md:65-67`) |
| Machine (x0x) | agent-to-agent coordination only. Any decision that affects humans is re-issued as a signed `bzm1` message by the agent's owner-bound key (X-2) | human messages; holding records (X-1); being needed to preserve data (X-3) |
| Durable (Autonomi) | sealed monthly bundles of 256 KiB or more (`R/docs/dispatches/BUZZ_A_METERING_SPEC.md:127`) | the only copy |
| Permanence (Arweave) | bundles under 256 KiB, evidence records, Rosetta text, the spec, verifier binaries | private plaintext |
| Settlement (Vaulta A via bPay) | metered mailbox and archive spend, paid by the user | per-user or per-message rows (`R/docs/bzdid-architecture-decision.md:61`) |

**BNRoSe legs** (`R/docs/SPEC-BNROSE-0-CHARTER.md:36-39`):
- Bundles and evidence records are **L1** (eternal data).
- Frozen decoders, chain replay and the airgapped verifier are **L2** (eternal runtime).
- Live delivery fits no leg. Under "Don't bend a taxonomy" (`R/docs/dispatches/RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md:59-65`), STRATA places it as a kernel adapter (E17).

**ESCALATIONS.** Each collision is named, and STRATA stays lawful without any ruling.

| # | collision (cited rule) | what STRATA does with no ruling | what changes if ruled otherwise |
|---|---|---|---|
| E1 | "Buzz over x0x" vs PLANE LAW, X-1, X-3 (`pirate-haul-rulings.md:18`) | no human message touches x0x | **Road switch**: `x0x-pubsub` becomes one road carrying opaque `bzm1` outer envelopes on rotating mailbox-tag topics. It still never holds the record. Prerequisites: a released store-propagation fix (saorsa-gossip #115 is open, N/x0x.md §3), a leaf-budget receipt, and phones never full peers. No format change |
| E2 | Buzz "NEVER a storage/permanence/privacy ... layer" (`:17`) | encryption is bpq1, storage is user-paid Autonomi/Arweave, and the Buzz relay is only a road | naming only |
| E3 | a competing messaging stack. SPEC-BCHAT-1 is canon (`R/docs/specs/SPEC-BCHAT-1.md:1-6`); "start no competing ... system" (MEM/sovereign-operating-environment-order.md:14) | `bzm1` = bChat Core envelope v2; v1 JSON is read through a frozen decoder | rename only |
| E4 | a new seal signing kind vs the bsigner freeze (`R/crates/bsigner/CONTRACT.md:3-7`) and "THE signer name" (`:49`) | lab seals use the frozen `bsigner sign` (`bheart.signature/1`) with a seal-only keyset, so key use is separated rather than labelled | (a) a bsigner seal command under `bzm1/seal`, or (b) seals signed in the client library |
| E5 | the bzDiD root has no hash-based key: `KeyAlg {ed25519, ml-dsa-65}`, "added BY RULING" (`R/crates/bzdid/src/genesis.rs:36-44`), vs L1 "no dependence remains on ANY original ... algorithm" (`R/docs/specs/SPEC-BTUNGSTEN-1.md:104-108`) | algorithm-era succession uses the bpq1 SLH-DSA handover (SPEC-BPQ-1 §5) | add `slh-dsa-shake-256f` to `KeyAlg`, so r1 can be hash-based |
| E6 | a domain-bound key ranks highest. "the lower `signedBy` index wins — r0" (`R/crates/bzdid/src/succession.rs:44-47`); r0 is WebAuthn PRF-derived (`bzdid-architecture-decision.md:49`); "WebAuthn alone does not survive losing the original domain" (MEM order :24) | messaging authority never requires r0; drill D13 | re-rank keys, or move r0 off a domain. My analysis, UNVERIFIED by test: whoever captures the RP domain *is* that origin, so they can ask the user's authenticator for r0, and r0 then wins every fork |
| E7 | postage vs "No person pays to *use* a BNR function" (`R/docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`) | inboxes are contacts-only. A stranger needs an invite, or postage in StorageByte-days/NetByte, which is a resource charge and never access | invites or proof-of-work only, with weaker spam control |
| E8 | standing relay cost: Art. V.1 (`R/docs/CONSTITUTION.md:83`) vs "Buzz's own A pays ... its relay" (`BUZZ_A_METERING_SPEC.md:105-106`) | BNR runs only capped bootstrap seeds that serve road records, never mailboxes | a ruled BNR mailbox tier with a quota and `FloorRefusal` |
| E9 | illegal content on permanent rails (`R/docs/specs/SPEC-BLICENSE-0.md:187-191`) | no public plaintext archive by default; "no deletion promise" (`R/docs/GLOSSARY-BRIDGE.md:34`) | counsel decides |
| E10 | social recovery: "must require the original body" (`R/docs/joint-liveness-coherence.md:174`, CLAIMED-as-ruling) vs a future stage (`R/docs/SPEC-ONBOARDING-IDENTITY-1.md:179`) | not designed. r2 is the user's own second device | a trustee key at the lowest priority, with a delay |
| E11 | vendor push. VENDOR-HELD is enhancement-only (`R/docs/RULINGS-2026-09-30.md:21-27`) | content-free wake hints, with a poll fallback | polling only |
| E12 | a public social graph: `MessageEvent{from_did,to_did}` (`R/crates/shared-types/src/events.rs:212-219`) vs R1 (`R/docs/RULINGS-2026-09-16.md:26-29`); public npub↔bzDiD links (Art. II :52) | MessageEvent stays local and is never anchored; bindings are Selective | an additive MessageEvent v2 with opaque references |
| E13 | which Art. VI tier governs wire upgrades (`R/docs/article-vi-s3.md` §3.3) | the proposal in §10.8; in Epoch 0 the founder decides after the Proof gate | the ruled tiering |
| E14 | who declares an algorithm retired. Axis 4: never "silently rewrite" invariants (`SPEC-BTUNGSTEN-1.md:56-60`) | retirement only as an evidence-backed record that passes the Proof gate; nothing automatic | the ruled authority |
| E15 | community identity as a DNS name: `push.origin` "IT IS IDENTITY, LOAD-BEARING" (`R/docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:74-87`) | `skaists.buzz` stays the brand. Identity = the hash of a signed charter record: an anchor, never a root (`R/docs/VOCABULARY.md:220-226`) | if DNS stays the identity, D1 is red by construction |
| E16 | agents posting: AGENT-1 Q-3 (`LD/AGENT-1.md:160-163`) vs the 2026-08-29 autonomy ruling (N/law-identity-scale.md §7.11) | every agent message cites an expiring owner delegation; Q-3 surfaces stay off for bQueenBee | ruled scope |
| E17 | BNRoSe leg for live delivery (charter `:36-39`) | the placement above | ruled placement |
| E18 | the spent-once handover log is "unowned by design" (N/pq-tungsten.md §5) | proposal: record the handover as a bzDiD rotation op, where equivocation already refuses | ruled owner |
| E19 | the root is SHA-256 forever: `"did:b:" ‖ base32(sha256(genesis_op))` (`genesis.rs:16`), vs L1 | evidence records cover genesis ops under SHA3-256 as well (§10.3) | a v2 root ceremony |

---

## 2. Identity, devices, agents, keys, succession, recovery

- **Root.** The bzDiD (`did:b:`) is the only root (`R/docs/VOCABULARY.md:220-226`). It is free and writes zero chain bytes (`bzdid-architecture-decision.md:59`). Records key off the DID (`R/docs/CONSTITUTION.md:49`).
- **Persona per conversation.** `author_ref = SHA3-256("bzm1/persona" ‖ bzDiD ‖ conv_id)`.
  - It derives from the DID, not a key, so rotation never orphans history.
  - Outsiders cannot link it without `conv_id`, which is 32 random bytes held by members.
  - This matches the Selective/Pairwise default (`R/crates/onboarding/src/lib.rs:113-133`).
- **Devices.** Each device has its own `bzpq1` id, bound both ways to the wallet id (R4, `R/docs/RULINGS-2026-10-04.md:59-66`). The membership record lists the `author_ref` → device-card bindings. Any other bound device, or the wallet, can revoke a lost device.
- **Agents.** An agent holds its own bzpq key under its owner (N/law-constitutional.md #44). Its authority is a delegation record: the owner device's signature, a scope (conversations and kinds), and `expires` at most 30 days out (ASSUMPTION). Renewal is a heartbeat: "Authority expires. Dead-man's switch" (`LD/AGENT-1.md:168`). Revocation is a record the owner signs offline, and any member can carry it (A-10, `:73-74`). The x0x `AgentCertificate` grants no human-plane authority; on the checkout read, "absence of expiry means valid forever" (N/law-identity-scale.md §7.4).
- **Keys.** Persona keys derive from `masterPrk` under frozen labels (`SPEC-BPQ-1.md:39-44`).
- **Succession across algorithm eras.** The bpq1 id commits to a hidden SLH-DSA-SHAKE-256f key (`:19-21`). The handover signature is 49,856 B, once per era (`:196`). ARITH: 1e10 × 49,856 B = 498.6 TB spread across all devices. A user keeping 150 contacts holds 7.48 MB per era.
- **Recovery ladder:**
  1. another bound device;
  2. the wallet re-derives the keys from the passkey PRF;
  3. the r1 written code or 24-word phrase, which is the floor: "the ONLY component that survives platform denial" (`R/docs/ledger/pirate-haul-rulings-2026q3.md:73`).

  WebAuthn is an enhancement, never the floor (E6). "A replacement origin must be authenticated before it receives recovery material" (`R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:41-43`).
- **What a recovered identity can read.**
  - History encrypted only to lost device keys is gone.
  - Archive bundles carry a `self` slot under the root vault key (SPEC-BPQ-1 §2, phrase-only vault). The phrase alone therefore reopens every archived month, with no public-key step. That property is "most likely to survive centuries" (`:15-18`).
  - The wallet seals the bundles. A device without the root seals to the wallet's X-Wing card instead.
- **Uniqueness.** A key is not a human (`LD/PERSON-1.md:36`). STRATA counts no humans and keeps no gallery (`:72`; `LD/BIO-1.md:38`).

---

## 3. The envelope of record: `bzm1` (bChat Core v2)

**Inner record.** This is what gets chained, sealed and archived. The layout is binary and big-endian. Every value has exactly one encoding, and every length is bounded.

| field | bytes | rule |
|---|---|---|
| `"bzm1"` + version 0x01 | 5 | versioned magic; frozen decoder per released layout (`UP/adr/0085-persisted-binary-formats-are-versioned.md` Decision 1-2) |
| suite id | 2 | registry (§10.1); unknown ids are refused (SPEC-BPQ-1 §6) |
| kind | 2 | text, edit, reaction, membership, legacy-nostr, … |
| author_ref | 32 | §2 |
| seq | 8 | per sender chain, +1, no gaps |
| prev | 32 | `SHA3-256("bzm1/chain" ‖ previous stored bytes)` |
| at, time_rep | 8, 1 | §10.6 |
| body_len, body | 4, n | n ≤ 4,096 in the proven shape; bigger content goes by reference |
| extensions | TLV | critical bit: unknown critical → refuse; unknown non-critical → keep the bytes |

- **Sizes.** The header is 5+2+2+32+8+32+8+1+4 = **94 B**, so a 200 B body gives **294 B**.
- **Message id.** `msg_id = SHA3-256("bzm1/msg" ‖ stored bytes)`. The stored-bytes law applies: hash what was handed, never a re-encoding (`R/crates/bzdid/src/genesis.rs:26-30`).

**Outer wire envelope** (all a relay sees): magic + version 5, rotating `mailbox_tag` 32, lease expiry 8, nonce 12, AEAD tag 16 = **73 B** overhead. 294 + 73 = 367 B, padded to the 512 B bucket.

**Seal (signature amortization):** magic 5, suite 2, signer card id + author_ref + conv binding 96, from_seq + to_seq 16, head 32, at + time_rep 9, ML-DSA-65 signature 3,309 (`R/crates/atmirror/src/record_sig.rs:49`), Ed25519 signature 64 = **3,533 B**. The seal signs the chain head, which commits to everything before it. A writer seals after 16 messages or 5 s of quiet (ASSUMPTION). ARITH, bytes per message (padded wire plus amortized seal):

| messages per seal n̄ | 1 | 4 | 16 | 64 |
|---|---|---|---|---|
| bytes per message | 4,045 | 1,395 | 733 | 567 |

Compared with the brief's per-message-signed 3,641 B (N/scale.md §2), n̄=4 is 38% and n̄=16 is 20%. **Archive compaction:** each bundle keeps only the last seal per (author, conversation), because the chain covers everything earlier.

**The gap seals create, stated plainly.**
- *Pairwise:* directional AEAD keys authenticate the sender at once, but only to the other party. That proof is non-transferable.
- *Groups:* any member holding a sender key could forge a message on another member's chain. So a group message shows **unsealed** until its seal arrives, which takes at most about 5 s.
- A record that conflicts with a later seal is refused and kept as equivocation evidence. "Unsealed" is a named state and is never shown as verified.

**Labels.** `bzm1/persona`, `/chain`, `/msg`, `/seal`, `/member`, `/mailbox`, `/archive`, `/evidence`. They are prefix-free against the 14 `bpq1/` labels (`R/crates/bpq-core/src/layout.rs:42-58`), and they join the PQ04 `domainsDisjoint` obligation (`R/docs/specs/SPEC-BTUNGSTEN-PQ-1.md:1012-1013`).

**One format of record, with each other format mapped:**

| existing | relation to `bzm1` |
|---|---|
| bChat v1 JSON (`SPEC-BCHAT-1.md:65-71`) | read forever through a frozen decoder; `policy` becomes a TLV |
| NIP-01 (`BZ/ARCHITECTURE.md:103-114`) | `legacy-nostr` records carry the exact bytes and Schnorr signatures, never re-signed (separate tracks, MEM order :22). NIP-01 is also the classical outer carrier on the Buzz-relay road |
| CanonicalEvent `MessageEvent` (`events.rs:212-219`) | a local projection only; `content_ref` = the bundle address (E12) |
| x0x DmEnvelope | not used on the human plane (E1) |
| WB001 (`R/crates/btungsten-wb001-core/src/lib.rs:47-50`) | the template for the formal ladder (F1); payment intents stay WB001 |
| `bheart.signature/1` | lab seals until E4 is ruled |

---

## 4. Confidentiality and the exact allowed wording

- **Pairwise.** An X-Wing handshake (`SPEC-BPQ-1.md:81-85`), a symmetric hash ratchet within each epoch, and a fresh X-Wing encapsulation (1,120 B) every 50 messages or 24 h (ASSUMPTION). Allowed wording, only after the P1 receipts: *"Message contents are encrypted between the two members' devices under a hybrid post-quantum key exchange (X-Wing) and AES-256-GCM; sound by construction, not audited, not proven end to end."* Nothing proves ML-KEM end to end (`R/docs/dispatches/2026-10-09-pq-status-verification.md:267-268`).
- **Small groups (≤32, ASSUMPTION).** Sender keys over X-Wing slots; a removal rekeys every sender, O(n²) slots in total, bounded by the cap. Allowed wording, after a rekey-on-remove receipt: *"Encrypted to the members in the conversation record; a removed member keeps what they already read."* No MLS claim: no RFC 9420 interop and no BNR TreeKEM receipt (`R/docs/ledger/pirate-haul-rulings.md:19`; N/x0x.md §2).
- **Large and public rooms:** *"Signed, not secret."*
- **Remote-inference agents.** If a cloud model is a member, the conversation states that the model's operator reads it, and the E2EE sentence is withdrawn (`LD/AGENT-1.md:30`).
- **Metadata.** The sender is inside the encryption, slots carry no reader id (`SPEC-BPQ-1.md:162`), mailbox tags rotate per epoch, sizes are padded. Allowed wording: *"Relays see when your device connects, its network address, byte counts, and which rotating mailbox tags it reads. The envelope does not name the sender."* No unlinkability claim, because no TAM slice exists (N/critic.md §4.5).
- **x0x:** no confidentiality claim (`pirate-haul-rulings.md:19`).

---

## 5. Roads, censorship, x0x, relays

- **Road records, not DNS.**
  - A road record is `{kind, address, valid_until}`, signed by the charter key or by the user.
  - It travels in invites (QR or text), in archives, and on any mirror.
  - A hostname may be an address. It never enters the meaning of any signature.
  - "names help people find the system; cryptographic authority determines what the system accepts" (`2026-10-13-bnr-dns-independence-routing.md:90-92`).
- **Ladder.** The built ladder (`C:/Users/travi/b-onboard/src/ladder.rs:3-12`) has four rungs:
  1. direct TLS to any listed address, bare IPs included;
  2. alternate ports;
  3. obfuscated transport (`pirate-haul-rulings.md:20`);
  4. Veilid.

  STRATA adds rung 5, **carry**: outer envelopes exported and imported as a file or QR code, for delay-tolerant delivery. Every receipt reads "connected via rung N" (`ladder.rs:9-11`).
- **Relays are dumb mailboxes.**
  - A relay accepts an outer envelope only with a valid quota or postage token, holds it until the lease ends, and serves it by tag.
  - It signs "held by R at T". That is an observation, never delivery (`R/docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43`).
  - P1 rides today's Buzz relay. Outer bytes go inside a custom kind in a NIP-01 event that a member's npub signs for NIP-42 and membership. That road is labelled "classical outside, PQ inside".
- **x0x** carries machine-plane traffic only (E1).
- **Voice.**
  - Huddles stay server-forwarded with a soft cap of 25 (`BZ/crates/buzz-relay/src/audio/room.rs:47-49`). They are labelled classical, with no PQ claim.
  - x0x voice is two-party only (`UP/README-v0.48.0.md:147`).
  - On-device transcripts are posted as text. No voice comparison is made (B-4, `LD/BIO-1.md:44`).

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**States.** A message moves through: composed → journaled → held-by-k → delivered → archived → anchored. Each state is shown only from a receipt (`R/docs/specs/SPEC-RECEIPT-OBSERVABILITY-1.md:11-22`).

**Durably acknowledged** follows the §2.4 shape (`R/docs/specs/SPEC-RUSTEOSVM-1.md:65-71`): fsynced in the device journal AND held by at least 2 independently operated relays, each able to verify the keyless chain on its own. **Delivered** requires a signed ack from the recipient's device.

**Offline.** Who holds a message:

| holder | how long | payer |
|---|---|---|
| the recipient's home mailboxes (≥2) | lease R, default 30 d (ASSUMPTION; XMTP precedent 30-365 d, `R/docs/raids/BMAIL-SORT-2026-09-20.md:69`) | the recipient's quota, or a stranger's postage (E7) |
| the sender's device | until delivered, or R | the sender |
| contacts' devices (free tier) | best effort | themselves |

- After a lease expires, the sender re-offers the **identical bytes** and never re-signs (btmd `:38-43`).
- Messages themselves never expire. Only leases, handshakes and delegations do (L2).
- ARITH, worst case at M=10: 30 messages/day × 30 d × 1,395 B = 1.26 MB per mailbox.

**RETAIN/FORGET.**
- Policy is per conversation: `persistent | until-read | ephemeral, forgetAt` (`SPEC-BCHAT-1.md:65-71`). This is "publication-consent routing, not deletion" (`GLOSSARY-BRIDGE.md:34`).
- Ephemeral and until-read messages are never archived.
- FORGET prunes local copies and asks relays to drop theirs. Nothing promises deletion.

**Archive.**
- Each month the wallet packs the user's own view: deterministic `BNRARCV1` batches via `bnr-archive` (`R/crates/bnr-archive/src/batch.rs:9-25`).
- The batch is sealed as a bpq1 object (SPEC-BPQ-1 §4), with a `self` slot plus an X-Wing slot for each sharer.
- No new archive format is created.

**BNRoSe reuse, with no competing journal** (`R/docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:11-15,83`):
- (a) The outbox/inbox journal is a consumer crate of `bnrose-exec-host` using `journal::ReplicatedJournal`. Named gap: its replicas sit in one directory (`R/crates/bnrose-exec-host/src/opexec.rs:103-108`); a second replica on a distinct device or volume is P2 work.
- (b) The paid bundle upload is a BNRoSe op (admit → reserve → dispatch → effect), made idempotent by `dest-apply` on the bundle digest. UNKNOWN is preserved, because "Missing responses must not generate new signatures ... or duplicate payments" (DNS block `:70-71`). This covers the paid-but-incomplete upload case.
- (c) The verifier's decoder is also built as a zero-import wasm module under the same discipline (`R/crates/bnrose-exec-wasm/src/lib.rs:1-33`).
- No new `E_*` codes: door codes live in the consumer's own file.

---

## 7. Scale

**Declared workload model** (all ASSUMPTIONS): N = 1e10 users; M ∈ {1, **10**, 100} messages sent per user-day; k = 6 delivered copies (3 recipients × 2 devices); groups 70% pairwise, 25% of 32 or fewer, 5% larger; body 200 B; n̄ = 4 messages per seal; device duty (fraction of time connected) 0.1; mailbox lease 30 d on at least 2 relays; each member archives one paid copy of their own view.

ARITH at 1,395 B per message:

| M | msgs/s | sent Gbps | delivered Gbps (×6) | seal verifies/s globally |
|---|---|---|---|---|
| 1 | 115,741 | 1.3 | 7.8 | 28,935 |
| 10 | 1,157,407 | 12.9 | 77.5 | 289,352 |
| 100 | 11,574,074 | 129.2 | 775.1 | 2,893,519 |

**No global state.**
- There is no global directory, room, log, presence topic or CRDT; each fails on arithmetic (N/scale.md §3).
- The only global objects are commitments: anchors, and the OTS calendars' own aggregation.
- Sharding is by conversation and community. Federation is road records, not replication.

**Connections.**
- 2e10 devices × duty 0.1 = 2e9 at once.
- At "100k+ realtime connections" per box (CLAIMED, `R/docs/specs/LOADMODEL-1M.md:91`), that is 20,000 boxes.
- That is 500,000 users per box. At the CLAIMED $100/month box (`:86`), the cost is **$0.0024 per user-year**, paid by the box's own users.

**Verify CPU.**
- No estate receipt exists (N/scale.md §5).
- Relays never verify ML-DSA. They check quota tokens, which are hash checks. Devices verify end to end.
- ARITH, phone, at an ASSUMED 1 ms per verify: at M=100 a device receives 300 messages/day, which is 75 seals and 75 ms of CPU.
- ARITH, server, at an ASSUMED 200 µs per verify: 289,352/s × 200 µs = 58 cores worldwide at M=10.
- P0.1 replaces both assumptions with measurements.

**Mobile, push, access.**
- A phone is never a mesh peer. It keeps one foreground connection to its home mailboxes, takes content-free wake hints in the background (E11), and otherwise polls.
- Transcripts give a text alternative to voice. The CI accessibility gate applies (`R/.github/workflows/tests.yml:1095-1099`).
- 512 B buckets suit 2G-class links.

**Rungs.** Each step needs its own receipt: these math bounds, then the 9-node private rig, then 1k, then 10k nodes. "no scale claim skips a rung" (`LOADMODEL-1M.md:137`). "A single-host test is not a mesh result" (MEM order :23).

---

## 8. Economics

| resource | unit (closed enum, `R/crates/shared-types/src/spend.rs:62-80`) | payer of record |
|---|---|---|
| device CPU, storage, battery | — | the user's own device |
| relay send bandwidth | NetByte | the sender (free on contacts' relays) |
| mailbox holding | StorageByte-days | the recipient's quota, or a stranger's postage (E7) |
| archive bundles | ChunkCount (ANT) / StorageByte (AR) | the archive owner |
| evidence renewal | StorageByte (AR), or 0 via an OTS calendar (VENDOR-HELD) | the archive owner, or their grant-bound agent |
| agent compute | CpuMicrosecond, VramByteSecond | the agent's owner |
| bootstrap seeds (road records only) | capped fixed budget | BNR: an allowed standing cost (`CONSTITUTION.md:83`) |

**Archive cost, ARITH.**
- Inputs: each user's view is 4M messages/day × 294 B, plus compacted seals for P = 5/20/50 author-conversation pairs, plus a 2 KB head.
- Prices: ANT $0.0035 per chunk with a 3-chunk minimum (`R/docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:90-91`); AR $32.56/GiB (`bzdid-architecture-decision.md:379`).

| M | bytes per month | route | $ per user-year | 1e10 users per year | per user over 1,000 yr |
|---|---|---|---|---|---|
| 1 | 55,508 | AR | 0.020 | $0.20B | 0.7 GB |
| 10 | 430,653 | ANT (3 chunks) | 0.126 | $1.26B | 5.2 GB |
| 100 | 3,758,148 | ANT (3 chunks) | 0.126 | $1.26B | 45.1 GB |

Quarterly bundles cut M=10 to $0.042 per year. Compare about $385 per user-year for one file per message (N/scale.md §2).

**Free tier, spam and float.**
- **Free tier:** device-local storage plus reciprocal store-and-forward on contacts' devices. No BNR iron is used.
- **Spam:** inboxes are contacts-only, with invites acting as capabilities. Strangers pay postage in physical units, or get a named `FloorRefusal`. Precedent: "sybil belongs at the identity layer; spam handled by self-paid RAM" (`R/docs/dispatches/RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md:18`).
- **No per-identity float:** users pay as they go from their own bPay wallet (`R/docs/dispatches/RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:79-82`).

**Ten-billionth-user test.** The marginal user adds 0 chain bytes, 0 BNR mailbox bytes and 0 BNR archive bytes. BNR's seed cost is a fixed cap, not O(N), because invites and third-party seeds also carry road records, so BNR funding never "gate[s] how many users can exist" (`bzdid-architecture-decision.md:187-188`). Verdict: **passes by construction, NOT RUN** until drills D2 and D10 receipt it.

---

## 9. Moderation and abuse

There are four layers and no global authority ("no universal reputation score", `CONSTITUTION.md:107`):
1. **Person:** block, mute, contacts-only inbox.
2. **Conversation:** owners and moderators in the membership chain remove members and rekey.
3. **Community:** the charter names its rules and moderators, and the community picks its own `ReputationEngine`.
4. **Relay operator:** carries what its jurisdiction allows. It sees only ciphertext and metadata, as with email.

Further rules:
- Reports are signals and never triggers (`BZ/VISION_MODERATION.md:39`).
- The kernel stays blind to spam (`R/docs/BIND-1.md:108`).
- Agents that read untrusted text never hold write authority in the same context (Q-2, `LD/AGENT-1.md:155-158`).
- No face or voice comparison is ever made.
- Illegal content goes to counsel (E9). The structural mitigation: nothing is published in plaintext to permanent stores by default, and whoever uploads a public archive is its payer of record and publisher.

---

## 10. 1,000-year continuity (the core of this design)

Axis 6 asks for "crypto-agility, protocol migration, replaceable adapters, self-describing data, long-lived verification formats, key succession/recovery, epoch and clock rollover handling, archival reconstruction, fork reconciliation" (`SPEC-BTUNGSTEN-1.md:66-73`).

### 10.1 Algorithm registry: added, never redefined

The registry is an append-only signed log of four record types: `admit(id, family, params, kat_receipt, diff_receipt)` makes an id usable; `prefer(id)` makes writers default to it; `retire_new(id, after T, evidence)` stops new seals under it; `distrust(id, after T)` makes old seals count only with evidence from before T.

- There is no `redefine`. What `verify_id` means never changes; only the acceptance policy grows, by addition.
- Precedent: "New ids are ADDED, never redefined, and an old build must refuse them" (`CONTRACT.md:39`), and "a migration the verifier can't name is a forgery it can't catch" (`R/crates/bsigner/src/alg.rs:6-8`).
- A different implementation of the same FIPS standard gets its own KAT and DIFFERENTIAL rows (N/pq-tungsten.md §7 item 13).

### 10.2 Hybrid and successor suites

- **Default suite 0x0001** is composite: ML-DSA-65 AND Ed25519 on every seal, with X-Wing, AES-256-GCM and a SHA3-256 chain.
  - One 64 B addition covers both a break of the young lattice schemes and a Shor break.
  - This follows the estate's existing `cosign` habit (`SPEC-BPQ-1.md:115-118`).
- **Successor slots are reserved, not chosen:**
  - a second-family KEM ("an HQC slot once FIPS 207 is final", `:268`);
  - a hash-based seal suite.
- **Identity eras** move by the SLH-DSA handover (§2).

### 10.3 Re-anchoring and re-attestation of history

**The evidence record** for a bundle contains:
- both the bundle's SHA3-256 and its SHA-256 digest, so one hash weakening does not unbind it;
- an OpenTimestamps proof, which is hash-only and rests on the Bitcoin header chain (`SPEC-BPQ-1.md:120-125`);
- optionally, a community-aggregated BCH OP_RETURN root ("ANCHOR, NOT WAREHOUSE", `R/docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md:72-77`);
- the Arweave transaction id. Arweave provides availability and a third time witness, not the hash-only proof; its signature scheme is UNVERIFIED here.

**Renewal**, on the RFC 4998 model:
- *Timestamp renewal:* re-stamp the existing record under a new anchor before the old anchor's assumptions weaken.
- *Hash-tree renewal:* before the old hash's retirement date, re-hash (bundle bytes ‖ prior record) under the successor hash, then anchor.

**Key property: renewal hashes ciphertext.** So anyone can renew a sealed bundle without being able to read it: an agent with a renew-only grant, a community peer, or a paid service. Genesis ops and handovers get the same records (E19).

**Cost, ARITH:** a 2 KB item per user on Arweave: 1e10 × 2,048 / 2^30 × $32.56 = **$621,033** per renewal era across all users, about $0.00006 each, user-paid.

**Honest limit:** an archive that nobody renews lapses to UNATTRIBUTABLE at its hash's retirement date. Its messages stay readable. The redundancy is that every member archives their own view.

### 10.4 The validity rule for old signatures

`valid(seal, t_v)` holds iff all three hold:
1. every component signature verifies;
2. the signer's card binds to the persona, and through it to the bzDiD, by a binding that was valid at signing;
3. for each component algorithm *a*, one of these is true:
   - `status(a, t_v)` is active; or
   - an evidence chain proves the seal existed before `distrust(a)`, and every renewal in that chain was applied before the hash or anchor it replaced was retired.

A composite seal stays valid while at least one component meets rule 3. If none does, the result is **UNATTRIBUTABLE**: a third state, distinct from both VALID and INVALID.

The claimed `at` is never evidence. It is shown as "claimed", while the evidence record shows "existed by".

Obligation F6 makes the rule monotone: evidence never turns VALID into INVALID, and a retirement never turns UNATTRIBUTABLE into VALID.

### 10.5 Self-describing formats, frozen decoders, airgapped verifier

**Formats**
- Versioned magic, a frozen decoder for every released layout, and trailing bytes treated as an error (ADR 0085 Decision 2).
- **Rosetta.** Each bundle's sealed object carries a plain-text `rosetta` field (precedent: `R/surfaces/bpq.js:72`; `SPEC-BPQ-1.md:155`). It names the content addresses of the spec text, the Cryptol model, the wasm verifier and the verifier source.
- **Decoder of record.** The spec text follows the bpq1 promise: "A reader with only this text, a SHA-3 / SHA-256 / AES-GCM / HKDF implementation and FIPS 203 / 204 / 205 can open and verify every object" (`SPEC-BPQ-1.md:10-11`).

**Three verifier rungs**
1. Native Rust `bzm-verify`.
2. A zero-import wasm build, archived by digest.
3. Spec text + Cryptol + a Daedalus grammar (the RB04/RB05 ladder, `R/crates/btungsten-bench/src/lib.rs:12-13`), small enough for a stranger to reimplement.

**Airgapped mode**
- `bzm-verify --archive --evidence --registry --headers` makes zero outbound calls.
- This is the ruled A11 property: "someone in 200 years holding an archived CAR with no working gateway must still be able to verify" (`pirate-haul-rulings-2026q3.md:86`).
- OTS proofs check against a supplied file of Bitcoin headers. ARITH: 80 B × 144 × 365.25 = 4.21 MB per year, 4.2 GB for 1,000 years.

### 10.6 Time that fails closed at its boundary (L4)

**The field.** `at` is a u64 count of seconds since 1970-01-01T00:00:00Z, without leap seconds, plus a `time_rep` byte (0x01).
- Its horizon is about 5.85e11 years. L4 still makes the boundary a test row (`SPEC-BTUNGSTEN-1.md:134-144`).
- An unknown `time_rep` is refused. A value above the representation's maximum is refused.

**Boundaries in the dependency set:**

| representation | boundary | rule |
|---|---|---|
| Vaulta `time_point_sec` (u32) | 2106-02-07T06:28:15Z | WB004 fail-closed encoders (`R/scripts/btungsten/README.md:426`) |
| JS Number exact integer | 2^53 s ≈ 2.85e8 yr | refuse, or use BigInt |
| i32 `time_t` in dependencies | 2038-01-19T03:14:07Z | test row |
| x0x u64 ms, NIP-01 seconds, CanonicalEvent i64, bzDiD `validUntil` u64 | — | mapped explicitly |

**Rules:**
- Clocks make claims. Order comes from `seq`/`prev`, and "when" comes from evidence.
- An expiring object (lease, delegation, invite) whose expiry would cross a boundary refuses to exist. WB004's form: "at 29 days out a 30-day TTL refuses to exist".
- A new representation is a new `time_rep` id. It is added, and old records stay readable.
- Civil calendars can change freely, because records store a count.

### 10.7 Key succession that survives domain loss

**The authority stack**, from closest to the user to most fundamental:
1. device ids;
2. wallet persona keys (from `masterPrk`);
3. the bzDiD rotation chain (r0 to r2);
4. the hidden SLH-DSA key.

**Losing the WebAuthn domain:**
- removes r0. That costs only availability, provided the written-code r1 is the floor;
- becomes a takeover if r0 keeps top priority (E6). D13 tests a hostile captor of the domain.

Release-signer succession is coordinated with `kc/integrate` (DNS block `:46-48`).

### 10.8 Upgrade governance across mixed versions

- **M1 read-all.** Every conforming client reads every released version and every admitted suite, forever (Art. VI.1, deprecation windows "measured in years", `CONSTITUTION.md:92`).
- **M2 write-common.** A writer uses the newest suite that every member advertises in its signed membership entry (`can_read`). It never writes a suite past `retire_new`, so there is no downgrade.
- **M3 named exclusion.** If a member can read no permitted suite, everyone sees "X's client cannot read the current suite". Nothing falls back silently.
- **M4 critical bit.** As in §3.
- **M5 Proof gate.** Nothing reaches `prefer` without two independent conforming implementations that pass the shared vectors (`R/docs/article-vi-s3.md` §3.1; the sovereign order's "another conforming client resumes" test).
- **M6 signed releases.** Releases carry bpq1 detached signatures, which "can carry an authorship proof that outlives Ed25519 and the hosting account" (`SPEC-BPQ-1.md:133-135`).
- **Proposed tiering (E13):**

| change | Art. VI tier |
|---|---|
| admit a suite, change a default | Feature |
| accept a retired suite, drop a required signature, lower a floor | Safety (K=4, 13% quorum) |
| change the registry's own rules | Meta |

  In Epoch 0 the founder decides alone, after the Proof gate (`article-vi-s3.md` §3.5).

### 10.9 Extinction drills

Every drill states its PASS criteria before the run and carries a positive control, because uniform failure means the probe is broken (CLAUDE.md §5). Drills run on private infrastructure with disposable identities (DNS block `:66`). "Timeout, OOM, missing evidence and an unexecuted test are all distinct from PASS" (MEM order :25).

| # | dies | PASS (stated before the run) | control | cadence / first |
|---|---|---|---|---|
| D1 | all estate DNS names (resolver + SNI) | messages flow via road records within 5 min; a QR invite joins a new member; no signature names a host | the blocked name fails to resolve inside the netns | monthly / P1 |
| D2 | every relay, Hostinger included | no durably acknowledged message is lost; delivery resumes on any third-party relay added by a signed road record | relay ports refuse | monthly / P1 |
| D3 | x0x | the human plane is unchanged | zero x0x processes asserted | monthly / P1 |
| D4/D5 | Autonomi / Arweave | reads come from the other store or from devices; uploads refuse by name; evidence still verifies on BTC headers | the store client fails | quarterly / P2 |
| D6 | ML-DSA-65 (forgery oracle from date B) | post-B ML-DSA-only seals are refused; backdated seals without evidence are UNATTRIBUTABLE; genuine history stays VALID; every identity hands over by SLH-DSA | a planted verifier that ignores `distrust` is convicted | each release / P0 |
| D7 | Ed25519 and secp256k1 (Shor) | no authority derives from them; legacy history reads "classical, existed by T" | as D6 | each release / P0 |
| D8 | SHA-256 | hash renewal under SHA3 completes in time; a lapsed chain is refused | a planted lax verifier is convicted | each release / P2 |
| D9 | the reference client | a second, independent client (the JS surface) reopens archive + phrase, verifies, and continues | it refuses a planted non-canonical record | each release / P4 |
| D10 | the org: BNR keys, repos, domains, relays, GitHub | a clean machine with only the phrase and a paper list of bundle addresses reconstructs and verifies offline; a new community starts on third-party roads | no BNR endpoint is reachable | annual / P4 |
| D11 | the clock representation | no wrapped time is accepted; Vaulta-bound items refuse before 2106 minus their TTL; clocks set to 1970, 2038-01-19T03:14:08Z, 2106-03 and 2200 all behave as specified | the WB004 naive encoder is convicted | each release / P0 |
| D12 | Vaulta | messaging is unaffected (`CONSTITUTION.md:85`); metered spend refuses by name | chain RPC fails | quarterly / P2 |
| D13 | the WebAuthn RP domain, captured | recovery by r1; the captor gains no messaging authority | the captor origin is served by the test | annual / P1 (red until E6) |
| D14 | upstream block/buzz and x0x | a reproducible build from the hash-pinned mirror (`pirate-haul-rulings.md:12`) | upstream URLs 404 | annual / P1 |
| CT | century transition: D1-D14 in sequence | the airgapped verifier classifies every message as VALID, UNATTRIBUTABLE or LOST, and prints the counts | — | annual / P5 |

CT makes axis 6's honesty clause literal: "repeated simulated century transitions, dependency extinction, algorithm deprecation ... state reconstruction from surviving fragments" (`SPEC-BTUNGSTEN-1.md:75-83`).

---

## 11. Tungsten conformance matrix

Result classes follow `SPEC-BTUNGSTEN-1.md:269-275` and `SPEC-BTUNGSTEN-PQ-1.md:32-41`. Every gate has teeth in the same job (`SPEC-BTUNGSTEN-PQ-1.md:42-43`).

| axis / law | test family | pass / fail | class | teeth |
|---|---|---|---|---|
| 1 Decentralization | D2, D10, D14 | keeps operating with no privileged operator | MEASURED (lab) | a hidden BNR endpoint turns D10 red |
| 2 Sybil / MiM | cross-conversation seal replay, relay substitution, card swap, mailbox replay | refused by the conversation binding, the chain and the card binding. Unlinkability: **NOT RUN** (no TAM) | KAT + DIFFERENTIAL | a verifier that skips the conversation binding is convicted |
| 3 Healing | partition, kill, corrupt a replica, chain gap | gap detected; identical bytes only; UNKNOWN never authorizes (`R/docs/dispatches/2026-10-12-bnrose-rust-001.md:50-53`) | MEASURED | a re-sender that re-signs is convicted |
| 4 Learning | the ladder's memory is the only learning | bounded, reversible, receipted "via rung N" | MEASURED | a ladder that hides a climb is convicted |
| 5 >10B | §7 math, then 9 → 1k → 10k nodes | budgets set before the run (`R/crates/btungsten-meshdep/budgets/btmd-budgets-1.json`) | ARITH, then MEASURED | nothing counts before the rung receipts |
| 6 1,000 yr | D4-D11, CT, F1-F6 | §10.9 | PROVE where stated, else MEASURED | per drill |
| L1 | D6, D8, D13 | same bzDiD and same history classification after each | MEASURED | — |
| L2 | short-lived authority | delegations ≤30 d; leases and invites expire | TYPECHECK + battery | a 1,000-year delegation refuses to exist |
| L3 | bounded state | membership capped; no population roster anywhere | CHECK-SAMPLED | a planted global roster is refused |
| L4 | D11 | §10.6 | PROVE (encoder) + MEASURED | WB004 naive encoder |
| L5 | the "connected" light | EXPOSURE (socket seen) → IDENTITY (the relay's signed road record) → PEER (own echo returns) → AGREEMENT (a recipient ack, or a second relay agrees on the chain head) (`SPEC-BTUNGSTEN-1.md:146-167`) | MEASURED | a configured but closed relay shows dark |

**Formal obligations.** Each proof is about the deployed decoder (the right-language law, `SPEC-BTUNGSTEN-1.md:278-283`).
- **F1** `bzm1` encoding is injective, on the WB001 ladder: a Cryptol spec, a `no_std` Rust core, shared vectors, then SAW PROVE that `decode(encode r) = r` and that encode is injective over the bounded shape. A Daedalus grammar must equal the decoder (RB04/RB05).
- **F2** `domainsDisjoint` holds over `bpq1/` ∪ `bzm1/`.
- **F3** T-TRUNCATE on the chain hash, at lengths around the SHA3-256 rate of 136 B: 0, 1, 135, 136, 137, 271, 272, 273, and so on.
- **F4** T-VACUOUS: a seal with `from_seq > to_seq`, a zero-message seal, an empty membership and an empty registry are all refused.
- **F5** the WB004 time encoder.
- **F6** the validity rule is monotone (§10.4).

---

## 12. Migration from today's Buzz

1. **M0 anchor now, while BIP-340 is still sound.** Read-only export → a `bnr-archive` batch → SHA-256 and SHA3-256 roots → an OTS stamp. Only the 32-byte root leaves the box.
2. **M1 bind.** Each human and agent gets a bpq1 binding with claim `nostr=<npub>`, plus §5b attestations (`SPEC-BPQ-1.md:211-227`). Bindings are Selective (E12).
3. **M2 dual-run.** The Buzz relay stays, and `bzm1` rides it as a road. Third-party NIP-29 clients keep working, labelled classical.
4. **M3 the 18 agents.** `buzz-acp` and `buzz-cli` are unchanged; they talk NIP-42/NIP-01 to a localhost `bzm` bridge. The bridge never denies AUTH without the `error:` prefix, because buzz-acp treats any other denial as terminal (`BZ/crates/buzz-acp/src/relay.rs:3804-3806`).
5. **M4 media.** References become `sha256:<hex>` plus a list of roads. Blossom is already addressed by sha256 (`BZ/ARCHITECTURE.md:624-625`). This fixes tonight's broken `https://skaists.buzz/media/...` links (N/buzz.md §5).
6. **M5 import.** Legacy events become `legacy-nostr` records holding their exact bytes. They are never re-signed as if PQ.
7. **M6 retire the legacy road**, but only after D2 passes and every member reads `bzm1`. Legacy history stays readable forever.

---

## 13. Build plan

**P0: doable now, no ruling needed.** Each acceptance is a receipt that CI prints on the landing commit.

| id | owner | reuses | acceptance receipt |
|---|---|---|---|
| P0.1 | btungsten lane | `btungsten-bench` harness, `btungsten-pq` implementations | ML-DSA-65, Ed25519 and SLH-DSA-SHAKE-256f sign/verify p50/p99 on Hostinger (8-core), the Dell and one phone; threshold set in advance (phone verify p99 ≤ 1 ms) |
| P0.2 | Seat 3 drafts, Codex reviews | WB001 ladder, `bpq-core` labels | `bzm1` spec + Cryptol + `bzm-core` + vectors; SAW F1-F4 with teeth; NOT-RUN never counts as a pass |
| P0.3 | Seat 3 | `bnr-archive` | `bzm-evidence`: dual-hash tree, OTS parse, offline header check, the §10.4 rule; teeth: tampered leaf, wrong header, retired algorithm without evidence |
| P0.4 | Seat 3 | — | `bzm-verify` under `unshare -n`; strace counts 0 `connect()` calls (A11) |
| P0.5 | btungsten lane | `btungsten-wb004` | D11 battery for `at` (2^53, 2038 and 2106 rows); naive-encoder tooth convicted |
| P0.6 | box seat (Hostinger is in founder scope) | `bnr-archive` | M0: export manifest digest + `.ots` file; only the root leaves the box |
| P0.7 | Seat 3 | `btungsten-teeth` | D6 and D7 as CI drills on lab identities |
| P0.8 | box seat | — | inventory receipt: Hostinger relay image, kinds in use, event counts (N/critic.md §6 item 5) |

**Later phases:**
- **P1.** Pairwise lane, seals, a ReplicatedJournal consumer (ZCode seam), the Buzz-relay road, and the buzz-acp bridge. Drills D1 (with the DNS-independence lead), D2, D3, D13, D14. *Unblocks:* the first real users.
- **P2.** Bundles, the BNRoSe paid-upload op, the renewal scheduler, a second journal replica. Drills D4, D5, D8, D12.
- **P3.** Small groups, the membership chain, a rekey-on-remove receipt, moderation records.
- **P4.** A second conforming client (the bChat JS surface), the mixed-version matrix, D9, D10.
- **P5.** Registry and retirement records once E13 and E14 are ruled; the CT drill.
- **P6.** Scale rungs 9 → 1k → 10k (btmd lane), a mobile measurement, push hints.
- **P7, gated on rulings:** the x0x road (E1), SLH-DSA in `KeyAlg` (E5), the production seal signer (E4), postage (E7).

---

## 14. Open questions and risks

1. The group "unsealed" window (up to 5 s) may read as broken. The cadence is an ASSUMPTION and needs a usability receipt.
2. Archives that nobody renews lapse to UNATTRIBUTABLE. Keyless renewal lets anyone renew; it compels no one.
3. All capacity numbers rest on assumptions (verify cost, until P0.1), CLAIMED figures (the connection ceiling, the box price) and storage prices read on one date.
4. Postage is unruled (E7). Without it, the only defences against stranger spam are invites and proof-of-work.
5. Bitcoin PoW plus the OTS calendars (VENDOR-HELD) are the hash-only anchors, and BCH is the only second PoW anchor. If both weaken together, timestamp renewal must run first.
6. Read-all (M1) means the decoder burden grows forever. That is the price of never stranding history.
7. Two root-level risks are unresolved: the root's dependence on SHA-256 (E19) and the r0 domain-priority inversion (E6). My E6 attack reading is untested analysis.
8. Relays see network addresses and timing, and no unlinkability claim is possible without a TAM. Large rooms get no confidentiality at all.
9. Every drill is a lab simulation. "A single-host test is not a mesh result."
