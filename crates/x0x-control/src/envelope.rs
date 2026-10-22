//! ML-KEM-768 sealed envelopes for orders.
//!
//! Construction (standard hybrid, no novel crypto):
//! bsigner::pq ML-KEM-768 encapsulation -> 32-byte shared secret ->
//! HKDF-SHA-256 (salt "x0x-control/v1") -> AES-256-GCM key + nonce
//! (both HKDF outputs; the fresh shared secret makes each pair
//! unique per envelope) -> order JSON encrypted with the envelope's
//! order id as associated data.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use bsigner::alg::KemAlg;
use bsigner::pq;
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::order::Order;

pub const KEM_ALG: &str = "ml-kem-768";

/// The agent's KEM identity: a 64-byte decapsulation seed (SECRET,
/// file-held, never printed) and its encapsulation key (public).
pub struct KemIdentity {
    pub seed: [u8; 64],
    pub public: Vec<u8>,
}

impl KemIdentity {
    pub fn generate() -> Result<Self, String> {
        let g = pq::kem_generate(KemAlg::MlKem768)?;
        Ok(KemIdentity {
            seed: g.seed,
            public: g.encapsulation_key,
        })
    }

    pub fn from_seed(seed: [u8; 64]) -> Self {
        let public = pq::kem_public_from_seed(KemAlg::MlKem768, &seed);
        KemIdentity { seed, public }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealedEnvelope {
    pub kem_alg: String,
    pub kem_ct_b64: String,
    pub cipher_b64: String,
    /// Plaintext order id, bound into the AEAD as associated data.
    pub order_id: String,
}

fn derive_key_nonce(ss: &[u8; 32]) -> (Vec<u8>, Vec<u8>) {
    let hk = Hkdf::<Sha256>::new(Some(b"x0x-control/v1"), ss);
    let mut key = vec![0u8; 32];
    let mut nonce = vec![0u8; 12];
    hk.expand(b"order-key", &mut key).expect("hkdf key");
    hk.expand(b"order-nonce", &mut nonce).expect("hkdf nonce");
    (key, nonce)
}

/// Seal an order to a peer's ML-KEM-768 encapsulation key.
pub fn seal_order(order: &Order, peer_public: &[u8]) -> Result<SealedEnvelope, String> {
    let (ct, ss) = pq::kem_encapsulate(KemAlg::MlKem768, peer_public)?;
    let (key, nonce) = derive_key_nonce(&ss);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plain = serde_json::to_vec(order).map_err(|e| e.to_string())?;
    let sealed = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &plain,
                aad: order.id.as_bytes(),
            },
        )
        .map_err(|_| "aes-gcm seal failed".to_string())?;
    Ok(SealedEnvelope {
        kem_alg: KEM_ALG.to_string(),
        kem_ct_b64: b64_encode(&ct),
        cipher_b64: b64_encode(&sealed),
        order_id: order.id.clone(),
    })
}

/// Open an envelope with the agent's seed. Any mismatch — wrong key,
/// tampered bytes, wrong order id — is an error, never a guess.
pub fn open_order(env: &SealedEnvelope, id: &KemIdentity) -> Result<Order, String> {
    if env.kem_alg != KEM_ALG {
        return Err(format!("unsupported kem_alg {}", env.kem_alg));
    }
    let ct = b64_decode(&env.kem_ct_b64)?;
    let ss = pq::kem_decapsulate(KemAlg::MlKem768, &id.seed, &ct)?;
    let (key, nonce) = derive_key_nonce(&ss);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let sealed = b64_decode(&env.cipher_b64)?;
    let plain = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &sealed,
                aad: env.order_id.as_bytes(),
            },
        )
        .map_err(|_| "envelope open failed (wrong key or tampered)".to_string())?;
    let order: Order = serde_json::from_slice(&plain).map_err(|e| e.to_string())?;
    if order.id != env.order_id {
        return Err("envelope order_id does not match payload".to_string());
    }
    Ok(order)
}

// Minimal standard-alphabet base64 (with padding), std-only.
pub fn b64_encode(data: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    let mut vals = Vec::new();
    for c in s.bytes() {
        vals.push(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => 64,
            b'\n' | b'\r' | b' ' => continue,
            _ => return Err(format!("bad base64 byte {c}")),
        });
    }
    if vals.len() % 4 != 0 {
        return Err("bad base64 length".to_string());
    }
    let mut out = Vec::new();
    for chunk in vals.chunks(4) {
        let n = ((chunk[0] as u32) << 18)
            | (((chunk[1] as u32) & 63) << 12)
            | (((chunk[2] as u32) & 63) << 6)
            | ((chunk[3] as u32) & 63);
        out.push((n >> 16) as u8);
        if chunk[2] != 64 {
            out.push((n >> 8) as u8);
        }
        if chunk[3] != 64 {
            out.push(n as u8);
        }
    }
    Ok(out)
}
