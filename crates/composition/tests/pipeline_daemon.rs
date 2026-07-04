//! The daemon, end to end in-process: a mock SHIP server feeds real wire
//! bytes; the pipeline ingests, normalizes, buses, applies escrow
//! transitions, offers them to the DRO, and accumulates reputation —
//! then drains clean on both exit paths (stream end and shutdown signal).
//!
//! Honest boundary asserted below: chain ingest currently maps only
//! `zano::transfer → OrderFunded` (§9.3 has exactly two mappings and one
//! is a Vaulta action), so no *terminal* escrow state is reachable from
//! the wire alone — the settlement-intent list is expected EMPTY here,
//! while the escrow→DRO channel is still exercised by both an accepted
//! and a rejected transition. Intent *decisions* are dro-signer's tests.

use composition::{run, PipelineConfig};
use escrow_core::{Escrow, EscrowState, PublicKey, FEE_BUFFER};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

use chain_eos::blobs::{
    blocks_result_blob, packed_trx_named, put_receipt_for, signed_block, status_result_blob,
};

const HEAD: u32 = 4_000;
const AMOUNT: u64 = 7_000_000;

fn put_str(out: &mut Vec<u8>, s: &str) {
    assert!(s.len() < 128);
    out.push(s.len() as u8);
    out.extend_from_slice(s.as_bytes());
}

fn transfer_data(order_id: &str, fee_buffer: Option<u64>) -> Vec<u8> {
    let mut d = Vec::new();
    put_str(&mut d, order_id);
    put_str(&mut d, "did:plc:buyer");
    put_str(&mut d, "did:plc:seller");
    d.extend_from_slice(&AMOUNT.to_le_bytes());
    put_str(&mut d, "fusd-asset-id");
    match fee_buffer {
        Some(v) => {
            d.push(1);
            d.extend_from_slice(&v.to_le_bytes());
        }
        None => d.push(0),
    }
    put_str(&mut d, "msig-comp");
    d.extend_from_slice(&1_782_300_000u32.to_le_bytes());
    d
}

fn funding_block(block_num: u32, order_id: &str, fee_buffer: Option<u64>) -> Vec<u8> {
    let trx = packed_trx_named(&[("zano", "transfer", &transfer_data(order_id, fee_buffer))]);
    let mut receipt = Vec::new();
    put_receipt_for(&mut receipt, &trx, 0);
    signed_block(block_num, &[receipt])
}

fn escrow(order_id: &str) -> Escrow {
    Escrow::new(
        order_id,
        "msig-comp",
        PublicKey([1; 32]),
        PublicKey([2; 32]),
        PublicKey([3; 32]),
        AMOUNT,
        Some("fusd-asset-id".into()),
        FEE_BUFFER,
        time::macros::datetime!(2026-07-04 10:00 UTC),
    )
}

/// Mock SHIP server: handshake, then the given blocks; closes the socket
/// afterwards iff `close_after` (otherwise holds it open forever, for
/// the shutdown test).
async fn mock_server(listener: TcpListener, blocks: Vec<Vec<u8>>, close_after: bool) {
    let (stream, _) = listener.accept().await.unwrap();
    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
    ws.send(Message::Text(
        r#"{"version":"eosio::state_history"}"#.into(),
    ))
    .await
    .unwrap();
    let _status_req = ws.next().await.unwrap().unwrap();
    ws.send(Message::Binary(status_result_blob(HEAD, HEAD - 1).into()))
        .await
        .unwrap();
    let _blocks_req = ws.next().await.unwrap().unwrap();
    for (i, block) in blocks.iter().enumerate() {
        ws.send(Message::Binary(
            blocks_result_blob(HEAD + i as u32, Some(block)).into(),
        ))
        .await
        .unwrap();
    }
    if close_after {
        ws.close(None).await.unwrap();
    } else {
        // Hold the connection open; the pipeline must exit via shutdown.
        tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
    }
}

#[tokio::test]
async fn full_pipeline_flows_and_drains_on_stream_end() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    // Block 1: full funding for order-a. Block 2: a SECOND funding for
    // the same order — the state machine must reject it, and the
    // rejection must still flow to the DRO channel (which settles
    // neither: Funded is not fund-moving, rejections never settle).
    let blocks = vec![
        funding_block(HEAD, "order-a", Some(FEE_BUFFER)),
        funding_block(HEAD + 1, "order-a", Some(FEE_BUFFER)),
    ];
    let server = tokio::spawn(mock_server(listener, blocks, true));

    let mut config = PipelineConfig::new(format!("ws://{addr}"));
    config.escrows = vec![escrow("order-a")];
    let (_tx, rx) = tokio::sync::watch::channel(false);

    let report = tokio::time::timeout(std::time::Duration::from_secs(10), run(config, rx))
        .await
        .expect("pipeline must end when the stream ends");
    server.await.unwrap();

    assert_eq!(report.blocks_seen, 2);
    assert_eq!(report.events_published, 2);
    // Drain proof: every published event reached every consumer.
    assert_eq!(report.escrow_events_seen, 2);
    assert_eq!(report.reputation_events_seen, 2);

    // Transition 1 accepted, transition 2 rejected — both recorded.
    assert_eq!(report.applied.len(), 2);
    assert_eq!(report.applied[0].result, Ok(EscrowState::Funded));
    assert!(report.applied[1].result.is_err());

    // Honest boundary: no terminal state is reachable from chain ingest
    // yet (only OrderFunded maps), so no settlement intents — and none
    // invented.
    assert!(report.settlement_intents.is_empty());
    assert!(!report.shutdown_requested);
}

/// Minimal HTTP/1.1 mock for the Zano wallet RPC: answers every POST
/// with the configured body (or 500). Connection-per-request.
async fn mock_wallet_rpc(listener: TcpListener, response: Result<String, ()>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    loop {
        let Ok((mut stream, _)) = listener.accept().await else {
            return;
        };
        let response = response.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 4096];
            let mut read = 0;
            // Read until end of headers (the tiny request fits one buffer).
            loop {
                match stream.read(&mut buf[read..]).await {
                    Ok(0) => return,
                    Ok(n) => {
                        read += n;
                        if buf[..read].windows(4).any(|w| w == b"\r\n\r\n") {
                            break;
                        }
                        if read == buf.len() {
                            return;
                        }
                    }
                    Err(_) => return,
                }
            }
            let reply = match &response {
                Ok(body) => format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                ),
                Err(()) =>
                    "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                        .to_string(),
            };
            let _ = stream.write_all(reply.as_bytes()).await;
        });
    }
}

fn zano_balance_json(asset_unlocked: u64, native_unlocked: u64) -> String {
    format!(
        r#"{{"id":"0","jsonrpc":"2.0","result":{{"balance":{native_unlocked},"unlocked_balance":{native_unlocked},"balances":[{{"asset_info":{{"asset_id":"fusd-asset-id","ticker":"FUSD","decimal_point":4}},"total":{asset_unlocked},"unlocked":{asset_unlocked}}}]}}}}"#
    )
}

fn zano_config(rpc_addr: std::net::SocketAddr, order_id: &str) -> composition::ZanoIngestConfig {
    composition::ZanoIngestConfig {
        rpc_url: format!("http://{rpc_addr}/json_rpc"),
        poll_interval_secs: 1,
        asset_id: "fusd-asset-id".into(),
        watch: vec![composition::ZanoWatchTarget {
            order_id: order_id.into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            multisig_address: "msig-comp".into(),
        }],
    }
}

#[tokio::test]
async fn dual_chain_ingestion_feeds_one_bus() {
    // EOS side: one funding block, then the socket is held open.
    let ship_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let ship_addr = ship_listener.local_addr().unwrap();
    let ship = tokio::spawn(mock_server(
        ship_listener,
        vec![funding_block(HEAD, "order-a", Some(FEE_BUFFER))],
        false,
    ));

    // Zano side: wallet RPC reporting a fully funded balance.
    let rpc_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let rpc_addr = rpc_listener.local_addr().unwrap();
    let rpc = tokio::spawn(mock_wallet_rpc(
        rpc_listener,
        Ok(zano_balance_json(AMOUNT, FEE_BUFFER)),
    ));

    let mut config = PipelineConfig::new(format!("ws://{ship_addr}"));
    config.escrows = vec![escrow("order-a"), escrow("order-z")];
    config.zano = Some(zano_config(rpc_addr, "order-z"));

    let (tx, rx) = tokio::sync::watch::channel(false);
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(1_500)).await;
        let _ = tx.send(true);
    });
    let report = tokio::time::timeout(std::time::Duration::from_secs(8), run(config, rx))
        .await
        .expect("dual-chain run must end on shutdown");
    ship.abort();
    rpc.abort();

    // Both sense organs fed the same bus; both escrows funded.
    assert_eq!(report.blocks_seen, 1);
    assert!(report.zano_scans >= 1);
    assert_eq!(report.events_published, 2);
    assert_eq!(report.escrow_events_seen, 2);
    assert_eq!(report.reputation_events_seen, 2);
    let funded: Vec<_> = report
        .applied
        .iter()
        .filter(|a| a.result == Ok(EscrowState::Funded))
        .map(|a| a.order_id.clone())
        .collect();
    assert!(
        funded.contains(&"order-a".to_string()),
        "EOS-fed escrow funded"
    );
    assert!(
        funded.contains(&"order-z".to_string()),
        "Zano-fed escrow funded"
    );
}

#[tokio::test]
async fn zano_outage_never_stops_the_eos_path() {
    let ship_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let ship_addr = ship_listener.local_addr().unwrap();
    let ship = tokio::spawn(mock_server(
        ship_listener,
        vec![funding_block(HEAD, "order-a", Some(FEE_BUFFER))],
        false,
    ));

    // Zano wallet RPC is down hard: every request answers 500.
    let rpc_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let rpc_addr = rpc_listener.local_addr().unwrap();
    let rpc = tokio::spawn(mock_wallet_rpc(rpc_listener, Err(())));

    let mut config = PipelineConfig::new(format!("ws://{ship_addr}"));
    config.escrows = vec![escrow("order-a"), escrow("order-z")];
    config.zano = Some(zano_config(rpc_addr, "order-z"));

    let (tx, rx) = tokio::sync::watch::channel(false);
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(1_500)).await;
        let _ = tx.send(true);
    });
    let report = tokio::time::timeout(std::time::Duration::from_secs(8), run(config, rx))
        .await
        .expect("outage must not hang the daemon");
    ship.abort();
    rpc.abort();

    // The EOS path was untouched by the Zano outage.
    assert_eq!(report.events_published, 1);
    assert_eq!(report.applied.len(), 1);
    assert_eq!(report.applied[0].order_id, "order-a");
    assert_eq!(report.applied[0].result, Ok(EscrowState::Funded));
    // The Zano task kept retrying instead of dying.
    assert!(report.zano_scans >= 1);
}

#[tokio::test]
async fn shutdown_signal_drains_and_exits_without_hanging() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    // One block, then the server holds the socket open forever.
    let blocks = vec![funding_block(HEAD, "order-b", Some(FEE_BUFFER))];
    let server = tokio::spawn(mock_server(listener, blocks, false));

    let mut config = PipelineConfig::new(format!("ws://{addr}"));
    config.escrows = vec![escrow("order-b")];
    let (tx, rx) = tokio::sync::watch::channel(false);

    // Flip shutdown from a timer task; run() itself stays on this task
    // (its future is !Send by way of chain-eos's boxed stream errors).
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        let _ = tx.send(true);
    });

    let report = tokio::time::timeout(std::time::Duration::from_secs(5), run(config, rx))
        .await
        .expect("shutdown must not hang");
    server.abort();

    assert!(report.shutdown_requested);
    assert_eq!(report.blocks_seen, 1);
    assert_eq!(report.events_published, 1);
    // Nothing in flight was dropped on the way out.
    assert_eq!(report.escrow_events_seen, 1);
    assert_eq!(report.reputation_events_seen, 1);
    assert_eq!(report.applied.len(), 1);
    assert_eq!(report.applied[0].result, Ok(EscrowState::Funded));
}
