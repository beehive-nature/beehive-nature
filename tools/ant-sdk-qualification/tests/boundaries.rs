use ant_sdk_qualification::execute;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use tempfile::TempDir;

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn pins() -> Value {
    let pin = |bytes: &[u8]| json!({"bytes": bytes.len(), "sha256": hash(bytes)});
    json!({
        "0.1.2": {"index.js": pin(b"baseline entry"), "wasm/ant_core_bg.wasm": pin(b"baseline wasm")},
        "0.1.5": {"index.js": pin(b"candidate entry"), "wasm/ant_core_bg.wasm": pin(b"candidate wasm")}
    })
}

fn receipt(version: &str, accepted: bool) -> Value {
    let pins = pins();
    json!({
        "sdk": version,
        "accepted": accepted,
        "integrityMatches": accepted,
        "sdkVerified": true,
        "sdkDigests": [
            {"rel":"index.js", "bytes":pins[version]["index.js"]["bytes"], "sha256":pins[version]["index.js"]["sha256"]},
            {"rel":"wasm/ant_core_bg.wasm", "bytes":pins[version]["wasm/ant_core_bg.wasm"]["bytes"], "sha256":pins[version]["wasm/ant_core_bg.wasm"]["sha256"]}
        ]
    })
}

fn summary(dir: &Path) -> Result<Value, String> {
    execute(&json!({"op":"summarize", "dir": dir, "pins":pins()}))
}

fn write_receipt(dir: &Path, name: &str, receipt: &Value) {
    fs::write(dir.join(name), serde_json::to_vec(receipt).unwrap()).unwrap();
}

fn html(version: &str) -> String {
    format!("<!-- retained -->\nconst SDK_ROOT='/vendor/ant-browser-sdk/{version}/';\nconst receipt={{sdk:'{version}',n:42}};\nconst label=dr?dr.sdk:'{version}';\n")
}

fn overlay(html: &str, version: &str) -> Result<String, String> {
    execute(&json!({"op":"overlay","html":html,"version":version}))
        .map(|value| value.as_str().unwrap().to_owned())
}

#[test]
fn overlay_selects_both_arms_from_both_sources_and_roundtrips() {
    for source in ["0.1.2", "0.1.5"] {
        for selected in ["0.1.2", "0.1.5"] {
            let input = html(source);
            let out = overlay(&input, selected).unwrap();
            assert_eq!(out, html(selected));
            assert_eq!(overlay(&out, source).unwrap(), input);
        }
    }
}

#[test]
fn overlay_refuses_missing_unknown_and_ambiguous_roots() {
    assert!(overlay("<html>absent</html>", "0.1.2")
        .unwrap_err()
        .contains("no selectable SDK root"));
    assert!(overlay(&html("0.1.1"), "0.1.5")
        .unwrap_err()
        .contains("unknown SDK source root"));
    assert!(overlay(&html("0.1.5"), "9.9.9")
        .unwrap_err()
        .contains("unknown SDK version"));
    for second in ["0.1.2", "0.1.5"] {
        assert!(overlay(&(html("0.1.5") + &html(second)), "0.1.2")
            .unwrap_err()
            .contains("ambiguous SDK roots"));
    }
}

#[test]
fn hash_has_independent_known_answer_and_served_assets_fail_closed() {
    let known = execute(&json!({"op":"sha256", "body_b64": STANDARD.encode(b"abc")})).unwrap();
    assert_eq!(
        known,
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" // PUBLIC-CONSTANT: SHA-256 abc vector
    );
    let request = json!({"op":"served","version":"0.1.5","pins":pins(),"rel":"index.js","status":200,"body_b64":STANDARD.encode(b"candidate entry")});
    assert_eq!(
        execute(&request).unwrap()["sha256"],
        pins()["0.1.5"]["index.js"]["sha256"]
    );
    for (field, value, expected) in [
        ("status", json!(500), "HTTP 500"),
        ("rel", json!("other.js"), "unexpected asset"),
        (
            "body_b64",
            json!(STANDARD.encode(b"baseline entry")),
            "mismatch",
        ),
        ("body_b64", json!(STANDARD.encode(b"tampered")), "mismatch"),
        ("version", json!("9.9.9"), "unknown SDK version"),
    ] {
        let mut bad = request.clone();
        bad[field] = value;
        assert!(execute(&bad).unwrap_err().contains(expected));
    }
}

#[test]
fn full_directory_checks_bytes_and_unpinned_nested_assets() {
    let dir = TempDir::new().unwrap();
    fs::create_dir(dir.path().join("wasm")).unwrap();
    fs::write(dir.path().join("index.js"), b"candidate entry").unwrap();
    fs::write(dir.path().join("wasm/ant_core_bg.wasm"), b"candidate wasm").unwrap();
    let request = json!({"op":"verify-dir","version":"0.1.5","dir":dir.path(),"pins":pins()});
    assert_eq!(
        execute(&request).unwrap(),
        json!({"files":2,"totalBytes":29})
    );
    fs::create_dir_all(dir.path().join("nested/deeper")).unwrap();
    fs::write(dir.path().join("nested/deeper/stale.js"), b"stale").unwrap();
    assert!(execute(&request).unwrap_err().contains("unpinned file"));
    fs::remove_file(dir.path().join("nested/deeper/stale.js")).unwrap();
    fs::write(dir.path().join("index.js"), b"broken").unwrap();
    assert!(execute(&request).unwrap_err().contains("mismatch"));
}

#[test]
fn summary_preserves_valid_and_missing_evidence_measurements_without_inventing_integrity() {
    let dir = TempDir::new().unwrap();
    write_receipt(dir.path(), "block1.json", &receipt("0.1.5", true));
    write_receipt(
        dir.path(),
        "reader-early.json",
        &json!({"version":"0.1.5","computedSha256":"reported-only"}),
    );
    write_receipt(
        dir.path(),
        "reader-failed.json",
        &json!({"version":"0.1.5","ok":false,"error":"timeout"}),
    );
    let result = summary(dir.path()).unwrap();
    assert_eq!(result["samples"], 3);
    assert_eq!(result["rows"][0]["accepted"], true);
    assert_eq!(result["rows"][0]["assetProvenance"], "verified");
    assert_eq!(result["rows"][1]["assetProvenance"], "missing");
    assert!(result["rows"][1].get("accepted").is_none());
    assert_eq!(result["rows"][1]["integrityMatches"], Value::Null);
    assert_eq!(result["rows"][2]["accepted"], false);
    assert_eq!(result["rows"][2]["wasmDigestOk"], false);
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(dir.path().join("SUMMARY.json")).unwrap())
            .unwrap(),
        result
    );
}

#[test]
fn summary_refuses_tampering_and_preserves_preexisting_output() {
    let dir = TempDir::new().unwrap();
    let valid = receipt("0.1.5", true);
    write_receipt(dir.path(), "block1.json", &valid);
    summary(dir.path()).unwrap();
    let prior = fs::read(dir.path().join("SUMMARY.json")).unwrap();
    let mut variants = Vec::new();
    let mut bad = valid.clone();
    bad["sdkDigests"][1]["sha256"] = json!("wrong-digest");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdk"] = json!("0.1.2");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdkDigests"][0]["rel"] = json!("unknown.js");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdkDigests"][0]["bytes"] = json!(0);
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdkDigests"] = json!([]);
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdkDigests"] = json!("not-array");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["version"] = json!("0.1.2");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["accepted"] = json!("true");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["ok"] = json!(false);
    variants.push(bad);
    let mut bad = valid.clone();
    bad["sdk"] = json!("9.9.9");
    variants.push(bad);
    let mut bad = valid.clone();
    bad["served"] = valid["sdkDigests"].clone();
    bad["served"][1]["sha256"] = json!("wrong-second-array");
    variants.push(bad);
    let mut bad = valid.clone();
    let mut duplicate = bad["sdkDigests"][1].clone();
    duplicate["sha256"] = json!("conflict");
    bad["sdkDigests"].as_array_mut().unwrap().push(duplicate);
    variants.push(bad);
    for (index, bad) in variants.iter().enumerate() {
        write_receipt(dir.path(), "block2.json", bad);
        assert!(summary(dir.path()).is_err(), "variant {index} was accepted");
        assert_eq!(
            fs::read(dir.path().join("SUMMARY.json")).unwrap(),
            prior,
            "variant {index} changed prior summary"
        );
    }
    fs::write(dir.path().join("block2.json"), b"{broken").unwrap();
    assert!(summary(dir.path()).unwrap_err().contains("invalid JSON"));
    assert_eq!(fs::read(dir.path().join("SUMMARY.json")).unwrap(), prior);
    fs::remove_file(dir.path().join("block2.json")).unwrap();
    fs::create_dir(dir.path().join("block2.json")).unwrap();
    assert!(summary(dir.path())
        .unwrap_err()
        .contains("not a regular file"));
    assert_eq!(fs::read(dir.path().join("SUMMARY.json")).unwrap(), prior);
}

#[test]
fn summary_checks_both_inventories_and_allows_matching_repeated_observations() {
    let dir = TempDir::new().unwrap();
    let mut valid = receipt("0.1.5", true);
    valid["served"] = valid["sdkDigests"].clone();
    write_receipt(dir.path(), "block1.json", &valid);
    assert_eq!(
        summary(dir.path()).unwrap()["rows"][0]["assetProvenance"],
        "verified"
    );
    valid["sdkDigests"] = json!([]);
    write_receipt(dir.path(), "block1.json", &valid);
    assert_eq!(
        summary(dir.path()).unwrap()["rows"][0]["assetProvenance"],
        "verified"
    );
    valid["served"][0]["sha256"] = json!("hidden-mismatch");
    write_receipt(dir.path(), "block1.json", &valid);
    assert!(summary(dir.path()).unwrap_err().contains("mismatch"));
}

#[test]
fn module_graph_normalizes_relative_imports_and_bounds_cycles() {
    let dir = TempDir::new().unwrap();
    fs::create_dir(dir.path().join("internal")).unwrap();
    fs::write(dir.path().join("index.js"), "import {a} from './internal/a.js'; // from 'not-an-import'\nconst text=\"from 'also-not-import'\";").unwrap();
    fs::write(
        dir.path().join("internal/a.js"),
        "import '../index.js'; import {e} from '../errors.js';",
    )
    .unwrap();
    fs::write(dir.path().join("errors.js"), "export const e=1;").unwrap();
    let request = json!({"op":"reader-closure","dir":dir.path(),"entries":["index.js"]});
    let visited = execute(&request).unwrap();
    assert_eq!(visited, json!(["index.js", "internal/a.js", "errors.js"]));
    fs::write(
        dir.path().join("internal/a.js"),
        "import {e} from '../../outside.js';",
    )
    .unwrap();
    assert!(execute(&request).unwrap_err().contains("escapes"));
    fs::write(
        dir.path().join("internal/a.js"),
        "import {e} from '../missing.js';",
    )
    .unwrap();
    assert!(execute(&request).is_err());
    fs::write(
        dir.path().join("internal/a.js"),
        "import {e} from 'wallet';",
    )
    .unwrap();
    assert!(execute(&request).unwrap_err().contains("external modules"));
}

#[test]
fn graph_refuses_bare_dot_imports_and_imports_hidden_in_interpolation_or_comments() {
    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join(".wallet"), "export const x=1;").unwrap();
    let request = json!({"op":"reader-closure","dir":dir.path(),"entries":["index.js"]});
    for source in [
        "import '.wallet';",
        "const x = `${await import('https://example.invalid/wallet.js')}`;",
        "// comment\rimport 'wallet';",
        "// comment\u{2028}import 'wallet';",
        "// comment\u{2029}import 'wallet';",
        "const regex=/[//]/; import 'wallet';",
        "const regex=/x\\//; import 'wallet';",
        "const ratio=/x//2; import 'wallet';",
        "if (true) /x\\//.test('x/'); import 'wallet';",
    ] {
        fs::write(dir.path().join("index.js"), source).unwrap();
        assert!(
            execute(&request).is_err(),
            "unsupported import was accepted: {source}"
        );
    }
    let mut impossible_pin = pins();
    impossible_pin["0.1.5"]["bad\0.js"] = impossible_pin["0.1.5"]["index.js"].clone();
    assert!(execute(&json!({"op":"served","version":"0.1.5","pins":impossible_pin,"rel":"bad\0.js","status":200,"body_b64":STANDARD.encode(b"candidate entry")})).unwrap_err().contains("invalid relative SDK path"));
    fs::write(
        dir.path().join("index.js"),
        "const ratio=(6-2)/2; const regex=/[//]/; export const x=regex;",
    )
    .unwrap();
    assert_eq!(execute(&request).unwrap(), json!(["index.js"]));
}

#[test]
fn missing_optional_baseline_entries_do_not_hide_missing_imports() {
    let dir = TempDir::new().unwrap();
    let baseline = dir.path().join("0.1.2");
    fs::create_dir(&baseline).unwrap();
    for name in ["index.js", "client.js", "file-reader.js"] {
        fs::write(baseline.join(name), "export const valid=1;").unwrap();
    }
    let request = json!({"op":"reader-closure","dir":baseline});
    assert_eq!(execute(&request).unwrap().as_array().unwrap().len(), 3);
    fs::write(
        baseline.join("client.js"),
        "import {x} from './manifest.js';",
    )
    .unwrap();
    assert!(
        execute(&request).is_err(),
        "optional top-level entry was wrongly applied to an imported dependency"
    );
}

#[cfg(unix)]
#[test]
fn module_graph_refuses_escaping_symlink() {
    let dir = TempDir::new().unwrap();
    let root = dir.path().join("sdk");
    fs::create_dir(&root).unwrap();
    fs::write(dir.path().join("outside.js"), "export const x=1;").unwrap();
    fs::write(root.join("index.js"), "export {x} from './linked.js';").unwrap();
    std::os::unix::fs::symlink(dir.path().join("outside.js"), root.join("linked.js")).unwrap();
    assert!(
        execute(&json!({"op":"module-closure","dir":root,"entries":["index.js"]}))
            .unwrap_err()
            .contains("escapes")
    );
}

#[test]
fn executable_protocol_reports_errors_nonzero_without_success_output() {
    for request in [
        b"{not-json".as_slice(),
        br#"{"op":"overlay","version":"0.1.2","html":"missing"}"#.as_slice(),
    ] {
        let mut child = Command::new(env!("CARGO_BIN_EXE_ant-sdk-qualification"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(request).unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        assert!(String::from_utf8(output.stderr)
            .unwrap()
            .contains("ant-sdk-qualification:"));
    }
}
