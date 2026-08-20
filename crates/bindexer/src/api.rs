//! The read API — blockbook v2-shaped responses (SPEC-BINDEXER-0 §1), every one
//! carrying its epistemic state: `sources` when both oracles agreed,
//! `single_source: true` when not. A reader sees how every number was witnessed.

use crate::store;
use rusqlite::{params, Connection};
use serde_json::{json, Value};

fn sources_of(conn: &Connection) -> Value {
    let s: Option<String> = conn
        .query_row("SELECT sources_json FROM tips LIMIT 1", [], |r| r.get(0))
        .ok();
    match s {
        Some(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| json!({"oracles": [], "single_source": null, "note": "unreadable sources row — confessed, not hidden"})),
        None => json!({"oracles": [], "single_source": null, "note": "no tip ingested yet — the confession of an empty reader"}),
    }
}

fn hex(b: &[u8]) -> String {
    format!(
        "0x{}",
        b.iter().map(|x| format!("{x:02x}")).collect::<String>()
    )
}

/// `GET /api/status` — sync + backend state + per-table confession (§1 row 1).
pub fn status(conn: &Connection) -> Value {
    let chain: String = conn
        .query_row("SELECT value FROM meta WHERE key='chain_id'", [], |r| {
            r.get(0)
        })
        .unwrap_or_else(|_| "?".into());
    let tip: Option<(i64, Vec<u8>, i64)> = conn
        .query_row(
            "SELECT best_height,best_hash,lag_ms FROM tips WHERE chain_id=?1",
            params![&chain],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .ok();
    let (bh, bhash, lag) = match tip {
        Some((h, hs, l)) => (h, hex(&hs), l),
        None => (-1, "none ingested".into(), -1),
    };
    json!({
        "backend": "bindexer/0.1 (SPEC-BINDEXER-0)",
        "chain": chain,
        "best_height": bh,
        "best_hash": bhash,
        "lag_blocks_confessed": lag,
        "db": store::db_confession(conn),
        "sources": sources_of(conn),
        "sendtx": "NO — permanently (the spec's most important row)",
        "keyless": true,
        "notes": {
            "utxos": "table present, BCH-lane phase 2 — 0 rows on the EVM lane is a confession, not an absence of design",
            "xpub": "phase 2 (a wallet feature; first land serves direct addresses)",
            "websocket": "phase 2 — SSE first (static-friendly)"
        }
    })
}

/// `GET /api/block-index/{height}` and `/api/block/{id}` — the receipt spine.
pub fn block_by_height(conn: &Connection, height: i64) -> Value {
    let row: Option<(Vec<u8>, Vec<u8>, i64, i64)> = conn
        .query_row(
            "SELECT hash,parent,ts,tx_count FROM blocks WHERE height=?1",
            params![height],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .ok();
    match row {
        Some((hash, parent, ts, n)) => json!({
            "height": height, "hash": hex(&hash), "parent": hex(&parent),
            "timestamp": ts, "tx_count": n, "sources": sources_of(conn)
        }),
        None => {
            json!({"error": "block not indexed", "height": height, "sources": sources_of(conn)})
        }
    }
}

pub fn block_by_hash(conn: &Connection, id: &str) -> Value {
    let blob = crate::ingest::hex_decode_pub(id);
    let row: Option<(i64, Vec<u8>, i64, i64)> = conn
        .query_row(
            "SELECT height,parent,ts,tx_count FROM blocks WHERE hash=?1",
            params![&blob],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .ok();
    match row {
        Some((height, parent, ts, n)) => json!({
            "height": height, "hash": id, "parent": hex(&parent),
            "timestamp": ts, "tx_count": n, "sources": sources_of(conn)
        }),
        None => json!({"error": "block not indexed", "hash": id, "sources": sources_of(conn)}),
    }
}

/// `GET /api/tx/{txid}` — normalized (blockbook field names where sane, §1 row 3).
pub fn tx(conn: &Connection, txid: &str) -> Value {
    let blob = crate::ingest::hex_decode_pub(txid);
    let row: Option<(String, i64)> = conn
        .query_row(
            "SELECT norm,block_height FROM txs WHERE txid=?1",
            params![&blob],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    match row {
        Some((norm, _h)) => {
            let mut v: Value = serde_json::from_str(&norm)
                .unwrap_or_else(|_| json!({"error": "unreadable norm row"}));
            if let Some(o) = v.as_object_mut() {
                o.insert("sources".into(), sources_of(conn));
            }
            v
        }
        None => {
            json!({"error": "tx not indexed", "txid": txid, "blockHeight": -1, "sources": sources_of(conn)})
        }
    }
}

/// `GET /api/address/{address}` — the details ladder, `txids` default cheap depth (§1 row 4).
pub fn address(conn: &Connection, addr: &str) -> Value {
    let mut stmt = conn
        .prepare("SELECT txid,delta FROM addresses WHERE address=?1 ORDER BY txid")
        .map_err(|e| e.to_string())
        .unwrap();
    let rows: Vec<(Vec<u8>, i64)> = stmt
        .query_map(params![addr], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    let txids: Vec<String> = rows.iter().map(|(t, _)| hex(t)).collect();
    let balance: i64 = rows.iter().map(|(_, d)| d).sum();
    json!({
        "address": addr,
        "tx_count": rows.len(),
        "balance_wei": balance.to_string(),
        "txids": txids,
        "depth": "txids (the default cheap depth; token ladder phase 2)",
        "sources": sources_of(conn)
    })
}

/// `GET /api/reorgs` — the append-only confession log (§4).
pub fn reorgs(conn: &Connection) -> Value {
    let mut stmt = match conn
        .prepare("SELECT detected_at,depth,orphaned_hashes,new_best_hash FROM reorgs ORDER BY seq")
    {
        Ok(s) => s,
        Err(_) => return json!({"reorgs": []}),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |r| {
            let at: String = r.get(0)?;
            let d: i64 = r.get(1)?;
            let orph: String = r.get(2)?;
            let best: Vec<u8> = r.get(3)?;
            Ok(json!({"detected_at": at, "depth": d, "orphaned": serde_json::from_str::<Value>(&orph).unwrap_or(json!([])), "new_best": hex(&best)}))
        })
        .map(|it| it.filter_map(|x| x.ok()).collect())
        .unwrap_or_default();
    json!({"reorgs": rows, "policy": "append-mostly: a reorg rows-append, history never silently rewritten"})
}
