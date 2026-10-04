//! `identity.root` + the Capability primitive (Phase 2 scaffold) — the
//! authorization core behind the console's multi-domain, one-DID access model
//! (design brief §2.5).
//!
//! The model, stated plainly:
//! - A [`Did`] is a principal (`did:autonomi:…` root, `did:plc:…` persona).
//!   Events and authorization key off DIDs, never raw public keys, so key
//!   rotation never orphans access (the constitution's identity rule).
//! - A [`Capability`] is a UCAN-shaped `(with, can)` pair: *which resource* and
//!   *which ability*. "Give the design seat read on the node panel" is a
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
//! **What sits behind the [`Verifier`] trait:** signature verification over the
//! delegation's canonical form — [`Ed25519Verifier`] (the v1 signature),
//! [`MlDsa65Verifier`] (the post-quantum one, ML-DSA-65), and [`AgileVerifier`],
//! which dispatches on the algorithm id a token carries and refuses an id it
//! cannot verify. The delegation-chain proof is still unbuilt; it stays behind
//! the trait — not a `todo!()` — so it never sits in a shipped path, matching
//! the adapter discipline.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// A decentralized identifier used as an authorization principal. The canonical
/// definition moved to the permissive `type-bindings` crate so SDK edges can reuse it
/// without AGPL infection; re-exported here so `capability::Did` stays the path every
/// caller already uses.
pub use type_bindings::Did;

/// A UCAN-shaped capability: an ability over a resource.
///
/// `with` is a resource URI — a capability name from the constitution's
/// adapter table (`storage.sovereign`, `settlement.private`, …) or a scoped
/// resource (`node:node-a`). `can` is an ability path (`node/read`,
/// `node/toggle`, `wallet/spend`), matched hierarchically: `node/*` grants
/// every `node/…` ability, and `*` grants all.
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
/// `a/b/…`; otherwise exact. Segment-wise so `node/*` does not match `nodex`.
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

/// One device presenting its evidence, with **when it last proved it**.
///
/// The `attested_at` is the whole point: an [`EvidenceClass`] on its own is a
/// claim with no age, and a tier is a *living* claim. This is the input shape
/// for [`QuorumPolicy::effective_tier_fresh`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Presentation {
    pub did: Did,
    pub class: EvidenceClass,
    /// Unix seconds when this class was last proven. Caller-supplied, like every
    /// other clock in this crate.
    pub attested_at: i64,
}

impl Presentation {
    pub fn new(did: Did, class: EvidenceClass, attested_at: i64) -> Self {
        Presentation {
            did,
            class,
            attested_at,
        }
    }
}

/// A tier, plus whether **decay** is why it is not higher.
///
/// The distinction is a design contract, not a nicety: *"you never had this"*
/// and *"this lapsed"* must not render identically. A browser at T1 was always
/// T1 (`decayed: false`); a Safe 7 whose attestation went stale is at T1 having
/// held T5 an hour ago (`decayed: true`) — that one gets the violet guard-state
/// and a re-attest prompt, never a lockout scare.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TierAssessment {
    pub tier: Tier,
    /// True iff freshness is what lowered the tier.
    pub decayed: bool,
}

/// How recently each [`EvidenceClass`] must have been re-proven — **freshness as
/// policy data**.
///
/// The third instance of the doctrine. [`QuorumPolicy`] made signer trust policy
/// data; [`FirmwarePolicy`] made firmware trust policy data; this makes
/// *freshness* policy data. Same shape: [`ReattestationPolicy::genesis`] states
/// its assumptions rather than hiding them, every value is tunable, and changing
/// one is a T5/Article-VI act.
///
/// **This is a second clock, and it is not the delegation's.**
/// [`Delegation::not_before`]/[`Delegation::expires_at`] bound the *grant* — how
/// long the authority lasts. This bounds how recently the *device* re-proved its
/// class. A perfectly valid, unexpired delegation held by a device whose
/// attestation went stale is still an authority the device can no longer
/// exercise at its old tier, because the evidence behind the tier has aged out.
///
/// Past cadence, the effective tier decays to [`Tier::T1`] — **a quiet fall,
/// re-attest to restore, never a lockout.**
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub struct ReattestationPolicy {
    /// Max age in seconds, per class. **A class with no entry is never fresh** —
    /// fail-closed. If a class is added later and nobody sets its cadence, it
    /// decays to T1 rather than being trusted forever by omission.
    pub max_age_by_class: std::collections::BTreeMap<EvidenceClass, i64>,
    /// How far ahead of `now` an `attested_at` may sit before it is refused, in
    /// seconds. A visible row rather than a hidden constant: clock skew is a
    /// policy decision, and 0 is the fail-closed default.
    pub max_future_skew: i64,
}

impl ReattestationPolicy {
    pub fn new(
        max_age_by_class: std::collections::BTreeMap<EvidenceClass, i64>,
        max_future_skew: i64,
    ) -> Self {
        ReattestationPolicy {
            max_age_by_class,
            max_future_skew,
        }
    }

    /// Genesis cadences — **stated, not hidden, and every number is
    /// founder-tunable rather than law.**
    ///
    /// The shapes come from how each class can actually re-prove itself:
    /// - **E5 · 15 min** — a signer re-proves per connection; it is in your hand
    ///   or it is not.
    /// - **E4 · 24 h** — continuous attestation (App Attest assertions, an
    ///   Auditor schedule) makes a day cheap to meet.
    /// - **E3 · 7 d** — no boot proof to refresh; the key's residency is the
    ///   claim, and it does not change hourly.
    /// - **E2 · 24 h** — a VPS re-proves per boot with a config hash.
    ///
    /// **E1 is deliberately absent.** With no entry it is never fresh, so it
    /// decays to T1 — and E1 *is* T1, so the decay is a no-op. The floor cannot
    /// fall further, and inventing a number for it would be a knob that changes
    /// nothing.
    pub fn genesis() -> Self {
        let mut m = std::collections::BTreeMap::new();
        m.insert(EvidenceClass::IsolatedSigner, 15 * 60);
        m.insert(EvidenceClass::HardwareKeyVerifiedBoot, 24 * 60 * 60);
        m.insert(EvidenceClass::HardwareKey, 7 * 24 * 60 * 60);
        m.insert(EvidenceClass::ProvisionedSoftware, 24 * 60 * 60);
        ReattestationPolicy::new(m, 0)
    }

    /// The configured max age for `class`, if any.
    pub fn max_age(&self, class: EvidenceClass) -> Option<i64> {
        self.max_age_by_class.get(&class).copied()
    }

    /// Is `class`, proven at `attested_at`, still fresh at `now`?
    ///
    /// Fresh iff the attestation is not future-dated beyond
    /// [`ReattestationPolicy::max_future_skew`] **and** its age does not exceed
    /// the class's max. A class with no configured max is never fresh
    /// (fail-closed). The boundary is inclusive: age exactly equal to the max is
    /// still fresh.
    pub fn is_fresh(&self, class: EvidenceClass, attested_at: i64, now: i64) -> bool {
        if attested_at > now.saturating_add(self.max_future_skew) {
            // Attested in the future. Either a clock is wrong or someone is
            // lying; both mean the claim is not evidence.
            return false;
        }
        match self.max_age(class) {
            Some(max) => now.saturating_sub(attested_at) <= max,
            None => false,
        }
    }

    /// The class a device **still counts as**, given how long ago it proved it.
    ///
    /// The pre-filter: stale evidence collapses to [`EvidenceClass::SessionOnly`]
    /// — T1 — for every downstream use. Not an error and not a rejection: the
    /// device is still there, it just has not re-proved lately.
    pub fn effective_class(
        &self,
        class: EvidenceClass,
        attested_at: i64,
        now: i64,
    ) -> EvidenceClass {
        if self.is_fresh(class, attested_at, now) {
            class
        } else {
            EvidenceClass::SessionOnly
        }
    }
}

/// A signature root that firmware may chain to.
///
/// `label` is for humans. **Matching is on `key`, never on `label`** — see
/// [`FirmwarePolicy::trusts`]. A label is a convenience; if it were load-bearing,
/// enrolling a root called "SatoshiLabs" would be an attack rather than a typo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrustedRoot {
    /// Human-readable name. Never matched on, never authoritative.
    pub label: String,
    /// The root public key bytes. This — and only this — is the identity.
    ///
    /// Raw bytes, no field semantics: no chain has been parsed against real
    /// hardware by this crate, so nothing here interprets a certificate's
    /// interior. The verifier that eventually parses one supplies these bytes;
    /// this crate only decides whether they are trusted.
    pub key: Vec<u8>,
}

impl TrustedRoot {
    pub fn new(label: impl Into<String>, key: Vec<u8>) -> Self {
        TrustedRoot {
            label: label.into(),
            key,
        }
    }
}

/// Which firmware signature roots this DID trusts — **policy data, not a
/// hardcode**.
///
/// Founder ruling (2026-07-16): E5 requires *both* properties — the key cannot
/// leave the signer, **and** the running firmware chains to a root listed here.
/// Genuine hardware running unverifiable firmware is [`EvidenceClass::HardwareKey`]
/// (E3), not [`EvidenceClass::IsolatedSigner`] (E5), because an untrusted screen
/// can lie about what it signs — which breaks the isolation property itself, not
/// merely the boot proof. **Non-stock is never "failed"; unverifiable is.**
///
/// This is [`QuorumPolicy`]'s doctrine applied a second time: signer trust is
/// policy data, and so is firmware trust. Both say what they assume rather than
/// hiding it — the vendor root is an enrolled, *revocable* row, not a constant
/// compiled in. That is what makes leaving the vendor possible without making
/// mystery firmware acceptable: adding a root is adding a row, and the day
/// BNRi-signed firmware exists, ratifying it is a T5-quorum act
/// (Article-VI-class), not a patch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub struct FirmwarePolicy {
    /// The roots firmware may chain to. **Empty trusts nothing** — a policy with
    /// no roots yields E3 for every device, which is the fail-closed direction.
    pub trusted_roots: Vec<TrustedRoot>,
}

impl FirmwarePolicy {
    pub fn new(trusted_roots: Vec<TrustedRoot>) -> Self {
        FirmwarePolicy { trusted_roots }
    }

    /// Genesis: the vendor root, enrolled **explicitly**.
    ///
    /// The caller supplies the key because this crate does not know it. The real
    /// SatoshiLabs root is **UNVERIFIED here** — it has not been captured from a
    /// device or read from a published source by this seat, and hardcoding a
    /// guessed root would be exactly the invented-semantics failure the
    /// chain-exsat-evm precedent exists to prevent. `trezorctl device
    /// authenticate` carries a default root (its `--p256-root` flag implies
    /// one), so a real value is obtainable; until it is obtained, the caller
    /// owns it.
    ///
    /// Mirrors [`QuorumPolicy::genesis`]: it states its assumption instead of
    /// pretending. "We trust SatoshiLabs" is a visible row that can be read,
    /// audited, and revoked — not an assumption buried in a match arm.
    pub fn genesis(vendor_root: TrustedRoot) -> Self {
        FirmwarePolicy::new(vec![vendor_root])
    }

    /// Is `key` a trusted root?
    ///
    /// Compares **bytes**. A root's label has no authority: two roots may share
    /// a label and be different keys, and an attacker's key labelled
    /// "SatoshiLabs" is an attacker's key.
    pub fn trusts(&self, key: &[u8]) -> bool {
        self.trusted_roots.iter().any(|r| r.key == key)
    }

    /// Enrol a root. A T5-quorum act at the policy layer above this one; this
    /// type stores the decision, it does not authorise it.
    pub fn enroll(&mut self, root: TrustedRoot) {
        if !self.trusts(&root.key) {
            self.trusted_roots.push(root);
        }
    }

    /// Remove a root. **Always succeeds** — revoke-wins, as with
    /// [`QuorumPolicy::revoke`], and for the same reason: a root you cannot
    /// revoke because revoking it would strand your devices is an attacker's
    /// root. Devices chaining to it fall to E3 immediately; they are not
    /// bricked, they are demoted, and the §7 restore path is how a T5 comes
    /// back. Returns whether it was present — information, not permission.
    pub fn revoke(&mut self, key: &[u8]) -> bool {
        let before = self.trusted_roots.len();
        self.trusted_roots.retain(|r| r.key != key);
        self.trusted_roots.len() != before
    }

    /// The E5 gate: what an isolated-signer device *actually* classifies as,
    /// given the root its firmware chains to.
    ///
    /// `chains_to`:
    /// - `Some(key)` that this policy trusts → [`EvidenceClass::IsolatedSigner`]
    ///   (E5). Both properties hold.
    /// - `Some(key)` it does not trust → [`EvidenceClass::HardwareKey`] (E3).
    ///   Non-stock, verified, not ours — demoted, not rejected.
    /// - `None` — the chain did not verify, or nothing parsed it → E3. This is
    ///   the unverifiable case, and it is the one the ruling names: the screen
    ///   could be lying, so the isolation claim is gone.
    ///
    /// The caller supplies `chains_to`; this crate does not parse certificates.
    /// That seam is deliberate — the verifier reads the chain, the policy
    /// decides trust, and neither pretends to be the other.
    pub fn classify_signer(&self, chains_to: Option<&[u8]>) -> EvidenceClass {
        match chains_to {
            Some(key) if self.trusts(key) => EvidenceClass::IsolatedSigner,
            _ => EvidenceClass::HardwareKey,
        }
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

    /// [`QuorumPolicy::effective_tier`], with attestation freshness applied
    /// first — and a flag saying whether decay is why the answer is low.
    ///
    /// Additive: `effective_tier` keeps its exact semantics, and this composes
    /// with it rather than replacing it. The freshness filter runs *before* the
    /// quorum count, which is the whole point — **a stale signer drops out of
    /// the 2-of-3.** An old attestation cannot hold up the quorum, or "2-of-3
    /// independent signers" would quietly mean "2-of-3 signers, one of which
    /// might have been in a drawer since March".
    ///
    /// `decayed` is computed by asking the same question twice — once with
    /// freshness, once without — and comparing. That is what lets the UI tell
    /// *"this lapsed"* from *"you never had this"*.
    pub fn effective_tier_fresh(
        &self,
        presented: &[Presentation],
        reattest: &ReattestationPolicy,
        now: i64,
    ) -> TierAssessment {
        let filtered: Vec<(Did, EvidenceClass)> = presented
            .iter()
            .map(|p| {
                (
                    p.did.clone(),
                    reattest.effective_class(p.class, p.attested_at, now),
                )
            })
            .collect();
        let tier = self.effective_tier(&filtered);

        // What the same devices would have earned had every attestation been
        // fresh. If that is higher, freshness is the reason — and only then.
        let ignoring_freshness: Vec<(Did, EvidenceClass)> =
            presented.iter().map(|p| (p.did.clone(), p.class)).collect();
        let undecayed = self.effective_tier(&ignoring_freshness);

        TierAssessment {
            tier,
            decayed: tier < undecayed,
        }
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
/// Two signature slots, both `None` until signed (the capability core is
/// exercised unsigned): `signature`, the v1 Ed25519 one
/// ([`Ed25519Verifier::sign`]), and `pq_signature`, an algorithm-tagged one
/// ([`MlDsa65Verifier::sign`]). [`Delegation::is_signed`] tells a caller whether
/// either is present. A production gate must call a verifier — an unsigned
/// delegation authorizes nothing on its own.
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
    /// A second signature that **names its algorithm** — the post-quantum
    /// signature, carried alongside the Ed25519 `signature` (or, once an issuer
    /// has retired Ed25519, instead of it). `None` until signed.
    ///
    /// It signs the same canonical bytes as `signature`, behind a domain tag
    /// that names the algorithm: `"cap1/delegation/" ‖ alg ‖ "\n" ‖`
    /// [`Delegation::signing_payload`]. The tag puts the algorithm id inside
    /// the signed bytes, so relabelling a signature changes what it would have
    /// to verify over. The payload clears **both** signature slots, so the two
    /// can be added in either order without one invalidating the other.
    ///
    /// `default` + `skip_serializing_if`, exactly as for `tier_ceiling` and for
    /// the same reason: a token minted before this field existed deserializes
    /// (absent → `None`) and re-serializes byte-identically, with no
    /// `"pq_signature":null` key its issuer never saw.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pq_signature: Option<TaggedSignature>,
}

/// A signature that carries its algorithm id — crypto-agility as data
/// (`docs/architecture/did-autonomi-spec.md` §7: the signature scheme is data,
/// never a hardcoded assumption).
///
/// `alg` is a plain string on purpose, not an enum: an id this crate does not
/// know must still *parse*, so verification can read it and refuse it by name
/// ([`CapabilityError::UnsupportedAlgorithm`]) instead of the whole token
/// failing as malformed JSON. Ids match exactly — no case folding, no
/// trimming, no default.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaggedSignature {
    /// The algorithm id: [`ALG_ML_DSA_65`] is the one this crate verifies.
    /// The same strings as the did-autonomi `keyAlg` and bsigner's algorithm
    /// registry (`crates/bsigner/src/alg.rs`).
    pub alg: String,
    /// The signature bytes, base64url without padding — the estate's wire form
    /// for post-quantum material (`docs/specs/SPEC-BPQ-1.md` §3). Decoded
    /// strictly, so one byte string has exactly one accepted text form.
    pub sig: String,
}

/// Algorithm id of ML-DSA-65 (FIPS 204, security category 3).
pub const ALG_ML_DSA_65: &str = "ml-dsa-65";

/// Domain tag that opens every [`TaggedSignature`]'s signed message; see
/// [`Delegation::pq_signature`].
const TAGGED_DOMAIN: &[u8] = b"cap1/delegation/";

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
            pq_signature: None,
        }
    }

    /// This delegation, requiring `ceiling` as the holder's minimum device tier.
    pub fn with_tier_ceiling(mut self, ceiling: Tier) -> Self {
        self.tier_ceiling = Some(ceiling);
        self
    }

    /// Does this delegation carry a signature in either slot? Presence only —
    /// whether it is any good is a [`Verifier`]'s question. A token carrying
    /// only `pq_signature` is signed; before that slot existed every token had
    /// it `None`, so for them this answer is unchanged.
    pub fn is_signed(&self) -> bool {
        self.signature.is_some() || self.pq_signature.is_some()
    }

    /// Is this delegation within its time bounds at `now` (unix seconds)?
    pub fn valid_at(&self, now: i64) -> bool {
        let after_start = self.not_before.is_none_or(|nb| now >= nb);
        let before_end = self.expires_at.is_none_or(|exp| now <= exp);
        after_start && before_end
    }

    /// Canonical bytes to sign / verify: a stable JSON serialization with both
    /// signature slots cleared. Deterministic, so issuer and verifier agree.
    ///
    /// **INVARIANT — signed-byte stability.** Every field of [`Delegation`] is
    /// inside these bytes, so adding one changes what a signature covers. Any
    /// new field MUST either carry `skip_serializing_if` (so its absent/default
    /// state emits no key and old payloads stay byte-identical) or live outside
    /// this payload entirely. Without that, `serde_json` writes e.g.
    /// `"new_field":null`, the payload for an unchanged delegation moves, and
    /// **every signature minted before the field existed stops verifying.**
    /// `tier_ceiling` is the worked example; `none_ceiling_emits_no_key_so_old_signatures_survive`
    /// is the test that fails if this is forgotten. `pq_signature` does both:
    /// it is cleared here, and skipped when `None`, so a v1 token's payload is
    /// the same bytes it always was (`legacy_ed25519_token_verifies_byte_for_byte_unchanged`
    /// pins those bytes).
    pub fn signing_payload(&self) -> Vec<u8> {
        let unsigned = Delegation {
            signature: None,
            pq_signature: None,
            ..self.clone()
        };
        serde_json::to_vec(&unsigned).unwrap_or_default()
    }

    /// The exact bytes a [`TaggedSignature`] in `alg` signs:
    /// `"cap1/delegation/" ‖ alg ‖ "\n" ‖ signing_payload()`.
    fn tagged_message(&self, alg: &str) -> Vec<u8> {
        let payload = self.signing_payload();
        let mut m = Vec::with_capacity(TAGGED_DOMAIN.len() + alg.len() + 1 + payload.len());
        m.extend_from_slice(TAGGED_DOMAIN);
        m.extend_from_slice(alg.as_bytes());
        m.push(b'\n');
        m.extend_from_slice(&payload);
        m
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

/// Signature verification over [`Delegation`]s: did this issuer sign these
/// bytes? Three implementations ship — [`Ed25519Verifier`], [`MlDsa65Verifier`],
/// and [`AgileVerifier`], which dispatches between them on the algorithm id a
/// token carries. Kept as a trait so work still unbuilt (the delegation-chain
/// proof) sits behind an interface, never a panic in a shipped path.
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

const B64U_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// base64url, no padding — a [`TaggedSignature`]'s wire form.
fn b64u_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        // 1 byte → 2 characters, 2 → 3, 3 → 4.
        for i in 0..=chunk.len() {
            out.push(B64U_ALPHABET[(n >> (18 - 6 * i)) as usize & 63] as char);
        }
    }
    out
}

/// Strict base64url decode: the alphabet only, no padding, no impossible
/// length, and no stray low bits in the last character — so every byte string
/// has exactly one accepted text form. Anything else is `None`, a refusal.
fn b64u_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 4 == 1 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 4 * 3 + 2);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return None,
        };
        acc = (acc << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
        acc &= (1 << bits) - 1;
    }
    if acc != 0 {
        return None;
    }
    Some(out)
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

/// ML-DSA-65 verification of a [`Delegation`]'s [`TaggedSignature`] — the
/// post-quantum signature, built to sit beside [`Ed25519Verifier`], not to
/// replace it.
///
/// # Sources (cite or stop)
///
/// Every call below is checked against `ml-dsa` 0.1.1 as Cargo.lock vendors it,
/// the crate and version `crates/bsigner/src/pq.rs` already cites:
///
/// - The crate implements ML-DSA "as described in the FIPS 204 (final)"
///   (README.md); `MlDsa65` is security category 3 (src/lib.rs:217-222).
/// - Sizes: encoded public key 1952 B, signature 3309 B — the crate's own
///   assertions, src/lib.rs:273-274. Both are checked before anything is
///   decoded.
/// - Key: `VerifyingKey::decode` (src/verifying.rs:165, FIPS 204 Algorithm 23
///   pkDecode) cannot fail on a correctly sized array, so the length check is
///   the whole key check.
/// - Signature: `Signature::try_from(&[u8])` (src/lib.rs:130-136) runs
///   sigDecode (src/lib.rs:115, Algorithm 27), which refuses a malformed hint
///   or an out-of-range `z`.
/// - Verify: `verify_with_context(msg, &[], sig)` (src/verifying.rs:131,
///   Algorithm 3 ML-DSA.Verify) with the empty context — the same path the
///   `signature` crate's `Verifier::verify` takes (src/verifying.rs:195-205).
/// - Sign: `Signer::try_sign` (src/signing.rs:184), the deterministic variant
///   with an empty context (src/signing.rs:181-182); it errs only for a
///   context over 255 bytes (src/signing.rs:440-443).
///
/// # Limits, carried forward rather than smoothed over
///
/// - `ml-dsa` 0.1.1 README.md: "The implementation contained in this crate has
///   never been independently audited!" NIST ACVP known-answer vectors have
///   not been run in this repo — UNVERIFIED.
/// - What the tests do pin: a signature made by @noble/post-quantum 0.7.1 (the
///   estate's vendored browser library, `surfaces/onboarding/vendor/bpq-lib.js`)
///   from the same public test seed verifies here, and this crate's
///   deterministic signature is byte-identical to it. That is agreement
///   between two implementations, not an audit.
///
/// Like [`Ed25519Verifier`] it answers one question and checks time bounds,
/// and it ignores the other slot entirely. [`AgileVerifier`] is what requires
/// both and refuses a token stripped of one.
pub struct MlDsa65Verifier {
    /// The issuer's ML-DSA-65 public key, by DID — keyed on the principal, as
    /// for [`Ed25519Verifier`], so rotation updates this map and nothing else.
    keys: std::collections::BTreeMap<Did, ml_dsa::VerifyingKey<ml_dsa::MlDsa65>>,
    /// Unix seconds, supplied by the caller. This crate reads no clock.
    now: i64,
}

impl MlDsa65Verifier {
    /// Encoded ML-DSA-65 public key length (ml-dsa 0.1.1 src/lib.rs:273).
    pub const PUBLIC_KEY_LEN: usize = 1952;
    /// Encoded ML-DSA-65 signature length (ml-dsa 0.1.1 src/lib.rs:274).
    pub const SIGNATURE_LEN: usize = 3309;

    /// A verifier that knows `keys` and evaluates time bounds at `now`.
    pub fn new(
        keys: std::collections::BTreeMap<Did, ml_dsa::VerifyingKey<ml_dsa::MlDsa65>>,
        now: i64,
    ) -> Self {
        MlDsa65Verifier { keys, now }
    }

    /// Parse an encoded ML-DSA-65 public key (FIPS 204 pkEncode form — the
    /// bytes a bpq card's `dsa` field carries, decoded the same way at
    /// `crates/bsigner/src/bpq.rs:217-221`). Any length but
    /// [`MlDsa65Verifier::PUBLIC_KEY_LEN`] is [`CapabilityError::MalformedKey`]
    /// — checked, never trusted.
    pub fn public_key_from_bytes(
        bytes: &[u8],
    ) -> Result<ml_dsa::VerifyingKey<ml_dsa::MlDsa65>, CapabilityError> {
        if bytes.len() != Self::PUBLIC_KEY_LEN {
            return Err(CapabilityError::MalformedKey);
        }
        let enc = ml_dsa::EncodedVerifyingKey::<ml_dsa::MlDsa65>::try_from(bytes)
            .map_err(|_| CapabilityError::MalformedKey)?;
        Ok(ml_dsa::VerifyingKey::<ml_dsa::MlDsa65>::decode(&enc))
    }

    /// Sign `delegation` with ML-DSA-65, returning it with `pq_signature`
    /// filled. Any Ed25519 `signature` already present is kept, and stays
    /// valid: neither slot is inside the other's bytes.
    ///
    /// Test/issuer helper. The key is borrowed, never stored, and `ml-dsa`'s
    /// `SigningKey` scrubs its seed on drop with the `zeroize` feature this
    /// crate enables (src/signing.rs:222-231). `SigningFailed` is mapped, not
    /// unwrapped, so no shipped path panics.
    pub fn sign(
        delegation: &Delegation,
        key: &ml_dsa::SigningKey<ml_dsa::MlDsa65>,
    ) -> Result<Delegation, CapabilityError> {
        use ml_dsa::Signer;
        let sig = key
            .try_sign(&delegation.tagged_message(ALG_ML_DSA_65))
            .map_err(|_| CapabilityError::SigningFailed)?;
        let mut signed = delegation.clone();
        signed.pq_signature = Some(TaggedSignature {
            alg: ALG_ML_DSA_65.to_string(),
            sig: b64u_encode(sig.encode().as_slice()),
        });
        Ok(signed)
    }
}

impl Verifier for MlDsa65Verifier {
    fn verify(&self, delegation: &Delegation) -> Result<(), CapabilityError> {
        let tagged = delegation
            .pq_signature
            .as_ref()
            .ok_or(CapabilityError::Unsigned)?;

        // Dispatch on the id the token carries, never on a default. An id this
        // verifier cannot check is refused by name, before any other work.
        if tagged.alg != ALG_ML_DSA_65 {
            return Err(CapabilityError::UnsupportedAlgorithm);
        }

        if !delegation.valid_at(self.now) {
            return Err(CapabilityError::Expired);
        }

        let key = self
            .keys
            .get(&delegation.issuer)
            .ok_or(CapabilityError::UnknownIssuer)?;

        // As for Ed25519: every malformed input is BadSignature, so the error
        // never tells "wrong length" from "wrong bytes".
        let raw = b64u_decode(&tagged.sig).ok_or(CapabilityError::BadSignature)?;
        if raw.len() != Self::SIGNATURE_LEN {
            return Err(CapabilityError::BadSignature);
        }
        let sig = ml_dsa::Signature::<ml_dsa::MlDsa65>::try_from(raw.as_slice())
            .map_err(|_| CapabilityError::BadSignature)?;

        if key.verify_with_context(&delegation.tagged_message(ALG_ML_DSA_65), &[], &sig) {
            Ok(())
        } else {
            Err(CapabilityError::BadSignature)
        }
    }
}

/// Algorithm-agile verification: reads which algorithms a [`Delegation`]
/// carries, sends each signature to the verifier for its algorithm, and refuses
/// an id it cannot verify rather than skipping it
/// (`docs/architecture/did-autonomi-spec.md` §7: resolvers "MUST reject ops in
/// an algorithm they cannot verify rather than skip them").
///
/// # The rules, in order
///
/// 1. **Unknown id → [`CapabilityError::UnsupportedAlgorithm`].** A
///    [`TaggedSignature`] naming anything but [`ALG_ML_DSA_65`] is refused —
///    even with a valid Ed25519 signature beside it. Never skipped, never
///    defaulted.
/// 2. **Nothing carried → [`CapabilityError::Unsigned`].**
/// 3. **No downgrade → [`CapabilityError::MissingSignature`].** If this
///    verifier knows the issuer under an algorithm, the token must carry a
///    signature in that algorithm. This rule is what gives the post-quantum
///    signature its value: without it, whoever can forge Ed25519 strips the
///    ML-DSA-65 signature and presents the rest.
/// 4. **Every carried signature verifies; none is skipped.** Each goes to its
///    own verifier and returns that verifier's error (`Expired`,
///    `UnknownIssuer`, `BadSignature`).
///
/// # What that means for an issuer, plainly
///
/// - Known by Ed25519 only (every issuer before this type existed): an
///   Ed25519-only token verifies exactly as under [`Ed25519Verifier`].
/// - Known by both: only a token carrying **both** signatures verifies. So
///   enrolling an issuer's ML-DSA-65 key retires that issuer's outstanding
///   Ed25519-only tokens *under this verifier* — by design, because such a
///   token is exactly what a downgrade looks like. [`Ed25519Verifier`] alone
///   still accepts them; which of the two a gate uses is the caller's policy.
/// - Known by ML-DSA-65 only (Ed25519 retired): an ML-DSA-only token
///   verifies; a token still carrying an Ed25519 signature is refused as
///   `UnknownIssuer` by rule 4, because "I cannot check this" denies everywhere
///   in this crate.
pub struct AgileVerifier {
    ed25519: Ed25519Verifier,
    ml_dsa_65: MlDsa65Verifier,
}

impl AgileVerifier {
    /// One clock for every algorithm, so the two can never disagree on `now`.
    pub fn new(
        ed25519_keys: std::collections::BTreeMap<Did, ed25519_dalek::VerifyingKey>,
        ml_dsa_65_keys: std::collections::BTreeMap<Did, ml_dsa::VerifyingKey<ml_dsa::MlDsa65>>,
        now: i64,
    ) -> Self {
        AgileVerifier {
            ed25519: Ed25519Verifier::new(ed25519_keys, now),
            ml_dsa_65: MlDsa65Verifier::new(ml_dsa_65_keys, now),
        }
    }
}

impl Verifier for AgileVerifier {
    fn verify(&self, delegation: &Delegation) -> Result<(), CapabilityError> {
        // Rule 1: route the tagged slot on the id it carries.
        let tagged: Option<&dyn Verifier> =
            match delegation.pq_signature.as_ref().map(|t| t.alg.as_str()) {
                None => None,
                Some(ALG_ML_DSA_65) => Some(&self.ml_dsa_65),
                Some(_) => return Err(CapabilityError::UnsupportedAlgorithm),
            };
        // The v1 slot names no id: it has carried Ed25519 since the field
        // existed, so its algorithm is the field's definition, not a default.
        let legacy: Option<&dyn Verifier> = delegation
            .signature
            .as_ref()
            .map(|_| &self.ed25519 as &dyn Verifier);

        // Rule 2.
        if legacy.is_none() && tagged.is_none() {
            return Err(CapabilityError::Unsigned);
        }

        // Rule 3: an algorithm the issuer is known by may not be stripped.
        let issuer = &delegation.issuer;
        if (self.ed25519.keys.contains_key(issuer) && legacy.is_none())
            || (self.ml_dsa_65.keys.contains_key(issuer) && tagged.is_none())
        {
            return Err(CapabilityError::MissingSignature);
        }

        // Rule 4.
        for v in legacy.into_iter().chain(tagged) {
            v.verify(delegation)?;
        }
        Ok(())
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
    /// A [`TaggedSignature`] names an algorithm this verifier cannot verify.
    /// Refused, never skipped and never defaulted (did-autonomi-spec §7).
    UnsupportedAlgorithm,
    /// The verifier knows the issuer under an algorithm the delegation carries
    /// no signature in — a stripped signature, i.e. a downgrade. See
    /// [`AgileVerifier`].
    MissingSignature,
    /// Public key bytes of the wrong length for their algorithm.
    MalformedKey,
    /// The signing library refused to sign. For ML-DSA-65 that happens only
    /// for a context string over 255 bytes (ml-dsa 0.1.1 src/signing.rs:440-443),
    /// which this crate never passes.
    SigningFailed,
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
            CapabilityError::UnsupportedAlgorithm => {
                write!(
                    f,
                    "delegation signature names an algorithm this verifier cannot verify"
                )
            }
            CapabilityError::MissingSignature => write!(
                f,
                "delegation lacks a signature in an algorithm its issuer is known by"
            ),
            CapabilityError::MalformedKey => {
                write!(f, "public key has the wrong length for its algorithm")
            }
            CapabilityError::SigningFailed => write!(f, "the signing library refused to sign"),
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
        let c = Capability::new("storage.sovereign", "node/read");
        assert!(c.permits("storage.sovereign", "node/read"));
        assert!(!c.permits("storage.sovereign", "node/toggle"));
        assert!(!c.permits("settlement.private", "node/read"));
    }

    #[test]
    fn ability_wildcards_are_segment_wise() {
        let c = Capability::new("storage.sovereign", "node/*");
        assert!(c.permits("storage.sovereign", "node"));
        assert!(c.permits("storage.sovereign", "node/read"));
        assert!(c.permits("storage.sovereign", "node/toggle"));
        // must not leak across a non-slash boundary
        assert!(!c.permits("storage.sovereign", "nodex"));
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
            vec![Capability::new("storage.sovereign", "node/read")],
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
            vec![Capability::new("storage.sovereign", "node/*")],
        );
        d.expires_at = Some(500);

        assert!(d.allows(&design, "storage.sovereign", "node/read", 100));
        assert!(d.allows(&design, "storage.sovereign", "node/toggle", 100));
        // wrong audience
        assert!(!d.allows(&other, "storage.sovereign", "node/read", 100));
        // wrong resource
        assert!(!d.allows(&design, "settlement.private", "node/read", 100));
        // expired
        assert!(!d.allows(&design, "storage.sovereign", "node/read", 501));
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
                Capability::new("storage.sovereign", "node/read"),
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
            vec![Capability::new("storage.sovereign", "node/read")],
        );
        let aud = Did::new("did:plc:design");
        assert!(d.tier_ceiling.is_none());
        // identical to allows() at every tier, including the weakest
        for t in [Tier::T1, Tier::T3, Tier::T5] {
            assert_eq!(
                d.allows_at_tier(&aud, "storage.sovereign", "node/read", 0, t),
                d.allows(&aud, "storage.sovereign", "node/read", 0),
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
            "capabilities": [{"with":"storage.sovereign","can":"node/read"}],
            "not_before": null,
            "expires_at": null,
            "signature": null
        }"#;
        let d: Delegation = serde_json::from_str(old).unwrap();
        assert_eq!(d.tier_ceiling, None);
        assert!(d.allows(
            &Did::new("did:plc:design"),
            "storage.sovereign",
            "node/read",
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
            vec![Capability::new("storage.sovereign", "node/read")],
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

    // ── re-attestation freshness / tier decay ────────────────────────────

    const HOUR: i64 = 3600;
    const DAY: i64 = 24 * HOUR;
    const NOW: i64 = 1_000_000_000;

    fn reattest() -> ReattestationPolicy {
        ReattestationPolicy::genesis()
    }

    #[test]
    fn genesis_states_its_cadences_rather_than_hiding_them() {
        let p = reattest();
        assert_eq!(p.max_age(EvidenceClass::IsolatedSigner), Some(15 * 60));
        assert_eq!(p.max_age(EvidenceClass::HardwareKeyVerifiedBoot), Some(DAY));
        assert_eq!(p.max_age(EvidenceClass::HardwareKey), Some(7 * DAY));
        assert_eq!(p.max_age(EvidenceClass::ProvisionedSoftware), Some(DAY));
        assert_eq!(p.max_future_skew, 0, "no skew tolerated by default");
        // E1 deliberately absent — see the doc. Its decay is a no-op.
        assert_eq!(p.max_age(EvidenceClass::SessionOnly), None);
    }

    #[test]
    fn fresh_evidence_keeps_its_class() {
        let p = reattest();
        assert!(p.is_fresh(EvidenceClass::IsolatedSigner, NOW - 60, NOW));
        assert_eq!(
            p.effective_class(EvidenceClass::IsolatedSigner, NOW - 60, NOW),
            EvidenceClass::IsolatedSigner
        );
    }

    #[test]
    fn stale_evidence_decays_to_t1() {
        let p = reattest();
        // A Safe 7 attested an hour ago: past its 15-minute cadence.
        assert!(!p.is_fresh(EvidenceClass::IsolatedSigner, NOW - HOUR, NOW));
        assert_eq!(
            p.effective_class(EvidenceClass::IsolatedSigner, NOW - HOUR, NOW),
            EvidenceClass::SessionOnly
        );
        assert_eq!(
            p.effective_class(EvidenceClass::IsolatedSigner, NOW - HOUR, NOW)
                .tier(),
            Tier::T1
        );
    }

    #[test]
    fn the_freshness_boundary_is_inclusive() {
        let p = reattest();
        let max = p.max_age(EvidenceClass::IsolatedSigner).unwrap();
        assert!(
            p.is_fresh(EvidenceClass::IsolatedSigner, NOW - max, NOW),
            "age exactly == max_age is still fresh"
        );
        assert!(
            !p.is_fresh(EvidenceClass::IsolatedSigner, NOW - max - 1, NOW),
            "one second past is stale"
        );
    }

    #[test]
    fn cadence_diverges_by_class() {
        // The same age, two verdicts — which is the reason cadence is per-class
        // rather than one number.
        let p = reattest();
        let an_hour_ago = NOW - HOUR;
        assert!(
            p.is_fresh(EvidenceClass::HardwareKey, an_hour_ago, NOW),
            "an hour is nothing for E3 (7 days)"
        );
        assert!(
            !p.is_fresh(EvidenceClass::IsolatedSigner, an_hour_ago, NOW),
            "an hour is stale for E5 (15 minutes)"
        );
    }

    #[test]
    fn future_dated_attestation_is_never_fresh() {
        // A clock is wrong or someone is lying; either way it is not evidence.
        let p = reattest();
        assert!(!p.is_fresh(EvidenceClass::IsolatedSigner, NOW + 1, NOW));
        assert_eq!(
            p.effective_class(EvidenceClass::IsolatedSigner, NOW + 1, NOW),
            EvidenceClass::SessionOnly
        );
        // ...unless the policy explicitly tolerates skew — a visible row.
        let tolerant = ReattestationPolicy::new(reattest().max_age_by_class, 5);
        assert!(tolerant.is_fresh(EvidenceClass::IsolatedSigner, NOW + 5, NOW));
        assert!(!tolerant.is_fresh(EvidenceClass::IsolatedSigner, NOW + 6, NOW));
    }

    #[test]
    fn a_class_with_no_cadence_is_never_fresh() {
        // Fail-closed by omission: forget to configure a class and it decays,
        // rather than being trusted forever because nobody said otherwise.
        let p = ReattestationPolicy::new(std::collections::BTreeMap::new(), 0);
        assert!(!p.is_fresh(EvidenceClass::IsolatedSigner, NOW, NOW));
        assert_eq!(
            p.effective_class(EvidenceClass::IsolatedSigner, NOW, NOW),
            EvidenceClass::SessionOnly
        );
    }

    #[test]
    fn freshness_is_policy_data_shrinking_the_cadence_reclassifies() {
        // The doctrine, demonstrated: change the row, change the answer.
        let ten_min_ago = NOW - 10 * 60;
        let p = reattest();
        assert!(p.is_fresh(EvidenceClass::IsolatedSigner, ten_min_ago, NOW));

        let mut tighter = reattest();
        tighter
            .max_age_by_class
            .insert(EvidenceClass::IsolatedSigner, 5 * 60);
        assert!(
            !tighter.is_fresh(EvidenceClass::IsolatedSigner, ten_min_ago, NOW),
            "the same presentation, re-judged by a tighter policy"
        );
    }

    #[test]
    fn stale_isolated_signer_decays_out_of_t5() {
        // THE invariant this whole section exists for. An old attestation must
        // not hold up the quorum.
        let p = two_of_three();
        let r = reattest();

        let fresh_both = [
            Presentation::new(safe7(), EvidenceClass::IsolatedSigner, NOW - 60),
            Presentation::new(signer_b(), EvidenceClass::IsolatedSigner, NOW - 60),
        ];
        assert_eq!(p.effective_tier_fresh(&fresh_both, &r, NOW).tier, Tier::T5);

        // One goes stale: one fresh signer left, quorum unmet -> the lone-signer
        // clamp, T4.
        let one_stale = [
            Presentation::new(safe7(), EvidenceClass::IsolatedSigner, NOW - 60),
            Presentation::new(signer_b(), EvidenceClass::IsolatedSigner, NOW - HOUR),
        ];
        let a = p.effective_tier_fresh(&one_stale, &r, NOW);
        assert_ne!(a.tier, Tier::T5, "a stale signer cannot hold up the 2-of-3");
        assert_eq!(a.tier, Tier::T4);
        assert!(a.decayed, "and the UI must know decay is why");
    }

    #[test]
    fn a_third_fresh_signer_restores_the_quorum() {
        // 2-of-3 with one stale is still T5 when two others are fresh — the
        // point of a quorum.
        let p = two_of_three();
        let r = reattest();
        let presented = [
            Presentation::new(safe7(), EvidenceClass::IsolatedSigner, NOW - HOUR), // stale
            Presentation::new(signer_b(), EvidenceClass::IsolatedSigner, NOW - 60),
            Presentation::new(signer_c(), EvidenceClass::IsolatedSigner, NOW - 60),
        ];
        let a = p.effective_tier_fresh(&presented, &r, NOW);
        assert_eq!(a.tier, Tier::T5);
        assert!(!a.decayed, "the quorum held; nothing was lost to decay");
    }

    #[test]
    fn all_stale_falls_to_t1() {
        let p = two_of_three();
        let r = reattest();
        let presented = [
            Presentation::new(safe7(), EvidenceClass::IsolatedSigner, NOW - HOUR),
            Presentation::new(signer_b(), EvidenceClass::IsolatedSigner, NOW - HOUR),
        ];
        let a = p.effective_tier_fresh(&presented, &r, NOW);
        assert_eq!(a.tier, Tier::T1, "a quiet fall to the floor");
        assert!(a.decayed);
    }

    #[test]
    fn decayed_distinguishes_lapsed_from_never_had_it() {
        // The design contract. Same tier, different reason, different UI.
        let p = two_of_three();
        let r = reattest();

        // Never had it: a browser is T1 and always was.
        let browser = [Presentation::new(
            Did::new("did:plc:browser"),
            EvidenceClass::SessionOnly,
            NOW,
        )];
        let a = p.effective_tier_fresh(&browser, &r, NOW);
        assert_eq!(a.tier, Tier::T1);
        assert!(!a.decayed, "you never had this — no violet guard");

        // Lapsed: a Safe 7 that held T5 an hour ago is T1 now.
        let lapsed = [Presentation::new(
            safe7(),
            EvidenceClass::IsolatedSigner,
            NOW - HOUR,
        )];
        let b = p.effective_tier_fresh(&lapsed, &r, NOW);
        assert_eq!(b.tier, Tier::T1);
        assert!(
            b.decayed,
            "this lapsed — violet guard, re-attest to restore"
        );
    }

    #[test]
    fn reattestation_policy_roundtrips_through_json() {
        let p = reattest();
        let back: ReattestationPolicy =
            serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert_eq!(p, back);
    }

    // ── firmware policy (E5 = isolation AND attested firmware) ───────────

    // Stand-ins. The real SatoshiLabs root is UNVERIFIED — not captured from a
    // device or read from a published source by this seat — so these are
    // labelled placeholders, never a guessed root presented as real.
    const VENDOR_KEY: &[u8] = b"PLACEHOLDER-vendor-root-key-UNVERIFIED";
    const BNRI_KEY: &[u8] = b"PLACEHOLDER-bnri-firmware-root-UNVERIFIED";
    const ATTACKER_KEY: &[u8] = b"PLACEHOLDER-attacker-root";

    fn vendor_policy() -> FirmwarePolicy {
        FirmwarePolicy::genesis(TrustedRoot::new("SatoshiLabs", VENDOR_KEY.to_vec()))
    }

    #[test]
    fn genesis_enrolls_the_vendor_root_explicitly() {
        // The doctrine: genesis says what it trusts rather than hiding it.
        let p = vendor_policy();
        assert_eq!(p.trusted_roots.len(), 1);
        assert_eq!(p.trusted_roots[0].label, "SatoshiLabs");
        assert!(p.trusts(VENDOR_KEY));
    }

    #[test]
    fn stock_firmware_on_an_isolated_signer_is_e5() {
        let p = vendor_policy();
        assert_eq!(
            p.classify_signer(Some(VENDOR_KEY)),
            EvidenceClass::IsolatedSigner
        );
        assert_eq!(p.classify_signer(Some(VENDOR_KEY)).tier(), Tier::T5);
    }

    #[test]
    fn unverifiable_firmware_never_yields_isolated_signer() {
        // THE ruling. An untrusted screen can lie about what it signs, so the
        // isolation claim is gone — not the boot proof, the isolation itself.
        let p = vendor_policy();
        assert_eq!(p.classify_signer(None), EvidenceClass::HardwareKey);
        assert_eq!(p.classify_signer(None).tier(), Tier::T3);
        assert_ne!(p.classify_signer(None), EvidenceClass::IsolatedSigner);
    }

    #[test]
    fn non_stock_is_demoted_not_rejected() {
        // "Non-stock is never 'failed'; unverifiable is." A device chaining to
        // a real-but-unenrolled root still holds its key in hardware — E3, not
        // nothing.
        let p = vendor_policy();
        assert_eq!(
            p.classify_signer(Some(BNRI_KEY)),
            EvidenceClass::HardwareKey,
            "an unenrolled root is demoted to E3, not refused outright"
        );
        assert_eq!(p.classify_signer(Some(BNRI_KEY)).tier(), Tier::T3);
    }

    #[test]
    fn ratifying_a_root_is_adding_a_row() {
        // The day BNRi-signed firmware exists, this is the whole change.
        let mut p = vendor_policy();
        assert_eq!(
            p.classify_signer(Some(BNRI_KEY)),
            EvidenceClass::HardwareKey
        );

        p.enroll(TrustedRoot::new("BNRi firmware", BNRI_KEY.to_vec()));

        assert_eq!(
            p.classify_signer(Some(BNRI_KEY)),
            EvidenceClass::IsolatedSigner
        );
        // and the vendor root is untouched — both are trusted, neither special
        assert_eq!(
            p.classify_signer(Some(VENDOR_KEY)),
            EvidenceClass::IsolatedSigner
        );
    }

    #[test]
    fn revoking_the_vendor_root_drops_its_devices_to_e3() {
        // Revoke-wins, again arithmetic rather than a special case. Leaving the
        // vendor is a supported act, and it demotes rather than bricks.
        let mut p = vendor_policy();
        assert_eq!(
            p.classify_signer(Some(VENDOR_KEY)),
            EvidenceClass::IsolatedSigner
        );

        assert!(p.revoke(VENDOR_KEY));

        assert_eq!(
            p.classify_signer(Some(VENDOR_KEY)),
            EvidenceClass::HardwareKey,
            "revoking the root demotes its devices to E3 — not bricked, demoted"
        );
        // Even the last root can go. An empty policy trusts nothing: fail-closed.
        assert!(p.trusted_roots.is_empty());
        assert_eq!(
            p.classify_signer(Some(BNRI_KEY)),
            EvidenceClass::HardwareKey
        );
    }

    #[test]
    fn an_empty_policy_trusts_nothing() {
        let p = FirmwarePolicy::new(vec![]);
        assert_eq!(
            p.classify_signer(Some(VENDOR_KEY)),
            EvidenceClass::HardwareKey
        );
        assert_eq!(p.classify_signer(None), EvidenceClass::HardwareKey);
    }

    #[test]
    fn trust_is_by_key_not_by_label() {
        // The reason `label` is documented as never-matched. An attacker who
        // enrols their own key under the vendor's NAME must not inherit the
        // vendor's standing — otherwise "SatoshiLabs" is a password.
        let p = FirmwarePolicy::genesis(TrustedRoot::new("SatoshiLabs", VENDOR_KEY.to_vec()));
        assert!(
            !p.trusts(ATTACKER_KEY),
            "a key is trusted by its bytes, never by what it is called"
        );
        assert_eq!(
            p.classify_signer(Some(ATTACKER_KEY)),
            EvidenceClass::HardwareKey
        );

        // And the same bytes under a different label are still the same root.
        let relabelled = FirmwarePolicy::genesis(TrustedRoot::new("anything", VENDOR_KEY.to_vec()));
        assert!(relabelled.trusts(VENDOR_KEY));
    }

    #[test]
    fn enrolling_a_duplicate_key_is_a_no_op() {
        let mut p = vendor_policy();
        p.enroll(TrustedRoot::new("SatoshiLabs (again)", VENDOR_KEY.to_vec()));
        assert_eq!(p.trusted_roots.len(), 1, "a root enrols once");
    }

    #[test]
    fn revoking_an_unenrolled_root_is_a_no_op_not_an_error() {
        let mut p = vendor_policy();
        assert!(!p.revoke(ATTACKER_KEY));
        assert_eq!(p.trusted_roots.len(), 1);
    }

    #[test]
    fn firmware_policy_roundtrips_through_json() {
        let mut p = vendor_policy();
        p.enroll(TrustedRoot::new("BNRi firmware", BNRI_KEY.to_vec()));
        let back: FirmwarePolicy =
            serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert_eq!(p, back);
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
            vec![Capability::new("storage.sovereign", "node/read")],
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

        // Escalate the capability: node/read -> wallet/spend.
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

    // ── post-quantum: ML-DSA-65 + algorithm dispatch ─────────────────────

    /// The v1 token's Ed25519 signature exactly as the code produced it before
    /// `pq_signature` existed (`Ed25519Verifier::sign`, seed `[7; 32]`, over
    /// `unsigned_grant()`). Node's OpenSSL Ed25519 produced the same 64 bytes
    /// independently. base64url here because the wire form (hex) is 128 chars.
    const LEGACY_ED25519_SIG_B64U: &str =
        "6GuqUSZrBIOwDzKP2IMeopi5lcWqOSBgcxmM0E5NCL5XisIsX2Lz1soTcvA_auQqoVuBiwXT-akv56uZonDdBA";

    /// The exact bytes that signature covers — the v1 payload of `unsigned_grant()`.
    const LEGACY_PAYLOAD: &str = r#"{"issuer":"did:autonomi:root","audience":"did:plc:design","capabilities":[{"with":"storage.sovereign","can":"node/read"}],"not_before":null,"expires_at":null,"signature":null}"#;

    /// A TEST seed: the UTF-8 bytes of a public sentence, exactly 32 of them.
    /// Nothing signed with it guards anything.
    const PQ_SEED: &[u8; 32] = b"capability ml-dsa-65 test seed A";

    /// The foreign oracle. ML-DSA-65 over `"cap1/delegation/ml-dsa-65\n" ‖
    /// LEGACY_PAYLOAD`, made by @noble/post-quantum 0.7.1
    /// (surfaces/onboarding/vendor/bpq-lib.js) — `keygen(PQ_SEED)`, then
    /// `sign(msg, secretKey, { extraEntropy: false })`: deterministic, empty
    /// context. Not this crate's code.
    const NOBLE_ML_DSA_65_SIG: &str = "0FvoHFdDxo8bNfyVwyVX1LvDCkRMCUNiaYhG1UJEcG96jxSSNDBZycLx-j3Gmt_XIVTvIvIfTxTDD0E2Vu7qdcwSoiLYY18z4XPIMkZ2ycNwaCyc4TRyArZVVQrfjErt_q5fg_tPFqXQimx4IpV2GRbB3qgC7vYNjSVz4bu3Kyo4wfg4uYAM_ZopgXYY8P7F-YjqFqItnVBRurWUV5jzu-lKt8sQpAZsV5ycG_eADMOtCG8D4imaIUS3pr2MXG1a-BhtJwaj0-1XwQxXNFbqZinNoQ8bTA06X0ZLMG_ZeQyVPr89NGsniAFswnUzT2yr6pDv36REIotB4wjEPS3N6nRXPozy-in-UPLLwlGtcMia3n2GUPMGXHg4tuI-o-tiQKF-ZOG2a0C6TDELMdr6RzB6B2NWljSywf1i_cNJTHn2k0ybdaG4LeEVs_oInMFLKcp3De1mUCRs3UfLG7Er8rXkjUowcf6sCOx_0FhOisrexNrhHRXhAq2esVsJxaxiE3GU-xGjZAur4k5jqG9dEtP5RXZQ4SOt5yR4jCDx5lISEsX0soNUm0ZTzy6dI_AfoHU9blEur660Q4AXPVAzKsXklhPdBI7Cocw-QYuuOorYyzsg6qBGXg1b8mTptpDcXqzn-ojQV9JN5zXUXEoPCmPmDs3WbqHamk7Cr_VZMZb8rwBe7ieJ0Ii5JWqMmI_XF9IqbTvdXnsqxrIwwD3-9cqJMF33geifG3O-exQBXE7i8GOMhk08Sb0g5QG30F0hAIp33iKTvmsU-9uUULar_C76O4mngh1mL7jnzjW-tMYeyqRBzPGNY0SbkG1Q5PYPeDZpGLR_6O5raN8qkRhOCnKz4KikmwfYcNesfNZ2bf3fHhOgtJjhq5O5T7NdKLyb3kHoDdHm-heANR7YQSGWS6nPYSBNai13n0LXK37clrrH4kHrY11awOZ1OlXtbo33Q_C_x5SlOfOmnm-hzalMt-H108ZUf-w-nIVsGY0ciptCObB8PIAT8cHPbQQL9by-Qlr4LlF_jSK5bzgUuf2uW4ZGRaZ0aOg1Zk6faRpFvfNGIaoxrO8yEV9BvoK8WmRi3_1VCGgTbJbZcDQh9YPGaK4BNX17YHVySMfU8QdjvjgoUZtDUv2TOc2cyv2ho2oLU2n1HRddWZGA0YygJDe8nozJ1S5ofl22FHjphxKLwuBBc5kZbxvAlLR-N_IhiNXUJZhEtelLk47GKkn9AkCCv3TstuIZty5Rsb_ho-90jA7ZKCvQifxYrg-x8bGlbiiUb_Aipv_p-IIHGV2koctvHYOG3_onqdNjgYM_QVzoPq823gJ5HLAHzGzmOOlNWucAIS4bW5ICCl5WH7JnLfiFn7GE7qz24u0v00hwkY8bbInzGnoSSkFemLo7e1MeqcIA_KS7kD_PMLOkZeRaPiZgN8uHrSzuLkVKAsKMiojIstMK4PB_kn8edDyK-yxtp9p18G2mcvVqUaBeRKYtKDLK_vijsbhp9yzoJwmqODPFLMRhZrAPII0rH0KzyRy04RTw3HfvkSiKSkQuN-COsOjmGRecvAeEKx2eKqMmUrf5x96WrMrr06pFR1nsXn0jgj9RddvaiNgsgIcNUgWynkRPQWbqNdj8MMhyh9-CPzQTk8z5kfr8sOyye7t82m-fUItoLp32Rfb1boAuTTy7WYlXL40hmChTT-aXU4A7xpDK1d9Dr2qDmxhuNIdMuS1zpu76NaSkh57q4r3RuqCDVgwTBUpv1i_zgGTuns0FD8X1EiAf5izkaMRueuBZYpk0lsoPLB2W-0n0nYSAZ3NYRArdu5m9ZzujwEntGvlHG5BdDkxB74qGibkSv5HPDh5ilHmBdTjZVo0CefnByqwguB_phCEEU3tfkobGMPFt1xpEBeH-z4ZF5eRuz0Z6DlvTKoddNgL3CcaiTNai3R4yKUCEmYkk4K9daBiDZ42XkQzXhVycMQgLouuk2En-uvWJi2EZeoHzHTpkmCZePu-Y45psBGkuWCvTH0w9nzCdQI8wuhVZ_BSGVO1P4JY6lCvWLQywO-PqWTSZXmiam_9ZJNUbRCYK7-cqVJNJ0VZb1IjmUdnK9f_uKcZYB4y9_U10RkH0aibpk3QRD5obWYOHRX1QoKeqGtd3tcZbnPJ9qPzVuAcffb7G79j17gBJLDhERlAD-Son0Mhov-MNP8BFQ87ZA6HmsM2Xf54wIcMq4tE3nU6CtE0cyRvag01VOu6kk7yi60cgDWwVXOZJAnSnWfz3xTgzdy38cUFRrzidJwyov51_nhpZ3dVKbv2-RpDJIoe8Q4ZAlKBqdlI4pDn92w33G5OtPBmmpnUtAeAeAPIKN9bkk0rMNREWIMkuNDOHGEWMcgcDB30yE5zrZj9QinDGC1VdVhfIQfrs6uxOUp8V9hh-HkTKZ139YsAt7qyiRRIsTExFTLzApep4iHmb5a5NB9auJOXAon39fg4-G0wo9Pr6g0zPjdkpHDWhCnTUSXNUgn6AzJU4e3L1v8neAqk9IyUtfxYYQU3OeR69sLmYRX_y9QZVgCH2k-FFdWi7QJkAryFllbqFVaf5KBOEyCDb8oohF02TnEbxV0-3CpJD3Ae3PxVYWbrpdON3874dPJJEM5vTG74bF3WvSvnLMMVwNWQvm1oO08fuEs925c7y5bq4grbAZQfIZC2ciXLbGGFrUcfVNet6XCYzgG0e9_mfLhvi15W1yoTUEhxTxRe3MAbWHyJSftSZrCA2zlbd-R4SBaIrU5MOUyw9-5sCs45ziNL-1n6oIQwkjz_EUHF2Hsbmvrs_QZYimQtNDMbMCJP5KDAQ-oyJuBGVAi4V5hGGxPRJ6aiL3Dk-PQz4jS01zqyJliw-n6v5-9FHmbKFEskxrZgLWo6TUyZcz_Yv3HOVKqOV9p7bs2rY6uSt_C8S_NPIoCzA7yuOTZRgGXVJLKnQ_qQ6MVuq3mjK00xQEUIjPZ69hKgFKNA2qKR8mc__zGG5E2Ahm-q7wlEiyw6VD9yTjJUnaQL7gCSn_GmaRTlEvz5mvDKNlKRezgTGK9-k2KRsHEi7c_7HpA0VwU_oLfPAjsbNOBdPmEclHLgN-S4MZPiHdFHSIIZsnOkzf2oJ9n0_KjG-rdSoQiGKAhm2E5BDQ6rcBubPBdHddybhZpn8ni71dM9Pw7yq83f36ClqMPIxIqFckLKly20HVJC1vYP4oNA_bMRfvbirCd2a1y9_mUmxMVX8l0dtWKaRPIL8BqJvOMbiXMY5zDU3ZsT8VOSQVgtq37fuDpOB2PEIll8TRnaB0mFPjolXGkcPVNGtayOIyXea9ZyOzxICRcYX0jD3sqm1XDd3wlGzrXN5XCPsFQ-4kYaBucWWXoxEI7H97CGZ878Tk2fbBYf7tDlhuz81P0CQvv8O7dqGH0SvgdHZjrNJznHnFNwNBgIvK7VySJ7f_Y8Pwm934-5KcXQhFjWyWczYZkQCcGtsXD3mX1IMohK7LuteGCQhLCbex-DEu3j1bThDCfrQ5Yl8ltanIckxTaijZon1WrVJhxBq91URmN5Sc1LW9ccZ27VG8n_ccdTL3piOUs3jfODQyP7xk_MXSNLOtvAfnzFY1-tjMt9sRZSRg0DNtEn49dt4dNbMjEKk7iaaxiy09-4Q8hHymQVQIIb5aCih6JFBVt4jZ1zb7AnHwuBG_UcyBGhPjpUCTZxHrjkR6eG-dbdF-Z9IYSJlG1F0fuoBml90ZxSdVs2RY3u7RJO0piAr36QYiDuMPMM-UG5DfjVxN-4j7NT6aN73odtPq3vlUj5rMqW9WlJI3keUiFW-qZKMSEHp3wiKrymdhT6T_eDJ4J70dh2oQ_nZzx14rzoNmmYMe9Te4cm0uM3aereSTvo7y0ZuwrwszgdwycQQ0QrJifKI0UAy38Scg9kBcrlaDJgwH3qIo0ybmJIP7u6OIkjsym-f3gaSfu7pBeJzvxBAjhZzu6yBFYLEj97vn5gZ6M2GRKSErcjnY5oNuJz0D-yOd8fnwVO0e55IVqrF22KG0Vod1HgusmjUja_0xqXocMCAIuhGfchj2Ycf4S-lO3Zq6JQeNSrSUZ9uY5-zxU9jAUD3OOoNqJxGPWJABbx1pVr_YL3em3-QR_OY4CQz3jcl7-LFGMTVJiGUUkHWec5QuIHM-oVthl7ndGsjkRy9OImk7EoHQv_ucLORPHXTwmJg6TvibKCr7np47d0kgw80t_Yl58gQhTQg7YUQipM46BPAIjDAkyyQ-q4mMDHVzOlJEqq_H9XgcGyjfkLVNP0CK2Tjb4yyrZuKXxpxa3v5UMSah5iDLRnimQglS5W2iLx41EFosRXA7cEHCS4zOFtogoiNjqW4whtob7K6weYRHB80UXvK2vNHnMjK3esnToU4VHOChqLBw8YAAAAAAAAADhUeJCcw";

    /// The first 32 bytes of noble's public key for `PQ_SEED`.
    const NOBLE_PK_PREFIX: &str = "O5ga_f_RESswa1uK5idJUPHdJzxioamZD51JaQ6rP2g";

    fn pq_key() -> ml_dsa::SigningKey<ml_dsa::MlDsa65> {
        ml_dsa::SigningKey::from_seed(&(*PQ_SEED).into())
    }

    fn pq_public(k: &ml_dsa::SigningKey<ml_dsa::MlDsa65>) -> ml_dsa::VerifyingKey<ml_dsa::MlDsa65> {
        use ml_dsa::Keypair;
        k.verifying_key()
    }

    fn root() -> Did {
        Did::new("did:autonomi:root")
    }

    fn pq_keyring(did: Did, k: &ml_dsa::SigningKey<ml_dsa::MlDsa65>) -> MlDsa65Verifier {
        let mut m = std::collections::BTreeMap::new();
        m.insert(did, pq_public(k));
        MlDsa65Verifier::new(m, 1_000)
    }

    /// An AgileVerifier that knows `root()` by the algorithms asked for.
    fn agile(ed25519: bool, ml_dsa_65: bool) -> AgileVerifier {
        let mut ed = std::collections::BTreeMap::new();
        if ed25519 {
            ed.insert(root(), test_key().verifying_key());
        }
        let mut pq = std::collections::BTreeMap::new();
        if ml_dsa_65 {
            pq.insert(root(), pq_public(&pq_key()));
        }
        AgileVerifier::new(ed, pq, 1_000)
    }

    /// `unsigned_grant()` carrying both signatures.
    fn hybrid() -> Delegation {
        let ed = Ed25519Verifier::sign(&unsigned_grant(), &test_key());
        MlDsa65Verifier::sign(&ed, &pq_key()).unwrap()
    }

    fn with_tagged_sig(d: &Delegation, sig: String) -> Delegation {
        let mut out = d.clone();
        out.pq_signature.as_mut().unwrap().sig = sig;
        out
    }

    #[test]
    fn legacy_ed25519_token_verifies_byte_for_byte_unchanged() {
        // THE back-compat promise. A token minted before pq_signature existed,
        // in its exact wire bytes.
        let sig_hex = hex_lower(&b64u_decode(LEGACY_ED25519_SIG_B64U).unwrap());
        let wire = LEGACY_PAYLOAD.replace(
            r#""signature":null"#,
            &format!(r#""signature":"{sig_hex}""#),
        );
        let d: Delegation = serde_json::from_str(&wire).unwrap();
        assert_eq!(d.pq_signature, None, "an absent key parses as None");
        // The bytes its signature covers have not moved...
        assert_eq!(d.signing_payload(), LEGACY_PAYLOAD.as_bytes());
        // ...re-serializing adds no key its issuer never signed...
        assert_eq!(serde_json::to_string(&d).unwrap(), wire);
        // ...it verifies under the v1 verifier, and under the agile one for an
        // issuer known by Ed25519 only...
        assert_eq!(keyring(root(), &test_key()).verify(&d), Ok(()));
        assert_eq!(agile(true, false).verify(&d), Ok(()));
        // ...and today's signer still produces those exact bytes.
        assert_eq!(
            Ed25519Verifier::sign(&unsigned_grant(), &test_key()).signature,
            Some(sig_hex)
        );
    }

    #[test]
    fn ml_dsa_65_signs_and_verifies() {
        let k = pq_key();
        let d = MlDsa65Verifier::sign(&unsigned_grant(), &k).unwrap();
        assert!(d.signature.is_none());
        assert!(
            d.is_signed(),
            "a token carrying only the PQ signature is signed"
        );
        let t = d.pq_signature.as_ref().unwrap();
        assert_eq!(t.alg, ALG_ML_DSA_65);
        assert_eq!(
            b64u_decode(&t.sig).unwrap().len(),
            MlDsa65Verifier::SIGNATURE_LEN
        );
        assert_eq!(pq_keyring(root(), &k).verify(&d), Ok(()));
        assert_eq!(
            agile(false, true).verify(&d),
            Ok(()),
            "an issuer known by ML-DSA-65 only needs nothing else"
        );

        // Hybrid: both slots, both keys. And the order of signing does not
        // matter, because neither slot is inside the other's bytes.
        let h = hybrid();
        assert_eq!(agile(true, true).verify(&h), Ok(()));
        let pq_first = Ed25519Verifier::sign(&d, &test_key());
        assert_eq!(pq_first, h);

        // It survives the wire.
        let back: Delegation = serde_json::from_str(&serde_json::to_string(&h).unwrap()).unwrap();
        assert_eq!(back, h);
        assert_eq!(agile(true, true).verify(&back), Ok(()));
    }

    #[test]
    fn a_noble_signature_verifies_here_and_ours_matches_it_byte_for_byte() {
        // A foreign oracle, not our own code. Keygen agrees...
        let k = pq_key();
        let pk = pq_public(&k).encode();
        assert_eq!(pk.len(), MlDsa65Verifier::PUBLIC_KEY_LEN);
        assert_eq!(b64u_encode(&pk.as_slice()[..32]), NOBLE_PK_PREFIX);
        // ...noble's signature over the v1 payload verifies here...
        let mut d = unsigned_grant();
        assert_eq!(d.signing_payload(), LEGACY_PAYLOAD.as_bytes());
        d.pq_signature = Some(TaggedSignature {
            alg: ALG_ML_DSA_65.to_string(),
            sig: NOBLE_ML_DSA_65_SIG.to_string(),
        });
        assert_eq!(pq_keyring(root(), &k).verify(&d), Ok(()));
        // ...and ours is the same 3309 bytes, because both sign deterministically
        // with an empty context.
        let ours = MlDsa65Verifier::sign(&unsigned_grant(), &k).unwrap();
        assert_eq!(ours.pq_signature.unwrap().sig, NOBLE_ML_DSA_65_SIG);
    }

    #[test]
    fn tampering_breaks_the_ml_dsa_signature() {
        let k = pq_key();
        let v = pq_keyring(root(), &k);
        let signed = MlDsa65Verifier::sign(&unsigned_grant(), &k).unwrap();
        assert_eq!(v.verify(&signed), Ok(()));

        // Escalate the capability.
        let mut escalated = signed.clone();
        escalated.capabilities = vec![Capability::new("settlement.private", "wallet/spend")];
        assert_eq!(v.verify(&escalated), Err(CapabilityError::BadSignature));

        // Redirect the audience.
        let mut redirected = signed.clone();
        redirected.audience = Did::new("did:plc:attacker");
        assert_eq!(v.verify(&redirected), Err(CapabilityError::BadSignature));

        // Strip a tier ceiling.
        let ceilinged =
            MlDsa65Verifier::sign(&unsigned_grant().with_tier_ceiling(Tier::T5), &k).unwrap();
        assert_eq!(v.verify(&ceilinged), Ok(()));
        let mut stripped = ceilinged.clone();
        stripped.tier_ceiling = None;
        assert_eq!(v.verify(&stripped), Err(CapabilityError::BadSignature));

        // Flip one bit of the signature itself.
        let mut raw = b64u_decode(&signed.pq_signature.as_ref().unwrap().sig).unwrap();
        raw[0] ^= 1;
        let flipped = with_tagged_sig(&signed, b64u_encode(&raw));
        assert_eq!(v.verify(&flipped), Err(CapabilityError::BadSignature));

        // Signed by a different key.
        let other = ml_dsa::SigningKey::<ml_dsa::MlDsa65>::from_seed(
            &(*b"capability ml-dsa-65 test seed B").into(),
        );
        let forged = MlDsa65Verifier::sign(&unsigned_grant(), &other).unwrap();
        assert_eq!(v.verify(&forged), Err(CapabilityError::BadSignature));

        // A hybrid whose Ed25519 half is good but whose PQ half is not: refused.
        let bad_pq_half = with_tagged_sig(&hybrid(), b64u_encode(&raw));
        assert_eq!(
            agile(true, true).verify(&bad_pq_half),
            Err(CapabilityError::BadSignature)
        );
    }

    #[test]
    fn unknown_algorithm_ids_are_refused_never_skipped() {
        let v = pq_keyring(root(), &pq_key());
        let good = hybrid();
        for id in [
            "ml-dsa-87",
            "ml-dsa-44",
            "ML-DSA-65",
            "ml-dsa-65 ",
            "mldsa65",
            "ed25519",
            "slh-dsa-shake-256f",
            "",
        ] {
            let mut d = good.clone();
            d.pq_signature.as_mut().unwrap().alg = id.to_string();
            assert_eq!(
                v.verify(&d),
                Err(CapabilityError::UnsupportedAlgorithm),
                "{id:?}"
            );
            for a in [agile(true, true), agile(false, true), agile(true, false)] {
                // Even a verifier that knows the issuer by Ed25519 only, holding
                // a valid Ed25519 signature for this very token, refuses the
                // slot it cannot read rather than skipping it.
                assert_eq!(
                    a.verify(&d),
                    Err(CapabilityError::UnsupportedAlgorithm),
                    "{id:?}"
                );
            }
        }
        // An id nobody knows still parses: refused by name, not as broken JSON.
        let json = r#"{"issuer":"did:autonomi:root","audience":"did:plc:design","capabilities":[],"not_before":null,"expires_at":null,"signature":null,"pq_signature":{"alg":"falcon-512","sig":"AA"}}"#;
        let d: Delegation = serde_json::from_str(json).unwrap();
        assert_eq!(
            agile(true, true).verify(&d),
            Err(CapabilityError::UnsupportedAlgorithm)
        );
    }

    #[test]
    fn wrong_lengths_are_refused() {
        // Public keys: checked before decoding, never trusted.
        let pk = pq_public(&pq_key()).encode();
        let pk = pk.as_slice();
        assert!(MlDsa65Verifier::public_key_from_bytes(pk).is_ok());
        let mut long_pk = pk.to_vec();
        long_pk.push(0);
        // 1312 and 2592 are ML-DSA-44's and ML-DSA-87's key lengths.
        for bad in [&pk[..0], &pk[..32], &pk[..1312], &pk[..1951], &long_pk[..]] {
            assert_eq!(
                MlDsa65Verifier::public_key_from_bytes(bad).err(),
                Some(CapabilityError::MalformedKey),
                "a {}-byte key",
                bad.len()
            );
        }
        assert_eq!(
            MlDsa65Verifier::public_key_from_bytes(&[0u8; 2592]).err(),
            Some(CapabilityError::MalformedKey)
        );

        // Signatures: 3309 bytes or BadSignature, never a panic. 2420 and
        // 4627 are ML-DSA-44's and ML-DSA-87's signature lengths.
        let v = pq_keyring(root(), &pq_key());
        let good = MlDsa65Verifier::sign(&unsigned_grant(), &pq_key()).unwrap();
        let s = good.pq_signature.as_ref().unwrap().sig.clone();
        let raw = b64u_decode(&s).unwrap();
        let mut long_sig = raw.clone();
        long_sig.push(0);
        let mut ml_dsa_87_sized = raw.clone();
        ml_dsa_87_sized.resize(4627, 0);
        for bad in [
            &raw[..0],
            &raw[..64],
            &raw[..2420],
            &raw[..3308],
            &long_sig[..],
            &ml_dsa_87_sized[..],
        ] {
            assert_eq!(
                v.verify(&with_tagged_sig(&good, b64u_encode(bad))),
                Err(CapabilityError::BadSignature),
                "a {}-byte signature",
                bad.len()
            );
        }

        // Text that is not canonical base64url never reaches the decoder.
        for junk in [
            format!("{s}="),
            format!("{s}A"),
            format!("+{}", &s[1..]),
            format!("/{}", &s[1..]),
            format!(" {}", &s[1..]),
            "!!!!".to_string(),
        ] {
            assert_eq!(
                v.verify(&with_tagged_sig(&good, junk)),
                Err(CapabilityError::BadSignature)
            );
        }
    }

    #[test]
    fn a_stripped_signature_is_refused_as_a_downgrade() {
        let h = hybrid();
        let mut no_pq = h.clone();
        no_pq.pq_signature = None;
        let mut no_ed = h.clone();
        no_ed.signature = None;

        // Known by both: only both will do. Stripping the ML-DSA-65 half is
        // what a forger who can break Ed25519 would do.
        let both = agile(true, true);
        assert_eq!(both.verify(&h), Ok(()));
        assert_eq!(both.verify(&no_pq), Err(CapabilityError::MissingSignature));
        assert_eq!(both.verify(&no_ed), Err(CapabilityError::MissingSignature));
        assert_eq!(
            both.verify(&unsigned_grant()),
            Err(CapabilityError::Unsigned)
        );

        // Known by Ed25519 only: v1 behaviour, but a carried PQ signature it
        // cannot check is not skipped.
        assert_eq!(agile(true, false).verify(&no_pq), Ok(()));
        assert_eq!(
            agile(true, false).verify(&h),
            Err(CapabilityError::UnknownIssuer)
        );

        // Known by ML-DSA-65 only (Ed25519 retired): the mirror image.
        assert_eq!(agile(false, true).verify(&no_ed), Ok(()));
        assert_eq!(
            agile(false, true).verify(&h),
            Err(CapabilityError::UnknownIssuer)
        );

        // Known by neither.
        assert_eq!(
            agile(false, false).verify(&h),
            Err(CapabilityError::UnknownIssuer)
        );
    }

    #[test]
    fn ml_dsa_verifier_reports_unsigned_expired_and_unknown_issuer() {
        let k = pq_key();
        let v = pq_keyring(root(), &k);
        // An Ed25519-only token carries nothing for this verifier.
        assert_eq!(
            v.verify(&Ed25519Verifier::sign(&unsigned_grant(), &test_key())),
            Err(CapabilityError::Unsigned)
        );

        // Expired is Expired, however good the signature.
        let mut d = unsigned_grant();
        d.expires_at = Some(500);
        let d = MlDsa65Verifier::sign(&d, &k).unwrap();
        assert_eq!(v.verify(&d), Err(CapabilityError::Expired));
        let mut m = std::collections::BTreeMap::new();
        m.insert(root(), pq_public(&k));
        assert_eq!(MlDsa65Verifier::new(m, 400).verify(&d), Ok(()));

        // "I cannot check this" is not "this is forged".
        let stranger = pq_keyring(Did::new("did:autonomi:somebody-else"), &k);
        assert_eq!(
            stranger.verify(&MlDsa65Verifier::sign(&unsigned_grant(), &k).unwrap()),
            Err(CapabilityError::UnknownIssuer)
        );
    }

    #[test]
    fn none_pq_signature_emits_no_key_and_neither_slot_is_in_the_payload() {
        let d = unsigned_grant();
        let json = serde_json::to_string(&d).unwrap();
        assert!(
            !json.contains("pq_signature"),
            "None must emit no key at all, got: {json}"
        );
        let h = hybrid();
        assert!(serde_json::to_string(&h).unwrap().contains("pq_signature"));
        assert_eq!(
            h.signing_payload(),
            d.signing_payload(),
            "both signature slots are cleared from the signed bytes"
        );
        // The tagged message puts the algorithm id ahead of the payload.
        let m = d.tagged_message(ALG_ML_DSA_65);
        assert!(m.starts_with(b"cap1/delegation/ml-dsa-65\n"));
        assert!(m.ends_with(LEGACY_PAYLOAD.as_bytes()));
    }

    #[test]
    fn base64url_is_strict_and_roundtrips() {
        for n in 0u8..10 {
            let b: Vec<u8> = (0..n)
                .map(|i| i.wrapping_mul(37).wrapping_add(200))
                .collect();
            assert_eq!(b64u_decode(&b64u_encode(&b)), Some(b));
        }
        assert_eq!(b64u_encode(&[0xfb, 0xff]), "-_8");
        assert_eq!(b64u_decode("AA"), Some(vec![0]));
        // Impossible length, padding, the standard alphabet, stray low bits.
        for bad in [
            "A", "AAAAA", "AA==", "AAA=", "A+AA", "A/AA", " AAA", "AB", "AAB",
        ] {
            assert_eq!(b64u_decode(bad), None, "{bad:?}");
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
