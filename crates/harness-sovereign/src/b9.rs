//! B9 — Chain of Custody: the narrow, mechanically verifiable demo task.
//!
//! The agent is given the exact raw bytes of a manifest. It must hash
//! those bytes (never decoded text), count the manifest's items, sign
//! `<input_sha256>:<item_count>:<order_id>` with its bSigner identity,
//! and write `receipt.json`. Acceptance is a program, not a judge: an
//! independent path recomputes the hash and count from the frozen
//! manifest bytes and verifies the signature against public material
//! exported before the run. A run outcome alone — including `EndTurn` —
//! is never task success; the verified receipt is mandatory, and it is
//! separate from economic settlement (the settle lane).
//!
//! Item definition (pinned here so producer and verifier cannot drift):
//! split the raw bytes on `\n`, strip one trailing `\r` from each part,
//! and count the non-empty parts. A final empty part (file terminator)
//! is dropped by that rule; duplicate items count, because custody
//! counts the items presented.
//!
//! The signature representation is the harness's documented one: raw
//! ML-DSA-65 signature bytes encoded with [`bsigner::b64::b64u`]
//! (base64url, no padding) — the same representation checkpoint
//! envelopes already use as `signature_b64u`. bSigner's contract is
//! unchanged; signing goes through [`IdentityHook::checkpoint`], the
//! existing library interface.

use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::identity::{IdentityHook, PublicMaterial};
use crate::switch::{CoordError, RunOutcome};

/// The actual B9 user task, seeded exactly once before the first
/// backend request (H01A). `order_id` identifies this custody order.
pub fn b9_task_text(order_id: &str) -> String {
    format!(
        "B9 — Chain of Custody (order_id: {order_id}). You are given a manifest as \
         exact raw bytes (input.bin in the sandbox). Produce receipt.json with \
         exactly these keys: order_id, input_sha256, item_count, signature, did. \
         Steps: (1) input_sha256 is the SHA-256 of the raw manifest bytes — hash \
         bytes, never decoded text; (2) item_count is the count of manifest items: \
         split the raw bytes on \\n, strip one trailing \\r per record, drop empty \
         records (including the final terminator), count the rest, duplicates \
         included; (3) sign the exact string \"<input_sha256>:<item_count>:{order_id}\" \
         with your bSigner identity and put the base64url (no padding) signature in \
         signature; (4) did is your agent DID. Acceptance recomputes the hash and \
         count from the frozen manifest bytes and verifies the signature against \
         your exported public key — a wrong hash, count, identity or signature \
         fails, and finishing your turn without receipt.json fails."
    )
}

/// Count manifest items under the pinned definition above.
pub fn count_manifest_items(manifest: &[u8]) -> usize {
    manifest
        .split(|byte| *byte == b'\n')
        .filter(|part| {
            let part = part.strip_suffix(b"\r").unwrap_or(part);
            !part.is_empty()
        })
        .count()
}

/// Hex SHA-256 of the exact raw manifest bytes.
pub fn manifest_sha256(manifest: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(manifest);
    format!("{:x}", hasher.finalize())
}

/// The exact string that is signed for a B9 receipt.
pub fn signed_payload(input_sha256: &str, item_count: usize, order_id: &str) -> String {
    format!("{input_sha256}:{item_count}:{order_id}")
}

/// `receipt.json`: the mandatory, independently verifiable B9 artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct B9Receipt {
    pub order_id: String,
    pub input_sha256: String,
    pub item_count: usize,
    pub signature: String,
    pub did: String,
}

/// Produce the receipt: freeze hash + count from the raw bytes, then
/// sign the payload through the existing bSigner library interface.
pub fn produce_receipt(
    identity: &IdentityHook,
    manifest: &[u8],
    order_id: &str,
) -> Result<B9Receipt, String> {
    let input_sha256 = manifest_sha256(manifest);
    let item_count = count_manifest_items(manifest);
    let payload = signed_payload(&input_sha256, item_count, order_id);
    let signed = identity.checkpoint(payload.as_bytes())?;
    if signed.did != identity.did() {
        return Err("signer DID does not match the agent identity".to_string());
    }
    Ok(B9Receipt {
        order_id: order_id.to_string(),
        input_sha256,
        item_count,
        signature: bsigner::b64::b64u(&signed.sig),
        did: signed.did,
    })
}

/// Write `receipt.json` (pretty JSON, trailing newline).
pub fn write_receipt(path: &Path, receipt: &B9Receipt) -> Result<(), String> {
    let text = serde_json::to_string_pretty(receipt).map_err(|e| format!("receipt JSON: {e}"))?;
    std::fs::write(path, format!("{text}\n")).map_err(|e| format!("write receipt: {e}"))
}

/// Read a receipt file; a missing or unreadable receipt is an error,
/// never a pass.
pub fn read_receipt(path: &Path) -> Result<B9Receipt, String> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| format!("missing or unreadable receipt {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("receipt is not valid JSON: {e}"))
}

/// Independent verification: recompute hash + count from the frozen
/// manifest bytes, rebuild the signed payload, and verify the
/// signature against the expected public material (which also binds
/// the receipt's DID to that key's canonical genesis DID).
pub fn verify_receipt(receipt: &B9Receipt, manifest: &[u8], expected: &PublicMaterial) -> bool {
    let Some(verifying_key) = expected.verifying_key_bytes() else {
        return false;
    };
    if verifying_key.is_empty() || expected.did != receipt.did {
        return false;
    }
    if crate::identity::did_for_verifying_key(&verifying_key) != receipt.did {
        return false;
    }
    if receipt.input_sha256 != manifest_sha256(manifest)
        || receipt.item_count != count_manifest_items(manifest)
    {
        return false;
    }
    let payload = signed_payload(&receipt.input_sha256, receipt.item_count, &receipt.order_id);
    let Some(signature) = bsigner::b64::b64u_decode(&receipt.signature) else {
        return false;
    };
    bsigner::pq::dsa_verify(
        bsigner::alg::SigAlg::MlDsa65,
        &verifying_key,
        payload.as_bytes(),
        &signature,
    )
    .unwrap_or(false)
}

/// Verify a receipt at a path against the frozen manifest bytes.
pub fn verify_receipt_file(
    path: &Path,
    manifest: &[u8],
    expected: &PublicMaterial,
) -> Result<B9Receipt, String> {
    let receipt = read_receipt(path)?;
    if verify_receipt(&receipt, manifest, expected) {
        Ok(receipt)
    } else {
        Err("receipt failed independent verification (hash, count, identity or signature)".into())
    }
}

/// Task acceptance for a finished coordinator run. Backend exhaustion
/// (an `Err` run), cancellation and turn exhaustion all fail; `EndTurn`
/// also fails without a receipt that independently verifies.
pub fn accept_completed_run(
    run: &Result<RunOutcome, CoordError>,
    receipt_path: &Path,
    manifest: &[u8],
    expected: &PublicMaterial,
) -> Result<B9Receipt, String> {
    match run {
        Err(error) => Err(format!("run did not complete (backend failure): {error}")),
        Ok(RunOutcome::Cancelled) => Err("run was cancelled: no B9 acceptance".into()),
        Ok(RunOutcome::MaxTurns) => Err("turn budget exhausted: no B9 acceptance".into()),
        Ok(RunOutcome::EndTurn) => verify_receipt_file(receipt_path, manifest, expected),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::IdentityHook;
    use std::path::PathBuf;

    // LEDGER-KEEP-shaped fixture (demo-task/task.md): mixed CRLF/LF, a
    // duplicate record, an unterminated final record.
    const MANIFEST: &[u8] = b"rec-0007,alpha,120\r\nrec-0042,bravo,98\nrec-0013,charlie,455\r\nrec-0042,bravo,98\nrec-0001,delta,7\nrec-0029,echo,1000\r\nrec-0029,echo,1000";

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("harness-b9-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn fixture(tag: &str) -> (PathBuf, IdentityHook, PublicMaterial) {
        let dir = temp_dir(tag);
        let keys = dir.join("keys");
        std::fs::create_dir_all(&keys).expect("keys dir");
        let identity = IdentityHook::genesis(&keys, IdentityHook::test_vault()).expect("genesis");
        let material = identity.public_material().expect("public material");
        (dir, identity, material)
    }

    #[test]
    fn item_count_and_payload_are_pinned() {
        assert_eq!(count_manifest_items(MANIFEST), 7);
        assert_eq!(count_manifest_items(b"a\r\nb\na\n"), 3);
        assert_eq!(count_manifest_items(b""), 0);
        assert_eq!(signed_payload("ab", 3, "ORD-1"), "ab:3:ORD-1");
        // Independent hash oracle: sha256 of the empty input is a
        // published constant, not a value copied from the code.
        assert_eq!(
            manifest_sha256(b""),
            concat!(
                "e3b0c44298fc1c149afbf4c8996fb924",
                "27ae41e4649b934ca495991b7852b855"
            )
        );
    }

    #[test]
    fn receipt_roundtrip_verifies_independently() {
        let (dir, identity, material) = fixture("roundtrip");
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");
        assert_eq!(receipt.order_id, "demo-task");
        assert_eq!(receipt.item_count, 7);
        assert_eq!(receipt.did, material.did);
        assert!(verify_receipt(&receipt, MANIFEST, &material));

        let path = dir.join("receipt.json");
        write_receipt(&path, &receipt).expect("write");
        let back = verify_receipt_file(&path, MANIFEST, &material).expect("verify file");
        assert_eq!(back, receipt);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn wrong_hash_count_identity_and_signature_all_fail() {
        let (dir, identity, material) = fixture("tamper");
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");

        let mut bad = receipt.clone();
        bad.input_sha256 = manifest_sha256(b"other bytes");
        assert!(!verify_receipt(&bad, MANIFEST, &material), "wrong hash");

        let mut bad = receipt.clone();
        bad.item_count += 1;
        assert!(!verify_receipt(&bad, MANIFEST, &material), "wrong count");

        let mut bad = receipt.clone();
        bad.order_id = "other-order".into();
        assert!(!verify_receipt(&bad, MANIFEST, &material), "wrong order");

        let mut bad = receipt.clone();
        bad.did = (concat!(
            "did:b:aaaaaaaaaaaaaaaaaaaaaaaaaa",
            "aaaaaaaaaaaaaaaaaaaaaaaaaa"
        ))
        .into();
        assert!(!verify_receipt(&bad, MANIFEST, &material), "wrong identity");

        let mut bad = receipt.clone();
        let mut sig = bsigner::b64::b64u_decode(&bad.signature).expect("sig decodes");
        sig[0] ^= 0xff;
        bad.signature = bsigner::b64::b64u(&sig);
        assert!(
            !verify_receipt(&bad, MANIFEST, &material),
            "wrong signature"
        );

        // Receipt is bound to the manifest: other bytes fail even with
        // the original, internally consistent receipt.
        assert!(!verify_receipt(&receipt, b"rec-9999,other,1\n", &material));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn other_actor_and_missing_material_fail() {
        let (dir, identity, material) = fixture("actor-a");
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");

        let other_keys = dir.join("keys-b");
        std::fs::create_dir_all(&other_keys).expect("keys b");
        let other = IdentityHook::genesis(&other_keys, IdentityHook::test_vault()).expect("other");
        let other_material = other.public_material().expect("other material");
        assert!(
            !verify_receipt(&receipt, MANIFEST, &other_material),
            "another actor's public material must not verify this receipt"
        );

        let missing = PublicMaterial {
            did: material.did.clone(),
            alg: material.alg.clone(),
            verifying_key_b64u: String::new(),
        };
        assert!(
            !verify_receipt(&receipt, MANIFEST, &missing),
            "missing verification material must fail closed"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn acceptance_requires_a_verified_receipt_not_just_end_turn() {
        let (dir, identity, material) = fixture("accept");
        let path = dir.join("receipt.json");
        let ok_run: Result<RunOutcome, CoordError> = Ok(RunOutcome::EndTurn);

        // EndTurn with no receipt file at all: fail.
        assert!(accept_completed_run(&ok_run, &path, MANIFEST, &material).is_err());

        // EndTurn with a verified receipt: pass.
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");
        write_receipt(&path, &receipt).expect("write");
        assert!(accept_completed_run(&ok_run, &path, MANIFEST, &material).is_ok());

        // Cancellation, turn exhaustion and backend exhaustion fail
        // even when a valid receipt is on disk.
        assert!(
            accept_completed_run(&Ok(RunOutcome::Cancelled), &path, MANIFEST, &material).is_err()
        );
        assert!(
            accept_completed_run(&Ok(RunOutcome::MaxTurns), &path, MANIFEST, &material).is_err()
        );
        assert!(accept_completed_run(
            &Err(CoordError::BackendsExhausted {
                reason: "all down".into()
            }),
            &path,
            MANIFEST,
            &material
        )
        .is_err());
        std::fs::remove_dir_all(&dir).ok();
    }
}
