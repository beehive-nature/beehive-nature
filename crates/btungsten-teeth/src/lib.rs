//! bTunGsTeN teeth: the two sabotage templates of SPEC-BTUNGSTEN-PQ-1 §2
//! (docs/specs/SPEC-BTUNGSTEN-PQ-1.md). Every lane of the PQ program runs
//! them against its own verifiers and hashes. A template is trusted only
//! after it has convicted a real instance of its flaw (the Vortex
//! reproduction, scripts/btungsten/pq00-teeth-vortex.sh) and a planted one
//! (the tests below). No dependencies, so a build copy outside this
//! workspace can link it.
//!
//! The templates:
//!
//! - **T-VACUOUS**: a verifier must refuse the degenerate shape of what it
//!   checks (no openings, no queries, no partial signatures, an empty
//!   manifest). The Vortex `verify()` at `3c0affd9320a` checks a Merkle path
//!   for each opened column it is handed and never compares that count to
//!   the number it asked for, so zero openings pass.
//! - **T-TRUNCATE**: a hash, absorb or encoder must depend on every input
//!   position. The Vortex `RSis::hash()` at the same pin, on any build
//!   without AVX-512, hands each chunk a fresh iterator, so every chunk
//!   re-reads the first 256 elements and the rest of the input is ignored.
//!
//! A target with the flaw comes back as [`Failure::Convicted`] with the
//! witness. A harness that cannot tell (the honest shape refused, nothing
//! degenerate to try, a perturbation that changes nothing) comes back as
//! [`Failure::Miswired`]: that is a broken test, never a pass.

use std::fmt::Debug;
use std::panic::{catch_unwind, AssertUnwindSafe};

/// What a template checked when the target passed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Checked {
    pub template: &'static str,
    pub cases: usize,
}

/// Why a template did not pass.
#[derive(Debug)]
pub enum Failure<W> {
    /// The target has the flaw; `witness` shows it.
    Convicted {
        template: &'static str,
        detail: String,
        witness: W,
    },
    /// The harness could not decide anything.
    Miswired(String),
}

impl<W> Failure<W> {
    pub fn is_convicted(&self) -> bool {
        matches!(self, Failure::Convicted { .. })
    }
}

/// Runs a verifier that reports refusal by panicking (as Vortex does with
/// `assert!`) and returns whether it accepted.
pub fn accepts_unless_panic(f: impl FnOnce()) -> bool {
    catch_unwind(AssertUnwindSafe(f)).is_ok()
}

/// T-VACUOUS. `accepts(p)` is true when the verifier accepts `p`. The honest
/// shape must be accepted (positive control) and every named degenerate
/// shape refused.
pub fn vacuous<P>(
    accepts: impl Fn(&P) -> bool,
    honest: &P,
    degenerate: &[(&'static str, P)],
) -> Result<Checked, Failure<&'static str>> {
    if degenerate.is_empty() {
        return Err(Failure::Miswired(
            "T-VACUOUS given no degenerate shape: the template itself would be vacuous".into(),
        ));
    }
    if !accepts(honest) {
        return Err(Failure::Miswired(
            "T-VACUOUS positive control: the verifier refused the honest shape, so a refusal of the degenerate one proves nothing".into(),
        ));
    }
    for &(name, ref shape) in degenerate {
        if accepts(shape) {
            return Err(Failure::Convicted {
                template: "T-VACUOUS",
                detail: format!("the verifier accepted the degenerate shape `{name}`"),
                witness: name,
            });
        }
    }
    Ok(Checked {
        template: "T-VACUOUS",
        cases: degenerate.len() + 1,
    })
}

/// The witness of a T-TRUNCATE conviction: two inputs of length `len` that
/// differ only at `pos` and give the same output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Collision<T> {
    pub len: usize,
    pub pos: usize,
    pub a: Vec<T>,
    pub b: Vec<T>,
}

/// T-TRUNCATE. For every length in `lengths` (0 has no position to change
/// and is skipped) the input is `fill(0)..fill(len-1)`. One position at a
/// time, the LAST first (the Vortex class), then the first and the middle,
/// is replaced with `perturb` of itself, and `f` must change.
pub fn truncate<T, O>(
    f: impl Fn(&[T]) -> O,
    lengths: &[usize],
    fill: impl Fn(usize) -> T,
    perturb: impl Fn(&T) -> T,
) -> Result<Checked, Failure<Collision<T>>>
where
    T: Clone + PartialEq + Debug,
    O: PartialEq,
{
    let mut cases = 0;
    for &len in lengths.iter().filter(|&&l| l > 0) {
        let a: Vec<T> = (0..len).map(&fill).collect();
        let out_a = f(&a);
        let mut positions = vec![len - 1];
        for p in [0, len / 2] {
            if !positions.contains(&p) {
                positions.push(p);
            }
        }
        for pos in positions {
            let mut b = a.clone();
            b[pos] = perturb(&a[pos]);
            if b[pos] == a[pos] {
                return Err(Failure::Miswired(format!(
                    "T-TRUNCATE perturbation left position {pos} unchanged; the template tested nothing"
                )));
            }
            cases += 1;
            if f(&b) == out_a {
                return Err(Failure::Convicted {
                    template: "T-TRUNCATE",
                    detail: format!(
                        "two inputs of length {len} differing only at position {pos} gave the same output"
                    ),
                    witness: Collision { len, pos, a, b },
                });
            }
        }
    }
    if cases == 0 {
        return Err(Failure::Miswired(
            "T-TRUNCATE given no nonzero length: the template itself would be vacuous".into(),
        ));
    }
    Ok(Checked {
        template: "T-TRUNCATE",
        cases,
    })
}

/// The lengths T-TRUNCATE should cover for a function that consumes its
/// input in blocks of `block` elements, up to `max`: 1, 2, every
/// `k*block - 1`, `k*block`, `k*block + 1`, the 255/256/257 edge Vortex fell
/// over, 4096, and `max` itself.
pub fn boundary_lengths(block: usize, max: usize) -> Vec<usize> {
    assert!(block > 0, "a block of zero elements has no boundary");
    let mut v = vec![1, 2, 255, 256, 257, 4096, max];
    let mut k = 1;
    while k * block <= max + 1 {
        v.extend([k * block - 1, k * block, k * block + 1]);
        k += 1;
    }
    v.retain(|&l| l > 0 && l <= max);
    v.sort_unstable();
    v.dedup();
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha3::{Digest, Sha3_256, Shake256};

    fn sha3_256(x: &[u8]) -> [u8; 32] {
        Sha3_256::digest(x).into()
    }

    fn byte(i: usize) -> u8 {
        (i.wrapping_mul(131) ^ 0x5a) as u8
    }

    fn flip(b: &u8) -> u8 {
        b ^ 0x01
    }

    #[test]
    fn boundary_lengths_straddle_every_block_edge() {
        let l = boundary_lengths(136, 300);
        for want in [1, 2, 135, 136, 137, 255, 256, 257, 271, 272, 273, 300] {
            assert!(l.contains(&want), "missing {want} in {l:?}");
        }
        assert!(l.iter().all(|&x| x > 0 && x <= 300));
    }

    // Positive control: SHA3-256 depends on every byte at every rate edge.
    #[test]
    fn t_truncate_passes_sha3_256() {
        let lengths = boundary_lengths(136, 4097);
        let r = truncate(sha3_256, &lengths, byte, flip).expect("SHA3-256 must pass T-TRUNCATE");
        assert_eq!(r.template, "T-TRUNCATE");
        assert!(r.cases >= 3 * (lengths.len() - 2), "cases {}", r.cases);
    }

    // Positive control on an extendable-output function at the 96-byte
    // length the X-Wing seed expansion uses (SPEC-BPQ-1 §2).
    #[test]
    fn t_truncate_passes_shake256_96() {
        use sha3::digest::{ExtendableOutput, Update, XofReader};
        let shake96 = |x: &[u8]| {
            let mut h = Shake256::default();
            h.update(x);
            let mut out = [0u8; 96];
            h.finalize_xof().read(&mut out);
            out
        };
        truncate(shake96, &boundary_lengths(136, 1024), byte, flip)
            .expect("SHAKE256 must pass T-TRUNCATE");
    }

    // TEETH: a planted Vortex-class hash that reads only the first 256
    // elements must be convicted, at exactly the first length that has a
    // 257th element, on the last position.
    #[test]
    fn t_truncate_convicts_a_planted_prefix_hash() {
        let planted = |x: &[u8]| sha3_256(&x[..x.len().min(256)]);
        match truncate(planted, &boundary_lengths(136, 4097), byte, flip) {
            Err(Failure::Convicted {
                template, witness, ..
            }) => {
                assert_eq!(template, "T-TRUNCATE");
                assert_eq!((witness.len, witness.pos), (257, 256));
                assert_eq!(planted(&witness.a), planted(&witness.b));
                assert_ne!(witness.a, witness.b);
            }
            other => panic!("the planted prefix hash was not convicted: {other:?}"),
        }
    }

    #[test]
    fn t_truncate_refuses_a_perturbation_that_changes_nothing() {
        let r = truncate(sha3_256, &[8], byte, |b| *b);
        assert!(matches!(r, Err(Failure::Miswired(_))), "{r:?}");
        let r = truncate(sha3_256, &[0], byte, flip);
        assert!(matches!(r, Err(Failure::Miswired(_))), "{r:?}");
    }

    // A toy opening proof: the verifier asked for K openings of a committed
    // vector and a claimed sum over the opened positions.
    const K: usize = 4;

    #[derive(Clone)]
    struct Toy {
        claim: u64,
        openings: Vec<(usize, u64)>,
    }

    fn committed() -> Vec<u64> {
        (0..16).map(|i| i as u64 * 7 + 3).collect()
    }

    fn honest() -> Toy {
        let c = committed();
        let openings: Vec<_> = [1, 5, 9, 13].iter().map(|&i| (i, c[i])).collect();
        Toy {
            claim: openings.iter().map(|o| o.1).sum(),
            openings,
        }
    }

    // The Vortex shape: every opening it is handed is checked, the count
    // never is, and the claim is only compared to what was opened.
    fn flawed_accepts(p: &Toy) -> bool {
        let c = committed();
        p.openings.iter().all(|&(i, v)| c.get(i) == Some(&v))
            && p.openings.iter().map(|o| o.1).sum::<u64>() == p.claim
    }

    fn sound_accepts(p: &Toy) -> bool {
        p.openings.len() == K && flawed_accepts(p)
    }

    fn degenerate() -> Vec<(&'static str, Toy)> {
        vec![(
            "zero openings, claim 0",
            Toy {
                claim: 0,
                openings: vec![],
            },
        )]
    }

    // TEETH: the planted Vortex-shaped verifier is convicted.
    #[test]
    fn t_vacuous_convicts_a_planted_count_free_verifier() {
        let r = vacuous(flawed_accepts, &honest(), &degenerate());
        match r {
            Err(Failure::Convicted {
                template, witness, ..
            }) => {
                assert_eq!(template, "T-VACUOUS");
                assert_eq!(witness, "zero openings, claim 0");
            }
            other => panic!("the count-free verifier was not convicted: {other:?}"),
        }
    }

    #[test]
    fn t_vacuous_passes_a_verifier_that_checks_the_count() {
        let r = vacuous(sound_accepts, &honest(), &degenerate()).expect("count-checking verifier");
        assert_eq!(r.cases, 2);
    }

    #[test]
    fn t_vacuous_refuses_to_decide_without_its_controls() {
        let r = vacuous(|_: &Toy| false, &honest(), &degenerate());
        assert!(
            matches!(r, Err(Failure::Miswired(_))),
            "honest refused must be Miswired"
        );
        let r = vacuous(sound_accepts, &honest(), &[]);
        assert!(
            matches!(r, Err(Failure::Miswired(_))),
            "no degenerate shape must be Miswired"
        );
    }

    #[test]
    fn accepts_unless_panic_reads_assert_as_refusal() {
        assert!(accepts_unless_panic(|| {}));
        assert!(!accepts_unless_panic(|| assert_eq!(1, 2, "refused")));
    }
}
