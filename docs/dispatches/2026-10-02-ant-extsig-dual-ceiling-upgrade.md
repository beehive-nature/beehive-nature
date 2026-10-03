# Dispatch: Autonomi Upgrade & Dual-Ceiling Enforcement for External-Signer Memory Writes (ops/ant-extsig)

- **Date:** 2026-10-02
- **Lane:** Lane 2 ("ANT upload code-disabled" / Dual-Ceiling Upgrade)
- **Status:** GREEN — Built, 5/5 unit tests passed, live 8-node swarm + embedded Anvil LocalDevnet proof passed, exact token approval verified, pre-send gas binding verified, roundtrip byte-identical verified.
- **Branch:** `lane/ant-extsig-dual-ceiling`
- **PR:** [#324](https://github.com/beehive-nature/beehive-nature/pull/324)

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
evmlib = { version = "0.10.0", features = ["external-signer"] }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
hex = "0.4"
alloy = { version = "1.0.32", features = ["rpc-types", "provider-http"] }

[profile.dev]
debug = 0

[workspace]
```

- Pinned `ant-core` commit: `681d48f30b9de50c262ebfc10cce6111cfc878b1` on `main`. PUBLIC-CONSTANT recorded commit.
- Pinned `ant-node`: `=0.21.0`.
- Pinned `ant-protocol`: `=3.1.0`.
- Pinned `evmlib`: `0.10.0` with `external-signer` feature enabled.
- Pinned `alloy`: `1.0.32`.
- Added isolated `[workspace]` table so the crate builds independently without inheriting root-level workspace settings.

---

## 3. Ceiling Enforcement, Pre-Send Binding, & Review Resolution

Following PR #324 read-only review comments from Claude Fable 5.1, the implementation addresses all review findings:

### 3.1 Merkle Storage Quote Derivation
- `ExternalPaymentInfo::Merkle` batches carry depth and candidate pool commitments rather than a pre-calculated total.
- The harness calls `evm_network.estimate_merkle_payment_cost(b.depth, &b.pool_commitments)` for each batch in `prepared_batches`, which executes the exact Solidity PaymentVault formula (`median16(pool_prices) * 2^depth, max across pools`).
- The sum of these estimates in atto-ANT is verified against `MAX_STORAGE_CEILING_ATTO_ANT` at `[3/6]` before any payment is attempted, and re-verified at `[5/6]` immediately prior to `finalize_upload`.

### 3.2 Exact Token Approval (No `U256::MAX`)
- `evmlib`'s internal `pay_for_quotes` approves `U256::MAX` if allowance is short. Under a 2.5 ANT ceiling, an unlimited approval is inconsistent.
- The harness checks `signer.token_allowance(vault_address)` prior to payment. If insufficient, it submits an approval for **exactly** `Amount::from(quote_sum_atto)`.
- The approval transaction is pre-send gas-checked and its on-chain receipt gas is aggregated into `total_gas_wei`.
- When `pay_for_quotes` subsequently executes, existing allowance satisfies the requirement, preventing `evmlib` from broadcasting an unlimited approval.

### 3.3 Pre-Send Gas Check & Driver Binding
- Before any transaction is signed or broadcasted:
  - Calldata is generated via `evmlib::external_signer::pay_for_quotes_calldata` (wave) or `pay_for_merkle_tree_calldata` (merkle).
  - Gas and EIP-1559 fees are estimated via the provider (`provider.estimate_gas` and `provider.estimate_eip1559_fees`).
  - Worst-case gas limit is calculated as `estimated_gas * 120 / 100`.
  - Worst-case commitment is evaluated as `worst_case_gas_limit * fees.max_fee_per_gas`.
  - If `fees.max_fee_per_gas > max_fee_limit` (the LimitedAuto cap) or `worst_case_commitment > MAX_GAS_CEILING_WEI`, the harness halts and refuses pre-send with exact overage.
- Driver-level binding: `MaxFeePerGas::LimitedAuto(MAX_GAS_CEILING_WEI / 250_000)` enforces the fee ceiling inside `evmlib`'s `send_transaction_with_retries`.
- Post-send receipt: `verify_transaction_gas` verifies the mined `GasInfo` and receipts.

### 3.4 Arbitrum One Fee Schedule Citation & Anvil Calibration
- On Arbitrum One L2, the Nitro fee model sets a minimum base fee of 0.01 Gwei (10,000,000 wei) up to ~0.1 Gwei in standard conditions (cite: Offchain Labs Arbitrum Nitro gas docs, `https://docs.arbitrum.io/build-decentralized-apps/how-to-estimate-gas`).
- Anvil defaults to Ethereum L1 base fees (1.0 Gwei = 1,000,000,000 wei). Under 1.0 Gwei, a 220,000 gas transaction costs `> 0.00022 ETH`, artificially exceeding the ceiling.
- `ops/ant-extsig/src/bin/anvil.rs` forwards `--base-fee 100000000` (0.1 Gwei) to the underlying Anvil binary so local devnet reflects Arbitrum One production conditions.
- If the chain's base fee ever spikes above the cap, the pre-send check cleanly refuses before broadcasting.

---

## 4. Unit Test Battery (`cargo test`)

`cargo test --manifest-path ops/ant-extsig/Cargo.toml` executes 5 unit tests covering storage, Merkle cost estimation, and gas bounds:

```
running 5 tests
test tests::test_gas_ceiling_within_limit ... ok
test tests::test_merkle_cost_estimation_empty ... ok
test tests::test_gas_ceiling_exceeded_refuses ... ok
test tests::test_storage_ceiling_exceeded_refuses ... ok
test tests::test_storage_ceiling_within_limit ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Refusal verification:
- Storage refusal: `REFUSE: storage amount 2500000000000001000 atto-ANT exceeds ceiling 2500000000000000000 atto-ANT (2.5 ANT) by 1000 atto-ANT at test`
- Gas refusal: `REFUSE: gas ceiling exceeded for test: worst-case gas commitment 250000000000000 wei exceeds ceiling 200000000000000 wei (0.0002 ETH) by 50000000000000 wei`

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
      e.g. quote hash 78e039003bef2329351f1d8b892ce995ced03865bfb4edc4ea8ed29970c92258 (PUBLIC-CONSTANT quote hash)
      e.g. quote hash b46c13e37d058e924f29e0167ae4735d85439a4876bb7a4b267e9cdb64dacd7a (PUBLIC-CONSTANT quote hash)
[4/6] member wallet paying (wave arm)...
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      pre-send gas check [token_approval]: est_gas=46394 (buffer_limit=55672) * max_fee=178247123 wei = 9923373831656 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      exact approval tx submitted: 0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958 (PUBLIC-CONSTANT approval tx)
      approval confirmed: gas_used=46394, cost=3650732771834 wei
      pre-send gas check [wave_batch_quotes]: est_gas=188499 (buffer_limit=226198) * max_fee=157379521 wei = 35598932891158 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      gas check [wave_batch_quotes]: gas_limit=226198 * max_fee_per_gas=157379521 wei = 35598932891158 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      paid 4 quote payments, actual gas used: 183699, max gas commitment: 35598932891158 wei
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
  "total_gas_commitment_wei": "39249665662992",
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 25a2a3..65abf8, src_hash: 14946e..f878d4, ",
  "winner_hashes": []
}
```

- DataMap address: `1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a`. PUBLIC-CONSTANT testnet DataMap address.
- Member payer address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`. PUBLIC-CONSTANT testnet address.
- Approval transaction: `0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958`. PUBLIC-CONSTANT approval tx hash.
- Storage quote: `46875000000000000` atto-ANT ($\approx 0.0469$ ANT), safely within 2.5 ANT ceiling.
- Gas commitment across both transactions (approval + payment): `39249665662992` wei ($\approx 0.0000392$ ETH), safely within 0.0002 ETH ceiling.
- Verified byte-identical round-trip download after full client interrupt and recreation.

---

## 6. Next Steps & Merge Gate

1. **Re-Review**: Updated HEAD pushed to branch `lane/ant-extsig-dual-ceiling` for Claude Fable 5.1 exact-HEAD re-review on [PR #324](https://github.com/beehive-nature/beehive-nature/pull/324).
2. **Production Gate**: Keep `/api/preserve/upload` code-disabled in `tools/genealogy/preserve-service.mjs` until Fable 5.1 review confirms receipts and the founder performs a mainnet test payment.
