//! Integration: a computed `ReputationScore` feeds the canonical
//! `ReputationUpdated` event — the engine's output speaks the bus's
//! language. The event carries a *delta* (reputation is emergent; the
//! event announces recomputation, it never IS the score), with the
//! recomputation's audit trail referenced via `basis_ref`.

use dispute_engine::{Provenance, Side, ViewGrade};
use reputation_engine::{compute, Attestation, ReputationInput, ReputationScore};
use shared_types::{EventPayload, ReputationEvent};

fn input(completed: u64, as_of: i64) -> ReputationInput {
    ReputationInput {
        did: "did:plc:subject".into(),
        completed_escrows: completed,
        disputed_escrows: 0,
        resolved_favorable: 0,
        evidence_submitted: vec![dispute_engine::Evidence {
            provenance: Provenance::ChainProof,
            confidence: 1.0,
            signed: true,
            verified: true,
            payload_hash: [3; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::Informational,
            favors: Side::Buyer,
        }],
        attestations_received: vec![Attestation {
            attester_did: "did:plc:peer".into(),
            attested_did: "did:plc:subject".into(),
            claim: "ships-fast".into(),
            timestamp: as_of - 50,
            signature_valid: true,
        }],
        as_of_unix: as_of,
    }
}

/// Map a recomputation to the canonical event payload.
fn to_event(prev: Option<&ReputationScore>, current: &ReputationScore) -> ReputationEvent {
    let before = prev.map(|p| p.score as i64).unwrap_or(0);
    ReputationEvent {
        subject_did: current.did.clone(),
        score_delta: current.score as i64 - before,
        // The audit trail: components carry per-source commitment hashes;
        // the event references the first (full trail rides the score
        // artifact itself, stored/anchored elsewhere).
        basis_ref: current.components.first().map(|c| c.evidence_hash.clone()),
    }
}

#[test]
fn recomputation_delta_serializes_as_the_canonical_payload() {
    let before = compute(&input(2, 1_782_100_000));
    let after = compute(&input(4, 1_782_200_000)); // two more completions

    let event = to_event(Some(&before), &after);
    assert_eq!(event.score_delta, 50, "two completions at +25");
    assert_eq!(event.subject_did, "did:plc:subject");
    assert!(event.basis_ref.is_some());

    // It IS the canonical payload: wraps and round-trips as one.
    let payload = EventPayload::Reputation(event.clone());
    let json = serde_json::to_string(&payload).unwrap();
    let back: EventPayload = serde_json::from_str(&json).unwrap();
    assert_eq!(back, payload);

    // And the score artifact itself serializes transparently (components
    // included) for storage/anchoring.
    let artifact = serde_json::to_string(&after).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&artifact).unwrap();
    assert_eq!(parsed["score"], after.score);
    assert!(parsed["components"].as_array().unwrap().len() >= 3);
}

#[test]
fn first_computation_delta_is_the_full_score() {
    let first = compute(&input(1, 1_782_100_000));
    let event = to_event(None, &first);
    assert_eq!(event.score_delta, first.score as i64);
}
