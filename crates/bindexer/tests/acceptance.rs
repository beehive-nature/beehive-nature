//! The blockbook acceptance matrix (SPEC-BINDEXER-0 §1) — every row is a named
//! test, receipted. Offline: fixture oracles, no network, deterministic.

use bindexer::ingest::{self, IngestConfig, IngestError};
use bindexer::oracle::{Block, Oracle, Tip};
use bindexer::{api, store};
use serde_json::{json, Value};

// ---------- fixture oracles (FIXTURE data — shapes follow EVM RPC responses) ----------

fn fx_tx(hash: &str, from: &str, to: &str, value_hex: &str) -> Value {
    json!({"hash": hash, "from": from, "to": to, "value": value_hex})
}

fn fx_block(height: i64, hash: &str, parent: &str, txs: Vec<Value>) -> Block {
    Block {
        height,
        hash: h2b(hash),
        parent: h2b(parent),
        ts: 1_700_000_000 + height,
        txs,
    }
}

fn h2b(h: &str) -> Vec<u8> {
    let h = h.trim_start_matches("0x");
    (0..h.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&h[i..i + 2], 16).unwrap())
        .collect()
}

#[derive(Clone)]
struct FixtureOracle {
    name: String,
    chain: String,
    blocks: Vec<Block>,
    tip_height: i64,
}

impl FixtureOracle {
    fn at(&self, h: i64) -> Option<&Block> {
        self.blocks.iter().find(|b| b.height == h)
    }
}

impl Oracle for FixtureOracle {
    fn name(&self) -> &str {
        &self.name
    }
    fn chain_id(&self) -> String {
        self.chain.clone()
    }
    fn tip(&self) -> Result<Tip, String> {
        let b = self.at(self.tip_height).ok_or("no tip")?;
        Ok(Tip {
            height: b.height,
            hash: b.hash.clone(),
        })
    }
    fn block_by_height(&self, height: i64) -> Result<Option<Block>, String> {
        Ok(self.at(height).cloned())
    }
}

fn canonical() -> Vec<Block> {
    vec![
        fx_block(100, "0xaaaa0100", "0xaaaa00ff", vec![]),
        fx_block(
            101,
            "0xaaaa0101",
            "0xaaaa0100",
            vec![
                fx_tx("0xtx0001", "0xAAAAsender", "0xBBBBrrecv", "0x64"),
                fx_tx("0xtx0002", "0xBBBBrrecv", "0xCCCCsinkk", "0x0"),
            ],
        ),
        fx_block(102, "0xaaaa0102", "0xaaaa0101", vec![]),
    ]
}

fn oracle_pair() -> (FixtureOracle, FixtureOracle) {
    let a = FixtureOracle {
        name: "fx-a".into(),
        chain: "0x1c20".into(),
        blocks: canonical(),
        tip_height: 102,
    };
    let b = FixtureOracle {
        name: "fx-b".into(),
        chain: "0x1c20".into(),
        blocks: canonical(),
        tip_height: 102,
    };
    (a, b)
}

fn db() -> (rusqlite::Connection, tempfileish::PathBuf) {
    // no tempfile dep: use a per-test unique file in std::env::temp_dir
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let pid = std::process::id();
    let path = std::env::temp_dir().join(format!("bindexer-test-{pid}-{n}.db"));
    let conn = store::open(path.to_str().unwrap()).unwrap();
    store::init(&conn, "7200").unwrap();
    (conn, path)
}

mod tempfileish {
    pub type PathBuf = std::path::PathBuf;
}

fn cfg(single: bool) -> IngestConfig {
    IngestConfig {
        allow_single_source: single,
        lag_ms: 0,
    }
}

// ---------- §1 row 1: status — a reader's first duty is confessing ----------

#[test]
fn matrix_status_row() {
    let (mut conn, _p) = db();
    let s = api::status(&conn);
    assert_eq!(s["backend"], "bindexer/0.1 (SPEC-BINDEXER-0)");
    assert_eq!(
        s["best_height"],
        json!(-1),
        "empty reader confesses, never fakes"
    );
    assert!(
        s["db"]["rows"]["blocks"].is_number(),
        "per-table row counts present"
    );
    assert!(
        s["db"]["wal_frames_written"].is_number(),
        "WAL confession present"
    );
    assert_eq!(
        s["sendtx"],
        json!("NO — permanently (the spec's most important row)")
    );
    assert_eq!(s["keyless"], json!(true));
}

// ---------- §1 row 2: height↔hash is the spine of every receipt ----------

#[test]
fn matrix_block_spine_row() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    let by_height = api::block_by_height(&conn, 101);
    assert_eq!(by_height["hash"], json!("0xaaaa0101"));
    assert_eq!(by_height["parent"], json!("0xaaaa0100"));
    assert_eq!(by_height["tx_count"], json!(2));
    let by_hash = api::block_by_hash(&conn, "0xaaaa0101");
    assert_eq!(
        by_hash["height"],
        json!(101),
        "hash→height inverts height→hash"
    );
    assert!(by_height["sources"]["oracles"].is_array());
}

// ---------- §1 row 3: tx normalized, blockbook field names ----------

#[test]
fn matrix_tx_normalized_row() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    let t = api::tx(&conn, "0xtx0001");
    assert_eq!(t["txid"], json!("0xtx0001"));
    assert_eq!(t["vout"][0]["value"], json!("0x64"), "wei as string");
    assert_eq!(t["blockHeight"], json!(101));
    assert!(t["confirmations"].is_number(), "confirmations computed");
    assert!(
        t["sources"]["oracles"].is_array(),
        "epistemic state travels with the datum"
    );
    // not-found renders mempool-style, never an invented number
    let absent = api::tx(&conn, "0xnope0000");
    assert_eq!(absent["blockHeight"], json!(-1));
}

// ---------- §1 row 4: address ladder, txids = the default cheap depth ----------

#[test]
fn matrix_address_ladder_row() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    let r = api::address(&conn, "0xBBBBrrecv");
    assert_eq!(r["tx_count"], json!(2), "one receive, one send");
    let txids = r["txids"].as_array().unwrap();
    assert!(txids.len() == 2, "txids default depth");
    assert_eq!(
        r["balance_wei"],
        json!("100"),
        "0x64 in (tx0001), 0x0 out (tx0002) — net +100, rendered as string"
    );
    let s = api::address(&conn, "0xAAAAsender");
    assert_eq!(
        s["balance_wei"],
        json!("-100"),
        "negative delta renders signed"
    );
}

// ---------- §1 row 5: sendtx — NO, permanently ----------

#[test]
fn matrix_sendtx_row_permanently_no() {
    // structural: the source scan test (tests/keyless.rs) enforces no broadcast verbs;
    // semantic: the attestation is part of status so a stranger reads it off the wire
    let (mut conn, _p) = db();
    let s = api::status(&conn);
    assert!(s["sendtx"].as_str().unwrap().starts_with("NO"));
    assert!(
        s["notes"]["utxos"].is_string(),
        "phased rows confess their phase"
    );
}

// ---------- §3: the two-oracle law, enforced ----------

#[test]
fn two_oracle_law_sources_field() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    let sources: Value = {
        let raw: String = conn
            .query_row("SELECT sources_json FROM tips LIMIT 1", [], |r| r.get(0))
            .unwrap();
        serde_json::from_str(&raw).unwrap()
    };
    assert_eq!(
        sources["oracles"],
        json!(["fx-a", "fx-b"]),
        "both oracles named in schema"
    );
    assert_eq!(sources["single_source"], json!(false));
}

#[test]
fn two_oracle_divergence_fails_closed() {
    let (mut conn, _p) = db();
    let (a, b0) = oracle_pair();
    // oracle-b sees a DIFFERENT hash at 102 — the census law's nightmare
    let mut diverged_blocks = b0.blocks.clone();
    diverged_blocks[2] = fx_block(102, "0xeeee0102", "0xaaaa0101", vec![]);
    let b = FixtureOracle {
        blocks: diverged_blocks,
        ..b0
    };
    let err = ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap_err();
    match err {
        IngestError::Diverged(h, ra, rb) => {
            assert_eq!(h, 102);
            assert_ne!(ra, rb);
        }
        other => panic!("expected Diverged, got {other}"),
    }
    let stored: i64 = conn
        .query_row("SELECT COUNT(*) FROM blocks", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        stored, 2,
        "100 and 101 landed; the divergent height wrote NOTHING"
    );
}

#[test]
fn single_source_needs_the_flag_and_is_marked() {
    let (mut conn, _p) = db();
    let (a, _b) = oracle_pair();
    let unreachable = FixtureOracle {
        blocks: vec![],
        tip_height: 0,
        ..a.clone()
    };
    // without the flag: fail-closed
    let err = ingest::ingest_range(&mut conn, &a, &unreachable, 100, 101, &cfg(false));
    assert!(err.is_err(), "single source without flag must refuse");
    // with the flag: allowed, and marked in the schema
    ingest::ingest_range(&mut conn, &a, &unreachable, 100, 101, &cfg(true)).unwrap();
    let raw: String = conn
        .query_row("SELECT sources_json FROM tips LIMIT 1", [], |r| r.get(0))
        .unwrap();
    let sources: Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(
        sources["single_source"],
        json!(true),
        "the mark renders, surfaces show it"
    );
    assert_eq!(sources["oracles"], json!(["fx-a"]));
}

// ---------- §4: reorgs append, never delete ----------

#[test]
fn reorg_appends_a_row_and_deletes_nothing() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    // chain reorgs: 102 replaced by 102' under a new tip 103
    let forked = FixtureOracle {
        name: "fx-a".into(),
        chain: "0x1c20".into(),
        tip_height: 103,
        blocks: vec![
            canonical()[0].clone(),
            canonical()[1].clone(),
            fx_block(102, "0xbbbb0102", "0xaaaa0101", vec![]),
            fx_block(103, "0xbbbb0103", "0xbbbb0102", vec![]),
        ],
    };
    let forked_b = forked.clone();
    ingest::ingest_range(&mut conn, &forked, &forked_b, 102, 103, &cfg(false)).unwrap();
    let reorgs = api::reorgs(&conn);
    let rows = reorgs["reorgs"].as_array().unwrap();
    assert_eq!(rows.len(), 1, "one reorg row appended");
    assert_eq!(rows[0]["depth"], json!(1));
    let orphaned = rows[0]["orphaned"].as_array().unwrap();
    assert_eq!(orphaned[0].as_str().unwrap().to_lowercase(), "0xaaaa0102");
    // nothing deleted: the orphaned block and its records remain queryable
    let still_there = api::block_by_hash(&conn, "0xaaaa0102");
    assert!(
        still_there["height"].is_number(),
        "orphaned history stays — append-mostly"
    );
    let all_heights: i64 = conn
        .query_row("SELECT COUNT(DISTINCT height) FROM blocks", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(all_heights, 4, "100,101,102,103 all present; the orphaned 102 stays, its hash lives in the reorg row, the new chain advances to 103");
}

// ---------- §1 utxo row: BCH lane, phase-flagged, confessed ----------

#[test]
fn utxo_row_is_bch_phase_and_confessed() {
    let (mut conn, _p) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    let utxos: i64 = store::table_count(&conn, "utxos").unwrap();
    assert_eq!(utxos, 0, "EVM lane: utxo table exists, empty by design");
    let s = api::status(&conn);
    assert!(s["notes"]["utxos"].as_str().unwrap().contains("phase 2"));
}

// ---------- stranger-audit deliverable ----------

#[test]
fn deliverable_is_one_sealed_file_with_meta_receipts() {
    let (mut conn, path) = db();
    let (a, b) = oracle_pair();
    ingest::ingest_range(&mut conn, &a, &b, 100, 102, &cfg(false)).unwrap();
    store::seal(&conn).unwrap();
    let keyless: String = conn
        .query_row("SELECT value FROM meta WHERE key='keyless'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(keyless.starts_with("true"));
    drop(conn);
    let wal = std::path::PathBuf::from(format!("{}-wal", path.to_str().unwrap()));
    if wal.exists() {
        let len = std::fs::metadata(&wal).unwrap().len();
        assert_eq!(
            len, 0,
            "WAL truncated on seal — the deliverable is one file"
        );
    }
    let _ = std::fs::remove_file(&path);
}
