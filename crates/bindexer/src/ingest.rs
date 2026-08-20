//! Ingest — fail-closed, two-oracle, append-mostly (SPEC-BINDEXER-0 §3/§4).
//!
//! The two-oracle law is enforced here: a block is written only when both oracles
//! agree on its hash, unless the operator explicitly passes `allow_single_source`,
//! in which case the tips row records it — the epistemic state travels with the
//! datum, and surfaces render the mark.

use crate::oracle::{agree_at, Agreement, Oracle};
use crate::store;
use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub struct IngestConfig {
    pub allow_single_source: bool,
    pub lag_ms: i64,
}

#[derive(Debug)]
pub enum IngestError {
    Diverged(i64, String, String),
    BothUnreachable(String, String),
    ReorgDetectionIncomplete(String),
    Sql(rusqlite::Error),
}

impl std::fmt::Display for IngestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IngestError::Diverged(h, a, b) => write!(
                f,
                "oracles diverged at height {h}: {a} vs {b} — FAIL-CLOSED, nothing written"
            ),
            IngestError::BothUnreachable(ea, eb) => {
                write!(f, "both oracles unreachable: {ea} / {eb}")
            }
            IngestError::ReorgDetectionIncomplete(e) => write!(f, "reorg detection: {e}"),
            IngestError::Sql(e) => write!(f, "sqlite: {e}"),
        }
    }
}

fn norm_tx(tx: &Value, height: i64, best_height: i64) -> Value {
    // blockbook-shaped normalization (§1 row 3): txid, from/to, wei strings,
    // blockHeight (−1 = mempool), confirmations.
    let s = |v: Option<&str>| v.unwrap_or("").to_string();
    json!({
        "txid": tx.get("hash").and_then(|v| v.as_str()),
        "vin":  [ { "address": s(tx.get("from").and_then(|v| v.as_str())) } ],
        "vout": [ { "address": s(tx.get("to").and_then(|v| v.as_str())),
                    "value": s(tx.get("value").and_then(|v| v.as_str())) } ],
        "blockHeight": height,
        "confirmations": if best_height >= height { best_height - height + 1 } else { 0 },
        "hex": s(tx.get("raw").and_then(|v| v.as_str())),
    })
}

fn write_block(
    conn: &mut Connection,
    block: &crate::oracle::Block,
    sources: &Value,
    best_height: i64,
) -> Result<(), IngestError> {
    let chain: String = conn
        .query_row("SELECT value FROM meta WHERE key='chain_id'", [], |r| {
            r.get(0)
        })
        .map_err(IngestError::Sql)?;
    let tx = conn.transaction().map_err(IngestError::Sql)?;
    tx.execute(
        "INSERT OR IGNORE INTO blocks(height,hash,parent,ts,tx_count) VALUES (?1,?2,?3,?4,?5)",
        params![
            block.height,
            block.hash,
            block.parent,
            block.ts,
            block.txs.len() as i64
        ],
    )
    .map_err(IngestError::Sql)?;
    for t in &block.txs {
        let txid = t
            .get("hash")
            .and_then(|v| v.as_str())
            .ok_or_else(|| IngestError::ReorgDetectionIncomplete("tx without hash".into()))?;
        let txid_b = hex_decode(txid);
        let norm = norm_tx(t, block.height, best_height);
        tx.execute(
            "INSERT OR IGNORE INTO txs(txid,block_height,hex,norm) VALUES (?1,?2,?3,?4)",
            params![
                txid_b,
                block.height,
                t.get("raw")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .as_bytes(),
                norm.to_string()
            ],
        )
        .map_err(IngestError::Sql)?;
        // address index: native-value movement only (token transfers are phase 2)
        let from = t.get("from").and_then(|v| v.as_str()).unwrap_or("");
        let to = t.get("to").and_then(|v| v.as_str()).unwrap_or("");
        // schema law: addresses.delta is SQLite INTEGER (i64). Wei values beyond
        // i64 saturate here — the txs.norm row carries the exact wei string and is
        // the spine of truth; this index is derived, never the record.
        let val: i64 = {
            let u = u128::from_str_radix(
                t.get("value")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0x0")
                    .trim_start_matches("0x"),
                16,
            )
            .unwrap_or(0);
            if u > i64::MAX as u128 {
                i64::MAX
            } else {
                u as i64
            }
        };
        if !from.is_empty() {
            tx.execute(
                "INSERT OR IGNORE INTO addresses(address,txid,delta) VALUES (?1,?2,?3)",
                params![from, txid_b, -val],
            )
            .map_err(IngestError::Sql)?;
        }
        if !to.is_empty() {
            tx.execute(
                "INSERT OR IGNORE INTO addresses(address,txid,delta) VALUES (?1,?2,?3)",
                params![to, txid_b, val],
            )
            .map_err(IngestError::Sql)?;
        }
    }
    tx.execute(
        "INSERT OR REPLACE INTO tips(chain_id,best_height,best_hash,lag_ms,sources_json) VALUES (?1,?2,?3,?4,?5)",
        params![
            chain,
            block.height,
            block.hash,
            best_height - block.height, // lag confessed in blocks, not spun
            sources.to_string()
        ],
    )
    .map_err(IngestError::Sql)?;
    tx.commit().map_err(IngestError::Sql)?;
    Ok(())
}

fn hex_decode(h: &str) -> Vec<u8> {
    let h = h.trim_start_matches("0x");
    (0..h.len())
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(&h[i..i + 2], 16).ok())
        .collect()
}

/// hash decode for the API layer (case-insensitive, 0x-tolerant)
pub fn hex_decode_pub(h: &str) -> Vec<u8> {
    hex_decode(&h.to_ascii_lowercase())
}

/// Detect a fork: new block's parent != the hash we hold at height-1.
/// Append a `reorgs` row and never delete anything (§4).
fn record_reorg_if_forked(
    conn: &mut Connection,
    block: &crate::oracle::Block,
    a: &dyn Oracle,
) -> Result<bool, IngestError> {
    let stored_parent: Option<Vec<u8>> = conn
        .query_row(
            "SELECT hash FROM blocks WHERE height = ?1",
            params![block.height - 1],
            |r| r.get(0),
        )
        .ok();
    if stored_parent.as_deref() == Some(block.parent.as_slice()) {
        return Ok(false); // linear continuation
    }
    if stored_parent.is_none() {
        return Ok(false); // backfill, no fork to confess
    }
    // walk back to the common ancestor
    let mut orphaned: Vec<String> = Vec::new();
    let mut h = block.height - 1;
    let mut depth: i64 = 0;
    loop {
        if h < 0 {
            return Err(IngestError::ReorgDetectionIncomplete(
                "walked to genesis without a common ancestor".into(),
            ));
        }
        let stored: Option<Vec<u8>> = conn
            .query_row("SELECT hash FROM blocks WHERE height=?1", params![h], |r| {
                r.get(0)
            })
            .ok();
        match a.block_by_height(h) {
            Ok(Some(b)) if stored.as_deref() == Some(b.hash.as_slice()) => break,
            Ok(Some(_)) => {
                if let Some(sh) = stored {
                    orphaned.push(format!("0x{}", hex_upper(&sh)));
                }
                depth += 1;
                h -= 1;
            }
            Ok(None) => {
                return Err(IngestError::ReorgDetectionIncomplete(format!(
                    "oracle lost height {h}"
                )))
            }
            Err(e) => return Err(IngestError::ReorgDetectionIncomplete(e)),
        }
        if depth > 128 {
            return Err(IngestError::ReorgDetectionIncomplete(
                "reorg deeper than the 128-block walk window — refusing, not guessing".into(),
            ));
        }
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO reorgs(detected_at,depth,orphaned_hashes,new_best_hash) VALUES (?1,?2,?3,?4)",
        params![
            format!("{now}"),
            depth,
            serde_json::to_string(&orphaned).unwrap_or_default(),
            block.hash
        ],
    )
    .map_err(IngestError::Sql)?;
    Ok(true)
}

fn hex_upper(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02X}")).collect()
}

/// Ingest one block at `height` under the two-oracle law.
pub fn ingest_height(
    conn: &mut Connection,
    a: &dyn Oracle,
    b: &dyn Oracle,
    height: i64,
    cfg: &IngestConfig,
) -> Result<bool, IngestError> {
    let best = a
        .tip()
        .map_err(|e| IngestError::BothUnreachable(e, "tip".into()))?;
    match agree_at(a, b, height) {
        Agreement::Agreed(block, sa, sb) => {
            record_reorg_if_forked(conn, &block, a)?;
            let sources = json!({"oracles": [sa, sb], "single_source": false});
            write_block(conn, &block, &sources, best.height)?;
            Ok(true)
        }
        Agreement::Single(block, who) => {
            if !cfg.allow_single_source {
                return Err(IngestError::BothUnreachable(
                    format!("single source ({who}) and allow_single_source=false — FAIL-CLOSED"),
                    "not attempted".into(),
                ));
            }
            record_reorg_if_forked(conn, &block, a)?;
            let sources = json!({"oracles": [who], "single_source": true});
            write_block(conn, &block, &sources, best.height)?;
            Ok(true)
        }
        Agreement::Diverged {
            height: h,
            a: ha,
            b: hb,
        } => Err(IngestError::Diverged(
            h,
            format!("0x{}", hex_upper(&ha)),
            format!("0x{}", hex_upper(&hb)),
        )),
        Agreement::BothFailed(ea, eb) => Err(IngestError::BothUnreachable(ea, eb)),
    }
}

/// Backfill a range [from, to] inclusive, one receipted block at a time.
pub fn ingest_range(
    conn: &mut Connection,
    a: &dyn Oracle,
    b: &dyn Oracle,
    from: i64,
    to: i64,
    cfg: &IngestConfig,
) -> Result<usize, IngestError> {
    let mut n = 0usize;
    for h in from..=to {
        if ingest_height(conn, a, b, h, cfg)? {
            n += 1;
        }
    }
    store::seal(conn).map_err(IngestError::Sql)?;
    Ok(n)
}
