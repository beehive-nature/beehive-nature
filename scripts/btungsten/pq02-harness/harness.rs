//! SPEC-BTUNGSTEN-PQ-1 PQ02 — the proof harness for the shipped Keccak-f[1600].
//!
//! Not shipped code: SAW compiles this beside the keccak crate (the `.crate`
//! cargo ships, checked against Cargo.lock) so the crate's OWN round body,
//! the generic `keccak::keccak_p::<L>`, can be run once per round constant
//! and proven equal to FIPS 202 `keccakRound k` for every state
//! (`../pq02-saw/shipped.saw`, k = 0..23).
//!
//! How: `keccak_p(state, round_count)` takes the constants
//! `RC[(L::KECCAK_F_ROUND_COUNT - round_count)..L::KECCAK_F_ROUND_COUNT]`
//! (keccak 0.1.6 src/lib.rs:243). A lane type with `KECCAK_F_ROUND_COUNT =
//! K + 1`, called with `round_count = 1`, therefore runs the loop body
//! exactly once with RC[K]. Its operations are u64's own, as the crate's
//! `impl LaneSize for u64` is (`truncate_rc` is the identity there too).
//!
//! Why not one 24-round proof: the shipped p1600 against the spec in one
//! solver call does not close (two rounds ran past 24 minutes), and neither
//! did a shipped-against-reference agreement run (bitwuzla in CI, ABC 50
//! minutes locally).

#![no_std]
#![forbid(unsafe_code)]

extern crate keccak;

/// A lane that makes `keccak_p(state, 1)` run its body once with RC[K].
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Lane<const K: usize>(pub u64);

impl<const K: usize> core::ops::BitAnd for Lane<K> {
    type Output = Self;
    fn bitand(self, o: Self) -> Self {
        Lane(self.0 & o.0)
    }
}
impl<const K: usize> core::ops::BitAndAssign for Lane<K> {
    fn bitand_assign(&mut self, o: Self) {
        self.0 &= o.0;
    }
}
impl<const K: usize> core::ops::BitXor for Lane<K> {
    type Output = Self;
    fn bitxor(self, o: Self) -> Self {
        Lane(self.0 ^ o.0)
    }
}
impl<const K: usize> core::ops::BitXorAssign for Lane<K> {
    fn bitxor_assign(&mut self, o: Self) {
        self.0 ^= o.0;
    }
}
impl<const K: usize> core::ops::Not for Lane<K> {
    type Output = Self;
    fn not(self) -> Self {
        Lane(!self.0)
    }
}
impl<const K: usize> keccak::LaneSize for Lane<K> {
    const KECCAK_F_ROUND_COUNT: usize = K + 1;
    fn truncate_rc(rc: u64) -> Self {
        Lane(rc)
    }
    fn rotate_left(self, n: u32) -> Self {
        Lane(self.0.rotate_left(n))
    }
}

/// The crate's round body, once, with RC[K].
pub fn shipped_round<const K: usize>(state: &mut [u64; 25]) {
    let mut lanes = [Lane::<K>(0); 25];
    let mut i = 0;
    while i < 25 {
        lanes[i] = Lane(state[i]);
        i += 1;
    }
    keccak::keccak_p(&mut lanes, 1);
    let mut i = 0;
    while i < 25 {
        state[i] = lanes[i].0;
        i += 1;
    }
}

macro_rules! shipped_rounds {
    ($($name:ident = $k:expr),* $(,)?) => {
        $(
            /// The crate's round body with one fixed constant (see [`Lane`]).
            pub fn $name(state: &mut [u64; 25]) {
                shipped_round::<$k>(state)
            }
        )*
    };
}

shipped_rounds!(
    shipped_round_0 = 0, shipped_round_1 = 1, shipped_round_2 = 2, shipped_round_3 = 3,
    shipped_round_4 = 4, shipped_round_5 = 5, shipped_round_6 = 6, shipped_round_7 = 7,
    shipped_round_8 = 8, shipped_round_9 = 9, shipped_round_10 = 10, shipped_round_11 = 11,
    shipped_round_12 = 12, shipped_round_13 = 13, shipped_round_14 = 14, shipped_round_15 = 15,
    shipped_round_16 = 16, shipped_round_17 = 17, shipped_round_18 = 18, shipped_round_19 = 19,
    shipped_round_20 = 20, shipped_round_21 = 21, shipped_round_22 = 22, shipped_round_23 = 23,
);
