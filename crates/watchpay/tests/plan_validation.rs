//! Plan validation battery: happy paths, the depth-12 counterexample, and
//! every negative fixture — each refusal asserts the named field.

use watchpay::abi::MERKLE_PAYMENT_EXPIRATION_SECS;
use watchpay::plan::{plan_from_json, validate_plan};
use watchpay::plan_model::*;
use watchpay::pricing::{batch_sum_candidates, batch_worst_case_charge};
use watchpay::test_support::*;
use watchpay::types::{Atto, EthAddr, Hex32};

fn field_of(e: &watchpay::Error) -> &'static str {
    e.field_name()
        .unwrap_or_else(|| panic!("refusal lacks a field name: {e}"))
}

#[test]
fn base_plan_validates_with_derived_figures() {
    let vp = validate_plan(&base_plan(), SYNTH_NOW).unwrap();
    assert_eq!(vp.batch_worst_case().len(), 1);
    // pool1 median 9 << 2 = 36; pool2 median 1 << 2 = 4; max = 36.
    assert_eq!(vp.batch_worst_case()[0], Atto::from_u64(36));
    assert_eq!(vp.approve_ceiling(), Atto::from_u64(36));
    assert_eq!(vp.planned_tx_count(), 2); // 1 batch + 1 approve
                                          // worst-case native fee = 500k gas * 100 gwei * 2 txs
    assert_eq!(
        vp.worst_case_total_native_fee_wei(),
        Atto::from_u64(500_000 * 100_000_000_000u128 as u64 * 2)
    );
}

/// THE REVIEW'S COUNTEREXAMPLE AS A REGRESSION: depth 12, 64 pools, every
/// candidate amount 1 — the sum of all candidates (1_024) is neither the
/// charge nor a bound for it (any pool charges median16<<12 = 4_096).
#[test]
fn depth_12_unit_price_counterexample() {
    let batch = depth12_counterexample_batch();
    // the arithmetic facts of the counterexample
    assert_eq!(batch.commitments.len(), 64);
    assert_eq!(batch_sum_candidates(&batch).unwrap(), Atto::from_u64(1024));
    assert_eq!(
        batch_worst_case_charge(&batch).unwrap(),
        Atto::from_u64(4096)
    );

    // a plan that DECLARES the candidate sum as the ceiling is refused,
    // naming both numbers
    let mut plan = base_plan();
    plan.batches = vec![Batch {
        batch_amount_ceiling: Atto::from_u64(1024), // the wrong bound
        ..batch.clone()
    }];
    plan.approve_ceiling_total = Atto::from_u64(1024);
    plan.plan_hash = watchpay::canonical::plan_hash(&plan);
    let err = validate_plan(&plan, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&err), "batch_amount_ceiling");
    let msg = err.to_string();
    assert!(
        msg.contains("1024") && msg.contains("4096"),
        "refusal names both figures: {msg}"
    );

    // the correct derivation is accepted; approve ceiling is 4096, NOT MAX
    let mut good = base_plan();
    good.batches = vec![batch];
    good.approve_ceiling_total = Atto::from_u64(4096);
    good.plan_hash = watchpay::canonical::plan_hash(&good);
    let vp = validate_plan(&good, SYNTH_NOW).unwrap();
    assert_eq!(vp.approve_ceiling(), Atto::from_u64(4096));
    assert_ne!(vp.approve_ceiling(), Atto::MAX);
}

#[test]
fn wrong_schema_refused() {
    let mut p = base_plan();
    p.schema = "watch-pay-plan/2".into();
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "schema"
    );
}

#[test]
fn wave_arm_rejected() {
    let mut p = base_plan();
    p.arm = "wave".into();
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "arm");
    assert!(e.to_string().contains("Merkle-only"));
}

#[test]
fn expiry_laws() {
    // plan expired
    let mut p = base_plan();
    p.expires_unix = SYNTH_NOW - 1;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "expires_unix"
    );
    // window too long
    let mut p = base_plan();
    p.expires_unix = p.created_unix + MERKLE_PAYMENT_EXPIRATION_SECS + 1;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "expires_unix");
    assert!(e.to_string().contains("MERKLE_PAYMENT_EXPIRATION"));
    // created in the future
    let mut p = base_plan();
    p.created_unix = SYNTH_NOW + 1;
    p.expires_unix = SYNTH_NOW + 60;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "created_unix"
    );
}

#[test]
fn batch_timestamp_expiry() {
    // future timestamp
    let mut p = base_plan();
    p.batches[0].merkle_payment_timestamp = SYNTH_NOW + 1;
    p.batches[0].batch_id =
        watchpay::canonical::batch_id(p.network.chain_id, &p.network.payment_vault, &p.batches[0]);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "merkle_payment_timestamp"
    );
    // aged beyond the 7-day window
    let mut p = base_plan();
    p.batches[0].merkle_payment_timestamp = SYNTH_NOW - MERKLE_PAYMENT_EXPIRATION_SECS - 1;
    p.batches[0].batch_id =
        watchpay::canonical::batch_id(p.network.chain_id, &p.network.payment_vault, &p.batches[0]);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "merkle_payment_timestamp");
    assert!(e.to_string().contains("exceeds"));
}

#[test]
fn depth_bounds() {
    for depth in [0u8, 13, 255] {
        let mut p = base_plan();
        p.batches[0].depth = depth;
        // pool count/ceiling re-derivation happens after depth check
        assert_eq!(
            field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
            "depth"
        );
    }
}

#[test]
fn pool_count_and_uniqueness() {
    // wrong pool count for depth 2 (needs 2): three pools
    let mut p = base_plan();
    let extra = pool(3, [1; 16]);
    p.batches[0].commitments.push(extra);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "commitments"
    );

    // duplicate pool hash
    let mut p = base_plan();
    let dup = p.batches[0].commitments[0].clone();
    p.batches[0].commitments[1] = dup;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "pool_hash");
    assert!(e.to_string().contains("duplicate"));
}

#[test]
fn declared_vs_derived_figures() {
    // batch_id tampered
    let mut p = base_plan();
    p.batches[0].batch_id = synth_hash(0x99);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "batch_id"
    );

    // approve ceiling not the sum
    let mut p = base_plan();
    p.approve_ceiling_total = Atto::from_u64(35);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "approve_ceiling_total"
    );

    // approve ceiling exactly U256::MAX (E7 law) — construct via a huge
    // single-batch ceiling so the SUM equals MAX; sums overflow first in
    // the normal path, so force the declared field directly: the equality
    // check fires first (declared != sum), then a declared == MAX plan
    // whose sum also equals MAX is arithmetically unreachable — the law
    // check remains as the explicit guard (asserted at composer level in
    // the parity tests).
}

#[test]
fn tampered_plan_hash_refused() {
    let mut p = base_plan();
    p.plan_hash = synth_hash(0x77);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "plan_hash");
    assert!(e.to_string().contains("tampered"));
}

#[test]
fn gas_and_native_fee_ceilings() {
    // gas below intrinsic
    let mut p = base_plan();
    p.gas_ceilings.per_tx_gas_limit = 20_999;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "per_tx_gas_limit"
    );

    // total gas cannot cover the plan
    let mut p = base_plan();
    p.gas_ceilings.max_total_gas = 999_999;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "max_total_gas"
    );

    // zero fee cap
    let mut p = base_plan();
    p.native_fee_ceilings.per_tx_max_fee_per_gas_wei = 0;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "per_tx_max_fee_per_gas_wei"
    );

    // priority above total fee cap
    let mut p = base_plan();
    p.native_fee_ceilings.per_tx_max_priority_fee_wei = 101_000_000_000;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "per_tx_max_priority_fee_wei"
    );

    // declared native total below derived worst-case (gas units are not a
    // native fee cap)
    let mut p = base_plan();
    p.native_fee_ceilings.max_total_native_fee_wei = Atto::from_u64(1);
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    let e = validate_plan(&p, SYNTH_NOW).unwrap_err();
    assert_eq!(field_of(&e), "max_total_native_fee_wei");
    assert!(e
        .to_string()
        .contains("gas units alone are not a native fee cap"));
}

#[test]
fn job_id_and_identity_fields() {
    let bads = vec![
        String::new(),
        "a".repeat(65),
        "../evil".to_string(),
        "job id".to_string(),
        "a..b".to_string(),
    ];
    for bad in &bads {
        let mut p = base_plan();
        p.job_id = bad.clone();
        p.plan_hash = watchpay::canonical::plan_hash(&p);
        assert_eq!(
            field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
            "job_id",
            "job_id {bad:?} must be refused"
        );
    }
    // token == vault
    let mut p = base_plan();
    p.network.payment_vault = p.network.payment_token;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "payment_vault"
    );
    // non-public visibility
    let mut p = base_plan();
    p.upload.visibility = "private".into();
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "visibility"
    );
    // zero payer
    let mut p = base_plan();
    p.expected_payer = EthAddr::ZERO;
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    assert_eq!(
        field_of(&validate_plan(&p, SYNTH_NOW).unwrap_err()),
        "expected_payer"
    );
}

/// THE STRUCTURAL NO-PRIVATE-MATERIAL LAW: a JSON envelope carrying an
/// unknown field (e.g. a smuggled "data_map" blob) is refused by serde.
#[test]
fn unknown_fields_refused_no_smuggled_capability() {
    let p = base_plan();
    let mut json = serde_json::to_string(&p).unwrap();
    // splice in a foreign field before the closing brace
    json.replace_range(json.len() - 1.., ",\"data_map\":{\"chunks\":[1,2,3]}}");
    let err = plan_from_json(&json).unwrap_err();
    assert!(err.to_string().contains("unknown field"), "{err}");
}

#[test]
fn plan_json_round_trip() {
    let p = base_plan();
    let json = watchpay::plan::plan_to_json(&p).unwrap();
    let back = plan_from_json(&json).unwrap();
    assert_eq!(back, p);
    let vp = validate_plan(&back, SYNTH_NOW).unwrap();
    assert_eq!(vp.plan().plan_hash, p.plan_hash);
    let _ = Hex32::ZERO;
}

/// The validation seal, R2 form (z2.b R1 review P1): the R0/R1 tests
/// exercised in-place mutation of the handle — `vp.plan.job_id = …`,
/// `vp.approve_ceiling = …`. After hardening, ALL fields of
/// `ValidatedPlan` (inner plan AND derived figures) are private behind
/// immutable getters, so those mutation shapes NO LONGER COMPILE — the
/// reviewer-sanctioned fix form ("compile-time immutability is
/// acceptable if the mutation API is eliminated"). What remains to test
/// behaviorally: a handle stays consistent, revalidation re-derives the
/// same sealed figures, and a genuinely different plan gets a different
/// seal. The changed-plan-under-an-intent fence stays covered by
/// review_adversarial::review_refuse_changed_plan_after_intent.
#[test]
fn validated_plan_is_compile_time_immutable() {
    let vp = validate_plan(&base_plan(), SYNTH_NOW).unwrap();
    assert!(vp.is_internally_consistent());
    assert_eq!(vp.sealed_hash(), vp.plan().plan_hash);
    assert_eq!(vp.approve_ceiling(), Atto::from_u64(36));
    assert_eq!(vp.planned_tx_count(), 2);
    assert_eq!(vp.batch_worst_case().len(), 1);
    assert_eq!(vp.batch_worst_case()[0], Atto::from_u64(36));

    // revalidation at a later (still unexpired) time re-derives the same
    // sealed figures and succeeds
    let fresh = vp.revalidate(SYNTH_NOW + 1).unwrap();
    assert_eq!(fresh.sealed_hash(), vp.sealed_hash());
    assert_eq!(fresh.approve_ceiling(), vp.approve_ceiling());

    // a genuinely different plan is a different validation result with a
    // different seal — there is no path from one handle to the other
    let mut other = base_plan();
    other.job_id = "honest-new-job".into();
    other.plan_hash = watchpay::canonical::plan_hash(&other);
    let other_vp = validate_plan(&other, SYNTH_NOW).unwrap();
    assert_ne!(other_vp.sealed_hash(), vp.sealed_hash());
    assert!(other_vp.is_internally_consistent());

    // expiry freshness still bites through revalidation (R0 finding 2
    // stays covered at the boundary)
    let e = vp.revalidate(vp.plan().expires_unix + 1).unwrap_err();
    assert_eq!(field_of(&e), "expires_unix");
}
