//! `age` — age assurance as an attribute of an **action**, never a gate on a **person** (RELAY_23).
//!
//! This module is deliberately its own file, reachable from nothing in the identity ladder. An
//! identity step, a commons read, or the dashboard consulting age assurance is a negative-control
//! failure — so the ladder in `lib.rs` never names [`AgeAssurance`], and a source scan there proves
//! it (see `lib.rs`'s `containment` test). Age attaches to the one regulated transaction that
//! statute requires it for, and nowhere else. The discipline is containment.
//!
//! **THE ABSENCE IS THE GUARANTEE.** There is no field in this module, or anywhere reachable from
//! it, capable of holding a date of birth, a document number, a document image, or a scan. The
//! threshold *result* is extracted at verification time; the underlying evidence is never persisted.
//! The safest place for an identity-document scan is nowhere. Same construction as a `Measured<T>`
//! that cannot fabricate a value and an `Attestor` with no `Verified` variant — the guarantee is
//! that the wrong shape is *unrepresentable*, and the `no_birthdate_or_document_field` test holds
//! the line with a positive control.

use serde::{Deserialize, Serialize};

/// A named jurisdiction — a threshold without one is not a threshold (Law 1d). Reuses the ratified
/// habit of naming the corridor; the actual threshold values are counsel's call, per corridor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Jurisdiction(pub String);

/// An age **bar** (e.g. 21) — the number is the *requirement*, and an [`AgeAssurance::Attested`]
/// carries "meets this bar", a boolean result. It is **never a birthdate** and never the person's
/// actual age.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgeThreshold(pub u8);

/// How a threshold was attested. Note the ladder — and the deliberate absence at the bottom of it.
///
/// **There is no document-upload / ID-scan variant, and there never will be.** That is the one
/// method never to build: it creates an identity-document honeypot and a permanent breach
/// liability. A "temporary" honeypot becomes permanent. The two primary targets are the
/// selective-disclosure standards (reveal a boolean, not a birthdate) the world is converging on.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssuranceMethod {
    /// ISO 18013-5 mobile driving licence — selective disclosure, ephemeral tokens. Primary target.
    MobileDrivingLicence,
    /// EUDI Wallet — selective disclosure. Primary target (mandatory across the EU by 31 Dec 2026).
    EudiWallet,
    /// Facial age estimation — fallback only; boundary-fragile, documented demographic bias.
    FacialEstimation,
    /// Credit card — a proxy, never a proof.
    CreditCard,
    /// Self-declaration — fine wherever assurance is not required; never for a regulated gate.
    SelfDeclaration,
}

/// The entity that asserted the threshold. As everywhere in this system there is **no `Verified`
/// variant** — `Attested` means *an attestor asserted*, not that a fact was proven true.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Attestor {
    /// An mDL / EUDI wallet issuer, by opaque handle.
    Wallet(String),
    /// A facial-estimation provider.
    Estimator(String),
    /// A payment-proxy provider.
    Payment(String),
    /// The subject's own unverified declaration.
    SelfAsserted,
}

/// Age assurance — an attribute of an action. The default is [`AgeAssurance::NotAsserted`], which is
/// correct almost everywhere: the commons, the dashboard, onboarding, `b` accrual, PoUL and voting
/// all require *none*. Only a regulated transaction (a cannabinoid purchase, a statutory-floor
/// financial action) requires more, and only for that transaction.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgeAssurance {
    /// The default. No assertion made — and no field to hold one.
    NotAsserted,
    /// A weak, self-made claim, labelled weak by construction. Never satisfies a regulated gate.
    SelfDeclared { at: i64 },
    /// A threshold result attested by a method. Carries the *result*, its jurisdiction, and its
    /// provenance — and structurally nothing that could identify the document behind it.
    Attested {
        /// The bar met — "over 21" as a result, never a birthdate.
        threshold: AgeThreshold,
        /// The corridor the threshold was checked against (required — Law 1d).
        jurisdiction: Jurisdiction,
        method: AssuranceMethod,
        /// Who asserted it — no `Verified` variant.
        attestor: Attestor,
        obtained_at: i64,
        /// When the assertion lapses, if it does.
        expires_at: Option<i64>,
    },
}

impl Default for AgeAssurance {
    fn default() -> Self {
        AgeAssurance::NotAsserted
    }
}

impl AgeAssurance {
    /// Does this satisfy a regulated-purchase gate for `required` in `jurisdiction` at `now`?
    ///
    /// Requires **both** a threshold and a named jurisdiction (Law 1d — a threshold without a
    /// jurisdiction is not a threshold). [`AgeAssurance::NotAsserted`] and
    /// [`AgeAssurance::SelfDeclared`] **never** satisfy a regulated gate. [`AgeAssurance::Attested`]
    /// satisfies only when its threshold meets the requirement, its jurisdiction matches, and it has
    /// not expired.
    pub fn satisfies_regulated_purchase(
        &self,
        required: AgeThreshold,
        jurisdiction: &Jurisdiction,
        now: i64,
    ) -> bool {
        match self {
            AgeAssurance::NotAsserted | AgeAssurance::SelfDeclared { .. } => false,
            AgeAssurance::Attested {
                threshold,
                jurisdiction: j,
                expires_at,
                ..
            } => {
                threshold.0 >= required.0
                    && j == jurisdiction
                    && expires_at.map_or(true, |e| e > now)
            }
        }
    }
}

#[cfg(test)]
mod controls {
    use super::*;

    fn attested(threshold: u8, juris: &str, expires: Option<i64>) -> AgeAssurance {
        AgeAssurance::Attested {
            threshold: AgeThreshold(threshold),
            jurisdiction: Jurisdiction(juris.to_string()),
            method: AssuranceMethod::MobileDrivingLicence,
            attestor: Attestor::Wallet("issuer-x".into()),
            obtained_at: 1000,
            expires_at: expires,
        }
    }

    // ── §3 behavioural controls ──

    #[test]
    fn self_declared_and_notasserted_never_satisfy_a_regulated_gate() {
        let j = Jurisdiction("US-CO".into());
        assert!(
            !AgeAssurance::SelfDeclared { at: 1 }.satisfies_regulated_purchase(
                AgeThreshold(21),
                &j,
                100
            )
        );
        assert!(!AgeAssurance::NotAsserted.satisfies_regulated_purchase(AgeThreshold(21), &j, 100));
    }

    #[test]
    fn attested_satisfies_only_when_threshold_jurisdiction_and_freshness_all_hold() {
        let co = Jurisdiction("US-CO".into());
        // meets the bar, right corridor, unexpired → satisfies
        assert!(
            attested(21, "US-CO", Some(5000)).satisfies_regulated_purchase(
                AgeThreshold(21),
                &co,
                100
            )
        );
        // below the bar → no
        assert!(!attested(18, "US-CO", None).satisfies_regulated_purchase(
            AgeThreshold(21),
            &co,
            100
        ));
        // wrong corridor → no (a threshold proven for one jurisdiction is not proven for another)
        assert!(!attested(21, "US-WA", None).satisfies_regulated_purchase(
            AgeThreshold(21),
            &co,
            100
        ));
        // expired → no
        assert!(
            !attested(21, "US-CO", Some(50)).satisfies_regulated_purchase(
                AgeThreshold(21),
                &co,
                100
            )
        );
    }

    // ── the structural guarantees: source scans with positive controls ──
    //
    // Scan only the non-test portion of this file (the model), so the needle lists and decoys in
    // this test module never match themselves. Comment lines are skipped so the doc prose that
    // *names* the forbidden shapes (to ban them) does not trip the scan.

    fn model_code_lines(src: &str) -> Vec<&str> {
        let model = src.split("#[cfg(test)]").next().unwrap_or(src);
        model
            .lines()
            .filter(|l| !l.trim_start().starts_with("//"))
            .collect()
    }

    #[test]
    fn no_birthdate_or_document_field_is_reachable_in_the_age_path() {
        // Field-name tokens that would betray retained identity-document data. Assembled at runtime
        // so the literal tokens are not themselves present in the scanned (non-test) model.
        let forbidden = [
            format!("date_of_{}", "birth"),
            format!("{}date", "birth"),
            "dob".to_string(),
            format!("document_{}", "number"),
            format!("doc_{}", "number"),
            format!("licence_{}", "number"),
            format!("license_{}", "number"),
            format!("id_{}", "image"),
            format!("id_{}", "scan"),
            format!("scan_{}", "bytes"),
            format!("passport_{}", "number"),
        ];
        let src = include_str!("age.rs");
        let hits: Vec<&str> = model_code_lines(src)
            .into_iter()
            .filter(|l| forbidden.iter().any(|n| l.contains(n.as_str())))
            .collect();
        assert!(
            hits.is_empty(),
            "the age path must hold no birthdate/document/image field — found: {hits:?}"
        );
        // positive control: the scan WOULD bite a retained-document field (decoy built by concat so
        // it is not a real field in this file).
        let decoy = format!("    pub date_of_{}: String,", "birth");
        assert!(
            forbidden.iter().any(|n| decoy.contains(n.as_str())),
            "the no-document scan must be shown to catch a birthdate field"
        );
    }

    #[test]
    fn the_method_ladder_has_no_document_upload_variant() {
        let forbidden = [
            format!("Document{}", "Upload"),
            format!("Id{}", "Scan"),
            format!("upload_{}", "image"),
            format!("{}Scan", "Document"),
        ];
        let src = include_str!("age.rs");
        let hits: Vec<&str> = model_code_lines(src)
            .into_iter()
            .filter(|l| forbidden.iter().any(|n| l.contains(n.as_str())))
            .collect();
        assert!(
            hits.is_empty(),
            "the method ladder must never grow a document-upload variant — found: {hits:?}"
        );
        // positive control.
        let decoy = format!("    Document{},", "Upload");
        assert!(forbidden.iter().any(|n| decoy.contains(n.as_str())));
    }

    #[test]
    fn attestor_has_no_verified_variant() {
        // `Attested` means an attestor asserted, never that a fact is proven — as everywhere.
        let src = include_str!("age.rs");
        assert!(
            !model_code_lines(src)
                .into_iter()
                .any(|l| l.contains(&format!("Veri{}", "fied"))),
            "no Verified variant on the age attestor"
        );
    }
}
