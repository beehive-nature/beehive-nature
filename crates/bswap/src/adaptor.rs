//! ECDSA adaptor signatures over secp256k1 — the multiplicative
//! construction. This is the script-side (BTC) engine of the swap.
//!
//! **The construction (proven by the tests at the bottom of this file).**
//! With signer key `x`, message digest `z`, adaptor secret `t` and its
//! point `T = t·G`:
//!
//! - the signer picks nonce `k` and publishes the **pre-signature**
//!   `(R, R_f, r_f, s′)` where `R = k·G` (the verification point),
//!   `R_f = k·T` (the FINAL nonce — a point the signer can compute
//!   without knowing `t`), `r_f = x(R_f)`, and `s′ = k⁻¹·(z + r_f·x)`;
//! - **verify** (anyone, no secrets): `s′·R == z·G + r_f·X` where `X = x·G`;
//! - **complete** (holder of `t`): `s = s′·t⁻¹` — and `(r_f, s)` is a
//!   plain ECDSA signature, because `s·R_f = s′·t⁻¹·k·t·G = s′·R =
//!   z·G + r_f·X`. That identity is the whole soundness argument: the
//!   verify equation BECOMES the signature equation under completion;
//! - **extract** (watcher holding the pre-signature and the published
//!   final signature): `t = s′·s⁻¹`, checked against `t·G == T`.
//!
//! This is the multiplicative ECDSA adaptor shape (the
//! "one-time-verifiably-encrypted-signature" family BasicSwap rides —
//! SWAP-SORT §1 row 3). Byte-for-byte correspondence with Particl's or
//! BasicSwap's own OtVES encoding is UNVERIFIED at this seat (their repos
//! are not present here) and is not claimed; what ships is this
//! construction, test-proven in this file. Nonces are deterministic and
//! domain-separated (RFC 6979 §3.2-shaped HMAC replaced by a
//! double-SHA256 keyed derivation — RFC compliance NOT claimed).
//!
//! **Low-s law (BIP 62):** Bitcoin consensus requires the published
//! signature's `s ≤ n/2`. [`complete`] returns the low-s form; [`extract`]
//! tries both `s` and `n−s`, so extraction survives the wallet's
//! normalisation. (BIP 62 is the protocol text this follows.)

use crate::{Error, Result, SwapSecret};
use k256::ecdsa::{SigningKey, VerifyingKey};
use k256::elliptic_curve::ops::Reduce;
use k256::elliptic_curve::point::AffineCoordinates;
use k256::elliptic_curve::sec1::{FromEncodedPoint, ToEncodedPoint};
use k256::elliptic_curve::PrimeField;
use k256::{AffinePoint, EncodedPoint, FieldBytes, ProjectivePoint, Scalar};
use sha2::{Digest, Sha256};

/// secp256k1 half-order `n/2` (BE bytes) — the BIP 62 low-s bound
/// (n = FFFFFFFF…0364141, the curve's group order; the half is what a
/// low-s comparison needs).
const HALF_ORDER_BE: [u8; 32] = [
    0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0x5D, 0x57, 0x6E, 0x73, 0x57, 0xA4, 0x50, 0x1D, 0xDF, 0xE9, 0x2F, 0x46, 0x68, 0x1B, 0x20, 0xA0,
];

/// A pre-signature: the BTC-side "encrypted signature". All fields are
/// plain bytes so the artifact serialises without ceremony.
///
/// - `r_final`     — 32-byte BE x-coordinate of `R_f` (the ECDSA `r` of the
///   completed signature; refused if `≥ n` — the degenerate edge).
/// - `r_point`     — 33-byte compressed `R = k·G` (the verification point).
/// - `r_final_point` — 33-byte compressed `R_f = k·T`.
/// - `s_prime`     — 32-byte BE `s′`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreSignature {
    pub r_final: [u8; 32],
    pub r_point: [u8; 33],
    pub r_final_point: [u8; 33],
    pub s_prime: [u8; 32],
}

/// Deterministic, domain-separated nonce: RFC 6979 §3.2-shaped
/// (double-hash keyed on the secret instead of HMAC — compliance not
/// claimed). Same (key, digest, adaptor) always yields the same
/// pre-signature: reproducible, and never reuses a nonce across distinct
/// inputs.
fn deterministic_nonce(x: &Scalar, z: &Scalar, adaptor: &VerifyingKey) -> Scalar {
    let mut h = Sha256::new();
    h.update(Sha256::digest(x.to_bytes()));
    h.update(b"bswap-adaptor-v1");
    h.update(z.to_bytes());
    h.update(adaptor.to_encoded_point(true).as_bytes());
    let out: [u8; 32] = h.finalize().into();
    <Scalar as Reduce<k256::U256>>::reduce_bytes(&FieldBytes::from(out))
}

/// Reduce 32 bytes mod n (digests, derived nonces, share material).
fn scalar(bytes: &[u8; 32]) -> Scalar {
    <Scalar as Reduce<k256::U256>>::reduce_bytes(&FieldBytes::from(*bytes))
}

/// Strictly interpret 32 bytes as a canonical scalar (< n) — for
/// artifact fields that must round-trip byte-exactly (r, s).
fn scalar_strict(bytes: &[u8; 32]) -> Option<Scalar> {
    Scalar::from_repr(FieldBytes::from(*bytes)).into()
}

fn x_be(p: &AffinePoint) -> [u8; 32] {
    let mut b = [0u8; 32];
    b.copy_from_slice(&p.x());
    b
}

fn decode_point(b: &[u8]) -> Result<AffinePoint> {
    let ep = EncodedPoint::from_bytes(b).map_err(|_| Error::Malformed("point bytes"))?;
    let opt: Option<AffinePoint> = AffinePoint::from_encoded_point(&ep).into();
    opt.ok_or(Error::Malformed("point not on curve"))
}

/// The adaptor point `T = t·G` for a swap secret, as a secp256k1 verifying
/// key (compressed-point form — the shape that travels in messages).
pub fn adaptor_point(t: &SwapSecret) -> Result<VerifyingKey> {
    let p = ProjectivePoint::GENERATOR * scalar(t);
    VerifyingKey::from_encoded_point(&p.to_affine().to_encoded_point(true))
        .map_err(|_| Error::Degenerate)
}

/// Produce the pre-signature of `digest` under `sk`, encrypted to `adaptor`
/// (`T`). Refuses degenerate edges (zero nonce, `r_f ≥ n`, zero `s′`).
pub fn sign_adaptor(
    sk: &SigningKey,
    adaptor: &VerifyingKey,
    digest: &[u8; 32],
) -> Result<PreSignature> {
    let x = scalar(&sk.to_bytes().into());
    let z = scalar(digest);
    let k = deterministic_nonce(&x, &z, adaptor);
    if bool::from(k.is_zero()) {
        return Err(Error::Degenerate);
    }
    let t_pt = decode_point(adaptor.to_encoded_point(true).as_bytes())?;
    let r = ProjectivePoint::GENERATOR * k; // R = kG
    let r_f = ProjectivePoint::from(t_pt) * k; // R_f = kT
    let r_f_aff = r_f.to_affine();
    let r_f_bytes = x_be(&r_f_aff);
    if scalar_strict(&r_f_bytes).is_none() {
        // x(R_f) ≥ n: the completed r would be non-canonical (probability
        // ~2^-128) — refuse rather than deviate from ECDSA.
        return Err(Error::Degenerate);
    }
    let r_f_scalar = scalar(&r_f_bytes);
    let s_prime = k.invert().unwrap() * (z + r_f_scalar * x);
    if bool::from(s_prime.is_zero()) {
        return Err(Error::Degenerate);
    }
    Ok(PreSignature {
        r_final: r_f_bytes,
        r_point: r
            .to_affine()
            .to_encoded_point(true)
            .as_bytes()
            .try_into()
            .unwrap(),
        r_final_point: r_f_aff
            .to_encoded_point(true)
            .as_bytes()
            .try_into()
            .unwrap(),
        s_prime: s_prime.to_bytes().into(),
    })
}

/// Anyone can verify a pre-signature's internal consistency against the
/// signer's key `vk` and the digest: `s′·R == z·G + r_f·X`, with the
/// `R_f`-vs-`r_f` preimage consistency enforced.
///
/// **Adaptor-blindness (caught by this crate's own negative test):** the
/// equation holds for whatever `T` the signer happened to use — it proves
/// "completing with the discrete log of the *right* point yields a valid
/// signature", but does NOT bind which point that is. The binding lives
/// with the party that completes: the leader checks `R_f == t·R` against
/// ITS OWN secret (see [`verify_adaptor_as_completer`]). Both checks
/// together are the gate.
pub fn verify_adaptor(
    vk: &VerifyingKey,
    adaptor: &VerifyingKey,
    digest: &[u8; 32],
    pre: &PreSignature,
) -> bool {
    let Ok(x_pt) = decode_point(vk.to_encoded_point(true).as_bytes()) else {
        return false;
    };
    let Ok(t_pt) = decode_point(adaptor.to_encoded_point(true).as_bytes()) else {
        return false;
    };
    let Ok(r) = decode_point(&pre.r_point) else {
        return false;
    };
    let Ok(rf) = decode_point(&pre.r_final_point) else {
        return false;
    };
    if x_be(&rf) != pre.r_final {
        return false; // the claimed r does not commit to the claimed R_f
    }
    let z = scalar(digest);
    let sp = scalar(&pre.s_prime);
    let r_f = scalar(&pre.r_final);
    // s'·R  vs  z·G + r_f·X  (projective compare via affine normalisation)
    let lhs = ProjectivePoint::from(r) * sp;
    let rhs = ProjectivePoint::GENERATOR * z + ProjectivePoint::from(x_pt) * r_f;
    if lhs.to_affine() != rhs.to_affine() {
        return false;
    }
    // T must differ from X: an adaptor equal to the signer's own key would
    // make completion a plain signature leak (class guard, cheap to check).
    t_pt != x_pt
}

/// THE COMPLETER'S GATE (the leader, holder of `t`): the internal-
/// consistency check above AND the binding `R_f == t·R` — proof that this
/// pre-signature is encrypted to the leader's secret and no other. A
/// pre-signature encrypted to any other point is refused here.
pub fn verify_adaptor_as_completer(
    vk: &VerifyingKey,
    t: &SwapSecret,
    digest: &[u8; 32],
    pre: &PreSignature,
) -> bool {
    let ts = scalar(t);
    let adaptor = match adaptor_point(t) {
        Ok(a) => a,
        Err(_) => return false,
    };
    if !verify_adaptor(vk, &adaptor, digest, pre) {
        return false;
    }
    let Ok(r) = decode_point(&pre.r_point) else {
        return false;
    };
    let Ok(rf) = decode_point(&pre.r_final_point) else {
        return false;
    };
    // R_f ?= t·R — the lock binds to THIS completer's secret
    ProjectivePoint::from(r) * ts == ProjectivePoint::from(rf)
}

/// Holder of `t` completes: `s = s′·t⁻¹`, returned as the 64-byte
/// `r‖s` DER-free pair in LOW-s form (BIP 62). The pair verifies as a
/// plain ECDSA signature over `digest` under the signer's key.
pub fn complete(pre: &PreSignature, t: &SwapSecret) -> Result<[u8; 64]> {
    let ts = scalar(t);
    if bool::from(ts.is_zero()) {
        return Err(Error::Degenerate);
    }
    let mut s = scalar(&pre.s_prime) * ts.invert().unwrap();
    if !is_low_s(&s) {
        s = -s;
    }
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&pre.r_final);
    out[32..].copy_from_slice(&s.to_bytes());
    Ok(out)
}

/// Watcher's half: given the pre-signature and the FINAL published
/// signature (`r‖s`, either s-sign allowed — BIP 62 wallets normalise),
/// recover `t = s′·s⁻¹` and CHECK it against the expected adaptor point.
/// Returns `Error::VerifyFailed` when the final signature does not open
/// this pre-signature's lock.
pub fn extract(
    pre: &PreSignature,
    final_sig: &[u8; 64],
    expected_adaptor: &VerifyingKey,
) -> Result<SwapSecret> {
    let Ok(rf) = decode_point(&pre.r_final_point) else {
        return Err(Error::Malformed("pre R_f"));
    };
    let Ok(t_pt) = decode_point(expected_adaptor.to_encoded_point(true).as_bytes()) else {
        return Err(Error::Malformed("adaptor point"));
    };
    if x_be(&rf) != final_sig[..32] {
        return Err(Error::VerifyFailed(
            "final r does not match the pre-signature",
        ));
    }
    let sp = scalar(&pre.s_prime);
    let s = scalar(&final_sig[32..].try_into().unwrap());
    if bool::from(s.is_zero()) {
        return Err(Error::Degenerate);
    }
    let inv = s.invert().unwrap();
    // try s and n−s (low-s normalisation may have flipped the sign)
    for cand in [sp * inv, -(sp * inv)] {
        let pt = ProjectivePoint::GENERATOR * cand;
        if pt.to_affine() == t_pt {
            return Ok(cand.to_bytes().into());
        }
    }
    Err(Error::VerifyFailed(
        "extracted secret does not open the adaptor",
    ))
}

/// Independent plain-ECDSA check of a 64-byte `r‖s` over a digest
/// (implemented here so verification never depends on trait plumbing):
/// `s⁻¹·(z·G + r·X)` has x-coordinate `r`.
pub fn verify_final(vk: &VerifyingKey, digest: &[u8; 32], sig: &[u8; 64]) -> bool {
    let Ok(x_pt) = decode_point(vk.to_encoded_point(true).as_bytes()) else {
        return false;
    };
    let r = scalar(&sig[..32].try_into().unwrap());
    let s = scalar(&sig[32..].try_into().unwrap());
    if bool::from(r.is_zero()) || bool::from(s.is_zero()) {
        return false;
    }
    let z = scalar(digest);
    let w = s.invert().unwrap();
    let got = (ProjectivePoint::GENERATOR * z + ProjectivePoint::from(x_pt) * r) * w;
    x_be(&got.to_affine()) == sig[..32]
}

fn is_low_s(s: &Scalar) -> bool {
    s.to_bytes().as_slice() <= HALF_ORDER_BE.as_slice()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sk_from(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&FieldBytes::from([seed; 32])).unwrap()
    }

    fn digest_of(msg: &str) -> [u8; 32] {
        Sha256::digest(msg.as_bytes()).into()
    }

    #[test]
    fn full_round_trip() {
        // follower (BTC holder) pre-signs under T = t·G (leader's secret);
        // leader completes, plain-verifies; watcher extracts and re-derives T.
        let follower = sk_from(1);
        let vk = VerifyingKey::from(&follower);
        let t: SwapSecret = [0xAB; 32];
        let adaptor = adaptor_point(&t).unwrap();
        let z = digest_of("btc claim tx sighash (digest fixture)");

        let pre = sign_adaptor(&follower, &adaptor, &z).unwrap();
        assert!(
            verify_adaptor(&vk, &adaptor, &z, &pre),
            "pre-signature must verify"
        );

        let fin = complete(&pre, &t).unwrap();
        assert!(
            verify_final(&vk, &z, &fin),
            "completed sig must be plain-valid ECDSA"
        );

        let got = extract(&pre, &fin, &adaptor).expect("extraction must open the lock");
        assert_eq!(got, t, "extracted secret must equal the adaptor secret");
    }

    #[test]
    fn determinism() {
        let sk = sk_from(2);
        let t: SwapSecret = [9u8; 32];
        let a = adaptor_point(&t).unwrap();
        let z = digest_of("same");
        assert_eq!(
            sign_adaptor(&sk, &a, &z).unwrap(),
            sign_adaptor(&sk, &a, &z).unwrap()
        );
        // a different digest must move the nonce
        assert_ne!(
            sign_adaptor(&sk, &a, &z).unwrap(),
            sign_adaptor(&sk, &a, &digest_of("other")).unwrap()
        );
    }

    #[test]
    fn negatives() {
        let sk = sk_from(3);
        let vk = VerifyingKey::from(&sk);
        let t: SwapSecret = [0x11; 32];
        let adaptor = adaptor_point(&t).unwrap();
        let z = digest_of("msg");

        let pre = sign_adaptor(&sk, &adaptor, &z).unwrap();
        // wrong digest
        assert!(!verify_adaptor(&vk, &adaptor, &digest_of("other"), &pre));
        // wrong signer key
        assert!(!verify_adaptor(
            &VerifyingKey::from(&sk_from(4)),
            &adaptor,
            &z,
            &pre
        ));
        // tampered s'
        let mut bad = pre.clone();
        bad.s_prime[0] ^= 1;
        assert!(!verify_adaptor(&vk, &adaptor, &z, &bad));
        // tampered r_final (preimage consistency)
        let mut bad2 = pre.clone();
        bad2.r_final[31] ^= 1;
        assert!(!verify_adaptor(&vk, &adaptor, &z, &bad2));

        // ADAPTOR-BLINDNESS (documented on verify_adaptor): the equation
        // passes for the wrong T — third-party consistency is not binding.
        let wrong_adaptor = adaptor_point(&[0x22; 32]).unwrap();
        assert!(verify_adaptor(&vk, &wrong_adaptor, &z, &pre));
        // ...but the COMPLETER'S gate refuses it: R_f != t·R for the
        // leader's own t when the pre-sig was encrypted to another point.
        assert!(verify_adaptor_as_completer(&vk, &t, &z, &pre));
        let other_pre = sign_adaptor(&sk, &wrong_adaptor, &z).unwrap();
        assert!(
            !verify_adaptor_as_completer(&vk, &t, &z, &other_pre),
            "a pre-signature encrypted to another point must fail the completer's gate"
        );

        // completion with the WRONG secret does not even produce a valid
        // signature (the algebra closes only over the true t) — and it
        // certainly does not open extraction. Both refusals are the
        // atomicity fence:
        let wrong_fin = complete(&pre, &[0x33; 32]).unwrap();
        assert!(!verify_final(&vk, &z, &wrong_fin));
        assert!(extract(&pre, &wrong_fin, &adaptor).is_err());
    }

    #[test]
    fn low_s_extraction_survives_normalisation() {
        // flip the completed s (as a BIP62-normalising wallet might have)
        // and confirm the watcher still extracts t.
        let sk = sk_from(5);
        let vk = VerifyingKey::from(&sk);
        let t: SwapSecret = [0x5A; 32];
        let adaptor = adaptor_point(&t).unwrap();
        let z = digest_of("normalisation fixture");
        let pre = sign_adaptor(&sk, &adaptor, &z).unwrap();
        let fin = complete(&pre, &t).unwrap();
        let mut flipped = fin;
        let s = scalar(&flipped[32..].try_into().unwrap());
        flipped[32..].copy_from_slice(&(-s).to_bytes());
        let got = extract(&pre, &flipped, &adaptor).expect("must extract across the sign flip");
        assert_eq!(got, t);
    }

    #[test]
    fn adaptor_nequals_signer_guard() {
        // T == X would let the signer complete its own "encryption" — the
        // verifier refuses that shape outright.
        let sk = sk_from(6);
        let vk = VerifyingKey::from(&sk);
        let t_bytes: SwapSecret = sk.to_bytes().into();
        let self_adaptor = adaptor_point(&t_bytes).unwrap();
        let z = digest_of("guard");
        let pre = sign_adaptor(&sk, &self_adaptor, &z).unwrap();
        assert!(!verify_adaptor(&vk, &self_adaptor, &z, &pre));
    }
}
