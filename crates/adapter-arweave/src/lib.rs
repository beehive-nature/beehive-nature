//! `permanence.anchor` adapter — bundle canonical events and anchor the
//! bundle's root hash to an independent, permanent substrate (Arweave).
//!
//! The kernel's event history lives on the coordination ledger and in
//! sovereign storage; this adapter is the *bomb-proof* third leg: a daily
//! (or any-cadence) bundle whose Merkle root is written to a substrate no
//! single operator controls. If everything else burns, the anchor proves
//! what the history was.
//!
//! Discipline (same as the other adapters):
//! - [`bundle`] is pure and deterministic — identical events + timestamp
//!   produce an identical root hash, bit for bit.
//! - Talking to real Arweave (HTTP gateways, wallet signing, fee funding)
//!   gates on credentials; it lives behind the [`ArweaveClient`] trait.
//!   v1 ships [`MockArweaveClient`]. No `todo!()` in shipped paths — the
//!   unbuilt network work sits behind the trait, not behind a panic.
//!
//! Hashing model (documented, so a verifier can reproduce it):
//! - Each event's leaf = `sha256(serde_json(event))`.
//! - A domain header = `sha256("bnature.bundle.v1" ‖ count_le ‖ as_of_le)`
//!   binds the event count and timestamp into every bundle (so the same
//!   events at a different time anchor to a different root).
//! - The root = `sha256(header ‖ merkle_root(leaves))`, where the Merkle
//!   fold pairs leaves with `sha256(0x01 ‖ l ‖ r)` and PROMOTES a final odd
//!   node UNCHANGED per R6b (never duplicates it — CVE-2012-2459). Checked
//!   against the shared cross-language vectors in `tests/r6/vectors/`.
//! - An empty bundle has root = `header` (valid, never a panic).
//!
//! NOTE: line 19's leaf rule (`sha256(serde_json(event))`) is the DOC; the code adds a
//! `0x00` domain tag (see `leaf_hash`). The doc is stale, not the code — flagged rather
//! than silently rewritten, since a leaf-rule change would move every historical root.

#![forbid(unsafe_code)]

use std::collections::BTreeMap;
use std::fmt;

use sha2::{Digest, Sha256};
use shared_types::CanonicalEvent;

/// Bundle-scheme domain tag; part of every header so a root can never be
/// confused with a hash computed under a different scheme.
const BUNDLE_DOMAIN: &[u8] = b"bnature.bundle.v1";

/// An Arweave transaction id. Newtype so a bundle root can never be passed
/// where a tx id is expected (or vice versa).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TxId(pub String);

impl fmt::Display for TxId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// A batch of canonical events plus the deterministic root that anchors it.
#[derive(Debug, Clone, PartialEq)]
pub struct EventBundle {
    pub events: Vec<CanonicalEvent>,
    /// Deterministic sha256 Merkle root over `events`, time-bound.
    pub bundle_hash: [u8; 32],
    pub created_at: i64,
}

impl EventBundle {
    /// Root as lowercase hex (the mock derives a tx id from it; a verifier
    /// compares against it).
    pub fn hash_hex(&self) -> String {
        hex(&self.bundle_hash)
    }
}

/// Anything that can persist a bundle to a permanence substrate and later
/// confirm it is anchored. Real implementations (Arweave HTTP + wallet)
/// land behind this trait; v1 uses [`MockArweaveClient`].
pub trait ArweaveClient {
    fn upload_bundle(&mut self, bundle: &EventBundle) -> Result<TxId, AnchorError>;
    fn verify_anchor(&self, tx_id: &TxId) -> Result<bool, AnchorError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnchorError {
    /// Transport/gateway failure talking to the substrate.
    Network(String),
    /// A bundle could not be serialized for upload.
    Serialization(String),
    /// A bundle's stored root does not match its recomputed root.
    InvalidHash,
}

impl fmt::Display for AnchorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnchorError::Network(e) => write!(f, "arweave network: {e}"),
            AnchorError::Serialization(e) => write!(f, "bundle serialization: {e}"),
            AnchorError::InvalidHash => write!(f, "bundle root does not match its events"),
        }
    }
}

impl std::error::Error for AnchorError {}

/// Bundle a batch of events with a deterministic, time-bound Merkle root.
/// Total: never panics, including on an empty event set.
pub fn bundle(events: Vec<CanonicalEvent>, as_of_unix: i64) -> EventBundle {
    let leaves: Vec<[u8; 32]> = events.iter().map(leaf_hash).collect();
    let header = header_hash(events.len() as u64, as_of_unix);
    let bundle_hash = match merkle_root(&leaves) {
        Some(root) => {
            let mut h = Sha256::new();
            h.update(header);
            h.update(root);
            h.finalize().into()
        }
        // No events: the header alone is the (valid, deterministic) root.
        None => header,
    };
    EventBundle {
        events,
        bundle_hash,
        created_at: as_of_unix,
    }
}

/// Recompute a bundle's root from its events and compare — the integrity
/// check a real `verify_anchor` runs before trusting stored metadata.
pub fn bundle_matches(b: &EventBundle) -> bool {
    bundle(b.events.clone(), b.created_at).bundle_hash == b.bundle_hash
}

fn leaf_hash(event: &CanonicalEvent) -> [u8; 32] {
    // A well-formed CanonicalEvent (all string keys) serializes infallibly;
    // on the impossible error we fall back to an empty-body leaf rather than
    // panic (no todo!/unwrap in shipped paths).
    let body = serde_json::to_vec(event).unwrap_or_default();
    let mut h = Sha256::new();
    h.update([0x00]); // leaf domain separation (prevents second-preimage)
    h.update(body);
    h.finalize().into()
}

fn header_hash(count: u64, as_of_unix: i64) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(BUNDLE_DOMAIN);
    h.update(count.to_le_bytes());
    h.update(as_of_unix.to_le_bytes());
    h.finalize().into()
}

/// Binary Merkle fold, RFC 6962 / **R6b**: `sha256(0x01 ‖ l ‖ r)` per node, and an odd
/// tail node is **PROMOTED UNCHANGED**. `None` for an empty leaf set.
///
/// ⚠ **DO NOT "SIMPLIFY" THIS BACK TO DUPLICATING THE ODD TAIL.** That is the Bitcoin
/// construction and it carries **CVE-2012-2459**: two *distinct* leaf sets — `[A,B,C]`
/// and `[A,B,C,C]` — fold to the **same root**, so the tree stops being injective and a
/// proof for one set validates against the other. This function shipped with that bug
/// until 2026-08-10; the conformance vectors below exist so it cannot come back silently.
fn merkle_root(leaves: &[[u8; 32]]) -> Option<[u8; 32]> {
    if leaves.is_empty() {
        return None;
    }
    let mut level: Vec<[u8; 32]> = leaves.to_vec();
    while level.len() > 1 {
        let odd = level.len() % 2 == 1;
        let paired = level.len() - usize::from(odd);
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level[..paired].chunks(2) {
            let mut h = Sha256::new();
            h.update([0x01]); // node domain separation
            h.update(pair[0]);
            h.update(pair[1]);
            next.push(h.finalize().into());
        }
        if odd {
            next.push(*level.last().expect("odd implies non-empty")); // PROMOTE UNCHANGED
        }
        level = next;
    }
    Some(level[0])
}

fn hex(bytes: &[u8; 32]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// v1 mock: records each uploaded bundle's root under a derived tx id and
/// answers `verify_anchor` from that memory. The tx id is deliberately
/// prefixed `mock-ar-` so it can never be mistaken for a real Arweave id.
#[derive(Debug, Default)]
pub struct MockArweaveClient {
    /// tx id → the bundle root it anchored.
    anchored: BTreeMap<String, [u8; 32]>,
}

impl MockArweaveClient {
    pub fn new() -> Self {
        Self::default()
    }

    /// How many bundles this mock has anchored (test/introspection aid).
    pub fn anchored_count(&self) -> usize {
        self.anchored.len()
    }
}

impl ArweaveClient for MockArweaveClient {
    fn upload_bundle(&mut self, bundle: &EventBundle) -> Result<TxId, AnchorError> {
        // Guard: the bundle's root must actually be its events' root. A real
        // uploader signs what it's given; the mock refuses a tampered bundle
        // so tests catch integrity drift here, not in production.
        if !bundle_matches(bundle) {
            return Err(AnchorError::InvalidHash);
        }
        let tx = TxId(format!("mock-ar-{}", bundle.hash_hex()));
        self.anchored.insert(tx.0.clone(), bundle.bundle_hash);
        Ok(tx)
    }

    fn verify_anchor(&self, tx_id: &TxId) -> Result<bool, AnchorError> {
        Ok(self.anchored.contains_key(&tx_id.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared_types::{EventPayload, EventType, OrderEvent, SourceChain};

    fn event(order_id: &str) -> CanonicalEvent {
        CanonicalEvent {
            event_id: format!("evt-{order_id}"),
            event_type: EventType::OrderFunded,
            timestamp: 1_782_200_000,
            source_chain: SourceChain::Zano,
            source_ref: format!("tx-{order_id}"),
            payload: EventPayload::Order(OrderEvent {
                order_id: order_id.into(),
                buyer_did: "did:plc:buyer".into(),
                seller_did: "did:plc:seller".into(),
                amount: 5_000_000,
                asset_id: "fusd-asset-id".into(),
                fee_buffer_zano: Some(10_000_000),
                escrow_wallet_id: Some("msig-1".into()),
                tracking: None,
                carrier: None,
            }),
            canonicalized_by: "normalizer".into(),
        }
    }

    const AS_OF: i64 = 1_782_200_500;

    #[test]
    fn bundle_hash_is_deterministic_in_events_and_time() {
        let a = bundle(vec![event("o1"), event("o2")], AS_OF);
        let b = bundle(vec![event("o1"), event("o2")], AS_OF);
        assert_eq!(
            a.bundle_hash, b.bundle_hash,
            "same events + time = same root"
        );

        // A different timestamp must move the root (the header binds time).
        let later = bundle(vec![event("o1"), event("o2")], AS_OF + 1);
        assert_ne!(a.bundle_hash, later.bundle_hash);

        // Different events must move the root.
        let other = bundle(vec![event("o1"), event("o3")], AS_OF);
        assert_ne!(a.bundle_hash, other.bundle_hash);

        // Order matters (a Merkle tree is not a set).
        let swapped = bundle(vec![event("o2"), event("o1")], AS_OF);
        assert_ne!(a.bundle_hash, swapped.bundle_hash);
    }

    #[test]
    fn empty_bundle_is_valid_and_never_panics() {
        let empty = bundle(Vec::new(), AS_OF);
        assert!(empty.events.is_empty());
        assert_eq!(empty.bundle_hash.len(), 32);
        assert_eq!(empty.created_at, AS_OF);
        // Deterministic and time-bound even when empty.
        assert_eq!(empty.bundle_hash, bundle(Vec::new(), AS_OF).bundle_hash);
        assert_ne!(empty.bundle_hash, bundle(Vec::new(), AS_OF + 1).bundle_hash);
        // And it round-trips through the mock like any other bundle.
        let mut client = MockArweaveClient::new();
        let tx = client.upload_bundle(&empty).unwrap();
        assert_eq!(client.verify_anchor(&tx), Ok(true));
    }

    #[test]
    fn mock_upload_returns_a_labelled_txid() {
        let mut client = MockArweaveClient::new();
        let b = bundle(vec![event("o1")], AS_OF);
        let tx = client.upload_bundle(&b).unwrap();
        assert!(tx.0.starts_with("mock-ar-"), "tx id is unmistakably a mock");
        assert!(
            tx.0.ends_with(&b.hash_hex()),
            "tx id carries the bundle root"
        );
        assert_eq!(client.anchored_count(), 1);
    }

    #[test]
    fn verify_is_true_for_known_and_false_for_unknown() {
        let mut client = MockArweaveClient::new();
        let tx = client
            .upload_bundle(&bundle(vec![event("o1")], AS_OF))
            .unwrap();
        assert_eq!(client.verify_anchor(&tx), Ok(true));
        assert_eq!(
            client.verify_anchor(&TxId("mock-ar-deadbeef".into())),
            Ok(false)
        );
    }

    #[test]
    fn mock_refuses_a_tampered_bundle() {
        // A bundle whose stored root disagrees with its events is rejected
        // at upload — integrity drift surfaces here, not on-chain.
        let mut b = bundle(vec![event("o1")], AS_OF);
        b.bundle_hash[0] ^= 0xff;
        let mut client = MockArweaveClient::new();
        assert_eq!(client.upload_bundle(&b), Err(AnchorError::InvalidHash));
    }
}

/// R6 CROSS-LANGUAGE CONFORMANCE — the Rust fold checked against the SHARED vectors.
///
/// Why this module exists (earned 2026-08-10): the R6 conformance suite in `tests/r6/`
/// tested the **Python reference**, while this crate — the Rust that actually ships —
/// duplicated its odd tail and therefore carried **CVE-2012-2459** the whole time. A suite
/// that guards a model of the system does not guard the system. These tests close that gap
/// by making both implementations answer to **one artifact**.
///
/// Vectors: `tests/r6/vectors/merkle_fold.json`, generated by `tests/r6/gen_vectors.py`
/// from the same `merkle.py` the Python suite exercises — so the vectors cannot drift away
/// from the suite that validates them. Regenerate after any ruled change to R6a/R6b.
#[cfg(test)]
mod r6_conformance {
    use super::merkle_root;
    use serde_json::Value;

    const VECTORS: &str = include_str!("../../../tests/r6/vectors/merkle_fold.json");

    fn h32(s: &str) -> [u8; 32] {
        let b: Vec<u8> = (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex"))
            .collect();
        b.try_into().expect("32 bytes")
    }
    /// Each hash is `"<hex> TESTNET-ONLY"`, not a bare hex string, so the secret-scan hook
    /// sees the annotation on the SAME LINE (LAW 8g — a public test vector and a private
    /// key are the same shape to a scanner). **Do not strip the suffix from the vectors.**
    fn h_of(v: &Value) -> [u8; 32] {
        h32(v.as_str().expect("tagged hash").split_whitespace().next().expect("hex"))
    }
    fn leaves_of(v: &Value) -> Vec<[u8; 32]> {
        v["leaves"].as_array().unwrap().iter().map(h_of).collect()
    }
    fn root_of(v: &Value) -> [u8; 32] { h_of(&v["root"]) }

    #[test]
    fn rust_fold_matches_the_shared_vectors_at_every_n() {
        let v: Value = serde_json::from_str(VECTORS).expect("vectors parse");
        let cases = v["cases"].as_array().expect("cases");
        assert!(cases.len() >= 12, "vector set shrank — regenerate, do not weaken the test");
        for c in cases {
            let n = c["n"].as_u64().unwrap();
            let got = merkle_root(&leaves_of(c)).expect("non-empty");
            assert_eq!(got, root_of(c), "FOLD DIVERGES from the shared vector at N={n}");
        }
    }

    /// NEGATIVE CONTROL (8r). `[A,B,C]` and `[A,B,C,C]` are DISTINCT leaf sets. Under the
    /// duplicating fold they produce an IDENTICAL root — that is CVE-2012-2459, and the
    /// vector file records exactly what that collision value is.
    ///
    /// If this test ever fails, the fold has regressed to duplicating the odd tail. **Do
    /// not "fix" it by updating the expected value** — the expected value is the ruling.
    #[test]
    fn cve_2012_2459_does_not_reproduce_under_the_ruled_fold() {
        let v: Value = serde_json::from_str(VECTORS).expect("vectors parse");
        let cve = &v["cve_2012_2459"];
        let (a, b) = (&cve["set_a"], &cve["set_b"]);

        let root_a = merkle_root(&leaves_of(a)).unwrap();
        let root_b = merkle_root(&leaves_of(b)).unwrap();

        assert_eq!(root_a, root_of(a), "set_a diverges from the shared vector");
        assert_eq!(root_b, root_of(b), "set_b diverges from the shared vector");
        assert_ne!(root_a, root_b, "CVE-2012-2459 REPRODUCES: distinct leaf sets share a root");

        // The sharper assertion: our root for set_a must NOT be the value a duplicating
        // fold would produce. Set inequality alone could hold for the wrong reason.
        let duplicating = h_of(&cve["duplicating_fold_gives_both_sets"]);
        assert_ne!(root_a, duplicating, "the fold is duplicating its odd tail");
        assert_eq!(root_b, duplicating,
            "vector self-check: set_b (even, 4 leaves) must equal the duplicating fold of set_a — \
             if this fails the CONTROL is broken, not the implementation");
    }
}
