//! Canonical event schema (brief §9.3).
//!
//! Envelope + typed payloads for everything that flows over the bus. Two
//! standing rules from the brief are load-bearing here:
//! - Events key off **DIDs**, never raw public keys, so key rotation and
//!   device replacement never orphan history.
//! - Value is always `(amount, asset_id)` — no hardcoded currency anywhere.
//!
//! Message content never rides the bus: `MessageEvent` carries an Autonomi
//! reference to the encrypted payload, not the payload.

use serde::{Deserialize, Serialize};

/// Where a raw event was observed before normalization.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub enum SourceChain {
    Eos,
    Vaulta,
    Arweave,
    Zano,
    Autonomi,
    /// BIND-1 K-6: the ATProto social layer (signed repos, records,
    /// firehose). `source_ref` convention: `at://<did>/<collection>/<rkey>#<cid>`.
    AtProto,
    /// C-1: the exSat EVM execution layer, observed as contract logs.
    ///
    /// `source_ref` convention: `<block_number>:<tx_hash>#<log_index>` — the
    /// `<block>:<tx>` shape follows the normalizer's convention, and the `#`
    /// fragment follows the AtProto precedent above. The fragment is
    /// load-bearing, not decoration: one EVM transaction can emit many logs
    /// of the same event type, so `log_index` is what makes the reference
    /// identify a single log. Gas on exSat is BTC; `b` is never gas, and no
    /// `b` accounting rides this variant.
    ExSatEvm,
}

/// The envelope every consumer reads. `payload` carries the family-specific
/// data; `event_type` is the flat discriminant consumers filter on.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalEvent {
    pub event_id: String,
    pub event_type: EventType,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
    pub source_chain: SourceChain,
    /// Tx hash, block number, Autonomi address, etc.
    pub source_ref: String,
    pub payload: EventPayload,
    /// Adapter that normalized this event (e.g. "chain-eos").
    pub canonicalized_by: String,
}

/// Flat event discriminant — one variant per concrete event.
///
/// BIND-1 K-6: `#[non_exhaustive]` going forward. Variants version by
/// addition, never mutation — no existing variant is renamed or removed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[non_exhaustive]
pub enum EventType {
    ProductListed,
    ProductUpdated,
    ProductDelisted,
    OrderPlaced,
    OrderFunded,
    OrderShipped,
    OrderDelivered,
    OrderCompleted,
    OrderRefunded,
    OrderDisputed,
    OrderResolved,
    MessageSent,
    DisputeRecommendation,
    DisputeResolved,
    #[serde(rename = "DIDLinked")]
    DidLinked,
    ReputationUpdated,
    // --- BIND-1 K-6 seam variants (additive) ---
    /// A performance set was published on the social layer.
    /// `canonicalized_by`: `"sense-atproto"`.
    PerformanceSetPublished,
    /// A social record was retracted (deleted after crossing).
    /// References the original; the original stands immutable (K-7).
    SocialRecordRetracted,
    /// A circle protocol action concluded.
    CircleConcluded,
    /// An emission was minted (settlement-class, GOV-3 one-way bridge).
    EmissionMinted,
    /// An agent publication was logged (e.g. bQueenBee Q-6 audit).
    AgentPublicationLogged,
    // --- C-1: BNRi genesis set on the exSat EVM (additive) ---
    // `canonicalized_by`: `"chain-exsat-evm"`. These name the ten founder-named
    // BNRi genesis events. The names are settled; the on-chain event signatures
    // that map onto them are NOT — no BNRi contract exists yet. See
    // `chain-exsat-evm`'s signature table, where every entry is marked
    // UNVERIFIED pending the real BNRi ABI.
    //
    // BNRi is an EVM-layer artifact. It is not `b`: `b` is earned-only
    // metabolic energy accounted kernel-side (SPIRIT-1), never an EVM token,
    // never bridged, never gas.
    /// A BNRi inscription was minted.
    BnriInscriptionMinted,
    /// A BNRi inscription was locked.
    BnriInscriptionLocked,
    /// A BNRi inscription was unlocked.
    BnriInscriptionUnlocked,
    /// A BNRi inscription changed holder.
    BnriInscriptionTransferred,
    /// A BNRi inscription was rerolled.
    BnriInscriptionRerolled,
    /// A BNRi inscription entered farming lock.
    BnriFarmingLocked,
    /// A BNRi inscription left farming lock.
    BnriFarmingUnlocked,
    /// Farming tickets accrued.
    BnriTicketAccrued,
    /// A draw commitment was published (commit phase).
    BnriDrawCommitted,
    /// A draw commitment was opened (reveal phase).
    BnriDrawRevealed,
}

/// Family-specific payload data, adjacently tagged for clean JSON
/// (`{"type": "...", "data": {...}}`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum EventPayload {
    Product(ProductEvent),
    Order(OrderEvent),
    Message(MessageEvent),
    Dispute(DisputeEvent),
    #[serde(rename = "DIDLinked")]
    DidLinked(DidLinkedEvent),
    Reputation(ReputationEvent),
    /// C-1: BNRi inscription / farming / draw data observed as an exSat EVM log.
    ///
    /// Deliberately its own family: Product/Order/Message/Dispute/DidLinked/
    /// Reputation model private-commerce settlement, and a BNRi log is none of
    /// those. Reusing one of them would make the payload lie about what it is.
    Bnri(BnriEvent),
}

/// A decoded BNRi contract log from the exSat EVM (C-1).
///
/// **Field-level semantics are deliberately absent.** No BNRi contract exists
/// yet, so this struct does NOT claim to know that word 0 is an inscription id
/// or word 1 an amount — inventing those names would be a fabricated ABI
/// wearing a struct's clothing. What it carries instead is exactly what the
/// EVM ABI specification guarantees is recoverable from a log without the
/// contract's source: the emitting address, the matched signature string, the
/// topic0 that matched it, and the raw 32-byte words.
///
/// When the real BNRi ABI lands, named fields can be added to this struct
/// additively, and the raw words stay as the audit trail.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BnriEvent {
    /// 0x-prefixed lowercase hex of the 20-byte emitting contract address.
    pub contract: String,
    /// The event signature string whose keccak256 matched `topic0`.
    ///
    /// Until the real BNRi ABI lands this is a clearly-marked placeholder from
    /// the adapter's UNVERIFIED table — it is recorded here precisely so a
    /// consumer can tell which table entry produced this event.
    pub signature: String,
    /// 0x-prefixed lowercase hex of `topics[0]` = keccak256(`signature`).
    pub topic0: String,
    /// `topics[1..]` — the indexed parameters, one 32-byte word each,
    /// 0x-prefixed lowercase hex.
    ///
    /// Per the ABI spec, an indexed parameter of *dynamic* type stores
    /// keccak256 of the value here, not the value.
    pub indexed_words: Vec<String>,
    /// The non-indexed parameters decoded from `data`, one 32-byte word each,
    /// 0x-prefixed lowercase hex, in declaration order.
    pub data_words: Vec<String>,
}

/// Product family (Listed / Updated / Delisted).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProductEvent {
    pub listing_id: String,
    pub seller_did: String,
    pub category: Option<String>,
    pub title: Option<String>,
    /// Price as `(amount, asset_id)`; absent for e.g. Delisted.
    pub amount: Option<u64>,
    pub asset_id: Option<String>,
}

/// Order family (Placed → … → Resolved). One struct for the whole
/// lifecycle; stage-specific fields are optional.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderEvent {
    pub order_id: String,
    pub buyer_did: String,
    pub seller_did: String,
    pub amount: u64,
    pub asset_id: String,
    /// Observed native-ZANO balance alongside the asset (§9.2 fee buffer).
    /// The escrow funding check needs BOTH balances; absent means the
    /// watcher did not observe one (treated as 0 — partial funding).
    #[serde(default)]
    pub fee_buffer_zano: Option<u64>,
    pub escrow_wallet_id: Option<String>,
    pub tracking: Option<String>,
    pub carrier: Option<String>,
}

/// A message was sent; content stays encrypted on Autonomi.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MessageEvent {
    pub message_id: String,
    pub from_did: String,
    pub to_did: String,
    /// Autonomi address of the encrypted payload — never the content.
    pub content_ref: String,
}

/// DRO verdict on a dispute (§5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Verdict {
    RefundBuyer,
    ReleaseToSeller,
    Split,
}

/// Dispute family: Tier-1 `DisputeRecommendation` and final
/// `DisputeResolved` share this shape (§5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DisputeEvent {
    pub order_id: String,
    pub verdict: Option<Verdict>,
    /// Tier-1 confidence in [0, 1]; auto-enforce gate is > 0.95.
    pub confidence: Option<f32>,
    pub evidence_hashes: Vec<String>,
    pub reasoning_hash: Option<String>,
    pub auto_enforce: Option<bool>,
    pub resolution_id: Option<String>,
}

/// Root identity ↔ linked persona attestation (must be bidirectional; this
/// event records one direction's proof reference).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DidLinkedEvent {
    pub root_did: String,
    pub linked_did: String,
    pub attestation_ref: String,
}

/// Reputation change for a DID, with a reference to what earned it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReputationEvent {
    pub subject_did: String,
    pub score_delta: i64,
    pub basis_ref: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_EVENT_TYPES: [EventType; 21] = [
        EventType::ProductListed,
        EventType::ProductUpdated,
        EventType::ProductDelisted,
        EventType::OrderPlaced,
        EventType::OrderFunded,
        EventType::OrderShipped,
        EventType::OrderDelivered,
        EventType::OrderCompleted,
        EventType::OrderRefunded,
        EventType::OrderDisputed,
        EventType::OrderResolved,
        EventType::MessageSent,
        EventType::DisputeRecommendation,
        EventType::DisputeResolved,
        EventType::DidLinked,
        EventType::ReputationUpdated,
        // BIND-1 K-6 seam variants
        EventType::PerformanceSetPublished,
        EventType::SocialRecordRetracted,
        EventType::CircleConcluded,
        EventType::EmissionMinted,
        EventType::AgentPublicationLogged,
    ];

    #[test]
    fn every_event_type_roundtrips_through_json() {
        for et in ALL_EVENT_TYPES {
            let json = serde_json::to_string(&et).unwrap();
            let back: EventType = serde_json::from_str(&json).unwrap();
            assert_eq!(et, back, "lossy roundtrip for {json}");
        }
    }

    #[test]
    fn event_type_json_uses_type_tag_and_did_rename() {
        let json = serde_json::to_string(&EventType::ProductListed).unwrap();
        assert_eq!(json, r#"{"type":"ProductListed"}"#);
        let json = serde_json::to_string(&EventType::DidLinked).unwrap();
        assert_eq!(json, r#"{"type":"DIDLinked"}"#);
    }

    fn sample_payloads() -> Vec<EventPayload> {
        vec![
            EventPayload::Product(ProductEvent {
                listing_id: "listing-1".into(),
                seller_did: "did:plc:seller".into(),
                category: Some("hemp-seeds".into()),
                title: Some("Heirloom hemp seeds".into()),
                amount: Some(5_000_000),
                asset_id: Some("fusd-asset-id".into()),
            }),
            EventPayload::Order(OrderEvent {
                order_id: "order-1".into(),
                buyer_did: "did:plc:buyer".into(),
                seller_did: "did:plc:seller".into(),
                amount: 5_000_000,
                asset_id: "fusd-asset-id".into(),
                fee_buffer_zano: Some(10_000_000),
                escrow_wallet_id: Some("msig-1".into()),
                tracking: Some("1Z999".into()),
                carrier: Some("UPS".into()),
            }),
            EventPayload::Message(MessageEvent {
                message_id: "msg-1".into(),
                from_did: "did:plc:buyer".into(),
                to_did: "did:plc:seller".into(),
                content_ref: "autonomi://addr".into(),
            }),
            EventPayload::Dispute(DisputeEvent {
                order_id: "order-1".into(),
                verdict: Some(Verdict::Split),
                confidence: Some(0.97),
                evidence_hashes: vec!["h1".into(), "h2".into()],
                reasoning_hash: Some("rh".into()),
                auto_enforce: Some(true),
                resolution_id: Some("res-1".into()),
            }),
            EventPayload::DidLinked(DidLinkedEvent {
                root_did: "did:autonomi:root".into(),
                linked_did: "did:plc:persona".into(),
                attestation_ref: "autonomi://attestation".into(),
            }),
            EventPayload::Reputation(ReputationEvent {
                subject_did: "did:plc:seller".into(),
                score_delta: 5,
                basis_ref: Some("order-1".into()),
            }),
        ]
    }

    #[test]
    fn every_payload_family_roundtrips_through_json() {
        for p in sample_payloads() {
            let json = serde_json::to_string(&p).unwrap();
            let back: EventPayload = serde_json::from_str(&json).unwrap();
            assert_eq!(p, back, "lossy roundtrip for {json}");
        }
    }

    #[test]
    fn canonical_event_envelope_roundtrips_through_json() {
        for (i, payload) in sample_payloads().into_iter().enumerate() {
            let event = CanonicalEvent {
                event_id: format!("evt-{i}"),
                event_type: EventType::OrderFunded,
                timestamp: 1_782_000_000,
                source_chain: SourceChain::Zano,
                source_ref: "zano-tx-ref".into(),
                payload,
                canonicalized_by: "normalizer".into(),
            };
            let json = serde_json::to_string(&event).unwrap();
            let back: CanonicalEvent = serde_json::from_str(&json).unwrap();
            assert_eq!(event, back);
        }
    }

    /// Brief §9.3 example mapping: Vaulta `lovismarket:addlisting` →
    /// `ProductListed`, normalized by the chain-eos adapter.
    #[test]
    fn mock_vaulta_addlisting_maps_to_product_listed() {
        let event = CanonicalEvent {
            event_id: "evt-vaulta-1".into(),
            event_type: EventType::ProductListed,
            timestamp: 1_782_000_000,
            source_chain: SourceChain::Vaulta,
            source_ref: "vaulta-tx-abc123/action-0 (lovismarket:addlisting)".into(),
            payload: EventPayload::Product(ProductEvent {
                listing_id: "listing-42".into(),
                seller_did: "did:plc:seller".into(),
                category: Some("hemp-seeds".into()),
                title: Some("Heirloom hemp seeds".into()),
                amount: Some(5_000_000),
                asset_id: Some("fusd-asset-id".into()),
            }),
            canonicalized_by: "chain-eos".into(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""event_type":{"type":"ProductListed"}"#));
        assert!(json.contains(r#""source_chain":"Vaulta""#));
        assert!(json.contains(r#""canonicalized_by":"chain-eos""#));

        let back: CanonicalEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, back);
        assert_eq!(back.event_type, EventType::ProductListed);
    }

    // ---- BIND-1 K-D2: seam variants + AtProto + non_exhaustive -------

    #[test]
    fn source_chain_atproto_roundtrips_through_json() {
        let json = serde_json::to_string(&SourceChain::AtProto).unwrap();
        assert_eq!(json, r#""AtProto""#);
        let back: SourceChain = serde_json::from_str(&json).unwrap();
        assert_eq!(back, SourceChain::AtProto);
    }

    #[test]
    fn all_source_chain_variants_roundtrip_through_json() {
        let all = [
            SourceChain::Eos,
            SourceChain::Vaulta,
            SourceChain::Arweave,
            SourceChain::Zano,
            SourceChain::Autonomi,
            SourceChain::AtProto,
        ];
        for sc in all {
            let json = serde_json::to_string(&sc).unwrap();
            let back: SourceChain = serde_json::from_str(&json).unwrap();
            assert_eq!(sc, back, "lossy roundtrip for {json}");
        }
    }

    #[test]
    fn seam_event_type_variants_roundtrip_through_json() {
        let seam_types = [
            EventType::PerformanceSetPublished,
            EventType::SocialRecordRetracted,
            EventType::CircleConcluded,
            EventType::EmissionMinted,
            EventType::AgentPublicationLogged,
        ];
        for et in seam_types {
            let json = serde_json::to_string(&et).unwrap();
            let back: EventType = serde_json::from_str(&json).unwrap();
            assert_eq!(et, back, "lossy roundtrip for {json}");
        }
    }

    #[test]
    fn seam_event_type_json_tags_match_variant_names() {
        // No rename — additive variants use their Rust names directly.
        assert_eq!(
            serde_json::to_string(&EventType::PerformanceSetPublished).unwrap(),
            r#"{"type":"PerformanceSetPublished"}"#
        );
        assert_eq!(
            serde_json::to_string(&EventType::SocialRecordRetracted).unwrap(),
            r#"{"type":"SocialRecordRetracted"}"#
        );
        assert_eq!(
            serde_json::to_string(&EventType::CircleConcluded).unwrap(),
            r#"{"type":"CircleConcluded"}"#
        );
        assert_eq!(
            serde_json::to_string(&EventType::EmissionMinted).unwrap(),
            r#"{"type":"EmissionMinted"}"#
        );
        assert_eq!(
            serde_json::to_string(&EventType::AgentPublicationLogged).unwrap(),
            r#"{"type":"AgentPublicationLogged"}"#
        );
    }

    #[test]
    fn atproto_source_ref_convention_documented() {
        // K-D2: source_ref convention for AtProto is
        // at://<did>/<collection>/<rkey>#<cid>
        let event = CanonicalEvent {
            event_id: "evt-atproto-1".into(),
            event_type: EventType::PerformanceSetPublished,
            timestamp: 1_782_000_000,
            source_chain: SourceChain::AtProto,
            source_ref: "at://did:plc:abc/social.skaists.alpha.performance.set/rkey123#bafyfakecid".into(),
            payload: EventPayload::Product(ProductEvent {
                listing_id: "set-1".into(),
                seller_did: "did:plc:abc".into(),
                category: None,
                title: Some("Live at the Teal Room".into()),
                amount: None,
                asset_id: None,
            }),
            canonicalized_by: "sense-atproto".into(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""source_chain":"AtProto""#));
        assert!(json.contains(r#""canonicalized_by":"sense-atproto""#));
        assert!(json.contains("at://did:plc:abc/"));
        let back: CanonicalEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, back);
    }
}
