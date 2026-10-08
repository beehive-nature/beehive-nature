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

## Receipts after the repair (run 37702436659, formal job — the result-class law: the run is the receipt)

- **TYPECHECK: PASS** (BTungstenWB001.cry loads — renamed from
  Intent.cry: Cryptol resolves module names to same-named files).
- **CHECK-SAMPLED: PASS, every arm** — adversarial, per-field,
  constructed twins/near-collision, **vectorsHold (10/10 pinned
  envelopes reproduced byte-for-byte: length word, every meaningful
  byte, zero tail — the exact check that would have caught B1)**,
  wireZeroTail-sampled, wireInjective-sampled.
- **PROVE-UNIVERSAL: `wireZeroTail`: NOT-PROVEN (timeout 240s).
  `wireInjective`: NOT-PROVEN (timeout 240s).** Both are recorded open
  obligations, never success. The aligned-wire theorem is genuinely
  heavier than the padded structural one (offset arithmetic over
  MaxEnv=4626 positions × two symbolic intents), and the hosted runner
  was shut down mid-prove TWICE before a 300s wrapper could classify
  (exit 143 at 269s, run 37698302619; at 289s, run 37701649473) — the
  budget now sits below that kill window so the honest classification
  lands. Named next levers, in order: (1) a lemma decomposition
  (offset-equality then per-field equality), (2) a proof-scoped smaller
  capacity instance with an explicit scaling argument, (3) a manual
  long-budget run on a durable host (PROVE_BUDGET_S override).
- The 2026-10-07 Q.E.D. receipts (23.7s in-PR; 17.6s post-merge run
  37639664457) stand for their ACTUAL theorem — injectivity of the
  capacity-padded representation — and are recorded as such in
  README/SPEC. The canonical deployed-wire claim now rests on:
  vectorsHold (sampled, byte-for-byte, CI-gated) + wireInjective
  CHECK-SAMPLED (sampled) + the open universal proof, honestly open.

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

## RECONCILIATION (same-day, parallel seats)

While this lane iterated its repair in-PR, the sibling zCode seat
landed its own B1 repair on main (PR #358 — byteAt dispatch over
length-derived offsets, the SAME converged design, with a bridge
mechanism: runtime-derived bytes pinned in wb001-bridge.json + hex
constants in Intent.cry + two CI legs re-deriving them; their bridge's
own first counterexample `bridgeIBase = False`, run 37692766559,
independently convicted the pre-B1 wire) plus a WB002 wasm-equivalence
beat (PR #359). The merge onto 08d11832b keeps THEIR landed model and
bridge as canonical (receipted on main), drops this lane's superseded
generated-import variant (Vectors.cry + its generator — same class of
check as their bridge, theirs is landed), and layers only the
non-overlapping remainder of this lane:

- `wireZeroTail` — the zero-tail half of the bridge as a UNIVERSAL
  obligation (their bridge pins it per-term; this is the ∀ form).
- The prove leg as a per-obligation loop with honest classification,
  and the 240s budget with the two runner-kill receipts (269s/289s,
  exit 143) that motivated sitting below the kill window.

The B1 finding itself (founder review of #352), the red transcription
receipt, and the honest open state of the aligned-wire universal proof
stand as this dispatch records them — now on the converged model.
