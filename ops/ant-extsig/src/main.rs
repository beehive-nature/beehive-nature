//! ant-extsig -- THE MEMBER-SIGNED MEMORY WRITE (the vending machine's ANT layer).
//!
//! Proves the external-signer Merkle upload the vending spec gates on
//! (storage-substrate-split item 8), in the shape of the vendor's own
//! `external-merkle-large` example -- plus an interrupt/resume the example
//! does not do: after the member pays, the estate CLIENT IS DESTROYED
//! (connection + all network state dropped) and a FRESH client finalizes
//! the upload with the member's payment. The finalize path carries no quote
//! call -- the member's on-chain payment is the only payment proof.
//!
//! CUSTODY: the payer is a standalone evmlib `Wallet` fed a key from a
//! member-controlled file (in production: the member's WAGMI/MetaMask --
//! ADR-0003's "every keyless consumer" flow; identical EVM signing, same
//! custody boundary). The estate `Client` never receives the wallet.
//!
//! DUAL-CEILING ENFORCEMENT & PRE-SEND BINDING:
//! - Storage ceiling: sum of prepared quotes <= 2.5 ANT (2_500_000_000_000_000_000 atto-ANT).
//!   For wave arm: checked from payment_intent.total_amount.
//!   For merkle arm: computed pre-send by evaluating evm_network.estimate_merkle_payment_cost
//!   across all prepared batches (matches Solidity PaymentVault median16 formula).
//!   Checked at preparation AND immediately pre-finalize; refuses with exact overage if exceeded.
//! - Exact Token Approval: if allowance is insufficient, the harness approves the payment
//!   vault for EXACTLY the required quote sum (never U256::MAX), and gas-checks the approval.
//! - Gas ceiling: total worst-case gas commitment (gas_limit * max_fee_per_gas) <= 0.0002 ETH
//!   (200_000_000_000_000 wei) per transaction. Validated PRE-SEND via provider gas & fee estimation,
//!   bound at driver level via MaxFeePerGas::LimitedAuto, and verified post-send against mined GasInfo.
//!
//! ARBITRUM ONE GAS CITATION & CALIBRATION:
//! On Arbitrum Nitro chains, the base fee is governed by the ArbOwner and ArbGasInfo precompiles:
//! - ArbOwner.setMinimumL2BaseFee(uint256 priceInWei) configures the gas price floor (defaults to 0.1 Gwei = 100,000,000 wei,
//!   cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbowner).
//! - ArbGasInfo.getMinimumGasPrice() at 0x000000000000000000000000000000000000006C returns the L2 floor
//!   (cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbgasinfo).
//! - On Arbitrum One mainnet post-ArbOS 20 Atlas, minimum base fee is 0.01 Gwei (10,000,000 wei) with observed ~0.01-0.1 Gwei range.
//! Local Anvil defaults to Ethereum L1 base fees (1.0 Gwei = 1,000,000,000 wei). If the network base fee
//! or worst-case commitment exceeds 0.0002 ETH, the harness cleanly refuses pre-send.

use alloy::network::TransactionBuilder;
use alloy::providers::Provider;
use alloy::rpc::types::TransactionRequest;
use ant_core::data::{
    Client, ClientConfig, ExternalPaymentInfo, LocalDevnet, PaymentMode, Visibility,
};
use ant_node::devnet::DevnetConfig;
use ant_protocol::evm::Wallet;
use evmlib::GasInfo;
use evmlib::common::Amount;
use evmlib::transaction_config::{MaxFeePerGas, TransactionConfig};
use serde_json::json;

/// Standing ANT storage ceiling: 2.5 ANT in atto-ANT (1 ANT = 10^18 atto-ANT).
pub const MAX_STORAGE_CEILING_ATTO_ANT: u128 = 2_500_000_000_000_000_000; // 2.5 ANT

/// Standing ETH gas ceiling: 0.0002 ETH in wei (1 ETH = 10^18 wei).
pub const MAX_GAS_CEILING_WEI: u128 = 200_000_000_000_000; // 0.0002 ETH

/// Verifies that a transaction's gas commitment does not exceed the 0.0002 ETH ceiling.
pub fn verify_transaction_gas(gas: &GasInfo, tx_desc: &str) -> Result<u128, Box<dyn std::error::Error>> {
    let max_fee = gas.max_fee_per_gas.unwrap_or(gas.effective_gas_price);
    let worst_case_gas_wei = (gas.gas_with_buffer as u128) * max_fee;
    println!(
        "      gas check [{tx_desc}]: gas_limit={} * max_fee_per_gas={} wei = {} wei (ceiling: {} wei = 0.0002 ETH)",
        gas.gas_with_buffer, max_fee, worst_case_gas_wei, MAX_GAS_CEILING_WEI
    );
    if worst_case_gas_wei > MAX_GAS_CEILING_WEI {
        let overage = worst_case_gas_wei - MAX_GAS_CEILING_WEI;
        return Err(format!(
            "REFUSE: gas ceiling exceeded for {tx_desc}: worst-case gas commitment {worst_case_gas_wei} wei exceeds ceiling {MAX_GAS_CEILING_WEI} wei (0.0002 ETH) by {overage} wei"
        ).into());
    }
    Ok(worst_case_gas_wei)
}

/// Verifies that storage quote sum does not exceed the 2.5 ANT ceiling.
pub fn verify_storage_ceiling(amount_atto: u128, stage: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "      storage check [{stage}]: {amount_atto} atto-ANT (ceiling: {MAX_STORAGE_CEILING_ATTO_ANT} atto-ANT = 2.5 ANT)"
    );
    if amount_atto > MAX_STORAGE_CEILING_ATTO_ANT {
        let overage = amount_atto - MAX_STORAGE_CEILING_ATTO_ANT;
        return Err(format!(
            "REFUSE: storage amount {amount_atto} atto-ANT exceeds ceiling {MAX_STORAGE_CEILING_ATTO_ANT} atto-ANT (2.5 ANT) by {overage} atto-ANT at {stage}"
        ).into());
    }
    Ok(())
}

/// Performs a pre-send simulation/estimation check to ensure transaction cannot exceed the 0.0002 ETH gas ceiling.
pub async fn check_pre_send_gas<P: Provider>(
    provider: &P,
    tx: TransactionRequest,
    max_fee_limit: u128,
    stage: &str,
) -> Result<u128, Box<dyn std::error::Error>> {
    let est_gas = provider
        .estimate_gas(tx)
        .await
        .map_err(|e| format!("pre-send gas estimation failed for {stage}: {e}"))?;
    let fees = provider
        .estimate_eip1559_fees()
        .await
        .map_err(|e| format!("pre-send fee estimation failed for {stage}: {e}"))?;

    // Verify fee does not exceed driver cap
    if fees.max_fee_per_gas > max_fee_limit {
        return Err(format!(
            "REFUSE: network fee estimate {} wei exceeds max fee limit {} wei before send for {stage}",
            fees.max_fee_per_gas, max_fee_limit
        ).into());
    }

    // evmlib uses estimated_gas * 120 / 100 for gas_with_buffer
    let worst_case_gas_limit = (est_gas as u128).saturating_mul(120) / 100;
    // Fable 5.1: The signer is allowed to pay up to max_fee_limit, and evmlib re-reads fees at send.
    // To protect against fee spikes up to the cap, multiply by the driver cap (max_fee_limit).
    let worst_case_commitment = worst_case_gas_limit.saturating_mul(max_fee_limit);

    println!(
        "      pre-send gas check [{stage}]: est_gas={est_gas} (buffer_limit={worst_case_gas_limit}) * max_fee_limit={max_fee_limit} wei = {worst_case_commitment} wei (ceiling: {MAX_GAS_CEILING_WEI} wei = 0.0002 ETH)"
    );

    if worst_case_commitment > MAX_GAS_CEILING_WEI {
        let overage = worst_case_commitment - MAX_GAS_CEILING_WEI;
        return Err(format!(
            "REFUSE: pre-send gas ceiling exceeded for {stage}: worst-case gas commitment {worst_case_commitment} wei exceeds ceiling {MAX_GAS_CEILING_WEI} wei (0.0002 ETH) by {overage} wei"
        ).into());
    }
    Ok(worst_case_commitment)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let default_file = std::env::temp_dir().join("a1-genesis.json");
    let file_path = std::env::args()
        .nth(1)
        .or_else(|| std::env::args().nth(2))
        .map(std::path::PathBuf::from)
        .unwrap_or(default_file);

    if !file_path.exists() {
        let fixture = br#"{"protocol":"ant-extsig","version":"0.2.1","event":"genesis","timestamp":"2026-09-04T05:10:17Z","estate":"beehive-nature","payload":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}"#; // PUBLIC-CONSTANT fixture payload
        std::fs::write(&file_path, fixture)?;
    }

    // -- [1/6] the swarm: real ant-nodes + embedded Anvil (member-paid EVM) --
    println!("[1/6] starting 8-node LocalDevnet + Anvil...");
    let devnet = LocalDevnet::start(DevnetConfig {
        node_count: 8,
        ..DevnetConfig::default()
    })
    .await?;
    let bootstrap = devnet.bootstrap_addrs();
    let evm_network = devnet.evm_network().clone();

    // THE MEMBER'S KEY -- held in a file the member controls; on mainnet this
    // is the member's browser wallet. The estate client never sees it.
    let member_key = {
        let k = devnet.wallet_private_key().to_string(); // devnet-funded stand-in
        let key_file = std::env::temp_dir().join("ant-extsig-member-key.txt");
        std::fs::write(&key_file, &k)?;
        k
    };

    // Configure member wallet with gas ceiling enforcement
    // MaxFeePerGas::LimitedAuto caps max_fee_per_gas to ensure gas_limit * max_fee <= 0.0002 ETH.
    let max_fee_per_gas_limit: u128 = MAX_GAS_CEILING_WEI / 250_000;
    let mut signer = Wallet::new_from_private_key(evm_network.clone(), member_key.trim_start_matches("0x"))?;
    signer.set_transaction_config(TransactionConfig {
        max_fee_per_gas: MaxFeePerGas::LimitedAuto(max_fee_per_gas_limit),
    });
    println!("      member payer address: {}", signer.address());
    println!("      signer gas policy: MaxFeePerGas::LimitedAuto({max_fee_per_gas_limit} wei/gas)");

    // -- [2/6] the estate client connects (NO wallet attached) --------------
    let cfg = ClientConfig {
        allow_loopback: bootstrap.iter().any(|a| a.ip().is_loopback()),
        ..Default::default()
    };
    let client = Client::connect(&bootstrap, cfg.clone()).await?;

    // -- [3/6] PREPARE the a1-genesis upload (merkle, Auto mode) ------------
    println!("[3/6] preparing the a1-genesis upload...");
    let prepared = client
        .file_prepare_upload_with_mode(&file_path, Visibility::Public, PaymentMode::Merkle, None)
        .await?;
    let data_map_address = prepared
        .data_map_address
        .expect("public prepare records the DataMap address");
    let addr_hex = hex::encode(data_map_address);
    println!(
        "      {} chunks, DataMap {addr_hex}",
        prepared.total_chunks
    );

    // Verify storage quote sum against the 2.5 ANT ceiling before payment
    // For Wave batches: total_amount from payment intent.
    // For Merkle batches: sum of evm_network.estimate_merkle_payment_cost across all batches.
    let quote_sum_atto: u128 = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(u128::MAX)
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let mut total: u128 = 0;
            for b in prepared_batches {
                let est: Amount = evm_network.estimate_merkle_payment_cost(b.depth, &b.pool_commitments);
                let cost = est.to_string().parse::<u128>().unwrap_or(u128::MAX);
                total = total.saturating_add(cost);
            }
            total
        }
    };
    verify_storage_ceiling(quote_sum_atto, "prepare_quotes")?;

    // the 318 B genesis is 4 chunks -- BELOW the 64-chunk merkle threshold --
    // so the network prices it as a WAVE batch (per-chunk quotes); both arms
    // are handled, the custody law is identical in each
    let payment_arm = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            println!("      arm: WAVE ({} quote payments, total {} atto)", payment_intent.payments.len(), payment_intent.total_amount);
            for (qh, _r, _a) in payment_intent.payments.iter().take(2) {
                println!("      e.g. quote hash {}", hex::encode(qh.as_slice()));
            }
            "wave"
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            println!("      arm: MERKLE ({} batch(es), total estimated {} atto)", prepared_batches.len(), quote_sum_atto);
            "merkle"
        }
    };

    // -- [4/6] THE MEMBER PAYS -- standalone wallet, out-of-band -------------
    println!("[4/6] member wallet paying ({payment_arm} arm)...");
    let mut paid_atto: u128 = 0;
    let mut total_gas_wei: u128 = 0;
    let provider = signer.to_provider();
    let vault_address = *evm_network.payment_vault_address();

    // 4a. Exact Token Approval (never unlimited U256::MAX)
    // Query current allowance; if insufficient, approve EXACTLY quote_sum_atto tokens.
    let current_allowance = signer.token_allowance(vault_address).await?;
    let required_tokens = Amount::from(quote_sum_atto);
    if current_allowance < required_tokens {
        println!("      current vault allowance {current_allowance} < required {required_tokens}; approving EXACT amount...");
        let approve_amount = required_tokens;
        let (approve_calldata, token_contract_addr) =
            evmlib::external_signer::approve_to_spend_tokens_calldata(&evm_network, vault_address, approve_amount);

        let approve_tx = TransactionRequest::default()
            .with_from(signer.address())
            .with_to(token_contract_addr)
            .with_input(approve_calldata);

        // Pre-send gas check on the approval transaction
        check_pre_send_gas(&provider, approve_tx, max_fee_per_gas_limit, "token_approval").await?;

        let approve_tx_hash = signer
            .approve_to_spend_tokens(vault_address, approve_amount)
            .await?;
        println!("      exact approval tx submitted: {approve_tx_hash}");

        // Capture approval gas receipt
        if let Some(rcpt) = provider.get_transaction_receipt(approve_tx_hash).await? {
            let gas_used = rcpt.gas_used;
            let eff_price = rcpt.effective_gas_price;
            let cost = (gas_used as u128) * eff_price;
            total_gas_wei += cost;
            println!("      approval confirmed: gas_used={gas_used}, cost={cost} wei");
        }
    } else {
        println!("      current vault allowance {current_allowance} >= required {required_tokens}; approval not needed");
    }

    // 4b. Pre-send gas checks & member execution
    enum Paid { Wave(std::collections::HashMap<ant_protocol::evm::QuoteHash, ant_protocol::evm::TxHash>), Merkle(Vec<[u8; 32]>) }
    let paid = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let payments: Vec<_> = payment_intent.payments.clone();
            paid_atto = payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(u128::MAX);

            // Pre-send gas check for quote payments batch
            let calldata_info = evmlib::external_signer::pay_for_quotes_calldata(&evm_network, payments.clone())?;
            for (calldata, _) in &calldata_info.batched_calldata_map {
                let tx = TransactionRequest::default()
                    .with_from(signer.address())
                    .with_to(calldata_info.to)
                    .with_input(calldata.clone());
                check_pre_send_gas(&provider, tx, max_fee_per_gas_limit, "wave_batch_quotes").await?;
            }

            let (map, gas) = signer.pay_for_quotes(payments.into_iter()).await.map_err(|e| format!("member pay_for_quotes: {e:?}"))?;
            let gas_commitment = verify_transaction_gas(&gas, "wave_batch_quotes")?;
            total_gas_wei += gas_commitment;
            println!("      paid {} quote payments, actual gas used: {}, max gas commitment: {} wei", map.len(), gas.actual_gas_used, gas_commitment);
            Paid::Wave(map.into_iter().collect())
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let mut winners = Vec::new();
            for (i, b) in prepared_batches.iter().enumerate() {
                // Pre-send gas check for each merkle batch
                let calldata_info = evmlib::external_signer::pay_for_merkle_tree_calldata(
                    &evm_network,
                    b.depth,
                    b.pool_commitments.clone(),
                    b.merkle_payment_timestamp,
                )?;
                let tx = TransactionRequest::default()
                    .with_from(signer.address())
                    .with_to(calldata_info.to)
                    .with_input(calldata_info.calldata);
                check_pre_send_gas(&provider, tx, max_fee_per_gas_limit, &format!("merkle_batch_{i}")).await?;

                let (winner, amount, gas) = signer
                    .pay_for_merkle_tree(b.depth, b.pool_commitments.clone(), b.merkle_payment_timestamp)
                    .await?;
                let gas_commitment = verify_transaction_gas(&gas, &format!("merkle_batch_{i}"))?;
                total_gas_wei += gas_commitment;
                println!("      batch {i}: depth={}, paid {amount} atto, winner {}, gas: {} wei", b.depth, hex::encode(winner), gas_commitment);
                paid_atto = paid_atto.saturating_add(amount.to_string().parse::<u128>().unwrap_or(u128::MAX));
                winners.push(winner);
            }
            Paid::Merkle(winners)
        }
    };

    // -- [5/6] THE INTERRUPT: the estate client is DESTROYED; a FRESH client
    //          reconnects and finalizes with the member's payment -- no quote
    verify_storage_ceiling(paid_atto, "pre_finalize")?;

    drop(client);
    println!("[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...");
    let fresh_client = Client::connect(&bootstrap, cfg).await?;
    let winner_report: Vec<String> = match &paid {
        Paid::Wave(_) => vec![],
        Paid::Merkle(ws) => ws.iter().map(hex::encode).collect(),
    };
    let result = match paid {
        Paid::Wave(tx_map) => fresh_client.finalize_upload(prepared, &tx_map).await?,
        Paid::Merkle(winners) => {
            fresh_client
                .finalize_upload_merkle_multi(prepared, winners.iter().map(|w| Some(*w)).collect())
                .await?
        }
    };

    // -- [6/6] round-trip: download what the member paid to store -----------
    let data_map = fresh_client.data_map_fetch(&data_map_address).await?;
    let out = std::env::temp_dir().join("ant-extsig-roundtrip.json");
    let written = fresh_client.file_download(&data_map, &out).await?;
    let orig = std::fs::read(&file_path)?;
    let got = std::fs::read(&out)?;
    assert_eq!(orig, got, "round-trip must be byte-identical");

    println!(
        "RECEIPT {}",
        serde_json::to_string_pretty(&json!({
            "file": file_path.display().to_string(),
            "data_map_address": addr_hex,
            "bytes_stored": written,
            "payment_arm": payment_arm,
            "winner_hashes": winner_report,
            "paid_atto": paid_atto.to_string(),
            "payer_address": signer.address().to_string(),
            "storage_ceiling_atto": MAX_STORAGE_CEILING_ATTO_ANT.to_string(),
            "storage_ceiling_met": paid_atto <= MAX_STORAGE_CEILING_ATTO_ANT,
            "gas_ceiling_wei": MAX_GAS_CEILING_WEI.to_string(),
            "gas_ceiling_met": total_gas_wei <= MAX_GAS_CEILING_WEI,
            "total_gas_commitment_wei": total_gas_wei.to_string(),
            "interrupt": "client destroyed after payment; fresh client finalized",
            "resumed_without_new_quote": true,
            "roundtrip_byte_identical": true,
            "estate_client_held_wallet": false,
            "upload_result_debug": format!("{result:?}").chars().take(120).collect::<String>(),
        }))?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_ceiling_within_limit() {
        assert!(verify_storage_ceiling(MAX_STORAGE_CEILING_ATTO_ANT, "test").is_ok());
        assert!(verify_storage_ceiling(1_000_000_000_000_000_000, "test").is_ok()); // 1.0 ANT
    }

    #[test]
    fn test_storage_ceiling_exceeded_refuses() {
        let overage = 1_000_u128;
        let excessive = MAX_STORAGE_CEILING_ATTO_ANT + overage;
        let res = verify_storage_ceiling(excessive, "test");
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("REFUSE: storage amount"));
        assert!(err_msg.contains(&format!("by {overage} atto-ANT")));
    }

    #[test]
    fn test_merkle_cost_estimation_empty() {
        let network = evmlib::Network::ArbitrumOne;
        let cost = network.estimate_merkle_payment_cost(4, &[]);
        assert_eq!(cost, Amount::ZERO);
    }

    #[test]
    fn test_gas_ceiling_within_limit() {
        let gas = GasInfo {
            estimated_gas: 150_000,
            gas_with_buffer: 180_000,
            max_fee_per_gas: Some(1_000_000_000), // 1 Gwei
            max_priority_fee_per_gas: Some(100_000_000),
            actual_gas_used: 140_000,
            effective_gas_price: 1_000_000_000,
            gas_cost_wei: 140_000_000_000_000,
        };
        // 180,000 * 1 Gwei = 180,000,000,000,000 wei <= 200,000,000,000,000 wei (0.0002 ETH)
        assert!(verify_transaction_gas(&gas, "test").is_ok());
    }

    #[test]
    fn test_gas_ceiling_exceeded_refuses() {
        let gas = GasInfo {
            estimated_gas: 200_000,
            gas_with_buffer: 250_000,
            max_fee_per_gas: Some(1_000_000_000), // 1 Gwei -> 250,000,000,000,000 wei > 200,000,000,000,000 wei
            max_priority_fee_per_gas: Some(100_000_000),
            actual_gas_used: 200_000,
            effective_gas_price: 1_000_000_000,
            gas_cost_wei: 200_000_000_000_000,
        };
        let res = verify_transaction_gas(&gas, "test");
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("REFUSE: gas ceiling exceeded"));
        assert!(err_msg.contains("50000000000000 wei"));
    }

    #[test]
    fn test_storage_ceiling_fail_closed_overflow() {
        assert!(verify_storage_ceiling(u128::MAX, "overflow_test").is_err());
    }

    #[test]
    fn test_worst_case_gas_calculation_at_cap() {
        let est_gas = 188_000_u128;
        let worst_case_gas_limit = est_gas * 120 / 100; // 225_600
        let max_fee_limit = 800_000_000_u128; // 0.8 Gwei
        let commitment = worst_case_gas_limit * max_fee_limit; // 180_480_000_000_000 wei
        assert!(commitment <= MAX_GAS_CEILING_WEI);

        let excessive_est_gas = 250_000_u128;
        let excessive_limit = excessive_est_gas * 120 / 100; // 300_000
        let excessive_commitment = excessive_limit * max_fee_limit; // 240_000_000_000_000 wei
        assert!(excessive_commitment > MAX_GAS_CEILING_WEI);
    }
}
