//! x0xd -> inbox bridge: the transport that retires scp/SSH delivery.
//!
//! Subscribes to a gossip topic on the local x0xd loopback API (via
//! the official `x0x` CLI, token passed by env, never printed),
//! drops each accepted envelope into the inbox atomically (tmp +
//! rename, per the deploy runbook), and publishes receipts from the
//! outbox back to the receipts topic. Sender pinning: only envelopes
//! whose gossip `sender` matches an allow-listed agent id are
//! accepted — transport-level sender authentication, the mitigation
//! named in the README threat model. The scope policy remains the
//! authorization boundary for what an accepted envelope may do.

use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::envelope::b64_decode;

pub struct BridgeConfig {
    pub x0x_bin: String,
    pub api: String,
    pub token_file: String,
    pub state_dir: PathBuf,
    pub orders_topic: String,
    pub receipts_topic: String,
    pub allow_senders: Vec<String>,
}

fn publish(cfg: &BridgeConfig, topic: &str, payload_text: &str) -> Result<(), String> {
    let out = Command::new(&cfg.x0x_bin)
        .args(["publish", topic, payload_text, "--api", &cfg.api, "--json"])
        .env("X0X_API_TOKEN", read_token(cfg)?)
        .output()
        .map_err(|e| format!("spawn x0x publish: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "x0x publish failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ))
    }
}

fn read_token(cfg: &BridgeConfig) -> Result<String, String> {
    std::fs::read_to_string(&cfg.token_file)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("read token file: {e}"))
}

/// Run the bridge until killed. Receipt publishing is polled;
/// order intake is stream-driven. All drops are atomic renames.
pub fn run_bridge(cfg: BridgeConfig) -> Result<i32, String> {
    let inbox = cfg.state_dir.join("inbox");
    let outbox = cfg.state_dir.join("outbox");
    std::fs::create_dir_all(&inbox).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&outbox).map_err(|e| e.to_string())?;

    // Receipt publisher thread: new outbox receipts -> receipts topic.
    let pub_cfg = BridgeConfig {
        x0x_bin: cfg.x0x_bin.clone(),
        api: cfg.api.clone(),
        token_file: cfg.token_file.clone(),
        state_dir: cfg.state_dir.clone(),
        orders_topic: cfg.orders_topic.clone(),
        receipts_topic: cfg.receipts_topic.clone(),
        allow_senders: cfg.allow_senders.clone(),
    };
    std::thread::spawn(move || {
        let mut sent: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
        loop {
            if let Ok(entries) = std::fs::read_dir(&outbox) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.extension().is_some_and(|x| x == "json") && !sent.contains(&p) {
                        if let Ok(text) = std::fs::read_to_string(&p) {
                            match publish(&pub_cfg, &pub_cfg.receipts_topic.clone(), &text) {
                                Ok(()) => {
                                    sent.insert(p);
                                }
                                Err(err) => eprintln!("bridge: receipt publish: {err}"),
                            }
                        }
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(2));
        }
    });

    let mut child = Command::new(&cfg.x0x_bin)
        .args(["subscribe", &cfg.orders_topic, "--api", &cfg.api, "--json"])
        .env("X0X_API_TOKEN", read_token(&cfg)?)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn x0x subscribe: {e}"))?;
    let stdout = child.stdout.take().ok_or("subscribe stdout missing")?;
    println!(
        "bridge: subscribed to {} (senders: {})",
        cfg.orders_topic,
        cfg.allow_senders.join(",")
    );
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|e| e.to_string())?;
        let v: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if v["type"] != "message" {
            continue;
        }
        let sender = v["data"]["sender"].as_str().unwrap_or("");
        if !cfg.allow_senders.iter().any(|s| s == sender) {
            eprintln!("bridge: dropped envelope from unpinned sender {sender}");
            continue;
        }
        let payload_b64 = v["data"]["payload"].as_str().unwrap_or("");
        let bytes = match b64_decode(payload_b64) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let text = String::from_utf8_lossy(&bytes).into_owned();
        let env: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let order_id = env["order_id"].as_str().unwrap_or("unknown");
        if order_id == "unknown" || order_id.contains(['/', '\\']) {
            continue;
        }
        let tmp = inbox.join(format!("{order_id}.order.json.tmp"));
        let dst = inbox.join(format!("{order_id}.order.json"));
        if std::fs::write(&tmp, &text).is_ok() {
            let _ = std::fs::rename(&tmp, &dst);
            println!("bridge: inbox <- {order_id} from {sender}");
            let _ = std::io::stdout().flush();
        }
    }
    Ok(0)
}

pub fn inbox_dir(state_dir: &Path) -> PathBuf {
    state_dir.join("inbox")
}
