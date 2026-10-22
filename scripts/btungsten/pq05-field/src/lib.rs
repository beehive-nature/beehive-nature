//! SPEC-BTUNGSTEN-PQ-1 PQ05/PQ06 — the ML-KEM and ML-DSA base fields as
//! the shipped crates define them, for SAW.
//!
//! ml-kem 0.3.2 (`src/algebra.rs`) and ml-dsa 0.1.1 (`src/algebra.rs`) each
//! define their base field with module-lattice's `define_field!` macro; the
//! two invocations below are theirs, character for character
//! (../pq05-field-check.sh refuses to run unless the pinned crates still
//! contain exactly these lines). The functions below only call the field's
//! own `small_reduce` and `barrett_reduce` and module-lattice's `Elem`
//! operators, so SAW proves the shipped arithmetic, monomorphized as the
//! crates monomorphize it.

#![no_std]
#![forbid(unsafe_code)]

use module_lattice::{Elem, Field};

module_lattice::define_field!(KemField, u16, u32, u64, 3329);
module_lattice::define_field!(DsaField, u32, u64, u128, 8_380_417);

pub fn kem_small(x: u16) -> u16 {
    KemField::small_reduce(x)
}
pub fn kem_barrett(x: u32) -> u16 {
    KemField::barrett_reduce(x)
}
pub fn kem_add(a: u16, b: u16) -> u16 {
    (Elem::<KemField>::new(a) + Elem::new(b)).0
}
pub fn kem_sub(a: u16, b: u16) -> u16 {
    (Elem::<KemField>::new(a) - Elem::new(b)).0
}
pub fn kem_neg(a: u16) -> u16 {
    (-Elem::<KemField>::new(a)).0
}
pub fn kem_mul(a: u16, b: u16) -> u16 {
    (Elem::<KemField>::new(a) * Elem::new(b)).0
}

pub fn dsa_small(x: u32) -> u32 {
    DsaField::small_reduce(x)
}
pub fn dsa_barrett(x: u64) -> u32 {
    DsaField::barrett_reduce(x)
}
pub fn dsa_add(a: u32, b: u32) -> u32 {
    (Elem::<DsaField>::new(a) + Elem::new(b)).0
}
pub fn dsa_sub(a: u32, b: u32) -> u32 {
    (Elem::<DsaField>::new(a) - Elem::new(b)).0
}
pub fn dsa_neg(a: u32) -> u32 {
    (-Elem::<DsaField>::new(a)).0
}
pub fn dsa_mul(a: u32, b: u32) -> u32 {
    (Elem::<DsaField>::new(a) * Elem::new(b)).0
}
