Found while re-checking an experimental benchmark of ours (RB01) against popsicle circuit PSI. The reproduction programs, raw logs of three runs and a digest of every file are in a public evidence package, pinned at commit `0d88ec248`: [README](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/README.md), [receipts](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/RECEIPTS.md).

## Summary

`OpprfPsiGarbler::intersect` can panic when the garbler's set is larger than the evaluator's. The panic is `assert!(points.len() <= npoints)` in `swanky_oprf_kmprt::Sender::process_oprf_output`, inside a function that returns `Result`, and the session yields no cardinality. In our runs with
|B| = 256, the first panics appeared at |A| = 352. The only statement of the
size relation is an internal comment (`receiver.rs:177`, `:205`: "PSTY expects parties to have the same set sizes"). The `CircuitPsi` docs and the example do not mention it.

## Version

- `dev` at `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`, the head of `dev` when checked (2026-10-09)
- `rust-toolchain` 1.99.0, the repo's `.cargo/config.toml`, `Cargo.lock` (`--locked`), release profile
- Linux 6.18 x86_64 (WSL2)

## Reproduction

The program is [`repro_set_sizes.rs`](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/repro/repro_set_sizes.rs); place it at `edge/popsicle/examples/`. Synthetic data: A = {0..|A|}, B = {|A|-128..|A|+128} as 8-byte little-endian keys, so
|B| = 256 and |A ∩ B| = 128. Each |A| gets 20 fresh sessions, with the same
calls as `examples/circuit_psi_cardinality.rs`. Every panicking session's panic message is tallied. The program prints a short notice before it runs and has a 600 s watchdog.

```
cargo run --locked --release -p popsicle --example repro_set_sizes
```

## Expected

The cardinality 128, or an `Err` from `intersect` if the sizes are outside what the protocol supports. Not a panic.

## Observed

Notice lines omitted:

```
|B| = 256; 20 sessions per |A|; expected cardinality 128 in every row
|A| =  128: correct 20, wrong  0, error  0, panic  0
|A| =  256: correct 20, wrong  0, error  0, panic  0
|A| =  288: correct 20, wrong  0, error  0, panic  0
|A| =  320: correct 20, wrong  0, error  0, panic  0
|A| =  352: correct 18, wrong  0, error  0, panic  2
         2 session(s) panicked: thread 'main' at edge/oprf-kmprt/src/lib.rs:211: assertion failed: points.len() <= npoints
|A| =  384: correct 14, wrong  0, error  0, panic  6
         6 session(s) panicked: thread 'main' at edge/oprf-kmprt/src/lib.rs:211: assertion failed: points.len() <= npoints
|A| =  448: correct  0, wrong  0, error  0, panic 20
        20 session(s) panicked: thread 'main' at edge/oprf-kmprt/src/lib.rs:211: assertion failed: points.len() <= npoints
|A| =  512: correct  0, wrong  0, error  0, panic 20
        20 session(s) panicked: thread 'main' at edge/oprf-kmprt/src/lib.rs:211: assertion failed: points.len() <= npoints
|A| = 1024: correct  0, wrong  0, error  0, panic 20
        20 session(s) panicked: thread 'main' at edge/oprf-kmprt/src/lib.rs:211: assertion failed: points.len() <= npoints
```

Two earlier runs of the program, before it tallied every session, panicked 1 and 2 times of 20 at |A| = 352 and 5 and 7 times at 384. Their other rows matched, and the first panic they printed at each size was at `lib.rs:211`. No session in any run returned a wrong cardinality. These are samples: a row with no panics does not show that the size is safe.

## Where

- [`edge/oprf-kmprt/src/lib.rs#L211`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/oprf-kmprt/src/lib.rs#L211): `assert!(points.len() <= npoints)`. `npoints` is the per-bin bound β from `Parameters::new(ninputs)` ([L67-L91](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/oprf-kmprt/src/lib.rs#L67-L91)): 27 or 63 when `ninputs` ≤ 2^12, which covers these runs (`ninputs` = 326 here); for larger inputs the first bound rises to 31.
- `ninputs` is the evaluator's cuckoo bin count, which the garbler receives ([`sender.rs#L108`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs#L108)) and passes to `send` ([`#L176`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs#L176)). The garbler programs one point per element per hash function ([`#L124-L147`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs#L124-L147)), so the expected load per KMPRT bin grows with |A| / |B| (source reading).
- The only statement of the precondition: [`receiver.rs#L177`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/receiver.rs#L177).

## Suggested fix

1. In `process_oprf_output`, return an error instead of asserting, so that `intersect` returns `Err` and the caller can react.
2. State the supported size relation on `CircuitPsi::intersect` / `intersect_with_payloads`, or check it up front: the garbler knows |A| and the evaluator's bin count before it builds the KMPRT table.
3. Optionally, size the KMPRT parameters from the number of programmed points as well as from `ninputs`.

Not measured: whether the assertion can fire at |A| = |B|. β is a statistical bound; all 20 sessions at 256 / 256 were correct in each run.

---
These reproductions were written and run by an AI coding agent (Claude Code) in WSL2 on one host, in three runs. Every result above comes from those runs at the pinned commit.


Related reports from the same re-check: #48, #49, #50.

