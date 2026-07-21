//! `coa` — the honest-absence machinery for a composition / certificate-of-analysis record, and the
//! **B12-in-beef fixture** that teaches it (RELAY_14). This crate exists because that ruling was
//! *decided and never built* — and a fixture that lives as a decision and not as a test is exactly
//! the thing this whole system says should not count. So it is a test, not a doc.
//!
//! A lab certificate reports what was *measured*. The load-bearing question is what it says for
//! everything else — because **an analyte that was never assayed is not one that came back zero.**
//! "No lab ever found B12 in beef" is "no lab was ever asked to look": B12 needs a dedicated assay
//! (AOAC 2011.10), no US labelling rule mandates it on beef, so no processor pays for it. Reading
//! absence-of-test as absence-of-substance is the systemic error this refuses — the same discipline
//! as the dashboard's `Panel::Absent`, the price feed's `NotMeasured`, and `<LOQ` ≠ `0`.
//!
//! [`Measurement`] is the whole ethic in one type: a value was **measured**, or it is **not
//! measured** and carries *the reason it is absent* — [`Absence::NotRequested`],
//! [`Absence::MethodUnavailable`], or [`Absence::BelowLoq`] with its floor stated. There is **no
//! path from a non-value to a number**: a `NotMeasured` holds no value to read, so a renderer cannot
//! silently turn an unasked question into a `0`. That is the type enforcing what the COA acceptance
//! criteria state in prose (`SPEC_hulled_hemp_hearts_COA_tri_jurisdictional.md` §3: "No result may
//! be reported as `0` where the true statement is 'below the limit of quantitation'").

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// Why a value is not present on the record. Mirrors the COA acceptance-criteria non-result
/// vocabulary (§3.1: `NotRequested` · `MethodUnavailable` · `<LOQ` with its floor). An absence is
/// never a blank and never a `0`; it states *which kind* of absence it is, so the reader knows
/// whether nobody looked, the lab could not look, or the assay looked and the analyte was below the
/// floor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Absence {
    /// The assay was never ordered — the panel is *silent*, not *negative*. The B12-in-beef case: no
    /// rule mandates the dedicated assay, so nobody commissioned it. Absence of a test, not of a
    /// substance.
    NotRequested,
    /// The lab could not run the method for this analyte — out of accreditation scope, no
    /// instrument, sub-contract declined. Distinct from "not ordered": here it was wanted and could
    /// not be produced.
    MethodUnavailable,
    /// Assayed, but below the limit of quantitation — and **the LOQ travels with the result**,
    /// because the same `<LOQ` means very different things at a 100 µg/g floor versus a 0.1 µg/g one.
    /// Never `0`, never "none detected". (RELAY_12: the PREE certificates are `<LOQ` at 100 µg/g
    /// against a ~0.29 µg/g literature mean — blind by ~345×, not zero.)
    BelowLoq { loq: String },
}

/// One analyte's result: **measured** with its value, or **not measured** carrying the reason it is
/// absent. The two are different measurements and the type keeps them apart — reading a number out
/// forces the caller to handle the absence, because there is no coercion of a `NotMeasured` to `0`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Measurement<T> {
    /// Measured from a real assay.
    Measured(T),
    /// Not measured, and here is why.
    NotMeasured { basis: Absence },
}

impl<T> Measurement<T> {
    pub fn is_measured(&self) -> bool {
        matches!(self, Measurement::Measured(_))
    }

    /// The measured value, or `None` — the **only** way to read a value out. A `NotMeasured` yields
    /// `None`, never a `0`, so a renderer cannot turn an unasked question into a zero. This is the
    /// method that makes the ethic structural rather than a convention.
    pub fn value(&self) -> Option<&T> {
        match self {
            Measurement::Measured(v) => Some(v),
            Measurement::NotMeasured { .. } => None,
        }
    }

    /// Why this analyte is absent, if it is.
    pub fn absence(&self) -> Option<&Absence> {
        match self {
            Measurement::NotMeasured { basis } => Some(basis),
            Measurement::Measured(_) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One row of a certificate: the analyte's name and its result. `f64` is "value in the analyte's
    /// reported unit" — enough to make the fixture concrete without inventing a unit system.
    #[derive(Debug, Clone, PartialEq)]
    struct Analyte {
        name: &'static str,
        result: Measurement<f64>,
    }

    /// A routine beef proximate panel, as it is actually ordered: protein / fat / moisture / ash are
    /// **measured**, and B12 is **`NotMeasured { NotRequested }`** — because the dedicated AOAC
    /// 2011.10 assay is on no mandate, so no processor pays for it. This is the founder's checkable,
    /// systemic instance of absence-of-test being read as absence-of-substance, and RELAY_14's
    /// flagship fixture for the machinery.
    fn beef_proximate_panel() -> Vec<Analyte> {
        vec![
            Analyte { name: "protein_g_per_100g", result: Measurement::Measured(26.1) },
            Analyte { name: "fat_g_per_100g", result: Measurement::Measured(15.0) },
            Analyte { name: "moisture_g_per_100g", result: Measurement::Measured(58.0) },
            Analyte { name: "ash_g_per_100g", result: Measurement::Measured(1.0) },
            // B12 needs a dedicated assay nobody ordered on a proximate panel — silent, not zero.
            Analyte {
                name: "vitamin_b12_ug_per_100g",
                result: Measurement::NotMeasured { basis: Absence::NotRequested },
            },
        ]
    }

    #[test]
    fn b12_in_beef_is_not_requested_never_a_zero() {
        let panel = beef_proximate_panel();
        let b12 = panel
            .iter()
            .find(|a| a.name == "vitamin_b12_ug_per_100g")
            .expect("the panel carries a B12 row");

        // the flagship teaching point: the panel is SILENT on B12, and the silence carries its
        // reason — "no one ordered the assay", not "the analyte is absent".
        assert_eq!(b12.result.absence(), Some(&Absence::NotRequested));
        // and there is no number to read: a renderer cannot turn "not asked" into "0".
        assert!(!b12.result.is_measured());
        assert_eq!(b12.result.value(), None, "NotRequested is not a zero value");

        // the analytes that WERE ordered read as real values, so the panel is not empty — the point
        // is the *contrast* between measured rows and the silent one.
        let protein = panel.iter().find(|a| a.name == "protein_g_per_100g").unwrap();
        assert_eq!(protein.result.value(), Some(&26.1));
    }

    #[test]
    fn not_requested_is_distinct_from_a_measured_zero() {
        // The negative control the whole fixture exists to make: "not requested" and "measured as
        // zero" are different records and must never collapse together. Had B12 actually been
        // assayed and come back 0.0, that is a *measured* value — a different, stronger claim than
        // "no one looked", and only one of the two carries a number.
        let not_asked: Measurement<f64> = Measurement::NotMeasured { basis: Absence::NotRequested };
        let measured_zero: Measurement<f64> = Measurement::Measured(0.0);

        assert_ne!(not_asked, measured_zero, "absence of a test is not a measured zero");
        assert_eq!(not_asked.value(), None);
        assert_eq!(
            measured_zero.value(),
            Some(&0.0),
            "a real measured zero DOES carry a value — that is exactly what NotRequested does not"
        );
    }

    #[test]
    fn below_loq_carries_its_floor_and_is_not_zero() {
        // The sibling absence (RELAY_12): the PREE cannabinoid certificates report <LOQ at a 100
        // µg/g floor against a ~0.29 µg/g literature mean — blind, not zero. The LOQ travels with
        // the result so the same "<LOQ" is not misread across different floors.
        let below: Measurement<f64> = Measurement::NotMeasured {
            basis: Absence::BelowLoq { loq: "100 µg/g".to_string() },
        };
        assert_eq!(below.value(), None, "<LOQ is not a zero");
        match below.absence() {
            Some(Absence::BelowLoq { loq }) => {
                assert_eq!(loq, "100 µg/g", "the floor is stated inline, per §3.1")
            }
            other => panic!("expected BelowLoq carrying its floor, got {other:?}"),
        }
    }
}
