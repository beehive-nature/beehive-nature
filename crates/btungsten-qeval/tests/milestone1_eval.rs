use btungsten_qeval::circuits::{
    build_fermat_circuit, build_itoh_tsujii_circuit, build_tower_bmp_circuit,
};
use btungsten_qeval::evaluator::evaluate_gf16_exhaustive;

#[test]
fn test_approach1_fermat_baseline_exhaustive() {
    let circ = build_fermat_circuit();
    let stats = evaluate_gf16_exhaustive(&circ).expect("Fermat baseline must pass all 256 shots");

    assert_eq!(stats.shots_evaluated, 256);
    println!("Approach 1 (Fermat Baseline):");
    println!("  Toffoli count: {}", stats.toffoli_count);
    println!("  Clifford count: {}", stats.clifford_count);
    println!("  Peak qubits: {}", stats.peak_qubits);
    println!("  Total gates: {}", stats.total_gates);

    // Verify independent counts
    assert!(stats.toffoli_count > 0);
    assert_eq!(stats.peak_qubits, 20); // 8 registers + 12 ancillas (a, c, t)
}

#[test]
fn test_approach2_itoh_tsujii_exhaustive() {
    let circ = build_itoh_tsujii_circuit();
    let stats = evaluate_gf16_exhaustive(&circ).expect("Itoh-Tsujii circuit must pass all 256 shots");

    assert_eq!(stats.shots_evaluated, 256);
    println!("Approach 2 (Itoh-Tsujii):");
    println!("  Toffoli count: {}", stats.toffoli_count);
    println!("  Clifford count: {}", stats.clifford_count);
    println!("  Peak qubits: {}", stats.peak_qubits);
    println!("  Total gates: {}", stats.total_gates);

    assert_eq!(stats.peak_qubits, 24); // 8 registers + 16 ancillas
}

#[test]
fn test_approach3_tower_bmp_optimal_exhaustive() {
    let circ = build_tower_bmp_circuit();
    let stats = evaluate_gf16_exhaustive(&circ).expect("Tower BMP circuit must pass all 256 shots");

    assert_eq!(stats.shots_evaluated, 256);
    println!("Approach 3 (Tower BMP Optimal):");
    println!("  Toffoli count: {}", stats.toffoli_count);
    println!("  Clifford count: {}", stats.clifford_count);
    println!("  Peak qubits: {}", stats.peak_qubits);
    println!("  Total gates: {}", stats.total_gates);

    // Exact count verification:
    // 5 forward ANDs + 5 reverse uncompute ANDs = 10 Toffolis
    assert_eq!(stats.toffoli_count, 10);
    // 4 input + 4 target + 5 ancillas = 13 peak qubits
    assert_eq!(stats.peak_qubits, 13);
}

#[test]
fn test_comparative_table() {
    let c1 = build_fermat_circuit();
    let s1 = evaluate_gf16_exhaustive(&c1).unwrap();

    let c2 = build_itoh_tsujii_circuit();
    let s2 = evaluate_gf16_exhaustive(&c2).unwrap();

    let c3 = build_tower_bmp_circuit();
    let s3 = evaluate_gf16_exhaustive(&c3).unwrap();

    println!("\n==========================================================================");
    println!("REVERSIBLE GF(16) INVERSION COMPARATIVE BENCHMARK (EXHAUSTIVE 256 DOMAIN)");
    println!("==========================================================================");
    println!("{:<28} | {:<8} | {:<10} | {:<12} | {:<8}", "Approach", "Toffolis", "Cliffords", "Peak Qubits", "Total Ops");
    println!("--------------------------------------------------------------------------");
    println!("{:<28} | {:<8} | {:<10} | {:<12} | {:<8}", c1.name, s1.toffoli_count, s1.clifford_count, s1.peak_qubits, s1.total_gates);
    println!("{:<28} | {:<8} | {:<10} | {:<12} | {:<8}", c2.name, s2.toffoli_count, s2.clifford_count, s2.peak_qubits, s2.total_gates);
    println!("{:<28} | {:<8} | {:<10} | {:<12} | {:<8}", c3.name, s3.toffoli_count, s3.clifford_count, s3.peak_qubits, s3.total_gates);
    println!("==========================================================================\n");

    assert!(s3.toffoli_count < s1.toffoli_count, "Tower BMP should achieve lowest Toffoli count");
    assert!(s3.peak_qubits < s1.peak_qubits, "Tower BMP should achieve lowest peak qubits");
}