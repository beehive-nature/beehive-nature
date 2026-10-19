# SPEC-BUZZ-PQ-1 — Beside Now, Strata Next

Status: DRAFT for founder ruling, 2026-10-15 (Claude Code seat); nothing here is ruled

Synthesis of five design-round drafts after four lens judges (law, buildability, scale, tungsten). Base: BESIDE (`D/lawful-minimal.md`), base choice of two judges and highest summed score. Grafts: STRATA's continuity core (`D/millennium-first.md`), mesh-native COMB's road-policy file and delivery states (`D/mesh-native.md`), METABOLIC's meters and teeth (`D/economics-first.md`), planet-scale COMB's bench lane, locality ladder and Tier-S rule (`D/planet-scale.md`). Judge findings are fixed or named (§15).

Keys: `R` = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`); `BZ` = `C:/Users/travi/buzz-src` (`e1035672`); `LD` = `C:/Users/travi/LOVErnment-DAO/specs`; `UP` = `pqbuzz/up/` (x0x v0.48.0 copies); `N:` = reader notes; `D/` = `pqbuzz/designs/`; `MEM` = `C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory`. Classes: RULED, MEASURED, SOURCE (read in code), CLAIMED, UNVERIFIED, ASSUMPTION, ARITH (recomputed this session with node from stated inputs; legacy sizes also reproduce in `pqbuzz/lm/calc-lm.js`, `calc-priv.js`), READING (a rule applied beyond its written scope; always escalated).

---

## For the founder

What this is. A plan for a Buzz that quantum computers cannot forge, that keeps working when a building blocks one web address, and where every person pays for what they use. Today's Buzz keeps running. Each message keeps its normal signature and gains a second, quantum-safe signature, added once a week per conversation so it stays cheap. A new message format that is quantum-safe from the start is built and tested in the lab now and switched on later. Saved history moves onto storage each person pays for. Nothing here is ruled and nothing is built yet.

What happens first, with no ruling needed:

1. Every app and every agent gets a list of relay addresses, so a blocked name becomes one dead road instead of an outage. Tonight's failure ends here.
2. We take a fingerprint of all of today's Buzz history and timestamp it now, while today's signatures still hold.
3. We measure how fast phones and servers check the new signatures, and we build and test the long-term message format in the lab.

What we will never claim: that Buzz is "tungsten certified" (this plan names the tests it must pass), that a conversation is private when it is not, or that a deleted message is gone from everyone's devices.

Decisions only you can make, one line each:

1. Should messages between people ever travel over x0x, or does x0x stay for machines only?
2. May we update the relay on the Hostinger box, after a database snapshot, so it accepts the new message types and late deliveries?
3. Who pays for always-on community relays: each community, or BNR beyond its few fixed seed relays?
4. May an agent's host machine hold that agent's quantum-safe key, the way it already holds the agent's Buzz key?
5. Does your Safe 7 ruling (each device has its own key and the recovery phrase never goes onto a device) cover every phone, laptop and agent host?
6. Does the rule that agent authority expires unless a human renews it cover every agent or only bQueenBee, and how often should renewal be?
7. May bSigner gain the command that signs Buzz message fingerprints, or must that signing stay outside it?
8. Must skaists.buzz stay the community's identity, or may a signed community charter be the identity with the name kept as its label?
9. May a stranger be asked to pay a small storage and bandwidth cost to reach someone's inbox, or must a first message always be free?
10. Is account recovery with help from friends allowed?
11. May Apple and Google push wake-ups be used as an optional extra?
12. Should the 10 percent tithe apply to relay costs, or only to the Claude agents lane?
13. Will you rule on three fixes to the identity root: a recovery key that survives quantum computers, the written recovery code outranking the passkey, and a newer hash for the root itself?
14. Should the road list and the list of retired algorithms be law files signed with your one press?
15. Who may declare an algorithm broken, which switches every app into quantum break mode, and with how much notice?
16. May we run a second relay host outside Hostinger, so every message is held in two places?
17. Are speech transcripts made on the speaker's own device allowed under BIO-1?
18. Will counsel review illegal content on permanent storage before any public archive exists?

---

## 0. Thesis and name

**Beside Now, Strata Next**: two stages, one record grammar.

**Stage 1, Beside (P0 to P6, lawful under every current ruling).** Buzz stays the human plane on its real relay, byte for byte, as PLANE LAW and "own the relay" assign it (`R/docs/ledger/pirate-haul-rulings.md:18`, `:51`). Each device or agent harness journals the exact bytes it signs and, once per conversation per week, lists those ids in a checkpoint attested by the already-built SPEC-BPQ-1 §5b statement (`R/docs/specs/SPEC-BPQ-1.md:211-227`): no new label, no new cryptography. Weekly windows cost no forgery resistance before a quantum break, since nothing needs settlement to display a message then; settlement is evidence for after the break, and a living author can settle late from their own journal (§10.3). Confidentiality is an additive bChat Core lane of existing bpq1 sealed objects (`SPEC-BPQ-1.md:150-188`). A road list pinned by a post-quantum-attested community charter ends the dependence on one DNS name.

**Stage 2, Strata (P7; lab work from P0, live after founder word).** One binary format of record, `bzm1`, proposed as bChat Core envelope v2: per-sender hash chains, composite ML-DSA-65 plus Ed25519 seals, rotating mailbox envelopes, an append-only algorithm registry, a three-state validity rule, dual-hash evidence renewed over ciphertext, an airgapped verifier. It is the only lane for new authorship once the registry records `distrust(secp256k1)` (break mode, §10.3).

The claim, word for word: **"Classical now; post-quantum settled by checkpoint; native post-quantum records next. No end-to-end claim on channels. No forward secrecy before the native lane."** The design names receipts and claims none (`R/docs/dispatches/2026-10-06-btungsten-lane.md:45-47`; "A property with no receipt is a hypothesis, not a result", `R/docs/specs/SPEC-BTUNGSTEN-1.md:37`).

---

## 1. Plane mapping and escalations

### 1.1 Plane mapping (`R/docs/ledger/pirate-haul-rulings.md:18`)

| Plane | Carries | Never |
|---|---|---|
| Human (Buzz) | channels, DMs, PQ-private lane, binds, checkpoints, attestations, charters; from P7 `bzm1` mailbox envelopes | system of record (`:17`; "The VPS is cache/bootstrap, never a system of record", `R/docs/SPEC-PAY-ONCE-NOW-1.md:67`) |
| Machine (x0x) | agent traffic as already ruled; road-policy file lists it `planes:[machine]` (§5.5) | human-plane frames; storage (X-1); liveness needed for data (X-3) |
| Durable (Autonomi) | each user's sealed monthly archive bundle of 256 KiB or more | the only copy |
| Permanence (Arweave) | bundles under 256 KiB and evidence copies, once a paid path is receipted | private plaintext |
| Settlement (via bPay) | nothing per user or message; metered relay spend only if E3 is ruled | per-user rows (`R/docs/bzdid-architecture-decision.md:61`) |

The record is the exact signed bytes in journals and archives (§6); the relay is cache, fan-out, membership gate, moderation and bootstrap. BNRoSe leg (`R/docs/SPEC-BNROSE-0-CHARTER.md:36-39`): messaging fits none ("Don't bend a taxonomy", `R/docs/dispatches/RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md:65`); this kernel/bChat adapter document **consumes** L2 (journal) and L1 (archives).

### 1.2 Escalations (named, not resolved; each has a switch)

| # | Collision | Cited rule | Without a ruling | If ruled otherwise |
|---|---|---|---|---|
| E1 | Human plane over x0x | PLANE LAW, X-1, X-3 (`pirate-haul-rulings.md:18`); "anything held only in x0x must anchor ... or it does not survive" (`pirate-haul-rulings-2026q3.md:27`) | x0x carries no human frame; adapters refuse with `ROAD_PLANE_FORBIDDEN` | Re-sign the road-policy file adding `human` to an x0x entry (a signature, not code): desktop and server only, never phones or storage. Still needed: a TCP rung (UDP only), v0.48.0, the unreleased store fix #115 (N:x0x.md §0-§3), history OFF since ADR 0023 stores MLS plaintext (`UP/adr/0023-durable-local-history.md:91`), P0.h data |
| E2 | Encrypted lanes, outbox | Buzz "NEVER a storage/permanence/privacy/settlement layer" (`pirate-haul-rulings.md:17`) | READING: privacy belongs to bChat Core, the ordered stack (`R/docs/specs/SPEC-BCHAT-1.md:1-6`); the relay carries opaque bytes | PQ-private lane moves to another NIP-01 road |
| E3 | Who pays the relay | Art. V.1 standing costs = seeds and spec only (`R/docs/CONSTITUTION.md:83`) vs "Buzz's own A pays ... its relay" (`R/docs/dispatches/BUZZ_A_METERING_SPEC.md:105-106`) | BNR runs its own community relay (estate consumption) and fixed-capacity seeds; other communities fund theirs | Relay metering on (§8.1), member pays, `FloorRefusal` at zero |
| E4 | Relay changes are RED class | "Relay upgrade is RED class: needs founder word, a DB snapshot" (`MEM/buzz-version-gap-and-point-model.md:30`) | P0 and P1 touch no relay; checkpoints stay journaled and timestamped off-relay | P2 deploys four kind arms (unknown kinds are rejected, `BZ/crates/buzz-relay/src/handlers/ingest.rs:344`) and late-accept (§6.3); later kinds by separate word |
| E5 | Agent PQ key custody | "no agent holds/requests/transmits private key material" (`C:/Users/travi/CLAUDE.md` §2) | READING: the harness host, never the model, holds a host seed, as it holds the agent's nsec today (`BZ/crates/buzz-acp/src/config.rs:243-244`; `LD/AGENT-1.md:65`, `:155`) | Owner's device attests agent checkpoints |
| E6 | R4 for every device | R4 rules the hardware signer (`SPEC-BPQ-1.md:280-281`; `R/docs/RULINGS-2026-10-04.md:59-66`) | READING: every device derives PQ keys from its own seed | Trusted devices may derive from the wallet root |
| E7 | Q-5 for every agent | Q-5 is bQueenBee's: "Her app password requires a human heartbeat" (`LD/AGENT-1.md:168-169`); "remove me from gating" (`MEM/founder-remove-me-from-gating.md`); grants need "duration and limits" (`MEM/sovereign-operating-environment-order.md:21`) | READING: every agent endorsement expires; renewal is one press per founder-set interval | Longer intervals for other agents; an expiry stays |
| E8 | bSigner freeze, signer name | `bpq-attest-nostr` is outside the frozen table (`R/crates/bsigner/CONTRACT.md:14-24`); "a seat may not decide which" (`R/docs/dispatches/2026-10-09-pq-status-verification.md:274-283`); "THE signer name" (`CONTRACT.md:49`); no library target (SOURCE) | JS twin `BPQ.attestNostr` (`R/surfaces/bpq.js:334`) in a Node helper, once per checkpoint; frozen `bsigner bpq-verify` (`CONTRACT.md:23`, `R/crates/bsigner/src/main.rs:664-665`) verifies | bSigner gains a library or device-seed path; buzz-acp signs in Rust |
| E9 | Community identity = DNS name | ORIGIN RULING, "don't touch it until you know which it is" (`R/docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:72`), "IT IS IDENTITY, LOAD-BEARING" (`:83`) vs "cryptographic authority determines what the system accepts" (`R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:90-91`) | Label kept byte for byte; the ruling's own split: "push.origin = identity string (stays), the join URL = connection string" (`LANE_RELAY_DUALHOME:90-91`); acceptance moves to the charter | Charter gains a new label |
| E10 | New law files | CI governs files named in `docs/PQ-LAW.json` (`SPEC-BPQ-1.md:135-142`); adding one is a governance change | Road policy and registry are signed by the one-press (`R/docs/specs/SPEC-BTUNGSTEN-PQ-1.md:671`) but not listed | Listed; a stale signature turns CI red |
| E11 | Kernel `MessageEvent{from_did,to_did}` | R1 (`R/docs/RULINGS-2026-09-16.md:26-29`); `R/crates/shared-types/src/events.rs:210-218` | Local bus only; never anchored | Archives may include it |
| E12 | Plaintext on permanent rails | "no deletion promise exists anywhere" (`R/docs/GLOSSARY-BRIDGE.md:34`); counsel (`R/docs/specs/SPEC-BLICENSE-0.md:187-191`) | Sealed archives only | Public archives after counsel |
| E13 | Spam postage vs free access | "No person pays to *use* a BNR function ... **Two transactions, two layers.**" (`R/docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`) | Membership, quotas, wallet-gated per-address quotas (`R/docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:42-44`, `:61-63`), moderation | Over-quota `NetByte` purchasable at commodity rate; offers have no recipient-premium field, so attention prices are unexpressible |
| E14 | Social recovery | "must require the original body" (`R/docs/joint-liveness-coherence.md:174`; a 7-agent synthesis, `:1-7`; CLAIMED-as-ruling) | Not offered | Threshold recovery card |
| E15 | Vendor push | VENDOR-HELD defines "A browser-resident feature" (`R/docs/RULINGS-2026-09-30.md:23-27`), applied **by analogy** | Existing iOS content-free push optional; all delivery gates pass with push off | Allowed as enhancement, or poll only |
| E16 | b in the Buzz loop | "earn b" (N:law-constitutional.md #44) vs "b does not appear in the alpha metering path" (`BUZZ_A_METERING_SPEC.md:80-82`) | A only | b as a separate line by ruling |
| E17 | Per-identity float | "FOUNDER QUESTION IN FLIGHT" (`R/docs/dispatches/RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:88`, `:100`) | Nothing pre-funded; spend at time of use | None needed |
| E18 | Binding visibility; rosters | Art. II bidirectional links (`CONSTITUTION.md:52`) vs R1; P-10 (`LD/PERSON-1.md:117`) | Pairwise per community, never anchored; Buzz's per-community membership; no global roster | Binds move into the PQ-private lane |
| E19 | Missing meter units; frozen field | "Adding a unit requires a ruling" (`BUZZ_A_METERING_SPEC.md:53`); `spender_bdid` FROZEN (`R/crates/shared-types/src/spend.rs:151-154`) | Interim: retention = `StorageByte`, term in rate set; connection = `RamByte` + `NetByte` per term; providers key by wallet session, "not bzDiD" (`RULING_WALLET_GATED_OPS:56-58`) | New units with a `SCHEMA_VERSION` bump (`spend.rs:38-39`); spec owner rules on a pairwise `spender_bdid` |
| E20 | Tithe scope | voucher-escrow writes `tithe.founder` on every charge (`R/crates/voucher-escrow/src/lib.rs:9`, `:586-592`); tithe ruled for the Claude lane (`R/docs/dispatches/LANE_M_B_METER_2026-08-29.md:5`) | No relay tithe; third-party relays use `SpendReceipt` only; voucher-escrow only in the simulator and ruled lanes | Tithe line on BNR-operated relays only |
| E21 | A-native settlement | 12,718,760 to 29,994,617 accounts fit (`R/docs/RECEIPT_R8_VAULTA_RAM.md:47-50`): 0.127% to 0.300% of 10^10 (ARITH) | A is the rate unit; bPay first-line rails settle (`R/docs/RULINGS-2026-09-16.md:73-78`) | Paid tier caps near 1e7 payers |
| E22 | Identity-root defects | (a) `KeyAlg {Ed25519, MlDsa65}` "added BY RULING" (`R/crates/bzdid/src/genesis.rs:35-44`); (b) "the lower `signedBy` index wins — r0, the key kept furthest offline" (`R/crates/bzdid/src/succession.rs:44-48`) yet r0 is "PRF-derived" WebAuthn (`R/docs/bzdid-architecture-decision.md:49-50`); (c) SHA-256 root forever (`genesis.rs:16`) | Messaging never needs r0; D13 red; evidence covers genesis ops under SHA3-256. Analysis, UNVERIFIED: an RP-domain captor *is* the origin, can solicit r0 by a normal passkey prompt, and r0 wins every fork | (a) add `slh-dsa-shake-256f`; (b) rank r1 above r0; (c) v2 root ceremony |
| E23 | Who retires algorithms; vote tier | Axis 4: never "silently rewrite" invariants (N:pq-tungsten.md §1.2); Art. VI tiers (`R/docs/article-vi-s3.md:30-38`) | Records only after the Proof gate (`:13`), by one-press. Proposed: admit = Feature; accept a retired suite = Safety (K=4, 13%, `:37`, `:51`); registry rules = Meta; Epoch 0: founder | Ruled authority and tiers |
| E24 | Transcripts | "If a bit was computed from a body, it stays on the body's device" (`LD/BIO-1.md:35`) | None in this design | Speaker-opt-in, on-device, sent as content |
| E25 | Handover log owner | "the job of whoever keeps the log" (`SPEC-BPQ-1.md:207-209`) | Per community/conversation; first seen wins; second kept as evidence | bzDiD rotation op |
| E26 | Hosts beyond scope | "my four devices and the hostinger vps" (`MEM/founder-no-pr-no-local-server-live-check.md:11`) | ρ = 1, shown "held by 1"; rungs above 9 wait | Second relay host; test fleet |
| E27 | Process, placement | Seat 3 "**Don't:** design" (`R/ORDERS-1.md:61`); "start no competing ... system" (`MEM/sovereign-operating-environment-order.md:13`) | Draft for ruling; Seat 1 assigns; bChat Core v2 plus a Buzz adapter set, not a rival stack | Seat 1 reassigns |

---

## 2. Identity, devices, agents, keys, succession, recovery

**Root.** The bzDiD is the only root (VOCABULARY Law 7, N:law-identity-scale.md §1.1): "zero" chain bytes at "zero" cost (`R/docs/bzdid-architecture-decision.md:59`); "No authoritative store must exist for a free identity to work" (`:390`); "Key rotation must never orphan data" (`R/docs/CONSTITUTION.md:49`).

**Keys per user, pairwise by default** (`R/crates/onboarding/src/lib.rs:113-133`):

| Key | Derived from | Scope | Published |
|---|---|---|---|
| npub | as today | per community | to that community |
| device PQ persona (bzpq1) | the device's own seed, context `buzz:<charter-id>` (57 printable characters, inside the 1-64 rule) | per device per community | inside `K_BIND` |
| recovery card | wallet root, `buzz:<charter-id>:r` | per community | pinned at first bind |
| archive persona | wallet root, `buzz:archive` | per user | never; devices seal to its card |
| device-to-wallet binding | SPEC-BPQ-1 §3, both sides sign | per device | never |

Charter id = base32 of SHA-256 over the first charter event's bytes (52 characters). Derivations reuse frozen `BDID-v1/*` labels (`R/surfaces/bpq.js:180-188`); the device-seed model is R4's option (A) by READING (E6).

**`K_BIND`** (§3.2): `{v:1, cards, recovery, prev?, owner?:{npub, expires}, inference?:"local"|"remote"}`, Schnorr-signed by the npub, each card attesting the event id with §5b (the bidirectional link, `CONSTITUTION.md:52`). Members pin a persona's cards when first seen; a later bind is adopted only if an already-pinned card attests it, else "unendorsed key change", never silently. Bind bytes are OTS-stamped, since "A binding proves something only if it existed before the break" (`SPEC-BPQ-1.md:120-125`).

**Agents.** Each keeps its npub (Buzz "expects agents to hold their own keys", `R/docs/ledger/pirate-haul-rulings-2026q3.md:28`) and NIP-OA attestation; its PQ persona comes from the harness host seed (E5); its bind carries `owner:{npub, expires}`, attested by the owner's pinned card (E7). After expiry checkpoints read "owner endorsement expired"; NIP-42 is untouched, so the terminal-AUTH rule (`BZ/crates/buzz-acp/src/relay.rs:3804-3806`) never fires because of PQ. Revocation is a bind update signed `revoked` on an owner device, offline if needed ("Revocation is a physical act", `LD/AGENT-1.md:73`). **Tier-S events** (approvals 46030/46031, grants, binds, membership, moderation, payment intents) are attested individually and at once (planet-scale's rule). bLOVErAi is never a member (`LD/AGENT-1.md:198`); Q-3 is untouched (`:160`).

**Succession.** SLH-DSA-SHAKE-256f handover v1 (`SPEC-BPQ-1.md:190-209`), Rust only so far; logs per community and conversation (E25); the successor attests one summary over old checkpoint ids. A handover event is about 72 KB (ARITH: ⌈(49,856 + 1,952 + 64 + 2,000)·4/3⌉ + 500): 10.8 MB per user per algorithm era for 150 contacts, fetched lazily.

**Recovery ladder.** (1) another bound device authorizes the replacement; (2) the wallet re-derives from the passkey PRF; (3) the written code r1 is the floor, "the ONLY component that survives platform denial" (`pirate-haul-rulings-2026q3.md:73`), and the recovery card authorizes new devices. Until E22(b) is ruled, D13 stays red and messaging never relies on r0. "A replacement origin must be authenticated before it receives recovery material" (`R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:41-43`). A lost npub is replaced by a recovery-card-attested bind; the archive keeps both under one DID though Buzz cannot transfer authorship (N:critic.md §4.2). Messages sealed only to lost devices are unreadable; devices also seal to the archive persona, which opens from the phrase. No social recovery (E14), no uniqueness claim ("Custody is not uniqueness", `LD/PERSON-1.md:36`), no biometrics (`LD/BIO-1.md:37`).

---

## 3. The envelope of record

### 3.1 One format of record

**`bzm1` is the format of record** (§3.5). NIP-01 bytes enter it as record kind `legacy-nostr`: exact bytes as received, never re-encoded (stored-bytes law, `R/crates/bzdid/src/genesis.rs:26-30`), never re-signed ("An ML-DSA wrapper does not replace secp256k1", `MEM/sovereign-operating-environment-order.md:22`). Their header chain fields belong to the holding journal, so each device's archive is one hash chain.

| Envelope | Relation |
|---|---|
| NIP-01 | today's live wire; archived as `legacy-nostr` |
| bChat v1 JSON (`SPEC-BCHAT-1.md:65-71`) | read forever by a frozen decoder; v1 refuses unknown lanes (`R/surfaces/bchat-core.js:69-70`), so v2 is the bump (`CONSTITUTION.md:92`) |
| CanonicalEvent `MessageEvent` | local projection (E11) |
| x0x `DmEnvelope` | unused: ids in clear, 600 s lifetime (N:critic.md §4.1, §4.5) |
| WB001 | authority bodies embed WB001 intents |
| `bheart.signature/1` | bSigner's file envelope, unchanged |

### 3.2 Live-lane kinds and the relay changes

| Kind (provisional) | Purpose | Lands |
|---|---|---|
| 47100 `K_BIND`, 47101 `K_CP`, 47102 `K_ATT`, 37100 `K_CHARTER` | binds, per-cell checkpoints, attestations, charter | P2 |
| 47103 `K_PQG` | private-group message with an `h` tag | P6 |
| 22100 `K_PQAUTH` | ephemeral companion to NIP-42 AUTH | break mode |
| 47104 `K_BZM` | `bzm1` outer-envelope carrier | P7 |

No fork constant sits at 37xxx or 47xxx, and 22100 is clear of ephemeral kinds in use (SOURCE: `BZ/crates/buzz-core/src/kind.rs:77-83`, `:457-472`); recheck against upstream, 354 commits ahead (N:buzz.md §0). Each kind is one match arm with `Scope::MessagesWrite` (`ingest.rs:344`), under the 256 KB cap (`:2014`), budgeted to the 64 KiB frame. NIP-01 clients ignore unknown kinds; stock relays refuse them, shown as "classical only".

### 3.3 Algorithms and ids

| Use | Algorithm | Id | Class |
|---|---|---|---|
| legacy id, signature | SHA-256, BIP-340 Schnorr | implicit | classical, listed (N:buzz.md §7) |
| checkpoint attestation | ML-DSA-65 over `"bpq1/nostr-event" ‖ 32 id bytes` | `bpq:1`, `kind` | PQ |
| confidentiality | X-Wing draft-11 slots, AES-256-GCM, SHA3-256 key commitment | `bpq1`, `aead`, slot `to` | PQ (hybrid KEM) |
| group epoch key (P6) | slot `to:"group"`, label `bpq1/wrap/group` | slot `to` | joins `domainsDisjoint` |
| `bzm1` seal (P7) | ML-DSA-65 AND Ed25519 over `"bzm1/seal" ‖ SHA3-256(seal fields)` | suite id | PQ + classical hedge |
| succession | SLH-DSA-SHAKE-256f, `bpq1/handover` | `bpq:1` | hash-based |

Unknown ids are refused, never defaulted (`SPEC-BPQ-1.md:265-272`). The live lane adds no `bpq1/` label until P6, so the 14-label proof stands (`R/crates/bpq-core/src/layout.rs:34-61`). The eight `bzm1/` labels live in a new crate with disjointness proved against `bpq1/`; bpq-core and bSigner are untouched.

### 3.4 Signature amortization, honestly modelled

**Per-cell checkpoints.** A cell is one channel, scoped by its `h` tag, which the relay already gates by membership (`BZ/crates/buzz-relay/src/handlers/req.rs:133-138`, `:1022`), or one private conversation. `K_CP` content is canonical base64url of the 32-byte ids **this persona signed in this cell** since its last checkpoint, read from its own journal ("attest what you signed, never what you observed"); tags `v`, `c`, `h`, `seq`, `prev`, `range`. Per-cell scope limits each reader to its own cell and stops the cross-channel activity leak of BESIDE's per-author list. Private-lane checkpoints stay sealed in-lane (§4.1).

**Card-reference transport.** §5b JSON carries the 1,952-byte key as 2,603 base64 characters. `K_ATT` drops `dsa` and `succ`; verifiers re-expand from the pinned card and run the frozen `bsigner bpq-verify`. The signed message is unchanged, so no label changes: 7,706 B becomes 5,033 B, 34.7% less (ARITH); F8 proves the expansion lossless.

**Window rule.** Close at 1,024 ids, or when the oldest unsettled id is 7 days old; under 4 ids at 7 days, extend to 30 days; close at once before any Tier-S act in the cell. States: Signed, Not yet settled, Settled, Settlement available (not checked), Classical only, Unbound (a covering checkpoint omits it), Unattributable (§10.2).

**Burst model (ASSUMPTION).** Sent mix 60% DM, 35% group, 5% channel; active cells per user-week (DM, group, channel) = (2, 1, 1) at M = 1, (5, 3, 1) at M = 10, (12, 6, 3) at M = 100; ids per checkpoint n = 7·M·share/cells, or 30·M·share/cells when that is below 4.

**Sizes (ARITH).** A 200 B text as kind 9 is 586 B (BESIDE's 590 B used a five-digit kind in its formula). `K_CP(n)` = 590 + ⌈32n·4/3⌉: n = 1 is 633 B, 8 is 932, 64 is 3,321; at most 1,521 ids fit a 64 KiB frame. Settlement per channel message = (`K_CP(n)` + 5,033)/n; a private conversation checkpoint ≈ 7,772 + 57n B (n = 8: 8,228).

| M | n (DM, group, channel) | settlement B per message (DM, group, channel) |
|---|---|---|
| 1 | 9.0, 10.5, 1.5 | 920, 788, 3,792 |
| 10 | 8.4, 8.2, 15.0 | 982, 996, 418 |
| 100 | 35.0, 40.8, 11.7 | 279, 245, 525 |

BESIDE's daily window cost 8,229 B per message at M = 1 (14× the message); here an M = 1 sender-day carries 1.0 KB of settlement against 2.0 KB of messages. A quiet-timer window yields about one message per signature at human rates (scale judge), so no window is under 7 days except Tier-S, per event by design.

**Readers verify lazily before a break.** Display needs only Schnorr until `distrust(secp256k1)`. Readers fetch `K_CP` eagerly (it exposes withheld messages) and `K_ATT` on demand: always for Tier-S and anything acted on, else in the background within §7.5's budget. One message each from 1,000 authors costs 1,000 verifies and 5.0 MB when checked (BESIDE: 8.3 MB eager); in break mode checking is mandatory.

### 3.5 `bzm1` layout (Stage 2, STRATA's, corrected)

| Part | Fields (bytes) | Size |
|---|---|---|
| inner record | `"bzm1"`+version 5, suite 2, kind 2, `author_ref` 32, `seq` 8, `prev` 32, `at` 8, `time_rep` 1, `key_epoch` 4, `body_len` 4, body ≤ 4,096 | 98 + body |
| outer envelope (all a relay sees) | magic+version 5, rotating `mailbox_tag` 32, lease expiry 8, nonce 12, AEAD tag 16 | 73, padded to 512 B buckets |
| seal | magic 5, suite 2, card id + `author_ref` + conversation binding 96, `from_seq`+`to_seq` 16, head 32, `at`+`time_rep` 9, `key_epoch` 4, ML-DSA-65 3,309, Ed25519 64 | 3,537 |

`author_ref` = SHA3-256(`"bzm1/persona"` ‖ bzDiD ‖ `conv_id`): keyed off the DID, unlinkable without the random `conv_id`. `prev` = SHA3-256(`"bzm1/chain"` ‖ previous stored bytes); `msg_id` = SHA3-256(`"bzm1/msg"` ‖ stored bytes); both bind suite, kind, conversation, sequence and **key epoch**. A 200 B text pads to **512 B**, a sealed seal to **4,096 B**: 512 + 4,096/n per message; Tier-S records seal singly (4,608 B). Labels: `bzm1/persona`, `/chain`, `/msg`, `/seal`, `/member`, `/mailbox`, `/archive`, `/evidence`. Both seal halves come from the client library, since bSigner "is ML-DSA by design" (`R/crates/bsigner/CONTRACT.md:58-61`). TLV extensions carry a critical bit.

### 3.6 Compatibility

The 18 agents keep npubs, kinds and origin. buzz-acp gets a **rebuilt harness**: a road list replacing `BUZZ_RELAY_URL` (`BZ/crates/buzz-acp/src/config.rs:240`) and a narrowed `is_terminal_auth_failure` (`relay.rs:3804-3806`), rolled out one agent at a time with rollback. buzz-cli keeps its JSON contract and **HTTP** NIP-98 calls to the real relay (`BZ/crates/buzz-cli/src/client.rs:78-107`; `/query` `:774`; `/events` `:874`; `/media/upload` `:1197`). No websocket facade: the x0x-nostr-bridge is a "NIP-01 subset + NIP-11/16/42/50" leaving the Buzz dialect to an unbuilt "bridge v2" (`UP/bridge-README.md:3`, `:26`).

---

## 4. Confidentiality: pairwise, groups, metadata

### 4.1 Lanes and exact allowed wording

| Lane | Mechanism | Allowed wording (exact) |
|---|---|---|
| Channel | TLS to the relay; relay stores plaintext (N:buzz.md §6) | "Readable by this community's relay and its members. Not end-to-end encrypted." |
| `bnr-private` (bChat v1, built) | NIP-17 + NIP-44 v2 | "Encrypted end to end with NIP-44 v2, sound by construction against the pinned official vectors. Classical: a recording could be opened once secp256k1 is broken." |
| `bnr-pq-private` DM (P5) | kind 1059 from a fresh key (other-key 1059s accepted today, `ingest.rs:2023-2028`); bpq1 object, one X-Wing slot per recipient device plus the archive slot; plaintext = the sender's signed kind-14 event | "Encrypted to the listed devices with X-Wing (ML-KEM-768 + X25519) and AES-256-GCM, sound by construction. Signed by the sender: classical now, post-quantum once a sealed conversation checkpoint covers it. No forward secrecy. The relay sees who is in the conversation and when." |
| `bnr-pq-private` group (P6) | `K_PQG` with `h` tag; one group-key slot | as above, plus "A member who leaves can read until the next rekey." |
| `bzm1` pairwise (P7) | X-Wing handshake inside an individually sealed Tier-S record (authenticated KEM); hash ratchet per epoch; fresh encapsulation every 50 messages or 24 h (ASSUMPTION) | after receipts: "Message contents are encrypted between the two members' devices under a hybrid post-quantum key exchange (X-Wing) and AES-256-GCM, with keys that change every epoch; sound by construction, not audited, not proven end to end." |
| Huddles | server-forwarded, soft cap 25 (`BZ/crates/buzz-relay/src/audio/room.rs:46-49`) | "Not end-to-end encrypted." |
| x0x | unused for people | none; no TreeKEM receipt (`pirate-haul-rulings.md:19`) |

**Sealed conversation checkpoint.** Each window the sender seals in-lane a signed checkpoint event listing SHA3-256 digests of the covered objects, plus a card-reference §5b statement over its id; the key commitment binds `Kf` (`SPEC-BPQ-1.md:150-160`), so digests bind plaintexts. It replaces BESIDE's SEAL (4,597 B of JSON, not 7,191) and keeps the frozen verifier. Sizes (ARITH): P5 DM, 3 slots, 8,352 B, frame cap 29 devices; P6 DM 2,149 B; P6 `K_PQG` 2,049 B (9,376 B if a 101-member group used p-tags).

### 4.2 Groups (P6, METABOLIC's epoch key, delivery cost corrected)

One epoch key per group in the new group slot (48 B wrap, label `bpq1/wrap/group`). On a membership change the changer sends one wrap event **per remaining device**, one X-Wing slot each (2,884 B): O(n), 738 KB at 256 devices; one all-slots object would make every member fetch every slot, O(n²): 0.14 GB at 256, 2.1 GB at 1,000 (ARITH). Rekey within T_rekey = 10 minutes of a leave or ban (mesh-native's rule); until then "a departed member can still read new messages", and sensitive rooms hold sends. No MLS claim ("no IETF wire interop in this release", `UP/adr/0012-treekem-default-secure-groups.md:117-121`). Above 256 devices a group is a channel.

### 4.3 Remote inference

If a bind says `inference:"remote"`, the conversation shows a distinct visible mode ("an AI agent here sends what it reads to its model provider") and withholds end-to-end words: remote modes are "distinct, user-visible, per-session, explicitly-chosen" (`LD/AGENT-1.md:45`); the datacenter sentence "must never ship" (`:30`).

### 4.4 Metadata

| Observer | Sees |
|---|---|
| community relay | pairwise npubs, connection times and IPs, channel plaintext, private-lane participant sets and timing, checkpoint cadence per persona-cell |
| network | TLS endpoints, the road's SNI, sizes, timing |
| nobody, by design | device-to-wallet bindings, the bzDiD, a persona's other communities |
| `bzm1` relay (P7) | connecting IP, byte counts, rotating mailbox tags read; no sender in the envelope |

No unlinkability claim without a TAM slice (N:critic.md §4.5). "Isolated by design: the envelope header names no sender, recipient or identity" is allowed only after the rung-1 header-scan test passes on `bzm1` (planet-scale's gate).

---

## 5. Roads, transport, censorship

**5.1 Charter.** `K_CHARTER`, signed by the owner's npub, attested by the owner's PQ card: `{v:1, seq, label:"skaists.buzz", relay_keys:[NIP-11 self keys], roads, policy:{T_max, T_long, cache_days, late_days, quotas}}` (`self` exists, `BZ/crates/buzz-relay/src/nip11.rs:55-57`). Invites carry the owner's bzpq1 id and roads. Lower `seq` is refused ("anti-rollback state", `R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:38`); "Sources may supply records and bytes, never their own authority" (`:36`).

**5.2 Two relays per community** (planet-scale's keepers, no new protocol). The charter lists ρ ≥ 2 relays in distinct failure domains; the outbox publishes to both; readers read either; gaps are repaired with identical bytes from the other. No relay-to-relay replication is needed (§fractal is "BUILT nowhere", `R/docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:89`). Until E26, "held by 1" is shown.

**5.3 Failover.** Last-known-good road first; transport failure moves on. An AUTH denial from a charter-key relay is terminal (fail closed); from an unverified road it is a transport failure, so a captive portal never stops an agent. Media URLs on charter hosts are rewritten to the active road and accepted only if their SHA-256 matches (`/media/<sha256>` parsing, `BZ/crates/buzz-cli/src/client.rs:275-320`), fixing tonight's broken `skaists.buzz/media` links (`MEM/buzz-relay-building-filter-alias.md`).

**5.4 Ladder.** Diverse SNI names (MEASURED: `relay.skaists.dev` passes the filter that resets `skaists.buzz`, `R/docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:7-11`), alternate ports, obfuscated transport; Veilid off by default (`C:/Users/travi/b-onboard/src/ladder.rs:3-13`). Receipts read "connected via road N, rung M"; all rungs failing gives the named `ONB-G3-04` refusal. "A VPN can never be an onboarding step" (`SPEC-BUZZ-MULTIRELAY-1.md:54`). From P7 a carry rung moves envelopes by file or QR.

**5.5 x0x and the road-policy file** (mesh-native's mechanism). Signed entries `{road, planes, pin}`; adapters refuse unlisted planes (`ROAD_PLANE_FORBIDDEN`); a road counts only after its own runtime receipts ("Nine configured peers are not nine connected peers", `R/docs/specs/SPEC-BTUNGSTEN-1.md:148`). x0x is `planes:[machine]`: UDP-only (N:x0x.md §1), scoped to "one owner with 2–5 machines" (`UP/adr/0095-scope-x0x-is-glue.md:81`), presence on one global topic (`UP/adr/0049-presence-foaf-discovery.md:15`). Phones are never x0x peers.

**5.6 L5 gate and break-mode AUTH.** "Connected" only after four receipts per session per road (`SPEC-BTUNGSTEN-1.md:146-148`): EXPOSURE (the road answered at rung M), IDENTITY (relay `self` key in a charter not below the stored `seq`), PEER (NIP-42 AUTH as a member), AGREEMENT (the relay serves this persona's own latest checkpoint). In break mode the client adds `K_PQAUTH`, a card-reference §5b statement over the AUTH event id; the relay verifies one ML-DSA-65 signature per session against the pinned card (E4).

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**6.1 Outbox journal.** A consumer crate of `bnrose-exec-host` (`buzz-outbox`), per the set pattern (`R/docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:14`, `:83`), reusing `ReplicatedJournal` and `SupervisorKeys`, codes outside `E_*`. Sign, append exact bytes fsynced on every replica, then publish: "durably acknowledged" (`R/docs/specs/SPEC-RUSTEOSVM-1.md:65-71`) only when replicas sit in distinct failure domains the user controls or durably pays for. Today's replicas are two files standing for two hosts (`R/crates/bnrose-exec-host/src/opexec.rs:101-108`), so receipts say "single-domain, not §2.4"; relay copies never count. Day segments per persona, chained by the previous final tag, bound the whole-history reload (`opexec.rs:235-240`).

**6.2 Delivery states** (mesh-native's machine). ADMITTED (signed, journaled), SENT (road r), HELD (OK from ρ charter relays), DELIVERED (a recipient device's signed ack; private lanes only), plus UNKNOWN (never success), LATE-REFUSED (a drift gate refused it) and EXPIRED (past `cache_days` unheld, shown to the sender). Recovery re-delivers **identical bytes only** (`R/docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43`); re-signing would change the id. Hostinger's Postgres durability setting is UNVERIFIED, so HELD means "the relay answered OK" until receipted.

**6.3 The drift gate (tungsten judge's fatal flaw, fixed).** The relay refuses any event more than 900 s from server time, every kind (`BZ/crates/buzz-relay/src/handlers/ingest.rs:2005-2011`), so after a 15-minute outage unsent identical bytes would be refused forever. P2's **late-accept rule**: accept an older event iff an authenticated member whose key equals its `pubkey` sends it (or it is a 1059, with an ephemeral signer) and `created_at` is within the charter's `late_days` (default 7, at most `cache_days`); the future-dated gate stays. Online clients flag "arrived late"; the persona's next timestamped checkpoint bounds backdating claims. A replacement relay is seeded by an operator import accepting only events covered by attested checkpoints, or marking them classical only. Until then late events stay journaled and archived as LATE-REFUSED: never lost, never re-signed.

**6.4 Offline and retention.** Both offline: the community relays hold the message for `cache_days` (default 90, ASSUMPTION) at the community's cost, and the outbox retries identical bytes; no x0x 600 s lifetime applies (N:critic.md §4.1). `until-read` and `ephemeral` messages are never archived; `applyRetain` prunes locally and reports (`R/surfaces/bchat-core.js:131`); RETAIN/FORGET is "publication-consent routing, not deletion" (`R/docs/GLOSSARY-BRIDGE.md:34`).

**6.5 Archive (one consistent flush rule).**
- *Bundle.* Monthly, the user's own view (events sent and received, checkpoints, attestations, binds, charters) as a deterministic `BNRARCV1` batch (`R/crates/bnr-archive/src/batch.rs:1-25`), sealed as a bpq1 object with an archive-persona X-Wing slot (opens from the phrase) and a device self slot; a `rosetta` field names spec, vectors and verifier.
- *Flush.* A month of 256 KiB or more goes to ANT as one file, 3 to 63 chunks, split above (merkle path fenced: "never engage the merkle path (≥64 chunks)", `R/docs/dispatches/RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:42`). A smaller month carries forward until 256 KiB or 12 months, then goes at the minimum. Arweave only once its paid path is receipted (Turbo free tier is "ArDrive's corporate subsidy", `R/docs/storage-substrate-split.md:314`); routing per B1 (`BUZZ_A_METERING_SPEC.md:127`).
- *Payment.* `ant-pay.js`, the user's own wallet, exact-quote approval, `SpendReceipt` in `ChunkCount`; the upload is a BNRoSe op idempotent on the bundle's SHA-256, so "Paid but delivery incomplete" recovers without paying again (`MEM/sovereign-operating-environment-order.md:20`). The browser door to BNRoSe is open work (N:bnrose.md §6), so P4 starts on the desktop.
- *Evidence* (STRATA). SHA-256 **and** SHA3-256 of the sealed bytes, an OTS proof, optionally a BCH root, the AR copy id. Renewal hashes **ciphertext**, so anyone may renew without reading.

| M | MB/yr | month | ANT chunks/yr, monthly | yearly file | AR if receipted |
|---|---|---|---|---|---|
| 1 | 5.8 | 475 KiB | 36 | 3 | $0.18 |
| 10 | 53.4 | 4,342 KiB | 36 | 13 | $1.62 |
| 100 | 437.8 | 35,625 KiB | 108 | 105 in 2 files | $13.27 |

ARITH from the §7 model (channel attestations not archived by default). At the one measured price, 0.0848 ANT ≈ $0.0035 per chunk (`R/docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:91`), monthly files cost $0.126, $0.126, $0.378 per user-year; a live quote of 0.2145 ANT for 4,146 bytes (`MEM/ant-pay-phase-e-lane.md:46`) is 0.0715 ANT per chunk. Amounts are stated in chunks, not fiat (`RULING_B_SPEND_BOUNDARY...:23`). Non-merkle per-transaction gas has no receipt (UNVERIFIED); P4 measures it. The native lane cuts archive bytes by 36% to 56% (3.7, 27.6, 190.7 MB/yr).

---

## 7. Scale

### 7.1 Declared workload model (ASSUMPTION; no ruling gives a messaging rate)

| Input | Value |
|---|---|
| users N | 10^10, all active daily |
| devices per user D | 2 (range 1-4) |
| messages per user-day M | 10 (1 = the ruled floor, 115,741 ops/s, `MEM/sovereign-operating-environment-order.md:23`; 100 high) |
| sent mix | 60% DM (1 recipient), 35% group (6), 5% channel (100) |
| delivered copies | DM 3, group 13, channel 201 (recipients × D plus the sender's other device): mean 16.4; channels are 61.3% of copies |
| relay cache, relays; cells | 90 days; ρ = 2; cells per §3.4 |
| concurrency | 10% of devices connected (range 5-30%) |

### 7.2 Traffic, weighted by delivered copy (ARITH)

| M | classical 428 B/copy | live lane P6 | per copy | native P7 | per copy | ingress P6 / P7 |
|---|---|---|---|---|---|---|
| 1 | 6.5 Gbps | 26.6 Gbps | 1,751 B | 17.2 Gbps | 1,130 B | 2.8 / 1.5 Gbps |
| 10 | 65.0 | 242.6 | 1,598 | 129.0 | 850 | 27.7 / 10.9 |
| 100 | 649.9 | 2,003.1 | 1,319 | 904.8 | 596 | 214.4 / 63.8 |

Formula: Σ_type M·share·copies·bytes × N ÷ 86,400 × 8. The live lane is 3.1× to 4.1× classical per copy, native 1.4× to 2.6×; ρ = 2 doubles ingress. A 10,000-member community at M = 10 sends about 0.24 Mbps on average (0.73 Mbps at 3× peak) and caches 2.70 MB per member over 90 days: text bandwidth is small; connections bind.

### 7.3 No global state

Every object is per persona, cell, community or device. No directory, presence topic, log, room or CRDT spans the population (N:scale.md §3); this design writes no chain bytes (`R/docs/bzdid-architecture-decision.md:61`). The community is the shard; cross-community DMs arrive with the native lane, whose contact cards list mailbox relays.

### 7.4 Connections, boxes, mobile

2e10 connections ÷ 1e5 per box (CLAIMED, `R/docs/specs/LOADMODEL-1M.md:91`) = 200,000 boxes always-on, 20,000 at 10%. Text egress at M = 10 peaks near 0.73 Tbps, about 1,040 U-1G boxes at 0.7 Gbps (`:87-89`), so connections bind. At $101/month (CLAIMED, `:87`): $0.024 per user-year packed (50,000 users a box), $0.121 per member-year at one community a box, $0.242 with ρ = 2; globally $24M to $2.4B a year, community or member paid, never BNR (ARITH). Phones are never x0x peers; they sync in the foreground and by OS background fetch; push is optional (E15). The relay is the meeting point, so phones need no NAT traversal.

### 7.5 Verify-CPU budget and its receipt

Relays verify Schnorr per event and **no** ML-DSA before break mode (one per session after). Post-break, a device verifies one signature per author-cell window it shows as attributed: 3.6, 6.6, 49.7 per device-day on the live lane and 4.4, 9.3, 57.7 native at M = 1, 10, 100 (globally 0.8 to 13.4 million per second over 2e10 devices; ARITH). Budgets, stated now: (a) a 10,000-message backlog in at most 5 s of CPU on the slowest supported phone, so t_v,p95 ≤ 4 ms at n̄ = 8 (2 ms at n̄ = 4); (b) at most 10 s per device-day at M = 100 including a 1,000-author channel, so t_v ≤ 9.5 ms. No estate ML-DSA throughput receipt exists (N:scale.md §5); every CPU line is UNVERIFIED until P0.b.

**P0.b, planet-scale's lane, exactly.** An `rbench` lane in `R/crates/btungsten-bench`: RustCrypto `ml-dsa =0.1.1`, `libcrux-ml-dsa =0.0.11` (`R/crates/btungsten-pq/Cargo.toml:20`, `:25`), noble 0.7.1 in headless Chromium; integritychain `fips204` as separate rows only if E1 is ruled (proofs do not transfer, N:pq-tungsten.md §6). Hosts: a GitHub Linux runner, Hostinger, the Dell under WSL ("Off Unix there is no `wait4`", `R/crates/btungsten-bench/src/measure.rs:25`); a phone only if in scope, else NOT-RUN, never extrapolated. At least 20 runs per cell (`R/crates/btungsten-bench/src/stats.rs:12`). Teeth: a bit-flipped signature must fail and an empty one be refused, or the run is Miswired and red. X-Wing and SLH-DSA beside it. A **workload-calculator crate** reproduces every number in §3.4, §6.5 and §7 as CI tests.

### 7.6 Locality law (planet-scale's ladder)

Rungs: 1 host → 9 (btmd netns rig, "single host, not a mesh result") → 100 (≥ 3 hosts, ≥ 2 networks incl. the filtered building) → 1k → 10k ("no scale claim skips a rung", `LOADMODEL-1M.md:137`) → simulation (MODEL). The probe is one community's relay and one member device; N is the count of other communities. Pass: probe bytes, CPU and connections regressed on log10 N over 100/1k/10k give a 95% CI containing 0 and |slope| ≤ 2% per decade. Teeth: a planted all-community topic or directory must show load growing with N and be convicted. Rungs above 9 need E26.

---

## 8. Economics

### 8.1 Meter table (METABOLIC's discipline)

| Resource | Unit (`R/crates/shared-types/src/spend.rs:62-71`) | Payer of record | Refusal / free path |
|---|---|---|---|
| identity, personas | none, 0 bytes | nobody | free |
| device CPU, storage | own | the user | free (own hardware) |
| relay connection | `RamByte` + `NetByte` per term (interim, E19) | community; member if E3 | session refused; client polls |
| relay bytes | `NetByte`, counted by relay and client | community; member if E3 | `FloorRefusal`; device copies stay |
| relay cache | `StorageByte`, term in rate set (interim) | community; member if E3 | relay declines; sender keeps copy |
| checkpoints, attestations | `StorageByte` | community, within quota | quota refusal |
| archive | `ChunkCount` (+`ChainFee`) via bPay/ant-pay | the user | "archive not funded; your history is on your devices only" (CD-13, `R/docs/feature-backlog.md:305-306`) |
| permanence | `StorageByte`, `Rail::Arweave` | the user | refused until receipted |
| evidence renewal | `StorageByte` | archive owner or renew-only grant | lapses to UNATTRIBUTABLE, never lost |
| agent compute | `VramByteSecond` + `CpuMicrosecond` + `NetByte` (`BUZZ_A_METERING_SPEC.md:49-50`) | owner bzDiD | refusal |
| BNR seeds | fixed per epoch | BNR, allowed standing cost (`CONSTITUTION.md:83`) | named overflow refusal |

Buzz may route payment, never be payer of record; zero balance is "a REFUSAL, not a subsidy ... Never a silent top-up, never a loan" (`BUZZ_A_METERING_SPEC.md:103-112`).

### 8.2 Free tier, honestly

Free: identity; signing, sealing and verifying on one's own device; membership in a community that admits free members; device-held history. Not free: archives (pay or a named refusal), and over-quota use if E3 or E13 is ruled. The free tier exists only where some community funds a relay and admits free members; nothing guarantees that at 10^10.

### 8.3 Spam

Membership is the write gate ("Channel membership is the only gate", N:buzz.md §3); per-member quotas on all kinds; attestations limited (Tier-S per event, else one per persona-cell per hour); wallet-gated per-address quotas, "the caller-pays doctrine ... made mechanical" (`RULING_WALLET_GATED_OPS_2026-08-20.md:61-63`); moderation. Identity is free (N:law-identity-scale.md §5), so the community gate, not postage, is the fence (E13). Device proof-of-work (`R/docs/SPEC_SOVEREIGN_WALLET_FUNDING.md:42`, CLAIMED) is optional friction only.

### 8.4 Settlement (only if E3 or E13 is ruled)

Users buy vouchers ("SURVIVES ONLY where USERS BUY the credits", `R/docs/dispatches/RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:23`); the system issues none (ECON-7). One aggregated `SpendReceipt` per voucher per epoch; the client tally is dispute evidence (ECON-9). Chain load at 10^10: 316.9 top-ups/s yearly, 3,802.6 monthly; split over 1.5 operators per user, 475.3 and 5,703.9, unless one voucher provider fronts many relays, which this plan prefers (ARITH). Relays are paid by bPay to their own address; "BNR is never in the flow of funds" (`R/docs/RULINGS-2026-07-26.md:48`).

### 8.5 Seed budget (METABOLIC's arithmetic, replacing "seed load 0")

Cold-start fetches of a 4 KiB signed hint list at 10^10 users: 2e10/(3 yr × 365) new devices + 1%/day cache loss = 2.183e8 per day (0.894 TB, 82.8 Mbps). BNR caps seeds at 1e7 per day (41.0 GB, 3.79 Mbps). The cap binds at 9.163e8 devices (about 4.58e8 users); beyond it BNR's cost does not grow with N. Overflow joiners get "seed budget exhausted, use an invite or another seed"; invite joins touch no seed; anyone may mirror the list (ARITH).

### 8.6 The ten-billionth-user test

User 10^10 creates a bzDiD (0 BNR cost), joins a community whose members fund its relays (0), signs, checkpoints and verifies on their own device (0), archives with their own wallet or not at all (0); seeds are capped. **Verdict: the arithmetic says the cost does not land on BNR; NOT RUN until A1-ECON-8D and ECON-1 receipts exist.**

### 8.7 Rail C depth check

Monthly archives for 10^10 users at M = 10 are 3.6e11 chunks a year, $1.26B at the one price, about 3.45e5 times today's whole-network node income of "ten dollars a day" (`R/docs/specs/SPEC-VENDING-1.md:56-58`; ARITH). "Market cap is not purchasable supply" (`RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:84-86`) and depth "follows demand WITH LAG" (`:24`), so the price at that demand is unknowable and the design does not depend on it: archiving is optional, devices stay the system of record, and an unfillable swap means "archive waits", never message loss (`BUZZ_A_METERING_SPEC.md:118-127`).

### 8.8 Economic teeth (METABOLIC's battery, same job)

ECON-1: one funder settling two users' operations **must FAIL** (`BUZZ_A_METERING_SPEC.md:107-108`). ECON-2: zero balance gives a named `FloorRefusal`; a planted auto-top-up is red. ECON-4: receipts byte-scanned for plaintext, conversation ids, message hashes. ECON-6: an unfillable swap is refused by name while messaging continues. ECON-7: system-issued per-identity balances = 0; a planted genesis grant is red. ECON-9: a 1% provider over-count is convicted against the client tally. A1-ECON-8D: a 10^2 to 10^5-client simulator keeps the BNR-paid quantity flat past the seed cap; a planted "seed stores a message" path is red.

---

## 9. Moderation and abuse

- Per community, relay-enforced: moderation kinds 9040-9044 and a moderator-only report queue; "reports are signals, never enforcement triggers" (`BZ/crates/buzz-relay/src/handlers/ingest.rs:356-358`).
- No universal reputation score (`CONSTITUTION.md:107`); the kernel is blind, "That observability lives at the social layer or nowhere" (`R/docs/BIND-1.md:108`).
- No platform-safety operator for other communities; BNR answers for its own relays. A ban removes from that relay's cache; device copies and sealed archives persist, and the UI says so. Private groups remove by rekey (§4.2).
- Illegal content on permanent rails is a counsel gate (E12); no public plaintext reaches Arweave or Autonomi.
- Agents never share a context between untrusted text and write authority (`LD/AGENT-1.md:155`); no face or voice comparison, at any gallery size (`LD/BIO-1.md:37`, `:43-44`).

---

## 10. 1,000-year continuity

**10.1 Registry** (STRATA). Append-only signed records `admit(id, family, params, kat_receipt, diff_receipt)`, `prefer(id)`, `retire_new(id, after T, evidence)`, `distrust(id, after T)`; no `redefine` ("New ids are ADDED, never redefined", `R/crates/bsigner/CONTRACT.md:39`). Nothing reaches `prefer` without two independent conforming implementations on shared vectors (the Proof gate, `R/docs/article-vi-s3.md:13`); another implementation of the same FIPS standard gets its own KAT and DIFFERENTIAL rows. Records are signed by the one-press (E10, E23).

**10.2 Validity rule** (STRATA, both formats). `valid(record, t_v)` iff (1) every component signature verifies; (2) the card binds to the persona and bzDiD by a binding valid at signing; (3) every algorithm attribution depends on is active at t_v, or evidence shows the attestation or seal existed before `distrust`, each renewal applied in time. A failed signature or binding is **INVALID**; failing only (3) is **UNATTRIBUTABLE**. Claimed times are never evidence; F6 makes the rule monotone. Settled `legacy-nostr` records depend on ML-DSA-65, SHA-256 and the binding, not secp256k1; a composite seal survives while either half qualifies.

**10.3 Break mode** (fixes "NIP-01 forever"). `distrust(secp256k1, after T)` switches everything: (1) unsettled legacy records become UNATTRIBUTABLE after T, though a living author may still settle ids from their own journal with an unbroken PQ key ("settled after distrust"; forgeries never reach an author's journal); (2) new authorship is `bzm1` only, so P7 must land before any T (D7 tests it); (3) relays require `K_PQAUTH`; (4) every persona closes final legacy checkpoints. Exposure at a surprise break is the unsettled window (up to 30 days in low-rate cells), only for authors who can no longer settle: the stated price of weekly windows.

**10.4 Re-anchoring.** Evidence records (§6.5) also cover genesis ops, binds and handovers, which answers the SHA-256 root (E22c). RFC 4998 renewal: re-stamp before the anchor weakens; re-hash under the successor before the hash retires (`SPEC-BPQ-1.md:120-125`). Renewing 2 KB per user for 10^10 users costs $621,033 per era on Arweave at today's price, $0.00006 each, user-paid (ARITH). Unrenewed archives lapse to UNATTRIBUTABLE, still readable; dead authors are never re-signed for.

**10.5 Formats and the airgapped verifier.** Versioned magic, a frozen decoder per layout, trailing bytes refused (ADR 0085's pattern, N:critic.md §4.9); a reader with the spec "can open and verify every object" (`SPEC-BPQ-1.md:9-10`). Verifier rungs: native `buzz-verify`; a zero-import wasm build (N:bnrose.md §3.1); spec plus Cryptol plus a Daedalus grammar on the RB04 pattern (`R/crates/btungsten-bench/src/lib.rs:11-12`). `buzz-verify` runs under `unshare -n` and strace counts zero `connect()` calls: the A11 property, "someone in 200 years holding an archived CAR with no working gateway must still be able to verify" (`pirate-haul-rulings-2026q3.md:86`). OTS needs Bitcoin headers: 80 B × 144 × 365.25 = 4.21 MB a year (ARITH).

**10.6 Time (L4).**

| Field | Representation | Rule |
|---|---|---|
| Nostr `created_at` | JSON integer seconds | refuse beyond 2^53−1; ±900 s gate except late-accept (§6.3) |
| checkpoint `seq`, `range` | canonical decimal strings | refuse beyond 2^53−1, leading zeros, signs, exponents |
| bChat v1 `ts` | milliseconds | JS `Date` limit 8.64e15 ms |
| `bzm1` `at` | u64 seconds + `time_rep` | about 5.85e11 years; unknown `time_rep` refused |
| `bzm1` `key_epoch` | u32 | conversation re-genesis before 2^32−1 |
| leases, delegations, invites | u64 seconds | an expiry that would cross a boundary refuses to exist: "at 29 days out a 30-day TTL refuses to exist" (`R/scripts/btungsten/README.md:427`) |
| OTS (Bitcoin `nTime`), Vaulta `time_point_sec` (if E3) | u32 | 2106-02-07T06:28:15Z (`SPEC-BTUNGSTEN-1.md:136-142`); renew or expire before it |
| `time_t` in dependencies | i32 | 2038-01-19T03:14:07Z test row |

**10.7 Mixed versions.** Read-all ("new versions must not break existing consumers", `CONSTITUTION.md:92`); write-common (the newest suite every member advertises, never past `retire_new`); named exclusion, never a silent fallback; fork releases carry §3b signatures (`SPEC-BPQ-1.md:127-143`); upstreams pinned and mirrored (`pirate-haul-rulings.md:12`); kernel invariants change only by Art. VI §3.

**10.8 Extinction drills** (STRATA's program; PASS stated before each run, each with a positive control because uniform failure means a broken probe).

| # | Dies | PASS | Control | First |
|---|---|---|---|---|
| D1 | every estate DNS name | flow on charter roads within 5 min; QR invite joins; no acceptance needs the label's DNS | name fails in netns | P2 |
| D2 | every relay | no journaled message lost; a charter-added replacement serves archives and devices | ports refuse | P2 |
| D3 | x0x | human plane unchanged | 0 x0x processes | P2 |
| D4, D5 | Autonomi, Arweave | reads from the other store or devices; uploads refuse by name; evidence checks on BTC headers | client fails | P4 |
| D6 | ML-DSA-65 (forgery from date B) | post-B ML-DSA-only attestations refused; pre-B evidence VALID; personas hand over | verifier ignoring `distrust` convicted | P0 |
| D7 | secp256k1, Ed25519 (Shor) | break mode: unsettled legacy UNATTRIBUTABLE; native authorship; `K_PQAUTH` demanded | as D6 | P0 lab, P7 |
| D8 | SHA-256 | SHA3 renewal in time; lapsed chain refused | lax verifier convicted | P4 |
| D9 | reference client | the bChat JS surface reopens archive plus phrase | non-canonical record refused | P4 |
| D10 | the organization | phrase plus a paper list of bundle addresses verifies offline; a new community starts elsewhere | no BNR endpoint | P4 |
| D11 | clock representation | nothing wraps at 1970, 2038, 2106, 2^53, 2200 | WB004 naive encoder convicted | P0 |
| D12 | Vaulta | messaging unaffected; spend refuses by name | RPC fails | P8 |
| D13 | WebAuthn RP domain, captured | r1 recovers; captor gains no messaging authority | captor origin served | P2, red until E22 |
| D14 | upstream Buzz, x0x | reproducible build from the pinned mirror | upstream 404 | P2 |
| D15 | relay software | a second implementation with the allowlist and import path serves the same settled history; stock relay shows "classical only" | relay without the arms | P2 |
| CT | D1 to D15 in sequence | the airgapped verifier counts VALID, UNATTRIBUTABLE, INVALID, LOST | none | P7 |

---

## 11. Tungsten conformance matrix (receipts to earn; none claimed)

Classes as ruled: TYPECHECK, CHECK-SAMPLED, PROVE-UNIVERSAL, EQUIVALENCE (`SPEC-BTUNGSTEN-1.md:269-275`); KAT, DIFFERENTIAL, INHERITED (`SPEC-BTUNGSTEN-PQ-1.md:32-41`); MEASURED for runs on private infrastructure. Criteria named before any run (`SPEC-BTUNGSTEN-1.md:420-427`); NOT-RUN is never PASS; every gate has a planted flaw in the same job (`SPEC-BTUNGSTEN-PQ-1.md:42-43`).

| Axis / law | Test family | Pass / fail (named now) | Class | Teeth |
|---|---|---|---|---|
| 1 Decentralization | PQB-REMOVE: block every road's DNS, remove the edge, stop BNR's seed, delete the profile, build from the mirror (`R/docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:52-57`) | PASS: from invite material alone a clean client reaches the same community via a replacement relay seeded from archives and devices, reads settled history, posts once. FAIL: any step needs BNR, the original name or profile | MEASURED | a non-charter relay key refused before AUTH |
| 2 Sybil/MiM | PQB-FORGE: an nsec holder (quantum stand-in) publishes events and binds, replays checkpoints across cells, equivocates | PASS: 0 forgeries shown Settled; unendorsed binds never adopted; equivocation shown as evidence. Uniqueness, unlinkability: NOT-RUN (no TAM) | MEASURED + CHECK-SAMPLED | a verifier accepting an unlisted id convicted |
| 3 Healing | PQB-HEAL: kill -9 at every outbox step, corrupt a replica, partition over 15 min, withhold a checkpoint | PASS: 0 duplicates; identical bytes; replica rebuilt; gaps UNKNOWN; outage printed ("autonomous healing cannot be used to conceal unacceptable service interruption", `R/docs/dispatches/2026-10-13-btmd-scale9-study.md:115-117`) | MEASURED | re-sign-on-UNKNOWN worker convicted; relay without late-accept shows LATE-REFUSED |
| 4 Learning | PQB-ROADMEM | learned road choices never leave the charter or lower a suite; logged, reversible | CHECK-SAMPLED | poisoned memory refused |
| 5 >10B | PQB-SCALE: §7 bounds and the §7.6 ladder | per rung: bytes per persona-day within 1.2× of the calculator; §7.5 budgets; locality slope | MEASURED per rung; simulation as MODEL | planted global topic convicted; model fed n = 0 refuses |
| 6 Continuity | D1 to D15, CT | §10.8 | MEASURED + PROVE-UNIVERSAL (F5, F6) | each drill's skip-the-step control fails |
| L1 | D2, D6 to D10, D13 | same bzDiD and same history classification after each extinction | MEASURED | a planted dependency on the original name, key or signer set turns the composite red |
| L2 | PQB-EXPIRY | endorsements over the policy maximum refused; expired shown expired | CHECK-SAMPLED | no-`expires` or 1,000-year endorsement refused |
| L3 | PQB-BOUND | no population-keyed object; community state flat as N grows | MEASURED | planted global roster convicted |
| L4 | PQB-TIME (§10.6) | boundaries refused, never wrapped | PROVE-UNIVERSAL (encoder) + CHECK-SAMPLED | truncating encoder convicted (WB004) |
| L5 | PQB-BOOT (§5.6) | "connected" only after AGREEMENT | MEASURED | a relay never serving the persona's head keeps the UI "not connected" |

**Formal obligations** (WB001 ladder; "No step substitutes for a later one", `SPEC-BTUNGSTEN-1.md:285-295`; deployed language only, `:278-283`): F1 `nip01SerInjective` (strict UTF-8, deployed escapes, no exponents; the bChat "0" marker bug is the RED precedent, N:buzz.md §6); F2 `cpCodecInjective`, n ≤ 1,521; F3 `domainsDisjoint` over `bpq1/` (14, then 15) and `bzm1/` (8); F4 equivocation detector; F5 `bzm1` injective, decode∘encode = identity (SAW), Daedalus grammar equal to the decoder; F6 validity monotone; F7 time encoders fail closed; F8 card-reference expansion lossless; F9 `sealBindsChain`. Teeth: T-VACUOUS (n = 0, empty card set, attestation, seal, registry) and T-TRUNCATE (last byte changed at n ∈ {1, 2, 3, 1,023, 1,024}, at 135-137 and 271-273 for SHA3-256, at 55-56 and 63-65 for SHA-256) (`SPEC-BTUNGSTEN-PQ-1.md:86-113`).

---

## 12. Migration from today's Buzz

1. **M0, anchor now (P0.d, read-only).** Inventory Hostinger's relay image digest, event counts by kind and author, media, the 18 agents' npubs and owners (image UNVERIFIED, N:buzz.md §10). Export read-only, pack a `bnr-archive` batch, take SHA-256 and SHA3-256 roots, OTS-stamp; only the root leaves the box, while BIP-340 holds.
2. **M1, roads (P0.a).** Desktop road lists and media rewrite; rebuilt buzz-acp rolled out one agent at a time with rollback; buzz-cli unchanged against the real relay plus a road-list flag. AUTH, origin and kinds are unchanged, so no agent changes identity.
3. **M2, relay deploy (P2; founder word after a DB snapshot).** Kinds and late-accept; binds by one press per founder device ("a link plus one press", `MEM/founder-one-click-sign-only.md`), agents by harness seed plus an expiring owner endorsement.
4. **M3, retroactive checkpoints.** Humans checkpoint ids from their own export: "attested at T_now, before any break", never "at send time". Agents keep no state (N:buzz.md §3), so their ids are read from the relay, Schnorr re-verified and labelled **observed-attested, pre-break**, never upgraded.
5. **M4, archives.** Estate history to ANT, paid by the consuming account; acceptance is the relay-shutdown drill.
6. **M5, M6.** PQ-private lane (P5, P6), then native (P7). The legacy road retires only on a founder-set date after D2 passes and every member reads `bzm1`; legacy history stays readable; authorship is never rewritten.

---

## 13. Build plan

Seat 1 assigns; owners are suggestions. Every acceptance is a receipt computed from observations; "CI's verdict on the landing commit" is the receipt where CI applies (`R/docs/RULINGS-2026-08-26.md:48-52`).

| Phase | Owner | Reuses | Acceptance (receipts) | Unblocks |
|---|---|---|---|---|
| **P0.a** roads (no ruling) | Buzz fork lane (zCode desktop) | MULTIRELAY §roads, b-onboard rungs 1-2, the live alias | unit tests (roads, failover classes, media SHA-256); building-network drill with `skaists.buzz` reset: desktop and all 18 agents cold-start with **0 manual actions**, per-agent "road 2, rung 1" and time-to-connect | the outage class closed |
| **P0.b** numbers | btungsten lane | btungsten-bench, btungsten-pq | §7.5 lane with teeth; calculator crate | every CPU line |
| **P0.c** specs, vectors | bChat lane + Claude Code seat | SPEC-BCHAT-1, bpq.js, frozen `bsigner bpq-verify` | §pq addendum; CI: JS checkpoints and card-reference attestations verified by bsigner after expansion (DIFFERENTIAL); `bzm1` spec, Cryptol, `no_std` codec, vectors; F1, F2, F5 at RED | P1, P7 |
| **P0.d** anchor now | box seat (Hostinger in scope) | bnr-archive | M0 inventory; manifest digest and `.ots` | pre-break evidence |
| **P0.e** evidence, verifier | Claude Code seat | bnr-archive, bpq-core | `buzz-evidence` (dual hash, OTS parse, offline headers, §10.2) with teeth; `buzz-verify` with 0 `connect()` | D4 to D10 |
| **P0.f** time, algorithm drills | btungsten lane | btungsten-wb004, btungsten-teeth | D11; D6, D7 on lab identities | break mode |
| **P0.g** economics simulator | Claude Code seat | `SpendReceipt`, voucher-escrow (sim only) | ECON-1, 2, 4, 6, 7, 9 and A1-ECON-8D green, planted subsidies convicted in the same job | E3 switch |
| **P0.h** x0x data | x0x lane | the 9-node WSL rig | synthetic machine-plane only: owner-private idle bytes, stream shedding, dial-by-hint | E1 with data |
| **P1** journals, agent checkpoints | ZCode seam + PQ lane | `ReplicatedJournal`, bpq.js helper | 24 h: each journaled id in exactly one checkpoint, OTS-stamped, bsigner-verified; kill -9 per step, 0 duplicates | P2 |
| **P2** relay, charter, L5 (founder word) | Buzz fork lane + box seat | kind arms, late-accept | DB snapshot; PQB-REMOVE; bad key and lower `seq` refused; L5; D1-D3, D13-D15 | DNS independence |
| **P3** devices, ρ = 2 | Buzz fork lane + kc/integrate | desktop bpq.js, wallet press | binds per device; HELD by 2 when E26 allows | §2.4 for humans |
| **P4** archives | ANT pay lane | ant-pay.js, BNRoSe op | rebuilt relay re-verifies 100% of settled checkpoints; ECON-1 FAILS; gas measured | pay-once-now |
| **P5** PQ DMs | bChat lane | X-Wing slots | cross-implementation vectors; sealed checkpoints; remote mode visible; 29-device cap | PQ DMs |
| **P6** groups, readiness | bChat, PQ, fork lanes | group slot, `K_PQG` | 15-label proof; encrypt/decrypt and rekey-on-remove receipts; `K_PQAUTH` (founder word) | 256-device groups; break mode |
| **P7** native `bzm1` | bChat + PQ lanes | P0.c codec | `K_BZM` (founder word); handshake, epoch, header-scan receipts; D7 live; CT | Stage 2 |
| **P8** ruling-gated | per ruling | — | each lands with its ruling: E1, E3, E12-E15, E26 | — |

P0 adds no bsigner command, no chain contract, no spend, and touches no frozen file and no relay.

---

## 14. Open questions and risks

1. **The live lane is heavy:** 3.1× to 4.1× classical bytes per copy (bpq1 JSON inside NIP-01 JSON); native `bzm1` (1.4× to 2.6×) is the fix, gated on P7.
2. **Weekly windows** trade bytes for exposure: up to 30 days of unsettled messages per low-rate cell become UNATTRIBUTABLE at a surprise break for authors who can no longer settle.
3. **Late-accept backdating** is bounded by `late_days` and membership and visible to online clients, but a member can still insert events dated up to 7 days back.
4. **Trust on first use:** pinning precedes any break; post-break newcomers rely on OTS evidence on Bitcoin's u32 time.
5. **No forward secrecy before P7; no PQ confidentiality above 256 devices; channels never end-to-end encrypted;** relays see private-lane participant sets.
6. **Scale is federated, not demonstrated:** about 10^6 communities must fund relays, a market that may not exist; connection ceiling, box and chunk prices are CLAIMED or one-date.
7. **Dependencies:** fork 354 commits behind upstream; no Rust X-Wing sealing (bsigner seals only "self", `SPEC-BPQ-1.md:3-6`); "JS signing is not claimed to be constant-time" (`:270-272`); ml-dsa 0.1.1 unaudited; Hostinger's Postgres durability UNVERIFIED.
8. **Readings** E2, E5, E6, E7 could be ruled the other way; each has a switch. x0x gets the machine plane only unless E1 is ruled.
9. **The identity root** (E22) has three defects this design routes around but cannot fix; until E23 is ruled, no `distrust` record can be signed.

---

## 15. Provenance and corrections

| Finding (judge) | Fix |
|---|---|
| BESIDE: drift gate breaks healing; its relay-replacement row needs stock relays to carry new kinds; NIP-01 record forever (tungsten) | late-accept, LATE-REFUSED (§6.3); D15 allowlist and import; `bzm1` record and break mode (§3.1, §10.3) |
| BESIDE: per-author checkpoint and k = 6 hide reader cost; flush rule vs cost table (scale) | per-cell checkpoints, delivered-copy model, lazy readers, card-reference (§3.4, §7.2); one monthly rule (§6.5) |
| BESIDE: "unchanged" harness, agents' "own export", ungated relay deploy, B1 `:104-105`, R4/Q-5/VENDOR-HELD stretched, report quote (build, law) | rebuilt harness with rollback; observed-attested label (§12); E4; `:105-106`; E6, E7, E15; exact `ingest.rs:356-358` |
| STRATA: `bsigner sign` seals, hidden relay change, ungated retirement, unsealed authority, unauthenticated handshake, lease durable ack, verify ×k, 5 s window, transcripts; `:86`, `:426`, `lib.rs:12-13` (all) | client-library seals, `bzm1/seal`; E4; founder date; Tier-S; sealed handshake; §2.4 on user stores; per-copy verifies; weekly windows; E24; `:87`, `:427`, `:11-12` |
| mesh-native: "PASSED by construction", law-file vehicle, `E_STEP_ADMITTED` cite, saorsa-mls as X-Wing; METABOLIC: "on estate iron" quote, LINK size, tithe tension, sent-weighted averages, O(n²) rekey | NOT RUN (§8.6); E10; dropped; no MLS claim; quote and sizes not grafted; E20; delivered-copy weighting; per-device wraps |
| planet-scale: checkpoint constant, MeshSecond, L3 forwarding, id without epoch, ORIGIN silent, "seed load 0"; buzz-cli is HTTP (build) | not used; E19; E16; `key_epoch`; E9; seed cap (§8.5); no facade (§3.6) |
