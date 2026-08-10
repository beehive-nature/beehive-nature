//! User-signed DataItem upload validation — PHASE0_AR_ANT_SETUP_SPEC step 5.
//!
//! Self-funded model (SPEC_SOVEREIGN_WALLET_FUNDING v3): the USER signs their own
//! DataItem and pays their own way; the relay only validates, routes, and (when a
//! forward target is configured) forwards. It never signs, never holds a key,
//! never pays. Validation is [`atmirror`]'s parser — signature verified over the
//! recomputed deep-hash, id recomputed, nothing trusted from the wire.

use atmirror::arweave::{parse_ed25519_data_item, ParseItemError};
use atmirror::route::{route, PayloadClass, RouteDecision};

/// Operational body cap for the skeleton (not a ruled number): a validation
/// endpoint with no size bound is a memory-DoS door. Generous against the
/// 256 KiB AR-routing crossover; revisit when bulk-to-Autonomi uploads move
/// through this endpoint rather than the ant client.
pub const MAX_ITEM_BYTES: usize = 12 * 1024 * 1024;

/// What the relay decided about one upload. `route` is advisory output for the
/// caller — Phase 0 forwards Arweave-routed items only.
#[derive(Debug, serde::Serialize)]
pub struct UploadDecision {
    /// Recomputed `base64url(sha256(sig))` — the DataItem id.
    pub id: String,
    /// Signer's public key, base64url (the ANS-104 owner).
    pub owner: String,
    pub item_bytes: usize,
    pub data_bytes: usize,
    /// "arweave" | "autonomi" | "arweave+autonomi-mirror"
    pub route: &'static str,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub enum UploadRefusal {
    /// Body exceeds [`MAX_ITEM_BYTES`]; names both numbers.
    TooLarge { got: usize, max: usize },
    /// Structural refusal — segment named by the parser.
    Malformed(String),
    /// Not an Ed25519 (type 2) item; carries the type that arrived.
    NotEd25519 { got: u16 },
    /// Signature did not verify — tampered or wrongly keyed.
    BadSignature,
}

/// Validate one raw DataItem body. Uploads through this endpoint are BULK by
/// class: identity/DID-log records travel the bDiD issuance pipeline, not this
/// generic endpoint, so the class override never applies here.
pub fn validate_upload(bytes: &[u8]) -> Result<UploadDecision, UploadRefusal> {
    if bytes.len() > MAX_ITEM_BYTES {
        return Err(UploadRefusal::TooLarge { got: bytes.len(), max: MAX_ITEM_BYTES });
    }
    let parsed = parse_ed25519_data_item(bytes).map_err(|e| match e {
        ParseItemError::Truncated(seg) => UploadRefusal::Malformed(seg.to_string()),
        ParseItemError::NotEd25519(t) => UploadRefusal::NotEd25519 { got: t },
        ParseItemError::BadSignature => UploadRefusal::BadSignature,
    })?;

    let decision = match route(PayloadClass::Bulk, parsed.item_len) {
        RouteDecision::Arweave => "arweave",
        RouteDecision::Autonomi => "autonomi",
        RouteDecision::ArweavePrimaryAutonomiMirror => "arweave+autonomi-mirror",
    };

    use base64::Engine as _;
    Ok(UploadDecision {
        id: parsed.id,
        owner: base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(parsed.owner),
        item_bytes: parsed.item_len,
        data_bytes: parsed.data_len,
        route: decision,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use atmirror::arweave::build_ed25519_data_item;
    use ed25519_dalek::SigningKey;

    fn item(data: &[u8]) -> Vec<u8> {
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        build_ed25519_data_item(&sk, data, &[]).1
    }

    #[test]
    fn valid_small_item_routes_to_arweave() {
        let d = validate_upload(&item(b"hello")).expect("valid");
        assert_eq!(d.route, "arweave");
        assert!(d.item_bytes < 256 * 1024);
    }

    #[test]
    fn large_item_routes_to_autonomi() {
        let big = vec![0u8; 300 * 1024]; // item > 256 KiB crossover
        let d = validate_upload(&item(&big)).expect("valid");
        assert_eq!(d.route, "autonomi");
    }

    #[test]
    fn refusals_are_typed_and_named() {
        // oversized body
        let r = validate_upload(&vec![0u8; MAX_ITEM_BYTES + 1]).unwrap_err();
        assert!(matches!(r, UploadRefusal::TooLarge { .. }));

        // wrong signature type
        let mut it = item(b"x");
        it[0] = 1;
        it[1] = 0;
        assert_eq!(validate_upload(&it).unwrap_err(), UploadRefusal::NotEd25519 { got: 1 });

        // tampered payload
        let mut it = item(b"x");
        let last = it.len() - 1;
        it[last] ^= 1;
        assert_eq!(validate_upload(&it).unwrap_err(), UploadRefusal::BadSignature);

        // garbage without a valid sig type: the sig-type check fires FIRST,
        // so the refusal names the type that arrived, not a generic "malformed"
        assert_eq!(validate_upload(&[0u8; 4]).unwrap_err(), UploadRefusal::NotEd25519 { got: 0 });

        // sig type 2 but truncated body -> structural refusal naming the segment
        assert!(matches!(
            validate_upload(&[2u8, 0, 0, 0]).unwrap_err(),
            UploadRefusal::Malformed(_)
        ));
    }
}
