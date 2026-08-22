//! The journal: every meter tick, persisted. TWO backends, each at its polar
//! strength, chosen by demand — the founder's word (2026-08-22):
//! *"try to use htmx/AlpineJS and sqlite/postgres? each to their polar strengths"*
//!
//! - **sqlite** (default): embedded, zero-ops, one file, read-mostly lanes —
//!   a per-surface ledger you can `scp` home. This demo's demand.
//! - **postgres** (feature `postgres`): many concurrent writers, rich queries —
//!   armed deliberately when a lane's function demands it, never by default.
//!
//! No priced constants, no chain I/O here: ticks arrive, ticks persist.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tick {
    pub id: i64,
    pub core_units_per_name: f64,
    pub base_bytes: i64,
    pub quote_raw: i64,
    pub source_host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickIn {
    pub core_units_per_name: f64,
    pub base_bytes: i64,
    pub quote_raw: i64,
    pub source_host: String,
}

/// The contract both backends implement. `recent` returns newest-first.
pub trait Journal: Send {
    fn insert(&self, t: &TickIn) -> i64;
    fn recent(&self, n: usize) -> Vec<Tick>;
    fn count(&self) -> i64;
    fn backend_name(&self) -> &'static str;
}

// ---------------------------------------------------------------------------
// sqlite — the default. One file, embedded, zero administration.
// ---------------------------------------------------------------------------
pub struct SqliteJournal {
    conn: std::sync::Mutex<rusqlite::Connection>,
}

impl SqliteJournal {
    pub fn open(path: &str) -> rusqlite::Result<Self> {
        let conn = rusqlite::Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS ticks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                core_units_per_name REAL NOT NULL,
                base_bytes INTEGER NOT NULL,
                quote_raw INTEGER NOT NULL,
                source_host TEXT NOT NULL,
                at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;
        Ok(Self {
            conn: std::sync::Mutex::new(conn),
        })
    }

    /// In-memory journal — tests and throwaway runs.
    pub fn in_memory() -> rusqlite::Result<Self> {
        let conn = rusqlite::Connection::open_in_memory()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS ticks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                core_units_per_name REAL NOT NULL,
                base_bytes INTEGER NOT NULL,
                quote_raw INTEGER NOT NULL,
                source_host TEXT NOT NULL,
                at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;
        Ok(Self {
            conn: std::sync::Mutex::new(conn),
        })
    }
}

impl Journal for SqliteJournal {
    fn insert(&self, t: &TickIn) -> i64 {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO ticks (core_units_per_name, base_bytes, quote_raw, source_host)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                t.core_units_per_name,
                t.base_bytes,
                t.quote_raw,
                t.source_host
            ],
        )
        .expect("insert tick");
        c.last_insert_rowid()
    }

    fn recent(&self, n: usize) -> Vec<Tick> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c
            .prepare(
                "SELECT id, core_units_per_name, base_bytes, quote_raw, source_host
                      FROM ticks ORDER BY id DESC LIMIT ?1",
            )
            .expect("prepare recent");
        let rows = stmt
            .query_map([n as i64], |r| {
                Ok(Tick {
                    id: r.get(0)?,
                    core_units_per_name: r.get(1)?,
                    base_bytes: r.get(2)?,
                    quote_raw: r.get(3)?,
                    source_host: r.get(4)?,
                })
            })
            .expect("query recent");
        rows.filter_map(|x| x.ok()).collect()
    }

    fn count(&self) -> i64 {
        let c = self.conn.lock().unwrap();
        c.query_row("SELECT COUNT(*) FROM ticks", [], |r| r.get(0))
            .unwrap_or(0)
    }

    fn backend_name(&self) -> &'static str {
        "sqlite"
    }
}

// ---------------------------------------------------------------------------
// postgres — the deliberate scale lane. Compiled ONLY with --features postgres;
// its absence from the default build is the design, not an omission.
// ---------------------------------------------------------------------------
#[cfg(feature = "postgres")]
pub mod pg {
    use super::{Journal, Tick, TickIn};
    use std::sync::Arc;
    use tokio_postgres::NoTls;

    pub struct PostgresJournal {
        client: Arc<tokio::sync::Mutex<tokio_postgres::Client>>,
    }

    impl PostgresJournal {
        /// DATABASE_URL-shaped config string, e.g.
        /// "host=127.0.0.1 user=mesh dbname=bmesh password=…"
        /// Keys live in the environment, never in this repo.
        pub async fn connect(cfg: &str) -> Result<Self, tokio_postgres::Error> {
            let (client, conn) = tokio_postgres::connect(cfg, NoTls).await?;
            tokio::spawn(async move {
                let _ = conn.await;
            });
            client
                .execute(
                    "CREATE TABLE IF NOT EXISTS ticks (
                        id BIGSERIAL PRIMARY KEY,
                        core_units_per_name DOUBLE PRECISION NOT NULL,
                        base_bytes BIGINT NOT NULL,
                        quote_raw BIGINT NOT NULL,
                        source_host TEXT NOT NULL,
                        at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );",
                    &[],
                )
                .await?;
            Ok(Self {
                client: Arc::new(tokio::sync::Mutex::new(client)),
            })
        }
    }

    impl Journal for PostgresJournal {
        fn insert(&self, t: &TickIn) -> i64 {
            // The trait is sync (the demo handlers are sync-scale); block on the
            // async client via a small runtime — polar strength is concurrency,
            // and the call site stays simple.
            let client = self.client.clone();
            let t = t.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async move {
                    let row = client
                        .lock()
                        .await
                        .query_one(
                            "INSERT INTO ticks (core_units_per_name, base_bytes, quote_raw, source_host)
                             VALUES ($1,$2,$3,$4) RETURNING id",
                            &[&t.core_units_per_name, &t.base_bytes, &t.quote_raw, &t.source_host],
                        )
                        .await
                        .expect("insert tick pg");
                    row.get::<_, i64>(0)
                })
            })
        }

        fn recent(&self, n: usize) -> Vec<Tick> {
            let client = self.client.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async move {
                    let rows = client
                        .lock()
                        .await
                        .query(
                            "SELECT id, core_units_per_name, base_bytes, quote_raw, source_host
                             FROM ticks ORDER BY id DESC LIMIT $1",
                            &[&(n as i64)],
                        )
                        .await
                        .expect("query recent pg");
                    rows.iter()
                        .map(|r| Tick {
                            id: r.get(0),
                            core_units_per_name: r.get(1),
                            base_bytes: r.get(2),
                            quote_raw: r.get(3),
                            source_host: r.get(4),
                        })
                        .collect()
                })
            })
        }

        fn count(&self) -> i64 {
            let client = self.client.clone();
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async move {
                    client
                        .lock()
                        .await
                        .query_one("SELECT COUNT(*) FROM ticks", &[])
                        .await
                        .map(|r| r.get::<_, i64>(0))
                        .unwrap_or(0)
                })
            })
        }

        fn backend_name(&self) -> &'static str {
            "postgres"
        }
    }
}
