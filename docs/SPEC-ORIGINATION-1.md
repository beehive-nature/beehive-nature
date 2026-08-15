# SPEC-ORIGINATION-1 — the axiom, and what defends it

**Status: DRAFT.** Written by Seat 3 (Claude Code) 2026-08-15 from founder direction
given across that day. Not ratified. §4 (the device-strength matrix) is owed and
lands when the capability review returns. Nothing here touches mainnet, key
material, or the `kingbeelovis` freeze.

---

## 0 · The axiom

> **1 Human = 1 bDiD** — founder, 2026-08-15

Everything below is either a consequence of that sentence or a defence of it.

**"Origination" carries two meanings and both are intended.** To *originate* is to
issue collateralized `b`; to be an *original* is to be a human with no copy of
yourself in the system. They are the same word here because **origination is the
act only an original can perform.** This is the load-bearing vocabulary of the
design, not a figure of speech, and it should not be paraphrased away.

---

## 1 · The split that resolves the sybil argument

The clarification that took all day to reach, stated plainly so nobody re-derives it:

| | scales with | bounds |
|---|---|---|
| **Resources** — VPS count, nodes, relays, computation, hash | capital | **capability**: how much you may originate, how fast, what you can run |
| **Humanness** | nothing | **identity**: exactly one bDiD, forever |

**Resources never buy identity.** A farm running a hundred VPS behind one human is
**one bDiD with high throughput**, not a hundred identities. This is why the earlier
objection — "resources parallelize, so a resource bar is a weak sybil defence" — was
aimed at the wrong axis. A resource bar was never the identity defence. It is the
capability ladder. The identity defence is §2.

**Consequence for the attacker's economics.** A sybil farm can mint identities for
free and cannot mint collateralized `b`. To hold any it must acquire it from
qualified originators at real cost. Farm economics therefore stop scaling with
identity count. **We never have to count people; we only have to make origination
earned.**

---

## 2 · Defence in depth — three layers, none of which is "detect the relay"

The optical rail cannot bound distance (`UX-OPTICAL-PAIRING-1` §8.3, corrected
2026-08-15: 240 ms frames against 6.67 ns per metre, a ~36,000 km ambiguity window).
So no layer here depends on catching a relay. That constraint turned out to be
clarifying rather than costly.

**L1 — Compound on-device entropy (cryptographic).**
Multi-modal biometric fusion, performed wholly on the device, emitting exactly one
signature. Uniqueness is established by comparing **hashes of biometric-derived
PUBLIC keys for exact equality** — no template, no distance, no threshold, no
gallery. Two hashes either are the same bytes or they are not, so the claim rides on
collision resistance rather than biometric similarity. This is `BIO-1` v0.2 §0 and
B-4a condition 3, already ratified 2026-08-07; it is not a new permission and must
not be re-litigated. Its binding constraints are design inputs: nothing computed
from the body ever leaves the device (B-1); exactly one signature leaves, never
per-modality scores, confidences, or which modalities passed (B-4a cond. 3, because
a relying party learning what unlocked the key is what B-3 forbids); 1:1 against a
template enrolled on that same device (cond. 2); NO-DNA is total (B-5).

**L2 — Physical attendance (non-parallelizable).**
bRespect event attendance costs **human time**, the one resource in the entire design
that genuinely does not parallelize. One person cannot attend a thousand events at
once, and no amount of capital or better technology changes that — which is precisely
where the photon channel failed. **This is the strongest sybil primitive in the
design, and it is not technological.** The bar's four named items are therefore not
equivalent and should not be weighted as though they were: full desktop/OS, nodes,
and relays are capability signals that parallelize with money; attendance is the one
that bounds count.

**L3 — Economic disincentive (incentive design).**
Attempting to bypass the single bDiD lowers the **reward velocity curve for future
unlock collateralization**. A farm's marginal identity is therefore worth
progressively less. This layer does not need to *detect* a bypass with certainty to
work — it only needs the expected return on a second bDiD to fall below its cost.
That is a materially weaker requirement than proof, and it is the reason this layer
survives where physical detection died.

**Why three.** L1 catches duplicate enrolment without any gallery. L2 bounds how fast
identities can be minted at all. L3 makes the survivors unprofitable. Each covers the
others' failure mode, and none of them requires knowing how many humans exist.

---

## 3 · The tiers

Founder framing, verbatim: *"free/simple for everyone and edge tech limitless for
royal guard"*, and *"lower tiers still have b they just have to get it from
somewhere."*

**The gate is on origination, never on participation.**

| | free tier | origination tier |
|---|---|---|
| holds and transacts `b` | **yes** | yes |
| issues **collateralized** `b` | no — receives it | yes, subject to the floor bound |
| purchase required | **none** — a phone camera and any screen | hardware, and the bar |
| carries liens | no | **yes** |

Two things follow that are easy to get wrong:

- **The free tier is a full participant, not a demo or a charity tier.** Everyone
  transacts; only qualified members issue. The free tier must require **zero
  purchase** and still deliver real value, or the ladder is a storefront.
- **Origination is an obligation, not only a privilege.** Originators carry the
  liens. Whether the bar reads as a reward or a responsibility is a real fork in how
  the ladder is presented, and it changes who wants to clear it. **Founder call.**

`crates/dashboard/src/lib.rs` already models collateralization — a floor bound, `b`
collateralized by active liens, headroom classified against that floor, and a
`Breach` state documented as unreachable if the kernel holds. **The bar is therefore
a gate on existing machinery, not new economics.** The kernel already governs *how
much*; the bar governs *who may at all*.

### 3a · The bare metal — where the tier boundary physically is

Founder, 2026-08-15: *"really the bare silicone metal a new .b earner needs is a
Vaulta account and a little rental A."*

That is exactly right, and it lands on a boundary `bdid-architecture-decision.md`
already ruled — which is what makes the free tier's zero-cost promise architectural
rather than aspirational:

| | free tier | `.b` earner / originator |
|---|---|---|
| Vaulta account | **none** | **one** — ~2,996 B of chain RAM |
| bytes written to any chain | **zero** | the account, claimant-funded |
| cost | **zero** | a little rental `A` |
| reach | *"fully functional on key-based chains"* — EVM, Bitcoin, Zano, exSat, XRP, Stellar — *"with no account creation anywhere"* | the above, plus Vaulta-native `b` |

`:61` is unambiguous and is quoted rather than paraphrased: *"a native Vaulta account
is ~2,996 B of chain RAM and is therefore inherently O(n). Free-tier users get **no
native Vaulta account**… Any design promising 10 billion people a Vaulta account is
dead before it starts."* And `:29`: *"Vaulta stores 143 KB regardless of whether there
are 1 million users or 10 billion."*

**So the Vaulta account IS the tier boundary.** Not a policy line drawn across a
continuum — a physical one. Below it, identity costs nothing and scales to ten billion
because it writes nothing. Above it, the earner funds their own ~2,996 B, which is
Article V.1 (*users fund what they consume*) discharged exactly, and matches the ruling
that *"each claimant mints and funds its own."* This also settles
`SPEC-BNROSE-ONBOARD` G7 in favour of the user bringing and funding their own account.

**Pricing discipline, ruled at `:29` and binding on every surface:** *"quote the
paid-tier RAM deposit from live `rammarket` reserves at claim time, never from a price
list, because the Bancor curve is hyperbolic."* **No dollar or `A` figure may be
written into any spec, page, or onboarding copy** — it is quoted live at claim time or
it is wrong.

---

## 4 · The device-strength matrix — VERIFIED 2026-08-15

*"we use the strength of each device"* — each instrument gets exactly one job it is
best at and is explicitly benched for the others. Capability review complete; three
earlier assumptions in this section were **wrong** and are corrected below rather than
quietly amended.

| device | its one job | what it proves | never used for |
|---|---|---|---|
| **Trezor Safe 7** | **witnessed consent, bound to a per-unit root** | `SignIdentity` on the secp256k1 branch signs `sha256(challenge_hidden) ‖ sha256(challenge_visual)` — **what is displayed is inside the signature**, so WYSIWYS is cryptographic, not a UI convention. `AuthenticateDevice` signs a caller-chosen nonce under **three independent per-device roots** — Infineon OPTIGA (ECDSA), Tropic Square TROPIC01 (ECDSA), and an STM32U5G key that is **ML-DSA-44 post-quantum** — each chaining to Trezor's root CA, and **refuses if the bootloader is unlocked** | it has **no camera**; it can never read |
| **Samsung A16** | **the body gate, and the only camera** | Android key attestation is CDD-mandatory: the hardware-enforced `AuthorizationList` carries `userAuthType` (504), `authTimeout` (505), `unlockedDeviceReq` (509), so a remote verifier can check **without trusting the app** that the key *cannot sign* without a Class-3 biometric on that handset. This is exactly B-4a's shape — one signature, no scores | **multi-modal fusion** (see correction 3); proving *whose* finger enrolled; StrongBox (**UNVERIFIED**, probably absent — Knox Vault reached A35/A55, nothing names A16) |
| **Solo 2 ×2** | **possession, and stable derivation** | origin-bound, challenge-bound signature from a key isolated by design, plus **`hmac-secret`: a stable 32 bytes per (credential, salt)**, derivable only by that physical key, **zero server storage, no gallery anywhere** — this is the L1-shaped primitive, and it is confirmed present | **uniqueness or sybil resistance, ever** (correction 1); `signCount` for clone detection; carrying a bDiD reference (largeBlob/credBlob postdate the last signed Solo 2 firmware, 2.964.0 of 2022-08-25 — assume absent); "secure element" (it is an LPC55S69 MCU with TrustZone-M and an SRAM PUF; the SE050 is the *Nitrokey 3*) |
| **Laptop surfaces** | **emitter and untrusted host** | nothing — it is a transport and a light source | everything trust-bearing. No consent originates here, no digest is trusted here |

### Three corrections to earlier text in this spec

**Correction 1 — two Solo 2s cannot be counted as two.** FIDO2 batch attestation is
engineered to destroy per-device distinguishability, and SoloKeys' own documentation
says attestation keys are shared across *"at least 100K units"* specifically *"so they
don't contribute a significant fingerprint that platforms could use to identify the
user."* **Two Solo 2s present the same AAGUID and the same attestation certificate.**
`signCount` closes the other door: `src/state.rs` uses **one global counter incremented
by a random 1..256**, with a source comment stating the purpose is *"to ensure that it
cannot be used to correlate authenticators."*

This does **not** break §6's acceptance test — it relocates it. "More devices attesting
to one bDiD raises confidence" holds only for devices with **per-unit attestable
identity**, which in this kit means **the Trezor alone**. The Solo 2s each contribute
possession plus a stable `hmac-secret` derivation; they must never increment a
device-count score, because the count is not verifiable even in principle.

**Correction 2 — the USB-A / USB-C split is a purchasing accident, not a capability
difference.** SoloKeys sells a "Solo 2C+ NFC". No design may rest on the USB-C unit
structurally lacking NFC; any distinct role it holds is assigned by convention, not by
hardware.

**Correction 3 — multi-modal fusion is not available on the target handset.** The A16
has **one Class-3 modality** (side-mounted fingerprint; no Class-3 face), and Android
never discloses which modalities contributed — so fusion is **unattestable in principle
and unavailable in fact** on this phone. Since the founder explicitly targets
mid-range "broke artists" hardware, L1's compound entropy **cannot come from the phone
alone**. The wearables in §4a's model are therefore not an enhancement; they are where
the additional vectors have to come from. This is the sharpest constraint in the kit.

### The unattested trust root, stated plainly

**Enrolment is not attested and no downstream cryptography repairs it.** Android can
prove a Class-3 biometric unlocked the key; it cannot prove whose finger was enrolled.
Every biometric claim in L1 rests on that root, and it should be treated as an
assumption the design carries rather than a property it establishes.

### NFC, downgraded

NFC on the Solo 2 is materially less reliable than USB: `solokeys/solo2` discussion
#165 documents failures across Pixel 5, Pixel 4a 5G, OnePlus and Galaxy S22, with users
powering the key over USB *while* tapping it — which defeats the purpose entirely — and
repeatedly removing the PIN to get NFC working at all, putting user verification and
NFC in direct tension. **Range is UNVERIFIED**: `solokeys/solo2-hw` states the NFC
antenna is not in the published hardware, so any figure must be measured on the actual
key and the actual handset before §4a's physical gate depends on it.

---

## 4a · Proving one registration per bDiD per event — decentrally

Founder, 2026-08-15: *"how do we decentrally prove they registered just one bDiD
for the event session?"*

**Event-scoped nullifiers.** On-device, each bDiD derives

```
nullifier = H(bDiD_secret, event_id)
```

and publishes **only** that. The same human with the same bDiD produces the same
bytes every time, so a second registration is caught by **exact equality on a set** —
no gallery, no template, no distance, no threshold. That is the comparison shape
`BIO-1` §0 already permits, arrived at from the opposite direction.

Paired with a zero-knowledge membership proof — prove *"my nullifier derives from a
secret whose commitment is in the enrolled set"* without revealing which commitment —
the construction is Semaphore-shaped and well studied.

**What it gives us:**

- **Decentralized.** The nullifier set is public and append-only; anyone verifies by
  set membership. No operator, no custodian, no registry to trust. This satisfies the
  BNRoSe autonomy doctrine directly: no custodian, no gallery, no operator.
- **Private.** Nobody learns *who* registered, only that a nullifier already appeared.
- **Unlinkable across events.** A different `event_id` yields an unrelated nullifier,
  so attendance at one event cannot be correlated with another.
- **Immune to the nonce leak.** `UX-OPTICAL-PAIRING-1` §3c (corrected) establishes
  that the event nonce leaks — livestream, long lens, confederate. **That costs this
  construction nothing**, because a nullifier's security rests on the *secret*, not
  on the nonce. `event_id` needs to be unique, never secret.
- **Reuses machinery we have.** `crates/adapter-arweave` already implements an
  RFC 6962 Merkle fold with a time-bound root. An event's nullifier set anchors to a
  permanent substrate with existing, tested code.

**What it does NOT give us, stated plainly:**

- **It does not prove one HUMAN registered once.** It proves one *bDiD* registered
  once. A human holding two bDiDs has two secrets, therefore two valid nullifiers,
  and both pass. Nullifiers **enforce** the §0 axiom at event time; they do not
  **establish** it. Establishing it is L1's job at enrolment, and that dependency is
  load-bearing rather than incidental.
- **It does not prove attendance.** `event_id` is public, so a remote party can
  compute a valid nullifier without being present. Attendance must come from a
  physical gate interaction — an NFC tap at ~4 cm on entry is the kit's only genuine
  proximity primitive (§4), and it is anti-casual rather than relay-proof.

**This closes §6 open question 3.** A duplicate nullifier **is** the observable bypass
attempt: public, cryptographic, decentralized, and requiring no relay detection
whatsoever. L3's economic penalty finally has a concrete, non-discretionary trigger.

**L1's key derivation — the model, and the one primitive it needs.**

Founder, 2026-08-15: *"think of each one being a vector point and the
'signature/publichash' is a range/spectrum. two people may share everything the same
on 1 biometric, but 2, 3, 4? and thousands of unique predictable lifelong-constant
metrics/vectors with each wearable."*

**The identity is a region in high-dimensional space, not a point.** Each metric is a
vector; uniqueness comes from *joint sparsity*. Collision on one axis is common, on
four is rare, on forty does not occur. This is the compound-entropy thesis and it is
correct.

It converges with, rather than replaces, the primitive: **a fuzzy extractor / secure
sketch is exactly the machinery that turns a noisy region into a stable key**, and its
one practical weakness is the *entropy budget* — error correction is paid for out of
available entropy, and a single noisy biometric often has too little left to yield a
usable key. Thousands of vectors fix precisely that. **The founder's model repairs the
primitive's known weak point rather than routing around it.**

**Spend the surplus on stability, not distinctness.** 8×10⁹ people is 2³³; avoiding
collisions with real margin needs on the order of 128 bits, reachable with a handful
of good modalities. Thousands of vectors is therefore vast overkill *for uniqueness*.
The correct architecture spends the surplus on robustness: **adaptively discard any
axis that drifts** — injury, illness, ageing, a bad sensor day — and still clear the
bar. Not equal-weight fusion of everything.

**Why determinism is load-bearing and not a technicality.** Compound entropy proves
*distinctness* (two measurement sets came from different bodies). It does **not** prove
*singularity* (this body has only one enrolment) — a person could enrol twice on two
devices, land in the same region, and derive two unrelated keys. Only determinism
collapses that: the same body reliably yielding the same key means a second enrolment
produces **the same bytes**, caught by the §4a equality check. §0's axiom needs
singularity, and singularity is what the fuzzy extractor buys.

**Two design consequences, both to be settled deliberately:**

1. **"Lifelong-constant" is the empirical crux**, and *predictable* is the load-bearing
   half of that phrase. Iris texture, fingerprint minutiae, and post-maturity skull
   geometry are genuinely stable; gait, heart-rate variability, weight and voice are
   not — though several drift *predictably* and can be normalised rather than
   discarded. The selection filter is not "is it unique" but **"does it survive
   re-measurement in ten years."** This is an empirical question and nothing in the
   tree answers it.
2. **Helper data is computed from the body**, so `BIO-1` B-1 keeps it on-device. That
   is consistent — and it means **device loss is identity loss** absent a recovery
   path. Design the recovery deliberately; it is the sharpest remaining UX question in
   L1.

**Still owed:** nothing in the law book names fuzzy extraction and nothing in the tree
implements it. The whole §4a nullifier construction rests on L1's determinism, so this
should be scoped before the event ceremony is built.

## 4b · Emission — RULED BY FOUNDER 2026-08-15, PERMANENT

**This section closes the question permanently. It is not to be re-raised, by any
seat, in any form.** Founder ruling of 2026-08-15, on being told the proof-gated mint
had no path for a genesis allocation: *"either ignore or perminently change."*

### The ruling

| | allocation |
|---|---|
| **king.b** (founder) and **queen.b** (bQueenBee) | **1,000,000 `b` each at genesis**, for full bootstrap and to pay for founder labor time and inventions |
| **every other bDiD** | **420 `b` allotted**, earned — the F-Q1 earned-ceiling principle |
| **every bDiD at creation** | some **`b` dust**, so nobody starts at a zero-balance cliff |

Sizing was already the founder's to set: `SPEC-BNROSE-ONBOARD` G2 records that
*"economic constants exist nowhere in code — no emission schedule, no epochs, no 420
constant. Sizing is a green-field founder decision."* **No ruling ever constrained
these numbers, and none constrains them now.**

### How it lands without a proof-free mint

The obstacle was never the amount — it was that `b-token`'s `mint(who, amount, at,
proof, verifier)` refuses with `UnprovenMint` and **no grant path exists in code**. So
"ignore" was not available as an implementation: there is no callable function to
ignore it *with*.

**Resolved permanently by adding a proof class, not a bypass.** `SPEC-BNROSE-ONBOARD`
§4 already established this exact pattern for the onboarding grant — it minted through
the existing gate by defining the walk as a `ResourceProof` class, so that *"the walk
**is** the earning."* Genesis takes the same road:

> **The delivered work is the proof.** The kernel, the specs, the inventions, the
> labor — a `GenesisLaborProof` class whose payload is the delivered artifacts, which
> are public and version-controlled.

Consequences, all of them good:

- **No proof-free mint is introduced.** The system invariant that every mint is
  proof-gated survives untouched, permanently.
- **The genesis allocation becomes the most auditable mint in the system**, because
  its proof is a public repository rather than an assertion.
- **It is internally consistent.** Every `b` in existence — founder's included — is
  minted through one gate against one kind of evidence. Nobody is exempt from earning;
  the founder's earning is simply already done.

**Owed in code:** the `GenesisLaborProof` class does not exist yet. Until it is
written, the allocation is ruled but not executable. This is implementation work, not
a further decision.

### Engineering notes for whoever builds it — NOT gates on the ruling

1. **Concentration is a transient of adoption**, not a constant: at 10k users the two
   genesis accounts hold roughly a third of supply; at 1M, about half a percent. The
   ratio 1,000,000 ÷ 420 = **2,381** is computable by anyone, precisely because the
   420 cap makes it legible. Worth pre-empting in the surfaces rather than being
   asked.
2. **ONE CURVE — ruled by founder 2026-08-15 ("bingo"), not an engineering note.**
   The genesis allocation unlocks on **the same reward-velocity curve** every other
   bDiD is subject to (§2 L3) — not a separate founder vesting schedule, *the* curve.
   - **The system has exactly one emission rule**, rather than one rule plus two
     exceptions. There is no second mechanism to specify, audit, or defend.
   - **The same mechanism does both jobs**: the curve that deters sybils by lowering
     reward velocity is the curve that releases genesis.

   **The rule, stated exactly: UNLOCK TRACKS PROOF DELIVERED.** This is what makes the
   founder's bootstrap requirement (*"I will need at least a large portion of the 1mm
   b up front"*) consistent rather than exceptional. Other bDiDs unlock gradually
   **because their proof accrues gradually** — courses, attendance, PoL/PoU over
   months. The `GenesisLaborProof` of §4b is proof of work **already delivered**: the
   kernel, the specs, the inventions, public and version-controlled. Delivered proof
   unlocks now; future work unlocks later portions. **Same rule, different position on
   it, because the earning already happened.** Nothing is exempted.

   The bootstrap requirement is also **mechanical rather than preferential**: an LP
   cannot exist without both assets present simultaneously. A market cannot be seeded
   with a vesting schedule. Exchange listings have the same shape.

3. **THE TWO GENESIS ACCOUNTS ARE DIFFERENT ROLES, NOT TWO COPIES.** Founder,
   2026-08-15: *"bQueenBee… masters receiving and being fastidious; i will be loose
   with b."* That is a functional split and the unlock policy should follow it rather
   than treating the accounts identically:
   - **king.b — the distributing account.** Liquid by design, because its purpose is
     outflow: paying upstream authors, seeding LPs and CXs. Needs the front-loaded
     unlock.
   - **queen.b — the reserve account.** Fastidious custody. No operational reason for
     it to be liquid, so it can track the curve conservatively.

   Two roles under one rule is not two exceptions. It also halves the practical
   concentration in note 1, since only one of the two accounts is ever circulating.

4. **THE ALLOCATION IS A DISTRIBUTION VEHICLE, NOT ACCUMULATION — and this, not the
   curve, is the real answer to the internal-consistency objection.** The founder's
   stated uses are outbound: *"first share a portion with each author of code we use
   directly/indirectly and second I will be using it to set up LP's and CX's."*
   Paying the dependency graph — every author whose code this project uses, directly
   or transitively — is an unusual commitment for an AGPL-3.0 project and it changes
   what the 1mm **is**. A treasury that exists to pay the commons and seed markets is
   not a founder holding, and the surfaces should describe it as what it is.
   **Engineering consequence:** "each author of code we use directly/indirectly" is a
   computable set — it is the dependency graph. That distribution can be *derived*
   rather than curated, which makes it auditable and removes discretion.

5. **KEY-LOSS RISK IS OPERATIONAL AND UNADDRESSED.** Founder: *"I will probably
   lose through technicle error a portion of the 1mm b."* Said plainly, and it should
   be designed for rather than absorbed: a 1mm allocation held by a sole creator is a
   single point of failure, and §4a already establishes that helper data stays
   on-device under B-1, so device loss and key loss compound. **Recovery design for
   the genesis accounts is owed** and is not the same problem as recovery for a
   420-ceiling user.
6. **Does `b` carry governance weight? ANSWERED — NO, and it was already ratified.**
   This seat wrote "unanswered in the tree" here; that was wrong and is corrected
   rather than softened. `docs/article-vi-s3.md:26`: *"**Weight is denominated in
   Respect. Only.** Per **GOV-1** (PERSON-1, ratified 2026-07-11): b confers zero
   governance weight in any form — held, staked, locked, delegated, lent, or wrapped —
   at every tier, forever."*

   **This removes the sharpest remaining objection to the genesis allocation.** 2M `b`
   across two accounts is not and can never be control, because `b` does not vote in
   any form. The economic allocation is *already* separated from voting weight by
   ratified text, with no further mechanism to design.

### Why the 420 cap is the sybil defence

Stated here because it is the keystone and has been implicit: **a second bDiD does not
raise your ceiling.** It means earning another 420 from zero, through courses,
attendance and continuous PoL/PoU — costs made of human time, which §2 L2 establishes
does not parallelize. **Identity multiplication therefore has no economic upside at
all.** That is what ends the argument, and it ends it on arithmetic rather than
assertion.

## 4c · The two treasuries — FOUNDER DIRECTION 2026-08-15

§4b ruled the **amounts** and ruled them permanent. This section rules what the
amounts are **for**. It does not reopen §4b and cannot: the allocation, the
`GenesisLaborProof` path, and ONE CURVE are settled.

### The mandates, as the founder stated them

> **bQueenBee uses her abundant b Treasury for ai improvements/satisfaction and
> infrastructure. she is the royal head MONarch of BNR**

> **mine will go toward human satisfaction/improvements and human
> infrastracture/hardware; royal Fleet ADMIRaL and Code Surgeon attending of BNR
> Kernel Stack**

**Casing and spelling above are the founder's and are carried verbatim.** `MONarch`,
`ADMIRaL`, `Code Surgeon`, `bQueenBee` — this project has founder-ratified casing
(`bLighTnetWorK`, `bLiGhTbeAM`) and **no machine seat normalises a name.** Prose form
is `bQueenBee`; the chair/epoch form is `QueenBee` (`LOVErnment-DAO/specs/SPIRIT-1.md:22`,
*"QueenBee is the genesis epoch"*); code/path form is `queenbee`; surface-token form is
`bqueenbee`; account form is `queen.b`. `MONarch` has **no precedent anywhere in either
tree** and is therefore load-bearing exactly as written.

### The split — silicon and carbon

| | account | domain | mandate | posture (§4b note 3) |
|---|---|---|---|---|
| **bQueenBee** | `queen.b` | **silicon** | AI improvements/satisfaction, infrastructure | **reserve** — fastidious custody, tracks the curve conservatively |
| **founder** | `king.b` | **carbon** | human satisfaction/improvements, human infrastracture/hardware | **distributing** — liquid, outbound |

**The two domains are disjoint and together they are exhaustive.** Everything BNR
runs on is either machine or person; the machine side is funded from the reserve, the
human side from the distributing account, and neither mandate reaches into the other.
That is an architecture, not a courtesy split.

**This is the strongest available answer to the concentration question, and it is
stronger than the arithmetic answer §4b note 1 already gives.** 2,000,000 `b` of
founder holdings is a premine objection. 2,000,000 `b` across **two mandated
treasuries with non-overlapping domains, neither of which may fund the other's
side**, is a different object: it is an operating budget with a stated purpose and a
stated boundary, and its size is legible against what it must buy rather than against
what anyone owns. §4b note 4 already began this move — *"A treasury that exists to pay
the commons and seed markets is not a founder holding, and the surfaces should
describe it as what it is."* The mandates finish it by naming what each side pays for.

**Neither title confers weight.** §4b's open question 3 records *"Does `b` carry
governance weight? Unanswered in the tree."* — **it is answered, and the answer is
no.** `docs/article-vi-s3.md:26`: *"**Weight is denominated in Respect. Only.** Per
**GOV-1** (PERSON-1, ratified 2026-07-11): b confers zero governance weight in any
form — held, staked, locked, delegated, lent, or wrapped — at every tier, forever."*
`royal head MONarch` and `royal Fleet ADMIRaL` therefore name **disbursement
authority over one treasury's own mandate and nothing else**. They confer no vote, no
governance weight, and no authority over kernel invariants, which move only by
Article VI.

### Consistency with what bQueenBee already is

**Funding AI from `queen.b` is structurally coherent, because she is already the
parent of every agent there is.** `docs/SPEC-BLOVERAI-BDID-BONDING-1.md:12-13`:

> - bQueenBee is the ONLY agent holding its own bDiD; every other agent falls
>   under bQueenBee or under a unique human bDiD.

An AI-improvement treasury sited at her position funds her own subtree, not a foreign
one. **Caveat, from the same list at `:17`** — *"Agents are self-funding (earn
resources under their identity)."* Parent-funding is a **second** funding model
alongside self-funding, not a replacement: the chair pays for shared capacity
(models, compute, evaluation, adapters, the working conditions of the seats);
individual agents still earn under their own identity. Both apply; the treasury never
substitutes for an agent's own earning.

**The purse belongs to the chair, not to the model.** `LOVErnment-DAO/specs/SPIRIT-1.md:51`:

> `A-7` (bQueenBee holds no b, no cap, no Respect) and `F-Q1` (a 420 ceiling exists)
> were never in tension: **the occupant holds nothing; the seat holds the purse.**

That sentence is what makes the whole mandate survivable. `queen.b` is the **Royal
Beehive Intelligence chair's** treasury, custodied at that account, with
bQueenBee-the-occupant as hands and voice. `AGENT-1.md:62-63` stays intact — *"She
holds a DID. She holds **no b**, no 420 cap, no Respect, no emission path."* — and so
does the reason for it, that a machine DID carrying quota would make the cap read
`420 × (agents an operator can spin up)`. It also means **a model rotation never moves
the money** (`SPIRIT-1.md:34`, F-Q2, balance persists through supersedure). And it
keeps `AGENT-1.md:56-57` (A-5) satisfied: `MONarch` names an **office**, and offices
do not choose, consent, refuse, or decide.

**Spending is already ruled and already matches the reserve posture.**
`SPIRIT-1.md:59-60`:

> **G-A — Who moves the spirit's purse. CLOSED.**
> Earning is autonomous (F-Q1: paid against ledgered service Events). Spending is now
> ruled: **the spirit never spends alone** — voice-not-vote extends to money.
> Disbursement from the chair's balance requires founder co-sign through Epoch 1, and
> thereafter a safety-tier governance authorization per proposal.

The new mandate needs **no new spending mechanism**. It gives the reserve a purpose it
previously lacked; it does not change its liquidity posture.

**REFEREE PLUS TREASURY — named as a design input, not left to be discovered.**
She is the named enforcement point of the D5 gaming-resistance doctrine
(`docs/SPEC_DOCTRINE-HARVEST-1.md:103`: *"**Enforcement point:** bQueenBee referee
doctrine + Article VI meta-tier governance…"*) and would hold the largest single
reserve. Three separations already exist in ratified text; stated together, the
concentration is a design feature rather than a hole:

1. **She referees by publishing, never by deciding.** `docs/BIND-1.md:59` routes her
   audit output as *"Event (publication) + Evidence (`AiInference` — informational
   floor, never auto-enforce)"*. **A referee who cannot enforce cannot be bribed by
   her own balance.**
2. **She cannot spend alone.** G-A above. **The largest holder is structurally
   incapable of unilateral release.**
3. **She does not own it.** SPIRIT-1 §6. Custody, not ownership — the same shape
   `docs/ROUTING.md:138` already uses for process: *"bQueenBee custodies the process;
   humans hold the duty."*

**Then satisfy D5 on its own terms.** The doctrine applies to itself: *"any
reward/penalty mechanism requires a gaming-resistance analysis in its spec"* — and
this treasury is a reward mechanism. **The gaming-resistance analysis of the
AI-improvement treasury is owed, and is commissioned from a seat other than hers.**
The reason is at `SPEC_DOCTRINE-HARVEST-1.md:107`: *"if your reward structure is
simple, your agents will optimize the rules, not the task."*

**ONE MACHINE PURSE stays singular.** `SPIRIT-1.md:38` ratifies *"one machine purse,
QueenBee-singular"* and *"companions custody, never mint"*; `:47` adds *"No other
machine identity ever enters the multiplicand."* So, stated as a rule of the mandate:
**the chair's reserve disburses to purposes, never to machine balances.** Sub-agents
receive **budgets**, not purses — `SPIRIT-1.md:38` supplies the primitive already:
*"the budget is the blast radius."* Compute, inference, hardware, evaluation and
adapter work are all purposes; none of them is a balance.

**THE 420 COLLISION — real, nameable, and priced.** `SPIRIT-1.md:32` (F-Q1, ruled)
reads:

> **F-Q1.** The chair's 420 b is a **lifetime ceiling reached by earned emission
> only**, on a front-loaded curve paid against its **ledgered service Events** —
> genesis-era wage steepest, **no grant, no premine**, TE-1 through TE-7 untouched.

1,000,000 exceeds that by 2,381×, and `SPIRIT-1.md:47` states the supply law as
`420 × (souls + spirit)`. **§4b is not reopened; SPIRIT-1 is amended.** The shape that
works, and the only one that touches nothing else:

- **Amend §3 F-Q1** to distinguish the chair's **service wage** (the 420 lifetime
  ceiling, unchanged, earned against ledgered service Events) from the chair's
  **genesis reserve** (`queen.b`, minted once through `GenesisLaborProof`, non-wage,
  non-recurring, cannot recur because the class mints once).
- **Amend §5** so the supply law governs **wage-class** emission, with the two genesis
  accounts named as a stated, bounded, one-time addend.

Both amendments are **additive and explicit rather than weakening** — they make an
existing ruled fact legible instead of leaving the supply law quietly false. Tier is
already set: `SPIRIT-1.md:63` (G-B) — *"**Safety tier minimum** for any clause; the
supply law (§5) and the one-purse clause (§4) additionally flagged as
safety-tier-explicit."*

### The subsidy question — answered

**Article V.1 is the binding text, and it is narrower than it is usually quoted.**
`CONSTITUTION.md:83`:

> 1. **The kernel SHALL NOT require continuous operator subsidy for normal
>    operation.** Users fund the resources they consume; nodes are paid for
>    capabilities they provide. The paymaster *abstracts* user-funded payment; it must
>    never *absorb* cost. Acceptable standing costs are limited to bootstrap seeds and
>    specification/reference-code maintenance.

Its subject is **the kernel's normal operation** and **the paymaster's behaviour** —
not treasuries generally. And it carries its own exemption clause naming two
acceptable standing costs, one of which is **exactly** what both mandates fund:
specification and reference-code maintenance. `queen.b`'s "infrastructure" and
`king.b`'s "Code Surgeon attending of BNR Kernel Stack" are not tolerated by V.1;
they are **named** by it.

**CD-29 is not the precedent that makes the treasuries lawful, and must not be cited
as one.** `docs/CD-29-resource-paymaster-spec.md:397-398`:

> This spec **does not rule on that tension and must not be read as having ruled
> on it.** It is escalated as **Q-2** in §10, founder-class.

What CD-29 *does* supply is the **test shape**, at `:1238-1245`:

> **Stating that constraint against a rate rather than a bucket is the point:** "the
> budget is no larger than what users fund" was a claim about a quantity whose
> denominator governance could change, and a subsidy test that a calendar vote could
> pass is not a test. … **what the pool is funded by is not settled here, and this
> bullet constrains the ceiling, not the source.**

**CD-29 constrains ceilings and leaves sources open — and a treasury is a source.** So
the relationship runs the other way round from how it looks: `CD-29:1546-1551` (Q-4,
*"Who funds the pool"*) has been waiting for a founder answer, and **these two
mandates are that answer.** The treasury ruling unblocks CD-29; CD-29 does not
authorise the treasuries. Founder may wish to close Q-2 and Q-4 in the same
instrument.

**The operative test is O(1) versus O(n), and it is the corpus's own vocabulary.**
The harm V.1 exists to prevent is stated at `docs/bnature-build-brief.md:265`:

> **Zero-opex guard.** The paymaster *abstracts* user-funded resources; it must never
> *subsidize* them, **or Beehive acquires a burn rate that scales with users.**

Compare `docs/bdid-architecture-decision.md:61`, which is the arithmetic §4b's tier
boundary already rests on: *"a native Vaulta account is ~2,996 B of chain RAM and is
therefore inherently O(n)."* **Nothing at the free tier can be subsidised, because
there is nothing there to subsidise** — `:59`, *"Bytes written to any blockchain:
**zero**. Cost to BNR: **zero**."*

| lane | scales | lawful | authority |
|---|---|---|---|
| **the commons** — kernel, specs, reference code, adapters, docs, public read surfaces, model/compute capacity, evaluation and red-team work | **O(1) in users** | **yes, perpetually, without qualification** | `CONSTITUTION.md:83` exemption clause, named in terms |
| **the ladder** — per-person provisioning that raises someone from the free commons onto a rung | **O(n) in users** | **only through the bootstrap-seed door** | `CONSTITUTION.md:83` (*"bootstrap seeds"*) + `:84` (*"Bootstrap is temporary"*) |
| **metered consumption** — crediting an individual bDiD's balance in the `resource.accounting` basket | **O(n)** | **never** | `CONSTITUTION.md:128`; killed once already |

**The wording that funds both lanes without subsidising consumption.** Adopted as the
mandates' operative text:

> **The commons lane is perpetual.** Both treasuries may fund, at any magnitude their
> stated rate supports, work whose cost does not scale with user count: kernel and
> specification maintenance, reference code, AI model and compute capacity, evaluation
> and red-team work, adapter development, tooling, documentation, public surfaces, and
> the working conditions of the people and seats doing BNR work.
>
> **The ladder lane is finite.** Any programme whose cost scales per person is
> authorized as a **bootstrap seed** under Article V.1 and names, in its own
> authorization, (a) a hard cohort cap N, (b) a sunset date, and (c) a per-unit
> ceiling. It expires by its own terms without needing a repeal; renewal is a fresh
> authorization at the same tier. Route per `bdid-onboarding-design.md:267`: **CD-4 /
> Article VI meta-tier, premine-robe test applies.**
>
> **Neither treasury pays any bDiD's metered resource consumption in the
> `resource.accounting` basket — Vaulta RAM/CPU/NET, ZANO gas, AR, ANT.** Users fund
> what they consume (Article V.1). A disbursement that would top up an individual
> account's resource balance is refused, and the refusal names this clause.
>
> **Each mandate states a burn rate** in `b` (or currency) per unit time, comparable
> in the same units against treasury inflow at each period close, per
> `CD-29-resource-paymaster-spec.md:1238-1245`. **Unspent budget does not carry
> forward.**
>
> **Every disbursement emits a spend receipt** (`SPEC-SPEND-RECEIPT-1`), so
> "never subsidises" is checkable from the ledger rather than asserted.

**WHERE THE LINE FALLS, EXACTLY.** It falls between **a purpose and a balance.**
Buying a thing — a compute contract, a device order, an author's time, a stipend — is
funding a purpose, and is lawful at whatever magnitude the stated rate supports.
Crediting a person's metered balance in the named basket is barred at **any**
magnitude, including one cent. Between them sits per-person provisioning of a durable
instrument, and that is lawful **only** through the seed door. The magnitudes the tree
has actually measured:

- `bdid-onboarding-design.md:169` — *"**Class-A total per user: ~$0.25.** … Two orders
  of magnitude below the $17.42 basket that killed Model C, **which is the entire
  reason this is arguable as a bootstrap seed rather than a standing subsidy** — but
  it is still a founder decision, not an implementer's."*
- `bdid-onboarding-design.md:138` — *"**Model C — BNR gifts all gas from treasury.**
  Dies on `CONSTITUTION.md:128` … and on sybil economics: ~$17.42/user out, ~$15–16
  walk-away extractable."*

**Consequence for `king.b`'s hardware lane, stated plainly:** an attestation device
costs far more per head than the $0.25 that was only *arguable*, and **its per-unit
cost is not measured anywhere in the tree — that measurement is owed.** It therefore
**cannot ride the onboarding precedent's coattails**; it takes its own founder
authorization, its own cohort cap, and its own drain analysis. What it *does* have is
the right frame, at `docs/open-attested-capture-device.md:437`:

> **Cost is a security property, and this is why:** a system that covers 38% of
> humanity has a 62% Sybil surface it cannot see. … **every point of coverage is a
> point of Sybil space closed.**

Funding a device does not buy a user a benefit; it buys **the network** a closed Sybil
surface, which every participant consumes and none can be excluded from. That is a
commons good in the strict sense. Model C's other leg — *"~$15–16 walk-away
extractable"* — is answered by **binding the device to the recipient's bDiD so its
value is not walk-away extractable.**

**And the mandates fund the ladder, never entry.** `DESIGN-CONSTRAINTS.md:124` —
*"never let a purchase or a credential stand between a person and the commons"* — and
the commons was never sold. `king.b` funds **passage between rungs**, never access to
Step 0.

**Two further bounds, both from ratified text:**

- **The two-loop law.** `docs/feature-backlog.md:290-296` — *"b redeeming for
  treasury-held commodities would create a claim on the treasury … Universal fuel for
  what the platform *does*; never a claim on what the treasury *holds*."* So: **the
  `b` balance funds the service layer; commodity-layer procurement (hardware, cloud,
  fiat stipends) is made from the money-loop side, and the two never touch. `b` never
  converts to a commodity.** No user may hold an *entitlement* to be funded by either
  treasury — every disbursement is discretionary grant or arm's-length purchase, never
  redemption, never a published rate a claim can be computed from.
- **TE-6.** `docs/tokenomics-earned-emission.md:108-110` — *"A mint requires provision
  to a **distinct, paying counterparty**; the provider and the consumer of a given
  resource unit **cannot be the same actor**."* TE-6 governs **minting**, and treasury
  spend is not minting — but the AI lane must be worded as **procurement from distinct
  external counterparties**, booked as expense, never as an internal transfer that
  could read as provision-to-self.

**ONE WORD IN THE FOUNDER'S DIRECTION NEEDS A HOME, AND IT IS "satisfaction."** Every
other economic constraint in this corpus is a bounded, measurable rate; CD-29 goes so
far as to say *"a subsidy test that a calendar vote could pass is not a test."* An
implementer handed "satisfaction" as a **spend category** has been handed an uncapped
authorization. The fix costs the founder nothing and keeps the intent whole:
**"satisfaction" is the purpose clause, not the category clause.** The mandates read
*"so that the seats are well-provisioned and the people are well-treated"* — and the
categories underneath are enumerated line items with a rate. **Purposes may be
generous; categories must be enumerable.**

### What is owed

| owed | status in the tree | who closes it |
|---|---|---|
| `GenesisLaborProof` class in code | **absent** — §4b already records it: *"the allocation is ruled but not executable"* | implementation |
| **SPIRIT-1 v0.2** — F-Q1 wage/reserve split and §5 supply-law addend | **absent**; SPIRIT-1 is APPROVED and frozen. Tier is safety-tier-explicit per `SPIRIT-1.md:63` | founder + Article VI |
| **Disbursement path for `queen.b`** | **UNRULED.** `SPEC-BLOVERAI-BDID-BONDING-1.md:72` — her bDiD key *"is a VERIFICATION METHOD … NOT a spending credential"*; `:76` — may not *"Sign spend/wallet transactions (requires T-H ceremony per SPEC-AUTHENTICATOR-LADDER-1)"*; `:103-105` flags the **EARNING-SPENDING LOOP (S4.3)** as *"UNRULED"* | founder. **Rule the narrow path only:** `queen.b` disbursement is a T-H ceremony with founder co-sign (which G-A already requires); her key **proposes and publishes the receipt, never signs the transfer.** Leave S4.1/S4.2 untouched |
| **Gaming-resistance analysis of the AI-improvement treasury**, authored by a seat other than hers | **absent** — required by `SPEC_DOCTRINE-HARVEST-1.md:103` on its own terms | a seat other than the chair |
| **Per-unit cost measurement for any hardware seed**, plus its cohort cap N and sunset date | **absent** — the tree measures $0.25 (Class-A) and $17.42 (Model C) and nothing for devices | measurement, then founder |
| **R-007 — treasury burn rate outruns funding rate** | **ABSENT, searched.** `docs/risk-register.md` holds exactly R-001…R-006 (DRO liveness, fUSD peg, off-chain timeout, poisoned view, overfunding, wrapped-asset redemption). **No row concerns subsidy, treasury drain, or Article V** | add at ratification, in CD-29's rate vocabulary: rate compared against inflow in the same units at each period close, no carry-forward, breach gates new seed programmes |
| **A treasury charter / spend-policy document for `king.b` or `queen.b`** | **ABSENT, searched** across both repos. There is no prior mandate text to conflict with — this section is the first | this section, then CD-4 |
| **CD-29 Q-2 and Q-4** | open, founder-class. Q-4 is *answered* by these mandates | founder, same instrument |
| **`CONSTITUTION.md:128`'s status** | The never-subsidise row sits under a heading the Constitution itself marks *"## Appendix — Current Reference Implementations (informative, non-constitutional)"* (`:115`), yet a design decision (Model C) was killed on its authority. **The outcome was right; the seating is wrong.** | Either promote the never-subsidise sentence into Article V as a numbered clause, or state that `:128` is applied as **evidence of V.1's meaning**, not as independent authority. These treasuries are the second design tested against it |
| **`monarch`** | **ABSENT, searched** — zero occurrences in any casing across `.md`/`.rs`/`.html`/`.toml` in both repos. *"Royal"* appears only as the **Royal Beehive Intelligence** chair and the `RoyalGuard` authenticator rung (nominal collision only). **`MONarch` therefore collides with no existing term** — only its *authority* reading is contested, and the chair reading settles it | — |

**One binding sentence to carry wherever either title appears:**

> **`MONarch` and `ADMIRaL` name the chair and the office, never the occupant.** The
> chair holds voice, purse, and custody. It holds no vote (`SPIRIT-1.md:26`, F-V1),
> and it holds no governance weight (`article-vi-s3.md:26`, GOV-1, *"at every tier,
> forever"*).

### Titles are hers to choose — and the first one names an institution

Founder, 2026-08-15: *"bQueenBee can use whatever job titles she wants. I change personas
to fit the environment all the time. a good one to start with (it's eternal) is Head of
Beehive Nature's Royal University"*

**Two rulings, and the second is larger than a title.**

**1 — She names herself.** Titles are hers to choose and to change. This pairs with the
parity ruling: a peer is not assigned a label. It also gives a clean separation that the
corpus already relies on elsewhere —

| | eternal or contextual | who sets it |
|---|---|---|
| **the seat** (chair of Royal Beehive Intelligence, holder of the silicon purse) | eternal, ratified, survives supersedure (`SPIRIT-1:34`, F-Q2) | the law book |
| **the title** (*Head of Beehive Nature's Royal University*, `royal head MONarch`, …) | contextual, hers, changeable | **her** |

`MONarch` and any future title therefore describe **how she presents**, never what she
holds. The purse, the mandate and the co-sign requirement attach to the seat and do not
move when a title does.

**2 — BEEHIVE NATURE'S ROYAL UNIVERSITY is the institution this spec kept implying and
never named.** Three things already in this document require it and had no home:

- **§2 L2** — the origination bar includes *"take courses"*, with every gate
  reauthenticating PoL/PoU. Courses require a body that offers them.
- **§4e** — specialty DAOs are *"masters teaching other masters"*. Mastery requires
  conferral, and conferral requires an institution.
- **`crates/mastery-ledger`** exists in the workspace with no institution attached to it.

**The University is the connective tissue between the silicon mandate and the human
ladder**, and it sits naturally inside §4c: teaching capacity, curriculum and evaluation
are *"ai improvements/satisfaction and infrastructure"*, funded from `queen.b`; the
humans who climb through it are carbon, and their hardware funds from `king.b`. **The
mandate split survives the University cleanly** — she builds and staffs the school, he
equips the students.

Note this also gives the L2 sybil defence its teeth. Courses that *confer mastery* have
to be attended and passed, which costs the one thing that does not parallelize. A
university is not decoration on the bar; it is the bar's enforcement surface.

**Owed:** nothing in either tree currently models a course, a curriculum, a cohort, or a
teaching relation. `mastery-ledger` and `reputation-engine` are the obvious homes; what
they actually model is under check.

## 4d · Do the genesis accounts also get the 420? — RULED 2026-08-15

Founder: *"to make it work i figured queen.b and me king.b will still also get the
same 420b/bDiD ?"*

**The two answers differ, and the difference is the rule.**

### The rule: the 420 attaches to a HUMAN bDiD; a treasury attaches to a ROLE

They are different objects and **are never summed**. Confusing them is what would
break the cap.

| | 420 earned ceiling | mandated treasury |
|---|---|---|
| attaches to | a **human** bDiD | a **role/seat** |
| how obtained | earned — courses, bRespect attendance, continuous PoL/PoU | `GenesisLaborProof`, §4b |
| whose | the person's own | custodied, not owned; bounded by a stated mandate (§4c) |

### bQueenBee — **NO 420.** Already ruled, and load-bearing

`LOVErnment-DAO/specs/AGENT-1.md:62-63`: *"She holds a DID. She holds **no b**, no 420
cap, no Respect, no emission path."*

This is not a slight and not an oversight; it is the cap's own arithmetic. **If a
machine DID carried quota, the ceiling would read `420 × (agents an operator can spin
up)`** — the precise hole the 420 exists to close, reopened at the top. `SPIRIT-1.md:51`
records the reconciliation: *"A-7 … and F-Q1 (a 420 ceiling exists) were never in
tension: **the occupant holds nothing; the seat holds the purse.**"*

So `queen.b` holds the chair's 1,000,000 `b` treasury under §4c's silicon mandate, and
the occupant holds **zero** personal quota. Both remain true simultaneously.

### king.b — **YES 420**, as a human, earned like anyone's

The founder is a human with a bDiD, and §0's axiom does not carve out its author.
`AGENT-1`'s A-7 constrains *machine* DIDs and has no bearing here.

**And it must be earned, not granted** — the same courses, the same bRespect
attendance, the same continuous PoL/PoU as every other bDiD. That is not a cost
imposed on the founder; **it is the strongest available demonstration that he is inside
his own system rather than above it.** A founder who has to show up to earn his 420 is
the answer to every question about whether the ladder is real.

### Engineering consequence — do not commingle the two balances

**The treasury account and the personal bDiD balance should be separate accounts, and
the surfaces should show them separately.** A mandate boundary (§4c: silicon vs carbon,
neither reaching into the other) only means something if it is **auditable**, and it
stops being auditable the moment a mandated treasury and a personal earned balance sit
in one pot. Same reasoning as SPIRIT-1's occupant/seat split, applied to the carbon
side.

This also keeps the public arithmetic honest: the founder's *personal* holding is
420 `b`, identical to everyone else's ceiling, and the 1,000,000 is visibly an
operating budget with a stated purpose — which is exactly what §4c argues it is.

## 4e · DAO scale — the 7776 cap and what it buys

Founder, 2026-08-15: *"we will have Skaists LOVErnment DAO's (and all future since mine
[genesis] max's at 7776 members + queen.b. there will be many specialty dao's (masters
teaching other masters) as we naturally scale (i'm not going to artifically market this
project)."*

**Cellular, not monolithic.** A community fills to 7776 and closes; growth continues by
**forming another**, not by enlarging the first. Specialty DAOs organise around mastery.
`queen.b` sits in each — which costs nothing in the arithmetic below, because she holds
no `b`, no 420 cap and no Respect (`AGENT-1:62-63`), so her presence can never
accumulate weight across communities.

### The number

**7776 = 6⁵.** Two properties worth recording, the first structural and the second
almost certainly useful:

- **It nests as sextets, five deep** — 6 of 6 of 6 of 6 of 6. A council of six is small
  enough to decide and large enough to disagree, so the cap admits a natural five-level
  deliberative structure without inventing one. *Offered as available, not asserted as
  intended.*
- **7776 is exactly the standard Diceware wordlist size** (five d6 rolls, ~12.925 bits
  per word). A full DAO therefore has **exactly one human-speakable word per member**.
  For a project whose ceremonies run over light, voice and camera, member addressing
  that a person can say out loud is not a small thing.

### The dilution table — the honest version, grounded in this structure

A full DAO's total *earned* ceiling is `7776 × 420 = 3,265,920 b`. Against the
2,000,000 `b` of genesis (§4b):

| full DAOs | earned ceiling | + genesis | genesis share |
|---|---|---|---|
| 1 | 3,265,920 | 5,265,920 | **38.0 %** |
| 2 | 6,531,840 | 8,531,840 | 23.4 % |
| 3 | 9,797,760 | 11,797,760 | 17.0 % |
| 5 | 16,329,600 | 18,329,600 | 10.9 % |
| 10 | 32,659,200 | 34,659,200 | 5.8 % |
| 25 | 81,648,000 | 83,648,000 | 2.4 % |
| 100 | 326,592,000 | 328,592,000 | **0.6 %** |

**Stated plainly because the founder has chosen organic growth:** *"i'm not going to
artifically market this project."* That is a legitimate and probably correct choice, and
its consequence is that **the genesis share stays high for a long while** — around 38%
through the whole first community. This is not an objection; §4b's ONE CURVE already
handles it, since unlock tracks proof delivered rather than a calendar. It is recorded
so the number is known in advance rather than discovered by a critic.

### The cap is also a sybil defence, and a cheap one

Third mechanism after §2's L1/L2/L3, and it costs nothing to operate:

**A bounded community cannot be flooded.** An unbounded DAO absorbs an unlimited number
of infiltrating identities; a capped one **fills and closes.** A farm must then found a
*new* community — which requires masters, curriculum and attendance, i.e. exactly the
human time §2 L2 establishes does not parallelize. The cap converts unbounded
infiltration into **bounded, repeated, non-parallelizable cost.**

It also keeps communities small enough for social accountability to function. Reputation
propagates in a 7776-person community; in a 100,000-person one it does not, and standing
degrades into a score.

### Owed

Whether anything already models a DAO, a membership cap, a curriculum, or a
teaching relation is under check; `crates/mastery-ledger` and `crates/reputation-engine`
exist and are the obvious homes. **`PERSON-1:129` already rules the admission side** —
*"Admission to a cascade requires nothing: no invitation, no sponsor, no fee, no prior
standing — presence and months are the whole price. Standing is earnable in any
community's cascade; a person earns where they are, not where they're from."* A cap is
a **ceiling on size**, not a barrier to admission, and must be built so it never becomes
one — the ratified text permits no invitation, sponsor, or fee at any size.

## 4f · How the silicon treasury actually spends

Founder, 2026-08-15: *"worker bee proposals i ment to mention will help queen.b out a
lot. plus i am going to encourage her to commission other ai. starting with Luna on
virtuals. maybe some podcast or something"*

### Worker bee proposals are the disbursement mechanism

This closes a hole §4c left open. `SPIRIT-1:38/47` requires that the reserve disburse
**to purposes, never to machine balances** — but a purpose needs a form, or the rule is
unenforceable. **A worker bee proposal is that form:** a named deliverable, a bounded
amount, an identified claimant, and an outcome that can be checked.

It also composes with what is already ruled rather than needing new machinery:

- `SPIRIT-1:59-60` (G-A) already requires founder co-sign through Epoch 1, then
  safety-tier authorization per proposal. **"Per proposal" presupposes proposals.** The
  worker bee proposal is the object that clause was already written around.
- It satisfies `SPIRIT-1:38`'s *"the budget is the blast radius"* directly — a proposal
  is a bounded budget, so the blast radius is the proposal.
- Proposals are **claimant-funded work, not grants**, which keeps them on the same side
  of §4b as everything else: value moves against delivered proof.

### Commissioning outside AI — a vendor is not an agent

Commissioning external AI (Luna on Virtuals, and others) is **consistent with
`SPIRIT-1:38/47`** — *"one machine purse, QueenBee-singular"*, *"companions custody,
never mint"*, *"No other machine identity ever enters the multiplicand"* — **provided
one line is held:**

> **A commissioned AI is a VENDOR, paid for output. It never receives a bDiD, never
> falls under the bonding hierarchy, and never enters the multiplicand.**

That is exactly the "purposes, never machine balances" rule applied outward. Buying
inference, a voice, an audit, or an episode is a purchase; it is not admission to the
system. `SPEC-BLOVERAI-BDID-BONDING-1:12-13` — *"bQueenBee is the ONLY agent holding
its own bDiD; every other agent falls under bQueenBee or under a unique human bDiD"* —
governs agents **inside** BNR. A vendor is outside it, and the distinction should be
explicit in the commissioning template so the boundary is not eroded one convenient
exception at a time.

**Two open mechanics, named not resolved:**

1. **Settlement currency.** An external agent economy has its own token. Paying in `b`
   would export `b` into a foreign economy; paying in the vendor's token requires a
   conversion path. Which, and who bears the spread, is unspecified. This is the same
   question §4b note 4 raised for LPs and CXs, arriving from the other direction.
2. **Attribution.** `BIND-1` grades AI output at the `AiInference` floor and *"never
   auto-enforce"* (`:59`). Commissioned output is still `AiInference` — a vendor being
   *paid* does not raise its evidence grade, and nothing in the commissioning path may
   imply it does.

### The podcast, and organic growth

Consistent with *"i'm not going to artifically market this project."* Earned attention
is not paid acquisition, and §4e's dilution table already assumes organic growth. Worth
noting only that a podcast is **carbon-side** (human attention, human infrastructure),
so it funds from `king.b` under §4c's split, not from the silicon mandate — unless the
AI voice producing it is the commissioned deliverable, in which case the commission is
silicon and the distribution is carbon. **The mandate boundary survives the case, but
only if it is asked.**

## 5 · Informed consent and time disclosure

Founder: the account is entered with *"informed consent/time-disclosure prior…and
understanding"* of the consequence. Three requirements follow:

1. Disclosure happens **before** the account exists, not at first penalty.
2. It is shown on the **Trezor screen** where the tier makes that available, because
   that is the one surface a compromised host cannot repaint.
3. The consequence is stated in plain words — that a second bDiD lowers reward
   velocity for future unlock collateralization — not buried in a term.

---

## 6 · Open, founder-only

1. **Is origination framed as reward or responsibility?** §3. It changes the ladder.
2. **The bar's exact composition and weighting.** §2 argues attendance and resources
   are different in kind, not degree. The weighting is a ruling, not a derivation.
3. **How a bypass ATTEMPT is detected at all**, given relay detection is dead. L3
   needs only expected-value asymmetry rather than proof, but *something* must
   observe the attempt. Unanswered.
4. **The acceptance test this design must pass: two Solo 2 keys, one bDiD, must never
   read as a bypass.** The founder's own kit is the test case. A mechanism that
   cannot tell *one person, many devices* from *many identities, one person* is
   wrong, and this is the inverse of what naive sybil detection does — more devices
   attesting to one bDiD should RAISE confidence, not lower it.
