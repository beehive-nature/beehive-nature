//! The BNRi signature table — **the UNVERIFIED half of this adapter.**
//!
//! # Read this before using anything in this file
//!
//! **No BNRi contract exists.** Not in this repository, not at any address
//! this adapter can cite. Searched at authoring time: no Solidity sources, no
//! ABI JSON, no deployment record anywhere in the tree. The BNRi event
//! signatures are therefore **not knowable today**.
//!
//! What *is* settled is the **set of ten event names** — the founder-named
//! BNRi genesis set (inscription mint / lock / unlock / transfer / reroll,
//! farming lock / unlock, ticket accrual, draw commit / reveal). Those names
//! are authoritative. The **signature strings** that map onto them are not.
//!
//! # How the honest line is drawn
//!
//! - [`crate::abi`] is verifiable against the Solidity ABI specification, and
//!   is pinned by published keccak256 known-answer vectors. It does not
//!   change when the BNRi ABI lands.
//! - This table is **data**. Every entry carries [`Verification::Unverified`]
//!   and its signature string is a deliberately-fake `PLACEHOLDER_*` name.
//!
//! What enforces default-deny is [`SignatureTable::new`]: it **refuses**
//! unverified entries unless the caller explicitly opts in
//! (`allow_unverified`). Production config leaves it off, so the adapter
//! cannot silently emit placeholder-derived events; the test suite turns it on
//! to exercise the machinery end to end. That gate is code, and it is tested.
//!
//! The placeholder names are the second layer, and a weaker one — a legibility
//! measure, not a guarantee. `PLACEHOLDER_InscriptionMinted` is a legal
//! Solidity event identifier, so nothing prevents some contract emitting it;
//! the honest claim is that no contract we know of does, which makes the
//! topic0 it hashes to one this table is unlikely to match by accident. The
//! reason to prefer it over a plausible-looking invented signature
//! (`InscriptionMinted(address,uint256)`) is that the invented one would be
//! indistinguishable from a real one to the next reader, and *that* is how an
//! invented ABI gets mistaken for a real one. Default-deny does not rest on
//! the name; it rests on the `allow_unverified` gate above.
//!
//! # When the real ABI lands
//!
//! Replace each `signature` with the real string from the BNRi source, and
//! flip its mark to [`Verification::Verified`] citing the contract file and
//! event declaration it came from. Nothing in [`crate::abi`] moves. That is
//! the whole point of keeping the seam here.

use std::collections::HashMap;

use shared_types::EventType;

use crate::abi::{hex0x, topic0_of, Word};

/// Which BNRi subsystem an event belongs to. Grouping only — derived from the
/// founder-named genesis set, not from any contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BnriFamily {
    Inscription,
    Farming,
    Draw,
}

/// Whether an entry's signature string is backed by a citable source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verification {
    /// The signature is cited against a source that fixes it: contract file +
    /// event declaration, at a pinned commit.
    Verified {
        /// e.g. `"contracts/BNRi.sol:event InscriptionMinted @ <commit>"`.
        source: &'static str,
    },
    /// A placeholder. The real signature is not knowable yet.
    Unverified {
        /// What has to happen for this entry to become `Verified`.
        pending: &'static str,
    },
}

impl Verification {
    pub fn is_verified(&self) -> bool {
        matches!(self, Verification::Verified { .. })
    }
}

/// One row of the signature table: signature string -> event type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SignatureEntry {
    /// The canonical event signature `Name(type,...)`. Its keccak256 is the
    /// topic0 this row matches.
    pub signature: &'static str,
    /// The canonical event type this row produces.
    pub event_type: EventType,
    /// Which BNRi subsystem it belongs to.
    pub family: BnriFamily,
    /// Whether `signature` is citable.
    pub verification: Verification,
}

const PENDING: &str = "the real BNRi ABI: no BNRi contract exists yet";

/// The BNRi genesis set — **ten placeholder rows, none of them real.**
///
/// The `event_type` and `family` columns are authoritative (the founder named
/// the set). The `signature` column is fabricated-on-purpose and marked so.
/// The parameter lists are arbitrary: they exist to give the decoder
/// something structurally well-formed to chew on, and they carry **no claim**
/// about what BNRi events actually take.
pub const BNRI_GENESIS_V0_UNVERIFIED: &[SignatureEntry] = &[
    SignatureEntry {
        signature: "PLACEHOLDER_InscriptionMinted(address,uint256,bytes32)",
        event_type: EventType::BnriInscriptionMinted,
        family: BnriFamily::Inscription,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_InscriptionLocked(address,uint256)",
        event_type: EventType::BnriInscriptionLocked,
        family: BnriFamily::Inscription,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_InscriptionUnlocked(address,uint256)",
        event_type: EventType::BnriInscriptionUnlocked,
        family: BnriFamily::Inscription,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_InscriptionTransferred(address,address,uint256)",
        event_type: EventType::BnriInscriptionTransferred,
        family: BnriFamily::Inscription,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_InscriptionRerolled(address,uint256,bytes32)",
        event_type: EventType::BnriInscriptionRerolled,
        family: BnriFamily::Inscription,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_FarmingLocked(address,uint256,uint256)",
        event_type: EventType::BnriFarmingLocked,
        family: BnriFamily::Farming,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_FarmingUnlocked(address,uint256,uint256)",
        event_type: EventType::BnriFarmingUnlocked,
        family: BnriFamily::Farming,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_TicketAccrued(address,uint256,uint256)",
        event_type: EventType::BnriTicketAccrued,
        family: BnriFamily::Farming,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_DrawCommitted(uint256,bytes32)",
        event_type: EventType::BnriDrawCommitted,
        family: BnriFamily::Draw,
        verification: Verification::Unverified { pending: PENDING },
    },
    SignatureEntry {
        signature: "PLACEHOLDER_DrawRevealed(uint256,bytes32,uint256)",
        event_type: EventType::BnriDrawRevealed,
        family: BnriFamily::Draw,
        verification: Verification::Unverified { pending: PENDING },
    },
];

/// Why a table could not be built. Fail-closed: a table that cannot be built
/// unambiguously is not built at all.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TableError {
    /// Two entries hash to the same topic0. Which one a log meant would be a
    /// coin flip, so the table is refused.
    DuplicateTopic0 {
        topic0: String,
        first: &'static str,
        second: &'static str,
    },
    /// An entry's signature does not parse, or names a type the decoder
    /// refuses. Caught at construction rather than at the first matching log.
    BadEntry {
        signature: &'static str,
        reason: String,
    },
    /// An unverified entry was offered but `allow_unverified` was not set.
    UnverifiedNotAllowed {
        signature: &'static str,
        pending: &'static str,
    },
}

impl std::fmt::Display for TableError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TableError::DuplicateTopic0 {
                topic0,
                first,
                second,
            } => write!(f, "topic0 {topic0} claimed by both `{first}` and `{second}`"),
            TableError::BadEntry { signature, reason } => {
                write!(f, "`{signature}` is not usable: {reason}")
            }
            TableError::UnverifiedNotAllowed { signature, pending } => write!(
                f,
                "`{signature}` is UNVERIFIED (pending {pending}) and \
                 allow_unverified is not set"
            ),
        }
    }
}

impl std::error::Error for TableError {}

/// topic0 -> entry, built from a declarative entry list.
#[derive(Debug, Clone, Default)]
pub struct SignatureTable {
    by_topic0: HashMap<Word, SignatureEntry>,
}

impl SignatureTable {
    /// Build a table from entries.
    ///
    /// `allow_unverified` is the gate that keeps placeholders out of
    /// production: with it unset, any [`Verification::Unverified`] entry is
    /// refused and no table is built. Every signature is also parsed and
    /// type-checked here, so a malformed row fails at startup rather than on
    /// the first log that matches it.
    pub fn new(entries: &[SignatureEntry], allow_unverified: bool) -> Result<Self, TableError> {
        let mut by_topic0: HashMap<Word, SignatureEntry> = HashMap::new();

        for entry in entries {
            if !entry.verification.is_verified() && !allow_unverified {
                let pending = match entry.verification {
                    Verification::Unverified { pending } => pending,
                    Verification::Verified { .. } => unreachable!("checked above"),
                };
                return Err(TableError::UnverifiedNotAllowed {
                    signature: entry.signature,
                    pending,
                });
            }

            // Validate the row now, not at match time.
            let parsed =
                crate::abi::parse_signature(entry.signature).map_err(|e| TableError::BadEntry {
                    signature: entry.signature,
                    reason: e.to_string(),
                })?;
            for ty in &parsed.params {
                if !crate::abi::is_static_value_type(ty) {
                    return Err(TableError::BadEntry {
                        signature: entry.signature,
                        reason: format!("parameter type `{ty}` is dynamic or non-canonical"),
                    });
                }
            }

            let topic0 = topic0_of(entry.signature);
            if let Some(existing) = by_topic0.get(&topic0) {
                return Err(TableError::DuplicateTopic0 {
                    topic0: hex0x(&topic0),
                    first: existing.signature,
                    second: entry.signature,
                });
            }
            by_topic0.insert(topic0, *entry);
        }

        Ok(Self { by_topic0 })
    }

    /// The row matching this topic0, if any. `None` = not ours; the log is
    /// noise the kernel does not care about (the `normalizer` precedent:
    /// unmapped traffic is ignored, not an error).
    pub fn lookup(&self, topic0: &Word) -> Option<&SignatureEntry> {
        self.by_topic0.get(topic0)
    }

    pub fn len(&self) -> usize {
        self.by_topic0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_topic0.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_set_has_all_ten_founder_named_events() {
        assert_eq!(BNRI_GENESIS_V0_UNVERIFIED.len(), 10);
        let types: Vec<EventType> = BNRI_GENESIS_V0_UNVERIFIED
            .iter()
            .map(|e| e.event_type)
            .collect();
        for expected in [
            EventType::BnriInscriptionMinted,
            EventType::BnriInscriptionLocked,
            EventType::BnriInscriptionUnlocked,
            EventType::BnriInscriptionTransferred,
            EventType::BnriInscriptionRerolled,
            EventType::BnriFarmingLocked,
            EventType::BnriFarmingUnlocked,
            EventType::BnriTicketAccrued,
            EventType::BnriDrawCommitted,
            EventType::BnriDrawRevealed,
        ] {
            assert!(types.contains(&expected), "genesis set missing {expected:?}");
        }
    }

    /// The load-bearing honesty test. If someone swaps a placeholder for an
    /// invented-but-plausible signature without a citable source, this fails.
    #[test]
    fn every_genesis_entry_is_marked_unverified_and_named_placeholder() {
        for e in BNRI_GENESIS_V0_UNVERIFIED {
            assert!(
                matches!(e.verification, Verification::Unverified { .. }),
                "{} claims verification it does not have",
                e.signature
            );
            assert!(
                e.signature.starts_with("PLACEHOLDER_"),
                "{} must be visibly a placeholder while the BNRi ABI is unknown",
                e.signature
            );
        }
    }

    #[test]
    fn genesis_table_is_refused_by_default_because_it_is_unverified() {
        // Production path: no explicit opt-in, so placeholders cannot load.
        let err = SignatureTable::new(BNRI_GENESIS_V0_UNVERIFIED, false).unwrap_err();
        assert!(matches!(err, TableError::UnverifiedNotAllowed { .. }));
    }

    #[test]
    fn genesis_table_builds_when_unverified_is_explicitly_allowed() {
        let table = SignatureTable::new(BNRI_GENESIS_V0_UNVERIFIED, true).unwrap();
        assert_eq!(table.len(), 10);
    }

    #[test]
    fn all_ten_topic0s_are_distinct() {
        let table = SignatureTable::new(BNRI_GENESIS_V0_UNVERIFIED, true).unwrap();
        assert_eq!(table.len(), BNRI_GENESIS_V0_UNVERIFIED.len());
    }

    #[test]
    fn lookup_finds_entry_by_topic0() {
        let table = SignatureTable::new(BNRI_GENESIS_V0_UNVERIFIED, true).unwrap();
        let sig = "PLACEHOLDER_DrawCommitted(uint256,bytes32)";
        let entry = table.lookup(&topic0_of(sig)).unwrap();
        assert_eq!(entry.event_type, EventType::BnriDrawCommitted);
        assert_eq!(entry.family, BnriFamily::Draw);
    }

    #[test]
    fn unknown_topic0_is_not_ours() {
        let table = SignatureTable::new(BNRI_GENESIS_V0_UNVERIFIED, true).unwrap();
        // A real ERC-20 Transfer log is not a BNRi event.
        assert!(table
            .lookup(&topic0_of("Transfer(address,address,uint256)"))
            .is_none());
    }

    #[test]
    fn duplicate_topic0_refuses_the_table() {
        let dup = &[
            SignatureEntry {
                signature: "PLACEHOLDER_Same(uint256)",
                event_type: EventType::BnriDrawCommitted,
                family: BnriFamily::Draw,
                verification: Verification::Unverified { pending: PENDING },
            },
            SignatureEntry {
                signature: "PLACEHOLDER_Same(uint256)",
                event_type: EventType::BnriDrawRevealed,
                family: BnriFamily::Draw,
                verification: Verification::Unverified { pending: PENDING },
            },
        ];
        assert!(matches!(
            SignatureTable::new(dup, true),
            Err(TableError::DuplicateTopic0 { .. })
        ));
    }

    #[test]
    fn malformed_entry_is_caught_at_construction() {
        let bad = &[SignatureEntry {
            signature: "PLACEHOLDER_NoParens",
            event_type: EventType::BnriDrawCommitted,
            family: BnriFamily::Draw,
            verification: Verification::Unverified { pending: PENDING },
        }];
        assert!(matches!(
            SignatureTable::new(bad, true),
            Err(TableError::BadEntry { .. })
        ));
    }

    #[test]
    fn dynamic_type_entry_is_caught_at_construction() {
        let bad = &[SignatureEntry {
            signature: "PLACEHOLDER_Dyn(string)",
            event_type: EventType::BnriDrawCommitted,
            family: BnriFamily::Draw,
            verification: Verification::Unverified { pending: PENDING },
        }];
        assert!(matches!(
            SignatureTable::new(bad, true),
            Err(TableError::BadEntry { .. })
        ));
    }

    #[test]
    fn a_verified_entry_loads_without_the_opt_in() {
        // The shape the table takes once the real ABI lands.
        let verified = &[SignatureEntry {
            signature: "Transfer(address,address,uint256)",
            event_type: EventType::BnriInscriptionTransferred,
            family: BnriFamily::Inscription,
            verification: Verification::Verified {
                source: "test-only: ERC-20 published signature",
            },
        }];
        assert_eq!(SignatureTable::new(verified, false).unwrap().len(), 1);
    }
}
