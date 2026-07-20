//! Console read-model — the derived [`ConsoleView`] the SKAISTS LOVErnment
//! console renders, and the Phase 0 seam that "lights what's already real."
//!
//! The kernel's inner spine (event bus, escrow, reputation) already produces
//! facts. This crate is the *read surface* over those facts: a pure reducer
//! that folds [`CanonicalEvent`]s into panel-ready state, plus a slot for the
//! P1 [`FarmSnapshot`] that comes from `adapter-autonomi`.
//!
//! Two disciplines from the constitution and the design briefs are load-bearing:
//! - **Derived, never authoritative (R-004).** A `ConsoleView` is a projection
//!   for display. "Your balance / your keys" must be read from authoritative
//!   sources (chain, wallet) — never from this projection. This type exists to
//!   render activity and standing, not to be trusted as a ledger.
//! - **Panels bind to capabilities, not chains.** The node-ops slot holds a
//!   `FarmSnapshot` (the `storage.sovereign` view); it does not know or care
//!   that Autonomi produced it. Swap the storage network, keep the panel.
//!
//! The fold reads only event families that already exist in `shared_types`:
//! Order (market/escrow activity), Product (listings), and Reputation (the P5
//! standing signal). It invents nothing.

#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use shared_types::{CanonicalEvent, EventPayload, EventType};

pub use adapter_autonomi::FarmSnapshot;

/// One line in the console's activity feed — a compact projection of a
/// settlement event. Carries the flat `event_type` (what happened) and the
/// business `reference` it concerns (order id, listing id, or subject DID), so
/// the UI can render and link without re-parsing the payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActivityItem {
    pub event_id: String,
    pub timestamp: i64,
    pub event_type: EventType,
    /// The primary entity this event concerns (order/listing id or DID).
    pub reference: String,
}

/// The whole console's derived state. Assembled once and updated by folding
/// each new bus event through [`ConsoleView::fold`]; the node-ops panel is
/// attached separately via [`ConsoleView::set_farm`] because node telemetry is
/// a derived view, not a bus event (see `adapter-autonomi`).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ConsoleView {
    /// P1 node-ops panel (`storage.sovereign`). `None` until a snapshot is set.
    pub farm: Option<FarmSnapshot>,
    /// Most-recent-last activity feed (Order/Product events).
    pub activity: Vec<ActivityItem>,
    /// P5 standing signal: subject DID → cumulative reputation delta, from
    /// `ReputationUpdated` events (the reputation-engine's output). This is a
    /// standing signal for display, NOT a spendable balance and NOT the full
    /// Respect mechanic — it never renders as cash.
    pub standing: BTreeMap<String, i64>,
}

impl ConsoleView {
    pub fn new() -> Self {
        Self::default()
    }

    /// Attach / replace the P1 node-ops snapshot (from `adapter-autonomi`).
    pub fn set_farm(&mut self, farm: FarmSnapshot) {
        self.farm = Some(farm);
    }

    /// Fold one canonical event into the view. Total and deterministic: the
    /// same event stream always yields the same view. Unmodelled event
    /// families are ignored (a projection is allowed to be partial), never a
    /// panic.
    pub fn fold(&mut self, event: &CanonicalEvent) {
        match &event.payload {
            EventPayload::Order(o) => self.push_activity(event, o.order_id.clone()),
            EventPayload::Product(p) => self.push_activity(event, p.listing_id.clone()),
            EventPayload::Reputation(r) => {
                // Standing accumulates; saturating so adversarial deltas can't
                // overflow-panic a display projection.
                let entry = self.standing.entry(r.subject_did.clone()).or_insert(0);
                *entry = entry.saturating_add(r.score_delta);
                // A reputation change is also worth showing in the feed.
                self.push_activity(event, r.subject_did.clone());
            }
            // Message / Dispute / DidLinked / Bnri: not surfaced by this v1
            // projection. Additive later; ignoring them is correct, not a gap.
            _ => {}
        }
    }

    /// Fold a whole batch in order (convenience for replaying a bus slice).
    pub fn fold_all<'a, I>(&mut self, events: I)
    where
        I: IntoIterator<Item = &'a CanonicalEvent>,
    {
        for e in events {
            self.fold(e);
        }
    }

    fn push_activity(&mut self, event: &CanonicalEvent, reference: String) {
        self.activity.push(ActivityItem {
            event_id: event.event_id.clone(),
            timestamp: event.timestamp,
            event_type: event.event_type,
            reference,
        });
    }

    /// Standing for a DID (0 if unseen) — a small read helper for panels.
    pub fn standing_of(&self, did: &str) -> i64 {
        self.standing.get(did).copied().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // `AntctlClient` is the trait that provides `status()`; a trait method is
    // only callable with the trait in scope, even though the impl is inherent
    // to the mock.
    use adapter_autonomi::{AntctlClient, MockAntctlClient};
    use shared_types::{OrderEvent, ProductEvent, ReputationEvent, SourceChain};

    fn order_event(id: &str, et: EventType, order_id: &str) -> CanonicalEvent {
        CanonicalEvent {
            event_id: id.into(),
            event_type: et,
            timestamp: 1_782_000_000,
            source_chain: SourceChain::Zano,
            source_ref: format!("zano-tx-{id}"),
            payload: EventPayload::Order(OrderEvent {
                order_id: order_id.into(),
                buyer_did: "did:plc:buyer".into(),
                seller_did: "did:plc:seller".into(),
                amount: 5_000_000,
                asset_id: "fusd-asset-id".into(),
                fee_buffer_zano: None,
                escrow_wallet_id: None,
                tracking: None,
                carrier: None,
            }),
            canonicalized_by: "chain-zano".into(),
        }
    }

    fn product_event(id: &str, listing_id: &str) -> CanonicalEvent {
        CanonicalEvent {
            event_id: id.into(),
            event_type: EventType::ProductListed,
            timestamp: 1_782_000_100,
            source_chain: SourceChain::Vaulta,
            source_ref: format!("vaulta-tx-{id}"),
            payload: EventPayload::Product(ProductEvent {
                listing_id: listing_id.into(),
                seller_did: "did:plc:seller".into(),
                category: None,
                title: Some("Heirloom hemp seeds".into()),
                amount: Some(5_000_000),
                asset_id: Some("fusd-asset-id".into()),
            }),
            canonicalized_by: "chain-eos".into(),
        }
    }

    fn reputation_event(id: &str, subject: &str, delta: i64) -> CanonicalEvent {
        CanonicalEvent {
            event_id: id.into(),
            event_type: EventType::ReputationUpdated,
            timestamp: 1_782_000_200,
            source_chain: SourceChain::Vaulta,
            source_ref: format!("rep-{id}"),
            payload: EventPayload::Reputation(ReputationEvent {
                subject_did: subject.into(),
                score_delta: delta,
                basis_ref: None,
            }),
            canonicalized_by: "reputation-engine".into(),
        }
    }

    #[test]
    fn empty_view_is_default() {
        let v = ConsoleView::new();
        assert!(v.farm.is_none());
        assert!(v.activity.is_empty());
        assert!(v.standing.is_empty());
        assert_eq!(v.standing_of("did:plc:nobody"), 0);
    }

    #[test]
    fn order_and_product_events_become_activity_in_order() {
        let mut v = ConsoleView::new();
        v.fold_all([
            &order_event("e1", EventType::OrderPlaced, "order-1"),
            &product_event("e2", "listing-9"),
            &order_event("e3", EventType::OrderFunded, "order-1"),
        ]);
        assert_eq!(v.activity.len(), 3);
        assert_eq!(v.activity[0].event_type, EventType::OrderPlaced);
        assert_eq!(v.activity[0].reference, "order-1");
        assert_eq!(v.activity[1].event_type, EventType::ProductListed);
        assert_eq!(v.activity[1].reference, "listing-9");
    }

    #[test]
    fn reputation_accumulates_into_standing_and_feed() {
        let mut v = ConsoleView::new();
        v.fold(&reputation_event("r1", "did:plc:seller", 5));
        v.fold(&reputation_event("r2", "did:plc:seller", 3));
        v.fold(&reputation_event("r3", "did:plc:buyer", -2));
        assert_eq!(v.standing_of("did:plc:seller"), 8);
        assert_eq!(v.standing_of("did:plc:buyer"), -2);
        // each reputation event also shows in the activity feed
        assert_eq!(v.activity.len(), 3);
    }

    #[test]
    fn fold_is_deterministic() {
        let events = [
            order_event("e1", EventType::OrderPlaced, "order-1"),
            reputation_event("r1", "did:plc:seller", 5),
            product_event("e2", "listing-9"),
        ];
        let mut a = ConsoleView::new();
        let mut b = ConsoleView::new();
        a.fold_all(events.iter());
        b.fold_all(events.iter());
        assert_eq!(a, b);
    }

    #[test]
    fn farm_panel_attaches_from_adapter() {
        let report = MockAntctlClient::pinned().unwrap().status().unwrap();
        let mut v = ConsoleView::new();
        v.set_farm(FarmSnapshot::from_report(&report));
        let farm = v.farm.expect("farm set");
        assert_eq!(farm.nodes_total, 3);
    }

    #[test]
    fn view_serializes_to_json_for_the_web_layer() {
        let mut v = ConsoleView::new();
        v.fold(&order_event("e1", EventType::OrderPlaced, "order-1"));
        let json = serde_json::to_string(&v).unwrap();
        let back: ConsoleView = serde_json::from_str(&json).unwrap();
        assert_eq!(v, back);
    }
}
