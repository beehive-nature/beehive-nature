//! # watchpay — OFFLINE Merkle payment-contract slice (SKAISTS companion watch lane)
//!
//! Built under the z2.b order (2026-09-12), superseding z2.a §5/§7
//! implementation orders. **Scope fence:** pure validation/composition and
//! a local state model ONLY — no RPC calls, no device/Suite/Connect calls,
//! no wallet access, no signing, no broadcast, no uploads, no production
//! edits. All tests are synthetic/offline.
//!
//! ## Source pins (read 2026-09-12)
//! - WithAutonomi/evmlib tag `v0.9.1`: `contracts/IPaymentVaultV2.sol`,
//!   `contracts/PaymentVaultV2.sol`, `contracts/MerklePaymentLib.sol`,
//!   `contracts/Types.sol`, `abi/IPaymentVault.json`,
//!   `src/external_signer.rs` (`pay_for_merkle_tree_calldata` — keyless),
//!   `src/merkle_payments/merkle_tree.rs:28`
//!   (`MERKLE_PAYMENT_EXPIRATION = 7*24*60*60`),
//!   `src/merkle_batch_payment.rs` (`PoolCommitment` shape).
//! - z2.a audit `b9867fc2` + the z2.b review order (cost-bound, fee/value
//!   constraints, receipt binding, signing lifecycle, scope).
//!
//! ## Deployment parity — UNVERIFIED
//! `PaymentVaultV2.sol` describes itself as "for local Anvil testing"
//! (no proxy, no Ownable). No verified mainnet deployment of this exact
//! contract was inspected. Addresses and deployment parity are flagged
//! for review; nothing here equates the pinned source with a live
//! contract.
//!
//! ## The E7 collision, answered
//! evmlib v0.9.1's keyless helper returns `approve_amount = Amount::MAX`
//! (2^256-1) because the winner pool depends on `block.prevrandao` +
//! `block.timestamp` (MerklePaymentLib.selectWinnerPool) — unknowable at
//! signing time. This crate refuses that shape everywhere: the approval is
//! ALWAYS the plan-derived `max over pools of median16 << depth`, summed
//! over batches ([`plan::ValidatedPlan::approve_ceiling`]). The parity
//! test receipts the upstream MAX default as a pinned fact and asserts
//! this crate never produces it.
//!
//! ## Language law
//! Cryptographic/behavior claims in this crate cite source file+function
//! or are marked UNVERIFIED. Soundness claims cap at "sound by
//! construction". Mocks/synthetic data are named as such.
//!
//! ## Module map
//! - [`plan_model`] — the versioned, bounded, Merkle-only envelope
//!   (`deny_unknown_fields` everywhere = the no-private-material law).
//! - [`plan`] — strict validation; declared figures must equal derived
//!   figures; expiry includes the payment timestamp.
//! - [`pricing`] — the pinned selection/pricing rules and the ceiling
//!   derivation (never a candidate sum).
//! - [`canonical`] — deterministic binary encoding; `batch_id`/`plan_hash`.
//! - [`calldata`] — keyless composition (byte-parity pinned against evmlib
//!   v0.9.1's own helper) + strict event decoding.
//! - [`tx`] — decoded-transaction validation before accepting any signed
//!   result (chain/payer/destination/value/nonce/gas/fees/calldata).
//! - [`receipt`] — strict receipt→transaction→batch binding, no fallbacks.
//! - [`ledger`] — durable intent/signed/outcome states with explicit crash
//!   semantics; Unknown never auto-re-signs; every public operation is
//!   covered by the EXCLUSIVE-WRITER file lock (std `File::lock` on
//!   `<root>/.lock` — the whole read/check/write transition is
//!   lock-covered, across handles and processes; see the module's
//!   precise proven-scope statement).
//! - [`eth`] — secp256k1 recovery + the EIP-2 low-s law (k256; no signing).
//! - [`signed_tx`] — strict SIGNED legacy/EIP-1559 envelope decode
//!   (alloy-rlp framing; canonical re-encode equality; replay protection).
//! - [`connect`] — the Trezor Connect adapter: plan-bound request
//!   composition, the injected (fake-in-this-slice) transport trait,
//!   full cryptographic verification of bridge results, the private
//!   [`connect::VerifiedSigned`] type, and the one-shot signing driver.
//!
//! ## z2.c scope statement (2026-09-12)
//! The Connect adapter is OFFLINE: the transport is an injected trait with
//! NO implementation in this crate (no SDK init, no iframe, no
//! auto-connect, no network signer); tests sign with clearly labelled
//! public synthetic keys only. The z2.b synthetic API
//! ([`tx::DecodedTransaction`] public fields +
//! [`ledger::Ledger::record_signed`]) remains public for the preserved
//! offline tests and is OFFLINE-ONLY — the adapter path through
//! [`connect::verify_signed_result`] is the verified boundary, and this
//! crate does NOT claim the ledger alone prevents bypass while the
//! synthetic door stays open (see `connect` module docs for the honest
//! limitation).

pub mod abi;
pub mod calldata;
pub mod canonical;
pub mod connect;
pub mod error;
pub mod eth;
pub mod ledger;
pub mod plan;
pub mod plan_model;
pub mod pricing;
pub mod receipt;
pub mod signed_tx;
pub mod tx;
pub mod types;

#[doc(hidden)]
pub mod test_support;

pub use error::{Error, Result};
pub use plan::ValidatedPlan;
