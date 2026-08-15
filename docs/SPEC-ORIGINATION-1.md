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

## 4 · The device-strength matrix — OWED

*"we use the strength of each device"* — each instrument gets exactly one job it is
best at and is explicitly benched for the others. The verified matrix lands when the
capability review returns. Preliminary and **UNVERIFIED** until then:

- **USB-A Solo 2 with NFC** — the near-field gate. After the §8.3 correction, ~4 cm
  NFC coupling is the only genuine proximity primitive in the kit. It is
  **anti-casual, hardware-relay-able, and must never be described as distance
  bounding.**
- **USB-C Solo 2** — the always-attached authenticator.
- **Trezor Safe 7** — **the screen.** The one surface no host software can repaint,
  so consent and time-disclosure belong there. A witness, not a factor.
- **Phone** — the camera, and on-device fusion emitting one signature.

**Open and unverified:** FIDO2 uses **batch attestation by design**, specifically so
a relying party cannot distinguish individual keys — a privacy property that cuts
against per-device uniqueness. If it holds for Solo 2, the right primitive is likely
the `hmac-secret` extension: a stable per-credential secret with no gallery anywhere,
which fits L1's shape exactly. Being verified; do not build on it yet.

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

**OPEN ENGINEERING GAP — fuzzy extraction.** `BIO-1` §0 speaks of a
"biometric-generated public key" and assumes it is deterministic. **Biometrics are
not.** The same face does not produce the same bits twice, so a stable key requires a
**fuzzy extractor / secure sketch** — a well-studied primitive that costs entropy and
requires helper data stored on-device. Nothing in the law book names it, and nothing
in the tree implements it. This is an engineering gap in L1, not a policy question,
and L1 is what the whole nullifier construction rests on. **It should be scoped before
anyone builds the event ceremony.**

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
