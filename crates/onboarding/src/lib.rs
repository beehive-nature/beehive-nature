//! `onboarding` — the identity ladder (RELAY_22) and its invariants, with age assurance folded in
//! as a **structurally separate** concern (RELAY_23, see [`age`]).
//!
//! The ladder, from the mission outward:
//! - **Step 0 — the commons.** Read-only, anonymous, free. There is deliberately no type here: a
//!   stranger reads the published data, the dashboard, the COAs with no account at all. (A commons
//!   surface that required authentication to read would be a negative-control failure — but that is
//!   a property of the *read surfaces*, which hold no identity code, not of this crate.)
//! - **Step 1 — authenticate.** A WebAuthn [`Authenticator`] (platform passkey; hardware is a
//!   preference, never a credential). The [`RootIdentity`] keypair is generated *locally* here — it
//!   costs nothing, so the identity exists from the first moment.
//! - **Step 2 — anchor the root.** The `did:autonomi` is anchored ([`RootIdentity::anchored`]). This
//!   is the adoption gate: without it, a person caps below Settlement grade **forever** (§4). A
//!   Settlement gate consumes a [`GradeDisclosure`] witness that only [`disclose_grade`] can mint,
//!   so a surface cannot gate without first showing the user their grade — it fails to compile,
//!   not at runtime.
//! - **Step 3 — personas.** Plural, optional, each a [`persona::PersonaBinding`] whose disclosure
//!   mode is its own (never global) and whose default is the reversible, private side.
//!
//! Three things are true by construction here, because each is cheap now and a migration later:
//! - **The authenticator is a key, never the identity.** Losing it must not lose the DID — records
//!   key off the stable `did:autonomi`, and the credential is replaceable (Article II).
//! - **Everything economic keys off the ROOT, never a persona.** PoUL standing, `b`, minting, the
//!   420 cap are on the human's root; a persona is only how they appear. So no type in the persona
//!   model carries a balance, a mint path, or a PoUL signal (§2a).
//! - **Age is not here at all.** It is an attribute of an *action*, contained in [`age`], and this
//!   file never names its type — the `containment` test proves the identity path cannot consult it.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};
use shared_types::{Hash, ViewGrade};
use type_bindings::Did;

pub mod age;

// ── Step 1 · authentication: a key that authorises the root, never the identity ──────────────

/// Platform passkey vs a roaming hardware key. Both authenticate; **hardware is never required**
/// (access is a preference, never a credential — RELAY_17). The Solo/Nitrokey path is for *testing
/// the adapter*, not for gating entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthenticatorKind {
    PlatformPasskey,
    RoamingKey,
}

/// A WebAuthn credential reference. It **authorises use of** the root; it is not the identity, and
/// carries only the opaque public credential id — never key material.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Authenticator {
    /// Opaque WebAuthn credential id (a public handle, not a secret).
    pub credential_id: String,
    pub kind: AuthenticatorKind,
}

// ── Step 2 · the root identity ──────────────────────────────────────────────────────────────

/// The `did:autonomi` root. The keypair exists from Step 1 (generated locally); `anchored` is what
/// Step 2 adds. The DID is the stable identifier every record keys off — it survives device loss
/// and key rotation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RootIdentity {
    pub did: Did,
    /// Anchored to Autonomi (Step 2) or still local (Step 1).
    pub anchored: bool,
}

// ── Step 3 · personas ───────────────────────────────────────────────────────────────────────

pub mod persona {
    //! Persona bindings — how a root *appears*, never what it *is*. No type here carries anything
    //! economic; the root is where `b`/PoUL/mint live (§2a).

    use super::{Deserialize, Hash, Serialize};

    /// An open persona type. The founder named crypto accounts alongside `did:plc`; they correlate
    /// the same way, so they share the machinery.
    #[non_exhaustive]
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub enum PersonaRef {
        Plc(String),
        AtProto(String),
        Evm(String),
        Zano(String),
        Nostr(String),
    }

    impl PersonaRef {
        /// Is this persona **PDS-custodial** by default — an identity a third party can seize?
        ///
        /// did:plc / ATProto personas live on a PDS that, on account creation, holds the signing
        /// keys: per the PLC docs "a rogue PDS operator could overtake your account" unless the user
        /// has registered their own rotation key — and almost nobody does (RELAY_22 §5a). That is the
        /// sharper reason the Constitution rules did:plc *"never the root"*: not just that PLC is
        /// someone else's directory, but that the keys are someone else's custody. Key-based personas
        /// — EVM, Zano, Nostr — are self-custodial: the user holds the key, there is no PDS in the
        /// loop. The custody-disclosure obligation on [`InformedConsent`] falls exactly on the `true`
        /// cases. (Explicit match, not a wildcard: a new persona variant must decide its own custody
        /// status here rather than defaulting to "no disclosure needed".)
        pub fn is_pds_custodial(&self) -> bool {
            match self {
                PersonaRef::Plc(_) | PersonaRef::AtProto(_) => true,
                PersonaRef::Evm(_) | PersonaRef::Zano(_) | PersonaRef::Nostr(_) => false,
            }
        }
    }

    /// How a binding references the root — the variable that sets correlation exposure.
    ///
    /// **Public is irreversible in one direction:** once a binding is public, correlation has
    /// already happened; switching to a private mode afterwards restores nothing. When a choice is
    /// irreversible one way, the default is the reversible side — so [`DisclosureMode::default`] is
    /// private ([`Selective`](DisclosureMode::Selective)), and `Public` is an explicit opt-in whose
    /// consent must say plainly that it cannot be undone.
    #[non_exhaustive]
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub enum DisclosureMode {
        /// Explicit opt-in only — never the default.
        Public,
        /// Binding revealed only to chosen verifiers. The sane first default.
        Selective,
        /// A distinct root-derived id per relying party — strongest separation.
        Pairwise,
    }

    impl Default for DisclosureMode {
        fn default() -> Self {
            DisclosureMode::Selective
        }
    }

    impl DisclosureMode {
        pub fn is_public(&self) -> bool {
            matches!(self, DisclosureMode::Public)
        }
    }

    /// Consent as an artifact **on the binding**: the digest of the exact text shown, when it was
    /// accepted, and — for a PDS-custodial persona — whether that text disclosed the custody risk.
    /// So what a user consented to is reconstructible, not asserted.
    ///
    /// **Two disclosure obligations, not one** — a binding consent must cover both, and for an
    /// ATProto/PLC persona covering only the first is the negative-control failure:
    ///
    /// 1. **Correlation** (RELAY_22 §2a): the shown text must state the correlation consequence of
    ///    the chosen [`DisclosureMode`] in that mode's own terms (a UI-copy control checked where the
    ///    text is composed; the digest binds it so the claim is auditable).
    /// 2. **Custody** (RELAY_22 §5a): for a **PDS-custodial** persona
    ///    ([`PersonaRef::is_pds_custodial`] — did:plc / ATProto), the text must *also* disclose that
    ///    the persona is held in its PDS operator's custody unless the user has registered their own
    ///    rotation key — i.e. the binding is to an identity someone else can seize.
    ///    [`discloses_pds_custody`](InformedConsent::discloses_pds_custody) records that this was
    ///    shown, and [`PersonaBinding::bind`] refuses a PDS-custodial binding without it, so a user
    ///    cannot learn afterwards that the thing they bound to their sovereign root was never
    ///    sovereign.
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct InformedConsent {
        pub shown_text_digest: Hash,
        pub accepted_at: i64,
        /// Whether the shown text disclosed PDS-custody (§5a). **Required `true`** for a PDS-custodial
        /// persona; for a self-custodial one (EVM / Zano / Nostr — the user holds the key, there is
        /// no PDS) it carries no obligation and its value is not consulted.
        pub discloses_pds_custody: bool,
    }

    /// Why a persona binding was refused.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub enum BindingError {
        /// §5a: a PDS-custodial persona (did:plc / ATProto) was bound with consent that discloses
        /// correlation but **not custody**. An ATProto binding consent that discloses correlation but
        /// not custody is the negative-control failure — the user would not have been told the
        /// identity they bound to their sovereign root is seizable by whoever runs its PDS.
        CustodyUndisclosed,
    }

    /// One persona binding. Its disclosure mode is **per-binding**, carried right here — never read
    /// from a global config (a mode read globally rather than from the binding is a negative-control
    /// failure; the type makes the per-binding mode the only place it can come from).
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct PersonaBinding {
        pub persona: PersonaRef,
        pub disclosure: DisclosureMode,
        pub consent: InformedConsent,
    }

    impl PersonaBinding {
        /// Bind a persona, or **refuse**. A PDS-custodial persona ([`PersonaRef::is_pds_custodial`])
        /// whose consent does not disclose custody is [`BindingError::CustodyUndisclosed`] — RELAY_22
        /// §5a made structural, the same shape as [`super::Enrolment::complete`] refusing without the
        /// recovery floor: the binding cannot be built through the sanctioned path without the
        /// custody disclosure. A self-custodial persona (EVM / Zano / Nostr) carries no custody
        /// obligation and binds freely.
        pub fn bind(
            persona: PersonaRef,
            disclosure: DisclosureMode,
            consent: InformedConsent,
        ) -> Result<PersonaBinding, BindingError> {
            if persona.is_pds_custodial() && !consent.discloses_pds_custody {
                return Err(BindingError::CustodyUndisclosed);
            }
            Ok(PersonaBinding {
                persona,
                disclosure,
                consent,
            })
        }
    }
}

// ── Recovery: the written code is the mandatory floor (§5) ───────────────────────────────────

/// A recovery path. The **written code is the floor and it is mandatory** — it costs nothing, works
/// for a person with exactly one device, and is the only option available to someone poor. A second
/// authenticator and social recovery are *offered, never required*: anything else means device loss
/// is identity death for exactly the users this system exists for. Only a hash of the code is kept;
/// the code itself is shown once and never persisted.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecoveryPath {
    /// The mandatory floor.
    WrittenCode { code_hash: Hash },
    /// Offered, never required.
    SecondAuthenticator { credential_id: String },
    /// n-of-m from PoUL-verified threads. Offered, never required.
    SocialRecovery { threshold: u8, guardians: Vec<Did> },
}

impl RecoveryPath {
    pub fn is_written_code(&self) -> bool {
        matches!(self, RecoveryPath::WrittenCode { .. })
    }
}

// ── The enrolment, and the refusals that make it honest ──────────────────────────────────────

/// Why an enrolment cannot complete.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnrolError {
    /// §5: no recovery path at all — device loss would be identity death.
    NoRecoveryPath,
    /// §5: recovery paths present, but the mandatory written-code floor is missing.
    NoWrittenCodeFloor,
}

/// A completed enrolment: the person's Step-1+ state. Constructed only through [`Enrolment::complete`],
/// which enforces the recovery floor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Enrolment {
    authenticator: Authenticator,
    root: RootIdentity,
    recovery: Vec<RecoveryPath>,
    personas: Vec<persona::PersonaBinding>,
}

impl Enrolment {
    /// Complete enrolment, or refuse. **Refuses without at least one recovery path, and specifically
    /// without the written-code floor** (§5) — the negative control is that an enrolment cannot
    /// finish leaving a person unable to recover.
    pub fn complete(
        authenticator: Authenticator,
        root: RootIdentity,
        recovery: Vec<RecoveryPath>,
        personas: Vec<persona::PersonaBinding>,
    ) -> Result<Enrolment, EnrolError> {
        if recovery.is_empty() {
            return Err(EnrolError::NoRecoveryPath);
        }
        if !recovery.iter().any(RecoveryPath::is_written_code) {
            return Err(EnrolError::NoWrittenCodeFloor);
        }
        Ok(Enrolment {
            authenticator,
            root,
            recovery,
            personas,
        })
    }

    pub fn authenticator(&self) -> &Authenticator {
        &self.authenticator
    }
    pub fn root(&self) -> &RootIdentity {
        &self.root
    }
    pub fn recovery(&self) -> &[RecoveryPath] {
        &self.recovery
    }
    pub fn personas(&self) -> &[persona::PersonaBinding] {
        &self.personas
    }
}

// ── Grade: the adoption gate, and the visibility obligation (§4) ──────────────────────────────

/// The bidirectional `did:plc ↔ did:autonomi` binding proof that Settlement grade requires: the PLC
/// op-log verified across ≥2 independent views AND the binding established (mirrors
/// `shared_types::ViewGrade::Settlement` / the `sense-atproto` witness rule).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementBinding {
    pub verified_bidirectional: bool,
    pub op_log_views: u8,
}

impl SettlementBinding {
    pub fn is_settlement_grade(&self) -> bool {
        self.verified_bidirectional && self.op_log_views >= 2
    }
}

/// The highest grade this enrolment can reach. **The adoption gate (§4):** without an anchored root
/// and a settlement binding, a person caps at `Confirmed` — forever, not as a temporary state. A
/// stopped-at-Step-1 person is not stuck at a lower rung by accident; the ceiling is a fact about
/// what they have established.
pub fn reachable_grade(enrolment: &Enrolment, binding: Option<&SettlementBinding>) -> ViewGrade {
    match binding {
        Some(b) if enrolment.root.anchored && b.is_settlement_grade() => ViewGrade::Settlement,
        _ => ViewGrade::Confirmed,
    }
}

/// A witness that the user was shown their current grade — §4's protection made **structural**, not
/// remembered. Its field is private, there is no other constructor, and it derives **no
/// `Deserialize`**, so a caller cannot fabricate one: the only way to obtain a `GradeDisclosure` is
/// [`disclose_grade`], which produces the very status the user sees. A surface therefore cannot gate
/// on Settlement without having rendered the grade first — it is not a check it can forget to pass,
/// it is a value it cannot conjure. (Same idiom as `treasury_t0::SettlementAuthorization`; the old
/// `grade_was_shown: bool` was the `thread_age` defect — a protection decided by a value the
/// restrained party hands in.)
///
/// The private field is why this cannot be built from outside the crate:
/// ```compile_fail
/// use onboarding::GradeDisclosure;
/// use shared_types::ViewGrade;
/// // `shown` is private — a surface cannot conjure a disclosure it never made.
/// let _forged = GradeDisclosure { shown: ViewGrade::Settlement };
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GradeDisclosure {
    shown: ViewGrade,
}

impl GradeDisclosure {
    /// The grade that was disclosed to the user.
    pub fn shown(&self) -> ViewGrade {
        self.shown
    }
}

/// The user-facing grade status: where the person stands and what raises it — rendered in the same
/// honest register as the `b` gauge, never a nag. Producing this is the **only** way to mint a
/// [`GradeDisclosure`], so §4's disclosure obligation cannot be skipped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GradeStatus {
    pub current: ViewGrade,
    /// What raises the grade — empty once already at Settlement.
    pub raises_it: &'static str,
}

const RAISES_SETTLEMENT: &str =
    "anchor the did:autonomi root and establish a bidirectional did:plc binding";

/// Render the user's grade status **and** mint the disclosure witness. Call this on the surface that
/// shows the person their grade; pass the returned [`GradeDisclosure`] to [`gate_on_settlement`].
/// There is no path to the witness that does not also produce the status — that is the point.
pub fn disclose_grade(current: ViewGrade) -> (GradeStatus, GradeDisclosure) {
    let raises_it = if current < ViewGrade::Settlement {
        RAISES_SETTLEMENT
    } else {
        ""
    };
    (
        GradeStatus { current, raises_it },
        GradeDisclosure { shown: current },
    )
}

/// Why a Settlement-gated action refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateRefusal {
    /// The disclosure attests a **different** grade than the one being gated — a stale or mismatched
    /// witness is not a disclosure of the current grade (grades only rise, so a stale witness shows
    /// a lower one). Re-disclose the current grade before gating.
    StaleDisclosure {
        shown: ViewGrade,
        current: ViewGrade,
    },
    /// Below Settlement — carrying what raises it, so the ceiling is legible, not a dead end.
    BelowSettlement {
        current: ViewGrade,
        raises_it: &'static str,
    },
}

/// Gate an action that requires Settlement grade. Takes a [`GradeDisclosure`] — the user was shown
/// their grade — **not a bool the caller asserts**. Refuses if the disclosure does not attest the
/// grade actually being gated (stale/mismatched), and if that grade is below Settlement (with what
/// raises it). The "gated without disclosing" case is not a runtime refusal here: it does not
/// compile, because there is no [`GradeDisclosure`] to pass without calling [`disclose_grade`].
pub fn gate_on_settlement(
    current: ViewGrade,
    disclosure: &GradeDisclosure,
) -> Result<(), GateRefusal> {
    if disclosure.shown != current {
        return Err(GateRefusal::StaleDisclosure {
            shown: disclosure.shown,
            current,
        });
    }
    if current < ViewGrade::Settlement {
        return Err(GateRefusal::BelowSettlement {
            current,
            raises_it: RAISES_SETTLEMENT,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::persona::*;
    use super::*;

    fn hash(b: u8) -> Hash {
        [b; 32]
    }
    fn did(s: &str) -> Did {
        Did(s.to_string())
    }
    fn authr() -> Authenticator {
        Authenticator {
            credential_id: "cred-1".into(),
            kind: AuthenticatorKind::PlatformPasskey,
        }
    }
    fn root(anchored: bool) -> RootIdentity {
        RootIdentity {
            did: did("did:autonomi:a"),
            anchored,
        }
    }
    fn written() -> RecoveryPath {
        RecoveryPath::WrittenCode { code_hash: hash(9) }
    }

    // ── §5 · the recovery floor ──

    #[test]
    fn enrolment_refuses_without_any_recovery_path() {
        assert_eq!(
            Enrolment::complete(authr(), root(true), vec![], vec![]),
            Err(EnrolError::NoRecoveryPath)
        );
    }

    #[test]
    fn enrolment_refuses_without_the_written_code_floor() {
        // a second authenticator alone does not satisfy the floor — the poor-inclusive path is
        // mandatory, not substitutable.
        let only_second = vec![RecoveryPath::SecondAuthenticator {
            credential_id: "cred-2".into(),
        }];
        assert_eq!(
            Enrolment::complete(authr(), root(true), only_second, vec![]),
            Err(EnrolError::NoWrittenCodeFloor)
        );
    }

    #[test]
    fn enrolment_completes_with_the_written_code_floor() {
        let e = Enrolment::complete(authr(), root(true), vec![written()], vec![]).unwrap();
        assert!(e.recovery().iter().any(RecoveryPath::is_written_code));
    }

    // ── §2a · disclosure default is the reversible, private side ──

    #[test]
    fn disclosure_default_is_private_never_public() {
        assert_eq!(DisclosureMode::default(), DisclosureMode::Selective);
        assert!(!DisclosureMode::default().is_public());
    }

    // ── §5a · a PDS-custodial persona must disclose custody, not only correlation ──

    fn consent(discloses_pds_custody: bool) -> InformedConsent {
        InformedConsent {
            shown_text_digest: hash(7),
            accepted_at: 1_700_000_000,
            discloses_pds_custody,
        }
    }

    #[test]
    fn pds_custodial_binding_refuses_when_custody_is_undisclosed() {
        // The negative control (RELAY_22 §5a): a did:plc / ATProto binding whose consent discloses
        // correlation but NOT custody is refused — a user must not learn afterwards that the identity
        // they bound to their sovereign root is seizable by whoever runs its PDS.
        for p in [
            PersonaRef::Plc("did:plc:abc".into()),
            PersonaRef::AtProto("alice.bsky.social".into()),
        ] {
            assert!(p.is_pds_custodial(), "did:plc / ATProto are PDS-custodial");
            assert_eq!(
                PersonaBinding::bind(p, DisclosureMode::Selective, consent(false)),
                Err(BindingError::CustodyUndisclosed),
                "correlation disclosed but custody not → refused",
            );
        }
    }

    #[test]
    fn pds_custodial_binding_completes_once_custody_is_disclosed() {
        let b = PersonaBinding::bind(
            PersonaRef::Plc("did:plc:abc".into()),
            DisclosureMode::Selective,
            consent(true),
        )
        .expect("a PLC binding with custody disclosed is allowed");
        assert!(b.consent.discloses_pds_custody);
    }

    #[test]
    fn self_custodial_persona_carries_no_custody_obligation() {
        // Positive control the other way: EVM / Zano / Nostr are key-based and self-custodial — no
        // PDS in the loop — so a missing custody disclosure is not a refusal. The obligation falls
        // exactly on the PDS-custodial cases, not on every binding.
        for p in [
            PersonaRef::Evm("0xabc".into()),
            PersonaRef::Zano("zano:abc".into()),
            PersonaRef::Nostr("npub1abc".into()),
        ] {
            assert!(!p.is_pds_custodial());
            assert!(
                PersonaBinding::bind(p, DisclosureMode::Selective, consent(false)).is_ok(),
                "a self-custodial persona binds without a custody disclosure",
            );
        }
    }

    // ── §4 · the adoption gate and the visibility obligation ──

    #[test]
    fn no_settlement_binding_caps_the_grade_at_confirmed() {
        let e = Enrolment::complete(authr(), root(true), vec![written()], vec![]).unwrap();
        assert_eq!(reachable_grade(&e, None), ViewGrade::Confirmed);
        // even anchored, a non-settlement binding does not lift the ceiling.
        let weak = SettlementBinding {
            verified_bidirectional: false,
            op_log_views: 2,
        };
        assert_eq!(reachable_grade(&e, Some(&weak)), ViewGrade::Confirmed);
    }

    #[test]
    fn settlement_needs_both_the_anchor_and_the_binding() {
        let strong = SettlementBinding {
            verified_bidirectional: true,
            op_log_views: 2,
        };
        // unanchored root: caps at Confirmed even with a strong binding (the adoption gate).
        let unanchored =
            Enrolment::complete(authr(), root(false), vec![written()], vec![]).unwrap();
        assert_eq!(
            reachable_grade(&unanchored, Some(&strong)),
            ViewGrade::Confirmed
        );
        // anchored + strong binding: Settlement.
        let anchored = Enrolment::complete(authr(), root(true), vec![written()], vec![]).unwrap();
        assert_eq!(
            reachable_grade(&anchored, Some(&strong)),
            ViewGrade::Settlement
        );
    }

    #[test]
    fn a_settlement_gate_needs_a_matching_grade_disclosure() {
        // §4 made structural: the "gated without disclosing" case is a COMPILE error, not a runtime
        // refusal (there is no bool to pass; the witness only comes from disclose_grade — see the
        // compile_fail doctest on GradeDisclosure). What remains testable is that a stale or
        // mismatched disclosure does not pass, and that a proper one gates correctly.

        // a real disclosure of Settlement, gated at Settlement → allowed, and the status is honest.
        let (status, seen) = disclose_grade(ViewGrade::Settlement);
        assert_eq!(status.current, ViewGrade::Settlement);
        assert!(
            status.raises_it.is_empty(),
            "at Settlement, nothing raises it"
        );
        assert!(gate_on_settlement(ViewGrade::Settlement, &seen).is_ok());

        // a disclosure of Confirmed carries what raises it, and reused against a Settlement gate it
        // is stale — refused, not silently accepted.
        let (below, seen_confirmed) = disclose_grade(ViewGrade::Confirmed);
        assert!(
            !below.raises_it.is_empty(),
            "below Settlement, the status names the next step"
        );
        assert_eq!(
            gate_on_settlement(ViewGrade::Settlement, &seen_confirmed),
            Err(GateRefusal::StaleDisclosure {
                shown: ViewGrade::Confirmed,
                current: ViewGrade::Settlement,
            })
        );

        // properly disclosed but below settlement → refuses, telling them what raises it.
        match gate_on_settlement(ViewGrade::Confirmed, &seen_confirmed) {
            Err(GateRefusal::BelowSettlement { current, raises_it }) => {
                assert_eq!(current, ViewGrade::Confirmed);
                assert!(!raises_it.is_empty());
            }
            other => panic!("expected BelowSettlement, got {other:?}"),
        }
    }

    // ── containment: the identity path never consults the action-level age type ──

    #[test]
    fn containment_the_ladder_never_names_the_age_type() {
        // The negative control for "an identity step consulting age assurance → fail": the model
        // code in this file must never reference the age type by name (consumers reach it via the
        // `age` module path). Needle + decoy built by concat so this test does not match itself;
        // comment lines skipped so the design prose that explains the rule does not trip it.
        let needle = format!("Age{}", "Assurance");
        let src = include_str!("lib.rs");
        let model = src.split("#[cfg(test)]").next().unwrap();
        let hits: Vec<&str> = model
            .lines()
            .filter(|l| !l.trim_start().starts_with("//"))
            .filter(|l| l.contains(&needle))
            .collect();
        assert!(
            hits.is_empty(),
            "the identity ladder must not consult the age type — found: {hits:?}"
        );
        // positive control: the scan WOULD catch a reference (decoy is not real code here).
        let decoy = format!("    let a: age::{} = todo!();", needle);
        assert!(decoy.contains(&needle));
    }
}
