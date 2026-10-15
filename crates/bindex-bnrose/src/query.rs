//! Bounded queries. Every answer carries the index's coverage and freshness
//! marks so a reader sees the epistemic state of every fact.

use crate::store::Store;
use crate::{hex, Error};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

/// The hard page ceiling; a caller asking for more gets this many and the
/// `truncated` mark.
pub const MAX_LIMIT: u64 = 1000;

fn coverage(store: &Store) -> Result<Value, Error> {
    let replicas: Value = store
        .meta("replicas")?
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null);
    Ok(json!({
        "coveredThroughSeq": store.meta("covered_through_seq")?.and_then(|s| s.parse::<u64>().ok()),
        "indexHead": store.meta("index_head")?,
        "readAtUnix": store.meta("read_at_unix")?.and_then(|s| s.parse::<u64>().ok()),
        "agreement": store.meta("agreement")?,
        "singleReplica": store.meta("single_replica")?.map(|s| s == "true"),
        "replicas": replicas,
        "receiptPublicKey": store.meta("receipt_public_key")?,
        "staleByConstruction": "an index describes the journal as read at readAtUnix; the supervisor may have appended since",
    }))
}

/// One entity by id.
pub fn entity(store: &Store, id: &[u8; 32]) -> Result<Value, Error> {
    let view: Option<String> = store
        .conn
        .query_row(
            "SELECT view_json FROM entities WHERE id = ?1",
            params![id.to_vec()],
            |r| r.get(0),
        )
        .optional()?;
    Ok(json!({
        "query": {"entity": hex(id)},
        "found": view.is_some(),
        "entity": view.and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "coverage": coverage(store)?,
    }))
}

/// Entities admitted under one authority, ascending by first seq, bounded.
pub fn by_authority(
    store: &Store,
    authority: &[u8; 32],
    after_seq: Option<u64>,
    limit: u64,
) -> Result<Value, Error> {
    let limit = limit.clamp(1, MAX_LIMIT);
    let after = after_seq.map(|s| s as i64).unwrap_or(-1);
    let mut stmt = store.conn.prepare(
        "SELECT id, kind, first_seq, last_seq, replay_state, attested FROM entities WHERE authority = ?1 AND first_seq > ?2 ORDER BY first_seq ASC LIMIT ?3",
    )?;
    let rows: Vec<Value> = stmt
        .query_map(
            params![authority.to_vec(), after, (limit + 1) as i64],
            |r| {
                let id: Vec<u8> = r.get(0)?;
                Ok(json!({
                    "entityId": hex(&id),
                    "kind": r.get::<_, String>(1)?,
                    "firstSeq": r.get::<_, i64>(2)?,
                    "lastSeq": r.get::<_, i64>(3)?,
                    "replayState": r.get::<_, i64>(4)?,
                    "attested": r.get::<_, i64>(5)? == 1,
                }))
            },
        )?
        .collect::<Result<_, _>>()?;
    let truncated = rows.len() as u64 > limit;
    let page: Vec<Value> = rows.into_iter().take(limit as usize).collect();
    Ok(json!({
        "query": {"authority": hex(authority), "afterSeq": after_seq, "limit": limit},
        "entities": page,
        "truncated": truncated,
        "coverage": coverage(store)?,
    }))
}

/// The step entities of one root, ascending by step.
pub fn steps(store: &Store, root: &[u8; 32]) -> Result<Value, Error> {
    let mut stmt = store.conn.prepare(
        "SELECT view_json FROM entities WHERE root = ?1 ORDER BY step ASC, attempt ASC LIMIT ?2",
    )?;
    let rows: Vec<Value> = stmt
        .query_map(params![root.to_vec(), MAX_LIMIT as i64], |r| {
            let s: String = r.get(0)?;
            Ok(serde_json::from_str::<Value>(&s).unwrap_or(Value::Null))
        })?
        .collect::<Result<_, _>>()?;
    Ok(json!({
        "query": {"root": hex(root)},
        "steps": rows,
        "coverage": coverage(store)?,
    }))
}

/// The confession: counts, coverage, divergences, ingest history. It says
/// what is in the file, never "OK".
pub fn status(store: &Store) -> Result<Value, Error> {
    let (page_size, page_count) = store.page_stats()?;
    let attested: i64 = store.conn.query_row(
        "SELECT COUNT(*) FROM entities WHERE attested = 1",
        [],
        |r| r.get(0),
    )?;
    let verified: i64 = store.conn.query_row(
        "SELECT COUNT(*) FROM receipts WHERE verified = 1",
        [],
        |r| r.get(0),
    )?;
    let unverified: i64 = store.conn.query_row(
        "SELECT COUNT(*) FROM receipts WHERE verified = 0",
        [],
        |r| r.get(0),
    )?;
    let identity_failed: i64 = store.conn.query_row(
        "SELECT COUNT(*) FROM entities WHERE id_recomputed = 0 OR binding_verified = 0",
        [],
        |r| r.get(0),
    )?;
    let replay_refused: i64 = store.conn.query_row(
        "SELECT COUNT(*) FROM entities WHERE replay_refusal IS NOT NULL",
        [],
        |r| r.get(0),
    )?;
    let mut stmt = store.conn.prepare(
        "SELECT at_unix, covered_through_seq, index_head, agreement, single_replica, outcome FROM ingests ORDER BY id DESC LIMIT 20",
    )?;
    let ingests: Vec<Value> = stmt
        .query_map([], |r| {
            let head: Vec<u8> = r.get(2)?;
            Ok(json!({
                "atUnix": r.get::<_, i64>(0)?,
                "coveredThroughSeq": r.get::<_, i64>(1)?,
                "indexHead": hex(&head),
                "agreement": r.get::<_, String>(3)?,
                "singleReplica": r.get::<_, i64>(4)? == 1,
                "outcome": r.get::<_, String>(5)?,
            }))
        })?
        .collect::<Result<_, _>>()?;
    Ok(json!({
        "schemaVersion": store.meta("schema_version")?,
        "keyless": store.meta("keyless")?,
        "sendtx": store.meta("sendtx")?,
        "chainTags": store.meta("chain_tags")?,
        "counts": {
            "records": store.count("records")?,
            "entities": store.count("entities")?,
            "entitiesAttested": attested,
            "entitiesIdentityOrBindingFailed": identity_failed,
            "entitiesReplayRefused": replay_refused,
            "receipts": store.count("receipts")?,
            "receiptsVerified": verified,
            "receiptsUnverified": unverified,
            "effectRows": store.count("effect_rows")?,
            "divergences": store.count("divergences")?,
            "ingests": store.count("ingests")?,
        },
        "file": {"pageSize": page_size, "pageCount": page_count},
        "ledgerNote": store.meta("ledger_note")?,
        "coverage": coverage(store)?,
        "ingests": ingests,
    }))
}
