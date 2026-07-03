//! In-memory event bus — the runtime nervous system's local transport.
//! Producers (the normalizer) publish `CanonicalEvent`s; consumers (DRO,
//! reputation, frontends, AI agents) subscribe and receive every event
//! published *after* they subscribed. Consumers never call each other —
//! they subscribe to facts on the bus.
//!
//! Semantics inherited from `tokio::sync::broadcast`, pinned by tests:
//! - fan-out: every active subscriber sees every event
//! - no subscribers: publish succeeds, the event is dropped
//! - a slow subscriber that falls more than `capacity` events behind gets
//!   `RecvError::Lagged` on its next `recv` and skips ahead; it never
//!   blocks the publisher or other subscribers
//!
//! The bus-choice revisit (Kafka vs NATS vs Redpanda) is a Phase 3 decision
//! per brief §6; this crate is the in-process seam those would slot behind.

#![forbid(unsafe_code)]

use std::fmt;

use shared_types::CanonicalEvent;
use tokio::sync::broadcast;

/// Re-exported so consumers name the receiver without importing tokio.
pub use tokio::sync::broadcast::Receiver;

pub const DEFAULT_CAPACITY: usize = 1024;

/// Publishing onto the in-memory bus has no failure modes: no-subscriber
/// publishes drop silently and laggards skip ahead on their own side. The
/// error type exists to keep `publish`'s contract stable when a networked
/// backend (with real failure modes) slots behind this seam.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BusError {}

impl fmt::Display for BusError {
    fn fmt(&self, _f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {}
    }
}

impl std::error::Error for BusError {}

#[derive(Debug, Clone)]
pub struct EventBus {
    sender: broadcast::Sender<CanonicalEvent>,
}

impl EventBus {
    /// A bus retaining up to `capacity` in-flight events per subscriber
    /// before laggards start skipping.
    pub fn new(capacity: usize) -> Self {
        let (sender, _initial_rx) = broadcast::channel(capacity);
        EventBus { sender }
    }

    /// Publish one event to every current subscriber. Succeeds (dropping
    /// the event) when nobody is listening.
    pub fn publish(&self, event: CanonicalEvent) -> Result<(), BusError> {
        // send() errors only when there are zero receivers — by design
        // that is a silent drop, not a failure.
        let _ = self.sender.send(event);
        Ok(())
    }

    /// A new subscription receiving every event published from now on
    /// (events published before subscribing are not replayed).
    pub fn subscribe(&self) -> Receiver<CanonicalEvent> {
        self.sender.subscribe()
    }

    /// Active subscriber count (diagnostic).
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        EventBus::new(DEFAULT_CAPACITY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared_types::{EventPayload, EventType, ProductEvent, SourceChain};
    use tokio::sync::broadcast::error::RecvError;

    fn event(n: u32) -> CanonicalEvent {
        CanonicalEvent {
            event_id: format!("evt-{n}"),
            event_type: EventType::ProductListed,
            timestamp: 1_782_000_000 + i64::from(n),
            source_chain: SourceChain::Vaulta,
            source_ref: format!("{n}:tx-{n}"),
            payload: EventPayload::Product(ProductEvent {
                listing_id: format!("listing-{n}"),
                seller_did: "did:plc:seller".into(),
                category: None,
                title: None,
                amount: Some(5_000_000),
                asset_id: Some("fusd-asset-id".into()),
            }),
            canonicalized_by: "normalizer".into(),
        }
    }

    #[tokio::test]
    async fn single_subscriber_receives_published_event() {
        let bus = EventBus::new(16);
        let mut rx = bus.subscribe();

        bus.publish(event(1)).unwrap();

        assert_eq!(rx.recv().await.unwrap(), event(1));
    }

    #[tokio::test]
    async fn fan_out_to_multiple_concurrent_subscribers() {
        let bus = EventBus::new(16);
        let mut rx1 = bus.subscribe();
        let mut rx2 = bus.subscribe();
        let mut rx3 = bus.subscribe();

        bus.publish(event(7)).unwrap();

        let (a, b, c) = tokio::join!(rx1.recv(), rx2.recv(), rx3.recv());
        assert_eq!(a.unwrap(), event(7));
        assert_eq!(b.unwrap(), event(7));
        assert_eq!(c.unwrap(), event(7));
    }

    #[tokio::test]
    async fn publish_with_no_subscribers_succeeds_silently() {
        let bus = EventBus::new(16);
        assert_eq!(bus.subscriber_count(), 0);
        assert_eq!(bus.publish(event(1)), Ok(()));
    }

    #[tokio::test]
    async fn dropped_subscriber_does_not_break_the_rest() {
        let bus = EventBus::new(16);
        let dropped = bus.subscribe();
        let mut alive = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 2);

        drop(dropped);
        bus.publish(event(3)).unwrap();

        assert_eq!(alive.recv().await.unwrap(), event(3));
        assert_eq!(bus.subscriber_count(), 1);
    }

    #[tokio::test]
    async fn lagging_subscriber_skips_ahead_others_unaffected() {
        // Capacity 2: the laggard falls 3 behind and must observe Lagged,
        // then resume from what is still buffered.
        let bus = EventBus::new(2);
        let mut laggard = bus.subscribe();
        let mut prompt = bus.subscribe();

        for n in 1..=3 {
            bus.publish(event(n)).unwrap();
        }

        // The prompt subscriber kept up-ish (capacity holds the last 2).
        assert_eq!(prompt.recv().await.unwrap_err(), RecvError::Lagged(1));
        assert_eq!(prompt.recv().await.unwrap(), event(2));
        assert_eq!(prompt.recv().await.unwrap(), event(3));

        // The laggard reports how far it fell, then continues.
        assert_eq!(laggard.recv().await.unwrap_err(), RecvError::Lagged(1));
        assert_eq!(laggard.recv().await.unwrap(), event(2));
    }

    #[tokio::test]
    async fn late_subscriber_gets_only_future_events() {
        let bus = EventBus::new(16);
        let mut early = bus.subscribe();
        bus.publish(event(1)).unwrap();

        let mut late = bus.subscribe();
        bus.publish(event(2)).unwrap();

        assert_eq!(early.recv().await.unwrap(), event(1));
        assert_eq!(early.recv().await.unwrap(), event(2));
        // The late subscriber never sees event 1.
        assert_eq!(late.recv().await.unwrap(), event(2));
    }
}
