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

/// Transfer intake: x0x file transfer is the mesh leg that carries
/// laptop->box today (gossip publish does not propagate from
/// NAT-side publishers; receipts in the other direction do). Poll
/// the daemon's transfer list, accept pending order files, and
/// move completed ones into the inbox atomically.
fn transfer_intake(
    cfg: &BridgeConfig,
    inbox: &Path,
    senders: &mut std::collections::HashMap<String, String>,
) {
    let token = match read_token(cfg) {
        Ok(t) => t,
        Err(_) => return,
    };
    let out = Command::new(&cfg.x0x_bin)
        .args(["transfers", "--api", &cfg.api])
        .env("X0X_API_TOKEN", &token)
        .output();
    let Ok(out) = out else { return };
    let text = String::from_utf8_lossy(&out.stdout).into_owned();
    // The CLI prints YAML-ish records; sender is learned on one
    // poll and enforced on the next — a transfer is only accepted
    // when its sender is pinned, exactly like gossip intake.
    let mut cur_sender = String::new();
    let mut cur_id = String::new();
    let mut cur_status = String::new();
    let mut records: Vec<(String, String, String)> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("remote_agent_id:") {
            cur_sender = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("status:") {
            cur_status = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("transfer_id:") {
            cur_id = v.trim().to_string();
            records.push((cur_id.clone(), cur_sender.clone(), cur_status.clone()));
        }
    }
    for (id, sender, status) in records {
        if !sender.is_empty() {
            senders.insert(id.clone(), sender);
        }
        if status == "Pending" {
            let known = senders.get(&id).cloned().unwrap_or_default();
            if cfg.allow_senders.iter().any(|s| s == &known) {
                let _ = Command::new(&cfg.x0x_bin)
                    .args(["accept-file", &id, "--api", &cfg.api])
                    .env("X0X_API_TOKEN", &token)
                    .output();
            } else if !known.is_empty() {
                eprintln!("bridge: refused transfer from unpinned sender {known}");
            }
        }
    }
    // Completed transfers land as <id>_<name>.order.json files.
    let transfers_dir = cfg.state_dir.join("../x0x/data/transfers");
    if let Ok(entries) = std::fs::read_dir(&transfers_dir) {
        for e in entries.flatten() {
            let p = e.path();
            let name = e.file_name().to_string_lossy().into_owned();
            if !name.ends_with(".order.json") {
                continue;
            }
            let Some((_, rest)) = name.split_once('_') else {
                continue;
            };
            let dst = inbox.join(rest);
            let tmp = inbox.join(format!("{rest}.tmp"));
            if std::fs::copy(&p, &tmp).is_ok() {
                if std::fs::rename(&tmp, &dst).is_ok() {
                    let _ = std::fs::remove_file(&p);
                    println!("bridge: inbox <- {rest} via x0x file transfer");
                }
            }
        }
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
    // Transfer intake runs alongside the subscription.
    let intake_cfg = BridgeConfig {
        x0x_bin: cfg.x0x_bin.clone(),
        api: cfg.api.clone(),
        token_file: cfg.token_file.clone(),
        state_dir: cfg.state_dir.clone(),
        orders_topic: cfg.orders_topic.clone(),
        receipts_topic: cfg.receipts_topic.clone(),
        allow_senders: cfg.allow_senders.clone(),
    };
    let intake_inbox = inbox.clone();
    std::thread::spawn(move || {
        let mut senders: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        loop {
            transfer_intake(&intake_cfg, &intake_inbox, &mut senders);
            std::thread::sleep(std::time::Duration::from_secs(5));
        }
    });

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
