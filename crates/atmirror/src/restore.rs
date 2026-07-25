//! Reconstruction from the permanence rail **alone** — acceptance A of the
//! mirror docket. No PDS is contacted: the CAR comes back from the rail by
//! content address, every block re-hashes, the MST re-walks complete, and
//! every blob re-hashes against the receipt's `sha256` and its
//! `sourceBlobCid` (§8 steps 1–5). Step 6 — authorship — runs only against
//! a key the **caller** supplies; with none, the outcome says NOT
//! PERFORMED instead of silently phoning a resolver (offline-or-fail
//! default, founder-ratified: a verifier must be able to tell whether
//! independence was proven or granted).
//!
//! Structurally: this module imports no DID resolver and no PDS client —
//! there is no code path here that *could* reach Bluesky infrastructure.
//!
//! This is SPEC_LEXICON-1 §8 in executable form; a third party needs none
//! of this code to do the same with curl and sha256sum (§8 is the
//! acceptance bar, and the docket receipt ships the transcript).

use sha2::{Digest, Sha256};

use crate::car::Car;
use crate::cid::Cid;
use crate::commit::{SignedCommit, SigningKey};
use crate::mst;
use crate::rail::{hex_lower, Rail, RailError};
use crate::receipt::{MediaPointer, Receipt};

#[derive(Debug)]
pub enum RestoreError {
    /// The receipt or the fetched bytes fail verification. Names the gate.
    Rejected(String),
    Rail(RailError),
}

impl std::fmt::Display for RestoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RestoreError::Rejected(why) => write!(f, "REJECTED: {why}"),
            RestoreError::Rail(e) => write!(f, "rail: {e}"),
        }
    }
}

impl std::error::Error for RestoreError {}

/// §8 step 6 (authorship), as an explicit tri-state the caller must
/// surface. The epistemic rule (founder-ratified, DISPATCH-2026-07-25-B
/// CC-1): a green verify must say whether independence was **proven**
/// (offline pinned key) or **granted** (a network resolver was trusted) —
/// or that the step was **not performed** at all. Silence is the defect.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Authorship {
    /// Signature verified against a caller-supplied key. The caller states
    /// where that key came from; this library never resolves one.
    Verified,
    /// No key supplied; §8 steps 1–5 ran, step 6 did not. Not a failure —
    /// a scoped result, reported as exactly that.
    NotPerformed,
}

#[derive(Debug)]
pub struct RestoreOutcome {
    pub did: String,
    pub commit_cid: String,
    pub rev: String,
    pub blocks: usize,
    pub records: usize,
    /// §8 step 6 status. [`Authorship::Verified`] only when a key was
    /// supplied and the commit signature checked out (a bad signature is a
    /// hard [`RestoreError::Rejected`], never a soft state here).
    pub authorship: Authorship,
    pub car_bytes: Vec<u8>,
    /// Verified blobs, in receipt order.
    pub blobs: Vec<(MediaPointer, Vec<u8>)>,
    /// Pointers that could not be fetched or did not verify — named, not
    /// papered over. Any entry here makes the restore PARTIAL.
    pub blob_failures: Vec<String>,
}

/// Rebuild and re-verify a mirrored repo from `rail`, trusting only the
/// receipt's hashes — and, when `key` is supplied, verify authorship
/// against it (§8 step 6). With `key: None`, steps 1–5 still run at full
/// strictness and the outcome reports step 6 as not performed. This
/// module deliberately imports no DID resolver and no PDS client: the
/// only way a key exists here is that the caller handed one in.
pub fn restore(
    receipt: &Receipt,
    rail: &dyn Rail,
    key: Option<&SigningKey>,
) -> Result<RestoreOutcome, RestoreError> {
    // §5 MUST / A5: contentCid == subject.cid, right type.
    if !receipt.binding_ok() {
        return Err(RestoreError::Rejected(format!(
            "receipt binding invalid: $type={} contentCid={} subject.cid={}",
            receipt.record_type, receipt.content_cid, receipt.subject.cid
        )));
    }
    let did = receipt
        .subject
        .uri
        .strip_prefix("at://")
        .filter(|rest| rest.starts_with("did:"))
        .ok_or_else(|| {
            RestoreError::Rejected(format!(
                "subject.uri {:?} is not a repo-root at:// DID uri",
                receipt.subject.uri
            ))
        })?
        // Repo-root receipts use `at://<did>`; tolerate a trailing path
        // only by refusing it — this tool receipts whole repos.
        .to_string();
    if did.contains('/') {
        return Err(RestoreError::Rejected(format!(
            "subject.uri {:?} points below the repo root",
            receipt.subject.uri
        )));
    }

    // Locate the CAR anchor for this rail.
    let (address, anchor_sha, anchor_len) = match rail.scheme() {
        "ar" => {
            let a = receipt.arweave.as_ref().ok_or_else(|| {
                RestoreError::Rejected("receipt has no arweave anchor for an ar rail".into())
            })?;
            (a.tx_id.clone(), a.sha256.clone(), a.byte_length)
        }
        "ant" => {
            let a = receipt.autonomi.as_ref().ok_or_else(|| {
                RestoreError::Rejected("receipt has no autonomi anchor for an ant rail".into())
            })?;
            (a.address.clone(), a.sha256.clone(), a.byte_length)
        }
        other => {
            return Err(RestoreError::Rejected(format!(
                "unknown rail scheme {other:?}"
            )))
        }
    };

    // Fetch the CAR from the rail and hold it to the receipt's hashes.
    let car_bytes = rail.get(&address).map_err(RestoreError::Rail)?;
    if let Some(expected_len) = anchor_len {
        if car_bytes.len() as u64 != expected_len {
            return Err(RestoreError::Rejected(format!(
                "CAR from rail is {} bytes; receipt says {expected_len}",
                car_bytes.len()
            )));
        }
    }
    if let Some(expected_sha) = &anchor_sha {
        let got = hex_lower(&Sha256::digest(&car_bytes));
        if &got != expected_sha {
            return Err(RestoreError::Rejected(format!(
                "CAR sha256 {got} != receipt {expected_sha}"
            )));
        }
    }

    // Re-verify structure and signature — the rail's copy must stand on
    // its own.
    let car = Car::parse_and_verify(&car_bytes)
        .map_err(|e| RestoreError::Rejected(format!("CAR verification: {e}")))?;
    let content_cid = Cid::parse_str(&receipt.content_cid)
        .map_err(|e| RestoreError::Rejected(format!("contentCid: {e}")))?;
    if car.root != content_cid {
        return Err(RestoreError::Rejected(format!(
            "CAR root {} != contentCid {}",
            car.root.to_string_b32(),
            receipt.content_cid
        )));
    }
    let commit_block = car.get(&car.root).expect("root presence proven");
    let commit = SignedCommit::parse(car.root.clone(), commit_block)
        .map_err(|e| RestoreError::Rejected(format!("commit parse: {e}")))?;
    if commit.did != did {
        return Err(RestoreError::Rejected(format!(
            "commit did {} != subject did {did}",
            commit.did
        )));
    }
    let authorship = match key {
        Some(key) => {
            commit
                .verify_signature(key)
                .map_err(|e| RestoreError::Rejected(format!("commit signature: {e}")))?;
            Authorship::Verified
        }
        None => Authorship::NotPerformed,
    };
    let records = mst::walk(&car, &commit.data)
        .map_err(|e| RestoreError::Rejected(format!("MST completeness: {e}")))?;

    // Blobs: every pointer must carry sha256 and it must match; a
    // sourceBlobCid, when present, must also re-hash.
    let mut blobs = Vec::new();
    let mut blob_failures = Vec::new();
    for pointer in &receipt.media {
        if pointer.scheme != rail.scheme() {
            blob_failures.push(format!(
                "{}: scheme {} not served by this rail",
                pointer.address, pointer.scheme
            ));
            continue;
        }
        let bytes = match rail.get(&pointer.address) {
            Ok(b) => b,
            Err(e) => {
                blob_failures.push(format!("{}: {e}", pointer.address));
                continue;
            }
        };
        let got_sha = hex_lower(&Sha256::digest(&bytes));
        match &pointer.sha256 {
            Some(expected) if *expected == got_sha => {}
            Some(expected) => {
                blob_failures.push(format!(
                    "{}: sha256 {got_sha} != receipt {expected}",
                    pointer.address
                ));
                continue;
            }
            None => {
                blob_failures.push(format!(
                    "{}: pointer carries no sha256 — unverifiable, refused",
                    pointer.address
                ));
                continue;
            }
        }
        if let Some(len) = pointer.byte_length {
            if bytes.len() as u64 != len {
                blob_failures.push(format!(
                    "{}: {} bytes != receipt byteLength {len}",
                    pointer.address,
                    bytes.len()
                ));
                continue;
            }
        }
        if let Some(cid_str) = &pointer.source_blob_cid {
            match Cid::parse_str(cid_str) {
                Ok(cid) => {
                    let digest: [u8; 32] = Sha256::digest(&bytes).into();
                    if digest != cid.digest {
                        blob_failures.push(format!(
                            "{}: bytes do not re-hash to sourceBlobCid {cid_str}",
                            pointer.address
                        ));
                        continue;
                    }
                }
                Err(e) => {
                    blob_failures.push(format!("{}: sourceBlobCid: {e}", pointer.address));
                    continue;
                }
            }
        }
        blobs.push((pointer.clone(), bytes));
    }

    Ok(RestoreOutcome {
        did,
        commit_cid: receipt.content_cid.clone(),
        rev: commit.rev.clone(),
        blocks: car.block_count(),
        records: records.len(),
        authorship,
        car_bytes,
        blobs,
        blob_failures,
    })
}
