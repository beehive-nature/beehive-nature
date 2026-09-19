//! The WALLET BINDING — the "Connect bPay Wallet" ceremony (step 0).
//!
//! THE LAW: connecting a wallet proves identity/control; it authorizes
//! NOTHING — no approval, no allowance, no payment, no broadcast, and no
//! permission for future unattended signing. Persisted fields are PUBLIC
//! ONLY (device family, derivation path, public address, chain family,
//! transport, timestamps, proof reference); never PIN, passphrase, seed,
//! key, or Suite session secrets (the organ holds none of them).
//!
//! The device leg is the Safe 7's own address-export prompt
//! (showOnTrezor:true): the founder physically REJECTS (the deliberate
//! rejection receipt — "Connection rejected — nothing changed") or
//! APPROVES, and the recovered address is cross-checked against the
//! expected payer before the binding persists.

use crate::suite_mcp::SuiteMcp;
use crate::{now_secs, refusal, Shared, WaveAuthorizationEvent};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};

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

fn wallet_path(state: &crate::AppState) -> std::path::PathBuf {
    state.state_dir.join("wallet-binding.json")
}

pub fn load_wallet(state: &crate::AppState) -> Option<WalletBinding> {
    std::fs::read_to_string(wallet_path(state))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn save_wallet(state: &crate::AppState, w: &WalletBinding) -> bool {
    let p = wallet_path(state);
    let tmp = p.with_extension("json.tmp");
    let ok = serde_json::to_string_pretty(w)
        .ok()
        .and_then(|s| std::fs::write(&tmp, s).ok())
        .is_some();
    ok && std::fs::rename(&tmp, &p).is_ok()
}

/// The connected binding's public payer (the durable relationship), if any.
pub fn connected_payer(state: &crate::AppState) -> Option<String> {
    load_wallet(state)
        .filter(|w| w.state == "connected")
        .map(|w| w.address)
}

#[derive(Deserialize, Default)]
pub struct ConnectBody {
    #[serde(default)]
    pub path: Option<String>,
}

pub async fn wallet_connect(
    axum::extract::State(state): axum::extract::State<Shared>,
    body: Option<Json<ConnectBody>>,
) -> Response {
    let Some(suite) = state.suite.clone() else {
        return refusal(
            503,
            "transport",
            "no Suite-MCP transport wired (set BPAY_SIGN_MCP_URL + BPAY_SIGN_MCP_TOKEN)".into(),
        );
    };
    let path = body
        .and_then(|Json(b)| b.path)
        .unwrap_or_else(|| "m/44'/60'/0'/0/0".to_string());
    match suite.connect_address(&path).await {
        Ok(address) => {
            if let Some(exp) = state.expected_payer {
                if address.to_lowercase() != exp.to_lower_hex() {
                    return refusal(409, "payer", format!(
                        "the device recovered {address} but the expected payer is {} — connection REFUSED; surface this",
                        exp.to_lower_hex()
                    ));
                }
            }
            let w = WalletBinding {
                schema: WALLET_BINDING_SCHEMA.into(),
                device: "Trezor Safe 7".into(),
                transport: "suite-mcp".into(),
                path: path.clone(),
                address: address.clone(),
                chain_family: "arbitrum-evm".into(),
                authority: "signing only — no spending authority granted".into(),
                state: "connected".into(),
                connected_at_unix_secs: now_secs(),
                disconnected_at_unix_secs: None,
                proof: "mcp trezor_get_address showOnTrezor:true — the founder approved the address export on the physical device (identity/control proof; authorizes nothing)".into(),
                events: vec![WaveAuthorizationEvent {
                    at_unix_secs: now_secs(),
                    kind: "connected".into(),
                    detail: "Connect bPay Wallet ceremony — device-proven payer bound; no transaction authority granted".into(),
                }],
            };
            if !save_wallet(&state, &w) {
                return refusal(500, "wallet", "could not persist the binding".into());
            }
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({ "ok": true, "binding": w })),
            )
                .into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            let lower = msg.to_lowercase();
            let rejected = lower.contains("reject") || lower.contains("cancel");
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({
                    "ok": false,
                    "rejected": rejected,
                    "why": msg,
                    "note": "Connection rejected — nothing changed",
                })),
            )
                .into_response()
        }
    }
}

pub async fn wallet_get(axum::extract::State(state): axum::extract::State<Shared>) -> Response {
    match load_wallet(&state) {
        Some(w) => Json(serde_json::json!({ "ok": true, "binding": w })).into_response(),
        None => {
            Json(serde_json::json!({ "ok": false, "why": "no wallet connected" })).into_response()
        }
    }
}

pub async fn wallet_disconnect(
    axum::extract::State(state): axum::extract::State<Shared>,
) -> Response {
    let mut w = match load_wallet(&state) {
        Some(w) => w,
        None => return refusal(404, "wallet", "no wallet connected".into()),
    };
    if w.state == "connected" {
        w.state = "disconnected".into();
        w.disconnected_at_unix_secs = Some(now_secs());
        w.events.push(WaveAuthorizationEvent {
            at_unix_secs: now_secs(),
            kind: "disconnected".into(),
            detail: "founder disconnected the wallet; no paid or uploaded state exists anywhere"
                .into(),
        });
        if !save_wallet(&state, &w) {
            return refusal(500, "wallet", "could not persist".into());
        }
    }
    Json(serde_json::json!({ "ok": true, "binding": w })).into_response()
}
