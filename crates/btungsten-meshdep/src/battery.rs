//! Phase orchestration: matched baseline/candidate trials, interleaved;
//! recovery, adaptation and continuity drills. Every trial writes its own
//! receipts directory: spec, budget hash, per-second accounting samples,
//! ledger journal, diagnostics snapshots (labeled application-level), and
//! the verdict computed against the committed budgets.

use crate::budget::{judge_delivery_fraction, Budgets, GateVerdict};
use crate::client::CollectorSet;
use crate::identity::OpClass;
use crate::ledger::{DeliveryMatrix, Event, Ledger};
use crate::report::{sanitize, Receipts};
use crate::rig::{NodeRole, NodeSpec, Rig, RigSpec};
use crate::workload::WorkloadCtx;
use serde::Serialize;
use std::collections::BTreeMap;
use std::thread;
use std::time::Duration;

/// The identical workload shape every matched trial runs.
#[derive(Debug, Clone, Serialize)]
pub struct WorkloadProfile {
    pub dm_count: usize,
    pub dm_size: usize,
    pub group_msgs: usize,
    pub store_puts: usize,
    pub store_value_size: usize,
    pub probe_bulk_msgs: usize,
    pub probe_bulk_size: usize,
    pub probe_normal_msgs: usize,
    pub probe_normal_size: usize,
    pub idle_secs: u64,
}

impl Default for WorkloadProfile {
    fn default() -> Self {
        WorkloadProfile {
            dm_count: 12,
            dm_size: 256,
            group_msgs: 6,
            store_puts: 10,
            store_value_size: 512,
            probe_bulk_msgs: 40,
            probe_bulk_size: 1024,
            probe_normal_msgs: 40,
            probe_normal_size: 256,
            idle_secs: 90,
        }
    }
}

pub fn rig_spec(
    run_id: &str,
    version: &str,
    leaf_gossip: BTreeMap<String, serde_json::Value>,
    skip_legacy_dm_bus: bool,
    scale: usize,
    binaries_root: &str,
    work_root: &str,
    subnet_third: u8,
) -> RigSpec {
    let mut nodes = vec![NodeSpec {
        label: "seed".into(),
        role: NodeRole::Seed,
        version: version.into(),
        gossip: BTreeMap::new(),
        skip_legacy_dm_bus: false,
    }];
    if scale >= 4 {
        nodes.push(NodeSpec {
            label: "relay".into(),
            role: NodeRole::RelayFull,
            version: version.into(),
            gossip: BTreeMap::new(),
            skip_legacy_dm_bus: false,
        });
    }
    let leaves = scale.saturating_sub(if scale >= 4 { 2 } else { 1 }).max(2);
    for i in 1..=leaves {
        let role = if i == 1 && scale >= 6 {
            NodeRole::ConstrainedLeaf
        } else {
            NodeRole::DesktopLeaf
        };
        nodes.push(NodeSpec {
            label: format!("n{i}"),
            role,
            version: version.into(),
            gossip: leaf_gossip.clone(),
            skip_legacy_dm_bus,
        });
    }
    RigSpec {
        run_id: run_id.into(),
        network_plane: format!("btmd-plane-{run_id}"),
        subnet_third,
        nodes,
        binaries_root: binaries_root.into(),
        work_root: work_root.into(),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NodeCostRow {
    pub node: String,
    pub role: String,
    /// Kernel veth counters during the IDLE window (bytes/min).
    pub idle_egress_bytes_per_min: f64,
    pub idle_ingress_bytes_per_min: f64,
    /// Kernel veth counters across the WHOLE workload phase (workload +
    /// sweep), labeled honestly as such.
    pub phase_egress_bytes: u64,
    pub phase_ingress_bytes: u64,
    pub cpu_percent_sustained: f64,
    pub vmhwm_kib: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrialReceipt {
    pub phase: String,
    pub trial: String,
    pub run_id: String,
    pub x0x_version: String,
    pub leaf_config: BTreeMap<String, serde_json::Value>,
    pub skip_legacy_dm_bus: bool,
    pub scale: usize,
    pub budget_sha256: String,
    pub cost: Vec<NodeCostRow>,
    pub matrix_targeted_dm: DeliveryMatrix,
    pub matrix_group: DeliveryMatrix,
    pub matrix_sync: DeliveryMatrix,
    pub matrix_probe: DeliveryMatrix,
    pub unsafe_retries: usize,
    pub verdicts: Vec<GateVerdict>,
    pub verdicts_pass: bool,
    pub notes: Vec<String>,
}

/// Run one full trial: build, workload, idle window, observation sweep,
/// verdicts, teardown.
#[allow(clippy::too_many_arguments)]
pub fn run_trial(
    phase: &str,
    label: &str,
    run_id: &str,
    version: &str,
    leaf_gossip: BTreeMap<String, serde_json::Value>,
    skip_legacy_dm_bus: bool,
    scale: usize,
    profile: &WorkloadProfile,
    budgets: &Budgets,
    binaries_root: &str,
    work_root: &str,
    subnet_third: u8,
) -> Result<TrialReceipt, String> {
    let out_dir = std::path::Path::new(work_root)
        .join(run_id)
        .join("receipts");
    let receipts = Receipts::open(&out_dir)?;
    let spec = rig_spec(
        run_id,
        version,
        leaf_gossip.clone(),
        skip_legacy_dm_bus,
        scale,
        binaries_root,
        work_root,
        subnet_third,
    );
    receipts.write_json("spec.json", &spec)?;
    let mut rig = Rig::build(spec)?;
    let result = trial_body(phase, label, run_id, &mut rig, profile, budgets, &receipts);
    rig.teardown();
    result
}

#[allow(clippy::too_many_arguments)]
fn trial_body(
    phase: &str,
    label: &str,
    run_id: &str,
    rig: &mut Rig,
    profile: &WorkloadProfile,
    budgets: &Budgets,
    receipts: &Receipts,
) -> Result<TrialReceipt, String> {
    let mut ledger = Ledger::default();
    let node_labels: Vec<String> = rig.nodes.iter().map(|n| n.spec.label.clone()).collect();
    let leaf_labels: Vec<String> = rig
        .nodes
        .iter()
        .filter(|n| {
            matches!(
                n.spec.role,
                NodeRole::DesktopLeaf | NodeRole::ConstrainedLeaf
            )
        })
        .map(|n| n.spec.label.clone())
        .collect();
    const BULK_TOPIC: &str = "x0x/announce/v3/blob";
    const NORMAL_TOPIC: &str = "x0x.machine.announce.v3";
    const PROBE_TOPIC: &str = "btmd/probe";

    // Subscriptions (part of the measured profile).
    {
        let mut w = WorkloadCtx::new(rig, 1, 10_000);
        for l in &leaf_labels {
            w.subscribe(l, BULK_TOPIC)?;
            w.subscribe(l, NORMAL_TOPIC)?;
            w.subscribe(l, PROBE_TOPIC)?;
        }
    }

    let collectors = CollectorSet::spawn(rig, &leaf_labels)?;

    // Calibration probe: a known-size publish must grow the sender's
    // root-side mesh veth RX (the egress=rx direction mapping).
    let cal_pre = rig.sample(&leaf_labels[0])?;
    let cal_op = {
        let mut w = WorkloadCtx::new(rig, 1, 10_000);
        w.publish(
            &mut ledger,
            &leaf_labels[0],
            PROBE_TOPIC,
            OpClass::ClassProbe,
            4096,
            &[],
        )?
    };
    thread::sleep(Duration::from_secs(6));
    let cal_post = rig.sample(&leaf_labels[0])?;
    collectors.drain_into(&mut ledger);
    receipts.append_jsonl(
        "calibration.jsonl",
        &serde_json::json!({
            "op": sanitize(&cal_op),
            "sender_root_mesh_rx_delta": cal_post.mesh_egress_bytes - cal_pre.mesh_egress_bytes,
            "sender_root_mesh_tx_delta": cal_post.mesh_ingress_bytes - cal_pre.mesh_ingress_bytes,
            "note": "root-side rx must grow with the node's own publish (egress=rx mapping)",
        }),
    )?;

    // Group + store setup.
    let (group_id, store_id, owner_hex) = {
        let mut w = WorkloadCtx::new(rig, 1, 10_000);
        let group_id = w.group_create("seed", "btmd-group")?;
        let i1 = w.group_invite("seed", &group_id)?;
        let i2 = w.group_invite("seed", &group_id)?;
        w.group_join(&leaf_labels[0], &i1)?;
        w.group_join(&leaf_labels[1], &i2)?;
        let store_topic = "btmd/store/one";
        let store_id = w.store_create("seed", "btmd-store", store_topic)?;
        let owner_hex = w.agent_id("seed")?;
        for l in leaf_labels.iter().take(2) {
            let mut ok = false;
            for _ in 0..30 {
                if w.store_join(l, &store_id, &owner_hex).is_ok() {
                    ok = true;
                    break;
                }
                thread::sleep(Duration::from_secs(2));
            }
            if !ok {
                receipts
                    .append_jsonl("notes.jsonl", &format!("store join still pending at {l}"))?;
            }
        }
        (group_id, store_id, owner_hex)
    };
    let _ = owner_hex;

    let intended_all: Vec<String> = leaf_labels.clone();
    let intended_sync: Vec<String> = leaf_labels.iter().take(2).cloned().collect();

    // The workload phase (identical shape for every matched trial).
    let t0 = crate::client::now_ms();
    let s_phase_start = rig.sample_all();
    let mut dm_ops: Vec<String> = Vec::new();
    {
        let mut w = WorkloadCtx::new(rig, 1, 10_000);
        let mut agent_ids = BTreeMap::new();
        for l in &node_labels {
            agent_ids.insert(l.clone(), w.agent_id(l)?);
        }
        for i in 0..profile.dm_count {
            let from = &leaf_labels[i % leaf_labels.len()];
            let to_l = &leaf_labels[(i + 1) % leaf_labels.len()];
            let to_agent = agent_ids.get(to_l).cloned().unwrap_or_default();
            if let Ok(op) = w.dm(&mut ledger, from, &to_agent, to_l, profile.dm_size) {
                dm_ops.push(op);
            }
            thread::sleep(Duration::from_millis(300));
        }
        for _ in 0..profile.probe_bulk_msgs {
            let intended: Vec<&str> = intended_all.iter().map(|s| s.as_str()).collect();
            w.publish(
                &mut ledger,
                "seed",
                BULK_TOPIC,
                OpClass::ClassProbe,
                profile.probe_bulk_size,
                &intended,
            )?;
            thread::sleep(Duration::from_millis(150));
        }
        for _ in 0..profile.probe_normal_msgs {
            let intended: Vec<&str> = intended_all.iter().map(|s| s.as_str()).collect();
            w.publish(
                &mut ledger,
                "seed",
                NORMAL_TOPIC,
                OpClass::ClassProbe,
                profile.probe_normal_size,
                &intended,
            )?;
            thread::sleep(Duration::from_millis(150));
        }
        for _ in 0..profile.group_msgs {
            // Group delivery is judged at the MEMBER roster (the two
            // joiners) — a non-member leaf cannot observe group messages
            // and must never be counted as an intended recipient.
            let intended: Vec<&str> = intended_sync.iter().map(|s| s.as_str()).collect();
            let _ = w.group_send(&mut ledger, &leaf_labels[0], &group_id, &intended)?;
            thread::sleep(Duration::from_millis(400));
        }
        for i in 0..profile.store_puts {
            let intended: Vec<&str> = intended_sync.iter().map(|s| s.as_str()).collect();
            let _ = w.store_put(
                &mut ledger,
                "seed",
                &store_id,
                &format!("k{i}"),
                &vec![b'v'; profile.store_value_size],
                &intended,
            );
            thread::sleep(Duration::from_millis(300));
        }
        let intended: Vec<&str> = intended_all.iter().map(|s| s.as_str()).collect();
        let _ = w.discovery_browse(&mut ledger, &leaf_labels[1], &intended);
    }
    // Observation sweep: recipient-side evidence until settled or bounded.
    {
        let w = WorkloadCtx::new(rig, 1, 10_000);
        // The observation window bounds how long recipient-side evidence
        // is waited for. Extending it (BTMD_SWEEP_MS) tests lazy recovery
        // without changing the DELIVERY GATE (convergence_secs_max stays
        // in the frozen budgets — late convergence still counts against
        // the gate as DelayedDelivered, never as on-time).
        let sweep_ms: u64 = std::env::var("BTMD_SWEEP_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(45_000);
        let sweep_deadline = crate::client::now_ms() + sweep_ms;
        loop {
            // Snapshot pending (op, node) pairs first: the ledger is
            // mutated inside the loop.
            let mut pending_group: Vec<(String, String)> = Vec::new();
            let mut pending_sync: Vec<(String, String, String)> = Vec::new();
            for op in &ledger.ops {
                for l in &op.intended {
                    if ledger.has_delivery(&op.op_id, l) {
                        continue;
                    }
                    match op.class {
                        OpClass::GroupOp => pending_group.push((op.op_id.clone(), l.clone())),
                        OpClass::StateSync => {
                            // The store key rides the op's destination
                            // ("store:<key>") — never an index.
                            let key = op.destination_key();
                            pending_sync.push((op.op_id.clone(), l.clone(), key))
                        }
                        _ => {}
                    }
                }
            }
            for (op_id, l) in &pending_group {
                if w.group_observe(l, &group_id, op_id).unwrap_or(false) {
                    ledger.record(Event::Delivered {
                        op_id: op_id.clone(),
                        node: l.clone(),
                        at_ms: crate::client::now_ms(),
                    });
                }
            }
            for (op_id, l, key) in &pending_sync {
                if w.store_observe(l, &store_id, key, op_id).unwrap_or(false) {
                    ledger.record(Event::Delivered {
                        op_id: op_id.clone(),
                        node: l.clone(),
                        at_ms: crate::client::now_ms(),
                    });
                }
            }
            collectors.drain_into(&mut ledger);
            let m_grp = ledger.matrix_for_class(OpClass::GroupOp);
            let m_sync = ledger.matrix_for_class(OpClass::StateSync);
            let pending = (m_grp.total - m_grp.delivered)
                + (m_sync.total - m_sync.delivered - m_sync.unknown);
            if pending == 0 || crate::client::now_ms() > sweep_deadline {
                break;
            }
            thread::sleep(Duration::from_secs(3));
        }
    }
    let s_phase_end = rig.sample_all();
    let phase_secs = (crate::client::now_ms() - t0) as f64 / 1000.0;

    // Idle window with per-second kernel accounting.
    let s_idle_start = rig.sample_all();
    let idle_start_ms = crate::client::now_ms();
    while crate::client::now_ms() - idle_start_ms < profile.idle_secs * 1000 {
        for s in rig.sample_all() {
            let _ = receipts.append_jsonl("samples.jsonl", &s);
        }
        collectors.drain_into(&mut ledger);
        thread::sleep(Duration::from_secs(1));
    }
    let s_idle_end = rig.sample_all();
    let idle_min = profile.idle_secs as f64 / 60.0;

    // Diagnostics snapshots — APPLICATION-LEVEL, never verdict sources.
    for l in &node_labels {
        if let Ok(d) = rig.diagnostics(l, "gossip") {
            let row = serde_json::json!({
                "node": l, "level": "application", "at_ms": crate::client::now_ms(),
                "gossip": serde_json::from_str::<serde_json::Value>(&d).unwrap_or(serde_json::Value::Null)
            });
            let _ = receipts.append_jsonl("diagnostics.jsonl", &row);
        }
    }

    collectors.stop();
    let journal =
        serde_json::json!({"ops": ledger.ops, "events": ledger.events, "retries": ledger.retries});
    receipts.write_json("ledger.json", &journal)?;

    // Cost rows + verdicts.
    let ticks_per_sec = 100.0f64;
    let mut cost = Vec::new();
    let mut verdicts = Vec::new();
    for (i, l) in node_labels.iter().enumerate() {
        let idle_e =
            (s_idle_end[i].mesh_egress_bytes - s_idle_start[i].mesh_egress_bytes) as f64 / idle_min;
        let idle_i = (s_idle_end[i].mesh_ingress_bytes - s_idle_start[i].mesh_ingress_bytes) as f64
            / idle_min;
        let total_cpu_secs = s_idle_end[i].cpu_jiffies as f64 / ticks_per_sec;
        let wall_secs = phase_secs + profile.idle_secs as f64;
        cost.push(NodeCostRow {
            node: l.clone(),
            role: format!("{:?}", rig.node(l)?.spec.role),
            idle_egress_bytes_per_min: idle_e,
            idle_ingress_bytes_per_min: idle_i,
            phase_egress_bytes: s_phase_end[i]
                .mesh_egress_bytes
                .saturating_sub(s_phase_start[i].mesh_egress_bytes),
            phase_ingress_bytes: s_phase_end[i]
                .mesh_ingress_bytes
                .saturating_sub(s_phase_start[i].mesh_ingress_bytes),
            cpu_percent_sustained: total_cpu_secs / wall_secs * 100.0,
            vmhwm_kib: s_idle_end[i].vmhwm_kib,
        });
    }
    let budget_node = leaf_labels
        .iter()
        .find(|l| rig.node(l).map(|n| n.spec.role) == Ok(NodeRole::ConstrainedLeaf))
        .or_else(|| leaf_labels.first())
        .cloned();
    if let Some(bn) = &budget_node {
        let row = cost.iter().find(|c| &c.node == bn).unwrap();
        let role_name = match rig.node(bn)?.spec.role {
            NodeRole::ConstrainedLeaf => "constrained-leaf",
            NodeRole::DesktopLeaf => "desktop-leaf",
            NodeRole::Seed => "infra-seed",
            NodeRole::RelayFull => "relay-full",
        };
        let vs = crate::budget::judge_idle(
            budgets,
            role_name,
            row.idle_egress_bytes_per_min + row.idle_ingress_bytes_per_min,
            row.cpu_percent_sustained,
            row.vmhwm_kib as f64 / 1024.0,
        )?;
        verdicts.extend(vs);
    }
    let m_dm = ledger.matrix_for_class(OpClass::TargetedDm);
    let m_grp = ledger.matrix_for_class(OpClass::GroupOp);
    let m_sync = ledger.matrix_for_class(OpClass::StateSync);
    let m_probe = ledger.matrix_for_class(OpClass::ClassProbe);
    verdicts.push(judge_delivery_fraction(
        "leaf",
        "targeted_dm_delivered_frac",
        m_dm.delivered_frac(),
        1.0,
    ));
    verdicts.push(judge_delivery_fraction(
        "leaf",
        "group_delivered_frac",
        m_grp.delivered_frac(),
        1.0,
    ));
    if m_sync.total > 0 {
        verdicts.push(judge_delivery_fraction(
            "leaf",
            "sync_delivered_frac",
            m_sync.delivered_frac(),
            1.0,
        ));
    }
    let verdicts_pass = verdicts.iter().all(|v| v.pass);
    let receipt = TrialReceipt {
        phase: phase.into(),
        trial: label.into(),
        run_id: run_id.into(),
        x0x_version: rig.nodes[0].spec.version.clone(),
        leaf_config: rig
            .nodes
            .iter()
            .find(|n| n.spec.role == NodeRole::DesktopLeaf)
            .map(|n| n.spec.gossip.clone())
            .unwrap_or_default(),
        skip_legacy_dm_bus: rig.nodes.iter().any(|n| n.spec.skip_legacy_dm_bus),
        scale: node_labels.len(),
        budget_sha256: budgets.source_sha256.clone(),
        cost,
        matrix_targeted_dm: m_dm,
        matrix_group: m_grp,
        matrix_sync: m_sync,
        matrix_probe: m_probe,
        unsafe_retries: ledger.unsafe_retry_count(),
        verdicts,
        verdicts_pass,
        notes: Vec::new(),
    };
    receipts.write_json("verdict.json", &receipt)?;
    Ok(receipt)
}
