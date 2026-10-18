//! The journal: one append-only, hash-linked sequence of records on the
//! embedded-storage seam (adapter-store). Every authority writes here and
//! every state the controller holds is rebuilt from here at open.
//!
//! Each append is ONE atomic, durable-on-return batch: the record under
//! `j/<seq>` and the head under `h`. Open walks the whole sequence, checks
//! that it is contiguous from zero, recomputes every link, and requires the
//! stored head to equal the last link. Any disagreement fails closed.
//!
//! Which comparison carries the weight, measured by the teeth: the HEAD
//! comparison. The recomputed chain commits to every record, so any edit,
//! reorder or removal that is not re-chained changes it, and truncation is
//! caught there alone. The per-record stored link is checked too, but only to
//! NAME the first record that breaks; with it disabled every tamper case is
//! still refused (teeth, 2026-10-15), so it is localization, not a gate.
//!
//! What the link does and does not establish, named: it is an unkeyed SHA3
//! chain, so it convicts a changed, removed, reordered or truncated record
//! that was not re-chained, and torn or foreign bytes. Someone with write
//! access to the store CAN rewrite the whole chain consistently. Detecting
//! that needs the head held somewhere they cannot write: `Journal::head()`
//! is exported for exactly that anchor (Vaulta, Autonomi, a peer), which is
//! a later beat and is not claimed here.

use adapter_store::{Edit, EmbeddedStore};

use crate::canon::{Dec, Enc};
use crate::digest::{hash, Digest32};
use crate::evidence::{ExecRecord, Usage, Verdict};
use crate::lessons::LessonEvent;
use crate::Refusal;

const J: &[u8] = b"j/";
const HEAD: &[u8] = b"h";
const BLOB: &[u8] = b"b/";

/// Everything the controller ever writes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Record {
    /// The sovereign's policy, with the envelope that authorized it.
    PolicyAdopted {
        policy: Digest32,
        text: String,
        envelope: String,
        key_id: String,
    },
    /// A triggering fault, as evidence: what was seen and the digest of the
    /// raw bytes that showed it.
    Observation {
        id: Digest32,
        what: String,
        evidence: Digest32,
    },
    /// A candidate the controller admitted: the agent's signed text, and the
    /// change set the CONTROLLER computed (not the one the agent declared).
    ProposalAdmitted {
        candidate: Digest32,
        policy: Digest32,
        text: String,
        envelope: String,
        key_id: String,
        artifact: Digest32,
        changed: Vec<String>,
    },
    /// Authority reserved BEFORE an attempt may run.
    Reserved {
        attempt: Digest32,
        subject: Option<Digest32>,
        check: String,
        amount: u64,
    },
    /// Durable BEFORE the worker is spawned: from here on the attempt may have
    /// run, so it can never again be settled as conclusively not run.
    Dispatched {
        attempt: Digest32,
    },
    /// The spawned worker's process id: the process this controller owns
    /// until it observes the worker dead.
    Spawned {
        attempt: Digest32,
        pid: u64,
    },
    /// Durable before the worker is killed.
    CancelIntent {
        attempt: Digest32,
        reason: String,
    },
    /// The worker was OBSERVED dead (wait returned). A result is never
    /// recorded before this.
    WorkerExited {
        attempt: Digest32,
        code: Option<i64>,
        killed: bool,
    },
    Executed(ExecRecord),
    /// Actual usage, reconciled against the reservation. `Unknown` stays
    /// unknown and is charged at the full reservation, never at zero.
    Settled {
        attempt: Digest32,
        usage: Usage,
        note: String,
    },
    VerdictRecorded(Verdict),
    Decision(crate::controller::Decision),
    /// Written at open, before anything new: the unresolved attempts found,
    /// preserved as evidence, and the cleanup still owed for each.
    Rescue {
        unresolved: Vec<Digest32>,
        owed_cleanup: Vec<String>,
    },
    Lesson(LessonEvent),
}

mod kind {
    pub const POLICY: u8 = 1;
    pub const OBSERVATION: u8 = 2;
    pub const PROPOSAL: u8 = 3;
    pub const RESERVED: u8 = 4;
    pub const DISPATCHED: u8 = 5;
    pub const CANCEL: u8 = 6;
    pub const EXITED: u8 = 7;
    pub const EXECUTED: u8 = 8;
    pub const SETTLED: u8 = 9;
    pub const VERDICT: u8 = 10;
    pub const DECISION: u8 = 11;
    pub const RESCUE: u8 = 12;
    pub const LESSON: u8 = 13;
    pub const SPAWNED: u8 = 14;
}

pub(crate) fn enc_opt_digest(e: Enc, d: &Option<Digest32>) -> Enc {
    match d {
        None => e.u8(0),
        Some(d) => e.u8(1).digest(d),
    }
}

pub(crate) fn dec_opt_digest(r: &mut Dec) -> Result<Option<Digest32>, Refusal> {
    match r.u8()? {
        0 => Ok(None),
        1 => Ok(Some(r.digest()?)),
        _ => Err(Refusal::Corrupt("option tag".into())),
    }
}

fn enc_digests(mut e: Enc, v: &[Digest32]) -> Enc {
    e = e.u64(v.len() as u64);
    for d in v {
        e = e.digest(d);
    }
    e
}

fn dec_digests(r: &mut Dec) -> Result<Vec<Digest32>, Refusal> {
    let n = r.u64()?;
    if n > 1 << 20 {
        return Err(Refusal::Corrupt("digest count".into()));
    }
    (0..n).map(|_| r.digest()).collect()
}

impl Record {
    pub fn encode(&self) -> Vec<u8> {
        match self {
            Record::PolicyAdopted {
                policy,
                text,
                envelope,
                key_id,
            } => Enc::new(kind::POLICY)
                .digest(policy)
                .str(text)
                .str(envelope)
                .str(key_id)
                .done(),
            Record::Observation { id, what, evidence } => Enc::new(kind::OBSERVATION)
                .digest(id)
                .str(what)
                .digest(evidence)
                .done(),
            Record::ProposalAdmitted {
                candidate,
                policy,
                text,
                envelope,
                key_id,
                artifact,
                changed,
            } => Enc::new(kind::PROPOSAL)
                .digest(candidate)
                .digest(policy)
                .str(text)
                .str(envelope)
                .str(key_id)
                .digest(artifact)
                .strs(changed)
                .done(),
            Record::Reserved {
                attempt,
                subject,
                check,
                amount,
            } => enc_opt_digest(Enc::new(kind::RESERVED).digest(attempt), subject)
                .str(check)
                .u64(*amount)
                .done(),
            Record::Dispatched { attempt } => Enc::new(kind::DISPATCHED).digest(attempt).done(),
            Record::Spawned { attempt, pid } => {
                Enc::new(kind::SPAWNED).digest(attempt).u64(*pid).done()
            }
            Record::CancelIntent { attempt, reason } => {
                Enc::new(kind::CANCEL).digest(attempt).str(reason).done()
            }
            Record::WorkerExited {
                attempt,
                code,
                killed,
            } => {
                let e = Enc::new(kind::EXITED).digest(attempt);
                let e = match code {
                    None => e.u8(0),
                    Some(c) => e.u8(1).i64(*c),
                };
                e.u8(*killed as u8).done()
            }
            Record::Executed(x) => x.encode_into(Enc::new(kind::EXECUTED)).done(),
            Record::Settled {
                attempt,
                usage,
                note,
            } => Enc::new(kind::SETTLED)
                .digest(attempt)
                .opt_u64(usage.known())
                .str(note)
                .done(),
            Record::VerdictRecorded(v) => v.encode_into(Enc::new(kind::VERDICT)).done(),
            Record::Decision(d) => d.encode_into(Enc::new(kind::DECISION)).done(),
            Record::Rescue {
                unresolved,
                owed_cleanup,
            } => enc_digests(Enc::new(kind::RESCUE), unresolved)
                .strs(owed_cleanup)
                .done(),
            Record::Lesson(l) => l.encode_into(Enc::new(kind::LESSON)).done(),
        }
    }

    pub fn decode(bytes: &[u8]) -> Result<Record, Refusal> {
        let (k, mut r) = Dec::open(bytes)?;
        let rec = match k {
            kind::POLICY => Record::PolicyAdopted {
                policy: r.digest()?,
                text: r.str()?,
                envelope: r.str()?,
                key_id: r.str()?,
            },
            kind::OBSERVATION => Record::Observation {
                id: r.digest()?,
                what: r.str()?,
                evidence: r.digest()?,
            },
            kind::PROPOSAL => Record::ProposalAdmitted {
                candidate: r.digest()?,
                policy: r.digest()?,
                text: r.str()?,
                envelope: r.str()?,
                key_id: r.str()?,
                artifact: r.digest()?,
                changed: r.strs()?,
            },
            kind::RESERVED => Record::Reserved {
                attempt: r.digest()?,
                subject: dec_opt_digest(&mut r)?,
                check: r.str()?,
                amount: r.u64()?,
            },
            kind::DISPATCHED => Record::Dispatched {
                attempt: r.digest()?,
            },
            kind::SPAWNED => Record::Spawned {
                attempt: r.digest()?,
                pid: r.u64()?,
            },
            kind::CANCEL => Record::CancelIntent {
                attempt: r.digest()?,
                reason: r.str()?,
            },
            kind::EXITED => {
                let attempt = r.digest()?;
                let code = match r.u8()? {
                    0 => None,
                    1 => Some(r.i64()?),
                    _ => return Err(Refusal::Corrupt("exit code tag".into())),
                };
                let killed = match r.u8()? {
                    0 => false,
                    1 => true,
                    _ => return Err(Refusal::Corrupt("killed flag".into())),
                };
                Record::WorkerExited {
                    attempt,
                    code,
                    killed,
                }
            }
            kind::EXECUTED => Record::Executed(ExecRecord::decode_from(&mut r)?),
            kind::SETTLED => Record::Settled {
                attempt: r.digest()?,
                usage: Usage::from_known(r.opt_u64()?),
                note: r.str()?,
            },
            kind::VERDICT => Record::VerdictRecorded(Verdict::decode_from(&mut r)?),
            kind::DECISION => Record::Decision(crate::controller::Decision::decode_from(&mut r)?),
            kind::RESCUE => Record::Rescue {
                unresolved: dec_digests(&mut r)?,
                owed_cleanup: r.strs()?,
            },
            kind::LESSON => Record::Lesson(LessonEvent::decode_from(&mut r)?),
            other => return Err(Refusal::Corrupt(format!("unknown record kind {other}"))),
        };
        r.end()?;
        Ok(rec)
    }
}

fn link(prev: &Digest32, seq: u64, bytes: &[u8]) -> Digest32 {
    hash(
        "bnrose-evolve/journal/v1",
        &[&prev.0, &seq.to_be_bytes(), bytes],
    )
}

pub fn blob_digest(bytes: &[u8]) -> Digest32 {
    hash("bnrose-evolve/blob/v1", &[bytes])
}

fn key(seq: u64) -> Vec<u8> {
    let mut k = J.to_vec();
    k.extend_from_slice(&seq.to_be_bytes());
    k
}

pub struct Journal {
    store: Box<dyn EmbeddedStore>,
    next: u64,
    head: Digest32,
}

impl Journal {
    /// Open and verify. Returns the journal and every record in order.
    pub fn open(store: Box<dyn EmbeddedStore>) -> Result<(Journal, Vec<Record>), Refusal> {
        let rows = store.scan_prefix(J).map_err(Refusal::store)?;
        let mut head = Digest32::ZERO;
        let mut records = Vec::with_capacity(rows.len());
        for (i, (k, v)) in rows.iter().enumerate() {
            let seq = i as u64;
            if k != &key(seq) {
                return Err(Refusal::Tampered(format!(
                    "journal is not contiguous at {seq}"
                )));
            }
            if v.len() < 32 {
                return Err(Refusal::Tampered(format!("record {seq} is short")));
            }
            let (body, l) = v.split_at(v.len() - 32);
            let want = link(&head, seq, body);
            if l != want.0 {
                return Err(Refusal::Tampered(format!("record {seq} does not link")));
            }
            records.push(Record::decode(body).map_err(|e| {
                Refusal::Tampered(format!("record {seq} links but does not decode: {e}"))
            })?);
            head = want;
        }
        let stored = store.get(HEAD).map_err(Refusal::store)?;
        let n = records.len() as u64;
        match stored {
            None if n == 0 => {}
            None => {
                return Err(Refusal::Tampered(
                    "records exist but the head is gone".into(),
                ))
            }
            Some(h) => {
                let mut want = n.to_be_bytes().to_vec();
                want.extend_from_slice(&head.0);
                if h != want {
                    return Err(Refusal::Tampered(
                        "stored head disagrees with the records (truncated or extended)".into(),
                    ));
                }
            }
        }
        store.integrity_check().map_err(Refusal::store)?;
        Ok((
            Journal {
                store,
                next: n,
                head,
            },
            records,
        ))
    }

    /// Append one record, durable on return. Returns its sequence number.
    pub fn append(&mut self, rec: &Record) -> Result<u64, Refusal> {
        let body = rec.encode();
        let seq = self.next;
        let l = link(&self.head, seq, &body);
        let mut v = body;
        v.extend_from_slice(&l.0);
        let mut h = (seq + 1).to_be_bytes().to_vec();
        h.extend_from_slice(&l.0);
        self.store
            .write_batch(&[Edit::Put(key(seq), v), Edit::Put(HEAD.to_vec(), h)])
            .map_err(Refusal::store)?;
        self.next = seq + 1;
        self.head = l;
        Ok(seq)
    }

    /// (number of records, link of the last one) — the value an external
    /// anchor would hold.
    pub fn head(&self) -> (u64, Digest32) {
        (self.next, self.head)
    }

    /// Keep raw evidence bytes (a worker's stdout, a fault's capture) under
    /// their own digest, durable on return. Records carry the digest; the
    /// bytes stay resolvable. Blobs sit outside the chain: they are bound by
    /// the digest the chained record carries, and re-checked on every read.
    pub fn put_blob(&mut self, bytes: &[u8]) -> Result<Digest32, Refusal> {
        let d = blob_digest(bytes);
        let mut k = BLOB.to_vec();
        k.extend_from_slice(&d.0);
        self.store
            .write_batch(&[Edit::Put(k, bytes.to_vec())])
            .map_err(Refusal::store)?;
        Ok(d)
    }

    /// Resolve a blob, refusing bytes that do not match their digest.
    pub fn get_blob(&self, d: &Digest32) -> Result<Option<Vec<u8>>, Refusal> {
        let mut k = BLOB.to_vec();
        k.extend_from_slice(&d.0);
        match self.store.get(&k).map_err(Refusal::store)? {
            None => Ok(None),
            Some(b) if blob_digest(&b) == *d => Ok(Some(b)),
            Some(_) => Err(Refusal::Tampered(format!(
                "blob {d} does not match its digest"
            ))),
        }
    }

    pub fn next_seq(&self) -> u64 {
        self.next
    }

    pub fn engine(&self) -> &'static str {
        self.store.engine()
    }
}
