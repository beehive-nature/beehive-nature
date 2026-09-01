//! PLAN-THEN-APPROVE — no spend, no auth, no OAuth, ever, in one step.
//!
//! Anchor-daemon lane, binding law 3: "PLAN-THEN-APPROVE before any
//! spend/auth/OAuth action." The gate holds at the tool boundary: when an
//! action's URL or target classifies as SPEND/AUTH/OAUTH, the action is NOT
//! executed. It is stored, described back to the caller as a plan, and only
//! a second, explicit call quoting the plan id executes it. The caller here
//! is the seat (human or agent) — the two-step shape is what survives:
//! generation and execution can never be the same utterance.
//!
//! The hint tables are deliberately substring-based and PUBLIC — they are a
//! fence, not a secret, and they are the unit-tested definition of "risky".

use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::b64::sha3_256_b64u;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Risk {
    Spend,
    Auth,
    OAuth,
}

impl Risk {
    pub fn as_str(self) -> &'static str {
        match self {
            Risk::Spend => "spend",
            Risk::Auth => "auth",
            Risk::OAuth => "oauth",
        }
    }
}

/// URL substrings that route an action through the gate. Lowercase-matched.
const URL_HINTS: &[(&str, Risk)] = &[
    // spend
    ("paypal.com", Risk::Spend),
    ("cash.app", Risk::Spend),
    ("stripe.com/checkout", Risk::Spend),
    ("checkout", Risk::Spend),
    ("/cart", Risk::Spend),
    ("/pay", Risk::Spend),
    ("payment", Risk::Spend),
    ("/order", Risk::Spend),
    // auth
    ("accounts.google.com", Risk::Auth),
    ("login.live.com", Risk::Auth),
    ("login.microsoftonline.com", Risk::Auth),
    ("/login", Risk::Auth),
    ("/log-in", Risk::Auth),
    ("/signin", Risk::Auth),
    ("/sign-in", Risk::Auth),
    ("/auth", Risk::Auth),
    // oauth
    ("/oauth", Risk::OAuth),
    ("authorize", Risk::OAuth),
    ("response_type=", Risk::OAuth),
];

/// Click-target name substrings that route through the gate. Lowercase-matched
/// against the element's accessible name (UNTRUSTED input — a page cannot
/// smuggle itself past the gate by naming a buy button something cute,
/// because the table matches the risk direction: more matches, more gating).
const CLICK_HINTS: &[(&str, Risk)] = &[
    ("buy", Risk::Spend),
    ("purchase", Risk::Spend),
    ("pay", Risk::Spend),
    ("checkout", Risk::Spend),
    ("send", Risk::Spend),
    ("transfer", Risk::Spend),
    ("tip ", Risk::Spend),
    ("subscribe", Risk::Spend),
    ("sign in", Risk::Auth),
    ("sign-in", Risk::Auth),
    ("log in", Risk::Auth),
    ("login", Risk::Auth),
    ("connect wallet", Risk::Auth),
    ("approve", Risk::OAuth),
    ("authorize", Risk::OAuth),
    ("continue with", Risk::OAuth),
];

pub fn classify_url(url: &str) -> Vec<Risk> {
    let mut out = Vec::new();
    let low = url.to_lowercase();
    for (hint, risk) in URL_HINTS {
        if low.contains(hint) && !out.contains(risk) {
            out.push(*risk);
        }
    }
    out
}

pub fn classify_click(role: &str, name: &str) -> Vec<Risk> {
    let _ = role; // role alone (link/button) is not a risk; the name is the signal
    let mut out = Vec::new();
    let low = format!("{} {}", role, name).to_lowercase();
    for (hint, risk) in CLICK_HINTS {
        if low.contains(hint) && !out.contains(risk) {
            out.push(*risk);
        }
    }
    out
}

struct Pending {
    action: Value,
    risks: Vec<Risk>,
    created: Instant,
    summary: String,
}

const PLAN_TTL: Duration = Duration::from_secs(600);

/// The plan-then-approve gate. One instance per seat session.
pub struct PlanGate {
    seed: u64,
    plans: HashMap<String, Pending>,
}

impl PlanGate {
    pub fn new() -> Self {
        PlanGate {
            seed: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.subsec_nanos() as u64)
                .unwrap_or(0),
            plans: HashMap::new(),
        }
    }

    /// Store a gated action, return its plan id (unique, not secret).
    pub fn propose(&mut self, action: Value, risks: Vec<Risk>) -> String {
        self.seed += 1;
        let id = sha3_256_b64u(format!("{}|{}", self.seed, action).as_bytes());
        let summary = action.to_string();
        self.plans.insert(
            id.clone(),
            Pending { action, risks, created: Instant::now(), summary },
        );
        id
    }

    /// Redeem an approved plan. Errors on unknown/expired id (no hints about
    /// which ids exist — ids are quoted back by the caller, never guessed).
    pub fn redeem(&mut self, plan_id: &str) -> Result<(Value, Vec<Risk>), String> {
        let pending = self.plans.remove(plan_id).ok_or("unknown or already-used plan id")?;
        if pending.created.elapsed() > PLAN_TTL {
            return Err("plan expired (10 min) — propose again".into());
        }
        Ok((pending.action, pending.risks))
    }

    /// Human/agent-readable description of what approving would do.
    pub fn describe_pending(&self, plan_id: &str) -> Option<Value> {
        self.plans.get(plan_id).map(|p| {
            json!({
                "plan_id": plan_id,
                "risks": p.risks.iter().map(|r| r.as_str()).collect::<Vec<_>>(),
                "action": p.action,
                "summary": p.summary,
            })
        })
    }
}

impl Default for PlanGate {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkout_urls_gate() {
        assert!(classify_url("https://shop.test/checkout?x=1").contains(&Risk::Spend));
        assert!(classify_url("https://accounts.google.com/o/oauth2/auth").contains(&Risk::Auth));
        assert!(classify_url("https://accounts.google.com/o/oauth2/auth").contains(&Risk::OAuth));
        assert!(classify_url("https://site.test/login").contains(&Risk::Auth));
        assert!(classify_url("https://example.com/").is_empty());
    }

    #[test]
    fn risky_click_names_gate() {
        assert!(classify_click("button", "Buy now").contains(&Risk::Spend));
        assert!(classify_click("link", "Log in to your account").contains(&Risk::Auth));
        assert!(classify_click("button", "Continue with Google").contains(&Risk::OAuth));
        assert!(classify_click("link", "More information...").is_empty());
    }

    #[test]
    fn gate_requires_two_steps() {
        let mut g = PlanGate::new();
        let action = json!({"action": "click", "ref": "@e9"});
        let id = g.propose(action.clone(), vec![Risk::Spend]);
        // cannot redeem twice, cannot redeem unknown
        assert!(g.redeem(&id).is_ok());
        assert!(g.redeem(&id).is_err(), "plan must be single-use");
        assert!(g.redeem("bogus").is_err());
    }

    #[test]
    fn plan_ids_unique_per_proposal() {
        let mut g = PlanGate::new();
        let a = json!({"action":"navigate","url":"https://a.test/login"});
        let b = json!({"action":"navigate","url":"https://a.test/login"});
        assert_ne!(g.propose(a, vec![Risk::Auth]), g.propose(b, vec![Risk::Auth]));
    }
}
