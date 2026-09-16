//! The LIVE NWC adapter surface (R13): typed errors, the transport
//! trait, and the transport-driven LN rail on the ONE unified ledger.
//!
//! MOCK-FIRST LAW (founder order): every law is proven against
//! `MockNwcTransport` before any live wire. The live transport lives
//! behind the `live-nwc` cargo feature; LIVE SENDS ARE GATED OFF this
//! round (`send_enabled` defaults false — a named refusal, the estate
//! gate pattern); authorized live use is read-only (get_info /
//! get_balance) via the env-gated test. No secret ever enters the tree.
//!
//! R8 laws preserved: payment_hash idempotency (the unified ledger's
//! never-re-open), dual spend caps (the reservation window here; the
//! Hub's native per-app budgets ride the connection recipe when
//! provisioned), fee evidence (fees_paid optional; > fee_limit =
//! impossible, refused), typed NWC errors (the full NIP-47 code set),
//! first-party relay (the connection's relay is ours), and
//! UNKNOWN-never-auto-retry.

use crate::fee::{FeeClass, FeeReservation};
use crate::ledger::{LedgerError, LifecycleState, RailLedger};
use crate::units::{FeeEvidence, MilliSatoshi};

/// Typed NIP-47 errors — the full pinned code set, method-specific
/// ones included. The mapping table (R8 rule 5): transport-ambiguous
/// → Unknown; RATE_LIMITED/INTERNAL → retryable transport, state
/// untouched; QUOTA_EXCEEDED/RESTRICTED → our cap refusals;
/// UNAUTHORIZED → connection ceremony breach (RED class);
/// INSUFFICIENT_BALANCE → liquidity YELLOW ladder (channel ops are
/// organ-signed, not this adapter).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum NwcError {
    #[error("NWC RATE_LIMITED (transport class — payment state untouched)")]
    RateLimited,
    #[error("NWC NOT_IMPLEMENTED: {0}")]
    NotImplemented(String),
    #[error("NWC INSUFFICIENT_BALANCE (liquidity YELLOW — channel ops are organ-signed)")]
    InsufficientBalance,
    #[error("NWC QUOTA_EXCEEDED (Hub native budget hit — maps to our cap refusal)")]
    QuotaExceeded,
    #[error("NWC RESTRICTED (method not in connection scope — maps to our cap refusal)")]
    Restricted,
    #[error("NWC UNAUTHORIZED (connection ceremony breach — RED class)")]
    Unauthorized,
    #[error("NWC INTERNAL (transport class — payment state untouched)")]
    Internal,
    #[error("NWC UNSUPPORTED_ENCRYPTION (NIP-44 v2 required)")]
    UnsupportedEncryption,
    #[error("NWC PAYMENT_FAILED: {0}")]
    PaymentFailed(String),
    #[error("NWC NOT_FOUND")]
    NotFound,
    #[error("NWC OTHER: {0}")]
    Other(String),
    /// Transport-ambiguous: request MAY or MAY NOT have reached the
    /// wallet — the payment goes UNKNOWN (human gate), never Failed.
    #[error("NWC TRANSPORT_AMBIGUOUS: {0} — payment marked UNKNOWN, never auto-retried")]
    TransportAmbiguous(String),
}

impl NwcError {
    /// Parse the pinned NIP-47 `error.code` vocabulary.
    pub fn from_code(code: &str, message: impl Into<String>) -> NwcError {
        let msg = message.into();
        match code {
            "RATE_LIMITED" => NwcError::RateLimited,
            "NOT_IMPLEMENTED" => NwcError::NotImplemented(msg),
            "INSUFFICIENT_BALANCE" => NwcError::InsufficientBalance,
            "QUOTA_EXCEEDED" => NwcError::QuotaExceeded,
            "RESTRICTED" => NwcError::Restricted,
            "UNAUTHORIZED" => NwcError::Unauthorized,
            "INTERNAL" => NwcError::Internal,
            "UNSUPPORTED_ENCRYPTION" => NwcError::UnsupportedEncryption,
            "PAYMENT_FAILED" => NwcError::PaymentFailed(msg),
            "NOT_FOUND" => NwcError::NotFound,
            _ => NwcError::Other(msg),
        }
    }
}

/// One NIP-47 method call, transport-agnostic.
pub trait NwcTransport {
    /// `method` is a NIP-47 method name; `params` its JSON params.
    /// Transport-ambiguous failures return
    /// [`NwcError::TransportAmbiguous`] (never silently Ok).
    fn request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, NwcError>;
}

/// The transport-driven LN rail: the R8 contract on the ONE unified
/// ledger. Construct with ANY transport (mock or live); the laws are
/// here, once.
pub struct NwcRail<T: NwcTransport> {
    transport: T,
    ledger: RailLedger<crate::ln::PaymentHash>,
    fee_limit_msat: MilliSatoshi,
    /// LU-8.1 booking record per payment.
    fee_evidence: std::collections::HashMap<crate::ln::PaymentHash, FeeEvidence>,
    /// LIVE SEND GATE: false this round — a named refusal, flipped
    /// only by explicit authorization.
    send_enabled: bool,
}

impl<T: NwcTransport> NwcRail<T> {
    pub fn new(
        transport: T,
        window_fee_ceiling_msat: MilliSatoshi,
        fee_limit_msat: MilliSatoshi,
        now_unix: u64,
    ) -> Self {
        NwcRail {
            transport,
            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),
            fee_limit_msat,
            fee_evidence: std::collections::HashMap::new(),
            send_enabled: false,
        }
    }

    /// Explicit authorization to enable sends (off by default this slice).
    pub fn enable_sends(&mut self) {
        self.send_enabled = true;
    }

    pub fn transport_mut(&mut self) -> &mut T {
        &mut self.transport
    }

    // ── read-only ops (authorized live this round) ─────────────────

    pub fn get_info(&mut self) -> Result<serde_json::Value, NwcError> {
        self.transport.request("get_info", serde_json::json!({}))
    }

    pub fn get_balance_msat(&mut self) -> Result<u64, NwcError> {
        let v = self
            .transport
            .request("get_balance", serde_json::json!({}))?;
        v.get("balance")
            .and_then(|b| b.as_u64())
            .ok_or_else(|| NwcError::Other("balance field missing/not u64".into()))
    }

    // ── the pay path (mock-tested; gated live) ─────────────────────

    /// pay_invoice under the R8 laws. `invoice` = bolt11 string; the
    /// payment_hash is taken from `lookup`/make_invoice context by the
    /// caller (the bolt11 string is NOT parsed here — the mock/live
    /// transport supplies hash-bearing results; see tests).
    pub fn pay(
        &mut self,
        payment_hash: crate::ln::PaymentHash,
        invoice: &str,
        expires_unix: u64,
        now_unix: u64,
    ) -> Result<LifecycleState, LedgerError> {
        if !self.send_enabled {
            return Err(LedgerError::Refusal {
                field: "send_enabled",
                reason: "LIVE SENDS DISABLED this slice (founder order R13) — mock transports enable_sends() in tests; live sends need explicit authorization".into(),
            });
        }
        // idempotency-by-identity (R8): known hash NEVER re-opens
        if self.ledger.state(&payment_hash).is_some() {
            return Err(LedgerError::Refusal {
                field: "payment_hash",
                reason: "duplicate intent — route to lookup/reconcile, never a second payment"
                    .into(),
            });
        }
        // expiry blocks NEW intents, never old evidence
        if expires_unix <= now_unix {
            return Err(LedgerError::Refusal {
                field: "expires_unix",
                reason: format!(
                    "invoice expired at {expires_unix} (now {now_unix}) — new intents refused"
                ),
            });
        }
        // reservation BEFORE send (dual caps: this window is binding;
        // the Hub's native budget mirrors it on the connection)
        self.ledger.open_intent(
            payment_hash,
            FeeReservation {
                class: FeeClass::LnroutingMsat,
                worst_case: self.fee_limit_msat.to_atto(),
            },
            expires_unix,
        )?;
        match self
            .transport
            .request("pay_invoice", serde_json::json!({ "invoice": invoice }))
        {
            Ok(result) => {
                self.ledger
                    .transition(&payment_hash, LifecycleState::InFlight)?;
                // fees_paid OPTIONAL (NIP-47) — LU-8.1: ABSENT is not
                // zero. No testimony -> exposure bounded at the limit
                // (AbsentBounded, reservation retained); testimony ->
                // possibility-checked then reconciled DOWN (Paid).
                let (fees_msat, evidence) = match result.get("fees_paid").and_then(|f| f.as_u64()) {
                    Some(fees) => {
                        if fees > self.fee_limit_msat.0 {
                            return Err(LedgerError::Refusal {
                                field: "fees_paid",
                                reason: format!(
                                    "impossible fee evidence: {fees} msat exceeds fee_limit {} msat (field=fees_paid unit=msat, R10-P3)",
                                    self.fee_limit_msat.0
                                ),
                            });
                        }
                        (MilliSatoshi(fees), FeeEvidence::Paid(fees))
                    }
                    None => (
                        self.fee_limit_msat,
                        FeeEvidence::AbsentBounded(self.fee_limit_msat.0),
                    ),
                };
                let _preimage =
                    result
                        .get("preimage")
                        .and_then(|p| p.as_str())
                        .ok_or_else(|| LedgerError::Refusal {
                            field: "preimage",
                            reason:
                                "settlement result lacks the preimage — incomplete evidence (R8)"
                                    .into(),
                        })?;
                let out = self.ledger.reconcile_with_evidence(
                    &payment_hash,
                    fees_msat.to_atto(),
                    true,
                )?;
                self.fee_evidence.insert(payment_hash, evidence);
                Ok(out.state)
            }
            Err(NwcError::TransportAmbiguous(note)) => {
                // submitted-then-ambiguous: InFlight → Unknown, human gate
                self.ledger
                    .transition(&payment_hash, LifecycleState::InFlight)?;
                self.ledger
                    .mark_unknown(&payment_hash, &format!("NWC transport ambiguous: {note}"))?;
                Ok(LifecycleState::Unknown)
            }
            Err(NwcError::PaymentFailed(why)) => {
                // LN pays NOTHING on failure — Failed, no fee evidence ever
                self.ledger
                    .transition(&payment_hash, LifecycleState::InFlight)?;
                self.ledger
                    .transition(&payment_hash, LifecycleState::Failed)
                    .map_err(|e| LedgerError::Refusal {
                        field: "PAYMENT_FAILED",
                        reason: format!("{why} ({e})"),
                    })?;
                Ok(LifecycleState::Failed)
            }
            Err(e) => {
                // typed non-ambiguous errors: state UNTOUCHED (rate
                // limited / quota / restricted leave the intent lawful)
                Err(LedgerError::Refusal {
                    field: "nwc_error",
                    reason: format!(
                        "NWC refused without payment effect: {e} — intent remains open, no retry"
                    ),
                })
            }
        }
    }

    /// lookup_invoice → typed result (NOT_FOUND typed; state mapping
    /// is the caller's reconcile concern).
    pub fn lookup(
        &mut self,
        payment_hash: &crate::ln::PaymentHash,
    ) -> Result<serde_json::Value, NwcError> {
        self.transport.request(
            "lookup_invoice",
            serde_json::json!({ "payment_hash": hex::encode(payment_hash.0) }),
        )
    }

    pub fn state(&self, id: &crate::ln::PaymentHash) -> Option<LifecycleState> {
        self.ledger.state(id)
    }
    /// LU-8.1: how fee evidence was BOOKED (absent ≠ zero).
    pub fn fee_evidence(&self, id: &crate::ln::PaymentHash) -> Option<FeeEvidence> {
        self.fee_evidence.get(id).copied()
    }
    pub fn reserved_total_msat(&self) -> u64 {
        self.ledger
            .reserved_total()
            .to_decimal()
            .parse()
            .unwrap_or(0)
    }
}
