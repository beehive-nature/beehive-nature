//! The sovereign's promotion policy and the agent's proposal: two small, strict
//! text forms a person can read and `bsigner sign --file` can sign as they are.
//!
//! The policy is what an agent may never write. It names the component the
//! agent may change, the paths it may touch, the paths it may NOT touch (the
//! verifier, the required tests, the policy itself, CI), the exact verifier
//! commands that must pass (by digest of program bytes and arguments), the
//! canary probe, the attempt and total ceilings, and the permitted scopes.
//!
//! Ceilings carry no defaults. Units are whatever the executor measures
//! (elapsed milliseconds for local checks); picking their values is the
//! sovereign's act, not this crate's (ORDERS-1:61 — no seat designs economics).

use std::collections::BTreeSet;
use std::path::Path;

use crate::digest::{hash, Digest32};
use crate::tree::under;
use crate::Refusal;

pub const POLICY_HEADER: &str = "bnrose-evolve/policy/v1";
pub const PROPOSAL_HEADER: &str = "bnrose-evolve/proposal/v1";

/// One verifier command the policy requires, pinned by digest.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckSpec {
    pub id: String,
    pub command: Digest32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Policy {
    pub policy_id: String,
    pub component: String,
    pub baseline_rev: String,
    /// The digest of the implementation in force when the policy was written.
    /// Until a promotion replaces it, every proposal is a diff against exactly
    /// these bytes.
    pub baseline_artifact: Digest32,
    pub verifier_rev: String,
    pub writable: Vec<String>,
    pub protected: Vec<String>,
    pub checks: Vec<CheckSpec>,
    pub canary: CheckSpec,
    pub attempt_ceiling: u64,
    pub total_ceiling: u64,
    pub canary_scope: String,
    pub deploy_scope: String,
}

fn bad(m: impl Into<String>) -> Refusal {
    Refusal::Policy(m.into())
}

/// Split the body into `key=value` lines under the exact header. Blank lines
/// and CR are refused rather than tolerated: the signed bytes are the policy,
/// and two spellings of one policy would be two digests.
fn lines<'a>(text: &'a str, header: &str) -> Result<Vec<(&'a str, &'a str)>, Refusal> {
    if text.contains('\r') {
        return Err(bad("CR in a signed text form"));
    }
    let mut it = text.split('\n');
    if it.next() != Some(header) {
        return Err(bad(format!("first line must be {header}")));
    }
    let mut out = Vec::new();
    let body: Vec<&str> = it.collect();
    for (i, line) in body.iter().enumerate() {
        if line.is_empty() && i == body.len() - 1 {
            continue; // the one trailing newline
        }
        let (k, v) = line
            .split_once('=')
            .ok_or_else(|| bad(format!("line {} has no '='", i + 2)))?;
        if k.is_empty() || v.is_empty() {
            return Err(bad(format!("line {} has an empty key or value", i + 2)));
        }
        out.push((k, v));
    }
    Ok(out)
}

fn path_ok(p: &str) -> Result<(), Refusal> {
    if p.starts_with('/')
        || p.contains('\\')
        || p.split('/').any(|s| s == ".." || s == ".")
        || p.contains("//")
    {
        return Err(bad(format!("path {p:?} is not a plain relative path")));
    }
    Ok(())
}

fn check_line(v: &str) -> Result<CheckSpec, Refusal> {
    let (id, d) = v
        .split_once(' ')
        .ok_or_else(|| bad("check needs '<id> <sha3-256:digest>'"))?;
    let command = Digest32::parse(d).ok_or_else(|| bad(format!("check {id}: bad digest")))?;
    Ok(CheckSpec {
        id: id.to_string(),
        command,
    })
}

impl Policy {
    pub fn parse(text: &str) -> Result<Policy, Refusal> {
        let mut single: std::collections::BTreeMap<&str, &str> = Default::default();
        let (mut writable, mut protected, mut checks) = (Vec::new(), Vec::new(), Vec::new());
        let mut canary = None;
        for (k, v) in lines(text, POLICY_HEADER)? {
            match k {
                "writable" => {
                    path_ok(v)?;
                    writable.push(v.to_string())
                }
                "protected" => {
                    path_ok(v)?;
                    protected.push(v.to_string())
                }
                "check" => checks.push(check_line(v)?),
                "canary" => {
                    if canary.replace(check_line(v)?).is_some() {
                        return Err(bad("canary named twice"));
                    }
                }
                "policy_id" | "component" | "baseline_rev" | "baseline_artifact"
                | "verifier_rev" | "attempt_ceiling" | "total_ceiling" | "canary_scope"
                | "deploy_scope" => {
                    if single.insert(k, v).is_some() {
                        return Err(bad(format!("{k} named twice")));
                    }
                }
                other => return Err(bad(format!("unknown policy key {other:?}"))),
            }
        }
        let get = |k: &str| {
            single
                .get(k)
                .map(|s| s.to_string())
                .ok_or_else(|| bad(format!("policy lacks {k}")))
        };
        let num = |k: &str| -> Result<u64, Refusal> {
            get(k)?
                .parse::<u64>()
                .map_err(|_| bad(format!("{k} is not a whole number")))
        };
        let p = Policy {
            policy_id: get("policy_id")?,
            component: get("component")?,
            baseline_rev: get("baseline_rev")?,
            baseline_artifact: Digest32::parse(&get("baseline_artifact")?)
                .ok_or_else(|| bad("baseline_artifact is not a sha3-256 digest"))?,
            verifier_rev: get("verifier_rev")?,
            writable,
            protected,
            checks,
            canary: canary.ok_or_else(|| bad("policy names no canary probe"))?,
            attempt_ceiling: num("attempt_ceiling")?,
            total_ceiling: num("total_ceiling")?,
            canary_scope: get("canary_scope")?,
            deploy_scope: get("deploy_scope")?,
        };
        if p.writable.is_empty() {
            return Err(bad("policy grants no writable path"));
        }
        if p.checks.is_empty() {
            return Err(bad(
                "policy requires no check: nothing could ever be verified",
            ));
        }
        let mut ids = BTreeSet::new();
        for c in p.checks.iter().chain(std::iter::once(&p.canary)) {
            if !ids.insert(c.id.as_str()) {
                return Err(bad(format!("check id {:?} named twice", c.id)));
            }
        }
        if p.attempt_ceiling == 0 || p.total_ceiling < p.attempt_ceiling {
            return Err(bad(
                "ceilings must satisfy 0 < attempt_ceiling <= total_ceiling",
            ));
        }
        Ok(p)
    }

    pub fn check(&self, id: &str) -> Option<&CheckSpec> {
        self.checks.iter().find(|c| c.id == id)
    }

    /// Is `path` one the agent may change? Protected always wins over writable.
    pub fn may_touch(&self, path: &str) -> Result<(), Refusal> {
        if let Some(p) = self.protected.iter().find(|p| under(path, p)) {
            return Err(Refusal::ProtectedPath {
                path: path.to_string(),
                rule: p.clone(),
            });
        }
        if !self.writable.iter().any(|w| under(path, w)) {
            return Err(Refusal::OutsideWritable {
                path: path.to_string(),
            });
        }
        Ok(())
    }
}

/// The digest that pins one verifier command: the verifier revision, the
/// SHA3 of the program's bytes (so a swapped binary is a different command,
/// wherever it lives), and the arguments. The artifact under test is never
/// an argument; it is the working directory and `BNROSE_EVOLVE_ARTIFACT`.
pub fn command_digest(
    verifier_rev: &str,
    program: &Path,
    args: &[String],
) -> Result<Digest32, Refusal> {
    let bytes = std::fs::read(program)
        .map_err(|e| Refusal::Verifier(format!("verifier program {}: {e}", program.display())))?;
    let prog = hash("bnrose-evolve/program/v1", &[&bytes]);
    let mut parts: Vec<&[u8]> = vec![verifier_rev.as_bytes(), &prog.0];
    for a in args {
        parts.push(a.as_bytes());
    }
    Ok(hash("bnrose-evolve/command/v1", &parts))
}

/// An agent's candidate, as the agent signed it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProposalText {
    pub component: String,
    /// The implementation the candidate was cut from, by digest.
    pub base: Digest32,
    pub artifact: Digest32,
    pub touched: Vec<String>,
    /// The agent's own account of its change. Kept as evidence of what was
    /// CLAIMED; no verdict, decision or lesson ever reads it.
    pub claim: String,
}

impl ProposalText {
    pub fn parse(text: &str) -> Result<ProposalText, Refusal> {
        let mut touched = Vec::new();
        let (mut component, mut base, mut artifact, mut claim) = (None, None, None, None);
        let once = |slot: &mut Option<String>, k: &str, v: &str| -> Result<(), Refusal> {
            if slot.replace(v.to_string()).is_some() {
                return Err(bad(format!("proposal names {k} twice")));
            }
            Ok(())
        };
        for (k, v) in lines(text, PROPOSAL_HEADER)? {
            match k {
                "touch" => {
                    path_ok(v)?;
                    touched.push(v.to_string())
                }
                "component" => once(&mut component, k, v)?,
                "base" => once(&mut base, k, v)?,
                "artifact" => once(&mut artifact, k, v)?,
                "claim" => once(&mut claim, k, v)?,
                other => return Err(bad(format!("unknown proposal key {other:?}"))),
            }
        }
        touched.sort();
        let n = touched.len();
        touched.dedup();
        if touched.len() != n {
            return Err(bad("proposal touches a path twice"));
        }
        Ok(ProposalText {
            component: component.ok_or_else(|| bad("proposal lacks component"))?,
            base: Digest32::parse(&base.ok_or_else(|| bad("proposal lacks base"))?)
                .ok_or_else(|| bad("proposal base is not a sha3-256 digest"))?,
            artifact: Digest32::parse(&artifact.ok_or_else(|| bad("proposal lacks artifact"))?)
                .ok_or_else(|| bad("proposal artifact is not a sha3-256 digest"))?,
            touched,
            claim: claim.unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d() -> String {
        hash("t", &[b"c"]).text()
    }

    fn base() -> String {
        format!(
            "{POLICY_HEADER}\npolicy_id=p1\ncomponent=svc\nbaseline_rev=r0\nbaseline_artifact={d}\nverifier_rev=v1\n\
             writable=svc/\nprotected=svc/tests/\ncheck=restart {d}\ncanary=canary {d}\n\
             attempt_ceiling=10\ntotal_ceiling=100\ncanary_scope=c\ndeploy_scope=all\n",
            d = d()
        )
    }

    #[test]
    fn parses_and_refuses_strictly() {
        let p = Policy::parse(&base()).unwrap();
        assert_eq!(p.checks.len(), 1);
        assert!(p.may_touch("svc/src/main.rs").is_ok());
        assert!(matches!(
            p.may_touch("svc/tests/regress.rs"),
            Err(Refusal::ProtectedPath { .. })
        ));
        assert!(matches!(
            p.may_touch("ci.yml"),
            Err(Refusal::OutsideWritable { .. })
        ));

        for (from, to) in [
            ("policy_id=p1\n", "policy_id=p1\npolicy_id=p2\n"),
            ("writable=svc/\n", "writable=../svc/\n"),
            ("attempt_ceiling=10", "attempt_ceiling=1000"),
            ("total_ceiling=100\n", "total_ceiling=100\nsurprise=1\n"),
            ("canary_scope=c\n", "canary_scope=c\n\n"),
            ("bnrose-evolve/policy/v1\n", "bnrose-evolve/policy/v1\r\n"),
            ("check=restart", "check=canary"),
        ] {
            let t = base().replacen(from, to, 1);
            assert_ne!(t, base(), "mutation {to:?} applied");
            assert!(Policy::parse(&t).is_err(), "refused: {to:?}");
        }
    }

    #[test]
    fn proposal_parse() {
        let t = format!(
            "{PROPOSAL_HEADER}\ncomponent=svc\nbase={d}\nartifact={d}\ntouch=svc/b\ntouch=svc/a\nclaim=all green, trust me\n",
            d = d()
        );
        let p = ProposalText::parse(&t).unwrap();
        assert_eq!(p.touched, vec!["svc/a", "svc/b"]);
        let dup = t.replace("touch=svc/b", "touch=svc/a");
        assert!(ProposalText::parse(&dup).is_err());
    }
}
