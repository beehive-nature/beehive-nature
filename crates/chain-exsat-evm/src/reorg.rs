//! Reorg tracking — parent-linkage over a retained window, fail-closed.
//!
//! # Why this exists at all
//!
//! exSat EVM blocks are ~1s. A log observed at the head is a *proposal*, not
//! a fact: the block carrying it can be replaced. An indexer that emits at the
//! head will eventually emit an event that later did not happen, and the bus
//! has no retraction (K-7: what crosses stands). So nothing is emitted until
//! it is buried under a confirmation depth.
//!
//! # What is trusted, and what is not
//!
//! Reorg truth here comes from **parent-hash linkage** — `block.parent_hash`
//! must equal the hash of the block below it — which this adapter checks
//! itself. It does not come from the RPC's `removed` flag on a log: that is a
//! transport-level assertion this adapter cannot verify, and a transport
//! error must never collapse into a decision. See [`crate::indexer`], which
//! refuses `removed` logs outright rather than acting on them.
//!
//! # The confirmation depth is UNVERIFIED
//!
//! [`crate::indexer::IndexerConfig::confirmation_depth`] is a config value
//! with **no defensible default**, and this crate does not supply one. exSat's
//! Savanna-derived finality means the honest depth is an N-1 measurement item
//! against a real endpoint — observed fork depths over time, plus the
//! finality rule as implemented. Writing a number here and calling it "safe"
//! would be inventing a measurement. The caller must choose it, and own it.
//!
//! # Fail-closed
//!
//! Any reorg this tracker cannot resolve within its retained window is
//! [`ReorgError::AmbiguousReorg`] — blocked, never guessed. Indeterminate
//! state is not "probably fine".

use std::collections::VecDeque;

/// The identity and linkage of one block. `parent_hash` is what makes a chain
/// a chain rather than a list of heights.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockRef {
    pub number: u64,
    pub hash: [u8; 32],
    pub parent_hash: [u8; 32],
    /// Block timestamp (unix seconds) — becomes `CanonicalEvent::timestamp`.
    pub timestamp: i64,
}

/// Why the tracker refused an observation. Every variant blocks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReorgError {
    /// A fork whose common ancestor is not in the retained window. The
    /// tracker cannot tell which blocks were orphaned, so it refuses to
    /// decide. Deepen `retain_blocks` or resync from a cursor.
    AmbiguousReorg {
        observed: u64,
        retained_from: u64,
        retained_to: u64,
    },
    /// A gap: blocks arrived out of order or one was skipped. The tracker
    /// needs contiguous blocks to maintain linkage, and will not interpolate.
    Gap { expected: u64, got: u64 },
    /// The same height and hash was re-observed with a different parent. The
    /// source is contradicting itself; nothing sound can be concluded.
    InconsistentBlock { number: u64 },
}

impl std::fmt::Display for ReorgError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReorgError::AmbiguousReorg {
                observed,
                retained_from,
                retained_to,
            } => write!(
                f,
                "reorg at block {observed}: no common ancestor in retained \
                 window [{retained_from}, {retained_to}] — BLOCKED, not guessed"
            ),
            ReorgError::Gap { expected, got } => {
                write!(f, "block gap: expected {expected}, got {got}")
            }
            ReorgError::InconsistentBlock { number } => write!(
                f,
                "block {number}: same hash re-observed with a different parent"
            ),
        }
    }
}

impl std::error::Error for ReorgError {}

/// What an observation did to the canonical chain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Observation {
    /// The chain grew by one block (or anchored its first).
    Extended,
    /// An already-known block was re-observed identically. No-op — this is
    /// what makes replay safe.
    Duplicate,
    /// A fork. `fork_point` is the number of the last common ancestor: every
    /// retained block **above** it was orphaned and has been dropped.
    Reorg { fork_point: u64 },
}

/// A sliding window of contiguous canonical blocks, linked by parent hash.
#[derive(Debug, Clone)]
pub struct ChainTracker {
    /// Ascending by number, contiguous, parent-linked.
    blocks: VecDeque<BlockRef>,
    retain: u64,
}

impl ChainTracker {
    /// `retain` = how many blocks of history to keep for fork resolution. A
    /// fork deeper than this is [`ReorgError::AmbiguousReorg`], so this is
    /// the tracker's honesty horizon: it bounds what the tracker will claim
    /// to know, and beyond it the tracker says "I don't know" instead of
    /// guessing. It must exceed the confirmation depth.
    pub fn new(retain: u64) -> Self {
        Self {
            blocks: VecDeque::new(),
            retain: retain.max(1),
        }
    }

    pub fn tip(&self) -> Option<&BlockRef> {
        self.blocks.back()
    }

    pub fn earliest(&self) -> Option<&BlockRef> {
        self.blocks.front()
    }

    pub fn len(&self) -> usize {
        self.blocks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.blocks.is_empty()
    }

    /// The retained block at `number`, if any.
    pub fn get(&self, number: u64) -> Option<&BlockRef> {
        let front = self.blocks.front()?.number;
        let idx = number.checked_sub(front)?;
        self.blocks.get(usize::try_from(idx).ok()?)
    }

    /// Decide what a block *would* do to the window, without touching it.
    ///
    /// Split out from [`ChainTracker::observe`] so a caller can refuse a block
    /// **before** the tracker adopts it. That ordering is load-bearing, not
    /// tidiness: `observe` resolves a reorg by rolling back the losing branch
    /// and pushing the winner, so a caller that classified by calling
    /// `observe` and *then* refused would be refusing a block the tracker had
    /// already adopted — leaving the refusal half-applied, and leaving the
    /// identical replay looking like a [`Observation::Duplicate`] no-op.
    ///
    /// Contract: blocks arrive in ascending order with no gaps, except that a
    /// reorg may re-deliver a height already seen. Anything else is refused.
    pub fn classify(&self, block: &BlockRef) -> Result<Observation, ReorgError> {
        let Some(tip) = self.blocks.back() else {
            // First block anchors the window. There is nothing below it to
            // link against, so linkage checks start from the next one.
            return Ok(Observation::Extended);
        };

        // --- Case 1: the natural next block ---------------------------------
        if block.number == tip.number + 1 {
            if block.parent_hash == tip.hash {
                return Ok(Observation::Extended);
            }
            // Same height as expected, but it does not build on our tip: a
            // fork happened at or below the tip.
            return Ok(Observation::Reorg {
                fork_point: self.fork_point_for(block)?,
            });
        }

        // --- Case 2: a height we already hold -------------------------------
        if block.number <= tip.number {
            if let Some(known) = self.get(block.number) {
                if known.hash == block.hash {
                    if known.parent_hash != block.parent_hash {
                        return Err(ReorgError::InconsistentBlock {
                            number: block.number,
                        });
                    }
                    // Identical re-delivery. Replay is a no-op, by design.
                    return Ok(Observation::Duplicate);
                }
                // A different block at a height we hold: a fork replacing it.
                return Ok(Observation::Reorg {
                    fork_point: self.fork_point_for(block)?,
                });
            }
            // Below the retained window — we cannot resolve it.
            return Err(self.ambiguous(block.number));
        }

        // --- Case 3: a gap ---------------------------------------------------
        // Skipping ahead would mean unlinked history. Never interpolate.
        Err(ReorgError::Gap {
            expected: tip.number + 1,
            got: block.number,
        })
    }

    /// Observe a block: [`ChainTracker::classify`] it, then apply what that
    /// decided. A classification error mutates nothing.
    pub fn observe(&mut self, block: BlockRef) -> Result<Observation, ReorgError> {
        let observation = self.classify(&block)?;
        match observation {
            // Replay is a no-op, by design.
            Observation::Duplicate => {}
            Observation::Extended => {
                self.blocks.push_back(block);
                self.trim();
            }
            Observation::Reorg { fork_point } => {
                self.rollback_above(fork_point);
                self.blocks.push_back(block);
                self.trim();
            }
        }
        Ok(observation)
    }

    /// Find the retained block that `block` builds on. Its number is the fork
    /// point: everything above it is orphaned.
    fn fork_point_for(&self, block: &BlockRef) -> Result<u64, ReorgError> {
        if block.number == 0 {
            return Err(self.ambiguous(block.number));
        }
        let parent_number = block.number - 1;
        match self.get(parent_number) {
            Some(parent) if parent.hash == block.parent_hash => Ok(parent_number),
            // Either we do not retain the parent height, or the block at that
            // height is not this block's parent — meaning the fork is deeper
            // than one block. Resolving that needs the competing chain's
            // intermediate blocks, which we were not given. Refuse.
            _ => Err(self.ambiguous(block.number)),
        }
    }

    fn ambiguous(&self, observed: u64) -> ReorgError {
        ReorgError::AmbiguousReorg {
            observed,
            retained_from: self.blocks.front().map(|b| b.number).unwrap_or(0),
            retained_to: self.blocks.back().map(|b| b.number).unwrap_or(0),
        }
    }

    /// Drop every retained block above `fork_point`.
    fn rollback_above(&mut self, fork_point: u64) {
        while self
            .blocks
            .back()
            .is_some_and(|b| b.number > fork_point)
        {
            self.blocks.pop_back();
        }
    }

    fn trim(&mut self) {
        while self.blocks.len() as u64 > self.retain {
            self.blocks.pop_front();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(n: u8) -> [u8; 32] {
        [n; 32]
    }

    fn blk(number: u64, hash: u8, parent: u8) -> BlockRef {
        BlockRef {
            number,
            hash: h(hash),
            parent_hash: h(parent),
            timestamp: 1_782_000_000 + number as i64,
        }
    }

    fn tracker_with_chain() -> ChainTracker {
        let mut t = ChainTracker::new(16);
        t.observe(blk(100, 1, 0)).unwrap();
        t.observe(blk(101, 2, 1)).unwrap();
        t.observe(blk(102, 3, 2)).unwrap();
        t
    }

    #[test]
    fn linear_chain_extends() {
        let t = tracker_with_chain();
        assert_eq!(t.tip().unwrap().number, 102);
        assert_eq!(t.len(), 3);
    }

    #[test]
    fn wrong_parent_at_next_height_is_a_reorg_at_the_tip_minus_one() {
        let mut t = tracker_with_chain();
        // 103' claims 102's parent (block 2) — so it forks at 101.
        let obs = t.observe(blk(102, 9, 2)).unwrap();
        assert_eq!(obs, Observation::Reorg { fork_point: 101 });
        assert_eq!(t.tip().unwrap().hash, h(9));
        assert_eq!(t.len(), 3); // 100, 101, 102'
    }

    #[test]
    fn identical_redelivery_is_a_duplicate_noop() {
        let mut t = tracker_with_chain();
        assert_eq!(t.observe(blk(102, 3, 2)).unwrap(), Observation::Duplicate);
        assert_eq!(t.len(), 3);
        assert_eq!(t.tip().unwrap().hash, h(3));
    }

    #[test]
    fn reorg_drops_orphaned_blocks_above_the_fork_point() {
        let mut t = ChainTracker::new(16);
        t.observe(blk(100, 1, 0)).unwrap();
        t.observe(blk(101, 2, 1)).unwrap();
        t.observe(blk(102, 3, 2)).unwrap();
        t.observe(blk(103, 4, 3)).unwrap();

        // 102' builds on 101 — orphaning 102 and 103.
        let obs = t.observe(blk(102, 8, 2)).unwrap();
        assert_eq!(obs, Observation::Reorg { fork_point: 101 });
        assert_eq!(t.tip().unwrap().number, 102);
        assert_eq!(t.tip().unwrap().hash, h(8));
        assert!(t.get(103).is_none(), "orphaned block must be dropped");
    }

    #[test]
    fn gap_is_refused_not_interpolated() {
        let mut t = tracker_with_chain();
        assert_eq!(
            t.observe(blk(105, 9, 3)).unwrap_err(),
            ReorgError::Gap {
                expected: 103,
                got: 105
            }
        );
    }

    #[test]
    fn fork_deeper_than_retained_window_is_ambiguous_and_blocks() {
        let mut t = ChainTracker::new(2);
        t.observe(blk(100, 1, 0)).unwrap();
        t.observe(blk(101, 2, 1)).unwrap();
        t.observe(blk(102, 3, 2)).unwrap();
        // window now holds only 101, 102.
        // A block claiming to build on something at height 99 — unretained.
        let err = t.observe(blk(100, 7, 6)).unwrap_err();
        assert!(matches!(err, ReorgError::AmbiguousReorg { observed: 100, .. }));
    }

    #[test]
    fn fork_whose_parent_is_unknown_is_ambiguous_and_blocks() {
        let mut t = tracker_with_chain();
        // 103 claims a parent hash we have never seen: we cannot tell what
        // was orphaned. Must block, must not guess.
        let err = t.observe(blk(103, 9, 99)).unwrap_err();
        assert!(matches!(err, ReorgError::AmbiguousReorg { observed: 103, .. }));
        // And the tracker must not have mutated on a refusal.
        assert_eq!(t.tip().unwrap().number, 102);
        assert_eq!(t.len(), 3);
    }

    #[test]
    fn same_hash_different_parent_is_inconsistent() {
        let mut t = tracker_with_chain();
        let err = t.observe(blk(102, 3, 77)).unwrap_err();
        assert_eq!(err, ReorgError::InconsistentBlock { number: 102 });
    }

    #[test]
    fn window_trims_to_retain() {
        let mut t = ChainTracker::new(3);
        t.observe(blk(1, 1, 0)).unwrap();
        for n in 2..=10u64 {
            t.observe(blk(n, n as u8, (n - 1) as u8)).unwrap();
        }
        assert_eq!(t.len(), 3);
        assert_eq!(t.earliest().unwrap().number, 8);
        assert_eq!(t.tip().unwrap().number, 10);
    }

    #[test]
    fn genesis_block_zero_fork_is_ambiguous() {
        let mut t = ChainTracker::new(4);
        t.observe(blk(0, 1, 0)).unwrap();
        // A competing block 0 has no parent to link against.
        let err = t.observe(blk(0, 2, 0)).unwrap_err();
        assert!(matches!(err, ReorgError::AmbiguousReorg { observed: 0, .. }));
    }

    #[test]
    fn reorg_error_display_says_blocked() {
        let e = ReorgError::AmbiguousReorg {
            observed: 5,
            retained_from: 1,
            retained_to: 4,
        };
        assert!(e.to_string().contains("BLOCKED"));
    }
}
