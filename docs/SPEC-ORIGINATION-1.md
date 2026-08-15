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
   Three things follow and all of them are load-bearing:
   - **The system has exactly one emission rule**, rather than one rule plus two
     exceptions. There is no second mechanism to specify, audit, or defend.
   - **Dilution tracks adoption automatically.** The concentration transient in note 1
     resolves itself as the network grows, with no intervention and no discretion.
   - **The same mechanism does both jobs**: the curve that deters sybils by lowering
     reward velocity is the curve that releases genesis. One thing to build, one thing
     to reason about, one thing that can go wrong.
3. **Does `b` carry governance weight?** Unanswered in the tree. If it votes, 2M `b`
   across two accounts is control, and the economic allocation should be separated
   from voting weight. This is a question for the governance layer, not a condition on
   this ruling.

### Why the 420 cap is the sybil defence

Stated here because it is the keystone and has been implicit: **a second bDiD does not
raise your ceiling.** It means earning another 420 from zero, through courses,
attendance and continuous PoL/PoU — costs made of human time, which §2 L2 establishes
does not parallelize. **Identity multiplication therefore has no economic upside at
all.** That is what ends the argument, and it ends it on arithmetic rather than
assertion.

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
