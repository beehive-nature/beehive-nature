//! BNROSE-NETPART-001 — the two-host partition harness with an
//! independent destination (founder order 2026-10-15; dispatch
//! `2026-10-15-bnrose-rust-002-milestone-ruled.md` names this
//! qualification).
//!
//! Three roles, three PROCESSES:
//!
//! - **Host A / Host B** — sovereign supervisors over their own state
//!   directories ([`bnrose_exec_host::opexec::Claim`] each), driving one
//!   operation's state machine with the merged core. Their part is LOCAL
//!   SAFETY: one signed attempt, durable acknowledgement before anything
//!   leaves, UNKNOWN preserved under uncertainty.
//! - **The destination** ([`dest`]) — an independent settlement endpoint
//!   in its own process. It owns what only a destination can own:
//!   idempotent acceptance per transaction id, and the states
//!   `pending → included → final` (block production is its `advance`
//!   admin command). Hosts OBSERVE these states; they never infer them.
//! - **The fault injector** — part of the destination: per-client
//!   `drop | delay(ms) | partition`, so delayed requests and lost
//!   acknowledgements are reproducible, not simulated in-process.
//!
//! THE GOVERNING RULE, made executable here: local exclusion protects a
//! process; destination idempotency protects an effect; consensus and
//! finality are established independently — the destination's `final`
//! is an observation the hosts record, never a conclusion they draw.
//!
//! THE LAW from the milestone ruling, enforced in the driver: a
//! transmitted request with no conclusive outcome is UNKNOWN (client
//! timeout ⇒ UNKNOWN, never never-executed); a duplicate response is a
//! reconciliation OBSERVATION, never a promotion to success.

pub mod dest;

use bnrose_exec_host::opexec::{replica_paths, Claim};
use bnrose_exec_host::worker::{Bounds, NativeWorker, Worker};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// What the destination said about a submission.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SubmitOutcome {
    /// the destination durably accepted the transaction (now pending)
    Acked,
    /// the destination already holds this transaction id — a
    /// reconciliation OBSERVATION, not a success claim
    Duplicate,
    /// same transaction id, DIFFERENT bytes: refused loudly
    Conflict,
    /// the destination could NOT prove durability: no acknowledgement
    StorageError,
    /// no conclusive outcome within the client window: UNKNOWN
    Timeout,
}

/// The destination's own states — inclusion, execution, and finality are
/// ITS facts, observed not inferred.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DestState {
    UnknownToDest,
    Pending,
    Included,
    Final,
}

impl DestState {
    pub fn word(self) -> &'static str {
        match self {
            DestState::UnknownToDest => "unknown-to-dest",
            DestState::Pending => "pending",
            DestState::Included => "included",
            DestState::Final => "final",
        }
    }
}

/// A client's view of one destination (label = which host we are; the
/// fault injector keys on it).
pub struct DestClient {
    addr: std::net::SocketAddr,
    label: String,
    timeout: Duration,
}

impl DestClient {
    pub fn addr(&self) -> std::net::SocketAddr {
        self.addr
    }

    pub fn new(addr: std::net::SocketAddr, label: &str, timeout: Duration) -> DestClient {
        DestClient {
            addr,
            label: label.into(),
            timeout,
        }
    }

    fn roundtrip(&self, v: &Value) -> Option<Value> {
        let mut s = TcpStream::connect_timeout(&self.addr, self.timeout).ok()?;
        s.set_read_timeout(Some(self.timeout)).ok()?;
        s.set_write_timeout(Some(self.timeout)).ok()?;
        let mut line = serde_json::to_string(v).unwrap();
        line.push('\n');
        s.write_all(line.as_bytes()).ok()?;
        let mut reader = BufReader::new(s);
        let mut out = String::new();
        reader.read_line(&mut out).ok()?;
        serde_json::from_str(out.trim()).ok()
    }

    /// Submit exact bytes under a transaction id. The bytes are the ones
    /// the host durably recorded BEFORE submission (the persistence law).
    pub fn submit(&self, tx_id: &str, payload_hex: &str) -> SubmitOutcome {
        match self.roundtrip(&json!({
            "op": "submit", "label": self.label, "txId": tx_id, "payload": payload_hex,
        })) {
            None => SubmitOutcome::Timeout,
            Some(v) => match v["result"].as_str() {
                Some("acked") => SubmitOutcome::Acked,
                Some("duplicate") => SubmitOutcome::Duplicate,
                Some("conflict") => SubmitOutcome::Conflict,
                Some("storage-error") => SubmitOutcome::StorageError,
                _ => SubmitOutcome::Timeout,
            },
        }
    }

    /// Observe the destination's own state for a transaction id.
    pub fn observe(&self, tx_id: &str) -> Option<DestState> {
        let v = self.roundtrip(&json!({ "op": "observe", "label": self.label, "txId": tx_id }))?;
        let s = v["state"].as_str()?;
        Some(match s {
            "pending" => DestState::Pending,
            "included" => DestState::Included,
            "final" => DestState::Final,
            _ => DestState::UnknownToDest,
        })
    }

    /// Admin: block production (pending → included → final, n times).
    pub fn advance(&self, blocks: u64) -> Option<()> {
        self.roundtrip(&json!({ "op": "advance", "label": "admin", "blocks": blocks }))?;
        Some(())
    }

    /// Admin: set the fault mode for a client label.
    pub fn set_fault(&self, label: &str, mode: &str, arg_ms: u64) -> Option<()> {
        self.roundtrip(&json!({
            "op": "fault", "label": "admin", "for": label, "mode": mode, "argMs": arg_ms,
        }))?;
        Some(())
    }
}

/// One sovereign host: claim + replicated journal + the merged core's
/// transitions, with the destination as its effect boundary. The local
/// ledger is GONE from this seam by design — its row would blur the
/// destination's facts; observations are journaled as records instead.
pub struct Host {
    pub state_dir: PathBuf,
    pub claim: Claim,
    pub keys: bnrose_exec_host::keys::SupervisorKeys,
    dest: DestClient,
    worker: NativeWorker,
}

/// What one host run established — the initial-result distinction the
/// order demands, as data: local safety facts, destination observations,
/// and finality, SEPARATELY ATTRIBUTED.
#[derive(Clone, Debug)]
pub struct HostReport {
    pub op: [u8; 32],
    pub tx_id: String,
    pub submitted: bool,
    pub submission_outcome: &'static str,
    pub final_observation: Option<&'static str>,
    pub journal_records: usize,
    pub signatures_journaled: usize,
    pub records_before: usize,
}

impl Host {
    /// The env of the journal's FIRST admitted operation (the persisted
    /// authority of this directory).
    pub fn first_persisted_submission(&self) -> Option<Vec<u8>> {
        let records = self.records();
        let r = records
            .iter()
            .find(|r| r.event == bnrose_exec_core::E_ADMITTED)?;
        if r.payload.len() < 130 {
            return None;
        }
        let env_len = u16::from_le_bytes([r.payload[128], r.payload[129]]) as usize;
        Some(r.payload[130..130 + env_len].to_vec())
    }

    /// The EXACT persisted submission for this operation, loaded from the
    /// journal (founder review of #444: recovery must rebroadcast the
    /// ORIGINAL persisted bytes, not bytes reconstructed from a supplied
    /// intent — and a mismatching intent is refused).
    pub fn persisted_submission(&self, op: &[u8; 32]) -> Option<(Vec<u8>, [u8; 64], String)> {
        let records = self.records();
        let r = records
            .iter()
            .find(|r| r.event == bnrose_exec_core::E_ADMITTED && r.op_id == *op)?;
        // payload: authority 32 | sig 64 | policy 32 | env_len 2 | env | tx_id ascii
        if r.payload.len() < 130 {
            return None;
        }
        let sig: [u8; 64] = r.payload[32..96].try_into().ok()?;
        let env_len = u16::from_le_bytes([r.payload[128], r.payload[129]]) as usize;
        if r.payload.len() < 130 + env_len {
            return None;
        }
        let env = r.payload[130..130 + env_len].to_vec();
        let tx_id = String::from_utf8_lossy(&r.payload[130 + env_len..]).into_owned();
        Some((env, sig, tx_id))
    }

    pub fn open(state_dir: &Path, root: &[u8; 32], dest: DestClient) -> Result<Host, String> {
        std::fs::create_dir_all(state_dir.join("replica")).map_err(|e| e.to_string())?;
        // an initialized directory LOADS its root (never re-initializes);
        // a fresh one initializes it
        let keys = if state_dir.join(bnrose_exec_host::keys::KEY_FILE).exists() {
            bnrose_exec_host::keys::SupervisorKeys::load(state_dir)?
        } else {
            bnrose_exec_host::keys::SupervisorKeys::init(state_dir, root)?
        };
        let claim = Claim::acquire(state_dir)?;
        Ok(Host {
            state_dir: state_dir.to_path_buf(),
            claim,
            keys,
            dest,
            worker: NativeWorker::new(),
        })
    }

    fn records(&self) -> Vec<bnrose_exec_host::journal::Record> {
        bnrose_exec_host::journal::ReplicatedJournal::load_state(
            &replica_paths(&self.state_dir),
            &self.keys.journal_mac,
        )
        .unwrap()
        .0
    }

    /// Drive one operation to its effect boundary and its resolution —
    /// the exact persistence law, with the destination at the seam:
    ///
    /// 1. admit (worker verdict; the SIGNED BYTES and the transaction id
    ///    are journaled durably BEFORE anything leaves the process — the
    ///    tx id IS the record's effect digest hex, stable and derived
    ///    from the committed intent)
    /// 2. reserve + dispatch (durably acknowledged on both replicas)
    /// 3. SUBMIT the exact bytes: the destination answers, or it does
    ///    not (Timeout ⇒ the operation is UNKNOWN — never re-signed)
    /// 4. resolve: only an OBSERVATION of `included`/`final` completes
    ///    the operation; a `duplicate` response alone NEVER does
    pub fn run_to_effect(
        &mut self,
        intent: &bnrose_exec_host::fixtures::IntentFile,
        clock: u64,
    ) -> HostReport {
        self.drive(intent, clock, true, false)
    }

    /// Resolve an UNKNOWN operation by observation (recovery). Optionally
    /// rebroadcast the IDENTICAL signed bytes first (reconciliation) —
    /// the duplicate response that comes back is an observation, and the
    /// completion still requires an included/final observation.
    pub fn resolve(
        &mut self,
        intent: &bnrose_exec_host::fixtures::IntentFile,
        clock: u64,
        rebroadcast: bool,
    ) -> HostReport {
        self.drive(intent, clock, false, rebroadcast)
    }

    fn drive(
        &mut self,
        intent: &bnrose_exec_host::fixtures::IntentFile,
        clock: u64,
        fresh: bool,
        rebroadcast: bool,
    ) -> HostReport {
        let policy = bnrose_exec_host::fixtures::test_policy();
        let bounds = Bounds::default();
        let req = bnrose_exec_host::admit_request(clock, &intent.authority, &policy, &intent.env);
        let verdict = self
            .worker
            .admit(&req)
            .expect("native worker always answers");
        let (op, env_sha, effect) =
            match bnrose_exec_host::parse_admit_verdict(&verdict).expect("parse") {
                bnrose_exec_host::AdmitVerdict::Admitted {
                    op,
                    env_sha,
                    effect,
                } => (op, env_sha, effect),
                bnrose_exec_host::AdmitVerdict::Refused(r) => {
                    panic!("fixture refused: {}", r.word())
                }
            };
        let tx_id = bnrose_exec_host::hex(&effect);
        let mut journal = bnrose_exec_host::journal::ReplicatedJournal::open(
            &replica_paths(&self.state_dir),
            &self.keys.journal_mac,
        )
        .unwrap();
        let records_before = self.records().len();
        if fresh {
            // THE PERSISTENCE LAW: identity, the exact signed bytes, and
            // the transaction id are durable BEFORE submission
            let mut payload = Vec::new();
            payload.extend_from_slice(&intent.authority);
            payload.extend_from_slice(&intent.sig);
            payload.extend_from_slice(&bnrose_exec_core::policy_digest(&policy.wire()));
            payload.extend_from_slice(&(intent.env.len() as u16).to_le_bytes());
            payload.extend_from_slice(&intent.env);
            payload.extend_from_slice(tx_id.as_bytes());
            journal
                .append(&op, bnrose_exec_core::E_ADMITTED, &payload)
                .unwrap();
            let mut state = bnrose_exec_core::OpState::ADMITTED_ZERO;
            let decoded = btungsten_wb001::decode(&intent.env).unwrap();
            let mut reservations = Vec::with_capacity(16);
            reservations.extend_from_slice(&bounds.fuel.to_le_bytes());
            reservations.extend_from_slice(&((bounds.memory_cap / 65_536) as u32).to_le_bytes());
            reservations.extend_from_slice(&30u32.to_le_bytes());
            for (event, pl) in [
                (bnrose_exec_core::E_RESERVE, reservations),
                (bnrose_exec_core::E_DISPATCH, effect.as_slice().to_vec()),
            ] {
                let sreq = bnrose_exec_host::step_request(
                    &op,
                    &env_sha,
                    &state,
                    event,
                    &pl,
                    clock,
                    decoded.expiry,
                );
                let v = self.worker.step(&sreq).expect("worker answers");
                match bnrose_exec_host::parse_step_verdict(&v).expect("parse") {
                    bnrose_exec_host::StepVerdict::Next(next) => {
                        journal.append(&op, event, &pl).unwrap();
                        state = next;
                    }
                    bnrose_exec_host::StepVerdict::Refused(r) => panic!("transition: {}", r.word()),
                }
            }
        }
        // the effect boundary: submit the EXACT recorded bytes
        let outcome = if fresh || rebroadcast {
            let env_hex = bnrose_exec_host::hex(&intent.env);
            self.dest.submit(&tx_id, &env_hex)
        } else {
            SubmitOutcome::Duplicate // no submission; observation only below
        };
        let outcome_word = match outcome {
            SubmitOutcome::Acked => "acked",
            SubmitOutcome::Duplicate => "duplicate",
            SubmitOutcome::Conflict => "conflict",
            SubmitOutcome::StorageError => "storage-error",
            SubmitOutcome::Timeout => "timeout",
        };
        if fresh {
            // journal the submission outcome as the OBSERVATION it is
            let mut p = Vec::new();
            p.push(match outcome {
                SubmitOutcome::Acked => 1,
                SubmitOutcome::Duplicate => 2,
                SubmitOutcome::Timeout => 3,
                SubmitOutcome::Conflict => 4,
                SubmitOutcome::StorageError => 5,
            });
            p.extend_from_slice(tx_id.as_bytes());
            journal
                .append(&op, bnrose_exec_core::E_RESPONSE, &p)
                .unwrap();
        }
        // resolution: an observation of included/final — the only
        // completion path; a duplicate response alone never completes
        let obs = self.dest.observe(&tx_id);
        let resolved = matches!(obs, Some(DestState::Included) | Some(DestState::Final));
        if resolved && fresh {
            // the completion record, after the observation
            journal
                .append(&op, bnrose_exec_core::E_RESPONSE, &[1])
                .unwrap();
        }
        let records_after = self.records();
        HostReport {
            op,
            tx_id,
            submitted: fresh || rebroadcast,
            submission_outcome: outcome_word,
            final_observation: obs.map(|o| o.word()),
            journal_records: records_after.len(),
            signatures_journaled: records_after
                .iter()
                .filter(|r| r.event == bnrose_exec_core::E_ADMITTED)
                .count(),
            records_before,
        }
    }
}
