use bnr_solana_tungsten::*;

fn main() {
    let worker = Worker::new();
    let solana = SolanaHost::new(worker.key()).expect("publishable key");
    let reference = ArkworksHost::new(worker.key()).expect("publishable key");
    let grant = fixture();
    let sent = worker.prove(grant.job.clone());
    // Serialization loopback only: x0x is NOT contacted and gets no authority.
    let bytes = serde_json::to_vec(&sent).unwrap();
    let received: Packet = serde_json::from_slice(&bytes).unwrap();
    // Isolated counterfactual ledgers for conformance, not two spends on one grant.
    let a = LocalGate::new(grant.clone(), solana.key_hash())
        .plan(&received, &solana, Rail::SolanaDryRun, 99)
        .unwrap();
    let b = LocalGate::new(grant, reference.key_hash())
        .plan(&received, &reference, Rail::VaultaDryRun, 99)
        .unwrap();
    let mut normalized = b.clone();
    normalized.proof_adapter = a.proof_adapter;
    normalized.settlement_adapter = a.settlement_adapter;
    assert_eq!(a, normalized);
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "experiment": "BNR Solana tungsten - local only",
            "same_envelope_except_adapter_names": true,
            "transport": "serde-json-loopback-not-x0x",
            "verifier_program": solana_groth16_verify::instruction::ID.to_string(),
            "derived_vk_address_not_deployed": solana.key_address(),
            "setup": "ephemeral single-party; no production ceremony",
            "observations": [a, b],
            "vaulta_same_job_proof": VaultaUnsupported.verify(&received).unwrap_err(),
            "on_chain_verification": "NOT RUN",
            "settlement": "NOT SUBMITTED"
        }))
        .unwrap()
    );
}
