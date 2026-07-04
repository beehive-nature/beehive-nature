//! Carrier-tracking evidence adapter — the dispute engine's first
//! real-world sense, built mock-first (the true reality gate is carrier
//! API credentials; the adapter's *shape* and mapping logic are fully
//! testable now).
//!
//! Trust model, encoded rather than asserted (§5: "carrier tracking APIs
//! are centralized inputs — define trust model"):
//! - Carrier responses are **not cryptographically signed**, so mapped
//!   evidence carries `signed: false` and `verified: true` (the adapter
//!   itself fetched it from the source). Under the dispute engine's
//!   weights that caps a lone carrier scan at effective weight 0.90 —
//!   **below the 0.95 auto-enforce gate**. One tracking record can
//!   support a verdict; it can never move money alone. Corroboration
//!   (e.g. a device attestation) can push past the gate. This is the
//!   §5 trust model falling out of arithmetic, and it is tested.
//! - Direction: `delivered` favors the **seller** (fulfillment proven);
//!   exception statuses (`lost`, `damaged`, `returned`) favor the
//!   **buyer**; `pending`/`in_transit` map as *weak* seller-side
//!   evidence (adapter confidence 0.30 — movement weakly supports the
//!   fulfillment story); **unknown statuses never strengthen anyone**
//!   (weak class, never a guess promoted to proof).

#![forbid(unsafe_code)]

use std::collections::BTreeMap;
use std::fmt;

use dispute_engine::{Dispute, Evidence, EvidenceProvider, Provenance, ProviderError, Side};
use sha2::{Digest, Sha256};

/// One tracking scan as reported by a carrier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CarrierEvent {
    pub tracking_number: String,
    /// Carrier-reported status string (matched case-insensitively).
    pub status: String,
    /// Unix seconds of the scan.
    pub timestamp: i64,
    pub location: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdapterError {
    /// Transport failure or non-success HTTP status from the carrier.
    Http(String),
    /// The carrier answered but the body was not the expected shape.
    Parse(&'static str),
    /// The carrier does not know this tracking number.
    NotFound(String),
}

impl fmt::Display for AdapterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AdapterError::Http(e) => write!(f, "carrier transport: {e}"),
            AdapterError::Parse(what) => write!(f, "carrier response parse: {what}"),
            AdapterError::NotFound(t) => write!(f, "tracking number unknown to carrier: {t}"),
        }
    }
}

impl std::error::Error for AdapterError {}

/// The carrier seam. The real implementation (HTTP + API keys per
/// carrier) gates on credentials; v1 ships [`MockCarrierApi`].
pub trait CarrierApi {
    fn fetch_tracking_status(&self, tracking_number: &str) -> Result<CarrierEvent, AdapterError>;
}

/// Parse a carrier JSON body (the shape the mock records and a real
/// adapter will normalize toward): `{"tracking_number", "status",
/// "timestamp", "location"}`. Typed errors, never guesses.
pub fn parse_carrier_response(json: &str) -> Result<CarrierEvent, AdapterError> {
    let v: serde_json::Value =
        serde_json::from_str(json).map_err(|_| AdapterError::Parse("not JSON"))?;
    let field = |name: &'static str| -> Result<&str, AdapterError> {
        v.get(name)
            .and_then(serde_json::Value::as_str)
            .ok_or(AdapterError::Parse(name))
    };
    Ok(CarrierEvent {
        tracking_number: field("tracking_number")?.to_string(),
        status: field("status")?.to_string(),
        timestamp: v
            .get("timestamp")
            .and_then(serde_json::Value::as_i64)
            .ok_or(AdapterError::Parse("timestamp"))?,
        location: field("location")?.to_string(),
    })
}

/// Status classes the mapping recognizes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StatusClass {
    Delivered,
    Exception,
    Weak, // pending / in transit / anything unrecognized
}

fn classify(status: &str) -> StatusClass {
    let s = status.trim().to_ascii_lowercase();
    match s.as_str() {
        "delivered" => StatusClass::Delivered,
        "lost" | "damaged" | "returned" | "returned_to_sender" | "exception" => {
            StatusClass::Exception
        }
        _ => StatusClass::Weak,
    }
}

/// Map a carrier scan to dispute-engine evidence.
///
/// `signed: false` always (carrier APIs return no cryptographic
/// signature); `verified: true` (the adapter fetched it from the source
/// itself); `payload_hash` = sha256 over the canonical event fields, so
/// identical scans hash identically and the audit trail can cite them.
pub fn map_to_evidence(event: &CarrierEvent) -> Evidence {
    let (favors, confidence) = match classify(&event.status) {
        StatusClass::Delivered => (Side::Seller, 1.0),
        StatusClass::Exception => (Side::Buyer, 1.0),
        StatusClass::Weak => (Side::Seller, 0.30),
    };
    let mut h = Sha256::new();
    h.update(event.tracking_number.as_bytes());
    h.update([0]);
    h.update(event.status.as_bytes());
    h.update([0]);
    h.update(event.timestamp.to_le_bytes());
    h.update(event.location.as_bytes());
    Evidence {
        provenance: Provenance::CarrierApi,
        confidence,
        signed: false,
        verified: true,
        payload_hash: h.finalize().into(),
        favors,
    }
}

/// The dispute engine's `EvidenceProvider`, backed by a carrier API and
/// bound to one tracking number (the composition layer knows which
/// tracking belongs to which dispute — that binding came from the
/// order's `SellerShipped` event, not from the carrier).
pub struct CarrierEvidenceProvider<A: CarrierApi> {
    api: A,
    tracking_number: String,
}

impl<A: CarrierApi> CarrierEvidenceProvider<A> {
    pub fn new(api: A, tracking_number: impl Into<String>) -> Self {
        CarrierEvidenceProvider {
            api,
            tracking_number: tracking_number.into(),
        }
    }
}

impl<A: CarrierApi> EvidenceProvider for CarrierEvidenceProvider<A> {
    fn gather(&self, _dispute: &Dispute) -> Result<Vec<Evidence>, ProviderError> {
        let event = self
            .api
            .fetch_tracking_status(&self.tracking_number)
            .map_err(|e| ProviderError::Unavailable(e.to_string()))?;
        Ok(vec![map_to_evidence(&event)])
    }
}

/// v1 mock: pre-recorded JSON per tracking number, plus a failure switch
/// simulating carrier-side HTTP errors.
#[derive(Debug, Default)]
pub struct MockCarrierApi {
    responses: BTreeMap<String, String>,
    /// When set, every fetch fails with this HTTP error (e.g. "500").
    pub fail_with: Option<String>,
}

impl MockCarrierApi {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&mut self, tracking_number: impl Into<String>, json: impl Into<String>) {
        self.responses.insert(tracking_number.into(), json.into());
    }
}

impl CarrierApi for MockCarrierApi {
    fn fetch_tracking_status(&self, tracking_number: &str) -> Result<CarrierEvent, AdapterError> {
        if let Some(status) = &self.fail_with {
            return Err(AdapterError::Http(format!("carrier returned {status}")));
        }
        let json = self
            .responses
            .get(tracking_number)
            .ok_or_else(|| AdapterError::NotFound(tracking_number.to_string()))?;
        parse_carrier_response(json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dispute_engine::{adjudicate, resolve, VerdictType, AUTO_ENFORCE_THRESHOLD};

    const TRACKING: &str = "1Z999AA10123456784";

    fn json(status: &str) -> String {
        format!(
            r#"{{"tracking_number":"{TRACKING}","status":"{status}","timestamp":1782200000,"location":"Portland, OR"}}"#
        )
    }

    fn mock_with(status: &str) -> MockCarrierApi {
        let mut api = MockCarrierApi::new();
        api.record(TRACKING, json(status));
        api
    }

    fn dispute() -> Dispute {
        Dispute {
            order_id: "order-c1".into(),
            buyer_did: "did:plc:buyer".into(),
            seller_did: "did:plc:seller".into(),
            amount: 1_000_000,
            asset_id: Some("fusd-asset-id".into()),
            opened_at: 1_782_100_000,
            reason_hash: [4; 32],
            evidence_bucket_refs: vec![],
        }
    }

    #[test]
    fn delivered_maps_to_carrier_evidence_favoring_seller() {
        let event = mock_with("Delivered")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        let ev = map_to_evidence(&event);
        assert_eq!(ev.provenance, Provenance::CarrierApi);
        assert_eq!(ev.favors, Side::Seller);
        assert!(ev.verified);
        assert!(!ev.signed, "carrier APIs return no cryptographic signature");
        assert_eq!(ev.confidence, 1.0);
    }

    #[test]
    fn exception_statuses_favor_the_buyer() {
        for status in ["Lost", "damaged", "RETURNED"] {
            let event = mock_with(status).fetch_tracking_status(TRACKING).unwrap();
            assert_eq!(map_to_evidence(&event).favors, Side::Buyer, "{status}");
        }
    }

    #[test]
    fn pending_is_weak_and_never_auto_enforces() {
        let event = mock_with("Pending")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        let ev = map_to_evidence(&event);
        assert!(ev.confidence < 0.5, "pending is weak evidence");

        let verdict = resolve(&dispute(), &[ev]);
        assert!(!verdict.auto_enforce);
        assert!(verdict.confidence < AUTO_ENFORCE_THRESHOLD);
    }

    #[test]
    fn unknown_statuses_are_weak_never_promoted() {
        let event = mock_with("Quantum Uncertainty")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        let ev = map_to_evidence(&event);
        assert!(ev.confidence < 0.5, "unrecognized status must stay weak");
    }

    #[test]
    fn a_lone_delivered_scan_supports_but_cannot_move_money() {
        // The §5 trust model as arithmetic: unsigned carrier evidence caps
        // at 0.90 effective weight — below the 0.95 auto-enforce gate.
        let event = mock_with("Delivered")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        let verdict = resolve(&dispute(), &[map_to_evidence(&event)]);
        assert_eq!(verdict.verdict, VerdictType::ReleaseToSeller);
        assert!(
            !verdict.auto_enforce,
            "one centralized API record never auto-moves funds (conf {})",
            verdict.confidence
        );

        // Corroborated by a device attestation, the gate opens.
        let corroboration = Evidence {
            provenance: Provenance::DeviceAttestation,
            confidence: 1.0,
            signed: true,
            verified: true,
            payload_hash: [8; 32],
            favors: Side::Seller,
        };
        let verdict = resolve(&dispute(), &[map_to_evidence(&event), corroboration]);
        assert!(verdict.auto_enforce, "corroboration crosses the gate");
    }

    #[test]
    fn http_failure_is_a_typed_error_not_a_panic() {
        let mut api = mock_with("Delivered");
        api.fail_with = Some("500 Internal Server Error".into());
        let err = api.fetch_tracking_status(TRACKING).unwrap_err();
        assert!(matches!(err, AdapterError::Http(_)));
    }

    #[test]
    fn unknown_tracking_and_malformed_bodies_are_typed_errors() {
        let api = MockCarrierApi::new();
        assert!(matches!(
            api.fetch_tracking_status("nope"),
            Err(AdapterError::NotFound(_))
        ));
        assert_eq!(
            parse_carrier_response("not json"),
            Err(AdapterError::Parse("not JSON"))
        );
        assert_eq!(
            parse_carrier_response(r#"{"tracking_number":"x","status":"Delivered"}"#),
            Err(AdapterError::Parse("timestamp"))
        );
    }

    #[test]
    fn provider_seam_feeds_the_dispute_engine_end_to_end() {
        let provider = CarrierEvidenceProvider::new(mock_with("Delivered"), TRACKING);
        let verdict = adjudicate(&dispute(), &provider).unwrap();
        assert_eq!(verdict.verdict, VerdictType::ReleaseToSeller);
        assert_eq!(verdict.evidence_hashes.len(), 1);

        // And an API outage surfaces as the provider's typed error.
        let mut failing = mock_with("Delivered");
        failing.fail_with = Some("503".into());
        let provider = CarrierEvidenceProvider::new(failing, TRACKING);
        assert!(adjudicate(&dispute(), &provider).is_err());
    }

    #[test]
    fn identical_scans_hash_identically_distinct_scans_differ() {
        let a = mock_with("Delivered")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        let b = mock_with("Delivered")
            .fetch_tracking_status(TRACKING)
            .unwrap();
        assert_eq!(
            map_to_evidence(&a).payload_hash,
            map_to_evidence(&b).payload_hash
        );

        let c = mock_with("Lost").fetch_tracking_status(TRACKING).unwrap();
        assert_ne!(
            map_to_evidence(&a).payload_hash,
            map_to_evidence(&c).payload_hash
        );
    }
}
