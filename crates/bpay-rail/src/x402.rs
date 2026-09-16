//! The x402 door wired into the EVM compose boundary (R12).
//!
//! This is the ESTATE door (bsigner/x402.rs law, read in-tree R9):
//! the organ refuses offers BEFORE signing, never after; caps live in
//! the member's hand (a policy this gate READS and never writes);
//! offers are only gateable as PINNED seller-signed envelopes —
//! destination and seller-key are inseparable in the allowlist row;
//! hard per-signature ceiling; buyer signs and never submits.
//!
//! SCOPE of this module (skeleton): POLICY EVALUATION + the compose
//! handoff into the unified rail ledger. Seller-signature
//! VERIFICATION and the one-signature split stay with bsigner/organ
//! at build time — nothing here signs, submits, or talks to a network.
//! The rail ledger remains THE ONLY state machine (no duplicate).

use crate::evm::EvmPaymentId;
use crate::ledger::LedgerError;
use watchpay::abi::keccak256;
use watchpay::types::Atto;

/// One pinned allowlist row (bsigner law): the destination is never
/// separable from the seller key pinned with it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AllowEntry {
    pub pay_to: String,
    pub rail: Option<String>,
    pub seller_key_id: String,
}

/// The member's policy: read by the gate, never written by it.
#[derive(Debug, Clone)]
pub struct OfferPolicy {
    /// Hard per-signature ceiling (bsigner default shape: $1-class).
    pub per_signature_cap: Atto,
    /// Rolling-window AMOUNT ceiling (the spend cap beside the fee
    /// window; both live in the member's hand).
    pub window_amount_ceiling: Atto,
    pub allowlist: Vec<AllowEntry>,
}

/// A pinned offer as it arrives for gating: canonical bytes (the
/// signed envelope's payload — verification happened at the organ),
/// destination, pinned seller key id, amount, asset.
///
/// Signature verification is NOT here: the organ (bsigner) verifies
/// the envelope offline before an offer reaches this gate. An offer
/// without a verified envelope never becomes a `PinnedOffer`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PinnedOffer {
    pub canonical_bytes: Vec<u8>,
    pub pay_to: String,
    pub seller_key_id: String,
    pub amount: Atto,
    pub asset: String,
}

/// The pre-signature GATE (bsigner law: refuse before signing).
/// Checks, each a named refusal:
/// 1. allowlist pair — pay_to AND seller_key_id must match one row
///    (inseparability: an allowlisted destination cannot be paid under
///    a stranger's signature);
/// 2. per-signature cap;
/// 3. window amount ceiling.
pub fn gate(policy: &OfferPolicy, offer: &PinnedOffer) -> Result<(), LedgerError> {
    let pinned = policy
        .allowlist
        .iter()
        .any(|e| e.pay_to == offer.pay_to && e.seller_key_id == offer.seller_key_id);
    if !pinned {
        return Err(LedgerError::Refusal {
            field: "allowlist",
            reason: format!(
                "offer destination {} is not pinned with seller key {} — destination and seller key are inseparable (bsigner law)",
                offer.pay_to, offer.seller_key_id
            ),
        });
    }
    if offer.amount > policy.per_signature_cap {
        return Err(LedgerError::Refusal {
            field: "per_signature_cap",
            reason: format!(
                "offer amount {} exceeds the hard per-signature cap {} — the organ refuses BEFORE signing",
                offer.amount, policy.per_signature_cap
            ),
        });
    }
    if offer.amount > policy.window_amount_ceiling {
        return Err(LedgerError::Refusal {
            field: "window_amount_ceiling",
            reason: format!(
                "offer amount {} exceeds the window amount ceiling {} (member's hand)",
                offer.amount, policy.window_amount_ceiling
            ),
        });
    }
    Ok(())
}

/// Deterministic payment identity for a gated offer: keccak256 of the
/// canonical offer bytes. THE ONE-SIGNATURE SPLIT'S NATURAL
/// IDEMPOTENCY: the same signed offer body always derives the same id,
/// so a double-submitted offer hits the ledger's idempotency law
/// (route to lookup — never a second payment). R10-P4's x402 case,
/// closed by construction.
pub fn offer_id(offer: &PinnedOffer) -> EvmPaymentId {
    EvmPaymentId {
        nonce: 0, // pre-signature: the id is the OFFER hash until a tx exists
        tx_hash_hex: hex::encode(keccak256(&offer.canonical_bytes)),
    }
}

/// Wire the door into the EVM compose boundary: gate the offer, then
/// open an intent in the UNIFIED rail ledger (the only state machine).
/// The caller supplies the expiry (the offer's own validity window).
pub fn compose_from_offer(
    adapter: &mut crate::evm::EvmRailAdapter,
    policy: &OfferPolicy,
    offer: &PinnedOffer,
    expires_unix: u64,
) -> Result<EvmPaymentId, LedgerError> {
    gate(policy, offer)?;
    let id = offer_id(offer);
    adapter.open_intent(id.clone(), false, expires_unix)?;
    Ok(id)
}
