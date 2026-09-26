use std::fs;
use std::path::Path;

use bnr_archive::{
    build_batches, verify_archive, Manifest, ManifestEntry, VerifyError, VerifyLimits,
};
use sha2::{Digest, Sha256};

const LIMITS: VerifyLimits = VerifyLimits {
    max_packed_bytes: 1024 * 1024,
    max_records: 100,
    max_name_bytes: 1024,
};

fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

// Independent writer, including malformed shapes that build_batches cannot emit.
fn pack(names: &[&str]) -> (Manifest, Vec<u8>) {
    let mut bytes = b"BNRARCV1".to_vec();
    bytes.extend_from_slice(&(names.len() as u32).to_be_bytes());
    for name in names {
        bytes.extend_from_slice(&(name.len() as u32).to_be_bytes());
        bytes.extend_from_slice(name.as_bytes());
        bytes.extend_from_slice(&1u64.to_be_bytes());
        bytes.push(42);
    }
    let manifest = Manifest {
        format_version: 1,
        batches: vec![ManifestEntry {
            seq: 1,
            batch_sha256: hash(&bytes),
            member_count: names.len() as u32,
            total_bytes: names.len() as u64,
        }],
    };
    (manifest, bytes)
}

#[test]
fn rebuild_from_serialized_archive_after_source_tree_is_gone() {
    let scratch = std::env::temp_dir().join(format!(
        "bnr-archive-cold-read-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let source = scratch.join("source");
    fs::create_dir_all(source.join("Notes")).unwrap();
    fs::write(source.join("Notes/a.rec"), b"prior evidence").unwrap();
    fs::write(source.join("z.rec"), b"subsequent event").unwrap();
    let run = build_batches(&source, 1).unwrap();
    fs::write(
        scratch.join("manifest.json"),
        serde_json::to_vec(&run.manifest).unwrap(),
    )
    .unwrap();
    for batch in &run.batches {
        fs::write(scratch.join(format!("{}.batch", batch.seq)), &batch.packed).unwrap();
    }
    drop(run);
    fs::remove_dir_all(&source).unwrap();

    let manifest: Manifest =
        serde_json::from_slice(&fs::read(scratch.join("manifest.json")).unwrap()).unwrap();
    let bytes: Vec<_> = manifest
        .batches
        .iter()
        .map(|row| fs::read(scratch.join(format!("{}.batch", row.seq))).unwrap())
        .collect();
    let slices: Vec<_> = bytes.iter().map(Vec::as_slice).collect();
    let records = verify_archive(&manifest, &slices, LIMITS).unwrap();
    assert_eq!(records.len(), 2);
    assert_eq!(
        (records[0].name, records[0].data),
        ("Notes/a.rec", b"prior evidence".as_slice())
    );
    assert_eq!(
        (records[1].name, records[1].data),
        ("z.rec", b"subsequent event".as_slice())
    );
    fs::remove_dir_all(scratch).unwrap();
}

#[test]
fn existing_golden_archive_verifies_without_changing_v1() {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/golden");
    let run = build_batches(&fixture, 24).unwrap();
    let slices: Vec<_> = run.batches.iter().map(|b| b.packed.as_slice()).collect();
    let records = verify_archive(&run.manifest, &slices, LIMITS).unwrap();
    assert_eq!(records.len(), 4);
    for record in records {
        assert_eq!(record.data, fs::read(fixture.join(record.name)).unwrap());
    }
}

#[test]
fn missing_extra_reordered_or_corrupt_batches_are_refused() {
    let (mut manifest, first) = pack(&["a"]);
    let (other, mut second) = pack(&["z"]);
    let mut row = other.batches[0].clone();
    row.seq = 2;
    manifest.batches.push(row);
    assert_eq!(
        verify_archive(&manifest, &[&first], LIMITS),
        Err(VerifyError::IncompleteBatchSet)
    );
    assert_eq!(
        verify_archive(&manifest, &[&first, &second, &second], LIMITS),
        Err(VerifyError::IncompleteBatchSet)
    );
    assert_eq!(
        verify_archive(&manifest, &[&second, &first], LIMITS),
        Err(VerifyError::DigestMismatch)
    );
    assert_eq!(
        verify_archive(&manifest, &[&first, &second], LIMITS)
            .unwrap()
            .len(),
        2
    );
    *second.last_mut().unwrap() ^= 1;
    assert_eq!(
        verify_archive(&manifest, &[&first, &second], LIMITS),
        Err(VerifyError::DigestMismatch)
    );
}

#[test]
fn every_truncation_and_trailing_byte_is_refused_even_with_matching_digest() {
    let (mut manifest, bytes) = pack(&["a", "b"]);
    for end in 0..bytes.len() {
        manifest.batches[0].batch_sha256 = hash(&bytes[..end]);
        assert!(
            verify_archive(&manifest, &[&bytes[..end]], LIMITS).is_err(),
            "accepted prefix {end}"
        );
    }
    let mut extra = bytes.clone();
    extra.push(0);
    manifest.batches[0].batch_sha256 = hash(&extra);
    assert_eq!(
        verify_archive(&manifest, &[&extra], LIMITS),
        Err(VerifyError::InvalidFraming)
    );
    // Attacker-controlled u64 length cannot overflow an offset or allocate a buffer.
    let mut oversized = bytes;
    oversized[17..25].copy_from_slice(&u64::MAX.to_be_bytes());
    manifest.batches[0].batch_sha256 = hash(&oversized);
    assert_eq!(
        verify_archive(&manifest, &[&oversized], LIMITS),
        Err(VerifyError::InvalidFraming)
    );
}

#[test]
fn unknown_versions_bad_magic_and_inaccurate_rows_are_refused() {
    let (manifest, bytes) = pack(&["a"]);
    let mut bad = manifest.clone();
    bad.format_version = 2;
    assert_eq!(
        verify_archive(&bad, &[&bytes], LIMITS),
        Err(VerifyError::UnsupportedVersion)
    );
    bad = manifest.clone();
    bad.batches[0].seq = 2;
    assert_eq!(
        verify_archive(&bad, &[&bytes], LIMITS),
        Err(VerifyError::InvalidSequence)
    );
    bad = manifest.clone();
    bad.batches[0].total_bytes = 2;
    assert_eq!(
        verify_archive(&bad, &[&bytes], LIMITS),
        Err(VerifyError::ManifestMismatch)
    );
    bad = manifest.clone();
    bad.batches[0].member_count = 2;
    assert_eq!(
        verify_archive(&bad, &[&bytes], LIMITS),
        Err(VerifyError::ManifestMismatch)
    );
    let mut wrong_magic = bytes;
    wrong_magic[7] = b'2';
    bad = manifest;
    bad.batches[0].batch_sha256 = hash(&wrong_magic);
    assert_eq!(
        verify_archive(&bad, &[&wrong_magic], LIMITS),
        Err(VerifyError::InvalidFraming)
    );
}

#[test]
fn duplicates_and_unsorted_names_are_rejected_across_batch_boundaries() {
    for names in [&["b", "a"][..], &["a", "a"][..]] {
        let (manifest, bytes) = pack(names);
        assert_eq!(
            verify_archive(&manifest, &[&bytes], LIMITS),
            Err(VerifyError::NonCanonicalOrder)
        );
    }
    let (mut manifest, bytes) = pack(&["a"]);
    let mut duplicate = manifest.batches[0].clone();
    duplicate.seq = 2;
    manifest.batches.push(duplicate);
    assert_eq!(
        verify_archive(&manifest, &[&bytes, &bytes], LIMITS),
        Err(VerifyError::NonCanonicalOrder)
    );
}

#[test]
fn malformed_names_and_resource_budgets_are_refused() {
    for name in ["", "/a", "a/../b", "./a", "a//b"] {
        let (manifest, bytes) = pack(&[name]);
        assert_eq!(
            verify_archive(&manifest, &[&bytes], LIMITS),
            Err(VerifyError::InvalidName)
        );
    }
    let (manifest, bytes) = pack(&["abc"]);
    for limits in [
        VerifyLimits {
            max_packed_bytes: bytes.len() - 1,
            ..LIMITS
        },
        VerifyLimits {
            max_records: 0,
            ..LIMITS
        },
        VerifyLimits {
            max_name_bytes: 2,
            ..LIMITS
        },
    ] {
        assert_eq!(
            verify_archive(&manifest, &[&bytes], limits),
            Err(VerifyError::LimitExceeded)
        );
    }
    let (mut manifest, mut bytes) = pack(&["a"]);
    bytes[16] = 255;
    manifest.batches[0].batch_sha256 = hash(&bytes);
    assert_eq!(
        verify_archive(&manifest, &[&bytes], LIMITS),
        Err(VerifyError::InvalidName)
    );
}

#[test]
fn empty_manifest_is_a_valid_empty_archive_only() {
    let manifest = Manifest {
        format_version: 1,
        batches: vec![],
    };
    assert!(verify_archive(&manifest, &[], LIMITS).unwrap().is_empty());
    assert_eq!(
        verify_archive(&manifest, &[b""], LIMITS),
        Err(VerifyError::IncompleteBatchSet)
    );
}
