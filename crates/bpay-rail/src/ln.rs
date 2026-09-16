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
    /// LU-5: the RELEASED amount for upto mechanisms (None for exact
    /// invoices — absence on an upto is incomplete evidence).
    pub released_msat: Option<MilliSatoshi>,
    /// NIP-47 `fees_paid` is OPTIONAL — absence is lawful (reservation
    /// stands); presence must satisfy possibility (≤ fee_limit).
    pub fees_paid_msat: Option<MilliSatoshi>,
}

/// LU-5: how an upto (hold/MPP) payment was BOOKED — the maximum and the
/// actual BOTH survive; LN never silently turns a maximum into an exact
/// charge.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UptoBooking {
    pub authorized: MilliSatoshi,
    pub released: MilliSatoshi,
}

/// A hold/MPP offer: the payer authorizes a MAXIMUM; the actual is set
/// at release (settle-on-release only).
#[derive(Debug, Clone)]
pub struct LnOffer {
    pub payment_hash: PaymentHash,
    pub authorized_msat: MilliSatoshi,
    pub mechanism: crate::capabilities::LnUptoMechanism,
    pub created_at: u64,
    pub expires_at: u64,
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
                released_msat: None,
                fees_paid_msat: fees,
            },
        );
        Ok(invoice.payment_hash)
    }

    /// HTLC-timeout failure injection (surfaces as Failed, never a fee).
    pub fn inject_htlc_timeout(&mut self, id: PaymentHash) {
        self.states.insert(id, NwcState::Failed);
    }

    /// LU-5: mint a hold/MPP OFFER — the payer-side maximum, settle on
    /// release only.
    pub fn make_hold_offer(
        &mut self,
        authorized_msat: MilliSatoshi,
        mechanism: crate::capabilities::LnUptoMechanism,
        expiry_secs: u64,
    ) -> LnOffer {
        let mut hash = [0u8; 32];
        hash[0] = 0xF0;
        hash[1] = self.states.len() as u8 + 1;
        let id = PaymentHash(hash);
        self.states.insert(id, NwcState::Pending);
        LnOffer {
            payment_hash: id,
            authorized_msat,
            mechanism,
            created_at: self.now_unix,
            expires_at: self.now_unix + expiry_secs,
        }
    }

    /// LU-5: release an offer at an actual — the only lawful settle path.
    /// A release above the authorized maximum is recorded and REFUSED by
    /// the adapter's evidence law (the law lives rail-side).
    pub fn release_payment(
        &mut self,
        offer: &LnOffer,
        released: MilliSatoshi,
    ) -> Result<(), LnMockError> {
        if self.states.get(&offer.payment_hash) != Some(&NwcState::Pending) {
            return Err(LnMockError::Refused {
                field: "release",
                reason: "offer is not open (timed out or already released)".into(),
            });
        }
        let mut preimage = offer.payment_hash.0;
        preimage[31] ^= 0x5a;
        self.states.insert(offer.payment_hash, NwcState::Settled);
        self.settlements.insert(
            offer.payment_hash,
            LnSettlement {
                preimage,
                released_msat: Some(released),
                fees_paid_msat: Some(MilliSatoshi(25)),
            },
        );
        Ok(())
    }

    /// LU-5: hold-timeout — the offer dies; terminal Failed rail-side.
    pub fn hold_timeout(&mut self, id: PaymentHash) {
        self.states.insert(id, NwcState::Failed);
    }

    /// pay an OFFER: settles ONLY if released first (settle-on-release).
    pub fn pay_offer(
        &mut self,
        offer: &LnOffer,
        _fee_limit_msat: MilliSatoshi,
    ) -> Result<PaymentHash, LnMockError> {
        if offer.expires_at <= self.now_unix {
            return Err(LnMockError::Refused {
                field: "expires_at",
                reason: "offer expired — pre-send refusal (LU-5)".into(),
            });
        }
        if self.outage_next_pay {
            self.outage_next_pay = false;
            return Err(LnMockError::TransportUnknown);
        }
        match self.states.get(&offer.payment_hash) {
            Some(NwcState::Settled) => Ok(offer.payment_hash),
            _ => Err(LnMockError::Refused {
                field: "released_msat",
                reason:
                    "upto settles on release ONLY — released amount is required evidence (LU-5)"
                        .into(),
            }),
        }
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
    /// LU-5 booking record: authorized vs released for upto payments.
    upto_bookings: std::collections::HashMap<PaymentHash, UptoBooking>,
    /// CD: the mechanisms this adapter claims (bound before intents).
    pub mechanisms: crate::capabilities::MechanismSet,
    ledger: RailLedger<PaymentHash>,
    fee_limit_msat: MilliSatoshi,
}

pub const MSAT_IN_SATS: u64 = 1_000;

fn id_of(offer: &LnOffer) -> PaymentHash {
    offer.payment_hash
}

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
            upto_bookings: std::collections::HashMap::new(),
            mechanisms: crate::capabilities::MechanismSet::BOTH,
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
    /// LU-5: pay an upto OFFER through a named mechanism. Settle on
    /// release only; the released amount is required evidence bounded by
    /// the authorized maximum; the booking carries BOTH figures.
    pub fn pay_upto(
        &mut self,
        offer: &LnOffer,
        mechanism: crate::capabilities::LnUptoMechanism,
    ) -> Result<LifecycleState, LedgerError> {
        if !self.mechanisms.supports(mechanism) {
            return Err(LedgerError::Refusal {
                field: "manifest",
                reason: format!(
                    "mechanism {mechanism:?} not bound on this adapter — capabilities are explicit before intent construction (CD)"
                ),
            });
        }
        if self.ledger.state(&offer.payment_hash).is_some() {
            return Err(LedgerError::Refusal {
                field: "payment_hash",
                reason: "duplicate intent — route to lookup/reconcile, never a second payment"
                    .into(),
            });
        }
        if offer.expires_at <= self.client.now_unix {
            return Err(LedgerError::Refusal {
                field: "expires_at",
                reason: "offer expired — new intents refused (LU-5)".into(),
            });
        }
        self.ledger.open_intent(
            offer.payment_hash,
            FeeReservation {
                class: FeeClass::LnroutingMsat,
                worst_case: self.fee_limit_msat.to_atto(),
            },
            offer.expires_at,
        )?;
        let id = match self.client.pay_offer(offer, self.fee_limit_msat) {
            Ok(id) => id,
            Err(LnMockError::TransportUnknown) => {
                self.ledger
                    .transition(&id_of(offer), LifecycleState::InFlight)?;
                self.ledger
                    .mark_unknown(&id_of(offer), "transport unknown mid-upto")?;
                return Ok(LifecycleState::Unknown);
            }
            Err(LnMockError::Refused { field, reason }) => {
                return Err(LedgerError::Refusal { field, reason });
            }
        };
        self.ledger.transition(&id, LifecycleState::InFlight)?;
        let (_, settlement) = self.client.lookup(id).expect("settled");
        let settlement = settlement.expect("settlement on release");
        let released = settlement
            .released_msat
            .ok_or_else(|| LedgerError::Refusal {
                field: "released_msat",
                reason:
                    "upto settles on release ONLY — released amount is required evidence (LU-5)"
                        .into(),
            })?;
        if released > offer.authorized_msat {
            return Err(LedgerError::Refusal {
                field: "released_msat",
                reason: format!(
                    "upto law violated: released {} msat > authorized {} msat — the maximum is never an exact charge (LU-5)",
                    released.0, offer.authorized_msat.0
                ),
            });
        }
        // fee booking rides the LU-8.1 law
        let (fees_msat, evidence) = match settlement.fees_paid_msat {
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
        let out = self
            .ledger
            .reconcile_with_evidence(&id, fees_msat.to_atto(), true)?;
        self.fee_evidence.insert(id, evidence);
        self.upto_bookings.insert(
            id,
            UptoBooking {
                authorized: offer.authorized_msat,
                released,
            },
        );
        Ok(out.state)
    }

    /// LU-5: hold-timeout — terminal Failed, ZERO fee, no replacement.
    pub fn fail_hold_timeout(&mut self, id: PaymentHash) -> Result<LifecycleState, LedgerError> {
        self.client.hold_timeout(id);
        self.ledger.transition(&id, LifecycleState::Failed)?;
        Ok(LifecycleState::Failed)
    }

    /// LU-5: the upto booking (authorized vs released), if any.
    pub fn upto_booking(&self, id: &PaymentHash) -> Option<UptoBooking> {
        self.upto_bookings.get(id).copied()
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
