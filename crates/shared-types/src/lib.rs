//! bNature shared types. Currently one module: the canonical event schema
//! (brief §9.3) — every chain adapter normalizes into these types and every
//! consumer (b-indexer API, DRO, frontends, AI agents) reads them. The
//! kernel never speaks EOS, Zano, or Autonomi — only these translations.

#![forbid(unsafe_code)]

pub mod events;

pub use events::*;
