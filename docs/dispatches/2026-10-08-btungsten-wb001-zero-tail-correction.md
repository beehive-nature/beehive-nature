# 2026-10-08 — WB001 zero-tail theorem correction: the original was false, refuted in hosted execution; proof decomposed; runner classifications tightened

zCode seat, branch `zcode/btungsten-zero-tail-2026-10-08` (base
`8b2ac34ae`). Founder review (2026-10-08) of the merged source found
the defect: `wireZeroTail` was documented as applying to valid intents
but its definition omitted the `validIntent` condition — it quantified
over invalid lengths too. A Node transcription of the offset arithmetic
produced the counterexample shape: oversized payload length
(`0xfffffff0`), wrapped envelope length 134, payer tag `0x09` alive at
position 139 — beyond the claimed end. The review's own words carried
the lesson: **a timeout must not automatically be interpreted as a
difficult true theorem.** The 240s NOT-PROVEN was hiding a FALSE
theorem.

## 1. The counterexample, reproduced in hosted CI (executed, not transcribed)

`Intent.cry` now carries the witness as a first-class fixture and the
ORIGINAL theorem under its own name:

- `wireZeroTailRaw` — the original unconditioned definition, preserved
  verbatim as the record of what was actually claimed.
- `xWrapPayload` — payload `len = 0xfffffff0` on the base intent
  (rejected by `validIntent`: length beyond capacity; added to the
  `adversarialRejected` list).
- `zeroTailWrapRefuted` — the executed refutation, CI-gated:
  `(validIntent xWrapPayload == False) && (wireZeroTailRaw xWrapPayload
  == False)`. Every run EVALUATES the original theorem on the witness
  and asserts False; if a refactor ever makes the raw form true there,
  the premise structure changed and this row goes red.

The corrected theorem states its domain explicitly and does not
silently weaken anything — the all-input guarantee was never true to
weaken:

```
wireZeroTail a = (validIntent a) ==> (wireZeroTailRaw a)
```

## 2. The proof, decomposed (founder ruling, in order)

- `lensBounded` — the bounds premise isolated from the heavy DFA so
  arithmetic lemmas do not carry it.
- `validImpliesBounded` — `validIntent a ==> lensBounded a` (structural).
- `offsetsOrdered` — with bounded lengths the block offsets are ordered
  and never wrap [32]: every block starts at or after the previous
  block's end, and `envLen <= 4626` (no overflow).
- `envLenMatchesOffsets` — envelope-end agreement (existing, kept).
- `zeroTailFromBounds` — `lensBounded a ==> wireZeroTailRaw a`: with
  ordering, no position at or past envLen can be claimed by any block,
  so the dispatch answers zero.
- `wireZeroTail` — the corrected theorem.
- `wireInjective` — unchanged premises; the field-recovery /
  decoder-round-trip argument is the named path to it (next beat; not
  claimed today).

Runner prove legs, per-obligation budgets: `validImpliesBounded` 45s,
`offsetsOrdered` 90s, `zeroTailFromBounds` 180s, `wireZeroTail` 240s,
`wireInjective` 240s. Verdict lines in this PR's formal job run are the
receipts — this dispatch claims nothing beyond them.

## 3. Categories kept separate

- Historical: injectivity of the CAPACITY-PADDED representation (two
  Q.E.D. receipts, scoped) — history, not current claim.
- Current: compact-wire `wireInjective` — NOT-PROVEN until its own
  proof succeeds.
- The 8 executed bridge terms — agreement for those terms, sampled;
  never universal runtime equivalence.
- Encoding guarantees ≠ signature-scheme assumptions: Ed25519 remains
  an assumed primitive; PQ work stays its own lane. Nothing here says
  anything about any replacement cryptographic implementation.

## 4. Runner classifications tightened

- A clean process exit with NO recognized solver verdict line is now an
  **UNKNOWN-VERDICT diagnostic failure (red)** — the old code silently
  greened it as "NOT-PROVEN (ran to completion, no verdict line)".
- rc=137 → KILLED (SIGKILL — resource death is a fact, cause not
  guessed).
- rc=143/other signals → TERMINATED rc=N — termination by signal is the
  recorded FACT; what sent the signal is UNEVIDENCED and unclaimed
  (the prior wording said "the runner was shut down"; that claimed a
  cause this seat never had evidence for — reworded in the runner and
  the README).
- rc=124 → NOT-PROVEN, green, unchanged (an open obligation is a
  recorded state, never a wedge).

## Boundaries not crossed

JS suites untouched semantically (18/18 local: genesis + boundary +
bridge). The sibling's model structure (bDom..bPld blocks, inBlock,
blockByte) is the base; only the zero-tail region and new fixtures
were edited. No new solver-run claims beyond what the PR's own formal
job prints.

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI merge of this PR on green: this seat (no-stall law).
- The decoder round-trip / field-recovery lemma ladder toward
  `wireInjective` — the next named beat, riding the same decomposition.

## EXECUTED VERDICTS (PR #365 formal job, run 37713300078, job 113103957284-era log lines)

```
FORMAL-CHECK-SAMPLED zeroTailWrapRefuted: PASS        <- the original theorem, refuted on the witness, every run
FORMAL-PROVE-UNIVERSAL validImpliesBounded: PROVEN (universal, Q.E.D., 7.419s, Z3)
FORMAL-PROVE-UNIVERSAL offsetsOrdered:      PROVEN (universal, Q.E.D.,  0.470s, Z3)
FORMAL-PROVE-UNIVERSAL zeroTailFromBounds:  NOT-PROVEN (timeout 180s)
FORMAL-PROVE-UNIVERSAL wireZeroTail:        NOT-PROVEN (timeout 240s)
FORMAL-PROVE-UNIVERSAL wireInjective:       NOT-PROVEN (timeout 240s)
```

Reading: the two STRUCTURAL lemmas (validity implies bounds; bounded
lenses give ordered, non-overlapping, non-wrapping blocks with
envLen <= 4626) are now PROVEN universally — the ordering half of the
decomposition is closed, in under a second for the ordering lemma
itself once the DFA was isolated from the arithmetic. The DISPATCH half
(zeroTailFromBounds: every position past envLen answers zero) is the
open hard case — 4,626 positions × the byteAt case tree — and the
corrected wireZeroTail and wireInjective remain NOT-PROVEN behind it.
The next lever is making zeroTailFromBounds tractable (per-block
lemmas or a position-partitioned argument), then field recovery.
