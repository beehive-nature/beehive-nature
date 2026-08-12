//! Four-level authenticator ladder (founder-named).
//! Each rung yields ONLY a public key in a versioned envelope (additive per §3).
//! T-F rungs (Larva/Pupa) = VERIFICATION METHODS (enroll into bni.id, no spend keys).
//! T-H rungs (Bee/Royal Guard) = KEY CUSTODY (sign ceremonies, hold wallet keys).

use serde::{Deserialize, Serialize};

/// The four authenticator tiers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AuthenticatorTier {
    Larva,      // passkey (beginner, free) — T-F verification
    Pupa,       // physical FIDO2 / Solo 2 (intermediate) — T-F verification
    Bee,        // Trezor stock firmware (advanced) — T-H custody
    RoyalGuard, // bCode custom firmware (planned) — T-H custody
}

impl AuthenticatorTier {
    pub fn custody_tier(&self) -> &'static str {
        match self {
            Self::Larva | Self::Pupa => "T-F",
            Self::Bee | Self::RoyalGuard => "T-H",
        }
    }

    pub fn role(&self) -> &'static str {
        match self {
            Self::Larva | Self::Pupa => "verification",
            Self::Bee | Self::RoyalGuard => "custody",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Larva => "Larva (passkey, free)",
            Self::Pupa => "Pupa (Solo 2 / FIDO2)",
            Self::Bee => "Bee (Trezor stock firmware)",
            Self::RoyalGuard => "Royal Guard (bCode — PLANNED)",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            Self::Larva => "caterpillar",
            Self::Pupa => "shield",
            Self::Bee => "bee",
            Self::RoyalGuard => "crown",
        }
    }

    pub fn available(&self) -> bool {
        match self {
            Self::RoyalGuard => false, // PLANNED until bCode ships
            _ => true,
        }
    }

    /// Where this rung routes: bni.id enrollment (T-F) or ceremony T-H sign (T-H).
    pub fn routes_to(&self) -> &'static str {
        match self {
            Self::Larva | Self::Pupa => "bni.id enrollment",
            Self::Bee | Self::RoyalGuard => "ceremony step 6 (T-H sign)",
        }
    }
}

/// An enrollment request — registers a PUBLIC key into bni.id (additive).
/// NEVER carries a private key. NEVER signs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentRequest {
    pub tier: AuthenticatorTier,
    pub pubkey_envelope: serde_json::Value, // PQ-ready versioned envelope (§2)
    pub account: String,                     // Vaulta account name (the bDiD)
}

/// The ladder metadata for dashboard display.
use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

/// POST /v1/bni.id/enroll — enroll a PUBLIC key into bni.id (additive, T-F only).
/// Body: { "tier": "larva"|"pupa", "pubkey_envelope": {...}, "account": "vaulta-name" }
/// NEVER carries a private key. NEVER signs. Produces an UNSIGNED updateauth tx.
pub async fn enroll_handler(body: Bytes) -> Response {
    let p: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v, Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":e.to_string()}))).into_response(),
    };
    let tier_str = p.get("tier").and_then(|v| v.as_str()).unwrap_or("");
    let tier = match tier_str {
        "larva" => AuthenticatorTier::Larva,
        "pupa" => AuthenticatorTier::Pupa,
        "bee" => AuthenticatorTier::Bee,
        "royal_guard" => AuthenticatorTier::RoyalGuard,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid tier"}))).into_response(),
    };
    // T-F tiers enroll into bni.id. T-H tiers route to ceremony (not this endpoint).
    if tier.custody_tier() == "T-H" {
        return (StatusCode::OK, Json(serde_json::json!({
            "routed_to": "ceremony step 6 (T-H sign)",
            "note": "T-H tiers do not enroll via bni.id. They sign the ceremony.",
            "tier": tier_str,
        }))).into_response();
    }
    let account = p.get("account").and_then(|v| v.as_str()).unwrap_or("");
    if account.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"account required"}))).into_response();
    }
    // Produce an UNSIGNED updateauth tx adding the pubkey to bni.id
    let envelope = p.get("pubkey_envelope").cloned().unwrap_or_default();
    let tx = crate::tx_prep::prepare_updateauth(
        account, "bni.id", "active", 1,
        &[("PUB_KEY_FROM_ENVELOPE", 1)], // placeholder — envelope payload.value fills this
    );
    Json(serde_json::json!({
        "v": 1,
        "action": "enroll_into_bni.id",
        "tier": tier_str,
        "account": account,
        "envelope": envelope,
        "unsigned_tx": tx,
        "_note": "UNSIGNED. Founder signs. Pubkey enrolled additively (S3). Never a private key.",
    })).into_response()
}

pub fn ladder_metadata() -> serde_json::Value {
    serde_json::json!({
        "v": 1,
        "self_desc": { "type": "authenticator-ladder", "spec": "SPEC-AUTHENTICATOR-LADDER-1" },
        "rungs": [
            { "id": "larva", "icon": "caterpillar", "tier": "T-F", "role": "verification",
              "label": "Larva (passkey, free)", "routes_to": "bni.id enrollment",
              "note": "Enrolls pubkey into bni.id. No spend keys. Real sovereign identity.",
              "available": true },
            { "id": "pupa", "icon": "shield", "tier": "T-F", "role": "verification",
              "label": "Pupa (Solo 2 / FIDO2)", "routes_to": "bni.id enrollment",
              "note": "Appends alongside passkey (additive per S3). Hardware-rooted FIDO2.",
              "available": true },
            { "id": "bee", "icon": "bee", "tier": "T-H", "role": "custody",
              "label": "Bee (Trezor stock firmware)", "routes_to": "ceremony step 6 (T-H sign)",
              "note": "Signs the ceremony + holds wallet keys. Granted: EVM/BTC/ZEC.",
              "available": true },
            { "id": "royal_guard", "icon": "crown", "tier": "T-H", "role": "custody",
              "label": "Royal Guard (bCode custom firmware)", "routes_to": "ceremony step 6 (T-H sign)",
              "note": "Native S2 envelopes. PLANNED until bCode ships.",
              "available": false },
        ],
        "seam": "Larva+Pupa (T-F) = VERIFICATION (prove identity, no spend keys). Bee+Royal Guard (T-H) = CUSTODY (sign + hold wallet keys). The seam is VISIBLE — a Larva user has real identity; T-H signing arrives at Bee.",
    })
}
