# READER NOTES — identity, personhood, privacy, ruled scaling arithmetic

Reader area for the PQ-Buzz (x0x / BNRoSe) design. Facts only, no design.
Repo root R = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3`.
LD = `C:/Users/travi/LOVErnment-DAO/specs`. X0X = `C:/Users/travi/x0x-pr` (local checkout at `e0af580`).
Kinds: RULED (founder/governing text) · MEASURED (receipt with real output) · CLAIMED (asserted, no receipt) · UNVERIFIED.

---

## 0. Line-number corrections to the brief and to CLAUDE.md (verified 2026-10-15)

`docs/bzdid-architecture-decision.md` has grown (the registrant-pays invariant block was inserted at :144-260), so the CLAUDE.md citations drifted:

| claim | CLAUDE.md says | actual line |
|---|---|---|
| "Vaulta stores 143 KB regardless of ... 1 million users or 10 billion" | :29 | **:29** (unchanged) |
| native Vaulta account ~2,996 B, free tier gets none, "dead before it starts" | :61 | **:61** |
| 144-row ring overwrite, "Net RAM delta: **0 bytes**" | :137 | **:142** (action signature at :139) |
| "No authoritative store must exist for a free identity to work" | :245 | **:390** (:245 is now the Seat-1 ruling (a) paragraph) |
| `kingbeelovis` frozen: "no new registrations, code unchanged" | :292 | **:437** (:292 is now "Global uniqueness is already broken on mainnet") |

Other stale items in CLAUDE.md, found while reading (do not act on them; recorded for the designers):
- CLAUDE.md §6.2 says BIO-1 v0.2 is "drafted ... unratified". `LD/BIO-1.md:3` says **APPROVED — v0.2, 2026-08-07** (git `23f03ff`). No `BIO-1.v0.2-PROPOSED.md` exists in LD. (MEASURED by file read + `git log`.)
- CLAUDE.md §2a says R8 "holds its Layer-1 wording pending an A1 nod". `R/docs/dispatches/DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8.md:5` says A1 RULED 2026-08-07, "The hold is LIFTED". (MEASURED by read.)
- Internal number drift inside the architecture doc: :29 says "143 KB"; the footprint table says **148,156 B = 144.7 KiB** (:353). The table is the computed figure. (CLAIMED arithmetic, both lines in the same doc.)

---

## 1. How identity must work at 10B (the ruled shape)

**1.1 The root is `did:b:` (bzDiD), self-certifying, free, zero chain bytes.**
- `bzDiD = "did:b:" || base32( sha256(dag-cbor(genesis_op)) )`, full 256 bits, 52 chars (`R/docs/bzdid-architecture-decision.md:56`; 128-bit truncation rejected for adversarial birthday work, :19). Code: `R/crates/bzdid/src/did.rs:12-14`, `lib.rs:9-16`. RULED (decision doc) + code.
- "Uniqueness is collision resistance, not agreement. No issuer, no ordering, no registry, no DA, no chain bytes, no cost." (:18) RULED.
- Creation: "Bytes written to any blockchain: **zero**. Cost to BNR: **zero**." (:59). RULED.
- "No authoritative store must exist for a free identity to work." (:390). RULED.
- VOCABULARY Law 7 (founder order 2026-10-06): `did:b:` is THE root; "`did:autonomi`, `did:webvh`, `did:plc`, `did:web`, and every other method ... are **bound publication/transport personas or anchors — never competing roots.**" (`R/docs/VOCABULARY.md:220-226`). RULED.
- Law 6: spelling is bzDiD; byte-level v1 KDF labels stay `BDID-v1/...` incl. `BDID-v1/ml-dsa-65-record-key`, `BDID-v1/x-wing-kem-key` (`R/docs/VOCABULARY.md:170-189`). RULED.
- R8 ruled shape: "Layer 0 — bDiD keypair (scales to 10^10, free): ... Zero network writes, zero cost, no global consensus required to be born. Owner attestation binds agent keypairs to human keypairs." (`R/docs/dispatches/DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8.md:13`). Layer 2 anchors "(millions, NOT billions)" and "adapter transfer or loss can NEVER rebind a Layer-0 keypair" (:15). RULED ("founder-confirmed — do not re-litigate", :9).
- RULINGS-2026-09-16 R1 (ratified): "Human sovereign identity is a Layer-0 bzDiD keypair ... No public chain account is required for it, and no permanent mapping between a human identity and any wallet or stored object may appear in public settlement data or public receipts." (`R/docs/RULINGS-2026-09-16.md:26-29`). RULED.
- Constitution Art II identity invariants: "Records key off the **DID** (stable identifier), never raw public keys. Key rotation must never orphan data." and "The rotation log records **key algorithm**" (`R/docs/CONSTITUTION.md:49-50`). Cross-identity links verifiable only when **bidirectional** (:52). RULED (but see Gap G1 on the Constitution's DRAFT header).

**1.2 The genesis op already carries PQ key cards.**
- `KeyAlg` is a closed enum `{Ed25519, MlDsa65}`; "An unlisted id is added BY RULING, never by a caller"; ML-DSA-65 public key 1952 B (`R/crates/bzdid/src/genesis.rs:35-64`). Max 8 rotation keys, 16 services/alsoKnownAs strings of ≤256 B (`genesis.rs:86-88`). MEASURED (code).
- ML-DSA-65 signature 3309 B (`R/crates/atmirror/src/record_sig.rs:49,95`). MEASURED (code constant).
- The verifier hashes the HANDED bytes, never a re-encoding ("stored-bytes law", `genesis.rs:26-30`; `lib.rs:105-124`). RULED-in-code.
- The per-identity epoch anchor is <300 B and "identity validity never needs it" (`R/crates/bzdid/src/anchor.rs:3-4,26-28`). MEASURED (code + test).
- Rotation: `succession::resolve_did` walks the signed op chain and "fails closed on every ambiguity"; "the did never moves, only the keys do" (`lib.rs:19-25`). MEASURED (code).

**1.3 Accounts / peer IDs are bindings, never the identity.**
- Persona model: `PersonaRef {Plc, AtProto, Evm, Zano, Nostr}` (#[non_exhaustive]); Nostr is self-custodial (`R/crates/onboarding/src/lib.rs:83-108`). "a new persona variant must decide its own custody status here" (:101-102). There is **no x0x variant** today. MEASURED (code).
- Disclosure is per-binding, default `Selective`; `Pairwise` = "A distinct root-derived id per relying party"; `Public` explicit and irreversible (`lib.rs:113-133`). RULED-in-code.
- "Everything economic keys off the ROOT, never a persona" (`lib.rs:25-27`). RULED-in-code.
- Agent/service identity "MAY hold public chain accounts ... Nothing may make such a public mapping a REQUIRED payment mechanism" and "Public agent identities never weaken human privacy" (`R/docs/RULINGS-2026-09-16.md:30-41`). RULED.
- Device PQ identity is its own `bzpq1` id bound by a two-signature binding; "The bzDiD phrase is never loaded onto a device" (`R/docs/RULINGS-2026-10-04.md:59-66`). RULED.

**1.4 A unique key is not a unique human.**
- "Custody is not uniqueness. One person may hold fifty secure elements." (`LD/PERSON-1.md:36`). RULED (frozen v0.1, git `5066aaf`).
- "A multiple bzDiD cannot be detected and this system does not attempt to detect one." (`R/docs/brespect-sybil-unlock.md:27`, proposed amendment text in a Seat-3 synthesis). CLAIMED (seat synthesis; consistent with PERSON-1 §2).
- T1 passkey "**Unlocks nothing.**"; T2 hardware "Raises what you may **do**, never what you may **earn**."; T3 Respect (fractal peer attestation) "The only tier that opens the 420 cap" (`LD/PERSON-1.md:148-152`). RULED.
- bTunGsTeN L1 (founder ruling 2026-10-09): "bTunGsTeN must sustain at least 10 billion unique, ACTIVE sovereign users continuously across a 1,000-year operational horizon"; per epoch "no epoch contains two distinguishable sovereign claims to one human, and no active human is unrepresentable" (`R/docs/specs/SPEC-BTUNGSTEN-1.md:90-101`). RULED.
- Seat Sovereignty (founder ruling 2026-10-07): "no verifier needs access to that human's underlying biometric or civil identity to establish eligibility" (`R/docs/specs/SPEC-SKAISTS-SEAT-SOVEREIGNTY-1.md:29-34`). Ratification: "live PROVE = UNVERIFIED", non-inheritance law (:138-146). RULED; live uniqueness proof NOT BUILT (:124).

**1.5 No 1:N gallery, ever.**
- P-3: "**No global biometric template registry. Ever.**" (`LD/PERSON-1.md:72-73`). RULED.
- P-4 NO-DNA (`LD/PERSON-1.md:75-76`); B-5 (`LD/BIO-1.md:59-60`). RULED.
- B-1: "If a bit was computed from a body, it stays on the body's device." (`LD/BIO-1.md:35`). RULED.
- B-2: "No 1:N comparison, at any gallery size, for any purpose, ever." (`LD/BIO-1.md:38`). RULED.
- B-3: no biometric-derived identifier crosses the kernel seam (`LD/BIO-1.md:40-41`). RULED.
- B-4: "**The camera is a window, never an instrument.**" (`LD/BIO-1.md:44`). B-4a on-device 1:1 exception, five conjunctive conditions (:46-57). RULED (v0.2).
- P-10: "never to a registry of persons" (`LD/PERSON-1.md:117`); §7 "**The soul ring is not a database.**" (:210). RULED.
- 1:N arithmetic: false hits ≈ N×f; at N=10^10, f=10^-12 → "10⁸ people falsely told they already exist" (`LD/PERSON-1.md:40-46`). RULED (arithmetic in ratified text).

---

## 2. What may and may not be on-chain (ruled arithmetic)

- A native Vaulta account is ~2,996 B and O(n); "Free-tier users get **no native Vaulta account** ... Any design promising 10 billion people a Vaulta account is dead before it starts." (`bzdid-architecture-decision.md:61`). RULED.
- Risk 1: "The free tier has no native Vaulta account, forever"; earliest signal = any core requirement needing `eosio` account-level auth for a free user (:488). RULED.
- Fixed on-chain footprint 148,156 B at 1M, 100M, 10B users, Δ = 0 (:353-361); one-time cost "$3.56, once, forever, for 10 billion identities" (:370). CLAIMED arithmetic (row overhead ~112 B is an estimate, :341, :502).
- Naming commit overwrites a 144-row ring: "Net RAM delta: **0 bytes**" (:139-142). Commit measured 356 B cold / 0 B on wrap on Jungle4 (:219-221). MEASURED.
- Forced commit folds into a 32-byte accumulator: zero RAM, ~500 B NET, ~$0.001 (:314). CLAIMED.
- R8 receipt (endpoint deliberately not one BNR signs through): max_ram_size 390.17 GiB, unallocated 70.87 GiB; ~3,446 B per vanilla `newaccount`; 10^10 accounts need 31.34 TiB = **82.3×** supply (142.8× with `.b` rows); accounts that fit in all unallocated RAM 12.7M–30.0M depending on bytes/account (`R/docs/RECEIPT_R8_VAULTA_RAM.md:14-50`). "the constraint is supply, not cost. 100 GiB is not purchasable at any price" (:74-75). MEASURED.
- Paid-tier ceiling: $1M → ~8.98M accounts; full reserve 70.892 GiB → 25.4M; "any price → impossible — relay asymptote" (`bzdid-architecture-decision.md:406-414`). "must never be marketed as a growth path" (:414). CLAIMED arithmetic (Bancor fit, :368).
- SPEC-VAULTA-IDENTITY-1 §0.1: full accounts ~3.2×10^8 rows at max_ram_size, "31.5x SHORT of 10^10"; "The per-user identity = Layer-0 keypair. Zero rows, zero cost" (`R/docs/SPEC-VAULTA-IDENTITY-1.md:38-46`). CLAIMED (spec, founder-gated).
- Bytes-per-account figures disagree across docs: 2,537 B (`.b` registry user, `RECEIPT_R8_VAULTA_RAM.md:77-79`), ~2,996 B (`bzdid-architecture-decision.md:61`), ~3,446 B measured vanilla (`RECEIPT_R8_VAULTA_RAM.md:52`). All sit two orders short of 10^10 either way.
- Proof root is not data availability (ratified): "a state root ... anchored on any rail is a commitment, not evidence that witnesses, receipts, or private state are recoverable" (`R/docs/RULINGS-2026-09-16.md:56-61`). RULED.
- Bounded rows: "the chain holds the LAW ..., the commitment set, and the nullifier set — never bulk history. History and private state live under the member's own key on Autonomi" (`R/docs/specs/SPEC-PRIVACY-1.md:108-111`). CLAIMED as "standing law" in a seat spec.
- Article V.3: "Identity, storage, messaging, evidence, and knowledge scale without global coordination; ordered settlement does not, and most interactions must never require it." (`R/docs/CONSTITUTION.md:85`). RULED (see G1).
- bTunGsTeN L3: "No population-scale approval storage at the execution primitive" (`SPEC-BTUNGSTEN-1.md:122-129`); L2 no long-lived serialized execution intent (:110-115). RULED.

---

## 3. Who pays (user-pays law, the hardline)

- Art V.1: "**The kernel SHALL NOT require continuous operator subsidy for normal operation.** Users fund the resources they consume ... The paymaster *abstracts* user-funded payment; it must never *absorb* cost." (`R/docs/CONSTITUTION.md:83`). `resource.accounting` row: "never subsidizes" (:128). RULED.
- REGISTRANT-PAYS hardline (Seat-1 ruled (a), 2026-08-09): "THE LINE IS EPOCH-FIXED vs PER-RECORD — not on-chain vs off-chain." (:148). "BNR funding must never gate how many users can exist" (:187-188). Test: "*does this cost grow with the number of names?* If yes, it is claimant-funded" (:199-200). "A per-name cost hidden inside an epoch-level operation is still a per-name cost, and packaging is not funding." (:201-202). RULED.
- `x-paid-by` is ONE delegate per DataItem (`crates/atmirror/src/arweave.rs:54,218-220,264` per :225-229) — one payer per item. MEASURED (code read by Seat 3).
- KISS ruling: "A unique bDiD ships with **a PASSKEY and a WALLET**, the wallet funded to cover the **basic adapter tokens**" (`R/docs/dispatches/RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08.md:6`); funding source is "research + options" (:26). RULED shape, funding UNRULED.
- CD-13 creation floor: allocation below any per-resource floor "is **refused pre-purchase with the failing minimum named** ... no half-born accounts" (`R/docs/feature-backlog.md:302-306`). Status "CAPTURED, NOT SCHEDULED" (:261, :275). RULED direction, unbuilt.
- R3 / onboard: "BNR is never in the flow of funds" (`R/docs/RULINGS-2026-07-26.md:47-49`); "no key custody, no signing on behalf of users, no receiving addresses owned by BNR anywhere in the flow" (`R/docs/SPEC-BNROSE-ONBOARD.md:74-76`). RULED (scoped to the onboard flow).
- Lite identities "carry identity and attribution, never value" (`R/docs/RULINGS-2026-07-26.md:10-13`). RULED.

---

## 4. Naming (.b / .a / bNames)

- Canonical authority: "exactly one Vaulta account, hard-coded in every client ... Any name asserted by any other contract is not a `.b` name." (`bzdid-architecture-decision.md:301`). RULED.
- Key: `n = skeleton(NFKC(lowercase(input)))`, UTS-46 + confusable skeleton, `k = sha256("b:v1:" ‖ n)` (:65); commit-reveal, earliest commit epoch wins (:307). RULED.
- `kingbeelovis` "is **frozen**: no new registrations, code unchanged" (:437). RULED. CLAUDE.md §6.3 records that the "no new registrations" half is documentary, not enforced (`registeracc` is `require_auth(registrant)` only). CLAIMED (seat scout).
- Scarce names paid only; ≤5 chars permanently premium; "the free tier's unlimited names are self-certifying bzDiDs and DNS-bound handles" (:335). OAuth nullifier rejected (:335, :496). RULED.
- DNS handles: "a registrar or a court can take your handle. Your bzDiD and your funds are unaffected; your name is not." (:324). RULED.
- Phase 4 test of decentralization: "an independent third party produces a valid epoch root on mainnet while BNR's node is switched off" (:331). Not passed (Phase 3 not built). UNVERIFIED.
- SPEC-A-NAMES-1 (DRAFT): `.a` = agents, rooted under a being's `.b` bzDiD (`R/docs/specs/SPEC-A-NAMES-1.md:11-12,32-35`); proposes reusing `kingbeelovis` `registeracc` (:18-20); proposes NFC + per-tongue lowercase + FNV-1a-64 key (:85-105, "PROPOSAL ... pending the founder's word"). CLAIMED.
- R8 scope fence: "No new naming systems, no additional layers" (`DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8.md:35-36`). RULED.

---

## 5. Agent identity and authority

- Hierarchy (Seat 0, 2026-08-07): "bQueenBee is the ONLY agent holding its own bDiD. Every other AI/agent falls either under bQueenBee, or under a unique bDiD/Human." (`R/docs/dispatches/RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:14-15`). Agents earn under that identity, incl. "running Buzz/meshLLM nodes (provide RAM, earn b)" (:16). RULED. Amendment pointer: only Autonomi/ANT is a verified permissionless contribute-to-earn rail (:46-47). RULED amendment.
- Autonomy ruling 2026-08-29 (pointer only, source text not read here): SOVEREIGN/SUPERVISED axis RETIRED; agents "fully autonomous"; spend caps are "the owner's optional tool" (:4-10). RULED (by pointer).
- AGENT-1 v0.3 (APPROVED, frozen, git `acbb165`): A-1 "Any agent holding a user's private context runs on-device and fails closed" (`LD/AGENT-1.md:42`); §1.1 "encrypted between you, your friend, and a language model in a datacenter. That sentence must never ship." (:30); A-7 "Identity is not quota" (:62-63); A-8 "Capability is scoped by the tool surface, not by instruction" (:65-68); A-10 "Revocation is a physical act ... must work while offline" (:73-74); Q-2 untrusted text never shares context with write authority (:155-158); Q-3 no autonomous replies/reposts/likes/follows for bQueenBee (:160-163); Q-5 "Authority expires. Dead-man's switch." (:168-169); L-1 bLOVErAi: "No DID. No network write authority. Ever." (:198). RULED.
- AGENT-1 v0.4 is PROPOSED, UNRATIFIED; "Until he does, v0.3 stands and is what binds." (`LD/AGENT-1.v0.4-PROPOSED.md:3-7`). It proposes A-0 scope (the Royal Beehive Intelligence chair not an agent by default) and narrowing A-5/A-6/A-7. UNVERIFIED as law.
- P-8: bLOVErAi "may not decide who is real"; "machine DIDs cost nothing to create, so a machine DID never carries quota" (`LD/PERSON-1.md:107-112`). RULED.
- SPIRIT-1 §5: "Total lifetime emission capacity = 420 × (souls + spirit) ... No other machine identity ever enters the multiplicand" (`LD/SPIRIT-1.md:46-47`). RULED.
- SPEC-BLOVERAI-BZDID-BONDING-1 (SPEC-ONLY): agent key is its own keypair, "Never the human's key"; `bond.permanent = true (one human <-> one agent)`; revocation path and attenuation UNRULED (`R/docs/SPEC-BLOVERAI-BZDID-BONDING-1.md:29-58, 94-105`). CLAIMED/UNRULED.
- Chain fact: permission-management actions "can NEVER be delegated to a linked permission" (`SPEC-BLOVERAI-BZDID-BONDING-1.md:113-122`, source-stamped `authorization_manager.cpp:295-301`). CLAIMED (cited, not re-verified here).

---

## 6. Privacy law (the parts a messaging design touches)

- R1 2026-09-16 (above): no permanent public human↔wallet/object mapping. R4: "no wallet-global public identifier may link multirail intent legs." (`R/docs/RULINGS-2026-09-16.md:65-71`). RULED.
- Receipts: "private by default; visibility is access-control, not a label; widening is consented and non-retroactive" (`RULINGS-2026-09-16.md:35-37`). RULED.
- Address disclosure: 64-slot padded vector, "**Publication is never the default.**", one `InformedConsent` per reveal, no "disclose all" (`bzdid-architecture-decision.md:87-93`). RULED.
- P-5: "The protocol never detects duress. No field, no flag, no score, no classifier" (`LD/PERSON-1.md:86-91`). RULED.
- BIND-1 K-5: "A single relay subscription yields informational-grade crossings only"; "Single-source social evidence informs; it never triggers. Asking one oracle twice is not independence." (`R/docs/BIND-1.md:41`); G-2 = 2-of-3 disjoint sources (:121-122); K-4 every kernel allowlist addition is a founder gate (:38). RULED. Same doctrine for chain views: R-004 (`R/docs/risk-register.md:14`).
- Founder note in an HTML comment: "full multipersona unlinkability is NOT a requirement — 'privacy is a rail choice, use Zano'" (`R/docs/brespect-sybil-unlock.md:4-6`). CLAIMED (reported ruling, no source quoted); later R1 2026-09-16 is the ratified text.
- Privacy lane crypto is PLONK over BN254 (`R/docs/specs/SPEC-PRIVACY-1.md:124-128`; D1 in `RULINGS-2026-09-16.md:98-103`); "Cryptographic agility remains law (algorithm ids on every row ...)" (:101-103). RULED. Whether a pairing-based BN254 system meets a post-quantum horizon is not addressed in these texts: UNVERIFIED (my reading; no source in my area claims it).

---

## 7. Collisions with "every user has an x0x ML-DSA identity, a relay membership, or on-chain state"

ESCALATE by name; none resolved here.

1. **Per-user on-chain state** collides with `bzdid-architecture-decision.md:61` + :488, R8 Layer-2 "millions, not billions" (`DISPATCH_..._R8.md:15`), R8 receipt 82.3× (`RECEIPT_R8_VAULTA_RAM.md:44`), and RULINGS-2026-09-16 R1 ("No public chain account is required").
2. **x0x ID as THE identity** collides with VOCABULARY Law 7 (`VOCABULARY.md:220-226`). x0x `MachineId`/`AgentId`/`UserId` are each "derived from ML-DSA-65 keypair" via SHA-256 of the public key (`X0X/src/identity.rs:21-42`). A key-hash ID changes when the key changes; Constitution Art II requires records key off the DID "never raw public keys" and "Key rotation must never orphan data" (`CONSTITUTION.md:49`). A grep of `X0X/src/identity.rs` for "rotat" found no rotation (MEASURED negative search, file-scoped). x0x key-move moves the same key between machines (`X0X/src/key_move.rs:1-20`). An x0x key can sit inside a bzDiD as an `ml-dsa-65` key card or as a bound persona; there is no `PersonaRef` variant for it yet (`onboarding/src/lib.rs:83-108`).
3. **x0x `UserId` is a cross-context correlator by design**: "enables trust scoring across machines: 'user X has used machines X, Y, Z.'" (`X0X/src/identity.rs:38-40`). Collides with R1/R4 2026-09-16 and the per-binding `Selective`/`Pairwise` default.
4. **x0x `AgentCertificate` publishes user↔agent bindings in gossip announcements** (`X0X/src/identity.rs:508-512`) and "**absence of expiry means valid forever**" (:478-479). Collides with AGENT-1 Q-5 (authority expires), A-10 (offline physical revocation), "Public agent identities never weaken human privacy" (R1.2), and the unruled revocation path (BONDING §3.4).
5. **Relay membership as the gate** (`R/docs/specs/SPEC-BCHAT-1.md:104-110`: "'restricted: not a relay member'") is a per-user roster held by an operator. Collides with Art V.3 (messaging without global coordination), bTunGsTeN axis 1 "No indispensable corporation, server, validator, identity provider" (`SPEC-BTUNGSTEN-1.md:43-46`), P-10 "never to a registry of persons", and Constraint 2 (BNR not in the trust set, `bzdid-architecture-decision.md:35,330-331`). A BNR-hosted relay storing everyone's messages is also an operator subsidy under Art V.1 and the per-record test (:199-200).
6. **Community identity = a DNS name**: "the community's canonical name (`skaists.buzz`) is identity, never transport" (`R/docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:38-40`, PROPOSED). The ruled caveat on DNS handles (:324, "a registrar or a court can take your handle") and tonight's SNI filter outage both bear on that.
7. **Counting keys as humans** collides with PERSON-1 §2 (custody is not uniqueness), B-2, and bTunGsTeN L1 (uniqueness of ACTIVE sovereigns, not records). Uniqueness evidence is the cascade's (T3) alone (`BIO-1.md:38`).
8. **Biometric-derived uniqueness**: BIO-1 v0.2 records a founder thesis, "anti-duplication bDiD by comparing hashes of freely-accessible biometric-generated PUBLIC keys" (`LD/BIO-1.md:18`), and claims no collision with B-2 (:20). Read against B-1 ("If a bit was computed from a body, it stays on the body's device", :35) and B-2's first sentence ("Biometrics are never uniqueness evidence", :38), this is an unresolved tension inside approved text. Any Buzz/x0x admission step that uses it must be escalated, not designed.
9. **Agents in E2EE groups (MLS)**: a remote-LLM agent member reads plaintext. AGENT-1 §1.1 and A-1 forbid shipping that under an E2EE claim unless it is "a distinct, user-visible, per-session, explicitly-chosen mode" (`LD/AGENT-1.md:30,42-45`). bLOVErAi cannot be a network member at all (L-1, :198).
10. **Agent identities outside the hierarchy**: any agent with its own root identity other than bQueenBee collides with the 2026-08-07 hierarchy ruling (:14-15). x0x lets one `UserId` own multiple agents (`X0X/src/identity.rs:36-40`); the bonding spec says one human ↔ one agent, permanent (`SPEC-BLOVERAI-BZDID-BONDING-1.md:54`, SPEC-ONLY).
11. **Agent replies/endorsements**: Q-3 forbids autonomous replies/reposts/likes/follows for bQueenBee (`LD/AGENT-1.md:160-163`); the 2026-08-29 autonomy ruling relaxed approval gating. Frozen AGENT-1 v0.3 vs the dispatch ruling is a law-book conflict for any chat agent that posts. ESCALATE.
12. **A third naming registry** (handles for Buzz users/agents) collides with the one-canonical-authority rule (:301), the R8 "no new naming systems" fence, the `kingbeelovis` freeze (:437), and the unratified `.a` normalization that differs from `.b`'s skeleton rule (SPEC-A-NAMES-1:93-105 vs :65).
13. **Grant/onboard on Vaulta per user**: the b grant "Requires the user to have a Vaulta account" (`SPEC-BNROSE-ONBOARD.md:36`, G7 :145), which cannot reach 10^10 (:61). Also "grant value must stay strictly below the ~$10 walk cost" (:91-93).
14. **Anchoring chat-log roots on chain as "storage"**: R3 2026-09-16, proof root ≠ DA.
15. **Single-relay evidence promoted to kernel/settlement**: BIND-1 K-5 / G-2, R-004.
16. **The identity root's own PQ status**: bzDiD is SHA-256 over the genesis op and already accepts `ml-dsa-65` cards, but the ruled `.b` leaf is sized for a 64-byte signature: `sig [u8;64]`, ≈185 B → 192 B padded (`bzdid-architecture-decision.md:74-82`). With a 3309 B ML-DSA-65 signature the leaf would be about 3,430 B (my arithmetic: 185 − 64 + 3309). The DA tables at :383-400 then understate per-name bytes by ~18×. That is still claimant-paid under the hardline. No receipt re-derives this: UNVERIFIED.

---

## 8. Gaps (named, not filled)

- G1 `R/docs/CONSTITUTION.md:3` header reads "DRAFT v0.1 — for founder review", while Art VI §3 says it was ratified 2026-07-11 (:97). CLAUDE.md ranks the Constitution #1, and RULINGS-2026-09-16 R5 cites Art V as the basis of a founder ruling (:87-90).
- G2 RELAY_22 (correlation §2a, custody §5a) is cited only through code and doc comments (`onboarding/src/lib.rs:96,148-158`). Its primary text was not located in `R/docs`.
- G3 PERSON-1 P-6 ("Users therefore hold `did:plc`", `LD/PERSON-1.md:98`) and P-10 (`did:autonomi` root, :118) predate Law 7's `did:b:` root. BIND-1 settlement grade requires `did:plc ↔ did:autonomi` (`BIND-1.md:41,83`). The frozen specs have not been re-gated.
- G4 Agent revocation, attenuation, and the earning→spending loop are UNRULED (`SPEC-BLOVERAI-BZDID-BONDING-1.md:94-109`). The 2026-08-29 autonomy ruling text was not read here (pointer only).
- G5 Who funds the KISS genesis wallet at 10^10 is unruled (`RULING_KISS_...:26`).
- G6 There is no live uniqueness proof system: SK001 live PROVE, hiding COMMIT, and SETTLE are all UNVERIFIED (`SPEC-SKAISTS-SEAT-SOVEREIGNTY-1.md:138-141`). PoUL/vouch graph "Implementation is a beta milestone" (`R/docs/dispatches/SYBIL_IMMUNITY_RESOLUTION.md:40`, seat doc).
- G7 bzDiD Phase 3/4 are not built. BNR is the sole sequencer at launch, `owner`/`active` are not burned, and Constraint 2 is not met (`bzdid-architecture-decision.md:330-331,473`).
- G8 The "187-bit pointer" ruling is unlocated (`SPEC-VAULTA-IDENTITY-1.md:48-51`).
- G9 The bytes-per-account constant has three figures (2,537 / 2,996 / 3,446). The headline footprint has two (143 KB / 148,156 B).
- G10 x0x identity semantics come from code comments in one local checkout (`e0af580`). Upstream changes after that commit, and how `derive_peer_id_from_public_key` is implemented in ant-quic, were not checked: UNVERIFIED.
- G11 `SPEC-A-NAMES-1` "$1/24h genesis allowance" is marked "ruled" inside a DRAFT spec (:43-44). Its ruling source was not located.
