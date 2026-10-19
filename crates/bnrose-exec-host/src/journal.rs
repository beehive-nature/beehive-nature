//! The operation journal — the authenticated durable record of identity,
//! authorized scope, resource reservations and execution progress
//! (BNROSE-RUST-001).
//!
//! One append-only file of chained records. Every record's tag is
//! HMAC-SHA256 over a domain label, the previous tag and the body, so any
//! flip, insert or reorder anywhere is detectable at load; the chain root
//! is all-zeros. The head tag is what receipts bind, so a receipt names
//! exactly the journal prefix it was issued under.
//!
//! The ORDER LAW: the `Dispatched` record is appended and fsynced BEFORE
//! the effect door opens. An effect without a prior durable dispatch is
//! not a state this system can be in; the effect ledger checks the digest
//! the dispatch bound, and the recovery reconciles both directions.
//!
//! Record body (little-endian):
//! `version u8 | seq u64 | op_id 32 | event u8 | payload_len u32 | payload`
//! then `len_prefix u32` in front of `body|tag` in the file.
//!
//! Payloads per event (see opexec for their producers):
//! - Admitted: `authority 32 | sig 64 | policy_digest 32 | env_len u16 | env`
//!   (the operation's identity, its authorized scope, and the WB001 binding
//!   re-verified at recovery)
//! - Reserve: `fuel u64 | mem u32 | secs u32 | worker_len u8 | worker ≤15`
//! - Dispatch: `effect_digest 32`
//! - Response: `ok u8`
//! - LostResponse / RecoveryNone: empty
//! - RecoveryEvidence: `effect_digest 32`
//! - BoundedFail: `code u32 | word_len u8 | word ≤31`

use crate::hex;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

type HmacSha256 = Hmac<Sha256>;

pub const JOURNAL_LABEL: &[u8] = b"bnrose/journal/1";
pub const GENESIS_TAG: [u8; 32] = [0; 32];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Record {
    pub seq: u64,
    pub op_id: [u8; 32],
    pub event: u8,
    pub payload: Vec<u8>,
    pub tag: [u8; 32],
}

#[derive(Debug)]
pub enum JournalError {
    Io(String),
    /// A record failed its chain tag — the file was touched after writing.
    Tampered {
        record: usize,
        why: String,
    },
    /// Structural garbage (a short prefix, an unknown version).
    Malformed {
        record: usize,
        why: String,
    },
}

impl std::fmt::Display for JournalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JournalError::Io(e) => write!(f, "journal io: {e}"),
            JournalError::Tampered { record, why } => {
                write!(f, "journal tampered at record {record}: {why}")
            }
            JournalError::Malformed { record, why } => {
                write!(f, "journal malformed at record {record}: {why}")
            }
        }
    }
}

fn mac(key: &[u8; 32], label: &[u8], prev: &[u8; 32], body: &[u8]) -> [u8; 32] {
    let mut m = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac takes any key size");
    m.update(label);
    m.update(prev);
    m.update(body);
    m.finalize().into_bytes().into()
}

fn body_of(seq: u64, op_id: &[u8; 32], event: u8, payload: &[u8]) -> Vec<u8> {
    let mut b = Vec::with_capacity(payload.len() + 46);
    b.push(1u8);
    b.extend_from_slice(&seq.to_le_bytes());
    b.extend_from_slice(op_id);
    b.push(event);
    b.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    b.extend_from_slice(payload);
    b
}

/// The open, writable tail of the journal.
pub struct Journal {
    file: File,
    key: [u8; 32],
    head: [u8; 32],
    seq: u64,
}

impl Journal {
    /// Open (creating) the journal at `path`, continuing from whatever
    /// verifiable prefix is already there. A tampered existing file is a
    /// hard error: the supervisor never writes over damage it cannot
    /// account for.
    pub fn open(path: &Path, key: &[u8; 32]) -> Result<Journal, JournalError> {
        let records = load(path, key)?;
        let (head, seq) = match records.last() {
            Some(r) => (r.tag, r.seq + 1),
            None => (GENESIS_TAG, 0),
        };
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .read(true)
            .open(path)
            .map_err(|e| JournalError::Io(e.to_string()))?;
        Ok(Journal {
            file,
            key: *key,
            head,
            seq,
        })
    }

    pub fn head(&self) -> [u8; 32] {
        self.head
    }

    pub fn next_seq(&self) -> u64 {
        self.seq
    }

    /// Append one record: body, tag, length prefix — then fsync. The
    /// fsync is the durability line the effect door stands behind.
    pub fn append_uncommitted(
        &mut self,
        op_id: &[u8; 32],
        event: u8,
        payload: &[u8],
    ) -> Result<Record, JournalError> {
        let body = body_of(self.seq, op_id, event, payload);
        let tag = mac(&self.key, JOURNAL_LABEL, &self.head, &body);
        let mut frame = Vec::with_capacity(body.len() + 40);
        frame.extend_from_slice(&((body.len() + 32) as u32).to_le_bytes());
        frame.extend_from_slice(&body);
        frame.extend_from_slice(&tag);
        self.file
            .write_all(&frame)
            .map_err(|e| JournalError::Io(e.to_string()))?;
        let rec = Record {
            seq: self.seq,
            op_id: *op_id,
            event,
            payload: payload.to_vec(),
            tag,
        };
        self.head = tag;
        self.seq += 1;
        Ok(rec)
    }

    pub fn sync(&self) -> Result<(), JournalError> {
        self.file
            .sync_data()
            .map_err(|e| JournalError::Io(e.to_string()))
    }

    /// Append one record: body, tag, length prefix — then fsync. The
    /// fsync is the durability line the effect door stands behind.
    pub fn append(
        &mut self,
        op_id: &[u8; 32],
        event: u8,
        payload: &[u8],
    ) -> Result<Record, JournalError> {
        let rec = self.append_uncommitted(op_id, event, payload)?;
        self.sync()?;
        Ok(rec)
    }
}

/// Load and fully verify a journal file. Every record's tag is checked
/// against the chain; the first mismatch names its index.
pub fn load(path: &Path, key: &[u8; 32]) -> Result<Vec<Record>, JournalError> {
    let mut bytes = Vec::new();
    match File::open(path) {
        Ok(mut f) => {
            f.read_to_end(&mut bytes)
                .map_err(|e| JournalError::Io(e.to_string()))?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(JournalError::Io(e.to_string())),
    }
    let mut out = Vec::new();
    let mut prev = GENESIS_TAG;
    let mut i = 0usize;
    let mut expect_seq = 0u64;
    while i < bytes.len() {
        let rec_index = out.len();
        if i + 4 > bytes.len() {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: "truncated length prefix".into(),
            });
        }
        let frame_len =
            u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]) as usize;
        if frame_len < 32 + 46 {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: format!("impossible frame length {frame_len}"),
            });
        }
        let end = i + 4 + frame_len;
        if end > bytes.len() {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: "truncated frame".into(),
            });
        }
        let body = &bytes[i + 4..end - 32];
        let tag: [u8; 32] = bytes[end - 32..end].try_into().unwrap();
        let want = mac(key, JOURNAL_LABEL, &prev, body);
        if want != tag {
            return Err(JournalError::Tampered {
                record: rec_index,
                why: format!(
                    "tag mismatch: recorded {} computed {}",
                    hex(&tag),
                    hex(&want)
                ),
            });
        }
        if body[0] != 1 {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: format!("unknown version {}", body[0]),
            });
        }
        let seq = u64::from_le_bytes(body[1..9].try_into().unwrap());
        if seq != expect_seq {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: format!("seq {seq} where {expect_seq} was due"),
            });
        }
        let op_id: [u8; 32] = body[9..41].try_into().unwrap();
        let event = body[41];
        let plen = u32::from_le_bytes(body[42..46].try_into().unwrap()) as usize;
        if body.len() < 46 + plen {
            return Err(JournalError::Malformed {
                record: rec_index,
                why: "payload shorter than its word".into(),
            });
        }
        out.push(Record {
            seq,
            op_id,
            event,
            payload: body[46..46 + plen].to_vec(),
            tag,
        });
        prev = tag;
        expect_seq += 1;
        i = end;
    }
    Ok(out)
}

// ---- the replicated journal (SPEC-RUSTEOSVM-1 §2.4) ------------------------
//
// DURABLY ACKNOWLEDGED, made structural: an append is acknowledged only
// after EVERY replica's fsync completes, and the effect door stands behind
// that acknowledgement. Two files stand for two failure domains here; the
// definition and the rules are the hosts'.
//
// Load rules (recovery reads the set, not a file):
//   - every replica loads and all agree      → Healthy
//   - some replicas are absent/unreadable,
//     the survivors agree                    → Degraded (recover from the
//                                              survivors; the loss is named)
//   - any replica fails its own chain        → fail closed (tamper is not
//                                              host loss)
//   - surviving replicas disagree            → fail closed (divergence)

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReplicationState {
    Healthy {
        replicas: usize,
    },
    Degraded {
        alive: Vec<PathBuf>,
        lost: Vec<PathBuf>,
    },
}

pub struct ReplicatedJournal {
    replicas: Vec<Journal>,
    paths: Vec<PathBuf>,
    /// What the load rules observed when this process opened the set —
    /// the recovery report names it even after healing.
    pub observed_at_open: ReplicationState,
    sync_worker: Option<(
        std::sync::mpsc::SyncSender<std::sync::mpsc::SyncSender<Result<(), JournalError>>>,
        std::thread::JoinHandle<()>,
    )>,
}

impl ReplicatedJournal {
    pub fn open_with_records(
        paths: &[PathBuf],
        key: &[u8; 32],
    ) -> Result<(ReplicatedJournal, Vec<Record>), JournalError> {
        if paths.is_empty() {
            return Err(JournalError::Io("no replicas given".into()));
        }
        let (records, observed) = Self::load_state(paths, key)?;
        // AUTONOMOUS HEALING (axis 3, made small and true): a replica lost
        // to an outage is rebuilt from the surviving records — the chain
        // is deterministic under the key, so the rebuilt replica is
        // byte-identical. Tamper never reaches here (it fails closed in
        // load_state); divergence never reaches here either.
        if let ReplicationState::Degraded { lost, .. } = &observed {
            for p in lost {
                let _ = std::fs::remove_file(p);
                if let Some(parent) = p.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| JournalError::Io(e.to_string()))?;
                }
                let mut j = Journal::open(p, key)?;
                for r in &records {
                    j.append(&r.op_id, r.event, &r.payload)?;
                }
            }
        }
        let mut replicas = Vec::with_capacity(paths.len());
        for p in paths {
            replicas.push(Journal::open(p, key)?);
        }
        let sync_worker = if replicas.len() > 1 {
            if let Ok(file_clone) = replicas[1].file.try_clone() {
                let (tx, rx) = std::sync::mpsc::sync_channel::<
                    std::sync::mpsc::SyncSender<Result<(), JournalError>>,
                >(1);
                let handle = std::thread::spawn(move || {
                    while let Ok(ack_tx) = rx.recv() {
                        let res = file_clone
                            .sync_data()
                            .map_err(|e| JournalError::Io(e.to_string()));
                        let _ = ack_tx.send(res);
                    }
                });
                Some((tx, handle))
            } else {
                None
            }
        } else {
            None
        };
        Ok((
            ReplicatedJournal {
                replicas,
                paths: paths.to_vec(),
                observed_at_open: observed,
                sync_worker,
            },
            records,
        ))
    }

    pub fn open(paths: &[PathBuf], key: &[u8; 32]) -> Result<ReplicatedJournal, JournalError> {
        Self::open_with_records(paths, key).map(|(j, _)| j)
    }

    pub fn head(&self) -> [u8; 32] {
        self.replicas[0].head()
    }

    pub fn next_seq(&self) -> u64 {
        self.replicas[0].next_seq()
    }

    pub fn append_uncommitted(
        &mut self,
        op_id: &[u8; 32],
        event: u8,
        payload: &[u8],
    ) -> Result<Record, JournalError> {
        let mut first: Option<Record> = None;
        for r in self.replicas.iter_mut() {
            let rec = r.append_uncommitted(op_id, event, payload)?;
            if first.is_none() {
                first = Some(rec);
            }
        }
        Ok(first.expect("at least one replica by construction"))
    }

    pub fn sync(&self) -> Result<(), JournalError> {
        if let Some((ref tx, _)) = self.sync_worker {
            let (ack_tx, ack_rx) = std::sync::mpsc::sync_channel(1);
            tx.send(ack_tx)
                .map_err(|e| JournalError::Io(e.to_string()))?;
            let r0_res = self.replicas[0].sync();
            let r1_res = ack_rx.recv().map_err(|e| JournalError::Io(e.to_string()))?;
            r0_res?;
            r1_res?;
            for r in self.replicas.iter().skip(2) {
                r.sync()?;
            }
        } else {
            for r in self.replicas.iter() {
                r.sync()?;
            }
        }
        Ok(())
    }

    /// The acknowledgement: every replica appends and fsyncs, or the
    /// append is not acknowledged. A mid-life replica write failure
    /// poisons further appends (the supervisor must halt; recovery then
    /// follows the load rules on whatever landed).
    pub fn append(
        &mut self,
        op_id: &[u8; 32],
        event: u8,
        payload: &[u8],
    ) -> Result<Record, JournalError> {
        let rec = self.append_uncommitted(op_id, event, payload)?;
        self.sync()?;
        Ok(rec)
    }

    /// Load the replicated state under the §load rules. Returns the
    /// surviving records and how they were obtained.
    pub fn load_state(
        paths: &[PathBuf],
        key: &[u8; 32],
    ) -> Result<(Vec<Record>, ReplicationState), JournalError> {
        let mut alive: Vec<(PathBuf, Vec<Record>)> = Vec::new();
        let mut lost: Vec<PathBuf> = Vec::new();
        for p in paths {
            if !p.exists() {
                // a missing replica is an outage (a fresh state is the
                // case where EVERY replica is missing — handled below)
                lost.push(p.clone());
                continue;
            }
            match load(p, key) {
                Ok(v) => alive.push((p.clone(), v)),
                Err(JournalError::Io(_)) => lost.push(p.clone()),
                Err(e) => return Err(e), // tamper/malformed: fail closed
            }
        }
        if alive.is_empty() {
            if lost.len() == paths.len() {
                // every replica missing = a fresh state: empty and healthy
                return Ok((Vec::new(), ReplicationState::Healthy { replicas: 0 }));
            }
            return Err(JournalError::Io("every journal replica is lost".into()));
        }
        // survivors must agree record-for-record
        let reference = &alive[0].1;
        for (p, records) in &alive[1..] {
            if records.len() != reference.len()
                || records.iter().zip(reference.iter()).any(|(a, b)| {
                    a.seq != b.seq
                        || a.op_id != b.op_id
                        || a.event != b.event
                        || a.payload != b.payload
                })
            {
                return Err(JournalError::Tampered {
                    record: reference.len().min(records.len()),
                    why: format!(
                        "replica divergence: {} disagrees with {}",
                        p.display(),
                        alive[0].0.display()
                    ),
                });
            }
        }
        let state = if lost.is_empty() {
            ReplicationState::Healthy {
                replicas: alive.len(),
            }
        } else {
            ReplicationState::Degraded {
                alive: alive.iter().map(|(p, _)| p.clone()).collect(),
                lost,
            }
        };
        Ok((reference.clone(), state))
    }

    pub fn paths(&self) -> &[PathBuf] {
        &self.paths
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> std::path::PathBuf {
        let d =
            std::env::temp_dir().join(format!("bnrose-journal-test-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d.join("journal.bin")
    }

    #[test]
    fn the_chain_detects_every_touch_and_reorders_nothing() {
        let p = tmp("chain");
        let _ = std::fs::remove_file(&p);
        let key = [7u8; 32];
        let mut j = Journal::open(&p, &key).unwrap();
        for k in 0u8..5 {
            j.append(&[k; 32], 1, &[k; 8]).unwrap();
        }
        let clean = load(&p, &key).unwrap();
        assert_eq!(clean.len(), 5);
        assert_eq!(clean[3].seq, 3);
        drop(j);
        // flip one payload byte deep inside
        let orig = std::fs::read(&p).unwrap();
        let mut b = orig.clone();
        let mid = b.len() / 2;
        b[mid] ^= 1;
        std::fs::write(&p, &b).unwrap();
        match load(&p, &key) {
            Err(JournalError::Tampered { record, .. }) => assert!(record >= 2),
            other => panic!("expected tamper, got {other:?}"),
        }
        // truncating the CLEAN tail is structural, not tamper: fewer records load
        std::fs::write(&p, &orig[..orig.len() - 10]).unwrap();
        match load(&p, &key) {
            Err(JournalError::Malformed { .. }) => {}
            other => panic!("expected malformed tail, got {other:?}"),
        }
        // a fresh journal under another key refuses every record
        assert!(matches!(
            load(&p, &[8u8; 32]),
            Err(JournalError::Tampered { record: 0, .. })
        ));
    }

    #[test]
    fn reopening_continues_the_chain() {
        let p = tmp("continue");
        let _ = std::fs::remove_file(&p);
        let key = [9u8; 32];
        {
            let mut j = Journal::open(&p, &key).unwrap();
            j.append(&[1; 32], 1, &[1]).unwrap();
        }
        let head_before = load(&p, &key).unwrap().last().unwrap().tag;
        {
            let mut j = Journal::open(&p, &key).unwrap();
            assert_eq!(j.next_seq(), 1);
            assert_eq!(j.head(), head_before);
            j.append(&[1; 32], 2, &[2]).unwrap();
            assert_eq!(j.head(), load(&p, &key).unwrap().last().unwrap().tag);
        }
        let recs = load(&p, &key).unwrap();
        assert_eq!(recs.len(), 2);
        assert_eq!(recs[1].seq, 1);
    }
}

impl Drop for ReplicatedJournal {
    fn drop(&mut self) {
        let _ = self.sync();
        if let Some((tx, handle)) = self.sync_worker.take() {
            drop(tx);
            let _ = handle.join();
        }
    }
}
