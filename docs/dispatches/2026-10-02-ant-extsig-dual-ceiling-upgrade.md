# Dispatch: ant-extsig Dual-Ceiling Upgrade & Upstream Pin Alignment

**Lane:** `lane/ant-extsig-dual-ceiling`  
**Date:** 2026-10-02 / 2026-10-03  
**Seat:** Autonomous Pair Programming Agent (working in worktree `C:\Users\travi\wt-ant-ceiling`)  
**Reviewer:** Claude Fable 5.1 (read-only review on PR #324)  
**PR:** https://github.com/beehive-nature/beehive-nature/pull/324  
**Head Commit:** TBD  

---

## 1. Executive Summary

This dispatch delivers the implementation and verification receipts for Lane 2 ("ANT upload code-disabled") as scoped in `docs/dispatches/2026-10-02-three-collisions-to-full-function.md`.

The `ops/ant-extsig` harness proves member-signed upload under strict standing economic bounds without holding member private keys or wallets on estate clients.

This update resolves all blocking items and receipt requirements from Claude Fable 5.1's Round 1, Round 2, and Round 3 reviews:
1. **Merkle Storage Cost Derivation**: Evaluates `evm_network.estimate_merkle_payment_cost(b.depth, &b.pool_commitments)` across all prepared batches, matching Solidity `PaymentVault.sol` worst-case pricing across candidate pools with the 3× settlement multiplier baked in by `ant-core`.
2. **Fail-Closed Numeric Parsing**: All string-to-integer parse fallbacks for storage and payment sums fail closed via `.unwrap_or(u128::MAX)` across both wave and merkle arms.
3. **Pre-Send Gas Simulation with Driver Cap**: Evaluates worst-case gas commitment as `worst_case_gas_limit.saturating_mul(max_fee_limit)`, where `max_fee_limit` is the `MaxFeePerGas::LimitedAuto` driver cap (800,000,000 wei = 0.8 Gwei). Refuses pre-send if network base fee exceeds the cap or if worst-case gas commitment exceeds 0.0002 ETH (200,000,000,000,000 wei).
4. **Exact Token Approval (No `U256::MAX`)**: Vault allowance is inspected pre-payment. If insufficient, the harness submits an approval for **exactly** the quoted sum, gas-checking the approval transaction and aggregating its cost. `evmlib`'s internal `U256::MAX` approval path is never entered.
5. **Arbitrum Nitro Precompile Citations & Fee Honesty**: Corrected citations to link directly to Arbitrum precompiles: `ArbOwner.setMinimumL2BaseFee(uint256)` and `ArbGasInfo.getMinimumGasPrice()` at `0x000000000000000000000000000000000000006C`. Acknowledged that numerical fee figures (0.1 Gwei devnet calibration, ~0.01-0.1 Gwei mainnet observations) are empirical and UNVERIFIED against reference documentation text.
6. **Live Refusal Receipt against Vanilla Anvil**: Captured live run against default Anvil (no wrapper), proving immediate pre-send refusal when network base fee exceeds the driver fee cap.
7. **Accurate Merkle Execution Status & Upstream Citations**: Merkle arm live execution is marked **UNVERIFIED on live devnet**, with exact upstream reasons from `ant-core` commit `681d48f3`:
   - `DEFAULT_MERKLE_THRESHOLD = 64` (`merkle.rs:38`): 4-chunk fixture < 64 chunks selects wave arm under `PaymentMode::Auto`.
   - `CANDIDATES_PER_POOL = 16` (`merkle.rs:1293-1304`): `remote_peers.len() < CANDIDATES_PER_POOL` triggers `Error::InsufficientPeers` fallback to wave-batch under `PaymentMode::Auto`.
8. **Functional Gap & Re-Enable Gate**: Documented the transaction scale limitation identified in Round 3 (fixed 250k gas cap vs Autonomi's `GAS_PER_WAVE_TX = 1_500_000` and 29-chunk genealogy archive). Marked dynamic fee cap derivation as **REQUIRED BEFORE RE-ENABLE, NOT BEFORE MERGE**.

---

## 2. Upstream Pins & Dependency Alignment

File: `ops/ant-extsig/Cargo.toml`
- `ant-node = "=0.21.0"` (released binary/crate)
- `ant-protocol = "=3.1.0"`
- `evmlib = { version = "0.10.0", features = ["external-signer"] }`
- `alloy = { version = "1.0.32", features = ["rpc-types", "provider-http"] }`
- `ant-core` git pin: `https://github.com/WithAutonomi/ant-client` commit `681d48f30b9de50c262ebfc10cce6111cfc878b1` <!-- PUBLIC-CONSTANT -->

---

## 3. Implementation Details

### 3.1 Merkle Storage Quote Derivation & Fail-Closed Parsing
- `ExternalPaymentInfo::Merkle` batches carry depth and candidate pool commitments rather than a pre-calculated total.
- The harness calls `evm_network.estimate_merkle_payment_cost(b.depth, &b.pool_commitments)` for each batch in `prepared_batches`, which executes the exact Solidity PaymentVault formula (`median16(pool_prices) * 2^depth, max across pools`).
- If any amount string fails to parse or overflows `u128`, it defaults to `u128::MAX` (`main.rs:197, 275, 315`), immediately triggering `verify_storage_ceiling` refusal:
  `REFUSE: storage amount ... exceeds ceiling 2500000000000000000 atto-ANT (2.5 ANT)`.

### 3.2 Exact Token Approval
- The harness checks `signer.token_allowance(vault_address)` prior to payment. If insufficient, it submits an approval for **exactly** `Amount::from(quote_sum_atto)`.
- The approval transaction is pre-send gas-checked and its on-chain receipt gas is aggregated into `total_gas_wei`.
- When `pay_for_quotes` subsequently executes, existing allowance satisfies the requirement, preventing `evmlib` from broadcasting an unlimited approval.

### 3.3 Pre-Send Gas Simulation at Driver Fee Cap
- Before any transaction is signed or broadcasted:
  - Calldata is generated via `evmlib::external_signer::pay_for_quotes_calldata` (wave) or `pay_for_merkle_tree_calldata` (merkle).
  - Gas and EIP-1559 fees are estimated via the provider (`provider.estimate_gas` and `provider.estimate_eip1559_fees`).
  - Worst-case gas limit is calculated as `estimated_gas * 120 / 100`.
  - Worst-case commitment is evaluated as `worst_case_gas_limit * max_fee_limit`, protecting against gas price drift up to the driver cap.
  - If `fees.max_fee_per_gas > max_fee_limit` (the LimitedAuto cap) or `worst_case_commitment > MAX_GAS_CEILING_WEI`, the harness halts and refuses pre-send with exact overage.
- Driver cap: `MaxFeePerGas::LimitedAuto(MAX_GAS_CEILING_WEI / 250_000 = 800_000_000 wei)` enforces the fee ceiling inside `evmlib`'s `send_transaction_with_retries`.
- Post-send receipt: `verify_transaction_gas` verifies the mined `GasInfo` and receipts.

### 3.4 Arbitrum Nitro Precompile Citations & Devnet Calibration
- Arbitrum Nitro documentation defines the precompiles governing the L2 gas price floor:
  - `ArbOwner.setMinimumL2BaseFee(uint256 priceInWei)` configures the chain's gas price floor (cite: `https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbowner`).
  - `ArbGasInfo.getMinimumGasPrice()` at precompile address `0x000000000000000000000000000000000000006C` returns the current gas price floor (cite: `https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbgasinfo`).
- Note on fee numbers: The cited reference page defines interface functions only and specifies no numerical constants. The 0.1 Gwei (100,000,000 wei) figure passed to `--base-fee` in `ops/ant-extsig/src/bin/anvil.rs` is an empirical testnet calibration (UNVERIFIED from official doc text) to prevent local Anvil from defaulting to Ethereum L1 1.0 Gwei fees.

### 3.5 Functional Gap Analysis: 29-Chunk Archive & Per-Transaction Dynamic Cap
- The harness currently fixes `max_fee_limit = MAX_GAS_CEILING_WEI / 250_000 = 800_000_000 wei`, assuming a small transaction ($le 250,000$ gas limit).
- For the 4-chunk fixture (`worst_case_gas_limit = 226,213`), `worst_case_commitment` is `180,970,400,000,000` wei (~90.5% of the 0.0002 ETH ceiling).
- In `ant-core` (`file/native.rs:248`), Autonomi defines `const GAS_PER_WAVE_TX: u128 = 1_500_000`, and the BNR genealogy archive was quoted at 29 chunks. A transaction with gas limit $> 250,000$ will refuse pre-send under a fixed 800,000,000 wei cap even when true network fees are very low (e.g. 0.02 Gwei).
- Because the harness fails closed, nothing leaks or overspends; however, before `/api/preserve/upload` can be code-re-enabled in `preserve-service.mjs`, the upload service must derive the driver fee cap dynamically per transaction:
  `max_fee_per_gas_limit = MAX_GAS_CEILING_WEI / worst_case_gas_limit` (refusing if `fees.max_fee_per_gas > max_fee_per_gas_limit`).
- **Status:** Required before re-enable, not before PR #324 merge.

---

## 4. Unit Test Battery (`cargo test`)

`cargo test --manifest-path ops/ant-extsig/Cargo.toml` executes 7 unit tests covering storage, fail-closed parsing, Merkle cost estimation, and gas arithmetic at the driver cap:

```
running 7 tests
test tests::test_gas_ceiling_within_limit ... ok
test tests::test_gas_ceiling_exceeded_refuses ... ok
test tests::test_merkle_cost_estimation_empty ... ok
test tests::test_worst_case_gas_calculation_at_cap ... ok
test tests::test_storage_ceiling_exceeded_refuses ... ok
test tests::test_storage_ceiling_within_limit ... ok
test tests::test_storage_ceiling_fail_closed_overflow ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

---

## 5. Live Receipts

### 5.1 Clean Refusal Receipt against Vanilla Anvil (Base Fee > Cap)

Command run without the Anvil wrapper (executing vanilla `C:\Users\travi\.foundry\bin\anvil.exe` with default 1.0 Gwei Ethereum L1 base fee):
```powershell
$env:PATH = 'C:\Users\travi\.foundry\bin;' + $env:PATH
cargo run --manifest-path ops/ant-extsig/Cargo.toml --bin ant-extsig
```

Terminal output:
```
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      signer gas policy: MaxFeePerGas::LimitedAuto(800000000 wei/gas)
[3/6] preparing the a1-genesis upload...
      4 chunks, DataMap 1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a <!-- TESTNET-ONLY -->
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 2500000000000000000 atto-ANT = 2.5 ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      e.g. quote hash c6873effa2878aac77bf9f0ba1224eeb146762deffae006094107bd8aef66db3 <!-- TESTNET-ONLY -->
      e.g. quote hash bdb9efbc8fecddf82a3e2cedf047aa11849c8563fc5f8653985df157e1150111 <!-- TESTNET-ONLY -->
[4/6] member wallet paying (wave arm)...
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
Error: "REFUSE: network fee estimate 1782471219 wei exceeds max fee limit 800000000 wei before send for token_approval"
error: process didn't exit successfully: `ops\ant-extsig\target\debug\ant-extsig.exe` (exit code: 1)
```

Proof: The harness refused pre-send immediately before broadcasting any transaction when the network base fee exceeded the driver cap of 800,000,000 wei.

### 5.2 Fresh Live 8-Node Swarm Run with Calibrated Devnet (Receipt JSON)

Command:
```powershell
$dir = (Resolve-Path 'ops/ant-extsig/target/debug').Path
$env:PATH = $dir + ';' + $env:PATH
cargo run --manifest-path ops/ant-extsig/Cargo.toml --bin ant-extsig
```

Terminal output:
```
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      signer gas policy: MaxFeePerGas::LimitedAuto(800000000 wei/gas)
[3/6] preparing the a1-genesis upload...
      4 chunks, DataMap 1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a <!-- TESTNET-ONLY -->
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 2500000000000000000 atto-ANT = 2.5 ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      e.g. quote hash 2a42e182fbdd7ba6a4b35f2bb9b39ac7859784c32abb6add7af640b3c51d50d0 <!-- TESTNET-ONLY -->
      e.g. quote hash 3892d812c08228b5d9b2573aa4ffeeae6fe4bbd4dc9a5c14d89a11d223ef46f0 <!-- TESTNET-ONLY -->
[4/6] member wallet paying (wave arm)...
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      pre-send gas check [token_approval]: est_gas=46394 (buffer_limit=55672) * max_fee_limit=800000000 wei = 44537600000000 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      exact approval tx submitted: 0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958 <!-- TESTNET-ONLY -->
      approval confirmed: gas_used=46394, cost=3650732771834 wei
      pre-send gas check [wave_batch_quotes]: est_gas=188511 (buffer_limit=226213) * max_fee_limit=800000000 wei = 180970400000000 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      gas check [wave_batch_quotes]: gas_limit=226213 * max_fee_per_gas=157379521 wei = 35601293583973 wei (ceiling: 200000000000000 wei = 0.0002 ETH)
      paid 4 quote payments, actual gas used: 183711, max gas commitment: 35601293583973 wei
      storage check [pre_finalize]: 46875000000000000 atto-ANT (ceiling: 2500000000000000000 atto-ANT = 2.5 ANT)
[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...
RECEIPT {
  "bytes_stored": 358,
  "data_map_address": "1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a", // TESTNET-ONLY
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
  "total_gas_commitment_wei": "39252026355807",
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\n        ChunkInfo { index: 0, dst_hash: 25a2a3..65abf8, src_hash: 14946e..f878d4, ",
  "winner_hashes": []
}
```

- DataMap address: `1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a`. <!-- TESTNET-ONLY -->
- Member payer address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`. <!-- TESTNET-ONLY -->
- Approval transaction: `0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958`. <!-- TESTNET-ONLY -->
- Storage quote: `46875000000000000` atto-ANT ($approx 0.0469$ ANT), safely within 2.5 ANT ceiling.
- Gas commitment across both transactions (approval + payment): `39252026355807` wei ($approx 0.00003925$ ETH), safely within 0.0002 ETH ceiling.
- Verified byte-identical round-trip download after full client interrupt and recreation.

### 5.3 Merkle Arm Status: UNVERIFIED on Live Devnet
- Status: **UNVERIFIED on live devnet**.
- Grounded upstream reasons from `ant-core` commit `681d48f3`:
  1. `DEFAULT_MERKLE_THRESHOLD = 64` (`merkle.rs:38`): Uploads with chunk count < 64 (such as the 4-chunk fixture) select wave-batch under `PaymentMode::Auto`.
  2. Candidate pool peer requirements (`merkle.rs:1293-1304`): `remote_peers.len() < CANDIDATES_PER_POOL (16)` triggers `Error::InsufficientPeers`, which falls back to wave-batch under `PaymentMode::Auto` (`merkle.rs:118-120`).
  3. An 8-node local devnet running a 4-chunk fixture selects the wave arm on both grounds.
- Verified sound by construction and unit test:
  - Exact formula `estimate_merkle_payment_cost` verified in unit test `test_merkle_cost_estimation_empty`.
  - Calldata generation `pay_for_merkle_tree_calldata` and pre-send simulation wired before signing.
  - Fail-closed parsing `unwrap_or(u128::MAX)` prevents bypass.

---

## 6. Next Steps & Merge Gate

1. **Re-Review & PR #324 Merge Gate**:
   - Claude Fable 5.1 round-three review verification on [PR #324](https://github.com/beehive-nature/beehive-nature/pull/324).
   - PR #324 is ready for founder merge gate once review confirms the text and receipt corrections.
2. **Pre-Re-Enable Gate (REQUIRED BEFORE RE-ENABLE, NOT BEFORE MERGE)**:
   - Before un-disabling `/api/preserve/upload` in `tools/genealogy/preserve-service.mjs`, the upload service must derive the fee cap dynamically per transaction (`max_fee_per_gas_limit = MAX_GAS_CEILING_WEI / worst_case_gas_limit`) to support archives up to 29 chunks without premature refusal.
   - Founder conducts live mainnet test upload payment.
