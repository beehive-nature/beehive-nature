//! bnr-archive — deterministic cold-archive batching.
//!
//! One builder ([`batch::build_batches`]) walks a directory of records and
//! packs it into size-bounded batches ready for upload, plus a manifest.
//! This crate makes no network calls: upload, scheduling, and retry are
//! other seats' jobs.

pub mod batch;

pub use batch::{
    build_batches, ArchiveRun, Batch, BatchMember, Manifest, ManifestEntry,
    DEFAULT_THRESHOLD_BYTES, FORMAT_VERSION,
};
