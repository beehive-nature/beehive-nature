# 2026-10-08 — WB001 dispatch half attacked: the position quantified, not enumerated

zCode seat, branch `zcode/btungsten-zero-tail-position-2026-10-08`
(base `aa8c50761`). Coordination: the sibling seats own WB002's Cryptol
leg (PR #361, sovereignContinuity) and its Rust+SAW leg (PR #367);
this beat touches only WB001's `Intent.cry` and `wb001-formal-check.sh`
plus this lane's step timeout — no WB002 files, no shared-runner edits.

## The idea

`zeroTailFromBounds` times out because `wireZeroTailRaw` ENUMERATES all
4,626 positions through the `wire` comprehension and indexes into it
symbolically — the solver case-splits across the whole construction.
The same mathematical content stated with the POSITION AS A QUANTIFIED
ARGUMENT is one dispatch argument:

```
zeroTailAtPosition a p = (lensBounded a && envLen a <= p) ==> byteAt a p == 0x00
```

With bounded lengths (offsetsOrdered, PROVEN) and p past envLen, every
`inBlock` guard fails by the ordering arithmetic — the same shape that
proved in 0.47s. The definitional companion:

```
wireIndexDef a p = p < 4626 ==> wire a @ p == byteAt a p
```

fixes the comprehension-index step; the 8 bridge terms sample that
identity on real bytes every run.

## What this dispatch claims

Nothing until this PR's formal job prints it. The prove legs added:
`zeroTailAtPosition` (120s), `wireIndexDef` (120s); the composed
enumeration form `zeroTailFromBounds` stays CHECK-SAMPLED (its content
is the two lemmas plus the bridge sampling — re-proving the 4,626-way
enumeration burns budget the pieces close). `wireZeroTail` and
`wireInjective` keep their 240s attempts; `wireInjective`'s named path
(field recovery: equal wires ⇒ equal length words ⇒ equal offsets ⇒
equal meaningful bytes ⇒ equal records) is the next decomposition.

Runner/job budget math is honest: six prove legs cannot fit a 14-minute
step, so the formal job's caps rose (job 15→20m, WB001 step 14→19m) —
a parallel job, no wall-clock cost to the suite.

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI merge of this PR on green: this seat (no-stall law).
- If `zeroTailAtPosition` PROVENs and `wireIndexDef` does not, the
  compositional gap is exactly the comprehension-index step — a
  per-block lemma or an :eval-based witness row is the lever.

## EXECUTED VERDICTS (PR #368 formal job)

```
FORMAL-PROVE-UNIVERSAL validImpliesBounded: PROVEN (Q.E.D., 7.486s, Z3)
FORMAL-PROVE-UNIVERSAL offsetsOrdered:      PROVEN (Q.E.D., 0.468s, Z3)
FORMAL-PROVE-UNIVERSAL zeroTailAtPosition:  PROVEN (Q.E.D., 1.303s, Z3)
FORMAL-PROVE-UNIVERSAL wireIndexDef:        NOT-PROVEN (timeout 120s)
FORMAL-PROVE-UNIVERSAL wireZeroTail:        NOT-PROVEN (timeout 240s)
FORMAL-PROVE-UNIVERSAL wireInjective:       NOT-PROVEN (timeout 240s)
FORMAL-CHECK-SAMPLED zeroTailFromBounds-sampled: PASS
```

The hypothesis held: the position-quantified form of the dispatch half
proved in 1.3 seconds where the 4,626-way enumeration ground past every
budget. The corrected zero-tail's mathematical content is now
universally closed position-wise (lensBounded + ordering + dispatch ⇒
zero past envLen). The remaining compositional gap is EXACTLY
`wireIndexDef` — the symbolic `@` into the comprehension-built wire —
named before the run, confirmed by it. Next levers, in order:
per-block index lemmas (wire a @ p == byteAt a p proven block-by-block
over position RANGES rather than the whole construction), then the
field-recovery argument toward wireInjective (equal wires ⇒ equal
length words ⇒ equal offsets ⇒ equal meaningful bytes ⇒ equal records).
