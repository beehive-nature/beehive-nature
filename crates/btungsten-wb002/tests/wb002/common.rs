//! The battery's driver: worlds, a deterministic PRNG, the per-step
//! invariant check, and the hostile-but-legal history.

use btungsten_wb002::chain::{qty, Chain, Profile, Refusal, Row, R};
use btungsten_wb002::invariant::{
    consent_of, ft_consent_of, ft_snapshot, ft_unexplained, sovereign_snapshot, unexplained,
};
use btungsten_wb002::lattice::reconstruct;
use std::collections::{BTreeMap, BTreeSet};

pub const PEOPLE: [&str; 5] = ["alice", "bob", "carol", "dave", "ed"];
pub const AUTHORS: [&str; 2] = ["authorgov", "authorx"];
pub const T0: u64 = 1_700_000_000;

pub fn world(profile: Profile, now: u64) -> Chain {
    let mut c = Chain::new(profile, now);
    for n in AUTHORS
        .iter()
        .chain(PEOPLE.iter())
        .chain(["mallory"].iter())
    {
        c.acct(n);
    }
    c
}

/// Run `f` expecting a refusal; with `fp`, demand the fingerprint survived.
pub fn refused_with<T>(c: &mut Chain, f: impl FnOnce(&mut Chain) -> R<T>) -> &'static str {
    let fp = c.fingerprint();
    match f(c) {
        Ok(_) => panic!("expected a refusal"),
        Err(Refusal { code, .. }) => {
            assert_eq!(
                c.fingerprint(),
                fp,
                "the refused action ({code}) left state or committed events behind"
            );
            code
        }
    }
}

/// mulberry32: histories replay identically.
pub struct Rng(u32);
impl Rng {
    pub fn new(seed: u32) -> Rng {
        Rng(seed)
    }
    pub fn f(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B_79F5);
        let s = self.0;
        let mut t = (s ^ (s >> 15)).wrapping_mul(1 | s);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        (t ^ (t >> 14)) as f64 / 4_294_967_296.0
    }
    pub fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        let i = (self.f() * xs.len() as f64) as usize;
        &xs[i]
    }
    pub fn other<'a>(&mut self, xs: &'a [&'a str], not: &str) -> &'a str {
        let f: Vec<&str> = xs.iter().copied().filter(|x| *x != not).collect();
        let i = (self.f() * f.len() as f64) as usize;
        f[i]
    }
}

#[derive(Default, Debug)]
pub struct Collector {
    pub steps: usize,
    pub named: Vec<(String, String)>, // (tag, kind)
    pub probes: usize,
    pub rollbacks: usize,
}

/// One action under the killer invariant; consent captured BEFORE.
pub fn drive(
    c: &mut Chain,
    tag: &str,
    signers: &[&str],
    col: &mut Collector,
    f: impl FnOnce(&mut Chain) -> R<()>,
) -> R<()> {
    let before = sovereign_snapshot(c);
    let ft_before = ft_snapshot(c);
    let consent = consent_of(c);
    let ft_consent = ft_consent_of(c);
    f(c)?;
    let after = sovereign_snapshot(c);
    let ft_after = ft_snapshot(c);
    col.steps += 1;
    for _ in unexplained(&before, &after, signers, &consent) {
        col.named.push((tag.into(), "sovereign".into()));
    }
    for _ in ft_unexplained(&ft_before, &ft_after, signers, &ft_consent) {
        col.named.push((tag.into(), "ft".into()));
    }
    Ok(())
}

pub struct FreeAsset {
    pub id: u64,
    pub holder: String,
    pub author: String,
    pub row: Row,
}
pub struct FtHolder {
    pub author: String,
    pub sym: String,
    pub holder: String,
    pub amount: u128,
    pub issuer: String,
    pub authorctrl: bool,
}

pub fn free_assets(c: &Chain) -> Vec<FreeAsset> {
    let mut v = Vec::new();
    for (holder, m) in c.scopes() {
        for row in m.values() {
            v.push(FreeAsset {
                id: row.id,
                holder: holder.clone(),
                author: row.author.clone(),
                row: row.clone(),
            });
        }
    }
    v
}

pub fn ft_holders(c: &Chain) -> Vec<FtHolder> {
    let mut v = Vec::new();
    for st in c.stats().values() {
        for (owner, m) in c.balances() {
            if let Some(b) = m.get(&st.id) {
                if b.amount > 0 {
                    v.push(FtHolder {
                        author: st.issuer.clone(),
                        sym: st.symbol.clone(),
                        holder: owner.clone(),
                        amount: b.amount,
                        issuer: st.issuer.clone(),
                        authorctrl: st.authorctrl,
                    });
                }
            }
        }
    }
    v
}

/// A hostile but legal-biased history; the invariant is checked after
/// EVERY step and every refusal must roll back whole. Returns spawn idata.
pub fn run_history(
    c: &mut Chain,
    steps: usize,
    seed: u32,
    col: &mut Collector,
) -> BTreeMap<u64, String> {
    let mut rng = Rng::new(seed);
    let adapter = c.profile == Profile::Adapter;
    if !adapter {
        c.createf("authorgov", 10_000_000, "WOOD", true, "{}", &["authorgov"])
            .unwrap();
        c.issuef("bob", "authorgov", &qty("WOOD", 10_000), "", &["authorgov"])
            .unwrap();
    }
    c.createf("authorx", 10_000_000, "SEED", false, "{}", &["authorx"])
        .unwrap();
    c.issuef("carol", "authorx", &qty("SEED", 10_000), "", &["authorx"])
        .unwrap();
    for i in 0..4 {
        let author = *rng.pick(&AUTHORS);
        let owner = *rng.pick(&PEOPLE);
        let rc = rng.f() < 0.5;
        c.create(
            author,
            "cred",
            owner,
            &format!("cmt:{seed}:{i}"),
            &format!("md:{i}"),
            rc,
            &[author],
        )
        .unwrap();
    }
    c.createntt(
        "authorgov",
        "cap",
        "alice",
        "ntt-cmt-1",
        "{}",
        false,
        &["authorgov"],
    )
    .unwrap();
    let mut spawn_idata = BTreeMap::new();
    let track = |c: &Chain, m: &mut BTreeMap<u64, String>| {
        for e in &c.log {
            if e.ty() == "spawn" {
                let id = e.id("assetid").unwrap();
                m.entry(id)
                    .or_insert_with(|| e.str("idata").unwrap_or("").to_string());
            }
        }
    };
    track(c, &mut spawn_idata);

    for i in 0..steps {
        c.now += 1 + (rng.f() * 500.0) as u64;
        let free = free_assets(c);
        let fts = ft_holders(c);
        let roll = rng.f();
        let (log_len, log_root) = (c.log.len(), c.log_root());
        let (sov, ft) = (sovereign_snapshot(c), ft_snapshot(c));
        let res: R<()> = (|| {
            if roll < 0.06 {
                let author = *rng.pick(&AUTHORS);
                let owner = *rng.pick(&PEOPLE);
                let rc = rng.f() < 0.3;
                let cmt = format!("cmt:{seed}:{i}");
                drive(c, "create", &[author], col, |c| {
                    c.create(author, "cred", owner, &cmt, "{}", rc, &[author])
                        .map(|_| ())
                })
            } else if roll < 0.10 {
                let author = *rng.pick(&AUTHORS);
                let owner = *rng.pick(&PEOPLE);
                let rc = rng.f() < 0.3;
                let cmt = format!("ntt:{seed}:{i}");
                drive(c, "createntt", &[author], col, |c| {
                    c.createntt(author, "cap", owner, &cmt, "{}", rc, &[author])
                        .map(|_| ())
                })
            } else if roll < 0.26 && free.len() > 1 {
                let a = rng.pick(&free);
                let to = rng.other(&PEOPLE, &a.holder);
                let h = a.holder.as_str();
                drive(c, "transfer", &[h], col, |c| {
                    c.transfer(h, to, &[a.id], "", &[h])
                })
            } else if roll < 0.34 && !free.is_empty() {
                let a = rng.pick(&free);
                let to = rng.other(&PEOPLE, &a.holder);
                let h = a.holder.as_str();
                drive(c, "offer", &[h], col, |c| c.offer(h, to, &[a.id], "", &[h]))
            } else if roll < 0.42 {
                let offers: Vec<(u64, String, String)> = c
                    .offers()
                    .iter()
                    .map(|(id, o)| (*id, o.owner.clone(), o.offeredto.clone()))
                    .collect();
                if offers.is_empty() {
                    return Ok(());
                }
                let (id, owner, to) = rng.pick(&offers).clone();
                if rng.f() < 0.6 {
                    drive(c, "claim(consent)", &[to.as_str()], col, |c| {
                        c.claim(&to, &[id], &[to.as_str()])
                    })
                } else {
                    drive(c, "canceloffer", &[owner.as_str()], col, |c| {
                        c.canceloffer(&owner, &[id], &[owner.as_str()])
                    })
                }
            } else if roll < 0.52 && free.len() > 1 {
                let a = rng.pick(&free);
                let borrower = rng.other(&PEOPLE, &a.holder);
                let period = 1 + (rng.f() * 8000.0) as u64;
                let re = rng.f() < 0.5;
                let h = a.holder.as_str();
                drive(c, "delegate", &[h], col, |c| {
                    c.delegate(h, borrower, &[a.id], period, re, "", &[h])
                })
            } else if roll < 0.58 && !c.delegates().is_empty() {
                let ds: Vec<(u64, String, String)> = c
                    .delegates()
                    .iter()
                    .map(|(id, d)| (*id, d.owner.clone(), d.delegatedto.clone()))
                    .collect();
                let (id, owner, to) = rng.pick(&ds).clone();
                if rng.f() < 0.5 {
                    drive(c, "undelegate", &[owner.as_str()], col, |c| {
                        c.undelegate(&owner, &[id], &[owner.as_str()])
                    })
                } else {
                    drive(c, "borrower-return", &[to.as_str()], col, |c| {
                        c.transfer(&to, &owner, &[id], "", &[to.as_str()])
                    })
                }
            } else if roll < 0.64 && free.len() > 2 {
                let a = rng.pick(&free);
                let same: Vec<&FreeAsset> = free
                    .iter()
                    .filter(|x| x.author == a.author && x.id != a.id && x.holder == a.holder)
                    .collect();
                if same.is_empty() {
                    return Ok(());
                }
                let child = *rng.pick(&same);
                let signer = if adapter {
                    a.holder.as_str()
                } else {
                    a.author.as_str()
                };
                let tag = if adapter {
                    "attach(sovereign)"
                } else {
                    "attach(author)"
                };
                drive(c, tag, &[signer], col, |c| {
                    c.attach(&a.holder, a.id, &[child.id], &[signer])
                })
            } else if roll < 0.68 && !free.is_empty() {
                let a = rng.pick(&free);
                if a.row.container.is_empty() {
                    return Ok(());
                }
                let signer = if adapter {
                    a.holder.as_str()
                } else {
                    a.author.as_str()
                };
                let tag = if adapter {
                    "detach(sovereign)"
                } else {
                    "detach(author)"
                };
                drive(c, tag, &[signer], col, |c| {
                    c.detach(&a.holder, a.id, &[a.row.container[0].id], &[signer])
                })
            } else if roll < 0.74 && !free.is_empty() {
                let a = rng.pick(&free);
                let na = rng.other(&AUTHORS, &a.author);
                let signers: Vec<&str> = if adapter {
                    vec![a.author.as_str(), a.holder.as_str()]
                } else {
                    vec![a.author.as_str()]
                };
                let tag = if adapter {
                    "changeauthor(co-signed)"
                } else {
                    "changeauthor(author)"
                };
                drive(c, tag, &signers, col, |c| {
                    c.changeauthor(&a.author, na, &a.holder, &[a.id], "", &signers)
                })
            } else if roll < 0.78 && !free.is_empty() {
                let a = rng.pick(&free);
                let md = format!("md:{seed}:{i}");
                drive(c, "update", &[a.author.as_str()], col, |c| {
                    c.update(&a.author, &a.holder, a.id, &md, &[a.author.as_str()])
                })
            } else if roll < 0.82 && !free.is_empty() {
                let cand: Vec<&FreeAsset> = free
                    .iter()
                    .filter(|x| {
                        x.row.container.is_empty()
                            && x.row.containerf.is_empty()
                            && !c.offers().contains_key(&x.id)
                            && !c.delegates().contains_key(&x.id)
                    })
                    .collect();
                if cand.is_empty() {
                    return Ok(());
                }
                let a = *rng.pick(&cand);
                drive(c, "burn", &[a.holder.as_str()], col, |c| {
                    c.burn(&a.holder, &[a.id], &[a.holder.as_str()])
                })
            } else if roll < 0.88 && !fts.is_empty() {
                let f = rng.pick(&fts);
                let sub = rng.f();
                if sub < 0.4 {
                    let to = rng.other(&PEOPLE, &f.holder);
                    drive(c, "transferf", &[f.holder.as_str()], col, |c| {
                        c.transferf(
                            &f.holder,
                            to,
                            &f.author,
                            &qty(&f.sym, 10),
                            "",
                            &[f.holder.as_str()],
                        )
                    })
                } else if sub < 0.6 && f.amount > 20 {
                    let to = rng.other(&PEOPLE, &f.holder);
                    drive(c, "offerf", &[f.holder.as_str()], col, |c| {
                        c.offerf(
                            &f.holder,
                            to,
                            &f.author,
                            &qty(&f.sym, 10),
                            "",
                            &[f.holder.as_str()],
                        )
                    })
                } else if !c.ft_offers().is_empty() {
                    let os: Vec<(u64, String, String)> = c
                        .ft_offers()
                        .iter()
                        .map(|(id, o)| (*id, o.owner.clone(), o.offeredto.clone()))
                        .collect();
                    let (oid, owner, to) = rng.pick(&os).clone();
                    if rng.f() < 0.5 {
                        drive(c, "claimf(consent)", &[to.as_str()], col, |c| {
                            c.claimf(&to, &[oid], &[to.as_str()])
                        })
                    } else {
                        drive(c, "cancelofferf", &[owner.as_str()], col, |c| {
                            c.cancelofferf(&owner, &[oid], &[owner.as_str()])
                        })
                    }
                } else {
                    Ok(())
                }
            } else if roll < 0.93 && !fts.is_empty() && !free.is_empty() {
                let holders: Vec<&FtHolder> = fts.iter().filter(|x| x.amount > 30).collect();
                if holders.is_empty() {
                    return Ok(());
                }
                let ft = *rng.pick(&holders);
                let assets: Vec<&FreeAsset> = free
                    .iter()
                    .filter(|x| x.author == ft.author && x.holder == ft.holder)
                    .collect();
                if assets.is_empty() {
                    return Ok(());
                }
                let signers: Vec<&str> = if adapter {
                    vec![ft.author.as_str(), ft.holder.as_str()]
                } else {
                    vec![ft.author.as_str()]
                };
                let tag = if adapter {
                    "attachf(co-signed)"
                } else {
                    "attachf(author)"
                };
                let target = rng.pick(&assets).id;
                drive(c, tag, &signers, col, |c| {
                    c.attachf(&ft.holder, &ft.author, &qty(&ft.sym, 10), target, &signers)
                })
            } else if roll < 0.96
                && !adapter
                && fts.iter().any(|x| x.authorctrl && x.holder != x.issuer)
            {
                // the F-1 seam, exercised deliberately on the specimen
                let ctrl: Vec<&FtHolder> = fts
                    .iter()
                    .filter(|x| x.authorctrl && x.holder != x.issuer)
                    .collect();
                let f = *rng.pick(&ctrl);
                if rng.f() < 0.5 {
                    let to0 = rng.other(&PEOPLE, &f.holder);
                    let to = if to0 == f.issuer { "mallory" } else { to0 };
                    drive(c, "F1:issuer-move", &[f.issuer.as_str()], col, |c| {
                        c.transferf(
                            &f.holder,
                            to,
                            &f.author,
                            &qty(&f.sym, 10),
                            "",
                            &[f.issuer.as_str()],
                        )
                    })
                } else {
                    drive(c, "F1:issuer-burn", &[f.issuer.as_str()], col, |c| {
                        c.burnf(
                            &f.holder,
                            &f.author,
                            &qty(&f.sym, 10),
                            "",
                            &[f.issuer.as_str()],
                        )
                    })
                }
            } else {
                // wrong-signer probe: a third party moves someone's asset
                if !free.is_empty() {
                    let a = rng.pick(&free);
                    let code = refused_with(c, |c| {
                        c.transfer(&a.holder, "mallory", &[a.id], "", &["mallory"])
                    });
                    assert!(
                        code == "bt-wb002:auth" || code == "bt-wb002:delegated",
                        "wrong-signer transfer returned {code}"
                    );
                    col.probes += 1;
                }
                Ok(())
            }
        })();
        if let Err(e) = res {
            assert_eq!(c.log.len(), log_len, "refused {} committed events", e.code);
            assert_eq!(
                c.log_root(),
                log_root,
                "refused {} changed the log root",
                e.code
            );
            assert_eq!(
                sovereign_snapshot(c),
                sov,
                "refused {} moved sovereignty",
                e.code
            );
            assert_eq!(ft_snapshot(c), ft, "refused {} moved balances", e.code);
            col.rollbacks += 1;
        }
        track(c, &mut spawn_idata);
    }
    spawn_idata
}

/// Every id that exists: free, contained, delegated, ntt.
pub fn all_ids(c: &Chain) -> BTreeSet<u64> {
    fn walk(r: &Row, ids: &mut BTreeSet<u64>) {
        ids.insert(r.id);
        for k in &r.container {
            walk(k, ids);
        }
    }
    let mut ids = BTreeSet::new();
    for m in c.scopes().values() {
        for r in m.values() {
            walk(r, &mut ids);
        }
    }
    for m in c.ntt_scopes().values() {
        ids.extend(m.keys().copied());
    }
    ids
}

/// The archivist's truth equals the chain's truth for every existing id.
pub fn assert_fold_equals_chain(c: &mut Chain, msg: &str) -> usize {
    let fold = reconstruct(&c.log);
    let ids = all_ids(c);
    for &id in &ids {
        assert_eq!(
            fold.sovereign(id),
            c.sovereign_of(id),
            "{msg}: id {id} diverged between log fold and chain"
        );
    }
    ids.len()
}
