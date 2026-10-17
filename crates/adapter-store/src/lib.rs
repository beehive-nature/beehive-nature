//! # adapter-store — the engine-neutral embedded-storage seam
//!
//! NO-SERVER-DB (founder ruling 2026-10-13, SKV lane): BNR sovereign nodes
//! run storage as IN-PROCESS libraries. No database daemon, no centralized
//! database endpoint, no privileged database operator. Constructors in this
//! crate take a filesystem PATH and nothing else — there is no DSN, host or
//! port anywhere in the seam, so a server-database backend cannot even be
//! expressed through it.
//!
//! SQLite (`rusqlite`, bundled) is the REFERENCE implementation; SurrealKV
//! 1.0 is the CANDIDATE. Both are replaceable leaves: neither engine
//! receives authority over identity, consensus, receipts or peer discovery.
//! The seam stores bytes and returns bytes — semantics live above, in the
//! kernel.
//!
//! ## The durability law
//!
//! Every write is durable-on-return (`DurabilityMode::Immediate`): SQLite
//! runs WAL + `synchronous=FULL`; SurrealKV sets `Durability::Immediate` on
//! every transaction. Constructors VERIFY the setting took effect by reading
//! it back (L5: configuration intent is never runtime evidence). The
//! behavioral evidence is the crash-recovery test (`tests/skv1_crash_recovery.rs`):
//! a child process is hard-killed mid-write and the store must reopen with
//! every acknowledged commit present and zero torn values.
//!
//! TAM boundary, named honestly: the crash tests exercise PROCESS DEATH.
//! Power-loss durability (fsync actually reaching platter) is a different
//! slice that this beat does not and cannot observe on a healthy machine —
//! NOT RUN, not claimed.
//!
//! ## Gate map (SKV lane, dispatches 2026-10-13)
//!
//! - SKV-1 autonomous recovery → `tests/skv1_crash_recovery.rs`
//! - SKV-4 portability (export/reconstruct through the other engine) →
//!   `tests/skv4_portability.rs`
//! - NO-SERVER-DB run condition (observed, not assumed) →
//!   `tests/noserverdb_sockets.rs`
//! - SKV-2 partition, SKV-3 sovereignty, SKV-5 scale/longevity → later
//!   beats; NOT BUILT, NOT RUN.

pub mod sqlite;
#[cfg(feature = "surrealkv")]
pub mod surrealkv;

use std::path::Path;

pub type Result<T> = std::result::Result<T, StoreError>;

#[derive(Debug)]
pub enum StoreError {
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
    #[cfg(feature = "surrealkv")]
    SurrealKv(::surrealkv::Error),
    Corrupt {
        detail: String,
    },
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Io(e) => write!(f, "io: {e}"),
            StoreError::Sqlite(e) => write!(f, "sqlite: {e}"),
            #[cfg(feature = "surrealkv")]
            StoreError::SurrealKv(e) => write!(f, "surrealkv: {e}"),
            StoreError::Corrupt { detail } => write!(f, "corrupt: {detail}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<std::io::Error> for StoreError {
    fn from(e: std::io::Error) -> Self {
        StoreError::Io(e)
    }
}

impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        StoreError::Sqlite(e)
    }
}

#[cfg(feature = "surrealkv")]
impl From<::surrealkv::Error> for StoreError {
    fn from(e: ::surrealkv::Error) -> Self {
        StoreError::SurrealKv(e)
    }
}

/// One atomic edit inside a [`EmbeddedStore::write_batch`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Edit {
    Put(Vec<u8>, Vec<u8>),
    Delete(Vec<u8>),
}

/// Durability as CONFIGURED. This is a receipt label, not evidence: the
/// evidence for Immediate is the crash-recovery test (L5).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DurabilityMode {
    Eventual,
    Immediate,
}

impl std::fmt::Display for DurabilityMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DurabilityMode::Eventual => write!(f, "eventual"),
            DurabilityMode::Immediate => write!(f, "immediate"),
        }
    }
}

/// The embedded-storage contract. Implementations are in-process libraries
/// behind path-only constructors; a batch either lands whole and durable or
/// not at all.
pub trait EmbeddedStore: Send + Sync {
    /// Engine identity for receipts (e.g. "sqlite/reference", "surrealkv/1.0").
    fn engine(&self) -> &'static str;

    /// Durability mode as configured (verified read-back at open). Receipt
    /// label only — behavioral evidence is the crash test.
    fn durability_mode(&self) -> DurabilityMode;

    /// Atomically apply `batch` and return only after the batch is durable
    /// (fsync'd). Empty batches are a no-op.
    fn write_batch(&self, batch: &[Edit]) -> Result<()>;

    fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>>;

    /// All `(key, value)` pairs with `prefix`, in key order. This is the
    /// export basis for SKV-4 portability.
    fn scan_prefix(&self, prefix: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>>;

    /// Engine-side structural check. SQLite: `PRAGMA integrity_check`.
    /// SurrealKV: `inspect_db` over the on-disk state.
    fn integrity_check(&self) -> Result<()>;

    /// Engine maintenance, honest per engine: reclaim what the engine's
    /// own facilities allow. SQLite: WAL checkpoint(TRUNCATE) + VACUUM —
    /// real space reclaim. SurrealKV 1.0: `flush_wal(true)` only — leveled
    /// compaction is background policy with no public manual trigger in
    /// 1.0, so receipts name which reclaim actually happened.
    fn compact(&self) -> Result<()>;
}

/// Exclusive upper bound for a prefix range (`prefix` itself if it is all
/// `0xFF` → `None`, meaning unbounded).
pub fn prefix_upper(prefix: &[u8]) -> Option<Vec<u8>> {
    let mut upper = prefix.to_vec();
    while let Some(last) = upper.last_mut() {
        if *last == 0xFF {
            upper.pop();
        } else {
            *last += 1;
            return Some(upper);
        }
    }
    None
}

/// Deterministic corpus key `i` (shared by every test so receipts name the
/// same namespace).
pub fn corpus_key(i: u64) -> Vec<u8> {
    format!("key-{i:08}").into_bytes()
}

/// Deterministic corpus value for key `i`: xorshift stream, length
/// 64..=308 bytes. Torn-value detection compares against exactly this.
pub fn corpus_value(i: u64) -> Vec<u8> {
    let len = 64 + ((i % 5) * 61) as usize;
    let mut x = i
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(0x1234_5678_9ABC_DEF0)
        | 1;
    let mut v = Vec::with_capacity(len);
    while v.len() < len {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        v.extend_from_slice(&x.to_le_bytes());
    }
    v.truncate(len);
    v
}

/// FNV-1a 64 over bytes — a short, dependency-free checksum for receipts
/// (identity of a corpus, not a cryptographic claim).
pub fn fnv1a64(data: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in data {
        h ^= b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01B3);
    }
    h
}

/// Ordered checksum over an entry list — two engines holding identical
/// state produce identical values.
pub fn corpus_checksum(entries: &[(Vec<u8>, Vec<u8>)]) -> u64 {
    let mut acc: Vec<u8> = Vec::new();
    for (k, v) in entries {
        acc.extend_from_slice(&(k.len() as u64).to_le_bytes());
        acc.extend_from_slice(k);
        acc.extend_from_slice(&(v.len() as u64).to_le_bytes());
        acc.extend_from_slice(v);
    }
    fnv1a64(&acc)
}

/// Open an engine by name ("sqlite" | "surrealkv") — the dispatch the test
/// child binary uses. Fails loudly on any other name (no silent default).
pub fn open_named(engine: &str, path: &Path) -> Result<Box<dyn EmbeddedStore>> {
    match engine {
        "sqlite" => Ok(Box::new(sqlite::open(path)?)),
        #[cfg(feature = "surrealkv")]
        "surrealkv" => Ok(Box::new(surrealkv::open(path)?)),
        other => Err(StoreError::Corrupt {
            detail: format!("unknown engine name: {other}"),
        }),
    }
}

/// Unique temp dir for a test (best-effort cleanup is the caller's).
pub fn temp_dir(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join("adapter-store").join(format!(
        "{tag}-{}-{}",
        std::process::id(),
        crate::fnv1a64(tag.as_bytes())
    ));
    std::fs::create_dir_all(&d).expect("temp dir");
    d
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefix_upper_basics() {
        assert_eq!(prefix_upper(b"key-"), Some(b"key.".to_vec()));
        assert_eq!(prefix_upper(b"\xFF"), None);
        assert_eq!(prefix_upper(b"\xFF\x00"), Some(b"\xFF\x01".to_vec()));
    }

    #[test]
    fn corpus_is_deterministic_and_sized() {
        assert_eq!(corpus_value(7), corpus_value(7));
        assert_ne!(corpus_value(7), corpus_value(8));
        assert_eq!(corpus_value(0).len(), 64);
        assert_eq!(corpus_value(4).len(), 64 + 4 * 61);
    }
}
