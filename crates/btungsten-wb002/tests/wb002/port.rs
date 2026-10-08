//! The port is faithful: upstream behaviors and quirks reproduce.

use crate::common::{refused_with, world, T0};
use btungsten_wb002::chain::Profile;

#[test]
fn upstream_behaviors_and_quirks_reproduce() {
    let mut c = world(Profile::Specimen, T0);
    let id = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-A",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("alice"));

    // offer -> claim is consent-gated (SA.cpp:335, 142)
    c.offer("alice", "bob", &[id], "", &["alice"]).unwrap();
    assert_eq!(
        c.sovereign_of(id).as_deref(),
        Some("alice"),
        "an open offer transfers nothing"
    );
    refused_with(&mut c, |c| c.claim("carol", &[id], &["carol"]));
    c.claim("bob", &[id], &["bob"]).unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("bob"));

    // delegated possession vs sovereign (SA.cpp:439)
    c.delegate("bob", "dave", &[id], 10_000_000, false, "", &["bob"])
        .unwrap();
    assert_eq!(
        c.row("dave", id).unwrap().owner,
        "dave",
        "the borrower holds the row"
    );
    assert_eq!(
        c.sovereign_of(id).as_deref(),
        Some("bob"),
        "the lender keeps sovereignty"
    );
    assert_eq!(
        refused_with(&mut c, |c| c.transfer("dave", "ed", &[id], "", &["dave"])),
        "bt-wb002:delegated"
    );
    c.transfer("dave", "bob", &[id], "", &["dave"]).unwrap(); // the borrower hands it back any time
    assert_eq!(c.sovereign_of(id).as_deref(), Some("bob"));

    // undelegate honors the period (SA.cpp:514)
    c.delegate("bob", "dave", &[id], 10_000_000, false, "", &["bob"])
        .unwrap();
    assert_eq!(
        refused_with(&mut c, |c| c.undelegate("bob", &[id], &["bob"])),
        "bt-wb002:period"
    );
    c.now += 10_000_001;
    c.undelegate("bob", &[id], &["bob"]).unwrap();
    assert_eq!(c.sovereign_of(id).as_deref(), Some("bob"));

    // NTTs have no transfer path at all
    let ntt = c
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
    assert_eq!(
        refused_with(&mut c, |c| c.transfer(
            "alice",
            "bob",
            &[ntt],
            "",
            &["alice"]
        )),
        "bt-wb002:not-found"
    );

    // receiver-pays RAM never means receiver authorizes (SA.cpp:233, 264)
    let id2 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-B",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    assert_eq!(
        refused_with(&mut c, |c| c.transfer("alice", "bob", &[id2], "", &["bob"])),
        "bt-wb002:auth"
    );
    c.transfer("alice", "bob", &[id2], "", &["alice", "bob"])
        .unwrap();

    // author RAM sponsorship: the payer is never an owner (SA.cpp:302)
    c.setarampayer("authorgov", "cred", true, &["authorgov"])
        .unwrap();
    let id3 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-C",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    assert_eq!(
        c.ram_payer_of(id3),
        Some("authorgov"),
        "the author sponsored the row"
    );
    assert_eq!(
        c.sovereign_of(id3).as_deref(),
        Some("alice"),
        "sponsorship granted no authority"
    );
    let id4 = c
        .create(
            "authorgov",
            "cred",
            "alice",
            "cmt-D",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    c.transfer("alice", "bob", &[id4], "", &["alice"]).unwrap();
    assert_eq!(c.sovereign_of(id4).as_deref(), Some("bob"));
    assert_eq!(
        refused_with(&mut c, |c| c.burn("authorgov", &[id4], &["authorgov"])),
        "bt-wb002:not-found",
        "the payer cannot even reach the asset"
    );
}
