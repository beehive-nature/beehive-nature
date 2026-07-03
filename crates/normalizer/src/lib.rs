//! Normalizer — the nervous-system step (brief §9.3): raw chain actions in,
//! `CanonicalEvent`s out. Adapters (`chain-eos`, later zano/arweave
//! watchers) decode chain-native bytes into `RawChainAction`; this crate
//! owns the mapping rules. Unhandled actions are ignored (`Ok(None)`) —
//! chains are full of traffic the kernel doesn't care about — but a
//! *recognized* action with a malformed payload is an error, never a guess.

#![forbid(unsafe_code)]

use std::fmt;

use serde_json::Value;
use shared_types::{
    CanonicalEvent, EventPayload, EventType, OrderEvent, ProductEvent, SourceChain,
};

/// A decoded action from a chain adapter, before normalization.
#[derive(Debug, Clone, PartialEq)]
pub struct RawChainAction {
    pub source_chain: SourceChain,
    pub contract: String,
    pub action_name: String,
    /// The deserialized payload from the chain.
    pub data: Value,
    pub block_num: u64,
    pub tx_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NormalizerError {
    /// A recognized action was missing a field its mapping requires.
    MissingField { action: String, field: &'static str },
    /// A required field was present but the wrong JSON type.
    BadFieldType {
        action: String,
        field: &'static str,
        expected: &'static str,
    },
}

impl fmt::Display for NormalizerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NormalizerError::MissingField { action, field } => {
                write!(f, "{action}: required field `{field}` is missing")
            }
            NormalizerError::BadFieldType {
                action,
                field,
                expected,
            } => {
                write!(f, "{action}: field `{field}` is not a {expected}")
            }
        }
    }
}

impl std::error::Error for NormalizerError {}

/// Map one raw action to a canonical event.
///
/// `Ok(None)` = not a mapped action (ignored by design). `Err` = a mapped
/// action whose payload does not carry what the schema requires.
pub fn normalize(action: RawChainAction) -> Result<Option<CanonicalEvent>, NormalizerError> {
    let (event_type, payload) = match (action.contract.as_str(), action.action_name.as_str()) {
        // Vaulta marketplace listing (§9.3 example mapping)
        ("lovismarket", "addlisting") => (
            EventType::ProductListed,
            EventPayload::Product(ProductEvent {
                listing_id: req_str(&action, "listing_id")?,
                seller_did: req_str(&action, "seller_did")?,
                category: opt_str(&action.data, "category"),
                title: opt_str(&action.data, "title"),
                amount: opt_u64(&action, "amount")?,
                asset_id: opt_str(&action.data, "asset_id"),
            }),
        ),
        // Zano asset transfer to a multisig address = order funding (§9.3)
        ("zano", "transfer") => (
            EventType::OrderFunded,
            EventPayload::Order(OrderEvent {
                order_id: req_str(&action, "order_id")?,
                buyer_did: req_str(&action, "buyer_did")?,
                seller_did: req_str(&action, "seller_did")?,
                amount: req_u64(&action, "amount")?,
                asset_id: req_str(&action, "asset_id")?,
                // §9.2: the watcher reports the multisig's native balance
                // alongside the asset; absent = not observed (never guessed).
                fee_buffer_zano: opt_u64(&action, "fee_buffer_zano")?,
                escrow_wallet_id: opt_str(&action.data, "multisig_address"),
                tracking: None,
                carrier: None,
            }),
        ),
        // Everything else on-chain is noise to the kernel.
        _ => return Ok(None),
    };

    Ok(Some(CanonicalEvent {
        event_id: format!(
            "{}-{}-{}",
            chain_slug(action.source_chain),
            action.tx_id,
            action.action_name
        ),
        event_type,
        timestamp: action
            .data
            .get("timestamp")
            .and_then(Value::as_i64)
            .unwrap_or(0),
        source_chain: action.source_chain,
        source_ref: format!("{}:{}", action.block_num, action.tx_id),
        payload,
        canonicalized_by: "normalizer".to_string(),
    }))
}

fn chain_slug(chain: SourceChain) -> &'static str {
    match chain {
        SourceChain::Eos => "eos",
        SourceChain::Vaulta => "vaulta",
        SourceChain::Arweave => "arweave",
        SourceChain::Zano => "zano",
        SourceChain::Autonomi => "autonomi",
    }
}

fn action_label(action: &RawChainAction) -> String {
    format!("{}:{}", action.contract, action.action_name)
}

fn req_str(action: &RawChainAction, field: &'static str) -> Result<String, NormalizerError> {
    match action.data.get(field) {
        None | Some(Value::Null) => Err(NormalizerError::MissingField {
            action: action_label(action),
            field,
        }),
        Some(Value::String(s)) => Ok(s.clone()),
        Some(_) => Err(NormalizerError::BadFieldType {
            action: action_label(action),
            field,
            expected: "string",
        }),
    }
}

fn req_u64(action: &RawChainAction, field: &'static str) -> Result<u64, NormalizerError> {
    match action.data.get(field) {
        None | Some(Value::Null) => Err(NormalizerError::MissingField {
            action: action_label(action),
            field,
        }),
        Some(v) => v.as_u64().ok_or(NormalizerError::BadFieldType {
            action: action_label(action),
            field,
            expected: "u64",
        }),
    }
}

/// Optional u64: absent/null is fine, present-but-wrong-type is an error.
fn opt_u64(action: &RawChainAction, field: &'static str) -> Result<Option<u64>, NormalizerError> {
    match action.data.get(field) {
        None | Some(Value::Null) => Ok(None),
        Some(v) => v.as_u64().map(Some).ok_or(NormalizerError::BadFieldType {
            action: action_label(action),
            field,
            expected: "u64",
        }),
    }
}

fn opt_str(data: &Value, field: &str) -> Option<String> {
    data.get(field).and_then(Value::as_str).map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn vaulta_addlisting() -> RawChainAction {
        RawChainAction {
            source_chain: SourceChain::Vaulta,
            contract: "lovismarket".into(),
            action_name: "addlisting".into(),
            data: json!({
                "listing_id": "listing-42",
                "seller_did": "did:plc:seller",
                "category": "hemp-seeds",
                "title": "Heirloom hemp seeds",
                "amount": 5_000_000u64,
                "asset_id": "fusd-asset-id",
                "timestamp": 1_782_000_000i64,
            }),
            block_num: 500,
            tx_id: "abc123".into(),
        }
    }

    #[test]
    fn vaulta_addlisting_normalizes_to_product_listed() {
        let event = normalize(vaulta_addlisting()).unwrap().unwrap();

        assert_eq!(event.event_type, EventType::ProductListed);
        assert_eq!(event.event_id, "vaulta-abc123-addlisting");
        assert_eq!(event.source_chain, SourceChain::Vaulta);
        assert_eq!(event.source_ref, "500:abc123");
        assert_eq!(event.timestamp, 1_782_000_000);
        assert_eq!(event.canonicalized_by, "normalizer");

        let EventPayload::Product(p) = event.payload else {
            panic!("expected Product payload, got {:?}", event.payload);
        };
        assert_eq!(p.listing_id, "listing-42");
        assert_eq!(p.seller_did, "did:plc:seller");
        assert_eq!(p.category.as_deref(), Some("hemp-seeds"));
        assert_eq!(p.amount, Some(5_000_000));
        assert_eq!(p.asset_id.as_deref(), Some("fusd-asset-id"));
    }

    #[test]
    fn zano_transfer_normalizes_to_order_funded() {
        let action = RawChainAction {
            source_chain: SourceChain::Zano,
            contract: "zano".into(),
            action_name: "transfer".into(),
            data: json!({
                "order_id": "order-7",
                "buyer_did": "did:plc:buyer",
                "seller_did": "did:plc:seller",
                "amount": 5_000_000u64,
                "asset_id": "fusd-asset-id",
                "fee_buffer_zano": 10_000_000u64,
                "multisig_address": "msig-addr-1",
                "timestamp": 1_782_000_100i64,
            }),
            block_num: 900,
            tx_id: "ztx-1".into(),
        };

        let event = normalize(action).unwrap().unwrap();
        assert_eq!(event.event_type, EventType::OrderFunded);
        assert_eq!(event.event_id, "zano-ztx-1-transfer");
        assert_eq!(event.source_ref, "900:ztx-1");

        let EventPayload::Order(o) = event.payload else {
            panic!("expected Order payload, got {:?}", event.payload);
        };
        assert_eq!(o.order_id, "order-7");
        assert_eq!(o.buyer_did, "did:plc:buyer");
        assert_eq!(o.amount, 5_000_000);
        assert_eq!(o.asset_id, "fusd-asset-id");
        assert_eq!(o.fee_buffer_zano, Some(10_000_000));
        assert_eq!(o.escrow_wallet_id.as_deref(), Some("msig-addr-1"));
        assert_eq!(o.tracking, None);
    }

    #[test]
    fn unmapped_action_is_ignored_not_an_error() {
        let action = RawChainAction {
            source_chain: SourceChain::Eos,
            contract: "eosio.token".into(),
            action_name: "transfer".into(),
            data: json!({"from": "alice", "to": "bob", "quantity": "1.0000 EOS"}),
            block_num: 1,
            tx_id: "t".into(),
        };
        assert_eq!(normalize(action), Ok(None));
    }

    #[test]
    fn malformed_listing_missing_seller_did_errors() {
        let mut action = vaulta_addlisting();
        action.data.as_object_mut().unwrap().remove("seller_did");

        assert_eq!(
            normalize(action),
            Err(NormalizerError::MissingField {
                action: "lovismarket:addlisting".into(),
                field: "seller_did",
            })
        );
    }

    #[test]
    fn malformed_listing_wrong_type_errors() {
        let mut action = vaulta_addlisting();
        action.data["amount"] = json!("not-a-number");

        assert_eq!(
            normalize(action),
            Err(NormalizerError::BadFieldType {
                action: "lovismarket:addlisting".into(),
                field: "amount",
                expected: "u64",
            })
        );
    }

    #[test]
    fn missing_timestamp_defaults_to_zero() {
        let mut action = vaulta_addlisting();
        action.data.as_object_mut().unwrap().remove("timestamp");
        let event = normalize(action).unwrap().unwrap();
        assert_eq!(event.timestamp, 0);
    }

    #[test]
    fn normalized_event_roundtrips_through_json() {
        let event = normalize(vaulta_addlisting()).unwrap().unwrap();
        let json = serde_json::to_string(&event).unwrap();
        let back: CanonicalEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, back);
    }
}
