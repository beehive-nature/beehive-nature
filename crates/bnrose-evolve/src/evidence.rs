//! The evidence classes, kept apart.
//!
//! - A **claim** is what an agent says (`ProposalText::claim`). Nothing reads it.
//! - An **execution record** is what the executor observed: which pinned
//!   command ran, against which artifact bytes, how it ended, what it cost.
//! - A **verdict** is the verifier's evaluation of the recorded executions
//!   against the policy's required checks.
//! - A **decision** (controller.rs) is the promotion authority applying the
//!   policy to the verdict and the canary.
//!
//! Each later class is computed FROM the earlier records, never handed in.
//! None of these types can be constructed outside this crate: the fields are
//! private and the constructors are `pub(crate)`. Missing, partial, stale or
//! interrupted evidence stays NOT_RUN or DEGRADED. Only a bound, completed,
//! zero-exit run is PASS.

use crate::canon::{Dec, Enc};
use crate::digest::{hash, Digest32};
use crate::journal::{dec_opt_digest, enc_opt_digest};
use crate::policy::Policy;
use crate::Refusal;

/// Resource usage of one physical attempt.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Usage {
    Known(u64),
    /// The attempt happened (or may have) and its cost was not observed. It is
    /// never read as zero: exposure charges the full reservation for it.
    Unknown,
}

impl Usage {
    pub fn known(self) -> Option<u64> {
        match self {
            Usage::Known(n) => Some(n),
            Usage::Unknown => None,
        }
    }
    pub fn from_known(v: Option<u64>) -> Usage {
        match v {
            Some(n) => Usage::Known(n),
            None => Usage::Unknown,
        }
    }
}

/// How one execution ended, as observed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ExecStatus {
    /// The worker ran to its own exit and was reaped.
    Ran { code: i64 },
    /// The worker was cancelled (timeout or intent) and reaped. Partial.
    Interrupted { reason: String },
    /// The worker changed the artifact it was checking. Its exit code is kept
    /// but the run proves nothing about the admitted bytes.
    ArtifactMutated { code: i64 },
    /// Nothing ran. The reason says why.
    NotRun { reason: String },
}

/// One observed execution of one pinned verifier command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExecRecord {
    pub(crate) attempt: Digest32,
    /// The candidate under test, or `None` for the baseline.
    pub(crate) subject: Option<Digest32>,
    pub(crate) check: String,
    pub(crate) command: Digest32,
    pub(crate) verifier_rev: String,
    pub(crate) policy: Digest32,
    /// The artifact digest the executor itself computed immediately before
    /// the run (not the one the proposal declared).
    pub(crate) artifact: Digest32,
    pub(crate) scope: String,
    pub(crate) status: ExecStatus,
    pub(crate) stdout: Digest32,
    pub(crate) stderr: Digest32,
    pub(crate) elapsed: u64,
}

impl ExecRecord {
    pub fn attempt(&self) -> Digest32 {
        self.attempt
    }
    pub fn subject(&self) -> Option<Digest32> {
        self.subject
    }
    pub fn check(&self) -> &str {
        &self.check
    }
    pub fn artifact(&self) -> Digest32 {
        self.artifact
    }
    pub fn status(&self) -> &ExecStatus {
        &self.status
    }
    pub fn stdout_digest(&self) -> Digest32 {
        self.stdout
    }
    pub fn elapsed(&self) -> u64 {
        self.elapsed
    }
    pub fn scope(&self) -> &str {
        &self.scope
    }

    pub(crate) fn encode_into(&self, e: Enc) -> Enc {
        let e = enc_opt_digest(e.digest(&self.attempt), &self.subject)
            .str(&self.check)
            .digest(&self.command)
            .str(&self.verifier_rev)
            .digest(&self.policy)
            .digest(&self.artifact)
            .str(&self.scope);
        let e = match &self.status {
            ExecStatus::Ran { code } => e.u8(0).i64(*code),
            ExecStatus::Interrupted { reason } => e.u8(1).str(reason),
            ExecStatus::ArtifactMutated { code } => e.u8(2).i64(*code),
            ExecStatus::NotRun { reason } => e.u8(3).str(reason),
        };
        e.digest(&self.stdout)
            .digest(&self.stderr)
            .u64(self.elapsed)
    }

    pub(crate) fn decode_from(r: &mut Dec) -> Result<ExecRecord, Refusal> {
        let attempt = r.digest()?;
        let subject = dec_opt_digest(r)?;
        let check = r.str()?;
        let command = r.digest()?;
        let verifier_rev = r.str()?;
        let policy = r.digest()?;
        let artifact = r.digest()?;
        let scope = r.str()?;
        let status = match r.u8()? {
            0 => ExecStatus::Ran { code: r.i64()? },
            1 => ExecStatus::Interrupted { reason: r.str()? },
            2 => ExecStatus::ArtifactMutated { code: r.i64()? },
            3 => ExecStatus::NotRun { reason: r.str()? },
            _ => return Err(Refusal::Corrupt("exec status tag".into())),
        };
        Ok(ExecRecord {
            attempt,
            subject,
            check,
            command,
            verifier_rev,
            policy,
            artifact,
            scope,
            status,
            stdout: r.digest()?,
            stderr: r.digest()?,
            elapsed: r.u64()?,
        })
    }
}

/// The verifier's outcome for one required check.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Outcome {
    Pass = 0,
    NotRun = 1,
    Degraded = 2,
    Fail = 3,
}

impl Outcome {
    pub fn name(self) -> &'static str {
        match self {
            Outcome::Pass => "PASS",
            Outcome::NotRun => "NOT_RUN",
            Outcome::Degraded => "DEGRADED",
            Outcome::Fail => "FAIL",
        }
    }
    fn from_u8(v: u8) -> Result<Outcome, Refusal> {
        Ok(match v {
            0 => Outcome::Pass,
            1 => Outcome::NotRun,
            2 => Outcome::Degraded,
            3 => Outcome::Fail,
            _ => return Err(Refusal::Corrupt("outcome".into())),
        })
    }
}

/// The verdict on one check, with the attempts it rests on and a count of the
/// records that were set aside as unbound (stale artifact, other verifier
/// revision, other policy, other command).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckVerdict {
    pub(crate) id: String,
    pub(crate) outcome: Outcome,
    pub(crate) basis: Vec<Digest32>,
    pub(crate) unbound: u64,
}

impl CheckVerdict {
    pub fn id(&self) -> &str {
        &self.id
    }
    pub fn outcome(&self) -> Outcome {
        self.outcome
    }
    pub fn basis(&self) -> &[Digest32] {
        &self.basis
    }
    pub fn unbound(&self) -> u64 {
        self.unbound
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Verdict {
    pub(crate) subject: Option<Digest32>,
    pub(crate) policy: Digest32,
    pub(crate) artifact: Digest32,
    pub(crate) checks: Vec<CheckVerdict>,
    pub(crate) overall: Outcome,
}

impl Verdict {
    pub fn overall(&self) -> Outcome {
        self.overall
    }
    pub fn checks(&self) -> &[CheckVerdict] {
        &self.checks
    }
    pub fn check(&self, id: &str) -> Option<&CheckVerdict> {
        self.checks.iter().find(|c| c.id == id)
    }
    pub fn digest(&self) -> Digest32 {
        hash(
            "bnrose-evolve/verdict/v1",
            &[&self.encode_into(Enc::new(0)).done()],
        )
    }

    pub(crate) fn encode_into(&self, e: Enc) -> Enc {
        let mut e = enc_opt_digest(e, &self.subject)
            .digest(&self.policy)
            .digest(&self.artifact)
            .u64(self.checks.len() as u64);
        for c in &self.checks {
            e = e.str(&c.id).u8(c.outcome as u8).u64(c.basis.len() as u64);
            for b in &c.basis {
                e = e.digest(b);
            }
            e = e.u64(c.unbound);
        }
        e.u8(self.overall as u8)
    }

    pub(crate) fn decode_from(r: &mut Dec) -> Result<Verdict, Refusal> {
        let subject = dec_opt_digest(r)?;
        let policy = r.digest()?;
        let artifact = r.digest()?;
        let n = r.u64()?;
        if n > 4096 {
            return Err(Refusal::Corrupt("check count".into()));
        }
        let mut checks = Vec::new();
        for _ in 0..n {
            let id = r.str()?;
            let outcome = Outcome::from_u8(r.u8()?)?;
            let nb = r.u64()?;
            if nb > 1 << 16 {
                return Err(Refusal::Corrupt("basis count".into()));
            }
            let basis = (0..nb).map(|_| r.digest()).collect::<Result<_, _>>()?;
            checks.push(CheckVerdict {
                id,
                outcome,
                basis,
                unbound: r.u64()?,
            });
        }
        Ok(Verdict {
            subject,
            policy,
            artifact,
            checks,
            overall: Outcome::from_u8(r.u8()?)?,
        })
    }
}

/// THE verifier. It reads only execution records the executor journaled and
/// the policy's pinned checks. A record counts toward a check only when it is
/// bound to every one of: this subject, this check id, the pinned command
/// digest, the policy's verifier revision, this policy, and the exact artifact
/// digest under judgment. Among bound records any FAIL wins (a later passing
/// retry does not erase a failure), then DEGRADED, then PASS; no bound record
/// is NOT_RUN. The overall outcome is the worst check outcome.
pub(crate) fn judge(
    policy: &Policy,
    policy_digest: Digest32,
    subject: Option<Digest32>,
    artifact: Digest32,
    records: &[&ExecRecord],
) -> Verdict {
    let mut checks = Vec::with_capacity(policy.checks.len());
    for spec in &policy.checks {
        let mut basis = Vec::new();
        let mut unbound = 0u64;
        let mut worst: Option<Outcome> = None;
        for x in records
            .iter()
            .filter(|x| x.subject == subject && x.check == spec.id)
        {
            let bound = x.command == spec.command
                && x.verifier_rev == policy.verifier_rev
                && x.policy == policy_digest
                && x.artifact == artifact;
            if !bound {
                unbound += 1;
                continue;
            }
            let o = match &x.status {
                ExecStatus::Ran { code: 0 } => Outcome::Pass,
                ExecStatus::Ran { .. } => Outcome::Fail,
                ExecStatus::Interrupted { .. } | ExecStatus::ArtifactMutated { .. } => {
                    Outcome::Degraded
                }
                ExecStatus::NotRun { .. } => Outcome::NotRun,
            };
            basis.push(x.attempt);
            // FAIL > DEGRADED > PASS > NOT_RUN among bound records: a real run
            // outranks an attempt that never ran
            worst = Some(match worst {
                None => o,
                Some(w) => {
                    let rank = |o: Outcome| match o {
                        Outcome::Fail => 3,
                        Outcome::Degraded => 2,
                        Outcome::Pass => 1,
                        Outcome::NotRun => 0,
                    };
                    if rank(o) > rank(w) {
                        o
                    } else {
                        w
                    }
                }
            });
        }
        checks.push(CheckVerdict {
            id: spec.id.clone(),
            outcome: worst.unwrap_or(Outcome::NotRun),
            basis,
            unbound,
        });
    }
    let overall = checks
        .iter()
        .map(|c| c.outcome)
        .max()
        .unwrap_or(Outcome::NotRun);
    Verdict {
        subject,
        policy: policy_digest,
        artifact,
        checks,
        overall,
    }
}
