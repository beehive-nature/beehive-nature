//! Dashboard module — serves minimal HTML + test-upload endpoint.
//! Same-origin (relay serves the dashboard), so no CORS needed.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::upload;
use crate::AppState;

/// GET / — serves the dashboard HTML.
pub async fn dashboard() -> Response {
    (
        StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        DASHBOARD_HTML,
    )
        .into_response()
}

const DASHBOARD_HTML: &str = include_str!("dashboard.html");

/// POST /v1/test-upload — generates, signs, validates, and forwards a test DataItem.
/// Server-side signing only (durable form: client-side signing).
pub async fn test_upload_handler(State(s): State<AppState>) -> Response {
    let sk = ed25519_dalek::SigningKey::from_bytes(&[7u8; 32]);
    let (id, item) = atmirror::arweave::build_ed25519_data_item(
        &sk,
        b"BNR dashboard test upload from relay",
        &[],
    );

    let decision = match upload::validate_upload(&item) {
        Ok(d) => d,
        Err(refusal) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "refused": refusal, "id": id })),
            )
                .into_response()
        }
    };

    let should_forward = s.forward_to.is_some() && decision.route == "arweave";
    let forwarded = if should_forward {
        let target = s.forward_to.clone().expect("checked");
        let bytes = item.clone();
        let sent = tokio::task::spawn_blocking(move || {
            ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(30))
                .redirects(0)
                .build()
                .post(&format!("{}/v1/tx", target.trim_end_matches('/')))
                .set("Content-Type", "application/octet-stream")
                .send_bytes(&bytes)
                .map(|r| r.status())
                .map_err(|e| e.to_string())
        })
        .await;
        matches!(sent, Ok(Ok(status)) if (200..=202).contains(&status))
    } else {
        false
    };

    Json(serde_json::json!({
        "accepted": decision,
        "forwarded": forwarded,
        "id": id,
    }))
    .into_response()
}
