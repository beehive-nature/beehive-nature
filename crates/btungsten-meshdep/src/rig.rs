//! The rig: per-node user+network namespaces, two isolated bridges (mesh
//! plane + management plane), pinned `x0xd` processes, and OS-level
//! accounting.
//!
//! Topology per node (kernel-level accounting, no daemon self-report):
//!
//! ```text
//!                 mesh bridge (no route to any physical net)
//!   ┌────────┬────┴─────┬─────────┐
//!  bmR-A   bmR-B   ... (root-side veths, bridge ports)
//!   │rx=egress │tx=ingress        │  ← ACCOUNTING reads these counters
//!  eth0     eth0                  │
//!  [ netns A ]  [ netns B ] ...   │  x0xd bind_address (QUIC/mesh)
//!   ── mgmt bridge (API only) ────┤
//!  bpR-A ←→ eth1  (per-node /30 pair to root)
//!    ↑ driver HTTP (Authorization: Bearer) — never touches the mesh plane
//! ```
//!
//! A node's MESH EGRESS is the root-side mesh-veth `rx_bytes` (packets the
//! node sends out eth0); MESH INGRESS is its `tx_bytes`. API polling rides
//! the management plane and never pollutes the mesh counters. The P1
//! calibration probe verifies this direction mapping with a known-size
//! transfer before any verdict uses it.

use crate::client::NodeClient;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeRole {
    Seed,
    RelayFull,
    DesktopLeaf,
    ConstrainedLeaf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSpec {
    pub label: String,
    pub role: NodeRole,
    /// Pinned release tag, e.g. "v0.47.1". Resolves under `binaries_root`.
    pub version: String,
    /// `[gossip]` TOML overrides (byte_policy, leaf_max_eager_degree, ...).
    #[serde(default)]
    pub gossip: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    pub skip_legacy_dm_bus: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigSpec {
    pub run_id: String,
    /// The x0x `network_id` gossip plane for this rig instance (isolation
    /// axis #2; mismatched planes are disconnected by the daemon).
    pub network_plane: String,
    /// Third octet for the mesh subnet (172.29.X.0/24) and mgmt pairs.
    pub subnet_third: u8,
    pub nodes: Vec<NodeSpec>,
    /// Root holding `<version>/x0x-linux-x64-gnu/{x0xd,x0x}`.
    pub binaries_root: String,
    /// Root for run state (per-run dirs; durable, never /tmp).
    pub work_root: String,
}

pub struct NodeHandle {
    pub spec: NodeSpec,
    pub mesh_ip: String,
    pub mgmt_ip: String,
    pub api_port: u16,
    pub mesh_port: u16,
    pub netns: String,
    pub mesh_veth_root: String,
    pub data_dir: PathBuf,
    pub identity_dir: PathBuf,
    pub pid: u32,
    child: Option<Child>,
}

impl NodeHandle {
    pub fn client(&self) -> Result<NodeClient, String> {
        let token = fs::read_to_string(self.data_dir.join("api-token"))
            .map_err(|e| format!("token read {}: {e}", self.data_dir.display()))?;
        Ok(NodeClient::new(
            &format!("{}:{}", self.mgmt_ip, self.api_port),
            token.trim(),
        ))
    }
}

pub struct Rig {
    pub spec: RigSpec,
    pub nodes: Vec<NodeHandle>,
    pub run_dir: PathBuf,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn run(cmd: &[&str]) -> Result<String, String> {
    let out = Command::new(cmd[0])
        .args(&cmd[1..])
        .output()
        .map_err(|e| format!("{:?}: {e}", cmd))?;
    if !out.status.success() {
        return Err(format!(
            "{:?} failed ({}): {}{}",
            cmd,
            out.status,
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// One accounting sample for one node. MESH counters only (management-plane
/// traffic is excluded by topology, not by subtraction).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSample {
    pub node: String,
    pub at_ms: u64,
    /// Node → mesh bytes (root-side mesh veth rx_bytes).
    pub mesh_egress_bytes: u64,
    /// Mesh → node bytes (root-side mesh veth tx_bytes).
    pub mesh_ingress_bytes: u64,
    pub mesh_egress_pkts: u64,
    pub mesh_ingress_pkts: u64,
    pub cpu_jiffies: u64,
    pub vmhwm_kib: u64,
}

fn read_u64_file(p: &Path) -> u64 {
    fs::read_to_string(p)
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

impl Rig {
    /// Build the whole rig: bridges, namespaces, veth pairs, configs,
    /// processes, and readiness. On failure the partial rig is torn down
    /// (scoped to this run's own names only).
    pub fn build(spec: RigSpec) -> Result<Rig, String> {
        if !nul(&spec.run_id) {
            return Err("run_id must be a single safe path segment".into());
        }
        // The seed must be built first: its mesh address is fixed at .1 and
        // every other node's bootstrap_peers points there.
        if spec.nodes.first().map(|n| n.role) != Some(NodeRole::Seed) {
            return Err("nodes[0] must be the seed (its address is the rig's bootstrap)".into());
        }
        let run_dir = Path::new(&spec.work_root).join(&spec.run_id);
        fs::create_dir_all(&run_dir).map_err(|e| format!("mkdir {}: {e}", run_dir.display()))?;
        let mesh_br = format!("bmb{}", spec.subnet_third);
        let mgmt_br = format!("bpb{}", spec.subnet_third);
        let mut nodes = Vec::new();
        let result = (|| -> Result<(), String> {
            // Mesh bridge with the driver-side address (no external route:
            // a bridge with one address and no forwarding to physical ifaces).
            let _ = run(&["ip", "link", "del", &mesh_br]);
            run(&["ip", "link", "add", &mesh_br, "type", "bridge"])?;
            run(&[
                "ip",
                "addr",
                "add",
                &format!("172.29.{}.254/24", spec.subnet_third),
                "dev",
                &mesh_br,
            ])?;
            run(&["ip", "link", "set", &mesh_br, "up"])?;
            let _ = run(&["ip", "link", "del", &mgmt_br]);
            run(&["ip", "link", "add", &mgmt_br, "type", "bridge"])?;
            run(&[
                "ip",
                "addr",
                "add",
                &format!("172.30.{}.254/24", spec.subnet_third),
                "dev",
                &mgmt_br,
            ])?;
            run(&["ip", "link", "set", &mgmt_br, "up"])?;

            let mut host = 1u8;
            for ns in &spec.nodes {
                let h = build_node(&spec, ns, &mesh_br, &mgmt_br, &mut host, &run_dir)?;
                nodes.push(h);
            }
            // Seed readiness first, then everyone else.
            wait_ready(&nodes, &spec)?;
            Ok(())
        })();
        match result {
            Ok(()) => Ok(Rig {
                spec,
                nodes,
                run_dir,
            }),
            Err(e) => {
                let _ = Rig {
                    spec,
                    nodes,
                    run_dir,
                }
                .teardown();
                Err(e)
            }
        }
    }

    pub fn node(&self, label: &str) -> Result<&NodeHandle, String> {
        self.nodes
            .iter()
            .find(|n| n.spec.label == label)
            .ok_or_else(|| format!("no node {label}"))
    }

    /// Kernel-level accounting sample for one node.
    pub fn sample(&self, label: &str) -> Result<NodeSample, String> {
        let n = self.node(label)?;
        let sys = Path::new("/sys/class/net")
            .join(&n.mesh_veth_root)
            .join("statistics");
        let stat = fs::read_to_string(format!("/proc/{}/stat", n.pid))
            .map_err(|e| format!("proc stat {}: {e}", n.pid))?;
        // fields 14,15 (1-indexed) = utime, stime
        let fields: Vec<&str> = stat.split_whitespace().collect();
        let utime: u64 = fields.get(13).and_then(|s| s.parse().ok()).unwrap_or(0);
        let stime: u64 = fields.get(14).and_then(|s| s.parse().ok()).unwrap_or(0);
        let cpu_jiffies = utime + stime;
        let status = fs::read_to_string(format!("/proc/{}/status", n.pid)).unwrap_or_default();
        let vmhwm = status
            .lines()
            .find(|l| l.starts_with("VmHWM:"))
            .and_then(|l| l.split_whitespace().nth(1).and_then(|v| v.parse().ok()))
            .unwrap_or(0u64);
        Ok(NodeSample {
            node: label.to_string(),
            at_ms: now_ms(),
            mesh_egress_bytes: read_u64_file(&sys.join("rx_bytes")),
            mesh_ingress_bytes: read_u64_file(&sys.join("tx_bytes")),
            mesh_egress_pkts: read_u64_file(&sys.join("rx_packets")),
            mesh_ingress_pkts: read_u64_file(&sys.join("tx_packets")),
            cpu_jiffies,
            vmhwm_kib: vmhwm,
        })
    }

    pub fn sample_all(&self) -> Vec<NodeSample> {
        self.nodes
            .iter()
            .filter_map(|n| self.sample(&n.spec.label).ok())
            .collect()
    }

    /// A node's raw daemon diagnostics (recorded as APPLICATION-LEVEL
    /// evidence; never a verdict source).
    pub fn diagnostics(&self, label: &str, which: &str) -> Result<String, String> {
        self.node(label)?
            .client()?
            .get(&format!("/diagnostics/{which}"))
            .map(|(_, b)| b)
    }

    /// Take the node's mesh link down (partition drill). Management plane
    /// stays up: the node remains API-reachable — "ready but partitioned".
    pub fn mesh_link_down(&self, label: &str) -> Result<(), String> {
        let n = self.node(label)?;
        run(&["ip", "link", "set", "dev", &n.mesh_veth_root, "down"]).map(|_| ())
    }

    pub fn mesh_link_up(&self, label: &str) -> Result<(), String> {
        let n = self.node(label)?;
        run(&["ip", "link", "set", "dev", &n.mesh_veth_root, "up"]).map(|_| ())
    }

    /// SIGKILL the node's daemon (recovery drill). Identity/data dirs stay.
    pub fn kill_node(&self, label: &str) -> Result<(), String> {
        let n = self.node(label)?;
        run(&["kill", "-9", &n.pid.to_string()]).map(|_| ())
    }

    /// Restart a killed node with the SAME config, identity and data dirs.
    pub fn restart_node(&mut self, label: &str) -> Result<(), String> {
        let binaries = binaries_path(&self.spec, label)?;
        let (cfg, log_path) = {
            let n = self.node(label)?;
            (
                self.run_dir.join(format!("{}.toml", n.spec.label)),
                self.run_dir.join(format!("{}.log", n.spec.label)),
            )
        };
        let n = self.node_mut(label)?;
        let netns = n.netns.clone();
        {
            let log = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .map_err(|e| e.to_string())?;
            let child = Command::new("ip")
                .args(["netns", "exec", &netns, &binaries])
                .arg("--config")
                .arg(&cfg)
                .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
                .stderr(Stdio::from(log))
                .spawn()
                .map_err(|e| format!("spawn: {e}"))?;
            n.pid = child.id();
            n.child = Some(child);
        }
        wait_node_ready(n, 90)
    }

    fn node_mut(&mut self, label: &str) -> Result<&mut NodeHandle, String> {
        self.nodes
            .iter_mut()
            .find(|n| n.spec.label == label)
            .ok_or_else(|| format!("no node {label}"))
    }

    /// Tear down ONLY what this rig created: its own pids, namespaces,
    /// veths and bridges. Nothing else on the host is touched.
    pub fn teardown(self) {
        for n in &self.nodes {
            let _ = run(&["kill", "-9", &n.pid.to_string()]);
        }
        for n in &self.nodes {
            let _ = Command::new("ip").args(["netns", "del", &n.netns]).status();
        }
        let _ = run(&[
            "ip",
            "link",
            "del",
            &format!("bmb{}", self.spec.subnet_third),
        ]);
        let _ = run(&[
            "ip",
            "link",
            "del",
            &format!("bpb{}", self.spec.subnet_third),
        ]);
        // Reap children to avoid zombies.
        for mut n in self.nodes {
            if let Some(mut c) = n.child.take() {
                let _ = c.kill();
                let _ = c.wait();
            }
        }
    }
}

fn nul(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && !s.contains("..")
}

fn binaries_path(spec: &RigSpec, label: &str) -> Result<String, String> {
    let n = spec
        .nodes
        .iter()
        .find(|n| n.label == label)
        .ok_or("no node")?;
    let p = Path::new(&spec.binaries_root)
        .join(&n.version)
        .join("x0x-linux-x64-gnu")
        .join("x0xd");
    if !p.exists() {
        return Err(format!("pinned binary missing: {}", p.display()));
    }
    Ok(p.to_string_lossy().into_owned())
}

/// Generate the node's x0xd TOML. HERMETIC LAW: an explicit
/// `bootstrap_peers` on EVERY node (the absent key resolves to the
/// hardcoded GLOBAL bootstrap list — never acceptable in this rig).
pub fn node_toml(
    spec: &RigSpec,
    ns: &NodeSpec,
    mesh_ip: &str,
    mgmt_ip: &str,
    seed_addr: &str,
    data_dir: &Path,
    identity_dir: &Path,
    mesh_port: u16,
    api_port: u16,
) -> String {
    let mut t = String::new();
    t.push_str("# btmd rig node config — generated, hermetic\n");
    t.push_str(&format!("api_address = \"{mgmt_ip}:{api_port}\"\n"));
    t.push_str(&format!("bind_address = \"0.0.0.0:{mesh_port}\"\n"));
    t.push_str("log_level = \"info\"\n");
    t.push_str("log_format = \"text\"\n");
    t.push_str(&format!("data_dir = \"{}\"\n", data_dir.display()));
    t.push_str(&format!("identity_dir = \"{}\"\n", identity_dir.display()));
    t.push_str(&format!("network_id = \"{}\"\n", spec.network_plane));
    t.push_str("mdns_enabled = false\n");
    t.push_str("port_mapping_enabled = false\n");
    // Explicit bootstrap: the seed dials nothing; everyone else dials the
    // seed only. NEVER the embedded global list.
    if ns.role == NodeRole::Seed {
        t.push_str("bootstrap_peers = []\n");
    } else {
        t.push_str(&format!("bootstrap_peers = [\"{seed_addr}\"]\n"));
    }
    if ns.skip_legacy_dm_bus {
        t.push_str("skip_legacy_dm_bus = true\n");
    }
    t.push_str("\n[update]\nenabled = false\n");
    t.push_str("\n[history]\nenabled = true\n");
    t.push_str("\n[gossip]\n");
    if ns.role == NodeRole::RelayFull {
        t.push_str("relay = true\n");
    }
    for (k, v) in &ns.gossip {
        let val = match v {
            serde_json::Value::String(s) => format!("\"{s}\""),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => continue,
        };
        t.push_str(&format!("{k} = {val}\n"));
    }
    t
}

fn build_node(
    spec: &RigSpec,
    ns: &NodeSpec,
    mesh_br: &str,
    mgmt_br: &str,
    host: &mut u8,
    run_dir: &Path,
) -> Result<NodeHandle, String> {
    let label = &ns.label;
    let short: String = spec
        .run_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(3)
        .collect();
    let netns = format!("btmd-{}-{}", short, label);
    let mesh_veth_root = format!("bm{}-{}", spec.subnet_third, label);
    let mgmt_veth_root = format!("bp{}-{}", spec.subnet_third, label);
    let mesh_host = *host;
    let mgmt_host = 100 + *host;
    *host += 1;
    let mesh_ip = format!("172.29.{}.{}", spec.subnet_third, mesh_host);
    let mgmt_ip = format!("172.30.{}.{}", spec.subnet_third, mgmt_host);

    let _ = run(&["ip", "netns", "del", &netns]);
    run(&["ip", "netns", "add", &netns])?;
    // mesh pair
    run(&[
        "ip",
        "link",
        "add",
        &mesh_veth_root,
        "type",
        "veth",
        "peer",
        "name",
        "eth0",
        "netns",
        &netns,
    ])?;
    run(&["ip", "link", "set", &mesh_veth_root, "master", mesh_br])?;
    run(&["ip", "link", "set", &mesh_veth_root, "up"])?;
    // mgmt pair
    run(&[
        "ip",
        "link",
        "add",
        &mgmt_veth_root,
        "type",
        "veth",
        "peer",
        "name",
        "eth1",
        "netns",
        &netns,
    ])?;
    run(&["ip", "link", "set", &mgmt_veth_root, "master", mgmt_br])?;
    run(&["ip", "link", "set", &mgmt_veth_root, "up"])?;
    // in-netns addressing
    run(&[
        "ip",
        "-n",
        &netns,
        "addr",
        "add",
        &format!("{}/24", mesh_ip),
        "dev",
        "eth0",
    ])?;
    run(&["ip", "-n", &netns, "link", "set", "eth0", "up"])?;
    run(&[
        "ip",
        "-n",
        &netns,
        "addr",
        "add",
        &format!("{}/24", mgmt_ip),
        "dev",
        "eth1",
    ])?;
    run(&["ip", "-n", &netns, "link", "set", "eth1", "up"])?;
    run(&["ip", "-n", &netns, "link", "set", "lo", "up"])?;

    let data_dir = run_dir.join(format!("{}-data", label));
    let identity_dir = run_dir.join(format!("{}-identity", label));
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&identity_dir).map_err(|e| e.to_string())?;

    let seed_addr = format!("172.29.{}.{}:5483", spec.subnet_third, 1);
    let mesh_port = 5483u16;
    let api_port = 12700u16;
    let toml = node_toml(
        spec,
        ns,
        &mesh_ip,
        &mgmt_ip,
        &seed_addr,
        &data_dir,
        &identity_dir,
        mesh_port,
        api_port,
    );
    let cfg_path = run_dir.join(format!("{}.toml", label));
    fs::write(&cfg_path, &toml).map_err(|e| e.to_string())?;

    let binaries = Path::new(&spec.binaries_root)
        .join(&ns.version)
        .join("x0x-linux-x64-gnu")
        .join("x0xd");
    if !binaries.exists() {
        return Err(format!("pinned binary missing: {}", binaries.display()));
    }
    let log_path = run_dir.join(format!("{}.log", label));
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;
    let child = Command::new("ip")
        .args(["netns", "exec", &netns])
        .arg(&binaries)
        .arg("--config")
        .arg(&cfg_path)
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log))
        .spawn()
        .map_err(|e| format!("spawn {label}: {e}"))?;
    Ok(NodeHandle {
        spec: ns.clone(),
        mesh_ip,
        mgmt_ip,
        api_port,
        mesh_port,
        netns,
        mesh_veth_root,
        data_dir,
        identity_dir,
        pid: child.id(),
        child: Some(child),
    })
}

fn wait_ready(nodes: &[NodeHandle], spec: &RigSpec) -> Result<(), String> {
    for n in nodes {
        wait_node_ready(n, 120)?;
    }
    // Every non-seed node must see at least one peer (the seed).
    let deadline = now_ms() + 60_000;
    loop {
        let mut all_peered = true;
        for n in nodes {
            if n.spec.role == NodeRole::Seed {
                continue;
            }
            if let Ok(c) = n.client() {
                if let Ok((200, body)) = c.get("/health") {
                    let peers = serde_json::from_str::<serde_json::Value>(&body)
                        .ok()
                        .and_then(|v| v.get("peers").and_then(|p| p.as_u64()))
                        .unwrap_or(0);
                    if peers == 0 {
                        all_peered = false;
                    }
                } else {
                    all_peered = false;
                }
            } else {
                all_peered = false;
            }
        }
        if all_peered {
            return Ok(());
        }
        if now_ms() > deadline {
            return Err(format!(
                "rig {} did not converge to peered within 60s",
                spec.run_id
            ));
        }
        thread::sleep(Duration::from_millis(1000));
    }
}

fn wait_node_ready(n: &NodeHandle, timeout_secs: u64) -> Result<(), String> {
    let deadline = now_ms() + timeout_secs * 1000;
    loop {
        // /health is the one public endpoint; no token needed.
        let ok = std::net::TcpStream::connect((n.mgmt_ip.as_str(), n.api_port))
            .ok()
            .and_then(|_| {
                NodeClient::new(&format!("{}:{}", n.mgmt_ip, n.api_port), "")
                    .get_public("/health")
                    .ok()
            })
            .map(|(s, _)| s == 200)
            .unwrap_or(false);
        if ok {
            return Ok(());
        }
        if now_ms() > deadline {
            return Err(format!(
                "node {} not healthy within {timeout_secs}s (log: {})",
                n.spec.label,
                n.data_dir.display()
            ));
        }
        thread::sleep(Duration::from_millis(1000));
    }
}
