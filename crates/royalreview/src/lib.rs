//! `royalreview` — the experimental Royal Review record and its Nostr twin.
//!
//! z1.d lane, order 4 of the 2026-09-12 zCode takeover docket: one locally
//! testable vertical slice. **No PDS write, no public posting, no new
//! deployment is authorized here** — every network-facing boundary is a
//! trait, tests inject fixtures, and nothing in this crate opens a socket.
//!
//! ## The slice
//!
//! 1. [`record`] — the `com.beehivenature.temp.royalReview` record type.
//!    The `.temp.` segment follows the AT Protocol Lexicon *Style Guide*
//!    ("Experimental schemas and projects can use variant NSIDs (eg,
//!    including .temp. in the name hierarchy)") — a naming convention, not
//!    an NSID-spec rule; see the dispatch's verification table.
//! 2. [`validate`] — deterministic local validation of a Review against the
//!    Lexicon JSON artifact's constraints, plus the fail-closed
//!    receipt-cross-validation (a referenced `com.beehivenature.receipt`
//!    must be produced and re-validate via `atmirror::receipt::Receipt`).
//! 3. [`twin`] — the Nostr twin event (kind 30078, NIP-78 app-specific
//!    data; parameterized-replaceable by d-tag per NIP-01) with the event
//!    id computed locally — the re-hash law applied to the owned rail.
//! 4. [`orchestrator`] — two-rail publication with per-rail operation
//!    state: partial success is a first-class outcome, retries never
//!    duplicate a landed rail, and [`orchestrator::TwinReport`]
//!    structurally cannot report both-rails-OK when one failed.
//!
//! ## Reused from atmirror (not re-implemented)
//!
//! `atmirror::receipt::StrongRef` (the record types), `atmirror::cid::Cid`
//! (`format: cid` syntax checks), `atmirror::receipt::Receipt::binding_ok`
//! (the §5 contentCid law, applied to cross-validated receipts), and the
//! house architecture: traits + fixtures, no ambient clocks, refusal as a
//! first-class outcome, state-as-cache with probe-based recovery.
//!
//! ## Known asymmetry (honest, not hidden)
//!
//! The Nostr event id is **computed locally** (sha256 over the canonical
//! serialization) and a sink's answer is checked against it. The atproto
//! record CID is **reported by the sink and recorded UNVERIFIED-locally**:
//! atmirror carries a DAG-CBOR decoder but no generic encoder, and a wrong
//! locally-computed CID would be worse than an honest UNVERIFIED. Duplicate
//! detection on the atproto rail uses record-value equality instead, which
//! needs no CID computation. Remaining work is ledgered in the dispatch.
//!
//! ## Verification levels — syntax ≠ claimed identity ≠ verified bytes
//!
//! Three distinct claims travel through this crate, and conflating them is
//! the review-forger's favorite trick. This crate only ever makes the
//! first, and checks the shape of the second:
//!
//! - **L0 — syntax.** A sha256 field is *lowercase hex of the right
//!   length*; a CID is *parseable*; a uri is *well-formed*. Proven here,
//!   and NOTHING more: a well-shaped digest is an assertion's shape, not a
//!   fact about any bytes.
//! - **L1 — claimed identity.** `subject.cid` / a receipt's `contentCid`
//!   are pointers ASSERTED BY THE WRITER of the referenced record. We
//!   check their shape and internal consistency (the §5 binding law,
//!   coordinate equality), but we never hashed the underlying blocks —
//!   those claims ride on the atproto verification chain, not on us.
//! - **L2 — retrieved and hashed.** Fetching the storage-referenced bytes
//!   and hashing them against `storageRefs[].sha256`. This is a
//!   LIVE-ADAPTER responsibility (the next slice); nothing in this crate
//!   performs it, and no test here should be read as if it had.
//!
//! ## What the fixtures prove — and what they do not
//!
//! The in-memory sinks prove the orchestrator's decision table: ordering,
//! identity gates, duplicate prevention, unconfirmed-outcome epistemics,
//! retry-without-duplication — deterministically, with zero sockets. They
//! do NOT prove: network delivery of any kind; that a live relay or PDS
//! maps errors onto `Rejected` (→`Failed`) versus transport (→
//! `Unconfirmed`) as the fixtures do; or ANY atomicity across the two
//! rails — the write pair is not a transaction, and a crash between rails
//! is exactly the partial state the state machine is designed to surface,
//! not hide.
//!
//! ## The future live-sink contract (acceptance requirements, not gifts
//! from sequential fixtures)
//!
//! A live adapter must be ACCEPTED against these semantics before its
//! outcomes can be trusted: only a **proven rejection-before-write** (the
//! server explicitly refused, and nothing was stored) may map to
//! `Failed`; ambiguous server/transport errors after a possible store map
//! to `Unconfirmed` and must be settled by probe. Concurrent-writer races
//! (two writers, same rkey, overlapping create calls) are NOT covered by
//! these sequential fixtures and are adapter acceptance requirements. The
//! sink-reported atproto CID stays UNVERIFIED-locally until a DAG-CBOR
//! encoder or a post-write verification round-trip closes that gap.

#![forbid(unsafe_code)]

pub mod fixtures;
pub mod orchestrator;
pub mod record;
pub mod twin;
pub mod validate;
