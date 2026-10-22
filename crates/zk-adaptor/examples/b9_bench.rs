//! Comparison bench over the B9 receipt chain (the scoreboard is
//! the deliverable). Run: cargo run -p zk-adaptor --example b9_bench
use zk_adaptor::{BtungstenEvalShape, MlDsaShape, ProofShape, SchnorrShape};

fn hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

fn main() {
    // B9 LEDGER-KEEP receipts (Step 5, verified on the door).
    let input = hex("56882888fe2883d17abc1b569ffa9618836266da9d4a1585cb14ae8057987fe7"); // PUBLIC-CONSTANT (B9 receipt hashes, published in the lane dispatch)
    let output = hex("00c6c22462ac6cda7d18875aa26d1675872e5afb95e3c6e4223864340c7b83eb"); // PUBLIC-CONSTANT (B9 receipt hashes, published in the lane dispatch)
    let chain = hex("1d992ed446a658cd8875a81f24adb5b67152ea0a6b137a3d391381e8cb3432df"); // PUBLIC-CONSTANT (B9 receipt hashes, published in the lane dispatch)
    let statement = zk_adaptor::receipt_statement(&input, &output, &chain);
    let stmt_hex: String = statement.iter().map(|b| format!("{b:02x}")).collect();
    println!("statement (sha3-256 of B9 chain): {stmt_hex}");

    let mut rows = Vec::new();
    let mut schnorr = SchnorrShape::generate();
    rows.push(schnorr.score(&statement).unwrap());
    let mut mldsa = MlDsaShape::generate().unwrap();
    rows.push(mldsa.score(&statement).unwrap());
    let mut btungsten = BtungstenEvalShape::new();
    rows.push(btungsten.score(&statement).unwrap());
    println!(
        "btungsten tower circuit: {} gates ({} toffoli-class)",
        btungsten.circuit_gates, btungsten.toffoli_gates
    );

    println!(
        "{:<20} {:>8} {:>10} {:>10} {:<12} {:>4}",
        "shape", "bytes", "prove_us", "verify_us", "setup", "pq"
    );
    for r in &rows {
        println!(
            "{:<20} {:>8} {:>10} {:>10} {:<12?} {:>4}",
            r.shape, r.proof_bytes, r.prove_us, r.verify_us, r.setup, r.pq_resistant
        );
    }
    println!("{}", serde_json::to_string_pretty(&rows).unwrap());
}
