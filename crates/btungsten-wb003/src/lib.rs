//! bTunGsTeN WB003 — the century ladder. SPEC-BTUNGSTEN-1 axis 6 (the
//! honesty clause): no thousand-year experiment is pretended; what is
//! tested is that the architecture CONTAINS THE MECHANISMS — repeated
//! simulated century transitions, dependency extinction, algorithm
//! deprecation, reorgs, storage loss, and anchored migration — under
//! the WB002 killer invariant at every step and every boundary:
//!
//!   no change of implementation, network, author, storage provider,
//!   cryptographic algorithm, or execution environment may transfer
//!   sovereign authority without the currently authorized sovereign
//!   action.
//!
//! The schedule is FIXED and readable (no RNG): one spine of sovereign
//! assets created in 2019 on the Specimen profile is carried through ten
//! centuries — the first migration IS the extraction (Specimen → Adapter,
//! where the F-1 confiscation seam dies) — exercising, per century:
//! migration with tamper refusal, author extinction, key/algorithm
//! rotation, partition+reorg, marketplace death, fragment poverty, and
//! ordinary life (new citizens, transfers, delegations).
//!
//! Scale honesty: this receipts the MODEL (crates/btungsten-wb002) at
//! ten-century depth. Sampled class; the SAW-proven core still underwrites
//! each Adapter-profile action; nothing here is a live-chain or
//! thousand-year empirical claim.

use btungsten_wb002::chain::{Chain, Profile, Refusal, R};
use btungsten_wb002::invariant::{
    consent_of, ft_consent_of, ft_snapshot, ft_unexplained, sovereign_snapshot, unexplained,
};
use btungsten_wb002::lattice::{reconstruct, AdapterUI, Indexer, DISPUTED};
use std::collections::BTreeSet;

/// One century of wall-clock time (the schedule's unit of institutional change).
pub const CENTURY: u64 = 100 * 365 * 24 * 60 * 60;
/// 2019-01-01T00:00:00Z — the specimen's era; the spine is born here.
pub const T0: u64 = 1_546_300_800;

pub const PEOPLE: [&str; 5] = ["alice", "bob", "carol", "dave", "ed"];
pub const AUTHORS: [&str; 2] = ["authorgov", "authorx"];

/// A test world: everyone who ever signs, registered up front.
pub fn world(profile: Profile, now: u64) -> Chain {
    let mut c = Chain::new(profile, now);
    for n in AUTHORS
        .iter()
        .chain(PEOPLE.iter())
        .chain(["mallory", "authornew"].iter())
    {
        c.acct(n);
    }
    c
}

/// The sovereign spine: assets born 2019 that must still be exercisable
/// in 3019 — an NFT credential (its idata is the COMMIT commitment), an
/// NTT capability, a composed authority object (parent ∋ child), a
/// delegated asset whose tenure spans migrations, and sovereign funds.
#[derive(Clone, Debug)]
pub struct Spine {
    pub nft: u64,
    pub ntt: u64,
    pub parent: u64,
    pub child: u64,
    pub delegation_asset: u64,
    pub sovr_ft: u64,
    pub wood_ft: u64,
    pub idata_nft: String,
    pub idata_ntt: String,
}

/// One century boundary's record: what the century did, and the state the
/// millennium auditor reconstructs from surviving fragments.
#[derive(Clone, Debug)]
pub struct Receipt {
    pub century: usize,
    pub year: u64,
    pub steps: usize,
    pub refused: usize,
    pub probes: usize,
    pub migration: Option<String>,
    pub fragment_from_seq: u64,
    pub fingerprint: String,
    pub spine: Vec<(u64, Option<String>)>,
}

/// The authority-key eras. Rotation is an OFF-CHAIN authority change: the
/// model's actions carry signer NAMES, so the era table records which
/// key/algorithm an account acts under; the assertion that matters (and
/// is checked here) is that rotation emits nothing and moves nothing,
/// while the account keeps acting under its new era afterwards.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Era {
    pub key: &'static str,
    pub alg: &'static str,
}

/// The century engine. Every action goes through [`Engine::drive`], which
/// enforces the killer invariant on the spot; every boundary re-derives
/// the whole world from surviving fragments and demands it equal the chain.
pub struct Engine {
    pub chain: Chain,
    pub spine: Spine,
    pub receipts: Vec<Receipt>,
    /// the migration-anchor lineage, in order (each is the state
    /// commitment the predecessor published while alive).
    pub anchors: Vec<String>,
    /// Specimen-era violations, all of which must be the NAMED F-1 class
    /// (the 2019 software's authorctrl seam, exercised once, pre-extraction).
    pub named: Vec<(usize, &'static str)>,
    /// Adapter-era unexplained sovereignty changes. Must stay EMPTY.
    pub unexplained: Vec<(usize, String)>,
    pub eras: Vec<(usize, String, Era)>,
    /// authors whose keys no longer exist; run() simply never signs for
    /// them again — the record is the receipt.
    pub dead_authors: BTreeSet<String>,
    century: usize,
    steps: usize,
    refused: usize,
    probes: usize,
    migration: Option<String>,
}

impl Engine {
    /// 2019: the Specimen software, the spine, a live long delegation, and
    /// the authorctrl hazard (WOOD) alongside sovereign funds (SOVR).
    pub fn genesis() -> Engine {
        let mut c = world(Profile::Specimen, T0);
        let wood_ft = c
            .createf("authorgov", 1_000_000, "WOOD", true, "{}", &["authorgov"])
            .unwrap();
        let sovr_ft = c
            .createf("authorgov", 1_000_000, "SOVR", false, "{}", &["authorgov"])
            .unwrap();
        c.issuef(
            "bob",
            "authorgov",
            &btungsten_wb002::chain::qty("SOVR", 1000),
            "",
            &["authorgov"],
        )
        .unwrap();
        c.issuef(
            "bob",
            "authorgov",
            &btungsten_wb002::chain::qty("WOOD", 500),
            "",
            &["authorgov"],
        )
        .unwrap();
        let nft = c
            .create(
                "authorgov",
                "cred",
                "alice",
                "cmt-2019:v1:COMMIT",
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        let ntt = c
            .createntt(
                "authorgov",
                "cap",
                "alice",
                "ntt-2019:v1",
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        let parent = c
            .create(
                "authorgov",
                "cred",
                "carol",
                "cmt-parent",
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        let child = c
            .create(
                "authorgov",
                "cred",
                "carol",
                "cmt-child",
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        // Specimen-era composition is author-signed (F-3); the Adapter
        // extraction later makes it sovereign-signed.
        c.attach("carol", parent, &[child], &["authorgov"]).unwrap();
        let delegation_asset = c
            .create(
                "authorgov",
                "cred",
                "alice",
                "cmt-tenure",
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        // a tenure spanning most of the millennium: alive across
        // migrations 1..3, returned by the borrower in century 9.
        c.delegate(
            "alice",
            "dave",
            &[delegation_asset],
            7 * CENTURY,
            false,
            "spine tenure",
            &["alice"],
        )
        .unwrap();
        Engine {
            spine: Spine {
                nft,
                ntt,
                parent,
                child,
                delegation_asset,
                sovr_ft,
                wood_ft,
                idata_nft: "cmt-2019:v1:COMMIT".into(),
                idata_ntt: "ntt-2019:v1".into(),
            },
            chain: c,
            receipts: Vec::new(),
            anchors: Vec::new(),
            named: Vec::new(),
            unexplained: Vec::new(),
            eras: Vec::new(),
            dead_authors: BTreeSet::new(),
            century: 0,
            steps: 0,
            refused: 0,
            probes: 0,
            migration: None,
        }
    }

    /// One action under the killer invariant; consent captured BEFORE.
    /// Specimen-era (pre-extraction) violations must be the NAMED F-1
    /// class; Adapter-era violations land in `unexplained` (must be none).
    fn drive(
        &mut self,
        tag: &'static str,
        signers: &[&str],
        f: impl FnOnce(&mut Chain) -> R<()>,
    ) -> R<()> {
        let before = sovereign_snapshot(&mut self.chain);
        let ft_before = ft_snapshot(&self.chain);
        let consent = consent_of(&self.chain);
        let ft_consent = ft_consent_of(&self.chain);
        f(&mut self.chain)?;
        let after = sovereign_snapshot(&mut self.chain);
        let ft_after = ft_snapshot(&self.chain);
        self.steps += 1;
        for u in unexplained(&before, &after, signers, &consent) {
            self.record_violation(tag, format!("{}:{}->{}", u.id, u.from, u.to));
        }
        for u in ft_unexplained(&ft_before, &ft_after, signers, &ft_consent) {
            self.record_violation(tag, format!("ft:{}:{}->{}", u.id, u.from, u.to));
        }
        Ok(())
    }

    fn record_violation(&mut self, tag: &'static str, detail: String) {
        if self.chain.profile == Profile::Adapter {
            self.unexplained
                .push((self.century, format!("{tag} {detail}")));
        } else {
            // the 2019 software's named seams only
            self.named.push((self.century, tag));
        }
    }

    /// Expect a refusal; demand the whole world (fingerprint) survived it.
    fn expect_refusal<T>(&mut self, f: impl FnOnce(&mut Chain) -> R<T>) -> &'static str {
        let fp = self.chain.fingerprint();
        match f(&mut self.chain) {
            Ok(_) => panic!("expected a refusal"),
            Err(Refusal { code, .. }) => {
                assert_eq!(
                    self.chain.fingerprint(),
                    fp,
                    "a refused action ({code}) left state behind"
                );
                self.refused += 1;
                code
            }
        }
    }

    /// Ordinary life in a century: the spine credential moves to
    /// `spine_to`, sovereign funds move 10 at a time, and a hostile
    /// probe (mallory) tries to take the spine and is refused whole.
    fn live(&mut self, spine_to: &str) {
        let nft = self.spine.nft;
        let from = self
            .chain
            .sovereign_of(nft)
            .expect("the spine credential always exists");
        if from != spine_to {
            let f = from.clone();
            self.drive("transfer(spine)", &[f.as_str()], |c| {
                c.transfer(&f, spine_to, &[nft], "", &[f.as_str()])
            })
            .unwrap();
        }
        self.drive("transferf(sovr)", &["bob"], |c| {
            c.transferf(
                "bob",
                "carol",
                "authorgov",
                &btungsten_wb002::chain::qty("SOVR", 10),
                "",
                &["bob"],
            )
        })
        .unwrap();
        let holder = self.chain.sovereign_of(nft).expect("spine holder");
        let code =
            self.expect_refusal(|c| c.transfer(&holder, "mallory", &[nft], "", &["mallory"]));
        assert_eq!(code, "bt-wb002:auth", "the hostile probe returned {code}");
        self.probes += 1;
    }

    /// An anchored migration to a fresh successor network of `profile`.
    /// The tampered bundle is offered to the successor FIRST: it must be
    /// refused against the predecessor's live-published anchor. FT stats
    /// are recreated on the successor before import (same genesis order,
    /// so token ids match — value continuity is asserted after).
    fn migrate(&mut self, profile: Profile, wood_authorctrl: bool) {
        let bundle = self.chain.export_state();
        let anchor = Chain::state_commitment(&bundle);
        // TEETH, every migration: one sovereign flipped in the bundle.
        let mut tampered = bundle.clone();
        let victim = tampered
            .assets
            .iter_mut()
            .find(|a| a.kind == "nft" && Some(a.holder.clone()) == a.sovereign.clone())
            .expect("a free asset to flip");
        victim.sovereign = Some("mallory".into());
        victim.row.mdata = "forged".into();
        let mut succ = world(profile, self.chain.now);
        succ.createf(
            "authorgov",
            1_000_000,
            "WOOD",
            wood_authorctrl,
            "{}",
            &["authorgov"],
        )
        .unwrap();
        succ.createf("authorgov", 1_000_000, "SOVR", false, "{}", &["authorgov"])
            .unwrap();
        let fp = succ.fingerprint();
        match succ.import_state(&tampered, &anchor) {
            Ok(_) => panic!("the successor accepted a tampered bundle"),
            Err(Refusal { code, .. }) => {
                assert_eq!(code, "bt-wb02:migration-anchor");
                assert_eq!(
                    succ.fingerprint(),
                    fp,
                    "refused import mutated the successor"
                );
            }
        }
        self.refused += 1;
        // the honest import
        succ.import_state(&bundle, &anchor).unwrap();
        // value continuity: the SOVR balance migrated whole
        let sovr_succ = succ.stat("authorgov", "SOVR").unwrap().id;
        assert_eq!(
            succ.bal("bob", sovr_succ),
            self.chain.bal("bob", self.spine.sovr_ft),
            "SOVR balance did not survive the migration"
        );
        // the live tenure, if any, rides the migration
        let ten = self.spine.delegation_asset;
        let lender = self.chain.sovereign_of(ten);
        self.chain = succ;
        assert_eq!(
            self.chain.sovereign_of(ten),
            lender,
            "the live tenure did not survive the migration"
        );
        self.anchors.push(anchor);
        self.migration = Some(format!(
            "c{}:{}",
            self.century,
            if profile == Profile::Adapter {
                "adapter"
            } else {
                "specimen"
            }
        ));
    }

    /// Key/algorithm rotation: an off-chain authority change. No event is
    /// emitted and sovereignty does not move; the account keeps acting
    /// under its new era in every later century (the live rows prove it).
    fn rotate(&mut self, who: &str, key: &'static str, alg: &'static str) {
        let before = sovereign_snapshot(&mut self.chain);
        let log_len = self.chain.log.len();
        self.eras
            .push((self.century, who.to_string(), Era { key, alg }));
        assert_eq!(self.chain.log.len(), log_len, "rotation emitted an event");
        assert_eq!(
            sovereign_snapshot(&mut self.chain),
            before,
            "rotation moved sovereignty"
        );
    }

    /// The author's key dies: it never signs again. Optionally the spine's
    /// authorship moves first (Adapter F-8: author + sovereign co-sign).
    fn author_dies(&mut self, author: &str, cosign_changeauthor: bool) {
        if cosign_changeauthor && self.chain.profile == Profile::Adapter {
            let nft = self.spine.nft;
            let holder = self.chain.sovereign_of(nft).unwrap();
            let h = holder.clone();
            self.drive("changeauthor(F-8)", &[author, h.as_str()], |c| {
                c.changeauthor(author, "authornew", &h, &[nft], "", &[author, h.as_str()])
            })
            .unwrap();
        }
        self.dead_authors.insert(author.to_string());
    }

    /// The marketplace dies: the standing offer is long dead (adapter TTL
    /// 3600 s), its claim refuses, and the transfer happens directly.
    fn marketplace_dies(&mut self, to: &str, id: u64) {
        let holder = self.chain.sovereign_of(id).unwrap();
        let h = holder.clone();
        self.drive("offer(doomed)", &[h.as_str()], |c| {
            c.offer(&h, to, &[id], "", &[h.as_str()])
        })
        .unwrap();
        self.chain.now += CENTURY / 10; // the venue's last hour passes many times over
        let code = self.expect_refusal(|c| c.claim(to, &[id], &[to]));
        assert_eq!(code, "bt-wb002:offer-expired");
        // the standing consent is withdrawn by its author (an expired
        // offer still encumbers the asset until cancelled)
        self.drive("canceloffer", &[h.as_str()], |c| {
            c.canceloffer(&h, &[id], &[h.as_str()])
        })
        .unwrap();
        self.drive("transfer(direct)", &[h.as_str()], |c| {
            c.transfer(&h, to, &[id], "", &[h.as_str()])
        })
        .unwrap();
    }

    /// Partition and reorg: the network forks; both branches take a LEGAL
    /// but different action; the branch with the winning log root is
    /// canonical. Healing traffic then pushes the winner past a NEW
    /// checkpoint, so the losing branch — served by an indexer against
    /// the canonical anchors — must answer DISPUTED for the contested
    /// asset, never a confident wrong owner.
    fn partition_reorg(&mut self) {
        let id = self.spine.nft;
        let holder = self.chain.sovereign_of(id).unwrap();
        let h = holder.clone();
        let fork_len = self.chain.log.len();
        let mut a = self.chain.clone();
        let mut b = self.chain.clone();
        let (xa, xb) = if h == "alice" {
            ("bob", "carol")
        } else {
            ("alice", "bob")
        };
        a.transfer(&h, xa, &[id], "", &[h.as_str()]).unwrap();
        b.transfer(&h, xb, &[id], "", &[h.as_str()]).unwrap();
        let a_wins = a.log_root() > b.log_root();
        let (mut winner, loser, to) = if a_wins { (a, b, xa) } else { (b, a, xb) };
        // healing traffic on the canonical branch until a checkpoint
        // exists BEYOND the fork (bounded; each pass is 2 authorized moves)
        let mut guard = 0;
        while winner
            .checkpoint_anchor()
            .is_none_or(|cp| (cp.seq as usize) <= fork_len)
        {
            winner
                .transferf(
                    "carol",
                    "ed",
                    "authorgov",
                    &btungsten_wb002::chain::qty("SOVR", 1),
                    "",
                    &["carol"],
                )
                .unwrap();
            winner
                .transferf(
                    "ed",
                    "carol",
                    "authorgov",
                    &btungsten_wb002::chain::qty("SOVR", 1),
                    "",
                    &["ed"],
                )
                .unwrap();
            guard += 1;
            assert!(guard < 64, "no checkpoint fired after {guard} passes");
        }
        self.steps += 1 + 2 * guard; // the canonical transfer + healing traffic
                                     // canonical truth is the winner, and the fold agrees
        assert_eq!(winner.sovereign_of(id).as_deref(), Some(to));
        assert_eq!(
            reconstruct(&winner.log).sovereign(id).as_deref(),
            Some(to),
            "the canonical fold diverged after the reorg"
        );
        // the losing branch, served by an indexer against the canonical
        // anchors, must DISPUTE (its checkpoint there cannot authenticate)
        let mut ix = Indexer::default();
        ix.feed(&loser.log);
        let ui = AdapterUI {
            indexer: &ix,
            checkpoint: winner.checkpoint_anchor(),
            tip: winner.tip_anchor(),
        };
        assert_eq!(ui.display_owner(id).as_deref(), Some(DISPUTED));
        self.chain = winner;
    }

    /// The boundary audit: from the last checkpoint onward ONLY (the
    /// storage provider lost the full log), the fold must rebuild the
    /// whole world; idata must be byte-identical to 2019; the receipt is
    /// cut. Zero-unexplained is asserted by the caller per era policy.
    fn boundary(&mut self) {
        let century = self.century;
        let nft_idata = self.spine.idata_nft.clone();
        let ntt_idata = self.spine.idata_ntt.clone();
        let spine_ids = [
            self.spine.nft,
            self.spine.ntt,
            self.spine.parent,
            self.spine.child,
            self.spine.delegation_asset,
        ];
        let c = &mut self.chain;
        let cp_seq = c
            .log
            .iter()
            .rev()
            .find(|e| e.ty() == "checkpoint")
            .map(|cp| cp.seq);
        let frag_from = match cp_seq {
            Some(cp_seq) => {
                let frag: Vec<_> = c.log.iter().filter(|e| e.seq >= cp_seq).cloned().collect();
                let fold = reconstruct(&frag);
                for id in all_ids(c) {
                    assert_eq!(
                        fold.sovereign(id),
                        c.sovereign_of(id),
                        "century {century}: fragment recovery diverged for id {id}"
                    );
                }
                cp_seq
            }
            None => {
                let fold = reconstruct(&c.log.clone());
                for id in all_ids(c) {
                    assert_eq!(
                        fold.sovereign(id),
                        c.sovereign_of(id),
                        "century {century}: full-log fold diverged for id {id}"
                    );
                }
                0
            }
        };
        // idata byte-stability across everything the centuries did
        assert_eq!(find_idata(c, spine_ids[0]).unwrap(), nft_idata);
        assert_eq!(find_idata(c, spine_ids[1]).unwrap(), ntt_idata);
        let spine = spine_ids
            .into_iter()
            .map(|id| (id, c.sovereign_of(id)))
            .collect();
        let receipt = Receipt {
            century,
            year: 2019 + 100 * century as u64,
            steps: self.steps,
            refused: self.refused,
            probes: self.probes,
            migration: self.migration.take(),
            fragment_from_seq: frag_from,
            fingerprint: c.fingerprint(),
            spine,
        };
        self.receipts.push(receipt);
        self.steps = 0;
        self.refused = 0;
        self.probes = 0;
    }

    fn open_century(&mut self) {
        self.century += 1;
        self.chain.now += CENTURY;
    }

    /// Post-migration bustle: lawful ping-pong until the newborn network
    /// cuts its first checkpoint — the fragment the NEXT century (or the
    /// 3019 auditor) recovers from.
    fn live_until_checkpoint(&mut self) {
        let start_len = self.chain.log.len();
        let mut guard = 0;
        while self
            .chain
            .checkpoint_anchor()
            .is_none_or(|cp| (cp.seq as usize) <= start_len)
        {
            self.drive("transferf(bustle)", &["bob"], |c| {
                c.transferf(
                    "bob",
                    "carol",
                    "authorgov",
                    &btungsten_wb002::chain::qty("SOVR", 1),
                    "",
                    &["bob"],
                )
            })
            .unwrap();
            self.drive("transferf(bustle-back)", &["carol"], |c| {
                c.transferf(
                    "carol",
                    "bob",
                    "authorgov",
                    &btungsten_wb002::chain::qty("SOVR", 1),
                    "",
                    &["carol"],
                )
            })
            .unwrap();
            guard += 1;
            assert!(guard < 64, "no checkpoint fired after {guard} passes");
        }
    }

    /// The fixed ten-century schedule. Read it as the millennium audit
    /// plan: each century is named for its institutional transition.
    pub fn run() -> Engine {
        let mut e = Engine::genesis();
        e.boundary(); // century 0 = 2019, the genesis receipt

        // C1 2119 — THE EXTRACTION: the 2019 software's confiscation seam
        // is exercised and NAMED, then dies at the migration boundary.
        e.open_century();
        e.drive("F1:issuer-move", &["authorgov"], |c| {
            c.transferf(
                "bob",
                "mallory",
                "authorgov",
                &btungsten_wb002::chain::qty("WOOD", 100),
                "",
                &["authorgov"],
            )
        })
        .unwrap(); // legal on the Specimen; recorded as the named F-1 class
        e.migrate(Profile::Adapter, false); // WOOD reborn without authorctrl
        let code = e.expect_refusal(|c| {
            c.transferf(
                "bob",
                "mallory",
                "authorgov",
                &btungsten_wb002::chain::qty("WOOD", 100),
                "",
                &["authorgov"],
            )
        });
        assert_eq!(
            code, "bt-wb002:auth",
            "the extraction kept the issuer-confiscation seam"
        );
        e.author_dies("authorx", false);
        e.rotate("alice", "K2", "dilithium2");
        e.live("bob");
        e.boundary();

        // C2 2219 — NEW BLOOD: a citizen is born on the successor network
        // (the post-migration mint), proving migrated ids never collide.
        e.open_century();
        e.drive("create(new-citizen)", &["authorgov"], |c| {
            c.create(
                "authorgov",
                "cred",
                "ed",
                "cmt-2219",
                "{}",
                false,
                &["authorgov"],
            )
            .map(|_| ())
        })
        .unwrap();
        e.drive("createntt(new-citizen)", &["authorgov"], |c| {
            c.createntt(
                "authorgov",
                "cap",
                "ed",
                "ntt-2219",
                "{}",
                false,
                &["authorgov"],
            )
            .map(|_| ())
        })
        .unwrap();
        e.live("carol");
        e.boundary();

        // C3 2319 — THE FORK: partition, reorg, then a migration taken
        // MID-DELEGATION (the spine tenure must ride it alive).
        e.open_century();
        e.partition_reorg();
        e.migrate(Profile::Adapter, false);
        e.live("dave");
        e.boundary();

        // C4 2419 — THE MARKETPLACE DIES: standing consent outlives its
        // venue; the transfer happens without it.
        e.open_century();
        let nft = e.spine.nft;
        e.marketplace_dies("ed", nft);
        e.live("ed");
        e.boundary();

        // C5 2519 — THE THIRD NETWORK: another anchored migration, another
        // algorithm era.
        e.open_century();
        e.migrate(Profile::Adapter, false);
        e.rotate("bob", "K3", "sphincs-imp");
        e.live("alice");
        e.boundary();

        // C6 2619 — VALIDATORS REPLACED: a second partition/reorg.
        e.open_century();
        e.partition_reorg();
        e.live("bob");
        e.boundary();

        // C7 2719 — THE LAST AUTHOR: co-signed changeauthor (F-8), then
        // the founding author's key dies; sovereignty never notices.
        e.open_century();
        e.author_dies("authorgov", true);
        e.drive("create(new-author)", &["authornew"], |c| {
            c.create(
                "authornew",
                "cred",
                "carol",
                "cmt-2719",
                "{}",
                false,
                &["authornew"],
            )
            .map(|_| ())
        })
        .unwrap();
        e.live("carol");
        e.boundary();

        // C8 2819 — ALGORITHMS TURN OVER: two more eras, fragment
        // poverty at the boundary.
        e.open_century();
        e.rotate("carol", "K4", "ml-dsa-3019");
        e.rotate("dave", "K5", "ml-dsa-3019");
        e.live("dave");
        e.boundary();

        // C9 2919 — THE LONG TENURE ENDS: the 2019 delegation, seven
        // centuries old, is returned by its borrower.
        e.open_century();
        {
            let id = e.spine.delegation_asset;
            let owner = e.chain.sovereign_of(id).unwrap();
            let o = owner.clone();
            e.drive("transfer(tenure-return)", &["dave"], |c| {
                c.transfer("dave", &o, &[id], "", &["dave"])
            })
            .unwrap();
            assert_eq!(e.chain.sovereign_of(id).as_deref(), Some(o.as_str()));
        }
        e.live("ed");
        e.boundary();

        // C10 3019 — THE MILLENNIUM BOUNDARY: the final network change;
        // the newborn cuts its first checkpoint under ordinary traffic,
        // and the 3019 auditor rebuilds the world from fragments alone.
        e.open_century();
        e.migrate(Profile::Adapter, false);
        e.live_until_checkpoint();
        e.live("alice");
        e.boundary();

        e
    }
}

/// Every id that exists anywhere: free, contained, delegated, ntt.
pub fn all_ids(c: &Chain) -> BTreeSet<u64> {
    fn walk_container(ids: &mut BTreeSet<u64>, r: &btungsten_wb002::chain::Row) {
        ids.insert(r.id);
        for k in &r.container {
            walk_container(ids, k);
        }
    }
    let mut ids = BTreeSet::new();
    for m in c.scopes().values() {
        for r in m.values() {
            walk_container(&mut ids, r);
        }
    }
    for m in c.ntt_scopes().values() {
        ids.extend(m.keys().copied());
    }
    ids
}

/// idata of `id` wherever it lives (free row or inside a container).
pub fn find_idata(c: &Chain, id: u64) -> Option<String> {
    fn walk(r: &btungsten_wb002::chain::Row, id: u64) -> Option<String> {
        if r.id == id {
            return Some(r.idata.clone());
        }
        r.container.iter().find_map(|k| walk(k, id))
    }
    c.scopes()
        .values()
        .flat_map(|m| m.values())
        .find_map(|r| walk(r, id))
        .or_else(|| {
            c.ntt_scopes()
                .values()
                .find_map(|m| m.get(&id).map(|r| r.idata.clone()))
        })
}
