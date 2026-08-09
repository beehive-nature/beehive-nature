//! `atmirror` — mirror an AT Protocol repository to permanent storage.
//!
//! The CAR-file permanence mirror that SPEC_LEXICON-1 §12 ruled a separate
//! TAKE. Input: a DID (or handle) and a target rail (`arweave` | `autonomi`).
//! Output: a manifest in the shape of `com.beehivenature.receipt`
//! (SPEC_LEXICON-1 §4) binding the repo's signed commit CID to the
//! permanence addresses of the CAR file and every blob.
//!
//! ## The predicate (K-4, network side)
//!
//! `sense-atproto` holds the pure-logic seam; this crate is its
//! network-facing counterpart and enforces the same discipline **before
//! anything is uploaded**:
//!
//! 1. Every CAR block's bytes re-hash to the block's claimed CID.
//! 2. The root commit's signature verifies against the account's signing
//!    key from its DID document (secp256k1 or P-256, low-S enforced).
//! 3. The MST is complete: every node and record the commit's `data` tree
//!    references is present in the CAR.
//! 4. Every blob's bytes re-hash to the blob's CID before upload.
//!
//! Failure at step 1–3: **the repo is not mirrored** and nothing is
//! fabricated in its place. Failure at step 4 for one blob: that blob is
//! refused and reported; the verified remainder still mirrors (a hostile
//! or partially-migrated PDS must not be able to hold the whole repo
//! hostage via one bad blob — but a receipt never lists an unverified
//! artifact).
//!
//! ## Trust posture — the uncooperative host
//!
//! `com.atproto.sync.getRepo` is public and unauthenticated; nothing here
//! needs the PDS operator's cooperation beyond serving public bytes. The
//! PDS is never trusted: blob enumeration is the **union** of the PDS's
//! `listBlobs` answer and the blob references extracted from the verified
//! records themselves, so a host that lies by omission still cannot hide
//! a referenced blob. Identity truth comes from the DID directory
//! (plc.directory / did:web), never from the PDS.
//!
//! ## Boundaries (house style)
//!
//! Network and rails live behind traits ([`crate::xrpc::Pds`],
//! [`crate::rail::Rail`]); tests inject fixtures and **never touch the
//! network**. The library takes `created_at` as an argument — no ambient
//! clocks (determinism law). Key custody: none. The Arweave path signs
//! client-side with a locally loaded or locally generated JWK; the
//! Autonomi path shells out to the `ant` network client (process
//! boundary — the GPL-3.0 crate is not linked; see the D-2 gate note in
//! `autonomi.rs`).

#![forbid(unsafe_code)]

pub mod arweave;
pub mod autonomi;
pub mod car;
pub mod cbor;
pub mod cid;
pub mod commit;
pub mod epoch_funding;
pub mod did;
pub mod mirror;
pub mod mst;
pub mod rail;
pub mod receipt;
pub mod record_sig;
pub mod restore;
pub mod state;
pub mod varint;
pub mod xrpc;
