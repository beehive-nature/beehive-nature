//! Classifies a Trezor `AuthenticityProof` into an [`EvidenceClass`].
//!
//! # What ships, and what does not
//!
//! **Ships:** structural validation of a proof — the checks that can be made
//! without parsing a certificate, and that a malformed or replayed proof must
//! fail regardless of any root.
//!
//! **Does not ship:** chain-to-root verification. Two reasons, both load-bearing
//! and neither temporary-by-choice:
//!
//! 1. **There is no production root to verify against.** Trezor publishes
//!    per-model roots at `firmware/<model>/authenticity.json` in `trezor/data`.
//!    `t2b1`, `t3b1` and `t3t1` have one. **`t3w1` — the Safe 7 — does not**
//!    (verified 2026-07-16: absent from the repo, and
//!    `data.trezor.io/firmware/t3w1/authenticity.json` returns HTTP 404 while
//!    `t3t1` returns 200). `t3w1` ships `authenticity-dev.json` only, which
//!    Trezor's own README calls "debug keys to be used in conjunction with
//!    Trezor Emulator". Enrolling those would let an **emulator** claim E5.
//! 2. **No proof has ever been parsed here.** No `trezorctl device authenticate
//!    --raw` capture exists, so there is no fixture. A parser written against a
//!    format nobody has seen would pass its own tests and prove nothing — the
//!    `chain-exsat-evm` precedent.
//!
//! So [`TrezorVerifier`] reports the root a proof chains to as `None`, and
//! [`FirmwarePolicy::classify_signer`] turns that into
//! [`EvidenceClass::HardwareKey`] (E3). **That is not a stub returning a
//! placeholder — it is the founder's E5 ruling, enforced:** genuine hardware
//! whose firmware cannot be verified is E3, because an untrusted screen can lie
//! about what it signs. A Safe 7 in hand is E3 today, and it climbs to E5 the
//! moment its root is sourced from a channel that is not the device itself.
//!
//! # Why the root must not come from the device
//!
//! The proof carries its own certificate chain. Trusting the root inside it
//! would be TOFU on the exact thing under verification — the device would be
//! vouching for itself. The root has to arrive independently (Trezor's published
//! `authenticity.json`), which is why [`TrezorVerifier`] takes a
//! [`FirmwarePolicy`] rather than reading one out of the evidence.

#![forbid(unsafe_code)]

use capability::{
    CapabilityError, DeviceEvidence, EvidenceClass, EvidenceVerifier, FirmwarePolicy,
};

/// The device's own model identifier for a Trezor Safe 7, as the device reports
/// it (observed in a real Suite log, not a marketing name).
pub const MODEL_SAFE_7: &str = "T3W1";

/// Classifies Trezor authenticity proofs against a [`FirmwarePolicy`].
pub struct TrezorVerifier {
    policy: FirmwarePolicy,
}

impl TrezorVerifier {
    pub fn new(policy: FirmwarePolicy) -> Self {
        TrezorVerifier { policy }
    }

    /// The policy this verifier trusts against.
    pub fn policy(&self) -> &FirmwarePolicy {
        &self.policy
    }

    /// Which trusted root this proof's chain terminates at.
    ///
    /// **Always `None` today, and that is a fact rather than a placeholder.**
    /// Returning a root would require parsing the X.509 chain and verifying its
    /// signatures — against a root that, for `t3w1`, is not published (see the
    /// module docs). Both halves are missing, so this reports what is true: the
    /// chain has not been verified to any root.
    ///
    /// `None` is not "failed" — it is "unverifiable", which the ruling maps to
    /// E3. When a root is sourced and a fixture exists, this is the one function
    /// that changes, and every caller keeps working.
    fn chains_to(&self, _proof: &TrezorProof<'_>) -> Option<&[u8]> {
        None
    }

    /// Structural validation — every check that holds without a root.
    ///
    /// A proof failing any of these is malformed, and malformed is
    /// [`CapabilityError::UnclassifiableEvidence`]: fail-closed, no tier, rather
    /// than a fallback to a weak one.
    fn structurally_valid(proof: &TrezorProof<'_>) -> Result<(), CapabilityError> {
        // A signature is over `"\x13AuthenticateDevice:" || len-prefixed
        // challenge`. Without the challenge a proof cannot be distinguished
        // from a replay of an older one, so an absent challenge is fatal
        // independently of any signature check.
        if proof.challenge.is_empty() {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        // Optiga is the one chain every secure-element Trezor answers with. Its
        // absence means this is not a proof we recognise.
        if proof.optiga_certificates.is_empty() || proof.optiga_signature.is_empty() {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        // A certificate chain with an empty certificate in it is malformed —
        // catch it here rather than let a parser meet it later.
        if proof.optiga_certificates.iter().any(|c| c.is_empty())
            || proof.tropic_certificates.iter().any(|c| c.is_empty())
            || proof.mcu_certificates.iter().any(|c| c.is_empty())
        {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        // Optional chains must be coherent: certificates without a signature, or
        // a signature without certificates, is not a shape the device produces.
        if proof.tropic_certificates.is_empty() != proof.tropic_signature.is_none() {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        if proof.mcu_certificates.is_empty() != proof.mcu_signature.is_none() {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        if proof.internal_model.is_empty() {
            return Err(CapabilityError::UnclassifiableEvidence);
        }
        Ok(())
    }
}

/// A borrowed view of [`DeviceEvidence::Trezor`], so the checks above read as
/// checks rather than as pattern-matching.
struct TrezorProof<'a> {
    challenge: &'a [u8],
    optiga_certificates: &'a [Vec<u8>],
    optiga_signature: &'a [u8],
    tropic_certificates: &'a [Vec<u8>],
    tropic_signature: &'a Option<Vec<u8>>,
    mcu_certificates: &'a [Vec<u8>],
    mcu_signature: &'a Option<Vec<u8>>,
    internal_model: &'a str,
}

impl EvidenceVerifier for TrezorVerifier {
    fn classify(&self, evidence: &DeviceEvidence) -> Result<EvidenceClass, CapabilityError> {
        let DeviceEvidence::Trezor {
            challenge,
            optiga_certificates,
            optiga_signature,
            tropic_certificates,
            tropic_signature,
            mcu_certificates,
            mcu_signature,
            internal_model,
        } = evidence
        else {
            // Another platform's evidence. Not ours to classify, and guessing
            // would be worse than refusing.
            return Err(CapabilityError::UnclassifiableEvidence);
        };

        let proof = TrezorProof {
            challenge,
            optiga_certificates,
            optiga_signature,
            tropic_certificates,
            tropic_signature,
            mcu_certificates,
            mcu_signature,
            internal_model,
        };

        Self::structurally_valid(&proof)?;

        // The E5 gate. `chains_to` is None until a root is sourced and a chain
        // parser exists, so this is E3 — the ruling, not a shortcut.
        Ok(self.policy.classify_signer(self.chains_to(&proof)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use capability::TrustedRoot;

    // Labelled placeholders. No real root is known — t3w1's production root is
    // unpublished — so nothing here is a guessed root presented as real.
    const DEV_ROOT: &[u8] = b"PLACEHOLDER-t3w1-authenticity-dev-EMULATOR-KEY";
    const VENDOR_ROOT: &[u8] = b"PLACEHOLDER-satoshilabs-production-UNVERIFIED";

    fn safe7_proof() -> DeviceEvidence {
        DeviceEvidence::Trezor {
            challenge: vec![0xAB; 32],
            optiga_certificates: vec![vec![0x30, 0x82, 0x01], vec![0x30, 0x82, 0x02]],
            optiga_signature: vec![0x30, 0x45, 0x02],
            tropic_certificates: vec![vec![0x30, 0x82, 0x03]],
            tropic_signature: Some(vec![0x30, 0x45, 0x03]),
            mcu_certificates: vec![vec![0x30, 0x82, 0x04]],
            mcu_signature: Some(vec![0x30, 0x45, 0x04]),
            internal_model: MODEL_SAFE_7.to_string(),
        }
    }

    fn verifier_trusting(root: &[u8]) -> TrezorVerifier {
        TrezorVerifier::new(FirmwarePolicy::genesis(TrustedRoot::new(
            "test root",
            root.to_vec(),
        )))
    }

    #[test]
    fn a_structurally_valid_safe7_proof_classifies_e3_not_e5() {
        // THE ruling, enforced. The chain cannot be verified — no published
        // t3w1 root, no parser — so the device is genuine hardware whose
        // firmware is unverifiable: E3.
        let v = verifier_trusting(VENDOR_ROOT);
        let class = v.classify(&safe7_proof()).unwrap();
        assert_eq!(class, EvidenceClass::HardwareKey);
        assert_eq!(class.tier(), capability::Tier::T3);
        assert_ne!(class, EvidenceClass::IsolatedSigner);
    }

    #[test]
    fn an_emulator_dev_root_can_never_yield_isolated_signer() {
        // The near-miss this crate exists to prevent. t3w1 publishes
        // authenticity-dev.json — real-looking keys that parse cleanly — and
        // Trezor's README says they are emulator debug keys. Enrolling them
        // must not promote anything to E5.
        let v = verifier_trusting(DEV_ROOT);
        let class = v.classify(&safe7_proof()).unwrap();
        assert_ne!(
            class,
            EvidenceClass::IsolatedSigner,
            "emulator debug keys must never reach the tier the quorum protects"
        );
        assert_eq!(class, EvidenceClass::HardwareKey);
    }

    #[test]
    fn an_empty_policy_also_yields_e3_never_an_error() {
        // Trusting nothing is not the same as failing. A structurally sound
        // proof still tells us the key is in hardware.
        let v = TrezorVerifier::new(FirmwarePolicy::new(vec![]));
        assert_eq!(
            v.classify(&safe7_proof()).unwrap(),
            EvidenceClass::HardwareKey
        );
    }

    #[test]
    fn another_platforms_evidence_is_refused_not_guessed() {
        let v = verifier_trusting(VENDOR_ROOT);
        let foreign = DeviceEvidence::TpmQuote {
            quote: vec![1, 2, 3],
            signature: vec![4, 5, 6],
        };
        assert_eq!(
            v.classify(&foreign),
            Err(CapabilityError::UnclassifiableEvidence)
        );
    }

    #[test]
    fn an_absent_challenge_is_fatal() {
        // Without the challenge a proof cannot be told apart from a replay.
        let v = verifier_trusting(VENDOR_ROOT);
        let DeviceEvidence::Trezor { .. } = safe7_proof() else {
            unreachable!()
        };
        let mut e = safe7_proof();
        if let DeviceEvidence::Trezor { challenge, .. } = &mut e {
            challenge.clear();
        }
        assert_eq!(v.classify(&e), Err(CapabilityError::UnclassifiableEvidence));
    }

    #[test]
    fn a_missing_optiga_chain_is_fatal() {
        let v = verifier_trusting(VENDOR_ROOT);
        let mut e = safe7_proof();
        if let DeviceEvidence::Trezor {
            optiga_certificates,
            ..
        } = &mut e
        {
            optiga_certificates.clear();
        }
        assert_eq!(v.classify(&e), Err(CapabilityError::UnclassifiableEvidence));
    }

    #[test]
    fn an_empty_certificate_in_a_chain_is_fatal() {
        let v = verifier_trusting(VENDOR_ROOT);
        let mut e = safe7_proof();
        if let DeviceEvidence::Trezor {
            optiga_certificates,
            ..
        } = &mut e
        {
            optiga_certificates.push(Vec::new());
        }
        assert_eq!(v.classify(&e), Err(CapabilityError::UnclassifiableEvidence));
    }

    #[test]
    fn certificates_without_a_signature_are_incoherent() {
        let v = verifier_trusting(VENDOR_ROOT);
        // Tropic certs present, signature absent — not a shape the device makes.
        let mut e = safe7_proof();
        if let DeviceEvidence::Trezor {
            tropic_signature, ..
        } = &mut e
        {
            *tropic_signature = None;
        }
        assert_eq!(v.classify(&e), Err(CapabilityError::UnclassifiableEvidence));

        // And the mirror: a signature with no certificates.
        let mut e2 = safe7_proof();
        if let DeviceEvidence::Trezor {
            mcu_certificates, ..
        } = &mut e2
        {
            mcu_certificates.clear();
        }
        assert_eq!(
            v.classify(&e2),
            Err(CapabilityError::UnclassifiableEvidence)
        );
    }

    #[test]
    fn an_older_model_answering_with_optiga_alone_is_still_structurally_valid() {
        // tropic/mcu are optional in the protobuf: the field set is a property
        // of the model. A Safe 3 answering Optiga-only must not be malformed.
        let v = verifier_trusting(VENDOR_ROOT);
        let e = DeviceEvidence::Trezor {
            challenge: vec![0xCD; 32],
            optiga_certificates: vec![vec![0x30, 0x82, 0x01]],
            optiga_signature: vec![0x30, 0x45],
            tropic_certificates: vec![],
            tropic_signature: None,
            mcu_certificates: vec![],
            mcu_signature: None,
            internal_model: "T2B1".to_string(),
        };
        assert_eq!(v.classify(&e).unwrap(), EvidenceClass::HardwareKey);
    }
}
