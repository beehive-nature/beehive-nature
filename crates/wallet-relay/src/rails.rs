//! Multi-rail balance endpoints — each routes through the adapter ring.
//! Per SPEC-PAY-ONCE-NOW-1 invariant #3: NO direct third-party endpoint calls.
//! All HTTP/parsing logic lives in adapters.rs; this module is thin routing.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::adapters::*;
use crate::AppState;

/// Generic balance handler — creates a default adapter, calls read_balance
/// in spawn_blocking, wraps the result. No direct HTTP calls here.
async fn via_adapter<A: RailAdapter + Default + 'static>(address: String) -> Response {
    let adapter = A::default();
    let out = tokio::task::spawn_blocking(move || adapter.read_balance(&address)).await;
    match out {
        Ok(Ok(json)) => Json(json).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": e}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn stellar_balance(State(_s): State<AppState>, Path(address): Path<String>) -> Response {
    if !address.starts_with('G') || address.len() != 56 || !address.chars().all(|c| c.is_ascii_alphanumeric()) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid Stellar address"}))).into_response();
    }
    via_adapter::<StellarAdapter>(address).await
}

pub async fn solana_balance(State(_s): State<AppState>, Path(address): Path<String>) -> Response {
    if address.len() < 32 || address.len() > 44 || !address.chars().all(|c| c.is_ascii_alphanumeric()) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid Solana address"}))).into_response();
    }
    via_adapter::<SolanaAdapter>(address).await
}

pub async fn hive_balance(State(_s): State<AppState>, Path(address): Path<String>) -> Response {
    if address.is_empty() || address.len() > 16 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid Hive account"}))).into_response();
    }
    via_adapter::<HiveAdapter>(address).await
}

pub async fn vaulta_balance(State(_s): State<AppState>, Path(address): Path<String>) -> Response {
    if address.is_empty() || address.len() > 12 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid Vaulta account"}))).into_response();
    }
    via_adapter::<VaultaAdapter>(address).await
}
