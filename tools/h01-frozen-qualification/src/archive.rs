use crate::{read_bounded, sha256, write_record, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_FILES: usize = 32;
const MAX_ARCHIVE_BYTES: usize = 8 * 1024 * 1024;

/// An archive wrapper preserves the exact machine-consumed bytes. Its metadata
/// never becomes part of a signed artifact. No private runtime paths are allowed.
#[derive(Debug, Serialize, Deserialize)]
pub struct Archive {
    pub schema: String,
    pub classification: String,
    pub session: String,
    pub files: Vec<Entry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Entry {
    pub path: String,
    pub bytes: usize,
    pub sha256: String,
    pub body_b64: String,
}

pub fn paths(session: &str) -> Result<BTreeSet<String>> {
    if session.is_empty()
        || session.len() > 80
        || !session
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err("invalid archive session identifier".into());
    }
    let mut result = BTreeSet::new();
    for name in [
        "run-definition.json",
        "public-material.json",
        "frozen-manifest.bin",
        "receipt.json",
        "evidence/transcript.canonical.txt",
        "evidence/transcript.sha256",
        "evidence/checkpoints.json",
        "evidence/backend-health.json",
        "evidence/run-outcome.json",
    ] {
        result.insert(format!("runs/{session}/{name}"));
    }
    for suffix in ["goal.json", "jsonl", "checkpoints.jsonl", "state.json"] {
        result.insert(format!("sessions/{session}.{suffix}"));
    }
    result.insert("sandbox/input.bin".into());
    Ok(result)
}

fn regular_contained_file(root: &Path, relative: &str) -> Result<PathBuf> {
    let mut at = root.to_path_buf();
    for component in Path::new(relative).components() {
        if !matches!(component, std::path::Component::Normal(_)) {
            return Err("archive path is not relative and normalized".into());
        }
        at.push(component);
        let meta = fs::symlink_metadata(&at).map_err(|e| format!("{}: {e}", at.display()))?;
        if meta.file_type().is_symlink() {
            return Err("archive path contains a symlink".into());
        }
    }
    if !at.is_file() {
        return Err("archive input is not a regular file".into());
    }
    Ok(at)
}

pub fn capture(workdir: &Path, session: &str, destination: &Path) -> Result<Archive> {
    let mut entries = Vec::new();
    let mut total = 0usize;
    for relative in paths(session)? {
        if !workdir.join(&relative).exists() {
            continue;
        }
        let input = regular_contained_file(workdir, &relative)?;
        let bytes = read_bounded(&input, MAX_ARCHIVE_BYTES)?;
        total = total
            .checked_add(bytes.len())
            .ok_or("archive size overflow")?;
        if total > MAX_ARCHIVE_BYTES {
            return Err("archive exceeds public evidence byte bound".into());
        }
        entries.push(Entry {
            path: relative,
            bytes: bytes.len(),
            sha256: sha256(&bytes),
            body_b64: STANDARD.encode(&bytes),
        });
    }
    let archive = Archive {
        schema: "h01-public-bundle-v1".into(),
        classification: "PUBLIC-CONSTANT: generated public verification evidence; private runtime paths excluded".into(),
        session: session.into(),
        files: entries,
    };
    // Validation precedes publication, just as it precedes restoration.
    decode_validated(&archive)?;
    write_record(destination, &archive)?;
    Ok(archive)
}

fn decode_validated(archive: &Archive) -> Result<Vec<(String, Vec<u8>)>> {
    if archive.schema != "h01-public-bundle-v1" || archive.files.len() > MAX_FILES {
        return Err("unsupported or oversized public archive".into());
    }
    let allowed = paths(&archive.session)?;
    let mut seen = BTreeSet::new();
    let mut total = 0usize;
    let mut decoded = Vec::new();
    for entry in &archive.files {
        if !allowed.contains(&entry.path) || !seen.insert(entry.path.clone()) {
            return Err(format!(
                "forbidden or duplicate archive path: {}",
                entry.path
            ));
        }
        if entry.bytes > MAX_ARCHIVE_BYTES || entry.body_b64.len() > MAX_ARCHIVE_BYTES * 2 {
            return Err("archive entry exceeds byte bound".into());
        }
        let bytes = STANDARD
            .decode(&entry.body_b64)
            .map_err(|e| format!("archive base64: {e}"))?;
        total = total
            .checked_add(bytes.len())
            .ok_or("archive size overflow")?;
        if total > MAX_ARCHIVE_BYTES || bytes.len() != entry.bytes || sha256(&bytes) != entry.sha256
        {
            return Err(format!("archive length/digest mismatch: {}", entry.path));
        }
        decoded.push((entry.path.clone(), bytes));
    }
    Ok(decoded)
}

pub fn restore(archive_path: &Path, destination: &Path) -> Result<()> {
    let encoded = read_bounded(archive_path, MAX_ARCHIVE_BYTES * 2)?;
    let archive: Archive = serde_json::from_slice(&encoded).map_err(|e| e.to_string())?;
    let entries = decode_validated(&archive)?;
    // Never overlay or mutate an existing tree, including a symlink destination.
    if fs::symlink_metadata(destination).is_ok() {
        return Err("archive restore destination already exists".into());
    }
    fs::create_dir(destination).map_err(|e| format!("restore destination: {e}"))?;
    for (relative, bytes) in entries {
        let target = destination.join(&relative);
        fs::create_dir_all(target.parent().ok_or("archive parent")?).map_err(|e| e.to_string())?;
        fs::write(target, bytes).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example(path: &str) -> Archive {
        let bytes = b"machine bytes\n";
        Archive {
            schema: "h01-public-bundle-v1".into(),
            classification: "PUBLIC-CONSTANT: synthetic archive test".into(),
            session: "test-session".into(),
            files: vec![Entry {
                path: path.into(),
                bytes: bytes.len(),
                sha256: sha256(bytes),
                body_b64: STANDARD.encode(bytes),
            }],
        }
    }

    #[test]
    fn public_bytes_survive_and_private_paths_refuse() {
        let archive = example("runs/test-session/evidence/transcript.canonical.txt");
        assert_eq!(decode_validated(&archive).unwrap()[0].1, b"machine bytes\n");
        for path in [
            "keys/key.json",
            "nostr-keys/demo-nsec.hex",
            "../escape",
            "/absolute",
        ] {
            assert!(decode_validated(&example(path)).is_err(), "{path}");
        }
    }

    #[test]
    fn corrupted_or_duplicate_archive_entries_refuse() {
        let mut bad = example("sandbox/input.bin");
        bad.files[0].body_b64 = STANDARD.encode(b"wrong bytes");
        assert!(decode_validated(&bad).is_err());
        let mut duplicate = example("sandbox/input.bin");
        duplicate
            .files
            .push(example("sandbox/input.bin").files.remove(0));
        assert!(decode_validated(&duplicate).is_err());
    }
}
