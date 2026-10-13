//! One poll of the edge (contract §4 rules 1-7, §7 A1): gather candidate
//! envelopes from every source and the kept fork evidence, parse them (rule
//! 1), walk each peer's chain endpoint one seq at a time, walk the chain
//! from the pinned genesis with both verifiers (rules 2, 3, 5), keep what
//! the walk met at a fork (rule 5), pick the highest record at or above the
//! floor (rule 4), find bytes that hash to what it names (rule 6), raise
//! the floor, persist, swap, serve. A corrupt serve state is discarded and
//! the edge answers 503 until a release at or above the floor verifies
//! again (rule 7). A floor or evidence store that cannot be read refuses
//! every new release; the one already served stays served.

use std::collections::HashMap;
use std::sync::Arc;

use serde_json::json;
use sha2::{Digest, Sha256};

use crate::b64::{b64u, unb64u32};
use crate::chain::{self, Equivocation, Link, Pool};
use crate::config::Config;
use crate::pq::sha3;
use crate::record::{parse_envelope, Parsed, Record, Refusal, MAX_ENVELOPE};
use crate::server::{Health, Serving, SharedRef};
use crate::sources::{self, Http};
use crate::store::{Store, MAX_EVIDENCE};
use crate::verify::Verifiers;

const HINT_LIMIT: usize = 8;
const CACHE_MAX: usize = 4096;
/// What one poll's peer walk may spend over every peer (contract §7 A1):
/// requests to the chain endpoints, and the bytes they return (checked
/// before each request, so at most one envelope more).
pub const WALK_REQUESTS: usize = 64;
pub const WALK_BYTES: usize = 2 * 1024 * 1024;
/// Envelope bytes of the verified records above the served one that are
/// held between polls, so a walk its budget cut short resumes where it
/// stopped rather than from the served seq again.
pub const AHEAD_BYTES: usize = 64 * 1024 * 1024;

type Cache = HashMap<([u8; 32], [u8; 32]), Result<String, Refusal>>;
/// a pack that hashes to what its record names, and its SHA3-256
type Found = Result<(Vec<u8>, [u8; 32]), String>;

enum Bad {
    /// these bytes are not the pack; another locator may have it
    Pack(String),
    /// the pack matches but a file in it does not: the record is broken
    File(String),
}

/// Check bytes against everything the record names: the pack's size,
/// SHA-256 and SHA3-256, then every file's (rule 6).
fn check_pack(r: &Record, bytes: &[u8]) -> Result<[u8; 32], Bad> {
    let h3 = sha3(&[bytes]);
    if bytes.len() as u64 != r.pack.size
        || b64u(&Sha256::digest(bytes)) != r.pack.sha256
        || b64u(&h3) != r.pack.sha3
    {
        return Err(Bad::Pack(format!(
            "pack mismatch ({} bytes, record names {})",
            bytes.len(),
            r.pack.size
        )));
    }
    let mut off = 0usize;
    for f in &r.files {
        let b = &bytes[off..off + f.size as usize];
        if b64u(&Sha256::digest(b)) != f.sha256 || b64u(&sha3(&[b])) != f.sha3 {
            return Err(Bad::File(format!(
                "file {} does not match its hashes",
                f.path
            )));
        }
        off += f.size as usize;
    }
    Ok(h3)
}

fn admit(
    cfg: &Config,
    bytes: &[u8],
    from: &str,
    pool: &mut Pool,
    notes: &mut Vec<String>,
) -> Option<Arc<Parsed>> {
    match parse_envelope(bytes, &cfg.origin, &cfg.rp_id) {
        Ok(p) => {
            let p = Arc::new(p);
            pool.add(p.clone());
            Some(p)
        }
        Err(r) => {
            notes.push(format!("{from}: {} ({r})", r.name()));
            None
        }
    }
}

/// One poll's walk of the peers' chain endpoints (contract §7 A1), within
/// its budget.
struct PeerWalk<'a, F: FnMut(&Parsed) -> Result<String, Refusal>> {
    cfg: &'a Config,
    genesis: &'a [u8; 32],
    http: &'a dyn Http,
    verify: F,
    requests: usize,
    bytes: usize,
}

impl<F: FnMut(&Parsed) -> Result<String, Refusal>> PeerWalk<'_, F> {
    /// `<peer>/.well-known/bnr-keychain/release/<seq>`: Some(envelope),
    /// None on 404 (the end of the peer's chain), Err on anything else or
    /// when the budget is spent.
    fn get(&mut self, peer: &str, seq: u64) -> Result<Option<Vec<u8>>, String> {
        if self.requests == 0 || self.bytes == 0 {
            return Err(format!(
                "this poll's walk budget is spent; the walk resumes at seq {seq}"
            ));
        }
        self.requests -= 1;
        match sources::peer_release_at(self.http, peer, seq) {
            Ok(b) => {
                self.bytes = self.bytes.saturating_sub(b.len());
                Ok(Some(b))
            }
            Err(e) if e == sources::NOT_FOUND => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Walk one peer from `base` (genesis when None) upward until 404. Every
    /// envelope is checked on its own as the one after the record before it
    /// (chain::extends: seq, prev, signer, both verifiers); the first that
    /// fails ends the walk and nothing above it is fetched. Returns the
    /// record the peer's chain ends at when the walk reached its 404: the
    /// only seq whose pack that peer is asked for.
    fn walk(
        &mut self,
        peer: &str,
        base: Option<&Arc<Parsed>>,
        served_seq: u64,
        pool: &mut Pool,
        notes: &mut Vec<String>,
    ) -> Option<(u64, [u8; 32])> {
        let mut prev = base.cloned();
        let mut end = None;
        loop {
            let seq = prev.as_ref().map_or(1, |p| p.record.seq + 1);
            let bytes = match self.get(peer, seq) {
                Ok(Some(b)) => b,
                Ok(None) => break,
                Err(e) => {
                    notes.push(format!("peer {peer} seq {seq}: {e}"));
                    return None;
                }
            };
            let p = match parse_envelope(&bytes, &self.cfg.origin, &self.cfg.rp_id) {
                Ok(p) if p.record.seq == seq => Arc::new(p),
                Ok(p) => {
                    notes.push(format!(
                        "peer {peer} seq {seq}: it answers with seq {}",
                        p.record.seq
                    ));
                    return None;
                }
                Err(r) => {
                    notes.push(format!("peer {peer} seq {seq}: {} ({r})", r.name()));
                    return None;
                }
            };
            if let Err(e) = chain::extends(
                prev.as_deref(),
                &p,
                self.genesis,
                &self.cfg.genesis_signers,
                &mut self.verify,
            ) {
                notes.push(format!("peer {peer} seq {seq}: {e}"));
                return None;
            }
            pool.add(p.clone());
            end = Some((seq, p.record_sha3));
            prev = Some(p);
        }
        if end.is_some() {
            return end;
        }
        // nothing past the base: the peer may hold the base itself as its
        // current, which matters only while the base's pack is still wanted
        let b = base.filter(|b| b.record.seq > served_seq)?;
        match self.get(peer, b.record.seq) {
            Ok(Some(bytes)) => parse_envelope(&bytes, &self.cfg.origin, &self.cfg.rp_id)
                .ok()
                .filter(|p| p.record.seq == b.record.seq && p.record_sha3 == b.record_sha3)
                .map(|p| (p.record.seq, p.record_sha3)),
            Ok(None) => None,
            Err(e) => {
                notes.push(format!("peer {peer} seq {}: {e}", b.record.seq));
                None
            }
        }
    }
}

fn cached_verify(verifiers: &Verifiers, cache: &mut Cache, p: &Parsed) -> Result<String, Refusal> {
    let key = (p.record_sha3, p.sig_key);
    if let Some(r) = cache.get(&key) {
        return r.clone();
    }
    let r = verifiers.verify(p);
    if !matches!(r, Err(Refusal::VerifierFailed(_))) {
        if cache.len() >= CACHE_MAX {
            cache.clear();
        }
        cache.insert(key, r.clone());
    }
    r
}

pub struct Door {
    cfg: Config,
    genesis: [u8; 32],
    verifiers: Verifiers,
    store: Store,
    http: Box<dyn Http>,
    shared: SharedRef,
    cache: Cache,
    /// accepted envelopes, genesis first (from disk, then from each swap)
    state_chain: Vec<Vec<u8>>,
    /// the pack read from disk at load, until a swap serves it
    state_pack: Option<(Vec<u8>, [u8; 32])>,
    load_error: Option<String>,
    /// the highest seq the last walk reached (the Arweave window starts here)
    tip: u64,
    /// fork evidence whose write to state_dir/evidence failed; retried
    /// every poll and put in every pool meanwhile
    unkept: Vec<Vec<u8>>,
    /// the last walk's unresolved fork, reported again by a poll that
    /// refuses before it walks
    equivocation: Option<Equivocation>,
    /// the last walk's verified records above the served one, genesis side
    /// first: put back in every pool, and the peer walk resumes past them
    /// (at most AHEAD_BYTES of envelopes; they are walked again every poll)
    ahead: Vec<Arc<Parsed>>,
    /// where each configured peer's chain ended (a 404 right after it) in
    /// the last peer walk: the only record whose pack that peer is asked for
    peer_ends: HashMap<String, (u64, [u8; 32])>,
    /// (requests, bytes) one poll's peer walk may spend
    walk_budget: (usize, usize),
    notes: Vec<String>,
}

impl Door {
    pub fn new(cfg: Config, verifiers: Verifiers, http: Box<dyn Http>, shared: SharedRef) -> Door {
        Door {
            genesis: cfg.genesis(),
            store: Store::new(&cfg.state_dir),
            cfg,
            verifiers,
            http,
            shared,
            cache: HashMap::new(),
            state_chain: Vec::new(),
            state_pack: None,
            load_error: None,
            tip: 0,
            unkept: Vec::new(),
            equivocation: None,
            ahead: Vec::new(),
            peer_ends: HashMap::new(),
            walk_budget: (WALK_REQUESTS, WALK_BYTES),
            notes: Vec::new(),
        }
    }

    /// A smaller peer walk budget, so a test can cut a walk short.
    #[cfg(test)]
    pub fn set_walk_budget(&mut self, requests: usize, bytes: usize) {
        self.walk_budget = (requests, bytes);
    }

    /// The notes of the last poll (refusals, fetch failures), oldest first.
    pub fn notes(&self) -> &[String] {
        &self.notes
    }

    /// Read the serve state from disk as a source for the next poll. A state
    /// that cannot be read is discarded (rule 7) and reported.
    pub fn load(&mut self) {
        match self.store.load() {
            Ok(Some(p)) => {
                self.state_chain = p.chain;
                self.state_pack = Some((p.pack, p.pack_sha3));
            }
            Ok(None) => {}
            Err(e) => self.load_error = Some(format!("serve state discarded (rule 7): {e}")),
        }
    }

    fn serving(&self) -> Option<Arc<Serving>> {
        self.shared.read().ok().and_then(|s| s.serving.clone())
    }

    /// One poll. With `network` false only the state, the evidence and the
    /// inbox are read.
    pub fn poll(&mut self, network: bool) {
        let mut notes: Vec<String> = self.load_error.take().into_iter().collect();
        let floor = match self.store.floor() {
            Ok(f) => f.max(self.cfg.min_seq),
            Err(e) => {
                self.refuse(e, notes);
                return;
            }
        };
        let evidence = match self.evidence(floor, &mut notes) {
            Ok(e) => e,
            Err(e) => {
                self.refuse(e, notes);
                return;
            }
        };
        let mut pool = self.gather(network, &evidence, &mut notes);
        if network {
            self.walk_peers(&mut pool, &mut notes);
        }
        let (verifiers, cache) = (&self.verifiers, &mut self.cache);
        let mut verify = |p: &Parsed| cached_verify(verifiers, cache, p);
        let w = chain::walk(&pool, &self.genesis, &self.cfg.genesis_signers, &mut verify);
        notes.extend(w.notes);
        self.tip = w.path.last().map_or(0, Link::seq);
        self.equivocation = w.equivocation;
        if !self.remember(&w.evidence, evidence, floor, &mut notes) {
            self.report(notes);
            return;
        }

        let current = self.serving();
        let cur = current.as_ref().map(|s| (s.seq, s.record_sha3));
        let cur_on_path =
            cur.is_some_and(|(seq, h)| w.path.iter().any(|l| l.seq() == seq && l.sha3() == h));
        for idx in (0..w.path.len()).rev() {
            let t = &w.path[idx];
            let better = match cur {
                None => true,
                Some((seq, h)) => {
                    t.seq() > seq || (t.seq() == seq && t.sha3() != h && !cur_on_path)
                }
            };
            if t.seq() < floor || !better {
                if t.seq() < floor && cur.is_none() && idx + 1 == w.path.len() {
                    notes.push(format!(
                        "seq {} is below the floor {floor} (rule 4)",
                        t.seq()
                    ));
                }
                break;
            }
            let top = idx + 1 == w.path.len();
            match self.fetch(t, top, &pool, current.as_deref(), network) {
                Ok((pack, h)) => {
                    self.swap(&w.path[..=idx], pack, h, &mut notes);
                    break;
                }
                Err(e) => notes.push(format!("seq {} bytes: {e}", t.seq())),
            }
        }
        let served = self.serving().map_or(0, |s| s.seq);
        let mut held = 0usize;
        self.ahead = w
            .path
            .iter()
            .filter(|l| l.seq() > served)
            .take_while(|l| {
                held += l.env.bytes.len();
                held <= AHEAD_BYTES
            })
            .map(|l| l.env.clone())
            .collect();
        self.report(notes);
    }

    /// A poll that cannot read the floor or the evidence accepts nothing
    /// new. The release already served stays served: it was accepted while
    /// both could be read.
    fn refuse(&mut self, e: String, mut notes: Vec<String>) {
        notes.push(format!(
            "{e}: refusing every new release until it is repaired"
        ));
        self.report(notes);
    }

    /// The fork evidence kept for rule 5: the kept envelopes and any whose
    /// write failed (written again now), each at or above the floor. Below
    /// the floor nothing is accepted again (rule 4) and the served chain
    /// already took its branch, so evidence there is dropped, as is an
    /// envelope that no longer parses under this config (it can never enter
    /// a pool). A fork below the floor then holds the edge only while a
    /// source still offers both branches, not for good.
    fn evidence(&mut self, floor: u64, notes: &mut Vec<String>) -> Result<Vec<Vec<u8>>, String> {
        let mut all = Vec::new();
        for e in self.store.evidence()? {
            match self.spent_evidence(&e, floor) {
                None => all.push(e),
                Some(why) => match self.store.drop_evidence(&e) {
                    Ok(()) => eprintln!("keys-door: evidence dropped: {why}"),
                    Err(err) => notes.push(err),
                },
            }
        }
        for e in std::mem::take(&mut self.unkept) {
            if self.spent_evidence(&e, floor).is_some() || all.contains(&e) {
                continue;
            }
            if let Err(err) = self.store.keep_evidence(&e) {
                notes.push(err);
                self.unkept.push(e.clone());
            }
            all.push(e);
        }
        Ok(all)
    }

    /// Why an evidence envelope can no longer matter; None while it can.
    fn spent_evidence(&self, e: &[u8], floor: u64) -> Option<String> {
        match parse_envelope(e, &self.cfg.origin, &self.cfg.rp_id) {
            Ok(p) if p.record.seq >= floor => None,
            Ok(p) => Some(format!(
                "seq {} record {} is below the floor {floor}",
                p.record.seq,
                b64u(&p.record_sha3)
            )),
            Err(r) => Some(format!(
                "an envelope that does not parse under this config ({})",
                r.name()
            )),
        }
    }

    /// Keep what the walk met at a fork (rule 5) at or above the floor, so
    /// the fork is not forgotten when a source stops offering one branch.
    /// False when there is no room: a fork the edge cannot remember is one
    /// it could forget, so it holds at the release it serves.
    fn remember(
        &mut self,
        found: &[Arc<Parsed>],
        mut all: Vec<Vec<u8>>,
        floor: u64,
        notes: &mut Vec<String>,
    ) -> bool {
        for p in found {
            if p.record.seq < floor || all.contains(&p.bytes) {
                continue;
            }
            if all.len() >= MAX_EVIDENCE {
                notes.push(format!(
                    "evidence is full ({MAX_EVIDENCE} envelopes): holding at the current release (rule 5)"
                ));
                return false;
            }
            if let Err(e) = self.store.keep_evidence(&p.bytes) {
                notes.push(e);
                self.unkept.push(p.bytes.clone());
            }
            all.push(p.bytes.clone());
        }
        true
    }

    fn gather(&self, network: bool, evidence: &[Vec<u8>], notes: &mut Vec<String>) -> Pool {
        let mut pool = Pool::default();
        for e in &self.state_chain {
            admit(&self.cfg, e, "state", &mut pool, notes);
        }
        for e in evidence {
            admit(&self.cfg, e, "evidence", &mut pool, notes);
        }
        for (name, bytes) in sources::read_inbox(&self.cfg.inbox_dir, notes) {
            admit(
                &self.cfg,
                &bytes,
                &format!("inbox {name}"),
                &mut pool,
                notes,
            );
        }
        for p in &self.ahead {
            pool.add(p.clone());
        }
        if !network || self.cfg.arweave_owners.is_empty() {
            return pool;
        }
        for gw in &self.cfg.arweave_gateways {
            let before = notes.len();
            let hits = sources::arweave_index(
                self.http.as_ref(),
                gw,
                &self.cfg.arweave_owners,
                &self.cfg.origin,
                self.tip.max(1),
                notes,
            );
            if hits.is_empty() && notes.len() > before {
                continue; // this gateway failed; try the next
            }
            let mut fetched = 0;
            for hit in hits {
                let Some(tag) = unb64u32(&hit.record_sha3) else {
                    continue;
                };
                if pool.contains(hit.seq, &tag) || fetched >= sources::AR_FETCHES {
                    continue;
                }
                fetched += 1;
                let from = format!("arweave {}", hit.txid);
                let bytes = match sources::arweave_data(
                    self.http.as_ref(),
                    gw,
                    &hit.txid,
                    MAX_ENVELOPE as u64,
                ) {
                    Ok(b) => b,
                    Err(e) => {
                        notes.push(format!("{from}: {e}"));
                        continue;
                    }
                };
                // the Record-SHA3 and Seq tags must name this body before
                // it may enter the pool, so before any ML-DSA runs
                match parse_envelope(&bytes, &self.cfg.origin, &self.cfg.rp_id) {
                    Ok(p) if p.record_sha3 == tag && p.record.seq == hit.seq => {
                        pool.add(Arc::new(p))
                    }
                    Ok(_) => notes.push(format!(
                        "{from}: the Record-SHA3 or Seq tag does not name this record"
                    )),
                    Err(r) => notes.push(format!("{from}: {} ({r})", r.name())),
                }
            }
            break;
        }
        pool
    }

    /// The peer walk (contract §7 A1): every configured peer, from the
    /// highest record this edge holds verified (the last of `ahead`, else
    /// the served one, else genesis) up its chain endpoint one seq at a
    /// time until 404, within one budget per poll. A peer's claim of its
    /// current (the bare `release`) is never read. Where each walk reached
    /// its 404 is kept for `fetch`.
    fn walk_peers(&mut self, pool: &mut Pool, notes: &mut Vec<String>) {
        let served = self.serving();
        let served_seq = served.as_ref().map_or(0, |s| s.seq);
        let held: usize = self.ahead.iter().map(|p| p.bytes.len()).sum();
        if held >= AHEAD_BYTES {
            notes.push(format!(
                "{} verified records above the served one fill the {AHEAD_BYTES} bytes held for them: the peer walk waits until one is served",
                self.ahead.len()
            ));
            self.peer_ends.clear();
            return;
        }
        let base = self
            .ahead
            .last()
            .cloned()
            .or_else(|| served.map(|s| s.tip.env.clone()));
        let (verifiers, cache) = (&self.verifiers, &mut self.cache);
        let mut walk = PeerWalk {
            cfg: &self.cfg,
            genesis: &self.genesis,
            http: self.http.as_ref(),
            verify: |p: &Parsed| cached_verify(verifiers, cache, p),
            requests: self.walk_budget.0,
            bytes: self.walk_budget.1,
        };
        let mut ends = HashMap::new();
        for peer in &self.cfg.peers {
            if let Some(end) = walk.walk(peer, base.as_ref(), served_seq, pool, notes) {
                ends.insert(peer.clone(), end);
            }
        }
        self.peer_ends = ends;
    }

    /// Bytes for `t`, from the first locator whose bytes hash right. A
    /// peer's pack is its current one, so a configured peer is asked only
    /// for the record its walk ended at, and a peer an envelope hints at
    /// only for `top`, the walk's final target.
    fn fetch(
        &self,
        t: &Link,
        top: bool,
        pool: &Pool,
        current: Option<&Serving>,
        network: bool,
    ) -> Found {
        let r = &t.env.record;
        let mut tried: Vec<String> = Vec::new();
        let mut attempt = |from: String, got: Result<Vec<u8>, String>| -> Option<Found> {
            match got {
                Ok(b) => match check_pack(r, &b) {
                    Ok(h) => Some(Ok((b, h))),
                    Err(Bad::File(m)) => Some(Err(m)),
                    Err(Bad::Pack(m)) => {
                        tried.push(format!("{from}: {m}"));
                        None
                    }
                },
                Err(e) => {
                    tried.push(format!("{from}: {e}"));
                    None
                }
            }
        };
        if let Some((p, _)) = &self.state_pack {
            if let Some(done) = attempt("state".into(), Ok(p.clone())) {
                return done;
            }
        }
        if let Some(s) = current {
            if let Some(done) = attempt("serving".into(), Ok(s.pack.to_vec())) {
                return done;
            }
        }
        if network {
            let envs = pool.envelopes(t.seq(), &t.sha3());
            let ended_here = Some((t.seq(), t.sha3()));
            let mut peers: Vec<&str> = self
                .cfg
                .peers
                .iter()
                .filter(|p| self.peer_ends.get(*p).copied() == ended_here)
                .map(String::as_str)
                .collect();
            let mut ants: Vec<&str> = Vec::new();
            let mut ars: Vec<&str> = Vec::new();
            for e in envs {
                let h = &e.env.hints;
                for p in h.peers.iter().take(if top { HINT_LIMIT } else { 0 }) {
                    if sources::url_ok(p, false)
                        && !self.cfg.peers.contains(p)
                        && !peers.contains(&p.as_str())
                    {
                        peers.push(p);
                    }
                }
                if let Some(a) = h.ant.as_deref().filter(|a| sources::ant_address_ok(a)) {
                    if !ants.contains(&a) {
                        ants.push(a);
                    }
                }
                for a in h.ar.iter().take(HINT_LIMIT) {
                    if sources::ar_txid_ok(a) && !ars.contains(&a.as_str()) {
                        ars.push(a);
                    }
                }
            }
            let http = self.http.as_ref();
            for peer in peers.iter().take(self.cfg.peers.len() + HINT_LIMIT) {
                if let Some(done) = attempt(
                    format!("peer {peer}"),
                    sources::peer_pack(http, peer, r.pack.size),
                ) {
                    return done;
                }
            }
            for addr in ants.iter().take(HINT_LIMIT) {
                for door in &self.cfg.ant_doors {
                    let got = sources::ant_get(http, door, addr, r.pack.size);
                    if let Some(done) = attempt(format!("ant {door} {addr}"), got) {
                        return done;
                    }
                }
            }
            for tx in ars.iter().take(HINT_LIMIT) {
                for gw in &self.cfg.arweave_gateways {
                    let got = sources::arweave_data(http, gw, tx, r.pack.size);
                    if let Some(done) = attempt(format!("arweave {gw} {tx}"), got) {
                        return done;
                    }
                }
            }
        }
        Err(if tried.is_empty() {
            "no locator holds the pack".to_string()
        } else {
            tried.join("; ")
        })
    }

    /// Raise the floor, persist (pack, then serve.json by rename), serve.
    /// The floor goes first, so the persisted floor is never below the
    /// served seq: losing the serve state later can never reopen a seq this
    /// edge has served (rule 4). If the persist then fails, the edge keeps
    /// serving what it served and the next poll tries again.
    fn swap(
        &mut self,
        chain: &[Link],
        pack: Vec<u8>,
        pack_sha3: [u8; 32],
        notes: &mut Vec<String>,
    ) {
        let t = chain.last().expect("a non-empty chain");
        if let Err(e) = self.store.raise_floor(t.seq()) {
            notes.push(format!("not swapped: {e}"));
            return;
        }
        let envs: Vec<&[u8]> = chain.iter().map(|l| &l.env.bytes[..]).collect();
        if let Err(e) = self.store.commit(&envs, &pack) {
            notes.push(format!("not swapped: {e}"));
            return;
        }
        let serving = Arc::new(Serving::new(chain, pack, pack_sha3));
        if let Ok(mut s) = self.shared.write() {
            s.serving = Some(serving);
        }
        self.state_chain = envs.iter().map(|e| e.to_vec()).collect();
        self.state_pack = None;
    }

    fn report(&mut self, notes: Vec<String>) {
        for n in &notes {
            eprintln!("keys-door: {n}");
        }
        let last_error = notes
            .iter()
            .find(|n| {
                n.contains(
                    Refusal::Disagreement {
                        fips204: true,
                        bsigner: true,
                    }
                    .name(),
                )
            })
            .or(notes.last())
            .cloned();
        if let Ok(mut s) = self.shared.write() {
            let (seq, record_sha3, state) = match &s.serving {
                Some(v) => (Some(v.seq), Some(b64u(&v.record_sha3)), "serving"),
                None => (None, None, "unverified"),
            };
            s.health = Health {
                seq,
                record_sha3,
                state,
                equivocation: self.equivocation.clone(),
                last_error,
            };
        }
        self.notes = notes;
    }
}

/// `keys-door verify`: the offline verdict on one envelope against the
/// config and the local serve state (read only; nothing is written and no
/// network is used, so the pack bytes are not checked).
pub fn offline_verdict(
    cfg: &Config,
    verifiers: &Verifiers,
    envelope: &[u8],
) -> (serde_json::Value, bool) {
    let refuse = |reason: String| {
        (
            json!({"verdict": "refuse", "reason": reason, "bytes": "not checked (offline)"}),
            false,
        )
    };
    let p = match parse_envelope(envelope, &cfg.origin, &cfg.rp_id) {
        Ok(p) => Arc::new(p),
        Err(r) => return refuse(format!("{}: {r}", r.name())),
    };
    let outcome = verifiers.outcome(&p);
    let decided = outcome.decide(&p.pre.id);
    let store = Store::new(&cfg.state_dir);
    let mut pool = Pool::default();
    let mut notes = Vec::new();
    match store.load() {
        Ok(Some(s)) => {
            for e in &s.chain {
                admit(cfg, e, "state", &mut pool, &mut notes);
            }
        }
        Ok(None) => {}
        Err(e) => notes.push(format!("serve state not usable: {e}")),
    }
    let evidence = store.evidence();
    for e in evidence.iter().flatten() {
        admit(cfg, e, "evidence", &mut pool, &mut notes);
    }
    pool.add(p.clone());
    let mut verify = |q: &Parsed| verifiers.verify(q);
    let w = chain::walk(&pool, &cfg.genesis(), &cfg.genesis_signers, &mut verify);
    let chained = w
        .path
        .iter()
        .any(|l| l.seq() == p.record.seq && l.sha3() == p.record_sha3);
    let floor = store.floor().map(|f| f.max(cfg.min_seq));
    let reason = match (&decided, chained, &floor) {
        (Err(r), _, _) => Some(format!("{}: {r}", r.name())),
        (_, false, _) => Some(match &w.equivocation {
            Some(e) => format!("not chained: equivocation at seq {}", e.seq),
            None => "not chained: no path from the pinned genesis through the records at hand (state + this envelope)".into(),
        }),
        (_, _, Err(e)) => Some(e.clone()),
        (_, _, Ok(f)) if p.record.seq < *f => Some(format!("seq {} is below the floor {f} (rule 4)", p.record.seq)),
        _ => evidence.err(),
    };
    let ok = reason.is_none();
    (
        json!({
            "verdict": if ok { "accept" } else { "refuse" },
            "reason": reason,
            "seq": p.record.seq,
            "record_sha3": b64u(&p.record_sha3),
            "signer": p.pre.id,
            "fips204": outcome.fips204,
            "bsigner": match &outcome.bsigner { Ok(b) => json!(b), Err(e) => json!(format!("failed: {e}")) },
            "chained": chained,
            "floor": floor.ok(),
            "notes": notes.iter().chain(&w.notes).collect::<Vec<_>>(),
            "bytes": "not checked (offline)",
        }),
        ok,
    )
}
