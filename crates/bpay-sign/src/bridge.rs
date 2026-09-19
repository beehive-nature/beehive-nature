//! The antd-bridge read side for the Safe 7 signing mode (Observation B).
//!
//! The bridge (`C:\Users\travi\family-lineage\antd-bridge`, :8807) is the
//! ONLY source of real authorization and job records. This module reads
//! it LIVE — never caches, never vends, never regenerates: a missing
//! founder press stays missing (LAW 1 refuses at the organ).
//!
//! Record shapes verified against the live bridge 2026-09-19:
//! - `GET /v1/authorization` → array of `antd-bridge.authorization/1`
//!   records (== [`WaveAuthorization`], serde-compatible).
//! - `GET /v1/jobs` → summary rows with EXTRA bridge fields
//!   (`data_map_address`, `recovery_count`) — unknown fields are
//!   ignored by serde (no deny_unknown_fields on these organ types).

use serde_json::Value;
use watchpay::error::{Error, Result};
use watchpay::wave::{WaveAuthorization, WaveJobSummary};

/// GET a URL and parse JSON (bounded read, ureq). Used for the bridge's
/// read-only endpoints only.
pub fn http_get_json(url: &str, timeout_secs: u64) -> Result<Value> {
    let resp = ureq::get(url)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .call()
        .map_err(|e| Error::Malformed(format!("bridge GET {url}: {e}")))?;
    resp.into_json()
        .map_err(|e| Error::Malformed(format!("bridge JSON ({url}): {e}")))
}

/// Parse the bridge's `/v1/authorization` answer.
pub fn parse_bridge_authorizations(v: &Value) -> Result<Vec<WaveAuthorization>> {
    serde_json::from_value(v.clone())
        .map_err(|e| Error::Malformed(format!("bridge authorization list: {e}")))
}

/// Parse the bridge's `/v1/jobs` answer (summary rows).
pub fn parse_bridge_jobs(v: &Value) -> Result<Vec<WaveJobSummary>> {
    serde_json::from_value(v.clone()).map_err(|e| Error::Malformed(format!("bridge job list: {e}")))
}

/// The Safe 7 ceremony configuration (Observation B wiring).
pub struct Safe7Cfg {
    /// antd-bridge base URL (authorization + job source).
    pub bridge: String,
    /// Read-only chain RPC for nonce/fee composition (Arbitrum One
    /// public RPC by default — READ-ONLY use; no send code exists).
    pub rpc: String,
    /// The Suite-MCP endpoint (token rides the query param inside the
    /// transport; never printed).
    pub mcp_url: String,
    pub mcp_token: String,
    pub mcp_timeout_secs: u64,
    /// The payer the wall will demand: the Observation-A-proven device
    /// address (LAW 14 — recovery must equal it or the signature is
    /// refused).
    pub payer: watchpay::types::EthAddr,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_live_bridge_authorization_shape() {
        // shape taken from the bridge's schema (antd-bridge.authorization/1)
        let v = serde_json::json!([{
            "schema": "antd-bridge.authorization/1",
            "authorization_id": "auth-1",
            "upload_id": "up-1",
            "invoice_digest": "sha256:aa",
            "commitment_digest": "sha256:bb",
            "artifact_sha256": "338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e", // PUBLIC-CONSTANT: the founder's artifact sha, bridge-row fixture
            "artifact_bytes": 214091829,
            "audience": "public",
            "ant_ceiling_atto": "4293240196289062500",
            "gas_ceiling": "separate",
            "state": "authorized-for-signing",
            "events": [{ "at_unix_secs": 1, "kind": "authorized-for-signing", "detail": "d" }]
        }]);
        let auths = parse_bridge_authorizations(&v).expect("auths");
        assert_eq!(auths.len(), 1);
        assert_eq!(auths[0].upload_id, "up-1");
        assert_eq!(auths[0].events.len(), 1);
        // events default to empty when absent
        let v2 = serde_json::json!([{
            "schema": "antd-bridge.authorization/1", "authorization_id": "a",
            "upload_id": "u", "invoice_digest": "i", "commitment_digest": "c",
            "artifact_sha256": "s", "artifact_bytes": 1, "audience": "public",
            "ant_ceiling_atto": "1", "gas_ceiling": "g", "state": "authorized-for-signing"
        }]);
        assert_eq!(parse_bridge_authorizations(&v2).unwrap()[0].events.len(), 0);
    }

    #[test]
    fn parses_live_bridge_job_rows_with_extra_fields() {
        // the live /v1/jobs rows carry data_map_address + recovery_count
        // beyond the organ's summary shape — they must be ignored
        let v = serde_json::json!([{
            "upload_id": "up-1789807703111",
            "status": "open",
            "artifact_sha256": "338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e", // PUBLIC-CONSTANT: the founder's artifact sha, live row fixture
            "artifact_bytes": 214091829,
            "payment_type": "wave_batch",
            "total_amount_atto": "4293240196289062500",
            "data_map_address": "0x7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78", // PUBLIC-CONSTANT: live data_map address from the bridge row fixture
            "recovery_count": 0,
            "created_at_unix_secs": 1789807703
        }]);
        let jobs = parse_bridge_jobs(&v).expect("jobs");
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].status, "open");
        assert_eq!(jobs[0].created_at_unix_secs, 1789807703);
    }

    #[test]
    fn bad_bridge_shapes_refuse_loudly() {
        assert!(parse_bridge_authorizations(&serde_json::json!({"no":"array"})).is_err());
        assert!(parse_bridge_jobs(&serde_json::json!("str")).is_err());
    }
}
