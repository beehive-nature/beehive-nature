//! SPEC AV-5.2 — the reorg drill: reversibility quorum verdicts for a fork
//! (docs/agents/ADVERSARIAL-BPAY-SPECS.md). The crate existed unwired; this
//! drill is its wiring into the AV-5 story: a simulated fork across
//! independent sources must produce NoQuorum during the split (NEVER an
//! Agreed-by-one-operator confirmation), and once the network resolves the
//! reorg, `movement` must name it a Reorg with depth — the verdict that
//! drives the python poller's flag-not-credit law (meter.py lineage): a
//! Reorg verdict means flag and park, never credit.

use reversibility::{movement, BlockRef, Movement, Quorum, Reading, Source};

struct Node {
    id: &'static str,
    op: &'static str,
    head: Option<BlockRef>,
}

impl Source for Node {
    fn id(&self) -> &str {
        self.id
    }
    fn operator(&self) -> &str {
        self.op
    }
    fn head(&self) -> Option<BlockRef> {
        self.head.clone()
    }
}

fn block(height: u64, id: &str, parent: Option<&str>) -> BlockRef {
    BlockRef::new(height, id, parent.map(str::to_string))
}

/// THE DRILL — one fork, start to verdicts.
#[test]
fn av5_reorg_drill_verdicts() {
    // The pre-fork history: 100(blk-a) ← 101(blk-b), agreed by all three.
    let blk_b = block(101, "blk-b", Some("blk-a"));

    // ── window 1: the fork splits the sources ────────────────────────────
    // One operator sees the reorged head blk-x (height 101, does NOT descend
    // from the previously agreed blk-b); one still sees blk-b; one is
    // unreachable (a gap is data, never a silent agreement). Quorum is 2.
    let split_window = vec![
        Node {
            id: "s1",
            op: "op-alpha",
            head: Some(block(101, "blk-x", Some("blk-a"))),
        },
        Node {
            id: "s2",
            op: "op-beta",
            head: Some(blk_b.clone()),
        },
        Node {
            id: "s3",
            op: "op-gamma",
            head: None,
        },
    ];
    let q = Quorum::new(split_window, 2).expect("three distinct operators");
    match q.read() {
        Reading::NoQuorum { candidates } => {
            // both candidates visible, one operator each — a SPLIT, not a
            // confirmation. Crediting law: park, flag, credit nothing.
            assert_eq!(candidates.len(), 2, "both fork candidates must be visible");
            for (_, ops) in &candidates {
                assert_eq!(ops.len(), 1, "no head may reach quorum during the split");
            }
        }
        other => panic!("split window must read NoQuorum, got {other:?}"),
    }

    // ── window 2: the network resolves onto the reorged head ─────────────
    let resolved = vec![
        Node {
            id: "s1",
            op: "op-alpha",
            head: Some(block(101, "blk-x", Some("blk-a"))),
        },
        Node {
            id: "s2",
            op: "op-beta",
            head: Some(block(101, "blk-x", Some("blk-a"))),
        },
        Node {
            id: "s3",
            op: "op-gamma",
            head: Some(block(101, "blk-x", Some("blk-a"))),
        },
    ];
    let q2 = Quorum::new(resolved, 2).expect("three distinct operators");
    let new_head = match q2.read() {
        Reading::Agreed { head, operators } => {
            assert_eq!(head.id, "blk-x");
            assert_eq!(operators.len(), 3);
            head
        }
        other => panic!("resolved window must read Agreed, got {other:?}"),
    };

    // ── the verdict against the PREVIOUSLY AGREED head ───────────────────
    // blk-x does not descend from blk-b (both children of blk-a): the safe
    // reading is Reorg — an unproved advance and a rewrite look identical,
    // and the verdict that makes a caller STOP is the one a crediting
    // poller needs.
    match movement(&blk_b, &new_head, |_, _| false) {
        Movement::Reorg { from, to, depth } => {
            assert_eq!((from.id.as_str(), to.id.as_str()), ("blk-b", "blk-x"));
            assert_eq!(depth, 1, "one level rewritten");
        }
        other => panic!("non-descending head movement must read Reorg, got {other:?}"),
    }

    // and the honest advance still reads Advanced (the drill is not a
    // blanket refusal machine):
    let blk_c = block(102, "blk-c", Some("blk-x"));
    match movement(&new_head, &blk_c, |from, to| {
        to.parent.as_deref() == Some(from.id.as_str())
    }) {
        Movement::Advanced { from, to } => {
            assert_eq!((from.id.as_str(), to.id.as_str()), ("blk-x", "blk-c"));
        }
        other => panic!("descending head movement must read Advanced, got {other:?}"),
    }
    // Still for the no-op — the drill's control.
    assert_eq!(
        movement(&blk_c, &blk_c, |_, _| false),
        Movement::Still {
            head: blk_c.clone()
        }
    );
}
