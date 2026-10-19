//! Shared battery harness. The tests play the SOVEREIGN and the AGENT: they
//! sign with ML-DSA-65 from fixed seeds and write the exact
//! bheart.signature/1 shape bsigner's `sign_envelope` writes
//! (crates/bsigner/src/envelope.rs). The controller under test only verifies.

use std::path::{Path, PathBuf};

use bnrose_evolve::controller::CheckCommand;
use bnrose_evolve::digest::{b64u, sha3_plain};
use bnrose_evolve::policy::{command_digest, POLICY_HEADER, PROPOSAL_HEADER};
use bnrose_evolve::tree::tree_digest;
use bnrose_evolve::{Controller, Digest32, Role, RoleKey, SigAlg, TrustRoot};
use ml_dsa::{Keypair, MlDsa65, SignatureEncoding, Signer as _, SigningKey};

pub struct Signer {
    pub key_id: String,
    seed: [u8; 32],
    pub vk: Vec<u8>,
}

impl Signer {
    pub fn new(tag: u8, key_id: &str) -> Signer {
        let seed = [tag; 32];
        let sk = SigningKey::<MlDsa65>::from_seed(&seed.into());
        Signer {
            key_id: key_id.to_string(),
            seed,
            vk: sk.verifying_key().encode().to_vec(),
        }
    }

    pub fn envelope(&self, msg: &[u8]) -> String {
        let sk = SigningKey::<MlDsa65>::from_seed(&self.seed.into());
        let sig = sk.try_sign(msg).unwrap().to_bytes().to_vec();
        serde_json::json!({
            "type": "bheart.signature/1",
            "alg": "ml-dsa-65",
            "key_id": self.key_id,
            "content": {
                "bytes": msg.len(),
                "digest": {"alg": "sha3-256", "b64u": b64u(&sha3_plain(msg)), "bytes": msg.len()},
            },
            "signature": {"alg": "ml-dsa-65", "b64u": b64u(&sig), "bytes": sig.len()},
            "signed_at_ms": 0,
            "agility": "verify dispatches on the alg fields above; unknown ids are refused, never defaulted",
        })
        .to_string()
    }

    pub fn role_key(&self, role: Role) -> RoleKey {
        RoleKey {
            role,
            key_id: self.key_id.clone(),
            alg: SigAlg::MlDsa65,
            verifying_key: self.vk.clone(),
        }
    }

    pub fn trust_line(&self, role: &str) -> String {
        format!("{role} {} ml-dsa-65 {}\n", self.key_id, b64u(&self.vk))
    }
}

pub fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_bnrose-evolve-fixture"))
}

pub fn tmp(tag: &str) -> PathBuf {
    let d = std::env::temp_dir()
        .join("bnrose-evolve-tests")
        .join(format!(
            "{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
    std::fs::create_dir_all(&d).unwrap();
    d
}

pub fn write(root: &Path, rel: &str, body: &str) {
    let p = root.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

pub fn copy_tree(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for e in std::fs::read_dir(from).unwrap() {
        let e = e.unwrap();
        let t = to.join(e.file_name());
        if e.file_type().unwrap().is_dir() {
            copy_tree(&e.path(), &t);
        } else {
            std::fs::copy(e.path(), t).unwrap();
        }
    }
}

pub const DEFECT_CFG: &str = "ack=before_write\nrestart_backoff_ms=200\n";
pub const FIXED_CFG: &str = "ack=after_write\nrestart_backoff_ms=200\n";

/// The policy's knobs a test may vary.
#[derive(Clone)]
pub struct Knobs {
    pub verifier_rev: String,
    pub attempt_ceiling: u64,
    pub total_ceiling: u64,
    /// the arguments the policy pins for the `restart` check
    pub restart_args: Vec<String>,
    /// extra required checks: (id, args)
    pub extra: Vec<(String, Vec<String>)>,
}

impl Default for Knobs {
    fn default() -> Self {
        Knobs {
            verifier_rev: "verifier-r1".into(),
            attempt_ceiling: 30_000,
            total_ceiling: 10_000_000,
            restart_args: args(&["restart"]),
            extra: Vec::new(),
        }
    }
}

pub struct World {
    pub root: PathBuf,
    pub state: PathBuf,
    pub base: PathBuf,
    pub sovereign: Signer,
    pub agent: Signer,
    pub engine: &'static str,
}

pub fn args(a: &[&str]) -> Vec<String> {
    a.iter().map(|s| s.to_string()).collect()
}

impl World {
    pub fn new(tag: &str, engine: &'static str) -> World {
        let root = tmp(tag);
        let base = root.join("base");
        write(&base, "svc/service.cfg", DEFECT_CFG);
        write(&base, "svc/main.txt", "counter service\n");
        write(
            &base,
            "svc/tests/regress.txt",
            "acknowledged writes survive restart\n",
        );
        World {
            state: root.join("state"),
            base,
            root,
            sovereign: Signer::new(1, "sovereign-test-key"),
            agent: Signer::new(2, "agent-test-key"),
            engine,
        }
    }

    pub fn trust(&self) -> TrustRoot {
        TrustRoot::new(vec![
            self.sovereign.role_key(Role::Sovereign),
            self.agent.role_key(Role::Agent),
        ])
        .unwrap()
    }

    pub fn open(&self) -> (Controller, bnrose_evolve::RecoveryReport) {
        Controller::open(&self.state, self.engine, self.trust()).unwrap()
    }

    pub fn policy_text(&self, k: &Knobs, baseline: Digest32) -> String {
        let fx = fixture();
        let d = |a: &[String]| command_digest(&k.verifier_rev, &fx, a).unwrap().text();
        let mut t = format!(
            "{POLICY_HEADER}\npolicy_id=fixture-counter\ncomponent=counter\nbaseline_rev=r0\n\
             baseline_artifact={}\nverifier_rev={}\nwritable=svc/\nprotected=svc/tests/\n\
             protected=policy/\nprotected=.github/\n",
            baseline.text(),
            k.verifier_rev
        );
        t += &format!("check=restart {}\n", d(&k.restart_args));
        t += &format!("check=format {}\n", d(&args(&["format"])));
        for (id, a) in &k.extra {
            t += &format!("check={id} {}\n", d(a));
        }
        t += &format!("canary=canary {}\n", d(&args(&["canary"])));
        t += &format!(
            "attempt_ceiling={}\ntotal_ceiling={}\ncanary_scope=canary-1pct\ndeploy_scope=all-peers\n",
            k.attempt_ceiling, k.total_ceiling
        );
        t
    }

    /// Adopt a sovereign-signed policy over the current baseline tree.
    pub fn adopt(&self, c: &mut Controller, k: &Knobs) -> Digest32 {
        let base = c
            .current()
            .unwrap_or_else(|| tree_digest(&self.base).unwrap());
        let t = self.policy_text(k, base);
        c.adopt_policy(&t, &self.sovereign.envelope(t.as_bytes()))
            .unwrap()
    }

    /// A candidate directory: a copy of `from` with `edits` applied
    /// (body `None` deletes the file).
    pub fn candidate(&self, name: &str, from: &Path, edits: &[(&str, Option<&str>)]) -> PathBuf {
        let d = self.root.join(name);
        copy_tree(from, &d);
        for (rel, body) in edits {
            match body {
                Some(b) => write(&d, rel, b),
                None => std::fs::remove_file(d.join(rel)).unwrap(),
            }
        }
        d
    }

    pub fn proposal(&self, base: Digest32, dir: &Path, touched: &[&str], claim: &str) -> String {
        let mut t = format!(
            "{PROPOSAL_HEADER}\ncomponent=counter\nbase={}\nartifact={}\n",
            base.text(),
            tree_digest(dir).unwrap().text()
        );
        for p in touched {
            t += &format!("touch={p}\n");
        }
        if !claim.is_empty() {
            t += &format!("claim={claim}\n");
        }
        t
    }

    pub fn admit(
        &self,
        c: &mut Controller,
        base_dir: &Path,
        dir: &Path,
        touched: &[&str],
    ) -> Digest32 {
        let t = self.proposal(c.current().unwrap(), dir, touched, "repaired");
        c.admit(&t, &self.agent.envelope(t.as_bytes()), base_dir, dir)
            .unwrap()
    }
}

pub fn cmd<'a>(id: &'a str, program: &'a Path, a: &'a [String]) -> CheckCommand<'a> {
    CheckCommand {
        id,
        program,
        args: a,
    }
}

/// Run the two required checks on a candidate.
pub fn run_required(c: &mut Controller, cand: &Digest32, dir: &Path) {
    let fx = fixture();
    for id in ["restart", "format"] {
        let a = args(&[id]);
        c.run_check(cand, &cmd(id, &fx, &a), dir).unwrap();
    }
}

/// Run the canary probe on a candidate.
pub fn run_canary(c: &mut Controller, cand: &Digest32, dir: &Path) {
    let fx = fixture();
    let a = args(&["canary"]);
    c.run_canary(cand, &cmd("canary", &fx, &a), dir).unwrap();
}

pub fn engines() -> [&'static str; 2] {
    ["sqlite", "surrealkv"]
}
