//! LN adapter CONTRACT (R8) over a MOCK NWC-shaped client.
//!
//! MOCK LAW: `LnMockClient` is synthetic, in-memory, and named as a
//! mock in every path — no network, no relay, no node. It exists so
//! the R10 harness can drive the unified ledger through LN-shaped
//! identity/evidence/expiry semantics (payment_hash idempotency,
//! preimage settlement, fees_paid optionality, HTLC-timeout failure,
//! invoice expiry) exactly as NIP-47 pins them (nips/47.md + nwc
//! 02.md/05.md, fetched R8/R11).

use crate::fee::{FeeClass, FeeReservation};
use crate::ledger::{LedgerError, LifecycleState, RailLedger};
use crate::units::{FeeEvidence, MilliSatoshi};

/// NIP-47 state vocabulary (pinned): pending | settled | accepted
/// (hold) | expired (invoices) | failed (payments).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NwcState {
    Pending,
    Settled,
    Accepted,
    Expired,
    Failed,
}

/// The LN payment identity: the payment hash — NATIVE idempotency
/// (R7/R8), the deliberate contrast with EVM's constructed
/// (payer, nonce)+tx_hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PaymentHash(pub [u8; 32]);

#[derive(Debug, Clone)]
pub struct LnInvoice {
    pub payment_hash: PaymentHash,
    pub amount_msat: MilliSatoshi,
    pub created_at: u64,
    pub expires_at: u64,
    pub bolt11: String,
}

#[derive(Debug, Clone)]
pub struct LnSettlement {
    /// The payment secret — the strongest settlement evidence class
    /// (knowledge only the payee could have released).
    pub preimage: [u8; 32],
    /// NIP-47 `fees_paid` is OPTIONAL — absence is lawful (reservation
    /// stands); presence must satisfy possibility (≤ fee_limit).
    pub fees_paid_msat: Option<MilliSatoshi>,
}

/// MOCK NWC client. Every method mirrors a NIP-47 shape so the adapter
/// contract is testable without a node.
pub struct LnMockClient {
    now_unix: u64,
    /// payment_hash -> nwc state
    states: std::collections::HashMap<PaymentHash, NwcState>,
    settlements: std::collections::HashMap<PaymentHash, LnSettlement>,
    /// Fail-the-next-pay switch (harness injects transport outage).
    pub outage_next_pay: bool,
}

impl LnMockClient {
    pub fn new(now_unix: u64) -> Self {
        LnMockClient {
            now_unix,
            states: std::collections::HashMap::new(),
            settlements: std::collections::HashMap::new(),
            outage_next_pay: false,
        }
    }

    /// make_invoice (NIP-47): expiry REQUIRED by our adapter law.
    pub fn make_invoice(&mut self, amount_msat: MilliSatoshi, expiry_secs: u64) -> LnInvoice {
        let mut hash = [0u8; 32];
        hash[0] = self.states.len() as u8 + 1;
        let id = PaymentHash(hash);
        let inv = LnInvoice {
            payment_hash: id,
            amount_msat,
            created_at: self.now_unix,
            expires_at: self.now_unix + expiry_secs,
            bolt11: format!("lnbc-mock-{}", hex::encode(hash)),
        };
        self.states.insert(id, NwcState::Pending);
        inv
    }

    /// pay_invoice: refuses an EXPIRED invoice pre-send (our law on
    /// top of the spec); an injected outage yields an UNKNOWN result
    /// class, never Failed (transport ≠ payment failure).
    pub fn pay(
        &mut self,
        invoice: &LnInvoice,
        fee_limit_msat: MilliSatoshi,
    ) -> Result<PaymentHash, LnMockError> {
        if invoice.expires_at <= self.now_unix {
            return Err(LnMockError::Refused {
                field: "expires_at",
                reason: format!(
                    "invoice expired at {} (now {}) — pre-send refusal (R8 law)",
                    invoice.expires_at, self.now_unix
                ),
            });
        }
        if self.outage_next_pay {
            self.outage_next_pay = false;
            return Err(LnMockError::TransportUnknown);
        }
        // Settle immediately with an OPTIONAL fee below the limit.
        let fees = Some(MilliSatoshi(fee_limit_msat.0 / 4));
        let mut preimage = invoice.payment_hash.0;
        preimage[31] ^= 0x5a;
        self.states.insert(invoice.payment_hash, NwcState::Settled);
        self.settlements.insert(
            invoice.payment_hash,
            LnSettlement {
                preimage,
                fees_paid_msat: fees,
            },
        );
        Ok(invoice.payment_hash)
    }

    /// HTLC-timeout failure injection (surfaces as Failed, never a fee).
    pub fn inject_htlc_timeout(&mut self, id: PaymentHash) {
        self.states.insert(id, NwcState::Failed);
    }

    pub fn lookup(&self, id: PaymentHash) -> Option<(NwcState, Option<&LnSettlement>)> {
        self.states
            .get(&id)
            .map(|s| (*s, self.settlements.get(&id)))
    }
}

#[derive(Debug, Clone)]
pub enum LnMockError {
    Refused {
        field: &'static str,
        reason: String,
    },
    /// Transport-level ambiguity -> Unknown, human gate.
    TransportUnknown,
}

/// The LN rail adapter (CONTRACT skeleton): the unified ledger with
/// LN-shaped identity, evidence and fee semantics.
pub struct LnRailAdapter {
    pub client: LnMockClient,
    /// LU-8.1 booking record: how fee evidence was booked per payment.
    fee_evidence: std::collections::HashMap<PaymentHash, FeeEvidence>,
    ledger: RailLedger<PaymentHash>,
    fee_limit_msat: MilliSatoshi,
}

pub const MSAT_IN_SATS: u64 = 1_000;

impl LnRailAdapter {
    pub fn new(
        window_fee_ceiling_msat: MilliSatoshi,
        fee_limit_msat: MilliSatoshi,
        now_unix: u64,
    ) -> Self {
        LnRailAdapter {
            client: LnMockClient::new(now_unix),
            // LU-7.2: the ONE named conversion site.
            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),
            fee_evidence: std::collections::HashMap::new(),
            fee_limit_msat,
        }
    }

    /// pay: idempotent by payment_hash (duplicate → lookup route),
    /// intent persisted with fee reservation BEFORE send (window law).
    pub fn pay(&mut self, invoice: &LnInvoice) -> Result<LifecycleState, LedgerError> {
        // Idempotency-by-identity: known hash NEVER re-opens.
        if self.ledger.state(&invoice.payment_hash).is_some() {
            return Err(LedgerError::Refusal {
                field: "payment_hash",
                reason:
                    "duplicate intent — route to lookup/reconcile, never a second payment (R8 law)"
                        .into(),
            });
        }
        if invoice.expires_at <= self.ledger_now() {
            return Err(LedgerError::Refusal {
                field: "expires_at",
                reason: format!(
                    "invoice expired at {} — new intents refused (expiry blocks new, never old evidence)",
                    invoice.expires_at
                ),
            });
        }
        self.ledger.open_intent(
            invoice.payment_hash,
            FeeReservation {
                class: FeeClass::LnroutingMsat,
                worst_case: self.fee_limit_msat.to_atto(),
            },
            invoice.expires_at,
        )?;
        match self.client.pay(invoice, self.fee_limit_msat) {
            Ok(_) => {
                self.ledger
                    .transition(&invoice.payment_hash, LifecycleState::InFlight)?;
                // Mock settles immediately; reconcile with evidence.
                let (state, settlement) =
                    self.client.lookup(invoice.payment_hash).ok_or_else(|| {
                        LedgerError::Refusal {
                            field: "payment_hash",
                            reason: "payment vanished from the mock node".into(),
                        }
                    })?;
                if state == NwcState::Settled {
                    let s = settlement.cloned().expect("settled carries settlement");
                    self.reconcile(invoice.payment_hash, s.fees_paid_msat, &s.preimage)
                } else {
                    Ok(LifecycleState::InFlight)
                }
            }
            Err(LnMockError::TransportUnknown) => {
                // submission was attempted: stage in-flight, THEN unknown
                // (the ledger lawfully refuses Intent -> Unknown)
                self.ledger
                    .transition(&invoice.payment_hash, LifecycleState::InFlight)?;
                self.ledger.mark_unknown(
                    &invoice.payment_hash,
                    "NWC transport outage — result unknown, human gate",
                )?;
                Ok(LifecycleState::Unknown)
            }
            Err(LnMockError::Refused { field, reason }) => {
                Err(LedgerError::Refusal { field, reason })
            }
        }
    }

    /// Reconcile with preimage + optional fees_paid (NIP-47: fees
    /// OPTIONAL; possibility law: fees ≤ fee_limit or the record is
    /// refused as impossible).
    pub fn reconcile(
        &mut self,
        id: PaymentHash,
        fees_paid_msat: Option<MilliSatoshi>,
        preimage: &[u8; 32],
    ) -> Result<LifecycleState, LedgerError> {
        // LU-8.1: ABSENT fees are NOT zero fees — the transport gave no
        // testimony, so exposure stays bounded at the declared limit
        // (retained reservation, AbsentBounded booking). PRESENT fees
        // reconcile DOWN to the testified figure (Paid booking).
        let (fees_msat, evidence) = match fees_paid_msat {
            Some(ms) => {
                if ms > self.fee_limit_msat {
                    return Err(LedgerError::Refusal {
                        field: "fees_paid",
                        reason: format!(
                            "impossible fee evidence: {} msat exceeds the declared fee_limit {} msat (field=fees_paid unit=msat, R10-P3)",
                            ms.0, self.fee_limit_msat.0
                        ),
                    });
                }
                (ms, FeeEvidence::Paid(ms.0))
            }
            None => (
                self.fee_limit_msat,
                FeeEvidence::AbsentBounded(self.fee_limit_msat.0),
            ),
        };
        let _ = preimage; // adapter contract validates preimage vs hash at build time
        let outcome = self
            .ledger
            .reconcile_with_evidence(&id, fees_msat.to_atto(), true)?;
        self.fee_evidence.insert(id, evidence);
        Ok(outcome.state)
    }

    /// HTLC-timeout failure: surfaces as Failed — never a fee (the
    /// pays_on_failure=FALSE law for LN routing).
    pub fn fail_htlc(&mut self, id: PaymentHash) -> Result<LifecycleState, LedgerError> {
        self.client.inject_htlc_timeout(id);
        self.ledger.transition(&id, LifecycleState::Failed)?;
        Ok(LifecycleState::Failed)
    }

    /// Test-support (harness): open an intent AND stage it in-flight
    /// without sending — for probes that stage ids by hand. Named as
    /// probe surface; not an adapter API.
    #[doc(hidden)]
    pub fn ledger_open_probe(&mut self, id: PaymentHash, expires_unix: u64) {
        self.ledger
            .open_intent(
                id,
                FeeReservation {
                    class: FeeClass::LnroutingMsat,
                    worst_case: self.fee_limit_msat.to_atto(),
                },
                expires_unix,
            )
            .expect("probe intent");
        self.ledger
            .transition(&id, LifecycleState::InFlight)
            .expect("probe inflight");
    }

    pub fn state(&self, id: &PaymentHash) -> Option<LifecycleState> {
        self.ledger.state(id)
    }
    /// LU-8.1: how fee evidence was BOOKED for a payment (absent ≠ zero).
    pub fn fee_evidence(&self, id: &PaymentHash) -> Option<FeeEvidence> {
        self.fee_evidence.get(id).copied()
    }
    pub fn reserved_total_msat(&self) -> u64 {
        // msat fits u64 for the skeleton's magnitudes
        self.ledger
            .reserved_total()
            .to_decimal()
            .parse()
            .unwrap_or(0)
    }
    fn ledger_now(&self) -> u64 {
        // the mock's clock is the ledger clock
        self.client.now_unix
    }
}

pub const _MSAT_NOTE: &str =
    "units explicit: LN ledger figures are msat; MSAT_IN_SATS kept for display conversions only";
