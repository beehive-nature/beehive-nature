//! The mirror pipeline: fetch → verify (K-4) → upload → receipt. Refusal
//! is a first-class outcome: an unverifiable repo is **not mirrored**, and
//! the error names the failing gate. A hostile or partially-migrated PDS
//! can deny individual blobs; it cannot make this tool ledger an
//! unverified byte.

use sha2::{Digest, Sha256};

use crate::car::Car;
use crate::cbor;
use crate::cid::{Cid, CODEC_RAW};
use crate::commit::SignedCommit;
use crate::did::AccountIdentity;
use crate::mst::{self, BlobRef};
use crate::rail::{hex_lower, Rail, RailError};
use crate::receipt::{
    ArweaveAnchor, AutonomiAnchor, MediaPointer, Receipt, StrongRef, RECEIPT_NSID,
};
use crate::state::{BlobEntry, CommitEntry, State};
use crate::xrpc::Pds;

#[derive(Debug)]
pub enum MirrorError {
    /// Verification failed — the refusal gate. The string names the gate
    /// and the evidence; nothing was uploaded.
    Refused(String),
    /// Transport/infrastructure failure — retryable, not a verdict.
    Fetch(String),
    Upload(RailError),
    StateIo(String),
}

impl std::fmt::Display for MirrorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MirrorError::Refused(why) => write!(f, "REFUSED to mirror: {why}"),
            MirrorError::Fetch(e) => write!(f, "fetch: {e}"),
            MirrorError::Upload(e) => write!(f, "upload: {e}"),
            MirrorError::StateIo(e) => write!(f, "state: {e}"),
        }
    }
}

impl std::error::Error for MirrorError {}

/// What one mirror run did and proved. Everything here is derived from
/// re-hashed bytes, not from any server's say-so.
#[derive(Debug)]
pub struct MirrorReport {
    pub did: String,
    pub commit_cid: String,
    pub rev: String,
    pub signing_key_multibase: String,
    pub verified_blocks: usize,
    pub records: usize,
    pub receipt: Receipt,
    /// The exact CAR bytes fetched+verified this run; `None` when the run
    /// short-circuited idempotently (nothing was fetched).
    pub car_bytes: Option<Vec<u8>>,
    pub car_reused: bool,
    pub blobs_uploaded: usize,
    pub blobs_reused: usize,
    /// Blob CIDs the PDS would not serve (missing / denied). Reported, not
    /// hidden; the receipt's `media` lists only verified artifacts.
    pub missing_blobs: Vec<String>,
    /// Blob CIDs whose fetched bytes did NOT re-hash to the CID — hostile
    /// or corrupt; refused per-blob.
    pub corrupt_blobs: Vec<String>,
    /// Blob CIDs the rail refused to accept (size/funding limits). Named
    /// loudly; the CAR itself failing to upload is fatal, a blob is not.
    pub refused_uploads: Vec<String>,
    pub warnings: Vec<String>,
}

/// Mirror `identity`'s repo onto `rail`. `created_at` is supplied by the
/// caller (RFC 3339, uppercase T, Z) — no ambient clock in the library.
pub fn mirror(
    pds: &dyn Pds,
    identity: &AccountIdentity,
    rail: &mut dyn Rail,
    state: &mut State,
    created_at: &str,
) -> Result<MirrorReport, MirrorError> {
    let mut warnings = Vec::new();
    let did = identity.did.as_str();

    // 0. Idempotency probe — advisory; a lying host at worst costs a fetch.
    match pds.get_latest_commit(did) {
        Ok((latest_cid, _rev)) => {
            if let Some(hit) = state.commits.get(&latest_cid) {
                match rail.probe(&hit.address) {
                    Ok(true) | Err(RailError::Unsupported(_)) => {
                        return Ok(reuse_report(identity, &latest_cid, hit, warnings));
                    }
                    Ok(false) => warnings.push(format!(
                        "state had {latest_cid} at {} but the rail no longer serves it; re-mirroring",
                        hit.address
                    )),
                    Err(e) => warnings.push(format!(
                        "rail probe failed ({e}); proceeding with a full re-verify"
                    )),
                }
            }
        }
        Err(e) => warnings.push(format!(
            "getLatestCommit unavailable ({e}); fetching the full repo"
        )),
    }

    // 1. Fetch the CAR and verify every block re-hashes to its CID.
    let car_bytes = pds
        .get_repo(did)
        .map_err(|e| MirrorError::Fetch(format!("getRepo: {e}")))?;
    let car = Car::parse_and_verify(&car_bytes)
        .map_err(|e| MirrorError::Refused(format!("CAR verification: {e}")))?;

    // 2. Root commit: parse, bind to this DID, verify signature (low-S).
    let commit_block = car
        .get(&car.root)
        .expect("parse_and_verify guarantees the root block");
    let commit = SignedCommit::parse(car.root.clone(), commit_block)
        .map_err(|e| MirrorError::Refused(format!("commit parse: {e}")))?;
    if commit.did != did {
        return Err(MirrorError::Refused(format!(
            "commit did {} != mirrored account {did}",
            commit.did
        )));
    }
    commit
        .verify_signature(&identity.signing_key)
        .map_err(|e| {
            MirrorError::Refused(format!(
                "commit signature against DID-document key ({}): {e}",
                identity.signing_key_multibase
            ))
        })?;
    let commit_cid_str = commit.cid.to_string_b32();

    // Idempotency by verified commit CID (covers a host whose
    // getLatestCommit lied or was unavailable).
    if let Some(hit) = state.commits.get(&commit_cid_str) {
        if matches!(
            rail.probe(&hit.address),
            Ok(true) | Err(RailError::Unsupported(_))
        ) {
            let mut report = reuse_report(identity, &commit_cid_str, hit, warnings);
            report.car_bytes = Some(car_bytes);
            report.verified_blocks = car.block_count();
            return Ok(report);
        }
    }

    // 3. MST completeness + record census.
    let records = mst::walk(&car, &commit.data)
        .map_err(|e| MirrorError::Refused(format!("MST completeness: {e}")))?;

    // 4. Blob discovery: verified records first (the host cannot hide a
    // referenced blob), then union the host's own listBlobs answer.
    let mut refs: Vec<BlobRef> = Vec::new();
    for rec in &records {
        let bytes = car.get(&rec.cid).expect("walk proved presence");
        let value = cbor::decode(bytes).map_err(|e| {
            MirrorError::Refused(format!("record {} does not decode: {e}", rec.path))
        })?;
        mst::scan_blob_refs(&value, &mut refs);
    }
    match pds.list_blobs(did) {
        Ok(listed) => {
            for cid_str in listed {
                match Cid::parse_str(&cid_str) {
                    Ok(cid) if cid.codec == CODEC_RAW => refs.push(BlobRef {
                        cid,
                        mime_type: None,
                        declared_size: None,
                    }),
                    Ok(cid) => warnings.push(format!(
                        "listBlobs returned non-raw cid {} (codec {:#x}); ignored",
                        cid_str, cid.codec
                    )),
                    Err(e) => warnings.push(format!("listBlobs cid {cid_str}: {e}; ignored")),
                }
            }
        }
        Err(e) => warnings.push(format!(
            "listBlobs unavailable ({e}); continuing with record-derived blob set only"
        )),
    }
    let refs = mst::dedup_blob_refs(refs);

    // 5. Fetch + verify + upload blobs. Per-blob failure never aborts the
    // repo mirror; it is reported and excluded from the receipt.
    let mut media: Vec<MediaPointer> = Vec::new();
    let mut missing_blobs = Vec::new();
    let mut corrupt_blobs = Vec::new();
    let mut refused_uploads = Vec::new();
    let mut blobs_uploaded = 0usize;
    let mut blobs_reused = 0usize;

    for blob in &refs {
        let cid_str = blob.cid.to_string_b32();
        if let Some(entry) = state.blobs.get(&cid_str) {
            if entry.scheme == rail.scheme() {
                media.push(MediaPointer {
                    scheme: entry.scheme.clone(),
                    address: entry.address.clone(),
                    sha256: Some(entry.sha256.clone()),
                    mime_type: entry.mime_type.clone().or_else(|| blob.mime_type.clone()),
                    source_blob_cid: Some(cid_str.clone()),
                    byte_length: Some(entry.byte_length),
                });
                blobs_reused += 1;
                continue;
            }
        }
        let bytes = match pds.get_blob(did, &cid_str) {
            Ok(b) => b,
            Err(e) => {
                warnings.push(format!("blob {cid_str}: {e}"));
                missing_blobs.push(cid_str);
                continue;
            }
        };
        let digest: [u8; 32] = Sha256::digest(&bytes).into();
        if digest != blob.cid.digest {
            warnings.push(format!(
                "blob {cid_str}: fetched bytes re-hash to {} — refused (hostile or corrupt)",
                hex_lower(&digest)
            ));
            corrupt_blobs.push(cid_str);
            continue;
        }
        let sha_hex = hex_lower(&digest);
        let mime = blob
            .mime_type
            .clone()
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let tags = vec![
            ("App-Name".to_string(), "bnr-atmirror".to_string()),
            ("Repo-DID".to_string(), did.to_string()),
            ("Blob-CID".to_string(), cid_str.clone()),
            ("Content-Type".to_string(), mime.clone()),
            ("Data-SHA256".to_string(), sha_hex.clone()),
        ];
        let address = match rail.put(&bytes, &tags) {
            Ok(a) => a,
            Err(RailError::Rejected { status, body }) => {
                warnings.push(format!(
                    "blob {cid_str} ({} bytes): rail rejected upload (HTTP {status}: {body}) — \
                     excluded from receipt; re-run with a funded wallet to complete media",
                    bytes.len()
                ));
                refused_uploads.push(cid_str);
                continue;
            }
            // Out-of-funds used to arrive here as Rejected{status:402} and
            // degrade gracefully — skip this blob, keep mirroring the repo.
            // PaymentRequired must preserve that: a full run must not abort
            // because one blob crossed the free tier.
            Err(RailError::PaymentRequired {
                item_bytes,
                delegate_tried,
            }) => {
                warnings.push(format!(
                    "blob {cid_str} ({} bytes, {item_bytes} encoded): over the free tier and the \
                     signer has no credits{} — excluded from receipt; fund the wallet (or set a \
                     paying delegate) and re-run to complete media",
                    bytes.len(),
                    if delegate_tried {
                        ", and the configured delegate did not cover it"
                    } else {
                        ""
                    }
                ));
                refused_uploads.push(cid_str);
                continue;
            }
            Err(e) => return Err(MirrorError::Upload(e)),
        };
        blobs_uploaded += 1;
        state.blobs.insert(
            cid_str.clone(),
            BlobEntry {
                scheme: rail.scheme().to_string(),
                address: address.clone(),
                sha256: sha_hex.clone(),
                byte_length: bytes.len() as u64,
                mime_type: blob.mime_type.clone(),
            },
        );
        media.push(MediaPointer {
            scheme: rail.scheme().to_string(),
            address,
            sha256: Some(sha_hex),
            mime_type: blob.mime_type.clone(),
            source_blob_cid: Some(cid_str),
            byte_length: Some(bytes.len() as u64),
        });
    }

    // 6. Upload the CAR itself.
    let car_sha_hex = hex_lower(&Sha256::digest(&car_bytes));
    let car_tags = vec![
        ("App-Name".to_string(), "bnr-atmirror".to_string()),
        ("Repo-DID".to_string(), did.to_string()),
        ("Repo-Commit-CID".to_string(), commit_cid_str.clone()),
        ("Repo-Rev".to_string(), commit.rev.clone()),
        (
            "Content-Type".to_string(),
            "application/vnd.ipld.car".to_string(),
        ),
        ("Data-SHA256".to_string(), car_sha_hex.clone()),
    ];
    let car_address = rail
        .put(&car_bytes, &car_tags)
        .map_err(MirrorError::Upload)?;

    // 7. The receipt — SPEC_LEXICON-1 §4 / §5.1 repo-state form.
    let (arweave, autonomi) = match rail.scheme() {
        "ar" => (
            Some(ArweaveAnchor {
                tx_id: car_address.clone(),
                bundled: Some(true),
                settled_at: None,
                sha256: Some(car_sha_hex.clone()),
                byte_length: Some(car_bytes.len() as u64),
            }),
            None,
        ),
        _ => (
            None,
            Some(AutonomiAnchor {
                address: car_address.clone(),
                sha256: Some(car_sha_hex.clone()),
                byte_length: Some(car_bytes.len() as u64),
            }),
        ),
    };
    let receipt = Receipt {
        record_type: RECEIPT_NSID.to_string(),
        subject: StrongRef {
            uri: format!("at://{did}"),
            cid: commit_cid_str.clone(),
        },
        content_cid: commit_cid_str.clone(),
        arweave,
        autonomi,
        hive: None, // anchors land asynchronously (§4.1); broadcasting needs the founder-held posting key
        media,
        created_at: created_at.to_string(),
    };
    debug_assert!(receipt.binding_ok());

    state.commits.insert(
        commit_cid_str.clone(),
        CommitEntry {
            rev: commit.rev.clone(),
            scheme: rail.scheme().to_string(),
            address: car_address,
            sha256: car_sha_hex,
            byte_length: car_bytes.len() as u64,
            created_at: created_at.to_string(),
            receipt: receipt.clone(),
        },
    );

    Ok(MirrorReport {
        did: did.to_string(),
        commit_cid: commit_cid_str,
        rev: commit.rev,
        signing_key_multibase: identity.signing_key_multibase.clone(),
        verified_blocks: car.block_count(),
        records: records.len(),
        receipt,
        car_bytes: Some(car_bytes),
        car_reused: false,
        blobs_uploaded,
        blobs_reused,
        missing_blobs,
        corrupt_blobs,
        refused_uploads,
        warnings,
    })
}

fn reuse_report(
    identity: &AccountIdentity,
    commit_cid: &str,
    hit: &CommitEntry,
    warnings: Vec<String>,
) -> MirrorReport {
    MirrorReport {
        did: identity.did.clone(),
        commit_cid: commit_cid.to_string(),
        rev: hit.rev.clone(),
        signing_key_multibase: identity.signing_key_multibase.clone(),
        verified_blocks: 0,
        records: 0,
        receipt: hit.receipt.clone(),
        car_bytes: None,
        car_reused: true,
        blobs_uploaded: 0,
        blobs_reused: hit.receipt.media.len(),
        missing_blobs: Vec::new(),
        corrupt_blobs: Vec::new(),
        refused_uploads: Vec::new(),
        warnings,
    }
}
