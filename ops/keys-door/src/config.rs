//! `edge.toml` (contract §4). No secrets: every value here is public.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::b64::unb64u32;
use crate::pq::is_bzpq_id;
use crate::record::MAX_SAFE;
use crate::sources::{ar_txid_ok, url_ok};

const MAX_LIST: usize = 16;

fn default_listen() -> SocketAddr {
    "0.0.0.0:8096".parse().expect("a socket address")
}
fn default_health() -> SocketAddr {
    "127.0.0.1:8097".parse().expect("a socket address")
}
fn default_poll() -> u64 {
    60
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub origin: String,
    pub rp_id: String,
    /// base64url SHA3-256 of the genesis record.json bytes
    pub genesis_sha3: String,
    pub genesis_signers: Vec<String>,
    /// the configured floor (rule 4), >= 1
    pub min_seq: u64,
    pub state_dir: PathBuf,
    pub inbox_dir: PathBuf,
    #[serde(default = "default_listen")]
    pub listen: SocketAddr,
    #[serde(default = "default_health")]
    pub health_listen: SocketAddr,
    /// the second verifier; required, and empty refuses to serve
    pub bsigner_path: String,
    #[serde(default = "default_poll")]
    pub poll_secs: u64,
    #[serde(default)]
    pub arweave_gateways: Vec<String>,
    /// GraphQL owner filter; empty disables Arweave discovery
    #[serde(default)]
    pub arweave_owners: Vec<String>,
    #[serde(default)]
    pub ant_doors: Vec<String>,
    #[serde(default)]
    pub peers: Vec<String>,
}

impl Config {
    pub fn load(path: &Path) -> Result<Config, String> {
        let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let cfg: Config = toml::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        cfg.validate()?;
        Ok(cfg)
    }

    pub fn genesis(&self) -> [u8; 32] {
        unb64u32(&self.genesis_sha3).expect("validated")
    }

    pub fn validate(&self) -> Result<(), String> {
        let host = self.origin.strip_prefix("https://").unwrap_or("");
        if host.is_empty() || !url_ok(&self.origin, false) || host.contains('/') {
            return Err("origin must be https://<host> with nothing after the host".into());
        }
        if self.rp_id.is_empty() || !self.rp_id.bytes().all(|b| b.is_ascii_graphic()) {
            return Err("rp_id must be a non-empty ASCII host".into());
        }
        if unb64u32(&self.genesis_sha3).is_none() {
            return Err("genesis_sha3 must be a base64url SHA3-256 digest (43 chars)".into());
        }
        if self.genesis_signers.is_empty() || !self.genesis_signers.iter().all(|s| is_bzpq_id(s)) {
            return Err("genesis_signers must be a non-empty list of bzpq1 ids".into());
        }
        if self.min_seq == 0 || self.min_seq > MAX_SAFE {
            return Err("min_seq must be >= 1".into());
        }
        if self.state_dir.as_os_str().is_empty()
            || self.inbox_dir.as_os_str().is_empty()
            || self.state_dir == self.inbox_dir
        {
            return Err("state_dir and inbox_dir must be set and differ".into());
        }
        if !(5..=86_400).contains(&self.poll_secs) {
            return Err("poll_secs must be between 5 and 86400".into());
        }
        let lists = [
            ("arweave_gateways", &self.arweave_gateways),
            ("arweave_owners", &self.arweave_owners),
            ("ant_doors", &self.ant_doors),
            ("peers", &self.peers),
        ];
        for (name, list) in lists {
            if list.len() > MAX_LIST {
                return Err(format!("{name}: at most {MAX_LIST} entries"));
            }
        }
        if let Some(u) = self.arweave_gateways.iter().find(|u| !url_ok(u, false)) {
            return Err(format!("{u}: arweave_gateways must be https://host[/path]"));
        }
        // A peer is untrusted like every source: its envelopes pass both
        // verifiers and the chain walk, its pack the hash checks. So a
        // configured peer takes the ant_doors rule (contract §7 A3): https,
        // or plain http only to loopback (a forwarder beside the edge). Peers
        // an envelope hints at stay https only (door.rs).
        if let Some(u) = self.peers.iter().find(|u| !url_ok(u, true)) {
            return Err(format!("{u}: peers must be https, or http to loopback"));
        }
        if let Some(u) = self.ant_doors.iter().find(|u| !url_ok(u, true)) {
            return Err(format!("{u}: ant_doors must be https, or http to loopback"));
        }
        if let Some(o) = self.arweave_owners.iter().find(|o| !ar_txid_ok(o)) {
            return Err(format!(
                "{o}: arweave_owners are base64url addresses (43 chars)"
            ));
        }
        Ok(())
    }
}
