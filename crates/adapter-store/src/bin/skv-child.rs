//! SKV-1 crash child: writes durable batches and acknowledges each one in a
//! separately-fsynced log, forever (until killed). The parent test
//! hard-kills this process mid-run, then proves: every acknowledged commit
//! survived, and no value is torn.
//!
//! argv: <engine sqlite|surrealkv> <dir> <count> [hold-before-first-commit]
//!
//! With the fourth argument the child opens the store and its ack log,
//! writes `dir/ready`, and then holds without committing anything until it
//! is killed: the deterministic pre-first-commit crash boundary (no timing
//! guess about whether the kill lands before op 0).

use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

use adapter_store::{corpus_key, corpus_value, open_named, Edit};

fn main() {
    let mut args = std::env::args().skip(1);
    let engine = args.next().expect("engine name");
    let dir = args.next().expect("dir");
    let count: u64 = args.next().expect("count").parse().expect("count as u64");
    let hold = match args.next().as_deref() {
        None => false,
        Some("hold-before-first-commit") => true,
        Some(other) => panic!("unknown mode {other:?}"),
    };

    let store = open_named(&engine, &Path::new(&dir).join("store")).expect("open store");

    let mut acks = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(Path::new(&dir).join("acks.log"))
        .expect("acks.log");

    if hold {
        std::fs::write(Path::new(&dir).join("ready"), b"open, nothing committed")
            .expect("ready marker");
        loop {
            std::thread::park();
        }
    }

    for i in 0..count {
        // Every 8th batch from i>=64 also deletes a key written 64 steps
        // earlier — tombstones ride the same durability path.
        let mut batch = vec![Edit::Put(corpus_key(i), corpus_value(i))];
        if i >= 64 && i % 8 == 0 {
            batch.push(Edit::Delete(corpus_key(i - 64)));
        }
        store.write_batch(&batch).expect("durable batch");
        // Ack AFTER the durable commit returned. The ack is fsync'd, so the
        // accepted set can only be a subset of the committed set.
        writeln!(acks, "{i}").expect("ack write");
        acks.sync_data().expect("ack fsync");
    }
}
