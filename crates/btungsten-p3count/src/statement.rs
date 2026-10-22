//! The receipt count statement as a Rust model (SPEC-BTUNGSTEN-PQ-1 §PQ10).
//!
//! The claim is contracts/zkreceipts/count.circom's, unchanged: over a private
//! set of n receipt leaves (n a power of two, slots at or past `members` the
//! all-zero leaf), each `(fp, pheno, r1, r2, r3)`, a member is KEPT when it has
//! at least one settled verdict and no settled verdict other than `1 + pheno`,
//! and the public claim `(root, kind, count)` holds iff the committed set's
//! kept count for baseline `kind` (0 dead, 1 live) is `count`.
//!
//! What changes is the commitment only: Poseidon2 over KoalaBear (the
//! Plonky3 default width-16 instance) in the same full-tree shape, because
//! BN254 Poseidon is non-native to a 31-bit field. `fp` enters as three
//! limbs of 22, 21 and 21 bits, so the STARK domain is exactly 64 bits where
//! the circuit took any BN254 scalar (`count.circom:33`, no range check);
//! every fixture is a 64-bit fingerprint, so every fixture is in both.

use p3_field::PrimeCharacteristicRing;
use p3_koala_bear::{KoalaBear, Poseidon2KoalaBear, default_koalabear_poseidon2_16};
use p3_symmetric::Permutation;

pub type F = KoalaBear;
pub type Digest = [F; 8];

/// Bits per `fp` limb, low limb first.
pub const FP_LIMB_BITS: [usize; 3] = [22, 21, 21];

/// The first input element of every leaf hash. Node hashes take two
/// digests and no tag; the tree's shape is fixed by the statement's n.
pub const LEAF_TAG: u32 = 1;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Leaf {
    pub fp: u64,
    /// 0 dead baseline, 1 live baseline
    pub pheno: u8,
    /// per-vantage verdicts: 0 unsettled, 1 dead, 2 live (3 reads as a flip)
    pub r: [u8; 3],
}

impl Leaf {
    /// A leaf the circuit would accept: one baseline bit, verdicts < 4.
    pub fn well_formed(&self) -> bool {
        self.pheno <= 1 && self.r.iter().all(|&r| r < 4)
    }
}

pub fn limbs(fp: u64) -> [u32; 3] {
    [
        (fp & ((1 << 22) - 1)) as u32,
        ((fp >> 22) & ((1 << 21) - 1)) as u32,
        (fp >> 43) as u32,
    ]
}

/// count.circom `Leaf()`: kept = (at least one settled run) AND (zero flips),
/// a flip being a settled verdict other than 1 + pheno.
pub fn kept(l: &Leaf) -> bool {
    let expected = 1 + l.pheno;
    let settled = l.r.iter().any(|&r| r != 0);
    let flipped = l.r.iter().any(|&r| r != 0 && r != expected);
    settled && !flipped
}

/// (dead kept, live kept) contributed by one leaf.
pub fn counters(l: &Leaf) -> (u32, u32) {
    let k = kept(l) as u32;
    (k * (1 - l.pheno as u32), k * l.pheno as u32)
}

pub fn leaf_input(l: &Leaf) -> [F; 16] {
    let [a, b, c] = limbs(l.fp);
    let mut s = [F::ZERO; 16];
    s[0] = F::from_u32(LEAF_TAG);
    s[1] = F::from_u32(a);
    s[2] = F::from_u32(b);
    s[3] = F::from_u32(c);
    s[4] = F::from_u8(l.pheno);
    for k in 0..3 {
        s[5 + k] = F::from_u8(l.r[k]);
    }
    s
}

pub fn node_input(left: &Digest, right: &Digest) -> [F; 16] {
    let mut s = [F::ZERO; 16];
    s[..8].copy_from_slice(left);
    s[8..].copy_from_slice(right);
    s
}

/// The permutation and its truncation to the first 8 elements.
pub struct Hasher(Poseidon2KoalaBear<16>);

impl Default for Hasher {
    fn default() -> Self {
        Self(default_koalabear_poseidon2_16())
    }
}

impl Hasher {
    pub fn compress(&self, input: [F; 16]) -> Digest {
        let mut s = input;
        self.0.permute_mut(&mut s);
        s[..8].try_into().expect("8 of 16")
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Statement {
    pub root: Digest,
    pub dead: u32,
    pub live: u32,
}

/// The committed set's root and both kept counters, by the full-tree fold.
pub fn statement(h: &Hasher, leaves: &[Leaf]) -> Statement {
    assert!(
        leaves.len().is_power_of_two(),
        "the tree is full: n is a power of two"
    );
    let mut level: Vec<(Digest, u32, u32)> = leaves
        .iter()
        .map(|l| {
            let (d, v) = counters(l);
            (h.compress(leaf_input(l)), d, v)
        })
        .collect();
    while level.len() > 1 {
        level = level
            .chunks(2)
            .map(|p| {
                (
                    h.compress(node_input(&p[0].0, &p[1].0)),
                    p[0].1 + p[1].1,
                    p[0].2 + p[1].2,
                )
            })
            .collect();
    }
    let (root, dead, live) = level[0];
    Statement { root, dead, live }
}

/// The public claim, count.circom's selector law: `kind` picks its own counter.
pub fn claim_holds(s: &Statement, kind: u8, count: u32) -> bool {
    match kind {
        0 => s.dead == count,
        1 => s.live == count,
        _ => false,
    }
}

/// The cohort fixtures in contracts/zkreceipts/fixtures/ (`members[]` with a
/// 16-hex `id`, `was` dead|opened, `perRun` of dead|opened|unsettled|null, the
/// ant-reach vocabulary that contracts/zkreceipts/zkrprep.cjs:23-24 maps), padded to `n`.
pub fn leaves_from_cohort(json: &str, n: usize) -> Vec<Leaf> {
    let v: serde_json::Value = serde_json::from_str(json).expect("cohort json");
    let verdict = |x: &serde_json::Value| match x.as_str() {
        None | Some("unsettled") => 0,
        Some("dead") => 1,
        Some("opened") => 2,
        Some(other) => panic!("unknown verdict {other}"),
    };
    let mut out: Vec<Leaf> = v["members"]
        .as_array()
        .expect("members")
        .iter()
        .map(|m| {
            let runs = m["perRun"].as_array().expect("perRun");
            Leaf {
                fp: u64::from_str_radix(m["id"].as_str().expect("id"), 16).expect("16-hex id"),
                pheno: match m["was"].as_str() {
                    Some("dead") => 0,
                    Some("opened") => 1,
                    other => panic!("unknown baseline {other:?}"),
                },
                r: [verdict(&runs[0]), verdict(&runs[1]), verdict(&runs[2])],
            }
        })
        .collect();
    assert!(
        out.len() <= n,
        "{} members do not fit {n} leaves",
        out.len()
    );
    out.resize(n, Leaf::default());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const ASYM: &str = include_str!("../../../contracts/zkreceipts/fixtures/asym-cohort.json");

    #[test]
    fn kept_matches_the_circuit_on_every_leaf_shape() {
        // all 2 * 4^3 well-formed shapes, against the circom rule written out
        for ph in 0..2u8 {
            for code in 0..64u8 {
                let r = [code & 3, (code >> 2) & 3, (code >> 4) & 3];
                let l = Leaf {
                    fp: 0,
                    pheno: ph,
                    r,
                };
                let settled = r.iter().filter(|&&x| x != 0).count();
                let flips = r.iter().filter(|&&x| x != 0 && x != 1 + ph).count();
                assert_eq!(kept(&l), settled >= 1 && flips == 0, "{l:?}");
            }
        }
    }

    #[test]
    fn the_asymmetric_cohort_keeps_20_dead_and_19_live() {
        let h = Hasher::default();
        let s = statement(&h, &leaves_from_cohort(ASYM, 64));
        assert_eq!((s.dead, s.live), (20, 19));
        assert!(claim_holds(&s, 0, 20) && claim_holds(&s, 1, 19));
        assert!(
            !claim_holds(&s, 1, 20) && !claim_holds(&s, 0, 19),
            "the reversed claims are false"
        );
    }

    #[test]
    fn limbs_split_and_rejoin_64_bits() {
        for fp in [
            0u64,
            1,
            u64::MAX,
            0x00d64acd2953d654,
            1 << 22,
            (1 << 43) - 1,
        ] {
            let [a, b, c] = limbs(fp);
            assert!(a < 1 << 22 && b < 1 << 21 && c < 1 << 21);
            assert_eq!(a as u64 | (b as u64) << 22 | (c as u64) << 43, fp);
        }
    }

    #[test]
    fn the_root_depends_on_every_leaf() {
        let h = Hasher::default();
        let base = leaves_from_cohort(ASYM, 64);
        let r0 = statement(&h, &base).root;
        for i in [0usize, 1, 39, 40, 63] {
            let mut l = base.clone();
            l[i].fp ^= 1;
            assert_ne!(statement(&h, &l).root, r0, "leaf {i}");
        }
    }
}
