# Sprint 02 qualification receipt

Continues `c79f23d` on `codex/silentpay-sprint02`. The original handoff, all Sprint 01 source files and its receipts remain unchanged. This milestone qualifies one **disposable local test profile**, using a genuine Groth16 proof and the pinned native/EVM runtime. It does not qualify the public Silent Pay deposit or exit profile.

`bcodexjungle` remains paused with deposits disabled and zero escrow. Sprint 02 uses read-only public RPC requests. All signing, minting and deployments in the new harness use a fresh private localhost chain, ephemeral keys and valueless fixtures. No public test assets, other agents' wallets, paid services or public deployments were used.

## Reproduced checkpoint and correspondence

The [read-only correspondence receipt](../verification/sprint02/correspondence.json) records the complete checkpoint commit/tree, compiled native source hashes, original referenced receipt hashes, rebuilt artifacts, and two independent public observations. [Actual command output](../verification/sprint02/correspondence-command.txt).

| Checkpoint result | Reproduced result | Evidence |
|---|---|---|
| Original manifest | 41 original entries match; 57 checkpoint source/config files unchanged in the correspondence audit | [Manifest](../verification/sprint02/reproduction/manifest.txt) |
| Python Silent Pay baseline | 59 passed | [Output](../verification/sprint02/reproduction/python-baseline-tests.txt) |
| Python schema baseline | 18 passed | [Output](../verification/sprint02/reproduction/bmesh-vnext-tests.txt) |
| Rust core | 40 passed; format and clippy pass | [Tests](../verification/sprint02/reproduction/rust-tests.txt), [clippy](../verification/sprint02/reproduction/rust-clippy.txt) |
| Three durable demos | Unknown, partial and recovered modes reproduced | [Unknown](../verification/sprint02/reproduction/demo-unknown.json), [partial](../verification/sprint02/reproduction/demo-partial.json), [recovered](../verification/sprint02/reproduction/demo-recovered.json) |
| Native CDT build | Same WASM and JSON ABI | [Build](../verification/sprint02/reproduction/native-build-fixed.txt) |
| Pinned exSat build | Same WASM | [Build](../verification/sprint02/reproduction/exsat-build-command.txt) |
| Existing local spike | All five tests passed | [Receipt](../verification/sprint02/reproduction/local-spike.json) |
| Historical Jungle rejection cases | Repeated against a disposable local copy; public transactions were not resubmitted | `operational_guards` in the [new local receipt](../verification/sprint02/local-qualification.json) |

The untouched ZIP at `C:\Users\travi\Downloads\bMESHasi_Coding_Handoff.zip` has SHA-256 `cdb2a03d364f48768e1e6ce662a17054124994e7e4e26fbcaa73573cb0546b38`. The archive was not reimported or used to reconstruct Sprint 01.

| Artifact | SHA-256 |
|---|---|
| Sprint 01 native WASM, 39,754 bytes | `53cb0c7d9b48c927bfee7e9b5862b1fce9a4f6628b569d9e12888b5cdccdfead` |
| CDT JSON ABI, 9,615 bytes | `0a8c8e113004e08b927624e2dd4edbf6aba7a77786cf869a70eced6f738e60d8` |
| Serialized deployment ABI, 1,472 bytes | `81e4bdf6c2ce69b0a2f21d1088607035dc835d64485ed31e569fb50260511c37` |
| exSat WASM | `c0ec4e3c2971045d32518be14321741e286d63cc79873cf6a906ee493aa2f56d` |
| Sprint 02 local native verifier WASM | `703f3c40cbca82ccde05254bab5ba4f2b30c1179b5b2498eec00b22681ff907b` |

JSON ABI file hashes and on-chain serialized ABI hashes are different representations. The serializer supplies the two empty legacy vectors omitted by CDT, as documented in Sprint 01. The historical deployment transaction's actual `setcode` and `setabi` payloads independently hash to the rebuilt WASM and serialized ABI; current code/ABI also match on Greymass and CryptoLions.

**Historical correction:** transaction `ea95757bdc6b779cc72a35dab34e2373d3a729d28528383448419597aac64dbf` has irreversible inclusion in **285888378**, confirmed by both endpoints. Its original submission receipt reported **285888377**. That earlier block does not contain it. The original receipt and `docs/IMPLEMENTATION.md` are preserved; Sprint 02 records both values. Deployment transaction `2893570ff01672496faec10fd2c50a3b7dec36bf8d88faea68d7fc23d834e21f` is in 285887764 as reported. These are RPC observations, not independently verified consensus proofs.

The initial exSat reproduction encountered a Windows/WSL line-ending check discrepancy in the ignored source checkout. Setting that checkout's local `core.autocrlf=true` allowed the unmodified source check and build to complete. No upstream source patch was applied; the rebuilt WASM is identical.

## One exact proof suite

[Suite manifest](../proof02/fixtures/suite.json):

| Pin | Value |
|---|---|
| Suite ID | `7f56ee8ea881a6092d700af39f51c3da04bbf1d435db63bd401c3b0b5d1ebd52` |
| Canonical R1CS matrices SHA-256 | `c7bb635604af52493815efb1c1a040c9926b95eb26c87e6b627f4b4f82661012` |
| Verification key SHA-256 | `c323aa7799fa8724d68365d7def40da0ae013c3df5ef2f43f192d879afc98c54` |
| Public proving key SHA-256 | `93dc40848223a3c3f728b9cd7fb9273da4e7402b3121fc2b89d82f37e1aba890` |
| Input schema SHA-256 | `b0e07f1343f2f58120afd9a9e6fb7dc882071fb0869d10b0595bef1c732764f3` |

The suite contains 114,079 constraints over BLS12-381's scalar field and 12 public inputs. Arkworks Groth16 0.5.0 generates genuine randomized proofs. The separate `proof02/Cargo.lock` pins its graph without changing Sprint 01's graph. The binary public proving key is retained in Git (33,457,968 bytes); routine reproduction loads it and never regenerates the setup. `setup` refuses to overwrite an existing key. Setup used OS randomness once; no setup seed or trapdoor is intentionally persisted. This is a single-party **test setup**, without a ceremony or independent audit.

The [circuit](../proof02/src/circuit.rs) proves knowledge of a 32-byte secret with a given SHA-256 commitment, computes SHA-256(secret || statement digest), and enforces `units * price = charge` and `charge + fee + refund = budget`. Units and price are 32-bit; monetary values are bounded to 62 bits. The multiplication and conservation bounds prevent field wraparound from satisfying the intended integer equations.

The public inputs are, in order, two 128-bit little-endian limbs each for the commitment, statement digest and authorization hash, followed by units, price, charge, fee, refund and budget. All 12 are constrained. A complete 256-bit digest is represented by two limbs; it is not reduced modulo the field.

The fixed statement encoding includes the full chain ID, native verifier account, token account and symbol with precision, EVM runtime account and target address, recipient, commitment, sequence, expiry and all six economic fields. Its exact byte layout is in the manifest. The native adapter reconstructs those bytes from pinned configuration and the payment; the successful native statement hash must equal the Rust result.

Proof encoding is exactly 384 bytes: G1 A (96), G2 B (192), G1 C (96), with little-endian affine coordinates. G2 uses x.c0, x.c1, y.c0, y.c1. The [native verifier](../proof02/native/verifier.cpp) enforces canonical coordinates, rejects infinity, checks the curve equation through host intrinsics, then checks subgroup membership using raw multiplication by the scalar-field order. It checks scalar canonicality, computes the public-input MSM, and compares the actual Groth16 pairing equation. Every embedded VK point is checked during local initialization. The `audit` command verifies the correspondence of the persisted PK, VK, native VK header, schema, matrix digest and suite ID.

This profile has one synthetic funded commitment and an explicit spent marker. The fixture secret `[42;32]` is intentionally public. Funding is supplied by local configuration, not a deposit membership circuit. The proof demonstrates authorization and arithmetic for that fixture; it does **not** prove actual resource consumption, external delivery or private funding membership.

## Atomic integration and rejection paths

The mutating path is native `settle` -> exSat `call` -> Solidity `accept`, inside one local native transaction. It verifies the proof, consumes the synthetic budget, records native credit/fee/refund and the spent marker, and sends the exact note/recipient/charge to the EVM fixture. The EVM fixture authenticates the reserved native sender address and independently rejects a spent note. It does not mint a real asset.

The successful result consumes 100 synthetic units once: credit 24, fee 2, refund 74. The EVM credits exactly the bound recipient with 24 and marks the same note spent. A valid proof retried after a reverted transaction succeeds; a replay after a committed transaction fails.

The final run passed **45 proof/integration checks**, **five separately classified historical guards**, and **three decoded EVM path diagnostics**. The [local receipt](../verification/sprint02/local-qualification.json) records each actual rejection string, validation path and before/after snapshot SHA-256. Snapshots include native configuration/accounting, EVM accounts, balances, nonces, code, storage and local token balances. All failed mutating tests require equal snapshots. The [command output](../verification/sprint02/local-command.txt) is the actual run output. The native verifier acceptance used 6,305 billed CPU microseconds in this run; this single observation is not a performance qualification.

| Negative test | Path exercised |
|---|---|
| Wrong suite | Metadata gate, before verifier |
| Short proof/input | Verifier envelope lengths |
| Noncanonical Fq; infinity | Verifier encoding/non-degeneracy gates |
| Off-curve G1/G2 | Host curve decoder |
| On-curve non-subgroup G1/G2 | Explicit subgroup checks, after curve acceptance |
| Noncanonical Fr | Verifier scalar encoding |
| Well-formed subgroup proof with altered A | Actual pairing equation |
| Each of 12 public inputs altered individually | Actual pairing equation, with canonical inputs |
| Chain/domain/token/symbol/EVM/target/recipient/commitment/sequence/expiry substitutions | Statement digest binding through the pairing equation |
| Native recipient/sequence/charge substitutions | Adapter recomputes statement and inputs; pairing equation fails |
| Expiry or excessive fee | Adapter policy, before verifier |
| Wrong native sender at EVM | EVM sender authorization, no verifier coverage |
| Valid proof, native writes, EVM writes then injected revert | Native and EVM state roll back together |
| Successful EVM write then invalid native proof | Pairing rejection rolls prior EVM state back |
| Native replay | Genuine proof passes, then native spent marker rejects |
| EVM replay | EVM spent marker; no verifier invocation |

Read-only exSat `exec` diagnostics decode Solidity revert reasons for caller authorization, the injected failure after EVM writes and EVM replay. They identify those paths; the separate mutating `call` tests establish rollback. Read-only diagnostics are not counted as atomic mutation tests. Sprint 01 paused/unsupported-profile guards are recorded separately and do not count as qualified verifier coverage.

## Reproduce

Run from `C:\Users\travi\bmeshasi_coding_handoff` on this Windows/WSL environment. Dependencies and toolchain are pinned in [source-build.json](../verification/sprint02/source-build.json), both Cargo locks, the existing eosjs lock and the new solc lock. CDT 4.1.1, Spring 1.2.2, Rust 1.98.1, CMake 3.31.6 and the existing Python test environment are required. No hosted service is used.

```powershell
# Genuine suite, Rust checks, native verifier build and key correspondence audit.
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/travi/bmeshasi_coding_handoff && bash proof02/tools/build.sh'
npm.cmd ci --prefix proof02/tools --ignore-scripts --no-audit --no-fund
node proof02/tools/build-evm.cjs
node proof02/tools/build-manifest.cjs
node proof02/tools/local.cjs
node tools/sprint02-evm-correspondence.cjs

# Independent read-only public source/build/deployment audit.
node proof02/tools/correspondence.cjs
```

`build-manifest.cjs` must follow successful builds. The local runner refuses changed source/key/dependency files or changed artifacts after that manifest is recorded. It checks the pinned Spring binary and exSat WASM, then compares each local deployed WASM and serialized ABI to the build. The receipt also records EVM creation bytecode, immutable constructor arguments, target, deployed code table and final storage. The [offline EVM correspondence audit](../verification/sprint02/evm-correspondence.json) recompiles with immutable-reference metadata, fills the exact constructor addresses, and compares all **1,075 bytes** against recorded deployed runtime code. Both SHA-256 values are `59a9adbf77e212a85d39430f6d8c2a0f03f29c04ab61a5377c6032c2c28c8db1`; [actual output](../verification/sprint02/evm-correspondence-command.txt). The chain ID, local transaction IDs and randomized proof bytes vary by run; the suite, verification key, source and compiled artifacts remain pinned.

For just a new proof over the saved statement, run from WSL in the project root:

```bash
target/proof02/release/silentpay-proof02 audit
target/proof02/release/silentpay-proof02 prove verification/sprint02/request.json target/proof02-reproved.json
```

The saved statement's expiry eventually prevents *settlement*, while mathematical proof verification remains reproducible. The full local runner creates a fresh current statement. Do not run `setup` during reproduction.

Checkpoint tests can be repeated with `bash tools/verify-rust.sh`, the baseline Python commands and `node tools/spike/local.cjs` from `docs/IMPLEMENTATION.md`. Those older helpers write into `verification/current`; Sprint 02 saved the rerun outputs under `verification/sprint02/reproduction` and restored all original checkpoint receipts afterward. The new suite writes only under `verification/sprint02` and ignored `target`.

## Implemented, simulated and missing

| Implemented and executed | Simulated or still missing |
|---|---|
| Genuine SHA-256/authorization/arithmetic R1CS and Groth16 proof | Private funded-note membership, full receipt/measurement circuit and authenticated state transitions |
| Exact suite/key/schema pins; real native pairing and subgroup checks | Production ceremony, independent cryptographic audit, fuzzing and scale/DoS qualification |
| Canonical statement binding and exact integer native/EVM credit | Real deposits, withdrawals, escape/data-availability paths, reserve/claim lifecycle and transferable refunds |
| Replay guards and both directions of local cross-runtime rollback | Public deployment qualification, external-chain atomicity and consensus/finality proof |
| Independent current/historical public code and ABI correspondence | Production custody, private witness persistence and RPC trust minimization |

Four new circuit tests pass: conservation/multiplication, monetary bounds, all public-input constraints and non-wrapping u32 arithmetic. Format, clippy and locked release builds pass. The first integrated run exposed a harness boolean representation mismatch (`1` versus `true`), fixed without changing contract behavior. A later diagnostic used the wrong Spring return-value field; it now reads the pinned runtime's `return_value_hex_data`. Neither diagnostic error is counted as successful coverage.

The public `native/proof_router.hpp` and core proof boundary retain their Sprint 01 rejection behavior. This suite does not enable them or grant deposit authority.

## Upstream and license record

No third-party runtime source was patched. Exact upstream revisions and their existing license findings are preserved in [EXSAT-SPIKE.md](EXSAT-SPIKE.md) and [pins.json](../tools/spike/pins.json).

- Arkworks Groth16 0.5.0 and associated pinned crates: MIT OR Apache-2.0 package licenses. APIs checked against [Groth16 0.5.0 documentation](https://docs.rs/ark-groth16/0.5.0/ark_groth16/struct.Groth16.html); [upstream MIT license](https://github.com/arkworks-rs/groth16/blob/v0.5.0/LICENSE-MIT). Dependency source is fetched through Cargo, not copied into the project.
- CDT 4.1.1 BLS API checked against its [official header](https://github.com/AntelopeIO/cdt/blob/v4.1.1/libraries/eosiolib/core/eosio/crypto_bls_ext.hpp). Spring's [v1.2.2 host implementation](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/webassembly/crypto.cpp) and its exact BLS submodule [472a13f1f8bb225078f1aa3a4bc27cd5d8450402](https://github.com/AntelopeIO/bls12-381/tree/472a13f1f8bb225078f1aa3a4bc27cd5d8450402) show curve-only decoding and non-reducing scalar multiplication. These were inspected, not copied. Executed non-subgroup vectors confirm the distinction on the pinned binary.
- exSat at `c5fcfd1bcda9c414ab05c3d6116070b9e9ae3c47` and Spring 1.2.2 have BSL/custom grant considerations recorded in Sprint 01; this is non-production local testing, not an unrestricted-MIT claim.
- Solidity compiler 0.8.30 is pinned to `0.8.30+commit.73712a01.Emscripten.clang`; target EVM is explicitly `paris`, avoiding its newer default. [Official release](https://www.soliditylang.org/blog/2025/05/07/solidity-0.8.30-release-announcement/). The npm solc wrapper carries MIT; the Solidity compiler source has [GPLv3](https://github.com/ethereum/solidity/blob/v0.8.30/LICENSE.txt). The original entitlement fixture declares MIT and does not copy compiler source. npm integrity pins are retained.
