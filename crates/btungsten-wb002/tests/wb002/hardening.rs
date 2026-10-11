//! Model hardening (founder review 2026-10-07): R-1 the transaction
//! boundary, R-2 content-authenticated display truth.

use crate::common::{refused_with, world, T0};
use btungsten_wb002::chain::{qty, Chain, CheckpointAnchor, Profile, R};
use btungsten_wb002::lattice::{reconstruct, AdapterUI, Indexer, Scope, DISPUTED};
use btungsten_wb002::log::Val;

const BOTH: [Profile; 2] = [Profile::Specimen, Profile::Adapter];

#[test]
fn r1_control_a_refusal_before_any_mutation_changes_nothing() {
    for p in BOTH {
        let mut c = world(p, T0);
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
        assert_eq!(
            refused_with(&mut c, |c| c.transfer(
                "alice",
                "bob",
                &[id],
                "",
                &["mallory"]
            )),
            "bt-wb002:auth"
        );
    }
}

#[test]
fn r1_a_rejected_return_to_lender_does_not_consume_the_delegation() {
    for p in BOTH {
        let mut c = world(p, T0);
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
        c.delegate("alice", "dave", &[id], 10_000_000, false, "", &["alice"])
            .unwrap();
        assert_eq!(
            refused_with(&mut c, |c| c.transfer(
                "dave",
                "alice",
                &[id],
                "",
                &["mallory"]
            )),
            "bt-wb002:auth"
        );
        assert_eq!(c.sovereign_of(id).as_deref(), Some("alice"));
        assert!(
            c.delegates().contains_key(&id),
            "[{p:?}] the rejected transfer consumed the delegation record"
        );
    }
}

#[test]
fn r1_a_partial_batch_is_all_or_nothing() {
    for p in BOTH {
        let mut c = world(p, T0);
        let good = c
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
        c.create(
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
            refused_with(&mut c, |c| c.transfer(
                "alice",
                "bob",
                &[good, 999_999_999_999_999],
                "",
                &["alice"]
            )),
            "bt-wb002:not-found"
        );
        assert_eq!(
            c.sovereign_of(good).as_deref(),
            Some("alice"),
            "[{p:?}] the first asset of a refused batch moved"
        );
    }
}

#[test]
fn r1_every_refusing_seam_preserves_the_whole_pre_state() {
    type Row = fn(&mut Chain, u64, u64) -> R<()>;
    let rows: [Row; 10] = [
        |c, a, _| c.transfer("alice", "bob", &[a], "", &["mallory"]),
        |c, a, _| c.transfer("alice", "bob", &[a], "", &["bob"]),
        |c, a, _| c.burn("alice", &[a], &["authorgov"]),
        |c, a, _| c.delegate("alice", "dave", &[a], 100, false, "", &["mallory"]),
        |c, a, _| c.update("authorgov", "alice", a, "x", &["alice"]),
        |c, _, _| {
            c.offerf(
                "bob",
                "carol",
                "authorgov",
                &qty("WOOD", 1),
                "",
                &["mallory"],
            )
        },
        |c, _, _| c.transferf("bob", "carol", "authorgov", &qty("WOOD", 1), "", &["carol"]),
        |c, _, _| c.setarampayer("authorgov", "cred", true, &["mallory"]),
        |c, a, b| c.attach("alice", a, &[b], &["mallory"]),
        |c, a, _| c.changeauthor("authorgov", "authorx", "alice", &[a], "", &["alice"]),
    ];
    let mut refused = 0;
    for p in BOTH {
        for row in rows {
            let mut c = world(p, T0);
            let id1 = c
                .create(
                    "authorgov",
                    "cred",
                    "alice",
                    "c1",
                    "{}",
                    false,
                    &["authorgov"],
                )
                .unwrap();
            let id2 = c
                .create(
                    "authorgov",
                    "cred",
                    "alice",
                    "c2",
                    "{}",
                    false,
                    &["authorgov"],
                )
                .unwrap();
            c.createf(
                "authorgov",
                10_000,
                "WOOD",
                p == Profile::Specimen,
                "{}",
                &["authorgov"],
            )
            .unwrap();
            c.issuef("bob", "authorgov", &qty("WOOD", 100), "", &["authorgov"])
                .unwrap();
            let code = refused_with(&mut c, |c| row(c, id1, id2));
            assert!(code.starts_with("bt-wb0"), "row refused with {code}");
            refused += 1;
        }
    }
    assert_eq!(refused, 20);
}

#[test]
fn r1_multi_action_bundles_are_atomic() {
    let mut c = world(Profile::Adapter, T0);
    let id1 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "c1",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    let id2 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "c2",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    refused_with(&mut c, |c| {
        c.tx(|c| {
            c.transfer("alice", "bob", &[id1], "", &["alice"])?;
            c.burn("alice", &[id2], &["mallory"])
        })
    });
    assert_eq!(
        c.sovereign_of(id1).as_deref(),
        Some("alice"),
        "the bundle prefix leaked"
    );
    c.tx(|c| {
        c.transfer("alice", "bob", &[id1], "", &["alice"])?;
        c.transfer("bob", "carol", &[id1], "", &["bob"])
    })
    .unwrap();
    assert_eq!(c.sovereign_of(id1).as_deref(), Some("carol"));
}

/// A lattice world with one anchored checkpoint and a QUIESCENT victim:
/// created before the checkpoint, never moved after it.
fn lattice_world() -> (Chain, u64, u64) {
    let mut c = world(Profile::Specimen, T0);
    let targets = ["bob", "carol", "dave", "ed"];
    let victim = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-0",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    for i in 1..3 {
        c.create(
            "authorgov",
            "cred",
            "alice",
            &format!("cmt-{i}"),
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    }
    let mut i = 0;
    while c.checkpoint_anchor().is_none() {
        let id = c
            .create(
                "authorgov",
                "cred",
                "alice",
                &format!("cmt-suffix-{i}"),
                "{}",
                false,
                &["authorgov"],
            )
            .unwrap();
        let t = targets[i % targets.len()];
        c.transfer("alice", t, &[id], "", &["alice"]).unwrap();
        c.transfer(t, "alice", &[id], "", &[t]).unwrap();
        i += 1;
    }
    let cp = c.checkpoint_anchor().unwrap().seq;
    let tail = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-tail",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    c.transfer("alice", "bob", &[tail], "", &["alice"]).unwrap();
    (c, cp, victim)
}

#[test]
fn r2_control_honest_streams_display_the_truth() {
    let (mut c, cp, victim) = lattice_world();
    let truth = c.sovereign_of(victim);
    let anchor = c.checkpoint_anchor();
    let mut honest = Indexer::default();
    honest.feed(&c.log);
    let mut frag = Indexer::default();
    frag.feed(&c.log[cp as usize..]);
    for ix in [&honest, &frag] {
        let r = AdapterUI {
            indexer: ix,
            checkpoint: anchor.clone(),
            tip: None,
        }
        .display(victim);
        assert_eq!(
            (r.owner, r.scope, r.as_of_seq),
            (Some(truth.clone()), Scope::CheckpointScoped, Some(cp))
        );
    }
    let wt = AdapterUI {
        indexer: &honest,
        checkpoint: anchor,
        tip: c.tip_anchor(),
    }
    .display(victim);
    assert_eq!((wt.owner, wt.scope), (Some(truth), Scope::AuthenticatedTip));
}

#[test]
fn r2_a_substituted_checkpoint_body_is_not_believed() {
    let (c, cp, victim) = lattice_world();
    let anchor = c.checkpoint_anchor();
    let mut tampered = c.log[cp as usize..].to_vec();
    let Some(Val::Arr(assets)) = tampered[0].fields.get_mut("assets") else {
        panic!("checkpoint assets")
    };
    let row = assets
        .iter_mut()
        .find(|a| matches!(a, Val::Arr(t) if t[0].as_int() == Some(victim as u128)))
        .expect("victim in the checkpoint");
    if let Val::Arr(t) = row {
        t[1] = Val::from("mallory");
    }
    for tip in [None, c.tip_anchor()] {
        let mut ix = Indexer::default();
        ix.feed(&tampered);
        let r = AdapterUI {
            indexer: &ix,
            checkpoint: anchor.clone(),
            tip,
        }
        .display(victim);
        assert_eq!(
            r.scope,
            Scope::Disputed,
            "a substituted checkpoint body was believed"
        );
    }
}

#[test]
fn r2_an_unconfirmed_extension_is_never_promoted() {
    let (mut c, _cp, victim) = lattice_world();
    let truth = c.sovereign_of(victim);
    let anchor = c.checkpoint_anchor();
    let mut forged = c.log.clone();
    let prev = forged.last().unwrap().root.clone();
    let mut ev = forged.last().unwrap().clone();
    ev.seq += 1;
    ev.fields = btungsten_wb002::fields![
        ("type", "move"),
        ("assetid", victim),
        ("from", truth.clone()),
        ("to", "mallory"),
        ("via", "transfer")
    ];
    ev.root = ev.root_over(&prev);
    forged.push(ev);
    let mut ix = Indexer::default();
    ix.feed(&forged);
    let r = AdapterUI {
        indexer: &ix,
        checkpoint: anchor.clone(),
        tip: None,
    }
    .display(victim);
    assert_eq!(
        (r.owner, r.scope),
        (Some(truth.clone()), Scope::CheckpointScoped)
    );
    let r2 = AdapterUI {
        indexer: &ix,
        checkpoint: anchor,
        tip: c.tip_anchor(),
    }
    .display(victim);
    assert_eq!((r2.owner, r2.scope), (Some(truth), Scope::CheckpointScoped));
}

#[test]
fn r2_a_lagging_stream_answers_at_its_authenticated_height() {
    let (c, cp, victim) = lattice_world();
    let anchor = c.checkpoint_anchor();
    let k = ((cp as usize + 1) + c.log.len()) / 2;
    let mut ix = Indexer::default();
    ix.feed(&c.log[..k]);
    let r = AdapterUI {
        indexer: &ix,
        checkpoint: anchor.clone(),
        tip: None,
    }
    .display(victim);
    let at_cp: Vec<_> = c.log.iter().filter(|e| e.seq <= cp).cloned().collect();
    assert_eq!(
        (r.scope, r.owner),
        (
            Scope::CheckpointScoped,
            Some(reconstruct(&at_cp).sovereign(victim))
        )
    );
    let mut short = Indexer::default();
    short.feed(&c.log[..cp as usize]);
    assert_eq!(
        AdapterUI {
            indexer: &short,
            checkpoint: anchor,
            tip: None
        }
        .display_owner(victim)
        .as_deref(),
        Some(DISPUTED)
    );
}

#[test]
fn r2_a_root_only_anchor_fails_closed() {
    let (c, cp, victim) = lattice_world();
    let mut ix = Indexer::default();
    ix.feed(&c.log);
    let root_only = CheckpointAnchor {
        seq: cp,
        root: c.log[cp as usize].root.clone(),
        parent_root: String::new(),
    };
    assert_eq!(
        AdapterUI {
            indexer: &ix,
            checkpoint: Some(root_only),
            tip: None
        }
        .display_owner(victim)
        .as_deref(),
        Some(DISPUTED)
    );
}
