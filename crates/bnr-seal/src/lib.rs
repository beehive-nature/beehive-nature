//! # bnr-seal — private storage envelope for signed receipts
//!
//! Encrypts bytes that are **already** a signed receipt (or other sensitive
//! evidence) for private storage, and binds that ciphertext to a minimal,
//! versioned context. The layering is fixed:
//!
//! ```text
//! canonical receipt bytes → issuer signature → bnr-seal envelope (this crate)
//! ```
//!
//! ## What an opened envelope does and does not establish
//!
//! A successful [`open`] authenticates only that someone holding the same
//! symmetric [`SealKey`] produced these bytes for this scope, and that
//! nothing was altered since. That is sound by construction relative to the
//! shared key, and no stronger. It does **not** establish who issued the
//! receipt, whether their delegation is valid, whether the work happened, or
//! whether this is a replay. AEAD authentication is relative to a shared key
//! by construction. Callers verify the issuer's signature on the opened bytes
//! and leave authority, scope, expiry and replay decisions to BNRoSe.
//!
//! ## Wire format (version 1)
//!
//! ```text
//! offset  len  field
//! 0       1    envelope version            (1)
//! 1       1    suite id                    (1 = xchacha20poly1305)
//! 2       32   scope                       (opaque, caller-derived)
//! 34      24   nonce                       (fresh random per seal)
//! 58      n+16 ciphertext || Poly1305 tag
//! ```
//!
//! The associated data is `DOMAIN || envelope[0..34]`, so the version, suite
//! and scope are authenticated. They are **not** encrypted: anyone holding the
//! envelope can read them. The scope must therefore be an opaque value, such
//! as a keyed hash of the object id. Never put a raw actor id, device id or
//! transaction detail in it.
//!
//! ## Nonce lifecycle
//!
//! Every seal draws a fresh 192-bit nonce from the OS RNG
//! (`OsRng.try_fill_bytes` in [`seal`]; an RNG failure is [`SealError::Rng`],
//! never a panic). There is no
//! counter, so no state has to survive restarts or be shared between
//! concurrent jobs. The extended nonce is the reason for this suite: random
//! nonces are sound for it by design, where a 96-bit nonce would need
//! coordination. Key rotation and key custody are the caller's concern.

#![forbid(unsafe_code)]

use chacha20poly1305::aead::rand_core::RngCore;
use chacha20poly1305::aead::{Aead, KeyInit, OsRng, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use zeroize::{Zeroize, Zeroizing};

/// The only envelope version this crate reads or writes.
pub const ENVELOPE_VERSION: u8 = 1;

/// Domain separation for the associated data, so an envelope header can never
/// authenticate as some other protocol's AAD under the same key.
const DOMAIN: &[u8] = b"bnr-seal/receipt/v1\0";

const SCOPE_LEN: usize = 32;
const NONCE_LEN: usize = 24;
const TAG_LEN: usize = 16;
const AUTHENTICATED_HEADER_LEN: usize = 2 + SCOPE_LEN;
const HEADER_LEN: usize = AUTHENTICATED_HEADER_LEN + NONCE_LEN;

/// Allowlisted AEAD suites. Crypto-agility law: every envelope names its
/// algorithm, and an unknown id is rejected rather than guessed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Suite {
    XChaCha20Poly1305,
}

impl Suite {
    /// Wire identifier.
    pub fn id(self) -> u8 {
        match self {
            Suite::XChaCha20Poly1305 => 1,
        }
    }

    /// Human-readable algorithm identifier.
    pub fn as_str(self) -> &'static str {
        match self {
            Suite::XChaCha20Poly1305 => "xchacha20poly1305",
        }
    }

    fn from_id(id: u8) -> Option<Self> {
        match id {
            1 => Some(Suite::XChaCha20Poly1305),
            _ => None,
        }
    }
}

/// 256-bit symmetric key. Zeroized on drop; its bytes are never printed.
pub struct SealKey([u8; 32]);

impl SealKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        SealKey(bytes)
    }

    /// A fresh key from the OS RNG. An unavailable RNG is
    /// [`SealError::Rng`], never a panic.
    pub fn generate() -> Result<Self, SealError> {
        let mut key = SealKey([0u8; 32]);
        OsRng
            .try_fill_bytes(&mut key.0)
            .map_err(|_| SealError::Rng)?;
        Ok(key)
    }

    fn cipher(&self) -> XChaCha20Poly1305 {
        XChaCha20Poly1305::new((&self.0).into())
    }
}

impl Drop for SealKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl std::fmt::Debug for SealKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SealKey(<redacted>)")
    }
}

/// Opaque object scope, authenticated but readable by anyone holding the
/// envelope. Derive it so it does not correlate across contexts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Scope(pub [u8; SCOPE_LEN]);

/// Why an envelope could not be opened. A wrong key and a modified nonce,
/// ciphertext or tag are deliberately indistinguishable; both are
/// [`OpenError::Authentication`]. The version, suite and scope are readable
/// header fields checked before decryption, so a changed one is reported as
/// [`OpenError::UnsupportedVersion`], [`OpenError::UnsupportedSuite`] or
/// [`OpenError::ScopeMismatch`]; that reveals nothing the envelope does not
/// already show.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OpenError {
    /// Shorter than a header plus tag.
    Truncated,
    UnsupportedVersion(u8),
    UnsupportedSuite(u8),
    /// The header names a different scope than the caller expects.
    ScopeMismatch,
    /// Ciphertext, tag or authenticated header altered, or wrong key.
    Authentication,
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenError::Truncated => f.write_str("envelope truncated"),
            OpenError::UnsupportedVersion(v) => write!(f, "unsupported envelope version {v}"),
            OpenError::UnsupportedSuite(s) => write!(f, "unsupported suite id {s}"),
            OpenError::ScopeMismatch => f.write_str("envelope scope does not match"),
            OpenError::Authentication => f.write_str("envelope failed authentication"),
        }
    }
}

impl std::error::Error for OpenError {}

/// Why sealing (or key generation) failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SealError {
    /// The OS RNG could not supply a nonce or key, for example during early
    /// boot or in a restricted sandbox. Returned instead of panicking.
    Rng,
    /// Encryption failed inside the AEAD. With a well-formed key this
    /// happens only for plaintexts beyond the cipher's length limit.
    Encrypt,
}

impl std::fmt::Display for SealError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            SealError::Rng => "OS RNG unavailable",
            SealError::Encrypt => "AEAD encryption failed",
        })
    }
}

impl std::error::Error for SealError {}

fn associated_data(authenticated_header: &[u8]) -> Vec<u8> {
    let mut aad = Vec::with_capacity(DOMAIN.len() + authenticated_header.len());
    aad.extend_from_slice(DOMAIN);
    aad.extend_from_slice(authenticated_header);
    aad
}

/// Seal `signed_receipt` for private storage under `key` and `scope`.
pub fn seal(key: &SealKey, scope: &Scope, signed_receipt: &[u8]) -> Result<Vec<u8>, SealError> {
    let mut nonce = [0u8; NONCE_LEN];
    OsRng
        .try_fill_bytes(&mut nonce)
        .map_err(|_| SealError::Rng)?;
    let nonce = XNonce::from(nonce);
    let mut envelope = Vec::with_capacity(HEADER_LEN + signed_receipt.len() + TAG_LEN);
    envelope.push(ENVELOPE_VERSION);
    envelope.push(Suite::XChaCha20Poly1305.id());
    envelope.extend_from_slice(&scope.0);
    let aad = associated_data(&envelope);
    envelope.extend_from_slice(&nonce);
    let ciphertext = key
        .cipher()
        .encrypt(
            &nonce,
            Payload {
                msg: signed_receipt,
                aad: &aad,
            },
        )
        .map_err(|_| SealError::Encrypt)?;
    envelope.extend_from_slice(&ciphertext);
    Ok(envelope)
}

/// Open an envelope the caller expects to belong to `expected_scope`.
///
/// Header fields are checked before any decryption; unknown versions and
/// suites are rejected, never interpreted. The returned bytes are zeroized on
/// drop and still need their issuer signature verified.
pub fn open(
    key: &SealKey,
    expected_scope: &Scope,
    envelope: &[u8],
) -> Result<Zeroizing<Vec<u8>>, OpenError> {
    if envelope.len() < HEADER_LEN + TAG_LEN {
        return Err(OpenError::Truncated);
    }
    let (version, suite_id) = (envelope[0], envelope[1]);
    if version != ENVELOPE_VERSION {
        return Err(OpenError::UnsupportedVersion(version));
    }
    let Some(Suite::XChaCha20Poly1305) = Suite::from_id(suite_id) else {
        return Err(OpenError::UnsupportedSuite(suite_id));
    };
    if envelope[2..AUTHENTICATED_HEADER_LEN] != expected_scope.0 {
        return Err(OpenError::ScopeMismatch);
    }
    let aad = associated_data(&envelope[..AUTHENTICATED_HEADER_LEN]);
    let nonce = XNonce::from_slice(&envelope[AUTHENTICATED_HEADER_LEN..HEADER_LEN]);
    key.cipher()
        .decrypt(
            nonce,
            Payload {
                msg: &envelope[HEADER_LEN..],
                aad: &aad,
            },
        )
        .map(Zeroizing::new)
        .map_err(|_| OpenError::Authentication)
}
