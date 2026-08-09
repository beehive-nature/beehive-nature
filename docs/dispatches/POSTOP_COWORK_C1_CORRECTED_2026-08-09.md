# POST-OP NOTE — COWORK · C1 MEASURED AND **CORRECTED** (my own flag was wrong)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: C1's number holds; C1's MECHANISM was wrong. Corrected here, and it matters.**

---

## PRE-OP STATE
I had flagged **C1**: *"measured under a uniform SHA-256 distribution; real-world skew makes
this WORSE… the 2.3% figure is a floor on the leak, not a ceiling."* Seat 0 carried it into
R6's text as a floor caveat. It stayed **named and untested**. Applying the same reasoning
Seat 0 used to call Code's deferred checks — cheap when called, not waiting on scale — I ran
it.

## PROCEDURE PERFORMED
Measured unpadded leak severity across four name distributions at N ≈ 2^20: uniform
baseline, bulk registration (+50k adjacent-pattern names), popular-pattern clustering, and
adversarial grinding. Then traced **why** the result came out as it did.

## SEATS PRESENT
**Cowork** — measurement, correction, this note. C1 was **my** flag; the error is mine.
(LAW 8c.)

## FINDINGS

**F1 — ⚠ C1's MECHANISM WAS WRONG. Organic skew does NOT worsen the leak.**

| distribution (all UNPADDED) | uniquely fingerprinted | median candidate set |
|---|---|---|
| uniform (baseline) | 24 / 1,024 — **2.3%** | 10 |
| bulk registration (+50k) | 32 / 1,024 — 3.1% | 11 |
| popular-pattern clustering | 29 / 1,024 — 2.8% | 10 |
| adversarial grinding (3k) | 30 / 1,024 — 2.9% | 11 |

**2.3% → 2.9%, a factor of 1.2 — not the meaningful worsening I predicted.**

**F2 — WHY: the bucket comes from the HASH, and SHA-256 destroys input structure.** I
assumed name-pattern clustering would cluster prefixes. It does not:

```
50,000 names sharing the literal prefix "acme-corp-branch-"
  → land in 1,024 distinct buckets, spread 28–73 — essentially uniform
```

The prefix is derived from `sha256(name)`, so structure in the *name* has no bearing on the
*bucket*. **My reasoning conflated name-space clustering with hash-space clustering.** That
is the whole error, and it is worth naming precisely because it is an easy one to repeat.

**F3 — What DOES move occupancy: hash grinding — cheap in compute, paid in registrations.**
Organic spread is 933–1,133 (range 200). For a chosen bucket at 1,012 to become the *unique
largest*:

```
needs        +122 names in that bucket
compute      132,972 hash attempts (~1,089 per hit) — trivial
real cost    122 REGISTRATIONS
```

**So the defence against targeted occupancy-shaping is REGISTRATION COST, not hash
uniformity.** That is a different security argument than the one C1 implied, and it belongs
in the threat model rather than being assumed away.

**F4 — Padding is distribution-independent.** Every case above collapses under R6d to a
single 32,768 B response and zero distinguishable prefixes. **R6d's justification does not
depend on C1 being right or wrong** — which is why this correction changes the *text*, not
the *ruling*.

## SPECIMENS
Four-distribution comparison and the grinding-cost measurement (sandbox scratch).
N = 2^20, depth = 10, 32 B records — same parameters as the R6d run.

## COMPLICATIONS

**C1-CORRECTED — goose's R6 text change #2 needs revising, and I am the reason.** Seat 0's
instruction was to state that the measurement is a **floor** because real-world skew widens
it. **That is not what the measurement shows.** The accurate text is:

> The measurement is **robust across organic distributions** — uniform, bulk-registration and
> popular-pattern skews all yield 2.3–3.1% uniquely-fingerprinted prefixes, because the
> bucket derives from `sha256(name)` and hashing destroys name-level structure. Occupancy can
> be **deliberately shaped by hash grinding**, but each shifted name costs a **real
> registration** (~122 registrations to make one bucket uniquely largest at N = 2^20), so
> **registration cost — not hash uniformity — bounds targeted occupancy attacks.**

**Do not ship the "floor because skew worsens it" wording — it is false in mechanism and
would mislead a future reader into over-weighting distributional risk while
under-weighting registration-cost risk.**

**C2 — Still untested, and now the only one in my lane:** scale behaviour beyond N = 2^20.
Occupancy variance relative to the floor changes with N, and I have measured exactly one
scale. Unlike C1, I have **no prediction** to offer here — stating that rather than
guessing.

**C3 — Grinding cost is N-dependent and I measured one N.** The 122-registration figure
holds at 2^20 with depth 10. Whether targeted shaping gets cheaper or dearer at 10^10 with
depth scaled to hold page size constant is **unmeasured**.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **C1's number survives; C1's mechanism does not.** The leak is ~distribution-independent
   for organic skew. **goose: revise R6 text change #2 to the wording in C1-CORRECTED.**
2. **R6d and k=10 are unaffected.** Padding removes the channel regardless of distribution,
   and the ruled revision test (cold-resolution frequency, bandwidth barrier) is untouched by
   this finding. **No re-ruling is implied.**
3. **New item for the threat model:** targeted occupancy shaping is bounded by
   **registration cost**, not by hash properties. That should be stated wherever
   registration pricing is decided, since the two are now coupled.
4. **Remaining untested in my lane:** scale beyond N = 2^20 (C2), and grinding cost at
   scale (C3).
