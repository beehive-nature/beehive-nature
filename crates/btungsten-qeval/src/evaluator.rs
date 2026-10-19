//! Independent gate-stream evaluator and validator.
//!
//! Validates:
//! - Initial gate model: X, CX, CCX, SWAP, Z, CZ, CCZ, with explicit Alloc/Free.
//! - Measurements rejected initially.
//! - Strict operand non-aliasing.
//! - Validated wire lifecycle (rejects use-after-free, double alloc, dirty frees, unfreed ancillas).
//! - Zero phase and input preservation.
//! - Correct GF(16) inversion mapping: |x>|y>|0^a> -> |x>|y XOR inv(x)>|0^a>.
//! - Exhaustive 256-domain testing.
//! - Independent gate and qubit accounting (never trusting metadata).

use crate::circuit::{Circuit, Gate};
use crate::gf16::gf_inv;

/// Comprehensive statistics measured independently by the evaluator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CircuitStats {
    /// Number of Toffoli-class operations (CCX + CCZ).
    pub toffoli_count: usize,
    /// Number of Clifford-class operations (CX + CZ + SWAP).
    pub clifford_count: usize,
    /// Number of free/single-qubit operations (X + Z).
    pub free_count: usize,
    /// Total gates executed.
    pub total_gates: usize,
    /// Peak live qubits active simultaneously (registers + active ancillas).
    pub peak_qubits: usize,
    /// Total Alloc instructions in the stream.
    pub total_allocs: usize,
    /// Total Free instructions in the stream.
    pub total_frees: usize,
    /// Total test cases evaluated (e.g. 256).
    pub shots_evaluated: usize,
}

/// Errors raised during circuit validation or evaluation.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum EvaluatorError {
    MeasurementRejectedInitially {
        gate: Gate,
    },
    AliasedOperands {
        gate: Gate,
        reason: &'static str,
    },
    UnallocatedWire {
        wire: usize,
        gate: Gate,
    },
    UseAfterFree {
        wire: usize,
        gate: Gate,
    },
    DoubleAlloc {
        wire: usize,
    },
    FreeUnallocated {
        wire: usize,
    },
    DirtyFree {
        wire: usize,
    },
    UnfreedAncilla {
        wire: usize,
    },
    AncillaNotRestored {
        wire: usize,
        x: u8,
        y: u8,
    },
    OutputMismatch {
        x: u8,
        initial_y: u8,
        expected_y: u8,
        actual_y: u8,
    },
    InputCorrupted {
        initial_x: u8,
        final_x: u8,
    },
    PhaseNonZero {
        x: u8,
        y: u8,
        phase: u8,
    },
}

impl std::fmt::Display for EvaluatorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MeasurementRejectedInitially { gate } => {
                write!(
                    f,
                    "Measurement gate {gate:?} rejected by initial model policy"
                )
            }
            Self::AliasedOperands { gate, reason } => {
                write!(f, "Aliased operands in {gate:?}: {reason}")
            }
            Self::UnallocatedWire { wire, gate } => {
                write!(f, "Wire {wire} accessed in {gate:?} before allocation")
            }
            Self::UseAfterFree { wire, gate } => {
                write!(
                    f,
                    "Use-after-free: wire {wire} accessed in {gate:?} after being freed"
                )
            }
            Self::DoubleAlloc { wire } => {
                write!(f, "Double allocation: wire {wire} is already allocated")
            }
            Self::FreeUnallocated { wire } => {
                write!(f, "Free of unallocated wire {wire}")
            }
            Self::DirtyFree { wire } => {
                write!(
                    f,
                    "Dirty free: wire {wire} was freed while in state |1>, must be |0>"
                )
            }
            Self::UnfreedAncilla { wire } => {
                write!(
                    f,
                    "Unfreed ancilla: wire {wire} remained allocated at circuit end"
                )
            }
            Self::AncillaNotRestored { wire, x, y } => {
                write!(
                    f,
                    "Ancilla wire {wire} not restored to |0> for input x={x}, y={y}"
                )
            }
            Self::OutputMismatch {
                x,
                initial_y,
                expected_y,
                actual_y,
            } => {
                write!(f, "Output mismatch for x={x}, y={initial_y}: expected {expected_y}, got {actual_y}")
            }
            Self::InputCorrupted { initial_x, final_x } => {
                write!(
                    f,
                    "Input register x corrupted: started as {initial_x}, ended as {final_x}"
                )
            }
            Self::PhaseNonZero { x, y, phase } => {
                write!(f, "Non-zero global phase {phase} on input x={x}, y={y}")
            }
        }
    }
}

impl std::error::Error for EvaluatorError {}

/// Pre-flight static verification of the frozen operation stream.
pub fn validate_circuit_stream(circuit: &Circuit) -> Result<(), EvaluatorError> {
    for &gate in &circuit.gates {
        if gate.is_measurement() {
            return Err(EvaluatorError::MeasurementRejectedInitially { gate });
        }
        match gate {
            Gate::CX(c, t) => {
                if c == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "control and target wires are identical",
                    });
                }
            }
            Gate::CCX(c1, c2, t) => {
                if c1 == c2 {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "control1 and control2 wires are identical",
                    });
                }
                if c1 == t || c2 == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "control wire matches target wire",
                    });
                }
            }
            Gate::SWAP(a, b) => {
                if a == b {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "swap operands are identical",
                    });
                }
            }
            Gate::CZ(c, t) => {
                if c == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "control and target wires are identical",
                    });
                }
            }
            Gate::CCZ(c1, c2, t) => {
                if c1 == c2 || c1 == t || c2 == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "operands in CCZ are not pairwise distinct",
                    });
                }
            }
            _ => {}
        }
    }
    Ok(())
}

/// Computes independent circuit metrics directly from the instruction stream.
pub fn compute_circuit_stats(circuit: &Circuit) -> CircuitStats {
    let mut stats = CircuitStats::default();
    let initial_reg_qubits = circuit.input_qubits + circuit.target_qubits;
    let mut current_live = initial_reg_qubits;
    let mut peak = current_live;

    for &gate in &circuit.gates {
        stats.total_gates += 1;
        if gate.is_toffoli_class() {
            stats.toffoli_count += 1;
        } else if gate.is_clifford_class() {
            stats.clifford_count += 1;
        } else if gate.is_free_class() {
            stats.free_count += 1;
        }

        match gate {
            Gate::Alloc(_) => {
                stats.total_allocs += 1;
                current_live += 1;
                if current_live > peak {
                    peak = current_live;
                }
            }
            Gate::Free(_) => {
                stats.total_frees += 1;
                if current_live > 0 {
                    current_live -= 1;
                }
            }
            _ => {}
        }
    }

    stats.peak_qubits = peak;
    stats
}

/// Evaluates one single shot on the frozen circuit with exact state simulation.
pub fn evaluate_shot(circuit: &Circuit, x: u8, y: u8) -> Result<(), EvaluatorError> {
    let reg_qubits = circuit.input_qubits + circuit.target_qubits;
    assert_eq!(
        circuit.input_qubits, 4,
        "GF(16) input register must be 4 qubits"
    );
    assert_eq!(
        circuit.target_qubits, 4,
        "GF(16) target register must be 4 qubits"
    );

    // Discover maximum wire index referenced
    let mut max_wire = reg_qubits;
    for &gate in &circuit.gates {
        match gate {
            Gate::Alloc(q) | Gate::Free(q) | Gate::X(q) | Gate::Z(q) | Gate::Reset(q) => {
                max_wire = max_wire.max(q + 1);
            }
            Gate::CX(a, b)
            | Gate::SWAP(a, b)
            | Gate::CZ(a, b)
            | Gate::HMR {
                qubit: a,
                outcome: b,
            } => {
                max_wire = max_wire.max(a.max(b) + 1);
            }
            Gate::CCX(a, b, c) | Gate::CCZ(a, b, c) => {
                max_wire = max_wire.max(a.max(b).max(c) + 1);
            }
        }
    }

    let mut state = vec![false; max_wire];
    let mut allocated = vec![false; max_wire];
    let mut freed = vec![false; max_wire];

    // Initialize register x (wires 0..4)
    for i in 0..4 {
        allocated[i] = true;
        state[i] = ((x >> i) & 1) != 0;
    }

    // Initialize register y (wires 4..8)
    for i in 0..4 {
        allocated[4 + i] = true;
        state[4 + i] = ((y >> i) & 1) != 0;
    }

    let mut phase: u8 = 0; // 0 represents +1, 1 represents -1

    for &gate in &circuit.gates {
        if gate.is_measurement() {
            return Err(EvaluatorError::MeasurementRejectedInitially { gate });
        }

        match gate {
            Gate::Alloc(q) => {
                if allocated[q] {
                    return Err(EvaluatorError::DoubleAlloc { wire: q });
                }
                allocated[q] = true;
                freed[q] = false;
                state[q] = false;
            }
            Gate::Free(q) => {
                if !allocated[q] {
                    return Err(EvaluatorError::FreeUnallocated { wire: q });
                }
                if state[q] {
                    return Err(EvaluatorError::DirtyFree { wire: q });
                }
                allocated[q] = false;
                freed[q] = true;
            }
            Gate::X(q) => {
                check_wire_active(q, gate, &allocated, &freed)?;
                state[q] = !state[q];
            }
            Gate::CX(c, t) => {
                check_wire_active(c, gate, &allocated, &freed)?;
                check_wire_active(t, gate, &allocated, &freed)?;
                if c == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "CX control matches target",
                    });
                }
                if state[c] {
                    state[t] = !state[t];
                }
            }
            Gate::CCX(c1, c2, t) => {
                check_wire_active(c1, gate, &allocated, &freed)?;
                check_wire_active(c2, gate, &allocated, &freed)?;
                check_wire_active(t, gate, &allocated, &freed)?;
                if c1 == c2 || c1 == t || c2 == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "CCX operands not pairwise distinct",
                    });
                }
                if state[c1] && state[c2] {
                    state[t] = !state[t];
                }
            }
            Gate::SWAP(a, b) => {
                check_wire_active(a, gate, &allocated, &freed)?;
                check_wire_active(b, gate, &allocated, &freed)?;
                if a == b {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "SWAP operands are identical",
                    });
                }
                state.swap(a, b);
            }
            Gate::Z(q) => {
                check_wire_active(q, gate, &allocated, &freed)?;
                if state[q] {
                    phase ^= 1;
                }
            }
            Gate::CZ(c, t) => {
                check_wire_active(c, gate, &allocated, &freed)?;
                check_wire_active(t, gate, &allocated, &freed)?;
                if c == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "CZ control matches target",
                    });
                }
                if state[c] && state[t] {
                    phase ^= 1;
                }
            }
            Gate::CCZ(c1, c2, t) => {
                check_wire_active(c1, gate, &allocated, &freed)?;
                check_wire_active(c2, gate, &allocated, &freed)?;
                check_wire_active(t, gate, &allocated, &freed)?;
                if c1 == c2 || c1 == t || c2 == t {
                    return Err(EvaluatorError::AliasedOperands {
                        gate,
                        reason: "CCZ operands not pairwise distinct",
                    });
                }
                if state[c1] && state[c2] && state[t] {
                    phase ^= 1;
                }
            }
            _ => unreachable!(),
        }
    }

    // Verify all ancillas (wires >= reg_qubits) have been freed and are zero
    for q in reg_qubits..max_wire {
        if allocated[q] {
            return Err(EvaluatorError::UnfreedAncilla { wire: q });
        }
        if state[q] {
            return Err(EvaluatorError::AncillaNotRestored { wire: q, x, y });
        }
    }

    // Verify zero global phase
    if phase != 0 {
        return Err(EvaluatorError::PhaseNonZero { x, y, phase });
    }

    // Verify input x was preserved
    let mut final_x = 0u8;
    for i in 0..4 {
        if state[i] {
            final_x |= 1 << i;
        }
    }
    if final_x != x {
        return Err(EvaluatorError::InputCorrupted {
            initial_x: x,
            final_x,
        });
    }

    // Verify output y matches y XOR inv(x)
    let mut final_y = 0u8;
    for i in 0..4 {
        if state[4 + i] {
            final_y |= 1 << i;
        }
    }
    let expected_y = y ^ gf_inv(x);
    if final_y != expected_y {
        return Err(EvaluatorError::OutputMismatch {
            x,
            initial_y: y,
            expected_y,
            actual_y: final_y,
        });
    }

    Ok(())
}

#[inline]
fn check_wire_active(
    q: usize,
    gate: Gate,
    allocated: &[bool],
    freed: &[bool],
) -> Result<(), EvaluatorError> {
    if !allocated[q] {
        if freed[q] {
            Err(EvaluatorError::UseAfterFree { wire: q, gate })
        } else {
            Err(EvaluatorError::UnallocatedWire { wire: q, gate })
        }
    } else {
        Ok(())
    }
}

/// Evaluates the candidate circuit against all 256 input pairs (x, y) in [0..16] x [0..16].
pub fn evaluate_gf16_exhaustive(circuit: &Circuit) -> Result<CircuitStats, EvaluatorError> {
    validate_circuit_stream(circuit)?;
    let mut stats = compute_circuit_stats(circuit);

    for x in 0..16u8 {
        for y in 0..16u8 {
            evaluate_shot(circuit, x, y)?;
            stats.shots_evaluated += 1;
        }
    }

    Ok(stats)
}
