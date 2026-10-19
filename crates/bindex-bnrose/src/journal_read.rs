//! Keyless readers for the supervisor's two chained files.
//!
//! The framing is the one `bnrose-exec-host` documents and writes
//! (`journal.rs`: `len u32 | body | tag 32`, body
//! `version u8 | seq u64 | op_id 32 | event u8 | payload_len u32 | payload`;
//! `ledger.rs`: the same frame around
//! `version u8 | seq u64 | op_id 32 | env_sha 32 | effect_digest 32 | wall u64`).
//! Structure is checked exactly as the owner's loader checks it (version,
//! sequence continuity, lengths); the chain tag is READ AND KEPT, never
//! recomputed, because the key that would recompute it is the supervisor's.
//! A reader that cannot verify a tag records it as served and says so.
//!
//! This parser exists only because the owner's loaders take the key. The
//! named proposal to that owner is a key-free loader of the same bodies
//! (`load_served`), after which this file shrinks to the replica logic.

use crate::hex;
use sha2::{Digest, Sha256};
use std::fmt;
use std::path::{Path, PathBuf};

/// One journal record as served by the file: bodies parsed, tag kept.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServedRecord {
    pub seq: u64,
    pub op_id: [u8; 32],
    pub event: u8,
    pub payload: Vec<u8>,
    /// the HMAC tag as written; UNVERIFIED here by construction
    pub served_tag: [u8; 32],
    /// `bnrose_exec_core::record_digest(seq, op, event, payload)`: the
    /// public content digest this index chains
    pub content_digest: [u8; 32],
}

/// One effect ledger row as served by the file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServedRow {
    pub seq: u64,
    pub op_id: [u8; 32],
    pub env_sha: [u8; 32],
    pub effect_digest: [u8; 32],
    pub wall: u64,
    pub served_tag: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReadError {
    /// the file is not there: an ABSENT replica, which is not an empty one
    Missing(String),
    Io(String),
    Malformed {
        record: usize,
        why: String,
    },
}

impl fmt::Display for ReadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ReadError::Missing(p) => write!(f, "missing: {p}"),
            ReadError::Io(e) => write!(f, "io: {e}"),
            ReadError::Malformed { record, why } => {
                write!(f, "malformed at record {record}: {why}")
            }
        }
    }
}

fn read_file(path: &Path) -> Result<Vec<u8>, ReadError> {
    match std::fs::read(path) {
        Ok(b) => Ok(b),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Err(ReadError::Missing(path.display().to_string()))
        }
        Err(e) => Err(ReadError::Io(e.to_string())),
    }
}

/// Frames of `len u32 | body | tag 32`, with `min_body` the smallest body
/// the format allows (the owner's own guard).
type Frame<'a> = (&'a [u8], [u8; 32]);

fn frames(bytes: &[u8], min_body: usize) -> Result<Vec<Frame<'_>>, ReadError> {
    let mut out = Vec::new();
    let mut i = 0usize;
    while i < bytes.len() {
        let rec = out.len();
        if i + 4 > bytes.len() {
            return Err(ReadError::Malformed {
                record: rec,
                why: "truncated length prefix".into(),
            });
        }
        let frame_len =
            u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]) as usize;
        if frame_len < 32 + min_body {
            return Err(ReadError::Malformed {
                record: rec,
                why: format!("impossible frame length {frame_len}"),
            });
        }
        let end = i + 4 + frame_len;
        if end > bytes.len() {
            return Err(ReadError::Malformed {
                record: rec,
                why: "truncated frame".into(),
            });
        }
        let body = &bytes[i + 4..end - 32];
        let tag: [u8; 32] = bytes[end - 32..end].try_into().unwrap();
        out.push((body, tag));
        i = end;
    }
    Ok(out)
}

/// Read one journal replica keyless.
pub fn read_journal(path: &Path) -> Result<Vec<ServedRecord>, ReadError> {
    let bytes = read_file(path)?;
    let mut out = Vec::new();
    for (idx, (body, tag)) in frames(&bytes, 46)?.into_iter().enumerate() {
        if body[0] != 1 {
            return Err(ReadError::Malformed {
                record: idx,
                why: format!("unknown version {}", body[0]),
            });
        }
        let seq = u64::from_le_bytes(body[1..9].try_into().unwrap());
        if seq != idx as u64 {
            return Err(ReadError::Malformed {
                record: idx,
                why: format!("seq {seq} where {idx} was due"),
            });
        }
        let op_id: [u8; 32] = body[9..41].try_into().unwrap();
        let event = body[41];
        let plen = u32::from_le_bytes(body[42..46].try_into().unwrap()) as usize;
        if body.len() < 46 + plen {
            return Err(ReadError::Malformed {
                record: idx,
                why: "payload shorter than its word".into(),
            });
        }
        let payload = body[46..46 + plen].to_vec();
        let content_digest = bnrose_exec_core::record_digest(seq, &op_id, event, &payload);
        out.push(ServedRecord {
            seq,
            op_id,
            event,
            payload,
            served_tag: tag,
            content_digest,
        });
    }
    Ok(out)
}

/// Read the effect ledger keyless.
pub fn read_ledger(path: &Path) -> Result<Vec<ServedRow>, ReadError> {
    let bytes = read_file(path)?;
    let mut out = Vec::new();
    for (idx, (body, tag)) in frames(&bytes, 113)?.into_iter().enumerate() {
        if body[0] != 1 {
            return Err(ReadError::Malformed {
                record: idx,
                why: format!("unknown version {}", body[0]),
            });
        }
        let seq = u64::from_le_bytes(body[1..9].try_into().unwrap());
        if seq != idx as u64 {
            return Err(ReadError::Malformed {
                record: idx,
                why: format!("seq {seq} where {idx} was due"),
            });
        }
        out.push(ServedRow {
            seq,
            op_id: body[9..41].try_into().unwrap(),
            env_sha: body[41..73].try_into().unwrap(),
            effect_digest: body[73..105].try_into().unwrap(),
            wall: u64::from_le_bytes(body[105..113].try_into().unwrap()),
            served_tag: tag,
        });
    }
    Ok(out)
}

pub const INDEX_HEAD_LABEL: &[u8] = b"bindex-bnrose/head/1";

/// The index's own commitment over the first `n` served records.
pub fn index_head(records: &[ServedRecord], n: usize) -> [u8; 32] {
    let mut prev = [0u8; 32];
    for r in records.iter().take(n) {
        let mut h = Sha256::new();
        h.update(INDEX_HEAD_LABEL);
        h.update(prev);
        h.update(r.content_digest);
        prev = h.finalize().into();
    }
    prev
}

/// The replica paths the supervisor writes (`opexec::replica_paths`).
pub fn replica_paths(state_dir: &Path) -> Vec<PathBuf> {
    vec![
        state_dir.join("journal.bin"),
        state_dir.join("replica").join("journal.bin"),
    ]
}

/// What the replica set looked like when read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Agreement {
    /// every readable replica is byte-for-byte the same set of records
    Agree { readable: usize },
    /// one readable replica is a strict prefix of another: the common
    /// prefix is usable; `lagging` names the shorter one
    Prefix {
        readable: usize,
        common: usize,
        lagging: String,
    },
    /// two readable replicas disagree at `seq`: nothing is usable
    Diverge {
        seq: u64,
        a: String,
        b: String,
        digest_a: [u8; 32],
        digest_b: [u8; 32],
    },
    /// no replica could be read
    NoneReadable,
}

pub struct ReplicaRead {
    pub path: PathBuf,
    pub bytes_len: Option<u64>,
    pub result: Result<Vec<ServedRecord>, ReadError>,
}

/// Read every replica and decide what they agree on.
pub fn read_replicas(state_dir: &Path) -> (Vec<ReplicaRead>, Agreement) {
    let reads: Vec<ReplicaRead> = replica_paths(state_dir)
        .into_iter()
        .map(|path| {
            let bytes_len = std::fs::metadata(&path).ok().map(|m| m.len());
            let result = read_journal(&path);
            ReplicaRead {
                path,
                bytes_len,
                result,
            }
        })
        .collect();
    let agreement = agreement_of(&reads);
    (reads, agreement)
}

/// The agreement rule over a replica set, as a pure function of what was
/// read.
pub fn agreement_of(reads: &[ReplicaRead]) -> Agreement {
    let readable: Vec<&ReplicaRead> = reads.iter().filter(|r| r.result.is_ok()).collect();
    if readable.is_empty() {
        return Agreement::NoneReadable;
    }
    let mut common = readable[0].result.as_ref().unwrap().len();
    let mut lagging: Option<String> = None;
    for pair in readable.windows(2) {
        let a = pair[0].result.as_ref().unwrap();
        let b = pair[1].result.as_ref().unwrap();
        let n = a.len().min(b.len());
        for i in 0..n {
            if a[i].content_digest != b[i].content_digest || a[i].served_tag != b[i].served_tag {
                return Agreement::Diverge {
                    seq: a[i].seq,
                    a: pair[0].path.display().to_string(),
                    b: pair[1].path.display().to_string(),
                    digest_a: a[i].content_digest,
                    digest_b: b[i].content_digest,
                };
            }
        }
        if a.len() != b.len() {
            let short = if a.len() < b.len() {
                &pair[0]
            } else {
                &pair[1]
            };
            lagging = Some(short.path.display().to_string());
            common = common.min(n);
        }
    }
    match lagging {
        None => Agreement::Agree {
            readable: readable.len(),
        },
        Some(l) => Agreement::Prefix {
            readable: readable.len(),
            common,
            lagging: l,
        },
    }
}

impl Agreement {
    pub fn word(&self) -> String {
        match self {
            Agreement::Agree { readable } => format!("agree:{readable}"),
            Agreement::Prefix {
                readable,
                common,
                lagging,
            } => format!("prefix:{readable}:common={common}:lagging={lagging}"),
            Agreement::Diverge {
                seq,
                digest_a,
                digest_b,
                ..
            } => format!(
                "diverge:seq={seq}:{}:{}",
                hex(&digest_a[..8]),
                hex(&digest_b[..8])
            ),
            Agreement::NoneReadable => "none-readable".into(),
        }
    }
}
