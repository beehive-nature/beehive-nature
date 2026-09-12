#[test]
fn astra_r1_verified_result_must_not_cross_plan_identity() {
    let vp = payer_vp();
    let req = SignRequest::compose(&vp, TxDestination::BatchPayment { batch_index: 0 }, TxEnvelope::Eip1559, 7, 1, path(), SYNTH_NOW).unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    let mut other_plan = vp.plan().clone();
    other_plan.job_id = "astra-other-job".into();
    other_plan.plan_hash = watchpay::canonical::plan_hash(&other_plan);
    let other = validate_plan(&other_plan, SYNTH_NOW).unwrap();
    assert_ne!(other.sealed_hash(), verified.request_plan_hash());
    let ledger = Ledger::open(&tmp_root("astra-cross-plan")).unwrap();
    ledger.write_intent(&other, 0, 7, SYNTH_NOW).unwrap();
    assert!(record_verified_signed(&ledger, &other, 0, &verified, SYNTH_NOW+1).is_err(), "verified response from different plan accepted into this job");
}
