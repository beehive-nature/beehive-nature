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

#![forbid(unsafe_code)]

pub mod fixtures;
pub mod orchestrator;
pub mod record;
pub mod twin;
pub mod validate;
