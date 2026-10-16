# RB05: the RB04 grammar is the WB001 decoder, on every input

RB04 compared two parsers of the WB001 intent envelope by sampling: BNR's
decoder (`btungsten_wb001::decode`) and the Rust that Daedalus generates from
`scripts/btungsten/rb04-daedalus/WB001.ddl`, over 491 vectors and 200,000
seeded inputs. RB05 replaces the sampling with proofs, in this chain:

| link | statement | how |
|---|---|---|
| decoder | `decode_core` (the decision inside `decode`) equals `decodeSpec` for every buffer and every input length; it writes the decoded intent exactly when the verdict is `dOk` | SAW over MIR, `wb001-saw/decode.saw` (14 obligations) |
| grammar | the grammar, read in `WB001Grammar.cry`, accepts exactly what `decodeSpec` accepts, with every decoded field equal (`exactEquiv`), and its `Envelope` entry consumes exactly what RB04's consumed dimension requires (`envelopeOk`, `envelopeTrailing`, `envelopeRefuses`) | SAW `prove_print`, `grammar.saw` (25 obligations) |
| UTF-8 | the grammar's `Only (Many UTF8Char)`, RFC 3629's char grammar under greedy repetition, accepts exactly what the spec's UTF-8 DFA accepts, at 64 and 128 bytes | a simulation inside `grammar.saw`: the invariant `rel` holds at every byte position |

Composed: for every byte string, the grammar accepts it exactly when BNR's
decoder does, with the same values, and the grammar's prefix entry agrees
with the decoder's `bt-wb01:trailing` refusals.

## What is NOT proven (the trust boundary)

- **The generated Rust.** The proofs are about the grammar as read into
  Cryptol, not about the code `daedalus compile-rust` emits. That code stays
  tied to the grammar by RB04's sampled comparison and by trusting the
  pinned generator (`a4ad7592`). A SAW proof of the generated code was not
  attempted here: its runtime builds reference-counted arrays and an error
  report as it parses, far from the shapes the WB001 proofs reach.
- **The reading.** `WB001Grammar.cry` is a reading of the grammar under the
  semantics the Daedalus user guide states at the pin
  (`docs-src/source/user-guide/parsers.rst`: `Many` "will parse any input
  maximally", `First` is biased choice, `Only P` is P then END), one
  Cryptol definition per grammar definition. It is checked by eye and by
  the TEETH below, not by a tool.
- **The slice wrapper.** `decode(env)` copies the first `MAX_ENV` bytes of
  `env` into a zero buffer and passes `env.len()`; SAW cannot quantify over
  slice lengths, so these lines are read and tested (the WB001 battery, the
  `legacy` leg that holds `decode` to the pre-RB05 decoder on 20,000 seeded
  inputs, and RB04's corpus), not proven.
- **Re-encoding.** That an accepted input is the canonical encoding of its
  values (RB04's reencode dimension) is a decoder-versus-encoder property,
  still sampled.

## Why the decoder changed shape

SAW could not run the slice decoder with a symbolic length: a probe at
inputs of at most 200 bytes was still in symbolic simulation at 900 s and
7 GB (2026-10-10). `decode_core` reads a fixed `MAX_ENV` buffer and the true
length, with every loop at a concrete trip count, the shape the WB001 encoder
already had. Every read at a computed position goes through one function,
`byte_at_pos`, proven once (147 s locally): comparing two different
4,626-way selections in one goal costs the solver minutes per read, and
`be32_from` with its four reads inlined took about 20. The payload is read
in 64 chunks of 64 bytes (`chunk_64`). It refuses in the same order with the same codes;
`tests/wb001/legacy.rs` keeps the old decoder verbatim as the reference.
The word blocks advance by 8, the length their header is required to carry,
so both sides of the grammar proof read every byte at the same term.

## TEETH

`rb05-saw-check.sh` applies RB04's four substitutions to the reading, one
textual substitution each, and re-runs `grammar.saw` on each variant. Each
must fail with a solver counterexample at the declared obligation, after
proving everything before it:

| id | substitution | must fail at |
|---|---|---|
| t1-domain-bound | domain bound 64 → 65 | `exactEquiv` |
| t2-word-endian | `BEUInt64` → a little-endian read | `exactEquiv` |
| t3-cesu8-surrogate | `ED 80..9F` → `ED 80..BF` | `u8Step 64` |
| t4-trailing-bytes | `Exact = Only Envelope` → `Exact = Envelope` | `exactEquiv` |

`wb001-saw/decode-teeth.saw` asks `block_code` to equal `blockCode` with
the length-bound and value-fit refusals swapped; it must fail too.

## Files

`WB001Grammar.cry` (the reading), `RB05.cry` (the simulation, the lemmas,
the theorems, the closed-term non-vacuity rows), `grammar.saw` (the
proofs); `../wb001-cryptol/WB001Decode.cry` (the decoder spec, with the
stream primitives both sides share); `../wb001-saw/decode.saw` and
`decode-teeth.saw` (the Rust link); `../rb05-saw-check.sh` (the runner, in
the WB001 SAW workflow).

Run locally from this directory: `saw grammar.saw`.
