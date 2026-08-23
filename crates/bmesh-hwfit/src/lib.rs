//! bmesh-hwfit — Hardware-fit auto-scoring for bMeshLLM node scheduling.
//!
//! Per SPEC_DOCTRINE-HARVEST-1 D7 (founder ruling 2026-08-11):
//! "The mesh matches model to node capability automatically rather than
//! assuming a fixed default."
//!
//! Buzz verified to NOT ship model selection (block/buzz source read
//! 2026-08-11: VISION_MESH.md — "your machine loads a model your GPU can
//! hold" = manual choice, not scored). This crate is a genuinely new build.

pub mod catalog;
pub mod probe;
pub mod profiler;
pub mod scorer;

pub use catalog::{default_catalog, ModelEntry, Quantization};
pub use probe::{PreflightReport, Verdict};
pub use profiler::NodeProfile;
pub use scorer::{best_fit, fit_score, FitScore};
