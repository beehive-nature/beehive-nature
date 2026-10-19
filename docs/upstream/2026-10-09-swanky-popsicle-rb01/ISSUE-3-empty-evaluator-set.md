DRAFT, not filed. Target: https://github.com/GaloisInc/swanky/issues (public).
Covers RB01 observation 4. Prepared and executed by Seat 3 (Claude Code); receipts in `RECEIPTS.md`.

# popsicle circuit PSI: an empty evaluator set panics both parties

## Summary

When the evaluator's set is empty, both parties panic. The garbler divides by
a zero bin count in `CuckooHash::bin`. On x86_64, the evaluator hits
`assert!(nrows >= 16)` in `swanky_bit_matrix_transpose` through the KKRT OPRF
with zero inputs. With both sets empty, the evaluator panics the same way. An
empty garbler set with a non-empty evaluator set works and gives 0.

## Version

`dev` at `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`; `rust-toolchain` 1.99.0;
the repo's `.cargo/config.toml` and `Cargo.lock` (`--locked`); release profile;
Linux 6.18 x86_64 (WSL2). Other targets were not tested.

## Reproduction

Attached `repro_evaluator_inputs.rs`, placed at `edge/popsicle/examples/`.
The non-empty set is {100..356} as 8-byte keys. The program prints a short
notice before it runs.

```
RUST_BACKTRACE=1 cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- empty-b      # A = 256 keys, B = {}
RUST_BACKTRACE=1 cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- empty-both   # A = {}, B = {}
cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- empty-a                       # A = {}, B = 256 keys
```

## Expected

Cardinality 0 (|A ∩ ∅| = 0), or an `Err` if empty sets are unsupported. Not a panic.

## Observed

`empty-b`, exit 101. Excerpt of the short-form backtraces: the panic lines
and the innermost swanky frames (evaluator frames 3–7, garbler frames 3–4).
The outer popsicle and swanky_channel frames are omitted. `<unnamed>` is the
evaluator and `main` the garbler, as in `local_channel_pair`.

```
thread '<unnamed>' (69736) panicked at edge/bit-matrix-transpose/src/lib.rs:83:5:
assertion failed: nrows >= 16
   3: swanky_bit_matrix_transpose::_transpose
   4: swanky_bit_matrix_transpose::transpose
   5: <swanky_oprf_kkrt::Receiver as swanky_oprf_traits::Receiver>::receive::<swanky_channel::Channel, swanky_rng::SwankyRng>
   6: <swanky_oprf_kmprt::Receiver>::receive::<swanky_channel::Channel, swanky_rng::SwankyRng>
   7: <popsicle::psi::circuit_psi::base_psi::receiver::OpprfReceiver as popsicle::psi::circuit_psi::base_psi::BasePsi>::opprf_exchange::<swanky_rng::SwankyRng>
thread 'main' (69734) panicked at edge/popsicle/src/cuckoo.rs:133:9:
attempt to calculate the remainder with a divisor of zero
   3: <popsicle::cuckoo::CuckooHash>::bin
   4: <popsicle::psi::circuit_psi::base_psi::sender::OpprfSender as popsicle::psi::circuit_psi::base_psi::BasePsi>::hash_data::<swanky_rng::SwankyRng>
```

`empty-both`, exit 101: the evaluator panics at the same `lib.rs:83:5`
assertion through the same frames, and the garbler's thread then panics on
the joined result (`core/channel/src/local.rs:162:38`).

`empty-a`, exit 0 (notice lines omitted):

```
empty-a: |A| = 0, |B| = 256 (as given), set answer 0: cardinality 0 after 39.069614ms
```

The two earlier runs gave the same panics and locations. The order in which
the two panic messages print varies between runs.

## Where

- Garbler: `compute_nbins(0, 3)` is 0
  ([`cuckoo.rs#L41-L61`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/cuckoo.rs#L41-L61)).
  The evaluator sends that count ([`receiver.rs#L117`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/receiver.rs#L117)),
  and the garbler's `CuckooHash::bin(.., nbins)`
  ([`sender.rs#L128`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs#L128))
  computes `% nbins` ([`cuckoo.rs#L133`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/cuckoo.rs#L133)).
- Evaluator: KKRT `receive` rounds the row count up to a multiple of 16, which
  leaves 0 at 0 ([`oprf-kkrt/src/lib.rs#L187-L189`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/oprf-kkrt/src/lib.rs#L187-L189)).
  On x86_64 the SIMD transpose requires at least 16 rows
  ([`bit-matrix-transpose/src/lib.rs#L81-L83`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/bit-matrix-transpose/src/lib.rs#L81-L83),
  under `#[cfg(target_arch = "x86_64")]`). Other targets use a naive transpose
  that does not assert this (source reading; not run).

## Suggested fix

Handle the empty set in popsicle before hashing. Both parties learn the bin
count, so on `nbins == 0` both can skip the OPPRF and produce an empty
existence vector, which gives cardinality 0. Alternatively, return `Err` for
an empty evaluator set. Independently, KKRT `receive` with zero inputs could
return an empty vector instead of reaching the transpose.

---
These reproductions were written and run by an AI coding agent (Claude Code)
in WSL2 on one host, in three runs. Every result above comes from those runs
at the pinned commit.
