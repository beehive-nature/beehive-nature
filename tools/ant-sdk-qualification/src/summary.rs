use crate::{
    absolute_path, check_version, field, pin_fields, pins_for, read_bounded, table, Result,
    CANDIDATE_WASM, MAX_ENTRIES, MAX_TOTAL_BYTES, WASM,
};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

fn optional_bool(record: &Value, key: &str) -> Result<Option<bool>> {
    match record.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(value)) => Ok(Some(*value)),
        Some(_) => Err(format!("receipt {key} must be a boolean or null")),
    }
}

fn arm(record: &Value) -> Result<&str> {
    let sdk = record.get("sdk").filter(|value| !value.is_null());
    let version = record.get("version").filter(|value| !value.is_null());
    if let (Some(sdk), Some(version)) = (sdk, version) {
        if sdk != version {
            return Err("receipt has conflicting sdk/version arms".into());
        }
    }
    let arm = sdk
        .or(version)
        .and_then(Value::as_str)
        .ok_or_else(|| "receipt SDK arm missing or malformed".to_string())?;
    check_version(arm)?;
    Ok(arm)
}

fn row(file: &str, record: &Value, pins: &Value) -> Result<Value> {
    if !record.is_object() {
        return Err("receipt must be a JSON object".into());
    }
    let arm = arm(record)?;
    let table = table(pins, arm)?;
    let accepted = optional_bool(record, "accepted")?;
    let ok = optional_bool(record, "ok")?;
    if matches!((accepted, ok), (Some(a), Some(b)) if a != b) {
        return Err("receipt has conflicting accepted/ok outcomes".into());
    }
    let accepted = accepted.or(ok);
    for key in [
        "integrityMatches",
        "integrityAfterSeek",
        "sdkVerified",
        "wasmVerified",
        "entryVerified",
    ] {
        optional_bool(record, key)?;
    }
    let mut evidence: BTreeMap<String, (String, Option<u64>)> = BTreeMap::new();
    let mut count = 0usize;
    // Validate both arrays when both exist. An empty sdkDigests must never hide
    // contradictory served evidence through fallback/truthiness selection.
    for key in ["sdkDigests", "served"] {
        let Some(entries) = record.get(key).filter(|value| !value.is_null()) else {
            continue;
        };
        let entries = entries
            .as_array()
            .ok_or_else(|| format!("receipt {key} must be an array"))?;
        for entry in entries {
            count += 1;
            if count > MAX_ENTRIES {
                return Err("receipt digest inventory exceeds entry limit".into());
            }
            let rel = field(entry, "rel")?;
            let (expected_bytes, expected_sha) = pin_fields(table, arm, rel)?;
            let sha = field(entry, "sha256")?;
            let bytes = match entry.get("bytes") {
                None => None,
                Some(value) => Some(
                    value
                        .as_u64()
                        .ok_or_else(|| format!("invalid digest byte count for {rel}"))?,
                ),
            };
            if sha != expected_sha || bytes.is_some_and(|bytes| bytes != expected_bytes) {
                return Err(format!("SDK {arm} mismatch in receipt asset {rel}"));
            }
            if let Some(previous) = evidence.get(rel) {
                if previous.0 != sha || matches!((previous.1, bytes), (Some(a), Some(b)) if a != b)
                {
                    return Err(format!("conflicting duplicate receipt asset {rel}"));
                }
            }
            evidence.insert(rel.to_string(), (sha.to_string(), bytes));
        }
    }
    let complete = evidence.contains_key("index.js") && evidence.contains_key(WASM);
    if accepted == Some(true) && !complete {
        return Err("accepted receipt lacks required index.js and WASM provenance".into());
    }
    let provenance = if complete { "verified" } else { "missing" };
    let wasm = evidence.get(WASM);
    let cohort = if file.starts_with("smoke") {
        "block1-smoke"
    } else if file.contains("-cold") {
        "cold"
    } else if file.contains("-warm") {
        "warm"
    } else if file.starts_with("seek") {
        "seek"
    } else if file.starts_with("reader") {
        "reader-exercise"
    } else {
        "abort-close"
    };
    let mut row = Map::new();
    row.insert("file".into(), json!(file));
    row.insert("arm".into(), json!(arm));
    row.insert("cohort".into(), json!(cohort));
    row.insert(
        "route".into(),
        record.get("route").cloned().unwrap_or(Value::Null),
    );
    if let Some(accepted) = accepted {
        row.insert("accepted".into(), json!(accepted));
    }
    // These are reported measurement outcomes. Neither a nonempty content hash
    // nor valid asset provenance demonstrates a successful content transfer.
    row.insert(
        "integrityMatches".into(),
        record
            .get("integrityMatches")
            .filter(|value| !value.is_null())
            .or_else(|| record.get("integrityAfterSeek"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    for key in [
        "elapsedMs",
        "receivedAtMs",
        "stalls",
        "stallMs",
        "relayRequests",
        "pageErrors",
        "sdkVerified",
        "computedSha256",
    ] {
        if let Some(value) = record.get(key) {
            row.insert(key.into(), value.clone());
        }
    }
    for (target, source) in [("transportBytes", "bytes"), ("dials", "dials")] {
        row.insert(
            target.into(),
            record
                .get("transportSummary")
                .and_then(|value| value.get(source))
                .cloned()
                .unwrap_or(Value::Null),
        );
    }
    row.insert("assetProvenance".into(), json!(provenance));
    row.insert("wasmDigestOk".into(), json!(wasm.is_some()));
    row.insert(
        "candidateWasm".into(),
        wasm.map(|wasm| json!(wasm.0 == CANDIDATE_WASM))
            .unwrap_or(Value::Null),
    );
    let cache = match record.get("warm").filter(|value| !value.is_null()) {
        Some(warm) => {
            if !warm.is_object() {
                return Err("receipt warm phase must be an object".into());
            }
            optional_bool(warm, "integrityMatches")?;
            let mut cache = Map::new();
            for key in [
                "source",
                "integrityMatches",
                "sdkRequests",
                "relayRequests",
                "dials",
            ] {
                if let Some(value) = warm.get(key) {
                    cache.insert(key.into(), value.clone());
                }
            }
            Value::Object(cache)
        }
        None => Value::Null,
    };
    row.insert("cache".into(), cache);
    Ok(Value::Object(row))
}

fn replace_summary(dir: &Path, bytes: &[u8]) -> Result<()> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let temp = dir.join(format!(
        ".SUMMARY.{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| format!("{}: {error}", temp.display()))?;
    let result = (|| {
        file.write_all(bytes)
            .map_err(|error| format!("summary write: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("summary sync: {error}"))?;
        drop(file);
        // Same-directory rename replaces the old file only after full validation
        // and writing. Never delete the previous summary to make rename succeed.
        fs::rename(&temp, dir.join("SUMMARY.json"))
            .map_err(|error| format!("summary replace: {error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

pub(crate) fn summarize(request: &Value) -> Result<Value> {
    let dir = absolute_path(request, "dir")?;
    let pins = pins_for(request)?;
    let mut files = Vec::new();
    let mut entry_count = 0usize;
    for entry in fs::read_dir(&dir).map_err(|error| format!("{}: {error}", dir.display()))? {
        entry_count += 1;
        if entry_count > MAX_ENTRIES {
            return Err("receipt directory exceeds entry limit".into());
        }
        let entry = entry.map_err(|error| format!("receipt directory: {error}"))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| "receipt filename is not UTF-8".to_string())?;
        if ["block", "smoke", "seek", "reader", "abort"]
            .iter()
            .any(|prefix| name.starts_with(prefix))
        {
            // Do not follow a symlink into a different evidence directory.
            if !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_file()
            {
                return Err(format!("receipt {name} is not a regular file"));
            }
            files.push(name);
        }
    }
    files.sort();
    let mut rows = Vec::new();
    let mut total_bytes = 0u64;
    for file in files {
        let bytes = read_bounded(&dir.join(&file))?;
        total_bytes += bytes.len() as u64;
        if total_bytes > MAX_TOTAL_BYTES {
            return Err("receipt set exceeds 512 MiB total limit".into());
        }
        let record = serde_json::from_slice(&bytes)
            .map_err(|error| format!("{file}: invalid JSON: {error}"))?;
        rows.push(row(&file, &record, &pins).map_err(|error| format!("{file}: {error}"))?);
    }
    let summary = json!({
        "generated": "tools/ant-sdk-qualification",
        "schemaVersion": 1,
        "outcomeSemantics": "accepted and integrityMatches report the source measurement; assetProvenance validates recorded SDK digests against the independent pin table",
        "samples": rows.len(),
        "rows": rows,
        "PUBLIC-CONSTANT": "counts and digests of public artifacts only; no key material"
    });
    let mut bytes = serde_json::to_vec_pretty(&summary).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    if bytes.len() as u64 > crate::MAX_INPUT_BYTES {
        return Err("summary output exceeds 64 MiB result limit".into());
    }
    replace_summary(&dir, &bytes)?;
    Ok(summary)
}
