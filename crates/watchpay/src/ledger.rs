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
//! - **PLAN-IDENTITY BINDING (z2.b review P1):** every transition binds to
//!   the persisted identity. All existing attempts for the batch must
//!   carry the SAME plan_hash and batch_id as the supplied validated plan
//!   (which must itself still hash to its seal) — a different plan under
//!   the same job/index (changed vault, payer, chain, commitments,
//!   budgets, expiry) is refused at every boundary.
//! - **FRESHNESS AT SIGNING BOUNDARIES (z2.b review P1):** `write_intent`
//!   and `record_signed` re-run the full plan validation at their
//!   `now_unix` — a cached validation cannot outlive the plan's expiry
//!   (or the batch payment-timestamp window). Outcome reconciliation
//!   (`record_outcome`, `record_unknown`, `resolve_unknown`, abandon,
//!   cancel) deliberately does NOT re-check expiry: evidence of
//!   already-submitted payments is reconciled after expiry — expiry
//!   blocks NEW signing, it does not discard old evidence.
//! - **FEE BUDGET (z2.b review P1):** each attempt durably reserves
//!   worst-case native fee exposure (`reserved_fee_wei`): the plan's
//!   per-tx worst case at intent time, re-reserved to the transaction's
//!   own worst case (gas_limit × fee cap) at signing. A new intent is
//!   refused when the plan-wide sum of reservations plus the new
//!   reservation would exceed `max_total_native_fee_wei`. Reservations
//!   are reconciled DOWN only with receipt fee evidence
//!   (`gas_used`/`effective_gas_price_wei`, clamped to the tx's own
//!   worst case); a failed call NEVER frees unknown exposure — a reverted
//!   attempt without fee evidence keeps its full reservation, and
//!   `unknown` keeps it until human resolution. Cancelling an open
//!   (unsigned) intent releases its reservation; human-abandoning an
//!   unknown (signed) attempt does NOT.
//!   **SCOPE LAW:** this budget governs BATCH-PAYMENT attempts only.
//!   The approval transaction's lifecycle (allowance grant/decay) is
//!   OUTSIDE this ledger; this crate does NOT claim a complete
//!   plan-wide spend-enforcement boundary. Replacement semantics are
//!   explicit: there is no in-place replacement — every attempt is a new
//!   nonce with its own reservation; same-nonce higher-fee replacement
//!   is unsupported in this slice and would need its own reviewed
//!   reservation treatment.
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
//! - A paid outcome requires the completed-payment read-back evidence
//!   (`record_outcome`/`resolve_unknown` pass it to the receipt
//!   validator, which refuses `Paid` without it).
//!
//! EXCLUSIVE-WRITER CONTRACT (z2.c R1 review P1) — what is actually
//! enforced, and how:
//! - Every PUBLIC mutating operation (`write_intent`, `record_signed`,
//!   `record_signed_at_attempt`, `record_outcome`, `record_unknown`,
//!   `cancel_intent`, `resolve_unknown`, `abandon_unknown`) holds an
//!   EXCLUSIVE OS file lock on `<root>/.lock` across its ENTIRE
//!   read/check/write sequence — the check and the write are one
//!   lock-covered transition, not a getter followed by an unlocked write.
//!   The public read `attempts` holds a SHARED lock (consistent
//!   multi-file snapshots; loaders never observe a half-committed
//!   transition).
//! - The lock is std `File::lock`/`lock_shared` (stable Rust 1.89):
//!   `flock(2)` on Unix, `LockFileEx` on Windows — advisory KERNEL locks
//!   attached to an open file description / handle. They contend across
//!   independent `Ledger` handles AND across processes (two `open()`s of
//!   the same lock file in one process are two distinct descriptions and
//!   contend exactly like two processes; every competing mutation in
//!   this crate participates — there are NO lock-free public mutation
//!   paths).
//! - PROVEN SCOPE, stated precisely: mutual exclusion and lock-covered
//!   transition atomicity are proven across independent handles and
//!   across separate processes (deterministic contention tests, no sleep
//!   races); a process that dies holding the lock has it released by the
//!   KERNEL automatically (no stale locks after process death — that is
//!   a flock/LockFileEx property, not our code). NOT claimed: any
//!   power-loss/fs-journaling guarantee (see DURABILITY below), and any
//!   exclusion against writers that bypass this crate and write the
//!   ledger files directly (the files are plain JSON by design).
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
use crate::receipt::{validate_receipt, CompletedReadback, ReceiptOutcome, SyntheticReceipt};
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
    /// Worst-case native fee this attempt currently reserves against the
    /// plan's `max_total_native_fee_wei` budget (see module docs for the
    /// reservation/reconciliation law).
    pub reserved_fee_wei: Atto,
    pub state: AttemptState,
    pub updated_unix: u64,
}

pub struct Ledger {
    root: PathBuf,
}

/// The exclusive-writer contract's lock guard (z2.c R1 review P1).
///
/// Every PUBLIC ledger operation acquires an OS file lock on
/// `<root>/.lock` for the ENTIRE conflicting read/check/write operation:
/// mutations take an exclusive lock, reads take a shared lock. The lock
/// is std's `File::lock`/`File::lock_shared` (stable since Rust 1.89) —
/// `flock(2)` on Unix and `LockFileEx` on Windows — advisory kernel
/// locks held by an open file description / handle, so they contend
/// across independent handles AND across processes, and are released
/// AUTOMATICALLY by the kernel if the holding process dies (crash
/// scope: no stale locks after process death; whatever was last durably
/// written stands — see the durability section below for what is and is
/// not claimed).
struct LedgerLock(std::fs::File);

impl Drop for LedgerLock {
    fn drop(&mut self) {
        // Explicit for clarity; closing the handle releases the lock too.
        let _ = self.0.unlock();
    }
}

impl Ledger {
    pub fn open(root: &Path) -> Result<Self> {
        std::fs::create_dir_all(root)?;
        Ok(Ledger {
            root: root.to_path_buf(),
        })
    }

    /// The contract's lock file path (`<root>/.lock` — never parsed as an
    /// attempt record; the loader only reads `attempt-*.json`).
    pub fn lock_path(&self) -> PathBuf {
        self.root.join(".lock")
    }

    fn open_lock_file(&self) -> Result<std::fs::File> {
        std::fs::OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(self.lock_path())
            .map_err(|e| Error::Ledger(format!("opening ledger lock file: {e}")))
    }

    /// Exclusive lock for the whole mutation. Dropping the guard (or the
    /// process dying) releases it.
    fn acquire_exclusive(&self) -> Result<LedgerLock> {
        let f = self.open_lock_file()?;
        f.lock()
            .map_err(|e| Error::Ledger(format!("acquiring exclusive ledger lock: {e}")))?;
        Ok(LedgerLock(f))
    }

    /// Shared lock for reads (consistent multi-file snapshots).
    fn acquire_shared(&self) -> Result<LedgerLock> {
        let f = self.open_lock_file()?;
        f.lock_shared()
            .map_err(|e| Error::Ledger(format!("acquiring shared ledger lock: {e}")))?;
        Ok(LedgerLock(f))
    }

    fn batch_dir(&self, job_id: &str, batch_index: u32) -> Result<PathBuf> {
        crate::plan::validate_job_id(job_id)?;
        Ok(self.root.join(job_id).join(batch_index.to_string()))
    }

    /// All attempts for a batch, ordered by seq (shared-locked read —
    /// never observes a half-committed multi-file transition). Fails
    /// closed on any unparseable attempt file (names the path); ignores
    /// stray tmp files.
    pub fn attempts(&self, job_id: &str, batch_index: u32) -> Result<Vec<AttemptRecord>> {
        let _guard = self.acquire_shared()?;
        self.attempts_unlocked(job_id, batch_index)
    }

    /// The lock-free core of [`Ledger::attempts`] — MUST only be called
    /// while holding the ledger lock.
    fn attempts_unlocked(&self, job_id: &str, batch_index: u32) -> Result<Vec<AttemptRecord>> {
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
                    Error::Ledger(format!(
                        "attempt file unreadable {}: {e}",
                        f.path().display()
                    ))
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

    /// PLAN-IDENTITY BINDING (review P1): the supplied validated plan must
    /// still hash to its seal, and every existing attempt for this batch
    /// must carry exactly its plan_hash and batch_id. A different plan
    /// under the same job/index is refused at every boundary.
    fn bind_attempt_identity(
        &self,
        vp: &ValidatedPlan,
        batch: &crate::plan_model::Batch,
        existing: &[AttemptRecord],
    ) -> Result<()> {
        if !vp.is_internally_consistent() {
            return Err(Error::Ledger(format!(
                "validated plan {} is not internally consistent (mutated after \
                 validation?) — refusing",
                vp.plan().plan_hash
            )));
        }
        for r in existing {
            if r.plan_hash != vp.plan().plan_hash || r.batch_id != batch.batch_id {
                return Err(Error::Ledger(format!(
                    "plan identity changed under job {} batch {}: attempt {} was recorded \
                     under plan {}/batch {}, but the supplied plan is {}/{} — a changed \
                     vault/payer/chain/commitments/budget/expiry cannot ride an old intent",
                    vp.plan().job_id,
                    batch.batch_index,
                    r.attempt_seq,
                    r.plan_hash,
                    r.batch_id,
                    vp.plan().plan_hash,
                    batch.batch_id
                )));
            }
        }
        Ok(())
    }

    /// Plan-wide sum of current fee reservations across ALL batches.
    fn plan_reserved_total(&self, vp: &ValidatedPlan) -> Result<Atto> {
        let job_dir = self.root.join(&vp.plan().job_id);
        if !job_dir.exists() {
            return Ok(Atto::ZERO);
        }
        let mut total = Atto::ZERO;
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
                    Error::Ledger(format!(
                        "attempt file unreadable {}: {e}",
                        f.path().display()
                    ))
                })?;
                let rec: AttemptRecord = serde_json::from_str(&raw).map_err(|e| {
                    Error::Ledger(format!(
                        "attempt file corrupt/torn {}: {e}",
                        f.path().display()
                    ))
                })?;
                total = total.checked_add(rec.reserved_fee_wei).ok_or_else(|| {
                    Error::Ledger("reserved-fee sum overflows u256 — ledger inconsistent".into())
                })?;
            }
        }
        Ok(total)
    }

    /// The per-tx worst-case native fee reserved for a NEW attempt (the
    /// plan's own per-tx ceiling product).
    fn plan_per_tx_worst_case(vp: &ValidatedPlan) -> Atto {
        Atto::from_u64(vp.plan().gas_ceilings.per_tx_gas_limit)
            .checked_mul(Atto::from_u64(
                vp.plan().native_fee_ceilings.per_tx_max_fee_per_gas_wei,
            ))
            .expect("plan validation bounds this product within u256")
    }

    /// The transaction's own worst-case native fee (gas_limit × fee cap).
    fn tx_worst_case_fee(tx: &DecodedTransaction) -> Atto {
        Atto::from_u64(tx.gas_limit)
            .checked_mul(Atto::from_u64(tx.max_fee_per_gas_wei))
            .expect("u64 × u64 fits u256")
    }

    /// Reconcile a reservation down using receipt fee evidence when
    /// available; NEVER raise. Without evidence the reservation stands
    /// (a failed call does not free unknown exposure). Evidence is
    /// consumed ONLY through `validate_fee_evidence` (complete pair, gas
    /// within the signed limit, price within the signed envelope) —
    /// impossible evidence refuses the whole transition before any
    /// mutation; the worst-case clamp stays as defense in depth.
    fn reconcile_reservation(
        current: Atto,
        tx: &DecodedTransaction,
        receipt: &SyntheticReceipt,
    ) -> Result<Atto> {
        match crate::receipt::validate_fee_evidence(tx, receipt)? {
            None => Ok(current),
            Some((gas, price)) => {
                let actual = Atto::from_u64(gas)
                    .checked_mul(Atto::from_u64(price))
                    .expect("u64 × u64 fits u256");
                // Evidence cannot raise exposure beyond the tx's own
                // worst case (defense in depth against forged evidence).
                let worst = Self::tx_worst_case_fee(tx);
                let clamped = if actual > worst { worst } else { actual };
                Ok(if clamped < current { clamped } else { current })
            }
        }
    }

    fn bind_plan(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
    ) -> Result<crate::plan_model::Batch> {
        let batch = vp
            .plan()
            .batches
            .get(batch_index)
            .cloned()
            .ok_or_else(|| Error::field("batch_index", "no such batch in the plan"))?;
        Ok(batch)
    }

    /// Persist the attempt identity + nonce BEFORE any signing.
    /// Refusals (each names the blocking state):
    /// - plan expired / timestamp-aged at `now_unix` → revalidated freshness
    /// - plan identity changed vs existing attempts → identity binding
    /// - fee budget: plan-wide reservations + this attempt's worst case
    ///   would exceed `max_total_native_fee_wei`
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
        let _guard = self.acquire_exclusive()?;
        self.write_intent_unlocked(vp, batch_index, nonce, now_unix)
    }

    /// The lock-free core of [`Ledger::write_intent`] — MUST only be
    /// called while holding the exclusive ledger lock (the budget
    /// read/project/write below is exactly the multi-file transition the
    /// lock serializes).
    fn write_intent_unlocked(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        nonce: u64,
        now_unix: u64,
    ) -> Result<u32> {
        // FRESHNESS: a cached validation cannot outlive expiry (review P1).
        vp.revalidate(now_unix)?;
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        // IDENTITY: bind to every persisted attempt of this batch.
        self.bind_attempt_identity(vp, &batch, &existing)?;
        // BUDGET: reserve this attempt's worst case against the plan total.
        let reserve = Self::plan_per_tx_worst_case(vp);
        let reserved = self.plan_reserved_total(vp)?;
        let ceiling = vp.plan().native_fee_ceilings.max_total_native_fee_wei;
        let projected = reserved
            .checked_add(reserve)
            .ok_or_else(|| Error::Ledger("reservation projection overflow".into()))?;
        if projected > ceiling {
            return Err(Error::Ledger(format!(
                "fee budget exhausted: plan-wide reservations {reserved} + this attempt's \
                 worst-case {reserve} = {projected} exceeds max_total_native_fee_wei \
                 {ceiling} — retrying reverted attempts cannot multiply worst-case \
                 exposure (evidence-backed reconciliation shrinks reservations; a failed \
                 call frees nothing)",
            )));
        }
        for r in &existing {
            match &r.state {
                AttemptState::Mined {
                    winner_pool_hash, ..
                } => {
                    return Err(Error::Ledger(format!(
                        "batch {} of job {} is already paid (winner {}) — double payment refused",
                        batch.batch_index,
                        vp.plan().job_id,
                        winner_pool_hash
                    )));
                }
                AttemptState::Signed { tx } => {
                    return Err(Error::Ledger(format!(
                        "batch {} has a signed transaction {} — never auto-re-sign; \
                         reconcile the outcome (possibly via the human gate) first",
                        batch.batch_index, tx.tx_hash
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
                        batch.batch_index, r.attempt_seq
                    )));
                }
                AttemptState::Cancelled { .. } | AttemptState::Reverted { .. } => {}
            }
        }
        let seq = existing.iter().map(|r| r.attempt_seq).max().unwrap_or(0) + 1;
        let rec = AttemptRecord {
            record_version: RECORD_VERSION,
            job_id: vp.plan().job_id.clone(),
            plan_hash: vp.plan().plan_hash,
            batch_index: batch.batch_index,
            batch_id: batch.batch_id,
            attempt_seq: seq,
            nonce,
            reserved_fee_wei: reserve,
            state: AttemptState::Intent,
            updated_unix: now_unix,
        };
        self.persist(&rec)?;
        Ok(seq)
    }

    /// Validate a signer-returned decoded transaction against the plan and
    /// the attempt's persisted nonce, then persist the Signed record.
    /// Signing boundaries revalidate plan freshness (review P1); the
    /// reservation is tightened to THIS transaction's own worst case.
    /// Refuses a tx hash already recorded anywhere under this plan.
    ///
    /// SYNTHETIC/OFFLINE-ONLY z2.b API: this method does NOT bind the
    /// result to a specific persisted attempt sequence — it accepts the
    /// batch's latest Intent whatever its sequence. The adapter's verified
    /// boundary ([`crate::connect::record_verified_signed`]) uses
    /// [`Ledger::record_signed_at_attempt`] instead; compatibility with
    /// the preserved offline tests is the only reason this remains public,
    /// and it does not enforce the adapter's stale-callback rules.
    pub fn record_signed(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        tx: &DecodedTransaction,
        now_unix: u64,
    ) -> Result<()> {
        let _guard = self.acquire_exclusive()?;
        self.record_signed_inner(vp, batch_index, None, tx, now_unix)
    }

    /// The ATTEMPT-BOUND recording transition (z2.c review P1): identical
    /// validation to [`Ledger::record_signed`], plus the requirement that
    /// the batch's latest attempt is EXACTLY `expected_attempt_seq` in the
    /// `Intent` state — the state check and the write happen in one
    /// lock-covered transition with no observable getter step between
    /// them. A verified
    /// result for attempt N therefore cannot attach to a replacement
    /// attempt M (even with the same nonce and identical transaction
    /// fields), to a cancelled attempt, or to a batch whose latest
    /// attempt is already Signed. Refusal leaves the persisted state and
    /// reservation untouched.
    pub fn record_signed_at_attempt(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        expected_attempt_seq: u32,
        tx: &DecodedTransaction,
        now_unix: u64,
    ) -> Result<()> {
        let _guard = self.acquire_exclusive()?;
        self.record_signed_inner(vp, batch_index, Some(expected_attempt_seq), tx, now_unix)
    }

    fn record_signed_inner(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        expected_attempt_seq: Option<u32>,
        tx: &DecodedTransaction,
        now_unix: u64,
    ) -> Result<()> {
        // FRESHNESS at the signing boundary (review P1).
        vp.revalidate(now_unix)?;
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        self.bind_attempt_identity(vp, &batch, &existing)?;
        let latest = match existing.into_iter().next_back() {
            Some(r) => r,
            None => {
                return Err(Error::Ledger(
                    "no intent on record — persist the intent first".into(),
                ))
            }
        };
        if let Some(expected) = expected_attempt_seq {
            if latest.attempt_seq != expected {
                return Err(Error::Ledger(format!(
                    "attempt binding: this result was verified for attempt {expected} but the \
                     batch's latest attempt is {} — a stale or superseded callback cannot \
                     attach to a different attempt (state and reservation untouched)",
                    latest.attempt_seq
                )));
            }
        }
        match &latest.state {
            AttemptState::Intent => {}
            other => {
                return Err(Error::Ledger(format!(
                    "latest attempt for batch {} is {} — recording a signed result requires \
                     intent",
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
        for h in self.recorded_tx_hashes(vp.plan())? {
            if h == tx.tx_hash {
                return Err(Error::Ledger(format!(
                    "transaction hash {} already recorded for this plan — duplicate refused",
                    tx.tx_hash
                )));
            }
        }
        // Budget tighten: the tx's own worst case (validate_transaction
        // already bounds gas/fee by the plan ceilings, so this never
        // exceeds the reserved plan-per-tx figure).
        let tx_worst = Self::tx_worst_case_fee(tx);
        debug_assert!(tx_worst <= latest.reserved_fee_wei);
        let mut rec = latest;
        rec.reserved_fee_wei = tx_worst;
        rec.state = AttemptState::Signed { tx: tx.clone() };
        rec.updated_unix = now_unix;
        self.persist(&rec)
    }

    /// Reconcile a Signed attempt against a receipt: persists Mined or
    /// Reverted. Returns the validated outcome. Deliberately NOT expiry-
    /// gated (evidence of already-submitted payments reconciles after
    /// expiry); plan identity IS bound. Fee evidence on the receipt
    /// reconciles the reservation down (never up, never without evidence).
    pub fn record_outcome(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        receipt: &SyntheticReceipt,
        readback: Option<&CompletedReadback>,
        now_unix: u64,
    ) -> Result<ReceiptOutcome> {
        let _guard = self.acquire_exclusive()?;
        let (mut rec, tx) = self.require_signed_unlocked(vp, batch_index)?;
        let outcome = validate_receipt(vp, batch_index, &tx, receipt, readback)?;
        rec.reserved_fee_wei = Self::reconcile_reservation(rec.reserved_fee_wei, &tx, receipt)?;
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
    /// resolves it. (In this offline slice the trigger is synthetic.) The
    /// fee reservation is NOT released — unknown exposure is never freed.
    pub fn record_unknown(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        note: &str,
    ) -> Result<()> {
        let _guard = self.acquire_exclusive()?;
        let (mut rec, tx) = self.require_signed_unlocked(vp, batch_index)?;
        rec.state = AttemptState::Unknown {
            tx,
            since_unix: now_unix,
            note: note.to_string(),
        };
        rec.updated_unix = now_unix;
        self.persist(&rec)
    }

    /// Explicitly cancel an OPEN INTENT (releases its fee reservation —
    /// nothing was signed, nothing can be spent). Cancelling a Signed
    /// attempt is refused (it may still be broadcast in a later slice) —
    /// reconcile the outcome first.
    pub fn cancel_intent(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        reason: &str,
    ) -> Result<()> {
        let _guard = self.acquire_exclusive()?;
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        self.bind_attempt_identity(vp, &batch, &existing)?;
        let mut latest = existing
            .into_iter()
            .next_back()
            .ok_or_else(|| Error::Ledger("no attempt on record".into()))?;
        match latest.state {
            AttemptState::Intent => {
                latest.state = AttemptState::Cancelled {
                    reason: reason.to_string(),
                };
                latest.reserved_fee_wei = Atto::ZERO;
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
    /// Not expiry-gated (reconciliation of old evidence); plan identity IS
    /// bound; fee evidence on the receipt reconciles the reservation down.
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
        let _guard = self.acquire_exclusive()?;
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        self.bind_attempt_identity(vp, &batch, &existing)?;
        let mut latest = existing
            .into_iter()
            .next_back()
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
        latest.reserved_fee_wei =
            Self::reconcile_reservation(latest.reserved_fee_wei, &signed, receipt)?;
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
    /// The fee reservation is deliberately KEPT: the signed transaction
    /// may still land, so its exposure is not freed by the abandon.
    pub fn abandon_unknown(
        &self,
        gate: &HumanGate,
        vp: &ValidatedPlan,
        batch_index: usize,
        now_unix: u64,
        justification: &str,
    ) -> Result<()> {
        let _ = gate;
        let _guard = self.acquire_exclusive()?;
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        self.bind_attempt_identity(vp, &batch, &existing)?;
        let mut latest = existing
            .into_iter()
            .next_back()
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

    fn require_signed_unlocked(
        &self,
        vp: &ValidatedPlan,
        batch_index: usize,
    ) -> Result<(AttemptRecord, DecodedTransaction)> {
        let batch = self.bind_plan(vp, batch_index)?;
        let existing = self.attempts_unlocked(&vp.plan().job_id, batch.batch_index)?;
        self.bind_attempt_identity(vp, &batch, &existing)?;
        let latest = existing
            .into_iter()
            .next_back()
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
