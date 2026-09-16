//! Typed rail units at the transport boundary (LU-3/LU-7, sixth-roll
//! REDs consumed): a bare `u64` amount next to a newtyped identity is how
//! msat figures get silently mixed with Atto/wei figures. Every
//! rail-native amount crosses into the unified ledger's Atto world
//! through ONE named conversion site, and fee refusals name the
//! field+unit pair.

use watchpay::types::Atto;

/// Milli-satoshi — LN's native unit, typed at the boundary (LU-3/LU-7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MilliSatoshi(pub u64);

impl MilliSatoshi {
    /// THE one named msat→Atto conversion site (LU-7.2: conversions
    /// scattered over call sites were the verified RED — they all route
    /// here now).
    pub fn to_atto(self) -> Atto {
        Atto::from_u64(self.0)
    }
}

/// How fee evidence was BOOKED for a settled payment (LU-8.1: absent
/// ≠ zero — the verified RED booked absent `fees_paid` as a zero-fee
/// settlement, releasing exposure the rail could not actually account).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeEvidence {
    /// The transport reported the fee: reconciles DOWN to the figure.
    Paid(u64),
    /// The transport did NOT report a fee: exposure stays bounded at the
    /// declared fee limit — retained, never released to zero.
    AbsentBounded(u64),
}

impl FeeEvidence {
    /// The msat figure the books carry (paid actual / absent worst-case).
    pub fn booked_msat(&self) -> u64 {
        match self {
            FeeEvidence::Paid(m) => *m,
            FeeEvidence::AbsentBounded(limit) => *limit,
        }
    }
}

/// Refusal naming law (LU-7): fee refusals carry field AND unit.
pub fn field_unit(field: &'static str, unit: &'static str) -> String {
    format!("field={field} unit={unit}")
}
