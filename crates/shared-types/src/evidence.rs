//! General Evidence primitive — promoted from dispute-engine per BIND-1 K-6.
//!
//! `Evidence` is the kernel's universal type for a provenance-stamped claim.
//! It was born in dispute-engine (where it carried `favors: Side`); BIND-1
//! promotes it to `shared-types` as the **general primitive** so the
//! `sense-atproto` seam and other adapters can produce Evidence that crosses
//! the bus alongside Events.
//!
//! The seam extensions (`subject_did`, `source_ref`, `validator_digest`,
//! `view_grade`) are the fields BIND-1 K-6 adds to support the social-layer
//! boundary. Dispute-engine wraps this type, restoring `favors` as a
//! domain-specific field.
//!
//! Weight bases are **policy, revisable, never doctrine** (BIND-1 §7).
//! `SignedSelfAttestation` base weight = 0.55 (G-1, closed 2026-07-11).

use serde::{Deserialize, Serialize};

/// SHA-256 digest — the hash type used throughout the kernel for evidence
/// payloads and validator digests.
pub type Hash = [u8; 32];

/// Evidence source class (§5 provenance field).
///
/// `SignedSelfAttestation` is new per BIND-1 K-6: a cid-pinned,
/// commit-signed, validator-green human claim. `UserClaim` remains the word
/// for unsigned assertion. Machine publications reuse `AiInference` exactly
/// as Article III pre-wired it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Provenance {
    UserClaim,
    DeviceAttestation,
    CarrierApi,
    ChainProof,
    AiInference,
    /// BIND-1 K-6: cid-pinned, commit-signed, validator-green human claim.
    SignedSelfAttestation,
}

impl Provenance {
    /// Policy base weight for this provenance class.
    ///
    /// These are **policy** (revisable at the dispute-engine review tier),
    /// **never doctrine** (BIND-1 §7). The modifiers (`signed`, `verified`,
    /// `view_grade`) raise the effective weight contextually from here.
    pub fn base_weight(self) -> f32 {
        match self {
            Provenance::ChainProof => 0.95,
            Provenance::DeviceAttestation => 0.90,
            Provenance::CarrierApi => 0.85,
            Provenance::AiInference => 0.60,
            // G-1: below AiInference (0.60), above UserClaim (0.30).
            // Cryptography proves *who said it and that it hasn't changed*,
            // never *that it is true*.
            Provenance::SignedSelfAttestation => 0.55,
            Provenance::UserClaim => 0.30,
        }
    }

    /// High-provenance classes may auto-enforce; claims and AI may not.
    /// `SignedSelfAttestation` is not high — a self-interested claim never
    /// auto-enforces on its own, even signed.
    pub fn is_high(self) -> bool {
        matches!(
            self,
            Provenance::ChainProof | Provenance::DeviceAttestation | Provenance::CarrierApi
        )
    }
}

/// Trust grade for social-layer evidence (BIND-1 K-5/K-7).
///
/// Grades are **monotonic** — they only ever rise (K-7). A re-witness never
/// duplicates an Event; it raises `view_grade`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ViewGrade {
    /// Predicate pass, single source. May inform Knowledge, Reputation inputs.
    Informational,
    /// Predicate pass + independent re-witness (second disjoint source or
    /// direct PDS read-back). Everything above, plus non-settlement automation.
    Confirmed,
    /// Confirmed + DID's PLC op-log verified across ≥2 independent views +
    /// bidirectional `did:plc ↔ did:autonomi` binding. May participate in
    /// money-adjacent computation.
    Settlement,
}

impl Default for ViewGrade {
    /// Evidence enters at informational grade and only rises (K-7).
    fn default() -> Self {
        ViewGrade::Informational
    }
}

/// The general Evidence primitive (BIND-1 K-6).
///
/// Core fields (`provenance`, `confidence`, `signed`, `verified`,
/// `payload_hash`) are the original dispute-engine shape. Seam extensions
/// (`subject_did`, `source_ref`, `validator_digest`, `view_grade`) support
/// the social-layer boundary where Evidence rides in an Event payload on the
/// one bus.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Evidence {
    /// Source class of this evidence item.
    pub provenance: Provenance,
    /// The producing adapter's own confidence in this item, in [0, 1].
    pub confidence: f32,
    /// Whether the source was cryptographically signed.
    pub signed: bool,
    /// Whether a verification check passed.
    pub verified: bool,
    /// SHA-256 of the evidence payload.
    pub payload_hash: Hash,

    // --- Seam extensions (BIND-1 K-6) ---
    /// The DID this evidence is about (the subject, not necessarily the
    /// signer).
    #[serde(default)]
    pub subject_did: Option<String>,
    /// Canonical reference to the source (e.g.
    /// `at://<did>/<collection>/<rkey>#<cid>`).
    #[serde(default)]
    pub source_ref: Option<String>,
    /// Digest of the product validator that passed on this evidence (K-4
    /// step 3: validator digest recorded in provenance).
    #[serde(default)]
    pub validator_digest: Option<Hash>,
    /// Trust grade — informational / confirmed / settlement (K-5/K-7).
    /// Monotonic: only rises.
    #[serde(default)]
    pub view_grade: ViewGrade,
}

impl Evidence {
    /// Effective weight: base provenance weight, +0.05 if signed, +0.05 if
    /// verified (capped 0.99), × the provider's own confidence.
    ///
    /// This is the same formula dispute-engine v1 used; it now lives on the
    /// general primitive so every consumer computes weight the same way.
    pub fn effective_weight(&self) -> f32 {
        let mut w = self.provenance.base_weight();
        if self.signed {
            w += 0.05;
        }
        if self.verified {
            w += 0.05;
        }
        w.min(0.99) * self.confidence.clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- Provenance weights (policy, not doctrine) -----------------------

    #[test]
    fn provenance_weights_are_ordered_as_specified() {
        assert!(Provenance::ChainProof.base_weight() > Provenance::DeviceAttestation.base_weight());
        assert!(Provenance::DeviceAttestation.base_weight() > Provenance::CarrierApi.base_weight());
        // G-1: SignedSelfAttestation is below AiInference, above UserClaim.
        assert!(
            Provenance::AiInference.base_weight() > Provenance::SignedSelfAttestation.base_weight()
        );
        assert!(
            Provenance::SignedSelfAttestation.base_weight() > Provenance::UserClaim.base_weight()
        );
    }

    #[test]
    fn signed_self_attestation_base_weight_is_55() {
        assert_eq!(Provenance::SignedSelfAttestation.base_weight(), 0.55);
    }

    #[test]
    fn signed_self_attestation_is_not_high_provenance() {
        // A self-interested claim never auto-enforces on its own, even signed.
        assert!(!Provenance::SignedSelfAttestation.is_high());
    }

    #[test]
    fn ai_inference_is_not_high_provenance() {
        assert!(!Provenance::AiInference.is_high());
    }

    #[test]
    fn user_claim_is_not_high_provenance() {
        assert!(!Provenance::UserClaim.is_high());
    }

    // ---- ViewGrade monotonicity (K-7) ------------------------------------

    #[test]
    fn view_grade_ordering_is_monotonic() {
        assert!(ViewGrade::Informational < ViewGrade::Confirmed);
        assert!(ViewGrade::Confirmed < ViewGrade::Settlement);
    }

    #[test]
    fn view_grade_default_is_informational() {
        assert_eq!(ViewGrade::default(), ViewGrade::Informational);
    }

    // ---- Evidence seam extension fields ----------------------------------

    #[test]
    fn evidence_has_seam_extensions() {
        let e = Evidence {
            provenance: Provenance::SignedSelfAttestation,
            confidence: 0.8,
            signed: true,
            verified: true,
            payload_hash: [0xab; 32],
            subject_did: Some("did:plc: performer".into()),
            source_ref: Some(
                "at://did:plc:abc/social.skaists.alpha.performance.set/rkey#cid123".into(),
            ),
            validator_digest: Some([0xcd; 32]),
            view_grade: ViewGrade::Confirmed,
        };
        // Seam extensions are present and correct.
        assert_eq!(e.subject_did.as_deref(), Some("did:plc: performer"));
        assert!(e.source_ref.as_ref().unwrap().starts_with("at://"));
        assert_eq!(e.validator_digest, Some([0xcd; 32]));
        assert_eq!(e.view_grade, ViewGrade::Confirmed);
    }

    #[test]
    fn evidence_seam_extensions_are_optional_and_default() {
        // Minimal evidence without seam extensions — e.g. dispute-engine
        // evidence that pre-dates the social seam.
        let e = Evidence {
            provenance: Provenance::ChainProof,
            confidence: 1.0,
            signed: true,
            verified: false,
            payload_hash: [0; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::default(),
        };
        assert!(e.subject_did.is_none());
        assert!(e.source_ref.is_none());
        assert!(e.validator_digest.is_none());
        assert_eq!(e.view_grade, ViewGrade::Informational);
    }

    // ---- Effective weight formula ----------------------------------------

    #[test]
    fn effective_weight_matches_dispute_engine_formula() {
        let e = Evidence {
            provenance: Provenance::CarrierApi,
            confidence: 1.0,
            signed: true,
            verified: true,
            payload_hash: [0; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::Informational,
        };
        // 0.85 + 0.05 + 0.05 = 0.95, capped at 0.99, × 1.0
        assert!((e.effective_weight() - 0.95).abs() < f32::EPSILON);
    }

    #[test]
    fn effective_weight_caps_at_99() {
        let e = Evidence {
            provenance: Provenance::ChainProof, // 0.95
            confidence: 1.0,
            signed: true,   // +0.05
            verified: true, // +0.05
            payload_hash: [0; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::Informational,
        };
        // 0.95 + 0.05 + 0.05 = 1.05, capped at 0.99
        assert!((e.effective_weight() - 0.99).abs() < f32::EPSILON);
    }

    // ---- Serialization ----------------------------------------------------

    #[test]
    fn evidence_with_seam_extensions_roundtrips_through_json() {
        let e = Evidence {
            provenance: Provenance::SignedSelfAttestation,
            confidence: 0.7,
            signed: true,
            verified: false,
            payload_hash: [1; 32],
            subject_did: Some("did:plc:musician".into()),
            source_ref: Some("at://did:plc:abc/coll/rkey#cid".into()),
            validator_digest: Some([2; 32]),
            view_grade: ViewGrade::Settlement,
        };
        let json = serde_json::to_string(&e).unwrap();
        let back: Evidence = serde_json::from_str(&json).unwrap();
        assert_eq!(e, back);
    }

    #[test]
    fn evidence_without_seam_extensions_roundtrips_through_json() {
        let e = Evidence {
            provenance: Provenance::UserClaim,
            confidence: 0.5,
            signed: false,
            verified: false,
            payload_hash: [3; 32],
            subject_did: None,
            source_ref: None,
            validator_digest: None,
            view_grade: ViewGrade::Informational,
        };
        let json = serde_json::to_string(&e).unwrap();
        let back: Evidence = serde_json::from_str(&json).unwrap();
        assert_eq!(e, back);
    }

    #[test]
    fn provenance_all_variants_roundtrip_through_json() {
        let all = [
            Provenance::UserClaim,
            Provenance::DeviceAttestation,
            Provenance::CarrierApi,
            Provenance::ChainProof,
            Provenance::AiInference,
            Provenance::SignedSelfAttestation,
        ];
        for p in all {
            let json = serde_json::to_string(&p).unwrap();
            let back: Provenance = serde_json::from_str(&json).unwrap();
            assert_eq!(p, back, "lossy roundtrip for {json}");
        }
    }
}
