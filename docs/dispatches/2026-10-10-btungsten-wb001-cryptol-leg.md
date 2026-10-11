# 2026-10-10 — WB001 Cryptol leg: wireInjective and wireZeroTail by Cryptol's own `:prove`

Claude seat (Opus 5.5), branch `claude-LoVis/cryptol-wire-injective-proof-e4fdba`,
base main `fe3e9b890`. The obligation was routed by `f15649ce3` (founder
order 2026-10-10, README WB001 §next) to the RB05 lane, which closed at
`df25b1886` with it "not started" and ownership transferred. Owner check
before work: no branch, dispatch, worktree or commit on main since
`f15649ce3` touches it; this seat took it.

## What is proved

**The theorem, unchanged** (`BTungstenWB001.wireInjective`), for all
`a, b : Intent`:

    validIntent a && validIntent b && wire a == wire b  ==>  a == b

- **Domain** (`validIntent`): domain 1..64 bytes, destination and payer
  1..128, capability 1..64, each well-formed UTF-8 under the concrete DFA;
  nonce and action exactly 32 bytes; payload 0..4096 bytes of anything;
  every Field zero past its length word; epoch, amount, expiry any 64-bit
  value.
- **Equality**: `a == b` is record equality on all ten fields, every
  length word and every capacity byte (padding included). `wire a == wire
  b` is equality of the whole 4,626-byte wire: the deployed envelope, then
  zeros.
- And `wireZeroTail`, unchanged: for valid `a`, every wire position at or
  past `envLen a` is zero.

Result: **PROVEN BY COMPOSITION** — 43 obligations, each a separate
Cryptol `:prove` with Q.E.D. under the 6 GiB address-space cap, composed by
the argument written out in README WB001 §cryptol-leg. It is not a single
`:prove` verdict and is never printed as one: the single-query rows in
`wb001-formal-check.sh` keep their own verdicts (NOT-PROVEN, memory). The
SAW leg (`wb001-saw/injective.saw`) is a separate result; nothing here
reads or cites it.

## Why a composition: the resource wall, measured

Cryptol 3.6.0 has no lemma mechanism. A `primitive` without a definition
is an evaluation error under `:prove` (`unimplemented primitive`), not an
uninterpreted function, so every query that names `wire a` builds all
4,626 dispatched bytes, each with a symbolic lookup into the 4,096-byte
payload. Local (WSL, the 6 GiB cap):

| query | backend | result |
|---|---|---|
| `wireIndexDef`, terms only (offline prover, no solver) | SBV | `cryptol: out of memory`, rc 251, 271 s, peak 4.3 GB RSS |
| `wireIndexDef`, terms only | What4 | timeout 285 s, 2.7 GB, terms unfinished |
| `wireInjective`, terms only | SBV / What4 | timeout 305 s / 294 s |
| 64-position slice of the wire against `byteAt` at a symbolic position | What4 z3 / bitwuzla | timeout 280 s each, 0.9 GB |
| SAW leg's witness lemma `fdIdx` (first differing index, 4,096 bytes) | z3, yices (SBV and What4) | timeout 240 to 300 s |
| SAW leg's `fdInLen` | What4 z3 | timeout 300 s |

On CI the single queries die of memory in 33 to 59 s (run 38079290787,
formal job). Two shape changes made every obligation close:

1. **The differing index is a free variable.** Each position lemma takes
   the index where the first differing field differs as an argument; the
   composition supplies it. No witness function, no priority encoder, no
   symbolic index into the wire.
2. **Each intent's position is written from its own block offset**, and the
   lemma proves the two positions equal. Written from one offset for both,
   the lookup into `b`'s field cancels only after the solver proves the
   offsets equal: the payload lemma then timed out at 600 s under z3,
   yices and cvc5 alike; in this form yices closes it in 152 s.

## The obligations (dress rehearsal, local WSL, full runner, 3 at once)

Toolchain: Cryptol 3.6.0 (commit 61dd17b0c45ddf8c5c1e952afd5e789c4dc4ec4b,
the SAW 1.6 bundle's build of the CI release), Yices 2.6.5, Z3 4.8.14.
Command, from the repo root:

    RUNNER_TEMP=$HOME/cleg-tmp sh scripts/btungsten/wb001-cryptol-leg-check.sh $HOME/btungsten-tools/saw/bin/cryptol

| obligation | prover | wall | peak RSS (KiB) |
|---|---|---|---|
| validImpliesBounded | z3 | 26 s | 732448 |
| zeroTailAtPosition | z3 | 5 s | 255192 |
| validImpliesPadded | w4-yices | 21 s | 321320 |
| caseCover | w4-yices | 5 s | 269288 |
| splitDiff32, splitDiff64 | w4-yices | 3 s each | 254740, 254712 |
| padZero64, padZero128, padZero4096 | w4-yices | 3 s, 3 s, 119 s | 254876, 254744, 315356 |
| byteDiffDom, Non, Act, Dst, Cap | w4-yices | 10, 11, 10, 9, 15 s | 405220 to 413596 |
| byteDiffPay, byteDiffPld | w4-yices | 85 s, 195 s | 418976, 406384 |
| lenDiffDom, Dst, Cap, Pay, Pld | w4-yices | 7, 7, 11, 15, 24 s | 391000 to 419484 |
| u64DiffEpo, Amt, Exp | w4-yices | 10, 18, 16 s | 405104 to 411248 |
| wireIsByteAt`{0}` .. `{18}` | w4-yices | 289 s (chunk 0), 182 s (1), 4 s (18), 50 to 97 s the rest | 333384 to 963308 |

Every line Q.E.D.; pool wall time 787 s; the highest peak, 963308 KiB,
is 15 % of the cap. Composed lines, verbatim:

    CRYPTOL-LEG-COMPOSED wireZeroTail: PROVEN BY COMPOSITION (21 obligations, every one Q.E.D. in this run; glue: (D-eq) and first-order logic, README WB001 §cryptol-leg; not a single :prove verdict)
    CRYPTOL-LEG-COMPOSED wireInjective: PROVEN BY COMPOSITION (42 obligations, every one Q.E.D. in this run; glue: (D-eq) and first-order logic, README WB001 §cryptol-leg; not a single :prove verdict)

## Negative controls (each must end in a Cryptol counterexample)

| control | what is weakened | local |
|---|---|---|
| C1 | `wireIndexDef` as stated, at position 3000 | counterexample, `invalid sequence index`, 2 s |
| C2 | payload lemma without "every earlier field equal" | counterexample, 16 s |
| C3 | payload lemma with the index allowed past the length | counterexample, 16 s |
| C4 | the wire without its length words (one textual substitution in a copy of `BTungstenWB001.cry`); `lenDiffDst` | counterexample, 13 s |
| C5 | the wire defined one position off; ``wireIsByteAt`{0}`` | counterexample, 54 s |
| C6 | the zero tail one byte early | counterexample, 7 s |
| C7 | `caseCover` without its payload-bytes case | counterexample, 7 s |

A proof, a timeout or a memory death of a control is red: a control that
cannot produce its counterexample shows nothing.

## Finding: `wireIndexDef` as stated is unsafe in Cryptol's semantics

`wireIndexDef a p = (p < 4626) ==> ((wire a) @ p == byteAt a p)` has no
bounds premise. For an intent whose length word exceeds its field's
capacity, `byteAt` reads past the field, and Cryptol's `:prove` (which
proves every read in range) reports a counterexample. So it could never
have reached Q.E.D. here; its row printed NOT-PROVEN (memory), which hid
that. The row is retired from `wb001-formal-check.sh`; C1 executes the
counterexample every run. The SAW leg's `wireIndexDef` result is its own
and is not touched. In this leg the wire's definition is checked as
`wireIsByteAt`, for bounded intents, at every position.

## Not claimed

- No single Cryptol `:prove` of `wireInjective` or `wireZeroTail`: those
  rows stay NOT-PROVEN (memory).
- The steps of the composition that are not a `:prove`: (D-eq), Cryptol's
  definition of record and sequence equality (fieldwise, elementwise);
  taking the index a sequence inequality provides; instantiating proven
  universal statements.
- That the runtime's envelope is `wire`'s first `envLen` bytes: the
  EQUIVALENCE class (`rust.saw`, SAW) and the 8 pinned bridge terms, not
  this leg.
- Out of scope, untouched: the P2 third parser (Daedalus interpreter) and
  the P3 refusal-reason comparison.

## Files

- `scripts/btungsten/wb001-cryptol/WB001WireInjective.cry` (new): the 22
  lemmas of this leg and the `wireIsByteAt` chunk family.
- `scripts/btungsten/wb001-cryptol-leg-check.sh` (new): the runner.
- `.github/workflows/tests.yml`: new job `formal-cryptol-leg`, beside
  `formal`.
- `scripts/btungsten/wb001-formal-check.sh`: the `wireIndexDef` row retired
  (see the finding).
- `scripts/btungsten/README.md`: WB001 artifact row, §result-classes,
  §cryptol-leg (new), §next item 3.

## CI receipt (head `acb716f6a`)

The eight push workflows on `acb716f6a`, every one `completed success`:
tests 38105540059, WB001 SAW proofs 38105540046, bTunGsTeN RB 38105540050,
bTunGsTeN PQ 38105540045, bTunGsTeN PQ SAW 38105540036, WB002 SAW
equivalence 38105540054, WB002 WASM corpus 38105540090, secret-scan
38105540076.

Workflow `tests`, run 38105540059, job `formal-cryptol-leg` 114370170505
(2026-10-11T02:33:30Z to 02:40:08Z, success). Toolchain lines, verbatim:
`cryptol-3.6.0-ubuntu-24.04-X64-with-solvers.tar.gz sha256:
621860aa1dedc037e8fc8355bef3edf023e41e78efb7177146126f5a87309962` (PUBLIC-CONSTANT: the formal job's recorded digest), `Cryptol 3.6.0`,
`Git commit 61dd17b0c45ddf8c5c1e952afd5e789c4dc4ec4b`, `yices: Yices
2.6.5`, `Z3 version 4.8.14`, `caps: address space 6291456 KiB per
process, 3 processes at once, a clock per obligation`, `pool wall time:
381s`.

| obligation | prover | wall | peak RSS (KiB) |
|---|---|---|---|
| validImpliesBounded | z3 | 11 s | 659480 |
| zeroTailAtPosition | z3 | 2 s | 256064 |
| validImpliesPadded | w4-yices | 8 s | 322052 |
| caseCover | w4-yices | 2 s | 268512 |
| splitDiff32, splitDiff64 | w4-yices | 1 s, 1 s | 253888, 254460 |
| padZero64, padZero128, padZero4096 | w4-yices | 0 s, 1 s, 42 s | 254564, 254484, 356080 |
| byteDiffDom, Non, Act, Dst, Cap | w4-yices | 3, 2, 4, 3, 7 s | 386792 to 410820 |
| byteDiffPay, byteDiffPld | w4-yices | 27 s, 66 s | 400276, 408696 |
| lenDiffDom, Dst, Cap, Pay, Pld | w4-yices | 2, 3, 4, 8, 11 s | 388772 to 412152 |
| u64DiffEpo, Amt, Exp | w4-yices | 2, 7, 8 s | 396696 to 411588 |
| wireIsByteAt`{0}`, `{1}` | w4-yices | 156 s, 105 s | 897216, 945816 |
| wireIsByteAt`{2}` .. `{17}` | w4-yices | 30 to 46 s each | 933672 to 945572 |
| wireIsByteAt`{18}` | w4-yices | 3 s | 334904 |

Every one `PROVEN (Q.E.D., …)`. Controls: C1 0 s, C2 4 s, C3 5 s, C4 3 s,
C5 27 s, C6 2 s, C7 2 s, each `PASS (counterexample, as required; …)`.
Final lines, verbatim:

    CRYPTOL-LEG-COMPOSED wireZeroTail: PROVEN BY COMPOSITION (21 obligations, every one Q.E.D. in this run; glue: (D-eq) and first-order logic, README WB001 §cryptol-leg; not a single :prove verdict)
    CRYPTOL-LEG-COMPOSED wireInjective: PROVEN BY COMPOSITION (42 obligations, every one Q.E.D. in this run; glue: (D-eq) and first-order logic, README WB001 §cryptol-leg; not a single :prove verdict)
    CRYPTOL-LEG CONTROLS: 7 of 7 ended in the required counterexample

Same run, job `formal` 114370170525 (success): the `wireIndexDef` row no
longer runs, and the single-query rows read, verbatim,
`FORMAL-PROVE-UNIVERSAL wireZeroTail: NOT-PROVEN (memory — RTS exhausted
the 6291456 KiB cap, rc=251; recorded, never success)` and the same line
for `wireInjective`; `validImpliesBounded`, `offsetsOrdered`,
`zeroTailAtPosition` PROVEN; `FORMAL-WIRE-ALIGNMENT: PASS`.
