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
//!   over the whole upload and every attempt at it. Before every send call the
//!   worst case of every transaction evmlib may sign inside it (four: one send
//!   and three retries) is reserved in a persistent ledger; a failed or
//!   unknown-outcome send keeps its reservation; only the payer's own on-chain
//!   balance change lowers it. The per-gas fee cap for each send is derived
//!   from what remains. evmlib re-estimates gas when it sends, so the checked
//!   limit is not a bound on the signed limit; the fee cap is what the signer
//!   enforces, and the balance change records whatever was actually spent.
//! - The ledger file is found from the plan itself, so a rerun meets the
//!   earlier attempts without being told where they are.
//! - Stop conditions: tar sha256, chunk count and client version must all
//!   match the gate before the first signature. They are skipped only for the
//!   harness's own generated fixtures, or a file passed with `--devnet-fixture`.
//!
//! NETWORKS:
//! - `--network devnet` (the default) starts a LocalDevnet and pays with its
//!   funded test account.
//! - `--network mainnet` connects to the real network and Arbitrum One. Without
//!   `--pay` it only quotes: no key is read, no wallet exists, nothing is
//!   signed. With `--pay` the key is read from the file `MEMBER_KEY_FILE`
//!   names, the gate's stop conditions are always enforced, and the gate's own
//!   `paymentClientCapability.uploadEnabled` must be true.
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
use ant_protocol::transport::MultiAddr;
use evmlib::common::Amount;
use evmlib::transaction_config::{MaxFeePerGas, TransactionConfig};
use serde_json::json;
use sha2::{Digest, Sha256};

mod budget;
mod gate;
use budget::{default_ledger_path, gas_limit_with_buffer, payment_floor_limit, plan_fee_cap, GasLedger, SEND_ATTEMPTS};
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

/// What the payer holds in ETH, in wei.
async fn eth_balance<P: Provider>(provider: &P, payer: alloy::primitives::Address, stage: &str) -> Res<u128> {
    let balance = provider
        .get_balance(payer)
        .await
        .map_err(|e| format!("REFUSE: cannot read the payer's balance for {stage}; nothing signed: {e}"))?;
    u128::try_from(balance).map_err(|_| format!("REFUSE: payer balance does not fit 128 bits at {stage}").into())
}

/// What the chain says the payer spent since `balance_before`, or `None` when
/// that cannot be read as final: a transaction of the payer's is still
/// pending, or a read failed. The payment token is an ERC-20, so on this
/// account ETH leaves only as gas; the difference covers every transaction
/// that mined, including retries evmlib sent inside one call. ETH arriving on
/// the account in the same window makes the difference smaller, so callers
/// settle with the larger of this and the receipt cost evmlib reports.
async fn eth_spent_since<P: Provider>(provider: &P, payer: alloy::primitives::Address, balance_before: u128) -> Option<u128> {
    let mined = provider.get_transaction_count(payer).await.ok()?;
    let pending = provider.get_transaction_count(payer).pending().await.ok()?;
    if mined != pending {
        return None;
    }
    let after = u128::try_from(provider.get_balance(payer).await.ok()?).ok()?;
    Some(balance_before.saturating_sub(after))
}

/// A settle that could not be written leaves the full reservation on disk,
/// which is the safe side. The payment is already made, so the run goes on.
fn settle_or_warn(result: Res<()>) {
    if let Err(e) = result {
        println!("      WARNING: the ledger file was not updated ({e}); the full reservation stays on disk");
    }
}

/// An environment variable that is set and not empty.
fn env_nonempty(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.trim().is_empty())
}

/// Anvil's first default account. Its key is public.
const ANVIL_ACCOUNT_0: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/// Fee headroom over the network estimate, as a fraction: 2/1 allows the fee
/// to double between the check and the send, within the remaining budget.
const FEE_HEADROOM: (u128, u128) = (2, 1);

/// Deterministic incompressible bytes for a devnet fixture of any size
/// (xorshift64; the same size always gives the same file).
fn fixture_content(len: usize) -> Vec<u8> {
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15 ^ len as u64;
    let mut out = Vec::with_capacity(len + 8);
    while out.len() < len {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        out.extend_from_slice(&state.to_le_bytes());
    }
    out.truncate(len);
    out
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut gate_arg: Option<String> = None;
    let mut file_arg: Option<std::path::PathBuf> = None;
    let mut enforce_gate_artifact = false;
    let mut devnet_fixture = false;
    let mut mainnet = false;
    let mut quote_only = false;
    let mut pay = false;
    let mut node_count: usize = 8;
    let mut payment_mode = PaymentMode::Auto;
    let mut fixture_bytes: Option<usize> = None;
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--gate" => gate_arg = Some(args.next().ok_or("--gate needs a path")?),
            "--enforce-gate-artifact" => enforce_gate_artifact = true,
            "--devnet-fixture" => devnet_fixture = true,
            "--network" => {
                mainnet = match args.next().ok_or("--network needs devnet or mainnet")?.as_str() {
                    "devnet" => false,
                    "mainnet" => true,
                    other => return Err(format!("unknown --network '{other}'").into()),
                }
            }
            "--quote-only" => quote_only = true,
            "--pay" => pay = true,
            "--nodes" => node_count = args.next().ok_or("--nodes needs a count")?.parse()?,
            "--mode" => {
                payment_mode = match args.next().ok_or("--mode needs auto, merkle or single")?.as_str() {
                    "auto" => PaymentMode::Auto,
                    "merkle" => PaymentMode::Merkle,
                    "single" => PaymentMode::Single,
                    other => return Err(format!("unknown --mode '{other}'").into()),
                }
            }
            "--fixture-bytes" => fixture_bytes = Some(args.next().ok_or("--fixture-bytes needs a size")?.parse()?),
            _ if file_arg.is_none() && !a.starts_with("--") => file_arg = Some(std::path::PathBuf::from(a)),
            other => return Err(format!("unexpected argument '{other}'").into()),
        }
    }
    if fixture_bytes.is_some() && file_arg.is_some() {
        return Err("--fixture-bytes and a file path are mutually exclusive".into());
    }
    let file_path = match fixture_bytes {
        Some(n) => {
            let p = std::env::temp_dir().join(format!("ant-extsig-fixture-{n}.bin"));
            std::fs::write(&p, fixture_content(n))?;
            p
        }
        None => file_arg.clone().unwrap_or_else(|| std::env::temp_dir().join("a1-genesis.json")),
    };
    // A file the caller names is treated as the real thing unless it is
    // declared a fixture. Only the harness's own fixtures skip the stop conditions.
    let is_fixture = devnet_fixture || file_arg.is_none();
    if mainnet && is_fixture {
        return Err("REFUSE: --network mainnet takes a real file; fixtures are for the devnet".into());
    }
    if quote_only && pay {
        return Err("--quote-only and --pay are mutually exclusive".into());
    }
    // On mainnet nothing is paid unless it is asked for by name.
    let quote_only = quote_only || (mainnet && !pay);
    let network_name = if mainnet { "arbitrum-one" } else { "devnet" };

    if file_arg.is_none() && fixture_bytes.is_none() && !file_path.exists() {
        let fixture = br#"{"protocol":"ant-extsig","version":"0.2.1","event":"genesis","timestamp":"2026-09-04T05:10:17Z","estate":"beehive-nature","payload":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}"#; // PUBLIC-CONSTANT fixture payload
        std::fs::write(&file_path, fixture)?;
    }

    if !file_path.is_file() {
        return Err(format!("REFUSE: no file at {}", file_path.display()).into());
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

    // -- [1/6] the network: a local swarm with embedded Anvil, or the real one --
    let devnet = if mainnet {
        println!("[1/6] network: Autonomi mainnet, payments on Arbitrum One{}", if quote_only { " (quote only: no key, no wallet, no signature)" } else { "" });
        None
    } else {
        println!("[1/6] starting {node_count}-node LocalDevnet + Anvil...");
        Some(
            LocalDevnet::start(DevnetConfig {
                node_count,
                ..DevnetConfig::default()
            })
            .await?,
        )
    };
    let (bootstrap, evm_network): (Vec<MultiAddr>, evmlib::Network) = match &devnet {
        Some(d) => (
            d.bootstrap_addrs().iter().copied().map(MultiAddr::quic).collect(),
            d.evm_network().clone(),
        ),
        // No explicit peers and no manifest: the installed bootstrap file, or
        // the seeds bundled into ant-core (`config.rs` `resolve_bootstrap_multiaddrs`).
        None => {
            let source = match ant_core::config::load_bootstrap_multiaddrs()? {
                Some(_) => "the installed bootstrap_peers.toml",
                None => "the seeds bundled in ant-core",
            };
            let peers = ant_core::config::resolve_bootstrap_multiaddrs(&[], None)?;
            println!("      bootstrap: {} peer(s) from {source}", peers.len());
            (peers, evmlib::Network::ArbitrumOne)
        }
    };

    // -- [2/6] the estate client connects (NO wallet attached) --------------
    let cfg = ClientConfig {
        allow_loopback: devnet.is_some(),
        ..Default::default()
    };
    let client = Client::connect_multiaddrs(&bootstrap, cfg.clone()).await?;

    // -- [3/6] PREPARE the upload (PaymentMode::Auto) ------------------------
    println!(
        "[3/6] preparing the upload of {} ({} bytes, mode {payment_mode:?})...",
        file_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        std::fs::metadata(&file_path)?.len()
    );
    let prepared = client
        .file_prepare_upload_with_mode(&file_path, Visibility::Public, payment_mode, None)
        .await?;
    let data_map_address = prepared
        .data_map_address
        .expect("public prepare records the DataMap address");
    let addr_hex = hex::encode(data_map_address);
    println!(
        "      {} chunks, DataMap {addr_hex}",
        prepared.total_chunks
    );

    let total_chunks = prepared.total_chunks;
    // Gate stop conditions about the artifact and the client, before any signature.
    let tripped = gate.tripped_stop_conditions(&file_sha256, prepared.total_chunks as u64, gate::CLIENT_VERSION);
    if quote_only {
        // A quote signs nothing, so the conditions are reported, not enforced:
        // a fresh quote is what a re-issued gate is made from.
        if tripped.is_empty() {
            println!("      gate stop conditions: all match the gate");
        }
        for t in &tripped {
            println!("      gate stop condition tripped (reported, a quote signs nothing): {t}");
        }
    } else if is_gate_artifact || enforce_gate_artifact || !is_fixture {
        if !tripped.is_empty() {
            return Err(format!(
                "REFUSE: gate stop conditions tripped before any signature: {}",
                tripped.join("; ")
            )
            .into());
        }
        println!("      gate stop conditions: tar sha256, chunk count and client version all match the gate");
    } else {
        println!("      gate stop conditions: not applied to a devnet fixture; ceilings still apply");
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

    if quote_only {
        println!(
            "QUOTE {}",
            serde_json::to_string_pretty(&json!({
                "network": network_name,
                "client_version": gate::CLIENT_VERSION,
                "captured_unix": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_secs(),
                "file": file_path.display().to_string(),
                "file_size": std::fs::metadata(&file_path)?.len(),
                "file_sha256": file_sha256,
                "file_is_gate_artifact": is_gate_artifact,
                "total_chunks": total_chunks,
                "chunks_already_stored": prepared.already_stored_addresses.len(),
                "payment_arm": payment_arm,
                "payment_mode_requested": format!("{payment_mode:?}"),
                "storage_cost_atto": quote_sum_atto.to_string(),
                "storage_ceiling_atto": max_storage_ceiling_atto.to_string(),
                "gas_ceiling_wei": max_gas_ceiling_wei.to_string(),
                "gate_path": gate.path.display().to_string(),
                "gate_stop_conditions_tripped": tripped,
                "signed": false,
                "wallet_constructed": false,
            }))?
        );
        return Ok(());
    }

    // The member's key. On mainnet it comes only from a file the key holder
    // names; this program never writes it anywhere. On the devnet it is the
    // swarm's funded test account.
    let member_key = match &devnet {
        None => {
            if !gate.upload_enabled {
                return Err(format!(
                    "REFUSE: the gate {} says paymentClientCapability.uploadEnabled is false; nothing is paid on mainnet",
                    gate.path.display()
                )
                .into());
            }
            let key_file = std::env::var("MEMBER_KEY_FILE")
                .map_err(|_| "REFUSE: --network mainnet --pay needs MEMBER_KEY_FILE to name the key holder's key file")?;
            std::fs::read_to_string(&key_file)
                .map_err(|e| format!("REFUSE: cannot read MEMBER_KEY_FILE: {e}"))?
                .trim()
                .to_string()
        }
        Some(d) => std::env::var("MEMBER_PRIVATE_KEY").unwrap_or_else(|_| d.wallet_private_key().to_string()),
    };
    // The member's signer. Its per-gas fee cap is set before each send, from
    // what the gas ledger has left.
    let mut signer = Wallet::new_from_private_key(evm_network.clone(), member_key.trim_start_matches("0x"))?;
    drop(member_key);
    println!("      member payer address: {}", signer.address());
    if mainnet {
        if std::env::var("MEMBER_PRIVATE_KEY").is_ok() {
            println!("      note: MEMBER_PRIVATE_KEY is set and is ignored on mainnet; the key came from MEMBER_KEY_FILE");
        }
        if signer.address().to_string().eq_ignore_ascii_case(ANVIL_ACCOUNT_0) {
            return Err("REFUSE: MEMBER_KEY_FILE holds the public Anvil test key; it must never pay on mainnet".into());
        }
    }

    // -- [4/6] THE MEMBER PAYS -- standalone wallet, out-of-band -------------
    println!("[4/6] member wallet paying ({payment_arm} arm)...");
    let mut paid_atto: u128 = 0;
    let provider = signer.to_provider();
    let vault_address = *evm_network.payment_vault_address();
    let payer = signer.address();

    // The plan-wide gas ledger. Its file is derived from the plan unless
    // ANT_EXTSIG_LEDGER names one, so a rerun of a plan meets its history.
    let plan_id = format!("{network_name}:{payer}:{addr_hex}");
    let ledger_path = match env_nonempty("ANT_EXTSIG_LEDGER") {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            let state_dir = env_nonempty("ANT_EXTSIG_STATE_DIR")
                .or_else(|| env_nonempty("LOCALAPPDATA"))
                .or_else(|| env_nonempty("XDG_STATE_HOME"))
                .or_else(|| env_nonempty("HOME").map(|h| format!("{h}/.local/state")))
                .ok_or("REFUSE: no place for the gas ledger: set ANT_EXTSIG_LEDGER or ANT_EXTSIG_STATE_DIR")?;
            default_ledger_path(std::path::Path::new(&state_dir), &plan_id)
        }
    };
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
            .with_from(payer)
            .with_to(token_contract_addr)
            .with_input(approve_calldata);

        println!("      current vault allowance {current_allowance} < required {required_tokens}; approving EXACT amount...");
        let limit = estimate_limit(&provider, approve_tx, "token_approval").await?;
        let reserve_limit = limit.saturating_mul(SEND_ATTEMPTS);
        let fee = network_fee(&provider, "token_approval").await?;
        let cap = plan_fee_cap(ledger.remaining_wei(), reserve_limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, "token_approval")?;
        println!(
            "      plan [token_approval]: gas_limit={limit} x {SEND_ATTEMPTS} attempts network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
            reserve_limit.saturating_mul(cap),
            ledger.remaining_wei()
        );
        // Do not sign an approval for a payment that clearly cannot fit afterwards.
        let transfers = match &prepared.payment_info {
            ExternalPaymentInfo::WaveBatch { payment_intent, .. } => payment_intent.payments.len() as u128,
            ExternalPaymentInfo::Merkle { prepared_batches, .. } => prepared_batches.len() as u128,
        };
        let floor_limit = payment_floor_limit(limit, transfers);
        // The payment will be reserved for every attempt, so the floor is too.
        let floor_wei = limit.saturating_add(floor_limit).saturating_mul(SEND_ATTEMPTS).saturating_mul(fee);
        println!(
            "      floor [approval + payment lower bound]: ({limit} + {floor_limit}) gas x {SEND_ATTEMPTS} attempts x {fee} wei = {floor_wei} wei (remaining {} wei)",
            ledger.remaining_wei()
        );
        ledger.check_projection(floor_wei, "the approval plus a lower bound for the payment")?;

        signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });
        let balance_before = eth_balance(&provider, payer, "token_approval").await?;
        let entry = ledger.reserve("token_approval", reserve_limit, cap)?;

        // From here a failure leaves the reservation in the ledger.
        let approve_tx_hash = signer.approve_to_spend_tokens(vault_address, approve_amount).await?;
        println!("      exact approval tx submitted: {approve_tx_hash}");
        let receipt_cost = provider
            .get_transaction_receipt(approve_tx_hash)
            .await
            .ok()
            .flatten()
            .map(|r| (r.gas_used as u128).saturating_mul(r.effective_gas_price));
        let balance_spent = eth_spent_since(&provider, payer, balance_before).await;
        match balance_spent.zip(receipt_cost).map(|(b, r)| b.max(r)) {
            Some(cost) => {
                settle_or_warn(ledger.settle(entry, cost));
                println!(
                    "      approval settled at {cost} wei, the larger of balance change {balance_spent:?} and receipt {receipt_cost:?} (ledger exposure {} wei, remaining {} wei)",
                    ledger.exposure_wei(),
                    ledger.remaining_wei()
                );
            }
            None => println!("      approval spend not final on chain; its full reservation stays in the ledger"),
        }
    } else {
        println!("      current vault allowance {current_allowance} >= required {required_tokens}; approval not needed");
    }

    // evmlib's pay calls approve an unlimited amount themselves when the
    // allowance is short (`evmlib` v0.10.0 `wallet.rs`). Never reach them short.
    let allowance_now = signer.token_allowance(vault_address).await?;
    if allowance_now < required_tokens {
        return Err(format!(
            "REFUSE: vault allowance {allowance_now} is below the required {required_tokens} after the approval step; not paying"
        )
        .into());
    }

    // 4b. Payment. The approval is mined, so the payment can be simulated.
    //     Every batch is estimated and the whole payment, with every attempt
    //     evmlib may make, must fit in what remains before the first payment
    //     signature.
    enum Paid { Wave(std::collections::HashMap<ant_protocol::evm::QuoteHash, ant_protocol::evm::TxHash>), Merkle(Vec<[u8; 32]>) }
    let paid = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let payments: Vec<_> = payment_intent.payments.clone();
            paid_atto = payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(u128::MAX);

            let calldata_info = evmlib::external_signer::pay_for_quotes_calldata(&evm_network, payments.clone())?;
            let mut total_limit: u128 = 0;
            for (i, (calldata, _)) in calldata_info.batched_calldata_map.iter().enumerate() {
                let tx = TransactionRequest::default()
                    .with_from(payer)
                    .with_to(calldata_info.to)
                    .with_input(calldata.clone());
                total_limit = total_limit.saturating_add(estimate_limit(&provider, tx, &format!("wave_batch_{i}")).await?);
            }
            let batches = calldata_info.batched_calldata_map.len();
            let stage = format!("wave_payment({batches} tx)");
            if batches == 0 {
                println!("      nothing to pay: no quote payment is due; no payment is signed");
            }
            if batches == 0 {
                Paid::Wave(std::collections::HashMap::new())
            } else {
            let reserve_limit = total_limit.saturating_mul(SEND_ATTEMPTS);
            let fee = network_fee(&provider, &stage).await?;
            let cap = plan_fee_cap(ledger.remaining_wei(), reserve_limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, &stage)?;
            println!(
                "      plan [{stage}]: gas_limit={total_limit} x {SEND_ATTEMPTS} attempts network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
                reserve_limit.saturating_mul(cap),
                ledger.remaining_wei()
            );
            ledger.check_projection(reserve_limit.saturating_mul(cap), &stage)?;
            signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });
            let balance_before = eth_balance(&provider, payer, &stage).await?;
            let entry = ledger.reserve(&stage, reserve_limit, cap)?;

            let (map, gas) = signer.pay_for_quotes(payments.into_iter()).await.map_err(|e| format!("member pay_for_quotes: {e:?}"))?;
            let balance_spent = eth_spent_since(&provider, payer, balance_before).await;
            let settled = balance_spent.map(|b| b.max(gas.gas_cost_wei));
            if let Some(cost) = settled {
                settle_or_warn(ledger.settle(entry, cost));
            }
            println!(
                "      paid {} quote payments: gas_limit_set={} max_fee_set={:?} gas_used={} receipt_cost={} wei balance_change={balance_spent:?} settled={} (ledger exposure {} wei)",
                map.len(),
                gas.gas_with_buffer,
                gas.max_fee_per_gas,
                gas.actual_gas_used,
                gas.gas_cost_wei,
                settled.map_or("not final, reservation kept".to_string(), |c| format!("{c} wei")),
                ledger.exposure_wei()
            );
            Paid::Wave(map.into_iter().collect())
            }
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
                    .with_from(payer)
                    .with_to(calldata_info.to)
                    .with_input(calldata_info.calldata);
                limits.push(estimate_limit(&provider, tx, &format!("merkle_batch_{i}")).await?);
            }
            let total_limit = limits.iter().fold(0u128, |a, l| a.saturating_add(*l));
            let reserve_limit = total_limit.saturating_mul(SEND_ATTEMPTS);
            let stage_all = format!("merkle_payment({} tx)", limits.len());
            let fee = network_fee(&provider, &stage_all).await?;
            let cap = plan_fee_cap(ledger.remaining_wei(), reserve_limit, fee, FEE_HEADROOM.0, FEE_HEADROOM.1, &stage_all)?;
            println!(
                "      plan [{stage_all}]: gas_limit={total_limit} x {SEND_ATTEMPTS} attempts network_fee={fee} fee_cap={cap} worst_case={} wei (remaining {} wei)",
                reserve_limit.saturating_mul(cap),
                ledger.remaining_wei()
            );
            ledger.check_projection(reserve_limit.saturating_mul(cap), &stage_all)?;
            signer.set_transaction_config(TransactionConfig { max_fee_per_gas: MaxFeePerGas::LimitedAuto(cap) });

            let mut winners = Vec::new();
            for (i, b) in prepared_batches.iter().enumerate() {
                let stage = format!("merkle_batch_{i}");
                let balance_before = eth_balance(&provider, payer, &stage).await?;
                let entry = ledger.reserve(&stage, limits[i].saturating_mul(SEND_ATTEMPTS), cap)?;
                let (winner, amount, gas) = signer
                    .pay_for_merkle_tree(b.depth, b.pool_commitments.clone(), b.merkle_payment_timestamp)
                    .await?;
                let balance_spent = eth_spent_since(&provider, payer, balance_before).await;
            let settled = balance_spent.map(|b| b.max(gas.gas_cost_wei));
                if let Some(cost) = settled {
                    settle_or_warn(ledger.settle(entry, cost));
                }
                println!(
                    "      batch {i}: depth={}, paid {amount} atto, winner {}, gas_used={} receipt_cost={} wei balance_change={balance_spent:?} settled={} (ledger exposure {} wei)",
                    b.depth,
                    hex::encode(winner),
                    gas.actual_gas_used,
                    gas.gas_cost_wei,
                    settled.map_or("not final, reservation kept".to_string(), |c| format!("{c} wei")),
                    ledger.exposure_wei()
                );
                paid_atto = paid_atto.saturating_add(amount.to_string().parse::<u128>().unwrap_or(u128::MAX));
                winners.push(winner);
            }
            Paid::Merkle(winners)
        }
    };

    // The ledger is the aggregate. A breach here means the payer's balance
    // fell by more than was reserved; it is reported, never hidden.
    let total_gas_wei = ledger.exposure_wei();
    let breach = (total_gas_wei > max_gas_ceiling_wei).then(|| {
        format!(
            "BREACH: gas ledger exposure {total_gas_wei} wei exceeds the gate ceiling {max_gas_ceiling_wei} wei by {} wei",
            total_gas_wei - max_gas_ceiling_wei
        )
    });
    if let Some(b) = &breach {
        println!("      {b}; the storage is already paid, so the upload is finalized and this run exits with an error");
    }

    // -- [5/6] THE INTERRUPT: the estate client is DESTROYED; a FRESH client
    //          reconnects and finalizes with the member's payment -- no quote
    verify_storage_ceiling(paid_atto, max_storage_ceiling_atto, "pre_finalize")?;

    drop(client);
    println!("[5/6] INTERRUPT: client destroyed -- reconnecting FRESH for the resume...");
    let fresh_client = Client::connect_multiaddrs(&bootstrap, cfg).await?;
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
    let out = std::env::temp_dir().join(format!("ant-extsig-roundtrip-{}.bin", std::process::id()));
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
            "network": network_name,
            "node_count": devnet.as_ref().map(|_| node_count),
            "payment_mode_requested": format!("{payment_mode:?}"),
            "total_chunks": total_chunks,
            "estate_client_held_wallet": false,
            "upload_result_debug": format!("{result:?}").chars().take(120).collect::<String>(),
        }))?
    );
    match breach {
        Some(b) => Err(b.into()),
        None => Ok(()),
    }
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
    fn fixture_is_deterministic_and_exactly_sized() {
        assert_eq!(fixture_content(1_000_003).len(), 1_000_003);
        assert_eq!(fixture_content(4096), fixture_content(4096));
        assert_ne!(fixture_content(4096), fixture_content(4097)[..4096].to_vec());
    }

    #[test]
    fn merkle_cost_of_no_pools_is_zero() {
        let network = evmlib::Network::ArbitrumOne;
        assert_eq!(network.estimate_merkle_payment_cost(4, &[]), Amount::ZERO);
    }
}
