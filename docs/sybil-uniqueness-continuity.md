# One-human-one-420 — the presence ratchet

<!-- 11 agents: 4 surveys (ZK nullifiers, document anchors, MPC/fuzzy-extractor
     biometrics, social+economic), 3 independent designs, 3 adversarial passes
     (farmer / hostile state / the excluded), 1 synthesis. 2026-08-04.
     Founder brief: no MiM, no perpetual verification rent, no issuer.
     Every adversarial finding was required to ship with its fix. -->

# ONE-HUMAN-ONE-420 — the presence ratchet with document accelerators

**Design name:** `bDiD/CONTINUITY-v1`
**Status:** buildable on hardware and libraries shipping today. No new cryptography. No gallery. No committee at rest. No issuer.

---

## 1. The answer, in five sentences

A human body can be in exactly one place at one instant, so BNR makes the 420 b cap open on a **presence ratchet**: every 28 days a VRF-assigned circle of five or six people, meeting inside a beacon-bound slot, threshold-signs a transcript, and that signature is the only thing that can advance your chain to the next epoch — one body, one link, per epoch, unconditionally. Each link publishes a nullifier `N_e = Poseidon(Poseidon(k_e, ctx_e))` whose preimage chains from a secret no government, employer, breach-holder or block producer has ever held, so the published set is uniform noise that nobody on earth can test membership against — there is no vOPRF to capture because there is no external preimage to protect. At depth `D` the root publishes a single lifetime nullifier `NULL_420 = Poseidon(s, "bnr:420:cap-open:v1")`, which is unique per root by construction and collides by hash equality on any repeat; documents (e-passport, Aadhaar, EUDI, mDL) are **accelerators that lower `D` from 18 to 6**, never a separate prize and never a separate emission rate. Because the quota vests only into the PoU-gated key that physically attended that epoch's circle, and because rotation to a fresh key is unilateral, free, unlimited, one-tap and requires no one's consent, **a captured or rented identity is permanently expropriable by the body that holds it** — which kills the presence-rental and coerced-harvest markets without detecting them, without a gallery, and without a duress flag. Everyone reaches the same 420 at the same slope; anchors buy a head start, never a faster clock, so the poorest participant is never offered a present-value haircut that makes selling their key rational.

---

## 2. The nullifier

### 2.1 Layer 0 — root secret, zero firmware change

```
sig = wallet.signMessage("BNR-bDiD-continuity-root-v1")   // RFC-6979 deterministic ECDSA
s   = keccak256(sig) mod r_BabyJubJub                      // Semaphore v4 identity scalar
R   = Poseidon(s)                                          // the bDiD digest
```

Works on Trezor and Ledger **today**, no new app, no PLUME (5–6.5M constraints stays off the phone). RFC-6979 makes `s` a deterministic function of `(seed, string)`: recoverable forever from 24 words, no backup beyond the phrase.

Phone-only path: `s` generated in StrongBox / Secure Enclave, unlocked by on-device 1:1 PoU (BIO-1 v0.2 conditions 1–5 — only a secure-element signature crosses the seam, no score, no modality, no template, no count). Cardless path: a ~$2 NFC card or a paper seed.

**`s` is key-unique, not human-unique.** It is custody only. Uniqueness comes from Layer 1.

### 2.2 Layer 1 — the presence ratchet

```
E_e     = floor((t - T_genesis) / 2_419_200)                 // 28 days, P-7 fixed-interval
R_e     = drand(e)                                           // beacon ONLY; see §5.7
ctx_e   = H("bnr:continuity:v1" || E_e || R_e)

k_0     = Poseidon(s, H("bnr:continuity:genesis:v1"))
a_e     = Poseidon(k_e, ctx_e)                               // epoch secret
N_e     = Poseidon(a_e)                                      // PUBLISHED link nullifier
C_e     = H(circle_transcript_e)                             // 4-of-6 or 3-of-5 threshold sig
d_e     = circle-threshold-encrypted FORWARD SHARD, delivered
          to a bearer object the attendee carries out of the room
k_{e+1} = Poseidon(k_e, N_e, C_e, d_e)                       // the ratchet
```

Three terms in that last line each do distinct work, and all three are load-bearing:

- **`C_e`** — the chain cannot be advanced privately. Plain RLN lets a holder advance alone; here the next state depends on a transcript hash the holder cannot produce without four other bodies in a slot they did not choose.
- **`d_e`** — the chain cannot be advanced *by whoever holds the seed phrase*. `d_e` is not derivable from the seed; it is delivered at the ceremony to a `$2` NFC card or a printed 4-word code that the attendee physically carries away. A broker holding 200 seed phrases mints nothing without 200 people physically re-presenting their card, every 28 days, forever. **This converts identity capture from a one-time $45 purchase into perpetual coercion**, which is exactly the thing PERSON-1 §4 says the peers are for — the protocol stops trying to *detect* capture and instead makes it expensive and visible to humans.
- **`R_e`** — history cannot be manufactured retroactively. `ctx_e` contains a beacon value that did not exist before epoch `e`.

**Slashing, no judge (RLN, epoch-scoped).** Each link publishes `(x, y, N_e)` with

```
x = Poseidon("bnr:link:v1", E_e)      // scope = EPOCH, never the circle id
y = a_e · x + k_e
```

Two links in one epoch → two points on one line → anyone interpolates `k_e` and takes the chain. Note `x` is identical for the whole epoch, not for the circle: scoping the share to the circle (as an earlier draft did) would publish co-membership and hand any observer the social graph. The circle enters the statement only *privately*, via `C_e` inside the ratchet and via Merkle membership in that epoch's circle-key set — never by naming a circle.

Punishment is proportionate: `k_e` does not yield `s` (Poseidon is one-way). The cheat costs continuity depth, not root identity. P-11 and P-13 both hold — the door has no lock, the price is paid again at the front.

**Stake without capital.** RLN needs a slashable deposit; a new user has none. The stake is **the unvested quota itself**. Burning unminted quota costs the protocol nothing (P-12) and costs the attacker everything. This is what lets the scheme work for someone with zero dollars.

### 2.3 Layer 2 — the lifetime cap-open

```
NULL_420 = Poseidon(s, H("bnr:420:cap-open:v1"))
```

Scope is **(human-root, action)** and *never* the credential that proved it — World ID 4.0's single most important design decision, adopted verbatim. A person who holds a passport, an Aadhaar, an eID and a ceremony seat produces exactly **one** `NULL_420`, in one namespace. A repeat is a hash collision. No gallery, no matcher, no threshold, no FMR/FNMR, no oracle.

The claim is one Groth16 verification of an IVC-folded statement: *"I know `s` such that `NULL_420 = Poseidon(s, ·)`, and there exist `D` valid links from that same `s`, each in its own published epoch root, each carrying a circle threshold signature and a forward shard, and `NULL_420` is not in the cap-open tree."*

### 2.4 Why one human cannot make two

**The parallelism bound, and it is physical, not statistical.** A link in epoch `e` requires a threshold co-signature from a circle VRF-sampled out of the live set and revealed Δ=15 min before a slot of length `ℓ`. A body occupies at most `⌈w/ℓ⌉` slots in window `w`. Set `w = ℓ`:

```
chains gaining depth in epoch e   ≤   bodies present in epoch e
```

Therefore for any human holding any number of roots, `Σᵢ depth_i(T) ≤ depth(T)` of a single merged root, over any horizon `T`. A human with ten roots does not earn ten times; they earn **once, more slowly, from a later start date.** Sybil profit is negative by construction, not by detection.

**The three ways this bound is normally broken, each closed:**

1. **Local VRF-pool capture** — a broker holding fraction `p` of a locality gets attacker-majority circles free: `P(Bin(6,p) ≥ 4)` = 0.34 at p=0.5, 0.90 at p=0.8. *Closed by* **lineage-disjoint circles**: every valid circle must contain ≥2 members sharing no common ancestor in the attestation DAG within 3 rounds. Purely graph-structural, decidable by equality, needs no identity and no biometrics. "Control 70% of one village" becomes "control 70% of several independent lineages" — superlinear.
2. **The remote/audio-only path deleting co-location** — a remote circle of six can be one person with six voice profiles and six phones, at ~$3 marginal. *Closed by* **witness-relay**: for those who genuinely cannot travel (bedbound, incarcerated, besieged, carers), the full-weight path is 3 already-standing members drawn from 3 *different* circles physically attending the person's location inside the VRF slot. Co-location is preserved; the theorem survives. Prisons already have visitors. Remote audio-only survives only as a **reduced-weight link** (counts toward depth at 1/3) with **at most one remote seat per circle**, so the disabled are slowed, never excluded, and the attacker's free path is gone.
3. **Dual-anchor splitting** — *closed by* §3: there is one document namespace, state-excluded, and anchors carry no quota at all.

---

## 3. The anchor ladder

**Rule that governs the whole table: an anchor lowers `D`, the depth at which the cap opens. It never emits, never changes the slope, and never adds to another anchor. `D` reduction is MAX, never SUM, with a hard floor of 6.**

| id | anchor | nullifier namespace | preimage | reach | `D` |
|---|---|---|---|---|---|
| **C0** | **Circle seat** — VRF-assigned synchronous meetup, or witness-relay | `NS-CONT` | `Poseidon(s,"bnr:ceremony-root")` — **no external preimage exists** | everyone with a community and one device in reach | **18** |
| A1 | ICAO 9303 eMRTD (passport, biometric ID card, residence permit) **with live AA/CA chip challenge** | `NS-DOC` | MRZ `name_primary‖name_secondary‖DOB‖sex` | ~1.5B; live-chip subset (UK ~76%, US 0%) | 9 |
| A1′ | eMRTD **without** AA/CA | `NS-DOC` | same | remainder of A1 | inadmissible alone → 12, only when paired with ≥3 circle links |
| A2 | National eID / EUDI (eIDAS 2) | `NS-EID` | issuer-signed sector pseudonym | ~0.45B (≈85% inside A1) | 9 |
| A3 | Anon Aadhaar signed QR | `NS-AADH` | Poseidon over signed fields, VID excluded | ~1.35B | 9 |
| A4 | mDL / ISO 18013-5 | `NS-MDL` | holder identifier | ~0.15B | 12 |
| A5 | Mobile-money / bank KYC pseudonym, threshold-of-issuers | `NS-KYC` | issuer-signed pseudonym | ~1.4B, heavy overlap | 12 |
| — | Secure-element attestation (StrongBox / App Attest) + on-device 1:1 PoU | *not a namespace* | — | ~4B devices | freshness + non-delegability only; `D` unchanged |
| — | **two independent classes agreeing under one root** | — | — | — | **6** (floor) |

### 3.1 Deletions, stated as deletions

- **`DOC-N` (national personal number) is deleted as a namespace.** It gave a dual citizen two distinct nullifiers at $0 marginal cost. Every document anchor derives from the **state-excluded MRZ preimage only**; the national number survives strictly as a tiebreaker *inside* a collision appeal, never as its own namespace. Both passports of a dual citizen then collide by construction, because both states issue from the same birth record. Cost: MRZ collision at low-single-digit percent, routed through §3.3. Residual: dual citizens with divergent transliterations (CJK/Arabic/Cyrillic), ~10–20M, capped at a `D` reduction they already have — **not capital-scalable, and worth zero b.**
- **Document number and expiry are never in any preimage.** They change at renewal and would mint a fresh nullifier every 10 years.
- **Issuing state is never in any preimage.** Including it hands every dual citizen a second nullifier by construction.
- **The fuzzy-extractor / MPC-iris anchor is struck.** BIO-1 B-1 forbids any bit computed from a body leaving the device "not as an embedding, not as a hash, not as an irreversibly transformed derivative"; a published helper-data set is a matchable gallery under another name; B-2 forbids 1:N at any gallery size, ever. There is no attack surface here because there is no component here.
- **Eden's public IPFS upload of ceremony recordings is struck.** A public corpus of face-and-voice video indexed to on-chain roots *is* an identification oracle. The ceremony emits only `C_e`; any recording is encrypted under a key split among circle members, openable only by on-chain challenge.
- **Eden's "read the Peace Treaty" prerequisite is struck.** It excludes the illiterate. Ceremony is spoken and visual only.

### 3.2 How the union composes — many-to-one INTO a root, never one-to-many OUT

```
attach(a):  assert N_a ∉ AnchorTree                   // one global indexed tree,
                                                       // domain separated INSIDE the blinded input
            assert in-circuit: same s produced N_a and R
            insert N_a ; publish ONLY the new tree root      // never publish the binding
D(R)     = max(6, min over attached anchors of D_a)
open(R)  : depth(R) ≥ D(R)  AND  NULL_420 ∉ CapOpenTree
```

Cross-namespace equality is impossible (different preimages, no shared secret) and is not attempted — any cross-anchor equality scheme is an identity join, i.e. the oracle constraint 3 forbids. The union is by **binding inside a circuit**, and the binding value is never published (§5.4).

A second anchor attached to an existing root is a **no-op with a receipt**. A dual citizen attaching two passports collides on the state-excluded preimage: the second insert is a duplicate, the circuit proves both bind to the same `R`, and the transaction resolves as a no-op. Either way: **one root, one cap, one 420.**

### 3.3 The collision appeal — free, no human review

`WANG<<WEI` + DOB + M is not unique, and Latin transliteration of CJK names collides worst exactly where population is largest. A blocked claimant does not petition anyone: they present a **different anchor class**, which is a second deterministic nullifier in a different namespace. No gallery, no fuzzy matching, no reviewer. A single-anchor claimant with a genuine collision falls back to **C0**, which has no external preimage and therefore cannot collide with anything. **Nobody is excluded; they are slowed by at most 9 epochs.** Prefer the visible, appealable failure to the invisible, permanent one.

### 3.4 Anti-denial: displacement, not first-write-wins

The vOPRF-free construction stops offline *testing*; it does not stop an adversary who **enrolls**. Anyone holding a breached DG1 corpus can register a valid `N_a` for millions of people first and permanently lock them out of their own 420 at ~$0.001/victim. Closed by three rules:

1. **Live chip challenge mandatory** for any standalone document anchor: AA/CA signs `H(vaulta_account ‖ recent_block_hash)`, proven in-circuit. Where AA/CA does not exist (US e-passports = 0%), the document is **inadmissible alone** and must be paired with ≥3 circle links.
2. **180-day contest window** on every anchor insert.
3. **Displacement resolution, not first-write-wins:** inside the window, a claimant presenting a live chip challenge *or* a circle seat **displaces** an earlier non-live claimant. The denial attack collapses from permanent disenfranchisement to a 180-day nuisance.

### 3.5 Anchor revocation kill switch — closed

Anchor validity is evaluated **once, at enrolment, against the archived CSCA master-list root at the enrolment block**, and **never re-evaluated**. `anchor_status` is append-only and can only mark a class "frozen for NEW enrolment"; there is no contract path that invalidates an existing root. Enforced in code, not policy. A state may deny its nationals future enrolment; it can never retroactively disenfranchise them. This is also the second reason anchors must not pay: if anchors emit nothing, denying documents costs the target nothing but 12 epochs.

---

## 4. Coverage — honest, to 10 billion

| Population | Size | Path | Reaches 420? |
|---|---|---|---|
| Live-chip e-passport / eID holders | ~0.9–1.2B | A1, `D`=9 | yes, ~9 months to open |
| e-passport without AA/CA (incl. all US) | ~0.4–0.6B | A1′ + 3 circle links, `D`=12 | yes, ~1 yr |
| Aadhaar | ~1.35B | A3, `D`=9 | yes |
| EUDI / national eID (net of overlap) | ~0.07B disjoint | A2 | yes |
| mDL, mobile-money/bank KYC (net) | ~0.55B disjoint | A4/A5, `D`=12 | yes |
| **Documented union, deduplicated** | **≈3.4B** | | |
| **Everyone else with a community and one device in reach** | **≈4.6B** | **C0**, `D`=18 → ~14 months to open | **yes, same 420, same slope** |
| No phone at all | — | attends in person; a witness's device carries the record; **`s` on a $2 NFC card or paper seed, and `d_e` on that same card — the device holder never holds the quota or the shard** | yes |
| No connectivity at slot time | — | circle meets, transcript is beacon-bound, submitted up to 2 epochs late via `ladder.rs` rung 4 (`veilid-core 0.5.7`) or sneakernet. **The beacon proves when they met; the transport proves nothing.** | yes |
| Illiterate | — | ceremony spoken/visual only; no reading prerequisite anywhere | yes |
| Cannot travel — bedbound, incarcerated, besieged, carers | ~0.1–0.3B | **witness-relay**: 3 standing members from 3 different circles physically attend, inside the VRF slot. Co-location preserved | yes, full weight |
| Genuinely cannot be reached in person at all | small | remote audio-only, **reduced weight (1/3), max one seat per circle** → `D` effectively 54 | yes, ~4 yr |
| Cannot afford a Vaulta account ($0.05–3) | — | **universal sponsorship** — the default funding path for *everyone*, not a poverty fallback (§5.9). Redeemable only **after** a first circle attestation, so an unattended sponsored account is never funded. GOV-3 keeps the sponsor from gaining standing | yes |
| MRZ collision victim, single anchor | ~1–3% of A1 | falls to C0 — no external preimage, cannot collide | yes, 18 epochs |
| Tier-H device (no secure element) | — | links at reduced weight → higher `D` | slowed, not excluded |
| **Genuine networkless recluse** | ~0.2–0.4B est. | **Excluded.** PERSON-1 §5 and P-13 record this as *definitional, not negligent* — the only non-excluding alternative is a registry, which P-3 rejects | **no** |

**Effective coverage: ~7.6–7.9B of 8.2B living, and the mechanism does not degrade at 10¹⁰.** The critical difference from every "works for 3B" design: the undocumented are neither excluded nor capped nor rate-penalised. They open the cap 12 epochs later and then vest at the identical slope.

---

## 5. Cannot be weaponized

**What a holder of the entire published set learns: a per-epoch census count, and a cap-open count. Nothing else.** Vector by vector, from the adversarial pass:

**5.1 Offline membership testing — structurally impossible, no committee needed.**
Document nullifiers have a property zkPassport states in its own FAQ: anyone with the chip data — *explicitly including the issuing government, which keeps records of every ID it signed* — can derive the identifier. Their fix is a vOPRF pepper, which reintroduces a t-of-n liveness dependency and a capture target. **Here the primary namespace has no external preimage.** `N_e = Poseidon(Poseidon(k_e, ctx_e))`; `k_e` chains from `s`, a hardware signature from a key that never leaves the element, plus a forward shard `d_e` that only existed inside a room. No government, breach, employer or BP holds anything that tests membership. **Constraint 4 is satisfied with no committee at all.**

**5.2 tOPRF committee capture — the target is removed, and what remains is re-randomisable.**
Document namespaces still need a pepper, or a government computes `N_a` from its own DG1 archive. Four changes make that committee non-catastrophic:
- **Respect-selected committee, not BP-selected.** GOV-2 makes Respect non-transferable and non-purchasable, so a Respect-weighted committee is **the one committee in the system that cannot be bought**. Stake can be bought; EOS-lineage BP cartels have formed cheaply and repeatedly.
- **n=64, t=48, hard cap of 3 nodes per jurisdiction**, so no single state's legal process reaches `t`. Client tries any valid `t`-subset, so selective service refusal routes around itself; per-node DLEQ availability is published, so refusal is attributable.
- **Rotatable-PRF set re-randomisation.** On each rotation the committee obliviously re-evaluates the whole anchor tree, `N' = N^(k'/k)`, DLEQ-proved, no preimages touched. Old nullifiers stop being published, so the old key becomes worthless. Cost: ~10¹⁰ group exponentiations at ~50 µs ≈ 5.8 CPU-days per rotation, embarrassingly parallel, off-chain, publicly verifiable. **This is what makes committee capture at time T expose only the current epoch and never the archive** — key rotation alone does not, because nullifiers published under `k_2027` stay testable with `k_2027` forever.
- **Escape hatch that already exists:** uniqueness routes through continuity. If the document committee is ever believed captured, freeze `NS-DOC*` for new enrolment (§3.5 makes that safe for existing roots) and every human on earth still has C0.

**5.3 The rung as a public side channel — removed, not mitigated.**
An emission rate that varies by anchor class publishes a documented/undocumented partition of the population — in operational terms, a migrant-status targeting list generated by the protocol, free, forever. Two structural fixes: (a) **the slope is identical at every rung**, so there is nothing to read; (b) **fixed-denomination shielded tranches** — every root emits exactly one identical note every epoch from epoch 0, and roots that are not yet open emit a zero-value note indistinguishable in the shielded pool from a value note. Rung affects only a private accumulator inside the circuit. A public observer sees N identical notes per epoch. Cap-open dates, anchor classes and vest progress are all invisible.

**5.4 Anchor clustering — the binding is never published.**
`B_a` is not published, and the circuit does not reveal which root-registry leaf an attach updates. It proves *"this anchor binds to some existing root that has not exceeded its anchor count"* and publishes only the new tree root. Otherwise a human's passport + Aadhaar + eID are publicly joined under one leaf — a nationality/diaspora join that survives even a perfect OPRF. Per-class counters are replaced by **one global counter**, bucketed at ≥1000 with a k-epoch delay.

**5.5 Network-layer nationality oracle — killed.**
**One OPRF key for all document classes**; domain separation moves *inside* the blinded input (`x = Poseidon(DOMAIN_a, preimage)`). A per-class key ID would tell every node whether you are enrolling a passport or an Aadhaar before any ZK runs. Plus mandatory mixnet transport (Veilid rung 4, already in `ladder.rs`) and cover traffic.

**5.6 Circle co-membership / social graph — closed by epoch-scoped shares.**
`x = Poseidon("bnr:link:v1", E_e)`, not `Poseidon(C_e)`. Circle identity enters only privately. Link nullifiers are mixed unordered into the global epoch set. Co-membership is not observable, circle-ID sequences cannot be used to reconstruct the graph or geolocate roots. Costs nothing.

**5.7 Beacon grinding — drand alone.**
`drand XOR vaulta_block_hash` lets the producer contribute last and re-roll circle assignment to place a target in a hostile circle for a few hundred dollars in forgone blocks. Use **drand alone**, or drand XOR a commit-reveal whose reveal deadline strictly precedes block production. `cascade.rs`'s `Xorshift` is a self-flagged stand-in and must be replaced by the VRF before any production use.

**5.8 Targeted exclusion / denial amplifiers — bounded.**
Depth is **monotone and forgiving**: missing an epoch never destroys it (`k_{e+1} = Poseidon(k_e, 0, R_e, 0)` is publicly derivable, so state survives arbitrary gaps; depth counts only witnessed links). Recency weights the **rate**, never **eligibility** — the earlier "≥12 of last 15 epochs" rule let an adversary destroy a person by blocking 4 epochs. Three re-draws per epoch, drawn from a **global** remote pool, so no locality can lock anyone out. Circle equivocation slashes the circle, not the member. A member who repeatedly refuses to witness forfeits their own link — refusing costs the refuser.

**5.9 Transaction metadata — the fee payer is the deanonymiser, not the nullifier.**
Mandatory relayer/meta-tx submission, fees from a shielded pool, minimum inclusion batch k=64, shuffled. **Universal sponsorship is the default path for everyone**, which destroys the funding trail for the entire population and removes the affordability exclusion in one move. Consequence accepted: stop citing account cost as a sybil limiter. It is spent either way, and §6 does not rely on it.

**5.10 Coercion and duress — no detector, ever.**
P-5 is intact: no duress field, no flag, no score. Rotation is unconditional, carries no reason, and is indistinguishable from a routine device change. The `did:plc`-style mandatory rotation delay window lets the *old* key silently veto, with the veto indistinguishable from a stalled transaction. Ceremony choreography does the rest: key material lives on a bearer object the enrollee keeps, and enrolment terminates with **one action the enrollee performs alone, out of the enroller's line of sight** — standard anti-trafficking practice (never screen in front of the coercer) implemented as staging, recording nothing.

---

## 6. The economics

### 6.1 Parameters

| symbol | value | note |
|---|---|---|
| epoch | 2,419,200 s (28 d) | already planned |
| `D` | 18 (C0) / 9 (live doc) / 6 (two classes) | anchors buy a head start only |
| vest | 420 b over **168 epochs** after open | ~12.9 yr |
| `r` | **2.500 b/epoch**, identical at every rung | flat slope, P-2 verbatim |
| `c_h` | honest per-epoch cost | ~50 min incl. travel |
| `q` | per-epoch unilateral-rotation hazard on a captured key | design target ≥0.05, realistic ≥0.10 |
| `δ` | per-epoch discount | 0.008 (≈10%/yr) |

### 6.2 Cost per honest user

| item | cost |
|---|---|
| Vaulta account | **$0** — universal sponsorship, redeemed after first circle |
| bearer object (NFC card or paper seed) | $0–2, one-time |
| hardware wallet | optional; phone StrongBox/Secure Enclave path is full-weight |
| per epoch: ceremony ~40–60 min incl. travel | at a $2/hr informal wage floor, **~$1.00–1.50/epoch** |
| to open the cap (C0, 18 epochs) | **≈$20 of own time** |
| full vest (186 epochs total) | **≈$190 of own time**, for 420 b |
| proving | 143 ms Semaphore-32 on iPhone 16 Pro / 166 ms S23 Ultra (rapidsnark, measured); ~1–3 s for the IVC fold |
| gas | Groth16/BN254 ≈181k + 6.15k/public input ⇒ ~212k standalone, **18–40k aggregated ≈ $0.001–0.05** |

### 6.3 Cost per attacker identity, and the inequality that must hold

The scalable break is not forgery. It is **presence-rental and custodial harvest**: recruit real, unique, unenrolled humans, have them enrol honestly — real body, real PoU, real circle — and keep the key. Every nullifier produced is *valid*. Uniqueness survives perfectly; purpose fails completely. Nothing in a nullifier scheme touches this, because the defect is never in the nullifier — it is in the **ownership binding downstream of it**.

Attacker cost build-up, per head:

| item | cost |
|---|---|
| recruitment | $10–30 one-time (orb-scan resale cleared at $10–30/person in Cambodia, Kenya, Indonesia) |
| Vaulta account | $0 — the sponsored pool pays it |
| bearer object | $2, **but the broker cannot keep it** — see below |
| per-epoch shepherding | $0.40–1.50, amortising toward $0.40 at village scale |
| documents | $0 — the attack targets the undocumented tier on purpose |
| **naive total** | **$25–45 one-time + ~$1/epoch** |

Under the original designs that yields a 420 b stream for ~$45 — attacker-to-honest cost ratio 0.1–2.3×, **below 1 in the long-ladder case**, meaning the broker acquires the identity more cheaply than the person can hold it. Every "keep paying a recurring cost" bound is structurally weakest exactly where coverage is highest, because being in that tier is what it means for your time to be cheap. That inversion is the thing to fix, and it is fixed by three rules, not by cryptography:

> **W1. Unvested quota is non-transferable.**
> **W2. Each epoch's tranche is claimable only by the PoU-gated key that attended that epoch's circle**, and requires that epoch's forward shard `d_e`, which lives on a bearer object the attendee carries out of the room.
> **W3. Rotation to a fresh key is unilateral, free, unlimited, one-tap, valid if signed by ANY quorum-forming circle in ANY epoch, requires no one's consent — explicitly not the attesting circle's — carries no reason field, and transfers the full depth and remaining vest to `s'` while permanently killing the old `s`.**

W3 is the single highest-leverage line in this document. The earlier draft required rotation to be co-signed by "the same circle that granted the standing," which hands a captor who controls the circle a rotation veto. Removing that clause is the difference between "the broker owns them forever" and "the broker owns them until they walk into any other circle."

**The resulting inequality.** A captured stream is held only until the worker rotates. Expected epochs held = `1/q`. Broker profit per head:

```
Π = (r·V − c) / (q + δ)  −  C_rec        >  0
⟺  r·V  >  c + (q + δ)·C_rec
```

| `q` | `C_rec` | `c` | break-even `V` at r=2.5 | broker's expected capture of 420 b |
|---|---|---|---|---|
| 0 (original designs) | $25 | $1.00 | **$0.40/b** | 420 b (100%) |
| 0.05 | $25 | $1.00 | **$0.90/b** | ~43 b (10%) |
| 0.10 | $25 | $1.20 | **$1.48/b** | ~23 b (5.5%) |
| 0.10 | $45 | $1.20 | **$2.34/b** | ~23 b (5.5%) |

**Publish `V* ≈ $1.50/b` as a governance parameter.** Below it, industrial harvesting loses money. Above it, the correct lever is `q` — make rotation more visible and more one-tap — not more surveillance. Note what does the work: the broker's *cost* barely moves; the broker's *expected yield* falls 10–20×, and **farm equity becomes uninsurable because the risk cannot be priced in advance.** This kills presence-rental **without detecting it** — no gallery, no matcher, no oracle, no identification. It is ~90% already ratified in P-6 and P-10.

Two attacker paths that go to zero rather than being priced:

- **Dual-citizen split: $0 cost, $0 gain.** One document namespace, state-excluded; anchors carry no quota and `D` reduction is MAX with a floor of 6. Previously worth 2× (~60M humans, ~2.9×10¹⁰ excess b).
- **Pre-emptive enrolment denial: costs the attacker $0.001/victim, yields a 180-day nuisance** instead of permanent disenfranchisement, via mandatory liveness + displacement (§3.4).

**The present-value fix on the demand side.** A flat slope is not cosmetic. Under the earlier ladder, rung A0 delivered 420 nominal over 20 years against rung A5's 1 year: at a 10% discount that is a 6–7× haircut; at the 40–60% discount rate a displaced person actually applies — because they need to eat this month — it is 15–30×. That is a ~30 b prize dressed as a 420 b prize, offered to the poorest, whose rational response is **to sell their key to the broker today**. A flat slope with a head-start-only anchor benefit removes the economic pressure that was *compelling* the attack. T4 already permits rate to widen with sustained Respect — which is epochs, not passports — so this is inside ratified law.

---

## 7. What BNR already has

| Asset | Reuse |
|---|---|
| `C:\Users\travi\b-onboard\src\journal.rs` | Append-only, hash-chained, fsync-per-entry, corrupt-tail recovery, tested against truncation at every byte offset. **This is literally the local half of the presence ratchet** — `k_e`, each `C_e` and each `d_e` are journal entries |
| `C:\Users\travi\b-onboard\src\gates.rs` | Typed G0–G6 state machine. One epoch link = one G-cycle |
| `C:\Users\travi\b-onboard\src\ceremony.rs` | BCryptGenRandom keygen, `Keystore` trait, fail-closed backup verify (`ONB-G2-01`), **honest Tier S/H detection** → Tier S full-weight links, Tier H reduced weight. Same weighting mechanism carries the reduced-weight remote seat |
| `C:\Users\travi\b-onboard\src\ladder.rs` | L4-honest transport climb; rung 4 `veilid-core 0.5.7` (MPL-2.0, verified 2026-07-22) → epoch-shard DHT, censored/offline late submission, and the mandatory mixnet transport of §5.5 |
| `C:\Users\travi\b-onboard\src\probe.rs`, `doctor.rs`, `ERRORS.md`, `errors.rs` | Registered-error discipline. Add `ONB-LINK-*` codes so a missed link is **diagnosable, never silent** — this is how constraint 5 is enforced operationally rather than aspirationally |
| `C:\Users\travi\b-onboard-verify-credman` | Verified keystore roundtrip against a real vault |
| `C:\Users\travi\LOVErnment-DAO\crates\lovernment-core\src\cascade.rs` | `partition(n) -> (sixes, fives)` gives circle geometry; 4-of-6 and 3-of-5 are the link thresholds; `respect_schedule(1)` = 2,3,5,8,13,21 pays from the **first** circle. `Xorshift` is the seeded-shuffle stand-in the VRF replaces — the file flags itself |
| `C:\Users\travi\LOVErnment-DAO\crates\lovernment-core\src\performance.rs` | `validate_set` / `Rule` — the contribution-validation seam P-1 requires between gate and emission |
| `C:\Users\travi\LOVErnment-DAO\examples\fractal_cascade.rs` | Cascade geometry already implemented; lineage tags attach here |
| `C:\Users\travi\LOVErnment-DAO\docs\research\D-2_eden_dossier.md` | Remote-ceremony structure, contract-pinned @ `gofractally/Eden 2d779d4`. Adopt the structure; reject the IPFS publication and the reading prerequisite |
| Ruled facts | P-1 (gate not payout — removes the passport-rental market outright), P-3, P-5, P-6 (rotation), P-7 (fixed interval), P-9, P-10, P-11, P-12 (unminted never mints — this is what lets unvested quota be the RLN stake), P-13 (the door has no lock; remote path named), GOV-1–3; B-1–B-5; BIO-1 v0.2 on-device 1:1 conditions 1–5 |
| Operational | 28-day bRespect cadence **already planned** — the ratchet is not new infrastructure, it is a signature added to a meeting that was already going to happen. Vaulta account cost. Trezor/Ledger + on-device 1:1 PoU already lawful |

### On-chain state — exact bytes at 10¹⁰

| slot | bytes |
|---|---|
| `epoch_roots` (rolling 16 + retired accumulator) | 544 |
| `capopen_root` — indexed Merkle, depth 34 (1.7×10¹⁰) | 32 |
| `anchor_root` — one tree, all namespaces domain-separated inside | 32 |
| `rotation_root`, `slash_root`, `lineage_root` | 96 |
| `csca_archive_acc`, `oprf_keyset_commit` | 64 |
| `params` (D-table, w, ℓ, k-anon floor, cadence, denomination) | ~256 |
| IVC verifier key (Groth16 wrap) | ~1,600 |
| counters (epoch, global cardinality, totalMinted) | 48 |
| **total consensus state** | **≈2.7 KB, constant in n** |

O(1) in population — identical at 10⁶ and 10¹⁰. Per claim O(log n): depth-34 non-membership + inclusion, verified in **one** Groth16 check, because the continuity chain is an **IVC statement** (Nova/HyperNova/Plonky3 class) — the user carries one folded proof for `D` links, not `D` proofs. Off-chain and prunable: 10¹⁰ × 32 B = 320 GB/epoch of leaves, sharded 4096× at 78 MB/shard over Veilid, discardable once the epoch root seals. Insertion contention at 10¹⁰: forest of 8 depth-32 trees with tree index as a public input — no circuit change from the PSE-audited Semaphore 4.0.0 depth-32 build (audit: PSE Security, March 2024).

---

## 8. Build order

Each phase ends in something a real human does on mainnet.

**Phase 1 — weeks. "I linked."**
Genesis + first link, no 420, no documents, no OPRF, no shielding.
- `s = keccak(signMessage(...))` on Trezor/Ledger and on Android StrongBox / iOS Secure Enclave (implement the three missing `Keystore` backends behind the trait that already exists in `ceremony.rs` — this is implementation, not redesign; `b-onboard` is currently Windows-first advapi32/BCrypt).
- `k_0`, `ctx_e` from drand, `N_e` published to a Vaulta table; `C_e` from a real 4-of-6 circle signature; journal entries via `journal.rs`.
- `ONB-LINK-*` error codes registered from day one.
- **User-visible outcome:** attend a bRespect session you were already attending, tap a phone, see your link nullifier land in the epoch root. Depth = 1.

**Phase 2 — ~2 months. "Nobody can advance my chain without me."**
- Forward shard `d_e`: circle threshold-encrypts to the attendee, delivered to a $2 NFC card tapped at the ceremony or a printed 4-word code. `k_{e+1}` requires it.
- Epoch-scoped RLN share `(x, y)` and the double-link interpolation slash.
- **Unilateral rotation shipped in the same release as the shard** — never ship capture-hardening without the escape hatch.
- **Outcome:** losing your phone costs nothing; losing your card costs one epoch; a broker holding your seed phrase can mint nothing.

**Phase 3 — ~3 months. "My cap opened."**
- IVC folding; depth-34 indexed cap-open tree; `NULL_420` claim; `D`=18 for C0.
- VRF circle assignment replaces `Xorshift`; **lineage-disjoint constraint** in-circuit; re-draw right, 3 per epoch, global pool.
- Witness-relay path for the immobile; remote seats capped at one per circle at 1/3 weight.
- W1/W2/W3 vesting rules live: non-transferable unvested quota, PoU+shard-gated tranche, any-circle rotation carrying full depth and vest.
- **Outcome:** the first humans open their 420 cap, and the first vest tranche pays through Respect (P-1 intact — the cap opens, Respect earns).

**Phase 4 — ~4 months. "Nobody can read anything off the chain."**
- Fixed-denomination shielded tranches; every root emits one identical note per epoch from epoch 0; zero-value notes for unopened roots.
- Mandatory relayer submission, shielded fee pool, k=64 shuffled inclusion batches.
- Universal sponsorship as the default funding path, redeemed after first circle.
- Global bucketed counter replaces per-class counters.
- **Outcome:** an observer sees N identical notes per epoch and nothing else.

**Phase 5 — ~6 months. "My passport made it faster."**
- `NS-DOC` (state-excluded MRZ only), mandatory AA/CA live chip challenge, CSCA master-list root with 30-day challenge window and permanent archive.
- Respect-selected tOPRF committee, n=64/t=48, ≤3 nodes per jurisdiction, single key with in-input domain separation, DLEQ availability published.
- Rotatable-PRF set re-randomisation job (≈5.8 CPU-days, parallel, publicly verifiable).
- 180-day contest window with **displacement** resolution.
- `NS-EID`, `NS-AADH`, `NS-MDL`, `NS-KYC` follow the same template.
- **Outcome:** an e-passport holder opens at `D`=9 instead of 18. Nothing else about them changes.

---

## 9. The residual — each with the experiment that closes it

1. **`q`, the rotation hazard, is a design target and not yet a measurement.** The entire economic bound in §6.3 rests on it. *Experiment:* instrument Phase 3 with an anonymous aggregate rotation counter (bucketed ≥1000, k-epoch delayed) and run a deliberate red-team: pay 50 consenting volunteers in one locality to hand over keys under a realistic broker contract, then measure observed rotation rate over 6 epochs. If `q` < 0.03, the fix is choreography — put a one-tap "this key is mine now" step at the end of every ceremony — not surveillance.

2. **Circle liveness at 10¹⁰ is unproven.** Encointer's Leu Zurich pilot lost 3 of 21 participants to shattered screens and bad cameras; nothing in this family has run past thousands. *Experiment:* run Phase 1 in three deliberately hostile localities (low smartphone density, intermittent power, high migration) for 6 epochs and publish the per-epoch link-completion rate. Fixes already staged: NFC tap instead of QR, a paper QR any witness can scan, group-signed attendance so no device is a single point of failure.

3. **Lineage-disjointness has no proven bound.** SybilLimit-class results give O(log n) ≈ 33 sybils per attack edge at 10¹⁰, but they assume a fast-mixing honest region, and real human graphs are geographically clustered. *Experiment:* simulate the lineage constraint against a broker holding fraction `p` of a locality on real-shaped graphs, and publish the `p`-vs-advance-rate curve. Run the bound **per-cascade, not globally** — a per-community bound is sound where a global one is not, and it stops a compromised region contaminating the world.

4. **Rotatable-PRF re-randomisation has not been implemented at 10¹⁰ scale by anyone.** The math is standard; the operational job is not. *Experiment:* build the re-randomisation runner against 10⁸ synthetic nullifiers, publish wall-clock, DLEQ verification cost, and the failure mode if a rotation is interrupted mid-tree.

5. **The IVC folding proof is not yet sized.** Semaphore-32 at 143 ms is measured; a depth-18 fold is not. *Experiment:* compile the fold, measure witness + prove on an S23 Ultra and a $60 Android handset, and publish. If a low-end handset exceeds ~10 s, the mitigation is circle-side proving — one member's device folds for the group, since the statement is zero-knowledge either way.

6. **`P-14`: does a `D` that varies by anchor class count as "the cap"?** P-2 says the cap is 420 for everyone; here it is, and the slope is identical — only the *start date* moves. This is a one-line founder ruling, not a re-architecture. *Action:* file `P-14` through the Article VI meta-tier per P-13's own procedure, before Phase 5.

7. **Whether 168 epochs is the right vest length.** It is set by `r·V < c + (q+δ)·C_rec`; if `V` runs above ~$1.50/b the schedule must lengthen, and lengthening is itself an exclusion cost. *Action:* publish `V*` as a live governance parameter with the formula, so the trade is made openly and not discovered by the market.

8. **The genuinely networkless recluse remains excluded**, ~0.2–0.4B. P-13 ruled this definitional rather than negligent on 2026-07-11, and every alternative on the table is a registry, which P-3 forbids. Do not paper over it. *What changed:* the residual is now **only** the genuinely isolated. It is no longer "the isolated plus everyone poor enough to be worth $45 to a broker" — a population roughly three orders of magnitude larger, and the one this design exists to protect.
