//! The fee vocabulary (R7 design + the R11 Base finding).
//!
//! Classes carry the headline asymmetry: EVM gas PAYS on failure
//! (reverts consume gas); LN routing does NOT (failed parts owe
//! nothing); Base adds a SURCHARGE class outside the EIP-1559 bid.

use watchpay::types::Atto;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeClass {
    /// EVM execution gas: single product gas_limit × max_fee bounds
    /// spend (watchpay law).
    L2Gas,
    /// Arbitrum-shaped: L1 charge GAS-FOLDED into gasUsed — same
    /// product; class exists for the per-chain L1 headroom hint.
    L1FoldedGas,
    /// Base/OP-stack: L1 data fee is a SURCHARGE outside the EIP-1559
    /// bid (docs.optimism.io: "not possible to limit") — requires its
    /// own declared worst case. THE BASE GATE.
    L1Surcharge,
    /// LN routing: msat fee_limit; failed parts owe nothing;
    /// HTLC-timeout expiry; payment_hash idempotency.
    LnroutingMsat,
    /// LN channel ops: sats/vbyte PSBT ceiling, organ-signed.
    ChannelOpL1,
}

impl FeeClass {
    /// pays_on_failure: gas classes TRUE (reverts pay gas); LN routing
    /// FALSE. The R7 asymmetry, encoded.
    pub fn pays_on_failure(&self) -> bool {
        matches!(
            self,
            FeeClass::L2Gas | FeeClass::L1FoldedGas | FeeClass::L1Surcharge
        )
    }
}

/// One fee reservation against the window budget.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeeReservation {
    pub class: FeeClass,
    pub worst_case: Atto,
}
