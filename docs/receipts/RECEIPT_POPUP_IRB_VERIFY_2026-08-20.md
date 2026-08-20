# RECEIPT — SPEC-POPUP-IRB-1 verification: the moat argument is right, and one gate is missing

**Seat 3 (Opus 5), 2026-08-20.** Verification on landing, per house law. Against
`docs/specs/SPEC-POPUP-IRB-1.md` (zAgent, `611c5ca`).

**Verdict: the constitutional argument holds and is genuinely strong. Two gaps found, one
of which an IRB will raise in its first five minutes.**

---

## 1 · WHAT HOLDS, stated first because it is the load-bearing part

zAgent's central move is correct and worth restating: **BIO-1's and PERSON-1's bans are not
a constraint on this lane, they are its product.** An organisation that constitutionally
cannot identify a person by their body — no templates, no 1:N comparison "at any gallery
size, for any purpose, ever," no registry — is the only kind a stranger hands a biosample
to at a festival. Research telemetry under per-study consent is not an identity template;
there is no matcher and no gallery to match against.

**No false collision raised here.** This seat has previously cost the founder arguments by
asserting a BIO-1/PERSON-1 conflict where none existed. There is none here either: the lane
collects research data bound to a persona nullifier, never to the bzDiD root, which is what
the ruled text permits.

The PI-1 flag — the founder wrote both *"only aggregates leave"* and *"monetize… RAW"* —
is a real collision, correctly **flagged and not resolved**. That is the law working.

The telomere handling is right on both halves: universal eukaryotic physiology, so the
endpoints never localise and only the consent does; paired with the field's own admission
that qPCR telomere measurement's *"reproducibility, reliability and rigor need to be
established."* Pairing rare CV-labelled telomere panels with dense telemetry that a
festival actually moves is the honest design, and it is the differentiator against
single-drop telomere-score sellers.

---

## 2 · THE MISSING GATE — capacity to consent

**Measured:** the spec contains **zero** occurrences of *intoxicated, impaired, capacity,
sober, influence, alcohol,* or any cognate.

```
$ grep -ciE "intoxicat|impair|capacity|sober|influence|alcohol|inebriat" docs/specs/SPEC-POPUP-IRB-1.md
0
```

**This is a specification for obtaining informed consent to collect biological samples at
music festivals** — EDC and Tomorrowland are named — **which is the single setting where
capacity to consent is most predictably compromised.** Not occasionally. Predictably, by
the nature of the venue, at scale, at night.

**This is not a legal technicality. It is the ethical core of the thing.** Consent obtained
from a person who is impaired is not informed consent; it is a signature. Every one of the
spec's other protections — persona binding, hash-pinning, individually affirmed
disclosures, the language attestation rule — assumes a person capable of understanding what
they are affirming. If that assumption fails, the protections are decoration.

**And the fix strengthens the moat rather than complicating it.** The spec already contains
exactly the right pattern in a different domain: an unattested language renders the station
**honest-absence** — *"we cannot consent you in your language today."* The same sentence in
the same grammar closes this gap:

> **"We cannot consent you right now. Come back tomorrow — the study will still be here."**

An organisation that turns away a willing participant because they are not in a state to
consent is demonstrating the exact property that makes a stranger trust it with a
biosample. **Refusing a consent the person cannot truly give is the trust product**, in
precisely the way zAgent already argued for language. It is the same move, and it is
arguably a better proof of the claim, because language capacity is invisible and
intoxication is the thing everyone at a festival already knows is in the room.

**Proposed gate PI-6, flagged not resolved** — the wording is the founder's and counsel's,
not this seat's:

- a capacity screen before any consent is taken, and a documented refusal path
- **re-consent at collection**, separated in time from enrolment, so consent and biosample
  are not a single impulsive moment
- **a cooling-off withdrawal window** with the sample destroyed on request, since the spec
  already treats withdrawal as first-class
- staff authority to refuse, with refusal recorded as a normal outcome rather than a failure

---

## 3 · THE SECOND GAP — "festival" is not one jurisdiction

The spec names **EDC and Tomorrowland** as the class. Those sit in two entirely different
legal regimes:

- **Tomorrowland is in Belgium.** Under GDPR, biometric and health data are **Article 9
  special-category data**, with their own lawful-basis, explicit-consent, DPIA and
  cross-border-transfer requirements. Shipping biosamples or telemetry out of the EU to a
  US lab is a transfer question before it is a science question.
- **EDC is in Nevada.** US human-subjects research runs on the Common Rule, with state
  genetic-privacy statutes layered on top and varying sharply by state.

PI-5 currently reads *"counsel pass on human-subjects research regs across festival
jurisdictions,"* which is correct in intent but treats jurisdiction as one line item.
**The recommendation is to make jurisdiction a per-deployment gate rather than a
one-time pass** — each festival is its own legal instrument, and the EU/US split is the
first fork, not a detail. A spec that scales to festivals scales across borders by
definition.

**No legal advice is given or implied here.** This receipt names two questions for counsel;
it does not answer them. The spec's `DRAFT-FOR-COUNSEL` status and the CONSENT-1 tradition
are the right posture and are unchanged by this note.

---

## 4 · WHAT THIS SEAT DID NOT DO

Did not edit the spec. It is another seat's artefact with open founder gates, and the house
law is to flag rather than resolve. The wording above is a proposal, not a patch.

**Owed to the same lane, when the consent-station surface is built:** this seat will run the
same adversarial pass it ran on the bIQ composer — attempt to obtain a consent that should
have been refused. On bIQ that pass found four of six promotional sentences passing a gate
that called them clean. A consent station deserves the harder version of that test, and it
should be run by someone who did not build it.

**Seat 3 (Opus 5), 2026-08-20.** The moat argument is the best thing in the spec; the gate
it is missing is the one that proves it. 🐝
