//! SPEC AV-4 — cross-rail disjointness over the door's ACTUAL artifacts
//! (docs/agents/ADVERSARIAL-BPAY-SPECS.md, P1). Founder order 2026-09-16:
//! audit emitted artifacts, not type definitions — journals, paths, payment
//! ids, payer tags. Two legs of ONE wallet-local plan are driven through the
//! REAL `Journal::reserve`, and every identifier-bearing leaf of one leg's
//! artifacts is proven absent from the other's: no wallet-global identifier
//! may link multirail legs (R4 — stronger than "different addresses").
//!
//! Attacked join surfaces: journal file PATHS (per-chain dir + nonce
//! basename), every string leaf of the stored records (nonces, payer ids,
//! pay_to, auth ids, any plan-ish tag), and cross-chain string containment
//! (leg A's file must not even MENTION leg B's chain or payer).
//!
//! The timing channel (both records stamped the same second when reserved
//! together) is REPORTED, not failed: timestamps are inherently correlatable
//! metadata; R4's structural defense is per-chain journals + zero shared
//! identifiers — falsifying timestamps to hide co-temporality would be a
//! worse law. Flagged for the founder's ruling in the AV-4 dispatch.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use x402_door::journal::{Journal, LegKey};

fn leg(chain: &str, payer: &str, nonce: &str, pay_to: &str) -> LegKey {
    leg_with_asset(
        chain,
        payer,
        nonce,
        pay_to,
        &format!("{chain}/erc20:0xUSDC"),
    )
}

fn leg_with_asset(chain: &str, payer: &str, nonce: &str, pay_to: &str, asset: &str) -> LegKey {
    LegKey {
        chain: chain.into(),
        scheme: "exact".into(),
        auth_nonce: nonce.into(),
        payer: payer.into(),
        amount_authorized: "1000000".into(),
        valid_before_unix: 1_900_000_000,
        pay_to: pay_to.into(),
        asset: asset.into(),
    }
}

/// String leaves of one artifact set, keyed by json path — the identifier
/// universe of that leg. Numeric leaves (amounts, timestamps, gas) are NOT
/// identifiers; the timing channel is reported separately.
fn string_leaves(v: &serde_json::Value, prefix: &str, out: &mut BTreeMap<String, String>) {
    match v {
        serde_json::Value::String(s) => {
            out.insert(prefix.trim_start_matches('/').to_string(), s.clone());
        }
        serde_json::Value::Object(map) => {
            for (k, val) in map {
                string_leaves(val, &format!("{prefix}/{k}"), out);
            }
        }
        serde_json::Value::Array(items) => {
            for (i, val) in items.iter().enumerate() {
                string_leaves(val, &format!("{prefix}[{i}]"), out);
            }
        }
        _ => {}
    }
}

/// Structural vocabulary that may lawfully appear on both legs WITHOUT being
/// a join key: the record schema version, the payment scheme, the asset id
/// (same token on two chains is the NORMAL multirail shape), state names,
/// and the authorized AMOUNT — a value, public pricing information, not a
/// wallet-global identifier (same-amount legs are the normal shape; amount
/// equality is reported with the timing channel below, never silently
/// ignored).
fn is_structural(key: &str, value: &str) -> bool {
    let key_ok = key.ends_with("record_version")
        || key.ends_with("scheme")
        || key.ends_with("asset")
        || key.ends_with("amount_authorized")
        || key.ends_with("state")           // enum tag inside state objects
        || key.contains("/state/");
    key_ok && value.len() < 128
}

/// One leg's full artifact set: the per-chain directory's file PATHS and the
/// parsed string leaves of every record inside.
struct LegArtifacts {
    dir: PathBuf,
    chain: String,
    leaves: BTreeMap<String, String>,
    raw_files: Vec<(PathBuf, String)>,
}

fn collect_leg(_root: &Path, chain_dir: &Path, chain: &str) -> LegArtifacts {
    let mut leaves = BTreeMap::new();
    let mut raw_files = Vec::new();
    for entry in fs::read_dir(chain_dir).expect("leg dir readable") {
        let p = entry.expect("dir entry").path();
        if p.extension().and_then(|e| e.to_str()) == Some("json") {
            let raw = fs::read_to_string(&p).expect("record readable");
            let v: serde_json::Value = serde_json::from_str(&raw).expect("record json");
            string_leaves(&v, "", &mut leaves);
            raw_files.push((p, raw));
        }
    }
    LegArtifacts {
        dir: chain_dir.to_path_buf(),
        chain: chain.to_string(),
        leaves,
        raw_files,
    }
}

/// THE AUDIT: intersection of the two legs' non-structural string-leaf
/// VALUES. Empty = disjoint (pass); any member = a shared identifier (fail).
fn shared_identifier_values(a: &LegArtifacts, b: &LegArtifacts) -> Vec<String> {
    let va: std::collections::BTreeSet<&str> = a
        .leaves
        .iter()
        .filter(|(k, v)| !is_structural(k, v))
        .map(|(_, v)| v.as_str())
        .collect();
    let vb: std::collections::BTreeSet<&str> = b
        .leaves
        .iter()
        .filter(|(k, v)| !is_structural(k, v))
        .map(|(_, v)| v.as_str())
        .collect();
    va.intersection(&vb).map(|s| s.to_string()).collect()
}

#[test]
fn av4_two_legs_of_one_plan_share_no_identifier() {
    let root = std::env::temp_dir().join(format!("av4-door-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let journal = Journal::open(&root, 10_000_000).expect("journal opens");

    // ONE wallet-local plan, TWO rails — payers, nonces, payees all distinct.
    let leg_a = leg(
        "eip155:8453",
        "0xa11aaaaaaaf00daaaaaaaaaaaaaaaaaaaaaaaaa",
        "av4-nonce-base-7f3c9d2e11",
        "0xc0decccccccccccccccccccccccccccccccccccc",
    );
    let leg_b = leg(
        "eip155:42161",
        "0xbbbbbbbbb22c0feeeeeeeeeeeeeeeeeeeeeeeee",
        "av4-nonce-arb-4b8e0f6a29",
        "0xd00ddddddddddddddddddddddddddddddddddddd",
    );
    journal
        .reserve(&leg_a, 1_000, 10_000)
        .expect("leg A reserves");
    journal
        .reserve(&leg_b, 1_000, 10_000)
        .expect("leg B reserves");

    // collect ACTUAL artifacts: exactly two per-chain dirs must exist
    let mut dirs: Vec<PathBuf> = fs::read_dir(&root)
        .expect("root readable")
        .map(|e| e.expect("entry").path())
        .filter(|p| p.is_dir())
        .collect();
    dirs.sort();
    assert_eq!(
        dirs.len(),
        2,
        "one journal directory per chain (the R4 layout)"
    );
    let (arts_1, arts_2) = (
        collect_leg(&root, &dirs[0], "dir-1"),
        collect_leg(&root, &dirs[1], "dir-2"),
    );
    // map directories to legs BY CONTENT (chain id in the record), never by
    // sort order — the audit must not assume which chain sorts first
    let (arts_a, arts_b) = if arts_1.raw_files.iter().any(|(_, raw)| {
        let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
        compact.contains(&format!("\"chain\":\"{}\"", leg_a.chain))
    }) {
        (arts_1, arts_2)
    } else {
        (arts_2, arts_1)
    };
    assert!(
        arts_a.raw_files.iter().any(|(_, raw)| {
            let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
            compact.contains(&format!("\"chain\":\"{}\"", leg_a.chain))
        }),
        "leg A's directory did not carry leg A's chain — mapping broken"
    );
    assert!(
        arts_b
            .raw_files
            .iter()
            .any(|(_, raw)| {
            let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
            compact.contains(&format!("\"chain\":\"{}\"", leg_b.chain))
        }),
        "leg B's directory did not carry leg B's chain — mapping broken (dir {:?}, {} files, looking for {})",
        arts_b.dir,
        arts_b.raw_files.len(),
        leg_b.chain
    );
    assert!(!arts_a.leaves.is_empty() && !arts_b.leaves.is_empty());

    // (1) identifier disjointness — the R4 prohibition
    let shared = shared_identifier_values(&arts_a, &arts_b);
    assert!(
        shared.is_empty(),
        "R4 violated: identifier value(s) shared across legs: {shared:?}"
    );

    // (2) payer derivation — no artifact of one leg even CONTAINS the other
    // leg's payer or nonce (substring), full or partial
    for (_, raw) in arts_a.raw_files.iter() {
        assert!(
            !raw.contains(&leg_b.payer),
            "leg A's record contains leg B's payer"
        );
        assert!(
            !raw.contains(&leg_b.auth_nonce),
            "leg A's record names leg B's nonce"
        );
    }
    for (_, raw) in arts_b.raw_files.iter() {
        assert!(
            !raw.contains(&leg_a.payer),
            "leg B's record contains leg A's payer"
        );
        assert!(
            !raw.contains(&leg_a.auth_nonce),
            "leg B's record names leg A's nonce"
        );
    }

    // (3) cross-chain containment: leg A's artifacts never mention leg B's
    // chain id, and vice versa (the R4 logging law's structural core)
    for (_, raw) in arts_a.raw_files.iter() {
        assert!(
            !raw.contains(&leg_b.chain),
            "leg A's record mentions leg B's chain"
        );
    }
    for (_, raw) in arts_b.raw_files.iter() {
        assert!(
            !raw.contains(&leg_a.chain),
            "leg B's record mentions leg A's chain"
        );
    }

    // (4) filename join: the basenames (payment ids) differ
    let names_a: Vec<String> = arts_a
        .raw_files
        .iter()
        .map(|(p, _)| p.file_name().unwrap().to_string_lossy().to_string())
        .collect();
    let names_b: Vec<String> = arts_b
        .raw_files
        .iter()
        .map(|(p, _)| p.file_name().unwrap().to_string_lossy().to_string())
        .collect();
    assert!(
        names_a.iter().all(|n| !names_b.contains(n)),
        "journal filenames (payment ids) must be leg-distinct: {names_a:?} vs {names_b:?}"
    );

    // (5) the value channels — REPORTED, not failed (see module docs):
    // timestamps are inherently correlatable metadata, and equal amounts
    // are public pricing information; R4's defense is structural
    // identifier disjointness, not falsifying either.
    let ts_a = arts_a.leaves.get("updated_unix");
    let ts_b = arts_b.leaves.get("updated_unix");
    if ts_a.is_some() && ts_a == ts_b {
        eprintln!(
            "AV-4 timing-channel report: both legs stamped the same second \
             ({ts_a:?}) — correlatable metadata, structurally defended"
        );
    }
    if leg_a.amount_authorized == leg_b.amount_authorized {
        eprintln!(
            "AV-4 value-channel report: both legs authorize the same amount \
             — public pricing information, not an identifier"
        );
    }

    let _ = fs::remove_dir_all(&root);
}

/// THE NEGATIVE CONTROL (house law): a deliberately leaky variant — both
/// legs' records stamped with one shared plan tag — MUST be detected by the
/// same audit function, proving the harness catches the class it claims to.
#[test]
fn av4_negative_control_leaky_plan_tag_is_detected() {
    let root = std::env::temp_dir().join(format!("av4-leak-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let dir_a = root.join("chainA");
    let dir_b = root.join("chainB");
    fs::create_dir_all(&dir_a).unwrap();
    fs::create_dir_all(&dir_b).unwrap();
    // two "legs" that share a wallet-global plan_ref (the R4 violation)
    fs::write(
        dir_a.join("res-nonceA.json"),
        r#"{"record_version":1,"leg":{"chain":"eip155:8453","scheme":"exact",
            "auth_nonce":"nonce-A","payer":"0xAAA","amount_authorized":"1",
            "valid_before_unix":99,"pay_to":"0xPP","asset":"usdc"},
            "state":{"Reserved":{"ts":100}},"updated_unix":100,
            "plan_ref":"plan-LEAK-9c1f"}"#,
    )
    .unwrap();
    fs::write(
        dir_b.join("res-nonceB.json"),
        r#"{"record_version":1,"leg":{"chain":"eip155:42161","scheme":"exact",
            "auth_nonce":"nonce-B","payer":"0xBBB","amount_authorized":"1",
            "valid_before_unix":99,"pay_to":"0xQQ","asset":"usdc"},
            "state":{"Reserved":{"ts":100}},"updated_unix":100,
            "plan_ref":"plan-LEAK-9c1f"}"#,
    )
    .unwrap();

    let arts_a = collect_leg(&root, &dir_a, "eip155:8453");
    let arts_b = collect_leg(&root, &dir_b, "eip155:42161");
    let shared = shared_identifier_values(&arts_a, &arts_b);
    assert!(
        shared.contains(&"plan-LEAK-9c1f".to_string()),
        "negative control: the shared plan tag was NOT detected — the audit \
         cannot detect the R4 violation class; saw {shared:?}"
    );
    let _ = fs::remove_dir_all(&root);
}
