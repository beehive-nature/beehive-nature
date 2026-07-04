//! Tier-1 dispute adjudication — provenance-weighted, deterministic,
//! pure. Implements the §5 model: confidence is computed from evidence
//! *provenance*, never popularity; machine-attested evidence outranks
//! unverified user claims by design; conflict inside an evidence class
//! drops confidence and escalates to Tier 2 (a human) instead of
//! auto-enforcing.
//!
//! Scope seams (same discipline as `dro-signer`):
//! - [`resolve`] is a pure function `(&Dispute, &[Evidence]) → DisputeVerdict`.
//!   Everything that touches reality — AI inference, threshold-decrypted
//!   evidence vaults, carrier APIs — lives behind [`EvidenceProvider`];
//!   v1 ships [`MockProvider`]. No `todo!()` in shipped paths.
//! - The verdict's `split_ratio` is `(buyer_amount, seller_amount)` in
//!   atomic units, conservation-guaranteed, computed with integer math
//!   (money never rides floats). It feeds
//!   `dro_signer::settlement_intent_for_split`, retiring that crate's
//!   documented 50/50 default whenever a real verdict exists.
//!
//! One addition to the prompt's structs, forced by logic: evidence must
//! carry a direction ([`Evidence::favors`]) — there is no function from
//! undirected evidence to a verdict.
//!
//! ## Confidence model (deterministic, documented)
//! Each item's effective weight = provenance base weight, +0.05 if
//! `signed`, +0.05 if `verified` (capped 0.99), × the provider's own
//! `confidence` in the item. Bases: ChainProof 0.95, DeviceAttestation
//! 0.90, CarrierApi 0.85, AiInference 0.60, UserClaim 0.30 — AI is a
//! sense adapter, "never truth, never authority" (constitution), so it
//! can support but never auto-enforce on its own.
//! Verdict = the heavier side; overall confidence = (winning share of
//! total weight) × (peak effective weight on the winning side), halved
//! on any same-class conflict. `auto_enforce` requires confidence > 0.95
//! AND every winning-side item to be high-provenance (ChainProof /
//! DeviceAttestation / CarrierApi) AND no same-class conflict.

#![forbid(unsafe_code)]

use sha2::{Digest, Sha256};

pub type Hash = [u8; 32];

/// Who a piece of evidence supports.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Buyer,
    Seller,
}

/// Evidence source class (§5 provenance field; subset relevant to v1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provenance {
    UserClaim,
    DeviceAttestation,
    CarrierApi,
    ChainProof,
    AiInference,
}

impl Provenance {
    fn base_weight(self) -> f32 {
        match self {
            Provenance::ChainProof => 0.95,
            Provenance::DeviceAttestation => 0.90,
            Provenance::CarrierApi => 0.85,
            Provenance::AiInference => 0.60,
            Provenance::UserClaim => 0.30,
        }
    }

    /// High-provenance classes may auto-enforce; claims and AI may not.
    fn is_high(self) -> bool {
        matches!(
            self,
            Provenance::ChainProof | Provenance::DeviceAttestation | Provenance::CarrierApi
        )
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Evidence {
    pub provenance: Provenance,
    /// The producing adapter's own confidence in this item, in [0, 1].
    pub confidence: f32,
    pub signed: bool,
    pub verified: bool,
    pub payload_hash: Hash,
    /// Direction: which party this evidence supports.
    pub favors: Side,
}

impl Evidence {
    fn effective_weight(&self) -> f32 {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerdictType {
    RefundBuyer,
    ReleaseToSeller,
    Split,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DisputeVerdict {
    pub verdict: VerdictType,
    pub confidence: f32,
    /// `(buyer_amount, seller_amount)` atomic units, summing to the
    /// disputed amount. Present for `Split`, `None` otherwise.
    pub split_ratio: Option<(u64, u64)>,
    pub evidence_hashes: Vec<Hash>,
    /// sha256 over a canonical reasoning transcript (audit trail; the §5
    /// design anchors this for tamper-proofing).
    pub reasoning_hash: Hash,
    pub auto_enforce: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Dispute {
    pub order_id: String,
    pub buyer_did: String,
    pub seller_did: String,
    /// Disputed amount, atomic units of `asset_id`.
    pub amount: u64,
    pub asset_id: Option<String>,
    /// Unix seconds (matches the CanonicalEvent timestamp convention).
    pub opened_at: i64,
    pub reason_hash: Hash,
    /// Autonomi vault bucket references (opaque here; decryption is the
    /// provider's concern, behind the trait).
    pub evidence_bucket_refs: Vec<String>,
}

/// Tier-1 auto-enforcement gate (§5: "confidence > 0.95 && auto_enforce").
pub const AUTO_ENFORCE_THRESHOLD: f32 = 0.95;
/// Same-class conflicting evidence halves confidence and forces escalation.
const CONFLICT_PENALTY: f32 = 0.5;

/// Pure Tier-1 adjudication. Deterministic: same dispute + same evidence
/// → same verdict, bit for bit (ratio math is integer-only).
///
/// No evidence at all → `Split` 50/50 shape with confidence 0.0 and
/// `auto_enforce: false`: a pure Tier-2 handoff that decides nothing.
pub fn resolve(dispute: &Dispute, evidence: &[Evidence]) -> DisputeVerdict {
    // Weights per side, scaled to integer per-mille for the money math.
    let mut w_buyer = 0.0f32;
    let mut w_seller = 0.0f32;
    let mut peak_buyer = 0.0f32;
    let mut peak_seller = 0.0f32;

    for item in evidence {
        let w = item.effective_weight();
        match item.favors {
            Side::Buyer => {
                w_buyer += w;
                peak_buyer = peak_buyer.max(w);
            }
            Side::Seller => {
                w_seller += w;
                peak_seller = peak_seller.max(w);
            }
        }
    }

    // Same-class conflict: any provenance class with evidence on BOTH sides.
    let conflicted = has_same_class_conflict(evidence);

    let total = w_buyer + w_seller;
    let (verdict, share, peak) = if total == 0.0 {
        (VerdictType::Split, 0.0, 0.0)
    } else if w_seller == 0.0 {
        (VerdictType::RefundBuyer, 1.0, peak_buyer)
    } else if w_buyer == 0.0 {
        (VerdictType::ReleaseToSeller, 1.0, peak_seller)
    } else {
        // Both sides have support → split proportionally.
        let share = w_buyer.max(w_seller) / total;
        (VerdictType::Split, share, peak_buyer.max(peak_seller))
    };

    let mut confidence = share * peak;
    if conflicted {
        confidence *= CONFLICT_PENALTY;
    }

    // Auto-enforce: high confidence, winning side all high-provenance,
    // and no intra-class conflict. (§5 + constitution: AI and user claims
    // never auto-enforce.)
    let winning_side = match verdict {
        VerdictType::RefundBuyer => Some(Side::Buyer),
        VerdictType::ReleaseToSeller => Some(Side::Seller),
        VerdictType::Split => None, // splits always get a human look in v1
    };
    let winners_all_high = winning_side.is_some_and(|side| {
        evidence
            .iter()
            .filter(|e| e.favors == side)
            .all(|e| e.provenance.is_high())
    });
    let auto_enforce = confidence > AUTO_ENFORCE_THRESHOLD && winners_all_high && !conflicted;

    // Split ratio in integer math: buyer share in per-mille of the total
    // weight, conservation by construction (seller gets the remainder;
    // with zero evidence it degrades to 50/50).
    let split_ratio = match verdict {
        VerdictType::Split => {
            let buyer_permille: u64 = if total == 0.0 {
                500
            } else {
                ((w_buyer / total) * 1000.0).round() as u64
            };
            let buyer_amount = dispute.amount * buyer_permille / 1000;
            Some((buyer_amount, dispute.amount - buyer_amount))
        }
        _ => None,
    };

    DisputeVerdict {
        verdict,
        confidence,
        split_ratio,
        evidence_hashes: evidence.iter().map(|e| e.payload_hash).collect(),
        reasoning_hash: reasoning_hash(dispute, evidence, verdict, confidence),
        auto_enforce,
    }
}

fn has_same_class_conflict(evidence: &[Evidence]) -> bool {
    const CLASSES: [Provenance; 5] = [
        Provenance::UserClaim,
        Provenance::DeviceAttestation,
        Provenance::CarrierApi,
        Provenance::ChainProof,
        Provenance::AiInference,
    ];
    CLASSES.iter().any(|class| {
        let buyer = evidence
            .iter()
            .any(|e| e.provenance == *class && e.favors == Side::Buyer);
        let seller = evidence
            .iter()
            .any(|e| e.provenance == *class && e.favors == Side::Seller);
        buyer && seller
    })
}

/// Canonical, deterministic reasoning transcript → sha256 (audit anchor).
fn reasoning_hash(
    dispute: &Dispute,
    evidence: &[Evidence],
    verdict: VerdictType,
    confidence: f32,
) -> Hash {
    let mut h = Sha256::new();
    h.update(dispute.order_id.as_bytes());
    h.update(dispute.reason_hash);
    h.update(dispute.amount.to_le_bytes());
    for e in evidence {
        h.update([
            match e.provenance {
                Provenance::UserClaim => 0u8,
                Provenance::DeviceAttestation => 1,
                Provenance::CarrierApi => 2,
                Provenance::ChainProof => 3,
                Provenance::AiInference => 4,
            },
            e.favors as u8,
            u8::from(e.signed),
            u8::from(e.verified),
        ]);
        h.update(e.payload_hash);
        h.update(e.confidence.to_le_bytes());
    }
    h.update([match verdict {
        VerdictType::RefundBuyer => 0u8,
        VerdictType::ReleaseToSeller => 1,
        VerdictType::Split => 2,
    }]);
    h.update(confidence.to_le_bytes());
    h.finalize().into()
}

// ---------------------------------------------------------------------------
// The reality seam
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderError {
    /// The vault/bucket could not be read or decrypted.
    Unavailable(String),
}

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderError::Unavailable(why) => write!(f, "evidence unavailable: {why}"),
        }
    }
}

impl std::error::Error for ProviderError {}

/// Where evidence actually comes from: threshold-decrypted Autonomi
/// vaults, carrier tracking APIs, AI analyses. All of that is reality;
/// v1 mocks it. Real providers land as adapters (first: the carrier API).
pub trait EvidenceProvider {
    fn gather(&self, dispute: &Dispute) -> Result<Vec<Evidence>, ProviderError>;
}

/// v1 mock: returns a preloaded evidence set.
#[derive(Debug, Default)]
pub struct MockProvider {
    pub evidence: Vec<Evidence>,
}

impl EvidenceProvider for MockProvider {
    fn gather(&self, _dispute: &Dispute) -> Result<Vec<Evidence>, ProviderError> {
        Ok(self.evidence.clone())
    }
}

/// Convenience composition: gather then resolve.
pub fn adjudicate(
    dispute: &Dispute,
    provider: &impl EvidenceProvider,
) -> Result<DisputeVerdict, ProviderError> {
    Ok(resolve(dispute, &provider.gather(dispute)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dispute(amount: u64) -> Dispute {
        Dispute {
            order_id: "order-d1".into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            amount,
            asset_id: Some("fusd-asset-id".into()),
            opened_at: 1_782_000_000,
            reason_hash: [7; 32],
            evidence_bucket_refs: vec!["autonomi://vault/order-d1".into()],
        }
    }

    fn item(provenance: Provenance, favors: Side, signed: bool, verified: bool) -> Evidence {
        Evidence {
            provenance,
            confidence: 1.0,
            signed,
            verified,
            payload_hash: [match provenance {
                Provenance::UserClaim => 1,
                Provenance::DeviceAttestation => 2,
                Provenance::CarrierApi => 3,
                Provenance::ChainProof => 4,
                Provenance::AiInference => 5,
            }; 32],
            favors,
        }
    }

    // ---- verdict paths ---------------------------------------------------

    #[test]
    fn uncontradicted_high_provenance_auto_enforces() {
        // Carrier scan + device attestation, both for the seller, both
        // signed+verified: delivery proven → release.
        let ev = vec![
            item(Provenance::CarrierApi, Side::Seller, true, true),
            item(Provenance::DeviceAttestation, Side::Seller, true, true),
        ];
        let v = resolve(&dispute(1_000_000), &ev);
        assert_eq!(v.verdict, VerdictType::ReleaseToSeller);
        assert!(
            v.confidence > AUTO_ENFORCE_THRESHOLD,
            "conf {}",
            v.confidence
        );
        assert!(v.auto_enforce);
        assert_eq!(v.split_ratio, None);
        assert_eq!(v.evidence_hashes.len(), 2);
    }

    #[test]
    fn user_claims_alone_never_auto_enforce() {
        // Even uncontradicted, a bare claim escalates to a human.
        let ev = vec![item(Provenance::UserClaim, Side::Buyer, false, false)];
        let v = resolve(&dispute(1_000_000), &ev);
        assert_eq!(v.verdict, VerdictType::RefundBuyer);
        assert!(v.confidence < AUTO_ENFORCE_THRESHOLD);
        assert!(!v.auto_enforce);
    }

    #[test]
    fn ai_inference_supports_but_cannot_auto_enforce() {
        let ev = vec![item(Provenance::AiInference, Side::Seller, true, true)];
        let v = resolve(&dispute(1_000_000), &ev);
        assert_eq!(v.verdict, VerdictType::ReleaseToSeller);
        assert!(!v.auto_enforce, "AI is never authority (constitution)");
    }

    #[test]
    fn same_class_conflict_drops_confidence_and_escalates() {
        // Two carrier records disagreeing: equal class, opposite sides.
        let ev = vec![
            item(Provenance::CarrierApi, Side::Seller, true, true),
            item(Provenance::CarrierApi, Side::Buyer, true, true),
        ];
        let v = resolve(&dispute(1_000_000), &ev);
        assert_eq!(v.verdict, VerdictType::Split);
        assert!(!v.auto_enforce);
        assert!(
            v.confidence < 0.5,
            "conflict must halve an already-split confidence: {}",
            v.confidence
        );
    }

    #[test]
    fn no_evidence_is_a_pure_tier2_handoff() {
        let v = resolve(&dispute(1_000_001), &[]);
        assert_eq!(v.verdict, VerdictType::Split);
        assert_eq!(v.confidence, 0.0);
        assert!(!v.auto_enforce);
        // Degenerate 50/50 shape, conserving the odd unit.
        let (b, s) = v.split_ratio.unwrap();
        assert_eq!(b + s, 1_000_001);
    }

    // ---- provenance weighting --------------------------------------------

    #[test]
    fn same_payload_weighs_more_from_device_than_from_claim() {
        let device = resolve(
            &dispute(1_000_000),
            &[item(
                Provenance::DeviceAttestation,
                Side::Buyer,
                false,
                false,
            )],
        );
        let claim = resolve(
            &dispute(1_000_000),
            &[item(Provenance::UserClaim, Side::Buyer, false, false)],
        );
        assert_eq!(device.verdict, claim.verdict);
        assert!(
            device.confidence > claim.confidence,
            "provenance must outrank popularity: {} vs {}",
            device.confidence,
            claim.confidence
        );
    }

    #[test]
    fn many_user_claims_do_not_outrank_one_chain_proof_for_auto_enforce() {
        // Confidence is provenance-computed, never popularity-computed:
        // ten unverified claims for the buyer, one chain proof for the
        // seller. The claims may win raw weight, but they can never
        // auto-enforce — while the chain proof alone, uncontradicted in
        // class, would.
        let mut ev: Vec<Evidence> = (0..10)
            .map(|_| item(Provenance::UserClaim, Side::Buyer, false, false))
            .collect();
        ev.push(item(Provenance::ChainProof, Side::Seller, true, true));
        let v = resolve(&dispute(1_000_000), &ev);
        assert!(!v.auto_enforce, "popularity must never auto-enforce");
    }

    // ---- split conservation ------------------------------------------------

    #[test]
    fn split_ratio_conserves_exactly_and_follows_weight() {
        // Device attestation (buyer) vs user claim (seller): buyer-heavy.
        let ev = vec![
            item(Provenance::DeviceAttestation, Side::Buyer, true, true),
            item(Provenance::UserClaim, Side::Seller, false, false),
        ];
        let amount = 999_999_999_999_999u64; // large + odd: overflow & rounding guard
        let v = resolve(&dispute(amount), &ev);
        assert_eq!(v.verdict, VerdictType::Split);
        let (b, s) = v.split_ratio.unwrap();
        assert_eq!(b + s, amount, "conservation is non-negotiable");
        assert!(b > s, "weightier side gets the larger share");
    }

    // ---- determinism & the seam -------------------------------------------

    #[test]
    fn resolve_is_deterministic_including_reasoning_hash() {
        let ev = vec![item(Provenance::CarrierApi, Side::Seller, true, false)];
        let a = resolve(&dispute(5), &ev);
        let b = resolve(&dispute(5), &ev);
        assert_eq!(a, b);
    }

    #[test]
    fn adjudicate_composes_provider_and_resolve() {
        let provider = MockProvider {
            evidence: vec![item(Provenance::CarrierApi, Side::Seller, true, true)],
        };
        let v = adjudicate(&dispute(10), &provider).unwrap();
        assert_eq!(v.verdict, VerdictType::ReleaseToSeller);
    }
}
