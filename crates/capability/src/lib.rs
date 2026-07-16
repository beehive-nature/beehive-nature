//! `identity.root` + the Capability primitive (Phase 2 scaffold) — the
//! authorization core behind the console's multi-domain, one-DID access model
//! (design brief §2.5).
//!
//! The model, stated plainly:
//! - A [`Did`] is a principal (`did:autonomi:…` root, `did:plc:…` persona).
//!   Events and authorization key off DIDs, never raw public keys, so key
//!   rotation never orphans access (the constitution's identity rule).
//! - A [`Capability`] is a UCAN-shaped `(with, can)` pair: *which resource* and
//!   *which ability*. "Give the design seat read on the farm panel" is a
//!   capability; "the wallet may spend" is another.
//! - A [`Delegation`] is a signed, delegable, revocable grant from an issuer
//!   DID to an audience DID, optionally time-bound. This is the UCAN token; it
//!   is what lets one self-authenticated DID walk into any BNRi domain and get
//!   exactly the layers/features/assets its attestation permits.
//!
//! **What v1 delivers now (compile-safe, fully tested):** the *authorization
//! core* — capability matching (ability hierarchy with `*` wildcards) and
//! time-bound validity. This is the logic every panel gates on, and it needs no
//! crypto to be correct.
//!
//! **What gates behind the [`Verifier`] trait (the pending crypto step):**
//! signature issuance and verification (Ed25519 over the delegation's canonical
//! form) and the delegation-chain proof. Kept behind a trait — not a `todo!()`
//! — so the unbuilt crypto never sits in a shipped path, matching the adapter
//! discipline. A real verifier lands once its curve API is compile-verified.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// A decentralized identifier used as an authorization principal.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Did(pub String);

impl Did {
    pub fn new(s: impl Into<String>) -> Self {
        Did(s.into())
    }
    /// The DID method segment (`autonomi`, `plc`, …), if well-formed
    /// (`did:<method>:<id>`).
    pub fn method(&self) -> Option<&str> {
        let mut it = self.0.split(':');
        match (it.next(), it.next()) {
            (Some("did"), Some(method)) if !method.is_empty() => Some(method),
            _ => None,
        }
    }
    pub fn is_root(&self) -> bool {
        self.method() == Some("autonomi")
    }
}

/// A UCAN-shaped capability: an ability over a resource.
///
/// `with` is a resource URI — a capability name from the constitution's
/// adapter table (`storage.sovereign`, `settlement.private`, …) or a scoped
/// resource (`farm:node-a`). `can` is an ability path (`farm/read`,
/// `farm/toggle`, `wallet/spend`), matched hierarchically: `farm/*` grants
/// every `farm/…` ability, and `*` grants all.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capability {
    pub with: String,
    pub can: String,
}

impl Capability {
    pub fn new(with: impl Into<String>, can: impl Into<String>) -> Self {
        Capability {
            with: with.into(),
            can: can.into(),
        }
    }

    /// Does this (possibly wildcarded) capability permit `ability` on
    /// `resource`? Resource match is exact or `*`. Ability match is exact,
    /// `*`, or a `prefix/*` that covers `ability`.
    pub fn permits(&self, resource: &str, ability: &str) -> bool {
        resource_matches(&self.with, resource) && ability_matches(&self.can, ability)
    }
}

/// Resource match: `*` matches anything; otherwise exact.
fn resource_matches(pattern: &str, resource: &str) -> bool {
    pattern == "*" || pattern == resource
}

/// Ability match: `*` matches anything; `a/b/*` matches `a/b` and any
/// `a/b/…`; otherwise exact. Segment-wise so `farm/*` does not match `farmx`.
fn ability_matches(pattern: &str, ability: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    if let Some(prefix) = pattern.strip_suffix("/*") {
        if ability == prefix {
            return true;
        }
        // `a/b/*` covers `a/b/…` but not `a/bx` — the next byte must be a slash.
        return ability.starts_with(prefix) && ability.as_bytes().get(prefix.len()) == Some(&b'/');
    }
    pattern == ability
}

/// How strong the evidence for a device's key custody is.
///
/// The ladder is about *where the key lives and what vouches for it*, not about
/// who the human is — identity is the [`Did`]'s job. A phone with a
/// verified-boot attestation chain says something a browser session cannot.
///
/// `#[non_exhaustive]`: classes version by addition. A new class must not
/// silently re-tier existing delegations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[non_exhaustive]
pub enum EvidenceClass {
    /// E1 — a session only. No key custody claim beyond "someone is logged in".
    SessionOnly,
    /// E2 — software provisioned by us, holding a key it generated itself.
    ProvisionedSoftware,
    /// E3 — a hardware-backed key (secure element / keystore).
    HardwareKey,
    /// E4 — a hardware-backed key **plus** a verified-boot attestation over the
    /// OS that holds it.
    HardwareKeyVerifiedBoot,
    /// E5 — a signer isolated from the host: the key cannot leave, and use
    /// requires a physical act on the device itself.
    IsolatedSigner,
}

/// E-bio: liveness at the *time of use* — a modifier, never a class.
///
/// It is deliberately not an [`EvidenceClass`] variant, because it answers a
/// different question. A class says how well the key is held; this says whether
/// a live human was present when it was used. Biometry on a weak device does
/// not make the device strong, so this composes with a class — see
/// [`EvidenceClass::meets_with_presence`] — and never substitutes for one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum BioPresence {
    /// No liveness signal was collected, or it did not pass.
    Absent,
    /// A liveness check passed at time of use.
    Present,
}

impl BioPresence {
    pub fn is_present(self) -> bool {
        self == BioPresence::Present
    }
}

/// The access tier an [`EvidenceClass`] earns.
///
/// `Ord` is the point: a ceiling check is a comparison, and `T4 < T5` must mean
/// what it reads like. Declaration order defines the ordering — keep it
/// ascending.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[non_exhaustive]
pub enum Tier {
    T1,
    T2,
    T3,
    T4,
    T5,
}

impl Tier {
    /// The tier an evidence class earns.
    ///
    /// The table is 1:1 today (E1→T1 … E5→T5). It is a function rather than a
    /// cast precisely so it can stop being 1:1 without every call site
    /// changing: if a class is later demoted (a platform's attestation is
    /// broken, say), that is an edit here and nowhere else.
    pub fn of(class: EvidenceClass) -> Tier {
        match class {
            EvidenceClass::SessionOnly => Tier::T1,
            EvidenceClass::ProvisionedSoftware => Tier::T2,
            EvidenceClass::HardwareKey => Tier::T3,
            EvidenceClass::HardwareKeyVerifiedBoot => Tier::T4,
            EvidenceClass::IsolatedSigner => Tier::T5,
        }
    }
}

impl EvidenceClass {
    /// The tier this class earns — [`Tier::of`], as a method.
    pub fn tier(self) -> Tier {
        Tier::of(self)
    }

    /// Does this class, combined with liveness, meet `required` *and* satisfy a
    /// presence requirement?
    ///
    /// The composition rule, stated plainly: presence is an **additional**
    /// condition, never a compensating one. `require_presence` on a T5 device
    /// with no liveness fails; `BioPresence::Present` on a T1 device is still
    /// T1. This is the helper a sensitive ability gates on when the design says
    /// "E4/E5 **and** a live human".
    pub fn meets_with_presence(
        self,
        required: Tier,
        presence: BioPresence,
        require_presence: bool,
    ) -> bool {
        if require_presence && !presence.is_present() {
            return false;
        }
        self.tier() >= required
    }
}

/// T5 live authority as a **set**, not a device.
///
/// Founder ruling (2026-07-16): T5 is 2-of-3 across independent isolated
/// signers. That is why this type exists at all — [`Tier::of`] maps *one*
/// device's evidence to one tier, and a quorum is not a property any single
/// device has. The scalar path is untouched: a caller that never enrolls a
/// policy sees exactly the v1 behaviour.
///
/// **Genesis honesty.** The founder holds one Safe 7 today, so `threshold: 1,
/// enrolled: [safe7]` is a legitimate policy — 1-of-1 — raised to 2-of-3 as
/// signers enrol. This type does not pretend the third signer exists; it lets
/// the policy say truthfully how many there are. Changing threshold or
/// enrolment is itself a T5 act: the current quorum authorises its successor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub struct QuorumPolicy {
    /// How many enrolled isolated signers must present to reach [`Tier::T5`].
    pub threshold: u8,
    /// The enrolled signers, by DID. Membership is by DID, never by public key
    /// — a signer rotating its key stays the same principal (the crate's
    /// identity rule).
    pub enrolled: Vec<Did>,
}

impl QuorumPolicy {
    /// A policy requiring `threshold` of `enrolled`.
    pub fn new(threshold: u8, enrolled: Vec<Did>) -> Self {
        QuorumPolicy {
            threshold,
            enrolled,
        }
    }

    /// The 1-of-1 genesis policy: one signer, and the truth about it.
    pub fn genesis(anchor: Did) -> Self {
        QuorumPolicy::new(1, vec![anchor])
    }

    /// Is `did` currently enrolled?
    pub fn is_enrolled(&self, did: &Did) -> bool {
        self.enrolled.iter().any(|e| e == did)
    }

    /// How many of `presented` count toward quorum: enrolled **and** carrying
    /// [`EvidenceClass::IsolatedSigner`]. A duplicate DID counts once — three
    /// presentations of one signer are one signer.
    pub fn counted(&self, presented: &[(Did, EvidenceClass)]) -> usize {
        let mut seen: Vec<&Did> = Vec::new();
        for (did, class) in presented {
            if *class == EvidenceClass::IsolatedSigner
                && self.is_enrolled(did)
                && !seen.contains(&did)
            {
                seen.push(did);
            }
        }
        seen.len()
    }

    /// The tier this set of presented devices actually earns.
    ///
    /// Quorum met → [`Tier::T5`]. Otherwise the **best single-device tier among
    /// presented** — which is the whole point of the ruling: a lone Safe 7
    /// under a 2-of-3 policy is still an isolated signer, but it is not the
    /// quorum, so it does not carry T5 authority. It falls back to what one
    /// device can honestly claim.
    ///
    /// Note the deliberate asymmetry: the fallback uses [`Tier::of`] on each
    /// presented device *regardless of enrolment*, because a non-enrolled
    /// phone is still a phone — enrolment gates the T5 quorum, not a device's
    /// own evidence. Empty `presented` → [`Tier::T1`], the floor: nothing
    /// presented earns nothing.
    pub fn effective_tier(&self, presented: &[(Did, EvidenceClass)]) -> Tier {
        if self.threshold > 0 && self.counted(presented) >= self.threshold as usize {
            return Tier::T5;
        }
        presented
            .iter()
            .map(|(_, class)| {
                // A lone isolated signer under an unmet quorum cannot claim the
                // tier the quorum exists to guard. T4 is the honest ceiling for
                // one device: everything a strong device does, minus what the
                // set was made to authorise.
                match Tier::of(*class) {
                    Tier::T5 => Tier::T4,
                    t => t,
                }
            })
            .max()
            .unwrap_or(Tier::T1)
    }

    /// Remove `did` from the enrolled set. **Always succeeds.**
    ///
    /// Founder ruling (2026-07-16): revoke-wins. Revoking a signer is never
    /// blocked by what it does to quorum — a compromised signer that cannot be
    /// revoked *because* revoking it would break quorum is an attacker holding
    /// the quorum hostage, and every hour of hesitation is an hour they still
    /// hold the key. So this is arithmetic, not a decision: the DID leaves the
    /// set, and if that drops the policy below threshold, the policy is below
    /// threshold. §7's timelocked restore is the availability path back, and it
    /// is loud and vetoable by design.
    ///
    /// Returns whether `did` was enrolled — information, not permission.
    pub fn revoke(&mut self, did: &Did) -> bool {
        let before = self.enrolled.len();
        self.enrolled.retain(|e| e != did);
        self.enrolled.len() != before
    }

    /// Can this policy still reach [`Tier::T5`] at all — i.e. are there enough
    /// enrolled signers left to meet the threshold?
    ///
    /// Diagnostic only. It never gates [`QuorumPolicy::revoke`]; a caller may
    /// use it to *warn* that a revocation will drop the quorum, but the
    /// revocation proceeds regardless.
    pub fn is_satisfiable(&self) -> bool {
        self.threshold > 0 && self.enrolled.len() >= self.threshold as usize
    }
}

/// A UCAN-shaped delegation from `issuer` to `audience`.
///
/// The `signature` is `None` in v1 (the capability core is exercised unsigned).
/// A real issuer fills it via [`Verifier`]; [`Delegation::is_signed`] tells a
/// caller whether cryptographic proof is present. A production gate must call a
/// verifier — an unsigned delegation authorizes nothing on its own.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Delegation {
    pub issuer: Did,
    pub audience: Did,
    pub capabilities: Vec<Capability>,
    /// Not-valid-before (unix seconds), if bounded.
    pub not_before: Option<i64>,
    /// Expiry (unix seconds), if bounded.
    pub expires_at: Option<i64>,
    /// Ed25519 signature over the canonical form; `None` until signed.
    pub signature: Option<String>,
    /// The minimum device [`Tier`] a holder must present to exercise this
    /// delegation, if bounded. `None` = no device requirement.
    ///
    /// `default` so delegations minted before this field existed still
    /// deserialize (absent → `None`, the pre-existing behaviour exactly), and
    /// `skip_serializing_if` so a `None` ceiling emits **no key at all** rather
    /// than `"tier_ceiling":null`.
    ///
    /// The skip is load-bearing, not tidiness. This field sits inside
    /// [`Delegation::signing_payload`], which is the exact bytes a signature
    /// covers. Without the skip, re-serializing an old token would introduce a
    /// `null` key its issuer never signed, changing the payload and breaking
    /// every signature minted before this field existed. With it, an
    /// unceilinged delegation's payload is byte-identical to what it was — so
    /// old signatures keep verifying because nothing about their bytes moved.
    ///
    /// A ceiling that *is* set is inside the signature, which is the direction
    /// that matters: a tamperer cannot strip or lower one without invalidating
    /// the token.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tier_ceiling: Option<Tier>,
}

impl Delegation {
    /// An unsigned, unbounded grant (the shape a test or the core logic uses
    /// before crypto lands).
    pub fn grant(issuer: Did, audience: Did, capabilities: Vec<Capability>) -> Self {
        Delegation {
            issuer,
            audience,
            capabilities,
            not_before: None,
            expires_at: None,
            signature: None,
            tier_ceiling: None,
        }
    }

    /// This delegation, requiring `ceiling` as the holder's minimum device tier.
    pub fn with_tier_ceiling(mut self, ceiling: Tier) -> Self {
        self.tier_ceiling = Some(ceiling);
        self
    }

    pub fn is_signed(&self) -> bool {
        self.signature.is_some()
    }

    /// Is this delegation within its time bounds at `now` (unix seconds)?
    pub fn valid_at(&self, now: i64) -> bool {
        let after_start = self.not_before.map_or(true, |nb| now >= nb);
        let before_end = self.expires_at.map_or(true, |exp| now <= exp);
        after_start && before_end
    }

    /// Canonical bytes to sign / verify: a stable JSON serialization with the
    /// signature field cleared. Deterministic, so issuer and verifier agree.
    ///
    /// **INVARIANT — signed-byte stability.** Every field of [`Delegation`] is
    /// inside these bytes, so adding one changes what a signature covers. Any
    /// new field MUST either carry `skip_serializing_if` (so its absent/default
    /// state emits no key and old payloads stay byte-identical) or live outside
    /// this payload entirely. Without that, `serde_json` writes e.g.
    /// `"new_field":null`, the payload for an unchanged delegation moves, and
    /// **every signature minted before the field existed stops verifying.**
    /// `tier_ceiling` is the worked example; `none_ceiling_emits_no_key_so_old_signatures_survive`
    /// is the test that fails if this is forgotten.
    pub fn signing_payload(&self) -> Vec<u8> {
        let unsigned = Delegation {
            signature: None,
            ..self.clone()
        };
        serde_json::to_vec(&unsigned).unwrap_or_default()
    }

    /// Authorization CORE: does this delegation, addressed to `audience` and
    /// valid at `now`, permit `ability` on `resource`?
    ///
    /// This deliberately does NOT check the signature — that is the verifier's
    /// job (see [`Verifier::verify`]). It answers the capability question only.
    /// A caller enforcing real access composes both: `verify(&d)? && d.allows(…)`.
    pub fn allows(&self, audience: &Did, resource: &str, ability: &str, now: i64) -> bool {
        if &self.audience != audience || !self.valid_at(now) {
            return false;
        }
        self.capabilities
            .iter()
            .any(|c| c.permits(resource, ability))
    }

    /// [`Delegation::allows`], plus the device-tier ceiling.
    ///
    /// Additive on purpose: `allows()` keeps its exact v1 semantics, because
    /// silently teaching it a new way to say `false` would change what every
    /// existing caller means. A caller that cares about device strength calls
    /// this one; a caller that does not is unaffected.
    ///
    /// `tier_ceiling: None` makes this identical to `allows()` — the ceiling is
    /// a restriction where present, never a requirement where absent. It does
    /// **not** check the signature, for the same reason `allows()` does not:
    /// that is [`Verifier`]'s job, and a real gate composes all three —
    /// `verify(&d)? && d.allows_at_tier(…)`.
    pub fn allows_at_tier(
        &self,
        audience: &Did,
        resource: &str,
        ability: &str,
        now: i64,
        device_tier: Tier,
    ) -> bool {
        if let Some(ceiling) = self.tier_ceiling {
            if device_tier < ceiling {
                return false;
            }
        }
        self.allows(audience, resource, ability, now)
    }
}

/// Signature issuance + verification over [`Delegation`]s. The pending crypto
/// step lives here (Ed25519 over [`Delegation::signing_payload`]); v1 has no
/// implementation shipped — a real one lands once its curve API is
/// compile-verified. Kept as a trait so the unbuilt work is behind an interface,
/// never a panic in a shipped path.
pub trait Verifier {
    fn verify(&self, delegation: &Delegation) -> Result<(), CapabilityError>;
}

/// A platform's attestation payload, carried **opaquely**.
///
/// Every variant holds raw bytes or strings and nothing else. That is
/// deliberate, and it follows the `chain-exsat-evm` precedent: that crate
/// refused to invent BNRi event signatures it had never seen, and shipped the
/// table as UNVERIFIED data rather than as code asserting a shape. The same
/// applies here — none of these blobs has been parsed against a real device by
/// this seat, so naming their internal fields would be fabricating a structure
/// on the strength of documentation. An adapter that has actually parsed one
/// gives it meaning; this enum only says which platform it came from.
///
/// `#[non_exhaustive]`: platforms version by addition.
#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub enum DeviceEvidence {
    /// Trezor device certificate + signature (OPTIGA-backed on current models).
    Trezor { cert: Vec<u8>, signature: Vec<u8> },
    /// Android Key Attestation certificate chain, leaf-first, DER.
    AndroidKeyAttestation { chain: Vec<Vec<u8>> },
    /// Apple App Attest attestation object (CBOR).
    AppleAppAttest { attestation_object: Vec<u8> },
    /// TPM 2.0 quote + its signature.
    TpmQuote { quote: Vec<u8>, signature: Vec<u8> },
    /// A VPS/host configuration hash — the weakest evidence in the set, and
    /// carried so it can be *classified* as weak rather than silently trusted.
    VpsConfigHash { hash: String },
}

/// Classifies a platform's [`DeviceEvidence`] into an [`EvidenceClass`].
///
/// No implementation ships in this crate, and that is the point. Real
/// classification means verifying a certificate chain to a platform root — and
/// those are moving targets with real deadlines (Android's RKP root rotated
/// 2026-02-01, per the dispatch — **UNVERIFIED here**, cited as the reason to
/// keep this behind a trait rather than as a fact this crate relies on). A
/// wrong-but-compiling classifier is worse than none: it would return
/// `HardwareKeyVerifiedBoot` for a blob nobody checked, and the whole ladder
/// rests on that answer being earned.
///
/// So the unbuilt work sits behind an interface, never a `todo!()` in a shipped
/// path — the same discipline as [`Verifier`].
pub trait EvidenceVerifier {
    fn classify(&self, evidence: &DeviceEvidence) -> Result<EvidenceClass, CapabilityError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CapabilityError {
    /// The delegation carried no signature.
    Unsigned,
    /// The signature did not verify against the issuer's key.
    BadSignature,
    /// The delegation is outside its time bounds.
    Expired,
    /// The device evidence did not classify — malformed, unrecognized, or its
    /// chain did not verify. Fail-closed: a blob that cannot be classified
    /// earns no tier, rather than falling back to a weak one.
    UnclassifiableEvidence,
}

impl std::fmt::Display for CapabilityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CapabilityError::Unsigned => write!(f, "delegation is unsigned"),
            CapabilityError::BadSignature => write!(f, "delegation signature did not verify"),
            CapabilityError::Expired => write!(f, "delegation is outside its time bounds"),
            CapabilityError::UnclassifiableEvidence => {
                write!(f, "device evidence did not classify")
            }
        }
    }
}

impl std::error::Error for CapabilityError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn did_method_and_root() {
        assert_eq!(Did::new("did:autonomi:abc").method(), Some("autonomi"));
        assert_eq!(Did::new("did:plc:xyz").method(), Some("plc"));
        assert!(Did::new("did:autonomi:abc").is_root());
        assert!(!Did::new("did:plc:xyz").is_root());
        assert_eq!(Did::new("garbage").method(), None);
    }

    #[test]
    fn exact_capability_match() {
        let c = Capability::new("storage.sovereign", "farm/read");
        assert!(c.permits("storage.sovereign", "farm/read"));
        assert!(!c.permits("storage.sovereign", "farm/toggle"));
        assert!(!c.permits("settlement.private", "farm/read"));
    }

    #[test]
    fn ability_wildcards_are_segment_wise() {
        let c = Capability::new("storage.sovereign", "farm/*");
        assert!(c.permits("storage.sovereign", "farm"));
        assert!(c.permits("storage.sovereign", "farm/read"));
        assert!(c.permits("storage.sovereign", "farm/toggle"));
        // must not leak across a non-slash boundary
        assert!(!c.permits("storage.sovereign", "farmx"));
        assert!(!c.permits("storage.sovereign", "wallet/spend"));
    }

    #[test]
    fn resource_and_ability_star() {
        let god = Capability::new("*", "*");
        assert!(god.permits("anything", "any/ability"));
        let any_res = Capability::new("*", "wallet/spend");
        assert!(any_res.permits("wallet-1", "wallet/spend"));
        assert!(!any_res.permits("wallet-1", "wallet/view"));
    }

    #[test]
    fn time_bounds() {
        let mut d = Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("storage.sovereign", "farm/read")],
        );
        d.not_before = Some(100);
        d.expires_at = Some(200);
        assert!(!d.valid_at(99));
        assert!(d.valid_at(100));
        assert!(d.valid_at(200));
        assert!(!d.valid_at(201));
    }

    #[test]
    fn allows_composes_audience_time_and_capability() {
        let design = Did::new("did:plc:design");
        let other = Did::new("did:plc:other");
        let mut d = Delegation::grant(
            Did::new("did:autonomi:root"),
            design.clone(),
            vec![Capability::new("storage.sovereign", "farm/*")],
        );
        d.expires_at = Some(500);

        assert!(d.allows(&design, "storage.sovereign", "farm/read", 100));
        assert!(d.allows(&design, "storage.sovereign", "farm/toggle", 100));
        // wrong audience
        assert!(!d.allows(&other, "storage.sovereign", "farm/read", 100));
        // wrong resource
        assert!(!d.allows(&design, "settlement.private", "farm/read", 100));
        // expired
        assert!(!d.allows(&design, "storage.sovereign", "farm/read", 501));
    }

    #[test]
    fn unsigned_by_default_and_signing_payload_excludes_signature() {
        let mut d = Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("*", "*")],
        );
        assert!(!d.is_signed());
        let payload_a = d.signing_payload();
        // Signing must not change the payload (signature is excluded from it).
        d.signature = Some("sig-placeholder".into());
        assert!(d.is_signed());
        assert_eq!(payload_a, d.signing_payload());
    }

    #[test]
    fn delegation_roundtrips_through_json() {
        let d = Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![
                Capability::new("storage.sovereign", "farm/read"),
                Capability::new("settlement.private", "wallet/view"),
            ],
        );
        let json = serde_json::to_string(&d).unwrap();
        let back: Delegation = serde_json::from_str(&json).unwrap();
        assert_eq!(d, back);
    }

    // ── attestation tiers ────────────────────────────────────────────────

    #[test]
    fn tiers_are_ordered_and_map_from_evidence() {
        assert!(Tier::T1 < Tier::T2 && Tier::T2 < Tier::T3);
        assert!(Tier::T3 < Tier::T4 && Tier::T4 < Tier::T5);

        assert_eq!(Tier::of(EvidenceClass::SessionOnly), Tier::T1);
        assert_eq!(Tier::of(EvidenceClass::ProvisionedSoftware), Tier::T2);
        assert_eq!(Tier::of(EvidenceClass::HardwareKey), Tier::T3);
        assert_eq!(Tier::of(EvidenceClass::HardwareKeyVerifiedBoot), Tier::T4);
        assert_eq!(Tier::of(EvidenceClass::IsolatedSigner), Tier::T5);
        // the method agrees with the free function
        assert_eq!(
            EvidenceClass::IsolatedSigner.tier(),
            Tier::of(EvidenceClass::IsolatedSigner)
        );
    }

    fn ceilinged(ceiling: Tier) -> Delegation {
        Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("settlement.private", "wallet/spend")],
        )
        .with_tier_ceiling(ceiling)
    }

    #[test]
    fn ceiling_gates_below_and_admits_at_or_above() {
        let d = ceilinged(Tier::T5);
        let aud = Did::new("did:plc:design");

        // T4 device against a T5 ceiling: refused.
        assert!(!d.allows_at_tier(&aud, "settlement.private", "wallet/spend", 0, Tier::T4));
        // T5 device: admitted.
        assert!(d.allows_at_tier(&aud, "settlement.private", "wallet/spend", 0, Tier::T5));

        // A ceiling is a floor on device strength, not an equality: T5 clears T4.
        let d4 = ceilinged(Tier::T4);
        assert!(d4.allows_at_tier(&aud, "settlement.private", "wallet/spend", 0, Tier::T5));
    }

    #[test]
    fn ceiling_does_not_rescue_a_capability_mismatch() {
        // A strong device must not paper over a grant that never permitted the
        // ability — the two checks are AND, not OR.
        let d = ceilinged(Tier::T1);
        let aud = Did::new("did:plc:design");
        assert!(!d.allows_at_tier(&aud, "settlement.private", "wallet/steal", 0, Tier::T5));
        assert!(!d.allows_at_tier(
            &Did::new("did:plc:other"),
            "settlement.private",
            "wallet/spend",
            0,
            Tier::T5
        ));
    }

    #[test]
    fn no_ceiling_means_allows_at_tier_matches_allows() {
        let d = Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("storage.sovereign", "farm/read")],
        );
        let aud = Did::new("did:plc:design");
        assert!(d.tier_ceiling.is_none());
        // identical to allows() at every tier, including the weakest
        for t in [Tier::T1, Tier::T3, Tier::T5] {
            assert_eq!(
                d.allows_at_tier(&aud, "storage.sovereign", "farm/read", 0, t),
                d.allows(&aud, "storage.sovereign", "farm/read", 0),
            );
        }
    }

    #[test]
    fn old_json_without_tier_ceiling_still_deserializes() {
        // A delegation minted before the field existed. Must parse, and must
        // parse as None — the pre-existing behaviour, unchanged.
        // `Did` is a newtype over String, so it is a bare JSON string.
        let old = r#"{
            "issuer": "did:autonomi:root",
            "audience": "did:plc:design",
            "capabilities": [{"with":"storage.sovereign","can":"farm/read"}],
            "not_before": null,
            "expires_at": null,
            "signature": null
        }"#;
        let d: Delegation = serde_json::from_str(old).unwrap();
        assert_eq!(d.tier_ceiling, None);
        assert!(d.allows(
            &Did::new("did:plc:design"),
            "storage.sovereign",
            "farm/read",
            0
        ));
    }

    #[test]
    fn none_ceiling_emits_no_key_so_old_signatures_survive() {
        // THE back-compat invariant. tier_ceiling lives inside signing_payload;
        // if None emitted `"tier_ceiling":null`, every signature minted before
        // this field existed would break. skip_serializing_if is what prevents
        // that, and this test is what pins it.
        let d = Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("storage.sovereign", "farm/read")],
        );
        let json = serde_json::to_string(&d).unwrap();
        assert!(
            !json.contains("tier_ceiling"),
            "None must emit no key at all, got: {json}"
        );
        let payload = String::from_utf8(d.signing_payload()).unwrap();
        assert!(!payload.contains("tier_ceiling"));

        // A set ceiling IS in the payload — a tamperer must not be able to
        // strip or lower it without invalidating the signature.
        let c = d.clone().with_tier_ceiling(Tier::T5);
        let cpayload = String::from_utf8(c.signing_payload()).unwrap();
        assert!(cpayload.contains("tier_ceiling"));
        assert_ne!(payload, cpayload);
    }

    #[test]
    fn ceiling_roundtrips_through_json() {
        let d = ceilinged(Tier::T4);
        let back: Delegation = serde_json::from_str(&serde_json::to_string(&d).unwrap()).unwrap();
        assert_eq!(d, back);
        assert_eq!(back.tier_ceiling, Some(Tier::T4));
    }

    // ── T5 quorum policy ─────────────────────────────────────────────────

    fn safe7() -> Did {
        Did::new("did:autonomi:safe7-anchor")
    }
    fn signer_b() -> Did {
        Did::new("did:autonomi:signer-b")
    }
    fn signer_c() -> Did {
        Did::new("did:autonomi:signer-c")
    }
    fn two_of_three() -> QuorumPolicy {
        QuorumPolicy::new(2, vec![safe7(), signer_b(), signer_c()])
    }

    #[test]
    fn quorum_met_reaches_t5() {
        let p = two_of_three();
        let presented = [
            (safe7(), EvidenceClass::IsolatedSigner),
            (signer_b(), EvidenceClass::IsolatedSigner),
        ];
        assert_eq!(p.counted(&presented), 2);
        assert_eq!(p.effective_tier(&presented), Tier::T5);
    }

    #[test]
    fn lone_isolated_signer_under_a_2_of_3_policy_is_not_t5() {
        // The point of the ruling. One Safe 7 is still an isolated signer, but
        // it is not the quorum — so it cannot carry the authority the quorum
        // exists to guard.
        let p = two_of_three();
        let presented = [(safe7(), EvidenceClass::IsolatedSigner)];
        assert_eq!(p.counted(&presented), 1);
        assert_eq!(p.effective_tier(&presented), Tier::T4);
        assert_ne!(p.effective_tier(&presented), Tier::T5);
    }

    #[test]
    fn non_enrolled_signer_does_not_count_toward_quorum() {
        let p = two_of_three();
        let stranger = Did::new("did:autonomi:not-ours");
        let presented = [
            (safe7(), EvidenceClass::IsolatedSigner),
            (stranger, EvidenceClass::IsolatedSigner),
        ];
        assert_eq!(
            p.counted(&presented),
            1,
            "a stranger's Trezor is not our quorum"
        );
        assert_eq!(p.effective_tier(&presented), Tier::T4);
    }

    #[test]
    fn enrolled_but_not_isolated_signer_does_not_count() {
        // An enrolled DID presenting weaker evidence is not a T5 signer that
        // day. Enrolment is not a standing claim about the device in hand.
        let p = two_of_three();
        let presented = [
            (safe7(), EvidenceClass::IsolatedSigner),
            (signer_b(), EvidenceClass::HardwareKeyVerifiedBoot),
        ];
        assert_eq!(p.counted(&presented), 1);
        assert_eq!(p.effective_tier(&presented), Tier::T4);
    }

    #[test]
    fn one_signer_presented_thrice_is_still_one_signer() {
        let p = two_of_three();
        let presented = [
            (safe7(), EvidenceClass::IsolatedSigner),
            (safe7(), EvidenceClass::IsolatedSigner),
            (safe7(), EvidenceClass::IsolatedSigner),
        ];
        assert_eq!(p.counted(&presented), 1, "replay is not a second signer");
        assert_ne!(p.effective_tier(&presented), Tier::T5);
    }

    #[test]
    fn effective_tier_falls_back_to_best_single_device() {
        let p = two_of_three();
        // Nothing presented: the floor.
        assert_eq!(p.effective_tier(&[]), Tier::T1);
        // A phone and a browser: best of the two, unaffected by enrolment.
        let presented = [
            (Did::new("did:plc:browser"), EvidenceClass::SessionOnly),
            (
                Did::new("did:plc:phone"),
                EvidenceClass::HardwareKeyVerifiedBoot,
            ),
        ];
        assert_eq!(p.effective_tier(&presented), Tier::T4);
        let weak = [(Did::new("did:plc:vps"), EvidenceClass::ProvisionedSoftware)];
        assert_eq!(p.effective_tier(&weak), Tier::T2);
    }

    #[test]
    fn revoke_wins_even_when_it_breaks_quorum() {
        // THE ruling, as arithmetic. A compromised signer is removed; the fact
        // that removal drops the set below threshold does not block it.
        let mut p = two_of_three();
        assert!(p.is_satisfiable());

        assert!(p.revoke(&signer_b()));
        assert!(
            p.is_satisfiable(),
            "2 of 2 remaining still meets a threshold of 2"
        );

        // Revoke again: now only one signer remains and 2-of-3 is unreachable.
        assert!(p.revoke(&signer_c()));
        assert!(
            !p.is_satisfiable(),
            "quorum is now broken — and the revoke still happened"
        );
        assert_eq!(p.enrolled, vec![safe7()]);

        // Even the last signer can be revoked. Being the only one left is not
        // a defence for a compromised device.
        assert!(p.revoke(&safe7()));
        assert!(p.enrolled.is_empty());
        assert!(!p.is_satisfiable());
        // And with nothing enrolled, no presentation reaches T5.
        assert_ne!(
            p.effective_tier(&[(safe7(), EvidenceClass::IsolatedSigner)]),
            Tier::T5
        );
    }

    #[test]
    fn revoking_an_unenrolled_did_is_a_no_op_not_an_error() {
        let mut p = two_of_three();
        assert!(!p.revoke(&Did::new("did:autonomi:never-enrolled")));
        assert_eq!(p.enrolled.len(), 3);
    }

    #[test]
    fn genesis_is_one_of_one_and_raises_to_two_of_three() {
        // Genesis honesty: the founder has ONE Safe 7 today. The policy says so
        // rather than pretending the other two exist.
        let mut p = QuorumPolicy::genesis(safe7());
        assert_eq!(p.threshold, 1);
        assert_eq!(p.enrolled, vec![safe7()]);
        assert!(p.is_satisfiable());
        // At 1-of-1 the lone anchor DOES reach T5 — it is the whole quorum.
        assert_eq!(
            p.effective_tier(&[(safe7(), EvidenceClass::IsolatedSigner)]),
            Tier::T5
        );

        // Signers enrol; the current quorum authorises its successor.
        p.enrolled.push(signer_b());
        p.enrolled.push(signer_c());
        p.threshold = 2;
        assert!(p.is_satisfiable());

        // The same lone anchor that was T5 a moment ago is now T4 — the raise
        // took effect, and that is the transition working.
        assert_eq!(
            p.effective_tier(&[(safe7(), EvidenceClass::IsolatedSigner)]),
            Tier::T4
        );
        assert_eq!(
            p.effective_tier(&[
                (safe7(), EvidenceClass::IsolatedSigner),
                (signer_c(), EvidenceClass::IsolatedSigner),
            ]),
            Tier::T5
        );
    }

    #[test]
    fn zero_threshold_never_reaches_t5() {
        // A degenerate policy must not make T5 free.
        let p = QuorumPolicy::new(0, vec![safe7()]);
        assert!(!p.is_satisfiable());
        assert_ne!(
            p.effective_tier(&[(safe7(), EvidenceClass::IsolatedSigner)]),
            Tier::T5
        );
    }

    #[test]
    fn quorum_policy_roundtrips_through_json() {
        let p = two_of_three();
        let back: QuorumPolicy = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn bio_presence_composes_and_never_substitutes() {
        // Presence is an ADDITIONAL condition, not a compensating one.
        let strong = EvidenceClass::IsolatedSigner; // T5
        let weak = EvidenceClass::SessionOnly; // T1

        // required met + presence required and present -> yes
        assert!(strong.meets_with_presence(Tier::T5, BioPresence::Present, true));
        // required met + presence required but absent -> NO. A strong device
        // does not satisfy a liveness requirement by being strong.
        assert!(!strong.meets_with_presence(
            Tier::T5,
            BioPresence::Present.min(BioPresence::Absent),
            true
        ));
        assert!(!strong.meets_with_presence(Tier::T5, BioPresence::Absent, true));
        // presence not required -> absence is fine
        assert!(strong.meets_with_presence(Tier::T5, BioPresence::Absent, false));
        // liveness on a weak device does NOT lift its tier
        assert!(!weak.meets_with_presence(Tier::T4, BioPresence::Present, true));
    }
}
