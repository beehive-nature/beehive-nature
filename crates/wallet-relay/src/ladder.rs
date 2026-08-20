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
    pub account: String,                     // Vaulta account name (the bzDiD)
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
    // Produce an UNSIGNED updateauth tx adding the pubkey to bni.id.
    // The key lives at pubkey_envelope.payload.value (envelope.rs::pubkey_envelope).
    let envelope = p.get("pubkey_envelope").cloned().unwrap_or_default();
    let pubkey = match envelope.get("payload").and_then(|pl| pl.get("value")).and_then(|v| v.as_str()) {
        Some(k) if plausible_vaulta_pubkey(k) => k.to_string(),
        Some(k) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error":"pubkey_envelope.payload.value is not a plausible Vaulta public key",
            "got": k,
        }))).into_response(),
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error":"pubkey_envelope.payload.value (string) required",
        }))).into_response(),
    };
    let tx = crate::tx_prep::prepare_updateauth(
        account, "bni.id", "active", 1,
        &[(pubkey.as_str(), 1)],
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

/// Base58 alphabet shared by EOS/Vaulta key encodings (no 0, O, I, l).
fn is_base58(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| matches!(b,
        b'1'..=b'9' | b'A'..=b'H' | b'J'..=b'N' | b'P'..=b'Z' | b'a'..=b'k' | b'm'..=b'z'))
}

/// Format plausibility ONLY — no base58check decode, no checksum verification.
/// Accepts legacy `EOS…` (50-char base58 body) and typed `PUB_K1_`/`PUB_R1_`/`PUB_WA_`
/// keys (R1/WA cover the passkey/FIDO2 rungs this endpoint serves).
pub fn plausible_vaulta_pubkey(k: &str) -> bool {
    if let Some(body) = k.strip_prefix("EOS") {
        return body.len() == 50 && is_base58(body);
    }
    for prefix in ["PUB_K1_", "PUB_R1_", "PUB_WA_"] {
        if let Some(body) = k.strip_prefix(prefix) {
            // K1/R1 bodies run ~50 chars; WA (WebAuthn) bodies are longer and variable.
            return (40..=200).contains(&body.len()) && is_base58(body);
        }
    }
    false
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

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    /// Synthetic 53-char legacy-format key — a test vector, not a real account key.
    fn test_key() -> String { format!("EOS{}", "K1".repeat(25)) }

    async fn call(body: serde_json::Value) -> (StatusCode, serde_json::Value) {
        let resp = enroll_handler(Bytes::from(body.to_string())).await;
        let status = resp.status();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    #[tokio::test]
    async fn enroll_emits_the_envelope_pubkey_in_the_unsigned_tx() {
        let key = test_key();
        let envelope = crate::envelope::pubkey_envelope(&key, "secp256k1", "test", "T-F");
        let (status, body) = call(serde_json::json!({
            "tier": "larva", "account": "alice", "pubkey_envelope": envelope,
        })).await;
        assert_eq!(status, StatusCode::OK);
        let tx_key = &body["unsigned_tx"]["actions"][0]["data"]["auth"]["keys"][0]["key"];
        assert_eq!(tx_key, key.as_str(), "tx must carry the envelope's key, not a placeholder");
        assert_eq!(body["envelope"]["payload"]["value"], key.as_str(), "envelope still echoed");
    }

    #[tokio::test]
    async fn enroll_refuses_missing_pubkey() {
        // envelope absent entirely
        let (status, body) = call(serde_json::json!({ "tier": "larva", "account": "alice" })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(body["error"].as_str().unwrap().contains("payload.value"));
        // envelope present but payload.value missing
        let (status, _) = call(serde_json::json!({
            "tier": "larva", "account": "alice", "pubkey_envelope": {"v":1, "payload":{"type":"pubkey"}},
        })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn enroll_refuses_malformed_pubkey() {
        let (status, body) = call(serde_json::json!({
            "tier": "larva", "account": "alice",
            "pubkey_envelope": {"v":1, "payload":{"type":"pubkey", "value":"not-a-key!!!"}},
        })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["got"], "not-a-key!!!");
    }

    #[test]
    fn pubkey_plausibility_bounds() {
        assert!(plausible_vaulta_pubkey(&test_key()));
        assert!(plausible_vaulta_pubkey(&format!("PUB_K1_{}", "K1".repeat(25))));
        assert!(plausible_vaulta_pubkey(&format!("PUB_R1_{}", "K1".repeat(25))));
        assert!(!plausible_vaulta_pubkey("EOSshort"), "wrong length");
        assert!(!plausible_vaulta_pubkey(&format!("EOS{}OK", "K1".repeat(24))), "0/O/I/l are not base58");
        assert!(!plausible_vaulta_pubkey("PUB_K1_"), "empty body");
        assert!(!plausible_vaulta_pubkey("PUB_KEY_FROM_ENVELOPE"), "the old placeholder must never pass");
    }
}
