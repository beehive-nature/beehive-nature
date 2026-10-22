//! The constitutional authority object, its continuity predicate, the
//! immutable receipt log it leaves behind, and its anchored migration —
//! the WB002 killer invariant generalized off assets: authority changes
//! only through the currently authorized sovereign action (law L1).

use crate::{canon, refuse, sha_hex, R};
use std::collections::BTreeSet;

/// One constitutional signer: an account acting under a key of a named
/// algorithm era. Rotation replaces the set/keys/eras; it never moves
/// authority by itself.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Signer {
    pub account: String,
    pub key: String,
    pub alg: String,
}

/// The constitutional authority: m-of-n signers over an immutable
/// constitution digest, living at an epoch.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Authority {
    pub epoch: u64,
    pub threshold: usize,
    pub signers: Vec<Signer>,
    pub constitution_digest: String,
}

impl Authority {
    pub fn snapshot(&self) -> (u64, Vec<String>, usize, String) {
        (
            self.epoch,
            self.signers.iter().map(|s| s.account.clone()).collect(),
            self.threshold,
            self.constitution_digest.clone(),
        )
    }

    /// Does `signers` satisfy the current authority? (m-of-n of the
    /// CURRENT set — a stale signer set must never act.)
    pub fn quorum_met(&self, signers: &[&str]) -> bool {
        let current: BTreeSet<&str> = self.signers.iter().map(|s| s.account.as_str()).collect();
        let provided: BTreeSet<&str> = signers.iter().copied().collect();
        let overlap = provided.intersection(&current).count();
        overlap >= self.threshold.min(self.signers.len())
    }
}

/// One immutable receipt: hash-chained, self-describing.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LogEntry {
    pub seq: u64,
    pub kind: &'static str,
    pub body: String,
    pub root: String,
}

impl LogEntry {
    pub fn fields(&self) -> Vec<(String, String)> {
        self.body
            .split('\u{1e}')
            .filter_map(|kv| {
                let mut it = kv.splitn(2, '\u{1f}');
                Some((it.next()?.into(), it.next()?.into()))
            })
            .collect()
    }
    pub fn get(&self, k: &str) -> Option<String> {
        self.fields()
            .into_iter()
            .find(|(fk, _)| fk == k)
            .map(|(_, v)| v)
    }
}

/// The provenance chain: append-only, hash-chained from a named genesis.
/// This — not any proposal — is what lasts 1,000 years (law L2).
#[derive(Clone, Debug, Default)]
pub struct ReceiptLog {
    pub entries: Vec<LogEntry>,
}

impl ReceiptLog {
    pub fn genesis_root() -> String {
        sha_hex(b"bT-WB04:genesis")
    }
    pub fn head(&self) -> String {
        self.entries
            .last()
            .map(|e| e.root.clone())
            .unwrap_or_else(Self::genesis_root)
    }
    /// Append one receipt; the root chains over the previous head.
    pub fn append(&mut self, kind: &'static str, pairs: &[(&str, String)]) {
        let seq = self.entries.len() as u64;
        let mut all: Vec<(&str, String)> = pairs.to_vec();
        all.push(("kind", kind.into()));
        all.push(("seq", seq.to_string()));
        let body = canon(&all);
        let root = sha_hex(format!("{}|{}", self.head(), body).as_bytes());
        self.entries.push(LogEntry {
            seq,
            kind,
            body,
            root,
        });
    }
    /// Verify every hash link — the 3026 auditor's first check.
    pub fn verify(&self) -> R<()> {
        let mut prev = Self::genesis_root();
        for (i, e) in self.entries.iter().enumerate() {
            if e.seq != i as u64 {
                return refuse("bt-wb004:log", format!("entry {i} has seq {}", e.seq));
            }
            let expect = sha_hex(format!("{prev}|{}", e.body).as_bytes());
            if expect != e.root {
                return refuse("bt-wb004:log", format!("entry {i} breaks the hash chain"));
            }
            prev = e.root.clone();
        }
        Ok(())
    }
    /// Fold the provenance chain: replay the authority-affecting entries
    /// and re-derive the authority they describe. Each such entry carries
    /// its quorum evidence (the acting signer list); a fold that finds an
    /// authority change WITHOUT sufficient evidence refuses — the same
    /// continuity predicate, executed by the auditor instead of the engine.
    pub fn fold_authority(&self, genesis: &Authority) -> R<Authority> {
        let mut cur = genesis.clone();
        for e in &self.entries {
            match e.kind {
                "rotate" | "migrate" => {
                    let acting_owned: Vec<String> = e
                        .get("acting")
                        .map(|s| s.split(',').map(str::to_string).collect())
                        .unwrap_or_default();
                    let acting: Vec<&str> = acting_owned.iter().map(String::as_str).collect();
                    if !cur.quorum_met(&acting) {
                        return refuse(
                            "bt-wb004:continuity",
                            format!(
                                "entry {} changes authority without the current quorum: {:?}",
                                e.seq, acting
                            ),
                        );
                    }
                    let key = e.get("key").unwrap_or_default();
                    let alg = e.get("alg").unwrap_or_default();
                    let signers: Vec<Signer> = e
                        .get("signers")
                        .map(|s| {
                            s.split(',')
                                .map(|acct| Signer {
                                    account: acct.to_string(),
                                    key: key.clone(),
                                    alg: alg.clone(),
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    if !signers.is_empty() {
                        cur.signers = signers;
                    }
                    if let Some(t) = e.get("threshold").and_then(|t| t.parse().ok()) {
                        cur.threshold = t;
                    }
                    cur.epoch += 1;
                }
                _ => {}
            }
        }
        Ok(cur)
    }
}

/// The anchored migration bundle (chain replacement / contract
/// replacement): the authority plus the receipt-log head it claims.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthorityBundle {
    pub authority: Authority,
    pub log_head: String,
}

impl Authority {
    pub fn export(&self, log_head: &str) -> AuthorityBundle {
        AuthorityBundle {
            authority: self.clone(),
            log_head: log_head.into(),
        }
    }
    pub fn commitment(b: &AuthorityBundle) -> String {
        let pairs = [
            ("epoch", b.authority.epoch.to_string()),
            (
                "signers",
                b.authority
                    .signers
                    .iter()
                    .map(|s| s.account.clone())
                    .collect::<Vec<_>>()
                    .join(","),
            ),
            ("threshold", b.authority.threshold.to_string()),
            ("digest", b.authority.constitution_digest.clone()),
            ("log_head", b.log_head.clone()),
        ];
        sha_hex(canon(&pairs).as_bytes())
    }
    /// Import against the commitment the predecessor published while
    /// alive; a tampered bundle fails it (fail-closed migration).
    pub fn import(b: &AuthorityBundle, anchor: &str) -> R<Authority> {
        if Self::commitment(b) != anchor {
            return refuse(
                "bt-wb004:migration-anchor",
                "bundle commitment does not match the predecessor anchor",
            );
        }
        Ok(b.authority.clone())
    }
}
