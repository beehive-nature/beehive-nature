//! Durable per-batch payment-attempt ledger.
//!
//! Lifecycle (this slice implements it OFFLINE with synthetic data; no
//! broadcast exists yet — the states model what the later signing/
//! broadcast slice will drive):
//!
//! ```text
//! intent ──signed──> signed ──receipt──> mined     (terminal: batch paid)
//!   │                   │────receipt──> reverted   (retry allowed, new attempt)
//!   │                   └────evidence-missing──> unknown
//!   ├──cancel──> cancelled                     unknown ──HUMAN──> mined/reverted/abandoned
//!   └─(retry after cancelled/reverted: new attempt seq)
//! ```
//!
//! LAWS ENFORCED HERE:
//! - The attempt identity (plan_hash, batch_id, batch_index, seq) and the
//!   nonce are persisted BEFORE anything is signed (the caller writes the
//!   intent, hands the nonce to the composer/signer, and only then may
//!   call `record_signed`).
//! - `record_signed` validates the decoded transaction against the plan
//!   and the attempt's own nonce, and refuses a transaction hash already
//!   recorded anywhere in this plan.
//! - A batch with a Mined attempt never accepts a new intent (local
//!   double-payment fence; the on-chain `PaymentAlreadyExists` revert is
//!   the second fence, not the mechanism).
//! - `Unknown` NEVER auto-re-signs: `write_intent` refuses while any
//!   attempt is Signed or Unknown; resolution requires an explicit
//!   [`HumanGate`] (`resolve_unknown`). Replacement-by-fee of a stuck
//!   attempt likewise requires the human path — no automatic replacement
//!   exists in this crate.
//! - A Signed attempt cannot be silently cancelled (it may still be
//!   broadcast in a later slice); cancellation from Signed is refused —
//!   reconcile the outcome first (possibly to `unknown`, then human
//!   abandon).
//!
//! DURABILITY — precisely what is claimed:
//! - Writes are temp-file + `write_all` + `flush` + `sync_all` (file
//!   content durable) + `rename` over the target (+ directory `sync_all`
//!   on Unix). An atomic rename ALONE is not a cross-platform durability
//!   proof — that is why the content fsync happens on every platform
//!   before the rename, and the directory entry fsync on Unix.
//! - On Windows, `std` offers no directory-handle fsync; the rename
//!   relies on the filesystem's own journaling. The CONTENT is fsynced
//!   pre-rename everywhere. This is documented, not claimed as proven.
//! - A crash between fsync and rename leaves the pre-crash state (or no
//!   file); a stray `.tmp` file is ignored by the loader, never parsed.
//! - A torn/partial attempt file makes the loader FAIL CLOSED naming the
//!   file — a corrupt record can never silently downgrade a batch to
//!   "never signed".
//!
//! This ledger does NOT recover upload process death (the prepared-upload
//! spill state is app-side and dies with the process — z2.a audit E4);
//! it records payment attempts only.

use crate::error::{Error, Result};
use crate::plan::ValidatedPlan;
use crate::plan_model::Plan;
use crate::receipt::{
    validate_receipt, CompletedReadback, ReceiptOutcome, SyntheticReceipt,
};
use crate::tx::{validate_transaction, DecodedTransaction, TxDestination};
use crate::types::{Atto, Hex32};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const RECORD_VERSION: u32 = 1;

/// Marker proving an explicit human decision. Nothing in this crate
/// constructs one on an automatic path; callers build it via
/// [`HumanGate::explicit_human_approval`] at a UI/operator boundary.
#[derive(Debug, Clone, Copy)]
pub struct HumanGate {
    _private: (),
}

impl HumanGate {
    pub fn explicit_human_approval() -> Self {
        HumanGate { _private: () }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum AttemptState {
    /// Persisted before any signing: identity + nonce on disk.
    Intent,
    /// A validated signed result (the full decoded tx is persisted so the
    /// future broadcast slice and receipt validation can re-bind to it).
    Signed { tx: DecodedTransaction },
    /// Terminal success: receipt validated, winner + amount recorded.
    Mined {
        tx_hash: Hex32,
        winner_pool_hash: Hex32,
        total_amount: Atto,
    },
    /// Terminal failure on-chain: receipt status 0.
    Reverted {
        tx_hash: Hex32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        payment_already_exists_winner: Option<Hex32>,
    },
    /// Evidence unavailable/ambiguous after a signed result existed.
    /// NEVER auto-re-signs; only [`HumanGate`] paths resolve it. The full
    /// signed transaction rides IN the record so later reconciliation can
    /// re-bind the receipt to the exact calldata and hash.
    Unknown {
        tx: DecodedTransaction,
        since_unix: u64,
        note: String,
    },
    /// Explicitly cancelled (from Intent) or human-abandoned (from
    /// Unknown). A new attempt MAY follow.
    Cancelled { reason: String },
}

impl AttemptState {
    pub fn kind(&self) -> &'static str {
        match self {
            AttemptState::Intent => "intent",
            AttemptState::Signed { .. } => "signed",
            AttemptState::Mined { .. } => "mined",
            AttemptState::Reverted { .. } => "reverted",
            AttemptState::Unknown { .. } => "unknown",
            AttemptState::Cancelled { .. } => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AttemptRecord {
    pub record_version: u32,
    pub job_id: String,
    pub plan_hash: Hex32,
    pub batch_index: u32,
    pub batch_id: Hex32,
    pub attempt_seq: u32,
    pub nonce: u64,
    pub state: AttemptState,
    pub updated_unix: u64,
}

pub struct Ledger {
    root: PathBuf,
}

impl Ledger {
    pub fn open(root: &Path) -> Result<Self> {
        std::fs::create_dir_all(root)?;
        Ok(Ledger { root: root.to_path_buf() })
    }

    fn batch_dir(&self, job_id: &str, batch_index: u32) -> Result<PathBuf> {
        crate::plan::validate_job_id(job_id)?;
        Ok(self.root.join(job_id).join(batch_index.to_string()))
    }

    /// All attempts for a batch, ordered by seq. Fails closed on any
    /// unparseable attempt file (names the path); ignores stray tmp files.
    pub fn attempts(&self, job_id: &str, batch_index: u32) -> Result<Vec<AttemptRecord>> {
        let dir = self.batch_dir(job_id, batch_index)?;
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut records = Vec::new();
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !name.starts_with("attempt-") || !name.ends_with(".json") {
                continue; // stray tmp/foreign files are never parsed
            }
            let path = entry.path();
            let raw = std::fs::read_to_string(&path).map_err(|e| {
                Error::Ledger(format!("attempt file unreadable {}: {e}", path.display()))
            })?;
            let rec: AttemptRecord = serde_json::from_str(&raw).map_err(|e| {
                Error::Ledger(format!(
                    "attempt file corrupt/torn {}: {e} — refusing to guess state",
                    path.display()
                ))
            })?;
            if rec.record_version != RECORD_VERSION {
                return Err(Error::Ledger(format!(
                    "attempt file {}: unknown record_version {} — refusing",
                    path.display(),
                    rec.record_version
                )));
            }
            if rec.job_id != job_id || rec.batch_index != batch_index {
                return Err(Error::Ledger(format!(
                    "attempt file {}: identity mismatch (job/batch) — refusing",
                    path.display()
                )));
            }
            records.push(rec);
        }
        records.sort_by_key(|r| r.attempt_seq);
        Ok(records)
    }

    /// Every tx hash recorded under a plan's job (for duplicate refusal).
    fn recorded_tx_hashes(&self, plan: &Plan) -> Result<Vec<Hex32>> {
        let job_dir = self.root.join(&plan.job_id);
        if !job_dir.exists() {
            return Ok(Vec::new());
        }
        let mut hashes = Vec::new();
        for entry in std::fs::read_dir(&job_dir)? {
            let batch_dir = entry?.path();
            if !batch_dir.is_dir() {
                continue;
            }
            for f in std::fs::read_dir(&batch_dir)? {
                let f = f?;
                let name = f.file_name();
                let name = name.to_string_lossy();
                if !name.starts_with("attempt-") || !name.ends_with(".json") {
                    continue;
                }
                let raw = std::fs::read_to_string(f.path()).map_err(|e| {
                    Error::Ledger(format!("attempt file unreadable {}: {e}", f.path().display()))
                })?;
                let rec: AttemptRecord = serde_json::from_str(&raw).map_err(|e| {
                    Error::Ledger(format!(
                        "attempt file corrupt/torn {}: {e}",
                        f.path().display()
                    ))
                })?;
                match &rec.state {
                    AttemptState::Signed { tx } => hashes.push(tx.tx_hash),
                    AttemptState::Mined { tx_hash, .. }
                    | AttemptState::Reverted { tx_hash, .. } => hashes.push(*tx_hash),
                    AttemptState::Unknown { tx, .. } => hashes.push(tx.tx_hash),
                    _ => {}
                }
            }
        }
        Ok(hashes)
    }

    fn persist(&self, rec: &AttemptRecord) -> Result<()> {
        let dir = self.batch_dir(&rec.job_id, rec.batch_index)?;
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("attempt-{:04}.json", rec.attempt_seq));
        let json = serde_json::to_string_pretty(rec)
            .map_err(|e| Error::Malformed(format!("ledger record: {e}")))?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    fn latest(&self, plan: &Plan, batch_index: u32) -> Result<Option<AttemptRecord>> {
        Ok(self.attempts(&plan.job_id, batch_index)?.pop())
    }

    fn bind_plan(&self, vp: &ValidatedPlan, batch_index: usize) -> Result<crate::plan_model::Batch> {
        let batch = vp
            .plan
            .batches
            .get(batch_index)
            .cloned()
            .ok_or_else(|| Error::field("batch_index", "no such batch in the plan"))?;
        Ok(batch)
    }

    /// Persist the attempt identity + nonce BEFORE any signing.
    /// Refusals (each names the blocking state):
    /// - mined  → local double-payment fence
    /// - signed → a signed tx exists; never auto-re-sign
    /// - unknown → outcome unknown; never auto-re-sign; human resolution first
    /// - open intent → cancel it explicitly first
    pub fn write_intent(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        nonce: u64,
        now_unix: u64,
    ) -> Result<u32> {
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts(&vp.plan.job_id, batch.batch_index)?;
        for r in &existing {
            match &r.state {
                AttemptState::Mined { winner_pool_hash, .. } => {
                    return Err(Error::Ledger(format!(
                        "batch {} of job {} is already paid (winner {}) — double payment refused",
                        batch.batch_index,
                        vp.plan.job_id,
                        winner_pool_hash
                    )));
                }
                AttemptState::Signed { tx } => {
                    return Err(Error::Ledger(format!(
                        "batch {} has a signed transaction {} — never auto-re-sign; \
                         reconcile the outcome (possibly via the human gate) first",
                        batch.batch_index,
                        tx.tx_hash
                    )));
                }
                AttemptState::Unknown { since_unix, .. } => {
                    return Err(Error::Ledger(format!(
                        "batch {} has an UNKNOWN outcome since {since_unix} — automatic \
                         re-signing refused; explicit human reconciliation required",
                        batch.batch_index
                    )));
                }
                AttemptState::Intent => {
                    return Err(Error::Ledger(format!(
                        "batch {} already has an open intent (attempt {}) — cancel it \
                         explicitly before starting a new attempt",
                        batch.batch_index,
                        r.attempt_seq
                    )));
                }
                AttemptState::Cancelled { .. } | AttemptState::Reverted { .. } => {}
            }
        }
        let seq = existing.iter().map(|r| r.attempt_seq).max().unwrap_or(0) + 1;
        let rec = AttemptRecord {
            record_version: RECORD_VERSION,
            job_id: vp.plan.job_id.clone(),
            plan_hash: vp.plan.plan_hash,
            batch_index: batch.batch_index,
            batch_id: batch.batch_id,
            attempt_seq: seq,
            nonce,
            state: AttemptState::Intent,
            updated_unix: now_unix,
        };
        self.persist(&rec)?;
        Ok(seq)
    }

    /// Validate a signer-returned decoded transaction against the plan and
    /// the attempt's persisted nonce, then persist the Signed record.
    /// Refuses a tx hash already recorded anywhere under this plan.
    pub fn record_signed(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        tx: &DecodedTransaction,
        now_unix: u64,
    ) -> Result<()> {
        let batch = self.bind_plan(vp, batch_index)?;
        let latest = self
            .latest(&vp.plan, batch.batch_index)?
            .ok_or_else(|| Error::Ledger("no intent on record — persist the intent first".into()))?;
        match &latest.state {
            AttemptState::Intent => {}
            other => {
                return Err(Error::Ledger(format!(
                    "latest attempt for batch {} is {} — record_signed requires intent",
                    batch.batch_index,
                    other.kind()
                )));
            }
        }
        validate_transaction(
            vp,
            TxDestination::BatchPayment { batch_index },
            tx,
            latest.nonce,
        )?;
        for h in self.recorded_tx_hashes(&vp.plan)? {
            if h == tx.tx_hash {
                return Err(Error::Ledger(format!(
                    "transaction hash {} already recorded for this plan — duplicate refused",
                    tx.tx_hash
                )));
            }
        }
        let mut rec = latest;
        rec.state = AttemptState::Signed { tx: tx.clone() };
        rec.updated_unix = now_unix;
        self.persist(&rec)
    }

    /// Reconcile a Signed attempt against a receipt: persists Mined or
    /// Reverted. Returns the validated outcome.
    pub fn record_outcome(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        receipt: &SyntheticReceipt,
        readback: Option<&CompletedReadback>,
        now_unix: u64,
    ) -> Result<ReceiptOutcome> {
        let (mut rec, tx) = self.require_signed(vp, batch_index)?;
        let outcome = validate_receipt(vp, batch_index, &tx, receipt, readback)?;
        rec.updated_unix = now_unix;
        match &outcome {
            ReceiptOutcome::Paid(p) => {
                rec.state = AttemptState::Mined {
                    tx_hash: p.tx_hash,
                    winner_pool_hash: p.winner_pool_hash,
                    total_amount: p.total_amount,
                };
            }
            ReceiptOutcome::Reverted(r) => {
                rec.state = AttemptState::Reverted {
                    tx_hash: r.tx_hash,
                    payment_already_exists_winner: r.payment_already_exists_winner,
                };
            }
        }
        self.persist(&rec)?;
        Ok(outcome)
    }

    /// Mark a Signed attempt's outcome as UNKNOWN (evidence unavailable or
    /// ambiguous). No automatic path leaves Unknown; only the human gate
    /// resolves it. (In this offline slice the trigger is synthetic.)
    pub fn record_unknown(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        note: &str,
    ) -> Result<()> {
        let (mut rec, tx) = self.require_signed(vp, batch_index)?;
        rec.state = AttemptState::Unknown {
            tx,
            since_unix: now_unix,
            note: note.to_string(),
        };
        rec.updated_unix = now_unix;
        self.persist(&rec)
    }

    /// Explicitly cancel an OPEN INTENT. Cancelling a Signed attempt is
    /// refused (it may still be broadcast in a later slice) — reconcile
    /// the outcome first.
    pub fn cancel_intent(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        reason: &str,
    ) -> Result<()> {
        let batch = self.bind_plan(vp, batch_index)?;
        let mut latest = self
            .latest(&vp.plan, batch.batch_index)?
            .ok_or_else(|| Error::Ledger("no attempt on record".into()))?;
        match latest.state {
            AttemptState::Intent => {
                latest.state = AttemptState::Cancelled { reason: reason.to_string() };
                latest.updated_unix = now_unix;
                self.persist(&latest)
            }
            other => Err(Error::Ledger(format!(
                "cannot cancel from {} — only an open intent is cancellable; a signed \
                 attempt must be reconciled first",
                other.kind()
            ))),
        }
    }

    /// Human-gated resolution of an Unknown outcome: re-run receipt
    /// validation with the supplied evidence and persist the terminal
    /// state (Mined/Reverted), or abandon with a recorded human decision.
    pub fn resolve_unknown(
        &self,
        gate: &HumanGate,
        vp: &ValidatedPlan,
        batch_index: usize,
        receipt: &SyntheticReceipt,
        readback: Option<&CompletedReadback>,
        now_unix: u64,
    ) -> Result<ReceiptOutcome> {
        let _ = gate; // presence is the authorization; nothing else is derived from it
        let batch = self.bind_plan(vp, batch_index)?;
        let mut latest = self
            .latest(&vp.plan, batch.batch_index)?
            .ok_or_else(|| Error::Ledger("no attempt on record".into()))?;
        let signed = match latest.state {
            AttemptState::Unknown { ref tx, .. } => tx.clone(),
            ref other => {
                return Err(Error::Ledger(format!(
                    "latest attempt for batch {} is {} — resolve_unknown requires unknown",
                    batch.batch_index,
                    other.kind()
                )))
            }
        };
        let outcome = validate_receipt(vp, batch_index, &signed, receipt, readback)?;
        latest.updated_unix = now_unix;
        match &outcome {
            ReceiptOutcome::Paid(p) => {
                latest.state = AttemptState::Mined {
                    tx_hash: p.tx_hash,
                    winner_pool_hash: p.winner_pool_hash,
                    total_amount: p.total_amount,
                };
            }
            ReceiptOutcome::Reverted(r) => {
                latest.state = AttemptState::Reverted {
                    tx_hash: r.tx_hash,
                    payment_already_exists_winner: r.payment_already_exists_winner,
                };
            }
        }
        self.persist(&latest)?;
        Ok(outcome)
    }

    /// Human-gated abandon of an Unknown outcome: records the human
    /// decision as Cancelled. A new attempt MAY follow; the abandon does
    /// not (and cannot) un-broadcast anything — it records the choice.
    pub fn abandon_unknown(
        &self,
        gate: &HumanGate,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        justification: &str,
    ) -> Result<()> {
        let _ = gate;
        let batch = self.bind_plan(vp, batch_index)?;
        let mut latest = self
            .latest(&vp.plan, batch.batch_index)?
            .ok_or_else(|| Error::Ledger("no attempt on record".into()))?;
        if !matches!(latest.state, AttemptState::Unknown { .. }) {
            return Err(Error::Ledger(format!(
                "latest attempt is {} — abandon requires unknown",
                latest.state.kind()
            )));
        }
        latest.state = AttemptState::Cancelled {
            reason: format!("human abandon after reconciliation: {justification}"),
        };
        latest.updated_unix = now_unix;
        self.persist(&latest)
    }

    fn require_signed(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
    ) -> Result<(AttemptRecord, DecodedTransaction)> {
        let batch = self.bind_plan(vp, batch_index)?;
        let latest = self
            .latest(&vp.plan, batch.batch_index)?
            .ok_or_else(|| Error::Ledger("no attempt on record".into()))?;
        let tx = match &latest.state {
            AttemptState::Signed { tx } => tx.clone(),
            other => {
                return Err(Error::Ledger(format!(
                    "latest attempt for batch {} is {} — a signed result is required first",
                    batch.batch_index,
                    other.kind()
                )))
            }
        };
        Ok((latest, tx))
    }
}

/// Durability-disciplined write (see module docs for the exact claim).
fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "no parent dir"))?;
    let tmp = dir.join(format!(
        ".{}.tmp{}",
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "record".into()),
        std::process::id()
    ));
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.flush()?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    #[cfg(unix)]
    {
        if let Ok(d) = std::fs::File::open(dir) {
            let _ = d.sync_all();
        }
    }
    Ok(())
}
