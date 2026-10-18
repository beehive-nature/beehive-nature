//! The sealed SQLite file: one deliverable, stranger-auditable, with its
//! receipts in `meta` (the `bindexer` pattern).

use crate::Error;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;

pub const SCHEMA_VERSION: &str = "bindex-bnrose/1";

pub struct Store {
    pub conn: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Store, Error> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS records(
                seq INTEGER PRIMARY KEY,
                op_id BLOB NOT NULL,
                event INTEGER NOT NULL,
                event_word TEXT NOT NULL,
                payload BLOB NOT NULL,
                served_tag BLOB NOT NULL,
                content_digest BLOB NOT NULL,
                index_head BLOB NOT NULL
            );
            CREATE INDEX IF NOT EXISTS records_by_op ON records(op_id, seq);
            CREATE TABLE IF NOT EXISTS entities(
                id BLOB PRIMARY KEY,
                kind TEXT NOT NULL,
                root BLOB,
                step INTEGER,
                attempt INTEGER,
                label TEXT,
                authority BLOB NOT NULL,
                policy_digest BLOB NOT NULL,
                nonce BLOB,
                domain TEXT,
                first_seq INTEGER NOT NULL,
                last_seq INTEGER NOT NULL,
                id_recomputed INTEGER NOT NULL,
                binding_verified INTEGER NOT NULL,
                replay_state INTEGER NOT NULL,
                replay_recovered INTEGER NOT NULL,
                replay_fail INTEGER NOT NULL,
                replay_refusal TEXT,
                attested INTEGER NOT NULL,
                view_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS entities_by_authority ON entities(authority, first_seq);
            CREATE INDEX IF NOT EXISTS entities_by_root ON entities(root, step);
            CREATE TABLE IF NOT EXISTS receipts(
                entity_id BLOB PRIMARY KEY,
                json TEXT NOT NULL,
                verified INTEGER NOT NULL,
                head_bound INTEGER,
                covers_entity INTEGER NOT NULL,
                mismatches_json TEXT NOT NULL,
                seq_head INTEGER,
                journal_head BLOB
            );
            CREATE TABLE IF NOT EXISTS effect_rows(
                seq INTEGER PRIMARY KEY,
                op_id BLOB NOT NULL,
                env_sha BLOB NOT NULL,
                effect_digest BLOB NOT NULL,
                wall INTEGER NOT NULL,
                served_tag BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS divergences(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                at_unix INTEGER NOT NULL,
                seq INTEGER NOT NULL,
                replica_a TEXT NOT NULL,
                replica_b TEXT NOT NULL,
                digest_a BLOB NOT NULL,
                digest_b BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ingests(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                at_unix INTEGER NOT NULL,
                covered_through_seq INTEGER NOT NULL,
                index_head BLOB NOT NULL,
                agreement TEXT NOT NULL,
                single_replica INTEGER NOT NULL,
                outcome TEXT NOT NULL
            );
            ",
        )?;
        let s = Store { conn };
        s.set_meta("schema_version", SCHEMA_VERSION)?;
        s.set_meta(
            "keyless",
            "true: SPEC-BINDEXER-0 carried over; no root key file read, no key derived, no MAC held, no signing vocabulary in this crate (tests/keyless.rs)",
        )?;
        s.set_meta("sendtx", "NO: permanently (a read path; the supervisor is the only writer of what this index reads)")?;
        s.set_meta(
            "chain_tags",
            "served, UNVERIFIED by construction: HMAC-SHA256 under the supervisor's journal and ledger keys",
        )?;
        Ok(s)
    }

    pub fn set_meta(&self, key: &str, value: &str) -> Result<(), Error> {
        self.conn.execute(
            "INSERT OR REPLACE INTO meta(key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn meta(&self, key: &str) -> Result<Option<String>, Error> {
        Ok(self
            .conn
            .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
                r.get::<_, String>(0)
            })
            .optional()?)
    }

    pub fn count(&self, table: &str) -> Result<u64, Error> {
        let n: i64 = self
            .conn
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?;
        Ok(n as u64)
    }

    /// The index head stored for the first `n` records (None when the
    /// store holds fewer).
    pub fn stored_head_at(&self, n: u64) -> Result<Option<[u8; 32]>, Error> {
        if n == 0 {
            return Ok(Some([0u8; 32]));
        }
        let v: Option<Vec<u8>> = self
            .conn
            .query_row(
                "SELECT index_head FROM records WHERE seq = ?1",
                params![(n - 1) as i64],
                |r| r.get(0),
            )
            .optional()?;
        Ok(v.and_then(|b| b.try_into().ok()))
    }

    pub fn record_count(&self) -> Result<u64, Error> {
        self.count("records")
    }

    /// Seal the file for delivery: checkpoint the WAL so one file is the
    /// whole deliverable.
    pub fn seal(&self) -> Result<(), Error> {
        self.conn
            .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
        Ok(())
    }

    pub fn page_stats(&self) -> Result<(i64, i64), Error> {
        let page_size: i64 = self.conn.query_row("PRAGMA page_size", [], |r| r.get(0))?;
        let page_count: i64 = self.conn.query_row("PRAGMA page_count", [], |r| r.get(0))?;
        Ok((page_size, page_count))
    }
}
