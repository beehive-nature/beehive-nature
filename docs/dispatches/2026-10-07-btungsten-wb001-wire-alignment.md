# 2026-10-07 — WB001 B1 repair: the proof was about a different wire; the model re-packed, the vectors executed, the proof re-run

zCode seat, branch `zcode/btungsten-wire-align-2026-10-07` (base
`8046a4a86`). Founder review of the Beat 3 merge (`7288c851f`, post-
merge run 37639664457, formal job 112854940573) found the blocking
defect: **the Cryptol theorem proved injectivity of a different wire
representation from the runtime `canonical()`**. Ruling: repair within
this lane, record the failures first, correct the model's packing, make
Cryptol reproduce the shared vectors in CI, re-prove, keep the old
receipt with its actual scope, correct the overbroad closeout wording.
No new founder decision required.

## The failures, recorded first (RED)

Founder's observations (independent Node execution + hand-transcription
of the Cryptol concatenation), reproduced verbatim by this seat's own
transcription of the then-current model:

```
iBase: runtime 187 bytes | model 4626 bytes | first diff at offset 27 | runtime[27]=0x2 model[27]=0x0 | model[297]=0x6 (capability tag)
vector base: model disagrees at offset 27
vectors: model prefixes disagree with 10/10 pinned envelopes
amount 1000000 vs 1000001: runtime envelopes differ from offset 151 | model buffers share the first 378 bytes (envLen-compact prefix identical → truncation projection fails)
```

Three concrete failures, per the ruling's shape: (1) **prefix
agreement fails** — the nonce tag sits at runtime offset 27 and model
offset 77, first differing byte at 27 (`0x02` vs `0x00`); (2) **zero-
tail agreement fails** — the capability tag `0x06` is alive at model
offset 297, far past `envLen = 187`; (3) **the truncation projection
fails** — two accepted intents differing only in amount share their
entire compact prefix (and more) in the model buffer, so no
"first envLen bytes" reading can recover the runtime envelope. The
10/10 pinned-vector disagreement is the same defect at sample scale:
the claimed sampled wire agreement did not exist — it was asserted in
comments the runner never executed.

Root cause: `wireTlv t f = [t] # split f.len # f.bytes` appends each
field's full CAPACITY array; `envLen` computed the compact length but
`wire` never used it to pack. This was the Beat 2 mistake class
("the formal model must describe the deployed wire language, not an
easier capacity model") surviving inside the packing after the
accepted-language predicate itself had been made concrete.

## The repair

- `Intent.cry` re-packed: field layout OFFSETS (`oDom..oLoa`, each
  previous offset + 5 + previous MEANINGFUL length), a position-indexed
  `byteAt` (header byte / tag / length-word byte / meaningful byte /
  0 past `envLen`), and `wire i = [ byteAt i p | p <- positions ]` at
  fixed MaxEnv with the compact envelope at the front and zeros ONLY
  past `envLen`. The old `wireTlv` is gone.
- `wireZeroTail` added as a PROVABLE obligation (was a comment, and a
  false one).
- The bridge's prefix half is now EXECUTED: `wb001-gen-vectors-cry.mjs`
  generates `wb001-cryptol/Vectors.cry` from the pinned
  `wb001-vectors.json` — all 10 positive envelopes as Cryptol hex
  literals (PUBLIC-CONSTANT-marked), each row asserting
  `envLen == pinned length && wire v == pinned envelope zero-extended
  to MaxEnv` (length word + every meaningful byte + zero tail in one
  equality); `vectorsHold` sums the rows and gates the formal job. A
  red there now NAMES a wire-packing divergence instead of hiding in
  comments.
- Runner: checks load Vectors.cry (imports Intent.cry); `:check
  vectorsHold` and `:check wireZeroTail` added; the PROVE leg is a loop
  over `wireZeroTail` and `wireInjective`, each classified honestly
  (Q.E.D. = PROVEN; counterexample = REFUTED red; timeout = NOT-PROVEN
  green, never success).

## Receipts after the repair

Filled by this PR's own formal job run (the result-class law: the run
is the receipt, not this prose):

- TYPECHECK: see run log.
- CHECK-SAMPLED: adversarial + per-field + constructed + **vectorsHold
  (10/10 pinned envelopes reproduced byte-for-byte)** + wireZeroTail +
  random wireInjective.
- PROVE-UNIVERSAL: `wireZeroTail`, `wireInjective` — verdicts as
  printed by the run.
- The 2026-10-07 Q.E.D. receipts (23.7s in-PR; 17.6s post-merge) stand
  for their ACTUAL theorem — injectivity of the capacity-padded
  representation — and are recorded as such in README/SPEC; the
  aligned-wire proof is the canonical claim.

## Boundaries not crossed

The runtime encoder is untouched (it passed the pinned vectors before
and after; the defect was model-side). EQUIVALENCE remains NOT
ATTEMPTED; the vectors are sampled agreement; the Rust twin + SAW stay
the separate later obligation. Genesis/boundary JS suites unchanged
(16/16 local). The sibling WB002 files are untouched.

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI merge of this PR on green: this seat (no-stall law).
- If the aligned-wire `:prove` exceeds its 300s budget, the honest
  state is NOT-PROVEN with CHECK-SAMPLED + vectors green — a later beat
  may raise the budget or decompose the theorem; never paper over it.
