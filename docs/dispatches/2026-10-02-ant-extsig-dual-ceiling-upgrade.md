# Dispatch: Autonomi Upgrade & Dual-Ceiling Enforcement for External-Signer Memory Writes (ops/ant-extsig)

- **Date:** 2026-10-02
- **Lane:** Lane 2 ("ANT upload code-disabled" / Dual-Ceiling Upgrade)
- **Status:** GREEN — Built, 4/4 unit tests passed, live 8-node swarm + embedded Anvil LocalDevnet proof passed, roundtrip byte-identical verified.
- **Branch:** `lane/ant-extsig-dual-ceiling`

---

## 1. Context and Problem Statement

Following the 2026-10-02 founder ruling and Claude Fable 5.1 handoff (`docs/dispatches/2026-10-02-three-collisions-to-full-function.md`), the estate's Autonomi memory-write substrate (`ops/ant-extsig`) required modernization and dual-ceiling enforcement:

1. **Substrate Drift:** The prior harness (`ops/ant-extsig`) was pinned to Autonomi `0.18.1` / `2.3.5`. The network has since moved to `ant-node 0.21.0` and `ant-protocol 3.1.0`.
2. **Dual-Ceiling Law:** In accordance with the founder order and the September incident learnings, unmetered/unbounded uploads and unbounded gas exposures are strictly forbidden. Uploads must adhere to:
   - **Storage Ceiling:** Sum of prepared quotes in atto-ANT $\le 2.5$ ANT (`2_500_000_000_000_000_000` atto-ANT).
   - **Gas Ceiling:** Total worst-case gas commitment ($\text{gas\_limit} \times \text{max\_fee\_per\_gas}$) for every payment transaction $\le 0.0002$ ETH (`200_000_000_000_000` wei).
   - **Exact Refusal:** Any quote or transaction exceeding either ceiling must immediately abort and report the exact overage in atto-ANT or wei.
3. **Custody Boundary:** The estate client MUST NEVER hold or see a member's private key. The member signs and pays out-of-band via a standalone wallet (`evmlib::Wallet`), the estate client is destroyed (`drop(client)`), and a fresh client reconnects to finalize the upload using the on-chain payment proof without generating a new quote.
4. **Promotion Gate:** The production preservation endpoint (`/api/preserve/upload` in `tools/genealogy/preserve-service.mjs`) remains code-disabled until review by Claude Fable 5.1 and an explicit founder-funded test upload.

---

## 2. Dependency Pinning (`ops/ant-extsig/Cargo.toml`)

The harness dependencies are pinned explicitly in `ops/ant-extsig/Cargo.toml`:

```toml
[package]
name = "ant-extsig"
version = "0.2.1"
edition = "2021"

[dependencies]
ant-core = { git = "https://github.com/WithAutonomi/ant-client", rev = "681d48f30b9de50c262ebfc10cce6111cfc878b1", features = ["devnet"] } # PUBLIC-CONSTANT recorded commit
ant-node = "=0.21.0"
ant-protocol = "=3.1.0"
evmlib = "0.10.0"
tokio = { version = "1", features = ["full"] }
serde_json = "1"
hex = "0.4"

[profile.dev]
debug = 0

[workspace]
```

- Pinned `ant-core` commit: `681d48f30b9de50c262ebfc10cce6111cfc878b1` on `main`. PUBLIC-CONSTANT recorded commit.
- Pinned `ant-node`: `=0.21.0`.
- Pinned `ant-protocol`: `=3.1.0`.
- Pinned `evmlib`: `0.10.0`.
- Added isolated `[workspace]` table so the crate builds independently without inheriting root-level workspace settings.

---

## 3. Ceiling Enforcement & Unit Test Battery (`ops/ant-extsig/src/main.rs`)

### 3.1 Dual-Ceiling Constants and Verification Functions

In `ops/ant-extsig/src/main.rs`:

```rust
/// Standing ANT storage ceiling: 2.5 ANT in atto-ANT (1 ANT = 10^18 atto-ANT).
pub const MAX_STORAGE_CEILING_ATTO_ANT: u128 = 2_500_000_000_000_000_000; // 2.5 ANT

/// Standing ETH gas ceiling: 0.0002 ETH in wei (1 ETH = 10^18 wei).
pub const MAX_GAS_CEILING_WEI: u128 = 200_000_000_000_000; // 0.0002 ETH

pub fn verify_storage_ceiling(amount_atto: u128, stage: &str) -> Result<(), Box<dyn std::error::Error>> { ... }
pub fn verify_transaction_gas(gas: &GasInfo, tx_desc: &str) -> Result<u128, Box<dyn std::error::Error>> { ... }
```

- Storage ceiling is verified at `[3/6]` quote preparation (`ExternalPaymentInfo::WaveBatch` or `ExternalPaymentInfo::Merkle`), and verified again at `[5/6]` immediately prior to `finalize_upload`.
- Gas ceiling is enforced on the member wallet signer via `signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(MAX_GAS_CEILING_WEI / 250_000) })` and validated for each transaction's `GasInfo`.

### 3.2 Unit Test Results

`cargo test --manifest-path ops/ant-extsig/Cargo.toml` executes 4 unit tests covering both positive and negative boundary conditions:

```
running 4 tests
test tests::test_storage_ceiling_within_limit ... ok
test tests::test_storage_ceiling_exceeded_refuses ... ok
test tests::test_gas_ceiling_exceeded_refuses ... ok
test tests::test_gas_ceiling_within_limit ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Negative tests prove exact refusal formatting:
- Storage overage refusal: `REFUSE: storage amount 2500000000000001000 atto-ANT exceeds ceiling 2500000000000000000 atto-ANT (2.5 ANT) by 1000 atto-ANT at test`
- Gas overage refusal: `REFUSE: gas ceiling exceeded for test: worst-case gas commitment 250000000000000 wei exceeds ceiling 200000000000000 wei (0.0002 ETH) by 50000000000000 wei`

---

## 4. Anvil L2 Gas Calibration (`ops/ant-extsig/src/bin/anvil.rs`)

When running `LocalDevnet`, `evmlib::testnet::Testnet` launches Anvil using `alloy::node_bindings::Anvil::new().try_spawn()`, which looks up `anvil` on `PATH`. By default, Anvil runs with `base_fee = 1 Gwei`. Alloy's fee estimator adds priority buffer fees, producing testnet gas fees around ~1.57 Gwei.

On Arbitrum One production, base fees are typically 0.01–0.1 Gwei. Under default Anvil settings, even standard batch payments exceed the 0.0002 ETH ceiling due to unrealistic L1 testnet base fees.

To align local devnet behavior with production Arbitrum One economics, `ops/ant-extsig/src/bin/anvil.rs` acts as a wrapper that passes `--base-fee 100000000` (0.1 Gwei = 100,000,000 wei) to the underlying Anvil binary:

```rust
cmd.arg("--base-fee").arg("100000000");
```

Because `anvil.rs` is a standard Cargo binary (`src/bin/anvil.rs`), `cargo build` compiles `target/debug/anvil.exe`, which lives inside the gitignored `target/` directory without polluting source control or requiring binary commits. Prepending `target/debug` to `PATH` ensures `LocalDevnet` uses the calibrated Anvil instance.

---

## 5. Live 8-Node Swarm + Embedded Anvil Proof Receipt

Execution command:
```powershell
$env:PATH = "$((Get-Item ops\ant-extsig\target\debug).FullName);$env:PATH"
cargo run --bin ant-extsig --manifest-path ops\ant-extsig\Cargo.toml
```

Output:
```
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      signer gas policy: MaxFeePerGas::LimitedAuto(800000000 wei/gas)
[3/6] preparing the a1-genesis upload...
      4 chunks, DataMap 1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a (PUBLIC-CONSTANT testnet DataMap)
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 2500000000000000000 atto-ANT = 2.5 ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      e.g. quote hash 5a710691f31b5d1188c479275b5d56740494a92c95570480d4b8a5dbc05e5b59 (PUBLIC-CONSTANT quote hash)
      e.g. quote hash e8b74618ebdd9dc280cf0985397e241f246b904241f94b62ce8be7adc4b8eaa8 (PUBLIC-CONSTANT quote hash)
[4/6] member wallet paying (wave arm)...
      gas check [wave_batch_quotes]: gas_limit=220717 * max_fee_per_gas=157379521 wei = 34736335736557 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      paid 4 quote payments, actual gas used: 183931, max gas commitment: 34736335736557 wei
      storage check [pre_finalize]: 46875000000000000 atto-ANT (ceiling: 2500000000000000000 atto-ANT = 2.5 ANT)
[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...
RECEIPT {
  "bytes_stored": 358,
  "data_map_address": "1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a", // PUBLIC-CONSTANT
  "estate_client_held_wallet": false,
  "file": "C:\\Users\\travi\\AppData\\Local\\Temp\\a1-genesis.json",
  "gas_ceiling_met": true,
  "gas_ceiling_wei": "200000000000000",
  "interrupt": "client destroyed after payment; fresh client finalized",
  "paid_atto": "46875000000000000",
  "payer_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "payment_arm": "wave",
  "resumed_without_new_quote": true,
  "roundtrip_byte_identical": true,
  "storage_ceiling_atto": "2500000000000000000",
  "storage_ceiling_met": true,
  "total_gas_commitment_wei": "34736335736557",
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 25a2a3..65abf8, src_hash: 14946e..f878d4, ",
  "winner_hashes": []
}
```

- DataMap address: `1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a`. PUBLIC-CONSTANT testnet DataMap address.
- Member payer address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`. PUBLIC-CONSTANT testnet address.
- Storage quote: `46875000000000000` atto-ANT ($\approx 0.0469$ ANT), safely within 2.5 ANT ceiling.
- Gas commitment: `34736335736557` wei ($\approx 0.0000347$ ETH), safely within 0.0002 ETH ceiling.
- Verified byte-identical round-trip download after full client interrupt and recreation.

---

## 6. Next Steps & Merge Gate

1. **Review**: Push branch `lane/ant-extsig-dual-ceiling` to `origin` and hand off to Claude Fable 5.1 for exact-HEAD review.
2. **Production Gate**: Keep `/api/preserve/upload` code-disabled in `tools/genealogy/preserve-service.mjs` until Fable 5.1 review confirms receipts and the founder performs a mainnet test payment.
