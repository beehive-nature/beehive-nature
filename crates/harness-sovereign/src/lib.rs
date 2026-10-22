//! harness-sovereign — "Kill the Model, Keep the Agent", kernel-native.
//!
//! The demo harness as a kernel citizen (RUST-HARNESS-SPEC.md v1):
//! - [`backend`]: model backends are sense adapters. Outputs are Evidence
//!   with provenance `AIInference` — never truth, never authority.
//! - [`identity`]: `did:b:` self-certifying identity via the bSigner
//!   **library** (ML-DSA-65). No CLI spawning.
//! - [`switch`], [`tools`], [`nostr`], [`relay`], [`settle`]: port order
//!   R2–R6 against the tested Python B1–B7 reference (skeletons until the
//!   reference is in hand; no redesign).
//!
//! Coordination flows through [`event_bus::EventBus`]; Nostr is a transport
//! adapter behind it. This crate is `forbid(unsafe_code)` like the kernel.

#![forbid(unsafe_code)]

pub mod backend;
pub mod identity;
pub mod nostr;
pub mod relay;
pub mod settle;
pub mod switch;
pub mod tools;
pub mod transport;
pub mod x0x;
