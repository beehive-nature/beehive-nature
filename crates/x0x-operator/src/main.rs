//! x0x-operator — WebRTC operator channel (OPERATORS.md build step 1).
//!
//! Modes:
//!   offer  (operator/laptop): create offer -> file, read answer <-
//!          file, send the sealed envelope over the data channel,
//!          write the returned receipt to file.
//!   answer (box): read offer, write answer, drop each envelope
//!          into the x0x-control inbox atomically, poll the outbox,
//!          send the receipt back on the same channel.
//! Signaling travels by file for this proof (ferried by whatever
//! leg works); the data plane is the direct RTCDataChannel.

use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use webrtc::api::APIBuilder;
use webrtc::data_channel::RTCDataChannel;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;

#[derive(Serialize, Deserialize)]
struct Sdp {
    sdp: String,
    #[serde(rename = "type")]
    kind: String,
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == name).map(|w| w[1].clone())
}

async fn write_sdp(path: &str, desc: &RTCSessionDescription) -> Result<(), Box<dyn std::error::Error>> {
    let text = serde_json::to_string(&Sdp {
        sdp: desc.sdp.clone(),
        kind: format!("{:?}", desc.sdp_type).to_lowercase(),
    })?;
    std::fs::write(path, text)?;
    Ok(())
}

async fn read_sdp(path: &str) -> Result<RTCSessionDescription, Box<dyn std::error::Error>> {
    let text = std::fs::read_to_string(path)?;
    let parsed: Sdp = serde_json::from_str(&text)?;
    Ok(match parsed.kind.as_str() {
        "offer" => RTCSessionDescription::offer(parsed.sdp)?,
        _ => RTCSessionDescription::answer(parsed.sdp)?,
    })
}

async fn wait_file(path: &str, secs: u64) -> Result<String, Box<dyn std::error::Error>> {
    for _ in 0..secs {
        if let Ok(t) = std::fs::read_to_string(path) {
            if !t.is_empty() {
                return Ok(t);
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    Err(format!("timed out waiting for {path}").into())
}

fn build_api() -> Result<webrtc::api::API, Box<dyn std::error::Error>> {
    // Pin ephemeral UDP to a narrow, firewall-known range so a host
    // can open exactly these ports for operator traffic and no more.
    let mut setting = webrtc::api::setting_engine::SettingEngine::default();
    setting.set_udp_network(webrtc::ice::udp_network::UDPNetwork::Ephemeral(
        webrtc::ice::udp_network::EphemeralUDP::new(50000, 50099)
            .map_err(|e| format!("{e}"))?,
    ));
    Ok(APIBuilder::new().with_setting_engine(setting).build())
}

async fn offer_mode(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let envelope_path = arg(args, "--envelope").unwrap();
    let offer_out = arg(args, "--offer-out").unwrap();
    let answer_in = arg(args, "--answer-in").unwrap();
    let receipt_out = arg(args, "--receipt-out").unwrap();

    let api = build_api()?;
    // No third-party STUN, ever (BNROSE adapter doctrine): direct
    // host candidates through file signaling; estate-hosted STUN is
    // the only sanctioned addition when this lane resumes.
    let config = RTCConfiguration::default();
    let pc = Arc::new(api.new_peer_connection(config).await?);
    let dc = pc.create_data_channel("x0x-control", None).await?;
    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<String>(1);

    let env_text = std::fs::read_to_string(&envelope_path)?;
    let dc2 = dc.clone();
    dc.on_open(Box::new(move || {
        let dc3 = dc2.clone();
        let payload = env_text.clone();
        Box::pin(async move {
            let _ = dc3.send_text(payload).await;
            println!("OPERATOR: envelope sent over data channel");
        })
    }));
    dc.on_message(Box::new(move |msg| {
        let tx = done_tx.clone();
        Box::pin(async move {
            let text = String::from_utf8_lossy(&msg.data).into_owned();
            let _ = tx.send(text).await;
        })
    }));

    let offer = pc.create_offer(None).await?;
    pc.set_local_description(offer).await?;
    let _ = pc.gathering_complete_promise().await.recv().await;
    let local = pc.local_description().await.unwrap();
    write_sdp(&offer_out, &local).await?;
    println!("OPERATOR: offer written");

    let _ = wait_file(&answer_in, 600).await?;
    pc.set_remote_description(read_sdp(&answer_in).await?).await?;
    println!("OPERATOR: answer set, ICE connecting");

    let receipt = tokio::time::timeout(Duration::from_secs(600), done_rx.recv())
        .await?
        .ok_or("channel closed without receipt")?;
    std::fs::write(&receipt_out, &receipt)?;
    let v: serde_json::Value = serde_json::from_str(&receipt)?;
    println!("OPERATOR: receipt verdict = {}", v["verdict"]);
    println!("ROUNDTRIP COMPLETE");
    Ok(())
}

async fn answer_mode(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let offer_in = arg(args, "--offer-in").unwrap();
    let answer_out = arg(args, "--answer-out").unwrap();
    let state_dir = arg(args, "--state-dir").unwrap_or_else(|| "/var/lib/x0x-control".into());
    let inbox = format!("{state_dir}/inbox");
    let outbox = format!("{state_dir}/outbox");
    std::fs::create_dir_all(&inbox)?;
    std::fs::create_dir_all(&outbox)?;

    let api = build_api()?;
    let pc = Arc::new(api.new_peer_connection(RTCConfiguration::default()).await?);
    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(1);

    pc.on_data_channel(Box::new(move |dc: Arc<RTCDataChannel>| {
        let inbox = inbox.clone();
        let outbox = outbox.clone();
        let done = done_tx.clone();
        Box::pin(async move {
            println!("BOX: datachannel {}", dc.label());
            let dc_msg = dc.clone();
            dc_msg.on_message(Box::new(move |msg| {
                let inbox = inbox.clone();
                let outbox = outbox.clone();
                let dc2 = dc.clone();
                let done = done.clone();
                Box::pin(async move {
                    let text = String::from_utf8_lossy(&msg.data).into_owned();
                    let env: serde_json::Value =
                        serde_json::from_str(&text).unwrap_or_default();
                    let oid = env["order_id"].as_str().unwrap_or("unknown").to_string();
                    let tmp = format!("{inbox}/{oid}.order.json.tmp");
                    let dst = format!("{inbox}/{oid}.order.json");
                    if std::fs::write(&tmp, &text).is_ok() {
                        let _ = std::fs::rename(&tmp, &dst);
                        println!("BOX: inbox <- {oid} via WebRTC operator channel");
                    }
                    let receipt_path = format!("{outbox}/{oid}.receipt.json");
                    for _ in 0..300 {
                        if let Ok(receipt) = std::fs::read_to_string(&receipt_path) {
                            let _ = dc2.send_text(receipt).await;
                            println!("BOX: receipt -> operator");
                            break;
                        }
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                    let _ = done.send(()).await;
                })
            }));
        })
    }));

    pc.set_remote_description(read_sdp(&offer_in).await?).await?;
    let answer = pc.create_answer(None).await?;
    pc.set_local_description(answer).await?;
    let _ = pc.gathering_complete_promise().await.recv().await;
    let local = pc.local_description().await.unwrap();
    write_sdp(&answer_out, &local).await?;
    println!("BOX: answer written, waiting for order");
    let _ = tokio::time::timeout(Duration::from_secs(600), done_rx.recv()).await;
    Ok(())
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("offer") => offer_mode(&args[1..]).await,
        Some("answer") => answer_mode(&args[1..]).await,
        _ => Err("usage: x0x-operator <offer|answer> [args]".into()),
    };
    if let Err(e) = result {
        eprintln!("x0x-operator: {e}");
        std::process::exit(1);
    }
}
