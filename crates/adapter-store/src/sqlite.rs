//! The REFERENCE implementation: SQLite through `rusqlite` (bundled), as an
//! embedded in-process library — the only form the NO-SERVER-DB ruling
//! permits. WAL journal + `synchronous=FULL`: every commit fsyncs the WAL
//! before returning.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::{prefix_upper, DurabilityMode, Edit, EmbeddedStore, Result, StoreError};

pub struct SqliteStore {
    conn: Mutex<Connection>,
}

/// Path-only constructor — there is no server to point at.
pub fn open(path: &Path) -> Result<SqliteStore> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    conn.busy_timeout(std::time::Duration::from_secs(10))?;
    // journal_mode returns a row (the new mode) — read it back, L5-style.
    let mode: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))?;
    if mode != "wal" {
        return Err(StoreError::Corrupt {
            detail: format!("journal_mode read-back: {mode}"),
        });
    }
    conn.pragma_update(None, "synchronous", "FULL")?;
    // L5: intent is not evidence — read the setting back.
    let sync: i64 = conn.query_row("PRAGMA synchronous", [], |r| r.get(0))?;
    if sync != 2 {
        // 2 == FULL
        return Err(StoreError::Corrupt {
            detail: format!("synchronous read-back: {sync} (wanted 2/FULL)"),
        });
    }
    conn.execute(
        "CREATE TABLE IF NOT EXISTS kv (
            key BLOB PRIMARY KEY,
            value BLOB NOT NULL
        ) WITHOUT ROWID",
        [],
    )?;
    Ok(SqliteStore {
        conn: Mutex::new(conn),
    })
}

impl EmbeddedStore for SqliteStore {
    fn engine(&self) -> &'static str {
        "sqlite/reference"
    }

    fn durability_mode(&self) -> DurabilityMode {
        DurabilityMode::Immediate
    }

    fn write_batch(&self, batch: &[Edit]) -> Result<()> {
        if batch.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn.lock().expect("sqlite conn poisoned");
        let tx = conn.transaction()?;
        for edit in batch {
            match edit {
                Edit::Put(k, v) => {
                    tx.execute(
                        "INSERT INTO kv (key, value) VALUES (?1, ?2)
                         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                        params![k, v],
                    )?;
                }
                Edit::Delete(k) => {
                    tx.execute("DELETE FROM kv WHERE key = ?1", params![k])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>> {
        let conn = self.conn.lock().expect("sqlite conn poisoned");
        let v = conn
            .query_row("SELECT value FROM kv WHERE key = ?1", params![key], |r| {
                r.get::<_, Vec<u8>>(0)
            })
            .optional()?;
        Ok(v)
    }

    fn scan_prefix(&self, prefix: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>> {
        let conn = self.conn.lock().expect("sqlite conn poisoned");
        let mut out = Vec::new();
        match prefix_upper(prefix) {
            Some(upper) => {
                let mut stmt = conn.prepare(
                    "SELECT key, value FROM kv WHERE key >= ?1 AND key < ?2 ORDER BY key",
                )?;
                let rows = stmt.query_map(params![prefix, upper], |r| {
                    Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?))
                })?;
                for row in rows {
                    out.push(row?);
                }
            }
            None => {
                let mut stmt =
                    conn.prepare("SELECT key, value FROM kv WHERE key >= ?1 ORDER BY key")?;
                let rows = stmt.query_map(params![prefix], |r| {
                    Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?))
                })?;
                for row in rows {
                    out.push(row?);
                }
            }
        }
        Ok(out)
    }

    fn integrity_check(&self) -> Result<()> {
        let conn = self.conn.lock().expect("sqlite conn poisoned");
        let verdict: String = conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if verdict != "ok" {
            return Err(StoreError::Corrupt { detail: verdict });
        }
        Ok(())
    }

    fn compact(&self) -> Result<()> {
        let conn = self.conn.lock().expect("sqlite conn poisoned");
        // TRUNCATE the WAL back into the main file, then rebuild the file
        // itself: VACUUM rewrites with only live pages.
        let _checkpoint: (i64, i64, i64) =
            conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })?;
        conn.execute_batch("VACUUM;")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{corpus_key, temp_dir};

    fn exercised() -> Result<Box<dyn EmbeddedStore>> {
        let dir = temp_dir("sqlite-unit");
        let s = open(&dir.join("store.db"))?;
        s.write_batch(&[
            Edit::Put(corpus_key(1), crate::corpus_value(1)),
            Edit::Put(corpus_key(2), crate::corpus_value(2)),
        ])?;
        s.write_batch(&[Edit::Delete(corpus_key(1))])?;
        Ok(Box::new(s))
    }

    #[test]
    fn put_get_delete_scan_roundtrip() -> Result<()> {
        let s = exercised()?;
        assert_eq!(s.get(&corpus_key(1))?, None);
        assert_eq!(s.get(&corpus_key(2))?, Some(crate::corpus_value(2)));
        let scanned = s.scan_prefix(b"key-")?;
        assert_eq!(scanned, vec![(corpus_key(2), crate::corpus_value(2))]);
        assert_eq!(s.durability_mode().to_string(), "immediate");
        s.integrity_check()?;
        Ok(())
    }
}
