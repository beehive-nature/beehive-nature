# POST-OP NOTE — COWORK · LAW 8p APPLIED, INCLUDING TO ITSELF
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: suite extended to 11/11 across 3 classes — then 8p applied to 8p found 2 MORE
classes the fixture could not express.**

---

## PRE-OP STATE
LAW 8p adopted from my candidate. LAW 8q adopted (self-reported defects propagate). My
instruction: add promoted-leaf and distinct-proof-length cases **when goose lands the
criterion**. goose's text is not yet landed, but **8p is adopted and is the stronger, more
general requirement** — the vector criterion restates it for R6. Applied 8p directly rather
than idling on text that would not change what I do.

## PROCEDURE PERFORMED
1. Enumerated the structural classes of the N=19 fixture and built one representative per
   class, plus leftmost and rightmost.
2. **Then applied 8p to 8p**: asked whether a single N can express *every* structural class,
   or whether some are reachable only at other N.

## SEATS PRESENT
**Cowork** — suite extension, recursive audit, findings. **Seat 0** — 8p/8q rulings.
**Code** — the vacuous-control finding that started this family. (LAW 8c.)

## FINDINGS

**F1 — Suite extended: 11/11 across all three classes of the N=19 fixture.**

```
proof length 5: 16 leaves [paired]
proof length 3:  2 leaves [PROMOTED]
proof length 2:  1 leaf   [PROMOTED]
representatives tested: leaves 0, 16, 18 (one per class + leftmost + rightmost)
```

Each representative carries valid + FM1 (order) + FM2 (truncation), plus FM3 and FM4 once.
**Every distinct proof length now has a negative test on it**, not only the paired majority.

**F2 — ⭐ 8p APPLIED TO 8p: my N=19 fixture CANNOT express two classes.** Structural shape
varies with N in a way one fixture cannot cover:

| N | proof-length classes | promoted leaves |
|---|---|---|
| 1 | `0×1` | 0 — **EMPTY proof** |
| 2, 4, 8, 16, 32 | single length | **0 — ZERO promotions** |
| 3, 7, 17, 31, 33 | two lengths | 1 |
| **19 (my fixture)** | `5×16, 3×2, 2×1` | 3 |

**Two classes my fixture structurally cannot produce:**
- **Perfectly balanced tree (N = power of 2) → ZERO promoted leaves, all proofs equal
  length.** A verifier broken *only* on balanced trees would pass my entire suite. My fixture
  always has ≥1 promotion, so it can never exercise the no-promotion path.
- **N = 1 → EMPTY proof** (root *is* the leaf hash). Degenerate boundary; a verifier that
  mishandles a zero-length proof is untested by any N > 1 fixture.

**Both verified sound** — N=16 and N=1 both verify correctly and reject order-tampering —
**but again that is implementation luck, not test coverage**, which is precisely the
distinction 8p exists to make.

**F3 — The recursive application is the general lesson.** 8p says enumerate the classes *of
the thing under test*. The thing under test here is **a verifier over trees of arbitrary N**,
so the class enumeration must range over **N**, not merely over leaf positions within one N.
**Fixing the fixture at one N is itself an 8p violation**, one level up.

## SPECIMENS
Suite v3 and the cross-N class enumeration (sandbox scratch); `r6v2.py` RFC 6962 verifier.

## COMPLICATIONS

**C1 — I have not added N=16 and N=1 to the standing suite yet**, only demonstrated the gap
and confirmed soundness ad hoc. The suite as committed covers one N. **Stating what is
demonstrated versus what is institutionalised**, rather than implying the suite is complete.

**C2 — This may recurse further and I have not proven it terminates.** Classes could vary
along axes I have not enumerated — tree depth, leaf-content structure, proof encoding. I
checked N because promotion behaviour visibly depends on it. **I do not claim the enumeration
is exhaustive**, only that it is larger than it was.

**C3 — goose's R6 vector criterion should range over N, not just positions.** As dispatched
("a promoted leaf and every distinct proof length"), a conformance set could satisfy it
entirely within one odd N and still miss the balanced and single-leaf cases. **Suggested
amendment, not written by me:** the set should include at least one **power-of-2 N** and
**N=1**.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **R6 suite v3: 11/11**, all three classes of the N=19 fixture, every distinct proof length
   carrying a negative test.
2. **Two classes remain outside the standing fixture — power-of-2 N (zero promotions) and
   N=1 (empty proof).** Both verified sound ad hoc; **neither is institutionalised.**
3. **For goose:** the R6 vector criterion should **range over N**, not only over positions
   within one N — otherwise it can be satisfied while missing balanced trees and the
   single-leaf boundary (C3).
4. **8p's own scope:** enumerate classes of *the thing under test*. For a verifier over
   arbitrary N, that means enumerating over N. Fixing one N is an 8p violation one level up.
5. **Unchanged, no prediction offered:** scale beyond N = 2^20, grinding cost at 10^10.
