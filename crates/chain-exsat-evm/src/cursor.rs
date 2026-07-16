//! The resumable cursor — what a crash must not lose.
//!
//! # The invariant
//!
//! Exactly-once emission across restarts, keyed on the idempotency triple
//! `(block_number, tx_hash, log_index)`.
//!
//! The cursor stores the **last emitted position** as `(block_number,
//! log_index)`, and resume emits only logs strictly greater in that
//! lexicographic order. `tx_hash` is not part of the ordering because it
//! carries none: `log_index` is unique within a block and already orders
//! every log in it. The tx hash rides in the event's `source_ref` and
//! `event_id`, where it identifies; here, only order matters.
//!
//! Storing a *position* rather than a *block* is what makes a mid-block crash
//! safe. A block-granular cursor forces a choice between re-emitting the whole
//! block (duplicates) and skipping it (loss); a position-granular cursor
//! resumes mid-block exactly where it stopped.
//!
//! # Why the block hash is here too
//!
//! `last_emitted_block_hash` pins the *history* the cursor was written
//! against. On resume the indexer checks that the block it emitted from still
//! has that hash. If it does not, the chain reorganized below the cursor while
//! the process was down: events that already crossed the bus are now on an
//! orphaned branch. That is unrecoverable by this adapter — it cannot unsay
//! them — so it blocks and says so, rather than continuing on a history that
//! contradicts what it already emitted.
//!
//! # Persistence
//!
//! This module serializes; it does not do file I/O. Where the bytes land is
//! the caller's business (the tree's `chain-eos.watermark` is the local
//! precedent). Keeping I/O out means the crash-resume path is exercised by
//! tests with no filesystem in the way.

use serde::{Deserialize, Serialize};

/// The last `(block, log)` position emitted onto the bus.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmittedPosition {
    pub block_number: u64,
    pub log_index: u64,
    /// 0x-prefixed hex of the hash of `block_number` as it was when emitted.
    pub block_hash: String,
}

impl EmittedPosition {
    /// Lexicographic order on `(block_number, log_index)`.
    pub fn as_key(&self) -> (u64, u64) {
        (self.block_number, self.log_index)
    }
}

/// A persisted indexing position. `None` = nothing emitted yet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Cursor {
    pub last_emitted: Option<EmittedPosition>,
}

/// A cursor that could not be read back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CursorError(pub String);

impl std::fmt::Display for CursorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "cursor: {}", self.0)
    }
}

impl std::error::Error for CursorError {}

impl Cursor {
    /// A fresh cursor — nothing emitted.
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether `(block_number, log_index)` is still ahead of the cursor, i.e.
    /// not yet emitted.
    pub fn is_ahead(&self, block_number: u64, log_index: u64) -> bool {
        match &self.last_emitted {
            None => true,
            Some(p) => (block_number, log_index) > p.as_key(),
        }
    }

    /// Record a position as emitted.
    ///
    /// Monotonic: a position at or behind the current one is ignored rather
    /// than rewinding the cursor. A cursor that can move backwards is a
    /// cursor that can re-emit.
    pub fn advance_to(&mut self, block_number: u64, log_index: u64, block_hash: String) {
        if self.is_ahead(block_number, log_index) {
            self.last_emitted = Some(EmittedPosition {
                block_number,
                log_index,
                block_hash,
            });
        }
    }

    /// Serialize for persistence.
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).expect("Cursor is plain data and always serializes")
    }

    /// Read back a persisted cursor. A cursor that does not parse is an
    /// error, never a silently-fresh cursor: treating a corrupt cursor as
    /// "start from scratch" would re-emit history.
    pub fn from_json(s: &str) -> Result<Self, CursorError> {
        serde_json::from_str(s).map_err(|e| CursorError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_cursor_is_behind_everything() {
        let c = Cursor::new();
        assert!(c.is_ahead(0, 0));
        assert!(c.is_ahead(1_000_000, 5));
    }

    #[test]
    fn cursor_orders_lexicographically_on_block_then_log_index() {
        let mut c = Cursor::new();
        c.advance_to(100, 3, "0xaa".into());

        assert!(!c.is_ahead(100, 3), "the emitted position itself is behind");
        assert!(!c.is_ahead(100, 2), "earlier log in same block is behind");
        assert!(
            !c.is_ahead(99, 999),
            "any log in an earlier block is behind"
        );
        assert!(c.is_ahead(100, 4), "later log in same block is ahead");
        assert!(c.is_ahead(101, 0), "any log in a later block is ahead");
    }

    #[test]
    fn cursor_never_rewinds() {
        let mut c = Cursor::new();
        c.advance_to(100, 3, "0xaa".into());
        c.advance_to(50, 0, "0xbb".into()); // stale write
        assert_eq!(c.last_emitted.as_ref().unwrap().as_key(), (100, 3));
    }

    #[test]
    fn cursor_roundtrips_through_json() {
        let mut c = Cursor::new();
        c.advance_to(7_000_001, 12, "0xdeadbeef".into());
        let back = Cursor::from_json(&c.to_json()).unwrap();
        assert_eq!(c, back);
    }

    #[test]
    fn fresh_cursor_roundtrips_through_json() {
        let c = Cursor::new();
        assert_eq!(Cursor::from_json(&c.to_json()).unwrap(), c);
        assert!(Cursor::from_json(&c.to_json())
            .unwrap()
            .last_emitted
            .is_none());
    }

    #[test]
    fn corrupt_cursor_is_an_error_not_a_fresh_start() {
        // Silently starting over would re-emit every event from genesis.
        assert!(Cursor::from_json("{ not json").is_err());
        assert!(Cursor::from_json("").is_err());
    }

    #[test]
    fn cursor_carries_the_block_hash_it_was_written_against() {
        let mut c = Cursor::new();
        c.advance_to(100, 0, "0xabc".into());
        assert_eq!(c.last_emitted.unwrap().block_hash, "0xabc");
    }
}
