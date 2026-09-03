//! bnr:// + buzz:// RESOLUTION — the rail behind bnr-url's `ResolveBName` seam.
//!
//! `crates/bnr-url` (ORDER cC) fenced resolution out of scope and left the
//! trait open: "The rail that implements this names both types." This module
//! is that rail, and it names them:
//!   - `Record` = the RAW registry row as JSON. Untrusted data, marked so.
//!   - `Error`  = [`ResolveError`].
//!
//! WHAT IS VERIFIED vs NOT: the .b registry (contract `kingbeelovis`) is read
//! over a Vaulta chain API via `get_table_rows`, matching on the row's
//! `domain_name` (the ABI-verified suffixless string form — the name WITHOUT
//! its .b). The MEANING of the row's remaining fields (which one is a target,
//! an owner, a content pointer) is SPEC-A-NAMES-1 territory and is NOT
//! interpreted here — the raw row is returned, flagged `semantics: "unverified"`.
//! That is an honesty marker, not a crypto claim.

use std::time::Duration;

use serde_json::{json, Value};
use thiserror::Error;

use bnr_url::{BnrUrl, ResolutionTarget, ResolveBName};

#[derive(Debug, Error)]
pub enum ResolveError {
    #[error("chain api unreachable: {0}")]
    Transport(String),
    #[error("chain api error body: {0}")]
    Chain(String),
    #[error("name not found in registry: {0}")]
    NotFound(String),
}

/// Which chain API, code, and scope to read. Overridable by env so the
/// resolver follows the estate if the registrar moves.
pub struct ChainResolver {
    pub api: String,
    pub code: String,
    pub scope: String,
    pub table: String,
}

impl Default for ChainResolver {
    fn default() -> Self {
        ChainResolver {
            api: std::env::var("BNR_CHAIN_API")
                .unwrap_or_else(|_| "https://eos.api.eosnation.io".into()),
            code: std::env::var("BNR_REG_CODE").unwrap_or_else(|_| "kingbeelovis".into()),
            scope: std::env::var("BNR_REG_SCOPE").unwrap_or_else(|_| "kingbeelovis".into()),
            table: std::env::var("BNR_REG_TABLE").unwrap_or_else(|_| "domains".into()),
        }
    }
}

impl ResolveBName for ChainResolver {
    type Record = Value;
    type Error = ResolveError;

    fn resolve(&self, target: &ResolutionTarget) -> Result<Self::Record, Self::Error> {
        let url = format!("{}/v1/chain/get_table_rows", self.api);
        let body = json!({
            "code": self.code,
            "table": self.table,
            "scope": self.scope,
            "limit": 100u32,
            "json": true,
        });
        // 13 names on the registrar today — one page covers the estate.
        // The seam for paging is `more` in the response; noted, not built.
        let resp: Value = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(10))
            .timeout_read(Duration::from_secs(20))
            .build()
            .post(&url)
            .send_json(body)
            .map_err(|e| ResolveError::Transport(e.to_string()))?
            .into_json()
            .map_err(|e| ResolveError::Transport(e.to_string()))?;

        let rows = resp
            .get("rows")
            .and_then(|r| r.as_array())
            .ok_or_else(|| ResolveError::Chain(format!("no rows array in response")))?;

        let want = target.label();
        for row in rows {
            if row.get("domain_name").and_then(|n| n.as_str()) == Some(want) {
                return Ok(row.clone());
            }
        }
        Err(ResolveError::NotFound(want.to_string()))
    }
}

/// Resolve `buzz://<host>[/path]` to its HTTPS relay home.
/// ORIGIN RULING (lane-g, 2026-08-31): skaists.buzz is identity forever, so
/// the mapping is the honest host map, not a lookup: buzz://skaists →
/// https://skaists.buzz. Suffix configurable via BUZZ_HOST_SUFFIX.
pub fn resolve_buzz(input: &str) -> Result<Value, ResolveError> {
    let rest = input
        .strip_prefix("buzz://")
        .or_else(|| input.strip_prefix("web+buzz://"))
        .ok_or_else(|| ResolveError::NotFound(input.to_string()))?;
    let (host, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, ""),
    };
    if host.is_empty()
        || !host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
    {
        return Err(ResolveError::NotFound(format!("bad buzz host: {host}")));
    }
    let suffix = std::env::var("BUZZ_HOST_SUFFIX").unwrap_or_else(|_| ".buzz".into());
    let target = format!("https://{host}{suffix}{path}");
    Ok(json!({
        "alg": "buzz-host-map",
        "input": input,
        "target": target,
        "semantics": "verified: host map per ORIGIN RULING (skaists.buzz = identity forever)"
    }))
}

/// Resolve any anchor-scheme URL with cache in front of the chain read.
/// Returns JSON with the scheme named; chain rows are marked untrusted.
pub fn resolve_any(input: &str) -> Result<Value, ResolveError> {
    if input.starts_with("buzz://") || input.starts_with("web+buzz://") {
        return resolve_buzz(input);
    }

    let url = BnrUrl::parse(input).map_err(|e| ResolveError::NotFound(format!("{e}")))?;
    let target = url.target();

    if let Some(cached) = crate::cache::get_json("resolve", input) {
        return Ok(cached);
    }

    let resolver = ChainResolver::default();
    let row = resolver.resolve(&target)?;
    let (iso, _) = crate::replay::now_iso();
    let record = json!({
        "alg": "bnr-registry-v1",
        "input": input,
        "label": target.label(),
        "fqn": {
            "__untrusted": true,
            "v": target.name().fqn(),
        },
        "row": {
            "__untrusted": true,
            "v": row,
        },
        "semantics": "unverified: registry row returned raw; field meanings are SPEC-A-NAMES-1 territory",
        "resolved_at": iso,
        "source": {
            "api": resolver.api,
            "code": resolver.code,
            "table": resolver.table,
        }
    });
    crate::cache::put_json("resolve", input, &record);
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buzz_maps_to_host_home() {
        let r = resolve_buzz("buzz://skaists").unwrap();
        assert_eq!(r["target"], "https://skaists.buzz");
        let r = resolve_buzz("buzz://skaists/room/lobby");
        assert!(r.is_ok());
        assert_eq!(r.unwrap()["target"], "https://skaists.buzz/room/lobby");
    }

    #[test]
    fn buzz_rejects_broken_hosts() {
        assert!(resolve_buzz("buzz://").is_err());
        assert!(resolve_buzz("buzz://bad host").is_err());
        assert!(resolve_buzz("https://skaists.buzz").is_err());
    }

    #[test]
    fn bnr_parse_failures_surface() {
        // two labels (pay.alice.b) is refused by the bnr-url validator itself
        let e = resolve_any("bnr://pay.alice.b");
        assert!(matches!(e, Err(ResolveError::NotFound(_))));
    }
}
