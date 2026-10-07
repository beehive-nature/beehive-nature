# 2026-10-07 — WB001 boundary repair: the surrogate collision, red-first

zCode seat, branch `zcode/btungsten-2026-10-07` (base `4fac40d18`, one
commit after the genesis merge `b10fb0d522`). Founder review of PR #349
found a reproducible encoding collision; Beat 2 ruling: repair the
accepted-input boundary before any uniqueness or equivalence claim, keep
#349 closed as the completed genesis, keep its mutation receipts.

## The finding, reproduced first-hand before any repair

Against the module AS MERGED (blob verified on main at `4fac40d18`),
node 24.18.0, all other intent fields identical:

```
domain       canonical-equal: true | sig(a) verifies b: true | verifies real-FFFD c: true
destination  canonical-equal: true | sig(a) verifies b: true | verifies real-FFFD c: true
capability   canonical-equal: true | sig(a) verifies b: true | verifies real-FFFD c: true
payer        canonical-equal: true | sig(a) verifies b: true | verifies real-FFFD c: true
decode(0xff in domain): ACCEPTED, domain now "\uFFFDkaists.bpay/1"
verifyEnvelope over malformed bytes with sig over those exact bytes: true
```

`'\uD800'`, `'\uD801'` and `'\uFFFD'` are distinct accepted strings that
`Buffer.from(value, 'utf8')` maps to the same `efbfbd` bytes — a
many-to-one conversion BEFORE signing, not an Ed25519 forgery. The
decoder's twin gap: `toString('utf8')` replaces instead of refusing, so
malformed wire was accepted and a signature over malformed bytes
verified. Matches the founder's Node 22.16.0 observation exactly.

## RED FIRST — the boundary suite against the untouched genesis module

`node --test scripts/btungsten/wb001-boundary.test.mjs` BEFORE the
repair, verbatim:

```
✖ RED->GREEN: unpaired surrogates are refused at encode, in every text field
✔ RED->GREEN: the collision class is gone — one authorization can never cover the twin strings
✔ valid international text survives byte-exactly through encode and strict decode
✖ RED->GREEN: strict decode refuses malformed UTF-8 by name, accepts the valid 4-byte and U+FFFD controls
✖ RED->GREEN: verifyEnvelope refuses malformed-wire envelopes even when the signature was made over exactly those bytes
✖ the pinned shared vectors: byte-for-byte, refusals by code
ℹ tests 6  ℹ pass 1  ℹ fail 5
```

Note on honesty: the first cut of the "collision class" row signed the
HONEST intent, so it passed even on the broken module — the crossing only
appears when the surrogate intent itself is signed (the founder's exact
shape). The row was rewritten to sign the `'\uD800'` intent and assert
`'\uD801'`/`'\uFFFD'` never verify; only then does it run red. That
correction is itself a receipt: a green row here proved nothing until it
failed once.

## The repair

`scripts/btungsten/wb001-intent.mjs`:

- **encode gate** — `assertWellFormedString`: unpaired UTF-16 surrogates
  refused with `bt-wb01:utf16` BEFORE `Buffer.from`, in every text
  field. Valid surrogate pairs (supplementary characters) pass untouched.
- **decode gate** — `assertValidUtf8`: strict UTF-8 validation
  (`bt-wb01:utf8`) before `toString`: rejects lead/continuation
  violations, overlong encodings (c0/c1, e0<..a0, f0<..90), encoded
  surrogates (ed>..9f), beyond U+10FFFF (f4>..8f), truncation. The
  legitimate `efbfbd` of an honest U+FFFD passes.
- **no ASCII retreat** — valid international text stays accepted
  byte-exact; only ill-formed input narrows.

## GREEN receipts (same suite, same box, after the repair)

```
bT-WB001-boundary: lone-surrogate encodes refused 0 -> 32 (4 fields x 8 forms)
bT-WB001-boundary: surrogate-class authorization crossings rejected 0 -> 24 (4 fields x 6 rows)
bT-WB001-boundary: valid-unicode controls round-trip 0 -> 8
bT-WB001-boundary: malformed-utf8 decodes refused 0 -> 9 (valid 4-byte + U+FFFD controls pass)
bT-WB001-boundary: shared vectors held 0 -> 10 positives byte-for-byte, 9 refusals by code
```

Both suites together: 16/16. The genesis battery
(`wb001.test.mjs`) is retained byte-stable — its 10 tests and 2,178
mutant counts unchanged; the repair is purely additive (CI re-prints the
genesis lines unchanged, now beside the boundary lines).

## Shared vectors pinned (the bridge every twin must reproduce)

`scripts/btungsten/wb001-vectors.json` (generator
`wb001-gen-vectors.mjs`, re-derived and compared by the battery every CI
run): 10 positives byte-for-byte — base, astral text, legitimate U+FFFD,
combining + latin extended, CJK, astral domain, empty payload, u64
ceiling, u32 boundary, nested envelope — and 9 refusals by exact code —
4 lone-surrogate intents (one per text field) and 5 malformed-UTF-8
envelopes (0xff, CESU-8 surrogate, overlong c0 80, beyond U+10FFFF,
truncated c2). Per the ruling: no Rust/Cryptol equivalence claim exists
until the twin reproduces these byte-for-byte.

## Formal twin aligned (staged, still UNVERIFIED)

`wb001-cryptol/Intent.cry` rewritten per the ruling: the old model
appended full capacity-sized arrays and constrained nothing — proving
THAT injective would not prove the deployed variable-length encoding
injective. Now: meaningful lengths with valid-input constraints
(`validIntent`: bounds per field, canonical ZERO padding beyond the
meaningful prefix, fixed legal length words, `wellFormedUtf8` as the
abstract predicate pinned by the vectors), padded `wire` whose meaningful
prefix IS the deployed envelope, `envLen`, `wireInjective` for all VALID
pairs, and the model-wire bridge (prefix + zeroTail) named for the
vectors to pin. `:check` vs `:prove` recorded as separate result classes
(README §result-classes); check sets must include CONSTRUCTED related
pairs, not random sampling alone.

## Canon amendments (SPEC-BTUNGSTEN-1 §workbench, per the ruling)

- **Input-boundary law**: the canonical form binds every ACCEPTED intent
  uniquely, so the accepted-input boundary is part of the invariant;
  silent replacement is unlawful at encode and decode.
- **Result-class law**: TYPECHECK / CHECK-SAMPLED / PROVE-UNIVERSAL /
  EQUIVALENCE are separate results; none recorded as another; missing
  tool or timeout = NOT-RUN, never success; vectors before equivalence;
  a green workflow wrapper never substitutes for an executed obligation.

## Boundaries not crossed

Ed25519 remains assumed-correct as shipped (node:crypto), unverified
here. No Cryptol/SAW execution happened on this box (Linux x86_64 only);
the formal twin remains staged-UNVERIFIED with its four result classes
pending. The ZK lane's §tungsten coupling gates are untouched. No CI
workflow edits this beat (the suites ride the existing globbed step) —
the YAML+shell lesson applies to the next workflow edit, and the
result-class law now forbids substituting wrapper green for proof.

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI merge of this PR on green: this seat (no-stall law).
- Beat 3 (any seat): the cryptol TYPECHECK run on the CI ubuntu runner,
  then CHECK-SAMPLED with constructed pairs, per README §next / §result-classes.
