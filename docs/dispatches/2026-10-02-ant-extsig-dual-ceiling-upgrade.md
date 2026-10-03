# Dispatch: 2026-10-02 ant-extsig Dual-Ceiling Upgrade & Dependency Modernization

## 1. Overview & PR #324 Status

Branch: `lane/ant-extsig-dual-ceiling`  
PR: [PR #324](https://github.com/beehive-nature/beehive-nature/pull/324)  
Worktree: `wt-ant-ceiling`

This update resolves all blocking items, reviewer corrections, and receipt requirements from Claude Fable 5.1's reviews:
1. **Dynamic Gate Ceiling Loading (100 ANT / 0.0002 ETH)**:
   - Reads storage ceiling and ETH gas ceiling directly from canonical gate file `ETERNALIZATION-EDITION-V2.json` (`separatedCeilings.storageMaxAnt: 100`, `gasMaxEth: 0.0002`).
   - The former 2.5 ANT constant is permanently retired per the 2026-10-03 founder ruling ("that is like $0.25 cents. 100 ANT cap for now").
2. **Aggregate Pre-Send Gas Budgeting Across Upload**:
   - Before signing or broadcasting any transaction, the harness pre-estimates every planned transaction in the upload (token approval and all payment batches).
   - Computes worst-case commitment per transaction: `est_gas * 1.2 * max_fee_limit`, where `max_fee_limit = max_gas_ceiling_wei / 300_000` (~666,666,666 wei, covering ~282k aggregate gas buffer limit).
   - Refuses pre-send before the first signature if `aggregate_planned_worst_case = planned_approval + planned_payments > max_gas_ceiling_wei`.
3. **Exact Token Approval (No `U256::MAX`)**:
   - Vault allowance is inspected pre-payment. If insufficient, the harness submits an approval for **exactly** the quoted sum, gas-checking the approval transaction and aggregating its cost into total gas commitment. `evmlib`'s internal `U256::MAX` approval path is never entered.
4. **Payment Mode Selection (`PaymentMode::Auto`)**:
   - Set to `PaymentMode::Auto`. Files < 64 chunks (`DEFAULT_MERKLE_THRESHOLD = 64` per `ant-core` `merkle.rs:38`) select the verified wave arm by design.
   - Merkle fallback on devnet documented with exact upstream facts (`InsufficientPeers` when remote peers < `CANDIDATES_PER_POOL = 16`).
5. **Fail-Closed Numeric Parsing**:
   - All string-to-integer parse fallbacks for storage and payment sums fail closed via `.unwrap_or(u128::MAX)` across both wave and merkle arms.
6. **Arbitrum Nitro Precompile Citations & Fee Honesty**:
   - Citations link directly to Arbitrum precompiles: `ArbOwner.setMinimumL2BaseFee(uint256)` and `ArbGasInfo.getMinimumGasPrice()` at `0x000000000000000000000000000000000000006C`.
   - Numerical fee figures (0.1 Gwei devnet calibration, ~0.01-0.1 Gwei mainnet observations) are empirical and UNVERIFIED against reference documentation text.
7. **Permanent Retirement of `/api/preserve/upload`**:
   - Stated plainly that `/api/preserve/upload` is permanently retired (not "pending re-enable"). `preserve-service.mjs` reads `SECRET_KEY` in-process, violating zero-custody law. Standalone CLI with external signer is the canonical execution path.
8. **Persistent Retry Ledger Follow-up Gate**:
   - Persistent plan-wide ledger across transaction retries and full gate stop-condition enforcement are split into a dedicated follow-up gate before production execution, as agreed with reviewer loviswaternakamoto. This PR delivers "wave arm, single attempt, devnet-proven".
9. **Clean Merge of `origin/main`**:
   - Merged `origin/main` (commit `fd423f3fa`), incorporating PR #327 (`711d3936b`), turning CI `eternal` and `node` green again.

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

### 3.1 Dynamic Ceiling Loading from Gate File
- `load_ceilings()` inspects `ETERNALIZATION-EDITION-V2.json` (or relative `../../ETERNALIZATION-EDITION-V2.json`).
- Loads `separatedCeilings.storageMaxAnt` (100 ANT = 100,000,000,000,000,000,000 atto-ANT) and `separatedCeilings.gasMaxEth` (0.0002 ETH = 200,000,000,000,000 wei).
- Replaces hardcoded 2.5 ANT constant, preventing code constants from becoming stale when estate parameters change.

### 3.2 Aggregate Pre-Send Gas Budgeting
- Autonomi uploads require multiple transactions: an ERC-20 token approval to `PaymentVault`, followed by one or more quote-batch payment transactions.
- Reconciliation in `tools/genealogy/bpay.mjs::reconcile` validates aggregate `gasUsedWei <= maxGasETH`.
- The harness calculates:
  - Planned worst-case approval gas: `est_gas * 1.2 * max_fee_limit`
  - Planned worst-case payment gas: `sum(est_gas * 1.2 * max_fee_limit)`
  - `aggregate_planned_worst_case = planned_approval_worst_case + planned_payment_worst_case`
- If `aggregate_planned_worst_case > max_gas_ceiling_wei`, the harness refuses pre-send before signing any transaction:
  `REFUSE: aggregate planned gas commitment {aggregate_planned_worst_case} wei exceeds ceiling {max_gas_ceiling_wei} wei by {overage} wei`.

### 3.3 Exact Token Approval (No `U256::MAX`)
- The harness checks `signer.token_allowance(vault_address)` prior to payment. If insufficient, it submits an approval for **exactly** `Amount::from(quote_sum_atto)`.
- The approval transaction is pre-send gas-checked and its on-chain receipt gas is aggregated into `total_gas_wei`.
- When `pay_for_quotes` subsequently executes, existing allowance satisfies the requirement, preventing `evmlib` from broadcasting an unlimited approval.

### 3.4 PaymentMode::Auto & Upstream Merkle Grounding
- Uploads are prepared with `PaymentMode::Auto`.
- `DEFAULT_MERKLE_THRESHOLD = 64` (`merkle.rs:38`): Uploads with chunk count < 64 (such as the 4-chunk fixture) select wave-batch under `PaymentMode::Auto`.
- Candidate pool peer requirements (`merkle.rs:1293-1304`): `remote_peers.len() < CANDIDATES_PER_POOL (16)` triggers `Error::InsufficientPeers`, falling back to wave-batch under `PaymentMode::Auto` (`merkle.rs:118-120`).
- An 8-node local devnet running a 4-chunk fixture selects the wave arm on both grounds.
- Merkle arm live devnet execution remains honestly marked **UNVERIFIED on live devnet**, but sound by construction, unit test, and upstream Solidity alignment.

### 3.5 Arbitrum Nitro Precompile Citations & Devnet Calibration
- Arbitrum Nitro documentation defines the precompiles governing the L2 gas price floor:
  - `ArbOwner.setMinimumL2BaseFee(uint256 priceInWei)` configures the chain's gas price floor (cite: `https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbowner`).
  - `ArbGasInfo.getMinimumGasPrice()` at precompile address `0x000000000000000000000000000000000000006C` returns the current gas price floor (cite: `https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbgasinfo`).
- Note on fee numbers: The cited reference page defines interface functions only and specifies no numerical constants. The 0.1 Gwei (100,000,000 wei) figure passed to `--base-fee` in `ops/ant-extsig/src/bin/anvil.rs` is an empirical testnet calibration (UNVERIFIED from official doc text) to prevent local Anvil from defaulting to Ethereum L1 1.0 Gwei fees.

### 3.6 Permanent Retirement of /api/preserve/upload & Custody Boundary
- `/api/preserve/upload` in `preserve-service.mjs` reads `SECRET_KEY` in its own process (`:244`), directly violating the estate's zero-custody law.
- The gate (`ETERNALIZATION-EDITION-V2.json:52`) requires uploads to run repo+gh+CLI directly with no local-server bridge.
- Therefore, `/api/preserve/upload` is permanently retired. The standalone CLI harness `ant-extsig` with external signer is the permanent execution path.

---

## 4. Unit Test Battery (`cargo test`)

`cargo test --manifest-path ops/ant-extsig/Cargo.toml` executes 8 unit tests covering storage, fail-closed parsing, Merkle cost estimation, gas arithmetic at driver cap, and aggregate budgeting:

```
running 8 tests
test tests::test_aggregate_gas_budgeting ... ok
test tests::test_gas_ceiling_within_limit ... ok
test tests::test_gas_ceiling_exceeded_refuses ... ok
test tests::test_merkle_cost_estimation_empty ... ok
test tests::test_storage_ceiling_fail_closed_overflow ... ok
test tests::test_storage_ceiling_exceeded_refuses ... ok
test tests::test_storage_ceiling_within_limit ... ok
test tests::test_worst_case_gas_calculation_at_cap ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

---

## 5. Live Receipts

### 5.1 Clean Refusal Receipt against Vanilla Anvil (Base Fee > Cap)

Command run without the Anvil wrapper (executing vanilla `anvil.exe` with default 1.0 Gwei Ethereum L1 base fee):
```powershell
$env:PATH = 'C:\Users\travi\.foundry\bin;' + $env:PATH
cargo run --manifest-path ops/ant-extsig/Cargo.toml --bin ant-extsig
```

Terminal output:
```
[1/6] starting 8-node LocalDevnet + Anvil...
      member payer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      signer gas policy: MaxFeePerGas::LimitedAuto(666666666 wei/gas)
[3/6] preparing the a1-genesis upload...
      4 chunks, DataMap 1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a <!-- TESTNET-ONLY -->
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT = 100 ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      e.g. quote hash c6873effa2878aac77bf9f0ba1224eeb146762deffae006094107bd8aef66db3 <!-- TESTNET-ONLY -->
      e.g. quote hash bdb9efbc8fecddf82a3e2cedf047aa11849c8563fc5f8653985df157e1150111 <!-- TESTNET-ONLY -->
[4/6] member wallet paying (wave arm)...
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
Error: "REFUSE: network fee estimate 1782471219 wei exceeds max fee limit 666666666 wei before send for token_approval"
error: process didn't exit successfully: `ops\ant-extsig\target\debug\ant-extsig.exe` (exit code: 1)
```

Proof: The harness refused pre-send immediately before broadcasting any transaction when the network base fee exceeded the driver fee cap.

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
      signer gas policy: MaxFeePerGas::LimitedAuto(666666666 wei/gas)
[3/6] preparing the a1-genesis upload...
      4 chunks, DataMap 1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a <!-- TESTNET-ONLY -->
      storage check [prepare_quotes]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT = 100 ANT)
      arm: WAVE (4 quote payments, total 46875000000000000 atto)
      e.g. quote hash 2a42e182fbdd7ba6a4b35f2bb9b39ac7859784c32abb6add7af640b3c51d50d0 <!-- TESTNET-ONLY -->
      e.g. quote hash 3892d812c08228b5d9b2573aa4ffeeae6fe4bbd4dc9a5c14d89a11d223ef46f0 <!-- TESTNET-ONLY -->
[4/6] member wallet paying (wave arm)...
      current vault allowance 0 < required 46875000000000000; approving EXACT amount...
      aggregate pre-send gas check: approval=37114666629332 wei + payment=150808666522558 wei = total 187923333151890 wei (ceiling: 200000000000000 wei)
      pre-send gas check [token_approval]: est_gas=46394 (buffer_limit=55672) * max_fee_limit=666666666 wei = 37114666629332 wei (ceiling: 200000000000000 wei)
      exact approval tx submitted: 0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958 <!-- TESTNET-ONLY -->
      approval confirmed: gas_used=46394, cost=3650732771834 wei
      pre-send gas check [wave_batch_quotes]: est_gas=188511 (buffer_limit=226213) * max_fee_limit=666666666 wei = 150808666522558 wei (ceiling: 200000000000000 wei)
      gas check [wave_batch_quotes]: gas_limit=226213 * max_fee_per_gas=157379521 wei = 35601293583973 wei (ceiling: 200000000000000 wei)
      paid 4 quote payments, actual gas used: 183711, max gas commitment: 35601293583973 wei
      storage check [pre_finalize]: 46875000000000000 atto-ANT (ceiling: 100000000000000000000 atto-ANT = 100 ANT)
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
  "storage_ceiling_atto": "100000000000000000000",
  "storage_ceiling_met": true,
  "total_gas_commitment_wei": "39252026355807",
  "upload_result_debug": "FileUploadResult { data_map: DataMap:\\n        ChunkInfo { index: 0, dst_hash: 25a2a3..65abf8, src_hash: 14946e..f878d4, ",
  "winner_hashes": []
}
```

- DataMap address: `1e44a2ca1a773b88bb275551d1d19a4ff3c9293fe6fda67251203f5a6ab5e25a`. <!-- TESTNET-ONLY -->
- Member payer address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`. <!-- TESTNET-ONLY -->
- Approval transaction: `0xff302f8e5661401add312457aaddc90d94b23b3bfd7fb6dff467b86d0f842958`. <!-- TESTNET-ONLY -->
- Storage quote: `46875000000000000` atto-ANT ($approx 0.0469$ ANT), safely within 100 ANT ceiling.
- Gas commitment across both transactions (approval + payment): `39252026355807` wei ($approx 0.00003925$ ETH), safely within 0.0002 ETH ceiling.
- Verified byte-identical round-trip download after full client interrupt and recreation.

---

## 6. Next Steps & Merge Gate

1. **Re-Review & PR #324 Merge Gate**:
   - Claude Fable 5.1 round-four review verification on [PR #324](https://github.com/beehive-nature/beehive-nature/pull/324).
   - PR #324 is ready for founder merge gate once review confirms the text, aggregate budgeting, gate-reading, and receipt corrections.
2. **Follow-Up Gate (Before Mainnet Execution)**:
   - Persistent plan-wide ledger across retries (tracking worst-case exposure across reverted/dropped/unknown transactions).
   - Full gate stop-condition enforcement (client version re-issuance, quote fresh check).
