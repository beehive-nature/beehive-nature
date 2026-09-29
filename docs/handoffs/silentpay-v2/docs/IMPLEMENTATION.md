# Sprint 01 implementation receipt

Implemented and executed on 8 September 2026 Mountain time / 9 September UTC. Project root: `C:\Users\travi\bmeshasi_coding_handoff`; review branch `codex/silentpay-sprint01`. The original ZIP import is commit `653c80c`. The user's explicit authorization covers Jungle4 wallet use, test resources and test-contract deployment; no production deployment or repository publication was performed.

## Delivered

| Area | Implemented | Simulated or still missing |
|---|---|---|
| Rust accounting | Exact assets, bounded capabilities and delegation, exclusive reservations, integer tariffs, cumulative receipts, atomic settlement, replay and conservation | Inspectable single-process reference; no consensus or cryptographic privacy |
| Intent and fees | One signed plan, distinct leg references, per-asset budgets, sponsorship, failed-attempt caps, bounded retry, explicit conversions, b display exposure includes fees | Funded mock inventory and synthetic valuation; no real exchange or b issuance |
| Recovery | Exact original transaction binding, separate payment/delivery state, immutable durable checkpoints, replacement fee bounds and no duplicate mock execution | Actual encrypted object persistence, SDK finalization and real chain evidence readers |
| Native contract | CDT build, deployment and initialization on Jungle4; rejected transitions and rollback verified | No qualified payment circuit, production witness/prover, withdrawal/escape qualification or real deposits |
| Native/EVM spike | Unmodified pinned exSat runtime compiled and deployed to isolated Spring 1.2.2; five executed integration tests | No external-chain atomicity, generic b bridge, public EVM deployment, or real verifier integration |

The required two-route CLI reports compute as complete and paid while storage is unknown or paid/partial. A third mode demonstrates recovery to completion. Each uses separately funded native A, synthetic ANT and ETH inventories, unrelated outward session references and an explicit 125-unit prototype-b ceiling. Compute executes once and storage has one original payment submission. See the [unknown](../verification/current/demo-unknown.json), [partial](../verification/current/demo-partial.json) and [recovered](../verification/current/demo-recovered.json) receipts.

## Executed checks

| Command / check | Actual result | Evidence |
|---|---|---|
| `python -m unittest discover -s tests -v` from `baseline/silentpay_v2` | 59 passed, including its randomized simulations | [Python baseline](../verification/current/python-baseline-tests.txt) |
| `python baseline/bmeshasi_vnext/test_contracts.py` | 18 passed | [Schema baseline](../verification/current/bmesh-vnext-tests.txt) |
| `python tools/verify-manifest.py` | All 41 original SHA-256 entries match | [Manifest](../verification/current/manifest.txt) |
| `python tools/golden.py` | Independent Python canonical/hash/signature/binary vectors generated | [Golden log](../verification/current/golden.txt) |
| `cargo fmt --all --check` | Passed | [Format output](../verification/current/rust-format.txt) |
| `cargo clippy --locked --all-targets -- -D warnings` | Passed | [Clippy](../verification/current/rust-clippy.txt) |
| `cargo test --locked` | 40 passed: 17 accounting, 15 recovery/fees, 8 two-route; includes 1,000 conservation runs | [Rust tests](../verification/current/rust-tests.txt) |
| `cargo run --locked --bin silentpay-demo -- <mode> <new-checkpoint>` | All three modes passed durable save/load and invariant checks | Demo JSON linked above |
| CDT 4.1.1 native build | WASM and ABI produced | [Build](../verification/current/native-build-fixed.txt) |
| `verify-deployment.ps1` | Five Jungle rejection/rollback cases; independent deployed-code/config verification | [Jungle probes](../verification/current/jungle-contract-tests.txt), [init rollback](../verification/current/jungle-reject-initialize-rollback.txt), [two endpoints](../verification/current/jungle-verified.json) |
| `node tools/spike/local.cjs` | Five local native/EVM integration tests passed | [Local spike](../verification/current/local-spike.json) |

All Rust and demo checks can be repeated with `bash tools/verify-rust.sh` from WSL. This requires the project's test venv with the baseline requirements installed. Toolchain: Rust 1.98.1, Python 3.14.4, CDT 4.1.1, CMake 3.31.6; Rust and eosjs dependency locks are included. Local native/EVM reproduction is documented in [EXSAT-SPIKE.md](EXSAT-SPIKE.md).

## Jungle4 deployment

Account: **bcodexjungle**. [Explorer](https://monitor.jungletestnet.io/#accountOverview:bcodexjungle).

Chain ID: `73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d`.

| Operation | Transaction / result |
|---|---|
| Buy 50.0000 test EOS of RAM | `9cdf992f78b7d28a8434337bca39699a7744e990e8a94ac3a95e3c41ba8e4195` |
| Buy 40.0000 test EOS of RAM | `7b8064df3a96274a199c6a3046a69e0d15eae3489b62b5167ab589209894a8f1` |
| Atomic `setcode` + `setabi` | `2893570ff01672496faec10fd2c50a3b7dec36bf8d88faea68d7fc23d834e21f`, block 285887764 |
| Successful initialization | `ea95757bdc6b779cc72a35dab34e2373d3a729d28528383448419597aac64dbf`, block 285888377 |
| Contract code SHA-256 | `53cb0c7d9b48c927bfee7e9b5862b1fce9a4f6628b569d9e12888b5cdccdfead`, 39,754 bytes |
| Final observed balances | 100.0000 A, 10.0000 EOS, 100.0000 JUNGLE |
| RAM after initialization | 445,190 bytes quota; 403,269 bytes used |

Greymass and CryptoLions independently returned the same code hash, initialized domain and paused zero-escrow config. Their reported irreversible blocks exceeded both deployment and initialization blocks. Their RPC software identified itself as v1.1.5 and v1.2.2 respectively; the receipt does not infer one uniform node release for the whole network. This is RPC-based verification, not a light-client finality proof.

The rejected initialization transaction first wrote a config and then attempted unpause. The unpause failed and a subsequent table read found no config. A separate successful transaction then initialized the contract. Later unpause, unqualified Groth16 adapter, unknown suite and reinitialization attempts rejected; config and zero escrow remained unchanged. The local test additionally exercised the actual token transfer notification and confirmed that a refused deposit rolled back sender and receiver token balances.

The public test contract deliberately remains paused. Test software authorization signatures cannot enable deposits. No `eosio.code` authority was added to the public account. The deployment helper pins chain/account/active key, loads only the active key through a local DPAPI-to-stdin path, and records the signed transaction ID before submission. Owner material is not passed to the signer. An unknown broadcast must be reconciled before retrying.

`bzcodejungle` belongs to zCode and was reported funded. `bgrokbottest` belongs to Grok and was reported funded/powered, with its own seven-hour faucet process. Their keys and funds were not used. Codex's previously scheduled one-time six-hour faucet attempt remains a separate task automation.

## Corrections and limitations found

- The original native source did not compile with its targeted CDT: `eosio::literals` is absent. The implementation copy removes that line; baseline source is unchanged. CDT also omits two empty legacy ABI vectors required by eosjs; the deployment serializer supplies empty `error_messages` and `abi_extensions`.
- Delegated refunds now retain scope, preventing unused funds from broadening a child capability. EVM amounts refuse unsafe native narrowing, and external evidence has no caller-supplied “verified” boolean.
- Cumulative fee/display exposure includes ETH and native resource fees. RWA display values do not authorize spending. Unknown settlement cannot reset to a fresh purchase; completed compute is preserved through storage failure.
- Python/Rust canonical serialization agrees on Unicode including DEL. Durable checkpoint publication refuses an existing destination atomically, including a competing writer.
- The local exSat `exec` path is read-only EVM execution followed by a native callback. The mutating `call` path uses native authorization and abort-on-failure; both were tested separately.

Remaining production work is explicit: qualified proof and exit/data-availability paths, authenticated deployment manifests, real storage/payment adapters, protected private persistence, hardware/identity integration and broader adversarial and scale qualification. Passing this milestone does not establish anonymity, Sybil resistance, cryptographic soundness or population-scale performance.
