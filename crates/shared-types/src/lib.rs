//! bNature shared types. Two modules: the canonical event schema
//! (brief §9.3) and the general Evidence primitive (BIND-1 K-6).
//! Every chain adapter normalizes into these types and every consumer
//! (b-indexer API, DRO, frontends, AI agents) reads them. The kernel
//! never speaks EOS, Zano, or Autonomi — only these translations.

#![forbid(unsafe_code)]

pub mod events;
pub mod evidence;
pub mod spend;

pub use events::*;
pub use evidence::{Evidence, Hash, Provenance, ViewGrade};
// `spend` is NOT glob-re-exported: it defines its own `Provenance`, which would collide
// with `evidence::Provenance`. Import as `shared_types::spend::{SpendReceipt, ...}`.
pub use spend::{LineItem, Rail, ResourceClass, SpendReceipt, Visibility, SCHEMA_VERSION};
