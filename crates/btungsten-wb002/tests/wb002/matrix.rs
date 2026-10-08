//! Wrong-signer matrix: every authority seam refuses the wrong hand, both
//! profiles, and every refusal rolls back whole.

use crate::common::{refused_with, world, T0};
use btungsten_wb002::chain::{qty, Chain, Profile, R};

struct F {
    id1: u64,
    id2: u64,
    ntt1: u64,
    ntt_offered: u64,
}

fn fixture(profile: Profile) -> (Chain, F) {
    let mut c = world(profile, T0);
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
    let ntt1 = c
        .createntt(
            "authorgov",
            "cap",
            "alice",
            "n1",
            "{}",
            false,
            &["authorgov"],
        )
        .unwrap();
    let ntt_offered = c
        .createntt(
            "authorgov",
            "cap",
            "bob",
            "n-offered",
            "{}",
            true,
            &["authorgov"],
        )
        .unwrap();
    c.createf(
        "authorgov",
        10_000,
        "WOOD",
        profile == Profile::Specimen,
        "{}",
        &["authorgov"],
    )
    .unwrap();
    c.issuef("bob", "authorgov", &qty("WOOD", 100), "", &["authorgov"])
        .unwrap();
    (
        c,
        F {
            id1,
            id2,
            ntt1,
            ntt_offered,
        },
    )
}

type Run = fn(&mut Chain, &F) -> R<()>;

#[test]
fn every_authority_seam_refuses_the_wrong_hand() {
    let rows: Vec<(&str, &str, Option<Profile>, Run)> = vec![
        ("transfer by a stranger", "bt-wb002:auth", None, |c, f| {
            c.transfer("alice", "bob", &[f.id1], "", &["mallory"])
        }),
        ("transfer by the receiver", "bt-wb002:auth", None, |c, f| {
            c.transfer("alice", "bob", &[f.id1], "", &["bob"])
        }),
        ("transfer by the author", "bt-wb002:auth", None, |c, f| {
            c.transfer("alice", "bob", &[f.id1], "", &["authorgov"])
        }),
        ("transfer by nobody", "bt-wb002:auth", None, |c, f| {
            c.transfer("alice", "bob", &[f.id1], "", &[])
        }),
        (
            "transfer from a scope you do not hold",
            "bt-wb002:not-found",
            None,
            |c, f| c.transfer("bob", "carol", &[f.id1], "", &["bob"]),
        ),
        ("claim by a stranger", "bt-wb002:auth", None, |c, f| {
            c.offer("alice", "bob", &[f.id2], "", &["alice"])?;
            c.claim("bob", &[f.id2], &["carol"])
        }),
        (
            "claim by the wrong offeree",
            "bt-wb002:not-offered-to",
            None,
            |c, f| {
                c.offer("alice", "bob", &[f.id2], "", &["alice"])?;
                c.claim("carol", &[f.id2], &["carol"])
            },
        ),
        ("offer by a stranger", "bt-wb002:auth", None, |c, f| {
            c.offer("alice", "carol", &[f.id1], "", &["mallory"])
        }),
        (
            "canceloffer by the offeree",
            "bt-wb002:not-owner",
            None,
            |c, f| {
                c.offer("alice", "bob", &[f.id2], "", &["alice"])?;
                c.canceloffer("bob", &[f.id2], &["bob"])
            },
        ),
        ("burn by a stranger", "bt-wb002:auth", None, |c, f| {
            c.burn("alice", &[f.id1], &["mallory"])
        }),
        ("burn by the author", "bt-wb002:auth", None, |c, f| {
            c.burn("alice", &[f.id1], &["authorgov"])
        }),
        ("burn an offered asset", "bt-wb002:offered", None, |c, f| {
            c.offer("alice", "bob", &[f.id2], "", &["alice"])?;
            c.burn("alice", &[f.id2], &["alice"])
        }),
        ("delegate by a stranger", "bt-wb002:auth", None, |c, f| {
            c.delegate("alice", "dave", &[f.id1], 100, false, "", &["mallory"])
        }),
        (
            "undelegate by the borrower",
            "bt-wb002:not-owner",
            None,
            |c, f| {
                c.delegate("alice", "dave", &[f.id1], 1, false, "", &["alice"])?;
                c.now += 10;
                c.undelegate("dave", &[f.id1], &["dave"])
            },
        ),
        (
            "undelegate before expiry (the sovereign too)",
            "bt-wb002:period",
            None,
            |c, f| {
                c.delegate("alice", "dave", &[f.id1], 100_000, false, "", &["alice"])?;
                c.undelegate("alice", &[f.id1], &["alice"])
            },
        ),
        (
            "borrower routes a delegated asset onward",
            "bt-wb002:delegated",
            None,
            |c, f| {
                c.delegate("alice", "dave", &[f.id1], 1, false, "", &["alice"])?;
                c.transfer("dave", "ed", &[f.id1], "", &["dave"])
            },
        ),
        (
            "forbidden re-delegation",
            "bt-wb002:no-redelegate",
            None,
            |c, f| {
                c.delegate("alice", "dave", &[f.id1], 1, false, "", &["alice"])?;
                c.delegate("dave", "ed", &[f.id1], 1, true, "", &["dave"])
            },
        ),
        ("update by the owner", "bt-wb002:auth", None, |c, f| {
            c.update("authorgov", "alice", f.id1, "x", &["alice"])
        }),
        (
            "burn an NTT by a stranger",
            "bt-wb02:not-found",
            None,
            |c, f| c.burnntt("carol", &[f.ntt1], &["carol"]),
        ),
        (
            "claim an NTT by the wrong subject",
            "bt-wb002:not-offered-to",
            None,
            |c, f| {
                c.createntt("authorgov", "cap", "bob", "n2", "{}", true, &["authorgov"])?;
                c.claimntt("carol", &[f.ntt_offered], &["carol"])
            },
        ),
        (
            "FT transfer by a stranger",
            "bt-wb002:auth",
            None,
            |c, _| {
                c.transferf(
                    "bob",
                    "carol",
                    "authorgov",
                    &qty("WOOD", 1),
                    "",
                    &["mallory"],
                )
            },
        ),
        (
            "FT transfer by the receiver",
            "bt-wb002:auth",
            None,
            |c, _| c.transferf("bob", "carol", "authorgov", &qty("WOOD", 1), "", &["carol"]),
        ),
        ("FT offer by a stranger", "bt-wb002:auth", None, |c, _| {
            c.offerf(
                "bob",
                "carol",
                "authorgov",
                &qty("WOOD", 1),
                "",
                &["mallory"],
            )
        }),
        (
            "setarampayer by a stranger",
            "bt-wb002:auth",
            None,
            |c, _| c.setarampayer("authorgov", "cred", true, &["mallory"]),
        ),
        (
            "attach by the sovereign — specimen refuses (F-3)",
            "bt-wb002:auth",
            Some(Profile::Specimen),
            |c, f| c.attach("alice", f.id1, &[f.id2], &["alice"]),
        ),
        (
            "attach by the author — adapter refuses (F-3)",
            "bt-wb002:auth",
            Some(Profile::Adapter),
            |c, f| c.attach("alice", f.id1, &[f.id2], &["authorgov"]),
        ),
        (
            "detach by the holder — specimen refuses (F-3)",
            "bt-wb002:auth",
            Some(Profile::Specimen),
            |c, f| {
                c.attach("alice", f.id1, &[f.id2], &["authorgov"])?;
                c.detach("alice", f.id1, &[f.id2], &["alice"])
            },
        ),
        (
            "changeauthor without the sovereign — adapter refuses (F-8)",
            "bt-wb002:auth",
            Some(Profile::Adapter),
            |c, f| {
                c.changeauthor(
                    "authorgov",
                    "authorx",
                    "alice",
                    &[f.id1],
                    "",
                    &["authorgov"],
                )
            },
        ),
        (
            "createf with authorctrl — adapter refuses (F-1 ruling)",
            "bt-wb02:adapter-authorctrl",
            Some(Profile::Adapter),
            |c, _| {
                c.createf("authorgov", 100, "BAD", true, "{}", &["authorgov"])
                    .map(|_| ())
            },
        ),
    ];
    let (mut refused_specimen, mut refused_adapter) = (0, 0);
    for (name, code, only, run) in &rows {
        for profile in [Profile::Specimen, Profile::Adapter] {
            if only.is_some_and(|p| p != profile) {
                continue;
            }
            let (mut c, f) = fixture(profile);
            // setup ops and the refusing tail ride one transaction
            let got = refused_with(&mut c, |c| c.tx(|c| run(c, &f)));
            assert_eq!(got, *code, "[{profile:?}] {name}: got {got}");
            if profile == Profile::Specimen {
                refused_specimen += 1;
            } else {
                refused_adapter += 1;
            }
        }
    }
    assert_eq!((refused_specimen, refused_adapter), (26, 27));

    // F-1 convictions: on the specimen the issuer's signature ALONE confiscates
    let (mut s, _) = fixture(Profile::Specimen);
    let wood = s.stat("authorgov", "WOOD").unwrap().id;
    s.transferf(
        "bob",
        "carol",
        "authorgov",
        &qty("WOOD", 40),
        "",
        &["authorgov"],
    )
    .unwrap();
    assert_eq!(
        s.bal("bob", wood),
        60,
        "F-1 control: the issuer move did not confiscate, teeth stale"
    );
    s.burnf("bob", "authorgov", &qty("WOOD", 10), "", &["authorgov"])
        .unwrap();
    assert_eq!(
        s.bal("bob", wood),
        50,
        "F-1 control: the issuer burn did not confiscate, teeth stale"
    );
    // the same gesture on the adapter refuses
    let (mut a, _) = fixture(Profile::Adapter);
    let wood_a = a.stat("authorgov", "WOOD").unwrap().id;
    refused_with(&mut a, |a| {
        a.transferf(
            "bob",
            "carol",
            "authorgov",
            &qty("WOOD", 40),
            "",
            &["authorgov"],
        )
    });
    assert_eq!(
        a.bal("bob", wood_a),
        100,
        "adapter: an issuer signature moved a holder balance"
    );
}
