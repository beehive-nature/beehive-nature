//! Artifact trees: the digest of a candidate as it exists on disk, and the
//! set of paths a candidate actually changed against the baseline.
//!
//! The controller never trusts a declared change list. It computes the diff
//! itself and refuses a proposal whose declaration disagrees.

use std::collections::BTreeMap;
use std::path::Path;

use crate::digest::{hash, Digest32};
use crate::Refusal;

/// Every regular file under `root`, keyed by its `/`-separated relative path,
/// valued by the SHA3 of its bytes. Symlinks and other special files are
/// refused: a link can point outside the tree the digest claims to cover.
pub fn manifest(root: &Path) -> Result<BTreeMap<String, Digest32>, Refusal> {
    let mut out = BTreeMap::new();
    walk(root, root, &mut out)?;
    Ok(out)
}

fn walk(root: &Path, dir: &Path, out: &mut BTreeMap<String, Digest32>) -> Result<(), Refusal> {
    let rd = std::fs::read_dir(dir).map_err(|e| io(dir, e))?;
    for entry in rd {
        let entry = entry.map_err(|e| io(dir, e))?;
        let path = entry.path();
        let ft = entry.file_type().map_err(|e| io(&path, e))?;
        if ft.is_symlink() {
            return Err(Refusal::Artifact(format!(
                "symlink in artifact tree: {}",
                path.display()
            )));
        }
        if ft.is_dir() {
            walk(root, &path, out)?;
        } else if ft.is_file() {
            let rel = rel_path(root, &path)?;
            let bytes = std::fs::read(&path).map_err(|e| io(&path, e))?;
            out.insert(rel, hash("bnrose-evolve/file/v1", &[&bytes]));
        } else {
            return Err(Refusal::Artifact(format!(
                "special file in artifact tree: {}",
                path.display()
            )));
        }
    }
    Ok(())
}

fn rel_path(root: &Path, path: &Path) -> Result<String, Refusal> {
    let rel = path
        .strip_prefix(root)
        .map_err(|_| Refusal::Artifact("path escaped its root".into()))?;
    let mut parts = Vec::new();
    for c in rel.components() {
        match c {
            std::path::Component::Normal(s) => parts.push(
                s.to_str()
                    .ok_or_else(|| Refusal::Artifact("non-UTF-8 file name".into()))?
                    .to_string(),
            ),
            _ => return Err(Refusal::Artifact("unexpected path component".into())),
        }
    }
    Ok(parts.join("/"))
}

fn io(p: &Path, e: std::io::Error) -> Refusal {
    Refusal::Artifact(format!("{}: {e}", p.display()))
}

/// The digest of a whole tree: paths and file digests in sorted order.
pub fn digest_of(m: &BTreeMap<String, Digest32>) -> Digest32 {
    let mut parts: Vec<&[u8]> = Vec::with_capacity(m.len() * 2);
    for (k, v) in m {
        parts.push(k.as_bytes());
        parts.push(&v.0);
    }
    hash("bnrose-evolve/tree/v1", &parts)
}

pub fn tree_digest(root: &Path) -> Result<Digest32, Refusal> {
    Ok(digest_of(&manifest(root)?))
}

/// Paths added, removed or modified between two manifests, sorted.
pub fn changed(
    base: &BTreeMap<String, Digest32>,
    cand: &BTreeMap<String, Digest32>,
) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for (k, v) in cand {
        if base.get(k) != Some(v) {
            out.push(k.clone());
        }
    }
    for k in base.keys() {
        if !cand.contains_key(k) {
            out.push(k.clone());
        }
    }
    out.sort();
    out.dedup();
    out
}

/// Does `path` sit under `prefix`? A prefix ending in `/` names a directory;
/// otherwise it names one exact file. `svc` therefore never matches `svcx/a`.
pub fn under(path: &str, prefix: &str) -> bool {
    if let Some(dir) = prefix.strip_suffix('/') {
        path == dir || path.starts_with(prefix)
    } else {
        path == prefix
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_are_exact() {
        assert!(under("svc/a.rs", "svc/"));
        assert!(!under("svcx/a.rs", "svc/"));
        assert!(under("policy.txt", "policy.txt"));
        assert!(!under("policy.txt.bak", "policy.txt"));
        assert!(
            under("svc", "svc/"),
            "deleting the directory itself is inside it"
        );
    }

    #[test]
    fn changed_sees_add_remove_modify() {
        let d = |s: &str| hash("x", &[s.as_bytes()]);
        let base: BTreeMap<_, _> = [("a".to_string(), d("1")), ("b".to_string(), d("2"))].into();
        let cand: BTreeMap<_, _> = [("a".to_string(), d("9")), ("c".to_string(), d("3"))].into();
        assert_eq!(changed(&base, &cand), vec!["a", "b", "c"]);
        assert!(changed(&base, &base).is_empty());
    }
}
