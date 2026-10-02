//! Each test names the attack or misuse it rejects. The envelope exists to
//! keep a private copy of a signed receipt confidential and bound to its
//! context; a test that passes while either property is gone is wrong.

use bnr_seal::{open, seal, OpenError, Scope, SealKey, Suite, ENVELOPE_VERSION};

const RECEIPT: &[u8] = b"canonical-receipt-bytes||issuer-signature";
const SCOPE_A: Scope = Scope([0xA1; 32]);
const SCOPE_B: Scope = Scope([0xB2; 32]);

// Offsets from the version-1 wire format in the crate docs.
const SCOPE_AT: usize = 2;
const NONCE_AT: usize = 34;
const BODY_AT: usize = 58;
const TAG_LEN: usize = 16;

fn key(byte: u8) -> SealKey {
    SealKey::from_bytes([byte; 32])
}

#[test]
fn round_trip_returns_the_signed_bytes_and_hides_them_at_rest() {
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    assert_eq!(&open(&key(7), &SCOPE_A, &envelope).unwrap()[..], RECEIPT);
    assert!(
        !envelope.windows(RECEIPT.len()).any(|w| w == RECEIPT),
        "the stored envelope must not carry the receipt in the clear"
    );
}

#[test]
fn wire_format_header_is_stable() {
    // Stored envelopes outlive this code; the layout is a contract.
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    assert_eq!(envelope.len(), BODY_AT + RECEIPT.len() + TAG_LEN);
    assert_eq!(envelope[0], ENVELOPE_VERSION);
    assert_eq!(envelope[1], Suite::XChaCha20Poly1305.id());
    assert_eq!(&envelope[SCOPE_AT..NONCE_AT], &SCOPE_A.0);
}

#[test]
fn tampered_ciphertext_is_rejected() {
    let mut envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    envelope[BODY_AT] ^= 0x01;
    assert_eq!(
        open(&key(7), &SCOPE_A, &envelope),
        Err(OpenError::Authentication)
    );
}

#[test]
fn tampered_tag_is_rejected() {
    let mut envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    let last = envelope.len() - 1;
    envelope[last] ^= 0x80;
    assert_eq!(
        open(&key(7), &SCOPE_A, &envelope),
        Err(OpenError::Authentication)
    );
}

#[test]
fn tampered_nonce_is_rejected() {
    let mut envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    envelope[NONCE_AT] ^= 0x01;
    assert_eq!(
        open(&key(7), &SCOPE_A, &envelope),
        Err(OpenError::Authentication)
    );
}

#[test]
fn relabelled_scope_is_rejected_by_authentication() {
    // An attacker rewrites the readable scope so a receipt sealed for object A
    // is presented as belonging to object B. The header check alone would
    // accept it; the associated-data binding must not.
    let mut envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    envelope[SCOPE_AT..NONCE_AT].copy_from_slice(&SCOPE_B.0);
    assert_eq!(
        open(&key(7), &SCOPE_B, &envelope),
        Err(OpenError::Authentication)
    );
}

#[test]
fn envelope_for_another_scope_is_refused_before_decryption() {
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    assert_eq!(
        open(&key(7), &SCOPE_B, &envelope),
        Err(OpenError::ScopeMismatch)
    );
}

#[test]
fn wrong_key_is_rejected() {
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    assert_eq!(
        open(&key(8), &SCOPE_A, &envelope),
        Err(OpenError::Authentication)
    );
}

#[test]
fn malformed_envelopes_are_rejected_without_panicking() {
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    for len in [0, 1, BODY_AT - 1, BODY_AT, BODY_AT + TAG_LEN - 1] {
        assert_eq!(
            open(&key(7), &SCOPE_A, &envelope[..len]),
            Err(OpenError::Truncated),
            "length {len}"
        );
    }
    // Dropping plaintext bytes (keeping the length plausible) is tampering.
    let mut shortened = envelope.clone();
    shortened.remove(BODY_AT);
    assert_eq!(
        open(&key(7), &SCOPE_A, &shortened),
        Err(OpenError::Authentication)
    );
}

#[test]
fn unknown_version_and_suite_are_rejected_not_guessed() {
    // Crypto-agility law: an unrecognised identifier is refused outright.
    let envelope = seal(&key(7), &SCOPE_A, RECEIPT).unwrap();
    let mut future = envelope.clone();
    future[0] = ENVELOPE_VERSION + 1;
    assert_eq!(
        open(&key(7), &SCOPE_A, &future),
        Err(OpenError::UnsupportedVersion(ENVELOPE_VERSION + 1))
    );
    let mut unknown_suite = envelope;
    unknown_suite[1] = 0xEE;
    assert_eq!(
        open(&key(7), &SCOPE_A, &unknown_suite),
        Err(OpenError::UnsupportedSuite(0xEE))
    );
}

#[test]
fn empty_payload_still_authenticates() {
    let envelope = seal(&key(7), &SCOPE_A, b"").unwrap();
    assert_eq!(envelope.len(), BODY_AT + TAG_LEN);
    assert!(open(&key(7), &SCOPE_A, &envelope).unwrap().is_empty());
}

#[test]
fn concurrent_seals_under_one_key_never_share_a_nonce() {
    // Nonce reuse under one key breaks confidentiality and integrity. Jobs
    // seal concurrently and across restarts with no shared counter, so each
    // seal must draw its own nonce. A fixed or per-process nonce fails here.
    let key = std::sync::Arc::new(key(7));
    let handles: Vec<_> = (0..8)
        .map(|_| {
            let key = key.clone();
            std::thread::spawn(move || {
                (0..64)
                    .map(|_| {
                        let envelope = seal(&key, &SCOPE_A, RECEIPT).unwrap();
                        envelope[NONCE_AT..BODY_AT].to_vec()
                    })
                    .collect::<Vec<_>>()
            })
        })
        .collect();
    let mut nonces = std::collections::HashSet::new();
    for handle in handles {
        for nonce in handle.join().unwrap() {
            assert!(nonces.insert(nonce), "nonce reused under one key");
        }
    }
    assert_eq!(nonces.len(), 8 * 64);
}

#[test]
fn key_debug_output_never_contains_key_material() {
    assert_eq!(format!("{:?}", key(0x5A)), "SealKey(<redacted>)");
}

#[test]
fn generated_keys_differ_and_are_usable() {
    let (a, b) = (SealKey::generate().unwrap(), SealKey::generate().unwrap());
    let envelope = seal(&a, &SCOPE_A, RECEIPT).unwrap();
    assert_eq!(&open(&a, &SCOPE_A, &envelope).unwrap()[..], RECEIPT);
    assert_eq!(
        open(&b, &SCOPE_A, &envelope),
        Err(OpenError::Authentication)
    );
}
