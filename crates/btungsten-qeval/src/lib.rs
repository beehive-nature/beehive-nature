//! bTunGsTeN Quantum Circuit Evaluator & Reversible GF(16) Synthesizer.
//!
//! Provides:
//! - Reference finite field arithmetic for GF(16) modulo x^4 + x + 1.
//! - Independent gate-stream evaluator tracking basis states, global phase, and wire allocations.
//! - Strict validation of operand distinctness, wire life cycles, and rejection of unauthorized measurements.
//! - Reversible circuit reproductions and an adversarial sabotage test battery.

pub mod circuit;
pub mod circuits;
pub mod evaluator;
pub mod gf16;
pub mod sabotage;

pub use circuit::{Circuit, CircuitBuilder, Gate};
pub use circuits::{build_fermat_circuit, build_itoh_tsujii_circuit, build_tower_bmp_circuit};
pub use evaluator::{
    compute_circuit_stats, evaluate_gf16_exhaustive, evaluate_shot, validate_circuit_stream,
    CircuitStats, EvaluatorError,
};
pub use gf16::{gf_add, gf_inv, gf_mul, gf_sq, CANONICAL_INV};