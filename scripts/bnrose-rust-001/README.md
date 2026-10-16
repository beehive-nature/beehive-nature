# BNROSE-RUST-001 — the first BNRoSe Rust execution core

Order: founder, 2026-10-12. Dispatch:
`docs/dispatches/2026-10-12-bnrose-rust-001.md`. Leg served:
**BNRoSe L2 (eternal runtime)** — "a runtime that can always be rebuilt,"
made executable for one complete operation. This is the §workbench leg of
SPEC-BTUNGSTEN-1 no WB00x lane had run:

```
distributed execution → node/service failure + replacement →
healed execution → same invariant still verifies
```

## The slice

| crate | what it is |
|---|---|
| `crates/bnrose-exec-core` | the ONE authority: admission (WB001 strict decode, clock laws, scope laws — every refusal named), the operation state machine, every digest binding. `no_std`, fixed arrays, zero panics on bytes |
| `crates/bnrose-exec-wasm` | the wasm worker's face: a flat C-ABI shim over the core. The module has ZERO imports — no WASI, no host functions |
| `crates/bnrose-exec-host` | the supervisor: pinned wasmtime `=49.0.2` (fuel + epoch + memory cap, empty linker), the native face, the paranoid dual-run (byte equality required, disagreement traps), the HMAC-chained journal (fsync BEFORE the effect door), the idempotent digest-bound effect ledger, Ed25519 receipts, recovery from durable records alone, the CLI |

Workers: `native | wasm | paranoid` (default paranoid). Exit codes are a
contract: `0` ok · `1` refusal/error · `3` lost response (the WB004 crash
point) · `4` recovery completed with UNKNOWNs preserved.

## The named dedup components (no exactly-once from a local journal)

- **No second logical operation**: the supervisor's journal —
  `(authority, nonce)` uniqueness across all admissions, chain-authenticated.
- **No duplicate external effect**: the effect ledger — idempotent apply
  keyed by operation id, digest-bound to what dispatch journaled.
- Exactly-once beyond this single-supervisor, single-ledger slice would
  have to be the external system's own transactional property. Not claimed.

## Scripts

| script | what it does |
|---|---|
| `teeth.sh` | mutation controls: 5 planted implementation faults, each verified to land, each must turn the teeth vectors RED (clean control must be GREEN). CI: `.github/workflows/bnrose-rust-001.yml` |
| `recovery-demo.sh` | the healing leg as separate processes: crash (exit 3) → same-op recovery from journal + ledger → receipt verified under the public key alone → replacement refused → UNKNOWN preserved with evidence removed (exit 4, twice) → tamper fails closed. Receipt: `docs/receipts/bnrose-rust-001/` |

## Build & run

```
cargo build -p bnrose-exec-wasm --target wasm32-unknown-unknown --release
cargo test  -p bnrose-exec-core -p bnrose-exec-wasm -p bnrose-exec-host
sh scripts/bnrose-rust-001/teeth.sh
cargo build --release -p bnrose-exec-host
sh scripts/bnrose-rust-001/recovery-demo.sh
target/release/bnrose-bench            # labeled measurements
```

The battery (29 tests) runs wherever `cargo test --workspace` runs; the
wasm-dependent suites take the module from `BNROSE_EXEC_WASM` or the
conventional target path — a missing module is an error, never a skip.

## Receipts

- `docs/receipts/bnrose-rust-001/recovery-demo.txt` — the local run
- `docs/receipts/bnrose-rust-001/bench-local-release.json` — local
  release-build measurements (labeled)
- CI uploads fresh demo + bench receipts per run

## Boundaries stated

- The WB001 codec, `bsigner`, and every WB00x specimen are UNTOUCHED; the
  SAW/Cryptol receipts stand as earned. `bnrose-exec-core` composes the
  proven decoder; its own admission/transition logic is held by the
  battery and the teeth, not by a proof.
- `eosvm-wallet-001 @9273b95f7` is comparison evidence only.
- Benchmarks are workload- and hardware-labeled; no capacity extrapolation.
- Single supervisor, single ledger, deterministic clock input: the scale
  and multi-supervisor legs are future work, named in the dispatch.
