//! Offline host-side validation for the pinned browser SDK qualification.
//! No network, wallet, payment, provider, or signing capability is linked here.

mod graph;
mod summary;

use base64::{engine::general_purpose::STANDARD, Engine};
use regex::Regex;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;

pub const MAX_INPUT_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_ENTRIES: usize = 4096;
const VERSIONS: [&str; 2] = ["0.1.2", "0.1.5"];
const WASM: &str = "wasm/ant_core_bg.wasm";
// PUBLIC-CONSTANT: upstream 0.1.5 WASM digest, never key material.
const CANDIDATE_WASM: &str = "eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf"; // PUBLIC-CONSTANT

type Result<T> = std::result::Result<T, String>;

fn field<'a>(value: &'a Value, name: &str) -> Result<&'a str> {
    value
        .get(name)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("{name} must be a nonempty string"))
}

fn absolute_path(value: &Value, name: &str) -> Result<PathBuf> {
    let path = PathBuf::from(field(value, name)?);
    if !path.is_absolute() {
        return Err(format!("{name} must be an absolute path"));
    }
    Ok(path)
}

fn version(value: &Value) -> Result<&str> {
    let version = field(value, "version")?;
    check_version(version)?;
    Ok(version)
}

fn check_version(version: &str) -> Result<()> {
    if VERSIONS.contains(&version) {
        Ok(())
    } else {
        Err(format!("unknown SDK version {version}"))
    }
}

fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    let metadata = fs::metadata(path).map_err(|error| format!("{}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("{} is not a regular file", path.display()));
    }
    if metadata.len() > MAX_INPUT_BYTES {
        return Err(format!("{} exceeds 64 MiB file limit", path.display()));
    }
    let file = File::open(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(MAX_INPUT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("{}: {error}", path.display()))?;
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return Err(format!("{} exceeds 64 MiB file limit", path.display()));
    }
    Ok(bytes)
}

fn read_json(path: &Path) -> Result<Value> {
    serde_json::from_slice(&read_bounded(path)?)
        .map_err(|error| format!("{}: invalid JSON: {error}", path.display()))
}

fn pins_for(request: &Value) -> Result<Value> {
    match request.get("pins") {
        Some(pins) if !pins.is_null() => Ok(pins.clone()),
        _ => {
            read_json(&absolute_path(request, "repo")?.join("vendor/ant-browser-sdk/SDK_PINS.json"))
        }
    }
}

fn table<'a>(pins: &'a Value, version: &str) -> Result<&'a Map<String, Value>> {
    check_version(version)?;
    let table = pins
        .get(version)
        .and_then(Value::as_object)
        .ok_or_else(|| format!("unknown SDK version {version}: pin table missing"))?;
    if table.is_empty() || table.len() > MAX_ENTRIES {
        return Err(format!(
            "SDK {version}: pin table must contain 1..={MAX_ENTRIES} assets"
        ));
    }
    Ok(table)
}

fn valid_rel(rel: &str) -> Result<PathBuf> {
    if rel.is_empty() || rel.len() > 4096 || rel.contains(['\\', ':', '\0']) {
        return Err(format!("invalid relative SDK path {rel:?}"));
    }
    let path = PathBuf::from(rel);
    if path
        .components()
        .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(format!("SDK path escapes or is noncanonical: {rel}"));
    }
    // Path normalisation would otherwise erase duplicate separators and `.`.
    if rel
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(format!("SDK path escapes or is noncanonical: {rel}"));
    }
    Ok(path)
}

fn contained_path(root: &Path, rel: &str) -> Result<PathBuf> {
    let path = root.join(valid_rel(rel)?);
    let canonical =
        fs::canonicalize(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    if !canonical.starts_with(root) {
        return Err(format!("SDK path escapes vendor dir: {rel}"));
    }
    Ok(canonical)
}

fn pin_fields<'a>(
    table: &'a Map<String, Value>,
    version: &str,
    rel: &str,
) -> Result<(u64, &'a str)> {
    valid_rel(rel)?;
    let pin = table
        .get(rel)
        .ok_or_else(|| format!("SDK {version}: unexpected asset {rel}"))?;
    let bytes = pin
        .get("bytes")
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("SDK {version}: invalid byte pin for {rel}"))?;
    let sha = pin
        .get("sha256")
        .and_then(Value::as_str)
        .filter(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
        .ok_or_else(|| format!("SDK {version}: invalid SHA-256 pin for {rel}"))?;
    if bytes > MAX_INPUT_BYTES {
        return Err(format!(
            "SDK {version}: {rel} pin exceeds 64 MiB asset limit"
        ));
    }
    Ok((bytes, sha))
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn decoded_body(request: &Value) -> Result<Vec<u8>> {
    let encoded = request
        .get("body_b64")
        .and_then(Value::as_str)
        .ok_or_else(|| "body_b64 must be a string".to_string())?;
    if encoded.len() as u64 > MAX_INPUT_BYTES {
        return Err("body_b64 exceeds request limit".into());
    }
    STANDARD
        .decode(encoded)
        .map_err(|error| format!("body_b64: {error}"))
}

fn verify_dir(request: &Value) -> Result<Value> {
    let version = version(request)?;
    let pins = pins_for(request)?;
    let table = table(&pins, version)?;
    let dir = match request.get("dir").filter(|value| !value.is_null()) {
        Some(_) => absolute_path(request, "dir")?,
        None => absolute_path(request, "repo")?
            .join("vendor/ant-browser-sdk")
            .join(version),
    };
    let root = fs::canonicalize(&dir).map_err(|error| format!("{}: {error}", dir.display()))?;
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }
    let mut total_bytes = 0u64;
    for rel in table.keys() {
        let (bytes, expected) = pin_fields(table, version, rel)?;
        let body = read_bounded(&contained_path(&root, rel)?)?;
        let sha = digest(&body);
        if body.len() as u64 != bytes || sha != expected {
            return Err(format!(
                "SDK {version} mismatch: {rel} served {} bytes sha256 {sha}",
                body.len()
            ));
        }
        total_bytes += body.len() as u64;
        if total_bytes > MAX_TOTAL_BYTES {
            return Err("SDK inventory exceeds 512 MiB total limit".into());
        }
    }
    let mut pending = vec![root.clone()];
    let mut directories = BTreeSet::new();
    let mut entries = 0usize;
    while let Some(dir) = pending.pop() {
        if !directories.insert(dir.clone()) {
            continue;
        }
        for item in fs::read_dir(&dir).map_err(|error| format!("{}: {error}", dir.display()))? {
            entries += 1;
            if entries > MAX_ENTRIES {
                return Err("SDK inventory exceeds entry limit".into());
            }
            let item = item.map_err(|error| format!("SDK inventory: {error}"))?;
            let path = item.path();
            let canonical =
                fs::canonicalize(&path).map_err(|error| format!("{}: {error}", path.display()))?;
            if !canonical.starts_with(&root) {
                return Err(format!("SDK path escapes vendor dir: {}", path.display()));
            }
            if canonical.is_dir() {
                pending.push(canonical);
            } else if path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| matches!(extension, "js" | "mjs" | "wasm"))
            {
                let rel = path
                    .strip_prefix(&root)
                    .map_err(|error| error.to_string())?
                    .to_str()
                    .ok_or_else(|| "SDK path is not UTF-8".to_string())?
                    .replace('\\', "/");
                if !table.contains_key(&rel) {
                    return Err(format!("SDK {version} has unpinned file {rel}"));
                }
            }
        }
    }
    Ok(json!({"files": table.len(), "totalBytes": total_bytes}))
}

fn served(request: &Value) -> Result<Value> {
    let version = version(request)?;
    let pins = pins_for(request)?;
    let table = table(&pins, version)?;
    let rel = field(request, "rel")?;
    let (expected_bytes, expected_sha) = pin_fields(table, version, rel)?;
    let status = request
        .get("status")
        .and_then(Value::as_u64)
        .ok_or_else(|| "status must be an HTTP status integer".to_string())?;
    if status != 200 {
        return Err(format!("SDK {version}: {rel} served HTTP {status}"));
    }
    let bytes = decoded_body(request)?;
    let sha = digest(&bytes);
    if bytes.len() as u64 != expected_bytes || sha != expected_sha {
        return Err(format!(
            "SDK {version} mismatch: {rel} served {} bytes sha256 {sha}",
            bytes.len()
        ));
    }
    Ok(json!({"rel": rel, "bytes": bytes.len(), "sha256": sha}))
}

fn overlay(request: &Value) -> Result<Value> {
    let selected = version(request)?;
    let html = field(request, "html")?;
    if html.len() as u64 > MAX_INPUT_BYTES {
        return Err("HTML exceeds 64 MiB limit".into());
    }
    static ROOT_PATTERN: OnceLock<Regex> = OnceLock::new();
    let prefix_count = html.matches("/vendor/ant-browser-sdk/").count();
    if prefix_count == 0 {
        return Err("candidate HTML carries no selectable SDK root".into());
    }
    if prefix_count != 1 {
        return Err("candidate HTML carries ambiguous SDK roots".into());
    }
    let pattern = ROOT_PATTERN.get_or_init(|| {
        Regex::new(r#"/vendor/ant-browser-sdk/([^/\s'"\\]+)/"#).expect("constant root regex")
    });
    let mut roots = pattern.captures_iter(html);
    let source = roots
        .next()
        .ok_or_else(|| "unknown SDK source root".to_string())?;
    if roots.next().is_some() {
        return Err("candidate HTML carries ambiguous SDK roots".into());
    }
    let source_version = &source[1];
    if !VERSIONS.contains(&source_version) {
        return Err(format!("unknown SDK source root {source_version}"));
    }
    let out = html
        .replace(&source[0], &format!("/vendor/ant-browser-sdk/{selected}/"))
        .replace(
            &format!("sdk:'{source_version}'"),
            &format!("sdk:'{selected}'"),
        )
        .replace(
            &format!("dr?dr.sdk:'{source_version}'"),
            &format!("dr?dr.sdk:'{selected}'"),
        );
    Ok(Value::String(out))
}

/// Execute one bounded, offline operation. Caller-supplied pins are an explicit
/// expected-value input; default pins come from the caller's repository root.
pub fn execute(request: &Value) -> Result<Value> {
    if !request.is_object() {
        return Err("request must be an object".into());
    }
    match field(request, "op")? {
        "sha256" => Ok(Value::String(digest(&decoded_body(request)?))),
        "verify-dir" => verify_dir(request),
        "served" => served(request),
        "overlay" => overlay(request),
        "module-closure" => graph::check(request, false),
        "reader-closure" => graph::check(request, true),
        "summarize" => summary::summarize(request),
        op => Err(format!("unknown operation {op}")),
    }
}
