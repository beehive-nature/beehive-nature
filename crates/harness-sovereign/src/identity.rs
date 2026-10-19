//! R7 — identity hook over the bSigner **library** (RUST-HARNESS-SPEC.md §6).
//!
//! `did:b:` self-certifying identity: `did:b:` + base32(sha256(canonical
//! genesis op)). Zero chain bytes — the DID is hash-derived, so there is
//! nothing chain-specific in it. Rotation-readiness follows Article II
//! (key algorithm travels in the keyset; data keys off the DID, never the
//! raw key).
//!
//! All crypto goes through `bsigner` as linked function calls: keygen,
//! load, sign, verify. No CLI spawning, no JSON over stdio. Key files live
//! wherever the caller points `keys_dir` (tests use explicit temp dirs and
//! never touch the operator's real keystore).

use std::path::{Path, PathBuf};

use bsigner::alg::SigAlg;
use sha2::{Digest, Sha256};

/// A signed checkpoint: the bytes, who signed, and with what.
#[derive(Debug, Clone)]
pub struct SignedCheckpoint {
    pub did: String,
    pub verifying_key: Vec<u8>,
    pub bytes: Vec<u8>,
    pub sig: Vec<u8>,
}

/// Self-certifying harness identity bound to one ML-DSA-65 keyset.
#[derive(Debug, Clone)]
pub struct IdentityHook {
    did: String,
    key_id: String,
    keys_dir: PathBuf,
}

impl IdentityHook {
    /// Generate a fresh ML-DSA-65 keyset under `keys_dir` and derive the
    /// `did:b:` identity from the canonical genesis op. Returns public
    /// material only alongside the hook (key id, DID, key length).
    pub fn genesis(keys_dir: &Path) -> Result<Self, String> {
        let info = bsigner::keys::keygen_dsa(SigAlg::MlDsa65, Some(keys_dir.to_path_buf()))?;
        let key_id = info
            .get("key_id")
            .and_then(|v| v.as_str())
            .ok_or("bsigner keygen returned no key_id")?
            .to_string();
        let (_, _, verifying_key) = bsigner::keys::load_dsa(&key_id, Some(keys_dir.to_path_buf()))?;
        let genesis_op = serde_json::json!({
            "type": "b:genesis",
            "alg": SigAlg::MlDsa65.id(),
            "pubkey_b64u": bsigner::b64::b64u(&verifying_key),
        });
        let canonical =
            serde_json::to_string(&genesis_op).map_err(|e| format!("genesis JSON: {e}"))?;
        let digest = Sha256::digest(canonical.as_bytes());
        let did = format!("did:b:{}", base32_encode(&digest));
        Ok(IdentityHook {
            did,
            key_id,
            keys_dir: keys_dir.to_path_buf(),
        })
    }

    pub fn did(&self) -> &str {
        &self.did
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }

    /// F4 boot gate: sign fixed bytes with our own key and verify. The
    /// demo refuses to start when the signer is broken.
    pub fn selftest(&self) -> bool {
        let probe = b"harness-sovereign boot selftest";
        match self.checkpoint(probe) {
            Ok(signed) => bsigner::pq::dsa_verify(
                SigAlg::MlDsa65,
                &signed.verifying_key,
                &signed.bytes,
                &signed.sig,
            )
            .unwrap_or(false),
            Err(_) => false,
        }
    }

    /// Sign checkpoint bytes (e.g. a transcript sha256). Returns the
    /// signature for the checkpoint CanonicalEvent.
    pub fn checkpoint(&self, bytes: &[u8]) -> Result<SignedCheckpoint, String> {
        let (alg, seed, verifying_key) =
            bsigner::keys::load_dsa(&self.key_id, Some(self.keys_dir.clone()))?;
        let sig = bsigner::pq::dsa_sign(alg, &seed, bytes)?;
        Ok(SignedCheckpoint {
            did: self.did.clone(),
            verifying_key,
            bytes: bytes.to_vec(),
            sig,
        })
    }

    /// Continuity: both checkpoints verify under their keys, same actor,
    /// and the post transcript extends the pre transcript (byte-exact
    /// prefix — the verification, not the language, is what matters).
    pub fn verify_continuity(pre: &SignedCheckpoint, post: &SignedCheckpoint) -> bool {
        bsigner::pq::dsa_verify(SigAlg::MlDsa65, &pre.verifying_key, &pre.bytes, &pre.sig)
            .unwrap_or(false)
            && bsigner::pq::dsa_verify(SigAlg::MlDsa65, &post.verifying_key, &post.bytes, &post.sig)
                .unwrap_or(false)
            && pre.did == post.did
            && post.bytes.starts_with(&pre.bytes)
    }
}

/// RFC 4648 base32, lowercase, no padding — the estate's base32-lower
/// precedent (atmirror CIDs). Local so the harness adds no dependency
/// for one encoding.
fn base32_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";
    let mut out = String::with_capacity(data.len().div_ceil(5) * 8);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for byte in data {
        acc = (acc << 8) | u32::from(*byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((acc >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(ALPHABET[((acc << (5 - bits)) & 31) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_keys_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "harness-sovereign-test-{tag}-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).expect("temp keys dir");
        dir
    }

    #[test]
    fn genesis_checkpoint_verify_roundtrip() {
        let dir = temp_keys_dir("roundtrip");
        let hook = IdentityHook::genesis(&dir).expect("genesis");
        assert!(
            hook.did().starts_with("did:b:"),
            "DID shape: {}",
            hook.did()
        );
        // Smoke T4: base32(sha256) is 52 chars, lowercase, unpadded.
        assert_eq!(hook.did().len(), 6 + 52, "DID length: {}", hook.did());
        assert!(hook.did()[6..]
            .chars()
            .all(|c| "abcdefghijklmnopqrstuvwxyz234567".contains(c)));

        let pre = hook.checkpoint(b"transcript-prefix").expect("pre sign");
        let post_bytes = [b"transcript-prefix".as_slice(), b"-continued".as_slice()].concat();
        let post = hook.checkpoint(&post_bytes).expect("post sign");

        assert!(IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn tampered_checkpoint_is_refused() {
        let dir = temp_keys_dir("tamper");
        let hook = IdentityHook::genesis(&dir).expect("genesis");
        let pre = hook.checkpoint(b"transcript-prefix").expect("pre sign");
        let mut bad_post = hook
            .checkpoint(b"transcript-prefix-continued")
            .expect("post sign");
        bad_post.bytes[0] ^= 0xff;
        assert!(!IdentityHook::verify_continuity(&pre, &bad_post));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn different_actor_is_refused() {
        let dir_a = temp_keys_dir("actor-a");
        let dir_b = temp_keys_dir("actor-b");
        let hook_a = IdentityHook::genesis(&dir_a).expect("genesis a");
        let hook_b = IdentityHook::genesis(&dir_b).expect("genesis b");
        let pre = hook_a.checkpoint(b"shared-prefix").expect("pre sign");
        let post = hook_b.checkpoint(b"shared-prefix-more").expect("post sign");
        assert!(!IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir_a).ok();
        std::fs::remove_dir_all(&dir_b).ok();
    }

    #[test]
    fn non_prefix_post_is_refused() {
        let dir = temp_keys_dir("prefix");
        let hook = IdentityHook::genesis(&dir).expect("genesis");
        let pre = hook.checkpoint(b"transcript-prefix").expect("pre sign");
        let post = hook.checkpoint(b"unrelated-divergence").expect("post sign");
        assert!(!IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir).ok();
    }
}
