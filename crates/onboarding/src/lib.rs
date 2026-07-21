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
//!   is the adoption gate: without it, a person caps below Settlement grade **forever** (§4).
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

    /// Consent as an artifact **on the binding**: the digest of the exact text shown, and when it
    /// was accepted — so what a user consented to is reconstructible, not asserted. The shown text
    /// must state the correlation consequence of the chosen mode (a UI-copy control checked where
    /// the text is composed; here we bind the digest so the claim is auditable).
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct InformedConsent {
        pub shown_text_digest: Hash,
        pub accepted_at: i64,
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
        pub fn new(
            persona: PersonaRef,
            disclosure: DisclosureMode,
            consent: InformedConsent,
        ) -> Self {
            PersonaBinding {
                persona,
                disclosure,
                consent,
            }
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

/// Why a Settlement-gated action refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateRefusal {
    /// §4: the action gated on Settlement without the user having been shown their grade first.
    /// Discovering the ceiling at the moment you hit it is the worst possible time.
    GradeNotShown,
    /// Below Settlement — carrying what raises it, so the ceiling is legible, not a dead end.
    BelowSettlement {
        current: ViewGrade,
        raises_it: &'static str,
    },
}

/// Gate an action that requires Settlement grade. Refuses in two honest ways (§4): if the user's
/// grade was **not previously shown to them**, and if their grade is **below Settlement** (with what
/// raises it). A surface that gates on Settlement without ever having shown the grade fails the
/// first check by construction — it cannot pass `grade_was_shown = false`.
pub fn gate_on_settlement(current: ViewGrade, grade_was_shown: bool) -> Result<(), GateRefusal> {
    if !grade_was_shown {
        return Err(GateRefusal::GradeNotShown);
    }
    if current < ViewGrade::Settlement {
        return Err(GateRefusal::BelowSettlement {
            current,
            raises_it: "anchor the did:autonomi root and establish a bidirectional did:plc binding",
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
    fn a_settlement_gate_refuses_if_the_grade_was_never_shown() {
        // §4 negative control: even at Settlement grade, gating without having shown the user their
        // grade first is a refusal — the ceiling must never be discovered at the moment it is hit.
        assert_eq!(
            gate_on_settlement(ViewGrade::Settlement, false),
            Err(GateRefusal::GradeNotShown)
        );
        // shown + below settlement: refuses, but tells them what raises it.
        match gate_on_settlement(ViewGrade::Confirmed, true) {
            Err(GateRefusal::BelowSettlement { current, raises_it }) => {
                assert_eq!(current, ViewGrade::Confirmed);
                assert!(!raises_it.is_empty());
            }
            other => panic!("expected BelowSettlement, got {other:?}"),
        }
        // shown + at settlement: allowed.
        assert!(gate_on_settlement(ViewGrade::Settlement, true).is_ok());
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
