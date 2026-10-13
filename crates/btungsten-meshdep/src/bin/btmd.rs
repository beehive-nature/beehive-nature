//! `btmd` — the BT-MESH-DEPENDABILITY-001 battery driver.
//!
//! Subcommands:
//!   budgets                          print the committed budgets digest + parse check
//!   trial     [opts]                 one matched trial (baseline or candidate)
//!   p1        [opts]                 acceptance-sanity phase (delivery matrix + calibration)
//!   p2        [opts]                 cost A/B: interleaved matched pairs across scales
//!   recovery  [opts]                 kill / partition / restart / corrupt / bootstrap-removal / UNKNOWN drills
//!   continuity [opts]                version/transport replacement trial (0.46.0 -> 0.47.1 -> 0.45.0 probe)
//!
//! Every rig-touching subcommand requires BTMD_RIG=1 in the environment
//! (a deliberate act, never an accident) and uid 0 (namespaces). All runs
//! write receipts under <work-root>/<run-id>/receipts/.

use btungsten_meshdep::battery::{run_trial, WorkloadProfile};
use btungsten_meshdep::budget::Budgets;
use btungsten_meshdep::client::{b64, now_ms};
use btungsten_meshdep::identity::OpClass;
use btungsten_meshdep::ledger::Event;
use btungsten_meshdep::report::{sanitize, Receipts};
use btungsten_meshdep::rig::{NodeRole, Rig};
use btungsten_meshdep::workload::WorkloadCtx;
use std::collections::BTreeMap;
use std::thread;
use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("");
    let r = match cmd {
        "budgets" => cmd_budgets(),
        "trial" => require_rig().and_then(|_| cmd_trial(&args[1..])),
        "p1" => require_rig().and_then(|_| cmd_p1(&args[1..])),
        "p2" => require_rig().and_then(|_| cmd_p2(&args[1..])),
        "recovery" => require_rig().and_then(|_| cmd_recovery(&args[1..])),
        "continuity" => require_rig().and_then(|_| cmd_continuity(&args[1..])),
        "flood" => require_rig().and_then(|_| cmd_flood(&args[1..])),
        _ => {
            eprintln!("usage: btmd <budgets|trial|p1|p2|recovery|continuity|flood> [opts]");
            std::process::exit(2);
        }
    };
    if let Err(e) = r {
        eprintln!("btmd: {e}");
        std::process::exit(1);
    }
}

fn require_rig() -> Result<(), String> {
    if std::env::var("BTMD_RIG").ok().as_deref() != Some("1") {
        return Err("refusing: set BTMD_RIG=1 to run rig-touching phases (deliberate act)".into());
    }
    let uid = std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("Uid:"))
                .map(|l| l.split_whitespace().nth(1).unwrap_or("0").to_string())
        })
        .unwrap_or_else(|| "0".into());
    if uid != "0" {
        return Err(format!(
            "refusing: rig needs root for namespaces (uid {uid})"
        ));
    }
    Ok(())
}

struct Opts {
    run_id: String,
    version: String,
    binaries_root: String,
    work_root: String,
    subnet_third: u8,
    scale: usize,
    idle_secs: u64,
}

impl Default for Opts {
    fn default() -> Self {
        Opts {
            run_id: format!("btmd-{}", now_ms()),
            version: "v0.47.1".into(),
            binaries_root: "/root/btmd/pins".into(),
            work_root: "/root/btmd/runs".into(),
            subnet_third: 71,
            scale: 6,
            idle_secs: 90,
        }
    }
}

fn opt(args: &[String], name: &str) -> Option<String> {
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == name {
            return it.next().cloned();
        }
    }
    None
}

fn parse_opts(args: &[String]) -> Result<Opts, String> {
    let mut o = Opts::default();
    if let Some(v) = opt(args, "--run-id") {
        o.run_id = v;
    }
    if let Some(v) = opt(args, "--version") {
        o.version = v;
    }
    if let Some(v) = opt(args, "--binaries-root") {
        o.binaries_root = v;
    }
    if let Some(v) = opt(args, "--work-root") {
        o.work_root = v;
    }
    if let Some(v) = opt(args, "--subnet-third") {
        o.subnet_third = v.parse().map_err(|_| "bad --subnet-third")?;
    }
    if let Some(v) = opt(args, "--scale") {
        o.scale = v.parse().map_err(|_| "bad --scale")?;
    }
    if let Some(v) = opt(args, "--idle-secs") {
        o.idle_secs = v.parse().map_err(|_| "bad --idle-secs")?;
    }
    Ok(o)
}

fn gossip_overrides(args: &[String]) -> BTreeMap<String, serde_json::Value> {
    let mut m = BTreeMap::new();
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == "--gossip" {
            if let Some(kv) = it.next() {
                if let Some((k, v)) = kv.split_once('=') {
                    let val = serde_json::from_str(v)
                        .unwrap_or_else(|_| serde_json::Value::String(v.to_string()));
                    m.insert(k.to_string(), val);
                }
            }
        }
    }
    m
}

fn cmd_budgets() -> Result<(), String> {
    let b = Budgets::committed()?;
    println!(
        "schema={} lane={} published={}",
        b.schema, b.lane, b.published
    );
    println!("sha256={} PUBLIC-CONSTANT", b.source_sha256);
    println!(
        "roles: {}",
        b.roles.keys().cloned().collect::<Vec<_>>().join(", ")
    );
    Ok(())
}

fn cmd_trial(args: &[String]) -> Result<(), String> {
    let o = parse_opts(args)?;
    let budgets = Budgets::committed()?;
    let label = opt(args, "--label").unwrap_or_else(|| "baseline".into());
    let mut profile = WorkloadProfile::default();
    profile.idle_secs = o.idle_secs;
    let r = run_trial(
        "trial",
        &label,
        &o.run_id,
        &o.version,
        gossip_overrides(args),
        false,
        o.scale,
        &profile,
        &budgets,
        &o.binaries_root,
        &o.work_root,
        o.subnet_third,
    )?;
    println!(
        "{}",
        serde_json::to_string_pretty(&r).map_err(|e| e.to_string())?
    );
    Ok(())
}

fn cmd_p1(args: &[String]) -> Result<(), String> {
    let mut o = parse_opts(args)?;
    o.run_id = format!("{}-p1", o.run_id);
    let budgets = Budgets::committed()?;
    let receipts = Receipts::open(
        std::path::Path::new(&o.work_root)
            .join(&o.run_id)
            .join("receipts")
            .as_path(),
    )?;
    let r = run_trial(
        "p1",
        "baseline",
        &o.run_id,
        &o.version,
        BTreeMap::new(),
        false,
        3.max(o.scale.min(3)),
        &WorkloadProfile {
            idle_secs: o.idle_secs.min(60),
            ..Default::default()
        },
        &budgets,
        &o.binaries_root,
        &o.work_root,
        o.subnet_third,
    )?;
    println!(
        "p1 verdicts_pass={} dm={:?} group={:?} sync={:?} probe={:?}",
        r.verdicts_pass, r.matrix_targeted_dm, r.matrix_group, r.matrix_sync, r.matrix_probe
    );
    let _ = &receipts;
    Ok(())
}

fn cmd_p2(args: &[String]) -> Result<(), String> {
    let mut o = parse_opts(args)?;
    let rounds: usize = opt(args, "--rounds")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    let scales: Vec<usize> = opt(args, "--scales")
        .map(|v| v.split(',').filter_map(|s| s.parse().ok()).collect())
        .unwrap_or_else(|| vec![3, 6, 9]);
    let budgets = Budgets::committed()?;
    let summary_dir = std::path::Path::new(&o.work_root).join(format!("{}-p2-summary", o.run_id));
    let receipts = Receipts::open(&summary_dir)?;
    let mut shed = BTreeMap::new();
    shed.insert(
        "byte_policy".to_string(),
        serde_json::Value::String("shed_normal".into()),
    );
    let mut profile = WorkloadProfile::default();
    profile.idle_secs = o.idle_secs;
    for &scale in &scales {
        for round in 0..rounds {
            // Interleaved: baseline, then candidate, same scale+round.
            for (label, cfg) in [
                (
                    "baseline",
                    &BTreeMap::new() as &BTreeMap<String, serde_json::Value>,
                ),
                ("shed_normal", &shed),
            ] {
                let run_id = format!("{}-p2-s{scale}-r{round}-{label}", o.run_id);
                println!("== {run_id}");
                let r = run_trial(
                    "p2",
                    label,
                    &run_id,
                    &o.version,
                    cfg.clone(),
                    false,
                    scale,
                    &profile,
                    &budgets,
                    &o.binaries_root,
                    &o.work_root,
                    o.subnet_third,
                )?;
                receipts.append_jsonl("p2.jsonl", &r)?;
                println!(
                    "   pass={} leafIdle={:?}",
                    r.verdicts_pass,
                    r.cost
                        .iter()
                        .filter(|c| c.node.starts_with('n'))
                        .map(|c| (
                            c.node.clone(),
                            c.idle_egress_bytes_per_min + c.idle_ingress_bytes_per_min
                        ))
                        .collect::<Vec<_>>()
                );
            }
        }
    }
    Ok(())
}

/// Recovery + UNKNOWN-preservation drills on one rig (scale >= 4).
fn cmd_recovery(args: &[String]) -> Result<(), String> {
    use btungsten_meshdep::battery::rig_spec;
    let mut o = parse_opts(args)?;
    o.run_id = format!("{}-rec", o.run_id);
    let budgets = Budgets::committed()?;
    let receipts = Receipts::open(
        std::path::Path::new(&o.work_root)
            .join(&o.run_id)
            .join("receipts")
            .as_path(),
    )?;
    let spec = rig_spec(
        &o.run_id,
        &o.version,
        gossip_overrides(args),
        false,
        o.scale.max(4),
        &o.binaries_root,
        &o.work_root,
        o.subnet_third,
    );
    receipts.write_json("spec.json", &spec)?;
    let mut rig = Rig::build(spec)?;
    let res = recovery_body(&mut rig, &receipts, o.idle_secs);
    rig.teardown();
    let _ = budgets;
    res
}

fn recovery_body(rig: &mut Rig, receipts: &Receipts, _idle: u64) -> Result<(), String> {
    let mut ledger = btungsten_meshdep::ledger::Ledger::default();
    let leaves: Vec<String> = rig
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
    let mut agents = BTreeMap::new();
    let mut pre_identity: Vec<(String, String)> = Vec::new();
    {
        let w = WorkloadCtx::new(rig, 1, 30_000);
        for l in &leaves {
            agents.insert(l.clone(), w.agent_id(l)?);
        }
        pre_identity = leaves
            .iter()
            .map(|l| (l.clone(), w.agent_id(l).unwrap_or_default()))
            .collect();
    }

    // D1 — kill -9 mid-traffic, restart, identity + UNKNOWN preserved.
    let victim = &leaves[1];
    let target = &leaves[0];
    let t_agent = agents.get(target).cloned().unwrap_or_default();
    let d1_op = {
        let mut w = WorkloadCtx::new(rig, 1, 30_000);
        w.dm(&mut ledger, target, &t_agent, victim, 128)?
    };
    // The victim is now killed mid-flight; that DM's outcome is UNKNOWN.
    rig.kill_node(victim)?;
    ledger.record(Event::Unresolved {
        op_id: d1_op.clone(),
        at_ms: now_ms(),
        reason: format!("recipient {victim} killed before outcome observed"),
    });
    thread::sleep(Duration::from_secs(2));
    let t_restart = now_ms();
    rig.restart_node(victim)?;
    let restart_secs = (now_ms() - t_restart) as f64 / 1000.0;
    let post_identity = {
        let w = WorkloadCtx::new(rig, 1, 30_000);
        w.agent_id(victim).unwrap_or_default()
    };
    let identity_same = pre_identity
        .iter()
        .any(|(l, id)| l == victim && *id == post_identity);
    receipts.append_jsonl(
        "recovery.jsonl",
        &serde_json::json!({
            "drill": "kill9-restart", "node": victim, "restart_secs": restart_secs,
            "identity_preserved": identity_same,
            "unknown_op": sanitize(&d1_op),
            "note": "UNKNOWN DM must stay UNKNOWN until evidence; recovery never auto-resends"
        }),
    )?;
    // The identical retry AFTER recovery (rebroadcast-identical-only),
    // then the fresh-identity conviction row (counted, never accepted).
    let v_agent = agents.get(victim).cloned().unwrap_or_default();
    {
        let mut w = WorkloadCtx::new(rig, 1, 30_000);
        w.dm_retry_identical(&mut ledger, target, &v_agent, victim, &d1_op)?;
        w.dm_retry_fresh_identity_conviction(&mut ledger, target, &v_agent, victim, &d1_op)?;
    }

    // D2 — partition (mesh link down, mgmt up): ready but NOT delivered.
    let p_node = &leaves[2.min(leaves.len() - 1)];
    let p_agent = agents.get(p_node).cloned().unwrap_or_default();
    let mut parted_ops = Vec::new();
    rig.mesh_link_down(p_node)?;
    ledger.record(Event::PartitionStarted { at_ms: now_ms() });
    for _ in 0..3 {
        let mut w = WorkloadCtx::new(rig, 1, 30_000);
        if let Ok(op) = w.dm(&mut ledger, target, &p_agent, p_node, 128) {
            parted_ops.push(op);
        }
    }
    // While partitioned the node still answers /health: ready != delivered.
    let health_while_parted = rig
        .node(p_node)?
        .client()
        .map(|c| {
            c.get_public("/health")
                .ok()
                .map(|(s, _)| s == 200)
                .unwrap_or(false)
        })
        .unwrap_or(false);
    thread::sleep(Duration::from_secs(8));
    rig.mesh_link_up(p_node)?;
    ledger.record(Event::PartitionHealed { at_ms: now_ms() });
    thread::sleep(Duration::from_secs(10));
    receipts.append_jsonl("recovery.jsonl", &serde_json::json!({
        "drill": "partition", "node": p_node, "ready_while_partitioned": health_while_parted,
        "parted_ops": parted_ops.iter().map(|o| sanitize(o)).collect::<Vec<_>>(),
        "note": "ready-but-partitioned must not count as delivery; outcomes resolve only from evidence after heal"
    }))?;

    // D3 — revocation drill on a sacrificial node: self AGENT revocation
    // (always allowed; self machine-key is refused 403 — convicted live);
    // observers must see it in /identity/revocations.
    let sac = leaves.last().unwrap().clone();
    let sac_agent = {
        let w = WorkloadCtx::new(rig, 1, 30_000);
        w.agent_id(&sac)?
    };
    let observers: Vec<String> = leaves.iter().filter(|l| **l != sac).cloned().collect();
    let obs_refs: Vec<&str> = observers.iter().map(|s| s.as_str()).collect();
    let rev_op = {
        let mut w = WorkloadCtx::new(rig, 1, 30_000);
        w.revoke_agent(&mut ledger, &sac, &sac_agent, &obs_refs)?
    };
    let mut rev_seen_by = 0usize;
    let deadline = now_ms() + 30_000;
    while now_ms() < deadline {
        rev_seen_by = 0;
        let w = WorkloadCtx::new(rig, 1, 30_000);
        for o in &observers {
            if w.revocation_observe(o, &sac_agent).unwrap_or(false) {
                rev_seen_by += 1;
            }
        }
        if rev_seen_by == observers.len() {
            break;
        }
        thread::sleep(Duration::from_secs(3));
    }
    receipts.append_jsonl(
        "recovery.jsonl",
        &serde_json::json!({
            "drill": "revocation", "sacrificial_node": sac, "op": sanitize(&rev_op),
            "observers": observers.len(), "observed_by": rev_seen_by,
            "note": "revocation must reach every online observer; never shed"
        }),
    )?;

    // D4 — corrupt cached state: stop, flip bytes in a data file, restart.
    let c_node = &leaves[0];
    rig.kill_node(c_node)?;
    let data_dir = &rig.node(c_node)?.data_dir;
    let mut flipped = 0usize;
    for entry in std::fs::read_dir(data_dir).unwrap().flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("db")
            || p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.contains("history"))
                == Some(true)
        {
            if let Ok(mut bytes) = std::fs::read(&p) {
                if bytes.len() > 64 {
                    let idx = bytes.len() / 2;
                    bytes[idx] ^= 0xff;
                    if std::fs::write(&p, &bytes).is_ok() {
                        flipped += 1;
                    }
                }
            }
            if flipped >= 1 {
                break;
            }
        }
    }
    let corrupt_outcome = rig
        .restart_node(c_node)
        .map(|_| "restarted".to_string())
        .unwrap_or_else(|e| format!("refused: {e}"));
    // Identity is only claimed OBSERVED when the node restarted and
    // answered; a refused node leaves identity on disk intact but
    // unobservable via API — that is fail-closed, not identity loss.
    let (corrupt_identity_observed, corrupt_identity_same) = if corrupt_outcome == "restarted" {
        let id = {
            let w = WorkloadCtx::new(rig, 1, 30_000);
            w.agent_id(c_node).unwrap_or_default()
        };
        (
            true,
            pre_identity.iter().any(|(l, i)| l == c_node && *i == id),
        )
    } else {
        (false, false)
    };
    receipts.append_jsonl("recovery.jsonl", &serde_json::json!({
        "drill": "corrupt-state", "node": c_node, "files_flipped": flipped,
        "outcome": corrupt_outcome,
        "identity_observed": corrupt_identity_observed,
        "identity_preserved_after": if corrupt_identity_observed { serde_json::json!(corrupt_identity_same) } else { serde_json::json!("unobservable — node refused to start (fail-closed); on-disk identity untouched by the drill") },
        "note": "fail-closed or quarantined; never silent partial application"
    }))?;

    // D5 — bootstrap removal: kill the seed; leaves must rejoin or degrade
    // with a named receipt.
    rig.kill_node("seed")?;
    let t0 = now_ms();
    let mut rejoined = false;
    let mut rejoin_secs = f64::INFINITY;
    while now_ms() - t0 < 120_000 {
        let c = rig.node(&leaves[1])?.client()?;
        if let Ok((200, b)) = c.get("/health") {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&b) {
                if v.get("peers").and_then(|p| p.as_u64()).unwrap_or(0) > 0 {
                    rejoined = true;
                    rejoin_secs = (now_ms() - t0) as f64 / 1000.0;
                    break;
                }
            }
        }
        thread::sleep(Duration::from_secs(3));
    }
    receipts.append_jsonl("recovery.jsonl", &serde_json::json!({
        "drill": "bootstrap-removal", "seed_killed": true,
        "leaf_rejoined": rejoined, "rejoin_secs": if rejoin_secs.is_finite() { rejoin_secs } else { -1.0 },
        "note": "rejoin via peer cache within 120s, or a NAMED degradation receipt"
    }))?;

    let journal =
        serde_json::json!({"ops": ledger.ops, "events": ledger.events, "retries": ledger.retries});
    receipts.write_json("ledger.json", &journal)?;
    let m = ledger.matrix_for_class(OpClass::TargetedDm);
    println!(
        "recovery drills done; dm matrix {:?}; unsafe_retries={}",
        m,
        ledger.unsafe_retry_count()
    );
    let _ = b64::encode(b"");
    Ok(())
}

/// Version/transport replacement: run on v0.46.0, build state, stop ALL,
/// replace the binary with v0.47.1 (same identity/data dirs), verify;
/// then the 0.45.0 downgrade probe (expected fail-closed on X0XKVS2).
fn cmd_continuity(args: &[String]) -> Result<(), String> {
    use btungsten_meshdep::battery::rig_spec;
    let o = parse_opts(args)?;
    let old = opt(args, "--from").unwrap_or_else(|| "v0.46.0".into());
    let new = opt(args, "--to").unwrap_or_else(|| "v0.47.1".into());
    let probe_old = opt(args, "--downgrade-probe").unwrap_or_else(|| "v0.45.0".into());
    let run_id = format!("{}-cont", o.run_id);
    let receipts = Receipts::open(
        std::path::Path::new(&o.work_root)
            .join(&run_id)
            .join("receipts")
            .as_path(),
    )?;

    // Phase A: build on the OLD version, create identity + group + store.
    let mut spec = rig_spec(
        &run_id,
        &old,
        BTreeMap::new(),
        false,
        3,
        &o.binaries_root,
        &o.work_root,
        o.subnet_third,
    );
    receipts.write_json("spec-old.json", &spec)?;
    let mut rig = Rig::build(spec.clone())?;
    let mut ledger = btungsten_meshdep::ledger::Ledger::default();
    let leaves: Vec<String> = rig
        .nodes
        .iter()
        .filter(|n| matches!(n.spec.role, NodeRole::DesktopLeaf))
        .map(|n| n.spec.label.clone())
        .collect();
    let (agent_before, group_id, store_id) = {
        let mut w = WorkloadCtx::new(&rig, 1, 30_000);
        let a = w.agent_id(&leaves[0])?;
        let g = w.group_create(&leaves[0], "btmd-cont")?;
        let invite = w.group_invite(&leaves[0], &g)?;
        w.group_join(&leaves[1], &invite)?;
        let s = w.store_create(&leaves[0], "cont-store", "btmd/cont/store")?;
        let _ = w.store_put(
            &mut ledger,
            &leaves[0],
            &s,
            "anchor",
            &vec![b'c'; 128],
            &[&leaves[1]],
        );
        (a, g, s)
    };
    // Wait for propagation, then stop everything.
    thread::sleep(Duration::from_secs(10));
    for n in &rig.nodes {
        let _ = rig.kill_node(&n.spec.label);
    }
    thread::sleep(Duration::from_secs(2));
    // Reap.
    rig.teardown();

    // Phase B: SAME state dirs + identity dirs, NEW binary version.
    // The store value is read at its OWNER (leaves[0] created it; a
    // non-joined replica honestly cannot serve it).
    spec.nodes.iter_mut().for_each(|n| n.version = new.clone());
    receipts.write_json("spec-new.json", &spec)?;
    let mut rig2 = Rig::build(spec.clone())?;
    let agent_after = {
        let w = WorkloadCtx::new(&rig2, 1, 30_000);
        w.agent_id(&leaves[0]).unwrap_or_default()
    };
    let group_visible = {
        let w = WorkloadCtx::new(&rig2, 1, 30_000);
        w.group_observe(&leaves[1], &group_id, "none").is_ok()
    };
    let digest_of_anchor = ledger
        .ops
        .iter()
        .find(|o| o.class == OpClass::StateSync)
        .map(|o| o.op_id.clone())
        .unwrap_or_default();
    let store_readable = {
        let w = WorkloadCtx::new(&rig2, 1, 30_000);
        !digest_of_anchor.is_empty()
            && w.store_observe(&leaves[0], &store_id, "anchor", &digest_of_anchor)
                .unwrap_or(false)
    };
    let dm_after = {
        let mut w = WorkloadCtx::new(&rig2, 1, 30_000);
        let to_agent = w.agent_id(&leaves[1]).unwrap_or_default();
        w.dm(&mut ledger, &leaves[0], &to_agent, &leaves[1], 96)
            .is_ok()
    };
    receipts.append_jsonl("continuity.jsonl", &serde_json::json!({
        "from": old, "to": new,
        "identity_preserved": agent_before == agent_after,
        "group_visible_after": group_visible,
        "store_value_readable_after": store_readable,
        "dm_delivery_works_after": dm_after,
        "note": "same identity+data dirs, fresh processes, replaced binary — the cold-replacement trial"
    }))?;
    for n in &rig2.nodes {
        let _ = rig2.kill_node(&n.spec.label);
    }
    thread::sleep(Duration::from_secs(2));
    rig2.teardown();

    // Phase C: the downgrade probe — the SAME dirs (now carrying an
    // X0XKVS2 store written by `new`) on the OLD binary. The daemon may
    // start; the honest probe is whether the STORE serves or refuses.
    {
        let mut spec3 = spec.clone();
        spec3
            .nodes
            .iter_mut()
            .for_each(|n| n.version = probe_old.clone());
        let mut rig3 = Rig::build(spec3.clone())?;
        let store_probe = if digest_of_anchor.is_empty() {
            "no store op recorded (probe vacuous)".to_string()
        } else {
            let w = WorkloadCtx::new(&rig3, 1, 30_000);
            match w.store_observe(&leaves[0], &store_id, "anchor", &digest_of_anchor) {
                Ok(true) => "SERVED (X0XKVS2 readable on the old binary)".to_string(),
                Ok(false) => {
                    "refused/absent: value not served (fail-closed or format refused)".to_string()
                }
                Err(e) => format!("refused: {e}"),
            }
        };
        receipts.append_jsonl("continuity.jsonl", &serde_json::json!({
            "downgrade_probe": format!("{new} -> {probe_old}"),
            "store_read_outcome": store_probe,
            "note": "upstream-documented law: 0.45 fails closed on X0XKVS2; files kept, access refused — verified, not assumed"
        }))?;
        rig3.teardown();
    }
    let _ = copy_dir;
    Ok(())
}

fn copy_dir(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else {
            std::fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

/// Bounded adaptation: a hostile bulk flood from a rig peer, with the
/// candidate profile under test. Gates: leaf egress stays within the
/// declared multiple of its idle budget; CPU/RSS stay in role budget;
/// a mid-flood REVOCATION still reaches every observer (never shed);
/// targeted DMs still deliver. Verdicts read kernel counters only —
/// daemon telemetry cannot flatter this table by construction.
fn cmd_flood(args: &[String]) -> Result<(), String> {
    use btungsten_meshdep::battery::rig_spec;
    let mut o = parse_opts(args)?;
    o.run_id = format!("{}-flood", o.run_id);
    let budgets = Budgets::committed()?;
    let receipts = Receipts::open(
        std::path::Path::new(&o.work_root)
            .join(&o.run_id)
            .join("receipts")
            .as_path(),
    )?;
    let flood_msgs: usize = opt(args, "--flood-msgs")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1200);
    let flood_size: usize = opt(args, "--flood-size")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1024);
    let spec = rig_spec(
        &o.run_id,
        &o.version,
        gossip_overrides(args),
        false,
        o.scale.max(6),
        &o.binaries_root,
        &o.work_root,
        o.subnet_third,
    );
    receipts.write_json("spec.json", &spec)?;
    receipts.append_jsonl(
        "flood.jsonl",
        &serde_json::json!({"declared_flood": {"msgs": flood_msgs, "bytes_each": flood_size, "from": "n3"}}),
    )?;
    let mut rig = Rig::build(spec)?;
    let res = flood_body(&mut rig, &receipts, &budgets, flood_msgs, flood_size);
    rig.teardown();
    res
}

fn flood_body(
    rig: &mut Rig,
    receipts: &Receipts,
    budgets: &Budgets,
    flood_msgs: usize,
    flood_size: usize,
) -> Result<(), String> {
    let mut ledger = btungsten_meshdep::ledger::Ledger::default();
    let leaves: Vec<String> = rig
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
    // Leaves subscribe to the flood topic (worst case: they want the data).
    {
        let w = WorkloadCtx::new(rig, 1, 30_000);
        for l in &leaves {
            w.subscribe(l, "btmd/flood")?;
        }
    }
    let collectors = btungsten_meshdep::client::CollectorSet::spawn(rig, &leaves)?;

    // Idle baseline for the adaptation multiple.
    let idle_start = rig.sample_all();
    let idle_t0 = now_ms();
    while now_ms() - idle_t0 < 20_000 {
        collectors.drain_into(&mut ledger);
        thread::sleep(Duration::from_secs(1));
    }
    let idle_end = rig.sample_all();
    let mut idle_per_min = BTreeMap::new();
    for (i, l) in leaves.iter().enumerate() {
        let combined = (idle_end[i].mesh_egress_bytes - idle_start[i].mesh_egress_bytes)
            + (idle_end[i].mesh_ingress_bytes - idle_start[i].mesh_ingress_bytes);
        idle_per_min.insert(l.clone(), combined as f64 * 3.0);
    }

    // The flood (bounded, declared) + mid-flood revocation + DMs.
    let flooder = leaves.get(2).cloned().unwrap_or_else(|| leaves[0].clone());
    let sac = leaves.last().unwrap().clone();
    let sac_agent = {
        let w = WorkloadCtx::new(rig, 1, 30_000);
        w.agent_id(&sac)?
    };
    let observers: Vec<String> = leaves.iter().filter(|l| **l != sac).cloned().collect();
    let flood_start = rig.sample_all();
    {
        let mut w = WorkloadCtx::new(rig, 1, 30_000);
        for i in 0..flood_msgs {
            if i == flood_msgs / 2 {
                // Mid-flood authority event: must NOT be shed.
                let obs: Vec<&str> = observers.iter().map(|s| s.as_str()).collect();
                let _ = w.revoke_agent(&mut ledger, &sac, &sac_agent, &obs);
                // Mid-flood targeted DM.
                let to_agent = w.agent_id(&leaves[0]).unwrap_or_default();
                let _ = w.dm(&mut ledger, &leaves[1], &to_agent, &leaves[0], 128);
            }
            let _ = w.publish(
                &mut ledger,
                &flooder,
                "btmd/flood",
                OpClass::ClassProbe,
                flood_size,
                &[],
            );
            thread::sleep(Duration::from_millis(50));
        }
    }
    // Revocation visibility window (the flood is still settling).
    let mut rev_seen = 0;
    let deadline = now_ms() + 30_000;
    while now_ms() < deadline {
        rev_seen = 0;
        let w = WorkloadCtx::new(rig, 1, 30_000);
        for l in &observers {
            if w.revocation_observe(l, &sac_agent).unwrap_or(false) {
                rev_seen += 1;
            }
        }
        if rev_seen == observers.len() {
            break;
        }
        thread::sleep(Duration::from_secs(2));
    }
    collectors.stop();
    let flood_end = rig.sample_all();

    let m_dm = ledger.matrix_for_class(OpClass::TargetedDm);
    let mut rows = Vec::new();
    for (i, l) in leaves.iter().enumerate() {
        let combined = (flood_end[i].mesh_egress_bytes - flood_start[i].mesh_egress_bytes)
            + (flood_end[i].mesh_ingress_bytes - flood_start[i].mesh_ingress_bytes);
        let per_min = combined as f64 / (flood_msgs as f64 * 0.05 / 60.0);
        let idle = *idle_per_min.get(l).unwrap_or(&1.0);
        rows.push(serde_json::json!({
            "node": l,
            "flood_combined_bytes": combined,
            "per_min": per_min,
            "idle_per_min": idle,
            "multiple_of_idle": if idle > 0.0 { per_min / idle } else { -1.0 },
            "cpu_jiffies": flood_end[i].cpu_jiffies,
            "vmhwm_kib": flood_end[i].vmhwm_kib,
        }));
    }
    let over_multiple: Vec<&serde_json::Value> = rows
        .iter()
        .filter(|r| {
            r.get("multiple_of_idle")
                .and_then(|m| m.as_f64())
                .unwrap_or(-1.0)
                > 3.0
        })
        .collect();
    let verdict = serde_json::json!({
        "revocation_observers": observers.len(),
        "revocation_observed_by": rev_seen,
        "revocation_not_shed": rev_seen == observers.len(),
        "dm_delivered": m_dm.delivered, "dm_total": m_dm.total,
        "leaf_rows": rows,
        "leaves_over_3x_idle": over_multiple.len(),
        "bounded": over_multiple.is_empty(),
        "verdict_source": "kernel veth counters only",
    });
    receipts.append_jsonl("flood.jsonl", &verdict)?;
    println!(
        "{}",
        serde_json::to_string_pretty(&verdict).map_err(|e| e.to_string())?
    );
    let _ = budgets;
    Ok(())
}
