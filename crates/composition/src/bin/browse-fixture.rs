//! Browse-fixture mint (T-5 search/browse substrate) — a volume fixture of
//! marketplace listings computed through the REAL normalizer path
//! (`normalizer::normalize`, the `("lovismarket","addlisting")` →
//! `EventType::ProductListed` arm), §9.3 `CanonicalEvent` types throughout.
//! Sibling of `listings-fixture` (that bin and its pinned fixture are
//! untouched). Nothing hand-written, nothing random: variety is EXPLICITLY
//! CONSTRUCTED and then PROVEN by assertions before emission — distinct
//! sellers, categories, asset_ids, unpriced and minimal cases, mixed
//! timestamps including the documented 0 sentinel, and typed refusals as
//! first-class outcomes. A fixture that fails its own variety contract
//! refuses to emit (nonzero exit).
//!
//! Provenance: `DEMO_GENERATED_FROM=$(git rev-parse HEAD) cargo run -q -p
//! composition --bin browse-fixture > fixtures/browse-fixtures.json`.

use normalizer::{normalize, NormalizerError, RawChainAction};
use serde_json::json;
use shared_types::{EventPayload, EventType, SourceChain};
use std::collections::BTreeSet;

fn main() {
    std::process::exit(match fixture() {
        Ok(doc) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&doc).expect("fixture document serializes")
            );
            0
        }
        Err(e) => {
            eprintln!("\nx INVARIANT FAILED - {e}");
            eprintln!("browse-fixture aborted - exit 1");
            1
        }
    });
}

/// Serialize any `Serialize` value into the fixture, with a string error.
fn jval<T: serde::Serialize>(t: &T) -> Result<serde_json::Value, String> {
    serde_json::to_value(t).map_err(|e| format!("browse: serialize: {e}"))
}

fn listing_action(tx_id: &str, block_num: u64, data: serde_json::Value) -> RawChainAction {
    RawChainAction {
        source_chain: SourceChain::Vaulta,
        contract: "lovismarket".into(),
        action_name: "addlisting".into(),
        data,
        block_num,
        tx_id: tx_id.into(),
    }
}

/// Echo a `RawChainAction` with its real field names (it does not derive
/// Serialize); scalars round-trip-verified, `data` embeds the identical
/// `serde_json::Value` (zero transcription).
fn input_json(ctx: &str, a: &RawChainAction) -> Result<serde_json::Value, String> {
    let doc = json!({
        "source_chain": format!("{:?}", a.source_chain),
        "contract": a.contract,
        "action_name": a.action_name,
        "data": a.data,
        "block_num": a.block_num,
        "tx_id": a.tx_id,
    });
    if doc.get("source_chain").and_then(|v| v.as_str())
        != Some(format!("{:?}", a.source_chain).as_str())
        || doc.get("contract").and_then(|v| v.as_str()) != Some(a.contract.as_str())
        || doc.get("action_name").and_then(|v| v.as_str()) != Some(a.action_name.as_str())
        || doc.get("data") != Some(&a.data)
        || doc.get("block_num").and_then(|v| v.as_u64()) != Some(a.block_num)
        || doc.get("tx_id").and_then(|v| v.as_str()) != Some(a.tx_id.as_str())
    {
        return Err(format!("{ctx}: input round-trip mismatch"));
    }
    Ok(doc)
}

/// The normalizer's typed error with its real variant and field names,
/// round-trip-verified against the source error.
fn refusal_json(ctx: &str, err: &NormalizerError) -> Result<serde_json::Value, String> {
    let doc = match err {
        NormalizerError::MissingField { action, field } => json!({
            "error": "MissingField",
            "action": action,
            "field": field,
            "display": err.to_string(),
        }),
        NormalizerError::BadFieldType {
            action,
            field,
            expected,
        } => json!({
            "error": "BadFieldType",
            "action": action,
            "field": field,
            "expected": expected,
            "display": err.to_string(),
        }),
    };
    let (want_variant, want_field) = match err {
        NormalizerError::MissingField { field, .. } => ("MissingField", *field),
        NormalizerError::BadFieldType { field, .. } => ("BadFieldType", *field),
    };
    if doc.get("error").and_then(|v| v.as_str()) != Some(want_variant)
        || doc.get("field").and_then(|v| v.as_str()) != Some(want_field)
        || doc.get("display").and_then(|v| v.as_str()) != Some(err.to_string().as_str())
    {
        return Err(format!("{ctx}: refusal round-trip mismatch"));
    }
    Ok(doc)
}

/// The success catalogue — EXPLICITLY CONSTRUCTED variety, no RNG. Sellers,
/// categories, amounts (orders of magnitude apart, some unpriced), asset_ids,
/// minimal-only cases, and timestamps (some absent → 0 sentinel) are all
/// chosen by hand; the variety contract below asserts the spread.
#[rustfmt::skip]
fn success_catalogue() -> Vec<(&'static str, serde_json::Value)> {
    const T0: i64 = 1_782_000_000;
    vec![
        ("bl-01", json!({"listing_id": "listing-42",  "seller_did": "did:plc:seller",           "category": "hemp-seeds",  "title": "Heirloom hemp seeds",          "amount": 5_000_000u64,     "asset_id": "fusd-asset-id", "timestamp": T0})),
        ("bl-02", json!({"listing_id": "listing-101", "seller_did": "did:plc:seller",           "category": "hemp-flower", "title": "Sun-grown hemp flower, 10g",   "amount": 12_500_000u64,    "asset_id": "fusd-asset-id", "timestamp": T0 + 500})),
        ("bl-03", json!({"listing_id": "listing-102", "seller_did": "did:plc:mariposa-textiles","category": "textiles",    "title": "Handwoven hemp rug 2x3m",      "amount": 250_000_000u64,   "asset_id": "fusd-asset-id", "timestamp": T0 + 1_000})),
        ("bl-04", json!({"listing_id": "listing-103", "seller_did": "did:plc:yucatan-grower",  "category": "honey",       "title": "Melipona honey, 250ml",        "amount": 50_000_000u64,    "asset_id": "fusd-asset-id", "timestamp": T0 + 1_500})),
        ("bl-05", json!({"listing_id": "listing-104", "seller_did": "did:plc:isla-crafts",     "category": "crafts",      "title": "Carved driftwood bowl",        "amount": 750_000u64,       "asset_id": "zano-asset-id", "timestamp": T0 + 2_000})),
        ("bl-06", json!({"listing_id": "listing-105", "seller_did": "did:plc:andes-herbs",     "category": "herbal-tea",  "title": "Coca-mint infusion, 50 bags",  "amount": 50_000u64,        "asset_id": "zano-asset-id", "timestamp": T0 + 2_500})),
        ("bl-07", json!({"listing_id": "listing-106", "seller_did": "did:plc:seller",           "category": "hemp-oil",    "title": "Cold-pressed hemp oil 100ml",  "amount": 1_000_000_000u64, "asset_id": "fusd-asset-id", "timestamp": T0 + 3_000})),
        ("bl-08", json!({"listing_id": "listing-107", "seller_did": "did:plc:mariposa-textiles","category": "textiles",    "title": "Hemp-cotton hammock",          "amount": 125_000_000u64,   "asset_id": "fusd-asset-id", "timestamp": T0 + 3_500})),
        ("bl-09", json!({"listing_id": "listing-108", "seller_did": "did:plc:yucatan-grower",  "category": "hemp-seeds",  "title": "Regional landrace seed pack",  "amount": 8_000_000u64,     "asset_id": "fusd-asset-id", "timestamp": T0 + 4_000})),
        ("bl-10", json!({"listing_id": "listing-109", "seller_did": "did:plc:isla-crafts",     "category": "crafts",      "title": "Shell wind chime",             "amount": 300_000u64,       "asset_id": "zano-asset-id", "timestamp": T0 + 4_500})),
        // Unpriced (amount absent) — a real marketplace condition (Q-D9).
        ("bl-11", json!({"listing_id": "listing-110", "seller_did": "did:plc:andes-herbs",     "category": "herbal-tea",  "title": "Ask about bulk maté",          "timestamp": T0 + 5_000})),
        ("bl-12", json!({"listing_id": "listing-111", "seller_did": "did:plc:seller",           "category": "hemp-flower", "title": "Pre-order: autumn harvest",    "timestamp": T0 + 5_500})),
        ("bl-13", json!({"listing_id": "listing-112", "seller_did": "did:plc:mariposa-textiles","category": "textiles",    "title": "Custom weave — quote on ask",  "timestamp": T0 + 6_000})),
        // Untitled / uncategorized variants (labeled-absence states).
        ("bl-14", json!({"listing_id": "listing-113", "seller_did": "did:plc:yucatan-grower",                              "title": "Uncategorized: propolis tincture", "amount": 15_000_000u64, "asset_id": "fusd-asset-id", "timestamp": T0 + 6_500})),
        ("bl-15", json!({"listing_id": "listing-114", "seller_did": "did:plc:isla-crafts",     "category": "crafts",                                                 "amount": 2_000_000u64,  "asset_id": "fusd-asset-id", "timestamp": T0 + 7_000})),
        // Minimal-only cases (required fields only).
        ("bl-16", json!({"listing_id": "listing-115", "seller_did": "did:plc:seller"})),
        ("bl-17", json!({"listing_id": "listing-116", "seller_did": "did:plc:andes-herbs"})),
        ("bl-18", json!({"listing_id": "listing-117", "seller_did": "did:plc:isla-crafts"})),
        // Zero-timestamp sentinel via absent timestamp, otherwise populated.
        ("bl-19", json!({"listing_id": "listing-118", "seller_did": "did:plc:mariposa-textiles","category": "textiles",    "title": "Undated: indigo table runner", "amount": 90_000_000u64,    "asset_id": "fusd-asset-id"})),
        ("bl-20", json!({"listing_id": "listing-119", "seller_did": "did:plc:yucatan-grower",  "category": "honey",       "title": "Undated: comb honey slab",     "amount": 60_000_000u64,    "asset_id": "zano-asset-id"})),
        ("bl-21", json!({"listing_id": "listing-120", "seller_did": "did:plc:seller",           "category": "hemp-seeds",  "title": "Feminized seed trio",          "amount": 6_500_000u64,     "asset_id": "fusd-asset-id", "timestamp": T0 + 8_000})),
        ("bl-22", json!({"listing_id": "listing-121", "seller_did": "did:plc:andes-herbs",     "category": "hemp-oil",    "title": "Salve, travel tin",            "amount": 4_200_000u64,     "asset_id": "zano-asset-id", "timestamp": T0 + 8_500})),
        ("bl-23", json!({"listing_id": "listing-122", "seller_did": "did:plc:isla-crafts",     "category": "honey",       "title": "Honey + comb gift box",        "amount": 95_000_000u64,    "asset_id": "fusd-asset-id", "timestamp": T0 + 9_000})),
        ("bl-24", json!({"listing_id": "listing-123", "seller_did": "did:plc:mariposa-textiles","category": "hemp-flower", "title": "Grower collab: flower + wrap", "amount": 22_000_000u64,    "asset_id": "fusd-asset-id", "timestamp": T0 + 9_500})),
    ]
}

/// The refusal catalogue — typed errors as first-class outcomes.
fn refusal_catalogue() -> Vec<(&'static str, serde_json::Value, NormalizerError)> {
    vec![
        (
            "br-01",
            json!({"listing_id": "listing-r1", "title": "No seller on record", "timestamp": 1_782_010_000i64}),
            NormalizerError::MissingField {
                action: "lovismarket:addlisting".into(),
                field: "seller_did",
            },
        ),
        (
            "br-02",
            json!({"seller_did": "did:plc:seller", "title": "No listing id", "timestamp": 1_782_010_500i64}),
            NormalizerError::MissingField {
                action: "lovismarket:addlisting".into(),
                field: "listing_id",
            },
        ),
        (
            "br-03",
            json!({"listing_id": "listing-r3", "seller_did": "did:plc:seller", "amount": "not-a-number"}),
            NormalizerError::BadFieldType {
                action: "lovismarket:addlisting".into(),
                field: "amount",
                expected: "u64",
            },
        ),
        (
            "br-04",
            json!({"listing_id": "listing-r4", "seller_did": "did:plc:seller", "amount": -5}),
            NormalizerError::BadFieldType {
                action: "lovismarket:addlisting".into(),
                field: "amount",
                expected: "u64",
            },
        ),
    ]
}

fn fixture() -> Result<serde_json::Value, String> {
    let mut entries = Vec::new();

    // Variety accounting — the dispatch's constraints, asserted before emission.
    let mut sellers = BTreeSet::new();
    let mut categories = BTreeSet::new();
    let mut asset_ids = BTreeSet::new();
    let mut amounts: Vec<u64> = Vec::new();
    let (mut unpriced, mut minimal, mut zero_ts) = (0usize, 0usize, 0usize);

    let successes = success_catalogue();
    let success_count = successes.len();
    for (i, (tx_id, data)) in successes.into_iter().enumerate() {
        let ctx = format!("browse/{tx_id}");
        let action = listing_action(tx_id, 600 + i as u64, data);
        let input = input_json(&ctx, &action)?;
        let event = normalize(action.clone())
            .map_err(|e| format!("{ctx}: unexpected refusal: {e}"))?
            .ok_or_else(|| format!("{ctx}: recognized action was ignored"))?;
        if event.event_type != EventType::ProductListed
            || event.canonicalized_by != "normalizer"
            || event.source_ref != format!("{}:{}", 600 + i as u64, tx_id)
        {
            return Err(format!("{ctx}: envelope does not match normalizer rules"));
        }
        let EventPayload::Product(p) = &event.payload else {
            return Err(format!("{ctx}: expected Product payload"));
        };
        // Payload must equal the input's fields — the normalizer is the only
        // transform between them.
        if Some(p.listing_id.as_str()) != action.data.get("listing_id").and_then(|v| v.as_str())
            || Some(p.seller_did.as_str()) != action.data.get("seller_did").and_then(|v| v.as_str())
            || p.category.as_deref() != action.data.get("category").and_then(|v| v.as_str())
            || p.title.as_deref() != action.data.get("title").and_then(|v| v.as_str())
            || p.amount != action.data.get("amount").and_then(|v| v.as_u64())
            || p.asset_id.as_deref() != action.data.get("asset_id").and_then(|v| v.as_str())
        {
            return Err(format!("{ctx}: payload fields do not match the input"));
        }
        sellers.insert(p.seller_did.clone());
        if let Some(c) = &p.category {
            categories.insert(c.clone());
        }
        if let Some(a) = &p.asset_id {
            asset_ids.insert(a.clone());
        }
        match p.amount {
            Some(amt) => amounts.push(amt),
            None => unpriced += 1,
        }
        if p.category.is_none() && p.title.is_none() && p.amount.is_none() && p.asset_id.is_none() {
            minimal += 1;
        }
        if event.timestamp == 0 {
            zero_ts += 1;
        }
        entries.push(json!({
            "case": format!("success_{tx_id}"),
            "input": input,
            "outcome": { "event": jval(&event)? },
        }));
    }

    let refusals = refusal_catalogue();
    let refusal_count = refusals.len();
    for (i, (tx_id, data, expected)) in refusals.into_iter().enumerate() {
        let ctx = format!("browse/{tx_id}");
        let action = listing_action(tx_id, 700 + i as u64, data);
        let input = input_json(&ctx, &action)?;
        let err = match normalize(action.clone()) {
            Err(e) => e,
            other => return Err(format!("{ctx}: expected refusal ({other:?})")),
        };
        if err != expected {
            return Err(format!("{ctx}: wrong typed error ({err:?})"));
        }
        entries.push(json!({
            "case": format!("refusal_{tx_id}"),
            "input": input,
            "outcome": { "refused": refusal_json(&ctx, &err)? },
        }));
    }

    // -- The variety contract (dispatch constraints), asserted not claimed.
    let (min_amt, max_amt) = (
        amounts.iter().min().copied().unwrap_or(0),
        amounts.iter().max().copied().unwrap_or(0),
    );
    if !(20..=30).contains(&success_count) {
        return Err(format!(
            "variety: {success_count} successes outside 20..=30"
        ));
    }
    if !(3..=5).contains(&refusal_count) {
        return Err(format!("variety: {refusal_count} refusals outside 3..=5"));
    }
    if sellers.len() < 4 || !sellers.contains("did:plc:seller") {
        return Err("variety: need >=4 sellers including did:plc:seller".into());
    }
    if categories.len() < 5 {
        return Err(format!("variety: {} categories < 5", categories.len()));
    }
    if asset_ids.len() < 2 {
        return Err(format!("variety: {} asset_ids < 2", asset_ids.len()));
    }
    if unpriced < 2 || minimal < 3 || zero_ts < 2 {
        return Err(format!(
            "variety: unpriced={unpriced} (<2) or minimal={minimal} (<3) or zero_ts={zero_ts} (<2)"
        ));
    }
    if min_amt == 0 || max_amt / min_amt < 1_000 {
        return Err(format!(
            "variety: amount spread {min_amt}..{max_amt} narrower than three orders of magnitude"
        ));
    }

    let generated_from = std::env::var("DEMO_GENERATED_FROM").unwrap_or_else(|_| {
        "unset — set DEMO_GENERATED_FROM=$(git rev-parse HEAD) when writing fixtures/".into()
    });

    Ok(json!({
        "schema": "shared-types §9.3 CanonicalEvent (versioned) — Product family via normalizer",
        "generated_by": "DEMO_GENERATED_FROM=$(git rev-parse HEAD) cargo run -q -p composition --bin browse-fixture",
        "generated_from": generated_from,
        "source_of_truth": "normalizer::normalize — (\"lovismarket\",\"addlisting\") arm → EventType::ProductListed (crates/normalizer/src/lib.rs); typed refusals NormalizerError::{MissingField, BadFieldType}",
        "serialization_note": "success events are serde-serialized from the real CanonicalEvent structs; inputs echo the identical RawChainAction instances the normalizer consumed (zero transcription); refusals are hand-mapped with the error's real field names and round-trip-verified; variety is explicitly constructed (no RNG) and asserted before emission",
        "variety": {
            "successes": success_count,
            "refusals": refusal_count,
            "distinct_sellers": sellers.len(),
            "distinct_categories": categories.len(),
            "distinct_asset_ids": asset_ids.len(),
            "unpriced": unpriced,
            "minimal_required_only": minimal,
            "zero_timestamp_sentinel": zero_ts,
            "amount_min": min_amt,
            "amount_max": max_amt,
        },
        "browse": entries,
    }))
}
