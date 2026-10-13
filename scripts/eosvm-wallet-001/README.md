# EOSVM-WALLET-001 — native EOS VM as a runtime for BNR wallet contracts

Order EOSVM-WALLET-001 (2026-10-12). Everything under this directory is
additive evaluation tooling; no existing implementation was replaced.

## Layout
- `component/` — the zkrcount PLONK gate as an independently runnable EOS VM
  component. `field256.hpp`, `vk_count_constants.hpp`, `plonk_verify_count.hpp`
  are VERBATIM copies of the estate's files (one cited re-path line each);
  `zkr_component.cpp` defines the explicit host interface + phase-bisect
  exports; `string.h` + `eosio/*.hpp` are freestanding shims (declarations
  only). Host interface: imports `env.{keccak256, alt_bn128_add,
  alt_bn128_mul, alt_bn128_pair}` (raw i32 offsets); exports `memory`,
  `zkr_verify(proof_ptr, pubs_ptr)->i32` (0 = accepted), `zkr_last`,
  `zkr_layout`, `zkr_phase1/2`, `zkr_scalars`. The result is ALSO written to
  a memory slot (`zkr_layout` offsets) — the first slot readout was vacuous
  (nothing wrote it) until the mutation battery caught it; receipted.
- `harness/` — `evb.cpp` (engine harness: interp vs JIT, cold/warm/host-call
  decomposition, malformed battery, memory cap) + `micro.c` (micro-workloads)
  + `oracle.js` (ffjavascript BN254 oracle) + `keccak_oracle.js` (js-sha3)
  + `native_diag.cpp` (x64 mirror of the component for divergence hunting)
  + `engine-suite.sh` (the battery). Host crypto: keccak = cached js-sha3
  oracle (self-tested against canonical vectors; a hand-rolled keccak was
  REMOVED after failing its own fail-closed self-test — receipted); curve
  add/mul/pair = ffjavascript oracle with an on-curve validation gate (the
  lane's first local affine implementation produced off-curve results —
  receipted; no hand-rolled crypto rides this harness).
- `chain/` — Spring v1.2.2 local-node scripts + freestanding probes
  (`probefree.c` behavior probe, `bootfree.c` privileged feature-activation
  wrapper) + `chainrun.sh` (workloads + robustness battery) + `spincheck.js`.
- `blsprobe/` — freestanding BLS12-381 import probe (`blsfree.c`) +
  ffjavascript generator cross-check (`gen_bls.c.js`).
- `receipts/` — raw receipts; `receipts/artifacts/` — the built wasms +
  SHA256SUMS.

## Provenance (pinned)
- Runtime actually run: **Spring v1.2.2** (`antelope-spring_1.2.2_amd64.deb`,
  the zkbench lane's pinned deb, run EXTRACTED — no system install), tag
  commit `04bdb089edc7e3c3f954e0aab4a7f3cb48635788`.
- Engine: **AntelopeIO/eos-vm @ e8b4e8b799b9d6e3993e16e7c4a5d2fe04c739b6**
  (2025-03-05) — exactly what Spring v1.2.2's `libraries/eos-vm` submodule
  pins. Built locally from that checkout; 12 commits behind AntelopeIO
  main (`377c046`).
- Compiler pins: Spring CI pins `clang-20` (.cicd toolchain preset). Local
  engine/harness: g++ 15.2 (clang-21 trips on eos-vm@e8b4e8b's deduced-return
  `host_function` templates — the shipped `hello_driver` tool fails
  identically, so it is a compiler/revision property). Contracts: CDT 4.1.1
  (extracted deb) for compilation; its bundled old-LTO wasm-ld spins forever
  on this box (receipted), so wasm linking goes through Ubuntu lld-21
  (`~/.local/bin` + CDT-bin adapters included in this lane's scripts).
- Licenses: Spring = **Business Source License 1.1** (ENF licensor; free use
  only "Directly in Service of or Materially Dependent on the EOS Blockchain
  Network"; Change Date four years per version). eos-vm (all four repos) =
  **EOS VM License V1.0** — exactly that license, not plain MIT: a grant in
  the style of MIT PLUS an additional condition requiring covered works
  adapted for "Other Blockchain Purposes" to have their corresponding
  source made available free of charge under the same license (founder
  closeout rider 2026-10-13: the "MIT-style" shorthand is retired from the
  inventory).
- The four repos: `EOSIO/eos-vm` (block.one root, quiet since 2023-07),
  `AntelopeIO/eos-vm` (ENF root, quiet since 2025-07 — the Spring pin
  source), `gofractally/eos-vm` (root, STILL ACTIVE 2026-10),
  `loviswaternakamoto/eos-vm` (fork OF gofractally, tip `1c88144` 2023,
  dormant). A repo tip is NOT deployment evidence; the deployment evidence is
  the deb above and the closed zkr lane's Jungle4 artifacts.
- Related active fork: `Wire-Network/eos-vm` (root, active 2026-06) — where
  the Spring #1882 read-only-deadlock fix landed (their #7).

## BLS12-381 reconciliation (source-cited, digest CORRECTED)
- Old claim (ZANO_RAID_2026-09-01): "BLS12-381 … NO host function". Current
  truth at v1.2.2: TEN host functions exist — `bls_g1_add`, `bls_g2_add`,
  `bls_g1_weighted_sum`, `bls_g2_weighted_sum`, `bls_pairing`, `bls_g1_map`,
  `bls_g2_map`, `bls_fp_mod`, `bls_fp_mul`, `bls_fp_exp`
  (`webassembly/interface.hpp:1815-1914`; implementation
  `webassembly/crypto.cpp:263+` — 96-byte uncompressed affine LITTLE-ENDIAN
  points, check_valid enforced), gated by `BLS_PRIMITIVES2`.
- Digests, FROM THE BINARY'S OWN STARTUP TABLE (nodeos log): BLS_PRIMITIVES2
  = `63320dd4a58212e4d32d1f58926b73ca33a247326c2a5e9fd39268d2384e011a PUBLIC-CONSTANT (v1.2.2 feature digest)` —
  **matching ZK_BENCH_2026-09-01 §5's quoted prefix `63320dd4a5…` exactly**
  (that correction is vindicated). CRYPTO_PRIMITIVES = `6bcb40a2…cedc` (the
  zkbench lab.sh value, likewise confirmed). Values I first lifted from the
  source's spec comments (`c0cce5bc…`, `68d6405c…`) are *description*
  digests, not feature digests — corrected here; earlier text in this README
  claiming a mismatch was wrong.
- CDT 4.1.1 wraps NONE of the ten (crypto_ext.hpp: alt_bn128/blake2f/sha3/
  k1 only) — "present but unwrapped", exactly as ZK_BENCH phrased it.
- Runtime call evidence: NOT TESTED — blocked by the activation bootstrap
  (below). The probe is built (`receipts/artifacts/blsprobe_free.wasm` +
  ffjavascript generator cross-check constants) and ready.

## Results (measured; receipts/)

> **FOUNDER DISPOSITION (2026-10-13, closeout)**: the evaluation's
> recommendation to add the standalone backend was ahead of its acceptance
> results. The backend stays an EXPERIMENTAL COMPARISON CANDIDATE, outside
> the production path; EOS VM is preserved as a pinned reference, not a
> required dependency. Identical rejection across backends establishes
> agreement for those executions, not a correct verifier. The performance
> numbers below are workload-specific and support per-workload execution-
> strategy choice only. Successor lane: BNROSE-RUST-001 (fresh session).
> Full text: the dispatch's §FOUNDER DISPOSITION.

### Engine — interpreter vs JIT (same wasm, same host)
| workload | interp | JIT | ratio |
|---|---|---|---|
| pure-wasm loop 20M iters (p50) | 899 ms | 149 ms | **JIT 6.0×** |
| dbloop 500×(put+get) (p50) | 126 µs | 164 µs | **interp ~1.3× faster** |
| ctor/parse 1.2KB module (p50) | 47 µs | 60 µs | ~parity |
| malformed-wasm battery (6 cases) | 6/6 rejected | 6/6 rejected | — |
| memory.grow to 4096-page cap | clean | clean | — |

Component (31KB PLONK verifier, real count proof + mutations):
- **Cross-backend behavioral equivalence**: identical accept/reject on every
  input AND identical host-call fingerprint (`calllog_fnv a4060989da93bc26`)
  on interp and JIT; an x64 native mirror (`native_diag`) agrees.
- Reject-path engine time: phase-1 catch of a mutated proof byte — interp
  0.58 ms vs JIT 0.10 ms; scalar-phases-then-reject — interp 4.1 ms vs JIT
  0.32 ms. Host decomposition per full run: 6 keccak + 18 add + 18 mul +
  1 pairing (oracle execs cached; times separated in the log).
- ACCEPT-path honesty: the ffjavascript-oracle host path REJECTS a proof
  that snarkjs ACCEPTS (`plonk verify` OK against count_vk.json, which is
  byte-identical to the committed vk constants — regenerated and diffed).
  The divergence is in MY oracle wiring, UNDIAGNOSED; it does not touch the
  engine findings (same behavior on all three execution paths). The
  authoritative accept evidence remains snarkjs + the closed zkr lane's LIVE
  Jungle4 v4 receipts; the on-chain re-run is blocked below.

### Chain — Spring v1.2.2 (three runtime configs)
- Proven: boot/blocks/trx inclusion/billed-CPU receipts (noop ≈ 234 µs,
  probe actions ≈ 218–330 µs — see dispatch for the no-op caveat), 8×10 s
  concurrent-read storm zero errors, malformed-ABI refusal, wasm
  memory grow-to-cap with node alive, state persistence across restarts.
- **BLOCKED (receipted, five failed paths listed in the dispatch)**:
  protocol-feature activation on fresh v1.2.2 dev chains ⇒ ALL
  crypto-intrinsic chain runs (bench pair/padd/pmul, verifymin, on-chain
  zkrcount, BLS runtime call) NOT TESTED. Notably the v1.2.2-stock bios is
  ITSELF refused with `env.bls_pairing unresolveable` until BLS_PRIMITIVES2
  is active — an unplanned activation-requirement receipt.
- **UNDIAGNOSED**: freestanding (non-CDT) probe wasms receive apply()
  action-name values inconsistent with the name law (interp printed
  `0xaeb3d0…` for a `putx` action; JIT produced no console output at all
  with `--contracts-console` on) — chain probe actions ran as no-ops. CDT
  artifacts (v1.6 bios, zkbench wasms) deploy and run fine.
- Spring #1880 (OC replay crash) / #1882 (read-only deadlock): NOT
  REPRODUCED — and not meaningfully testable this session (both need a
  working contract surface); #1882's referenced fix (Wire-Network/eos-vm#7)
  is analyzed in the dispatch.

## Reproduction
All under WSL Ubuntu 26.04 (scripts state WHERE they run); one-time env:
`~/eosvm001/{eos-vm@e8b4e8b, springroot (debs extracted), zkbench,
oracle/node_modules (ffjavascript), lld21}` + `~/plonkport` (count circuit
artifacts; survived from the closed lane).
```
bash harness/build.sh && bash component/build.sh
bash harness/engine-suite.sh            # receipts/engine-suite.log
bash chain/boot.sh eos-vm-jit none      # configs: eos-vm|eos-vm-jit × oc none|all
bash chain/chainrun.sh                  # workloads + robustness battery
node chain/spincheck.js chain/probefree.wasm
```
Results and the ranked recommendation:
`docs/dispatches/2026-10-13-eosvm-wallet-001.md`.
