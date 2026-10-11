//! The succession/rotation battery — ORDER BZDID-002 Phase 1.
//!
//! Every refusal class the module names is proven by an adversarial
//! construction, and every positive property (sovereign-root invariance,
//! priority arbitration, determinism, evidence return) by a scenario.
//! The byte-level `BDID-ROTATE-V1` canon is frozen by a pinned vector at
//! the top — the same law the genesis canon froze.

mod common;

use bzdid::{
    resolve_did, rotate_body_bytes, BzDid, DidState, RotateOp, SuccessionError, ROTATE_DOMAIN,
};
use common::{scenario, signed_rotate, TestKey, T0, V1};
use sha2::{Digest, Sha256};

fn b32(bytes: &[u8]) -> String {
    bzdid::did::encode_base32(bytes)
}

// ------------------------------------------------------------------
// The frozen BDID-ROTATE-V1 vector
// ------------------------------------------------------------------

/// The v1 rotate canon, frozen: from these fixed seeds this op builds to
/// exactly these bytes (hash pinned in base32 — the estate's hex-run law
/// prefers non-hex for pinned constants). PUBLIC-CONSTANT: test vector.
pub const FROZEN_OP_HASH_B32: &str = "z6hbjio2kgoxpvbrn7xnyfiu2teynj4phgimo6zfyfm52dzl2axa";

#[test]
fn the_rotate_vector_is_frozen() {
    let s = scenario();
    let (op, bytes) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r1.card(), s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h: [u8; 32] = Sha256::digest(&bytes).into();
    assert_eq!(
        b32(&h),
        FROZEN_OP_HASH_B32,
        "the rotate v1 canon moved — that is a v2 ceremony, not an edit"
    );
    // and the op parses back to exactly what was built
    assert_eq!(RotateOp::parse(&bytes).unwrap(), op);
    // the domain separator rides the signed message
    let msg = rotate_body_bytes(&op).unwrap();
    assert!(msg.starts_with(ROTATE_DOMAIN));
}

// ------------------------------------------------------------------
// The happy path
// ------------------------------------------------------------------

#[test]
fn a_chain_rotates_keys_and_the_did_never_moves() {
    let s = scenario();
    // seq 1: r1 (the hot key) rotates the whole keyset to fresh keys
    let new0 = TestKey::ml(0xD1);
    let new1 = TestKey::ed(0xD2);
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![new0.card(), new1.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    // seq 2: new0 (highest priority in the new set) rotates again, to ed-only
    let new2 = TestKey::ed(0xE1);
    let (op2, b2) = signed_rotate(
        2,
        h1,
        T0 + 100,
        0,
        vec![new2.card()],
        TestKey::ed(0x5F).card(),
        V1 + 500, // renewal: validUntil extends
        &new0,
    );
    let h2 = op2.hash().unwrap();
    // seq 3: new2 (ed25519 arm) rotates to an ml-dsa key
    let new3 = TestKey::ml(0xF1);
    let (op3, b3) = signed_rotate(
        3,
        h2,
        T0 + 200,
        0,
        vec![new3.card()],
        TestKey::ed(0x60).card(),
        V1 + 1000,
        &new2,
    );

    let resolved = resolve_did(&s.did, &s.genesis_bytes, &[b1, b2, b3], None).unwrap();
    assert_eq!(resolved.did, s.did, "the sovereign root never moves");
    assert_eq!(resolved.head.seq, 3);
    assert_eq!(resolved.head.hash, op3.hash().unwrap());
    assert_eq!(resolved.head.rotation_keys, vec![new3.card()]);
    assert_eq!(resolved.head.valid_until, V1 + 1000);
    assert_eq!(resolved.head.last_at, T0 + 200);
    assert_eq!(resolved.applied.len(), 3);
    assert!(resolved.lost_forks.is_empty());
    // validity follows the head; the boundary refuses
    assert!(resolved.valid_at(V1 + 999));
    assert!(!resolved.valid_at(V1 + 1000));
}

// ------------------------------------------------------------------
// Authorization
// ------------------------------------------------------------------

#[test]
fn an_index_outside_the_predecessor_keyset_is_unauthorized() {
    let s = scenario();
    let (_, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        3, // the keyset has indexes 0..=2
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1], None),
        Err(SuccessionError::Unauthorized {
            seq: 1,
            signed_by: 3
        })
    ));
}

// ------------------------------------------------------------------
// Invalid signatures — and the revoked-key death path
// ------------------------------------------------------------------

#[test]
fn a_flipped_signature_byte_refuses() {
    let s = scenario();
    let (mut op, _) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    op.sig[10] ^= 0x01;
    let bytes = op.build().unwrap();
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[bytes], None),
        Err(SuccessionError::InvalidSignature {
            seq: 1,
            signed_by: 1
        })
    ));
}

#[test]
fn a_body_flipped_after_signing_refuses() {
    let s = scenario();
    let (_, mut bytes) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    // flip a byte inside the signed body (not the sig field): either the
    // parse breaks, or the signature no longer covers the bytes — refused
    bytes[20] ^= 0x01;
    let err = resolve_did(&s.did, &s.genesis_bytes, &[bytes], None).unwrap_err();
    assert!(matches!(
        err,
        SuccessionError::InvalidSignature { .. } | SuccessionError::Cbor(_)
    ));
}

#[test]
fn the_wrong_key_signing_refuses() {
    let s = scenario();
    // signed by r2's bytes but claiming r1's index
    let (_, bytes) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r2,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[bytes], None),
        Err(SuccessionError::InvalidSignature {
            seq: 1,
            signed_by: 1
        })
    ));
}

#[test]
fn a_revoked_key_cannot_rotate_after_its_removal() {
    let s = scenario();
    // seq 1 by r0 rotates the keyset to ONLY r_new — r1 and r2 die here
    let r_new = TestKey::ml(0x99);
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        0,
        vec![r_new.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r0,
    );
    let h1 = op1.hash().unwrap();
    // seq 2 claims index 1 (r1's old slot) — but index 1 now names
    // nothing (the new keyset has one key), so this is Unauthorized; and
    // the same test with index 0 is the revoked-key signature death
    let (_, b2_unauth) = signed_rotate(
        2,
        h1,
        T0 + 10,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1, // the REVOKED key signs
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1.clone(), b2_unauth], None),
        Err(SuccessionError::Unauthorized {
            seq: 2,
            signed_by: 1
        })
    ));
    // index 0 exists but names r_new, not r0 — r0's signature fails there
    let (_, b2_dead) = signed_rotate(
        2,
        h1,
        T0 + 10,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r0, // the REVOKED key signs, claiming the surviving index
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1.clone(), b2_dead], None),
        Err(SuccessionError::InvalidSignature {
            seq: 2,
            signed_by: 0
        })
    ));
    // the honest continuation verifies
    let (_, b2_ok) = signed_rotate(
        2,
        h1,
        T0 + 10,
        0,
        vec![r_new.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &r_new,
    );
    let r = resolve_did(&s.did, &s.genesis_bytes, &[b1, b2_ok], None).unwrap();
    assert_eq!(r.head.seq, 2);
}

// ------------------------------------------------------------------
// Expiry and time
// ------------------------------------------------------------------

#[test]
fn an_op_signed_at_or_after_the_state_expiry_refuses() {
    let s = scenario();
    let (_, b_at_edge) = signed_rotate(
        1,
        s.genesis_hash,
        V1, // at == validUntil — the boundary refuses
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1 + 100,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b_at_edge], None),
        Err(SuccessionError::SignedAfterExpiry {
            seq: 1,
            at: V1,
            valid_until: V1
        })
    ));
    let (_, b_after) = signed_rotate(
        1,
        s.genesis_hash,
        V1 + 1,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1 + 100,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b_after], None),
        Err(SuccessionError::SignedAfterExpiry { .. })
    ));
}

#[test]
fn time_may_not_go_backwards_along_a_chain() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0 + 1000,
        1,
        vec![s.r1.card(), s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    let (_, b2) = signed_rotate(
        2,
        h1,
        T0 + 500, // earlier than op1's at
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1, b2], None),
        Err(SuccessionError::TimeWentBackwards {
            seq: 2,
            at: _,
            previous_at: _
        })
    ));
}

// ------------------------------------------------------------------
// Replay, duplicates, rollback
// ------------------------------------------------------------------

#[test]
fn byte_identical_replays_dedup_silently() {
    let s = scenario();
    let (_, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let r = resolve_did(
        &s.did,
        &s.genesis_bytes,
        &[b1.clone(), b1.clone(), b1.clone()],
        None,
    )
    .unwrap();
    assert_eq!(r.head.seq, 1);
    assert_eq!(r.applied.len(), 1, "a replayed byte-identical op is one op");
}

#[test]
fn a_head_below_the_callers_floor_refuses_as_rollback() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r1.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    let (op2, b2) = signed_rotate(
        2,
        h1,
        T0 + 10,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let _ = op2;
    // the caller once verified seq 3; the handed log stops at 2
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1.clone(), b2.clone()], Some(3)),
        Err(SuccessionError::Rollback {
            floor: 3,
            head_seq: 2
        })
    ));
    // floor == head is fine — the floor is "at least this far"
    assert!(resolve_did(&s.did, &s.genesis_bytes, &[b1, b2], Some(2)).is_ok());
}

// ------------------------------------------------------------------
// Gaps, foreign ops, broken chains
// ------------------------------------------------------------------

#[test]
fn a_missing_middle_op_is_withholding() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r1.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    let (op2, b2) = signed_rotate(
        2,
        h1,
        T0 + 10,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h2 = op2.hash().unwrap();
    let (_, b3) = signed_rotate(
        3,
        h2,
        T0 + 20,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r2,
    );
    // op2 withheld: evidence of a longer chain that cannot be verified
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1.clone(), b3.clone()], None),
        Err(SuccessionError::Withholding {
            head_seq: 1,
            evidence_seq: 3
        })
    ));
    // the complete evidence resolves — recovery upon completeness
    let r = resolve_did(&s.did, &s.genesis_bytes, &[b1, b2, b3], None).unwrap();
    assert_eq!(r.head.seq, 3);
}

#[test]
fn a_foreign_prev_is_unchained_beyond_the_head_is_withholding() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r1.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    let (_, b2) = signed_rotate(
        2,
        h1,
        T0 + 10,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    // an op AT the head's seq whose prev hashes nothing handed: its
    // claimed position is already decided, so it is foreign or corrupt
    let (_, foreign) = signed_rotate(
        2,
        [0xEE; 32], // chains to nothing handed
        T0,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(
            &s.did,
            &s.genesis_bytes,
            &[b1.clone(), b2.clone(), foreign],
            None
        ),
        Err(SuccessionError::Unchained { seq: 2 })
    ));
    // an unexplained op BEYOND the head is withholding-shaped even when
    // its prev is garbage: this log may simply be longer than handed
    let (_, beyond) = signed_rotate(
        9,
        [0xEE; 32],
        T0,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1, b2, beyond], None),
        Err(SuccessionError::Withholding {
            head_seq: 2,
            evidence_seq: 9
        })
    ));
}

#[test]
fn a_seq_that_disagrees_with_its_prev_target_is_a_broken_chain() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r1.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let h1 = op1.hash().unwrap();
    // seq 3, but prev points at the seq-1 state — reordering garbage
    let (_, b3) = signed_rotate(
        3,
        h1,
        T0 + 10,
        0,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b1.clone(), b3.clone()], None),
        Err(SuccessionError::BrokenChain {
            seq: 3,
            prev_pointed_seq: 1
        })
    ));
}

// ------------------------------------------------------------------
// The arbitration law — the architecture's hardest named piece
// ------------------------------------------------------------------

#[test]
fn two_ops_same_seq_different_priority_the_lower_index_wins() {
    let s = scenario();
    // r1 (index 1) rotates to keyset X; r0 (index 0) rotates to keyset Y
    let x = TestKey::ed(0x71);
    let y = TestKey::ml(0x72);
    let (op_r1, b_r1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![x.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let (op_r0, b_r0) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        0,
        vec![y.card()],
        TestKey::ed(0x5F).card(),
        V1,
        &s.r0,
    );

    // r1 alone governs
    let only_r1 = resolve_did(&s.did, &s.genesis_bytes, std::slice::from_ref(&b_r1), None).unwrap();
    assert_eq!(only_r1.head.rotation_keys, vec![x.card()]);

    // both handed — r0 wins REGARDLESS of order, and r1's op is evidence
    for order in [
        vec![b_r1.clone(), b_r0.clone()],
        vec![b_r0.clone(), b_r1.clone()],
    ] {
        let r = resolve_did(&s.did, &s.genesis_bytes, &order, None).unwrap();
        assert_eq!(
            r.head.rotation_keys,
            vec![y.card()],
            "index 0 outranks index 1"
        );
        assert_eq!(r.lost_forks.len(), 1);
        assert_eq!(r.lost_forks[0].seq, 1);
        assert_eq!(r.lost_forks[0].signed_by, 1);
        assert_eq!(r.lost_forks[0].bytes, b_r1);
    }
    let _ = (op_r1, op_r0);
}

#[test]
fn same_index_two_different_ops_is_equivocation() {
    let s = scenario();
    let (_, b_a) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x71).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let (_, b_b) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x72).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &s.r1, // the SAME key, a DIFFERENT successor
    );
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[b_a, b_b], None),
        Err(SuccessionError::Equivocation {
            seq: 1,
            signed_by: 1
        })
    ));
}

#[test]
fn lower_index_equivocation_below_a_higher_index_winner_is_evidence_not_fatal() {
    let s = scenario();
    // r1 equivocates (two ops at index 1) while r0 speaks once at index 0
    let (_, b_r1a) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x71).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let (_, b_r1b) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x72).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &s.r1,
    );
    let (op_r0, b_r0) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        0,
        vec![s.r0.card()],
        TestKey::ed(0x60).card(),
        V1,
        &s.r0,
    );
    let r = resolve_did(&s.did, &s.genesis_bytes, &[b_r1a, b_r1b, b_r0], None).unwrap();
    assert_eq!(r.head.seq, 1);
    assert_eq!(r.head.rotation_keys, vec![s.r0.card()], "index 0 governs");
    assert_eq!(
        r.lost_forks.len(),
        2,
        "both index-1 ops are recorded evidence"
    );
    let _ = op_r0;
}

#[test]
fn a_thief_extends_a_stolen_fork_forever_and_still_loses() {
    let s = scenario();
    // the thief holds r1 and builds a LONG fork; the owner holds r0
    let (op1_thief, b1_thief) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x71).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let thief2 = TestKey::ed(0x71);
    let (op2_thief, b2_thief) = signed_rotate(
        2,
        op1_thief.hash().unwrap(),
        T0 + 10,
        0,
        vec![TestKey::ed(0x73).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &thief2,
    );
    let thief3 = TestKey::ed(0x73);
    let (_, b3_thief) = signed_rotate(
        3,
        op2_thief.hash().unwrap(),
        T0 + 20,
        0,
        vec![TestKey::ed(0x74).card()],
        TestKey::ed(0x60).card(),
        V1,
        &thief3,
    );
    // the owner's r0 speaks LAST and at seq 1 — priority, not longest-chain
    let recovered = TestKey::ml(0x80);
    let (op1_owner, b1_owner) = signed_rotate(
        1,
        s.genesis_hash,
        T0 + 30,
        0,
        vec![recovered.card()],
        TestKey::ed(0x61).card(),
        V1,
        &s.r0,
    );
    let (_op2_owner, b2_owner) = signed_rotate(
        2,
        op1_owner.hash().unwrap(),
        T0 + 40,
        0,
        vec![recovered.card()],
        TestKey::ed(0x62).card(),
        V1,
        &recovered,
    );

    // the wallet that ONLY ever saw the thief's fork resolved head 3 …
    let thief_view = resolve_did(
        &s.did,
        &s.genesis_bytes,
        &[b1_thief.clone(), b2_thief.clone(), b3_thief.clone()],
        None,
    )
    .unwrap();
    assert_eq!(thief_view.head.seq, 3);

    // … the full evidence elects the owner's SHORTER branch, and the
    // thief's whole verified fork rides home as evidence
    let full = resolve_did(
        &s.did,
        &s.genesis_bytes,
        &[
            b1_thief.clone(),
            b2_thief.clone(),
            b3_thief.clone(),
            b1_owner.clone(),
            b2_owner.clone(),
        ],
        None,
    )
    .unwrap();
    assert_eq!(
        full.head.seq, 2,
        "priority arbitration is not longest-chain"
    );
    assert_eq!(full.head.rotation_keys, vec![recovered.card()]);
    assert_eq!(full.lost_forks.len(), 3);

    // … and a wallet whose floor was set by the thief's head is REFUSED
    // quietly-free resolution: the rollback is named, the evidence is in hand
    assert!(matches!(
        resolve_did(
            &s.did,
            &s.genesis_bytes,
            &[
                b1_thief.clone(),
                b2_thief.clone(),
                b3_thief.clone(),
                b1_owner.clone(),
                b2_owner.clone()
            ],
            Some(3)
        ),
        Err(SuccessionError::Rollback {
            floor: 3,
            head_seq: 2
        })
    ));
}

// ------------------------------------------------------------------
// Determinism and identity
// ------------------------------------------------------------------

#[test]
fn resolution_is_order_independent_across_all_permutations() {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ml(0xD1).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let d1 = TestKey::ml(0xD1);
    let (op2, b2) = signed_rotate(
        2,
        op1.hash().unwrap(),
        T0 + 10,
        0,
        vec![TestKey::ed(0xE1).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &d1,
    );
    let e1 = TestKey::ed(0xE1);
    let (op3, b3) = signed_rotate(
        3,
        op2.hash().unwrap(),
        T0 + 20,
        0,
        vec![TestKey::ml(0xF1).card()],
        TestKey::ed(0x60).card(),
        V1,
        &e1,
    );
    // an unrelated LOSER rides along from seq 1
    let (_, b_loser) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        2,
        vec![TestKey::ed(0x74).card()],
        TestKey::ed(0x61).card(),
        V1,
        &s.r2,
    );
    let _ = op3;

    let bytes = [b1.clone(), b2.clone(), b3.clone(), b_loser.clone()];
    let mut perms = Vec::new();
    heap_permute(&bytes, &mut perms);
    let first = resolve_did(&s.did, &s.genesis_bytes, &perms[0], None).unwrap();
    for p in &perms[1..] {
        let r = resolve_did(&s.did, &s.genesis_bytes, p, None).unwrap();
        assert_eq!(r.head, first.head, "the head is order independent");
        assert_eq!(r.applied, first.applied);
        assert_eq!(r.lost_forks, first.lost_forks);
    }
    assert_eq!(first.head.seq, 3);
    assert_eq!(first.lost_forks.len(), 1);
}

fn heap_permute(items: &[Vec<u8>], out: &mut Vec<Vec<Vec<u8>>>) {
    let mut a = items.to_vec();
    let n = a.len();
    let mut c = vec![0usize; n];
    out.push(a.clone());
    let mut i = 0;
    while i < n {
        if c[i] < i {
            if i % 2 == 0 {
                a.swap(0, i);
            } else {
                a.swap(c[i], i);
            }
            out.push(a.clone());
            c[i] += 1;
            i = 0;
        } else {
            c[i] = 0;
            i += 1;
        }
    }
}

#[test]
fn the_genesis_is_still_the_root_and_still_self_certifying() {
    let s = scenario();
    // a tampered genesis under the same did refuses before any op is read
    let mut g = s.genesis_bytes.clone();
    g[5] ^= 0x01;
    assert!(matches!(
        resolve_did(&s.did, &g, &[], None),
        Err(SuccessionError::Genesis(_))
    ));
    // a neighbour did refuses
    let neighbour = {
        let mut n = s.did.as_str().to_string();
        let idx = "did:b:".len() + 7;
        n.replace_range(
            idx..idx + 1,
            if n.as_bytes()[idx] == b'a' { "b" } else { "a" },
        );
        BzDid::parse(&n).unwrap()
    };
    let (_, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    assert!(matches!(
        resolve_did(&neighbour, &s.genesis_bytes, &[b1], None),
        Err(SuccessionError::Genesis(
            bzdid::BzDidError::DidMismatch { .. }
        ))
    ));
    // seq 1's prev IS the genesis digest — the did's own 32-byte body
    let body = s.did.as_str().trim_start_matches("did:b:");
    let decoded = bzdid::did::decode_base32(body).unwrap();
    assert_eq!(&decoded[..], &s.genesis_hash[..]);
}

// ------------------------------------------------------------------
// The state type is honestly constructible by readers
// ------------------------------------------------------------------

#[test]
fn did_state_reports_validity_at_the_callers_clock() {
    let s = scenario();
    let st = DidState::from_genesis(&s.genesis, &s.genesis_bytes);
    assert_eq!(st.seq, 0);
    assert!(st.valid_at(V1 - 1));
    assert!(!st.valid_at(V1));
}

// ------------------------------------------------------------------
// The canonical-encoding law (review MINOR-1/2)
// ------------------------------------------------------------------

#[test]
fn a_non_canonical_reencoding_of_a_valid_op_refuses_at_the_door() {
    // the attack: a KEYLESS peer takes an honest op's parsed value and
    // re-encodes it with shuffled map keys. The bytes decode to the same
    // op (the decoder reads any order) — without this law, that twin
    // would chain on the canonical-rebuild hash, fork BEELOG roots
    // across resolvers, and mint an Equivocation from ONE signature.
    let s = scenario();
    let (op, canonical) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let _ = op;

    // build the shuffled twin by hand: decode, then re-frame the same
    // entries in REVERSED order at the byte level (the public encoder
    // always canonicalizes, so the map frame is hand-rolled; each entry
    // alone encodes deterministically)
    use bzdid::dagcbor::{self, DagValue};
    let v = dagcbor::decode(&canonical).unwrap();
    let DagValue::Map(entries) = v else {
        panic!("op is a map")
    };
    let mut twin = vec![0xA0 | entries.len() as u8]; // map(n) — head only
    for (k, val) in entries.iter().rev() {
        twin.extend(dagcbor::encode(&DagValue::text(k)));
        twin.extend(dagcbor::encode(val));
    }

    assert_ne!(twin, canonical, "the twin really is different bytes");
    // the SURFACE existed: the dag-cbor layer decodes any key order …
    assert!(dagcbor::decode(&twin).is_ok());
    // … and the DOOR holds: the op parser refuses the non-canonical
    // form, so no resolver ever hashes a second encoding of one op
    let err = RotateOp::parse(&twin).unwrap_err();
    assert!(
        matches!(err, SuccessionError::NotARotateOp(_)),
        "got {err:?}"
    );
    // and in resolution — in isolation AND alongside its honest twin
    // (no Equivocation gift for the keyless)
    let err = resolve_did(&s.did, &s.genesis_bytes, &[twin.clone()], None).unwrap_err();
    assert!(
        matches!(err, SuccessionError::NotARotateOp(_)),
        "got {err:?}"
    );
    let err = resolve_did(&s.did, &s.genesis_bytes, &[canonical.clone(), twin], None).unwrap_err();
    assert!(
        matches!(err, SuccessionError::NotARotateOp(_)),
        "got {err:?}"
    );
}
