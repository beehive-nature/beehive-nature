//! Ed25519 record-signature verification for bDiD records.
//!
//! `did-autonomi-spec` mandates **ed25519** record signatures (`keyAlg=ed25519`).
//! **R1b** (`SPEC_RESOLVER_VALIDITY_RULES` §R1b, ruled Seat 1 2026-08-09): the
//! resolver MUST reject signatures whose scalar `s` is **non-canonical** (`s >= L`),
//! **explicitly** — never by relying on the verifier library's accident. Cowork
//! proved the current safety is library accident: `s + L` verifies under a permissive
//! RFC-8032 verifier, because the basepoint `B` has order `L`, so `[s+L]B == [s]B`;
//! only an explicit scalar-range check rejects it.
//!
//! This layer is DISTINCT from [`crate::commit::verify_signature`] — that is the
//! atproto COMMIT signature (secp256k1 ES256K / P-256 ES256, low-S), a different
//! signature over a different object, and it stays as-is (sound at its own layer).
//!
//! SIGNATURE-AXIS COVERAGE (ruled inclusion amendment, 2026-08-09) — genuine 8r
//! controls where constructible, an explicit exclusion-why where not:
//!   * non-canonical scalar `s >= L` — GENUINE control (`s_plus_l_is_rejected…`),
//!     self-checked: it proves `s+L` reduces to `s` mod L, so the control fails if
//!     the malleability stops reproducing.
//!   * small-order / non-canonical POINT — GENUINE control
//!     (`small_order_and_noncanonical_pubkeys_are_rejected`), self-validated via
//!     `is_small_order()` so a mistyped constant fails loudly, with a `validated >= 1`
//!     guard so the control cannot go vacuous.
//!   * cofactor-8 / mixed-order — DEFENDED by `verify_strict` (non-cofactored; it
//!     rejects small-order R and A), which the small-order control exercises directly.
//!     A standalone "cofactored-verify accepts / strict rejects" DIVERGENCE control is
//!     EXCLUDED-WHY: the Fiat-Shamir challenge `k = H(R‖A‖m)` binds R, so naive
//!     constructions (e.g. R+T) do not reproduce the attack — a correct small-subgroup
//!     forgery ("Taming the many EdDSAs" §5) is research-grade machinery for a defense
//!     the small-order rejection already covers.
//!   * batch verification — EXCLUDED: no batch-verify construction exists to test;
//!     `verify_record` is single-signature only.

use ed25519_dalek::{Signature, VerifyingKey};

/// Ed25519 group order `L = 2^252 + 27742317777372353535851937790883648493`,
/// little-endian, 32 bytes. A signature scalar `s` is canonical iff `s < L`.
/// Cross-validated against curve25519-dalek's own canonical boundary in tests.
const L_LE: [u8; 32] = [
    0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58,
    0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10,
];

#[derive(Debug, PartialEq, Eq)]
pub enum RecordSigError {
    /// Signature was not 64 bytes (R || s).
    BadLength(usize),
    /// R1b: the scalar `s` is non-canonical (`s >= L`). Rejected before any
    /// library verification, on the explicit range check.
    NonCanonicalS,
    /// Malformed key/signature, or the (canonical) signature did not verify.
    BadSignature,
}

/// EXPLICIT canonical-scalar check: is the 32-byte little-endian scalar `< L`?
/// Compares from the most-significant byte down. Does not call the signature
/// verifier — this IS the R1b mechanism, independent of any library's behaviour.
fn s_lt_l(s: &[u8; 32]) -> bool {
    for i in (0..32).rev() {
        if s[i] < L_LE[i] {
            return true;
        }
        if s[i] > L_LE[i] {
            return false;
        }
    }
    false // s == L is non-canonical
}

/// Verify an ed25519 record signature, rejecting non-canonical `s` FIRST (R1b),
/// then verifying strictly. `sig64` is `R (32) || s (32, little-endian)`.
pub fn verify_record(pubkey: &[u8; 32], msg: &[u8], sig64: &[u8]) -> Result<(), RecordSigError> {
    if sig64.len() != 64 {
        return Err(RecordSigError::BadLength(sig64.len()));
    }
    let mut s = [0u8; 32];
    s.copy_from_slice(&sig64[32..64]);
    // R1b — explicit, BEFORE the library ever sees the signature.
    if !s_lt_l(&s) {
        return Err(RecordSigError::NonCanonicalS);
    }
    let vk = VerifyingKey::from_bytes(pubkey).map_err(|_| RecordSigError::BadSignature)?;
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(sig64);
    let sig = Signature::from_bytes(&sig_arr);
    vk.verify_strict(msg, &sig).map_err(|_| RecordSigError::BadSignature)
}

#[cfg(test)]
mod tests {
    use super::*;
    use curve25519_dalek::scalar::Scalar;
    use ed25519_dalek::{Signer, SigningKey};

    /// 256-bit little-endian `s + L`. No carry past 32 bytes: `s < L < 2^252`,
    /// `L < 2^253`, so the sum is `< 2^254` and fits in 32 bytes.
    fn add_l(s: &[u8; 32]) -> [u8; 32] {
        let mut out = [0u8; 32];
        let mut carry = 0u16;
        for i in 0..32 {
            let v = s[i] as u16 + L_LE[i] as u16 + carry;
            out[i] = (v & 0xff) as u8;
            carry = v >> 8;
        }
        assert_eq!(carry, 0, "s + L overflowed 32 bytes");
        out
    }

    #[test]
    fn canonical_signature_verifies() {
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        let vk = sk.verifying_key().to_bytes();
        let msg = b"bnr-record";
        let sig = sk.sign(msg).to_bytes();
        let mut s = [0u8; 32];
        s.copy_from_slice(&sig[32..64]);
        assert!(s_lt_l(&s), "dalek should emit a canonical s");
        assert_eq!(verify_record(&vk, msg, &sig), Ok(()));
    }

    /// 8r negative control. The `s + L` malleability. This test MUST fail if the
    /// attack stops reproducing — assertion (2) below breaks if `s + L` ever stops
    /// being arithmetically equivalent, so the control cannot silently go vacuous.
    #[test]
    fn s_plus_l_is_rejected_even_though_arithmetically_valid() {
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        let vk = sk.verifying_key().to_bytes();
        let msg = b"bnr-record";
        let sig = sk.sign(msg).to_bytes();
        let mut s = [0u8; 32];
        s.copy_from_slice(&sig[32..64]);

        let s_mal = add_l(&s);

        // (1) the malleated scalar is NON-canonical (s+L >= L) — our explicit check catches it.
        assert!(!s_lt_l(&s_mal), "s+L must be non-canonical");

        // (2) it is a REAL malleability, not a random bad sig: s and s+L reduce to the
        //     SAME scalar mod L, so a permissive verifier ([s+L]B == [s]B) would ACCEPT it.
        let reduced = Scalar::from_bytes_mod_order(s_mal);
        let canonical = Option::<Scalar>::from(Scalar::from_canonical_bytes(s)).unwrap();
        assert_eq!(reduced, canonical, "s+L must reduce to s mod L");

        // (3) our verify REJECTS it, explicitly, on the s>=L rule — not on a parse accident.
        let mut mal = sig;
        mal[32..64].copy_from_slice(&s_mal);
        assert_eq!(verify_record(&vk, msg, &mal), Err(RecordSigError::NonCanonicalS));
    }

    /// Cross-validate the hand-written L_LE against the library's own canonical
    /// boundary, so a mistyped constant cannot silently weaken the check: L is
    /// non-canonical; L-1 is canonical; s_lt_l agrees at both.
    #[test]
    fn l_constant_matches_dalek_boundary() {
        assert!(bool::from(Scalar::from_canonical_bytes(L_LE).is_none()));
        let mut l_minus_1 = L_LE;
        l_minus_1[0] -= 1;
        assert!(bool::from(Scalar::from_canonical_bytes(l_minus_1).is_some()));
        assert!(!s_lt_l(&L_LE));
        assert!(s_lt_l(&l_minus_1));
    }

    /// Small-order / mixed-order / non-canonical public keys are rejected (the
    /// previously named-not-claimed axes, 2026-08-09). `verify_record` uses
    /// `verify_strict`, which is non-cofactored and rejects weak (small-order)
    /// points — the defense against cofactor-8 small-subgroup malleability.
    ///
    /// GENUINE 8r control, not a strawman: each canonical candidate is SELF-VALIDATED
    /// here as actually small-order via curve25519-dalek's `is_small_order()`, so a
    /// mistyped constant fails the test loudly rather than silently testing a benign
    /// point. Non-canonical candidates are rejected at decode. The control fails if
    /// EITHER the points stop being small-order OR the rejection stops firing — it
    /// cannot go vacuous (the `validated` guard requires >=1 real small-order reject).
    ///
    /// Encodings from Chalkias, Cottier et al., "Taming the many EdDSAs" (2020), §5.
    #[test]
    fn small_order_and_noncanonical_pubkeys_are_rejected() {
        use curve25519_dalek::edwards::CompressedEdwardsY;

        // The 8 small-order point encodings (identity, the 2-/4-torsion, order-8),
        // plus non-canonical variants that must fail at decode.
        let encodings: [[u8; 32]; 6] = [
            hex32("0100000000000000000000000000000000000000000000000000000000000000"), // PUBLIC-CONSTANT small-order point: identity, order 1
            hex32("ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"), // PUBLIC-CONSTANT small-order point: order 2
            hex32("0000000000000000000000000000000000000000000000000000000000000000"), // PUBLIC-CONSTANT small-order point: order 4
            hex32("0000000000000000000000000000000000000000000000000000000000000080"), // PUBLIC-CONSTANT small-order point: order 4, other sign
            hex32("c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a"), // PUBLIC-CONSTANT small-order point: order 8
            hex32("ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // PUBLIC-CONSTANT non-canonical point encoding (y >= p)
        ];

        // A canonical signature so the s<L gate passes and we actually reach the
        // key/point check (this control is about the point, not the scalar).
        let sk = SigningKey::from_bytes(&[3u8; 32]);
        let msg = b"bnr-record";
        let sig = sk.sign(msg).to_bytes();

        let mut validated_small_order = 0usize;
        for (i, enc) in encodings.iter().enumerate() {
            if let Some(pt) = CompressedEdwardsY(*enc).decompress() {
                // (a) canonical encoding — SELF-VALIDATE it is genuinely small-order.
                assert!(pt.is_small_order(), "encoding {i} is NOT small-order — bad constant");
                validated_small_order += 1;
            }
            // (b) whether small-order-canonical or non-canonical, verify_record MUST reject.
            assert_eq!(
                verify_record(enc, msg, &sig),
                Err(RecordSigError::BadSignature),
                "encoding {i} (small-order or non-canonical) was NOT rejected"
            );
        }
        assert!(validated_small_order >= 1, "control vacuous: no genuine small-order point tested");
    }

    fn hex32(s: &str) -> [u8; 32] {
        let mut out = [0u8; 32];
        for i in 0..32 {
            out[i] = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
        }
        out
    }
}
