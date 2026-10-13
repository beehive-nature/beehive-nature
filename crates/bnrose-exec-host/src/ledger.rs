//! The effect ledger — the external system's stand-in and the NAMED
//! dedup-enforcement component for the external effect (BNROSE-RUST-001).
//!
//! This is non-spending by construction: an "effect" here is a durable
//! record whose whole content is the operation's own binding
//! (`op_id | env_sha`), never a payment. Two properties, both enforced in
//! THIS component and nowhere else:
//!
//! 1. **Digest-bound.** An apply must present the effect digest the
//!    operation's dispatch bound (the core derives it from the committed
//!    intent; the ledger recomputes it from the bytes presented). A
//!    different effect for the same operation is refused.
//! 2. **Idempotent.** `apply` keyed by operation id: the first call writes
//!    the row and returns `Applied`; every later call for the same id
//!    returns the original row and writes nothing. A lost response that
//!    leads to a re-execution therefore cannot duplicate the external
//!    effect — THIS is the component that enforces it. The journal's part
//!    is at-most-once dispatch and single logical operation; exactly-once
//!    beyond this single-supervisor, single-ledger slice is NOT claimed
//!    (that would have to be the external system's own transactional
//!    property).
//!
//! Rows carry their own HMAC chain, exactly like the journal, so a recovery
//! trusts the ledger only after every tag verifies.

use crate::hex;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;

type HmacSha256 = Hmac<Sha256>;

pub const LEDGER_LABEL: &[u8] = b"bnrose/effect/1";
pub const GENESIS_TAG: [u8; 32] = [0; 32];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Row {
    pub seq: u64,
    pub op_id: [u8; 32],
    pub env_sha: [u8; 32],
    pub effect_digest: [u8; 32],
    pub wall: u64,
    pub tag: [u8; 32],
}

#[derive(Debug)]
pub enum LedgerError {
    Io(String),
    Tampered {
        row: usize,
        why: String,
    },
    Malformed {
        row: usize,
        why: String,
    },
    /// The presented effect does not hash to the digest dispatch bound.
    DigestMismatch {
        op: [u8; 32],
    },
}

impl std::fmt::Display for LedgerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LedgerError::Io(e) => write!(f, "ledger io: {e}"),
            LedgerError::Tampered { row, why } => write!(f, "ledger tampered at row {row}: {why}"),
            LedgerError::Malformed { row, why } => {
                write!(f, "ledger malformed at row {row}: {why}")
            }
            LedgerError::DigestMismatch { op } => {
                write!(
                    f,
                    "effect refused: {} does not match its bound digest",
                    hex(op)
                )
            }
        }
    }
}

/// The effect one operation is authorized to produce, as bytes: the
/// operation id and the envelope hash, fully determined by the committed
/// intent (the core's `effect_digest` is SHA-256 over this binding's tag).
pub fn effect_bytes(op_id: &[u8; 32], env_sha: &[u8; 32]) -> Vec<u8> {
    let mut b = Vec::with_capacity(72);
    b.extend_from_slice(b"bnrose-effect/1");
    b.extend_from_slice(op_id);
    b.extend_from_slice(env_sha);
    b
}

fn digest_of(op_id: &[u8; 32], env_sha: &[u8; 32]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(b"bnrose-exec/effect/1");
    h.update(op_id);
    h.update(env_sha);
    h.finalize().into()
}

fn row_body(
    seq: u64,
    op_id: &[u8; 32],
    env_sha: &[u8; 32],
    digest: &[u8; 32],
    wall: u64,
) -> Vec<u8> {
    let mut b = Vec::with_capacity(113);
    b.push(1u8);
    b.extend_from_slice(&seq.to_le_bytes());
    b.extend_from_slice(op_id);
    b.extend_from_slice(env_sha);
    b.extend_from_slice(digest);
    b.extend_from_slice(&wall.to_le_bytes());
    b
}

fn mac(key: &[u8; 32], prev: &[u8; 32], body: &[u8]) -> [u8; 32] {
    let mut m = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac takes any key size");
    m.update(LEDGER_LABEL);
    m.update(prev);
    m.update(body);
    m.finalize().into_bytes().into()
}

/// What an apply found.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ApplyOutcome {
    /// This call wrote the row.
    Applied(Row),
    /// The operation already had its effect — the original row, unchanged.
    Already(Row),
}

pub struct EffectLedger {
    file: File,
    key: [u8; 32],
    head: [u8; 32],
    seq: u64,
    /// op_id -> the row that applied it (loaded eagerly; a slice-scale
    /// index is future work, named in the dispatch).
    rows: std::collections::BTreeMap<[u8; 32], Row>,
}

impl EffectLedger {
    pub fn open(path: &Path, key: &[u8; 32]) -> Result<EffectLedger, LedgerError> {
        let rows = load(path, key)?;
        let (head, seq) = match rows.last() {
            Some(r) => (r.tag, r.seq + 1),
            None => (GENESIS_TAG, 0),
        };
        let map = rows.into_iter().map(|r| (r.op_id, r)).collect();
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .read(true)
            .open(path)
            .map_err(|e| LedgerError::Io(e.to_string()))?;
        Ok(EffectLedger {
            file,
            key: *key,
            head,
            seq,
            rows: map,
        })
    }

    pub fn head(&self) -> [u8; 32] {
        self.head
    }

    pub fn row_for(&self, op: &[u8; 32]) -> Option<&Row> {
        self.rows.get(op)
    }

    pub fn len(&self) -> usize {
        self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    /// Apply this operation's effect. `env_sha` is the envelope hash the
    /// journal's Admitted record carries; the row's digest is derived from
    /// the binding and must equal `bound` (what dispatch journaled).
    pub fn apply(
        &mut self,
        op: &[u8; 32],
        env_sha: &[u8; 32],
        bound: &[u8; 32],
        wall: u64,
    ) -> Result<ApplyOutcome, LedgerError> {
        let digest = digest_of(op, env_sha);
        if &digest != bound {
            return Err(LedgerError::DigestMismatch { op: *op });
        }
        if let Some(row) = self.rows.get(op) {
            return Ok(ApplyOutcome::Already(row.clone()));
        }
        let body = row_body(self.seq, op, env_sha, &digest, wall);
        let tag = mac(&self.key, &self.head, &body);
        let mut frame = Vec::with_capacity(body.len() + 36);
        frame.extend_from_slice(&((body.len() + 32) as u32).to_le_bytes());
        frame.extend_from_slice(&body);
        frame.extend_from_slice(&tag);
        self.file
            .write_all(&frame)
            .and_then(|_| self.file.sync_data())
            .map_err(|e| LedgerError::Io(e.to_string()))?;
        let row = Row {
            seq: self.seq,
            op_id: *op,
            env_sha: *env_sha,
            effect_digest: digest,
            wall,
            tag,
        };
        self.head = tag;
        self.seq += 1;
        self.rows.insert(*op, row.clone());
        Ok(ApplyOutcome::Applied(row))
    }
}

/// Load and fully verify a ledger file.
pub fn load(path: &Path, key: &[u8; 32]) -> Result<Vec<Row>, LedgerError> {
    let mut bytes = Vec::new();
    match File::open(path) {
        Ok(mut f) => {
            f.read_to_end(&mut bytes)
                .map_err(|e| LedgerError::Io(e.to_string()))?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(LedgerError::Io(e.to_string())),
    }
    let mut out = Vec::new();
    let mut prev = GENESIS_TAG;
    let mut i = 0usize;
    let mut expect_seq = 0u64;
    while i < bytes.len() {
        let row_index = out.len();
        if i + 4 > bytes.len() {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: "truncated length prefix".into(),
            });
        }
        let frame_len =
            u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]) as usize;
        if frame_len < 32 + 113 {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: format!("impossible frame length {frame_len}"),
            });
        }
        let end = i + 4 + frame_len;
        if end > bytes.len() {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: "truncated frame".into(),
            });
        }
        let body = &bytes[i + 4..end - 32];
        let tag: [u8; 32] = bytes[end - 32..end].try_into().unwrap();
        let want = mac(key, &prev, body);
        if want != tag {
            return Err(LedgerError::Tampered {
                row: row_index,
                why: format!(
                    "tag mismatch: recorded {} computed {}",
                    hex(&tag),
                    hex(&want)
                ),
            });
        }
        if body[0] != 1 {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: format!("unknown version {}", body[0]),
            });
        }
        let seq = u64::from_le_bytes(body[1..9].try_into().unwrap());
        if seq != expect_seq {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: format!("seq {seq} where {expect_seq} was due"),
            });
        }
        let row = Row {
            seq,
            op_id: body[9..41].try_into().unwrap(),
            env_sha: body[41..73].try_into().unwrap(),
            effect_digest: body[73..105].try_into().unwrap(),
            wall: u64::from_le_bytes(body[105..113].try_into().unwrap()),
            tag,
        };
        // the row's own digest must bind its content (defense in depth: the
        // writer derives it, the reader re-derives it)
        if row.effect_digest != digest_of(&row.op_id, &row.env_sha) {
            return Err(LedgerError::Malformed {
                row: row_index,
                why: "row digest does not bind its content".into(),
            });
        }
        out.push(row);
        prev = tag;
        expect_seq += 1;
        i = end;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> std::path::PathBuf {
        let d =
            std::env::temp_dir().join(format!("bnrose-ledger-test-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d.join("effects.bin")
    }

    #[test]
    fn apply_is_idempotent_and_digest_bound() {
        let p = tmp("idem");
        let _ = std::fs::remove_file(&p);
        let key = [5u8; 32];
        let mut l = EffectLedger::open(&p, &key).unwrap();
        let op = [1u8; 32];
        let env = [2u8; 32];
        let bound = digest_of(&op, &env);
        let first = l.apply(&op, &env, &bound, 100).unwrap();
        assert!(matches!(first, ApplyOutcome::Applied(ref r) if r.seq == 0));
        // the WB004 shape: apply again (a re-execution after a lost response)
        match l.apply(&op, &env, &bound, 200).unwrap() {
            ApplyOutcome::Already(r) => assert_eq!(r.wall, 100), // the ORIGINAL row, unchanged
            _ => panic!("second apply must be Already"),
        }
        assert_eq!(l.len(), 1);
        // a different effect for the same operation is refused
        let wrong = [9u8; 32];
        assert!(matches!(
            l.apply(&op, &env, &wrong, 300),
            Err(LedgerError::DigestMismatch { .. })
        ));
        // tamper detection
        drop(l);
        let mut b = std::fs::read(&p).unwrap();
        let mid = b.len() / 2;
        b[mid] ^= 1;
        std::fs::write(&p, &b).unwrap();
        assert!(matches!(load(&p, &key), Err(LedgerError::Tampered { .. })));
    }
}
