# DESIGN BRIEF — post-quantum Buzz on the user-pays stack, tungsten grade

Written 2026-10-15 by the Claude Code seat for the design round. Read this first, then the nine
reader notes in this folder (law-constitutional.md, law-identity-scale.md, x0x.md, bnrose.md,
buzz.md, paystack.md, pq-tungsten.md, scale.md, critic.md). Every claim you make must cite a
path:line from those notes or their sources. The notes are evidence, this brief is the frame.

## 1. The ask, verbatim (founder, 2026-10-15)

1. "can you finish the PQ buzz x0x/BNRoSe upgrade and get it all running again please?"
   (No such upgrade existed; the outage was a WatchGuard SNI filter on `skaists.buzz`. Seat
   answered: Buzz over x0x/BNRoSe "is new design work".)
2. "new design then and build in mind our decentralized user pays for resourses stack"
3. "make it the tungsten gold standard for the next 1k years for 10+ billion users"

"Tungsten" = SPEC-BTUNGSTEN-1 (docs/specs/SPEC-BTUNGSTEN-1.md): six axes (decentralization,
Sybil/MiM, autonomous healing, autonomous learning, >10B users, >=1,000-year continuity) and
founder laws L1-L5 (L1: >=10B unique ACTIVE sovereigns per epoch for 1,000 years with no
dependence on any original key/algorithm/clock/chain/org/UI; L2 short-lived intents, epochal
governance; L3 bounded execution layer, aggregated authorization; L4 time-representation
extinction is a fail-closed test boundary; L5 configuration is never runtime evidence, the
EXPOSURE->IDENTITY->PEER->AGREEMENT gate). Formal-assurance ladder, result-class law,
right-language law, input-boundary law, teeth in the same job, receipts computed from
observations only. No system is conformant today: a design may only NAME the receipts it will
earn; it may never claim the title.

## 2. What the design must be

A NEW design for the estate's human+agent conversation system ("PQ Buzz") that:
- is post-quantum where it claims to be, with honest per-property claims (separate-tracks rule:
  an ML-DSA attestation beside a Schnorr event does not make the event PQ);
- runs on the decentralized user-pays stack (Constitution Art. V.1: users fund what they consume,
  the paymaster abstracts and never absorbs; HARDLINE 8d "does the cost of the ten-billionth user
  land on BNR?"; B1 metering: physical units in A, never access, user is payer of record,
  zero balance = named FloorRefusal; Rail C: no per-identity float at 10^10);
- uses x0x and BNRoSe where the law allows, and names every place it would need a ruling;
- reaches the tungsten bar by construction: every property maps to an adversarial test family
  with pass/fail criteria named before the run;
- survives the incident that started this: one DNS name blocked by a building filter must never
  again take the system down (community identity must not be a DNS name).

## 3. Governing frame you must design inside (details and citations in the notes)

- **Identity:** did:b: bzDiD is the only root (VOCABULARY Law 7). Nostr npubs, x0x ML-DSA ids,
  device keys, agent keys are bound personas, pairwise/selective by default, never a global
  linking identifier (RULINGS-2026-09-16 R1/R4). Records key off the DID, never raw keys, and
  rotation must never orphan data (Constitution Art. II). bzDiD genesis already accepts ml-dsa-65
  key cards; succession = SLH-DSA handover (SPEC-BPQ-1). Unique key != unique human (PERSON-1);
  no 1:N biometric gallery (PERSON-1 P-3, BIO-1 B-2).
- **Planes (RULED, pirate-haul-rulings.md:18):** Buzz = human plane, x0x = machine plane,
  Autonomi = durable, Arweave = permanence, Vaulta/Zano = settlement. X-1 x0x NEVER storage;
  X-2 machine decisions surface to the human plane; X-3 no component may need x0x liveness to
  preserve data. Buzz is "NEVER a storage/permanence/privacy/settlement layer" (:17).
  **"Buzz over x0x" collides with this by name. You must ESCALATE, not resolve.** Design so the
  system is lawful under the current ruling AND state exactly what changes if the founder
  amends it (a switch, not a rewrite).
- **Messaging stack canon:** SPEC-BCHAT-1 (founder order 2026-10-02) is "the estate's messaging
  stack": bChat Core (transport-neutral envelope v1) + Surfaces + Adapters, three trust lanes.
  The sovereign order (2026-10-11) forbids starting a competing wallet/identity/storage/
  orchestration system. PQ Buzz must be expressed as an evolution of / adapter set under bChat
  Core + the kernel CanonicalEvent (Constitution Art. III.1), not a rival stack.
- **BNRoSe:** reuse journal::ReplicatedJournal / durable ack (SPEC-RUSTEOSVM-1 §2.4: two
  independent stores in distinct failure domains, fsynced before any external effect),
  idempotent dest-apply, wasm verdict sandbox. Do NOT build a competing journal or execution
  core; new E_* codes are a proposal to ZCode. BNRoSe is Ed25519/HMAC today, not PQ. BNRoSe's
  charter wants every doc to declare its Eternal Computer leg (L1 data / L2 runtime / L3
  compute); messaging fits none cleanly: say how you place it.
- **bSigner frozen:** signs authorization artifacts, never submits, no network code; a new
  command needs a founder ruling. Rail signers sign payloads, adapters submit.
- **Chain bytes:** O(1) for any population (bzDiD: 148,156 B fixed); a Vaulta account per user is
  impossible (82.3x short of total RAM supply at 10^10). No per-user or per-message chain write.
- **Durability:** relays/VPS are cache and bootstrap, never system of record (pay-once-now inv. 4);
  anything held only in x0x does not survive; "durably acknowledged" has the §2.4 meaning.
- **Fees/rails:** Vaulta A for metering, ANT pay-once storage (>=256 KiB), Arweave permanence
  (<256 KiB), bPay one wallet, 10% tithe only by founder word, b never on the commodity layer
  (open Q-2/MX-2), no fee on .b names, BNR never in the onboarding flow of funds (R3).
- **Agents:** owner-bound, expiring, revocable delegation (AGENT-1 Q-5, A-10); cloud-LLM agents
  inside an E2EE room read plaintext, so "E2EE" may only be claimed with remote inference as a
  distinct, visible, chosen mode (AGENT-1). The buzz-acp harness and buzz-cli must keep working
  through any migration (18 agents run on them today).
- **Crypto claim ceiling:** "sound by construction / isolated by design"; x0x confidentiality
  only on private_secure/TreeKEM at a pinned version after local encrypt/decrypt + rekey-on-ban
  receipts (none exist); upstream x0x MLS has no RFC 9420 interop and incomplete rekey on leave.

## 4. Numbers you must design against (see scale.md, x0x.md; recompute anything you use)

- Floor load: 10^10 users x 1 op/day = 115,741 ops/s average (ruled order). Messaging will be
  far above that: DECLARE your workload model (msgs/user/day, group size distribution, devices
  per user, retention default, replication factor) explicitly as assumptions with ranges.
- PQ sizes: ML-DSA-65 sig 3,309 B, pk 1,952 B; ML-KEM-768 ct 1,088 B, ek 1,184 B; X-Wing pk
  1,216 B, ct 1,120 B; SLH-DSA-SHAKE-256f sig 49,856 B (once per algorithm era). A 200 B
  message signed per-message with ML-DSA-65 is ~3,641 B (signature = 91%). Signature
  amortization is a first-class design problem.
- x0x idle cost: public-mesh idle ~52-142 MB/min per device (third-party wire figures; our own
  86 MB/min is an app counter): ~75 GB/day per idle leaf. Phones cannot be full mesh peers.
  x0x is UDP-only (no TCP/obfuscated rung), single global presence topic, scope "one owner with
  2-5 machines", 15 ADRs still Proposed, store delivery failures under shedding (fix unreleased).
- Connections: 2e10 device connections at ~100k/box = ~200,000 boxes if always-connected;
  connection count binds before bandwidth.
- Storage: retain-everything is 1.33-133 MB per user-year per replica (100x swing on workload);
  Autonomi per-message files ~$385/user-year vs ~$0.11 batched (3,400x lever on the user).
- Today's Buzz: one relay = one community, target 10K humans + 50K agents (~7 events/s);
  huddles server-forwarded N*(N-1), soft cap 25.

## 5. Gaps the critic found that every design must answer (critic.md)

Declared workload model; ML-DSA verify CPU budget (no receipt exists: say how you'd get one);
offline/delay-tolerant delivery (who holds a message while both are offline, how long, who pays);
key loss and recovery incl. WebAuthn RP-domain loss; social recovery (unruled; a 7-agent doc
rejects it); moderation at 10B with no operator, illegal content in immutable stores (counsel
gate); spam economics (sender-pays postage vs "no person pays to use a BNR function");
metadata privacy (who-talks-to-whom; x0x DM envelope exposes ids in clear); mobile + push
(vendor wake-ups only as enhancement); accessibility; governance of wire-protocol upgrades in a
mixed-version mesh; ONE message format of record (six envelopes coexist today: NIP-01, x0x
DmEnvelope, bChat v1, CanonicalEvent, WB001, bheart.signature/1); migration of today's users,
history and 18 agents (buzz-acp treats AUTH denial as terminal); censorship (SNI, UDP blocking);
real-time voice (x0x voice is 2-party; Buzz huddles 25/255).

## 6. Deliverable format (each designer)

Write ONE markdown design to the path you are given (aim 20-40 KB). Sections, in order:
0. One-paragraph thesis and the design's name.
1. Plane mapping, and the ESCALATIONS table (collision, cited rule, what the design does
   without a ruling, what changes if the founder rules otherwise).
2. Identity, devices, agents, keys, succession, recovery.
3. The envelope of record: canonical encoding, algorithm ids, signature scheme(s), signature
   amortization, sizes (computed), compatibility with NIP-01/bChat v1/CanonicalEvent.
4. Confidentiality: pairwise, groups, metadata; exact allowed claim wording.
5. Roads/transport: multi-road, censorship ladder, x0x's exact role, relays' role.
6. Durability, offline delivery, retention, RETAIN/FORGET, archive (batching), BNRoSe reuse.
7. Scale: declared workload model (assumptions + arithmetic), no global state, connection
   model, mobile/push, sharding/federation, verify-CPU budget.
8. Economics: every resource metered, payer of record per resource, free tier, spam, the
   ten-billionth-user test passed explicitly.
9. Moderation and abuse.
10. 1,000-year continuity: crypto agility, re-anchoring of history, formats, time (L4),
    protocol-upgrade governance, extinction drills.
11. Tungsten conformance matrix: each axis 1-6 and law L1-L5 -> named test family, pass/fail
    criteria, evidence class, formal obligations (e.g., envelope canonical-encoding injectivity
    via the WB001 ladder), teeth.
12. Migration from today's Buzz (users, history, 18 agents, relay, buzz-acp/cli).
13. Build plan: phases P0..Pn, each with owner seat, reused crates, acceptance criteria that
    are receipts, and what it unblocks. P0 must be doable now without any pending ruling.
14. Open questions and risks.

Rules: cite or mark UNVERIFIED; never stronger than "sound by construction / isolated by design";
recompute every number you use and show the arithmetic; no invented rulings; plain words.
Read-only on the repo: do not modify, commit, push or post anything. Write only your design file.
