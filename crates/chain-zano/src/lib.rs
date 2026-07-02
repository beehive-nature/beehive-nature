//! # chain-zano
//!
//! Host-side Zano cryptography for the Beehive Nature project.
//! Architecture: **Trezor-native** — the spend secret `s` lives on the device
//! and never enters host RAM in production.
//!
//! ## Module safety boundary (read before using anything here)
//!
//! - [`view`] — **HOST-SAFE.** View-only account restore. Derives `s`
//!   transiently, zeroizes it, and never returns it. Use this for scanning the
//!   chain for a user's incoming outputs.
//!
//! - [`keys`] — **FIRMWARE-SPEC / PROTOTYPE ONLY.** Defines the `s -> {v,S,V}`
//!   relationships. Its `derive_from_spend_secret` takes `s`, which in the
//!   production Trezor-native model must NOT exist on the host. Kept as the
//!   authoritative math the firmware app will implement. Do not call from a
//!   host codepath that handles real user funds.
//!
//! - [`slip0010`] — **FIRMWARE-SPEC / PROTOTYPE ONLY.** SLIP-0010 Ed25519
//!   derivation. Carries a DANGER header: calling it host-side requires the
//!   master seed in host RAM, which breaks the model. It exists to validate
//!   the math for the firmware app.
//!
//! ## Source of truth
//! All crypto here is confirmed against `hyle-team/zano/src/crypto`
//! (`crypto.cpp`, `clsag.cpp`, `clsag.h`, `range_proof_bppe.h`). See
//! `docs/architecture/handoff-v1.3.md` and `STATUS.md`.

pub mod view; // host-safe
pub mod keys; // firmware-spec (handles s)
pub mod slip0010; // firmware-spec (handles seed)
