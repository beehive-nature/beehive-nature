# PQ Buzz METABOLIC — an economics-first design

Design seat, 2026-10-15. Angle: economics-first. Read-only on every repository; this file is the only write.
Citation keys: repo-relative paths are under `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3`;
`notes/<file>` = the reader notes in `scratchpad/pqbuzz/`; `LD/` = `C:/Users/travi/LOVErnment-DAO/specs`.
Classes: RULED, MEASURED, SOURCE, CLAIMED, UNVERIFIED, ASSUMPTION, ARITH (my arithmetic, re-runnable from the inputs shown).
This design names receipts it would earn. It claims no tungsten conformance (`docs/dispatches/2026-10-06-btungsten-lane.md:45-47`).

---

## 0. Thesis

**PQ Buzz METABOLIC** takes its name from Constitution Art. V.4, which calls the resource token "metabolic energy — an accounting mechanism for consumption" (`docs/CONSTITUTION.md:86`). It is an additive adapter set under bChat Core (`docs/specs/SPEC-BCHAT-1.md:37-48`), not a rival stack.

Its organizing rule: **every physical resource a conversation consumes has a meter, a unit from the closed `ResourceClass` enum, a payer of record, and a named refusal path.** The resources are a byte forwarded, a byte-day retained, a CPU-microsecond verified, a connection held, a durable chunk, and a permanence byte. The payer of record is the bzDiD whose act caused the consumption. The refusal path is a `FloorRefusal`.

- **Pricing.** Every resource is priced in A. Settlement goes through bPay from the user's own wallet. Receipts carry quantities and never contents.
- **Free tier.** The free tier is **bring-your-own-resources reciprocity**: your devices host and forward what your own conversations consume. It has no third-party allowance, so a Sybil swarm gains nothing.
- **Paid tier.** The paid tier is an **open market** of inbox, relay, SFU and archive providers. Anyone can run one, and none is indispensable.
- **BNR's cost.** BNR's only standing costs are capped bootstrap seeds and spec maintenance. Both are fixed per epoch, so the marginal cost to BNR of the ten-billionth user is **0** (§8.6).
- **Post-quantum claims, track by track:**
  - Sender attribution is ML-DSA-65 over hash-chain checkpoints. This amortizes the 3,309 B signature to about 900 B per message in the central mix.
  - Bodies are sealed with X-Wing plus AES-256-GCM under SPEC-BPQ-1.
  - Legacy NIP-01 roads stay classical and are labelled classical.
- **x0x.** Under today's PLANE LAW, x0x is used as a machine-plane road only. Moving the human plane onto x0x is a compiled-out switch that waits on a founder ruling.
- **The SNI incident.** A community is a signed roster with a roads card, never a DNS name.

---

## 1. Plane mapping and ESCALATIONS

| plane (RULED, `docs/ledger/pirate-haul-rulings.md:18`) | METABOLIC component | payer of record |
|---|---|---|
| human plane | bChat Core envelope v2 records (§3) carried on roads R0–R4 and R6 (§5) | sender for push; reader for pull (§8) |
| machine plane (x0x) | agent↔agent coordination only (road R5m). It never carries human-plane records and never stores anything | the agent's owner bzDiD |
| durable (Autonomi) | encrypted per-user archive batches of at most 63 chunks (§6.4) | the archive owner |
| permanence (Arweave) | batch roots, index commitments, and public posts only by explicit choice; under 256 KiB (`docs/dispatches/BUZZ_A_METERING_SPEC.md:127`) | the publisher |
| settlement (Vaulta/Zano) | A is the rate unit. Payments are voucher top-ups through bPay. There is **no per-message and no per-user chain write** | the payer |
| kernel bus | `MessageEvent` is emitted on the owner's local bus only, with pairwise ids (`crates/shared-types/src/events.rs:212-219`) | n/a |

Buzz keeps its ruled role, "coordination/messaging ... NEVER a storage/permanence/privacy/settlement layer" (`docs/ledger/pirate-haul-rulings.md:17`). The Buzz relay is demoted to one priced road. Confidentiality comes from bpq sealing at bChat Core, not from Buzz. Storage lives on users' devices and on Autonomi.

**ESCALATIONS.** Each row names the collision. None is resolved here.

| # | collision | cited rule | design without a ruling | if the founder rules otherwise |
|---|---|---|---|---|
| E1 | "Buzz over x0x" vs PLANE LAW / X-1 / X-3 | `docs/ledger/pirate-haul-rulings.md:18`; `pirate-haul-rulings-2026q3.md:27` | x0x carries machine-plane traffic only. The human road `x0x-human-road` is a cargo feature compiled out of every artifact (lawful `#[cfg]` non-shipping, CLAUDE.md §2 law 2) | Enable the feature and sign a law file. x0x then becomes road R5h for desktop and server peers only, never phones (§5). It is still never storage, because durable ack needs two non-x0x stores (§6.1). Its idle bill is metered to the device owner as `NetByte`. **No x0x confidentiality claim** is made: records are sealed before x0x sees them |
| E2 | E2EE plus device-held history vs Buzz "NEVER ... storage ... privacy" | `pirate-haul-rulings.md:17` | Privacy and storage sit in bChat Core and bpq, which are not Buzz. Buzz relays carry ciphertext as a road | Naming only; no mechanism changes |
| E3 | free tier "on estate iron, no charge" vs Art. V.1 and B1 rule 4 | `docs/dispatches/LANE_M_B_METER_2026-08-29.md:6`; `docs/CONSTITUTION.md:83`; `BUZZ_A_METERING_SPEC.md:109` | No BNR hardware serves non-estate users for free. The free tier is BYO only | If estate iron may host a free tier, it must have a fixed per-epoch cap with a named refusal when exhausted. It then counts as a bootstrap seed and sunsets (Art. V.2) |
| E4 | spam fence vs "No person pays to *use* a BNR function" | `docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`; `docs/raids/BMAIL-SORT-2026-09-20.md:220,224` | A cold contact costs only physical resources: an introduction (free), postage at commodity rate, or the sender's own CPU. A recipient premium is **forbidden by protocol** (§8.5) | If cold contact must be free: set the recipient policy floor to 0 (a policy value, not a rewrite). If attention bonds are allowed: add a bond line in escrow-core, outside the A path, because it is the service layer |
| E5 | units missing from the closed `ResourceClass` (byte-time retention, connection time) | `BUZZ_A_METERING_SPEC.md:53`; `crates/shared-types/src/spend.rs:62-70` | Interim mapping: retention is `StorageByte`, with the term fixed inside the rate set named by `rate_set_ref`. A held connection is `RamByte` (pinned session state) plus `NetByte` (keepalives) per term. No free-string unit | Add `StorageByteSecond` and `ConnectionSecond` by ruling, with a `SCHEMA_VERSION` bump (`spend.rs:39`) |
| E6 | A as the rate unit vs A settlement at 10^10 | `docs/RECEIPT_R8_VAULTA_RAM.md:46-50` (12.7M–30.0M accounts fit in all unallocated RAM); `docs/bzdid-architecture-decision.md:61` | Rates are in A. Settlement takes any bPay route: A-native for account holders, otherwise first-line rails (`docs/RULINGS-2026-09-16.md:73-78`). voucher-escrow already accepts USDC deposits with `rate_ref` (`crates/voucher-escrow/src/lib.rs:12-14`) | If settlement must be in A only: the paid tier caps at about 1.3–3.0×10^7 self-accounted payers (0.13–0.30% of 10^10, ARITH). Everyone else is BYO only |
| E7 | KISS funded wallet vs Rail C | `docs/dispatches/INDEX.md:135`; `RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:88-100` | The design needs no genesis funding under either reading | No change under either ruling |
| E8 | "Buzz's own A pays ... its relay" vs standing-cost limit | `BUZZ_A_METERING_SPEC.md:105`; `docs/CONSTITUTION.md:83` | The skaists.buzz relay is the estate's own consumption (founder plus 18 agents). Outsiders on it either pay as customers of a provider or are capped bootstrap | If always-on hosting is ruled a lawful standing cost: it must be fixed per epoch and capped (§8.6), never per user |
| E9 | "running Buzz/meshLLM nodes (provide RAM, earn b)" vs "b does not appear in the alpha metering path" | `docs/dispatches/RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:16`; `BUZZ_A_METERING_SPEC.md:81-82`; `notes/critic.md` C5 | Providers are paid in the settlement asset. No b appears anywhere | A b reward to node operators is a service-layer program that reaches CD-29 Q-2/MX-2 |
| E10 | tithe scope | `LANE_M_B_METER_2026-08-29.md:5` (scoped to the Claude-agents lane) | No tithe line on third-party commodity forwarding. BNR is not a party to it | A distinct TITHE line on receipts of BNR-operated providers only. voucher-escrow supports it (`crates/voucher-escrow/src/lib.rs:9`) |
| E11 | `MessageEvent{from_did,to_did}` on a public bus vs R1 | `events.rs:212-219`; `docs/RULINGS-2026-09-16.md:26-29`; `notes/critic.md` N1 | Local bus only, with pairwise persona ids | A public anchor would still use pairwise ids, but the founder decides |
| E12 | PQ Buzz vs bChat as the ordered stack | `SPEC-BCHAT-1.md:3-6`; memory sovereign order `:14` | Envelope v2 is proposed to the bChat Core owner as an additive version | A separate stack would breach the sovereign order. Re-escalate rather than build |
| E13 | bSigner freeze | `crates/bsigner/CONTRACT.md:3-7,43-44` | Checkpoints are signed by device keys through bpq-core in the client. No new bsigner command | A ruled bsigner command would allow hardware-held checkpoint keys |
| E14 | illegal content in immutable stores | `docs/specs/SPEC-BLICENSE-0.md:187-191`; `docs/GLOSSARY-BRIDGE.md:34` | Permanence carries commitments only by default. Archives are encrypted to members. A public post to Arweave is an explicit act | Counsel decides whether public permanence is offered at all |
| E15 | social recovery | `docs/joint-liveness-coherence.md:174` (CLAIMED-as-ruling) vs `docs/SPEC-ONBOARDING-IDENTITY-1.md:179` | Recovery uses only r1 (written code) and r2 (device). WebAuthn is never the sole path | If ruled in, it becomes an extra r-slot |
| E16 | vendor push (APNs/FCM) | `docs/RULINGS-2026-09-30.md:21-27` | Enhancement only: a content-free wake, paid by the user through a provider | If forbidden, background polling only |
| E17 | Autonomi merkle-path fence | `docs/dispatches/RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:42` vs watchpay | Archive batches of at most 63 chunks | If lifted, larger batches |
| E18 | agents that post: AGENT-1 Q-3 vs the 2026-08-29 autonomy ruling | `LD/AGENT-1.md:160-163`; `notes/law-identity-scale.md` §7.11 | Agents post only inside an owner grant (§2.4) | Founder |

---

## 2. Identity, devices, agents, keys, succession, recovery

**2.1 Root.** `did:b:` (bzDiD) is the only root (`docs/VOCABULARY.md:220-226`). Creating one writes "zero" bytes to any chain at "zero" cost to BNR (`docs/bzdid-architecture-decision.md:59`). Records key off the DID and never raw keys (`docs/CONSTITUTION.md:49`).

**2.2 Devices.** Each device has its own `bzpq1` id: ML-DSA-65, X-Wing, and an SLH-DSA succession commitment. The device id is tied to the wallet id by a binding signed by both, and "The bzDiD phrase is never loaded onto a device" (`docs/RULINGS-2026-10-04.md:59-66`).
- A public card is 1,952 + 1,216 + 32 + 3,309 = **6,509 B** (ARITH from `notes/scale.md` §2).
- There is no global card directory (`docs/bzdid-architecture-decision.md:390`). Cards travel inside invites and roster records. Shipping them costs the inviter's own bandwidth (BYO).

**2.3 Conversation personas.** Each relationship gets a pairwise root-derived persona, matching the default disclosure `Selective`/`Pairwise` (`crates/onboarding/src/lib.rs:113-133`, per `notes/law-identity-scale.md` §1.3).
- A conversation's signed ROSTER maps member index → (persona id, device cards, supported versions, roads).
- npubs and x0x keys are bound personas only, and they need bidirectional links (`docs/CONSTITUTION.md:52`).
- Economically this matters because **identity carries no quota.** "Machine DIDs cost nothing to create, so a machine DID never carries quota" (`LD/PERSON-1.md:107-112`). Nothing in METABOLIC grants a free allowance per identity, so creating a million identities yields zero free resources.

**2.4 Agents.** Every agent sits under bQueenBee or under a human bzDiD (`RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:14-15`).
- An agent acts through an **owner grant record**, signed with ML-DSA-65 per record because it bears authority (L2). The grant states purpose, conversations, kinds, resource ceilings and expiry, in the form of the explicit-grant law (memory `sovereign-operating-environment-order.md:21`).
- Expiry is at most one epoch (AGENT-1 Q-5, "Authority expires", `LD/AGENT-1.md:168-169`).
- Revocation is a signed roster change that any member device applies offline (A-10, `:73-74`).
- **The payer of record for agent consumption is the owner bzDiD.** Spend caps are the owner's optional tool and are enforced by the signer, not the relay (`notes/paystack.md` §5).
- A cloud-inference agent in a sealed conversation sets the roster flag `remote_inference=true`. Every member's surface then shows it, and the "E2EE" word is suppressed for that conversation (`LD/AGENT-1.md:30,42-45`).

**2.5 Succession.** Keys are retired by the SLH-DSA handover (`docs/specs/SPEC-BPQ-1.md:190-209`).
- METABOLIC makes **each conversation roster the spent-once log for that conversation**: a roster refuses a second handover from the same `from`. That closes N-3 locally. Nothing claims it globally.
- Cost per conversation is 49,856 + 3,407 = 53,263 B, once per algorithm era. A user with 200 conversations pays about 10.65 MB once per era, from their own bandwidth (ARITH).

**2.6 Recovery.** The rotation keys are r0 = WebAuthn PRF, r1 = written code, r2 = second device (`docs/bzdid-architecture-decision.md:49-50`).
- r0 is bound to its RP domain, and "WebAuthn alone does not survive losing the original domain" (memory order `:24`). So r0 is never the sole path: losing the RP domain leaves r1 and r2.
- **Readable after recovery:**
  - archive batches, which are sealed under a key derived from the bzDiD `masterPrk` (a new frozen label is a proposal, §13);
  - the history held on any surviving device.
- **Not readable after recovery:** content sealed only to lost device keys that was never archived. The surface states this plainly.
- Social recovery is E15.

---

## 3. The envelope of record (bChat Core envelope v2, "sheaf")

**3.1 Encoding.** Deterministic CBOR: positional arrays and core deterministic encoding. bzDiD genesis already hashes dag-cbor (`docs/bzdid-architecture-decision.md:56`).
- The decoder is strict and refuses non-canonical bytes, ill-formed UTF-8 and unknown suites (input-boundary law, `docs/specs/SPEC-BTUNGSTEN-1.md:256-267`).
- A suite byte comes from a closed registry. `0x01` = {ML-DSA-65, X-Wing draft-11, AES-256-GCM, SHA3-256}. An unknown id is refused, never defaulted, and ids are added and never redefined (`SPEC-BPQ-1.md:265-272`; `crates/bsigner/src/alg.rs:6-8`).

**3.2 Three record kinds.**

| record | fields (bytes) | size |
|---|---|---|
| LINK (one message) | CBOR framing 8, suite 2, conv id 32, sender roster index 8, seq 8, t (u64 seconds) 9, prev-link SHA3-256 32, policy 4, AEAD nonce 12, tag 16 | **123 B + body**; 323 B with a 200 B body |
| CHECKPOINT (attribution) | suite 2, conv 32, sender index 8, seq range 16, chain head 32, ML-DSA-65 sig 3,309, framing 8 | **3,407 B** |
| ROSTER (membership, cards, roads, grants, handovers) | signed per record with ML-DSA-65; cards inline | variable; authority-bearing |

**3.3 Signature amortization**, the first-class problem.

The LINK hash-chain binds every message into the sender's chain. Attribution comes from one CHECKPOINT over the chain head, which covers K messages.

| policy | K | bytes/msg (323 + 3,407/K) | vs per-message ML-DSA (3,641 B, `notes/scale.md` §2) |
|---|---|---|---|
| authority-bearing kinds (agent commands, approvals, roster, grants) | 1 | 3,730 | 0.98× |
| group chat, attribution window 10 s or 16 msgs | ~3 effective (ASSUMPTION) | 1,459 | 2.5× smaller |
| pairwise chat, hourly or 64 msgs | ~10 effective (ASSUMPTION) | 664 | 5.5× smaller |
| bulk/agent logs | 64 | 376 | 9.7× smaller |

ARITH, central mix (70% pairwise / 30% group): 0.7×663.7 + 0.3×1,458.7 = **902 B per message**. That is 2.11× a classical Nostr-shaped 428 B message, and about 4× smaller than per-message ML-DSA.

The honest price of amortization is that **between checkpoints a message is member-authenticated, not sender-attributed.**
- Pairwise, the AEAD key is held by two parties, so authenticity holds while the record stays deniable.
- In a group, the epoch key proves only "a member wrote this" until the checkpoint lands.
- The surface shows both states from receipts: "member-sealed" and then "signed by <persona>" (`docs/specs/SPEC-RECEIPT-OBSERVABILITY-1.md:11-22`).

**3.4 Domain labels.** METABOLIC proposes two new labels, `bpq1/buzz-checkpoint` and `bpq1/buzz-roster`. They must join the proven `domainsDisjoint` set (PQ13 obligation, `notes/pq-tungsten.md` §3). zCode owns that proof.

**3.5 Compatibility.**
- **bChat v1.** v2 is additive (`v:2`). A v1 decoder refuses unknown `v`, which is correct behaviour.
- **NIP-01 (legacy road).** A v2 record rides as opaque ciphertext inside a gift-wrap-shaped event signed with an ephemeral secp256k1 key. That road is **classical and labelled classical**. Migrated personas add the SPEC-BPQ-1 §5b attestation beside the legacy events (`SPEC-BPQ-1.md:211-227`). An ML-DSA attestation beside a Schnorr event never makes that event PQ (`notes/pq-tungsten.md` §4).
- **CanonicalEvent.** `MessageEvent{message_id = LINK hash, from_did/to_did = pairwise persona ids, content_ref = archive batch address#offset}`, on the local bus only (E11). The kernel's pointer law "Message content never rides the bus" (`events.rs:9-10`) holds.
- **x0x `DmEnvelope`.** Machine plane only. Agents carry v2 records as opaque payload.

There is **ONE format of record:** the v2 LINK/CHECKPOINT/ROSTER bytes. Every other envelope is a road wrapper.

---

## 4. Confidentiality and metadata

**Pairwise.** Each conversation epoch key is X-Wing-encapsulated to the peer's device cards (ct 1,120 B, `docs/specs/SPEC-BPQ-1.md:82-83`). Bodies are AES-256-GCM sealed objects whose slots carry no reader id (`SPEC-BPQ-1.md:162`, per `notes/pq-tungsten.md` §3).

**Groups.** A group uses one epoch key, wrapped by X-Wing to each member device on every membership change. This is not MLS and claims no RFC 9420 interop (`notes/x0x.md` §2).
- A rekey costs (n−1)×1,120 B: 7,840 B at n=8, 222,880 B at n=200, and 1.12 MB at n=1,000 (ARITH).
- **The member who changes membership pays for the rekey**, because that act caused the consumption.
- Above about 1,000 members a room is a **broadcast channel**: signed, with no confidentiality claim. Secrecy among a million readers is not a meaningful property.

**Metadata.**
- A provider holding an inbox sees ciphertext sizes, timing and which locator receives.
- Conversation ids are random and pairwise.
- Inbox locators rotate per epoch.
- Padding to size buckets and cover traffic are **metered resources the user chooses to buy**. Privacy is a physical cost, so it gets a meter and not a promise. Padding a 323 B link to 512 B costs 1.59× its bytes (ARITH).
- There is no global presence topic. Presence goes only to contacts.
- No unlinkability claim is made. No TAM slice exists for it (`notes/critic.md` §4.5).

**Allowed wording, verbatim:**
- "Message bodies are sealed by design with X-Wing (draft-connolly-cfrg-xwing-kem-11, pinned) and AES-256-GCM per SPEC-BPQ-1; sound by construction within the stated model; implementations are cross-checked on vectors, not audited; constant-time behaviour is not established."
- "Sender attribution is ML-DSA-65 over conversation checkpoints; messages between checkpoints are member-authenticated only."
- "Providers see sizes, timing and locators, never contents."

**Never:**
- "E2EE" with a remote-inference member unless the visible mode is on;
- any confidentiality word about x0x (`docs/ledger/pirate-haul-rulings.md:19`);
- "PQ" about a NIP-01 road event or a TLS channel ("does not make the cable post-quantum", `SPEC-BPQ-1.md:298-299`).

---

## 5. Roads and transport

A road carries ciphertext. A **roads card** inside the signed ROSTER lists the conversation's locators. A locator is an IP:port, a hostname, a Veilid route, an onion or an x0x id, and none of them is identity. Any member can add a provider.

| road | what | hostile-network role |
|---|---|---|
| R0 | direct device↔device (QUIC or WSS on 443) when both are reachable | free (BYO) |
| R1 | market inbox and relay providers (WSS/TLS 443, any hostname) | paid by the user |
| R2 | alternate ports 443/80 | ladder rung 2 |
| R3 | obfuscated transport (obfs4/Snowflake, `docs/ledger/pirate-haul-rulings.md:20`) | ladder rung 3 |
| R4 | Veilid (`C:/Users/travi/b-onboard/src/ladder.rs:3-12`) | ladder rung 4 |
| R5m | x0x, **machine plane only** (agents on desktops and servers). UDP-only, with no TCP rung (`notes/x0x.md` §1) | none: x0x cannot climb a ladder |
| R6 | sneakernet: QR, file, BLE delay-tolerant (`docs/specs/SIM-MESHFEST-0.md:116`) | last resort |

**The SNI incident class.** When one hostname is SNI-reset (`notes/buzz.md` §5.4), the client drops to the next locator. The surface says "connected via road N", never a green tick that hides the climb (`ladder.rs:9-12`). Media are content-addressed (sha256) and resolved through the roads card, which fixes the broken host-absolute media URLs (`notes/buzz.md` §5.4). Losing the name does not lose the sovereign (`docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:90-92`).

**Relays** are paid caches and forwarders and never the record (`docs/SPEC-PAY-ONCE-NOW-1.md:65-67`).

**x0x** is excluded from phones, even after a ruling, because of its idle bill. That bill is 142 MB/min at the default and about 75 GB/day per idle device (third-party, CLAIMED, `notes/critic.md` C1). On the BYO principle that bill would land on the user's own data plan.

**Voice.**
- Huddles of up to 4 people are P2P on R0, which is free.
- Huddles of 5–255 use a **market SFU, and each participant pays their own downlink.** At 32 kbps Opus (ASSUMPTION), a 25-person huddle is 768 kbps per participant, 345.6 MB per participant-hour, about $0.00015 (ARITH on the CLAIMED box unit, §8.3).
- Frames are sealed under the conversation epoch key, so the SFU forwards ciphertext. This is NOT BUILT: no claim until receipts exist.
- No biometric processing of the media, ever (`LD/BIO-1.md:38,44`).

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**6.1 Record of truth** = members' devices plus the optional user-paid archive. A relay is never the record.
- **Durably acknowledged** uses the founder's §2.4 meaning: "fsync-complete on two independent durable stores — distinct failure domains — before the effect door opens" (`docs/specs/SPEC-RUSTEOSVM-1.md:65-71`).
- For a message, the two stores are the sender's device plus one of: (a) another of the sender's devices, (b) the recipient's device ack, or (c) a paid inbox's journal.
- An x0x peer never counts as a store (X-3).

**6.2 Offline delivery: who holds it, how long, who pays.**

| situation | holder | duration | payer |
|---|---|---|---|
| recipient offline, sender online | the sender's own device (store-carry), redelivering identical bytes only (`docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43`) | until delivered or `forgetAt` | the sender, in kind (BYO) |
| both offline, group conversation | any online member's device | until the next member contact | members, in kind (reciprocity) |
| both offline, user wants timeliness | the recipient's own always-on device, or a paid inbox listed in the recipient's card | the term in the recipient's rate set (default 30 days, ASSUMPTION) | **the sender** pays byte-days until pickup (`docs/raids/BMAIL-SORT-2026-09-20.md:220`); after pickup the recipient's device holds it |
| nobody holds it | nothing | the message waits on the sender's device | **delay is the free tier's price, stated plainly** |

Every record carries an explicit expiry (`BMAIL-SORT:221`). A "no recipient-side server is ever required" rule holds (`BMAIL-SORT:227`).

**6.3 Retention.** RETAIN/FORGET is "publication-consent routing, not deletion" (`docs/GLOSSARY-BRIDGE.md:34`). `applyRetain()` prunes local stores and reports what it did (`SPEC-BCHAT-1.md:70-72`).

**6.4 Archive batching.** The archive is the 3,400× lever on the user (`notes/scale.md` §2).
- Each user seals and batches their own conversation view, monthly or yearly, at **≤63 chunks per batch**. That keeps it off the merkle path (E17).
- Upload goes through `surfaces/ant-pay.js` with the **user's own key** (`notes/paystack.md` §3).
- At the central workload a device keeps 225.6 MB/yr. That is 54 chunks, which fits one batch/yr, at 54 × $0.0035 = **$0.19/user-yr** (ARITH; chunk price MEASURED once, `docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:90-91`).
- At M=200 a year is 216 chunks, so it takes ≥4 batches/yr.
- A→ANT conversion follows B1 §4: an unfillable swap is refused and named, and **the archive waits while messaging never blocks** on a swap (`BUZZ_A_METERING_SPEC.md:118-129`; Rail C "never fail closed on an unfillable swap", `RULING_RAIL_C...:27-28`).
- An optional group archive uses a rotating payer, one payer per batch. It is never one shared funder across per-user items (`BUZZ_A_METERING_SPEC.md:97`).

**6.5 BNRoSe reuse.** The ZCode seam is unchanged: these are new consumer crates, and event codes live in the consumer's own file (`docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:11-15,83`).
- `journal::ReplicatedJournal` is used for the device store and the provider ledger. Its second replica must sit on another host. Today's two-files-in-one-directory replica does not meet "distinct failure domains" (`notes/bnrose.md` §3.2, §8.2).
- `dest-apply` idempotency is used for inbox delivery, with op_id = LINK hash.
- UNKNOWN is never authorization.
- Spend is reported as `SpendReceipt` only (`BUZZ_A_METERING_SPEC.md:129,154`).

**Eternal Computer leg.** Messaging is none of the three legs. Under "Don't bend a taxonomy" (`docs/dispatches/RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md:59-65`), METABOLIC declares itself a **kernel adapter (bChat) with three touch points**:
- archive = an L1 consumer;
- the provider ledger = L2 replay discipline;
- metered agent and verify compute = L3-shaped, but metered in A per B1, never in b.

---

## 7. Scale

**7.1 Declared workload model** (every input is an ASSUMPTION with a range; ARITH re-runnable).

| input | low | central | high |
|---|---|---|---|
| N users | 10^10 | 10^10 | 10^10 |
| M msgs/user/day (agent traffic charged to owners) | 10 | 50 | 200 |
| fan-out mix: 70% pairwise (1), 25% small group (8), 5% large (200) → mean recipients F | 3 | **12.7** | 40 |
| devices per user d | 1 | 2 | 4 |
| body | 200 B | 200 B | 200 B |
| bytes/msg incl. amortized checkpoint (§3.3) | 664 | **902** | 1,459 |
| inbox pickup delay | 1 h | 8 h | 72 h |
| retention | device persistent, inbox 30 d, archive opt-in | | |

**ARITH at F=12.7, d=2, 902 B:**

| M | sent msgs/s | delivered copies/s | device deliveries/s | aggregate | inbound per device/day | kept per device/yr | verifies per device/day | global verifies/s |
|---|---|---|---|---|---|---|---|---|
| 10 | 1,157,407 | 14.7M | 29.4M | 0.21 Tbps | 114.6 KB | 45.1 MB | 21.6 | 5.0M |
| 50 | 5,787,037 | 73.5M | 147.0M | 1.06 Tbps | 572.9 KB | 225.6 MB | 108 | 25.0M |
| 200 | 23,148,148 | 294.0M | 588.0M | 4.24 Tbps | 2.29 MB | 902.3 MB | 432 | 100M |

M=1 is the ruled floor (115,741 ops/s, `notes/scale.md` §0). Messaging sits 10–200× above it. 572.9 KB/day per device fits a 2G-class link, which matters for accessibility.

**7.2 No global state.** There is no global log, card directory, presence topic, room tree or CRDT. All six are ruled out by `notes/scale.md` §3. Every state object is conversation-scoped. The only global objects are commitments, such as epoch roots (`docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md:72-77`).

**7.3 Connections.** Nobody has to hold an always-on connection. Devices connect to peers when both are online and to their chosen provider when they want timeliness.
- If a fraction p_c of the 2×10^10 devices hold a paid persistent connection, then at the CLAIMED 10^5 per box (`docs/specs/LOADMODEL-1M.md:91`) that needs 20,000 / 60,000 / 200,000 boxes at p_c = 0.1 / 0.3 / 1.0.
- That is **$24.2M / $72.7M / $242.4M per year in aggregate, all paid by the connecting users** at about **$0.0121 per device-year** (ARITH; the unit is $101/mo, CLAIMED, `LOADMODEL-1M.md:87`).
- The same $242M/yr is the bill if BNR runs always-on relays for everyone. That is the "sponsored/metered DEAD" class (`docs/dispatches/RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:20-22`).

**7.4 Mobile and push.**
- A phone is a leaf. It is never an x0x peer and never a forwarder unless its owner opts in.
- Battery and data are the owner's resources, spent by the owner's own policy.
- A vendor wake (APNs/FCM) is enhancement only (E16). The provider sends a content-free wake, metered `NetByte`, paid by the user.
- Without push, the phone polls on the user's schedule, and timeliness degrades by a stated amount.

**7.5 Sharding and federation.** None is needed, because each conversation is its own shard. Providers are independent, with no relay-to-relay consensus.
- Public broadcast is pull-based. The publisher's provider pays origin egress, and readers can swarm.
- A post read by 10^9 readers at 10 KB costs the publisher about **$4.45** of egress at the CLAIMED unit (ARITH). It is never BNR's cost. Viewing stays wallet-free (`docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:46-48`).

**7.6 Verify-CPU budget.** **There is no receipt.** No ML-DSA-65 throughput is measured anywhere in the estate (`notes/scale.md` §5).
- Budget shape (ARITH): a central device verifies about 108 checkpoints and signs about 8.5 per day. At an ASSUMED 0.1–1 ms per verify that is 0.011–0.108 s/day per device.
- Globally it is 25.0M verifies/s, **all on the readers' own devices (BYO)**. Providers never verify content signatures. They verify one session capability per device per day.
- **How to get the receipt:** P0.a (§13) runs a bench of RustCrypto `ml-dsa 0.1.1`, libcrux and noble 0.7.1 on the founder's four devices plus a CI runner. The JSON is printed by CI, and its class is a bench, not capacity (`docs/dispatches/2026-10-12-bnrose-rust-001.md:146-147` precedent).

---

## 8. Economics: meters, payers, free tier, spam, the ten-billionth-user test

**8.1 The meter table.** The units come from the closed enum (`crates/shared-types/src/spend.rs:62-70`). Interim mappings are marked E5.

| resource | ResourceClass / rail | counted by | payer of record | refusal |
|---|---|---|---|---|
| byte forwarded (push to an inbox or peer) | `NetByte` | provider **and** the sender's client (double entry) | sender | `FloorRefusal{NetByte, need, rate_set_ref}`; the free road R0 is still offered |
| byte fetched (pull, broadcast) | `NetByte` | provider and reader | reader, or publisher by publisher's choice | same |
| byte-day retained (inbox) | `StorageByte` with the term in the rate set (E5) | provider journal | sender until pickup; then whoever asks to keep it | the inbox refuses to accept, naming the minimum; the message stays on the sender's device |
| connection held | `RamByte` + `NetByte` per term (E5) | provider | the device holder | the session refuses; the client falls back to polling |
| CPU verified at a provider (sessions, search, index) | `CpuMicrosecond` | provider | the subscriber | refusal |
| CPU verified on a device | BYO, zero-charge receipt | the device | the owner, in kind | n/a |
| SFU forwarding | `NetByte` + `CpuMicrosecond` | SFU and participant | each participant, for their own downlink | the participant drops to audio-only, then text |
| durable chunk | `ChunkCount` on `Rail::Autonomi` | ant-pay receipt | the archive owner | unfillable swap: refuse and name it; the archive waits |
| permanence byte | `StorageByte` on `Rail::Arweave` | upload receipt | the publisher | refusal |
| chain fee (top-up) | `ChainFee` | rail receipt | the payer | refusal |
| padding and cover traffic | `NetByte` | client | whoever chooses the privacy level | the user lowers the bucket |
| agent inference | `VramByteSecond` + `CpuMicrosecond` + `NetByte` (`BUZZ_A_METERING_SPEC.md:49-50`) | inference provider | the owner bzDiD | refusal |

**Receipts never carry contents** (`SPEC-BCHAT-1.md:70-72`).
- A provider issues **one `SpendReceipt` per voucher per epoch, with aggregated quantities**. It never issues one per message. This scales receipts with users rather than messages, and it hides per-message timing from the receipt store.
- The client keeps a per-message local tally. A disagreement beyond tolerance between that tally and the provider's epoch receipt is dispute evidence. This applies "verify against a foreign oracle" (CLAUDE.md §5).
- On the provider side, `spender_bdid` carries the **pairwise payment persona**. Only the user's private ledger joins it to the bzDiD. This is a semantic reading of the frozen field (`spend.rs:151-154`) that must be confirmed by the spec owner, and it applies R1 (`docs/RULINGS-2026-09-16.md:26-29`).
- Visibility defaults to `private` (`docs/SPEC-SPEND-RECEIPT-1.md:108-113`).
- Surfaces show the total first, itemized beneath (`RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08.md:13-15`).

**8.2 Free tier = bring-your-own-resources reciprocity.**
- **Rule F-1:** a conversation's forwarding, replication and offline holding are performed by its members' own devices.
- **Rule F-2:** a free tier uses **zero A, zero chain bytes and zero third-party resources**.
- **Rule F-3:** in-kind contribution is metered with **zero-charge receipts**. This is the ruled precedent: "free-tier receipts simply charge zero, so a guest's history is ready the day they step up" (`LANE_M_B_METER_2026-08-29.md:6`). So fairness inside a group is visible, but it is never enforced with money.

The free tier honours Art. V.1 by construction: users fund what they consume, in kind. It honours "No person pays to use a BNR function" (`RULING_B_SPEND_BOUNDARY...:11`), because sending to a contact or group costs nothing in any asset.

Its price is honest and stated: **latency when nobody is online, and the user's own battery and data.**

Any device can sell its surplus as a provider. That turns reciprocity into income, paid in the settlement asset and never in b (E9).

**8.3 The open market (no indispensable operator).**
- A provider is anyone running the reference provider crate (P1). It publishes a signed **offer card**: a rate set in A per unit and term, the routes it accepts, and its jurisdiction.
- It is paid by bPay **to its own address**. BNR is never in the flow of funds (`docs/RULINGS-2026-07-26.md:47`; `docs/SPEC-BNROSE-ONBOARD.md:74-76`).
- There is no provider registry. Offers travel inside roads cards, invites and public offer lists that anyone may publish.
- The removal test is §11 A1-REMOVE.

Unit economics at the CLAIMED box unit ($101/mo; 24 TB; 1 Gbps; 10^5 connections, `LOADMODEL-1M.md:87,91`), ARITH:
- $1.40×10^-13 per byte-day retained;
- $4.45×10^-13 per byte forwarded at 70% utilisation;
- $0.0121 per connection-year.

A central user with a paid inbox costs about **$0.0124/yr**. The connection dominates. Retention is $1.2×10^-6 to $8.8×10^-5 across the 1–72 h pickup range, and forwarding is $0.00028/yr. With the archive (§6.4) the total is about **$0.20/yr**.

These amounts are tiny, so settlement friction dominates. That is why payment is by voucher.

**Settlement: user-bought vouchers.**
- "credit systems ... SURVIVE ONLY where USERS BUY the credits" (`RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:23`).
- The user buys a voucher from a provider of their choice through bPay. It is held in the provider's `voucher-escrow` ledger: A-denominated in Quatch, hash-chained, refuse-before-write, with USDC deposits citing `rate_ref` (`crates/voucher-escrow/src/lib.rs:1-20`).
- **Zero balance is a named `FloorRefusal`, never a top-up and never a loan** (`BUZZ_A_METERING_SPEC.md:109-112`). A refusal never blocks the free roads.
- Caps are signer-authoritative (`notes/paystack.md` §5).
- Paid provider operations sit behind a wallet session, which is not bzDiD (`RULING_WALLET_GATED_OPS_2026-08-20.md:42-58`). BYO P2P triggers no server work and needs no session.

Chain load (ARITH): 1%, 10% or 100% of users topping up yearly is 3.2, 31.7 or 317 tx/s. Monthly it is 38, 380 or 3,805 tx/s. Whether Vaulta and the bPay rails carry that is UNVERIFIED. Vaulta NET is about 181 GB/day, CLAIMED (`docs/bzdid-architecture-decision.md:373`), and see E6 for the account ceiling. **No message and no free-tier user ever touches a chain.**

**8.4 Rail C (no per-identity float at 10^10).**
- The system issues **zero balance to any identity at any N**. The free tier needs none.
- Paid vouchers are demand-driven purchases sized by the buyer, at roughly $0.20/yr. They are not system-issued float, and BNR is a demand source (`RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:16`).
- A-native payers are bounded by Vaulta account supply (E6). Others settle on bPay first-line rails.
- **Test ECON-7:** the count of system-issued per-identity balances must equal 0. A planted genesis grant must turn the test red.

**8.5 Spam economics, without contradicting free access.** There are four layers, chosen by the recipient's policy.
1. A **write ACL**: an inbox accepts only from admitted contacts and groups (`BMAIL-SORT:224`). Free.
2. **Introduction**: an admitted contact forwards an intro record. Free, at a social cost.
3. **Stranger postage**: the byte-days plus `NetByte` at the recipient's listed paid inbox, paid by the sender **at the provider's published commodity rate**. The roster and the offer card carry no recipient premium field, so an attention price is unexpressible. That follows the house rule "unnameable beats forbidden" (CLAUDE.md §5).
4. A **sender-CPU stamp**: proof-of-work at a recipient-set difficulty under a protocol cap ("Rate-limit with proof-of-work, not an operator", `docs/canonical-biometric-key.md:339`, CLAIMED). It costs the sender's own CPU and no money.

**Why this does not contradict "No person pays to use".** Contacting people you know is free (layers 1–2). A stranger's cold contact consumes either a third party's physical storage, which is a commodity ("Consuming physical resources is metered. Two transactions, two layers", `RULING_B_SPEND_BOUNDARY...:11`), or the sender's own CPU. Nobody pays for access to a function or to a person.

The doctrine is the same as the registrant-pays corollary: "Registrant-pays and attack-pricing are the same mechanism" (`docs/bzdid-architecture-decision.md:196-197`). A no-fee ruling had the same shape: "spam handled by self-paid RAM" (`docs/dispatches/RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md:18`).

**Where it must escalate:** an attention bond, or postage above commodity cost (E4). An "open inbox" (policy 0/0) is available. The recipient then bears inbound bytes from their own BYO budget under a daily cap, and overflow gets a named refusal.

**8.6 HARDLINE 8d, the ten-billionth-user test, passed explicitly.**

| cost item | grows with N? | who pays at N = 10^10 | BNR's marginal cost of user 10^10 |
|---|---|---|---|
| sending, forwarding, offline holding (free) | yes | members' own devices | **0** |
| inbox, relay, SFU, connections (paid) | yes ($0.0124/user-yr) | the user | **0** |
| archive chunks ($0.19/user-yr) | yes | the user | **0** |
| verify CPU (25.0M/s globally) | yes | the readers' devices | **0** |
| chain writes | top-ups only | the payer | **0** |
| identity (zero chain bytes) | no | none | **0** |
| bootstrap seeds | **capped** | BNR, fixed per epoch | **0** after the cap |
| spec and reference-code maintenance | no | BNR | **0** |
| epoch notary root ("pennies per epoch", `SPEC-BNROSE-3...:102`) | no (per-root inclusion is claimant-paid) | any leader | **0** |

The seed arithmetic (ARITH; inputs ASSUMPTION):
- Cold-start fetches at 10^10 users are 2×10^10/(3 yr × 365) new devices plus 1%/day cache loss. That is 2.18×10^8 fetches/day of a 4 KiB signed hint list: 0.89 TB/day, 82.8 Mbps.
- BNR caps its seeds at **10^7 fetches/day (41 GB/day, 3.79 Mbps)**, a fixed per-epoch budget like the leader's commit (`bzdid-architecture-decision.md:157-159`).
- The cap binds at about 9.16×10^8 devices, or about 4.58×10^8 users. Beyond that point **∂(BNR cost)/∂N = 0**.
- An overflow joiner gets a named refusal ("seed budget exhausted — use an invite or another seed"). Invites carry the inviter's roads card and device card, so **an invite-join touches no seed at all**.
- Anyone may mirror the static hint list. Seeds are bootstrap and sunset (Art. V.2).

**Verdict: the cost of the ten-billionth user does not land on BNR.** Today's estate relay (E8) is the one place it could. Under this design it serves only estate consumption, or charges, or is capped.

---

## 9. Moderation and abuse

- **The kernel is blind.** "That observability lives at the social layer or nowhere" (`docs/BIND-1.md:108`). There is no universal reputation score. Communities pick their own `ReputationEngine` (`docs/CONSTITUTION.md:107`).
- **The conversation is the unit.** Admin roles live in the signed ROSTER. Removal is a roster change plus a rekey, paid by the remover (§4). Reports are signals, never triggers (`notes/critic.md` §4.3).
- **Providers carry ciphertext under their own policy and jurisdiction.** A provider's refusal is local, never global, and users move to another provider. Abuse is self-limiting economically: an abuser burns their own bandwidth, postage or CPU.
- **Device-side filters** are free (BYO). Agents that read untrusted text never share context with write authority (AGENT-1 Q-2, `LD/AGENT-1.md:155-158`).
- **Illegal content (E14, counsel gate).** Plaintext exists only on members' devices. By default, permanence rails hold only commitments. The design makes **no deletion promise** (`GLOSSARY-BRIDGE.md:34`).
- **The "platform safety" operator role** that upstream Buzz assumes (`notes/critic.md` §4.3) has no holder here. That is named as an open risk, not solved.

---

## 10. 1,000-year continuity

**Crypto agility.** Suites are additive and unknown suites are refused (§3.1). Retiring ML-DSA-65 goes through the SLH-DSA handover. A second KEM family (HQC) is added when FIPS 207 is final (`SPEC-BPQ-1.md:268-269`).

**Re-anchoring history.** A signature proves something only if it existed before the break (`SPEC-BPQ-1.md:120`).
- Each archive batch root is timestamped by a hash-only notary (OpenTimestamps over SHA-256).
- It is renewed under a new hash before the old one weakens, on the RFC 4998 model (`SPEC-BPQ-1.md:120-125`).
- **The cost is per batch root (32 B), not per message.** It is paid by the archive owner. The epoch notary transaction is a fixed per-epoch cost (§8.6).

**Formats.**
- Deterministic CBOR.
- Every batch carries its format id plus the content hash of the spec text, archived beside it. That lets an airgapped verifier rebuild "in 200 years" (`pirate-haul-rulings-2026q3.md:86`).
- Receipts keep exact quantities, "Preserved verbatim so a historical receipt stays re-priceable" (`spend.rs:131-132`). So **if A, Vaulta or any rail dies, history is re-priced, never rewritten.**

**Time (L4).**
- Records use u64 seconds, which overflows in about 5.8×10^11 years.
- Vouchers that settle through Antelope inherit the `time_point_sec` u32 boundary at 2106-02-07 06:28:15 UTC (`SPEC-BTUNGSTEN-1.md:134-144`). A voucher's expiry must sit before that boundary and fails closed if it does not.
- Test rows sit at 2038 (i32), 2106 (u32), 2^63 and 2^64.

**Upgrade governance.**
- Versions are additive, with deprecation windows "measured in years" (`docs/CONSTITUTION.md:92`).
- The roster lists each member device's supported versions. A sender encodes at the highest common version, so a never-upgraded device keeps working with peers that still speak its version.
- Kernel changes go through Art. VI §3: an RFC, a reference implementation and passing tests before any vote (`notes/critic.md` §2).
- Client releases are signed by the PQ-SIGNERS set. Who may add a second signer is a founder question (`notes/pq-tungsten.md` §6).

**Extinction drills** (each is a test row, L1 `SPEC-BTUNGSTEN-1.md:104-108`). Remove each of the following and show continuity: BNR seeds; each provider; DNS; Vaulta; A as the unit (re-price under a new rate set); ML-DSA-65 (handover); X-Wing (a new suite); Autonomi (the archive migrates to another durable rail, with local copies kept); x0x (machine traffic falls back to providers); and the UI (another conforming client resumes from the archive, memory order "How to apply").

---

## 11. Tungsten conformance matrix

Criteria are named here, before any run. Every gate ships with a planted flaw in the same job (`SPEC-BTUNGSTEN-PQ-1.md:42-43`). Evidence classes follow `SPEC-BTUNGSTEN-1.md:269-275`. NOT-RUN is never PASS.

| id | axis/law | test family | pass / fail | evidence class | formal obligation | teeth (must convict) |
|---|---|---|---|---|---|---|
| A1-REMOVE | Axis 1 | kill BNR seeds, each provider, the DNS name, and the estate relay, separately and together | PASS: a 3-member conversation keeps delivering through R0/R6 and another provider, with no data loss per the §6.1 definition. FAIL: any delivery needs a removed component | MEASURED, multi-host | none | a client build hardcoding one hostname must fail the run |
| A1-ECON-8D | Axis 1 + 8d | metabolic simulator at N = 10^2…10^5 clients | PASS: the BNR-paid quantity per epoch is constant once the cap binds. FAIL: any BNR line grows with N | MEASURED (sim) + ARITH bound (§8.6) | `rates_reproduce_charges` exact over u128 | a planted "seed stores one message" path must turn the run red |
| A2-SYBIL | Axis 2 | spawn 10^4 identities | PASS: zero free resources gained (no per-identity allowance) | MEASURED | none | a planted welcome grant must be convicted |
| A2-REPLAY | Axis 2 | replay, reorder or splice LINKs and CHECKPOINTs across conversations | PASS: all refused (the chain plus conv id is bound) | CHECK-SAMPLED, then PROVE | LINK chain binding; `domainsDisjoint` including the two new labels | a decoder ignoring `prev` must be convicted |
| A2-ENC | Axis 2 | envelope encode/decode | PASS: canonical injectivity on the accepted language | WB001 ladder: RED → vectors → TYPECHECK → PROVE (rb05 precedent) | encoding injectivity; T-VACUOUS (empty checkpoint, empty roster); T-TRUNCATE at 0, 1, r−1, r, r+1, 255, 256, 257, 4096 | a lenient decoder accepting non-canonical CBOR must be red |
| A3-HEAL | Axis 3 | kill a device mid-send, corrupt a replica, partition | PASS: redelivery of identical bytes only; a missing response stays UNKNOWN | MEASURED | none | a resend with a fresh nonce must be convicted |
| A4-LEARN | Axis 4 | adaptive policies (padding, road choice) | PASS: they never alter suites, payer or refusal rules; every change is receipted | CHECK-SAMPLED | none | a policy that silently widens slippage must be red |
| A5-SCALE | Axis 5 | the §7 bounds plus physical rungs 10^3 → 10^4 nodes, with no rung skipped (`LOADMODEL-1M.md:137`) | PASS: per-device bytes within 1.5× of the ARITH model | MEASURED per rung | none | a run on one host labelled "mesh" must be refused |
| A5-CPU | Axis 5 | ML-DSA-65 / X-Wing bench | PASS: CI-printed p50/p99 per device class | MEASURED bench, not capacity | KAT inherited (2,729/2,729, `notes/pq-tungsten.md` §2) | a 0 ns or skipped bench = NOT-RUN |
| A6-EXTINCT | Axis 6 | the §10 extinction drills | PASS: each drill resumes from verifiable state | MEASURED | handover refusal rules | a second handover from the same `from` must be refused |
| L1 | L1 | per-epoch attribution: one authority chain per persona per conversation | PASS: no two live keys for one persona | PROVE (roster state machine) | roster transition function | a forked roster must be refused |
| L2 | L2 | grants, vouchers and sessions all expire within ≤1 epoch | PASS: no record authorizes beyond its expiry | CHECK-SAMPLED → PROVE | expiry monotonicity | a grant without an expiry must be refused |
| L3 | L3 | no population-scale state at the execution primitive (provider ledgers per customer, epoch receipts aggregate) | PASS: provider state is O(customers), never O(N) | ARITH + MEASURED | none | a global table must be red |
| L4 | L4 | clock rows 2038 / 2106 / 2^63 / 2^64 | PASS: a voucher fails closed before 2106; records refuse on overflow; no wraparound | PROVE (encoder) | no-wrap theorem | the WB004 truncating-encoder tooth (`notes/pq-tungsten.md` §5) |
| L5 | L5 | provider and peer admission EXPOSURE → IDENTITY → PEER → AGREEMENT | PASS: "connected" only after all four receipts | MEASURED | none | a configured-but-unreached provider shown green must be red |
| ECON-1 | B1 rule 3 | one funder settles two users' operations | **must FAIL** (`BUZZ_A_METERING_SPEC.md:107-108`) | MEASURED | none | itself a negative control |
| ECON-2 | B1 rule 4 | zero balance | PASS: a named `FloorRefusal`, and the free road is still offered. FAIL: a silent top-up or a lost message | MEASURED | none | a planted auto-top-up must be red |
| ECON-4 | receipts | byte-scan every receipt for plaintext, conv ids and message hashes | PASS: none found | MEASURED | none | a planted body in a memo must be found |
| ECON-6 | Rail C / B1 §4 | unfillable A→ANT swap | PASS: refused and named; messaging continues | MEASURED | none | auto-widened slippage must be red |
| ECON-9 | double entry | client tally vs provider epoch receipt | PASS: inflation > ε is detected | MEASURED | none | a provider over-counting 1% must be convicted |

---

## 12. Migration from today's Buzz

1. **M0, nothing breaks.** skaists.buzz and relay.skaists.dev keep running. The 18 agents keep running on buzz-acp and buzz-cli unchanged. bChat v2 surfaces run alongside.
2. **M1, personas.** Each human npub and agent npub is bound to its owner's bzDiD with a bidirectional binding (`CONSTITUTION.md:52`). The binding is `Selective`, shown to conversation members only, and never public (K15 escalation in `notes/law-constitutional.md` §2).
3. **M2, history.** Each owner exports their own legacy events into their own archive. Exporting is BYO and archiving is user-paid. The estate pays for the estate's own history.
   - Authorship stays with the old npub persona under the bzDiD. It is never rewritten ("MUST NOT rewrite event authorship", `notes/buzz.md` §1).
   - What runs on Hostinger, and what its Postgres holds, must first be inventoried (UNVERIFIED, `notes/critic.md` §6.5).
4. **M3, agents.** The reference provider exposes a NIP-01/NIP-42 compatibility facade, in the pattern of the x0x-nostr-bridge prior art (`notes/x0x.md` §8), so buzz-acp needs **zero changes**.
   - Hazard: buzz-acp treats any AUTH denial not prefixed `error:` as terminal (`notes/buzz.md` §1).
   - The facade must never emit a non-`error:` denial during cutover. That is a tooth in P4.
5. **M4, the relay becomes a provider.** The Hostinger relay is one market provider. Estate consumption is the estate's own cost. Outsiders either pay or use BYO (E8).
6. **M5, media.** Host-absolute URLs are rewritten into content-addressed references, resolved through the roads card.

---

## 13. Build plan

Every acceptance item is a receipt printed by CI on the landing commit (`notes/pq-tungsten.md` §1.7). The owner seats are proposals.

| phase | owner (proposed) | reuses | acceptance (receipts) | unblocks |
|---|---|---|---|---|
| **P0.a** verify-CPU bench | Seat 3 + zCode review | RustCrypto ml-dsa 0.1.1, libcrux, noble 0.7.1, bpq-core X-Wing | CI JSON with sign/verify/encap/decap p50/p99 on the 4 founder devices and a runner; NOT-RUN rows printed | §7.6 budget; A5-CPU |
| **P0.b** envelope v2 grammar | Seat 3 → zCode for SAW | btungsten-wb001-core pattern, rb05 recipe | a RED counterexample first; then vectors, a strict decoder, T-VACUOUS and T-TRUNCATE teeth convicting; a two-label `domainsDisjoint` proposal filed to zCode | A2-ENC; every later phase |
| **P0.c** metabolic simulator `buzz-metabolic-sim` | Seat 3 | `shared_types::spend::SpendReceipt` | A1-ECON-8D, ECON-1, ECON-2, ECON-6, ECON-7 green, **with planted subsidies convicted in the same job** | the 8d claim becomes a receipt instead of arithmetic |
| **P0.d** roads card plus content-addressed media in the bChat surface | bChat seat | the bchat dual-home ROOM block, ladder.rs rungs | e2e with skaists.buzz route-aborted: "connected via road N" receipt; media still resolve | ends the SNI outage class |
| P1 reference provider crate (inbox, relay, compat facade) | ZCode seam consumer | ReplicatedJournal (second replica on another host), dest-apply, voucher-escrow | A1-REMOVE, ECON-9, L5 four-receipt admission | the market |
| P2 BYO replication, store-carry, sealing | Seat 3 + bChat seat | bpq-core X-Wing/AES-GCM | an offline-both delivery receipt; a rekey-on-remove receipt (ours, not x0x's) | free tier |
| P3 archive batching | ANT lane | ant-pay.js with the user's key | a batch ≤63 chunks receipted; swap refusal named | durability |
| P4 migration | Seat 3 | buzz-acp unchanged, M0–M5 | 18 agents reconnect; 0 terminal AUTH denials; history exported | cutover |
| P5 scale rungs | box lane | btungsten-meshdep | 10^3 then 10^4 nodes; a phone measurement | A5-SCALE |
| P6 x0x machine road | x0x lane | x0x ≥ v0.48.0, hash-pinned | an agent→agent receipt; nothing human-plane on x0x (a grep tooth) | X-2 bridge |
| P7 (ruling-gated) | founder | — | E1, E4, E5, E15, E16 | — |

P0.a through P0.d need no pending ruling. They add no bsigner command, no chain contract and no spend, and they touch no frozen file.

---

## 14. Open questions and risks

1. **Settlement throughput at 10^10 is UNVERIFIED** (§8.3). Vaulta account supply makes A-native settlement a niche path (E6). bPay's first-line rails carry the paid tier, or the paid tier stays small.
2. **The unit-economics inputs are CLAIMED** ($101/mo box, 10^5 connections). A real provider rate set needs a measured box (P1). The conclusion that paid inbox is cents per user-year survives a 100× error.
3. **The free tier's latency is real.** Users with no always-on device and no online group member wait. Delay is the honest price of zero cost, and it must be shown, never hidden.
4. **Proof-of-work stamps penalize low-end devices and burn energy.** They are one option of four, never mandatory, and they need an accessibility review.
5. **Checkpoint amortization weakens attribution between checkpoints.** For authority kinds K=1 is mandatory. Whether a group can tolerate a 10 s attribution window is a UX question.
6. **The `spender_bdid` pairwise-persona reading** needs confirmation from the spec owner (§8.1).
7. **The new ResourceClass variants (E5), the tithe scope (E10), attention bonds (E4), b for providers (E9)**: all founder.
8. **Moderation has no platform-safety holder.** The counsel gate (E14) blocks any public-permanence feature.
9. **A one-maintainer upstream (x0x) and a corporate upstream (Buzz)** are pinned and mirrored only (`notes/critic.md` N10). METABOLIC depends on neither for the human plane.
10. **Agents that post** (E18) and **social recovery** (E15) stay open.
11. **Group archives with a rotating payer** must be checked against "one shared funder" before they ship (§6.4).
