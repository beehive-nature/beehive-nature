//! `mastery-ledger` (M-2) — the permanent, commons-first record of *who proved what*.
//!
//! **"The ledger, not the LMS, is the source of truth."** Canvas, or any school,
//! becomes replaceable furniture the moment the record of a mastery lives outside it.
//! This crate is that record: a signed, DID-bound, consent-carrying [`MasteryEvent`],
//! and the [`MasteryLedger`] read/write seam the b-engine observes.
//!
//! **Wall-clean by construction (k001, as legal armor).** The event holds only
//! *references* (`quest_id`, `quest_hash`) and a binary [`Outcome`] — no lesson content,
//! no health datum. A mastery ledger for a hemp-nutrition course and a welding course
//! are byte-identical in shape; there is no field a health claim could live in. That
//! structural identity is the armor.
//!
//! **The event records; the engine decides.** A `MasteryEvent` is never a mint. The
//! b-engine reads `Passed` events via [`MasteryLedger::since`] and applies
//! `Respect × attestation × QuestWeight × EdgeFactor`, with 420/PoUL/velocity enforced
//! at the ledger — never in the event, never in the reader. Nothing mints until §5/§1
//! ratify; the event just *exists*.
//!
//! Mock-first: [`MockLedger`] ships now; the L2 commons append (Arweave via
//! `adapter-arweave`'s event-bundle anchor) gates on a real substrate. Signature
//! verification is a seam — `capability::Verifier` is `Delegation`-specific, so it is
//! not reused; the subject's key check lands with the real ledger.

#![forbid(unsafe_code)]

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::fmt;

use capability::Did;
use serde::Serialize;
use sha2::{Digest, Sha256};

// ── content hash (identity + tamper-evidence) ──

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub struct ContentHash([u8; 32]);

impl ContentHash {
    pub fn of(bytes: &[u8]) -> Self {
        let mut h = [0u8; 32];
        h.copy_from_slice(&Sha256::digest(bytes));
        ContentHash(h)
    }
    pub fn from_bytes(b: [u8; 32]) -> Self {
        ContentHash(b)
    }
    pub fn to_hex(&self) -> String {
        self.0.iter().map(|b| format!("{b:02x}")).collect()
    }
}

impl fmt::Display for ContentHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

// ── value types (the taxonomy as data) ──

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QuestId(pub String);

/// Binary — the mint reads only `Passed`. No score, no grade, no health datum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Outcome {
    Passed,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Timestamp(pub i64);

/// A subject-signed authenticity tag over the canonical body. Hex, matching
/// `capability`'s convention. Verified against the subject's key by the real ledger
/// (seam; not wired in the skeleton — the property here is *structure*, not crypto).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Ed25519Sig(pub String);

/// A machine-readable, revocable consent grant. Invariant (§3): a [`MasteryEvent`]
/// **cannot be constructed** with a revoked consent — enforced in [`MasteryEvent::new`],
/// so an invalid-consent record does not merely fail to serialize, it cannot exist.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ConsentRef {
    pub grant_id: ContentHash,
    pub revoked: bool,
}

impl ConsentRef {
    pub fn granted(grant_id: ContentHash) -> Self {
        ConsentRef {
            grant_id,
            revoked: false,
        }
    }
    pub fn revoked(grant_id: ContentHash) -> Self {
        ConsentRef {
            grant_id,
            revoked: true,
        }
    }
    pub fn is_valid(&self) -> bool {
        !self.revoked
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LedgerError {
    /// §3 — construction refused: consent absent or revoked. No event exists.
    ConsentRevoked,
    /// A read found no events for the key.
    NotFound,
}

impl fmt::Display for LedgerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LedgerError::ConsentRevoked => {
                write!(f, "mastery ledger: consent absent or revoked — no event")
            }
            LedgerError::NotFound => write!(f, "mastery ledger: no events for key"),
        }
    }
}

impl std::error::Error for LedgerError {}

// ── the atom ──

/// The signable, hashable content — everything the `event_id` and `signature` commit
/// to. Private: the only way to a `MasteryEvent` is [`MasteryEvent::new`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
struct Body {
    subject: Did,
    quest_id: QuestId,
    quest_hash: ContentHash,
    outcome: Outcome,
    attested_by: Vec<Did>,
    consent: ConsentRef,
    recorded_at: Timestamp,
}

impl Body {
    /// The canonical bytes both `event_id` and the signature commit to. serde_json
    /// serializes struct fields in declaration order, so this is deterministic; a
    /// production ledger may harden the canonicalization, the shape is what matters here.
    fn canonical_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("Body is always serializable")
    }
}

/// A signed, DID-bound, consent-carrying record that a PoUL thread proved comprehension
/// of a quest version at a time. Content-addressed and tamper-evident.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MasteryEvent {
    event_id: ContentHash,
    body: Body,
    signature: Ed25519Sig,
}

impl MasteryEvent {
    /// The ONLY constructor. Refuses a revoked/absent consent (§3) and computes
    /// `event_id = sha256(canonical body)`. A record with invalid consent cannot exist.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        subject: Did,
        quest_id: QuestId,
        quest_hash: ContentHash,
        outcome: Outcome,
        attested_by: Vec<Did>,
        consent: ConsentRef,
        recorded_at: Timestamp,
        signature: Ed25519Sig,
    ) -> Result<Self, LedgerError> {
        if !consent.is_valid() {
            return Err(LedgerError::ConsentRevoked);
        }
        let body = Body {
            subject,
            quest_id,
            quest_hash,
            outcome,
            attested_by,
            consent,
            recorded_at,
        };
        let event_id = ContentHash::of(&body.canonical_bytes());
        Ok(MasteryEvent {
            event_id,
            body,
            signature,
        })
    }

    pub fn event_id(&self) -> &ContentHash {
        &self.event_id
    }
    pub fn subject(&self) -> &Did {
        &self.body.subject
    }
    pub fn quest_id(&self) -> &QuestId {
        &self.body.quest_id
    }
    pub fn quest_hash(&self) -> &ContentHash {
        &self.body.quest_hash
    }
    pub fn outcome(&self) -> Outcome {
        self.body.outcome
    }
    pub fn attested_by(&self) -> &[Did] {
        &self.body.attested_by
    }
    pub fn recorded_at(&self) -> Timestamp {
        self.body.recorded_at
    }
    pub fn signature(&self) -> &Ed25519Sig {
        &self.signature
    }

    /// The bytes a verifier hashes/signs — public so any reader can reproduce
    /// `event_id` and confirm the record was not edited (the un-suppressible property).
    pub fn canonical_bytes(&self) -> Vec<u8> {
        self.body.canonical_bytes()
    }

    /// §4/§6 — the distinct-counterparty edge, on PoUL-thread (`Did`) distinctness.
    /// Counts attestors distinct from the subject and from each other; a self-loop or an
    /// alias ring yields 0. The engine applies EdgeFactor only when this is `> 0` — the
    /// anti-farming property lives on thread identity, not on cheap accounts.
    pub fn distinct_attestors(&self) -> usize {
        self.body
            .attested_by
            .iter()
            .filter(|a| **a != self.body.subject)
            .collect::<BTreeSet<_>>()
            .len()
    }
}

// ── storage seam (adapter doctrine; substrate-agnostic) ──

/// Append-only, read by `since`. The b-engine's read-path is `since` — it never writes;
/// a reader that cannot write cannot forge the history it mints from.
pub trait MasteryLedger {
    fn append(&self, e: &MasteryEvent) -> Result<ContentHash, LedgerError>;
    fn events_for(&self, s: &Did) -> Result<Vec<MasteryEvent>, LedgerError>;
    fn since(&self, t: Timestamp) -> Result<Vec<MasteryEvent>, LedgerError>;
}

/// In-memory, mock-first. The L2 impl appends to the commons (Arweave via
/// `adapter-arweave`'s event-bundle anchor) and gates on a real substrate.
#[derive(Default)]
pub struct MockLedger {
    events: RefCell<Vec<MasteryEvent>>,
}

impl MockLedger {
    pub fn new() -> Self {
        MockLedger {
            events: RefCell::new(Vec::new()),
        }
    }
}

impl MasteryLedger for MockLedger {
    fn append(&self, e: &MasteryEvent) -> Result<ContentHash, LedgerError> {
        // Defense in depth: even an event that reached us by some future Deserialize
        // path re-checks consent here. (Today `new` is the only constructor, so this
        // never trips — belt beside the suspenders, honest about which is load-bearing.)
        if !e.body.consent.is_valid() {
            return Err(LedgerError::ConsentRevoked);
        }
        self.events.borrow_mut().push(e.clone());
        Ok(e.event_id.clone())
    }

    fn events_for(&self, s: &Did) -> Result<Vec<MasteryEvent>, LedgerError> {
        Ok(self
            .events
            .borrow()
            .iter()
            .filter(|e| &e.body.subject == s)
            .cloned()
            .collect())
    }

    fn since(&self, t: Timestamp) -> Result<Vec<MasteryEvent>, LedgerError> {
        Ok(self
            .events
            .borrow()
            .iter()
            .filter(|e| e.body.recorded_at >= t)
            .cloned()
            .collect())
    }
}

// ── tests: structure and refusals, red-then-green ──

#[cfg(test)]
mod tests {
    use super::*;

    fn did(s: &str) -> Did {
        Did::new(s)
    }
    fn qh() -> ContentHash {
        ContentHash::of(b"quest-v1")
    }
    fn sig() -> Ed25519Sig {
        Ed25519Sig("00".repeat(64)) // hex placeholder; crypto verification is the seam
    }
    fn event(subject: &str, outcome: Outcome, attestors: &[&str]) -> MasteryEvent {
        MasteryEvent::new(
            did(subject),
            QuestId("fat-label-basics".into()),
            qh(),
            outcome,
            attestors.iter().map(|a| did(a)).collect(),
            ConsentRef::granted(ContentHash::of(b"grant-1")),
            Timestamp(1_789_000_000),
            sig(),
        )
        .expect("valid consent constructs")
    }

    #[test]
    fn event_id_is_content_addressed() {
        let e = event("did:bee:alice", Outcome::Passed, &[]);
        assert_eq!(*e.event_id(), ContentHash::of(&e.canonical_bytes()));
    }

    #[test]
    fn a_changed_field_changes_the_identity() {
        let pass = event("did:bee:alice", Outcome::Passed, &[]);
        let fail = event("did:bee:alice", Outcome::Failed, &[]);
        assert_ne!(
            pass.event_id(),
            fail.event_id(),
            "tamper must change the id"
        );
    }

    #[test]
    fn revoked_consent_cannot_construct() {
        let err = MasteryEvent::new(
            did("did:bee:alice"),
            QuestId("q".into()),
            qh(),
            Outcome::Passed,
            vec![],
            ConsentRef::revoked(ContentHash::of(b"grant-1")),
            Timestamp(1),
            sig(),
        )
        .unwrap_err();
        assert_eq!(err, LedgerError::ConsentRevoked);
    }

    #[test]
    fn self_loop_and_empty_yield_no_edge() {
        assert_eq!(
            event("did:bee:alice", Outcome::Passed, &[]).distinct_attestors(),
            0
        );
        assert_eq!(
            event("did:bee:alice", Outcome::Passed, &["did:bee:alice"]).distinct_attestors(),
            0,
            "a self-attestation is not an edge"
        );
    }

    #[test]
    fn alias_ring_yields_nothing() {
        let e = event(
            "did:bee:alice",
            Outcome::Passed,
            &["did:bee:alice", "did:bee:alice"],
        );
        assert_eq!(
            e.distinct_attestors(),
            0,
            "an alias ring is still one thread"
        );
    }

    #[test]
    fn a_distinct_thread_is_an_edge() {
        let e = event(
            "did:bee:alice",
            Outcome::Passed,
            &["did:bee:bob", "did:bee:bob"],
        );
        assert_eq!(
            e.distinct_attestors(),
            1,
            "one distinct verifier, counted once"
        );
    }

    #[test]
    fn mock_ledger_append_and_read() {
        let led = MockLedger::new();
        led.append(&event("did:bee:alice", Outcome::Passed, &["did:bee:bob"]))
            .unwrap();
        led.append(&event("did:bee:carol", Outcome::Failed, &[]))
            .unwrap();
        assert_eq!(led.events_for(&did("did:bee:alice")).unwrap().len(), 1);
        assert_eq!(
            led.since(Timestamp(0)).unwrap().len(),
            2,
            "engine read-path sees all"
        );
        assert_eq!(
            led.since(Timestamp(1_789_000_001)).unwrap().len(),
            0,
            "since() is a floor"
        );
    }

    // GREEN pending the L2 impl: a real append/retrieve round-trip against the commons
    // (adapter-arweave event-bundle anchor). `cargo test` skips it.
    #[test]
    #[ignore = "waiting on the L2 commons MasteryLedger (adapter-arweave anchor)"]
    fn real_commons_round_trip() {
        unimplemented!(
            "L2 MasteryLedger: append to commons, read back by event_id + verify anchor"
        );
    }
}
