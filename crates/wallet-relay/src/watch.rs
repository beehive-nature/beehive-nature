//! Watch-only address configuration — public addresses for rail tiles.
//! NEVER holds a private key. NEVER signs. Read-only display values only.
//! Custody badge: "T-H / watch-only" for hardware-derived addresses.

use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};

/// A watch-only address entry for a rail tile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchAddress {
    pub rail: String,
    pub address: String,
    pub label: String,
    /// "T-H / watch-only" for Trezor-derived, "T-S" for software, etc.
    pub custody: String,
}

/// GET /v1/config/watch-only — returns configured public addresses.
/// Reads from WATCH_ONLY_ADDRESSES env var (JSON array) or returns empty.
pub async fn watch_only_config() -> Response {
    let addresses: Vec<WatchAddress> = match std::env::var("WATCH_ONLY_ADDRESSES") {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    Json(serde_json::json!({
        "addresses": addresses,
        "note": "Read-only public addresses. Never a private key. Never signing.",
    }))
    .into_response()
}
