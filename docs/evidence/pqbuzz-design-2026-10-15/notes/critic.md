# COMPLETENESS CRITIC: the PQ-Buzz fact-gathering pass

Critic seat. Read-only. No design. I read all eight reader notes: law-constitutional, law-identity-scale, x0x, bnrose, buzz, paystack, pq-tungsten, scale. I then read sources to check what they say, and I filled gaps where a source would answer them.

Path keys:
- R = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`).
- BZ = `C:/Users/travi/buzz-src` (fork checkout `e1035672`).
- X0X = `C:/Users/travi/x0x-pr`. This is a local checkout at **`e0af580`, dated 2026-09-15**. Verified with `git log -1`.
- UP = the scratchpad upstream copies in `pqbuzz/up/`, read at v0.48.0.
- MEM = `C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory`.

Classes:
- RULED: founder or governing text.
- MEASURED: a receipt.
- SOURCE: seen in code or a doc at a pin, with nothing run.
- CLAIMED: asserted, with no receipt.
- UNVERIFIED: not established.

---

## 0. Verdict in five lines

1. The pass is strong on law, PQ status, x0x transport numbers and payment rails. It is weak on how the product behaves: offline delivery, recovery, moderation, spam, metadata, mobile, voice, migration and format durability. **Nobody covered those areas.** Section 4 fills what the sources allow.
2. **Two governing artefacts that decide the message shape were missed:**
   - The kernel's constitutional `CanonicalEvent` already defines `MessageSent` / `MessageEvent` (`R/crates/shared-types/src/events.rs:9-10,212-219`).
   - SPEC-BCHAT-1 is the founder-ordered "messaging/DM/chat stack" (`R/docs/specs/SPEC-BCHAT-1.md:3-6`).

   A PQ Buzz design that ignores either one starts a competing messaging system. MEM `sovereign-operating-environment-order.md:14` forbids that ("start no competing wallet, identity, storage or orchestration system").
3. **Six reader-vs-reader or reader-vs-source contradictions** change numbers or claims a designer would use (§1).
4. Several headline numbers rest on third-party or app-level counters that were labelled MEASURED, or on CLAIMED ceilings (§3). The scale reader's "idle gossip dominates" and "connections bind" conclusions inherit that weakness.
5. Four questions need the founder or counsel, not a design:
   - illegal content on permanent rails;
   - sender-pays spam pricing versus free at point of use;
   - the status of social recovery;
   - the vendor push dependency on iOS.

---

## 1. Contradictions between readers (or between a reader and the source)

**C1. W@tch idle bill class.**
- x0x.md §3 and §7 class W@tch's 142 / 52 MB/min and 75 GB/day as CLAIMED: a third-party receipt whose raw data we do not hold.
- scale.md row 8 classes the same figures as "MEASURED by W@tch".
- The source calls them "Independent embedder (W@tch)" numbers and BNR holds no raw data (`R/docs/dispatches/2026-10-12-btmd-mesh-dependability.md:56-58,70-73`).
- scale.md §2 then builds its 29,380× "idle overhead dominates" multiplier on the 52 MB/min figure.
- **Correct class: CLAIMED (third-party).**

**C2. 86.33 MB/min is not wire bytes.**
- x0x.md §3: it is an app send-attempt counter, "not wire measurements (#590)", per the upstream #622 closing comment.
- scale.md row 9 lists it as MEASURED and drops that caveat.

**C3. x0x deployment facts.**
- law-constitutional §5 says "box runs v0.45.0 and 'Buzz does not use x0x'". It cites `MEM/x0x-open-issue-not-unfixed.md:15`, which also says "there is no Hostinger x0x host".
- x0x.md §6 has a Hostinger x0x **v0.46.0** host with a health receipt dated 2026-10-11 (`R/docs/dispatches/2026-10-03-hostinger-x0x-always-on.md`; `R/docs/dispatches/2026-10-10-agent23-dell-version-alignment.md:29`). The OCI v0.45.0 box has been dark since 2026-10-03.
- That memory note (modified 2026-09-26) is stale on topology. x0x.md §0.5 also showed it is stale on merge flow: `codex/final-acceptance-candidate` returns 404 and fixes merge to main. The MEMORY.md index line still repeats the stale rule.
- "Buzz does not use x0x" still holds (`R/docs/dispatches/2026-10-03-hostinger-x0x-always-on.md:47`).

**C4. x0x identity semantics come from a month-old checkout.**
- law-identity-scale §7.2–§7.4 read X0X at `e0af580`. Its claims are: no rotation, `UserId` is a correlator, `AgentCertificate` "absence of expiry means valid forever", and the second device copies the key.
- Upstream v0.48.0, read by x0x.md, adds expiring delegations ("bounded, expiring authority"), revocable rider tokens, and an A02 test row that "must reject ... an expired certificate". Sources: `UP/README-v0.48.0.md:48,106,113,165-166`; `UP/cons/A02-r01-identity-keys-and-device-enrollment.md:73`.
- G10 in law-identity-scale flags this generally. Its collisions #2, #4 and #10 should be re-read against v0.48.0 before anyone escalates them. The second-device rule survives: "Put the same user key on the new machine ... `--from-seed <HEX>` ... or copy `user.key`" (`UP/README-v0.48.0.md:122`).

**C5. Is b in the Buzz/x0x resource loop?**
- bnrose.md §7 carries these lines without comment:
  - LOADMODEL's forwarding price "p in b per GB" (`R/docs/specs/LOADMODEL-1M.md:116-122`);
  - the hierarchy ruling "running Buzz/meshLLM nodes (provide RAM, earn b)".
- paystack.md and buzz.md carry the Seat-1-approved B1 rule: "b does not appear in the alpha metering path at all" (`R/docs/dispatches/BUZZ_A_METERING_SPEC.md:80-82`).
- The two-loop law says b is "never the commodity layer" (`R/docs/feature-backlog.md:287-296`).
- No reader put these side by side. LOADMODEL is "MODEL DRAFTED — no receipts" (`:4`), so its b-per-GB line is CLAIMED and cannot override B1. The hierarchy ruling is RULED, and it conflicts with B1 for Buzz-node earning. **ESCALATE.**

**C6. When did Autonomi emissions stop?** This bears on the only verified contribute-to-earn rail.
- law-constitutional §5 quotes the hardline: "no ANT minted in ~360 days" as of 2026-08-08, which puts the pause near August 2025 (`R/docs/dispatches/RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:117-119`).
- paystack.md §8 cites "emissions PAUSED Jan 20, 2026" (`R/docs/SPEC-RESOURCE-DASHBOARD-1.md:263,390`). So does `R/docs/receipts/RECEIPT_STORAGE_TCO_2026-08-22.md:66` ("since January 2026 (233M of 240M pool remains)").
- The two dates are about five months apart. Both are CLAIMED.
- Either way, a free user earning ANT by contributing a node is zero-sum (uploader spend only, about $10/day network-wide). The hierarchy amendment calls ANT "the only verified permissionless contribute-to-earn rail" (`R/docs/dispatches/RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:45-47`). That rests on the same zero-sum loop.

**Minor discrepancies (precision, not direction):**
- **Vaulta shortfall.** It is 82.3× max_ram at ~3,446 B/account (`R/docs/RECEIPT_R8_VAULTA_RAM.md:44`) versus 31.5× (`R/docs/SPEC-VAULTA-IDENTITY-1.md:38-46`). The 31.5× figure implies about 1.3 KB per row (my arithmetic: 390.17 GiB ÷ 3.2e8). That is a fourth bytes-per-account figure on top of law-identity's G9 three (2,537 / 2,996 / 3,446). All of them say that 10^10 accounts are impossible.
- **SLH-DSA size.** scale.md §4 says the 49,856 B signature size is "not found in estate code". It is stated in an estate spec, `R/docs/specs/SPEC-BPQ-1.md:196`, which pq-tungsten.md cites. It is not a code constant (grep of `crates/bsigner/src`, `crates/bpq-core/src`: none).
- **Pinned saorsa-pqc version.** x0x's own security doc says the library is "saorsa-pqc (v0.4)" (`UP/security.md`). pq-tungsten.md found 0.5.2 in the in-tree Autonomi lockfile. Which version x0x v0.48.0 actually pins is UNVERIFIED.
- **Stale citation in the bMail raid.** The DM payload law it cites at `surfaces/kandi.html:733-734` is now at `R/surfaces/kandi.html:1084` ("a message is a POINTER, never content").

---

## 2. Governing or load-bearing sources no reader opened

| source | why it matters | what it says (filled here) |
|---|---|---|
| `R/crates/shared-types/src/events.rs` (the constitutional CanonicalEvent; Art. III rule 1, `R/docs/CONSTITUTION.md:65`) | The kernel lingua franca already has a message family | "Message content never rides the bus: `MessageEvent` carries an Autonomi reference to the encrypted payload, not the payload" (`:9-10`). `MessageEvent {message_id, from_did, to_did, content_ref}` (`:212-219`). SOURCE. Envelope fields are `event_id, event_type, timestamp:i64 seconds, source_chain, source_ref, payload, canonicalized_by` (`:41-52`). `SourceChain` has no Nostr or x0x variant (`:17-36`). The struct carries **no version field, no algorithm id and no signature**. Versioning is "by addition, never mutation" on the `#[non_exhaustive]` enums (`:56-57`). `to_did` is singular, so it has no group shape. |
| `R/docs/specs/SPEC-BCHAT-1.md` and `R/docs/dispatches/2026-10-02-bchat-stack-genesis.md` | The founder's order of 2026-10-02 made this "our messaging/DM/chat stack" | Three layers: Core (transport-neutral envelope), Surfaces, Adapters (`SPEC-BCHAT-1.md:37-48`). Three trust lanes: SMS, BNR private (NIP-17 / NIP-44), Autonomi descriptor (`:50-56`). Envelope v1 `{v:1,id,ts,lane,from,body,attachment?,policy:{retain: persistent\|until-read\|ephemeral, forgetAt?},claims?}` (`:65-71`). "BNR identities and keys never derive from phone numbers" (`:58-62`). Status "GENESIS LANDED" (`:3`). RULED order; spec status CLAIMED. |
| `R/docs/GLOSSARY-BRIDGE.md:34` | Deletion and right-to-be-forgotten | RETAIN/FORGET = "**publication-consent routing, not deletion** — no deletion promise exists anywhere". bChat adopts it as the definition of record (`SPEC-BCHAT-1.md:30-35`). |
| `R/docs/article-vi-s3.md` (constitution by reference, `R/docs/CONSTITUTION.md:97`) | Governance of protocol upgrades | Amendments need an RFC, a reference implementation and passing tests before any vote (§3.1). The vote is optimistic and Respect-weighted (OREC-derived, §3.2). A founder/guardian co-sign applies through Epoch 1 (`:70`), and the guardian keys are destroyed on release (`:78`). RULED (ratified 2026-07-11). |
| `R/docs/CONSTITUTION.md:92,98,107` | Upgrades, replaceability, reputation | VI.1: "new versions must not break existing consumers (additive evolution; deprecation windows measured in years)". VI.4: reference implementations are replaceable. VII.2: no "universal reputation score". Communities choose their own `ReputationEngine`. RULED. |
| `R/docs/raids/BMAIL-SORT-2026-09-20.md` | The estate's own raid on human+agent inboxes (XMTP, Mailchain, Push, NIP-17/05/57/61) | See §4.1, §4.4 and §4.5. Raid sort; its rules are CLAIMED unless ruled. |
| `R/docs/BIND-1.md:108` | Moderation | "The kernel is deliberately blind to invalid reality. Spam waves, malformed-record abuse, harassment campaigns ... none of it crosses ... That observability lives at the social layer or nowhere." RULED. |
| `BZ/VISION_MODERATION.md`, `BZ/docs/nips/NIP-IA.md`, `BZ/docs/push-gateway-deployment.md` | Moderation, identity rotation and push in today's Buzz | See §4.3, §4.6 and §4.10. CLAIMED (upstream design text). |
| X0X ADRs in `UP/adr/` that x0x.md did not cite: 0085, 0116, 0035, 0042 (README), A02 | Formats, retention, relay roles, voice, recovery | See §4.2, §4.9 and §4.12. |
| `C:/Users/travi/b-onboard/src/ladder.rs` | The estate's built transport-escalation ladder | See §4.11. SOURCE. |
| `R/docs/joint-liveness-coherence.md:174`; `R/docs/SPEC-ONBOARDING-IDENTITY-1.md:179` | Social recovery | See §4.2. |
| `R/docs/specs/SPEC-BLICENSE-0.md:187-191` | Immutability versus takedown | "An immutable on-chain license pointing at permanent storage cannot be withdrawn ... Named, not solved — counsel question". CLAIMED (spec), but the hazard is named in-tree. |

Still not located (other readers already named these): SPEC_X0X-1.md with the PLANE LAW full text; RELAY_22; the primary text of the 2026-08-29 autonomy ruling; the 2026-10-11 order text outside memory; a standalone TAM document.

---

## 3. Claims without citations and numbers without receipts that a designer would lean on

| number or claim | where used | status |
|---|---|---|
| "100k+ realtime connections" per box | scale.md row 7, which drives the "connections bind before bandwidth" result (200,000 boxes) | CLAIMED (`LOADMODEL-1M.md:91`, which has no receipts). The binding conclusion is no stronger than this one quote. |
| 10K humans + 50K agents per relay; <50 ms p99; 64× bus reduction | buzz.md §2, scale.md row 3 | CLAIMED (upstream VISION / perf). No Buzz relay load test exists in the estate. |
| ML-DSA-65 sign/verify throughput, relay CPU per verified event | nowhere | **No receipt exists** (scale.md §5). Every PQ-Buzz capacity line needs it. |
| x0x MLS ciphersuite and V3 Ref frame size | scale.md §2 | UNVERIFIED |
| Multi-member TreeKEM works | x0x.md §2 | Four sources conflict. BNR holds no P0 receipt, so **no confidentiality claim is allowed** (`R/docs/ledger/pirate-haul-rulings.md:19`). |
| 143 KB vs 148,156 B on-chain footprint | CLAUDE.md, bzdid doc | Same document, two figures (law-identity G9) |
| $600M–$1.2B/yr sponsored cost | law-constitutional §5 | CLAIMED |
| NAT/TURN fraction 20–40% | scale.md row 34 | ASSUMPTION (G-3 BLOCKED) |
| The founder's sovereign-order law list (115,741 ops/s; "WebAuthn alone does not survive losing the original domain"; separate tracks; explicit grant) | used by five readers | Exists only in `MEM/sovereign-operating-environment-order.md:15-27`. The one in-repo pointer is `R/docs/dispatches/2026-10-11-ant-native-signer-convergence.md:3`. One memory file is the single source for these laws. |
| bPay-only law | law-constitutional K21, paystack | Memory plus one dispatch citation. RULINGS-2026-09-16 still calls bPay a PROPOSAL name. |
| "x0x idle bill makes a mobile Leaf impossible" | implied by scale.md §2 | No mobile measurement exists. W@tch is a desktop embedder. |
| SPEC-BPQ-1 §5b asking upstream to carry PQ attestations | pq-tungsten.md §3 | The upstream filing is UNVERIFIED (not recorded in `docs/`). |

---

## 4. Uncovered areas: what the sources say (filled) and what is still missing

### 4.1 Offline and delay-tolerant delivery

**Filled:**
- **x0x DMs expire in 10 minutes.** At X0X `e0af580`:
  - `MAX_ENVELOPE_LIFETIME_MS: u64 = 600_000` and `CLOCK_SKEW_TOLERANCE_MS: u64 = 30_000` (`X0X/src/dm.rs:48,51`);
  - receivers enforce `expires_at <= created_at + 600 s` and reject `created_at > now + 30 s` (`:1363-1366`). SOURCE.
  - Combined with ADR 0006 ("availability = peer liveness"), this means a DM to a recipient who is offline for more than about 10 minutes needs a fresh, re-signed send while the sender is online.
  - Whether v0.48.0 changed these constants is UNVERIFIED.
- **x0x's only durable outbox covers one case.** It holds roster-bootstrap obligations for SignedPublic groups: a 1,024-entry sender-side sidecar, retried until a v2 ACK (`X0X/docs/api-reference.md:1405-1412`).
- Group-delete delivery is "best-effort to online/reachable peers; offline peers are not guaranteed to receive" (`:1265-1266`).
- `DmError::ReceiverBackpressured` says callers may "use a store-and-forward fallback" (`X0X/src/dm.rs:744-745`). x0x does not provide one. SOURCE.
- **Today the only store-and-forward is the Buzz relay itself.** It is the "single source of truth" (`BZ/ARCHITECTURE.md:7`), the component the design is meant to replace.
- **Estate patterns.** The bMail raid takes these rules:
  - "No recipient-side server is ever required to receive a payment or a message" (`R/docs/raids/BMAIL-SORT-2026-09-20.md:227`);
  - "Relay retention is a priced parameter (byte-days) charged to the sender's side" (`:220`, from XMTP XIP-69 "The responsibility for message storage duration lies with the payer");
  - "Expiry is explicit on every inbox event" (`:221`).
  - XMTP's network default is 60-day retention, with a 30-day floor in XIP-69 and a 365-day cap (`:69`). CLAIMED (raid sort).
- SIM-MESHFEST: "delay-tolerant" is the only traffic class a BLE mesh "can plausibly serve" (`R/docs/specs/SIM-MESHFEST-0.md:116`). CLAIMED.

**Still missing:**
- No ruling or design exists for who holds a message while both parties are offline, for how long, or at whose cost.
- Freshness windows (x0x 600 s, NIP-42 ±60 s, replay cache 630 s) are in tension with any delay-tolerant or sneakernet path.
- Tungsten L2 (short-lived intents) applies to authorization. Nothing says whether it applies to message envelopes.

### 4.2 Key loss, recovery and social recovery

**Filled:**
- **bzDiD rotation keys.** The decision doc names `r0` = WebAuthn PRF-derived, `r1` = "the written-code recovery floor", `r2` = an optional second device (`R/docs/bzdid-architecture-decision.md:49-50`). RULED (decision doc).
- **`r0` is bound to a WebAuthn relying-party domain.** The estate keychain RP is `keys.skaists.dev` (`MEM/keychain-isolation-lane.md`). The founder's order says "WebAuthn alone does not survive losing the original domain" (MEM order `:24`). The SNI block on `skaists.buzz` is the live case of a domain becoming unusable on a network.
- **x0x owner-key recovery is OPEN upstream.** A02 (Proposed) says:
  - "A lost-device procedure must distinguish a lost machine key, a lost agent key and a lost owner key";
  - "No recovery procedure can erase data that another device already received";
  - "Choose the owner-key storage and recovery policy" is an open decision (`UP/cons/A02-r01-identity-keys-and-device-enrollment.md:47-51,79`).
  - Keys at rest are not encrypted at the app layer (ADR 0015, per x0x.md).
- **Buzz has no key rotation.** "Humans rotate keys ... David's old messages should remain attributed to David's old pubkey". NIP-IA only archives old keys and "does not transfer authorship" (`BZ/docs/nips/NIP-IA.md:25-27,45`). This collides with Constitution Art. II: "Key rotation must never orphan data" (`R/docs/CONSTITUTION.md:49`).
- **Social recovery: the law book is in tension.**
  - `R/docs/joint-liveness-coherence.md:174`, a document headed "— ruling" whose verdict came from a 7-agent synthesis (`:1-7`), says: "**Every account-recovery path must require the original body.** Social recovery, custodian reset, and admin override each restore transferability". No founder ruling citation was found for it. CLAIMED-as-ruling.
  - `R/docs/SPEC-ONBOARDING-IDENTITY-1.md:179` (DRAFT, `:3`) lists "social recovery" as a future Stage 4.
  - An original-body requirement also has to be read against BIO-1 B-1 and B-2 (`C:/Users/travi/LOVErnment-DAO/specs/BIO-1.md:35-38`).
- **PQ succession exists in Rust only.** It covers the SLH-DSA handover. The log-keeper that refuses a second handover is unowned (pq-tungsten.md §5).
- **Total browser loss is still an OPEN recovery case** (MEM `ant-devnet-acceptance-lane.md`; bnrose.md §6).

**Still missing:**
- No ruling on whether social or threshold recovery is allowed for a messaging identity.
- No recovery path that survives loss of the RP domain.
- No rule for what a recovered identity can read. History encrypted to lost keys is unreadable by design, and nothing states that limit for messages.

### 4.3 Moderation and abuse at scale

**Filled:**
- **Buzz moderation is relay-enforced and operator-backstopped.**
  - "the relay enforces".
  - "**Platform safety** — the severe class: illegal content, network-level abuse, legal reporting obligations. That is never delegated to community admins ... escalation is recorded durably for the platform operator's safety process" (`BZ/VISION_MODERATION.md:5,17`).
  - "Reports are signals, never triggers" (`:39`); "No automod" (`:61`). CLAIMED (upstream).
- **Estate law.**
  - The kernel is blind to spam and harassment; that observability "lives at the social layer or nowhere" (`R/docs/BIND-1.md:108`, RULED).
  - There is no universal reputation score (`R/docs/CONSTITUTION.md:107`, RULED).
  - NIP-IA archive state "MUST NOT" be used as a global blocklist (`BZ/docs/nips/NIP-IA.md:41`).
  - The protocol never detects duress (PERSON-1 P-5, per law-identity-scale).
  - Untrusted text never shares context with write authority (AGENT-1 Q-2, per law-identity-scale). This covers agents reading spam and prompt injection.
- **Permanence versus removal.**
  - "no deletion promise exists anywhere" (`R/docs/GLOSSARY-BRIDGE.md:34`).
  - SPEC-BLICENSE-0 names immutability against takedown and the right to be forgotten as a "counsel question ... before launch" (`:187-191`).
  - Autonomi content is immutable: "do not promise physical erasure" (`R/docs/handoffs/silentpay-v2/baseline/bmeshasi_vnext/RAID-vNext-architecture.md:105`).
- **Bans in E2EE groups are incomplete upstream.** "Full automatic revocation eviction and rekeying remain incomplete" (A09, per x0x.md §2).

**Still missing:**
- No ruling on illegal content (for example CSAM) once it is on Arweave or Autonomi, or gossiped through x0x.
- No ruling on which party, if any, holds Buzz's "platform safety" role once no operator exists.
- No counsel review is recorded.
- Group sizes and moderation authority at 10B users are not modelled.
- **ESCALATE.** This is a counsel and founder gate, not a design choice.

### 4.4 Spam economics

**Filled:**
- "sybil belongs at the identity layer; spam handled by self-paid RAM" (`R/docs/dispatches/RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md:18`). RULED.
- bMail raid: "NIP-17 `:110` wrapper keys defeat pubkey-reputation anti-spam"; "The inbox's spam fence is the meter (a byte-day price) and the invite-gated write ACL, not sender reputation" (`R/docs/raids/BMAIL-SORT-2026-09-20.md:224`). CLAIMED (raid sort).
- Wallet-gated operations: per-address quotas are "the caller-pays doctrine ... made mechanical" (`R/docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:61-63`). RULED.
- Proof-of-work as an alternative to an operator:
  - "Rate-limit with proof-of-work, not an operator" (`R/docs/canonical-biometric-key.md:339`);
  - Particl-style free messages with PoW and size caps (`R/docs/raids/SWAP-SORT-2026-09-02.md:128`);
  - device-side PoW for sybil cost (`R/docs/SPEC_SOVEREIGN_WALLET_FUNDING.md:42`).
  - All CLAIMED.
- Identity carries no cost:
  - T1 passkey "Unlocks nothing";
  - "machine DIDs cost nothing to create, so a machine DID never carries quota" (PERSON-1, per law-identity-scale §1.4 and §5).
  - So the number of free senders is unbounded by construction.
- x0x has no spam bound on subscribed topics: "Inbound to a subscribed leaf is not bounded by design" (btmd flood test, per x0x.md §3). The peer relay limits (10/min per sender) are off by default (ADR 0051 Proposed).

**Still missing:** no ruled spam price or mechanism. **Collision, ESCALATE:**
- "No person pays to *use* a BNR function" (`R/docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`).
- That rule conflicts with sender-pays postage (byte-day pricing).
- It also conflicts with the free tier, where sending costs the sender nothing while relays and recipients bear bandwidth and storage.

### 4.5 Metadata privacy

**Filled:**
- **The x0x DM envelope exposes routing metadata in clear.** At `e0af580`, `DmEnvelope` carries `sender_agent_id`, `sender_machine_id`, `recipient_agent_id` and timestamps outside the ML-KEM seal. It is published on a topic derived as `blake3("x0x/dm/v1/inbox/" || recipient_agent_id)` (`X0X/docs/design/dm-over-gossip.md:49-80,151-163`). SOURCE. Every forwarder can link sender, recipient and time. Whether v0.48.0 changed this is UNVERIFIED.
- Presence beacons to a single global topic (ADR 0049, per x0x.md). `UserId` is a cross-machine correlator by design (law-identity-scale §7.3).
- **The kernel `MessageEvent` carries `from_did` and `to_did` in clear** (`R/crates/shared-types/src/events.rs:212-219`). If bus events are anchored publicly, that is a permanent social graph. It collides with R1: "no permanent mapping between a human identity and any wallet or stored object may appear in public" (`R/docs/RULINGS-2026-09-16.md:26-29`). **ESCALATE.**
- Estate privacy patterns:
  - SPEC-BPQ-1: "Slots carry no reader id, so the public head never names who can read" (pq-tungsten.md §3).
  - Mandatory mixnet transport (Veilid rung 4) for OPRF enrolment (`R/docs/sybil-uniqueness-continuity.md:205`, CLAIMED).
  - Anonymous transport is "NOT a default; documented as the extreme" (`R/docs/dispatches/OPTIONS_PRIVATE_LOOKUP_BOUND_2026-08-08.md:50`).
- Upstream Buzz is server-visible by design: "Server-managed encryption covers every channel ... eDiscovery works on everything" (`BZ/VISION.md:100`).

**Still missing:** no ruling on messaging metadata, meaning who-talks-to-whom, timing and group membership. Unlinkability is a tungsten axis-2 property (`R/docs/specs/SPEC-BTUNGSTEN-1.md:47-50`), and no TAM slice for it exists.

### 4.6 Mobile and push

**Filled:**
- **Buzz push relies on a vendor-operated gateway plus Apple.**
  - `buzz-push-gateway` is "the standalone public APNs last hop intended for `push.buzz.xyz`".
  - It needs an Apple `.p8` provider key and stores APNs tokens in PostgreSQL (`BZ/docs/push-gateway-deployment.md:3,22,35`).
  - There is no Android push (buzz.md §3).
  - CLAIMED / SOURCE.
- **x0x on mobile is in-process embedding only.** "The full daemon API can run in-process inside a host app" (`UP/README-v0.48.0.md:337-339`). Native mobile was listed as future work (`X0X/docs/FUTURE_PATH.md:267`).
- No estate receipt exists for x0x on a phone. The only idle bills are desktop or server figures (§1 C1/C2).
- Applicable law:
  - VENDOR-HELD use must be enhancement-only and degrade to a working page (`R/docs/RULINGS-2026-09-30.md:21-27`, RULED);
  - pay-once-now: "NO direct third-party endpoint calls" (law-constitutional #51);
  - tungsten axis 1: no indispensable corporation.

**Still missing:**
- No ruling on whether APNs/FCM wake-ups are allowed (they would be VENDOR-HELD, enhancement-only).
- No mobile workload or battery budget.
- No answer on how a phone receives while backgrounded without a vendor push or an always-on node someone pays for. That node runs into Art. V.1 standing-cost limits (K9).

### 4.7 Accessibility and language

**Filled:**
- A CI gate exists per the founder's 2026-09-26 order: every target ≥ 44 px, text ≥ 4.5:1 (WCAG 2.2 AA), no text-transform (`R/.github/workflows/tests.yml:1095-1099`). MEASURED (CI).
- A design order sets a "WCAG AA floor on every composited pair, both themes" (`R/docs/dispatches/ORDER_CLAUDE_DESIGN_ESTATE_2026-08-20.md:51`).
- 28 translated tongues with founder priority order (`R/docs/dispatches/2026-09-12-new-bee-raver-experiences.md:36`).
- Honest limit: "This is a naming repair, not full screen-reader or WCAG certification" (`R/docs/dispatches/2026-10-03-heart-wallet-unification.md:125`).
- Buzz lacks per-speaker huddle transcripts (buzz.md §3), which matters for deaf users.

**Still missing:**
- No screen-reader, voice-only, low-literacy or low-bandwidth (2G) requirement for messaging.
- No rule tying the three registers to assistive technology.
- No requirement for text alternatives to huddles. For 10B users this is a scale property, not decoration.

### 4.8 Governance of protocol upgrades

**Filled:**
- Art. VI.1 additive evolution, with deprecation windows "measured in years" (`R/docs/CONSTITUTION.md:92`).
- The Art. VI §3 amendment mechanism (§2 above).
- bsigner: "New ids are ADDED, never redefined, and an old build must refuse them" (pq-tungsten.md §3).
- Tungsten axis 4: learning never silently rewrites invariants.
- x0x self-update over gossip with ML-DSA manifests, which we disable (x0x.md).
- **Upstream x0x governance is one maintainer.** "David gave the ruling in chat; Claude, the controller, applied the status change at David's instruction" (`UP/adr/0116-local-history-retention-policy.md:4`). The 15 consolidated ADRs are Proposed.
- Upstream Buzz is Block's (Apache-2.0).
- A relay upgrade is "RED class: needs founder word, a DB snapshot" (`MEM/buzz-version-gap-and-point-model.md`).

**Still missing:**
- No rule for rolling a wire-version change across a mixed-version mesh of 10B nodes over decades. Who signs releases? What happens to peers that never upgrade?
- No mapping from the Art. VI §3 vote to network-protocol changes, as opposed to kernel invariants.
- The single-maintainer upstream sits against tungsten axis 1 ("no indispensable ... administrator") and the raid doctrine (pin and mirror).

### 4.9 Data formats that last 1,000 years

**Filled:** several message envelopes coexist, and none is ruled the format of record:
- NIP-01 JSON, where the id is a hash over a canonical JSON serialisation;
- x0x `DmEnvelope` (postcard, `X0X/docs/design/dm-over-gossip.md:49-52`);
- bChat envelope v1 (JSON);
- CanonicalEvent (serde JSON, no version or algorithm id);
- WB001 (binary, SAW-proven decoder);
- `bheart.signature/1`.

x0x itself says self-describing encoding "is the right long-term direction" but out of scope. It uses versioned magic and frozen decoders instead (`UP/adr/0085-persisted-binary-formats-are-versioned.md:65-67` and Decision, Accepted).

Timestamps:
- Buzz `created_at` is `u64` seconds (nostr 0.44; `BZ/crates/buzz-core/src/engram.rs:439`).
- x0x is `u64` milliseconds (`X0X/src/dm.rs:270-273`).
- CanonicalEvent is `i64` seconds.
- None of them hits the u32 2106 boundary that tungsten L4 names. This partly fills law-constitutional K19.
- L4 test rows are still owed.

The SPEC-BNROSE-3 epoch format and cold-start verifier are placeholders (bnrose.md §2).

**Still missing:**
- No ruling picks the message format of record or its canonical encoding.
- No airgapped verifier for a message archive. Seat 1 requires that "someone in 200 years ... must still be able to verify" (`R/docs/ledger/pirate-haul-rulings-2026q3.md:86`).
- No re-anchoring rule for message signatures when an algorithm retires. pq-tungsten.md §8 points to the OTS renewal model.

### 4.10 Migrating existing Buzz users and agents

**Filled:**
- The estate runs 18 agents on `skaists.buzz`. Their secp256k1 keys sign NIP-42 for the canonical origin read from `/info` (`MEM/buzz-relay-building-filter-alias.md`).
- buzz-acp treats any AUTH denial not prefixed `error:` as terminal (buzz.md §1). That is a cutover hazard.
- Media URLs are absolute to the relay host and broke on a rename (buzz.md §5).
- Identity bindings that already exist:
  - `PersonaRef::Nostr` exists; there is no x0x variant (law-identity §1.3);
  - Buzz kind 24243 is a "one-time identity binding proof (ephemeral, not stored)" (`BZ/crates/buzz-core/src/kind.rs:80-81`);
  - the SPEC-BPQ-1 §5b ML-DSA attestation over Nostr event ids is a PQ-to-npub bridge;
  - Art. II requires bidirectional links (`R/docs/CONSTITUTION.md:52`).
- Buzz cannot rotate keys (§4.2), so history stays attributed to the old npubs.
- Scope: "my four devices and the hostinger vps" (MEM `founder-no-pr-no-local-server-live-check.md`).
- x0x's second-device rule copies the same user key (`UP/README-v0.48.0.md:122`). That collides with "The bzDiD phrase is never loaded onto a device" (`R/docs/RULINGS-2026-10-04.md:59-66`), if the x0x user key derives from bzDiD. **ESCALATE.**

**Still missing:**
- No plan exists. No inventory exists of the Postgres history on Hostinger, and which relay image runs there is UNVERIFIED.
- Nothing decides whether the old npubs stay readable personas or get archived.
- No order for the agent harness (ACP) or the CLI JSON contract in a migration.

### 4.11 Censorship resistance (SNI and filtering)

**Filled:**
- **The estate has a built four-rung transport ladder:** direct TLS, then alt ports 443/80, then "obfuscated transport", then Veilid (feature-gated, off by default). "connected via rung N, never a green tick that hides a climb" (`C:/Users/travi/b-onboard/src/ladder.rs:3-12,44-64`). SOURCE.
- The raid ledger records obfs4/Snowflake "as standard transport rung" (`R/docs/ledger/pirate-haul-rulings.md:20`). RULED (TAILS pattern loot).
- **x0x cannot climb that ladder.** It is UDP-only, with no TCP/HTTPS fallback (A05 Proposed, per x0x.md §1 and §5).
- How the building's WatchGuard treats UDP/QUIC is unprobed. Whether ant-quic sends an SNI is UNVERIFIED: no ant-quic source is in the local cargo registry, and grep of X0X for `server_name`/`SNI` found nothing.
- The DNS-independence lane is RULED (bnrose.md §5).
- Founder law: "A VPN can never be an onboarding step" (buzz.md §5).

**Still missing:**
- No probe of x0x UDP on the filtered network.
- No TCP or obfuscated rung for x0x.
- No ruling on whether a hostile-network user must reach the x0x mesh, or may go through a bridge.
- The `.buzz` TLD reputation problem is still pending at BrightCloud.

### 4.12 Real-time voice and huddles (not on the critic's list, and uncovered)

**Filled:**
- Buzz huddles are server-forwarded full mesh with a soft cap of 25 and a hard cap of 255 (buzz.md §2), and include agent voice.
- x0x voice is "point-to-point (two-party) calls" behind a `voice` cargo feature, "no CLI or GUI call button yet". Multi-party is "design-bounded at four participants" and an SFU is future work (`UP/README-v0.48.0.md:147`).

**Still missing:**
- Moving huddles to x0x would lose multi-party voice.
- BIO-1 B-4 ("the camera is a window, never an instrument") binds any video room.
- No PQ claim is possible for the media path until its key exchange is identified.

### 4.13 The estate's messaging stack already exists (bChat)

bChat (§2) is the founder-ordered messaging stack. It is a transport-neutral Core with adapters, and NIP-17 / NIP-44 is its private lane. The kernel already defines messages as pointers: `MessageEvent.content_ref` = an Autonomi address.

The scale reader priced the consequence. Per-message Autonomi files cost about $385 per user-year at 100 messages/day, against about $0.11 when batched (scale.md §2). The existing kernel shape implies the expensive per-message granularity unless the batching is ruled.

No reader asked whether "PQ Buzz" means a new transport adapter under bChat Core or a separate system. **ESCALATE**, per the sovereign order's "start no competing ... system".

---

## 5. New collisions surfaced by the fills (escalate by name; not resolved)

- **N1** Kernel `MessageEvent{from_did,to_did}` on a publicly anchored bus vs R1 (no permanent public human↔object mapping).
- **N2** Free access ("No person pays to use") vs sender-pays postage as the spam fence.
- **N3** Social recovery: "must require the original body" (CLAIMED-as-ruling) vs the onboarding draft's future social recovery vs BIO-1 B-1/B-2.
- **N4** Buzz platform-safety escalation needs an operator vs tungsten axis 1 and decentralisation; permanence vs takedown is a counsel gate.
- **N5** APNs push gateway (vendor plus Block host) vs VENDOR-HELD enhancement-only and pay-once-now's no third-party endpoints.
- **N6** x0x second-device key copy vs "bzDiD phrase never loaded onto a device".
- **N7** x0x 600 s DM lifetime and ADR 0006 vs any delay-tolerant or offline-first promise; the only store-and-forward is the relay being replaced.
- **N8** Six coexisting envelope formats vs "The CanonicalEvent schema is the lingua franca" and tungsten axis 6 self-describing data.
- **N9** PQ Buzz vs bChat as the founder-ordered messaging stack ("start no competing ... system").
- **N10** The single-maintainer upstream (x0x) and corporate upstream (Buzz) vs "no indispensable administrator / corporation"; pin and mirror is the only ruled mitigation.

---

## 6. Gaps the critic could not fill (need founder, counsel, a measurement or another reader)

1. A declared messaging workload: messages/user/day, group-size distribution, devices per user, retention default, replication factor. Storage swings 100× on these alone.
2. ML-DSA-65 sign/verify throughput on target hardware, and relay CPU per verified event.
3. x0x v0.48.0 re-read of the DM envelope metadata, the freshness constants, certificate expiry and the MLS ciphersuite. The local checkout is from 2026-09-15.
4. A probe of x0x UDP/QUIC on the WatchGuard network; whether ant-quic sends an SNI.
5. Which relay image runs on Hostinger, and an inventory of its Postgres history (needed for migration).
6. Counsel: illegal content and takedown on Arweave/Autonomi/x0x gossip; GDPR Art. 17 against "no deletion promise".
7. Founder: social-recovery status; the vendor push allowance; whether PQ Buzz is a bChat adapter or a new system; PLANE LAW amendment (K1–K4); front-load (Rail C); bsigner freeze for any new attest kind.
8. A mobile measurement: an in-process x0x on a phone, idle bytes and battery.
9. A TAM document for unlinkability and metadata.
10. Release signing and mixed-version policy for a long-lived mesh.
