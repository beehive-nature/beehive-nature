//! The indexing state machine: confirmed logs in, `CanonicalEvent`s out.
//!
//! # Why this adapter constructs `CanonicalEvent` directly
//!
//! It does **not** route through `normalizer::normalize()`, and that is a
//! correctness requirement rather than a style preference.
//!
//! `normalizer::RawChainAction` has no `log_index`, and `normalize()` derives
//! `event_id` as `{chain}-{tx_id}-{action_name}`. One EVM transaction can emit
//! many logs of the *same* event type — that is ordinary, not exotic — and
//! every one of them would collapse onto a single `event_id`. The idempotency
//! key this adapter is required to hold, `(block_number, tx_hash, log_index)`,
//! cannot survive that seam. So this crate follows the *other* in-tree adapter
//! pattern — `sense-atproto` and `adapter-arweave` construct `CanonicalEvent`
//! directly and set their own `event_id` and `canonicalized_by` — and encodes
//! the triple itself. The normalizer is not modified; EVM logs simply are not
//! its shape.
//!
//! # Identity encoding
//!
//! - `event_id`  = `exsatevm-{block_number}-{tx_hash}-{log_index}`
//! - `source_ref` = `{block_number}:{tx_hash}#{log_index}`
//!
//! `source_ref` merges two in-tree precedents: the `{block}:{tx}` shape from
//! `normalizer::normalize()`, and the `#`-fragment disambiguator from
//! `sense-atproto`'s `at://<did>/<collection>/<rkey>#<cid>`. There the
//! fragment pins *which version* of a record; here it pins *which log* of a
//! transaction. Both make an otherwise-ambiguous reference identify exactly
//! one thing.
//!
//! # Why the triple is safe under reorgs
//!
//! `block_number` sits inside the identity, so the same transaction
//! re-included at a different height would key differently — and that is a
//! duplicate-emission bug if both heights emit.
//!
//! What rules that out is [`IndexError::ReorgBelowEmitted`]: a fork below an
//! already-emitted block is a latched halt, so re-inclusion at a new height
//! can only be *followed by emission* for logs that were never emitted at the
//! old one. `confirmation_depth` is the other half, and the softer one: a log
//! buried under a depth deeper than any fork the chain actually produces is
//! not re-included in the first place, so the halt never fires. But the depth
//! is **UNVERIFIED** and 0 is an accepted value — at depth 0 logs emit at the
//! tip and re-inclusion is reachable, at which point the halt is what stands
//! between the bus and two events for one log. The halt carries the property;
//! the depth keeps it quiet.

use std::collections::BTreeMap;

use shared_types::{BnriEvent, CanonicalEvent, EventPayload, SourceChain};

use crate::abi::{decode_log, hex0x, AbiError, Word};
use crate::cursor::Cursor;
use crate::reorg::{BlockRef, ChainTracker, Observation, ReorgError};
use crate::signatures::{SignatureEntry, SignatureTable, TableError};

/// exSat mainnet chain id.
///
/// Gas on exSat is BTC (18 decimals); the EVM layer is `b`-blind, and nothing
/// in this adapter accounts `b`.
pub const EXSAT_MAINNET_CHAIN_ID: u64 = 7200;

/// The name this adapter stamps into `CanonicalEvent::canonicalized_by`.
pub const CANONICALIZED_BY: &str = "chain-exsat-evm";

// NOTE (UNVERIFIED): the exSat *testnet* chain id is reported in different
// places as 839999 and 840000, and this crate deliberately ships neither as a
// constant — pinning an unverified id is how a wrong pin becomes load-bearing.
// Chain law: never trust an RPC URL; verify `eth_chainId` against the pinned
// config value before acting. See `IndexerConfig::verify_observed_chain_id`.

/// One EVM log as an RPC delivers it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawLog {
    pub block_number: u64,
    pub block_hash: [u8; 32],
    pub tx_hash: [u8; 32],
    pub log_index: u64,
    /// The emitting contract's 20-byte address.
    pub address: [u8; 20],
    pub topics: Vec<Word>,
    pub data: Vec<u8>,
    /// The Ethereum JSON-RPC log object's `removed` flag (`eth_getLogs` /
    /// `eth_subscribe`), set when the RPC believes the log was orphaned.
    ///
    /// This adapter does not act on it — see [`IndexError::RemovedLogObserved`].
    pub removed: bool,
}

/// Indexer configuration.
///
/// There is no `Default`, on purpose: a default would have to invent a
/// `confirmation_depth`, and that number is not knowable here (see below).
/// Making the caller pass it keeps the unverified choice visible at every
/// call site instead of hiding it behind `..Default::default()`.
#[derive(Debug, Clone)]
pub struct IndexerConfig {
    /// The pinned chain id — never inferred from an RPC URL.
    ///
    /// **A caller obligation, not something this crate enforces.** Chain law
    /// says verify `eth_chainId` against this value before acting on anything
    /// an endpoint says; [`IndexerConfig::verify_observed_chain_id`] is the
    /// check, and the caller **must** call it when wiring a real endpoint.
    /// Nothing here calls it for you: this crate ships no RPC `LogSource` (see
    /// [`LogSource`] — there is no verified exSat endpoint to write one
    /// against), so no code path in it can obtain an observed chain id to
    /// compare. Blocks arrive through [`Indexer::observe_block`] already
    /// stripped of any endpoint identity.
    ///
    /// So this field is inert after construction, and an integrator who wires
    /// a real endpoint without calling `verify_observed_chain_id` gets no
    /// error — just an indexer pointed at whatever chain answered.
    pub chain_id: u64,
    /// **UNVERIFIED — an N-1 measurement item, not a known constant.**
    ///
    /// How deep a block must be buried before its logs may be emitted. exSat
    /// runs Savanna-derived finality with ~1s blocks; the defensible number
    /// comes from measuring observed fork depths against a real endpoint and
    /// from the finality rule as actually implemented. This crate ships no
    /// default and makes no claim about what value is safe. The caller
    /// chooses it and owns it.
    pub confirmation_depth: u64,
    /// Address allowlist. **Empty means deny-all** — an indexer with no
    /// configured contracts indexes nothing, rather than everything.
    pub contracts: Vec<[u8; 20]>,
    /// Opt-in to loading UNVERIFIED signature-table entries. Off in
    /// production: with it off, the placeholder BNRi table refuses to load and
    /// this adapter emits nothing until the real ABI lands.
    pub allow_unverified_signatures: bool,
    /// How many blocks of history to retain for fork resolution. Must exceed
    /// `confirmation_depth`, else a fork could orphan an already-emitted block
    /// from outside the window the tracker can reason about.
    pub retain_blocks: u64,
}

impl IndexerConfig {
    /// Production-shaped config: unverified signatures refused.
    pub fn new(chain_id: u64, confirmation_depth: u64, contracts: Vec<[u8; 20]>) -> Self {
        Self {
            chain_id,
            confirmation_depth,
            contracts,
            allow_unverified_signatures: false,
            retain_blocks: confirmation_depth.saturating_mul(4).max(64),
        }
    }

    /// Chain law: verify `eth_chainId` before acting on anything an endpoint
    /// says. A mismatch is fail-closed — an endpoint that is not the chain we
    /// pinned is not a chain we index, whatever its URL claims.
    ///
    /// **Opt-in. The caller must call this; the indexer cannot.** Nothing in
    /// this crate calls it (the only in-tree callers are its own unit tests),
    /// because nothing in this crate speaks to an endpoint — see
    /// [`IndexerConfig::chain_id`]. Whoever writes the RPC `LogSource` owns
    /// calling this against `eth_chainId` before the first block is fed, and
    /// refusing the endpoint if it returns `Err`.
    pub fn verify_observed_chain_id(&self, observed: u64) -> Result<(), IndexError> {
        if observed != self.chain_id {
            return Err(IndexError::ChainIdMismatch {
                pinned: self.chain_id,
                observed,
            });
        }
        Ok(())
    }
}

/// Why the indexer refused. Every variant blocks; none degrade to "proceed".
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IndexError {
    /// The endpoint is not the chain we pinned.
    ChainIdMismatch { pinned: u64, observed: u64 },
    /// The chain tracker could not resolve the observation.
    Reorg(ReorgError),
    /// A fork orphaned a block whose logs already crossed the bus. The bus has
    /// no retraction, so there is no sound way forward: emitting on the new
    /// branch would contradict what was already emitted. Blocked, loudly.
    ///
    /// **Latched.** This is the one refusal the indexer does not exit: once it
    /// fires, every later `observe_block` and `drain_confirmed` on that
    /// `Indexer` returns it again. A fail-closed refusal that a retry could
    /// flip to `Ok` would not be fail-closed — and the identical observation,
    /// replayed, is exactly what a retrying caller sends next.
    ReorgBelowEmitted { fork_point: u64, last_emitted: u64 },
    /// The first block observed after a resume was **above** the block the
    /// cursor names. The cursor's block-hash guard
    /// ([`IndexError::HistoryChangedUnderCursor`]) only fires at exactly
    /// `resume_block()`, and an empty tracker anchors its first block with no
    /// parent-hash check — so a feed that starts past the cursor's block skips
    /// both, and would index a branch on which its own already-emitted event
    /// need not exist. [`Indexer::resume_block`] documents where to restart;
    /// this is the check that stops the caller trusting it silently.
    ResumeAboveCursor { resume_block: u64, observed: u64 },
    /// A block already held in `pending` was re-delivered carrying a different
    /// set of logs. The chain tracker compares block identity only — hash and
    /// parent hash — so it reports such a re-delivery as
    /// [`Observation::Duplicate`] and never sees the logs at all. Accepting it
    /// would silently drop one of the two log sets; a divergent re-delivery is
    /// refused instead, because a source that contradicts itself about a
    /// block's contents is not a source this adapter can pick a winner from.
    DuplicateBlockLogsDiffer {
        block_number: u64,
        held: usize,
        observed: usize,
    },
    /// An **already-drained** block was re-delivered carrying a log that
    /// [`Indexer::drain_confirmed`] would have emitted: past the cursor, from
    /// an allowlisted contract, with a `topic0` the signature table knows.
    ///
    /// The block drained, so that log was not there at the time — every log
    /// meeting those three conditions either emits (advancing the cursor past
    /// its position) or halts the drain, and neither happened. So the source is
    /// contradicting itself about the block's contents, exactly as in
    /// [`IndexError::DuplicateBlockLogsDiffer`], and it is refused for the same
    /// reason. Returning `Ok` would drop an event that had every property
    /// required to reach the bus.
    ///
    /// **Scope.** This catches divergence *ahead of* the cursor only. A
    /// divergent log at a position at or behind the cursor is indistinguishable
    /// from one that already emitted — this adapter retains no logs for drained
    /// blocks, so there is nothing left to compare against. See README,
    /// "Operational consequences".
    DrainedBlockLogWouldHaveEmitted { block_number: u64, log_index: u64 },
    /// The block the cursor was written against no longer has the hash it had.
    /// The chain reorganized below the cursor while the process was down.
    HistoryChangedUnderCursor {
        block_number: u64,
        expected_hash: String,
        observed_hash: String,
    },
    /// A log arrived flagged `removed`. This adapter derives reorg truth from
    /// parent-hash linkage it checks itself, not from a transport-level claim
    /// it cannot verify — so rather than half-trust the flag, it refuses the
    /// batch and makes the caller feed canonical blocks.
    RemovedLogObserved { block_number: u64, log_index: u64 },
    /// A log does not belong to the block it was delivered with.
    LogBlockMismatch { expected: u64, got: u64 },
    /// Two logs in one block claim the same `log_index`. The idempotency key
    /// would not be a key.
    DuplicateLogIndex { block_number: u64, log_index: u64 },
    /// A recognized event whose payload does not fit its signature. Never
    /// decoded on a best-effort basis (the `normalizer` precedent: a
    /// recognized action with a malformed payload is an error, never a guess).
    Abi(AbiError),
    /// The signature table could not be built.
    Table(TableError),
    /// The config contradicts itself.
    ConfigInvalid(String),
}

impl std::fmt::Display for IndexError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IndexError::ChainIdMismatch { pinned, observed } => write!(
                f,
                "chain id mismatch: pinned {pinned}, endpoint reports {observed}"
            ),
            IndexError::Reorg(e) => write!(f, "{e}"),
            IndexError::ReorgBelowEmitted {
                fork_point,
                last_emitted,
            } => write!(
                f,
                "reorg forked at {fork_point}, below already-emitted block \
                 {last_emitted} — BLOCKED: emitting further would contradict \
                 events that already crossed"
            ),
            IndexError::ResumeAboveCursor {
                resume_block,
                observed,
            } => write!(
                f,
                "resumed feed started at block {observed}, above the cursor's \
                 block {resume_block} — BLOCKED: the cursor's block-hash guard \
                 can only fire at {resume_block}, so starting past it would \
                 skip the check that history did not change underneath"
            ),
            IndexError::DuplicateBlockLogsDiffer {
                block_number,
                held,
                observed,
            } => write!(
                f,
                "block {block_number} was re-delivered with a different log \
                 set ({held} held, {observed} observed) — BLOCKED: the source \
                 contradicts itself about what the block contains"
            ),
            IndexError::DrainedBlockLogWouldHaveEmitted {
                block_number,
                log_index,
            } => write!(
                f,
                "already-drained block {block_number} was re-delivered carrying \
                 log #{log_index}, which is past the cursor and matches the \
                 configured table — BLOCKED: had that log been present when the \
                 block drained, it would have emitted, so the source \
                 contradicts itself about what the block contains"
            ),
            IndexError::HistoryChangedUnderCursor {
                block_number,
                expected_hash,
                observed_hash,
            } => write!(
                f,
                "block {block_number} was {expected_hash} when the cursor was \
                 written, now {observed_hash} — BLOCKED"
            ),
            IndexError::RemovedLogObserved {
                block_number,
                log_index,
            } => write!(
                f,
                "log {block_number}#{log_index} arrived flagged `removed`; \
                 feed canonical blocks — this adapter does not act on \
                 unverifiable transport claims"
            ),
            IndexError::LogBlockMismatch { expected, got } => {
                write!(f, "log claims block {got}, delivered with block {expected}")
            }
            IndexError::DuplicateLogIndex {
                block_number,
                log_index,
            } => write!(f, "block {block_number} has two logs at index {log_index}"),
            IndexError::Abi(e) => write!(f, "{e}"),
            IndexError::Table(e) => write!(f, "{e}"),
            IndexError::ConfigInvalid(s) => write!(f, "invalid config: {s}"),
        }
    }
}

impl std::error::Error for IndexError {}

impl From<ReorgError> for IndexError {
    fn from(e: ReorgError) -> Self {
        IndexError::Reorg(e)
    }
}

impl From<AbiError> for IndexError {
    fn from(e: AbiError) -> Self {
        IndexError::Abi(e)
    }
}

impl From<TableError> for IndexError {
    fn from(e: TableError) -> Self {
        IndexError::Table(e)
    }
}

/// One block and the logs it carried, as a source yields it.
pub type SourcedBlock = (BlockRef, Vec<RawLog>);

/// What a [`LogSource`] returns: the next block, nothing available right now,
/// or a failure. The three are deliberately distinct — collapsing the last two
/// is precisely how a transport error becomes a false "backfill complete".
pub type NextBlock = Result<Option<SourcedBlock>, Box<dyn std::error::Error>>;

/// Where blocks come from — the seam between this state machine and reality.
///
/// Backfill and live subscription are the *same* state machine behind this
/// trait: one is a source that yields historical blocks and runs dry, the
/// other yields blocks as they are produced. Nothing downstream distinguishes
/// them, which is why a backfill that catches up and becomes a live feed needs
/// no handoff.
///
/// No RPC implementation ships in this crate: there is no verified exSat
/// endpoint to write one against, and the test suite is fixtures-only by
/// requirement. This is a named trait seam, per house law — not a `todo!()`.
pub trait LogSource {
    /// The next block and its logs.
    ///
    /// `Ok(None)` means *no block is available right now* — backfill drained,
    /// or no new head. It must never be used to paper over a failure: a
    /// transport error is `Err`, and a transport error must never collapse
    /// into a green light.
    fn next_block(&mut self) -> NextBlock;
}

/// Why a [`Indexer::drive`] call stopped early.
#[derive(Debug)]
pub enum DriveFailure {
    /// The source failed. Distinct from "no more blocks" by construction.
    Source(String),
    /// The indexer refused.
    Index(IndexError),
}

impl std::fmt::Display for DriveFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DriveFailure::Source(s) => write!(f, "log source failed: {s}"),
            DriveFailure::Index(e) => write!(f, "{e}"),
        }
    }
}

/// A failure while driving a source, **carrying the events already emitted**.
///
/// `emitted` is not a convenience. [`Indexer::drain_confirmed`] commits the
/// cursor advance as it emits, so by the time a later block fails, the events
/// from earlier blocks in the same `drive` call are already *past* the cursor:
/// a retry re-feeds those blocks, the tracker calls them duplicates, and
/// [`Cursor::is_ahead`] filters their logs. They are never produced again. So
/// an error path that dropped them would emit them **zero** times, which is
/// the "never skip" half of exactly-once broken — quietly, on the path a
/// caller is least likely to read.
///
/// A caller must therefore treat `emitted` exactly as it treats an `Ok`
/// value — publish it — and only then handle `cause`.
///
/// This type deliberately has **no** `From<IndexError>` impl. `?` on an
/// `IndexError` inside `drive` would construct a `DriveError` with no access
/// to the local event buffer, silently dropping it; removing the conversion
/// makes that mistake a compile error rather than a lost event.
#[derive(Debug)]
pub struct DriveError {
    /// Events that crossed the cursor before the failure. Already committed —
    /// a retry will not produce them again. Dropping these loses them.
    pub emitted: Vec<CanonicalEvent>,
    /// What stopped the drive.
    pub cause: DriveFailure,
}

impl DriveError {
    fn new(emitted: Vec<CanonicalEvent>, cause: DriveFailure) -> Self {
        Self { emitted, cause }
    }

    /// Take the already-emitted events, leaving the error otherwise intact.
    pub fn into_emitted(self) -> Vec<CanonicalEvent> {
        self.emitted
    }
}

impl std::fmt::Display for DriveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.cause)?;
        if !self.emitted.is_empty() {
            write!(
                f,
                " ({} event(s) had already been emitted and committed in this \
                 call; they are carried in DriveError::emitted and will not be \
                 produced again)",
                self.emitted.len()
            )?;
        }
        Ok(())
    }
}

impl std::error::Error for DriveError {}

/// The indexer: tracks the chain, holds unconfirmed logs, emits confirmed ones.
#[derive(Debug)]
pub struct Indexer {
    config: IndexerConfig,
    table: SignatureTable,
    tracker: ChainTracker,
    /// Observed blocks not yet emitted, keyed by block number. Carries its own
    /// `BlockRef` so draining does not depend on the tracker's retain window.
    pending: BTreeMap<u64, SourcedBlock>,
    cursor: Cursor,
    /// Set once the indexer reaches a state with no sound continuation, and
    /// never cleared. Re-returned by every later `observe_block` and
    /// `drain_confirmed`.
    ///
    /// Only [`IndexError::ReorgBelowEmitted`] latches. The other refusals are
    /// pure functions of their input and the current state, so they re-fire on
    /// their own when the same input arrives again; this one is not — the
    /// competing branch is a fact about the chain, and the observation that
    /// revealed it is refused rather than adopted, so nothing in the tracker
    /// would remember it. Without the latch, the identical replay would find
    /// nothing to trip over and return `Ok`.
    halted: Option<IndexError>,
}

impl Indexer {
    /// Build a fresh indexer.
    pub fn new(config: IndexerConfig, entries: &[SignatureEntry]) -> Result<Self, IndexError> {
        Self::resume(config, entries, Cursor::new())
    }

    /// Rebuild an indexer at a persisted cursor — the crash-recovery path.
    pub fn resume(
        config: IndexerConfig,
        entries: &[SignatureEntry],
        cursor: Cursor,
    ) -> Result<Self, IndexError> {
        if config.retain_blocks <= config.confirmation_depth {
            return Err(IndexError::ConfigInvalid(format!(
                "retain_blocks ({}) must exceed confirmation_depth ({}): a fork \
                 could otherwise orphan an emitted block from outside the \
                 window the tracker can reason about",
                config.retain_blocks, config.confirmation_depth
            )));
        }
        let table = SignatureTable::new(entries, config.allow_unverified_signatures)?;
        let tracker = ChainTracker::new(config.retain_blocks);
        Ok(Self {
            config,
            table,
            tracker,
            pending: BTreeMap::new(),
            cursor,
            halted: None,
        })
    }

    pub fn cursor(&self) -> &Cursor {
        &self.cursor
    }

    /// The refusal this indexer latched, if it has halted.
    ///
    /// A halted indexer is not recoverable by retrying: the state it refuses
    /// to continue from is a fact about the chain, not a transient failure.
    /// Introspection aid — the halt is already returned by every call.
    pub fn halted(&self) -> Option<&IndexError> {
        self.halted.as_ref()
    }

    /// Block numbers currently held unconfirmed, ascending.
    ///
    /// Introspection aid (the `adapter-arweave::anchored_count` precedent).
    /// It exists so the reorg-rollback invariant — that no orphaned block
    /// survives in `pending` — is directly assertable rather than inferred
    /// from downstream behaviour.
    pub fn pending_blocks(&self) -> Vec<u64> {
        self.pending.keys().copied().collect()
    }

    /// The block a resuming feed must restart from.
    ///
    /// Deliberately the last emitted block itself, **not** the one after it: a
    /// crash mid-block leaves logs above the cursor's `log_index` in that same
    /// block unemitted. Restarting at `block + 1` would silently drop them.
    /// Re-feeding the block is safe — the cursor filters what already went out.
    pub fn resume_block(&self) -> Option<u64> {
        self.cursor.last_emitted.as_ref().map(|p| p.block_number)
    }

    /// Observe one block and its logs.
    ///
    /// On error the observation is never half-applied: the chain tracker is
    /// asked to [`ChainTracker::classify`] the block first and only mutated
    /// once every refusal has had its say — a tracker that adopted a block this
    /// method then refused would answer the identical replay with `Duplicate`,
    /// i.e. with `Ok`.
    ///
    /// One refusal does leave state behind, deliberately:
    /// [`IndexError::ReorgBelowEmitted`] latches into `self.halted` before it
    /// returns `Err`. That is the point of it — the refused observation is not
    /// adopted, so nothing else would remember the competing branch and the
    /// identical replay would find nothing to trip over. Once it has fired,
    /// this returns it forever; see [`Indexer::halted`].
    pub fn observe_block(&mut self, block: BlockRef, logs: Vec<RawLog>) -> Result<(), IndexError> {
        if let Some(halt) = &self.halted {
            return Err(halt.clone());
        }

        // --- Validate the batch before mutating anything ---------------------
        let mut seen_indices = std::collections::HashSet::new();
        for log in &logs {
            if log.removed {
                return Err(IndexError::RemovedLogObserved {
                    block_number: log.block_number,
                    log_index: log.log_index,
                });
            }
            if log.block_number != block.number {
                return Err(IndexError::LogBlockMismatch {
                    expected: block.number,
                    got: log.block_number,
                });
            }
            if log.block_hash != block.hash {
                return Err(IndexError::LogBlockMismatch {
                    expected: block.number,
                    got: log.block_number,
                });
            }
            if !seen_indices.insert(log.log_index) {
                return Err(IndexError::DuplicateLogIndex {
                    block_number: block.number,
                    log_index: log.log_index,
                });
            }
        }

        // --- Did history change under our cursor? ---------------------------
        if let Some(p) = &self.cursor.last_emitted {
            if block.number == p.block_number && hex0x(&block.hash) != p.block_hash {
                return Err(IndexError::HistoryChangedUnderCursor {
                    block_number: block.number,
                    expected_hash: p.block_hash.clone(),
                    observed_hash: hex0x(&block.hash),
                });
            }

            // --- Is a resuming feed starting where it was told to? -----------
            //
            // The check above can only fire at exactly `p.block_number`, and
            // an empty tracker anchors its first block with no parent-hash
            // check to fail. A feed that resumes *above* the cursor's block
            // therefore passes both without either looking at anything — and
            // links cleanly onwards from a branch that may not carry the event
            // this indexer already emitted. `resume_block()` documents the
            // restart point; a documented obligation the code does not check
            // is one the caller can miss by an off-by-one, so it is checked.
            //
            // Restarting at or *below* the cursor's block stays allowed: a
            // full backfill replay is the ordinary crash-recovery path, the
            // cursor filters what already went out, and the feed still passes
            // through `p.block_number` where the hash guard does fire.
            if self.tracker.is_empty() && block.number > p.block_number {
                return Err(IndexError::ResumeAboveCursor {
                    resume_block: p.block_number,
                    observed: block.number,
                });
            }
        }

        // --- Linkage ---------------------------------------------------------
        //
        // Classified, not applied: every refusal below must be able to return
        // without the tracker having adopted `block`.
        match self.tracker.classify(&block)? {
            Observation::Duplicate => {
                // The tracker compares hash and parent_hash; it never sees the
                // logs. "Identical re-delivery" is therefore a claim about the
                // BlockRef alone, and a re-delivery that agrees on the block
                // while disagreeing on its contents would slip through here —
                // one log set silently discarded, `Ok` returned, its events
                // never reaching the bus. Compare what the tracker cannot.
                if let Some((_, held)) = self.pending.get(&block.number) {
                    if !logs_agree(held, &logs) {
                        return Err(IndexError::DuplicateBlockLogsDiffer {
                            block_number: block.number,
                            held: held.len(),
                            observed: logs.len(),
                        });
                    }
                    return Ok(());
                }
                // Nothing held for that height: the block already drained, and
                // no logs are retained for drained blocks, so there is no held
                // set to compare against. Compare instead against what the
                // drain would have done — a log ahead of the cursor, from a
                // listed contract, carrying a known topic0 would have emitted.
                // The block drained without emitting it, so its arrival now is
                // a contradiction.
                //
                // This catches divergence ahead of the cursor only. What it
                // does not catch, and why, is stated in the residue note below.
                for log in &logs {
                    if self.would_have_emitted(block.number, log) {
                        return Err(IndexError::DrainedBlockLogWouldHaveEmitted {
                            block_number: block.number,
                            log_index: log.log_index,
                        });
                    }
                }
                // Residue, stated rather than papered over: a divergent log at
                // a position at or behind the cursor is *not* caught here. It
                // is indistinguishable from one that already emitted — this
                // adapter retains no logs for drained blocks — and it is a real
                // loss, not a harmless one, because a cursor advanced by a
                // later block sits ahead of an earlier block's never-emitted
                // positions. Closing it needs per-drained-block retention
                // across the whole retain window; see README, "Operational
                // consequences".
                return Ok(());
            }
            Observation::Extended => {}
            Observation::Reorg { fork_point } => {
                if let Some(p) = &self.cursor.last_emitted {
                    if fork_point < p.block_number {
                        let halt = IndexError::ReorgBelowEmitted {
                            fork_point,
                            last_emitted: p.block_number,
                        };
                        self.halted = Some(halt.clone());
                        return Err(halt);
                    }
                }
                // Every orphaned block sits strictly above `fork_point`, and
                // the check just above establishes `fork_point >= last
                // emitted` — so every block dropped here is above the last
                // emitted block and its logs never crossed. Dropping them
                // emits no contradiction. (The confirmation depth is not what
                // carries this: at depth 0 logs emit at the tip, and it is the
                // refusal above that holds the line.)
                self.pending.retain(|number, _| *number <= fork_point);
            }
        }

        // Nothing can fail from here: apply.
        self.tracker.observe(block)?;
        self.pending.insert(block.number, (block, logs));
        Ok(())
    }

    /// Whether [`Indexer::drain_confirmed`] would have emitted this log.
    ///
    /// Mirrors the drain's own filter — past the cursor, allowlisted address,
    /// `topic0` the table knows — minus the decode. The decode is deliberately
    /// left out: a matching log that fails to decode halts the drain, so a log
    /// passing these three conditions never reaches a silent drop either way,
    /// and re-running the decoder here would import that halt into
    /// `observe_block`.
    ///
    /// The cursor only ever moves forward, so checking against the committed
    /// cursor rather than the local copy the drain advanced is the conservative
    /// direction: a position ahead of the cursor now was ahead of it then.
    fn would_have_emitted(&self, block_number: u64, log: &RawLog) -> bool {
        self.cursor.is_ahead(block_number, log.log_index)
            && self.config.contracts.contains(&log.address)
            && log
                .topics
                .first()
                .is_some_and(|topic0| self.table.lookup(topic0).is_some())
    }

    /// The highest block whose logs may be emitted, or `None` if the chain is
    /// not yet deep enough for anything to be confirmed.
    pub fn confirmed_through(&self) -> Option<u64> {
        let tip = self.tracker.tip()?;
        tip.number.checked_sub(self.config.confirmation_depth)
    }

    /// Emit every confirmed, not-yet-emitted, matching log.
    ///
    /// **Atomic.** Events and the cursor advance are computed against a local
    /// copy and committed only on full success. A decode failure therefore
    /// emits nothing and moves nothing — the alternative, emitting the good
    /// prefix and stopping, would advance the cursor past a log the caller
    /// never received.
    ///
    /// A decode failure is a **halt**, not a skip: it means the signature
    /// table disagrees with the chain, which is a table bug to fix, not a log
    /// to shrug at. Because the drain is atomic and the offending log stays in
    /// `pending`, every later call re-attempts it and fails the same way: one
    /// undecodable log wedges this indexer until the table is fixed and the
    /// process restarted. That is the intended trade — see README,
    /// "Operational consequences" — and it is a halt, with a halt's cost.
    pub fn drain_confirmed(&mut self) -> Result<Vec<CanonicalEvent>, IndexError> {
        if let Some(halt) = &self.halted {
            return Err(halt.clone());
        }
        let Some(confirmed_through) = self.confirmed_through() else {
            return Ok(Vec::new());
        };

        let mut out = Vec::new();
        let mut next_cursor = self.cursor.clone();

        let drained: Vec<u64> = self
            .pending
            .range(..=confirmed_through)
            .map(|(number, _)| *number)
            .collect();

        for number in &drained {
            let (block, logs) = &self.pending[number];

            let mut ordered: Vec<&RawLog> = logs.iter().collect();
            ordered.sort_by_key(|l| l.log_index);

            for log in ordered {
                if !next_cursor.is_ahead(block.number, log.log_index) {
                    continue; // already emitted before the crash
                }
                // Default-deny on address.
                if !self.config.contracts.contains(&log.address) {
                    continue;
                }
                let Some(topic0) = log.topics.first() else {
                    continue; // anonymous event — not ours
                };
                let Some(entry) = self.table.lookup(topic0) else {
                    continue; // not a BNRi event: noise, ignored by design
                };

                let decoded = decode_log(&log.topics, &log.data, entry.signature)?;

                out.push(to_event(log, block, entry, &decoded));
                next_cursor.advance_to(block.number, log.log_index, hex0x(&block.hash));
            }
        }

        // Commit only now that nothing can fail.
        self.cursor = next_cursor;
        for number in drained {
            self.pending.remove(&number);
        }
        Ok(out)
    }

    /// Pump a source until it runs dry, draining confirmed events.
    ///
    /// Backfill and live catch-up are the same call. A source error
    /// propagates; it never reads as "done".
    ///
    /// **On error, the events already emitted come back in
    /// [`DriveError::emitted`] and the caller must publish them.** `drive`
    /// emits incrementally — each block observed can confirm an earlier one,
    /// and `drain_confirmed` commits the cursor as it goes — so a failure on
    /// block N does not un-emit blocks 1..N-1. Those events are past the
    /// cursor and no retry will produce them again.
    pub fn drive<S: LogSource + ?Sized>(
        &mut self,
        source: &mut S,
    ) -> Result<Vec<CanonicalEvent>, DriveError> {
        let mut out = Vec::new();
        loop {
            match source.next_block() {
                Err(e) => return Err(DriveError::new(out, DriveFailure::Source(e.to_string()))),
                Ok(None) => break,
                Ok(Some((block, logs))) => {
                    if let Err(e) = self.observe_block(block, logs) {
                        return Err(DriveError::new(out, DriveFailure::Index(e)));
                    }
                    match self.drain_confirmed() {
                        Ok(events) => out.extend(events),
                        Err(e) => return Err(DriveError::new(out, DriveFailure::Index(e))),
                    }
                }
            }
        }
        match self.drain_confirmed() {
            Ok(events) => out.extend(events),
            Err(e) => return Err(DriveError::new(out, DriveFailure::Index(e))),
        }
        Ok(out)
    }
}

/// Whether two deliveries of one block's logs say the same thing.
///
/// Compared as sets keyed by `log_index` — which `observe_block` has already
/// established is unique within each delivery — so a source that yields a
/// block's logs in a different order is not accused of contradicting itself.
/// Everything else about each log must match exactly.
fn logs_agree(held: &[RawLog], observed: &[RawLog]) -> bool {
    if held.len() != observed.len() {
        return false;
    }
    let mut held: Vec<&RawLog> = held.iter().collect();
    let mut observed: Vec<&RawLog> = observed.iter().collect();
    held.sort_by_key(|l| l.log_index);
    observed.sort_by_key(|l| l.log_index);
    held == observed
}

/// Build the canonical event for one decoded log.
fn to_event(
    log: &RawLog,
    block: &BlockRef,
    entry: &SignatureEntry,
    decoded: &crate::abi::DecodedLog,
) -> CanonicalEvent {
    let tx = hex0x(&log.tx_hash);
    CanonicalEvent {
        // The idempotency triple, encoded: (block_number, tx_hash, log_index).
        event_id: format!("exsatevm-{}-{}-{}", log.block_number, tx, log.log_index),
        event_type: entry.event_type,
        // The block's timestamp, not the observer's clock: the same log
        // indexed twice must produce the same event.
        timestamp: block.timestamp,
        source_chain: SourceChain::ExSatEvm,
        source_ref: format!("{}:{}#{}", log.block_number, tx, log.log_index),
        payload: EventPayload::Bnri(BnriEvent {
            contract: hex0x(&log.address),
            signature: entry.signature.to_string(),
            topic0: hex0x(&log.topics[0]),
            indexed_words: decoded.indexed_words.iter().map(|w| hex0x(w)).collect(),
            data_words: decoded.data_words.iter().map(|w| hex0x(w)).collect(),
        }),
        canonicalized_by: CANONICALIZED_BY.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signatures::BNRI_GENESIS_V0_UNVERIFIED;

    #[test]
    fn mainnet_chain_id_is_7200() {
        assert_eq!(EXSAT_MAINNET_CHAIN_ID, 7200);
    }

    #[test]
    fn chain_id_mismatch_is_fail_closed() {
        let cfg = IndexerConfig::new(EXSAT_MAINNET_CHAIN_ID, 8, vec![]);
        assert!(cfg.verify_observed_chain_id(7200).is_ok());
        // A testnet endpoint behind a mainnet-looking URL must not pass.
        assert_eq!(
            cfg.verify_observed_chain_id(840_000).unwrap_err(),
            IndexError::ChainIdMismatch {
                pinned: 7200,
                observed: 840_000
            }
        );
    }

    #[test]
    fn production_config_refuses_the_unverified_placeholder_table() {
        // The whole point: with no real ABI, the adapter loads nothing.
        let cfg = IndexerConfig::new(EXSAT_MAINNET_CHAIN_ID, 8, vec![[0u8; 20]]);
        assert!(!cfg.allow_unverified_signatures);
        let err = Indexer::new(cfg, BNRI_GENESIS_V0_UNVERIFIED).unwrap_err();
        assert!(matches!(
            err,
            IndexError::Table(TableError::UnverifiedNotAllowed { .. })
        ));
    }

    #[test]
    fn retain_blocks_must_exceed_confirmation_depth() {
        let mut cfg = IndexerConfig::new(EXSAT_MAINNET_CHAIN_ID, 10, vec![]);
        cfg.allow_unverified_signatures = true;
        cfg.retain_blocks = 10;
        assert!(matches!(
            Indexer::new(cfg, BNRI_GENESIS_V0_UNVERIFIED),
            Err(IndexError::ConfigInvalid(_))
        ));
    }

    #[test]
    fn default_retain_blocks_exceeds_confirmation_depth() {
        // The derived default must not itself be invalid.
        for depth in [0u64, 1, 8, 32, 64, 100] {
            let cfg = IndexerConfig::new(EXSAT_MAINNET_CHAIN_ID, depth, vec![]);
            assert!(
                cfg.retain_blocks > cfg.confirmation_depth,
                "depth {depth} derived retain {}",
                cfg.retain_blocks
            );
        }
    }
}
