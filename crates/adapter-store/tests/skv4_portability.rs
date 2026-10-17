//! SKV-4 (portability), first executable receipt: the SAME corpus is written
//! through engine A, exported via `scan_prefix`, reconstructed in engine B,
//! and both scans must agree byte-for-byte — in BOTH directions. No
//! SurrealDB, no export tooling, no daemon: just the two embedded libraries
//! behind the trait.

use adapter_store::{corpus_checksum, corpus_key, corpus_value, open_named, Edit, EmbeddedStore};

const N: u64 = 1_000;
const DELETES: u64 = 100; // keys 0..100 die before export

fn build_ops() -> Vec<Edit> {
    let mut ops = Vec::new();
    for i in 0..N {
        ops.push(Edit::Put(corpus_key(i), corpus_value(i)));
    }
    for i in 0..DELETES {
        ops.push(Edit::Delete(corpus_key(i)));
    }
    ops
}

fn write_in_batches(store: &dyn EmbeddedStore, ops: &[Edit], chunk: usize) {
    for batch in ops.chunks(chunk) {
        store.write_batch(batch).expect("durable batch");
    }
}

fn portability_receipt(from: &str, to: &str) {
    let dir_a = adapter_store::temp_dir(&format!("skv4-{from}-{to}-a"));
    let dir_b = adapter_store::temp_dir(&format!("skv4-{from}-{to}-b"));
    let a = open_named(from, &dir_a.join("store")).expect("open A");
    let b = open_named(to, &dir_b.join("store")).expect("open B");

    write_in_batches(a.as_ref(), &build_ops(), 50);
    a.integrity_check().expect("A integrity");

    // Export/reconstruct: scan A → batch into B.
    let scan_a = a.scan_prefix(b"key-").expect("scan A");
    let import: Vec<Edit> = scan_a
        .iter()
        .map(|(k, v)| Edit::Put(k.clone(), v.clone()))
        .collect();
    write_in_batches(b.as_ref(), &import, 50);
    b.integrity_check().expect("B integrity");

    let scan_b = b.scan_prefix(b"key-").expect("scan B");

    let expected_len = (N - DELETES) as usize;
    let checksum_a = corpus_checksum(&scan_a);
    let checksum_b = corpus_checksum(&scan_b);
    let byte_equal = scan_a == scan_b;

    println!(
        "SKV4-RECEIPT {from}->{to} entries={} byte_equal={byte_equal} checksum_a=fnv1a64:{checksum_a:016x} checksum_b=fnv1a64:{checksum_b:016x} verdict={}",
        scan_a.len(),
        if byte_equal && scan_a.len() == expected_len && scan_b.len() == expected_len { "PASS" } else { "FAIL" }
    );
    assert_eq!(scan_a.len(), expected_len, "export count");
    assert_eq!(scan_b.len(), expected_len, "reconstruction count");
    assert!(byte_equal, "reconstructed state differs byte-for-byte");
    assert_eq!(checksum_a, checksum_b);
    let _ = std::fs::remove_dir_all(&dir_a);
    let _ = std::fs::remove_dir_all(&dir_b);
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv4_sqlite_to_surrealkv() {
    portability_receipt("sqlite", "surrealkv");
}

#[cfg(feature = "surrealkv")]
#[test]
fn skv4_surrealkv_to_sqlite() {
    portability_receipt("surrealkv", "sqlite");
}
