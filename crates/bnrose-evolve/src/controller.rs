//! The controller: one state directory, one exclusive holder, one journal,
//! and every authority's act written there before it counts.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::anchor::{AnchorCheck, AnchorLookup, LocalView};
use crate::attest::{Role, TrustRoot};
use crate::canon::{Dec, Enc};
use crate::digest::{hash, Digest32};
use crate::evidence::{judge, ExecRecord, ExecStatus, Outcome, Usage, Verdict};
use crate::executor::run_bounded;
use crate::journal::{Journal, Record};
use crate::lessons::{class_id, Lesson, LessonEvent, LessonState};
use crate::policy::{command_digest, CheckSpec, Policy, ProposalText};
use crate::tree::{changed, digest_of, manifest, tree_digest};
use crate::Refusal;

const CLAIM: &str = "evolve.claim";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecisionKind {
    /// Every required check PASS and the canary healthy: the candidate becomes
    /// the current implementation within the deploy scope.
    Promote,
    /// The canary failed: the canary scope returns to the current
    /// implementation, which stays in force.
    RollBack,
    /// Evidence is missing, partial, stale or failing: nothing changes.
    Hold,
}

impl DecisionKind {
    pub fn name(self) -> &'static str {
        match self {
            DecisionKind::Promote => "PROMOTE",
            DecisionKind::RollBack => "ROLL_BACK",
            DecisionKind::Hold => "HOLD",
        }
    }
}

/// The promotion authority's act, binding everything it rested on: the
/// policy, the source revision, the verifier revision, the artifact, the
/// verdict, the canary attempt, the usage, and the scope.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Decision {
    pub(crate) candidate: Digest32,
    pub(crate) kind: DecisionKind,
    pub(crate) reasons: Vec<String>,
    pub(crate) policy: Digest32,
    pub(crate) baseline_rev: String,
    pub(crate) verifier_rev: String,
    pub(crate) artifact: Digest32,
    pub(crate) replaces: Digest32,
    pub(crate) verdict: Digest32,
    pub(crate) canary: Option<Digest32>,
    pub(crate) usage_known: u64,
    pub(crate) usage_unknown_attempts: u64,
    pub(crate) scope: String,
}

impl Decision {
    pub fn kind(&self) -> DecisionKind {
        self.kind
    }
    pub fn candidate(&self) -> Digest32 {
        self.candidate
    }
    pub fn reasons(&self) -> &[String] {
        &self.reasons
    }
    pub fn artifact(&self) -> Digest32 {
        self.artifact
    }
    pub fn replaces(&self) -> Digest32 {
        self.replaces
    }
    pub fn verdict(&self) -> Digest32 {
        self.verdict
    }
    pub fn scope(&self) -> &str {
        &self.scope
    }
    pub fn usage_known(&self) -> u64 {
        self.usage_known
    }
    /// The canonical statement of this decision — the bytes an external
    /// anchor or a deploying peer would hold.
    pub fn statement(&self) -> Vec<u8> {
        self.encode_into(Enc::new(0)).done()
    }
    pub fn digest(&self) -> Digest32 {
        hash("bnrose-evolve/decision/v1", &[&self.statement()])
    }

    pub(crate) fn encode_into(&self, e: Enc) -> Enc {
        let e = e
            .digest(&self.candidate)
            .u8(self.kind as u8)
            .strs(&self.reasons)
            .digest(&self.policy)
            .str(&self.baseline_rev)
            .str(&self.verifier_rev)
            .digest(&self.artifact)
            .digest(&self.replaces)
            .digest(&self.verdict);
        crate::journal::enc_opt_digest(e, &self.canary)
            .u64(self.usage_known)
            .u64(self.usage_unknown_attempts)
            .str(&self.scope)
    }

    pub(crate) fn decode_from(r: &mut Dec) -> Result<Decision, Refusal> {
        Ok(Decision {
            candidate: r.digest()?,
            kind: match r.u8()? {
                0 => DecisionKind::Promote,
                1 => DecisionKind::RollBack,
                2 => DecisionKind::Hold,
                _ => return Err(Refusal::Corrupt("decision kind".into())),
            },
            reasons: r.strs()?,
            policy: r.digest()?,
            baseline_rev: r.str()?,
            verifier_rev: r.str()?,
            artifact: r.digest()?,
            replaces: r.digest()?,
            verdict: r.digest()?,
            canary: crate::journal::dec_opt_digest(r)?,
            usage_known: r.u64()?,
            usage_unknown_attempts: r.u64()?,
            scope: r.str()?,
        })
    }
}

#[derive(Clone, Debug)]
struct Attempt {
    subject: Option<Digest32>,
    amount: u64,
    dispatched: bool,
    pid: Option<u64>,
    cancel: bool,
    exited: bool,
    executed: Option<u64>,
    settled: Option<Usage>,
}

#[derive(Clone, Debug)]
struct Candidate {
    policy: Digest32,
    base: Digest32,
    artifact: Digest32,
}

/// Everything the controller knows, rebuilt from the journal alone.
#[derive(Default)]
struct State {
    policy: Option<(Digest32, Policy)>,
    candidates: BTreeMap<Digest32, Candidate>,
    attempts: BTreeMap<Digest32, Attempt>,
    attempt_order: Vec<Digest32>,
    execs: Vec<ExecRecord>,
    verdicts: BTreeMap<Digest32, Verdict>,
    decisions: Vec<Decision>,
    /// The implementation in force: the latest of the sovereign's declared
    /// baseline and a promotion.
    current: Option<Digest32>,
    observations: BTreeMap<Digest32, String>,
    lessons: Vec<Lesson>,
}

impl State {
    fn apply(&mut self, rec: &Record) {
        match rec {
            Record::PolicyAdopted { policy, text, .. } => {
                // admitted through Policy::parse before it was journaled; a
                // journaled text that no longer parses is caught at open
                if let Ok(p) = Policy::parse(text) {
                    // the sovereign's policy declares what is in force
                    self.current = Some(p.baseline_artifact);
                    self.policy = Some((*policy, p));
                }
            }
            Record::Observation { id, what, .. } => {
                self.observations.insert(*id, what.clone());
            }
            Record::ProposalAdmitted {
                candidate,
                policy,
                text,
                artifact,
                ..
            } => {
                let base = ProposalText::parse(text)
                    .map(|p| p.base)
                    .unwrap_or(Digest32::ZERO);
                self.candidates.insert(
                    *candidate,
                    Candidate {
                        policy: *policy,
                        base,
                        artifact: *artifact,
                    },
                );
            }
            Record::Reserved {
                attempt,
                subject,
                amount,
                ..
            } => {
                self.attempts.insert(
                    *attempt,
                    Attempt {
                        subject: *subject,
                        amount: *amount,
                        dispatched: false,
                        pid: None,
                        cancel: false,
                        exited: false,
                        executed: None,
                        settled: None,
                    },
                );
                self.attempt_order.push(*attempt);
            }
            Record::Dispatched { attempt } => {
                if let Some(a) = self.attempts.get_mut(attempt) {
                    a.dispatched = true;
                }
            }
            Record::Spawned { attempt, pid } => {
                if let Some(a) = self.attempts.get_mut(attempt) {
                    a.pid = Some(*pid);
                }
            }
            Record::CancelIntent { attempt, .. } => {
                if let Some(a) = self.attempts.get_mut(attempt) {
                    a.cancel = true;
                }
            }
            Record::WorkerExited { attempt, .. } => {
                if let Some(a) = self.attempts.get_mut(attempt) {
                    a.exited = true;
                }
            }
            Record::Executed(x) => {
                if let Some(a) = self.attempts.get_mut(&x.attempt) {
                    a.executed = Some(x.elapsed);
                }
                self.execs.push(x.clone());
            }
            Record::Settled { attempt, usage, .. } => {
                if let Some(a) = self.attempts.get_mut(attempt) {
                    a.settled = Some(*usage);
                }
            }
            Record::VerdictRecorded(v) => {
                self.verdicts.insert(v.digest(), v.clone());
            }
            Record::Decision(d) => {
                if d.kind == DecisionKind::Promote {
                    self.current = Some(d.artifact);
                }
                self.decisions.push(d.clone());
            }
            Record::Rescue { .. } => {}
            Record::Lesson(ev) => Lesson::apply(&mut self.lessons, ev),
        }
    }

    /// The implementation in force.
    fn current(&self) -> Option<Digest32> {
        self.current
    }

    /// Authoritative exposure: settled known usage, plus the full reservation
    /// for every outstanding attempt and every attempt whose usage is unknown.
    fn exposure(&self) -> u64 {
        self.attempts
            .values()
            .map(|a| match a.settled {
                Some(Usage::Known(n)) => n,
                Some(Usage::Unknown) | None => a.amount,
            })
            .fold(0u64, u64::saturating_add)
    }
}

/// What open found and did, before it accepted any new work.
#[derive(Clone, Debug, Default)]
pub struct RecoveryReport {
    pub engine: &'static str,
    pub records: u64,
    pub head: Digest32,
    /// Reserved, never dispatched: conclusively never ran, settled at zero.
    pub never_dispatched: Vec<Digest32>,
    /// Executed but unsettled: settled from the execution record's own usage.
    pub settled_from_evidence: Vec<Digest32>,
    /// Dispatched and never observed to finish, or finished with the result
    /// lost: preserved in the rescue record, settled UNKNOWN, never re-run.
    pub unresolved: Vec<Digest32>,
    /// Processes this controller can no longer prove it owns.
    pub owed_cleanup: Vec<String>,
    pub exposure: u64,
}

/// A verifier command as the caller supplies it. It becomes runnable only
/// when its digest equals the one the policy pins for `id`.
pub struct CheckCommand<'a> {
    pub id: &'a str,
    pub program: &'a Path,
    pub args: &'a [String],
}

pub struct Controller {
    dir: PathBuf,
    trust: TrustRoot,
    journal: Journal,
    state: State,
}

impl Drop for Controller {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(self.dir.join(CLAIM));
    }
}

impl Controller {
    /// Claim `dir` exclusively (an OS-atomic create, before any read), open
    /// the journal on `engine` ("sqlite" | "surrealkv"), verify and replay it,
    /// then settle what a previous holder left unresolved — writing the rescue
    /// record first.
    pub fn open(
        dir: &Path,
        engine: &str,
        trust: TrustRoot,
    ) -> Result<(Controller, RecoveryReport), Refusal> {
        Self::open_gated(dir, engine, trust, |_| Ok(())).map(|(c, rep, ())| (c, rep))
    }

    /// [`Controller::open`], with the journal compared against the latest
    /// external anchor after it is verified and replayed and BEFORE recovery
    /// writes anything: a journal shorter than the anchor, or whose anchored
    /// prefix is not the anchored one, is refused as `Tampered` and nothing
    /// is appended to it. See [`crate::anchor`].
    pub fn open_anchored(
        dir: &Path,
        engine: &str,
        trust: TrustRoot,
        subject: &str,
        latest: &AnchorLookup,
    ) -> Result<(Controller, RecoveryReport, AnchorCheck), Refusal> {
        Self::open_gated(dir, engine, trust, |c| {
            crate::anchor::check(&c.local_view(), subject, latest)
        })
    }

    fn open_gated<T>(
        dir: &Path,
        engine: &str,
        trust: TrustRoot,
        gate: impl FnOnce(&Controller) -> Result<T, Refusal>,
    ) -> Result<(Controller, RecoveryReport, T), Refusal> {
        std::fs::create_dir_all(dir).map_err(|e| Refusal::Store(e.to_string()))?;
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dir.join(CLAIM))
        {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(Refusal::Claimed)
            }
            Err(e) => return Err(Refusal::Store(e.to_string())),
        }
        match Self::open_claimed(dir, engine, trust, gate) {
            Ok(v) => Ok(v),
            Err(e) => {
                let _ = std::fs::remove_file(dir.join(CLAIM));
                Err(e)
            }
        }
    }

    /// The explicit gesture for a holder that died without releasing its
    /// claim. Never automatic, never a retry loop: the caller asserts that no
    /// other controller is alive on `dir`.
    pub fn open_adopting_stale_claim(
        dir: &Path,
        engine: &str,
        trust: TrustRoot,
    ) -> Result<(Controller, RecoveryReport), Refusal> {
        let _ = std::fs::remove_file(dir.join(CLAIM));
        Self::open(dir, engine, trust)
    }

    fn open_claimed<T>(
        dir: &Path,
        engine: &str,
        trust: TrustRoot,
        gate: impl FnOnce(&Controller) -> Result<T, Refusal>,
    ) -> Result<(Controller, RecoveryReport, T), Refusal> {
        let store =
            adapter_store::open_named(engine, &dir.join("store")).map_err(Refusal::store)?;
        let (journal, records) = Journal::open(store)?;
        let mut state = State::default();
        for (i, r) in records.iter().enumerate() {
            if let Record::PolicyAdopted { text, .. } = r {
                Policy::parse(text).map_err(|e| {
                    Refusal::Tampered(format!("journaled policy at {i} no longer parses: {e}"))
                })?;
            }
            state.apply(r);
        }
        let mut c = Controller {
            dir: dir.to_path_buf(),
            trust,
            journal,
            state,
        };
        // the gate reads the replayed journal before recovery appends to it
        let gated = gate(&c)?;
        let report = c.recover()?;
        Ok((c, report, gated))
    }

    fn recover(&mut self) -> Result<RecoveryReport, Refusal> {
        let mut rep = RecoveryReport {
            engine: self.journal.engine(),
            ..Default::default()
        };
        let mut settle: Vec<(Digest32, Usage, &'static str)> = Vec::new();
        for id in &self.state.attempt_order {
            let a = &self.state.attempts[id];
            if a.settled.is_some() {
                continue;
            }
            if !a.dispatched {
                rep.never_dispatched.push(*id);
                settle.push((
                    *id,
                    Usage::Known(0),
                    "reserved, never dispatched: conclusively did not run",
                ));
            } else if let Some(elapsed) = a.executed {
                rep.settled_from_evidence.push(*id);
                settle.push((
                    *id,
                    Usage::Known(elapsed),
                    "settled from its execution record",
                ));
            } else {
                rep.unresolved.push(*id);
                if !a.exited {
                    rep.owed_cleanup.push(match a.pid {
                        Some(p) => {
                            format!(
                            "attempt {id}: pid {p} was never observed to exit{}; this controller \
                             will not signal a pid it cannot prove it still owns",
                            if a.cancel { " (a cancellation was intended)" } else { "" }
                        )
                        }
                        None => format!(
                            "attempt {id}: dispatched, spawn not recorded; no process is known"
                        ),
                    });
                }
                settle.push((
                    *id,
                    Usage::Unknown,
                    if a.exited {
                        "worker exited, result lost: usage unknown, charged at reservation"
                    } else {
                        "worker ownership lost: usage unknown, charged at reservation"
                    },
                ));
            }
        }
        // the rescue record precedes every settlement it explains
        if !rep.unresolved.is_empty() {
            self.commit(Record::Rescue {
                unresolved: rep.unresolved.clone(),
                owed_cleanup: rep.owed_cleanup.clone(),
            })?;
        }
        for (attempt, usage, note) in settle {
            self.commit(Record::Settled {
                attempt,
                usage,
                note: note.to_string(),
            })?;
        }
        let (n, head) = self.journal.head();
        rep.records = n;
        rep.head = head;
        rep.exposure = self.state.exposure();
        Ok(rep)
    }

    fn commit(&mut self, rec: Record) -> Result<u64, Refusal> {
        let seq = self.journal.append(&rec)?;
        self.state.apply(&rec);
        Ok(seq)
    }

    // ---- read side -------------------------------------------------------

    pub fn head(&self) -> (u64, Digest32) {
        self.journal.head()
    }
    /// The digest of the latest PROMOTE decision, if any.
    pub fn latest_promote(&self) -> Option<Digest32> {
        self.state
            .decisions
            .iter()
            .rev()
            .find(|d| d.kind == DecisionKind::Promote)
            .map(|d| d.digest())
    }
    /// What an anchor statement is built from and compared against.
    pub fn local_view(&self) -> LocalView<'_> {
        LocalView {
            journal: &self.journal,
            promote: self.latest_promote(),
            policy: self.policy_digest(),
        }
    }
    pub fn policy(&self) -> Option<&Policy> {
        self.state.policy.as_ref().map(|(_, p)| p)
    }
    pub fn policy_digest(&self) -> Option<Digest32> {
        self.state.policy.as_ref().map(|(d, _)| *d)
    }
    /// The implementation in force.
    pub fn current(&self) -> Option<Digest32> {
        self.state.current()
    }
    pub fn exposure(&self) -> u64 {
        self.state.exposure()
    }
    /// Attempts whose usage is unknown: liabilities kept open, never zeroed.
    pub fn unresolved_liabilities(&self) -> Vec<(Digest32, u64)> {
        self.state
            .attempt_order
            .iter()
            .filter_map(|id| {
                let a = &self.state.attempts[id];
                matches!(a.settled, Some(Usage::Unknown)).then_some((*id, a.amount))
            })
            .collect()
    }
    pub fn execs(&self) -> &[ExecRecord] {
        &self.state.execs
    }
    pub fn decisions(&self) -> &[Decision] {
        &self.state.decisions
    }
    pub fn lessons(&self) -> &[Lesson] {
        &self.state.lessons
    }
    pub fn lesson(&self, class: &Digest32) -> Option<&Lesson> {
        self.state.lessons.iter().find(|l| l.class == *class)
    }
    pub fn blob(&self, d: &Digest32) -> Result<Option<Vec<u8>>, Refusal> {
        self.journal.get_blob(d)
    }
    pub fn attempts_for(&self, subject: Option<Digest32>) -> usize {
        self.state
            .attempts
            .values()
            .filter(|a| a.subject == subject)
            .count()
    }

    fn policy_now(&self) -> Result<(Digest32, Policy), Refusal> {
        self.state.policy.clone().ok_or(Refusal::NoPolicy)
    }

    // ---- sovereign -------------------------------------------------------

    /// Adopt a policy. It must be signed by a SOVEREIGN key of the trust root;
    /// an agent's valid signature is refused by role.
    pub fn adopt_policy(&mut self, text: &str, envelope: &str) -> Result<Digest32, Refusal> {
        let key_id = self
            .trust
            .verify(envelope, text.as_bytes(), Role::Sovereign)?;
        Policy::parse(text)?;
        let digest = hash("bnrose-evolve/policy-text/v1", &[text.as_bytes()]);
        if self.policy_digest() == Some(digest) {
            return Ok(digest);
        }
        self.commit(Record::PolicyAdopted {
            policy: digest,
            text: text.to_string(),
            envelope: envelope.to_string(),
            key_id,
        })?;
        Ok(digest)
    }

    // ---- observe ---------------------------------------------------------

    /// Keep a triggering fault as evidence: the raw bytes become a blob and
    /// the observation names them.
    pub fn observe(&mut self, what: &str, evidence: &[u8]) -> Result<Digest32, Refusal> {
        let ev = self.journal.put_blob(evidence)?;
        let id = hash("bnrose-evolve/observation/v1", &[what.as_bytes(), &ev.0]);
        if !self.state.observations.contains_key(&id) {
            self.commit(Record::Observation {
                id,
                what: what.to_string(),
                evidence: ev,
            })?;
        }
        Ok(id)
    }

    // ---- proposal authority ---------------------------------------------

    /// Admit an agent's candidate. `base_dir` must hold exactly the current
    /// implementation and `candidate_dir` exactly the artifact the agent
    /// signed. The change set is COMPUTED here, checked against the policy
    /// (protected wins over writable), and must equal the one declared.
    pub fn admit(
        &mut self,
        text: &str,
        envelope: &str,
        base_dir: &Path,
        candidate_dir: &Path,
    ) -> Result<Digest32, Refusal> {
        let (pd, policy) = self.policy_now()?;
        let key_id = self.trust.verify(envelope, text.as_bytes(), Role::Agent)?;
        let prop = ProposalText::parse(text)?;
        if prop.component != policy.component {
            return Err(Refusal::Policy(format!(
                "component {:?} is not the authorized component {:?}",
                prop.component, policy.component
            )));
        }
        let current = self.state.current().ok_or(Refusal::NoPolicy)?;
        if prop.base != current {
            return Err(Refusal::StaleBase);
        }
        let base_m = manifest(base_dir)?;
        if digest_of(&base_m) != current {
            return Err(Refusal::Artifact(
                "the supplied base tree is not the current implementation".into(),
            ));
        }
        let cand_m = manifest(candidate_dir)?;
        if digest_of(&cand_m) != prop.artifact {
            return Err(Refusal::Artifact(
                "the candidate tree is not the artifact the agent signed".into(),
            ));
        }
        let computed = changed(&base_m, &cand_m);
        if computed.is_empty() {
            return Err(Refusal::Policy("the candidate changes nothing".into()));
        }
        for p in &computed {
            policy.may_touch(p)?;
        }
        if computed != prop.touched {
            return Err(Refusal::UndeclaredChange {
                declared: prop.touched,
                computed,
            });
        }
        let candidate = hash(
            "bnrose-evolve/candidate/v1",
            &[&pd.0, &current.0, &prop.artifact.0],
        );
        if self.state.candidates.contains_key(&candidate) {
            return Ok(candidate);
        }
        self.commit(Record::ProposalAdmitted {
            candidate,
            policy: pd,
            text: text.to_string(),
            envelope: envelope.to_string(),
            key_id,
            artifact: prop.artifact,
            changed: computed,
        })?;
        Ok(candidate)
    }

    // ---- execution authority --------------------------------------------

    /// Run one pinned check against the BASELINE (the implementation in
    /// force): reproduction and recurrence checks run here.
    pub fn run_baseline(&mut self, cmd: &CheckCommand, dir: &Path) -> Result<ExecRecord, Refusal> {
        let current = self.state.current().ok_or(Refusal::NoPolicy)?;
        self.run(None, current, cmd, dir, false)
    }

    /// Run one pinned required check against an admitted candidate.
    pub fn run_check(
        &mut self,
        candidate: &Digest32,
        cmd: &CheckCommand,
        dir: &Path,
    ) -> Result<ExecRecord, Refusal> {
        let c = self.candidate(candidate)?;
        self.run(Some(*candidate), c.artifact, cmd, dir, false)
    }

    /// Run the canary probe against a candidate — only once the verifier has
    /// passed it. No canary ever runs on unverified bytes.
    pub fn run_canary(
        &mut self,
        candidate: &Digest32,
        cmd: &CheckCommand,
        dir: &Path,
    ) -> Result<ExecRecord, Refusal> {
        let c = self.candidate(candidate)?;
        let v = self.verdict(candidate)?;
        if v.overall() != Outcome::Pass {
            return Err(Refusal::Canary(format!(
                "verdict is {}, not PASS: no canary on unverified bytes",
                v.overall().name()
            )));
        }
        self.run(Some(*candidate), c.artifact, cmd, dir, true)
    }

    fn candidate(&self, id: &Digest32) -> Result<Candidate, Refusal> {
        self.state
            .candidates
            .get(id)
            .cloned()
            .ok_or_else(|| Refusal::Unknown(format!("candidate {id}")))
    }

    fn run(
        &mut self,
        subject: Option<Digest32>,
        expected: Digest32,
        cmd: &CheckCommand,
        dir: &Path,
        canary: bool,
    ) -> Result<ExecRecord, Refusal> {
        let (pd, policy) = self.policy_now()?;
        let spec: CheckSpec = if canary {
            if cmd.id != policy.canary.id {
                return Err(Refusal::Verifier(format!(
                    "{:?} is not the policy's canary probe",
                    cmd.id
                )));
            }
            policy.canary.clone()
        } else {
            policy
                .check(cmd.id)
                .cloned()
                .ok_or_else(|| Refusal::Verifier(format!("{:?} is not a required check", cmd.id)))?
        };
        let digest = command_digest(&policy.verifier_rev, cmd.program, cmd.args)?;
        if digest != spec.command {
            return Err(Refusal::Verifier(format!(
                "command for {:?} is not the pinned one",
                cmd.id
            )));
        }
        // the bytes under test must be exactly the admitted bytes, right now
        let before = tree_digest(dir)?;
        if before != expected {
            return Err(Refusal::Artifact(
                "the tree on disk is not the admitted artifact (changed since admission?)".into(),
            ));
        }
        let amount = policy.attempt_ceiling;
        let exposure = self.state.exposure();
        if exposure.saturating_add(amount) > policy.total_ceiling {
            return Err(Refusal::Budget {
                exposure,
                amount,
                ceiling: policy.total_ceiling,
            });
        }
        let attempt = hash(
            "bnrose-evolve/attempt/v1",
            &[
                &self.journal.next_seq().to_be_bytes(),
                &subject.unwrap_or(Digest32::ZERO).0,
                cmd.id.as_bytes(),
            ],
        );
        self.commit(Record::Reserved {
            attempt,
            subject,
            check: cmd.id.to_string(),
            amount,
        })?;
        self.commit(Record::Dispatched { attempt })?;

        let run = {
            let me = RefCell::new(&mut *self);
            let mut on_spawned = |pid: u64| {
                me.borrow_mut()
                    .commit(Record::Spawned { attempt, pid })
                    .map(|_| ())
            };
            let mut on_cancel = || {
                me.borrow_mut()
                    .commit(Record::CancelIntent {
                        attempt,
                        reason: format!("attempt ceiling {amount} ms reached"),
                    })
                    .map(|_| ())
            };
            run_bounded(
                cmd.program,
                cmd.args,
                dir,
                Duration::from_millis(amount),
                &mut on_spawned,
                &mut on_cancel,
            )
        };
        let this = self;

        let scope = if canary {
            policy.canary_scope.clone()
        } else {
            "verify".to_string()
        };
        // `measured` is None when the run produced no observation of its own
        // cost: the attempt then settles UNKNOWN, never at a false zero
        let (status, out, err, measured) = match run {
            Err(e) => {
                let empty = this.journal.put_blob(b"")?;
                (
                    ExecStatus::NotRun {
                        reason: format!("no result: {e}"),
                    },
                    empty,
                    empty,
                    None,
                )
            }
            Ok(o) => {
                this.commit(Record::WorkerExited {
                    attempt,
                    code: o.code,
                    killed: o.killed,
                })?;
                let out = this.journal.put_blob(&o.stdout)?;
                let err = this.journal.put_blob(&o.stderr)?;
                let after = tree_digest(dir);
                let status = if o.killed {
                    ExecStatus::Interrupted {
                        reason: "cancelled at the attempt ceiling".into(),
                    }
                } else if o.overflow {
                    ExecStatus::Interrupted {
                        reason: "output exceeded the evidence cap".into(),
                    }
                } else if after.as_ref().ok() != Some(&before) {
                    ExecStatus::ArtifactMutated {
                        code: o.code.unwrap_or(-1),
                    }
                } else {
                    match o.code {
                        Some(code) => ExecStatus::Ran { code },
                        None => ExecStatus::Interrupted {
                            reason: "worker died by signal".into(),
                        },
                    }
                };
                (status, out, err, Some(o.elapsed_ms))
            }
        };
        let elapsed = measured.unwrap_or(0);
        let x = ExecRecord {
            attempt,
            subject,
            check: cmd.id.to_string(),
            command: digest,
            verifier_rev: policy.verifier_rev.clone(),
            policy: pd,
            artifact: before,
            scope,
            status,
            stdout: out,
            stderr: err,
            elapsed,
        };
        this.commit(Record::Executed(x.clone()))?;
        this.commit(Record::Settled {
            attempt,
            usage: Usage::from_known(measured),
            note: match measured {
                Some(_) => "measured wall time of the attempt".into(),
                None => "no measurement: charged at the reservation until reconciled".into(),
            },
        })?;
        Ok(x)
    }

    /// Later evidence of what an UNKNOWN attempt actually cost. Only
    /// unknown → known; a settled amount is never revised downward silently.
    pub fn reconcile_unknown(
        &mut self,
        attempt: &Digest32,
        actual: u64,
        why: &str,
    ) -> Result<(), Refusal> {
        match self.state.attempts.get(attempt).map(|a| a.settled) {
            Some(Some(Usage::Unknown)) => {}
            Some(_) => {
                return Err(Refusal::Unknown(format!(
                    "attempt {attempt} is not an unknown liability"
                )))
            }
            None => return Err(Refusal::Unknown(format!("attempt {attempt}"))),
        }
        self.commit(Record::Settled {
            attempt: *attempt,
            usage: Usage::Known(actual),
            note: format!("reconciled: {why}"),
        })?;
        Ok(())
    }

    // ---- verification authority -----------------------------------------

    /// The verdict on a candidate, computed now from the journaled execution
    /// records under the policy now in force, and journaled.
    pub fn verify(&mut self, candidate: &Digest32) -> Result<Verdict, Refusal> {
        let v = self.verdict(candidate)?;
        if !self.state.verdicts.contains_key(&v.digest()) {
            self.commit(Record::VerdictRecorded(v.clone()))?;
        }
        Ok(v)
    }

    fn verdict(&self, candidate: &Digest32) -> Result<Verdict, Refusal> {
        let (pd, policy) = self.policy_now()?;
        let c = self.candidate(candidate)?;
        let recs: Vec<&ExecRecord> = self.state.execs.iter().collect();
        Ok(judge(&policy, pd, Some(*candidate), c.artifact, &recs))
    }

    // ---- promotion authority --------------------------------------------

    /// Apply the policy to the evidence. Promote only when the candidate was
    /// admitted under the policy in force, against the implementation still in
    /// force, with no unresolved attempt, every required check PASS, and a
    /// bound canary PASS. A failed canary rolls back; anything else holds.
    pub fn decide(&mut self, candidate: &Digest32) -> Result<Decision, Refusal> {
        let (pd, policy) = self.policy_now()?;
        let c = self.candidate(candidate)?;
        let current = self.state.current().ok_or(Refusal::NoPolicy)?;
        let verdict = self.verify(candidate)?;
        let mut reasons = Vec::new();
        if c.policy != pd {
            reasons
                .push("admitted under a different policy: re-admit under the one in force".into());
        }
        if c.base != current {
            reasons.push("based on an implementation that is no longer in force".into());
        }
        let (mut known, mut unknown) = (0u64, 0u64);
        for a in self
            .state
            .attempts
            .values()
            .filter(|a| a.subject == Some(*candidate))
        {
            match a.settled {
                Some(Usage::Known(n)) => known = known.saturating_add(n),
                Some(Usage::Unknown) | None => unknown += 1,
            }
        }
        if unknown > 0 {
            reasons.push(format!(
                "{unknown} attempt(s) unresolved: evidence incomplete"
            ));
        }
        if verdict.overall() != Outcome::Pass {
            for cv in verdict.checks() {
                if cv.outcome() != Outcome::Pass {
                    reasons.push(format!(
                        "check {} is {} ({} unbound record(s) set aside)",
                        cv.id(),
                        cv.outcome().name(),
                        cv.unbound()
                    ));
                }
            }
        }
        // the canary, judged by the same binding rules
        let canary_recs: Vec<&ExecRecord> = self
            .state
            .execs
            .iter()
            .filter(|x| {
                x.subject == Some(*candidate)
                    && x.check == policy.canary.id
                    && x.command == policy.canary.command
                    && x.verifier_rev == policy.verifier_rev
                    && x.policy == pd
                    && x.artifact == c.artifact
            })
            .collect();
        let canary_outcome = canary_recs
            .iter()
            .map(|x| match &x.status {
                ExecStatus::Ran { code: 0 } => Outcome::Pass,
                ExecStatus::Ran { .. } => Outcome::Fail,
                ExecStatus::NotRun { .. } => Outcome::NotRun,
                _ => Outcome::Degraded,
            })
            .max();
        let canary = canary_recs.last().map(|x| x.attempt);
        let kind = if !reasons.is_empty() {
            DecisionKind::Hold
        } else {
            match canary_outcome {
                Some(Outcome::Pass) => DecisionKind::Promote,
                Some(Outcome::Fail) | Some(Outcome::Degraded) => {
                    reasons.push(format!(
                        "canary {}: the canary scope returns to the current implementation",
                        canary_outcome.unwrap().name()
                    ));
                    DecisionKind::RollBack
                }
                Some(Outcome::NotRun) | None => {
                    reasons.push("canary NOT_RUN".into());
                    DecisionKind::Hold
                }
            }
        };
        let d = Decision {
            candidate: *candidate,
            kind,
            reasons,
            policy: pd,
            baseline_rev: policy.baseline_rev.clone(),
            verifier_rev: policy.verifier_rev.clone(),
            artifact: c.artifact,
            replaces: current,
            verdict: verdict.digest(),
            canary,
            usage_known: known,
            usage_unknown_attempts: unknown,
            scope: match kind {
                DecisionKind::Promote => policy.deploy_scope.clone(),
                _ => policy.canary_scope.clone(),
            },
        };
        self.commit(Record::Decision(d.clone()))?;
        Ok(d)
    }

    // ---- failure-class register -----------------------------------------

    /// Open a class: the violated invariant and the observations that showed
    /// it. `note` is kept as what was said; no transition reads it.
    pub fn open_lesson(
        &mut self,
        invariant: &str,
        triggers: &[Digest32],
        note: &str,
    ) -> Result<Digest32, Refusal> {
        if triggers.is_empty() {
            return Err(Refusal::Lesson(
                "a class needs at least one triggering observation".into(),
            ));
        }
        for t in triggers {
            if !self.state.observations.contains_key(t) {
                return Err(Refusal::Lesson(format!(
                    "{t} is not a journaled observation"
                )));
            }
        }
        let class = class_id(invariant);
        if self.lesson(&class).is_some() {
            return Err(Refusal::Lesson("class already open".into()));
        }
        self.commit(Record::Lesson(LessonEvent::Opened {
            class,
            invariant: invariant.to_string(),
            triggers: triggers.to_vec(),
            note: note.to_string(),
        }))?;
        Ok(class)
    }

    fn bound_baseline_exec(&self, attempt: &Digest32) -> Result<(ExecRecord, Outcome), Refusal> {
        let (pd, policy) = self.policy_now()?;
        let x = self
            .state
            .execs
            .iter()
            .find(|x| x.attempt == *attempt)
            .cloned()
            .ok_or_else(|| Refusal::Lesson(format!("{attempt} is not a journaled execution")))?;
        if x.subject.is_some() {
            return Err(Refusal::Lesson(
                "not a run against the implementation in force".into(),
            ));
        }
        let spec = policy.check(&x.check).ok_or_else(|| {
            Refusal::Lesson(format!(
                "check {:?} is not required by the policy: the verifier does not hold it",
                x.check
            ))
        })?;
        if x.command != spec.command || x.verifier_rev != policy.verifier_rev || x.policy != pd {
            return Err(Refusal::Lesson(
                "execution is not bound to the policy in force".into(),
            ));
        }
        if Some(x.artifact) != self.state.current() {
            return Err(Refusal::Lesson(
                "execution ran on bytes no longer in force".into(),
            ));
        }
        let o = match x.status {
            ExecStatus::Ran { code: 0 } => Outcome::Pass,
            ExecStatus::Ran { .. } => Outcome::Fail,
            ExecStatus::NotRun { .. } => Outcome::NotRun,
            _ => Outcome::Degraded,
        };
        Ok((x, o))
    }

    /// A required check FAILED on the implementation in force: the class is
    /// reproduced, by the verifier's own test.
    pub fn reproduce(&mut self, class: &Digest32, attempt: &Digest32) -> Result<(), Refusal> {
        self.lesson(class)
            .ok_or_else(|| Refusal::Unknown(format!("class {class}")))?;
        let (x, o) = self.bound_baseline_exec(attempt)?;
        if o != Outcome::Fail {
            return Err(Refusal::Lesson(format!(
                "a reproduction must FAIL on the baseline; this run is {}",
                o.name()
            )));
        }
        self.commit(Record::Lesson(LessonEvent::Reproduced {
            class: *class,
            check: x.check,
            attempt: *attempt,
        }))?;
        Ok(())
    }

    /// Close a reproduced class on a PROMOTE decision whose verdict has the
    /// reproducing check PASS.
    pub fn record_repair(&mut self, class: &Digest32, decision: &Digest32) -> Result<(), Refusal> {
        let l = self
            .lesson(class)
            .cloned()
            .ok_or_else(|| Refusal::Unknown(format!("class {class}")))?;
        let check = match (l.state, &l.check) {
            (LessonState::Reproduced | LessonState::Recurred, Some(c)) => c.clone(),
            _ => {
                return Err(Refusal::Lesson(
                    "a repair needs a reproduction held by the verifier first".into(),
                ))
            }
        };
        let d = self
            .state
            .decisions
            .iter()
            .find(|d| d.digest() == *decision)
            .cloned()
            .ok_or_else(|| Refusal::Unknown(format!("decision {decision}")))?;
        if d.kind != DecisionKind::Promote {
            return Err(Refusal::Lesson(format!(
                "decision is {}, not PROMOTE",
                d.kind.name()
            )));
        }
        // a repair judged under an older policy (an older, weaker verifier)
        // cannot close what the policy in force reproduced, and one decision
        // repairs a class once
        if Some(d.policy) != self.policy_digest() {
            return Err(Refusal::Lesson(
                "the decision was judged under a policy no longer in force".into(),
            ));
        }
        if l.repairs.contains(decision) {
            return Err(Refusal::Lesson(
                "this decision already repaired the class".into(),
            ));
        }
        let v = self
            .state
            .verdicts
            .get(&d.verdict)
            .ok_or_else(|| Refusal::Lesson("the decision's verdict is not journaled".into()))?;
        match v.check(&check) {
            Some(cv) if cv.outcome() == Outcome::Pass => {}
            _ => {
                return Err(Refusal::Lesson(format!(
                    "the promoted verdict does not hold {check:?} PASS"
                )))
            }
        }
        self.commit(Record::Lesson(LessonEvent::Repaired {
            class: *class,
            decision: *decision,
        }))?;
        Ok(())
    }

    /// Record a recurrence check: the reproducing check, run again on the
    /// implementation in force. FAIL reopens the class.
    pub fn recurrence(&mut self, class: &Digest32, attempt: &Digest32) -> Result<Outcome, Refusal> {
        let l = self
            .lesson(class)
            .cloned()
            .ok_or_else(|| Refusal::Unknown(format!("class {class}")))?;
        let (x, o) = self.bound_baseline_exec(attempt)?;
        if l.check.as_deref() != Some(x.check.as_str()) {
            return Err(Refusal::Lesson("not the class's reproducing check".into()));
        }
        self.commit(Record::Lesson(LessonEvent::RecurrenceChecked {
            class: *class,
            attempt: *attempt,
            outcome: o,
        }))?;
        Ok(o)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::attest::{RoleKey, SigAlg};

    /// The branch only a crash between the execution record and its
    /// settlement leaves: the record's own measured usage settles it.
    #[test]
    fn executed_but_unsettled_settles_from_its_record() {
        let dir = std::env::temp_dir().join(format!(
            "bnrose-evolve-unit-{}-{}",
            std::process::id(),
            line!()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        let trust = || {
            TrustRoot::new(vec![RoleKey {
                role: Role::Sovereign,
                key_id: "s".into(),
                alg: SigAlg::MlDsa65,
                verifying_key: vec![1; 1952],
            }])
            .unwrap()
        };
        drop(Controller::open(&dir, "sqlite", trust()).unwrap());
        let id = hash("t", &[b"executed"]);
        {
            let store = adapter_store::open_named("sqlite", &dir.join("store")).unwrap();
            let (mut j, _) = Journal::open(store).unwrap();
            for r in [
                Record::Reserved {
                    attempt: id,
                    subject: None,
                    check: "restart".into(),
                    amount: 900,
                },
                Record::Dispatched { attempt: id },
                Record::Spawned {
                    attempt: id,
                    pid: 7,
                },
                Record::WorkerExited {
                    attempt: id,
                    code: Some(0),
                    killed: false,
                },
                Record::Executed(ExecRecord {
                    attempt: id,
                    subject: None,
                    check: "restart".into(),
                    command: Digest32::ZERO,
                    verifier_rev: "v".into(),
                    policy: Digest32::ZERO,
                    artifact: Digest32::ZERO,
                    scope: "verify".into(),
                    status: ExecStatus::Ran { code: 0 },
                    stdout: Digest32::ZERO,
                    stderr: Digest32::ZERO,
                    elapsed: 37,
                }),
            ] {
                j.append(&r).unwrap();
            }
        }
        let (c, rep) = Controller::open(&dir, "sqlite", trust()).unwrap();
        assert_eq!(rep.settled_from_evidence, vec![id]);
        assert!(rep.unresolved.is_empty());
        assert_eq!(c.exposure(), 37);
        drop(c);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
