//! Offline receiving half of the existing v1 archive format (L1 → L2).
//!
//! A caller supplies a manifest and bytes retrieved from any provider. Success
//! proves completeness and byte integrity RELATIVE TO THAT MANIFEST. It does
//! not authenticate the manifest, prove record truth, select a current epoch,
//! or execute events. The caller must obtain its expected manifest through an
//! authenticated, freshness-aware path. A provider supplying both a replacement
//! manifest and replacement bytes is not an independent trust anchor.
//!
//! No network, filesystem writes, clocks, or new wire fields. Names are opaque
//! archive identifiers, not permission to write paths on the receiving OS.

use std::fmt;

use sha2::{Digest, Sha256};

use crate::{Manifest, FORMAT_VERSION};

/// Explicit admission budget, checked before hashing or allocating records.
/// Fetchers must ALSO bound downloads and manifest decoding before calling us;
/// this function receives bytes already in memory.
#[derive(Debug, Clone, Copy)]
pub struct VerifyLimits {
    pub max_packed_bytes: usize,
    pub max_records: usize,
    pub max_name_bytes: usize,
}

/// A borrowed record, returned only after the ENTIRE archive passes.
#[derive(Debug, PartialEq, Eq)]
pub struct VerifiedRecord<'a> {
    pub name: &'a str,
    pub data: &'a [u8],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyError {
    UnsupportedVersion,
    IncompleteBatchSet,
    InvalidSequence,
    LimitExceeded,
    DigestMismatch,
    InvalidFraming,
    InvalidName,
    NonCanonicalOrder,
    ManifestMismatch,
}

impl fmt::Display for VerifyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Never echo record contents or names in an error log.
        write!(f, "archive verification refused: {self:?}")
    }
}

impl std::error::Error for VerifyError {}

/// Verify exactly one complete v1 archive and expose its records in canonical
/// name order. Missing/extra batches, duplicated/reordered records, unknown
/// versions, trailing/truncated bytes and inaccurate manifest rows are refused.
/// No partial result or caller callback escapes on a late failure.
pub fn verify_archive<'a>(
    manifest: &Manifest,
    packed_batches: &[&'a [u8]],
    limits: VerifyLimits,
) -> Result<Vec<VerifiedRecord<'a>>, VerifyError> {
    if manifest.format_version != FORMAT_VERSION {
        return Err(VerifyError::UnsupportedVersion);
    }
    if manifest.batches.len() != packed_batches.len() {
        return Err(VerifyError::IncompleteBatchSet);
    }
    let mut total_packed = 0usize;
    let mut total_records = 0usize;
    for (index, (row, packed)) in manifest.batches.iter().zip(packed_batches).enumerate() {
        if row.seq != index as u64 + 1 {
            return Err(VerifyError::InvalidSequence);
        }
        if row.member_count == 0 {
            return Err(VerifyError::ManifestMismatch);
        }
        total_packed = total_packed
            .checked_add(packed.len())
            .ok_or(VerifyError::LimitExceeded)?;
        total_records = total_records
            .checked_add(row.member_count as usize)
            .ok_or(VerifyError::LimitExceeded)?;
        if total_packed > limits.max_packed_bytes || total_records > limits.max_records {
            return Err(VerifyError::LimitExceeded);
        }
    }

    // Do not reserve from untrusted manifest counts. Allocation grows only as
    // records are successfully parsed, within the admitted record budget.
    let mut records: Vec<VerifiedRecord<'a>> = Vec::new();
    for (row, packed) in manifest.batches.iter().zip(packed_batches) {
        let digest = Sha256::digest(packed);
        let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
        if row.batch_sha256 != hex {
            return Err(VerifyError::DigestMismatch);
        }
        let mut cursor = Cursor { remaining: packed };
        if cursor.take(8)? != b"BNRARCV1" {
            return Err(VerifyError::InvalidFraming);
        }
        let count = cursor.u32()?;
        if count != row.member_count {
            return Err(VerifyError::ManifestMismatch);
        }
        let mut total_data = 0u64;
        for _ in 0..count {
            let name_len = cursor.u32()? as usize;
            if name_len > limits.max_name_bytes {
                return Err(VerifyError::LimitExceeded);
            }
            let name = std::str::from_utf8(cursor.take(name_len)?)
                .map_err(|_| VerifyError::InvalidName)?;
            // Preserve the builder's relative, slash-separated v1 naming.
            // Platform-specific extraction constraints belong to the caller.
            if name
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..")
            {
                return Err(VerifyError::InvalidName);
            }
            if records.last().is_some_and(|previous| previous.name >= name) {
                return Err(VerifyError::NonCanonicalOrder);
            }
            let data_len = cursor.u64()?;
            let size = usize::try_from(data_len).map_err(|_| VerifyError::InvalidFraming)?;
            let data = cursor.take(size)?;
            total_data = total_data
                .checked_add(data_len)
                .ok_or(VerifyError::InvalidFraming)?;
            records.push(VerifiedRecord { name, data });
        }
        if !cursor.remaining.is_empty() {
            return Err(VerifyError::InvalidFraming);
        }
        if total_data != row.total_bytes {
            return Err(VerifyError::ManifestMismatch);
        }
    }
    Ok(records)
}

struct Cursor<'a> {
    remaining: &'a [u8],
}

impl<'a> Cursor<'a> {
    fn take(&mut self, length: usize) -> Result<&'a [u8], VerifyError> {
        if length > self.remaining.len() {
            return Err(VerifyError::InvalidFraming);
        }
        let (value, rest) = self.remaining.split_at(length);
        self.remaining = rest;
        Ok(value)
    }

    fn u32(&mut self) -> Result<u32, VerifyError> {
        let bytes = self.take(4)?;
        Ok(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn u64(&mut self) -> Result<u64, VerifyError> {
        let bytes = self.take(8)?;
        Ok(u64::from_be_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }
}
