//! Door runtime configuration — validated in the LIBRARY so the laws are
//! testable on every platform (the binary only loads + validates).
//!
//! D-6 (journal web-unreachability): the journal root must never live
//! under a web-served path. The door refuses configs whose journal root
//! sits inside a known web root, fail-closed with the reason named; the
//! Caddy-side review row belongs to the SRE seat per the D-spec.

use std::path::{Path, PathBuf};

/// Web-served root prefixes the journal must never live under (D-6). The
/// list is the common server shapes; the Caddy review row on the box is
/// the SRE seat's counterpart.
const WEB_ROOT_PREFIXES: [&str; 5] = [
    "/var/www",
    "/srv/http",
    "/srv/www",
    "/usr/share/nginx",
    "/public_html",
];

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RunConfig {
    pub bind: String,
    pub journal_root: String,
    pub daily_gas_cap_wei: u64,
    pub reserved_gas_wei: u64,
    pub ops_float_available_wei: u64,
    #[serde(default = "default_chain")]
    pub chain: u64,
    #[serde(default)]
    pub facilitator_chain_config: Option<PathBuf>,
}

fn default_chain() -> u64 {
    8453
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("config: journal root {path} lives under web-served prefix {prefix} — the journal must be unreachable from every web surface (D-6), fail-closed")]
    JournalUnderWebRoot { path: String, prefix: String },
    #[error("config: {0}")]
    Malformed(String),
}

impl RunConfig {
    pub fn from_json(v: &serde_json::Value) -> Result<Self, ConfigError> {
        let cfg: RunConfig =
            serde_json::from_value(v.clone()).map_err(|e| ConfigError::Malformed(e.to_string()))?;
        cfg.validate()?;
        Ok(cfg)
    }

    pub fn validate(&self) -> Result<(), ConfigError> {
        let root = Path::new(&self.journal_root);
        for prefix in WEB_ROOT_PREFIXES.iter() {
            if root.starts_with(prefix) {
                return Err(ConfigError::JournalUnderWebRoot {
                    path: self.journal_root.clone(),
                    prefix: prefix.to_string(),
                });
            }
        }
        // A relative journal root is refused too: the door must never
        // accidentally journal into a working directory that a web server
        // might serve (cwd-dependent placement is the quieter variant of
        // the same hole).
        if root.is_relative() {
            return Err(ConfigError::Malformed(format!(
                "config: journal root {} must be absolute — cwd-dependent placement is the quiet variant of the D-6 web-exposure hole",
                self.journal_root
            )));
        }
        Ok(())
    }
}
