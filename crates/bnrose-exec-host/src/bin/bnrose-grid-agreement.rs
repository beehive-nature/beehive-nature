//! bnrose-grid-agreement — the RUST HALF of the sampled-agreement grid
//! (founder order 2026-10-14). Reads grid.list (canonical cells: one
//! "<recs> <rows>" hex pair per line; each cell runs under both policy
//! flags) and emits one JSON line per executed cell, computing every
//! field through the REAL single definitions the run path itself uses:
//!
//!   maxA  <- step_entity_attempt (the journal scan)
//!   nextA <- replacement_attempt  (the attempt number, saturating)
//!   anyRow<- step_has_row_among   (the ledger scan, real step_op_id keys)
//!   gate  <- replacement_admissible(the exact law's conjunction)
//!
//! Discrimination noise rides every cell: journal records with other
//! events, other roots and other steps; ledger rows keyed by other steps
//! and another root — the scans must filter them, not trip on them. The
//! Cryptol half (sampled-agreement-check.sh) embeds THESE lines as
//! literals and :proves per-cell agreement; a perturbation control must
//! refute. SAMPLED AGREEMENT IS AN INTERMEDIATE GATE, not SAW
//! implementation correspondence.
//!
//! Run: bnrose-grid-agreement <grid.list>   (JSON lines on stdout)

use bnrose_exec_host::journal;
use bnrose_exec_host::opexec::{
    replacement_admissible, replacement_attempt, step_entity_attempt, step_has_row_among,
    StepOptions,
};

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: bnrose-grid-agreement <grid.list>");
    let text = std::fs::read_to_string(&path).expect("grid.list");
    // one fixed (root, step) slice: the twin quantifies over both; the
    // grid exercises one named slice with adversarial noise around it.
    let root = [0xA5u8; 32];
    let other_root = [0x5Au8; 32];
    let step: u8 = 3;

    // journal noise: other events, other roots, other steps — plus the
    // real admissions for every attempt bit set in recs. The payload is
    // the REAL E_STEP_ADMITTED shape (root || encoded || label-len ||
    // label — 34+ bytes; step_entity_attempt's length guard demands it).
    let mut seq = 0u64;
    let admit = |seq: &mut u64, event: u8, root: &[u8; 32], enc: u8, label: &str| {
        let mut p = Vec::with_capacity(34 + label.len());
        p.extend_from_slice(root);
        p.push(enc);
        p.push(label.len() as u8);
        p.extend_from_slice(label.as_bytes());
        *seq += 1;
        journal::Record {
            seq: *seq,
            op_id: [0; 32],
            event,
            payload: p,
            tag: [0; 32],
        }
    };

    for line in text
        .lines()
        .filter(|l| !l.trim_start().starts_with('#') && !l.trim().is_empty())
    {
        let mut it = line.split_whitespace();
        let recs = u16::from_str_radix(it.next().unwrap().trim_start_matches("0x"), 16).unwrap();
        let rows = u16::from_str_radix(it.next().unwrap().trim_start_matches("0x"), 16).unwrap();

        let mut records = Vec::new();
        // real admissions for the journaled attempts…
        for a in 0u8..16 {
            if recs & (1 << a) != 0 {
                records.push(admit(
                    &mut seq,
                    bnrose_exec_core::E_STEP_ADMITTED,
                    &root,
                    step | (a << 4),
                    "grid",
                ));
            }
        }
        // …and discrimination noise the scan must ignore
        records.push(admit(
            &mut seq,
            bnrose_exec_core::E_ADMITTED,
            &root,
            step,
            "grid",
        ));
        records.push(admit(
            &mut seq,
            bnrose_exec_core::E_STEP_ADMITTED,
            &other_root,
            step,
            "grid",
        ));
        records.push(admit(
            &mut seq,
            bnrose_exec_core::E_STEP_ADMITTED,
            &root,
            step + 1,
            "grid",
        ));

        // ledger rows for the recorded attempts (real op-id keys)…
        let mut row_ids: Vec<[u8; 32]> = Vec::new();
        for a in 0u8..16 {
            if rows & (1 << a) != 0 {
                row_ids.push(bnrose_exec_core::step_op_id(&root, step | (a << 4)));
            }
        }
        // …and noise keyed by other steps and another root
        row_ids.push(bnrose_exec_core::step_op_id(&root, (step + 1) | (1 << 4)));
        row_ids.push(bnrose_exec_core::step_op_id(&other_root, step));

        let max_a = step_entity_attempt(&records, &root, step);
        let next_a = replacement_attempt(max_a);
        let any_row = step_has_row_among(&row_ids, &root, step);
        for opt_in in [false, true] {
            let opts = StepOptions {
                replace_never_executed_failed_steps: opt_in,
            };
            let gate = replacement_admissible(any_row, &opts);
            println!(
                "{}",
                serde_json::json!({
                    "recs": format!("0x{recs:04X}"),
                    "rows": format!("0x{rows:04X}"),
                    "optIn": opt_in,
                    "maxA": max_a,
                    "nextA": next_a,
                    "anyRow": any_row,
                    "gate": gate,
                })
            );
        }
    }
}
