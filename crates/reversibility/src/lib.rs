//! Independence-aware quorum over chain sources.
//!
//! # The defect this crate exists to prevent
//!
//! A quorum of `>= 2` sounds like a safety property and is not. It counts
//! SOURCES, and the property anyone actually wants is INDEPENDENCE. Two
//! endpoints that proxy the same node agree forever, at exactly the moments
//! disagreement was supposed to be the alarm: they cannot detect a reorg, a
//! stale head, or a lying node, because there is only one machine behind both
//! of them. A quorum satisfiable by one operator is not a quorum. It is a
//! single point of failure wearing a plural noun.
//!
//! Founder amendment, 2026-08-26:
//!
//! > "ADD `operator()` TO THE `Source` TRAIT — a stable declared string naming
//! > who runs the endpoint. Constructor refuses (or flags, your pick, log it) a
//! > quorum that a single operator can satisfy."
//!
//! **This crate REFUSES, and the pick is logged here with its reason.** A flag
//! can be read and ignored, and the configuration it warns about looks healthy
//! right up until the moment it needed to disagree. Refusing at construction
//! makes the unsafe shape unrepresentable: if you hold a [`Quorum`], its
//! independence was already proved. The cost is that a caller must handle an
//! error at wiring time, which is the cheapest place a caller ever handles one.
//!
//! `operator()` is a DECLARED string, and the crate says so plainly rather than
//! implying it verified anything: nothing here can prove two endpoints are
//! really separate machines. What it can do is refuse a configuration that is
//! transparently unsafe *by its own declaration*, and make the declaration the
//! thing a reviewer reads. A wrong declaration is a lie by the operator's
//! author; an absent one was a bug nobody could see.
//!
//! # What it deliberately does not do
//!
//! No network. No async. No dependencies. This crate never fetches a head — it
//! takes readings an adapter already made, and decides whether they may be
//! believed. That boundary is why it can stay `#![forbid(unsafe_code)]` and
//! zero-dep, and why it is testable without a chain.

#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

/// One block, as some source reported it.
///
/// `parent` is what makes a reorg distinguishable from ordinary progress: a
/// new head that does not descend from the old one is a fork, not a block.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct BlockRef {
    /// Height, as the chain counts it.
    pub height: u64,
    /// Block identifier — hash, id, whatever the rail calls it.
    pub id: String,
    /// The identifier this block claims as its parent. `None` at genesis or
    /// when a rail does not expose it; a source that cannot report a parent
    /// can still vote on a head, it just cannot help prove descent.
    pub parent: Option<String>,
}

impl BlockRef {
    pub fn new(height: u64, id: impl Into<String>, parent: Option<String>) -> Self {
        Self {
            height,
            id: id.into(),
            parent,
        }
    }
}

/// A place a head can be read from.
///
/// The trait is deliberately tiny: a stable identity, a declared operator, and
/// a reading. Anything richer belongs in the adapter that implements it.
pub trait Source {
    /// Stable identifier for this endpoint. Distinct per endpoint.
    fn id(&self) -> &str;

    /// **Who runs this endpoint** — a stable, declared string.
    ///
    /// Two endpoints sharing an operator string are treated as ONE voice, no
    /// matter how many URLs they have. This is a declaration, not a proof: the
    /// crate cannot verify that two hosts are really different machines, and
    /// does not pretend to. It refuses configurations that are unsafe by their
    /// own declaration, and puts the declaration where a reviewer will read it.
    fn operator(&self) -> &str;

    /// The head this source currently reports, or `None` if it could not be
    /// reached. An unreachable source is not a vote — a gap is data, never a
    /// silent agreement.
    fn head(&self) -> Option<BlockRef>;
}

/// Why a quorum could not be built.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QuorumError {
    /// A quorum of zero or one accepts a single voice by construction.
    TooSmall { asked: usize },
    /// Fewer distinct operators than the quorum needs, so it could never be
    /// met by independent voices — only by counting one operator twice.
    NotEnoughOperators { operators: usize, quorum: usize },
    /// THE DEFECT THIS CRATE EXISTS FOR: one operator controls enough sources
    /// to satisfy the quorum alone.
    SingleOperatorCanSatisfy {
        operator: String,
        controls: usize,
        quorum: usize,
    },
    /// Two sources declared the same id. Ids must be distinct or votes cannot
    /// be attributed.
    DuplicateSourceId { id: String },
}

impl fmt::Display for QuorumError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            QuorumError::TooSmall { asked } => write!(
                f,
                "quorum of {asked} accepts a single voice by construction; use 2 or more"
            ),
            QuorumError::NotEnoughOperators { operators, quorum } => write!(
                f,
                "{operators} distinct operator(s) cannot satisfy a quorum of {quorum} independently"
            ),
            QuorumError::SingleOperatorCanSatisfy {
                operator,
                controls,
                quorum,
            } => write!(
                f,
                "operator {operator:?} controls {controls} of the sources and can satisfy the \
                 quorum of {quorum} alone — that is not a quorum, it is one machine agreeing \
                 with itself"
            ),
            QuorumError::DuplicateSourceId { id } => {
                write!(f, "two sources declared the same id {id:?}")
            }
        }
    }
}

impl std::error::Error for QuorumError {}

/// What the sources currently say, taken together.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Reading {
    /// At least `quorum` INDEPENDENT operators reported the same head.
    Agreed {
        head: BlockRef,
        operators: BTreeSet<String>,
    },
    /// Readings exist but no head reached the quorum of distinct operators.
    /// Carries every candidate with the operators behind it, so a caller can
    /// see whether it is a split or simply a thin round.
    NoQuorum {
        candidates: Vec<(BlockRef, BTreeSet<String>)>,
    },
    /// Not enough operators answered at all. Distinct from `NoQuorum`: nobody
    /// disagreed, there just were not enough voices to ask.
    Silent { answered: usize, quorum: usize },
}

/// A set of sources whose independence has been proved at construction.
pub struct Quorum<S: Source> {
    sources: Vec<S>,
    quorum: usize,
}

/// Hand-written so a caller never has to make every `Source` `Debug` just to log
/// a quorum — and so the printed form shows the property that matters: how many
/// INDEPENDENT operators stand behind it, not how many URLs.
impl<S: Source> fmt::Debug for Quorum<S> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Quorum")
            .field("quorum", &self.quorum)
            .field("sources", &self.sources.len())
            .field("operators", &self.operators())
            .finish()
    }
}

impl<S: Source> Quorum<S> {
    /// Build a quorum, or refuse.
    ///
    /// Refuses when the quorum is smaller than 2, when there are fewer distinct
    /// operators than the quorum, or when ANY single operator controls enough
    /// sources to satisfy it alone.
    pub fn new(sources: Vec<S>, quorum: usize) -> Result<Self, QuorumError> {
        if quorum < 2 {
            return Err(QuorumError::TooSmall { asked: quorum });
        }

        let mut seen_ids: BTreeSet<&str> = BTreeSet::new();
        for s in &sources {
            if !seen_ids.insert(s.id()) {
                return Err(QuorumError::DuplicateSourceId {
                    id: s.id().to_string(),
                });
            }
        }

        let mut per_operator: BTreeMap<&str, usize> = BTreeMap::new();
        for s in &sources {
            *per_operator.entry(s.operator()).or_insert(0) += 1;
        }

        // THE CHECK. Sorted iteration over a BTreeMap, so the operator named in
        // the error is deterministic rather than whichever the hasher reached
        // first — an error message that changes between runs is a bad receipt.
        for (operator, controls) in &per_operator {
            if *controls >= quorum {
                return Err(QuorumError::SingleOperatorCanSatisfy {
                    operator: (*operator).to_string(),
                    controls: *controls,
                    quorum,
                });
            }
        }

        if per_operator.len() < quorum {
            return Err(QuorumError::NotEnoughOperators {
                operators: per_operator.len(),
                quorum,
            });
        }

        Ok(Self { sources, quorum })
    }

    /// How many independent operators must agree.
    pub fn quorum(&self) -> usize {
        self.quorum
    }

    /// The distinct operators behind this quorum.
    pub fn operators(&self) -> BTreeSet<&str> {
        self.sources.iter().map(|s| s.operator()).collect()
    }

    /// Ask every source and count votes BY OPERATOR.
    ///
    /// Two endpoints run by the same operator contribute one vote, whether they
    /// agree or not — which is the whole point: their agreement was never
    /// evidence.
    pub fn read(&self) -> Reading {
        let mut by_head: BTreeMap<BlockRef, BTreeSet<String>> = BTreeMap::new();
        let mut answering: BTreeSet<&str> = BTreeSet::new();

        for s in &self.sources {
            if let Some(head) = s.head() {
                answering.insert(s.operator());
                by_head
                    .entry(head)
                    .or_default()
                    .insert(s.operator().to_string());
            }
        }

        if answering.len() < self.quorum {
            return Reading::Silent {
                answered: answering.len(),
                quorum: self.quorum,
            };
        }

        // Tallest agreed head wins: a lagging source that still agrees about an
        // older block must not out-vote a majority that has moved on.
        let mut best: Option<(BlockRef, BTreeSet<String>)> = None;
        for (head, ops) in &by_head {
            if ops.len() >= self.quorum {
                let better = match &best {
                    None => true,
                    Some((b, _)) => head.height > b.height,
                };
                if better {
                    best = Some((head.clone(), ops.clone()));
                }
            }
        }

        match best {
            Some((head, operators)) => Reading::Agreed { head, operators },
            None => {
                let mut candidates: Vec<(BlockRef, BTreeSet<String>)> =
                    by_head.into_iter().collect();
                candidates.sort_by(|a, b| b.0.height.cmp(&a.0.height));
                Reading::NoQuorum { candidates }
            }
        }
    }
}

/// What changed between two agreed heads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Movement {
    /// The chain moved forward and the new head descends from the old one.
    Advanced { from: BlockRef, to: BlockRef },
    /// A REORG: the new agreed head does not descend from the old one.
    /// `depth` is how far back the chain was rewritten, when it can be told
    /// from the heights.
    Reorg {
        from: BlockRef,
        to: BlockRef,
        depth: u64,
    },
    /// Same head as before.
    Still { head: BlockRef },
}

/// Compare two agreed heads, given the descent that is known.
///
/// `descends` answers "does `to` descend from `from`?" — the caller supplies it
/// because only an adapter can walk a chain, and this crate does not touch one.
/// When descent cannot be established, the movement is reported as a REORG
/// rather than an advance: an unproved advance and a rewrite look identical
/// from a head alone, and the safe reading of "I cannot tell" is the one that
/// makes a caller stop.
pub fn movement(
    from: &BlockRef,
    to: &BlockRef,
    descends: impl Fn(&BlockRef, &BlockRef) -> bool,
) -> Movement {
    if from == to {
        return Movement::Still { head: to.clone() };
    }
    if descends(from, to) {
        return Movement::Advanced {
            from: from.clone(),
            to: to.clone(),
        };
    }
    let depth = from
        .height
        .saturating_sub(to.height.saturating_sub(1))
        .max(1);
    Movement::Reorg {
        from: from.clone(),
        to: to.clone(),
        depth,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake {
        id: &'static str,
        operator: &'static str,
        head: Option<BlockRef>,
    }
    impl Fake {
        fn at(
            id: &'static str,
            operator: &'static str,
            height: u64,
            block: &str,
            parent: &str,
        ) -> Self {
            Self {
                id,
                operator,
                head: Some(BlockRef::new(height, block, Some(parent.to_string()))),
            }
        }
        fn down(id: &'static str, operator: &'static str) -> Self {
            Self {
                id,
                operator,
                head: None,
            }
        }
    }
    impl Source for Fake {
        fn id(&self) -> &str {
            self.id
        }
        fn operator(&self) -> &str {
            self.operator
        }
        fn head(&self) -> Option<BlockRef> {
            self.head.clone()
        }
    }

    /// THE AMENDMENT'S OWN TEST. Two endpoints, one operator, quorum of 2:
    /// they agree forever and detect nothing. The constructor refuses.
    #[test]
    fn one_operator_cannot_satisfy_a_quorum() {
        let sources = vec![
            Fake::at("api.example.com", "greymass", 100, "a", "z"),
            Fake::at("api2.example.com", "greymass", 100, "a", "z"),
        ];
        let err = Quorum::new(sources, 2).unwrap_err();
        assert_eq!(
            err,
            QuorumError::SingleOperatorCanSatisfy {
                operator: "greymass".to_string(),
                controls: 2,
                quorum: 2,
            }
        );
        // and the message says why, not just that
        let msg = err.to_string();
        assert!(msg.contains("one machine agreeing with itself"), "{msg}");
    }

    /// The same trap one size up: three sources look plural, but two of them
    /// are one operator and the quorum is two.
    #[test]
    fn a_majority_operator_is_refused_even_with_a_third_voice() {
        let sources = vec![
            Fake::at("a1", "eosnation", 100, "a", "z"),
            Fake::at("a2", "eosnation", 100, "a", "z"),
            Fake::at("b1", "greymass", 100, "a", "z"),
        ];
        assert!(matches!(
            Quorum::new(sources, 2),
            Err(QuorumError::SingleOperatorCanSatisfy { .. })
        ));
    }

    #[test]
    fn independent_operators_are_accepted() {
        let q = Quorum::new(
            vec![
                Fake::at("a1", "eosnation", 100, "a", "z"),
                Fake::at("b1", "greymass", 100, "a", "z"),
                Fake::at("c1", "blocktivity", 100, "a", "z"),
            ],
            2,
        )
        .expect("three operators, quorum two");
        assert_eq!(q.quorum(), 2);
        assert_eq!(q.operators().len(), 3);
    }

    #[test]
    fn quorum_below_two_is_refused() {
        for k in [0usize, 1] {
            let sources = vec![Fake::at("a1", "op1", 1, "a", "z")];
            assert_eq!(
                Quorum::new(sources, k).unwrap_err(),
                QuorumError::TooSmall { asked: k }
            );
        }
    }

    #[test]
    fn duplicate_ids_are_refused() {
        let sources = vec![
            Fake::at("same", "op1", 1, "a", "z"),
            Fake::at("same", "op2", 1, "a", "z"),
        ];
        assert!(matches!(
            Quorum::new(sources, 2),
            Err(QuorumError::DuplicateSourceId { .. })
        ));
    }

    #[test]
    fn too_few_operators_for_the_quorum_is_refused() {
        let sources = vec![
            Fake::at("a1", "op1", 1, "a", "z"),
            Fake::at("b1", "op2", 1, "a", "z"),
        ];
        assert_eq!(
            Quorum::new(sources, 3).unwrap_err(),
            QuorumError::NotEnoughOperators {
                operators: 2,
                quorum: 3
            }
        );
    }

    #[test]
    fn agreement_counts_operators_not_endpoints() {
        let q = Quorum::new(
            vec![
                Fake::at("a1", "op1", 10, "x", "w"),
                Fake::at("b1", "op2", 10, "x", "w"),
                Fake::at("c1", "op3", 10, "y", "w"),
            ],
            2,
        )
        .unwrap();
        match q.read() {
            Reading::Agreed { head, operators } => {
                assert_eq!(head.id, "x");
                assert_eq!(operators.len(), 2);
            }
            other => panic!("expected agreement, got {other:?}"),
        }
    }

    #[test]
    fn a_split_with_no_majority_is_reported_not_guessed() {
        let q = Quorum::new(
            vec![
                Fake::at("a1", "op1", 10, "x", "w"),
                Fake::at("b1", "op2", 10, "y", "w"),
                Fake::at("c1", "op3", 10, "z", "w"),
            ],
            2,
        )
        .unwrap();
        match q.read() {
            Reading::NoQuorum { candidates } => assert_eq!(candidates.len(), 3),
            other => panic!("expected NoQuorum, got {other:?}"),
        }
    }

    /// A gap is data. Sources that cannot be reached do not vote, and silence
    /// is reported as silence rather than as agreement with whoever did answer.
    #[test]
    fn unreachable_sources_do_not_vote() {
        let q = Quorum::new(
            vec![
                Fake::at("a1", "op1", 10, "x", "w"),
                Fake::down("b1", "op2"),
                Fake::down("c1", "op3"),
            ],
            2,
        )
        .unwrap();
        assert_eq!(
            q.read(),
            Reading::Silent {
                answered: 1,
                quorum: 2
            }
        );
    }

    #[test]
    fn a_lagging_agreement_does_not_outvote_a_taller_one() {
        // op1+op2 agree at 11; op3+op4 still agree at 10. The taller wins.
        let q = Quorum::new(
            vec![
                Fake::at("a1", "op1", 11, "new", "old"),
                Fake::at("b1", "op2", 11, "new", "old"),
                Fake::at("c1", "op3", 10, "old", "older"),
                Fake::at("d1", "op4", 10, "old", "older"),
            ],
            2,
        )
        .unwrap();
        match q.read() {
            Reading::Agreed { head, .. } => assert_eq!(head.height, 11),
            other => panic!("expected the taller agreement, got {other:?}"),
        }
    }

    /// HIVE-SHAPED MICROFORK REPLAY.
    ///
    /// Modelled on Hive's behaviour — the rail the founder named because it
    /// microforks constantly, where the other rails barely reorg. This is a
    /// DETERMINISTIC MODEL, not a reading of the chain: this crate makes no
    /// network call, and no `chain-hive` rail exists in this tree to read
    /// (Hive is founder-ruled IN, 2026-07-23, and unbuilt). The model is
    /// honest about being one; it exercises the loop, it does not attest to
    /// Hive.
    #[test]
    fn hive_shaped_microfork_is_seen_as_a_reorg_not_an_advance() {
        // Round 1: two independent operators agree on head 100 "aaa".
        let before = BlockRef::new(100, "aaa", Some("099".into()));
        // Round 2: the same height is now a different block — the classic
        // one-block microfork. It cannot descend from "aaa": they are siblings.
        let after = BlockRef::new(100, "bbb", Some("099".into()));

        let descends =
            |from: &BlockRef, to: &BlockRef| to.parent.as_deref() == Some(from.id.as_str());

        match movement(&before, &after, descends) {
            Movement::Reorg { from, to, depth } => {
                assert_eq!(from.id, "aaa");
                assert_eq!(to.id, "bbb");
                assert_eq!(depth, 1, "a one-block microfork is depth 1");
            }
            other => panic!("a sibling block must read as a reorg, got {other:?}"),
        }

        // And ordinary progress still reads as progress.
        let next = BlockRef::new(101, "ccc", Some("bbb".into()));
        assert!(matches!(
            movement(&after, &next, descends),
            Movement::Advanced { .. }
        ));
        assert!(matches!(
            movement(&after, &after, descends),
            Movement::Still { .. }
        ));
    }

    /// When descent cannot be established, the safe reading is REORG. An
    /// unproved advance and a rewrite are indistinguishable from a head alone,
    /// and the reading that makes a caller stop is the one that cannot lose
    /// money.
    #[test]
    fn unprovable_descent_reads_as_a_reorg() {
        let from = BlockRef::new(100, "aaa", None);
        let to = BlockRef::new(104, "eee", None);
        let never = |_: &BlockRef, _: &BlockRef| false;
        assert!(matches!(
            movement(&from, &to, never),
            Movement::Reorg { .. }
        ));
    }
}
