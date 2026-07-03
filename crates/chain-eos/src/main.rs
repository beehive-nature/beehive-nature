//! chain-eos Phase 1 binary: connect to a SHIP WebSocket, stream blocks,
//! print `Block Number: [N], Action Count: [M]`.
//!
//! SHIP handshake: on connect the server sends its ABI as one text frame;
//! the client then sends binary requests. Phase 1 asks for status (to learn
//! the head block) and then streams blocks from head with `fetch_block`.
//!
//! Endpoint: `SHIP_WS_URL` env var, else `ws://127.0.0.1:8080` (the nodeos
//! `state-history-endpoint` default). No live node was available when this
//! was written (brief §6 prereq), so the mock path is the test suite in
//! `lib.rs`; this binary is the real-endpoint path for when one exists.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use chain_eos::{
    decode_result, encode_get_blocks_request, encode_get_status_request, extract_actions,
    summarize_signed_block, ShipResult,
};

const DEFAULT_WS_URL: &str = "ws://127.0.0.1:8080";
const MAX_BACKOFF: Duration = Duration::from_secs(60);

#[tokio::main]
async fn main() {
    let url = std::env::var("SHIP_WS_URL").unwrap_or_else(|_| DEFAULT_WS_URL.to_string());
    let mut backoff = Duration::from_secs(1);

    loop {
        eprintln!("chain-eos: connecting to {url}");
        match run(&url).await {
            Ok(()) => {
                eprintln!("chain-eos: stream ended cleanly; reconnecting");
                backoff = Duration::from_secs(1);
            }
            Err(e) => {
                eprintln!("chain-eos: error: {e}; retrying in {backoff:?}");
            }
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

async fn run(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let (mut ws, _response) = connect_async(url).await?;

    // 1. Server speaks first: the state-history ABI as a text frame.
    let abi = expect_message(&mut ws).await?;
    match abi {
        Message::Text(t) => eprintln!("chain-eos: received SHIP ABI ({} bytes)", t.len()),
        other => return Err(format!("expected ABI text frame, got {other:?}").into()),
    }

    // 2. Learn the head block.
    ws.send(Message::Binary(encode_get_status_request().into()))
        .await?;
    let head = loop {
        match expect_message(&mut ws).await? {
            Message::Binary(bin) => match decode_result(&bin)? {
                ShipResult::Status(s) => break s.head,
                other => return Err(format!("expected status result, got {other:?}").into()),
            },
            Message::Ping(p) => ws.send(Message::Pong(p)).await?,
            Message::Close(frame) => return Err(format!("server closed: {frame:?}").into()),
            _ => {}
        }
    };
    eprintln!(
        "chain-eos: head block {} (lib {})",
        head.block_num, head.block_num
    );

    // 3. Stream blocks from head.
    ws.send(Message::Binary(
        encode_get_blocks_request(head.block_num).into(),
    ))
    .await?;

    loop {
        match expect_message(&mut ws).await? {
            Message::Binary(bin) => {
                let ShipResult::Blocks(b) = decode_result(&bin)? else {
                    continue;
                };
                let Some(this_block) = b.this_block else {
                    continue; // head-only heartbeat
                };
                match b.block.as_deref() {
                    Some(bytes) => match summarize_signed_block(bytes) {
                        Ok(summary) => {
                            println!(
                                "Block Number: {}, Action Count: {}",
                                this_block.block_num, summary.action_count
                            );
                            if summary.action_count > 0 {
                                if let Ok(actions) = extract_actions(bytes) {
                                    let shown: Vec<String> = actions
                                        .iter()
                                        .take(3)
                                        .map(|a| format!("{}::{}", a.account, a.name))
                                        .collect();
                                    let more = if actions.len() > 3 { ", …" } else { "" };
                                    eprintln!("  actions: {}{more}", shown.join(", "));
                                }
                            }
                        }
                        Err(e) => eprintln!(
                            "chain-eos: block {} decode error: {e}",
                            this_block.block_num
                        ),
                    },
                    None => println!(
                        "Block Number: {}, Action Count: [block body not sent]",
                        this_block.block_num
                    ),
                }
            }
            Message::Ping(p) => ws.send(Message::Pong(p)).await?,
            Message::Close(frame) => return Err(format!("server closed: {frame:?}").into()),
            _ => {}
        }
    }
}

async fn expect_message<S>(
    ws: &mut tokio_tungstenite::WebSocketStream<S>,
) -> Result<Message, Box<dyn std::error::Error>>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    match ws.next().await {
        Some(msg) => Ok(msg?),
        None => Err("connection ended unexpectedly".into()),
    }
}
