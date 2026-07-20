//! `storage.sovereign` node-ops adapter — turn Autonomi node telemetry
//! (`antctl status`) into a deterministic, panel-ready [`NodeSnapshot`].
//!
//! This is Panel 1 of the SKAISTS LOVErnment console ("is my node network
//! healthy and earning?"). It is the first in-repo seam for `storage.sovereign`;
//! the constitution names Autonomi as the reference implementation, and this
//! crate is where the kernel actually reaches it.
//!
//! What this is — and, just as importantly, what it is NOT:
//! - **Node telemetry is a derived view (R-004), not a settlement fact.** It
//!   never becomes a [`shared_types::CanonicalEvent`] and never rides the bus.
//!   The event schema's payload families model private-commerce settlement, and
//!   `shared_types::events` states plainly that reusing a family for data it
//!   does not describe "would make the payload lie." A node-ops stat is none of
//!   those families, so this adapter yields a *view type the console reads
//!   directly* — mirroring the `storage.sovereign` design brief §6: "aggregated
//!   node stats are a derived view (R-004 tier) ... never the indexer."
//! - **No datum is invented.** Every [`NodeStatus`] field comes from `antctl` /
//!   Node Launchpad output. A number `antctl` does not emit is a founder
//!   question, not a placeholder (the brief's no-fake-number rule; the house
//!   already caught one lorem-ipsum "proof of assets" page — we don't ship that).
//! - **Talking to the real `antctl`** (spawning the binary, parsing its JSON)
//!   gates on a working node install; it lives behind the [`AntctlClient`]
//!   trait. v1 ships [`MockAntctlClient`] over a pinned fixture. There is no
//!   `todo!()` in a shipped path — the unbuilt spawn work sits behind the trait,
//!   not behind a panic.
//!
//! UNVERIFIED (tracked, not hidden — same discipline as `chain-exsat-evm`'s
//! signature table): the exact JSON keys and units of a live `antctl status
//! --json` are not yet confirmed against a running node. [`NodeStatus`] mirrors
//! the *documented* Launchpad data set; the pinned fixture is our stated
//! assumption. When a real node runs, capture its output and reconcile.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// The pinned `antctl status` fixture (repo `fixtures/`). Lets tests and a
/// first-run console render from a stable record before a real node exists.
pub const FIXTURE: &str = include_str!("../../../fixtures/antctl-status-fixture.json");

/// Lifecycle state of a single node, as reported by `antctl`.
///
/// `#[serde(other)]` gives a forward-compatible `Unknown` sink: if a future
/// `antctl` emits a state string we do not model yet, deserialization still
/// succeeds and the console shows it as unknown rather than crashing — the same
/// "version by addition, never mutation" posture as the event schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum NodeState {
    Running,
    Starting,
    Restarting,
    Stopped,
    Added,
    Removed,
    /// A state string this version does not model (forward-compat sink).
    #[serde(other)]
    Unknown,
}

impl NodeState {
    /// A node counts toward "up" only when it is actually `Running`. Starting/
    /// restarting are in-between, not earning; anything else is down.
    pub fn is_running(self) -> bool {
        matches!(self, NodeState::Running)
    }
}

/// How a node reaches the network (NAT traversal), per `antctl` flags
/// (`--upnp` / `--home-network`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum Connection {
    Upnp,
    HomeNetwork,
    /// A connection mode this version does not model (forward-compat sink).
    #[serde(other)]
    Unknown,
}

/// One node's telemetry, mirroring the documented `antctl` / Launchpad fields.
///
/// `ant_earned` is kept as the **exact string** `antctl` reports. ANT is an
/// ERC-20 with its own decimals; parsing it into a float here would invent
/// precision the tool never promised (and summing floats across nodes would
/// compound the lie). The console displays the exact per-node figure; any
/// network-wide total is a founder question, not a computed float.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeStatus {
    pub node_id: String,
    pub status: NodeState,
    pub memory_mb: u64,
    pub bandwidth_in_kbps: u64,
    pub bandwidth_out_kbps: u64,
    pub storage_used_mb: u64,
    pub records_stored: u64,
    /// The user's Arbitrum rewards address (`--rewards-address`). This is the
    /// user's money; the console treats key backup as a first-class step.
    pub rewards_address: String,
    /// Exact ANT-earned string as reported — never floated (see type docs).
    pub ant_earned: String,
    pub connection: Connection,
}

/// What one `antctl status` call returns: a timestamp and the node set.
///
/// `as_of` comes from the tool, so a snapshot's freshness is the network's own
/// clock, not a value the console makes up.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StatusReport {
    /// Unix seconds when `antctl` produced this report.
    pub as_of: i64,
    pub nodes: Vec<NodeStatus>,
}

/// The one-glance hero state of the node-ops panel (brief §3A):
/// green *earning* / amber *idle* / red *down*.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeHealth {
    /// At least one node running and the network is storing records.
    Earning,
    /// Nodes present and running, but nothing stored yet (warming up).
    Idle,
    /// No nodes, or none running.
    Down,
}

/// The derived view the console's node-ops panel renders. Pure function of a
/// [`StatusReport`]: identical reports produce identical snapshots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeSnapshot {
    pub nodes: Vec<NodeStatus>,
    pub nodes_total: usize,
    pub nodes_running: usize,
    /// Sum of `storage_used_mb` across nodes (integers — safe to sum).
    pub storage_used_mb: u64,
    /// Sum of `records_stored` across nodes (integers — safe to sum).
    pub records_stored: u64,
    pub health: NodeHealth,
    /// Carried from the report's `as_of` (the network's clock).
    pub as_of: i64,
}

impl NodeSnapshot {
    /// Fold a report into the panel view. Total, deterministic, never panics —
    /// including on an empty node set (which is a valid, `Down` snapshot).
    pub fn from_report(report: &StatusReport) -> NodeSnapshot {
        let nodes_total = report.nodes.len();
        let nodes_running = report
            .nodes
            .iter()
            .filter(|n| n.status.is_running())
            .count();
        // saturating_add: telemetry is untrusted input; a hostile or buggy node
        // reporting u64::MAX must not overflow-panic the console.
        let mut storage_used_mb = 0u64;
        let mut records_stored = 0u64;
        for n in &report.nodes {
            storage_used_mb = storage_used_mb.saturating_add(n.storage_used_mb);
            records_stored = records_stored.saturating_add(n.records_stored);
        }

        let health = if nodes_total == 0 || nodes_running == 0 {
            NodeHealth::Down
        } else if records_stored > 0 {
            NodeHealth::Earning
        } else {
            NodeHealth::Idle
        };

        NodeSnapshot {
            nodes: report.nodes.clone(),
            nodes_total,
            nodes_running,
            storage_used_mb,
            records_stored,
            health,
            as_of: report.as_of,
        }
    }
}

/// Anything that can produce the current node status. The real implementation
/// (spawn `antctl`, parse its JSON) lands behind this trait; v1 uses
/// [`MockAntctlClient`]. Keeping it a trait is the whole point of the adapter
/// doctrine: `storage.sovereign` is a replaceable capability, and a future data
/// network slots in here without the console noticing.
pub trait AntctlClient {
    fn status(&self) -> Result<StatusReport, AntctlError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AntctlError {
    /// The `antctl` binary is not installed / not on PATH.
    NotInstalled,
    /// Spawning or communicating with `antctl` failed.
    Spawn(String),
    /// `antctl` output could not be parsed into a [`StatusReport`].
    Parse(String),
}

impl std::fmt::Display for AntctlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AntctlError::NotInstalled => write!(f, "antctl is not installed"),
            AntctlError::Spawn(e) => write!(f, "antctl spawn/io: {e}"),
            AntctlError::Parse(e) => write!(f, "antctl output parse: {e}"),
        }
    }
}

impl std::error::Error for AntctlError {}

/// v1 client: serves a fixed [`StatusReport`] parsed from JSON (the pinned
/// fixture, or any captured `antctl` output). This is how the console renders
/// real-shaped data before a node is running, exactly like the other adapters'
/// mock-first path.
#[derive(Debug, Clone)]
pub struct MockAntctlClient {
    report: StatusReport,
}

impl MockAntctlClient {
    /// Build from a `StatusReport` directly.
    pub fn new(report: StatusReport) -> Self {
        Self { report }
    }

    /// Parse from `antctl status --json`-shaped JSON (a `{as_of, nodes}` object).
    pub fn from_json(s: &str) -> Result<Self, AntctlError> {
        let report: StatusReport =
            serde_json::from_str(s).map_err(|e| AntctlError::Parse(e.to_string()))?;
        Ok(Self { report })
    }

    /// The pinned repo fixture — a stable record for tests and first-run.
    pub fn pinned() -> Result<Self, AntctlError> {
        Self::from_json(FIXTURE)
    }
}

impl AntctlClient for MockAntctlClient {
    fn status(&self) -> Result<StatusReport, AntctlError> {
        Ok(self.report.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(id: &str, state: NodeState, storage: u64, records: u64) -> NodeStatus {
        NodeStatus {
            node_id: id.into(),
            status: state,
            memory_mb: 100,
            bandwidth_in_kbps: 500,
            bandwidth_out_kbps: 500,
            storage_used_mb: storage,
            records_stored: records,
            rewards_address: "0xFIXTURE".into(),
            ant_earned: "0.0000".into(),
            connection: Connection::Upnp,
        }
    }

    #[test]
    fn pinned_fixture_parses_and_has_three_nodes() {
        let client = MockAntctlClient::pinned().expect("fixture parses");
        let report = client.status().unwrap();
        assert_eq!(report.nodes.len(), 3);
        assert_eq!(report.as_of, 1_782_200_000);
        // two running, one starting — from the fixture.
        assert_eq!(report.nodes[0].status, NodeState::Running);
        assert_eq!(report.nodes[2].status, NodeState::Starting);
        assert_eq!(report.nodes[2].connection, Connection::HomeNetwork);
    }

    #[test]
    fn pinned_fixture_snapshot_is_earning() {
        let report = MockAntctlClient::pinned().unwrap().status().unwrap();
        let snap = NodeSnapshot::from_report(&report);
        assert_eq!(snap.nodes_total, 3);
        assert_eq!(snap.nodes_running, 2);
        assert_eq!(snap.health, NodeHealth::Earning);
        // storage/records are integer sums of the three fixture nodes.
        assert_eq!(snap.storage_used_mb, 2048 + 1792 + 256);
        assert_eq!(snap.records_stored, 15342 + 12987 + 41);
        assert_eq!(snap.as_of, report.as_of);
    }

    #[test]
    fn empty_report_is_down_and_never_panics() {
        let report = StatusReport {
            as_of: 42,
            nodes: vec![],
        };
        let snap = NodeSnapshot::from_report(&report);
        assert_eq!(snap.nodes_total, 0);
        assert_eq!(snap.nodes_running, 0);
        assert_eq!(snap.storage_used_mb, 0);
        assert_eq!(snap.records_stored, 0);
        assert_eq!(snap.health, NodeHealth::Down);
        assert_eq!(snap.as_of, 42);
    }

    #[test]
    fn running_but_no_records_is_idle() {
        let report = StatusReport {
            as_of: 1,
            nodes: vec![node("a", NodeState::Running, 10, 0)],
        };
        assert_eq!(NodeSnapshot::from_report(&report).health, NodeHealth::Idle);
    }

    #[test]
    fn nodes_present_but_none_running_is_down() {
        let report = StatusReport {
            as_of: 1,
            nodes: vec![
                node("a", NodeState::Stopped, 10, 5),
                node("b", NodeState::Starting, 10, 5),
            ],
        };
        // Starting does not count as running; nothing is Running → Down.
        let snap = NodeSnapshot::from_report(&report);
        assert_eq!(snap.nodes_running, 0);
        assert_eq!(snap.health, NodeHealth::Down);
    }

    #[test]
    fn snapshot_is_deterministic() {
        let report = MockAntctlClient::pinned().unwrap().status().unwrap();
        let a = NodeSnapshot::from_report(&report);
        let b = NodeSnapshot::from_report(&report);
        assert_eq!(a, b);
    }

    #[test]
    fn storage_sum_saturates_instead_of_overflowing() {
        let report = StatusReport {
            as_of: 1,
            nodes: vec![
                node("a", NodeState::Running, u64::MAX, 1),
                node("b", NodeState::Running, 5, 1),
            ],
        };
        // Hostile/buggy telemetry must not panic the console.
        let snap = NodeSnapshot::from_report(&report);
        assert_eq!(snap.storage_used_mb, u64::MAX);
        assert_eq!(snap.health, NodeHealth::Earning);
    }

    #[test]
    fn unknown_state_and_connection_deserialize_to_sink() {
        // Forward-compat: an antctl string we don't model still parses.
        let json = r#"{
            "as_of": 7,
            "nodes": [{
                "node_id": "z", "status": "some_future_state",
                "memory_mb": 1, "bandwidth_in_kbps": 1, "bandwidth_out_kbps": 1,
                "storage_used_mb": 1, "records_stored": 1,
                "rewards_address": "0x0", "ant_earned": "0", "connection": "quantum_relay"
            }]
        }"#;
        let client = MockAntctlClient::from_json(json).expect("parses via sink");
        let n = &client.status().unwrap().nodes[0];
        assert_eq!(n.status, NodeState::Unknown);
        assert_eq!(n.connection, Connection::Unknown);
    }

    #[test]
    fn bad_json_is_a_parse_error_not_a_panic() {
        assert!(matches!(
            MockAntctlClient::from_json("{ not json"),
            Err(AntctlError::Parse(_))
        ));
    }
}
