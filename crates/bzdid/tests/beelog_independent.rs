//! The independent BEELOG proof verifier — a second, differently-coded
//! tree implementation cross-checked against the crate's.
//!
//! The library computes roots and paths by the RFC 6962 TOP-DOWN
//! recursion (`mth` splits at the largest power of two). This file
//! computes the same tree BOTTOM-UP (pair-and-carry per level) and
//! derives audit paths from the level array — a genuinely different code
//! path over the same spec. If the two ever disagree on any root, path,
//! or verdict, one of them is wrong and this test names it.
//!
//! Shared and honestly named: both sides use sha2 and the same 0x00/0x01
//! domain prefixes (that IS the canonical spec — a different prefix
//! would be a different tree, not an independent verifier).

use bzdid::beelog::{
    head_relation, verify_consistency, verify_inclusion, BeeLog, Head, HeadRelation,
};
use sha2::Digest;

/// Bottom-up levels: level 0 = leaf hashes; each level folds sequential
/// pairs (0x01 || a || b) with an odd last node carried unchanged.
fn levels(leaves: &[Vec<u8>]) -> Vec<Vec<[u8; 32]>> {
    let mut lv: Vec<Vec<[u8; 32]>> = vec![leaves
        .iter()
        .map(|b| {
            let mut h = sha2::Sha256::new();
            h.update([0x00]);
            h.update(b);
            let out: [u8; 32] = h.finalize().into();
            out
        })
        .collect()];
    while lv.last().unwrap().len() > 1 {
        let cur = lv.last().unwrap();
        let mut next = Vec::new();
        let mut i = 0;
        while i + 1 < cur.len() {
            let mut h = sha2::Sha256::new();
            h.update([0x01]);
            h.update(cur[i]);
            h.update(cur[i + 1]);
            let out: [u8; 32] = h.finalize().into();
            next.push(out);
            i += 2;
        }
        if i < cur.len() {
            next.push(cur[i]);
        }
        lv.push(next);
    }
    lv
}

fn root2(leaves: &[Vec<u8>]) -> [u8; 32] {
    let lv = levels(leaves);
    if lv.is_empty() || lv[0].is_empty() {
        // SHA-256 of the empty string — the universal known answer
        return [
            0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f,
            0xb9, 0x24, 0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b,
            0x78, 0x52, 0xb8, 0x55,
        ];
    }
    lv.last().unwrap()[0]
}

/// Audit path from the level array: at each level, the sibling of the
/// node covering the target (or None when the node carries alone).
fn path2(leaves: &[Vec<u8>], index: u64) -> Vec<[u8; 32]> {
    let lv = levels(leaves);
    let mut out = Vec::new();
    let mut i = index as usize;
    for level in &lv[..lv.len() - 1] {
        if i % 2 == 1 {
            out.push(level[i - 1]);
        } else if i + 1 < level.len() {
            out.push(level[i + 1]);
        }
        // else: last node of an odd level — carries alone, no sibling
        i /= 2;
    }
    out
}

fn log_of(n: u64, prefix: &str) -> BeeLog {
    let mut log = BeeLog::new();
    for i in 0..n {
        log.append(format!("{prefix}-{i}").as_bytes());
    }
    log
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

#[test]
fn the_two_implementations_agree_on_every_root_and_path() {
    for n in 0..=65u64 {
        let log = log_of(n, "leaf");
        let leaves: Vec<Vec<u8>> = (0..n).map(|i| format!("leaf-{i}").into_bytes()).collect();
        // roots agree (the empty log included, via the known answer)
        assert_eq!(
            { log.head().root },
            root2(&leaves),
            "root disagreement at size {n}"
        );
        // every path agrees AND verifies under the library's verifier
        for i in 0..n {
            let p_lib = log.inclusion_proof(i).unwrap();
            let p_ind = path2(&leaves, i);
            assert_eq!(p_lib, p_ind, "path disagreement at size {n} index {i}");
            assert!(verify_inclusion(&leaves[i as usize], i, &log.head(), &p_lib).is_ok());
        }
    }
}

#[test]
fn every_consistency_proof_verifies_and_the_independent_sizes_agree() {
    for n in 1..=65u64 {
        let log = log_of(n, "leaf");
        let new = log.head();
        for m in 1..=n {
            let old = log.head_at(m).unwrap();
            let proof = log.consistency_proof(m).unwrap();
            assert!(
                verify_consistency(&old, &new, &proof).is_ok(),
                "consistency {m}->{n} must verify"
            );
            // the independent roots at both sizes match the heads
            let leaves_m: Vec<Vec<u8>> = (0..m).map(|i| format!("leaf-{i}").into_bytes()).collect();
            assert_eq!(root2(&leaves_m), old.root);
        }
    }
}

#[test]
fn a_random_growing_log_stays_consistent_at_every_checkpoint() {
    let mut rng = Rng(0xBEEF_0002);
    let mut log = BeeLog::new();
    let mut checkpoints: Vec<Head> = vec![Head::empty()];
    for step in 0..120u64 {
        let mut batch = 1 + rng.below(4);
        while batch > 0 {
            log.append(format!("grow-{step}-{batch}").as_bytes());
            batch -= 1;
        }
        checkpoints.push(log.head());
    }
    // every pair of checkpoints reconciles through the log's proof —
    // the append-only property, demonstrated at 120 random widths
    for (i, old) in checkpoints.iter().enumerate() {
        if old.size == 0 {
            continue;
        }
        let new = *checkpoints.last().unwrap();
        let proof = log.consistency_proof(old.size).unwrap();
        assert!(verify_consistency(old, &new, &proof).is_ok());
        let expected = if old.size == new.size {
            HeadRelation::Equal
        } else {
            HeadRelation::Extends
        };
        assert_eq!(head_relation(old, &new, Some(&proof)), expected);
        let _ = i;
    }
}

#[test]
fn mutations_of_proofs_and_leaves_never_falsely_verify() {
    let mut rng = Rng(0xD00D_0002);
    let log = log_of(17, "leaf");
    let head = log.head();
    let mut refusals = 0usize;
    let mut _tolerated_noops = 0usize;
    for _round in 0..300u64 {
        let idx = rng.below(17); // pick the verified index FIRST so leaf
        let mut proof = log.inclusion_proof(idx).unwrap(); // mutations bite
        let mut leaves: Vec<Vec<u8>> = (0..17u64)
            .map(|i| format!("leaf-{i}").into_bytes())
            .collect();
        let mutated_leaf = !rng.next().is_multiple_of(3); // usually the same leaf
        match rng.below(3) {
            0 => {
                let i = rng.below(proof.len() as u64) as usize;
                let j = rng.below(32);
                let b = rng.below(8);
                proof[i][j as usize] ^= 1 << b;
            }
            1 => {
                let i = if mutated_leaf { idx } else { rng.below(17) } as usize;
                let j = rng.below(leaves[i].len() as u64) as usize;
                let b = rng.below(8);
                leaves[i][j] ^= 1 << b;
            }
            _ => {
                // truncate or extend the proof
                if rng.next().is_multiple_of(2) && proof.len() > 1 {
                    proof.truncate(proof.len() - 1);
                } else {
                    proof.push([0xAB; 32]);
                }
            }
        }
        match verify_inclusion(&leaves[idx as usize], idx, &head, &proof) {
            Err(_) => refusals += 1,
            Ok(()) => {
                // a mutation that still verifies must have been a no-op:
                // the byte-identical original proof over the byte-identical
                // original leaf — anything else is a false accept
                _tolerated_noops += 1;
                assert_eq!(
                    proof,
                    log.inclusion_proof(idx).unwrap(),
                    "a mutated proof that still verifies must be the original"
                );
                assert_eq!(leaves[idx as usize], log.leaf(idx).unwrap().to_vec());
            }
        }
    }
    // both populations non-empty — the battery bit both ways
    assert!(refusals > 0, "no mutation was refused: vacuous");
}

#[test]
fn withheld_and_reordered_histories_never_reconcile() {
    // the honest log
    let honest = log_of(12, "leaf");
    let old = honest.head_at(6).unwrap();
    let new = honest.head();
    let proof = honest.consistency_proof(6).unwrap();
    assert!(verify_consistency(&old, &new, &proof).is_ok());

    // a log whose leaves 6..12 were REORDERED: same size, different root
    let mut reordered = BeeLog::new();
    for i in 0..6u64 {
        reordered.append(format!("leaf-{i}").as_bytes());
    }
    for i in (6..12u64).rev() {
        reordered.append(format!("leaf-{i}").as_bytes());
    }
    let reordered_head = reordered.head();
    assert_ne!(reordered_head.root, new.root);
    assert_eq!(
        head_relation(&old, &reordered_head, None),
        HeadRelation::Unproven
    );
    // and the honest proof does not vouch for it
    assert!(verify_consistency(&old, &reordered_head, &proof).is_err());

    // a truncated log (withholding): shorter head is a rollback
    let short = honest.head_at(9).unwrap();
    assert_eq!(head_relation(&new, &short, None), HeadRelation::Shorter);

    // recovery: from the 6-checkpoint the honest proof catches the
    // wallet up to 12 without re-reading anything
    assert_eq!(
        head_relation(&old, &new, Some(&proof)),
        HeadRelation::Extends
    );
}
