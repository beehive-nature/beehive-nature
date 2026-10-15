//! `bnr-explorer` — the read-only explorer kernel. Serves **L1 (eternal data)**
//! of the BNRoSe Charter: it is how a person browses what the rails hold.
//!
//! Four ideas taken as PATTERN from the Strata file manager (lgse/strata
//! v1.0.0, MIT, commit `0a086aa3b`; nothing copied, its docs only):
//!
//! 1. **Bounded batches.** A listing arrives in batches of at most
//!    [`listing::MAX_BATCH`] entries, so the first useful row does not wait on
//!    the last one.
//! 2. **Stale work is harmless.** Every navigation mints a fresh
//!    [`listing::Ticket`]; a batch, a completion or a render report carrying an
//!    older ticket is refused, so a slow answer for the folder the person
//!    already left can never paint over the one they are in.
//! 3. **A listing is not permission.** Opening re-reads the source and
//!    [`open::revalidate`] refuses when the object is gone, its identity
//!    changed, or the grant it was listed under is stale.
//! 4. **Identity first, then bounds, then parsing.** [`preview::preview`]
//!    hashes the bytes against the content address *before* it looks inside
//!    them, under a budget the caller cannot loosen.
//!
//! What the kernel is NOT: a storage trait (reads go through the existing
//! rails — `atmirror::rail::Rail` natively, the adapter contract in a page),
//! an authority (grants are minted elsewhere; this only checks they are still
//! the ones the listing saw), or a decoder of pixels (it reads image headers
//! to gate size; drawing is the platform's).
//!
//! **Unnameable, not forbidden.** The crate is `no_std` with `alloc` only:
//! there is no `std::fs`, `std::net`, `std::process` or clock to reach, so
//! "the kernel does no I/O" is a property of what can be named here, not of
//! code review. Time is always an argument.

#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;
#[cfg(test)]
extern crate std;

pub mod id;
pub mod listing;
pub mod name;
pub mod open;
pub mod preview;
pub mod tree;
pub mod wire;

pub use id::{HashAlg, ObjectId};
pub use listing::{BatchVerdict, Entry, Kind, ListRefusal, Marks, Navigator, Ticket};
pub use open::{revalidate, Grant, OpenRefusal};
pub use preview::{preview, Budget, ImageFormat, Preview, Unavailable};
