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
    /// A Trezor `AuthenticityProof`, as the device actually returns it.
    ///
    /// Shaped from the wire protocol
    /// (`trezor-firmware/common/protob/messages-management.proto`), not from a
    /// guess: `AuthenticateDevice { challenge }` answers with **up to three
    /// independent chains**, each with its own signature — Optiga, Tropic, and
    /// MCU. The earlier `{ cert, signature }` singular could not represent a
    /// Safe 7's answer at all.
    ///
    /// Each signature is DER, over `"\x13AuthenticateDevice:" || len-prefixed
    /// challenge` — so `challenge` is carried here too. A proof is only
    /// meaningful against the challenge it answers; without it a verifier
    /// cannot tell a fresh proof from a replayed one.
    ///
    /// `tropic_*` and `mcu_*` are optional because the protobuf marks them so —
    /// the field set is a property of the model, and older units answer with
    /// Optiga alone. `internal_model` is the device's own identifier (`T3W1` on
    /// a Safe 7, observed in a real device log) rather than a marketing name,
    /// because that is what a verifier can actually match on.
    ///
    /// **Raw bytes only, no field semantics.** Nothing here has been parsed
    /// against real hardware by this seat — the `trezorctl device authenticate
    /// --raw` capture has not happened. The `chain-exsat-evm` precedent holds:
    /// carry the blob, name its origin, invent nothing about its interior until
    /// something has read one.
    Trezor {
        /// The challenge that was sent; every signature below is over it.
        challenge: Vec<u8>,
        /// Chain starting with the Optiga device certificate, DER.
        optiga_certificates: Vec<Vec<u8>>,
        /// DER signature from the Optiga secure element.
        optiga_signature: Vec<u8>,
        /// Chain starting with the Tropic device certificate (Safe 7's
        /// TROPIC01). Empty on models without one.
        tropic_certificates: Vec<Vec<u8>>,
        /// DER signature from Tropic; `None` on models without one.
        tropic_signature: Option<Vec<u8>>,
        /// MCU device certificate chain, signed by the vendor root CA.
        mcu_certificates: Vec<Vec<u8>>,
        /// DER signature from the MCU; `None` where the model omits it.
        mcu_signature: Option<Vec<u8>>,
        /// The device's own model identifier, e.g. `T3W1` (Safe 7).
        internal_model: String,
    },
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

/// Ed25519 verification of [`Delegation`] signatures — the crypto step v1
/// deferred, now built.
///
/// # Why `verify_strict`, not `verify`
///
/// Deliberate, per the founder rider (2026-07-16), and the difference is not
/// cosmetic. Ed25519's original definition left both scalar and **group
/// element** malleability open: a public key or signature component can lie in
/// a small-order subgroup, so more than one `(key, sig)` pair can verify the
/// same message. `verify_strict` rejects small-order/non-canonical points and
/// applies the cofactor-less equation; `verify` does not.
///
/// For a delegation token that is exactly the wrong property. `signing_payload`
/// is the token's identity, and a caller must be able to treat "this verified"
/// as "this issuer, and no other, authorised these bytes". Under plain
/// `verify`, a malleable variant of a token could verify too — the token stops
/// being unique, which is the whole premise of a capability grant. The crate's
/// own upstream doc names this: group-element malleability became a concern
/// specifically for "unique identities". A delegation is a unique identity.
///
/// The cost is that a signature some other library produced loosely might be
/// refused here. That is the correct direction for this crate: fail-closed, and
/// a token we cannot uniquely attribute is a token we do not honour.
///
/// # What this verifier does NOT do
///
/// It answers one question: did this issuer sign these bytes? It does not check
/// capabilities, tiers, or quorum — a real gate composes all of them:
/// `verify(&d)? && d.allows_at_tier(…)`. Time bounds ARE checked, because an
/// expired token is not one this crate should report as verified.
pub struct Ed25519Verifier {
    /// The issuer's public key, by DID. Keyed on DID because that is the
    /// crate's principal — a signer rotating its key stays the same principal,
    /// and this map is what gets updated on rotation.
    keys: std::collections::BTreeMap<Did, ed25519_dalek::VerifyingKey>,
    /// Unix seconds, supplied by the caller. This crate reads no clock: a
    /// verifier that consults `SystemTime` is untestable and, in a kernel that
    /// bars clock reads in some paths, unusable. The caller owns the time.
    now: i64,
}

impl Ed25519Verifier {
    /// A verifier that knows `keys` and evaluates time bounds at `now`.
    pub fn new(
        keys: std::collections::BTreeMap<Did, ed25519_dalek::VerifyingKey>,
        now: i64,
    ) -> Self {
        Ed25519Verifier { keys, now }
    }

    /// Sign `delegation`'s canonical payload, returning the delegation with its
    /// `signature` filled.
    ///
    /// Test/issuer helper. The signing key is borrowed, never stored — and
    /// `ed25519_dalek::SigningKey` is `ZeroizeOnDrop` (its `Drop` calls
    /// `secret_key.zeroize()`), so it scrubs when the caller drops it. That is
    /// the `zeroize` feature earning its place, not decoration.
    pub fn sign(delegation: &Delegation, key: &ed25519_dalek::SigningKey) -> Delegation {
        use ed25519_dalek::Signer;
        let sig = key.sign(&delegation.signing_payload());
        let mut signed = delegation.clone();
        signed.signature = Some(hex_lower(&sig.to_bytes()));
        signed
    }
}

/// Lowercase hex, no prefix — the signature's wire form in `Delegation`.
fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

impl Verifier for Ed25519Verifier {
    fn verify(&self, delegation: &Delegation) -> Result<(), CapabilityError> {
        let sig_hex = delegation
            .signature
            .as_deref()
            .ok_or(CapabilityError::Unsigned)?;

        if !delegation.valid_at(self.now) {
            return Err(CapabilityError::Expired);
        }

        let key = self
            .keys
            .get(&delegation.issuer)
            .ok_or(CapabilityError::UnknownIssuer)?;

        // Every malformed input below is BadSignature, not a distinct error:
        // a caller must not be able to tell "wrong length" from "wrong bytes"
        // by the error alone.
        let raw = hex_decode(sig_hex).ok_or(CapabilityError::BadSignature)?;
        let bytes: [u8; 64] = raw.try_into().map_err(|_| CapabilityError::BadSignature)?;
        let sig = ed25519_dalek::Signature::from_bytes(&bytes);

        key.verify_strict(&delegation.signing_payload(), &sig)
            .map_err(|_| CapabilityError::BadSignature)
    }
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
    /// No public key is known for the delegation's issuer.
    ///
    /// Distinct from `BadSignature` on purpose: "I cannot check this" and "I
    /// checked this and it is forged" are different facts, and collapsing them
    /// would let an operator read an un-enrolled issuer as an attack. Both
    /// still deny — fail-closed either way.
    UnknownIssuer,
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
            CapabilityError::UnknownIssuer => {
                write!(f, "no public key known for the delegation's issuer")
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

    // ── Ed25519 verifier ─────────────────────────────────────────────────

    fn test_key() -> ed25519_dalek::SigningKey {
        // A fixed seed: deterministic tests, and no RNG dependency. This is a
        // TEST key and never leaves this module.
        ed25519_dalek::SigningKey::from_bytes(&[7u8; 32])
    }

    fn keyring(did: Did, k: &ed25519_dalek::SigningKey) -> Ed25519Verifier {
        let mut m = std::collections::BTreeMap::new();
        m.insert(did, k.verifying_key());
        Ed25519Verifier::new(m, 1_000)
    }

    fn unsigned_grant() -> Delegation {
        Delegation::grant(
            Did::new("did:autonomi:root"),
            Did::new("did:plc:design"),
            vec![Capability::new("storage.sovereign", "farm/read")],
        )
    }

    #[test]
    fn signs_and_verifies_a_real_signature() {
        let k = test_key();
        let d = Ed25519Verifier::sign(&unsigned_grant(), &k);
        assert!(d.is_signed());
        let v = keyring(Did::new("did:autonomi:root"), &k);
        assert_eq!(v.verify(&d), Ok(()));
    }

    #[test]
    fn unsigned_is_rejected_as_unsigned() {
        let k = test_key();
        let v = keyring(Did::new("did:autonomi:root"), &k);
        assert_eq!(v.verify(&unsigned_grant()), Err(CapabilityError::Unsigned));
    }

    #[test]
    fn tampering_with_the_payload_breaks_the_signature() {
        // THE property. The signature covers signing_payload(); mutate any
        // signed field and verification must fail — this is what stops a holder
        // widening their own grant.
        let k = test_key();
        let v = keyring(Did::new("did:autonomi:root"), &k);

        let signed = Ed25519Verifier::sign(&unsigned_grant(), &k);
        assert_eq!(v.verify(&signed), Ok(()));

        // Escalate the capability: farm/read -> wallet/spend.
        let mut escalated = signed.clone();
        escalated.capabilities = vec![Capability::new("settlement.private", "wallet/spend")];
        assert_eq!(v.verify(&escalated), Err(CapabilityError::BadSignature));

        // Redirect the audience.
        let mut redirected = signed.clone();
        redirected.audience = Did::new("did:plc:attacker");
        assert_eq!(v.verify(&redirected), Err(CapabilityError::BadSignature));

        // Strip a tier ceiling — the attack the skip_serializing_if invariant
        // exists to make detectable.
        let ceilinged = Ed25519Verifier::sign(&unsigned_grant().with_tier_ceiling(Tier::T5), &k);
        assert_eq!(v.verify(&ceilinged), Ok(()));
        let mut stripped = ceilinged.clone();
        stripped.tier_ceiling = None;
        assert_eq!(
            v.verify(&stripped),
            Err(CapabilityError::BadSignature),
            "stripping a ceiling must invalidate the token"
        );
    }

    #[test]
    fn a_different_key_does_not_verify() {
        let signer = test_key();
        let other = ed25519_dalek::SigningKey::from_bytes(&[9u8; 32]);
        let d = Ed25519Verifier::sign(&unsigned_grant(), &signer);
        // The verifier holds the WRONG key for this issuer.
        let v = keyring(Did::new("did:autonomi:root"), &other);
        assert_eq!(v.verify(&d), Err(CapabilityError::BadSignature));
    }

    #[test]
    fn unknown_issuer_is_distinct_from_bad_signature() {
        let k = test_key();
        let d = Ed25519Verifier::sign(&unsigned_grant(), &k);
        // Verifier knows a different DID entirely.
        let v = keyring(Did::new("did:autonomi:somebody-else"), &k);
        assert_eq!(
            v.verify(&d),
            Err(CapabilityError::UnknownIssuer),
            "'I cannot check this' must not read as 'this is forged'"
        );
    }

    #[test]
    fn expired_is_rejected_even_with_a_valid_signature() {
        let k = test_key();
        let mut d = unsigned_grant();
        d.expires_at = Some(500);
        let d = Ed25519Verifier::sign(&d, &k);
        // Verifier's clock is 1000 — past expiry.
        let v = keyring(Did::new("did:autonomi:root"), &k);
        assert_eq!(v.verify(&d), Err(CapabilityError::Expired));

        // Same token, earlier clock: fine.
        let mut m = std::collections::BTreeMap::new();
        m.insert(Did::new("did:autonomi:root"), k.verifying_key());
        assert_eq!(Ed25519Verifier::new(m, 400).verify(&d), Ok(()));
    }

    #[test]
    fn malformed_signature_bytes_are_bad_signature_not_a_panic() {
        let k = test_key();
        let v = keyring(Did::new("did:autonomi:root"), &k);
        for junk in ["", "zz", "abc", &"ab".repeat(63), &"ab".repeat(65)] {
            let mut d = unsigned_grant();
            d.signature = Some(junk.to_string());
            assert_eq!(
                v.verify(&d),
                Err(CapabilityError::BadSignature),
                "junk signature {junk:?} must deny, never panic"
            );
        }
    }

    #[test]
    fn a_small_order_signature_r_is_refused() {
        // Rider 3, probed at the one place `verify_strict` and `verify`
        // actually differ. Reading the upstream source (verifying.rs:357):
        // verify_strict rejects when `signature_R.is_small_order()` OR the key
        // is small-order — a property of the SIGNATURE's R component. Plain
        // verify performs no such check.
        //
        // Honest limit, stated rather than implied: this test pins that a
        // small-order R denies, which is the behaviour we want. It does NOT by
        // itself distinguish verify from verify_strict — constructing a
        // signature that verify accepts and verify_strict rejects requires
        // forging against a small-order key, which `VerifyingKey::from_bytes`
        // refuses to build in 2.x. The strict choice is defended by the source
        // reading and the doc comment above `Ed25519Verifier`, not by this
        // assertion. Recording that so the test is not mistaken for a proof it
        // is not.
        let k = test_key();
        let v = keyring(Did::new("did:autonomi:root"), &k);
        let mut d = unsigned_grant();
        // R = the all-zeros compressed point (small order), s = 0.
        d.signature = Some(hex_lower(&[0u8; 64]));
        assert_eq!(v.verify(&d), Err(CapabilityError::BadSignature));
    }

    #[test]
    fn verifying_key_rejects_the_all_zeros_point() {
        // Why the test above cannot distinguish the two verifiers: 2.x refuses
        // to even construct a small-order VerifyingKey, so that attack surface
        // is closed before either verify path is reached. Pinned because if a
        // future version relaxes this, the strict choice starts carrying weight
        // this crate currently gets for free — and that is worth noticing.
        let vk = ed25519_dalek::VerifyingKey::from_bytes(&[0u8; 32]);
        match vk {
            Err(_) => {}
            Ok(k) => assert!(
                k.is_weak(),
                "if 2.x ever builds this key, it must at least report it weak"
            ),
        }
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
