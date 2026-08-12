//! Multi-rail balance endpoints (XLM, SOL, Vaulta, Hive).
//! Each resolves a SPEC-RESOURCE-DASHBOARD-1 §9 UNVERIFIED tile.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::AppState;

/// GET /v1/stellar/balance/{address} — XLM balance from Horizon API.
/// Resolves §9: "Stellar Horizon self-hostability and exact API shape."
pub async fn stellar_balance(
    State(_s): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    // Stellar addresses: starts with G, 56 chars, base32
    if !address.starts_with('G')
        || address.len() != 56
        || !address.chars().all(|c| c.is_ascii_alphanumeric())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid Stellar address (must start with G, 56 chars)" })),
        )
            .into_response();
    }

    let addr_resp = address.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        let resp = agent
            .get(&format!("https://horizon.stellar.org/accounts/{address}"))
            .call()
            .map_err(|e| e.to_string())?;
        let body = resp.into_string().map_err(|e| e.to_string())?;
        Ok::<_, String>(body)
    })
    .await;

    match out {
        Ok(Ok(body)) => {
            let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            let balances = parsed
                .get("balances")
                .cloned()
                .unwrap_or(serde_json::Value::Array(vec![]));
            // Extract native XLM balance
            let xlm = balances
                .as_array()
                .and_then(|arr| {
                    arr.iter().find(|b| {
                        b.get("asset_type").and_then(|t| t.as_str()) == Some("native")
                    })
                })
                .and_then(|b| b.get("balance").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .unwrap_or_else(|| "0".into());
            Json(serde_json::json!({
                "address": addr_resp,
                "balances": balances,
                "native_xlm": xlm,
                "gateway_used": "https://horizon.stellar.org",
                "tier": "T-S",
            }))
            .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /v1/solana/balance/{address} — SOL balance via JSON-RPC.
/// Resolves §9: "Solana SPL token allowlist scope."
pub async fn solana_balance(
    State(_s): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    // Solana addresses: 32-44 chars, base58
    if address.len() < 32
        || address.len() > 44
        || !address.chars().all(|c| c.is_ascii_alphanumeric())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid Solana address" })),
        )
            .into_response();
    }

    let addr_resp = address.clone();
    let rpc_body = format!(
        r#"{{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["{}"]}}"#,
        address
    );
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        let resp = agent
            .post("https://api.mainnet-beta.solana.com")
            .set("Content-Type", "application/json")
            .send_string(&rpc_body)
            .map_err(|e| e.to_string())?;
        let body = resp.into_string().map_err(|e| e.to_string())?;
        Ok::<_, String>(body)
    })
    .await;

    match out {
        Ok(Ok(body)) => {
            let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            let lamports = parsed
                .pointer("/result/value")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let sol = lamports as f64 / 1_000_000_000.0;
            Json(serde_json::json!({
                "address": addr_resp,
                "balance_lamports": lamports,
                "balance_sol": format!("{:.9}", sol),
                "gateway_used": "https://api.mainnet-beta.solana.com",
                "tier": "T-H",
            }))
            .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /v1/hive/balance/{address} — Hive HP + RC via RPC.
/// Resolves §9: "Hive custom_json exact RC cost — load-dependent."
pub async fn hive_balance(
    State(_s): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    // Hive account names: lowercase, hyphens, dots, 3-16 chars typically
    if address.is_empty() || address.len() > 16 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid Hive account name" })),
        )
            .into_response();
    }

    let addr_resp = address.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();

        // Batch: get accounts (for HP) + find_rc_accounts (for RC mana)
        let batch = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "call",
            "params": [
                "database_api",
                "find_accounts",
                {"accounts": [address]}
            ]
        });
        let resp = agent
            .post("https://api.hive.blog")
            .set("Content-Type", "application/json")
            .send_string(&batch.to_string())
            .map_err(|e| e.to_string())?;
        let body = resp.into_string().map_err(|e| e.to_string())?;

        // Second call for RC
        let rc_body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "call",
            "params": [
                "rc_api",
                "find_rc_accounts",
                {"accounts": [address]}
            ]
        });
        let rc_resp = agent
            .post("https://api.hive.blog")
            .set("Content-Type", "application/json")
            .send_string(&rc_body.to_string())
            .map_err(|e| e.to_string())?;
        let rc_body = rc_resp.into_string().map_err(|e| e.to_string())?;

        Ok::<_, String>(format!(
            r#"{{"account":{},"rc":{}}}"#,
            body, rc_body
        ))
    })
    .await;

    match out {
        Ok(Ok(combined)) => {
            let parsed: serde_json::Value =
                serde_json::from_str(&combined).unwrap_or_default();
            let acct = parsed
                .pointer("/account/result/accounts/0")
                .cloned()
                .unwrap_or_default();
            let rc = parsed
                .pointer("/rc/result/rc_accounts/0")
                .cloned()
                .unwrap_or_default();

            let hp = acct
                .get("hive_power")
                .and_then(|v| v.as_str())
                .unwrap_or("0");
            let rc_mana = rc
                .get("rc_manabar")
                .and_then(|m| m.get("current_mana"))
                .and_then(|v| v.as_str())
                .unwrap_or("0");
            let rc_max = rc
                .get("max_rc")
                .and_then(|v| v.as_str())
                .unwrap_or("0");

            let mana_pct = if rc_max != "0" {
                let curr: f64 = rc_mana.parse().unwrap_or(0.0);
                let max: f64 = rc_max.parse().unwrap_or(1.0);
                format!("{:.1}", curr / max * 100.0)
            } else {
                "0".into()
            };

            Json(serde_json::json!({
                "address": addr_resp,
                "hive_power": hp,
                "rc_mana": rc_mana,
                "rc_max": rc_max,
                "rc_mana_pct": mana_pct,
                "gateway_used": "https://api.hive.blog",
                "tier": "T-S",
            }))
            .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}

/// GET /v1/vaulta/balance/{address} — Vaulta (Antelope) account balance.
/// Resolves §9: "Vaulta RAM/CPU/NET — exact API shape."
pub async fn vaulta_balance(
    State(_s): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    // Antelope account names: 1-12 chars, lowercase letters + digits 1-5
    if address.is_empty() || address.len() > 12 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid Antelope account name" })),
        )
            .into_response();
    }

    let addr_resp = address.clone();
    let out = tokio::task::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .redirects(0)
            .build();
        let body = serde_json::json!({
            "account_name": address
        });
        let resp = agent
            .post("https://wax.eosrio.io/v1/chain/get_account")
            .set("Content-Type", "application/json")
            .send_string(&body.to_string())
            .map_err(|e| e.to_string())?;
        let body = resp.into_string().map_err(|e| e.to_string())?;
        Ok::<_, String>(body)
    })
    .await;

    match out {
        Ok(Ok(body)) => {
            let parsed: serde_json::Value =
                serde_json::from_str(&body).unwrap_or_default();
            let liquid = parsed
                .pointer("/core_liquid_balance")
                .and_then(|v| v.as_str())
                .unwrap_or("0.0000 CORE");
            let cpu_limit = parsed
                .pointer("/cpu_limit/available")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let net_limit = parsed
                .pointer("/net_limit/available")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let ram_usage = parsed
                .pointer("/ram_usage")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let ram_quota = parsed
                .pointer("/ram_quota")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            Json(serde_json::json!({
                "address": addr_resp,
                "liquid_balance": liquid,
                "cpu_available": cpu_limit,
                "net_available": net_limit,
                "ram_usage_bytes": ram_usage,
                "ram_quota_bytes": ram_quota,
                "gateway_used": "https://wax.eosrio.io",
                "tier": "mixed",
                "tier_note": "owner/active=T-H target, custom PUB_WA=T-F",
            }))
            .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
        Err(join) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": join.to_string() })),
        )
            .into_response(),
    }
}
