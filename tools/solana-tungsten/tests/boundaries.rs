use bnr_solana_tungsten::*;
use std::sync::OnceLock;

fn worker() -> &'static Worker {
    static WORKER: OnceLock<Worker> = OnceLock::new();
    WORKER.get_or_init(Worker::new)
}

fn verifiers() -> (SolanaHost, ArkworksHost) {
    (
        SolanaHost::new(worker().key()).unwrap(),
        ArkworksHost::new(worker().key()).unwrap(),
    )
}

#[test]
fn real_proof_roundtrips_and_both_verifiers_preserve_envelope() {
    let (solana, reference) = verifiers();
    let grant = fixture();
    let packet = worker().prove(grant.job.clone());
    let received: Packet = serde_json::from_slice(&serde_json::to_vec(&packet).unwrap()).unwrap();
    let a = LocalGate::new(grant.clone(), solana.key_hash())
        .plan(&received, &solana, Rail::SolanaDryRun, 99)
        .unwrap();
    let mut b = LocalGate::new(grant, reference.key_hash())
        .plan(&received, &reference, Rail::VaultaDryRun, 99)
        .unwrap();
    b.proof_adapter = a.proof_adapter;
    b.settlement_adapter = a.settlement_adapter;
    assert_eq!(a, b);
    assert_eq!(a.output, 49);
    assert_eq!(a.value_observed, "none");
    assert_eq!(a.transaction_reference, None);
    assert_eq!(a.settlement_status, "dry-run-plan-only");
}

#[test]
fn changing_any_job_field_breaks_proof_and_authority_binding() {
    let (solana, reference) = verifiers();
    let grant = fixture();
    let original = worker().prove(grant.job.clone());
    let mutations: [fn(&mut Job); 10] = [
        |j| j.domain.push('x'),
        |j| j.job_id.push('x'),
        |j| j.authorization_id.push('x'),
        |j| j.nonce += 1,
        |j| j.recipient.push('x'),
        |j| j.asset.push('x'),
        |j| j.amount += 1,
        |j| j.fee_asset.push('x'),
        |j| j.fee += 1,
        |j| j.input += 1,
    ];
    for mutate in mutations {
        let mut packet = original.clone();
        mutate(&mut packet.job);
        assert!(solana.verify(&packet).is_err());
        assert!(reference.verify(&packet).is_err());
        let mut gate = LocalGate::new(grant.clone(), solana.key_hash());
        assert_eq!(
            gate.plan(&packet, &solana, Rail::SolanaDryRun, 99),
            Err("job differs from local authorization")
        );
        assert!(gate
            .plan(&original, &solana, Rail::SolanaDryRun, 99)
            .is_ok());
    }
}

#[test]
fn valid_proof_is_not_payment_authority() {
    let (solana, _) = verifiers();
    let grant = fixture();
    let mut unauthorized = grant.job.clone();
    unauthorized.recipient = "different-worker".into();
    let proof = worker().prove(unauthorized);
    assert!(solana.verify(&proof).is_ok());
    assert_eq!(
        LocalGate::new(grant, solana.key_hash()).plan(&proof, &solana, Rail::SolanaDryRun, 99),
        Err("job differs from local authorization")
    );
}

#[test]
fn replay_is_rejected_across_rails_and_new_proof_bytes() {
    let (solana, reference) = verifiers();
    let grant = fixture();
    let first = worker().prove(grant.job.clone());
    let second = worker().prove(grant.job.clone());
    assert_ne!(first.proof, second.proof);
    assert!(reference.verify(&second).is_ok());
    let mut gate = LocalGate::new(grant, solana.key_hash());
    gate.plan(&first, &solana, Rail::SolanaDryRun, 99).unwrap();
    assert_eq!(
        gate.plan(&first, &solana, Rail::SolanaDryRun, 99),
        Err("authorization already consumed")
    );
    assert_eq!(
        gate.plan(&second, &reference, Rail::VaultaDryRun, 99),
        Err("authorization already consumed")
    );
}

#[test]
fn ceilings_expiry_and_rail_policy_fail_before_consumption() {
    let (solana, _) = verifiers();
    let grant = fixture();
    let packet = worker().prove(grant.job.clone());
    let mut amount = grant.clone();
    amount.max_amount = 6;
    let mut fee = grant.clone();
    fee.max_fee = 0;
    let mut rail = grant.clone();
    rail.allowed_rails = vec![Rail::VaultaDryRun];
    for (policy, now, error) in [
        (amount, 99, "amount exceeds ceiling"),
        (fee, 99, "fee exceeds ceiling"),
        (rail, 99, "rail not authorized"),
        (grant.clone(), 100, "expired authorization"),
        (grant, 101, "expired authorization"),
    ] {
        assert_eq!(
            LocalGate::new(policy, solana.key_hash()).plan(
                &packet,
                &solana,
                Rail::SolanaDryRun,
                now
            ),
            Err(error)
        );
    }
}

#[test]
fn forged_truncated_and_wrong_output_proofs_do_not_consume_grant() {
    let (solana, reference) = verifiers();
    let grant = fixture();
    let packet = worker().prove(grant.job.clone());
    let mut forged = packet.clone();
    forged.proof[63] ^= 1;
    let mut truncated = packet.clone();
    truncated.proof.pop();
    let mut output = packet.clone();
    output.output += 1;
    for bad in [forged, truncated, output] {
        assert!(reference.verify(&bad).is_err());
        let mut gate = LocalGate::new(grant.clone(), solana.key_hash());
        assert!(gate.plan(&bad, &solana, Rail::SolanaDryRun, 99).is_err());
        assert!(gate.plan(&packet, &solana, Rail::SolanaDryRun, 99).is_ok());
    }
}

#[test]
fn replacement_key_and_unsupported_vaulta_route_fail_closed() {
    let (solana, _) = verifiers();
    let grant = fixture();
    let packet = worker().prove(grant.job.clone());
    assert_eq!(
        LocalGate::new(grant.clone(), [0; 32]).plan(&packet, &solana, Rail::SolanaDryRun, 99),
        Err("untrusted verifying key")
    );
    let mut gate = LocalGate::new(grant, VaultaUnsupported.key_hash());
    assert_eq!(
        gate.plan(&packet, &VaultaUnsupported, Rail::VaultaDryRun, 99),
        Err("Vaulta same-job proof adapter not implemented")
    );
}

#[test]
fn full_u32_worker_input_has_no_u64_overflow() {
    let (solana, reference) = verifiers();
    let mut job = fixture().job;
    job.input = u32::MAX;
    let packet = worker().prove(job);
    assert_eq!(packet.output, u64::from(u32::MAX).pow(2));
    solana.verify(&packet).unwrap();
    reference.verify(&packet).unwrap();
}
