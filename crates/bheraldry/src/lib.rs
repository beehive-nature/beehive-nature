//! `bheraldry` — a symbol is evidence, not artwork.
//!
//! Order bHERALDRY-001: a culturally meaningful symbol carries a historical
//! meaning, a visual grammar, source provenance, cultural context, authorized
//! uses, and translations. This crate holds those as **separate, typed
//! claims** so that no one of them can silently stand in for another.
//!
//! # The four truths, which are the architecture
//!
//! Every claim names which kind of truth it is ([`TruthKind`]):
//!
//! 1. **Source authenticity** — these bytes really came from that source
//!    (digests, URLs, access dates, extraction method).
//! 2. **Historical interpretation** — a scholarly reading of history, which
//!    may be disputed and often is.
//! 3. **Language equivalence** — a translation relationship, which is never
//!    identity: the original inscription is immutable within a revision, and
//!    a translation carries its own provenance and attestation tier.
//! 4. **Authority** — the legal right to use a symbol, which is a fact about
//!    law on a date, not about pictures.
//!
//! A thousand-year record can remain byte-perfect while its modern translation
//! becomes misleading, or remain historically accurate while its current legal
//! permission changes. A record that cannot keep those apart will eventually
//! assert one using the evidence of another. Here the validators make the
//! confusion a named error instead of a silent merge.
//!
//! # The laws this crate is
//!
//! - **The original is immutable within a revision** ([`OriginalText`] has no
//!   mutation surface; every [`MottoTranslation`] binds the digest of the
//!   original it translates — alter the original and the translations
//!   refuse to validate).
//! - **A translation never acquires authority the original lacks.** An
//!   `OfficialRendering` must carry an authority basis of legal or
//!   primary-official grade, and a machine draft can never be one
//!   (bLANGUAGEdock's attestation tiers, reused from `language-authority`).
//! - **Official classification is earned by law**, not by pictures: an
//!   `OfficialStateInsignia` record must carry a primary-legal source and a
//!   legal usage condition, and its entity must be associated by charter.
//! - **Living persons are pseudonyms, not names** (the genealogy display law,
//!   mirrored here so a heraldic association cannot become a doxx).
//! - **Tradition is not documentation**: family-tradition and heuristic-era
//!   bases are forcibly `Unverified` — the era≠support law of
//!   `tools/genealogy`, restated for arms.
//! - **Disputes are retained, not adjudicated**: a [`Dispute`] must carry at
//!   least two sourced positions; the crate has no operation that picks one.
//! - **Revisions succeed, never rewrite**: [`RevisionChain`] keeps
//!   predecessors verifiable as history while flagging them superseded.
//! - **Visual similarity is not identity**: an [`AssetRef`] binds a sha256;
//!   a lookalike image is a different digest and nothing else.
//!
//! # Canonical form
//!
//! The canon is compact deterministic JSON (`serde_json::to_vec`) over types
//! that contain no maps and no floats, digested as
//! `sha256(RECORD_DOMAIN ‖ bytes)`. The reference specimen's digest is frozen
//! in `tests/specimen_vector.rs`; changing the specimen is a new revision,
//! never an edit — the bzDiD genesis law, applied to heraldry.
//!
//! # What this crate does NOT do
//!
//! It does not decide heraldic law, does not adjudicate disputes, does not
//! reproduce state insignia (the annex images of the Bulgarian law are
//! deliberately not captured — see the specimen's notes), and does not
//! authenticate anything: a [`SignedSeal`] authenticates a signer and bytes
//! under the signer's own trust assumptions, and never establishes
//! historical truth or legal rights.

#![forbid(unsafe_code)]

pub mod specimen;

pub use specimen::{
    bulgaria_national_arms, house_achievement, successor, ACCESS_DATE, HOUSE_ACHIEVEMENT_SHA256,
};

use language_authority::TranslationAttestation;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ── domains ───────────────────────────────────────────────────────────────────

pub const RECORD_DOMAIN: &str = "bheraldry/record/1";
pub const ORIGINAL_DOMAIN: &str = "bheraldry/original/1";
pub const SEAL_DOMAIN: &str = "bheraldry/attest/v1";

// ── digests ───────────────────────────────────────────────────────────────────

/// A sha256 over domain-separated canonical bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RecordDigest(#[serde(with = "serde_hex32")] pub [u8; 32]);

impl RecordDigest {
    pub fn of_bytes(domain: &str, bytes: &[u8]) -> RecordDigest {
        let mut h = Sha256::new();
        h.update(domain.as_bytes());
        h.update(b"\x00");
        h.update(bytes);
        RecordDigest(h.finalize().into())
    }
    pub fn hex(&self) -> String {
        self.0.iter().map(|b| format!("{b:02x}")).collect()
    }
}

impl std::fmt::Display for RecordDigest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.hex())
    }
}

mod serde_hex32 {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &[u8; 32], s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&v.iter().map(|b| format!("{b:02x}")).collect::<String>())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<[u8; 32], D::Error> {
        let s = String::deserialize(d)?;
        let s = s.trim().to_lowercase();
        if s.len() != 64 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(serde::de::Error::custom("digest must be 64 hex chars"));
        }
        let mut out = [0u8; 32];
        for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
            out[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
        }
        Ok(out)
    }
}

// ── the four truths and the claim kinds ────────────────────────────────────────

/// Which kind of truth a claim carries. The four are the architecture: they
/// answer different questions and are never interchangeable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TruthKind {
    /// These bytes came from that source.
    SourceAuthenticity,
    /// A reading of history — assertable, disputable, revisable.
    HistoricalInterpretation,
    /// A translation relationship — never identity with the original.
    LanguageEquivalence,
    /// A legal right to use, on a date, in a jurisdiction.
    Authority,
}

/// What kind of proposition a claim makes (order §2's five-way split, plus
/// the authenticity and authority kinds the four-truth split needs).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClaimKind {
    Legal,
    Historical,
    Convention,
    Translation,
    Artistic,
    Authenticity,
    Authority,
}

/// The quality of the SOURCE — a fact about where words came from, never a
/// fact about whether they are true. (The era≠support law: grade describes
/// the channel, not the conclusion.)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProvenanceGrade {
    /// The legal instrument itself (law, constitution), as published.
    PrimaryLegal,
    /// The entity's own official publication about itself.
    PrimaryOfficial,
    /// Scholarship or reference works, cited and checkable.
    SecondaryScholarly,
    /// Aggregator or user-edited tertiary sources (encyclopedias).
    Tertiary,
    /// The estate's own in-tree canon (BLAZON.md, dispatches, orders).
    InternalTree,
    /// Carried by word, tradition, or heuristic — never documentary.
    Unverified,
}

/// One sourced claim. Every field is evidence; none is conclusion.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SourceClaim {
    pub label: String,
    pub url: String,
    pub publisher: String,
    /// BCP-47-ish tag of the source's language.
    pub lang: String,
    /// ISO date of this seat's access.
    pub accessed: String,
    pub kind: ClaimKind,
    pub truth: TruthKind,
    pub grade: ProvenanceGrade,
    /// Bytes preserved exactly as received — including extraction artifacts,
    /// which `access_note` names rather than silently repairs.
    pub verbatim: Option<String>,
    pub access_note: Option<String>,
}

// ── classification and assets ─────────────────────────────────────────────────

/// What a record IS, which decides which laws bind it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Classification {
    /// A state's official insignia — earns its status only from law.
    OfficialStateInsignia,
    /// A reproduction of historical arms, clearly not current official use.
    HistoricalReproduction,
    /// The estate's own creative work — can never become official by relabel.
    OriginalCreative,
    /// A research specimen with no display or usage claim at all.
    ResearchSpecimen,
}

/// A digital asset bound by digest. Visual similarity to the bound image is
/// worth nothing; only the bytes are.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssetRef {
    pub path: String,
    pub media: String,
    pub digest_hex: Option<String>,
    pub classification: Classification,
    pub license_note: Option<String>,
}

impl AssetRef {
    /// Does THIS byte stream match the bound asset? The counterfeit
    /// detector: a lookalike is a different digest, and that is the whole of
    /// its relationship to this record.
    pub fn verify_bytes(&self, bytes: &[u8]) -> bool {
        match &self.digest_hex {
            Some(bound) => {
                let got: String = Sha256::digest(bytes)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect();
                bound.eq_ignore_ascii_case(&got)
            }
            None => false,
        }
    }
}

// ── blazon: the visual grammar ────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Tincture {
    Or,
    Argent,
    Gules,
    Azure,
    Vert,
    Sable,
    Purpure,
    Ermine,
    /// A named non-standard tincture or treatment the source insists on
    /// (quartering, enamelling, furs beyond ermine) — kept as words rather
    /// than bent onto the nearest standard colour.
    Other(String),
}

/// A beast's attitude. Distinct postures are distinct facts; collapsing them
/// in translation is a detected defect, not a style choice (the glossary
/// collision law below).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Posture {
    Rampant,
    Passant,
    PassantGuardant,
    Salient,
    Sejant,
    Couchant,
    Dormant,
    Statant,
    Segreant,
    Other(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Figure {
    Lion,
    Eagle,
    Bee,
    Serpent,
    Raven,
    Mullet,
    CrossPate,
    OakBranch,
    Other(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Facing {
    Dexter,
    Sinister,
    FacingViewer,
    TowardShieldDexter,
    TowardShieldSinister,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Charge {
    pub figure: Figure,
    pub posture: Posture,
    pub tincture: Tincture,
    pub crowned: bool,
    pub facing: Option<Facing>,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Shield {
    pub field: Tincture,
    pub charges: Vec<Charge>,
    /// Free-form shape note where the source gives one ("във формата на щит").
    pub shape: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Crown {
    /// What the crown is modelled on, as the source says.
    pub model: String,
    pub crosses: Option<u32>,
    pub cross_above: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Supporter {
    pub figure: Figure,
    pub posture: Posture,
    pub tincture: Tincture,
    pub crowned: bool,
    pub facing: Facing,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Compartment {
    CrossedOakBranches { fruited: bool },
    Other(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MottoBand {
    pub field: String,
    pub edge: Option<String>,
    pub letters: Tincture,
}

/// The structured achievement — the vocabulary layer that lets consumers
/// reason about composition instead of comparing pixels.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Achievement {
    pub shield: Shield,
    pub crown: Option<Crown>,
    pub supporters: Vec<Supporter>,
    pub compartment: Option<Compartment>,
    pub motto_band: Option<MottoBand>,
}

/// The blazon: a verbatim description in its own language, an optional gloss,
/// and the structured achievement. The verbatim text is evidence; the
/// structure is interpretation of it and says so through its source.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Blazon {
    pub lang: String,
    pub text: String,
    pub gloss: Option<String>,
    pub achievement: Achievement,
    pub source: SourceClaim,
}

// ── motto: the original and its translations ──────────────────────────────────

/// The original inscription. Immutable by construction: no mutation surface
/// exists, and every translation binds the digest of the exact bytes it
/// translated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OriginalText {
    text: String,
    pub lang: String,
    pub script: Option<String>,
    pub source: SourceClaim,
}

impl OriginalText {
    pub fn new(
        text: &str,
        lang: &str,
        script: Option<&str>,
        source: SourceClaim,
    ) -> Result<OriginalText, LawViolation> {
        let lang = lang.to_string();
        check_lang_tag(&lang)?;
        if text.is_empty() {
            return Err(LawViolation::EmptyOriginalText);
        }
        Ok(OriginalText {
            text: text.to_string(),
            lang,
            script: script.map(|s| s.to_string()),
            source,
        })
    }

    /// Exact-bytes constructor. Malformed UTF-8 is refused — an encoding
    /// fault is a detection, not a repair.
    pub fn from_bytes(
        bytes: &[u8],
        lang: &str,
        script: Option<&str>,
        source: SourceClaim,
    ) -> Result<OriginalText, LawViolation> {
        let text = String::from_utf8(bytes.to_vec()).map_err(|_| LawViolation::InvalidUtf8)?;
        OriginalText::new(&text, lang, script, source)
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    pub fn bytes(&self) -> &[u8] {
        self.text.as_bytes()
    }

    /// The digest translations bind: domain ‖ lang ‖ NUL ‖ exact bytes.
    pub fn digest(&self) -> RecordDigest {
        let mut h = Sha256::new();
        h.update(ORIGINAL_DOMAIN.as_bytes());
        h.update(b"\x00");
        h.update(self.lang.as_bytes());
        h.update(b"\x00");
        h.update(self.text.as_bytes());
        RecordDigest(h.finalize().into())
    }
}

/// How a translation relates to its original. Only `OfficialRendering`
/// claims the entity's own voice, and that claim must be earned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TranslationRelationship {
    OfficialRendering,
    LiteralGloss,
    DynamicEquivalent,
    DocumentedVariant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    Ltr,
    Rtl,
}

/// One translation of the motto, carrying its own provenance. The
/// attestation tier is bLANGUAGEdock's own `TranslationAttestation` — a
/// machine draft renders differently from a community-attested rendering and
/// can never masquerade as one, because the type carries which it is.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MottoTranslation {
    pub lang: String,
    pub direction: Direction,
    pub text: String,
    pub relationship: TranslationRelationship,
    pub attestation: TranslationAttestation,
    /// The digest of the original these words translate. If the original
    /// changes, this is how the alteration is caught.
    pub translates_original: RecordDigest,
    /// Required (with legal/primary-official grade) for OfficialRendering.
    pub authority_basis: Option<SourceClaim>,
    pub note: Option<String>,
}

/// A technical-term glossary entry. The detector that matters: within one
/// (source language → target language) pair, two DIFFERENT source terms may
/// not share one target — that is a dropped heraldic distinction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TermEntry {
    pub source_term: String,
    pub source_lang: String,
    pub target_term: String,
    pub target_lang: String,
    pub source: SourceClaim,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TermGlossary {
    pub entries: Vec<TermEntry>,
}

/// A dropped distinction, detected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TermCollision {
    pub source_lang: String,
    pub target_lang: String,
    pub term_a: String,
    pub term_b: String,
    pub shared_target: String,
}

impl TermGlossary {
    /// Distinct source terms must keep distinct targets within a language
    /// pair. Returns the collisions; empty means the distinctions survived.
    pub fn collisions(&self) -> Vec<TermCollision> {
        use std::collections::BTreeMap;
        // (src_lang, tgt_lang, target_term) → set of distinct source terms
        let mut seen: BTreeMap<(String, String, String), Vec<String>> = BTreeMap::new();
        for e in &self.entries {
            let k = (
                e.source_lang.clone(),
                e.target_lang.clone(),
                e.target_term.clone(),
            );
            let v = seen.entry(k).or_default();
            if !v.iter().any(|t| t == &e.source_term) {
                v.push(e.source_term.clone());
            }
        }
        let mut out = Vec::new();
        for ((sl, tl, tgt), terms) in seen {
            if terms.len() > 1 {
                for window in terms.windows(2) {
                    out.push(TermCollision {
                        source_lang: sl.clone(),
                        target_lang: tl.clone(),
                        term_a: window[0].clone(),
                        term_b: window[1].clone(),
                        shared_target: tgt.clone(),
                    });
                }
            }
        }
        out
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Motto {
    pub original: OriginalText,
    pub translations: Vec<MottoTranslation>,
    pub glossary: TermGlossary,
}

// ── associations, usage, disputes ─────────────────────────────────────────────

/// Who or what the arms belong to. A living person is a pseudonym here or
/// the record refuses to validate — the genealogy display law.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AssociationSubject {
    Jurisdiction {
        name: String,
        code: Option<String>,
    },
    Family {
        name: String,
    },
    Organization {
        name: String,
    },
    Person {
        name: Option<String>,
        pseudonym: Option<String>,
        living: bool,
    },
}

impl AssociationSubject {
    /// The only form a living person may take: a pseudonym, no name.
    pub fn living_pseudonym(pseudonym: &str) -> AssociationSubject {
        AssociationSubject::Person {
            name: None,
            pseudonym: Some(pseudonym.to_string()),
            living: true,
        }
    }
    /// A named historical (non-living) person.
    pub fn historical_name(name: &str) -> AssociationSubject {
        AssociationSubject::Person {
            name: Some(name.to_string()),
            pseudonym: None,
            living: false,
        }
    }
}

/// On what basis the association stands. The last two are forcibly
/// `Unverified` — tradition and heuristics are never documentation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssociationBasis {
    Charter,
    Armorial,
    SecondaryScholarship,
    FamilyTradition,
    HeuristicEra,
}

impl AssociationBasis {
    pub fn is_documentary(&self) -> bool {
        matches!(
            self,
            AssociationBasis::Charter
                | AssociationBasis::Armorial
                | AssociationBasis::SecondaryScholarship
        )
    }
}

/// A heraldic association is a sourced assertion — never proof of blood,
/// descent, or entitlement.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeraldicAssociation {
    pub subject: AssociationSubject,
    pub basis: AssociationBasis,
    pub source: SourceClaim,
    pub note: Option<String>,
}

/// A usage condition. Official classification requires at least one `Legal`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageCondition {
    pub statement: String,
    pub kind: ClaimKind,
    pub source: SourceClaim,
}

/// A retained dispute. Two sourced positions minimum; the crate has no
/// operation that adjudicates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dispute {
    pub topic: String,
    pub positions: Vec<DisputePosition>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DisputePosition {
    pub statement: String,
    pub source: SourceClaim,
}

// ── the record ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistoricPeriod {
    pub from: String,
    pub to: Option<String>,
    pub note: Option<String>,
}

/// A symbol as evidence: identity, version, grammar, text, sources, uses,
/// associations, disputes. Construction is cheap; [`SymbolRecord::seal`] is
/// where the laws bite.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SymbolRecord {
    pub id: String,
    pub revision: u32,
    /// Digest of the sealed predecessor's canonical bytes, if any.
    pub supersedes: Option<RecordDigest>,
    pub title: String,
    pub classification: Classification,
    pub entity: AssociationSubject,
    pub jurisdiction: Option<String>,
    pub period: HistoricPeriod,
    pub blazon: Blazon,
    pub motto: Motto,
    pub sources: Vec<SourceClaim>,
    pub usage: Vec<UsageCondition>,
    pub associations: Vec<HeraldicAssociation>,
    pub disputes: Vec<Dispute>,
    pub asset: Option<AssetRef>,
    pub notes: Vec<String>,
}

impl SymbolRecord {
    /// Canonical bytes: compact deterministic JSON. No maps, no floats,
    /// fixed field order — byte-stable for a given record.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("canonical JSON of a SymbolRecord cannot fail")
    }

    pub fn digest_of_bytes(bytes: &[u8]) -> RecordDigest {
        RecordDigest::of_bytes(RECORD_DOMAIN, bytes)
    }

    /// The laws, as named errors. Every validator here exists because an
    /// adversarial test in `tests/adversarial.rs` demonstrates the attack it
    /// refuses.
    pub fn validate(&self) -> Result<(), LawViolation> {
        check_lang_tag(&self.blazon.lang)?;

        // V3 — translations bind the original they translate.
        let original = self.motto.original.digest();
        for t in &self.motto.translations {
            check_lang_tag(&t.lang)?;
            if t.translates_original != original {
                return Err(LawViolation::TranslationTargetsDifferentOriginal {
                    expected: original.hex(),
                    found: t.translates_original.hex(),
                    lang: t.lang.clone(),
                });
            }
            // V2 — the translation-authority law.
            if t.relationship == TranslationRelationship::OfficialRendering {
                let basis_ok = t
                    .authority_basis
                    .as_ref()
                    .map(|b| {
                        matches!(
                            b.grade,
                            ProvenanceGrade::PrimaryLegal | ProvenanceGrade::PrimaryOfficial
                        )
                    })
                    .unwrap_or(false);
                if !basis_ok {
                    return Err(LawViolation::OfficialRenderingNeedsAuthorityBasis {
                        lang: t.lang.clone(),
                    });
                }
                if matches!(t.attestation, TranslationAttestation::Machine { .. }) {
                    return Err(LawViolation::MachineCannotBeOfficial {
                        lang: t.lang.clone(),
                    });
                }
            }
        }

        // V1 — official classification is earned by law.
        if self.classification == Classification::OfficialStateInsignia {
            let has_legal_source = self
                .sources
                .iter()
                .any(|s| s.kind == ClaimKind::Legal && s.grade == ProvenanceGrade::PrimaryLegal);
            if !has_legal_source {
                return Err(LawViolation::OfficialClassNeedsLegalSource);
            }
            let has_legal_usage = self.usage.iter().any(|u| {
                u.kind == ClaimKind::Legal
                    && matches!(
                        u.source.grade,
                        ProvenanceGrade::PrimaryLegal | ProvenanceGrade::PrimaryOfficial
                    )
            });
            if !has_legal_usage {
                return Err(LawViolation::OfficialClassNeedsLegalUsage);
            }
            // V8 — the entity itself must be associated by charter on legal source.
            let entity_chartered = self.associations.iter().any(|a| {
                a.basis == AssociationBasis::Charter
                    && a.source.grade == ProvenanceGrade::PrimaryLegal
                    && subjects_name_equal(&a.subject, &self.entity)
            });
            if !entity_chartered {
                return Err(LawViolation::OfficialEntityNeedsLegalAssociation);
            }
        }

        // V4 — living persons are pseudonyms.
        // V-era — tradition is never documentation.
        for a in &self.associations {
            if let AssociationSubject::Person {
                name,
                pseudonym,
                living,
            } = &a.subject
            {
                if *living {
                    if name.is_some() {
                        return Err(LawViolation::LivingPersonNameForbidden);
                    }
                    if pseudonym.is_none() {
                        return Err(LawViolation::LivingPersonNeedsPseudonym);
                    }
                }
            }
            if !a.basis.is_documentary() && a.source.grade != ProvenanceGrade::Unverified {
                return Err(LawViolation::TraditionMustBeUnverified);
            }
            if a.basis.is_documentary()
                && !matches!(
                    a.source.grade,
                    ProvenanceGrade::PrimaryLegal
                        | ProvenanceGrade::PrimaryOfficial
                        | ProvenanceGrade::SecondaryScholarly
                )
            {
                return Err(LawViolation::DocumentaryBasisNeedsExternalSource);
            }
        }

        // Disputes retain at least two sourced positions.
        for d in &self.disputes {
            if d.positions.len() < 2 {
                return Err(LawViolation::DisputeNeedsTwoPositions {
                    topic: d.topic.clone(),
                });
            }
        }

        Ok(())
    }

    /// Validate, digest, and close. A `SealedRecord` is the unit that
    /// travels; its digest is the handle every later check compares against.
    pub fn seal(self) -> Result<SealedRecord, LawViolation> {
        self.validate()?;
        let bytes = self.canonical_bytes();
        let digest = SymbolRecord::digest_of_bytes(&bytes);
        Ok(SealedRecord {
            record: self,
            digest,
        })
    }
}

fn subjects_name_equal(a: &AssociationSubject, b: &AssociationSubject) -> bool {
    use AssociationSubject::*;
    match (a, b) {
        (Jurisdiction { name: x, .. }, Jurisdiction { name: y, .. })
        | (Family { name: x }, Family { name: y })
        | (Organization { name: x }, Organization { name: y }) => x == y,
        _ => false,
    }
}

fn check_lang_tag(tag: &str) -> Result<(), LawViolation> {
    if tag.is_empty() || tag.contains(' ') || tag.contains('\u{0}') {
        return Err(LawViolation::BadLanguageTag(tag.to_string()));
    }
    Ok(())
}

// ── sealed records and revision chains ────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub struct SealedRecord {
    record: SymbolRecord,
    digest: RecordDigest,
}

impl SealedRecord {
    pub fn record(&self) -> &SymbolRecord {
        &self.record
    }
    pub fn digest(&self) -> RecordDigest {
        self.digest
    }
    /// Recompute from bytes — the integrity check every migration and every
    /// hand-off ends with.
    pub fn digest_matches(&self, bytes: &[u8]) -> bool {
        SymbolRecord::digest_of_bytes(bytes) == self.digest
    }
    pub fn into_parts(self) -> (SymbolRecord, RecordDigest) {
        (self.record, self.digest)
    }
    /// Rebuild from canonical bytes + a digest to trust. The bytes are
    /// validated (laws) AND checked against the claimed digest.
    pub fn from_bytes(bytes: &[u8], claimed: RecordDigest) -> Result<SealedRecord, LawViolation> {
        let record: SymbolRecord =
            serde_json::from_slice(bytes).map_err(|e| LawViolation::NotDecodable(e.to_string()))?;
        record.validate()?;
        let digest = SymbolRecord::digest_of_bytes(bytes);
        if digest != claimed {
            return Err(LawViolation::DigestMismatch {
                claimed: claimed.hex(),
                actual: digest.hex(),
            });
        }
        Ok(SealedRecord { record, digest })
    }
}

/// A record's standing in a chain of revisions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RevisionStatus {
    Current,
    SupersededBy(RecordDigest),
}

/// Revisions succeed, never rewrite: the chain keeps predecessors verifiable
/// as history (their digests still check) while naming the current record.
#[derive(Debug, Clone, PartialEq)]
pub struct RevisionChain {
    records: Vec<SealedRecord>,
}

impl RevisionChain {
    pub fn build(records: Vec<SealedRecord>) -> Result<RevisionChain, LawViolation> {
        if records.is_empty() {
            return Err(LawViolation::EmptyChain);
        }
        let id = records[0].record().id.clone();
        for w in records.windows(2) {
            let (prev, next) = (&w[0], &w[1]);
            if prev.record().id != id || next.record().id != id {
                return Err(LawViolation::ChainIdMismatch);
            }
            if next.record().revision <= prev.record().revision {
                return Err(LawViolation::ChainRevisionNotIncreasing);
            }
            match next.record().supersedes {
                Some(d) if d == prev.digest() => {}
                _ => return Err(LawViolation::BadSupersedesLink),
            }
        }
        Ok(RevisionChain { records })
    }

    /// The record no other record supersedes.
    pub fn current(&self) -> &SealedRecord {
        self.records.last().expect("non-empty by construction")
    }

    pub fn status(&self, r: &SealedRecord) -> RevisionStatus {
        for later in &self.records {
            if later.record().supersedes == Some(r.digest()) {
                return RevisionStatus::SupersededBy(later.digest());
            }
        }
        RevisionStatus::Current
    }

    /// The stale-revision detector: presenting a superseded revision as
    /// current is refused here, by name.
    pub fn assert_current(&self, r: &SealedRecord) -> Result<(), LawViolation> {
        match self.status(r) {
            RevisionStatus::Current => Ok(()),
            RevisionStatus::SupersededBy(by) => Err(LawViolation::StaleRevision {
                id: r.record().id.clone(),
                revision: r.record().revision,
                superseded_by: by.hex(),
            }),
        }
    }

    pub fn records(&self) -> &[SealedRecord] {
        &self.records
    }
}

// ── the bSiGner/bzDiD seam ────────────────────────────────────────────────────

/// A signed attestation over a record. What a signature establishes: the
/// signer held the key, and these bytes are the bytes signed. What it never
/// establishes: historical truth, legal rights, or the correctness of any
/// claim inside the record. The `signer` is a did:b: string validated by the
/// bzDiD root's own parser — identity continuity is not a local regex.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignedSeal {
    pub domain: String,
    pub signer: String,
    /// The bsigner key id whose envelope carries the signature.
    pub key_id: String,
    pub payload_digest: RecordDigest,
    pub note: Option<String>,
}

impl SignedSeal {
    pub fn new(
        signer_did: &str,
        key_id: &str,
        payload_digest: RecordDigest,
        note: Option<&str>,
    ) -> Result<SignedSeal, LawViolation> {
        bzdid::BzDid::parse(signer_did).map_err(|e| LawViolation::BadSignerDid(e))?;
        Ok(SignedSeal {
            domain: SEAL_DOMAIN.to_string(),
            signer: signer_did.to_string(),
            key_id: key_id.to_string(),
            payload_digest,
            note: note.map(|s| s.to_string()),
        })
    }

    pub fn signer_did(&self) -> Result<bzdid::BzDid, String> {
        bzdid::BzDid::parse(&self.signer)
    }

    /// The exact bytes a signer must sign: domain ‖ NUL ‖ seal canon ‖ NUL ‖
    /// record canonical bytes. Domain separation is why an envelope made for
    /// one record cannot be presented for another: the content hash is over
    /// different bytes and the verifier refuses.
    pub fn payload_bytes(&self, record_bytes: &[u8]) -> Vec<u8> {
        let seal_canon = serde_json::to_vec(self).expect("seal canon cannot fail");
        let mut out =
            Vec::with_capacity(SEAL_DOMAIN.len() + seal_canon.len() + record_bytes.len() + 2);
        out.extend_from_slice(SEAL_DOMAIN.as_bytes());
        out.push(0);
        out.extend_from_slice(&seal_canon);
        out.push(0);
        out.extend_from_slice(record_bytes);
        out
    }

    /// Structural verification before any cryptography: the domain must be
    /// this domain and the payload digest must be the record's digest.
    pub fn verify_structure(&self, record_bytes: &[u8]) -> Result<(), LawViolation> {
        if self.domain != SEAL_DOMAIN {
            return Err(LawViolation::WrongSealDomain {
                found: self.domain.clone(),
            });
        }
        let actual = SymbolRecord::digest_of_bytes(record_bytes);
        if self.payload_digest != actual {
            return Err(LawViolation::DigestMismatch {
                claimed: self.payload_digest.hex(),
                actual: actual.hex(),
            });
        }
        self.signer_did().map_err(LawViolation::BadSignerDid)?;
        Ok(())
    }
}

// ── named errors ──────────────────────────────────────────────────────────────

/// Every law this crate enforces, as a named refusal. The adversarial suite
/// exists to show these firing on real attacks, not on paper.
#[derive(Debug, Clone, PartialEq)]
pub enum LawViolation {
    EmptyOriginalText,
    InvalidUtf8,
    BadLanguageTag(String),
    OfficialClassNeedsLegalSource,
    OfficialClassNeedsLegalUsage,
    OfficialEntityNeedsLegalAssociation,
    OfficialRenderingNeedsAuthorityBasis {
        lang: String,
    },
    MachineCannotBeOfficial {
        lang: String,
    },
    TranslationTargetsDifferentOriginal {
        expected: String,
        found: String,
        lang: String,
    },
    LivingPersonNameForbidden,
    LivingPersonNeedsPseudonym,
    TraditionMustBeUnverified,
    DocumentaryBasisNeedsExternalSource,
    DisputeNeedsTwoPositions {
        topic: String,
    },
    DigestMismatch {
        claimed: String,
        actual: String,
    },
    NotDecodable(String),
    BadSignerDid(String),
    WrongSealDomain {
        found: String,
    },
    EmptyChain,
    ChainIdMismatch,
    ChainRevisionNotIncreasing,
    BadSupersedesLink,
    StaleRevision {
        id: String,
        revision: u32,
        superseded_by: String,
    },
}

impl std::fmt::Display for LawViolation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LawViolation::EmptyOriginalText => write!(f, "an original inscription may not be empty"),
            LawViolation::InvalidUtf8 => write!(f, "exact bytes must be valid UTF-8; an encoding fault is a detection, not a repair"),
            LawViolation::BadLanguageTag(t) => write!(f, "bad language tag {t:?}"),
            LawViolation::OfficialClassNeedsLegalSource => write!(f, "official state insignia requires a primary-legal source claim"),
            LawViolation::OfficialClassNeedsLegalUsage => write!(f, "official state insignia requires a legal usage condition"),
            LawViolation::OfficialEntityNeedsLegalAssociation => write!(f, "the entity of official insignia must be associated by charter on a primary-legal source"),
            LawViolation::OfficialRenderingNeedsAuthorityBasis { lang } => write!(f, "an official rendering into {lang} needs an authority basis of legal or primary-official grade"),
            LawViolation::MachineCannotBeOfficial { lang } => write!(f, "a machine draft can never be the official rendering into {lang}"),
            LawViolation::TranslationTargetsDifferentOriginal { expected, found, lang } => write!(f, "the {lang} translation binds original {found} but the record carries {expected} — the original was altered after translation"),
            LawViolation::LivingPersonNameForbidden => write!(f, "a living person is a pseudonym, never a name"),
            LawViolation::LivingPersonNeedsPseudonym => write!(f, "a living subject requires a pseudonym"),
            LawViolation::TraditionMustBeUnverified => write!(f, "family tradition and heuristic bases are forcibly unverified — era is not support"),
            LawViolation::DocumentaryBasisNeedsExternalSource => write!(f, "a documentary basis needs an external source (legal, official, or scholarly)"),
            LawViolation::DisputeNeedsTwoPositions { topic } => write!(f, "dispute {topic:?} must retain at least two sourced positions"),
            LawViolation::DigestMismatch { claimed, actual } => write!(f, "digest drift: claimed {claimed}, actual {actual}"),
            LawViolation::NotDecodable(e) => write!(f, "record does not decode: {e}"),
            LawViolation::BadSignerDid(e) => write!(f, "signer is not a valid did:b: identity: {e}"),
            LawViolation::WrongSealDomain { found } => write!(f, "seal domain is {found:?}, expected {SEAL_DOMAIN:?}"),
            LawViolation::EmptyChain => write!(f, "a revision chain may not be empty"),
            LawViolation::ChainIdMismatch => write!(f, "a chain carries one record id"),
            LawViolation::ChainRevisionNotIncreasing => write!(f, "chain revisions must strictly increase"),
            LawViolation::BadSupersedesLink => write!(f, "each revision must name its predecessor's digest"),
            LawViolation::StaleRevision { id, revision, superseded_by } => write!(f, "record {id} revision {revision} is superseded by {superseded_by} and may not be presented as current"),
        }
    }
}

impl std::error::Error for LawViolation {}
