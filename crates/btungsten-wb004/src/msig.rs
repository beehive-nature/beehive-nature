//! The execution layer, specimen-shaped: proposals whose requested and
//! provided approvals are per-proposal vectors (specimen
//! `eosio.msig.hpp:124-146`), expiration gating propose and exec
//! (`eosio.msig.cpp:56,218`), non-proposer cancel only after expiry
//! (`:191`). Two estate additions over the specimen's semantics, both
//! founder laws: the requested vector is CAPPED (law L3 — this is a
//! multisig execution primitive, not population storage) and the
//! expiration encoder is the fail-closed one (law L4), bound to the
//! representation the layer currently speaks.

use crate::time::{encode_expiration, TimeRep};
use crate::{refuse, Refusal, R};
use std::collections::BTreeMap;

/// Law L3, executable: the largest approval vector a proposal may carry.
/// 10 billion humans authorize through aggregation, never through this
/// layer's storage.
pub const MSIG_APPROVALS_CAP: usize = 64;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionLevel {
    pub actor: String,
    pub permission: String,
}

impl PermissionLevel {
    pub fn new(actor: &str, permission: &str) -> PermissionLevel {
        PermissionLevel {
            actor: actor.into(),
            permission: permission.into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MsigProposal {
    pub proposer: String,
    pub proposal_name: String,
    pub requested: Vec<PermissionLevel>,
    pub provided: Vec<PermissionLevel>,
    pub expiration: u64,
    pub payload_digest: String,
}

/// The multisig layer. `rep` is which time representation the wire is
/// currently speaking — it flips to U64 exactly once, when the successor
/// contract replaces the u32 one at the 2106 boundary.
#[derive(Clone, Debug)]
pub struct Msig {
    pub rep: TimeRep,
    pub proposals: BTreeMap<String, MsigProposal>,
}

impl Default for Msig {
    fn default() -> Msig {
        Msig {
            rep: TimeRep::U32,
            proposals: BTreeMap::new(),
        }
    }
}

impl Msig {
    /// Propose a short-lived execution. The TTL is days-class by law L2;
    /// the encoded expiration must fit the CURRENT representation or the
    /// proposal refuses to exist (L4) — even a one-day TTL refuses once
    /// `now` itself passes the horizon.
    pub fn propose(
        &mut self,
        proposer: &str,
        proposal_name: &str,
        requested: Vec<PermissionLevel>,
        payload_digest: &str,
        ttl_seconds: u64,
        now: u64,
    ) -> R<()> {
        if requested.len() > MSIG_APPROVALS_CAP {
            return refuse(
                "bt-wb004:approvals-cap",
                format!(
                    "{} requested permission levels exceeds the execution-layer cap {}; \
                     population-scale authorization belongs to aggregation, not to msig storage",
                    requested.len(),
                    MSIG_APPROVALS_CAP
                ),
            );
        }
        if requested.is_empty() {
            return refuse(
                "bt-wb004:empty",
                "a proposal needs at least one requested level",
            );
        }
        let expiration = encode_expiration(
            self.rep,
            now.checked_add(ttl_seconds).ok_or(Refusal {
                code: "bt-wb004:unrepresentable",
                msg: "ttl overflows the clock".into(),
            })?,
        )?;
        if self.proposals.contains_key(proposal_name) {
            return refuse("bt-wb004:exists", "proposal name already in use");
        }
        self.proposals.insert(
            proposal_name.into(),
            MsigProposal {
                proposer: proposer.into(),
                proposal_name: proposal_name.into(),
                requested,
                provided: Vec::new(),
                expiration,
                payload_digest: payload_digest.into(),
            },
        );
        Ok(())
    }

    /// Approve: the owner of a requested level moves it from requested
    /// to provided (specimen approve semantics).
    pub fn approve(&mut self, actor: &str, permission: &str, proposal_name: &str) -> R<()> {
        let p = self
            .proposals
            .get_mut(proposal_name)
            .ok_or_else(|| Refusal {
                code: "bt-wb004:not-found",
                msg: format!("no proposal {proposal_name}"),
            })?;
        let idx = p
            .requested
            .iter()
            .position(|l| l.actor == actor && l.permission == permission)
            .ok_or_else(|| Refusal {
                code: "bt-wb004:auth",
                msg: format!("{actor}@{permission} is not a requested level"),
            })?;
        let level = p.requested.remove(idx);
        p.provided.push(level);
        Ok(())
    }

    /// Execute: every requested level provided, and the proposal still
    /// alive (specimen `:218` — "transaction expired"). Returns the
    /// executed digest; removes the proposal (short-lived by law L2).
    pub fn exec(&mut self, now: u64, proposal_name: &str) -> R<String> {
        let p = self.proposals.get(proposal_name).ok_or_else(|| Refusal {
            code: "bt-wb004:not-found",
            msg: format!("no proposal {proposal_name}"),
        })?;
        if !p.requested.is_empty() {
            return refuse(
                "bt-wb004:quorum",
                format!(
                    "{} requested approvals still outstanding",
                    p.requested.len()
                ),
            );
        }
        if now >= p.expiration {
            return refuse(
                "bt-wb004:expired",
                format!("proposal {proposal_name} expired; proposals are short-lived by law"),
            );
        }
        let digest = p.payload_digest.clone();
        self.proposals.remove(proposal_name);
        Ok(digest)
    }

    /// Cancel: the proposer anytime; anyone else only once the proposal
    /// has expired (specimen `:191` — "cannot cancel until expiration").
    pub fn cancel(&mut self, now: u64, by: &str, proposal_name: &str) -> R<()> {
        let p = self.proposals.get(proposal_name).ok_or_else(|| Refusal {
            code: "bt-wb004:not-found",
            msg: format!("no proposal {proposal_name}"),
        })?;
        if by != p.proposer && now < p.expiration {
            return refuse(
                "bt-wb004:not-expired",
                "only the proposer may cancel before expiration",
            );
        }
        self.proposals.remove(proposal_name);
        Ok(())
    }

    /// Total permission levels stored across all live proposals — the
    /// bounded-layer witness the battery watches under population growth.
    pub fn stored_levels(&self) -> usize {
        self.proposals
            .values()
            .map(|p| p.requested.len() + p.provided.len())
            .sum()
    }
}
