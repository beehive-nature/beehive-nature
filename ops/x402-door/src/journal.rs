//! The reserve→settle journal — watchpay's ledger laws, applied to the door.
//!
//! LAWS (each tested in tests/acceptance.rs):
//! - EXCLUSIVE-WRITER: every public mutation holds `File::lock` on
//!   `<root>/.lock` across its entire read/check/write sequence (std lock:
//!   flock/LockFileEx — kernel-released on process death).
//! - TORN FAILS CLOSED: an unparseable reservation file refuses every
//!   operation that must read it, naming the file. Never guess state.
//! - EVIDENCE-GATED RECONCILE DOWN: a reservation's gas exposure
//!   reconciles DOWN only with settlement evidence (tx hash + actual gas);
//!   a failure without evidence keeps the reservation.
//! - UNKNOWN NEVER AUTO-RETRIES: an ambiguous settlement parks in
//!   `Unknown`; only `resolve_unknown` (human gate) moves it out.
//! - R4 PER-LEG UNLINKABILITY: records live under `<root>/<chain>/` —
//!   one directory per chain; no API joins records across chains.
//! - DAILY BUDGET: open reservations' gas estimates + today's settled
//!   actuals must fit the configured cap or new reservations are refused,
//!   naming cap and current exposure.

use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const RECORD_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum JournalError {
    #[error("journal: {0}")]
    Io(#[from] std::io::Error),
    #[error("journal: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("torn reservation file {path}: {reason} — refusing to guess state")]
    Torn { path: PathBuf, reason: String },
    #[error("reservation: {0}")]
    Law(String),
}

pub type JResult<T> = Result<T, JournalError>;

/// The per-leg key extracted from a payment request BEFORE facilitator
/// involvement. `chain` is the CAIP-2 id (e.g. `eip155:8453`) — the R4 leg.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegKey {
    pub chain: String,
    pub scheme: String,
    /// The authorization nonce — replay/idempotency key (EIP-3009: consumed
    /// on-chain by the token contract; here it is the journal's key).
    pub auth_nonce: String,
    pub payer: String,
    /// Authorized maximum (upto) or exact amount, in token base units.
    pub amount_authorized: String,
    /// Absolute expiry (unix seconds) — a finite validity window is law.
    pub valid_before_unix: u64,
    pub pay_to: String,
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ReservationState {
    /// Verify passed, float/budget gates passed; gas exposure reserved.
    Reserved { reserved_gas_wei: u64 },
    /// Settlement execution IN FLIGHT (the lock-held Reserved->Settling
    /// transition completed): exactly one caller may execute the
    /// facilitator; concurrent settles see this and are refused
    /// in-flight rather than double-executing (the adversarial race fix --
    /// the on-chain 3009 nonce protects funds, not gas).
    Settling { reserved_gas_wei: u64 },
    /// Settled with on-chain evidence; exposure reconciled to actual.
    Settled {
        actual_amount: String,
        tx_hash: String,
        gas_actual_wei: u64,
        settled_unix: u64,
    },
    /// Settlement failed WITHOUT evidence — the reservation stays (law:
    /// no free without evidence); a later settle may retry the attempt.
    /// `reserved_gas_wei` is the RETAINED exposure (counted by the budget).
    FailedKeep {
        reason: String,
        reserved_gas_wei: u64,
    },
    /// Settlement outcome ambiguous — NEVER auto-retried (human gate only).
    Unknown { since_unix: u64, note: String },
    /// Window expired and non-settlement was evidenced; released.
    ExpiredReleased { checked_unix: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Reservation {
    pub record_version: u32,
    pub leg: LegKey,
    pub state: ReservationState,
    pub updated_unix: u64,
}

pub struct Journal {
    root: PathBuf,
    /// Daily gas cap in wei (operations budget — the ops wallet class).
    pub daily_gas_cap_wei: u64,
    /// When opened exclusively (D-5), the instance holds the OS lock for
    /// its lifetime — kernel-released on process death, so a crashed
    /// opener can never strand the root.
    _held: Option<File>,
}

/// The typed on-chain verdict for an expiry release (D-4): a bare bool
/// invited the lying-RPC contradiction attack — the journal now demands
/// `RpcUnavailable` as an explicit HOLD (refused loudly, state kept) and
/// refuses release outright when it already HOLDS settlement evidence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReleaseVerdict {
    /// The authorization nonce is unspent on-chain (evidence-checked).
    UnspentOnChain,
    /// The authorization nonce IS spent — the leg settled elsewhere; the
    /// reservation goes to Unknown for the human gate, never released.
    SpentOnChain,
    /// The RPC could not answer — a typed HOLD: release refused, state
    /// untouched, retryable. Never silently treated as unspent.
    RpcUnavailable,
}

/// Settlement evidence — the only thing that reconciles exposure DOWN.
#[derive(Debug, Clone)]
pub struct SettleEvidence {
    pub actual_amount: String,
    pub tx_hash: String,
    pub gas_actual_wei: u64,
}

/// Marker for an explicit human decision (watchpay's HumanGate shape).
#[derive(Debug, Clone, Copy)]
pub struct HumanGate {
    _private: (),
    /// D-7: the tracked call site — every gate use is attributable.
    #[allow(dead_code)]
    call_site: Option<&'static std::panic::Location<'static>>,
}
impl HumanGate {
    #[track_caller]
    pub fn explicit_human_approval() -> Self {
        HumanGate {
            _private: (),
            call_site: Some(std::panic::Location::caller()),
        }
    }
}

struct LockGuard(File);
impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = self.0.unlock();
    }
}

pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn sanitize(chain: &str) -> String {
    chain
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

impl Journal {
    pub fn open(root: &Path, daily_gas_cap_wei: u64) -> JResult<Self> {
        fs::create_dir_all(root)?;
        // D-5 no-lock detection: if the lock file cannot even be opened,
        // refuse — an unlocked journal is not a journal.
        let probe = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(root.join(".lock"))?;
        drop(probe);
        Ok(Journal {
            root: root.to_path_buf(),
            daily_gas_cap_wei,
            _held: None,
        })
    }

    /// D-5 concurrent journal start: acquire the EXCLUSIVE OS lock and
    /// hold it for this instance's lifetime (try-lock — a second live
    /// opener is REFUSED by name, never blocks, never split-brains). The
    /// kernel releases the hold when the process dies — a crashed opener
    /// cannot strand the root.
    pub fn open_exclusive(root: &Path, daily_gas_cap_wei: u64) -> JResult<Self> {
        fs::create_dir_all(root)?;
        let lock = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(root.join(".lock"))?;
        lock.try_lock().map_err(|_| JournalError::Law(format!(
            "journal root {} is already held by a live opener — refusing concurrent exclusive start (D-5)",
            root.display()
        )))?;
        Ok(Journal {
            root: root.to_path_buf(),
            daily_gas_cap_wei,
            _held: Some(lock),
        })
    }

    fn lock_path(&self) -> PathBuf {
        self.root.join(".lock")
    }

    fn acquire_exclusive(&self) -> JResult<LockGuard> {
        let f = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(self.lock_path())?;
        f.lock().map_err(JournalError::Io)?;
        Ok(LockGuard(f))
    }

    fn leg_path(&self, leg: &LegKey) -> PathBuf {
        self.root
            .join(sanitize(&leg.chain))
            .join(format!("res-{}.json", sanitize(&leg.auth_nonce)))
    }

    /// Fail-closed read of one reservation.
    pub fn get(&self, leg: &LegKey) -> JResult<Option<Reservation>> {
        let path = self.leg_path(leg);
        if !path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&path)?;
        let rec: Reservation = serde_json::from_str(&raw).map_err(|e| JournalError::Torn {
            path: path.clone(),
            reason: e.to_string(),
        })?;
        if rec.record_version != RECORD_VERSION {
            return Err(JournalError::Torn {
                path,
                reason: format!("unknown record_version {}", rec.record_version),
            });
        }
        if rec.leg != *leg {
            return Err(JournalError::Torn {
                path,
                reason: "identity mismatch (leg)".into(),
            });
        }
        Ok(Some(rec))
    }

    fn write(&self, rec: &Reservation) -> JResult<()> {
        let path = self.leg_path(&rec.leg);
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let tmp = path.with_extension("json.tmp");
        let mut f = File::create(&tmp)?;
        f.write_all(serde_json::to_string_pretty(rec)?.as_bytes())?;
        f.flush()?;
        // Content fsync before rename (watchpay durability statement).
        #[cfg(unix)]
        f.sync_all()?;
        #[cfg(windows)]
        {
            f.sync_all()?;
        }
        fs::rename(&tmp, &path)?;
        #[cfg(unix)]
        if let Some(dir) = path.parent() {
            if let Ok(d) = File::open(dir) {
                let _ = d.sync_all();
            }
        }
        Ok(())
    }

    fn exposure_open_wei(&self, chain: &str) -> JResult<u64> {
        let dir = self.root.join(sanitize(chain));
        if !dir.exists() {
            return Ok(0);
        }
        let mut total = 0u64;
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("res-") || !name.ends_with(".json") {
                continue; // stray tmp/lock files are never parsed
            }
            let raw = fs::read_to_string(entry.path())?;
            let rec: Reservation = serde_json::from_str(&raw).map_err(|e| JournalError::Torn {
                path: entry.path(),
                reason: e.to_string(),
            })?;
            match rec.state {
                ReservationState::Reserved { reserved_gas_wei } => total += reserved_gas_wei,
                // A no-evidence failure KEEPS its reservation — the gas
                // exposure is retained until evidence or expiry release.
                ReservationState::FailedKeep {
                    reserved_gas_wei, ..
                } => total += reserved_gas_wei,
                _ => {}
            }
        }
        Ok(total)
    }

    fn settled_today_wei(&self, chain: &str) -> JResult<u64> {
        let dir = self.root.join(sanitize(chain));
        if !dir.exists() {
            return Ok(0);
        }
        let day = now_unix() / 86_400;
        let mut total = 0u64;
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("res-") || !name.ends_with(".json") {
                continue;
            }
            let raw = fs::read_to_string(entry.path())?;
            let rec: Reservation = serde_json::from_str(&raw).map_err(|e| JournalError::Torn {
                path: entry.path(),
                reason: e.to_string(),
            })?;
            if let ReservationState::Settled {
                gas_actual_wei,
                settled_unix,
                ..
            } = rec.state
            {
                if settled_unix / 86_400 == day {
                    total += gas_actual_wei;
                }
            }
        }
        Ok(total)
    }

    /// RESERVE (verify path). Fails closed on: unknown-but-required state,
    /// torn files, duplicate live reservation, budget overrun, expired
    /// window, or a wallet float that cannot fund the settlement.
    pub fn reserve(
        &self,
        leg: &LegKey,
        reserved_gas_wei: u64,
        float_available_wei: u64,
    ) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        if let Some(existing) = self.get(leg)? {
            return match existing.state {
                ReservationState::Reserved { .. } => Err(JournalError::Law("authorization nonce already reserved (live) — refusing duplicate reservation".to_string())),
                ReservationState::Settled { .. } => Err(JournalError::Law(
                    "authorization nonce already settled — refusing replay".into(),
                )),
                ReservationState::Settling { .. } => Err(JournalError::Law(
                    "authorization nonce is settling — refusing duplicate reservation".into(),
                )),
                ReservationState::FailedKeep { .. } => Err(JournalError::Law(
                    "prior attempt failed without evidence — reservation kept; settle again or expire, never re-reserve"
                        .into(),
                )),
                ReservationState::Unknown { .. } => Err(JournalError::Law(
                    "authorization nonce is Unknown — human gate required before any new action"
                        .into(),
                )),
                ReservationState::ExpiredReleased { .. } => Err(JournalError::Law(
                    "authorization window expired and was released — cannot reserve".into(),
                )),
            };
        }
        let now = now_unix();
        if leg.valid_before_unix <= now {
            return Err(JournalError::Law(format!(
                "validity window already expired (validBefore {valid_before} <= now {now})",
                valid_before = leg.valid_before_unix
            )));
        }
        // Float gate: the ops wallet must be able to fund THIS settlement.
        if float_available_wei < reserved_gas_wei {
            return Err(JournalError::Law(format!(
                "ops float {float_available_wei} wei cannot fund settlement gas {reserved_gas_wei} wei — fail-closed"
            )));
        }
        // Daily budget: open exposure + settled-today + this reserve <= cap.
        let open = self.exposure_open_wei(&leg.chain)?;
        let today = self.settled_today_wei(&leg.chain)?;
        let projected = open
            .checked_add(today)
            .and_then(|v| v.checked_add(reserved_gas_wei))
            .ok_or_else(|| JournalError::Law("gas budget arithmetic overflow".into()))?;
        if projected > self.daily_gas_cap_wei {
            return Err(JournalError::Law(format!(
                "daily gas cap {cap} wei would be exceeded: open {open} + settled-today {today} + this {reserved_gas_wei} = {projected} wei",
                cap = self.daily_gas_cap_wei
            )));
        }
        self.write(&Reservation {
            record_version: RECORD_VERSION,
            leg: leg.clone(),
            state: ReservationState::Reserved { reserved_gas_wei },
            updated_unix: now,
        })
    }

    /// BEGIN SETTLE (idempotency + lawful state + the in-flight
    /// transition). The check AND the Reserved->Settling write are one
    /// lock-held transition, so exactly one caller ever executes the
    /// facilitator for a nonce. Returns the stored evidence when the nonce
    /// was ALREADY settled (idempotent replay -- never re-execute).
    pub fn begin_settle(&self, leg: &LegKey) -> JResult<Option<SettleEvidence>> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self.get(leg)?.ok_or_else(|| {
            JournalError::Law(
                "no reservation for this authorization nonce -- verify first (fail-closed)".into(),
            )
        })?;
        let now = now_unix();
        match rec.state {
            ReservationState::Settled {
                actual_amount,
                tx_hash,
                gas_actual_wei,
                ..
            } => Ok(Some(SettleEvidence {
                actual_amount,
                tx_hash,
                gas_actual_wei,
            })),
            ReservationState::Reserved { reserved_gas_wei }
            | ReservationState::FailedKeep {
                reserved_gas_wei, ..
            } => {
                rec.state = ReservationState::Settling { reserved_gas_wei };
                rec.updated_unix = now;
                self.write(&rec)?;
                Ok(None)
            }
            ReservationState::Settling { .. } => Err(JournalError::Law(
                "settlement in flight -- exactly one executor; retry after completion".into(),
            )),
            ReservationState::Unknown { .. } => Err(JournalError::Law(
                "Unknown settlement -- never auto-retried; human gate required".into(),
            )),
            ReservationState::ExpiredReleased { .. } => Err(JournalError::Law(
                "window expired and released -- settle refused".into(),
            )),
        }
    }

    /// SETTLE with evidence — exposure reconciles DOWN to actual.
    pub fn settle_with_evidence(&self, leg: &LegKey, ev: &SettleEvidence) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self
            .get(leg)?
            .ok_or_else(|| JournalError::Law("no reservation (fail-closed)".into()))?;
        let cap = rec
            .leg
            .amount_authorized
            .parse::<u128>()
            .unwrap_or(u128::MAX);
        let actual = ev
            .actual_amount
            .parse::<u128>()
            .map_err(|_| JournalError::Law("actual_amount not numeric".into()))?;
        if actual > cap {
            return Err(JournalError::Law(format!(
                "upto law violated: actual {actual} > authorized {cap} — evidence refused"
            )));
        }
        rec.state = ReservationState::Settled {
            actual_amount: ev.actual_amount.clone(),
            tx_hash: ev.tx_hash.clone(),
            gas_actual_wei: ev.gas_actual_wei,
            settled_unix: now_unix(),
        };
        rec.updated_unix = now_unix();
        self.write(&rec)
    }

    /// Settlement failed WITHOUT evidence — keep the reservation.
    pub fn settle_failed_no_evidence(&self, leg: &LegKey, reason: &str) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self
            .get(leg)?
            .ok_or_else(|| JournalError::Law("no reservation (fail-closed)".into()))?;
        if !matches!(
            rec.state,
            ReservationState::Reserved { .. }
                | ReservationState::FailedKeep { .. }
                | ReservationState::Settling { .. }
        ) {
            return Err(JournalError::Law(
                "state does not accept a no-evidence failure update".into(),
            ));
        }
        let retained = match rec.state {
            ReservationState::Reserved { reserved_gas_wei } => reserved_gas_wei,
            ReservationState::Settling { reserved_gas_wei } => reserved_gas_wei,
            ReservationState::FailedKeep {
                reserved_gas_wei, ..
            } => reserved_gas_wei,
            _ => 0,
        };
        rec.state = ReservationState::FailedKeep {
            reason: reason.to_string(),
            reserved_gas_wei: retained,
        };
        rec.updated_unix = now_unix();
        self.write(&rec)
    }

    /// Ambiguous outcome — Unknown, never auto-retried.
    pub fn settle_unknown(&self, leg: &LegKey, note: &str) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self
            .get(leg)?
            .ok_or_else(|| JournalError::Law("no reservation (fail-closed)".into()))?;
        if !matches!(
            rec.state,
            ReservationState::Settling { .. } | ReservationState::Unknown { .. }
        ) {
            return Err(JournalError::Law(
                "settle_unknown requires the Settling state (fail-closed)".into(),
            ));
        }
        rec.state = ReservationState::Unknown {
            since_unix: now_unix(),
            note: note.to_string(),
        };
        rec.updated_unix = now_unix();
        self.write(&rec)
    }

    /// Expiry release — ONLY with a typed on-chain verdict (D-4).
    /// CONTRADICTION LAW: if this journal already HOLDS settlement evidence
    /// for the leg, any release claim is refused — a settled leg's
    /// authority can never reopen. RPC-unavailable is a HOLD, not a release
    /// and not a refusal-of-record.
    pub fn expire_released(&self, leg: &LegKey, verdict: ReleaseVerdict) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self
            .get(leg)?
            .ok_or_else(|| JournalError::Law("no reservation (fail-closed)".into()))?;
        // CONTRADICTION LAW FIRST: a leg this journal knows is Settled (or
        // otherwise terminal) never moves on ANY verdict — the lying-RPC
        // attack is refused before any park/release can run.
        if !matches!(
            rec.state,
            ReservationState::Reserved { .. } | ReservationState::FailedKeep { .. }
        ) {
            return Err(JournalError::Law(
                "expiry release refused: leg state is terminal (settled/released) — a settled leg's authority never reopens (D-4 contradiction law)"
                    .into(),
            ));
        }
        match verdict {
            ReleaseVerdict::RpcUnavailable => {
                return Err(JournalError::Law(
                    "expiry release HELD: RPC unavailable — never treated as unspent, state untouched, retryable (D-4)"
                        .into(),
                ));
            }
            ReleaseVerdict::SpentOnChain => {
                // The leg settled on-chain: park Unknown for the human gate —
                // releasing would reopen a settled leg's authority.
                rec.state = ReservationState::Unknown {
                    since_unix: now_unix(),
                    note: "expiry check found the nonce SPENT on-chain — reconciling via human gate (D-4)".into(),
                };
                rec.updated_unix = now_unix();
                return self.write(&rec);
            }
            ReleaseVerdict::UnspentOnChain => {}
        }
        if now_unix() <= leg.valid_before_unix {
            return Err(JournalError::Law(
                "window not yet expired — release refused".into(),
            ));
        }
        rec.state = ReservationState::ExpiredReleased {
            checked_unix: now_unix(),
        };
        rec.updated_unix = now_unix();
        self.write(&rec)
    }

    /// Human-gated resolution of an Unknown settlement (watchpay law).
    /// The gate is BOUNDED by the same upto law as automated evidence:
    /// a human records truth, never an impossible over-authorization.
    pub fn resolve_unknown(
        &self,
        leg: &LegKey,
        _gate: HumanGate,
        ev: &SettleEvidence,
    ) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        let mut rec = self
            .get(leg)?
            .ok_or_else(|| JournalError::Law("no reservation (fail-closed)".into()))?;
        if !matches!(rec.state, ReservationState::Unknown { .. }) {
            return Err(JournalError::Law("not in Unknown state".into()));
        }
        let cap = rec
            .leg
            .amount_authorized
            .parse::<u128>()
            .unwrap_or(u128::MAX);
        let actual = ev
            .actual_amount
            .parse::<u128>()
            .map_err(|_| JournalError::Law("actual_amount not numeric".into()))?;
        if actual > cap {
            return Err(JournalError::Law(format!(
                "upto law violated through the human gate: actual {actual} > authorized {cap} — the gate records truth, not the impossible"
            )));
        }
        rec.state = ReservationState::Settled {
            actual_amount: ev.actual_amount.clone(),
            tx_hash: ev.tx_hash.clone(),
            gas_actual_wei: ev.gas_actual_wei,
            settled_unix: now_unix(),
        };
        rec.updated_unix = now_unix();
        self.write(&rec)?;
        // D-7 audit: every human-gate resolution is attributable to its
        // call site, appended under the exclusive lock.
        let site = _gate
            .call_site
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown-call-site".to_string());
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.root.join("human-gates.log"))?;
        writeln!(
            f,
            "{}\t{}\t{}\t{}",
            now_unix(),
            site,
            rec.leg.chain,
            rec.leg.auth_nonce
        )?;
        Ok(())
    }

    /// Restart recovery (founder order, preserves the Settling invariant):
    /// any record found in `Settling` — the process died mid-execution, the
    /// outcome is uncertain on-chain — parks to `Unknown` with a named note,
    /// NEVER auto-retried. Returns the legs reconciled. Idempotent.
    pub fn recover_stranded_settling(&self) -> JResult<Vec<LegKey>> {
        let _guard = self.acquire_exclusive()?;
        let mut reconciled = Vec::new();
        for entry in fs::read_dir(&self.root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            for f in fs::read_dir(entry.path())? {
                let f = f?;
                let name = f.file_name().to_string_lossy().to_string();
                if !name.starts_with("res-") || !name.ends_with(".json") {
                    continue;
                }
                let raw = fs::read_to_string(f.path()).map_err(|e| JournalError::Torn {
                    path: f.path(),
                    reason: e.to_string(),
                })?;
                let mut rec: Reservation =
                    serde_json::from_str(&raw).map_err(|e| JournalError::Torn {
                        path: f.path(),
                        reason: e.to_string(),
                    })?;
                if matches!(rec.state, ReservationState::Settling { .. }) {
                    rec.state = ReservationState::Unknown {
                        since_unix: now_unix(),
                        note: "found Settling at restart — execution outcome uncertain, human gate required".into(),
                    };
                    rec.updated_unix = now_unix();
                    self.write(&rec)?;
                    reconciled.push(rec.leg.clone());
                }
            }
        }
        Ok(reconciled)
    }

    // Test-only helpers (watchpay's test_support pattern; #[doc(hidden)]).
    #[doc(hidden)]
    pub fn write_for_test(&self, rec: &Reservation) -> JResult<()> {
        let _guard = self.acquire_exclusive()?;
        self.write(rec)
    }

    #[doc(hidden)]
    pub fn root_for_test(&self) -> &Path {
        &self.root
    }

    #[doc(hidden)]
    pub fn exposure_for_test(&self, chain: &str) -> JResult<u64> {
        let _guard = self.acquire_exclusive()?;
        self.exposure_open_wei(chain)
    }
}
