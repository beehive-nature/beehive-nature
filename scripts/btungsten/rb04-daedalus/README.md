# RB04: Daedalus-generated Rust against BNR's WB001 parser

Order: workerB bench expansion, 2026-10-08 (the subsequent candidate named
there). Lane: `rbench rb04` (`crates/btungsten-bench/src/lanes/rb04.rs`).
Receipt: `docs/receipts/btungsten-rb/ci-37923091082/rb04/` (full plan, PASS);
results and the trials on the way: `docs/receipts/btungsten-rb/REPORT.md`, RB04.

**The comparison.** BNR's parser is `btungsten_wb001::decode`
(`crates/btungsten-wb001`), the strict decoder of the WB001 intent envelope:
magic `bT-WB01`, version `0x01`, then ten tag-length-value blocks in
ascending tag order with big-endian 32-bit lengths, length bounds per field,
UTF-8 text through the SAW-proven DFA, and exact consumption. It was chosen
after reading it: its accepted language is small, fully specified by the
wire description, and paired with an encoder SAW proves equal to the Cryptol
`wire` (`btungsten_wb001::canonical`), which gives a canonical re-encoding to
compare against. The other parser is the Rust that Daedalus generates from
`WB001.ddl`, a grammar written from the wire description, not translated
from the decoder (UTF-8 there is RFC 3629's UTF8-char grammar over byte
ranges, not BNR's DFA).

| dimension | agreement on one input |
|---|---|
| acceptance | the grammar's `Exact` entry accepts exactly when `decode` does |
| values | where both accept, every decoded field is equal |
| consumed | the whole input where `decode` accepts; where it refuses with `bt-wb01:trailing`, the `Envelope` entry consumes a shorter prefix that `decode` itself accepts with equal values, and `Exact` fails; under any other refusal neither entry accepts |
| reencode | wherever BNR or `Exact` accepts, its values re-encode, through BNR's SAW-proven encoder, to the input bytes (`Envelope`'s prefix values are held to `decode` of the prefix under consumed) |

Corpora: the pinned WB001 vectors (positives, envelope refusals, bridge
terms) plus constructed boundary inputs, each with an expected BNR answer
that is checked too; and seeded adversarial samples (`src/corpus.rs`). A
panic in either parser counts as a disagreement.

**TEETH.** Each variant is `WB001.ddl` with one declared substitution
(`TEETH` in the lane); its generated parser must disagree with BNR on the
dimension it targets, on an input where the honest grammar agrees with BNR
on every dimension.

| id | substitution | must be convicted on |
|---|---|---|
| t1-domain-bound | domain length bound 64 → 65 | acceptance |
| t2-word-endian | `BEUInt64` → `LEUInt64` | values |
| t3-cesu8-surrogate | `ED 80..9F` → `ED 80..BF` (encoded surrogates, the class of WB001's 2026-10-07 boundary defect) | acceptance |
| t4-trailing-bytes | `Exact = Only Envelope` → `Exact = Envelope` | consumed |

**Pins.** daedalus `a4ad7592ef2449fa1da07d2827fc6684293d21ca` (generator
built from source in CI; upstream publishes no binaries), GHC 9.8.4 and cabal
3.14.2.0 (upstream CI's versions), Hackage index state
`2026-10-01T22:42:03Z` (the pin's commit time; upstream has no freeze file),
`daedalus-rts-rust` from the same commit (git dependency, `Cargo.lock`).

**Files.** `WB001.ddl` (the grammar); `src/generated/*.rs` (the generated
parsers: honest and four TEETH, committed byte for byte as the pinned
generator emits them, never edited or formatted; the lane regenerates them
and fails on any difference); `src/lib.rs` (the adapters and the four
dimensions); `src/corpus.rs`; `src/bin/rb04-diff.rs` (the process `rbench`
measures); `tests/differential.rs` (the same comparison in miniature, run by
`cargo test` without the Haskell toolchain).

**Reproduce.** With GHC 9.8.4 and cabal 3.14.2.0 on `PATH`:

```
cargo build --locked --release -p btungsten-bench --bins
target/release/rbench rb04 --tools T --work W --out O/rb04
```

`T/cabal` becomes the cabal home (`CABAL_DIR`). To regenerate the committed
parsers after a deliberate grammar change, copy `O/rb04/gen/*.rs` into
`src/generated/`.
