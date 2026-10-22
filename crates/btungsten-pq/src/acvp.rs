//! NIST ACVP vector files, fetched at a pinned commit and refused unless
//! their size and SHA-256 match `kat-manifest.json`.
//!
//! The files are never committed: they are large and full of hex, which the
//! repository's hex law keeps out. A missing or mismatched file is an error,
//! never a skipped group.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;
use sha2::{Digest, Sha256};

const MANIFEST: &str = include_str!("../kat-manifest.json");

pub struct Manifest {
    pub commit: String,
    raw_base: String,
    files: Vec<Value>,
}

pub fn manifest() -> Manifest {
    let m: Value = serde_json::from_str(MANIFEST).expect("kat-manifest.json parses");
    let commit = m["acvpServer"]["commit"]
        .as_str()
        .expect("commit")
        .to_string();
    assert!(
        commit.len() == 40 && commit.bytes().all(|b| b.is_ascii_hexdigit()),
        "the ACVP pin must be a full commit"
    );
    Manifest {
        raw_base: format!(
            "https://raw.githubusercontent.com/usnistgov/ACVP-Server/{commit}/gen-val/json-files"
        ),
        commit,
        files: m["files"].as_array().expect("files").clone(),
    }
}

/// SHA-256 as the manifest writes it: `sha256:` + base64url without padding.
pub fn sha256_tag(bytes: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let d = Sha256::digest(bytes);
    let mut s = String::from("sha256:");
    for chunk in d.chunks(3) {
        let n = chunk.iter().fold(0u32, |a, &b| (a << 8) | b as u32) << (8 * (3 - chunk.len()));
        for i in 0..=chunk.len() {
            s.push(A[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    s
}

impl Manifest {
    fn entry(&self, dir: &str, file: &str) -> &Value {
        self.files
            .iter()
            .find(|f| f["dir"] == dir && f["file"] == file)
            .unwrap_or_else(|| panic!("{dir}/{file} is not in kat-manifest.json"))
    }

    /// The parsed file, from `cache` if it verifies there, else fetched.
    pub fn load(&self, cache: &Path, dir: &str, file: &str) -> Result<Value, String> {
        let e = self.entry(dir, file);
        let want_len = e["bytes"].as_u64().expect("bytes") as usize;
        let want_sha = e["sha256"].as_str().expect("sha256");
        let path: PathBuf = cache.join(&self.commit).join(dir).join(file);
        let check = |b: &[u8]| b.len() == want_len && sha256_tag(b) == want_sha;
        let bytes = match std::fs::read(&path) {
            Ok(b) if check(&b) => b,
            _ => {
                std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
                let tmp = path.with_extension("part");
                let url = format!("{}/{dir}/{file}", self.raw_base);
                let st = Command::new("curl")
                    .args(["-fsSL", "--retry", "3", "-o"])
                    .arg(&tmp)
                    .arg(&url)
                    .status()
                    .map_err(|e| format!("curl {url}: {e}"))?;
                if !st.success() {
                    return Err(format!("fetch failed: {url}"));
                }
                let b = std::fs::read(&tmp).map_err(|e| e.to_string())?;
                if !check(&b) {
                    return Err(format!(
                        "{dir}/{file}: {} bytes {} does not match the manifest ({want_len} bytes {want_sha})",
                        b.len(),
                        sha256_tag(&b)
                    ));
                }
                std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
                b
            }
        };
        serde_json::from_slice(&bytes).map_err(|e| format!("{dir}/{file}: {e}"))
    }
}

/// One test case: its group, its prompt and its expected answer.
pub struct Case<'a> {
    pub group: &'a Value,
    pub input: &'a Value,
    pub expect: &'a Value,
    pub tc: u64,
}

impl Case<'_> {
    pub fn hex(&self, field: &str) -> Vec<u8> {
        let v = self.input.get(field).or_else(|| self.expect.get(field));
        let s = v
            .and_then(Value::as_str)
            .unwrap_or_else(|| panic!("tcId {}: no {field}", self.tc));
        hex::decode(s).unwrap_or_else(|_| panic!("tcId {}: {field} is not hex", self.tc))
    }

    pub fn passed(&self) -> bool {
        self.expect["testPassed"]
            .as_bool()
            .unwrap_or_else(|| panic!("tcId {}: no testPassed", self.tc))
    }

    pub fn group_str(&self, field: &str) -> Option<&str> {
        self.group.get(field).and_then(Value::as_str)
    }

    pub fn group_bool(&self, field: &str) -> Option<bool> {
        self.group.get(field).and_then(Value::as_bool)
    }
}

/// Every case of a vector set, prompt joined to expected answer by tgId and
/// tcId. A group or case missing on either side is an error.
pub fn cases<'a>(prompt: &'a Value, expected: &'a Value) -> Result<Vec<Case<'a>>, String> {
    let pg = prompt["testGroups"]
        .as_array()
        .ok_or("prompt has no testGroups")?;
    let eg = expected["testGroups"]
        .as_array()
        .ok_or("expected has no testGroups")?;
    if pg.len() != eg.len() {
        return Err(format!(
            "{} prompt groups, {} expected groups",
            pg.len(),
            eg.len()
        ));
    }
    let mut out = Vec::new();
    for g in pg {
        let tg = &g["tgId"];
        let e = eg
            .iter()
            .find(|e| &e["tgId"] == tg)
            .ok_or_else(|| format!("tgId {tg}: no expected group"))?;
        let pt = g["tests"].as_array().ok_or("group without tests")?;
        let et = e["tests"]
            .as_array()
            .ok_or("expected group without tests")?;
        if pt.len() != et.len() || pt.is_empty() {
            return Err(format!(
                "tgId {tg}: {} prompt cases, {} expected",
                pt.len(),
                et.len()
            ));
        }
        for t in pt {
            let tc = t["tcId"].as_u64().ok_or("case without tcId")?;
            let x = et
                .iter()
                .find(|x| x["tcId"].as_u64() == Some(tc))
                .ok_or_else(|| format!("tcId {tc}: no expected answer"))?;
            out.push(Case {
                group: g,
                input: t,
                expect: x,
                tc,
            });
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_tag_matches_the_existing_pq_kat_pin() {
        // The empty string and "abc" against their published digests, re-encoded.
        assert_eq!(
            sha256_tag(b""),
            "sha256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU"
        );
        assert_eq!(
            sha256_tag(b"abc"),
            "sha256:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
        );
    }

    #[test]
    fn manifest_names_a_full_commit_and_every_file_once() {
        let m = manifest();
        let mut seen = std::collections::BTreeSet::new();
        for f in &m.files {
            let k = format!(
                "{}/{}",
                f["dir"].as_str().unwrap(),
                f["file"].as_str().unwrap()
            );
            assert!(seen.insert(k.clone()), "{k} listed twice");
            assert!(f["sha256"].as_str().unwrap().starts_with("sha256:"));
            assert!(f["bytes"].as_u64().unwrap() > 0);
        }
        assert!(!seen.is_empty());
    }

    // The same ACVP files are pinned twice (here and in the 17-case
    // surfaces/pq-kat.json); the two pins must never drift apart.
    #[test]
    fn manifest_agrees_with_the_pq_kat_source_list() {
        let kat: Value =
            serde_json::from_str(include_str!("../../../surfaces/pq-kat.json")).unwrap();
        let m = manifest();
        assert_eq!(kat["source"]["commit"].as_str(), Some(m.commit.as_str()));
        let mut shared = 0;
        for f in kat["source"]["files"].as_array().unwrap() {
            let path = f["path"].as_str().unwrap();
            let rest = path.strip_prefix("gen-val/json-files/").unwrap();
            let (dir, file) = rest.split_once('/').unwrap();
            if let Some(e) = m
                .files
                .iter()
                .find(|e| e["dir"] == dir && e["file"] == file)
            {
                assert_eq!(e["sha256"], f["sha256"], "{path}");
                shared += 1;
            }
        }
        assert_eq!(shared, 8, "the two pins share eight files");
    }

    #[test]
    fn cases_refuse_a_missing_answer() {
        let p: Value =
            serde_json::json!({"testGroups":[{"tgId":1,"tests":[{"tcId":1},{"tcId":2}]}]});
        let e: Value =
            serde_json::json!({"testGroups":[{"tgId":1,"tests":[{"tcId":1},{"tcId":3}]}]});
        assert!(cases(&p, &e).is_err());
        let e2: Value =
            serde_json::json!({"testGroups":[{"tgId":1,"tests":[{"tcId":2},{"tcId":1}]}]});
        assert_eq!(cases(&p, &e2).unwrap().len(), 2);
        let empty: Value = serde_json::json!({"testGroups":[{"tgId":1,"tests":[]}]});
        assert!(cases(&empty, &empty).is_err(), "an empty group is vacuous");
    }
}
