//! R7 — identity hook over the bSigner **library** (RUST-HARNESS-SPEC.md §6).
//!
//! `did:b:` self-certifying identity, canonical bzDiD form: the DID is
//! `bzdid::BzDid::derive` over the BDID-GENESIS-V1 DAG-CBOR genesis op
//! built by the `bzdid` crate — the same bytes its `verify_genesis`
//! checks — so a harness identity verifies with the estate's canonical
//! verifier, not a harness-local JSON lookalike. Zero chain bytes.
//! Rotation-readiness follows Article II (key algorithm travels in the
//! keyset; data keys off the DID, never the raw key).
//!
//! All crypto goes through `bsigner` as linked function calls: keygen,
//! load, sign, verify. No CLI spawning, no JSON over stdio. Key files live
//! wherever the caller points `keys_dir` (tests use explicit temp dirs and
//! never touch the operator's real keystore).

use std::path::{Path, PathBuf};

use bsigner::alg::SigAlg;

pub use bsigner::keys::Vault;

/// The harness genesis op's `validUntil` (2100-01-01T00:00:00Z, the
/// bzdid frozen-vector convention). Part of the canonical op, hence
/// part of the identity: changing it is a new identity, never an edit.
pub const GENESIS_VALID_UNTIL: u64 = 4_102_444_800;

/// Build the canonical BDID-GENESIS-V1 genesis op bytes for one
/// ML-DSA-65 verifying key: the key is both the single rotation key
/// (r0) and the signing key; no services or aliases are claimed.
pub fn genesis_op_bytes(verifying_key: &[u8]) -> Result<Vec<u8>, String> {
    let card = bzdid::KeyCard::new(bzdid::KeyAlg::MlDsa65, verifying_key.to_vec())
        .map_err(|e| e.to_string())?;
    let op = bzdid::GenesisOp {
        rotation_keys: vec![card.clone()],
        signing_key: card,
        services: Vec::new(),
        also_known_as: Vec::new(),
        valid_until: GENESIS_VALID_UNTIL,
    };
    op.build().map_err(|e| e.to_string())
}

/// A signed checkpoint: the bytes, who signed, and with what.
#[derive(Debug, Clone)]
pub struct SignedCheckpoint {
    pub did: String,
    pub verifying_key: Vec<u8>,
    pub bytes: Vec<u8>,
    pub sig: Vec<u8>,
}

/// Public verification material for one agent identity: everything an
/// independent verifier needs, and nothing secret. Exported before a
/// run so acceptance never has to trust material a checkpoint carries.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct PublicMaterial {
    pub did: String,
    pub alg: String,
    pub verifying_key_b64u: String,
    /// The canonical BDID-GENESIS-V1 genesis op bytes (base64url), so
    /// any holder can run the canonical `bzdid` verifier. Empty in
    /// material written before this field existed — verifiers treat
    /// that as missing verification material and fail closed.
    #[serde(default)]
    pub genesis_op_b64u: String,
}

impl PublicMaterial {
    /// Decode the verifying key; malformed material is `None`, and
    /// callers must fail closed on it.
    pub fn verifying_key_bytes(&self) -> Option<Vec<u8>> {
        bsigner::b64::b64u_decode(&self.verifying_key_b64u)
    }
}

/// Recompute the canonical genesis/DID binding for a verifying key:
/// derive the DID from the BDID-GENESIS-V1 op exactly as
/// [`IdentityHook::genesis`] does. An independent verifier uses this
/// to check that a DID actually belongs to the key presented — a
/// copied DID string proves nothing on its own. Returns an empty
/// string for key bytes that cannot form a canonical op, which
/// matches no DID and therefore fails closed.
pub fn did_for_verifying_key(verifying_key: &[u8]) -> String {
    match genesis_op_bytes(verifying_key) {
        Ok(bytes) => bzdid::BzDid::derive(&bytes).to_string(),
        Err(_) => String::new(),
    }
}

/// Whether exported public material is complete and self-consistent:
/// the expected algorithm, a decodable key, exported canonical
/// genesis bytes that the canonical `bzdid` verifier accepts for the
/// claimed DID, a signing key equal to the exported verifying key,
/// and a DID that recomputes from that key. Anything missing or
/// mismatched fails closed.
pub fn public_material_binds(material: &PublicMaterial) -> bool {
    if material.alg != SigAlg::MlDsa65.id() {
        return false;
    }
    let Some(verifying_key) = material.verifying_key_bytes() else {
        return false;
    };
    if verifying_key.is_empty() || did_for_verifying_key(&verifying_key) != material.did {
        return false;
    }
    if material.genesis_op_b64u.is_empty() {
        return false;
    }
    let Some(genesis_bytes) = bsigner::b64::b64u_decode(&material.genesis_op_b64u) else {
        return false;
    };
    let Ok(did) = bzdid::BzDid::parse(&material.did) else {
        return false;
    };
    match bzdid::verify_genesis(&genesis_bytes, &did) {
        Ok(op) => {
            op.signing_key.alg == bzdid::KeyAlg::MlDsa65 && op.signing_key.key == verifying_key
        }
        Err(_) => false,
    }
}

/// Whether `post` continues `pre` at a complete-message boundary of
/// the newline-joined canonical transcript: equal, or `pre` followed
/// immediately by the `\n` separator. A byte prefix that cuts a
/// message in half is not continuity.
fn is_complete_message_prefix(pre: &[u8], post: &[u8]) -> bool {
    post == pre || (post.len() > pre.len() && post.starts_with(pre) && post[pre.len()] == b'\n')
}

/// Self-certifying harness identity bound to one ML-DSA-65 keyset.
/// Keysets seal at rest under the owner's vault; the hook holds the
/// vault behind `Arc` (`Vault` is deliberately not `Clone`).
#[derive(Clone)]
pub struct IdentityHook {
    did: String,
    key_id: String,
    keys_dir: PathBuf,
    vault: std::sync::Arc<Vault>,
}

impl IdentityHook {
    /// Generate a fresh ML-DSA-65 keyset under `keys_dir` (sealed under
    /// `vault`) and derive the `did:b:` identity from the canonical
    /// genesis op. The DID needs public material only.
    pub fn genesis(keys_dir: &Path, vault: Vault) -> Result<Self, String> {
        let info =
            bsigner::keys::keygen_dsa(SigAlg::MlDsa65, Some(keys_dir.to_path_buf()), &vault)?;
        let key_id = info
            .get("key_id")
            .and_then(|v| v.as_str())
            .ok_or("bsigner keygen returned no key_id")?
            .to_string();
        let (_, verifying_key) =
            bsigner::keys::load_dsa_public(&key_id, Some(keys_dir.to_path_buf()))?;
        let did = did_for_verifying_key(&verifying_key);
        Ok(IdentityHook {
            did,
            key_id,
            keys_dir: keys_dir.to_path_buf(),
            vault: std::sync::Arc::new(vault),
        })
    }

    /// Test vault from the public BIP-39 all-zero vector (23×"abandon" +
    /// "art"). No live secret; test-only helper.
    #[cfg(test)]
    pub fn test_vault() -> Vault {
        let phrase = format!("{}art", "abandon ".repeat(23));
        Vault::from_recovery_code(&phrase).expect("test vault")
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
            bsigner::keys::load_dsa(&self.key_id, Some(self.keys_dir.clone()), &self.vault)?;
        let sig = bsigner::pq::dsa_sign(alg, &seed, bytes)?;
        Ok(SignedCheckpoint {
            did: self.did.clone(),
            verifying_key,
            bytes: bytes.to_vec(),
            sig,
        })
    }

    /// This identity's verifying key (public bytes only).
    pub fn verifying_key(&self) -> Result<Vec<u8>, String> {
        let (alg, verifying_key) =
            bsigner::keys::load_dsa_public(&self.key_id, Some(self.keys_dir.clone()))?;
        if alg != SigAlg::MlDsa65 {
            return Err(format!("unexpected signer algorithm {}", alg.id()));
        }
        Ok(verifying_key)
    }

    /// Export the public verification material for this identity, so an
    /// independent verifier can check checkpoints and receipts without
    /// trusting anything the run itself presents.
    pub fn public_material(&self) -> Result<PublicMaterial, String> {
        let verifying_key = self.verifying_key()?;
        if did_for_verifying_key(&verifying_key) != self.did {
            return Err("genesis DID does not bind to the loaded verifying key".to_string());
        }
        Ok(PublicMaterial {
            did: self.did.clone(),
            alg: SigAlg::MlDsa65.id().to_string(),
            verifying_key_b64u: bsigner::b64::b64u(&verifying_key),
            genesis_op_b64u: bsigner::b64::b64u(&genesis_op_bytes(&verifying_key)?),
        })
    }

    /// SAME ACTOR, independently: both checkpoint signatures verify
    /// against the *same expected* public key, that key recomputes to
    /// the expected DID via the canonical genesis binding, both
    /// checkpoints carry that DID, and the post transcript continues
    /// the pre transcript at a complete-message boundary. Anything
    /// else — another key's valid signature with copied DID metadata,
    /// altered signed bytes, a wrong expected DID, or missing
    /// verification material — is refused.
    pub fn verify_same_actor(
        pre: &SignedCheckpoint,
        post: &SignedCheckpoint,
        expected: &PublicMaterial,
    ) -> bool {
        if !public_material_binds(expected) {
            return false;
        }
        let Some(verifying_key) = expected.verifying_key_bytes() else {
            return false;
        };
        if pre.did != expected.did || post.did != expected.did {
            return false;
        }
        let verify = |checkpoint: &SignedCheckpoint| {
            bsigner::pq::dsa_verify(
                SigAlg::MlDsa65,
                &verifying_key,
                &checkpoint.bytes,
                &checkpoint.sig,
            )
            .unwrap_or(false)
        };
        verify(pre) && verify(post) && is_complete_message_prefix(&pre.bytes, &post.bytes)
    }

    /// Continuity: both checkpoints verify under the same key, that
    /// key recomputes to the checkpoints' DID via the canonical
    /// genesis binding, and the post transcript extends the pre
    /// transcript at a complete-message boundary (byte-exact prefix —
    /// the verification, not the language, is what matters).
    pub fn verify_continuity(pre: &SignedCheckpoint, post: &SignedCheckpoint) -> bool {
        if pre.verifying_key.is_empty() || pre.verifying_key != post.verifying_key {
            return false;
        }
        let Ok(genesis_bytes) = genesis_op_bytes(&pre.verifying_key) else {
            return false;
        };
        let expected = PublicMaterial {
            did: pre.did.clone(),
            alg: SigAlg::MlDsa65.id().to_string(),
            verifying_key_b64u: bsigner::b64::b64u(&pre.verifying_key),
            genesis_op_b64u: bsigner::b64::b64u(&genesis_bytes),
        };
        Self::verify_same_actor(pre, post, &expected)
    }
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
        let hook = IdentityHook::genesis(&dir, IdentityHook::test_vault()).expect("genesis");
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
        // Complete-message prefix: the continuation starts after the
        // newline separator of the canonical transcript format.
        let post_bytes = [b"transcript-prefix".as_slice(), b"\ncontinued".as_slice()].concat();
        let post = hook.checkpoint(&post_bytes).expect("post sign");

        assert!(IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn harness_identity_verifies_with_the_canonical_bzdid_verifier() {
        let dir = temp_keys_dir("bzdid-canon");
        let hook = IdentityHook::genesis(&dir, IdentityHook::test_vault()).expect("genesis");
        let material = hook.public_material().expect("public material");
        assert!(public_material_binds(&material));

        // The exported genesis bytes are the identity, checked by the
        // canonical crate — not by harness-local code.
        let genesis_bytes =
            bsigner::b64::b64u_decode(&material.genesis_op_b64u).expect("genesis bytes decode");
        let did = bzdid::BzDid::parse(hook.did()).expect("did parses canonically");
        assert_eq!(bzdid::BzDid::derive(&genesis_bytes), did);
        let op = bzdid::verify_genesis(&genesis_bytes, &did).expect("canonical verify");
        assert_eq!(op.signing_key.alg, bzdid::KeyAlg::MlDsa65);
        assert_eq!(op.signing_key.key, hook.verifying_key().expect("vk"));
        assert_eq!(op.rotation_keys.len(), 1);
        assert_eq!(op.valid_until, GENESIS_VALID_UNTIL);

        // Tampered genesis bytes are a different identity, refused by
        // the canonical verifier and by the material binding.
        let mut tampered = genesis_bytes.clone();
        let last = tampered.len() - 1;
        tampered[last] ^= 0x01;
        assert!(bzdid::verify_genesis(&tampered, &did).is_err());
        let mut bad_material = material.clone();
        bad_material.genesis_op_b64u = bsigner::b64::b64u(&tampered);
        assert!(!public_material_binds(&bad_material));

        // Material without the canonical genesis is incomplete
        // verification material and fails closed.
        let mut incomplete = material.clone();
        incomplete.genesis_op_b64u = String::new();
        assert!(!public_material_binds(&incomplete));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn tampered_checkpoint_is_refused() {
        let dir = temp_keys_dir("tamper");
        let hook = IdentityHook::genesis(&dir, IdentityHook::test_vault()).expect("genesis");
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
        let hook_a = IdentityHook::genesis(&dir_a, IdentityHook::test_vault()).expect("genesis a");
        let hook_b = IdentityHook::genesis(&dir_b, IdentityHook::test_vault()).expect("genesis b");
        let pre = hook_a.checkpoint(b"shared-prefix").expect("pre sign");
        let post = hook_b.checkpoint(b"shared-prefix-more").expect("post sign");
        assert!(!IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir_a).ok();
        std::fs::remove_dir_all(&dir_b).ok();
    }

    #[test]
    fn same_actor_against_exported_material() {
        let dir = temp_keys_dir("same-actor");
        let hook = IdentityHook::genesis(&dir, IdentityHook::test_vault()).expect("genesis");
        let material = hook.public_material().expect("public material");
        assert_eq!(material.did, hook.did());
        assert_eq!(
            did_for_verifying_key(&material.verifying_key_bytes().expect("key bytes")),
            hook.did(),
            "exported key must recompute to the DID via the genesis binding"
        );
        // Canonical transcript bytes are newline-joined messages.
        let pre = hook
            .checkpoint(b"{\"content\":\"hi\",\"role\":\"user\"}")
            .expect("pre sign");
        let post = hook
            .checkpoint(
                b"{\"content\":\"hi\",\"role\":\"user\"}\n{\"content\":\"go\",\"role\":\"user\"}",
            )
            .expect("post sign");
        assert!(IdentityHook::verify_same_actor(&pre, &post, &material));

        // Wrong expected DID: refused even though both signatures are
        // valid under the real key.
        let mut wrong_did = material.clone();
        wrong_did.did = (concat!(
            "did:b:aaaaaaaaaaaaaaaaaaaaaaaaaa",
            "aaaaaaaaaaaaaaaaaaaaaaaaaa"
        ))
        .to_string();
        assert!(!IdentityHook::verify_same_actor(&pre, &post, &wrong_did));

        // Missing verification material: refused, never a guess.
        let mut missing = material.clone();
        missing.verifying_key_b64u = String::new();
        assert!(!IdentityHook::verify_same_actor(&pre, &post, &missing));
        let mut malformed = material.clone();
        malformed.verifying_key_b64u = "!!! not base64url !!!".to_string();
        assert!(!IdentityHook::verify_same_actor(&pre, &post, &malformed));

        // Altered signed bytes: refused.
        let mut altered = post.clone();
        altered.bytes[0] ^= 0xff;
        assert!(!IdentityHook::verify_same_actor(&pre, &altered, &material));

        // A prefix that cuts a message in half is not continuity.
        let half = hook.checkpoint(b"{\"content\":\"hi\"").expect("half sign");
        assert!(!IdentityHook::verify_same_actor(&half, &post, &material));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn other_key_with_copied_did_metadata_is_refused() {
        let dir_a = temp_keys_dir("copied-a");
        let dir_b = temp_keys_dir("copied-b");
        let hook_a = IdentityHook::genesis(&dir_a, IdentityHook::test_vault()).expect("genesis a");
        let hook_b = IdentityHook::genesis(&dir_b, IdentityHook::test_vault()).expect("genesis b");
        let material_a = hook_a.public_material().expect("material a");
        let pre = hook_a.checkpoint(b"shared-prefix").expect("pre sign");
        // Attacker: a different key signs validly, then copies A's DID
        // metadata onto the checkpoint. The signature is genuine — for
        // the wrong key — so a verifier that trusts each checkpoint's
        // own key/DID fields would wave it through.
        let mut forged_post = hook_b
            .checkpoint(b"shared-prefix\ncontinued")
            .expect("post sign");
        forged_post.did = hook_a.did().to_string();
        assert!(!IdentityHook::verify_continuity(&pre, &forged_post));
        assert!(!IdentityHook::verify_same_actor(
            &pre,
            &forged_post,
            &material_a
        ));
        std::fs::remove_dir_all(&dir_a).ok();
        std::fs::remove_dir_all(&dir_b).ok();
    }

    #[test]
    fn non_prefix_post_is_refused() {
        let dir = temp_keys_dir("prefix");
        let hook = IdentityHook::genesis(&dir, IdentityHook::test_vault()).expect("genesis");
        let pre = hook.checkpoint(b"transcript-prefix").expect("pre sign");
        let post = hook.checkpoint(b"unrelated-divergence").expect("post sign");
        assert!(!IdentityHook::verify_continuity(&pre, &post));
        std::fs::remove_dir_all(&dir).ok();
    }
}
