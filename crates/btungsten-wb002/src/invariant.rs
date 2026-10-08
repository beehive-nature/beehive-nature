//! THE killer invariant, executable: every sovereignty change must be
//! explained by an authorized action of the PREVIOUS sovereign (a direct
//! signature, or standing consent: an offer they signed into existence).

use crate::chain::Chain;
use std::collections::{BTreeMap, BTreeSet};

pub type SovSnap = BTreeMap<u64, Option<String>>;
pub type FtSnap = BTreeMap<(String, u64), u128>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unexplained {
    pub id: String,
    pub from: String,
    pub to: String,
}

/// Every top-level asset's sovereign (the invariant's subject).
pub fn sovereign_snapshot(c: &mut Chain) -> SovSnap {
    let ids: Vec<u64> = c
        .scopes()
        .values()
        .flat_map(|m| m.keys().copied())
        .chain(c.ntt_scopes().values().flat_map(|m| m.keys().copied()))
        .collect();
    ids.into_iter().map(|id| (id, c.sovereign_of(id))).collect()
}

pub fn ft_snapshot(c: &Chain) -> FtSnap {
    let mut s = FtSnap::new();
    for (owner, m) in c.balances() {
        for (ftid, b) in m {
            s.insert((owner.clone(), *ftid), b.amount);
        }
    }
    s
}

/// The unexplained changes of one step; empty = the invariant held.
pub fn unexplained(
    before: &SovSnap,
    after: &SovSnap,
    signers: &[&str],
    consent: &BTreeMap<u64, String>,
) -> Vec<Unexplained> {
    let ids: BTreeSet<u64> = before.keys().chain(after.keys()).copied().collect();
    let mut bad = Vec::new();
    for id in ids {
        let b = before.get(&id).cloned().flatten();
        let a = after.get(&id).cloned().flatten();
        if b == a {
            continue;
        }
        // destruction is sovereign-authorized via burn; creation is issuance
        let (Some(b), Some(a)) = (b, a) else { continue };
        let consented = consent.get(&id) == Some(&b);
        if !signers.contains(&b.as_str()) && !consented {
            bad.push(Unexplained {
                id: id.to_string(),
                from: b,
                to: a,
            });
        }
    }
    bad
}

/// FT twin: a balance falls only under its holder's signature or a standing
/// FT offer they signed.
pub fn ft_unexplained(
    before: &FtSnap,
    after: &FtSnap,
    signers: &[&str],
    consent: &BTreeMap<(String, u64), String>,
) -> Vec<Unexplained> {
    let keys: BTreeSet<(String, u64)> = before.keys().chain(after.keys()).cloned().collect();
    let mut bad = Vec::new();
    for k in keys {
        let b = before.get(&k).copied().unwrap_or(0);
        let a = after.get(&k).copied().unwrap_or(0);
        if a >= b {
            continue; // receipt of funds is never a taking
        }
        let holder = &k.0;
        if !signers.contains(&holder.as_str()) && consent.get(&k) != Some(holder) {
            bad.push(Unexplained {
                id: format!("{}:{}", k.0, k.1),
                from: b.to_string(),
                to: a.to_string(),
            });
        }
    }
    bad
}

/// Consent standing BEFORE an action: open offers by their owner.
pub fn consent_of(c: &Chain) -> BTreeMap<u64, String> {
    c.offers()
        .iter()
        .chain(c.ntt_offers().iter())
        .map(|(id, o)| (*id, o.owner.clone()))
        .collect()
}

pub fn ft_consent_of(c: &Chain) -> BTreeMap<(String, u64), String> {
    c.ft_offers()
        .values()
        .map(|o| ((o.owner.clone(), o.ftid), o.owner.clone()))
        .collect()
}
