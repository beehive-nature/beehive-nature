//! The model against a live Antelope node, replayed from the public receipt
//! `docs/receipts/sovexec-002/receipt-authority-live.json` written by
//! `scripts/sovexec/authority-live/probe.mjs` (Jungle4, both endpoints asked).
//!
//! The receipt holds the chain's own answers: `get_required_keys` per case
//! (the required subset of the offered PUBLIC keys, or the refusal), the
//! `get_account` permissions the world is rebuilt from, and the push rows
//! that exercise the minimum-permission gate through real transactions.
//! Every row must agree with the model; a disagreement is a model defect to
//! fix with a corpus vector, never a row to weaken. A missing receipt is a
//! failure, not a skip.

use antelope_authority::world::active_name;
use antelope_authority::*;
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::PathBuf;

fn receipt() -> Value {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("docs")
        .join("receipts")
        .join("sovexec-002")
        .join("receipt-authority-live.json");
    let text = std::fs::read_to_string(&p)
        .unwrap_or_else(|e| panic!("the live receipt is missing ({}): {e}", p.display()));
    serde_json::from_str(&text).expect("the receipt parses")
}

fn s(v: &Value) -> &str {
    v.as_str().expect("string")
}

/// `get_account`'s `required_auth` into the model's authority. Keys are
/// sorted by their text (MODEL ORDER); the chain lists them in its binary
/// order, and the two can differ without changing any verdict (keys do not
/// recurse; evaluation order only picks which of several sufficient keys
/// is marked used, and the agreement check below compares the used SET).
fn authority_of(v: &Value) -> Authority {
    let mut keys: Vec<KeyWeight> = v["keys"]
        .as_array()
        .unwrap()
        .iter()
        .map(|k| KeyWeight {
            key: Key::new(s(&k["key"])),
            weight: k["weight"].as_u64().unwrap() as u16,
        })
        .collect();
    keys.sort_by(|a, b| a.key.cmp(&b.key));
    let mut accounts: Vec<PermissionLevelWeight> = v["accounts"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| PermissionLevelWeight {
            permission: PermissionLevel::of(
                s(&a["permission"]["actor"]),
                s(&a["permission"]["permission"]),
            ),
            weight: a["weight"].as_u64().unwrap() as u16,
        })
        .collect();
    accounts.sort_by(|a, b| a.permission.cmp(&b.permission));
    let mut waits: Vec<WaitWeight> = v["waits"]
        .as_array()
        .unwrap()
        .iter()
        .map(|w| WaitWeight {
            wait_sec: w["wait_sec"].as_u64().unwrap() as u32,
            weight: w["weight"].as_u64().unwrap() as u16,
        })
        .collect();
    waits.sort_by_key(|w| w.wait_sec);
    Authority::new(
        v["threshold"].as_u64().unwrap() as u32,
        keys,
        accounts,
        waits,
    )
}

/// The world as the chain served it: every account's permissions,
/// parents first.
fn world_of(r: &Value) -> World {
    let mut w = World::new();
    for (name, perms) in r["accounts"].as_object().unwrap() {
        let perms = perms.as_array().unwrap();
        let find = |pn: &str| perms.iter().find(|p| s(&p["perm_name"]) == pn).unwrap();
        let owner = authority_of(&find("owner")["required_auth"]);
        let active = authority_of(&find("active")["required_auth"]);
        w.add_account(&n(name), owner, active).unwrap();
        let mut pending: Vec<&Value> = perms
            .iter()
            .filter(|p| !matches!(s(&p["perm_name"]), "owner" | "active"))
            .collect();
        let mut rounds = 0;
        while !pending.is_empty() {
            rounds += 1;
            assert!(rounds < 64, "permission parents never resolved for {name}");
            let mut next = Vec::new();
            for p in pending {
                let parent = n(s(&p["parent"]));
                let exists = w
                    .find_permission(&PermissionLevel::new(n(name), parent.clone()))
                    .is_some();
                if exists {
                    w.add_permission(
                        &n(name),
                        &n(s(&p["perm_name"])),
                        &parent,
                        authority_of(&p["required_auth"]),
                    )
                    .unwrap_or_else(|e| panic!("{name}@{}: {e}", s(&p["perm_name"])));
                } else {
                    next.push(p);
                }
            }
            pending = next;
        }
    }
    w
}

fn keyset(v: &Value) -> BTreeSet<String> {
    v.as_array()
        .map(|a| a.iter().map(|k| s(k).to_string()).collect())
        .unwrap_or_default()
}

#[test]
fn the_receipt_is_the_pinned_chain_and_both_nodes_agreed() {
    let r = receipt();
    assert_eq!(
        s(&r["chain"]["chain_id"]),
        "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d" // PUBLIC-CONSTANT Jungle4 chain id
    );
    assert!(
        s(&r["chain"]["primary"]["server_version_string"]).starts_with("v1.2.2"),
        "the primary node must run the Spring version the model was read from"
    );
    let cases = r["cases"].as_array().unwrap();
    assert!(cases.len() >= 20, "{} cases", cases.len());
    for c in cases {
        assert_eq!(
            c["nodes_agree"],
            true,
            "{}: the two endpoints disagreed",
            s(&c["id"])
        );
    }
}

#[test]
fn every_get_required_keys_row_agrees_with_the_model() {
    let r = receipt();
    let world = world_of(&r);
    let mut agreed = 0;
    for c in r["cases"].as_array().unwrap() {
        let id = s(&c["id"]);
        let level =
            PermissionLevel::of(s(&c["declared"]["actor"]), s(&c["declared"]["permission"]));
        let candidates: Vec<String> = c["candidates"]
            .as_array()
            .unwrap()
            .iter()
            .map(|k| s(k).to_string())
            .collect();
        let refs: Vec<&str> = candidates.iter().map(|k| k.as_str()).collect();
        let provided = Provided::keys(&refs).with_delay(c["delay_sec"].as_u64().unwrap());
        let mut checker = Checker::new(&world, &provided, Faults::NONE);
        let v = checker.satisfied(&level, None).unwrap();
        let chain_ok = c["chain"]["ok"].as_bool().unwrap();
        assert_eq!(
            v.satisfied,
            chain_ok,
            "{id} ({}): model {} chain {} [{}]",
            s(&c["claim"]),
            v.satisfied,
            chain_ok,
            c["chain"]["message"].as_str().unwrap_or("")
        );
        if chain_ok {
            let used: BTreeSet<String> = checker.used_keys().into_iter().map(|k| k.0).collect();
            assert_eq!(
                used,
                keyset(&c["chain"]["required_keys"]),
                "{id}: the used key set differs from the chain's required keys"
            );
        }
        agreed += 1;
    }
    assert!(agreed >= 20, "{agreed} rows");
}

#[test]
fn every_push_row_agrees_with_the_transaction_gate() {
    let r = receipt();
    let base = world_of(&r);
    let account = n(s(&r["account"]));
    let mut agreed = 0;
    for p in r["pushes"].as_array().unwrap() {
        let id = s(&p["id"]);
        let mut world = base.clone();
        for l in p["links_at_time"].as_array().unwrap() {
            world
                .link(
                    &account,
                    &n(s(&l["code"])),
                    Some(&n(s(&l["type"]))),
                    &n(s(&l["requirement"])),
                )
                .unwrap();
        }
        let action = Action::new(
            n(s(&p["action"]["account"])),
            n(s(&p["action"]["name"])),
            vec![PermissionLevel::of(
                s(&p["declared"]["actor"]),
                s(&p["declared"]["permission"]),
            )],
        );
        let provided = Provided::keys(&[s(&p["signer"])]);
        let out = check_authorization(&world, &[action.clone()], &provided, false, Faults::NONE);
        let accepted = p["chain"]["accepted"].as_bool().unwrap();
        if action.account == n("eosio") {
            // linkauth / unlinkauth: the model refuses to answer by name
            assert!(
                matches!(out, Err(Refusal::NativeAuthorityActionNotModeled(_))),
                "{id}: {out:?}"
            );
            agreed += 1;
            continue;
        }
        if accepted {
            let v = out.unwrap_or_else(|e| panic!("{id} ({}): model refused {e}", s(&p["claim"])));
            assert_eq!(v.outcome, Outcome::Satisfied, "{id}: {v:?}");
        } else {
            let msg = p["chain"]["message"].as_str().unwrap_or("");
            assert!(
                msg.to_lowercase().contains("irrelevant"),
                "{id}: chain refused for another reason: {msg}"
            );
            assert!(
                matches!(out, Err(Refusal::IrrelevantAuthority { .. })),
                "{id} ({}): model answered {out:?} where the chain refused: {msg}",
                s(&p["claim"])
            );
        }
        agreed += 1;
    }
    assert!(agreed >= 9, "{agreed} rows");
    assert_eq!(active_name(), n("active"));
}
