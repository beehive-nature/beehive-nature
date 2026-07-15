//! End-to-end indexing against **fixtures only** — never a live RPC.
//!
//! The marquee cases here are the two the design exists for:
//! - [`reorg_of_depth_n_emits_no_contradictory_event`]
//! - [`crash_mid_block_resumes_without_skipping_or_duplicating`]

use std::collections::VecDeque;

use chain_exsat_evm::{
    hex0x, topic0_of, BlockRef, Cursor, DriveFailure, IndexError, Indexer, IndexerConfig,
    LogSource, RawLog, Word, BNRI_GENESIS_V0_UNVERIFIED, EXSAT_MAINNET_CHAIN_ID,
};
use shared_types::{CanonicalEvent, EventPayload, EventType, SourceChain};

// ---------------------------------------------------------------------------
// fixture helpers
// ---------------------------------------------------------------------------

const CONTRACT: [u8; 20] = [0xB1; 20];
const OTHER_CONTRACT: [u8; 20] = [0xFF; 20];

/// Placeholder signatures from the UNVERIFIED genesis table. These are not
/// real BNRi signatures and this suite does not pretend they are — it tests
/// the machinery that will carry the real ones.
const SIG_MINT: &str = "PLACEHOLDER_InscriptionMinted(address,uint256,bytes32)";
const SIG_LOCK: &str = "PLACEHOLDER_InscriptionLocked(address,uint256)";

fn h(n: u8) -> [u8; 32] {
    [n; 32]
}

fn word(n: u8) -> Word {
    let mut w = [0u8; 32];
    w[31] = n;
    w
}

fn blk(number: u64, hash: u8, parent: u8) -> BlockRef {
    BlockRef {
        number,
        hash: h(hash),
        parent_hash: h(parent),
        timestamp: 1_782_000_000 + number as i64,
    }
}

/// A linear canonical chain where block `n` has hash `n` and parent `n-1`.
fn linear(number: u64) -> BlockRef {
    blk(number, number as u8, (number - 1) as u8)
}

fn log_on(
    block: &BlockRef,
    tx: u8,
    log_index: u64,
    signature: &str,
    indexed: &[Word],
    data: &[Word],
) -> RawLog {
    let mut topics = vec![topic0_of(signature)];
    topics.extend_from_slice(indexed);
    let mut bytes = Vec::new();
    for w in data {
        bytes.extend_from_slice(w);
    }
    RawLog {
        block_number: block.number,
        block_hash: block.hash,
        tx_hash: [tx; 32],
        log_index,
        address: CONTRACT,
        topics,
        data: bytes,
        removed: false,
    }
}

/// `PLACEHOLDER_InscriptionMinted(address,uint256,bytes32)`: 1 indexed + 2 data.
fn mint_log(block: &BlockRef, tx: u8, log_index: u64, id: u8, seed: u8) -> RawLog {
    log_on(
        block,
        tx,
        log_index,
        SIG_MINT,
        &[word(0x01)],
        &[word(id), word(seed)],
    )
}

/// `PLACEHOLDER_InscriptionLocked(address,uint256)`: 1 indexed + 1 data.
fn lock_log(block: &BlockRef, tx: u8, log_index: u64, id: u8) -> RawLog {
    log_on(block, tx, log_index, SIG_LOCK, &[word(0x01)], &[word(id)])
}

/// Fixtures exercise the placeholder table, so they must opt in explicitly —
/// exactly the gate that keeps production from doing the same.
fn test_config(confirmation_depth: u64) -> IndexerConfig {
    let mut c = IndexerConfig::new(
        EXSAT_MAINNET_CHAIN_ID,
        confirmation_depth,
        vec![CONTRACT],
    );
    c.allow_unverified_signatures = true;
    c
}

fn indexer(confirmation_depth: u64) -> Indexer {
    Indexer::new(test_config(confirmation_depth), BNRI_GENESIS_V0_UNVERIFIED).unwrap()
}

fn data_words(event: &CanonicalEvent) -> Vec<String> {
    let EventPayload::Bnri(b) = &event.payload else {
        panic!("expected a Bnri payload, got {:?}", event.payload);
    };
    b.data_words.clone()
}

struct FixtureSource {
    blocks: VecDeque<(BlockRef, Vec<RawLog>)>,
    fail_after: Option<usize>,
    served: usize,
}

impl FixtureSource {
    fn new(blocks: Vec<(BlockRef, Vec<RawLog>)>) -> Self {
        Self {
            blocks: blocks.into(),
            fail_after: None,
            served: 0,
        }
    }

    fn failing_after(blocks: Vec<(BlockRef, Vec<RawLog>)>, n: usize) -> Self {
        Self {
            blocks: blocks.into(),
            fail_after: Some(n),
            served: 0,
        }
    }
}

impl LogSource for FixtureSource {
    fn next_block(&mut self) -> Result<Option<(BlockRef, Vec<RawLog>)>, Box<dyn std::error::Error>> {
        if self.fail_after == Some(self.served) {
            return Err("simulated transport failure".into());
        }
        self.served += 1;
        Ok(self.blocks.pop_front())
    }
}

/// Blocks `from..=to`, empty except where `logs_at` supplies them.
fn chain_with(
    from: u64,
    to: u64,
    logs_at: &dyn Fn(&BlockRef) -> Vec<RawLog>,
) -> Vec<(BlockRef, Vec<RawLog>)> {
    (from..=to)
        .map(|n| {
            let b = linear(n);
            let logs = logs_at(&b);
            (b, logs)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// backfill / happy path
// ---------------------------------------------------------------------------

#[test]
fn backfill_emits_confirmed_events_with_the_documented_identity_shape() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    });
    let events = ix.drive(&mut FixtureSource::new(blocks)).unwrap();

    assert_eq!(events.len(), 1);
    let e = &events[0];
    let tx = hex0x(&[0xA1u8; 32]);
    assert_eq!(e.event_id, format!("exsatevm-105-{tx}-0"));
    assert_eq!(e.source_ref, format!("105:{tx}#0"));
    assert_eq!(e.source_chain, SourceChain::ExSatEvm);
    assert_eq!(e.canonicalized_by, "chain-exsat-evm");
    assert_eq!(e.event_type, EventType::BnriInscriptionMinted);
    // The block's timestamp, not the observer's clock.
    assert_eq!(e.timestamp, 1_782_000_000 + 105);
}

#[test]
fn emitted_event_roundtrips_through_the_canonical_schema() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 104 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    });
    let events = ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    let json = serde_json::to_string(&events[0]).unwrap();
    let back: CanonicalEvent = serde_json::from_str(&json).unwrap();
    assert_eq!(events[0], back);
    assert!(json.contains(r#""source_chain":"ExSatEvm""#));
    assert!(json.contains(r#""canonicalized_by":"chain-exsat-evm""#));
}

#[test]
fn nothing_within_the_confirmation_depth_is_emitted() {
    let mut ix = indexer(3);
    // tip 110, depth 3 -> confirmed through 107. A log at 108 must wait.
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 108 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    });
    let events = ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    assert!(events.is_empty(), "a log 2 blocks deep must not be emitted");
    assert_eq!(ix.confirmed_through(), Some(107));
}

#[test]
fn noise_is_ignored_by_design() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number != 105 {
            return vec![];
        }
        // An unknown topic0, and a BNRi-shaped log from an unlisted address.
        let mut unknown = mint_log(b, 0xA1, 0, 7, 0xAA);
        unknown.topics[0] = topic0_of("Transfer(address,address,uint256)");
        let mut wrong_address = mint_log(b, 0xA2, 1, 7, 0xAA);
        wrong_address.address = OTHER_CONTRACT;
        vec![unknown, wrong_address]
    });
    let events = ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    assert!(events.is_empty());
}

// ---------------------------------------------------------------------------
// the reason normalize() is bypassed
// ---------------------------------------------------------------------------

#[test]
fn many_logs_of_one_event_type_in_one_tx_get_distinct_event_ids() {
    // This is the case that would collapse onto a single event_id if these
    // logs were routed through `normalizer::normalize()`, whose id is
    // {chain}-{tx_id}-{action_name} and which has no log_index at all.
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            // One transaction, three mints, same event type.
            vec![
                mint_log(b, 0xA1, 0, 1, 0xAA),
                mint_log(b, 0xA1, 1, 2, 0xAA),
                mint_log(b, 0xA1, 2, 3, 0xAA),
            ]
        } else {
            vec![]
        }
    });
    let events = ix.drive(&mut FixtureSource::new(blocks)).unwrap();

    assert_eq!(events.len(), 3);
    let ids: std::collections::HashSet<&str> =
        events.iter().map(|e| e.event_id.as_str()).collect();
    assert_eq!(ids.len(), 3, "log_index must disambiguate: {ids:?}");
    let refs: std::collections::HashSet<&str> =
        events.iter().map(|e| e.source_ref.as_str()).collect();
    assert_eq!(refs.len(), 3, "source_ref must disambiguate too: {refs:?}");
    // All three share a tx and a type, and differ only by the # fragment.
    for (i, e) in events.iter().enumerate() {
        assert!(e.source_ref.ends_with(&format!("#{i}")));
        assert_eq!(e.event_type, EventType::BnriInscriptionMinted);
    }
}

// ---------------------------------------------------------------------------
// MARQUEE: reorg of depth N emits no contradictory event
// ---------------------------------------------------------------------------

#[test]
fn reorg_of_depth_n_emits_no_contradictory_event() {
    const DEPTH: u64 = 3;
    const N: u64 = 3; // fixture reorg depth: blocks 108,109,110 are replaced

    let mut ix = indexer(DEPTH);
    let mut all: Vec<CanonicalEvent> = Vec::new();

    // --- Branch A: ...105 carries a lock (will confirm), 108 a mint --------
    let branch_a = chain_with(100, 110, &|b| match b.number {
        105 => vec![lock_log(b, 0x51, 0, 5)],
        // The contested log: seed 0xAA, on the branch that loses.
        108 => vec![mint_log(b, 0xA1, 0, 7, 0xAA)],
        _ => vec![],
    });
    all.extend(ix.drive(&mut FixtureSource::new(branch_a)).unwrap());

    // Block 105 confirmed (tip 110 - depth 3 = 107). Block 108 did not.
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].event_type, EventType::BnriInscriptionLocked);
    assert_eq!(ix.cursor().last_emitted.as_ref().unwrap().block_number, 105);

    // --- Branch B replaces 108..110 (N = 3 blocks deep) --------------------
    // 108' builds on 107, carrying a *contradicting* mint: same slot, seed 0xBB.
    let b108 = blk(108, 208, 107);
    let b109 = blk(109, 209, 208);
    let b110 = blk(110, 210, 209);
    let b111 = blk(111, 211, 210);

    let branch_b = vec![
        (b108, vec![mint_log(&b108, 0xB1, 0, 7, 0xBB)]),
        (b109, vec![]),
        (b110, vec![]),
        (b111, vec![]),
    ];
    all.extend(ix.drive(&mut FixtureSource::new(branch_b)).unwrap());

    // The reorg was N blocks deep and the fork point sat above the cursor,
    // so it resolved without blocking.
    assert_eq!(N, 3);

    // --- The invariant: nothing contradictory ever crossed -----------------
    // Branch A's mint must never have been emitted — not before the reorg
    // (too shallow) and obviously not after (it is not on the chain).
    let branch_a_tx = hex0x(&[0xA1u8; 32]);
    assert!(
        all.iter().all(|e| !e.source_ref.contains(&branch_a_tx)),
        "an orphaned branch's log must never have crossed the bus"
    );
    assert!(
        all.iter()
            .all(|e| !data_words(e).iter().any(|w| w.ends_with("aa"))),
        "the orphaned seed 0xAA must appear in no emitted event"
    );

    // Branch B's mint at 108 is now confirmed (tip 111 - 3 = 108) and emitted.
    let mints: Vec<&CanonicalEvent> = all
        .iter()
        .filter(|e| e.event_type == EventType::BnriInscriptionMinted)
        .collect();
    assert_eq!(mints.len(), 1, "exactly one mint at block 108, not two");
    assert!(data_words(mints[0]).iter().any(|w| w.ends_with("bb")));
    assert_eq!(mints[0].source_ref, format!("108:{}#0", hex0x(&[0xB1u8; 32])));

    // And no event_id was ever emitted twice.
    let ids: Vec<&str> = all.iter().map(|e| e.event_id.as_str()).collect();
    let unique: std::collections::HashSet<&&str> = ids.iter().collect();
    assert_eq!(ids.len(), unique.len(), "duplicate event_id emitted");
}

#[test]
fn reorg_drops_orphaned_logs_from_pending_rather_than_holding_them() {
    // The orphaned-data invariant, asserted directly.
    //
    // Downstream behaviour alone does not pin this: the losing branch's
    // blocks are normally overwritten as the winning branch re-supplies the
    // same heights, so a rollback that kept orphaned entries would still
    // usually emit the right events. "Usually" is not the standard here —
    // an orphaned log sitting in `pending` is an event waiting to cross the
    // bus from a branch that does not exist.
    let mut ix = indexer(3);

    let branch_a = chain_with(100, 110, &|b| match b.number {
        108 => vec![mint_log(b, 0xA1, 0, 7, 0xAA)],
        109 => vec![mint_log(b, 0xA2, 0, 8, 0xAA)],
        110 => vec![mint_log(b, 0xA3, 0, 9, 0xAA)],
        _ => vec![],
    });
    ix.drive(&mut FixtureSource::new(branch_a)).unwrap();
    assert!(ix.pending_blocks().contains(&110));

    // 108' forks at 107, orphaning A's 108, 109 and 110 — logs and all.
    let b108 = blk(108, 208, 107);
    ix.observe_block(b108, vec![]).unwrap();

    let held = ix.pending_blocks();
    assert!(
        held.iter().all(|n| *n <= 108),
        "orphaned blocks survived the rollback: {held:?}"
    );
    assert!(
        !held.contains(&109) && !held.contains(&110),
        "orphaned blocks 109/110 still hold logs from a dead branch: {held:?}"
    );
}

#[test]
fn reorg_below_an_emitted_block_blocks_rather_than_contradicting() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![lock_log(b, 0x51, 0, 5)]
        } else {
            vec![]
        }
    });
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    assert_eq!(ix.cursor().last_emitted.as_ref().unwrap().block_number, 105);

    // A fork replacing block 104 orphans block 105 — whose log already crossed.
    // There is no sound continuation, so the indexer must halt.
    let err = ix.observe_block(blk(104, 204, 103), vec![]).unwrap_err();
    assert_eq!(
        err,
        IndexError::ReorgBelowEmitted {
            fork_point: 103,
            last_emitted: 105,
        }
    );
    assert!(err.to_string().contains("BLOCKED"));
}

#[test]
fn a_refused_reorg_below_an_emitted_block_stays_refused_when_replayed() {
    // A fail-closed refusal that a retry flips to Ok is not fail-closed. The
    // refusal must therefore latch, and — the root of it — the tracker must
    // not have adopted the block the refusal rejects: an orphaning block the
    // tracker swallowed is one it will call a `Duplicate` next time round,
    // turning the identical observation from BLOCK into GREEN.
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![lock_log(b, 0x51, 0, 5)]
        } else {
            vec![]
        }
    });
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    assert_eq!(ix.cursor().last_emitted.as_ref().unwrap().block_number, 105);

    let confirmed_before = ix.confirmed_through();
    let pending_before = ix.pending_blocks();
    assert_eq!(confirmed_before, Some(107));

    // A fork replacing 104 orphans 105, whose log already crossed the bus.
    let orphaning = blk(104, 204, 103);
    let expected = IndexError::ReorgBelowEmitted {
        fork_point: 103,
        last_emitted: 105,
    };
    assert_eq!(ix.observe_block(orphaning, vec![]).unwrap_err(), expected);

    // A refused observation must not have moved the tracker. If it had, the
    // tip would now be 104' and `confirmed_through` would have *regressed*
    // (107 -> 101) on a refusal, while the losing branch's blocks sat on in
    // `pending` with their logs — the rollback never having run.
    assert_eq!(
        ix.confirmed_through(),
        confirmed_before,
        "a refused observation mutated the tracker"
    );
    assert_eq!(
        ix.pending_blocks(),
        pending_before,
        "a refused observation mutated pending"
    );

    // THE POINT: the identical observation, replayed — which is exactly what a
    // retrying caller sends next. Same input, same answer, every time.
    assert_eq!(ix.observe_block(orphaning, vec![]).unwrap_err(), expected);
    assert_eq!(ix.observe_block(orphaning, vec![]).unwrap_err(), expected);

    // And it is a halt, not a mood: no ordinary block walks the indexer out of
    // it, and nothing drains afterwards.
    assert_eq!(ix.observe_block(linear(111), vec![]).unwrap_err(), expected);
    assert_eq!(ix.drain_confirmed().unwrap_err(), expected);
    assert_eq!(ix.halted(), Some(&expected));
}

#[test]
fn a_held_block_re_delivered_with_different_logs_is_refused() {
    // `IndexerConfig::contracts` is a list of addresses and the standard shape
    // is one `eth_getLogs` filter per address, so a source can hand the same
    // block over twice with a different contract's logs each time. The tracker
    // compares hash and parent_hash only — it never sees the logs — so it
    // calls the second delivery a `Duplicate`. A `Duplicate` that returned Ok
    // would drop that second log set on the floor and report green.
    let mut ix = indexer(3);
    let b = linear(100);

    // Delivery 1: contract A's logs — here, none.
    ix.observe_block(b, vec![]).unwrap();

    // Delivery 2: the same block, carrying a log the first delivery lacked.
    let err = ix
        .observe_block(b, vec![mint_log(&b, 0xA1, 0, 7, 0xAA)])
        .unwrap_err();
    assert_eq!(
        err,
        IndexError::DuplicateBlockLogsDiffer {
            block_number: 100,
            held: 0,
            observed: 1,
        }
    );
    assert!(err.to_string().contains("BLOCKED"));
}

#[test]
fn a_held_block_re_delivered_with_a_contradicting_log_is_refused() {
    // Same count, different content: the cheap length check must not be the
    // only thing standing here.
    let mut ix = indexer(3);
    let b = linear(100);
    ix.observe_block(b, vec![mint_log(&b, 0xA1, 0, 7, 0xAA)])
        .unwrap();

    // Same block, same log_index, different payload. One of the two deliveries
    // is wrong, and this adapter is not the thing that picks the winner.
    assert_eq!(
        ix.observe_block(b, vec![mint_log(&b, 0xA1, 0, 7, 0xBB)])
            .unwrap_err(),
        IndexError::DuplicateBlockLogsDiffer {
            block_number: 100,
            held: 1,
            observed: 1,
        }
    );
}

#[test]
fn a_held_block_re_delivered_identically_is_still_a_noop() {
    // The refusal above must not cost replay-safety, which is what
    // `Observation::Duplicate` exists for.
    let mut ix = indexer(3);
    let b = linear(100);
    let logs = vec![
        mint_log(&b, 0xA1, 0, 1, 0xAA),
        mint_log(&b, 0xA1, 1, 2, 0xAA),
    ];
    ix.observe_block(b, logs.clone()).unwrap();
    ix.observe_block(b, logs.clone()).unwrap();

    // And order is not contradiction: `log_index` is what identifies a log
    // within a block, so a source that yields them in another order is saying
    // the same thing.
    let mut reordered = logs;
    reordered.reverse();
    ix.observe_block(b, reordered).unwrap();
    assert_eq!(ix.pending_blocks(), vec![100]);
}

#[test]
fn a_drained_block_re_delivered_with_a_log_it_did_not_carry_is_refused() {
    // The same multi-filter hazard as the held-block cases above, one step
    // later in the block's life. `DuplicateBlockLogsDiffer` can only fire while
    // the block is still in `pending`; once it has drained there is no held log
    // set to compare against, and the drained half needs its own guard.
    //
    // The cursor does not cover it: only *emitted* positions sit behind the
    // cursor, and this chain emits nothing at all, so the cursor stays `None`
    // and every log of a divergent re-delivery is still ahead of it.
    let mut ix = indexer(3);
    ix.drive(&mut FixtureSource::new(chain_with(100, 110, &|_| vec![])))
        .unwrap();
    assert_eq!(ix.cursor().last_emitted, None);
    assert_eq!(ix.pending_blocks(), vec![108, 109, 110], "100..=107 drained");

    // A lagging second per-address `eth_getLogs` filter re-delivers 105 with a
    // log the first delivery lacked. Had it arrived in time it would have
    // emitted; returning Ok here drops an event that qualified for the bus.
    let b = linear(105);
    let err = ix
        .observe_block(b, vec![mint_log(&b, 0xA1, 0, 7, 0xAA)])
        .unwrap_err();
    assert_eq!(
        err,
        IndexError::DrainedBlockLogWouldHaveEmitted {
            block_number: 105,
            log_index: 0,
        }
    );
    assert!(err.to_string().contains("BLOCKED"));
}

#[test]
fn a_drained_block_re_delivered_identically_is_still_a_noop() {
    // The guard above must not cost replay-safety: a backfill re-feeding blocks
    // it already fed is the ordinary crash-recovery path, and every log it
    // carries the second time did emit the first time — so every one of them is
    // behind the cursor, and none is a contradiction.
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA), lock_log(b, 0xA2, 1, 7)]
        } else {
            vec![]
        }
    });
    let events = ix.drive(&mut FixtureSource::new(blocks.clone())).unwrap();
    assert_eq!(events.len(), 2);
    assert!(!ix.pending_blocks().contains(&105), "105 drained");

    let b = linear(105);
    ix.observe_block(b, vec![mint_log(&b, 0xA1, 0, 7, 0xAA), lock_log(&b, 0xA2, 1, 7)])
        .unwrap();

    // Noise in a drained block is not a contradiction either: an unlisted
    // address and an unknown topic0 are logs the drain would not have emitted
    // whether or not they were there, so they are nothing to refuse over.
    let mut unknown = mint_log(&b, 0xA3, 9, 7, 0xAA);
    unknown.topics[0] = topic0_of("Transfer(address,address,uint256)");
    let mut wrong_address = mint_log(&b, 0xA4, 10, 7, 0xAA);
    wrong_address.address = OTHER_CONTRACT;
    ix.observe_block(b, vec![unknown, wrong_address]).unwrap();
}

#[test]
fn a_resume_that_starts_above_the_cursor_block_is_refused() {
    // The cursor was persisted at (105, 0, h105) and the process died. While
    // it was down the chain reorged at 104, so canonical 105 is now 205'. The
    // caller resumes, but its source starts at 106 — an off-by-one, or a
    // separately-stored "next block" watermark.
    //
    // Nothing is wrong with 106' taken alone: it links to 105' cleanly, and an
    // empty tracker anchors its first block with no parent to check against.
    // So the indexer would index the new branch and never notice that the
    // block-105 event it already emitted does not exist on it. The cursor
    // carries a block hash precisely to catch this, and that guard can only
    // fire at 105 — which a feed starting at 106 never delivers.
    let mut cursor = Cursor::new();
    cursor.advance_to(105, 0, hex0x(&h(105)));
    let mut ix = Indexer::resume(test_config(3), BNRI_GENESIS_V0_UNVERIFIED, cursor).unwrap();
    assert_eq!(ix.resume_block(), Some(105));

    let err = ix.observe_block(blk(106, 206, 205), vec![]).unwrap_err();
    assert_eq!(
        err,
        IndexError::ResumeAboveCursor {
            resume_block: 105,
            observed: 106,
        }
    );
    assert!(err.to_string().contains("BLOCKED"));

    // Refusing is not latching: feed the block `resume_block()` names, and the
    // guard the caller skipped past gets its chance to fire.
    assert!(
        matches!(
            ix.observe_block(blk(105, 205, 104), vec![]).unwrap_err(),
            IndexError::HistoryChangedUnderCursor {
                block_number: 105,
                ..
            }
        ),
        "the cursor's block-hash guard must be what answers at 105"
    );
}

#[test]
fn a_resume_that_starts_at_or_below_the_cursor_block_is_allowed() {
    // The refusal above must not break the ordinary crash-recovery path: a
    // full backfill replay from far below the cursor is legitimate, the cursor
    // filters what already went out, and the feed still passes through the
    // cursor's block where the hash guard does fire.
    let mut cursor = Cursor::new();
    cursor.advance_to(105, 0, hex0x(&h(105)));
    let mut from_below =
        Indexer::resume(test_config(3), BNRI_GENESIS_V0_UNVERIFIED, cursor.clone()).unwrap();
    from_below.observe_block(linear(100), vec![]).unwrap();

    // And restarting at exactly `resume_block()` — what the doc asks for.
    let mut at_cursor =
        Indexer::resume(test_config(3), BNRI_GENESIS_V0_UNVERIFIED, cursor).unwrap();
    at_cursor.observe_block(linear(105), vec![]).unwrap();
}

#[test]
fn ambiguous_reorg_blocks_and_never_guesses() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|_| vec![]);
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();

    // A block claiming a parent we have never seen: unresolvable.
    let err = ix.observe_block(blk(111, 211, 199), vec![]).unwrap_err();
    assert!(matches!(err, IndexError::Reorg(_)), "got {err:?}");
    assert!(err.to_string().contains("BLOCKED"));
}

#[test]
fn history_changing_under_the_cursor_blocks() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![lock_log(b, 0x51, 0, 5)]
        } else {
            vec![]
        }
    });
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();

    // Block 105 comes back with a different hash: the branch our emitted
    // event sits on is gone.
    let err = ix.observe_block(blk(105, 205, 104), vec![]).unwrap_err();
    assert!(
        matches!(err, IndexError::HistoryChangedUnderCursor { block_number: 105, .. }),
        "got {err:?}"
    );
}

// ---------------------------------------------------------------------------
// MARQUEE: idempotency + crash resume
// ---------------------------------------------------------------------------

#[test]
fn crash_mid_block_resumes_without_skipping_or_duplicating() {
    // Block 106 carries three logs of ONE transaction. A caller that persists
    // its cursor per emitted event can crash between them, leaving the cursor
    // mid-block. Resume must emit logs 1 and 2 — no skip, no duplicate.
    let logs_at = |b: &BlockRef| -> Vec<RawLog> {
        if b.number == 106 {
            vec![
                mint_log(b, 0xA1, 0, 1, 0xAA),
                mint_log(b, 0xA1, 1, 2, 0xAA),
                mint_log(b, 0xA1, 2, 3, 0xAA),
            ]
        } else {
            vec![]
        }
    };

    // --- Reference run: no crash ------------------------------------------
    let mut whole = indexer(3);
    let full = whole
        .drive(&mut FixtureSource::new(chain_with(100, 109, &logs_at)))
        .unwrap();
    assert_eq!(full.len(), 3);

    // --- Crashed run: cursor persisted after the first event --------------
    let mut crashed = Cursor::new();
    crashed.advance_to(106, 0, hex0x(&h(106)));
    let persisted = crashed.to_json();

    // Process restarts and reads the cursor back off disk.
    let mut resumed = Indexer::resume(
        test_config(3),
        BNRI_GENESIS_V0_UNVERIFIED,
        Cursor::from_json(&persisted).unwrap(),
    )
    .unwrap();

    // It must re-request block 106 itself — not 107.
    assert_eq!(
        resumed.resume_block(),
        Some(106),
        "resuming at block+1 would drop the logs left in the crashed block"
    );

    let after = resumed
        .drive(&mut FixtureSource::new(chain_with(100, 109, &logs_at)))
        .unwrap();

    // No skip, no duplicate: exactly the events the crash left unemitted.
    assert_eq!(after.len(), 2);
    assert_eq!(after[0].event_id, full[1].event_id);
    assert_eq!(after[1].event_id, full[2].event_id);
    assert_eq!(after, full[1..].to_vec());
}

#[test]
fn replaying_the_same_blocks_emits_nothing_the_second_time() {
    let mut ix = indexer(3);
    let logs_at = |b: &BlockRef| -> Vec<RawLog> {
        if b.number == 105 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    };

    let first = ix
        .drive(&mut FixtureSource::new(chain_with(100, 110, &logs_at)))
        .unwrap();
    assert_eq!(first.len(), 1);

    // The exact same feed again — the tracker sees duplicates, the cursor
    // filters, and nothing crosses twice.
    let second = ix
        .drive(&mut FixtureSource::new(chain_with(100, 110, &logs_at)))
        .unwrap();
    assert!(second.is_empty(), "replay must be a no-op, got {second:?}");
}

#[test]
fn a_fresh_process_resuming_from_a_finished_cursor_emits_nothing() {
    let mut ix = indexer(3);
    let logs_at = |b: &BlockRef| -> Vec<RawLog> {
        if b.number == 105 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    };
    let first = ix
        .drive(&mut FixtureSource::new(chain_with(100, 110, &logs_at)))
        .unwrap();
    assert_eq!(first.len(), 1);

    let persisted = ix.cursor().to_json();
    let mut restarted = Indexer::resume(
        test_config(3),
        BNRI_GENESIS_V0_UNVERIFIED,
        Cursor::from_json(&persisted).unwrap(),
    )
    .unwrap();
    let again = restarted
        .drive(&mut FixtureSource::new(chain_with(100, 110, &logs_at)))
        .unwrap();
    assert!(again.is_empty(), "a full backfill replay re-emitted {again:?}");
}

// ---------------------------------------------------------------------------
// fail-closed refusals
// ---------------------------------------------------------------------------

#[test]
fn a_recognized_event_with_a_malformed_payload_halts_and_moves_nothing() {
    let mut ix = indexer(3);

    // A lock log carrying one word too many: recognized topic0, wrong arity.
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![log_on(b, 0x51, 0, SIG_LOCK, &[word(0x01)], &[word(5), word(6)])]
        } else {
            vec![]
        }
    });
    for (block, logs) in blocks {
        ix.observe_block(block, logs).unwrap();
    }

    let err = ix.drain_confirmed().unwrap_err();
    assert!(matches!(err, IndexError::Abi(_)), "got {err:?}");
    // Atomic: nothing emitted, cursor untouched.
    assert!(ix.cursor().last_emitted.is_none());
    // And it stays halted rather than skipping the bad log on the next call.
    assert!(ix.drain_confirmed().is_err());
}

#[test]
fn a_log_flagged_removed_is_refused() {
    let mut ix = indexer(3);
    let b = linear(100);
    let mut log = mint_log(&b, 0xA1, 0, 7, 0xAA);
    log.removed = true;
    assert_eq!(
        ix.observe_block(b, vec![log]).unwrap_err(),
        IndexError::RemovedLogObserved {
            block_number: 100,
            log_index: 0
        }
    );
}

#[test]
fn a_log_that_does_not_belong_to_its_block_is_refused() {
    let mut ix = indexer(3);
    let b = linear(100);
    let other = linear(101);
    let stray = mint_log(&other, 0xA1, 0, 7, 0xAA);
    assert!(matches!(
        ix.observe_block(b, vec![stray]).unwrap_err(),
        IndexError::LogBlockMismatch { .. }
    ));
}

#[test]
fn two_logs_claiming_one_log_index_are_refused() {
    let mut ix = indexer(3);
    let b = linear(100);
    let a = mint_log(&b, 0xA1, 0, 1, 0xAA);
    let c = mint_log(&b, 0xA1, 0, 2, 0xAA); // same index
    assert_eq!(
        ix.observe_block(b, vec![a, c]).unwrap_err(),
        IndexError::DuplicateLogIndex {
            block_number: 100,
            log_index: 0
        }
    );
}

#[test]
fn a_source_error_never_reads_as_done() {
    // The fail-closed core of the transport seam: a failure that returned
    // Ok(None) would look exactly like "backfill complete" and the caller
    // would advance as though it had seen the whole chain.
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|_| vec![]);
    let mut source = FixtureSource::failing_after(blocks, 4);
    let err = ix.drive(&mut source).unwrap_err();
    assert!(err.to_string().contains("log source failed"));
}

#[test]
fn a_drive_that_fails_mid_stream_carries_out_the_events_it_already_emitted() {
    // `drive` emits incrementally — each block observed can confirm an earlier
    // one — and `drain_confirmed` commits the cursor advance as it emits. So
    // by the time a later block fails, the events from earlier blocks in the
    // same call are already *past* the cursor. An error path that dropped them
    // would not be deferring them to the retry; it would be losing them, and
    // the "never skip" half of exactly-once with them.
    let mut ix = indexer(3);
    let logs_at = |b: &BlockRef| -> Vec<RawLog> {
        if b.number == 105 {
            vec![mint_log(b, 0xA1, 0, 7, 0xAA)]
        } else {
            vec![]
        }
    };

    // Serves 100..=108 — enough to bury 105 under depth 3 and emit it — and
    // then fails on the next block.
    let mut source = FixtureSource::failing_after(chain_with(100, 110, &logs_at), 9);
    let err = ix.drive(&mut source).unwrap_err();
    assert!(err.to_string().contains("log source failed"));

    // The event crossed the cursor before the failure. It must come back.
    assert_eq!(
        err.emitted.len(),
        1,
        "an event emitted and committed before the failure was dropped on the \
         error path: {:?}",
        err.emitted
    );
    assert_eq!(
        err.emitted[0].source_ref,
        format!("105:{}#0", hex0x(&[0xA1u8; 32]))
    );

    // And this is why dropping it would be permanent rather than a deferral:
    // the retry a caller makes next — same indexer, chain re-fed from the top
    // — emits nothing, because the cursor already sits past block 105. Drop
    // `DriveError::emitted` and that event is emitted ZERO times.
    let retried = ix
        .drive(&mut FixtureSource::new(chain_with(100, 110, &logs_at)))
        .unwrap();
    assert!(
        retried.is_empty(),
        "the retry re-emitted the event, so it was never lost: {retried:?}"
    );
    assert_eq!(ix.cursor().last_emitted.as_ref().unwrap().block_number, 105);
}

#[test]
fn a_drive_halted_by_the_indexer_also_carries_out_what_it_emitted() {
    // Same hole, the other error arm: `observe_block` refusing mid-drive must
    // not swallow the events earlier blocks in that call already committed.
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|b| {
        if b.number == 105 {
            vec![lock_log(b, 0x51, 0, 5)]
        } else {
            vec![]
        }
    });
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();

    // A feed that carries block 111's mint, buries it deep enough to emit
    // (tip 114, depth 3 -> confirmed through 111), and *then* forks below the
    // cursor.
    let b111 = blk(111, 211, 110);
    let feed = vec![
        (b111, vec![mint_log(&b111, 0xA1, 0, 7, 0xAA)]),
        (blk(112, 212, 211), vec![]),
        (blk(113, 213, 212), vec![]),
        (blk(114, 214, 213), vec![]),
        // Orphans block 105, whose lock already crossed: a latched halt.
        (blk(104, 204, 103), vec![]),
    ];
    let err = ix.drive(&mut FixtureSource::new(feed)).unwrap_err();

    assert!(matches!(
        err.cause,
        DriveFailure::Index(IndexError::ReorgBelowEmitted { .. })
    ));
    // Block 111's mint confirmed at tip 112 (depth 3) and crossed the cursor
    // before the halt. The halt does not un-emit it, so the error must carry
    // it out.
    assert_eq!(
        err.emitted.len(),
        1,
        "the halt swallowed an event that had already been committed: {:?}",
        err.emitted
    );
    assert_eq!(err.emitted[0].event_type, EventType::BnriInscriptionMinted);
}

#[test]
fn an_observation_refused_leaves_the_indexer_untouched() {
    let mut ix = indexer(3);
    let blocks = chain_with(100, 110, &|_| vec![]);
    ix.drive(&mut FixtureSource::new(blocks)).unwrap();
    let before = ix.confirmed_through();

    let b = linear(111);
    let mut bad = mint_log(&b, 0xA1, 0, 7, 0xAA);
    bad.removed = true;
    assert!(ix.observe_block(b, vec![bad]).is_err());

    assert_eq!(ix.confirmed_through(), before, "a refusal mutated state");
}
