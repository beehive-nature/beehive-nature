//! SLIP-0010 (Ed25519) hierarchical deterministic derivation for the
//! `chain-zano` adapter. Produces the raw spend scalar `s` consumed by
//! `keys.rs::derive_from_spend_secret`.
//!
//! Pipeline:
//!   Trezor master seed -> [this module: SLIP-0010 Ed25519] -> s
//!                      -> [keys.rs: Keccak256 / dependent_key] -> {s, v, S, V}
//!
//! This file knows ONLY SLIP-0010 + Ed25519. No Zano logic (no view key),
//! no ECDH, no key agreement.
//!
//! ============================================================================
//! IMPORTANT — SLIP-0010 Ed25519 is NOT BIP-32/secp256k1. Do not "fix" this to
//! match the secp256k1 rules; the differences below are load-bearing:
//!
//!   * Hardened-only. There is NO non-hardened (public) derivation on Ed25519.
//!     Every path level is hardened. A "change/address_index without '" path is
//!     undefined here.
//!   * The HMAC message for a hardened child is  0x00 || k_par || ser32(index),
//!     using the parent PRIVATE key. It does NOT use the parent public key.
//!     (Using the pubkey is the secp256k1 rule and yields silent garbage.)
//!   * Master:  I = HMAC-SHA512(key = "ed25519 seed", data = seed)
//!              k = I[0..32], c = I[32..64].  IL is used directly; NOT reduced.
//!   * In standard SLIP-0010, IL (32 bytes) is the Ed25519 private key used
//!     directly as a signing seed and is NEVER reduced mod l.
//! ============================================================================
//!
//! ZANO-SPECIFIC STEP (deliberate divergence, see `derive_spend_secret`):
//!   Zano uses the scalar as a raw CryptoNote spend scalar (`sc_check(s)==0`),
//!   not as an Ed25519 signing seed. So the final step reduces the leaf `IL`
//!   mod l via `Scalar::from_bytes_mod_order`. This is the line where we step
//!   OFF the SLIP-0010 standard, and it is WHY a stock SLIP-0010 tool cannot
//!   reproduce this wallet (recovery requires exporting s/v directly).
//!
//! WARNING: Coin type 1018 (ZANO) VERIFIED against the official SLIP-0044
//! registry before production use to prevent fund lock-in.

use curve25519_dalek::scalar::Scalar;
use hmac::{Hmac, Mac};
use sha2::Sha512;

type HmacSha512 = Hmac<Sha512>;

const HARDENED: u32 = 0x8000_0000;

/// Zano SLIP-0044 coin type. VERIFY against the registry before production.
pub const ZANO_SLIP44_COIN_TYPE: u32 = 1018;

/// A SLIP-0010 node: 32-byte scalar seed + 32-byte chain code.
struct Node {
    key: [u8; 32],
    chain_code: [u8; 32],
}

/// Master node from a seed:  I = HMAC-SHA512("ed25519 seed", seed).
fn master_node(seed: &[u8]) -> Node {
    let mut mac = HmacSha512::new_from_slice(b"ed25519 seed")
        .expect("HMAC accepts any key length");
    mac.update(seed);
    let i = mac.finalize().into_bytes();

    let mut key = [0u8; 32];
    let mut chain_code = [0u8; 32];
    key.copy_from_slice(&i[0..32]);
    chain_code.copy_from_slice(&i[32..64]);
    Node { key, chain_code }
}

/// Hardened child:  I = HMAC-SHA512(c_par, 0x00 || k_par || ser32(index)).
/// `index` must be hardened (>= 0x80000000); on Ed25519 only hardened exists.
fn derive_hardened(parent: &Node, index: u32) -> Node {
    debug_assert!(index >= HARDENED, "SLIP-0010 Ed25519 is hardened-only");

    let mut mac = HmacSha512::new_from_slice(&parent.chain_code)
        .expect("HMAC accepts any key length");
    mac.update(&[0x00]); // NOT the parent public key — the 0x00 || k_par form
    mac.update(&parent.key);
    mac.update(&index.to_be_bytes()); // ser32(index), big-endian
    let i = mac.finalize().into_bytes();

    let mut key = [0u8; 32];
    let mut chain_code = [0u8; 32];
    key.copy_from_slice(&i[0..32]);
    chain_code.copy_from_slice(&i[32..64]);
    Node { key, chain_code }
}

/// The full hardened path for a Zano account/change/address_index.
/// Returns `[44', 1018', account', change', address_index']`.
pub fn zano_path(account: u32, change: u32, address_index: u32) -> [u32; 5] {
    [
        44 | HARDENED,
        ZANO_SLIP44_COIN_TYPE | HARDENED,
        account | HARDENED,
        change | HARDENED,
        address_index | HARDENED,
    ]
}

/// Traverse `m/44'/1018'/account'/change'/address_index'` and return the
/// canonical Zano spend scalar `s` (reduced mod l — the Zano-specific step).
///
/// NOTE: `master_seed` here is the SLIP-0010 seed. On a real device this
/// traversal happens in the firmware and only the leaf leaves the enclave in
/// the final design; this host-side version exists for the current prototype.
pub fn derive_spend_secret(
    master_seed: &[u8],
    account: u32,
    change: u32,
    address_index: u32,
) -> [u8; 32] {
    let mut node = master_node(master_seed);
    for index in zano_path(account, change, address_index) {
        node = derive_hardened(&node, index);
    }

    // ---- Zano-specific divergence from standard SLIP-0010 ----
    // Standard SLIP-0010 would return node.key (IL) unreduced as the Ed25519
    // seed. Zano uses it as a raw CryptoNote spend scalar, so reduce mod l.
    Scalar::from_bytes_mod_order(node.key).to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let seed = [0x42u8; 32];
        let a = derive_spend_secret(&seed, 0, 0, 0);
        let b = derive_spend_secret(&seed, 0, 0, 0);
        assert_eq!(a, b);
    }

    #[test]
    fn distinct_paths_distinct_keys() {
        let seed = [0x42u8; 32];
        assert_ne!(
            derive_spend_secret(&seed, 0, 0, 0),
            derive_spend_secret(&seed, 0, 0, 1),
        );
    }

    #[test]
    fn path_structure_all_hardened() {
        assert_eq!(
            zano_path(0, 0, 0),
            [44 | HARDENED, 1018 | HARDENED, HARDENED, HARDENED, HARDENED],
        );
        // Every level hardened — no non-hardened level is valid on Ed25519.
        for level in zano_path(3, 1, 7) {
            assert!(level >= HARDENED, "all SLIP-0010 Ed25519 levels are hardened");
        }
    }

    /// END-TO-END PIPELINE test: this module -> keys.rs.
    /// Proves the two crates compose. It is #[ignore]d until a REAL Zano
    /// (seed/path -> view_public) reference vector is inserted, for the same
    /// reason keys.rs's compatibility test is: a green test on a fabricated
    /// vector is the split-brain bug wearing a passing checkmark.
    ///
    /// TODO: generate `(master_seed, account/change/index) -> expected V`
    ///       from a source that also implements this exact derivation, and
    ///       assert equality. Until such a vector exists, note that NO tool
    ///       currently produces it — this derivation is Trezor/Beehive-specific.
    #[test]
    #[ignore = "insert a verified end-to-end (seed -> Zano view_public) vector before enabling"]
    fn composes_with_keys_module() {
        // use super::super::keys::derive_from_spend_secret; // adjust to your module tree
        // let seed: [u8; 32] = ...;                 // TODO
        // let s = derive_spend_secret(&seed, 0, 0, 0);
        // let keys = derive_from_spend_secret(&s);
        // assert_eq!(keys.view_public, EXPECTED_V);  // TODO
        todo!("insert verified end-to-end reference vector");
    }
}
