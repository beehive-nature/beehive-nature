//! Arweave JWK (RSA-4096) key types and address derivation.
//!
//! L-VERIFY: rsa = MIT+Apache-2.0 (RustCrypto/RSA, verified 2026-08-11)
//!           base64 = Apache-2.0 (marshallpierce/rust-base64, verified 2026-08-11)

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rsa::pkcs8::EncodePublicKey;
use rsa::{RsaPrivateKey, RsaPublicKey};
use sha2::{Digest, Sha256};

/// An Arweave wallet address: base64url(SHA256(RSA modulus)), 43 chars.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ArweaveAddress(pub String);

impl std::fmt::Display for ArweaveAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Derive an Arweave address from an RSA public key.
/// address = base64url(SHA256(modulus_big_endian_bytes))
pub fn derive_address(pub_key: &RsaPublicKey) -> ArweaveAddress {
    let n = pub_key.n();
    let n_bytes = n.to_bytes_be();
    let hash = Sha256::digest(&n_bytes);
    ArweaveAddress(URL_SAFE_NO_PAD.encode(hash))
}

/// Extract the RSA public modulus as raw big-endian bytes (the "owner" field).
pub fn owner_bytes(pub_key: &RsaPublicKey) -> Vec<u8> {
    pub_key.n().to_bytes_be()
}

/// Generate a new RSA keypair. 4096 for production; pass a smaller bit size for tests.
/// WARNING: RSA-4096 keygen takes 5-30 seconds.
pub fn generate_keypair(bits: usize) -> (RsaPrivateKey, RsaPublicKey) {
    use rand::thread_rng;
    let mut rng = thread_rng();
    let priv_key = RsaPrivateKey::new(&mut rng, bits).expect("RSA keygen");
    let pub_key = RsaPublicKey::from(&priv_key);
    (priv_key, pub_key)
}
