//! bnr-keys — the BNR wallet's first-party key + signature core.
//!
//! SEAM LAW (founder word 2026-08-22: "rewrite in our stack languages if you deem prudent"):
//! this crate owns everything crypto-static — seed→WIF, EOS/PUB_K1/EVM public material,
//! the EOSIO chain digest, deterministic-recoverable secp256k1 signatures, SIG_K1_ strings,
//! account-name u64 encoding, and the fixed transaction envelope. It owns NOTHING dynamic:
//! ABI-driven action-data serialization of arbitrary contracts stays with the vendored
//! eosjs translator (battle-tested by the whole ecosystem; hand-rolling it is not prudent).
//!
//! Every byte law here is proven byte-identical against the vendored eosjs/noble lane;
//! the pinned vectors in the tests are receipts from that cross-derivation.

use k256::ecdsa::{RecoveryId, SigningKey, signature::hazmat::PrehashSigner};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use sha2::{Digest, Sha256};

pub mod wasm;

/// The deterministic bzDiD test soul vector (masterPrK = (i*7+3)&0xff) — same
/// seed family every receipt in the wallet lane used. Never a real key.
pub const TEST_K1_SEED_HEX: &str =
    "7f19513a7230a7f66b3605fda3842ac8345636ea62db809ff85e201b2224843f"; // TESTNET-ONLY throwaway compat vector
pub const TEST_WIF37: &str = "5JnG9nJdo36eWv2VyPxTsmXrDwSwUShua9SZsz2Jjo7SziQgU8R"; // TESTNET-ONLY throwaway compat vector
pub const TEST_EOS_PUB: &str = "EOS7SA9M5wjWYnxtfdDh4254AWZE1iXv8UXoPzQtBHtbR3Zopq1iQ"; // TESTNET-ONLY throwaway compat vector
pub const TEST_PUB_K1: &str = "PUB_K1_7SA9M5wjWYnxtfdDh4254AWZE1iXv8UXoPzQtBHtbR3ZqMjKyT"; // TESTNET-ONLY throwaway compat vector
pub const TEST_EVM_SEED_HEX: &str =
    "709dd865026fe610e3d062c94ace6966c94eee3b15237555eb32a7391952496c"; // TESTNET-ONLY throwaway compat vector
pub const TEST_EVM_ADDR: &str = "0xb0cd907e16b5aba5cbfab494acf787a7650a5879"; // TESTNET-ONLY throwaway compat vector
pub const TEST_SIG_VECTOR: &str = "SIG_K1_Juj3MPczGu8FZgVxPzDKNTzFppyDwwDexturPZphWWRJzKpwjiknXnbSFcrrz4NUtaMCMqVM47VNA7ZDizm7SimHtSsb7Q"; // TESTNET-ONLY throwaway compat vector
pub const TEST_SIG_PAYLOAD_HEX: &str = "1f0397d85083cb077c25ed25e07a509e1e8fa8083158d0c359f7ec360ce005e47421e4eab4bc7f9c93146a9ade9dbec76bb44bc6b90a134f52666ac89a72b354fb"; // TESTNET-ONLY throwaway compat vector (the same eosjs signature, raw 65B)
pub const TEST_DIGEST_HEX: &str = "4b49c0337ede0ec92744d32942c09a2639c3a64a0f9aac12f4f8722a09b8f0fa"; // TESTNET-ONLY throwaway compat vector (sha256 of 'the rust core vector')

const B58: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// base58 (bitcoin alphabet, leading zeros → '1's) — the law every EOSIO string rides on.
pub fn base58_encode(data: &[u8]) -> String {
    let zeros = data.iter().take_while(|&&b| b == 0).count();
    let mut digits: Vec<u8> = Vec::with_capacity(data.len() * 138 / 100 + 1);
    for &byte in &data[zeros..] {
        let mut carry = byte as u32;
        for d in digits.iter_mut() {
            carry += (*d as u32) << 8;
            *d = (carry % 58) as u8;
            carry /= 58;
        }
        while carry > 0 {
            digits.push((carry % 58) as u8);
            carry /= 58;
        }
    }
    let mut s = String::with_capacity(zeros + digits.len());
    for _ in 0..zeros {
        s.push('1');
    }
    for d in digits.iter().rev() {
        s.push(B58[*d as usize] as char);
    }
    s
}

fn sha256d_prefix4(payload: &[u8]) -> [u8; 4] {
    let h = Sha256::digest(Sha256::digest(payload));
    [h[0], h[1], h[2], h[3]]
}

fn ripemd160_suffix4(data: &[u8], suffix: &str) -> [u8; 4] {
    let mut d = Vec::with_capacity(data.len() + suffix.len());
    d.extend_from_slice(data);
    d.extend_from_slice(suffix.as_bytes());
    let h = ripemd::Ripemd160::digest(&d);
    [h[0], h[1], h[2], h[3]]
}

/// WIF (eosjs 37-byte form): base58(0x80 ‖ seed ‖ sha256d(payload)[0..4]).
/// eosjs 22.1.0 REJECTS the 38-byte compressed form — this is the one it takes.
pub fn wif37(seed: &[u8; 32]) -> String {
    let mut payload = [0u8; 33];
    payload[0] = 0x80;
    payload[1..33].copy_from_slice(seed);
    let mut whole = [0u8; 37];
    whole[..33].copy_from_slice(&payload);
    whole[33..37].copy_from_slice(&sha256d_prefix4(&payload));
    base58_encode(&whole)
}

/// Legacy EOS public key string: "EOS" + base58(pub33 ‖ ripemd160(pub33 ‖ "")[0..4]).
pub fn eos_pub_string(seed: &[u8; 32]) -> Result<String, &'static str> {
    let sk = SigningKey::from_slice(seed).map_err(|_| "seed out of secp256k1 range")?;
    let pub33 = sk.verifying_key().to_encoded_point(true);
    let mut whole = [0u8; 37];
    whole[..33].copy_from_slice(pub33.as_bytes());
    whole[33..37].copy_from_slice(&ripemd160_suffix4(pub33.as_bytes(), ""));
    Ok(format!("EOS{}", base58_encode(&whole)))
}

/// Modern PUB_K1_ string: suffix "K1" instead of "".
pub fn pub_k1_string(seed: &[u8; 32]) -> Result<String, &'static str> {
    let sk = SigningKey::from_slice(seed).map_err(|_| "seed out of secp256k1 range")?;
    let pub33 = sk.verifying_key().to_encoded_point(true);
    let mut whole = [0u8; 37];
    whole[..33].copy_from_slice(pub33.as_bytes());
    whole[33..37].copy_from_slice(&ripemd160_suffix4(pub33.as_bytes(), "K1"));
    Ok(format!("PUB_K1_{}", base58_encode(&whole)))
}

/// EVM address: keccak256(X ‖ Y)[12..32] of the uncompressed public key.
pub fn evm_address(seed: &[u8; 32]) -> Result<String, &'static str> {
    use sha3::Keccak256;
    let sk = SigningKey::from_slice(seed).map_err(|_| "seed out of secp256k1 range")?;
    let pub65 = sk.verifying_key().to_encoded_point(false);
    let bytes = pub65.as_bytes(); // [0x04 ‖ X32 ‖ Y32]
    let mut h = Keccak256::new();
    h.update(&bytes[1..65]);
    let digest = h.finalize();
    let mut s = String::with_capacity(42);
    s.push_str("0x");
    for b in &digest[12..32] {
        s.push_str(&format!("{:02x}", b));
    }
    Ok(s)
}

/// The EOSIO chain digest: sha256(chain_id ‖ packed_trx ‖ 32 zero bytes).
pub fn chain_digest(chain_id: &[u8; 32], packed_trx: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(chain_id);
    h.update(packed_trx);
    h.update([0u8; 32]);
    let out = h.finalize();
    let mut d = [0u8; 32];
    d.copy_from_slice(&out);
    d
}

pub fn sha256_of(data: &[u8]) -> [u8; 32] {
    let out = Sha256::digest(data);
    let mut d = [0u8; 32];
    d.copy_from_slice(&out);
    d
}

/// Deterministic recoverable signature (RFC6979) over a 32-byte digest.
/// Returns the eosjs 65-byte payload: [31 + recid ‖ r32 ‖ s32].
pub fn sign_digest65(seed: &[u8; 32], digest: &[u8; 32]) -> Result<[u8; 65], &'static str> {
    let sk = SigningKey::from_slice(seed).map_err(|_| "seed out of secp256k1 range")?;
    let (sig, recid) = sk
        .sign_prehash_recoverable(digest)
        .map_err(|_| "signing failed")?;
    let mut out = [0u8; 65];
    out[0] = 31u8 + recid.to_byte(); // eosjs compact recovery law (measured: {31,32})
    out[1..65].copy_from_slice(&sig.to_bytes());
    Ok(out)
}

/// SIG_K1_ string: "SIG_K1_" + base58(65B ‖ ripemd160(65B ‖ "K1")[0..4]).
pub fn sig_k1_string(payload65: &[u8; 65]) -> String {
    let mut whole = [0u8; 69];
    whole[..65].copy_from_slice(payload65);
    whole[65..69].copy_from_slice(&ripemd160_suffix4(payload65, "K1"));
    format!("SIG_K1_{}", base58_encode(&whole))
}

/// Verify a 65-byte eosjs-style payload ([31+recid ‖ r ‖ s]) over a digest for a seed's pubkey.
/// The interop law: elliptic (eosjs) and k256 (us) derive different deterministic nonces, so
/// signatures differ BYTES but must agree on VALIDITY — this is the cross-check.
pub fn verify_digest65(seed: &[u8; 32], digest: &[u8; 32], payload65: &[u8]) -> bool {
    use k256::ecdsa::{Signature, VerifyingKey, signature::hazmat::PrehashVerifier};
    let Ok(sk) = SigningKey::from_slice(seed) else { return false };
    let vk = VerifyingKey::from(&sk);
    let Ok(sig) = Signature::from_slice(&payload65[1..65]) else { return false };
    vk.verify_prehash(digest, &sig).is_ok()
}

/// EOSIO account-name → u64 (the 13-char packing over the alphabet
/// ".12345abcdefghijklmnopqrstuvwxyz" — 'a' has value 6, NOT 1; the 13th char
/// only fits 4 bits so it may only be '.', '1'-'5', or 'a'-'j').
pub fn account_name_u64(name: &str) -> Result<u64, &'static str> {
    let b = name.as_bytes();
    if b.len() > 13 {
        return Err("name longer than 13 chars");
    }
    let mut n: u64 = 0;
    for (i, &c) in b.iter().enumerate() {
        let v: u64 = match c {
            b'.' => 0,
            b'1'..=b'5' => (c - b'1' + 1) as u64,
            b'a'..=b'z' => (c - b'a' + 6) as u64,
            _ => return Err("name chars: a-z and 1-5 only"),
        };
        if i < 12 {
            n |= v.checked_shl(64 - 5 * (i as u32 + 1)).ok_or("shift overflow")?;
        } else if v > 15 {
            return Err("13th char can only be a-j or 1-5");
        } else {
            n |= v;
        }
    }
    Ok(n)
}

fn write_varuint(buf: &mut Vec<u8>, mut v: u64) {
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        buf.push(b);
        if v == 0 {
            break;
        }
    }
}

/// One action for the envelope packer, all numerics already encoded.
pub struct PackedAction {
    pub account: u64,
    pub action: u64,
    pub actor: u64,
    pub permission: u64,
    pub data: Vec<u8>,
}

/// The fixed EOSIO transaction envelope. Byte layout is chain law ( Leap / CDT docs );
/// action DATA bytes come from the eosjs ABI translator, everything else is ours.
pub fn pack_transaction(
    expiration_unix: u32,
    ref_block_num: u16,
    ref_block_prefix: u32,
    actions: &[PackedAction],
) -> Vec<u8> {
    let mut out = Vec::with_capacity(64);
    out.extend_from_slice(&expiration_unix.to_le_bytes());
    out.extend_from_slice(&ref_block_num.to_le_bytes());
    out.extend_from_slice(&ref_block_prefix.to_le_bytes());
    write_varuint(&mut out, 0); // max_net_usage_words
    write_varuint(&mut out, 0); // max_cpu_usage_ms
    write_varuint(&mut out, 0); // delay_sec
    write_varuint(&mut out, 0); // context_free_actions: none
    write_varuint(&mut out, actions.len() as u64);
    for a in actions {
        out.extend_from_slice(&a.account.to_le_bytes());
        out.extend_from_slice(&a.action.to_le_bytes());
        write_varuint(&mut out, 1); // authorization count
        out.extend_from_slice(&a.actor.to_le_bytes());
        out.extend_from_slice(&a.permission.to_le_bytes());
        write_varuint(&mut out, a.data.len() as u64);
        out.extend_from_slice(&a.data);
    }
    write_varuint(&mut out, 0); // transaction_extensions
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_seed() -> [u8; 32] {
        let mut s = [0u8; 32];
        let h = hex_decode(TEST_K1_SEED_HEX);
        s.copy_from_slice(&h);
        s
    }
    fn hex_decode(s: &str) -> Vec<u8> {
        (0..s.len() / 2)
            .map(|i| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn wif_matches_vendored_lane() {
        assert_eq!(wif37(&test_seed()), TEST_WIF37);
    }

    #[test]
    fn eos_pub_matches_vendored_lane() {
        assert_eq!(eos_pub_string(&test_seed()).unwrap(), TEST_EOS_PUB);
        assert_eq!(pub_k1_string(&test_seed()).unwrap(), TEST_PUB_K1);
    }

    #[test]
    fn evm_address_matches_vendored_lane() {
        let mut s = [0u8; 32];
        s.copy_from_slice(&hex_decode(TEST_EVM_SEED_HEX));
        assert_eq!(evm_address(&s).unwrap(), TEST_EVM_ADDR);
    }

    #[test]
    fn signatures_mutually_valid_with_vendored_lane() {
        let d = sha256_of(b"the rust core vector");
        assert_eq!(
            hex_string(&d),
            TEST_DIGEST_HEX,
            "digest vector drifted — repin honestly if the source changed"
        );
        // elliptic (eosjs) and k256 derive different deterministic nonces: signature
        // BYTES differ by law, VALIDITY must agree. (1) k256 verifies eosjs's sig:
        let eosjs_payload = hex_decode(TEST_SIG_PAYLOAD_HEX);
        assert_eq!(eosjs_payload.len(), 65);
        assert!(
            verify_digest65(&test_seed(), &d, &eosjs_payload),
            "k256 rejected the eosjs signature — interop broken"
        );
        // (2) our own sig verifies: (3) our string form is well-formed (checksum law):
        let ours = sign_digest65(&test_seed(), &d).unwrap();
        assert!(verify_digest65(&test_seed(), &d, &ours));
        assert!(sig_k1_string(&ours).starts_with("SIG_K1_"));
        assert_ne!(
            sig_k1_string(&ours),
            TEST_SIG_VECTOR,
            "if these ever EQUAL, a library changed its nonce law — repin vectors then"
        );
    }

    #[test]
    fn chain_digest_shape() {
        let packed = vec![0u8; 10];
        let mut cid = [0u8; 32];
        cid[0] = 1;
        let d1 = chain_digest(&cid, &packed);
        let d2 = sha256_of(&[&cid[..], &packed[..], &[0u8; 32][..]].concat());
        assert_eq!(d1, d2);
    }

    #[test]
    fn name_encoding_law() {
        // 'eosio' = the canonical chain value (confirmed against eosjs packed bytes)
        assert_eq!(account_name_u64("eosio").unwrap(), 0x5530ea0000000000);
        // 'a' has value 6 in ".12345abc…z": twelve a's = 6 at every 5-bit slot
        let n = account_name_u64("aaaaaaaaaaaa").unwrap();
        let mut expect: u64 = 0;
        for i in 0..12u32 {
            expect |= 6u64 << (64 - 5 * (i + 1));
        }
        assert_eq!(n, expect);
        assert!(account_name_u64("kingbeelovis").is_ok());
        assert!(account_name_u64("bad_name!").is_err());
    }

    #[test]
    fn base58_leading_zeros() {
        assert_eq!(base58_encode(&[0, 0]), "11");
        assert_eq!(base58_encode(&[0, 0xff]), "15Q"); // eosjs-confirmed vector
    }

    fn hex_string(b: &[u8]) -> String {
        b.iter().map(|x| format!("{:02x}", x)).collect()
    }
}
