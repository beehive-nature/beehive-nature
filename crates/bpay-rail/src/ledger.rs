//! bpay-rail — the unified rail ledger (offline skeleton).
//!
//! ONE lifecycle state machine + ONE fee vocabulary + the whole law
//! stack, implemented once; rails plug in as adapters supplying
//! identity, evidence and fees (R9 design, built per the R11 order:
//! EVM/watchpay is the first concrete member; LN is the second adapter
//! CONTRACT over a MOCK NWC-shaped client — no network anywhere).
//!
//! EVIDENCE BASE (all pinned in the z2.b recon dispatches R1–R11):
//! - watchpay: 65 offline tests + two adversarial review rounds — the
//!   proven EVM envelope; this crate COMPOSES it, never rewrites it.
//! - Arbitrum fee = GAS-FOLDED (docs.arbitrum.io, R6): a single
//!   gas×price product bounds total spend.
//! - Base/OP-stack fee = SURCHARGE (docs.optimism.io, R11):
//!   `totalFee = operatorFee + gasUsed*(baseFee+priorityFee) + l1Fee`,
//!   and "It is currently not possible to limit the maximum L1 Data
//!   Fee" — the L1 term sits OUTSIDE the EIP-1559 bid. A Base-bound
//!   EVM rail MUST declare an L1Surcharge bound (compressed-size ×
//!   L1-price ceilings); watchpay's single-product ceiling does NOT
//!   bound Base spend. This is the Base gate.
//! - NIP-47 notifications (nwc/02.md, R11): payment_received/payment_
//!   sent carry the transaction object; kinds 23197 (NIP-44)/23196;
//!   p-tag subscription; discovery via info/get_info.
//!
//! LAWS (identical on every rail — the unified stack):
//! idempotency-by-identity · forward-only lifecycle · terminal states
//! immutable · worst-case fee reservation budget · evidence validated
//! for POSSIBILITY before any mutation · expiry blocks NEW intents,
//! never old evidence · unknown never auto-retries (human gate) ·
//! abort only from non-terminal states · every refusal names its field.

use std::collections::HashMap;
use std::hash::Hash;

use crate::fee::FeeReservation;
use watchpay::types::Atto;

/// The common lifecycle (R9). Rail-native pre-states fold in: EVM's
/// `Signed` maps to [`LifecycleState::Staged`]; LN goes Intent →
/// InFlight directly (Staged skipped by design).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleState {
    /// Attempt identity + nonce/fee reservation persisted BEFORE send.
    Intent,
    /// A fully-validated sendable artifact exists but is not submitted
    /// (EVM: signed tx; LN: none by design).
    Staged,
    /// Submitted; no result yet (EVM mempool / LN in-flight HTLC).
    InFlight,
    /// Terminal success — evidence-validated per rail.
    Settled,
    /// Terminal failure (rail semantics differ: EVM reverts PAY GAS;
    /// LN failed parts owe NOTHING — see FeeClass::pays_on_failure).
    Failed,
    /// Result unavailable/ambiguous — HUMAN GATE ONLY, never auto-retry.
    Unknown,
}

impl LifecycleState {
    pub fn terminal(&self) -> bool {
        matches!(self, LifecycleState::Settled | LifecycleState::Failed)
    }
    pub fn kind(&self) -> &'static str {
        match self {
            LifecycleState::Intent => "intent",
            LifecycleState::Staged => "staged",
            LifecycleState::InFlight => "inflight",
            LifecycleState::Unknown => "unknown",
            LifecycleState::Settled => "settled",
            LifecycleState::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RailOutcome {
    pub state: LifecycleState,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LedgerError {
    Refusal { field: &'static str, reason: String },
}

impl std::fmt::Display for LedgerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LedgerError::Refusal { field, reason } => {
                write!(f, "field `{field}`: {reason}")
            }
        }
    }
}

/// The unified rail ledger: ONE implementation of the whole law stack,
/// generic over the rail's payment identity. Adapters drive it; rails
/// never reimplement the laws.
pub struct RailLedger<Id: Eq + Hash + Clone> {
    states: HashMap<Id, LifecycleState>,
    reservations: HashMap<Id, FeeReservation>,
    /// Plan-wide (window) budget ceiling for FEE reservations.
    window_fee_ceiling: Atto,
    reserved_total: Atto,
    /// Injected clock for deterministic expiry tests.
    now_unix: u64,
    /// Expiry per id (blocks NEW intents only; adapters enforce).
    expires_unix: HashMap<Id, u64>,
    notes: HashMap<Id, String>,
}

impl<Id: Eq + Hash + Clone> RailLedger<Id> {
    pub fn new(window_fee_ceiling: Atto, now_unix: u64) -> Self {
        RailLedger {
            states: HashMap::new(),
            reservations: HashMap::new(),
            window_fee_ceiling,
            reserved_total: Atto::ZERO,
            now_unix,
            expires_unix: HashMap::new(),
            notes: HashMap::new(),
        }
    }

    fn refuse(field: &'static str, reason: impl Into<String>) -> LedgerError {
        LedgerError::Refusal {
            field,
            reason: reason.into(),
        }
    }

    /// Idempotency-by-identity: a known id NEVER opens a second intent.
    pub fn open_intent(
        &mut self,
        id: Id,
        reservation: FeeReservation,
        expires_unix: u64,
    ) -> Result<(), LedgerError> {
        if self.states.contains_key(&id) {
            return Err(Self::refuse(
                "payment_id",
                "duplicate intent for an existing payment identity — route to lookup/reconcile, never re-open",
            ));
        }
        if expires_unix <= self.now_unix {
            return Err(Self::refuse(
                "expires_unix",
                format!("expiry {} is not in the future (now {}) — new intents on expired payment material are refused", expires_unix, self.now_unix),
            ));
        }
        let projected = self
            .reserved_total
            .checked_add(reservation.worst_case)
            .ok_or_else(|| Self::refuse("reserved_total", "reservation overflow"))?;
        if projected > self.window_fee_ceiling {
            return Err(Self::refuse(
                "window_fee_ceiling",
                format!(
                    "fee budget exhausted: reserved {} + this worst-case {} = {} exceeds window ceiling {} (R1 law: failed calls free nothing without evidence)",
                    self.reserved_total, reservation.worst_case, projected, self.window_fee_ceiling
                ),
            ));
        }
        self.states.insert(id.clone(), LifecycleState::Intent);
        self.expires_unix.insert(id.clone(), expires_unix);
        self.reserved_total = projected;
        self.reservations.insert(id, reservation);
        Ok(())
    }

    fn current(&self, id: &Id) -> Result<LifecycleState, LedgerError> {
        self.states
            .get(id)
            .copied()
            .ok_or_else(|| Self::refuse("payment_id", "no such payment identity"))
    }

    /// Forward-only transition; terminal states immutable.
    pub fn transition(&mut self, id: &Id, to: LifecycleState) -> Result<(), LedgerError> {
        let from = self.current(id)?;
        let lawful = matches!(
            (from, to),
            (LifecycleState::Intent, LifecycleState::Staged)
                | (LifecycleState::Intent, LifecycleState::InFlight)
                | (LifecycleState::Staged, LifecycleState::InFlight)
                | (LifecycleState::InFlight, LifecycleState::Settled)
                | (LifecycleState::InFlight, LifecycleState::Failed)
                | (LifecycleState::InFlight, LifecycleState::Unknown)
                // unknown resolves ONLY forward to terminal
                | (LifecycleState::Unknown, LifecycleState::Settled)
                | (LifecycleState::Unknown, LifecycleState::Failed)
                // abort: any non-terminal, non-inflight-evidence state
                | (LifecycleState::Intent, LifecycleState::Failed)
                | (LifecycleState::Staged, LifecycleState::Failed)
        );
        if !lawful {
            return Err(Self::refuse(
                "lifecycle",
                format!(
                    "unlawful transition {} -> {} (forward-only; terminal states immutable; unknown resolves only via the human gate)",
                    from.kind(),
                    to.kind()
                ),
            ));
        }
        self.states.insert(id.clone(), to);
        Ok(())
    }

    /// Evidence-bearing reconciliation: validates fee evidence for
    /// POSSIBILITY before mutating (the R2 law): fee_paid above the
    /// reserved worst case is impossible and refuses the whole record.
    pub fn reconcile_with_evidence(
        &mut self,
        id: &Id,
        fee_paid: Atto,
        evidence_valid: bool,
    ) -> Result<RailOutcome, LedgerError> {
        let from = self.current(id)?;
        if !evidence_valid {
            return Err(Self::refuse(
                "evidence",
                "evidence failed rail-level validation — refusing before any state mutation",
            ));
        }
        // Terminal immutability holds on the evidence path too (found by
        // the R10 harness: reconciling a Failed payment settled it).
        if !matches!(from, LifecycleState::InFlight | LifecycleState::Unknown) {
            return Err(Self::refuse(
                "lifecycle",
                format!(
                    "evidence for a payment in state {} — only in-flight or unknown payments reconcile (terminal states immutable)",
                    from.kind()
                ),
            ));
        }
        let reservation = self
            .reservations
            .get(id)
            .ok_or_else(|| Self::refuse("payment_id", "no reservation on record"))?;
        if fee_paid > reservation.worst_case {
            return Err(Self::refuse(
                "fee_paid",
                format!(
                    "impossible fee evidence: paid {} exceeds the declared worst case {} (R2 law: clamping is not validation)",
                    fee_paid, reservation.worst_case
                ),
            ));
        }
        // Reconcile the reservation DOWN to actuals (never up).
        self.reserved_total = match self
            .reserved_total
            .0
            .checked_sub(reservation.worst_case.0)
            .map(Atto)
            .and_then(|r| r.0.checked_add(fee_paid.0).map(Atto))
        {
            Some(v) => v,
            None => {
                return Err(Self::refuse(
                    "reserved_total",
                    "reconcile arithmetic underflow",
                ))
            }
        };
        self.reservations.get_mut(id).expect("present").worst_case = fee_paid;
        let to = LifecycleState::Settled;
        self.states.insert(id.clone(), to);
        Ok(RailOutcome {
            state: to,
            note: format!("settled from {}", from.kind()),
        })
    }

    /// Mark Unknown — never auto-retry; only the human gate resolves.
    pub fn mark_unknown(&mut self, id: &Id, note: &str) -> Result<(), LedgerError> {
        self.transition(id, LifecycleState::Unknown)?;
        self.notes.insert(id.clone(), note.to_string());
        Ok(())
    }

    /// Expiry blocks NEW intents, never old evidence: an expired id in
    /// a non-terminal state still reconciles.
    pub fn expiry_blocks_new_only(&self, expires_unix: u64) -> Result<(), LedgerError> {
        if expires_unix <= self.now_unix {
            Err(Self::refuse(
                "expires_unix",
                "expired material — new intents refused, existing evidence still reconciles",
            ))
        } else {
            Ok(())
        }
    }

    pub fn state(&self, id: &Id) -> Option<LifecycleState> {
        self.states.get(id).copied()
    }
    pub fn reserved_total(&self) -> Atto {
        self.reserved_total
    }
    pub fn reservation(&self, id: &Id) -> Option<&FeeReservation> {
        self.reservations.get(id)
    }
}
