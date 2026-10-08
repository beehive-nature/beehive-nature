//! The torture rows: the invariant across the death of the author, the
//! loss of the contract, key and algorithm rotation, partition and reorg,
//! contract replacement with chain migration, and the marketplace's death.

use crate::common::{
    all_ids, assert_fold_equals_chain, refused_with, run_history, world, Collector, T0,
};
use btungsten_wb002::chain::{qty, Chain, Profile, Row};
use btungsten_wb002::invariant::sovereign_snapshot;
use btungsten_wb002::lattice::{reconstruct, AdapterUI, Indexer, DISPUTED};
use std::collections::BTreeMap;

#[test]
fn kill_the_author() {
    let mut c = world(Profile::Specimen, T0);
    let id = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    // the author's key dies: no signature of authorgov ever appears again
    c.transfer("alice", "bob", &[id], "", &["alice"]).unwrap();
    c.offer("bob", "carol", &[id], "", &["bob"]).unwrap();
    c.claim("carol", &[id], &["carol"]).unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("carol"));
    c.burn("carol", &[id], &["carol"]).unwrap();
    assert_eq!(c.sovereign_of(id), None);
    // mdata freezes with the author; sovereignty does not
    let id2 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt2",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    assert_eq!(
        refused_with(&mut c, |c| c.update(
            "authorgov",
            "alice",
            id2,
            "x",
            &["alice"]
        )),
        "bt-wb002:auth"
    );
    assert_eq!(c.sovereign_of(id2).as_deref(), Some("alice"));
}

#[test]
fn lose_the_contract_reconstruct_from_the_log_and_from_fragments() {
    let mut c = world(Profile::Adapter, T0);
    let mut col = Collector::default();
    run_history(&mut c, 200, 31_337, &mut col);
    assert_fold_equals_chain(&mut c, "full log");
    let last_cp = c
        .log
        .iter()
        .rev()
        .find(|e| e.ty() == "checkpoint")
        .cloned()
        .expect("a checkpoint");
    let frag: Vec<_> = c
        .log
        .iter()
        .filter(|e| e.seq >= last_cp.seq)
        .cloned()
        .collect();
    let fold = reconstruct(&frag);
    for id in all_ids(&c) {
        assert_eq!(
            fold.sovereign(id),
            c.sovereign_of(id),
            "fragment recovery diverged for id {id}"
        );
    }
}

#[test]
fn rotate_the_sovereign_key_and_the_algorithm() {
    let mut c = world(Profile::Specimen, T0);
    let id = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    // the authority table: account -> (key, alg, active)
    let mut keys: BTreeMap<&str, (&str, &str, bool)> =
        BTreeMap::from([("alice", ("K1", "ed25519", true))]);
    let sign = |keys: &BTreeMap<&str, (&str, &str, bool)>, k: &str| -> Vec<String> {
        keys.iter()
            .filter(|(_, v)| v.2 && v.0 == k)
            .map(|(n, _)| n.to_string())
            .collect()
    };
    let before = sovereign_snapshot(&mut c);
    let log_before = c.log.len();
    keys.insert("alice", ("K2", "successor-sig-2039", true));
    assert_eq!(c.log.len(), log_before, "rotation emitted an event");
    assert_eq!(
        sovereign_snapshot(&mut c),
        before,
        "rotation moved sovereignty"
    );
    let old = sign(&keys, "K1");
    assert!(old.is_empty(), "the revoked key still resolves");
    let old_s: Vec<&str> = old.iter().map(String::as_str).collect();
    assert_eq!(
        refused_with(&mut c, |c| c.transfer("alice", "bob", &[id], "", &old_s)),
        "bt-wb002:auth"
    );
    let new = sign(&keys, "K2");
    let new_s: Vec<&str> = new.iter().map(String::as_str).collect();
    c.transfer("alice", "bob", &[id], "", &new_s).unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("bob"));
}

#[test]
fn partition_and_reorg() {
    let mut a = world(Profile::Specimen, T0);
    let mut b = world(Profile::Specimen, T0);
    let id = a
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    b.create(
        "authorgov",
        "cred",
        "alice",
        "cmt",
        "{}",
        false,
        &["authorgov"],
    )
    .unwrap();
    a.transfer("alice", "bob", &[id], "", &["alice"]).unwrap();
    b.transfer("alice", "carol", &[id], "", &["alice"]).unwrap();
    // canonical = the branch whose log root wins (the model's tie-break)
    let a_wins = a.log_root() > b.log_root();
    let (winner, loser, win_to, lose_to) = if a_wins {
        (&mut a, &b, "bob", "carol")
    } else {
        (&mut b, &a, "carol", "bob")
    };
    assert_eq!(winner.sovereign_of(id).as_deref(), Some(win_to));
    let fold = reconstruct(&winner.log);
    assert_eq!(fold.sovereign(id).as_deref(), Some(win_to));
    assert_ne!(fold.sovereign(id).as_deref(), Some(lose_to));
    let mut ix = Indexer::default();
    ix.feed(&loser.log);
    let ui = AdapterUI {
        indexer: &ix,
        checkpoint: winner.checkpoint_anchor(),
        tip: winner.tip_anchor(),
    };
    assert_eq!(
        ui.display_owner(id).as_deref(),
        Some(DISPUTED),
        "the losing fork's UI confidently answered"
    );
}

#[test]
fn replace_the_contract_and_migrate_the_chain() {
    let mut old = world(Profile::Specimen, T0);
    let wood = old
        .createf("authorgov", 1_000_000, "WOOD", true, "{}", &["authorgov"])
        .unwrap();
    old.issuef("bob", "authorgov", &qty("WOOD", 500), "", &["authorgov"])
        .unwrap();
    let id = old
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-keep",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    let ntt = old
        .createntt(
            "authorgov",
            "cap",
            "alice",
            "ntt-cmt",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    old.delegate("alice", "dave", &[id], 1, false, "", &["alice"])
        .unwrap();
    let bundle = old.export_state();
    let anchor = Chain::state_commitment(&bundle);

    // tampered: one sovereign flipped, refused
    let mut tampered = bundle.clone();
    tampered
        .assets
        .iter_mut()
        .find(|a| a.row.id == id)
        .unwrap()
        .sovereign = Some("mallory".into());
    let mut fresh = world(Profile::Adapter, T0);
    fresh
        .createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    assert_eq!(
        refused_with(&mut fresh, |f| f.import_state(&tampered, &anchor)),
        "bt-wb02:migration-anchor"
    );

    // TEETH: the naive unanchored importer accepts the forgery
    let mut naive = world(Profile::Adapter, T0);
    for a in &tampered.assets {
        let s = a.sovereign.clone().unwrap();
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
        naive.sovereign_of(id).as_deref(),
        Some("mallory"),
        "teeth stale"
    );

    // anchored migration: rights survive the network change
    let mut succ = world(Profile::Adapter, T0);
    succ.createf("authorgov", 1_000_000, "WOOD", false, "{}", &["authorgov"])
        .unwrap();
    succ.import_state(&bundle, &anchor).unwrap();
    assert_eq!(succ.sovereign_of(id).as_deref(), Some("alice"));
    assert_eq!(succ.sovereign_of(ntt).as_deref(), Some("alice"));
    assert_eq!(
        succ.row("dave", id).unwrap().owner,
        "dave",
        "the live delegation survived"
    );
    succ.now += 10;
    succ.transfer("dave", "alice", &[id], "", &["alice"])
        .unwrap();
    assert_eq!(succ.sovereign_of(id).as_deref(), Some("alice"));
    assert_eq!(
        refused_with(&mut succ, |s| s.transfer(
            "alice",
            "mallory",
            &[id],
            "",
            &["mallory"]
        )),
        "bt-wb002:auth"
    );
    succ.transfer("alice", "bob", &[id], "", &["alice"])
        .unwrap();
    assert_eq!(succ.sovereign_of(id).as_deref(), Some("bob"));
    let swood = succ.stat("authorgov", "WOOD").unwrap().id;
    assert_eq!((succ.bal("bob", swood), swood), (500, wood));
    assert_fold_equals_chain(&mut succ, "post-migration successor");
}

#[test]
fn the_marketplace_dies() {
    let mut c = world(Profile::Specimen, T0);
    let id = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    c.transfer("alice", "bob", &[id], "", &["alice"]).unwrap();
    c.offer("bob", "carol", &[id], "", &["bob"]).unwrap();
    c.claim("carol", &[id], &["carol"]).unwrap();
    c.burn("carol", &[id], &["carol"]).unwrap();
    assert_eq!(c.sovereign_of(id), None);
}
