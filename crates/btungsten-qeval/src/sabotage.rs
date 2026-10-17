//! Sabotage battery and negative controls.
//!
//! Confirms that the evaluator convicts every class of defect:
//! - Wrong outputs
//! - Altered inputs
//! - Non-zero phase errors
//! - Dirty workspace / dirty frees
//! - Unfreed ancillas
//! - Aliased operands in 2-qubit and 3-qubit gates
//! - Use-after-free
//! - Unallocated wire access
//! - Double allocations and freeing unallocated wires
//! - Measurement gate injection (rejected initially)
//! - False resource claims (independent verification)

#[cfg(test)]
mod tests {
    use crate::circuit::{Circuit, Gate};
    use crate::circuits::build_tower_bmp_circuit;
    use crate::evaluator::{compute_circuit_stats, evaluate_gf16_exhaustive, EvaluatorError};

    #[test]
    fn test_convict_wrong_output() {
        let mut circ = build_tower_bmp_circuit();
        circ.name = "sabotage_wrong_output".into();
        // Invert target wire 4 at the end, corrupting the output
        circ.gates.push(Gate::X(4));

        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::OutputMismatch { .. })),
            "Expected OutputMismatch, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_altered_input() {
        let mut circ = build_tower_bmp_circuit();
        circ.name = "sabotage_altered_input".into();
        // Flip input wire 0 at the end
        circ.gates.push(Gate::X(0));

        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::InputCorrupted { .. })),
            "Expected InputCorrupted, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_phase_error() {
        let mut circ = build_tower_bmp_circuit();
        circ.name = "sabotage_phase_error".into();
        // Insert an uncancelled Z gate on input wire 0, kicking a sign flip on odd x
        circ.gates.push(Gate::Z(0));

        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::PhaseNonZero { .. })),
            "Expected PhaseNonZero, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_dirty_free() {
        let mut circ = build_tower_bmp_circuit();
        circ.name = "sabotage_dirty_free".into();
        // Find the first Alloc and Free of wire 8, and set wire 8 to |1> before freeing it
        let mut corrupted_gates = Vec::new();
        for &gate in &circ.gates {
            if let Gate::Free(8) = gate {
                corrupted_gates.push(Gate::X(8)); // make wire 8 dirty
            }
            corrupted_gates.push(gate);
        }
        circ.gates = corrupted_gates;

        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::DirtyFree { wire: 8 })),
            "Expected DirtyFree for wire 8, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_unfreed_ancilla() {
        let mut circ = build_tower_bmp_circuit();
        circ.name = "sabotage_unfreed_ancilla".into();
        // Allocate a scratch wire 20 and never free it
        circ.gates.insert(0, Gate::Alloc(20));

        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::UnfreedAncilla { wire: 20 })),
            "Expected UnfreedAncilla for wire 20, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_aliased_cx() {
        let circ = Circuit::with_gates("aliased_cx", 4, 4, vec![Gate::CX(1, 1)]);
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::AliasedOperands { .. })),
            "Expected AliasedOperands, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_aliased_ccx() {
        let circ1 = Circuit::with_gates("aliased_ccx1", 4, 4, vec![Gate::CCX(0, 0, 1)]);
        assert!(matches!(
            evaluate_gf16_exhaustive(&circ1),
            Err(EvaluatorError::AliasedOperands { .. })
        ));

        let circ2 = Circuit::with_gates("aliased_ccx2", 4, 4, vec![Gate::CCX(0, 1, 0)]);
        assert!(matches!(
            evaluate_gf16_exhaustive(&circ2),
            Err(EvaluatorError::AliasedOperands { .. })
        ));
    }

    #[test]
    fn test_convict_use_after_free() {
        let circ = Circuit::with_gates(
            "use_after_free",
            4,
            4,
            vec![
                Gate::Alloc(8),
                Gate::Free(8),
                Gate::X(8), // Access after free
            ],
        );
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::UseAfterFree { wire: 8, .. })),
            "Expected UseAfterFree, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_unallocated_wire() {
        let circ = Circuit::with_gates(
            "unallocated_wire",
            4,
            4,
            vec![
                Gate::X(15), // Wire 15 was never allocated
            ],
        );
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::UnallocatedWire { wire: 15, .. })),
            "Expected UnallocatedWire, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_double_alloc() {
        let circ = Circuit::with_gates(
            "double_alloc",
            4,
            4,
            vec![
                Gate::Alloc(8),
                Gate::Alloc(8),
            ],
        );
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::DoubleAlloc { wire: 8 })),
            "Expected DoubleAlloc, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_free_unallocated() {
        let circ = Circuit::with_gates(
            "free_unallocated",
            4,
            4,
            vec![
                Gate::Free(12),
            ],
        );
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(res, Err(EvaluatorError::FreeUnallocated { wire: 12 })),
            "Expected FreeUnallocated, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_measurement_rejected_initially() {
        let circ = Circuit::with_gates(
            "measurement_rejection",
            4,
            4,
            vec![
                Gate::Alloc(8),
                Gate::HMR { qubit: 8, outcome: 0 },
            ],
        );
        let res = evaluate_gf16_exhaustive(&circ);
        assert!(
            matches!(
                res,
                Err(EvaluatorError::MeasurementRejectedInitially {
                    gate: Gate::HMR { .. }
                })
            ),
            "Expected MeasurementRejectedInitially, got: {res:?}"
        );
    }

    #[test]
    fn test_convict_false_resource_claim() {
        let circ = build_tower_bmp_circuit();
        let true_stats = compute_circuit_stats(&circ);

        // Candidate claims only 2 Toffolis and 8 peak qubits
        let claimed_toffolis = 2usize;
        let claimed_peak_qubits = 8usize;

        assert_ne!(
            true_stats.toffoli_count, claimed_toffolis,
            "False claim of Toffolis not refuted"
        );
        assert_ne!(
            true_stats.peak_qubits, claimed_peak_qubits,
            "False claim of peak qubits not refuted"
        );

        // Ground-truth independently verified by evaluator
        assert_eq!(true_stats.toffoli_count, 10);
        assert_eq!(true_stats.peak_qubits, 13);
    }
}