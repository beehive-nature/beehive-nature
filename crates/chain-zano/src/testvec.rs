//! Test-only: the stock-Zano reference vector + address decoding shared by
//! the compatibility tests in [`crate::keys`] and [`crate::view`].
//!
//! ## Vector provenance
//! Generated 2026-07-03 with **stock Zano `simplewallet` v2.2.1.501[fc57729]**
//! (offline mode): a fresh wallet created solely to be this vector — never
//! funded, never used for anything — secrets exported via its `spendkey` /
//! `viewkey` commands. Committing these secrets is deliberate and sanctioned
//! (the TESTNET-ONLY marker path; see `scripts/secret-scan.sh`): a vector
//! only proves stock parity if it comes from stock software, and it only
//! stays proven if it is versioned with the code it proves.
//!
//! The address is the wallet's public address; its CN-base58 payload carries
//! `{S, V}` under a Keccak checksum, giving us the expected *public* keys on
//! a path fully independent of the derivation code under test.

use sha3::{Digest, Keccak256};

/// Stock wallet's secret spend key `s` (canonical scalar, as exported).
pub const SPEND_SECRET: [u8; 32] =
    hex_literal::hex!("623c2bffa6e3053244426a55756e062194cabee35f5576731ddb8510eba0cf0b"); // TESTNET-ONLY throwaway vector (never-funded wallet)

/// Stock wallet's secret view key `v` — ground truth for `dependent_key`.
pub const VIEW_SECRET: [u8; 32] =
    hex_literal::hex!("5e38da64bf15eb32b44d0bf46c26dc95044bf4b3b6ccfdff76a7045a70b3e60b"); // TESTNET-ONLY throwaway vector (never-funded wallet)

/// The same wallet's public address (encodes `{S, V}` + checksum).
pub const ADDRESS: &str =
    "ZxCCTdSgNjJjYeCvdq8v9DEde6kCMeF4KK6zVgXvKQm8HEoNB3YCffc3J3RcNLpjVXAL5MSsVUSGT6P1Vrn8BorR1RWWfGyTe";

/// Decode the address and return `(spend_public, view_public)`, verifying
/// the 4-byte Keccak checksum. Panics (test context) on any inconsistency.
pub fn address_publics() -> ([u8; 32], [u8; 32]) {
    let payload = cn_base58_decode(ADDRESS);
    let n = payload.len();
    assert!(n >= 69, "address payload too short: {n} bytes");

    // last 4 bytes: checksum = keccak256(payload[..n-4])[..4]
    let mut h = Keccak256::new();
    h.update(&payload[..n - 4]);
    let digest: [u8; 32] = h.finalize().into();
    assert_eq!(
        &payload[n - 4..],
        &digest[..4],
        "address checksum mismatch — decoder or address is wrong"
    );

    let spend_public: [u8; 32] = payload[n - 68..n - 36].try_into().unwrap();
    let view_public: [u8; 32] = payload[n - 36..n - 4].try_into().unwrap();
    (spend_public, view_public)
}

/// CryptoNote base58: 8-byte blocks encoded as 11 chars (partial final
/// block per the size table). Test-only decoder.
fn cn_base58_decode(s: &str) -> Vec<u8> {
    const ALPHABET: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    // decoded size d (index) -> encoded size; invalid encoded sizes absent.
    const ENCODED_SIZES: [usize; 9] = [0, 2, 3, 5, 6, 7, 9, 10, 11];

    let decoded_size_for = |encoded: usize| -> usize {
        ENCODED_SIZES
            .iter()
            .position(|&e| e == encoded)
            .unwrap_or_else(|| panic!("invalid base58 block length {encoded}"))
    };

    let digit = |c: u8| -> u64 {
        ALPHABET
            .iter()
            .position(|&a| a == c)
            .unwrap_or_else(|| panic!("invalid base58 char {}", c as char)) as u64
    };

    let bytes = s.as_bytes();
    let mut out = Vec::new();
    for block in bytes.chunks(11) {
        let mut value: u64 = 0;
        for &c in block {
            value = value
                .checked_mul(58)
                .and_then(|v| v.checked_add(digit(c)))
                .expect("base58 block overflows u64");
        }
        let d = decoded_size_for(block.len());
        out.extend_from_slice(&value.to_be_bytes()[8 - d..]);
    }
    out
}
