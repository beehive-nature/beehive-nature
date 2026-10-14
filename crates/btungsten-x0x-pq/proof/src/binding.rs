use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
    process::Command,
};

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub fn tag(bytes: &[u8]) -> String {
    const ABC: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let digest = Sha256::digest(bytes);
    let mut out = String::from("sha256:");
    for chunk in digest.chunks(3) {
        let value = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        for i in 0..chunk.len() + 1 {
            out.push(ABC[((value >> (18 - 6 * i)) & 63) as usize] as char);
        }
    }
    out
}

pub fn check_hash(path: &str, bytes: &[u8], expected: &str) -> Result<()> {
    if tag(bytes) != expected {
        return Err(format!("SOURCE MISMATCH: {path}").into());
    }
    Ok(())
}

pub fn command_json(mut cmd: Command) -> Result<Value> {
    let output = cmd.output()?;
    if !output.status.success() {
        return Err(format!(
            "command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}

// Cargo emits these scalar fields as JSON-compatible strings. Refuse any
// package that cannot be parsed; no partial lock comparison is accepted.
fn lock_packages(path: &Path) -> Result<BTreeSet<(String, String, String, String)>> {
    let mut rows = BTreeSet::new();
    for block in fs::read_to_string(path)?.split("[[package]]").skip(1) {
        let scalar = |key: &str| -> Result<Option<String>> {
            let prefix = format!("{key} = ");
            let values: Vec<_> = block
                .lines()
                .filter_map(|l| l.strip_prefix(&prefix))
                .collect();
            match values.as_slice() {
                [] => Ok(None),
                [value] => Ok(Some(serde_json::from_str(value)?)),
                _ => Err(format!("duplicate lock field {key}").into()),
            }
        };
        let name = scalar("name")?.ok_or("lock package has no name")?;
        let version = scalar("version")?.ok_or("lock package has no version")?;
        let source = scalar("source")?;
        let checksum = scalar("checksum")?;
        if let (Some(source), Some(checksum)) = (source, checksum) {
            rows.insert((name, version, source, checksum));
        } else if name != "pq-prepare-proof" && name != "btungsten-x0x-pq" && name != "btungsten-pq"
        {
            return Err(format!("unexpected unpinned package {name}").into());
        }
    }
    if rows.is_empty() {
        return Err("empty lock coverage".into());
    }
    Ok(rows)
}

fn source_paths(dir: &Path, base: &Path, paths: &mut BTreeSet<String>) -> Result<()> {
    for e in fs::read_dir(dir)? {
        let e = e?;
        if e.file_type()?.is_symlink() {
            return Err("symlink in pinned crate".into());
        }
        let p = e.path();
        if p.is_dir() {
            source_paths(&p, base, paths)?;
        } else if matches!(p.extension().and_then(|x| x.to_str()), Some("rs" | "toml")) {
            paths.insert(p.strip_prefix(base)?.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

pub fn verify(root: &Path, proof: &Path) -> Result<Value> {
    let pins: Value = serde_json::from_str(include_str!("../bindings.json"))?;
    let mut hashes = BTreeMap::new();
    for (path, expected) in pins["files"].as_object().ok_or("no source pins")? {
        check_hash(
            path,
            &fs::read(root.join(path))?,
            expected.as_str().ok_or("bad source pin")?,
        )?;
        hashes.insert(path.clone(), expected.clone());
    }
    let parent = lock_packages(&proof.join("../Cargo.lock"))?;
    let locked = lock_packages(&proof.join("Cargo.lock"))?;
    if !locked.is_subset(&parent) {
        return Err("proof lock differs from the pinned implementation lock".into());
    }
    let mut cmd = Command::new("cargo");
    cmd.args([
        "metadata",
        "--locked",
        "--offline",
        "--format-version",
        "1",
        "--manifest-path",
    ])
    .arg(proof.join("Cargo.toml"));
    let meta = command_json(cmd)?;
    for pin in pins["packages"].as_array().ok_or("missing package pins")? {
        let packages: Vec<_> = meta["packages"]
            .as_array()
            .ok_or("metadata has no packages")?
            .iter()
            .filter(|p| p["name"] == pin["name"])
            .collect();
        if packages.len() != 1
            || packages[0]["version"] != pin["version"]
            || packages[0]["source"] != "registry+https://github.com/rust-lang/crates.io-index"
        {
            return Err(format!("wrong or ambiguous package {}", pin["name"]).into());
        }
        let package = packages[0];
        let dir = Path::new(
            package["manifest_path"]
                .as_str()
                .ok_or("bad manifest path")?,
        )
        .parent()
        .ok_or("manifest lacks parent")?;
        let mut actual = BTreeSet::new();
        source_paths(dir, dir, &mut actual)?;
        let files = pin["files"].as_object().ok_or("no package file pins")?;
        if actual != files.keys().cloned().collect() {
            return Err("package source file set changed".into());
        }
        for (path, expected) in files {
            check_hash(
                path,
                &fs::read(dir.join(path))?,
                expected.as_str().ok_or("bad file digest")?,
            )?;
            hashes.insert(
                format!(
                    "{}-{}/{}",
                    pin["name"].as_str().unwrap(),
                    pin["version"].as_str().unwrap(),
                    path
                ),
                expected.clone(),
            );
        }
        let node = meta["resolve"]["nodes"]
            .as_array()
            .ok_or("missing resolved graph")?
            .iter()
            .find(|n| n["id"] == package["id"])
            .ok_or("missing package features")?;
        if node["features"]
            .as_array()
            .ok_or("missing features")?
            .iter()
            .any(|x| x == "dudect")
        {
            return Err("dudect is not the pinned verification configuration".into());
        }
    }
    // Binds a direct invocation of an old binary to its compiled-in inputs too.
    for (path, bytes) in [
        ("Cargo.toml", &include_bytes!("../Cargo.toml")[..]),
        ("Cargo.lock", &include_bytes!("../Cargo.lock")[..]),
        ("bindings.json", &include_bytes!("../bindings.json")[..]),
        ("src/lib.rs", &include_bytes!("lib.rs")[..]),
        ("src/main.rs", &include_bytes!("main.rs")[..]),
        ("src/native.rs", &include_bytes!("native.rs")[..]),
        ("src/binding.rs", &include_bytes!("binding.rs")[..]),
        ("src/names.rs", &include_bytes!("names.rs")[..]),
        ("src/obligations.rs", &include_bytes!("obligations.rs")[..]),
        ("src/runner.rs", &include_bytes!("runner.rs")[..]),
        ("common.saw", &include_bytes!("../common.saw")[..]),
        ("Boundary.cry", &include_bytes!("../Boundary.cry")[..]),
    ] {
        let digest = tag(bytes);
        check_hash(path, &fs::read(proof.join(path))?, &digest)?;
        hashes.insert(format!("proof/{path}"), Value::String(digest));
    }
    Ok(
        json!({"base_commit":pins["base_commit"],"source_sha256":hashes,"locked_packages":locked.len()}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_drift_is_refused_by_the_real_gate() {
        let good = b"pk.verify(message, signature, context)";
        let pin = tag(good);
        assert!(check_hash("candidate", good, &pin).is_ok());
        let err = check_hash("candidate", b"true", &pin)
            .unwrap_err()
            .to_string();
        assert_eq!(err, "SOURCE MISMATCH: candidate");
        assert!(check_hash("candidate", b"", &pin).is_err());
    }
}
