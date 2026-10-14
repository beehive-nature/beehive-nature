//! Experimental public-key preparation for the pinned x0x PQ implementation.
//! This test workspace is outside BNR's shipping dependency graph.
#![forbid(unsafe_code)]

use fips204::{
    ml_dsa_65,
    traits::{SerDes, Verifier},
};

/// An immutable, caller-owned ML-DSA-65 public key, expanded once.
///
/// Use one object per authenticated identity/key epoch and drop it when that
/// binding changes. This object verifies signatures only: the caller must still
/// enforce identity binding, authorization and revocation on every operation.
/// There is no global registry, secret-key cache, RNG or verification-result cache.
pub struct PreparedMlDsa65PublicKey(ml_dsa_65::PublicKey);

impl PreparedMlDsa65PublicKey {
    /// Decode exactly one standard ML-DSA-65 public key with pinned fips204.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        let bytes = bytes
            .try_into()
            .map_err(|_| "ML-DSA-65 public key must be 1952 bytes")?;
        ml_dsa_65::PublicKey::try_from_bytes(bytes).map(Self)
    }

    /// Verify the complete message, signature and pure-ML-DSA context.
    /// Malformed signatures and contexts longer than 255 bytes are refused.
    /// Empty messages and empty contexts are valid standard inputs.
    pub fn verify(&self, message: &[u8], signature: &[u8], context: &[u8]) -> bool {
        let Ok(signature) = signature.try_into() else {
            return false;
        };
        self.0.verify(message, signature, context)
    }
}
