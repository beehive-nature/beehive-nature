//! The reference specimens.
//!
//! Two records, deliberately of different kinds, so every law has something
//! real to bite on:
//!
//! 1. [`bulgaria_national_arms`] — the coat of arms of the Republic of
//!    Bulgaria per Закон за герба на Република България (ДВ бр.62,
//!    5 August 1997). `OfficialStateInsignia`, earning that classification
//!    from the law itself. **A research and conformance specimen: not
//!    permission to reproduce, and not BNR branding.**
//! 2. [`house_achievement`] — the estate's own House of von Zutphen
//!    achievement per `docs/BLAZON.md`. `OriginalCreative`, carried by
//!    family tradition that is forcibly `Unverified`, with the UNVERIFIED
//!    quarters retained as a live dispute rather than smoothed over.
//!
//! Every claim below names its source, its access date, its kind, its truth,
//! and its grade. Where an extraction was mediated or possibly lossy, the
//! `access_note` says so — the record's honesty about its own making is part
//! of the record.

use crate::*;
use language_authority::TranslationAttestation;

pub const ACCESS_DATE: &str = "2026-10-09";

/// sha256 of `assets/house/house-achievement.svg` as it stands in-tree.
/// Recomputed and asserted by `tests/positive.rs` — if the asset changes,
/// this provenance binding is SUPPOSED to break, loudly.
pub const HOUSE_ACHIEVEMENT_SHA256: &str =
    "51ab9a681c5768a15c4db20cb96cd0be87247c81913960292c111bc2e05889e0"; // PUBLIC-CONSTANT (sha256 of the in-tree house achievement, computed 2026-10-09)

// ── sources ───────────────────────────────────────────────────────────────────

/// The law itself, as published by lex.bg. Чл. 2 (1) verbatim carries the
/// motto. The extraction is webReader-mediated; one earlier partial read of
/// the same page differed in two words — see `access_note`.
fn law_claim() -> SourceClaim {
    SourceClaim {
        label: "Закон за герба на Република България — lex.bg".into(),
        url: "https://lex.bg/laws/ldoc/2134146564".into(),
        publisher: "lex.bg (Национално издателство / National Publishing House)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: Some(
            "Чл. 2. (1) Гербът на Република България е изправен златен коронован лъв на \
             тъмночервено поле във формата на щит. Над щита е разположена голяма корона, \
             първообраз на короните на българските владетели от Втората българска държава, \
             с пет кръста и отделно разположен кръст над самата корона, а щитът е поддържан \
             от два златни короновани изправени лъва, обърнати към щита от лявата и дясната \
             хералдическа страна; те стоят върху два кръстосани дъбови клонки с желуди. Под \
             щита е разположена бяла лента с трикольорна кантова ивичка, през която са \
             прехвърлени краищата на дъбовите клонки, на която със златни букви е написано \
             „Съединението прави силата“."
                .into(),
        ),
        access_note: Some(
            "Extracted via webReader on 2026-10-09. An earlier partial extraction of the same \
             page read „те стоять“ and „през които“ where this read reads „те стоят“ and \
             „през която“ — transport-level variance suspected. Verify against the ДВ бр.62 \
             scan before legal quotation. Law header also records: изм. - ДВ. бр. 100 от \
             29 Декември 2017г. (an amendment exists; its text was not examined by this seat)."
                .into(),
        ),
    }
}

fn law_adoption_claim() -> SourceClaim {
    SourceClaim {
        label: "Закон за герба — adoption and promulgation line (lex.bg)".into(),
        url: "https://lex.bg/laws/ldoc/2134146564".into(),
        publisher: "lex.bg".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: Some(
            "ЗАКОН за герба на Република България Обн. ДВ. бр.62 от 5 Август 1997г., изм. - \
             ДВ. бр. 100 от 29 Декември 2017г. … § 1. Законът е приет от XXXVIII Народно \
             събрание на 31 юли 1997 г. и е подпечатан с държавния печат."
                .into(),
        ),
        access_note: Some("adoption/promulgation lines assembled from the same webReader extraction as the law text".into()),
    }
}

/// The Council of Ministers' own English page. It renders the motto in
/// English — the state's own rendering — and describes the arms, but cites
/// no law and carries no date.
fn gov_en_claim() -> SourceClaim {
    SourceClaim {
        label: "National Symbols — Bulgaria's Coat of Arms (government.bg, English edition)".into(),
        url: "https://www.government.bg/en/About-Bulgaria/NATIONAL-SYMBOLS/Bulgaria%E2%80%99s-Coat-of-Arms".into(),
        publisher: "Министерски съвет на Република България / Council of Ministers of the Republic of Bulgaria".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Translation,
        truth: TruthKind::LanguageEquivalence,
        grade: ProvenanceGrade::PrimaryOfficial,
        verbatim: Some("United we stand Strong".into()),
        access_note: Some(
            "Content received through an assistant-mediated fetch on 2026-10-09; the motto \
             string was reported verbatim (including the capital S), the descriptive prose \
             as a summary. The page names no legal instrument and shows no publication \
             date. Site footer states content is under CC BY-SA 4.0; no separate licensing \
             claim for emblem images was found."
                .into(),
        ),
    }
}

fn wiki_coa_claim() -> SourceClaim {
    SourceClaim {
        label: "Coat of arms of Bulgaria — English Wikipedia".into(),
        url: "https://en.wikipedia.org/wiki/Coat_of_arms_of_Bulgaria".into(),
        publisher: "Wikipedia contributors (user-edited)".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Historical,
        truth: TruthKind::HistoricalInterpretation,
        grade: ProvenanceGrade::Tertiary,
        verbatim: Some(
            "1991 Constitution, Art. 164: \"The coat of arms of the Republic of Bulgaria \
             shall depict a gold lion rampant on a dark gules shield.\" … the crown \
             \"significantly differs from the crowns known from medieval portraits\" such \
             as those in the Tetraevangelia of Tsar Ivan Alexander … motto renderings \
             \"Unity makes strength\" and \"Strength through Unity\"."
                .into(),
        ),
        access_note: Some(
            "Assistant-mediated extraction of the live article; quote-level fidelity to the \
             page at access time is UNVERIFIED — recheck before scholarly citation. Article \
             history (1879 Tarnovo Constitution Art. 21; 1927 middle form legitimated \
             excluding dynastic elements; 1946–1990 socialist emblems; 1991 restoration; \
             1997 law after partisan controversy; Stemmatographia 1741 ← Vitezović colour \
             reversal ← Korenich-Neorich 1595 lineage) is recorded here as tertiary \
             historical interpretation, not as established fact."
                .into(),
        ),
    }
}

fn wiki_lion_claim() -> SourceClaim {
    SourceClaim {
        label: "Lion (heraldry) — English Wikipedia".into(),
        url: "https://en.wikipedia.org/wiki/Lion_(heraldry)".into(),
        publisher: "Wikipedia contributors (user-edited)".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Convention,
        truth: TruthKind::HistoricalInterpretation,
        grade: ProvenanceGrade::Tertiary,
        verbatim: Some(
            "Rampant – standing erect in profile with forepaws raised; the default position \
             for beasts. … French blazon calls a walking lion with head facing the viewer a \
             léopard; the rampant guardant lion is their lion-léopardé — though Rietstap \
             and von Volborth reportedly reverse these definitions."
                .into(),
        ),
        access_note: Some(
            "Assistant-mediated extraction; the attitude vocabulary (rampant, passant, \
             guardant, regardant, salient, sejant, couchant, dormant, statant, segreant) is \
             used by this crate as CONVENTION, and the cross-language naming divergence is \
             precisely why the glossary-collision law exists."
                .into(),
        ),
    }
}

/// parliament.bg is listed by the order as a primary source; this seat's
/// tools could not extract its content. Honest absence, recorded.
fn parliament_claim() -> SourceClaim {
    SourceClaim {
        label: "Народно събрание — national symbols page (parliament.bg/bg/20)".into(),
        url: "https://www.parliament.bg/bg/20".into(),
        publisher: "Народно събрание на Република България".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: None,
        access_note: Some(
            "JS-rendered SPA: two extraction attempts (WebFetch, webReader) returned only \
             the page title. UNEXTRACTED by this seat on 2026-10-09 — listed for \
             completeness; no claim rests on it."
                .into(),
        ),
    }
}

fn internal_claim() -> SourceClaim {
    SourceClaim {
        label: "bHERALDRY-001 lane (order + dispatch)".into(),
        url: "docs/dispatches/2026-10-09-bheraldry.md".into(),
        publisher: "zCode seat (GLM-5.3), beehive-nature".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Authenticity,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::InternalTree,
        verbatim: None,
        access_note: Some("the lane's own record of what it did and did not examine".into()),
    }
}

fn term_bridge_claim() -> SourceClaim {
    SourceClaim {
        label: "terminology bridge BG↔EN (gov.bg EN rendering + Lion (heraldy))".into(),
        url: "https://en.wikipedia.org/wiki/Lion_(heraldry)".into(),
        publisher: "assembled by this lane from the two cited sources".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Convention,
        truth: TruthKind::LanguageEquivalence,
        grade: ProvenanceGrade::SecondaryScholarly,
        verbatim: None,
        access_note: Some(
            "„изправен“ is the law's own word; „rampant“ is the conventional English \
             heraldic term for the attitude the English sources describe. The bridge is a \
             CONVENTION claim, not a quotation from either source."
                .into(),
        ),
    }
}

fn family_word_claim() -> SourceClaim {
    SourceClaim {
        label: "the founder's word — family tradition".into(),
        url: "docs/BLAZON.md".into(),
        publisher: "the founder, via BLAZON.md's UNVERIFIED markings".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Historical,
        truth: TruthKind::HistoricalInterpretation,
        grade: ProvenanceGrade::Unverified,
        verbatim: Some("the FAMILY's descent claim from its bearers: UNVERIFIED — borne on the founder's word".into()),
        access_note: Some("graded Unverified BY CONSTRUCTION: the tradition basis may never carry a documentary grade (the era≠support law)".into()),
    }
}

fn blazon_md_claim() -> SourceClaim {
    SourceClaim {
        label: "BLAZON — the House of von Zutphen, the achievement of Design".into(),
        url: "docs/BLAZON.md".into(),
        publisher: "the estate (status: PROPOSED — awaiting founder sign-off)".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE.into(),
        kind: ClaimKind::Artistic,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::InternalTree,
        verbatim: Some(
            "mīlestība ir karalis · ความรักคือราชา · love is king — (The Latvian, the Thai, \
             the English; the year of the founding, the year of the present, the year of \
             the thousand.)"
                .into(),
        ),
        access_note: Some("in-tree canon at the lane's base commit; the blazon is Design's export text, read from the text/x-dc data layer per BLAZON.md".into()),
    }
}

// ── specimen 1: the Bulgarian national arms ───────────────────────────────────

pub fn bulgaria_national_arms_v1() -> SymbolRecord {
    let law = law_claim();
    let law_adoption = law_adoption_claim();
    let gov_en = gov_en_claim();
    let wiki_coa = wiki_coa_claim();
    let wiki_lion = wiki_lion_claim();
    let parliament = parliament_claim();
    let internal = internal_claim();
    let term_bridge = term_bridge_claim();

    // The original inscription: exact bytes of the law's own motto, between
    // its quotation marks. Nothing upstream may rewrite it.
    let original = OriginalText::new("Съединението прави силата", "bg", Some("Cyrl"), law.clone())
        .expect("the law's motto is valid UTF-8 and a valid language tag");
    let original_digest = original.digest();

    let machine_draft = "zCode/GLM-5.3 machine draft, 2026-10-09";

    let translations = vec![
        MottoTranslation {
            lang: "en".into(),
            direction: Direction::Ltr,
            text: "United we stand Strong".into(),
            relationship: TranslationRelationship::OfficialRendering,
            attestation: TranslationAttestation::SpeakerProvided {
                speaker: "Council of Ministers of the Republic of Bulgaria — government.bg, English edition".into(),
            },
            translates_original: original_digest,
            authority_basis: Some(gov_en.clone()),
            note: Some("capitalisation verbatim from the source page, including the capital „Strong“; the state's own English rendering, not a gloss".into()),
        },
        MottoTranslation {
            lang: "en".into(),
            direction: Direction::Ltr,
            text: "Unity makes strength".into(),
            relationship: TranslationRelationship::DocumentedVariant,
            attestation: TranslationAttestation::SpeakerProvided {
                speaker: "English Wikipedia contributors (user-edited, tertiary)".into(),
            },
            translates_original: original_digest,
            authority_basis: None,
            note: Some("a common English rendering; NOT the state's own".into()),
        },
        MottoTranslation {
            lang: "en".into(),
            direction: Direction::Ltr,
            text: "Strength through Unity".into(),
            relationship: TranslationRelationship::DocumentedVariant,
            attestation: TranslationAttestation::SpeakerProvided {
                speaker: "English Wikipedia contributors (user-edited, tertiary)".into(),
            },
            translates_original: original_digest,
            authority_basis: None,
            note: Some("a second common English rendering; both variants are RETAINED with the original as the only authority".into()),
        },
        MottoTranslation {
            lang: "lv".into(),
            direction: Direction::Ltr,
            text: "Vienotība rada spēku".into(),
            relationship: TranslationRelationship::DynamicEquivalent,
            attestation: TranslationAttestation::Machine { engine: machine_draft.into() },
            translates_original: original_digest,
            authority_basis: None,
            note: Some("UNATTESTED machine draft (⚙ per the language corpus convention); literal sense „unity creates strength“; awaits a Latvian authority or speaker".into()),
        },
        MottoTranslation {
            lang: "zh-Hans".into(),
            direction: Direction::Ltr,
            text: "团结就是力量".into(),
            relationship: TranslationRelationship::DynamicEquivalent,
            attestation: TranslationAttestation::Machine { engine: machine_draft.into() },
            translates_original: original_digest,
            authority_basis: None,
            note: Some("UNATTESTED machine draft (⚙); idiomatic Simplified-Chinese rendering; awaits a Chinese authority or speaker".into()),
        },
        MottoTranslation {
            lang: "ar".into(),
            direction: Direction::Rtl,
            text: "الوحدة تصنع القوة".into(),
            relationship: TranslationRelationship::DynamicEquivalent,
            attestation: TranslationAttestation::Machine { engine: machine_draft.into() },
            translates_original: original_digest,
            authority_basis: None,
            note: Some("UNATTESTED machine draft (⚙); exercises the RTL direction field at the data layer only — no RTL rendering surface exists in the estate yet (honest absence)".into()),
        },
    ];

    let glossary = TermGlossary {
        entries: vec![
            TermEntry {
                source_term: "изправен".into(),
                source_lang: "bg".into(),
                target_term: "rampant".into(),
                target_lang: "en".into(),
                source: term_bridge.clone(),
            },
            TermEntry {
                source_term: "щит".into(),
                source_lang: "bg".into(),
                target_term: "shield".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
            TermEntry {
                source_term: "тъмночервено поле".into(),
                source_lang: "bg".into(),
                target_term: "dark red (gules) field".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
            TermEntry {
                source_term: "златен".into(),
                source_lang: "bg".into(),
                target_term: "gold / or".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
            TermEntry {
                source_term: "коронован".into(),
                source_lang: "bg".into(),
                target_term: "crowned".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
            TermEntry {
                source_term: "дъбови клонки с желуди".into(),
                source_lang: "bg".into(),
                target_term: "oak branches with fruits (acorns)".into(),
                target_lang: "en".into(),
                source: wiki_coa.clone(),
            },
            TermEntry {
                source_term: "лента".into(),
                source_lang: "bg".into(),
                target_term: "band (scroll)".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
            TermEntry {
                source_term: "корона".into(),
                source_lang: "bg".into(),
                target_term: "crown".into(),
                target_lang: "en".into(),
                source: gov_en.clone(),
            },
        ],
    };

    let blazon_text = law.verbatim.clone().expect("Чл. 2 (1) verbatim is present");

    SymbolRecord {
        id: "bg/national-arms".into(),
        revision: 1,
        supersedes: None,
        title: "Coat of arms of the Republic of Bulgaria (1997)".into(),
        classification: Classification::OfficialStateInsignia,
        entity: AssociationSubject::Jurisdiction { name: "Republic of Bulgaria".into(), code: Some("BG".into()) },
        jurisdiction: Some("BG".into()),
        period: HistoricPeriod {
            from: "1997-08-05".into(),
            to: None,
            note: Some("in force since promulgation (ДВ бр.62, 5 August 1997); adopted by the XXXVIII Народно събрание on 31 July 1997 per the law's own § 1; the 2017 amendment (ДВ бр.100) was not examined by this seat".into()),
        },
        blazon: Blazon {
            lang: "bg".into(),
            text: blazon_text,
            gloss: Some(
                "Gules, a lion rampant Or crowned; above the shield a great crown modelled on \
                 those of the rulers of the Second Bulgarian State with five crosses and one \
                 cross above it; two golden crowned lions rampant supporting the shield from \
                 the dexter and sinister heraldic sides, standing on two crossed fruited oak \
                 branches; below the shield a white band with a tricolour border carries the \
                 motto in golden letters."
                    .into(),
            ),
            achievement: Achievement {
                shield: Shield {
                    field: Tincture::Gules,
                    charges: vec![Charge {
                        figure: Figure::Lion,
                        posture: Posture::Rampant,
                        tincture: Tincture::Or,
                        crowned: true,
                        facing: None,
                        count: 1,
                    }],
                    shape: Some("във формата на щит (in the shape of a shield)".into()),
                },
                crown: Some(Crown {
                    model: "първообраз на короните на българските владетели от Втората българска държава (modelled on the crowns of the rulers of the Second Bulgarian State)".into(),
                    crosses: Some(5),
                    cross_above: true,
                }),
                supporters: vec![
                    Supporter { figure: Figure::Lion, posture: Posture::Rampant, tincture: Tincture::Or, crowned: true, facing: Facing::TowardShieldDexter },
                    Supporter { figure: Figure::Lion, posture: Posture::Rampant, tincture: Tincture::Or, crowned: true, facing: Facing::TowardShieldSinister },
                ],
                compartment: Some(Compartment::CrossedOakBranches { fruited: true }),
                motto_band: Some(MottoBand {
                    field: "бяла (white)".into(),
                    edge: Some("трикольорна кантова ивичка (tricolour border stripe)".into()),
                    letters: Tincture::Or,
                }),
            },
            source: law.clone(),
        },
        motto: Motto { original, translations, glossary },
        sources: vec![law.clone(), law_adoption, gov_en.clone(), wiki_coa.clone(), wiki_lion.clone(), parliament, internal.clone(), term_bridge],
        usage: vec![
            UsageCondition {
                statement: "Чл. 3 (1): the arms are placed on the state seal in the manner the State Seal Law establishes. (Гербът на Република България се поставя на държавния печат по начина, установен в Закона за държавния печат.)".into(),
                kind: ClaimKind::Legal,
                source: law.clone(),
            },
            UsageCondition {
                statement: "Чл. 3 (2): the depiction may be placed on other places determined by law, and elements of it may be reproduced on badges, commemorative medals and the like, ONLY by an act of the Council of Ministers. (…само с акт на Министерския съвет.)".into(),
                kind: ClaimKind::Legal,
                source: law.clone(),
            },
            UsageCondition {
                statement: "This BNR record is a research and conformance specimen. It is NOT permission to reproduce the arms or any element of them, and BNR does not adopt them as branding.".into(),
                kind: ClaimKind::Convention,
                source: internal.clone(),
            },
        ],
        associations: vec![HeraldicAssociation {
            subject: AssociationSubject::Jurisdiction { name: "Republic of Bulgaria".into(), code: Some("BG".into()) },
            basis: AssociationBasis::Charter,
            source: law.clone(),
            note: Some("the association IS the law: by Чл. 1 the arms are a state symbol expressing the independence and sovereignty of the Bulgarian people and state".into()),
        }],
        disputes: vec![
            Dispute {
                topic: "The official English rendering of the motto".into(),
                positions: vec![
                    DisputePosition { statement: "„United we stand Strong“ — the state's own English page.".into(), source: gov_en.clone() },
                    DisputePosition { statement: "„Unity makes strength“ — a common English rendering.".into(), source: wiki_coa.clone() },
                    DisputePosition { statement: "„Strength through Unity“ — a second common English rendering.".into(), source: wiki_coa.clone() },
                ],
                note: Some("RETAINED, not adjudicated. The original Bulgarian text of the law is the only inscription with authority; every English form above is a rendering with its own provenance. This dispute is the living example of the order's founding observation.".into()),
            },
            Dispute {
                topic: "Historicity of the crown's model".into(),
                positions: vec![
                    DisputePosition { statement: "The law models the crown on those of the rulers of the Second Bulgarian State (Втората българска държава, 1185–1396).".into(), source: law.clone() },
                    DisputePosition { statement: "The crown as drawn „significantly differs from the crowns known from medieval portraits“ such as those in the Tetraevangelia of Tsar Ivan Alexander.".into(), source: wiki_coa.clone() },
                ],
                note: Some("RETAINED as competing evidence layers: a legal first-image claim and an art-historical observation about the drawn form. Neither erases the other.".into()),
            },
            Dispute {
                topic: "Which date the 1997 arms were „adopted“".into(),
                positions: vec![
                    DisputePosition { statement: "Приет от XXXVIII Народно събрание на 31 юли 1997 г. — the law's own closing paragraph.".into(), source: law_adoption_claim() },
                    DisputePosition { statement: "„4 August 1997“ — the date the English Wikipedia article gives for the law.".into(), source: wiki_coa.clone() },
                ],
                note: Some("RETAINED. The two dates may name different events (parliamentary adoption vs. promulgation ДВ бр.62 on 5 August 1997); the record does not pick one.".into()),
            },
        ],
        asset: None,
        notes: vec![
            "Research and conformance specimen only — NOT permission to reproduce, NOT adoption of a state's official insignia as BNR branding (order bHERALDRY-001, Mission).".into(),
            "The law's artistic depictions (приложения 1 и 2 per Чл. 2 (2)) are an integral part of the law but are deliberately NOT captured here: the lex.bg extraction offered them only as blob URLs, and this record commits no state-insignia bytes.".into(),
            "English „rampant“ renders the law's own „изправен“ (literally „erect/upright“) — a terminology bridge recorded in the glossary as a CONVENTION claim, never as a quotation.".into(),
            "parliament.bg/bg/20 remains UNEXTRACTED by this seat (JS-rendered); see its source claim. No claim in this record rests on it.".into(),
        ],
    }
}

// ── specimen 2: the house achievement ─────────────────────────────────────────

pub fn house_achievement_v1() -> SymbolRecord {
    let blazon_md = blazon_md_claim();
    let internal = internal_claim();

    let original = OriginalText::new(
        "mīlestība ir karalis",
        "lv",
        Some("Latn"),
        blazon_md.clone(),
    )
    .expect("the BLAZON motto is valid UTF-8");
    let original_digest = original.digest();

    SymbolRecord {
        id: "bnr/house-achievement".into(),
        revision: 1,
        supersedes: None,
        title: "The House of von Zutphen — the achievement of Design (BNR original creative work)".into(),
        classification: Classification::OriginalCreative,
        entity: AssociationSubject::Family { name: "House of von Zutphen".into() },
        jurisdiction: None,
        period: HistoricPeriod {
            from: "2026".into(),
            to: None,
            note: Some("per docs/BLAZON.md, status PROPOSED — the blazon is as Design wrote it; the founder's sign-off is the next seal in the chain".into()),
        },
        blazon: Blazon {
            lang: "en".into(),
            text: "Quartered achievement: I Denmark (three lions passant, hearts strewn); II the raven rising; III Sweden (three crowns); IV Zutphen (argent, a lion rampant gules crowned or); centre Auseklis and the bee that carries the heart; V the serpent in the eye; VI England and the crossing; VII the Chinese name 北方國王; VIII thirteen mullets in annulo; crest Austras koks and two orbits; supporters Zalktis and the serpent of the eye; compartment Jumis between two crosses of Māra on a Norse ring-chain.".into(),
            gloss: None,
            achievement: Achievement {
                shield: Shield {
                    field: Tincture::Other("quartered (per BLAZON.md)".into()),
                    charges: vec![],
                    shape: None,
                },
                crown: None,
                supporters: vec![
                    Supporter { figure: Figure::Serpent, posture: Posture::Other("coiled (Urnes-style)".into()), tincture: Tincture::Or, crowned: false, facing: Facing::Dexter },
                    Supporter { figure: Figure::Serpent, posture: Posture::Other("coiled (Urnes-style)".into()), tincture: Tincture::Other("banded enamel — six flat courses".into()), crowned: false, facing: Facing::Sinister },
                ],
                compartment: Some(Compartment::Other("Jumis between two crosses of Māra, on a Norse ring-chain".into())),
                motto_band: None,
            },
            source: blazon_md.clone(),
        },
        motto: Motto {
            original,
            translations: vec![
                MottoTranslation {
                    lang: "th".into(),
                    direction: Direction::Ltr,
                    text: "ความรักคือราชา".into(),
                    relationship: TranslationRelationship::DocumentedVariant,
                    attestation: TranslationAttestation::SpeakerProvided { speaker: "House of von Zutphen — docs/BLAZON.md (PROPOSED)".into() },
                    translates_original: original_digest,
                    authority_basis: None,
                    note: Some("the Thai member of the house's three-tongue motto line, as recorded in BLAZON.md".into()),
                },
                MottoTranslation {
                    lang: "en".into(),
                    direction: Direction::Ltr,
                    text: "love is king".into(),
                    relationship: TranslationRelationship::DocumentedVariant,
                    attestation: TranslationAttestation::SpeakerProvided { speaker: "House of von Zutphen — docs/BLAZON.md (PROPOSED)".into() },
                    translates_original: original_digest,
                    authority_basis: None,
                    note: Some("the English member of the motto line; the Latvian original is the motto of record".into()),
                },
            ],
            glossary: TermGlossary { entries: vec![] },
        },
        sources: vec![blazon_md.clone(), internal.clone()],
        usage: vec![],
        associations: vec![HeraldicAssociation {
            subject: AssociationSubject::Family { name: "House of von Zutphen".into() },
            basis: AssociationBasis::FamilyTradition,
            source: family_word_claim(),
            note: Some("borne on the founder's word, which is how arms were always first borne (BLAZON.md); therefore forcibly UNVERIFIED here — tradition is not documentation".into()),
        }],
        disputes: vec![Dispute {
            topic: "The four family-genealogy quarters (II raven descent, V serpent-eye, VI Remington line, VII China)".into(),
            positions: vec![
                DisputePosition { statement: "Marked UNVERIFIED in BLAZON.md — borne on the founder's word; the national coats (Denmark, Sweden, Zutphen outline) and the Latvian folk symbols carry their citations.".into(), source: blazon_md.clone() },
                DisputePosition { statement: "No documentary support for these four quarters has been located in-tree by this lane; they await record evidence.".into(), source: internal.clone() },
            ],
            note: Some("RETAINED as the standing example that a heraldic record can hold beauty and uncertainty in the same frame without collapsing either.".into()),
        }],
        asset: Some(AssetRef {
            path: "assets/house/house-achievement.svg".into(),
            media: "image/svg+xml".into(),
            digest_hex: Some(HOUSE_ACHIEVEMENT_SHA256.into()),
            classification: Classification::OriginalCreative,
            license_note: Some("BNR house mark; AGPL-3.0-only kernel tree; see docs/BLAZON.md and docs/LICENSING.md; status PROPOSED awaiting founder sign-off".into()),
        }),
        notes: vec![
            "An ORIGINAL CREATIVE WORK of the estate, informed by structural heraldic principles — it is not, and must never be relabelled as, any state's official insignia.".into(),
            "The asset binding below is the counterfeit-detector seam: only the sha256 of the exact bytes is the mark; any visual lookalike is a different digest and a different thing.".into(),
        ],
    }
}

// ── a successor helper, for the revision-chain law ────────────────────────────

/// The correction path: a NEW revision that supersedes the sealed
/// predecessor by its digest. The predecessor's bytes stay exactly what they
/// were — history remains verifiable; only "current" moves.
pub fn successor(prev: &SealedRecord, correction_note: &str) -> SymbolRecord {
    let mut next = prev.record().clone();
    next.revision = prev.record().revision + 1;
    next.supersedes = Some(prev.digest());
    next.notes
        .push(format!("revision {}: {}", next.revision, correction_note));
    next
}

// ── revision 2: the gazette pass (2026-10-10) ─────────────────────────────────
//
// What changed and why, in one breath: a second extraction of the same lex.bg
// page disagreed with the first in ~7 wordings, an independent commercial
// rendering (ciela.net) corroborated the SECOND wording, the Bulgarian
// Wikipedia carries no amendment history at all, and the official gazette
// portal was located but its scan could not be machine-read by this seat.
// So revision 2: switches the working text to the corroborated rendering,
// RETAINS both renderings as a dispute (only a scan can adjudicate), and
// WITHDRAWS the 2017-amendment line as a transport artifact (withdrawn named
// withdrawn — no independent rendering carries it).

pub const ACCESS_DATE_R2: &str = "2026-10-10";

/// The law again, as extracted on 2026-10-10 — the rendering corroborated by
/// ciela.net's snippet of the same instrument. Differences from the 2026-10-09
/// extraction are recorded in the transport-variance dispute, NOT resolved
/// here; only the gazette scan can do that.
fn law_claim_r2() -> SourceClaim {
    SourceClaim {
        label: "Закон за герба на Република България — lex.bg, second extraction".into(),
        url: "https://lex.bg/laws/ldoc/2134146564".into(),
        publisher: "lex.bg (Национално издателство / National Publishing House)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: Some(
            "Чл. 2. (1) Гербът на Република България е изправен златен коронован лъв на \
             тъмночервено поле във формата на щит. Над щита има голяма корона, първообраз на \
             която са короните на българските владетели от Втората българска държава, с пет \
             кръста и отделно разположен кръст над самата корона. Щитът е поддържан от два \
             златни короновани изправени лъва, обърнати към щита от лява и дясна \
             хералдическа страна. Те стоят върху две кръстосани дъбови клонки с плодове. Под \
             щита върху прехвърлена през краищата на дъбовите клонки бяла лента с трикольорен \
             кант е изписано със златни букви „Съединението прави силата“."
                .into(),
        ),
        access_note: Some(
            "webReader extraction, 2026-10-10. This rendering is corroborated on its \
             diverging phrases by an independent commercial rendering of the same instrument \
             (ciela.net issue page, search-snippet mediated) and its opening sentence by the \
             Bulgarian Wikipedia. Transport variance against the 2026-10-09 extraction is \
             RETAINED as a dispute; the header on THIS read shows no amendment line."
                .into(),
        ),
    }
}

fn law_adoption_claim_r2() -> SourceClaim {
    SourceClaim {
        label: "Закон за герба — adoption and promulgation line (lex.bg, second extraction)".into(),
        url: "https://lex.bg/laws/ldoc/2134146564".into(),
        publisher: "lex.bg".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: Some(
            "ЗАКОН ЗА ГЕРБ НА РЕПУБЛИКА БЪЛГАРИЯ Обн. ДВ. бр.62 от 5 Август 1997г. … § 1. \
             Законът е приет от XXXVIII Народно събрание на 31 юли 1997 г. и е подпечатан с \
             държавния печат."
                .into(),
        ),
        access_note: Some(
            "2026-10-10 extraction: the header carries NO amendment line. The „изм. - ДВ. бр. \
             100 от 29 Декември 2017г.“ fragment of the 2026-10-09 extraction is WITHDRAWN as \
             a transport artifact (see the lane's internal claim); it survives only in \
             revision 1's immutable bytes."
                .into(),
        ),
    }
}

fn ciela_claim() -> SourceClaim {
    SourceClaim {
        label: "Държавен вестник, брой 62 от 5.VIII.1997 — ciela.net rendering".into(),
        url: "https://www.ciela.net/issue".into(),
        publisher: "Ciela (commercial legal database)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::Tertiary,
        verbatim: Some(
            "Чл. 2. (1) Гербът на Република България е изправен златен коронован лъв на \
             тъмночервено поле във формата на щит. Над щита има голяма корона, първообраз на …"
                .into(),
        ),
        access_note: Some(
            "search-snippet mediated (direct fetch refused); quoted only through the snippet's \
             own ellipsis. Corroborates the 2026-10-10 lex.bg rendering on the phrase where \
             the two lex.bg extractions diverge („Над щита има голяма корона, първообраз на …“)."
                .into(),
        ),
    }
}

fn bgwiki_claim_r2() -> SourceClaim {
    SourceClaim {
        label: "Герб на България — Bulgarian Wikipedia".into(),
        url: "https://bg.wikipedia.org/wiki/Герб_на_България".into(),
        publisher: "Wikipedia contributors (user-edited)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Historical,
        truth: TruthKind::HistoricalInterpretation,
        grade: ProvenanceGrade::Tertiary,
        verbatim: Some(
            "Гербът на Република България е изправен златен коронован лъв на тъмночервено поле \
             във формата на щит … Чл. 164: Гербът на Република България е изправен златен \
             коронован лъв на тъмночервено поле във формата на щит."
                .into(),
        ),
        access_note: Some(
            "assistant-mediated extraction, 2026-10-10. The article carries NO amendment \
             history for the law — no Закон за изменение и допълнение, no ДВ бр.100/2017 \
             reference — and links the law text to Wikisource. Decision № 1 of 4 April 1995 \
             (case № 5/1995) of the Constitutional Court is recorded as interpreting Чл. 164: \
             the article's list of elements is not exhaustive and a crown is permissible."
                .into(),
        ),
    }
}

fn constcourt_claim() -> SourceClaim {
    SourceClaim {
        label: "Решение № 1 от 4 април 1995 г. по дело № 5/1995 — Конституционен съд".into(),
        url: "https://bg.wikipedia.org/wiki/Герб_на_България".into(),
        publisher: "Конституционен съд на Република България (as reported by the Bulgarian Wikipedia article)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Legal,
        truth: TruthKind::HistoricalInterpretation,
        grade: ProvenanceGrade::Tertiary,
        verbatim: Some(
            "Решение № 1 от 4 април 1995 г., дело № 5/1995: списъкът в чл. 164 не е изчерпателен \
             и короната е допустима (the list of elements in Art. 164 is not exhaustive and a \
             crown is permissible)."
                .into(),
        ),
        access_note: Some(
            "the ruling PREDATES the 1997 law and concerns the constitutional article, not the \
             statute; carried as historical interpretation of the crown's constitutional \
             permissibility. Ruling text not fetched directly (constcourt.bg unattempted) — \
             tertiary channel, recheck before scholarly citation."
                .into(),
        ),
    }
}

fn com_decision_480_claim() -> SourceClaim {
    SourceClaim {
        label: "Решение № 480 от 28 август 2017 г. — Министерски съвет".into(),
        url: "https://dv.parliament.bg".into(),
        publisher: "Министерски съвет, published in Държавен вестник (1 септември 2017 г.)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Authority,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryOfficial,
        verbatim: Some(
            "РЕШЕНИЕ № 480 ОТ 28 АВГУСТ 2017 Г. за даване на съгласие изображението на герба на \
             Република България да бъде включено в марката на …"
                .into(),
        ),
        access_note: Some(
            "search-snippet mediated (the gazette portal's own indexed snippet); direct fetch \
             of the act not completed by this seat. This is a Council of Ministers CONSENT \
             under Чл. 3 (2) — an act of the usage mechanism, NOT an amendment of the law. \
             The organization named in the elided tail was not extracted."
                .into(),
        ),
    }
}

fn com_decree_476_claim() -> SourceClaim {
    SourceClaim {
        label: "Постановление № 476 от 17 декември 1997 г. — Министерски съвет".into(),
        url: "https://pris.government.bg".into(),
        publisher: "Министерски съвет (as surfaced via strategy.bg and pris.government.bg)".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Authority,
        truth: TruthKind::Authority,
        grade: ProvenanceGrade::PrimaryOfficial,
        verbatim: None,
        access_note: Some(
            "search-snippet mediated only: approved the graphic and plastic depictions for use \
             of the arms (одобряване на графичните и пластичните образци). This is the \
             mechanism that gave the law's приложения 1–2 their approved forms. Direct text \
             not fetched — UNVERIFIED at quote level."
                .into(),
        ),
    }
}

fn dv_portal_claim() -> SourceClaim {
    SourceClaim {
        label: "Държавен вестник — official archive portal (dv.parliament.bg/DVWeb)".into(),
        url: "https://dv.parliament.bg/DVWeb/broeveList.faces".into(),
        publisher: "Народно събрание на Република България".into(),
        lang: "bg".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Authenticity,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::PrimaryLegal,
        verbatim: None,
        access_note: Some(
            "the primary archive portal was LOCATED and its server-rendered issue index \
             fetched (74,791 bytes, HTTP 200); but issue deep links are JSF POST flows and \
             five direct URL patterns returned 404. The бр. 62/1997 SCAN was therefore NOT \
             machine-read by this seat on 2026-10-10. Scan-level quote verification remains \
             OPEN — a named next-owner item, not a silent gap."
                .into(),
        ),
    }
}

fn internal_claim_r2() -> SourceClaim {
    SourceClaim {
        label: "bHERALDRY lane round 2 (order + dispatch)".into(),
        url: "docs/dispatches/2026-10-10-bheraldry-r2.md".into(),
        publisher: "zCode seat (GLM-5.3), beehive-nature".into(),
        lang: "en".into(),
        accessed: ACCESS_DATE_R2.into(),
        kind: ClaimKind::Authenticity,
        truth: TruthKind::SourceAuthenticity,
        grade: ProvenanceGrade::InternalTree,
        verbatim: None,
        access_note: Some(
            "carries the WITHDRAWAL: the „изм. - ДВ. бр. 100 от 29 Декември 2017г.“ line of \
             the 2026-10-09 extraction is withdrawn as a transport artifact — no independent \
             rendering carries an amendment, and the 2017 act that exists (Решение № 480) is \
             a CoM consent, not a statute change."
                .into(),
        ),
    }
}

/// The Bulgarian national arms, revision 2 — the gazette pass. Revision 1 is
/// immutable ([`bulgaria_national_arms_v1`], digest frozen in the vector
/// test); this revision supersedes it by that exact digest.
pub fn bulgaria_national_arms() -> SymbolRecord {
    let v1 = bulgaria_national_arms_v1();
    let v1_digest = SymbolRecord::digest_of_bytes(&v1.canonical_bytes());
    let law_r2 = law_claim_r2();
    let ciela = ciela_claim();
    let bgwiki_r2 = bgwiki_claim_r2();
    let constcourt = constcourt_claim();
    let decision480 = com_decision_480_claim();
    let decree476 = com_decree_476_claim();
    let dv_portal = dv_portal_claim();
    let internal_r2 = internal_claim_r2();
    let law_adoption_r2 = law_adoption_claim_r2();

    let mut r = v1.clone();
    r.revision = 2;
    r.supersedes = Some(v1_digest);
    r.title = "Coat of arms of the Republic of Bulgaria (1997) — gazette pass".into();

    // the adoption claim moves to the second extraction, whose header carries
    // no amendment line; the r1 LAW claim stays (the transport-variance
    // dispute cites it), but the withdrawn header fragment leaves the sources
    r.sources[1] = law_adoption_r2;

    // the working text moves to the corroborated rendering; the law claim it
    // reads from moves with it (the blazon-verbatim consistency law).
    r.blazon.text = law_r2.verbatim.clone().expect("r2 verbatim present");
    r.blazon.source = law_r2.clone();

    r.period.note = Some(
        "in force since promulgation (ДВ бр.62, 5 August 1997); adopted by the XXXVIII Народно \
         събрание on 31 July 1997 per the law's own § 1. The 2017 amendment line of the first \
         extraction is WITHDRAWN as a transport artifact (see notes)."
            .into(),
    );

    r.sources.extend([
        law_r2.clone(),
        ciela,
        bgwiki_r2.clone(),
        constcourt.clone(),
        decision480.clone(),
        decree476.clone(),
        dv_portal.clone(),
        internal_r2.clone(),
    ]);

    // the usage mechanism, exercised in the record's own lifetime: a 2017
    // CoM consent under Чл. 3 (2), and the 1997 decree that approved the
    // depictions the law annexes.
    r.usage.push(UsageCondition {
        statement: "Решение № 480 от 28.08.2017 (ДВ, 1 септември 2017): the Council of Ministers \
                     gave consent for the arms' image to be included in an organization's mark — \
                     the Чл. 3 (2) mechanism in force. Search-snippet mediated; recheck the act \
                     before quotation."
            .into(),
        kind: ClaimKind::Legal,
        source: decision480,
    });

    r.associations[0].source = law_r2.clone();

    // the crown dispute gains its constitutional dimension
    r.disputes[1].positions.push(DisputePosition {
        statement: "Решение № 1/1995 (дело № 5/1995): чл. 164's list of elements is not \
                    exhaustive and a crown is permissible — settled the crown's constitutionality \
                    before the 1997 law was drafted."
            .into(),
        source: constcourt,
    });

    // the new dispute: the two transport renderings of Чл. 2 (1), retained
    r.disputes.push(Dispute {
        topic: "Exact wording of Чл. 2 (1) across transport renderings".into(),
        positions: vec![
            DisputePosition {
                statement: "2026-10-09 lex.bg extraction (rev 1's working text): „е разположена \
                            голяма корона … с желуди … трикольорна кантова ивичка … написано“."
                    .into(),
                source: r.sources[0].clone(),
            },
            DisputePosition {
                statement: "2026-10-10 lex.bg extraction (rev 2's working text), corroborated by \
                            ciela.net's rendering of the same instrument: „има голяма корона … с \
                            плодове … трикольорен кант … изписано“."
                    .into(),
                source: law_r2.clone(),
            },
            DisputePosition {
                statement: "The primary gazette scan (ДВ бр.62/1997) — NOT yet machine-read by \
                            this seat; the portal is located but its deep links are JSF flows. No \
                            scan-based position exists yet."
                    .into(),
                source: dv_portal,
            },
        ],
        note: Some(
            "RETAINED, not adjudicated. Revision 2 carries the corroborated rendering as WORKING \
             TEXT only — that is a choice of which transport to read from, not a ruling on what \
             the ДВ print says. Only the scan can close this."
                .into(),
        ),
    });

    r.notes.extend([
        "REVISION 2 (2026-10-10): working text switched to the 2026-10-10 lex.bg rendering after \
         a second extraction of the same page disagreed with the first in ~7 wordings and an \
         independent rendering (ciela.net) corroborated the second; both renderings are RETAINED \
         in the transport-variance dispute. Revision 1's bytes are immutable and its frozen \
         digest still pins them."
            .into(),
        "WITHDRAWN: the „изм. - ДВ. бр. 100 от 29 Декември 2017г.“ line of the 2026-10-09 \
         extraction. No independent rendering carries an amendment — the 2026-10-10 lex.bg \
         header has no such line, the Bulgarian Wikipedia records no amendment history, and the \
         2017 act that exists (Решение № 480 от 28.08.2017) is a Council of Ministers consent \
         under Чл. 3 (2), not a statute change. Withdrawn as a transport artifact, named here \
         per the corrective discipline."
            .into(),
        "The depictions the law annexes (приложения 1–2 per Чл. 2 (2)) were given approved forms \
         by Постановление № 476 от 17.12.1997 (search-snippet mediated, UNVERIFIED at quote \
         level) — still deliberately not captured in this record."
            .into(),
        "Constitutional layer: чл. 164 (1991) fixes the shield; Решение № 1/1995 held the \
         article's element list non-exhaustive, permitting the crown. Carried as historical \
         interpretation via a tertiary channel."
            .into(),
    ]);

    r
}

/// The house achievement, revision 2 — a claim restructure demanded by the
/// blazon-verbatim consistency law (added with this revision): the motto
/// quote that rev 1's blazon source carried belongs to the motto's
/// provenance, not to the blazon's. No content claim changed.
pub fn house_achievement() -> SymbolRecord {
    let v1 = house_achievement_v1();
    let v1_digest = SymbolRecord::digest_of_bytes(&v1.canonical_bytes());
    let blazon_md_quoteless = {
        let mut c = v1.blazon.source.clone();
        c.label =
            "BLAZON — the quarters (summary by this lane; the file's own text is the canon)".into();
        c.verbatim = None;
        c.access_note = Some(
            "rev 1 cited the motto line as this claim's verbatim; the blazon-verbatim \
             consistency law (revision 2) requires a blazon source's quote to be the blazon \
             text, so the motto quote now lives only with the motto's own provenance."
                .into(),
        );
        c
    };

    let mut r = v1.clone();
    r.revision = 2;
    r.supersedes = Some(v1_digest);
    r.blazon.source = blazon_md_quoteless;
    r.notes.push(
        "REVISION 2 (2026-10-10): claim restructure only — the blazon source no longer carries \
         the motto line as its verbatim (that quote belongs to the motto's provenance). The \
         family association stays FamilyTradition/Unverified; the four UNVERIFIED quarters stay \
         a retained dispute. Revision 1's bytes are immutable (digest computed and recorded in \
         the round-1 dispatch)."
            .into(),
    );
    r
}
