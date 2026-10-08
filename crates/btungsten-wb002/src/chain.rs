//! The SimpleAssets-2021 state machine (frozen upstream e6a042f, vendored at
//! scripts/btungsten/wb002-specimen/), as the WB002 model. SA.cpp line refs
//! cite that tree. Profiles: `Specimen` (upstream semantics, quirks
//! included, the thing under attack) and `Adapter` (the extracted BNR
//! semantics).
//!
//! Sovereignty is not computed here: every asset's abstract status is read
//! off the tables and handed to `btungsten_wb002_core::sovereign`, the
//! function SAW proves equal to the Cryptol spec. On the Adapter profile,
//! every NFT/NTT action that moves sovereignty is also replayed through the
//! proven `btungsten_wb002_core::step`, and the model refuses to run on if
//! the tables and the proven machine disagree.

use crate::fields;
use crate::log::{canon, genesis, sha, Event, Val};
use btungsten_wb002_core::{sovereign as core_sovereign, step as core_step, Action, Status};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Refusal {
    pub code: &'static str,
    pub msg: String,
}

pub type R<T> = Result<T, Refusal>;

fn refuse<T>(code: &'static str, msg: impl Into<String>) -> R<T> {
    Err(Refusal {
        code,
        msg: msg.into(),
    })
}
fn check(cond: bool, code: &'static str, msg: impl Into<String>) -> R<()> {
    if cond {
        Ok(())
    } else {
        refuse(code, msg)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Profile {
    Specimen,
    Adapter,
}

const MAX_MEMO: usize = 512;
const ADAPTER_OFFER_TTL: u64 = 3600;
const CHECKPOINT_EVERY: usize = 64;

/// An Antelope account name: 1..=13 of [a-z1-5.].
pub fn name(n: &str) -> R<String> {
    let ok = !n.is_empty()
        && n.len() <= 13
        && n.bytes()
            .all(|b| b.is_ascii_lowercase() || (b'1'..=b'5').contains(&b) || b == b'.');
    if ok {
        Ok(n.to_string())
    } else {
        refuse("bt-wb002:name", format!("not an account name: {n}"))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FtSlot {
    pub id: u64,
    pub amount: u128,
    pub sym: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Row {
    pub id: u64,
    pub owner: String,
    pub author: String,
    pub category: String,
    pub idata: String,
    pub mdata: String,
    pub container: Vec<Row>,
    pub containerf: Vec<FtSlot>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NttRow {
    pub id: u64,
    pub owner: String,
    pub author: String,
    pub category: String,
    pub idata: String,
    pub mdata: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Offer {
    pub owner: String,
    pub offeredto: String,
    pub cdate: u64,
    /// set only on the Adapter profile
    pub expires_at: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Deleg {
    pub owner: String,
    pub delegatedto: String,
    pub cdate: u64,
    pub period: u64,
    pub redelegate: bool,
    pub memo: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stat {
    pub supply: u128,
    pub max: u128,
    pub issuer: String,
    pub id: u64,
    pub authorctrl: bool,
    pub data: String,
    pub symbol: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Bal {
    pub sym: String,
    pub amount: u128,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FtOffer {
    pub author: String,
    pub owner: String,
    pub offeredto: String,
    pub amount: u128,
    pub sym: String,
    pub ftid: u64,
    pub cdate: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RamPayer {
    pub id: u64,
    pub author: String,
    pub category: String,
    pub usearam: bool,
    pub from_id: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Quantity {
    pub symbol: String,
    pub amount: u128,
}

pub fn qty(symbol: &str, amount: u128) -> Quantity {
    Quantity {
        symbol: symbol.to_string(),
        amount,
    }
}

/// Everything a refused transaction must restore.
#[derive(Clone, PartialEq, Eq)]
struct Tables {
    scopes: BTreeMap<String, BTreeMap<u64, Row>>,
    ntt_scopes: BTreeMap<String, BTreeMap<u64, NttRow>>,
    offers: BTreeMap<u64, Offer>,
    ntt_offers: BTreeMap<u64, Offer>,
    delegates: BTreeMap<u64, Deleg>,
    stats: BTreeMap<String, Stat>,
    balances: BTreeMap<String, BTreeMap<u64, Bal>>,
    ft_offers: BTreeMap<u64, FtOffer>,
    arampayers: Vec<RamPayer>,
    ram_payer_of: BTreeMap<u64, String>,
    lnftid: u64,
    defid: u64,
}

pub struct Chain {
    pub profile: Profile,
    pub now: u64,
    pub accounts: BTreeSet<String>,
    t: Tables,
    pub log: Vec<Event>,
    pub genesis: String,
    tx_depth: u32,
    actors: Vec<String>,
}

/// One migrated asset: where it lands and the row it carries.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BundleAsset {
    pub kind: &'static str,
    pub holder: String,
    pub sovereign: Option<String>,
    pub row: SerRow,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SerRow {
    pub id: u64,
    pub author: String,
    pub category: String,
    pub idata: String,
    pub mdata: String,
    pub contains: Vec<SerRow>,
    pub contains_f: Vec<FtSlot>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BundleFt {
    pub owner: String,
    pub ftid: u64,
    pub amount: u128,
    pub sym: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Bundle {
    pub assets: Vec<BundleAsset>,
    pub fts: Vec<BundleFt>,
    pub delegates: Vec<(u64, Deleg)>,
    pub log_root: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckpointAnchor {
    pub seq: u64,
    pub root: String,
    pub parent_root: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TipAnchor {
    pub seq: u64,
    pub root: String,
}

fn ser_row_val(r: &SerRow) -> Val {
    Val::Obj(fields![
        ("id", r.id),
        ("author", &r.author),
        ("category", &r.category),
        ("idata", &r.idata),
        ("mdata", &r.mdata),
        (
            "contains",
            Val::Arr(r.contains.iter().map(ser_row_val).collect())
        ),
        (
            "containsF",
            Val::Arr(
                r.contains_f
                    .iter()
                    .map(|f| Val::Obj(fields![("id", f.id), ("amount", f.amount), ("sym", &f.sym)]))
                    .collect()
            )
        ),
    ])
}

/// The abstract head of a sovereignty-moving action (the spec's `A_*`).
#[derive(Clone, Copy)]
enum Head {
    Transfer = 0,
    Offer = 1,
    Claim = 2,
    Cancel = 3,
    Delegate = 4,
    Undelegate = 6,
    Redelegate = 7,
    Attach = 8,
    Detach = 9,
    Burn = 10,
}

impl Chain {
    pub fn new(profile: Profile, now: u64) -> Chain {
        Chain {
            profile,
            now,
            accounts: BTreeSet::new(),
            t: Tables {
                scopes: BTreeMap::new(),
                ntt_scopes: BTreeMap::new(),
                offers: BTreeMap::new(),
                ntt_offers: BTreeMap::new(),
                delegates: BTreeMap::new(),
                stats: BTreeMap::new(),
                balances: BTreeMap::new(),
                ft_offers: BTreeMap::new(),
                arampayers: Vec::new(),
                ram_payer_of: BTreeMap::new(),
                lnftid: 100_000_000_000_000,
                defid: 1_000_000,
            },
            log: Vec::new(),
            genesis: genesis(),
            tx_depth: 0,
            actors: Vec::new(),
        }
    }

    pub fn acct(&mut self, n: &str) -> &mut Self {
        let n = name(n).expect("battery account names are valid");
        self.accounts.insert(n);
        self
    }

    // ---- read access for batteries and harnesses --------------------------
    pub fn scopes(&self) -> &BTreeMap<String, BTreeMap<u64, Row>> {
        &self.t.scopes
    }
    pub fn ntt_scopes(&self) -> &BTreeMap<String, BTreeMap<u64, NttRow>> {
        &self.t.ntt_scopes
    }
    pub fn offers(&self) -> &BTreeMap<u64, Offer> {
        &self.t.offers
    }
    pub fn ntt_offers(&self) -> &BTreeMap<u64, Offer> {
        &self.t.ntt_offers
    }
    pub fn delegates(&self) -> &BTreeMap<u64, Deleg> {
        &self.t.delegates
    }
    pub fn stats(&self) -> &BTreeMap<String, Stat> {
        &self.t.stats
    }
    pub fn balances(&self) -> &BTreeMap<String, BTreeMap<u64, Bal>> {
        &self.t.balances
    }
    pub fn ft_offers(&self) -> &BTreeMap<u64, FtOffer> {
        &self.t.ft_offers
    }
    pub fn ram_payer_of(&self, id: u64) -> Option<&str> {
        self.t.ram_payer_of.get(&id).map(String::as_str)
    }
    pub fn lnftid(&self) -> u64 {
        self.t.lnftid
    }
    pub fn row(&self, holder: &str, id: u64) -> Option<&Row> {
        self.t.scopes.get(holder).and_then(|m| m.get(&id))
    }
    pub fn bal(&self, owner: &str, ftid: u64) -> u128 {
        self.t
            .balances
            .get(owner)
            .and_then(|m| m.get(&ftid))
            .map_or(0, |b| b.amount)
    }
    /// The WASM corpus's one NAMED RECONCILIATION: upstream allocates FT
    /// offer ids from the deferred-event counter (sendEvent, SA.cpp:1187),
    /// which this model does not port; the harness renames the model's
    /// offer key to the chain's so later rows address one offer.
    pub fn rekey_ft_offer(&mut self, from: u64, to: u64) {
        if let Some(o) = self.t.ft_offers.remove(&from) {
            self.t.ft_offers.insert(to, o);
        }
    }
    /// Test/teeth access: write a row directly, bypassing every action
    /// (the naive importer the migration torture convicts).
    pub fn plant_row(&mut self, holder: &str, row: Row) {
        self.t
            .scopes
            .entry(holder.to_string())
            .or_default()
            .insert(row.id, row);
    }

    // ---- the transaction boundary (model-hardening R-1) -------------------
    /// Run `f` as one transaction: on any refusal, the whole pre-state
    /// (tables, counters, committed log) is restored. Nested calls join the
    /// open transaction, the inline-action semantics of Antelope.
    pub fn tx<T>(&mut self, f: impl FnOnce(&mut Chain) -> R<T>) -> R<T> {
        if self.tx_depth > 0 {
            return f(self);
        }
        let snap = self.t.clone();
        let log_len = self.log.len();
        self.tx_depth = 1;
        let out = f(self);
        self.tx_depth = 0;
        if out.is_err() {
            self.t = snap;
            self.log.truncate(log_len);
        }
        out
    }

    /// A fingerprint over everything an action can touch, plus the log.
    pub fn fingerprint(&self) -> String {
        let t = &self.t;
        let s = format!(
            "{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{}|{}|{}|{}",
            t.scopes,
            t.ntt_scopes,
            t.offers,
            t.ntt_offers,
            t.delegates,
            t.stats,
            t.balances,
            t.ft_offers,
            t.arampayers,
            t.ram_payer_of,
            t.lnftid,
            t.defid,
            self.log.len(),
            self.log_root()
        );
        sha(&s)
    }

    // ---- the anchored event log --------------------------------------------
    fn raw_emit(&mut self, fields: BTreeMap<String, Val>) {
        let prev = self.log_root();
        let mut ev = Event {
            seq: self.log.len() as u64,
            fields,
            root: String::new(),
        };
        ev.root = ev.root_over(&prev);
        self.log.push(ev);
    }
    fn maybe_checkpoint(&mut self) {
        if !self.log.is_empty() && self.log.len().is_multiple_of(CHECKPOINT_EVERY) {
            let mut assets = Vec::new();
            fn walk(row: &Row, assets: &mut Vec<Val>) {
                for c in &row.container {
                    assets.push(Val::Arr(vec![
                        Val::from(c.id),
                        Val::Obj(fields![("containerOf", row.id)]),
                        Val::from("nft"),
                    ]));
                    walk(c, assets);
                }
            }
            let rows: Vec<Row> = self
                .t
                .scopes
                .values()
                .flat_map(|m| m.values().cloned())
                .collect();
            for row in &rows {
                assets.push(Val::Arr(vec![
                    Val::from(row.id),
                    Val::from(self.sovereign_of(row.id)),
                    Val::from("nft"),
                ]));
                walk(row, &mut assets);
            }
            for m in self.t.ntt_scopes.values() {
                for row in m.values() {
                    assets.push(Val::Arr(vec![
                        Val::from(row.id),
                        Val::from(&row.owner),
                        Val::from("ntt"),
                    ]));
                }
            }
            let deleg = self
                .t
                .delegates
                .iter()
                .map(|(id, d)| Val::Arr(vec![Val::from(*id), Val::from(&d.owner)]))
                .collect();
            self.raw_emit(fields![
                ("type", "checkpoint"),
                ("assets", Val::Arr(assets)),
                ("deleg", Val::Arr(deleg))
            ]);
        }
    }
    fn emit(&mut self, fields: BTreeMap<String, Val>) {
        self.raw_emit(fields);
        self.maybe_checkpoint();
    }
    pub fn log_root(&self) -> String {
        self.log
            .last()
            .map_or_else(|| self.genesis.clone(), |e| e.root.clone())
    }
    pub fn checkpoint_anchor(&self) -> Option<CheckpointAnchor> {
        let cp = self.log.iter().rev().find(|e| e.ty() == "checkpoint")?;
        let parent_root = if cp.seq > 0 {
            self.log[cp.seq as usize - 1].root.clone()
        } else {
            self.genesis.clone()
        };
        Some(CheckpointAnchor {
            seq: cp.seq,
            root: cp.root.clone(),
            parent_root,
        })
    }
    pub fn tip_anchor(&self) -> Option<TipAnchor> {
        self.log.last().map(|e| TipAnchor {
            seq: e.seq,
            root: e.root.clone(),
        })
    }

    // ---- sovereignty: the proven function over the tables' status ---------
    fn actor(&mut self, n: &str) -> u8 {
        actor_id(&mut self.actors, n)
    }
    fn actor_name(&self, a: u8) -> Option<String> {
        if a == 0 {
            None
        } else {
            self.actors.get(a as usize - 1).cloned()
        }
    }

    fn contained_parent(&self, id: u64) -> Option<u64> {
        fn find(row: &Row, id: u64) -> bool {
            row.container.iter().any(|c| c.id == id || find(c, id))
        }
        for m in self.t.scopes.values() {
            for row in m.values() {
                if find(row, id) {
                    return Some(row.id);
                }
            }
        }
        None
    }

    /// The abstract status of one asset, read off the tables — the input
    /// the proven `sovereign` and `step` take. Gone when it exists nowhere.
    pub fn status_of(&mut self, id: u64) -> Status {
        if let Some(d) = self.t.delegates.get(&id).cloned() {
            let (l, b) = (self.actor(&d.owner), self.actor(&d.delegatedto));
            return Status {
                tag: 1,
                holder: b,
                lender: l,
                offeree: l,
            };
        }
        let mut owner_offer: Option<(String, Option<String>)> = None;
        for m in self.t.scopes.values() {
            if let Some(row) = m.get(&id) {
                owner_offer = Some((
                    row.owner.clone(),
                    self.t.offers.get(&id).map(|o| o.offeredto.clone()),
                ));
                break;
            }
        }
        if owner_offer.is_none() {
            for m in self.t.ntt_scopes.values() {
                if let Some(row) = m.get(&id) {
                    owner_offer = Some((
                        row.owner.clone(),
                        self.t.ntt_offers.get(&id).map(|o| o.offeredto.clone()),
                    ));
                    break;
                }
            }
        }
        if let Some((owner, offeree)) = owner_offer {
            let h = self.actor(&owner);
            return match offeree {
                Some(to) => {
                    let o = self.actor(&to);
                    Status {
                        tag: 2,
                        holder: h,
                        lender: h,
                        offeree: o,
                    }
                }
                None => Status {
                    tag: 0,
                    holder: h,
                    lender: h,
                    offeree: h,
                },
            };
        }
        if let Some(parent) = self.contained_parent(id) {
            let ps = self.status_of(parent);
            let h = core_sovereign(ps);
            return Status {
                tag: 3,
                holder: h,
                lender: h,
                offeree: h,
            };
        }
        Status {
            tag: 4,
            holder: 0,
            lender: 0,
            offeree: 0,
        }
    }

    /// Who holds sovereign authority over `id`: the proven `sovereign` of
    /// its table status. `None` once burned or never created.
    pub fn sovereign_of(&mut self, id: u64) -> Option<String> {
        let s = self.status_of(id);
        let a = core_sovereign(s);
        self.actor_name(a)
    }

    /// Adapter profile: replay one accepted sovereignty-moving action
    /// through the proven `step` and demand the tables agree.
    fn proven_step(&mut self, id: u64, before: Status, head: Head, signer: &str, to: &str) {
        if self.profile != Profile::Adapter {
            return;
        }
        let act = Action {
            head: head as u8,
            signer: self.actor(signer),
            to: self.actor(to),
        };
        let want = core_sovereign(core_step(before, act));
        let after = self.status_of(id);
        let got = core_sovereign(after);
        assert_eq!(
            got, want,
            "model/proven-step divergence on asset {id}: tables say {:?}, the proven step says {:?} (head {}, signer {signer}, to {to})",
            self.actor_name(got),
            self.actor_name(want),
            head as u8
        );
    }

    // ---- helpers ------------------------------------------------------------
    fn scope_mut(&mut self, holder: &str) -> &mut BTreeMap<u64, Row> {
        self.t.scopes.entry(holder.to_string()).or_default()
    }
    fn find_asset(&self, holder: &str, id: u64) -> R<Row> {
        match self.row(holder, id) {
            Some(r) => Ok(r.clone()),
            None => refuse(
                "bt-wb002:not-found",
                format!("asset {id} not found in scope {holder}"),
            ),
        }
    }
    fn has_auth(signers: &[&str], a: &str) -> bool {
        signers.contains(&a)
    }
    fn require_auth(signers: &[&str], a: &str) -> R<()> {
        check(
            signers.contains(&a),
            "bt-wb002:auth",
            format!("missing authority of {a}"),
        )
    }
    fn getid(&mut self) -> u64 {
        self.t.lnftid += 1;
        self.t.lnftid
    }
    fn offer_record(&self, owner: &str, offeredto: &str) -> Offer {
        Offer {
            owner: owner.into(),
            offeredto: offeredto.into(),
            cdate: self.now,
            expires_at: (self.profile == Profile::Adapter).then_some(self.now + ADAPTER_OFFER_TTL),
        }
    }
    fn get_payer(&self, author: &str, category: &str, id: u64) -> Option<String> {
        self.t
            .arampayers
            .iter()
            .find(|r| r.author == author && r.category == category && r.usearam && id > r.from_id)
            .map(|_| author.to_string())
    }
    fn emplace_asset(&mut self, holder: &str, row: Row, payer: &str) {
        let id = row.id;
        self.scope_mut(holder).insert(id, row);
        self.t.ram_payer_of.insert(id, payer.to_string());
    }

    // ---- NFT actions ----------------------------------------------------------
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &mut self,
        author: &str,
        category: &str,
        owner: &str,
        idata: &str,
        mdata: &str,
        requireclaim: bool,
        signers: &[&str],
    ) -> R<u64> {
        self.tx(|c| c.create_in(author, category, owner, idata, mdata, requireclaim, signers))
    }
    #[allow(clippy::too_many_arguments)]
    fn create_in(
        &mut self,
        author: &str,
        category: &str,
        owner: &str,
        idata: &str,
        mdata: &str,
        requireclaim: bool,
        signers: &[&str],
    ) -> R<u64> {
        let (author, category, owner) = (name(author)?, name(category)?, name(owner)?);
        Self::require_auth(signers, &author)?; // SA.cpp:100
        check(
            self.accounts.contains(&owner),
            "bt-wb002:account",
            "owner account does not exist",
        )?;
        let new_id = self.getid();
        check(
            !(author == owner && requireclaim),
            "bt-wb02:claim-self",
            "can't requireclaim if author == owner",
        )?; // SA.cpp:105
        let mut asset_owner = owner.clone();
        if requireclaim {
            asset_owner = author.clone();
            let rec = self.offer_record(&author, &owner);
            self.t.offers.insert(new_id, rec);
        }
        let row = Row {
            id: new_id,
            owner: asset_owner.clone(),
            author: author.clone(),
            category: category.clone(),
            idata: idata.into(),
            mdata: mdata.into(),
            container: vec![],
            containerf: vec![],
        };
        self.emplace_asset(&asset_owner, row, &author);
        self.emit(fields![
            ("type", "spawn"),
            ("kind", "nft"),
            ("assetid", new_id),
            ("author", &author),
            ("category", &category),
            ("owner", &asset_owner),
            ("idata", idata)
        ]);
        self.emit(fields![
            ("type", "mdata"),
            ("assetid", new_id),
            ("mdata", mdata)
        ]);
        if requireclaim {
            self.emit(fields![
                ("type", "offeropen"),
                ("assetid", new_id),
                ("owner", &author),
                ("offeredto", &owner)
            ]);
        }
        Ok(new_id)
    }

    /// SA.cpp:218. authorized_account = has_auth(to) ? to : from (receiver
    /// pays RAM); a delegated asset may move ONLY to its lender (closing the
    /// delegation) or its current borrower; the return path accepts the
    /// lender's or the holder's signature (finding F-2 on the specimen: the
    /// lender may pull early; the adapter enforces the period on a pull).
    pub fn transfer(
        &mut self,
        from: &str,
        to: &str,
        assetids: &[u64],
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let mut probes = Vec::new();
            for &id in assetids {
                let before = c.status_of(id);
                let d = c.t.delegates.get(&id).cloned();
                let signer = match d {
                    Some(d) if d.owner == to && !Self::has_auth(signers, from) => d.owner,
                    _ => from.to_string(),
                };
                probes.push((id, before, signer));
            }
            c.transfer_in(from, to, assetids, memo, signers)?;
            for (id, before, signer) in probes {
                c.proven_step(id, before, Head::Transfer, &signer, to);
            }
            Ok(())
        })
    }
    fn transfer_in(
        &mut self,
        from: &str,
        to: &str,
        assetids: &[u64],
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        let (from, to) = (name(from)?, name(to)?);
        check(from != to, "bt-wb002:self", "cannot transfer to yourself")?;
        check(
            self.accounts.contains(&to),
            "bt-wb002:account",
            "TO account does not exist",
        )?;
        check(memo.len() <= MAX_MEMO, "bt-wb002:memo", "memo too large")?;
        check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
        let authorized = if Self::has_auth(signers, &to) {
            to.clone()
        } else {
            from.clone()
        }; // SA.cpp:233
        for &id in assetids {
            let mut delegating = false;
            let rec = self.t.delegates.get(&id).cloned();
            if let Some(rec) = &rec {
                if rec.owner == to || rec.delegatedto == to {
                    delegating = true;
                    if rec.owner == to {
                        let holder_returns = Self::has_auth(signers, &from);
                        let lender_pulls = Self::has_auth(signers, &rec.owner);
                        if self.profile == Profile::Adapter && lender_pulls && !holder_returns {
                            check(rec.cdate + rec.period < self.now, "bt-wb002:tenure", "bnr-adapter: the delegation period has not expired; the lender cannot pull back early")?;
                        }
                        self.t.delegates.remove(&id);
                        self.emit(fields![("type", "delegateclose"), ("assetid", id)]);
                    }
                } else {
                    return refuse(
                        "bt-wb002:delegated",
                        format!("asset {id} is delegated and cannot be transferred"),
                    );
                }
            }
            let auth_of = match &rec {
                Some(r) if delegating && Self::has_auth(signers, &r.owner) => r.owner.clone(),
                _ => from.clone(),
            };
            Self::require_auth(signers, &auth_of)?; // SA.cpp:261-265
            let row = self.find_asset(&from, id)?;
            check(
                row.owner == from,
                "bt-wb002:not-owner",
                format!("asset {id} is not {from}'s to transfer"),
            )?;
            check(
                !self.t.offers.contains_key(&id),
                "bt-wb002:offered",
                "asset offered for claim; cancel the offer first",
            )?;
            let payer = self
                .get_payer(&row.author, &row.category, id)
                .unwrap_or_else(|| authorized.clone());
            self.scope_mut(&from).remove(&id);
            self.emplace_asset(
                &to,
                Row {
                    owner: to.clone(),
                    ..row
                },
                &payer,
            );
            self.emit(fields![
                ("type", "move"),
                ("assetid", id),
                ("from", &from),
                ("to", &to),
                ("via", if delegating { "delegation" } else { "transfer" })
            ]);
        }
        Ok(())
    }

    pub fn claim(&mut self, claimer: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            c.claim_in(claimer, assetids, signers)?;
            for (id, b) in befores {
                c.proven_step(id, b, Head::Claim, claimer, claimer);
            }
            Ok(())
        })
    }
    fn claim_in(&mut self, claimer: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        let claimer = name(claimer)?;
        Self::require_auth(signers, &claimer)?; // SA.cpp:144
        check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
        for &id in assetids {
            let Some(offer) = self.t.offers.get(&id).cloned() else {
                return refuse("bt-wb002:no-offer", format!("no offer for asset {id}"));
            };
            check(
                claimer == offer.offeredto,
                "bt-wb002:not-offered-to",
                format!("asset {id} was offered to {}", offer.offeredto),
            )?;
            if self.profile == Profile::Adapter {
                check(
                    offer.expires_at.is_none_or(|e| self.now < e),
                    "bt-wb002:offer-expired",
                    "bnr-adapter: the offer has expired",
                )?;
            }
            let row = self.find_asset(&offer.owner, id)?; // SA.cpp:169
            check(
                offer.owner == row.owner,
                "bt-wb002:owner-drift",
                "offer owner and asset owner disagree",
            )?;
            let payer = self
                .get_payer(&row.author, &row.category, id)
                .unwrap_or_else(|| claimer.clone());
            self.scope_mut(&offer.owner).remove(&id);
            self.emplace_asset(
                &claimer,
                Row {
                    owner: claimer.clone(),
                    ..row
                },
                &payer,
            );
            self.t.offers.remove(&id);
            self.emit(fields![
                ("type", "move"),
                ("assetid", id),
                ("from", &offer.owner),
                ("to", &claimer),
                ("via", "claim")
            ]);
            self.emit(fields![
                ("type", "offerclose"),
                ("assetid", id),
                ("reason", "claim")
            ]);
        }
        Ok(())
    }

    pub fn offer(
        &mut self,
        owner: &str,
        newowner: &str,
        assetids: &[u64],
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            c.offer_in(owner, newowner, assetids, memo, signers)?;
            for (id, b) in befores {
                c.proven_step(id, b, Head::Offer, owner, newowner);
            }
            Ok(())
        })
    }
    fn offer_in(
        &mut self,
        owner: &str,
        newowner: &str,
        assetids: &[u64],
        _memo: &str,
        signers: &[&str],
    ) -> R<()> {
        let (owner, newowner) = (name(owner)?, name(newowner)?);
        check(
            owner != newowner,
            "bt-wb002:self",
            "cannot offer to yourself",
        )?;
        check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
        Self::require_auth(signers, &owner)?; // SA.cpp:340
        check(
            self.accounts.contains(&newowner),
            "bt-wb002:account",
            "newowner account does not exist",
        )?;
        for &id in assetids {
            self.find_asset(&owner, id)?;
            check(
                !self.t.offers.contains_key(&id),
                "bt-wb002:offered",
                format!("asset {id} is already offered"),
            )?;
            check(
                !self.t.delegates.contains_key(&id),
                "bt-wb002:delegated",
                format!("asset {id} is delegated"),
            )?;
            let rec = self.offer_record(&owner, &newowner);
            self.t.offers.insert(id, rec);
            self.emit(fields![
                ("type", "offeropen"),
                ("assetid", id),
                ("owner", &owner),
                ("offeredto", &newowner)
            ]);
        }
        Ok(())
    }

    pub fn canceloffer(&mut self, owner: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            Self::require_auth(signers, owner)?;
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            for &id in assetids {
                let Some(offer) = c.t.offers.get(&id).cloned() else {
                    return refuse("bt-wb002:no-offer", format!("no offer for asset {id}"));
                };
                check(
                    offer.owner == owner,
                    "bt-wb002:not-owner",
                    "not your offer to cancel",
                )?;
                c.t.offers.remove(&id);
                c.emit(fields![
                    ("type", "offerclose"),
                    ("assetid", id),
                    ("reason", "cancel")
                ]);
            }
            for (id, b) in befores {
                c.proven_step(id, b, Head::Cancel, owner, owner);
            }
            Ok(())
        })
    }

    pub fn update(
        &mut self,
        author: &str,
        owner: &str,
        assetid: u64,
        mdata: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            Self::require_auth(signers, author)?; // SA.cpp:324
            let row = c.find_asset(owner, assetid)?;
            check(
                row.author == author,
                "bt-wb002:not-author",
                "only the author may update mdata",
            )?;
            c.scope_mut(owner)
                .get_mut(&assetid)
                .expect("found above")
                .mdata = mdata.into(); // idata: no such path
            c.emit(fields![
                ("type", "mdata"),
                ("assetid", assetid),
                ("mdata", mdata)
            ]);
            Ok(())
        })
    }

    /// SA.cpp:439. The delegation record first, then the transfer into the
    /// borrower's scope; a re-delegation (the borrower delegating onward)
    /// moves possession and never sovereignty.
    #[allow(clippy::too_many_arguments)]
    pub fn delegate(
        &mut self,
        owner: &str,
        to: &str,
        assetids: &[u64],
        period: u64,
        redelegate: bool,
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let probes: Vec<(u64, Status, bool)> = assetids
                .iter()
                .map(|&id| (id, c.status_of(id), c.t.delegates.contains_key(&id)))
                .collect();
            c.delegate_in(owner, to, assetids, period, redelegate, memo, signers)?;
            for (id, b, re) in probes {
                c.proven_step(
                    id,
                    b,
                    if re { Head::Redelegate } else { Head::Delegate },
                    owner,
                    to,
                );
            }
            Ok(())
        })
    }
    #[allow(clippy::too_many_arguments)]
    fn delegate_in(
        &mut self,
        owner: &str,
        to: &str,
        assetids: &[u64],
        period: u64,
        redelegate: bool,
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        let (owner, to) = (name(owner)?, name(to)?);
        check(owner != to, "bt-wb002:self", "cannot delegate to yourself")?;
        check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
        Self::require_auth(signers, &owner)?;
        check(
            self.accounts.contains(&to),
            "bt-wb002:account",
            "TO account does not exist",
        )?;
        for &id in assetids {
            self.find_asset(&owner, id)?;
            check(
                !self.t.offers.contains_key(&id),
                "bt-wb002:offered",
                "asset has an open offer",
            )?;
            if let Some(existing) = self.t.delegates.get(&id).cloned() {
                check(
                    existing.redelegate,
                    "bt-wb002:no-redelegate",
                    "terms of delegation forbid re-delegation",
                )?;
                check(
                    existing.owner != to,
                    "bt-wb002:redelegate-owner",
                    "not allowed to re-delegate to the original owner",
                )?;
                let e = self.t.delegates.get_mut(&id).expect("present");
                e.delegatedto = to.clone();
                e.redelegate = redelegate;
            } else {
                self.t.delegates.insert(
                    id,
                    Deleg {
                        owner: owner.clone(),
                        delegatedto: to.clone(),
                        cdate: self.now,
                        period,
                        redelegate,
                        memo: memo.into(),
                    },
                );
                self.emit(fields![
                    ("type", "delegateopen"),
                    ("assetid", id),
                    ("owner", &owner),
                    ("delegatedto", &to),
                    ("period", period)
                ]);
            }
        }
        self.transfer_in(
            &owner,
            &to,
            assetids,
            &format!("Delegate memo: {memo}"),
            signers,
        ) // SA.cpp:477
    }

    pub fn delegatemore(
        &mut self,
        owner: &str,
        assetidc: u64,
        period: u64,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            Self::require_auth(signers, owner)?;
            let Some(rec) = c.t.delegates.get_mut(&assetidc) else {
                return refuse(
                    "bt-wb002:no-delegate",
                    format!("asset {assetidc} is not delegated"),
                );
            };
            check(
                rec.owner == owner,
                "bt-wb002:not-owner",
                "not your delegation to extend",
            )?;
            rec.period += period;
            Ok(())
        })
    }

    /// SA.cpp:493. The lender reclaims, only after cdate + period expires.
    pub fn undelegate(&mut self, owner: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            Self::require_auth(signers, owner)?;
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            let Some(first) = c.t.delegates.get(&assetids[0]).cloned() else {
                return refuse("bt-wb02:no-delegate", "asset is not delegated");
            };
            let from = first.delegatedto;
            for &id in assetids {
                let Some(rec) = c.t.delegates.get(&id).cloned() else {
                    return refuse("bt-wb02:no-delegate", "asset is not delegated");
                };
                check(
                    rec.owner == owner,
                    "bt-wb002:not-owner",
                    "not your delegation",
                )?;
                check(
                    rec.delegatedto == from,
                    "bt-wb002:mixed",
                    "all undelegations must share one borrower",
                )?;
                let row = c.find_asset(&from, id)?;
                check(
                    row.owner == rec.delegatedto,
                    "bt-wb002:owner-drift",
                    "holder does not match delegatedto",
                )?;
                check(
                    rec.cdate + rec.period < c.now,
                    "bt-wb002:period",
                    "cannot undelegate until the PERIOD expires",
                )?; // SA.cpp:514
            }
            c.transfer_in(&from, owner, assetids, "undelegate", signers)?;
            for (id, b) in befores {
                c.proven_step(id, b, Head::Undelegate, owner, owner);
            }
            Ok(())
        })
    }

    /// SA.cpp:527, finding F-3: attach needs the AUTHOR's signature on the
    /// specimen; the adapter requires the sovereign's.
    pub fn attach(
        &mut self,
        owner: &str,
        assetidc: u64,
        assetids: &[u64],
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            check(
                !c.t.delegates.contains_key(&assetidc),
                "bt-wb002:delegated",
                "container is delegated",
            )?;
            let parent = c.find_asset(owner, assetidc)?;
            if c.profile == Profile::Adapter {
                let sov = c.sovereign_of(assetidc).unwrap_or_default();
                Self::require_auth(signers, &sov)?;
            } else {
                Self::require_auth(signers, &parent.author)?; // SA.cpp:537
            }
            for &id in assetids {
                let child = c.find_asset(owner, id)?;
                check(assetidc != id, "bt-wb002:self", "cannot attach to self")?;
                check(
                    child.author == parent.author,
                    "bt-wb002:authors",
                    "all assets must share one author",
                )?;
                check(
                    !c.t.delegates.contains_key(&id),
                    "bt-wb002:delegated",
                    "cannot attach a delegated asset",
                )?;
                check(
                    !c.t.offers.contains_key(&id),
                    "bt-wb002:offered",
                    "cannot attach an offered asset",
                )?;
                c.scope_mut(owner).remove(&id);
                c.scope_mut(owner)
                    .get_mut(&assetidc)
                    .expect("found above")
                    .container
                    .push(child);
                c.emit(fields![
                    ("type", "attach"),
                    ("parent", assetidc),
                    ("assetid", id),
                    ("holder", owner)
                ]);
            }
            let container_sov = c.sovereign_of(assetidc).unwrap_or_default();
            for (id, b) in befores {
                c.proven_step(id, b, Head::Attach, owner, &container_sov);
            }
            Ok(())
        })
    }

    pub fn detach(
        &mut self,
        owner: &str,
        assetidc: u64,
        assetids: &[u64],
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            let parent = c.find_asset(owner, assetidc)?;
            check(
                !c.t.delegates.contains_key(&assetidc),
                "bt-wb002:delegated",
                "container is delegated",
            )?;
            if c.profile == Profile::Adapter {
                let sov = c.sovereign_of(assetidc).unwrap_or_default();
                Self::require_auth(signers, &sov)?;
            } else {
                Self::require_auth(signers, &parent.author)?; // SA.cpp:568
            }
            for &id in assetids {
                let container = c
                    .scope_mut(owner)
                    .get(&assetidc)
                    .expect("found above")
                    .container
                    .clone();
                let mut kept = Vec::new();
                let mut found = false;
                for ch in container {
                    if ch.id == id {
                        found = true;
                        // SA.cpp:581 sets s.owner = owner. The retired JS
                        // port kept the child's attach-time owner, so a child
                        // detached after its container changed hands came
                        // back owned by the OLD holder; the proven-step
                        // replay convicted it (adapter history, head 9).
                        c.emplace_asset(
                            owner,
                            Row {
                                owner: owner.to_string(),
                                ..ch
                            },
                            &parent.author,
                        );
                        c.emit(fields![
                            ("type", "detach"),
                            ("parent", assetidc),
                            ("assetid", id),
                            ("holder", owner)
                        ]);
                    } else {
                        kept.push(ch);
                    }
                }
                check(
                    found,
                    "bt-wb002:not-attached",
                    format!("asset {id} is not attached to {assetidc}"),
                )?;
                c.scope_mut(owner)
                    .get_mut(&assetidc)
                    .expect("found above")
                    .container = kept;
            }
            let sov = c.sovereign_of(assetidc).unwrap_or_default();
            for (id, b) in befores {
                c.proven_step(id, b, Head::Detach, &sov, &sov);
            }
            Ok(())
        })
    }

    pub fn burn(&mut self, owner: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            Self::require_auth(signers, owner)?; // SA.cpp:380
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            for &id in assetids {
                let row = c.find_asset(owner, id)?;
                check(
                    row.container.is_empty(),
                    "bt-wb002:contains",
                    "detach NFT children before burning",
                )?;
                check(
                    row.containerf.is_empty(),
                    "bt-wb002:contains-f",
                    "detach FT value before burning",
                )?;
                check(
                    row.owner == owner,
                    "bt-wb002:not-owner",
                    "not yours to burn",
                )?;
                check(
                    !c.t.offers.contains_key(&id),
                    "bt-wb002:offered",
                    "asset has an open offer",
                )?;
                check(
                    !c.t.delegates.contains_key(&id),
                    "bt-wb002:delegated",
                    "asset is delegated",
                )?;
                c.scope_mut(owner).remove(&id);
                c.emit(fields![("type", "burn"), ("assetid", id), ("owner", owner)]);
            }
            for (id, b) in befores {
                c.proven_step(id, b, Head::Burn, owner, owner);
            }
            Ok(())
        })
    }

    /// SA.cpp:12, finding F-8: upstream moves the author field on the
    /// author's signature alone; the adapter demands the sovereign's too.
    pub fn changeauthor(
        &mut self,
        author: &str,
        newauthor: &str,
        owner: &str,
        assetids: &[u64],
        _memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let newauthor = name(newauthor)?;
            Self::require_auth(signers, author)?; // SA.cpp:14
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            if c.profile == Profile::Adapter {
                Self::require_auth(signers, owner)?;
            }
            for &id in assetids {
                let row = c.find_asset(owner, id)?;
                check(
                    !c.t.offers.contains_key(&id),
                    "bt-wb002:offered",
                    "asset is offered",
                )?;
                check(
                    !c.t.delegates.contains_key(&id),
                    "bt-wb002:delegated",
                    "asset is delegated",
                )?;
                check(
                    row.author == author,
                    "bt-wb002:not-author",
                    "only the current author may change author",
                )?;
                check(
                    row.container.is_empty() && row.containerf.is_empty(),
                    "bt-wb002:contains",
                    "asset holds attached items",
                )?;
                for r in &c.t.arampayers {
                    check(
                        !(r.author == newauthor && r.category == row.category && r.usearam),
                        "bt-wb02:arampayer",
                        "new author sponsors RAM for this category",
                    )?; // SA.cpp:36
                }
                c.scope_mut(owner).get_mut(&id).expect("found above").author = newauthor.clone();
                c.emit(fields![
                    ("type", "chauthor"),
                    ("assetid", id),
                    ("newauthor", &newauthor),
                    ("owner", owner)
                ]);
            }
            Ok(())
        })
    }

    pub fn setarampayer(
        &mut self,
        author: &str,
        category: &str,
        usearam: bool,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let (author, category) = (name(author)?, name(category)?);
            Self::require_auth(signers, &author)?; // SA.cpp:1147
            let lnftid = c.t.lnftid;
            if let Some(hit) =
                c.t.arampayers
                    .iter_mut()
                    .find(|r| r.author == author && r.category == category)
            {
                hit.usearam = usearam;
                hit.from_id = lnftid;
            } else {
                c.t.defid += 1;
                let id = c.t.defid;
                c.t.arampayers.push(RamPayer {
                    id,
                    author,
                    category,
                    usearam,
                    from_id: lnftid,
                });
            }
            Ok(())
        })
    }

    // ---- NTT (non-transferable), SA.cpp:967-1090 ------------------------------
    #[allow(clippy::too_many_arguments)]
    pub fn createntt(
        &mut self,
        author: &str,
        category: &str,
        owner: &str,
        idata: &str,
        mdata: &str,
        requireclaim: bool,
        signers: &[&str],
    ) -> R<u64> {
        self.tx(|c| {
            let (author, category, owner) = (name(author)?, name(category)?, name(owner)?);
            Self::require_auth(signers, &author)?;
            check(
                c.accounts.contains(&owner),
                "bt-wb002:account",
                "owner account does not exist",
            )?;
            check(
                !(author == owner && requireclaim),
                "bt-wb02:claim-self",
                "can't requireclaim if author == owner",
            )?;
            let new_id = c.getid();
            let mut asset_owner = owner.clone();
            if requireclaim {
                asset_owner = author.clone();
                let rec = c.offer_record(&author, &owner);
                c.t.ntt_offers.insert(new_id, rec);
            }
            let row = NttRow {
                id: new_id,
                owner: asset_owner.clone(),
                author: author.clone(),
                category: category.clone(),
                idata: idata.into(),
                mdata: mdata.into(),
            };
            c.t.ntt_scopes
                .entry(asset_owner.clone())
                .or_default()
                .insert(new_id, row);
            c.emit(fields![
                ("type", "spawn"),
                ("kind", "ntt"),
                ("assetid", new_id),
                ("author", &author),
                ("category", &category),
                ("owner", &asset_owner),
                ("idata", idata)
            ]);
            c.emit(fields![
                ("type", "mdata"),
                ("assetid", new_id),
                ("mdata", mdata)
            ]);
            if requireclaim {
                c.emit(fields![
                    ("type", "offeropen"),
                    ("assetid", new_id),
                    ("owner", &author),
                    ("offeredto", &owner)
                ]);
            }
            Ok(new_id)
        })
    }
    pub fn claimntt(&mut self, claimer: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            let claimer = name(claimer)?;
            Self::require_auth(signers, &claimer)?;
            check(!assetids.is_empty(), "bt-wb002:empty", "empty assetids")?;
            for &id in assetids {
                let Some(offer) = c.t.ntt_offers.get(&id).cloned() else {
                    return refuse("bt-wb02:no-offer", format!("no NTT offer for {id}"));
                };
                check(
                    claimer == offer.offeredto,
                    "bt-wb002:not-offered-to",
                    "not offered to you",
                )?;
                if c.profile == Profile::Adapter {
                    check(
                        offer.expires_at.is_none_or(|e| c.now < e),
                        "bt-wb002:offer-expired",
                        "bnr-adapter: the offer has expired",
                    )?;
                }
                let Some(row) =
                    c.t.ntt_scopes
                        .get(&offer.owner)
                        .and_then(|m| m.get(&id))
                        .cloned()
                else {
                    return refuse("bt-wb02:not-found", "NTT not found at offer scope");
                };
                check(
                    offer.owner == row.owner,
                    "bt-wb002:owner-drift",
                    "offer owner and NTT owner disagree",
                )?;
                c.t.ntt_scopes
                    .entry(offer.owner.clone())
                    .or_default()
                    .remove(&id);
                c.t.ntt_scopes.entry(claimer.clone()).or_default().insert(
                    id,
                    NttRow {
                        owner: claimer.clone(),
                        ..row
                    },
                );
                c.t.ntt_offers.remove(&id);
                c.emit(fields![
                    ("type", "move"),
                    ("assetid", id),
                    ("from", &offer.owner),
                    ("to", &claimer),
                    ("via", "claim")
                ]);
            }
            for (id, b) in befores {
                c.proven_step(id, b, Head::Claim, &claimer, &claimer);
            }
            Ok(())
        })
    }
    pub fn updatentt(
        &mut self,
        author: &str,
        owner: &str,
        assetid: u64,
        mdata: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            Self::require_auth(signers, author)?; // SA.cpp:1008
            let Some(row) =
                c.t.ntt_scopes
                    .get_mut(owner)
                    .and_then(|m| m.get_mut(&assetid))
            else {
                return refuse("bt-wb02:not-found", "NTT not found");
            };
            check(
                row.author == author,
                "bt-wb002:not-author",
                "only the author may update NTT mdata",
            )?;
            row.mdata = mdata.into();
            c.emit(fields![
                ("type", "mdata"),
                ("assetid", assetid),
                ("mdata", mdata)
            ]);
            Ok(())
        })
    }
    pub fn burnntt(&mut self, owner: &str, assetids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            let befores: Vec<(u64, Status)> =
                assetids.iter().map(|&id| (id, c.status_of(id))).collect();
            Self::require_auth(signers, owner)?; // SA.cpp:1065
            for &id in assetids {
                if c.t.ntt_scopes.get(owner).and_then(|m| m.get(&id)).is_none() {
                    return refuse("bt-wb02:not-found", "NTT not found");
                }
                if let Some(offer) = c.t.ntt_offers.get(&id).cloned() {
                    check(
                        offer.owner == owner,
                        "bt-wb002:not-owner",
                        "offer owner mismatch",
                    )?;
                    c.t.ntt_offers.remove(&id);
                }
                c.t.ntt_scopes
                    .entry(owner.to_string())
                    .or_default()
                    .remove(&id);
                c.emit(fields![("type", "burn"), ("assetid", id), ("owner", owner)]);
            }
            for (id, b) in befores {
                c.proven_step(id, b, Head::Burn, owner, owner);
            }
            Ok(())
        })
    }

    // ---- fungible, SA.cpp:612-799 ----------------------------------------------
    pub fn createf(
        &mut self,
        author: &str,
        maximum: u128,
        symbol: &str,
        authorctrl: bool,
        data: &str,
        signers: &[&str],
    ) -> R<u64> {
        self.tx(|c| {
            let author = name(author)?;
            Self::require_auth(signers, &author)?; // SA.cpp:614
            check(maximum > 0, "bt-wb002:supply", "max-supply must be positive")?;
            if c.profile == Profile::Adapter {
                // founder ruling 2026-10-07: issuer authority is never
                // confiscation authority on sovereign funds
                check(!authorctrl, "bt-wb02:adapter-authorctrl", "bnr-adapter: authorctrl FTs are refused — issuer authority is not confiscation authority")?;
            }
            let key = format!("{author}:{symbol}");
            check(!c.t.stats.contains_key(&key), "bt-wb002:symbol", "token with symbol already exists")?;
            let id = c.getid(); // SA.cpp:627
            c.t.stats.insert(key, Stat { supply: 0, max: maximum, issuer: author.clone(), id, authorctrl, data: data.into(), symbol: symbol.into() });
            c.emit(fields![("type", "ftcreate"), ("author", &author), ("symbol", symbol), ("ftid", id), ("authorctrl", authorctrl), ("max", maximum)]);
            Ok(id)
        })
    }
    pub fn stat(&self, author: &str, symbol: &str) -> R<Stat> {
        let author = name(author)?;
        match self.t.stats.get(&format!("{author}:{symbol}")) {
            Some(s) => Ok(s.clone()),
            None => refuse(
                "bt-wb02:no-token",
                format!("token {symbol} of {author} does not exist"),
            ),
        }
    }
    fn stat_mut(&mut self, author: &str, symbol: &str) -> &mut Stat {
        self.t
            .stats
            .get_mut(&format!("{author}:{symbol}"))
            .expect("checked by stat()")
    }
    fn add_bal(&mut self, owner: &str, st: &Stat, amount: u128) {
        let m = self.t.balances.entry(owner.to_string()).or_default();
        m.entry(st.id)
            .or_insert_with(|| Bal {
                sym: st.symbol.clone(),
                amount: 0,
            })
            .amount += amount;
    }
    fn sub_bal(&mut self, owner: &str, st: &Stat, amount: u128) -> R<()> {
        let cur = self
            .t
            .balances
            .get_mut(owner)
            .and_then(|m| m.get_mut(&st.id));
        match cur {
            Some(b) if b.amount >= amount => {
                b.amount -= amount;
                Ok(())
            }
            _ => refuse("bt-wb002:overdrawn", "overdrawn balance"),
        }
    }
    pub fn issuef(
        &mut self,
        to: &str,
        author: &str,
        quantity: &Quantity,
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let to = name(to)?;
            let st = c.stat(author, &quantity.symbol)?;
            Self::require_auth(signers, &st.issuer)?; // SA.cpp:655
            check(
                quantity.amount > 0,
                "bt-wb02:quantity",
                "must issue positive quantity",
            )?;
            check(
                st.supply + quantity.amount <= st.max,
                "bt-wb02:max-supply",
                "quantity exceeds available supply",
            )?;
            c.stat_mut(author, &quantity.symbol).supply += quantity.amount;
            c.add_bal(&st.issuer, &st, quantity.amount);
            c.emit(fields![
                ("type", "ftissue"),
                ("ftid", st.id),
                ("to", &st.issuer),
                ("amount", quantity.amount),
                ("symbol", &st.symbol)
            ]);
            if to != st.issuer {
                c.transferf_in(&st.issuer, &to, author, quantity, memo, signers)?;
            }
            Ok(())
        })
    }
    /// SA.cpp:673, the F-1 seam ported exactly: with authorctrl the
    /// issuer's signature alone moves ANY holder's balance. The adapter
    /// refuses that path unconditionally.
    pub fn transferf(
        &mut self,
        from: &str,
        to: &str,
        author: &str,
        quantity: &Quantity,
        memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| c.transferf_in(from, to, author, quantity, memo, signers))
    }
    fn transferf_in(
        &mut self,
        from: &str,
        to: &str,
        author: &str,
        quantity: &Quantity,
        _memo: &str,
        signers: &[&str],
    ) -> R<()> {
        let (from, to) = (name(from)?, name(to)?);
        check(from != to, "bt-wb02:self", "cannot transfer to self")?;
        check(
            self.accounts.contains(&to),
            "bt-wb02:account",
            "to account does not exist",
        )?;
        let st = self.stat(author, &quantity.symbol)?;
        check(
            quantity.amount > 0,
            "bt-wb02:quantity",
            "must transfer positive quantity",
        )?;
        let mut check_auth = from.clone(); // SA.cpp:690
        if st.authorctrl && Self::has_auth(signers, &st.issuer) {
            check_auth = st.issuer.clone(); // SA.cpp:692-695, the confiscation path
        }
        if self.profile == Profile::Adapter
            && st.authorctrl
            && check_auth == st.issuer
            && !Self::has_auth(signers, &from)
        {
            return refuse(
                "bt-wb02:adapter-authorctrl-move",
                "bnr-adapter: an issuer signature never moves a holder balance",
            );
        }
        Self::require_auth(signers, &check_auth)?;
        self.sub_bal(&from, &st, quantity.amount)?;
        self.add_bal(&to, &st, quantity.amount);
        self.emit(fields![
            ("type", "ftmove"),
            ("ftid", st.id),
            ("from", &from),
            ("to", &to),
            ("amount", quantity.amount),
            ("symbol", &st.symbol)
        ]);
        Ok(())
    }
    pub fn burnf(
        &mut self,
        from: &str,
        author: &str,
        quantity: &Quantity,
        _memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let st = c.stat(author, &quantity.symbol)?;
            let issuer_path = st.authorctrl && Self::has_auth(signers, &st.issuer);
            if c.profile == Profile::Adapter && issuer_path && !Self::has_auth(signers, from) {
                return refuse(
                    "bt-wb02:adapter-authorctrl-move",
                    "bnr-adapter: an issuer signature never burns a holder balance",
                );
            }
            Self::require_auth(signers, if issuer_path { &st.issuer } else { from })?; // SA.cpp:787
            check(
                quantity.amount > 0,
                "bt-wb02:quantity",
                "must retire positive quantity",
            )?;
            let s = c.stat_mut(author, &quantity.symbol);
            s.supply = s.supply.saturating_sub(quantity.amount);
            c.sub_bal(from, &st, quantity.amount)?;
            c.emit(fields![
                ("type", "ftburn"),
                ("ftid", st.id),
                ("from", from),
                ("amount", quantity.amount),
                ("symbol", &st.symbol)
            ]);
            Ok(())
        })
    }
    pub fn offerf(
        &mut self,
        owner: &str,
        newowner: &str,
        author: &str,
        quantity: &Quantity,
        _memo: &str,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| {
            let (owner, newowner) = (name(owner)?, name(newowner)?);
            Self::require_auth(signers, &owner)?; // SA.cpp:704
            check(
                c.accounts.contains(&newowner),
                "bt-wb02:account",
                "newowner does not exist",
            )?;
            check(
                owner != newowner,
                "bt-wb02:self",
                "cannot offer to yourself",
            )?;
            let st = c.stat(author, &quantity.symbol)?;
            check(
                quantity.amount > 0,
                "bt-wb02:quantity",
                "must offer positive quantity",
            )?;
            // merge with an existing (owner, author, offeredto, symbol) offer, SA.cpp:721
            let hit =
                c.t.ft_offers
                    .iter()
                    .find(|(_, o)| {
                        o.owner == owner
                            && o.author == author
                            && o.offeredto == newowner
                            && o.sym == st.symbol
                    })
                    .map(|(id, _)| *id);
            if let Some(id) = hit {
                c.t.ft_offers.get_mut(&id).expect("found").amount += quantity.amount;
                c.sub_bal(&owner, &st, quantity.amount)?;
                let amount = c.t.ft_offers[&id].amount;
                c.emit(fields![
                    ("type", "ftofferopen"),
                    ("offerid", id),
                    ("ftid", st.id),
                    ("owner", &owner),
                    ("offeredto", &newowner),
                    ("amount", amount),
                    ("symbol", &st.symbol),
                    ("merged", true)
                ]);
                return Ok(());
            }
            c.t.defid += 1;
            let id = c.t.defid;
            c.t.ft_offers.insert(
                id,
                FtOffer {
                    author: author.into(),
                    owner: owner.clone(),
                    offeredto: newowner.clone(),
                    amount: quantity.amount,
                    sym: st.symbol.clone(),
                    ftid: st.id,
                    cdate: c.now,
                },
            );
            c.sub_bal(&owner, &st, quantity.amount)?;
            c.emit(fields![
                ("type", "ftofferopen"),
                ("offerid", id),
                ("ftid", st.id),
                ("owner", &owner),
                ("offeredto", &newowner),
                ("amount", quantity.amount),
                ("symbol", &st.symbol)
            ]);
            Ok(())
        })
    }
    pub fn cancelofferf(&mut self, owner: &str, ftofferids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            Self::require_auth(signers, owner)?; // SA.cpp:747
            check(!ftofferids.is_empty(), "bt-wb002:empty", "empty ftofferids")?;
            for &id in ftofferids {
                let Some(o) = c.t.ft_offers.get(&id).cloned() else {
                    return refuse("bt-wb02:no-offer", "offer not found");
                };
                check(o.owner == owner, "bt-wb002:not-owner", "not your offer")?;
                let st = c.stat(&o.author, &o.sym)?;
                c.add_bal(owner, &st, o.amount);
                c.t.ft_offers.remove(&id);
                c.emit(fields![
                    ("type", "ftofferkill"),
                    ("offerid", id),
                    ("reason", "cancel")
                ]);
            }
            Ok(())
        })
    }
    pub fn claimf(&mut self, claimer: &str, ftofferids: &[u64], signers: &[&str]) -> R<()> {
        self.tx(|c| {
            Self::require_auth(signers, claimer)?; // SA.cpp:765
            check(!ftofferids.is_empty(), "bt-wb002:empty", "empty ftofferids")?;
            for &id in ftofferids {
                let Some(o) = c.t.ft_offers.get(&id).cloned() else {
                    return refuse("bt-wb02:no-offer", "offer not found");
                };
                check(
                    claimer == o.offeredto,
                    "bt-wb002:not-offered-to",
                    "not offered to you",
                )?;
                let st = c.stat(&o.author, &o.sym)?;
                c.add_bal(claimer, &st, o.amount);
                c.t.ft_offers.remove(&id);
                c.emit(fields![
                    ("type", "ftmove"),
                    ("ftid", st.id),
                    ("from", &o.owner),
                    ("to", claimer),
                    ("amount", o.amount),
                    ("symbol", &st.symbol)
                ]);
                c.emit(fields![
                    ("type", "ftofferkill"),
                    ("offerid", id),
                    ("reason", "claim")
                ]);
            }
            Ok(())
        })
    }
    pub fn attachf(
        &mut self,
        owner: &str,
        author: &str,
        quantity: &Quantity,
        assetidc: u64,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| c.attachdetach(owner, author, quantity, assetidc, true, signers))
    }
    pub fn detachf(
        &mut self,
        owner: &str,
        author: &str,
        quantity: &Quantity,
        assetidc: u64,
        signers: &[&str],
    ) -> R<()> {
        self.tx(|c| c.attachdetach(owner, author, quantity, assetidc, false, signers))
    }
    fn attachdetach(
        &mut self,
        owner: &str,
        author: &str,
        quantity: &Quantity,
        assetidc: u64,
        attach: bool,
        signers: &[&str],
    ) -> R<()> {
        let st = self.stat(author, &quantity.symbol)?;
        Self::require_auth(signers, author)?; // SA.cpp:874
        if self.profile == Profile::Adapter {
            // F-3's fungible twin: the adapter demands the holder's signature too
            Self::require_auth(signers, owner)?;
        }
        check(quantity.amount > 0, "bt-wb02:quantity", "must be positive")?;
        check(
            st.issuer == author,
            "bt-wb02:authors",
            "FT issuer must be the signing author",
        )?;
        let row = self.find_asset(owner, assetidc)?;
        check(
            row.author == author,
            "bt-wb02:authors",
            "asset author mismatch",
        )?;
        check(
            !self.t.delegates.contains_key(&assetidc),
            "bt-wb002:delegated",
            "asset is delegated",
        )?;
        check(
            !self.t.offers.contains_key(&assetidc),
            "bt-wb002:offered",
            "asset is offered",
        )?;
        let mut found = false;
        let mut kept = Vec::new();
        for mut accf in row.containerf.clone() {
            if accf.id == st.id {
                if attach {
                    accf.amount += quantity.amount;
                } else {
                    check(
                        accf.amount >= quantity.amount,
                        "bt-wb02:overdrawn",
                        "overdrawn container balance",
                    )?;
                    accf.amount -= quantity.amount;
                }
                found = true;
            }
            if accf.amount > 0 {
                kept.push(accf);
            }
        }
        if !found && attach {
            kept.push(FtSlot {
                id: st.id,
                amount: quantity.amount,
                sym: st.symbol.clone(),
            });
        }
        if !attach {
            check(found, "bt-wb02:not-attached", "not attached")?;
        }
        self.scope_mut(owner)
            .get_mut(&assetidc)
            .expect("found above")
            .containerf = kept;
        if attach {
            self.sub_bal(owner, &st, quantity.amount)?;
            self.emit(fields![
                ("type", "ftattach"),
                ("ftid", st.id),
                ("holder", owner),
                ("assetid", assetidc),
                ("amount", quantity.amount),
                ("symbol", &st.symbol)
            ]);
        } else {
            self.add_bal(owner, &st, quantity.amount);
            self.emit(fields![
                ("type", "ftdetach"),
                ("ftid", st.id),
                ("holder", owner),
                ("assetid", assetidc),
                ("amount", quantity.amount),
                ("symbol", &st.symbol)
            ]);
        }
        Ok(())
    }

    // ---- migration / continuity surface (WB002's own, not upstream) --------
    fn serialize_row(row: &Row) -> SerRow {
        SerRow {
            id: row.id,
            author: row.author.clone(),
            category: row.category.clone(),
            idata: row.idata.clone(),
            mdata: row.mdata.clone(),
            contains: row.container.iter().map(Self::serialize_row).collect(),
            contains_f: row.containerf.clone(),
        }
    }
    fn materialize_row(ser: &SerRow, holder: &str) -> Row {
        Row {
            id: ser.id,
            owner: holder.into(),
            author: ser.author.clone(),
            category: ser.category.clone(),
            idata: ser.idata.clone(),
            mdata: ser.mdata.clone(),
            container: ser
                .contains
                .iter()
                .map(|c| Self::materialize_row(c, holder))
                .collect(),
            containerf: ser.contains_f.clone(),
        }
    }
    pub fn export_state(&mut self) -> Bundle {
        let mut assets = Vec::new();
        let rows: Vec<(String, Row)> = self
            .t
            .scopes
            .iter()
            .flat_map(|(h, m)| m.values().map(move |r| (h.clone(), r.clone())))
            .collect();
        for (holder, row) in rows {
            let sovereign = self.sovereign_of(row.id);
            assets.push(BundleAsset {
                kind: "nft",
                holder,
                sovereign,
                row: Self::serialize_row(&row),
            });
        }
        for (holder, m) in &self.t.ntt_scopes {
            for row in m.values() {
                assets.push(BundleAsset {
                    kind: "ntt",
                    holder: holder.clone(),
                    sovereign: Some(row.owner.clone()),
                    row: SerRow {
                        id: row.id,
                        author: row.author.clone(),
                        category: row.category.clone(),
                        idata: row.idata.clone(),
                        mdata: row.mdata.clone(),
                        contains: vec![],
                        contains_f: vec![],
                    },
                });
            }
        }
        let mut fts = Vec::new();
        for (owner, m) in &self.t.balances {
            for (ftid, b) in m {
                fts.push(BundleFt {
                    owner: owner.clone(),
                    ftid: *ftid,
                    amount: b.amount,
                    sym: b.sym.clone(),
                });
            }
        }
        let delegates = self
            .t
            .delegates
            .iter()
            .map(|(id, d)| (*id, d.clone()))
            .collect();
        Bundle {
            assets,
            fts,
            delegates,
            log_root: self.log_root(),
        }
    }
    pub fn state_commitment(bundle: &Bundle) -> String {
        let assets = bundle
            .assets
            .iter()
            .map(|a| {
                Val::Obj(fields![
                    ("kind", a.kind),
                    ("holder", &a.holder),
                    ("sovereign", a.sovereign.clone()),
                    ("row", ser_row_val(&a.row))
                ])
            })
            .collect();
        let fts = bundle
            .fts
            .iter()
            .map(|f| {
                Val::Obj(fields![
                    ("owner", &f.owner),
                    ("ftid", f.ftid),
                    ("amount", f.amount),
                    ("sym", &f.sym)
                ])
            })
            .collect();
        let delegates = bundle
            .delegates
            .iter()
            .map(|(id, d)| {
                Val::Obj(fields![
                    ("assetid", *id),
                    ("owner", &d.owner),
                    ("delegatedto", &d.delegatedto),
                    ("cdate", d.cdate),
                    ("period", d.period),
                    ("redelegate", d.redelegate)
                ])
            })
            .collect();
        sha(&canon(&Val::Obj(fields![
            ("assets", Val::Arr(assets)),
            ("fts", Val::Arr(fts)),
            ("delegates", Val::Arr(delegates))
        ])))
    }
    /// Import into THIS chain (the successor network), against the
    /// commitment the predecessor published while alive: a tampered bundle
    /// fails it. FT stats are not migrated: the successor's token contracts
    /// must exist first.
    pub fn import_state(&mut self, bundle: &Bundle, anchor: &str) -> R<()> {
        self.tx(|c| {
            if Self::state_commitment(bundle) != anchor {
                return refuse("bt-wb02:migration-anchor", "bundle commitment does not match the predecessor anchor — refusing the migration");
            }
            for a in &bundle.assets {
                if a.kind == "ntt" {
                    let r = &a.row;
                    c.t.ntt_scopes.entry(a.holder.clone()).or_default().insert(
                        r.id,
                        NttRow { id: r.id, owner: a.holder.clone(), author: r.author.clone(), category: r.category.clone(), idata: r.idata.clone(), mdata: r.mdata.clone() },
                    );
                } else {
                    let row = Self::materialize_row(&a.row, &a.holder);
                    c.scope_mut(&a.holder).insert(a.row.id, row);
                }
                c.emit(fields![("type", "spawn"), ("kind", a.kind), ("assetid", a.row.id), ("author", &a.row.author), ("category", &a.row.category), ("owner", &a.holder), ("idata", &a.row.idata), ("migrated", true)]);
            }
            for (id, d) in &bundle.delegates {
                c.t.delegates.insert(*id, d.clone());
            }
            for f in &bundle.fts {
                if let Some(st) = c.t.stats.values().find(|s| s.id == f.ftid).cloned() {
                    c.add_bal(&f.owner, &st, f.amount);
                }
            }
            Ok(())
        })
    }
}

fn actor_id(actors: &mut Vec<String>, n: &str) -> u8 {
    if let Some(i) = actors.iter().position(|a| a == n) {
        return (i + 1) as u8;
    }
    assert!(
        actors.len() < 255,
        "more than 255 distinct actors: the proven machine's Actor is one byte"
    );
    actors.push(n.to_string());
    actors.len() as u8
}
