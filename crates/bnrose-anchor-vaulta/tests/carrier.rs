//! The carrier, offline: what a chain answer becomes, and that any doubt is
//! fail-closed. Plus its authority: reads only, no key, no push.

use std::path::Path;

use bnrose_anchor_vaulta::{
    agree, anchor_action, check_chain, parse_rows, table_request, JUNGLE4_CHAIN_ID,
};
use bnrose_evolve::digest::hash;
use bnrose_evolve::{AnchorLookup, AnchorStatement};
use serde_json::{json, Value};

const SUBJECT: &str = "evolve.ctr1";
const CONTRACT: &str = "bnrevanchor1";

fn statement(count: u64) -> AnchorStatement {
    AnchorStatement {
        subject: SUBJECT.into(),
        count,
        head: hash("carrier/head", &[&count.to_be_bytes()]),
        promote: Some(hash("carrier/promote", &[b"p"])),
        policy: Some(hash("carrier/policy", &[b"q"])),
    }
}

/// The row as nodeos renders it: `bytes` as hex, the action's data otherwise.
fn row_of(s: &AnchorStatement) -> Value {
    let a = anchor_action(CONTRACT, "bnrpublisher", s);
    let d = &a["data"];
    json!({
        "subject": d["subject"],
        "publisher": d["publisher"],
        "count": d["count"],
        "seq": 1,
        "statement": d["statement"],
        "at": "2026-10-15T12:00:00",
    })
}

fn rows(r: Vec<Value>) -> Value {
    json!({"rows": r, "more": false, "next_key": ""})
}

#[test]
fn the_unsigned_action_carries_the_statement_and_nothing_else() {
    let s = statement(9);
    let a = anchor_action(CONTRACT, "bnrpublisher", &s);
    assert_eq!(a["account"], CONTRACT);
    assert_eq!(a["name"], "anchor");
    assert_eq!(a["authorization"][0]["actor"], "bnrpublisher");
    assert_eq!(a["data"]["subject"], SUBJECT);
    assert_eq!(a["data"]["count"], 9);
    assert!(a.get("signatures").is_none(), "unsigned");
    // what the chain stores parses back to the same statement
    assert_eq!(
        parse_rows(&rows(vec![row_of(&s)]), SUBJECT),
        Ok(Some(s.clone()))
    );
    // the same statement, the same bytes: a rebroadcast is identical
    assert_eq!(a, anchor_action(CONTRACT, "bnrpublisher", &s));
    let q = table_request(CONTRACT, SUBJECT);
    assert_eq!(q["table"], "anchors");
    assert_eq!(q["lower_bound"], SUBJECT);
    assert_eq!(q["upper_bound"], SUBJECT);
}

#[test]
fn a_row_that_does_not_carry_its_statement_is_refused() {
    let s = statement(9);
    assert_eq!(parse_rows(&rows(vec![]), SUBJECT), Ok(None), "no row");

    let mut wrong_count = row_of(&s);
    wrong_count["count"] = json!(10);
    assert!(parse_rows(&rows(vec![wrong_count]), SUBJECT).is_err());

    let mut not_hex = row_of(&s);
    not_hex["statement"] = json!("zz");
    assert!(parse_rows(&rows(vec![not_hex]), SUBJECT).is_err());

    let mut corrupt = row_of(&s);
    let h = corrupt["statement"].as_str().unwrap().to_string();
    corrupt["statement"] = json!(format!("{h}00"));
    assert!(
        parse_rows(&rows(vec![corrupt]), SUBJECT).is_err(),
        "trailing byte"
    );

    let mut other = statement(9);
    other.subject = "evolve.ctr2".into();
    let mut swapped = row_of(&s);
    swapped["statement"] = row_of(&other)["statement"].clone();
    assert!(
        parse_rows(&rows(vec![swapped]), SUBJECT).is_err(),
        "a row holding another subject's statement"
    );

    assert!(parse_rows(&rows(vec![row_of(&s), row_of(&s)]), SUBJECT).is_err());
    assert!(parse_rows(&json!({"error": "no table"}), SUBJECT).is_err());
}

#[test]
fn only_a_wrong_chain_is_refused_by_the_chain_check() {
    assert_eq!(
        check_chain(&json!({"chain_id": JUNGLE4_CHAIN_ID}), JUNGLE4_CHAIN_ID),
        Ok(())
    );
    let other = "0".repeat(64);
    assert!(check_chain(&json!({"chain_id": other}), JUNGLE4_CHAIN_ID).is_err());
    assert!(check_chain(&json!({}), JUNGLE4_CHAIN_ID).is_err());
}

#[test]
fn endpoints_must_all_answer_and_all_agree() {
    let a = statement(9);
    let b = statement(10);
    assert_eq!(
        agree(vec![Ok(Some(a.clone())), Ok(Some(a.clone()))]),
        AnchorLookup::Anchored(a.clone())
    );
    assert_eq!(agree(vec![Ok(None), Ok(None)]), AnchorLookup::NeverAnchored);
    for split in [
        vec![Ok(Some(a.clone())), Ok(Some(b.clone()))],
        vec![Ok(Some(a.clone())), Ok(None)],
        vec![Ok(None), Ok(Some(a.clone()))],
    ] {
        assert!(
            matches!(agree(split), AnchorLookup::Unreachable(e) if e.contains("disagrees")),
            "a split answer fails closed"
        );
    }
    assert!(matches!(
        agree(vec![Ok(Some(a.clone())), Err("timeout".into())]),
        AnchorLookup::Unreachable(_)
    ));
    assert!(matches!(agree(vec![]), AnchorLookup::Unreachable(_)));
}

#[test]
fn the_carrier_reads_and_never_signs() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let manifest = std::fs::read_to_string(root.join("Cargo.toml")).unwrap();
    let mut deps = Vec::new();
    let mut in_deps = false;
    for line in manifest.lines() {
        let t = line.trim();
        if t.starts_with('[') {
            in_deps = t == "[dependencies]";
            continue;
        }
        if in_deps && !t.is_empty() && !t.starts_with('#') {
            deps.push(t.split(['=', ' ']).next().unwrap().to_string());
        }
    }
    deps.sort();
    assert_eq!(deps, vec!["bnrose-evolve", "serde_json", "ureq"]);
    let forbidden = [
        "SigningKey",
        "try_sign",
        "private_key",
        "PrivateKey",
        "push_transaction",
        "send_transaction",
        "push_action",
        "wallet/",
    ];
    let mut stack = vec![root.join("src")];
    let mut n = 0;
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(d).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                stack.push(p);
                continue;
            }
            n += 1;
            let text = std::fs::read_to_string(&p).unwrap();
            for w in forbidden {
                assert!(!text.contains(w), "{} names {w}", p.display());
            }
        }
    }
    assert!(n >= 2);
}

/// LIVE, opt-in (`--ignored`): read the subject from Jungle4 on two
/// independent endpoints, and ask a Vaulta MAINNET endpoint while pinning
/// Jungle4's chain id. Reads only. Prints what each lookup was; asserts only
/// that a wrong chain is never read as an answer.
#[test]
#[ignore = "live read of Jungle4; waits on the evanchor contract being deployed and anchored by the signer lane"]
fn live_jungle4_read() {
    let jungle = [
        "https://jungle4.greymass.com",
        "https://jungle4.api.eosnation.io",
    ];
    let l = bnrose_anchor_vaulta::latest(&jungle, JUNGLE4_CHAIN_ID, CONTRACT, SUBJECT);
    println!("jungle4 x2, {CONTRACT}/{SUBJECT}: {l:?}");
    let m = bnrose_anchor_vaulta::latest(
        &["https://vaulta.greymass.com"],
        JUNGLE4_CHAIN_ID,
        CONTRACT,
        SUBJECT,
    );
    println!("mainnet endpoint, jungle4 chain id pinned: {m:?}");
    assert!(
        matches!(&m, AnchorLookup::Unreachable(e) if e.contains("not 73e4")),
        "a mainnet answer is never read as Jungle4's: {m:?}"
    );
}
