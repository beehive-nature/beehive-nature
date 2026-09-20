//! AV-4: cross-rail identifier audit over the door's EMITTED artifacts
//! (journal records + filenames + every id-shaped field inside them).
//!
//! R4 law: no public or counterparty-visible WALLET-GLOBAL identifier may
//! link rails (EVM/L2/LN/…) — what joins legs is the private, wallet-local
//! plan, never bytes on disk. The audit tokenizes each chain directory's
//! artifacts and asserts the cross-chain intersection is EMPTY (public
//! constants like CAIP-2 chain ids excluded).
//!
//! CHECKER-VALIDATION LAW: the detector runs against BOTH a known-good
//! tree (a lawful two-rail scenario → zero cross-hits) and a known-BAD
//! fixture (a deliberately leaking wallet-global id injected under BOTH
//! rails → the detector MUST fire naming it). A green from an unvalidated
//! checker is a claim about the checker.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::sync::Arc;

use x402_door::journal::Journal;
use x402_door::orchestrator::{
    Door, DoorConfig, FacilitatorSettle, SettlementFacilitator, StaticFloat,
};
use x402_door::wire::extract_leg;

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir()
        .join("x402-door-r4-audit")
        .join(format!("{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn request(chain: &str, nonce: &str, pay_to: &str, asset: &str, from: &str) -> serde_json::Value {
    serde_json::json!({
        "x402Version": 2,
        "paymentRequirements": {
            "scheme": "exact",
            "network": chain,
            "payTo": pay_to,
            "asset": asset,
            "maxTimeoutSeconds": 3600
        },
        "paymentPayload": {
            "x402Version": 2,
            "payload": {
                "from": from,
                "nonce": nonce,
                "validBefore": (x402_door::journal::now_unix() + 3600).to_string(),
                "value": "3"
            }
        }
    })
}

struct Good;
impl SettlementFacilitator for Good {
    fn verify(&self, _r: &serde_json::Value) -> Result<(), String> {
        Ok(())
    }
    fn settle(&self, r: &serde_json::Value) -> FacilitatorSettle {
        let chain = r
            .pointer("/paymentRequirements/network")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        FacilitatorSettle::Success {
            payer: if chain.ends_with("8453") {
                "0xpayerOnBaseRail00000000000000000000000001"
            } else {
                "0xpayerOnArbRail0000000000000000000000000001"
            }
            .into(),
            transaction: if chain.ends_with("8453") {
                "tx-r4-on-base-rail"
            } else {
                "tx-r4-on-arb-rail"
            }
            .into(),
            network: chain.into(),
            actual_amount: Some("3".into()),
            gas_actual_wei: Some(1),
        }
    }
}

/// A token is any JSON string VALUE (recursively) or res-*.json filename
/// stem at least 6 chars long that is not a public constant. Object KEYS
/// are schema vocabulary, never identifiers. Identical value bytes under
/// two rails = a join.
fn identifier_tokens(v: &serde_json::Value, out: &mut BTreeSet<String>) {
    const PUBLIC: [&str; 17] = [
        "eip155:8453",
        "eip155:42161",
        "exact",
        "upto",
        "Reserved",
        "FailedKeep",
        "Settling",
        "Settled",
        "ReorgFlagged",
        "ExpiredReleased",
        "Unknown",
        "reorg_flagged",
        "settled",
        "settling",
        "failed_keep",
        "expired_released",
        "unknown",
    ];
    match v {
        serde_json::Value::String(t) => {
            let t = t.trim();
            if t.len() >= 6 && !PUBLIC.contains(&t) && !t.chars().all(|c| c.is_ascii_digit()) {
                out.insert(t.to_string());
            }
        }
        serde_json::Value::Array(a) => a.iter().for_each(|x| identifier_tokens(x, out)),
        serde_json::Value::Object(o) => o.values().for_each(|x| identifier_tokens(x, out)),
        _ => {}
    }
}

/// Walk `<root>/<rail-dir>/` collecting tokens; return per-rail sets.
fn audit(root: &Path) -> BTreeMap<String, BTreeSet<String>> {
    let mut per_rail: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for entry in fs::read_dir(root).unwrap().flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue; // lock/stray files are not rail artifacts
        }
        let rail = dir.file_name().unwrap().to_string_lossy().to_string();
        let mut tokens = BTreeSet::new();
        for f in fs::read_dir(&dir).unwrap().flatten() {
            let p = f.path();
            let name = p.file_name().unwrap().to_string_lossy().to_string();
            if name.starts_with("res-") && name.ends_with(".json") {
                let stem = name.trim_start_matches("res-").trim_end_matches(".json");
                if stem.len() >= 6 {
                    tokens.insert(stem.to_string());
                }
                if let Ok(body) = fs::read_to_string(&p) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) {
                        identifier_tokens(&v, &mut tokens);
                    }
                }
            }
        }
        per_rail.insert(rail, tokens);
    }
    per_rail
}

/// Cross-rail JOIN check: tokens present under two or more rails.
fn cross_rail_hits(per_rail: &BTreeMap<String, BTreeSet<String>>) -> BTreeSet<String> {
    let mut seen: BTreeMap<String, usize> = BTreeMap::new();
    for tokens in per_rail.values() {
        for t in tokens {
            *seen.entry(t.clone()).or_insert(0) += 1;
        }
    }
    seen.into_iter()
        .filter(|(_, n)| *n >= 2)
        .map(|(t, _)| t)
        .collect()
}

fn two_rail_scenario(root: &Path) {
    let gas = 1_000u64;
    let d = Door::new(
        Arc::new(Journal::open(root, 10 * gas).unwrap()),
        Arc::new(Good),
        DoorConfig {
            reserved_gas_wei: gas,
            ops_float_available_wei: 1_000_000,
        },
        Arc::new(StaticFloat(1_000_000_000_000)),
    );
    for (chain, nonce, pay_to, asset, from) in [
        (
            "eip155:8453",
            "nonceBaseRail01",
            "0xpayToOnBaseRail0000000000000000000000000001",
            "0xassetOnBaseRail0000000000000000000000000001",
            "0xfromOnBaseRail000000000000000000000000000001",
        ),
        (
            "eip155:42161",
            "nonceArbRail001",
            "0xpayToOnArbRail000000000000000000000000000001",
            "0xassetOnArbRail000000000000000000000000000001",
            "0xfromOnArbRail0000000000000000000000000000001",
        ),
    ] {
        let req = request(chain, nonce, pay_to, asset, from);
        let leg = extract_leg(&req).unwrap();
        d.verify(&leg, &req).unwrap();
        assert!(matches!(
            d.settle(&leg, &req).unwrap(),
            FacilitatorSettle::Success { .. }
        ));
    }
}

// Known-good: a lawful two-rail scenario shares NOTHING across rails.
#[test]
fn av4_lawful_two_rail_tree_has_zero_cross_rail_joins() {
    let root = tmp_root("av4-good");
    two_rail_scenario(&root);
    let per_rail = audit(&root);
    assert!(per_rail.len() >= 2, "two rails emitted artifacts");
    let hits = cross_rail_hits(&per_rail);
    assert!(
        hits.is_empty(),
        "R4 violated: wallet-global identifiers joined rails: {hits:?}"
    );
}

// Known-bad: a deliberately leaking fixture — the same wallet-global id
// under BOTH rails — MUST be caught by name (checker-validation law).
#[test]
fn av4_deliberately_leaking_fixture_is_detected_by_name() {
    let root = tmp_root("av4-leak");
    two_rail_scenario(&root);
    const LEAK: &str = "wallet-global-plan-id-LEAK-0001";
    for entry in fs::read_dir(&root).unwrap().flatten() {
        let dir = entry.path();
        if dir.is_dir() {
            fs::write(
                dir.join("res-deliberately-leaking-fixture.json"),
                format!("{{\"leaked_plan_id\":\"{LEAK}\"}}"),
            )
            .unwrap();
        }
    }
    let hits = cross_rail_hits(&audit(&root));
    assert!(
        hits.contains(LEAK),
        "known-bad fixture MUST fire the detector; hits were {hits:?}"
    );
}
