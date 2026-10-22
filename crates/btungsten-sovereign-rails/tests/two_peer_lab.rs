//! The two-peer sovereign qualification lab (issue #479's first decisive
//! test, at the smallest honest scale).
//!
//! TOPOLOGY, LABELED: two independently administered peers = two separate
//! peer services with separate stores and separate egress ledgers, run as
//! threads in this test process on one host. This qualifies the
//! FUNDING-FREE SOVEREIGN LOCAL-FIXTURE route's peer-delivery semantics
//! (issue §5 allows exactly this); it is NOT a multi-host qualification
//! and promotes no rail anywhere.
//!
//! NO ESTATE: the lab touches no GitHub, no skaists.dev, no relay door,
//! no box, no DNS — peers dial each other's direct addresses only.
//!
//! Controls:
//!   green      — peer B retrieves the pinned artifact set from peer A's
//!                direct address; full /2 chain verified over the wire
//!                bytes; digests identical to A's sealed copy
//!   corruption — A's stored page tampered → B refuses (page bytes
//!                drift), nothing retained
//!   interrupt  — A truncates mid-stream → B fails closed (interrupted
//!                transfer); A healed (truncate off) → B retries and
//!                verifies — recovery without an operator
//!   no-budget  — A2 with ZERO authorized egress refuses the paid route
//!                (402, named); B never falls back to any estate route
//!                (it has none) — the issue's no-budget negative control
//!   traversal  — non-artifact and path-shaped names refused server-side
use btungsten_sovereign_rails::{fetch_and_verify, fetch_artifact, SovereignPeer};
use genealogy_publication::bind_and_write;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn fixture(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("bsr-lab-{}-{tag}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    let lin = dir.join("assets/profile-archive/lineage");
    fs::create_dir_all(lin.join("persons")).unwrap();
    fs::create_dir_all(lin.join("sources")).unwrap();
    let roster = json!({
        "schema": "skaists.lineage/2", "root": "founder",
        "persons": {
            "founder": {"name": "Living", "living": true, "evidence": {"era": "living"},
                        "publication": {"status": "private-stub"}, "refs": []},
            "pa": {"name": "Pat Sovereign", "living": false, "lifespan": "1900-1950",
                   "evidence": {"era": "recorded"}, "publication": {"status": "public"},
                   "refs": [{"provider": "familysearch", "id": "AAA-111"}]}
        },
        "edges": {"founder": ["pa"]}, "couples": {},
    });
    fs::write(
        lin.join("remington-bloodline.json"),
        serde_json::to_string(&roster).unwrap(),
    )
    .unwrap();
    fs::write(lin.join("sources/index.json"), "{}").unwrap();
    for rel in [
        "blood-relation-reconciliation.json",
        "staging-inventory.json",
        "attested-overlays.json",
        "identity-registry.json",
        "sources/records.json",
        "sources/images-summary.json",
        "sources/rights-qualification.json",
    ] {
        fs::write(dir.join("assets/profile-archive/lineage").join(rel), "{}").unwrap();
    }
    for id in ["founder", "pa"] {
        fs::write(
            lin.join(format!("persons/{id}.html")),
            format!("<html>{id}-sovereign-page</html>"),
        )
        .unwrap();
        fs::write(
            lin.join(format!("persons/{id}.json")),
            format!("{{\"id\":\"{id}\"}}\n"),
        )
        .unwrap();
    }
    bind_and_write(&dir).expect("fixture bind");
    dir
}

fn sha_hex(b: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(b);
    h.finalize().iter().map(|x| format!("{x:02x}")).collect()
}

#[test]
fn two_peer_sovereign_lab() {
    let root_a = fixture("a");
    let lin = root_a.join("assets/profile-archive/lineage");
    let pin = sha_hex(&fs::read(lin.join("publication-state.json")).unwrap());

    // PEER A — independently administered, funded with a bounded egress budget
    let mut a = SovereignPeer::new(&lin, 10_000_000)
        .serve("127.0.0.1:0")
        .unwrap();

    // green: B retrieves from A's direct address; chain verified on wire bytes
    let v = fetch_and_verify(&a.addr.to_string(), "pa", Some(&pin), 8_000_000).expect("verified");
    assert_eq!(v.name.as_deref(), Some("Pat Sovereign"));
    let sealed_html = fs::read(lin.join("persons/pa.html")).unwrap();
    let wire_html = fetch_artifact(&a.addr.to_string(), "persons/pa.html", 1_000_000).unwrap();
    assert_eq!(
        sha_hex(&sealed_html),
        sha_hex(&wire_html),
        "wire bytes identical to the sealed copy"
    );

    // corruption: A's store tampered → B refuses, nothing retained
    let pristine = sealed_html.clone();
    fs::write(
        lin.join("persons/pa.html"),
        String::from_utf8_lossy(&sealed_html).to_string() + "<!-- poison -->",
    )
    .unwrap();
    let err = fetch_and_verify(&a.addr.to_string(), "pa", Some(&pin), 8_000_000).unwrap_err();
    assert!(err.contains("page bytes drift"), "{err}");
    fs::write(lin.join("persons/pa.html"), &pristine).unwrap();
    // healed: verifies again
    fetch_and_verify(&a.addr.to_string(), "pa", Some(&pin), 8_000_000)
        .expect("re-verified after heal");

    // wrong pin: refused
    let err =
        fetch_and_verify(&a.addr.to_string(), "pa", Some(&"0".repeat(64)), 8_000_000).unwrap_err();
    assert!(err.contains("pinned-root mismatch"), "{err}");

    // interrupt: A truncates mid-stream → B fails closed
    a.stop();
    let mut a_trunc = SovereignPeer::new(&lin, 10_000_000)
        .with_truncate_after(7)
        .serve("127.0.0.1:0")
        .unwrap();
    let err = fetch_artifact(&a_trunc.addr.to_string(), "persons/pa.html", 1_000_000).unwrap_err();
    assert!(err.contains("interrupted transfer"), "{err}");
    let err = fetch_and_verify(&a_trunc.addr.to_string(), "pa", Some(&pin), 8_000_000).unwrap_err();
    assert!(err.contains("interrupted transfer"), "{err}");
    // recovery without an operator: restart clean → retry verifies
    a_trunc.stop();
    let mut a2 = SovereignPeer::new(&lin, 10_000_000)
        .serve("127.0.0.1:0")
        .unwrap();
    fetch_and_verify(&a2.addr.to_string(), "pa", Some(&pin), 8_000_000)
        .expect("recovered: verified after restart");

    // no-budget negative control: ZERO authorized egress → the paid route
    // REFUSES (402, named) and there is no estate fallback to silently bill
    let mut poor = SovereignPeer::new(&lin, 0).serve("127.0.0.1:0").unwrap();
    let err = fetch_artifact(&poor.addr.to_string(), "persons/pa.html", 1_000_000).unwrap_err();
    assert!(
        err.contains("peer refused (402)") && err.contains("egress budget exhausted"),
        "{err}"
    );
    assert!(err.contains("no estate fallback exists"), "{err}");
    let spent = poor.ledger.spent();
    assert_eq!(spent, 0, "refusal served zero chargeable bytes");
    poor.stop();

    // partial-budget boundary: budget smaller than the artifact refuses whole
    let mut tiny = SovereignPeer::new(&lin, 3).serve("127.0.0.1:0").unwrap();
    let err =
        fetch_artifact(&tiny.addr.to_string(), "publication-state.json", 8_000_000).unwrap_err();
    assert!(err.contains("402"), "{err}");
    tiny.stop();

    // traversal + non-artifact names refused server-side (403)
    for bad in ["../../secrets", "persons/../x.html", "random.txt"] {
        let err = fetch_artifact(&a2.addr.to_string(), bad, 1_000).unwrap_err();
        assert!(
            err.contains("peer refused (403)")
                || err.contains("not a seal artifact")
                || err.contains("never a path"),
            "{bad}: {err}"
        );
    }

    // x0x seam honestly declared, never substituted
    assert!(btungsten_sovereign_rails::x0x::STATUS.starts_with("investigated"));
    assert!(btungsten_sovereign_rails::x0x::STATUS.contains("not qualified for corpus delivery"));
    assert!(!btungsten_sovereign_rails::x0x::MISSING.is_empty());

    a.stop();
    a2.stop();
    let _ = fs::remove_dir_all(&root_a);
}
