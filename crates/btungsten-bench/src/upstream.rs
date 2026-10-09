//! Pinned upstream build copies and lockfile reading.
//!
//! A build copy is a git checkout of an upstream repository at a full commit
//! id, outside the beehive-nature workspace. The only files the RB lanes add
//! to one are their overlays (named per lane); a copy whose tracked files
//! differ from the pin, or that holds untracked files other than the overlays
//! and build output, is refused rather than reused.

use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::digest::file_tag;
use crate::measure::output;

pub struct Pin {
    pub name: &'static str,
    pub url: &'static str,
    pub rev: &'static str,
}

/// Clone `pin` into `dir` if absent, check it out at the pin, and refuse a
/// copy that is not exactly the pin plus `overlays` (paths relative to the
/// copy) and ignored build output.
pub fn build_copy(pin: &Pin, dir: &Path, overlays: &[&str]) -> Result<(), String> {
    if !dir.join(".git").exists() {
        std::fs::create_dir_all(dir.parent().unwrap_or(dir)).map_err(|e| e.to_string())?;
        let d = dir.display().to_string();
        output(
            &["git", "clone", "--quiet", "--filter=blob:none", pin.url, &d],
            Path::new("."),
        )
        .ok_or_else(|| format!("git clone {} failed", pin.url))?;
    }
    let head = output(&["git", "rev-parse", "HEAD"], dir).unwrap_or_default();
    if head.trim() != pin.rev {
        output(&["git", "fetch", "--quiet", "origin", pin.rev], dir);
        output(
            &[
                "git",
                "-c",
                "advice.detachedHead=false",
                "checkout",
                "--quiet",
                pin.rev,
            ],
            dir,
        )
        .ok_or_else(|| format!("{}: cannot check out {}", pin.name, pin.rev))?;
    }
    let head = output(&["git", "rev-parse", "HEAD"], dir).unwrap_or_default();
    if head.trim() != pin.rev {
        return Err(format!(
            "{}: build copy is at {}, not the pin {}",
            pin.name,
            head.trim(),
            pin.rev
        ));
    }
    let status = output(
        &["git", "status", "--porcelain", "--untracked-files=all"],
        dir,
    )
    .ok_or_else(|| format!("{}: git status failed", pin.name))?;
    let foreign: Vec<&str> = status
        .lines()
        .filter(|l| {
            let path = l.get(3..).unwrap_or("");
            !(l.starts_with("?? ") && overlays.contains(&path))
        })
        .collect();
    if !foreign.is_empty() {
        return Err(format!(
            "{}: build copy {} differs from the pin beyond the overlays; remove it and rerun:\n{}",
            pin.name,
            dir.display(),
            foreign.join("\n")
        ));
    }
    Ok(())
}

/// The recorded identity of a build copy: pin, HEAD, lockfile digest,
/// submodule commits, and each overlay with its digest. No upstream file is
/// modified.
pub fn identity(pin: &Pin, dir: &Path, overlays: &[&str]) -> Value {
    identity_with(
        pin,
        dir,
        overlays,
        json!("none: upstream files are not modified; overlays are added files only"),
    )
}

/// As `identity`, with the declared modifications of upstream files.
pub fn identity_with(pin: &Pin, dir: &Path, overlays: &[&str], patches: Value) -> Value {
    let lock = file_tag(&dir.join("Cargo.lock")).map(|(t, _)| t).ok();
    let subs: Vec<Value> = output(&["git", "submodule", "status", "--recursive"], dir)
        .unwrap_or_default()
        .lines()
        .filter_map(|l| {
            let mut it = l.trim_start_matches([' ', '+', '-', 'U']).split_whitespace();
            Some(json!({ "commit": it.next()?, "path": it.next()?, "initialized": !l.starts_with('-') }))
        })
        .collect();
    let ov: Vec<Value> = overlays
        .iter()
        .map(|p| match file_tag(&dir.join(p)) {
            Ok((t, n)) => json!({ "path": p, "sha256": t, "bytes": n }),
            Err(e) => json!({ "path": p, "missing": e.to_string() }),
        })
        .collect();
    json!({
        "repo": pin.url,
        "pinned_rev": pin.rev,
        "head": output(&["git", "rev-parse", "HEAD"], dir).map(|s| s.trim().to_string()),
        "commit_date": output(&["git", "log", "-1", "--format=%cI"], dir).map(|s| s.trim().to_string()),
        "cargo_lock": lock,
        "submodules": subs,
        "overlays": ov,
        "patches": patches,
    })
}

/// One `[[package]]` entry of a Cargo.lock.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LockPkg {
    pub name: String,
    pub version: String,
    pub source: Option<String>,
    pub checksum: Option<String>,
}

pub fn read_lock(path: &Path) -> Result<Vec<LockPkg>, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(parse_lock(&text))
}

pub fn parse_lock(text: &str) -> Vec<LockPkg> {
    let mut out = Vec::new();
    let mut cur: Option<LockPkg> = None;
    let val = |l: &str| {
        l.split_once(" = ")
            .map(|(_, v)| v.trim().trim_matches('"').to_string())
    };
    for line in text.lines() {
        if line.trim() == "[[package]]" {
            out.extend(cur.take());
            cur = Some(LockPkg {
                name: String::new(),
                version: String::new(),
                source: None,
                checksum: None,
            });
            continue;
        }
        if line.starts_with('[') {
            out.extend(cur.take());
            continue;
        }
        let Some(p) = cur.as_mut() else { continue };
        if line.starts_with("name = ") {
            p.name = val(line).unwrap_or_default();
        } else if line.starts_with("version = ") {
            p.version = val(line).unwrap_or_default();
        } else if line.starts_with("source = ") {
            p.source = val(line);
        } else if line.starts_with("checksum = ") {
            p.checksum = val(line);
        }
    }
    out.extend(cur);
    out
}

pub fn find<'a>(lock: &'a [LockPkg], name: &str) -> Vec<&'a LockPkg> {
    lock.iter().filter(|p| p.name == name).collect()
}

/// The commit a git-sourced lock entry is pinned to (`...#<commit>`).
pub fn git_commit(p: &LockPkg) -> Option<&str> {
    p.source
        .as_deref()
        .filter(|s| s.starts_with("git+"))
        .and_then(|s| s.rsplit_once('#'))
        .map(|(_, c)| c)
}

pub fn pkg_json(p: &LockPkg) -> Value {
    json!({ "name": p.name, "version": p.version, "source": p.source, "checksum_present": p.checksum.is_some(), "git_commit": git_commit(p) })
}

/// Repository root of the beehive-nature checkout this binary runs in.
pub fn repo_root() -> PathBuf {
    let start = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut d: &Path = &start;
    loop {
        if d.join("crates/btungsten-bench/Cargo.toml").exists() {
            return d.to_path_buf();
        }
        match d.parent() {
            Some(p) => d = p,
            None => return start,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_entries_and_git_pins_are_read() {
        let text = r#"
version = 4

[[package]]
name = "aes"
version = "0.8.4"
source = "git+https://github.com/RyanGlScott/block-ciphers.git?branch=backport#13b158c98807b0b468b0dde3742149ebc149a321"
dependencies = [
 "cfg-if",
]

[[package]]
name = "cipher"
version = "0.4.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "abc"

[metadata]
x = "y"
"#;
        let l = parse_lock(text);
        assert_eq!(l.len(), 2);
        assert_eq!(
            git_commit(&l[0]),
            Some("13b158c98807b0b468b0dde3742149ebc149a321")
        );
        assert_eq!(l[1].checksum.as_deref(), Some("abc"));
        assert_eq!(git_commit(&l[1]), None);
        assert_eq!(find(&l, "cipher")[0].version, "0.4.4");
    }
}
