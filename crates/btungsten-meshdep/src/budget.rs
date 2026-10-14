//! The hash-bound acceptance budgets and the verdict math.
//!
//! The budgets file is committed bytes (`BUDGETS_JSON`). Every receipt
//! records its sha256. Verdicts compute against the bytes that were loaded,
//! never against a re-serialization — a budget edit is a new file, a new
//! hash, and a re-run.

use crate::BUDGETS_JSON;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fmt;

/// sha256 hex of the exact budget bytes (64 hex chars; a PUBLIC digest of a
/// committed public file — the pre-commit hex law is satisfied by the
/// same-line marker where this value is written into committed receipts).
pub fn budget_sha256(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    let d = h.finalize();
    let mut s = String::with_capacity(64);
    for b in d {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RoleBudget {
    pub idle_combined_bytes_per_min_max: Option<u64>,
    pub cpu_percent_sustained_max: Option<f64>,
    pub rss_mib_max: Option<u64>,
    pub subscriptions_max: Option<u64>,
    pub join_to_ready_secs_max: Option<f64>,
    pub targeted_dm_p95_secs_max: Option<f64>,
    pub revocation_visibility_secs_max: Option<f64>,
    pub kv_convergence_secs_max: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Budgets {
    pub schema: String,
    pub lane: String,
    pub published: String,
    pub roles: std::collections::BTreeMap<String, RoleBudget>,
    /// The sha256 of the exact bytes this instance was parsed from.
    #[serde(skip)]
    pub source_sha256: String,
}

impl Budgets {
    /// Parse budgets from exact bytes; the digest binds the parse to the
    /// file it came from. A parse failure is a hard error, never a default.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        let mut b: Budgets =
            serde_json::from_slice(bytes).map_err(|e| format!("budgets parse: {e}"))?;
        if b.schema != "btmd-budgets-1" {
            return Err(format!("unknown budgets schema {}", b.schema));
        }
        b.source_sha256 = budget_sha256(bytes);
        Ok(b)
    }

    /// The committed budgets, loaded from the crate's own artifact.
    pub fn committed() -> Result<Self, String> {
        Self::from_bytes(BUDGETS_JSON.as_bytes())
    }

    pub fn role(&self, name: &str) -> Result<&RoleBudget, String> {
        self.roles
            .get(name)
            .ok_or_else(|| format!("role {name} absent from budgets"))
    }
}

/// One measured number judged against one budget line.
#[derive(Debug, Clone, serde::Serialize)]
pub struct GateVerdict {
    pub gate: String,
    pub role: String,
    pub measured: f64,
    pub budget: f64,
    pub unit: String,
    pub pass: bool,
}

impl fmt::Display for GateVerdict {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{}] {} {} measured {:.3} {} budget {:.3} {}",
            if self.pass { "PASS" } else { "FAIL" },
            self.role,
            self.gate,
            self.measured,
            self.unit,
            self.budget,
            self.unit
        )
    }
}

fn gate(role: &str, name: &str, measured: f64, budget: f64, unit: &str) -> GateVerdict {
    GateVerdict {
        gate: name.to_string(),
        role: role.to_string(),
        measured,
        budget,
        unit: unit.to_string(),
        pass: measured <= budget,
    }
}

/// Cost + resource verdicts for one node's idle window and process stats.
/// `idle_bytes_per_min` is the node's COMBINED (egress+ingress) veth bytes
/// per minute during the idle window — kernel counters, not daemon meters.
#[must_use]
pub fn judge_idle(
    budgets: &Budgets,
    role: &str,
    idle_bytes_per_min: f64,
    cpu_percent_sustained: f64,
    rss_mib_peak: f64,
) -> Result<Vec<GateVerdict>, String> {
    let rb = budgets.role(role)?;
    let mut out = Vec::new();
    if let Some(b) = rb.idle_combined_bytes_per_min_max {
        out.push(gate(
            role,
            "idle_combined_bytes_per_min",
            idle_bytes_per_min,
            b as f64,
            "bytes/min",
        ));
    }
    if let Some(b) = rb.cpu_percent_sustained_max {
        out.push(gate(
            role,
            "cpu_percent_sustained",
            cpu_percent_sustained,
            b,
            "percent",
        ));
    }
    if let Some(b) = rb.rss_mib_max {
        out.push(gate(role, "rss_mib_peak", rss_mib_peak, b as f64, "MiB"));
    }
    Ok(out)
}

/// Delivery-matrix verdicts: fractions must MEET the minimum (>=), unlike
/// cost gates which must stay under (<=).
#[must_use]
pub fn judge_delivery_fraction(
    role: &str,
    name: &str,
    delivered_frac: f64,
    min_frac: f64,
) -> GateVerdict {
    let mut v = gate(role, name, delivered_frac, min_frac, "fraction");
    v.pass = delivered_frac >= min_frac;
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn committed_budgets_parse_and_pin_their_own_digest() {
        use crate::BUDGETS_JSON;
        let b = Budgets::committed().expect("committed budgets parse");
        assert_eq!(b.lane, "BT-MESH-DEPENDABILITY-001");
        assert_eq!(b.source_sha256.len(), 64);
        // The digest is a pure function of the bytes: two loads agree.
        let b2 = Budgets::from_bytes(BUDGETS_JSON.as_bytes()).unwrap();
        assert_eq!(b.source_sha256, b2.source_sha256);
    }

    #[test]
    fn an_over_budget_idle_bill_fails_and_exactly_budget_passes() {
        let b = Budgets::committed().unwrap();
        let rb = b.role("desktop-leaf").unwrap();
        let cap = rb.idle_combined_bytes_per_min_max.unwrap() as f64;
        let over = judge_idle(&b, "desktop-leaf", cap + 1.0, 0.0, 0.0).unwrap();
        assert!(over
            .iter()
            .any(|g| g.gate == "idle_combined_bytes_per_min" && !g.pass));
        let at = judge_idle(&b, "desktop-leaf", cap, 0.0, 0.0).unwrap();
        assert!(at
            .iter()
            .any(|g| g.gate == "idle_combined_bytes_per_min" && g.pass));
    }

    #[test]
    fn delivery_fractions_meet_a_minimum_not_a_maximum() {
        let v = judge_delivery_fraction("desktop-leaf", "targeted_dm_delivered", 0.99, 1.0);
        assert!(!v.pass);
        let v = judge_delivery_fraction("desktop-leaf", "targeted_dm_delivered", 1.0, 1.0);
        assert!(v.pass);
    }
}
