//! Focused tests for the third scoreboard shape (bTungsten GF(16)
//! evaluation-commitment). Bounds are asserted, not just behavior:
//! the shape must fail on a different statement, and its proof must
//! be a bare 32-byte commitment (no key material, by construction).
use zk_adaptor::{BtungstenEvalShape, ProofShape};

#[test]
fn btungsten_eval_roundtrip_and_binding() {
    let mut shape = BtungstenEvalShape::new();
    assert!(shape.circuit_gates > 0);
    let statement = b"b9-receipt-chain-statement";
    let proof = shape.prove(statement).unwrap();
    assert_eq!(proof.len(), 32);
    assert!(shape.verify(statement, &proof).unwrap());
    assert!(!shape.verify(b"other-statement", &proof).unwrap());
    let mut tampered = proof.clone();
    tampered[0] ^= 1;
    assert!(!shape.verify(statement, &tampered).unwrap());
}
