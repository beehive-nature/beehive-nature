//! Escrow engine — the bus consumer that drives `escrow-core`.
//!
//! This is sequence item 4: `CanonicalEvent`s (from the normalizer, over
//! the event bus) are translated into `escrow_core::EscrowEvent`s and
//! replayed into the state machines of registered escrows. The engine is
//! itself pure logic: it subscribes to facts, holds `Escrow` records, and
//! applies transitions. Broadcasting co-signed settlement transactions on
//! verdicts/timeouts is `dro-signer`'s job (Option 2), not this crate's.
//!
//! Mapping (CanonicalEvent → EscrowEvent), deliberately partial:
//! - `OrderFunded`    → `BuyerFunded { asset_amount, zano_amount, at }` —
//!   the §9.2 dual-balance check uses the payload's `amount` AND
//!   `fee_buffer_zano`; an unobserved fee buffer is 0, never a guess.
//! - `OrderShipped`   → `SellerShipped { tracking, carrier, at }`
//! - `OrderDelivered` → `DeliveryConfirmed { timestamp, CarrierScan }`
//!   (delivery events from chain ingest are carrier-sourced; the
//!   buyer-confirm path arrives via a different producer later)
//! - `OrderCompleted` → `BuyerReleased { at }`
//! - Dispute-family events belong to the DRO/dispute-engine milestone and
//!   are ignored here for now; `Timeout` ticks come from a timer task, not
//!   the chain, and are likewise out of scope for this crate.

#![forbid(unsafe_code)]

use std::collections::HashMap;

use escrow_core::{Escrow, EscrowError, EscrowEvent, EscrowState};
use shared_types::{CanonicalEvent, EventPayload, EventType};
use time::OffsetDateTime;

/// What happened when an event was applied to a registered escrow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Applied {
    pub order_id: String,
    pub result: Result<EscrowState, EscrowError>,
}

#[derive(Debug, Default)]
pub struct EscrowEngine {
    escrows: HashMap<String, Escrow>,
}

impl EscrowEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Track an escrow (created by marketplace order flow, keyed by order id).
    pub fn register(&mut self, escrow: Escrow) {
        self.escrows.insert(escrow.order_id.clone(), escrow);
    }

    pub fn get(&self, order_id: &str) -> Option<&Escrow> {
        self.escrows.get(order_id)
    }

    /// Apply one canonical event. `None` = not an escrow-relevant event or
    /// not a registered order (both ignored by design). `Some(Applied)` =
    /// a transition was attempted; its `result` is the state machine's
    /// verdict, including rejections (which leave the escrow unchanged).
    pub fn apply(&mut self, event: &CanonicalEvent) -> Option<Applied> {
        let EventPayload::Order(order) = &event.payload else {
            return None;
        };
        let escrow = self.escrows.get_mut(&order.order_id)?;
        let at = timestamp(event.timestamp);

        let escrow_event = match event.event_type {
            EventType::OrderFunded => EscrowEvent::BuyerFunded {
                asset_amount: order.amount,
                // §9.2: unobserved native balance is zero, never assumed.
                zano_amount: order.fee_buffer_zano.unwrap_or(0),
                at,
            },
            EventType::OrderShipped => EscrowEvent::SellerShipped {
                tracking: order.tracking.clone().unwrap_or_default(),
                carrier: order.carrier.clone().unwrap_or_default(),
                at,
            },
            EventType::OrderDelivered => EscrowEvent::DeliveryConfirmed {
                timestamp: at,
                source: escrow_core::DeliverySource::CarrierScan,
            },
            EventType::OrderCompleted => EscrowEvent::BuyerReleased { at },
            _ => return None,
        };

        Some(Applied {
            order_id: order.order_id.clone(),
            result: escrow.transition(escrow_event),
        })
    }
}

/// CanonicalEvent timestamps are unix seconds; out-of-range values clamp
/// to the epoch rather than panicking on hostile input.
fn timestamp(unix_secs: i64) -> OffsetDateTime {
    OffsetDateTime::from_unix_timestamp(unix_secs).unwrap_or(OffsetDateTime::UNIX_EPOCH)
}

#[cfg(test)]
mod tests {
    use super::*;
    use escrow_core::{PublicKey, FEE_BUFFER};
    use shared_types::{OrderEvent, SourceChain};

    const AMOUNT: u64 = 5_000_000;

    fn escrow(order_id: &str) -> Escrow {
        Escrow::new(
            order_id,
            "msig-1",
            PublicKey([1; 32]),
            PublicKey([2; 32]),
            PublicKey([3; 32]),
            AMOUNT,
            Some("fusd-asset-id".into()),
            FEE_BUFFER,
            timestamp(1_782_000_000),
        )
    }

    fn order_event(
        order_id: &str,
        event_type: EventType,
        fee_buffer_zano: Option<u64>,
    ) -> CanonicalEvent {
        CanonicalEvent {
            event_id: format!("evt-{order_id}"),
            event_type,
            timestamp: 1_782_000_100,
            source_chain: SourceChain::Zano,
            source_ref: "1:tx".into(),
            payload: EventPayload::Order(OrderEvent {
                order_id: order_id.into(),
                buyer_did: "did:plc:buyer".into(),
                seller_did: "did:plc:seller".into(),
                amount: AMOUNT,
                asset_id: "fusd-asset-id".into(),
                fee_buffer_zano,
                escrow_wallet_id: Some("msig-1".into()),
                tracking: Some("1Z999".into()),
                carrier: Some("UPS".into()),
            }),
            canonicalized_by: "normalizer".into(),
        }
    }

    #[test]
    fn fully_funded_order_transitions_to_funded() {
        let mut engine = EscrowEngine::new();
        engine.register(escrow("order-1"));

        let applied = engine
            .apply(&order_event(
                "order-1",
                EventType::OrderFunded,
                Some(FEE_BUFFER),
            ))
            .expect("registered order");
        assert_eq!(applied.order_id, "order-1");
        assert_eq!(applied.result, Ok(EscrowState::Funded));
        assert_eq!(engine.get("order-1").unwrap().state, EscrowState::Funded);
    }

    #[test]
    fn missing_fee_buffer_is_partial_funding_and_rejected() {
        let mut engine = EscrowEngine::new();
        engine.register(escrow("order-2"));

        let applied = engine
            .apply(&order_event("order-2", EventType::OrderFunded, None))
            .expect("registered order");
        assert!(matches!(
            applied.result,
            Err(EscrowError::InsufficientFunding {
                zano_provided: 0,
                ..
            })
        ));
        // The escrow is untouched by the rejected funding.
        assert_eq!(engine.get("order-2").unwrap().state, EscrowState::Created);
    }

    #[test]
    fn unregistered_orders_and_non_order_events_are_ignored() {
        let mut engine = EscrowEngine::new();
        assert_eq!(
            engine.apply(&order_event("ghost", EventType::OrderFunded, Some(1))),
            None
        );

        engine.register(escrow("order-3"));
        let mut listing = order_event("order-3", EventType::ProductListed, None);
        listing.payload = EventPayload::Product(shared_types::ProductEvent {
            listing_id: "l".into(),
            seller_did: "s".into(),
            category: None,
            title: None,
            amount: None,
            asset_id: None,
        });
        assert_eq!(engine.apply(&listing), None);
    }

    #[test]
    fn full_lifecycle_through_canonical_events() {
        let mut engine = EscrowEngine::new();
        engine.register(escrow("order-4"));

        for (ty, expected) in [
            (EventType::OrderFunded, EscrowState::Funded),
            (EventType::OrderShipped, EscrowState::Shipped),
            (EventType::OrderDelivered, EscrowState::Delivered),
            (EventType::OrderCompleted, EscrowState::Completed),
        ] {
            let applied = engine
                .apply(&order_event("order-4", ty, Some(FEE_BUFFER)))
                .unwrap();
            assert_eq!(applied.result, Ok(expected), "at {ty:?}");
        }
        // Timestamps captured along the way:
        let e = engine.get("order-4").unwrap();
        assert!(e.funded_at.is_some() && e.shipped_at.is_some() && e.delivered_at.is_some());
    }

    #[test]
    fn out_of_order_event_is_rejected_and_state_survives() {
        let mut engine = EscrowEngine::new();
        engine.register(escrow("order-5"));

        // Shipped before Funded must be rejected by the state machine.
        let applied = engine
            .apply(&order_event("order-5", EventType::OrderShipped, None))
            .unwrap();
        assert!(matches!(
            applied.result,
            Err(EscrowError::InvalidTransition { .. })
        ));
        assert_eq!(engine.get("order-5").unwrap().state, EscrowState::Created);
    }
}
