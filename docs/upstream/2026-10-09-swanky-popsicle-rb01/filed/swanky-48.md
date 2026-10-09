Found while re-checking an experimental benchmark of ours (RB01) against popsicle circuit PSI. The reproduction programs, raw logs of three runs and a digest of every file are in a public evidence package, pinned at commit `0d88ec248`: [README](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/README.md), [receipts](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/RECEIPTS.md).

## Summary

Circuit PSI neither rejects nor deduplicates repeated primary keys.

- **Garbler, one repeated element:** in a release build the session did not complete within 60 s. The garbler stays in `swanky_oprf_kmprt::Sender::process_oprf_output`, whose only uniqueness check is a `debug_assert_eq!`; a debug build panics there instead. Calling `swanky_oprf_kmprt::Sender::send` directly with a repeated programmed point behaves the same way.
- **Evaluator, 2 or 3 copies:** the cardinality counts each copy (2 or 3 where the set answer is 1).
- **Evaluator, 4 copies:** the session did not complete within 60 s. The evaluator stays in the cuckoo-key refresh loop in `OpprfReceiver::hash_data`.

The API calls the inputs set primary keys, so counting each copy is what an unstated precondition produces. Not completing, with no error to either party, is a defect whatever the precondition is.

## Version

`dev` at `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`; `rust-toolchain` 1.99.0; the repo's `.cargo/config.toml` and `Cargo.lock` (`--locked`); Linux 6.18 x86_64 (WSL2).

## Reproduction

The programs are [`repro_repeated_points.rs`](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/repro/repro_repeated_points.rs) and [`repro_evaluator_inputs.rs`](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/repro/repro_evaluator_inputs.rs); place them at `edge/popsicle/examples/`. Synthetic data: x = 7 and y = 9 as 8-byte keys. Each program prints a short notice before it runs and exits 124 if the session has not completed within 60 s.

```
cargo run --locked --release -p popsicle --example repro_repeated_points -- psi     # A = [x, x, y], B = [x]
cargo run --locked --release -p popsicle --example repro_repeated_points -- kmprt   # points [p, p, q], one receiver input
cargo run --locked           -p popsicle --example repro_repeated_points -- kmprt   # debug build
cargo run --locked           -p popsicle --example repro_repeated_points -- psi     # debug build
cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- dup2   # A = [x], B = [x, x, y]
cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- dup3   # A = [x], B = [x, x, x, y]
cargo run --locked --release -p popsicle --example repro_evaluator_inputs -- dup4   # A = [x], B = [x, x, x, x, y]
```

[`probe_spin.rs`](https://github.com/beehive-nature/beehive-nature/blob/0d88ec24842031281ef07cdda23bd18f3ae42cf7/docs/upstream/2026-10-09-swanky-popsicle-rb01/repro/probe_spin.rs) shows where a session that has not completed spends its time, without a debugger. Both parties' protocol RNGs (the `RNG` type parameter) count their draws and record the call site of every 4096th draw, for 10 s:

```
cargo run --locked --release -p popsicle --example probe_spin -- garbler-repeat
cargo run --locked --release -p popsicle --example probe_spin -- evaluator-repeat4
```

## Expected

Either an `Err` for input that is not a set, or the set answer (1). Not a session that does not complete.

## Observed

Release, notice lines omitted:

```
circuit PSI, repeated garbler element: no result after 60.000344216s; exiting 124
kmprt Sender::send, repeated programmed point: no result after 60.000499517s; exiting 124
dup2: |A| = 1, |B| = 3 (as given), set answer 1: cardinality 2 after 21.684862ms
dup3: |A| = 1, |B| = 4 (as given), set answer 1: cardinality 3 after 21.171632ms
dup4: no result after 60.000259039s; exiting 124
```

Debug, `kmprt` mode. The notice lines, the blank line before the panic and the trailing `note: run with RUST_BACKTRACE=1` line are omitted:

```
thread 'main' (68947) panicked at edge/oprf-kmprt/src/lib.rs:202:9:
assertion `left == right` failed
  left: 2
 right: 3
```

`psi` mode panics at the same line. Its two counts vary between runs: 3 and 5 here, 5 and 8 in the two earlier runs.

Probes (release, 10 s each), notice lines omitted:

```
garbler-repeat: no result after 10 s
  evaluator: 1424 RNG draws
  garbler: 18460672 RNG draws
  garbler: 4506 samples at
        <swanky_oprf_kmprt::Sender>::process_oprf_output (oprf-kmprt/src/lib.rs:243:25)
        <- <swanky_oprf_kmprt::Sender>::send (oprf-kmprt/src/lib.rs:184:18)

evaluator-repeat4: no result after 10 s
  evaluator: 157155 RNG draws
  garbler: 393 RNG draws
  evaluator: 38 samples at
        <popsicle::psi::circuit_psi::base_psi::receiver::OpprfReceiver as popsicle::psi::circuit_psi::base_psi::BasePsi>::hash_data (popsicle/src/psi/circuit_psi/base_psi/receiver.rs:110:36)
        <- <popsicle::psi::circuit_psi::base_psi::receiver::OpprfReceiver as popsicle::psi::circuit_psi::base_psi::BasePsi>::base_psi (popsicle/src/psi/circuit_psi/base_psi/mod.rs:90:15)
```

The two earlier runs gave the same outcomes and the same sample sites. The probe prints at 10 s while the last sample may still be in flight, so the garbler's 4,506 samples are one less than 18,460,672 ÷ 4,096.

## Where

These are source readings that explain the measurements above.

- Garbler: [`edge/oprf-kmprt/src/lib.rs#L201-L209`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/oprf-kmprt/src/lib.rs#L201-L209) is the uniqueness check (`debug_assert_eq!`). The loop at [`#L228-L256`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/oprf-kmprt/src/lib.rs#L228-L256) succeeds only when all hashed OPRF outputs in a bin are distinct. Two equal points give equal outputs for every `v` and every `m`, so the loop has no exit for that input. Popsicle hands it repeated points because `OpprfSender::hash_data` places every element, repeats included ([`sender.rs#L124-L139`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs#L124-L139)).
- Evaluator: [`receiver.rs#L106-L114`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/base_psi/receiver.rs#L106-L114) retries with a fresh key until `CuckooHash::new` succeeds. Copies of one element share their candidate bins under every key, at most `NHASHES` = 3 of them, so a fourth copy can never be placed ([`cuckoo.rs#L107-L127`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/cuckoo.rs#L107-L127)). With 2 or 3 copies, each copy sits in its own bin with its own hash index, and each matches the garbler's programmed point for that index.

## Suggested fix

1. Popsicle: check at the start of `intersect_with_payloads`, in both roles, that the primary keys are distinct, and return `Err` otherwise. Silently deduplicating is ambiguous when payloads are attached.
2. swanky-oprf-kmprt: make the uniqueness check in `process_oprf_output` a release-mode check that returns `Err`. Identical `(x, y)` pairs could instead be merged; the same `x` with different `y` cannot be programmed.
3. Bound both retry loops (KMPRT's table search, popsicle's cuckoo-key refresh) and return `Err` when the bound is reached.

---
These reproductions were written and run by an AI coding agent (Claude Code) in WSL2 on one host, in three runs. Every result above comes from those runs at the pinned commit.


Related reports from the same re-check: #47, #49, #50.

