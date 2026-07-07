//! Listings-fixture mint — marketplace listing scenarios as one deterministic
//! machine-readable JSON document, computed through the REAL normalizer path
//! (`normalizer::normalize`, the `("lovismarket","addlisting")` →
//! `EventType::ProductListed` arm) against the §9.3 `CanonicalEvent` types.
//! Nothing hand-written: success events are serde-serialized from the real
//! structs; inputs are echoed from the same `RawChainAction` instances the
//! normalizer consumed; refusals are the normalizer's own typed errors,
//! mapped with their real field names and round-trip-verified (a wrong-field
//! `json!` swap refuses instead of emitting).
//!
//! Cases: one fully-populated listing, one minimal (required fields only,
//! optionals absent, timestamp absent → the envelope's documented 0 default),
//! and two malformed-input REFUSALS captured as first-class outcomes
//! (`MissingField`, `BadFieldType`) — guards are features here too.
//!
//! Provenance: `DEMO_GENERATED_FROM=$(git rev-parse HEAD) cargo run -q -p
//! composition --bin listings-fixture > fixtures/listings-fixtures.json`.
//! Exits nonzero on any invariant failure; a broken fixture cannot be
//! emitted silently.

use normalizer::{normalize, NormalizerError, RawChainAction};
use serde_json::json;
use shared_types::{EventPayload, EventType, SourceChain};

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
            eprintln!("listings-fixture aborted - exit 1");
            1
        }
    });
}

/// Serialize any `Serialize` value into the fixture, with a string error.
fn jval<T: serde::Serialize>(t: &T) -> Result<serde_json::Value, String> {
    serde_json::to_value(t).map_err(|e| format!("listings: serialize: {e}"))
}

/// The fully-populated listing action — the same shape the normalizer's own
/// `vaulta_addlisting_normalizes_to_product_listed` test proves.
fn listing_action(tx_id: &str, data: serde_json::Value) -> RawChainAction {
    RawChainAction {
        source_chain: SourceChain::Vaulta,
        contract: "lovismarket".into(),
        action_name: "addlisting".into(),
        data,
        block_num: 500,
        tx_id: tx_id.into(),
    }
}

/// Echo a `RawChainAction` with its real field names (`RawChainAction` does
/// not derive Serialize). `data` is already a `serde_json::Value`, so it
/// embeds without transcription; the scalar fields are round-trip-verified.
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

/// The normalizer's typed error, mapped with its real variant and field
/// names, round-trip-verified against the source error.
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
    let (want_variant, want_action, want_field, want_expected) = match err {
        NormalizerError::MissingField { action, field } => {
            ("MissingField", action.as_str(), *field, None)
        }
        NormalizerError::BadFieldType {
            action,
            field,
            expected,
        } => ("BadFieldType", action.as_str(), *field, Some(*expected)),
    };
    if doc.get("error").and_then(|v| v.as_str()) != Some(want_variant)
        || doc.get("action").and_then(|v| v.as_str()) != Some(want_action)
        || doc.get("field").and_then(|v| v.as_str()) != Some(want_field)
        || doc.get("expected").and_then(|v| v.as_str()) != want_expected
        || doc.get("display").and_then(|v| v.as_str()) != Some(err.to_string().as_str())
    {
        return Err(format!("{ctx}: refusal round-trip mismatch"));
    }
    Ok(doc)
}

fn fixture() -> Result<serde_json::Value, String> {
    // -- Case 1: fully populated (mirrors the normalizer's own proven test
    //    vector: vaulta_addlisting_normalizes_to_product_listed).
    let full = listing_action(
        "lst-tx-1",
        json!({
            "listing_id": "listing-42",
            "seller_did": "did:plc:seller",
            "category": "hemp-seeds",
            "title": "Heirloom hemp seeds",
            "amount": 5_000_000u64,
            "asset_id": "fusd-asset-id",
            "timestamp": 1_782_000_000i64,
        }),
    );
    let full_input = input_json("listings/full", &full)?;
    let full_event = normalize(full.clone())
        .map_err(|e| format!("listings/full: unexpected refusal: {e}"))?
        .ok_or("listings/full: recognized action was ignored")?;
    if full_event.event_type != EventType::ProductListed
        || full_event.event_id != "vaulta-lst-tx-1-addlisting"
        || full_event.source_ref != "500:lst-tx-1"
        || full_event.timestamp != 1_782_000_000
        || full_event.canonicalized_by != "normalizer"
    {
        return Err(
            "listings/full: envelope does not match the normalizer's documented rules".into(),
        );
    }
    {
        let EventPayload::Product(p) = &full_event.payload else {
            return Err("listings/full: expected Product payload".into());
        };
        if p.listing_id != "listing-42"
            || p.seller_did != "did:plc:seller"
            || p.category.as_deref() != Some("hemp-seeds")
            || p.title.as_deref() != Some("Heirloom hemp seeds")
            || p.amount != Some(5_000_000)
            || p.asset_id.as_deref() != Some("fusd-asset-id")
        {
            return Err("listings/full: payload fields do not match the input".into());
        }
    }

    // -- Case 2: minimal — required fields only; optionals absent stay None,
    //    absent timestamp takes the envelope's documented 0 default.
    let minimal = listing_action(
        "lst-tx-2",
        json!({
            "listing_id": "listing-43",
            "seller_did": "did:plc:seller",
        }),
    );
    let minimal_input = input_json("listings/minimal", &minimal)?;
    let minimal_event = normalize(minimal.clone())
        .map_err(|e| format!("listings/minimal: unexpected refusal: {e}"))?
        .ok_or("listings/minimal: recognized action was ignored")?;
    if minimal_event.timestamp != 0 {
        return Err("listings/minimal: absent timestamp must default to 0".into());
    }
    {
        let EventPayload::Product(p) = &minimal_event.payload else {
            return Err("listings/minimal: expected Product payload".into());
        };
        if p.listing_id != "listing-43"
            || p.category.is_some()
            || p.title.is_some()
            || p.amount.is_some()
            || p.asset_id.is_some()
        {
            return Err("listings/minimal: absent optionals must stay None".into());
        }
    }

    // -- Case 3: REFUSAL — required field missing (mirrors the proven
    //    malformed_listing_missing_seller_did_errors test).
    let missing = listing_action(
        "lst-tx-3",
        json!({
            "listing_id": "listing-44",
            "title": "No seller on this one",
            "timestamp": 1_782_000_300i64,
        }),
    );
    let missing_input = input_json("listings/refusal-missing", &missing)?;
    let missing_err = match normalize(missing.clone()) {
        Err(e) => e,
        other => {
            return Err(format!(
                "listings/refusal-missing: expected refusal ({other:?})"
            ))
        }
    };
    if missing_err
        != (NormalizerError::MissingField {
            action: "lovismarket:addlisting".into(),
            field: "seller_did",
        })
    {
        return Err(format!(
            "listings/refusal-missing: wrong typed error ({missing_err:?})"
        ));
    }

    // -- Case 4: REFUSAL — present-but-wrong-type (mirrors the proven
    //    malformed_listing_wrong_type_errors test).
    let badtype = listing_action(
        "lst-tx-4",
        json!({
            "listing_id": "listing-45",
            "seller_did": "did:plc:seller",
            "amount": "not-a-number",
            "timestamp": 1_782_000_400i64,
        }),
    );
    let badtype_input = input_json("listings/refusal-badtype", &badtype)?;
    let badtype_err = match normalize(badtype.clone()) {
        Err(e) => e,
        other => {
            return Err(format!(
                "listings/refusal-badtype: expected refusal ({other:?})"
            ))
        }
    };
    if badtype_err
        != (NormalizerError::BadFieldType {
            action: "lovismarket:addlisting".into(),
            field: "amount",
            expected: "u64",
        })
    {
        return Err(format!(
            "listings/refusal-badtype: wrong typed error ({badtype_err:?})"
        ));
    }

    let generated_from = std::env::var("DEMO_GENERATED_FROM").unwrap_or_else(|_| {
        "unset — set DEMO_GENERATED_FROM=$(git rev-parse HEAD) when writing fixtures/".into()
    });

    Ok(json!({
        "schema": "shared-types §9.3 CanonicalEvent (versioned) — Product family via normalizer",
        "generated_by": "DEMO_GENERATED_FROM=$(git rev-parse HEAD) cargo run -q -p composition --bin listings-fixture",
        "generated_from": generated_from,
        "source_of_truth": "normalizer::normalize — (\"lovismarket\",\"addlisting\") arm → EventType::ProductListed (crates/normalizer/src/lib.rs); typed refusals NormalizerError::{MissingField, BadFieldType}",
        "serialization_note": "success events are serde-serialized from the real CanonicalEvent structs; inputs are echoed from the same RawChainAction instances the normalizer consumed (data embeds the identical serde_json::Value, zero transcription); refusals are hand-mapped with the error's real field names and round-trip-verified",
        "listings": [
            {
                "case": "fully_populated",
                "input": full_input,
                "outcome": { "event": jval(&full_event)? },
            },
            {
                "case": "minimal_required_only",
                "input": minimal_input,
                "outcome": { "event": jval(&minimal_event)? },
            },
            {
                "case": "refusal_missing_field",
                "input": missing_input,
                "outcome": { "refused": refusal_json("listings/refusal-missing", &missing_err)? },
            },
            {
                "case": "refusal_bad_field_type",
                "input": badtype_input,
                "outcome": { "refused": refusal_json("listings/refusal-badtype", &badtype_err)? },
            },
        ],
    }))
}
