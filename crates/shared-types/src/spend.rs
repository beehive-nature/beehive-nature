//! SPEND RECEIPT — the strongly-typed schema (L-SCHEMA bind).
//!
//! Normative source: `docs/SPEC-SPEND-RECEIPT-1.md`. **The spec governs; if this file and
//! the spec differ, the spec wins and this file is the defect.**
//!
//! DENOMINATION LAW (ruled, non-negotiable): line items carry **resource quantities**
//! — mesh-seconds, chunk counts, RAM bytes — and are **NEVER fiat-pegged**. Fiat pegging
//! would let appreciation corrupt the itemization: the same physical resource would read
//! as a different amount of work depending on the day.
//!
//! ## Three design rules that are load-bearing, with the reason attached (8t)
//!
//! 1. **NO FLOATS ANYWHERE.** A receipt is anchored on-chain and must be byte-identical
//!    when re-serialized. `f64` is neither exact nor reproducible across platforms.
//!    Amounts are integer `units` + `scale`; rates are exact **rationals**. A rate of
//!    "one third of a b per chunk" is `1/3`, not `0.333…` — the rounding never happens,
//!    so it can never disagree between two implementations.
//! 2. **NO `#[serde(flatten)]`, NO `#[serde(untagged)]`.** B3 requires JSON *and*
//!    bincode. Both attributes require a self-describing format and **silently break
//!    bincode**. Avoiding them is what makes "serializable to both" true rather than
//!    aspirational.
//! 3. **`total()` IS COMPUTED, NEVER STORED**, and it **refuses** to sum across mixed
//!    denominations rather than coercing. A stored total can disagree with its own line
//!    items; a computed one cannot.
//!
//! ## The field the dispatch sketch dropped, and why it is back
//!
//! The B3 sketch had `SpendLineItem { rail, resource_class, quantity, b_cost }` — **no
//! rate**. That undoes §4 of the spec: without an explicit versioned `rate`, `charged`
//! appears with no auditable derivation, the total cannot be re-derived, and the schema
//! **silently re-imports the unruled tokenomics** the fence-hold exists to keep out.
//! `Rate` carries an opaque `rate_set_ref`, so the schema freezes now and rate *values*
//! land later **without a schema change**. Visibility was also absent from the sketch and
//! is restored — it is a founder ruling (2026-08-08), default `Private`.

use serde::{Deserialize, Serialize};

/// Bumped on any change to the wire shape. Versioned from day one (L-SCHEMA).
pub const SCHEMA_VERSION: &str = "1.0.0-draft";

// ---------------------------------------------------------------------------
// Closed enums. A caller-supplied classification is not a classification —
// an unlisted variant is added by RULING, never by passing a free string.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rail {
    Vaulta, Autonomi, Arweave, Arbitrum, Hive, Zano, Exsat, Mesh, Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceClass {
    MeshSecond, VramByteSecond, RamByte, CpuMicrosecond,
    NetByte, ChunkCount, StorageByte, ChainFee,
}

/// Denomination. MVP is `A` (A-first ruling). **Never a fiat currency** — that is the
/// denomination law expressed in the type system rather than in a comment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Denom { B, A }

/// RULED 2026-08-08. Default `Private`; widening is gated on informed consent that shows
/// privacy AND cost together. Widening later cannot un-publish what was already written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility { Private, Parent, Public }

impl Default for Visibility {
    fn default() -> Self { Visibility::Private }
}

// ---------------------------------------------------------------------------
// Exact numerics
// ---------------------------------------------------------------------------

/// `units × 10^-scale` of `denom`. Integer-only: exact, and byte-stable under bincode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount { pub units: u128, pub scale: u8, pub denom: Denom }

/// Exact rational: `charged = quantity × numer / denom_`. Kept as a ratio so no rounding
/// is baked in — two implementations cannot disagree about a digit that was never written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RateRatio { pub numer: u128, pub denom_: u128 }

/// How `quantity` became `charged`. `rate_set_ref` is deliberately opaque — the FENCE-HOLD
/// from spec §4. **No tokenomics constant appears in this file.**
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rate {
    pub ratio: RateRatio,
    pub rate_set_ref: String,
    pub observed_at: i64,
}

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineItem {
    pub adapter: String,
    pub rail: Rail,
    pub resource_class: ResourceClass,
    /// EXACT resource quantity, integer. Preserved verbatim so a historical receipt stays
    /// re-priceable under a new rate set without rewriting history.
    pub quantity: u128,
    pub quantity_unit: String,
    pub charged: Amount,
    pub rate: Rate,
    pub rail_receipt: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Provenance {
    pub caused_by: String,
    pub anchors: Vec<String>,
    pub prior_receipt_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpendReceipt {
    pub schema_version: String,
    pub receipt_id: String,
    // FROZEN schema-v1 wire field — the 2026-08-19 bDiD→bzDiD rename does not touch
    // serialized field names; a rename here breaks every already-emitted receipt.
    // Renames land only with a schema_version bump. See docs/VOCABULARY.md.
    pub spender_bdid: String,
    pub occurred_at: i64,
    pub operation: String,
    pub epoch: i64,
    pub line_items: Vec<LineItem>,
    pub visibility: Visibility,
    pub provenance: Provenance,
    // NOTE: no `total` field, deliberately. See `total()`.
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TotalError {
    /// Refused rather than coerced: summing across denominations or scales would produce
    /// a confidently wrong number, which is worse than an error.
    MixedDenomination,
    Empty,
    Overflow,
}

impl SpendReceipt {
    /// The total is **computed from the line items, never stored** — so it cannot drift
    /// away from them. Refuses mixed denomination/scale instead of guessing.
    pub fn total(&self) -> Result<Amount, TotalError> {
        let first = self.line_items.first().ok_or(TotalError::Empty)?.charged;
        let mut units: u128 = 0;
        for li in &self.line_items {
            if li.charged.denom != first.denom || li.charged.scale != first.scale {
                return Err(TotalError::MixedDenomination);
            }
            units = units.checked_add(li.charged.units).ok_or(TotalError::Overflow)?;
        }
        Ok(Amount { units, scale: first.scale, denom: first.denom })
    }

    /// Does every line's `charged` follow from its own `quantity × rate`? This is what
    /// makes the rate auditable rather than decorative.
    pub fn rates_reproduce_charges(&self) -> bool {
        self.line_items.iter().all(|li| {
            if li.rate.ratio.denom_ == 0 { return false; }
            match li.quantity.checked_mul(li.rate.ratio.numer) {
                Some(n) => n / li.rate.ratio.denom_ == li.charged.units,
                None => false,
            }
        })
    }
}

// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn rate(n: u128, d: u128) -> Rate {
        Rate { ratio: RateRatio { numer: n, denom_: d },
               rate_set_ref: "rateset:v0-unruled".into(), observed_at: 1_800_000_000 }
    }
    fn line(rail: Rail, rc: ResourceClass, qty: u128, charged: u128, r: Rate) -> LineItem {
        LineItem { adapter: "adapter-test".into(), rail, resource_class: rc,
                   quantity: qty, quantity_unit: "unit".into(),
                   charged: Amount { units: charged, scale: 6, denom: Denom::A },
                   rate: r, rail_receipt: None }
    }
    fn receipt(items: Vec<LineItem>) -> SpendReceipt {
        SpendReceipt {
            schema_version: SCHEMA_VERSION.into(), receipt_id: "rcpt:test".into(),
            spender_bdid: "did:bnr:test".into(), occurred_at: 1_800_000_000,
            operation: "op:test".into(), epoch: 42, line_items: items,
            visibility: Visibility::default(),
            provenance: Provenance { caused_by: "op:test".into(), anchors: vec![], prior_receipt_id: None },
        }
    }

    #[test]
    fn total_is_the_sum_of_line_charges() {
        let r = receipt(vec![
            line(Rail::Arweave, ResourceClass::ChunkCount, 10, 100, rate(10, 1)),
            line(Rail::Autonomi, ResourceClass::MeshSecond, 5, 50, rate(10, 1)),
        ]);
        assert_eq!(r.total().unwrap(), Amount { units: 150, scale: 6, denom: Denom::A });
    }

    #[test]
    fn mixed_denomination_is_refused_not_coerced() {
        // NEGATIVE CONTROL (8r). If this ever returns Ok, `total()` has started inventing
        // a number across incommensurable units — the exact failure the spec's §4 exists
        // to prevent. Do NOT "fix" this test by making total() lenient.
        let mut r = receipt(vec![
            line(Rail::Arweave, ResourceClass::ChunkCount, 10, 100, rate(10, 1)),
            line(Rail::Hive, ResourceClass::ChainFee, 1, 7, rate(7, 1)),
        ]);
        r.line_items[1].charged.denom = Denom::B;
        assert_eq!(r.total(), Err(TotalError::MixedDenomination));

        let mut r2 = receipt(vec![
            line(Rail::Arweave, ResourceClass::ChunkCount, 10, 100, rate(10, 1)),
            line(Rail::Hive, ResourceClass::ChainFee, 1, 7, rate(7, 1)),
        ]);
        r2.line_items[1].charged.scale = 2;          // same denom, different scale
        assert_eq!(r2.total(), Err(TotalError::MixedDenomination));
    }

    #[test]
    fn rate_reproduces_the_charge_and_a_wrong_rate_is_detectable() {
        let good = receipt(vec![line(Rail::Arweave, ResourceClass::ChunkCount, 10, 100, rate(10, 1))]);
        assert!(good.rates_reproduce_charges());

        // CONTROL: tamper the charge only. If this still passes, the rate is decorative
        // and the audit trail proves nothing.
        let mut bad = good.clone();
        bad.line_items[0].charged.units = 999;
        assert!(!bad.rates_reproduce_charges());
    }

    #[test]
    fn exact_rational_rate_avoids_the_rounding_a_float_would_bake_in() {
        // 1/3 per unit × 30 units = 10 exactly. A f64 0.333… would not land on 10.
        let r = receipt(vec![line(Rail::Mesh, ResourceClass::MeshSecond, 30, 10, rate(1, 3))]);
        assert!(r.rates_reproduce_charges());
    }

    #[test]
    fn json_round_trips_byte_identically() {
        let r = receipt(vec![line(Rail::Arweave, ResourceClass::ChunkCount, 10, 100, rate(10, 1))]);
        let a = serde_json::to_string(&r).unwrap();
        let back: SpendReceipt = serde_json::from_str(&a).unwrap();
        assert_eq!(r, back);
        assert_eq!(a, serde_json::to_string(&back).unwrap());
    }

    #[test]
    fn quantity_survives_round_trip_exactly_at_the_top_of_u128() {
        // The denomination law is only real if large exact quantities are not lossy.
        let big = u128::MAX;
        let r = receipt(vec![line(Rail::Autonomi, ResourceClass::StorageByte, big, 0, rate(0, 1))]);
        let back: SpendReceipt = serde_json::from_str(&serde_json::to_string(&r).unwrap()).unwrap();
        assert_eq!(back.line_items[0].quantity, big);
    }

    #[test]
    fn visibility_defaults_to_private() {
        assert_eq!(Visibility::default(), Visibility::Private);
    }

    #[test]
    fn empty_receipt_has_no_total_rather_than_a_zero() {
        // Zero would read as "this operation was free"; Empty reads as "nothing measured."
        assert_eq!(receipt(vec![]).total(), Err(TotalError::Empty));
    }
}
