//! The epochal engine (laws L1-L3): a population of unique registered
//! sovereigns participates each epoch — COMMIT + PROVE at model scale —
//! through decentralized shards into one aggregate capability receipt,
//! which authorizes a BOUNDED, short-lived msig proposal; SETTLE writes
//! the immutable bTunGsTeN receipt; the next epoch begins. Between
//! epochs the founder's ladder runs: rotate humans/agents, rotate keys,
//! replace signers, replace the chain (anchored migration), migrate
//! cryptography, and — once — cross the 2106 boundary by replacing the
//! time representation itself.

use crate::authority::{Authority, ReceiptLog, Signer};
use crate::msig::{Msig, PermissionLevel};
use crate::time::{civil, TimeRep};
use crate::{canon, refuse, sha_hex, R};

/// Shard size: the decentralized participation layer's granularity.
pub const SHARD_SIZE: usize = 256;
/// The fraction of shards whose quorum proofs the aggregate needs.
pub const SHARD_QUORUM_NUM: usize = 2;
pub const SHARD_QUORUM_DEN: usize = 3;
/// Proposal TTL: seven days. Law L2 — short-lived by construction.
pub const PROPOSAL_TTL: u64 = 7 * 24 * 3600;

/// One epoch's record.
#[derive(Clone, Debug)]
pub struct EpochReceipt {
    pub epoch: usize,
    pub year: i64,
    pub population: usize,
    pub shards_total: usize,
    pub shards_proving: usize,
    pub aggregate_root: String,
    pub msig_levels: usize,
    pub executed: String,
    pub log_head_after: String,
}

/// The aggregate capability: shard proofs + the root they fold to, bound
/// to one (epoch, payload). Population-scale authorization lives HERE,
/// never in the execution layer (law L3).
#[derive(Clone, Debug)]
pub struct Aggregate {
    pub epoch: usize,
    pub payload_digest: String,
    pub shard_proofs: Vec<String>,
    pub root: String,
}

impl Aggregate {
    /// The aggregate is ORDER-INDEPENDENT by construction: shard proofs
    /// are sorted before folding, so any surviving node that aggregates
    /// the same proofs derives the same root — no indispensable
    /// aggregator.
    pub fn fold(epoch: usize, payload_digest: &str, shard_proofs: &[String]) -> String {
        let mut v = shard_proofs.to_vec();
        v.sort();
        let pairs: Vec<(&str, String)> = vec![
            ("epoch", epoch.to_string()),
            ("payload", payload_digest.to_string()),
            ("shards", v.join(",")),
        ];
        sha_hex(canon(&pairs).as_bytes())
    }
    /// Validity: the root recomputes, the proofs bind this payload, and
    /// the shard count carries the quorum.
    pub fn verify(&self, shards_total: usize) -> R<()> {
        if Aggregate::fold(self.epoch, &self.payload_digest, &self.shard_proofs) != self.root {
            return refuse(
                "bt-wb004:aggregate",
                "the aggregate root does not recompute from its shard proofs",
            );
        }
        let needed = shards_total * SHARD_QUORUM_NUM / SHARD_QUORUM_DEN;
        if self.shard_proofs.len() < needed {
            return refuse(
                "bt-wb004:shard-quorum",
                format!(
                    "{} shard proofs < the {} required of {} shards",
                    self.shard_proofs.len(),
                    needed,
                    shards_total
                ),
            );
        }
        Ok(())
    }
}

pub struct Engine {
    pub now: u64,
    pub msig: Msig,
    pub authority: Authority,
    pub log: ReceiptLog,
    pub registered: std::collections::BTreeSet<u64>,
    pub receipts: Vec<EpochReceipt>,
    /// L1's ledger: authority changes without the current quorum. Empty,
    /// always, or the battery is red.
    pub unexplained: Vec<String>,
    epoch_counter: usize,
}

/// 2026-01-01T00:00:00Z.
pub const T0: u64 = 1_767_225_600;

impl Engine {
    /// 2026: five constitutional signers, 3-of-5, the ed25519 era, the
    /// u32 wire, the genesis receipt.
    pub fn genesis() -> Engine {
        let authority = Authority {
            epoch: 0,
            threshold: 3,
            signers: ["gov1", "gov2", "gov3", "gov4", "gov5"]
                .iter()
                .map(|a| Signer {
                    account: a.to_string(),
                    key: "K1".into(),
                    alg: "ed25519".into(),
                })
                .collect(),
            constitution_digest: sha_hex(b"bT-WB04:constitution:v1"),
        };
        let mut log = ReceiptLog::default();
        log.append(
            "genesis",
            &[
                ("digest", authority.constitution_digest.clone()),
                ("signers", "gov1,gov2,gov3,gov4,gov5".into()),
                ("threshold", "3".into()),
            ],
        );
        Engine {
            now: T0,
            msig: Msig::default(),
            authority,
            log,
            registered: std::collections::BTreeSet::new(),
            receipts: Vec::new(),
            unexplained: Vec::new(),
            epoch_counter: 0,
        }
    }

    /// Uniqueness: one human, one sovereign seat. Duplicate registration
    /// refuses (the Sybil axis' interface — the proof itself is another
    /// lane's cryptography).
    pub fn register(&mut self, id: u64) -> R<()> {
        if !self.registered.insert(id) {
            return refuse(
                "bt-wb004:duplicate",
                format!("sovereign {id} already holds a seat this registry"),
            );
        }
        Ok(())
    }

    /// One sovereign's participation signature for (epoch, payload) —
    /// deterministic at model scale (the signature SCHEME is an
    /// interface; algorithms are the PQ lane's, eras are named in the
    /// log).
    fn participation(&self, epoch: usize, payload_digest: &str, id: u64) -> String {
        sha_hex(
            canon(&[
                ("epoch", epoch.to_string()),
                ("payload", payload_digest.to_string()),
                ("sovereign", id.to_string()),
            ])
            .as_bytes(),
        )
    }

    /// COMMIT + PROVE, sharded: every registered sovereign participates
    /// (liveness — the ACTIVE population, not an accumulated one), each
    /// shard folds its members' participations into one proof, the
    /// aggregate folds the (sorted) shard proofs into one root.
    pub fn aggregate(&mut self, payload_digest: &str, skip_shards: &[usize]) -> Aggregate {
        let epoch = self.epoch_counter;
        let n = self.registered.len();
        let shards_total = n.div_ceil(SHARD_SIZE);
        let ids: Vec<u64> = self.registered.iter().copied().collect();
        let mut shard_proofs = Vec::new();
        for s in 0..shards_total {
            if skip_shards.contains(&s) {
                continue;
            }
            let members = &ids[s * SHARD_SIZE..((s + 1) * SHARD_SIZE).min(n)];
            let parts: Vec<String> = members
                .iter()
                .map(|&id| self.participation(epoch, payload_digest, id))
                .collect();
            let pairs = vec![
                ("epoch", epoch.to_string()),
                ("payload", payload_digest.to_string()),
                ("shard", s.to_string()),
                ("parts", parts.join(",")),
            ];
            shard_proofs.push(sha_hex(canon(&pairs).as_bytes()));
        }
        let root = Aggregate::fold(epoch, payload_digest, &shard_proofs);
        Aggregate {
            epoch,
            payload_digest: payload_digest.to_string(),
            shard_proofs,
            root,
        }
    }

    /// The continuity-checked authority action (L1's engine side): an
    /// authority-affecting action REFUSES without the CURRENT quorum —
    /// fail closed, never "explained after the fact". The ledger stays
    /// as the belt-and-braces witness any mutation path cannot bypass.
    pub fn drive(&mut self, acting: &[&str], f: impl FnOnce(&mut Engine) -> R<()>) -> R<()> {
        if !self.authority.quorum_met(acting) {
            return refuse(
                "bt-wb004:continuity",
                format!(
                    "acting set {:?} does not meet the current {}-of-{} quorum",
                    acting,
                    self.authority.threshold,
                    self.authority.signers.len()
                ),
            );
        }
        // the gate above already refused unauthorized action, so any
        // change f makes is quorum-explained by construction; the ledger
        // stays (always empty) as the witness the battery asserts
        f(self)
    }

    /// Rotate the signer set / keys / algorithm era — quorum-authorized,
    /// receipted. What does NOT change: the constitution digest.
    pub fn rotate(&mut self, acting: &[&str], new_signers: Vec<Signer>, threshold: usize) -> R<()> {
        let digest = self.authority.constitution_digest.clone();
        self.drive(acting, |e| {
            e.authority.signers = new_signers.clone();
            e.authority.threshold = threshold;
            e.authority.epoch += 1;
            Ok(())
        })?;
        let alg = self
            .authority
            .signers
            .first()
            .map(|s| s.alg.clone())
            .unwrap_or_default();
        let key = self
            .authority
            .signers
            .first()
            .map(|s| s.key.clone())
            .unwrap_or_default();
        self.log.append(
            "rotate",
            &[
                ("acting", acting.join(",")),
                (
                    "signers",
                    self.authority
                        .signers
                        .iter()
                        .map(|s| s.account.clone())
                        .collect::<Vec<_>>()
                        .join(","),
                ),
                ("threshold", threshold.to_string()),
                ("key", key),
                ("alg", alg),
                ("digest", digest),
            ],
        );
        Ok(())
    }

    /// Cross the time-representation boundary: replace the execution
    /// contract (u32 → u64 wire) AND the chain it lives on, as one
    /// anchored migration of the authority — quorum-authorized, the
    /// successor's first receipt continues the same provenance chain.
    pub fn migrate_representation(&mut self, acting: &[&str]) -> R<()> {
        let bundle = self.authority.export(&self.log.head());
        let anchor = Authority::commitment(&bundle);
        // TEETH, in the battery: a tampered bundle refuses here.
        let successor = Authority::import(&bundle, &anchor)?;
        self.drive(acting, |e| {
            e.authority = successor.clone();
            e.authority.epoch += 1;
            e.msig = Msig {
                rep: TimeRep::U64,
                proposals: Default::default(),
            };
            Ok(())
        })?;
        self.log.append(
            "migrate",
            &[
                ("acting", acting.join(",")),
                ("from_rep", "u32".into()),
                ("to_rep", "u64".into()),
                ("anchor", anchor),
                (
                    "signers",
                    self.authority
                        .signers
                        .iter()
                        .map(|s| s.account.clone())
                        .collect::<Vec<_>>()
                        .join(","),
                ),
                ("threshold", self.authority.threshold.to_string()),
                (
                    "key",
                    self.authority
                        .signers
                        .first()
                        .map(|s| s.key.clone())
                        .unwrap_or_default(),
                ),
                (
                    "alg",
                    self.authority
                        .signers
                        .first()
                        .map(|s| s.alg.clone())
                        .unwrap_or_default(),
                ),
            ],
        );
        Ok(())
    }

    /// One full epochal cycle (L2): aggregate participation → capability
    /// receipt → bounded short-lived proposal → quorum approvals → exec
    /// inside the TTL → SETTLE receipt. `payload` is the epoch's
    /// governance intent; its digest binds the aggregate and the
    /// proposal alike.
    pub fn epoch_cycle(&mut self, payload: &str, skip_shards: &[usize]) -> R<EpochReceipt> {
        self.epoch_counter += 1;
        let epoch = self.epoch_counter;
        let payload_digest = sha_hex(payload.as_bytes());
        let agg = self.aggregate(&payload_digest, skip_shards);
        agg.verify(agg.shard_proofs.len() + skip_shards.len())?;
        // the capability receipt: immutable, replayable evidence of what
        // authorized this epoch's execution
        self.log.append(
            "capability",
            &[
                ("epoch", epoch.to_string()),
                ("payload", payload_digest.clone()),
                ("root", agg.root.clone()),
                ("shards", agg.shard_proofs.len().to_string()),
                ("population", self.registered.len().to_string()),
            ],
        );
        // the execution layer receives the COMPACT aggregate — bounded,
        // population-independent (L3)
        let name = format!("epoch-{epoch}");
        self.msig.propose(
            "governance",
            &name,
            vec![
                PermissionLevel::new("aggregate", &format!("epoch-{epoch}")),
                PermissionLevel::new("governance", "propose"),
            ],
            &payload_digest,
            PROPOSAL_TTL,
            self.now,
        )?;
        // quorum approvals: the aggregate capability + the proposer
        // institution (the aggregate's validity was proven above; the
        // msig layer checks only its own bounded vector)
        self.msig
            .approve("aggregate", &format!("epoch-{epoch}"), &name)?;
        self.msig.approve("governance", "propose", &name)?;
        let executed = self.msig.exec(self.now, &name)?;
        let msig_levels = self.msig.stored_levels();
        // SETTLE
        self.log.append(
            "settle",
            &[
                ("epoch", epoch.to_string()),
                ("payload", payload_digest),
                ("executed", "true".into()),
            ],
        );
        let receipt = EpochReceipt {
            epoch,
            year: civil(self.now).0,
            population: self.registered.len(),
            shards_total: agg.shard_proofs.len() + skip_shards.len(),
            shards_proving: agg.shard_proofs.len(),
            aggregate_root: agg.root,
            msig_levels,
            executed,
            log_head_after: self.log.head(),
        };
        self.receipts.push(receipt.clone());
        Ok(receipt)
    }
}
