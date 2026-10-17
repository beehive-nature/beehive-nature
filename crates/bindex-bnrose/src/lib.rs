//! bindex-bnrose: the BNROSE-facing read path of b-index (SOVEXEC-003).
//!
//! A reader obtains a result about an executed BNRoSe operation whose
//! origin, relevant state and verification status can be checked
//! independently of the machine that served it. That is the whole
//! purpose; everything below is in service of it.
//!
//! ## What it reads (read-only, never writes to the state directory)
//!
//! - `journal.bin` and `replica/journal.bin`: the supervisor's append-only
//!   records (`bnrose-exec-host::journal`, record body
//!   `version u8 | seq u64 | op_id 32 | event u8 | payload_len u32 | payload`
//!   framed as `len u32 | body | tag 32`).
//! - `effects.bin`: the effect ledger rows (`bnrose-exec-host::ledger`).
//! - `receipts/op-<hex>.json`: the supervisor's Ed25519 receipts
//!   (`bnrose-exec-host::receipt`, format `bnrose-exec/receipt/1`).
//! - The supervisor's RECEIPT PUBLIC KEY, handed in by the operator (the
//!   `status` command of `bnrose-exec` prints it as `receiptPublicKey`).
//!
//! It never reads the root key file, never derives a key, never holds a
//! MAC. The keyless law of SPEC-BINDEXER-0 is enforced by a source scan
//! in `tests/keyless.rs`, exactly as `bindexer` enforces it.
//!
//! ## The verification ladder, and what each rung can and cannot see
//!
//! | rung | verified from | class |
//! |---|---|---|
//! | the receipt signature | the handed public key, nothing else | `receipt` (VERIFIED) |
//! | the operation identity: `op_id = SHA-256("bnrose-exec/op-id/1" ‖ authority ‖ env)`, `env_sha`, `effect_digest` | recomputed through `bnrose-exec-core` from the Admitted record's own bytes | `recomputed` (VERIFIED) |
//! | the WB001 binding: the envelope verifies under the authority the record names | `btungsten_wb001::verify_envelope` (public key inside the record) | `recomputed` (VERIFIED) |
//! | the state machine: the records replayed through `bnrose_exec_core::transition` with the relaxed clock the supervisor's own recovery uses | the core, no keys | `recomputed` (VERIFIED) |
//! | receipt ↔ replay: op, env_sha, state, recovered, fail, effect agree; `seq_head` covers the op; the record at `seq_head - 1` carries the `journal_head` the receipt names | the two above | `receipt` (VERIFIED) |
//! | the journal's chain tags (HMAC-SHA256 under the supervisor's journal key) | NOT verifiable here: the key is the supervisor's, by construction | `served` (UNVERIFIED) |
//! | the effect ledger's chain tags | the same | `served` (UNVERIFIED) |
//! | `included` / `executed` / `final` on any external system | no destination record is read by this crate | explicit `null` |
//!
//! Consequence, stated so nobody reads more into an answer than it holds:
//! a flipped byte in an Admitted envelope, a Dispatch digest or a Response
//! verdict is CONVICTED keyless (identity recomputation, replay, receipt
//! consistency). A flipped byte in a payload the receipt does not bind
//! (a Reserve reservation, a BoundedFail word) is INVISIBLE keyless: it
//! stays `served`. `tests/acceptance.rs` pins both facts; the second is
//! the named gap a public chain head in the receipt would close (a
//! one-line proposal to the owner of `bnrose-exec-core`, not made here).
//!
//! ## The index's own commitment
//!
//! The index publishes `index_head = SHA-256("bindex-bnrose/head/1" ‖ prev ‖
//! record_digest(seq, op, event, payload))` over the served records, with
//! `record_digest` from the core. It is THIS INDEX's commitment to what it
//! read, not the supervisor's; a re-ingest whose prefix head differs is a
//! fork and is refused and recorded, never merged.
//!
//! ## Replicas, lag, divergence, freshness
//!
//! Both journal replicas are read. Byte-identical → `Agree`. One a strict
//! prefix of the other → the common prefix is ingested and the lag is
//! marked. Any other difference → divergence: nothing is written except a
//! `divergences` row, and the ingest refuses. One replica unreadable → the
//! other is ingested with `single_replica = true`, which surfaces must
//! render (the `single_source` mark of SPEC-BINDEXER-0 §3, carried over).
//! Every answer carries `covered_through_seq`, the byte length of each
//! replica at read, and the read time: an index is stale by construction
//! the moment it is written, and says so.

#![forbid(unsafe_code)]

pub mod ingest;
pub mod journal_read;
pub mod query;
pub mod serve;
pub mod store;
pub mod verify;

use std::fmt;

/// Everything that can go wrong, named. A refusal is a structural answer;
/// an unverified fact is never a refusal, it is a marked fact.
#[derive(Debug)]
pub enum Error {
    Io(String),
    Journal(journal_read::ReadError),
    Db(String),
    /// the ingest refused to write: replica divergence, a fork against the
    /// index's own commitment, a malformed admission, an unknown entity
    Refused(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "io: {e}"),
            Error::Journal(e) => write!(f, "journal: {e}"),
            Error::Db(e) => write!(f, "db: {e}"),
            Error::Refused(e) => write!(f, "refused: {e}"),
        }
    }
}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Error {
        Error::Db(e.to_string())
    }
}

impl From<journal_read::ReadError> for Error {
    fn from(e: journal_read::ReadError) -> Error {
        Error::Journal(e)
    }
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn unhex(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err("odd hex length".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

pub fn unhex32(s: &str) -> Result<[u8; 32], String> {
    unhex(s)?
        .try_into()
        .map_err(|_| "expected 32 bytes".to_string())
}

/// The journal event names, the words the receipts and this index use.
pub fn event_word(event: u8) -> &'static str {
    match event {
        bnrose_exec_core::E_ADMITTED => "admitted",
        bnrose_exec_core::E_RESERVE => "reserve",
        bnrose_exec_core::E_DISPATCH => "dispatch",
        bnrose_exec_core::E_RESPONSE => "response",
        bnrose_exec_core::E_BOUNDED_FAIL => "bounded-fail",
        bnrose_exec_core::E_LOST_RESPONSE => "lost-response",
        bnrose_exec_core::E_RECOVERY_EVIDENCE => "recovery-evidence",
        bnrose_exec_core::E_RECOVERY_NONE => "recovery-none",
        bnrose_exec_core::E_MIGRATION => "migration",
        bnrose_exec_core::E_STEP_ADMITTED => "step-admitted",
        _ => "unrecognized",
    }
}

/// Seconds since the Unix epoch, the only clock this crate reads (for the
/// `read_at` freshness mark; never a verdict).
pub fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
