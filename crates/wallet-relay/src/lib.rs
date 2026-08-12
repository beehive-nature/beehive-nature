//! wallet-relay — the Phase-0 Axum relay skeleton (spec steps 4/5/7).
//!
//! A stateless read/relay surface (dispatch D5): GraphQL proxy + raw reads
//! through the health-checked [`gateway::GatewayPool`], and the user-signed
//! Ed25519 DataItem upload endpoint ([`upload::validate_upload`]). **Never holds
//! keys, never signs, never pays** — the self-funded model end to end.
//!
//! Transport is the house stack (ureq + rustls, D-009c) driven via
//! `spawn_blocking`; the failover loop itself is pure ([`try_in_order`]) so the
//! suite exercises it with closures, never sockets.

pub mod gateway;
pub mod upload;

use std::sync::{Arc, Mutex};

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use gateway::GatewayPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<Mutex<GatewayPool>>,
    /// Bundler to forward VALIDATED Arweave-routed items to (e.g. a Turbo-
    /// compatible `/v1/tx`). `None` = validate-and-report only; the response
    /// says `forwarded: false` explicitly — never a silent success.
    pub forward_to: Option<String>,
}

impl AppState {
    pub fn new(pool: GatewayPool, forward_to: Option<String>) -> Self {
        AppState { pool: Arc::new(Mutex::new(pool)), forward_to }
    }
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/upload", post(upload_item))
        .route("/graphql", post(graphql_proxy))
        .route("/raw/{id}", get(raw_read))
        .route("/v1/arweave/balance/{address}", get(arweave_balance))
        .route("/v1/arweave/status/{tx_id}", get(arweave_status))
        .with_state(state)
}

/// Try `f` against each gateway in pool order; report outcomes back into the
/// pool. Pure failover core: `f` is the transport in production and a closure in
/// tests. Returns the first success or Err(attempt-count) after all fail.
pub fn try_in_order<T>(
    pool: &Mutex<GatewayPool>,
    mut f: impl FnMut(&str) -> Result<T, String>,
) -> Result<T, usize> {
    let order = pool.lock().expect("pool lock").ordered();
    let total = order.len();
    for gw in order {
        match f(&gw) {
            Ok(v) => {
                pool.lock().expect("pool lock").mark_success(&gw);
                return Ok(v);
            }
            Err(_) => pool.lock().expect("pool lock").mark_failure(&gw),
        }
    }
    Err(total)
}

async fn healthz(State(s): State<AppState>) -> Json<serde_json::Value> {
    let rows: Vec<serde_json::Value> = s
        .pool
        .lock()
        .expect("pool lock")
        .health()
        .into_iter()
        .map(|(url, fails, degraded)| {
            serde_json::json!({ "gateway": url, "consecutive_failures": fails, "degraded": degraded })
        })
        .collect();
    Json(serde_json::json!({ "gateways": rows, "forward_configured": s.forward_to.is_some() }))
}

/// POST /v1/upload — body is one raw user-signed Ed25519 DataItem.
async fn upload_item(State(s): State<AppState>, body: Bytes) -> Response {
    let decision = match upload::validate_upload(&body) {
        Ok(d) => d,
        Err(refusal) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "refused": refusal })),
            )
                .into_response()
        }
    };

    // Forward only what is Arweave-routed and only when a bundler is configured.
    let should_forward = s.forward_to.is_some() && decision.route == "arweave";
    let forwarded = if should_forward {
        let target = s.forward_to.clone().expect("checked");
        let bytes = body.to_vec();
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

    (
        StatusCode::OK,
        Json(serde_json::json!({ "accepted": decision, "forwarded": forwarded })),
    )
        .into_response()
}

/// POST /graphql — proxy the query through the pool with failover.
async fn graphql_proxy(State(s): State<AppState>, body: Bytes) -> Response {
    let pool = s.pool.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        try_in_order(&pool, |gw| {
            agent
                .post(&format!("{gw}/graphql"))
                .set("Content-Type", "application/json")
                .send_bytes(&body)
                .map_err(|e| e.to_string())
                .and_then(|r| r.into_string().map_err(|e| e.to_string()))
        })
    })
    .await;

    match out {
        Ok(Ok(json)) => (StatusCode::OK, [("content-type", "application/json")], json).into_response(),
        Ok(Err(tried)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "all gateways failed", "gateways_tried": tried })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /raw/{id} — raw tx/data-item bytes through the pool (ar-io `/raw/`).
async fn raw_read(State(s): State<AppState>, Path(id): Path<String>) -> Response {
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') || id.len() > 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid id" })),
        )
            .into_response();
    }
    let pool = s.pool.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        try_in_order(&pool, |gw| {
            let resp = agent.get(&format!("{gw}/raw/{id}")).call().map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            use std::io::Read;
            resp.into_reader()
                .take(upload::MAX_ITEM_BYTES as u64 + 1)
                .read_to_end(&mut buf)
                .map_err(|e| e.to_string())?;
            Ok(buf)
        })
    })
    .await;

    match out {
        Ok(Ok(bytes)) => (
            StatusCode::OK,
            [("content-type", "application/octet-stream")],
            bytes,
        )
            .into_response(),
        Ok(Err(tried)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "all gateways failed", "gateways_tried": tried })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /v1/arweave/status/{tx_id} — read-back verification: is this tx on-chain?
async fn arweave_status(State(s): State<AppState>, Path(tx_id): Path<String>) -> Response {
    if !tx_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') || tx_id.len() > 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid tx id" })),
        )
            .into_response();
    }
    let tx_id_resp = tx_id.clone();
    let pool = s.pool.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        try_in_order(&pool, |gw| {
            // Try /tx/{id} for native tx metadata (returns 200 + JSON if confirmed)
            let resp = agent
                .get(&format!("{gw}/tx/{tx_id}"))
                .call()
                .map_err(|e| e.to_string())?;
            let body = resp.into_string().map_err(|e| e.to_string())?;
            Ok((body, gw.to_string()))
        })
    })
    .await;

    match out {
        Ok(Ok((body, gateway))) => {
            // arweave.net/tx/{id} returns JSON with "block" (null if pending) or 404
            let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            let found = parsed.get("id").is_some();
            let data_size = parsed.get("data_size").and_then(|v| v.as_u64()).unwrap_or(0);
            let confirmed = parsed.get("block").and_then(|b| b.as_str()).is_some_and(|s| !s.is_empty());
            Json(serde_json::json!({
                "id": tx_id_resp,
                "found": found,
                "confirmed": confirmed,
                "data_size": data_size,
                "gateway_used": gateway,
            }))
                .into_response()
        }
        Ok(Err(tried)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "all gateways failed", "gateways_tried": tried })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /v1/arweave/balance/{address} — read-only AR balance through the pool.
async fn arweave_balance(State(s): State<AppState>, Path(address): Path<String>) -> Response {
    if address.len() != 43 || !address.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid address" })),
        )
            .into_response();
    }
    let addr = address.clone();
    let pool = s.pool.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        try_in_order(&pool, |gw| {
            let resp = agent
                .get(&format!("{gw}/wallet/{address}/balance"))
                .call()
                .map_err(|e| e.to_string())?;
            let winston = resp.into_string().map_err(|e| e.to_string())?;
            Ok((winston, gw.to_string()))
        })
    })
    .await;

    match out {
        Ok(Ok((winston, gateway))) => {
            let w: u128 = winston.trim().parse().unwrap_or(0);
            let ar = w as f64 / 1e12;
            Json(serde_json::json!({
                "address": addr,
                "balance_winston": winston.trim(),
                "balance_ar": format!("{:.12}", ar),
                "gateway_used": gateway,
                "tier": "T-S"
            }))
                .into_response()
        }
        Ok(Err(tried)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "all gateways failed", "gateways_tried": tried })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atmirror::arweave::build_ed25519_data_item;
    use ed25519_dalek::SigningKey;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    fn test_state() -> AppState {
        AppState::new(
            GatewayPool::new(&["http://gw-a", "http://gw-b"]).unwrap(),
            None, // no forwarding in tests — no network in the suite
        )
    }

    /// The pure failover core: first success wins, failures mark and continue,
    /// total exhaustion reports how many were tried. No sockets.
    #[test]
    fn try_in_order_fails_over_and_reports() {
        let s = test_state();

        // second gateway succeeds after the first fails
        let got = try_in_order(&s.pool, |gw| {
            if gw == "http://gw-a" { Err("down".into()) } else { Ok(gw.to_string()) }
        });
        assert_eq!(got.unwrap(), "http://gw-b");
        let health = s.pool.lock().unwrap().health();
        assert_eq!(health[0].1, 1, "gw-a took the failure mark");
        assert_eq!(health[1].1, 0, "gw-b healed/clean");

        // all fail: Err carries the number tried
        let got: Result<(), usize> = try_in_order(&s.pool, |_| Err("down".into()));
        assert_eq!(got.unwrap_err(), 2);
    }

    #[tokio::test]
    async fn upload_endpoint_accepts_valid_item_and_reports_not_forwarded() {
        let sk = SigningKey::from_bytes(&[3u8; 32]);
        let (id, item) = build_ed25519_data_item(&sk, b"relay test", &[]);

        let resp = app(test_state())
            .oneshot(
                axum::http::Request::post("/v1/upload")
                    .body(axum::body::Body::from(item))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body: serde_json::Value =
            serde_json::from_slice(&resp.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(body["accepted"]["id"], id);
        assert_eq!(body["accepted"]["route"], "arweave");
        assert_eq!(body["forwarded"], false, "no bundler configured — said so, not implied");
    }

    #[tokio::test]
    async fn upload_endpoint_refuses_tampered_item_with_typed_refusal() {
        let sk = SigningKey::from_bytes(&[3u8; 32]);
        let (_, mut item) = build_ed25519_data_item(&sk, b"relay test", &[]);
        let last = item.len() - 1;
        item[last] ^= 1;

        let resp = app(test_state())
            .oneshot(
                axum::http::Request::post("/v1/upload")
                    .body(axum::body::Body::from(item))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body: serde_json::Value =
            serde_json::from_slice(&resp.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(body["refused"], "BadSignature");
    }

    #[tokio::test]
    async fn raw_read_refuses_malformed_ids_before_any_transport() {
        let resp = app(test_state())
            .oneshot(
                axum::http::Request::get("/raw/../etc/passwd")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        // either the router rejects the path shape or the handler rejects the id —
        // both are refusals before any gateway is contacted.
        assert!(resp.status() == StatusCode::BAD_REQUEST || resp.status() == StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn healthz_reports_pool_and_forward_state() {
        let resp = app(test_state())
            .oneshot(
                axum::http::Request::get("/healthz")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body: serde_json::Value =
            serde_json::from_slice(&resp.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(body["forward_configured"], false);
        assert_eq!(body["gateways"].as_array().unwrap().len(), 2);
    }
}
