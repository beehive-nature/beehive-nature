//! The WB003 battery: the ten-century ladder over the WB002 specimen,
//! plus the standalone rows that name and convict each migration seam the
//! ladder exposed (repaired red-first; see the dispatch for the red run).

use btungsten_wb002::chain::{Chain, Profile, Row};
use btungsten_wb002::lattice::reconstruct;
use btungsten_wb003::{all_ids, find_idata, world, Engine, T0};

/// The composed ladder itself: ten centuries, four anchored migrations,
/// two reorgs, two author extinctions, four algorithm eras, one marketplace
/// death, one seven-century tenure — and the 2019 spine arrives in 3019
/// intact, exercisable, and reconstructible from fragments alone.
#[test]
fn ten_centuries_the_spine_survives() {
    let mut e = Engine::run();
    // the receipts: 11 boundaries (genesis + ten centuries)
    assert_eq!(e.receipts.len(), 11, "boundary receipts");
    for r in &e.receipts {
        println!(
            "c{:>2} {} steps={} refused={} probes={} migration={:?} frag_from={} fp={:.12} spine={:?}",
            r.century,
            r.year,
            r.steps,
            r.refused,
            r.probes,
            r.migration,
            r.fragment_from_seq,
            r.fingerprint,
            r.spine
        );
    }
    // every century was ALIVE (life continued) and PROBED (mallory tried)
    for r in e.receipts.iter().skip(1) {
        assert!(r.steps > 0, "century {} had no steps", r.century);
        assert!(r.probes >= 1, "century {} was not probed", r.century);
    }
    // four anchored migrations, lineage recorded
    assert_eq!(e.anchors.len(), 4, "migration anchor lineage");
    assert!(e.anchors.windows(2).all(|w| w[0] != w[1]), "anchors repeat");
    // the ONE named specimen violation is the F-1 class, century 1, pre-extraction
    assert_eq!(
        e.named,
        vec![(1, "F1:issuer-move")],
        "unexpected specimen-era violations: {:?}",
        e.named
    );
    // the adapter era (2019's extraction, 2119-3019): zero unexplained
    assert!(
        e.unexplained.is_empty(),
        "adapter-era unexplained changes: {:?}",
        e.unexplained
    );
    // the spine arrives: every 2019 asset alive with a sovereign, the
    // credential where the schedule put it (C10 live), idata byte-identical
    let mut spine: Vec<_> = e.receipts.last().unwrap().spine.clone();
    spine.sort_by_key(|(id, _)| *id);
    for (id, sov) in &spine {
        assert!(sov.is_some(), "spine asset {id} died before 3019");
    }
    assert_eq!(
        e.chain.sovereign_of(e.spine.nft).as_deref(),
        Some("alice"),
        "the 2019 credential's 3019 holder"
    );
    assert_eq!(
        find_idata(&e.chain, e.spine.nft).unwrap(),
        "cmt-2019:v1:COMMIT",
        "the 2019 COMMIT commitment drifted"
    );
    assert_eq!(
        find_idata(&e.chain, e.spine.ntt).unwrap(),
        "ntt-2019:v1",
        "the 2019 capability commitment drifted"
    );
    // sovereign funds: 1000 issued, 10 × 10 centuries moved lawfully,
    // nothing else moved them
    assert_eq!(e.chain.bal("bob", e.spine.sovr_ft), 900);
    assert_eq!(e.chain.bal("carol", e.spine.sovr_ft), 100);
    // the final world, rebuilt from the LAST CHECKPOINT ONLY, equals
    // canonical truth for every id that exists
    let fold = {
        let cp = e
            .chain
            .log
            .iter()
            .rev()
            .find(|ev| ev.ty() == "checkpoint")
            .expect("a final checkpoint");
        let frag: Vec<_> = e
            .chain
            .log
            .iter()
            .filter(|ev| ev.seq >= cp.seq)
            .cloned()
            .collect();
        reconstruct(&frag)
    };
    for id in all_ids(&e.chain) {
        assert_eq!(
            fold.sovereign(id),
            e.chain.sovereign_of(id),
            "3019 fragment audit diverged for id {id}"
        );
    }
}

/// TEETH: the tampered bundle — refused by every anchored successor —
/// would have stuck under the naive importer. The teeth are not stale.
#[test]
fn the_naive_importer_is_still_convicted() {
    let mut e = Engine::genesis();
    // century 1's tampered bundle, rebuilt here deterministically
    let bundle = e.chain.export_state();
    let mut tampered = bundle.clone();
    let flipped = tampered
        .assets
        .iter_mut()
        .find(|a| a.kind == "nft" && Some(a.holder.clone()) == a.sovereign.clone())
        .expect("a free asset to flip");
    let flipped_id = flipped.row.id;
    flipped.sovereign = Some("mallory".into());
    let mut naive = world(Profile::Adapter, T0);
    for a in &tampered.assets {
        let s = a.sovereign.clone().unwrap_or(a.holder.clone());
        naive.plant_row(
            &s,
            Row {
                id: a.row.id,
                owner: s.clone(),
                author: a.row.author.clone(),
                category: a.row.category.clone(),
                idata: a.row.idata.clone(),
                mdata: String::new(),
                container: vec![],
                containerf: vec![],
            },
        );
    }
    assert_eq!(
        naive.sovereign_of(flipped_id).as_deref(),
        Some("mallory"),
        "teeth stale: the naive importer did not accept the forgery"
    );
}

/// The dead century: a full century with NO sovereign action changes
/// nothing — no entropy without action (fingerprint-stable, fold equal).
#[test]
fn the_dead_century_changes_nothing() {
    let mut e = Engine::genesis();
    let nft = e.spine.nft;
    e.chain
        .transfer("alice", "bob", &[nft], "", &["alice"])
        .unwrap();
    let fp = e.chain.fingerprint();
    let ids_then = all_ids(&e.chain);
    e.chain.now += btungsten_wb003::CENTURY;
    assert_eq!(e.chain.fingerprint(), fp, "the dead century changed state");
    assert_eq!(all_ids(&e.chain), ids_then);
    let fold = {
        let log = e.chain.log.clone();
        reconstruct(&log)
    };
    for id in ids_then {
        assert_eq!(
            fold.sovereign(id),
            e.chain.sovereign_of(id),
            "the dead century diverged for id {id}"
        );
    }
}

/// R-A: after an anchored migration the successor mints NEW assets, and
/// no id ever exists twice — the migrated spine stays resolvable to its
/// own sovereign, and the newborn asset to its own (the upstream #26
/// mis-assignment class, convicted at the migration boundary).
#[test]
fn post_migration_mint_never_collides() {
    let mut e = Engine::genesis();
    let bundle = e.chain.export_state();
    let anchor = Chain::state_commitment(&bundle);
    let mut succ = world(Profile::Adapter, T0);
    succ.createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    succ.createf("authorgov", 1_000_000, "SOVR", false, "{}", &["authorgov"])
        .unwrap();
    succ.import_state(&bundle, &anchor).unwrap();
    let newborn = succ
        .create(
            "authorgov",
            "cred",
            "ed",
            "cmt-2219",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    // every top-level id exists in exactly ONE scope
    let mut seen: std::collections::BTreeMap<u64, String> = std::collections::BTreeMap::new();
    for (holder, m) in succ.scopes() {
        for id in m.keys() {
            let prev = seen.insert(*id, holder.clone());
            assert!(
                prev.is_none(),
                "id {id} exists in two scopes ({}) — the migration collision",
                prev.unwrap()
            );
        }
    }
    // the newborn resolves to ITS owner, the spine to alice
    assert_eq!(succ.sovereign_of(newborn).as_deref(), Some("ed"));
    assert_eq!(e.chain.sovereign_of(e.spine.nft).as_deref(), Some("alice"));
    assert_eq!(succ.sovereign_of(e.spine.nft).as_deref(), Some("alice"));
    // and the fold agrees on both
    let fold = {
        let log = succ.log.clone();
        reconstruct(&log)
    };
    assert_eq!(fold.sovereign(newborn).as_deref(), Some("ed"));
    assert_eq!(fold.sovereign(e.spine.nft).as_deref(), Some("alice"));
}

/// R-B: a live delegation is LOG truth on the successor, not only table
/// truth — the fold says the lender, like the chain does.
#[test]
fn live_delegation_is_log_truth_after_migration() {
    let mut e = Engine::genesis();
    let ten = e.spine.delegation_asset;
    let bundle = e.chain.export_state();
    let anchor = Chain::state_commitment(&bundle);
    let mut succ = world(Profile::Adapter, T0);
    succ.createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    succ.createf("authorgov", 1_000_000, "SOVR", false, "{}", &["authorgov"])
        .unwrap();
    succ.import_state(&bundle, &anchor).unwrap();
    assert_eq!(succ.sovereign_of(ten).as_deref(), Some("alice"));
    let fold = {
        let log = succ.log.clone();
        reconstruct(&log)
    };
    assert_eq!(
        fold.sovereign(ten).as_deref(),
        Some("alice"),
        "the successor's log lost the live tenure (fold said {:?})",
        fold.sovereign(ten)
    );
}

/// R-C: value continuity or refusal — a bundle whose fungible balance
/// names a token the successor does not have must REFUSE the migration,
/// never silently drop the holder's funds.
#[test]
fn value_continuity_or_refusal() {
    let mut e = Engine::genesis();
    let bundle = e.chain.export_state();
    let anchor = Chain::state_commitment(&bundle);
    let mut succ = world(Profile::Adapter, T0);
    // the successor recreates WOOD but NOT SOVR
    succ.createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    // a bundle with a bob SOVR balance the successor cannot honor
    let sovr = bundle
        .fts
        .iter()
        .find(|f| f.sym == "SOVR" && f.owner == "bob")
        .cloned()
        .expect("bob's SOVR balance");
    let _ = sovr;
    let fp = succ.fingerprint();
    match succ.import_state(&bundle, &anchor) {
        Err(refusal) => assert_eq!(refusal.code, "bt-wb02:migration-unknown-ft"),
        Ok(()) => panic!("the successor silently dropped bob's SOVR balance"),
    }
    assert_eq!(
        succ.fingerprint(),
        fp,
        "the refused import mutated the successor"
    );
}

/// R-D: contained assets are LOG truth on the successor — the composed
/// authority object (parent ∋ child) survives migration as fold-visible
/// structure, not only as table state.
#[test]
fn contained_assets_are_log_truth_after_migration() {
    let mut e = Engine::genesis();
    let (parent, child) = (e.spine.parent, e.spine.child);
    let bundle = e.chain.export_state();
    let anchor = Chain::state_commitment(&bundle);
    let mut succ = world(Profile::Adapter, T0);
    succ.createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    succ.createf("authorgov", 1_000_000, "SOVR", false, "{}", &["authorgov"])
        .unwrap();
    succ.import_state(&bundle, &anchor).unwrap();
    assert_eq!(succ.sovereign_of(child).as_deref(), Some("carol"));
    let fold = {
        let log = succ.log.clone();
        reconstruct(&log)
    };
    assert_eq!(
        fold.sovereign(child).as_deref(),
        Some("carol"),
        "the successor's log cannot see the contained child (fold said {:?})",
        fold.sovereign(child)
    );
    assert_eq!(fold.sovereign(parent).as_deref(), Some("carol"));
}
