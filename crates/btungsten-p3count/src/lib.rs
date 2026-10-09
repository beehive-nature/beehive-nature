//! bTunGsTeN PQ10 (docs/specs/SPEC-BTUNGSTEN-PQ-1.md §PQ10): one Plonky3
//! STARK proof of the receipt count statement of
//! contracts/zkreceipts/count.circom, with the hiding commitment, at the
//! Plonky3 pin eab7f0e (0.8.0).
//!
//! - `statement`: the Rust model of the claim and its Poseidon2 commitment
//! - `air`: the statement as an AIR, upstream's Poseidon2 constraints per row
//! - `trace`: the witness trace
//! - `config`: the hiding configuration and the non-hiding control
//! - `leak`: the registered tungsten-2 families (leak/PREREGISTERED-STARK.md)
//! - `security`: p3-security's proven and conjectured bits for this AIR

pub mod air;
pub mod config;
pub mod leak;
pub mod security;
pub mod statement;
pub mod trace;
