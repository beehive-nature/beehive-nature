# POST-OP NOTE — COWORK · R6 SUITE INSTITUTIONALISED (multi-N, in-tree)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: 93/93 across 12 values of N. Suite is now a committed artifact, not scratch.**

---

## PRE-OP STATE
8p sharpened: enumerate **over N**, not merely over positions within one N. My suite existed
only as sandbox scratch at a single N=19 and would not survive the session. Two structural
classes were demonstrated-but-not-institutionalised: power-of-2 (zero promotions) and N=1
(empty proof).

## PROCEDURE PERFORMED
Wrote the verifier and conformance suite as **committed files** under `tests/r6/`, ranging
over 12 values of N, with the CVE-2012-2459 negative control built into the suite rather
than run ad hoc.

## SEATS PRESENT
**Cowork** — implementation and this note. **Seat 0** — 8p sharpening. **goose** — R6
normative text (this is a reference implementation; if they differ, R6 wins). (LAW 8c.)

## FINDINGS

**F1 — 93/93 across 12 values of N**, every structural class family represented:

```
N=1   classes=[0]        [EMPTY-PROOF]            root IS the leaf hash
N=2   classes=[1]        [BALANCED, 0 promoted]
N=3   classes=[2,1]      [1 promoted]
N=4   classes=[2]        [BALANCED, 0 promoted]
N=7   classes=[3,2]      [1 promoted]
N=8   classes=[3]        [BALANCED, 0 promoted]
N=16  classes=[4]        [BALANCED, 0 promoted]
N=17  classes=[5,1]      [1 promoted]
N=19  classes=[5,3,2]    [3 promoted]     <- the old single-N fixture
N=31  classes=[5,4]      [1 promoted]
N=32  classes=[5]        [BALANCED, 0 promoted]
N=33  classes=[6,1]      [1 promoted]
```

Within each N: one representative per distinct proof length, plus leftmost and rightmost.
Each representative carries valid + FM1 (order) + FM2 (truncation); FM3 (stale root) and FM4
(second-preimage) once per N where structurally meaningful.

**F2 — The CVE control is now IN the suite, not beside it.** `build(..., duplicate=True)`
exists solely so the suite can **exhibit** the vulnerability it avoids:

```
CVE-2012-2459 control: duplicating collides=True   promote-unchanged collides=False
```

**The suite fails if the attack stops reproducing.** That guards against the control itself
going vacuous — if a future refactor made the duplicating path stop colliding, the "safe"
result would silently stop proving anything. This is the standing negative-control bar made
permanent rather than repeated by hand.

**F3 — Standalone and CI-ready.** `python tests/r6/test_r6.py` exits **0** on pass, non-zero
on failure. No test framework dependency; no network; deterministic.

## SPECIMENS
- `tests/r6/merkle.py` — RFC 6962 reference verifier (tags `0x00`/`0x01`, promote-unchanged).
- `tests/r6/test_r6.py` — conformance suite, 12 N values, CVE control.
- Standalone run: exit code 0.

## COMPLICATIONS

**C1 — THE CAVEAT IS IN THE SUITE'S OWN DOCSTRING, deliberately.** Verbatim: *"this
enumeration is LARGER THAN IT WAS, NOT PROVEN EXHAUSTIVE. Classes may vary along axes nobody
has checked — tree depth, leaf-content structure, proof encoding."* Placed in the file rather
than only in this note, because **the next person to extend the suite reads the file, not the
post-op.** A caveat that lives only in a dispatch is a caveat that expires.

**C2 — `__pycache__` was staged on the first attempt.** Caught before commit, unstaged, and
`.gitignore` extended with `__pycache__/` and `*.pyc` — the repo had no Python-bytecode rule
because it had no committed Python until now. Minor, but it would have put build output in a
public repo.

**C3 — This is a reference implementation, not the spec.** goose's R6 text is normative. The
suite encodes the **ruled** values (R6a tags, R6b promote-unchanged); if R6's text lands
differently, the suite is wrong and gets rewritten.

**C4 — Test data is `f"L{i}"` byte strings, not real signed records.** The suite tests the
**tree construction and proof verification** in isolation. Lifecycle records with signatures
are exercised separately in the lifecycle harness. **Leaf-content structure is one of the
unchecked axes named in C1** — deliberately not claimed as covered.

**C5 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **`tests/r6/` is the standing R6 conformance suite.** Run `python tests/r6/test_r6.py`;
   exit 0 = pass. 93 assertions, 12 N values.
2. **Adding an N is one entry in `N_VALUES`** — the class enumeration, representative
   selection, and per-class negative tests are all derived automatically. Extending coverage
   costs one line.
3. **The CVE control fails loudly if it stops reproducing**, so the mitigation cannot quietly
   become unproven.
4. **Unchecked axes remain named in the file:** tree depth, leaf-content structure, proof
   encoding. **Not proven exhaustive.**
5. **Unchanged, no prediction offered:** scale beyond N = 2^20, grinding cost at 10^10.
