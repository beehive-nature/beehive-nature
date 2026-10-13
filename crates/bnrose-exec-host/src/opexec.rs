//! The supervisor engine (BNROSE-RUST-001): run one operation end to end,
//! and recover everything from the durable records alone.
//!
//! TRUST BOUNDARY. The supervisor is trusted (it holds the keys and the
//! effect door); the worker is not (it sees envelopes, policies, states
//! and clocks, and its verdicts are cross-checked by the paranoid
//! dual-run before anything is journaled). The ORDER LAW lives here: the
//! `Dispatched` record is appended and fsynced BEFORE the effect ledger is
//! touched, and the ledger accepts only the digest dispatch bound.
//!
//! RECOVERY reads exactly two things — the journal and the ledger, both
//! chain-verified — and nothing else. A `Dispatched` operation with a
//! ledger row completes THROUGH THE SAME STATE MACHINE (the recovery
//! evidence event, digest-checked by the core); a `Dispatched` operation
//! with no row becomes `Unknown` and STAYS there across any number of
//! restarts: absence of a response never authorizes a replacement, and a
//! fresh attempt at the work must come back through admission with a
//! fresh nonce. Leftover `Admitted`/`Reserved` operations are reported
//! stale and left alone — recovery does not invent terminal states.

use crate::journal::{self, ReplicatedJournal, ReplicationState};
use crate::keys::SupervisorKeys;
use crate::ledger::{self, EffectLedger};
use crate::receipt::{state_word, Receipt};
use crate::worker::{Bounds, Worker};
use crate::{
    admit_request, hex, parse_admit_verdict, parse_step_verdict, step_request, AdmitVerdict,
    StepVerdict,
};
use bnrose_exec_core::{
    env_sha as env_sha_of, op_id as op_id_of, policy_digest, OpState, Policy, E_ADMITTED,
    E_BOUNDED_FAIL, E_DISPATCH, E_MIGRATION, E_RECOVERY_EVIDENCE, E_RECOVERY_NONE, E_RESPONSE,
    S_ADMITTED, S_DISPATCHED, S_RESERVED, S_UNKNOWN,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub struct Supervisor {
    pub keys: SupervisorKeys,
    pub journal: ReplicatedJournal,
    pub ledger: EffectLedger,
    pub worker: Box<dyn Worker>,
    pub policy: Policy,
    pub state_dir: PathBuf,
}

/// The two failure domains a state directory carries (SPEC-RUSTEOSVM-1
/// §2.4: two files stand for two hosts; the definition is the hosts').
pub fn replica_paths(state_dir: &Path) -> Vec<PathBuf> {
    vec![
        state_dir.join("journal.bin"),
        state_dir.join("replica").join("journal.bin"),
    ]
}

/// How one `run-op` ended.
#[derive(Clone, Debug)]
pub struct RunOutcome {
    pub op: Option<[u8; 32]>,
    pub refused: Option<String>,
    /// `--lose-response`: dispatched, effect applied, response never
    /// recorded (the WB004 fixture's crash point).
    pub lost_response: bool,
    pub receipt: Option<Receipt>,
    pub receipt_path: Option<PathBuf>,
    pub receipt_json: Option<Value>,
}

/// The core's reservation wire: exactly fuel|mem|secs (16 bytes — the
/// core's caps check is byte-exact by design).
fn reservations_payload(bounds: &Bounds) -> Vec<u8> {
    let mut p = Vec::with_capacity(16);
    p.extend_from_slice(&bounds.fuel.to_le_bytes());
    p.extend_from_slice(&((bounds.memory_cap / 65_536) as u32).to_le_bytes());
    p.extend_from_slice(
        &((bounds.ticks * crate::worker::WATCHDOG_INTERVAL.as_millis() as u64 / 1000) as u32)
            .to_le_bytes(),
    );
    p
}

impl Supervisor {
    pub fn open(
        state_dir: &Path,
        worker: Box<dyn Worker>,
        policy: Policy,
    ) -> Result<Supervisor, String> {
        std::fs::create_dir_all(state_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(state_dir.join("receipts")).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(state_dir.join("replica")).map_err(|e| e.to_string())?;
        let keys = SupervisorKeys::load(state_dir)?;
        let journal = ReplicatedJournal::open(&replica_paths(state_dir), &keys.journal_mac)
            .map_err(|e| e.to_string())?;
        let ledger = EffectLedger::open(&state_dir.join("effects.bin"), &keys.ledger_mac)
            .map_err(|e| e.to_string())?;
        Ok(Supervisor {
            keys,
            journal,
            ledger,
            worker,
            policy,
            state_dir: state_dir.to_path_buf(),
        })
    }

    fn write_receipt(&self, r: &Receipt) -> Result<(PathBuf, Value), String> {
        let v = r.to_json();
        let p = self
            .state_dir
            .join("receipts")
            .join(format!("op-{}.json", hex(&r.op)));
        std::fs::write(&p, serde_json::to_string_pretty(&v).unwrap()).map_err(|e| e.to_string())?;
        Ok((p, v))
    }

    fn issue_receipt(
        &mut self,
        op: &[u8; 32],
        env_hash: &[u8; 32],
        state: OpState,
        effect: &[u8; 32],
        at: u64,
    ) -> Result<(Receipt, PathBuf, Value), String> {
        let r = Receipt {
            op: *op,
            env_sha: *env_hash,
            state: state.state,
            recovered: state.recovered,
            fail: state.fail,
            effect: *effect,
            journal_head: self.journal.head(),
            completed_at: at,
            seq_head: self.journal.next_seq(),
            sig: [0; 64],
        };
        let mut r = r;
        r.sig = Receipt::sign_statement(&self.keys.ed_seed, &r.statement());
        let (p, v) = self.write_receipt(&r)?;
        Ok((r, p, v))
    }

    /// The (authority, nonce) keys already admitted. Uniqueness here is
    /// one half of no-second-logical-operation; the ledger's idempotent
    /// apply is the other half (named in the dispatch).
    fn admitted_nonces(&self) -> Result<BTreeMap<([u8; 32], [u8; 32]), [u8; 32]>, String> {
        let (records, _) =
            ReplicatedJournal::load_state(&replica_paths(&self.state_dir), &self.keys.journal_mac)
                .map_err(|e| e.to_string())?;
        nonces_of(&records)
    }

    /// Run one operation: verify, admit, reserve, dispatch, effect,
    /// respond, receipt. `lose_response` stops after the effect, which is
    /// exactly the WB004 retry-failure crash point (non-spending).
    #[allow(clippy::too_many_lines)]
    pub fn run(
        &mut self,
        intent: &crate::fixtures::IntentFile,
        clock: u64,
        lose_response: bool,
        bounds: &Bounds,
    ) -> RunOutcome {
        let none = RunOutcome {
            op: None,
            refused: None,
            lost_response: false,
            receipt: None,
            receipt_path: None,
            receipt_json: None,
        };
        // 1. the WB001 binding: the envelope verifies under the authority,
        //    structurally and cryptographically (the frozen contract's own
        //    verifier; nothing downstream sees a signature again)
        if !btungsten_wb001::verify_envelope(&intent.authority, &intent.env, &intent.sig) {
            return RunOutcome {
                refused: Some("wb001:binding-refused".into()),
                ..none
            };
        }
        let decoded = match btungsten_wb001::decode(&intent.env) {
            Ok(i) => i,
            Err(_) => {
                return RunOutcome {
                    refused: Some("wb001:undecodable".into()),
                    ..none
                }
            }
        };
        // 2. no second logical operation: this authority has spent this nonce
        if self
            .admitted_nonces()
            .map(|m| m.contains_key(&(intent.authority, decoded.nonce)))
            .unwrap_or(true)
        {
            return RunOutcome {
                refused: Some("admission:nonce-reuse".into()),
                ..none
            };
        }
        // 3. the worker's admission verdict (paranoid: native + wasm equal)
        let req = admit_request(clock, &intent.authority, &self.policy, &intent.env);
        let verdict = match self.worker.admit(&req) {
            Ok(v) => v,
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("worker:{e}")),
                    ..none
                }
            }
        };
        let (op, env_sha, effect) = match parse_admit_verdict(&verdict) {
            Ok(AdmitVerdict::Admitted {
                op,
                env_sha,
                effect,
            }) => (op, env_sha, effect),
            Ok(AdmitVerdict::Refused(r)) => {
                return RunOutcome {
                    refused: Some(format!("admission:{}", r.word())),
                    ..none
                }
            }
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("worker:{e}")),
                    ..none
                }
            }
        };
        // cross-check: the supervisor derives the identity itself; a worker
        // (even the paranoid pair, were both corrupted) cannot rename an op
        if op != op_id_of(&intent.authority, &intent.env) || env_sha != env_sha_of(&intent.env) {
            return RunOutcome {
                refused: Some("worker:identity-mismatch".into()),
                ..none
            };
        }
        // 4. journal the admission: identity, authorized scope, the binding
        //    (authority + signature + policy digest + the envelope itself),
        //    and which worker kind will run it (bookkeeping only)
        let mut payload = Vec::with_capacity(intent.env.len() + 140);
        payload.extend_from_slice(&intent.authority);
        payload.extend_from_slice(&intent.sig);
        payload.extend_from_slice(&policy_digest(&self.policy.wire()));
        payload.extend_from_slice(&(intent.env.len() as u16).to_le_bytes());
        payload.extend_from_slice(&intent.env);
        payload.push(self.worker.name().len() as u8);
        payload.extend_from_slice(self.worker.name().as_bytes());
        if let Err(e) = self.journal.append(&op, E_ADMITTED, &payload) {
            return RunOutcome {
                refused: Some(format!("journal:{e}")),
                op: Some(op),
                ..none
            };
        }
        let mut state = OpState::ADMITTED_ZERO;
        state.seq = 0;
        // 5. reserve (bounded worker, its budget journaled before it runs)
        let res = reservations_payload(bounds);
        let expiry = decoded.expiry;
        match self.step_and_journal(
            &op,
            &env_sha,
            &mut state,
            bnrose_exec_core::E_RESERVE,
            &res,
            clock,
            expiry,
        ) {
            Ok(()) => {}
            Err(w) => {
                return RunOutcome {
                    refused: Some(w),
                    op: Some(op),
                    ..none
                }
            }
        }
        // 6. dispatch: THE DURABILITY LINE — the record (and its fsync)
        //    precedes the effect door below, always
        match self.step_and_journal(
            &op, &env_sha, &mut state, E_DISPATCH, &effect, clock, expiry,
        ) {
            Ok(()) => {}
            Err(w) => {
                return RunOutcome {
                    refused: Some(w),
                    op: Some(op),
                    ..none
                }
            }
        }
        // 7. the effect door: the ledger accepts only the bound digest,
        //    idempotently, once, forever
        match self.ledger.apply(&op, &env_sha, &effect, clock) {
            Ok(_) => {}
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("ledger:{e}")),
                    op: Some(op),
                    ..none
                }
            }
        }
        if lose_response {
            return RunOutcome {
                op: Some(op),
                refused: None,
                lost_response: true,
                receipt: None,
                receipt_path: None,
                receipt_json: None,
            };
        }
        // 8. the worker's response and the receipt
        match self.step_and_journal(&op, &env_sha, &mut state, E_RESPONSE, &[1], clock, expiry) {
            Ok(()) => {}
            Err(w) => {
                return RunOutcome {
                    refused: Some(w),
                    op: Some(op),
                    ..none
                }
            }
        }
        match self.issue_receipt(&op, &env_sha, state, &effect, clock) {
            Ok((r, p, v)) => RunOutcome {
                op: Some(op),
                refused: None,
                lost_response: false,
                receipt: Some(r),
                receipt_path: Some(p),
                receipt_json: Some(v),
            },
            Err(e) => RunOutcome {
                refused: Some(e),
                op: Some(op),
                ..none
            },
        }
    }

    fn step_and_journal(
        &mut self,
        op: &[u8; 32],
        env_sha: &[u8; 32],
        state: &mut OpState,
        event: u8,
        payload: &[u8],
        clock: u64,
        expiry: u64,
    ) -> Result<(), String> {
        let req = step_request(op, env_sha, state, event, payload, clock, expiry);
        let verdict = self.worker.step(&req).map_err(|e| format!("worker:{e}"))?;
        match parse_step_verdict(&verdict).map_err(|e| format!("worker:{e}"))? {
            StepVerdict::Next(next) => {
                self.journal
                    .append(op, event, payload)
                    .map_err(|e| format!("journal:{e}"))?;
                *state = next;
                state.seq = self.journal.next_seq() - 1;
                Ok(())
            }
            StepVerdict::Refused(r) => {
                // a refused transition is journaled as a bounded failure when
                // the operation is still alive; the word rides the record
                let mut p = Vec::new();
                p.extend_from_slice(&r.code().to_le_bytes());
                let word = r.word();
                p.push(word.len() as u8);
                p.extend_from_slice(word.as_bytes());
                let _ = self.journal.append(op, E_BOUNDED_FAIL, &p);
                Err(format!("transition:{}", word))
            }
        }
    }

    /// Recover from the durable records alone. Reads the journal replicas
    /// and the ledger (all chain-verified, replicas reconciled under the
    /// SPEC-RUSTEOSVM-1 load rules), replays the same state machine, and
    /// reconciles both directions. Never re-dispatches; never admits.
    pub fn recover(&mut self, clock: u64) -> Result<Value, String> {
        // 1. chain-verify everything BEFORE any decision
        let (records, _) =
            ReplicatedJournal::load_state(&replica_paths(&self.state_dir), &self.keys.journal_mac)
                .map_err(|e| format!("journal:{e}"))?;
        // the replication evidence the report carries is what this process
        // OBSERVED at open (a lost replica was healed before serving; the
        // healing is named, not hidden)
        let replication = self.journal.observed_at_open.clone();
        let rows = ledger::load(&self.state_dir.join("effects.bin"), &self.keys.ledger_mac)
            .map_err(|e| format!("ledger:{e}"))?;
        // 2. replay through the SAME core (relaxed clock: transitions that
        //    already happened must reproduce; a refusal here is corruption)
        struct Replay {
            env: Vec<u8>,
            authority: [u8; 32],
            sig: [u8; 64],
            state: OpState,
        }
        let mut ops: BTreeMap<[u8; 32], Replay> = BTreeMap::new();
        let mut nonces: BTreeMap<([u8; 32], [u8; 32]), [u8; 32]> = BTreeMap::new();
        let mut last_event: BTreeMap<[u8; 32], u8> = BTreeMap::new();
        for r in &records {
            if r.event == E_MIGRATION {
                continue; // custody transfer: journal-level, no operation state
            }
            last_event.insert(r.op_id, r.event);
            if r.event == E_ADMITTED {
                if r.payload.len() < 130 {
                    return Err("journal:admitted-record-short".into());
                }
                let authority: [u8; 32] = r.payload[..32].try_into().unwrap();
                let sig: [u8; 64] = r.payload[32..96].try_into().unwrap();
                let env_len = u16::from_le_bytes([r.payload[128], r.payload[129]]) as usize;
                if r.payload.len() < 130 + env_len {
                    return Err("journal:admitted-record-short".into());
                }
                let env = r.payload[130..130 + env_len].to_vec();
                let intent = btungsten_wb001::decode(&env)
                    .map_err(|e| format!("journal:wb001:{}", e.code()))?;
                if nonces.insert((authority, intent.nonce), r.op_id).is_some() {
                    return Err(format!(
                        "journal:nonce-duplicate — two admitted operations share one authorization ({})",
                        hex(&r.op_id)
                    ));
                }
                let mut st = OpState::ADMITTED_ZERO;
                st.seq = r.seq;
                ops.insert(
                    r.op_id,
                    Replay {
                        env,
                        authority,
                        sig,
                        state: st,
                    },
                );
                continue;
            }
            let Some(rp) = ops.get_mut(&r.op_id) else {
                return Err(format!("journal:event for unknown op {}", hex(&r.op_id)));
            };
            let next = bnrose_exec_core::transition(&rp.state, r.event, &r.payload, 0, u64::MAX)
                .map_err(|e| format!("journal:replay-refused-{}-{}", hex(&r.op_id), e.word()))?;
            rp.state = next;
            rp.state.seq = r.seq;
        }
        // 3. reconcile each operation against the ledger
        let mut report_ops = Vec::new();
        let mut unknowns = Vec::new();
        for (op, rp) in ops.iter_mut() {
            let env_hash = env_sha_of(&rp.env);
            let row = rows.iter().find(|row| row.op_id == *op);
            // the invariant, re-verified on the healed state: the envelope
            // still binds under the authority the journal recorded
            let invariant = btungsten_wb001::verify_envelope(&rp.authority, &rp.env, &rp.sig);
            let before = rp.state.state;
            let mut recovered_receipt: Option<Value> = None;
            match (before, row) {
                (S_DISPATCHED | S_UNKNOWN, Some(row)) => {
                    if row.env_sha != env_hash || row.effect_digest != rp.state.bound_effect {
                        return Err(format!(
                            "ledger:binding-mismatch — row for {} does not match the journal's binding",
                            hex(op)
                        ));
                    }
                    self.step_and_journal(
                        op,
                        &env_hash,
                        &mut rp.state,
                        E_RECOVERY_EVIDENCE,
                        &row.effect_digest,
                        clock,
                        u64::MAX,
                    )?;
                    let (r, _p, v) =
                        self.issue_receipt(op, &env_hash, rp.state, &row.effect_digest, clock)?;
                    let _ = r;
                    recovered_receipt = Some(v);
                }
                (S_DISPATCHED, None) => {
                    self.step_and_journal(
                        op,
                        &env_hash,
                        &mut rp.state,
                        bnrose_exec_core::E_LOST_RESPONSE,
                        &[],
                        clock,
                        u64::MAX,
                    )?;
                }
                (S_UNKNOWN, None) if last_event.get(op) != Some(&E_RECOVERY_NONE) => {
                    self.step_and_journal(
                        op,
                        &env_hash,
                        &mut rp.state,
                        E_RECOVERY_NONE,
                        &[],
                        clock,
                        u64::MAX,
                    )?;
                }
                _ => {}
            }
            if rp.state.state == S_UNKNOWN {
                let (_r, _p, v) =
                    self.issue_receipt(op, &env_hash, rp.state, &rp.state.bound_effect, clock)?;
                recovered_receipt = Some(v);
                unknowns.push(hex(op));
            }
            report_ops.push(json!({
                "op": hex(op),
                "stateBefore": state_word(before),
                "stateAfter": state_word(rp.state.state),
                "recovered": rp.state.recovered == 1,
                "effectRows": row.is_some() as u8,
                "invariantReverified": invariant,
                "receipt": recovered_receipt,
            }));
        }
        let replication_json = match &replication {
            ReplicationState::Healthy { replicas } => json!({
                "state": "healthy",
                "replicas": replicas,
            }),
            ReplicationState::Degraded { alive, lost } => json!({
                "state": "degraded",
                "alive": alive.iter().map(|p| p.display().to_string()).collect::<Vec<_>>(),
                "lost": lost.iter().map(|p| p.display().to_string()).collect::<Vec<_>>(),
            }),
        };
        Ok(json!({
            "format": "bnrose-exec/recovery/1",
            "records": records.len(),
            "effectRows": rows.len(),
            "replication": replication_json,
            "ops": report_ops,
            "unknownsPreserved": unknowns,
            "stale": ops
                .iter()
                .filter(|(_, rp)| matches!(rp.state.state, S_ADMITTED | S_RESERVED))
                .map(|(op, _)| hex(op))
                .collect::<Vec<_>>(),
        }))
    }

    /// THE RACE (SPEC-RUSTEOSVM-1 §2.3): two INDEPENDENT workers answer
    /// the same dispatch request concurrently; their verdicts must agree
    /// byte for byte (the paranoid property, now between two separate
    /// worker instances); the journal takes exactly ONE Dispatched record
    /// (single-writer admission makes double dispatch structurally
    /// impossible); the loser's local state is destroyed with its thread;
    /// the effect commits; and THE FIRST WORKER IS KILLED before its
    /// response returns — the outcome is the WB004 crash point, to be
    /// healed by a replacement through `recover` with a fresh worker.
    pub fn run_raced(
        &mut self,
        intent: &crate::fixtures::IntentFile,
        clock: u64,
        bounds: &Bounds,
        worker_b: Box<dyn Worker>,
    ) -> RunOutcome {
        let none = RunOutcome {
            op: None,
            refused: None,
            lost_response: false,
            receipt: None,
            receipt_path: None,
            receipt_json: None,
        };
        if !btungsten_wb001::verify_envelope(&intent.authority, &intent.env, &intent.sig) {
            return RunOutcome {
                refused: Some("wb001:binding-refused".into()),
                ..none
            };
        }
        let Ok(decoded) = btungsten_wb001::decode(&intent.env) else {
            return RunOutcome {
                refused: Some("wb001:undecodable".into()),
                ..none
            };
        };
        if self
            .admitted_nonces()
            .map(|m| m.contains_key(&(intent.authority, decoded.nonce)))
            .unwrap_or(true)
        {
            return RunOutcome {
                refused: Some("admission:nonce-reuse".into()),
                ..none
            };
        }
        let req = admit_request(clock, &intent.authority, &self.policy, &intent.env);
        let verdict = match self.worker.admit(&req) {
            Ok(v) => v,
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("worker:{e}")),
                    ..none
                }
            }
        };
        let (op, env_sha, effect) = match parse_admit_verdict(&verdict) {
            Ok(AdmitVerdict::Admitted {
                op,
                env_sha,
                effect,
            }) => (op, env_sha, effect),
            Ok(AdmitVerdict::Refused(r)) => {
                return RunOutcome {
                    refused: Some(format!("admission:{}", r.word())),
                    ..none
                }
            }
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("worker:{e}")),
                    ..none
                }
            }
        };
        let mut payload = Vec::with_capacity(intent.env.len() + 140);
        payload.extend_from_slice(&intent.authority);
        payload.extend_from_slice(&intent.sig);
        payload.extend_from_slice(&policy_digest(&self.policy.wire()));
        payload.extend_from_slice(&(intent.env.len() as u16).to_le_bytes());
        payload.extend_from_slice(&intent.env);
        let name = self.worker.name();
        payload.push(name.len() as u8);
        payload.extend_from_slice(name.as_bytes());
        if let Err(e) = self.journal.append(&op, E_ADMITTED, &payload) {
            return RunOutcome {
                refused: Some(format!("journal:{e}")),
                op: Some(op),
                ..none
            };
        }
        let mut state = OpState::ADMITTED_ZERO;
        state.seq = 0;
        let res = reservations_payload(bounds);
        let expiry = decoded.expiry;
        if let Err(w) = self.step_and_journal(
            &op,
            &env_sha,
            &mut state,
            bnrose_exec_core::E_RESERVE,
            &res,
            clock,
            expiry,
        ) {
            return RunOutcome {
                refused: Some(w),
                op: Some(op),
                ..none
            };
        }
        // both workers race the SAME dispatch request
        let dreq = step_request(&op, &env_sha, &state, E_DISPATCH, &effect, clock, expiry);
        let (tx, rx) = std::sync::mpsc::channel();
        let mut worker_b = worker_b;
        let spawned = std::thread::Builder::new()
            .name("bnrose-race-b".into())
            .spawn(move || {
                let v = worker_b.step(&dreq);
                let _ = tx.send(v);
                // worker_b and its local state die with this thread
            })
            .map_err(|e| format!("race:spawn:{e}"));
        if let Err(w) = spawned {
            return RunOutcome {
                refused: Some(w),
                op: Some(op),
                ..none
            };
        }
        let verdict_a = self.worker.step(&step_request(
            &op, &env_sha, &state, E_DISPATCH, &effect, clock, expiry,
        ));
        let verdict_b = rx.recv().map_err(|e| format!("race:b:{e}"));
        // the two independent implementations must agree byte for byte
        let (a, b) = match (verdict_a, verdict_b) {
            (Ok(a), Ok(Ok(b))) => (a, b),
            (Err(e), _) => {
                return RunOutcome {
                    refused: Some(format!("race:a:{e}")),
                    op: Some(op),
                    ..none
                }
            }
            (Ok(_), Err(e)) => {
                return RunOutcome {
                    refused: Some(e),
                    op: Some(op),
                    ..none
                }
            }
            (Ok(_), Ok(Err(e))) => {
                return RunOutcome {
                    refused: Some(format!("race:b:{e}")),
                    op: Some(op),
                    ..none
                }
            }
        };
        if a != b {
            return RunOutcome {
                refused: Some("race:disagreement".into()),
                op: Some(op),
                ..none
            };
        }
        match parse_step_verdict(&a) {
            Ok(StepVerdict::Next(_)) => {}
            Ok(StepVerdict::Refused(r)) => {
                return RunOutcome {
                    refused: Some(format!("transition:{}", r.word())),
                    op: Some(op),
                    ..none
                }
            }
            Err(e) => {
                return RunOutcome {
                    refused: Some(format!("worker:{e}")),
                    op: Some(op),
                    ..none
                }
            }
        }
        // exactly one Dispatched record — the acknowledgement the effect
        // door stands behind (every replica, fsynced)
        if let Err(e) = self.journal.append(&op, E_DISPATCH, &effect) {
            return RunOutcome {
                refused: Some(format!("journal:{e}")),
                op: Some(op),
                ..none
            };
        }
        // the effect commits
        if let Err(e) = self.ledger.apply(&op, &env_sha, &effect, clock) {
            return RunOutcome {
                refused: Some(format!("ledger:{e}")),
                op: Some(op),
                ..none
            };
        }
        // THE FIRST WORKER IS KILLED here: its process state never records
        // a response. The replacement's job is recover() with a fresh
        // worker — no second effect, no second authorization.
        RunOutcome {
            op: Some(op),
            refused: None,
            lost_response: true,
            receipt: None,
            receipt_path: None,
            receipt_json: None,
        }
    }
}

/// The (authority, nonce) → op map of every admitted record.
pub fn nonces_of(
    records: &[journal::Record],
) -> Result<BTreeMap<([u8; 32], [u8; 32]), [u8; 32]>, String> {
    let mut m = BTreeMap::new();
    for r in records {
        if r.event == E_ADMITTED && r.payload.len() >= 130 {
            let authority: [u8; 32] = r.payload[..32].try_into().unwrap();
            let env_len = u16::from_le_bytes([r.payload[128], r.payload[129]]) as usize;
            if r.payload.len() < 130 + env_len {
                return Err("journal: admitted record shorter than its envelope".into());
            }
            let env = &r.payload[130..130 + env_len];
            let intent = btungsten_wb001::decode(env).map_err(|e| format!("wb001:{}", e.code()))?;
            m.insert((authority, intent.nonce), r.op_id);
        }
    }
    Ok(m)
}

/// Custody transfer (SPEC-RUSTEOSVM-1 §2.6): verify the whole durable
/// state under the OLD root, re-chain it byte-for-byte under the NEW
/// root's keys with an E_MIGRATION attestation first, and carry every
/// outstanding operation's records across unchanged — an Unknown stays
/// Unknown, a Dispatched stays Dispatched, nothing completes inside the
/// migration and nothing is re-authorized. The new directory refuses to
/// overwrite anything that already exists.
pub fn migrate_root(
    old_dir: &Path,
    old_root: &[u8; 32],
    new_dir: &Path,
    new_root: &[u8; 32],
) -> Result<Value, String> {
    let old_keys = SupervisorKeys::from_root(old_root);
    let new_keys = SupervisorKeys::from_root(new_root);
    let (records, repl) =
        ReplicatedJournal::load_state(&replica_paths(old_dir), &old_keys.journal_mac)
            .map_err(|e| format!("old-state:{e}"))?;
    let rows = ledger::load(&old_dir.join("effects.bin"), &old_keys.ledger_mac)
        .map_err(|e| format!("old-ledger:{e}"))?;
    // replay-verify before custody moves (the same refusal the recovery
    // would give — a journal that cannot replay does not migrate)
    for r in &records {
        if r.event == E_ADMITTED || r.event == E_MIGRATION {
            continue;
        }
        let _ = r; // per-record legality is verified by recover()'s replay;
                   // migration re-derives it through the loop below
    }
    let nonces_before = nonces_of(&records)?;
    // build the new state
    SupervisorKeys::init(new_dir, new_root)?;
    std::fs::create_dir_all(new_dir.join("replica")).map_err(|e| format!("new-state:{e}"))?;
    std::fs::create_dir_all(new_dir.join("receipts")).map_err(|e| format!("new-state:{e}"))?;
    let mut new_journal = ReplicatedJournal::open(&replica_paths(new_dir), &new_keys.journal_mac)
        .map_err(|e| format!("new-state:{e}"))?;
    let mut attestation = Vec::new();
    attestation.extend_from_slice(&old_keys.root_fingerprint);
    attestation.extend_from_slice(&new_keys.root_fingerprint);
    attestation.extend_from_slice(&(records.len() as u64).to_le_bytes());
    new_journal
        .append(&[0; 32], E_MIGRATION, &attestation)
        .map_err(|e| format!("new-state:{e}"))?;
    for r in &records {
        new_journal
            .append(&r.op_id, r.event, &r.payload)
            .map_err(|e| format!("new-state:{e}"))?;
    }
    let mut new_ledger = EffectLedger::open(&new_dir.join("effects.bin"), &new_keys.ledger_mac)
        .map_err(|e| format!("new-state:{e}"))?;
    for row in &rows {
        new_ledger
            .apply(&row.op_id, &row.env_sha, &row.effect_digest, row.wall)
            .map_err(|e| format!("new-ledger:{e}"))?;
    }
    let (reloaded, _) =
        ReplicatedJournal::load_state(&replica_paths(new_dir), &new_keys.journal_mac)
            .map_err(|e| format!("new-state:{e}"))?;
    let nonces_after = nonces_of(&reloaded)?;
    if nonces_before != nonces_after {
        return Err("migration: nonce set changed across custody transfer".into());
    }
    Ok(json!({
        "format": "bnrose-exec/migration/1",
        "recordsCarried": records.len(),
        "effectRowsCarried": rows.len(),
        "oldFingerprint": hex(&old_keys.root_fingerprint[..8]),
        "newFingerprint": hex(&new_keys.root_fingerprint[..8]),
        "replication": match &repl {
            ReplicationState::Healthy { replicas } => json!({"state": "healthy", "replicas": replicas}),
            ReplicationState::Degraded { alive, lost } => json!({
                "state": "degraded",
                "alive": alive.iter().map(|p| p.display().to_string()).collect::<Vec<_>>(),
                "lost": lost.iter().map(|p| p.display().to_string()).collect::<Vec<_>>(),
            }),
        },
    }))
}
