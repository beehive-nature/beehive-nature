//! Brief §6: "integration test against real node or mock WS server fed a
//! pre-recorded SHIP blob." This is the mock-server path: a real
//! tokio-tungstenite server speaks the SHIP handshake over a live local
//! socket, and the production `stream_ship` engine consumes it.
//!
//! The server script asserts what the CLIENT sends (status request, then a
//! get_blocks request starting at the advertised head) — so this tests both
//! directions of the protocol, not just our decoding.

use chain_eos::blobs::{
    blocks_result_blob, packed_trx_named, put_receipt_for, signed_block, status_result_blob,
};
use chain_eos::{extract_actions, stream_ship, summarize_signed_block, StreamEvent};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

const HEAD: u32 = 500;

/// A block containing one lovismarket::addlisting action.
fn block_500() -> Vec<u8> {
    let trx = packed_trx_named(&[("lovismarket", "addlisting", &[0xAB, 0xCD])]);
    let mut receipt = Vec::new();
    put_receipt_for(&mut receipt, &trx, 0);
    signed_block(HEAD, &[receipt])
}

async fn mock_ship_server(listener: TcpListener) {
    let (stream, _) = listener.accept().await.expect("client connects");
    let mut ws = tokio_tungstenite::accept_async(stream)
        .await
        .expect("ws handshake");

    // 1. Server speaks first: the ABI text frame.
    ws.send(Message::Text(
        r#"{"version":"eosio::state_history"}"#.into(),
    ))
    .await
    .unwrap();

    // 2. Expect get_status_request_v0 (binary [0]).
    let msg = ws.next().await.unwrap().unwrap();
    assert_eq!(
        msg.into_data().as_ref(),
        &[0u8][..],
        "client must ask for status first"
    );
    ws.send(Message::Binary(status_result_blob(HEAD, HEAD - 3).into()))
        .await
        .unwrap();

    // 3. Expect get_blocks_request_v0 starting at the head we advertised.
    let msg = ws.next().await.unwrap().unwrap();
    let req = msg.into_data();
    assert_eq!(req[0], 1, "variant: get_blocks_request_v0");
    assert_eq!(&req[1..5], &HEAD.to_le_bytes(), "streams from head");

    // 4. Stream two blocks: one with a body, one without. Then close.
    ws.send(Message::Binary(
        blocks_result_blob(HEAD, Some(&block_500())).into(),
    ))
    .await
    .unwrap();
    ws.send(Message::Binary(blocks_result_blob(HEAD + 1, None).into()))
        .await
        .unwrap();
    ws.close(None).await.unwrap();
}

#[tokio::test]
async fn stream_ship_speaks_the_full_handshake_against_a_mock_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(mock_ship_server(listener));

    let mut events = Vec::new();
    stream_ship(&format!("ws://{addr}"), None, |e| events.push(e))
        .await
        .expect("clean close is Ok");
    server.await.expect("server task asserts passed");

    // Event sequence: ABI, head, block with body, block without.
    assert_eq!(events.len(), 4, "events: {events:?}");
    assert!(matches!(events[0], StreamEvent::AbiReceived { bytes } if bytes > 0));
    assert_eq!(events[1], StreamEvent::Head { block_num: HEAD });

    let StreamEvent::Block {
        block_num,
        block: Some(bytes),
    } = &events[2]
    else {
        panic!("expected block with body, got {:?}", events[2]);
    };
    assert_eq!(*block_num, HEAD);
    // The streamed body decodes with the same tools the binary uses:
    let summary = summarize_signed_block(bytes).unwrap();
    assert_eq!(summary.block_num_from_header, HEAD);
    assert_eq!(summary.action_count, 1);
    let actions = extract_actions(bytes).unwrap();
    assert_eq!(actions[0].account, "lovismarket");
    assert_eq!(actions[0].name, "addlisting");
    assert_eq!(actions[0].data, vec![0xAB, 0xCD]);

    assert_eq!(
        events[3],
        StreamEvent::Block {
            block_num: HEAD + 1,
            block: None
        }
    );
}

/// Watermark resume (§6 stretch): with an explicit start block the client
/// must skip the status round trip and ask for blocks immediately.
async fn mock_resume_server(listener: TcpListener, expected_start: u32) {
    let (stream, _) = listener.accept().await.expect("client connects");
    let mut ws = tokio_tungstenite::accept_async(stream)
        .await
        .expect("ws handshake");

    ws.send(Message::Text(
        r#"{"version":"eosio::state_history"}"#.into(),
    ))
    .await
    .unwrap();

    // FIRST client message must already be get_blocks — no status request.
    let msg = ws.next().await.unwrap().unwrap();
    let req = msg.into_data();
    assert_eq!(req[0], 1, "resume path must skip get_status");
    assert_eq!(
        &req[1..5],
        &expected_start.to_le_bytes(),
        "resumes at watermark+1"
    );

    ws.send(Message::Binary(
        blocks_result_blob(expected_start, None).into(),
    ))
    .await
    .unwrap();
    ws.close(None).await.unwrap();
}

#[tokio::test]
async fn resume_from_watermark_skips_status_round_trip() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(mock_resume_server(listener, 7_001));

    let mut events = Vec::new();
    stream_ship(&format!("ws://{addr}"), Some(7_001), |e| events.push(e))
        .await
        .expect("clean close is Ok");
    server.await.expect("server task asserts passed");

    assert_eq!(
        events,
        vec![
            StreamEvent::AbiReceived { bytes: 34 },
            StreamEvent::Head { block_num: 7_001 },
            StreamEvent::Block {
                block_num: 7_001,
                block: None
            },
        ]
    );
}
