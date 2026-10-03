//! The canonical gate: `ETERNALIZATION-EDITION-V2.json`.
//!
//! The gate is the only source for the two ceilings and for the stop
//! conditions. Nothing here falls back to a built-in number: if the gate
//! cannot be found, read or parsed, the caller gets an error and nothing is
//! signed (`tools/genealogy/preserve-service.mjs` states the same rule for the
//! service: no upload runs while the gate is absent or unreadable).
//!
//! The gate path never depends on the working directory. It is, in order:
//! an explicit `--gate <path>`, the `ANT_EXTSIG_GATE` environment variable, or
//! the repository root relative to this crate's own location at build time.

use std::path::{Path, PathBuf};

type Res<T> = Result<T, Box<dyn std::error::Error>>;

/// What this client calls itself in the gate's `client version change` check.
pub const CLIENT_VERSION: &str = concat!("ant-extsig ", env!("CARGO_PKG_VERSION"));

/// The parts of the gate this client enforces.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Gate {
    pub path: PathBuf,
    pub storage_ceiling_atto: u128,
    pub gas_ceiling_wei: u128,
    /// `artifact.tarSha256`, lower-case hex.
    pub tar_sha256: String,
    /// `quote.chunkCount`.
    pub chunk_count: u64,
    /// `quote.clientVersion`.
    pub client_version: String,
}

/// Resolve the gate path without consulting the working directory.
pub fn resolve_gate_path(explicit: Option<&str>, env_value: Option<&str>) -> Res<PathBuf> {
    let (source, path) = match (explicit, env_value) {
        (Some(p), _) => ("--gate", PathBuf::from(p)),
        (None, Some(p)) => ("ANT_EXTSIG_GATE", PathBuf::from(p)),
        (None, None) => (
            "crate-relative default",
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("ETERNALIZATION-EDITION-V2.json"),
        ),
    };
    if !path.is_file() {
        return Err(format!(
            "REFUSE: gate file not found at {} (from {source}); nothing is signed without the gate",
            path.display()
        )
        .into());
    }
    Ok(path)
}

/// Parse a JSON number or string holding a non-negative decimal into an
/// 18-decimal fixed-point integer. No floating point. More than 18 fractional
/// digits is an error rather than a silent truncation.
pub fn decimal_to_atto(val: &serde_json::Value, what: &str) -> Res<u128> {
    let s = match val {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.trim().to_string(),
        other => return Err(format!("REFUSE: gate {what} is not a number or string: {other}").into()),
    };
    let (int_s, frac_s) = match s.split_once('.') {
        Some((i, f)) => (i, f),
        None => (s.as_str(), ""),
    };
    let digits = |x: &str| !x.is_empty() && x.bytes().all(|b| b.is_ascii_digit());
    if !digits(int_s) || (!frac_s.is_empty() && !digits(frac_s)) || frac_s.len() > 18 {
        return Err(format!("REFUSE: gate {what} is not a plain decimal with at most 18 places: '{s}'").into());
    }
    let int_part: u128 = int_s
        .parse()
        .map_err(|e| format!("REFUSE: gate {what} integer part '{int_s}': {e}"))?;
    let frac_part: u128 = if frac_s.is_empty() {
        0
    } else {
        format!("{frac_s:0<18}")
            .parse()
            .map_err(|e| format!("REFUSE: gate {what} fractional part '{frac_s}': {e}"))?
    };
    int_part
        .checked_mul(1_000_000_000_000_000_000)
        .and_then(|v| v.checked_add(frac_part))
        .ok_or_else(|| format!("REFUSE: gate {what} overflows 18-decimal fixed point: '{s}'").into())
}

impl Gate {
    /// Read and parse the gate. Every field this client enforces must be
    /// present; a missing one is a refusal, never a default.
    pub fn load(path: &Path) -> Res<Gate> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("REFUSE: cannot read gate {}: {e}", path.display()))?;
        Gate::parse(path, &content)
    }

    pub fn parse(path: &Path, content: &str) -> Res<Gate> {
        let v: serde_json::Value = serde_json::from_str(content)
            .map_err(|e| format!("REFUSE: gate {} is not valid JSON: {e}", path.display()))?;
        let need = |ptr: &str| -> Res<&serde_json::Value> {
            v.pointer(ptr)
                .ok_or_else(|| format!("REFUSE: gate {} has no {ptr}", path.display()).into())
        };
        let storage_ceiling_atto =
            decimal_to_atto(need("/separatedCeilings/storageMaxAnt")?, "separatedCeilings.storageMaxAnt")?;
        let gas_ceiling_wei =
            decimal_to_atto(need("/separatedCeilings/gasMaxEth")?, "separatedCeilings.gasMaxEth")?;
        if storage_ceiling_atto == 0 || gas_ceiling_wei == 0 {
            return Err(format!("REFUSE: gate {} carries a zero ceiling", path.display()).into());
        }
        let tar_sha256 = need("/artifact/tarSha256")?
            .as_str()
            .map(|s| s.trim().to_ascii_lowercase())
            .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
            .ok_or_else(|| format!("REFUSE: gate {} artifact.tarSha256 is not 64 hex characters", path.display()))?;
        let chunk_count = need("/quote/chunkCount")?
            .as_u64()
            .ok_or_else(|| format!("REFUSE: gate {} quote.chunkCount is not an integer", path.display()))?;
        let client_version = need("/quote/clientVersion")?
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| format!("REFUSE: gate {} quote.clientVersion is not a string", path.display()))?;
        Ok(Gate {
            path: path.to_path_buf(),
            storage_ceiling_atto,
            gas_ceiling_wei,
            tar_sha256,
            chunk_count,
            client_version,
        })
    }

    /// True when the file being uploaded is the artifact the gate binds.
    pub fn is_gate_artifact(&self, file_sha256: &str) -> bool {
        self.tar_sha256 == file_sha256.to_ascii_lowercase()
    }

    /// The gate's stop conditions that are about the artifact and the client
    /// (the two ceilings are enforced where the amounts are known). Returns
    /// every tripped condition, not only the first, so a refusal names all of
    /// them at once.
    pub fn tripped_stop_conditions(
        &self,
        file_sha256: &str,
        prepared_chunk_count: u64,
        client_version: &str,
    ) -> Vec<String> {
        let mut tripped = Vec::new();
        if !self.is_gate_artifact(file_sha256) {
            tripped.push(format!(
                "tar sha256 mismatch / artifact change: file {} vs gate {}",
                file_sha256.to_ascii_lowercase(),
                self.tar_sha256
            ));
        }
        if prepared_chunk_count != self.chunk_count {
            tripped.push(format!(
                "chunk count change: prepared {prepared_chunk_count} vs gate {}",
                self.chunk_count
            ));
        }
        if client_version != self.client_version {
            tripped.push(format!(
                "client version change: this client '{client_version}' vs gate '{}'",
                self.client_version
            ));
        }
        tripped
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const SHA: &str = "34511423f0be81a1ca5004b514436e5c7792fe4391d91845b1235bedf773fab5"; // PUBLIC-CONSTANT gate tar digest, test fixture

    fn gate_json(storage: serde_json::Value, gas: serde_json::Value) -> String {
        json!({
            "artifact": { "tarSha256": SHA },
            "quote": { "clientVersion": "ant 0.3.9", "chunkCount": 29 },
            "separatedCeilings": { "storageMaxAnt": storage, "gasMaxEth": gas }
        })
        .to_string()
    }

    #[test]
    fn decimal_is_exact_and_refuses_bad_shapes() {
        assert_eq!(decimal_to_atto(&json!(100), "x").unwrap(), 100_000_000_000_000_000_000);
        assert_eq!(decimal_to_atto(&json!(0.0002), "x").unwrap(), 200_000_000_000_000);
        assert_eq!(
            decimal_to_atto(&json!("2.825569772460937500"), "x").unwrap(),
            2_825_569_772_460_937_500
        );
        for bad in [json!("-1"), json!("1e3"), json!("1.2.3"), json!(""), json!("."), json!(null), json!(true)] {
            assert!(decimal_to_atto(&bad, "x").is_err(), "must refuse {bad}");
        }
        // 19 fractional digits is refused, not truncated.
        assert!(decimal_to_atto(&json!("0.0000000000000000001"), "x").is_err());
        // Overflow is refused.
        assert!(decimal_to_atto(&json!("999999999999999999999999999999999999999"), "x").is_err());
    }

    #[test]
    fn parses_the_real_gate_shape() {
        let g = Gate::parse(Path::new("gate.json"), &gate_json(json!(100), json!(0.0002))).unwrap();
        assert_eq!(g.storage_ceiling_atto, 100_000_000_000_000_000_000);
        assert_eq!(g.gas_ceiling_wei, 200_000_000_000_000);
        assert_eq!(g.chunk_count, 29);
        assert_eq!(g.client_version, "ant 0.3.9");
        assert_eq!(g.tar_sha256, SHA);
    }

    #[test]
    fn missing_or_zero_fields_refuse_instead_of_defaulting() {
        let p = Path::new("gate.json");
        assert!(Gate::parse(p, "not json").is_err());
        assert!(Gate::parse(p, "{}").is_err());
        let no_gas = json!({
            "artifact": { "tarSha256": SHA },
            "quote": { "clientVersion": "ant 0.3.9", "chunkCount": 29 },
            "separatedCeilings": { "storageMaxAnt": 100 }
        })
        .to_string();
        let err = Gate::parse(p, &no_gas).unwrap_err().to_string();
        assert!(err.contains("gasMaxEth"), "{err}");
        assert!(Gate::parse(p, &gate_json(json!(0), json!(0.0002))).is_err());
        assert!(Gate::parse(p, &gate_json(json!(100), json!("0"))).is_err());
    }

    #[test]
    fn gate_path_never_uses_the_working_directory() {
        // An explicit path that does not exist refuses; it does not fall back.
        let err = resolve_gate_path(Some("definitely/not/here.json"), None).unwrap_err().to_string();
        assert!(err.starts_with("REFUSE: gate file not found"), "{err}");
        assert!(err.contains("--gate"), "{err}");
        let err = resolve_gate_path(None, Some("also/not/here.json")).unwrap_err().to_string();
        assert!(err.contains("ANT_EXTSIG_GATE"), "{err}");
        // The crate-relative default finds the repository's gate from any cwd.
        let p = resolve_gate_path(None, None).unwrap();
        assert!(p.ends_with("ETERNALIZATION-EDITION-V2.json"));
        assert!(Gate::load(&p).is_ok());
    }

    #[test]
    fn stop_conditions_name_every_tripped_condition() {
        let g = Gate::parse(Path::new("gate.json"), &gate_json(json!(100), json!(0.0002))).unwrap();
        assert!(g.tripped_stop_conditions(SHA, 29, "ant 0.3.9").is_empty());
        assert!(g.tripped_stop_conditions(&SHA.to_ascii_uppercase(), 29, "ant 0.3.9").is_empty());
        let t = g.tripped_stop_conditions(&"0".repeat(64), 4, CLIENT_VERSION);
        assert_eq!(t.len(), 3, "{t:?}");
        assert!(t[0].contains("artifact change"));
        assert!(t[1].contains("chunk count change: prepared 4 vs gate 29"));
        assert!(t[2].contains("client version change"));
    }
}
