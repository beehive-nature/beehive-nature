//! ant-extsig -- THE MEMBER-SIGNED MEMORY WRITE (the vending machine's ANT layer).
//!
//! Proves the external-signer upload the vending spec gates on
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
//! DUAL-CEILING ENFORCEMENT & PRE-SEND GAS SIMULATION:
//! - Storage ceiling: loaded dynamically from ETERNALIZATION-EDITION-V2.json (fails closed if absent).
//!   For wave arm: checked from payment_intent.total_amount.
//!   For merkle arm: computed pre-send by evaluating evm_network.estimate_merkle_payment_cost
//!   across all prepared batches (matches Solidity PaymentVault median16 formula).
//!   Checked at preparation AND immediately pre-finalize; refuses with exact overage if exceeded.
//! - Exact Token Approval: if allowance is insufficient, the harness approves the payment
//!   vault for EXACTLY the required quote sum (never U256::MAX), and gas-checks the approval.
//! - Gas ceiling: aggregate worst-case gas commitment across all planned transactions in the upload
//!   (approval + payment transactions) <= 0.0002 ETH (200_000_000_000_000 wei). Validated
//!   PRE-SEND via provider gas & fee estimation, driver fee cap enforcement via
//!   MaxFeePerGas::LimitedAuto, and verified post-send against mined GasInfo.
//!
//! ARBITRUM NITRO PRECOMPILE CITATION & DEVNET CALIBRATION:
//! Arbitrum Nitro documentation defines the precompiles governing the L2 gas price floor:
//! - ArbOwner.setMinimumL2BaseFee(uint256 priceInWei) configures the chain's gas price floor
//!   (cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbowner).
//! - ArbGasInfo.getMinimumGasPrice() at precompile address 0x000000000000000000000000000000000000006C
//!   returns the current gas price floor
//!   (cite: https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbgasinfo).
//! Note: the cited precompile reference documents the interface methods without stating specific
//! fee constants. Numeric fee figures (0.1 Gwei devnet calibration, ~0.01-0.1 Gwei mainnet observations)
//! are empirical and UNVERIFIED against reference documentation text.
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

/// Parses a JSON value (number or string representation of a decimal) to 18-decimal fixed-point integer (atto/wei).
/// Fails closed on any parse error; avoids floating point arithmetic.
pub fn parse_decimal_to_atto(val: &serde_json::Value) -> Result<u128, Box<dyn std::error::Error>> {
    let s = match val {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => return Err(format!("expected number or string for decimal value, got {val:?}").into()),
    };
    let parts: Vec<&str> = s.trim().split('.').collect();
    if parts.is_empty() || parts.len() > 2 {
        return Err(format!("invalid decimal string: '{s}'").into());
    }
    let part0 = parts[0];
    let int_part: u128 = part0.parse::<u128>()
        .map_err(|e| format!("failed to parse integer part '{part0}' in '{s}': {e}"))?;
    let mut frac_str = if parts.len() == 2 { parts[1].to_string() } else { String::new() };
    if frac_str.len() > 18 {
        frac_str.truncate(18);
    } else {
        while frac_str.len() < 18 {
            frac_str.push('0');
        }
    }
    let frac_part: u128 = if frac_str.is_empty() { 0 } else {
        frac_str.parse::<u128>()
            .map_err(|e| format!("failed to parse fractional part '{frac_str}' in '{s}': {e}"))?
    };
    let int_scaled = int_part.checked_mul(1_000_000_000_000_000_000)
        .ok_or_else(|| format!("overflow converting integer part of '{s}' to 18-decimal fixed point"))?;
    Ok(int_scaled.saturating_add(frac_part))
}

/// Reads ceilings from canonical gate file ETERNALIZATION-EDITION-V2.json.
/// Fails closed if the gate file is missing, unreadable, or does not contain valid bounds.
pub fn load_ceilings() -> Result<(u128, u128), Box<dyn std::error::Error>> {
    let candidates = [
        std::path::PathBuf::from("ETERNALIZATION-EDITION-V2.json"),
        std::path::PathBuf::from("../../ETERNALIZATION-EDITION-V2.json"),
    ];

    for path in &candidates {
        if path.exists() {
            let content = std::fs::read_to_string(path)
                .map_err(|e| format!("failed to read gate file {}: {e}", path.display()))?;
            let v: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("failed to parse JSON from gate file {}: {e}", path.display()))?;
            let ceilings = v.get("separatedCeilings")
                .ok_or_else(|| format!("gate file {} missing 'separatedCeilings'", path.display()))?;

            let storage_val = ceilings.get("storageMaxAnt")
                .ok_or_else(|| format!("gate file {} missing 'storageMaxAnt'", path.display()))?;
            let gas_val = ceilings.get("gasMaxEth")
                .ok_or_else(|| format!("gate file {} missing 'gasMaxEth'", path.display()))?;

            let storage_atto = parse_decimal_to_atto(storage_val)?;
            let gas_wei = parse_decimal_to_atto(gas_val)?;

            println!(
                "      loaded ceilings from {}: storage <= {storage_atto} atto-ANT, gas <= {gas_wei} wei",
                path.display()
            );
            return Ok((storage_atto, gas_wei));
        }
    }
    Err("REFUSE: canonical gate file ETERNALIZATION-EDITION-V2.json absent or unreadable".into())
}

/// Verifies that a transaction's gas commitment does not exceed the gas ceiling.
pub fn verify_transaction_gas(gas: &GasInfo, gas_ceiling_wei: u128, tx_desc: &str) -> Result<u128, Box<dyn std::error::Error>> {
    let max_fee = gas.max_fee_per_gas.unwrap_or(gas.effective_gas_price);
    let worst_case_gas_wei = (gas.gas_with_buffer as u128) * max_fee;
    println!(
        "      gas check [{tx_desc}]: gas_limit={} * max_fee_per_gas={} wei = {} wei (ceiling: {} wei)",
        gas.gas_with_buffer, max_fee, worst_case_gas_wei, gas_ceiling_wei
    );
    if worst_case_gas_wei > gas_ceiling_wei {
        let overage = worst_case_gas_wei - gas_ceiling_wei;
        return Err(format!(
            "REFUSE: gas ceiling exceeded for {tx_desc}: worst-case gas commitment {worst_case_gas_wei} wei exceeds ceiling {gas_ceiling_wei} wei by {overage} wei"
        ).into());
    }
    Ok(worst_case_gas_wei)
}

/// Verifies that storage quote sum does not exceed the storage ceiling.
pub fn verify_storage_ceiling(amount_atto: u128, storage_ceiling_atto: u128, stage: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "      storage check [{stage}]: {amount_atto} atto-ANT (ceiling: {storage_ceiling_atto} atto-ANT)"
    );
    if amount_atto > storage_ceiling_atto {
        let overage = amount_atto - storage_ceiling_atto;
        return Err(format!(
            "REFUSE: storage amount {amount_atto} atto-ANT exceeds ceiling {storage_ceiling_atto} atto-ANT by {overage} atto-ANT at {stage}"
        ).into());
    }
    Ok(())
}

/// Performs a pre-send simulation/estimation check to ensure transaction cannot exceed the gas ceiling.
pub async fn check_pre_send_gas<P: Provider>(
    provider: &P,
    tx: TransactionRequest,
    max_fee_limit: u128,
    gas_ceiling_wei: u128,
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
    // Protect against fee spikes up to driver cap
    let worst_case_commitment = worst_case_gas_limit.saturating_mul(max_fee_limit);

    println!(
        "      pre-send gas check [{stage}]: est_gas={est_gas} (buffer_limit={worst_case_gas_limit}) * max_fee_limit={max_fee_limit} wei = {worst_case_commitment} wei (ceiling: {gas_ceiling_wei} wei)"
    );

    if worst_case_commitment > gas_ceiling_wei {
        let overage = worst_case_commitment - gas_ceiling_wei;
        return Err(format!(
            "REFUSE: pre-send gas ceiling exceeded for {stage}: worst-case gas commitment {worst_case_commitment} wei exceeds ceiling {gas_ceiling_wei} wei by {overage} wei"
        ).into());
    }
    Ok(worst_case_commitment)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let default_file = std::env::temp_dir().join("a1-genesis.json");
    let file_path = std::env::args()
        .nth(1)
        .map(std::path::PathBuf::from)
        .unwrap_or(default_file);

    if !file_path.exists() {
        let fixture = br#"{"protocol":"ant-extsig","version":"0.2.1","event":"genesis","timestamp":"2026-09-04T05:10:17Z","estate":"beehive-nature","payload":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}"#; // PUBLIC-CONSTANT fixture payload
        std::fs::write(&file_path, fixture)?;
    }

    // Load ceilings from canonical gate file ETERNALIZATION-EDITION-V2.json (fails closed if absent/unreadable)
    let (max_storage_ceiling_atto, max_gas_ceiling_wei) = load_ceilings()?;

    // -- [1/6] the swarm: real ant-nodes + embedded Anvil (member-paid EVM) --
    println!("[1/6] starting 8-node LocalDevnet + Anvil...");
    let devnet = LocalDevnet::start(DevnetConfig {
        node_count: 8,
        ..DevnetConfig::default()
    })
    .await?;
    let bootstrap = devnet.bootstrap_addrs();
    let evm_network = devnet.evm_network().clone();

    let member_key = if let Ok(k) = std::env::var("MEMBER_PRIVATE_KEY") {
        k
    } else {
        let k = devnet.wallet_private_key().to_string(); // devnet-funded stand-in
        let key_file = std::env::temp_dir().join("ant-extsig-member-key.txt");
        std::fs::write(&key_file, &k)?;
        k
    };

    // Configure member wallet with driver fee cap derived to fit aggregate worst-case gas (~300k gas buffer limit across approval + payment)
    let max_fee_per_gas_limit: u128 = max_gas_ceiling_wei / 300_000;
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

    // -- [3/6] PREPARE the upload (PaymentMode::Auto) ------------------------
    println!("[3/6] preparing the a1-genesis upload...");
    let prepared = client
        .file_prepare_upload_with_mode(&file_path, Visibility::Public, PaymentMode::Auto, None)
        .await?;
    let data_map_address = prepared
        .data_map_address
        .expect("public prepare records the DataMap address");
    let addr_hex = hex::encode(data_map_address);
    println!(
        "      {} chunks, DataMap {addr_hex}",
        prepared.total_chunks
    );

    // Verify storage quote sum against the storage ceiling before payment
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
    verify_storage_ceiling(quote_sum_atto, max_storage_ceiling_atto, "prepare_quotes")?;

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
    let mut remaining_gas_ceiling_wei = max_gas_ceiling_wei;
    let provider = signer.to_provider();
    let vault_address = *evm_network.payment_vault_address();

    // 4a. Exact Token Approval (never unlimited U256::MAX)
    let current_allowance = signer.token_allowance(vault_address).await?;
    let required_tokens = Amount::from(quote_sum_atto);

    if current_allowance < required_tokens {
        let approve_amount = required_tokens;
        let (approve_calldata, token_contract_addr) =
            evmlib::external_signer::approve_to_spend_tokens_calldata(&evm_network, vault_address, approve_amount);

        let approve_tx = TransactionRequest::default()
            .with_from(signer.address())
            .with_to(token_contract_addr)
            .with_input(approve_calldata);

        println!("      current vault allowance {current_allowance} < required {required_tokens}; approving EXACT amount...");
        check_pre_send_gas(&provider, approve_tx, max_fee_per_gas_limit, remaining_gas_ceiling_wei, "token_approval").await?;

        let approve_tx_hash = signer
            .approve_to_spend_tokens(vault_address, approve_amount)
            .await?;
        println!("      exact approval tx submitted: {approve_tx_hash}");

        if let Some(rcpt) = provider.get_transaction_receipt(approve_tx_hash).await? {
            let gas_used = rcpt.gas_used;
            let eff_price = rcpt.effective_gas_price;
            let cost = (gas_used as u128) * eff_price;
            total_gas_wei += cost;
            remaining_gas_ceiling_wei = remaining_gas_ceiling_wei.saturating_sub(cost);
            println!("      approval confirmed: gas_used={gas_used}, cost={cost} wei (remaining budget: {remaining_gas_ceiling_wei} wei)");
        }
    } else {
        println!("      current vault allowance {current_allowance} >= required {required_tokens}; approval not needed");
    }

    // 4b. Pre-send gas checks for payment (now that approval is mined on-chain) & execution
    enum Paid { Wave(std::collections::HashMap<ant_protocol::evm::QuoteHash, ant_protocol::evm::TxHash>), Merkle(Vec<[u8; 32]>) }
    let paid = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let payments: Vec<_> = payment_intent.payments.clone();
            paid_atto = payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(u128::MAX);

            let calldata_info = evmlib::external_signer::pay_for_quotes_calldata(&evm_network, payments.clone())?;
            for (calldata, _) in &calldata_info.batched_calldata_map {
                let tx = TransactionRequest::default()
                    .with_from(signer.address())
                    .with_to(calldata_info.to)
                    .with_input(calldata.clone());
                check_pre_send_gas(&provider, tx, max_fee_per_gas_limit, remaining_gas_ceiling_wei, "wave_batch_quotes").await?;
            }

            let (map, gas) = signer.pay_for_quotes(payments.into_iter()).await.map_err(|e| format!("member pay_for_quotes: {e:?}"))?;
            let gas_commitment = verify_transaction_gas(&gas, remaining_gas_ceiling_wei, "wave_batch_quotes")?;
            total_gas_wei += gas_commitment;
            println!("      paid {} quote payments, actual gas used: {}, max gas commitment: {} wei", map.len(), gas.actual_gas_used, gas_commitment);
            Paid::Wave(map.into_iter().collect())
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let mut winners = Vec::new();
            for (i, b) in prepared_batches.iter().enumerate() {
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
                check_pre_send_gas(&provider, tx, max_fee_per_gas_limit, remaining_gas_ceiling_wei, &format!("merkle_batch_{i}")).await?;

                let (winner, amount, gas) = signer
                    .pay_for_merkle_tree(b.depth, b.pool_commitments.clone(), b.merkle_payment_timestamp)
                    .await?;
                let gas_commitment = verify_transaction_gas(&gas, remaining_gas_ceiling_wei, &format!("merkle_batch_{i}"))?;
                total_gas_wei += gas_commitment;
                println!("      batch {i}: depth={}, paid {amount} atto, winner {}, gas: {} wei", b.depth, hex::encode(winner), gas_commitment);
                paid_atto = paid_atto.saturating_add(amount.to_string().parse::<u128>().unwrap_or(u128::MAX));
                winners.push(winner);
            }
            Paid::Merkle(winners)
        }
    };

    // Assert total gas commitment across approval and payments strictly met standing authorization
    assert!(total_gas_wei <= max_gas_ceiling_wei, "total gas commitment must meet aggregate ceiling");

    // -- [5/6] THE INTERRUPT: the estate client is DESTROYED; a FRESH client
    //          reconnects and finalizes with the member's payment -- no quote
    verify_storage_ceiling(paid_atto, max_storage_ceiling_atto, "pre_finalize")?;

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
            "storage_ceiling_atto": max_storage_ceiling_atto.to_string(),
            "storage_ceiling_met": paid_atto <= max_storage_ceiling_atto,
            "gas_ceiling_wei": max_gas_ceiling_wei.to_string(),
            "gas_ceiling_met": total_gas_wei <= max_gas_ceiling_wei,
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

    const DEFAULT_STORAGE_CEILING_ATTO: u128 = 2_500_000_000_000_000_000; // 2.5 ANT
    const DEFAULT_GAS_CEILING_WEI: u128 = 200_000_000_000_000; // 0.0002 ETH

    #[test]
    fn test_parse_decimal_to_atto() {
        assert_eq!(parse_decimal_to_atto(&json!(100)).unwrap(), 100_000_000_000_000_000_000);
        assert_eq!(parse_decimal_to_atto(&json!("2.5")).unwrap(), 2_500_000_000_000_000_000);
        assert_eq!(parse_decimal_to_atto(&json!("0.0002")).unwrap(), 200_000_000_000_000);
        assert_eq!(parse_decimal_to_atto(&json!(2.5)).unwrap(), 2_500_000_000_000_000_000);
        assert_eq!(parse_decimal_to_atto(&json!(0.0002)).unwrap(), 200_000_000_000_000);
        assert!(parse_decimal_to_atto(&json!("invalid")).is_err());
    }

    #[test]
    fn test_storage_ceiling_within_limit() {
        assert!(verify_storage_ceiling(DEFAULT_STORAGE_CEILING_ATTO, DEFAULT_STORAGE_CEILING_ATTO, "test").is_ok());
        assert!(verify_storage_ceiling(1_000_000_000_000_000_000, DEFAULT_STORAGE_CEILING_ATTO, "test").is_ok()); // 1.0 ANT
    }

    #[test]
    fn test_storage_ceiling_exceeded_refuses() {
        let overage = 1_000_u128;
        let excessive = DEFAULT_STORAGE_CEILING_ATTO + overage;
        let res = verify_storage_ceiling(excessive, DEFAULT_STORAGE_CEILING_ATTO, "test");
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
        assert!(verify_transaction_gas(&gas, DEFAULT_GAS_CEILING_WEI, "test").is_ok());
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
        let res = verify_transaction_gas(&gas, DEFAULT_GAS_CEILING_WEI, "test");
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("REFUSE: gas ceiling exceeded"));
        assert!(err_msg.contains("50000000000000 wei"));
    }

    #[test]
    fn test_storage_ceiling_fail_closed_overflow() {
        assert!(verify_storage_ceiling(u128::MAX, DEFAULT_STORAGE_CEILING_ATTO, "overflow_test").is_err());
    }

    #[test]
    fn test_worst_case_gas_calculation_at_cap() {
        let est_gas = 188_000_u128;
        let worst_case_gas_limit = est_gas * 120 / 100; // 225_600
        let max_fee_limit = 666_666_666_u128; // ~0.66 Gwei
        let commitment = worst_case_gas_limit * max_fee_limit; // ~150_400_000_000_000 wei
        assert!(commitment <= DEFAULT_GAS_CEILING_WEI);

        let excessive_est_gas = 350_000_u128;
        let excessive_limit = excessive_est_gas * 120 / 100; // 420_000
        let excessive_commitment = excessive_limit * max_fee_limit; // 279_999_999_720_000 wei
        assert!(excessive_commitment > DEFAULT_GAS_CEILING_WEI);
    }

    #[test]
    fn test_aggregate_gas_budgeting() {
        let approval_worst_case = 37_114_666_629_332_u128;
        let payment_worst_case = 150_808_666_522_558_u128;
        let aggregate = approval_worst_case.saturating_add(payment_worst_case);
        assert!(aggregate <= DEFAULT_GAS_CEILING_WEI); // 187,923,333,151,890 <= 200,000,000,000,000

        let excessive_payment = 170_000_000_000_000_u128;
        let excessive_aggregate = approval_worst_case.saturating_add(excessive_payment);
        assert!(excessive_aggregate > DEFAULT_GAS_CEILING_WEI);
    }
}
