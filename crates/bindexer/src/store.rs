//! SQLite store — SPEC-BINDEXER-0 §2, verbatim columns, plus the honesty tables
//! the spec names elsewhere (`reorgs` in §4, `tips.sources_json` in §3).
//!
//! Single-file database, stranger-auditable: journal WAL during ingest, checkpointed
//! and truncated on close so the deliverable is one file. History is append-mostly —
//! a reorg appends a row, it never deletes one.

use rusqlite::{params, Connection};

pub const SCHEMA_VERSION: i64 = 1;

pub fn open(path: &str) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(conn)
}

pub fn init(conn: &Connection, chain_id: &str) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS meta(
            key TEXT PRIMARY KEY, value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS blocks(
            height INTEGER PRIMARY KEY,
            hash BLOB NOT NULL,
            parent BLOB NOT NULL,
            ts INTEGER NOT NULL,
            tx_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS txs(
            txid BLOB PRIMARY KEY,
            block_height INTEGER NOT NULL REFERENCES blocks(height),
            hex BLOB NOT NULL,
            norm JSON NOT NULL
        );
        CREATE TABLE IF NOT EXISTS addresses(
            address TEXT NOT NULL,
            txid BLOB NOT NULL,
            delta INTEGER NOT NULL,
            PRIMARY KEY(address, txid)
        );
        CREATE TABLE IF NOT EXISTS utxos(
            txid BLOB NOT NULL,
            vout INTEGER NOT NULL,
            address TEXT NOT NULL,
            value INTEGER NOT NULL,
            height INTEGER NOT NULL,
            PRIMARY KEY(txid, vout)
        );
        CREATE TABLE IF NOT EXISTS tips(
            chain_id TEXT PRIMARY KEY,
            best_height INTEGER NOT NULL,
            best_hash BLOB NOT NULL,
            lag_ms INTEGER NOT NULL,
            sources_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reorgs(
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            detected_at TEXT NOT NULL,
            depth INTEGER NOT NULL,
            orphaned_hashes TEXT NOT NULL,
            new_best_hash BLOB NOT NULL
        );
        "#,
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO meta(key,value) VALUES ('schema_version',?1)",
        params![SCHEMA_VERSION.to_string()],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO meta(key,value) VALUES ('chain_id',?1)",
        params![chain_id],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO meta(key,value) VALUES ('keyless','true — SPEC-BINDEXER-0: no sendtx, no wallet, no key material anywhere in this crate')",
        [],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO meta(key,value) VALUES ('sendtx','NO — permanently (the spec''s most important row)')",
        [],
    )?;
    Ok(())
}

/// WAL checkpoint + truncate so the deliverable is one stranger-auditable file.
pub fn seal(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "wal_checkpoint", "TRUNCATE")?;
    Ok(())
}

pub fn table_count(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    // table names are only ever passed from our own static list — never user input
    conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
}

/// The status confession, blockbook-style per-column honesty (§1, "what we take").
pub fn db_confession(conn: &Connection) -> serde_json::Value {
    let tables = [
        "blocks",
        "txs",
        "addresses",
        "utxos",
        "reorgs",
        "tips",
        "meta",
    ];
    let mut rows = serde_json::Map::new();
    for t in tables {
        let c = table_count(conn, t).unwrap_or(-1); // -1 confessed, never hidden
        rows.insert(t.to_string(), c.into());
    }
    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |r| r.get(0))
        .unwrap_or(-1);
    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |r| r.get(0))
        .unwrap_or(-1);
    let wal_frames: i64 = conn
        .query_row("PRAGMA wal(FramesWritten)", [], |r| r.get(0))
        .unwrap_or(-1);
    serde_json::json!({
        "rows": rows,
        "page_size_bytes": page_size,
        "page_count": page_count,
        "approx_db_bytes": page_size * page_count,
        "wal_frames_written": wal_frames,
        "journal": "WAL (checkpoint TRUNCATE on seal — deliverable is one file)"
    })
}
