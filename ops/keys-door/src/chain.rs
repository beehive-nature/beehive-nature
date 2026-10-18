//! The chain rules (contract §4 rules 3 and 5), walked from the pinned
//! genesis over a pool of untrusted candidates.
//!
//! - seq 1 is accepted only as the record whose SHA3-256 is genesis_sha3,
//!   signed by an id in genesis_signers. Genesis pins authorize genesis only.
//! - seq N+1 is accepted only as a link: prev == SHA3-256(record N bytes) and
//!   signed by an id in record N's `signers`. The walk never jumps: every
//!   record between must be in the pool.
//! - Two valid links at one seq with different SHA3-256 are an equivocation:
//!   the walk stops before them. It resolves only when exactly one of them
//!   has a valid link at seq+1 selecting it (that branch wins).
//! - The walk sees only the pool it is given. Every valid record it meets
//!   at a fork, and every valid record after one, is returned as evidence:
//!   the door keeps it and puts it back in every later pool, so a fork is
//!   not forgotten when a source stops offering one branch.
//!
//! Signatures are verified lazily, only for a candidate whose prev and
//! signer id already fit, so a flood of records signed by unpinned keys
//! costs a hash comparison each, not a verification.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::b64::b64u;
use crate::record::{Parsed, Refusal};

/// Every candidate envelope, grouped by seq and then by record SHA3-256.
/// One record may arrive under several signatures (envelopes).
#[derive(Default)]
pub struct Pool {
    levels: BTreeMap<u64, BTreeMap<[u8; 32], Vec<Arc<Parsed>>>>,
}

impl Pool {
    pub fn add(&mut self, p: Arc<Parsed>) {
        let envs = self
            .levels
            .entry(p.record.seq)
            .or_default()
            .entry(p.record_sha3)
            .or_default();
        if !envs.iter().any(|e| e.sig_key == p.sig_key) {
            envs.push(p);
        }
    }

    pub fn contains(&self, seq: u64, sha3: &[u8; 32]) -> bool {
        self.levels.get(&seq).is_some_and(|l| l.contains_key(sha3))
    }

    /// Every envelope carrying the record (seq, sha3).
    pub fn envelopes(&self, seq: u64, sha3: &[u8; 32]) -> &[Arc<Parsed>] {
        self.levels
            .get(&seq)
            .and_then(|l| l.get(sha3))
            .map(Vec::as_slice)
            .unwrap_or(&[])
    }
}

/// A record on the chain, with the envelope whose signer authorized it.
#[derive(Clone, Debug)]
pub struct Link {
    pub env: Arc<Parsed>,
    pub signer: String,
}

impl Link {
    pub fn seq(&self) -> u64 {
        self.env.record.seq
    }
    pub fn sha3(&self) -> [u8; 32] {
        self.env.record_sha3
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Equivocation {
    pub seq: u64,
    /// SHA3-256 (base64url) of every valid record at that seq
    pub records: Vec<String>,
}

#[derive(Default)]
pub struct Walk {
    /// genesis first; each entry links to the one before it
    pub path: Vec<Link>,
    pub equivocation: Option<Equivocation>,
    /// the envelopes of every valid record at a fork and after one, for
    /// the door to keep (rule 5)
    pub evidence: Vec<Arc<Parsed>>,
    pub notes: Vec<String>,
}

pub type VerifyFn<'a> = dyn FnMut(&Parsed) -> Result<String, Refusal> + 'a;

fn authorize(
    envs: &[Arc<Parsed>],
    allowed: &[String],
    verify: &mut VerifyFn<'_>,
    notes: &mut Vec<String>,
) -> Option<Link> {
    let mut signed_by_stranger = false;
    for e in envs {
        if !allowed.contains(&e.pre.id) {
            signed_by_stranger = true;
            continue;
        }
        match verify(e) {
            Ok(id) => {
                return Some(Link {
                    env: e.clone(),
                    signer: id,
                })
            }
            Err(r) => notes.push(format!(
                "seq {} record {}: {} ({r})",
                e.record.seq,
                b64u(&e.record_sha3),
                r.name()
            )),
        }
    }
    if signed_by_stranger {
        if let Some(e) = envs.first() {
            notes.push(format!(
                "seq {} record {}: no signature by an authorized signer",
                e.record.seq,
                b64u(&e.record_sha3)
            ));
        }
    }
    None
}

/// The valid links at `base.seq + 1`: prev selects `base`, signer in its list.
fn links_after(
    pool: &Pool,
    base: &Link,
    verify: &mut VerifyFn<'_>,
    notes: &mut Vec<String>,
) -> Vec<Link> {
    let Some(level) = pool.levels.get(&(base.seq() + 1)) else {
        return Vec::new();
    };
    let want = b64u(&base.sha3());
    level
        .values()
        .filter(|envs| envs[0].record.prev.as_deref() == Some(want.as_str()))
        .filter_map(|envs| authorize(envs, &base.env.record.signers, verify, notes))
        .collect()
}

/// One envelope checked on its own as the record right after `base`
/// (rule 3): with no base, the pinned genesis signed by a genesis signer;
/// otherwise seq base+1, prev selecting base, signed by an id base lists.
/// Both verifiers run only after those fit. The peer walk uses this to
/// stop at the first envelope that does not extend what it holds.
pub fn extends(
    base: Option<&Parsed>,
    p: &Parsed,
    genesis_sha3: &[u8; 32],
    genesis_signers: &[String],
    verify: &mut VerifyFn<'_>,
) -> Result<String, String> {
    let allowed = match base {
        None if p.record.seq != 1 => return Err("not seq 1, and nothing is held below it".into()),
        None if p.record_sha3 != *genesis_sha3 => {
            return Err("seq 1 is not the pinned genesis".into())
        }
        None => genesis_signers,
        Some(b) if p.record.seq != b.record.seq + 1 => {
            return Err(format!(
                "seq {} does not follow seq {}",
                p.record.seq, b.record.seq
            ))
        }
        Some(b) if p.record.prev.as_deref() != Some(b64u(&b.record_sha3).as_str()) => {
            return Err(format!(
                "prev does not select the record this edge holds at seq {}",
                b.record.seq
            ))
        }
        Some(b) => &b.record.signers,
    };
    if !allowed.contains(&p.pre.id) {
        return Err("no signature by an authorized signer".into());
    }
    verify(p).map_err(|r| format!("{} ({r})", r.name()))
}

pub fn walk(
    pool: &Pool,
    genesis_sha3: &[u8; 32],
    genesis_signers: &[String],
    verify: &mut VerifyFn<'_>,
) -> Walk {
    let mut w = Walk::default();
    let genesis = pool.envelopes(1, genesis_sha3);
    if genesis.is_empty() {
        return w;
    }
    let Some(g) = authorize(genesis, genesis_signers, verify, &mut w.notes) else {
        return w;
    };
    w.path.push(g);
    loop {
        let base = w.path.last().expect("the path starts at genesis").clone();
        let mut valid = links_after(pool, &base, verify, &mut w.notes);
        match valid.len() {
            0 => break,
            1 => w.path.push(valid.pop().expect("one link")),
            _ => {
                w.evidence.extend(valid.iter().map(|l| l.env.clone()));
                let mut winners: Vec<Link> = Vec::new();
                for b in &valid {
                    let after = links_after(pool, b, verify, &mut Vec::new());
                    if !after.is_empty() {
                        w.evidence.extend(after.into_iter().map(|l| l.env));
                        winners.push(b.clone());
                    }
                }
                if winners.len() == 1 {
                    w.path.push(winners.pop().expect("one winner"));
                    continue;
                }
                let mut records: Vec<String> = valid.iter().map(|l| b64u(&l.sha3())).collect();
                records.sort();
                w.equivocation = Some(Equivocation {
                    seq: base.seq() + 1,
                    records,
                });
                break;
            }
        }
    }
    w
}
