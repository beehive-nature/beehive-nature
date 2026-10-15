//! The independent destination — a settlement endpoint in its own process
//! (`src/bin/bnrose-dest.rs`). It owns exactly what the governing rule
//! says only a destination can own:
//!
//! - **idempotent acceptance** — one acceptance per transaction id; a
//!   re-submission of the same id is answered `duplicate` (an observation
//!   for the sender, never a success claim);
//! - **the state ladder** `pending → included → final`, advanced ONLY by
//!   its own `advance` admin command (block production): inclusion,
//!   execution, and finality are the destination's facts;
//! - **a durable acceptance log** — restart preserves idempotency and
//!   states (append + fsync, the same discipline the hosts' journal has);
//! - **the fault injector** — per-client-label `drop` (silent loss:
//!   delayed request OR lost acknowledgement), `delay(ms)` (answers late,
//!   past the client's window), `none`. This is what makes partitions
//!   reproducible instead of simulated.
//!
//! Protocol: one JSON object per line over TCP; one JSON answer per line.
//! `submit {label, txId, payload}` / `observe {label, txId}` /
//! `advance {blocks}` / `fault {for, mode, argMs}` / `dump` (test aid).

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TxState {
    Pending,
    Included,
    Final,
}

#[derive(Clone, Debug)]
struct Tx {
    payload_hex: String,
    state: TxState,
}

#[derive(Clone, Copy, Debug, Default)]
struct Fault {
    mode: u8, // 0 none, 1 drop, 2 delay
    arg_ms: u64,
}

pub struct Destination {
    log_path: PathBuf,
    /// test injection: fail the next durable append (checked-durability row)
    /// test injection: fail the durable append AFTER this many successes
    fail_after: u32,
    txs: BTreeMap<String, Tx>,
    faults: BTreeMap<String, Fault>,
}

impl Destination {
    pub fn new(log_path: PathBuf) -> Result<Destination, String> {
        let mut d = Destination {
            log_path,
            txs: BTreeMap::new(),
            faults: BTreeMap::new(),
            fail_after: 0,
        };
        d.replay()?;
        Ok(d)
    }

    /// Restart-safe: replay the durable acceptance log.
    fn replay(&mut self) -> Result<(), String> {
        let text = match std::fs::read_to_string(&self.log_path) {
            Ok(t) => t,
            // a MISSING log is a fresh destination — empty and honest;
            // anything else (unreadable) is damage
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(format!("log unreadable: {e}")),
        };
        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }
            // FAIL CLOSED: a malformed line is damage, never skippable
            // noise — a corrupted log refuses to serve, loudly
            let v = serde_json::from_str::<Value>(line)
                .map_err(|e| format!("corrupt acceptance log: {e}"))?;
            // VALIDATED replay (founder review): every line must be a
            // well-formed event for a state that can exist — missing
            // fields, unknown event types, duplicate accepts, and
            // impossible transitions are DAMAGE, fail closed
            let tx = v["txId"]
                .as_str()
                .ok_or("log entry missing txId")?
                .to_string();
            match v["ev"].as_str() {
                Some("accept") => {
                    let payload = v["payload"].as_str().ok_or("accept missing payload")?;
                    if self.txs.contains_key(&tx) {
                        return Err(format!("duplicate accept for {tx}"));
                    }
                    self.txs.insert(
                        tx,
                        Tx {
                            payload_hex: payload.to_string(),
                            state: TxState::Pending,
                        },
                    );
                }
                Some("included") => {
                    let t = self
                        .txs
                        .get_mut(&tx)
                        .ok_or_else(|| format!("included for unknown tx {tx}"))?;
                    if t.state != TxState::Pending {
                        return Err(format!("impossible transition: {tx} not pending"));
                    }
                    t.state = TxState::Included;
                }
                Some("final") => {
                    let t = self
                        .txs
                        .get_mut(&tx)
                        .ok_or_else(|| format!("final for unknown tx {tx}"))?;
                    if t.state != TxState::Included {
                        return Err(format!("impossible transition: {tx} not included"));
                    }
                    t.state = TxState::Final;
                }
                other => return Err(format!("unknown event type {other:?}")),
            }
        }
        Ok(())
    }

    /// CHECKED durability (founder review of #444): a write or fsync
    /// failure is an ERROR the caller must surface — the destination
    /// never acknowledges acceptance its durable log cannot prove.
    fn append_log(&mut self, v: &Value) -> Result<(), String> {
        if self.fail_after > 0 {
            if self.fail_after == 1 {
                self.fail_after = 0;
                return Err("forced log failure (test injection)".into());
            }
            self.fail_after -= 1;
        }
        let mut line = serde_json::to_string(v).unwrap();
        line.push('\n');
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .map_err(|e| format!("open: {e}"))?;
        f.write_all(line.as_bytes())
            .map_err(|e| format!("write: {e}"))?;
        f.sync_data().map_err(|e| format!("fsync: {e}"))?;
        Ok(())
    }

    fn advance_blocks(&mut self, blocks: u64) -> Result<(), String> {
        // block production: pending→included after 1 block, included→final
        // after 2 more — a stand-in ladder with REAL state separateness
        for _ in 0..blocks {
            let mut to_include = Vec::new();
            let mut to_finalize = Vec::new();
            for (id, t) in &self.txs {
                match t.state {
                    TxState::Pending => to_include.push(id.clone()),
                    TxState::Included => to_finalize.push(id.clone()),
                    TxState::Final => {}
                }
            }
            // CHECKED transitions (founder review): memory moves ONLY
            // after the durable write proves it. BATCH PREFIX SEMANTICS:
            // a failure midway leaves the ALREADY-DURABLE transitions
            // standing (they are proven), the rest unmoved — prefix
            // recovery is exercised by test l9; the abort is honest,
            // never a rollback of proven facts
            for id in to_include {
                self.append_log(&json!({"ev": "included", "txId": id}))?;
                self.txs.get_mut(&id).unwrap().state = TxState::Included;
            }
            for id in to_finalize {
                self.append_log(&json!({"ev": "final", "txId": id}))?;
                self.txs.get_mut(&id).unwrap().state = TxState::Final;
            }
        }
        Ok(())
    }

    fn handle(&mut self, v: Value, w: &mut TcpStream) -> bool {
        let label = v["label"].as_str().unwrap_or("?").to_string();
        let op = v["op"].as_str().unwrap_or("");
        let fault = *self.faults.get(&label).unwrap_or(&Fault::default());
        if fault.mode == 3 {
            return true; // blackhole: the request never arrives (lost request)
        }
        if fault.mode == 2 {
            std::thread::sleep(std::time::Duration::from_millis(fault.arg_ms));
        }
        let answer = match op {
            "submit" => {
                let tx_id = v["txId"].as_str().unwrap_or("").to_string();
                let payload = v["payload"].as_str().unwrap_or("").to_string();
                if let Some(existing) = self.txs.get(&tx_id) {
                    if existing.payload_hex != payload {
                        // CONFLICTING REPLAY: same transaction id, DIFFERENT
                        // bytes — refused loudly; a duplicate is only ever
                        // the SAME exact bytes
                        json!({"result": "conflict"})
                    } else {
                        json!({"result": "duplicate"})
                    }
                } else {
                    match self
                        .append_log(&json!({"ev": "accept", "txId": tx_id, "payload": payload}))
                    {
                        Err(e) => json!({"result": "storage-error", "why": e}),
                        Ok(()) => {
                            self.txs.insert(
                                tx_id,
                                Tx {
                                    payload_hex: payload,
                                    state: TxState::Pending,
                                },
                            );
                            json!({"result": "acked"})
                        }
                    }
                }
            }
            "observe" => {
                let tx_id = v["txId"].as_str().unwrap_or("");
                let state = match self.txs.get(tx_id).map(|t| t.state) {
                    Some(TxState::Pending) => "pending",
                    Some(TxState::Included) => "included",
                    Some(TxState::Final) => "final",
                    None => "unknown-to-dest",
                };
                json!({"state": state})
            }
            "advance" => {
                let blocks = v["blocks"].as_u64().unwrap_or(1);
                match self.advance_blocks(blocks) {
                    Ok(()) => json!({"result": "ok"}),
                    Err(e) => json!({"result": "storage-error", "why": e}),
                }
            }
            "fault" => {
                let for_label = v["for"].as_str().unwrap_or("").to_string();
                let mode = match v["mode"].as_str() {
                    Some("drop") => 1u8,    // lost acknowledgement
                    Some("delay") => 2,     // answer arrives past the window
                    Some("blackhole") => 3, // request never arrives
                    _ => 0,
                };
                let arg = v["argMs"].as_u64().unwrap_or(0);
                self.faults.insert(for_label, Fault { mode, arg_ms: arg });
                json!({"result": "ok"})
            }
            "fail-log" => {
                // after: fail the durable append AFTER this many successes
                self.fail_after = v["after"].as_u64().unwrap_or(1) as u32;
                json!({"result": "ok"})
            }
            "dump" => {
                let ids: Vec<&String> = self.txs.keys().collect();
                json!({"txs": ids})
            }
            _ => json!({"result": "unrecognized"}),
        };
        if fault.mode == 1 {
            // LOST ACKNOWLEDGEMENT: the request was handled durably and
            // only the answer is lost — the sender times out on a fact
            return true;
        }
        let mut line = serde_json::to_string(&answer).unwrap();
        line.push('\n');
        let _ = w.write_all(line.as_bytes());
        true
    }

    /// Serve forever on the given listener.
    pub fn serve(self, listener: TcpListener) -> ! {
        let mut dest = self;
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let _ = stream.set_nodelay(true);
            let mut writer = match stream.try_clone() {
                Ok(w) => w,
                Err(_) => continue,
            };
            let reader = BufReader::new(stream);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let Ok(v) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if !dest.handle(v, &mut writer) {
                    break;
                }
            }
        }
        unreachable!("the destination serves until killed")
    }
}
