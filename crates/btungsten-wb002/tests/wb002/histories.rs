//! Hostile histories under the killer invariant, both profiles; idata
//! immutability; the 1,000-year leg.

use crate::common::{assert_fold_equals_chain, refused_with, run_history, world, Collector, T0};
use btungsten_wb002::chain::{Profile, Row};

#[test]
fn idata_never_moves() {
    let mut c = world(Profile::Adapter, T0);
    let mut col = Collector::default();
    let spawn = run_history(&mut c, 300, 424_242, &mut col);
    assert!(
        col.named.is_empty(),
        "adapter history leaked sovereignty: {:?}",
        col.named
    );
    fn find(r: &Row, id: u64) -> Option<&Row> {
        if r.id == id {
            return Some(r);
        }
        r.container.iter().find_map(|k| find(k, id))
    }
    let mut checked = 0;
    for (id, idata) in &spawn {
        let row = c
            .scopes()
            .values()
            .flat_map(|m| m.values())
            .find_map(|r| find(r, *id))
            .map(|r| r.idata.clone());
        let ntt = c
            .ntt_scopes()
            .values()
            .find_map(|m| m.get(id))
            .map(|r| r.idata.clone());
        if let Some(cur) = row.or(ntt) {
            assert_eq!(&cur, idata, "asset {id} idata drifted after spawn");
            checked += 1;
        }
    }
    assert!(checked > 0);
}

#[test]
fn killer_invariant_adapter_600_steps_zero_unexplained() {
    let mut c = world(Profile::Adapter, T0);
    let mut col = Collector::default();
    run_history(&mut c, 600, 20_261_007, &mut col);
    assert!(
        col.probes > 10,
        "only {} wrong-signer probes fired",
        col.probes
    );
    assert!(
        col.named.is_empty(),
        "unexplained sovereignty changes: {:?}",
        col.named
    );
    assert_fold_equals_chain(&mut c, "adapter 600-step history");
    assert!(col.steps > 300 && col.rollbacks > 0, "{col:?}");
}

#[test]
fn specimen_every_violation_is_named_f1_family_only() {
    let mut c = world(Profile::Specimen, T0);
    let mut col = Collector::default();
    run_history(&mut c, 600, 20_261_007, &mut col);
    let f1 = ["F1:issuer-move", "F1:issuer-burn", "attachf(author)"];
    let unnamed: Vec<_> = col
        .named
        .iter()
        .filter(|(t, _)| !f1.contains(&t.as_str()))
        .collect();
    assert!(
        unnamed.is_empty(),
        "the specimen produced UNNAMED violations: {unnamed:?}"
    );
    assert!(
        col.named
            .iter()
            .any(|(t, _)| t == "F1:issuer-move" || t == "F1:issuer-burn"),
        "the F-1 seam was never exercised"
    );
    assert_fold_equals_chain(&mut c, "specimen 600-step history");
}

#[test]
fn the_millennium_leg() {
    const MILLENNIUM: u64 = 1_000 * 365 * 24 * 60 * 60;
    let mut c = world(Profile::Specimen, T0);
    let id = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-2019",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    c.delegate("alice", "dave", &[id], 3600, false, "", &["alice"])
        .unwrap();
    let id2 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-offer",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    c.offer("alice", "bob", &[id2], "", &["alice"]).unwrap();
    c.now += MILLENNIUM;
    // tenures are finite
    c.undelegate("alice", &[id], &["alice"]).unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("alice"));
    // F-4: the specimen's thousand-year-old offer still claims
    c.claim("bob", &[id2], &["bob"]).unwrap();
    assert_eq!(c.sovereign_of(id2).as_deref(), Some("bob"), "F-4 stale");
    let mut a = world(Profile::Adapter, T0);
    let id3 = a
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
    a.offer("alice", "bob", &[id3], "", &["alice"]).unwrap();
    a.now += MILLENNIUM;
    assert_eq!(
        refused_with(&mut a, |a| a.claim("bob", &[id3], &["bob"])),
        "bt-wb002:offer-expired"
    );
    assert!(c.lnftid() < 1u64 << 63, "asset counter improbably high");
    // a thousand-action history folds clean after a thousand years
    let mut m = world(Profile::Adapter, T0 + MILLENNIUM);
    let mut col = Collector::default();
    run_history(&mut m, 1000, 3019, &mut col);
    assert!(
        col.named.is_empty(),
        "millennium history leaked sovereignty: {:?}",
        col.named
    );
    assert_fold_equals_chain(&mut m, "millennium history");
}
