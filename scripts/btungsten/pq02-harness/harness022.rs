//! SPEC-BTUNGSTEN-PQ-1 PQ02 — the proof harness for keccak 0.2.2, the
//! Keccak under sha3 0.11 (which ml-kem 0.3.2 and slh-dsa link).
//!
//! keccak 0.2.2 keeps its round body (`backends::soft::keccak_p`)
//! crate-private, so this harness compiles the crate's own `src/consts.rs`,
//! `src/types.rs` and `src/backends/soft.rs` VERBATIM (from the `.crate`
//! cargo ships, checked against Cargo.lock by ../pq02-saw-check.sh) as its
//! modules, with the two names they use from outside themselves: the
//! crate-root re-export of `consts` and a `Backend` trait with the one
//! method soft.rs implements. On x86_64 with no
//! `keccak_backend` cfg, `Keccak::with_backend` takes the soft backend, so
//! this is the body sha3 0.11 runs here.
//!
//! A lane whose `RC` is the single constant RC[K] makes
//! `keccak_p::<Lane<K>, 1>` (the const assert needs ROUNDS <= RC.len())
//! run the body once with RC[K]; its operations are u64's own, as the
//! crate's `impl LaneSize for u64` is. `../pq02-saw/shipped022.saw` proves
//! each of the 24 equal to FIPS 202 `keccakRound k` for every state, then
//! `composed` (the 24 in order) equal to `keccakF`, then `agree`: the
//! shipped `keccak_p::<u64, 24>` equal to `composed` for every state. The
//! two runs execute the same MIR body, so the solver sees the same terms
//! (a direct 24-round comparison against the spec never closed).

#![no_std]
#![forbid(unsafe_code)]

#[path = "../../../target/saw-pq02/keccak-0.2.2/src/consts.rs"]
pub mod consts;
#[path = "../../../target/saw-pq02/keccak-0.2.2/src/types.rs"]
pub mod types;
pub use consts::*;

/// The one method `soft.rs` implements. The crate declares this trait in
/// `backends.rs` (with backends the soft path does not use) and re-exports
/// it at its root; here it sits at the root directly, so soft.rs's
/// `super::Backend` names it.
pub trait Backend {
    fn get_p1600<const ROUNDS: usize>() -> types::Fn1600;
}

#[path = "../../../target/saw-pq02/keccak-0.2.2/src/backends/soft.rs"]
pub mod soft;

use soft::LaneSize;

/// A lane that makes `keccak_p::<Lane<K>, 1>` run its body once with RC[K].
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
impl<const K: usize> LaneSize for Lane<K> {
    const RC: &[Self] = &[Lane(consts::RC[K])];
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
    soft::keccak_p::<Lane<K>, 1>(&mut lanes);
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

/// The 24 proven round bodies, in FIPS 202 order.
pub fn composed(state: &mut [u64; 25]) {
    shipped_round_0(state); shipped_round_1(state); shipped_round_2(state); shipped_round_3(state);
    shipped_round_4(state); shipped_round_5(state); shipped_round_6(state); shipped_round_7(state);
    shipped_round_8(state); shipped_round_9(state); shipped_round_10(state); shipped_round_11(state);
    shipped_round_12(state); shipped_round_13(state); shipped_round_14(state); shipped_round_15(state);
    shipped_round_16(state); shipped_round_17(state); shipped_round_18(state); shipped_round_19(state);
    shipped_round_20(state); shipped_round_21(state); shipped_round_22(state); shipped_round_23(state);
}

/// The shipped permutation, as sha3 0.11's soft backend runs it (`get_p1600::<24>`, soft.rs:120).
pub fn shipped_f(state: &mut [u64; 25]) {
    soft::keccak_p::<u64, 24>(state);
}

/// Every lane equal, without a branch.
fn same(a: &[u64; 25], b: &[u64; 25]) -> bool {
    let mut d = 0u64;
    let mut i = 0;
    while i < 25 {
        d |= a[i] ^ b[i];
        i += 1;
    }
    d == 0
}

/// True when the shipped permutation and the composed round bodies agree
/// on `state`; proven true for every state.
pub fn agree(state: &[u64; 25]) -> bool {
    let mut a = *state;
    let mut b = *state;
    composed(&mut a);
    shipped_f(&mut b);
    same(&a, &b)
}

/// TOOTH: the round bodies with rounds 5 and 6 swapped (RC[5] != RC[6]).
pub fn composed_swapped(state: &mut [u64; 25]) {
    shipped_round_0(state); shipped_round_1(state); shipped_round_2(state); shipped_round_3(state);
    shipped_round_4(state); shipped_round_6(state); shipped_round_5(state); shipped_round_7(state);
    shipped_round_8(state); shipped_round_9(state); shipped_round_10(state); shipped_round_11(state);
    shipped_round_12(state); shipped_round_13(state); shipped_round_14(state); shipped_round_15(state);
    shipped_round_16(state); shipped_round_17(state); shipped_round_18(state); shipped_round_19(state);
    shipped_round_20(state); shipped_round_21(state); shipped_round_22(state); shipped_round_23(state);
}

/// TOOTH: `agree` against `composed_swapped`; must be refuted.
pub fn agree_swapped(state: &[u64; 25]) -> bool {
    let mut a = *state;
    let mut b = *state;
    composed_swapped(&mut a);
    shipped_f(&mut b);
    same(&a, &b)
}
