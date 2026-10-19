# SPEC-BUZZ-PQ-1 — Beside Now, Strata Next

Status: DRAFT for founder ruling, revised after the attack round, 2026-10-16 (Claude Code seat). Nothing here is ruled, built or run.

This is the synthesis of five design-round drafts after four lens judges (law, buildability, scale, tungsten), then revised against the 70 findings of the attack round (§16). Base: BESIDE (`docs/evidence/pqbuzz-design-2026-10-15/designs/lawful-minimal.md`), the base choice of two judges and the highest summed score. Grafts: STRATA's continuity core (`.../designs/millennium-first.md`), mesh-native COMB's road-policy file, delivery states and per-user inbox (`.../designs/mesh-native.md`), METABOLIC's meters, grants, offer cards and teeth (`.../designs/economics-first.md`), planet-scale COMB's bench lane, locality ladder and Tier-S rule (`.../designs/planet-scale.md`). Judge findings are fixed or named in §15; attack findings in §16.

**Citation keys.** Every citation resolves from the public repo, except that the evidence folder `docs/evidence/pqbuzz-design-2026-10-15/` (notes, designs, calculator) has not landed at `69ef2c717`; until it lands, `.../notes/` and `.../designs/` citations resolve only in the seat's scratch copy:
- repo files are repo-relative paths at `69ef2c717`; a bare `:line` refers to the last file named;
- the Buzz fork is `skaists/buzz@e1035672:<path>:<line>`;
- x0x is `saorsa-labs/x0x@v0.48.0:<path>` (the ADR copies read this round match `docs/adr-archive/` byte for byte); the bridge is `saorsa-labs/x0x-nostr-bridge@03cd47ab50:README.md`;
- LOVErnment-DAO specs are `LOVErnment-DAO/specs/<file>:<line>`;
- design-round drafts are `docs/evidence/pqbuzz-design-2026-10-15/designs/<file>`, written `.../designs/<file>` after first use; reader notes are `docs/evidence/pqbuzz-design-2026-10-15/notes/<file>`, written `.../notes/<file>` after first use;
- the arithmetic is Appendix A, to land as `docs/evidence/pqbuzz-design-2026-10-15/calc-s7.js`;
- "seat memory, not in repo" marks a fact recorded only in the seat's memory; its evidence class is RECORDED-IN-MEMORY.

**Evidence classes for citations:** RULED, MEASURED (someone ran it and holds the receipt), SOURCE (read in code at the pin, nothing run), CLAIMED, UNVERIFIED, ASSUMPTION, ARITH (computed by Appendix A from stated inputs; every number in §3.4, §4, §6.5, §7, §8 and §10.4 is one), READING (a rule applied beyond its written scope; always escalated), RECORDED-IN-MEMORY (seat memory only; never treated as RULED). The tungsten result classes in §11 are separate.

---

## For the founder

**What this is.** A plan to move Buzz, step by step, onto signatures and encryption built to resist quantum computers; to keep it reachable when a building blocks one web address; and to meter every resource it uses so that whoever uses it pays. Today's Buzz keeps running. Each message keeps its normal signature. Once a day each person lists what they sent in each conversation, and once a week a quantum-safe signature vouches for that list, so it stays affordable. For real people that weekly signature waits for your answer to decision 5; until then it runs only on test identities, and the daily lists are timestamped instead. A new message format that is quantum-safe from the start is built and tested in the lab now and switched on later. Saved history stays on your own devices first; permanent storage is optional and paid by its owner. Nothing here is ruled, built or tested yet.

**What happens first, with no ruling needed:**

1. Every app and every agent gets a list of relay addresses, so a blocked name becomes one dead road instead of an outage, and an agent no longer stops for good on a refusal it cannot check. This closes the 2026-10-15 failure once its drill passes; until then it is a plan.
2. We take a fingerprint of all of today's Buzz history and timestamp it now, while today's signatures still hold.
3. We measure how fast phones and servers check the new signatures. A phone is part of the test; without it, nothing is claimed for phones. We build and test the long-term message format in the lab.
4. We run the money simulator that must show BNR's costs stay flat as users grow, with planted cheats it must catch.

**What we will never claim:** that Buzz is "tungsten certified" (this plan names the tests it must pass); that a conversation is private when it is not; that quantum-safe encryption hides who talks to whom (it does not); that a deleted message is gone from everyone's devices; or anything a test has not yet shown.

**What the review changed, in one breath:** the first stage is lawful only in its cautious options; a stolen phone or key now has a designed limit and an alarm, not yet tested; private messages no longer carry a copy that anyone holding your recovery phrase could open; each person may name a replaceable inbox; agents, large channels and payments are now counted honestly; and at ten billion users, permanent archives do not fit today's storage market, so devices stay the record.

**Decisions only you can make, one line each:**

1. Should messages between people ever travel over x0x, as an optional road that carries only sealed bytes, or does x0x stay for machines only?
2. May we update the relay on the Hostinger box, after a database snapshot, so it accepts the new message types, keeps late deliveries in a separate table, signs a proof of its identity and signs its refusals?
3. Who pays for always-on community relays: each community's operator, its members, or BNR; and should BNR's own community have a fixed size with a "this community is full" refusal?
4. May an agent's host machine hold that agent's quantum-safe key, or should the owner's device vouch for agents instead (the default here)?
5. Does your Safe 7 ruling (each device has its own key and the recovery phrase never goes onto a device) cover every phone, laptop and agent host?
6. Does the rule that agent authority expires unless a human renews it cover every agent or only bQueenBee, and how often should renewal be?
7. May bSigner gain the command that signs Buzz message fingerprints, or must that signing stay outside it?
8. Must skaists.buzz stay the community's identity (the default here, with the signed charter as a second check), or may the charter become the identity with the name kept as its label?
9. May a stranger be asked to pay a small storage and bandwidth cost to reach someone's inbox, or must a first message always be free?
10. One ruling text says every account recovery must require the original body; the ledger records trusted friends (three of five) as covering users. Which applies to messaging accounts?
11. May Apple and Google push wake-ups be used as an optional extra?
12. Should the 10 percent tithe apply to relay costs, or only to the Claude agents lane?
13. Will you rule on three fixes to the identity root: a recovery key that survives quantum computers, the written recovery code outranking the passkey, and a newer hash for the root itself?
14. Should the road list and the list of retired algorithms be law files signed with your one press?
15. Who may declare an algorithm broken, which switches every app into quantum break mode, and with how much notice: you alone, a named group of stewards, or an automatic trigger when someone publicly breaks a planted test key? Until you rule, no such record can be signed.
16. May we run a second relay host outside Hostinger, so every message is held in two places?
17. Are speech transcripts made on the speaker's own device allowed under BIO-1?
18. Will counsel review illegal content on permanent storage before any public archive exists?
19. Forward secrecy means deleting old message keys after a few weeks, while the Constitution says key rotation must never orphan data. May a device that was offline longer than that window be unable to open older messages until the sender resends them?
20. Does the relay's existing signed login count as the "logged-in wallet" for writing to BNR's relays, or must writes there sit behind a separate wallet session?
21. Who are the stewards who can recover BNR's community charter if its owner key is lost?
22. Until a second, different family of quantum-safe encryption is approved, should saved history stay on your own devices only (the default here), or may it go to permanent storage with the warning that a future break of today's family could open it?
23. May tests run on our own machines, outside CI, count as a named "run receipt" result class in the tungsten standard?

---

## Review conditions (the outside architecture review)

The founder supplied an outside review with six acceptance conditions. This table says where the spec meets each, or names the gap. The review's warning is adopted as written: post-quantum encryption does not give post-quantum metadata privacy, anonymity or Sybil resistance, so those are separate measured properties here (§4.6, §8.3). Its plane recommendation is the default: PLANE LAW stands, x0x is an optional machine-plane transport adapter that is never storage or a mandatory dependency (§5.5, E1, E1b), and SPEC-BCHAT-1 is the protocol authority (§3.1, E27).

| Condition | Where the spec meets it | Gap, stated honestly |
|---|---|---|
| 1. PQ security: hybrid establishment during migration, authenticated identity binding, forward secrecy, post-compromise recovery | X-Wing (ML-KEM-768 + X25519) for content (§4.1); per-road receipts of the negotiated TLS group, X25519MLKEM768 recorded as hybrid (§5.7); K_BIND with rank rules, OTS-stamped Ed25519 binding (§2.2); weekly OS-RNG prekeys (§4.2); a two-sided KEM ratchet in the native lane (§4.1); FS-1, PCS-1 (§11) | No forward-secrecy or post-compromise claim until FS-1 and PCS-1 pass; healing needs the compromised card retired (§4.2); the PQ-private lane is lab-only until E2, and real human PQ cards and attestations wait for E6 (lab identities until then); channels are never end-to-end; Stage 1 authorship is classical until settled; some censorship rungs may be classical transport |
| 2. Ten-billion arithmetic: concurrency, message rates, fan-out, device churn, bandwidth, storage, replication, payment overhead; registrations never confused with active users | §7.1 to §7.8 and Appendix A: humans and agents, concurrency 5 to 30%, channel-size distribution and crossover, churn, replication ρ, archive payments and top-ups (§6.5, §8.4) | Every input is ASSUMPTION; box connection capacity is UNVERIFIED (P0.b); no rung above 9 has run (E26) |
| 3. Mobile: phones as light clients, replaceable independent inbox services, no mandatory x0x mesh | Per-user inbox under its own key, replaced by one bind update (§2.4); one connection per phone (§7.4); phones never x0x peers (§5.5); PQB-MOBILE, D16, D17 | No phone measurement exists; inbox multiplexing needs a relay arm (E4); push is vendor-held (E15) |
| 4. Sovereign economics: meter actual consumption, cap authorized spending, competing operators, independently auditable failed deliveries and refunds without contents | Unconditional metering with zero-charge receipts (§8.1); signer-enforced grants with ceilings (§8.1); offer cards, two operators per charter, no provider preference (§8.4); relay-signed delivery states, refunds as linked negative items, ECON-R (§8.9) | E3 is unruled; signed delivery states need a relay arm (E4); 10^10 permanent archives are infeasible on today's rails (§8.7) |
| 5. Millennial continuity: tested replacement paths for every algorithm, identity binding, storage provider, transport and settlement adapter; no indispensable operator, vendor or primitive | Registry, card v2 with cross-family handover, second signer and KEM families, second anchor family, steward sets (§10.1, §10.4); drills D1 to D29 and CT with cadence and positive controls (§10.8) | L1 is RED by construction until E22 and E23; second families are not yet admitted; no drill has run |
| 6. Adversarial assurance: malicious inbox operators, metadata correlation, Sybil swarms, partitions, replay, downgrade, key compromise, exhausted balances | PQB-WITHHOLD and PQB-FAKEACK (malicious relays and inboxes), PQB-LINK M1 to M3, A2-SYBIL, PQB-HEAL with 8- and 30-day partitions, PQB-REPLAY-1059, PQB-DOWNGRADE, PQB-DEVTHEFT, PQB-NPUB-THEFT, PQB-ROOT-THEFT, ECON-DRAIN (§11) | No published TAM; uniqueness NOT-RUN; every family NOT-RUN |

---

## 0. Thesis and name

**Beside Now, Strata Next**: two stages, one record grammar.

**Stage 1, Beside (P0 to P6).** Stage 1 is lawful under current rulings only in its conservative branches: E2, E3, E5, E6 and E9 need rulings, and each defaults to its conservative or unbuilt branch (§1.2). Buzz stays the human plane on its real relay, byte for byte, as PLANE LAW and "own the relay" record it (`docs/ledger/pirate-haul-rulings.md:18`, `:51`). Each device journals the exact bytes it signs. Every event carries a per-device chain tag, designed so that a forged or withheld message shows up on the next post of the device whose chain it touches (PQB-FORGE tests it, with a two-honest-devices control, §3.4). Each posting day a persona publishes a checkpoint of the ids it signed in each cell, and at most once a week (at once for Tier-S acts) it attests the newest checkpoint with the already-built SPEC-BPQ-1 §5b statement (`docs/specs/SPEC-BPQ-1.md:211-227`): no new label, no new cryptography. Under the E6 default real human personas hold no PQ card, so until E6 is ruled their checkpoints are journaled and OTS-stamped only, the weekly attestation runs on lab identities, and the 8-day bound below applies to lab identities alone.

Weekly attestation has a price, stated here. Before a quantum break, readers check ordinary messages by Schnorr alone, and the nsec sits on hosts (`skaists/buzz@e1035672:crates/buzz-acp/src/config.rs:243-244`). So a thief holding a stolen nsec can sign events that look valid. The per-device chain tag exposes the resulting fork on the next post of the device whose chain it touches; the author's own device treats an event carrying its own index that it never signed as local break evidence (suspect mode, §10.3); an online device's unattested window is at most 8 days (§3.4). Settlement is evidence for after the break. A living author can settle late from their own journal; after a distrust record that settlement shows SETTLED-LATE, because its time is unproven (§10.2).

Confidentiality is an additive bChat Core lane of existing bpq1 sealed objects (`docs/specs/SPEC-BPQ-1.md:150-188`), sealed to weekly random prekeys and never to a key the recovery phrase derives (§4.2). A road list pinned by a post-quantum-attested community charter ends the dependence on one DNS name for reaching the relay; the name stays the community's identity string unless E9 is ruled otherwise.

**Stage 2, Strata (P7; lab work from P0, live after founder word).** One binary format of record, `bzm1`, proposed as bChat Core envelope v2: per-sender hash chains, composite ML-DSA-65 plus Ed25519 seals that bind the suite and every field, a two-sided KEM ratchet, rotating mailbox envelopes, an append-only algorithm registry, a three-state validity rule, dual-hash evidence renewed over ciphertext, an airgapped verifier. Once the registry records `distrust(secp256k1)`, break mode first uses an interim lane in which every new event carries its own attestation (§10.3); `bzm1` is the cheaper lane that replaces it at P7, not the only one.

The claim, word for word: **"Classical now; post-quantum settled by checkpoint; native post-quantum records next. No end-to-end claim on channels, no forward-secrecy or post-compromise claim before FS-1 and PCS-1 pass, and no metadata-privacy claim."** The design names receipts and claims none (`docs/dispatches/2026-10-06-btungsten-lane.md:45-47`; "A property with no receipt is a hypothesis, not a result", `docs/specs/SPEC-BTUNGSTEN-1.md:37`).

---

## 1. Plane mapping and escalations

### 1.1 Plane mapping (`docs/ledger/pirate-haul-rulings.md:18`)

| Plane | Carries | Never |
|---|---|---|
| Human (Buzz) | channels, DMs, the PQ-private lane, binds, cards, prekeys, checkpoints, attestations, charters, grants; per-user inboxes (§2.4); from P7 `bzm1` mailbox envelopes | system of record (`:17`; "The VPS is cache/bootstrap, never a system of record", `docs/SPEC-PAY-ONCE-NOW-1.md:67`) |
| Machine (x0x) | agent traffic as already ruled, as an optional transport adapter; its road-policy entry is `planes:[machine]` (§5.5) | human-plane frames unless E1b is ruled; storage (X-1); liveness needed for data (X-3); phones |
| Durable (Autonomi) | sealed archive files of at least 3 full chunks (§6.5), uploaded only under the two-family wrap rule or with the stated lattice-break warning, admitted only within measured depth (§8.7) | the only copy |
| Permanence (Arweave) | epoch evidence roots (§10.4); small bundles once a paid path is receipted, under the same wrap rule | private plaintext |
| Settlement (via bPay) | aggregated voucher top-ups and archive payments; never per message | per-user chain rows (`docs/bzdid-architecture-decision.md:61`) |

The record is the exact signed bytes in journals and archives (§6). The relay is cache, fan-out, membership gate, moderation and bootstrap. BNRoSe leg (`docs/SPEC-BNROSE-0-CHARTER.md:36-39`): messaging fits none ("Don't bend a taxonomy", `docs/dispatches/RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md:65`). This kernel and bChat adapter document **consumes** L2 (journal) and L1 (archives).

### 1.2 Escalations (named, not resolved; each has a switch)

"If a proposal collides with any of the above: ESCALATE by name. Do not resolve it." (the seat's standing instructions, not in repo). Every row marked READING defaults to its conservative or unbuilt branch.

| # | Collision | Cited rule | Without a ruling | If ruled otherwise |
|---|---|---|---|---|
| E1 | Human plane over x0x | PLANE LAW, X-1, X-3 (`docs/ledger/pirate-haul-rulings.md:18`); "anything held only in x0x must anchor ... or it does not survive" (`docs/ledger/pirate-haul-rulings-2026q3.md:27`). Status: RULED-as-recorded, a ledger summary of a drafted SPEC_X0X-1 whose text has not been located (`docs/evidence/pqbuzz-design-2026-10-15/notes/critic.md:102`) | x0x carries no human frame; adapters refuse with `ROAD_PLANE_FORBIDDEN` | see E1b. Seat 1 is asked to locate or re-land SPEC_X0X-1 |
| E1b | The review's reading: bChat over an optional x0x adapter that carries only opaque ciphertext | READING. For it: the x0x ruling's own order text, "... AND BUZZ" (`pirate-haul-rulings.md:18`); "BUILD fan-out on the Nostr/Buzz + x0x rails" (`docs/specs/LOADMODEL-1M.md:92`). Against it: "signaling/membership rides Buzz signed events (human plane, per the x0x ruling's PLANE LAW)" (`:50`); SPEC-BCHAT-1's adapters name no x0x road (`docs/specs/SPEC-BCHAT-1.md:45-48`) | as E1 | A dated `docs/RULINGS-*.md` entry, governed through `docs/PQ-LAW.json`, lands before any road-policy re-sign adds `human` to an x0x entry. Then: desktop and server only, opaque bpq1 ciphertext only, never phones or storage. Still needed: a TCP rung (x0x is UDP only), the unreleased store fix saorsa-gossip #115 (`.../notes/x0x.md:105`), history OFF since ADR 0023 stores MLS plaintext (`saorsa-labs/x0x@v0.48.0:docs/adr-archive/0023-durable-local-history.md:91`), P0.h data |
| E2 | Encrypted lanes, outbox | Buzz "NEVER a storage/permanence/privacy/settlement layer" (`pirate-haul-rulings.md:17`) | READING: privacy belongs to bChat Core's BNR-private lane (`docs/specs/SPEC-BCHAT-1.md:55`); the relay carries opaque bytes. Default: the PQ-private lane (P5, P6) runs in the lab only until ruled | The lane ships on Buzz relays, or moves to another NIP-01 road |
| E3 | Who pays the relay | READING. Art. V.1: standing costs are seeds and spec only (`docs/CONSTITUTION.md:83`), against B1 rule 2, "Buzz's own A pays for Buzz's own resources only — its relay" (`docs/dispatches/BUZZ_A_METERING_SPEC.md:105`), a derived deliverable ("Every rule below is DERIVED", `:3-4`) | Metering is unconditional with zero-charge receipts (§8.1). Each relay's payer of record is a named operator account. BNR runs its own community relay at a fixed per-epoch capacity with the named refusal "this community is full; join or start another" (§8.6); other communities fund theirs. §8.6 passes only if E3 is ruled member-pays | Member pays through vouchers (§8.4); `FloorRefusal` at zero |
| E4 | Relay changes are RED class | "Relay upgrade is RED class: needs founder word, a DB snapshot" (seat memory, not in repo) | P0 and P1 touch no relay; checkpoints stay journaled and timestamped off-relay | P2 deploys the kind arms (unknown kinds are rejected, `skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:344-346`), the late table (§6.3), relay identity proofs and signed refusals (§5.6), grant-scoped reads (§2.4); later arms by separate word |
| E4a | Carriage kinds against the named upstream route | Relay carriage of the §5b statement "is the upstream ask to block/buzz" (`docs/specs/SPEC-BPQ-1.md:224-226`); its filing is UNVERIFIED (`.../notes/pq-tungsten.md:94`) | Kinds stay fork-local and provisional; the ask is filed; P0.i records a grep of upstream main at a fetched sha for every provisional kind before P2 | Upstream assigns the kinds; the fork follows |
| E5 | Agent PQ key custody | "no agent holds/requests/transmits private key material" stands (`docs/dispatches/2026-09-21-bdata-add-to-manifest-and-pay-plan.md:16`); the harness host already holds the agent's nsec (`skaists/buzz@e1035672:crates/buzz-acp/src/config.rs:243-244`) | No agent PQ key. Agent ids and checkpoints are attested by the owner's device and labelled observed-attested (§2.3, §12 M3) | READING: the harness host, never the model, holds a host seed. Then: wording "post-quantum signed by the agent's host; a compromise of that host compromises both signatures"; the owner endorsement is attested by the recovery card; owner co-attestation of agent Tier-S acts; the host-incident drill D28 |
| E6 | R4 for every device | R4 rules the hardware signer (`docs/specs/SPEC-BPQ-1.md:280-281`; `docs/RULINGS-2026-10-04.md:59-66`) | READING: every device derives PQ keys from its own seed, the safer custody branch. Device personas for real users wait for the ruling (P3 is gated on E6); R4 on Safe 7 is unchanged. Until then human checkpoints are journaled and OTS-stamped, and PQ attestation runs on lab identities only | Trusted devices may derive from the wallet root |
| E7 | Q-5 for every agent | Q-5 is bQueenBee's: "Her app password requires a human heartbeat" (`LOVErnment-DAO/specs/AGENT-1.md:168-169`); "remove me from gating" and grants need "duration and limits" (seat memory, not in repo) | READING: every agent endorsement and grant expires; renewal is one press per founder-set interval | Longer intervals for other agents; an expiry stays |
| E8 | bSigner freeze, signer name | `bpq-attest-nostr` is outside the frozen table (`crates/bsigner/CONTRACT.md:14-24`); "a seat may not decide which" (`docs/dispatches/2026-10-09-pq-status-verification.md:274-283`); "THE signer name" (`crates/bsigner/CONTRACT.md:49`); no library target (SOURCE) | JS twin `BPQ.attestNostr` (`surfaces/bpq.js:334`) in a Node helper, once per checkpoint; frozen `bsigner bpq-verify` (`crates/bsigner/CONTRACT.md:23`, `crates/bsigner/src/main.rs:664-665`) verifies | bSigner gains a library or device-seed path; buzz-acp signs in Rust |
| E9 | Community identity and the DNS name | READING. The ORIGIN RULING, "don't touch it until you know which it is" (`docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:72`), "IT IS IDENTITY, LOAD-BEARING" (`:83`), and its own split, "`push.origin` = identity string (stays), the join URL = connection string (client's choice of road)" (`:90-91`); against "cryptographic authority determines what the system accepts" (`docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:90-91`) | The identity string stays `skaists.buzz` byte for byte. The charter is a second verifier that must agree with it: a mismatch refuses; DNS loss alone does not, since roads are the client's choice | (Decision 8) the charter becomes the acceptance authority, with the name kept as its label |
| E10 | New law files | CI governs files named in `docs/PQ-LAW.json` (`docs/specs/SPEC-BPQ-1.md:135-142`); adding one is a governance change | Road policy and registry are signed by the one press (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:671-672`) but not listed | Listed; a stale signature turns CI red |
| E11 | Kernel `MessageEvent{from_did,to_did}` | R1 (`docs/RULINGS-2026-09-16.md:26-29`); `crates/shared-types/src/events.rs:210-218` | Local bus only; never anchored | Archives may include it |
| E12 | Plaintext on permanent rails | "no deletion promise exists anywhere" (`docs/GLOSSARY-BRIDGE.md:34`); counsel (`docs/specs/SPEC-BLICENSE-0.md:187-191`) | Sealed archives only | Public archives after counsel |
| E13 | Spam postage against free access | "No person pays to *use* a BNR function ... **Two transactions, two layers.**" (`docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11`) | Recipient policy: write ACL, then introduction, then capped proof of work (§8.3); membership and per-npub quotas (E28); moderation | Stranger postage: inbox byte-days and over-quota `NetByte` purchasable at the commodity rate; offers have no recipient-premium field, so attention prices are unexpressible |
| E14 | Social recovery | "Every account-recovery path must require the original body" (`docs/joint-liveness-coherence.md:174`; a 7-agent synthesis whose scope is the personhood resale floor, `:1-7`; CLAIMED-as-ruling), against the ledger's trustee tier: 3-of-5 owner authority (`docs/ledger/pirate-haul-rulings-2026q3.md:43-45`) and "Trustee-tier users are covered regardless, because trustees hold owner authority" (`:73`). Read literally, `:174` would also bar recovery rungs 2 and 3 (§2.6) | Not offered, pending ruling | Threshold recovery card |
| E15 | Vendor push | VENDOR-HELD defines "A browser-resident feature" (`docs/RULINGS-2026-09-30.md:23-28`), applied **by analogy** | Today's content-free iOS push is optional; the user's inbox sends the wake (§2.4); a gateway is replaceable by one signed road-policy entry; every delivery gate passes with push off | Allowed as enhancement, or poll only |
| E16 | b in the Buzz loop | "earn b" (`.../notes/law-constitutional.md:72`) against "b does not appear in the alpha metering path" (`docs/dispatches/BUZZ_A_METERING_SPEC.md:81-82`) | A only | b as a separate line by ruling |
| E17 | Per-identity float | "FOUNDER QUESTION IN FLIGHT — DO NOT BUILD AGAINST EITHER READING" (`docs/dispatches/RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:88`, `:100`) | The design neither requires nor forbids a funded wallet, and no code path depends on either. ECON-7 counts system-issued resource-token balances only | Any gas float follows the Rail C ruling |
| E18 | Binding visibility; rosters | Art. II bidirectional links (`docs/CONSTITUTION.md:52`) against R1; P-10 (`LOVErnment-DAO/specs/PERSON-1.md:117`) | Pairwise per community, never anchored; Buzz's per-community membership; no global roster | Binds move into the PQ-private lane |
| E19 | Missing meter units; frozen field | "Adding a unit requires a ruling" (`docs/dispatches/BUZZ_A_METERING_SPEC.md:53`); `spender_bdid` FROZEN (`crates/shared-types/src/spend.rs:151-154`) | Interim: retention = `StorageByte` with the term in the rate set; a connection or inbox lease = `RamByte` + `NetByte` per term; providers key by wallet session, "not bzDiD" (`docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:56-58`) | New units with a `SCHEMA_VERSION` bump (`crates/shared-types/src/spend.rs:38-39`); the spec owner rules on a pairwise `spender_bdid` |
| E20 | Tithe scope | voucher-escrow writes `tithe.founder` on every charge (`crates/voucher-escrow/src/lib.rs:9`, `:586-592`); the tithe is ruled for the Claude lane (`docs/dispatches/LANE_M_B_METER_2026-08-29.md:5`) | No relay tithe; third-party relays use `SpendReceipt` only; voucher-escrow only in the simulator and ruled lanes | Tithe line on BNR-operated relays only |
| E21 | A-native settlement | 12,718,760 to 29,994,617 accounts fit (`docs/RECEIPT_R8_VAULTA_RAM.md:48-51`): 0.127% to 0.300% of 10^10 (ARITH) | A is the rate unit; settlement runs through vouchers bought on bPay first-line rails (`docs/RULINGS-2026-09-16.md:73-78`; §8.4). E3 member-pays at 10^10 is feasible only through vouchers | Paid tier caps near 1e7 payers |
| E22 | Identity-root defects | (a) `KeyAlg {Ed25519, MlDsa65}` "added BY RULING" (`crates/bzdid/src/genesis.rs:35-44`); (b) "the lower `signedBy` index wins — r0, the key kept furthest offline" (`crates/bzdid/src/succession.rs:44-48`) yet r0 is "PRF-derived" WebAuthn (`docs/bzdid-architecture-decision.md:49-50`); (c) SHA-256 root forever (`crates/bzdid/src/genesis.rs:16`) | Messaging never needs r0; D13 red; evidence covers genesis ops under SHA3-256. Because the recovery card now outranks device cards (§2.2), (b) is load-bearing for messaging: until it is ruled, recovery-card evictions also take the 72 h notice window with an alarm on every pinned device. Analysis, UNVERIFIED: an RP-domain captor *is* the origin, can solicit r0 by a normal passkey prompt, and r0 wins every fork | (a) add `slh-dsa-shake-256f` and a small-signature SLH-DSA set for the second ongoing signer (§10.1); (b) rank r1 above r0; (c) v2 root ceremony |
| E23 | Who retires algorithms; vote tier | Axis 4: learning must never "silently rewrite" invariants (`docs/specs/SPEC-BTUNGSTEN-1.md:56-60`); Art. VI tiers (`docs/article-vi-s3.md:34-38`, `:46-51`) | No registry record of any kind until ruled. D6, D7 and D25 run on lab registries; the public NUMS canary is the only authority-free trigger (§10.1). Proposed (this draft): a registry gate requiring two independent conforming implementations on shared vectors, signed by a steward set; admit = Feature; accepting a retired suite = Safety (K = 4, 13%, `:37`, `:51`); registry rules = Meta; Epoch 0: founder. E23 ruled is a precondition of live break mode (a gate after P0.f, so P0 itself needs no ruling) and of D7 on a live registry | Ruled authority and tiers |
| E24 | Transcripts | "If a bit was computed from a body, it stays on the body's device" (`LOVErnment-DAO/specs/BIO-1.md:35`) | None in this design | Speaker-opt-in, on-device, sent as content |
| E25 | Handover log owner | "the job of whoever keeps the log" (`docs/specs/SPEC-BPQ-1.md:207-209`) | Per community and conversation; among conflicting valid binds and handovers, the recovery-card-endorsed one wins; two handovers from one `from` raise an alarm and are kept as evidence | bzDiD rotation op |
| E26 | Hosts beyond scope | "my four devices and the hostinger vps" (seat memory, not in repo) | ρ = 1, shown "held by 1"; rungs above 9 wait | Second relay host; test fleet |
| E27 | Process, placement | Seat 3 "**Don't:** design" (`ORDERS-1.md:61`); "Do not build a competing execution core, journal, or storage abstraction" (`docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:3`); "build components that can be replaced without replacing the sovereign" (`docs/dispatches/2026-10-11-ant-native-signer-convergence.md:3`) | Draft for ruling; Seat 1 assigns; bChat Core v2 plus a Buzz adapter set, not a rival stack; SPEC-BCHAT-1 is the protocol authority | Seat 1 reassigns |
| E28 | Wallet-gated ops against relay writes | "anything that ... writes state ... sits behind a logged-in wallet" (`docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:42-44`); its pattern is a key-possession session, "the address is the session ... **not** bzDiD" (`:51-58`); whether Buzz is in "the BNRoSe ecosystem" is unruled | READING: NIP-42 AUTH, a signed nonce challenge, counts as the key-possession session, with per-npub quotas. Tooth: an unauthenticated write is refused | A SIWE wallet session (unfunded) for writes on BNR-operated relays |
| E29 | Forward secrecy against "never orphan data"; prekey retention against the relay cache | "Key rotation must never orphan data" (`docs/CONSTITUTION.md:49`); forward secrecy deletes keys | READING: data is the plaintext in journals and archives, not a ciphertext's key. Prekey secrets are kept for their week plus `pk_keep` (14 days); an older cached object addressed to a device reads "sealed to a retired key", and the sender's outbox re-seals the unchanged inner event (§4.2). `cache_days` (90) exceeds that window by design | Prekeys kept for `cache_days`, which widens the forward-secrecy window to 90 days |
| E30 | A result class for runs on private infrastructure | The ruled classes are four (`docs/specs/SPEC-BTUNGSTEN-1.md:269-275`); KAT, DIFFERENTIAL and INHERITED come from a DESIGN-status spec (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:3`, `:32-41`) | Proposed: RUN-RECEIPT, a receipt computed from observations of a run CI cannot host, printed "private-infra, not CI"; used in §11 and never counted as a ruled class | The standard's owner adopts, renames or refuses it |
| E31 | Laws recorded only in seat memory | The seat's precedence table (its standing instructions, not in repo) names no memory file; several founder laws used here exist only in seat memory (`.../notes/critic.md:118`) | Cited as RECORDED-IN-MEMORY, never as RULED; Seat 1 is asked to land the 2026-10-11 order as a RULINGS file | The landed file becomes the citation |

---

## 2. Identity, devices, agents, keys, succession, recovery

**Root.** The bzDiD is the only root (VOCABULARY Law 7, `docs/VOCABULARY.md:220-226`): "zero" chain bytes at "zero" cost (`docs/bzdid-architecture-decision.md:59`); "No authoritative store must exist for a free identity to work" (`:390`); "Key rotation must never orphan data" (`docs/CONSTITUTION.md:49`; see E29).

### 2.1 Keys per user, pairwise by default (`crates/onboarding/src/lib.rs:113-133`)

| Key | Derived from | Scope | Published |
|---|---|---|---|
| npub | as today | per community | to that community |
| device PQ persona (bzpq1 card, v2 with an `alg` field, §2.5) | the device's own seed, context `buzz:<charter-id>` (57 printable characters, inside the 1-64 rule; E6 READING) | per device per community | once as an immutable `K_CARD`, referenced by digest from `K_BIND` |
| device prekey (X-Wing) | the OS random generator, fresh each week; erased after its week plus `pk_keep` | per device per community per week | `K_PREKEY` with a card-reference attestation (§4.2) |
| Ed25519 cosign key (the classical half of `bzm1` seals) | the device's own seed | per device per community | in `K_BIND`, Schnorr-signed and OTS-stamped before any break |
| recovery card | wallet root, `buzz:<charter-id>:r` | per community | pinned at first bind |
| archive key (X-Wing) | wallet root, `buzz:archive` | per user | never. It seals only the user's own archive bundles and journal ciphertext, never a slot on any message lane. **Anyone who holds the recovery phrase, or can make the passkey produce its PRF output, can read what it sealed.** |
| inbox key | the inbox's own seed | per inbox | in `K_BIND` and contact cards; it never signs as the user |
| device-to-wallet binding | SPEC-BPQ-1 §3, both sides sign | per device | never |

Charter id = base32 of SHA-256 over the first charter event's bytes (52 characters). Derivations reuse frozen `BDID-v1/*` labels (`surfaces/bpq.js:180-188`); the device-seed model is R4's option (A) by READING (E6). No message-lane key derives from the phrase or a passkey PRF, because SPEC-BPQ-1 derives every key it names from `masterPrk`, which "a passkey PRF gives" (`docs/specs/SPEC-BPQ-1.md:32-34`, `:41`).

### 2.2 `K_BIND` and the authority lifecycle

`K_BIND` (kind 47100): `{v:2, charter, seq, prev, cards:[{d, id?, h?, role:"device", retired?}], recovery:{id, h}, ed25519, inbox?:{key, roads, grant_ref}, owner?:{npub, expires, grant}, npub_compromised_since?, inference?:"local"|"remote", fresh_until}`. It is Schnorr-signed by the npub; each authorizing card attests the event id with a card-reference §5b statement (the bidirectional link, `docs/CONSTITUTION.md:52`). The Ed25519 key is bound here, as the wallet's bzDiD Ed25519 cosign already binds a classical key to a PQ statement (`docs/specs/SPEC-BPQ-1.md:115-118`). Full cards (8,797 B of JSON each, ARITH) are published once as immutable `K_CARD` events (kind 47108, 9,143 B) and referenced by SHA3-256 digest, so a bind is 1,170 B at D = 2 instead of 27,189 B with full cards (ARITH). `d` is the device's permanent index in the persona's append-only device list: a retired device keeps its entry as a tombstone and an index is never reused. Under the E6 default a human device's entry carries `d` only, with no card, until P3.

Rules, enforced by every client:

1. **Sequence.** `seq` is mandatory and equals `prev.seq + 1`; `prev` is SHA3-256 of the previous bind's bytes; `charter` is mandatory. A lower or jumped `seq` is refused; two binds with one `prev` are equivocation evidence.
2. **A device card acts only on itself.** Retiring itself is immediate. Adding a new device needs the new card's self-attestation plus one of: the recovery card; k-of-n pinned device cards with k ≥ 2; or one pinned device card, with the change held CONTESTED for 72 h and an alarm on every pinned device (any pinned card or the recovery card may veto).
2a. **Before E6 (no human device cards).** Adding a device entry is a Schnorr-only bind change. Every pinned device subscribes to its own npub, raises "new device added" at once and holds the entry CONTESTED for 72 h; an npub thief can therefore add a device, but not silently. Until device cards exist this is detection, not prevention.
3. **Changing another card, `recovery`, `owner`, or setting `npub_compromised_since`** needs the recovery card or k-of-n device cards (k ≥ 2). Evictions enter CONTESTED with a 72 h veto and an alarm on every pinned device. Until E22(b) is ruled, recovery-card evictions take the same notice window, because the recovery card derives from a root a passkey PRF can reach (`docs/bzdid-architecture-decision.md:49-50`). The estate already arbitrates by rank, not arrival: "the lower `signedBy` index wins ... a thief holding r1 can extend a stolen fork forever" (`crates/bzdid/src/succession.rs:44-48`).
4. **Conflicts (E25).** Among conflicting valid binds, the recovery-card-endorsed one wins; arrival order never decides.
5. **First sight.** A newcomer's bind is pinned only when two roads (or a road and the invite) agree on its head and its OTS proof exists: "A binding proves something only if it existed before the break" (`docs/specs/SPEC-BPQ-1.md:120-125`).
6. **Freshness.** `fresh_until` (default 30 days) bounds how long a client trusts the newest bind it has seen; past it the persona shows STALE until a newer head arrives from at least two independent sources (the second ρ relay, the invite, the user's inbox, a mirror), applying "explicit freshness outcomes" (`docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:38-39`). Every `K_CP` carries the current bind hash, so a withheld revocation shows as a mismatch.
7. **Publication.** A bind counts as published only when HELD-VERIFIED (§6.2).
8. **A stolen npub.** `npub_compromised_since: t` (rule 3) tells readers to show that npub's events from t on only with K_ATT coverage; the persona then replaces its npub by a recovery-card-attested bind.

### 2.3 Agents

Each agent keeps its npub (Buzz "expects agents to hold their own keys", `docs/ledger/pirate-haul-rulings-2026q3.md:28`) and NIP-OA attestation. Under the E5 default an agent holds no PQ key: its owner's device reads the agent's events from the relay, re-verifies their Schnorr signatures, and attests them as **observed-attested**, never upgraded to authored. The owner's device needs its own PQ card for that, so under the E6 default this runs on lab identities only until E6 is ruled. Because an agent's nsec sits in host environment (`skaists/buzz@e1035672:crates/buzz-acp/src/config.rs:243-244`), agent cells close their attestation window every 24 h, and agent Tier-S acts are attested per event by the owner's card.

The agent's bind carries `owner:{npub, expires, grant}`, attested by the owner's pinned card (E7). The `grant` is the signer-enforced ceiling object of §8.1 (purpose, kinds, recipients, per-resource ceilings per epoch, total, expiry). After expiry, checkpoints read "owner endorsement expired". NIP-42 is untouched; the terminal-AUTH rule (`skaists/buzz@e1035672:crates/buzz-acp/src/relay.rs:3804-3806`) is narrowed in the rebuilt harness (§5.3). Revocation is a bind update signed `revoked` on an owner device, offline if needed ("Revocation is a physical act", `LOVErnment-DAO/specs/AGENT-1.md:73`).

**Tier-S events** (approvals 46030/46031, grants, binds, membership, moderation, payment intents) are attested individually and at once (planet-scale's rule). bLOVErAi is never a member (`LOVErnment-DAO/specs/AGENT-1.md:198`); Q-3 is untouched (`:160`).

If E5 is ruled the draft's original way, an agent's PQ persona comes from a harness host seed, with four additions: the wording "post-quantum signed by the agent's host; a compromise of that host compromises both signatures"; the owner endorsement attested by the recovery card; owner co-attestation of every agent Tier-S act; and the host-incident rotation drill D28.

### 2.4 The per-user inbox (Stage 1)

Each user may name an **inbox**: a replaceable service under its own key, listed in `K_BIND` and in contact cards, and replaced by one bind update. It never holds the user's nsec, never signs as the user, and never holds write authority.

- **Mailbox.** It accepts PQ-private objects addressed to the user while the user's devices are offline, under the recipient policy of §8.3, and holds them until pickup.
- **Second failure domain.** It holds the user's journal ciphertext (§6.1), so "durably acknowledged" can mean two failure domains.
- **One phone connection.** A phone talks only to its inbox, which fans in the user's communities.
- **Content-free wake.** The inbox sends the optional push wake (E15).
- **Grant-scoped reads (after P2).** The inbox authenticates to each community relay under its own key and presents a user-issued, read-scoped, expiring, per-community `K_GRANT` (kind 47107, Tier-S). The relay serves it the user's readable set (a relay arm, E4). Buzz already models scoped, expiring tokens (`skaists/buzz@e1035672:crates/buzz-db/src/lib.rs:660-664`).

The free path is the user's own always-on device running the inbox role. The paid path is a competing operator's offer card (§8.4), metered as in §8.1. An inbox operator sees metadata and any channel plaintext it fetched, never private-lane plaintext (§4.6). The design copies the per-user inbox both source designs had (`.../designs/economics-first.md:216`; `.../designs/mesh-native.md:213-214`). Drill D16 removes the inbox operator.

### 2.5 Succession

SLH-DSA-SHAKE-256f handover v1 (`docs/specs/SPEC-BPQ-1.md:190-209`), Rust only so far. Handover v1 targets "the new key set's §3 card" (`:200-201`), which is fixed to ML-DSA-65 lengths (`:94-95`), so a v1 handover after `distrust(ml-dsa-65)` would land on the broken family. Therefore:

- **Card v2** adds an `alg` field, and a handover may target a card of a different family.
- **A second, non-lattice ongoing signer** (an SLH-DSA small-signature set) is admitted under the proposed registry gate (§10.1), and bzDiD `KeyAlg` gains it by ruling (E22a). FN-DSA is an NTRU lattice scheme, a different lattice family from ML-DSA, so it would not cover a general lattice break; it is an option only beside SLH-DSA.
- A tooth refuses a v1 handover to an ML-DSA-65 card made after `distrust(ml-dsa-65)`; the joint drill D25 removes ML-DSA and the classical curves together.

Logs are kept per community and conversation (E25); the successor attests one summary over old checkpoint ids. A handover event is 72,330 B (ARITH): 10.85 MB per user per algorithm era for 150 contacts, fetched lazily.

### 2.6 Recovery

**Ladder.** (1) Another bound device authorizes the replacement. (2) The wallet re-derives from the passkey PRF. (3) The written code r1 is the floor, "the ONLY component that survives platform denial" (`docs/ledger/pirate-haul-rulings-2026q3.md:73`); the recovery card authorizes new devices. Until E22(b) is ruled, D13 stays red and messaging never relies on r0. "A replacement origin must be authenticated before it receives recovery material" (`docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:41-43`). A lost npub is replaced by a recovery-card-attested bind; the archive keeps both under one DID, though Buzz cannot transfer authorship (`.../notes/critic.md:161`).

**History after device loss.** No message carries a slot that the phrase opens. Instead, each receiving device re-seals the plaintext it opens into its own journal at receipt, and the journal replicates to the user's second failure domain (the inbox or an always-on device). A new device restores from there with the phrase. **Residual loss window:** an object opened by only one device that is lost before its next replica flush (ASSUMPTION: within 1 h while online) is lost to the user; the sender's journal still holds it, and the sender can re-seal it on request. Anyone who holds the phrase, or can make the passkey produce its PRF output, can read what was archived or journaled; by design the phrase opens no recorded P5 or P6 traffic, which PQB-ROOT-THEFT (§11) must show before it is claimed. Separating the archive key from that PRF-reachable root is E22 work, which is why D13 stays red.

No social recovery (E14), no uniqueness claim ("Custody is not uniqueness", `LOVErnment-DAO/specs/PERSON-1.md:36`), no biometrics (`LOVErnment-DAO/specs/BIO-1.md:37`).

---

## 3. The envelope of record

### 3.1 One format of record

**`bzm1` is the format of record** (§3.5), proposed as bChat Core envelope v2 under SPEC-BCHAT-1, the protocol authority (E27). NIP-01 bytes enter it as record kind `legacy-nostr`: exact bytes as received, never re-encoded (stored-bytes law, `crates/bzdid/src/genesis.rs:26-30`), never re-signed. An ML-DSA wrapper does not replace secp256k1 (seat memory, not in repo; the in-repo form is "CLASSICAL AT DESTINATION ... None of these is ever labeled post-quantum", `docs/specs/SPEC-BTUNGSTEN-PQ-1.md:1045-1057`). Their header chain fields belong to the holding journal, so each device's archive is one hash chain.

| Envelope | Relation |
|---|---|
| NIP-01 | today's live wire; archived as `legacy-nostr` |
| bChat v1 JSON (`docs/specs/SPEC-BCHAT-1.md:65-71`) | read forever by a frozen decoder; v1 refuses unknown lanes (`surfaces/bchat-core.js:69-70`), so v2 is the bump (`docs/CONSTITUTION.md:92`) |
| CanonicalEvent `MessageEvent` | local projection (E11) |
| x0x `DmEnvelope` | unused: ids in clear, 600 s lifetime (`.../notes/critic.md:130-133`, `:225`) |
| WB001 | authority bodies embed WB001 intents |
| `bheart.signature/1` | bSigner's file envelope, unchanged |

### 3.2 Live-lane kinds and the relay changes

| Kind (provisional) | Purpose | Lands |
|---|---|---|
| 47100 `K_BIND` | binds by card reference (§2.2) | P2 arm; agent binds journaled off-relay from P1b and published at P2; real devices at P3 (E6) |
| 47101 `K_CP` | daily per-cell checkpoints; weekly private heads (no `h` tag) | P2 |
| 47102 `K_ATT` | card-reference attestations | P2 |
| 47103 `K_PQG` | private-group messages, rekey wraps | P6 |
| 47104 `K_BZM` | `bzm1` outer-envelope carrier | P7 |
| 47105 `K_PREKEY` | weekly device prekeys (§4.2) | P5 |
| 47106 `K_CHARTER` | community charter, a regular kind so relays keep every version (§5.1) | P2 |
| 47107 `K_GRANT` | user grants to an inbox; owner grants to agents | P2 |
| 47108 `K_CARD` | immutable bzpq1 cards | P2 |
| 22100 `K_PQAUTH` | ephemeral companion to NIP-42 AUTH | P2 arm; demanded in break mode |
| 22101 `K_RID` | relay-signed, nonce-bound identity proof and signed refusal (§5.6) | P2 |

The charter moves off 37100 because buzz-core treats 30000 to 39999 as NIP-33 addressable (`skaists/buzz@e1035672:crates/buzz-core/src/kind.rs:451-454`), where a relay keeps only the latest version and the charter chain would be lost. No fork constant sits at 47xxx or 221xx (SOURCE: grep of `skaists/buzz@e1035672:crates/buzz-core/src/kind.rs` at the pin; the ephemeral kinds in use are at `:77-83` and `:457-472`). P0.i rechecks against upstream main at a fetched sha, the fork being 354 commits behind it (`.../notes/buzz.md:14`). Each kind is one match arm with `Scope::MessagesWrite` (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:345`), under the 256 KB content cap (`:2014`), budgeted to the 64 KiB frame. NIP-01 clients ignore unknown kinds and stock relays refuse them. A relay listed in a PQ-declaring charter that drops these kinds is a FAULTY road (§4.4); only a road outside any PQ charter shows "classical only".

### 3.3 Algorithms and ids

| Use | Algorithm | Id | Class |
|---|---|---|---|
| legacy id, signature | SHA-256, BIP-340 Schnorr | implicit | classical, listed (`.../notes/buzz.md:101`) |
| checkpoint, prekey and private-head attestation | ML-DSA-65 over `"bpq1/nostr-event" ‖ 32 id bytes` | `bpq:1`, `kind` | PQ |
| confidentiality | X-Wing draft-11 slots to prekeys, AES-256-GCM, SHA3-256 key commitment | `bpq1`, `aead`, slot `to` | PQ hybrid KEM |
| group epoch key (P6) | random epoch key in slot `to:"group"`, label `bpq1/wrap/group` | slot `to` | joins `domainsDisjoint` |
| `bzm1` seal (P7) | ML-DSA-65 AND Ed25519 over `"bzm1/seal" ‖ suite ‖ SHA3-256(all non-signature fields)`; both halves required | suite id (signature pair and hash id) | PQ plus classical hedge |
| second ongoing signer (proposed) | an SLH-DSA small-signature set | new registry id | hash-based |
| succession | SLH-DSA-SHAKE-256f, `bpq1/handover`; card v2 may change family | `bpq:1` | hash-based |

Unknown ids are refused, never defaulted (`docs/specs/SPEC-BPQ-1.md:265-272`). The live lane adds no `bpq1/` label until P6; prekeys and private heads are attested by the existing `bpq1/nostr-event` statement, so the 14-label proof stands (`crates/bpq-core/src/layout.rs:34-61`). The eight `bzm1/` labels live in a new crate with disjointness proved against `bpq1/`; bpq-core and bSigner are untouched.

**Signing mode.** Every device and harness signature uses hedged ML-DSA-65, and hedged Ed25519 where the library supports it. Deterministic signing is used only in vector mode, which is how bsigner "signs deterministically and reproduces it byte for byte" for its cross-check vectors (`docs/specs/SPEC-BPQ-1.md:224`); "JS signing is not claimed to be constant-time" (`:272`). P0.b carries a sign-twice row: device signatures over one message differ, and vector-mode signatures are byte-identical.

### 3.4 Signature amortization, honestly modelled

**Chain tag.** Every event a device publishes in a cell carries `["bzp", <id of this device's previous event in this cell>, "<d>:<seq>"]` inside the signed id, where `d` is the device's index in the persona's append-only device list (§2.2) and `seq` counts that device's events in the cell (85 B at the calculator's seven-character field). Each device keeps its own linear chain, so a persona with D devices has D chains per cell and siblings never sync before posting. A forger holding a stolen nsec has three choices, and each is exposed: an index absent from the pinned bind shows Unbound to every reader; a sibling's index forks or extends that sibling's chain, and the sibling's next post forks it (Forked, flagged on that post); a device's own index yields an event that device's journal does not hold, which that device, subscribed to its own npub, treats as local break evidence (§10.3). A thief who first adds a new index trips rule 2a (§2.2).

**Several devices, one npub.** The attack round's per-persona chain would have flagged every user with D ≥ 2, because two honest devices posting without syncing make two events with one parent. Per-device chains remove that: honest siblings extend disjoint chains, and an event carrying a sibling's index that extends that sibling's chain is never evidence. PQB-FORGE keeps its two-honest-devices control, which must show 0 Forked and 0 suspect-mode entries; by analysis (not a run) the per-device rule passes it. Residual, stated: before E6 an npub thief can add a device index, and rule 2a makes that loud, not impossible.

**Daily per-cell checkpoints.** A cell is one channel, scoped by its `h` tag, which the relay already gates by membership (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/req.rs:133-138`, `:1022`), or one private conversation. On each day with new ids (at the first send after 24 h, or by the device's timer at 24 to 26 h while online) the persona publishes `K_CP`: canonical base64url of the 32-byte ids **this persona signed in this cell** since its last `K_CP` ("attest what you signed, never what you observed"), with tags `v`, `c`, `h`, `seq`, `prev`, `range`, `bind` (the current `K_BIND` hash) and `cs` (the charter seq). The daily `K_CP` is the head beacon: an id named by a `K_CP` or by a chain parent that a reader lacks is WITHHELD within a day, given a second source (§6.2). Per-cell scope limits each reader to its own cell. A verifier refuses a `K_CP` whose `c` or `h` does not match the cell where it is shown, and every `K_CP` is OTS-stamped when it closes, directly or by including the persona's chain head in the stamped epoch evidence tree (§10.4).

**Weekly attestation.** At most once per 7 days per cell, the persona attests its newest `K_CP` with a card-reference §5b statement (`K_ATT`); the `prev` chain carries that attestation back over the week's checkpoints. The window closes at 1,024 ids; at the first send after the oldest unattested id is 7 days old; by the device's timer at 8 days while online; and at once before any Tier-S act in the cell. No window extends to 30 days. Agents (24 h) follow §2.3.

**Private lanes.** Each week the sender seals in-lane a signed checkpoint listing the SHA3-256 digests of the covered objects. The key commitment binds `Kf` (`docs/specs/SPEC-BPQ-1.md:155-157`), so digests bind plaintexts. The week's sealed checkpoints are committed into one public **private head** per persona per community (a `K_CP` with no `h` tag whose content is a Merkle root), and one `K_ATT` attests it. Readers fetch that `K_ATT` on demand before break mode, so the 5,033 B attestation is never fanned out per copy. The private head tells the relay that this persona had private activity this week (a cadence leak, measured as M3 in §4.6).

**States.** Signed; Not yet settled; Settled; Settlement available (not checked); SETTLED-LATE (time unproven, §10.2); Classical only; Unbound (a covering checkpoint omits it); Forked (equivocation in the chain); WITHHELD; STALE (authority past `fresh_until`); Unattributable (§10.2).

**Card-reference transport.** §5b JSON carries the 1,952-byte key as 2,603 base64 characters. `K_ATT` drops `dsa` and `succ`; verifiers re-expand from the pinned card and run the frozen `bsigner bpq-verify`. The signed message is unchanged, so no label changes: 7,706 B becomes 5,033 B, 34.7% less (ARITH). F8 is the obligation that would show the expansion lossless.

**Burst model (ASSUMPTION).** Sent mix 60% DM, 35% group, 5% channel; active cells per user-week (DM, group, channel) = (2, 1, 1) at M = 1, (5, 3, 1) at M = 10, (12, 6, 3) at M = 100. Ids per weekly window n = max(1, 7·M·share/cells). Ids per daily `K_CP` = λ/(1 − e^(−λ)) with λ = M·share/cells per day (posting days are Poisson). A persona's private cells share one private head per week, as if they sat in one community: 7·M·(0.6 + 0.35) ids.

**Sizes (ARITH).** A 200 B text as kind 9 is 586 B, and 671 B with the chain tag. `K_CP(n)` = 682 + ⌈32n·4/3⌉: 725 B at n = 1, 1,024 B at n = 8; at most 1,519 ids fit a 64 KiB frame. A sealed private checkpoint (group slot) is 2,340 B at n = 1; a private head is 644 B.

| M | n per weekly window (DM, group, channel) | ids per daily `K_CP` (channel) | private ids per week under one private head | sender settlement, B per message: DM, group, channel (`K_CP` share + `K_ATT` share) |
|---|---|---|---|---|
| 1 | 2.10, 2.45, 1.00 | 1.03 | 6.65 | 1,997; 1,842; 708 + 5,033 |
| 10 | 8.40, 8.17, 3.50 | 1.27 | 66.5 | 414; 422; 580 + 1,438 |
| 100 | 35.0, 40.8, 11.7 | 2.05 | 665 | 131; 121; 375 + 431 |

Withdrawing the 30-day extension costs bytes in low-rate cells: at M = 1 a channel message carries 5,741 B of sender settlement. Readers pay only the `K_CP` share per copy (708 B at M = 1) before a break, because `K_ATT` is fetched on demand. BESIDE's daily window cost 8,229 B per message at M = 1 (14× the message).

**Readers verify lazily before a break.** Display needs Schnorr and chain continuity until `distrust(secp256k1)` or local break evidence. Readers fetch `K_CP` eagerly and `K_ATT` on demand: always for Tier-S and anything acted on (ASSUMPTION: 2% of displayed copies), never in the background by default. Background prefetch is a per-client option, priced in §7.2. One message each from 1,000 authors costs 1,000 verifies and 5.03 MB of attestations when checked (BESIDE fetched 8.23 MB eagerly). In break mode checking is mandatory, and §7.7 budgets the transition.

### 3.5 `bzm1` layout (Stage 2, STRATA's, corrected)

| Part | Fields (bytes) | Size |
|---|---|---|
| inner record | `"bzm1"`+version 5, suite 2, kind 2, `author_ref` 32, `seq` 8, `prev` 32, `at` 8, `time_rep` 1, `key_epoch` 4, `body_len` 4, body ≤ 4,096 | 98 + body |
| outer envelope (all a relay sees) | magic+version 5, rotating `mailbox_tag` 32, lease expiry 8, nonce 12, AEAD tag 16 | 73, padded to 512 B buckets |
| seal | magic 5, suite 2, card id + `author_ref` + conversation binding 96, `from_seq`+`to_seq` 16, head 32, `at`+`time_rep` 9, `key_epoch` 4, ML-DSA-65 3,309, Ed25519 64 | 3,537 |

`author_ref` = SHA3-256(`"bzm1/persona"` ‖ bzDiD ‖ `conv_id`): keyed off the DID, unlinkable without the random `conv_id`. `prev` = SHA3-256(`"bzm1/chain"` ‖ previous stored bytes); `msg_id` = SHA3-256(`"bzm1/msg"` ‖ stored bytes); both bind suite, kind, conversation, sequence and **key epoch**. The suite id names both the signature pair and the hash id, so a future hash change is a new suite; F5 is the obligation that covers this binding.

**Composite seal.** The signed message is M = `"bzm1/seal"` ‖ suite ‖ SHA3-256(all non-signature fields). A seal is VALID only if both halves verify. "Either half" applies only to attribution under rule (3) of §10.2, after one family is distrusted. The Ed25519 key comes from the persona's `K_BIND`, Schnorr-signed and OTS-stamped before any break, never from inside an ML-DSA-signed card, which a D6 adversary could forge. F10 `compositeNonSeparable` and the strip, swap and relabel teeth (§11) guard it.

**Seal cadence and fan-out.** One seal per persona per community per window covers a Merkle root of its cell heads; each record carries its cell's Merkle path (at most 32·⌈log2 cells⌉ B). Windows close at 1,024 records, at 7 days, or at once for Tier-S. Before break mode readers fetch seals on demand; in break mode once per reader, author and window, which is still about 4 KiB per copy in low-rate channels (§7.2). A 200 B text pads to **512 B** and a seal to **4,096 B**: 512 + 4,096/n per message in break mode; Tier-S records seal singly (4,608 B). If an SLH-DSA small-signature set (SHAKE-128s, 7,856 B) replaces ML-DSA after D6, a seal is 8,084 B, padded 8,192: 8,704, 1,536 and 640 B per message at n = 1, 8 and 64, against 4,608, 1,024 and 576 B today (ARITH).

Labels: `bzm1/persona`, `/chain`, `/msg`, `/seal`, `/member`, `/mailbox`, `/archive`, `/evidence`. Both seal halves come from the client library, since bSigner "is ML-DSA by design" (`crates/bsigner/CONTRACT.md:58-61`). TLV extensions carry a critical bit.

### 3.6 Compatibility

The 18 agents keep their npubs, kinds and origin. buzz-acp gets a **rebuilt harness**: a road list replacing `BUZZ_RELAY_URL` (`skaists/buzz@e1035672:crates/buzz-acp/src/config.rs:240`) and a narrowed `is_terminal_auth_failure` (`skaists/buzz@e1035672:crates/buzz-acp/src/relay.rs:3804-3806`), which today treats any refusal without the `error:` prefix as terminal. Before P2 a refusal is terminal only when every road refuses alike for 10 minutes, and then the agent raises an alert instead of stopping silently; after P2 only a relay-signed, nonce-bound refusal counts (§5.6). It rolls out one agent at a time with rollback. buzz-cli keeps its JSON contract and **HTTP** NIP-98 calls to the real relay (`skaists/buzz@e1035672:crates/buzz-cli/src/client.rs:78-107`; `/query` `:774`; `/events` `:874`; `/media/upload` `:1197`). No websocket facade: the x0x-nostr-bridge is a "NIP-01 subset + NIP-11/16/42/50" that leaves the Buzz dialect to an unbuilt "bridge v2" (`saorsa-labs/x0x-nostr-bridge@03cd47ab50:README.md:3`, `:26`).

---

## 4. Confidentiality: pairwise, groups, metadata

### 4.1 Lanes and exact allowed wording

| Lane | Mechanism | Allowed wording (exact) |
|---|---|---|
| Channel | TLS to the relay (hybrid only where that road's receipt shows it, §5.7); the relay stores plaintext (`.../notes/buzz.md:91-92`) | "Readable by this community's relay and its members. Not end-to-end encrypted." |
| `bnr-private` (bChat v1, built) | NIP-17 + NIP-44 v2 | "Encrypted end to end with NIP-44 v2, sound by construction against the pinned official vectors. Classical: a recording could be opened once secp256k1 is broken." |
| `bnr-pq-private` DM (P5, lab-only until E2) | kind 1059 from a fresh key (other-key 1059s are accepted today, `skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:2023-2028`); a bpq1 object with one X-Wing slot per recipient device prekey and per sender's other device prekey; no self slot, no archive slot, no slot to any key the phrase derives; plaintext = the sender's signed kind-14 event with its chain tag and an in-band suite advertisement | Before FS-1 and PCS-1: "Encrypted to the listed devices' weekly keys with X-Wing (ML-KEM-768 + X25519) and AES-256-GCM, sound by construction. Signed by the sender: classical now, post-quantum once a sealed conversation checkpoint covers it. No forward-secrecy or post-compromise claim yet. The relay sees who is in the conversation and when." |
| `bnr-pq-private` group (P6, lab-only until E2) | `K_PQG` with an `h` tag; one random epoch key in the group slot; rekeyed on join, on leave or ban, and weekly (§4.3) | As above, plus "A member who leaves can read until the next rekey, at most 10 minutes later." The sentence "A new member cannot read messages from before they joined" is allowed only after the joiner test passes. |
| `bzm1` pairwise (P7) | X-Wing handshake inside an individually sealed Tier-S record; a two-sided KEM ratchet: each side adds a fresh ephemeral X-Wing key and encapsulates to the other's latest one, at most once per 24 h or 50 messages, and erases ephemeral secrets after use; a hash ratchet per message | Only after FS-1 and PCS-1 pass: "Message contents are encrypted between the two members' devices under a hybrid post-quantum key exchange (X-Wing) and AES-256-GCM, with keys that change every epoch; sound by construction, not audited, not proven end to end." Until then the words "keys that change every epoch" are withheld. |
| Huddles | server-forwarded, soft cap 25 (`skaists/buzz@e1035672:crates/buzz-relay/src/audio/room.rs:46-49`) | "Not end-to-end encrypted." |
| x0x | unused for people (E1) | none; no TreeKEM receipt (`docs/ledger/pirate-haul-rulings.md:19`) |

Sizes (ARITH): a P5 DM is 4,084 B with one slot (D = 1), 8,321 B with three (D = 2) and 16,796 B with seven (D = 4); a 64 KiB frame holds 29 slots. A P6 DM is 2,104 B and a `K_PQG` 2,077 B. Archives carry their own wording: "Anyone who holds your recovery phrase, or can make your passkey produce its PRF output, can read what was archived" (§6.5).

### 4.2 Prekeys, forward secrecy and post-compromise recovery (PQ-EPOCH)

Upstream says it plainly: "Post-quantum signatures and key encapsulation do not alone prove forward secrecy or recovery after key compromise" (`saorsa-labs/x0x@v0.48.0:docs/adr/consolidated/A09-r01-group-encryption-and-key-changes.md:58`). The only KEM key a card publishes derives from the seed (`docs/specs/SPEC-BPQ-1.md:41`, `:94-95`), so sealing to it can give neither property. Therefore:

- **Prekeys.** Each device draws a fresh X-Wing keypair from the OS random generator every week, per community persona, and publishes `K_PREKEY` `{card id, week, expiry, pk}` with a card-reference `K_ATT` over its id: the existing `bpq1/nostr-event` statement, so the 14-label proof stands. Cost: 7,176 B per device-community-week; at 10^10 users, D = 2, C = 1.5, that is 2.85 Gbps of ingress, plus 30.4, 87.3 and 182.2 Gbps of partner-device fetches at M = 1, 10 and 100 (ARITH, §7.8).
- **Sealing.** P5 objects seal to the newest valid prekey of each listed device; P6 wraps go to current prekeys; nothing on a message lane seals to a card key or a phrase-derived key.
- **Erasure.** A device keeps a prekey secret for its week plus `pk_keep` (default 14 days) and then erases it. An object sealed to an erased prekey reads "sealed to a retired key"; the sender's outbox re-seals the unchanged inner signed event to a current prekey on request (the record is the inner event, §6.2). This conflicts with the relay's 90-day cache and with "Key rotation must never orphan data"; both are escalated as E29.
- **What FS-1 must show.** After erasure, a thief who takes a device (its card, its seed, the phrase) opens 0 of the recorded objects sealed to its erased prekeys. Compromise of a current prekey secret opens objects sealed to it until erasure. Tooth: an implementation that derives prekeys from the seed is convicted.
- **What PCS-1 must show.** Healing after a device compromise needs that device's card retired by a `K_BIND` (recovery card or k-of-n, §2.2) and fresh prekeys from a clean device. A thief holding a card can publish prekeys until the card is retired, which is why eviction is an authority act with a CONTESTED window. In `bzm1` (P7) the two-sided KEM ratchet is designed to heal within one ratchet step once the attacker loses access; PCS-1 tests that. Tooth: a static-key implementation is convicted.
- **The phrase replay tooth (PQB-ROOT-THEFT).** An attacker holding the phrase, a PRF output and the archive key replays recorded P5 and P6 traffic and must open 0 objects; a client that adds an archive slot is convicted. The same run reports, as a measured count, how many archive bundles and journal segments the attacker opens: all of them until E22 separates the archive key from the PRF-reachable root.

### 4.3 Groups (P6, METABOLIC's epoch key, delivery cost corrected)

- **Epoch keys** are drawn fresh from the OS random generator, never derived from a seed, and wrapped in the group slot (48 B wrap, label `bpq1/wrap/group`).
- **Rekey triggers:** every join (a new member or a new device), every leave or ban within T_rekey = 10 minutes (mesh-native's rule), and weekly for active groups. Until a leave rekey lands, "a departed member can still read new messages", and sensitive rooms hold sends.
- **Delivery:** the changer sends one wrap event per remaining device, one X-Wing slot each, to that device's current prekey (2,930 B): O(n), 750,080 B at 256 devices. One all-slots object would make every member fetch every slot, O(n²): 0.139 GB at 256 devices, 2.12 GB at 1,000 (ARITH). A weekly rekey of a 7-member group at D = 2 is 41,020 B.
- **Concurrent rekeys:** the epoch whose wrap set has the lowest SHA3-256 wins; members discard the other.
- **Deletion:** each epoch key is erased at epoch end plus `late_days`.
- **Payer:** a rekey on leave or ban is in the security-critical class (§8.1), quota-exempt up to a charter bound, so a moderator with zero balance still completes it within T_rekey.
- **Teeth:** the joiner test (a member who joins at epoch e opens nothing from before e) and the heal test (an evicted device opens nothing from the next epoch).

No MLS claim ("no IETF wire interop in this release", `saorsa-labs/x0x@v0.48.0:docs/adr-archive/0012-treekem-default-secure-groups.md:117-121`). Above 256 devices a group is a channel.

### 4.4 Downgrade resistance

PQ capability is learned from binds that relays serve, so a relay that withholds them could push a sender onto the classical `bnr-private` lane, the harvest-now path the estate has already hit once (`.../notes/pq-tungsten.md:108`). Upstream x0x rejects transparent downgrade: "A downgrade must be the *caller's* explicit choice ... never the daemon's guess" (`saorsa-labs/x0x@v0.48.0:docs/adr-archive/0030-dm-durable-application-ack-v2.md:82-85`).

- **Sticky per-contact PQ pin.** Once a contact's PQ-capable bind is pinned, the client refuses a lower lane for that contact with the named refusal `PQ_PIN_DOWNGRADE`. A user may downgrade one message explicitly and visibly.
- **Suite floor** = max(the registry's `prefer`, once E23 allows a registry record; the highest suite seen for that contact or community).
- **In-band advertisement.** Every sealed object's inner envelope lists the sender's suites, so a relay cannot strip it.
- **FAULTY roads.** A relay listed in a PQ-declaring charter that drops kinds 47100 to 47108 is a FAULTY road, not "classical only"; the client moves to another road and records the fault.
- **High-water alarm.** A persona whose pq-seen mark falls (a contact once PQ-capable now looks classical) raises an alarm.
- **First pin** requires the bind's OTS proof (§2.2).
- **Communities** write the newest suite every member advertises, never below a monotone charter `suite_floor` that only the owner or the stewards raise; members below the floor get a named exclusion, and reading stays open to all, because "new versions must not break existing consumers" (`docs/CONSTITUTION.md:92`).
- **Tests:** PQB-DOWNGRADE, and a PQB-FORGE tooth in which a relay withholds a pinned contact's bind and a client that silently falls back is convicted.

### 4.5 Remote inference

If a bind says `inference:"remote"`, the conversation shows a distinct visible mode ("an AI agent here sends what it reads to its model provider") and withholds end-to-end words: remote modes are "distinct, user-visible, per-session, explicitly-chosen" (`LOVErnment-DAO/specs/AGENT-1.md:45`); the datacenter sentence "must never ship" (`:30`).

### 4.6 Metadata: separate, measured properties

Post-quantum encryption hides contents, not who talks to whom. These are separate properties, each with its own test, and none is claimed.

| Observer | Sees |
|---|---|
| community relay | pairwise npubs, connection times and IPs, channel plaintext, private-lane participant sets and timing, checkpoint and private-head cadence per persona |
| the user's inbox operator (§2.4) | the user's connection times and IP, which communities and cells the user reads, sizes and timing of everything it holds, ciphertext of private lanes and journals, and channel plaintext it fetched under the grant |
| network | TLS endpoints, the road's SNI, sizes, timing |
| not published by the protocol | device-to-wallet bindings and the bzDiD. Cross-community linkage by IP and timing is possible for shared relay or inbox operators and for network observers: NOT-RUN |
| `bzm1` relay (P7) | connecting IP, byte counts, rotating mailbox tags read; and, because every session authenticates by NIP-42 as a member (§5.6), the authenticated npub that fetched each tag and posted each envelope. The envelope itself carries no sender field |

**Properties (PQB-LINK, §11), measured with planted correlators:**

- **M1 relay-log linkability:** the share of envelopes and mailbox-tag fetches a relay operator links to an authenticated npub by joining its own logs. Tooth: a planted log join must be detected by the measurement.
- **M2 timing linkability:** the share of conversations whose two ends a global passive observer pairs by timing, at a stated false-positive rate.
- **M3 cadence leakage:** what an observer learns about message cadence from checkpoint, private-head and prekey timing.

No unlinkability claim without a TAM slice (`.../notes/critic.md:234`). "Isolated by design: the envelope header names no sender, recipient or identity" is allowed only after the rung-1 header-scan test passes on `bzm1`, and only about the header, never about the session. Anonymous quota tokens on unauthenticated sessions are a named future option that needs its own design and receipts; P7 does not depend on them.

---

## 5. Roads, transport, censorship

**5.1 Charter.** `K_CHARTER` (kind 47106, a regular kind, so relays keep every version) is signed by the owner's npub and attested by the owner's PQ card; for BNR's community that card is the founder's one-press signer. Authority changes also need the steward threshold. Body: `{v:2, seq, prev, label:"skaists.buzz", stewards:{m, n, cards}, succ_commit, relay_keys:[{npub, bzpq1 card}], roads, suite_floor, policy:{T_max, T_long, cache_days, late_days, pk_keep, quotas, security_bound}, fresh_until}`. `succ_commit` is an SLH-DSA succession commitment for the charter itself.

- **Sequence.** `seq` = `prev.seq` + 1 and `prev` = SHA3-256 of the previous charter's bytes. A lower seq is refused ("anti-rollback state", `docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:38`), and so is a jump (tooth). One compromised owner key can therefore not lock the community at seq 2^53 − 1.
- **Forks.** Two charters with one `prev` are evidence. The steward threshold recovers from a named fork point, and the losing branch is kept as evidence.
- **Freshness.** Past `fresh_until` a client shows STALE until it sees a newer head from at least two independent sources.
- **Invites** carry the owner's bzpq1 id, the charter head hash and the roads.
- "Sources may supply records and bytes, never their own authority" (`:36`).
- **Drills:** owner key gone (D23) and max-seq or seq-jump (D24).

**5.2 Two relays per community** (planet-scale's keepers, no new protocol). The charter lists ρ ≥ 2 relays from distinct operators and failure domains. The outbox publishes to both; readers read either; gaps are repaired with identical bytes from the other; heads are cross-checked between them to find WITHHELD ids. No relay-to-relay replication is needed (§fractal is "BUILT nowhere", `docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:89`). Until E26, "held by 1" is shown.

**5.3 Failover.** Last-known-good road first; a transport failure moves on. A refusal is terminal only when it is signed by a relay key listed in the charter and bound to this session's nonce (§5.6); an unsigned refusal is a transport failure, so neither a captive portal nor a road that copies NIP-11 can stop an agent. Until that relay arm lands (P2), the rebuilt harness retries across every road with backoff and stops only when every road refuses alike for 10 minutes, raising an alert instead of stopping silently. Media URLs on charter hosts are rewritten to the active road and accepted only if their SHA-256 matches (`/media/<sha256>` parsing, `skaists/buzz@e1035672:crates/buzz-cli/src/client.rs:275-320`). That fixes the broken `skaists.buzz/media` links of 2026-10-15 (seat memory, not in repo).

**5.4 Ladder.** Diverse SNI names (MEASURED: `relay.skaists.dev` passes the filter that resets `skaists.buzz`, `docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:7-11`), alternate ports, obfuscated transport; Veilid off by default (`b-onboard/src/ladder.rs:3-13`, a sibling repo, SOURCE). Receipts read "connected via road N, rung M, TLS group G" (§5.7); all rungs failing gives the named `ONB-G3-04` refusal. "A VPN can never be an onboarding step" (`docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:54`). From P7 a carry rung moves envelopes by file or QR.

**5.5 x0x and the road-policy file** (mesh-native's mechanism). Signed entries `{road, planes, pin}`; adapters refuse unlisted planes (`ROAD_PLANE_FORBIDDEN`); a road counts only after its own runtime receipts ("Nine configured peers are not nine connected peers", `docs/specs/SPEC-BTUNGSTEN-1.md:148`). x0x is an optional machine-plane transport adapter, never storage and never a dependency: `planes:[machine]`, UDP only (`.../notes/x0x.md:25`), scoped to "one owner with 2–5 machines" (`saorsa-labs/x0x@v0.48.0:docs/adr-archive/0095-scope-x0x-is-glue.md:81`), presence on one global topic (`saorsa-labs/x0x@v0.48.0:docs/adr-archive/0049-presence-foaf-discovery.md:15`). Phones are never x0x peers. E1 and E1b govern any change.

**5.6 L5 gate, relay identity, break-mode AUTH.** "Connected" only after four receipts per session per road (`docs/specs/SPEC-BTUNGSTEN-1.md:146-148`):

- **EXPOSURE:** the road answered at rung M.
- **IDENTITY:** the relay signs, with a key listed in the charter, a fresh client nonce together with the NIP-42 challenge, the road and the charter seq (a relay-signed ephemeral `K_RID`, kind 22101). The NIP-11 `self` field alone is copyable configuration in a public HTTP document (`skaists/buzz@e1035672:crates/buzz-relay/src/nip11.rs:55-57`, `:308-309`), and today the relay signs nothing during AUTH (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/auth.rs`, which verifies only the client's event).
- **PEER:** NIP-42 AUTH as a member.
- **AGREEMENT:** the relay serves the charter head and sampled member heads, and they match the second ρ relay or the invite: "an INDEPENDENT source" (`docs/specs/SPEC-BTUNGSTEN-1.md:165-166`). A new persona uses the charter head.

In break mode the client adds `K_PQAUTH`, a card-reference §5b statement over the AUTH event id, and the relay verifies one ML-DSA-65 signature per session against the pinned card (E4). The relay's own bzpq1 card, pinned in the charter, signs the same IDENTITY tuple with ML-DSA-65, so authentication is mutual. Refusals that end a session are `K_RID` events bound to the nonce. Teeth: an impostor that copies NIP-11, and a split-view relay, both leave the UI "not connected" (PQB-ROADSPOOF).

**5.7 Transport receipts.** Every connect receipt records road, rung and the negotiated TLS key-exchange group. X25519MLKEM768 (codepoint 0x11EC) is recorded as hybrid; any classical group is labelled "classical transport". Classical roads are labelled, not refused, because some obfuscation rungs may not negotiate hybrid groups. The receipt is the only basis for any transport wording.

---

## 6. Durability, offline delivery, retention, archive, BNRoSe reuse

**6.1 Outbox journal.** A consumer crate of `bnrose-exec-host` (`buzz-outbox`), per the set pattern (`docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:83`), reusing `ReplicatedJournal` and `SupervisorKeys`, with codes outside `E_*`. Sign, append the exact bytes fsynced on every replica, then publish. "Durably acknowledged" (`docs/specs/SPEC-RUSTEOSVM-1.md:65-71`) holds only when the replicas sit in distinct failure domains the user controls or durably pays for: the device plus the user's inbox or own always-on device (§2.4). Today's replicas are two files standing for two hosts (`crates/bnrose-exec-host/src/opexec.rs:101-108`), so receipts say "single-domain, not §2.4" until a second domain exists; relay copies never count. Day segments per persona, chained by the previous final tag, bound the whole-history reload (`crates/bnrose-exec-host/src/opexec.rs:235-240`). Receiving devices also journal the plaintext they open (§2.6).

**6.2 Delivery states** (mesh-native's machine):

- **ADMITTED:** signed and journaled.
- **SENT:** published on road r.
- **HELD:** the ρ charter relays answered OK. Hostinger's Postgres durability setting is UNVERIFIED, so HELD means only "the relay answered OK" until receipted.
- **HELD-VERIFIED (authority objects only):** binds, revocations, charters, grants, prekeys and `K_CP` count as published only after a delayed read-back of the identical bytes over a separate road or from the other ρ relay within T_verify = 10 minutes. The outbox retries and alerts until VERIFIED (PQB-FAKEACK).
- **DELIVERED:** a recipient device's signed ack (private lanes only).
- **WITHHELD:** a reader-side state for an id named by a `K_CP`, by a chain parent or by a DELIVERED gap that the reader lacks.
- **UNKNOWN:** never success.
- **LATE-REFUSED:** a drift gate refused it.
- **EXPIRED:** past `cache_days` unheld, shown to the sender.

Recovery re-delivers **identical bytes only** (`docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43`); re-signing would change the id. For private objects the record is the inner signed event: re-wrapping it in a fresh 1059, or re-sealing it to a current prekey, keeps the record's bytes identical. Every state is also a relay-signed, content-free statement over a salted commitment, countersigned by the client (§8.9).

**6.3 Late delivery and the commit-time floor (proposed fix, untested).** The relay refuses any event more than 900 s from server time, every kind (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:2005-2011`). A commit-time floor also makes that a storage invariant for channel rows. A DEFERRABLE constraint trigger aborts at COMMIT any channel-window row older than the floor (`skaists/buzz@e1035672:migrations/0021_created_at_fence_floor.sql:19-36`), with "deliberately NO in-band bypass for channel-bearing rows". The writer pool arms it on every connection (`skaists/buzz@e1035672:crates/buzz-db/src/lib.rs:673-716`) at 960 s (`skaists/buzz@e1035672:crates/buzz-db/src/replica_fence.rs:74`). So backdated bytes can never enter channel-window rows, and the draft's late-accept would have aborted at COMMIT.

P2 instead adds a **late table**, or an exempt row class, that stores late or imported events as their exact original bytes:

- **Shape.** Rows are indexed by original id and original channel, served by their own query and never by keyset-paged windows, and the channel membership read gate applies on read. A bare `channel_id IS NULL` carrier would lose that gate.
- **Acceptance.** An older event is accepted iff an authenticated member whose key equals its `pubkey` sends it, and either an OTS-stamped `K_CP` of the same persona covers its id (no age cap; in break mode the `K_CP` must also be attested, so the rule works under the E6 default, where human checkpoints carry no PQ attestation) or its `created_at` is within the charter's `late_days` (default 7). The future-dated gate stays. The stamp proves only that the ids existed by the stamp time, so a member can still carry their own events with an older claimed `created_at` through a self-made, stamped `K_CP`; clients show the stamp time beside the claimed time.
- **No 1059 carve-out.** A kind-1059 gift wrap is never carried late, because the relay skips the pubkey check for gift wraps (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:2023-2028`). The outbox re-wraps the unchanged inner signed event in a fresh 1059 with a current `created_at`. Relays refuse ids on their prune and moderation tombstone lists (PQB-REPLAY-1059).
- **Display.** Online clients flag "arrived late".
- **Replacement relays** are seeded by members republishing their journals (D2), never by an import inside the writer pool. Any operator import runs outside it with the replica breaker closed, per the migration's own rule.
- **Tests.** The buzz-db fence tests stay green in the same job as teeth. PQB-HEAL adds 8- and 30-day partitions, which must end with 0 events left LATE-REFUSED, as axis 6 asks for "recovery after long partitions" (`docs/specs/SPEC-BTUNGSTEN-1.md:79-81`).

This remains an E4 RED-class relay change.

**6.4 Offline and retention.** When both sides are offline, the user's inbox (if any) and the community relays hold the message for `cache_days` (default 90, ASSUMPTION) at the payer of record's cost (§8.1), and the outbox retries identical bytes; no x0x 600 s lifetime applies (`.../notes/critic.md:130-133`). Prekey retention is shorter (week + 14 days), so a device offline longer than that needs a re-seal (E29). `until-read` and `ephemeral` messages are never archived; `applyRetain` prunes locally and reports (`surfaces/bchat-core.js:131`); RETAIN/FORGET is "publication-consent routing, not deletion" (`docs/GLOSSARY-BRIDGE.md:34`).

**6.5 Archive (optional, one consistent flush rule).**

- **Bundle.** The user's own view: their sent events, the plaintext of received private objects as re-sealed by their devices, received channel events, `K_CP`s, their own `K_ATT`s, binds, charters. It is a deterministic `BNRARCV1` batch (`crates/bnr-archive/src/batch.rs:1-25`), sealed as a bpq1 object to the archive key, so it opens from the phrase. A `rosetta` field names spec, vectors and verifier. Wording shown to the user: "Anyone who holds your recovery phrase, or can make your passkey produce its PRF output, can read what was archived."
- **Two-family wrap.** "Uploading it publicly is safe" (`docs/specs/SPEC-BPQ-1.md:187-188`) holds only while X-Wing holds. Permanent uploads are wrapped at write time under two KEM families. Until a second-family KEM is admitted (an HQC slot once FIPS 207 is final, `docs/specs/SPEC-BPQ-1.md:268-269`), archives stay device-only (the default), or, if the founder rules so (Decision 22), upload with the warning "a future break of the lattice family could open this archive".
- **Flush.** Upload when the pending bundle holds at least 3 full chunks and 30 days have passed since the last flush, or at 12 months; at most 63 chunks per file ("never engage the merkle path (≥64 chunks)", `docs/dispatches/RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:42`). Small users pay one 3-chunk file a year instead of 36 chunks of monthly minimums. Arweave only once its paid path is receipted (the Turbo free tier is "ArDrive's corporate subsidy", `docs/storage-substrate-split.md:314`); routing per B1 (`docs/dispatches/BUZZ_A_METERING_SPEC.md:127`).
- **Payment.** `ant-pay.js`, the user's own wallet, exact-quote approval, `SpendReceipt` in `ChunkCount`. The upload is a BNRoSe op idempotent on the bundle's SHA-256, so a paid-but-incomplete upload recovers without paying again (seat memory, not in repo). The browser door to BNRoSe is open work (`.../notes/bnrose.md:285`), so P4 starts on the desktop.
- **Evidence** (STRATA). SHA-256 **and** SHA3-256 of the sealed bytes, a leaf in the epoch evidence tree (§10.4), the AR copy id. Renewal hashes **ciphertext**, so anyone may renew without reading.
- **Second failure domain.** With or without an archive, the user's history lives on their own devices plus their inbox or always-on device, with optional reciprocal holding by contacts' devices at zero charge (METABOLIC's rule F-1, `.../designs/economics-first.md:320-323`).

| Case | M | MB/yr | files/yr | chunks/yr (flush rule; monthly rule) | ANT | gas | gas share |
|---|---|---|---|---|---|---|---|
| A (channels of 100) | 1 | 4.2 | 1 | 3; 36 | $0.011 | $0.008 | 44.5% |
| A | 10 | 36.7 | 2.92 | 9; 36 | $0.032 | $0.025 | 43.8% |
| A | 100 | 324.4 | 12 | 84; 84 | $0.295 | $0.101 | 25.6% |
| B (heavy tail, E[R] = 550) | 1 | 15.6 | 1.24 | 4; 36 | $0.014 | $0.010 | 42.7% |
| B | 10 | 139.5 | 11.10 | 34; 36 | $0.119 | $0.094 | 44.0% |
| B | 100 | 1,183.8 | 12 | 288; 288 | $1.011 | $0.101 | 9.1% |

ARITH from §7 (channel attestations of others are not archived). Prices are one-date receipts: 0.084802 ANT per chunk and ANT at $0.04137896 (`docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:64`, `:17`), so $0.0035 a chunk. Gas is the measured quotes-mode average for a 3-chunk payment, 3.35e-6 ETH (`:72`), at $2,519.20 per ETH (`:17`): $0.0084 per payment. A live quote of 0.2145 ANT for 4,146 bytes, 0.0715 ANT per chunk, is seat memory, not in repo. Amounts are stated in chunks, not fiat (`docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:23`). Gas is up to 44.5% of a small flush, so ECON-GAS (§8.8) sets a gas-to-value ceiling of 50% per flush. At 10^10 users these flushes are 317 to 3,803 payments a second, counted in §8.4. In the native lane the records alone (512 B each) come to 1.6, 16.3 and 162.7 MB a year in case A at M = 1, 10 and 100, against 4.2, 36.7 and 324.4 MB on the live lane; seals add to that.

---

## 7. Scale

Every figure in this section is ARITH from Appendix A over the ASSUMPTION inputs below. Registrations are never counted as activity: every row is a rate of active use.

### 7.1 Declared workload model (ASSUMPTION; no ruling gives a messaging rate)

| Input | Value |
|---|---|
| active human users N | 10^10, every one active daily (the floor 1 op per user-day is 115,741 ops/s, seat memory, not in repo; 10^10/86,400 = 115,740.7) |
| devices per user D | 2 (range 1 to 4) |
| messages per user-day M | 10 (1 = the floor; 100 high) |
| human sent mix | 60% DM (1 recipient), 35% group (6), 5% channel |
| channel posts by channel size (case B and later) | 80% to channels of 100 members, 17% to 1,000, 3% to 10,000 (heavy tail; mean 550); case A puts every channel post in a channel of 100, as the draft did |
| agents per human a | 0.1, 1 or 5 (Buzz's own target is 10K humans + 50K agents per relay, `.../notes/buzz.md:55`, i.e. a = 5); always connected; M_a = 10 messages per agent-day, mix 20% DM, 30% group, 50% channel; agents read the channels their owners join |
| delivered copies | DM 2D − 1; group 7D − 1; channel R·(D + a) + 1 |
| concurrency | humans 10% of devices connected (range 5 to 30%); agents 100% |
| communities per user C | 1.5 (range 1 to 3) |
| relays per community ρ | publish to 2; a reader holds 1 connection (ρ_read = 1; range 1 to 2) |
| relay cache; prekey keep | 90 days; week + 14 days |
| new devices | 2·10^10 devices replaced every 3 years: 1.825·10^7 a day |

Cases: **A** channels of 100, no agents (draft-comparable); **B** heavy tail, no agents; **C**, **D**, **E** heavy tail with a = 0.1, 1 and 5.

### 7.2 Traffic

**Per-copy bytes by lane, D = 2** (DM / group / channel). "Live" is Stage 1 at P6 before a break; "interim" is break mode before P7 (§10.3); "native" is `bzm1` with seals fetched on demand before a break, and once per reader, author and window in break mode.

| M | classical (today) | live lane | interim break lane | native, before break | native, in break mode |
|---|---|---|---|---|---|
| 1 | 586 / 586 / 586 | 4,226 / 3,291 / 1,480 | 8,067 / 7,294 / 5,704 | 2,724 / 696 / 512 | 4,674 / 2,368 / 4,608 |
| 10 | 586 / 586 / 586 | 2,677 / 2,481 / 1,280 | 7,370 / 7,165 / 5,704 | 2,003 / 567 / 512 | 2,490 / 1,069 / 1,682 |
| 100 | 586 / 586 / 586 | 2,285 / 2,203 / 1,054 | 7,193 / 7,121 / 5,704 | 1,021 / 523 / 512 | 1,138 / 623 / 863 |

The classical baseline is today's 586 B kind-9 message, not a 428 B estimate. The live DM column includes weekly rekey wraps (930 B per copy at M = 1). The native DM column includes the two-sided ratchet steps, which cost 2,560 B each, at most one per party per day.

**Delivered traffic, average Gbps** (formula: Σ over lanes of (N·M·share + N·a·M_a·agent share) · copies · bytes ÷ 86,400 × 8). The figure in brackets is per-copy bytes against the 586 B classical copy.

| Case | M | copies per message | classical | live lane | interim | native, before break | native, break mode |
|---|---|---|---|---|---|---|---|
| A | 1 | 16.4 | 8.9 | 34.7 (3.90×) | 97.3 (10.93×) | 12.2 (1.38×) | 60.6 (6.82×) |
| A | 10 | 16.4 | 89.0 | 268.2 (3.01×) | 955.5 (10.74×) | 104.9 (1.18×) | 243.1 (2.73×) |
| A | 100 | 16.4 | 889.9 | 2,290 (2.57×) | 9,507 (10.68×) | 866.9 (0.97×) | 1,255 (1.41×) |
| B | 1 | 61.4 | 33.3 | 96.3 (2.89×) | 334.9 (10.05×) | 33.6 (1.01×) | 252.6 (7.58×) |
| B | 10 | 61.4 | 333.2 | 801.5 (2.41×) | 3,332 (10.00×) | 318.3 (0.96×) | 944.0 (2.83×) |
| B | 100 | 61.4 | 3,332 | 6,683 (2.01×) | 33,273 (9.99×) | 3,000 (0.90×) | 4,852 (1.46×) |
| C (a = 0.1) | 10 | 111.3 | 664.1 | 1,529 (2.30×) | 6,560 (9.88×) | 608.5 (0.92×) | 1,892 (2.85×) |
| D (a = 1) | 1 | 762.6 | 4,552 | 11,587 (2.55×) | 44,387 (9.75×) | 4,000 (0.88×) | 35,703 (7.84×) |
| D (a = 1) | 10 | 459.4 | 4,986 | 11,013 (2.21×) | 48,683 (9.76×) | 4,394 (0.88×) | 14,283 (2.86×) |
| D (a = 1) | 100 | 156.3 | 9,327 | 17,520 (1.88×) | 91,693 (9.83×) | 8,242 (0.88×) | 13,675 (1.47×) |
| E (a = 5) | 10 | 1,641.5 | 53,439 | 117,033 (2.19×) | 520,567 (9.74×) | 46,770 (0.88×) | 153,313 (2.87×) |

Appendix A prints the rows omitted here (C and E at M = 1 and 100). Read the table this way: the live lane costs 1.8× to 3.9× classical per copy; the interim break lane costs about 10×; the native lane costs about classical before a break (0.88× to 1.38×) and 1.4× to 7.9× in break mode, the high end being low-rate channels, where one seal is fetched per message (F6). **"Native is the fix" is withdrawn**: native is a cost reduction against the interim lane, and in low-rate channels in break mode it saves little. With agents posting at Buzz's own ratio (case E), agent volume, not post-quantum overhead, sets the load: 53 Tbps before any PQ byte.

**Ingress per relay copy (humans):** classical 0.5, 5.4 and 54.3 Gbps; live lane 3.8, 23.3 and 202.2 Gbps; native break mode 3.6, 18.1 and 87.4 Gbps at M = 1, 10 and 100; ρ = 2 doubles it. A 10,000-member community in case A at M = 10 receives 0.27 Mbps of delivered traffic on average, 0.80 Mbps at a 3× peak, and caches 2.27 MB per member over 90 days. Text bandwidth is small per community.

**Channel size and the crossover (M = 10, live lane, humans posting, push reads, C = 1.5, ρ_read = 1, 10% concurrency).** Bandwidth boxes = peak (3× average) ÷ 0.7 Gbps per U-1G box (ASSUMPTION over CLAIMED, `docs/specs/LOADMODEL-1M.md:87-89`); connection boxes = connections ÷ 10^5 (an unbinding GAP figure, §7.4).

| Every channel post to a channel of R | D = 1 | D = 2 | D = 4 |
|---|---|---|---|
| R = 100 | 7.8 copies; 0.37 Tbps peak; 530 bandwidth vs 15,000 connection boxes | 16.4; 0.80; 1,150 vs 30,000 | 33.7; 1.67; 2,388 vs 60,000 |
| R = 1,000 | 52.8; 1.97; 2,815 vs 15,000 | 106.4; 4.00; 5,720 vs 30,000 | 213.7; 8.07; 11,529 vs 60,000 |
| R = 10,000 | 502.8; 17.97; **25,668 vs 15,000** | 1,006.4; 36.00; **51,425 vs 30,000** | 2,013.7; 72.06; **102,939 vs 60,000** |

Bandwidth overtakes connections once channels pass about 5,800 members (5,799, 5,781 and 5,772 at D = 1, 2 and 4), so "connections bind" is not robust. A community-wide channel at today's 10K humans + 50K agents is 3,506.4 copies per message and 124.87 Tbps at peak if every channel post went there: 178,383 bandwidth boxes against 530,000 connection boxes. For the heavy tail with humans posting, push reads give 2.40 Tbps at peak (3,435 bandwidth boxes against 30,000); **pull-based reads** for channels of 1,000 or more, with readers opening a quarter of posts (ASSUMPTION), give 1.15 Tbps (1,644 boxes). Large channels are therefore pull-based: readers fetch on open, the relay meters reader-paid `NetByte` per reader, and `K_CP` rides with the pulled page.

### 7.3 No global state

Every object is per persona, cell, community, inbox or device. No directory, presence topic, log, room or CRDT spans the population (`.../notes/scale.md:135-142`); this design writes no chain bytes (`docs/bzdid-architecture-decision.md:61`). The community is the shard; cross-community DMs arrive with the native lane, whose contact cards list mailbox relays, or earlier through the recipient's inbox.

### 7.4 Connections, boxes, mobile

**Box capacity is unproven.** LOADMODEL quotes "100k+ realtime connections" as an unbinding "Connection-count cross-check (not binding)" for "a strong dedicated box [GAP ...]" (`docs/specs/LOADMODEL-1M.md:91`). Whether a U-1G box ($101 a month, CLAIMED, `:87`) holds it is UNVERIFIED; P0.b measures it. Every box count below divides by 10^5 under that caveat.

**Relay boxes, D = 2.** Connections = N·D·C·ρ_read·concurrency + N·a·ρ_read (agents always on). Cells show a = 0.1 / 1 / 5.

| ρ_read | C | 5% concurrency | 10% | 30% |
|---|---|---|---|---|
| 1 | 1 | 20k / 110k / 510k | 30k / 120k / 520k | 70k / 160k / 560k |
| 1 | 1.5 | 25k / 115k / 515k | 40k / 130k / 530k | 100k / 190k / 590k |
| 1 | 3 | 40k / 130k / 530k | 70k / 160k / 560k | 190k / 280k / 680k |
| 2 | 1 | 40k / 220k / 1,020k | 60k / 240k / 1,040k | 140k / 320k / 1,120k |
| 2 | 1.5 | 50k / 230k / 1,030k | 80k / 260k / 1,060k | 200k / 380k / 1,180k |
| 2 | 3 | 80k / 260k / 1,060k | 140k / 320k / 1,120k | 380k / 560k / 1,360k |

**One cost basis** (D = 2, C = 1.5, 10% human concurrency, agents always on, $1,212 per box-year): humans only 30,000 boxes, $36.4M a year, $0.0036 per user-year ($0.0073 with ρ_read = 2); a = 0.1: $0.0048; a = 1: 130,000 boxes, $157.6M, $0.0158; a = 5: 530,000 boxes, $642.4M, $0.0642. Humans only at D = 1, 2, 4: 15,000, 30,000, 60,000 boxes. The draft mixed two bases ($0.024 per user-year assumed every device connected at once); this is the single basis used everywhere. A community of 10K humans and 50K agents needs 52,000 connections, 0.52 of a box; a community renting a dedicated box pays $0.121 per member-year, twice that with ρ = 2. Whoever pays is set in §8.1 and E3, never BNR beyond its capped relay.

**The inbox form.** If each inbox holds one always-on session per user and community, relays carry 1.5·10^10 sessions (150,000 boxes) and inboxes 170,000 boxes: more than direct phones. With a multiplexed, grant-scoped inbox-to-relay link (a relay arm, E4), relay-side sessions fall to a few per inbox operator, and inboxes need 20,000 boxes for the phones. The inbox is a load win only when multiplexed.

**Phones.** Budget: **one connection per phone**, to its inbox, or to one relay of one community when there is no inbox; phones are never x0x peers; they sync in the foreground, by OS background fetch, or on a content-free wake sent by the inbox (E15). Received bytes per phone-day on the live lane: case A 18.7, 144.8 and 1,236.7 KB at M = 1, 10 and 100; case B 52.0, 432.8 and 3,609.0 KB; case D 4,171.4, 3,964.8 and 6,307.0 KB. The relay is the meeting point, so phones need no NAT traversal. PQB-MOBILE (§11) measures time to device with push on and off, bytes and radio wakes per day, and whether the L5 handshake completes inside the iOS background window; no mobile claim stands before it runs.

### 7.5 Verify-CPU budget and its receipt

Relays verify Schnorr per event and **no** ML-DSA before break mode (one `K_PQAUTH` per session after). In break mode a device verifies one attestation per author, cell and window it shows as attributed. The lane n̄ comes from §3.4.

| Case | M | received copies per device-day | verifies per device-day | n̄ | t_v budget (10,000-message backlog in 5 s): DM, group, channel, mixed | t_v budget (10 s per device-day) | interim lane verifies per device-day |
|---|---|---|---|---|---|---|---|
| A | 1 | 8.2 | 6.4 | 1.28 | 1.05, 1.22, 0.50, 0.64 ms | 1,567 ms | 8 |
| A | 10 | 82.0 | 18.2 | 4.50 | 4.20, 4.08, 1.75, 2.25 ms | 549 ms | 82 |
| A | 100 | 820.0 | 51.2 | 16.01 | 17.50, 20.42, 5.83, 8.01 ms | 195 ms | 820 |
| B | 1 | 30.7 | 28.9 | 1.06 | as A, mixed 0.53 ms | 346 ms | 31 |
| B | 10 | 307.0 | 82.5 | 3.72 | as A, mixed 1.86 ms | 121 ms | 307 |
| B | 100 | 3,070.0 | 244.1 | 12.58 | as A, mixed 6.29 ms | 41.0 ms | 3,070 |
| D | 1 | 2,796.3 | 2,786.3 | 1.00 | as A, mixed 0.50 ms | 3.6 ms | 2,796 |
| D | 10 | 3,063.0 | 869.2 | 3.52 | as A, mixed 1.76 ms | 11.5 ms | 3,063 |
| D | 100 | 5,730.0 | 477.5 | 12.00 | as A, mixed 6.00 ms | 20.9 ms | 5,730 |

The binding budget is the channel lane at M = 1: t_v,p95 ≤ 0.50 ms on the slowest supported phone, or the backlog takes longer than 5 s and §7.7's drain cap governs. Globally, break-mode verification is 1.48, 4.22 and 11.86 million verifies a second in case A at M = 1, 10 and 100; 6.69, 19.10 and 56.50 million in case B; and 967.48, 301.81 and 165.80 million in case D. Relay `K_PQAUTH` load, with a = 1 agents connecting once a day: at 6, 24 and 96 sessions per device-day, 2.20, 8.45 and 33.45 million verifies a second globally, 17, 65 and 257 a second per box across 130,000 boxes, and 89, 340 and 1,347 Gbps of `K_PQAUTH` ingress. No estate ML-DSA throughput receipt exists (`.../notes/scale.md:157`); every CPU line is UNVERIFIED until P0.b.

**P0.b, planet-scale's lane, exactly.** An `rbench` lane in `crates/btungsten-bench`: RustCrypto `ml-dsa =0.1.1`, `libcrux-ml-dsa =0.0.11` (`crates/btungsten-pq/Cargo.toml:20`, `:25`), noble 0.7.1 in headless Chromium; integritychain `fips204` as separate rows only if E1b is ruled (proofs do not transfer, `.../notes/pq-tungsten.md:149`). Hosts: a GitHub Linux runner, Hostinger, the Dell under WSL ("Off Unix there is no `wait4`", `crates/btungsten-bench/src/measure.rs:25`), and **one phone, mandatory**: without the phone row, every mobile line in §11 reads NOT-RUN and is never extrapolated. At least 20 runs per cell (`crates/btungsten-bench/src/stats.rs:12`). Rows: verify, hedged sign, sign-twice (§3.3), X-Wing, SLH-DSA, and a relay connections lane for concurrent sessions per U-1G-class box. Teeth: a bit-flipped signature must fail and an empty one be refused, or the run is Miswired and red. Appendix A becomes a workload-calculator crate that reproduces every number in §3.4, §4, §6.5, §7, §8 and §10.4 as CI tests.

### 7.6 Locality law (planet-scale's ladder)

Rungs: 1 host, then 9 (btmd netns rig, "single host, not a mesh result"), then 100 (at least 3 hosts and 2 networks including the filtered building), then 1k, then 10k ("no scale claim skips a rung", `docs/specs/LOADMODEL-1M.md:137`), then simulation (a RUN-RECEIPT of the simulator, never a ruled class). The probe is one community's relay and one member device; N is the count of other communities. Pass: probe bytes, CPU and connections regressed on log10 N over 100, 1k and 10k give a 95% CI containing 0 and |slope| ≤ 2% per decade. Additional rungs: an **agent-heavy rung** at a = 5; a **community-wide channel** at today's 10K humans + 50K agents; a **simulated distrust** on the rung, whose backlog must drain within §7.7. Teeth: a planted all-community topic or directory must show load growing with N and be convicted; a client that keeps showing pre-switch messages as attributed without verifying them is convicted. Rungs above 9 need E26.

### 7.7 Break-mode transition

When break mode starts (§10.3), three costs arrive at once.

**Backlog.** Tier-S records and the last 7 days of displayed history are verified eagerly; everything older is verified when displayed. Drain caps: at most 20 MB a day on metered networks and 10% of one core (ASSUMPTION); until verified, a message shows "verifying", never as attributed.

| Case | M | eager attestations per device | MB per device (90-day eager, for scale) | global drain over 7 days |
|---|---|---|---|---|
| A | 1 / 10 / 100 | 45 / 128 / 359 | 0.2 / 0.6 / 1.8 (2.9 / 8.3 / 23.2) | 0.06 / 0.17 / 0.48 Tbps |
| B | 1 / 10 / 100 | 202 / 578 / 1,708 | 1.0 / 2.9 / 8.6 (13.1 / 37.4 / 110.6) | 0.27 / 0.77 / 2.27 Tbps |
| D | 1 / 10 / 100 | 19,504 / 6,084 / 3,343 | 98.2 / 30.6 / 16.8 (1,262.1 / 393.7 / 216.3) | 38.95 / 12.15 / 6.68 Tbps |

**Interim lane.** Until P7 lands, every new event carries its own `K_ATT` and readers require it: about 10× classical per copy (§7.2), 955.5 Gbps in case A at M = 10 against 268.2 on the live lane, and one verify per received copy (§7.5).

**Session proofs.** `K_PQAUTH` and the relay's ML-DSA identity proof per session (§7.5). The break-mode final checkpoints of every persona are in the security-critical class (§8.1).

### 7.8 Identity, keys and churn

| Item (D = 2, C = 1.5) | M = 1 | M = 10 | M = 100 |
|---|---|---|---|
| eager readers of a persona's keys (DM partners + group co-members, × D) | 16 | 46 | 96 |
| prekey publication (7,176 B per device-community-week) | 2.85 Gbps ingress at every M | | |
| prekey fetches by partner devices | 30.4 Gbps | 87.3 Gbps | 182.2 Gbps |
| bind churn per new device, full cards (bind 27,189 B + 2 attestations) | 1.10 Gbps | 2.99 Gbps | 6.14 Gbps |
| bind churn, card-reference bind (1,170 B + 2 attestations + one 9,143 B card) | 0.60 Gbps | 1.64 Gbps | 3.36 Gbps |
| rekeys per device change (join and leave) | 64,460 B; 0.22 Gbps | 181,660 B; 0.61 Gbps | 386,760 B; 1.31 Gbps |
| 90-day resync per new device (case A) | 1.7 MB; 2.8 Gbps | 13.0 MB; 22.0 Gbps | 111.3 MB; 188.1 Gbps |

Full-card binds are 18,389, 27,189, 35,989 and 44,789 B at D = 1 to 4; card-reference binds 1,041, 1,170, 1,299 and 1,428 B. With 1.825·10^7 new devices a day, the card-reference bind halves churn. Channel readers fetch binds only on demand before a break; in break mode they fetch the binds of the authors they display. The attack round's 17.3 Gbps figure assumed 246 eager readers per persona, which is the break-mode shape.

### 7.9 Voice, low bandwidth and accessibility

- **Voice.** Huddles stay server-forwarded, N×(N−1) frame copies per 20 ms tick, soft cap 25 and hard cap 255 (`skaists/buzz@e1035672:crates/buzz-relay/src/audio/room.rs:46-49`), classical transport and "Not end-to-end encrypted" (§4.1); no PQ claim. x0x voice is two-party only (`saorsa-labs/x0x@v0.48.0:README.md:147`), so moving huddles to x0x would lose multi-party voice and is not proposed (E1). Huddle bytes are relay `NetByte` under §8.1. No huddle scale figure is computed here: NOT-RUN.
- **Text alternatives.** Speaker-opt-in transcripts made on the speaker's device and sent as content are the text alternative to huddles for deaf members; they wait for E24 (Decision 17).
- **Low bandwidth.** On the live lane a phone receives 18.7 to 1,236.7 KB a day in case A and up to 6,307.0 KB in case D (§7.4, ARITH); PQB-MOBILE measures it.
- **Assistive technology.** The law book has no screen-reader, voice-only or low-literacy requirement for messaging (`.../notes/critic.md:265-268`). The estate's CI meter checks target size and WCAG 2.2 AA contrast on three-UI fronts (`.github/workflows/tests.yml:1095-1099`); that is not a messaging accessibility receipt. This spec adds no accessibility test family: an open gap (§14).

---

## 8. Economics

### 8.1 Meter table (METABOLIC's discipline), metering unconditional

Every connection, byte, cache-day, checkpoint and lease gets a `SpendReceipt` naming the consuming member's pairwise persona (E19), whoever pays. Where a relay operator pays its own resource under B1 rule 2, the receipt charges zero; the ruled precedent is "free-tier receipts simply charge zero" (`docs/dispatches/LANE_M_B_METER_2026-08-29.md:6`). The payer of record is always a named account (an operator's bzDiD persona or wallet session, or the member), never "the community", and never BNR beyond its seeds and its own capped relay. Zero funds always give `FloorRefusal`, never silent absorption. For the community-relay rows below, "the member", "the sender" and "the reader" are payers of record only if E3 is ruled member-pays; under the E3 default the relay operator's named account is payer of record, and each receipt names the consuming member at zero charge. Inbox and archive rows are user-paid services either way.

| Resource | Unit (`crates/shared-types/src/spend.rs:62-71`) | Counted by | Payer of record | Ceiling | Refusal or free path |
|---|---|---|---|---|---|
| identity, personas | none, 0 bytes | nobody | nobody | none | free |
| device CPU, storage | own (optional zero-charge receipt) | the device | the user | own hardware | free |
| relay connection | `RamByte` + `NetByte` per term (interim, E19) | relay and client | the member (E3); by default the operator's named account, at zero charge to the member | charter quota; the member's grant | session refused; client polls |
| bytes pushed (publish) | `NetByte` | relay and client, double entry | the sender | quota | `FloorRefusal`; device copies stay |
| bytes pulled (read) | `NetByte` | relay and reader | the reader | quota | `FloorRefusal`; authority kinds (`K_BIND`, `K_CHARTER`, `K_CARD`, registry heads, revocations) stay readable even then |
| relay cache | `StorageByte`, term in the rate set (interim) | relay | the sender until expiry | `cache_days` | relay declines; the sender keeps a copy |
| unsolicited inbound to an inbox | `NetByte` + `StorageByte` byte-days | inbox and sender, double entry | the sender, until pickup | recipient policy (§8.3) | refused by name; the message stays on the sender's device |
| inbox lease (a phone or session held) | `RamByte` per term | inbox | the holder (the user) | the user's grant | session refused |
| checkpoints, attestations, prekeys, binds, cards | `StorageByte` | relay | the publishing member | quota | quota refusal, except the security-critical class |
| **security-critical class**: revocation, rekey on leave or ban, Tier-S closing checkpoint, break-mode final checkpoint | `NetByte` + `StorageByte` | relay | the relay's payer of record (the operator's own resource, or the members pro rata under E3); never an escrow, never BNR | a charter-set per-member bound | quota-exempt up to the bound |
| archive | `ChunkCount` (+`ChainFee`) via bPay/ant-pay | the user | the user | the user's own cap; depth-gated admission (§8.7) | "archive not funded; your history is on your devices only" (CD-13, `docs/feature-backlog.md:302-306`) |
| permanence | `StorageByte`, `Rail::Arweave` | the user | the user | the user's cap | refused until receipted |
| evidence inclusion | `StorageByte` (one leaf in the epoch tree) | the tree builder | the claimant | per leaf | lapses to UNATTRIBUTABLE, never lost |
| era root renewal | epoch-fixed, a few roots | any leader | any leader; anyone may renew | per epoch | none needed |
| agent compute | `VramByteSecond` + `CpuMicrosecond` + `NetByte` (`docs/dispatches/BUZZ_A_METERING_SPEC.md:49-50`) | provider | the owner bzDiD | the grant's ceilings | refusal |
| agent relay connections and bytes | as the relay rows | relay | the owner bzDiD | the grant's ceilings | refusal |
| BNR seeds | fixed per epoch | BNR | BNR, an allowed standing cost (`docs/CONSTITUTION.md:83`) | token bucket (§8.5) | named overflow refusal |
| BNR's own community relay (E3 default) | fixed per-epoch capacity | BNR | BNR, as estate consumption | the capacity cap | "this community is full; join or start another" |

Buzz may route payment, never be payer of record; zero balance is "a REFUSAL, not a subsidy ... Never a silent top-up, never a loan" (`docs/dispatches/BUZZ_A_METERING_SPEC.md:109-112`). Push and unsolicited inbound are sender-paid; pull is reader-paid.

**Grants.** An agent or an inbox acts only through a `grant` object: `{v, grantor, grantee, purpose, kinds, recipients, ceilings:{ResourceClass: per-epoch}, total, expires}`. It is signed per record as a Tier-S act and enforced by the key-holding signer: the agent harness's signing component or the inbox's session refuses past a ceiling. A relay pre-check is advisory and labelled so: "A keyless relay can be replaced, so a cap only it enforces is not a cap" (`docs/SPEC-RESOURCE-DASHBOARD-1.md:299`). The explicit-grant law ("purpose, operations, resources, recipients, duration and limits") is seat memory, not in repo. METABOLIC's owner grant had the same shape (`.../designs/economics-first.md:82-85`). ECON-CAP tests it.

### 8.2 Free tier, honestly

Free: identity; signing, sealing and verifying on one's own device; membership in a community that admits free members; device-held history; the user's own always-on device as inbox. Not free: archives (pay or a named refusal), paid inboxes, and over-quota use if E3 or E13 is ruled. A community that admits free members funds them through each inviter's capped grant, so personas a single inviter adds share that inviter's cap. Bring-your-own reciprocity, in which members' own devices forward and hold the group's traffic at zero charge (`.../designs/economics-first.md:320-323`), is an option that needs its own sizing. The free tier exists only where some community funds a relay and admits free members; nothing guarantees that at 10^10.

### 8.3 Spam, Sybils and the inbox policy

- **Communities.** Membership is the write gate ("Channel membership is the only gate", `.../notes/buzz.md:67`); per-member quotas on all kinds; attestations limited (Tier-S per event, otherwise per window); NIP-42 AUTH as the key-possession session with per-npub quotas, "the caller-pays doctrine ... made mechanical" (`docs/dispatches/RULING_WALLET_GATED_OPS_2026-08-20.md:61-63`; E28); moderation.
- **Inboxes.** A recipient's policy runs in order: a write ACL of admitted contacts and groups; then an introduction forwarded by an admitted contact; then stranger postage at the provider's published commodity rate (only if E13 is ruled); then a sender-CPU stamp at a recipient-set difficulty under a protocol cap (`.../designs/economics-first.md:361-364`). P7 acceptance is gated on a 10^4-stranger spam drill against an inbox.
- **Sybils.** Identity is free ("machine DIDs cost nothing to create, so a machine DID never carries quota", `.../notes/law-identity-scale.md:124`), so the community gate, not postage, is the fence (E13). Sybil resistance is a separate measured property, A2-SYBIL (§8.8): community-paid bytes gained per added persona must be 0. Device proof of work (`docs/SPEC_SOVEREIGN_WALLET_FUNDING.md:42`, CLAIMED) is optional friction only.

### 8.4 Settlement, vouchers and competing operators

Users buy vouchers ("SURVIVES ONLY where USERS BUY the credits", `docs/dispatches/RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md:23`); the system issues none (ECON-7).

- **Operators compete.** Each provider publishes a signed **offer card** (a rate set in A per unit and term, routes, jurisdiction), and there is no provider registry: offers travel in road cards, invites and public lists anyone may publish (`.../designs/economics-first.md:330-334`). A charter lists at least 2 relays from distinct operators. The plan has no preference for a single voucher provider. Unspent vouchers are redeemed on exit as a linked receipt (`prior_receipt_id`).
- **Settlement.** One aggregated `SpendReceipt` per voucher per epoch, and settlement per provider-operator pair per epoch. Relays are paid by bPay to their own address; "BNR is never in the flow of funds" (`docs/RULINGS-2026-07-26.md:48`).
- **Top-up cadence is set by value.** A top-up must cost at most 5% of its value in fees (ECON-TOPUP). At the measured $0.0084 per payment (§6.5) the minimum top-up is $0.169. At the relay costs of §7.4 that one top-up lasts 46.4 years (humans only), 23.2 (ρ = 2), 10.7 (a = 1) or 2.6 (a = 5): 6.8, 13.7, 29.6 and 120.6 top-ups a second at 10^10. Whether a plain token transfer costs less than the measured payment transaction is UNVERIFIED.
- **Chain load at 10^10.** Archive flushes add 317 to 3,803 payments a second (§6.5). The draft's monthly top-ups would have been 3,802.6 a second and yearly ones 316.9.
- **Scale.** A-native settlement fits 0.127% to 0.300% of 10^10 users (E21), so E3 member-pays at 10^10 is feasible only through vouchers bought on bPay first-line rails.

### 8.5 Seed budget (METABOLIC's arithmetic)

Cold-start fetches of a 4 KiB signed hint list at 10^10 users: 2·10^10/(3 years × 365) new devices plus 1% a day of cache loss = 2.183·10^8 a day (0.894 TB, 82.8 Mbps). BNR caps its seeds at 10^7 fetches a day (41.0 GB, 3.79 Mbps, 328 s of one 1 Gbps link). The cap binds at 9.163·10^8 devices (about 4.58·10^8 users); beyond it BNR's cost does not grow with N, and 95.4% of cold starts at 10^10 are refused by BNR's seed (ARITH). So the seed cannot be the primary path:

- **Mirrorable list.** The hint list is a content-addressed, signed, per-epoch object embedded in every invite and charter and mirrorable by anyone; BNR's seed is one mirror.
- **Fairness.** Allocation is by token bucket per minute and per source prefix, with optional capped proof of work.
- **Drill.** A planted exhauster must not push honest join success below a stated floor (90% of honest joins within 10 minutes, ASSUMPTION). Overflow joiners get "seed budget exhausted, use an invite or another mirror"; invite joins touch no seed.

### 8.6 The ten-billionth-user test

User 10^10 creates a bzDiD (0 BNR cost); joins a community whose operator or members fund its relays (0 to BNR), or BNR's own community, whose capacity is fixed per epoch (past the cap, the named refusal); signs, checkpoints and verifies on their own device (0); archives with their own wallet or not at all (0); and cold-starts from an invite or a mirror (0), or from BNR's capped seed.

| BNR standing cost | Grows with N? |
|---|---|
| seeds | no, capped per epoch (§8.5) |
| BNR's own community relay | no, fixed capacity per epoch (E3 default) |
| spec and reference-code maintenance | no |
| era evidence root renewal (§10.4) | no, a few roots per epoch |

**Verdict:** PASS only if E3 is ruled member-pays (or operator-pays for every community but BNR's). Under the default, BNR's cost is bounded by its relay cap and its seeds. NOT RUN until A1-ECON-8D, including the BNR relay cap case, and ECON-1 receipts exist.

### 8.7 Rail C depth check

"Required in the depth workflow either way: state the market-cap vs acquirable-liquidity check explicitly" (`docs/dispatches/RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:84-86`); "an unmeasured rail is not a usable rail" (`docs/dispatches/BUZZ_A_METERING_SPEC.md:126`).

| Case | M | chunks a year at 10^10 | multiple of circulating ANT (341.57M, `docs/storage-substrate-split.md:151`) | years of today's total ANT volume ($341,118 a day, `:151`) |
|---|---|---|---|---|
| A | 1 | 3.0·10^10 | 7.4× | 1 |
| A | 10 | 9.0·10^10 | 22.3× | 3 |
| A | 100 | 8.4·10^11 | 208.5× | 24 |
| B | 10 | 3.4·10^11 | 84.4× | 10 |
| B | 100 | 2.88·10^12 | 715.0× | 81 |

Node capacity is a third wall: for identity records alone the network is "Short by 48× to 1,000×" (`docs/storage-substrate-split.md:153`); for archives it is UNVERIFIED. **Verdict: the 10^10 archive claim is NOT-RUN and infeasible on today's rails.** Archives are therefore optional and admitted by depth: admission per epoch is limited to what stated acquirable depth supports at a declared slippage. **Acquirable depth is UNMEASURED:** the table has supply and volume columns but no depth receipt, and "an unmeasured rail is not a usable rail", so P4 admits no one until a depth receipt exists. For scale only, and sized from supply, which ECON-DEPTH would refuse as an admission rule: 1% of circulating supply a year covers about 4.5·10^6 users at M = 10, case A (0.045% of 10^10). Yearly files and a per-user byte cap apply. The second failure domain does not depend on Autonomi: it is the user's own devices, their inbox or always-on device, and optional reciprocal holding at zero charge (§6.5). An unfillable swap means "archive waits", never message loss (`docs/dispatches/BUZZ_A_METERING_SPEC.md:118-127`).

### 8.8 Economic teeth (same job)

- **ECON-1** names the lawful funder shapes: an operator's own resource (B1 rule 2), member-pays under E3, and an optional capped sponsor grant. A planted unsigned "community pays all" funder must turn it red (B1 rule 3, `docs/dispatches/BUZZ_A_METERING_SPEC.md:107-108`).
- **ECON-2:** zero balance gives a named `FloorRefusal`; a planted auto-top-up is red.
- **ECON-4:** receipts are byte-scanned for plaintext, conversation ids and message hashes.
- **ECON-6:** an unfillable swap is refused by name while messaging continues.
- **ECON-7:** system-issued per-identity resource-token balances = 0; a planted genesis resource-token grant is red. Any gas float is left to the Rail C ruling (E17).
- **ECON-9:** a 1% provider over-count is convicted against the client tally.
- **ECON-R:** a third party holding only receipts and relay-signed states, with no plaintext, convicts an EXPIRED charge that has no linked refund.
- **ECON-CAP:** a grant past its ceiling is refused by the signer; a cap enforced only by a relay is convicted. It extends PQB-EXPIRY.
- **ECON-DRAIN:** a victim flooded with unsolicited traffic keeps an untouched balance and still receives revocations.
- **ECON-GAS:** an archive flush whose gas exceeds 50% of its value is refused; a planted per-message upload is convicted.
- **ECON-TOPUP:** a top-up whose fee exceeds 5% of its value is refused; a planted micro-top-up is convicted.
- **ECON-DEPTH:** a planted path that sizes archive admission from market cap or supply instead of acquirable depth, or that assumes a depth no receipt shows, is convicted.
- **ECON-RENEW:** a plan that renews per-user objects on raw L1 ($49.0M an era, §10.4) is convicted as over budget.
- **A2-SYBIL:** spawn 10^4 personas through one inviter; community-paid bytes gained per added persona must be 0; a planted welcome allowance is convicted; cost per Sybil and seed-cap consumption are reported apart from PQB-FORGE.
- **A1-ECON-8D:** a 10^2 to 10^5-client simulator keeps the BNR-paid quantity flat past the seed cap and past BNR's relay cap (N simulated joiners must leave it flat); a planted "seed stores a message" path is red.
- **Moderation at zero balance:** a moderator with zero balance completes a ban and its rekey within T_rekey.

### 8.9 Failed deliveries and refunds, audited without contents

- **Signed states.** Each delivery state (§6.2) is a relay-signed, content-free statement over a salted commitment, SHA3-256(salt ‖ event id), countersigned by the client. This needs a relay arm (E4).
- **Epoch receipts.** Per epoch the relay gives each member, privately, a receipt with a Merkle root and counts per state; aggregates state only counts, sums and roots (`docs/specs/SPEC-ZK-RECEIPT-AGGREGATES-1.md:18-23`).
- **Refunds** are linked negative line items via `Provenance.prior_receipt_id` (`crates/shared-types/src/spend.rs:141-145`).
- **Audit.** A third party holding the member's receipts and the relay's signed states, but no plaintext, can convict an EXPIRED charge with no refund (ECON-R).

---

## 9. Moderation and abuse

- Per community, relay-enforced: moderation kinds 9040-9044 and a moderator-only report queue; "reports are signals, never enforcement triggers" (`skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:356-358`).
- No universal reputation score (`docs/CONSTITUTION.md:107`); the kernel is blind, "That observability lives at the social layer or nowhere" (`docs/BIND-1.md:108`).
- No platform-safety operator for other communities; BNR answers for its own relays. A ban removes from that relay's cache, and the relay refuses the banned or pruned ids on its tombstone list, so they cannot be replayed (§6.3); device copies and sealed archives persist, and the UI says so. Private groups remove by rekey within T_rekey, even when the moderator's balance is zero (§4.3, §8.1).
- Illegal content on permanent rails is a counsel gate (E12); no public plaintext reaches Arweave or Autonomi.
- Agents never share a context between untrusted text and write authority (`LOVErnment-DAO/specs/AGENT-1.md:155`); no face or voice comparison, at any gallery size (`LOVErnment-DAO/specs/BIO-1.md:37`, `:43-44`).

---

## 10. 1,000-year continuity

**10.1 Registry and authority** (STRATA).

- **Records.** Append-only signed records `admit(id, family, params, kat_receipt, diff_receipt)`, `prefer(id)`, `retire_new(id, after T, evidence)` and `distrust(id, after T)`; no `redefine` ("New ids are ADDED, never redefined", `crates/bsigner/CONTRACT.md:39`).
- **Proposed registry gate (this draft).** Nothing reaches `prefer` without two independent conforming implementations on shared vectors, a rule inspired by DIFFERENTIAL in SPEC-BTUNGSTEN-PQ-1 (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:36-38`). Article VI's Proof gate is a different and weaker rule: ratification eligibility on "a written RFC ... plus a working reference implementation and passing tests" (`docs/article-vi-s3.md:15`), one implementation. Another implementation of the same FIPS standard gets its own KAT and DIFFERENTIAL rows.
- **Signer.** E23 default: no registry record of any kind until ruled; D6, D7 and D25 run on lab registries. Proposed under E23: a steward set (M-of-N) replaces a single one-press signer, so no single key can retire an algorithm or freeze the registry. Drill D22 removes the registry signer.
- **Authority-free trigger.** A NUMS secp256k1 canary: a public key derived by hashing a published string to a curve point, so nobody knows its secret. A valid BIP-340 signature under it is public proof of a break, and clients enter break mode without any signer. It detects only public breaks; a covert holder will not spend it. An ML-DSA canary needs its own analysis first, because a public key sampled from a hash may have no valid secret at all, which changes what a valid signature under it proves.
- **Families.** A second, non-lattice ongoing signer (an SLH-DSA small-signature set) and a second-family KEM (HQC once FIPS 207 is final) are admitted through the gate; bzDiD gains the signer through E22(a). The anchor-adapter registry holds at least 2 anchors in different hash families (§10.4).
- **Status.** L1 is RED by construction until E22 and E23 are ruled.

**10.2 Validity rule** (STRATA, both formats). `valid(record, t_v)` iff:

1. every component signature verifies, both halves of a composite seal included;
2. the card binds to the persona and bzDiD by a binding valid at signing;
3. every algorithm that attribution depends on is active at t_v, or evidence shows the attestation or seal existed before `distrust`, each renewal applied in time.

A failed signature or binding is **INVALID**; failing only (3) is **UNATTRIBUTABLE**. A verifier refuses a `K_CP` whose `c` or `h` does not match the cell, and every `K_CP` is OTS-stamped when it closes, directly or by including the persona's chain head in the stamped epoch evidence tree (§10.4). Settled `legacy-nostr` records depend on ML-DSA-65, SHA-256 and the binding, not secp256k1. A record first settled after `distrust(secp256k1)` therefore passes (3) but carries only a claimed time: it is **SETTLED-LATE**. That state is attributable to the author's PQ key, but its time is unproven; it is shown with the claimed date struck, and it never satisfies Tier-S, binds or payment intents. Claimed times are never evidence, and F6 makes the rule monotone. A composite seal stays attributable after one half's family is distrusted only while the other half's family is active at t_v. Journal order is optional evidence, or comes from the chain head (§3.4); set membership of ids in a window's range already shows omissions.

**10.3 Break mode** (fixes "NIP-01 forever"). A `distrust(secp256k1, after T)` record, signed under E23, or the public canary firing, switches everything:

1. Unsettled legacy records become UNATTRIBUTABLE after T. A living author may still settle ids from their own journal with an unbroken PQ key; those show SETTLED-LATE. A forgery made with a stolen key is not in the author's journal, so the author's own device can refuse to settle it, if the device is still the author's.
2. New authorship uses the **interim lane**: every new event carries its own `K_ATT`, readers require it, and D7's live pass moves to P2. When P7 lands, `bzm1` replaces it as the cheaper lane (§7.7 prices both).
3. Relays require `K_PQAUTH`, and each signs its identity proof with its bzpq1 card as well (§5.6).
4. Every persona closes final legacy checkpoints, in the security-critical class (§8.1).

**Local break evidence** (a fork of any device chain, an Unbound event or device index, an equivocation, or an event carrying one's own device index that one's journal does not hold; an event with a sibling's index that extends that sibling's chain is not evidence, §3.4) puts the affected persona, not the whole network, into suspect mode: its events display only with `K_ATT` coverage, its owner is alerted, and its owner may set `npub_compromised_since` (§2.2). Exposure at a surprise break is the unattested window, at most 8 days for an online device and longer for an offline one, and only for authors who can no longer settle.

**10.4 Re-anchoring.** Evidence records (§6.5) also cover genesis ops, binds and handovers, which answers the SHA-256 root (E22c).

- **Anchors.** OTS "holds while SHA-256 and the proof-of-work chain hold" (`docs/specs/SPEC-BPQ-1.md:122-125`). Bitcoin headers are SHA-256d, so D8 also removes this anchor, and the wallet's `.ots` files hold pending calendar promises the page does not verify (`.../notes/pq-tungsten.md:118`). So: an anchor-adapter registry with at least two anchors in different hash families (candidate: an EVM chain with Keccak-256 block hashing, such as Arbitrum One, already used for ANT payments; UNVERIFIED as an adapter); P0.e runs an OTS verify KAT against upstream proofs (NOT-RUN if absent) before any claim rests on OTS; D21 removes the OTS anchor, with a tooth convicting any verifier that accepts OTS-only evidence after `distrust(sha256)`.
- **Epoch evidence tree** (the epoch-notary pattern, `.../designs/economics-first.md:384`). Each user's evidence hash is included, claimant-paid, as a leaf in an epoch tree; the user keeps the Merkle path (34 levels, 1,088 B at 10^10 leaves). One root per epoch is stamped on both anchors, and one root per era is re-stamped before the anchor weakens and re-hashed under the successor before the hash retires (RFC 4998). Anyone may renew it: 52 roots a year at the raw L1 minimum cost $0.255.
- **Over budget by construction.** Renewing per-user objects on raw L1, where "a 300-byte record costs $0.0049" (`docs/storage-substrate-split.md:101`), would cost $49.0M an era; bundled per-user renewal at $32.56 per GiB would cost $621,033 an era and depends on one vendor (`:314`). ECON-RENEW convicts both.
- **Lapse.** The expected lapse fraction is the share of users who lose every copy of their Merkle path and archive. It is UNMEASURED; their records lapse to UNATTRIBUTABLE and stay readable. Dead authors are never re-signed for.

**10.5 Formats and the airgapped verifier.** Versioned magic, a frozen decoder per layout, trailing bytes refused (ADR 0085's pattern, `.../notes/critic.md:297`). A reader with the spec "can open and verify every object" (`docs/specs/SPEC-BPQ-1.md:9-10`). Verifier rungs: native `buzz-verify`; a zero-import wasm build (`.../notes/bnrose.md:75`); spec plus Cryptol plus a Daedalus grammar on the RB04 pattern (`crates/btungsten-bench/src/lib.rs:11-12`). `buzz-verify` runs under `unshare -n`, and strace counts zero `connect()` calls: the A11 property, "someone in 200 years holding an archived CAR with no working gateway must still be able to verify" (`docs/ledger/pirate-haul-rulings-2026q3.md:86`). OTS needs Bitcoin headers: 80 B × 144 × 365.25 = 4.21 MB a year (ARITH).

**10.6 Time (L4).** L4 requires crossing a boundary "with authority continuity intact and fail-closed before it" (`docs/specs/SPEC-BTUNGSTEN-1.md:140-144`).

| Field | Representation | Rule |
|---|---|---|
| Nostr `created_at` | JSON integer seconds | refuse beyond 2^53−1; ±900 s gate, with late events in the late table (§6.3) |
| relay `created_at` cast | `created_at.as_secs() as i64` (`skaists/buzz@e1035672:crates/buzz-db/src/event.rs:287`) | values ≥ 2^63 reinterpret as negative; the ingest drift gate refuses them; every other writer path is a test row at 2^63 and 2^64−1 |
| checkpoint `seq`, `range`; bind and charter `seq` | canonical decimal strings; `seq` = prev + 1 | refuse beyond 2^53−1, leading zeros, signs, exponents and jumps |
| bChat v1 `ts` | milliseconds | JS `Date` limit 8.64e15 ms |
| `bzm1` `at` | u64 seconds + `time_rep` | about 5.85e11 years; unknown `time_rep` refused |
| `bzm1` `key_epoch` | u32 | conversation re-genesis before 2^32−1 |
| bzDiD `validUntil` | "uint" unix seconds (`crates/bzdid/src/genesis.rs:14`) | the encoder and every consumer are tested across 2038 and 2106 |
| leases, delegations, grants, invites, prekey expiry, `fresh_until` | u64 seconds | an expiry that would cross a boundary refuses to exist: "at 29 days out a 30-day TTL refuses to exist" (`scripts/btungsten/README.md:427`) |
| OTS (Bitcoin `nTime`), Vaulta `time_point_sec` (if E3) | u32 | 2106-02-07T06:28:15Z (`docs/specs/SPEC-BTUNGSTEN-1.md:136-142`); evidence renews onto the second anchor before 2106 minus the renewal lead time |
| `time_t` in dependencies | i32 | 2038-01-19T03:14:07Z test row |

PQB-TIME-CROSS crosses 2038 and 2106 under a successor `time_rep`. The same bzDiD keeps signing, and evidence renews onto the second anchor. A client that wraps time and a client that refuses everything are both convicted.

**10.7 Mixed versions.**

- Read-all: "new versions must not break existing consumers" (`docs/CONSTITUTION.md:92`).
- Write-common: the newest suite every member advertises, never below the monotone charter `suite_floor` and never past `retire_new`. Only the owner or the stewards raise the floor.
- Named exclusion, never a silent fallback.
- Fork releases carry §3b signatures (`docs/specs/SPEC-BPQ-1.md:127-143`); upstreams are pinned and mirrored (`docs/ledger/pirate-haul-rulings.md:12`); kernel invariants change only by Art. VI §3.

**10.8 Extinction drills** (STRATA's program). PASS is stated before each run. Each drill has a positive control, because uniform failure means a broken probe. A drill receipt older than its cadence turns the row NOT-RUN in CI. Drills are labelled SIMULATED-EXTINCTION and their receipts are RUN-RECEIPTs (E30), printed "private-infra, not CI" where CI cannot host them.

| # | Dies | PASS | Control | Cadence / first |
|---|---|---|---|---|
| D1 | every estate DNS name | flow continues on charter roads within 5 min with the identity string unchanged; a QR invite joins | the name fails in the netns | monthly / P2 |
| D2 | every relay | no journaled message lost; members republish identical bytes to a charter-added replacement, which then serves them | ports refuse | monthly / P2 |
| D3 | x0x | human plane unchanged | 0 x0x processes | monthly / P2 |
| D4, D5 | Autonomi, Arweave | reads from the other store or devices; uploads refuse by name; evidence checks on the second anchor | client fails | quarterly / P4 |
| D6 | ML-DSA-65 (forgery from date B) | post-B ML-DSA-only attestations refused; pre-B evidence VALID; personas hand over to a card of another family | a verifier ignoring `distrust` convicted | each release / P0 (lab registry) |
| D7 | secp256k1, Ed25519 (Shor) | break mode: unsettled legacy UNATTRIBUTABLE; interim lane authorship; `K_PQAUTH` demanded | as D6 | each release / P0 lab, P2 on the deployed arms with a lab registry |
| D8 | SHA-256 | SHA3 renewal in time; a lapsed chain refused | lax verifier convicted | each release / P4 |
| D9 | reference client | the bChat JS surface reopens archive plus phrase, verifies, and **continues authoring** | non-canonical record refused | each release / P4 |
| D10 | the organization | phrase plus a paper list of bundle addresses verifies offline; a new community starts elsewhere | no BNR endpoint | annual / P4 |
| D11 | clock representation | nothing wraps at 1970, 2038, 2106, 2^53, 2200 | WB004 naive encoder convicted | each release / P0 |
| D12 | Vaulta | messaging unaffected; spend refuses by name | RPC fails | quarterly / P8 |
| D13 | WebAuthn RP domain, captured | r1 recovers; the captor gains no messaging authority and decrypts 0 recorded DMs and 0 bundles sealed before capture | captor origin served | annual / P2, red until E22 |
| D14 | upstream Buzz, x0x | reproducible build from the pinned mirror | upstream 404 | annual / P2 |
| D15 | relay software | a second implementation with the allowlist and late table serves the same settled history; its accept and reject trace is checked by the independent buzz-conformance checker (`skaists/buzz@e1035672:crates/buzz-conformance/src/lib.rs:1-14`); owner: the Buzz fork lane | relay without the arms | quarterly / P2 |
| D16 | the user's inbox operator | one bind update moves the user to another inbox; no journaled message lost | inbox refuses | quarterly / P3 |
| D17 | the push gateway | delivery continues by fetch and on open; one signed road-policy entry names a replacement | gateway 404 | quarterly / P3 |
| D18 | ML-KEM-768 (a lattice KEM break, with Shor also assumed) | permanent archives stay closed (second-family wrap, or device-only); new objects move to a second-family slot; the receipt lists recorded X-Wing-only traffic as exposed, the stated residual | a single-family permanent upload convicted | each release / P0 lab |
| D19 | SHA3/SHAKE | evidence renews under the successor hash; ids and seals move by a new suite (F5) | a verifier accepting a retired hash id convicted | each release / P0 lab |
| D20 | AES-256-GCM | new objects use the successor `aead` id; old objects stay readable | unknown `aead` defaulted, convicted | each release / P0 lab |
| D21 | the OTS anchor (SHA-256d) | evidence verifies on the second anchor | OTS-only evidence after `distrust(sha256)` convicted | each release / P4 |
| D22 | the registry signer | the steward set signs; the canary still triggers break mode | a single-signer registry convicted | annual / P2 (lab registry) |
| D23 | a charter owner key | the steward threshold recovers from a named fork point; the losing branch is kept as evidence | owner signature withheld | annual / P2 |
| D24 | charter `seq` space | a jump to 2^53−1 is refused; ordinary updates continue | a seq-jump accepted, convicted | each release / P2 |
| D25 | ML-DSA-65 and secp256k1/Ed25519 together | personas hand over by SLH-DSA to cards of a surviving family; break mode runs on the second signer | a v1 handover to an ML-DSA card after `distrust(ml-dsa-65)` convicted | each release / P0 lab |
| D26 | a storage provider (D4′) | migration to another provider with evidence unchanged: content hashes plus at least 2 locators on the paper list | an address-keyed receipt convicted | quarterly / P4 |
| D27 | a settlement adapter (D12′) | another adapter settles; refunds and `FloorRefusal`s reconcile | a hardwired adapter convicted | quarterly / P4 |
| D28 | an agent host (E5-ruled branch only) | host-incident rotation: new host seed, owner re-endorsement, old keys revoked | old host key still accepted, convicted | quarterly / P1b |
| D29 | the largest voucher provider | users redeem and move; delivery continues | provider endpoint 404 | quarterly / P4 |
| CT | D1 to D29 in sequence | the airgapped verifier counts VALID, SETTLED-LATE, UNATTRIBUTABLE, INVALID, LOST | a planted irreplaceable dependency must turn CT red | annual / P7 |

---

## 11. Tungsten conformance matrix (receipts to earn; none claimed)

**Result classes.**

- Classes defined in SPEC-BTUNGSTEN-1 (ruled): TYPECHECK, CHECK-SAMPLED, PROVE-UNIVERSAL, EQUIVALENCE (`docs/specs/SPEC-BTUNGSTEN-1.md:269-275`).
- Classes defined in SPEC-BTUNGSTEN-PQ-1 (status DESIGN, `docs/specs/SPEC-BTUNGSTEN-PQ-1.md:3`): KAT, DIFFERENTIAL, INHERITED (`:32-41`).
- Proposed here, not ruled (E30): RUN-RECEIPT, for runs that CI cannot host, printed "private-infra, not CI". Drills are labelled SIMULATED-EXTINCTION.

Criteria are named before any run (`docs/specs/SPEC-BTUNGSTEN-1.md:420-427`); NOT-RUN is never PASS; every gate has a planted flaw in the same job (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:42-43`).

| Axis / law | Test family | Pass / fail (named now) | Class | Teeth |
|---|---|---|---|---|
| 1 Decentralization | PQB-REMOVE and A1-REMOVE: block every road's DNS, remove the edge, stop BNR's seed, delete the profile, remove the user's inbox operator and the largest voucher provider, build from the mirror (`docs/dispatches/2026-10-13-bnr-dns-independence-routing.md:52-57`) | PASS: from invite material alone a clean client reaches the same community through a replacement relay that members re-seed by republishing, reads settled history and posts once. FAIL: any step needs BNR, the original name, the profile or one provider | RUN-RECEIPT, private-infra, not CI | a non-charter relay key refused before AUTH; a client hardcoding one hostname fails the run |
| 2a Forgery | PQB-FORGE: an nsec holder (quantum stand-in) publishes events and binds, replays checkpoints across cells and equivocates; a stolen-nsec forger; a backdated post-distrust settlement; a relay withholding a pinned contact's bind | PASS: 0 forgeries shown Settled; every stolen-nsec forgery shown Forked or Unbound by the author's next post or next daily `K_CP`; unendorsed binds never adopted; a backdated settlement shown SETTLED-LATE; the withheld bind gives `PQ_PIN_DOWNGRADE` | RUN-RECEIPT + CHECK-SAMPLED | a verifier accepting an unlisted id convicted; a backdated settlement shown VALID turns the run red; a client that silently falls back convicted |
| 2b Key theft | PQB-DEVTHEFT (one device card and its seed), PQB-NPUB-THEFT (the npub, as held in host environment) | PASS: no eviction of other devices and no recovery or owner change succeeds without the recovery card or k-of-n; every CONTESTED change alarms every pinned device; `npub_compromised_since` takes effect at every reader within 24 h | RUN-RECEIPT | a client adopting a first-seen eviction convicted |
| 2c Confidentiality over time | PQB-ROOT-THEFT, FS-1, PCS-1 (§4.2) | PASS: a holder of the phrase, a PRF output and the archive key opens 0 recorded P5 and P6 objects (archive and journal openings reported as a count); a device thief opens 0 objects sealed to erased prekeys; after card retirement and fresh prekeys a former compromiser opens 0 new objects (in P7, within one ratchet step) | RUN-RECEIPT + CHECK-SAMPLED | an archive slot convicted; seed-derived prekeys convicted; a static-key implementation convicted |
| 2d Relay and road attacks | PQB-DOWNGRADE, PQB-ROADSPOOF, PQB-REPLAY-1059, PQB-STALE, PQB-FAKEACK, PQB-WITHHOLD | PASS: no suite below the floor without a named refusal; an impostor copying NIP-11 and a split-view relay leave the UI "not connected"; a replayed pruned 1059 and a backdated fresh 1059 refused, an outbox re-wrap accepted; a withheld revocation shows STALE or a bind-hash mismatch within `fresh_until`; a relay that acknowledges and drops gives 0 HELD-VERIFIED and an alert within 10 minutes; a withholding relay or inbox exposed as WITHHELD within 24 h given a second source, and an honest-relay control gives 0 false WITHHELD | RUN-RECEIPT | an unsigned refusal treated as terminal convicted; a relay without tombstones convicted |
| 2e Metadata and Sybils | PQB-LINK (M1, M2, M3; §4.6); A2-SYBIL (§8.8) | measured values reported with planted correlators; community-paid bytes per added persona = 0. Uniqueness and unlinkability: NOT-RUN (no TAM) | RUN-RECEIPT | a planted log join must be detected; a planted welcome allowance convicted |
| 3 Healing | PQB-HEAL: kill -9 at every outbox step, corrupt a replica, partitions of 15 minutes, 8 days and 30 days, withhold a checkpoint | PASS: 0 duplicates; identical bytes; replica rebuilt; gaps UNKNOWN; 0 events left LATE-REFUSED after the long partitions; the outage printed ("autonomous healing cannot be used to conceal unacceptable service interruption", `docs/dispatches/2026-10-13-btmd-scale9-study.md:115-117`) | RUN-RECEIPT; the buzz-db fence tests in CI | a re-sign-on-UNKNOWN worker convicted; a late write into a channel-window row convicted by the fence tests in the same job |
| 4 Learning | PQB-ROADMEM | learned road choices never leave the charter or lower a suite; logged, reversible | CHECK-SAMPLED | poisoned memory refused |
| 5 >10B | PQB-SCALE: the §7 bounds; the §7.6 ladder with the agent-heavy rung, the community-wide channel and a simulated distrust | per rung: bytes per persona-day within 1.2× of Appendix A; the §7.5 budgets; the locality slope; the backlog drained within §7.7's caps | RUN-RECEIPT per rung; the simulator's output is a RUN-RECEIPT, never a ruled class | a planted global topic convicted; a model fed n = 0 refuses; a client showing unverified pre-switch messages as attributed convicted |
| 5m Mobile | PQB-MOBILE: p50 and p95 time to device with push on and off; bytes and radio wakes per phone-day; the L5 handshake inside the iOS background window | PASS named now (ASSUMPTION): p95 ≤ 60 s with push on, ≤ the OS fetch interval + 60 s with push off; bytes within 1.2× of §7.4; the handshake completes inside the window. Without the P0.b phone row: NOT-RUN | RUN-RECEIPT, private-infra, not CI | a build holding more than one connection per phone convicted |
| 6a Continuity: drills | D1 to D29, CT (§10.8) | §10.8 | SIMULATED-EXTINCTION, RUN-RECEIPT | each drill's control fails; a receipt older than its cadence turns the row NOT-RUN |
| 6b Continuity: formats | F5, F6, F10 | the obligations below | PROVE-UNIVERSAL | T-VACUOUS, T-TRUNCATE |
| 6c Continuity: algorithms | KAT and DIFFERENTIAL rows for every admitted id, the second-family signer and KEM included | every case executed and counted | KAT, DIFFERENTIAL | the registry gate refuses a single-implementation `prefer` |
| 6d Continuity: verifier | `buzz-verify` under `unshare -n` | 0 `connect()` calls | RUN-RECEIPT | a verifier that calls out convicted |
| L1 | D1 to D27 and D29, with D28 in the E5-ruled branch (names, relays, x0x, keys, signer sets, algorithms, clock representation, contract and relay implementations, chains and anchors, organization, interface, inbox operators, push gateways, storage and settlement providers) | the same bzDiD and the same history classification after each extinction | SIMULATED-EXTINCTION | **RED by construction until E22 and E23**; a planted dependency on the original name, key, signer set, registry signer, anchor or charter owner turns the composite red |
| L2 | PQB-EXPIRY, ECON-CAP | endorsements and grants over the policy maximum refused; expired shown expired; grants enforced by the key-holding signer | CHECK-SAMPLED | a grant without `expires`, or with a 1,000-year one, refused; a relay-only cap convicted |
| L3 | PQB-BOUND | no population-keyed object; community state flat as N grows | RUN-RECEIPT | a planted global roster convicted |
| L4 | PQB-TIME (§10.6), PQB-TIME-CROSS | boundaries refused, never wrapped; across 2038 and 2106 under a successor `time_rep` the same bzDiD signs and evidence renews onto the second anchor | PROVE-UNIVERSAL (encoder) + CHECK-SAMPLED | a truncating encoder convicted (WB004); a wrapping client and a refuse-everything client both convicted |
| L5 | PQB-BOOT (§5.6) | "connected" only after AGREEMENT against an independent source, with IDENTITY proved by a nonce signature | RUN-RECEIPT | a relay never serving the persona's head keeps the UI "not connected"; an impostor copying NIP-11 refused |
| Economics | the ECON battery, A2-SYBIL and A1-ECON-8D (§8.8) | as listed in §8.8 | RUN-RECEIPT (simulator) | each planted subsidy, cap breach and over-budget path convicted |

**Formal obligations** (WB001 ladder; "No step substitutes for a later one", `docs/specs/SPEC-BTUNGSTEN-1.md:285-295`; deployed language only, `:278-283`):

- **F1** `nip01SerInjective`: strict UTF-8, deployed escapes, no exponents. The bChat "0" marker bug is the RED precedent (`docs/specs/SPEC-BCHAT-1.md:104-109`).
- **F2** `cpCodecInjective`, n ≤ 1,519.
- **F3** `domainsDisjoint` over `bpq1/` (14 labels, then 15) and `bzm1/` (8).
- **F4** the equivocation and fork detector over chain tags.
- **F5** `bzm1` injective, decode∘encode = identity (SAW), a Daedalus grammar equal to the decoder, and the hash id bound into the suite.
- **F6** validity monotone, SETTLED-LATE included.
- **F7** time encoders fail closed.
- **F8** card-reference expansion lossless.
- **F9** `sealBindsChain`.
- **F10** `compositeNonSeparable`: no valid seal is formed from halves of two seals; teeth strip a half, swap a half for another key's, and relabel the suite.

Teeth: T-VACUOUS (n = 0, an empty card set, attestation, seal, registry, grant) and T-TRUNCATE (last byte changed at n ∈ {1, 2, 3, 1,023, 1,024}, at 135 to 137 and 271 to 273 for SHA3-256, at 55 to 56 and 63 to 65 for SHA-256) (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:86-113`).

---

## 12. Migration from today's Buzz

1. **M0, anchor now (P0.d, read-only).** Inventory Hostinger's relay image digest, event counts by kind and author, media, and the 18 agents' npubs and owners (the image is UNVERIFIED, `.../notes/buzz.md:17`). Export read-only, pack a `bnr-archive` batch, take SHA-256 and SHA3-256 roots, OTS-stamp them; only the root leaves the box, while BIP-340 holds.
2. **M1, roads (P0.a).** Desktop road lists and the media rewrite; the rebuilt buzz-acp, rolled out one agent at a time with rollback, whose refusal rule stops on a refusal only when every road refuses alike for 10 minutes, and then with an alert (§3.6); buzz-cli unchanged against the real relay plus a road-list flag. AUTH, origin and kinds are unchanged, so no agent changes identity.
3. **M2, relay deploy (P2; founder word after a DB snapshot).** Kinds, the late table, relay identity proofs and signed refusals, the `K_PQAUTH` arm, grant-scoped reads. Founder-device binds wait for E6 (P3); each is then "a link plus one press" (seat memory, not in repo).
4. **M3, retroactive checkpoints.** Humans checkpoint ids from their own export: "attested at T_now, before any break", never "at send time"; the OTS stamp, once verified (§10.4), bounds the attestation time. Agents keep no state (`.../notes/buzz.md:64`), so their ids are read from the relay, Schnorr re-verified and attested by the owner's device as **observed-attested, pre-break**, never upgraded.
5. **M4, archives (optional, depth-gated).** The estate's own history goes to ANT, paid by the consuming account, under the two-family wrap rule or device-only; acceptance is the relay-shutdown drill.
6. **M5, M6.** The PQ-private lane (P5, P6, after E2), then native (P7). The legacy road retires only on a founder-set date after D2 passes and every member reads `bzm1`; legacy history stays readable; authorship is never rewritten.

---

## 13. Build plan

Seat 1 assigns; owners are suggestions. Every acceptance is a receipt computed from observations; "CI's verdict on the landing commit" is the receipt where CI applies (`docs/RULINGS-2026-08-26.md:48-52`).

| Phase | Owner | Reuses | Acceptance (receipts) | Unblocks |
|---|---|---|---|---|
| **P0.a** roads (no ruling) | Buzz fork lane (zCode desktop) | MULTIRELAY §roads, b-onboard rungs 1-2, the live alias | unit tests (roads, failover and refusal classes, media SHA-256); per-road connect receipts with the TLS group (§5.7); a building-network drill with `skaists.buzz` reset: desktop and all 18 agents cold-start with **0 manual actions**, each agent reports "road 2, rung 1" and its time to connect; a planted captive-portal refusal on one road stops no agent | the outage class closed |
| **P0.b** numbers | btungsten lane | btungsten-bench, btungsten-pq | the §7.5 lane with teeth, including **one phone** (mandatory; without it every mobile line is NOT-RUN), the sign-twice row and a relay connections lane; Appendix A as a CI-tested calculator crate | every CPU and box line |
| **P0.c** specs, vectors | bChat lane + Claude Code seat | SPEC-BCHAT-1, bpq.js, frozen `bsigner bpq-verify` | a §pq addendum (chain tag, daily `K_CP`, weekly `K_ATT`, private heads, prekeys, suite advertisement); card v2 with `alg`; CI: JS checkpoints and card-reference attestations verified by bsigner after expansion (DIFFERENTIAL); the `bzm1` spec with the hash id in the suite, Cryptol, a `no_std` codec, vectors; F1, F2, F5, F10 at RED | P1a, P7 |
| **P0.d** anchor now | box seat (Hostinger in scope) | bnr-archive | the M0 inventory; manifest digest and `.ots` | pre-break evidence |
| **P0.e** evidence, verifier | Claude Code seat | bnr-archive, bpq-core | `buzz-evidence` (dual hash, OTS parse, an OTS verify KAT against upstream proofs, NOT-RUN if absent, before any claim rests on OTS, the anchor-adapter registry, §10.2 with SETTLED-LATE) with teeth; `buzz-verify` with 0 `connect()` | D4 to D10, D21 |
| **P0.f** time, algorithm drills | btungsten lane | btungsten-wb004, btungsten-teeth | D11; D6, D7, D18 to D20 and D25 on lab identities and lab registries; no ruling needed. Enabling live break mode is a separate gate after P0.f and requires E23 ruled | break mode, once E23 is ruled |
| **P0.g** economics simulator | Claude Code seat | `SpendReceipt`, voucher-escrow (simulator only) | the §8.8 battery green, each planted subsidy convicted in the same job, A1-ECON-8D including the BNR relay cap | E3 switch |
| **P0.h** x0x data | x0x lane | the 9-node WSL rig | synthetic machine plane only: owner-private idle bytes, stream shedding, dial-by-hint | E1, E1b with data |
| **P0.i** upstream kinds | Buzz fork lane | — | the SPEC-BPQ-1 §5b carriage ask filed upstream; a recorded grep of upstream main at a fetched sha for 37100, 47100 to 47108, 22100 and 22101 | P2 |
| **P1a** human journals | ZCode seam + PQ lane | `ReplicatedJournal`, bpq.js helper | `buzz-outbox`: exact bytes fsynced, chain tags, daily `K_CP` built and OTS-stamped, plaintext re-seal at receipt; kill -9 per step, 0 duplicates; PQ attestation on lab identities only until E6 | P2, P3 |
| **P1b** agent checkpoints (E5, E7, E8) | ZCode seam + PQ lane | as P1a | under the E5 default: owner-device observed-attestation (on lab identities until E6, as P1a), 24 h agent windows, per-event Tier-S; grants with ceilings enforced by the harness signer (ECON-CAP); in the E5-ruled branch, D28 | P2 |
| **P2** relay, charter, L5 (founder word) | Buzz fork lane + box seat | kind arms, the late table, `K_RID`, the `K_PQAUTH` arm, grant-scoped reads | DB snapshot; the buzz-db fence tests green in the same job; PQB-REMOVE; a bad key, a lower seq and a jumped seq refused; L5 with the nonce IDENTITY proof; PQB-HEAL with 8- and 30-day partitions; PQB-REPLAY-1059, PQB-ROADSPOOF, PQB-FAKEACK, PQB-STALE; D1 to D3, D7 on the deployed arms with a lab registry, D13 to D15, D22 to D24 | DNS independence |
| **P3** devices, inboxes, ρ = 2 (E6) | Buzz fork lane + kc/integrate | desktop bpq.js, wallet press | binds per device under the §2.2 rules (PQB-DEVTHEFT, PQB-NPUB-THEFT); the inbox under its own key with a grant; D16, D17; PQB-MOBILE; HELD by 2 when E26 allows | §2.4 for humans |
| **P4** archives | ANT pay lane | ant-pay.js, BNRoSe op | depth-gated admission (ECON-DEPTH); the flush rule; the two-family wrap rule or device-only; a rebuilt relay re-verifies 100% of settled checkpoints; ECON-1 red on the planted funder; gas measured per payment (ECON-GAS); D26, D27, D29 | pay-once-now for those admitted |
| **P5** PQ DMs (E2) | bChat lane | X-Wing slots, prekeys | cross-implementation vectors; FS-1; PQB-ROOT-THEFT; sealed checkpoints and private heads; remote mode visible; the 29-slot cap | PQ DMs |
| **P6** groups, readiness (E2) | bChat, PQ, fork lanes | group slot, `K_PQG` | the 15-label proof; encrypt and decrypt receipts; the joiner and heal tests; a zero-balance moderator's rekey within T_rekey | 256-device groups |
| **P7** native `bzm1` (founder word) | bChat + PQ lanes | the P0.c codec | `K_BZM`; handshake, KEM ratchet (PCS-1), header-scan and PQB-LINK receipts; the 10^4-stranger spam drill; CT | the cheaper break-mode lane |
| **P8** ruling-gated | per ruling | — | each lands with its ruling: E1b, E3, E12 to E15, E26, E28 | — |

P0 adds no bsigner command, no chain contract, no spend, and touches no frozen file and no relay.

---

## 14. Open questions and risks

1. **The live lane is heavy:** 1.8× to 3.9× classical bytes per copy (bpq1 JSON inside NIP-01 JSON, a chain tag on every event, daily checkpoints). The native lane is about classical before a break and 1.4× to 7.9× in break mode; it is a cost reduction against the interim lane, not a fix.
2. **The bounded window costs bytes:** dropping the 30-day extension raises sender settlement in low-rate cells (5,741 B per channel message at M = 1), and the daily checkpoint roughly doubles a low-rate channel copy.
3. **Stolen nsecs before a break:** the window between a forgery and its exposure is the author's next post or next daily checkpoint, and up to 8 days for an online device before attestation; readers check Schnorr only until then.
4. **Late delivery** is a proposed fix, untested: a separate late table that never touches channel-window rows. A member can still insert events dated up to `late_days` back, and, through a self-made OTS-stamped `K_CP`, their own events with any older claimed date; online clients flag them and show the stamp time.
5. **Trust on first use:** a first pin needs two roads and an OTS proof; post-break newcomers rely on OTS on Bitcoin's u32 time and on the second anchor.
6. **Confidentiality limits:** no forward-secrecy or post-compromise claim before FS-1 and PCS-1; prekey retention is 21 days (E29); no PQ confidentiality above 256 devices; channels are never end-to-end; recorded X-Wing-only traffic is exposed if both lattice and classical assumptions fall (D18); the phrase opens archives and journals until E22 separates the archive key.
7. **Metadata:** relays and inbox operators see who talks to whom and when; NIP-42 links every `bzm1` fetch to an npub; M1 to M3 are unmeasured.
8. **Scale is federated, not demonstrated:** about 10^6 communities must fund relays, a market that may not exist; box capacity, box price and chunk price are CLAIMED or one-date; bandwidth binds once channels pass about 5,800 members; agents can dominate the load.
9. **Archives at 10^10 are infeasible on today's rails** (7.4× to 715× circulating ANT a year); devices stay the record.
10. **Dependencies:** the fork is 354 commits behind upstream; there is no Rust X-Wing sealing (bsigner seals only "self", `docs/specs/SPEC-BPQ-1.md:3-6`); "JS signing is not claimed to be constant-time" (`:272`); ml-dsa 0.1.1 is unaudited; Hostinger's Postgres durability is UNVERIFIED.
11. **Readings** E2, E3, E5, E6, E7, E9, E28 and E29 could be ruled the other way; each has a switch. x0x stays machine-plane only unless E1b is ruled.
12. **The identity root** (E22) has three defects this design routes around but cannot fix; until E23 is ruled, no registry record of any kind can be signed, and L1 stays red.
13. **Several devices under one npub (resolved by per-device chains, §3.4; residual):** before E6 an npub thief can add a device index; rule 2a (§2.2) makes the addition loud on every pinned device but cannot refuse it. Device cards (P3, after E6) turn detection into refusal.
14. **Accessibility and voice (§7.9):** no messaging accessibility requirement or test family exists; huddles stay classical and server-forwarded; transcripts wait for E24.

---

## 15. Provenance and corrections (judge round)

| Finding (judge) | Fix |
|---|---|
| BESIDE: the drift gate breaks healing; its relay-replacement row needs stock relays to carry new kinds; NIP-01 record forever (tungsten) | a late path, LATE-REFUSED (§6.3, rebuilt in the attack round around the commit-time floor); D15 allowlist; the `bzm1` record and break mode (§3.1, §10.3) |
| BESIDE: per-author checkpoint and k = 6 hide reader cost; flush rule against the cost table (scale) | per-cell checkpoints, the delivered-copy model, lazy readers, card reference (§3.4, §7.2); one flush rule (§6.5) |
| BESIDE: "unchanged" harness, agents' "own export", ungated relay deploy, B1 `:104-105`, R4/Q-5/VENDOR-HELD stretched, report quote (build, law) | a rebuilt harness with rollback; the observed-attested label (§12); E4; `:105`; E6, E7, E15; the exact `skaists/buzz@e1035672:crates/buzz-relay/src/handlers/ingest.rs:356-358` |
| STRATA: `bsigner sign` seals, hidden relay change, ungated retirement, unsealed authority, unauthenticated handshake, lease durable ack, verify ×k, 5 s window, transcripts; `:86`, `:426`, `lib.rs:12-13` (all) | client-library seals, `bzm1/seal`; E4; a founder date; Tier-S; a sealed handshake; §2.4 on user stores; per-copy verifies; bounded windows; E24; `:87`, `:427`, `:11-12` |
| mesh-native: "PASSED by construction", law-file vehicle, `E_STEP_ADMITTED` cite, saorsa-mls as X-Wing; METABOLIC: "on estate iron" quote, LINK size, tithe tension, sent-weighted averages, O(n²) rekey | NOT RUN (§8.6); E10; dropped; no MLS claim; the quote and sizes not grafted; E20; delivered-copy weighting; per-device wraps |
| planet-scale: checkpoint constant, MeshSecond, L3 forwarding, id without epoch, ORIGIN silent, "seed load 0"; buzz-cli is HTTP (build) | not used; E19; E16; `key_epoch`; E9; the seed cap (§8.5); no facade (§3.6) |

The attack round's 70 findings and what changed for each are in §16.

---

## 16. Revision log (attack round)

All 70 findings were CONFIRMED, CONFIRMED-ALT or PARTIAL, and every one was applied; none was rejected. Merged findings point to the row that carries the change. New drills are numbered centrally, D16 to D29 (§10.8).

| Finding | Verdict | Change made |
|---|---|---|
| PQ-1 | CONFIRMED (ADV-02 merged) | No archive slot, self slot or card-kem target on any message lane; P5 slots go to device prekeys only (§2.1, §4.1). The recovery role moves to receiver-side re-seal into the journal, replicated to the second failure domain, with the residual loss window stated (§2.6). Archive wording names the phrase and the passkey PRF (§2.1, §6.5). PQB-ROOT-THEFT replay tooth (§4.2, §11); D13 PASS gains confidentiality (§10.8) |
| PQ-2 | CONFIRMED (ADV-08 merged) | PQ-EPOCH (§4.2): weekly OS-RNG prekeys attested by the existing `bpq1/nostr-event` statement; P5 retargeted; P6 per PQ-8; P7 two-sided KEM ratchet with ephemeral secrets erased (§4.1); FS-1, PCS-1 (§11); E29 escalates "never orphan data" and prekey retention against `cache_days`; "keys that change every epoch" withheld until receipts; prekey cost priced (§7.8) |
| PQ-3 | CONFIRMED (ADV-06 merged; ADV-05 overlaps) | Per-cell chain tag inside the id (§3.4); forks, Unbound events, equivocation and unknown own-npub events are local break evidence that triggers suspect mode (§10.3); window bounded by time, no 30-day extension (§3.4); the summary (For the founder) and §0 rewritten; E23 a precondition of live break mode after P0.f and of D7 on a live registry, leaving P0 ruling-free as the brief requires (§1.2, §13); `npub_compromised_since` under the rank rules (§2.2); PQB-FORGE stolen-nsec tooth (§11) |
| PQ-4 | CONFIRMED (ADV-01 merged) | `K_BIND` v2 rank rules (§2.2): device cards act only on themselves; evictions and recovery or owner changes need the recovery card or k-of-n, enter CONTESTED with a 72 h veto and alarms; recovery-card evictions take the notice window until E22(b); mandatory `charter` and `seq` = prev + 1; a lower seq refused; newcomers pinned on two-road agreement plus OTS; E25 rewritten (§1.2) |
| PQ-5 | CONFIRMED (ADV-11 (b) to (d) merged) | §4.4: sticky per-contact pin with `PQ_PIN_DOWNGRADE`; suite floor = max(prefer, highest seen); in-band suite advertisement; a relay in a PQ-declaring charter that drops the kinds is a FAULTY road (§3.2); pq-seen high-water alarm; first pin needs its OTS proof; PQB-FORGE refusal tooth |
| PQ-6 | CONFIRMED | Ed25519 key bound in `K_BIND`, Schnorr-signed and OTS-stamped (§2.1, §2.2); M = `"bzm1/seal"` ‖ suite ‖ SHA3-256(all non-signature fields); both halves required, "either half" only for attribution under §10.2 rule (3) (§3.5, §10.2); F10 with strip, swap and relabel teeth (§11) |
| PQ-7 | CONFIRMED | §5.7: per-road, per-rung receipts of the negotiated TLS group, X25519MLKEM768 (0x11EC) recorded as hybrid, classical roads labelled "classical transport", not refused. Parts (2) and (3) merged into C5-08 |
| PQ-8 | CONFIRMED | §4.3: OS-RNG epoch keys; rekey on join, on leave or ban within 10 minutes, and weekly; wraps to current prekeys; deletion at epoch end + `late_days`; lowest SHA3(wrap set) wins; join and weekly rekey bytes in §4.3, §7.2 and §7.8; joiner and heal tests |
| PQ-9 | PARTIAL (LAW-06 merged) | §3.4 and §10.2 rules: a `K_CP` with mismatched `c`/`h` is refused; every `K_CP` OTS-stamped on close; SETTLED-LATE (attributable, time unproven, never Tier-S, binds or payment intents, claimed date struck); journal order optional, or from the chain head |
| PQ-10 | CONFIRMED | §3.3: hedged ML-DSA (and Ed25519 where supported) for every device and harness signature, deterministic only in vector mode; P0.b sign-twice row (§7.5, §13) |
| PQ-11 | CONFIRMED | E5-ruled branch only (E5, §2.3): host wording, owner endorsement attested by the recovery card, owner co-attestation of agent Tier-S acts, host-incident drill D28 |
| F1 | CONFIRMED-ALT | §2.4: a Stage-1 per-user inbox under its own key, with a user-issued, read-scoped, expiring, per-community `K_GRANT`, never the user's nsec; mailbox, journal second failure domain, one phone connection, content-free wake; listed in `K_BIND` and contact cards and replaced by one bind update; own always-on device as the free path; D16; inbox forms and the one-connection budget in §7.4 |
| F2 | CONFIRMED | §7.4: connections over C ∈ {1, 1.5, 3}, ρ_read ∈ {1, 2}, 5/10/30% and a ∈ {0.1, 1, 5}; one cost basis everywhere; relay `K_PQAUTH` verifies per second per box in §7.5; both inbox fan-in forms |
| F3 | CONFIRMED | An agent row (a ∈ {0.1, 1, 5}, 100% concurrency, M_a = 10, channel fan-out) through §7.1, §7.2 (cases C to E), §7.4, §7.5 and §7.7; agent relay connections metered to the owner bzDiD (§8.1); an agent-heavy rung (§7.6) |
| F4 | CONFIRMED | A heavy-tailed channel distribution (case B); the R × D sensitivity table and the crossover at about 5,800 members; the community-wide channel at 10K + 50K; pull-based reads with reader-paid egress (§7.2); a PQB-SCALE rung (§7.6) |
| F5 | CONFIRMED | On-demand `K_ATT` chosen, background prefetch priced as an option (§3.4, §7.2); new §7.7 break-mode transition (backlog, drain caps, interim lane, `K_PQAUTH`); PQB-SCALE simulated-distrust tooth (§7.6, §11). The same principle applied to private-lane checkpoints (one attested private head a week) |
| F6 | CONFIRMED | The calculator is Appendix A and reproduces the draft's native figure (2,343.5 B); native n per lane (§3.4); native rows restated (§7.2); channel seals aggregated per persona and community and fetched lazily before a break (§3.5); "native is the fix" removed (§7.2, §14) |
| F7 | CONFIRMED | Per-lane n̄ and t_v budgets, binding at 0.50 ms on channels at M = 1 (§7.5); a phone row mandatory in P0.b, or every mobile line NOT-RUN (§7.5, §11, §13) |
| F8 | CONFIRMED | Flush at 3 full chunks (and at most monthly, so heavy users do not pay more often than before), or at 12 months (§6.5): 3 chunks a year at M = 1 instead of 36; the device-only window covered by the second failure domain; a payment-overhead column (gas up to 44.5% of a small flush) and ECON-GAS; archive payments counted in §8.4 |
| F9 | CONFIRMED (ECO-10 merged on plurality) | §8.4: voucher sizing, a $0.169 minimum top-up at fee/value ≤ 5% (ECON-TOPUP), top-ups per second at 10^10; E3 at 10^10 feasible only through vouchers (E21) |
| F10 | CONFIRMED | `K_BIND` sized for D = 1 to 4, full and card-reference with `K_CARD` (§2.2, §7.8); a churn table with binds, card fetches, 90-day resync and device-change rekeys (§7.8); D carried through §7.2 to §7.4 |
| F11 | CONFIRMED | PQB-MOBILE (§11); the content-free wake sent by the inbox, gateways replaceable by a signed entry (E15, §2.4); push-gateway drill D17 (§10.8) |
| F12 | CONFIRMED | The 586 B classical baseline throughout §7.2; ratios restated from Appendix A (the draft rows reproduce as 2.99×, 2.73×, 2.25×; the revised live lane is 1.8× to 3.9×) |
| ECO-1 | PARTIAL | Metering unconditional, with zero-charge receipts naming the consuming member (§8.1); payer of record a named operator account, never "community", never BNR beyond seeds and its capped relay; ECON-1 scoped to the lawful shapes with a planted unsigned "community pays all" funder (§8.8); zero funds always `FloorRefusal` |
| ECO-2 | CONFIRMED | §8.7 depth table (supply multiple, years of volume, node capacity); the 10^10 archive claim NOT-RUN and infeasible; second failure domain = devices, inbox and reciprocal holding at zero charge (§6.5); depth-gated admission, yearly files, a per-user cap; ECON-DEPTH tooth |
| ECO-3 | CONFIRMED | A signer-enforced `grant` object, Tier-S, with per-class ceilings per epoch (§8.1); a ceiling column in §8.1; ECON-CAP extending PQB-EXPIRY |
| ECO-4 | CONFIRMED | §8.9: relay-signed, content-free delivery states over salted commitments, client countersigned; a Merkle root and counts per epoch; refunds as linked negative items via `prior_receipt_id`; aggregates under SPEC-ZK-RECEIPT-AGGREGATES-1; ECON-R |
| ECO-5 | CONFIRMED | A2-SYBIL with its metric, a planted welcome allowance, and cost per Sybil and seed-cap use reported apart from PQB-FORGE (§8.8); community quota attached to an inviter's capped grant (§8.2); BYO reciprocity optional |
| ECO-6 | CONFIRMED | Inbox meter rows: pushed `NetByte` and held byte-days sender-paid until pickup, leases holder-paid, with named refusals (§8.1); recipient policy ACL, introduction, E13 postage, capped PoW (§8.3); P7 gated on the 10^4-stranger drill (§13); covers the Stage-1 inbox |
| ECO-7 | CONFIRMED (LAW-10's §8.6 point merged) | BNR's community relay at a fixed per-epoch capacity with the refusal "this community is full; join or start another" (E3, §8.1); a row in the §8.6 cost table; A1-ECON-8D planted joiners case; the §8.6 verdict conditional on E3 |
| ECO-8 | CONFIRMED (ADV-12 (a) merged) | §8.5: a content-addressed, signed, per-epoch, mirrorable hint list in invites and charters; BNR's seed one mirror; token buckets per minute and per source prefix; optional capped PoW; an exhauster drill with a stated floor |
| ECO-9 | CONFIRMED-ALT | A security-critical class (revocation, rekey on leave or ban, Tier-S closing checkpoint, break-mode final checkpoint), quota-exempt up to a charter per-member bound and charged to the relay's payer of record, never an escrow, never BNR (§8.1); payer per row; the zero-balance moderator test (§8.8) |
| ECO-10 | CONFIRMED | Single-provider preference dropped; signed offer cards; at least 2 relays from distinct operators per charter; voucher redemption on exit as a linked receipt (§5.2, §8.4); PQB-REMOVE and A1-REMOVE remove the largest voucher provider; D29 |
| ECO-11 | CONFIRMED | Claimant-paid inclusion in an epoch evidence tree; one root per era re-stamped and re-hashed, renewable by anyone; per-user L1 renewal priced and convicted by ECON-RENEW; the lapse fraction named UNMEASURED (§10.4) |
| LAW-01 | CONFIRMED | §0 rewritten ("lawful under current rulings only in its conservative branches"); every READING row defaults to its conservative or unbuilt branch (§1.2): E5 no agent PQ key, E2 lab-only, E6 gates P3 with R4 unchanged; P1 split into P1a and P1b (§13) |
| LAW-02 | CONFIRMED | E1 status "RULED-as-recorded: ledger summary of a drafted spec; source not located"; E1b names the review's reading with its texts for and against; the switch is a dated RULINGS file under `PQ-LAW.json` before any road-policy re-sign; Seat 1 asked to locate or re-land SPEC_X0X-1 |
| LAW-03 | CONFIRMED | The founder summary, "Tonight's failure ends here", "F8 proves", "fatal flaw, fixed" (now "proposed fix, untested"), "forgeries never reach an author's journal" and "Weekly windows cost no forgery resistance" all rewritten to the ceiling (For the founder, §0, §3.4, §6.3, §10.3) |
| LAW-04 | CONFIRMED | §10.1: "proposed registry gate (this draft)", inspired by DIFFERENTIAL; Article VI §3.1 cited accurately (`:15`, one implementation); E23 default: no registry record of any kind until ruled; D6 and D7 on lab registries |
| LAW-05 | PARTIAL | E9 labelled READING; default: the identity string stays and the charter is a second verifier that must agree; a mismatch refuses, DNS loss alone does not; D1 PASS reworded (§10.8); charter-as-authority waits for Decision 8 |
| LAW-06 | PARTIAL (merged into PQ-9) | SETTLED-LATE (§10.2, §10.3); a PQB-FORGE tooth: a backdated post-distrust settlement shown VALID turns the run red (§11) |
| LAW-07 | CONFIRMED | E5 cites `skaists/buzz@e1035672:crates/buzz-acp/src/config.rs:243-244` alone; E2 cites the BNR-private lane row (`SPEC-BCHAT-1.md:55`); §7.4 restates the 10^5 figure as an unbinding GAP with U-1G capacity UNVERIFIED and a P0.b connections lane; §11 names ruled and design classes apart; the RECORDED-IN-MEMORY class (header, E31); Seat 1 asked to land the 2026-10-11 order |
| LAW-08 | CONFIRMED | E14 sets `joint-liveness-coherence.md:174` (its scope stated) against `pirate-haul-rulings-2026q3.md:43-45` and `:73`, and states that the literal reading would bar rungs 2 and 3; "not offered" pending ruling; Decision 10 cites both |
| LAW-09 | PARTIAL | E28: NIP-42 AUTH as the key-possession session with per-npub quotas (READING), a SIWE wallet session on BNR relays if ruled otherwise; an unauthenticated-write tooth; Decision 20 |
| LAW-10 | CONFIRMED | E3 labelled READING; §8.6 PASS only if E3 is ruled member-pays, the default bounded by BNR's relay cap; E17 "neither requires nor forbids a funded wallet"; ECON-7 scoped to resource-token balances |
| LAW-11 | CONFIRMED (ADV-07 merged) | §4.6: the "nobody, by design" row replaced by "not published by the protocol ... NOT-RUN"; PQB-LINK with M1 to M3 and planted correlators |
| LAW-12 | PARTIAL | E4a sub-row; P0.i files the upstream ask and greps upstream main at a fetched sha for every provisional kind before P2 |
| C5-01 | CONFIRMED | §6.3 rebuilt around the commit-time floor: a late table with exact original bytes, indexed by original id, membership read gate kept; no age cap under an OTS-stamped `K_CP` (also attested in break mode); fence tests in the same job; PQB-HEAL 8- and 30-day partitions; D2 by member republishing; still E4 RED class |
| C5-02 | CONFIRMED | Card v2 with `alg`, cross-family handover, a second non-lattice ongoing signer under the corrected gate, KeyAlg via E22(a) (§2.5, §10.1); D25; a v1-after-distrust tooth; SLH-DSA seal bytes priced (§3.5) |
| C5-03 | CONFIRMED | The two-family wrap for permanent uploads, device-only by default until a second-family KEM is admitted (§6.5, Decision 22); D18 to D20; the hash id bound into the `bzm1` suite and proved in F5 (§3.5, §11) |
| C5-04 | CONFIRMED | An anchor-adapter registry with at least two hash families; D21 with the OTS-only-after-`distrust(sha256)` tooth; the OTS verify KAT in P0.e (§10.4, §13) |
| C5-05 | CONFIRMED (ADV-03 (d) merged) | The NUMS secp256k1 canary with its limit stated; an ML-DSA canary only after analysis; steward-set authority proposed under E23; D22; the L1 row completed and "RED by construction until E22 and E23" (§10.1, §11) |
| C5-06 | CONFIRMED | The interim break-mode lane (per-event `K_ATT`, required by readers); D7's live pass moved to P2; P7 a cost reduction; the lane priced in §7.2 and §7.7 |
| C5-07 | CONFIRMED | Charter on a regular kind (47106); an M-of-N steward set and SLH-DSA succession commitment; seq = prev + 1 with a prev hash; steward-threshold recovery from a named fork point, losing branch kept; D23, D24; a seq-jump tooth (§5.1) |
| C5-08 | CONFIRMED (ADV-04 and PQ-7 (2) merged) | IDENTITY = a relay signature over a fresh client nonce, the challenge, the road and the charter seq (`K_RID`); a relay bzpq1 card pinned in the charter, mutual ML-DSA in break mode; AGREEMENT against the second relay or the invite; impostor and split-view teeth (§5.6) |
| C5-09 | CONFIRMED | The cadence column restored, a stale receipt turning the row NOT-RUN; a CT positive control; D9 continues authoring; D15 names its owner and uses buzz-conformance as oracle (§10.8) |
| C5-10 | CONFIRMED | MEASURED and MODEL removed from "classes as ruled"; RUN-RECEIPT proposed in E30; drills labelled SIMULATED-EXTINCTION; axis 6 split by class; "private-infra, not CI" printed (§11) |
| C5-11 | CONFIRMED | D26 provider migration with evidence unchanged and D27 settlement-adapter swap, both by P4; address-keyed receipt and hardwired adapter teeth (§10.8, §13) |
| C5-12 | CONFIRMED | PQB-TIME-CROSS past 2038 and 2106 with authority continuity and evidence on the second anchor; wrapping and refuse-everything clients convicted; rows for `validUntil` and the relay cast (§10.6, §11) |
| ADV-01 | CONFIRMED (merged into PQ-4) | k-of-n device cards, the CONTESTED veto, PQB-DEVTHEFT; owner co-attestation of agent Tier-S acts in the E5-ruled branch (§2.2, §2.3, §11) |
| ADV-02 | CONFIRMED-ALT (core is PQ-1) | PQ-1's fix used; (d) kept (D13 PASS and PQB-ROOT-THEFT's measured count); root separation routed to E22; (b) and (c) not adopted |
| ADV-03 | CONFIRMED | `fresh_until` horizons and a STALE state; the bind hash and charter seq in every `K_CP`; heads from at least two sources; PQB-STALE (§2.2, §3.4, §5.1, §11); (d) merged into C5-05 |
| ADV-04 | CONFIRMED (merged into C5-08) | A terminal refusal only when signed by the charter relay key and bound to the nonce; an unsigned refusal is a transport failure; the pre-P2 harness rule (§3.6, §5.3); PQB-ROADSPOOF |
| ADV-05 | CONFIRMED | The WITHHELD state (§6.2); the daily `K_CP` as the signed head beacon, with chain tags exposing gaps on the next post; cross-checks over the second relay; T_detect = 24 h given a second source; PQB-WITHHOLD with an honest-relay control (§3.4, §11) |
| ADV-06 | CONFIRMED (merged into PQ-3) | `npub_compromised_since` under the rank rules; 24 h windows and per-event Tier-S attestation for agent npubs held in host environment; PQB-NPUB-THEFT (§2.2, §2.3, §11) |
| ADV-07 | CONFIRMED (merged with LAW-11) | M1, M2 and M3 as separate measured properties; the `bzm1` relay row now names the authenticated npub; anonymous quota tokens a future option, not a P7 requirement; the M1 planted-join tooth (§4.6) |
| ADV-08 | CONFIRMED (merged into PQ-2) | The P7 KEM ratchet with ephemeral keys from both sides erased after use; PCS-1 with a static-key tooth; wording withheld until it passes (§4.1, §4.2) |
| ADV-09 | CONFIRMED-ALT | No 1059 carve-out; the outbox re-wraps the unchanged inner signed event in a fresh 1059; tombstone lists refuse pruned and moderated ids; PQB-REPLAY-1059 (§6.3, §9) |
| ADV-10 | PARTIAL | HELD-VERIFIED for authority objects only, by delayed read-back over a separate road or the other relay, with retries and an alert; PQB-FAKEACK within 10 minutes (§6.2) |
| ADV-11 | CONFIRMED-ALT | Write-common kept above a monotone charter `suite_floor` that only the owner or stewards raise (§4.4, §10.7); (b) to (d) from PQ-5; PQB-DOWNGRADE; write-preferred exclusion not adopted, since it would break unupgraded members (`docs/CONSTITUTION.md:92`) |
| ADV-12 | CONFIRMED | (a) merged into ECO-8; (b) merged into ECO-9 and ECO-6: unsolicited inbound sender-paid, authority kinds readable even at `FloorRefusal` (§8.1); ECON-DRAIN (§8.8) |
| CRITIC-1 | FIXED after the critic (integrating seat) | Per-device chain tags `["bzp", prev, "<d>:<seq>"]` with a permanent device index `d` in `K_BIND` (§2.2, §3.4); rule 2a makes pre-E6 device additions loud; §10.3 evidence rule and §14 item 13 updated; bind sizes recomputed by Appendix A (1,041/1,170/1,299/1,428 B; churn at M = 10 now 1.64 Gbps) |

---

## Appendix A. The calculator (ARITH source)

Every ARITH figure above is printed by this script, labelled by table (T2 sizes, T3.4 windows, T7.2 traffic, T7.3 channel sensitivity, T7.4 connections, T7.5 verification, T7.7 break transition, T7.8 churn, T6.5 archive, T8.4 vouchers, T8.5 seeds, T10.4 renewal, TM other figures, T16 reproductions of attacked draft figures). It reads and writes nothing. Run it with `node calc-s7.js` after copying the block below, or pipe the block to `node -`.

```js calc-s7
// calc-s7.js: SPEC-BUZZ-PQ-1 arithmetic (ARITH). Run: node calc-s7.js
// Every input is an ASSUMPTION unless the spec cites it. Prices are one-date receipts.
'use strict';
const N = 1e10, DAY = 86400, YR = 365.25;
const b64u = n => Math.ceil(n * 4 / 3), X = n => 'x'.repeat(n), r0 = x => Math.round(x), f = (x, d = 1) => x.toFixed(d);
const ev = (kind, tags, clen) => JSON.stringify({id: X(64), pubkey: X(64), created_at: 1760000000, kind, tags, content: X(clen), sig: X(128)}).length;
const H = X(64), HID = X(36), CH = X(52), BID = X(63);
const out = (...a) => console.log(...a);

// ---------- T2 object sizes (bytes) ----------
const MSG = ev(9, [['h', HID]], 200);                                    // today's kind 9 with 200 B of text
const MSGC = ev(9, [['h', HID], ['bzp', H, '1234567']], 200);           // plus the per-cell chain tag
const CP_FIX = ev(47101, [['v', '1'], ['c', CH], ['h', HID], ['seq', '1234567'], ['prev', H], ['range', '1760000000', '1760604800'], ['bind', H], ['cs', '12345']], 0);
const CP = n => CP_FIX + b64u(32 * n);                                   // K_CP listing n ids
const st = full => JSON.stringify(Object.assign({bpq: 1, kind: 'nostr-event', id: BID, event: H}, full ? {dsa: X(b64u(1952)), succ: X(b64u(32))} : {}, {sig: X(b64u(3309))}));
const ATT_FULL = ev(47102, [['e', H]], JSON.stringify(st(true)).length - 2);
const ATT = ev(47102, [['e', H]], JSON.stringify(st(false)).length - 2); // card-reference form
const SLOT = JSON.stringify({to: 'x-wing', ct: X(b64u(1120)), w: X(b64u(48))}).length + 1;
const GSLOT = JSON.stringify({to: 'group', e: X(b64u(8)), w: X(b64u(48))}).length + 1;
const CORE = 187;
const INNER = ev(14, [['p', H], ['bzp', H, '1234567']], 432);          // signed kind 14: 400 B envelope + 32 B suite advertisement
const sealed = (slots, plain) => 8 + 16 + CORE + (2 + slots) + (plain + 16);
const P5DM = r => ev(1059, [['p', H]], b64u(sealed(r * SLOT, INNER)));
const P6DM = ev(1059, [['p', H]], b64u(sealed(GSLOT, INNER)));
const PQG = ev(47103, [['h', HID]], b64u(sealed(GSLOT, INNER)));
const SCP = n => ev(47103, [['h', HID]], b64u(sealed(GSLOT, CP(n) + 2 * 64 + 6 * 46))); // sealed digest list, private-head ref, Merkle path
const PHEAD = ev(47101, [['v', '1'], ['c', CH], ['seq', '1234567'], ['prev', H], ['bind', H], ['cs', '12345']], b64u(32)); // weekly public private head
const WRAP = ev(47103, [['h', HID], ['p', H]], b64u(8 + 16 + CORE + 2 + SLOT + 32 + 16));
const PREKEY = ev(47105, [['c', CH]], JSON.stringify({card: BID, wk: '2026-W42', exp: 1760000000, xw: X(b64u(1216))}).length);
const CARD = JSON.stringify({bpq: 1, id: BID, dsa: X(b64u(1952)), kem: X(b64u(1216)), succ: X(b64u(32)), sig: X(b64u(3309))}).length;
const CARDEV = ev(47108, [], CARD);
const bindBody = (D, full) => JSON.stringify({v: 2, cards: Array(D).fill(full ? X(CARD) : {d: 1, id: BID, h: X(43)}), recovery: full ? X(CARD) : {id: BID, h: X(43)}, ed25519: X(43), inbox: {npub: H, roads: [X(40), X(40)]}, fresh_until: 1760000000}).length;
const BIND = (D, full) => ev(47100, [['c', CH], ['seq', '1234567'], ['prev', H]], bindBody(D, full));
const REC = 512, SEAL = 4096, SEAL_SLH = Math.ceil((3537 - 3309 + 7856) / 512) * 512, STEP = Math.ceil(2336 / 512) * 512;
let slotCap = 0; for (let r = 1; r < 80; r++) if (P5DM(r) + 12 <= 65536) slotCap = r;
let cpMax = 0; for (let n = 1; n < 3000; n++) if (CP(n) + 12 <= 65536) cpMax = n;
out(`T2 MSG ${MSG} MSGC ${MSGC} CP(1) ${CP(1)} CP(8) ${CP(8)} cpMax ${cpMax} ATT_FULL ${ATT_FULL} ATT ${ATT}`);
out(`T2 P5DM slots 1/3/7: ${P5DM(1)}/${P5DM(3)}/${P5DM(7)} slotCap ${slotCap} P6DM ${P6DM} PQG ${PQG} SCP(1) ${SCP(1)} SCP(8) ${SCP(8)} PHEAD ${PHEAD} WRAP ${WRAP}`);
out(`T2 PREKEY ${PREKEY} CARD ${CARD} CARDEV ${CARDEV} SEAL_SLH ${SEAL_SLH} STEP ${STEP}`);
out(`T2 BIND full D=1..4 ${[1, 2, 3, 4].map(d => BIND(d, true)).join('/')} card-ref ${[1, 2, 3, 4].map(d => BIND(d, false)).join('/')}`);

// ---------- T7.1 workload (ASSUMPTION) ----------
const share = {dm: 0.6, gr: 0.35, ch: 0.05};      // human sent mix
const ashare = {dm: 0.2, gr: 0.3, ch: 0.5};       // agent sent mix
const GROUP = 6, MA = 10, F_OD = 0.02;            // group recipients; agent messages per day; on-demand K_ATT fetch share
const cells = {1: {dm: 2, gr: 1, ch: 1}, 10: {dm: 5, gr: 3, ch: 1}, 100: {dm: 12, gr: 6, ch: 3}};
const HT = [[100, 0.80], [1000, 0.17], [10000, 0.03]], R100 = [[100, 1]]; // channel posts by channel size (humans)
const lam = (M, t) => M * share[t] / cells[M][t];                          // ids per persona-cell-day
const nW = (M, t) => Math.max(1, 7 * lam(M, t));                           // ids per 7-day attestation window
const nD = (M, t) => { const l = lam(M, t); return l / (1 - Math.exp(-l)); }; // ids per daily K_CP (Poisson posting days)
const nP = M => Math.max(1, 7 * M * (share.dm + share.gr));                 // private ids per persona-week under one private head
const privSettle = (M, t) => SCP(nW(M, t)) / nW(M, t) + (PHEAD + ATT) / nP(M); // sender settlement per private message
const copies = (t, D, a, R) => t === 'dm' ? 2 * D - 1 : t === 'gr' ? GROUP * D + D - 1 : R * (D + a) + 1;
const Ec = (t, D, a, dist) => t === 'ch' ? dist.reduce((s, [R, p]) => s + p * copies('ch', D, a, R), 0) : copies(t, D, a);
for (const M of [1, 10, 100]) out(`T3.4 M=${M} nW dm ${f(nW(M, 'dm'), 2)} gr ${f(nW(M, 'gr'), 2)} ch ${f(nW(M, 'ch'), 2)} nD ch ${f(nD(M, 'ch'), 2)}; sender settlement B/msg ch ${r0(CP(nD(M, 'ch')) / nD(M, 'ch'))}+${r0(ATT / nW(M, 'ch'))} dm ${r0(privSettle(M, 'dm'))} gr ${r0(privSettle(M, 'gr'))} (private ids per week ${f(nP(M), 2)})`);

// ---------- T7.2 per-copy bytes and traffic ----------
function perCopy(M, D, g) {
  const n = {dm: nW(M, 'dm'), gr: nW(M, 'gr'), ch: nW(M, 'ch')}, nd = nD(M, 'ch');
  const wrap = t => (cells[M][t] * D * WRAP / 7) / (M * share[t] * copies(t, D, 0)); // weekly rekey wraps per copy
  const p = 1 - Math.exp(-lam(M, 'dm')), step = STEP * p / lam(M, 'dm');             // P7 ratchet steps per DM message
  if (g === 'classical') return {dm: MSG, gr: MSG, ch: MSG};
  if (g === 'live') return {dm: P6DM + SCP(n.dm) / n.dm + wrap('dm') + F_OD * ATT / n.dm, gr: PQG + SCP(n.gr) / n.gr + wrap('gr') + F_OD * ATT / n.gr, ch: MSGC + CP(nd) / nd + F_OD * ATT / n.ch};
  if (g === 'interim') return {dm: P6DM + ATT + wrap('dm'), gr: PQG + ATT + wrap('gr'), ch: MSGC + ATT};
  if (g === 'nativeLazy') return {dm: REC + step, gr: REC + wrap('gr'), ch: REC};
  if (g === 'nativeBreak') return {dm: REC + step + SEAL / n.dm, gr: REC + wrap('gr') + SEAL / n.gr, ch: REC + SEAL / n.ch};
}
const RG = ['classical', 'live', 'interim', 'nativeLazy', 'nativeBreak'];
for (const M of [1, 10, 100]) out(`T7.2a M=${M} ` + RG.map(g => { const p = perCopy(M, 2, g); return `${g} ${r0(p.dm)}/${r0(p.gr)}/${r0(p.ch)}`; }).join(' | '));
for (const M of [1, 10, 100]) out(`T7.2a M=${M} weekly rekey wraps per copy: DM ${r0((cells[M].dm * 2 * WRAP / 7) / (M * share.dm * copies('dm', 2, 0)))} group ${r0((cells[M].gr * 2 * WRAP / 7) / (M * share.gr * copies('gr', 2, 0)))}`);
function traffic(M, D, a, dist, g) {
  const p = perCopy(M, D, g); let B = 0, C = 0;
  for (const t of ['dm', 'gr', 'ch']) { const c = Ec(t, D, a, dist); B += N * (M * share[t] + a * MA * ashare[t]) * c * p[t]; C += N * (M * share[t] + a * MA * ashare[t]) * c; }
  return {gbps: B * 8 / DAY / 1e9, perCopy: B / C, copiesPerMsg: C / (N * (M + a * MA))};
}
const CASES = [['A', 0, R100], ['B', 0, HT], ['C', 0.1, HT], ['D', 1, HT], ['E', 5, HT]];
for (const [lab, a, dist] of CASES) for (const M of [1, 10, 100]) out(`T7.2b ${lab} M=${M} copies/msg ${f(traffic(M, 2, a, dist, 'live').copiesPerMsg)} ` + RG.map(g => { const t = traffic(M, 2, a, dist, g); return `${g} ${f(t.gbps, 1)}G/${r0(t.perCopy)}B/x${f(t.perCopy / MSG, 2)}`; }).join(' '));
for (const M of [1, 10, 100]) { const ing = (g) => { const p = perCopy(M, 2, g); return N * M * (share.dm * (g === 'live' ? P6DM + privSettle(M, 'dm') : p.dm) + share.gr * (g === 'live' ? PQG + privSettle(M, 'gr') : p.gr) + share.ch * (g === 'live' ? MSGC + CP(nD(M, 'ch')) / nD(M, 'ch') + ATT / nW(M, 'ch') : p.ch)) * 8 / DAY / 1e9; }; out(`T7.2c ingress per relay copy (humans) M=${M}: classical ${f(ing('classical'), 1)} live ${f(ing('live'), 1)} nativeBreak ${f(ing('nativeBreak'), 1)} Gbps; x2 for rho=2`); }

// ---------- T7.3 channel-size sensitivity (M=10, live lane, humans posting, push reads) ----------
const BOX = 1e5, BOXUSD = 101 * 12, U1G = 0.7;
function sens(D, a, R, M = 10) { const p = perCopy(M, D, 'live'); let B = 0, cp = 0; for (const t of ['dm', 'gr', 'ch']) { const c = copies(t, D, a, R); B += N * M * share[t] * c * p[t]; cp += share[t] * c; } const avg = B * 8 / DAY / 1e9; return {cp, peak: 3 * avg, bw: 3 * avg / U1G, conn: (N * D * 1.5 * 0.1 + N * a) / BOX}; }
for (const R of [100, 1000, 10000]) out(`T7.3 R=${R} ` + [1, 2, 4].map(D => { const s = sens(D, 0, R); return `D=${D} copies ${f(s.cp)} peak ${f(s.peak / 1000, 2)}T bw ${r0(s.bw)} conn ${r0(s.conn)} ${s.bw > s.conn ? 'BW' : 'CONN'}`; }).join(' | '));
{ const s = sens(2, 5, 10000); out(`T7.3 community-wide channel, 10K humans + 50K agents: copies ${f(s.cp)} peak ${f(s.peak / 1000, 2)}T bw ${r0(s.bw)} conn ${r0(s.conn)}`); }
for (const D of [1, 2, 4]) { let lo = 10, hi = 1e5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const s = sens(D, 0, m); if (s.bw > s.conn) hi = m; else lo = m; } out(`T7.3 crossover R_ch at D=${D}: ${r0(lo)}`); }
for (const fr of [1, 0.25]) for (const a of [0, 1]) { const p = perCopy(10, 2, 'live'); let B = 0; for (const t of ['dm', 'gr', 'ch']) { const c = t === 'ch' ? HT.reduce((s, [R, q]) => s + q * copies('ch', 2, a, R) * (R >= 1000 ? fr : 1), 0) : copies(t, 2, a); B += N * 10 * share[t] * c * p[t]; } const peak = 3 * B * 8 / DAY / 1e9; out(`T7.3 heavy tail, humans posting, agents reading a=${a}, f_read=${fr}: peak ${f(peak / 1000, 2)}T bw ${r0(peak / U1G)} conn ${r0((N * 2 * 1.5 * 0.1 + N * a) / BOX)}`); }

// ---------- T7.4 connections and one cost basis ----------
for (const rho of [1, 2]) for (const C of [1, 1.5, 3]) out(`T7.4 rho=${rho} C=${C}: ` + [0.05, 0.10, 0.30].map(c => `${c * 100}%: ` + [0.1, 1, 5].map(a => r0((N * 2 * C * rho * c + N * a * rho) / BOX / 1000) + 'k').join('/')).join(' | '));
for (const [lab, rho, a] of [['humans', 1, 0], ['humans rho2', 2, 0], ['a0.1', 1, 0.1], ['a1', 1, 1], ['a5', 1, 5]]) { const b = (N * 2 * 1.5 * rho * 0.1 + N * a * rho) / BOX; out(`T7.4 basis D=2 C=1.5 conc=10% ${lab}: ${r0(b)} boxes $${f(b * BOXUSD / 1e6, 1)}M/yr $${f(b * BOXUSD / N, 4)}/human-yr`); }
out(`T7.4 humans D=1/2/4: ${[1, 2, 4].map(D => r0(N * D * 1.5 * 0.1 / BOX)).join('/')} boxes`);
out(`T7.4 inbox per-user sessions: relay ${r0(N * 1.5 / BOX)} inbox ${r0((N * 2 * 0.1 + N * 1.5) / BOX)}; multiplexed: relay ~0 inbox ${r0(N * 2 * 0.1 / BOX)}`);
out(`T7.4 community 10K humans + 50K agents: ${10000 * 2 * 0.1 + 50000} connections = ${f((10000 * 2 * 0.1 + 50000) / BOX, 2)} box; dedicated box $${f(1212 / 10000, 3)}/member-yr`);

// ---------- T7.5 verify budgets in break mode ----------
function recv(M, D, a, dist) { const devs = N * D + N * a, r = {}; for (const t of ['dm', 'gr', 'ch']) r[t] = N * (M * share[t] + a * MA * ashare[t]) * Ec(t, D, a, dist) / devs; return r; }
function vstats(M, a, dist) { const r = recv(M, 2, a, dist); let tot = 0, v = 0; for (const t of ['dm', 'gr', 'ch']) { tot += r[t]; v += r[t] / nW(M, t); } return {tot, v, nb: tot / v}; }
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const s = vstats(M, a, dist); out(`T7.5 ${lab} M=${M}: recv/device-day ${f(s.tot)} verifies ${f(s.v)} nbar ${f(s.nb, 2)} tv<= dm ${f(0.5 * nW(M, 'dm'), 2)} gr ${f(0.5 * nW(M, 'gr'), 2)} ch ${f(0.5 * nW(M, 'ch'), 2)} mixed ${f(0.5 * s.nb, 2)} ms; 10s/day cap ${f(10000 / s.v, 1)} ms; interim verifies/day ${r0(s.tot)}`); }
for (const sd of [6, 24, 96]) { const s = (N * 2 * 1.5 * sd + N * 1) / DAY; out(`T7.5 K_PQAUTH ${sd} sessions/device-day: ${f(s / 1e6, 2)}e6 verifies/s, ${r0(s / 130000)}/s per box (130k), ${r0(s * ATT * 8 / 1e9)} Gbps`); }
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const r = recv(M, 2, a, dist), p = perCopy(M, 2, 'live'); out(`T7.4m ${lab} M=${M}: phone receives ${f((r.dm * p.dm + r.gr * p.gr + r.ch * p.ch) / 1e3, 1)} KB/day on the live lane`); }

// ---------- T7.7 break-mode transition ----------
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const s = vstats(M, a, dist), e7 = s.tot * 7 / s.nb * ATT, e90 = s.tot * 90 / s.nb * ATT, devs = N * 2 + N * a; out(`T7.7 ${lab} M=${M}: 7-day eager ${r0(s.tot * 7 / s.nb)} attestations ${f(e7 / 1e6, 1)} MB/device (90-day ${f(e90 / 1e6, 1)} MB); global 7-day drain ${f(e7 * devs * 8 / (7 * DAY) / 1e12, 2)} Tbps`); }

// ---------- T7.8 identity, prekeys and churn ----------
const D = 2, C = 1.5, newDev = 2 * N / (3 * YR);
out(`T7.8 new devices/day ${newDev.toExponential(4)}; prekey+att per device-community-week ${PREKEY + ATT}; ingress ${f((PREKEY + ATT) * N * D * C / (7 * DAY) * 8 / 1e9, 2)} Gbps`);
for (const M of [1, 10, 100]) { const rd = (cells[M].dm + cells[M].gr * GROUP) * D; const full = (BIND(D, true) + 2 * ATT) * (C + rd), ref = (BIND(D, false) + 2 * ATT + CARDEV) * (C + rd); const rk = (cells[M].dm * 2 * D + cells[M].gr * 7 * D) * WRAP; const res = recv(M, 2, 0, R100), rec = (res.dm + res.gr + res.ch) * 90; const pc = perCopy(M, 2, 'live'); const resB = 90 * (res.dm * pc.dm + res.gr * pc.gr + res.ch * pc.ch); out(`T7.8 M=${M} eager readers ${rd}: prekey fetch ${f((PREKEY + ATT) * rd * N * D / (7 * DAY) * 8 / 1e9, 1)} Gbps; bind churn full ${f(newDev * full * 8 / DAY / 1e9, 2)} card-ref ${f(newDev * ref * 8 / DAY / 1e9, 2)} Gbps; rekeys per device change ${rk} B -> ${f(newDev * 2 * rk * 8 / DAY / 1e9, 2)} Gbps; 90-day resync ${f(resB / 1e6, 1)} MB/device -> ${f(newDev * resB * 8 / DAY / 1e9, 1)} Gbps (case A)`); }
out(`T4.3 group rekey wraps: 256 devices ${256 * WRAP} B; all-slots O(n^2) ${f(256 * 256 * b64u(SLOT) / 1e9, 3)} GB at 256, ${f(1e6 * b64u(SLOT) / 1e9, 2)} GB at 1000; weekly 7-member D=2 group ${14 * WRAP} B`);
out(`T3.5 SLH-DSA-SHAKE-128s seal ${3537 - 3309 + 7856} B padded ${SEAL_SLH}; per msg n=1/8/64 ${[1, 8, 64].map(n => r0(512 + SEAL_SLH / n)).join('/')} vs ML-DSA ${[1, 8, 64].map(n => r0(512 + SEAL / n)).join('/')}`);

// ---------- T6.5 archive, flush rule, payments ----------
const CHUNK = 4190208, ANTC = 0.084802, ANTUSD = 0.04137896, ETHUSD = 2519.20, GASETH = 3.35e-6, CIRC = 341.57e6, VOLDAY = 341118;
function archYear(M, ER) { const own = M * (share.dm * (INNER + (PHEAD + ATT) / nP(M) + 46) + share.gr * (INNER + (PHEAD + ATT) / nP(M) + 46) + share.ch * (MSGC + CP(nD(M, 'ch')) / nD(M, 'ch') + ATT / nW(M, 'ch'))); const rec = M * (share.dm * 1 * (INNER + 46) + share.gr * GROUP * (INNER + 46) + share.ch * ER * (MSGC + CP(nD(M, 'ch')) / nD(M, 'ch'))); return (own + rec) * YR; }
function flush(yb) { const mb = yb / 12, three = 3 * CHUNK; if (yb < three) return {files: 1, chunks: 3}; if (mb >= three) { const per = Math.ceil(mb / CHUNK); return {files: 12 * Math.ceil(per / 63), chunks: 12 * per}; } return {files: yb / three, chunks: Math.ceil(yb / CHUNK)}; }
for (const [lab, ER] of [['R=100', 100], ['heavy E[R]=550', 550]]) for (const M of [1, 10, 100]) { const yb = archYear(M, ER), fl = flush(yb), mo = 12 * Math.max(3, Math.ceil(yb / 12 / CHUNK)); const ant = fl.chunks * ANTC * ANTUSD, gas = fl.files * GASETH * ETHUSD, antYr = fl.chunks * N * ANTC; out(`T6.5 ${lab} M=${M}: ${f(yb / 1e6)} MB/yr files ${f(fl.files, 2)} chunks ${fl.chunks} (monthly ${mo}) ANT $${f(ant, 3)} gas $${f(gas, 3)} gas share ${f(100 * gas / (ant + gas))}% payments/s ${r0(fl.files * N / (YR * DAY))}; RailC ${(fl.chunks * N).toExponential(2)} chunks/yr = ${f(antYr / CIRC)}x circulating = ${r0(antYr * ANTUSD / (VOLDAY * YR))} yr of ANT volume`); }
{ const fl = flush(archYear(10, 100)); out(`T8.7 users whose M=10 archive fits 1% of circulating ANT per year: ${(0.01 * CIRC / (fl.chunks * ANTC)).toExponential(3)}`); }

// ---------- T8.4 vouchers ----------
const FEE = GASETH * ETHUSD, MINTOP = FEE / 0.05;
for (const [lab, b] of [['humans', 30000], ['humans rho2', 60000], ['a=1', 130000], ['a=5', 530000]]) { const perYr = b * BOXUSD / N; out(`T8.4 ${lab}: relay cost $${f(perYr, 4)}/human-yr; min top-up $${f(MINTOP, 3)} (fee $${f(FEE, 4)}, fee/value 5%) lasts ${f(MINTOP / perYr, 1)} yr; top-ups/s at 1e10 ${f(N * perYr / MINTOP / (YR * DAY), 1)}`); }
out(`T8.4 draft check: yearly ${f(N / (YR * DAY), 1)}/s monthly ${f(12 * N / (YR * DAY), 1)}/s`);

// ---------- T8.5 seeds ----------
const cold = 2 * N / (3 * 365) + 0.01 * 2 * N;
out(`T8.5 cold-start fetches/day ${cold.toExponential(4)} = ${f(cold * 4096 / 1e12, 3)} TB/day, ${f(cold * 4096 * 8 / DAY / 1e6)} Mbps; cap 1e7/day = ${f(1e7 * 4096 / 1e9)} GB/day, ${f(1e7 * 4096 * 8 / DAY / 1e6, 2)} Mbps, ${r0(1e7 * 4096 * 8 / 1e9)} s of a 1 Gbps link; binds at ${(1e7 / (1 / (3 * 365) + 0.01)).toExponential(4)} devices; refused share at 1e10 ${f(100 * (1 - 1e7 / cold))}%`);

// ---------- T10.4 renewal ----------
const ARL1 = 0.0049, ARGIB = 32.56;
out(`T10.4 per-user L1 renewal $${f(N * ARL1 / 1e6, 1)}M/era; per-user 2 KB bundled $${r0(N * 2048 / 2 ** 30 * ARGIB)}/era; epoch-root renewal 52 roots/yr x $${ARL1} = $${f(52 * ARL1, 3)}/yr; Merkle path ${Math.ceil(Math.log2(N))} levels = ${Math.ceil(Math.log2(N)) * 32} B per user`);

// ---------- T-misc figures used in the text ----------
out(`TM handover event ${Math.ceil((49856 + 1952 + 64 + 2000) * 4 / 3) + 500} B, x150 contacts ${f((Math.ceil((49856 + 1952 + 64 + 2000) * 4 / 3) + 500) * 150 / 1e6, 2)} MB; OTS headers ${f(80 * 144 * YR / 1e6, 2)} MB/yr; card-ref saving ${f(100 * (1 - ATT / ATT_FULL), 1)}%`);
out(`TM E21 shares ${f(100 * 12718760 / N, 3)}% to ${f(100 * 29994617 / N, 3)}%; ANT/chunk $${f(ANTC * ANTUSD, 4)}; live quote 0.2145 ANT / 3 chunks = ${f(0.2145 / 3, 4)} ANT/chunk; 115,741 check ${f(N / DAY, 1)}`);
{ const p = perCopy(10, 2, 'live'); const ingB = (0.6 * (P6DM + privSettle(10, 'dm')) + 0.35 * (PQG + privSettle(10, 'gr')) + 0.05 * (MSGC + CP(nD(10, 'ch')) / nD(10, 'ch') + ATT / nW(10, 'ch'))); const t = traffic(10, 2, 0, R100, 'live'); out(`TM 10K-member community, case A, M=10: ${f(1e4 * 10 * 16.4 * t.perCopy * 8 / DAY / 1e6, 2)} Mbps avg, ${f(3 * 1e4 * 10 * 16.4 * t.perCopy * 8 / DAY / 1e6, 2)} peak; relay cache ${f(ingB * 10 * 90 / 1e6, 2)} MB per member over 90 days; stored bytes per message ${r0(ingB)}`); }

out(`TM one message from each of 1,000 authors: ${f(1000 * ATT / 1e6, 2)} MB of attestations when checked; BESIDE eager ${f(1000 * 8229 / 1e6, 2)} MB`);
out(`TM native archive, records only (512 B each), case A: ${[1, 10, 100].map(M => f(YR * M * (1 + 0.6 * 1 + 0.35 * GROUP + 0.05 * 100) * REC / 1e6, 1)).join(' / ')} MB/yr`);
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) out(`TM break-mode verifies per second, all devices, case ${lab}: ${[1, 10, 100].map(M => (vstats(M, a, dist).v * (N * 2 + N * a) / DAY / 1e6).toFixed(2) + 'e6').join(' / ')}`);

// ---------- T16 reproductions of attacked draft figures ----------
const dn = [512 + 4096 / 9, 512 + 4096 / 10.5, 512 + 4096 / 1.5];
out(`T16 F6 draft-n native ${f((1.8 * dn[0] + 4.55 * dn[1] + 10.05 * dn[2]) / 16.4)}; F12 ${f(1751 / 586, 2)}/${f(1598 / 586, 2)}/${f(1319 / 586, 2)}; F4 ${f(1.8 + 4.55 + 0.05 * 2001)}/${f(1.8 + 4.55 + 0.05 * 20001)}; F10 ${f(1.826e7 * 41500 * 246 * 8 / DAY / 1e9)} Gbps; F7 ${f(5000 / (10000 / (7.7 / 3.6)), 2)} ms; ECO-2 ${f(3.6e11 * 0.0848 / CIRC)}x; PQ-2 ${f(7103 * 2e10 / 604800 * 8 / 1e9, 2)} Gbps`);
```
