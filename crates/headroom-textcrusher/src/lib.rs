//! headroom-textcrusher — VENDORED, OFFLINE-ONLY cut of headroom's
//! TextCrusher (the z3.1 headroom order, 2026-09-05).
//!
//! PROVENANCE: chopped from the repo the raid names — chopratejas/headroom
//! (now headroomlabs-ai/headroom), HEAD commit e59cf1012a2b277689555833fd
//! 221a92279f777d, cloned and read at source 2026-09-05. Upstream license
//! Apache-2.0 (LICENSE + NOTICE read in the repo root); this crate keeps
//! that license, not the workspace one.
//!
//! WHAT IS VENDORED (verbatim, byte-checked at vendor time):
//!   * text_crusher/{mod,config,crusher}.rs — TextCrusher: fast
//!     deterministic extractive prose compressor. Heuristic sentence
//!     scoring (recency + reused BM25 relevance + salience) with
//!     near-duplicate suppression, one O(n) pass. Request-path-safe by
//!     upstream design — the no-model alternative to their ModernBERT
//!     path. Upstream's own tests ride along in crusher.rs.
//!   * relevance/{base,bm25}.rs — the zero-ML BM25 relevance rung
//!     TextCrusher calls (with upstream tests).
//!
//! THE OFFLINE CUT — what is NOT here, on purpose (beacon cut at source):
//!   * upstream's anonymous telemetry beacon — on BY DEFAULT upstream —
//!     lives in the Python layer (telemetry/reporter et al.) and deploy/;
//!     none of that tree is vendored. There is no beacon here to disable.
//!   * upstream headroom-core's tokenizer module downloads models over
//!     the network; that module (and every network client it implies) is
//!     not vendored. The dependency allowlist for THIS crate is regex +
//!     icu_segmenter, full stop — enforced by src/offline_proof.rs, which
//!     scans every source file for network-capability markers and refuses
//!     any dependency outside the allowlist. No outbound call can be made
//!     by this crate because no outbound capability exists in it.
//!   * relevance/embedding.rs + hybrid.rs (ONNX model scorers) and the
//!     create_scorer factory: not vendored; relevance/mod.rs is trimmed
//!     to base + bm25 (the cut is marked in that file).
//!
//! The receipt-facing algorithm id for anything produced through this
//! crate: ALG_ID below (names the upstream mechanism + vendoring epoch).

pub mod offline_proof;
pub mod relevance;
pub mod text_crusher;

pub use text_crusher::{TextCrusher, TextCrusherConfig, TextCrusherResult};

/// The algorithm id that rides every receipt that used this crusher —
/// the estate's law: every count and every transform carries its id.
pub const ALG_ID: &str = "headroom.text-crusher/1";
