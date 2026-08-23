//! Deterministic cold-archive batching.
//!
//! [`build_batches`] walks a directory of record files, visits them in
//! sorted-name order (never filesystem order), and packs them into
//! size-bounded batches ready for upload by a separate seat, alongside a
//! [`Manifest`] recording every batch's digest and shape. No network
//! calls happen here — artifacts and manifests only.
//!
//! # Packed batch format (version 1)
//!
//! Each [`Batch::packed`] byte string is:
//!
//! ```text
//! magic    8 bytes   b"BNRARCV1"  (carries the format version)
//! count    u32 BE    number of members that follow
//! member*            repeated `count` times, in sorted-name order:
//!   name_len  u32 BE
//!   name      UTF-8, '/'-separated path relative to the input root
//!   data_len  u64 BE
//!   data      raw member bytes
//! ```
//!
//! [`Batch::sha256`] is SHA-256 over the entire packed byte string; each
//! member carries its own SHA-256 over its data alone. No timestamps,
//! permissions, or device details enter the format, so the same tree
//! packs to byte-identical batches and an identical manifest every run.
//!
//! # Batching rule
//!
//! Members accumulate into the current batch while
//! `batch_bytes + member_bytes <= threshold_bytes`; the next member
//! otherwise opens a new batch. Every batch keeps at least one member,
//! so a record larger than the threshold rides alone as an oversize
//! singleton batch.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Packed-format version, carried in the magic bytes and in the manifest.
pub const FORMAT_VERSION: u32 = 1;

/// Default accumulation threshold (64 MiB of member bytes per batch).
/// Callers override it by passing any other value to [`build_batches`].
pub const DEFAULT_THRESHOLD_BYTES: u64 = 64 * 1024 * 1024;

const PACKED_MAGIC: &[u8; 8] = b"BNRARCV1";

/// One archived record inside a batch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchMember {
    /// '/'-separated path of the record, relative to the input root.
    pub name: String,
    /// Size of the record's bytes.
    pub size: u64,
    /// SHA-256 of the record's bytes alone (lowercase hex).
    pub sha256: String,
}

/// One packed batch, ready for upload by another seat.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Batch {
    /// Monotonic sequence number, starting at 1 within a run.
    pub seq: u64,
    /// The packed byte string (see the module docs for the v1 framing).
    pub packed: Vec<u8>,
    /// SHA-256 of `packed` (lowercase hex).
    pub sha256: String,
    /// Sum of member sizes (member bytes, not packed length).
    pub total_bytes: u64,
    /// The batch's members, in sorted-name order.
    pub members: Vec<BatchMember>,
}

/// One manifest row, per batch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManifestEntry {
    /// The batch's sequence number (matches [`Batch::seq`]).
    pub seq: u64,
    /// SHA-256 of the batch's packed bytes (lowercase hex).
    pub batch_sha256: String,
    /// How many members the batch holds.
    pub member_count: u32,
    /// Sum of the batch's member sizes.
    pub total_bytes: u64,
}

/// The run's serializable manifest.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    /// Always [`FORMAT_VERSION`] (1) for this builder.
    pub format_version: u32,
    /// One row per emitted batch, in sequence order.
    pub batches: Vec<ManifestEntry>,
}

/// Everything one run produces: the batches plus the manifest.
#[derive(Debug, Clone, PartialEq)]
pub struct ArchiveRun {
    /// The packed batches, in sequence order.
    pub batches: Vec<Batch>,
    /// The manifest mirroring those batches.
    pub manifest: Manifest,
}

/// Build deterministic archive batches from every regular file under `root`.
///
/// Files are visited in sorted-name order and accumulate into a batch while
/// the batch's member bytes stay within `threshold_bytes` (pass
/// [`DEFAULT_THRESHOLD_BYTES`] for the house default, or any other value to
/// override it). Only regular files are archived: directories are walked,
/// symlinks and other specials are skipped. An empty directory is not an
/// error — it yields an empty batch list and an empty manifest whose
/// `format_version` is still [`FORMAT_VERSION`].
pub fn build_batches(root: &Path, threshold_bytes: u64) -> io::Result<ArchiveRun> {
    let files = collect_regular_files(root)?;

    let mut batches: Vec<Batch> = Vec::new();
    let mut entries: Vec<ManifestEntry> = Vec::new();
    let mut acc = Accum::default();

    for (name, path) in files {
        let data = fs::read(&path)?;
        let sha256 = sha256_hex(&data);
        if !acc.members.is_empty() && acc.total + data.len() as u64 > threshold_bytes {
            acc.flush_into(&mut batches, &mut entries);
        }
        acc.push(name, data, sha256);
    }
    acc.flush_into(&mut batches, &mut entries);

    Ok(ArchiveRun {
        batches,
        manifest: Manifest {
            format_version: FORMAT_VERSION,
            batches: entries,
        },
    })
}

/// Collects the regular files under a root as `(name, path)` pairs, sorted
/// by name. Directories are pushed on a stack; symlinks and other specials
/// are skipped deterministically.
fn collect_regular_files(root: &Path) -> io::Result<Vec<(String, PathBuf)>> {
    let mut stack = vec![root.to_path_buf()];
    let mut found: Vec<(String, PathBuf)> = Vec::new();
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let path = entry.path();
            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() {
                found.push((relative_name(root, &path)?, path));
            }
        }
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(found)
}

/// Renders a path under `root` as a '/'-separated relative name, so batches
/// pack identically on any platform.
fn relative_name(root: &Path, path: &Path) -> io::Result<String> {
    let rel = path.strip_prefix(root).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("path {path:?} escapes the input root"),
        )
    })?;
    let parts: Vec<&str> = rel
        .components()
        .map(|c| {
            c.as_os_str().to_str().ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("non-UTF-8 path component in {path:?}"),
                )
            })
        })
        .collect::<io::Result<_>>()?;
    Ok(parts.join("/"))
}

/// The batch under construction: members, their bytes, and the running total.
#[derive(Default)]
struct Accum {
    members: Vec<BatchMember>,
    datas: Vec<Vec<u8>>,
    total: u64,
}

impl Accum {
    fn push(&mut self, name: String, data: Vec<u8>, sha256: String) {
        let size = data.len() as u64;
        self.total += size;
        self.members.push(BatchMember { name, size, sha256 });
        self.datas.push(data);
    }

    /// Packs the accumulated members, emits the batch and its manifest row,
    /// and resets the accumulator. A no-op on an empty accumulator.
    fn flush_into(&mut self, batches: &mut Vec<Batch>, entries: &mut Vec<ManifestEntry>) {
        if self.members.is_empty() {
            return;
        }
        let acc = std::mem::take(self);

        let mut packed = Vec::new();
        packed.extend_from_slice(PACKED_MAGIC);
        packed.extend_from_slice(&(acc.members.len() as u32).to_be_bytes());
        for (member, data) in acc.members.iter().zip(acc.datas.iter()) {
            packed.extend_from_slice(&(member.name.len() as u32).to_be_bytes());
            packed.extend_from_slice(member.name.as_bytes());
            packed.extend_from_slice(&(data.len() as u64).to_be_bytes());
            packed.extend_from_slice(data);
        }

        let seq = batches.len() as u64 + 1;
        let sha256 = sha256_hex(&packed);
        entries.push(ManifestEntry {
            seq,
            batch_sha256: sha256.clone(),
            member_count: acc.members.len() as u32,
            total_bytes: acc.total,
        });
        batches.push(Batch {
            seq,
            sha256,
            packed,
            total_bytes: acc.total,
            members: acc.members,
        });
    }
}

fn sha256_hex(data: &[u8]) -> String {
    to_hex(&Sha256::digest(data))
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("bnr-archive-test-{}-{tag}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_record(root: &Path, rel: &str, bytes: &[u8]) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, bytes).unwrap();
    }

    /// Independent SHA-256 recomputation (test-local, not the prod helper).
    fn test_sha256(data: &[u8]) -> String {
        let digest: [u8; 32] = Sha256::digest(data).into();
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }

    /// Test-local reader for the v1 framing: parses a packed batch back and
    /// asserts it is fully consumed.
    fn unpack(packed: &[u8]) -> Vec<(String, Vec<u8>)> {
        let be32 =
            |off: usize| u32::from_be_bytes(packed[off..off + 4].try_into().unwrap()) as usize;
        let be64 =
            |off: usize| u64::from_be_bytes(packed[off..off + 8].try_into().unwrap()) as usize;

        assert_eq!(&packed[..8], b"BNRARCV1");
        let count = be32(8);
        let mut off = 12;
        let mut out = Vec::with_capacity(count);
        for _ in 0..count {
            let name_len = be32(off);
            off += 4;
            let name = String::from_utf8(packed[off..off + name_len].to_vec()).unwrap();
            off += name_len;
            let data_len = be64(off);
            off += 8;
            out.push((name, packed[off..off + data_len].to_vec()));
            off += data_len;
        }
        assert_eq!(off, packed.len(), "trailing bytes after last member");
        out
    }

    #[test]
    fn determinism_same_tree_twice_is_byte_identical() {
        let root = fixture_dir("determinism");
        // Created deliberately out of sorted order: packing must not ride
        // filesystem order.
        write_record(
            &root,
            "zeta/2026-08-23T01.rec",
            b"zz created first, sorts last",
        );
        write_record(&root, "alpha.txt", b"created second, sorts first");
        write_record(&root, "nested/deep/omega.rec", &[7u8; 40]);
        write_record(&root, "m.mid", b"m");

        let run1 = build_batches(&root, 48).unwrap();
        let run2 = build_batches(&root, 48).unwrap();

        assert_eq!(run1.batches.len(), run2.batches.len());
        for (b1, b2) in run1.batches.iter().zip(&run2.batches) {
            assert_eq!(b1.seq, b2.seq);
            assert_eq!(b1.packed, b2.packed, "packed bytes must be byte-identical");
            assert_eq!(b1.sha256, b2.sha256);
        }
        assert_eq!(run1.manifest, run2.manifest);
        assert_eq!(
            serde_json::to_string(&run1.manifest).unwrap(),
            serde_json::to_string(&run2.manifest).unwrap(),
            "serialized manifests must be identical"
        );

        // Sorted-name order proof: the first member of the first batch is
        // the alphabetically-first name, not the first-created file.
        assert_eq!(run1.batches[0].members[0].name, "alpha.txt");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn threshold_straddle_lands_where_expected() {
        let root = fixture_dir("threshold");
        write_record(&root, "a.rec", &[1u8; 5]);
        write_record(&root, "b.rec", &[2u8; 5]);
        write_record(&root, "c.rec", &[3u8; 5]);

        // Exact fit stays together: 5 + 5 == threshold.
        let run = build_batches(&root, 10).unwrap();
        let names: Vec<Vec<&str>> = run
            .batches
            .iter()
            .map(|b| b.members.iter().map(|m| m.name.as_str()).collect())
            .collect();
        assert_eq!(names, vec![vec!["a.rec", "b.rec"], vec!["c.rec"]]);
        assert_eq!(run.batches[0].total_bytes, 10);
        assert_eq!(run.batches[1].total_bytes, 5);

        // One byte over the line splits the pair after it.
        write_record(&root, "d.rec", &[4u8; 6]);
        let run = build_batches(&root, 10).unwrap();
        let names: Vec<Vec<&str>> = run
            .batches
            .iter()
            .map(|b| b.members.iter().map(|m| m.name.as_str()).collect())
            .collect();
        assert_eq!(
            names,
            vec![vec!["a.rec", "b.rec"], vec!["c.rec"], vec!["d.rec"]]
        );

        // An oversize record rides alone as a singleton batch.
        write_record(&root, "e.rec", &[5u8; 100]);
        let run = build_batches(&root, 10).unwrap();
        assert_eq!(run.batches.len(), 4);
        assert_eq!(run.batches[3].members.len(), 1);
        assert_eq!(run.batches[3].members[0].name, "e.rec");
        assert_eq!(run.batches[3].total_bytes, 100);

        // Sequence numbers stay monotonic from 1 across every batch.
        let seqs: Vec<u64> = run.batches.iter().map(|b| b.seq).collect();
        assert_eq!(seqs, vec![1, 2, 3, 4]);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn empty_input_is_an_empty_manifest_not_an_error() {
        let root = fixture_dir("empty");
        let run = build_batches(&root, 1024).unwrap();
        assert!(run.batches.is_empty());
        assert_eq!(run.manifest.format_version, FORMAT_VERSION);
        assert!(run.manifest.batches.is_empty());
        assert_eq!(
            serde_json::to_string(&run.manifest).unwrap(),
            r#"{"format_version":1,"batches":[]}"#
        );
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn packed_digests_and_framing_verify() {
        let root = fixture_dir("roundtrip");
        write_record(&root, "a.rec", b"cold archive record A");
        write_record(&root, "d/b.rec", b"record B under a subdir");

        let run = build_batches(&root, DEFAULT_THRESHOLD_BYTES).unwrap();
        assert_eq!(run.batches.len(), 1);
        let batch = &run.batches[0];
        assert_eq!(batch.seq, 1);

        // Batch digest is SHA-256 of the packed bytes, recomputed here.
        assert_eq!(batch.sha256, test_sha256(&batch.packed));

        // Framing roundtrips: names sorted, '/'-separated, contents intact.
        let unpacked = unpack(&batch.packed);
        let names: Vec<&str> = unpacked.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, vec!["a.rec", "d/b.rec"]);
        assert_eq!(unpacked[0].1, b"cold archive record A".to_vec());
        assert_eq!(unpacked[1].1, b"record B under a subdir".to_vec());

        // Each member digest is SHA-256 of its own bytes.
        for (member, (name, data)) in batch.members.iter().zip(&unpacked) {
            assert_eq!(member.name, *name);
            assert_eq!(member.size, data.len() as u64);
            assert_eq!(member.sha256, test_sha256(data));
        }

        // The manifest mirrors the batch.
        let entry = &run.manifest.batches[0];
        assert_eq!(entry.seq, batch.seq);
        assert_eq!(entry.batch_sha256, batch.sha256);
        assert_eq!(entry.member_count as usize, batch.members.len());
        assert_eq!(entry.total_bytes, batch.total_bytes);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn missing_root_is_an_error() {
        let missing = std::env::temp_dir().join("bnr-archive-no-such-root");
        assert!(build_batches(&missing, 1024).is_err());
    }
}
