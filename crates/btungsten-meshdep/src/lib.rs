//! bTunGsTeN mesh transport dependability battery — `BT-MESH-DEPENDABILITY-001`.
//!
//! One crate, one job: prove (or disprove, with receipts) that the x0x
//! mesh transport stays affordable, useful and recoverable — together, in
//! the same battery — against pinned upstream release binaries.
//!
//! The layering, and what each module owns:
//!
//! | Module | Owns | Never does |
//! |---|---|---|
//! | [`budget`] | the hash-bound acceptance budgets and verdict math | change a threshold after a run |
//! | [`identity`] | canonical operation identities (WB001 `Intent`, SAW-proven codec) | invent a second identity shape |
//! | [`ledger`] | the delivered/acked/lost/duplicated/delayed/replayed/UNKNOWN ledger | call a "ready" peer a delivery |
//! | [`client`] | hand-rolled HTTP/1.1 + SSE against the node loopback API | trust daemon telemetry for bytes |
//! | [`rig`] | netns/veth topology, node lifecycle, OS-level accounting, the rig/trial specs | leave `bootstrap_peers` implicit |
//! | [`rig`] | — | touch any interface it did not create |
//! | [`workload`] | the workload classes (idle, targeted DM, discovery, sync, revocation, reconnect) | save bytes by dropping a required revocation |
//! | [`battery`] | phase orchestration, interleaved matched trials, recovery drills | interleave without matching |
//! | [`report`] | raw JSONL receipts + sanitized in-tree summaries | emit a 64-hex peer id in sanitized output |
//!
//! Laws this crate enforces in code (each one has a red-first test):
//!
//! 1. **UNKNOWN is preserved.** A send whose outcome is unresolved (DM 504
//!    timeout, partition, lost response) is UNKNOWN. It never becomes LOST
//!    or DELIVERED by assumption, and it never authorizes a fresh
//!    operation identity. Reconciliation reuses the identical logical id
//!    (rebroadcast-identical-only — the WB004 handoff law, at transport).
//! 2. **Verdicts read the kernel.** Cost verdicts compute from veth
//!    interface counters and /proc; the daemon's own diagnostics are
//!    recorded, labeled application-level, and are never a verdict source.
//! 3. **Budgets are frozen bytes.** The committed budgets JSON is hashed
//!    into every receipt; a changed budget is a new file and a re-run.
//! 4. **Hermetic by construction.** Every generated node config carries an
//!    explicit `bootstrap_peers` (empty for the seed), `mdns_enabled =
//!    false`, `port_mapping_enabled = false`, and a unique `network_id`
//!    plane; the bridge has no route to any physical network.
//! 5. **Sanitized summaries carry no 64-hex peer identities** (the estate
//!    hex law); raw receipts ride separately, gzipped in-tree.

#![forbid(unsafe_code)]

pub mod battery;
pub mod budget;
pub mod client;
pub mod identity;
pub mod ledger;
pub mod report;
pub mod rig;
pub mod workload;

/// The committed, hash-bound budgets artifact (BT-MESH-DEPENDABILITY-001).
pub const BUDGETS_JSON: &str = include_str!("../budgets/btmd-budgets-1.json");
