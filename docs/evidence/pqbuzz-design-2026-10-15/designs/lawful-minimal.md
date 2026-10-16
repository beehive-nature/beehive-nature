# BESIDE: post-quantum Buzz under current law (lawful-minimal design)

Design round 2026-10-15. Angle: lawful-minimal. Read-only on every repository; nothing was built or run except the arithmetic scripts named below.

Citation keys. `R` = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`). `BZ` = `C:/Users/travi/buzz-src` (fork `e1035672`). `LD` = `C:/Users/travi/LOVErnment-DAO/specs`. `N:` = the reader notes in the `pqbuzz/` scratchpad folder. `calc` = `pqbuzz/lm/calc-lm.js`, `calc-nip17.js`, `calc-priv.js` (node; every figure marked ARITH is reproducible there). Classes: RULED, MEASURED, SOURCE (seen in code, not run), CLAIMED, UNVERIFIED, ASSUMPTION.

---

## 0. Thesis and name

**BESIDE** keeps everything the law already gave to someone else exactly where it is, and adds post-quantum authority *beside* it. Buzz stays the human plane and keeps its NIP-01 wire byte for byte, so the buzz-acp harness, buzz-cli and the 18 agents keep working unchanged. Each author's device (or agent harness) periodically lists the ids of the events *it signed* in one checkpoint event and attests that checkpoint with the **already-built** SPEC-BPQ-1 §5b statement (`bpq1/nostr-event`, ML-DSA-65; `R/docs/specs/SPEC-BPQ-1.md:211-227`). That costs zero new labels and zero new crypto, and it turns 7,706 B of post-quantum signature material per message into 51-861 B per message at 1,024-10 messages per checkpoint (ARITH, calc). Post-quantum confidentiality arrives as one additive bChat Core lane that carries an already-specified bpq1 sealed object with X-Wing slots (`R/docs/specs/SPEC-BPQ-1.md:144-189`) for DMs and groups of up to 29 recipient devices. Durability moves off the relay into the signer's own outbox journal (BNRoSe `ReplicatedJournal`) and the user's own paid, sealed archive. Availability stops depending on one DNS name through a road list pinned by a PQ-attested community charter. x0x carries no human-plane traffic. The cost of the ten-billionth user lands on that user and on the community they choose, never on BNR. The honest one-line claim is: **classical now, post-quantum settled at checkpoint; no end-to-end claim on channels; no forward secrecy anywhere.** This design names the bTunGsTeN receipts it will earn and claims none of them (`R/docs/dispatches/2026-10-06-btungsten-lane.md:45-47`).

---

## 1. Plane mapping and escalations

### 1.1 Plane mapping (PLANE LAW as recorded, `R/docs/ledger/pirate-haul-rulings.md:18`)

| Plane | What it carries here | Component |
|---|---|---|
| Human (Buzz) | channel messages, DMs, the PQ-private lane, checkpoint, attestation, bind and charter events | community relays speaking NIP-01 (Buzz fork); bChat surfaces |
| Machine (x0x) | nothing of PQ Buzz in P0-P5. Existing estate machine traffic stays as the x0x docket ruled it (dispatch board, bACCORD DMs, `pirate-haul-rulings.md:18`). Optional P6 relay commitment beacons (digests only). | x0x, opt-in on relay hosts only |
| Durable (Autonomi) | the user's sealed archive bundles of 256 KiB or more | ANT via `R/surfaces/ant-pay.js` (merged; N:paystack.md §3) |
| Permanence (Arweave) | sealed bundles under 256 KiB, only once a paid path is receipted | `R/crates/atmirror/src/arweave.rs`; `adapter-arweave` gateway is a STUB (`R/crates/adapter-arweave/src/gateway.rs:1-9`) |
| Settlement (Vaulta/Zano) | nothing. No per-user or per-message chain write. | none |

Buzz is never the system of record (`pirate-haul-rulings.md:17`; `R/docs/SPEC-PAY-ONCE-NOW-1.md:65-67`). The record of a message is the signed NIP-01 bytes held by the signer's journal and the user's archive. The relay is cache, fan-out, membership gate and moderation point.

BNRoSe leg (charter rule, `R/docs/SPEC-BNROSE-0-CHARTER.md:36-39`): messaging fits none of L1/L2/L3, and "Don't bend a taxonomy to fit a document" (`R/docs/dispatches/RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md:59-65`). This is a kernel/bChat document (Constitution Art. III, `R/docs/CONSTITUTION.md:65-67`; SPEC-BCHAT-1). It **consumes** L2 (the journal and durable-ack discipline) and L1 (eternal data for archives). It serves no leg.

### 1.2 Escalations (named, not resolved)

| # | Collision | Cited rule | What BESIDE does with no ruling | What changes if the founder rules otherwise |
|---|---|---|---|---|
| E1 | "Buzz over x0x" | PLANE LAW, X-1, X-3 (`pirate-haul-rulings.md:18`); weakest rail (`pirate-haul-rulings-2026q3.md:27`) | Human traffic rides NIP-01 relays only. x0x is unused by PQ Buzz. | A road type `x0x` (the x0x-nostr-bridge pattern, topics `buzz.v1.ch.<channel>`, N:x0x.md §8) joins the charter road list behind the same L5 gate. The record, archive and PQ statements are unchanged, so this is a switch, not a rewrite. Even then it needs: a TCP rung (A05 Proposed), v0.48.0 for revocation (#1111/#1335), the unreleased store fix (saorsa-gossip #115), and P0 TreeKEM receipts before any confidentiality word (N:x0x.md §0, §3). |
| E2 | Encrypted lanes on a Buzz relay | Buzz "NEVER a ... privacy ... layer" (`pirate-haul-rulings.md:17`) | Reading: confidentiality belongs to bChat Core, which is the ruled messaging stack (`R/docs/specs/SPEC-BCHAT-1.md:3-6`) and already rides the Buzz relay for NIP-17 (`:74-84`). The relay carries opaque bytes. | The PQ-private lane moves to any other NIP-01 road. Nothing else changes. |
| E3 | Who pays the always-on relay | Art. V.1 standing costs limited to "bootstrap seeds and specification/reference-code maintenance" (`CONSTITUTION.md:83`) vs B1 rule 2 "Buzz's own A pays ... its relay" (`R/docs/dispatches/BUZZ_A_METERING_SPEC.md:104-105`) | BNR-run relays are a fixed set of bootstrap seeds with fixed capacity. Their cost does not grow with users. Every other community runs and funds its own relay. A full seed returns a named refusal. | Turn on B1 metering at the relay (`NetByte`, `StorageByte`, `CpuMicrosecond`; `R/crates/shared-types/src/spend.rs:62-80`), charged to the member with `FloorRefusal` at zero balance. No format change. |
| E4 | Agent PQ key custody | "no agent holds/requests/transmits private key material" (`C:/Users/travi/CLAUDE.md` §2 Seat-3 additions); hierarchy ruling (`R/docs/dispatches/RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:14-15`) | Reading: the harness process (buzz-acp or a host supervisor) holds the agent's PQ seed, exactly where it holds the agent's nsec today. The key never enters model context (AGENT-1 A-8, Q-2; N:law-identity-scale.md §5). The seed is a host device seed, model (A) of `R/docs/RULINGS-2026-10-04.md:59-66`. | Agent checkpoints are attested by the owner's device key instead ("owner vouches"). This is a config switch. Agents lose independent PQ authorship. |
| E5 | bsigner freeze | `R/crates/bsigner/CONTRACT.md:3-7`; `bpq-attest-nostr` is not in the frozen command list (`:13-23`), the open 18-command collision (N:pq-tungsten.md §6) | Signing uses `surfaces/bpq.js` (`BPQ.attestNostr`, the JS twin, IMPLEMENTED; `SPEC-BPQ-1.md:3`). The independent verifier is the frozen `bsigner bpq-verify`. | Rust hosts may call `bsigner bpq-attest-nostr` as a subprocess. |
| E6 | Kernel `MessageEvent {from_did, to_did}` | R1, "no permanent mapping ... in public" (`R/docs/RULINGS-2026-09-16.md:26-29`); `R/crates/shared-types/src/events.rs:212-219` | `MessageEvent` is emitted on the device's local bus only. It is never anchored, bundled publicly or published. | If ruled harmless, `adapter-arweave` bundles may include it. |
| E7 | Community identity is a DNS name | ORIGIN RULING "IT IS IDENTITY, LOAD-BEARING — it must stay skaists.buzz" (`R/docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:72-87`) vs the DNS-independence block: "names help people find the system; cryptographic authority determines what the system accepts" (`R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:90-92`) | The canonical name stays byte for byte as the label, the NIP-42 `relay` tag and the push origin ("don't touch it", `:72`). Acceptance authority moves to a PQ-attested community charter. | If the founder lets the name change, the charter gains a new label. Nothing else changes. |
| E8 | Public-room content on permanent rails | "no deletion promise exists anywhere" (`R/docs/GLOSSARY-BRIDGE.md:34`, per N:critic.md §2); counsel question (`R/docs/specs/SPEC-BLICENSE-0.md:187-191`) | Only sealed (encrypted, private) bundles are archived. No plaintext public-room archive exists in any phase. | Community public archive bundles switch on after counsel. |
| E9 | Spam postage vs free access | "No person pays to *use* a BNR function" (`R/docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`) | No postage. The fences are membership, per-member quotas (`R/docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:61-63`) and moderation. | Over-quota sending becomes purchasable in A-metered `NetByte`. |
| E10 | Social recovery | "Every account-recovery path must require the original body" (`R/docs/joint-liveness-coherence.md:174`, CLAIMED-as-ruling) vs draft Stage 4 (N:critic.md §4.2) | None is offered. Recovery is phrase (r1), second device (r2), and a root-derived recovery card pinned at first bind (§2). | Add a threshold recovery card type to the bind set. |
| E11 | Vendor push | VENDOR-HELD enhancement-only (`R/docs/RULINGS-2026-09-30.md:21-28`, applied by analogy) | The existing iOS content-free push stays optional. No new vendor dependency is added. | none needed |
| E12 | b in the Buzz loop | "provide RAM, earn b" (hierarchy `:16`) vs "b does not appear in the alpha metering path at all" (`BUZZ_A_METERING_SPEC.md:80-82`) | A only. b is absent. | b enters only by a later ruling, as a separate receipt line. |
| E13 | Per-identity float | Rail C (`R/docs/dispatches/RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:79-82`); KISS question open (`R/docs/dispatches/INDEX.md:135`) | Nothing is pre-funded. Archive spend happens at time of use from the user's own wallet. Zero balance gets `FloorRefusal`: "archive not funded; your history is on your devices only". | none |
| E14 | Is a community-visible npub-to-PQ binding a "public mapping"? | Art. II bidirectional links (`CONSTITUTION.md:52`) vs R1 (`RULINGS-2026-09-16.md:26-29`) | Bindings are pairwise per community (one npub and one PQ persona per community). They are visible only to that community's relay and members, never anchored. The device-to-wallet binding is never published. | If community-visible counts as public, bind events move into the PQ-private lane addressed to members (P5 mechanics). |
| E15 | Per-community member roster | P-10 "never to a registry of persons" (`LD/PERSON-1.md:117`); Art. V.3 | The roster is Buzz's existing per-community membership of pairwise npubs. There is no global roster. | none planned |
| E16 | Agent heartbeat vs "never gate the founder" | AGENT-1 Q-5 "Authority expires. Dead-man's switch." (`LD/AGENT-1.md:168-169`, frozen) vs the founder's memory-recorded "remove me from gating" | Agent endorsements expire. Renewal is one press per interval in the wallet. The interval is the founder's setting. | none; frozen law binds |

---

## 2. Identity, devices, agents, keys, succession, recovery

**Root.** The root is the bzDiD, `did:b:` (VOCABULARY Law 7, `R/docs/VOCABULARY.md:220-226`). It costs zero chain bytes (`R/docs/bzdid-architecture-decision.md:59`) and needs no authoritative store (`:390`). Nothing in BESIDE writes to a chain.

**Personas per community (pairwise by default, `R/crates/onboarding/src/lib.rs:113-133`):**
- **npub.** One secp256k1 npub per community, as Buzz already works. `PersonaRef::Nostr` exists (`lib.rs:83-108`).
- **Device PQ persona.** One bzpq1 persona per device per community. It is derived from the device's own seed with context `buzz:<charter-id>`, where the charter id is a 52-character base32 string. The context is about 57 printable characters, inside the 1-64 rule (`SPEC-BPQ-1.md:47-61`). This is model (A): the phrase never touches a device (`RULINGS-2026-10-04.md:59-66`). No new label is needed: the keys use the frozen `BDID-v1/*` labels (`SPEC-BPQ-1.md:34-41`).
- **Recovery card.** One root-derived card, from the wallet's `masterPrk` with context `buzz:<charter-id>:r`. It is pinned in the first bind event and used only from the wallet origin, only to authorize a new device after every device is lost.
- **Device-to-wallet link.** A SPEC-BPQ-1 §3 binding signed by both sides, with claim `buzz-device=<bzpq1 id>` (`SPEC-BPQ-1.md:92-119`). It is kept in the wallet and on the device and never published.

**Bind event `K_BIND`** (a new Buzz kind; numbers are provisional, §3.4).
- Content: `{v:1, cards:[bpq card...], recovery:card, prev?:<bind id>, owner?:{npub, expires}, inference?:"local"|"remote"}`.
- It is Schnorr-signed by the npub. Each listed card's key attests the bind event id with §5b. That gives the bidirectional link Art. II requires (`CONSTITUTION.md:52`).
- **Pinning.** Members pin a persona's card set when they first see it (or from the invite). A later bind event is accepted as a change only if an already-pinned card attests it. Anything else is shown as "unendorsed key change" and never adopted silently.
- **Timestamp.** Bind bytes are OpenTimestamps-stamped by the wallet's existing hash-only path (`SPEC-BPQ-1.md:120-125`). The design leans on the rule that "A binding proves something only if it existed before the break" (`:119-120`).

**Agents.**
- Each agent keeps its own npub, as Buzz expects (`R/docs/ledger/pirate-haul-rulings-2026q3.md:28`), plus NIP-OA owner attestation (`BZ/docs/nips/NIP-OA.md:31-46`).
- The agent's PQ persona comes from the harness host's device seed (E4). Its bind event carries `owner:{npub, expires}` and is attested by the owner's pinned device card. That is the owner-bound, expiring delegation AGENT-1 Q-5 requires (`LD/AGENT-1.md:168-169`).
- After `expires`, the agent's checkpoints read "owner endorsement expired". The relay's NIP-42 AUTH is not touched, so buzz-acp's terminal-AUTH behaviour (`BZ/crates/buzz-acp/src/relay.rs:3804-3806`) never fires because of PQ.
- **Revocation (A-10, `LD/AGENT-1.md:73-74`).** The owner signs a bind update with `revoked` on a device they hold, offline if need be, and carries it to any road later. Deleting the harness seed is the physical act.
- bLOVErAi has no DID and is never a member (`LD/AGENT-1.md:198`).

**Succession.** When ML-DSA-65 must retire, the persona's SLH-DSA-SHAKE-256f handover v1 applies (`SPEC-BPQ-1.md:190-209`). It is built in Rust only; the browser cannot make or check one yet (gap). SPEC-BPQ-1 leaves "refusing a second handover" to "whoever keeps the log". In BESIDE the log-keeper is local: each community's members and archives keep the per-persona handover log. The first handover seen wins, and a second one is kept as equivocation evidence. No global log exists.

**Recovery.**
- *One device lost:* the other devices continue, and a pinned card authorizes the replacement device's bind.
- *Every device lost:* the phrase (r1, `bzdid-architecture-decision.md:49-50`) re-derives the root in a wallet. The recovery card authorizes new device cards.
- *WebAuthn domain lost:* r0 is bound to its RP domain, and "WebAuthn alone does not survive losing the original domain" (memory-recorded order, N:scale.md §0). The phrase path needs no domain. Authenticating a replacement wallet origin is the kc/integrate lane's job (DNS block `:41-44`); BESIDE depends on it and does not duplicate it.
- *Lost npub:* a new npub is chained by a recovery-card-attested bind. Our archive keeps both under one DID ("Key rotation must never orphan data", `CONSTITUTION.md:49`). Buzz itself cannot transfer authorship (`BZ/docs/nips/NIP-IA.md:25-27`). That is an upstream limit, stated in the UI.
- *What a recovered identity can read:* PQ-private messages sealed only to lost devices are unreadable by design. Devices therefore also seal what they keep to the user's archive persona card (§6). No social recovery is offered (E10).

**No uniqueness claim.** A key is not a human (`LD/PERSON-1.md:36`). BESIDE makes no Sybil or uniqueness claim and does no biometrics (P-3, B-2).

---

## 3. The envelope of record

### 3.1 One record, four roles (answers "six envelopes", N:critic.md §4.9)

| Role | Format | Status in BESIDE |
|---|---|---|
| **Record** | the signed NIP-01 event bytes **as received**, never re-encoded (the stored-bytes law precedent, `R/crates/bzdid/src/genesis.rs:26-30`) | the only thing hashed, journaled and archived |
| PQ authority | SPEC-BPQ-1 statements: §5b attestation, §3 card and binding, §4 SEAL | beside the record, never inside the id it signs (`SPEC-BPQ-1.md:224-225`) |
| Content model | bChat Core envelope (v1 today, v2 additive) | content of private-lane events. The model and view for all lanes. |
| Bus projection | `CanonicalEvent::MessageEvent` (pointer only) | local bus only (E6) |
| Not message formats | x0x `DmEnvelope`, WB001 (intents), `bheart.signature/1` (bsigner files) | unused for messages |

Channel messages keep today's Buzz kinds and content (for example kind 9, `BZ/crates/buzz-core/src/kind.rs:479`). Changing their content would break every installed client. bChat's Buzz adapter maps them into the bChat model for display and for the local bus.

### 3.2 Algorithms and ids

| Use | Algorithm | Id carried | Class |
|---|---|---|---|
| Event id | SHA-256 over NIP-01 serialization | implicit (NIP-01) | classical-at-destination, listed |
| Event signature | BIP-340 Schnorr secp256k1 | implicit (NIP-01) | classical, listed (N:buzz.md §7) |
| Checkpoint attestation | ML-DSA-65 pure, empty context, label `bpq1/nostr-event` | `bpq:1` + kind | PQ |
| PQ confidentiality | X-Wing (draft -11) slots + AES-256-GCM + SHA3-256 key commitment | `bpq1` magic, `aead`, slot `to` | PQ (hybrid KEM) |
| Private-lane PQ sender proof | SEAL, ML-DSA-65, label `bpq1/seal` | SEAL `alg` | PQ |
| Succession | SLH-DSA-SHAKE-256f, label `bpq1/handover` | handover `bpq:1` | PQ (hash-based) |

Unknown `v`, `bpq`, `aead`, slot `to` or SEAL `alg` is refused, never defaulted (`SPEC-BPQ-1.md:265-272`). **No new `bpq1/` label is introduced in P0-P5**, so the `domainsDisjoint` proof over 14 labels stands unchanged (`R/crates/bpq-core/src/layout.rs:42-58`).

### 3.3 Signature amortization: the checkpoint

- **`K_CP` checkpoint event.** It is signed by the persona's npub. Content = base64url (no padding, canonical tail bits) of the concatenated 32-byte ids of every event **this signer signed** since the last checkpoint, in signing order. Tags: `["v","1"]`, `["c",<charter id>]`, `["seq",<u64>]`, `["prev",<previous K_CP id or bind id>]`, `["range",<first created_at>,<last created_at>]`.
- **`K_ATT` attestation event.** Content = the SPEC-BPQ-1 §5b JSON verbatim, with `event` = the `K_CP` id, plus tag `["e",<K_CP id>]`.
- **Why it is sound by construction.** The checkpoint id is SHA-256 over its content, which lists the ids, and each id is SHA-256 over its event. A forger of the author's secp256k1 key cannot add an id to an attested checkpoint without forging ML-DSA-65 or finding a SHA-256 collision. No Merkle tree and no new hash construction are used: the list is fixed-width, so it is injective by construction.
- **"Attest what you signed, never what you observed."** The checkpointer reads ids from its own outbox (§6), never from a relay. A watcher that attests relay-observed events is a pre-quantum bootstrap only. It is labelled with a weaker receipt class ("observed-attested") and is never used once its signer's classical key is considered broken.
- **Cadence.** Close a checkpoint at `n = N_max = 1,024` ids or `T_max` after its first id (default 24 h; community policy), whichever comes first, or on demand before an important act. At most 1,524 ids fit under a 64 KiB frame (ARITH, calc). 1,024 is chosen for margin.

Sizes (ARITH, calc-lm.js; ASSUMPTION: a 200 B text message as kind 9 = 590 B):

| ids per checkpoint n | checkpoint event | attestation event | PQ bytes per message | vs attesting each message (7,706 B) |
|---|---|---|---|---|
| 1 | 523 | 7,706 | 8,229 | 0.9× (worse) |
| 3 | 608 | 7,706 | 2,771 | 2.8× |
| 10 | 907 | 7,706 | 861 | 8.9× |
| 64 | 3,211 | 7,706 | 171 | 45× |
| 1,024 | 44,171 | 7,706 | 50.7 | 152× |

The §5b statement is 7,262 B of JSON. 2,603 B of that is the base64url `dsa` public key, which a card-reference statement kind would remove. That is a later PQ-lane proposal, not P0-P5.

### 3.4 Kinds and compatibility

- **Four new kinds** in the fork relay's allowlist: `K_BIND`, `K_CP`, `K_ATT`, and an addressable `K_CHARTER`. Provisional numbers are 47100, 47101, 47102 and 37100. The fork's `kind.rs` at `e1035672` has no constant in 47000-47999 or at 37100 (SOURCE, grep). These must be re-checked against upstream main (354 commits ahead, N:buzz.md §0) before use.
- **The change.** The relay rejects unknown kinds today (`BZ/crates/buzz-relay/src/handlers/ingest.rs:344`). So the fork change is one match arm per kind with `Scope::MessagesWrite`. The content cap is 256 KB (`ingest.rs:2014`); BESIDE designs to the 65,536 B frame (`BZ/ARCHITECTURE.md:161`).
- **NIP-01 clients** (nak, Chachi, 0xchat, `BZ/NOSTR.md:200-210`) see unchanged events and ignore the new kinds. **Stock relays** refuse the new kinds. There, events degrade to "classical only", which is honest, not broken.
- **bChat v1.** The v2 envelope adds lane `bnr-pq-private`, `body.type:"bpq1"`, and optional `refs:{prev}`. v1 validators refuse unknown lanes (`R/surfaces/bchat-core.js:65-70`), so v2 is the version bump that additive evolution requires (`CONSTITUTION.md:92`).
- **CanonicalEvent.** `MessageEvent.content_ref` is the local store reference or archive address. `to_did` is singular, so group conversations need a variant added by addition (`events.rs:56-57`). That is a proposal, not a mutation.

---

## 4. Confidentiality: pairwise, groups, metadata

| Lane | Mechanism | Allowed wording (exact) |
|---|---|---|
| Channel (Buzz kinds) | TLS to the relay; the relay stores plaintext (`BZ/VISION.md:100`) | "Readable by this community's relay and its members. Not end-to-end encrypted." |
| `bnr-private` (bChat v1, built) | NIP-17 + NIP-44 v2, secp256k1 ECDH (`SPEC-BCHAT-1.md:55,74-84`) | "Encrypted end to end with NIP-44 v2, sound by construction against the pinned official vectors. Classical: a recording could be opened once secp256k1 is broken." |
| `bnr-pq-private` (bChat v2, new lane) | a kind 1059 event signed by a fresh ephemeral key. Content = base64url(bpq1 sealed object). One X-Wing slot per recipient device, plus one slot for the sender's archive persona. The plaintext is the sender's **signed** kind-14 NIP-01 event carrying the bChat v2 envelope. | "Encrypted to the listed devices with X-Wing (ML-KEM-768 + X25519) and AES-256-GCM, sound by construction. Signed by the sender (classical now; post-quantum once a sealed conversation checkpoint covers it). No forward secrecy. The relay sees who is in the conversation and when." |
| Huddles (voice) | unchanged, server-forwarded (`BZ/crates/buzz-relay/src/audio/room.rs:47-49`) | "Not end-to-end encrypted." |
| x0x | unused | none; no TreeKEM receipt exists (`pirate-haul-rulings.md:19`; N:x0x.md §2) |

**Why this lane shape.**
- **Relay acceptance.** The relay already admits kind 1059 signed by a key other than the authenticated member's: there is a pubkey-match exemption (`BZ/crates/buzz-relay/src/handlers/ingest.rs:2023-2028`). So no relay change is needed.
- **Existing parts only.** X-Wing slots, key commitment, and SEAL inside the encryption all exist in bpq.js (`SPEC-BPQ-1.md:144-189`). The slots carry no reader id, so the public head never names readers (`:162-166`).
- **Classical authentication now.** The inner signed kind-14 event gives classical sender authentication immediately, using bChat's existing NIP-01 signer (fixed and cross-verified, `SPEC-BCHAT-1.md:104-113`). Signing it makes the message non-deniable to the recipient. A NIP-17 seal already has that property.
- **Post-quantum sender proof.** Every `T_max`, or every 1,024 messages per conversation, the sender sends a **sealed conversation checkpoint** in the same lane, with SEAL present. It lists, for each covered sealed object, SHA3-256(`AAD ‖ SHA3(KEYS) ‖ SHA3(META) ‖ SHA3(BODY)`). The key commitment `kc` binds `Kf`, so these digests bind the plaintexts (`SPEC-BPQ-1.md:156`).
- **Sender privacy.** The private lane is never listed in public `K_CP` checkpoints, because that would link the sender to ephemeral gift wraps.

Sizes (ARITH, calc-priv.js):

| recipient devices r | private-lane event | with SEAL |
|---|---|---|
| 1 | 4,041 B | 13,629 B |
| 3 (1:1 conversation, 2 + 1 devices) | 8,352 B | 17,867 B |
| 8 | 18,945 B | 28,460 B |
| 29 (maximum under 64 KiB) | about 64 KiB | not under 64 KiB |

For comparison, a classical NIP-17 1:1 message is 5,114 B (two gifts of 2,557 B; calc-nip17.js). Wrapping the sealed object inside NIP-17 instead would cost 14,161 B at r = 2 (calc-nip17.js), which is why the lane uses one 1059 directly.

**Groups.** Groups above about 14 people (29 devices) get no post-quantum confidentiality in BESIDE. A group-key slot type (new slot `to`, new label) is a PQ-lane proposal, P6. Static recipient keys give no forward secrecy. Rotating a device seed (new device id plus binding, old seed destroyed) is the only coarse remedy, and it is stated as such.

**Agents in private conversations.** If any member's bind says `inference:"remote"`, the conversation is shown in a distinct, user-visible mode: "an AI agent here sends what it reads to its model provider". The end-to-end wording is withheld (`LD/AGENT-1.md:30,42-45`).

**Metadata (who sees what):**

| Observer | Sees |
|---|---|
| Community relay | member npubs (pairwise per community), connection times and IPs, channel plaintext, private-lane participant set (p-tags) and timing, each persona's checkpoint count and cadence |
| Community members | the same as the relay for channels; bind events (persona PQ ids) |
| Network observer | TLS endpoints, SNI of the road, sizes and timing |
| Nobody (by design) | device-to-wallet bindings, bzDiD, a persona's other communities |

There is no unlinkability claim and no TAM slice for it (N:critic.md §4.5). Checkpoints add one new leak: activity counts per window. Members pick `T_max` knowing that.

---

## 5. Roads, transport and censorship

**Community charter (`K_CHARTER`).** An addressable event signed by the owner's npub and attested (§5b) by the owner's per-community PQ card.
- Content: `{v:1, seq, label:"skaists.buzz", relay_keys:[NIP-11 self pubkeys], roads:[urls], policy:{T_max, N_max, cache_days, quotas}, archive_hint?}`.
- The NIP-11 `self` key already exists (`BZ/crates/buzz-relay/src/nip11.rs:55,206`).
- Invite links carry the owner's bzpq1 id and the roads (the MULTIRELAY §invite v2, `R/docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:47-48`).
- Clients keep anti-rollback state: a charter with a lower `seq` is refused (DNS block `:37-39`).

**Road list and failover** (the §roads design, `SPEC-BUZZ-MULTIRELAY-1.md:34-50`, built in the fork client and in buzz-acp):
- Try last-known-good road first.
- Transport failure moves to the next road.
- An AUTH denial from a road whose relay key **is** in the charter is terminal (correct fail-closed). An AUTH denial from an unverified road is treated as transport failure, so a captive portal can never stop an agent.
- buzz-acp gains a road list in place of the single `BUZZ_RELAY_URL` (`BZ/crates/buzz-acp/src/config.rs:240`).
- Blossom media URLs are rewritten to the active road for any charter-listed host. Bytes are accepted only if their SHA-256 matches the URL (BUD-01, `BZ/ARCHITECTURE.md:624-625`). That fixes tonight's broken `skaists.buzz/media` links (N:buzz.md §5.4). "Sources may supply records and bytes, never their own authority" (DNS block `:37`).

**Censorship ladder.**
- Rungs: diverse SNI names first (proven: `relay.skaists.dev` passes the filter that resets `skaists.buzz`, `R/docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:7-11`, MEASURED), then alt ports, then obfuscated transport. These are rungs 1-3 of the built ladder `C:/Users/travi/b-onboard/src/ladder.rs:3-12`.
- Veilid stays off by default.
- Every connection carries a receipt "connected via road N, rung M" (`ladder.rs:9-12`).
- "No architecture conjures packets past a filter" (docket R-5, N:buzz.md §5). The honest ceiling: when every rung fails, the state is the named `ONB-G3-04` zero-egress refusal.
- No VPN step, ever (`SPEC-BUZZ-MULTIRELAY-1.md:54-55`).

**x0x's exact role.** None for humans. It is UDP-only with no HTTPS fallback (N:x0x.md §1), so it cannot climb this ladder. Its idle cost and its open delivery defects (N:x0x.md §3-4) rule it out for phones in any case. **Relays' role:** cache, fan-out, membership gate, moderation enforcement, bootstrap. A relay can be replaced by replaying archives and devices into any NIP-01 relay implementation (§10).

**L5 boot gate per session per road** (`R/docs/specs/SPEC-BTUNGSTEN-1.md:146-184`):
1. EXPOSURE: the road answered, at rung M.
2. IDENTITY: the relay `self` key is in the PQ-attested charter, and the charter's `seq` is not below the stored one.
3. PEER: NIP-42 AUTH succeeded as a member.
4. AGREEMENT: the relay serves this persona's own latest `K_CP` id from its journal head.

Only then does the UI say "connected". Nine configured roads are not nine connected roads.

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**Outbox journal (agents and hosts).** A new consumer crate of `bnrose-exec-host`, following the set pattern (`R/docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:14,83`). It reuses `journal::ReplicatedJournal` and `keys::SupervisorKeys` (`R/crates/bnrose-exec-host/src/journal.rs:287-422`):
- Sign the event, then append its exact bytes, fsynced on every replica, **before** publishing to any road. That is the durable-ack definition (`R/docs/specs/SPEC-RUSTEOSVM-1.md:65-71`) once the replicas sit in distinct failure domains. Today the two replicas are two files in one directory (`opexec.rs:103-108`, N:bnrose.md §3.2), and any receipt says "single-domain, not §2.4" until a second domain exists.
- Publishing is the effect. Destination idempotency is free: a relay deduplicates by event id.
- A missing `OK` is **UNKNOWN**, and recovery re-delivers **identical bytes only** (`R/docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43`). Re-signing would change `created_at`, so the id would change and the message would duplicate. That is exactly the "manufacture new authorization" this law forbids.
- The checkpointer reads ids from this journal, so the journal is what makes the PQ claim sound (§3.3).
- Its event codes live in the crate's own file. A shared `E_*` code would be a one-line proposal to ZCode (`browser-recovery-acceptance.md:14`).

**Human devices.** The desktop app keeps a local signed-event log. Browser storage is not durable: 12 s survival was "nondeterministic" (N:bnrose.md §6). So human durability is the archive.

**Offline delivery.**
- While both parties are offline, the community relay holds the message under the community's `cache_days` policy, at the community's cost.
- The sender's outbox retries identical bytes on reconnect.
- No x0x 600 s envelope lifetime applies, because x0x is unused (N:critic.md §4.1).
- No relay is obliged beyond its policy. Expiry is explicit in the charter.

**Retention defaults (ASSUMPTION; policy fields).**

| Store | Default |
|---|---|
| Relay cache | 90 days |
| Device | until the user prunes |
| Archive | as long as the substrate keeps paid data (Autonomi pay-once is CLAIMED, N:paystack.md §2b) |

`retain: until-read | ephemeral` messages are never archived, and `applyRetain` prunes locally and reports (`R/surfaces/bchat-core.js:131-140`). RETAIN/FORGET is "publication-consent routing, not deletion" (`SPEC-BCHAT-1.md:30-35`).

**Archive (user-paid, sealed, batched).**
- **Contents.** A bpq1 sealed object holding a manifest, the exact NIP-01 bytes, the checkpoints, the attestations and the bind events.
- **Readers.** It has one X-Wing slot for the user's **archive persona** card, derived in the wallet with context `buzz:archive`, so it opens from the phrase alone. It also has a device self-slot.
- **Who seals.** Devices seal to the archive persona's public key without holding the root.
- **Routing.** Bundles accumulate to at least 256 KiB, then go to ANT through `ant-pay.js`, the user's own wallet, with an exact-quote approval (`R/surfaces/ant-pay.js:1-22`). The routing rule is from `BUZZ_A_METERING_SPEC.md:127`. Bundles under 256 KiB at epoch end wait locally until the Arweave paid path is receipted. The Turbo free tier is "ArDrive's corporate subsidy, not a protocol guarantee" (N:paystack.md §2b) and is never priced at zero.
- **Receipts.** The spend receipt is `SpendReceipt` in physical units (`ChunkCount`). The 10% tithe line appears only by founder word (N:paystack.md §4).
- **What "durable" means.** The relay can be shut down and every archived record is still readable from Autonomi (`SPEC-PAY-ONCE-NOW-1.md:82-83`). Unarchived history is labelled "on your devices only".

Archive per user-year (ARITH; own sent + received, 3 recipients per message):

| messages/user/day M | data per user-year | ANT chunk payments |
|---|---|---|
| 1 | 3.9 MB | 3 (one yearly file) |
| 10 | 17.8 MB | 5 (one yearly file), or 36 with monthly files of 3 each |
| 100 | 96.7 MB | 24 (one yearly file) |

At the one Arweave price on record ($32.56/GiB, `bzdid-architecture-decision.md:379`), M = 10 would be $0.54/user-year. Amounts are stated in chunks, not fiat (`RULING_B_SPEND_BOUNDARY...:23`).

---

## 7. Scale

**Declared workload model (all ASSUMPTION, with ranges):**

| Input | Value |
|---|---|
| Users N | 10^10, all active daily (upper bound for L1) |
| Messages sent per user per day M | 10 (range 1-100) |
| Delivered device copies per message k | 6 (range 6-200; Buzz community target is 10K humans + 50K agents, `BZ/VISION.md:198-204`, CLAIMED) |
| Devices per user D | 2 (range 1-4) |
| Communities active per user-day | 1.5 |
| Checkpoints per user-day c | 3 (1 at M = 1) |
| Relay cache | 90 days |
| Replicas | D devices + 1 relay cache + 1 logical archive |

**Arithmetic** (calc-lm.js):
- M = 10: per user-day, messages are 5,900 B and PQ checkpoints add 24,988 B (+424%). Attesting each message would add 77,060 B (+1,306%).
  - Globally the sent stream is 308.9 TB/day, about 28.6 Gbps on average, before ×k delivery.
- M = 100: checkpoints add +49% against +1,306% per message.
- M = 1: PQ costs 14× the message bytes, and per-message attestation is cheaper. That is the honest weak spot (§14).

**No global state.** Every state object is per persona, per community or per device: checkpoint chains, bind sets, charters, rosters, caches. Nothing is keyed by the whole population. Chain bytes stay O(1): BESIDE writes none (`bzdid-architecture-decision.md:61`).

**Connection model.** Devices connect only to the relays of communities in active use.
- 10^10 humans ÷ 10K per community = 10^6 community relays (N:buzz.md §2).
- 2×10^10 always-on device connections ÷ 100k per box (CLAIMED, `R/docs/specs/LOADMODEL-1M.md:91`) = 200,000 boxes. At 10% concurrently connected it is 20,000 boxes (ARITH).
- Community count, not connections, binds: about 10^6 boxes if each community runs one.
- At about $100/month per box (CLAIMED, `LOADMODEL-1M.md:87`), a 10K-member community pays about $0.12 per member-year (ARITH). That cost lands on the community, never on BNR.

**Mobile and push.** Phones are never x0x peers. They sync in the foreground and use OS-permitted background fetch. The iOS content-free push through Buzz's vendor gateway (`BZ/docs/push-gateway-deployment.md:3,22,35`, per N:critic.md §4.6) is an optional enhancement, never required (E11). Android has none.

**Sharding and federation.** A community is the shard. Cross-community DMs do not exist (Buzz DMs stay inside one community, `BZ/NOSTR.md:14-20`). Relay-to-relay replication inside one community (§fractal, "SPEC'd here, BUILT nowhere", `SPEC-BUZZ-MULTIRELAY-1.md:89`) would ride NIP-01 itself, with a relay acting as a client of a charter-listed peer. That is P6.

**Verify-CPU budget.**
- Relays verify Schnorr per event, as today. They need not verify ML-DSA.
- A client verifying every checkpoint it receives does about 9 ML-DSA-65 verifies per device-day at M = 10, c = 3, k = 6, D = 2. Globally that is 2.08×10^6 per second (ARITH).
- Auditing a whole 10K-member community-year is about 10K × 2 × 365 × 1.5 ≈ 1.1×10^7 verifies (ARITH).
- No estate receipt for ML-DSA-65 verify throughput exists (N:scale.md §5). P0.b produces one. Until then every CPU line above is UNVERIFIED.

---

## 8. Economics: every resource, its payer, and the ten-billionth user

| Resource | Payer of record | Meter / unit | Free tier |
|---|---|---|---|
| Identity, personas, keys | nobody (zero bytes) | none | free (`bzdid-architecture-decision.md:59`) |
| Device storage and CPU (signing, sealing, verifying) | the user's own device | none | free (own hardware) |
| Community relay (connections, egress, cache, Schnorr verify) | the community, as its members decide; BNR only for its fixed bootstrap seeds | B1 classes if E3 is ruled; otherwise a community-internal matter | whatever a community admits free; a full seed returns a named refusal |
| `K_CP`/`K_ATT`/`K_BIND` storage on the relay | the community (per-member quota bounds it) | `StorageByte` (E3) | within quota |
| Archive bundles | the user, from their own wallet through bPay/ant-pay | `ChunkCount` (+`ChainFee` gas), `SpendReceipt` | `FloorRefusal`: "archive not funded; history on your devices only" (CD-13, `R/docs/feature-backlog.md:302-306`) |
| OTS stamps | public calendars (hash-only); no BNR cost | none | free |
| x0x (P6 only) | the relay operator who opts in | none | n/a |
| Push | the vendor gateway's operator; enhancement only | none | optional |

**The ten-billionth-user test** (`R/docs/dispatches/RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:9-27`). User 10^10:
- creates a bzDiD (0 BNR cost);
- joins a community whose relay its members fund (0 BNR cost);
- signs and checkpoints on their own device (0);
- archives with their own wallet or not at all (0).

BNR's standing cost is S bootstrap seeds, fixed in count and capacity. It does not grow with N, which is what Art. V.1 allows (`CONSTITUTION.md:83`). The negative control from B1 (`BUZZ_A_METERING_SPEC.md:106-108`) becomes a test: one BNR-funded rail settling two users' archive spends **must FAIL**.

**Spam.**
- Write access is membership-gated per community ("Channel membership is the only gate", `BZ/VISION.md:37`).
- Per-member fixed-window quotas apply to all kinds. Attestation events are rate-limited, for example one per minute per persona, so their 7.7 KB stays bounded.
- Wallet-gated per-address quotas apply to any server work (`RULING_WALLET_GATED_OPS_2026-08-20.md:42-49,61-63`). Moderation is the third fence.
- Free senders are unbounded at the identity layer by construction ("machine DIDs cost nothing", N:law-identity-scale.md §5). So the community gate, not postage, is the fence (E9).

---

## 9. Moderation and abuse

- **Per community, relay-enforced.** Buzz moderation kinds 9040-9044 and reports 1984 to a moderator-only queue. "Reports are signals, never triggers" (`BZ/crates/buzz-relay/src/handlers/ingest.rs:356-358`).
- **No universal reputation** (`CONSTITUTION.md:107`). The kernel is blind to spam and harassment; "That observability lives at the social layer or nowhere" (`R/docs/BIND-1.md:108`).
- **No platform-safety operator for other communities.** BNR operates only its seed community. Each community operator answers for its own cache.
- **Removal is honest.** A ban or deletion removes from that relay's cache. Copies on members' devices and in authors' sealed archives persist, and the UI says so ("no deletion promise exists anywhere").
- **Illegal content on permanent rails is a counsel gate (E8).** BESIDE never writes public-room plaintext to Arweave or Autonomi.
- **Agents.** Untrusted text never shares context with write authority (AGENT-1 Q-2). Agents gain no new autonomous posting powers (E16 leaves Q-3 as is).
- **Biometrics.** No face or voice comparison anywhere, at any gallery size (`LD/BIO-1.md:38`; B-4 `:44`).

---

## 10. 1,000-year continuity

**Crypto agility.** Every PQ object carries a version or algorithm id and refuses unknown ones (§3.2). The classical dependencies stay listed: NIP-01 SHA-256 and Schnorr, NIP-44, TLS (N:buzz.md §7). "An ML-DSA wrapper does not replace secp256k1" (N:pq-tungsten.md §4) is respected by wording: "settled", never "PQ-signed event".

**Re-anchoring history.**
- *Living author, ML-DSA retiring:* after an SLH-DSA handover, the successor key attests one summary checkpoint listing the old checkpoint ids.
- *Hash weakening:* archive keepers renew OpenTimestamps evidence under a new hash before SHA-256 weakens (RFC 4998 model, `SPEC-BPQ-1.md:120-125`).
- *Dead author:* authorship after a break rests on pre-break evidence: attestation plus timestamp. It is never re-signed. That is stated plainly.

**Formats.** NIP-01 (pinned text mirrored into the archive spec, MIRROR-BY-LAW `pirate-haul-rulings.md:12`), the bpq1 sealed object ("decoder of record", `SPEC-BPQ-1.md:9-10`), and the fixed-width checkpoint list. An airgapped verifier needs only SHA-256, SHA3, AES-GCM, HKDF and FIPS 203/204/205, plus secp256k1 to check the classical layer (`pirate-haul-rulings-2026q3.md:86`).

**Time (L4).**

| Field | Representation | Declared horizon |
|---|---|---|
| Nostr `created_at` | JSON integer seconds | refuse beyond 2^53−1 (the JS exact-integer limit) |
| bChat `ts` | milliseconds | JS `Date` limit, 8.64×10^15 ms (year 275,760) |
| Checkpoint `range` / `seq` | canonical decimal strings: no sign, no leading zero, no exponent | refuse beyond 2^53−1 |
| OpenTimestamps proofs | Bitcoin header `nTime`, u32 | 2106-02-07 (N:pq-tungsten.md §1.3); renew under another time authority before then |

Fail closed before every horizon; never wrap.

**Protocol upgrades in a mixed-version mesh.**
- New kinds, lanes and statement versions are added, never redefined. Deprecation windows are measured in years (`CONSTITUTION.md:92`).
- Old clients ignore unknown kinds; stock relays refuse them, and status degrades to "classical only".
- Kernel invariants change only through Art. VI §3 (N:critic.md §2).
- Fork releases carry SPEC-BPQ-1 §3b detached signatures (`SPEC-BPQ-1.md:127-143`). Release-custodian succession belongs to kc/integrate.
- Upstreams (Block's Buzz, single-maintainer x0x) are pinned and mirrored. The fork is the seam (`pirate-haul-rulings.md:12,18`).

**Extinction drills.** Each is one §11 row: secp256k1, ML-DSA-65, SHA-256, the relay implementation, the Buzz desktop, the DNS name, BNR's seed, the clock representation.

---

## 11. bTunGsTeN conformance matrix (receipts to earn; none claimed)

Evidence classes are as ruled (`SPEC-BTUNGSTEN-1.md:269-295`; `SPEC-BTUNGSTEN-PQ-1.md:32-43`). Pass/fail criteria are fixed here, before any run.

| Axis / law | Test family | Pass / fail (named before the run) | Evidence class | Teeth (same job) |
|---|---|---|---|---|
| 1 Decentralization | PQB-REMOVE: block DNS of every road name, remove the original edge, stop BNR's seed, delete the client profile, build the client from the pinned mirror | PASS: from invite material alone, a clean client reaches the same charter-authorized community through a replacement relay seeded from archives and devices, reads attested history, and makes one bounded post. FAIL: any step needs a BNR operator, the original DNS name or the original profile. | live receipt, private infra (DNS block `:52-57`) | a road with a non-charter relay key must be refused before AUTH |
| 2 Sybil/MiM | PQB-FORGE: an adversary holding the author's nsec (stand-in for a quantum forger) publishes events and bind changes; replays a checkpoint into another community; equivocates (two attested `K_CP` with the same `prev`) | PASS: zero adversary events shown as PQ-settled; an unendorsed bind is never adopted; equivocation is shown as evidence, with neither side chosen silently. Uniqueness: out of scope, no claim. | CI vectors + live drill | planted verifier that accepts an unlisted id → must be convicted |
| 3 Healing | PQB-HEAL: kill -9 at every outbox step; corrupt one journal replica; partition the relay; withhold one checkpoint | PASS: no duplicate ids after recovery (identical-bytes redelivery); degraded replica rebuilt; a prev-chain gap shown as UNKNOWN, never green; outage duration printed (healing never conceals interruption, `R/docs/dispatches/2026-10-13-btmd-scale9-study.md:115-117`) | live + CI | planted re-sign-on-UNKNOWN worker → must be convicted |
| 4 Learning | PQB-ROADMEM: road memory is the only adaptive state | PASS: a learned choice never leaves the charter list; every choice is logged; resetting it is reversible | CI | memory poisoned with a foreign road → refused |
| 5 >10B | PQB-SCALE: the §7 bounds plus rungs: 1 community (4 devices + 18 agents) → 10^2 synthetic personas → 10^4 (Buzz's own target); no rung skipped (`LOADMODEL-1M.md:137`) | PASS per rung: measured bytes per persona-day within 1.2× the model; ML-DSA verifies per device-day within budget; relay state independent of global N | MEASURED per rung; "a single-host test is not a mesh result" | model fed n = 0 checkpoints → refused (T-VACUOUS) |
| 6 Continuity | PQB-EXTINCT rows: secp256k1 broken (accept PQ-settled only); ML-DSA retired (handover + summary re-attest); SHA-256 weakening (OTS renew); relay software replaced by a different NIP-01 relay; Buzz desktop replaced by the bChat surface | PASS: each row recovers the same authorized history with no original component in the path | live drills + vectors | each drill also runs its "skip the step" control, which must fail |
| L1 | union of axis 6 rows plus DNS and organization extinction | no dependence on any original key, algorithm, clock, chain, organization or UI | as axis 6 | as axis 6 |
| L2 | PQB-EXPIRY | an agent endorsement beyond the policy maximum is refused; expired endorsements show "expired" | CI | endorsement with no `expires` → refused |
| L3 | PQB-BOUND | no object keyed by population; per-community state measured flat while N grows across rungs | MEASURED | a global-roster code path planted → audit test convicts |
| L4 | PQB-TIME | values at 2^32 s, 2^53−1, and beyond each horizon: refused, never wrapped; leading zeros, exponents and signs refused | CI | truncating encoder planted → convicted (WB004 precedent, N:pq-tungsten.md §5) |
| L5 | PQB-BOOT: four-receipt gate per session per road | "connected" appears only after AGREEMENT; configured ≠ connected | live receipts | relay that never serves the persona's own head → UI must stay "not connected" |

**Formal obligations** (WB001 ladder: RED counterexample → accepted-language repair → shared vectors → TYPECHECK → CHECK-SAMPLED → PROVE-UNIVERSAL at fixed shapes):
- **F1 `nip01SerInjective`.** NIP-01 id serialization is injective over the accepted language: strict UTF-8, the deployed escape set, integer fields with no exponent. The bChat "0" marker bug is the RED precedent (`SPEC-BCHAT-1.md:104-109`). This matters most because every checkpoint commits to ids.
- **F2 `cpCodecInjective`.** decode∘encode = identity over canonical base64url with zero tail bits, for n in [1, 1,024].
- **F3 `domainsDisjoint`.** Unchanged, because no new label is added (PQ04 receipt stands).
- **F4 equivocation detector.** Two attested checkpoints with the same `prev` are always reported (CHECK-SAMPLED).
- **Teeth for every gate:** T-VACUOUS (n = 0, empty card set, empty attestation) and T-TRUNCATE (last byte flipped at n ∈ {1, 2, 3, 1023, 1024}, which straddles the base64 3-byte groups) (`SPEC-BTUNGSTEN-PQ-1.md:89-113`).

---

## 12. Migration from today's Buzz

1. **M0 inventory (read-only).** Record the relay image digest on Hostinger, Postgres event counts by kind and author, media objects, and the 18 agents' npubs and owners. The current relay image is UNVERIFIED (N:buzz.md §10).
2. **M1 roads.**
   - The fork desktop and buzz-acp get road lists.
   - AUTH, canonical origin and kinds are unchanged, so no agent changes identity and no AUTH denial can occur from migration.
   - Media rewrite fixes the old `skaists.buzz/media` URLs.
   - buzz-cli keeps its JSON contract (`BZ/VISION.md:163`) and gains only a road-list flag.
3. **M2 PQ binds.**
   - Founder devices: one press per device in the wallet (founder law: one-click sign).
   - Agents: the harness seed plus an owner endorsement with expiry.
   - The relay fork accepts the four kinds.
4. **M3 retroactive checkpoints.** Each author's own historical event ids, taken from **their own** export and not from the relay, are checkpointed and attested now, then OTS-stamped. The claim is "attested at T_now, before any break", never "attested at send time".
5. **M4 archives.** Sealed bundles of the estate's own history go to ANT, paid by the account that consumed them. Acceptance is the relay-shutdown drill (§13 P4).
6. **Old npubs** stay valid personas. Nothing is archived away. NIP-IA is optional.

---

## 13. Build plan

Owner seats are suggested; Seat 1 assigns. Every acceptance criterion is a receipt computed from observations, with CI's verdict on the landing commit as the receipt where CI applies (`R/docs/RULINGS-2026-08-26.md:48-52`).

| Phase | Owner (suggested) | Reuses | Acceptance (receipts) | Unblocks |
|---|---|---|---|---|
| **P0 (now; no ruling needed)** | | | | |
| P0.a Roads | Buzz fork lane (zCode desktop builds) | MULTIRELAY §roads, buzz-studio ROAD MEMORY, live dual-home server, b-onboard ladder rungs 1-2 | Unit tests for road parsing, failover classes and media rewrite. Live drill on the building network with `skaists.buzz` reset by SNI: cold start of the desktop and all 18 agents with **0 manual actions**; per-agent receipt "road 2, rung 1" with time-to-connect; media opens with SHA-256 verified. | the incident class is closed |
| P0.b Numbers | PQ lane / Claude Code seat | btungsten-pq (RustCrypto ml-dsa 0.1.1, libcrux 0.0.11), bpq.js (noble) | ML-DSA-65 keygen/sign/verify ops/s on Hostinger, the laptop and one phone browser, labelled LOCAL, with versions and n. Read-only relay inventory (M0). | every UNVERIFIED CPU line in §7 |
| P0.c Spec + vectors | bChat lane (zCode, genesis author) | SPEC-BCHAT-1, bpq.js `attestNostr`, frozen `bsigner bpq-verify` as independent verifier | A SPEC-BCHAT-1 §pq addendum (kinds, codec, verification algorithm, exact claim wording). CI job: JS-made checkpoints and attestations verified by bsigner (independent library). T-VACUOUS and T-TRUNCATE teeth convict planted faults in the same job. | P1 |
| **P1** Agent checkpoints | Buzz fork lane + PQ lane | buzz-acp sign hook, Node + bpq.js sidecar, the four relay kinds | 24 h live receipt: every outbox id appears in exactly one attested checkpoint (count match, 0 gaps). Forge drill on private infra: nsec-holding adversary gets 0 PQ-settled events. | PQ authorship for agents |
| **P2** Charter + L5 + human devices | Buzz fork lane + kc/integrate (origin) | bpq.js in the desktop webview, the wallet binding press, OTS | PQB-REMOVE decisive test passes. Non-charter key refused. Lower-`seq` charter refused. L5 four receipts per session. | DNS independence for the community |
| **P3** Outbox durability | new `bnrose-exec-host` consumer crate (ZCode seam) | `ReplicatedJournal`, `SupervisorKeys`, UNKNOWN law | kill -9 at each step gives 0 duplicate ids. Two failure domains, or the receipt says single-domain. PR #444's two-host harness when it lands. | §2.4 durable ack for agents |
| **P4** Archives | ANT pay lane | `ant-pay.js`, bpq sealed object, `SpendReceipt` | Relay-shutdown drill: a fresh relay rebuilt from archives and devices; 100% of attested checkpoints re-verify. The shared-funder negative control FAILS as required. | pay-once-now acceptance for messages |
| **P5** PQ-private lane | bChat lane; Rust/Node twin for agents | bpq.js X-Wing slots, SEAL, bChat v2 | Cross-implementation vectors (seal in JS, open in a second implementation). Sealed conversation checkpoints. Remote-inference mode shown. r ≤ 29 enforced. | PQ confidentiality for DMs and small groups |
| **P6** Ruling-gated switches | per ruling | — | Each switch lands only with its ruling cited: x0x road (E1), relay metering (E3), postage (E9), public archive (E8/counsel), group-key slot and card-reference statement (PQ lane), x0x commitment beacon (measured first) | — |

---

## 14. Open questions and risks

1. **Low-volume users pay more than they send.** At M = 1, PQ settlement costs 8.2 KB/day against 0.6 KB of messages (ARITH). A card-reference statement would cut 34%. Longer `T_max` trades against settlement latency.
2. **The settlement window.** Between send and checkpoint, a quantum forger of an npub can inject classical-valid events. They are flagged only as "not yet settled". Members must read that word. Status is shown as words ("Signed", "Settled", "Not yet settled", "Unverified"), never as colour alone; no new UI styling is proposed here.
3. **Pinning is trust-on-first-use before the break.** Newcomers after a break rely on OTS evidence, and OTS rides Bitcoin's u32 time (2106).
4. **No end-to-end encryption for channels, and no PQ confidentiality above about 14 people.** No forward secrecy anywhere.
5. **Scale is federated, not demonstrated.** About 10^6 community relays are each funded by their community. Relay-to-relay replication is unbuilt. Newcomers' access to history older than the cache is unresolved without counsel (E8).
6. **Dependency risks.**
   - The fork sits 354 commits behind upstream (N:buzz.md §0). Four new kinds may collide upstream.
   - Rust sealing to X-Wing slots does not exist; bsigner seals only "self" (`SPEC-BPQ-1.md:3-6`).
   - JS ML-DSA is not claimed constant-time (`SPEC-BPQ-1.md:270-272`).
   - ml-dsa 0.1.1 is unaudited (N:pq-tungsten.md §2).
7. **Readings this design depends on.** E2 (bChat, not Buzz, is the privacy layer) and E4 (harness custody of agent PQ seeds) could each be ruled the other way. Both have switches.
8. **x0x gets almost nothing.** The founder asked for a "PQ buzz x0x/BNRoSe upgrade". Under current PLANE LAW the lawful answer gives x0x no human-plane role. If the founder wants one, E1 is the ruling to ask for, and the switch is ready.
9. **Huddle transcripts.** Whether on-device transcripts are body-derived bits under BIO-1 B-1 (`LD/BIO-1.md:35`) is unasked. Transcripts are not part of BESIDE.
10. **The heartbeat.** AGENT-1 Q-5's heartbeat puts a periodic press on the owner (E16). The interval is the founder's to set.
