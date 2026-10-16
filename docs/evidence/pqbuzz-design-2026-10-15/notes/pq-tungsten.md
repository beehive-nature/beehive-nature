# Reader notes: post-quantum layer and the bTunGsTeN standard

Reader area: PQ layer + what "tungsten gold standard" means in this estate.
Repo root for citations: `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` (HEAD `69ef2c717`, 2026-10-15).
Classes: RULED (founder/governing text), MEASURED (receipt with real output), CLAIMED (asserted, no receipt here), UNVERIFIED.
Read-only. Nothing designed here. Wording ceiling held: nothing below is stronger than "sound by construction / isolated by design". "PROVEN" is used only as the estate's result class (implementation equals spec over a stated domain), never as a security claim (`docs/specs/SPEC-BTUNGSTEN-PQ-1.md:15-19`).

---

## 0. The one-paragraph answer

In this estate "tungsten" is not an adjective. It is SPEC-BTUNGSTEN-1, a conformance standard whose founder order says it must stay "a measurable conformance system rather than a slogan" (`docs/specs/SPEC-BTUNGSTEN-1.md:6-7`, RULED). A property counts only when it reduces to a reproducible adversarial test with assumptions, pass/fail criteria named before the run, evidence, and a machine-verifiable receipt whose verdict is computed from observations (`SPEC-BTUNGSTEN-1.md:28-31`, `:420-427`, RULED). "Immunity" means immunity inside a published adversarial model, never absolute (`:33-34`, RULED). The genesis dispatch states "no system is bTunGsTeN-conformant today, and the spec says so by construction" (`docs/dispatches/2026-10-06-btungsten-lane.md:45-47`, RULED-as-recorded). A sibling lane's acceptance explicitly "does not certify a universal gold standard" (`docs/dispatches/2026-10-03-tungsten-chain-acceptance.md:62-63`). So a "tungsten gold standard" Buzz is a design whose every claim names its receipt class, its teeth and the boundary it does not cross.

---

## 1. SPEC-BTUNGSTEN-1: categories, laws, evidence grades (RULED)

### 1.1 The standard (verbatim, `SPEC-BTUNGSTEN-1.md:19-22`)
> bTunGsTeN proves that a sovereign digital system can preserve identity, authenticity, continuity, recoverability, and verifiability across adversarial attack, infrastructure loss, technological replacement, planetary scale, and generational time.

### 1.2 Six axes (conformance categories) `:41-73`
1. Decentralization: "No indispensable corporation, server, validator, identity provider, administrator, jurisdiction, or master key." Test = REMOVE major components and prove continued operation (`:43-46`).
2. Sybil/MiM resistance: uniqueness, liveness, authenticator binding, verifier/transaction binding, replay, relay, unlinkability; each "immune" only within the TAM (`:47-50`).
3. Autonomous healing: kill nodes, corrupt replicas, partition, poison routes, retire providers, incompatible versions; recover WITHOUT a privileged human operator (`:51-55`).
4. Autonomous learning: "learning must never silently rewrite constitutional/security invariants"; learned changes "bounded, testable, reversible, attributable, and receipted" (`:56-60`).
5. >10B users: identity population, active devices, concurrent auth load, tx/proofs per second, partitions, storage growth, recovery load, adversarial load; needs "credible mathematical scaling bounds PLUS progressively larger physical tests" (`:61-65`).
6. >=1,000-year continuity: crypto-agility, protocol migration, replaceable adapters, self-describing data, long-lived verification formats, key succession/recovery, epoch and clock rollover, archival reconstruction, fork reconciliation, no permanent vendor dependence (`:66-73`).
Honesty clause: it certifies "that the architecture CONTAINS THE MECHANISMS needed to survive replacing essentially everything underneath it" (`:75-83`).

### 1.3 Named laws (founder rulings) `:85-192`
- **L1 Millennium Authority Continuity** (2026-10-09): "at least 10 billion unique, ACTIVE sovereign users continuously across a 1,000-year operational horizon" (`:90-91`). Per epoch: unique attribution; authority changes only through the currently authorized sovereign action; "no dependence remains on ANY original key, signer set, cryptographic algorithm, clock representation, contract implementation, blockchain, organization, or user interface (each extinction is a test row, not a hope)" (`:104-108`).
- **L2 Epochal governance**: "individual transactions and proposals remain short-lived"; a 1,000-year proposal or long-lived serialized execution intent is a violation (`:110-120`).
- **L3 Bounded execution layer**: no population-scale approval storage at the execution primitive; compact verifiable aggregate; no shard, aggregator, UI, chain, signing algorithm or org indispensable (`:122-132`).
- **L4 Time-representation extinction is a boundary**: Antelope `time_point_sec` is u32 seconds, max 2106-02-07 06:28:15 UTC; crossing a clock boundary with continuity and failing closed before it ("no silent wraparound") is a mandatory test family (`:134-144`).
- **L5 Configuration intent is never runtime evidence**: four-receipt boot gate `EXPOSURE -> IDENTITY -> PEER -> AGREEMENT`; "Nine configured peers are not nine connected peers"; one-shot per runtime instance; every downstream artifact carries `submission_source -> execution block N + ID -> verification_source` (`:146-184`).
- Class extension BT-WORKTREE-ISOLATION: SPECIFIED / NOT BUILT / NOT RUN (`:186-192`).
- A failed tungsten test is never quietly turned into integration work (`:226-228`).

### 1.4 Evidence grades (result classes)
- Result-class law (2026-10-07): TYPECHECK, CHECK-SAMPLED, PROVE-UNIVERSAL and EQUIVALENCE are four separate results; "`:check` never as proof"; "A missing tool, a skipped obligation or a solver timeout is NOT-RUN, never success"; a green wrapper is never a substitute for an executed obligation (`SPEC-BTUNGSTEN-1.md:269-275`).
- PQ program adds three: **KAT** (official vectors byte for byte, every case counted), **DIFFERENTIAL** (two+ implementations and the Cryptol spec agree), **INHERITED** (third party's machine-checked proof at a pinned commit; "We did not prove it and never say we did") (`SPEC-BTUNGSTEN-PQ-1.md:32-41`).
- Right-language law: a proof is canonical only if about the DEPLOYED accepted language; "A proof can be correct about the wrong accepted language" (`SPEC-BTUNGSTEN-1.md:278-283`).
- Formal-assurance ladder: `RED counterexample -> accepted-language repair -> shared vectors -> formal wire alignment -> TYPECHECK -> CHECK-SAMPLED -> PROVE-UNIVERSAL -> eventually EQUIVALENCE`; "No step substitutes for a later one" (`:285-295`).
- Per-algorithm ladder L0 INVENTORY, L1 KAT, L2 DIFFERENTIAL, L3 SPEC, L4 EQUIVALENCE, L5 PROVE, TEETH at L1/L2/L4/L5 (`SPEC-BTUNGSTEN-PQ-1.md:51-65`). Partition: big arithmetic INHERITED/DIFFERENTIAL; "Our glue is where this estate's own bugs have lived" and gets L4+L5 (`:67-79`).
- Status words used in the closeout: LOCAL, CI, MAIN; ASSUMED (stand-in) vs ARGUED (written) vs machine (`docs/dispatches/2026-10-09-pq-proof-batch-closeout.md:48-51`, `:69-73`). "Fixed shapes are universal only inside the shape" (`:124-126`).
- Input-boundary law: ill-formed strings REFUSED at encode, malformed UTF-8 REFUSED at decode, never silently replaced (`SPEC-BTUNGSTEN-1.md:256-267`).

### 1.5 Teeth / negative-control doctrine (RULED, verbatim where load-bearing)
- "Every gate has teeth. A planted flaw the gate must convict, run in the same job. A gate whose sabotage control passes is red." (`SPEC-BTUNGSTEN-PQ-1.md:42-43`)
- **T-VACUOUS**: "a verifier must refuse the degenerate shape" (zero openings, queries, rounds, partial signatures, empty manifest, empty vector file, empty PSBT); companion rule: "positions to open come from the verifier's transcript, never from the proof" (`:89-102`).
- **T-TRUNCATE**: "a hash must depend on every input position"; test lengths straddling every block/rate boundary (0, 1, r-1, r, r+1, 255, 256, 257, 4096...) changing only the LAST element (`:103-113`).
- Templates are trusted only after convicting the real defect (vortex `3c0affd9320a`); "If either template passes vortex, the template is broken and every gate using it is red" (`:115-121`). MEASURED: T-VACUOUS convicts vortex `verify()` twice, T-TRUNCATE convicts `RSis::hash()` at len 257 pos 256 (`scripts/btungsten/README.md:97`).
- Harness distinguishes Convicted from Miswired: "a broken test, never a pass" (`crates/btungsten-teeth/src/lib.rs:21-23`).
- WB001 precedent: "if that row ever goes green the battery lost its teeth" (`docs/dispatches/2026-10-06-btungsten-lane.md:57-61`).
- SAW teeth must print a first-order counterexample before counting (`unint_z3` can swallow a tool error as a refutation; use `w4_unint_z3`) (memory `rb-lanes-crux-saw-lessons.md:17`, CLAIMED-lesson). Concrete teeth are sensitivity checks, not universal results (closeout `:127-130`).

### 1.6 Toolchain replaceability (RULED)
Foundation, Emissary, every tool is "REPLACEABLE test infrastructure"; "axis 6 applies to bTunGsTeN's own tooling first" (`SPEC-BTUNGSTEN-1.md:405-409`). x0x/Autonomi/Vaulta/BNR named as "the sovereign substrate under test" (`:404`, `:416`).

### 1.7 Receipt contents (RULED, `SPEC-BTUNGSTEN-1.md:420-427`; PQ form `SPEC-BTUNGSTEN-PQ-1.md:1059-1068`)
Verdict from observations; TAM slice claimed; pass/fail criteria named BEFORE the run; findings with severity and source; counts printed by CI's own run, never a local run; secrets asserted absent; boundary not crossed for every claim; upstream pins; each obligation by name with result class; teeth with counterexample; audit two gates per new crate. "CI's verdict on the landing commit is the receipt."

---

## 2. Algorithm-by-algorithm status (as of HEAD; chronology matters)

Overarching boundary (RULED-as-recorded): "Nothing on main proves ML-DSA-65, ML-KEM-768 or SLH-DSA-SHAKE-256f end to end; 'proven' is true only of the sub-lanes named" (`docs/dispatches/2026-10-09-pq-status-verification.md:267-268`). Closeout: "They do not establish end-to-end security of the entire system." (`2026-10-09-pq-proof-batch-closeout.md:9-11`). Landed on main `9f42d072f`, all eight workflows green (`docs/dispatches/2026-10-10-pq-proof-batch-landed.md:8`, `:40`, MEASURED).

| algorithm | shipped impl | KAT/DIFF | SAW / formal | open |
|---|---|---|---|---|
| **ML-DSA 44/65/87** (FIPS 204) | RustCrypto `ml-dsa 0.1.1` (unaudited), noble 0.7.1 in browser | MEASURED: every ACVP case, 2 Rust impls (RustCrypto + libcrux 0.0.11) inside the 2,729/2,729 total, 137 teeth (`scripts/btungsten/README.md:98`; zCode reproduced on Windows, `2026-10-09-zcode-pq00-pq01-audit.md:21-30`) | PROVEN: field add/sub/neg/cond-sub; NTT = FIPS 204 Alg 41, inverse = Alg 42, multiply_ntt = Alg 45 (15 obligations, CI run 37969815052 / 37985787272) with `Elem` mul ASSUMED (`SPEC-BTUNGSTEN-PQ-1.md:586-614`). Barrett/mul tied for overflow-checks-off builds by 3 links, one ARGUED (`:525-539`) | ZB-1 debug-build Barrett assertion OPEN (`2026-10-09-zcode-pq-proof-batch-review.md:132-136`); shake 0.1.0 (ml-dsa's SHAKE) not SAW-modelable, KAT only (`SPEC-BTUNGSTEN-PQ-1.md:287-291`); L3/L4 message layer not done; libcrux adoption undecided (`:1099-1100`); constant-time NOT established (`zcode-pq00-pq01-audit.md:164-167`); "JS signing is not claimed to be constant-time" (`SPEC-BPQ-1.md:270-272`) |
| **ML-KEM 512/768/1024** (FIPS 203) | RustCrypto `ml-kem 0.3.2` (unaudited), noble | MEASURED: every ACVP case incl. both key checks, 2 impls | PROVEN: field ops, Barrett; NTT = Alg 9, inverse = Alg 10, base-case multiply = Alg 12, multiply_ntt = Alg 11 (8 obligations, run 37955111771); sha3 0.11.0 sponge shapes H/G/J/PRF/XOF PROVEN (`SPEC-BTUNGSTEN-PQ-1.md:540-563`, `:277-286`) | implicit-rejection tooth as own KAT group not yet (`:506-507`) |
| **X-Wing** (draft-connolly-cfrg-xwing-kem-11) | `bpq-core/src/xwing.rs` glue over ML-KEM-768 + X25519 | MEASURED: draft -11 Appendix C 3/3 both implementations (`README.md:108`) | PROVEN: `combiner_input`, `split_seed` EQUIVALENCE; `combinerBinds` PROVE (`SPEC-BTUNGSTEN-PQ-1.md:498-505`) | draft, not a final standard (the -11 revision is pinned, `SPEC-BPQ-1.md:84-85`) |
| **SLH-DSA-SHAKE-256f** (FIPS 205) | fips205 0.4.1 (integritychain) in bsigner; noble in browser | MEASURED: every ACVP case of this set on slh-dsa 0.2.0-rc.5 + fips205 0.4.1; 11 other sets NOT RUN (`README.md:98`) | no Cryptol oracle: cryptol-specs carries SPHINCS+ 3.1, not FIPS 205; UNVERIFIED as FIPS 205 spec (`SPEC-BTUNGSTEN-PQ-1.md:623-626`, `:1095`) | browser handover not built; log-keeper unowned (N-3) |
| **SHA3/SHAKE / Keccak** (FIPS 202) | sha3 0.10.9/keccak 0.1.6 (bsigner); sha3 0.11.0/keccak 0.2.2 (ml-kem, slh-dsa) | spec checks vs FIPS + hashlib | PROVEN: round body all 24 constants (both crates); 24-round loop by `composed` + `agree` joined by one ARGUED transitivity step; sponge at named fixed shapes only (`SPEC-BTUNGSTEN-PQ-1.md:224-291`). NB the 10-09 status dispatch still says "loop READ; sponge not started" (`2026-10-09-pq-status-verification.md:243`); superseded the same day by CI run 37985787272 | aarch64 backend, other lengths, shake 0.1.0 |
| **SHA-256 / HMAC / HKDF** | sha2 0.10.9, hmac 0.12.1, hkdf 0.12.4 | RFC 5869 A.1-A.3 | PROVEN: soft compress (6 obligations); HKDF-Expand at info 21/55/101 bytes only (`SPEC-BTUNGSTEN-PQ-1.md:353-399`); derivation `deriveInjective` over all 7 bzDiD labels (`:328-344`) | SHA-NI path uncovered (scope); `hkdf32` (extract+expand) on a box-local branch, not landed (`2026-10-10-zcode-pq10-review-and-batch-closure.md:136-140`) |
| **secp256k1** (ECDSA K1, BIP-340 Schnorr) | k256 0.13.4; noble | MEASURED: 1,485/1,485 classical KATs incl. BIP-340 19/19 verify, Wycheproof ECDSA (`README.md:109`) | BIP-340 Cryptol spec and tagged-hash EQUIVALENCE NOT yet; Antelope canonical-K1 predicate NOT yet (`SPEC-BTUNGSTEN-PQ-1.md:862-864`) | retained classical BY DESIGN (`:147-148`) |
| **FROST3 / ChillDKG** | chilldkg-rs =0.5.0 ("has not been audited"), feature `frost` OFF by default | MEASURED (local + CI): 2-of-3 signs ML-DSA-authorized PSBT; upstream 64 vector tests; audit gate 1 absent from default build (`README.md:110`) | `intentBeforeNonce` is structural: `VerifiedIntent` only constructible by `verify_spend` (`SPEC-BTUNGSTEN-PQ-1.md:955-958`) | key ceremony, sealed shares, CLI rounds, sighash differential, wallet press (`:1001-1003`) |
| **Plonky3 STARK** (PQ10) | Plonky3 `eab7f0e` | MEASURED: forgery battery 14 classes; "proven 102 bits ... conjectured 111 bits (a conjecture), target 100" (`2026-10-10-zcode-pq10-review...md:110-114`); LEAK v1 FAIL stands, v2 PASS | `rowSound` SAW NOT done; on-chain NOT RUN | "only statistically zk" is the strongest word allowed (`SPEC-BTUNGSTEN-PQ-1.md:769-770`) |
| Ed25519 (classical) | libcrux-ed25519 (HACL*) | 24/24 three-way (`README.md:481`) | INHERITED class for HACL*; SAW of libcrux vs Ed25519.cry NOT claimed (`README.md:493`) | retained classical |

Inventory row for Buzz: A11 BIP-340 "Buzz events (block/buzz `crates/buzz-core/src/verification.rs:11` at upstream `8af2d91f` ... not checked out here, UNVERIFIED)" (`SPEC-BTUNGSTEN-PQ-1.md:140`).

---

## 3. SPEC-BPQ-1 facts a Buzz design inherits (RULED: spec status IMPLEMENTED, `SPEC-BPQ-1.md:3`)

- Design premise: hashes and 256-bit symmetric ciphers most likely to survive centuries; "privacy for 'only me' uses no public-key step at all, and every public-key step carries an algorithm id so it can be replaced" (`:15-18`).
- "Identity is a hash, not a key." `id = bech32m("bzpq", SHA3-256("bpq1/id" ‖ mlDsaPublicKey ‖ successionCommit))`; succession commitment hides an SLH-DSA key "not revealed until it is needed (pre-rotation)" (`:19-21`, `:87-90`).
- "Nothing needs a registry, a chain row or a server. The id proves itself" (`:22-23`).
- Keys derive from the 32-byte bzDiD `masterPrk` under frozen labels; context rule 1-64 printable ASCII; `root` reserved (`:32-79`).
- Card sizes: dsa 1952, kem 1216, succ 32 (`:94-95`); detached ML-DSA-65 signature 3,309 B (MEASURED, `2026-10-09-pq-status-verification.md:87`); SLH-DSA signature 49,856 B, "acceptable once per algorithm era" (`SPEC-BPQ-1.md:196`).
- Sealed object: per-object random Kf, AES-256-GCM segments, key commitment; "Slots carry no reader id, so the public head never names who can read (RULINGS-2026-09-16 §27)" (`:162`); SEAL inside encryption (`:166`); revocation = reseal with new Kf (`:183-185`); "the address is a locator, not a capability" (`:187-188`).
- **§5b Nostr event attestation** (2026-10-09): Buzz/Nostr relays check secp256k1 Schnorr "which a quantum adversary forges; that stays upstream's protocol"; the bzpq1 key signs ML-DSA-65 over `"bpq1/nostr-event" ‖ 32 event-id bytes`; carried as a separate event kind "so it is never inside the id it signs"; carriage on relays = upstream ask to block/buzz (`:211-227`). MEASURED both directions (`README.md:111`). No record found in `docs/` that the block/buzz ask was filed (grep, this session): UNVERIFIED.
- **§5c Intent authorization**: ML-DSA-65 over `"bpq1/intent" ‖ SHA3-256(WB001 envelope)`; signer refuses unless id is the pinned authority (`:229-243`).
- **§6 Agility rules** (verbatim core): "Unknown `bpq` version, `aead`, slot `to` or seal `alg`: refuse, never default." "New algorithms arrive as new ids (e.g. an HQC slot once FIPS 207 is final, for a second-family double wrap); old objects keep their ids and stay readable." Assurance stated plainly: implementations "agree byte for byte on the vectors; that is a cross-check between two implementations, not an audit" (`:265-272`).
- §7 hardware: "A signature from the device says who signed; it does not make the cable post-quantum" (`:298-299`); host channel is classical Noise (`:297`). bsafe audit: "treat PQ signatures, channel secrecy and identity rotation as separate properties" (`docs/dispatches/2026-10-02-bsafe-pq-audit.md:72-75`).
- bsigner registry: `ml-dsa-44/65/87`, `ml-kem-512/768/1024`, `sha3-256`; "New ids are ADDED, never redefined, and an old build must refuse them"; envelope `bheart.signature/1` "never changes" (`crates/bsigner/CONTRACT.md:28-39`); unknown id is a hard error "because a migration the verifier can't name is a forgery it can't catch" (`crates/bsigner/src/alg.rs:6-8`).
- Domain separation: every `bpq1/` label prefix-free, 14 labels (`crates/bpq-core/src/layout.rs:10-48`); a new Buzz label must join `domainsDisjoint` (PQ13 obligation, `SPEC-BTUNGSTEN-PQ-1.md:1012-1013`). Doc drift: README PQ04 row still says "13 labels" (`README.md:104`) while SPEC says fourteen since 2026-10-09 (`SPEC-BTUNGSTEN-PQ-1.md:434-435`).

---

## 4. The separate-tracks rule and the classical-at-destination rule

- **Separate tracks** (RULED as recorded in memory; founder's shared order 2026-10-11; the verbatim order text was not found in the repo): "PQ protection and quantum compute are separate tracks. An ML-DSA wrapper does not replace secp256k1 inside a transaction; keep every classical dependency listed." (`C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory/sovereign-operating-environment-order.md:22`). Same order: "10B users needs a declared workload model (about 115,741 ops/s average at 1 op/user/day). A single-host test is not a mesh result." (`:23`); "WebAuthn alone does not survive losing the original domain." (`:24`); "Timeout, OOM, missing evidence and an unexecuted test are all distinct from PASS." (`:25`). The order is cited by name in-repo at `docs/dispatches/2026-10-11-ant-native-signer-convergence.md:3`.
- **In-repo form** (RULED, PQ design spec §5): rails are "CLASSICAL AT DESTINATION"; "None of these is ever labeled post-quantum"; the estate's claim "stops at 'the authorization that released the rail payload was ML-DSA-signed and bound to the exact payload'" (`SPEC-BTUNGSTEN-PQ-1.md:1045-1057`). bsigner: "Rail payload signing stays the rail vaults' job: they sign with the chain's own curves; this organ is ML-DSA by design" (`crates/bsigner/CONTRACT.md:58-61`).
- Applied to Buzz: the §5b attestation sits BESIDE the Schnorr-signed event; relays still accept on Schnorr (`SPEC-BPQ-1.md:213-215`). A pairing wrapper is never allowed at an acceptance boundary "because that puts BN254 back where the quantum adversary forges" (`SPEC-BTUNGSTEN-PQ-1.md:822-824`).
- Harvest-now-decrypt-later precedent: the v1 QR bridge sent the recovery ROOT over public relays under classical-only ECDH, so "someone who recorded it could open it once quantum computers arrive, and with it every key that root derives, post-quantum ones included" (`surfaces/wallet.html:1366-1368`); v2 is hybrid secp256k1-ECDH + X-Wing and refuses v1 codes (`2026-10-09-pq-status-verification.md:221-228`).

---

## 5. Crypto-agility and succession rules

- Succession (RULED, `SPEC-BPQ-1.md:190-209`): retire ML-DSA-65 by revealing the SLH-DSA-SHAKE-256f key (checked against `succ` in the id) and signing a statement naming the new key set and its own next commitment. Handover v1: SLH-DSA (pure, empty context, hedged) over `"bpq1/handover" ‖ SHA3-256(from \n to \n at)`. Rust only; "the browser neither makes nor checks one yet". "A handover is a statement, not a state: refusing a second handover from the same `from` ... is the job of whoever keeps the log."
- MEASURED: handover battery refuses the ML-DSA-only forger, swapped card, cross-id replay, moved `at`, newline in `at`, empty shapes, self-handover, reserved context (`README.md:177`); zCode: forgery requires a SHA3-256 preimage, "sound by construction, not proven" (`2026-10-09-zcode-pq07-pq09-review.md:52-57`).
- Open: `handoverOnce` belongs to a log-keeper that does not exist (N-3, "unowned by design until a log exists", `zcode-pq07-pq09-review.md:77-80`, `:184`).
- Second family: HQC slot once FIPS 207 final (`SPEC-BPQ-1.md:268-269`). Not built.
- Hash-only timestamping: OpenTimestamps over SHA-256, "renewed under a new hash before either weakens (RFC 4998 model)" (`SPEC-BPQ-1.md:120-125`). The wallet's `.ots` holds pending calendar promises only and the page verifies nothing in it (`2026-10-09-pq-status-verification.md:193-197`, MEASURED-by-read).
- Pre-quantum notarization: a binding "proves something only if it existed before the break" (`SPEC-BPQ-1.md:120`); co-signed by Ed25519 while it is sound (`:115-118`).
- Law files: CI fails a STALE, missing or unpinned law signature since `74ac205ac` (2026-10-08), JS + Rust legs (`SPEC-BPQ-1.md:135-142`; `README.md:176`). MEASURED 2026-10-09: "law files: 7 of 7 current" (`2026-10-09-pq-status-verification.md:45`). The founder's one-press `wallet.html#pq-law` is the only way a law change turns green (`SPEC-BTUNGSTEN-PQ-1.md:671-672`).
- Key at rest: bsigner seeds sealed (`bheart.keyset/2`); N-2: vault key is HKDF with no memory-hard KDF, security rests on 256-bit recovery entropy, founder-ruled frozen design (`zcode-pq07-pq09-review.md:122-126`).
- Time: L4 makes every representable-clock boundary a test row (`SPEC-BTUNGSTEN-1.md:134-144`); WB004 battery convicts a naive truncating encoder that turns a 2200-era intent into a valid-looking 2060s expiration (`README.md:426`).

---

## 6. Known PQ gaps (state at HEAD)

| gap (handoff wording) | state | cite |
|---|---|---|
| "Buzz events still secp256k1 Schnorr" | Statement built + cross-verified (PQ13); relay carriage = upstream ask; filing not recorded in repo (UNVERIFIED) | `SPEC-BPQ-1.md:211-227`; `README.md:111`; gap list in memory `handoff-2026-10-08-btungsten-pq-proofs.md:31` |
| "law-signature verifier passes STALE" | CLOSED: STALE red since `74ac205ac`, two implementations, teeth | `README.md:176` |
| "NIST vector coverage is only 17 cases" | CLOSED: 2,729/2,729, 86 required rows, 0 missing, 137 teeth; 57 NOT-RUN groups named (pre-hash, ext-mu on libcrux, hedged mu, 11 SLH sets) | `README.md:98`; `zcode-pq00-pq01-audit.md:70-77` |
| "SLH-DSA succession transition" | Rust twin + handover v1 MEASURED; browser side + log-keeper open | `README.md:177` |
| "native bSiGner at-rest seed encryption" | CLOSED (PQ09), zCode-confirmed | `README.md:178` |
| End-to-end ML-DSA/ML-KEM/SLH-DSA proof | not on main; sub-lanes only | `2026-10-09-pq-status-verification.md:267-268` |
| ZB-1 ML-DSA debug Barrett | OPEN | `2026-10-10-zcode-pq10-review...md:41-46` |
| Constant-time / timing | not established by KATs | `zcode-pq00-pq01-audit.md:164-167` |
| SHA-NI, AES-NI, aarch64 paths | uncovered (scope) | closeout `:118-121`; `README.md:51` |
| bsigner CONTRACT freeze vs 18 subcommands | ESCALATED, founder-only; still unresolved at HEAD (contract last changed `a5b88db00`; newest RULINGS file 2026-10-04) | `2026-10-09-pq-status-verification.md:274-283`; MEASURED by `git log` this session |
| Who may add a 2nd signer to PQ-SIGNERS.json | founder governance question | `2026-10-09-pq-status-verification.md:290-292` |
| PQ10 on-chain verify; n=16,384 proof (~720 KB) > jungle4 524,287-byte NET limit | NOT RUN / finding stands | `README.md:159-165` |
| WB004 aggregation is a hash-fold interface; participation "signature" is a deterministic hash | named next step | `README.md:434-435`, `:444-446` |
| Safe 7 device PQ | emulator only; channel classical | `SPEC-BPQ-1.md:294-299` |
| Rails (LN, exSat, cbBTC, BCH) | classical at destination by design | `SPEC-BTUNGSTEN-PQ-1.md:1047-1057` |
| Published TAM document | SPEC says immunity is "within the explicitly published bTunGsTeN adversarial model (TAM)" but no standalone TAM file was found (grep `TAM` over docs/specs, scripts, crates) | UNVERIFIED gap |

### x0x / saorsa PQ (relevant to Buzz-over-x0x; another reader may own the transport)
- saorsa-pqc 0.5.2 wraps integritychain `fips203`/`fips204`/`fips205`; README "FIPS-Certified Implementations" claim unestablished; RNG doc says CTR_DRBG/AES-256 while code stores ChaCha20Rng; default keygen/sign paths call `OsRng` directly (MEASURED by source read, `docs/dispatches/2026-10-09-saorsa-fips-pq-claims-verification.md:36-44`). Security consequences UNVERIFIED (`:92-94`).
- RULED-as-recorded separation: "A proof about one implementation of FIPS 203 (e.g. RustCrypto) proves nothing about a different implementation (`fips203` from integritychain)" (`:105-109`). The estate's PQ01 battery runs RustCrypto + libcrux for ML-KEM/ML-DSA, and fips205 for SLH-DSA; it does NOT run integritychain fips203/fips204 (`crates/btungsten-pq/Cargo.toml`). So none of the PQ05/PQ06 SAW receipts transfer to an x0x identity or KEM.
- In-tree lockfile evidence: saorsa-pqc 0.5.2 -> fips203 0.4.3, fips204 0.4.6, fips205 0.4.1 in the Autonomi graph (`ops/ant-extsig/Cargo.lock:2862-2888`, `:5648-5649`; dependents ant-node, ant-protocol, saorsa-core, saorsa-transport). Whether x0x's `ant-quic` uses saorsa-pqc: UNVERIFIED here (no x0x lockfile in tree).
- x0x v0.46.0 release: GPG continuity verified; "Not verified: the ML-DSA `.sig` files" (`docs/dispatches/2026-10-03-oci-box-dark-and-v0460-verified.md:94-96`).
- Canon disclosure wording for any FIPS/PQC badge: "Any validation claim must identify its certificate, module version, operating environment, and approved services." (`saorsa...md:126-128`).
- Memory lists "the saorsa PQ-TLS soft-fallback issue upstream" as still founder's (`memory/pq-layer-bpq-landed.md:19`); no primary source found in `docs/` (grep): UNVERIFIED.

---

## 7. Checklist: what a design must satisfy to be "tungsten grade" (derived only from the governing text above; not a design)

Claims and receipts
1. Every property names its result class (TYPECHECK / CHECK-SAMPLED / PROVE-UNIVERSAL / EQUIVALENCE / KAT / DIFFERENTIAL / INHERITED), its domain and its boundary not crossed; NOT-RUN is never PASS (`SPEC-BTUNGSTEN-1.md:269-275`; `SPEC-BTUNGSTEN-PQ-1.md:32-41`).
2. Pass/fail criteria are named before the run; verdict computed from observations; CI's printed counts are the receipt (`SPEC-BTUNGSTEN-1.md:420-427`).
3. "Immune" only inside a published TAM slice; wording never above "sound by construction / isolated by design" (`:33-36`).
4. Every gate ships with teeth in the same job; every verifier/aggregator is fed its zero shape (T-VACUOUS) and every hash/encoder its rate-boundary last-element change (T-TRUNCATE) (`SPEC-BTUNGSTEN-PQ-1.md:42-43`, `:89-113`).
5. Proofs reach the shipped code path or the receipt prints the gap; model is Rust (`SPEC-BTUNGSTEN-PQ-1.md:25-30`; memory `formal-models-rust-first.md:13-17`).

Cryptography
6. Every public-key step carries an algorithm id; unknown ids are refused, never defaulted; ids added, never redefined (`SPEC-BPQ-1.md:15-18`, `:265-269`; `CONTRACT.md:37-39`).
7. Identity is a hash with a hidden hash-based succession commitment; a handover path exists and someone owns the spent-once log (`SPEC-BPQ-1.md:19-21`, `:190-209`).
8. Every new signed message gets a `bpq1/` (or equivalent) label inside the proven disjoint set (`SPEC-BTUNGSTEN-PQ-1.md:416-420`, `:1012-1013`).
9. Accepted input language is strict (refuse ill-formed UTF-16/UTF-8, strict timestamp shape, no delimiter injection) and the proof is about that language (`SPEC-BTUNGSTEN-1.md:256-283`; `SPEC-BPQ-1.md:103-111`).
10. PQ signature, channel confidentiality, and identity rotation are tracked as separate properties; a PQ signature over a classical channel claims nothing about the channel (`bsafe-pq-audit.md:72-75`; `SPEC-BPQ-1.md:297-299`).
11. Classical dependencies stay listed and labeled classical (Nostr Schnorr at the relay, rail curves); an ML-DSA wrapper is never described as replacing them (memory `sovereign-operating-environment-order.md:22`; `SPEC-BTUNGSTEN-PQ-1.md:1054-1057`).
12. No secret root crosses a classical-only key exchange (v1 QR bridge precedent, `surfaces/wallet.html:1366-1368`).
13. A different implementation of the same FIPS algorithm (e.g. x0x/saorsa's integritychain crates) needs its own KAT/DIFFERENTIAL rows; estate proofs do not transfer (`saorsa...md:105-109`).
14. New dependencies pass audit two gates, no `--ignore` (`SPEC-BTUNGSTEN-PQ-1.md:46`; `README.md:110` example).

Continuity and scale
15. Each extinction (key, signer set, algorithm, clock representation, contract, chain, organization, UI) is a test row (`SPEC-BTUNGSTEN-1.md:104-108`).
16. Every time field has a stated representable horizon and fails closed before it (`:134-144`).
17. Messages/proposals stay short-lived; what lasts is authority continuity (`:110-120`).
18. No population-scale storage at an execution primitive; aggregates are compact; no indispensable shard/aggregator/UI (`:122-132`).
19. 10B scale = declared workload model + math bounds + progressively larger physical tests; "A single-host test is not a mesh result" (`:61-65`; memory `sovereign-operating-environment-order.md:23`).
20. Runtime admission of any node passes EXPOSURE -> IDENTITY -> PEER -> AGREEMENT, per runtime instance; configured is not connected (`SPEC-BTUNGSTEN-1.md:146-184`).
21. Removal tests: delete each major component (relay, host, provider, coordinator) and show continued operation without a privileged operator (`:43-46`, `:51-55`).
22. Status shown to users is receipt-derived: "A light is lit only by a measured fact (cite-or-silent)" (memory `status-as-receipts-grammar.md:23`; ratified as SPEC-RECEIPT-OBSERVABILITY-1 per same memory `:17`).

---

## 8. Collisions a designer will hit (escalate, do not resolve)

- bsigner CONTRACT freeze: "changing anything in the FROZEN list below requires a founder ruling, recorded here with its date" (`crates/bsigner/CONTRACT.md:5-7`) vs 18 subcommands on main (MEASURED this session: `grep -c` = 18 in `crates/bsigner/src/main.rs`). Any Buzz design adding a bsigner command (e.g. a new attest kind) lands on this unresolved collision.
- bsigner "Signs, never submits ... no network code at all" (`CONTRACT.md:43-44`): a PQ Buzz signer cannot be the network client.
- Founder phrase "tungsten gold standard" vs the standard's own text: no system is conformant today and lanes do not certify "a universal gold standard" (`2026-10-06-btungsten-lane.md:45-47`; `2026-10-03-tungsten-chain-acceptance.md:62-63`).
- PQ13 chose a SEPARATE attestation event beside the Schnorr event, keeping NIP-01 classical at the relay; a design that moves Buzz identity to x0x ML-DSA-65 changes which implementation is trusted (saorsa/integritychain, uncovered by estate proofs) and must not reuse PQ05/PQ06 receipts as its evidence.
- L2 short-lived intents vs any long-lived signed artifact in a chat log (e.g. a 1,000-year message signature) is not a collision per se, but L1 demands no dependence on any original algorithm: old signatures need re-anchoring (OTS renewal model) rather than permanence.
