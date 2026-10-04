//! Record-signature verification for bzDiD records, dispatched on `keyAlg`.
//!
//! `did-autonomi-spec` §5 makes `keyAlg` mandatory on every op; §7 lets a `rotate`
//! op move `ed25519 → ml-dsa-65`, and requires resolvers to dispatch verification on
//! `keyAlg` and to REJECT an algorithm they cannot verify rather than skip it.
//! [`verify_record_alg`] is that dispatch: `"ed25519"` goes to [`verify_record`]
//! unchanged, `"ml-dsa-65"` to ML-DSA-65, and every other id is refused with
//! [`RecordSigError::UnknownKeyAlg`] before a single key or signature byte is read.
//! Ids are matched exactly: no case folding, no trimming, no aliases.
//!
//! ED25519 (`keyAlg = "ed25519"`, the original layer; [`verify_record`] is unchanged).
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
//!     rejects small-order R and A). SUPERSEDED-WITH-RECEIPT (the honest history stays):
//!     the earlier exclusion-why — "a divergence control needs a small-subgroup forgery;
//!     the Fiat-Shamir challenge k=H(R‖A‖m) binds R so naive R+T does not reproduce it" —
//!     was honest on the information in hand. goose then located the published vectors, so
//!     the divergence is now a GENUINE control in `tests/speccheck.rs`: ed25519-speccheck
//!     vectors 0/1/2/11 (small-order A/R) where cofactored `verify` ACCEPTS and
//!     `verify_record` (strict) REJECTS. 8x: both sides evidenced, not just our rejection.
//!   * batch verification — EXCLUDED: no batch-verify construction exists to test;
//!     `verify_record` is single-signature only.
//!
//! ML-DSA-65 (`keyAlg = "ml-dsa-65"`, added 2026-10-04). The same crate, version and
//! calls the estate already signs and verifies with (`crates/bsigner/src/pq.rs`,
//! `crates/bsigner/src/bpq.rs`); claims cited against `ml-dsa` 0.1.1 as Cargo.lock pins it:
//!   * FIPS 204 — README.md: "Pure Rust implementation of the Module-Lattice-Based
//!     Digital Signature Standard (ML-DSA) as described in the [FIPS 204] (final)."
//!     `MlDsa65` is the security-category-3 set: src/lib.rs:217-222.
//!   * sizes — public key 1952 B, signature 3309 B (c̃ 48 ‖ z 3200 ‖ hint 55+6, src/lib.rs:225-233,
//!     src/param.rs:402-403), checked here BEFORE decoding and cross-validated in tests
//!     against the crate's own encoder, as `L_LE` is against curve25519-dalek.
//!   * key decode — `VerifyingKey::decode` (pkDecode, FIPS 204 Alg. 23), src/verifying.rs:165;
//!     total on a 1952-byte input.
//!   * signature decode — `Signature::try_from(&[u8])`, src/lib.rs:130-136, into `decode`
//!     (sigDecode, Alg. 27) src/lib.rs:115-127: refuses ‖z‖∞ ≥ γ1−β (lib.rs:122) and a
//!     malformed hint (src/hint.rs:136-141: counts not monotonic, a count past ω, or a
//!     non-zero byte in the unused index padding).
//!   * verify — `verify_with_context(msg, &[], sig)`, src/verifying.rs:131-147 (Alg. 3
//!     ML-DSA.Verify), with the EMPTY context written out here rather than inherited.
//!     It is the context `Signer::try_sign` signs with (src/signing.rs:181-184, the
//!     deterministic variant) and `Verifier::verify` checks with (src/verifying.rs:194-205),
//!     which is what bsigner's `dsa_sign` / `dsa_verify` use.
//!   * WARNING, verbatim from the README: "The implementation contained in this crate
//!     has never been independently audited!" NIST ACVP known-answer vectors are not run
//!     here: UNVERIFIED. What the tests do show: a signature made by a second, independent
//!     implementation (@noble/post-quantum 0.7.1, the SPEC-BPQ-1 card in
//!     `surfaces/bpq-vectors.json`) verifies through this dispatch, and one flipped bit
//!     does not.
//!   * Encoding strictness on this path is the LIBRARY's (hint.rs:136-141), not an explicit
//!     check of this module: R1b is ruled for the ed25519 scalar only. The control
//!     `ml_dsa_65_hint_padding_malleation_is_rejected` pins it, so a library change that
//!     loosened it fails CI. Whether ml-dsa-65 needs its own explicit R1b-style check is
//!     named here, not ruled.

use ed25519_dalek::{Signature, VerifyingKey};
use ml_dsa::{EncodedVerifyingKey, MlDsa65};

/// Ed25519 group order `L = 2^252 + 27742317777372353535851937790883648493`,
/// little-endian, 32 bytes. A signature scalar `s` is canonical iff `s < L`.
/// Cross-validated against curve25519-dalek's own canonical boundary in tests.
const L_LE: [u8; 32] = [
    0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10,
];

/// ML-DSA-65 encoded public-key length: ρ (32) ‖ t1 (6 × 320). Cross-validated in
/// tests against `ml-dsa` 0.1.1's own `VerifyingKey::encode` (src/verifying.rs:158).
const ML_DSA_65_PUBLIC_KEY_LEN: usize = 1952;
/// ML-DSA-65 encoded signature length: c̃ (48) ‖ z (5 × 640) ‖ hint (ω 55 + K 6).
/// Cross-validated in tests against `Signature::encode` (src/lib.rs:106).
const ML_DSA_65_SIGNATURE_LEN: usize = 3309;

#[derive(Debug, PartialEq, Eq)]
pub enum RecordSigError {
    /// Signature length was not the one the key algorithm fixes: 64 bytes
    /// (R || s) for ed25519, 3309 for ml-dsa-65.
    BadLength(usize),
    /// Public-key length was not the one the named `keyAlg` fixes: 32 bytes for
    /// ed25519, 1952 for ml-dsa-65. This is where a key of one algorithm offered
    /// under the other's id is refused.
    BadKeyLength(usize),
    /// `keyAlg` names an algorithm this resolver cannot verify. Refused, never
    /// skipped (`did-autonomi-spec` §7). Carries the id exactly as given.
    UnknownKeyAlg(String),
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
    vk.verify_strict(msg, &sig)
        .map_err(|_| RecordSigError::BadSignature)
}

/// The record-signature algorithms a bzDiD op may name in `keyAlg` that this
/// resolver can verify. There is deliberately no catch-all variant: an id that
/// does not parse to one of these is refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyAlg {
    /// `"ed25519"`: [`verify_record`] (explicit R1b, then `verify_strict`).
    Ed25519,
    /// `"ml-dsa-65"`: FIPS 204 ML-DSA-65, empty context.
    MlDsa65,
}

impl KeyAlg {
    /// Parse a `keyAlg` id exactly as written (lowercase, no trimming, no aliases).
    pub fn parse(id: &str) -> Result<Self, RecordSigError> {
        match id {
            "ed25519" => Ok(KeyAlg::Ed25519),
            "ml-dsa-65" => Ok(KeyAlg::MlDsa65),
            other => Err(RecordSigError::UnknownKeyAlg(other.to_string())),
        }
    }
}

/// Verify a record signature under `key_alg`, the algorithm of the SIGNING key.
///
/// Which `keyAlg` that is follows did-autonomi-spec §5-§7: an entry's `keyAlg` names
/// the algorithm of `authKeys` in THAT entry's state, and its `sig` is made by a key
/// valid in the PREVIOUS state. So pass the entry's own `keyAlg` only for genesis
/// (seq 0, self-signed with `authKeys[0]`); for seq n > 0 pass the `keyAlg` of
/// state n-1. A rotate op that moves ed25519 -> ml-dsa-65 is therefore verified
/// as ed25519, by the old key, and every op after it as ml-dsa-65.
///
/// The id is parsed FIRST, so an unknown algorithm is refused whatever the bytes
/// are. Then the public-key length must be the one that algorithm fixes, so a key
/// of one algorithm offered under the other's id is refused as
/// [`RecordSigError::BadKeyLength`] and never reinterpreted. `"ed25519"` then
/// runs [`verify_record`] byte for byte as before.
pub fn verify_record_alg(
    key_alg: &str,
    pubkey: &[u8],
    msg: &[u8],
    sig: &[u8],
) -> Result<(), RecordSigError> {
    match KeyAlg::parse(key_alg)? {
        KeyAlg::Ed25519 => {
            let pk: &[u8; 32] = pubkey
                .try_into()
                .map_err(|_| RecordSigError::BadKeyLength(pubkey.len()))?;
            verify_record(pk, msg, sig)
        }
        KeyAlg::MlDsa65 => verify_ml_dsa_65(pubkey, msg, sig),
    }
}

/// ML-DSA-65 (FIPS 204 Alg. 3, empty context). Calls cited in the module header.
fn verify_ml_dsa_65(pubkey: &[u8], msg: &[u8], sig: &[u8]) -> Result<(), RecordSigError> {
    if pubkey.len() != ML_DSA_65_PUBLIC_KEY_LEN {
        return Err(RecordSigError::BadKeyLength(pubkey.len()));
    }
    if sig.len() != ML_DSA_65_SIGNATURE_LEN {
        return Err(RecordSigError::BadLength(sig.len()));
    }
    let enc = EncodedVerifyingKey::<MlDsa65>::try_from(pubkey)
        .map_err(|_| RecordSigError::BadKeyLength(pubkey.len()))?;
    let vk = ml_dsa::VerifyingKey::<MlDsa65>::decode(&enc); // verifying.rs:165
    let sig = ml_dsa::Signature::<MlDsa65>::try_from(sig) // lib.rs:130-136, sigDecode
        .map_err(|_| RecordSigError::BadSignature)?;
    // verifying.rs:131, Alg. 3 ML-DSA.Verify, the empty context written out.
    if vk.verify_with_context(msg, &[], &sig) {
        Ok(())
    } else {
        Err(RecordSigError::BadSignature)
    }
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
        assert_eq!(
            verify_record(&vk, msg, &mal),
            Err(RecordSigError::NonCanonicalS)
        );
    }

    /// Cross-validate the hand-written L_LE against the library's own canonical
    /// boundary, so a mistyped constant cannot silently weaken the check: L is
    /// non-canonical; L-1 is canonical; s_lt_l agrees at both.
    #[test]
    fn l_constant_matches_dalek_boundary() {
        assert!(bool::from(Scalar::from_canonical_bytes(L_LE).is_none()));
        let mut l_minus_1 = L_LE;
        l_minus_1[0] -= 1;
        assert!(bool::from(
            Scalar::from_canonical_bytes(l_minus_1).is_some()
        ));
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
                assert!(
                    pt.is_small_order(),
                    "encoding {i} is NOT small-order — bad constant"
                );
                validated_small_order += 1;
            }
            // (b) whether small-order-canonical or non-canonical, verify_record MUST reject.
            assert_eq!(
                verify_record(enc, msg, &sig),
                Err(RecordSigError::BadSignature),
                "encoding {i} (small-order or non-canonical) was NOT rejected"
            );
        }
        assert!(
            validated_small_order >= 1,
            "control vacuous: no genuine small-order point tested"
        );
    }

    fn hex32(s: &str) -> [u8; 32] {
        let mut out = [0u8; 32];
        for i in 0..32 {
            out[i] = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
        }
        out
    }

    // ---- keyAlg dispatch + ML-DSA-65 (2026-10-04) ------------------------------------

    use ml_dsa::{Keypair as _, Signer as _};
    use sha2::{Digest, Sha256};

    /// ML-DSA-65 ω (hint index slots) and K (hint count bytes): src/lib.rs:233, :225.
    const ML_DSA_65_OMEGA: usize = 55;
    const ML_DSA_65_K: usize = 6;

    /// A TEST key: the seed is SHA-256 of a public sentence, so it guards nothing.
    fn ml_dsa_65_test_key() -> ml_dsa::SigningKey<MlDsa65> {
        let seed: [u8; 32] =
            Sha256::digest(b"atmirror record_sig ml-dsa-65 test seed, public, guards nothing")
                .into();
        ml_dsa::SigningKey::<MlDsa65>::from_seed(&seed.into()) // signing.rs:55
    }

    /// (public key, signature) for `msg` under the test key, as raw encoded bytes.
    fn ml_dsa_65_sign(msg: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let sk = ml_dsa_65_test_key();
        let vk = sk.verifying_key().encode().to_vec(); // verifying.rs:158
        let sig = sk.try_sign(msg).unwrap().encode().to_vec(); // signing.rs:184, lib.rs:106
        (vk, sig)
    }

    /// (public key, signature) for `msg` under the ed25519 test key used above.
    fn ed25519_sign(msg: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        (
            sk.verifying_key().to_bytes().to_vec(),
            sk.sign(msg).to_bytes().to_vec(),
        )
    }

    #[test]
    fn key_alg_parses_exactly_the_two_ids() {
        assert_eq!(KeyAlg::parse("ed25519"), Ok(KeyAlg::Ed25519));
        assert_eq!(KeyAlg::parse("ml-dsa-65"), Ok(KeyAlg::MlDsa65));
    }

    /// The hand-written sizes must equal what the crate itself encodes, so a
    /// mistyped constant cannot silently refuse (or admit) the wrong lengths.
    #[test]
    fn ml_dsa_65_lengths_match_the_crate_encoder() {
        let (vk, sig) = ml_dsa_65_sign(b"bnr-record");
        assert_eq!(vk.len(), ML_DSA_65_PUBLIC_KEY_LEN);
        assert_eq!(sig.len(), ML_DSA_65_SIGNATURE_LEN);
    }

    /// The dispatch adds nothing and removes nothing on the ed25519 path: a canonical
    /// signature verifies, and the R1b `s + L` malleation is still refused on the
    /// explicit scalar rule, exactly as `verify_record` refuses it.
    #[test]
    fn ed25519_dispatch_is_verify_record() {
        let msg = b"bnr-record";
        let (vk, sig) = ed25519_sign(msg);
        let vk32: [u8; 32] = vk.clone().try_into().unwrap();
        assert_eq!(verify_record_alg("ed25519", &vk, msg, &sig), Ok(()));

        let mut s = [0u8; 32];
        s.copy_from_slice(&sig[32..64]);
        let mut mal = sig.clone();
        mal[32..64].copy_from_slice(&add_l(&s));
        assert_eq!(
            verify_record_alg("ed25519", &vk, msg, &mal),
            Err(RecordSigError::NonCanonicalS)
        );
        assert_eq!(
            verify_record_alg("ed25519", &vk, msg, &mal),
            verify_record(&vk32, msg, &mal)
        );
    }

    /// Roundtrip from a seed derived from a public string. Signing is the deterministic,
    /// empty-context variant (signing.rs:181-184), so the same key and message give the
    /// same bytes twice. Tampering with the message or the signature is refused.
    #[test]
    fn ml_dsa_65_roundtrip_from_public_seed() {
        let msg = b"bnr-record";
        let (vk, sig) = ml_dsa_65_sign(msg);
        assert_eq!(verify_record_alg("ml-dsa-65", &vk, msg, &sig), Ok(()));

        let (vk2, sig2) = ml_dsa_65_sign(msg);
        assert_eq!(
            (vk2, sig2),
            (vk.clone(), sig.clone()),
            "deterministic signing"
        );

        assert_eq!(
            verify_record_alg("ml-dsa-65", &vk, b"bnr-recorD", &sig),
            Err(RecordSigError::BadSignature)
        );
        let mut bad = sig.clone();
        bad[0] ^= 0x01; // inside c̃: decodes, then fails the challenge comparison
        assert_eq!(
            verify_record_alg("ml-dsa-65", &vk, msg, &bad),
            Err(RecordSigError::BadSignature)
        );
        assert_eq!(
            verify_record_alg("ml-dsa-65", &vk, msg, &sig[..3308]),
            Err(RecordSigError::BadLength(3308))
        );
        assert_eq!(
            verify_record_alg("ml-dsa-65", &vk[..1951], msg, &sig),
            Err(RecordSigError::BadKeyLength(1951))
        );
    }

    /// FOREIGN-ORACLE control: a signature this crate did not make. The SPEC-BPQ-1 card in
    /// `surfaces/bpq-vectors.json` is signed by @noble/post-quantum 0.7.1 (ML-DSA-65 over
    /// "bpq1/card" ‖ dsa ‖ kem ‖ succ, SPEC-BPQ-1 §3). It must verify through the keyAlg
    /// dispatch, and one flipped message bit must not.
    #[test]
    fn ml_dsa_65_verifies_the_noble_bpq_card() {
        use base64::Engine;
        const BPQ_VECTORS: &str = include_str!("../../../surfaces/bpq-vectors.json");
        let v: serde_json::Value = serde_json::from_str(BPQ_VECTORS).unwrap();
        let b64 = |k: &str| {
            base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(v["card"][k].as_str().unwrap())
                .unwrap()
        };
        let (dsa, kem, succ, sig) = (b64("dsa"), b64("kem"), b64("succ"), b64("sig"));
        let msg = [b"bpq1/card".as_slice(), &dsa, &kem, &succ].concat();

        assert_eq!(verify_record_alg("ml-dsa-65", &dsa, &msg, &sig), Ok(()));

        let mut bad = msg.clone();
        let last = bad.len() - 1;
        bad[last] ^= 0x01;
        assert_eq!(
            verify_record_alg("ml-dsa-65", &dsa, &bad, &sig),
            Err(RecordSigError::BadSignature)
        );
    }

    /// Cross-algorithm confusion. Each pair first verifies under its OWN id (so the
    /// refusals below are not a broken pair), then is refused under the other's id:
    /// the key length of the named algorithm is enforced, nothing is reinterpreted.
    #[test]
    fn cross_alg_confusion_is_refused() {
        let msg = b"bnr-record";
        let (ed_vk, ed_sig) = ed25519_sign(msg);
        let (ml_vk, ml_sig) = ml_dsa_65_sign(msg);
        assert_eq!(verify_record_alg("ed25519", &ed_vk, msg, &ed_sig), Ok(()));
        assert_eq!(verify_record_alg("ml-dsa-65", &ml_vk, msg, &ml_sig), Ok(()));

        // An ed25519 key and signature labelled ml-dsa-65, and the reverse.
        assert_eq!(
            verify_record_alg("ml-dsa-65", &ed_vk, msg, &ed_sig),
            Err(RecordSigError::BadKeyLength(32))
        );
        assert_eq!(
            verify_record_alg("ed25519", &ml_vk, msg, &ml_sig),
            Err(RecordSigError::BadKeyLength(1952))
        );
        // Right key for the id, the other algorithm's signature.
        assert_eq!(
            verify_record_alg("ml-dsa-65", &ml_vk, msg, &ed_sig),
            Err(RecordSigError::BadLength(64))
        );
        assert_eq!(
            verify_record_alg("ed25519", &ed_vk, msg, &ml_sig),
            Err(RecordSigError::BadLength(3309))
        );
    }

    /// Unknown `keyAlg` is refused, never skipped and never guessed (spec §7). Each id is
    /// tried with BOTH genuine pairs, which verify under their real ids, so the refusal
    /// is on the id alone. The list includes real algorithms this resolver does not
    /// verify for records (ml-dsa-44/87, p256, es256k, slh-dsa) and near-miss spellings.
    #[test]
    fn unknown_key_alg_is_refused() {
        let msg = b"bnr-record";
        let (ed_vk, ed_sig) = ed25519_sign(msg);
        let (ml_vk, ml_sig) = ml_dsa_65_sign(msg);
        assert_eq!(verify_record_alg("ed25519", &ed_vk, msg, &ed_sig), Ok(()));
        assert_eq!(verify_record_alg("ml-dsa-65", &ml_vk, msg, &ml_sig), Ok(()));

        let unknown = [
            "",
            "Ed25519",
            "ED25519",
            " ed25519",
            "ed25519 ",
            "ed25519\0",
            "ML-DSA-65",
            "ml-dsa-65 ",
            "mldsa65",
            "ml_dsa_65",
            "ml-dsa-44",
            "ml-dsa-87",
            "p256",
            "es256k",
            "slh-dsa-shake-256f",
        ];
        for id in unknown {
            for (vk, sig) in [(&ed_vk, &ed_sig), (&ml_vk, &ml_sig)] {
                assert_eq!(
                    verify_record_alg(id, vk, msg, sig),
                    Err(RecordSigError::UnknownKeyAlg(id.to_string())),
                    "keyAlg {id:?} was not refused"
                );
            }
        }
    }

    /// GENUINE control, the ML-DSA counterpart of the `s + L` control. The hint's unused
    /// index slots are padding that `ml-dsa` 0.1.1 requires to be zero (hint.rs:138;
    /// that FIPS 204 itself mandates it is not checked here: UNVERIFIED). A decoder that
    /// ignored them would read the SAME c̃, z, live hint indices and counts from the
    /// malleated bytes, rebuild the identical signature and accept it: a second encoding
    /// of one signature. `ml-dsa` 0.1.1 refuses it at hint.rs:136-141; this pins that.
    /// Self-checking: it fails if the signature has no padding to malleate (vacuous) or if
    /// the malleated bytes stop being refused.
    #[test]
    fn ml_dsa_65_hint_padding_malleation_is_rejected() {
        let msg = b"bnr-record";
        let (vk, sig) = ml_dsa_65_sign(msg);
        let hint = ML_DSA_65_SIGNATURE_LEN - (ML_DSA_65_OMEGA + ML_DSA_65_K);
        let counts = hint + ML_DSA_65_OMEGA;
        let used = sig[counts + ML_DSA_65_K - 1] as usize; // total live hint indices

        // (1) there IS padding, and the honest encoding has it all zero.
        assert!(
            used < ML_DSA_65_OMEGA,
            "control vacuous: hint uses every slot"
        );
        assert!(sig[hint + used..counts].iter().all(|&b| b == 0));

        // (2) malleate the last padding slot; every byte a padding-blind decoder reads
        //     (c̃, z, the `used` live indices, the K counts) is unchanged.
        let mut mal = sig.clone();
        mal[counts - 1] = 0x01;
        assert_ne!(mal, sig);
        assert_eq!(mal[..hint + used], sig[..hint + used]);
        assert_eq!(mal[counts..], sig[counts..]);

        // (3) the honest encoding verifies; the second encoding is refused.
        assert_eq!(verify_record_alg("ml-dsa-65", &vk, msg, &sig), Ok(()));
        assert_eq!(
            verify_record_alg("ml-dsa-65", &vk, msg, &mal),
            Err(RecordSigError::BadSignature)
        );
    }
}
