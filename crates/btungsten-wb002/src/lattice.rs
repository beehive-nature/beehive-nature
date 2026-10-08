//! The truth lattice: consensus truth (the log fold), indexer truth, UI
//! truth. The Indexer takes injectable faults (drop, replay, corrupt, lag);
//! the AdapterUI answers DISPUTED when the stream fails authentication; the
//! SpecimenUI trusts the indexer blindly (upstream issues #26, #19).

use crate::chain::{CheckpointAnchor, TipAnchor};
use crate::log::{genesis, Event, Val};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
enum Sov {
    Account(String),
    ContainerOf(u64),
}

/// The archivist's fold: sovereignty from the anchored log ALONE, with
/// checkpoints as full-state restarts.
pub struct Fold {
    owner: BTreeMap<u64, Sov>,
    ntt: BTreeMap<u64, String>,
    delegated: BTreeMap<u64, String>,
}

impl Fold {
    pub fn sovereign(&self, id: u64) -> Option<String> {
        let mut cur = id;
        let mut seen = BTreeSet::new();
        while seen.insert(cur) {
            if let Some(l) = self.delegated.get(&cur) {
                return Some(l.clone());
            }
            if let Some(o) = self.ntt.get(&cur) {
                return Some(o.clone());
            }
            match self.owner.get(&cur) {
                None => return None,
                Some(Sov::Account(a)) => return Some(a.clone()),
                Some(Sov::ContainerOf(p)) => cur = *p,
            }
        }
        None
    }
}

pub fn reconstruct(events: &[Event]) -> Fold {
    let mut st = Fold {
        owner: BTreeMap::new(),
        ntt: BTreeMap::new(),
        delegated: BTreeMap::new(),
    };
    for ev in events {
        let id = ev.id("assetid");
        match ev.ty() {
            "checkpoint" => {
                st.owner.clear();
                st.ntt.clear();
                st.delegated.clear();
                if let Some(Val::Arr(d)) = ev.fields.get("deleg") {
                    for pair in d {
                        if let Val::Arr(p) = pair {
                            if let (Some(i), Some(l)) = (p[0].as_int(), p[1].as_str()) {
                                st.delegated.insert(i as u64, l.to_string());
                            }
                        }
                    }
                }
                if let Some(Val::Arr(a)) = ev.fields.get("assets") {
                    for triple in a {
                        let Val::Arr(t) = triple else { continue };
                        let Some(i) = t[0].as_int() else { continue };
                        let kind = t[2].as_str().unwrap_or("");
                        match &t[1] {
                            Val::Str(s) if kind == "ntt" => {
                                st.ntt.insert(i as u64, s.clone());
                            }
                            Val::Str(s) => {
                                st.owner.insert(i as u64, Sov::Account(s.clone()));
                            }
                            Val::Obj(_) => {
                                if let Some(p) = t[1].get("containerOf").and_then(Val::as_int) {
                                    st.owner.insert(i as u64, Sov::ContainerOf(p as u64));
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            "spawn" => {
                let (Some(id), Some(o)) = (id, ev.str("owner")) else {
                    continue;
                };
                if ev.str("kind") == Some("ntt") {
                    st.ntt.insert(id, o.into());
                } else {
                    st.owner.insert(id, Sov::Account(o.into()));
                }
            }
            "move" => {
                let (Some(id), Some(to)) = (id, ev.str("to")) else {
                    continue;
                };
                if let Some(o) = st.ntt.get_mut(&id) {
                    *o = to.into();
                } else {
                    st.owner.insert(id, Sov::Account(to.into()));
                }
            }
            "burn" => {
                let Some(id) = id else { continue };
                st.owner.remove(&id);
                st.ntt.remove(&id);
                st.delegated.remove(&id);
            }
            "attach" => {
                let (Some(id), Some(p)) = (id, ev.id("parent")) else {
                    continue;
                };
                st.owner.insert(id, Sov::ContainerOf(p));
                st.delegated.remove(&id);
            }
            "detach" => {
                let (Some(id), Some(h)) = (id, ev.str("holder")) else {
                    continue;
                };
                st.owner.insert(id, Sov::Account(h.into()));
            }
            "delegateopen" => {
                let (Some(id), Some(o)) = (id, ev.str("owner")) else {
                    continue;
                };
                st.delegated.insert(id, o.into());
            }
            "delegateclose" => {
                if let Some(id) = id {
                    st.delegated.remove(&id);
                }
            }
            _ => {} // offer/mdata/chauthor/ft-* events do not move NFT sovereignty
        }
    }
    st
}

#[derive(Clone, Default)]
pub struct Indexer {
    pub events: Vec<Event>,
}

impl Indexer {
    pub fn feed(&mut self, events: &[Event]) {
        self.events = events.to_vec();
    }
    pub fn drop_seq(&mut self, seq: u64) {
        self.events.retain(|e| e.seq != seq);
    }
    pub fn replay(&mut self, seq: u64) {
        if let Some(e) = self.events.iter().find(|x| x.seq == seq).cloned() {
            self.events.push(e);
        }
    }
    pub fn corrupt(&mut self, seq: u64, key: &str, v: Val) {
        if let Some(e) = self.events.iter_mut().find(|x| x.seq == seq) {
            e.fields.insert(key.into(), v);
        }
    }
    pub fn lag(&mut self, k: usize) {
        self.events.truncate(k);
    }
    /// Contiguous seqs and every verifiable hash link. A stream starting
    /// mid-log begins from an assumed root: its first link is trusted only
    /// provisionally (the AdapterUI's checkpoint comparison anchors it).
    pub fn chain_consistent(&self) -> bool {
        let mut prev: Option<(u64, String)> = None;
        for e in &self.events {
            match &prev {
                Some((ps, pr)) => {
                    if e.seq != ps + 1 || e.root != e.root_over(pr) {
                        return false;
                    }
                }
                None => {
                    if e.seq == 0 && e.root != e.root_over(&genesis()) {
                        return false;
                    }
                }
            }
            prev = Some((e.seq, e.root.clone()));
        }
        true
    }
    pub fn fold(&self) -> Fold {
        reconstruct(&self.events)
    }
}

/// Upstream-era posture: the indexer's word IS the displayed owner.
pub struct SpecimenUI<'a>(pub &'a Indexer);
impl SpecimenUI<'_> {
    pub fn display_owner(&self, id: u64) -> Option<String> {
        self.0.fold().sovereign(id)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Scope {
    AuthenticatedTip,
    CheckpointScoped,
    Disputed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Display {
    /// `Some(None)` = authenticated "no owner"; `None` = DISPUTED
    pub owner: Option<Option<String>>,
    pub as_of_seq: Option<u64>,
    pub scope: Scope,
}

pub const DISPUTED: &str = "DISPUTED";

/// Display truth from consensus anchors (model-hardening R-2): the
/// checkpoint anchor authenticates its body through the parent root, links
/// after it must verify, and only a trusted tip promotes the suffix.
pub struct AdapterUI<'a> {
    pub indexer: &'a Indexer,
    pub checkpoint: Option<CheckpointAnchor>,
    pub tip: Option<TipAnchor>,
}

impl AdapterUI<'_> {
    pub fn display(&self, id: u64) -> Display {
        let disputed = Display {
            owner: None,
            as_of_seq: None,
            scope: Scope::Disputed,
        };
        let Some(cp) = &self.checkpoint else {
            return disputed;
        };
        // a root-only anchor cannot authenticate contents: fail closed
        if cp.parent_root.is_empty() || cp.root.is_empty() {
            return disputed;
        }
        let Some(ev) = self.indexer.events.iter().find(|e| e.seq == cp.seq) else {
            return disputed;
        };
        // OBLIGATION A: authenticate the checkpoint CONTENTS
        if ev.root_over(&cp.parent_root) != ev.root || ev.root != cp.root {
            return disputed;
        }
        let (mut prev_seq, mut prev_root) = (ev.seq, ev.root.clone());
        for e in &self.indexer.events {
            if e.seq <= ev.seq {
                continue;
            }
            if e.seq != prev_seq + 1 || e.root_over(&prev_root) != e.root {
                return disputed;
            }
            prev_seq = e.seq;
            prev_root = e.root.clone();
        }
        // OBLIGATION B: only a trusted tip bracketing the exact end promotes
        // the suffix; otherwise answer as of the checkpoint
        if let Some(t) = &self.tip {
            if prev_seq == t.seq && prev_root == t.root {
                return Display {
                    owner: Some(reconstruct(&self.indexer.events).sovereign(id)),
                    as_of_seq: Some(t.seq),
                    scope: Scope::AuthenticatedTip,
                };
            }
        }
        let upto: Vec<Event> = self
            .indexer
            .events
            .iter()
            .filter(|e| e.seq <= ev.seq)
            .cloned()
            .collect();
        Display {
            owner: Some(reconstruct(&upto).sovereign(id)),
            as_of_seq: Some(ev.seq),
            scope: Scope::CheckpointScoped,
        }
    }
    /// The displayed owner, DISPUTED when authentication failed.
    pub fn display_owner(&self, id: u64) -> Option<String> {
        match self.display(id).owner {
            None => Some(DISPUTED.into()),
            Some(o) => o,
        }
    }
}
