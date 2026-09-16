const fs = require('fs');
const R = 'src/';

// ---------- lib.rs ----------
let lib = fs.readFileSync(R + 'lib.rs', 'utf8');
lib = lib.replace('pub mod ledger;', 'pub mod ledger;\npub mod units;');
lib = lib.replace('pub use ln::', 'pub use units::{FeeEvidence, MilliSatoshi};\npub use ln::');
fs.writeFileSync(R + 'lib.rs', lib);
console.log('lib ok');

// ---------- ln.rs ----------
let ln = fs.readFileSync(R + 'ln.rs', 'utf8');
ln = ln.replace('use watchpay::types::Atto;', 'use crate::units::{FeeEvidence, MilliSatoshi};');
ln = ln.replace('    pub amount_msat: u64,', '    pub amount_msat: MilliSatoshi,');
ln = ln.replace('    pub fees_paid_msat: Option<u64>,', '    pub fees_paid_msat: Option<MilliSatoshi>,');
ln = ln.replace('    pub fn make_invoice(&mut self, amount_msat: u64, expiry_secs: u64) -> LnInvoice {',
                '    pub fn make_invoice(\n        &mut self,\n        amount_msat: MilliSatoshi,\n        expiry_secs: u64,\n    ) -> LnInvoice {');
// mock pay internals
ln = ln.replace('        fee_limit_msat: u64,', '        fee_limit_msat: MilliSatoshi,');
ln = ln.replace('        let fees = Some(fee_limit_msat / 4);', '        let fees = Some(MilliSatoshi(fee_limit_msat.0 / 4));');
// adapter
ln = ln.replace('    pub fn new(window_fee_ceiling_msat: u64, fee_limit_msat: u64, now_unix: u64) -> Self {\n        Self {\n            ledger: RailLedger::new(Atto::from_u64(window_fee_ceiling_msat), now_unix),',
                '    pub fn new(\n        window_fee_ceiling_msat: MilliSatoshi,\n        fee_limit_msat: MilliSatoshi,\n        now_unix: u64,\n    ) -> Self {\n        Self {\n            // LU-7.2: the ONE named conversion site.\n            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),');
// adapter struct: add fee_evidence map — find the struct fields
ln = ln.replace('pub struct LnRailAdapter {\n    pub client: LnMockClient,', 'pub struct LnRailAdapter {\n    pub client: LnMockClient,\n    /// LU-8.1 booking record: how fee evidence was booked per payment.\n    fee_evidence: std::collections::HashMap<PaymentHash, FeeEvidence>,');
// initialize the map in new()
ln = ln.replace('            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),\n            fee_limit_msat,',
                '            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),\n            fee_evidence: std::collections::HashMap::new(),\n            fee_limit_msat,');
// reservation worst case
ln = ln.replace('                worst_case: Atto::from_u64(self.fee_limit_msat),', '                worst_case: self.fee_limit_msat.to_atto(),');
// reconcile: absent-vs-zero
ln = ln.replace('        fees_paid_msat: Option<u64>,', '        fees_paid_msat: Option<MilliSatoshi>,');
ln = ln.replace(`        let fees = fees_paid_msat.unwrap_or(0);
        if fees > self.fee_limit_msat {
            return Err(LedgerError::Refusal {
                field: "fees_paid",
                reason: format!(
                    "impossible fee evidence: {} msat exceeds the declared fee_limit {} msat (R10-P3)",
                    fees, self.fee_limit_msat
                ),
            });
        }
        let _ = preimage; // adapter contract validates preimage vs hash at build time
        let outcome = self
            .ledger
            .reconcile_with_evidence(&id, Atto::from_u64(fees), true)?;
        Ok(outcome.state)`,
`        // LU-8.1: ABSENT fees are NOT zero fees — the transport gave no
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
            None => (self.fee_limit_msat, FeeEvidence::AbsentBounded(self.fee_limit_msat.0)),
        };
        let _ = preimage; // adapter contract validates preimage vs hash at build time
        let outcome = self
            .ledger
            .reconcile_with_evidence(&id, fees_msat.to_atto(), true)?;
        self.fee_evidence.insert(id, evidence);
        Ok(outcome.state)`);
// accessor
ln = ln.replace('    pub fn state(&self, id: &PaymentHash) -> Option<LifecycleState> {\n        self.ledger.state(id)\n    }\n    pub fn reserved_total_msat(&self) -> u64 {',
`    pub fn state(&self, id: &PaymentHash) -> Option<LifecycleState> {
        self.ledger.state(id)
    }
    /// LU-8.1: how fee evidence was BOOKED for a payment (absent ≠ zero).
    pub fn fee_evidence(&self, id: &PaymentHash) -> Option<FeeEvidence> {
        self.fee_evidence.get(id).copied()
    }
    pub fn reserved_total_msat(&self) -> u64 {`);
fs.writeFileSync(R + 'ln.rs', ln);
console.log('ln ok');

// ---------- nwc.rs ----------
let nwc = fs.readFileSync(R + 'nwc.rs', 'utf8');
nwc = nwc.replace('use watchpay::types::Atto;', 'use crate::units::{FeeEvidence, MilliSatoshi};');
nwc = nwc.replace('        window_fee_ceiling_msat: u64,\n        fee_limit_msat: u64,', '        window_fee_ceiling_msat: MilliSatoshi,\n        fee_limit_msat: MilliSatoshi,');
nwc = nwc.replace('            ledger: RailLedger::new(Atto::from_u64(window_fee_ceiling_msat), now_unix),', '            ledger: RailLedger::new(window_fee_ceiling_msat.to_atto(), now_unix),');
nwc = nwc.replace('            fee_limit_msat,\n            send_enabled: false,\n        }\n    }', '            fee_limit_msat,\n            fee_evidence: std::collections::HashMap::new(),\n            send_enabled: false,\n        }\n    }');
nwc = nwc.replace('    fee_limit_msat: u64,', '    fee_limit_msat: MilliSatoshi,\n    /// LU-8.1 booking record per payment.\n    fee_evidence: std::collections::HashMap<crate::ln::PaymentHash, FeeEvidence>,');
nwc = nwc.replace('                worst_case: Atto::from_u64(self.fee_limit_msat),', '                worst_case: self.fee_limit_msat.to_atto(),');
nwc = nwc.replace(`                // fees_paid OPTIONAL (NIP-47); possibility-checked here
                let fees = result
                    .get("fees_paid")
                    .and_then(|f| f.as_u64())
                    .unwrap_or(0);
                if fees > self.fee_limit_msat {
                    return Err(LedgerError::Refusal {
                        field: "fees_paid",
                        reason: format!(
                            "impossible fee evidence: {fees} msat exceeds fee_limit {} msat (R10-P3)",
                            self.fee_limit_msat
                        ),
                    });
                }`,
`                // fees_paid OPTIONAL (NIP-47) — LU-8.1: ABSENT is not
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
                    None => (self.fee_limit_msat, FeeEvidence::AbsentBounded(self.fee_limit_msat.0)),
                };`);
nwc = nwc.replace(`                let out = self.ledger.reconcile_with_evidence(
                    &payment_hash,
                    Atto::from_u64(fees),
                    true,
                )?;
                Ok(out.state)`,
`                let out = self
                    .ledger
                    .reconcile_with_evidence(&payment_hash, fees_msat.to_atto(), true)?;
                self.fee_evidence.insert(payment_hash, evidence);
                Ok(out.state)`);
// accessor beside state()
nwc = nwc.replace('    pub fn state(&self, id: &crate::ln::PaymentHash) -> Option<LifecycleState> {\n        self.ledger.state(id)\n    }',
`    pub fn state(&self, id: &crate::ln::PaymentHash) -> Option<LifecycleState> {
        self.ledger.state(id)
    }
    /// LU-8.1: how fee evidence was BOOKED (absent ≠ zero).
    pub fn fee_evidence(&self, id: &crate::ln::PaymentHash) -> Option<FeeEvidence> {
        self.fee_evidence.get(id).copied()
    }`);
fs.writeFileSync(R + 'nwc.rs', nwc);
console.log('nwc ok');

// ---------- nwc_mock.rs: no-fees injection ----------
let mock = fs.readFileSync(R + 'nwc_mock.rs', 'utf8');
mock = mock.replace('    pub next_rate_limited: bool,\n}', '    pub next_rate_limited: bool,\n    /// LU-8.1 probe: next successful pay result OMITS fees_paid.\n    pub next_pay_no_fees: bool,\n}');
mock = mock.replace('            next_rate_limited: false,\n        }\n    }', '            next_rate_limited: false,\n            next_pay_no_fees: false,\n        }\n    }');
fs.writeFileSync(R + 'nwc_mock.rs', mock);
console.log('mock struct ok');
