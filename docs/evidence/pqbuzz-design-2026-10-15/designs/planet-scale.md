# PQ Buzz COMB: cell-only messaging with no global state (planet-scale angle)

Design seat: planet-scale (tungsten axis 5 and L1). Written 2026-10-15. Read-only on every repository; nothing here is built, run or ruled.

Path keys: R = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`); BZ = `C:/Users/travi/buzz-src`; X0X = `C:/Users/travi/x0x-pr` (checkout `e0af580`, 2026-09-15); LD = `C:/Users/travi/LOVErnment-DAO/specs`; N = the reader notes in `scratchpad/pqbuzz/`. Classes: RULED, MEASURED, SOURCE, CLAIMED, UNVERIFIED, ASSUMPTION (an input this design chose), ARITH (computed here, shown).

---

## 0. Thesis and name

**COMB** (Cell-Only Messaging Bus) is PQ Buzz expressed as bChat Core envelope v2 plus adapters, organized so that **no component anywhere holds global state**. The unit of scale, of privacy and of payment is the **cell**: one conversation (a DM, a group of at most 256 device leaves, or an open channel). A cell's messages live on its members' devices (the system of record, local-first) and, for delay tolerance, on 2 or more **keepers** that the senders pay per byte and per byte-day; keepers are cache and mailbox, never record (R/docs/SPEC-PAY-ONCE-NOW-1.md:65-67). Nothing is global: no directory (invites carry roads), no presence (a live connection to a cell's keeper is the only "online"), no log (per-sender chains inside cells), no roster (membership is per cell), no total order, no reputation. Per-message ML-DSA is replaced by **checkpoint signatures**: one ML-DSA-65 signature covers a sender's last b messages in a cell, so at b = 16 a 200 B text costs 632 B on the wire instead of 3,968 B (ARITH, §3). The scale claim is a **locality law**: every node's load is a function of the cells it belongs to and has zero dependence on world population N. That law is checkable on a physical ladder (1 host, 9, 100, 1k, 10k, then simulation), and each rung names the bound it checks before it runs. COMB claims no tungsten conformance; it names the receipts it would earn (R/docs/specs/SPEC-BTUNGSTEN-1.md:28-31, N/pq-tungsten.md:12).

---

## 1. Plane mapping and ESCALATIONS

**Plane mapping under the current ruling** (PLANE LAW, R/docs/ledger/pirate-haul-rulings.md:18):

| COMB part | plane | lawful because |
|---|---|---|
| cells, envelope v2, keepers, roads | Buzz = human plane | Buzz rides on top; keepers are cache/mailbox with retention R, never record (:17; SPEC-PAY-ONCE-NOW-1.md:65-67) |
| agent-to-agent task coordination inside one owner's 2-5 machines | x0x = machine plane | x0x's stated scope (N/x0x.md:48); decisions that touch humans are posted into a cell as Tier-S messages (X-2 bridge) |
| member archive batches (sealed, monthly) | Autonomi durable / Arweave permanence | user-paid, routed < 256 KiB to AR and >= 256 KiB to ANT (R/docs/dispatches/BUZZ_A_METERING_SPEC.md:127) |
| postage settlement | settlement rails via bPay | A as unit of account; rail chosen by bPay (N/paystack.md:33-34) |
| nothing | chain | zero chain bytes per user and per message (R/docs/bzdid-architecture-decision.md:61) |

**ESCALATIONS** (named, not resolved):

| # | collision | cited rule | COMB without a ruling | switch if founder rules otherwise |
|---|---|---|---|---|
| E1 | "Buzz over x0x" | PLANE LAW, X-1, X-3 (pirate-haul-rulings.md:18) | x0x carries no human cell traffic; machine plane only | add road type `x0x` to the cell road list for agent-only cells on desktop/server devices; keepers still hold data (X-3 kept); no format change |
| E2 | E2EE cells and keeper mailboxes make Buzz a privacy and storage layer | Buzz "NEVER a storage/permanence/privacy/settlement layer" (:17) | keepers hold ciphertext <= R days as cache; no confidentiality claim until P1 receipts (§4) | if ruled out: cells run in "open" kind only (integrity, no sealing); format unchanged (suite id selects) |
| E3 | COMB vs bChat as the ordered stack | SPEC-BCHAT-1 is "our messaging/DM/chat stack" (R/docs/specs/SPEC-BCHAT-1.md:3-6); "start no competing ... system" (N/critic.md:28) | COMB is presented only as bChat Core envelope v2 + adapters; v1 NIP-17 lane untouched | if founder wants a separate system name, nothing structural changes |
| E4 | kernel `MessageEvent{from_did,to_did}` in clear | R1 no public human-object mapping (R/docs/RULINGS-2026-09-16.md:26-29); events.rs:212-219 | COMB never emits `MessageEvent`; proposes an additive `CellEpochCommitted{commit32, epoch, content_ref}` with no DIDs | if ruled that bus events are never public, `MessageEvent` could be emitted locally only |
| E5 | sender-pays postage vs free access | "No person pays to *use* a BNR function" with physical consumption metered (R/docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11) | postage is only NetByte + StorageByte at keepers; direct device-to-device delivery costs nothing; access is never priced | if founder rules postage is access: keepers become user-run only (home nodes), store-and-forward degrades to "both online or own keeper" |
| E6 | prepaid postage batch is a per-identity float | Rail C (N/law-constitutional.md:59) | float is optional, user-sized, user-held; zero-float users pay per session; free tier holds none | if ruled forbidden: per-session payment only |
| E7 | vendor push wake-ups | VENDOR-HELD enhancement-only (R/docs/RULINGS-2026-09-30.md:23-28) | no push at all; delivery waits for foreground | content-free wake-up through a push gateway, sender-paid; delivery semantics unchanged |
| E8 | illegal content with no operator; permanent rails | BIND-1 :108; SPEC-BLICENSE-0 :187-191 counsel gate (N/critic.md:177-198) | COMB never writes plaintext to a permanent rail; public permanent publication is gated off | counsel decides; COMB adds whatever routing counsel rules |
| E9 | social recovery | "must require the original body" (CLAIMED-as-ruling, N/critic.md:163) | social re-admission to cells only; nobody rotates another's bzDiD | if ruled in: a recovery cell kind; no format change |
| E10 | new domain labels on a SAW-proven layout; bSigner freeze | R/crates/bsigner/CONTRACT.md:3-7; R/crates/bpq-core/src/layout.rs:39-40 | new `bzc1/` labels in a new crate; bpq-core and bsigner untouched; disjointness proved against the bpq1 set | if founder prefers `bpq1/buzz-*` labels: they extend the 14-label set (each label <= 20 B, `DOMAIN_CAP`, layout.rs:40,61-63) and PQ04 re-proves `domainsDisjoint` |
| E11 | BNRoSe leg | every BNRoSe doc declares L1/L2/L3 (R/docs/SPEC-BNROSE-0-CHARTER.md:36-39) | keeper forwarding = L3 (LOADMODEL precedent, R/docs/specs/LOADMODEL-1M.md:6); archives = L1; the live cell log fits no leg and is said so | founder places it |
| E12 | physical rungs 100+ need hosts | founder scope "four devices and the hostinger vps" (N/buzz.md:124) | P0-P2 stay inside scope; rungs 100/1k/10k wait | founder funds/authorizes a test fleet |
| E13 | b in the Buzz loop (B1 :80-82 vs hierarchy "earn b", N/critic.md:63-69) | as cited | A only | none |
| E14 | BNR's legacy relay as keeper | Art. V.1 (CONSTITUTION.md:83) vs B1 rule 2 (:105) | keeps only the founder's community cells | founder rules who pays |
| E15 | A metering without Vaulta accounts | bzdid :61; 12.7M-30.0M fit (N/law-identity-scale.md:82) | A = unit of account; bPay picks rail | founder rules rails |
| E16 | agent replies, agent roots | AGENT-1 Q-3 :160-163; hierarchy | owner-attested expiring leaves | per ruling |

---

## 2. Identity, devices, agents, keys, succession, recovery

- **Root.** The only root is `did:b:` (R/docs/VOCABULARY.md:220-226). Every COMB key is a bound persona.
- **Device.** Each device has its own bzpq1 identity bound by the two-signature binding; "The bzDiD phrase is never loaded onto a device" (R/docs/RULINGS-2026-10-04.md:59-66). One device = one cell leaf. No key copying between devices, which avoids the x0x second-device rule (N/critic.md:326).
- **Per-cell persona.** On join a device makes a fresh ML-DSA-65 key for that cell, bound to the user's bzpq1 id by a SPEC-BPQ-1 binding of claim kind `bzc-persona` (fits `^[a-z0-9][a-z0-9._-]{0,31}$`, SPEC-BPQ-1.md:107). The binding travels only inside the cell's sealed membership credential: pairwise by default (N/law-identity-scale.md:51), never a public mapping (R1). One-time cost per member per cell: pk 1,952 B + binding (about 5.5 KB, UNVERIFIED).
- **Rotation never orphans data:** records key off the bzDiD in the user's private archive index (R/docs/CONSTITUTION.md:49); a rotated persona is a new leaf bound to the same id.
- **Agents.** A leaf whose credential carries an owner attestation with expiry <= 30 days (ASSUMPTION; L2, SPEC-BTUNGSTEN-1.md:110-120; "Authority expires", LD/AGENT-1.md:168-169). Revocation is the owner device's remove commit, signed offline and delivered when any road opens (A-10, LD/AGENT-1.md:73-74). A cell with a remote-inference agent shows "a remote model reads this cell" (LD/AGENT-1.md:30,42-45).
- **Succession.** SLH-DSA handover (49,856 B, once per era, SPEC-BPQ-1.md:190-209). The spent-once log the spec leaves unowned (:208-209) is kept per cell, so no global log-keeper is needed.
- **Recovery.** Lost device: a sibling device commits its removal. Total loss: recover the bzDiD by r1, the written code (R/docs/bzdid-architecture-decision.md:49-50), then knock; any cell admin re-admits after checking the binding. That is **social re-admission, not social key recovery** (E9). RP-domain loss touches only r0; COMB keys are not WebAuthn credentials and devices enroll device-to-device (X-Wing v2 bridge pattern, N/pq-tungsten.md:108). A recovered user reads only archive batches sealed to their self slot plus what members re-send; history sealed only to lost device keys is gone by design, and the UI says so.

---

## 3. The envelope of record

**One format of record:** bChat Core envelope **v2**, canonical binary, strict decoder, WB001 discipline (fixed order, explicit lengths, every ill-formed input refused, SPEC-BTUNGSTEN-1.md:256-267). Other formats keep narrower roles: NIP-01 = legacy adapter; x0x `DmEnvelope` = road wrapper; CanonicalEvent = commitments only; WB001 = authorization intents; `bheart.signature/1` = file signatures, untouched.

- **Outer header, in clear, 54 B:** magic "BZ" + major + minor (4); suite id u16 (2); rotating mailbox tag (16); key epoch u32 (4); encrypted sender data = slot u32, generation u32, reuse guard u32 + AEAD tag (28).
- **Suite `0x0001`** = AES-256-GCM, X-Wing draft -11 sealed slots, ML-DSA-65, SHA3-256; ids added, never redefined; unknown ids refused (SPEC-BPQ-1.md:265-269).
- **Body:** AES-256-GCM, 16 B tag; inner plaintext `type u8, flags u8, ts i64 ms, body_len u32` (14 B) + body, padded inside the ciphertext to a multiple of 128 B.
- **Message id** = (cell, slot, generation); duplicates refused. **Leaf digest** = SHA3-256(`bzc1/leaf` ‖ cell_id ‖ slot ‖ generation ‖ canonical inner plaintext): it covers plaintext, so a signature survives re-encryption and archiving.

**Three signature tiers.** (1) *Group-authentic on receipt:* per-sender chain keys are known to every member, so this proves "a member sent it" (in a DM, the pairwise key makes it sender authenticity). (2) *Checkpoint, PQ and transferable:* body `alg u16, persona_ref 32, gen_start u32, count u16, leaf_digest[count] x 32, sig 3,309`; signed message `bzc1/checkpoint ‖ cell_id ‖ slot ‖ gen_start ‖ count ‖ SHA3-256(leaf_digests)`; emitted after b messages, 60 s after a burst ends, or before any Tier-S action, whichever first; the leaf list lets a holder of any subset verify what it holds. (3) *Tier-S control* (membership, keeper set, agent grants, moderation): individually ML-DSA-65 signed, with expiry.

**Sizes, computed** (payload p = 200 B; overhead 54 + 16 + 14 = 84 B; 284 B padded to 384 B; checkpoint = 3,381 + 32b + 84, padded):

| b | checkpoint padded | per message share | wire bytes / message | vs per-message ML-DSA (3,968) | vs Nostr-shaped 428 B (N/scale.md:81) |
|---|---|---|---|---|---|
| 1 (no amortization) | 3,584 | 3,584 | 3,968 | 1.00x | 9.3x |
| 4 | 3,584 | 896 | 1,280 | 0.32x | 3.0x |
| 16 | 3,968 | 248 | **632** | 0.16x | 1.48x |
| 64 | 5,504 | 86 | 470 | 0.12x | 1.10x |

Arithmetic for the b = 16 row: 2 + 32 + 4 + 2 + 512 + 3,309 = 3,861; plus 84 = 3,945; padded to 3,968; 3,968 / 16 = 248; 384 + 248 = 632.

At b = 16 the signature is 3,309/16 = 207 B of 632 B, which is 33% of the bytes. Per-message signing would make it 83% (3,309/3,968). The honest cost of amortization is a window of up to b messages, or 60 s, during which authenticity is group-level only. If a sender's device dies before checkpointing, those messages stay group-authentic forever, and the UI shows that state (§4).

**Compatibility.** NIP-01: a bridge maps channel events both ways; Schnorr stays labeled classical (N/pq-tungsten.md:105-107); a PQ13 attestation may ride as a Tier-S message naming the event id (SPEC-BPQ-1.md:211-227). bChat v1 (SPEC-BCHAT-1.md:65-71): `ts`, `from` (slot to persona to bzDiD), `body`, `attachment` (addr, bytes, sha3), `policy.retain`, `claims` map into v2 inner content; the v1 NIP-17 lane stays an adapter. CanonicalEvent: one additive variant only (E4), allowed by its version-by-addition rule (N/critic.md:89).

---

## 4. Confidentiality: pairwise, groups, metadata, exact wording

- **Pairwise (DM cells).** The handshake is X-Wing (bpq-core, Appendix C 3/3 KAT, combiner PROVEN glue, N/pq-tungsten.md:73). It is authenticated by both personas' ML-DSA keys and followed by a symmetric chain. The PQ rekey (2,336 B, i.e. 1,120 ct + 1,216 pk) runs weekly or every 256 messages, whichever comes first (ASSUMPTION). That costs 2,336/42 = 56 B per message at 6 messages per pair per day; daily rekey would cost 389 B (ARITH). DM cells default to **deniable** (no checkpoints). Work, agent and governance cells default to checkpointed. The cell kind decides, and the UI shows it.
- **Small groups (2-32 leaves), phase P1.** Sender keys are distributed as SPEC-BPQ-1 sealed objects, with one X-Wing slot per member; "Slots carry no reader id" (SPEC-BPQ-1.md:162). After a removal, each remaining member downloads about (n'-1)^2 x 1,168 B. That is 42 KB at n = 8 and 1.05 MB at n = 32 (ARITH; slot size 1,120 + 48 is an ASSUMPTION). Cells are capped at 32 for this mode. Only estate primitives with existing KAT receipts are used.
- **Groups of 33-256 leaves, phase P3.** A pinned MLS/TreeKEM implementation with a PQ KEM and ML-DSA credentials, used for the key schedule only; application data rides exporter-derived per-sender chains plus checkpoints, because RFC 9420 application messages carry a per-message signature (N/scale.md:84) that would erase amortization. Commit C(n) = ceil(log2 n) x 2,336 + 3,509 = 10,517 B (n=8), 17,525 (64), 22,197 (256); with weekly per-leaf updates each leaf receives 10.5 / 157.7 / 808.6 KB/day (ARITH). At n = 1,000 a leaf would receive 3.83 MB/day and hold 6.45 MB of tree state, so the cap is **256 leaves**; larger audiences are open or broadcast cells. No candidate is assumed: x0x saorsa-mls has no RFC 9420 interop and conflicting multi-member evidence (N/x0x.md:54-60).
- **Metadata.** The header carries no DID, npub, static key or recipient; the tag is the first 16 B of SHA3-256(`bzc1/tag` ‖ epoch secret ‖ window), rotated daily; padding is 128 B steps. A keeper learns which IPs post to and fetch from which rotating tags, when, padded sizes, and a per-keeper postage pseudonym linking one payer's posts at that keeper. Keepers are spread over many operators (§7), so no party is handed the social graph by protocol, but a keeper watching IPs can still link. The onion road (Veilid rung) exists and is "NOT a default; documented as the extreme" (R/docs/dispatches/OPTIONS_PRIVATE_LOOKUP_BOUND_2026-08-08.md:50).

**Allowed wording** (ceiling "sound by construction / isolated by design", SPEC-BTUNGSTEN-1.md:35):

| property | allowed sentence | when |
|---|---|---|
| header | "isolated by design: the envelope header names no sender, recipient or identity" | after the rung-1 header-scan test passes |
| content, small groups | "sound by construction: contents are readable only by holders of the cell's current keys, distributed under X-Wing; a removed member cannot read messages sent after the removal rotation completes" | only after P1 local encrypt/decrypt + rotation-on-removal receipts; never before |
| content, 33-256 | none | until P3 receipts at a pinned version (pirate-haul-rulings.md:19 pattern) |
| authenticity | "group-authentic on receipt; ML-DSA-65-signed by its sender within one checkpoint" | after rung-1 checkpoint vectors |
| never claimed | unlinkability, deniability of checkpointed cells, constant time, anything about x0x/MLS before receipts, "E2EE" with a remote-model agent present | — |

---

## 5. Roads, transport, censorship, x0x, relays

- **Community identity is a key, never a DNS name.** cell_id = SHA3-256(`bzc1/cell` ‖ genesis). An invite carries cell_id, keeper public keys and a road list. Roads are DNS names, IP literals and ports, used as hints only. This is the DNS-independence ruling: "names help people find the system; cryptographic authority determines what the system accepts" (R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:90-92, per N/bnrose.md:266). A hijacked or blocked name is one dead road. The keeper's pinned key refuses impostors.
- **Ladder.** The client climbs the built ladder: direct TLS, then alt ports, then obfuscated, then Veilid. Its receipt says "connected via rung N" (C:/Users/travi/b-onboard/src/ladder.rs:1-18, SOURCE). Below the ladder sit QUIC/443 and WebSocket/443. Sneakernet (QR or file of identical envelope bytes) is a last road. No user action is needed; a VPN is never a step (SPEC-BUZZ-MULTIRELAY-1.md:54-55). Tonight's SNI block becomes a road switch, not an outage.
- **x0x's exact role.** Machine plane only (E1). It is UDP-only (N/x0x.md:25) and has a 600 s DM lifetime (X0X/src/dm.rs:48). Its single global presence topic fails the locality law by construction (§7). So even if the founder rules E1 in, x0x would be an online-only road for agent cells on desktop or server devices, never on phones, and never the holder.
- **Relays.** Today's Buzz relay becomes one keeper and one door of the founder's community, plus the NIP-01 bridge (§12). It is not a source of truth.

---

## 6. Durability, offline delivery, retention, RETAIN/FORGET, archive, BNRoSe reuse

- **Who holds a message while both parties are offline:** ρ >= 2 keepers in distinct failure domains (different operators and networks), for R days. The sender pays. The default R is 30 days (ASSUMPTION, range 7-60; XMTP's network default is 60, N/critic.md:143).
- **Durably held.** A message counts as durably held only when it is fsync-complete on 2 keepers and each returns a keeper receipt. That is the §2.4 meaning of "durably acknowledged" (R/docs/specs/SPEC-RUSTEOSVM-1.md:66-71). Keepers batch-sign their acks with ML-DSA-65: one root per second, and each sender receives a path. BNRoSe receipt/1 is Ed25519 and stays labeled classical.
- **Beyond R.** The sender's device keeps an outbox; generation numbers and checkpoint leaf lists expose gaps; any member device holding the missing envelope re-posts **identical bytes only** (R/docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43). A missing ack is UNKNOWN, never failure or authorization (N/bnrose.md:247-253). Messages are not authorizations, so they carry no freshness window (unlike x0x's 600 s); L2 expiry binds Tier-S events only.
- **BNRoSe reuse.** A keeper is a consumer crate of `bnrose-exec-host` reusing `journal::ReplicatedJournal` and `SupervisorKeys` (N/bnrose.md:229-231); recipient apply is idempotent on (cell, slot, generation), the `dest-apply` pattern. Two gaps first: replicas are two files in one directory (opexec.rs:103-108), and every run reloads both whole journals (opexec.rs:235-240), so cost grows with history. Proposals to ZCode: segment keeper journals per cell-epoch; durable-ack spans two keepers, not two files. No new E_* code: keeper codes live in the consumer crate (N/bnrose.md:231).
- **Retention and archive.** Device-local forever; archive opt-in as monthly sealed objects to the self slot. Center sent text = 100 x 632 x 365 = 23.07 MB/yr: 12 monthly ANT files = 36 chunks = $0.126/yr; one yearly file = 6 chunks = $0.021; AR = $0.70; per-message files = 36,500 x 3 x $0.0035 = $383/yr (ARITH; one-date prices, N/scale.md:55,58). Received text 177.6 MB/yr: $0.168 monthly ANT, $5.39 AR.
- **RETAIN/FORGET** is "publication-consent routing, not deletion" (R/docs/GLOSSARY-BRIDGE.md:34). FORGET means keepers drop after R or on the sender's signed request. No deletion promise is made, because recipients hold copies.

---

## 7. Scale (the core of this design)

### 7.1 Declared workload model (every input an ASSUMPTION with a range)

| input | low | center | high | note |
|---|---|---|---|---|
| active humans N | 1e10 | 1e10 | 1e10 | L1 (SPEC-BTUNGSTEN-1.md:90-91) |
| devices per human d | 1.5 | 2 | 3 | brief: 2e10 devices |
| human messages/day M | 10 | 50 | 200 | floor row uses 1 (N/scale.md:11) |
| agent multiplier α (agent msgs per human msg) | 0.2 | 1 | 5 | Buzz target 50K agents per 10K humans = 5 (BZ/VISION.md:198-204) |
| recipient mix | 80% DM, 20% group of 5 | 60% DM, 35% group of 6, 5% channel of 100 | 40% DM, 40% group of 10, 20% channel of 250 | mean recipients r = 1.8 / 7.7 / 54.4 |
| device copies k = r x d | 2.7 | 15.4 | 163.2 | |
| checkpoint batch b | 4 | 16 | 64 | measured at rungs 100+ |
| keepers ρ | 2 | 2 | 3 | 2 is the §2.4 minimum |
| keeper retention R (days) | 7 | 30 | 60 | |
| media share μ, mean size | 5%, 100 KB | 10%, 300 KB | 20%, 1 MB | human messages only |
| foreground fraction c | 0.02 | 0.05 | 0.10 | |
| keepers held per foreground device K | 1 | 2 | 4 | |
| background poll period P | 60 min | 15 min | 5 min | OS-scheduled, best effort |
| peak/average | 3 | 3 | 3 | N/scale.md:74 |

Recipient-mix arithmetic:
- low: 0.8 x 1 + 0.2 x 5 = 1.8
- center: 0.6 + 0.35 x 6 + 0.05 x 100 = 7.7
- high: 0.4 + 0.4 x 10 + 0.2 x 250 = 54.4

### 7.2 Derived load (ARITH; text bytes/message B from §3 at that column's b)

| quantity | floor (M=1, α=0, k=6, b=16) | low | center | high |
|---|---|---|---|---|
| messages/day = N x M x (1+α) | 1.0e10 | 1.2e11 | 1.0e12 | 1.2e13 |
| messages/s avg (peak x3) | 115,741 (347,222) | 1,388,889 (4.17e6) | 11,574,074 (3.47e7) | 138,888,889 (4.17e8) |
| B (wire bytes/message) | 632 | 1,280 | 632 | 470 |
| keeper ingress = msgs/s x B x ρ | 1.2 Gbps | 28.4 Gbps | 117.0 Gbps | 1,566.7 Gbps |
| keeper egress = msgs/s x B x k (peak) | 3.5 (10.5) Gbps | 38.4 (115.2) Gbps | 901.2 (2,703.6) Gbps | 85,226.7 (255,680) Gbps |
| same with per-message ML-DSA (3,968 B) | 22.0 Gbps | 119.0 Gbps | 5,658.1 Gbps | 719,530.7 Gbps |
| keeper text held = msgs/day x B x ρ x R | 0.379 PB | 2.15 PB | 37.92 PB (3.79 MB/user) | 1,015 PB (101.5 MB/user) |
| media egress avg = N x M x μ x size x k / 86,400 | 0 | 0.13 Tbps | 21.39 Tbps | 6,044 Tbps |
| media held at keepers | 0 | 0.007 EB | 0.90 EB (0.09 GB/user) | 72 EB (7.2 GB/user) |
| per human per day: text fanout bytes | 3.8 KB | 41.5 KB | 973.3 KB | 92,044.8 KB |

Worked center row: 1e10 x 50 x 2 = 1e12 messages/day, / 86,400 = 11,574,074/s; ingress 11,574,074 x 632 x 2 x 8 = 117.0 Gbps; egress x 15.4 instead of x 2 = 901.2 Gbps; held 1e12 x 632 x 2 x 30 = 3.79e16 B = 37.92 PB; media 1e10 x 50 x 0.10 x 300e3 x 15.4 / 86,400 x 8 = 21.39 Tbps. Reading: amortization cuts text egress 6.28x (5,658.1 / 901.2); media is 24x the text plane; every byte is user-paid (§8).

### 7.3 What may not be global, and what replaces it

| would-be global state | size if global (ARITH) | COMB replacement | per-node bound |
|---|---|---|---|
| directory of users or cards | 65 TB of bpq cards (N/scale.md:123) | invites and pairwise contact cards; paid `.b` names only through the existing naming layer | 0 at any node |
| presence | 1/min/user = 166,666,667 updates/s | "online" = a live connection to the cell's keeper; typing only inside foreground cells; no beacons | at most the foreground leaves of the node's own cells |
| message log | 13 PB to 1.33 EB/yr (N/scale.md:111-115) | per-sender chains inside cells; per-user archives | the node's own cells x R |
| roster | 1e10 rows | per-cell membership, at most 256 leaves for sealed cells | at most 256 x 6,445 B = 1.65 MB of tree state per cell |
| total order | consensus at 1.16e7 msgs/s | causal order per cell (vector of sender generations) | the node's own cells |
| spam reputation | universal score, forbidden (R/docs/CONSTITUTION.md:107) | unreachable by default + postage + per-cell admission | local |
| chain rows per user or message | 82.3x the RAM supply (N/law-identity-scale.md:82) | none | 0 |

**Communities** are combs of cells: the community card is an admin-signed open broadcast cell listing channel cards, not members; joining a channel is a knock to its admins; no component holds the roster of a million-member community.

### 7.4 Connection model (2e10 devices)

- **Always connected (rejected):** 2e10 / 1e5 per box = 200,000 boxes, on a CLAIMED ceiling (R/docs/specs/LOADMODEL-1M.md:91).
- **COMB:** only foreground devices hold connections, only to their cells' keepers: D x c x K. Low 1.5e10 x 0.02 x 1 = 3e8 (3,000 boxes); center 2e10 x 0.05 x 2 = 2e9 (**20,000 boxes**); high 3e10 x 0.10 x 4 = 1.2e10 (120,000 boxes). Background devices hold none.
- **Background polls** = D x (1-c) / P; center 2e10 x 0.95 / 900 = 21,111,111/s; at 1,500 B each 253 Gbps; at 20,000 polls/s/core (ASSUMPTION) 1,056 cores.
- **Bandwidth and storage, center:** text peak (901.2 + 117.0) x 3 = 3,054.6 Gbps = 4,364 U-1G (0.7 Gbps) or 436 U-10G boxes; media peak 64,170 Gbps = 91,671 U-1G or 9,167 U-10G; storage at 24 TB/box: text 1,580, media 37,500 boxes. Connections bind for text, bandwidth for media; 1e5/box stays CLAIMED until rung 1k.
- **Idle per foreground device:** keepalive about 64 B / 30 s = 128 B/min (ASSUMPTION; rung 9 measures), 16,384x under the constrained-leaf 2,097,152 B/min (R/crates/btungsten-meshdep/budgets/btmd-budgets-1.json:34); third-party x0x W@tch 52 MB/min is CLAIMED (N/critic.md:41-46). Idle is O(1) per connection, independent of mesh size.

### 7.5 Mobile and push (enhancement only)

A backgrounded phone holds no connection; its messages wait at keepers and arrive on foreground or OS-granted background fetch. Push, only if E7 is ruled in: a content-free "fetch" wake-up with no tag, sender-paid NetByte at the gateway, degrading to nothing (RULINGS-2026-09-30.md:23-28). Test: every delivery gate passes with push disabled; only latency changes. Low bandwidth: a center user receives 770 x 632 = 486.6 KB/day, 77.9 s/day of 2G airtime at 50 kbps (ARITH).

### 7.6 Sharding, federation, voice

The shard is the cell: no cross-cell protocol beyond invites and Tier-S references; keepers federate only through cells they jointly keep; moving a cell's keepers is a Tier-S commit; no shard, keeper, UI or chain is indispensable (L3, SPEC-BTUNGSTEN-1.md:122-132). Voice: a huddle is a cell-local SFU session at a keeper, capped at 25 (BZ/crates/buzz-relay/src/audio/room.rs:47-49), metered MeshSecond + NetByte to participants, with no PQ claim for the media path until its key derivation is receipted.

### 7.7 ML-DSA verify-CPU budget

| where | formula | center (b=16) | per-message signing |
|---|---|---|---|
| member devices, planet | (msgs/s / b) x k | 723,380 x 15.4 = 11,140,046 verifies/s | 178,240,741 verifies/s |
| per device average | above / 2e10 | 5.57e-4 verifies/s | 8.9e-3 verifies/s |
| keepers, sealed cells | 0 (checkpoints are inside the ciphertext) | **0** | 0 |
| heavy device, 10,000-message backlog | 10,000 / b | 625 verifies | 10,000 verifies |
| busy agent, 1,000 msgs/s, t_v = 2 ms | (1,000 / b) x t_v | 12.5% of one core | 200% of one core |

Planet total at t_v = 0.1 / 0.5 / 2 / 5 ms (ASSUMPTION range, **no estate receipt exists**, N/scale.md:157): 1,114 / 5,570 / 22,280 / 55,700 core-equivalents. These are spread over 2e10 devices. With per-message signing the totals would be 17,824 / 89,120 / 356,481 / 891,204.

**Budget (pass/fail stated now).**
- A constrained device must verify a 10,000-message backlog in at most 5 s of CPU.
- That requires t_v,p95 <= 5 s / (10,000 / b): 2 ms at b = 4, 8 ms at b = 16, 32 ms at b = 64. Per-message signing would require 0.5 ms.
- Keepers must show 0 ML-DSA verifies on sealed cells (a counter, rung 9).

**The experiment that receipts it** (P0): a new `rbench` lane in `R/crates/btungsten-bench`. Implementations: RustCrypto `ml-dsa =0.1.1` and `libcrux-ml-dsa =0.0.11` (R/crates/btungsten-pq/Cargo.toml:20,25), noble post-quantum 0.7.1 in headless Chromium, and saorsa/integritychain `fips204` as separate rows only if E1 is ruled in (proofs do not transfer, N/pq-tungsten.md:149). Hosts: a GitHub Linux runner, the Hostinger box, the Dell under WSL (native Windows has no `wait4` CPU figures, R/crates/btungsten-bench/src/measure.rs:25), and an aarch64 phone-class device only if in scope, otherwise NOT-RUN, never extrapolated. Inputs: checkpoint-sized messages (3,561 / 3,945 / 5,481 B) plus btungsten-pq's ACVP sigVer vectors. At least 20 runs per impl x host x size so p90/p95 are reportable (R/crates/btungsten-bench/src/stats.rs:12); no ratios. Teeth in the same job: a bit-flipped signature must fail and an empty one must be refused (T-VACUOUS), else the run is Miswired and red (N/pq-tungsten.md:53). Verdict computed from samples against the budget above; nothing about constant time.

### 7.8 Progressive physical test ladder (no rung skipped, R/docs/specs/LOADMODEL-1M.md:137)

| rung | what is real | math bound checked (named before the run) | teeth |
|---|---|---|---|
| **1 host** (loopback, CI) | codec, crypto, bench | wire bytes = pad128(p+84) and checkpoint = pad128(3,381+32b+84) exactly, for p in {0, 1, 127, 128, 129, 255, 256, 257, 4,096, 65,535} (T-TRUNCATE lengths); encode/decode injective; t_v within the §7.7 budget; header scan finds no static identifier | a truncating timestamp codec; a header carrying an npub; a checkpoint omitting one leaf: each must be convicted |
| **9** (btmd netns rig, one host) | 2 keepers + 7 devices, pinned binaries | keeper egress per message = k x B, transport framing reported, not hidden; "held" only after 2 journals fsync (kill -9 after ack: message survives); offline recipient receives within R; one keeper removed and delivery continues; foreground idle <= 8 KiB/min; keeper ML-DSA verify count = 0; online DM p95 <= 3 s and removal visible <= 15 s (btmd-budgets-1.json:39-40) | a keeper that acks before fsync; a keeper that drops silently. Label: "single host, not a mesh result" (N/scale.md:11) |
| **100** (>=3 hosts, >=2 networks incl. NAT and the SNI-filtered building) | WAN physics, real NAT | **locality:** vary population 20 to 100 with a probe node's cells fixed, and probe bytes/CPU/connections stay inside the repeat-run noise band; SNI drill: block door 1's name and SNI, reconnect via the next road <= 30 s with zero user action; DNS-independence decisive test (block names, remove the hosting edge, start a replacement keeper, N/bnrose.md:265); f_nat measured, replacing the 20-40% ASSUMPTION | a planted subscriber to a global topic must show load growing with N and be convicted |
| **1k** | x10 step | locality slope over 2 decades; connections/box measured on a reference unit (replaces CLAIMED 1e5); polls/s per core measured | same, plus a road-poisoning attempt that tries to downgrade the suite |
| **10k** (LOADMODEL G-4 gate) | x10 | regression of probe load on log10 N over 100/1k/10k: 95% CI includes 0 and \|slope\| <= 2% per decade; recovery storm with 1% of devices replaced keeps re-admission load per cell bounded by cell size; spam at maximum affordable postage; keeper collusion drop healed by ρ | global-topic plant; vacuous checkpoint |
| **simulation** (1e5 to 1e10 virtual devices, discrete-event) | MODEL class, never a physical result | aggregates match §7.2 within 1%; P99.99 per-node load <= measured box budget under a Zipf cell-size distribution; recovery load at 1e10 of 1%/day = 2e8/86,400 = 2,315 re-admissions/s, spread over cells | global presence planted in the sim must show load proportional to N |

---

## 8. Economics

| resource | unit (closed `ResourceClass`, R/crates/shared-types/src/spend.rs:62-80) | payer of record |
|---|---|---|
| sender device CPU, battery, storage | own | the user |
| keeper ingress + storage for R days | NetByte, StorageByte | sender |
| keeper egress to members, conversation cells | NetByte | sender ("postage" includes k fetches) |
| keeper egress, open and broadcast cells | NetByte | each reader (the consumer) |
| held foreground connection | MeshSecond (closest existing variant; a new unit needs a ruling, BUZZ_A_METERING_SPEC.md:52-53) | the connected user |
| group commits and rekeys | NetByte, StorageByte | the committer |
| archive batches | ChunkCount / StorageByte | the archiving user |
| push wake-ups (if E7) | NetByte | sender |
| huddle SFU | MeshSecond, NetByte | participants |
| agents | the same units | the owner, under the owner's bzDiD |

Keepers issue `SpendReceipt`s off-chain and settle in batches through bPay. Zero balance is a named `FloorRefusal` with the missing minimum, never a top-up or loan (BUZZ_A_METERING_SPEC.md:109-112); a test where one funder settles two users' postage must FAIL (:107-108).

**Free tier** (no balance): identity at 0 chain bytes and $0 (bzdid :59); device-to-device delivery when both are online; one's own home node as keeper; receiving everything senders paid to hold.

**Spam.** Unreachable by default (no directory: a stranger needs your invite or card); a knock from a non-member costs what the recipient sets (postage or the CLAIMED proof-of-work pattern, N/critic.md:206-210); senders pay keeper postage; no global blocklist (BZ/docs/nips/NIP-IA.md:41).

**The ten-billionth-user test, explicitly.** Marginal BNR cost of user #1e10: chain bytes 0; BNR keeper bytes 0 (BNR runs no keeper; E14 is the one bounded migration exception); seed load 0 (invites carry roads); directory or presence growth 0 (none exists); spec and reference maintenance fixed. Every keeper byte for that user lands on that user or their correspondents, so "does the cost of the ten-billionth user land on BNR?" (N/law-constitutional.md:53) is answered no, conditional on E14 and on keepers being run by parties other than BNR.

---

## 9. Moderation and abuse

Moderation is per cell: admins are leaves with remove rights, every removal a Tier-S signed commit; reports reach cell admins as "signals, never triggers", no automod (BZ/VISION_MODERATION.md:39,61); the kernel stays blind (R/docs/BIND-1.md:108). Keepers choose which cells they keep: ciphertext they cannot inspect in sealed cells, inspectable content in open cells. Blocklists are device-local. Agents reading untrusted text never share context with write authority (AGENT-1 Q-2, N/critic.md:186). The platform-safety class has no operator in COMB: illegal content and immutability against takedown are E8, a counsel and founder gate; until ruled, COMB writes no plaintext to any permanent rail and "publish permanently" stays disabled.

---

## 10. 1,000-year continuity

- **Crypto agility.** Every public-key step carries a suite or algorithm id; unknown ids are refused; ids are added, never redefined (SPEC-BPQ-1.md:265-269). A cell moves suites by Tier-S commit once every member's client supports it: no global flag day, and a member who cannot read the new suite sees that state. Deprecation windows are "measured in years" (R/docs/CONSTITUTION.md:92).
- **Re-anchoring history.** Monthly archive roots are timestamped hash-only (OTS, renewed under a new hash before either weakens, SPEC-BPQ-1.md:120-125). After an ML-DSA-65 break, an old checkpoint is evidence only if its root was timestamped before the break. Succession is by SLH-DSA handover (§2).
- **Formats.** Versioned magic and frozen decoders per version (x0x ADR 0085 pattern, N/critic.md:297); every archive batch carries the codec spec hash, with spec text and vectors archived beside the data. Drill: an independent decoder written from the spec alone decodes a one-year archive.
- **Time (L4).** `ts` is i64 ms, informational, never authority; decoders refuse values outside ±1e15 ms (about ±31,700 years). The cell epoch is u32 and forces re-genesis (a new cell chained to the old) before 2^32 - 1, failing closed at the maximum. Nothing uses u32 seconds; the 2106 boundary (SPEC-BTUNGSTEN-1.md:134-144) is a truncating-codec tooth that must stay convicted.
- **Upgrade governance.** Registry changes follow Art. VI §3: RFC, reference implementation and tests before any vote (N/critic.md:92). Client release signing and mixed-version policy are open (§14).
- **Extinction drills** (axis 6 rows): retire ML-DSA-65; retire X-Wing (new suite plus sealed-slot re-wrap of the archive); remove every DNS name; remove BNR; remove Arweave; remove Autonomi; remove the push vendor; remove x0x; replace the client with one written from the spec.

---

## 11. Tungsten conformance matrix (names receipts to earn; claims none)

| axis / law | test family | pass/fail named before the run | evidence class | formal obligations | teeth |
|---|---|---|---|---|---|
| 1 Decentralization | T-REMOVE: kill each keeper, all BNR hosts, DNS names, legacy relay, push, x0x, each storage rail | online members keep messaging; held messages delivered from a surviving keeper; no user action | MEASURED (rung 9/100) | — | a hidden dependency planted (hardcoded host) must fail the run |
| 2 Sybil/MiM | replay, keeper tamper, door impersonation, header-linkability scan, knock flood | duplicates refused; AEAD fails on tamper; pinned keeper key refuses impostor; header has 0 static ids; knock cost enforced | MEASURED + PROVE-UNIVERSAL for header layout | `bzc1/` labels disjoint with all 14 `bpq1/` labels (PQ04 obligation extended); checkpoint message injective | replayed generation; header with npub |
| 3 Healing | kill -9 keepers, corrupt journal, partition, version mismatch, poisoned road | fail closed on corruption, rebuild from replica, identity preserved, UNKNOWN preserved, re-post identical bytes only | MEASURED | — | keeper acks before fsync |
| 4 Learning | road preference (last-known-good) only | learning never changes suite, membership or keys; every change receipted and reversible | MEASURED | — | road-poisoning downgrade attempt |
| 5 >10B | locality law + §7.2 formulas per rung + simulation | §7.8 bounds | MEASURED to 10k, MODEL beyond | aggregate formulas in a pure calculator with tests reproducing every §7 number (ARITH receipt) | global-topic plant |
| 6 Continuity | extinction drills (§10) | each drill passes with no original key, algorithm, name or vendor | MEASURED | v2 codec: Cryptol spec, SAW decode/encode equality, strict-decoder refusal set (WB001 ladder, SPEC-BTUNGSTEN-1.md:285-295) | independent decoder disagreement |
| L1 | 10B active: authenticate, recover, migrate per epoch | recovery storm bounded per cell; no node's load grows with N | MODEL + MEASURED rungs | — | — |
| L2 | Tier-S expiry | every grant/commit carries expiry <= 30 days; long-lived grant refused | MEASURED + vectors | — | 1,000-year grant must be refused |
| L3 | chain writes | chain bytes per message and per user = 0 | MEASURED (action count) | — | a per-message anchor planted |
| L4 | time boundary | i64 extremes refused or accepted per horizon; epoch re-genesis before 2^32 | KAT-style vectors | codec range lemma | u32-truncating encoder |
| L5 | keeper admission EXPOSURE, IDENTITY, PEER, AGREEMENT | UI shows "durably held" only after the keeper's sockets, pinned key, live member connections and a cell head agreeing with an independent member device are receipted per runtime instance | MEASURED | — | configured-but-unconnected keeper must not light |

---

## 12. Migration from today's Buzz

1. **Inventory first.** The Hostinger relay image and its Postgres history are UNVERIFIED (N/buzz.md:17,128); any relay change is RED class, needing founder word and a DB snapshot (N/critic.md:280).
2. **Legacy road.** The Hostinger relay becomes one keeper and door of the founder's community comb, behind a NIP-01 facade bridge mapping channel events to cells (prior art x0x-nostr-bridge, N/x0x.md:153). `skaists.buzz` and `relay.skaists.dev` stay roads; identity moves to cell keys.
3. **18 agents.** buzz-acp and buzz-cli keep speaking NIP-42/NIP-98 to the bridge unchanged. During cutover the bridge returns only `error:`-prefixed retryable denials, because buzz-acp treats any other denial as terminal (BZ/crates/buzz-acp/src/relay.rs:3804-3806). Agents get bzpq1 device keys and owner-attested leaves; PQ13 attestations ride beside Schnorr until a native COMB ACP adapter exists.
4. **History.** Channel history is relay-visible today (BZ/VISION.md:100); it is exported once into community archive batches paid by the community owner (E14). Old npubs stay bound personas: NIP-IA cannot transfer authorship (N/critic.md:161), so the bzDiD-to-npub binding is notarized (`bpq1/bind` + OTS) while Schnorr is still sound.
5. **Media.** Absolute host URLs become content hashes resolvable on any road, fixing the broken `https://skaists.buzz/media/...` links (N/buzz.md:83).

---

## 13. Build plan

| phase | owner seat | reused | acceptance (receipts only) | unblocks |
|---|---|---|---|---|
| **P0** (now, no ruling) | Seat 3 (Claude Code), zCode review | btungsten-bench, btungsten-pq, bpq-core, WB001 ladder | (a) ML-DSA-65 verify lane: CI run on main with samples per §7.7 and teeth convicting; (b) envelope v2 codec: Cryptol spec, Rust strict codec, vectors, T-TRUNCATE/T-VACUOUS teeth, header scan, CI green; (c) workload calculator reproducing every §7 number, CI green | real t_v; the format of record; the numbers stop being prose |
| P1 (rung 9) | Seat 3 + ZCode (journal proposals) | ReplicatedJournal consumer crate, btmd rig and budgets, X-Wing sealed slots | §7.8 rung-9 bounds; small-cell encrypt/decrypt + removal rotation receipts (unlocks the §4 sentence for <= 32 leaves) | offline delivery; first confidentiality wording |
| P2 (rung 100) | integration lead | b-onboard ladder, DNS-independence lane | SNI drill on the building network <= 30 s; locality band; f_nat measured | the outage class closed; needs E12 for hosts beyond scope |
| P3 | PQ lane | a pinned MLS with PQ KEM (selection is work) | local encrypt/decrypt + rekey-on-remove receipts at the pin | 33-256-leaf sealed cells |
| P4 | Seat 3 with founder word | bridge, buzz-acp, buzz-cli | 18 agents green through cutover; zero terminal AUTH denials | migration |
| P5 (rungs 1k, 10k) | test-fleet owner | the same harness | §7.8 slope bound; measured connections/box | replaces CLAIMED 1e5; needs E12 |
| P6 | modelling seat | rung parameters | simulation within 1% of §7.2; tail bound | the axis-5 mathematical leg |

---

## 14. Open questions and risks

1. Every workload input is this design's ASSUMPTION; the founder or the field must replace M, α, recipient mix, c, P, R, ρ. Storage swings 100x on M alone (N/scale.md:156).
2. t_v on phones is unknown; if the §7.7 budget fails at b = 4, b and the authenticity window must grow.
3. The checkpoint window is a real authenticity gap; users may misread "group-authentic" as "signed".
4. Connections/box (1e5) and poll cost per core are CLAIMED/ASSUMPTION; at 10x fewer connections per box, center needs 200,000 boxes: still user-paid, but a market that may not exist.
5. A planet keeper market may centralize onto few operators, degrading privacy toward "a few parties see IP-level graphs". COMB can say so, not prevent it.
6. Sender-pays fanout makes big channels costly; reader-pays on open cells mitigates; the boundary is policy (E5).
7. P3 needs an MLS implementation with PQ suites and receipts that the estate does not have.
8. Release signing and mixed-version policy over decades are unruled (N/critic.md:282-285).
9. Accessibility beyond bandwidth (screen readers, huddle transcripts) is unspecified (N/critic.md:265-268).
10. "Tungsten gold standard" must not be read as a claim: COMB names receipts, and none exist yet.
