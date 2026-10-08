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

/// POST /v1/vaulta/envelope — wrap a device-read address in a v2 envelope.
/// Body: {"address","network","source"?,"tier"?,"successor_key_ref"?,"successor_algo"?}.
/// An unknown network, a successor_key_ref that is not a bzpq1 id, or a
/// successor field that is present but not a string is a 400; `pq.ready` is
/// true only when a well-formed successor is named (envelope.rs).
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
    // absent or null = not given; any other non-string is refused, never dropped
    let field = |k: &str| match p.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.as_str())),
        Some(_) => Err(format!("{k} must be a string")),
    };
    let (succ_algo, succ_ref) = match (field("successor_algo"), field("successor_key_ref")) {
        (Ok(a), Ok(r)) => (a, r),
        (Err(e), _) | (_, Err(e)) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e })),
            )
                .into_response()
        }
    };
    let built = envelope::PqSuccessor::from_request(succ_algo, succ_ref)
        .and_then(|succ| envelope::address_envelope(addr, net, src, tier, succ.as_ref()));
    match built {
        Ok(env) => Json(env).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    const VECTORS: &str = include_str!("../../../surfaces/bpq-vectors.json");

    fn vector_id() -> String {
        let v: Value = serde_json::from_str(VECTORS).expect("bpq-vectors.json parses");
        v["keys"][0]["id"].as_str().expect("id").to_string()
    }

    async fn call(body: Value) -> (StatusCode, Value) {
        let resp = build_envelope(Bytes::from(body.to_string())).await;
        let status = resp.status();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    #[tokio::test]
    async fn route_builds_v2_without_successor() {
        let (status, env) = call(serde_json::json!({"address":"ADDR","network":"evm"})).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(env["v"], 2);
        assert_eq!(env["self_desc"]["sig_algo"], "ecdsa-secp256k1");
        assert_eq!(env["self_desc"]["hash"], "keccak-256");
        assert_eq!(env["pq"]["ready"], false);
        assert_eq!(env["pq"]["successor_key_ref"], Value::Null);
        assert_eq!(env["payload"]["source"], "manual");
        assert_eq!(env["payload"]["custody_tier"], "T-S");
        assert_eq!(envelope::check(&env), Ok(envelope::Checked::V2));
    }

    #[tokio::test]
    async fn route_carries_a_successor_when_given() {
        let id = vector_id();
        for body in [
            serde_json::json!({"address":"ADDR","network":"btc","successor_key_ref": id.as_str()}),
            serde_json::json!({"address":"ADDR","network":"btc","successor_key_ref": id.as_str(),
                "successor_algo":"ml-dsa-65"}),
        ] {
            let (status, env) = call(body).await;
            assert_eq!(status, StatusCode::OK);
            assert_eq!(env["pq"]["ready"], true);
            assert_eq!(env["pq"]["successor_algo"], "ml-dsa-65");
            assert_eq!(env["pq"]["successor_key_ref"], id.as_str());
            assert_eq!(envelope::check(&env), Ok(envelope::Checked::V2));
        }
    }

    #[tokio::test]
    async fn route_refuses_what_it_cannot_name() {
        let id = vector_id();
        for body in [
            serde_json::json!({"address":"ADDR","network":"sol"}),
            serde_json::json!({"address":"ADDR","network":"evm","successor_key_ref":"bzpq1nope"}),
            serde_json::json!({"address":"ADDR","network":"evm","successor_algo":"ml-dsa-65"}),
            serde_json::json!({"address":"ADDR","network":"evm","successor_key_ref": id.as_str(),
                "successor_algo":"slh-dsa-shake-256f"}),
            serde_json::json!({"network":"evm"}),
            serde_json::json!({"address":"ADDR","network":"evm","successor_key_ref":123}),
            serde_json::json!({"address":"ADDR","network":"evm","successor_algo":65}),
        ] {
            let (status, out) = call(body.clone()).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
            assert!(out["error"].is_string(), "{body}");
        }
    }
}
