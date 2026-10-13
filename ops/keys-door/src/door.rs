//! One poll of the edge (contract §4 rules 1-7): gather candidate envelopes
//! from every source and the kept fork evidence, parse them (rule 1), walk
//! the chain from the pinned genesis with both verifiers (rules 2, 3, 5),
//! keep what the walk met at a fork (rule 5), pick the highest record at or
//! above the floor (rule 4), find bytes that hash to what it names (rule
//! 6), raise the floor, persist, swap, serve. A corrupt serve state is
//! discarded and the edge answers 503 until a release at or above the floor
//! verifies again (rule 7). A floor or evidence store that cannot be read
//! refuses every new release; the one already served stays served.

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
            notes: Vec::new(),
        }
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
        let evidence = match self.evidence(&mut notes) {
            Ok(e) => e,
            Err(e) => {
                self.refuse(e, notes);
                return;
            }
        };
        let pool = self.gather(network, &evidence, &mut notes);
        let (verifiers, cache) = (&self.verifiers, &mut self.cache);
        let mut verify = |p: &Parsed| cached_verify(verifiers, cache, p);
        let w = chain::walk(&pool, &self.genesis, &self.cfg.genesis_signers, &mut verify);
        notes.extend(w.notes);
        self.tip = w.path.last().map_or(0, Link::seq);
        self.equivocation = w.equivocation;
        if !self.remember(&w.evidence, evidence, &mut notes) {
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
            match self.fetch(t, &pool, current.as_deref(), network) {
                Ok((pack, h)) => {
                    self.swap(&w.path[..=idx], pack, h, &mut notes);
                    break;
                }
                Err(e) => notes.push(format!("seq {} bytes: {e}", t.seq())),
            }
        }
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

    /// Every fork evidence envelope (rule 5): the kept ones, and any whose
    /// write failed, written again now.
    fn evidence(&mut self, notes: &mut Vec<String>) -> Result<Vec<Vec<u8>>, String> {
        let mut all = self.store.evidence()?;
        for e in std::mem::take(&mut self.unkept) {
            if let Err(err) = self.store.keep_evidence(&e) {
                notes.push(err);
                self.unkept.push(e.clone());
            }
            if !all.contains(&e) {
                all.push(e);
            }
        }
        Ok(all)
    }

    /// Keep what the walk met at a fork (rule 5), so the fork is not
    /// forgotten when a source stops offering one branch. False when there
    /// is no room: a fork the edge cannot remember is one it could forget,
    /// so it holds at the release it serves.
    fn remember(
        &mut self,
        found: &[Arc<Parsed>],
        mut all: Vec<Vec<u8>>,
        notes: &mut Vec<String>,
    ) -> bool {
        for p in found {
            if all.contains(&p.bytes) {
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
        if !network {
            return pool;
        }
        for peer in &self.cfg.peers {
            match sources::peer_release(self.http.as_ref(), peer) {
                Ok(b) => {
                    admit(&self.cfg, &b, &format!("peer {peer}"), &mut pool, notes);
                }
                Err(e) => notes.push(format!("peer {peer}: {e}")),
            }
        }
        if self.cfg.arweave_owners.is_empty() {
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

    /// Bytes for `t`, from the first locator whose bytes hash right.
    fn fetch(&self, t: &Link, pool: &Pool, current: Option<&Serving>, network: bool) -> Found {
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
            let mut peers: Vec<&str> = self.cfg.peers.iter().map(String::as_str).collect();
            let mut ants: Vec<&str> = Vec::new();
            let mut ars: Vec<&str> = Vec::new();
            for e in envs {
                let h = &e.env.hints;
                for p in h.peers.iter().take(HINT_LIMIT) {
                    if sources::url_ok(p, false) && !peers.contains(&p.as_str()) {
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
        let serving = Arc::new(Serving::new(t, pack, pack_sha3));
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
