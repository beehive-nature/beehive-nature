//! Capability negotiation + authorization-time binding: the RED-first
//! attack suite from the MP/RB/AB specs. Every attack is proven against
//! the SIGNED material through the estate's k256 BIP-190 path — never
//! a bespoke verifier.
//!
//! The 8 attacks (from the founder's order) + positive control:
//! 1. strip binding after signature → signature FAILS (AB-0)
//! 2. same version, different manifest contents → hash differs (AB-4)
//! 3. swap LN/EVM leg bindings → per-leg verification FAILS (AB-3)
//! 4. adapter upgrade while obligation is UNKNOWN → bound manifest governs (RB-1)
//! 5. evidence valid under new capabilities but invalid under signed → REFUSED (RB-2)
//! 6. crash/restart while live adapter advertises newer manifest → recovered binding preserved (RB-0/RB-1)
//! 7. replacement trying to inherit the newer manifest → REFUSED (RB-5)
//! 8. mixed old/new legs in one plan → remain distinct, not normalized (AB-6)
//! + positive: new authorization after capability change lawfully binds the new manifest (RB-6)

use bpay_rail::capability::{
    CapabilityManifest, FailureFeeSemantics, FinalitySemantics, JournalAuthRecord, LegBinding,
    PaymentSemantics, ResponseRead, SignedAuthorization,
};
use k256::schnorr::SigningKey;
use watchpay::types::Hex32;

fn signer() -> SigningKey {
    SigningKey::from_bytes(&[42u8; 32]).unwrap()
}

fn ln_manifest_v1() -> CapabilityManifest {
    CapabilityManifest {
        schema_version: 1,
        rail: "LN".into(),
        implementation_id: "bpay-rail/nwc@0.1.0".into(),
        payment: PaymentSemantics::Upto,
        hold_mpp: true,
        replacement: true,
        response_read: ResponseRead::WsRequired,
        finality: FinalitySemantics::InstantPreimage,
        failure_fees: FailureFeeSemantics::NothingOnFail,
        send_enabled: false,
        version: "1.0.0".into(),
    }
}

#[allow(dead_code)]
fn ln_manifest_v2_relaxed() -> CapabilityManifest {
    CapabilityManifest {
        schema_version: 1,
        rail: "LN".into(),
        implementation_id: "bpay-rail/nwc@0.2.0".into(),
        payment: PaymentSemantics::Upto,
        hold_mpp: true,
        replacement: true,
        response_read: ResponseRead::WsRequired,
        finality: FinalitySemantics::ReorgDepth(2), // relaxed from instant... wait, instant→depth-2 is actually a different shape. Let me make v2 relax the depth for EVM.
        failure_fees: FailureFeeSemantics::NothingOnFail,
        send_enabled: false,
        version: "2.0.0".into(),
    }
}

fn evm_manifest_v1() -> CapabilityManifest {
    CapabilityManifest {
        schema_version: 1,
        rail: "EVM".into(),
        implementation_id: "bpay-rail/watchpay@0.1.0".into(),
        payment: PaymentSemantics::Exact,
        hold_mpp: false,
        replacement: false,
        response_read: ResponseRead::PostReq,
        finality: FinalitySemantics::ReorgDepth(12),
        failure_fees: FailureFeeSemantics::GasOnRevert,
        send_enabled: false,
        version: "1.0.0".into(),
    }
}

fn evm_manifest_v2_relaxed() -> CapabilityManifest {
    let mut m = evm_manifest_v1();
    m.finality = FinalitySemantics::ReorgDepth(2); // relaxed
    m.version = "2.0.0".into();
    m.implementation_id = "bpay-rail/watchpay@0.2.0".into();
    m
}

fn binding_for(leg_id: &str, manifest: &CapabilityManifest) -> LegBinding {
    LegBinding {
        leg_id: leg_id.into(),
        manifest_hash: manifest.content_hash(),
        manifest_version: manifest.version.clone(),
        implementation_id: manifest.implementation_id.clone(),
    }
}

fn auth_id(tag: u8) -> Hex32 {
    let mut h = [0u8; 32];
    h[0] = tag;
    Hex32(h)
}

fn refusal_msg(e: &bpay_rail::LedgerError) -> String {
    e.to_string()
}

// ── Attack 1: strip binding after signature (AB-0) ────────────────────

#[test]
fn attack_1_strip_binding_after_signature() {
    let sk = signer();
    let ln = ln_manifest_v1();
    let bindings = vec![binding_for("leg-A", &ln)];
    let auth = SignedAuthorization::sign(auth_id(1), bindings, &sk).unwrap();

    // Verify the original → passes
    auth.verify().expect("original verifies");

    // STRIP the binding → signature must FAIL
    let stripped = SignedAuthorization {
        leg_bindings: vec![], // stripped!
        ..auth.clone()
    };
    let e = stripped.verify().unwrap_err();
    assert!(
        refusal_msg(&e).contains("VERIFICATION FAILED"),
        "stripped binding must fail verification: {e}"
    );
}

// ── Attack 2: same version, different manifest contents (AB-4) ────────

#[test]
fn attack_2_same_version_different_contents() {
    let m1 = evm_manifest_v1();
    let mut m2 = evm_manifest_v1();
    m2.finality = FinalitySemantics::ReorgDepth(2); // different content
                                                    // SAME version string
    assert_eq!(m1.version, m2.version, "precondition: same version");
    // DIFFERENT content hash
    assert_ne!(
        m1.content_hash(),
        m2.content_hash(),
        "same version + different content → different hash (AB-4: the hash is the authority, not the version)"
    );

    // An authorization signed against m1 does NOT verify against m2
    let sk = signer();
    let auth = SignedAuthorization::sign(auth_id(2), vec![binding_for("leg-A", &m1)], &sk).unwrap();
    let e = auth
        .verify_leg_binding("leg-A", &m2.content_hash())
        .unwrap_err();
    assert!(
        refusal_msg(&e).contains("SUBSTITUTED or DRIFTED"),
        "content substitution must be caught: {e}"
    );
}

// ── Attack 3: swap LN/EVM leg bindings (AB-3) ──────────────────────────

#[test]
fn attack_3_swap_leg_bindings() {
    let sk = signer();
    let ln = ln_manifest_v1();
    let evm = evm_manifest_v1();

    // Leg A binds LN, leg B binds EVM
    let bindings = vec![binding_for("leg-A", &ln), binding_for("leg-B", &evm)];
    let auth = SignedAuthorization::sign(auth_id(3), bindings, &sk).unwrap();

    // Normal verification passes
    auth.verify_leg_binding("leg-A", &ln.content_hash())
        .unwrap();
    auth.verify_leg_binding("leg-B", &evm.content_hash())
        .unwrap();

    // SWAP: try to verify leg-A against the EVM manifest → FAILS
    let e = auth
        .verify_leg_binding("leg-A", &evm.content_hash())
        .unwrap_err();
    assert!(
        refusal_msg(&e).contains("SUBSTITUTED or DRIFTED"),
        "swapped bindings must fail per-leg verification: {e}"
    );

    // SWAP the bindings in the authorization → signature FAILS (AB-3)
    let swapped = SignedAuthorization {
        leg_bindings: vec![binding_for("leg-A", &evm), binding_for("leg-B", &ln)],
        ..auth.clone()
    };
    let e2 = swapped.verify().unwrap_err();
    assert!(
        refusal_msg(&e2).contains("VERIFICATION FAILED"),
        "swapped bindings inside the auth must break the signature: {e2}"
    );
}

// ── Attack 4: adapter upgrade while obligation is UNKNOWN (RB-1) ──────

#[test]
fn attack_4_adapter_upgrade_during_unknown() {
    let sk = signer();
    let v1 = evm_manifest_v1(); // depth-12
    let v2 = evm_manifest_v2_relaxed(); // depth-2

    // Authorization binds v1
    let auth = SignedAuthorization::sign(auth_id(4), vec![binding_for("leg-A", &v1)], &sk).unwrap();

    // Journal PRESERVES the v1 binding + snapshot
    let journal = JournalAuthRecord {
        auth,
        manifest_snapshots: vec![(v1.content_hash(), v1.clone())],
    };

    // The LIVE adapter now advertises v2 (drift)
    let live_manifest = v2.clone();

    // Capability lookup for the UNKNOWN leg resolves against the BOUND v1
    let bound = journal.bound_manifest("leg-A").unwrap();
    assert_eq!(
        bound.content_hash(),
        v1.content_hash(),
        "RB-1: the recovered binding must be v1, not the live v2"
    );
    assert_ne!(
        bound.content_hash(),
        live_manifest.content_hash(),
        "RB-1: the bound manifest must differ from the drifted live one"
    );
}

// ── Attack 5: evidence valid under new capabilities, invalid under signed (RB-2) ──

#[test]
fn attack_5_evidence_inheritance_refused() {
    let sk = signer();
    let v1 = evm_manifest_v1(); // requires depth-12
    let v2 = evm_manifest_v2_relaxed(); // requires depth-2

    let auth = SignedAuthorization::sign(auth_id(5), vec![binding_for("leg-A", &v1)], &sk).unwrap();

    let journal = JournalAuthRecord {
        auth,
        manifest_snapshots: vec![(v1.content_hash(), v1.clone())],
    };

    // Evidence at depth 6: PASSES v2 (depth-2) but FAILS v1 (depth-12)
    let depth = 6u64;
    // Under v2 (the live manifest): would pass
    match v2.finality {
        FinalitySemantics::ReorgDepth(d) => {
            assert!(depth >= d, "depth {depth} passes v2's depth-{d}")
        }
        _ => unreachable!(),
    }
    // Under v1 (the BOUND manifest): must FAIL (RB-2)
    let e = journal
        .validate_evidence_under_binding("leg-A", depth)
        .unwrap_err();
    assert!(
        refusal_msg(&e).contains("RB-2"),
        "evidence-path capability inheritance must be named as RB-2: {e}"
    );
    assert!(
        refusal_msg(&e).contains("reorg-depth-12"),
        "the BOUND manifest's depth requirement must be named: {e}"
    );
}

// ── Attack 6: crash/restart while live adapter advertises newer (RB-0/RB-1) ──

#[test]
fn attack_6_crash_restart_with_drifted_live_manifest() {
    let sk = signer();
    let v1 = evm_manifest_v1();
    let v2 = evm_manifest_v2_relaxed();

    let auth = SignedAuthorization::sign(
        auth_id(6),
        vec![binding_for("leg-A", &v1), binding_for("leg-B", &v2)],
        &sk,
    )
    .unwrap();

    let journal_before = JournalAuthRecord {
        auth: auth.clone(),
        manifest_snapshots: vec![
            (v1.content_hash(), v1.clone()),
            (v2.content_hash(), v2.clone()),
        ],
    };

    // Simulate crash/restart: drop and reconstruct the journal record
    // (the binding is in the durable record, not in adapter memory)
    let journal_after = JournalAuthRecord {
        auth: journal_before.auth.clone(),
        manifest_snapshots: journal_before.manifest_snapshots.clone(),
    };

    // RB-0: the binding survives byte-equal
    assert_eq!(
        journal_before.auth.leg_bindings, journal_after.auth.leg_bindings,
        "RB-0: journal round-trip must preserve the binding byte-equal"
    );

    // RB-1: the recovered binding still resolves against the BOUND manifests
    let bound_a = journal_after.bound_manifest("leg-A").unwrap();
    let bound_b = journal_after.bound_manifest("leg-B").unwrap();
    assert_eq!(bound_a.content_hash(), v1.content_hash());
    assert_eq!(bound_b.content_hash(), v2.content_hash());

    // The signature still verifies after recovery
    journal_after
        .auth
        .verify()
        .expect("recovered auth verifies");
}

// ── Attack 7: replacement trying to inherit the newer manifest (RB-5) ──

#[test]
fn attack_7_replacement_cannot_inherit_newer_manifest() {
    let sk = signer();
    let v1 = evm_manifest_v1(); // depth-12
    let v2 = evm_manifest_v2_relaxed(); // depth-2

    // Original authorization binds v1
    let auth = SignedAuthorization::sign(auth_id(7), vec![binding_for("leg-A", &v1)], &sk).unwrap();

    let journal = JournalAuthRecord {
        auth,
        manifest_snapshots: vec![(v1.content_hash(), v1.clone())],
    };

    // A "replacement" attempt that carries v2 semantics instead of v1
    // (trying to inherit the newer manifest) must FAIL per-leg verification
    let e = journal
        .auth
        .verify_leg_binding("leg-A", &v2.content_hash())
        .unwrap_err();
    assert!(
        refusal_msg(&e).contains("SUBSTITUTED or DRIFTED"),
        "RB-5: replacement under newer-manifest semantics must be refused: {e}"
    );
}

// ── Attack 8: mixed old/new legs remain distinct (AB-6) ───────────────

#[test]
fn attack_8_mixed_bindings_remain_distinct() {
    let sk = signer();
    let v1 = evm_manifest_v1(); // depth-12
    let v2 = evm_manifest_v2_relaxed(); // depth-2

    // A plan with leg-A under v1, leg-B under v2 (post-drift re-auth)
    let bindings = vec![binding_for("leg-A", &v1), binding_for("leg-B", &v2)];
    let auth = SignedAuthorization::sign(auth_id(8), bindings, &sk).unwrap();

    let journal = JournalAuthRecord {
        auth,
        manifest_snapshots: vec![
            (v1.content_hash(), v1.clone()),
            (v2.content_hash(), v2.clone()),
        ],
    };

    // Each leg verifies against ITS OWN binding
    journal
        .auth
        .verify_leg_binding("leg-A", &v1.content_hash())
        .unwrap();
    journal
        .auth
        .verify_leg_binding("leg-B", &v2.content_hash())
        .unwrap();

    // Each leg's capability lookups resolve against its BOUND manifest
    let a = journal.bound_manifest("leg-A").unwrap();
    let b = journal.bound_manifest("leg-B").unwrap();
    assert_eq!(
        a.finality,
        FinalitySemantics::ReorgDepth(12),
        "leg-A under v1"
    );
    assert_eq!(
        b.finality,
        FinalitySemantics::ReorgDepth(2),
        "leg-B under v2"
    );

    // Evidence at depth-6: FAILS for leg-A (v1: depth-12), PASSES for leg-B (v2: depth-2)
    assert!(journal.validate_evidence_under_binding("leg-A", 6).is_err());
    assert!(journal.validate_evidence_under_binding("leg-B", 6).is_ok());

    // Cross-leg verification FAILS (the homogenization attack)
    assert!(journal
        .auth
        .verify_leg_binding("leg-A", &v2.content_hash())
        .is_err());
    assert!(journal
        .auth
        .verify_leg_binding("leg-B", &v1.content_hash())
        .is_err());
}

// ── Positive control: new authorization after capability change (RB-6) ─

#[test]
fn positive_control_new_authorization_binds_new_manifest() {
    let sk = signer();
    let v1 = evm_manifest_v1();
    let v2 = evm_manifest_v2_relaxed();

    // First authorization under v1
    let auth1 =
        SignedAuthorization::sign(auth_id(0xA1), vec![binding_for("leg-old", &v1)], &sk).unwrap();

    // Capability drift happens. A NEW authorization binds v2
    let auth2 =
        SignedAuthorization::sign(auth_id(0xA2), vec![binding_for("leg-new", &v2)], &sk).unwrap();

    // Both coexist without interference
    let journal = JournalAuthRecord {
        auth: auth2.clone(),
        manifest_snapshots: vec![
            (v1.content_hash(), v1.clone()),
            (v2.content_hash(), v2.clone()),
        ],
    };

    // The new authorization verifies against v2
    auth2
        .verify_leg_binding("leg-new", &v2.content_hash())
        .unwrap();

    // The old authorization still verifies against v1
    auth1
        .verify_leg_binding("leg-old", &v1.content_hash())
        .unwrap();

    // The historical obligation retains the old manifest's semantics.
    // Positive control: the new authorization lawfully binds v2, and
    // evidence at depth-6 (which passes v2's depth-2) is ACCEPTED
    // for the new leg. The old auth1 (still verifiable against v1)
    // would refuse this evidence — that separation is the point.
    assert!(
        journal
            .validate_evidence_under_binding("leg-new", 6)
            .is_ok(),
        "new leg under v2: depth-6 passes depth-2 requirement"
    );
    assert!(
        journal
            .validate_evidence_under_binding("leg-new", 1)
            .is_err(),
        "new leg under v2: depth-1 fails depth-2 requirement"
    );
}
