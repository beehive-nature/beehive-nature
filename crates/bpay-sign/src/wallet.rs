//! The WALLET BINDING — the "Connect bPay Wallet" ceremony (step 0).
//! Contract ported VERBATIM from the UX seat's frozen UI surface
//! (`wt-zcode-bpay-e` @987bf1c2, `crates/bpay-sign/src/wallet.rs`) onto
//! THIS branch's Suite-MCP client (plain per-call JSON-RPC — no
//! initialize handshake, so no SSE stream to hang on; live-proven
//! through both Observation-A legs).
//!
//! THE LAW: connecting a wallet proves identity/control; it authorizes
//! NOTHING — no approval, no allowance, no payment, no broadcast, and
//! no permission for future unattended signing. Persisted fields are
//! PUBLIC ONLY (device family, derivation path, public address, chain
//! family, transport, timestamps, proof reference); never PIN,
//! passphrase, seed, key, or Suite session secrets.
//!
//! The device leg is the Safe 7's own address-export prompt
//! (`showOnTrezor:true`): the founder physically REJECTS (the
//! deliberate-rejection receipt — "Connection rejected — nothing
//! changed") or APPROVES, and the recovered address is cross-checked
//! against the expected payer before the binding persists.

use crate::bridge::Safe7Cfg;
use serde::{Deserialize, Serialize};
use std::path::Path;
use watchpay::types::EthAddr;
use watchpay::wave::WaveAuthorizationEvent;

pub const WALLET_BINDING_SCHEMA: &str = "bpay.wallet-binding/1";

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct WalletBinding {
    pub schema: String,
    pub device: String,
    pub transport: String,
    pub path: String,
    pub address: String,
    pub chain_family: String,
    pub authority: String,
    pub state: String, // connected | disconnected
    pub connected_at_unix_secs: u64,
    #[serde(default)]
    pub disconnected_at_unix_secs: Option<u64>,
    pub proof: String,
    #[serde(default)]
    pub events: Vec<WaveAuthorizationEvent>,
}

fn wallet_path(state_dir: &Path) -> std::path::PathBuf {
    state_dir.join("wallet-binding.json")
}

pub fn load_wallet(state_dir: &Path) -> Option<WalletBinding> {
    std::fs::read_to_string(wallet_path(state_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn save_wallet(state_dir: &Path, w: &WalletBinding) -> bool {
    let p = wallet_path(state_dir);
    let tmp = p.with_extension("json.tmp");
    let ok = std::fs::write(&tmp, serde_json::to_string_pretty(w).unwrap_or_default()).is_ok();
    ok && std::fs::rename(&tmp, &p).is_ok()
}

/// The connected binding's public payer (the durable relationship), if
/// any — the PAYER-PRECEDENCE head: connected wallet > expected payer.
pub fn connected_payer(state_dir: &Path) -> Option<EthAddr> {
    load_wallet(state_dir)
        .filter(|w| w.state == "connected")
        .and_then(|w| EthAddr::from_lower_hex(&w.address.to_lowercase()).ok())
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// The connect ceremony's outcome for the HTTP layer.
pub enum ConnectOutcome {
    Connected(WalletBinding),
    /// `rejected` = the device refusal was clean (founder pressed the
    /// reject); `why` carries the transport text verbatim.
    Failed {
        rejected: bool,
        why: String,
    },
}

/// Run the connect ceremony through the LIVE Suite-MCP transport:
/// device address-export prompt → cross-check against the expected
/// payer → persist the public-only binding.
pub fn connect_wallet(cfg: &Safe7Cfg, path: &str) -> ConnectOutcome {
    let mut mcp =
        crate::suite_mcp::SuiteMcp::new(&cfg.mcp_url, &cfg.mcp_token, cfg.mcp_timeout_secs);
    match crate::suite_mcp::connect_address(&mut mcp, path) {
        Ok(address) => {
            // cross-check: a device address ≠ expected payer REFUSES the
            // connection outright (the binding must never carry a
            // surprise payer)
            if address.to_lowercase() != cfg.payer.to_lower_hex() {
                return ConnectOutcome::Failed {
                    rejected: false,
                    why: format!(
                        "the device recovered {address} but the expected payer is {} — \
                         connection REFUSED; surface this",
                        cfg.payer.to_lower_hex()
                    ),
                };
            }
            let w = WalletBinding {
                schema: WALLET_BINDING_SCHEMA.into(),
                device: "Trezor Safe 7".into(),
                transport: "suite-mcp".into(),
                path: path.to_string(),
                address,
                chain_family: "arbitrum-evm".into(),
                authority: "signing only — no spending authority granted".into(),
                state: "connected".into(),
                connected_at_unix_secs: now_secs(),
                disconnected_at_unix_secs: None,
                proof: "mcp trezor_get_address showOnTrezor:true — the founder approved the \
                        address export on the physical device (identity/control proof; \
                        authorizes nothing)"
                    .into(),
                events: vec![WaveAuthorizationEvent {
                    at_unix_secs: now_secs(),
                    kind: "connected".into(),
                    detail: "Connect bPay Wallet ceremony — device-proven payer bound; no \
                            transaction authority granted"
                        .into(),
                }],
            };
            ConnectOutcome::Connected(w)
        }
        Err(e) => {
            let why = e.to_string();
            let lower = why.to_lowercase();
            ConnectOutcome::Failed {
                rejected: lower.contains("reject") || lower.contains("cancel"),
                why,
            }
        }
    }
}

/// Persist a fresh binding (atomic tmp+rename).
pub fn persist(state_dir: &Path, w: &WalletBinding) -> bool {
    save_wallet(state_dir, w)
}

/// Mark the binding disconnected (append-only event), returning it.
pub fn disconnect(state_dir: &Path) -> Option<WalletBinding> {
    let mut w = load_wallet(state_dir)?;
    if w.state == "connected" {
        w.state = "disconnected".into();
        w.disconnected_at_unix_secs = Some(now_secs());
        w.events.push(WaveAuthorizationEvent {
            at_unix_secs: now_secs(),
            kind: "disconnected".into(),
            detail: "founder disconnected the wallet; no paid or uploaded state exists anywhere"
                .into(),
        });
        save_wallet(state_dir, &w);
    }
    Some(w)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binding_round_trip_and_disconnect_law() {
        let dir = std::env::temp_dir().join(format!("bpay-wallet-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let w = WalletBinding {
            schema: WALLET_BINDING_SCHEMA.into(),
            device: "Trezor Safe 7".into(),
            transport: "suite-mcp".into(),
            path: "m/44'/60'/0'/0/0".into(),
            address: "0x8fD7252A29FB759755E30A15E966932EaAD91b75".into(),
            chain_family: "arbitrum-evm".into(),
            authority: "signing only — no spending authority granted".into(),
            state: "connected".into(),
            connected_at_unix_secs: 1,
            disconnected_at_unix_secs: None,
            proof: "p".into(),
            events: vec![],
        };
        assert!(persist(&dir, &w));
        let loaded = load_wallet(&dir).unwrap();
        assert_eq!(
            loaded.address.to_lowercase(),
            "0x8fd7252a29fb759755e30a15e966932eaad91b75"
        );
        // payer precedence: the connected binding IS the payer source
        assert_eq!(
            connected_payer(&dir).unwrap().to_lower_hex(),
            "0x8fd7252a29fb759755e30a15e966932eaad91b75"
        );
        let d = disconnect(&dir).unwrap();
        assert_eq!(d.state, "disconnected");
        assert!(d.disconnected_at_unix_secs.is_some());
        assert!(d.events.iter().any(|e| e.kind == "disconnected"));
        // a disconnected wallet yields NO payer (falls back to expected)
        assert!(connected_payer(&dir).is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
