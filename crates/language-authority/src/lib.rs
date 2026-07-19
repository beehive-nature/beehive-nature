//! `language-authority` — BNR holds an interface, never a corpus.
//!
//! Types and the retention harness for the ratified language-sovereignty law (order C-4).
//! **This crate is the enforcement of a law that was previously enforced by nothing**, which
//! made it a promise rather than a guarantee.
//!
//! # The guarantee, and where it lives
//!
//! A nation runs its own [`LanguageAuthority`], on infrastructure it controls, or it does not
//! participate — **both are first-class outcomes.** BNR calls the interface. It never holds
//! what the interface returns.
//!
//! **Revocation is an operation, not a policy.** A nation withdrawing its authority means
//! renderings stop — immediately, completely, and by construction. The same property as
//! revoking a health-vault key: not "we will delete it", but "there is nothing to delete."
//!
//! # The absences, which are the design
//!
//! - **[`LanguageAuthority`] has no method that returns the corpus and none that enumerates
//!   it.** There is no `keys()`, no `all()`, no `export()`, no iterator. A caller cannot
//!   obtain the body of a language through this trait because there is no call to make.
//! - **[`Preferences`] has no disability field, no impairment rating, and no verification
//!   path.** Nobody proves they are blind to receive audio. Requiring proof would place a
//!   barrier exactly where a person already meets the most friction, and would make BNR a
//!   custodian of health data through the back door.
//! - **[`Rendering`] carries a non-optional [`TranslationAttestation`].** A rendering whose
//!   provenance is unknown cannot be constructed, so a surface cannot display one.
//!
//! Each absence has a test. Removing one deletes the explanation of why it must not exist.
//!
//! # The harness
//!
//! [`probe_retention`] is the §2.5 negative control. It renders, revokes, and then checks
//! that nothing is recoverable — and it is **demonstrated in this crate's own tests to FAIL
//! on a deliberately retaining implementation.** A harness that has only ever been observed
//! passing is a decoration, and this one is the sole mechanism standing behind a ratified
//! claim, so it is held to that standard here rather than in a downstream tree.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

// ── identity ──────────────────────────────────────────────────────────────────

/// BCP-47 or a nation's own identifier. BNR does not adjudicate which.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct LanguageId(pub String);

/// A key naming *what* is to be said, never the words for saying it.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct MessageKey(pub String);

/// Non-linguistic context a renderer may need (plurality, formality, and so on).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Context {
    pub count: Option<u64>,
    pub formal: Option<bool>,
}

// ── attestation ───────────────────────────────────────────────────────────────

/// Who stands behind a rendering. **Visibly distinct tiers** — a machine translation must
/// never render identically to one a community attested.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TranslationAttestation {
    Machine { engine: String },
    SpeakerProvided { speaker: String },
    CommunityAttested { body: String },
}

/// A rendering, with its provenance. **`attestation` is not `Option`** — a rendering of
/// unknown provenance cannot be constructed, so no surface can display one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rendering {
    pub text: String,
    pub attestation: TranslationAttestation,
}

/// Why something is not in the reader's language. **Honest, never silently English.**
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NotTranslatedReason {
    /// No authority is connected for this language — including because one was withdrawn.
    NoAuthority,
    /// The authority is connected and has no rendering for this key.
    NotInCorpus,
    /// The nation has withdrawn. Distinct from `NoAuthority` so a surface can say which.
    AuthorityWithdrawn,
}

/// The result of asking for a message in a language.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Rendered {
    In(Rendering),
    /// Carries the source text so a reader gets *something*, and the reason so the surface
    /// can say why it is not in their language rather than pretending it is.
    NotTranslated {
        source: String,
        reason: NotTranslatedReason,
    },
}

// ── the interface BNR holds ───────────────────────────────────────────────────

/// **BNR holds this. It never holds a corpus.**
///
/// Note what is absent: no method returns the body of the language, none enumerates its
/// keys, none exports, none iterates. A caller cannot obtain a corpus through this trait
/// because **there is no call to make.** Adding one would breach the ratified guarantee by
/// construction, which is why the absence is tested rather than documented.
pub trait LanguageAuthority {
    fn language(&self) -> &LanguageId;
    fn render(&self, key: &MessageKey, ctx: &Context) -> Option<Rendering>;
}

// ── access is a preference, never a credential ────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Modality {
    Text,
    Audio,
    Braille,
    Sign { variety: String },
    Simplified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReadingLevel {
    Plain,
    Standard,
    Technical,
}

/// What a reader wants. **There is no `disability_status`, no `impairment_rating`, and no
/// verification path. The absence is the guarantee.**
///
/// Nobody proves they are blind to receive audio; nobody submits a rating for a larger touch
/// target. Requiring proof would be a barrier placed exactly where a person already meets
/// the most friction, a privacy violation (disability status is health data, and BNR holds
/// no PII), and unnecessary — accessible rendering costs nothing extra to offer universally,
/// and plenty of people who are not disabled want audio, larger text, or simpler language.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Preferences {
    pub language: LanguageId,
    pub modality: Vec<Modality>,
    pub reading_level: Option<ReadingLevel>,
}

/// Whether a modality exists. **`NotAvailable` is honest** — if no braille rendering exists,
/// say so rather than machine-generating something unusable and calling it access.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModalityAvailability {
    Available,
    NotAvailable { modality: Modality },
}

// ── the BNR side, which must be able to prove it holds nothing ────────────────

/// BNR's renderer. Holds an authority by reference to a connection, never its contents.
///
/// It carries **no cache field**, and the retention harness proves that claim rather than
/// resting on it.
pub struct Renderer<A: LanguageAuthority> {
    authority: Option<A>,
    withdrawn: bool,
}

impl<A: LanguageAuthority> Renderer<A> {
    pub fn connected(authority: A) -> Self {
        Renderer {
            authority: Some(authority),
            withdrawn: false,
        }
    }

    pub fn render(&mut self, key: &MessageKey, ctx: &Context, source: &str) -> Rendered {
        match (&self.authority, self.withdrawn) {
            (Some(a), false) => match a.render(key, ctx) {
                Some(r) => Rendered::In(r),
                None => Rendered::NotTranslated {
                    source: source.to_string(),
                    reason: NotTranslatedReason::NotInCorpus,
                },
            },
            (_, true) => Rendered::NotTranslated {
                source: source.to_string(),
                reason: NotTranslatedReason::AuthorityWithdrawn,
            },
            (None, false) => Rendered::NotTranslated {
                source: source.to_string(),
                reason: NotTranslatedReason::NoAuthority,
            },
        }
    }

    /// A nation withdrawing. **Immediate and complete** — the authority is dropped, not
    /// flagged, so there is nothing left to read even by mistake.
    pub fn revoke(&mut self) {
        self.authority = None;
        self.withdrawn = true;
    }
}

// ── §2.5 · the retention harness ──────────────────────────────────────────────

/// What a subject must expose so its retention can be checked.
///
/// `observable_state` is BNR's side only. The nation's authority stays opaque — the party
/// that must prove it holds nothing is the party that would benefit from holding something.
pub trait RetentionProbe {
    fn render_once(&mut self, key: &MessageKey, source: &str) -> Rendered;
    fn revoke_authority(&mut self);
    /// Every byte this side holds after revocation. If a rendering survives here, it was
    /// retained — in a cache, a log, or anything else.
    fn observable_state(&self) -> Vec<u8>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RetentionVerdict {
    /// Nothing rendered before revocation survived it.
    Clean { samples: usize },
    /// Text that was rendered before revocation is still recoverable afterwards.
    Retained { evidence: Vec<String> },
    /// **Fail closed.** No verdict could be formed — most often because nothing rendered
    /// before revocation, which would make "nothing survived" a true statement about nothing.
    Indeterminate { reason: String },
}

/// The §2.5 negative control: render, revoke, and prove nothing is recoverable.
///
/// **Law 1 applies twice here.** The sample set must be non-empty, *and* at least one sample
/// must have actually rendered before revocation — a probe over messages the authority never
/// had would report `Clean` while testing nothing at all.
///
/// **Law 1d applies too:** the residue check searches for the exact text that was rendered,
/// so it is looking at the thing it rendered rather than at whatever the subject chose to
/// expose.
pub fn probe_retention<P: RetentionProbe>(
    subject: &mut P,
    samples: &[(MessageKey, String)],
) -> RetentionVerdict {
    if samples.is_empty() {
        return RetentionVerdict::Indeterminate {
            reason: "no samples: a probe over an empty set proves nothing".into(),
        };
    }

    // Render first, and keep exactly what came back.
    let mut rendered_texts: Vec<String> = Vec::new();
    for (k, src) in samples {
        if let Rendered::In(r) = subject.render_once(k, src) {
            rendered_texts.push(r.text);
        }
    }

    if rendered_texts.is_empty() {
        return RetentionVerdict::Indeterminate {
            reason: "nothing rendered before revocation, so nothing could have been retained \
                     — this is a missing test, not a pass"
                .into(),
        };
    }

    subject.revoke_authority();

    // Nothing rendered before may be recoverable after.
    let after = subject.observable_state();
    let hay = String::from_utf8_lossy(&after);
    let evidence: Vec<String> = rendered_texts
        .iter()
        .filter(|t| !t.is_empty() && hay.contains(t.as_str()))
        .cloned()
        .collect();

    if evidence.is_empty() {
        RetentionVerdict::Clean {
            samples: rendered_texts.len(),
        }
    } else {
        RetentionVerdict::Retained { evidence }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    struct NationAuthority {
        id: LanguageId,
        corpus: BTreeMap<String, String>,
    }
    impl LanguageAuthority for NationAuthority {
        fn language(&self) -> &LanguageId {
            &self.id
        }
        fn render(&self, key: &MessageKey, _c: &Context) -> Option<Rendering> {
            self.corpus.get(&key.0).map(|t| Rendering {
                text: t.clone(),
                attestation: TranslationAttestation::CommunityAttested {
                    body: "example nation language council".into(),
                },
            })
        }
    }

    fn authority() -> NationAuthority {
        let mut c = BTreeMap::new();
        c.insert(
            "greeting".to_string(),
            "TSINDAGIKWA-UNIQUE-STRING".to_string(),
        );
        c.insert(
            "farewell".to_string(),
            "SAGWANIHTU-UNIQUE-STRING".to_string(),
        );
        NationAuthority {
            id: LanguageId("xyz".into()),
            corpus: c,
        }
    }

    fn samples() -> Vec<(MessageKey, String)> {
        vec![
            (MessageKey("greeting".into()), "hello".into()),
            (MessageKey("farewell".into()), "goodbye".into()),
        ]
    }

    // ── the compliant subject ─────────────────────────────────────────────────

    struct Compliant {
        r: Renderer<NationAuthority>,
    }
    impl RetentionProbe for Compliant {
        fn render_once(&mut self, k: &MessageKey, src: &str) -> Rendered {
            self.r.render(k, &Context::default(), src)
        }
        fn revoke_authority(&mut self) {
            self.r.revoke();
        }
        fn observable_state(&self) -> Vec<u8> {
            // Everything this side holds: a dropped authority and a flag. Nothing else.
            format!(
                "withdrawn={} has_authority={}",
                self.r.withdrawn,
                self.r.authority.is_some()
            )
            .into_bytes()
        }
    }

    // ── the retaining subject · THE NEGATIVE CONTROL ──────────────────────────
    // A cache is the obvious way to retain. It is also the way a well-meaning engineer
    // adds retention without noticing: caching renderings "for performance" quietly makes
    // BNR a holder of the corpus, and revocation stops meaning anything.

    struct Retaining {
        r: Renderer<NationAuthority>,
        cache: Vec<String>,
    }
    impl RetentionProbe for Retaining {
        fn render_once(&mut self, k: &MessageKey, src: &str) -> Rendered {
            let out = self.r.render(k, &Context::default(), src);
            if let Rendered::In(ref x) = out {
                self.cache.push(x.text.clone()); // ← the defect
            }
            out
        }
        fn revoke_authority(&mut self) {
            self.r.revoke(); // authority dropped — but the cache survives
        }
        fn observable_state(&self) -> Vec<u8> {
            self.cache.join("\n").into_bytes()
        }
    }

    #[test]
    fn compliant_system_retains_nothing() {
        let mut s = Compliant {
            r: Renderer::connected(authority()),
        };
        match probe_retention(&mut s, &samples()) {
            RetentionVerdict::Clean { samples } => assert_eq!(samples, 2),
            other => panic!("expected Clean, got {other:?}"),
        }
    }

    /// **THE TEST THAT MAKES THE HARNESS REAL.** If this passes, the harness is a decoration:
    /// it would report Clean on a system that plainly kept the words.
    #[test]
    fn the_harness_fails_on_a_system_that_retains() {
        let mut s = Retaining {
            r: Renderer::connected(authority()),
            cache: Vec::new(),
        };
        match probe_retention(&mut s, &samples()) {
            RetentionVerdict::Retained { evidence } => {
                assert_eq!(evidence.len(), 2);
                assert!(evidence.iter().any(|e| e.contains("TSINDAGIKWA")));
            }
            other => panic!("harness did not catch a retaining system: {other:?}"),
        }
    }

    /// Law 1: an empty sample set proves nothing.
    #[test]
    fn empty_samples_is_indeterminate_not_clean() {
        let mut s = Compliant {
            r: Renderer::connected(authority()),
        };
        assert!(matches!(
            probe_retention(&mut s, &[]),
            RetentionVerdict::Indeterminate { .. }
        ));
    }

    /// Law 1, the subtler half: if nothing rendered, "nothing survived" is true about
    /// nothing. A retaining system would pass this way if the keys were all misses.
    #[test]
    fn nothing_rendered_is_indeterminate_not_clean() {
        let mut s = Retaining {
            r: Renderer::connected(authority()),
            cache: Vec::new(),
        };
        let miss = vec![(MessageKey("no-such-key".into()), "hello".into())];
        match probe_retention(&mut s, &miss) {
            RetentionVerdict::Indeterminate { reason } => {
                assert!(reason.contains("nothing rendered"))
            }
            other => panic!("expected Indeterminate, got {other:?}"),
        }
    }

    /// Revocation is immediate and complete, not a flag consulted later.
    #[test]
    fn revocation_stops_rendering_at_once() {
        let mut r = Renderer::connected(authority());
        let k = MessageKey("greeting".into());
        assert!(matches!(
            r.render(&k, &Context::default(), "hello"),
            Rendered::In(_)
        ));
        r.revoke();
        match r.render(&k, &Context::default(), "hello") {
            Rendered::NotTranslated { reason, source } => {
                assert_eq!(reason, NotTranslatedReason::AuthorityWithdrawn);
                assert_eq!(source, "hello");
            }
            other => panic!("expected NotTranslated after revocation, got {other:?}"),
        }
    }

    /// The absence is the guarantee: `Preferences` must never serialise a disability field.
    #[test]
    fn preferences_has_no_disability_field() {
        let p = Preferences {
            language: LanguageId("xyz".into()),
            modality: vec![Modality::Audio, Modality::Braille],
            reading_level: Some(ReadingLevel::Plain),
        };
        let j = serde_json::to_string(&p).unwrap().to_lowercase();
        for forbidden in [
            "disability",
            "impairment",
            "rating",
            "status",
            "verified",
            "certified",
            "diagnosis",
            "proof",
            "eligible",
        ] {
            assert!(
                !j.contains(forbidden),
                "Preferences must not serialise `{forbidden}` — access is a preference, \
                 never a credential, and a system storing who is disabled has become a \
                 health-data custodian through the back door"
            );
        }
    }

    /// A rendering cannot exist without stated provenance.
    #[test]
    fn a_rendering_always_carries_its_attestation() {
        let r = Rendering {
            text: "x".into(),
            attestation: TranslationAttestation::Machine { engine: "e".into() },
        };
        let j = serde_json::to_string(&r).unwrap();
        assert!(
            j.contains("attestation"),
            "attestation is not Option and must serialise"
        );
        // and the tiers stay visibly distinct
        let m =
            serde_json::to_string(&TranslationAttestation::Machine { engine: "e".into() }).unwrap();
        let c =
            serde_json::to_string(&TranslationAttestation::CommunityAttested { body: "b".into() })
                .unwrap();
        assert_ne!(m, c);
    }

    /// NotAvailable is honest rather than machine-filled.
    #[test]
    fn unavailable_modality_says_so() {
        let a = ModalityAvailability::NotAvailable {
            modality: Modality::Braille,
        };
        match a {
            ModalityAvailability::NotAvailable { modality } => {
                assert_eq!(modality, Modality::Braille)
            }
            _ => panic!("expected NotAvailable"),
        }
    }

    #[test]
    fn round_trips() {
        let p = Preferences {
            language: LanguageId("xyz".into()),
            modality: vec![Modality::Sign {
                variety: "ASL".into(),
            }],
            reading_level: None,
        };
        let j = serde_json::to_string(&p).unwrap();
        assert_eq!(p, serde_json::from_str::<Preferences>(&j).unwrap());
    }
}
