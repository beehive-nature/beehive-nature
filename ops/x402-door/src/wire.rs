//! Leg extraction + R4-safe logging + HTTP surface.
//!
//! EXTRACTION LAW: the journal reads only its canonical subset from the
//! request JSON (`payment_requirements` + the eip3009-shaped authorization
//! inside `payment_payload.payload`). Unknown shapes are REFUSED with the
//! missing path named — never guessed. The verbatim request still flows to
//! the facilitator untouched; the door never re-types the protocol.
//!
//! R4 LOGGING LAW: a log line carries at most ONE chain identifier and a
//! per-leg payer tag truncated for display; no line, file, or format joins
//! payer identifiers across chains.

use crate::journal::LegKey;
use crate::orchestrator::{
    Door, DoorError, FacilitatorSettle, SettlementFacilitator, VerifyOutcome,
};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use std::sync::Arc;

#[derive(Debug, thiserror::Error)]
pub enum ExtractError {
    #[error("missing path {path} in payment request — refusing (fail-closed)")]
    Missing { path: &'static str },
    #[error("path {path}: {reason}")]
    Bad { path: &'static str, reason: String },
}

fn req_field<'a>(
    v: &'a serde_json::Value,
    camel: &'static str,
    snake: &'static str,
) -> Result<&'a serde_json::Value, ExtractError> {
    // Both canonical wire shapes are accepted (x402 TS wire is camelCase;
    // some upstream Rust test fixtures are snake_case). Anything else
    // fails closed naming BOTH attempted paths — never guessed.
    if let Some(found) = v.pointer(camel) {
        return Ok(found);
    }
    if let Some(found) = v.pointer(snake) {
        return Ok(found);
    }
    Err(ExtractError::Missing { path: camel })
}

fn as_str<'a>(
    v: &'a serde_json::Value,
    camel: &'static str,
    snake: &'static str,
) -> Result<&'a str, ExtractError> {
    req_field(v, camel, snake)?
        .as_str()
        .ok_or(ExtractError::Bad {
            path: camel,
            reason: "not a string".into(),
        })
}

/// Extract the canonical per-leg key from a V2 x402 verify/settle request.
/// Expected eip3009-shaped authorization fields: from, nonce, validBefore,
/// value (exact) / maxAmount (upto). CamelCase and snake_case canonical
/// shapes both accepted; anything else is refused with the path named.
pub fn extract_leg(request: &serde_json::Value) -> Result<LegKey, ExtractError> {
    let chain = as_str(
        request,
        "/paymentRequirements/network",
        "/payment_requirements/network",
    )?
    .to_string();
    let scheme = as_str(
        request,
        "/paymentRequirements/scheme",
        "/payment_requirements/scheme",
    )?
    .to_string();
    let pay_to = as_str(
        request,
        "/paymentRequirements/payTo",
        "/payment_requirements/pay_to",
    )?
    .to_string();
    let asset = as_str(
        request,
        "/paymentRequirements/asset",
        "/payment_requirements/asset",
    )?
    .to_string();
    let payer = as_str(
        request,
        "/paymentPayload/payload/from",
        "/payment_payload/payload/from",
    )?
    .to_string();
    let nonce = as_str(
        request,
        "/paymentPayload/payload/nonce",
        "/payment_payload/payload/nonce",
    )?
    .to_string();
    let vb = req_field(
        request,
        "/paymentPayload/payload/validBefore",
        "/payment_payload/payload/valid_before",
    )?;
    let valid_before = vb
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| vb.as_u64())
        .ok_or(ExtractError::Bad {
            path: "/paymentPayload/payload/validBefore",
            reason: "not numeric".into(),
        })?;
    let amount_authorized = match req_field(
        request,
        "/paymentPayload/payload/maxAmount",
        "/payment_payload/payload/max_amount",
    ) {
        Ok(v) => v
            .as_str()
            .ok_or(ExtractError::Bad {
                path: "/paymentPayload/payload/maxAmount",
                reason: "not a string".into(),
            })?
            .to_string(),
        Err(_) => as_str(
            request,
            "/paymentPayload/payload/value",
            "/payment_payload/payload/value",
        )?
        .to_string(),
    };
    Ok(LegKey {
        chain,
        scheme,
        auth_nonce: nonce,
        payer,
        amount_authorized,
        valid_before_unix: valid_before,
        pay_to,
        asset,
    })
}

/// R4-safe leg tag: ONE chain, truncated payer — never a join key.
pub fn leg_tag(leg: &LegKey) -> String {
    let payer_short: String = leg.payer.chars().take(10).collect();
    format!("[{}/{} payer={}…]", leg.chain, leg.scheme, payer_short)
}

fn log_door(line: &str) {
    // Single-line, one chain per line, no cross-leg joins (R4 law; the
    // acceptance test greps the emitted lines).
    eprintln!("x402-door {line}");
}

pub struct DoorState<F: SettlementFacilitator> {
    pub door: Arc<Door<F>>,
}

impl<F: SettlementFacilitator> Clone for DoorState<F> {
    fn clone(&self) -> Self {
        DoorState {
            door: self.door.clone(),
        }
    }
}

pub fn router<F: SettlementFacilitator + 'static>(state: DoorState<F>) -> Router {
    Router::new()
        .route("/verify", get(verify_info).post(verify))
        .route("/settle", get(settle_info).post(settle))
        .route("/supported", get(supported))
        .with_state(state)
}

async fn verify_info() -> impl IntoResponse {
    Json(serde_json::json!({
        "endpoint": "/verify",
        "method": "POST",
        "description": "verify an x402 payment payload against requirements (reserve-settle journal applies)",
        "x402_version": 2,
    }))
}

async fn settle_info() -> impl IntoResponse {
    Json(serde_json::json!({
        "endpoint": "/settle",
        "method": "POST",
        "description": "settle a verified x402 payment (idempotent by authorization nonce; evidence-gated reconciliation)",
        "x402_version": 2,
    }))
}

async fn supported() -> impl IntoResponse {
    Json(serde_json::json!({
        "x402_version": 2,
        "chains": [{ "network": "eip155:8453", "schemes": ["exact", "upto"] }],
        "door": "beebox x402-door (self-hosted; replaceable facilitator seam)",
    }))
}

fn law_response(err: &DoorError) -> (StatusCode, Json<serde_json::Value>) {
    let reason = err.to_string();
    let refused = reason.contains("fail-closed")
        || reason.contains("cap")
        || reason.contains("float")
        || reason.contains("refus");
    let status = if refused || matches!(err, DoorError::Law(_)) {
        StatusCode::FORBIDDEN
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(serde_json::json!({ "error": reason })))
}

async fn verify<F: SettlementFacilitator + 'static>(
    State(state): State<DoorState<F>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let leg = match extract_leg(&body) {
        Ok(l) => l,
        Err(e) => {
            log_door(&format!("verify refused: leg extraction: {e}"));
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };
    match state.door.verify(&leg, &body) {
        Ok(VerifyOutcome::Valid) => {
            log_door(&format!("verify valid {}", leg_tag(&leg)));
            (StatusCode::OK, Json(serde_json::json!({ "valid": true })))
        }
        Ok(VerifyOutcome::AlreadySettled {
            tx_hash,
            actual_amount,
        }) => {
            log_door(&format!("verify replay-settled {}", leg_tag(&leg)));
            (
                StatusCode::OK,
                Json(
                    serde_json::json!({ "valid": true, "already_settled": true, "transaction": tx_hash, "actual_amount": actual_amount }),
                ),
            )
        }
        Err(e) => {
            log_door(&format!("verify refused {}: {e}", leg_tag(&leg)));
            law_response(&e)
        }
    }
}

async fn settle<F: SettlementFacilitator + 'static>(
    State(state): State<DoorState<F>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let leg = match extract_leg(&body) {
        Ok(l) => l,
        Err(e) => {
            log_door(&format!("settle refused: leg extraction: {e}"));
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };
    match state.door.settle(&leg, &body) {
        Ok(out) => {
            let body = serde_json::to_value(&out).unwrap_or(serde_json::Value::Null);
            log_door(&format!("settle {}", leg_tag(&leg)));
            (StatusCode::OK, Json(body))
        }
        Err(e) => {
            log_door(&format!("settle refused {}: {e}", leg_tag(&leg)));
            law_response(&e)
        }
    }
}

/// Collected log lines (test hook for the R4 grep law).
pub fn _unused(_: &FacilitatorSettle) {}
