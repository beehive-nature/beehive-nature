//! Per-claimant funding wiring for the epoch pipeline (8s / 8t).
//!
//! Ruled 2026-08-09 (`bzdid-architecture-decision.md` §3.5): the leader PACKS
//! per-name ANS-104 DataItems but FUNDS none of them — each item's [`ArweaveRail`]
//! carries ITS CLAIMANT's `x-paid-by` delegate ([`ArweaveRail::paid_by`],
//! `arweave.rs:170`). The leader funds ONLY the on-chain commit. **ONE rail carrying
//! the leader's delegate across per-name items is the BREACH** (`arweave.rs:48-58`).
//!
//! `.paid_by()` consumes `self` (a builder), so per-claimant funding is a fresh rail
//! (or a re-applied delegate) per item — never one shared rail. This module builds
//! rails that way and provides [`assert_per_claimant_funding`], the funding-invariant
//! check goose's 8s verification reads: it fails the moment any item is funded by the
//! leader (or by no delegate at all, which means the leader's own credits pay).
//!
//! Scope: this wires WHO PAYS (the delegate), which is the 8s-relevant axis. Actual
//! DataItem signing/upload needs a signer and a funded delegate approval and is not
//! exercised here (no funded keys; a funding invariant must not depend on holding one).

use crate::arweave::ArweaveRail;

/// One name's registration: the leader packs it, the claimant's delegate funds it.
pub struct Registration {
    pub name: String,
    /// The `x-paid-by` delegate that funds THIS name's DataItem. Not the leader's.
    pub claimant_delegate: String,
}

/// Build one funded rail per registration — each carries its own claimant's delegate.
/// The efficient production variant re-applies the delegate to a reused rail; this
/// builds fresh rails, which is clearer for the invariant and identical in funding.
pub fn per_claimant_rails(regs: &[Registration]) -> Vec<ArweaveRail> {
    regs.iter()
        .map(|r| ArweaveRail::read_only(&[]).paid_by(&r.claimant_delegate))
        .collect()
}

/// The 8s funding invariant: every item's rail is funded by ITS OWN claimant, and
/// NONE by the leader. `Err` names the first violation so a breach is localised, not
/// merely detected.
pub fn assert_per_claimant_funding(
    rails: &[ArweaveRail],
    regs: &[Registration],
    leader_delegate: &str,
) -> Result<(), String> {
    if rails.len() != regs.len() {
        return Err(format!(
            "rail/registration count mismatch: {} vs {}",
            rails.len(),
            regs.len()
        ));
    }
    for (rail, reg) in rails.iter().zip(regs) {
        match rail.delegate() {
            None => {
                return Err(format!("{}: no delegate — the leader's own credits pay (breach)", reg.name))
            }
            Some(d) if d == leader_delegate => {
                return Err(format!("{}: funded by the LEADER delegate — the breach", reg.name))
            }
            Some(d) if d != reg.claimant_delegate => {
                return Err(format!(
                    "{}: funded by {} not its claimant {}",
                    reg.name, d, reg.claimant_delegate
                ))
            }
            Some(_) => {}
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn regs() -> Vec<Registration> {
        ["alice", "bob", "carol"]
            .iter()
            .map(|n| Registration {
                name: (*n).to_string(),
                claimant_delegate: format!("{n}-delegate"),
            })
            .collect()
    }

    #[test]
    fn per_claimant_funding_holds() {
        let r = regs();
        let rails = per_claimant_rails(&r);
        assert_eq!(assert_per_claimant_funding(&rails, &r, "LEADER-delegate"), Ok(()));
        for (rail, reg) in rails.iter().zip(&r) {
            assert_eq!(rail.delegate(), Some(reg.claimant_delegate.as_str()));
        }
    }

    /// 8r negative control: ONE rail with the leader's delegate reused across all
    /// items is the breach — the invariant MUST detect it. Fails if the breach stops
    /// being detectable (so this control cannot go vacuous).
    #[test]
    fn one_leader_rail_across_items_is_the_breach() {
        let r = regs();
        let leader = "LEADER-delegate";
        let rails: Vec<ArweaveRail> = r
            .iter()
            .map(|_| ArweaveRail::read_only(&[]).paid_by(leader)) // the WRONG construction
            .collect();
        let res = assert_per_claimant_funding(&rails, &r, leader);
        assert!(res.is_err(), "the leader-funded breach must be detected");
        assert!(res.unwrap_err().contains("LEADER"));
    }

    /// A rail with no delegate means the signer (leader) pays — also a breach.
    #[test]
    fn no_delegate_is_a_breach() {
        let r = regs();
        let rails: Vec<ArweaveRail> = r.iter().map(|_| ArweaveRail::read_only(&[])).collect();
        let res = assert_per_claimant_funding(&rails, &r, "LEADER-delegate");
        assert!(res.is_err() && res.unwrap_err().contains("no delegate"));
    }
}
