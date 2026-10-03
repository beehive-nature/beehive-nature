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
//! CEILINGS AND STOP CONDITIONS (all read from the gate, `gate.rs`):
//! - The gate is `ETERNALIZATION-EDITION-V2.json`. Its path comes from `--gate`,
//!   `ANT_EXTSIG_GATE`, or this crate's own location, never the working
//!   directory. An absent, unreadable or incomplete gate refuses; there is no
//!   built-in fallback number.
//! - Storage ceiling: the sum of prepared quotes (wave: `payment_intent.total_amount`;
//!   merkle: `estimate_merkle_payment_cost` summed over every batch) must be at
//!   or below `separatedCeilings.storageMaxAnt` before either payment arm is entered.
//! - Exact token approval: the vault is approved for exactly the quoted sum,
//!   never an unlimited amount.
//! - Gas ceiling (`budget.rs`): `separatedCeilings.gasMaxEth` is an aggregate
//!   over the whole upload and every attempt at it. Before every signature the
//!   transaction's worst case is reserved in a persistent ledger; a failed or
//!   unknown-outcome send keeps its reservation; only a mined receipt lowers
//!   it. The per-gas fee cap for each send is derived from what remains.
//!   evmlib re-estimates gas when it sends, so the checked limit is not a
//!   bound on the signed limit; the fee cap is what the signer enforces.
//! - Stop conditions: when the file is the gate's artifact (or
//!   `--enforce-gate-artifact` is given), tar sha256, chunk count and client
//!   version must all match the gate before the first signature.
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
//! Local Anvil defaults to a 1 Gwei base fee. When the network fee does not fit
//! the remaining gas budget for a transaction, the harness refuses before signing.

use alloy::network::TransactionBuilder;
use alloy::providers::Provider;
use alloy::rpc::types::TransactionRequest;
use ant_core::data::{
    Client, ClientConfig, ExternalPaymentInfo, LocalDevnet, PaymentMode, Visibility,
};
use ant_node::devnet::DevnetConfig;
use ant_protocol::evm::Wallet;
use evmlib::common::Amount;
use evmlib::transaction_config::{MaxFeePerGas, TransactionConfig};
use serde_json::json;
use sha2::{Digest, Sha256};

mod budget;
mod gate;
use budget::{gas_limit_with_buffer, payment_floor_limit, plan_fee_cap, GasLedger};
use gate::Gate;

type Res<T> = Result<T, Box<dyn std::error::Error>>;

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

/// Estimate one transaction and return the gas limit evmlib will set for it.
async fn estimate_limit<P: Provider>(provider: &P, tx: TransactionRequest, stage: &str) -> Res<u128> {
    let est_gas = provider
        .estimate_gas(tx)
        .await
        .map_err(|e| format!("REFUSE: gas estimation failed for {stage}; nothing signed: {e}"))?;
    Ok(gas_limit_with_buffer(est_gas))
}

/// The network's current EIP-1559 max fee per gas.
async fn network_fee<P: Provider>(provider: &P, stage: &str) -> Res<u128> {
    let fees = provider
        .estimate_eip1559_fees()
        .await
        .map_err(|e| format!("REFUSE: fee estimation failed for {stage}; nothing signed: {e}"))?;
    Ok(fees.max_fee_per_gas)
}

/// Fee headroom over the network estimate, as a fraction: 2/1 allows the fee
/// to double between the check and the send, within the remaining budget.
const FEE_HEADROOM: (u128, u128) = (2, 1);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut gate_arg: Option<String> = None;
    let mut file_arg: Option<std::path::PathBuf> = None;
    let mut enforce_gate_artifact = false;
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--gate" => gate_arg = Some(args.next().ok_or("--gate needs a path")?),
            "--enforce-gate-artifact" => enforce_gate_artifact = true,
            _ if file_arg.is_none() && !a.starts_with("--") => file_arg = Some(std::path::PathBuf::from(a)),
            other => return Err(format!("unexpected argument '{other}'").into()),
        }
    }
    let file_path = file_arg.unwrap_or_else(|| std::env::temp_dir().join("a1-genesis.json"));

    if !file_path.exists() {
        let fixture = br#"{"protocol":"ant-extsig","version":"0.2.1","event":"genesis","timestamp":"2026-09-04T05:10:17Z","estate":"beehive-nature","payload":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}"#; // PUBLIC-CONSTANT fixture payload
        std::fs::write(&file_path, fixture)?;
    }

    // The gate is the only source of ceilings and stop conditions. Absent or
    // unreadable means nothing runs.
    let gate_env = std::env::var("ANT_EXTSIG_GATE").ok();
    let gate = Gate::load(&gate::resolve_gate_path(gate_arg.as_deref(), gate_env.as_deref())?)?;
    let (max_storage_ceiling_atto, max_gas_ceiling_wei) = (gate.storage_ceiling_atto, gate.gas_ceiling_wei);
    println!(
        "[0/6] gate {}: storage <= {max_storage_ceiling_atto} atto-ANT, gas <= {max_gas_ceiling_wei} wei (aggregate, all attempts)",
        gate.path.display()
    );
    let file_sha256 = hex::encode(Sha256::digest(std::fs::read(&file_path)?));
    let is_gate_artifact = gate.is_gate_artifact(&file_sha256);

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

    // The member's signer. Its per-gas fee cap is set before each send, from
    // what the gas ledger has left.
    let mut signer = Wallet::new_from_private_key(evm_network.clone(), member_key.trim_start_matches("0x"))?;
    println!("      member payer address: {}", signer.address());

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

    // Gate stop conditions about the artifact and the client, before any signature.
    if is_gate_artifact || enforce_gate_artifact {
        let tripped = gate.tripped_stop_conditions(&file_sha256, prepared.total_chunks as u64, gate::CLIENT_VERSION);
        if !tripped.is_empty() {
            return Err(format!(
                "REFUSE: gate stop conditions tripped before any signature: {}",
                tripped.join("; ")
            )
            .into());
        }
        println!("      gate stop conditions: tar sha256, chunk count and client version all match the gate");
    } else {
        println!("      gate stop conditions: not applied, this file is not the gate artifact (devnet fixture); ceilings still apply");
    }

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
    let provider = signer.to_provider();
    let vault_address = *evm_network.payment_vault_address();

    // The plan-wide gas ledger. Persistent when ANT_EXTSIG_LEDGER names a file;
    // on devnet each run is a fresh chain, so the default is a per-run file.
    let ledger_path = std::env::var("ANT_EXTSIG_LEDGER")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join(format!("ant-extsig-gas-ledger-{}.json", std::process::id())));
    let plan_id = format!("devnet:{}:{addr_hex}", signer.address());
    let mut ledger = GasLedger::open(&ledger_path, &plan_id, max_gas_ceiling_wei)?;
    println!(
        "      gas ledger {}: ceiling {} wei, carried exposure {} wei from {} earlier entr(ies)",
        ledger_path.display(),
        ledger.ceiling_wei(),
        ledger.exposure_wei(),
        ledger.entries().len()
    );

    // 4a. Exact token approval (never unlimited)
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
        let limit = estimate_limit(&provider, approve_tx, "token_approval").await?;
        let fee = network_fee(&provider, "token_approval").await?;
        let cap = plan_fee_cap(ledger.remaining_wei(), limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, "token_approval")?;
        println!(
            "      plan [token_approval]: gas_limit={limit} network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
            limit.saturating_mul(cap),
            ledger.remaining_wei()
        );
        // Do not sign an approval for a payment that clearly cannot fit afterwards.
        let transfers = match &prepared.payment_info {
            ExternalPaymentInfo::WaveBatch { payment_intent, .. } => payment_intent.payments.len() as u128,
            ExternalPaymentInfo::Merkle { prepared_batches, .. } => prepared_batches.len() as u128,
        };
        let floor_limit = payment_floor_limit(limit, transfers);
        let floor_wei = limit.saturating_add(floor_limit).saturating_mul(fee);
        println!(
            "      floor [approval + payment lower bound]: ({limit} + {floor_limit}) gas x {fee} wei = {floor_wei} wei (remaining {} wei)",
            ledger.remaining_wei()
        );
        ledger.check_projection(floor_wei, "the approval plus a lower bound for the payment")?;

        signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });
        let entry = ledger.reserve("token_approval", limit, cap)?;

        // From here a failure leaves the reservation in the ledger.
        let approve_tx_hash = signer.approve_to_spend_tokens(vault_address, approve_amount).await?;
        println!("      exact approval tx submitted: {approve_tx_hash}");
        match provider.get_transaction_receipt(approve_tx_hash).await? {
            Some(rcpt) => {
                let cost = (rcpt.gas_used as u128).saturating_mul(rcpt.effective_gas_price);
                ledger.settle(entry, cost)?;
                println!(
                    "      approval mined: gas_used={}, cost={cost} wei (ledger exposure {} wei, remaining {} wei)",
                    rcpt.gas_used,
                    ledger.exposure_wei(),
                    ledger.remaining_wei()
                );
            }
            None => println!("      approval receipt not available; its full reservation stays in the ledger"),
        }
    } else {
        println!("      current vault allowance {current_allowance} >= required {required_tokens}; approval not needed");
    }

    // 4b. Payment. The approval is mined, so the payment can be simulated.
    //     Every batch is estimated and the whole payment must fit in what
    //     remains before the first payment signature.
    enum Paid { Wave(std::collections::HashMap<ant_protocol::evm::QuoteHash, ant_protocol::evm::TxHash>), Merkle(Vec<[u8; 32]>) }
    let paid = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let payments: Vec<_> = payment_intent.payments.clone();
            paid_atto = payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(u128::MAX);

            let calldata_info = evmlib::external_signer::pay_for_quotes_calldata(&evm_network, payments.clone())?;
            let mut total_limit: u128 = 0;
            for (i, (calldata, _)) in calldata_info.batched_calldata_map.iter().enumerate() {
                let tx = TransactionRequest::default()
                    .with_from(signer.address())
                    .with_to(calldata_info.to)
                    .with_input(calldata.clone());
                total_limit = total_limit.saturating_add(estimate_limit(&provider, tx, &format!("wave_batch_{i}")).await?);
            }
            let batches = calldata_info.batched_calldata_map.len();
            let stage = format!("wave_payment({batches} tx)");
            let fee = network_fee(&provider, &stage).await?;
            let cap = plan_fee_cap(ledger.remaining_wei(), total_limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, &stage)?;
            println!(
                "      plan [{stage}]: gas_limit={total_limit} network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
                total_limit.saturating_mul(cap),
                ledger.remaining_wei()
            );
            ledger.check_projection(total_limit.saturating_mul(cap), &stage)?;
            signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });
            let entry = ledger.reserve(&stage, total_limit, cap)?;

            let (map, gas) = signer.pay_for_quotes(payments.into_iter()).await.map_err(|e| format!("member pay_for_quotes: {e:?}"))?;
            ledger.settle(entry, gas.gas_cost_wei)?;
            println!(
                "      paid {} quote payments: gas_limit_set={} max_fee_set={:?} gas_used={} cost={} wei (ledger exposure {} wei)",
                map.len(),
                gas.gas_with_buffer,
                gas.max_fee_per_gas,
                gas.actual_gas_used,
                gas.gas_cost_wei,
                ledger.exposure_wei()
            );
            Paid::Wave(map.into_iter().collect())
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            // Project every batch first so a multi-batch payment is never
            // started that the budget cannot finish.
            let mut limits = Vec::with_capacity(prepared_batches.len());
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
                limits.push(estimate_limit(&provider, tx, &format!("merkle_batch_{i}")).await?);
            }
            let total_limit = limits.iter().fold(0u128, |a, l| a.saturating_add(*l));
            let stage_all = format!("merkle_payment({} tx)", limits.len());
            let fee = network_fee(&provider, &stage_all).await?;
            let cap = plan_fee_cap(ledger.remaining_wei(), total_limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, &stage_all)?;
            println!(
                "      plan [{stage_all}]: gas_limit={total_limit} network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
                total_limit.saturating_mul(cap),
                ledger.remaining_wei()
            );
            ledger.check_projection(total_limit.saturating_mul(cap), &stage_all)?;
            signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });

            let mut winners = Vec::new();
            for (i, b) in prepared_batches.iter().enumerate() {
                let stage = format!("merkle_batch_{i}");
                let entry = ledger.reserve(&stage, limits[i], cap)?;
                let (winner, amount, gas) = signer
                    .pay_for_merkle_tree(b.depth, b.pool_commitments.clone(), b.merkle_payment_timestamp)
                    .await?;
                ledger.settle(entry, gas.gas_cost_wei)?;
                println!(
                    "      batch {i}: depth={}, paid {amount} atto, winner {}, gas_used={} cost={} wei (ledger exposure {} wei)",
                    b.depth,
                    hex::encode(winner),
                    gas.actual_gas_used,
                    gas.gas_cost_wei,
                    ledger.exposure_wei()
                );
                paid_atto = paid_atto.saturating_add(amount.to_string().parse::<u128>().unwrap_or(u128::MAX));
                winners.push(winner);
            }
            Paid::Merkle(winners)
        }
    };

    // The ledger is the aggregate. A breach here means a mined cost exceeded
    // its reservation; it is reported, never hidden.
    let total_gas_wei = ledger.exposure_wei();
    if total_gas_wei > max_gas_ceiling_wei {
        return Err(format!(
            "BREACH: gas ledger exposure {total_gas_wei} wei exceeds the gate ceiling {max_gas_ceiling_wei} wei by {} wei; not finalizing",
            total_gas_wei - max_gas_ceiling_wei
        )
        .into());
    }

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
            "gas_exposure_wei": total_gas_wei.to_string(),
            "gas_ledger": ledger.entries().iter().map(|e| json!({
                "stage": e.stage,
                "reserved_wei": e.reserved_wei.to_string(),
                "settled_wei": e.settled_wei.map(|s| s.to_string()),
            })).collect::<Vec<_>>(),
            "gas_ledger_path": ledger_path.display().to_string(),
            "gate_path": gate.path.display().to_string(),
            "file_sha256": file_sha256,
            "file_is_gate_artifact": is_gate_artifact,
            "client_version": gate::CLIENT_VERSION,
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

    const CEILING_ATTO: u128 = 100_000_000_000_000_000_000; // 100 ANT

    #[test]
    fn storage_ceiling_within_limit() {
        assert!(verify_storage_ceiling(CEILING_ATTO, CEILING_ATTO, "test").is_ok());
        assert!(verify_storage_ceiling(2_825_569_772_460_937_500, CEILING_ATTO, "test").is_ok()); // the gate's quote
    }

    #[test]
    fn storage_ceiling_exceeded_refuses_with_the_overage() {
        let err = verify_storage_ceiling(CEILING_ATTO + 1_000, CEILING_ATTO, "test").unwrap_err().to_string();
        assert!(err.contains("REFUSE: storage amount"), "{err}");
        assert!(err.contains("by 1000 atto-ANT"), "{err}");
    }

    #[test]
    fn an_unparseable_amount_fails_closed() {
        assert!(verify_storage_ceiling(u128::MAX, CEILING_ATTO, "overflow").is_err());
    }

    #[test]
    fn merkle_cost_of_no_pools_is_zero() {
        let network = evmlib::Network::ArbitrumOne;
        assert_eq!(network.estimate_merkle_payment_cost(4, &[]), Amount::ZERO);
    }
}
