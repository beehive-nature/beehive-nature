//! `chain-exsat-evm` — the exSat EVM log adapter (C-1).
//!
//! The kernel's third chain adapter and its first EVM one. It watches exSat
//! EVM contract logs and turns the ones it recognizes into `CanonicalEvent`s
//! on the existing bus.
//!
//! # What this crate claims, and what it does not
//!
//! Two halves, and the line between them is the point of the whole design:
//!
//! - [`abi`] — **verifiable.** EVM log layout is fixed by the Solidity ABI
//!   specification, and the decoder is pinned to it by published keccak256
//!   known-answer vectors (ERC-20's `Transfer` topic0 among them).
//! - [`signatures`] — **UNVERIFIED.** No BNRi contract exists yet, anywhere.
//!   The ten event *names* are founder-settled; the *signature strings* that
//!   map onto them are not knowable today, so the table ships visibly-fake
//!   `PLACEHOLDER_*` entries that a production config refuses to load.
//!
//! Sound by construction / isolated by design — not proven. Audited is not
//! proven either. See `README.md` for the full VERIFIED / UNVERIFIED ledger.
//!
//! # Not a unified abstraction
//!
//! Log subscription is a genuinely different model from `chain-eos`'s SHIP
//! push and `adapter-arweave`'s GraphQL pull: it is head-following over a
//! chain that reorganizes, with per-log identity inside a transaction.
//! Forcing all three behind one trait would mean inventing a shared shape
//! none of them has, and the seam that broke would be the one that matters —
//! see [`indexer`] on why routing EVM logs through `normalizer::normalize()`
//! collapses distinct logs onto one `event_id`.
//!
//! # Standing properties
//!
//! - **Fail-closed.** Every refusal in this crate blocks. An ambiguous reorg,
//!   a log that does not fit its signature, a divergent re-delivery of a held
//!   block, a resume that starts past its cursor, a corrupt cursor — none
//!   degrade to "proceed anyway", and a transport error never becomes a green
//!   light. (A chain-id mismatch is fail-closed *when checked*, but checking
//!   it is a caller obligation this crate cannot discharge — see
//!   [`indexer::IndexerConfig::verify_observed_chain_id`].)
//! - **Never contradicts itself.** A fork below an already-emitted block never
//!   becomes a silent continuation on the competing branch. **Two mechanisms
//!   carry that, and which one fires depends on the retained window:** a fork
//!   the window still spans is classified as a reorg and refused by
//!   [`indexer::IndexError::ReorgBelowEmitted`], a latched halt; a fork *below*
//!   the retained window never reaches that check at all, because
//!   [`reorg::ChainTracker::classify`] cannot resolve it and refuses first with
//!   [`reorg::ReorgError::AmbiguousReorg`] — either where the forking block's
//!   height is no longer retained, or where finding its parent would need
//!   competing-chain blocks this crate was not given. Both are fail-closed;
//!   neither degrades to "proceed anyway". `confirmation_depth` is not what
//!   makes the property hold, only what makes the halt rare: depth 0 is an
//!   accepted config, and at depth 0 logs emit at the tip and a reorg *can*
//!   orphan an emitted event — leaving the refusals as the only thing between
//!   the bus and a contradiction. A depth chosen from measured fork depths is
//!   what keeps them from firing.
//! - **Exactly once across crashes.** Idempotency key `(block_number,
//!   tx_hash, log_index)`, encoded into `event_id` and `source_ref`, with a
//!   position-granular cursor that resumes mid-block. The "never skip" half
//!   has a caller obligation attached: [`indexer::Indexer::drive`] commits the
//!   cursor as it emits, so on error the events it already emitted come back
//!   in [`indexer::DriveError::emitted`] and must be published — a retry will
//!   not produce them again.
//! - **Default-deny.** Empty address allowlist indexes nothing; an unmatched
//!   topic0 is noise, ignored by design.
//! - **`b`-blind.** Gas on exSat is BTC. BNRi is an EVM artifact; `b` is
//!   earned-only metabolic energy accounted kernel-side (SPIRIT-1), never an
//!   EVM token, never bridged, never gas. Nothing here touches `b`.
//! - **No keys.** This is a read-only indexer. It holds no keys and signs
//!   nothing, which is also why it pulls in no signing stack.
//!
//! # Dependencies
//!
//! No `alloy`, no `ethers` — the `chain-eos` hand-rolled-codec precedent, for
//! the reasons set out in [`abi`]. Keccak256 comes from `sha3`, already a
//! workspace dependency.

#![forbid(unsafe_code)]

pub mod abi;
pub mod cursor;
pub mod indexer;
pub mod reorg;
pub mod signatures;

pub use abi::{decode_log, hex0x, keccak256, topic0_of, AbiError, DecodedLog, Word};
pub use cursor::{Cursor, CursorError, EmittedPosition};
pub use indexer::{
    DriveError, DriveFailure, IndexError, Indexer, IndexerConfig, LogSource, NextBlock, RawLog,
    SourcedBlock, CANONICALIZED_BY, EXSAT_MAINNET_CHAIN_ID,
};
pub use reorg::{BlockRef, ChainTracker, Observation, ReorgError};
pub use signatures::{
    BnriFamily, SignatureEntry, SignatureTable, TableError, Verification,
    BNRI_GENESIS_V0_UNVERIFIED,
};
