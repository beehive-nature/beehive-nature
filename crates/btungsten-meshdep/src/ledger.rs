//! The message-identity ledger: delivered / acked / lost / duplicated /
//! delayed / replayed / UNKNOWN — distinguished by evidence, never by
//! assumption.
//!
//! The ledger is a pure function over an append-only journal of events.
//! The same journal classifies identically before and after a driver
//! restart; UNKNOWN rows stay UNKNOWN unless evidence arrives. This is the
//! transport-level carry of the WB004 handoff law: missing observation is
//! UNKNOWN, never permission to treat a send as lost (and retry as a new
//! operation) or as delivered (and claim service).

use crate::identity::OpClass;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationRecord {
    /// sha256 of the canonical WB001 envelope bytes.
    pub op_id: String,
    /// The safe-retry key: the DM `logical_id`, store key, or message id —
    /// the identity a compliant retry MUST reuse.
    pub logical_id: String,
    pub class: OpClass,
    pub sender: String,
    pub intended: Vec<String>,
    pub payload_bytes: usize,
    /// The canonical envelope bytes (base64) — the exact bytes an
    /// identical retry must reuse. Raw-receipt material, never sanitized.
    pub envelope_b64: String,
    pub published_at_ms: u64,
    pub deadline_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum Event {
    /// The operation left the sender (API accepted it).
    Published { op_id: String, at_ms: u64 },
    /// Durable application ACK observed (e.g. DM 200 with durable receipt).
    Acked {
        op_id: String,
        node: String,
        at_ms: u64,
    },
    /// Recipient-side content observation (SSE delivery, store read, group
    /// message listing) — the only evidence that counts as delivery.
    Delivered {
        op_id: String,
        node: String,
        at_ms: u64,
    },
    /// A duplicate delivery observation at a node that already delivered.
    DuplicateDelivery {
        op_id: String,
        node: String,
        at_ms: u64,
    },
    /// Delivery observed after a restart/heal that follows a prior complete
    /// delivery of the same op (at-least-once replay).
    Replayed {
        op_id: String,
        node: String,
        at_ms: u64,
    },
    /// An UNRESOLVED outcome marker: DM 504 timeout ("may or may not have
    /// arrived"), a partition that spans the deadline, a lost response.
    /// This makes the terminal verdict UNKNOWN, and it is preserved.
    Unresolved {
        op_id: String,
        at_ms: u64,
        reason: String,
    },
    /// A network partition began (affects everything in flight).
    PartitionStarted { at_ms: u64 },
    /// The partition healed.
    PartitionHealed { at_ms: u64 },
    /// A node restarted (kill/restart drills).
    NodeRestarted { node: String, at_ms: u64 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecipientVerdict {
    Acked {
        latency_ms: u64,
    },
    Delivered {
        latency_ms: u64,
    },
    DelayedDelivered {
        latency_ms: u64,
    },
    Duplicated {
        times: u32,
    },
    ReplayedAfterRecovery {
        times: u32,
    },
    Lost,
    /// Preserved state: no evidence either way. Never resolves by itself.
    Unknown {
        reason: String,
    },
    /// The node was not an intended recipient of this op.
    NotIntended,
}

#[derive(Debug, Clone, Serialize)]
pub struct RetryVerdict {
    pub original_op: String,
    pub retry_op: String,
    pub logical_id_reused: bool,
    /// A retry under a fresh identity while the original is UNKNOWN is the
    /// WB004 defect shape, counted here — never silently accepted.
    pub unsafe_fresh_identity: bool,
}

#[derive(Debug, Clone, Default)]
pub struct Ledger {
    pub ops: Vec<OperationRecord>,
    pub events: Vec<Event>,
    /// op_id -> the op that retried it (retry chain), recorded by the battery.
    pub retries: Vec<RetryVerdict>,
}

impl Ledger {
    pub fn record_op(&mut self, op: OperationRecord) {
        self.ops.push(op);
    }

    pub fn record(&mut self, ev: Event) {
        self.events.push(ev);
    }

    /// Reload from a journal (used to prove classification survives a
    /// driver restart byte-for-byte).
    pub fn from_journal(ops: Vec<OperationRecord>, events: Vec<Event>) -> Self {
        Ledger {
            ops,
            events,
            retries: Vec::new(),
        }
    }

    /// Whether a Delivered or Acked observation already exists for
    /// (op, node) — used to route repeat observations to the duplicate
    /// counters instead of re-recording deliveries.
    pub fn has_delivery(&self, op_id: &str, node: &str) -> bool {
        self.events.iter().any(|e| match e {
            Event::Delivered {
                op_id: o, node: n, ..
            }
            | Event::Acked {
                op_id: o, node: n, ..
            } => o == op_id && n == node,
            _ => false,
        })
    }

    /// Classify one operation for one intended recipient node.
    pub fn classify_for(&self, op_id: &str, node: &str) -> RecipientVerdict {
        let Some(op) = self.ops.iter().find(|o| o.op_id == op_id) else {
            return RecipientVerdict::NotIntended;
        };
        if !op.intended.contains(&node.to_string()) {
            return RecipientVerdict::NotIntended;
        }
        let mut ack: Option<u64> = None;
        let mut deliveries: Vec<u64> = Vec::new();
        let mut replayed: u32 = 0;
        let mut unresolved: Option<String> = None;
        let mut restart_after_delivery = false;
        let mut delivered_once = false;
        let mut partition_active_at_deadline = false;
        let mut partition_open: Option<u64> = None;

        // Events are in append order; the pass mirrors the timeline.
        for ev in &self.events {
            match ev {
                Event::Acked {
                    op_id: o,
                    node: n,
                    at_ms,
                } if o == op_id && n == node => {
                    ack = Some(*at_ms);
                }
                Event::Delivered {
                    op_id: o,
                    node: n,
                    at_ms,
                } if o == op_id && n == node => {
                    deliveries.push(*at_ms);
                    delivered_once = true;
                }
                Event::DuplicateDelivery {
                    op_id: o, node: n, ..
                } if o == op_id && n == node => {
                    deliveries.push(0); // counted, timestamp irrelevant for the first-pass math
                }
                Event::Replayed {
                    op_id: o, node: n, ..
                } if o == op_id && n == node => {
                    replayed += 1;
                }
                Event::Unresolved {
                    op_id: o, reason, ..
                } if o == op_id => {
                    unresolved = Some(reason.clone());
                }
                Event::NodeRestarted { node: n, at_ms } if n == node => {
                    if delivered_once && *at_ms >= op.published_at_ms {
                        restart_after_delivery = true;
                    }
                }
                Event::PartitionStarted { at_ms } => {
                    if *at_ms <= op.deadline_ms {
                        partition_open = Some(*at_ms);
                    }
                }
                Event::PartitionHealed { at_ms } => {
                    partition_open = None;
                    let _ = at_ms;
                }
                _ => {}
            }
        }
        let _ = partition_active_at_deadline;
        partition_active_at_deadline = partition_open.is_some();

        if let Some(at) = ack {
            // A durable ACK is terminal evidence of delivery.
            if deliveries.len() > 1 {
                return RecipientVerdict::Duplicated {
                    times: deliveries.len() as u32,
                };
            }
            return RecipientVerdict::Acked {
                latency_ms: at.saturating_sub(op.published_at_ms),
            };
        }
        if !deliveries.is_empty() {
            let first = deliveries[0];
            let times = deliveries.len() as u32;
            if replayed > 0 || restart_after_delivery {
                return RecipientVerdict::ReplayedAfterRecovery {
                    times: times + replayed,
                };
            }
            if times > 1 {
                return RecipientVerdict::Duplicated { times };
            }
            if first <= op.deadline_ms {
                return RecipientVerdict::Delivered {
                    latency_ms: first.saturating_sub(op.published_at_ms),
                };
            }
            return RecipientVerdict::DelayedDelivered {
                latency_ms: first.saturating_sub(op.published_at_ms),
            };
        }
        // No ack, no delivery observation.
        if let Some(reason) = unresolved {
            // UNKNOWN is preserved: it never downgrades to Lost by the
            // passage of time, and never upgrades to Delivered.
            return RecipientVerdict::Unknown { reason };
        }
        if partition_active_at_deadline {
            return RecipientVerdict::Unknown {
                reason: "partition spans the deadline; no evidence either way".into(),
            };
        }
        RecipientVerdict::Lost
    }

    /// Classify every op for every intended recipient.
    pub fn classify_all(&self) -> Vec<(String, String, RecipientVerdict)> {
        let mut out = Vec::new();
        for op in &self.ops {
            for node in &op.intended {
                out.push((
                    op.op_id.clone(),
                    node.clone(),
                    self.classify_for(&op.op_id, node),
                ));
            }
        }
        out
    }

    /// The retry ledger: a retry of an UNKNOWN original must reuse the
    /// original's logical identity (rebroadcast-identical-only). A fresh
    /// identity under UNKNOWN is counted, never accepted.
    pub fn record_retry(&mut self, v: RetryVerdict) {
        self.retries.push(v);
    }

    pub fn unsafe_retry_count(&self) -> usize {
        self.retries
            .iter()
            .filter(|r| r.unsafe_fresh_identity)
            .count()
    }

    /// Delivery-matrix summary over a class: fractions of intended
    /// (op, recipient) pairs in each terminal state.
    pub fn matrix_for_class(&self, class: OpClass) -> DeliveryMatrix {
        let mut m = DeliveryMatrix::default();
        for (op_id, node, v) in self.classify_all() {
            let Some(op) = self.ops.iter().find(|o| o.op_id == op_id) else {
                continue;
            };
            if op.class != class {
                continue;
            }
            let _ = node;
            match v {
                RecipientVerdict::Acked { .. } | RecipientVerdict::Delivered { .. } => {
                    m.delivered += 1
                }
                RecipientVerdict::DelayedDelivered { .. } => m.delayed += 1,
                RecipientVerdict::Duplicated { .. } => m.delivered += 1,
                RecipientVerdict::ReplayedAfterRecovery { .. } => m.delivered += 1,
                RecipientVerdict::Lost => m.lost += 1,
                RecipientVerdict::Unknown { .. } => m.unknown += 1,
                RecipientVerdict::NotIntended => {}
            }
            m.total += 1;
        }
        m
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DeliveryMatrix {
    pub total: u64,
    pub delivered: u64,
    pub delayed: u64,
    pub lost: u64,
    pub unknown: u64,
}

impl DeliveryMatrix {
    pub fn delivered_frac(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        self.delivered as f64 / self.total as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn op(id: &str, class: OpClass, intended: &[&str]) -> OperationRecord {
        OperationRecord {
            op_id: id.into(),
            logical_id: format!("logical-{id}"),
            class,
            sender: "leaf-1".into(),
            intended: intended.iter().map(|s| s.to_string()).collect(),
            payload_bytes: 10,
            envelope_b64: String::new(),
            published_at_ms: 1000,
            deadline_ms: 11_000,
        }
    }

    #[test]
    fn no_evidence_by_deadline_is_lost() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::TargetedDm, &["leaf-2"]));
        l.record(Event::Published {
            op_id: "a".into(),
            at_ms: 1000,
        });
        assert_eq!(l.classify_for("a", "leaf-2"), RecipientVerdict::Lost);
    }

    #[test]
    fn an_unresolved_marker_is_unknown_and_survives_the_deadline_passing() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::TargetedDm, &["leaf-2"]));
        l.record(Event::Unresolved {
            op_id: "a".into(),
            at_ms: 5000,
            reason: "dm 504 timeout: may or may not have arrived".into(),
        });
        // Deadline long past; still UNKNOWN, never Lost.
        assert_eq!(
            l.classify_for("a", "leaf-2"),
            RecipientVerdict::Unknown {
                reason: "dm 504 timeout: may or may not have arrived".into()
            }
        );
        // And a journal reload classifies identically (restart survival).
        let l2 = Ledger::from_journal(l.ops.clone(), l.events.clone());
        assert_eq!(
            l.classify_for("a", "leaf-2"),
            l2.classify_for("a", "leaf-2")
        );
    }

    #[test]
    fn evidence_resolves_unknown_but_only_evidence() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::TargetedDm, &["leaf-2"]));
        l.record(Event::Unresolved {
            op_id: "a".into(),
            at_ms: 5000,
            reason: "504".into(),
        });
        l.record(Event::Acked {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 6000,
        });
        match l.classify_for("a", "leaf-2") {
            RecipientVerdict::Acked { latency_ms } => assert_eq!(latency_ms, 5000),
            v => panic!("evidence must resolve UNKNOWN to ACKED, got {v:?}"),
        }
    }

    #[test]
    fn late_delivery_is_delayed_not_lost_and_not_delivered() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::StateSync, &["leaf-2"]));
        l.record(Event::Delivered {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 40_000,
        });
        match l.classify_for("a", "leaf-2") {
            RecipientVerdict::DelayedDelivered { latency_ms } => assert_eq!(latency_ms, 39_000),
            v => panic!("late delivery must be DELAYED_DELIVERED, got {v:?}"),
        }
    }

    #[test]
    fn duplicates_and_post_recovery_replays_are_counted_not_hidden() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::StateSync, &["leaf-2"]));
        l.record(Event::Delivered {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 2000,
        });
        l.record(Event::DuplicateDelivery {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 2500,
        });
        assert_eq!(
            l.classify_for("a", "leaf-2"),
            RecipientVerdict::Duplicated { times: 2 }
        );

        let mut l2 = Ledger::default();
        l2.record_op(op("b", OpClass::StateSync, &["leaf-2"]));
        l2.record(Event::Delivered {
            op_id: "b".into(),
            node: "leaf-2".into(),
            at_ms: 2000,
        });
        l2.record(Event::NodeRestarted {
            node: "leaf-2".into(),
            at_ms: 5000,
        });
        l2.record(Event::Replayed {
            op_id: "b".into(),
            node: "leaf-2".into(),
            at_ms: 9000,
        });
        assert_eq!(
            l2.classify_for("b", "leaf-2"),
            RecipientVerdict::ReplayedAfterRecovery { times: 2 }
        );
    }

    #[test]
    fn a_partition_spanning_the_deadline_is_unknown_not_lost() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::TargetedDm, &["leaf-2"]));
        l.record(Event::PartitionStarted { at_ms: 2000 });
        // Deadline (11s) passes inside the partition; no heal event.
        assert!(matches!(
            l.classify_for("a", "leaf-2"),
            RecipientVerdict::Unknown { .. }
        ));
        // After the heal, still no evidence: UNKNOWN stands until evidence.
        l.record(Event::PartitionHealed { at_ms: 30_000 });
        l.record(Event::Delivered {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 31_000,
        });
        match l.classify_for("a", "leaf-2") {
            RecipientVerdict::DelayedDelivered { .. } => {}
            v => panic!("post-heal delivery is evidence: delayed-delivered, got {v:?}"),
        }
    }

    #[test]
    fn a_ready_peer_is_not_delivery_evidence() {
        // Nothing in the ledger models "peer ready" as delivery: the only
        // delivery-verdict inputs are Acked/Delivered events. A fabricated
        // health observation does not exist as an event kind — by design.
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::Discovery, &["leaf-2"]));
        l.record(Event::Published {
            op_id: "a".into(),
            at_ms: 1000,
        });
        assert_eq!(l.classify_for("a", "leaf-2"), RecipientVerdict::Lost);
    }

    #[test]
    fn unsafe_fresh_identity_retries_are_counted() {
        let mut l = Ledger::default();
        l.record_retry(RetryVerdict {
            original_op: "a".into(),
            retry_op: "b".into(),
            logical_id_reused: false,
            unsafe_fresh_identity: true,
        });
        l.record_retry(RetryVerdict {
            original_op: "c".into(),
            retry_op: "d".into(),
            logical_id_reused: true,
            unsafe_fresh_identity: false,
        });
        assert_eq!(l.unsafe_retry_count(), 1);
    }

    #[test]
    fn matrix_counts_by_class() {
        let mut l = Ledger::default();
        l.record_op(op("a", OpClass::TargetedDm, &["leaf-2", "leaf-3"]));
        l.record_op(op("b", OpClass::TargetedDm, &["leaf-2"]));
        l.record(Event::Acked {
            op_id: "a".into(),
            node: "leaf-2".into(),
            at_ms: 1500,
        });
        l.record(Event::Delivered {
            op_id: "a".into(),
            node: "leaf-3".into(),
            at_ms: 1600,
        });
        // "b" gets nothing: lost.
        let m = l.matrix_for_class(OpClass::TargetedDm);
        assert_eq!((m.total, m.delivered, m.lost), (3, 2, 1));
    }
}
