//! Vaulta identity endpoints — READ-ONLY + unsigned TX prep.
//! Per SPEC-VAULTA-IDENTITY-1: read from seat, sign from founder ONLY.

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::Value;

use crate::adapters::VaultaAdapter;
use crate::envelope;
use crate::tx_prep;
use crate::AppState;

/// GET /v1/vaulta/identity/{account} — read permission tree (versioned envelopes).
pub async fn read_identity(State(_s): State<AppState>, Path(account): Path<String>) -> Response {
    let adapter = VaultaAdapter::default();
    let acct = account.clone();
    let out = tokio::task::spawn_blocking(move || adapter.read_identity(&acct)).await;
    match out {
        Ok(Ok(id)) => Json(id).into_response(),
        Ok(Err(e)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({"error":e})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error":e.to_string()})),
        )
            .into_response(),
    }
}

/// POST /v1/vaulta/mint-walkthrough — prepare UNSIGNED mint transactions.
/// Body: {"creator":"...","new_account":"...","device_addresses":[...]}
pub async fn mint_walkthrough(body: Bytes) -> Response {
    let p: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":e.to_string()})),
            )
                .into_response()
        }
    };
    let creator = p.get("creator").and_then(|v| v.as_str()).unwrap_or("");
    let new_acct = p.get("new_account").and_then(|v| v.as_str()).unwrap_or("");
    let addrs = p
        .get("device_addresses")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if creator.is_empty() || new_acct.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"creator and new_account required"})),
        )
            .into_response();
    }
    Json(tx_prep::prepare_mint_walkthrough(creator, new_acct, &addrs)).into_response()
}

/// POST /v1/vaulta/envelope — wrap a device-read address in PQ-ready envelope.
pub async fn build_envelope(body: Bytes) -> Response {
    let p: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":e.to_string()})),
            )
                .into_response()
        }
    };
    let addr = p.get("address").and_then(|v| v.as_str()).unwrap_or("");
    let net = p.get("network").and_then(|v| v.as_str()).unwrap_or("");
    let src = p.get("source").and_then(|v| v.as_str()).unwrap_or("manual");
    let tier = p.get("tier").and_then(|v| v.as_str()).unwrap_or("T-S");
    if addr.is_empty() || net.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"address and network required"})),
        )
            .into_response();
    }
    Json(envelope::address_envelope(addr, net, src, tier)).into_response()
}
