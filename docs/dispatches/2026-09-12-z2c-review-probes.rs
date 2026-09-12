#[test]
fn astra_review_actual_connect_wire_response_decodes() {
    let vp = payer_vp();
    let req = SignRequest::compose(&vp, TxDestination::BatchPayment { batch_index: 0 }, TxEnvelope::Eip1559, 7, path(), SYNTH_NOW).unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let wire = serde_json::json!({"serializedTx": raw.serialized_tx, "v": raw.v, "r": raw.r, "s": raw.s});
    assert!(serde_json::from_value::<ConnectSignedTxRaw>(wire).is_ok(), "actual Connect serializedTx field must deserialize");
}

#[test]
fn astra_review_summary_cannot_substitute_another_plan_payer() {
    let vp = payer_vp();
    let req = SignRequest::compose(&vp, TxDestination::BatchPayment { batch_index: 0 }, TxEnvelope::Eip1559, 7, path(), SYNTH_NOW).unwrap();
    let other = validate_plan(&base_plan(), SYNTH_NOW).unwrap();
    assert_ne!(other.plan().expected_payer, vp.plan().expected_payer);
    let summary = req.review_summary(&other);
    assert_eq!(summary.payer, vp.plan().expected_payer, "review summary silently substituted unrelated payer");
}

#[test]
fn astra_review_cancelled_result_cannot_attach_to_new_attempt() {
    let ledger = Ledger::open(&tmp_root("astra-replacement")).unwrap();
    let vp = payer_vp();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    let req = SignRequest::compose(&vp, TxDestination::BatchPayment { batch_index: 0 }, TxEnvelope::Eip1559, 7, path(), SYNTH_NOW).unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    ledger.cancel_intent(&vp, 0, SYNTH_NOW+1, "cancelled before callback").unwrap();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW+2).unwrap();
    assert!(record_verified_signed(&ledger, &vp, 0, &verified, SYNTH_NOW+3).is_err(), "old response attached to a different attempt with the same nonce");
}
