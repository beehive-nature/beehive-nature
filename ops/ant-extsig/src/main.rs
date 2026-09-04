//! ant-extsig — THE MEMBER-SIGNED MEMORY WRITE (the vending machine's ANT layer).
//!
//! Proves the external-signer Merkle upload the vending spec gates on
//! (storage-substrate-split item 8), in the shape of the vendor's own
//! `external-merkle-large` example — plus an interrupt/resume the example
//! does not do: after the member pays, the estate CLIENT IS DESTROYED
//! (connection + all network state dropped) and a FRESH client finalizes
//! the upload with the member's payment. The finalize path carries no quote
//! call — the member's on-chain payment is the only payment proof.
//!
//! CUSTODY: the payer is a standalone evmlib `Wallet` fed a key from a
//! member-controlled file (in production: the member's WAGMI/MetaMask —
//! ADR-0003's "every keyless consumer" flow; identical EVM signing, same
//! custody boundary). The estate `Client` never receives the wallet.

use ant_core::data::{
    Client, ClientConfig, ExternalPaymentInfo, LocalDevnet, PaymentMode, Visibility,
};
use ant_node::devnet::DevnetConfig;
use ant_protocol::evm::Wallet;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let file_path = std::env::args()
        .nth(2)
        .unwrap_or_else(|| "a1-genesis.json".to_string());

    // ── [1/6] the swarm: real ant-nodes + embedded Anvil (member-paid EVM) ──
    println!("[1/6] starting 8-node LocalDevnet + Anvil...");
    let devnet = LocalDevnet::start(DevnetConfig {
        node_count: 8,
        ..DevnetConfig::default()
    })
    .await?;
    let bootstrap = devnet.bootstrap_addrs();
    let evm_network = devnet.evm_network().clone();

    // THE MEMBER'S KEY — held in a file the member controls; on mainnet this
    // is the member's browser wallet. The estate client never sees it.
    let member_key = {
        let k = devnet.wallet_private_key().to_string(); // devnet-funded stand-in
        std::fs::write("/tmp/ant-extsig-member-key.txt", &k)?;
        k
    };
    let signer = Wallet::new_from_private_key(evm_network.clone(), member_key.trim_start_matches("0x"))?;
    println!("      member payer address: {}", signer.address());

    // ── [2/6] the estate client connects (NO wallet attached) ──────────────
    let cfg = ClientConfig {
        allow_loopback: bootstrap.iter().any(|a| a.ip().is_loopback()),
        ..Default::default()
    };
    let client = Client::connect(&bootstrap, cfg.clone()).await?;

    // ── [3/6] PREPARE the a1-genesis upload (merkle, Auto mode) ────────────
    println!("[3/6] preparing the a1-genesis upload...");
    let prepared = client
        .file_prepare_upload_with_mode(std::path::Path::new(&file_path), Visibility::Public, PaymentMode::Merkle, None)
        .await?;
    let data_map_address = prepared
        .data_map_address
        .expect("public prepare records the DataMap address");
    let addr_hex = hex::encode(data_map_address);
    println!(
        "      {} chunks, DataMap {addr_hex}",
        prepared.total_chunks
    );

    // the 318 B genesis is 4 chunks — BELOW the 64-chunk merkle threshold —
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
            println!("      arm: MERKLE ({} batch(es))", prepared_batches.len());
            "merkle"
        }
        other => return Err(format!("unexpected payment info: {other:?}").into()),
    };

    // ── [4/6] THE MEMBER PAYS — standalone wallet, out-of-band ─────────────
    // wave: one pay_for_quotes tx batch -> quote-hash -> tx-hash map
    // merkle: one pay_for_merkle_tree tx per batch -> winner hashes
    println!("[4/6] member wallet paying ({payment_arm} arm)...");
    let mut paid_atto: u128 = 0;
    enum Paid { Wave(std::collections::HashMap<ant_protocol::evm::QuoteHash, ant_protocol::evm::TxHash>), Merkle(Vec<[u8; 32]>) }
    let paid = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let payments: Vec<_> = payment_intent.payments.clone();
            paid_atto = payment_intent.total_amount.to_string().parse::<u128>().unwrap_or(0);
            let (map, _gas) = signer.pay_for_quotes(payments.into_iter()).await.map_err(|e| format!("member pay_for_quotes: {e:?}"))?;
            println!("      paid {} quote payments", map.len());
            Paid::Wave(map.into_iter().collect())
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let mut winners = Vec::new();
            for (i, b) in prepared_batches.iter().enumerate() {
                let (winner, amount, _gas) = signer
                    .pay_for_merkle_tree(b.depth, b.pool_commitments.clone(), b.merkle_payment_timestamp)
                    .await?;
                println!("      batch {i}: depth={}, paid {amount} atto, winner {}", b.depth, hex::encode(winner));
                paid_atto += amount.to_string().parse::<u128>().unwrap_or(0);
                winners.push(winner);
            }
            Paid::Merkle(winners)
        }
        _ => unreachable!("arm matched above"),
    };

    // ── [5/6] THE INTERRUPT: the estate client is DESTROYED; a FRESH client
    //          reconnects and finalizes with the member's payment — no quote
    drop(client);
    println!("[5/6] INTERRUPT: client destroyed — reconnecting FRESH for the resume...");
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

    // ── [6/6] round-trip: download what the member paid to store ───────────
    let data_map = fresh_client.data_map_fetch(&data_map_address).await?;
    let out = std::env::temp_dir().join("ant-extsig-roundtrip.json");
    let written = fresh_client.file_download(&data_map, &out).await?;
    let orig = std::fs::read(&file_path)?;
    let got = std::fs::read(&out)?;
    assert_eq!(orig, got, "round-trip must be byte-identical");

    println!(
        "RECEIPT {}",
        serde_json::to_string_pretty(&json!({
            "file": file_path,
            "data_map_address": addr_hex,
            "bytes_stored": written,
            "payment_arm": payment_arm,
            "winner_hashes": winner_report,
            "paid_atto": paid_atto.to_string(),
            "payer_address": signer.address().to_string(),
            "interrupt": "client destroyed after payment; fresh client finalized",
            "resumed_without_new_quote": true,
            "roundtrip_byte_identical": true,
            "estate_client_held_wallet": false,
            "upload_result_debug": format!("{result:?}").chars().take(120).collect::<String>(),
        }))?
    );
    Ok(())
}
