//! SPEC-BTUNGSTEN-PQ-1 PQ02 — the proof harness for the shipped Keccak-f[1600].
//!
//! Not shipped code: SAW compiles this beside the keccak crate (the `.crate`
//! cargo ships, checked against Cargo.lock) and proves three things:
//!
//! 1. `round` (one round, the keccak crate's operation order, a separate
//!    function) equals FIPS 202 `keccakRound ir` for every state, at each of
//!    the 24 round indices (`../pq02-saw/round.saw`);
//! 2. `reference` (24 calls of `round`) equals FIPS 202 `keccakF`, by those 24
//!    proven round specs as overrides (`round.saw`);
//! 3. `agree` returns true for every state: the shipped `keccak::p1600(s, 24)`
//!    and `reference` leave the same 25 lanes (`../pq02-saw/agree.saw`).
//!
//! 1 and 2 are each one round deep, which a solver closes in seconds; 3
//! compares two runs inside one symbolic execution, where the same operations
//! on the same inputs build the same terms. A 24-round comparison of the
//! shipped code against the spec in one solver call does not close: two
//! rounds already ran past 24 minutes.

#![no_std]
#![forbid(unsafe_code)]

extern crate keccak;

/// FIPS 202 §3.2.5 round constants. These are inputs to the proof, not
/// trusted: `round.saw` proves `round(a, RC[ir])` equal to `keccakRound ir`,
/// whose constants KeccakF1600.cry derives from the LFSR, so a wrong entry
/// here fails that proof.
pub const RC: [u64; 24] = [
    0x0000000000000001,
    0x0000000000008082,
    0x800000000000808a,
    0x8000000080008000,
    0x000000000000808b,
    0x0000000080000001,
    0x8000000080008081,
    0x8000000000008009,
    0x000000000000008a,
    0x0000000000000088,
    0x0000000080008009,
    0x000000008000000a,
    0x000000008000808b,
    0x800000000000008b,
    0x8000000000008089,
    0x8000000000008003,
    0x8000000000008002,
    0x8000000000000080,
    0x000000000000800a,
    0x800000008000000a,
    0x8000000080008081,
    0x8000000000008080,
    0x0000000080000001,
    0x8000000080008008,
];

const RHO: [u32; 24] = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];

const PI: [usize; 24] = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];

/// One round, in keccak 0.1.6's operation order (src/lib.rs `keccak_p`).
#[inline(never)]
pub fn round(state: &mut [u64; 25], rc: u64) {
    let mut array = [0u64; 5];

    // θ
    let mut x = 0;
    while x < 5 {
        let mut y = 0;
        while y < 5 {
            array[x] ^= state[5 * y + x];
            y += 1;
        }
        x += 1;
    }
    let mut x = 0;
    while x < 5 {
        let mut y = 0;
        while y < 5 {
            let t1 = array[(x + 4) % 5];
            let t2 = array[(x + 1) % 5].rotate_left(1);
            state[5 * y + x] ^= t1 ^ t2;
            y += 1;
        }
        x += 1;
    }

    // ρ and π
    let mut last = state[1];
    let mut x = 0;
    while x < 24 {
        array[0] = state[PI[x]];
        state[PI[x]] = last.rotate_left(RHO[x]);
        last = array[0];
        x += 1;
    }

    // χ
    let mut y_step = 0;
    while y_step < 5 {
        let y = 5 * y_step;
        let mut x = 0;
        while x < 5 {
            array[x] = state[y + x];
            x += 1;
        }
        let mut x = 0;
        while x < 5 {
            let t1 = !array[(x + 1) % 5];
            let t2 = array[(x + 2) % 5];
            state[y + x] = array[x] ^ (t1 & t2);
            x += 1;
        }
        y_step += 1;
    }

    // ι
    state[0] ^= rc;
}

/// Keccak-f[1600] as 24 calls of `round`.
pub fn reference(state: &mut [u64; 25]) {
    let mut i = 0;
    while i < 24 {
        round(state, RC[i]);
        i += 1;
    }
}

/// The shipped permutation and the reference agree on `s`.
pub fn agree(s: &[u64; 25]) -> bool {
    let mut shipped = *s;
    keccak::p1600(&mut shipped, 24);
    let mut mine = *s;
    reference(&mut mine);
    shipped == mine
}

/// TEETH for `agree`: the same comparison with one output bit of the
/// reference flipped. `agree-teeth.saw` asks SAW to prove it always true and
/// must get a counterexample, or the `agree` proof could not tell two
/// permutations apart.
pub fn agree_teeth(s: &[u64; 25]) -> bool {
    let mut shipped = *s;
    keccak::p1600(&mut shipped, 24);
    let mut mine = *s;
    reference(&mut mine);
    mine[0] ^= 1;
    shipped == mine
}
