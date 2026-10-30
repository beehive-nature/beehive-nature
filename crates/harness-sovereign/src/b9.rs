//! B9 — Chain of Custody: the narrow, mechanically verifiable demo task.
//!
//! The agent is given the exact raw bytes of a manifest. It must hash
//! those bytes (never decoded text), count the manifest's items, sign
//! `<input_sha256>:<item_count>:<order_id>` with its bSigner identity,
//! and write `receipt.json`. Acceptance is a program, not a judge: an
//! independent path recomputes the hash and count from the frozen
//! manifest bytes, checks the receipt is for the *requested* order,
//! and verifies the signature against public material exported before
//! the run. A run outcome alone — including `EndTurn` — is never task
//! success; the verified receipt is mandatory, and it is separate
//! from economic settlement (the settle lane).
//!
//! ## Specification reconciliation (read before changing the count)
//!
//! Two B9 sources exist and they are not the same task shape:
//!
//! - **Governing for this module — B9 Chain of Custody**, as stated in
//!   the submission draft's project summary
//!   (`hackathon-day1-submission-package-draft.md`, SHA-256 recorded
//!   in `docs/dispatches/2026-10-29-muse-spark-h01.md`): fetch a
//!   manifest, hash its exact bytes, count its items, sign
//!   `<hash>:<count>:<order_id>`, write the five-field `receipt.json`.
//!   The handoff describes the manifest as JSON with ~40 biomass
//!   items, frozen once at rehearsal. `B9-DEMO-TASK.md` itself was
//!   **not found on this seat** (not in the repository, not in the
//!   Python harness folder) — that absence is recorded, not papered
//!   over.
//! - **Referenced by the earlier fixture comment — LEDGER-KEEP**
//!   (`workspace/hackathon-harness/demo-task/task.md`, SHA-256
//!   likewise recorded in the dispatch): a byte-ledger transform over
//!   newline records producing a different four-field `result.json`.
//!   Its record-splitting rule governed *that* fixture only; it does
//!   not govern the Chain-of-Custody receipt, and this module no
//!   longer borrows its count.
//!
//! Item definition (governing, pinned here so producer and verifier
//! cannot drift): the manifest is JSON; its items are the elements of
//! the top-level array, or of the top-level object's `items` array.
//! Anything else is not a B9 manifest and fails closed. Duplicates
//! count, because custody counts the items presented. The final
//! fixture freeze remains coordinated with the evidence seat, which
//! owns fixtures and evidence documents; this module freezes only
//! the bytes a run is actually given, and test fixtures are examples
//! of the shape, not the frozen stage fixture.
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
        "B9 — Chain of Custody (order_id: {order_id}). The manifest is frozen in \
         the sandbox as input.bin (JSON, exact raw bytes). Use the b9_receipt tool \
         exactly once with args {{\"order_id\": \"{order_id}\"}} to produce \
         receipt.json, then report completion. receipt.json has exactly these keys: \
         order_id, input_sha256, item_count, signature, did. input_sha256 is the \
         SHA-256 of the raw manifest bytes — hash bytes, never decoded text. \
         item_count is the number of manifest items: the elements of the JSON \
         top-level array, or of its items array, duplicates included. The receipt \
         signs the exact string \"<input_sha256>:<item_count>:{order_id}\". \
         Acceptance recomputes the hash and count from the frozen manifest bytes, \
         checks the receipt is for order_id {order_id}, and verifies the signature \
         against the exported public key — a wrong hash, count, order, identity or \
         signature fails, and finishing your turn without receipt.json fails."
    )
}

/// Count manifest items under the governing JSON definition above.
/// Returns `None` for bytes that are not a B9 manifest at all; callers
/// must fail closed on it, never fall back to another counting rule.
pub fn count_manifest_items(manifest: &[u8]) -> Option<usize> {
    let value: serde_json::Value = serde_json::from_slice(manifest).ok()?;
    match &value {
        serde_json::Value::Array(items) => Some(items.len()),
        serde_json::Value::Object(object) => match object.get("items") {
            Some(serde_json::Value::Array(items)) => Some(items.len()),
            _ => None,
        },
        _ => None,
    }
}

/// One run definition: the single source the executable derives the
/// saved goal, the seeded task, the expected order and the verifier
/// expectations from, so they cannot drift apart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunDefinition {
    pub order_id: String,
    pub session_id: String,
    pub goal_objective: String,
    pub task_text: String,
    pub manifest_sha256: String,
    pub item_count: usize,
    pub did: String,
    pub alg: String,
}

impl RunDefinition {
    /// Build the definition from the frozen manifest bytes and the
    /// public identity material exported before model execution.
    pub fn new(
        order_id: &str,
        session_id: &str,
        manifest: &[u8],
        material: &PublicMaterial,
    ) -> Result<Self, String> {
        let item_count = count_manifest_items(manifest)
            .ok_or("manifest is not a B9 JSON manifest (array or items array)")?;
        Ok(RunDefinition {
            order_id: order_id.to_string(),
            session_id: session_id.to_string(),
            goal_objective: format!("Complete B9 Chain of Custody order {order_id}"),
            task_text: b9_task_text(order_id),
            manifest_sha256: manifest_sha256(manifest),
            item_count,
            did: material.did.clone(),
            alg: material.alg.clone(),
        })
    }

    /// The goal saved for the run; its `task_id` is the order, which
    /// is also what the seeded user task is derived from.
    pub fn goal(&self) -> serde_json::Value {
        serde_json::json!({
            "objective": self.goal_objective,
            "task_id": self.order_id,
        })
    }
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
    let item_count = count_manifest_items(manifest)
        .ok_or("manifest is not a B9 JSON manifest (array or items array)")?;
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

/// Independent verification: the receipt must be for the *requested*
/// order, the expected material must name the expected algorithm,
/// hash + count are recomputed from the frozen manifest bytes, the
/// signed payload is rebuilt, and the signature verifies against the
/// expected public material (which also binds the receipt's DID to
/// that key's canonical genesis DID).
pub fn verify_receipt(
    receipt: &B9Receipt,
    manifest: &[u8],
    expected: &PublicMaterial,
    expected_order_id: &str,
) -> bool {
    if receipt.order_id != expected_order_id {
        return false;
    }
    // Canonical material binding: expected algorithm, canonical
    // bzDiD genesis, and the DID recomputed from the key.
    if !crate::identity::public_material_binds(expected) {
        return false;
    }
    let Some(verifying_key) = expected.verifying_key_bytes() else {
        return false;
    };
    if expected.did != receipt.did {
        return false;
    }
    if receipt.input_sha256 != manifest_sha256(manifest)
        || count_manifest_items(manifest) != Some(receipt.item_count)
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

/// Verify a receipt at a path against the frozen manifest bytes and
/// the requested order.
pub fn verify_receipt_file(
    path: &Path,
    manifest: &[u8],
    expected: &PublicMaterial,
    expected_order_id: &str,
) -> Result<B9Receipt, String> {
    let receipt = read_receipt(path)?;
    if verify_receipt(&receipt, manifest, expected, expected_order_id) {
        Ok(receipt)
    } else {
        Err(
            "receipt failed independent verification (order, hash, count, identity, \
             algorithm or signature)"
                .into(),
        )
    }
}

/// A completely verified saved run: every artifact agrees with the
/// single run definition and independently verifies.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedRunReport {
    pub order_id: String,
    pub did: String,
    pub receipt: B9Receipt,
    pub checkpoint_signatures_verified: usize,
    pub same_actor_verified: bool,
    pub transcript_sha256: String,
}

/// The authenticated terminal outcome of a run, signed by the agent
/// identity at the end of the run. This replaces the earlier bare
/// outcome string: a pasted, hand-written or substring-matching
/// outcome record cannot satisfy verification, because the record
/// binds session, order, actor, manifest, final transcript and
/// checkpoint inventory under the signer's key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TerminalOutcome {
    pub session_id: String,
    pub order_id: String,
    pub did: String,
    pub manifest_sha256: String,
    pub transcript_sha256: String,
    /// Exact terminal kind: `EndTurn`, `MaxTurns`, `Cancelled` or
    /// `Error`. Compared by equality, never by substring.
    pub outcome_kind: String,
    pub checkpoint_count: usize,
    pub duration_ms: u128,
}

/// The exact bytes signed for a terminal outcome record.
pub fn terminal_outcome_payload(record: &TerminalOutcome) -> Vec<u8> {
    serde_json::to_vec(record).expect("terminal outcome serializes")
}

/// Sign a terminal outcome record with the agent identity and return
/// the JSON value written to `evidence/run-outcome.json`.
pub fn signed_terminal_outcome(
    identity: &IdentityHook,
    record: &TerminalOutcome,
) -> Result<serde_json::Value, String> {
    let signed = identity.checkpoint(&terminal_outcome_payload(record))?;
    let mut value =
        serde_json::to_value(record).map_err(|e| format!("terminal outcome JSON: {e}"))?;
    value["envelope"] = serde_json::json!({
        "did": signed.did,
        "signature_b64u": bsigner::b64::b64u(&signed.sig),
    });
    Ok(value)
}

/// Independently supplied pre-run expectations for saved-run
/// verification: the requested session and order, the actor's public
/// material (archived before the run), and the frozen manifest bytes
/// the run was given. Nothing in here is read from the run's own
/// artifacts, so swapped evidence cannot supply its own expectations.
#[derive(Debug, Clone)]
pub struct SavedRunExpectations {
    pub session_id: String,
    pub order_id: String,
    pub material: PublicMaterial,
    pub manifest: Vec<u8>,
}

/// Complete saved-run verification, from disk only — no private
/// keystore, no live harness state. Every expectation comes from the
/// caller (independently supplied before the run); the artifacts
/// must agree with those expectations and independently verify:
/// canonical material binding; definition bound to session, order,
/// actor and manifest; saved goal; seeded-task opening; byte-exact
/// canonical transcript; the complete ordered checkpoint inventory
/// identical to the persisted checkpoint log, every envelope
/// verifying over its canonical prefix (SAME ACTOR for the pair);
/// the signed terminal outcome binding session, order, actor,
/// manifest, final transcript and checkpoint count, with kind
/// exactly `EndTurn`; and the receipt verifying for the order.
pub fn verify_saved_run(
    workdir: &Path,
    run_dir: &Path,
    expectations: &SavedRunExpectations,
) -> Result<SavedRunReport, String> {
    let read_json = |path: &Path| -> Result<serde_json::Value, String> {
        let text =
            std::fs::read_to_string(path).map_err(|e| format!("read {}: {e}", path.display()))?;
        serde_json::from_str(&text).map_err(|e| format!("parse {}: {e}", path.display()))
    };
    // Expectations are independently supplied; the run's own copies
    // must agree with them, never replace them.
    let material = &expectations.material;
    if !crate::identity::public_material_binds(material) {
        return Err("public material does not bind canonically (bzDiD genesis, alg, DID)".into());
    }
    let artifact_material: PublicMaterial = {
        let value = read_json(&run_dir.join("public-material.json"))?;
        serde_json::from_value(value).map_err(|e| format!("public material shape: {e}"))?
    };
    if artifact_material != *material {
        return Err("archived public material does not match the supplied expectation".into());
    }
    let definition: RunDefinition = {
        let value = read_json(&run_dir.join("run-definition.json"))?;
        serde_json::from_value(value).map_err(|e| format!("run definition shape: {e}"))?
    };
    if definition.session_id != expectations.session_id {
        return Err(format!(
            "run definition is for session {}, not the requested session {}",
            definition.session_id, expectations.session_id
        ));
    }
    if definition.order_id != expectations.order_id {
        return Err(format!(
            "run definition is for order {}, not the requested {}",
            definition.order_id, expectations.order_id
        ));
    }
    if definition.did != material.did || definition.alg != material.alg {
        return Err("run definition identity does not match the public material".into());
    }
    let manifest = &expectations.manifest;
    let frozen = std::fs::read(run_dir.join("frozen-manifest.bin"))
        .map_err(|e| format!("read frozen manifest: {e}"))?;
    if frozen != *manifest {
        return Err("frozen manifest bytes do not match the supplied manifest".into());
    }
    if manifest_sha256(manifest) != definition.manifest_sha256
        || count_manifest_items(manifest) != Some(definition.item_count)
    {
        return Err("frozen manifest does not hash/count to the run definition".into());
    }

    let sessions = workdir.join("sessions");
    let goal = read_json(&sessions.join(format!("{}.goal.json", expectations.session_id)))?;
    if goal != definition.goal() {
        return Err("saved goal does not match the run definition goal".into());
    }
    let transcript_text =
        std::fs::read_to_string(sessions.join(format!("{}.jsonl", expectations.session_id)))
            .map_err(|e| format!("read session transcript: {e}"))?;
    let mut messages = Vec::new();
    for line in transcript_text
        .lines()
        .filter(|line| !line.trim().is_empty())
    {
        let row: serde_json::Value =
            serde_json::from_str(line).map_err(|e| format!("transcript row JSON: {e}"))?;
        let message: crate::backend::ChatMessage =
            serde_json::from_value(row.get("msg").cloned().ok_or("transcript row has no msg")?)
                .map_err(|e| format!("transcript message shape: {e}"))?;
        messages.push(message);
    }
    if messages.len() < 2
        || messages[0].role != "system"
        || messages[1].content != definition.task_text
    {
        return Err("transcript does not open with the seeded task from the run definition".into());
    }
    let canonical = crate::switch::canonical_messages(&messages);
    let evidence = run_dir.join("evidence");
    let exported = std::fs::read_to_string(evidence.join("transcript.canonical.txt"))
        .map_err(|e| format!("read exported transcript: {e}"))?;
    if exported != canonical {
        return Err(
            "exported canonical transcript is not byte-exact the session transcript".into(),
        );
    }
    let transcript_sha = crate::switch::transcript_sha256(&messages);
    let exported_sha = std::fs::read_to_string(evidence.join("transcript.sha256"))
        .map_err(|e| format!("read exported transcript hash: {e}"))?;
    if exported_sha.trim() != transcript_sha {
        return Err("exported transcript hash does not match the transcript".into());
    }

    // Complete ordered checkpoint inventory: the exported evidence
    // must be an array identical, entry for entry and in order, to
    // the persisted checkpoint log for the requested session. A
    // removed, reordered, stripped or malformed entry is rejected —
    // checkpoint evidence is never skipped silently.
    // A session that never checkpointed has no persisted log; that
    // is an empty inventory, and the exported evidence must then be
    // empty too (the equality check below enforces it). Any other
    // read failure is an error.
    let persisted_text = match std::fs::read_to_string(
        sessions.join(format!("{}.checkpoints.jsonl", expectations.session_id)),
    ) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("read persisted checkpoint log: {error}")),
    };
    let mut persisted: Vec<serde_json::Value> = Vec::new();
    for line in persisted_text
        .lines()
        .filter(|line| !line.trim().is_empty())
    {
        persisted
            .push(serde_json::from_str(line).map_err(|e| format!("checkpoint log row JSON: {e}"))?);
    }
    let checkpoints = read_json(&evidence.join("checkpoints.json"))?;
    let Some(exported) = checkpoints.as_array() else {
        return Err("exported checkpoint evidence is not an array".into());
    };
    if exported.as_slice() != persisted.as_slice() {
        return Err(
            "exported checkpoint inventory is not the complete ordered persisted log".into(),
        );
    }
    // Every signed envelope verifies over its canonical prefix, in
    // order with non-decreasing turn counts — not only first/last.
    let verifying_key = material
        .verifying_key_bytes()
        .ok_or("public material key does not decode")?;
    let mut signed: Vec<crate::identity::SignedCheckpoint> = Vec::new();
    let mut previous_turn_count: Option<usize> = None;
    for checkpoint in exported {
        let envelope = checkpoint
            .get("bsigner_envelope")
            .filter(|envelope| !envelope.is_null())
            .ok_or("checkpoint entry has no signature envelope")?;
        let turn_count = checkpoint
            .get("turn_count")
            .and_then(|n| n.as_u64())
            .ok_or("checkpoint has no turn_count")? as usize;
        if turn_count > messages.len() {
            return Err("checkpoint turn_count exceeds the transcript".into());
        }
        if previous_turn_count.is_some_and(|previous| turn_count < previous) {
            return Err("checkpoint inventory is not in transcript order".into());
        }
        previous_turn_count = Some(turn_count);
        let prefix = &messages[..turn_count];
        if crate::switch::transcript_sha256(prefix)
            != checkpoint["transcript_sha256"].as_str().unwrap_or("")
        {
            return Err("checkpoint transcript hash does not match its prefix".into());
        }
        let signature_text = envelope["signature_b64u"]
            .as_str()
            .ok_or("checkpoint envelope has no signature")?;
        let signature = bsigner::b64::b64u_decode(signature_text)
            .ok_or("checkpoint signature is not base64url")?;
        let candidate = crate::identity::SignedCheckpoint {
            did: envelope["did"].as_str().unwrap_or("").to_string(),
            verifying_key: verifying_key.clone(),
            bytes: crate::switch::canonical_messages(prefix).into_bytes(),
            sig: signature,
        };
        let verifies = bsigner::pq::dsa_verify(
            bsigner::alg::SigAlg::MlDsa65,
            &candidate.verifying_key,
            &candidate.bytes,
            &candidate.sig,
        )
        .unwrap_or(false);
        if !verifies || candidate.did != material.did {
            return Err("a checkpoint signature does not verify".into());
        }
        signed.push(candidate);
    }
    let mut same_actor_verified = false;
    if signed.len() >= 2 {
        same_actor_verified = crate::identity::IdentityHook::verify_same_actor(
            &signed[0],
            &signed[signed.len() - 1],
            material,
        );
        if !same_actor_verified {
            return Err("checkpoint pair does not verify as SAME ACTOR".into());
        }
    }

    // Authenticated terminal outcome: the signed record must bind
    // this session, order, actor, manifest, final transcript and
    // checkpoint inventory, and its kind must be exactly EndTurn.
    let outcome = read_json(&evidence.join("run-outcome.json"))?;
    let record: TerminalOutcome = {
        let mut fields = outcome.clone();
        if let Some(object) = fields.as_object_mut() {
            object.remove("envelope");
        }
        serde_json::from_value(fields).map_err(|e| format!("terminal outcome record shape: {e}"))?
    };
    if record.session_id != expectations.session_id
        || record.order_id != expectations.order_id
        || record.did != material.did
        || record.manifest_sha256 != definition.manifest_sha256
        || record.transcript_sha256 != transcript_sha
        || record.checkpoint_count != signed.len()
    {
        return Err("terminal outcome does not bind the executed run".into());
    }
    let envelope = outcome
        .get("envelope")
        .ok_or("terminal outcome has no signature envelope")?;
    if envelope["did"].as_str().unwrap_or("") != material.did {
        return Err("terminal outcome signer is not the expected actor".into());
    }
    let outcome_signature = envelope["signature_b64u"]
        .as_str()
        .and_then(bsigner::b64::b64u_decode)
        .ok_or("terminal outcome signature is not base64url")?;
    let outcome_verifies = bsigner::pq::dsa_verify(
        bsigner::alg::SigAlg::MlDsa65,
        &verifying_key,
        &terminal_outcome_payload(&record),
        &outcome_signature,
    )
    .unwrap_or(false);
    if !outcome_verifies {
        return Err("terminal outcome signature does not verify".into());
    }
    if record.outcome_kind != "EndTurn" {
        return Err(format!(
            "terminal outcome is {}, not EndTurn",
            record.outcome_kind
        ));
    }
    let receipt = verify_receipt_file(
        &run_dir.join("receipt.json"),
        &manifest,
        &material,
        &definition.order_id,
    )?;
    Ok(SavedRunReport {
        order_id: definition.order_id.clone(),
        did: definition.did.clone(),
        receipt,
        checkpoint_signatures_verified: signed.len(),
        same_actor_verified,
        transcript_sha256: transcript_sha,
    })
}

/// Task acceptance for a finished coordinator run. Backend exhaustion
/// (an `Err` run), cancellation and turn exhaustion all fail; `EndTurn`
/// also fails without a receipt for the requested order that
/// independently verifies.
pub fn accept_completed_run(
    run: &Result<RunOutcome, CoordError>,
    receipt_path: &Path,
    manifest: &[u8],
    expected: &PublicMaterial,
    expected_order_id: &str,
) -> Result<B9Receipt, String> {
    match run {
        Err(error) => Err(format!("run did not complete (backend failure): {error}")),
        Ok(RunOutcome::Cancelled) => Err("run was cancelled: no B9 acceptance".into()),
        Ok(RunOutcome::MaxTurns) => Err("turn budget exhausted: no B9 acceptance".into()),
        Ok(RunOutcome::EndTurn) => {
            verify_receipt_file(receipt_path, manifest, expected, expected_order_id)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::IdentityHook;
    use std::path::PathBuf;

    // JSON biomass-shaped example fixture (governing Chain-of-Custody
    // definition; not the frozen stage fixture): a top-level array
    // with a duplicate item, formatted with mixed whitespace — the
    // raw bytes are what get hashed, the parsed items are counted.
    const MANIFEST: &[u8] =
        b"[\r\n {\"id\": \"bio-0007\", \"kg\": 120},\n {\"id\": \"bio-0042\", \"kg\": 98},\r\n {\"id\": \"bio-0042\", \"kg\": 98}\n]";

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
        assert_eq!(count_manifest_items(MANIFEST), Some(3));
        assert_eq!(
            count_manifest_items(b"{\"items\": [{\"id\": 1}, {\"id\": 2}]}"),
            Some(2)
        );
        assert_eq!(count_manifest_items(b"[]"), Some(0));
        // Not a B9 manifest: fail closed, never a fallback count. The
        // LEDGER-KEEP newline shape is a different task's input.
        assert_eq!(count_manifest_items(b"a\r\nb\na\n"), None);
        assert_eq!(count_manifest_items(b""), None);
        assert_eq!(count_manifest_items(b"{\"no_items\": true}"), None);
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
        assert_eq!(receipt.item_count, 3);
        assert_eq!(receipt.did, material.did);
        assert!(verify_receipt(&receipt, MANIFEST, &material, "demo-task"));

        let path = dir.join("receipt.json");
        write_receipt(&path, &receipt).expect("write");
        let back =
            verify_receipt_file(&path, MANIFEST, &material, "demo-task").expect("verify file");
        assert_eq!(back, receipt);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn valid_receipt_for_a_different_order_is_rejected() {
        let (dir, identity, material) = fixture("order-binding");
        // A genuinely valid receipt: same key, same manifest, its
        // signature verifies — but it was produced for ORDER-A while
        // ORDER-B is the requested order.
        let receipt = produce_receipt(&identity, MANIFEST, "ORDER-A").expect("receipt");
        assert!(verify_receipt(&receipt, MANIFEST, &material, "ORDER-A"));
        assert!(
            !verify_receipt(&receipt, MANIFEST, &material, "ORDER-B"),
            "a valid receipt for another order must not satisfy this order"
        );
        let path = dir.join("receipt.json");
        write_receipt(&path, &receipt).expect("write");
        assert!(verify_receipt_file(&path, MANIFEST, &material, "ORDER-B").is_err());
        assert!(accept_completed_run(
            &Ok(RunOutcome::EndTurn),
            &path,
            MANIFEST,
            &material,
            "ORDER-B"
        )
        .is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn unexpected_public_material_alg_is_rejected() {
        let (dir, identity, material) = fixture("alg-binding");
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");
        assert!(verify_receipt(&receipt, MANIFEST, &material, "demo-task"));
        for alg in ["ml-dsa-44", "ml-dsa-87", "ed25519", ""] {
            let mut wrong_alg = material.clone();
            wrong_alg.alg = alg.to_string();
            assert!(
                !verify_receipt(&receipt, MANIFEST, &wrong_alg, "demo-task"),
                "alg {alg:?} must be rejected, not dispatched on"
            );
        }
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn wrong_hash_count_identity_and_signature_all_fail() {
        let (dir, identity, material) = fixture("tamper");
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");

        let mut bad = receipt.clone();
        bad.input_sha256 = manifest_sha256(b"other bytes");
        assert!(
            !verify_receipt(&bad, MANIFEST, &material, "demo-task"),
            "wrong hash"
        );

        let mut bad = receipt.clone();
        bad.item_count += 1;
        assert!(
            !verify_receipt(&bad, MANIFEST, &material, "demo-task"),
            "wrong count"
        );

        let mut bad = receipt.clone();
        bad.order_id = "other-order".into();
        assert!(
            !verify_receipt(&bad, MANIFEST, &material, "demo-task"),
            "wrong order"
        );

        let mut bad = receipt.clone();
        bad.did = (concat!(
            "did:b:aaaaaaaaaaaaaaaaaaaaaaaaaa",
            "aaaaaaaaaaaaaaaaaaaaaaaaaa"
        ))
        .into();
        assert!(
            !verify_receipt(&bad, MANIFEST, &material, "demo-task"),
            "wrong identity"
        );

        let mut bad = receipt.clone();
        let mut sig = bsigner::b64::b64u_decode(&bad.signature).expect("sig decodes");
        sig[0] ^= 0xff;
        bad.signature = bsigner::b64::b64u(&sig);
        assert!(
            !verify_receipt(&bad, MANIFEST, &material, "demo-task"),
            "wrong signature"
        );

        // Receipt is bound to the manifest: other bytes fail even with
        // the original, internally consistent receipt.
        assert!(!verify_receipt(
            &receipt,
            b"[{\"id\": \"bio-9999\"}]",
            &material,
            "demo-task"
        ));
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
            !verify_receipt(&receipt, MANIFEST, &other_material, "demo-task"),
            "another actor's public material must not verify this receipt"
        );

        let missing = PublicMaterial {
            did: material.did.clone(),
            alg: material.alg.clone(),
            verifying_key_b64u: String::new(),
            genesis_op_b64u: String::new(),
        };
        assert!(
            !verify_receipt(&receipt, MANIFEST, &missing, "demo-task"),
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
        assert!(accept_completed_run(&ok_run, &path, MANIFEST, &material, "demo-task").is_err());

        // EndTurn with a verified receipt: pass.
        let receipt = produce_receipt(&identity, MANIFEST, "demo-task").expect("receipt");
        write_receipt(&path, &receipt).expect("write");
        assert!(accept_completed_run(&ok_run, &path, MANIFEST, &material, "demo-task").is_ok());

        // Cancellation, turn exhaustion and backend exhaustion fail
        // even when a valid receipt is on disk.
        assert!(accept_completed_run(
            &Ok(RunOutcome::Cancelled),
            &path,
            MANIFEST,
            &material,
            "demo-task"
        )
        .is_err());
        assert!(accept_completed_run(
            &Ok(RunOutcome::MaxTurns),
            &path,
            MANIFEST,
            &material,
            "demo-task"
        )
        .is_err());
        assert!(accept_completed_run(
            &Err(CoordError::BackendsExhausted {
                reason: "all down".into()
            }),
            &path,
            MANIFEST,
            &material,
            "demo-task"
        )
        .is_err());
        std::fs::remove_dir_all(&dir).ok();
    }
}
